import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  changedPathsFromGit,
  runSuggestFocusedChecks,
  stripLeadingSeparator,
  suggestFocusedChecksUsage,
} from './suggest-focused-checks.mjs';

describe('focused check suggestion CLI', () => {
  it('normalizes the pnpm separator and prints help without git', () => {
    assert.deepEqual(stripLeadingSeparator(['--', '--help']), ['--help']);

    const output = [];
    const exitCode = runSuggestFocusedChecks({
      argv: ['--', '--help'],
      stdout: { write: (text) => output.push(text) },
      spawn() {
        throw new Error('git should not run for help');
      },
    });

    assert.equal(exitCode, 0);
    assert.match(output.join(''), /pnpm checks:changed/);
    assert.match(output.join(''), /git diff --name-only HEAD/);
    assert.equal(output.join(''), `${suggestFocusedChecksUsage()}\n`);
  });

  it('uses explicit paths when provided', () => {
    const output = [];
    const exitCode = runSuggestFocusedChecks({
      argv: ['--', '.mcp.json'],
      stdout: { write: (text) => output.push(text) },
      spawn() {
        throw new Error('git should not run with explicit paths');
      },
    });

    assert.equal(exitCode, 0);
    assert.match(output.join(''), /pnpm test:mcp:registration/);
  });

  it('reads tracked changed paths from git by default', () => {
    const output = [];
    const calls = [];
    const exitCode = runSuggestFocusedChecks({
      argv: [],
      stdout: { write: (text) => output.push(text) },
      spawn(command, args, options) {
        calls.push({ command, args, options });
        return { status: 0, stdout: 'docs/ontology/project.md\n' };
      },
    });

    assert.equal(exitCode, 0);
    assert.deepEqual(calls[0].args, ['diff', '--name-only', 'HEAD', '--']);
    assert.match(output.join(''), /pnpm docs-vault:check/);
  });

  it('surfaces git failures as focused-check diagnostics', () => {
    const diagnostics = [];
    const exitCode = runSuggestFocusedChecks({
      argv: [],
      stderr: { write: (text) => diagnostics.push(text) },
      stdout: { write() {} },
      spawn() {
        return { status: 128, stderr: 'not a git repo' };
      },
    });

    assert.equal(exitCode, 2);
    assert.deepEqual(diagnostics, ['[focused-checks] not a git repo\n']);
  });

  it('returns changed tracked paths from git', () => {
    assert.deepEqual(
      changedPathsFromGit({
        spawn(command, args) {
          assert.equal(command, 'git');
          assert.deepEqual(args, ['diff', '--name-only', 'HEAD', '--']);
          return { status: 0, stdout: 'a.js\n\nb.js\n' };
        },
      }),
      ['a.js', 'b.js'],
    );
  });
});
