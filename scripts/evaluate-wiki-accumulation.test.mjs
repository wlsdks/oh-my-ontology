import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';

test('wiki evaluation runs without a model, regrades saved revisions, and refuses contaminated or overwritten reports', async () => {
  const scratch = await mkdtemp(path.join(tmpdir(), 'atlas-wiki-eval-test-'));
  const run = (...args) => spawnSync(process.execPath, ['scripts/evaluate-wiki-accumulation.mjs', ...args], { encoding: 'utf8', timeout: 30000 });
  try {
    const original = path.join(scratch, 'oracle.json');
    const first = run(`--out=${original}`);
    assert.equal(first.status, 0, first.stderr);
    const bytes = await readFile(original, 'utf8');
    const report = JSON.parse(bytes);
    assert.equal(report.mode, 'deterministic-oracle');
    assert.equal(report.cases.length, 3);
    assert.ok(report.cases.every((entry) => entry.failed.length === 0 && entry.beforeApprovalUnchanged));
    assert.equal(run(`--out=${original}`).status, 1);
    assert.equal(await readFile(original, 'utf8'), bytes);
    assert.equal(run(`--regrade=${original}`, `--out=${scratch}/regraded.json`).status, 0);

    report.cases[0].page = '';
    await writeFile(`${scratch}/damaged.json`, JSON.stringify(report));
    assert.equal(run(`--regrade=${scratch}/damaged.json`, `--out=${scratch}/failed.json`).status, 1);
    const failed = JSON.parse(await readFile(`${scratch}/failed.json`, 'utf8'));
    assert.ok(failed.cases[0].failed.includes('humanNoteRetained'));

    report.corpusSha256 = 'different-corpus';
    await writeFile(`${scratch}/contaminated.json`, JSON.stringify(report));
    assert.equal(run(`--regrade=${scratch}/contaminated.json`, `--out=${scratch}/refused.json`).status, 1);
    assert.equal(run('--base-url=https://example.com/v1', `--out=${scratch}/remote.json`).status, 1);
    assert.equal(run('--unknown=true').status, 1);
  } finally {
    await rm(scratch, { recursive: true, force: true });
  }
});
