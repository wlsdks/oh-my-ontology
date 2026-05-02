'use client';

import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Link, useRouter } from '@/i18n/navigation';
import { useTranslations } from 'next-intl';
import { AuthGoogleButton, signUpWithEmail, useUserAuth } from '@/features/user-auth';
import { Button, Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/shared/ui';

function resolveNextHref(nextParam: string | null) {
  // 회원가입 직후 기본 도착지 = 자기 워크스페이스 지도 (Layer 0).
  if (!nextParam) return '/';
  return nextParam;
}

type AuthSignupTranslator = ReturnType<typeof useTranslations>;

export function SignupPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const t = useTranslations('authPages.signup');
  const nextHref = useMemo(
    () => resolveNextHref(searchParams.get('next')),
    [searchParams],
  );
  const { status } = useUserAuth();
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (status === 'authenticated') {
      router.replace(nextHref);
    }
  }, [nextHref, router, status]);

  const loginHref = useMemo(() => {
    const next = searchParams.get('next');
    const params = new URLSearchParams();
    if (next) params.set('next', next);
    const qs = params.toString();
    return qs ? `/login?${qs}` : '/login';
  }, [searchParams]);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (password.length < 8) {
      setError(t('errorPasswordTooShort'));
      return;
    }
    if (password !== confirmPassword) {
      setError(t('errorPasswordMismatch'));
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      await signUpWithEmail({ displayName, email, password });
      router.replace(nextHref);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('errorFallback'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-[color:var(--color-canvas)] px-6 py-6 md:px-10">
      <h1 className="sr-only">{t('srHeading')}</h1>
      <div className="mx-auto flex w-full max-w-md flex-col gap-4">
        <Card className="rounded-[28px]">
          <CardHeader>
            <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-[color:var(--color-text-quaternary)]">
              {t('eyebrow')}
            </p>
            <CardTitle>{t('title')}</CardTitle>
            <CardDescription>{t('description')}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <AuthGoogleButton
              label={t('googleButton')}
              onSuccess={() => router.replace(nextHref)}
            />

            <div className="flex items-center gap-3">
              <div className="h-px flex-1 bg-[color:var(--color-divider)]" />
              <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-[color:var(--color-text-quaternary)]">
                {t('divider')}
              </span>
              <div className="h-px flex-1 bg-[color:var(--color-divider)]" />
            </div>

            <form className="space-y-4" onSubmit={handleSubmit}>
              <Field label={t('nameLabel')}>
                <input
                  name="displayName"
                  type="text"
                  autoComplete="name"
                  value={displayName}
                  onChange={(event) => setDisplayName(event.target.value)}
                  placeholder={t('namePlaceholder')}
                  className={inputClassName}
                  required
                />
              </Field>
              <Field label={t('emailLabel')}>
                <input
                  name="email"
                  type="email"
                  autoComplete="email"
                  spellCheck={false}
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder={t('emailPlaceholder')}
                  className={inputClassName}
                  required
                />
              </Field>
              <Field
                label={t('passwordLabel')}
                helper={passwordLengthHelper(password, t)}
              >
                <input
                  name="password"
                  type="password"
                  autoComplete="new-password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder={t('passwordPlaceholder')}
                  className={inputClassName}
                  required
                  aria-describedby="signup-password-helper"
                />
              </Field>
              <Field
                label={t('confirmPasswordLabel')}
                helper={passwordMatchHelper(password, confirmPassword, t)}
              >
                <input
                  name="confirmPassword"
                  type="password"
                  autoComplete="new-password"
                  value={confirmPassword}
                  onChange={(event) => setConfirmPassword(event.target.value)}
                  placeholder={t('confirmPasswordPlaceholder')}
                  className={inputClassName}
                  required
                  aria-describedby="signup-confirm-helper"
                />
              </Field>
              {error ? (
                <p role="alert" className="text-sm text-[color:var(--color-status-danger)]">
                  {error}
                </p>
              ) : null}
              <Button
                type="submit"
                disabled={submitting || !canSubmit(password, confirmPassword)}
                className="w-full"
              >
                {submitting ? t('submitting') : t('submit')}
              </Button>
            </form>

            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[color:var(--color-border-soft)] pt-4">
              <p className="text-sm text-[color:var(--color-text-tertiary)]">
                {t('haveAccount')}
              </p>
              <div className="flex items-center gap-2">
                <Link href={loginHref} className="inline-flex">
                  <Button variant="outline" type="button">
                    {t('loginCta')}
                  </Button>
                </Link>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}

interface HelperState {
  text: string;
  /** 아직 입력 안 됐으면 'idle', 조건 충족이면 'ok', 미충족이면 'warn' */
  tone: 'idle' | 'ok' | 'warn';
}

function Field({
  label,
  helper,
  children,
}: {
  label: string;
  helper?: HelperState;
  children: React.ReactNode;
}) {
  return (
    <label className="flex flex-col gap-2">
      <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-[color:var(--color-text-quaternary)]">
        {label}
      </span>
      {children}
      {helper ? (
        <span
          className={[
            'text-[11px] leading-5',
            helper.tone === 'ok'
              ? 'text-[color:var(--color-status-success)]'
              : helper.tone === 'warn'
                ? 'text-[color:var(--color-status-paused)]'
                : 'text-[color:var(--color-text-quaternary)]',
          ].join(' ')}
        >
          {helper.text}
        </span>
      ) : null}
    </label>
  );
}

function passwordLengthHelper(password: string, t: AuthSignupTranslator): HelperState {
  if (password.length === 0) return { text: t('passwordHelperIdle'), tone: 'idle' };
  if (password.length < 8)
    return {
      text: t('passwordHelperWarn', { length: password.length }),
      tone: 'warn',
    };
  return { text: t('passwordHelperOk', { length: password.length }), tone: 'ok' };
}

function passwordMatchHelper(
  password: string,
  confirmPassword: string,
  t: AuthSignupTranslator,
): HelperState {
  if (confirmPassword.length === 0)
    return { text: t('passwordMatchHelperIdle'), tone: 'idle' };
  if (password !== confirmPassword)
    return { text: t('passwordMatchHelperWarn'), tone: 'warn' };
  return { text: t('passwordMatchHelperOk'), tone: 'ok' };
}

function canSubmit(password: string, confirmPassword: string): boolean {
  return password.length >= 8 && password === confirmPassword;
}

const inputClassName =
  'h-11 rounded-xl border border-[color:var(--color-divider)] bg-[color:var(--color-overlay-1)] px-4 text-sm text-[color:var(--color-text-primary)] outline-none transition-colors placeholder:text-[color:var(--color-text-quaternary)] focus:border-[color:var(--color-indigo-accent)]';
