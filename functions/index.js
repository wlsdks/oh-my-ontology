import { initializeApp, getApps } from "firebase-admin/app";
import {
  FieldValue,
  Timestamp,
  getFirestore,
} from "firebase-admin/firestore";
import { HttpsError, onCall } from "firebase-functions/v2/https";
import { logger, setGlobalOptions } from "firebase-functions/v2";

/**
 * extractorVersion 디스크리미네이터 — `ontology-` 접두면 신규 Anthropic 워커
 * (T-4d JS mirror), 그 외 (`gemini-v1` 등) 는 기존 Gemini 경로.
 */
const REGION = "asia-northeast3";
const PROJECTION_VERSION = "v1";
const COLLECTIONS = {
  admins: "admins",
  documents: "knowledgeDocuments",
  versions: "knowledgeDocumentVersions",
  jobs: "knowledgeExtractionJobs",
  chunks: "knowledgeDocumentChunks",
  outputs: "knowledgeExtractionOutputs",
  evidence: "knowledgeEvidence",
  reviews: "knowledgeReviews",
  approvalEvents: "knowledgeApprovalEvents",
  approvedNodes: "knowledgeApprovedNodes",
  approvedEdges: "knowledgeApprovedEdges",
  publishes: "knowledgePublishes",
  publicMeta: "knowledgePublicMeta",
  publicNodes: "knowledgePublicNodes",
  publicEdges: "knowledgePublicEdges",
};
setGlobalOptions({
  region: REGION,
  maxInstances: 10,
});

function ensureApp() {
  if (getApps().length === 0) {
    const firebaseConfig = process.env.FIREBASE_CONFIG
      ? JSON.parse(process.env.FIREBASE_CONFIG)
      : null;
    const projectId = process.env.GCLOUD_PROJECT || firebaseConfig?.projectId;
    initializeApp({
      storageBucket: projectId ? `${projectId}.firebasestorage.app` : undefined,
    });
  }
}

function db() {
  ensureApp();
  return getFirestore();
}

function normalizeString(value) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeAccountId(value) {
  const normalized = normalizeString(value);
  return normalized || null;
}

function buildPublicMetaId() {
  return "current";
}

function knowledgeDocumentRef(documentId) {
  return db().collection(COLLECTIONS.documents).doc(documentId);
}

function knowledgeVersionRef(versionId) {
  return db().collection(COLLECTIONS.versions).doc(versionId);
}


function normalizeStringArray(value) {
  return Array.isArray(value)
    ? [...new Set(value.map((item) => normalizeString(item)).filter(Boolean))]
    : [];
}

function normalizeKey(value) {
  return normalizeString(value)
    .toLowerCase()
    .replace(/[^a-z0-9가-힣]+/g, "-")
    .replace(/^-+|-+$/g, "") || "unknown";
}

async function commitWriteOperations(operations, chunkSize = 400) {
  if (!Array.isArray(operations) || operations.length === 0) {
    return;
  }

  for (let index = 0; index < operations.length; index += chunkSize) {
    const batch = db().batch();
    const currentChunk = operations.slice(index, index + chunkSize);
    currentChunk.forEach((operation) => {
      if (operation.type === "delete") {
        batch.delete(operation.ref);
        return;
      }

      batch.set(operation.ref, operation.data, operation.options || {});
    });
    await batch.commit();
  }
}

function buildCanonicalNodeId(node, documentId) {
  if (node.kind === "document") {
    return `document:${documentId}`;
  }

  if (node.kind === "project") {
    const projectKey = normalizeKey(node.projectIds?.[0] || node.title);
    return `project:${projectKey}`;
  }

  const scopeKey = normalizeKey(
    normalizeStringArray(node.projectIds).join("-") || "global",
  );
  return `${normalizeKey(node.kind)}:${scopeKey}:${normalizeKey(node.title)}`;
}

function resolveCanonicalParentId(node, documentId) {
  if (node.kind === "document") {
    const primaryProjectId = normalizeStringArray(node.projectIds)[0];
    return primaryProjectId ? `project:${normalizeKey(primaryProjectId)}` : null;
  }

  if (node.kind === "domain") {
    return `document:${documentId}`;
  }

  if (node.kind === "capability") {
    return `document:${documentId}`;
  }

  if (node.kind === "element") {
    return `document:${documentId}`;
  }

  return null;
}

function mapOutputEdgeType(type) {
  switch (type) {
    case "references_project":
      return "describes";
    case "describes_domain":
      return "belongs_to";
    case "has_capability":
    case "has_element":
      return "implements";
    case "relates_concept":
      return "related_to";
    default:
      return "related_to";
  }
}

function mergeUniqueStrings(...values) {
  return [
    ...new Set(
      values.flatMap((value) => {
        if (typeof value === "string") {
          const normalized = normalizeString(value);
          return normalized ? [normalized] : [];
        }
        return normalizeStringArray(value);
      }),
    ),
  ];
}

async function getLatestOutputRecord({
  accountId,
  documentId,
  documentVersionId,
  outputId,
}) {
  if (outputId) {
    const snapshot = await db().collection(COLLECTIONS.outputs).doc(outputId).get();
    if (!snapshot.exists) {
      throw new HttpsError("not-found", "추출 결과를 찾을 수 없습니다.");
    }
    return { id: snapshot.id, ...snapshot.data() };
  }

  const snapshot = await db()
    .collection(COLLECTIONS.outputs)
    .where("documentVersionId", "==", documentVersionId)
    .orderBy("createdAt", "desc")
    .limit(10)
    .get();
  const output = snapshot.docs
    .map((entry) => ({ id: entry.id, ...entry.data() }))
    .find((entry) => {
      const scopedOutputAccountId = normalizeAccountId(entry.accountId);
      return (
        normalizeString(entry.documentId) === documentId &&
        scopedOutputAccountId === normalizeAccountId(accountId)
      );
    });

  if (!output) {
    throw new HttpsError("failed-precondition", "승인할 추출 결과가 아직 없습니다.");
  }

  return output;
}

export async function applyReviewActionCore({
  accountId,
  documentId,
  documentVersionId,
  outputId,
  acceptedNodeTempIds,
  acceptedEdgeTempIds,
  requestedBy,
}) {
  const scopedAccountId = normalizeAccountId(accountId);
  const latestOutput = await getLatestOutputRecord({
    accountId: scopedAccountId,
    documentId,
    documentVersionId,
    outputId,
  });
  const evidenceSnapshot = await db()
    .collection(COLLECTIONS.evidence)
    .where("sourceOutputId", "==", latestOutput.id)
    .get();
  const evidenceIds = evidenceSnapshot.docs
    .map((entry) => entry.id)
    .filter(Boolean);
  const allNodes = Array.isArray(latestOutput.nodes) ? latestOutput.nodes : [];
  const allEdges = Array.isArray(latestOutput.edges) ? latestOutput.edges : [];

  // Partial approve — acceptedNodeTempIds / acceptedEdgeTempIds 가 제공되면
  // 그 tempId 만 승인. 미제공 (undefined) 이면 기존 동작 (전체 승인). 빈
  // 배열은 "아무것도 승인 안 함" 으로 해석돼 evidenceIds 만 기록되는 셈인데
  // 그럴 거면 reject_output 을 쓰는 게 자연스러움 — 명시 거절.
  const acceptNodeIds =
    acceptedNodeTempIds === undefined ? null : normalizeStringArray(acceptedNodeTempIds);
  const acceptEdgeIds =
    acceptedEdgeTempIds === undefined ? null : normalizeStringArray(acceptedEdgeTempIds);
  const outputNodes =
    acceptNodeIds === null
      ? allNodes
      : allNodes.filter((n) => acceptNodeIds.includes(normalizeString(n?.tempId)));
  const outputEdges =
    acceptEdgeIds === null
      ? allEdges
      : allEdges.filter((e) => acceptEdgeIds.includes(normalizeString(e?.tempId)));

  if (acceptNodeIds !== null && outputNodes.length === 0 && acceptEdgeIds === null) {
    throw new HttpsError(
      "invalid-argument",
      "acceptedNodeTempIds 가 output 의 후보 tempId 와 일치하지 않습니다.",
    );
  }
  const reviewRef = db().collection(COLLECTIONS.reviews).doc();
  const approvalEventRef = db().collection(COLLECTIONS.approvalEvents).doc();
  const approvedAt = FieldValue.serverTimestamp();
  const canonicalNodeIdByTempId = new Map();
  const parentIdByCanonicalId = new Map();

  for (const node of outputNodes) {
    const canonicalId = buildCanonicalNodeId(node, documentId);
    canonicalNodeIdByTempId.set(node.tempId, canonicalId);
  }

  for (const edge of outputEdges) {
    const from = canonicalNodeIdByTempId.get(edge.fromTempId);
    const to = canonicalNodeIdByTempId.get(edge.toTempId);
    if (!from || !to) continue;
    if (["describes_domain", "has_capability", "has_element"].includes(edge.type)) {
      parentIdByCanonicalId.set(to, from);
    }
  }

  const nodeRefs = [...new Set([...canonicalNodeIdByTempId.values()])].map((id) =>
    db().collection(COLLECTIONS.approvedNodes).doc(id),
  );
  const edgePayloads = outputEdges
    .map((edge) => {
      const from = canonicalNodeIdByTempId.get(edge.fromTempId);
      const to = canonicalNodeIdByTempId.get(edge.toTempId);
      if (!from || !to) return null;
      const type = mapOutputEdgeType(edge.type);
      return {
        id: `${type}:${from}->${to}`,
        from,
        to,
        type,
        label: normalizeString(edge.label) || undefined,
      };
    })
    .filter(Boolean);
  const edgeRefs = edgePayloads.map((edge) =>
    db().collection(COLLECTIONS.approvedEdges).doc(edge.id),
  );

  const existingSnapshots = await db().getAll(...nodeRefs, ...edgeRefs);
  const existingNodeMap = new Map();
  const existingEdgeMap = new Map();

  for (const snapshot of existingSnapshots) {
    if (!snapshot.exists) continue;
    if (snapshot.ref.parent.id === COLLECTIONS.approvedNodes) {
      existingNodeMap.set(snapshot.id, snapshot.data());
      continue;
    }
    if (snapshot.ref.parent.id === COLLECTIONS.approvedEdges) {
      existingEdgeMap.set(snapshot.id, snapshot.data());
    }
  }

  const batch = db().batch();
  const approvedNodeIds = [];
  const approvedEdgeIds = [];

  batch.set(reviewRef, {
    ...(scopedAccountId ? { accountId: scopedAccountId } : {}),
    type: "approve_output",
    status: "approved",
    documentId,
    documentVersionId,
    outputId: latestOutput.id,
    assignedTo: requestedBy,
    createdAt: approvedAt,
    updatedAt: approvedAt,
  });

  for (const node of outputNodes) {
    const canonicalId = canonicalNodeIdByTempId.get(node.tempId);
    if (!canonicalId) continue;
    const existingNode = existingNodeMap.get(canonicalId) || {};
    const projectIds = mergeUniqueStrings(existingNode.projectIds, node.projectIds);
    const parentId =
      existingNode.parentId ||
      parentIdByCanonicalId.get(canonicalId) ||
      resolveCanonicalParentId(node, documentId) ||
      null;
    batch.set(
      db().collection(COLLECTIONS.approvedNodes).doc(canonicalId),
      {
        ...(scopedAccountId ? { accountId: scopedAccountId } : {}),
        id: canonicalId,
        title: normalizeString(node.title) || canonicalId,
        kind: normalizeString(node.kind) || "unknown",
        projectIds,
        ...(parentId ? { parentId } : {}),
        summary:
          normalizeString(node.summary) || normalizeString(existingNode.summary),
        evidenceIds: mergeUniqueStrings(existingNode.evidenceIds, evidenceIds),
        currentRevisionId: approvalEventRef.id,
        lastApprovedAt: approvedAt,
        lastApprovedBy: requestedBy,
        sourceDocumentIds: mergeUniqueStrings(
          existingNode.sourceDocumentIds,
          documentId,
        ),
        sourceOutputIds: mergeUniqueStrings(
          existingNode.sourceOutputIds,
          latestOutput.id,
        ),
      },
      { merge: true },
    );
    approvedNodeIds.push(canonicalId);
  }

  for (const edge of edgePayloads) {
    const existingEdge = existingEdgeMap.get(edge.id) || {};
    batch.set(
      db().collection(COLLECTIONS.approvedEdges).doc(edge.id),
      {
        ...(scopedAccountId ? { accountId: scopedAccountId } : {}),
        id: edge.id,
        from: edge.from,
        to: edge.to,
        type: edge.type,
        ...(edge.label ? { label: edge.label } : {}),
        projectIds: mergeUniqueStrings(
          existingEdge.projectIds,
          [
            ...(existingNodeMap.get(edge.from)?.projectIds || []),
            ...(existingNodeMap.get(edge.to)?.projectIds || []),
          ],
          outputNodes
            .filter(
              (node) =>
                canonicalNodeIdByTempId.get(node.tempId) === edge.from ||
                canonicalNodeIdByTempId.get(node.tempId) === edge.to,
            )
            .flatMap((node) => normalizeStringArray(node.projectIds)),
        ),
        evidenceIds: mergeUniqueStrings(existingEdge.evidenceIds, evidenceIds),
        currentRevisionId: approvalEventRef.id,
        lastApprovedAt: approvedAt,
        lastApprovedBy: requestedBy,
        sourceDocumentIds: mergeUniqueStrings(
          existingEdge.sourceDocumentIds,
          documentId,
        ),
        sourceOutputIds: mergeUniqueStrings(
          existingEdge.sourceOutputIds,
          latestOutput.id,
        ),
      },
      { merge: true },
    );
    approvedEdgeIds.push(edge.id);
  }

  batch.set(approvalEventRef, {
    ...(scopedAccountId ? { accountId: scopedAccountId } : {}),
    reviewId: reviewRef.id,
    documentId,
    documentVersionId,
    outputId: latestOutput.id,
    approvedNodeIds,
    approvedEdgeIds,
    createdAt: approvedAt,
    createdBy: requestedBy,
  });

  await batch.commit();

  logger.info("applyReviewAction approved output", {
    accountId: scopedAccountId,
    documentId,
    documentVersionId,
    outputId: latestOutput.id,
    approvedNodeCount: approvedNodeIds.length,
    approvedEdgeCount: approvedEdgeIds.length,
  });

  return {
    reviewId: reviewRef.id,
    approvalEventId: approvalEventRef.id,
    outputId: latestOutput.id,
    approvedNodeCount: approvedNodeIds.length,
    approvedEdgeCount: approvedEdgeIds.length,
  };
}

/**
 * rejectOutputCore — output 의 일부 또는 전체 후보를 거절로 기록.
 *
 * T-11 정확도 측정의 분모(전체 후보 = approve + reject) 보존을 목적으로 한다.
 * `knowledgeApprovedNodes/Edges` 는 건드리지 않고, `knowledgeReviews` +
 * `knowledgeApprovalEvents` 에만 거절 사실을 남긴다.
 *
 * 입력:
 *   - rejectedNodeTempIds[] / rejectedEdgeTempIds[] — 미제공 또는 빈 배열이면
 *     "전체 거절" 로 간주 (output 의 모든 nodes/edges).
 *   - reason — 거절 사유 (선택). 같은 doc 재추출 시 같은 잘못된 후보를 다시
 *     보면 검수자가 즉시 인지하도록 텍스트로 보존.
 *
 * 동작:
 *   1. latestOutput read.
 *   2. reviewRef: type="reject_output", status="rejected".
 *   3. approvalEvent: rejectedNodeTempIds, rejectedEdgeTempIds, reason 기록.
 *   4. approvedNodes/Edges 무변경.
 *
 * partial approve (한 output 에서 일부만 승인) 는 P1 — 별도 fire.
 */
export async function rejectOutputCore({
  accountId,
  documentId,
  documentVersionId,
  outputId,
  rejectedNodeTempIds,
  rejectedEdgeTempIds,
  reason,
  requestedBy,
}) {
  const scopedAccountId = normalizeAccountId(accountId);
  const latestOutput = await getLatestOutputRecord({
    accountId: scopedAccountId,
    documentId,
    documentVersionId,
    outputId,
  });

  const outputNodes = Array.isArray(latestOutput.nodes) ? latestOutput.nodes : [];
  const outputEdges = Array.isArray(latestOutput.edges) ? latestOutput.edges : [];

  const allNodeTempIds = outputNodes
    .map((n) => normalizeString(n?.tempId))
    .filter(Boolean);
  const allEdgeTempIds = outputEdges
    .map((e) => normalizeString(e?.tempId))
    .filter(Boolean);

  const requestedNodeIds = normalizeStringArray(rejectedNodeTempIds);
  const requestedEdgeIds = normalizeStringArray(rejectedEdgeTempIds);

  const isFullReject =
    requestedNodeIds.length === 0 && requestedEdgeIds.length === 0;

  const finalNodeIds = isFullReject
    ? allNodeTempIds
    : requestedNodeIds.filter((id) => allNodeTempIds.includes(id));
  const finalEdgeIds = isFullReject
    ? allEdgeTempIds
    : requestedEdgeIds.filter((id) => allEdgeTempIds.includes(id));

  if (
    !isFullReject &&
    finalNodeIds.length === 0 &&
    finalEdgeIds.length === 0
  ) {
    throw new HttpsError(
      "invalid-argument",
      "rejectedNodeTempIds 또는 rejectedEdgeTempIds 가 output 의 후보와 일치하지 않습니다.",
    );
  }

  const reviewRef = db().collection(COLLECTIONS.reviews).doc();
  const approvalEventRef = db().collection(COLLECTIONS.approvalEvents).doc();
  const rejectedAt = FieldValue.serverTimestamp();
  const trimmedReason = normalizeString(reason);

  const batch = db().batch();

  batch.set(reviewRef, {
    ...(scopedAccountId ? { accountId: scopedAccountId } : {}),
    type: "reject_output",
    status: "rejected",
    documentId,
    documentVersionId,
    outputId: latestOutput.id,
    rejectedNodeTempIds: finalNodeIds,
    rejectedEdgeTempIds: finalEdgeIds,
    ...(trimmedReason ? { reason: trimmedReason } : {}),
    assignedTo: requestedBy,
    createdAt: rejectedAt,
    updatedAt: rejectedAt,
  });

  batch.set(approvalEventRef, {
    ...(scopedAccountId ? { accountId: scopedAccountId } : {}),
    reviewId: reviewRef.id,
    type: "reject_output",
    documentId,
    documentVersionId,
    outputId: latestOutput.id,
    rejectedNodeTempIds: finalNodeIds,
    rejectedEdgeTempIds: finalEdgeIds,
    ...(trimmedReason ? { reason: trimmedReason } : {}),
    createdAt: rejectedAt,
    createdBy: requestedBy,
  });

  await batch.commit();

  logger.info("applyReviewAction rejected output", {
    accountId: scopedAccountId,
    documentId,
    documentVersionId,
    outputId: latestOutput.id,
    rejectedNodeCount: finalNodeIds.length,
    rejectedEdgeCount: finalEdgeIds.length,
  });

  return {
    reviewId: reviewRef.id,
    approvalEventId: approvalEventRef.id,
    outputId: latestOutput.id,
    rejectedNodeCount: finalNodeIds.length,
    rejectedEdgeCount: finalEdgeIds.length,
  };
}

export async function publishKnowledgeProjectionCore({
  accountId,
  initiatedBy,
}) {
  const scopedAccountId = normalizeAccountId(accountId);
  let approvedNodesQuery = db().collection(COLLECTIONS.approvedNodes);
  let approvedEdgesQuery = db().collection(COLLECTIONS.approvedEdges);
  if (scopedAccountId) {
    approvedNodesQuery = approvedNodesQuery.where("accountId", "==", scopedAccountId);
    approvedEdgesQuery = approvedEdgesQuery.where("accountId", "==", scopedAccountId);
  }

  const [approvedNodesSnapshot, approvedEdgesSnapshot] = await Promise.all([
    approvedNodesQuery.get(),
    approvedEdgesQuery.get(),
  ]);
  let publicNodesQuery = db().collection(COLLECTIONS.publicNodes);
  let publicEdgesQuery = db().collection(COLLECTIONS.publicEdges);
  if (scopedAccountId) {
    publicNodesQuery = publicNodesQuery.where("accountId", "==", scopedAccountId);
    publicEdgesQuery = publicEdgesQuery.where("accountId", "==", scopedAccountId);
  }
  const [existingPublicNodesSnapshot, existingPublicEdgesSnapshot] = await Promise.all([
    publicNodesQuery.get(),
    publicEdgesQuery.get(),
  ]);
  const publishRef = db().collection(COLLECTIONS.publishes).doc();
  const publicMetaRef = db()
    .collection(COLLECTIONS.publicMeta)
    .doc(buildPublicMetaId());
  const startedAt = FieldValue.serverTimestamp();
  // soft-deleted (deletedAt 박힌) approved 노드/엣지는 publish 에서 제외 —
  // 공개 projection 에 폐기된 stub 이 새는 것을 막음.
  const approvedNodeDocs = approvedNodesSnapshot.docs.filter((s) => !s.data().deletedAt);
  const approvedEdgeDocs = approvedEdgesSnapshot.docs.filter((s) => !s.data().deletedAt);
  const approvedNodeIds = new Set(approvedNodeDocs.map((s) => s.id));
  const approvedEdgeIds = new Set(approvedEdgeDocs.map((s) => s.id));

  await publishRef.set({
    ...(scopedAccountId ? { accountId: scopedAccountId } : {}),
    id: publishRef.id,
    status: "running",
    initiatedBy,
    startedAt,
    sourceApprovedRevision: "mixed",
    nodeCount: approvedNodeDocs.length,
    edgeCount: approvedEdgeDocs.length,
    projectionVersion: PROJECTION_VERSION,
  });

  const writeOperations = [];

  for (const snapshot of approvedNodeDocs) {
    const data = snapshot.data();
    writeOperations.push({
      type: "set",
      ref: db().collection(COLLECTIONS.publicNodes).doc(snapshot.id),
      data: {
        ...(scopedAccountId ? { accountId: scopedAccountId } : {}),
        id: snapshot.id,
        title: normalizeString(data.title) || snapshot.id,
        kind: normalizeString(data.kind) || "unknown",
        projectIds: normalizeStringArray(data.projectIds),
        ...(normalizeString(data.parentId) ? { parentId: normalizeString(data.parentId) } : {}),
        ...(normalizeString(data.summary) ? { summary: normalizeString(data.summary) } : {}),
        evidenceCount: normalizeStringArray(data.evidenceIds).length,
        publishId: publishRef.id,
        projectionVersion: PROJECTION_VERSION,
        publishedAt: startedAt,
        lastApprovedAt: data.lastApprovedAt || startedAt,
      },
      options: { merge: true },
    });
  }

  for (const snapshot of approvedEdgeDocs) {
    const data = snapshot.data();
    writeOperations.push({
      type: "set",
      ref: db().collection(COLLECTIONS.publicEdges).doc(snapshot.id),
      data: {
        ...(scopedAccountId ? { accountId: scopedAccountId } : {}),
        id: snapshot.id,
        from: normalizeString(data.from),
        to: normalizeString(data.to),
        type: normalizeString(data.type) || "related_to",
        ...(normalizeString(data.label) ? { label: normalizeString(data.label) } : {}),
        projectIds: normalizeStringArray(data.projectIds),
        // 증거 갯수 — 클라이언트에서 edge 두께 가중 (evidence 많을수록 굵게)
        // 에 쓴다. nodes 와 동일한 명명규칙.
        evidenceCount: normalizeStringArray(data.evidenceIds).length,
        publishId: publishRef.id,
        projectionVersion: PROJECTION_VERSION,
        publishedAt: startedAt,
        lastApprovedAt: data.lastApprovedAt || startedAt,
      },
      options: { merge: true },
    });
  }

  for (const snapshot of existingPublicNodesSnapshot.docs) {
    if (!approvedNodeIds.has(snapshot.id)) {
      writeOperations.push({
        type: "delete",
        ref: snapshot.ref,
      });
    }
  }

  for (const snapshot of existingPublicEdgesSnapshot.docs) {
    if (!approvedEdgeIds.has(snapshot.id)) {
      writeOperations.push({
        type: "delete",
        ref: snapshot.ref,
      });
    }
  }

  writeOperations.push({
    type: "set",
    ref: publicMetaRef,
    data: {
      ...(scopedAccountId ? { accountId: scopedAccountId } : {}),
      currentPublishId: publishRef.id,
      projectionVersion: PROJECTION_VERSION,
      publishedAt: startedAt,
    },
    options: { merge: true },
  });

  writeOperations.push({
    type: "set",
    ref: publishRef,
    data: {
      status: "succeeded",
      completedAt: startedAt,
    },
    options: { merge: true },
  });

  await commitWriteOperations(writeOperations);

  // 공개 반영 성공 시, 이번 publish 에 포함된 approvedNodes/Edges 의
  // sourceDocumentIds 를 모아 해당 knowledgeDocuments 의 status 를
  // 'published' 로 전환. 공개 detail 페이지의 rule (isAccountPublic &&
  // status == 'published') 조건을 만족시키는 유일한 곳.
  const publishedDocumentIds = new Set();
  for (const snapshot of approvedNodesSnapshot.docs) {
    const data = snapshot.data();
    for (const docId of normalizeStringArray(data.sourceDocumentIds)) {
      publishedDocumentIds.add(docId);
    }
  }
  for (const snapshot of approvedEdgesSnapshot.docs) {
    const data = snapshot.data();
    for (const docId of normalizeStringArray(data.sourceDocumentIds)) {
      publishedDocumentIds.add(docId);
    }
  }

  if (publishedDocumentIds.size > 0) {
    const documentsRoot = db().collection(COLLECTIONS.documents);
    const docBatch = db().batch();
    for (const docId of publishedDocumentIds) {
      docBatch.set(
        documentsRoot.doc(docId),
        {
          status: "published",
          lastPublishedAt: startedAt,
          lastPublishId: publishRef.id,
        },
        { merge: true },
      );
    }
    await docBatch.commit();
  }

  logger.info("publishKnowledgeProjection succeeded", {
    accountId: scopedAccountId,
    publishId: publishRef.id,
    nodeCount: approvedNodesSnapshot.size,
    edgeCount: approvedEdgesSnapshot.size,
    publishedDocumentCount: publishedDocumentIds.size,
  });

  return {
    publishId: publishRef.id,
    nodeCount: approvedNodesSnapshot.size,
    edgeCount: approvedEdgesSnapshot.size,
    projectionVersion: PROJECTION_VERSION,
  };
}


export const applyReviewAction = onCall(async (request) => {
  ensureApp();

  const email = normalizeString(request.auth?.token?.email);
  if (!email) {
    throw new HttpsError("unauthenticated", "로그인이 필요합니다.");
  }

  const adminSnapshot = await db().collection(COLLECTIONS.admins).doc(email).get();
  if (!adminSnapshot.exists) {
    throw new HttpsError("permission-denied", "화이트리스트 관리자만 실행할 수 있습니다.");
  }

  const action = normalizeString(request.data?.action);
  if (action !== "approve_output" && action !== "reject_output") {
    throw new HttpsError("invalid-argument", "지원하지 않는 review action입니다.");
  }

  const documentId = normalizeString(request.data?.documentId);
  const documentVersionId = normalizeString(request.data?.documentVersionId);
  const outputId = normalizeString(request.data?.outputId) || undefined;
  const accountId = normalizeAccountId(request.data?.accountId);

  if (!documentId || !documentVersionId) {
    throw new HttpsError(
      "invalid-argument",
      "documentId와 documentVersionId는 필수입니다.",
    );
  }

  if (action === "reject_output") {
    return rejectOutputCore({
      accountId,
      documentId,
      documentVersionId,
      outputId,
      rejectedNodeTempIds: request.data?.rejectedNodeTempIds,
      rejectedEdgeTempIds: request.data?.rejectedEdgeTempIds,
      reason: request.data?.reason,
      requestedBy: email,
    });
  }

  return applyReviewActionCore({
    accountId,
    documentId,
    documentVersionId,
    outputId,
    acceptedNodeTempIds: request.data?.acceptedNodeTempIds,
    acceptedEdgeTempIds: request.data?.acceptedEdgeTempIds,
    requestedBy: email,
  });
});

/**
 * promoteStubNode — stub placeholder 를 진짜 노드로 승격.
 *
 * 결정 문서: 2026-04-27-ontology-id-resolution.md §2.1
 *
 * 입력: { nodeId, newKind, accountId? }
 *   - nodeId: 현재 stub canonical (예: "unknown:iam")
 *   - newKind: 5 종 enum (project / domain / capability / element / document)
 *
 * 동작:
 *   1. stub 노드 read + isStub=true 확인
 *   2. 새 canonical = `<newKind>:<idFromStub>` (예: "project:iam")
 *   3. 새 노드 write — kind=newKind, isStub/pendingType/pendingFromId 제거
 *   4. 기존 stub 삭제
 *   5. stub 을 가리키던 edges 의 from/to id 를 새 id 로 rewrite.
 *      특히 (from=pendingFromId, to=oldStubId, type='related_to') edge 는
 *      pendingType (원본 type) 으로 복원.
 *   6. approvalEvents 에 promote 이벤트 기록.
 */
export async function promoteStubNodeCore({ nodeId, newKind, accountId, requestedBy }) {
  const allowedKinds = ['project', 'domain', 'capability', 'element', 'document'];
  if (!allowedKinds.includes(newKind)) {
    throw new HttpsError('invalid-argument', `newKind 는 ${allowedKinds.join('/')} 중 하나여야 합니다.`);
  }
  const scopedAccountId = normalizeAccountId(accountId);
  const oldRef = db().collection(COLLECTIONS.approvedNodes).doc(nodeId);
  const oldSnap = await oldRef.get();
  if (!oldSnap.exists) {
    throw new HttpsError('not-found', `node ${nodeId} 가 없습니다.`);
  }
  const oldData = oldSnap.data();
  if (!oldData.isStub) {
    throw new HttpsError('failed-precondition', `node ${nodeId} 는 stub 이 아닙니다.`);
  }

  // canonical 변환 — "unknown:iam" → "<newKind>:iam"
  const idPart = nodeId.startsWith('unknown:') ? nodeId.slice('unknown:'.length) : nodeId;
  const newId = `${newKind}:${idPart}`;
  if (newId === nodeId) {
    throw new HttpsError('failed-precondition', 'newKind 가 stub 와 같음');
  }
  const newRef = db().collection(COLLECTIONS.approvedNodes).doc(newId);
  const existingNew = await newRef.get();
  if (existingNew.exists) {
    throw new HttpsError(
      'already-exists',
      `${newId} 가 이미 존재 — 같은 id 의 다른 kind 노드와 충돌. 검수 필요.`,
    );
  }

  const pendingType = normalizeString(oldData.pendingType) || null;
  const pendingFromId = normalizeString(oldData.pendingFromId) || null;
  const approvedAt = FieldValue.serverTimestamp();
  const approvalEventRef = db().collection(COLLECTIONS.approvalEvents).doc();

  // 영향받는 edges 모음 — from 또는 to 가 oldId.
  const [edgesByFrom, edgesByTo] = await Promise.all([
    db().collection(COLLECTIONS.approvedEdges).where('from', '==', nodeId).get(),
    db().collection(COLLECTIONS.approvedEdges).where('to', '==', nodeId).get(),
  ]);
  const edgeUpdates = new Map(); // doc id → patch
  for (const snap of [...edgesByFrom.docs, ...edgesByTo.docs]) {
    const data = snap.data();
    const isFromOld = data.from === nodeId;
    const isToOld = data.to === nodeId;
    const patch = {};
    if (isFromOld) patch.from = newId;
    if (isToOld) patch.to = newId;
    // 원본 frontmatter edge 복원: from === pendingFromId, to === oldId, type === 'related_to'
    if (
      pendingFromId
      && pendingType
      && data.from === pendingFromId
      && isToOld
      && data.type === 'related_to'
    ) {
      patch.type = pendingType;
    }
    edgeUpdates.set(snap.ref, patch);
  }

  // 새 edge canonical id 도 type 변경 시 업데이트 — 기존 id 가 'related_to:from->oldId'
  // 형태라 type/to 변경 후 충돌하지 않게 그냥 새 id 로 옮긴다.
  // 실용성 목적상 edge id 자체는 안 건드림 (legacy). 검수자가 별도로 정리.

  const batch = db().batch();
  batch.set(newRef, {
    ...(scopedAccountId ? { accountId: scopedAccountId } : {}),
    id: newId,
    title: oldData.title,
    kind: newKind,
    projectIds: Array.isArray(oldData.projectIds) ? oldData.projectIds : [],
    summary: oldData.summary || '',
    evidenceIds: Array.isArray(oldData.evidenceIds) ? oldData.evidenceIds : [],
    currentRevisionId: approvalEventRef.id,
    lastApprovedAt: approvedAt,
    lastApprovedBy: requestedBy,
    promotedFromStub: nodeId,
  });
  batch.delete(oldRef);
  for (const [ref, patch] of edgeUpdates) {
    batch.update(ref, {
      ...patch,
      lastApprovedAt: approvedAt,
      lastApprovedBy: requestedBy,
      currentRevisionId: approvalEventRef.id,
    });
  }
  batch.set(approvalEventRef, {
    ...(scopedAccountId ? { accountId: scopedAccountId } : {}),
    type: 'promote_stub',
    fromNodeId: nodeId,
    toNodeId: newId,
    pendingTypeRestored: pendingType,
    edgesAffected: edgeUpdates.size,
    createdAt: approvedAt,
    createdBy: requestedBy,
  });
  await batch.commit();

  logger.info('promoteStubNode', {
    fromNodeId: nodeId,
    toNodeId: newId,
    edgesAffected: edgeUpdates.size,
  });

  return { fromNodeId: nodeId, toNodeId: newId, edgesAffected: edgeUpdates.size };
}

/**
 * dismissStubNode — stub 을 잘못된 reference 로 판단해 폐기 (soft-delete).
 *
 * 추적성 유지를 위해 hard delete 대신 `deletedAt`/`deletedBy`/`deletedReason`
 * 필드를 박는다. 잘못 dismiss 한 경우 진안이 Firestore 콘솔에서 필드를
 * 비우면 복구 가능. stub 의 원래 title/evidenceIds/pendingType 도 보존.
 *
 * UI 측 (`subscribeStubNodes`, `OntologyTree*`) 은 `deletedAt != null` 인
 * 노드를 자동 필터해 노출 안 함.
 */
export async function dismissStubNodeCore({ nodeId, accountId, requestedBy, reason }) {
  const scopedAccountId = normalizeAccountId(accountId);
  const ref = db().collection(COLLECTIONS.approvedNodes).doc(nodeId);
  const snap = await ref.get();
  if (!snap.exists) {
    throw new HttpsError('not-found', `node ${nodeId} 가 없습니다.`);
  }
  const data = snap.data();
  if (!data.isStub) {
    throw new HttpsError('failed-precondition', `node ${nodeId} 는 stub 이 아닙니다.`);
  }
  if (data.deletedAt) {
    throw new HttpsError('failed-precondition', `node ${nodeId} 는 이미 폐기됐습니다.`);
  }

  const [edgesByFrom, edgesByTo] = await Promise.all([
    db().collection(COLLECTIONS.approvedEdges).where('from', '==', nodeId).get(),
    db().collection(COLLECTIONS.approvedEdges).where('to', '==', nodeId).get(),
  ]);
  const allEdgeRefs = new Set();
  for (const s of [...edgesByFrom.docs, ...edgesByTo.docs]) allEdgeRefs.add(s.ref);

  const approvalEventRef = db().collection(COLLECTIONS.approvalEvents).doc();
  const deletedAt = FieldValue.serverTimestamp();
  const trimmedReason = normalizeString(reason);

  const batch = db().batch();
  // soft-delete: 노드 자체는 두고 deletedAt 등을 박는다.
  batch.update(ref, {
    deletedAt,
    deletedBy: requestedBy,
    ...(trimmedReason ? { deletedReason: trimmedReason } : {}),
    updatedAt: deletedAt,
  });
  // edges 도 동일 패턴 — hard delete 대신 deletedAt 박음. publish projection /
  // subscribeKnowledgeApprovedEdges 가 deletedAt 필터.
  for (const eref of allEdgeRefs) {
    batch.update(eref, {
      deletedAt,
      deletedBy: requestedBy,
      ...(trimmedReason ? { deletedReason: trimmedReason } : {}),
      updatedAt: deletedAt,
    });
  }
  batch.set(approvalEventRef, {
    ...(scopedAccountId ? { accountId: scopedAccountId } : {}),
    type: 'dismiss_stub',
    nodeId,
    edgesDeleted: allEdgeRefs.size,
    ...(trimmedReason ? { reason: trimmedReason } : {}),
    createdAt: deletedAt,
    createdBy: requestedBy,
  });
  await batch.commit();

  logger.info('dismissStubNode (soft)', { nodeId, edgesDeleted: allEdgeRefs.size });
  return { nodeId, edgesDeleted: allEdgeRefs.size };
}

export const promoteStubNode = onCall(async (request) => {
  ensureApp();
  const email = normalizeString(request.auth?.token?.email);
  if (!email) throw new HttpsError('unauthenticated', '로그인이 필요합니다.');
  const adminSnap = await db().collection(COLLECTIONS.admins).doc(email).get();
  if (!adminSnap.exists) {
    throw new HttpsError('permission-denied', '화이트리스트 관리자만 실행할 수 있습니다.');
  }
  const nodeId = normalizeString(request.data?.nodeId);
  const newKind = normalizeString(request.data?.newKind);
  const accountId = normalizeAccountId(request.data?.accountId);
  if (!nodeId || !newKind) {
    throw new HttpsError('invalid-argument', 'nodeId 와 newKind 가 필요합니다.');
  }
  return promoteStubNodeCore({ nodeId, newKind, accountId, requestedBy: email });
});

export const dismissStubNode = onCall(async (request) => {
  ensureApp();
  const email = normalizeString(request.auth?.token?.email);
  if (!email) throw new HttpsError('unauthenticated', '로그인이 필요합니다.');
  const adminSnap = await db().collection(COLLECTIONS.admins).doc(email).get();
  if (!adminSnap.exists) {
    throw new HttpsError('permission-denied', '화이트리스트 관리자만 실행할 수 있습니다.');
  }
  const nodeId = normalizeString(request.data?.nodeId);
  const accountId = normalizeAccountId(request.data?.accountId);
  if (!nodeId) throw new HttpsError('invalid-argument', 'nodeId 가 필요합니다.');
  return dismissStubNodeCore({
    nodeId,
    accountId,
    requestedBy: email,
    reason: request.data?.reason,
  });
});

export const publishKnowledgeProjection = onCall(async (request) => {
  ensureApp();

  const email = normalizeString(request.auth?.token?.email);
  if (!email) {
    throw new HttpsError("unauthenticated", "로그인이 필요합니다.");
  }

  const adminSnapshot = await db().collection(COLLECTIONS.admins).doc(email).get();
  if (!adminSnapshot.exists) {
    throw new HttpsError("permission-denied", "화이트리스트 관리자만 실행할 수 있습니다.");
  }

  const accountId = normalizeAccountId(request.data?.accountId);
  return publishKnowledgeProjectionCore({
    accountId,
    initiatedBy: email,
  });
});

