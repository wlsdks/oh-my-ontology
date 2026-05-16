import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

import { parseFrontmatter } from "./parse-frontmatter.mjs";

export function countMarkdownFiles(root) {
  if (!existsSync(root)) return 0;
  const stats = statSync(root);
  if (stats.isFile()) return root.endsWith(".md") ? 1 : 0;
  if (!stats.isDirectory()) return 0;
  let count = 0;
  for (const entry of readdirSync(root, { withFileTypes: true })) {
    const full = join(root, entry.name);
    if (entry.isDirectory()) {
      count += countMarkdownFiles(full);
    } else if (entry.isFile() && entry.name.endsWith(".md")) {
      count += 1;
    }
  }
  return count;
}

function markdownFiles(root) {
  if (!existsSync(root)) return [];
  const stats = statSync(root);
  if (stats.isFile()) return root.endsWith(".md") ? [root] : [];
  if (!stats.isDirectory()) return [];
  const files = [];
  for (const entry of readdirSync(root, { withFileTypes: true })) {
    const full = join(root, entry.name);
    if (entry.isDirectory()) {
      files.push(...markdownFiles(full));
    } else if (entry.isFile() && entry.name.endsWith(".md")) {
      files.push(full);
    }
  }
  return files;
}

export function dogfoodVaultCensus(root) {
  const ontologyRoot = join(root, "docs", "ontology");
  const byKind = {
    capabilities: 0,
    domains: 0,
    elements: 0,
    project: 0,
    "vault-readme": 0,
  };
  const files = markdownFiles(ontologyRoot);
  for (const file of files) {
    const { frontmatter } = parseFrontmatter(readFileSync(file, "utf-8"));
    if (frontmatter.kind === "capability") byKind.capabilities += 1;
    if (frontmatter.kind === "domain") byKind.domains += 1;
    if (frontmatter.kind === "element") byKind.elements += 1;
    if (frontmatter.kind === "project") byKind.project += 1;
    if (frontmatter.kind === "vault-readme") byKind["vault-readme"] += 1;
  }

  return {
    total: files.length,
    byKind,
  };
}
