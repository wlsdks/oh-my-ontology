/**
 * Single-user mode helpers.
 *
 * 이 프로젝트는 1 인 도구 모델로 단순화됐다. multi-account 워크스페이스
 * (account scope · membership · `?account=` URL query · sessionStorage
 * fallback) 는 v2 협업 단계에서 다시 도입한다. 현재 코드 path 는 모두
 * 단일 사용자 + 단일 default workspace 가정으로 동작.
 *
 * `appendAccountQuery / rememberAccountId / resolveAccountId` 는 R2 라운드에서
 * 제거. 남은 helper 는 URL query key 상수 + normalize + workspace project id 유틸.
 */

export const ACCOUNT_QUERY_KEY = "account";
/** 활성 workspaceProject 컨테이너 id 의 URL query key (v0.x 에선 사용 안함). */
export const WORKSPACE_PROJECT_QUERY_KEY = "pj";

export function normalizeAccountId(value?: string | null): string | null {
  const normalized = value?.trim();
  return normalized ? normalized : null;
}

export function appendWorkspaceProjectQuery(
  href: string,
  _projectId?: string | null,
): string {
  return href;
}

export function readRuntimeWorkspaceProjectId(): string | null {
  return null;
}
