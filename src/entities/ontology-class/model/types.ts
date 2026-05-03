/**
 * Ontology TBox — 노드 클래스 (kind) 정의.
 *
 * 4-layer 모델 (Project → Domain → Capability → Element) + Document 근거
 * 노드 + Unknown stub. vault frontmatter `kind:` 의 합법 값과 1:1 대응.
 */
export interface OntologyClass {
  /** kebab-case ID. 예: 'project' / 'domain' / 'capability' / 'element' / 'document' / 'unknown'. */
  id: string;
  /** display name (한글 OK). `getOntologyKindLabel` 의 진실원. */
  name: string;
  /** 클래스가 무엇을 표현하는지 — 향후 UI 툴팁 / 검수 가이드 용 (현재 미렌더). */
  description?: string;
}
