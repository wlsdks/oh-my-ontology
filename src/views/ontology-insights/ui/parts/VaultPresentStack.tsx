"use client";

import { useEffect, useRef, useState } from "react";

import { usePrefersReducedMotion } from "@/shared/lib/use-prefers-reduced-motion";
import { cn } from "@/shared/lib/cn";

import type { VaultLayer, VaultLayerCounts } from "../../lib/vault-history";

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

const LAYER_ORDER: readonly VaultLayer[] = ["concept", "writeUp", "document"];

/** Blocks per row in one layer's wall. Wide enough to read as a wall, narrow enough for three. */
const COLUMNS = 14;
/** Past this many blocks the wall stops being countable, and a block starts meaning several files. */
const BLOCK_CAP = 224;
/** Between one block landing and the next. */
const BLOCK_STRIDE_MS = 9;

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

  const largest = Math.max(present.concept, present.writeUp, present.document, 1);
  const filesPerBlock = Math.max(1, Math.ceil(largest / BLOCK_CAP));
  const blocksOf = (count: number) => (count === 0 ? 0 : Math.max(1, Math.round(count / filesPerBlock)));
  const blocks = LAYER_ORDER.map((layer) => blocksOf(present[layer]));
  const total = blocks.reduce((sum, n) => sum + n, 0);
  const built = reducedMotion || !canWatch ? total : landed;

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
      if (n >= total) window.clearInterval(timer);
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
        timer = window.setInterval(step, BLOCK_STRIDE_MS);
      },
      { threshold: 0.3 },
    );
    observer.observe(node);
    return () => {
      observer.disconnect();
      window.clearInterval(timer);
    };
  }, [reducedMotion, canWatch, total]);

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
                  size === 0 &&
                    "min-h-px border-t border-dashed border-[color:var(--color-border-soft)]",
                )}
              >
                {Array.from({ length: size }, (_, i) => {
                  const up = start + i < built;
                  return (
                    <li
                      key={i}
                      className={cn(
                        "block rounded-micro",
                        layer === "concept" && "bg-[color:var(--color-indigo-line-a90)]",
                        layer === "writeUp" && "bg-[color:var(--color-text-secondary)]",
                        layer === "document" && "bg-[color:var(--color-text-quaternary)]",
                      )}
                      style={{
                        width: `calc((100% - ${COLUMNS - 1}px) / ${COLUMNS})`,
                        aspectRatio: "1 / 1",
                        transition:
                          "opacity var(--motion-base) var(--motion-ease), transform var(--motion-settle) var(--motion-ease)",
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
