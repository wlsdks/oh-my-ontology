"use client";

import { useEffect, useMemo, useRef } from "react";

import { usePrefersReducedMotion } from "@/shared/lib/use-prefers-reduced-motion";
import { cn } from "@/shared/lib/cn";

import {
  buildConstellation,
  type ConstellationInput,
} from "../../expressive/constellation-model";
import { mountLibraryConstellation } from "../../expressive/constellation-scene";

/**
 * **The Library's backdrop** — one canvas, one call, and nothing else knows it is there.
 *
 * The host contract the map's expressive layer set: a single component that mounts a
 * self-contained scene and can be deleted along with `../../expressive/` to put the
 * screen back exactly as it was. Everything above this line is ordinary Library markup on
 * an ordinary panel; this only paints behind it.
 *
 * `aria-hidden` and `pointer-events-none` are not decoration-by-accident — they are the
 * statement that every fact this object draws is also written in the copy on top of it.
 * The counts it visualises are the same ones the stage and the index print in words, so a
 * reader who never sees the canvas loses nothing at all.
 */
export function LibraryConstellation({
  input,
  dim,
  distance,
  className,
}: {
  /**
   * The folder to draw. Omit for the anonymous object — the shape of the thing a person
   * is about to make, on the screen where they have not made it yet.
   */
  input?: ConstellationInput;
  /** Brightness 0–1; the workbench turns it down, the empty state leaves it alone. */
  dim?: number;
  /** Camera distance in object radii — larger draws the object smaller. */
  distance?: number;
  className?: string;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const reducedMotion = usePrefersReducedMotion();

  /*
   * Rebuilt only when the counts actually move. Without this the object is rebuilt on
   * every render of a screen whose model is recomputed constantly, which is the
   * "do not compute data for a surface that is not rendered" rule pointed the other way.
   */
  const signature = input
    ? `${input.sourceCount}:${input.pageSourceCounts.join(",")}`
    : "anonymous";
  const model = useMemo(() => buildConstellation(input), [signature]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const handle = mountLibraryConstellation(canvas, model, { reducedMotion, dim, distance });
    return () => handle?.dispose();
    // `model` is the only input that redraws; the rest remount by design.
  }, [model, reducedMotion, dim, distance]);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden
      data-testid="library-constellation"
      className={cn("pointer-events-none absolute inset-0 h-full w-full", className)}
    />
  );
}
