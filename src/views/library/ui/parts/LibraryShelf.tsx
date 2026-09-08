"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { useTranslations } from "next-intl";

import type { LibraryWikiPage } from "@/entities/docs-vault";
import { cn } from "@/shared/lib/cn";
import { controlClass } from "@/shared/ui/control-class";
import { usePrefersReducedMotion } from "@/shared/lib/use-prefers-reduced-motion";

import {
  readSpineSweepDwellMs,
  SPINE_WIDTH_TOKEN,
  spineFreshness,
  spineWidthStep,
} from "../../lib/spine-shape";
import type { LibraryUiModel } from "../../lib/use-library-model";
import { isWikiFolderCode } from "../../lib/merge-wiki-verdict";
import { writerLabel } from "../../lib/writer-label";

/**
 * **The shelf: what the wiki holds, and how much of it is still true.**
 *
 * The index used to draw wiki pages as a column of identical rows. Every row carried the
 * same glyph, the same ink and the same height, so *"which of these has fallen behind the
 * file it was written from"* — the one question a wiki over a folder of documents keeps
 * asking — could only be answered by opening pages one at a time. The freshness was in
 * the folder the whole time: `source_hash` is exactly that fact, and `vault-library.ts`
 * has derived it per page since the pairing shipped. Nothing on screen spent it.
 *
 * So the resting state of the wiki list is a **shelf**, and a page is a **spine**:
 *
 * | What the eye sees | What it is |
 * |---|---|
 * | every spine the same height | not a fact — a shelf, so nothing reads as a bar chart |
 * | a wider spine | a longer page (`spineWidthStep`, four steps, `--library-spine-width-*`) |
 * | an amber rim on the head | a source moved after this page was written |
 * | a quiet, unfilled spine | **nothing has ever checked this page against a file** |
 * | an amber rim on the foot | the page's own shape misses the wiki template |
 * | an indigo spine | the page open in the reader beside it |
 *
 * ⚠️ **The two ambers are not one state drawn twice.** The head is about the *source*
 * (compile it again); the foot is about the *page's own bytes* (fix the sections). They
 * sit at opposite ends because they are fixed in different places, and the accessible
 * name says which is which in words — a colour is never the only carrier.
 *
 * ⚠️ **Selection and staleness must not be confusable**, which is why they use different
 * hues, different edges and different fills rather than two weights of one mark: an open
 * page is an indigo body with an indigo border, a stale page is a neutral body with an
 * amber rim on its head. A page that is both draws both, and reads as both.
 *
 * ## Search is still a list
 *
 * A shelf is a resting state — a picture of a folder you can compare across. A search
 * result is a ranked answer to a question, and vertical books make a poor answer list, so
 * `LibrarySection` keeps the row list for a non-empty query and this shelf for the rest.
 *
 * ## Compile sweeps, it does not spin
 *
 * A spinner says *something is happening somewhere*. While Compile runs, the thing being
 * worked on is the shelf, so a light steps along it and rests one
 * `--library-spine-sweep-dwell` on each spine. It claims nothing about which page the
 * agent is on — nothing on this screen knows that — only that the shelf is what the turn
 * is about; the line under it says so in words, and that line is the whole signal under
 * reduced motion, where the light does not travel at all.
 */

export interface LibraryShelfProps {
  model: LibraryUiModel;
  pages: readonly LibraryWikiPage[];
  selectedSlug: string | null;
  onSelect: (slug: string) => void;
  /** The writer named on the rows that are the exception; null when every page agrees. */
  majorityWriter: string | null;
  /** True while a Compile turn is in flight: the shelf is what that turn is about. */
  compiling: boolean;
  /**
   * *New page* — the hand action drawn in the list's grammar (council 2026-09-07).
   *
   * It sits **under the board**, not on the shelf: it is not a page, and a book-shaped
   * control that makes a book would be the one mark on this shelf standing for nothing in
   * the folder. Under the board it is still the last thing in the list and still in the
   * list's tab order.
   */
  trailing?: ReactNode;
  t: ReturnType<typeof useTranslations<"library">>;
}

export function LibraryShelf({
  model,
  pages,
  selectedSlug,
  onSelect,
  majorityWriter,
  compiling,
  trailing,
  t,
}: LibraryShelfProps) {
  const reducedMotion = usePrefersReducedMotion();
  const [sweepIndex, setSweepIndex] = useState(0);
  /* Read once, from the token, and kept for the life of the shelf. */
  const dwellRef = useRef<number | null>(null);
  if (dwellRef.current === null) dwellRef.current = readSpineSweepDwellMs();

  /*
   * The light steps on an interval, and the **teardown** is what puts it back at the head
   * of the shelf: a second Compile that resumed halfway along would be saying something
   * about where the first one stopped, which is not a fact. Resetting on the way in
   * instead would be a synchronous `setState` inside an effect — a cascading render, and
   * the lint rule that names it is right.
   */
  useEffect(() => {
    if (!compiling || reducedMotion || pages.length === 0) return undefined;
    const dwell = dwellRef.current ?? 240;
    const id = window.setInterval(
      () => setSweepIndex((current) => (current + 1) % pages.length),
      dwell,
    );
    return () => {
      window.clearInterval(id);
      setSweepIndex(0);
    };
  }, [compiling, pages.length, reducedMotion]);

  const spines = useMemo(
    () =>
      pages.map((page) => {
        const problems = model.verdicts.get(page.slug)?.problems ?? [];
        return {
          page,
          freshness: spineFreshness({ page, writeUpsBySource: model.pairing.writeUpsBySource }),
          widthStep: spineWidthStep(model.pageTexts.get(page.slug)?.length ?? null),
          /** The page's own shape, not the folder's opinion of where it sits. */
          ownProblem: problems.find((problem) => !isWikiFolderCode(problem.code)) ?? null,
        };
      }),
    [model.pageTexts, model.pairing.writeUpsBySource, model.verdicts, pages],
  );

  return (
    <div
      data-testid="library-wiki-list"
      data-compiling={compiling ? (reducedMotion ? "static" : "sweeping") : undefined}
    >
      <ul
        data-testid="library-wiki-shelf"
        aria-label={t("shelf.listAria")}
        aria-busy={compiling || undefined}
        className="flex flex-wrap items-end gap-x-[var(--library-spine-gap)] gap-y-4 px-2 pb-1 pt-2"
      >
        {spines.map(({ page, freshness, widthStep, ownProblem }, index) => {
          const active = page.slug === selectedSlug;
          const lit = compiling && !reducedMotion && index === sweepIndex;
          const writer = (page.createdBy ?? "") !== majorityWriter ? writerLabel(page.createdBy, t) : null;
          /*
           * Everything the spine cannot draw at 26px wide is said here, so the mark and
           * the sentence carry the same facts and neither is the only copy: the whole
           * title (a spine truncates), the freshness in words, the template problem's
           * own code, and the writer where it is the exception.
           */
          const facts = [
            page.title,
            t(`shelf.freshness.${freshness}`),
            ownProblem ? t("wiki.offTemplateReason", { code: ownProblem.code }) : null,
            writer ? t("wiki.writtenBy", { author: writer }) : null,
          ].filter((fact): fact is string => Boolean(fact));
          return (
            <li key={page.slug} className="flex">
              <button
                type="button"
                data-testid={`library-wiki-${page.slug}`}
                data-freshness={freshness}
                data-width-step={widthStep}
                data-sweep={lit ? "lit" : undefined}
                aria-current={active ? "true" : undefined}
                aria-label={facts.join(" · ")}
                title={facts.join("\n")}
                onClick={() => onSelect(page.slug)}
                style={{ width: SPINE_WIDTH_TOKEN[widthStep], height: "var(--library-spine-height)" }}
                /*
                 * **The value layer owns what a control is; this file owns what a spine
                 * is.** `tile` is the one vertical shape in `control-class.ts` — a box
                 * with its label stacked inside it — so the spine takes its border,
                 * radius, focus ring, disabled state and ink tone from there. What the
                 * shape cannot know is the geometry of a book: the width ramp, the one
                 * height, and a foot that is square because the book stands on a board.
                 * Those come from `--library-spine-*` and override the tile's own
                 * padding, which is written for a tile with an icon in it.
                 *
                 * ⚠️ **One ink ladder, four rungs, measured on the panel.** A book with a
                 * body is a book somebody has checked; a body that is only an outline is
                 * a page nothing has been able to check. The first build gave every spine
                 * `--color-overlay-1` (2% white) and the fresh ones disappeared beside
                 * the amber ones — a state that cannot be seen is not a state.
                 *
                 * ⚠️ **The open page's edge is the solid accent, not an alpha step.**
                 * Measured on the panel: the stale head rim is 8.7:1 while a selected
                 * `--color-indigo-line-a35` edge was 1.4 — the page a person had open was
                 * the quietest thing on its own shelf, and WCAG 1.4.11 asks 3:1 of a mark
                 * identifying a state. `--color-indigo-accent` measures 4.96:1 there, on
                 * all four edges, against a 2px cap at one end (ΔE 109.9 between them).
                 */
                className={controlClass({
                  shape: "tile",
                  size: "xs",
                  tone: active ? "strong" : freshness === "unverified" ? "default" : "secondary",
                  /* The ink step under the cursor is the layer's axis, not a hand-written
                     `hover:text-*` — the same rule that keeps 303 other hovers countable. */
                  hoverInk: "strong",
                  className: cn(
                    "group relative flex-none origin-bottom justify-center overflow-hidden rounded-b-none px-0 py-3",
                    "transition-[translate,scale,box-shadow,background-color,border-color,color]",
                    "motion-safe:hover:translate-y-[calc(var(--library-spine-lift)*-1)]",
                    "motion-safe:hover:scale-[var(--library-spine-lift-scale)]",
                    "hover:shadow-[var(--shadow-control-press)]",
                    active
                      ? "border-[color:var(--color-indigo-accent)] bg-[color:var(--color-indigo-a22)]"
                      : freshness === "stale"
                        ? "border-[color:var(--color-amber-source-a35)] bg-[color:var(--color-overlay-2)]"
                        : freshness === "unverified"
                          ? "border-[color:var(--color-border-soft)] bg-transparent"
                          : "border-[color:var(--color-border-soft)] bg-[color:var(--color-overlay-2)]",
                  ),
                })}
              >
                {/*
                  **Compile's light, resting on this spine.**
                  Drawn under the rims, not over them, so a stale book keeps its amber cap
                  while the light is on it — the sweep is about the turn, the rims are
                  about the folder, and one must not paint over the other. It is brighter
                  than any resting fill on this shelf (`--color-indigo-a40` against the
                  open page's `--color-indigo-a22`) because a travelling light and an open
                  page are not the same thing and a still frame has to say which is which;
                  the open page also keeps its solid accent edge, which the light has not.
                */}
                <span
                  aria-hidden
                  className={cn(
                    "pointer-events-none absolute inset-0 bg-[color:var(--color-indigo-a40)] opacity-0 transition-opacity",
                    lit && "opacity-100",
                  )}
                />
                {/* The head rim: this page's source moved after it was written. Static. */}
                {freshness === "stale" ? (
                  <span
                    aria-hidden
                    data-testid="library-spine-stale-rim"
                    className="pointer-events-none absolute inset-x-0 top-0 h-[var(--library-spine-rim)] bg-[color:var(--color-amber-source-a90)]"
                  />
                ) : null}
                {/* The foot rim: the page's own shape misses the template. Static. */}
                {ownProblem ? (
                  <span
                    aria-hidden
                    data-testid="library-spine-off-template-rim"
                    className="pointer-events-none absolute inset-x-0 bottom-0 h-[var(--library-spine-rim)] bg-[color:var(--color-amber-source-a90)]"
                  />
                ) : null}
                {/*
                  The title runs down the book. Its ink is the control's `tone`, so the
                  three states are one ladder the value layer owns rather than three
                  colours written here: strong open, secondary checked, tertiary
                  unverified — 14.3, 11.4 and 5.9 on their own fills, all over the 4.5
                  text floor. A spine truncates in the middle of a long name, so the whole
                  title is in the accessible name above.
                */}
                <span
                  data-spine-title
                  className="relative min-h-0 flex-1 overflow-hidden text-ellipsis whitespace-nowrap text-label leading-body [writing-mode:vertical-rl]"
                >
                  {page.title}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
      {/*
        **The board the books stand on.** It is drawn rather than implied because the
        spines are the only thing on this column that does not fill its width: without a
        line under them a short shelf reads as a row of floating boxes, which is the
        `floating-box soup` the Don'ts refuse. It takes `--color-border-strong` rather
        than the soft step the rest of this column uses: measured at 1512, a 6% rule under
        a 6% spine edge was the same value twice and the books read as standing on
        nothing. While Compile runs it takes the indigo the
        light carries, so the reduced-motion reader — for whom nothing travels — still has
        the shelf itself marked as the thing being worked on.
      */}
      <div
        aria-hidden
        data-testid="library-shelf-board"
        className={cn(
          "mx-2 h-px transition-colors",
          compiling ? "bg-[color:var(--color-indigo-a40)]" : "bg-[color:var(--color-border-strong)]",
        )}
      />
      {compiling ? (
        <p
          role="status"
          data-testid="library-shelf-compiling"
          className="px-3 pt-1.5 text-caption leading-body text-[color:var(--color-text-tertiary)] [word-break:keep-all]"
        >
          {t("shelf.compiling")}
        </p>
      ) : null}
      {trailing ? <div className="px-2 pt-1.5">{trailing}</div> : null}
    </div>
  );
}
