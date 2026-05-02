"use client";

import { useMemo } from "react";
import { useTranslations } from "next-intl";
import {
  type ScopedAccountAccess,
} from "./account-access";

export interface UseScopedAccountAccessResult extends ScopedAccountAccess {
  membership: null;
  user: {
    uid: string;
    email: string | null;
    displayName: string | null;
  } | null;
}

/**
 * R10 (auth 영구 제거) 이후 stub — 항상 "owner" 로 통과.
 *
 * mission v2: vault = 사용자 디스크. 즉, 도구를 사용하는 사람이 곧 owner.
 * multi-user / membership 모델은 미래 cloud collab 단계에서 새로 도입할 때
 * 다시 디자인. v0.x OSS 는 single-machine, single-user.
 *
 * R10c 에서 호출자 정리하면서 hook 자체 제거 예정.
 */
export function useScopedAccountAccess(): UseScopedAccountAccessResult {
  const t = useTranslations("featuresMisc.accountScope");

  return useMemo<UseScopedAccountAccessResult>(
    () => ({
      kind: "owner",
      canManage: true,
      canEditProject: true,
      canEditDocuments: true,
      canReviewAndPublish: true,
      hasWorkspaceAccess: true,
      roleLabel: t("ownerRole"),
      description: t("ownerDescription"),
      membership: null,
      user: null,
    }),
    [t],
  );
}
