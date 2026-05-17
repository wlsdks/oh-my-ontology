import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  closestAllowedFlag,
  formatUnknownFlagError,
  parseBoundedNonNegativeIntegerFlag,
  parseBoundedPositiveIntegerFlag,
  parseNonNegativeIntegerFlag,
  parsePositiveIntegerFlag,
} from './cli-args.mjs';

const errorMessage = (value) => {
  assert.ok(value instanceof Error);
  return value.message;
};

describe('cli integer argument parsers', () => {
  it('parses positive integers without accepting zero, decimals, or unsafe values', () => {
    assert.equal(parsePositiveIntegerFlag('--limit', '1'), 1);
    assert.equal(parsePositiveIntegerFlag('--limit', '500'), 500);
    assert.equal(errorMessage(parsePositiveIntegerFlag('--limit', undefined)), '--limit requires a value');
    assert.equal(errorMessage(parsePositiveIntegerFlag('--limit', '--json')), '--limit requires a value');
    assert.equal(errorMessage(parsePositiveIntegerFlag('--limit', '0')), '--limit must be a positive integer');
    assert.equal(errorMessage(parsePositiveIntegerFlag('--limit', '1.5')), '--limit must be a positive integer');
    assert.equal(errorMessage(parsePositiveIntegerFlag('--limit', '9007199254740992')), '--limit must be a positive integer');
  });

  it('parses non-negative integers and preserves zero as a valid value', () => {
    assert.equal(parseNonNegativeIntegerFlag('--depth', '0'), 0);
    assert.equal(parseNonNegativeIntegerFlag('--depth', '20'), 20);
    assert.equal(errorMessage(parseNonNegativeIntegerFlag('--depth', undefined)), '--depth requires a value');
    assert.equal(errorMessage(parseNonNegativeIntegerFlag('--depth', '--json')), '--depth requires a value');
    assert.equal(errorMessage(parseNonNegativeIntegerFlag('--depth', '-1')), '--depth must be a non-negative integer');
    assert.equal(errorMessage(parseNonNegativeIntegerFlag('--depth', '2x')), '--depth must be a non-negative integer');
  });

  it('caps bounded positive integers with the same user-facing flag name', () => {
    assert.equal(parseBoundedPositiveIntegerFlag('--limit', '500', { max: 500 }), 500);
    assert.equal(errorMessage(parseBoundedPositiveIntegerFlag('--limit', '501', { max: 500 })), '--limit must be <= 500');
    assert.equal(errorMessage(parseBoundedPositiveIntegerFlag('--limit', '0', { max: 500 })), '--limit must be a positive integer');
  });

  it('caps bounded non-negative integers while allowing zero', () => {
    assert.equal(parseBoundedNonNegativeIntegerFlag('--max-hops', '0', { max: 20 }), 0);
    assert.equal(parseBoundedNonNegativeIntegerFlag('--max-hops', '20', { max: 20 }), 20);
    assert.equal(errorMessage(parseBoundedNonNegativeIntegerFlag('--max-hops', '21', { max: 20 })), '--max-hops must be <= 20');
    assert.equal(errorMessage(parseBoundedNonNegativeIntegerFlag('--max-hops', '2x', { max: 20 })), '--max-hops must be a non-negative integer');
  });

  it('suggests the closest known flag for recoverable typos', () => {
    assert.equal(closestAllowedFlag('--lmit', ['--json', '--limit', '--vault']), '--limit');
    assert.equal(closestAllowedFlag('--lmit=1', ['--json', '--limit', '--vault']), '--limit');
    assert.equal(closestAllowedFlag('--zzzz', ['--json', '--limit', '--vault']), null);
    assert.equal(
      formatUnknownFlagError('--lmit', ['--json', '--limit', '--vault']),
      'unknown flag: --lmit. Did you mean --limit?',
    );
    assert.equal(
      formatUnknownFlagError('--lmit=1', ['--json', '--limit', '--vault']),
      'unknown flag: --lmit=1. Did you mean --limit?',
    );
    assert.equal(formatUnknownFlagError('--zzzz', ['--json', '--limit', '--vault']), 'unknown flag: --zzzz.');
  });
});
