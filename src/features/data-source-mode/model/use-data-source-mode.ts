'use client';

import { useEffect, useMemo } from 'react';
import { useUserAuth } from '@/features/user-auth';
import { useLocalVault } from '@/features/docs-vault-local';
import {
  getDataSourceMode,
  publishDataSourceModeForDebug,
  type DataSourceMode,
} from '@/shared/lib/data-source-mode';

/**
 * 현재 운영 모드 (`'static' | 'local' | 'cloud'`) 를 React 상태로 노출.
 *
 * 결정 규칙 (`getDataSourceMode` 와 일치):
 * - `useLocalVault().status === 'loaded'` 면 'local' (디스크가 진실원).
 * - 그 외 Firebase Auth 인증된 사용자면 'cloud'.
 * - 둘 다 아니면 'static' (정적 manifest).
 *
 * Auth status 가 'loading' 인 동안에는 *fallback* 으로 'static' 처리해 SSR /
 * 첫 paint 안정. 이후 인증 결과에 따라 자연 갱신.
 *
 * 부수 효과: `window.__ohMyOntologyMode` 에 현재 mode 발행 (디버그 전용).
 */
export function useDataSourceMode(): DataSourceMode {
  const { status: authStatus } = useUserAuth();
  const { status: vaultStatus } = useLocalVault();

  const mode = useMemo<DataSourceMode>(
    () =>
      getDataSourceMode({
        vaultLoaded: vaultStatus === 'loaded',
        isAuthenticated: authStatus === 'authenticated',
      }),
    [authStatus, vaultStatus],
  );

  useEffect(() => {
    publishDataSourceModeForDebug(mode);
  }, [mode]);

  return mode;
}
