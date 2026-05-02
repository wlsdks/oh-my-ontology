'use client';

import { useEffect, useMemo } from 'react';
import { useLocalVault } from '@/features/docs-vault-local';
import {
  getDataSourceMode,
  publishDataSourceModeForDebug,
  type DataSourceMode,
} from '@/shared/lib/data-source-mode';

/**
 * 현재 운영 모드 (`'static' | 'local' | 'cloud'`) 를 React 상태로 노출.
 *
 * R10 (auth 영구 제거) 이후 cloud 분기 미사용 — 인증이 없으면 cloud 진입
 * 불가. 결과적으로 모드는 항상 'local' (vault 선택됨) 또는 'static' (vault
 * 없음 — 빌드타임 dogfood 매니페스트). 'cloud' 분기는 R10b 의 Firestore
 * 호출자 정리 후 enum 자체를 좁힐 예정.
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
