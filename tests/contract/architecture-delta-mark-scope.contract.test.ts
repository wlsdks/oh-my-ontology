import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

/**
 * **A tick is the loudest pass mark a screen has, and this one is scoped.**
 *
 * `role-ledger.ts` is explicit that a role box never claims a per-role verdict. It states what its
 * own outgoing edges did — "the wording stays edge-shaped so the two can never be confused" — and
 * profile-wide unknowns (`unmappedEdges`, `unruledEdges`) carry no role, so no box may speak for
 * them. The role face honours that by printing the glyph beside `ledgerStatusLabel`.
 *
 * The comparison gutter did not. The same glyph stood alone under a lane heading, marked
 * `aria-hidden`, with no wording anywhere near it. Measured on the installed app 2026-09-09: seven
 * ticks down that gutter while the profile badge read "unknown" and the agent's own answer opened
 * with 92 unmapped edges. Both statements were true at different scopes and nothing on the mark
 * said which.
 *
 * ⚠️ **Why this is a source contract and not a render.** The mark only exists under
 * `usesPairedDown`, which needs a measured `axisWidth` — 0 in jsdom, so a DOM assertion here would
 * pass by drawing nothing at all. That is the failure mode this repository calls a permanently
 * green gate, so the check reads the element instead.
 */
const SKETCH = readFileSync(
  join(process.cwd(), "src", "views", "architecture", "ui", "ArchitectureSketch.tsx"),
  "utf8",
);

/**
 * The `<text>` element carrying the comparison glyph, from its testid back to its tag, with JSX
 * comments blanked out.
 *
 * Prose is not markup: the comment explaining *why* the mark is no longer `aria-hidden` contains
 * that very word, and matching the raw slice reported the element as still hidden.
 */
const MARK = (() => {
  const at = SKETCH.indexOf("data-testid={`architecture-delta-marker-${box.id}`}");
  expect(at).toBeGreaterThan(-1);
  const raw = SKETCH.slice(SKETCH.lastIndexOf("<text", at), SKETCH.indexOf("</text>", at));
  return raw.replace(/\{\/\*[\s\S]*?\*\/\}/g, "");
})();

describe("the architecture comparison mark carries its scope", () => {
  it("finds the mark, so a pass is not an empty scan", () => {
    expect(MARK).toContain("LEDGER_GLYPH");
  });

  it("is not hidden from assistive technology", () => {
    expect(MARK).not.toMatch(/\baria-hidden\b/);
  });

  it("names itself with the role face's own edge-shaped sentence", () => {
    expect(MARK).toContain("aria-label={ledger ? ledgerStatusLabel(ledger)");
    expect(MARK).toContain("<title>");
  });

  it("says something before any source has been observed", () => {
    expect(MARK).toContain("deltaUnknownLabel");
  });

  it("still draws the achromatic glyph — shapes, not colour", () => {
    expect(MARK).toContain("LEDGER_GLYPH[ledger.state]");
  });
});
