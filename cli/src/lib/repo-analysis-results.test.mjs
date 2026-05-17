import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { assertAnalyzeRepoStructureResult } from './repo-analysis-results.mjs';

describe('repo-analysis-results', () => {
  it('accepts analyze_repo_structure candidate arrays and suggested relations', () => {
    assert.doesNotThrow(() =>
      assertAnalyzeRepoStructureResult({
        rootPath: '/repo',
        framework: 'fsd',
        project: { slug: 'demo', title: 'Demo' },
        domains: [{ slug: 'domains/core', title: 'Core' }],
        capabilities: [{ slug: 'capabilities/auth', title: 'Auth', domain: 'domains/core' }],
        elements: [{ slug: 'elements/src/app', title: 'App', domain: 'domains/core' }],
        suggestedRelations: [{ from: 'demo', to: 'domains/core', type: 'contains' }],
      }),
    );
  });

  it('rejects malformed candidate arrays before CLI output or apply trusts them', () => {
    assert.throws(
      () => assertAnalyzeRepoStructureResult({ project: { slug: 'demo', title: 'Demo' }, domains: {} }),
      /analyze_repo_structure\.domains must be an array/,
    );
    assert.throws(
      () =>
        assertAnalyzeRepoStructureResult({
          capabilities: [{ slug: 'capabilities/auth', title: 'Auth', domain: '' }],
        }),
      /analyze_repo_structure\.capabilities\[0\]\.domain must be a non-empty string/,
    );
    assert.throws(
      () => assertAnalyzeRepoStructureResult({ elements: [{ slug: 'elements/a' }] }),
      /analyze_repo_structure\.elements\[0\]\.title must be a non-empty string/,
    );
  });

  it('rejects malformed suggested relation rows', () => {
    assert.throws(
      () =>
        assertAnalyzeRepoStructureResult({
          suggestedRelations: [{ from: 'demo', to: 'domains/core', type: '' }],
        }),
      /analyze_repo_structure\.suggestedRelations\[0\]\.type must be a non-empty string/,
    );
  });
});
