"use client";

import { useSearchParams } from "next/navigation";
import { useScopedAccountAccess } from "@/features/account-scope";
import { useGlobalAdmin } from "@/features/permissions";
import { useUserAuth } from "@/features/user-auth";
import { } from "@/shared/lib/account-scope";
import { OntologyViewPage } from "@/views/ontology-view";
import { LandingPage } from "@/views/landing";

/**
 * 루트 `/` 진입 분기. (Phase 1 — Direction A 적용)
 *
 * 이 서비스는 **온톨로지 워크벤치** — 인증 사용자 의 첫 화면은 ontology hub
 * (트리 + ego graph + stub 처리). 토폴로지는 출구 view 중 하나로 `/topology`
 * 에 별도 라우트.
 *
 * - 비인증: LandingPage
 * - 인증: OntologyViewPage (트리 + 컨텍스트 패널)
 * - 토폴로지가 보고 싶으면 nav / 헤더 에서 `/topology`
 *
 * `?account=X` (legacy multi-account scope) 가 있으면 membership 조회 후
 * 같은 분기. dev-bypass 사용자는 useGlobalAdmin 으로 인증 처리.
 */
export function RootEntryPage() {
  const searchParams = useSearchParams();
  const accountId = null;
  const next = searchParams.get("next");
  const userAuth = useUserAuth();
  const globalAdmin = useGlobalAdmin();
  const scopedAccess = useScopedAccountAccess();

  // Account-scoped 방문만 membership-aware scope 로 판정.
  if (accountId) {
    if (scopedAccess.kind === "loading") {
      return <AuthLoadingSpinner />;
    }
    if (scopedAccess.kind === "guest") {
      return <LandingPage accountId={accountId} next={next} />;
    }
    return <OntologyViewPage />;
  }

  // 공개 홈 — Firebase Auth 초기화만 기다리면 충분.
  if (userAuth.status === "loading" || globalAdmin.status === "loading") {
    return <AuthLoadingSpinner />;
  }
  // dev-bypass 사용자도 인증된 사용자로 간주 → OntologyViewPage.
  if (
    userAuth.status === "unauthenticated" &&
    globalAdmin.status !== "authenticated"
  ) {
    return <LandingPage accountId={null} next={next} />;
  }
  return <OntologyViewPage />;
}

function AuthLoadingSpinner() {
  return (
    <div
      className="flex min-h-screen items-center justify-center bg-[color:var(--color-canvas)]"
      role="status"
      aria-live="polite"
    >
      <div className="flex items-center gap-3 rounded-full border border-[color:rgba(139,151,255,0.24)] bg-[color:var(--color-panel)] px-4 py-2 shadow-[0_10px_24px_rgba(0,0,0,0.35)]">
        <span className="flex gap-1" aria-hidden>
          <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-[color:rgba(139,151,255,0.8)] [animation-delay:0ms]" />
          <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-[color:rgba(139,151,255,0.8)] [animation-delay:150ms]" />
          <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-[color:rgba(139,151,255,0.8)] [animation-delay:300ms]" />
        </span>
        <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-[color:var(--color-text-tertiary)]">
          확인 중
        </span>
      </div>
    </div>
  );
}
