import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

/**
 * Gateway FX (current field, grain, cursor ring) — the reduced-motion equivalent.
 *
 * Until 2026-09-08 this file sealed the gateway field as the one exception to
 * the animated-background ban: single consumer, alpha ceiling, documented
 * listing. The owner lifted that ban (`docs/DECISIONS.md`, "The expression bans
 * are lifted"), so the seal is gone. What stays is accessibility: under
 * `prefers-reduced-motion` the field draws one static frame, the cursor snaps,
 * and the entrance choreography is replaced by "always visible".
 */

const repoRoot = join(import.meta.dirname, "..", "..");
const read = (rel: string): string => readFileSync(join(repoRoot, rel), "utf8");

describe("관문 FX — 감속 동등물", () => {
  it("(b) 전류장은 reduced-motion 에서 rAF 루프를 돌리지 않는다", () => {
    const fx = read("src/views/download/ui/GatewayFx.tsx");
    expect(fx).toMatch(/prefers-reduced-motion/);
    // Reduced-motion branch: one static frame (draw(0)) — the loop starts only in the
    // else branch.
    expect(fx).toMatch(/if \(reduced\) \{\s*\n\s*draw\(0\);/);
    // The cursor lerp snaps instantly under reduced motion — a lagging cursor is not an
    // equivalent.
    expect(fx).toMatch(/!fxLoopLive \|\| reduced/);
  });

  it("(b′) 관문 등장 안무의 감속 동등물이 base 레이어 kill 규칙 뒤에 있다", () => {
    const css = read("app/globals.css");
    // The carve-out must sit inside the same layer as the global kill rule
    // (@layer base) and after it to win — an !important outside the layer loses to one
    // inside it (measured).
    const kill = css.indexOf("animation-duration: 0.01ms");
    const carve = css.indexOf(".gateway-rise,");
    expect(kill).toBeGreaterThan(-1);
    expect(carve, "관문 감속 carve-out 이 없다").toBeGreaterThan(-1);
    expect(carve, "carve-out 이 전역 kill 규칙보다 앞이라 조용히 진다").toBeGreaterThan(kill);
    const block = css.slice(carve, css.indexOf("}", carve));
    expect(block).toContain("opacity: 1 !important");
    expect(block).toContain("transform: none !important");
  });
});
