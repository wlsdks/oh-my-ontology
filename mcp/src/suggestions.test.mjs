import { describe, it } from 'node:test';
import { strict as assert } from 'node:assert';

import {
  closestAllowedValue,
  formatAllowedValueError,
  formatErrorValue,
} from './suggestions.mjs';

describe('suggestions', () => {
  it('suggests close allowed values but avoids weak matches', () => {
    assert.equal(closestAllowedValue('overveiw', ['overview', 'health']), 'overview');
    assert.equal(closestAllowedValue('incomng', ['incoming', 'outgoing', 'both']), 'incoming');
    assert.equal(closestAllowedValue('xyz', ['overview', 'health']), null);
    assert.equal(closestAllowedValue('limit', []), null);
  });

  it('formats allowed-value errors with received values and close hints', () => {
    assert.equal(
      formatAllowedValueError('operation', 'overveiw', ['overview', 'health']),
      'operation must be one of: overview, health. Received: "overveiw". Did you mean "overview"?',
    );
    assert.equal(
      formatAllowedValueError('operation', 1, ['overview', 'health']),
      'operation must be one of: overview, health. Received: number.',
    );
  });

  it('formats values without leaking object internals into short errors', () => {
    assert.equal(formatErrorValue('x'), '"x"');
    assert.equal(formatErrorValue(null), 'null');
    assert.equal(formatErrorValue(['x']), 'array');
    assert.equal(formatErrorValue({ value: 'x' }), 'object');
  });
});
