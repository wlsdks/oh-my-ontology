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

  it("reports missing package scripts", () => {
    const scripts = { "dogfood:help": "node scripts/dogfood-mcp-walk.mjs --help" };

    assert.deepEqual(missingPnpmScripts("pnpm dogfood:help\npnpm dogfood:missing", scripts), [
      "dogfood:missing",
    ]);
    assert.throws(
      () => assertPnpmScriptsExist("pnpm dogfood:missing", scripts),
      /Missing package\.json scripts: dogfood:missing/,
    );
  });
});
