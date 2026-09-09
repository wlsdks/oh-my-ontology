/**
 * **The object assembles itself** — where each mark comes from, and when it arrives.
 *
 * The owner, 2026-09-09: *"I do want the cool thing where the cubes assemble themselves…
 * various animation effects and motions… and in the Library the animation shown when data
 * accumulates inside it matters too."*
 *
 * So the constellation is no longer simply *there* when a screen opens. Each mark flies in
 * from outside the frame and settles into the place `constellation-model.ts` computed for
 * it, in an order that means something: **documents first, then the write-ups made from
 * them, then the citations between**. That is the Library's own sentence — gather, compile,
 * read — played as an arrival rather than printed as three steps.
 *
 * ## Why the schedule is here and not in the scene
 *
 * Same contract as the rest of this folder: plain numbers in, plain numbers out, no
 * three.js, no clock. A scene that owned its own schedule could only be checked by
 * watching it. This module answers "where is mark 12 at t=600ms" as arithmetic, so the
 * ordering, the overlap and the settling are unit-tested and the scene is left applying a
 * transform per frame.
 *
 * ## The shape of one mark's arrival
 *
 * A mark travels from a point on a sphere well outside the object to its final position,
 * on `easeOutCubic` — fast at first, asymptotically slow at the end, no overshoot. Overshoot
 * was available (the expression bans lifted on 2026-09-08) and is not used: a document
 * settling past its place and coming back reads as *bounce*, and this object is a folder
 * assembling, not a toy. It also spins as it flies, arriving at the fixed tumble the scene
 * already gives it, so the last thing that happens to a cube is that it stops turning.
 *
 * ⚠️ **Reduced motion has no schedule at all.** The host asks for `t = 1` and every mark is
 * home on the first frame — the same still object the same folder always draws.
 */

/** Where a mark is, partway through its arrival. */
export interface AssemblyStep {
  /** 0 at the start of this mark's own travel, 1 once it is home. */
  progress: number;
  /** Multiply the mark's final position by this to get its position now. */
  distance: number;
  /** Extra rotation to add to the mark's resting tumble, in radians. */
  spin: number;
  /** 0–1; the scene multiplies opacity and emission by it so a mark fades in as it lands. */
  presence: number;
}

export interface AssemblySchedule {
  /** How long one mark takes to travel, ms. */
  travelMs: number;
  /** Gap between one mark setting off and the next, ms. */
  strideMs: number;
  /** Delay before the first mark of this group sets off, ms. */
  delayMs: number;
}

/**
 * The three groups, in the order the Library itself describes: documents are gathered,
 * write-ups are compiled from them, and the citations are what the compile leaves behind.
 *
 * The strides are deliberately short relative to `travelMs` so the groups **overlap** —
 * the last cubes are still landing while the first spheres set off. A strictly sequential
 * assembly of 34 marks at 60ms each would run 2s per group and read as a loading bar.
 */
export const SOURCE_ASSEMBLY: AssemblySchedule = { travelMs: 900, strideMs: 26, delayMs: 0 };
export const PAGE_ASSEMBLY: AssemblySchedule = { travelMs: 820, strideMs: 46, delayMs: 420 };
/** Citations do not travel; they draw themselves on once both their ends have landed. */
export const LINK_ASSEMBLY: AssemblySchedule = { travelMs: 620, strideMs: 14, delayMs: 1180 };

/** How far outside the object a mark starts, as a multiple of its resting radius. */
const LAUNCH_RADIUS = 3.4;

/**
 * How much of a mark's travel time follows the distance it has to cover.
 *
 * ⚠️ **A fixed duration makes the far marks travel faster** — IBM Carbon states the rule
 * plainly: *"the larger the change in distance or size, the longer the animation takes"*,
 * on a non-linear scale. This object launches every mark from `LAUNCH_RADIUS × its resting
 * radius`, so a document on the outer shell covers roughly twice the ground of a write-up
 * on the inner one; at one fixed `travelMs` the outer marks were simply moving quicker,
 * which is the opposite of what weight and distance should feel like.
 *
 * The exponent is what makes it non-linear: at 0.5 the time grows with the square root of
 * the distance, so a mark twice as far takes about 1.4× as long rather than 2× — far
 * enough to feel heavier, not so far that the outer shell lags behind the object.
 */
const DISTANCE_TIME_EXPONENT = 0.5;
/** Turns a mark makes on the way in. */
const LAUNCH_SPIN = Math.PI * 1.5;

/** Fast, then asymptotically slow. No overshoot: this is an arrival, not a bounce. */
function easeOutCubic(t: number): number {
  const clamped = t <= 0 ? 0 : t >= 1 ? 1 : t;
  return 1 - (1 - clamped) ** 3;
}

/**
 * Where the `index`-th mark of a group is at `elapsedMs`.
 *
 * Before its stride begins the mark is at its launch distance and invisible; after its
 * travel ends it is exactly home, so a settled object is bit-identical to one that never
 * animated. That equality is what lets the reduced-motion still frame and the end of the
 * assembly be the same picture rather than two that merely look alike.
 */
export function assemblyStep(
  elapsedMs: number,
  index: number,
  schedule: AssemblySchedule,
  /**
   * The mark's resting radius, 0–1, if the caller knows it. Marks further out are given
   * proportionally longer to arrive, so every mark travels at a comparable speed rather
   * than the outer shell racing the inner one. Omitted, every mark takes `travelMs`.
   */
  restingRadius = 1,
): AssemblyStep {
  const started = elapsedMs - schedule.delayMs - index * schedule.strideMs;
  if (started <= 0) {
    return { progress: 0, distance: LAUNCH_RADIUS, spin: LAUNCH_SPIN, presence: 0 };
  }
  const reach = Math.max(0.05, Math.min(1, restingRadius));
  const travelMs = schedule.travelMs * reach ** DISTANCE_TIME_EXPONENT;
  if (started >= travelMs) {
    return { progress: 1, distance: 1, spin: 0, presence: 1 };
  }
  const eased = easeOutCubic(started / travelMs);
  return {
    progress: eased,
    distance: LAUNCH_RADIUS + (1 - LAUNCH_RADIUS) * eased,
    spin: LAUNCH_SPIN * (1 - eased),
    // Presence runs ahead of travel: a mark is fully lit before it stops moving, so the
    // object reads as filling in rather than as fading up.
    presence: Math.min(1, eased * 1.6),
  };
}

/**
 * When every mark of an object is home, ms.
 *
 * The host uses this to stop stepping the assembly and hand the object back to the ambient
 * turn — and, more importantly, to know when it may sleep. An object still assembling is
 * not idle, whatever the input clock says.
 */
export function assemblyDurationMs(counts: {
  sources: number;
  pages: number;
  links: number;
}): number {
  // `travelMs` is the longest any mark can take (a mark at the full resting radius), so
  // the unscaled value is still the correct upper bound for "everything has landed".
  const end = (schedule: AssemblySchedule, count: number) =>
    count <= 0 ? 0 : schedule.delayMs + (count - 1) * schedule.strideMs + schedule.travelMs;
  return Math.max(
    end(SOURCE_ASSEMBLY, counts.sources),
    end(PAGE_ASSEMBLY, counts.pages),
    end(LINK_ASSEMBLY, counts.links),
  );
}
