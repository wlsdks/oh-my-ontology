/**
 * Footprint step numbers — turns a visit array into per-node step numbers.
 *
 * Replaces the old `footprint-ring.ts` (concentric hairline rings + a recency
 * rank). Why the rings went is in `render/footprint-glyph.ts`'s header; **why the
 * rank went** belongs here: rank answered "how recently was this visited", so a
 * node had exactly one, leaving nowhere to express a step the walker retraced. A
 * step answers "which step along the path", so a revisit naturally has several.
 *
 * Pure functions only — no canvas or React knowledge.
 */

/**
 * Per-node **list of visit numbers** — `["a","b","a"]` → `{a:[1,3], b:[2]}`.
 * Counted from 1, because the number is shown on screen and 0-based would be
 * misread.
 *
 * The number is a position within the trail array, so when the cap truncates the
 * front the remaining steps renumber from 1: "which step along the path you can
 * currently see" is the only question the user can answer. Preserving the numbers
 * of truncated steps would produce a list with no 1 in it.
 */
export function buildFootprintSteps(trail: readonly string[]): Map<string, number[]> {
  const steps = new Map<string, number[]>();
  trail.forEach((id, i) => {
    const list = steps.get(id);
    if (list) list.push(i + 1);
    else steps.set(id, [i + 1]);
  });
  return steps;
}

/** Both endpoint ids → a lookup key, sorted so direction does not matter (edges are looked up undirected). */
export function walkedEdgeKey(a: string, b: string): string {
  return a < b ? `${a} ${b}` : `${b} ${a}`;
}

/**
 * Key set of **consecutively visited pairs** in the trail — decides which relation
 * lines get a mark beside them.
 *
 * Two consecutively visited nodes **may have no actual relation between them**, so
 * this set is only a candidate list and the draw side applies it to real edges
 * only. Marking a line that does not exist would break the contract that a line
 * means a relation.
 */
export function buildWalkedEdgeKeys(trail: readonly string[]): Set<string> {
  const keys = new Set<string>();
  for (let i = 1; i < trail.length; i += 1) {
    const a = trail[i - 1];
    const b = trail[i];
    if (a === b) continue;
    keys.add(walkedEdgeKey(a, b));
  }
  return keys;
}

/**
 * The step at which the walk *arrived* along each relation, keyed like the set above.
 *
 * A line belongs to the star it leads to. During the ignition sweep this is what lets the
 * path draw itself in the order it happened — each line waits for its own arrival rather
 * than the whole shape appearing at once.
 */
export function buildWalkedEdgeArrivalSteps(trail: readonly string[]): Map<string, number> {
  const steps = new Map<string, number>();
  for (let i = 1; i < trail.length; i += 1) {
    const a = trail[i - 1];
    const b = trail[i];
    if (a === b) continue;
    // A relation walked more than once arrives first at its earliest crossing: the path is
    // drawn once, in the order it was first made.
    const key = walkedEdgeKey(a, b);
    if (!steps.has(key)) steps.set(key, i);
  }
  return steps;
}

/**
 * Which way the walk crossed each relation, keyed the same order-independent way the set
 * above is: `true` when it was walked from the lower id toward the higher one.
 *
 * ⚠️ **This exists because the star mark cannot carry a heading and the shoe print could.**
 * The prints came in pairs whose toes pointed the way of travel (owner, 2026-07-29). A star
 * has no toes, so the direction moved onto the line, where a light running along it says
 * which way without asking a ten-pixel mark to encode one. Losing direction silently was
 * the one thing the change could not do.
 *
 * A relation walked both ways keeps the **last** crossing: that is the direction the person
 * most recently went, and a mark that argues with itself every frame says nothing.
 */
export function buildWalkedEdgeDirections(trail: readonly string[]): Map<string, boolean> {
  const directions = new Map<string, boolean>();
  for (let i = 1; i < trail.length; i += 1) {
    const a = trail[i - 1];
    const b = trail[i];
    if (a === b) continue;
    directions.set(walkedEdgeKey(a, b), a < b);
  }
  return directions;
}

/** One walked relation's slice of the travelling light's lap. */
export interface TrailGlintLeg {
  /** Where in the lap (0–1) the light enters this relation. */
  start: number;
  /** Where in the lap (0–1) it leaves. */
  end: number;
}

/**
 * How the travelling light's single lap is divided between the walked relations.
 *
 * ⚠️ **One clock for every line is not one speed.** The light used to run `now % 4000` on
 * every walked relation at once, so three lines of 201, 510 and 580 screen px advanced through
 * the same fraction of themselves in the same frame — **59, 148 and 169 px·s⁻¹, a 2.9× spread
 * between lights the eye sees together** (design-motion, 2026-09-10). Two of the three also
 * crossed a quarter of the viewport diagonal on a fixed duration, which is the distance rule's
 * own threshold. Synchrony that says nothing is decoration; worse, it invites you to read the
 * three lights as simultaneous when the walk was sequential.
 *
 * Giving each relation a slice of the lap proportional to its length does both jobs with one
 * mark: the speed is the same everywhere by construction, and **one** light walks the whole
 * path in the order it was walked, once per lap. Direction and order out of a single moving
 * dot, instead of direction out of three that contradict the order.
 *
 * Lengths are the caller's — world-space chords are fine, because the camera scales every
 * edge by the same factor and the proportions are what this returns.
 */
export function buildTrailGlintLegs(
  legs: readonly { key: string; length: number }[],
): Map<string, TrailGlintLeg> {
  const out = new Map<string, TrailGlintLeg>();
  let total = 0;
  for (const leg of legs) total += Number.isFinite(leg.length) && leg.length > 0 ? leg.length : 0;
  if (total <= 0) {
    // Degenerate (a walk whose stops are all at one point): fall back to equal slices rather
    // than dividing by zero, so the light still traverses in order.
    const share = legs.length > 0 ? 1 / legs.length : 0;
    legs.forEach((leg, i) => out.set(leg.key, { start: i * share, end: (i + 1) * share }));
    return out;
  }
  let cursor = 0;
  for (const leg of legs) {
    const share = (Number.isFinite(leg.length) && leg.length > 0 ? leg.length : 0) / total;
    out.set(leg.key, { start: cursor, end: cursor + share });
    cursor += share;
  }
  return out;
}

/**
 * Where the light is on this relation, or `null` when it is elsewhere on the walk.
 *
 * `lapPhase` is the whole lap's 0–1 position. The return is that position rewritten in the
 * relation's own coordinates, so the caller's existing `a → b` interpolation is unchanged.
 */
export function trailGlintLocalPhase(leg: TrailGlintLeg | undefined, lapPhase: number): number | null {
  if (leg === undefined) return null;
  const span = leg.end - leg.start;
  if (span <= 0) return null;
  const local = (lapPhase - leg.start) / span;
  return local < 0 || local > 1 ? null : local;
}
