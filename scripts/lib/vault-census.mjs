import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";

export function countMarkdownFiles(root) {
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

export function dogfoodVaultCensus(root) {
  const ontologyRoot = join(root, "docs", "ontology");
  return {
    total: countMarkdownFiles(ontologyRoot),
    byKind: {
      capabilities: countMarkdownFiles(join(ontologyRoot, "capabilities")),
      domains: countMarkdownFiles(join(ontologyRoot, "domains")),
      elements: countMarkdownFiles(join(ontologyRoot, "elements")),
      project: existsSync(join(ontologyRoot, "project.md")) ? 1 : 0,
      "vault-readme": existsSync(join(ontologyRoot, "README.md")) ? 1 : 0,
    },
  };
}
