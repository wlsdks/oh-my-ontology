import type { OntologyTreeNode } from "@/shared/lib/ontology-tree";

/**
 * 트리 root 정렬 우선순위 (UX-12).
 *
 * 운영 토폴로지 진입 시 큰 그림 (project / domain) 부터 시각적으로
 * 떠오르게 — 시드 순서 그대로 두면 위계 의도와 어긋남 (project 19 가
 * element 454 사이에 묻힘).
 *
 * 정책:
 *   project < domain < capability < element < document < 알 수 없음
 * 같은 kind 안에서는 title 가나다 (locale 한국어 친화).
 */
const KIND_ORDER: Record<string, number> = {
  project: 0,
  domain: 1,
  capability: 2,
  element: 3,
  document: 4,
};

const UNKNOWN_RANK = 99;

function rank(kind: string): number {
  return KIND_ORDER[kind] ?? UNKNOWN_RANK;
}

/**
 * OntologyTreeView 헤더에서 선택 가능한 root 정렬 mode.
 *
 * - `kind-title` (기본) — 위계 우선 정책 (project < domain < capability < element).
 * - `title` — kind 무시, 가나다순. 알파벳 직접 lookup 시.
 *
 * R10 이후 vault frontmatter 가 유일한 진실원이라 evidenceCount 가 채워
 * 지지 않는다. 이전에 있던 `evidence-desc` mode 는 모든 노드가 동률
 * (0 또는 1) 이라 사실상 title 정렬과 동일해 사용자에게 misleading 한
 * dead UI 였다 — 제거.
 */
export type OntologyRootSortKey = "kind-title" | "title";

function compareTitleKo(a: OntologyTreeNode, b: OntologyTreeNode): number {
  return a.node.title.localeCompare(b.node.title, "ko");
}

function compareKindThenTitle(
  a: OntologyTreeNode,
  b: OntologyTreeNode,
): number {
  const ra = rank(a.node.kind);
  const rb = rank(b.node.kind);
  if (ra !== rb) return ra - rb;
  return a.node.title.localeCompare(b.node.title, "ko");
}

/**
 * 사용자 선택 정렬 mode 적용. 호출자는 `OntologyRootSortKey` 를 전달.
 * 원본은 변형 안 함 (immutable).
 */
export function sortRoots(
  roots: ReadonlyArray<OntologyTreeNode>,
  key: OntologyRootSortKey = "kind-title",
): OntologyTreeNode[] {
  switch (key) {
    case "title":
      return [...roots].sort(compareTitleKo);
    case "kind-title":
    default:
      return [...roots].sort(compareKindThenTitle);
  }
}

/**
 * roots 를 kind 우선 + title 가나다 순으로 정렬해 새 배열 반환.
 * `sortRoots(roots, 'kind-title')` 의 alias — 기존 호출자 호환용.
 */
export function sortRootsByKindAndTitle(
  roots: ReadonlyArray<OntologyTreeNode>,
): OntologyTreeNode[] {
  return sortRoots(roots, "kind-title");
}
