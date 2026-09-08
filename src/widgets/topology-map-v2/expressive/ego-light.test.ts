import { describe, expect, it } from "vitest";

import { beginEdgeGlow, drawEgoHalo, drawNodeBloom, egoHaloReach, endEdgeGlow, hexWithAlpha } from "./ego-light";

const TOKENS = {
  indigo: "#5e6ad2",
  indigoBright: "#787ef6",
  egoHaloAlpha: 0.2,
  egoHaloPad: 28,
  egoGlowBlurPx: 22,
  egoGlowAlpha: 0.55,
  nodeBloomAlpha: 0.35,
};

/** A canvas stand-in that records what was painted and the state left behind. */
function fakeCtx() {
  const calls: string[] = [];
  const stops: Array<[number, string]> = [];
  const ctx = {
    globalAlpha: 0.7,
    shadowBlur: 0,
    shadowColor: "",
    fillStyle: "" as unknown,
    createRadialGradient: (...args: number[]) => {
      calls.push(`gradient ${args.join(",")}`);
      return { addColorStop: (o: number, c: string) => stops.push([o, c]) };
    },
    beginPath: () => calls.push("beginPath"),
    arc: (x: number, y: number, r: number) => calls.push(`arc ${x},${y},${r.toFixed(2)}`),
    fill: () => calls.push("fill"),
  };
  return { ctx: ctx as unknown as CanvasRenderingContext2D, raw: ctx, calls, stops };
}

describe("ego light — paints only on a ramp, and restores what it touched", () => {
  it("hex to rgba, short and long forms, alpha clamped", () => {
    expect(hexWithAlpha("#5e6ad2", 0.5)).toBe("rgba(94,106,210,0.500)");
    expect(hexWithAlpha("#fff", 2)).toBe("rgba(255,255,255,1.000)");
    expect(hexWithAlpha("#000", -1)).toBe("rgba(0,0,0,0.000)");
  });

  it("the halo reaches the farthest neighbour's far rim, never less than the centre", () => {
    const c = { x: 0, y: 0, r: 20 };
    expect(egoHaloReach(c, [])).toBe(20);
    expect(egoHaloReach(c, [{ x: 30, y: 40, r: 10 }, { x: 5, y: 0, r: 1 }])).toBe(60);
  });

  it("the halo paints nothing at ramp 0 and a gradient disc at ramp 1", () => {
    const off = fakeCtx();
    drawEgoHalo(off.ctx, { cx: 10, cy: 10, reach: 100, ramp: 0 }, TOKENS);
    expect(off.calls).toEqual([]);
    const on = fakeCtx();
    drawEgoHalo(on.ctx, { cx: 10, cy: 10, reach: 100, ramp: 1 }, TOKENS);
    expect(on.calls).toEqual(["gradient 10,10,0,10,10,128", "beginPath", "arc 10,10,128.00", "fill"]);
    expect(on.stops[0]).toEqual([0, "rgba(94,106,210,0.200)"]);
    expect(on.stops[2]).toEqual([1, "rgba(94,106,210,0.000)"]);
  });

  it("mid-ramp the halo is smaller and fainter, so it arrives with the dive", () => {
    const mid = fakeCtx();
    drawEgoHalo(mid.ctx, { cx: 0, cy: 0, reach: 100, ramp: 0.5 }, TOKENS);
    expect(mid.calls[0]).toBe("gradient 0,0,0,0,0,110.08");
    expect(mid.stops[0]).toEqual([0, "rgba(94,106,210,0.100)"]);
  });

  it("the bloom sets a shadow for its own disc and puts the canvas state back", () => {
    const { ctx, raw, calls } = fakeCtx();
    drawNodeBloom(ctx, { x: 5, y: 6, r: 20 }, 1, TOKENS);
    expect(calls).toEqual(["beginPath", "arc 5,6,21.00", "fill"]);
    expect(raw.shadowBlur).toBe(0);
    expect(raw.globalAlpha).toBe(0.7);
    const idle = fakeCtx();
    drawNodeBloom(idle.ctx, { x: 5, y: 6, r: 20 }, 0, TOKENS);
    expect(idle.calls).toEqual([]);
  });

  it("the edge glow is a paired begin/end and does nothing at ramp 0", () => {
    const { ctx, raw } = fakeCtx();
    expect(beginEdgeGlow(ctx, 0, TOKENS)).toBe(false);
    expect(raw.shadowBlur).toBe(0);
    expect(beginEdgeGlow(ctx, 0.5, TOKENS)).toBe(true);
    expect(raw.shadowBlur).toBe(11);
    expect(raw.shadowColor).toBe("rgba(94,106,210,0.275)");
    endEdgeGlow(ctx);
    expect(raw.shadowBlur).toBe(0);
  });
});
