"use client";

import type { useTranslations } from 'next-intl';
import { useTranslations as useViewerTranslations } from 'next-intl';
import { useMemo, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { parseFrontmatter } from '@/shared/lib/parse-frontmatter';
import {
  normalizeOriginalPaths,
  resolveSourceCitation,
  rewriteWikilinks,
  WIKILINK_SENTINEL,
} from '@/shared/lib/source-citation';
import { Button, controlClass, Dialog, Disclosure } from '@/shared/ui';
import { SegmentedControl } from '@/shared/ui/segmented-control';
import { LG_BREAKPOINT_PX, useViewportBelow } from '@/shared/lib/use-viewport-below';

function RevisionText({
  text,
  knownOriginalPaths,
  onOpenSource,
}: {
  text: string;
  knownOriginalPaths?: ReadonlySet<string>;
  onOpenSource: (path: string, anchor?: string) => void;
}) {
  const sourceT = useViewerTranslations('vaultWidgets.viewer');
  const normalizedOriginalPaths = useMemo(
    () => normalizeOriginalPaths(knownOriginalPaths),
    [knownOriginalPaths],
  );

  return <ReactMarkdown remarkPlugins={[remarkGfm]} components={{
    h1: ({ children }) => <h3 className="mb-3 mt-6 text-title font-[var(--font-weight-strong)] text-[color:var(--color-text-primary)]">{children}</h3>,
    h2: ({ children }) => <h3 className="mb-3 mt-6 text-title font-[var(--font-weight-strong)] text-[color:var(--color-text-primary)] first:mt-0">{children}</h3>,
    h3: ({ children }) => <h4 className="mb-2 mt-4 text-body font-[var(--font-weight-strong)] text-[color:var(--color-text-primary)]">{children}</h4>,
    p: ({ children }) => <p className="my-3 break-words text-body-lg leading-prose text-[color:var(--color-text-secondary)]">{children}</p>,
    ul: ({ children }) => <ul className="my-3 list-disc pl-5 text-body-lg leading-prose text-[color:var(--color-text-secondary)]">{children}</ul>,
    ol: ({ children }) => <ol className="my-3 list-decimal pl-5 text-body-lg leading-prose text-[color:var(--color-text-secondary)]">{children}</ol>,
    li: ({ children }) => <li className="my-2 break-words">{children}</li>,
    a: ({ href, children, ...rest }) => {
      if (!href || !href.startsWith(WIKILINK_SENTINEL)) {
        return <span className="break-words underline decoration-dotted" {...rest}>{children}</span>;
      }

      const spec = href.slice(WIKILINK_SENTINEL.length);
      const [rawWikiSlug, rawAnchor] = spec.split('#');
      const citation = rawWikiSlug
        ? resolveSourceCitation(
            rawWikiSlug,
            rawAnchor,
            normalizedOriginalPaths,
            true,
          )
        : null;

      if (!citation) {
        return <span className="break-words underline decoration-dotted" {...rest}>{children}</span>;
      }

      const resolvedPath = citation.path;
      if (citation.status === 'known' && resolvedPath) {
        return (
          <button
            type="button"
            aria-label={sourceT('sourceCitationTitle', {
              path: resolvedPath,
              anchor: citation.anchor ? `#${citation.anchor}` : '',
            })}
            data-source-path={resolvedPath}
            data-source-anchor={citation.anchor}
            onClick={() => onOpenSource(resolvedPath, citation.anchor)}
            className={controlClass({
              shape: 'link',
              tone: 'accent',
              hoverInk: 'strong',
              className: 'inline align-baseline break-keep whitespace-normal',
            })}
          >
            {children}
          </button>
        );
      }

      return (
        <span
          className="border-b border-dashed border-[color:var(--color-amber-source-a50)] text-[color:var(--color-amber-source-text-a85)]"
          title={sourceT(
            citation.status === 'missing'
              ? 'sourceCitationMissing'
              : 'sourceCitationUnavailable',
            { path: citation.rawPath },
          )}
          {...rest}
        >
          {children}
        </span>
      );
    },
    pre: ({ children }) => <pre className="my-3 overflow-x-auto whitespace-pre-wrap break-words text-body leading-body">{children}</pre>,
  }}>{rewriteWikilinks(parseFrontmatter(text).body)}</ReactMarkdown>;
}

export function AnswerRevisionComparison({ open, question, before, after, problems, error, saving, onClose, onSave, onOpenSource, knownOriginalPaths, t }: {
  open: boolean;
  question: string;
  before: string;
  after: string;
  problems: ReadonlyArray<{ code: string; message: string }>;
  error: string | null;
  saving: boolean;
  onClose: () => void;
  onSave: () => void;
  /** Opens a known source at the cited anchor, when one is present. */
  onOpenSource: (path: string, anchor?: string) => void;
  /** Source paths the current Library surface can navigate to. */
  knownOriginalPaths?: ReadonlySet<string>;
  t: ReturnType<typeof useTranslations<'library'>>;
}) {
  const [mobileSide, setMobileSide] = useState<'before' | 'after'>('after');
  const narrow = useViewportBelow(LG_BREAKPOINT_PX);
  const originals = (raw: string) => {
    const sources = parseFrontmatter(raw).frontmatter.sources;
    return Array.isArray(sources) ? sources.filter((path): path is string => typeof path === 'string') : [];
  };
  const oldSources = originals(before), newSources = originals(after);
  const added = newSources.filter((path) => !oldSources.includes(path));
  const removed = oldSources.filter((path) => !newSources.includes(path));
  const newLines = new Set(parseFrontmatter(after).body.split('\n').map((line) => line.trim()));
  const removedLines = parseFrontmatter(before).body.split('\n').map((line) => line.trim())
    .filter((line) => line && !line.startsWith('#') && !newLines.has(line));
  return (
    <Dialog open={open} onClose={saving ? () => {} : onClose} size="viewport" initialFocus="container" labelledBy="answer-comparison-title" testId="answer-comparison" className="flex flex-col gap-4">
      <header className="flex-none">
        <h2 id="answer-comparison-title" className="text-display font-[var(--font-weight-signature)] leading-title text-[color:var(--color-text-primary)]">{t('answers.compareTitle')}</h2>
        <p className="mt-2 break-words text-body-lg text-[color:var(--color-text-secondary)]">{question}</p>
        <p className="mt-2 text-body leading-body text-[color:var(--color-text-secondary)]">{t('answers.compareHint')}</p>
        {narrow ? <div className="mt-3">
          <SegmentedControl ariaLabel={t('answers.comparisonVersion')} value={mobileSide} onChange={setMobileSide}
            options={[{ value: 'before', label: t('answers.before') }, { value: 'after', label: t('answers.after') }]} />
        </div> : null}
      </header>
      <div className="min-h-0 flex-1 overflow-y-auto" data-testid="answer-comparison-scroll">
        <div className="grid gap-6 lg:grid-cols-2">
          {[{ title: t('answers.before'), text: before, sources: oldSources, id: 'before' }, { title: t('answers.after'), text: after, sources: newSources, id: 'after' }].filter((pane) => !narrow || mobileSide === pane.id).map((pane) => (
            <section key={pane.id} data-testid={`answer-comparison-${pane.id}`} className="min-w-0 border-t border-[color:var(--color-divider)] pt-4">
              <h3 className="text-title font-[var(--font-weight-strong)] text-[color:var(--color-text-primary)]">{pane.title}</h3>
              <div className="my-3 flex flex-wrap gap-2">
                {pane.sources.map((path) => <Button key={path} size="sm" variant="ghost" onClick={() => onOpenSource(path)} className="atlas-touch-floor max-w-full" title={path}><span className="truncate">{path}</span></Button>)}
              </div>
              <RevisionText
                text={pane.text}
                knownOriginalPaths={knownOriginalPaths}
                onOpenSource={onOpenSource}
              />
              <Disclosure className="mt-4" summary={t('answers.rawText')}>
                <pre className="mt-2 overflow-x-auto whitespace-pre-wrap break-words text-caption leading-body text-[color:var(--color-text-secondary)]">{pane.text}</pre>
              </Disclosure>
            </section>
          ))}
        </div>
        <div className="mt-6 border-t border-[color:var(--color-divider)] pt-4 text-body leading-body text-[color:var(--color-text-secondary)]">
          <p>{added.length || removed.length ? t('answers.sourceDelta', { added: added.length, removed: removed.length }) : t('answers.sameSources')}</p>
          {removedLines.length ? <Disclosure className="mt-3" summary={t('answers.removedLines', { count: removedLines.length })}>
            <ul className="mt-2 list-disc space-y-2 pl-5">{removedLines.map((line, index) => <li key={index} className="break-words">{line}</li>)}</ul>
          </Disclosure> : null}
          <p className="mt-3">{t('answers.provenance')}</p>
        </div>
      </div>
      {problems.length || error ? <div role="alert" className="flex-none text-body leading-body text-[color:var(--color-text-primary)]">
        {error ? <p>{error}</p> : null}
        {problems.map((problem) => <p key={problem.code}>{problem.message}</p>)}
      </div> : null}
      <footer className="flex flex-none flex-wrap justify-end gap-2 border-t border-[color:var(--color-divider)] pt-3">
        <Button className="atlas-touch-floor max-w-full" size="sm" variant="ghost" onClick={onClose} disabled={saving}>{t('answers.closeCompare')}</Button>
        <Button className="atlas-touch-floor max-w-full" size="sm" variant="primary" onClick={onSave} disabled={saving || problems.length > 0} data-testid="answer-revision-save">{t(saving ? 'answers.phase.saving' : 'answers.saveDraft')}</Button>
      </footer>
    </Dialog>
  );
}
