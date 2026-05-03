'use client';

import { createContext, useContext, useMemo, type ReactNode } from 'react';
import { DEFAULT_CATEGORIES, type Category } from '@/entities/category';
import { DEFAULT_STATUSES, type Status } from '@/entities/status';

export interface TaxonomyContextValue {
  categories: Category[];
  statuses: Status[];
  getCategory: (id: string) => Category | undefined;
  getStatus: (id: string) => Status | undefined;
  categoryLabel: (id: string) => string;
  statusLabel: (id: string) => string;
}

const TaxonomyContext = createContext<TaxonomyContextValue | null>(null);

interface Props {
  children: ReactNode;
}

/**
 * defaults 만 노출하는 정적 provider — taxonomy (categories / statuses) 는
 * 빌드타임 defaults 만으로 충분. vault 기반 사용자 정의 분류 (예:
 * `categories.md` frontmatter) 는 추후 단계.
 */
export function TaxonomyProvider({ children }: Props) {
  const value = useMemo<TaxonomyContextValue>(() => {
    const categoryMap = new Map(DEFAULT_CATEGORIES.map((c) => [c.id, c]));
    const statusMap = new Map(DEFAULT_STATUSES.map((s) => [s.id, s]));
    return {
      categories: DEFAULT_CATEGORIES,
      statuses: DEFAULT_STATUSES,
      getCategory: (id) => categoryMap.get(id),
      getStatus: (id) => statusMap.get(id),
      categoryLabel: (id) => categoryMap.get(id)?.label ?? id,
      statusLabel: (id) => statusMap.get(id)?.label ?? id,
    };
  }, []);

  return <TaxonomyContext.Provider value={value}>{children}</TaxonomyContext.Provider>;
}

export function useTaxonomy(): TaxonomyContextValue {
  const ctx = useContext(TaxonomyContext);
  if (!ctx) {
    throw new Error('useTaxonomy must be used inside <TaxonomyProvider>');
  }
  return ctx;
}
