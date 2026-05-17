import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  assertConceptBatchResult,
  assertRelationBatchResult,
  formatConceptBatchFailureLabel,
  formatRelationBatchFailureLabel,
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
          error: 'concepts[1] duplicate slug in input batch; first seen at concepts[0]',
        },
      ],
    };

    assert.doesNotThrow(() => assertConceptBatchResult(payload));
    assert.doesNotThrow(() => assertConceptBatchResult(payload, 'add_concepts', { expectedCount: 2 }));
  });

  it('formats concept failure rows without leaking undefined labels', () => {
    assert.equal(
      formatConceptBatchFailureLabel(
        {
          ok: false,
          slug: 'capabilities/a',
          error: 'concepts[1] duplicate slug in input batch; first seen at concepts[0]',
        },
        1,
      ),
      'capabilities/a',
    );
    assert.equal(
      formatConceptBatchFailureLabel({ ok: false, error: 'concepts[1] missing slug' }, 1),
      'concepts[1]',
    );
    assert.equal(
      formatConceptBatchFailureLabel({ ok: false, error: 'concepts[0] invalid' }, 0, 'concept'),
      'concept concepts[0]',
    );
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
    assert.throws(
      () => assertConceptBatchResult({ concepts: [{ ok: true, slug: 'capabilities/a' }] }, 'add_concepts', { expectedCount: 2 }),
      /add_concepts\.concepts row count mismatch: expected 2, got 1/,
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
    assert.doesNotThrow(() => assertRelationBatchResult(payload, 'add_relations chunk @0', { expectedCount: 2 }));
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
    assert.throws(
      () => assertRelationBatchResult({ relations: [] }, 'add_relations chunk @50', { expectedCount: 1 }),
      /add_relations chunk @50\.relations row count mismatch: expected 1, got 0/,
    );
  });

  it('formats relation failure rows without leaking undefined labels', () => {
    assert.equal(
      formatRelationBatchFailureLabel(
        {
          ok: false,
          from: 'project',
          to: 'missing',
          type: 'contains',
          error: 'relations[1] target does not exist',
        },
        1,
      ),
      'project —contains→ missing',
    );
    assert.equal(
      formatRelationBatchFailureLabel({ ok: false, error: 'relations[2] missing type' }, 2),
      'relations[2]',
    );
    assert.equal(
      formatRelationBatchFailureLabel({ ok: false, error: 'relations[0] invalid' }, 0, 'import'),
      'import relations[0]',
    );
  });
});
