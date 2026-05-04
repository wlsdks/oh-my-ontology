'use client';

import { AlertTriangle, RefreshCw } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';

/**
 * R11 #9 — Sigma WebGL render 가 throw 했을 때의 fallback. SigmaTopology 가
 * ErrorBoundary 로 감싸 사용. 발생 시나리오: GPU driver crash / browser
 * context lost / 비동기 init 실패. 사용자 보고 0 이지만 발생 시 surface
 * 1/3 (topology) 통째로 망가지므로 reload CTA + tree 뷰 대체 link 제공.
 */
interface Props {
  error: Error;
  onReset: () => void;
}

export function SigmaErrorFallback({ error, onReset }: Props) {
  const t = useTranslations('topology.errorFallback');
  return (
    <div
      role="alert"
      className="flex h-full min-h-[280px] w-full flex-col items-center justify-center gap-4 px-6 py-10 text-center"
    >
      <AlertTriangle
        size={28}
        className="text-[color:var(--color-status-warning)]"
        aria-hidden
      />
      <div className="space-y-1">
        <h2 className="text-sm font-medium text-[color:var(--color-text-primary)]">
          {t('title')}
        </h2>
        <p className="max-w-md text-[12.5px] text-[color:var(--color-text-tertiary)]">
          {t('body')}
        </p>
      </div>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onReset}
          className="inline-flex items-center gap-1.5 rounded-md border border-[color:var(--color-border-strong)] bg-[color:var(--color-elevated)] px-3 py-1.5 text-[12px] text-[color:var(--color-text-primary)] transition-colors hover:border-[color:rgba(94,106,210,0.4)]"
        >
          <RefreshCw size={12} aria-hidden />
          {t('retry')}
        </button>
        <Link
          href="/ontology"
          className="rounded-md border border-transparent px-3 py-1.5 text-[12px] text-[color:var(--color-text-tertiary)] transition-colors hover:text-[color:var(--color-text-primary)]"
        >
          {t('switchToTree')}
        </Link>
      </div>
      {process.env.NODE_ENV === 'development' && error?.message ? (
        <pre className="max-w-md overflow-x-auto rounded bg-[color:var(--color-overlay-1)] px-2 py-1 text-left font-mono text-[10px] text-[color:var(--color-text-quaternary)]">
          {error.message}
        </pre>
      ) : null}
    </div>
  );
}
