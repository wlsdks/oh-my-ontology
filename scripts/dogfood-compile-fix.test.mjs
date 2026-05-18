import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  captureDogfoodOntologyDiff,
  dogfoodCompileFixDiagnostic,
  dogfoodCompileFixExitCode,
  runDogfoodCompileFix,
} from './dogfood-compile-fix.mjs';

describe('dogfood compile-fix shortcut', () => {
  it('runs compile --fix before checking the dogfood vault is unchanged', () => {
    const calls = [];
    const exitCode = runDogfoodCompileFix({
      cwd: '/repo',
      stdio: 'pipe',
      spawn(command, args, options) {
        calls.push({ command, args, options });
        return { status: 0, stdout: 'existing diff' };
      },
    });

    assert.equal(exitCode, 0);
    assert.equal(calls.length, 3);
    assert.equal(calls[0].command, 'git');
    assert.deepEqual(calls[0].args, ['diff', '--', 'docs/ontology']);
    assert.equal(calls[0].options.cwd, '/repo');
    assert.equal(calls[0].options.encoding, 'utf-8');
    assert.equal(calls[1].command, process.execPath);
    assert.deepEqual(calls[1].args, ['cli/src/index.mjs', 'compile', 'docs/ontology', '--fix', '--summary', '--json']);
    assert.equal(calls[1].options.stdio, 'pipe');
    assert.deepEqual(calls[2].args, ['diff', '--', 'docs/ontology']);
  });

  it('skips the post-fix diff when compile --fix fails', () => {
    const calls = [];
    const exitCode = runDogfoodCompileFix({
      spawn(command, args) {
        calls.push({ command, args });
        return { status: calls.length === 1 ? 0 : 2, stdout: '' };
      },
    });

    assert.equal(exitCode, 2);
    assert.equal(calls.length, 2);
  });

  it('fails when compile --fix changed docs/ontology', () => {
    const calls = [];
    const diagnostics = [];
    const exitCode = runDogfoodCompileFix({
      stderr: { write: (text) => diagnostics.push(text) },
      spawn(_command, args) {
        calls.push(args);
        return { status: 0, stdout: calls.length === 3 ? 'after' : 'before' };
      },
    });

    assert.equal(exitCode, 1);
    assert.deepEqual(diagnostics, [
      '[dogfood:compile-fix] compile --fix changed docs/ontology; review and commit the canonicalized vault files.\n',
    ]);
  });

  it('treats git diff launch anomalies as failures before compile --fix', () => {
    const calls = [];
    const diagnostics = [];
    const exitCode = runDogfoodCompileFix({
      stderr: { write: (text) => diagnostics.push(text) },
      spawn(_command, args) {
        calls.push(args);
        return { error: new Error('git missing') };
      },
    });

    assert.equal(exitCode, 1);
    assert.equal(calls.length, 1);
    assert.deepEqual(diagnostics, [
      '[dogfood:compile-fix] git diff -- docs/ontology failed to start: git missing\n',
    ]);
  });

  it('captures an existing docs/ontology diff as an allowed baseline', () => {
    const diagnostics = [];
    const result = captureDogfoodOntologyDiff({
      cwd: '/repo',
      stderr: { write: (text) => diagnostics.push(text) },
      spawn(command, args, options) {
        assert.equal(command, 'git');
        assert.deepEqual(args, ['diff', '--', 'docs/ontology']);
        assert.equal(options.cwd, '/repo');
        assert.equal(options.encoding, 'utf-8');
        return { status: 0, stdout: 'diff --git a/docs/ontology/x b/docs/ontology/x' };
      },
    });

    assert.deepEqual(result, {
      ok: true,
      exitCode: 0,
      stdout: 'diff --git a/docs/ontology/x b/docs/ontology/x',
    });
    assert.deepEqual(diagnostics, []);
  });

  it('normalizes child process exit status and diagnostics', () => {
    assert.equal(dogfoodCompileFixExitCode({ status: 0 }), 0);
    assert.equal(dogfoodCompileFixExitCode({ status: 2 }), 2);
    assert.equal(dogfoodCompileFixExitCode({ signal: 'SIGTERM' }), 1);
    assert.equal(dogfoodCompileFixExitCode({ error: new Error('spawn failed') }), 1);
    assert.equal(dogfoodCompileFixExitCode({}), 1);

    assert.equal(dogfoodCompileFixDiagnostic(['node', 'compile'], { status: 0 }), null);
    assert.match(
      dogfoodCompileFixDiagnostic(['node', 'compile'], { error: new Error('spawn failed') }),
      /node compile failed to start: spawn failed/,
    );
    assert.match(
      dogfoodCompileFixDiagnostic(['git', 'diff'], { signal: 'SIGTERM' }),
      /git diff terminated by SIGTERM/,
    );
    assert.match(
      dogfoodCompileFixDiagnostic(['git', 'diff'], {}),
      /git diff ended without an exit status/,
    );
  });
});
