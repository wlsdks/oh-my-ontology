'use client';

import type { KnowledgeGraphSource } from "../model";

export interface ManualSourceChipProps {
  source: KnowledgeGraphSource | undefined;
  /** 컴팩트 모드 — 작은 surface (트리 행, 검색 결과) 에서 텍스트 짧게. */
  size?: "default" | "compact";
}

/**
 * R10b 이후 모든 노드/엣지의 source 가 'manual' 한 값만 가능 (cloud LLM
 * 추출 워커 영구 제거됨) — chip 의 정보 가치 0 (모두 같은 값이라 시각
 * noise). 사용처는 유지하되 컴포넌트 자체는 항상 null return.
 *
 * 향후 cloud collab 단계에서 다른 source 가 추가되면 그때 chip 부활 예정.
 */
export function ManualSourceChip(_props: ManualSourceChipProps) {
  return null;
}
