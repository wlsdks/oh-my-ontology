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
