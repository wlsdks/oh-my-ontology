'use client';

import { useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Link } from '@/i18n/navigation';
import { ArrowLeft, MailCheck } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { sendPasswordReset } from '@/features/user-auth';
import { Button, Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/shared/ui';

export function PasswordResetPage() {
  const searchParams = useSearchParams();
  const t = useTranslations('authPages.resetPassword');
  const [email, setEmail] = useState(searchParams.get('email') ?? '');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    setSuccess(null);

    try {
      await sendPasswordReset({ email });
      setSuccess(t('successMessage'));
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : t('errorFallback'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-[color:var(--color-canvas)] px-6 py-6 md:px-10">
      <h1 className="sr-only">{t('srHeading')}</h1>
      <div className="mx-auto flex w-full max-w-md flex-col gap-4">
        <Link href="/login" className="inline-flex">
          <Button variant="outline" type="button" className="gap-2 rounded-full">
            <ArrowLeft size={15} />
            {t('backToLogin')}
          </Button>
        </Link>

        <Card className="rounded-[28px]">
          <CardHeader>
            <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-[color:var(--color-text-quaternary)]">
              {t('eyebrow')}
            </p>
            <CardTitle>{t('title')}</CardTitle>
            <CardDescription>{t('description')}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <form className="space-y-4" onSubmit={handleSubmit}>
              <label className="flex flex-col gap-2">
                <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-[color:var(--color-text-quaternary)]">
                  {t('emailLabel')}
                </span>
                <input
                  name="email"
                  type="email"
                  autoComplete="email"
                  className={inputClassName}
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  required
                />
              </label>
              {error ? (
                <p role="alert" className="text-sm text-[color:var(--color-status-danger)]">
                  {error}
                </p>
              ) : null}
              {success ? (
                <p className="flex items-center gap-2 text-sm text-[color:var(--color-indigo-accent)]">
                  <MailCheck size={15} />
                  {success}
                </p>
              ) : null}
              <Button type="submit" disabled={submitting} className="w-full">
                {submitting ? t('submitting') : t('submit')}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}

const inputClassName =
  'h-11 rounded-xl border border-[color:var(--color-divider)] bg-[color:var(--color-overlay-1)] px-4 text-sm text-[color:var(--color-text-primary)] outline-none transition-colors placeholder:text-[color:var(--color-text-quaternary)] focus:border-[color:var(--color-indigo-accent)]';
