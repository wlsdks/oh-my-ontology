'use client';

import type { ReactNode } from 'react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  deniedFallback?: ReactNode;
  loadingFallback?: ReactNode;
}

/**
 * R10 (auth 영구 제거) 이후 PermissionGate 는 pass-through.
 *
 * mission v2 + R10: 도구를 쓰는 사람이 곧 owner. local-first OSS 에 권한
 * 분기 없음. fallback / loading / denied 매개변수는 backward-compat 으로
 * 받지만 사용 안 한다.
 *
 * R10c 에서 settings/{categories,statuses,import} 같은 cloud-only surface
 * 가 정리되면서 게이트 자체 호출도 사라질 예정.
 */
export function PermissionGate({ children }: Props) {
  return <>{children}</>;
}
