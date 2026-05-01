import {
  collection,
  writeBatch,
  doc,
  getDoc,
  getDocs,
  setDoc,
  deleteDoc,
  onSnapshot,
  serverTimestamp,
  type Unsubscribe,
} from "firebase/firestore";
import { getDb } from "@/shared/api";
import { normalizeAccountId } from "@/shared/lib/account-scope";
import {
  findBulkDeleteBlockingReferences,
  findProjectsReferencingSlug,
  fromFirestore,
  toFirestore,
  type Project,
  type ProjectInput,
} from "@/entities/project/model";

const COLLECTION = "projects";

function projectsCollection() {
  return collection(getDb(), COLLECTION);
}

function projectDoc(slug: string) {
  return doc(getDb(), COLLECTION, slug);
}

/**
 * 모든 프로젝트 단건 조회 (1회성).
 */
export async function listProjects(_accountId?: string | null): Promise<Project[]> {
  const snapshot = await getDocs(projectsCollection());
  return snapshot.docs.map((d) => fromFirestore(d.id, d.data()));
}

/**
 * 단일 프로젝트 조회.
 */
export async function getProject(
  slug: string,
  _accountId?: string | null,
): Promise<Project | null> {
  const snapshot = await getDoc(projectDoc(slug));
  if (!snapshot.exists()) return null;
  return fromFirestore(snapshot.id, snapshot.data());
}

/**
 * 프로젝트 생성 또는 전체 덮어쓰기 (upsert).
 * - 최초 생성 시 createdAt을 serverTimestamp로 설정
 * - 매 호출마다 updatedAt을 serverTimestamp로 갱신
 */
export async function upsertProject(input: ProjectInput): Promise<void> {
  const full = normalizeInput(input);
  const payload = toFirestore(full);

  const ref = projectDoc(input.slug);
  const existing = await getDoc(ref);

  await setDoc(ref, {
    ...payload,
    updatedAt: serverTimestamp(),
    ...(existing.exists() ? {} : { createdAt: serverTimestamp() }),
  });
}

export async function upsertProjectPositions(
  positions: Array<{ slug: string; position: { x: number; y: number } }>,
  _accountId?: string | null,
): Promise<void> {
  if (positions.length === 0) return;

  const batch = writeBatch(getDb());
  for (const { slug, position } of positions) {
    batch.update(projectDoc(slug), {
      position,
      updatedAt: serverTimestamp(),
    });
  }
  await batch.commit();
}

/**
 * 프로젝트 삭제.
 */
export async function deleteProject(
  slug: string,
  accountId?: string | null,
): Promise<void> {
  const projects = await listProjects(accountId);
  const referencedBy = findProjectsReferencingSlug(projects, slug);
  if (referencedBy.length > 0) {
    const names = referencedBy.map((project) => project.name).join(", ");
    throw new Error(
      `다른 프로젝트가 이 프로젝트를 의존 중입니다: ${names}`,
    );
  }

  await deleteDoc(projectDoc(slug));
}

export async function deleteProjects(
  slugs: string[],
  accountId?: string | null,
): Promise<void> {
  const targetSlugs = [...new Set(slugs.map((slug) => slug.trim()).filter(Boolean))];
  if (targetSlugs.length === 0) return;

  const projects = await listProjects(accountId);
  const blockingReferences = findBulkDeleteBlockingReferences(
    projects,
    targetSlugs,
  );
  if (blockingReferences.length > 0) {
    const detail = blockingReferences
      .map(
        ({ targetSlug, referencedBy }) =>
          `${targetSlug} ← ${referencedBy.map((project) => project.name).join(", ")}`,
      )
      .join(" · ");
    throw new Error(`다른 프로젝트가 선택한 프로젝트를 의존 중입니다: ${detail}`);
  }

  const batch = writeBatch(getDb());
  for (const slug of targetSlugs) {
    batch.delete(projectDoc(slug));
  }
  await batch.commit();
}

/**
 * 전체 프로젝트 실시간 구독.
 * 콜백은 변경이 있을 때마다 최신 목록으로 호출된다.
 * 반환된 함수를 호출해 구독 해제.
 */
export function subscribeProjects(
  callback: (projects: Project[]) => void,
  onError?: (error: Error) => void,
): Unsubscribe;
export function subscribeProjects(
  accountId: string | null | undefined,
  callback: (projects: Project[]) => void,
  onError?: (error: Error) => void,
): Unsubscribe;
export function subscribeProjects(
  accountIdOrCallback:
    | string
    | null
    | undefined
    | ((projects: Project[]) => void),
  callbackOrOnError?: ((projects: Project[]) => void) | ((error: Error) => void),
  maybeOnError?: (error: Error) => void,
): Unsubscribe {
  // accountId 는 v0.x 단일 사용자 모델에서 항상 null. legacy 시그니처만 보존.
  void (typeof accountIdOrCallback === "function"
    ? null
    : normalizeAccountId(accountIdOrCallback));
  const callback =
    typeof accountIdOrCallback === "function"
      ? accountIdOrCallback
      : (callbackOrOnError as (projects: Project[]) => void);
  const onError =
    typeof accountIdOrCallback === "function"
      ? (callbackOrOnError as ((error: Error) => void) | undefined)
      : maybeOnError;

  if (typeof callback !== "function") {
    throw new Error("subscribeProjects requires a callback.");
  }

  // 부하 테스트 hook — window.__synthProjects가 지정되면 그걸 바로 돌려준다.
  // Firestore에 접근하지 않으므로 Playwright로 대량 합성 데이터(1000~3000)의
  // Sigma 토폴로지 성능을 측정할 때만 사용한다. 플래그가 없으면 no-op이라
  // 프로덕션 동작에 영향 없음.
  if (typeof window !== "undefined") {
    const override = (window as unknown as { __synthProjects?: Project[] })
      .__synthProjects;
    if (override) {
      Promise.resolve().then(() => callback(override));
      return () => {};
    }
  }

  return onSnapshot(
    projectsCollection(),
    (snapshot) => {
      const projects = snapshot.docs.map((d) => fromFirestore(d.id, d.data()));
      callback(projects);
    },
    (error) => {
      if (onError) onError(error);
      else console.error("[subscribeProjects]", error);
    },
  );
}

/**
 * ProjectInput에 기본값을 채워 Project의 쓰기용 형태로 정규화.
 */
function normalizeInput(
  input: ProjectInput,
): Omit<Project, "slug" | "createdAt" | "updatedAt"> {
  return {
    accountId: normalizeAccountId(input.accountId) ?? undefined,
    name: input.name,
    nameEn: input.nameEn,
    category: input.category,
    status: input.status,
    description: input.description,
    detail: input.detail,
    tags: input.tags ?? [],
    stack: input.stack ?? [],
    links: input.links ?? [],
    dependencies: input.dependencies ?? [],
    owner: input.owner,
    icon: input.icon,
    screenshots: input.screenshots ?? [],
    timeline: input.timeline ?? {},
    progress: input.progress,
    isHub: input.isHub ?? false,
    hubSlugs: input.hubSlugs,
    position: input.position,
  };
}

