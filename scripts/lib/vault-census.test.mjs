import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { describe, it } from "node:test";

import { countMarkdownFiles, dogfoodVaultCensus } from "./vault-census.mjs";

function withTempDir(fn) {
  const root = mkdtempSync(join(tmpdir(), "omot-vault-census-"));
  try {
    fn(root);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

describe("vault-census", () => {
  it("counts markdown files recursively and ignores non-markdown files", () => {
    withTempDir((root) => {
      mkdirSync(join(root, "nested"), { recursive: true });
      writeFileSync(join(root, "README.md"), "# Root\n");
      writeFileSync(join(root, "nested", "node.md"), "# Node\n");
      writeFileSync(join(root, "nested", "notes.txt"), "not ontology\n");

      assert.equal(countMarkdownFiles(root), 2);
    });
  });

  it("derives the dogfood vault census from the expected folder layout", () => {
    withTempDir((root) => {
      const ontology = join(root, "docs", "ontology");
      mkdirSync(join(ontology, "domains"), { recursive: true });
      mkdirSync(join(ontology, "capabilities"), { recursive: true });
      mkdirSync(join(ontology, "elements"), { recursive: true });
      writeFileSync(join(ontology, "README.md"), "# Vault\n");
      writeFileSync(join(ontology, "project.md"), "# Project\n");
      writeFileSync(join(ontology, "domains", "auth.md"), "# Auth\n");
      writeFileSync(join(ontology, "capabilities", "login.md"), "# Login\n");
      writeFileSync(join(ontology, "elements", "token.md"), "# Token\n");

      assert.deepEqual(dogfoodVaultCensus(root), {
        total: 5,
        byKind: {
          capabilities: 1,
          domains: 1,
          elements: 1,
          project: 1,
          "vault-readme": 1,
        },
      });
    });
  });
});
