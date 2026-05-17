import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  assertConceptBatchResult,
  assertRelationBatchResult,
} from './batch-results.mjs';

describe('batch-results', () => {
  it('accepts successful and row-level failed add_concepts rows', () => {
    const payload = {
      concepts: [
        {
          ok: true,
          slug: 'capabilities/a',
          filePath: '/vault/capabilities/a.md',
          changed: true,
          warnings: ['missing-expected-field:domain'],
        },
        {
          ok: false,
          slug: 'capabilities/a',
          error: 'concepts[1] duplicate slug in input batch',
        },
      ],
    };

    assert.doesNotThrow(() => assertConceptBatchResult(payload));
  });

  it('rejects malformed add_concepts response rows before summaries trust them', () => {
    assert.throws(
      () => assertConceptBatchResult({ concepts: [{ ok: 'true', slug: 'capabilities/a' }] }),
      /add_concepts\.concepts\[0\]\.ok must be a boolean/,
    );
    assert.throws(
      () => assertConceptBatchResult({ concepts: [{ ok: false, slug: 'capabilities/a' }] }),
      /add_concepts\.concepts\[0\]\.error must be a non-empty string/,
    );
    assert.throws(
      () => assertConceptBatchResult({ concepts: [{ ok: true, slug: '   ' }] }),
      /add_concepts\.concepts\[0\]\.slug must be a non-empty string/,
    );
  });

  it('accepts successful and row-level failed add_relations rows', () => {
    const payload = {
      relations: [
        {
          ok: true,
          from: 'project',
          to: 'domains/core',
          type: 'contains',
          alreadyExists: true,
          changed: false,
        },
        {
          ok: false,
          from: 'project',
          to: 'missing',
          type: 'contains',
          error: 'relations[1] target does not exist',
        },
      ],
    };

    assert.doesNotThrow(() => assertRelationBatchResult(payload));
  });

  it('rejects malformed add_relations response rows with caller context', () => {
    assert.throws(
      () => assertRelationBatchResult({ relations: [{ ok: true, from: 'project', to: '', type: 'contains' }] }, 'add_relations chunk @50'),
      /add_relations chunk @50\.relations\[0\]\.to must be a non-empty string/,
    );
    assert.throws(
      () => assertRelationBatchResult({ relations: [{ ok: true, from: 'project', to: 'domains/core', type: 'contains', alreadyExists: 'yes' }] }),
      /add_relations\.relations\[0\]\.alreadyExists must be a boolean/,
    );
    assert.throws(
      () => assertRelationBatchResult({ relations: [{ ok: false, from: 'project', to: 'missing', type: 'contains' }] }),
      /add_relations\.relations\[0\]\.error must be a non-empty string/,
    );
  });
});
