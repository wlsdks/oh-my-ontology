import { describe, expect, it } from "vitest";
import {
  computeAlignedPositions,
  type AlignableNode,
} from "./align-nodes";

const n = (
  id: string,
  x: number,
  y: number,
  width = 220,
  height = 60,
): AlignableNode => ({ id, position: { x, y }, width, height });

describe("computeAlignedPositions", () => {
  it("노드 1 개 이하 → 빈 Map", () => {
    expect(computeAlignedPositions([], "left").size).toBe(0);
    expect(computeAlignedPositions([n("a", 0, 0)], "left").size).toBe(0);
  });

  it("left — 최소 x 로 세 노드 모두 정렬", () => {
    const result = computeAlignedPositions(
      [n("a", 10, 0), n("b", 50, 100), n("c", 200, 200)],
      "left",
    );
    expect(result.get("b")).toEqual({ x: 10, y: 100 });
    expect(result.get("c")).toEqual({ x: 10, y: 200 });
    // a 는 이미 minX 라 skip (변경 없음)
    expect(result.has("a")).toBe(false);
  });

  it("right — 최대 right edge 로 정렬 (width 보정)", () => {
    const result = computeAlignedPositions(
      [n("a", 0, 0, 100), n("b", 50, 0, 100), n("c", 80, 0, 100)],
      "right",
    );
    // maxRight = 80 + 100 = 180
    expect(result.get("a")).toEqual({ x: 80, y: 0 });
    expect(result.get("b")).toEqual({ x: 80, y: 0 });
    expect(result.has("c")).toBe(false);
  });

  it("center-x — 평균 center 로 정렬", () => {
    // 노드 모두 width 100. center 들이 50, 100, 150 → 평균 100. target x = 100-50 = 50
    const result = computeAlignedPositions(
      [n("a", 0, 0, 100), n("b", 50, 0, 100), n("c", 100, 0, 100)],
      "center-x",
    );
    expect(result.get("a")).toEqual({ x: 50, y: 0 });
    expect(result.has("b")).toBe(false);
    expect(result.get("c")).toEqual({ x: 50, y: 0 });
  });

  it("top — 최소 y 로 정렬", () => {
    const result = computeAlignedPositions(
      [n("a", 0, 10), n("b", 0, 50), n("c", 0, 200)],
      "top",
    );
    expect(result.get("b")).toEqual({ x: 0, y: 10 });
    expect(result.get("c")).toEqual({ x: 0, y: 10 });
  });

  it("distribute-h — 3 개 노드는 첫·마지막 고정, 가운데 균등", () => {
    // x 0, 30, 100 → sort same. spacing = 50. mid 는 50 으로 이동
    const result = computeAlignedPositions(
      [n("a", 0, 0), n("b", 30, 0), n("c", 100, 0)],
      "distribute-h",
    );
    expect(result.get("a")).toBeUndefined(); // first 고정 (skip)
    expect(result.get("b")).toEqual({ x: 50, y: 0 });
    expect(result.get("c")).toBeUndefined(); // last 고정 (skip)
  });

  it("distribute-h — 2 개 이하면 빈 Map (분포 불가)", () => {
    expect(
      computeAlignedPositions(
        [n("a", 0, 0), n("b", 100, 0)],
        "distribute-h",
      ).size,
    ).toBe(0);
  });

  it("distribute-v — y 축 균등", () => {
    const result = computeAlignedPositions(
      [n("a", 0, 0), n("b", 0, 100), n("c", 0, 60)],
      "distribute-v",
    );
    // sort by y: a(0), c(60), b(100). spacing 50 → c 가 50 으로 이동
    expect(result.get("c")).toEqual({ x: 0, y: 50 });
  });
});
