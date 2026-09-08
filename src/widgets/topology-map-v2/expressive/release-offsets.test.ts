import { describe, expect, it } from "vitest";

import {
  isOffsetAtRest,
  orphanedOffsetIds,
  REST_OFFSET,
  seedDropOffset,
  smoothVelocity,
  snapOffset,
  springForDegree,
  stepHomeOffset,
  stepLagOffset,
  type SpringOffset,
} from "./release-offsets";

const TOKENS = { heavyDegree: 12, angFreq: 16, heavyZeta: 0.55 };

describe("release offsets — one call per node per frame", () => {
  it("a live drag lags on the exponential and records the velocity it moved at", () => {
    const next = stepLagOffset(REST_OFFSET, 100, 0, 1 / 60, 0.15);
    expect(next.x).toBeGreaterThan(0);
    expect(next.x).toBeLessThan(100);
    expect(next.vx).toBeCloseTo(next.x * 60, 6);
    expect(next.vy).toBe(0);
  });

  it("a release is continuous with the lag: the first home step starts from the lag's velocity", () => {
    const lag = stepLagOffset(REST_OFFSET, 100, 0, 1 / 60, 0.15);
    const home = stepHomeOffset(lag, 1 / 60, springForDegree(0, TOKENS));
    // Still travelling outward for a moment (the velocity carried), not snapped back.
    expect(home.x).toBeGreaterThan(lag.x * 0.9);
  });

  it("a heavy neighbour goes home through one overshoot; a light one does not", () => {
    const run = (degree: number) => {
      let o = { x: 80, y: 0, vx: 0, vy: 0 };
      let min = 0;
      const spring = springForDegree(degree, TOKENS);
      for (let i = 0; i < 240; i += 1) {
        o = stepHomeOffset(o, 1 / 120, spring);
        min = Math.min(min, o.x);
      }
      return { min, atRest: isOffsetAtRest(o) };
    };
    expect(run(40).min).toBeLessThan(-4);
    expect(run(1).min).toBeGreaterThan(-0.5);
    expect(run(40).atRest).toBe(true);
    expect(run(1).atRest).toBe(true);
  });

  it("reduced motion snaps to the target with no velocity", () => {
    expect(snapOffset(12, -4)).toEqual({ x: 12, y: -4, vx: 0, vy: 0 });
  });

  it("the drop starts at the drop point with the hand's velocity, capped", () => {
    const spring = springForDegree(40, TOKENS);
    const slow = seedDropOffset(30, 40, spring, 14);
    expect(slow).toEqual({ x: 0, y: 0, vx: 30, vy: 40 });
    const fast = seedDropOffset(5000, 0, spring, 14);
    expect(fast.vx).toBeLessThan(5000);
    expect(fast.vy).toBe(0);
  });

  it("the drop comes to rest and can be dropped from the map", () => {
    const spring = springForDegree(40, TOKENS);
    let o = seedDropOffset(600, 0, spring, 14);
    let peak = 0;
    for (let i = 0; i < 240; i += 1) {
      o = stepHomeOffset(o, 1 / 120, spring);
      peak = Math.max(peak, Math.abs(o.x));
    }
    expect(peak).toBeGreaterThan(4);
    expect(peak).toBeLessThanOrEqual(14.5);
    expect(isOffsetAtRest(o)).toBe(true);
  });

  it("the velocity tracker smooths and survives a zero dt", () => {
    const v1 = smoothVelocity({ x: 0, y: 0 }, 10, 0, 1 / 60);
    expect(v1.x).toBeCloseTo(300, 6);
    expect(smoothVelocity(v1, 10, 0, 0)).toEqual(v1);
  });
});

describe("orphaned offsets — a second grab must not drop the first group mid-flight", () => {
  it("names every id the live group no longer steps, and nothing else", () => {
    const offsets = new Map<string, SpringOffset>([
      ["a", { x: 4, y: 0, vx: 0, vy: 0 }],
      ["b", { x: 2, y: 1, vx: 0, vy: 0 }],
      ["c", { x: 0, y: 3, vx: 0, vy: 0 }],
    ]);
    expect(orphanedOffsetIds(offsets, new Set(["b"]))).toEqual(["a", "c"]);
    expect(orphanedOffsetIds(offsets, new Set(["a", "b", "c"]))).toEqual([]);
    expect(orphanedOffsetIds(new Map(), new Set(["a"]))).toEqual([]);
  });

  it("an orphan stepped home keeps travelling instead of snapping", () => {
    const spring = { omega: 16, zeta: 1 };
    let offset: SpringOffset = { x: 21, y: 0, vx: 0, vy: 0 };
    const first = stepHomeOffset(offset, 1 / 60, spring);
    expect(Math.abs(21 - first.x)).toBeLessThan(21);
    offset = first;
    for (let i = 0; i < 120; i += 1) offset = stepHomeOffset(offset, 1 / 60, spring);
    expect(isOffsetAtRest(offset)).toBe(true);
  });
});
