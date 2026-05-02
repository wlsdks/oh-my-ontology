'use client';

import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { FolderOpen, GitBranch } from 'lucide-react';

/**
 * Topology empty-state — when the graph has 0–1 projects, showing the
 * lone Sigma dot tells the user "this page is broken" rather than "this
 * page has no edges yet" (eval finding B3, 2026-05-02). Displays a
 * Toss-quality card with one explanatory sentence and two recovery CTAs.
 *
 * Mirrors the mobile builder empty-state copy pattern that the eval
 * agent specifically called out as Toss/Apple-grade.
 */
export function TopologyEmptyState({ projectCount }: { projectCount: number }) {
  const t = useTranslations('topology.empty');
  const isNoProjects = projectCount === 0;

  return (
    <div className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center px-6">
      <div className="pointer-events-auto max-w-md rounded-2xl border border-[color:var(--color-divider)] bg-[color:var(--color-panel)] p-8 text-center shadow-[0_18px_48px_rgba(0,0,0,0.35)]">
        <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-[color:var(--color-text-quaternary)]">
          {t('kicker', { count: projectCount })}
        </p>
        <h2 className="mt-3 text-[20px] font-[var(--font-weight-signature)] text-[color:var(--color-text-primary)]">
          {isNoProjects ? t('titleNoProjects') : t('titleNoDeps')}
        </h2>
        <p className="mt-2 text-[13px] leading-relaxed text-[color:var(--color-text-tertiary)]">
          {isNoProjects ? t('bodyNoProjects') : t('bodyNoDeps')}
        </p>
        <div className="mt-6 flex flex-col items-stretch gap-2 sm:flex-row sm:justify-center">
          <Link
            href="/ontology/edit/"
            className="inline-flex h-9 items-center justify-center gap-1.5 rounded-md border border-[color:rgba(94,106,210,0.4)] bg-[color:rgba(94,106,210,0.14)] px-4 text-[12px] font-[var(--font-weight-signature)] text-[color:var(--color-text-primary)] transition-colors hover:border-[color:rgba(94,106,210,0.6)] hover:bg-[color:rgba(94,106,210,0.2)]"
          >
            <GitBranch size={14} aria-hidden="true" />
            {t('ctaBuilder')}
          </Link>
          <Link
            href="/docs/"
            className="inline-flex h-9 items-center justify-center gap-1.5 rounded-md border border-[color:var(--color-overlay-3)] px-4 text-[12px] text-[color:var(--color-text-secondary)] transition-colors hover:border-[color:rgba(139,151,255,0.35)] hover:text-[color:var(--color-text-primary)]"
          >
            <FolderOpen size={14} aria-hidden="true" />
            {t('ctaOpenVault')}
          </Link>
        </div>
      </div>
    </div>
  );
}
