/**
 * Release offsets — the per-node offset a drag leaves behind and how it comes home.
 *
 * The host loop keeps one `SpringOffset` per affected node (world units on top of
 * the node's natural position) and calls exactly one function per frame per node:
 *
 * - while the drag is live, `stepLagOffset` (the exponential lag the tug already
 *   had, now carrying a velocity so the release starts continuous);
 * - after release, `stepHomeOffset` (a damped spring to 0 whose ζ and ω come from
 *   the node's mass, `mass-spring.ts`);
 * - once, on release, `seedDropOffset` for the dragged node itself, so it carries
 *   the hand's velocity a capped step past the drop point.
 *
 * Pure functions over plain data. Nothing here knows about React, the canvas, or
 * the world; the loop owns the map and the node positions.
 */

import { stepTugAxis } from "../interaction/drag-tug";
import {
  clampDropVelocity,
  massForDegree,
  releaseSpringForMass,
  springAtRest,
  stepDampedSpring,
  type MassTokens,
  type SpringResponse,
} from "./mass-spring";

export interface SpringOffset {
  x: number;
  y: number;
  /** World units per second. */
  vx: number;
  vy: number;
}

export const REST_OFFSET: Readonly<SpringOffset> = Object.freeze({ x: 0, y: 0, vx: 0, vy: 0 });

/** The release spring for a node with `degree` relations. */
export function springForDegree(degree: number, tokens: MassTokens): SpringResponse {
  return releaseSpringForMass(massForDegree(degree, tokens.heavyDegree), tokens);
}

/**
 * Live drag: ease the offset toward its target on the exponential (`tau` seconds),
 * recording the velocity by finite difference so a release can start from it.
 */
export function stepLagOffset(
  prev: Readonly<SpringOffset>,
  targetX: number,
  targetY: number,
  dt: number,
  tau: number,
): SpringOffset {
  const x = stepTugAxis(prev.x, targetX, dt, tau);
  const y = stepTugAxis(prev.y, targetY, dt, tau);
  return { x, y, vx: dt > 0 ? (x - prev.x) / dt : 0, vy: dt > 0 ? (y - prev.y) / dt : 0 };
}

/** Release: one damped-spring step home (target 0) on both axes. */
export function stepHomeOffset(prev: Readonly<SpringOffset>, dt: number, spring: SpringResponse): SpringOffset {
  const sx = stepDampedSpring(prev.x, prev.vx, 0, dt, spring);
  const sy = stepDampedSpring(prev.y, prev.vy, 0, dt, spring);
  return { x: sx.value, y: sy.value, vx: sx.velocity, vy: sy.velocity };
}

/** An offset that is 1:1 with its target and carries no velocity (reduced motion). */
export function snapOffset(targetX: number, targetY: number): SpringOffset {
  return { x: targetX, y: targetY, vx: 0, vy: 0 };
}

/** The drop: zero offset, the hand's velocity, capped so the excursion stays under `maxPx`. */
export function seedDropOffset(vx: number, vy: number, spring: SpringResponse, maxPx: number): SpringOffset {
  const v = clampDropVelocity(vx, vy, spring, maxPx);
  return { x: 0, y: 0, vx: v.vx, vy: v.vy };
}

/** True once both axes are close enough to rest that the offset can be dropped. */
export function isOffsetAtRest(offset: Readonly<SpringOffset>): boolean {
  return springAtRest(offset.x, offset.vx, 0) && springAtRest(offset.y, offset.vy, 0);
}

/**
 * The ids holding an offset that nothing steps any more.
 *
 * The host keeps one offset per node of the **current** drag's group. Grabbing a second
 * node replaces that group while the first group's offsets are still on the map: they
 * stop being applied, and every node in it snaps back to its natural position inside one
 * frame (measured up to 21 px on the sample vault). They are not stale data — they are
 * springs mid-flight, so the loop steps them home instead of dropping them.
 */
export function orphanedOffsetIds(
  offsets: ReadonlyMap<string, Readonly<SpringOffset>>,
  stepped: ReadonlySet<string>,
): string[] {
  const out: string[] = [];
  for (const id of offsets.keys()) if (!stepped.has(id)) out.push(id);
  return out;
}

/** One EMA step of a dragged node's velocity from its frame displacement. */
export function smoothVelocity(
  prev: Readonly<{ x: number; y: number }>,
  dx: number,
  dy: number,
  dt: number,
  weight = 0.5,
): { x: number; y: number } {
  if (!(dt > 0)) return { x: prev.x, y: prev.y };
  return { x: prev.x * (1 - weight) + (dx / dt) * weight, y: prev.y * (1 - weight) + (dy / dt) * weight };
}
