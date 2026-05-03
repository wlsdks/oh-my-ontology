/**
 * OperationsNav 탭의 active 상태를 결정하는 pure helper.
 *
 * 정책:
 * - 빈 prefix `'/'` 는 *exact-match* (`pathname === '/'`) — 그렇지 않으면
 *   모든 path 가 매칭되는 사고 방지.
 * - 그 외 prefix 는 `pathname.startsWith(prefix)` — sub-path 까지 활성.
 *
 * 사용 사례 (cycle 1, R3 dual-surface 회귀 정정):
 * - 'ontology' 탭: prefixes = ['/', '/ontology'] — `/` 와 `/ontology/*`
 *   양쪽에서 active (RootEntry → OntologyView 와 /ontology 가 같은 surface).
 * - 'topology' 탭: prefixes = ['/topology'] — `/topology/*` 에서만 active.
 */
export function isOperationsTabActive(
  pathname: string,
  prefixes: ReadonlyArray<string>,
): boolean {
  return prefixes.some((p) =>
    p === '/' ? pathname === '/' : pathname.startsWith(p),
  );
}
