'use client';

import { useMemo } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { FileText, Hash, Link2, Pin, Star } from 'lucide-react';
import type { VaultDoc, VaultManifest } from '@/entities/docs-vault';

interface Props {
  manifest: VaultManifest;
  pinnedSlugs: string[];
  onSelect: (slug: string) => void;
}

interface Stats {
  docCount: number;
  totalWords: number;
  avgWords: number;
  medianWords: number;
  biggest: VaultDoc | null;
  modes: Record<'planner' | 'engineer' | 'both', number>;
  topReferenced: Array<{ doc: VaultDoc; count: number }>;
  topOutlinks: Array<{ doc: VaultDoc; count: number }>;
  topTags: Array<{ tag: string; count: number }>;
  orphanCount: number;
  pinnedCount: number;
}

function computeStats(
  manifest: VaultManifest,
  pinnedSlugs: string[],
): Stats {
  const docs = manifest.docs;
  const totalWords = docs.reduce((sum, d) => sum + d.wordCount, 0);
  const avgWords = docs.length > 0 ? Math.round(totalWords / docs.length) : 0;
  const sortedByWords = [...docs].sort((a, b) => a.wordCount - b.wordCount);
  const medianWords =
    sortedByWords.length > 0
      ? sortedByWords[Math.floor(sortedByWords.length / 2)].wordCount
      : 0;
  const biggest =
    sortedByWords.length > 0
      ? sortedByWords[sortedByWords.length - 1]
      : null;

  const modes = { planner: 0, engineer: 0, both: 0 };
  for (const d of docs) modes[d.mode] += 1;

  const bySlug = new Map<string, VaultDoc>();
  for (const d of docs) bySlug.set(d.slug, d);

  const topReferenced = Object.entries(manifest.backlinksDetail ?? {})
    .map(([slug, entries]) => ({ doc: bySlug.get(slug), count: entries.length }))
    .filter((x): x is { doc: VaultDoc; count: number } => x.doc !== undefined)
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  const topOutlinks = docs
    .map((d) => ({ doc: d, count: d.linksOut.length }))
    .filter((x) => x.count > 0)
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  const topTags = Object.entries(manifest.tags)
    .map(([tag, slugs]) => ({ tag, count: slugs.length }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  // orphan = linksOut 0 AND backlinks 0
  const orphanCount = docs.filter(
    (d) =>
      d.linksOut.length === 0 &&
      (manifest.backlinksDetail?.[d.slug]?.length ?? 0) === 0,
  ).length;

  return {
    docCount: docs.length,
    totalWords,
    avgWords,
    medianWords,
    biggest,
    modes,
    topReferenced,
    topOutlinks,
    topTags,
    orphanCount,
    pinnedCount: pinnedSlugs.length,
  };
}

export function DocsVaultStats({ manifest, pinnedSlugs, onSelect }: Props) {
  const t = useTranslations('vaultWidgets.stats');
  const locale = useLocale();
  const numberLocale = locale === 'ko' ? 'ko-KR' : 'en-US';
  const stats = useMemo(
    () => computeStats(manifest, pinnedSlugs),
    [manifest, pinnedSlugs],
  );
  const totalForModes =
    stats.modes.planner + stats.modes.engineer + stats.modes.both;

  return (
    <div className="mx-auto max-w-[960px] px-6 py-8 md:px-10 md:py-10">
      <h2 className="mb-1 text-[22px] font-semibold text-[color:var(--color-text-primary)]">
        {t('title')}
      </h2>
      <p className="mb-8 text-[12.5px] text-[color:var(--color-text-tertiary)]">
        {t('manifestPrefix')}{' '}
        <span className="font-mono">
          {new Date(manifest.generatedAt).toLocaleString(numberLocale)}
        </span>
      </p>

      {/* 핵심 숫자 카드 */}
      <section className="mb-8 grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard label={t('cardDocs')} value={stats.docCount} unit={t('cardUnitDocs')} />
        <StatCard
          label={t('cardTotalWords')}
          value={stats.totalWords.toLocaleString(numberLocale)}
        />
        <StatCard label={t('cardAvgWords')} value={stats.avgWords.toLocaleString(numberLocale)} />
        <StatCard label={t('cardMedian')} value={stats.medianWords.toLocaleString(numberLocale)} />
      </section>

      {/* 모드별 비중 */}
      <section className="mb-8">
        <h3 className="mb-2 font-mono text-[10px] uppercase tracking-[0.14em] text-[color:var(--color-text-quaternary)]">
          {t('modeDistribution')}
        </h3>
        {totalForModes > 0 ? (
          <div className="overflow-hidden rounded-md border border-[color:var(--color-border-soft)]">
            <div className="flex h-5 w-full">
              <ModeBar
                label={t('modePlanner')}
                count={stats.modes.planner}
                total={totalForModes}
                color="rgba(224,196,140,0.75)"
              />
              <ModeBar
                label={t('modeEngineer')}
                count={stats.modes.engineer}
                total={totalForModes}
                color="rgba(139,151,255,0.72)"
              />
              <ModeBar
                label={t('modeBoth')}
                count={stats.modes.both}
                total={totalForModes}
                color="rgba(180,190,210,0.6)"
              />
            </div>
          </div>
        ) : null}
        <div className="mt-2 flex flex-wrap gap-3 text-[11px] text-[color:var(--color-text-tertiary)]">
          <ModeLegend
            label={t('modePlanner')}
            count={stats.modes.planner}
            total={totalForModes}
            color="rgba(224,196,140,0.85)"
          />
          <ModeLegend
            label={t('modeEngineer')}
            count={stats.modes.engineer}
            total={totalForModes}
            color="rgba(139,151,255,0.85)"
          />
          <ModeLegend
            label={t('modeBoth')}
            count={stats.modes.both}
            total={totalForModes}
            color="rgba(180,190,210,0.85)"
          />
        </div>
      </section>

      {/* 두 개 리스트 */}
      <section className="mb-8 grid grid-cols-1 gap-6 md:grid-cols-2">
        <RankList
          title={t('topReferenced')}
          emptyText={t('rankEmpty')}
          icon={<Link2 size={11} />}
          items={stats.topReferenced.map((x) => ({
            slug: x.doc.slug,
            title: x.doc.title,
            count: x.count,
          }))}
          onSelect={onSelect}
        />
        <RankList
          title={t('topOutlinks')}
          emptyText={t('rankEmpty')}
          icon={<Link2 size={11} />}
          items={stats.topOutlinks.map((x) => ({
            slug: x.doc.slug,
            title: x.doc.title,
            count: x.count,
          }))}
          onSelect={onSelect}
        />
      </section>

      {/* 태그 */}
      <section className="mb-8">
        <h3 className="mb-2 flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.14em] text-[color:var(--color-text-quaternary)]">
          <Hash size={10} aria-hidden />
          {t('tagsTopHeader', { count: stats.topTags.length })}
        </h3>
        {stats.topTags.length === 0 ? (
          <p className="text-[12px] text-[color:var(--color-text-tertiary)]">
            {t('tagsEmpty')}
          </p>
        ) : (
          <div className="flex flex-wrap gap-1.5">
            {stats.topTags.map((tagItem) => (
              <span
                key={tagItem.tag}
                className="inline-flex items-center gap-1 rounded-sm border border-[color:var(--color-border-soft)] px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.12em] text-[color:var(--color-text-tertiary)]"
              >
                {tagItem.tag}
                <span className="text-[color:var(--color-text-quaternary)]">
                  {tagItem.count}
                </span>
              </span>
            ))}
          </div>
        )}
      </section>

      {/* 나머지 미니 지표 */}
      <section className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <StatCard
          label={t('pinned')}
          value={stats.pinnedCount}
          unit={t('pinnedUnit')}
          icon={<Pin size={11} aria-hidden />}
        />
        <StatCard
          label={t('orphan')}
          value={stats.orphanCount}
          unit={t('orphanUnit')}
          icon={<FileText size={11} aria-hidden />}
          hint={t('orphanHint')}
        />
        {stats.biggest ? (
          <button
            type="button"
            onClick={() => onSelect(stats.biggest!.slug)}
            className="rounded-md border border-[color:var(--color-border-soft)] bg-[color:var(--color-elevated)] px-3 py-2 text-left transition-colors hover:border-[color:rgba(139,151,255,0.3)]"
          >
            <div className="flex items-center gap-1.5 font-mono text-[9.5px] uppercase tracking-[0.14em] text-[color:var(--color-text-quaternary)]">
              <Star size={10} aria-hidden />
              {t('biggest')}
            </div>
            <div className="mt-1 truncate text-[13px] text-[color:var(--color-text-primary)]">
              {stats.biggest.title}
            </div>
            <div className="font-mono text-[10px] text-[color:var(--color-text-tertiary)]">
              {stats.biggest.wordCount.toLocaleString(numberLocale)} {t('wordsUnit')}
            </div>
          </button>
        ) : null}
      </section>
    </div>
  );
}

function StatCard({
  label,
  value,
  unit,
  icon,
  hint,
}: {
  label: string;
  value: number | string;
  unit?: string;
  icon?: React.ReactNode;
  hint?: string;
}) {
  return (
    <div
      className="rounded-md border border-[color:var(--color-border-soft)] bg-[color:var(--color-elevated)] px-3 py-2"
      title={hint}
    >
      <div className="flex items-center gap-1.5 font-mono text-[9.5px] uppercase tracking-[0.14em] text-[color:var(--color-text-quaternary)]">
        {icon}
        {label}
      </div>
      <div className="mt-1 text-[20px] font-semibold tabular-nums text-[color:var(--color-text-primary)]">
        {value}
        {unit ? (
          <span className="ml-1 text-[12px] font-normal text-[color:var(--color-text-tertiary)]">
            {unit}
          </span>
        ) : null}
      </div>
    </div>
  );
}

function ModeBar({
  label,
  count,
  total,
  color,
}: {
  label: string;
  count: number;
  total: number;
  color: string;
}) {
  const pct = total > 0 ? (count / total) * 100 : 0;
  if (pct === 0) return null;
  return (
    <div
      title={`${label} ${count} · ${pct.toFixed(1)}%`}
      style={{ width: `${pct}%`, backgroundColor: color }}
    />
  );
}

function ModeLegend({
  label,
  count,
  total,
  color,
}: {
  label: string;
  count: number;
  total: number;
  color: string;
}) {
  const pct = total > 0 ? (count / total) * 100 : 0;
  return (
    <span className="inline-flex items-center gap-1.5">
      <span
        className="inline-block h-2 w-2 rounded-full"
        style={{ backgroundColor: color }}
      />
      {label} · {count}{' '}
      <span className="font-mono text-[color:var(--color-text-quaternary)]">
        {pct.toFixed(0)}%
      </span>
    </span>
  );
}

function RankList({
  title,
  emptyText,
  icon,
  items,
  onSelect,
}: {
  title: string;
  emptyText: string;
  icon: React.ReactNode;
  items: Array<{ slug: string; title: string; count: number }>;
  onSelect: (slug: string) => void;
}) {
  return (
    <div>
      <h3 className="mb-2 flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.14em] text-[color:var(--color-text-quaternary)]">
        {icon}
        {title}
      </h3>
      {items.length === 0 ? (
        <p className="text-[12px] text-[color:var(--color-text-tertiary)]">
          {emptyText}
        </p>
      ) : (
        <ul className="flex flex-col gap-0.5">
          {items.map((item, idx) => (
            <li key={item.slug}>
              <button
                type="button"
                onClick={() => onSelect(item.slug)}
                className="flex w-full items-center gap-2 rounded-sm px-2 py-1 text-left text-[12px] transition-colors hover:bg-[color:var(--color-overlay-1)]"
              >
                <span className="w-5 font-mono text-[10px] text-[color:var(--color-text-quaternary)]">
                  {idx + 1}.
                </span>
                <span className="flex-1 truncate text-[color:var(--color-text-secondary)] hover:text-[color:var(--color-text-primary)]">
                  {item.title}
                </span>
                <span className="font-mono text-[10px] tabular-nums text-[color:rgba(139,151,255,0.85)]">
                  {item.count}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
