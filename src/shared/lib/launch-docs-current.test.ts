import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { dogfoodVaultCensus } from '../../../scripts/lib/vault-census.mjs';

const ROOT = path.resolve(__dirname, '../../..');

const CURRENT_SURFACE_DOCS = [
  'README.md',
  'docs/PUBLISH-NPM.md',
  'docs/launch/README.md',
  'docs/launch/HN-POST.md',
  'docs/launch/REDDIT-POSTS.md',
  'docs/launch/X-THREAD.md',
  'docs/launch/DEMO-GIF-STORYBOARD.md',
] as const;

const DOGFOOD_COUNT_DOCS = [
  'README.md',
  'docs/launch/HN-POST.md',
  'docs/launch/DEMO-GIF-STORYBOARD.md',
] as const;

const STALE_PATTERNS: Array<{ pattern: RegExp; message: string }> = [
  {
    pattern: /\b12 tools\b/i,
    message: 'MCP launch copy must use the current 23-tool surface.',
  },
  {
    pattern: /\b20 tools\b/i,
    message: 'MCP launch copy must use the current 23-tool surface.',
  },
  {
    pattern: /\bread 8 \+ write 4\b/i,
    message: 'MCP launch copy must use read 15 + write 8.',
  },
  {
    pattern: /\bread 12 \+ write 8\b/i,
    message: 'MCP launch copy must use read 15 + write 8.',
  },
  {
    pattern: /\b8 read \+ 4 write\b/i,
    message: 'MCP launch copy must use 15 read + 8 write.',
  },
  {
    pattern: /\b12 read \+ 8 write\b/i,
    message: 'MCP launch copy must use 15 read + 8 write.',
  },
  {
    pattern: /~?130 (?:nodes|노드)/i,
    message: 'Hosted demo copy must not advertise the old 130-node dogfood vault.',
  },
  {
    pattern: /\b26 (?:nodes|노드)\b/i,
    message: 'Hosted demo copy must use the current 28-node dogfood vault.',
  },
  {
    pattern: /165 (?:relations|관계)/i,
    message: 'Hosted demo copy must not advertise the old 165-relation dogfood vault.',
  },
  {
    pattern: /10 others/i,
    message: 'MCP verification copy must mention the 23-tool namespace, not an old count.',
  },
  {
    pattern: /\d+ (?:unit )?test files?\s*\/\s*\d+ (?:unit )?tests?/i,
    message: 'Launch proof copy must not freeze test counts that drift with every added test.',
  },
];

describe('current-surface launch docs', () => {
  it('do not advertise stale MCP, dogfood, or test counts', async () => {
    const findings: string[] = [];

    for (const relPath of CURRENT_SURFACE_DOCS) {
      const text = await readFile(path.join(ROOT, relPath), 'utf8');
      for (const { pattern, message } of STALE_PATTERNS) {
        if (pattern.test(text)) {
          findings.push(`${relPath}: ${message}`);
        }
      }
    }

    expect(findings).toEqual([]);
  });

  it('keeps dogfood node-count claims aligned with the ontology vault', async () => {
    const nodeCount = dogfoodVaultCensus(ROOT).total;
    const findings: string[] = [];

    for (const relPath of DOGFOOD_COUNT_DOCS) {
      const text = await readFile(path.join(ROOT, relPath), 'utf8');
      if (!new RegExp(`\\b${nodeCount} nodes\\b|${nodeCount} 노드`).test(text)) {
        findings.push(`${relPath}: expected ${nodeCount} dogfood nodes`);
      }
    }

    expect(findings).toEqual([]);
  });

  it('keeps the README dogfood kind breakdown aligned with the ontology vault', async () => {
    const readme = await readFile(path.join(ROOT, 'README.md'), 'utf8');
    const counts = dogfoodVaultCensus(ROOT).byKind;

    expect(readme).toContain(`capabilities ${counts.capabilities}`);
    expect(readme).toContain(`domains ${counts.domains}`);
    expect(readme).toContain(`elements ${counts.elements}`);
    expect(readme).toContain(`project ${counts.project}`);
    expect(readme).toContain(`vault-readme ${counts['vault-readme']}`);
  });
});
