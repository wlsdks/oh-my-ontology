'use client';

import { createContext, useContext, useMemo, type ReactNode } from 'react';
// firebase 의존이 0 인 imports 만 — barrel (`@/entities/category`) 거치면
// mapper.ts (Timestamp 사용) → firebase/firestore 가 따라온다.
import { DEFAULT_CATEGORIES } from '@/entities/category/model/defaults';
import { hasRegisteredCategoryRegions } from '@/entities/category/model/presence';
import type { Category } from '@/entities/category/model/types';
import { DEFAULT_STATUSES } from '@/entities/status/model/defaults';
import type { Status } from '@/entities/status/model/types';

export interface TaxonomyContextValue {
  categories: Category[];
  statuses: Status[];
  categoriesHydrated: boolean;
  statusesHydrated: boolean;
  showCategoryRegions: boolean;
  getCategory: (id: string) => Category | undefined;
  getStatus: (id: string) => Status | undefined;
  categoryLabel: (id: string) => string;
  statusLabel: (id: string) => string;
}

const defaultCategories: Category[] = DEFAULT_CATEGORIES.map((c) => ({
  ...c,
  createdAt: new Date(0),
  updatedAt: new Date(0),
}));

const defaultStatuses: Status[] = DEFAULT_STATUSES.map((s) => ({
  ...s,
  createdAt: new Date(0),
  updatedAt: new Date(0),
}));

const TaxonomyContext = createContext<TaxonomyContextValue | null>(null);

interface Props {
  children: ReactNode;
}

/**
 * R10b (cloud surface 영구 제거) 이후 — defaults 만 노출하는 정적 provider.
 *
 * 이전엔 cloud 모드에서 Firestore `categories` / `statuses` 컬렉션을 구독해
 * 사용자가 settings 페이지에서 추가한 분류를 실시간 반영했다. 그 surface 가
 * 사라지면서 taxonomy 도 빌드타임 defaults 만으로 충분.
 *
 * vault 기반 사용자 정의 분류 (예: `categories.md` frontmatter) 는 추후 단계.
 */
export function TaxonomyProvider({ children }: Props) {
  const value = useMemo<TaxonomyContextValue>(() => {
    const categoryMap = new Map(defaultCategories.map((c) => [c.id, c]));
    const statusMap = new Map(defaultStatuses.map((s) => [s.id, s]));
    return {
      categories: defaultCategories,
      statuses: defaultStatuses,
      categoriesHydrated: true,
      statusesHydrated: true,
      showCategoryRegions: hasRegisteredCategoryRegions(defaultCategories),
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
