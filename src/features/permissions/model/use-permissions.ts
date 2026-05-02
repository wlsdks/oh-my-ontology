'use client';

export type PermissionStatus = 'loading' | 'unauthenticated' | 'denied' | 'allowed';

export interface PermissionsState {
  status: PermissionStatus;
  user: null;
  isGlobalAdmin: boolean;
  canEditAccount: boolean;
}

/**
 * R10 (auth 영구 제거) 이후 stub. local-first single-user OSS 라 항상 'allowed'.
 *
 * R10c 에서 호출자 (usePermissions 의존하는 4~5 위젯) 정리하면서 hook 자체 제거 예정.
 */
export function usePermissions(_accountId?: string | null): PermissionsState {
  return {
    status: 'allowed',
    user: null,
    isGlobalAdmin: false,
    canEditAccount: true,
  };
}
