'use client';

import { useEffect, useMemo } from 'react';
import { useLocalVault } from '@/features/docs-vault-local';
import {
  getDataSourceMode,
  publishDataSourceModeForDebug,
  type DataSourceMode,
} from '@/shared/lib/data-source-mode';

/**
 * 현재 운영 모드 (`'static' | 'local'`) 를 React 상태로 노출.
 *
 * R10b (cloud surface 영구 제거) 후 모드는 두 가지: 'local' (vault 선택됨,
 * 사용자 디스크가 진실원) 또는 'static' (vault 미선택, 빌드타임 dogfood
 * 매니페스트). 미래 cloud collab 단계가 다시 도입될 때 'cloud' 모드를
 * enum 에 다시 추가.
 *
 * 부수 효과: `window.__ohMyOntologyMode` 에 현재 mode 발행 (디버그 전용).
 */
export function useDataSourceMode(): DataSourceMode {
  const { status: vaultStatus } = useLocalVault();

  const mode = useMemo<DataSourceMode>(
    () => getDataSourceMode({ vaultLoaded: vaultStatus === 'loaded' }),
    [vaultStatus],
  );

  useEffect(() => {
    publishDataSourceModeForDebug(mode);
  }, [mode]);

  return mode;
}
