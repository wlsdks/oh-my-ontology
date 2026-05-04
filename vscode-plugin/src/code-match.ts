import * as path from 'path';
import { VaultNode } from './walk-vault';

/**
 * Find the best vault node match for a given source-file path.
 *
 * Match sources, in priority order:
 *   1. Element nodes whose `path:` frontmatter exactly equals the file's
 *      workspace-relative path (e.g. `path: package.json` matches
 *      `<workspace>/package.json`).
 *   2. Element nodes whose `path:` is a directory ancestor of the file
 *      (e.g. `path: src/features/docs-vault-local` matches anything
 *      under that directory).
 *   3. Capability nodes whose `elements: [...]` array contains the
 *      workspace-relative path (e.g. `elements: [src/views/foo/bar.tsx]`).
 *
 * Returns the longest-matching node so that more-specific node wins when
 * multiple match (e.g. file `src/features/docs-vault-local/lib/foo.ts`
 * picks the element with `path: src/features/docs-vault-local` over a
 * capability that lists the whole feature folder).
 *
 * Returns `null` when no node owns the file. That's fine — most files in
 * a real codebase are unlabeled.
 */
export function findOntologyMatch(
  workspaceRoot: string,
  absoluteFilePath: string,
  nodes: ReadonlyArray<VaultNode>,
): VaultNode | null {
  const rel = relativeForwardSlash(workspaceRoot, absoluteFilePath);
  if (!rel || rel.startsWith('..')) return null;

  const candidates: Array<{ node: VaultNode; score: number }> = [];

  for (const node of nodes) {
    if (node.path) {
      if (rel === node.path) {
        candidates.push({ node, score: 1_000_000 });
        continue;
      }
      if (isInside(rel, node.path)) {
        candidates.push({ node, score: node.path.length });
      }
    }
    if (node.elements && Array.isArray(node.elements)) {
      for (const el of node.elements) {
        if (typeof el !== 'string') continue;
        if (el === rel) {
          candidates.push({ node, score: 999_999 });
        } else if (isInside(rel, el)) {
          // capability.elements[] can list a folder too
          candidates.push({ node, score: el.length });
        }
      }
    }
  }

  if (candidates.length === 0) return null;
  candidates.sort((a, b) => b.score - a.score);
  return candidates[0].node;
}

function relativeForwardSlash(root: string, abs: string): string {
  return path.relative(root, abs).split(path.sep).join('/');
}

function isInside(filePath: string, dirPath: string): boolean {
  if (!dirPath) return false;
  const normalized = dirPath.endsWith('/') ? dirPath : dirPath + '/';
  return filePath.startsWith(normalized);
}
