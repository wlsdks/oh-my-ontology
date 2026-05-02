'use client';

export interface DocsVaultCapabilities {
  /** 현재 유저가 vault 를 볼 수 있는지 — 가드 통과 전제하에 거의 항상 true. */
  canRead: boolean;
  /** 편집 UI 에 접근 가능한지 — 현재 MVP 엔 편집 UI 가 없지만 향후 대비. */
  canEdit: boolean;
  /** 공유 링크 생성 등 관리 행위 가능 여부 — admin/owner/editor. */
  canManage: boolean;
  /** 현재 역할 라벨. */
  roleLabel: string;
  /** kind — 'owner' (R10 이후 단일 값). */
  kind: string;
}

/**
 * R10 (auth 영구 제거) 이후 stub. mission v2 single-user OSS 라 항상 owner.
 *
 * R10c 에서 호출자 정리하면서 hook 자체 제거 예정. roleLabel 은 backward
 * compat 용 — UI 가 표시 안 하게 정리될 것.
 */
export function useDocsVaultCapabilities(): DocsVaultCapabilities {
  return {
    canRead: true,
    canEdit: true,
    canManage: true,
    roleLabel: 'owner',
    kind: 'owner',
  };
}
