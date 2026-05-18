import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  comparableDoc,
  comparableManifest,
  parseArgs,
  usage,
} from './build-docs-vault.mjs';

describe('build-docs-vault script helpers', () => {
  it('parses check/help flags and rejects accidental writes from unknown args', () => {
    assert.deepEqual(parseArgs([]), { check: false });
    assert.deepEqual(parseArgs(['--check']), { check: true });
    assert.deepEqual(parseArgs(['--help']), { help: true });
    assert.deepEqual(parseArgs(['-h']), { help: true });
    assert.deepEqual(parseArgs(['--check', 'extra']), {
      error: 'Unexpected argument: extra',
    });
    assert.deepEqual(parseArgs(['--fix']), {
      error: 'Unknown option: --fix',
    });
  });

  it('keeps usage explicit about check mode being read-only', () => {
    assert.match(usage(), /Usage: node scripts\/build-docs-vault\.mjs \[--check\]/);
    assert.match(usage(), /Verify generated outputs are current without writing/);
  });

  it('ignores timestamp-only manifest churn while preserving content drift', () => {
    const baseDoc = {
      slug: 'README',
      title: 'Readme',
      wordCount: 10,
      updatedAt: '2026-05-18T00:00:00.000Z',
    };
    const nextDoc = {
      ...baseDoc,
      updatedAt: '2026-05-18T01:00:00.000Z',
    };
    assert.deepEqual(comparableDoc(baseDoc), comparableDoc(nextDoc));
    assert.notDeepEqual(
      comparableDoc(baseDoc),
      comparableDoc({ ...nextDoc, wordCount: 11 }),
    );

    const baseManifest = {
      version: '2026-04-23',
      generatedAt: '2026-05-18T00:00:00.000Z',
      docs: [baseDoc],
    };
    const nextManifest = {
      ...baseManifest,
      generatedAt: '2026-05-18T01:00:00.000Z',
      docs: [nextDoc],
    };
    assert.deepEqual(comparableManifest(baseManifest), comparableManifest(nextManifest));
    assert.notDeepEqual(
      comparableManifest(baseManifest),
      comparableManifest({
        ...nextManifest,
        docs: [{ ...nextDoc, title: 'Changed' }],
      }),
    );
  });
});
