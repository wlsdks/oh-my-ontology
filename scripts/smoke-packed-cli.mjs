#!/usr/bin/env node
// Pack the local MCP + CLI packages, install the tarballs into a fresh temp
// project, then exercise the installed `oh-my-ontology` bin. This catches
// package `files`, bin, dependency, and MCP-spawn drift that source-checkout
// smoke tests can miss.

import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(fileURLToPath(new URL('..', import.meta.url)));
const MCP_DIR = join(ROOT, 'mcp');
const CLI_DIR = join(ROOT, 'cli');

function run(cmd, args, options = {}) {
  const result = spawnSync(cmd, args, {
    cwd: options.cwd,
    env: { ...process.env, ...options.env },
    encoding: 'utf-8',
  });
  assert.equal(
    result.status,
    0,
    `${cmd} ${args.join(' ')} failed\nstdout:\n${result.stdout}\nstderr:\n${result.stderr}`,
  );
  return result;
}

function packPackage(packageDir, destination) {
  const result = run('npm', ['pack', '--pack-destination', destination], {
    cwd: packageDir,
  });
  const filename = result.stdout.trim().split('\n').filter(Boolean).at(-1);
  assert.ok(filename?.endsWith('.tgz'), `npm pack did not print a tarball name: ${result.stdout}`);
  return join(destination, filename);
}

const temp = mkdtempSync(join(tmpdir(), 'omot-packed-cli-'));
try {
  const packDir = join(temp, 'packs');
  const installDir = join(temp, 'install');
  const projectDir = join(temp, 'project');
  mkdirSync(packDir, { recursive: true });
  mkdirSync(installDir, { recursive: true });
  mkdirSync(projectDir, { recursive: true });

  const mcpTgz = packPackage(MCP_DIR, packDir);
  const cliTgz = packPackage(CLI_DIR, packDir);

  writeFileSync(
    join(installDir, 'package.json'),
    JSON.stringify({ private: true, type: 'module' }, null, 2),
  );
  run('npm', ['install', '--ignore-scripts', mcpTgz, cliTgz], { cwd: installDir });

  const cliBin = join(installDir, 'node_modules', '.bin', 'oh-my-ontology');
  assert.equal(existsSync(cliBin), true, 'installed CLI bin is missing');

  const version = run(cliBin, ['--version'], { cwd: projectDir });
  assert.equal(version.stdout.trim(), '0.11.0');

  const init = run(cliBin, ['init', 'ontology'], { cwd: projectDir });
  assert.match(init.stdout, /23 tools/);
  assert.match(init.stdout, /codex mcp add oh-my-ontology/);

  const config = JSON.parse(readFileSync(join(projectDir, '.mcp.json'), 'utf-8'));
  const server = config.mcpServers['oh-my-ontology'];
  assert.equal(server.command, 'node');
  assert.match(server.args[0], /node_modules\/oh-my-ontology-mcp\/src\/index\.js$/);
  assert.equal(server.env.OMOT_VAULT, './ontology');

  const compile = run(cliBin, ['compile', 'ontology', '--summary'], { cwd: projectDir });
  assert.match(compile.stdout, /compiled ontology/);
  assert.match(compile.stdout, /5 nodes/);
  assert.match(compile.stdout, /issues.*0/);

  console.log(`packed CLI smoke passed: ${temp}`);
} finally {
  if (process.env.OMOT_KEEP_SMOKE_TMP !== '1') {
    rmSync(temp, { recursive: true, force: true });
  }
}
