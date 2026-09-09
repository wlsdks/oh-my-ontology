import { describe, expect, it } from "vitest";

import {
  assemblyDurationMs,
  assemblyStep,
  LINK_ASSEMBLY,
  PAGE_ASSEMBLY,
  SOURCE_ASSEMBLY,
} from "./assembly";

/**
 * The assembly is the Library's own sentence played as an arrival — documents, then the
 * write-ups made from them, then the citations between. These pin the ordering, the
 * overlap, and the one property the whole thing rests on: a settled mark is *exactly*
 * home, so the end of the animation and the reduced-motion still frame are the same
 * picture rather than two that merely look alike.
 */

describe("assemblyStep — one mark's arrival", () => {
  it("holds a mark outside the frame and invisible until its stride begins", () => {
    const before = assemblyStep(0, 5, SOURCE_ASSEMBLY);
    expect(before.progress).toBe(0);
    expect(before.presence).toBe(0);
    expect(before.distance).toBeGreaterThan(3);
  });

  /*
   * The equality is the contract, not an approximation. If a settled mark were at 0.999 of
   * its radius the object would end one frame short of the still frame every reduced-motion
   * viewer sees, and no test would ever catch the difference.
   */
  it("puts a finished mark exactly home, with no residual offset or spin", () => {
    const done = assemblyStep(10_000, 0, SOURCE_ASSEMBLY);
    expect(done).toEqual({ progress: 1, distance: 1, spin: 0, presence: 1 });
  });

  it("travels inward, monotonically, without overshooting past its place", () => {
    let previous = Number.POSITIVE_INFINITY;
    for (let t = 0; t <= SOURCE_ASSEMBLY.travelMs; t += 30) {
      const { distance } = assemblyStep(t, 0, SOURCE_ASSEMBLY);
      expect(distance).toBeLessThanOrEqual(previous + 1e-9);
      // Never nearer than home: an overshoot would read as a bounce, which this is not.
      expect(distance).toBeGreaterThanOrEqual(1);
      previous = distance;
    }
  });

  it("unwinds its spin to nothing, so the last thing a cube does is stop turning", () => {
    const early = assemblyStep(60, 0, SOURCE_ASSEMBLY);
    const late = assemblyStep(SOURCE_ASSEMBLY.travelMs - 40, 0, SOURCE_ASSEMBLY);
    expect(early.spin).toBeGreaterThan(late.spin);
    expect(assemblyStep(SOURCE_ASSEMBLY.travelMs, 0, SOURCE_ASSEMBLY).spin).toBe(0);
  });

  /*
   * Presence runs ahead of travel so the object reads as filling in rather than fading up:
   * a mark is fully lit while it is still closing the last of its distance.
   */
  it("lights a mark before it stops moving", () => {
    const midway = assemblyStep(SOURCE_ASSEMBLY.travelMs * 0.7, 0, SOURCE_ASSEMBLY);
    expect(midway.presence).toBe(1);
    expect(midway.distance).toBeGreaterThan(1);
  });

  it("starts each later mark after the one before it", () => {
    const at = 500;
    const first = assemblyStep(at, 0, SOURCE_ASSEMBLY);
    const tenth = assemblyStep(at, 10, SOURCE_ASSEMBLY);
    expect(first.progress).toBeGreaterThan(tenth.progress);
  });

  it("is a pure function of time and index", () => {
    expect(assemblyStep(430, 7, PAGE_ASSEMBLY)).toEqual(assemblyStep(430, 7, PAGE_ASSEMBLY));
  });
});

describe("the three groups arrive in the order the Library describes", () => {
  it("sends documents before the write-ups made from them, and citations last", () => {
    expect(SOURCE_ASSEMBLY.delayMs).toBeLessThan(PAGE_ASSEMBLY.delayMs);
    expect(PAGE_ASSEMBLY.delayMs).toBeLessThan(LINK_ASSEMBLY.delayMs);
  });

  /*
   * ⚠️ The groups must **overlap**. Strictly sequential groups of 34 marks would run about
   * two seconds each and read as a three-stage loading bar rather than as one object
   * coming together.
   */
  it("overlaps the groups rather than running them one after another", () => {
    const sourcesEnd = SOURCE_ASSEMBLY.delayMs + SOURCE_ASSEMBLY.travelMs;
    expect(PAGE_ASSEMBLY.delayMs).toBeLessThan(sourcesEnd);
    const pagesEnd = PAGE_ASSEMBLY.delayMs + PAGE_ASSEMBLY.travelMs;
    expect(LINK_ASSEMBLY.delayMs).toBeLessThan(pagesEnd);
  });

  it("has a document already landing while the first write-up sets off", () => {
    const t = PAGE_ASSEMBLY.delayMs + 10;
    expect(assemblyStep(t, 0, SOURCE_ASSEMBLY).progress).toBeGreaterThan(0.4);
    expect(assemblyStep(t, 0, PAGE_ASSEMBLY).progress).toBeLessThan(0.2);
  });
});

/**
 * ⚠️ **The reduced-motion path reads the schedule at `Infinity`, not at 0.**
 *
 * The scene's first build passed `elapsed ≈ 0` for a zero-length assembly, and
 * `assemblyStep` correctly answered *before this mark sets off* — launch distance,
 * `presence: 0`. Every mark was placed off-frame at zero scale, so a reduced-motion viewer
 * got an empty canvas rather than the still object. These pin the two readings apart so a
 * future host cannot make the same substitution.
 */
describe("the two readings a still frame could take", () => {
  it("reads t=0 as nothing has set off yet", () => {
    const step = assemblyStep(0, 3, SOURCE_ASSEMBLY);
    expect(step.presence).toBe(0);
    expect(step.distance).toBeGreaterThan(3);
  });

  it("reads t=Infinity as everything is exactly home", () => {
    for (const schedule of [SOURCE_ASSEMBLY, PAGE_ASSEMBLY, LINK_ASSEMBLY]) {
      for (const index of [0, 7, 40]) {
        expect(assemblyStep(Number.POSITIVE_INFINITY, index, schedule)).toEqual({
          progress: 1,
          distance: 1,
          spin: 0,
          presence: 1,
        });
      }
    }
  });
});

describe("assemblyDurationMs — when the object may go idle", () => {
  it("covers the last mark of the slowest group", () => {
    const counts = { sources: 26, pages: 8, links: 16 };
    const duration = assemblyDurationMs(counts);
    for (const [count, schedule] of [
      [counts.sources, SOURCE_ASSEMBLY],
      [counts.pages, PAGE_ASSEMBLY],
      [counts.links, LINK_ASSEMBLY],
    ] as const) {
      expect(assemblyStep(duration, count - 1, schedule).progress).toBe(1);
    }
  });

  it("grows with the folder", () => {
    expect(assemblyDurationMs({ sources: 60, pages: 8, links: 16 })).toBeGreaterThan(
      assemblyDurationMs({ sources: 6, pages: 8, links: 16 }),
    );
  });

  it("is zero for a folder with nothing in it", () => {
    expect(assemblyDurationMs({ sources: 0, pages: 0, links: 0 })).toBe(0);
  });

  it("ignores a group that has no marks", () => {
    expect(assemblyDurationMs({ sources: 4, pages: 0, links: 0 })).toBe(
      SOURCE_ASSEMBLY.delayMs + 3 * SOURCE_ASSEMBLY.strideMs + SOURCE_ASSEMBLY.travelMs,
    );
  });

  /*
   * The host stops stepping at this point and hands the object to the ambient turn. An
   * object still assembling is not idle, whatever the input clock says, so this number is
   * also what keeps the sleep from starting mid-arrival.
   */
  it("stays under three seconds for the anonymous folder the empty state draws", () => {
    expect(assemblyDurationMs({ sources: 26, pages: 8, links: 16 })).toBeLessThan(3000);
  });
});
