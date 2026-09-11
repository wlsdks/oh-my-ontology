"use client";

import type { useTranslations } from 'next-intl';
import type { RefObject } from 'react';
import type { AnswerObservation } from '@/features/library';
import { Button } from '@/shared/ui';

export function RetainedAnswerContext({ observation, phase, historyState, older, onHome, onPrevious, onRefresh, refreshButtonRef, error, t }: {
  observation: AnswerObservation;
  phase: string;
  historyState: string;
  older: boolean;
  onHome: () => void;
  onPrevious: (() => void) | null;
  onRefresh: (() => void) | null;
  refreshButtonRef?: RefObject<HTMLButtonElement | null>;
  error: string | null;
  t: ReturnType<typeof useTranslations<'library'>>;
}) {
  const working = phase === 'preparing' || phase === 'running' || phase === 'saving';
  return (
    <section data-testid="retained-answer-context" className="mx-auto mt-4 w-full max-w-[var(--measure-doc-column)] px-6 md:px-10" aria-label={t('answers.evidence')}>
      <div className="border-y border-[color:var(--color-divider)] py-4">
        <p role="status" aria-live="polite" className="sr-only">{working ? t(`answers.phase.${phase}`) : ''}</p>
        <p data-testid="answer-evidence-state" data-state={observation.state} className="text-body font-[var(--font-weight-strong)] text-[color:var(--color-text-primary)]">{t(`answers.state.${observation.state}`)}</p>
        {(['changed', 'missing', 'added'] as const).map((kind) => observation[kind].length ? (
          <p key={kind} className="mt-1 break-words text-caption leading-body text-[color:var(--color-text-secondary)]">
            {t(`answers.paths.${kind}`)}: {observation[kind].join(' · ')}
          </p>
        ) : null)}
        <p className="mt-2 text-caption leading-body text-[color:var(--color-text-secondary)]">{t('answers.provenance')}</p>
        {older ? <p className="mt-2 text-caption text-[color:var(--color-text-secondary)]">{t('answers.older')}</p> : null}
        {historyState !== 'none' ? <p data-testid="answer-history-state" className="mt-2 text-caption text-[color:var(--color-text-secondary)]">{t(`answers.history.${historyState}`)}</p> : null}
        <div className="mt-3 flex flex-wrap gap-2">
          {onRefresh ? <Button ref={refreshButtonRef} className="atlas-touch-floor max-w-full" size="sm" variant="outline" disabled={working} onClick={onRefresh} data-testid="answer-refresh-start">{t(working ? `answers.phase.${phase}` : 'answers.refresh')}</Button> : null}
          {onPrevious ? <Button className="atlas-touch-floor max-w-full" size="sm" variant="ghost" onClick={onPrevious}>{t('answers.previous')}</Button> : null}
          <Button className="atlas-touch-floor max-w-full" size="sm" variant="ghost" onClick={onHome}>{t('answers.back')}</Button>
        </div>
        {onRefresh ? <p className="mt-2 text-caption leading-body text-[color:var(--color-text-secondary)]">{t('answers.refreshHint')}</p> : null}
        {!onRefresh ? <p className="mt-2 text-caption text-[color:var(--color-text-secondary)]">{t('answers.refreshUnavailable')}</p> : null}
        {error ? <p role="alert" className="mt-3 text-body leading-body text-[color:var(--color-text-primary)]">{error}</p> : null}
      </div>
    </section>
  );
}
