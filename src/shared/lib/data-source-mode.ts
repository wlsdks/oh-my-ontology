/**
 * 운영 모드 (data source mode) 식별 유틸.
 *
 * 4 모드 (`docs/LOCAL-FIRST-SYNC.md` §2):
 * - **static** — `pnpm build` 의 정적 manifest 만. Firebase 미사용.
 * - **local** — File System Access API 로 사용자 디스크의 .md vault.
 * - **cloud** — Firebase Auth + Firestore.
 * - **hybrid** (v1.0+) — 디스크 master + Firestore slave 단방향 push. 미구현.
 *
 * 본 함수는 *순수* — vault loaded / authenticated 상태만 받아 mode 결정.
 * UI 레이어는 `useDataSourceMode` 훅으로 합성된 결과를 사용.
 *
 * 우선순위: vault 가 활성화되어 있으면 'local' (사용자 디스크가 진실원).
 * vault 없고 로그인되어 있으면 'cloud'. 둘 다 아니면 'static'.
 */

export type DataSourceMode = 'static' | 'local' | 'cloud';

interface ModeInputs {
  /** `useLocalVault().status === 'loaded'` */
  vaultLoaded: boolean;
  /** Firebase Auth 또는 dev-bypass 로 인증된 상태 */
  isAuthenticated: boolean;
}

export function getDataSourceMode({
  vaultLoaded,
  isAuthenticated,
}: ModeInputs): DataSourceMode {
  if (vaultLoaded) return 'local';
  if (isAuthenticated) return 'cloud';
  return 'static';
}

/**
 * window 에 현재 모드를 expose — 개발자 도구에서 `window.__ohMyOntologyMode`
 * 로 조회 가능. 런타임 코드는 이 값을 사용하지 말 것 (hook 결과 의존).
 */
export function publishDataSourceModeForDebug(mode: DataSourceMode): void {
  if (typeof window === 'undefined') return;
  (window as unknown as { __ohMyOntologyMode?: DataSourceMode }).__ohMyOntologyMode = mode;
}
