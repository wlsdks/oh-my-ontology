'use client';

import {
  Dispatch,
  SetStateAction,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';
import {
  pushRecentDoc as _pushRecentDoc,
  readPinnedDocs,
  readRecentDocs,
  togglePinnedDoc,
} from '@/widgets/docs-vault';
import type { VaultRecentKey } from '@/widgets/docs-vault';
import { scheduleStateSync } from './persistence';

/**
 * R11 #16 step 5 — DocsVaultPage 의 pinned/recent docs persistence 흐름 추출.
 *
 * 캡슐화:
 * - recentKey useMemo (현재 볼트의 namespace — local 폴더 이름 또는 'server')
 * - recentSlugs / pinnedSlugs state
 * - rehydrate useEffect (recentKey 변경 시 localStorage → state)
 * - togglePin useCallback (pinned toggle 후 자동 persist)
 * - pinnedSet derived (Set 변환 cache)
 *
 * setter 들 (setRecentSlugs / setPinnedSlugs) 도 외부 노출 — view 의 다양한
 * mutation 사이트 (delete / new doc / 등) 가 직접 호출. 완전한 encapsulation
 * 은 후속 step 에서 (mutation 들도 hook method 로 흡수).
 */

interface LocalVaultLike {
  handle: FileSystemDirectoryHandle | null;
}

interface UseDocsVaultPersistenceArgs {
  source: 'server' | 'local';
  localVault: LocalVaultLike;
}

interface UseDocsVaultPersistenceResult {
  recentKey: VaultRecentKey;
  recentSlugs: string[];
  setRecentSlugs: Dispatch<SetStateAction<string[]>>;
  pinnedSlugs: string[];
  setPinnedSlugs: Dispatch<SetStateAction<string[]>>;
  pinnedSet: Set<string>;
  togglePin: (slug: string) => void;
}

export function useDocsVaultPersistence({
  source,
  localVault,
}: UseDocsVaultPersistenceArgs): UseDocsVaultPersistenceResult {
  const recentKey = useMemo<VaultRecentKey>(() => {
    if (source === 'local' && localVault.handle) {
      return `local:${localVault.handle.name}`;
    }
    return 'server';
  }, [source, localVault.handle]);

  const [recentSlugs, setRecentSlugsInternal] = useState<string[]>([]);
  const [pinnedSlugs, setPinnedSlugsInternal] = useState<string[]>([]);

  // ESLint 의 react-hooks/exhaustive-deps 가 destructured setter 의 stability
  // 추적 못 함 — useCallback wrap 으로 ref-stable 명시. setState setter 는
  // 본래 stable 이라 기능 영향 0 (useAdvancedMenu 와 동일 패턴).
  const setRecentSlugs = useCallback<typeof setRecentSlugsInternal>(
    (next) => setRecentSlugsInternal(next),
    [],
  );
  const setPinnedSlugs = useCallback<typeof setPinnedSlugsInternal>(
    (next) => setPinnedSlugsInternal(next),
    [],
  );

  // recentKey 가 바뀔 때마다 해당 볼트의 recent + pinned 목록 로드.
  useEffect(() => {
    scheduleStateSync(() => {
      setRecentSlugsInternal(readRecentDocs(recentKey));
      setPinnedSlugsInternal(readPinnedDocs(recentKey));
    });
  }, [recentKey]);

  const togglePin = useCallback(
    (slug: string) => {
      setPinnedSlugsInternal(togglePinnedDoc(recentKey, slug));
    },
    [recentKey],
  );

  const pinnedSet = useMemo(() => new Set(pinnedSlugs), [pinnedSlugs]);

  return {
    recentKey,
    recentSlugs,
    setRecentSlugs,
    pinnedSlugs,
    setPinnedSlugs,
    pinnedSet,
    togglePin,
  };
}

// pushRecentDoc 은 module-level helper — view 가 직접 호출 가능.
export const pushRecentDoc = _pushRecentDoc;
