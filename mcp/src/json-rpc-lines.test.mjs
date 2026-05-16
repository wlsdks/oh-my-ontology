import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  expectedResponseIds,
  hasAllResponses,
  hasAllResultResponses,
  hasAnyErrorResponse,
  missingResponseLabels,
  parseJsonRpcResponses,
} from '../scripts/json-rpc-lines.mjs';

describe('json-rpc-lines helpers', () => {
  it('parses newline-delimited JSON-RPC responses and skips malformed lines', () => {
    assert.deepEqual(
      parseJsonRpcResponses('{"id":1,"result":{}}\nnot-json\n{"id":2,"error":{"message":"bad"}}\n'),
      [
        { id: 1, result: {} },
        { id: 2, error: { message: 'bad' } },
      ],
    );
  });

  it('derives integer response ids from requests', () => {
    assert.deepEqual(
      [...expectedResponseIds([{ id: 1 }, { method: 'notifications/initialized' }, { id: '2' }, { id: 3 }])],
      [1, 3],
    );
  });

  it('distinguishes any response from result responses', () => {
    const stdout = [
      JSON.stringify({ id: 1, result: {} }),
      JSON.stringify({ id: 2, error: { message: 'bad' } }),
    ].join('\n');
    assert.equal(hasAllResponses(stdout, new Set([1, 2])), true);
    assert.equal(hasAllResultResponses(stdout, new Set([1, 2])), false);
  });

  it('detects error responses with optional expected-id filtering', () => {
    const stdout = JSON.stringify({ id: 3, error: { message: 'bad' } });
    assert.equal(hasAnyErrorResponse(stdout), true);
    assert.equal(hasAnyErrorResponse(stdout, new Set([1, 2])), false);
    assert.equal(hasAnyErrorResponse(stdout, new Set([3])), true);
  });

  it('formats missing labels from response ids', () => {
    const labels = new Map([
      [1, 'initialize'],
      [2, 'tools/list'],
      [3, 'list_concepts'],
    ]);
    assert.deepEqual(
      missingResponseLabels([{ id: 1, result: {} }], labels),
      ['tools/list', 'list_concepts'],
    );
  });
});
