import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { closestDogfoodOption, stripLeadingPnpmSeparator } from './dogfood-args.mjs';

describe('dogfood argument helpers', () => {
  it('strips the leading pnpm separator only', () => {
    assert.deepEqual(stripLeadingPnpmSeparator(['--', '--help']), ['--help']);
    assert.deepEqual(stripLeadingPnpmSeparator(['--help']), ['--help']);
    assert.deepEqual(stripLeadingPnpmSeparator(['--', '--vault', 'docs/ontology']), ['--vault', 'docs/ontology']);
  });

  it('suggests close flag spellings without suggesting positionals', () => {
    assert.equal(closestDogfoodOption('--hlep', ['--help', '-h']), '--help');
    assert.equal(closestDogfoodOption('-help', ['--help', '-h']), '--help');
    assert.equal(closestDogfoodOption('docs/ontology', ['--help', '-h']), null);
    assert.equal(closestDogfoodOption('--totally-different', ['--help', '-h']), null);
  });
});
