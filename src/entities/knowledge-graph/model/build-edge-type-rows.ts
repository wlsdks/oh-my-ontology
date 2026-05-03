import { KNOWLEDGE_EDGE_TYPES } from './types';

export interface EdgeTypeRow {
  type: string;
  count: number;
}

const KNOWN_EDGE_TYPE_SET: ReadonlySet<string> = new Set(KNOWLEDGE_EDGE_TYPES);

/**
 * edge type 분포 → bar 행 배열. canonical (KNOWLEDGE_EDGE_TYPES) 순서로
 * 먼저, 외래 type 은 뒤에 입력 순서대로. count 0 행은 제외.
 *
 * /ontology/insights 의 edge type 패널 입력. 별도 surface 가 추가될 때
 * 같은 helper 를 재사용해 단일 진실원 유지.
 */
export function buildEdgeTypeRows(
  typeDist: ReadonlyMap<string, number>,
): EdgeTypeRow[] {
  const rows: EdgeTypeRow[] = [];
  for (const t of KNOWLEDGE_EDGE_TYPES) {
    const count = typeDist.get(t) ?? 0;
    if (count > 0) rows.push({ type: t, count });
  }
  for (const [type, count] of typeDist) {
    if (KNOWN_EDGE_TYPE_SET.has(type)) continue;
    if (count <= 0) continue;
    rows.push({ type, count });
  }
  return rows;
}
