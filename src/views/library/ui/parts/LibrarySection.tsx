"use client";

import { useState, type ReactNode } from "react";
import type { useTranslations } from "next-intl";

import { Link } from "@/i18n/navigation";
import {
  BookText,
  Check,
  CloudDownload,
  FilePlus2,
  FileText,
  Search,
  Sparkles,
  Stethoscope,
} from "lucide-react";

import { formatSourceBytes, type LibrarySourceRow } from "@/entities/docs-vault";
import { isMapKind, type LintNodeCandidate } from "@/features/library";
import type { LibraryIndexSegment } from "@/shared/lib/appearance-preferences";
import { cn } from "@/shared/lib/cn";
import { badgeClass } from "@/shared/ui/badge-class";
import { writerLabel } from "../../lib/writer-label";
import { localizeWikiLogSummary } from "../../lib/wiki-log-summary";
import { controlClass } from "@/shared/ui/control-class";
import { Chip, RowButton, Tooltip } from "@/shared/ui";
import { ICON_SIZE } from "@/shared/ui/icon-size";

import { isAdvisoryWikiCode, isWikiFolderCode } from "../../lib/merge-wiki-verdict";
import { libraryWaitingLine } from "../../lib/stage-steps";
import type { LibraryUiModel } from "../../lib/use-library-model";

/**
 * The library's index: **Sources** or **Wiki**, one of them at a time.
 *
 * A vault holds three kinds of file and only one is the graph (`docs/DECISIONS.md`,
 * 2026-09-05). Docs draws the third kind; this column draws the other two, in the order of
 * the work — what a person brought in, then what was made of it.
 *
 * ## Why it is a switch and not a scroll (owner, 2026-09-07)
 *
 * > *"I hate this structure: sources on top, wiki underneath, one long scroll. A switch at
 * > the top is better."*
 *
 * The stacking survived two redesigns. On 2026-09-06 the two lists stopped owning separate
 * overflows and became one scroller with sticky heads, which fixed the cut rows; it did not
 * fix what the owner was actually reading, because a folder of seven sources and seven
 * pages is still 14 rows plus two heads plus five chips plus three captions in a 280px
 * column — measured on the installed app, reaching the wiki list meant scrolling past
 * everything about sources, and the Compile press was off screen from the source rows it
 * acts on.
 *
 * So the column names both lists once, with their counts, in one segmented control at its
 * top (`LibraryPage` draws it) and this file draws **one** of them. Nothing about the
 * inactive list is rendered — not its rows, not its head, not its doors — so the column's
 * whole height belongs to the list a person chose, and the doors on screen are the ones
 * that act on it.
 *
 * ⚠️ **The section head lost its label row.** With the switch naming the list and its
 * count directly above, an eyebrow repeating *SOURCES · 7* under a segment reading
 * *Sources 7* is the same fact twice in 28px. What stays is the actions row, because the
 * doors are not named anywhere else.
 *
 * ⚠️ This also retires the `lg` / below-`lg` split. The narrow layout had already been
 * forced onto one scroller in 2026-09-06 (two lists in half a phone measured 30px and
 * **zero**); the switch is the same answer at every width, which is one answer instead of
 * two.
 *
 * **Sources is the only list here whose rows are not documents.** A row is a file Atlas
 * has never opened: its name, its format, its size, and one word about whether anybody has
 * written it up. That last word is the whole reason the section exists — a folder of PDFs
 * with no state is a folder of PDFs.
 *
 * | State | Means | How it is drawn |
 * |---|---|---|
 * | not compiled | no wiki page cites it | a quiet chip: it is work still to do |
 * | compiled | a page cites it and its sha256 still matches | a **check**, no chip |
 * | stale | the hashes disagree, or a page cites it with no hash | an amber chip: it needs attention |
 * | checking | cited, hash recorded, not yet measured | a quiet word; a claim nothing has verified is not shown as verified |
 *
 * ⚠️ **`compiled` lost its chip on 2026-09-06** and that is the point of the table. It
 * carried the success tone, and on the owner's folder every one of seven rows wore the
 * same green pill — a badge that never varies is not a state, it is a texture, and it was
 * the loudest thing in the column. A chip is now spent only where a person can act:
 * stale, off-template, not yet written up. Success is a check in the row's own ink.
 */

/** Candidate rows drawn before the list folds; the rail's height at 14 inches fits five with the wiki list above. */
const CANDIDATE_FOLD = 5;

export interface LibrarySectionProps {
  model: LibraryUiModel;
  selectedSlug: string | null;
  onSelect: (slug: string) => void;
  /** Opens a raw source: the browser hands the file over, the app reveals it in Finder. */
  onOpenSource: (row: LibrarySourceRow) => void;
  /**
   * The source the reader is showing, if any.
   *
   * Measured 2026-09-06 (design-interaction): a selected source row was byte-identical to
   * a resting one — same ink, no fill, no `aria-current` — while the reader beside it was
   * showing that very file.
   */
  selectedSourcePath: string | null;
  /** The one-click "add files" door. */
  onAddFiles: () => void;
  /** Proposes candidates from the open folder and any bound project root. */
  onFindDocuments: () => void;
  /**
   * The third door: **documents that are not on this computer yet.**
   *
   * Owner, 2026-09-07: *"connecting a service is mostly for the Library anyway — people want the
   * things they already wrote somewhere else."* Add files and Find documents both assume the
   * document is already on disk, and for a person whose notes live in Notion neither one is a
   * door at all. It sits third because it is the one that reaches outside.
   */
  onImportFromService: () => void;
  /** Starts one in-app agent turn that writes the pages. Absent when no agent can run. */
  onCompile: (() => void) | null;
  /** Starts the report-only health check; null where no agent can run, like Compile. */
  onLint: (() => void) | null;
  /** Names the last check found with no page of their own — offered as ontology node candidates. */
  candidates: readonly LintNodeCandidate[];
  /** Starts one agent turn that proposes the candidate through the ontology-write card; null like the others. */
  onPropose: ((candidate: LintNodeCandidate) => void) | null;
  /** Whether `wiki/_template.md` exists: without it the empty state says how to get one. */
  hasWikiTemplate?: boolean;
  /**
   * The brain picker, when this computer offers two and Compile can therefore be pointed
   * at either. Null draws nothing: with one brain there is no choice to make.
   */
  brainControl?: ReactNode;
  /**
   * **One caption under the Compile button, and only one** (2026-09-06).
   *
   * The column used to end with the transfer sentence, pinned under a cut-off list, three
   * hundred pixels from the button it described. The rule that replaces it is the one
   * `.claude/rules/local-first.md` actually asks for: the disclosure sits where Compile can
   * be pressed. So this slot carries whichever single fact is true of pressing it here —
   * the reason it cannot run, or what leaves this computer when it does — and it is empty
   * while the guide is open, because step two is then the surface a person is reading and
   * exactly one of the two may print it.
   */
  compileNote: string | null;
  /**
   * Which of the two lists this column is showing. There is no "both": the switch above
   * is exclusive, and rendering the inactive list `hidden` would leave its rows in the tab
   * order and its doors reachable from the keyboard while nothing on screen names them.
   */
  segment: LibraryIndexSegment;
  busy: boolean;
  t: ReturnType<typeof useTranslations<"library">>;
}

/**
 * **The doors, and nothing that repeats the switch** (2026-09-05, 2026-09-06, 2026-09-07).
 *
 * The first build put the label and both action chips on one row. At the column's 280px
 * the two chips took the width and the eyebrow truncated to `SO…` — the section lost its
 * name to its buttons. Actions therefore sat on a second row under a `sticky` eyebrow.
 *
 * The eyebrow is gone with the stacking (2026-09-07). The segmented control at the top of
 * the column is the head now: it names the list and carries its count, it is the control a
 * person just pressed to get here, and it does not scroll away, so a second head 28px under
 * it printed the same fact twice and spent the height on it. `sticky` goes with it — there
 * is nothing left to pin.
 */
function SectionActions({ children }: { children?: ReactNode }) {
  if (!children) return null;
  return <div className="flex flex-wrap items-center gap-1 px-3 pb-2">{children}</div>;
}

/**
 * One state word. Geometry comes from the badge primitive; the colour is this site's own
 * verdict, which is the split `badge-class.ts` documents in its own header.
 */
function StateBadge({
  tone,
  children,
  testId,
}: {
  tone: "neutral" | "warning";
  children: ReactNode;
  testId?: string;
}) {
  return (
    <span
      data-testid={testId}
      className={badgeClass({
        shape: "micro",
        className: cn(
          "flex-none border",
          tone === "warning"
            ? "border-[color:var(--color-amber-source-a35)] bg-[color:var(--color-amber-source-a12)] text-[color:var(--color-amber-source-a90)]"
            : "border-[color:var(--color-border-soft)] text-[color:var(--color-text-quaternary)]",
        ),
      })}
    >
      {children}
    </span>
  );
}

/** The log's ISO stamp as a person reads it; the raw stamp when it does not parse. */
function logWhen(at: string): string {
  const date = new Date(at);
  if (Number.isNaN(date.getTime())) return at;
  return date.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

/** One line of counting under a list. `text-caption`, because it is a footnote to rows. */
function ListNote({ testId, children }: { testId: string; children: ReactNode }) {
  return (
    <p
      data-testid={testId}
      className="px-3 pt-1 text-caption leading-body text-[color:var(--color-text-quaternary)] [word-break:keep-all]"
    >
      {children}
    </p>
  );
}

export function LibrarySection({
  model,
  selectedSlug,
  onSelect,
  onOpenSource,
  selectedSourcePath,
  onAddFiles,
  onFindDocuments,
  onImportFromService,
  onCompile,
  onLint,
  candidates,
  onPropose,
  hasWikiTemplate = true,
  brainControl,
  compileNote,
  segment,
  busy,
  t,
}: LibrarySectionProps) {
  /*
   * A long candidate list pushed the wiki pages off the rail (installed app, 2026-09-07:
   * ten names). Five rows show — the map kinds first, since those carry the one door
   * this list has — and the rest fold behind a count a person can open.
   */
  const [candidatesOpen, setCandidatesOpen] = useState(false);
  const orderedCandidates = [...candidates].sort((a, b) => Number(isMapKind(b.kind)) - Number(isMapKind(a.kind)));
  const shownCandidates = candidatesOpen ? orderedCandidates : orderedCandidates.slice(0, CANDIDATE_FOLD);
  const foldedCandidates = orderedCandidates.length - shownCandidates.length;
  const hasSources = model.sources.length > 0;
  const hasWiki = model.wikiPages.length > 0;
  /** What is still waiting, in words — the same line step two's caption prints. */
  const waitingLine = libraryWaitingLine(model, t);
  /** Pages whose **own** shape misses the template — the rows that wear the amber pill. */
  const offTemplateRows = [...model.verdicts.values()].filter((verdict) =>
    verdict.problems.some((problem) => !isWikiFolderCode(problem.code)),
  ).length;

  if (segment === "sources") {
    return (
      /* No `min-h-0` and no overflow: the column above owns the one scroller, and a
         section that could shrink is a section that can cut a row in half. */
      <section data-testid="library-sources" className="flex flex-col pb-1 pt-3">
        <SectionActions>
          <Tooltip content={t("sources.addTooltip")}>
            <Chip
              data-testid="library-add-files"
              onClick={onAddFiles}
              disabled={busy}
              tone="muted"
              className="flex-none hover:text-[color:var(--color-text-primary)]"
              aria-label={t("sources.addTooltip")}
            >
              <FilePlus2 size={ICON_SIZE.sm} aria-hidden />
              <span className="min-w-0 truncate">{t("sources.add")}</span>
            </Chip>
          </Tooltip>
          <Tooltip content={t("sources.findTooltip")}>
            <Chip
              data-testid="library-find-documents"
              onClick={onFindDocuments}
              disabled={busy}
              tone="muted"
              className="flex-none hover:text-[color:var(--color-text-primary)]"
              aria-label={t("sources.findTooltip")}
            >
              <Search size={ICON_SIZE.sm} aria-hidden />
              <span className="min-w-0 truncate">{t("sources.find")}</span>
            </Chip>
          </Tooltip>
          <Tooltip content={t("sources.importTooltip")}>
            <Chip
              data-testid="library-import-open"
              onClick={onImportFromService}
              disabled={busy}
              tone="muted"
              className="flex-none hover:text-[color:var(--color-text-primary)]"
              aria-label={t("sources.importTooltip")}
            >
              <CloudDownload size={ICON_SIZE.sm} aria-hidden />
              <span className="min-w-0 truncate">{t("sources.import")}</span>
            </Chip>
          </Tooltip>
        </SectionActions>

        {hasSources ? (
          <>
            <ul
              data-testid="library-source-list"
              aria-label={t("sources.listAria")}
              className="flex flex-col gap-0.5 px-2"
            >
              {model.sources.map((row) => {
                const active = row.path === selectedSourcePath;
                const stateLabel = t(`sources.state.${row.state}.label`);
                return (
                  <li key={row.path}>
                    <RowButton
                      active={active}
                      aria-current={active ? "true" : undefined}
                      data-testid={`library-source-${row.path}`}
                      onClick={() => onOpenSource(row)}
                      // The full name first: a 280px column truncates, and the row's own
                      // hover text is the only place the rest of the name exists.
                      title={`${row.name}\n${t(`sources.state.${row.state}.hint`, {
                        pages: row.citedBy.join(", ") || t("sources.state.nobody"),
                      })}`}
                      className="group relative hover:bg-[color:var(--color-overlay-1)] hover:text-[color:var(--color-text-primary)]"
                    >
                      {/* The same leading glyph the tree, pinned and recent rows carry, so
                          the sidebar keeps one left edge from top to bottom. */}
                      <FileText size={ICON_SIZE.sm} className="flex-none opacity-60" aria-hidden />
                      <span className="min-w-0 flex-1 truncate">{row.name}</span>
                      {/* Format and size are the two facts a directory listing already
                          holds, and the reason the row can exist without opening the file. */}
                      <span className="flex-none font-mono text-caption tabular-nums text-[color:var(--color-text-quaternary)]">
                        {row.format ? row.format.toUpperCase() : t("sources.noFormat")} ·{" "}
                        {formatSourceBytes(row.bytes)}
                      </span>
                      {row.state === "compiled" ? (
                        /*
                         * A check, not a pill. The word is still announced — the glyph is
                         * `aria-hidden` and the label rides with it in `sr-only`, so a
                         * screen reader hears "compiled" exactly as it did before, while
                         * the eye is left to find the rows that are **not** done.
                         */
                        <span
                          data-testid="library-source-state-compiled"
                          className="flex flex-none items-center text-[color:var(--color-text-quaternary)]"
                        >
                          <Check size={ICON_SIZE.sm} aria-hidden />
                          <span className="sr-only">{stateLabel}</span>
                        </span>
                      ) : row.state === "checking" ? (
                        <span
                          data-testid="library-source-state-checking"
                          className="flex-none text-caption text-[color:var(--color-text-quaternary)]"
                        >
                          {stateLabel}
                        </span>
                      ) : (
                        /*
                         * ⚠️ **Amber marks a row to act on, not a page that is wrong**
                         * (owner, 2026-09-07). `partial` shipped in the quiet border on the
                         * reasoning that the page is right about everything it says — but
                         * the shelf counts it with the waiting sources and Compile will act
                         * on it, and a neutral chip on such a row reads as *nothing to do*.
                         * So it wears the amber `stale` wears, and the two are told apart
                         * by their words (`read in part` against `stale`), which is the
                         * fact rather than a temperature. `not-compiled` keeps the quiet
                         * border: nothing is wrong there and nobody has started.
                         */
                        <StateBadge
                          tone={
                            row.state === "stale" || row.state === "partial"
                              ? "warning"
                              : "neutral"
                          }
                          testId={`library-source-state-${row.state}`}
                        >
                          {stateLabel}
                        </StateBadge>
                      )}
                    </RowButton>
                  </li>
                );
              })}
            </ul>
            {waitingLine ? (
              <ListNote testId="library-needs-compile">{waitingLine}</ListNote>
            ) : null}
          </>
        ) : (
          <p
            data-testid="library-sources-empty"
            className="px-3 pb-1 text-caption leading-body text-[color:var(--color-text-tertiary)] [word-break:keep-all]"
          >
            {t("sources.empty")}
          </p>
        )}
      </section>
    );
  }

  return (
    <section data-testid="library-wiki" className="flex flex-col pb-1 pt-3">
      <SectionActions>
        {onCompile || onLint ? (
          <>
            {/*
              **The two doors share one line, reading before writing.** The span does not
              wrap, so `Check the wiki` and `Compile` stay on the same row at 280px and the
              check is to the left — the order of the work, and the geometry
              `library-lint-dock.spec.ts` measures. The picker below may take a line of its
              own; it is what the press will run on, not a third door.
            */}
            <span className="flex min-w-0 items-center gap-1">
              {onLint ? (
                // The judgement half of the health check: what `wiki-validate` cannot
                // decide (two pages disagreeing, a claim a later page replaced). Report
                // only, so it needs no page count to be worth pressing — one page has
                // nothing to disagree with, hence two.
                <Tooltip content={t("wiki.lintTooltip")}>
                  <Chip
                    data-testid="library-lint"
                    onClick={onLint}
                    disabled={busy || model.wikiPages.length < 2}
                    tone="muted"
                    className="flex-none hover:text-[color:var(--color-text-primary)]"
                    aria-label={t("wiki.lintTooltip")}
                  >
                    <Stethoscope size={ICON_SIZE.sm} aria-hidden />
                    <span className="min-w-0 truncate">{t("wiki.lint")}</span>
                  </Chip>
                </Tooltip>
              ) : null}
              {onCompile ? (
                <Tooltip content={t("wiki.compileTooltip")}>
                  <Chip
                    data-testid="library-compile"
                    onClick={onCompile}
                    disabled={busy || model.needsCompileCount === 0}
                    tone="muted"
                    className="flex-none hover:text-[color:var(--color-text-primary)]"
                    aria-label={t("wiki.compileTooltip")}
                  >
                    <Sparkles size={ICON_SIZE.sm} aria-hidden />
                    <span className="min-w-0 truncate">{t("wiki.compile")}</span>
                  </Chip>
                </Tooltip>
              ) : null}
            </span>
            {/* The picker is what the buttons beside it will run on; a control on its own
                row reads as a setting rather than as part of the press. */}
            {brainControl ? (
              <span data-testid="library-brain-control" className="min-w-0 flex-1">
                {brainControl}
              </span>
            ) : null}
          </>
        ) : null}
      </SectionActions>

      {/*
        **Compile is app-only, so the web says so instead of describing it.** The
        degradation grammar in `.claude/rules/surfaces.md`: why it is unavailable, where
        it works, and what still works here (the pages read and edit exactly as they do
        in the app). It is the same slot as `compileNote`, and only one can be true.
      */}
      {/*
        **What happened last, from the app's own record** (`wiki/_log.md`, PR #1486). One
        caption, two facts at most: the last Compile and the last Check, each with its
        time. `text-label` rather than `text-caption` — 9.5px is this product's
        uppercase-eyebrow size, and this is a sentence a person reads to decide whether to
        press anything at all.
      */}
      {model.log.lastCompile || model.log.lastLint ? (
        <p
          data-testid="library-wiki-log"
          className="px-3 pb-1 text-label leading-body text-[color:var(--color-text-quaternary)] [word-break:keep-all] [overflow-wrap:anywhere]"
        >
          {model.log.lastCompile
            ? t("wiki.logCompile", {
                when: logWhen(model.log.lastCompile.at),
                summary: localizeWikiLogSummary(model.log.lastCompile.summary, t),
              })
            : null}
          {model.log.lastCompile && model.log.lastLint ? " · " : null}
          {model.log.lastLint
            ? t("wiki.logLint", {
                when: logWhen(model.log.lastLint.at),
                summary: localizeWikiLogSummary(model.log.lastLint.summary, t),
              })
            : null}
        </p>
      ) : null}

      {onCompile === null ? (
        <p
          data-testid="library-compile-web-limit"
          className="px-3 pb-1 text-label leading-body text-[color:var(--color-text-tertiary)] [word-break:keep-all]"
        >
          {t("wiki.compileWebLimit")}{" "}
          <Link
            href="/download"
            data-testid="library-compile-web-get-app"
            className={controlClass({
              shape: "link",
              hoverInk: "strong",
              className: "rounded-chip px-1.5 py-0.5",
            })}
          >
            {t("wiki.compileWebGetApp")}
          </Link>
        </p>
      ) : compileNote ? (
        <p
          data-testid="library-transfer"
          className="px-3 pb-1 text-label leading-body text-[color:var(--color-text-quaternary)] [word-break:keep-all] [overflow-wrap:anywhere]"
        >
          {compileNote}
        </p>
      ) : null}

      {hasWiki ? (
        <>
          <ul
            data-testid="library-wiki-list"
            aria-label={t("wiki.listAria")}
            className="flex flex-col gap-0.5 px-2"
          >
            {model.wikiPages.map((page) => {
              const active = page.slug === selectedSlug;
              const verdict = model.verdicts.get(page.slug);
              /*
               * **Two kinds of finding, drawn two ways** (2026-09-07). A page that misses
               * the wiki template wears the amber pill it always has: the fix is in that
               * page's own bytes. A folder finding — a link that goes nowhere, a page
               * nothing links to, a shared source neither page links across — is about
               * where the page sits, and on a young wiki it is true of nearly every row.
               * A pill on every row is the texture the `compiled` badge was removed for
               * one list up, so it is a quiet word instead, and the header strip carries
               * the count once.
               *
               * ⚠️ **Only the folder findings a person can act on reach the row.** With
               * the advisory ones drawn too, the owner's seven-page folder wore the word
               * seven times (measured 2026-09-07) — `orphan-page` is true of every page
               * on a wiki whose pages have not been linked yet, which is the reason
               * `mergeWikiVerdict` already refuses to let it flip `ok`. Those reach a
               * person through the Check-the-wiki report instead, where a judgement
               * about the whole wiki belongs.
               */
              const problems = verdict?.problems ?? [];
              const ownProblem = problems.find((problem) => !isWikiFolderCode(problem.code));
              const folderProblem = problems.find(
                (problem) => isWikiFolderCode(problem.code) && !isAdvisoryWikiCode(problem.code),
              );
              const reason = verdict && problems.length > 0 && verdict.firstProblem
                ? t("wiki.offTemplateReason", { code: verdict.firstProblem })
                : undefined;
              return (
                <li key={page.slug}>
                  <RowButton
                    active={active}
                    aria-current={active ? "true" : undefined}
                    data-testid={`library-wiki-${page.slug}`}
                    onClick={() => onSelect(page.slug)}
                    /*
                     * The pill says one fixed word; **which** rule the page missed lives
                     * here until the page's own block carries it on screen.
                     * `aria-description` rather than a bare title: a screen reader
                     * announces it with the row, so the reason is not reachable only by
                     * a pointer that hovers.
                     */
                    aria-description={reason}
                    title={reason}
                    className="group relative hover:bg-[color:var(--color-overlay-1)] hover:text-[color:var(--color-text-primary)]"
                  >
                    <BookText size={ICON_SIZE.sm} className="flex-none opacity-60" aria-hidden />
                    <span className="min-w-0 flex-1 truncate">{page.title}</span>
                    <span className="flex-none text-caption text-[color:var(--color-text-quaternary)]">
                      {writerLabel(page.createdBy, t)}
                    </span>
                    {folderProblem ? (
                      <span
                        data-testid="library-wiki-folder-mark"
                        title={folderProblem.message}
                        className="flex-none text-caption text-[color:var(--color-text-quaternary)]"
                      >
                        {t("wiki.folderMark")}
                      </span>
                    ) : null}
                    {ownProblem ? (
                      <StateBadge tone="warning" testId="library-wiki-off-template">
                        {t("wiki.offTemplate")}
                      </StateBadge>
                    ) : null}
                  </RowButton>
                </li>
              );
            })}
          </ul>
          {/*
            The same count the rows draw and the header strip prints. `offTemplateCount`
            on the model counts every page whose merged verdict is not `ok`, and since PR
            #1486 that includes a dangling link — which this list marks with a quiet word
            rather than the amber pill. Measured on the owner's seven-page folder: the
            foot said 2 over one pill (2026-09-07).
          */}
          {offTemplateRows > 0 ? (
            <ListNote testId="library-off-template-count">
              {t("wiki.offTemplateCount", { count: offTemplateRows })}
            </ListNote>
          ) : null}
        </>
      ) : (
        <p
          data-testid="library-wiki-empty"
          className="px-3 pb-1 text-caption leading-body text-[color:var(--color-text-tertiary)] [word-break:keep-all]"
        >
          {hasWikiTemplate ? t("wiki.empty") : t("wiki.emptyNoTemplate")}
        </p>
      )}

      {/*
        **The wiki's candidates for the graph** (PR #1486): a name the last check found on
        three or more pages with no page of its own. Not a page to write — a node to
        propose, and the proposal goes through the same permission card every ontology
        write does.

        It keeps this column's own rhythm rather than the shape it arrived in: the same
        `px-2` list inset and `gap-0.5` between rows as the two lists above it, so a
        reader scrolling one column does not meet a third spacing system at the bottom of
        it. The name still takes its own line — at 280px it truncated to "Timber…" beside
        its own meta (installed app, 2026-09-06) — and the meta and the chip share the
        line beneath.
      */}
      {candidates.length > 0 ? (
        <section
          data-testid="library-candidates"
          aria-label={t("wiki.candidatesHeader", { count: candidates.length })}
          className="flex flex-col px-2 pb-1"
        >
          <p className="px-1 pb-1 text-caption leading-body text-[color:var(--color-text-quaternary)] [word-break:keep-all]">
            {t("wiki.candidatesHeader", { count: candidates.length })}
          </p>
          <ul className="flex flex-col gap-0.5">
            {shownCandidates.map((candidate) => (
              <li
                key={`${candidate.name}\u0000${candidate.pages.join(",")}`}
                data-testid="library-candidate"
                className="flex min-w-0 flex-col gap-0.5 rounded-chip px-1 py-1"
              >
                <span
                  className="text-label leading-body text-[color:var(--color-text-primary)] [word-break:keep-all]"
                  title={candidate.why || undefined}
                >
                  {candidate.name}
                </span>
                <span className="flex min-w-0 items-center gap-2">
                  <span className="min-w-0 flex-1 truncate text-caption text-[color:var(--color-text-quaternary)]">
                    {t(`wiki.candidateKind.${candidate.kind}`)} ·{" "}
                    {t("wiki.candidatePages", { count: candidate.pages.length })}
                  </span>
                  {onPropose && isMapKind(candidate.kind) ? (
                    <Tooltip content={t("wiki.proposeTooltip")}>
                      <Chip
                        data-testid="library-candidate-propose"
                        onClick={() => onPropose(candidate)}
                        disabled={busy}
                        tone="muted"
                        className="flex-none hover:text-[color:var(--color-text-primary)]"
                        aria-label={`${t("wiki.propose")}: ${candidate.name}`}
                      >
                        <span className="min-w-0 truncate">{t("wiki.propose")}</span>
                      </Chip>
                    </Tooltip>
                  ) : null}
                </span>
              </li>
            ))}
          </ul>
          {foldedCandidates > 0 || candidatesOpen ? (
            <Chip
              data-testid="library-candidates-fold"
              tone="muted"
              className="mt-1"
              onClick={() => setCandidatesOpen((open) => !open)}
              aria-expanded={candidatesOpen}
            >
              {candidatesOpen ? t("wiki.candidatesLess") : t("wiki.candidatesMore", { count: foldedCandidates })}
            </Chip>
          ) : null}
        </section>
      ) : null}
    </section>
  );
}
