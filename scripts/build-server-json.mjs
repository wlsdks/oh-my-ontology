#!/usr/bin/env node
/**
 * Writes the `server.json` the official MCP Registry publishes, and checks the
 * invariants that must hold before any release exists.
 *
 *   pnpm mcp:registry:check                          # invariants only; writes nothing
 *   pnpm mcp:registry -- --tag=v1.1.0                # derive from the built artifact
 *   pnpm mcp:registry -- --tag=v1.1.0 --artifact=... # or from an explicit path
 *
 * The registry hosts metadata, not files: the MCPB entry points at a GitHub
 * Release asset and is verified by its URL and SHA-256, and the OCI entry is
 * verified by the image's ownership label. Neither needs a package registry,
 * which is what lets Atlas be discoverable while `docs/DECISIONS.md` (2026-07-27)
 * keeps npm retired.
 *
 * Every published value is derived — version and description from
 * `mcp/package.json`, the artifact digest hashed from the file on disk. A digest
 * typed by hand is a claim the registry would then serve to clients, so this
 * refuses to invent one: without a readable artifact it fails rather than
 * emitting a placeholder.
 */
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

import {
  bundleArtifactName,
  registryInvariantProblems,
  serverJson,
} from './lib/mcp-bundle.mjs';

const ROOT = process.cwd();
const MCP_PACKAGE = path.join(ROOT, 'mcp', 'package.json');
const DOCKERFILE = path.join(ROOT, 'mcp', 'Dockerfile');
const DEFAULT_ARTIFACT_DIR = path.join(ROOT, '.tmp', 'mcp-bundle');
const OUTPUT = path.join(ROOT, '.tmp', 'mcp-registry', 'server.json');

export function usage() {
  return [
    'Usage: node scripts/build-server-json.mjs [--check] [--tag=<release tag>] [--artifact=<path to .mcpb>]',
    '',
    '  --check     verify the registry invariants without writing server.json',
    '  --tag       the GitHub Release tag that will host the MCPB artifact',
    '  --artifact  the built .mcpb; defaults to .tmp/mcp-bundle/<name>.mcpb',
  ].join('\n');
}

export function parseArgs(argv) {
  const args = { check: false, help: false, tag: null, artifact: null };
  for (const arg of argv) {
    // `pnpm mcp:registry -- --tag=…` forwards the separator itself.
    if (arg === '--') continue;
    if (arg === '--check') args.check = true;
    else if (arg === '--help' || arg === '-h') args.help = true;
    else if (arg.startsWith('--tag=')) args.tag = arg.slice('--tag='.length);
    else if (arg.startsWith('--artifact=')) args.artifact = arg.slice('--artifact='.length);
    else return { ...args, error: `unknown argument: ${arg}` };
  }
  return args;
}

/** A release tag, not a bare version: the artifact URL is built from it. */
export function tagProblems(tag) {
  if (!tag) return ['--tag is required when writing server.json (for example --tag=v1.1.0)'];
  if (!/^v\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/.test(tag)) {
    return [`--tag must look like v1.2.3 or v1.2.3-rc.1, received ${tag}`];
  }
  return [];
}

export function runBuildServerJson(argv, io = console, { cwd = ROOT } = {}) {
  const args = parseArgs(argv);
  if (args.help) {
    io.log(usage());
    return 0;
  }
  if (args.error) {
    io.error(args.error);
    io.error(usage());
    return 2;
  }

  const pkg = JSON.parse(readFileSync(path.join(cwd, 'mcp', 'package.json'), 'utf8'));
  const dockerfile = readFileSync(path.join(cwd, 'mcp', 'Dockerfile'), 'utf8');
  const problems = registryInvariantProblems({
    dockerfile,
    version: pkg.version,
    tag: args.tag ?? undefined,
  });
  if (problems.length > 0) {
    for (const problem of problems) io.error(`[mcp-registry] ${problem}`);
    return 1;
  }
  if (args.check) {
    io.log(`[mcp-registry] invariants hold · ${pkg.name} v${pkg.version} · ready to publish as metadata ✓`);
    return 0;
  }

  const tagFailures = tagProblems(args.tag);
  if (tagFailures.length > 0) {
    for (const failure of tagFailures) io.error(`[mcp-registry] ${failure}`);
    return 2;
  }

  const artifact = args.artifact
    ? path.resolve(cwd, args.artifact)
    : path.join(cwd, '.tmp', 'mcp-bundle', bundleArtifactName(pkg.version));
  if (!existsSync(artifact)) {
    io.error(`[mcp-registry] no artifact at ${path.relative(cwd, artifact)} — run \`pnpm mcp:build-bundle\` first`);
    return 1;
  }
  const fileSha256 = createHash('sha256').update(readFileSync(artifact)).digest('hex');

  const document = serverJson({
    version: pkg.version,
    description: pkg.description,
    tag: args.tag,
    fileSha256,
  });
  const out = path.join(cwd, '.tmp', 'mcp-registry', 'server.json');
  mkdirSync(path.dirname(out), { recursive: true });
  writeFileSync(out, `${JSON.stringify(document, null, 2)}\n`);

  io.log(`[mcp-registry] ${path.relative(cwd, out)}`);
  io.log(`[mcp-registry] ${document.name} v${document.version} · ${document.packages.map((entry) => entry.registryType).join(' + ')}`);
  io.log(`[mcp-registry] mcpb sha256 ${fileSha256}`);
  io.log('[mcp-registry] publish it yourself with `mcp-publisher login github && mcp-publisher publish`');
  return 0;
}

if (process.argv[1] && import.meta.url === `file://${process.argv[1]}`) {
  process.exitCode = runBuildServerJson(process.argv.slice(2));
}

export { DEFAULT_ARTIFACT_DIR, DOCKERFILE, MCP_PACKAGE, OUTPUT };
