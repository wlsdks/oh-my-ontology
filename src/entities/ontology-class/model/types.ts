/**
 * Ontology TBox — 노드 클래스 (kind) 정의.
 *
 * 4-layer 모델 (Project → Domain → Capability → Element) + Document 근거
 * 노드. vault frontmatter \`kind:\` 의 합법 값과 1:1 대응.
 */

/** Element 클래스의 세부 분류 — 더 깊은 트리 대신 elementType 으로 표현. */
export type OntologyElementType =
  | 'service'
  | 'api'
  | 'agent'
  | 'workflow'
  | 'schema'
  | 'data-store'
  | 'ui'
  | 'prompt'
  | 'integration';

export interface OntologyClass {
  /** kebab-case ID. 예: 'project', 'domain', 'capability', 'element', 'document'. */
  id: string;
  /** display name (한글 OK). */
  name: string;
  /** 클래스가 무엇을 표현하는지 — UI 툴팁·검수 가이드. */
  description?: string;
  /**
   * 상위 클래스 ID. 클래스 계층 (예: element < capability) 을 표현.
   * 없으면 root.
   */
  parentClassId?: string;
  /** id === 'element' 인 경우 세부 분류. 다른 클래스에는 사용하지 않음. */
  elementType?: OntologyElementType;
  /** TBox 버전 — schema 변경 추적용. */
  version: number;
  createdAt: Date;
  createdBy: string;
  updatedAt?: Date;
}

/** 생성·수정 입력 — createdAt/updatedAt 은 서버가 관리. */
export type OntologyClassInput = Omit<OntologyClass, 'createdAt' | 'updatedAt'>;
