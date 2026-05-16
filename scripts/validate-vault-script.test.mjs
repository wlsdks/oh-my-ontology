import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import {
  parseValidateVaultArgs,
  validateVaultUsage,
} from "./validate-vault.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const SCRIPT = join(__dirname, "validate-vault.mjs");

describe("validate-vault script arguments", () => {
  it("parses help before resolving a vault path", () => {
    assert.deepEqual(
      parseValidateVaultArgs({
        argv: ["node", "validate-vault.mjs", "--help"],
        cwd: ROOT,
      }),
      { help: true },
    );
    assert.match(validateVaultUsage(), /Usage: node scripts\/validate-vault\.mjs \[vaultDir\]/);
    assert.match(validateVaultUsage(), /Defaults to docs\/ontology/);
  });

  it("rejects unknown options before scanning the filesystem", () => {
    assert.deepEqual(
      parseValidateVaultArgs({
        argv: ["node", "validate-vault.mjs", "--wat"],
        cwd: ROOT,
      }),
      {
        error: "Unknown option: --wat",
        exitCode: 2,
      },
    );
    assert.deepEqual(
      parseValidateVaultArgs({
        argv: ["node", "validate-vault.mjs", "--", "--wat"],
        cwd: ROOT,
      }),
      {
        error: "Unknown option: --wat",
        exitCode: 2,
      },
    );
  });

  it("prints help without treating --help as a vault folder", () => {
    const result = spawnSync(process.execPath, [SCRIPT, "--help"], {
      cwd: ROOT,
      encoding: "utf8",
    });

    assert.equal(result.status, 0);
    assert.match(result.stdout, /Usage: node scripts\/validate-vault\.mjs \[vaultDir\]/);
    assert.match(result.stdout, /-h, --help/);
    assert.equal(result.stderr, "");
  });
});
