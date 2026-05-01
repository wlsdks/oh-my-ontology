/**
 * Single-user mode helpers.
 *
 * 이 프로젝트는 1 인 도구 모델로 단순화됐다. multi-account 워크스페이스
 * (account scope · membership · `?account=` URL query) 는 v2 협업 단계에서
 * 다시 도입한다. 남은 helper 는 URL query key 상수 + normalize 만.
 *
 * 폐기된 stub 함수들 (`appendWorkspaceProjectQuery` / `readRuntimeWorkspaceProjectId`)
 * 은 항상 identity / null 만 돌려주던 dead 함수라 제거됨. 컨테이너 라우팅이
 * 부활하는 시점에 별도 spec 으로 재도입.
 */

export const ACCOUNT_QUERY_KEY = "account";

export function normalizeAccountId(value?: string | null): string | null {
  const normalized = value?.trim();
  return normalized ? normalized : null;
}
