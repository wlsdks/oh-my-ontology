import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { assertPnpmScriptsExist, missingPnpmScripts, pnpmScriptsFromText } from "./pnpm-script-refs.mjs";

describe("pnpm script reference helpers", () => {
  it("extracts unique pnpm script references in first-seen order", () => {
    assert.deepEqual(
      pnpmScriptsFromText("pnpm dogfood:help\npnpm test:dogfood:args\npnpm dogfood:help"),
      ["dogfood:help", "test:dogfood:args"],
    );
  });

  it("ignores pnpm builtin commands that are not package scripts", () => {
    assert.deepEqual(
      pnpmScriptsFromText("pnpm install\npnpm exec tsc --noEmit\npnpm dev\npnpm setup"),
      ["dev"],
    );
  });

  it("ignores prose and wildcard examples that are not concrete script refs", () => {
    assert.deepEqual(
      pnpmScriptsFromText("shared pnpm separator\npnpm integration:* --\npnpm forwards args"),
      [],
    );
  });

  it("reports missing package scripts", () => {
    const scripts = { "dogfood:help": "node scripts/dogfood-mcp-walk.mjs --help" };

    assert.deepEqual(missingPnpmScripts("pnpm dogfood:help\npnpm dogfood:missing", scripts), [
      "dogfood:missing",
    ]);
    assert.deepEqual(missingPnpmScripts("pnpm missing-simple", scripts), []);
    assert.throws(
      () => assertPnpmScriptsExist("pnpm dogfood:missing", scripts),
      /Missing package\.json scripts: dogfood:missing/,
    );
  });
});
