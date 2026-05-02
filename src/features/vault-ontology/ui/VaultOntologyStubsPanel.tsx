'use client';

import { Link } from '@/i18n/navigation';
import { ArrowRight, Sparkles } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useVaultOntology } from '../model/use-vault-ontology';

/**
 * 로컬 vault frontmatter 에서 자란 ontology 노드 *간결 리스트* 패널.
 *
 * 통합 트리 / ego 그래프 와는 별개 — vault 안 .md frontmatter 의 `kind:`
 * 가 즉시 노드로 surface 되는 mission v2 모델 ("vault frontmatter 가 곧
 * 그래프, 검수 단계 없음") 의 가시 증명.
 *
 * 디자인 헌장 안: 단일 인디고 + 무채색, 애니메이션 0.
 */
export function VaultOntologyStubsPanel() {
  const t = useTranslations('featuresMisc.vaultStubs');
  const { nodes, edges, warnings } = useVaultOntology();

  if (nodes.length === 0) {
    return (
      <section
        aria-labelledby="vault-stubs-heading"
        className="rounded-2xl border border-dashed border-[color:var(--color-divider)] bg-[color:var(--color-overlay-1)] px-5 py-6"
      >
        <div className="flex items-center gap-2">
          <Sparkles size={14} className="text-[color:var(--color-text-quaternary)]" aria-hidden />
          <h2
            id="vault-stubs-heading"
            className="font-mono text-[10px] uppercase tracking-[0.18em] text-[color:var(--color-text-quaternary)]"
          >
            {t('headingFallback')}
          </h2>
        </div>
        <p className="mt-3 text-[12.5px] leading-6 text-[color:var(--color-text-tertiary)]">
          {warnings[0] ?? t('emptyBody')}
        </p>
      </section>
    );
  }

  // kind 별 그룹화 — UI 위계 — sorted by kind 알파벳 순.
  const byKind = new Map<string, typeof nodes>();
  for (const n of nodes) {
    if (!byKind.has(n.kind)) byKind.set(n.kind, []);
    byKind.get(n.kind)!.push(n);
  }
  const kinds = [...byKind.keys()].sort();

  return (
    <section
      aria-labelledby="vault-stubs-heading"
      className="rounded-2xl border border-[color:var(--color-divider)] bg-[color:var(--color-overlay-1)] px-5 py-5"
    >
      <header className="flex flex-wrap items-baseline justify-between gap-2">
        <div className="flex items-center gap-2">
          <Sparkles size={14} className="text-[color:var(--color-indigo-accent)]" aria-hidden />
          <h2
            id="vault-stubs-heading"
            className="font-mono text-[10px] uppercase tracking-[0.18em] text-[color:var(--color-indigo-accent)]"
          >
            {t('headingFallback')}
          </h2>
        </div>
        <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-[color:var(--color-text-quaternary)]">
          {t('summary', { nodes: nodes.length, edges: edges.length })}
        </p>
      </header>
      <p className="mt-2 text-[12px] text-[color:var(--color-text-tertiary)]">
        {t('intro')}
      </p>

      {/* 다음 단계 안내 — frontmatter 만으로도 충분하지만 시각적으로 더
          편하게 다듬고 싶을 때의 옵션. mission v2 에서 cloud 검수 큐 promote
          path 가 폐기됐으므로 빌더 한 가지만 명시. */}
      <details className="mt-3 rounded-md border border-[color:var(--color-border-soft)] bg-[color:var(--color-overlay-2)] px-3 py-2 text-[12px] text-[color:var(--color-text-secondary)]">
        <summary className="cursor-pointer font-[var(--font-weight-signature)]">
          {t('polishSummary')}
        </summary>
        <div className="mt-2 space-y-2 text-[color:var(--color-text-tertiary)]">
          <p>{t('polishBody')}</p>
          <Link
            href="/ontology/edit/"
            className="inline-flex h-7 items-center gap-1 rounded-full border border-[color:rgba(94,106,210,0.46)] bg-[color:rgba(94,106,210,0.14)] px-3 text-[11px] text-[color:var(--color-text-primary)] transition-colors hover:border-[color:rgba(94,106,210,0.66)]"
          >
            {t('polishCta')} <ArrowRight size={11} aria-hidden />
          </Link>
        </div>
      </details>

      <div className="mt-4 space-y-4">
        {kinds.map((kind) => {
          const group = byKind.get(kind)!;
          return (
            <div key={kind}>
              <p className="font-mono text-[9.5px] uppercase tracking-[0.18em] text-[color:var(--color-text-quaternary)]">
                {t('groupSummary', { kind, count: group.length })}
              </p>
              <ul className="mt-2 grid gap-1.5 md:grid-cols-2">
                {group.map((n) => (
                  <li
                    key={n.id}
                    className="flex items-center gap-2 rounded-md border border-[color:var(--color-divider)] bg-[color:var(--color-overlay-2)] px-3 py-1.5"
                  >
                    <span className="truncate text-[13px] text-[color:var(--color-text-primary)]">
                      {n.title}
                    </span>
                    <span className="ml-auto font-mono text-[9.5px] uppercase tracking-[0.14em] text-[color:var(--color-text-quaternary)]">
                      {n.sourceSlug}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </div>
    </section>
  );
}
