"use client";

import { useEffect, useRef, useState } from "react";

import { usePrefersReducedMotion } from "@/shared/lib/use-prefers-reduced-motion";
import { cn } from "@/shared/lib/cn";

import { VAULT_LAYERS, type VaultLayer, type VaultLayerCounts } from "../../lib/vault-history";
import { EMPTY_LAYER_RULE, LAYER_INK } from "./VaultHistoryTracks";

/**
 * **What the folder holds now — one block per file, assembling itself.**
 *
 * ## Why this exists
 *
 * The week-by-week tracks need Git, and Git is the installed app. The first build drew
 * nothing whatever in the other three states, so a person in a browser met a paragraph
 * explaining an absence: honest about time, and silent about the folder sitting right
 * there. The owner said it plainly — *"nothing new seems to have appeared on Analysis; or
 * did I not see it?"* They had not missed it. There was nothing to see.
 *
 * ⚠️ **The present is not a weaker history; it is a different claim, and a safe one.** It
 * says how much the folder holds, counted from paths this instant, and asserts nothing
 * about when anything happened — which is exactly why it can be drawn everywhere, with no
 * Git and no timestamps, on a fact that a clone or a checkout cannot move. Where Git *does*
 * answer, this is replaced by the tracks, which say the same thing and say when as well.
 *
 * ## Why one block per file
 *
 * The owner asked for cubes that put themselves together. A block standing for four files
 * is a bar in disguise: it needs a legend, and nothing about it is countable. A block
 * standing for **one file** needs no legend at all — the count is the blocks, the reader
 * can check it by looking, and adding a document to the folder adds a block to the wall.
 * That is what makes the picture accumulate rather than merely measure.
 *
 * Above `BLOCK_CAP` blocks the wall would stop being countable and start being texture, so
 * past that one block carries several files and the figure says so in words. A folder that
 * large has left the range where counting by eye was the point.
 *
 * ## The build
 *
 * Blocks land one at a time, bottom row first, left to right — the reading order of the
 * thing they are building. The 2026 work on perceptual capacity limits puts reliable
 * tracking at roughly four moving objects and prescribes moving them in subsets; one block
 * at a time is the smallest subset there is, so the eye always has exactly one thing to
 * follow. Reduced motion draws the finished wall on the first frame, with no schedule.
 */

/** One list, shared with every aggregate, so a fifth layer cannot be forgotten here. */
const LAYER_ORDER = VAULT_LAYERS;

/*
 * ⚠️ **The block has a size; the number of columns is whatever fits.** The first build fixed
 * fourteen columns and let the block take a fourteenth of whatever width it was given, which
 * held at a desktop width and collapsed at a phone one: measured at 390x844 the block came
 * out **3.6px**, and a 3.6px block is texture, not a thing anybody can count. Since counting
 * is the entire argument for one block per file, the block keeps its size and the wall
 * re-wraps — narrower screens get fewer columns and a taller wall, which is the trade that
 * keeps the mark honest.
 */
/** Past this many blocks the wall stops being countable, and a block starts meaning several files. */
const BLOCK_CAP = 224;
/**
 * How long the whole wall takes to build, however many blocks it holds.
 *
 * ⚠️ **Per-block staging was never what rendered** (design-motion, 2026-09-09). Sampling
 * per-block luminance found **19-20 blocks mid-transition at every instant** — exactly the
 * 180ms gesture divided by the 9ms stride — so what a person saw was a soft luminance
 * wavefront about thirteen blocks wide wiping upward, not blocks being laid. The docblock
 * that cited the four-object tracking limit was describing a schedule, not a picture.
 *
 * It cannot be rescued by retuning: discreteness needs gesture/stride around 2 or less, so
 * even at the shortest legal gesture the stride must be 60ms, and 126 blocks would take 7.6
 * seconds. Per-block staging is arithmetically dead at this cardinality.
 *
 * So the wall builds **row by row**, and the row is the thing the eye was following anyway.
 * The span is fixed rather than per-block, because the old stride made duration a function
 * of folder size: 360ms for forty files, 8.3 seconds for four capped layers, and 45 seconds
 * for an architecture-heavy folder once the missing `module` term is restored. 600ms and not
 * the ~1s of Heer and Robertson's staged transitions, because this is an arrival from
 * nothing rather than a change between two data states: there is no correspondence to track,
 * and it replays on every entry to the tab.
 */
const BUILD_SPAN_MS = 600;
/**
 * Blocks brought up together in one build step.
 *
 * Measured column counts across the bands run 4 (at 320) to 16 (at 1024 and up), so a dozen
 * is about one row at a desktop width and rather more than one on a phone. It is a schedule
 * number, not a layout one: a step's blocks arrive together whatever the wrap does with them,
 * and it is what holds concurrency under the four-object tracking limit at every folder size.
 */
const ROW_ESTIMATE = 12;

export interface VaultPresentStackLabels {
  layer: Record<VaultLayer, string>;
  /** Accessible summary per wall: "concepts: N files". */
  towerSummary: (layer: string, count: number) => string;
  /** Stated only when a block had to stand for more than one file. */
  scaleNote: (filesPerBlock: number) => string;
}

export function VaultPresentStack({
  present,
  labels,
}: {
  present: VaultLayerCounts;
  labels: VaultPresentStackLabels;
}) {
  const reducedMotion = usePrefersReducedMotion();
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [landed, setLanded] = useState(0);
  /*
   * No observer means the wall is shown, not hidden — the same rule the tracks keep. A
   * reader missing an animation has lost nothing; a reader missing the counts has lost the
   * surface. Derived at render, because it is a fact of the environment rather than
   * something to write from an effect.
   */
  const canWatch = typeof IntersectionObserver !== "undefined";

  // Every layer, from the shared list — the hand-written subset here omitted `module`, which
  // is the same defect three council seats found in three other aggregates.
  const largest = Math.max(...LAYER_ORDER.map((layer) => present[layer]), 1);
  const filesPerBlock = Math.max(1, Math.ceil(largest / BLOCK_CAP));
  const blocksOf = (count: number) => (count === 0 ? 0 : Math.max(1, Math.round(count / filesPerBlock)));
  const blocks = LAYER_ORDER.map((layer) => blocksOf(present[layer]));
  const total = blocks.reduce((sum, n) => sum + n, 0);
  /*
   * How many blocks a row actually holds is a fact of the rendered width, which this
   * component does not know — the wall wraps. `ROW_ESTIMATE` decides only how many *steps*
   * the build takes, and therefore how many blocks come up together. It bounds concurrency;
   * it lays nothing out.
   */
  const rows = Math.max(1, Math.ceil(total / ROW_ESTIMATE));
  const perStep = Math.ceil(total / rows);
  const built = reducedMotion || !canWatch ? total : Math.min(total, landed * perStep);

  useEffect(() => {
    if (reducedMotion || !canWatch) return;
    const node = containerRef.current;
    if (!node) return;
    let timer = 0;
    /*
     * ⚠️ **The counter is advanced outside the state updater, deliberately.** Scheduling the
     * next tick *inside* `setState(current => ...)` looks tidy and is a trap: React may run
     * an updater more than once for one update, and each run started another timer chain.
     * Measured on this very wall — 126 blocks that should take 1.13s finished in 160ms,
     * because several chains were racing and the stagger had quietly stopped existing.
     */
    let n = 0;
    const step = () => {
      n += 1;
      setLanded(n);
      if (n >= rows) window.clearInterval(timer);
    };
    /*
     * The wall builds when it is actually looked at, not when it mounts. This board has tabs
     * and a long scroll, so a wall that built on mount would have played to nobody and then
     * stood finished for the person who eventually arrived.
     */
    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries.some((entry) => entry.isIntersecting)) return;
        observer.disconnect();
        timer = window.setInterval(step, Math.max(16, Math.round(BUILD_SPAN_MS / rows)));
      },
      /*
       * ⚠️ **A threshold that a tall card cannot reach leaves the figure blank.** At 0.3,
       * design-responsive measured the wall still at `opacity: 0` on all 126 blocks after
       * three seconds at rest at 320, 390 and 844x390 — the card is taller than the room
       * above the fold there, so the fraction visible peaks at 0.111 and the build never
       * fires. The figure was not slow on a phone; it was absent.
       *
       * Any part of it being on screen is the honest trigger: the question this answers is
       * "has a person had the chance to see it", and a sliver is a chance. `rootMargin`
       * arms it slightly before it arrives so the first row is not already past.
       */
      { threshold: 0, rootMargin: "0px 0px -8% 0px" },
    );
    observer.observe(node);
    return () => {
      observer.disconnect();
      window.clearInterval(timer);
    };
  }, [reducedMotion, canWatch, rows]);

  /**
   * Where each layer's wall starts in the single build order — computed up front rather than
   * accumulated while rendering, so the offsets are the same on every render.
   */
  const startOf = blocks.reduce<number[]>(
    (acc, size, index) => [...acc, (acc[index] ?? 0) + size],
    [0],
  );

  return (
    <div
      ref={containerRef}
      data-testid="vault-present-stack"
      className="flex flex-col gap-3"
    >
      <div className="flex items-end justify-between gap-5">
        {LAYER_ORDER.map((layer, index) => {
          const count = present[layer];
          const size = blocks[index] ?? 0;
          const start = startOf[index] ?? 0;
          return (
            <section
              key={layer}
              data-testid={`vault-present-tower-${layer}`}
              aria-label={labels.towerSummary(labels.layer[layer], count)}
              className="flex min-w-0 flex-1 flex-col items-center gap-2"
            >
              {/*
                `flex-wrap-reverse` fills from the bottom row upward, so the wall grows the
                way a stack does. `justify-start` keeps the newest, partly filled row aligned
                with the ones under it instead of centring a ragged top edge.
              */}
              <ol
                aria-hidden
                className={cn(
                  "flex w-full flex-wrap-reverse content-start justify-start gap-px",
                  // A layer at a true zero keeps a floor rather than vanishing: an absent
                  // wall would read as "not counted", a floor reads as "counted, and none".
                  size === 0 && `min-h-px ${EMPTY_LAYER_RULE}`,
                )}
              >
                {Array.from({ length: size }, (_, i) => {
                  const up = start + i < built;
                  return (
                    <li
                      key={i}
                      className={cn(
                        /*
                          Square, not rounded. At the size a wall of a hundred blocks puts
                          them at, the smallest radius on the ramp is a third of the block
                          and the wall rendered as a field of dots. A brick has corners.
                        */
                        "block rounded-none",
                        LAYER_INK[layer],
                      )}
                      style={{
                        // Twice the weekly track's block: the two figures share one ramp step
                        // so a mark means the same size wherever the surface draws one.
                        width: "calc(var(--vault-history-cube) * 2)",
                        height: "calc(var(--vault-history-cube) * 2)",
                        transition:
                          "opacity var(--motion-fast) var(--motion-ease), transform var(--motion-fast) var(--motion-ease)",
                        opacity: up ? 1 : 0,
                        // A block drops the last of the way onto the wall rather than fading
                        // in where it will end up; it is put in place, not revealed.
                        transform: up ? "none" : "translateY(-6px)",
                      }}
                    />
                  );
                })}
              </ol>
              <div className="flex flex-col items-center gap-0.5">
                <span className="font-mono text-body-lg tabular-nums text-[color:var(--color-text-primary)]">
                  {count}
                </span>
                <span className="text-label text-[color:var(--color-text-tertiary)]">
                  {labels.layer[layer]}
                </span>
              </div>
            </section>
          );
        })}
      </div>
      {/* Silent while a block is a file, because then there is no scale to explain. */}
      {filesPerBlock > 1 ? (
        <p className="text-center text-caption text-[color:var(--color-text-quaternary)]">
          {labels.scaleNote(filesPerBlock)}
        </p>
      ) : null}
    </div>
  );
}
