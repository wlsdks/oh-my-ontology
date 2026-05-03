'use client';

import { useMemo } from 'react';
import { useDataSourceMode } from '@/features/data-source-mode';
import { useLocalVault } from '@/features/docs-vault-local';
import {
  deriveProjectsFromVault,
  vaultManifest as staticVaultManifestRaw,
  type VaultManifest,
} from '@/entities/docs-vault';

// JSON import 가 mode 같은 union 필드를 string 으로 추론. 빌드 시점에 schema
// 가 안정적이라 runtime 검증 대신 cast.
const staticVaultManifest = staticVaultManifestRaw as VaultManifest;
import type { Project } from '@/entities/project';

/**
 * mode-aware read 어댑터. 2 모드:
 *
 * - **local**: vault manifest 의 `projects/*.md` frontmatter 를 동기 매핑.
 *   사용자가 vault 에 .md 추가하면 즉시 list 에 반영.
 * - **static**: 빌드 타임 `docs/ontology/` 매니페스트 (dogfood). vault 미선택
 *   사용자도 이 OSS 자체의 ontology 를 즉시 본다 — "0 마찰 진입" 의 read 구현.
 */
export interface UseProjectsState {
  projects: Project[];
  loaded: boolean;
  error: string | null;
  mode: 'static' | 'local';
}

export function useProjects(): UseProjectsState {
  const mode = useDataSourceMode();
  const vault = useLocalVault();

  const localProjects = useMemo(() => {
    if (mode !== 'local' || !vault.manifest) return [];
    return deriveProjectsFromVault(vault.manifest);
  }, [mode, vault.manifest]);

  const staticProjects = useMemo(() => {
    if (mode !== 'static') return [];
    return deriveProjectsFromVault(staticVaultManifest);
  }, [mode]);

  if (mode === 'local') {
    return {
      projects: localProjects,
      loaded: vault.status === 'loaded',
      error: null,
      mode,
    };
  }
  return {
    projects: staticProjects,
    loaded: true,
    error: null,
    mode,
  };
}
