"use client";

import type { useTranslations } from "next-intl";

import type { VaultHistoryState } from "../../lib/use-vault-history";
import { VaultHistoryTracks } from "./VaultHistoryTracks";
import { InsightsSectionTitle } from "./InsightsSectionTitle";

/**
 * **The weekly counts, or the honest reason there are none.**
 *
 * Four states and three of them draw no chart. That ratio is the point: the series is
 * recomputed from the folder's Git history and Atlas keeps no record of its own, so there
 * are ordinary, blameless situations in which there is nothing to show — the web, where
 * the bridge cannot reach a repository, and a folder nobody has committed in.
 *
 * ⚠️ **"No history" is never drawn as zeroes.** A flat line along the bottom is a claim
 * about the person ("you did nothing") where the truth is a claim about the data ("nothing
 * was recorded"). The PO steward made this a condition of the surface existing at all, and
 * the probe that justified it found the same shape in the data: this repository's own
 * folder shows `wiki` at 0 for its whole history, because the Library shipped three days
 * ago. A zero that means zero and a zero that means "no data" have to look different.
 */
export function VaultHistorySection({
  state,
  t,
}: {
  state: VaultHistoryState;
  t: ReturnType<typeof useTranslations<"ontologyPages.insights">>;
}) {
  const frame = (children: React.ReactNode) => (
    <section
      data-testid="vault-history"
      data-state={state.status}
      aria-label={t("vaultHistory.title")}
      className="flex min-h-0 min-w-0 flex-col rounded-panel border border-[color:var(--color-border-soft)] bg-[color:var(--color-panel)] p-[var(--card-pad)]"
    >
      {/*
        One centred column for the header and the figure together. Eighteen weekly columns
        stretched across a full-width band merged into an area; capped, they read as the
        countable stacks they are — and a header spanning the whole card above a narrower
        figure reads as two unrelated things, so the title and the caption take the figure's
        own edges rather than the card's.
      */}
      <div className="mx-auto flex w-full max-w-[var(--vault-history-width)] flex-col">
      <div className="flex items-baseline gap-2">
        <InsightsSectionTitle
          level={2}
          className="text-body-lg font-[var(--font-weight-signature)] tracking-[var(--tracking-title)] text-[color:var(--color-text-primary)]"
        >
          {t("vaultHistory.title")}
        </InsightsSectionTitle>
        <span className="ml-auto font-mono text-label text-[color:var(--color-text-quaternary)]">
          {t("vaultHistory.caption")}
        </span>
      </div>
      <div className="mt-3 min-h-0 flex-1">{children}</div>
      </div>
    </section>
  );

  if (state.status === "idle" || state.status === "loading") {
    return frame(
      <p className="text-label text-[color:var(--color-text-tertiary)]">
        {t("vaultHistory.loading")}
      </p>,
    );
  }

  // Narrowed to `unavailable | none` by the branch above; both say why, neither draws a
  // chart, and the difference between them is whose limitation it is.
  if (state.status !== "ready") {
    const key = state.status === "unavailable" ? "unavailable" : "none";
    return frame(
      <div className="flex flex-col gap-1">
        <p className="text-body text-[color:var(--color-text-primary)]">
          {t(`vaultHistory.${key}Title` as "vaultHistory.noneTitle")}
        </p>
        <p className="text-label leading-body text-[color:var(--color-text-tertiary)] [word-break:keep-all]">
          {t(`vaultHistory.${key}Body` as "vaultHistory.noneBody")}
        </p>
      </div>,
    );
  }

  return frame(
    <VaultHistoryTracks
      weeks={state.weeks}
      peak={state.peak}
      labels={{
        layer: {
          concept: t("vaultHistory.layerConcept"),
          writeUp: t("vaultHistory.layerWriteUp"),
          document: t("vaultHistory.layerDocument"),
        },
        trackSummary: (layer, latest, earliest) =>
          t("vaultHistory.trackSummary", { layer, latest, earliest }),
        scaleNote: (count) => t("vaultHistory.scaleNote", { count }),
        axisStart: t("vaultHistory.axisStart"),
        axisEnd: t("vaultHistory.axisEnd"),
      }}
    />,
  );
}
