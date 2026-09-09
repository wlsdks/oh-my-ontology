import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

/**
 * **The Library's two empty screens share one shape, so they share the ground.**
 *
 * `LibraryStartStage` says it in its own comment: the no-folder stage and this one "now share
 * one shape". On 2026-09-09 only one of them was given a ground, on the owner's report that the
 * screen was plain and the void around the words was most of the viewport. The other kept the
 * unbroken field — measured on the installed app at 1512x949, its card ended at 61.5% of the
 * window with the bottom 38.5% empty, which is the same complaint about the same shape.
 *
 * The gate is on the pairing, not on either screen: whatever ground one empty state carries,
 * the other carries too. A future change that drops the object from one of them should have to
 * say so out loud rather than let the two drift apart again.
 */
const PAGE = readFileSync(
  join(process.cwd(), "src", "views", "library", "ui", "LibraryPage.tsx"),
  "utf8",
);

/** Everything a `data-library-state` branch renders, up to the next branch or the end. */
function branch(state: string): string {
  const at = PAGE.indexOf(`data-library-state="${state}"`);
  expect(at, `no branch renders data-library-state="${state}"`).toBeGreaterThan(-1);
  const next = PAGE.indexOf("data-library-state=", at + 1);
  return PAGE.slice(at, next === -1 ? PAGE.length : next);
}

describe("the Library's empty states share a ground", () => {
  it("still has both empty branches, so a pass is not an empty scan", () => {
    expect(branch("no-folder").length).toBeGreaterThan(200);
    expect(branch("empty-folder").length).toBeGreaterThan(200);
  });

  it("draws the constellation on both, not one", () => {
    for (const state of ["no-folder", "empty-folder"]) {
      expect(branch(state), `${state} lost its ground`).toContain("<LibraryConstellation />");
    }
  });

  it("gives the object its own square half on both", () => {
    for (const state of ["no-folder", "empty-folder"]) {
      const html = branch(state);
      expect(html, `${state} lost the object box`).toContain('data-testid="library-empty-object"');
      expect(html, `${state} lost the square`).toContain("aspect-square");
    }
  });

  it("keeps the words beside the object rather than over it", () => {
    for (const state of ["no-folder", "empty-folder"]) {
      expect(branch(state), `${state} stopped splitting`).toContain("lg:flex-row");
    }
  });
});
