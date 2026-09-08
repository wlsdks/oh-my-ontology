import { describe, expect, it } from "vitest";

import { beginEdgeGlow, drawNodeBloom, endEdgeGlow, hexWithAlpha } from "./ego-light";

const TOKENS = {
  indigo: "#5e6ad2",
  indigoBright: "#787ef6",
  egoGlowBlurPx: 22,
  nodeBloomBlurPx: 31,
  egoGlowAlpha: 0.55,
  nodeBloomAlpha: 0.35,
};

/** A canvas stand-in that records what was painted and the state left behind. */
function fakeCtx() {
  const calls: string[] = [];
  const ctx = {
    globalAlpha: 0.7,
    shadowBlur: 0,
    shadowColor: "",
    fillStyle: "" as unknown,
    beginPath: () => calls.push("beginPath"),
    arc: (x: number, y: number, r: number) => calls.push(`arc ${x},${y},${r.toFixed(2)}`),
    fill: () => calls.push("fill"),
  };
  return { ctx: ctx as unknown as CanvasRenderingContext2D, raw: ctx, calls };
}

describe("ego light — paints only on a ramp, and restores what it touched", () => {
  it("hex to rgba, short and long forms, alpha clamped", () => {
    expect(hexWithAlpha("#5e6ad2", 0.5)).toBe("rgba(94,106,210,0.500)");
    expect(hexWithAlpha("#fff", 2)).toBe("rgba(255,255,255,1.000)");
    expect(hexWithAlpha("#000", -1)).toBe("rgba(0,0,0,0.000)");
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
