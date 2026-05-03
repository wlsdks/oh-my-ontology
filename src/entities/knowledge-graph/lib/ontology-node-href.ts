/**
 * Ontology view 의 노드 deeplink 빌더 — `/ontology/?node=<encoded-id>`.
 *
 * 호출자: NodeDetailPanel "노드 링크 복사" / OntologyInsightsPage 의 카드
 * 링크 / GlobalSearch 결과 / ProjectDrawer 의 'open in ontology' / docs
 * viewer 의 kind chip 등 7+ surface. 한 곳에서 정의해 형식이 흩어지지
 * 않게 한다 — `?node=` query key 와 encodeURIComponent 가짜의 일관성을
 * OntologyViewPage 의 deeplinkNodeId 파서와 깨지지 않게 보장.
 */
export function buildOntologyNodeHref(nodeId: string): string {
  return `/ontology/?node=${encodeURIComponent(nodeId)}`;
}
