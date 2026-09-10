import { describe, expect, it } from "vitest";

import {
  buildFootprintSteps,
  buildWalkedEdgeArrivalSteps,
  buildWalkedEdgeDirections,
  buildWalkedEdgeKeys,
  walkedEdgeKey,
} from "./footprint-steps";

describe("buildFootprintSteps", () => {
  it("재방문 노드는 순번을 여러 개 갖는다(1부터)", () => {
    const steps = buildFootprintSteps(["a", "b", "a", "c", "a"]);
    expect(steps.get("a")).toEqual([1, 3, 5]);
    expect(steps.get("b")).toEqual([2]);
    expect(steps.get("c")).toEqual([4]);
  });

  it("빈 트레일은 빈 맵", () => {
    expect(buildFootprintSteps([]).size).toBe(0);
  });
});

describe("buildWalkedEdgeKeys", () => {
  it("연달아 방문한 쌍만 후보가 된다", () => {
    const keys = buildWalkedEdgeKeys(["a", "b", "c"]);
    expect(keys.has(walkedEdgeKey("a", "b"))).toBe(true);
    expect(keys.has(walkedEdgeKey("b", "c"))).toBe(true);
    // a→c was never visited consecutively — it is not a walked path.
    expect(keys.has(walkedEdgeKey("a", "c"))).toBe(false);
  });

  it("방향이 달라도 같은 키 — 엣지는 무향으로 조회된다", () => {
    expect(buildWalkedEdgeKeys(["b", "a"]).has(walkedEdgeKey("a", "b"))).toBe(true);
  });

  it("같은 노드로 이어지는 자기 쌍은 만들지 않는다", () => {
    expect(buildWalkedEdgeKeys(["a", "a"]).size).toBe(0);
  });

  it("걸음이 하나면 쌍이 없다", () => {
    expect(buildWalkedEdgeKeys(["a"]).size).toBe(0);
  });
});

describe("buildWalkedEdgeDirections", () => {
  /*
   * ⚠️ The star mark has no toes. Direction moved from the glyph onto the line on
   * 2026-09-10, and this is the only place that remembers which way the walk went.
   */
  it("remembers which way each relation was crossed", () => {
    const dirs = buildWalkedEdgeDirections(["b", "a"]);
    // Walked b -> a, and "a" sorts lower, so the crossing runs high -> low.
    expect(dirs.get(walkedEdgeKey("a", "b"))).toBe(false);
    expect(buildWalkedEdgeDirections(["a", "b"]).get(walkedEdgeKey("a", "b"))).toBe(true);
  });

  it("keeps the most recent crossing when a relation is walked both ways", () => {
    const dirs = buildWalkedEdgeDirections(["a", "b", "a"]);
    expect(dirs.get(walkedEdgeKey("a", "b"))).toBe(false);
  });

  it("ignores a step that does not move", () => {
    expect(buildWalkedEdgeDirections(["a", "a"]).size).toBe(0);
    expect(buildWalkedEdgeDirections([]).size).toBe(0);
  });

  it("names the same relations the key set does", () => {
    const trail = ["c", "a", "b", "a"];
    expect([...buildWalkedEdgeDirections(trail).keys()].sort()).toEqual(
      [...buildWalkedEdgeKeys(trail)].sort(),
    );
  });
});

describe("buildWalkedEdgeArrivalSteps", () => {
  /*
   * ⚠️ A line belongs to the star it leads to. This is what lets the ignition sweep draw the
   * path in the order it happened rather than handing over the finished shape at once.
   */
  it("gives each relation the step the walk arrived along it", () => {
    const steps = buildWalkedEdgeArrivalSteps(["a", "b", "c"]);
    expect(steps.get(walkedEdgeKey("a", "b"))).toBe(1);
    expect(steps.get(walkedEdgeKey("b", "c"))).toBe(2);
  });

  it("keeps the first arrival when a relation is walked again", () => {
    // Drawn once, in the order it was first made — a line that redrew itself later would
    // pull the sweep backwards.
    expect(buildWalkedEdgeArrivalSteps(["a", "b", "a", "b"]).get(walkedEdgeKey("a", "b"))).toBe(1);
  });

  it("names the same relations the key set does", () => {
    const trail = ["c", "a", "b", "a"];
    expect([...buildWalkedEdgeArrivalSteps(trail).keys()].sort()).toEqual(
      [...buildWalkedEdgeKeys(trail)].sort(),
    );
  });
});
