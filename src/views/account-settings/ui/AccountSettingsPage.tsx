'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft, MailCheck, ShieldCheck, UserRound } from 'lucide-react';
import { useTranslations } from 'next-intl';
import {
  changePassword,
  getCurrentAuthProfile,
  getPasswordSupportState,
  sendPasswordReset,
  useUserAuth,
  type PasswordSupportState,
} from '@/features/user-auth';
import { Button, Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/shared/ui';
import { PublicAccountMenu } from '@/widgets/account-menu';

export function AccountSettingsPage() {
  const router = useRouter();
  const t = useTranslations('authPages.account');
  const placeholderState = useMemo<PasswordSupportState>(
    () => ({
      canChangePassword: false,
      canResetPassword: false,
      providerLabel: t('providerLoadingLabel'),
      reason: t('providerLoadingReason'),
    }),
    [t],
  );
  const { status, user } = useUserAuth();
  const [profileEmail, setProfileEmail] = useState(user?.email ?? '');
  const [passwordSupport, setPasswordSupport] =
    useState<PasswordSupportState>(placeholderState);
  useEffect(() => {
    let cancelled = false;
    void getPasswordSupportState().then((support) => {
      if (!cancelled) setPasswordSupport(support);
    });
    return () => {
      cancelled = true;
    };
  }, []);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [changeSubmitting, setChangeSubmitting] = useState(false);
  const [changeError, setChangeError] = useState<string | null>(null);
  const [changeSuccess, setChangeSuccess] = useState<string | null>(null);
  const [resetEmail, setResetEmail] = useState(user?.email ?? '');
  const [resetSubmitting, setResetSubmitting] = useState(false);
  const [resetError, setResetError] = useState<string | null>(null);
  const [resetSuccess, setResetSuccess] = useState<string | null>(null);

  useEffect(() => {
    if (status === 'unauthenticated') router.replace('/login?next=/account');
  }, [router, status]);

  useEffect(() => {
    if (status !== 'authenticated') return;
    let cancelled = false;
    void getCurrentAuthProfile().then(async (profile) => {
      if (cancelled || !profile) return;
      setProfileEmail(profile.email ?? '');
      setResetEmail(profile.email ?? '');
      // getPasswordSupportState 는 dynamic import — await 사이에 unmount
      // 가능성. 다시 가드.
      const support = await getPasswordSupportState();
      if (cancelled) return;
      setPasswordSupport(support);
    });
    return () => {
      cancelled = true;
    };
  }, [status]);

  const handleChangePassword = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (newPassword !== confirmPassword) {
      setChangeError(t('changePasswordErrorMismatch'));
      return;
    }
    setChangeSubmitting(true);
    setChangeError(null);
    setChangeSuccess(null);
    try {
      await changePassword({ currentPassword, newPassword });
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setChangeSuccess(t('changePasswordSuccess'));
    } catch (error) {
      setChangeError(error instanceof Error ? error.message : t('changePasswordErrorFallback'));
    } finally {
      setChangeSubmitting(false);
    }
  };

  const handleResetPassword = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setResetSubmitting(true);
    setResetError(null);
    setResetSuccess(null);
    try {
      await sendPasswordReset({ email: resetEmail });
      setResetSuccess(t('resetSuccess'));
    } catch (error) {
      setResetError(error instanceof Error ? error.message : t('resetErrorFallback'));
    } finally {
      setResetSubmitting(false);
    }
  };

  return (
    <main className="min-h-screen bg-[color:var(--color-canvas)] px-6 py-8 md:px-10">
      <h1 className="sr-only">{t('srHeading')}</h1>
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-5">
        <div className="flex items-start justify-between gap-4">
          <Link href="/projects" className="inline-flex">
            <Button variant="outline" type="button" className="gap-2 rounded-full">
              <ArrowLeft size={15} />
              {t('back')}
            </Button>
          </Link>
          <PublicAccountMenu accountId={null} accountLabel={null} />
        </div>

        <Card className="rounded-[28px]">
          <CardHeader>
            <CardTitle>{t('title')}</CardTitle>
            <CardDescription>{t('description')}</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-5 lg:grid-cols-2">
            <Card className="rounded-[24px] border-[color:var(--color-border-soft)] bg-[color:var(--color-overlay-1)]">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <UserRound size={18} />
                  {t('profileTitle')}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm text-[color:var(--color-text-secondary)]">
                <ProfileRow
                  label={t('profileNameLabel')}
                  value={user?.displayName?.trim() || null}
                  emptyLabel={t('profileEmpty')}
                />
                <ProfileRow
                  label={t('profileEmailLabel')}
                  value={profileEmail || null}
                  emptyLabel={t('profileEmpty')}
                />
                <ProfileRow
                  label={t('profileProviderLabel')}
                  value={passwordSupport.providerLabel}
                  emptyLabel={t('profileEmpty')}
                />
              </CardContent>
            </Card>

            <Card className="rounded-[24px] border-[color:var(--color-border-soft)] bg-[color:var(--color-overlay-1)]">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <ShieldCheck size={18} />
                  {t('changePasswordTitle')}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {passwordSupport.canChangePassword ? (
                  <form className="space-y-4" onSubmit={handleChangePassword}>
                    <Field label={t('currentPasswordLabel')}>
                      <input
                        name="currentPassword"
                        type="password"
                        autoComplete="current-password"
                        className={inputClassName}
                        value={currentPassword}
                        onChange={(event) => setCurrentPassword(event.target.value)}
                        required
                      />
                    </Field>
                    <Field label={t('newPasswordLabel')}>
                      <input
                        name="newPassword"
                        type="password"
                        autoComplete="new-password"
                        className={inputClassName}
                        value={newPassword}
                        onChange={(event) => setNewPassword(event.target.value)}
                        required
                      />
                    </Field>
                    <Field label={t('confirmPasswordLabel')}>
                      <input
                        name="confirmPassword"
                        type="password"
                        autoComplete="new-password"
                        className={inputClassName}
                        value={confirmPassword}
                        onChange={(event) => setConfirmPassword(event.target.value)}
                        required
                      />
                    </Field>
                    {changeError ? (
                      <p className="text-sm text-[color:var(--color-status-danger)]">{changeError}</p>
                    ) : null}
                    {changeSuccess ? (
                      <p className="text-sm text-[color:var(--color-indigo-accent)]">{changeSuccess}</p>
                    ) : null}
                    <Button type="submit" disabled={changeSubmitting}>
                      {changeSubmitting ? t('changePasswordSubmitting') : t('changePasswordSubmit')}
                    </Button>
                  </form>
                ) : (
                  <p className="text-sm leading-6 text-[color:var(--color-text-tertiary)]">
                    {passwordSupport.reason ?? t('changePasswordUnavailable')}
                  </p>
                )}
              </CardContent>
            </Card>

            <Card className="rounded-[24px] border-[color:var(--color-border-soft)] bg-[color:var(--color-overlay-1)] lg:col-span-2">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <MailCheck size={18} />
                  {t('resetTitle')}
                </CardTitle>
                <CardDescription>{t('resetDescription')}</CardDescription>
              </CardHeader>
              <CardContent>
                {passwordSupport.canResetPassword ? (
                  <form className="flex flex-col gap-3 sm:flex-row sm:items-end" onSubmit={handleResetPassword}>
                    <Field label={t('resetEmailLabel')} className="flex-1">
                      <input
                        name="resetEmail"
                        type="email"
                        autoComplete="email"
                        className={inputClassName}
                        value={resetEmail}
                        onChange={(event) => setResetEmail(event.target.value)}
                        required
                      />
                    </Field>
                    <Button type="submit" variant="outline" disabled={resetSubmitting}>
                      {resetSubmitting ? t('resetSubmitting') : t('resetSubmit')}
                    </Button>
                    {resetError ? (
                      <p className="text-sm text-[color:var(--color-status-danger)] sm:basis-full">{resetError}</p>
                    ) : null}
                    {resetSuccess ? (
                      <p className="text-sm text-[color:var(--color-indigo-accent)] sm:basis-full">{resetSuccess}</p>
                    ) : null}
                  </form>
                ) : (
                  <p className="text-sm leading-6 text-[color:var(--color-text-tertiary)]">
                    {passwordSupport.reason ?? t('resetUnavailable')}
                  </p>
                )}
              </CardContent>
            </Card>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}

function ProfileRow({
  label,
  value,
  emptyLabel,
}: {
  label: string;
  value: string | null;
  emptyLabel: string;
}) {
  const trimmed = value?.trim() ?? '';
  return (
    <div className="grid gap-1 rounded-2xl border border-[color:var(--color-border-soft)] bg-[color:var(--color-overlay-1)] px-4 py-3">
      <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-[color:var(--color-text-quaternary)]">
        {label}
      </p>
      {trimmed.length === 0 ? (
        <p className="font-mono text-[11px] uppercase tracking-[0.1em] text-[color:var(--color-text-quaternary)]">
          {emptyLabel}
        </p>
      ) : (
        <p className="text-sm text-[color:var(--color-text-primary)]">{trimmed}</p>
      )}
    </div>
  );
}

function Field({
  label,
  children,
  className,
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <label className={`flex flex-col gap-2 ${className ?? ''}`}>
      <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-[color:var(--color-text-quaternary)]">
        {label}
      </span>
      {children}
    </label>
  );
}

const inputClassName =
  'h-11 rounded-xl border border-[color:var(--color-divider)] bg-[color:var(--color-overlay-1)] px-4 text-sm text-[color:var(--color-text-primary)] outline-none transition-colors placeholder:text-[color:var(--color-text-quaternary)] focus:border-[color:var(--color-indigo-accent)]';
