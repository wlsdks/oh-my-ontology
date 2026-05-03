/**
 * 토폴로지 surface 의 deep-link 빌더 — `?p=<slug>` 가 HomePage 의
 * `useHomeRouteState` 훅이 읽는 query key 와 짝.
 *
 * 주의: HomePage 는 `/topology/` 에만 마운트된다 (R3 dual-surface 결정으로
 * `/` 는 OntologyViewPage 로 분리됨). 따라서 helper 도 `/topology/` 로 직접
 * 보낸다. 이전에 `/?p=` 를 반환하던 버전은 R3 마이그레이션 이후 누락된
 * 회귀로, "토폴로지에서 보기" CTA 가 ontology view 로 빠지는 문제가 있었다.
 */
export function getTopologyProjectHref(slug: string): string {
  return `/topology/?p=${encodeURIComponent(slug)}`;
}
