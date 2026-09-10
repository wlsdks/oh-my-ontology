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

/**
 * Source with every comment removed.
 *
 * ⚠️ **A gate that reads comments cannot fail.** The first starfield-parity assertion in this
 * repository matched a sentence in a doc comment and was therefore permanently green; the
 * *second* time, on 2026-09-10, this file's own "no cross on the walked star" assertion went
 * red against the comment explaining why the cross had been removed. Both times the code was
 * correct and the gate was reading prose. Every assertion here runs on the stripped source.
 */
const readCode = (rel: string): string =>
  read(rel)
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|[^:])\/\/.*$/gm, "$1");

/** Each entry states why this file is allowed to emit. */
const LICENSED = {
  "src/views/download/ui/GatewayFx.tsx": "the gateway hero — the field is light itself",
  "src/shared/lib/star-emission.ts":
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
      const source = readCode(rel);
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
   * Two crosses at one point was the defect, and it is now prevented by subtraction rather
   * than by arbitration: the walked star does not wear a cross, so nothing has to stand down.
   * The gate therefore holds the *absence*, which is the condition the rule now rests on — if
   * the cross ever comes back to the star, "one cross per node" needs deciding again first.
   */
  it("걸어온 별은 십자를 달지 않는다 — 물러날 것이 없다", () => {
    const star = readCode("src/shared/lib/star-emission.ts");
    expect(
      /drawDiffractionSpike/.test(star),
      "걸어온 별이 다시 십자를 그린다 — 크기 스파이크와 한 점에서 겹친다",
    ).toBe(false);
  });
});
