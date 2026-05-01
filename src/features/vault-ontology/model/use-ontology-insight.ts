'use client';

import { useMemo } from 'react';
import { useDataSourceMode } from '@/features/data-source-mode';
import {
  useKnowledgePublicInsight,
  type KnowledgeGraphNode,
  type KnowledgeGraphEdge,
  type KnowledgeProjectInsight,
} from '@/entities/knowledge-graph';
import { useVaultOntology } from './use-vault-ontology';

const VAULT_SENTINEL_DATE = new Date(0);
const VAULT_SENTINEL_AUTHOR = 'vault-frontmatter';

/**
 * Mode-aware ontology insight 구독.
 *
 * mission v2 — `/` (ontology hub) 가 vault 활성 시 vault frontmatter 의 stub
 * 노드를, 그 외에는 Firestore `knowledgePublic*` projection 을 진실원으로 본다.
 *
 * - `local` → `useVaultOntology` 결과를 `KnowledgeProjectInsight` shape 로 변환
 *   (sourceSlug 는 sentinel 값으로 채움 — 검수 chain 의 시작점은 vault 그 자체).
 * - `cloud` → 기존 `useKnowledgePublicInsight` 그대로.
 * - `static` → 기존 fallback (cloud subscribe 가 빈 결과 반환 → demo 대체는
 *   homepage 가 따로 처리). 본 hook 은 cloud 와 동일 path 로 진행.
 */
export function useOntologyInsight(
  accountId: string | null,
): { insight: KnowledgeProjectInsight | null; error: Error | null } {
  const mode = useDataSourceMode();
  const cloud = useKnowledgePublicInsight(accountId);
  const vault = useVaultOntology();

  return useMemo(() => {
    if (mode !== 'local') return cloud;

    const nodes: KnowledgeGraphNode[] = vault.nodes.map((stub) => ({
      id: stub.id,
      title: stub.title,
      kind: stub.kind,
      projectIds: [],
      evidenceIds: [],
      lastApprovedAt: VAULT_SENTINEL_DATE,
      lastApprovedBy: VAULT_SENTINEL_AUTHOR,
      summary: stub.summary,
      source: 'manual',
    }));

    const edges: KnowledgeGraphEdge[] = vault.edges.map((stub) => ({
      id: stub.id,
      from: stub.from,
      to: stub.to,
      type: stub.type,
      projectIds: [],
      evidenceIds: [],
      lastApprovedAt: VAULT_SENTINEL_DATE,
      lastApprovedBy: VAULT_SENTINEL_AUTHOR,
      source: 'manual',
    }));

    return {
      insight: { nodes, edges, meta: null },
      error: null,
    };
  }, [mode, cloud, vault]);
}
