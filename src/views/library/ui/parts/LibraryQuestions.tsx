"use client";

import type { useTranslations } from 'next-intl';
import { useId } from 'react';
import { answerObservation, type RetainedAnswerHead } from '@/features/library';
import { Button, RowButton } from '@/shared/ui';

export function LibraryQuestions({ answers, knownSources, hashes, onOpen, onAsk, t }: {
  answers: readonly RetainedAnswerHead[];
  knownSources: ReadonlySet<string>;
  hashes: ReadonlyMap<string, string>;
  onOpen: (slug: string) => void;
  onAsk: (() => void) | null;
  t: ReturnType<typeof useTranslations<'library'>>;
}) {
  const observationId = useId();
  return (
    <section data-testid="library-questions" aria-labelledby="library-questions-title">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <h2 id="library-questions-title" className="text-display font-[var(--font-weight-signature)] leading-title text-[color:var(--color-text-primary)]">
            {t('answers.title')}
          </h2>
          <p className="mt-2 text-body leading-body text-[color:var(--color-text-secondary)]">{t('answers.lede')}</p>
        </div>
        {onAsk ? <Button className="atlas-touch-floor max-w-full" size="sm" variant={answers.length ? 'ghost' : 'outline'} onClick={onAsk}>{t('answers.ask')}</Button> : null}
      </div>
      {answers.length ? (
        <ul className="mt-6 divide-y divide-[color:var(--color-divider)] border-y border-[color:var(--color-divider)]">
          {answers.map((answer) => {
            const observation = answerObservation(answer.frontmatter, knownSources, hashes);
            return (
              <li key={answer.slug} className="py-3">
                <RowButton size="lg" tone="strong" hoverSurface="lift" className="w-full" aria-describedby={`${observationId}-${encodeURIComponent(answer.slug)}`} onClick={() => onOpen(answer.slug)} data-testid={`library-question-${answer.slug}`}>
                  <span className="min-w-0 flex-1 truncate">{answer.title}</span>
                </RowButton>
                <div id={`${observationId}-${encodeURIComponent(answer.slug)}`} className="mt-1 flex flex-wrap gap-x-3 gap-y-1 px-3 text-caption leading-body text-[color:var(--color-text-secondary)]">
                  <span className="text-body font-[var(--font-weight-strong)] text-[color:var(--color-text-primary)]" data-testid="answer-observation" data-state={observation.state}>{t(`answers.state.${observation.state}`)}</span>{' '}
                  {answer.alternatives > 1 ? <span>{t('answers.alternatives', { count: answer.alternatives })}{' '}</span> : null}
                  {answer.historyProblem ? <span>{t('answers.historyProblem')}</span> : null}
                </div>
              </li>
            );
          })}
        </ul>
      ) : <p className="mt-6 text-body leading-body text-[color:var(--color-text-secondary)]">{t('answers.empty')}</p>}
      <p className="mt-4 text-caption leading-body text-[color:var(--color-text-tertiary)]">{t('answers.provenance')}</p>
    </section>
  );
}
