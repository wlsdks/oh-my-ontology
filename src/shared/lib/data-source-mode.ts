/**
 * 운영 모드 (data source mode) 식별 유틸. 2 모드:
 *
 * - **static** — `pnpm build` 의 정적 dogfood manifest. vault 미선택 시 fallback.
 * - **local** — File System Access API 로 사용자 디스크의 .md vault.
 *
 * 본 함수는 *순수* — vault loaded 상태만 받아 mode 결정.
 * UI 레이어는 `useDataSourceMode` 훅으로 합성된 결과를 사용.
 */

export type DataSourceMode = 'static' | 'local';

interface ModeInputs {
  /** `useLocalVault().status === 'loaded'` */
  vaultLoaded: boolean;
}

export function getDataSourceMode({ vaultLoaded }: ModeInputs): DataSourceMode {
  return vaultLoaded ? 'local' : 'static';
}

/**
 * window 에 현재 모드를 expose — 개발자 도구에서 `window.__ohMyOntologyMode`
 * 로 조회 가능. 런타임 코드는 이 값을 사용하지 말 것 (hook 결과 의존).
 */
export function publishDataSourceModeForDebug(mode: DataSourceMode): void {
  if (typeof window === 'undefined') return;
  (window as unknown as { __ohMyOntologyMode?: DataSourceMode }).__ohMyOntologyMode = mode;
}
