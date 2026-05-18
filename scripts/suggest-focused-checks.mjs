#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  formatFocusedCheckSuggestions,
  suggestFocusedChecks,
} from './lib/focused-check-suggestions.mjs';

export function changedPathsFromGit({ cwd = process.cwd(), spawn = spawnSync } = {}) {
  const result = spawn('git', ['diff', '--name-only', 'HEAD', '--'], {
    cwd,
    encoding: 'utf-8',
  });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    const detail = String(result.stderr || result.stdout || '').trim();
    throw new Error(detail || `git diff --name-only HEAD exited ${result.status}`);
  }
  return String(result.stdout || '').split(/\r?\n/).filter(Boolean);
}

export function runSuggestFocusedChecks({
  argv = process.argv.slice(2),
  cwd = process.cwd(),
  stdout = process.stdout,
  stderr = process.stderr,
  spawn = spawnSync,
} = {}) {
  const args = stripLeadingSeparator(argv);
  if (args.includes('--help') || args.includes('-h')) {
    stdout.write(`${suggestFocusedChecksUsage()}\n`);
    return 0;
  }
  try {
    const paths = args.length > 0 ? args : changedPathsFromGit({ cwd, spawn });
    stdout.write(`${formatFocusedCheckSuggestions(suggestFocusedChecks(paths))}\n`);
    return 0;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    stderr.write(`[focused-checks] ${message}\n`);
    return 2;
  }
}

export function stripLeadingSeparator(argv = []) {
  const args = Array.isArray(argv) ? [...argv] : [];
  return args[0] === '--' ? args.slice(1) : args;
}

export function suggestFocusedChecksUsage() {
  return `Usage:
  pnpm checks:changed
  pnpm checks:changed -- <path...>

Suggests the first focused checks for changed files. With no path arguments it
uses tracked changes from git diff --name-only HEAD. Pass paths explicitly to
inspect a planned file set before editing.`;
}

if (resolve(process.argv[1] ?? '') === fileURLToPath(import.meta.url)) {
  process.exitCode = runSuggestFocusedChecks();
}
