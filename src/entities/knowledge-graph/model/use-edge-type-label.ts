'use client';

import { useTranslations } from 'next-intl';
import { KNOWLEDGE_EDGE_TYPES, type KnowledgeEdgeType } from './types';

function isKnown(type: string): type is KnowledgeEdgeType {
  return (KNOWLEDGE_EDGE_TYPES as ReadonlyArray<string>).includes(type);
}

/**
 * Locale-aware edge type label resolver.
 *
 * Maps a canonical KnowledgeEdgeType (`contains` / `belongs_to` /
 * `depends_on` / `implements` / `uses` / `describes` / `related_to`) to its
 * localized display label. Unknown types fall through to the raw string so
 * we never render an empty chip.
 *
 * Use this hook from any client component that renders an edge type label —
 * insights / relations panels, ego graph chips. Keeps the i18n source single
 * (`edgeTypes.*` namespace), avoiding the previous duplication where each
 * page had its own switch + per-namespace `edgeType*` keys.
 */
export function useEdgeTypeLabel() {
  const t = useTranslations('edgeTypes');
  return (type: string): string => {
    if (isKnown(type)) return t(type);
    return type;
  };
}
