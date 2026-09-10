import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

/**
 * Canvas emission is licensed, not assumed.
 *
 * ⚠️ **This gate exists because the rule it enforces did not.** Four comments in
 * `render/node-shapes.ts` cited `design.md` for "material, not emission" and the phrase
 * appeared in neither `design.md` nor `docs/DESIGN-SYSTEM.md` — `git log -S` on both files
 * returned nothing (design-system, 2026-09-10). `docs:comment-refs` validates the *path* a
 * comment cites, never the sentence, so any comment can invent the rule it claims to obey.
 * The rule is written down now and this holds the code to it.
 *
 * `source-over` is the default and needs no licence. `lighter` is light, and light is
 * allowed only where the mark's meaning is light.
 */

const repoRoot = join(import.meta.dirname, "..", "..");
const read = (rel: string): string => readFileSync(join(repoRoot, rel), "utf8");

/** Each entry states why this file is allowed to emit. */
const LICENSED = {
  "src/views/download/ui/GatewayFx.tsx": "the gateway hero — the field is light itself",
  "src/widgets/ontology-map/render/node-shapes.ts":
    "the walked-path star, inside a lens the person opened",
} as const;

describe("캔버스 합성 — 발광은 허가된 곳에서만", () => {
  it("규칙이 실제로 design.md 에 적혀 있다", () => {
    // The failure this whole file was written after: a citation with no source.
    const rules = read(".claude/rules/design.md");
    expect(rules).toContain('globalCompositeOperation');
    expect(rules).toContain("lighter");
  });

  it.each(Object.entries(LICENSED))(
    "%s 는 이전 합성 모드를 같은 함수 안에서 되돌린다",
    (rel) => {
      const source = read(rel);
      const uses = (source.match(/globalCompositeOperation\s*=/g) ?? []).length;
      // One assignment turns it on, one puts it back. An odd count means a region leaked its
      // mode into everything drawn after it.
      expect(uses % 2, `${rel}: lighter 를 켜고 되돌리지 않는 구간이 있다`).toBe(0);
      // Either restore is honest: putting back the saved value, or naming the default. What
      // is not allowed is turning `lighter` on and leaving it on for whatever draws next.
      expect(
        /globalCompositeOperation\s*=\s*(prev|["']source-over["'])/.test(source),
        `${rel}: lighter 를 켠 뒤 기본 합성으로 되돌리는 줄이 없다`,
      ).toBe(true);
    },
  );

  /*
   * Two crosses at one point is the defect this catches: the magnitude spike and the walked
   * star are the same primitive at the same radius, so a node that is both must draw one.
   */
  it("걸어온 별이 켜지면 크기 스파이크는 물러난다", () => {
    const frame = read("src/widgets/ontology-map/ui/topology-frame-draw.ts");
    expect(
      /!walkedStarHere\s*&&[\s\S]{0,80}drawDiffractionSpike|walkedStarHere[\s\S]{0,200}drawDiffractionSpike/.test(
        frame,
      ),
      "크기 스파이크가 걸어온 별과 무관하게 그려진다 — 한 점에 십자 두 개",
    ).toBe(true);
  });
});
