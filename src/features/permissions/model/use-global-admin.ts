'use client';

export type GlobalAdminStatus = 'loading' | 'unauthenticated' | 'not-allowed' | 'authenticated';

export interface GlobalAdminState {
  status: GlobalAdminStatus;
  user: null;
}

/**
 * R10 (auth 영구 제거) 이후 stub. 항상 'unauthenticated' 반환.
 *
 * 호출자 (`PermissionGate` 등) 는 R10c 에서 일괄 정리 예정. 그 전까지는
 * gate 가 cloud-mode pages (settings/categories|statuses|import) 의 비활성화
 * 분기로만 의미. local-first 페이지는 PermissionGate 를 안 통한다.
 */
export function useGlobalAdmin(): GlobalAdminState {
  return { status: 'unauthenticated', user: null };
}
