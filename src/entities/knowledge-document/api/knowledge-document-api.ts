import {
  collection,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  where,
  writeBatch,
  type Unsubscribe,
} from "firebase/firestore";
import { getDb } from "@/shared/api";
import { hasDemoSession } from '@/shared/lib/demo-session';
import {
  DEMO_ACCOUNT_ID,
  getAllDemoKnowledgeDocuments,
  getDemoKnowledgeDocumentsByProject,
} from "@/shared/mocks/demo-data";
import { normalizeAccountId } from "@/shared/lib/account-scope";
import { slugify } from "@/shared/lib/slugify";
import {
  buildKnowledgeDocumentStoragePath,
  deleteKnowledgeMarkdown,
  uploadKnowledgeMarkdown,
} from "@/entities/knowledge-document/api/storage";
import {
  fromFirestoreKnowledgeDocument,
  parseKnowledgeFrontmatter,
  resolveKnowledgeCanonicalMetadata,
  resolveKnowledgeFormatScore,
  toFirestoreKnowledgeDocument,
  type KnowledgeDocument,
  type KnowledgeDocumentCreateInput,
} from "@/entities/knowledge-document/model";
import {
  createKnowledgeVersionRecord,
  fromFirestoreKnowledgeVersion,
  toFirestoreKnowledgeVersion,
  type KnowledgeVersion,
} from "@/entities/knowledge-version";

const DOCUMENTS_COLLECTION = "knowledgeDocuments";
const VERSIONS_COLLECTION = "knowledgeDocumentVersions";

function knowledgeDocumentsCollection() {
  return collection(getDb(), DOCUMENTS_COLLECTION);
}

function knowledgeDocumentVersionsCollection() {
  return collection(getDb(), VERSIONS_COLLECTION);
}

function knowledgeDocumentDoc(documentId: string) {
  return doc(getDb(), DOCUMENTS_COLLECTION, documentId);
}

function knowledgeDocumentVersionDoc(versionId: string) {
  return doc(getDb(), VERSIONS_COLLECTION, versionId);
}

function buildKnowledgeDocumentId(title: string) {
  return `${slugify(title || "document")}-${Date.now().toString(36)}`;
}

function buildKnowledgeVersionId(documentId: string) {
  return `${documentId}-v${Date.now().toString(36)}`;
}

export async function listKnowledgeDocuments(
  accountId?: string | null,
): Promise<KnowledgeDocument[]> {
  if (hasDemoSession()) {
    const normalized = normalizeAccountId(accountId);
    // 데모 워크스페이스 한정 — 다른 accountId 는 빈 목록. admin 화면은 내
    // 공간 scope 이라 정상 동작.
    if (!normalized || normalized === DEMO_ACCOUNT_ID) {
      return getAllDemoKnowledgeDocuments();
    }
    return [];
  }

  const snapshot = await getDocs(
    query(knowledgeDocumentsCollection(), orderBy("updatedAt", "desc")),
  );

  return snapshot.docs.map((entry) =>
    fromFirestoreKnowledgeDocument(entry.id, entry.data()),
  );
}

export async function getKnowledgeDocument(
  documentId: string,
  accountId?: string | null,
): Promise<KnowledgeDocument | null> {
  const snapshot = await getDoc(knowledgeDocumentDoc(documentId));
  if (!snapshot.exists()) return null;
  return fromFirestoreKnowledgeDocument(snapshot.id, snapshot.data());
}

export function subscribeKnowledgeDocuments(
  callback: (documents: KnowledgeDocument[]) => void,
  onError?: (error: Error) => void,
): Unsubscribe;
export function subscribeKnowledgeDocuments(
  accountId: string | null | undefined,
  callback: (documents: KnowledgeDocument[]) => void,
  onError?: (error: Error) => void,
): Unsubscribe;
export function subscribeKnowledgeDocuments(
  accountIdOrCallback:
    | string
    | null
    | undefined
    | ((documents: KnowledgeDocument[]) => void),
  callbackOrOnError?:
    | ((documents: KnowledgeDocument[]) => void)
    | ((error: Error) => void),
  maybeOnError?: (error: Error) => void,
): Unsubscribe {
  const scopedAccountId =
    typeof accountIdOrCallback === "function"
      ? null
      : normalizeAccountId(accountIdOrCallback);
  const callbackFn =
    typeof accountIdOrCallback === "function"
      ? accountIdOrCallback
      : (callbackOrOnError as (documents: KnowledgeDocument[]) => void);
  const errorFn =
    typeof accountIdOrCallback === "function"
      ? (callbackOrOnError as ((error: Error) => void) | undefined)
      : maybeOnError;

  if (hasDemoSession()) {
    const docs =
      !scopedAccountId || scopedAccountId === DEMO_ACCOUNT_ID
        ? getAllDemoKnowledgeDocuments()
        : [];
    Promise.resolve().then(() => callbackFn(docs));
    return () => {};
  }

  return onSnapshot(
    query(knowledgeDocumentsCollection(), orderBy("updatedAt", "desc")),
    (snapshot) => {
      callbackFn(
        snapshot.docs.map((entry) =>
          fromFirestoreKnowledgeDocument(entry.id, entry.data()),
        ),
      );
    },
    (error) => {
      if (errorFn) errorFn(error);
      else console.error("[subscribeKnowledgeDocuments]", error);
    },
  );
}

/**
 * 특정 프로젝트에 연결된 knowledgeDocuments만 구독. 공개 상세 페이지의 "등록된
 * 문서" 섹션에서 사용. 데모 세션은 seeded demo 문서를 비동기로 1회 emit하고
 * 종료. admin dev bypass는 전체 목록을 가져와 client-side 필터링. 운영에서는
 * `projectIds` array-contains + `updatedAt desc` 복합 인덱스로 쿼리.
 */
export function subscribeKnowledgeDocumentsByProject(
  projectSlug: string,
  accountId: string | null | undefined,
  callback: (documents: KnowledgeDocument[]) => void,
  onError?: (error: Error) => void,
): Unsubscribe {
  if (hasDemoSession()) {
    Promise.resolve().then(() =>
      callback(getDemoKnowledgeDocumentsByProject(projectSlug)),
    );
    return () => {};
  }

  return onSnapshot(
    query(
      knowledgeDocumentsCollection(),
      where("projectIds", "array-contains", projectSlug),
      orderBy("updatedAt", "desc"),
    ),
    (snapshot) => {
      callback(
        snapshot.docs.map((entry) =>
          fromFirestoreKnowledgeDocument(entry.id, entry.data()),
        ),
      );
    },
    (error) => {
      if (onError) onError(error);
      else console.error("[subscribeKnowledgeDocumentsByProject]", error);
    },
  );
}

/**
 * 공개 detail 페이지가 "이 프로젝트를 설명하는 문서" 섹션을 그리기 위한 1-shot
 * fetch. subscribe 가 아닌 이유: detail 페이지는 이미 project 구독이 많아
 * 추가 snapshot listener 를 최소화. 변경은 다음 방문에 반영.
 *
 * 조건:
 *  - status === 'published' 만 공개 (draft/processing/reviewing 은 노출 금지)
 *  - projectIds array-contains slug
 *  - updatedAt desc 정렬
 *
 * Firestore rule 이 account 의 isPublic == true + status == 'published' 일
 * 때만 비인증 read 를 허용하므로 이 쿼리는 게스트 방문자에도 동작.
 */
export async function getPublicDocumentsForProject(
  projectSlug: string,
  accountId: string | null | undefined,
): Promise<KnowledgeDocument[]> {
  const scopedAccountId = normalizeAccountId(accountId);
  if (!scopedAccountId) return [];

  if (hasDemoSession()) {
    return getDemoKnowledgeDocumentsByProject(projectSlug).filter(
      (doc) => doc.status === 'published',
    );
  }

  try {
    const snapshot = await getDocs(
      query(
        knowledgeDocumentsCollection(),
        where('status', '==', 'published'),
        where('projectIds', 'array-contains', projectSlug),
        orderBy('updatedAt', 'desc'),
      ),
    );
    return snapshot.docs.map((entry) =>
      fromFirestoreKnowledgeDocument(entry.id, entry.data()),
    );
  } catch (err) {
    // rule 거부, 인덱스 미구축 등 — 공개 페이지는 문서 섹션이 비어 있게만
    // 다운그레이드. 예외로 터뜨리지 않음.
    console.warn('[getPublicDocumentsForProject]', err);
    return [];
  }
}

export async function createKnowledgeDocumentWithInitialVersion(
  input: KnowledgeDocumentCreateInput,
): Promise<{ documentId: string; versionId: string }> {
  const accountId = normalizeAccountId(input.accountId);
  const documentId = buildKnowledgeDocumentId(input.title);
  const versionId = buildKnowledgeVersionId(documentId);
  const parsed = parseKnowledgeFrontmatter(input.rawMarkdown);
  const canonical = resolveKnowledgeCanonicalMetadata(input, parsed.frontmatter);
  const formatScore = resolveKnowledgeFormatScore(parsed.frontmatter);
  const storagePath = buildKnowledgeDocumentStoragePath(documentId, versionId, accountId);
  const versionRecord = createKnowledgeVersionRecord({
    id: versionId,
    documentId,
    createdBy: input.createdBy,
    markdown: input.rawMarkdown,
    frontmatter: parsed.frontmatter,
    metadata: canonical,
    storagePath,
  });
  const documentPayload = toFirestoreKnowledgeDocument({
    title: canonical.title,
    kind: canonical.kind,
    projectIds: canonical.projectIds,
    sourceType: input.sourceType,
    currentVersionId: versionId,
    formatScore,
    status: "draft",
    createdBy: input.createdBy,
    accountId: accountId ?? undefined,
  });
  const versionPayload = toFirestoreKnowledgeVersion({
    ...versionRecord,
    accountId: accountId ?? undefined,
  });

  await uploadKnowledgeMarkdown(storagePath, input.rawMarkdown);
  try {
    const batch = writeBatch(getDb());
    batch.set(knowledgeDocumentDoc(documentId), {
      ...documentPayload,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    batch.set(knowledgeDocumentVersionDoc(versionId), {
      ...versionPayload,
      createdAt: serverTimestamp(),
    });
    await batch.commit();
  } catch (error) {
    await deleteKnowledgeMarkdown(storagePath);
    throw error;
  }

  return { documentId, versionId };
}

export async function createKnowledgeDocumentVersion(input: {
  accountId?: string | null;
  documentId: string;
  createdBy: string;
  rawMarkdown: string;
}): Promise<{ versionId: string }> {
  const accountId = normalizeAccountId(input.accountId);
  const documentRecord = await getKnowledgeDocument(input.documentId, accountId);
  if (!documentRecord) {
    throw new Error("문서를 찾을 수 없습니다.");
  }

  const versionId = buildKnowledgeVersionId(input.documentId);
  const parsed = parseKnowledgeFrontmatter(input.rawMarkdown);
  const canonical = resolveKnowledgeCanonicalMetadata(
    {
      title: documentRecord.title,
      kind: documentRecord.kind,
      projectIds: documentRecord.projectIds,
    },
    parsed.frontmatter,
  );
  const storagePath = buildKnowledgeDocumentStoragePath(input.documentId, versionId, accountId);
  const versionRecord = createKnowledgeVersionRecord({
    id: versionId,
    documentId: input.documentId,
    createdBy: input.createdBy,
    markdown: input.rawMarkdown,
    frontmatter: parsed.frontmatter,
    metadata: canonical,
    storagePath,
  });
  const versionPayload = toFirestoreKnowledgeVersion({
    ...versionRecord,
    accountId: documentRecord.accountId,
  });

  await uploadKnowledgeMarkdown(storagePath, input.rawMarkdown);
  try {
    const batch = writeBatch(getDb());
    batch.set(knowledgeDocumentVersionDoc(versionId), {
      ...versionPayload,
      createdAt: serverTimestamp(),
    });
    batch.update(knowledgeDocumentDoc(input.documentId), {
      updatedAt: serverTimestamp(),
    });
    await batch.commit();
  } catch (error) {
    await deleteKnowledgeMarkdown(storagePath);
    throw error;
  }

  return { versionId };
}

export async function setKnowledgeDocumentCurrentVersion(input: {
  document: KnowledgeDocument;
  version: KnowledgeVersion;
}) {
  await updateDoc(knowledgeDocumentDoc(input.document.id), {
    title: input.version.title,
    kind: input.version.kind,
    projectIds: input.version.projectIds,
    currentVersionId: input.version.id,
    updatedAt: serverTimestamp(),
  });
}

export async function listKnowledgeVersionsByDocument(
  documentId: string,
  accountId?: string | null,
): Promise<KnowledgeVersion[]> {
  // 데모 세션은 version history 도 없다 (`buildDocuments` 는 문서만 생성).
  // Firestore rules denial 대신 빈 배열로 정적 resolve.
  if (hasDemoSession()) return [];

  const snapshot = await getDocs(
    query(knowledgeDocumentVersionsCollection(), orderBy("createdAt", "desc")),
  );

  return snapshot.docs
    .map((entry) => fromFirestoreKnowledgeVersion(entry.id, entry.data()))
    .filter((entry) => entry.documentId === documentId);
}

export function subscribeKnowledgeVersionsByDocument(
  documentId: string,
  callback: (versions: KnowledgeVersion[]) => void,
  onError?: (error: Error) => void,
): Unsubscribe;
export function subscribeKnowledgeVersionsByDocument(
  accountId: string | null | undefined,
  documentId: string,
  callback: (versions: KnowledgeVersion[]) => void,
  onError?: (error: Error) => void,
): Unsubscribe;
export function subscribeKnowledgeVersionsByDocument(
  accountIdOrDocumentId: string | null | undefined,
  documentIdOrCallback:
    | string
    | ((versions: KnowledgeVersion[]) => void),
  callbackOrOnError?:
    | ((versions: KnowledgeVersion[]) => void)
    | ((error: Error) => void),
  maybeOnError?: (error: Error) => void,
): Unsubscribe {
  const targetDocumentId =
    typeof documentIdOrCallback === "string"
      ? documentIdOrCallback
      : String(accountIdOrDocumentId ?? "");
  const callbackFn =
    typeof documentIdOrCallback === "string"
      ? (callbackOrOnError as (versions: KnowledgeVersion[]) => void)
      : (documentIdOrCallback as (versions: KnowledgeVersion[]) => void);
  const errorFn =
    typeof documentIdOrCallback === "string"
      ? maybeOnError
      : (callbackOrOnError as ((error: Error) => void) | undefined);

  if (hasDemoSession()) {
    Promise.resolve().then(() => callbackFn([]));
    return () => {};
  }

  return onSnapshot(
    query(knowledgeDocumentVersionsCollection(), orderBy("createdAt", "desc")),
    (snapshot) => {
      callbackFn(
        snapshot.docs
          .map((entry) => fromFirestoreKnowledgeVersion(entry.id, entry.data()))
          .filter((entry) => entry.documentId === targetDocumentId),
      );
    },
    (error) => {
      if (errorFn) errorFn(error);
      else console.error("[subscribeKnowledgeVersionsByDocument]", error);
    },
  );
}

