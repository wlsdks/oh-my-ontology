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

function normalizeStringArray(value) {
  return Array.isArray(value)
    ? [...new Set(value.map((item) => normalizeString(item)).filter(Boolean))]
    : [];
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

