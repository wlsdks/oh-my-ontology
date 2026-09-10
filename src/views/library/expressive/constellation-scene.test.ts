import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { pageScaleFor, parallaxFollow } from "./constellation-scene";

/**
 * The scene itself needs a GPU and is proved by recording. This file covers the one part
 * of it that is arithmetic, and it is the part that was wrong: the pointer tilt used to
 * move a fixed 6% of the remaining distance **per frame**, which is a monitor setting
 * wearing a duration's clothes.
 */

/** Remaining distance to the target after `ms` of following in steps of `frameMs`. */
function remainingAfter(ms: number, frameMs: number): number {
  let remaining = 1;
  for (let t = 0; t < ms; t += frameMs) {
    remaining *= 1 - parallaxFollow(Math.min(frameMs, ms - t));
  }
  return remaining;
}

/** What the retired code did: a constant slice of the remaining distance, per frame. */
function remainingAfterFixedFraction(ms: number, frameMs: number): number {
  let remaining = 1;
  for (let t = 0; t < ms; t += frameMs) remaining *= 1 - 0.06;
  return remaining;
}

describe("parallaxFollow", () => {
  const HZ_120 = 1000 / 120;
  const HZ_60 = 1000 / 60;
  const HZ_30 = 1000 / 30;

  it("lands in the same place after the same time, whatever the refresh rate", () => {
    const at120 = remainingAfter(280, HZ_120);
    const at60 = remainingAfter(280, HZ_60);
    const at30 = remainingAfter(280, HZ_30);
    expect(at60).toBeCloseTo(at120, 3);
    expect(at30).toBeCloseTo(at120, 3);
  });

  /*
   * ⚠️ The measurement that opened this (design-motion, 2026-09-09): 139ms to settle on a
   * 120Hz display against 556ms on a 30Hz one, from one line of source. Without this the
   * regression is invisible — every display renders something, and each one is smooth.
   */
  it("detects the defect it replaced, so the fix cannot be quietly reverted", () => {
    const at120 = remainingAfterFixedFraction(280, HZ_120);
    const at30 = remainingAfterFixedFraction(280, HZ_30);
    // Four times the frames means four times the progress: the old code was not one motion.
    expect(at30 / at120).toBeGreaterThan(3);
  });

  it("keeps the 60Hz feel the screen was tuned at", () => {
    // The tau is derived from the retired fraction, so one 60Hz frame moves the same 6%.
    expect(parallaxFollow(HZ_60)).toBeCloseTo(0.06, 3);
  });

  it("never overshoots, and stands still for no elapsed time", () => {
    expect(parallaxFollow(0)).toBe(0);
    expect(parallaxFollow(-5)).toBe(0);
    expect(parallaxFollow(100_000)).toBeLessThanOrEqual(1);
    expect(parallaxFollow(64)).toBeLessThan(1);
  });
});

describe("pageScaleFor", () => {
  it("is ordered, so a heavier page is never drawn smaller", () => {
    const weights = [0, 0.25, 0.5, 0.75, 1];
    const sizes = weights.map(pageScaleFor);
    expect(sizes).toEqual([...sizes].sort((a, b) => a - b));
    expect(new Set(sizes).size).toBe(weights.length);
  });

  it("gives one weight one size, wherever the mark sits", () => {
    expect(pageScaleFor(0.5)).toBe(pageScaleFor(0.5));
  });
});

/*
 * ⚠️ The ordering above is a claim about the *world*, and it was true the whole time the
 * encoding was broken: under a perspective camera the size a reader sees is that ordering
 * divided by depth, and the object's marks span 2.38-3.39 in depth. Measured over the
 * anonymous object at 440px, perspective drew 3 of 28 weight-ordered pairs backwards and
 * rendered three pages of identical weight at 9.05, 9.05 and 12.89px; orthographic drew 0
 * of 28 backwards. So the projection is part of the encoding, and this is the line that
 * decides it — a GPU is needed to run the scene, but not to read which camera it builds.
 */
describe("the projection the weight channel depends on", () => {
  // Repo-relative: this suite runs under jsdom, where `import.meta.url` is not a file URL.
  const source = readFileSync("src/views/library/expressive/constellation-scene.ts", "utf8");

  it("is orthographic, because perspective divides the weight channel by depth", () => {
    expect(source).toContain("new THREE.OrthographicCamera(");
    expect(source).not.toContain("new THREE.PerspectiveCamera(");
  });

  it("listens for the pointer on the object's own box, never on the window", () => {
    // The 2026-09-08 "wriggle" was a backdrop answering a cursor that was going somewhere
    // else; a window listener is that defect, whatever the tilt is set to.
    expect(source).not.toContain('window.addEventListener("pointermove"');
    expect(source).toContain('pointerHost.addEventListener("pointermove"');
  });
});
