"use client";

import { useEffect, useRef, useState } from "react";

import { usePrefersReducedMotion } from "@/shared/lib/use-prefers-reduced-motion";
import { cn } from "@/shared/lib/cn";

import type { VaultHistoryWeek, VaultLayer } from "../../lib/vault-history";

/**
 * **What the folder held, week by week — three tracks, one baseline.**
 *
 * ## Why three tracks and not one stacked area
 *
 * Cleveland's work on graphical perception ranks position along a common scale above every
 * other encoding, and a stacked area's moving baseline forfeits exactly that: only the
 * bottom band is read against a straight line, and the ones above it are judged by
 * thickness on a wandering floor. Tufte's small multiples are the alternative, and they
 * are why this draws three separate tracks that share one scale — once a reader
 * understands one track they can read all three, and each is measured from a flat zero.
 *
 * The measurement that made this non-negotiable is in `vault-history.ts`: on this
 * repository's own folder the concepts fell 107 → 71 while the documents rose. Stacked,
 * that is a band getting thinner over a floor that is rising, which is the single hardest
 * comparison the perception literature knows of. Side by side on one scale it is two
 * lines going opposite ways.
 *
 * ## Why cubes
 *
 * The owner asked for accumulation that reads as stacking, with cubes assembling. A column
 * of discrete cubes is also a more honest mark than a smooth bar at these counts: the
 * quantity is a number of files, and a stack of countable blocks says "these are things"
 * where a continuous bar says "this is a level".
 *
 * ## The motion, and the evidence for it
 *
 * Heer and Robertson's controlled study of animated transitions in statistical graphics
 * (IEEE InfoVis 2007) found staged animation preferred to unstaged, and both to static,
 * at around one second. The 2026 work on perceptual capacity limits puts reliable tracking
 * at roughly four moving objects as a set, and one to two when a viewer must hold which is
 * which — and prescribes *item staging*, moving objects in subsets rather than all at
 * once. So the columns rise one week at a time, left to right, rather than the whole chart
 * animating in together: at any instant the eye has one column to follow, not forty.
 *
 * Reduced motion draws the finished chart, on the first frame, with no schedule at all.
 *
 * ## Why each track is only as tall as its own contents
 *
 * The first build gave every track the height of the tallest one, so that all three were
 * measured inside an identical frame. Rendered on this repository's own folder that was
 * indefensible: concepts peak at 101 files and the write-ups at zero, so two of the three
 * frames were empty boxes about 130px tall and roughly 60% of the card was reserved for
 * nothing. The shared scale does not live in the frame — it lives in the block, which is
 * the same size and means the same four files in every track. A track holding a quarter as
 * much is drawn a quarter as tall whether or not an empty frame is drawn around it, so
 * dropping the frame costs no comparison and returns the space.
 */

const LAYER_ORDER: readonly VaultLayer[] = ["concept", "module", "writeUp", "document"];

/**
 * Two inks, not four.
 *
 * ⚠️ **Four values asserted an order the data does not have** (design-infoviz, 2026-09-09).
 * Value is an ordered channel, so four steps claim a rank; composited over the card the four
 * came out wiki 0.669 > concept 0.283 > source 0.226 > architecture 0.110, matching neither
 * the layer order nor the counts. Architecture also measured **2.90:1** against the card,
 * under the 3:1 floor, while its 125 siblings sat at 6.04.
 *
 * What is real here is one nominal split: indigo for the layers the map draws, neutral for
 * the layers the Library holds — the boundary `classifyVaultPath` is the definition of.
 * Identity is already carried by position and a direct label beside every count, and the
 * marks never touch across layers, so two inks lose nothing and stop claiming a rank.
 */
export const LAYER_INK: Record<VaultLayer, string> = {
  concept: "bg-[color:var(--color-indigo-line-a90)]",
  module: "bg-[color:var(--color-indigo-line-a90)]",
  writeUp: "bg-[color:var(--color-text-secondary)]",
  document: "bg-[color:var(--color-text-secondary)]",
};

/**
 * The rule a genuinely empty layer keeps.
 *
 * ⚠️ It was `--color-border-soft`, which composites to **1.15:1** — the mark that carries
 * "measured, and none" was not perceivable at all, so the distinction it exists to draw did
 * not reach anybody. `--color-text-tertiary` measures 5.86:1 and is not any block's ink, so
 * a rule can never be mistaken for a mark.
 */
export const EMPTY_LAYER_RULE =
  "border-t border-dashed border-[color:var(--color-text-tertiary)]";

/** The finest a block is ever allowed to mean, so a small folder is not drawn as dust. */
const FILES_PER_CUBE = 4;
/**
 * The tallest a track may grow, in blocks.
 *
 * A block means a fixed number of files, so without a ceiling a folder ten times this
 * repository's would draw a column ten times as tall and the card would stop being a card.
 * Past this height the block simply means more files, and the axis note says so — the
 * quantity per block is stated in words rather than left for the reader to infer.
 */
const MAX_CUBES = 30;
/** Stride between one week's column starting to rise and the next — the item staging. */
const COLUMN_STRIDE_MS = 34;
/** How long one column takes. Inside the ~1s band the 2007 study recommends. */
const COLUMN_RISE_MS = 420;

export interface VaultHistoryTracksLabels {
  /** Track names, in the product's own words. */
  layer: Record<VaultLayer, string>;
  /** Accessible summary per track: "N this week, M at the start of the window". */
  trackSummary: (layer: string, latest: number, earliest: number) => string;
  /** The scale note, e.g. "one block = 4 files". */
  scaleNote: (filesPerCube: number) => string;
  /** Axis ends. */
  axisStart: string;
  axisEnd: string;
}

export function VaultHistoryTracks({
  weeks,
  peak,
  labels,
  milestones,
}: {
  weeks: readonly VaultHistoryWeek[];
  peak: number;
  labels: VaultHistoryTracksLabels;
  /** Dates the chart cannot state, in words, under the axis. */
  milestones?: React.ReactNode;
}) {
  const reducedMotion = usePrefersReducedMotion();
  const containerRef = useRef<HTMLDivElement | null>(null);
  /**
   * How many columns have been released to rise.
   *
   * Under reduced motion nothing is released *by* anything — every column is simply at
   * rest, derived here rather than written from an effect, so the still chart is the first
   * frame and not a frame that arrives after one.
   */
  const [released, setReleased] = useState(0);
  /*
   * ⚠️ **No observer means the chart is shown, not hidden.** The rise waits until the chart
   * is actually looked at, and waiting is only safe while something can tell us it has
   * been. Where `IntersectionObserver` does not exist the honest resting state is the
   * finished chart — a reader missing an animation has lost nothing; a reader missing the
   * data has lost the surface. Derived here, like the reduced-motion case, because it is a
   * fact of the environment rather than something to write from an effect.
   */
  const canWatch = typeof IntersectionObserver !== "undefined";
  const risen = reducedMotion || !canWatch ? weeks.length : released;

  useEffect(() => {
    if (reducedMotion || !canWatch) return;
    const node = containerRef.current;
    if (!node) return;
    /*
     * The chart rises when it is actually looked at, not when it mounts. This board has
     * tabs and a long scroll, so a chart that animated on mount would have played to
     * nobody and then sat still for the person who eventually arrived.
     */
    let timer = 0;
    /*
     * ⚠️ **The counter advances outside the state updater.** Scheduling the next tick inside
     * `setState(current => ...)` starts a fresh timer chain every time React runs the
     * updater, and React may run it more than once for one update. Measured on the sibling
     * wall: a build that should have taken 1.13s finished in 160ms with several chains
     * racing, which is the stagger silently not happening at all.
     */
    let n = 0;
    const start = () => {
      timer = window.setInterval(() => {
        n += 1;
        setReleased(n);
        if (n >= weeks.length) window.clearInterval(timer);
      }, COLUMN_STRIDE_MS);
    };
    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries.some((entry) => entry.isIntersecting)) return;
        observer.disconnect();
        start();
      },
      // Same reason as the wall's: a threshold a tall card cannot reach leaves the figure
      // blank rather than late. Any sliver on screen is the chance to have seen it.
      { threshold: 0, rootMargin: "0px 0px -8% 0px" },
    );
    observer.observe(node);
    return () => {
      observer.disconnect();
      window.clearInterval(timer);
    };
  }, [reducedMotion, canWatch, weeks.length]);

  // One block means the same number of files in all three tracks; that is where the shared
  // scale lives, not in a shared frame. The peak only decides how coarse the block has to
  // be for the tallest track to fit.
  const filesPerCube = Math.max(FILES_PER_CUBE, Math.ceil(peak / MAX_CUBES));
  /*
   * ⚠️ **A layer that holds a file is never drawn as none.** Rounding alone put counts of 1
   * and 2 at zero cubes once a block meant five files, and a zero-cube track draws the
   * dashed rule whose documented meaning is "measured, and none" — so on this repository's
   * own folder, which holds exactly one `architecture/` file, the surface asserted the layer
   * was empty. That is the lie the dashed rule exists to prevent, committed by the mark that
   * prevents it (design-infoviz, 2026-09-09). Anything present is at least one cube; only a
   * true zero reaches zero.
   */
  const cubesOf = (count: number) =>
    count === 0 ? 0 : Math.max(1, Math.round(count / filesPerCube));

  return (
    <div ref={containerRef} className="flex flex-col gap-4">
      {LAYER_ORDER.map((layer) => {
        const latest = weeks.at(-1)?.counts[layer] ?? 0;
        const earliest = weeks[0]?.counts[layer] ?? 0;
        const trackCubes = Math.max(...weeks.map((week) => cubesOf(week.counts[layer])), 0);
        return (
          <section
            key={layer}
            data-testid={`vault-history-track-${layer}`}
            aria-label={labels.trackSummary(labels.layer[layer], latest, earliest)}
            className="flex flex-col gap-1.5"
          >
            <div className="flex items-baseline justify-between gap-2">
              <span className="text-label text-[color:var(--color-text-secondary)]">
                {labels.layer[layer]}
              </span>
              <span className="font-mono text-caption text-[color:var(--color-text-tertiary)]">
                {latest}
              </span>
            </div>
            {/*
              `items-end` is the shared baseline: every track measures from the same flat
              zero, which is the property a stacked area gives up.
            */}
            <ol
              aria-hidden
              /*
                A track that genuinely holds nothing keeps its baseline rather than
                collapsing to nothing: the rule says "measured, and none", where an absent
                track would say "not measured". It is one pixel, not an empty box.
              */
              className={cn(
                "flex items-end gap-px",
                trackCubes === 0 && EMPTY_LAYER_RULE,
              )}
              style={{ height: `calc(${trackCubes} * var(--vault-history-cube))` }}
            >
              {weeks.map((week, index) => {
                const cubes = cubesOf(week.counts[layer]);
                const up = index < risen;
                return (
                  <li
                    key={week.week}
                    className="flex min-w-0 flex-1 flex-col-reverse justify-start gap-px"
                    /*
                     * One column, one transition, one delay — the stagger is the `risen`
                     * counter rather than a per-item delay, so an interrupted rise stops
                     * where it is instead of leaving a queue of timers to fire into a
                     * chart nobody is looking at any more.
                     */
                    style={{
                      transition: `opacity var(--motion-base) var(--motion-ease)`,
                      opacity: up ? 1 : 0,
                    }}
                  >
                    {Array.from({ length: cubes }, (_, cube) => (
                      <span
                        key={cube}
                        className={cn(
                          "block w-full rounded-micro",
                          LAYER_INK[layer],
                        )}
                        style={{
                          height: "calc(var(--vault-history-cube) - 1px)",
                          transition: `transform ${COLUMN_RISE_MS}ms var(--motion-ease)`,
                          /*
                            ⚠️ The comment that stood here claimed the bottom cube arrived
                            first "because it has least distance". The code never did that:
                            every cube in a column shares one `up`, one displacement and one
                            duration, so they arrive together (design-motion, 2026-09-09). A
                            column rises as a column, and saying so is the fix — a per-cube
                            delay would be a new schedule and belongs to its own pass.

                            3px, not 6: the cube is 4px tall, so 6px was 1.5x its own height
                            and cubes travelled through each other. 3px is 0.75x, the same
                            ratio the wall's block keeps.
                          */
                          transform: up ? "none" : "translateY(3px)",
                        }}
                      />
                    ))}
                  </li>
                );
              })}
            </ol>
          </section>
        );
      })}
      <div className="flex items-center justify-between text-caption text-[color:var(--color-text-quaternary)]">
        <span>{labels.axisStart}</span>
        <span>{labels.scaleNote(filesPerCube)}</span>
        <span>{labels.axisEnd}</span>
      </div>
      {milestones}
    </div>
  );
}
