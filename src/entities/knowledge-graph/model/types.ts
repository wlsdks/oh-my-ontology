/**
 * Canonical edge type union — `knowledgeApprovedEdges.type` / `knowledgePublicEdges.type`
 * 의 합법 값. ontology TBox (`ontologyRelations` 컬렉션) 의 7 종 시드와 일치.
 *
 * 카테고리 (참고용):
 *   structure: `contains`, `belongs_to` (트리 구조)
 *   behavior:  `depends_on`, `implements`, `uses` (동작)
 *   evidence:  `describes` (document → 개념)
 *   weak:      `related_to` (약 연관)
 *
 * 추출 candidates 는 `string` 으로 들어올 수 있고 (LLM 이 잘못된 타입을 낼 가능성),
 * `KnowledgeGraphEdge.type` 자체는 backwards-compat 으로 `string` 을 유지.
 * 타입드 writer / typed reader 가 필요한 경우 이 union 을 사용한다.
 */
export type KnowledgeEdgeType =
  | 'contains'
  | 'belongs_to'
  | 'depends_on'
  | 'implements'
  | 'uses'
  | 'describes'
  | 'related_to';

/** Runtime 검증·iteration 용 — 위 union 과 1:1 일치. */
export const KNOWLEDGE_EDGE_TYPES: readonly KnowledgeEdgeType[] = [
  'contains',
  'belongs_to',
  'depends_on',
  'implements',
  'uses',
  'describes',
  'related_to',
] as const;

/** Type guard — 임의 string 이 합법 edge type 인지 확인. */
export function isKnowledgeEdgeType(value: unknown): value is KnowledgeEdgeType {
  return typeof value === 'string'
    && (KNOWLEDGE_EDGE_TYPES as readonly string[]).includes(value);
}

/**
 * 노드/엣지의 출처. v0 백본은 모두 추출-검수-승인 거친 결과 (`extraction`).
 * Manual editor v0 (B 라인) 부터 사용자가 직접 만든 `manual` 값이 추가된다.
 * 옵션 필드 — legacy 데이터는 `undefined`, UI 가 `extraction` 기본값으로 처리.
 */
export type KnowledgeGraphSource = 'manual' | 'extraction';

export const KNOWLEDGE_GRAPH_SOURCES: readonly KnowledgeGraphSource[] = [
  'manual',
  'extraction',
] as const;

export function isKnowledgeGraphSource(value: unknown): value is KnowledgeGraphSource {
  return typeof value === 'string'
    && (KNOWLEDGE_GRAPH_SOURCES as readonly string[]).includes(value);
}

export interface KnowledgeGraphNode {
  id: string;
  accountId?: string;
  title: string;
  kind: string;
  projectIds: string[];
  parentId?: string;
  summary?: string;
  evidenceIds: string[];
  evidenceCount?: number;
  currentRevisionId?: string;
  lastApprovedAt: Date;
  lastApprovedBy: string;
  publishId?: string;
  projectionVersion?: string;
  publishedAt?: Date;
  /** Manual editor v0 — `manual` 이면 사용자 직접 작성, `extraction` 이면 추출
   *  워커 산물. legacy 데이터는 `undefined` (UI 가 extraction 으로 간주). */
  source?: KnowledgeGraphSource;
  /** `source === 'manual'` 시 작성자 uid. Firestore rules 가 author 본인만
   *  update/delete 허용. */
  manualAuthor?: string;
  /** `source === 'manual'` 시 사용자가 남긴 자유 메모 (옵션). */
  manualNote?: string;
  /** P1 Phase 1 — 이 노드 생성/검수 시점의 활성 TBox version ID. fact 와
   *  schema 가 시간상 일치 추적용. legacy 데이터는 `undefined` 또는
   *  `'legacy-v0'`. spec: 2026-04-28-ontology-tbox-evolution.md */
  tboxVersionId?: string;
}

export interface KnowledgeGraphEdge {
  id: string;
  accountId?: string;
  from: string;
  to: string;
  type: string;
  label?: string;
  projectIds: string[];
  evidenceIds: string[];
  /** publishKnowledgeProjection 이 evidenceIds.length 로 derived 한 값. 클라이언트
   *  가 edge 두께 가중에 쓴다. approved/public 양쪽에서 사용 가능. */
  evidenceCount?: number;
  currentRevisionId?: string;
  lastApprovedAt: Date;
  lastApprovedBy: string;
  publishId?: string;
  projectionVersion?: string;
  publishedAt?: Date;
  /** Manual editor v0 — node 와 동일 의미. */
  source?: KnowledgeGraphSource;
  manualAuthor?: string;
  manualNote?: string;
  /** P1 Phase 1 — node 와 동일 의미. */
  tboxVersionId?: string;
}

export interface KnowledgePublicMeta {
  id: string;
  currentPublishId: string;
  projectionVersion: string;
  publishedAt: Date;
}

export interface KnowledgeProjectInsight {
  nodes: KnowledgeGraphNode[];
  edges: KnowledgeGraphEdge[];
  meta: KnowledgePublicMeta | null;
}

export interface PublishKnowledgeProjectionInput {
  accountId?: string | null;
}

export interface PublishKnowledgeProjectionResult {
  publishId: string;
  nodeCount: number;
  edgeCount: number;
  projectionVersion: string;
}
