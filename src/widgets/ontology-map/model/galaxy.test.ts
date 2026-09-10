import { describe, expect, it } from "vitest";

import { classifyAltitudeTier } from "./altitude";
import {
  GALAXY_DIM_FLOOR,
  GALAXY_ENTER_FAR_T,
  GALAXY_FILAMENT_FLOOR,
  GALAXY_FULL_FAR_T,
  GALAXY_TEMPERATURE_ORDER,
  bodyPresence,
  filamentPresence,
  galaxyRamp,
  galaxyTemperatureKey,
  starLuminance,
  starMagnitude,
} from "./galaxy";

/**
 * The galaxy is an **altitude**, and these tests hold the two promises that choice made: that
 * there is no flip anywhere on the way up, and that nothing the near view could tell you is lost
 * by the time you get to the top.
 */
describe("galaxyRamp — the sky arrives by distance, never by a switch", () => {
  it("is absent on the workbench and complete in the sky", () => {
    expect(galaxyRamp(0)).toBe(0);
    expect(galaxyRamp(GALAXY_ENTER_FAR_T)).toBe(0);
    expect(galaxyRamp(GALAXY_FULL_FAR_T)).toBe(1);
    expect(galaxyRamp(1)).toBe(1);
  });

  it("never steps — the largest jump across the whole climb stays small", () => {
    // The defect this forbids is a threshold: one frame of zoom that swaps the whole canvas.
    // Sampling the entire axis at 1/500 catches a discontinuity anywhere on it, not only at the
    // two ends a spot check would look at.
    let largest = 0;
    let previous = galaxyRamp(0);
    for (let i = 1; i <= 500; i += 1) {
      const value = galaxyRamp(i / 500);
      largest = Math.max(largest, Math.abs(value - previous));
      previous = value;
    }
    expect(largest).toBeLessThan(0.02);
  });

  it("rises monotonically, so zooming out never makes the sky retreat", () => {
    let previous = -1;
    for (let i = 0; i <= 200; i += 1) {
      const value = galaxyRamp(i / 200);
      expect(value).toBeGreaterThanOrEqual(previous);
      previous = value;
    }
  });

  /**
   * The chip and the sky must not disagree. By the time a reader is told they are looking at a
   * constellation, they must already be looking at one — the ramp starts inside the transition
   * for exactly this reason.
   */
  it("is already well underway before the altitude chip says constellation", () => {
    expect(classifyAltitudeTier(0.86)).toBe("constellation");
    expect(galaxyRamp(0.86)).toBeGreaterThan(0.75);
    expect(classifyAltitudeTier(0.1)).toBe("circuit");
    expect(galaxyRamp(0.1)).toBe(0);
  });

  it("treats a broken altitude as the workbench rather than throwing", () => {
    expect(galaxyRamp(Number.NaN)).toBe(0);
    expect(galaxyRamp(-5)).toBe(0);
  });
});

describe("starMagnitude — the fact the map already ranked by, made continuous", () => {
  it("orders by the same magnitude the bright-star ranking uses", () => {
    // `size + fullDegree * 18`: degree dominates, which is what makes a hub a hub.
    const hub = starMagnitude(4, 20, 400);
    const leaf = starMagnitude(4, 0, 400);
    expect(hub).toBeGreaterThan(leaf);
    expect(starMagnitude(4, 20, 400)).toBeGreaterThan(starMagnitude(4, 10, 400));
  });

  it("compresses the top and lifts the bottom, the way brightness is actually seen", () => {
    // Stevens' law: linear luminance would crush everything below a few connections into one
    // dark. Half the raw magnitude must read as clearly more than half as bright.
    const half = starMagnitude(0, 10, 360);
    expect(half).toBeGreaterThan(0.65);
    expect(half).toBeLessThan(0.75);
  });

  it("stays inside 0–1 for a node bigger than the ceiling it was normalised against", () => {
    expect(starMagnitude(9999, 9999, 10)).toBe(1);
    expect(starMagnitude(0, 0, 0)).toBe(0);
  });
});

describe("starLuminance — a faint star is still a star", () => {
  it("never lets a node with no connections go dark", () => {
    // The overview's job is to show what you have. A node that reached zero would be a node the
    // picture denies exists.
    expect(starLuminance(0)).toBe(GALAXY_DIM_FLOOR);
    expect(GALAXY_DIM_FLOOR).toBeGreaterThan(0.1);
  });

  it("still gives a hub a clear margin over a leaf", () => {
    // Floored *and* legible: the range above the floor is what carries the fact, so it has to
    // stay wide enough to read.
    expect(starLuminance(1) / starLuminance(0)).toBeGreaterThan(3);
  });
});

describe("galaxyTemperatureKey — kind keeps its channel after the silhouette melts", () => {
  it("gives every kind its own step", () => {
    const keys = GALAXY_TEMPERATURE_ORDER.map(galaxyTemperatureKey);
    expect(new Set(keys).size).toBe(GALAXY_TEMPERATURE_ORDER.length);
  });

  it("runs warm to cool down the containment ladder", () => {
    expect(GALAXY_TEMPERATURE_ORDER).toEqual(["project", "domain", "capability", "element"]);
  });

  it("falls back to the coolest step for an unknown kind rather than painting nothing", () => {
    expect(galaxyTemperatureKey("element")).toBe("galaxyElement");
  });
});

describe("bodyPresence / filamentPresence — what the sky replaces and what it keeps", () => {
  it("takes the body away and leaves the light", () => {
    expect(bodyPresence(0)).toBe(1);
    expect(bodyPresence(1)).toBe(0);
  });

  /**
   * The frame that would read as a bug: a node drawn as a solid shape *and* as a bright star at
   * once. The body has to be more than half gone by the time the sky is half arrived.
   */
  it("fades the body faster than the sky arrives, so the two never both dominate", () => {
    expect(bodyPresence(0.5)).toBeLessThan(0.5 - 0.2);
    for (let i = 0; i <= 20; i += 1) {
      const g = i / 20;
      expect(bodyPresence(g)).toBeLessThanOrEqual(1 - g + 1e-9);
    }
  });

  it("thins relations to filaments but never erases the structure", () => {
    expect(filamentPresence(0)).toBe(1);
    expect(filamentPresence(1)).toBeCloseTo(GALAXY_FILAMENT_FLOOR, 10);
    // A galaxy with no structure between its stars is a scatter plot, and the structure is the
    // thing Atlas exists to show.
    expect(GALAXY_FILAMENT_FLOOR).toBeGreaterThan(0.2);
  });
});
