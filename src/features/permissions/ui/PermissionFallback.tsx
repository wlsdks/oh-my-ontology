'use client';

import { Link, usePathname } from '@/i18n/navigation';
import { useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { ACCOUNT_QUERY_KEY, normalizeAccountId } from '@/shared/lib/account-scope';
import {
  buildGuardHomeHref,
  buildGuardLoginHref,
} from '../model/guard-navigation';

type Variant = 'unauthenticated' | 'denied' | 'loading';

interface Props {
  variant: Variant;
}

interface SurfaceCopy {
  eyebrow: string;
  title: string;
  body: string;
}

type SurfaceKey = 'review' | 'settings' | 'diagnostics' | 'default';

// 운영 surface 별 1줄 가치 설명 — 같은 "로그인하세요" 가 아니라
// "여기서 무엇을 하게 될지" 를 미리 알려, 사용자가 로그인할 동기를 잡고
// 어떤 화면인지 컨텍스트를 잃지 않게 한다. pathname prefix 로 매칭.
function resolveSurfaceKey(pathname: string): SurfaceKey {
  if (pathname.startsWith('/review')) return 'review';
  if (pathname.startsWith('/settings')) return 'settings';
  if (pathname.startsWith('/diagnostics')) return 'diagnostics';
  return 'default';
}

/**
 * 모든 PermissionGate 가 공유하는 빈 상태 UI. 로그인이 필요하거나 권한이
 * 없을 때 사용자에게 다음 행동(로그인 이동, 공개 홈 복귀)을 제공한다.
 */
export function PermissionFallback({ variant }: Props) {
  const t = useTranslations('featuresMisc.permissionGate');
  const isLoading = variant === 'loading';
  const pathname = usePathname() ?? '';
  const searchParams = useSearchParams();
  const search = searchParams.toString();
  const accountId = normalizeAccountId(searchParams.get(ACCOUNT_QUERY_KEY));
  const currentPath = `${pathname}${search ? `?${search}` : ''}`;

  let surfaceCopy: SurfaceCopy;
  let primaryLabel = '';
  let primaryHref = '';
  let showSecondary = false;

  if (variant === 'loading') {
    surfaceCopy = {
      eyebrow: '',
      title: t('loadingTitle'),
      body: t('loadingBody'),
    };
  } else {
    const surface = resolveSurfaceKey(pathname);
    const prefix =
      surface === 'review'
        ? variant === 'unauthenticated'
          ? 'reviewUnauth'
          : 'reviewDenied'
        : surface === 'settings'
          ? variant === 'unauthenticated'
            ? 'settingsUnauth'
            : 'settingsDenied'
          : surface === 'diagnostics'
            ? variant === 'unauthenticated'
              ? 'diagnosticsUnauth'
              : 'diagnosticsDenied'
            : variant === 'unauthenticated'
              ? 'defaultUnauth'
              : 'defaultDenied';
    surfaceCopy = {
      eyebrow: t(`${prefix}Eyebrow` as Parameters<typeof t>[0]),
      title: t(`${prefix}Title` as Parameters<typeof t>[0]),
      body: t(`${prefix}Body` as Parameters<typeof t>[0]),
    };
    primaryLabel =
      variant === 'unauthenticated'
        ? t('actionLoginPrimary')
        : t('actionLoginAnotherAccount');
    primaryHref = buildGuardLoginHref({ accountId, currentPath });
    showSecondary = true;
  }

  const homeHref = buildGuardHomeHref(accountId);

  return (
    <main
      id="main"
      className="flex min-h-screen items-center justify-center px-6 py-12"
    >
      <div className="w-full max-w-md rounded-2xl border border-[color:var(--color-divider)] bg-[color:var(--color-panel)] p-7 text-center shadow-[0_24px_48px_rgba(0,0,0,0.24)]">
        {surfaceCopy.eyebrow && (
          <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-[color:var(--color-text-quaternary)]">
            {surfaceCopy.eyebrow}
          </p>
        )}
        <h1 className="mt-2 text-xl font-[var(--font-weight-signature)] text-[color:var(--color-text-primary)]">
          {surfaceCopy.title}
        </h1>
        <p className="mt-3 text-sm leading-6 text-[color:var(--color-text-tertiary)]">
          {surfaceCopy.body}
        </p>
        {!isLoading && (
          <div className="mt-6 flex flex-col items-stretch gap-2">
            <Link
              href={primaryHref}
              className="inline-flex h-10 items-center justify-center rounded-lg bg-[color:var(--color-indigo-brand)] px-4 text-sm font-[var(--font-weight-signature)] text-[color:var(--color-text-primary)] transition-opacity hover:opacity-90"
            >
              {primaryLabel}
            </Link>
            {showSecondary && (
              <Link
                href={homeHref}
                className="inline-flex h-10 items-center justify-center rounded-lg border border-[color:var(--color-divider)] px-4 text-sm text-[color:var(--color-text-secondary)] transition-colors hover:text-[color:var(--color-text-primary)]"
              >
                {t('actionBackToHome')}
              </Link>
            )}
          </div>
        )}
      </div>
    </main>
  );
}
