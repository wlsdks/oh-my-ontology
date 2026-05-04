'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  buildTopologyFromVault,
  type FolderTopologyBuild,
  type VaultManifest,
} from '@/entities/docs-vault';
import { scheduleStateSync } from './persistence';

/**
 * R11 #16 step 3 — DocsVaultPage 의 folder-topology build 흐름 추출.
 *
 * 캡슐화 대상:
 * - state 4: folderTopo (build 결과) / folderTopoError / folderTopoStatus
 *   ('idle' | 'rebuilding' | 'fresh') / freshResetTimerRef (cleanup 용)
 * - buildFolderTopology useCallback (50 LOC) — projects/*.md + categories.md
 *   + statuses.md 로드 + parser 호출
 * - cleanup useEffect — unmount 시 freshResetTimer clear
 * - auto-build useEffect — view='folder-topology' 전환 또는 manifest refresh
 *   시 자동 빌드
 *
 * 반환: { folderTopo, folderTopoError, folderTopoStatus, buildFolderTopology }
 *
 * source !== 'local' 또는 vault 에 projects/ 가 0 이면 build 가 no-op (folderTopo
 * = null). caller 가 그 상태로 분기.
 */

type DocsVaultSource = 'server' | 'local';

interface LocalVaultLike {
  fileHandles: Map<string, FileSystemFileHandle>;
}

interface UseFolderTopoArgs {
  source: DocsVaultSource;
  view: 'doc' | 'folder-topology';
  manifest: VaultManifest;
  localVault: LocalVaultLike;
}

export function useFolderTopo({
  source,
  view,
  manifest,
  localVault,
}: UseFolderTopoArgs) {
  const [folderTopo, setFolderTopo] = useState<FolderTopologyBuild | null>(
    null,
  );
  const [folderTopoError, setFolderTopoError] = useState<string | null>(null);
  const [folderTopoStatus, setFolderTopoStatus] = useState<
    'idle' | 'rebuilding' | 'fresh'
  >('idle');
  const freshResetTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const buildFolderTopology = useCallback(async () => {
    if (source !== 'local') return;
    setFolderTopoError(null);
    setFolderTopoStatus('rebuilding');
    try {
      const projectSlugs = manifest.docs
        .filter((d) => d.slug.startsWith('projects/'))
        .map((d) => d.slug);
      if (projectSlugs.length === 0) {
        setFolderTopo(null);
        return;
      }
      const loadRaw = async (slug: string) => {
        const fh = localVault.fileHandles.get(slug);
        if (!fh) throw new Error(`no handle: ${slug}`);
        const file = await fh.getFile();
        return file.text();
      };
      const categoriesFh = localVault.fileHandles.get('categories');
      const statusesFh = localVault.fileHandles.get('statuses');
      const categoriesRaw = categoriesFh
        ? await (await categoriesFh.getFile()).text()
        : undefined;
      const statusesRaw = statusesFh
        ? await (await statusesFh.getFile()).text()
        : undefined;
      const build = await buildTopologyFromVault({
        projectSlugs,
        loadRaw,
        categoriesRaw,
        statusesRaw,
      });
      setFolderTopo(build);
      // 갱신 완료 feedback — 2초간 "fresh" 표시 후 idle 로.
      setFolderTopoStatus('fresh');
      if (freshResetTimerRef.current) clearTimeout(freshResetTimerRef.current);
      freshResetTimerRef.current = setTimeout(
        () => setFolderTopoStatus('idle'),
        2000,
      );
    } catch (err) {
      setFolderTopoError(err instanceof Error ? err.message : String(err));
      setFolderTopo(null);
      setFolderTopoStatus('idle');
    }
  }, [source, manifest, localVault]);

  // unmount 시 freshResetTimer cleanup.
  useEffect(
    () => () => {
      if (freshResetTimerRef.current) clearTimeout(freshResetTimerRef.current);
    },
    [],
  );

  // view='folder-topology' 로 전환되거나 manifest 가 refresh 되면 자동 빌드.
  useEffect(() => {
    if (view !== 'folder-topology') return;
    scheduleStateSync(() => void buildFolderTopology());
  }, [view, buildFolderTopology]);

  return {
    folderTopo,
    folderTopoError,
    folderTopoStatus,
    buildFolderTopology,
  };
}
