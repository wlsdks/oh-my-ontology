#!/usr/bin/env node
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';

import {
  EXCLUDED_FROM_BUNDLE,
  OWNERSHIP_LABEL,
  REGISTRY_SERVER_NAME,
  STRIPPED_MODULE,
  TYPED_MODULE,
  artifactUrlProblems,
  bundleArtifactName,
  bundleDownloadUrl,
  bundleFileList,
  bundleManifest,
  dependencyClosure,
  registryInvariantProblems,
  serverJson,
} from './lib/mcp-bundle.mjs';
import { parseArgs, tagProblems, usage } from './build-server-json.mjs';

const MCP_PACKAGE = JSON.parse(readFileSync('mcp/package.json', 'utf8'));
const DOCKERFILE = readFileSync('mcp/Dockerfile', 'utf8');
const WORKFLOW = readFileSync('.github/workflows/release-macos.yml', 'utf8');

describe('bundle contents', () => {
  /**
   * The bundle ships what the server itself declares. If these two lists were
   * maintained separately, a new module would reach npm's `files` and silently
   * miss the bundle, which fails only at a user's install.
   */
  it('carries every declared shipping file, with the typed module renamed', () => {
    const bundled = bundleFileList(MCP_PACKAGE.files);

    assert.ok(MCP_PACKAGE.files.includes(TYPED_MODULE), 'mcp/package.json must still declare the typed module');
    assert.ok(bundled.includes(STRIPPED_MODULE), 'the bundle must carry the stripped twin');
    assert.ok(!bundled.includes(TYPED_MODULE), 'the bundle must not carry the .mts source');
    assert.equal(bundled.length, MCP_PACKAGE.files.length - EXCLUDED_FROM_BUNDLE.length);
  });

  it('leaves the test fixture behind, because a host has no test runner', () => {
    for (const excluded of EXCLUDED_FROM_BUNDLE) {
      assert.ok(MCP_PACKAGE.files.includes(excluded), `mcp/package.json should still declare ${excluded} for npm test`);
      assert.ok(!bundleFileList(MCP_PACKAGE.files).includes(excluded), `${excluded} must not ship in the bundle`);
    }
  });

  /**
   * pnpm links `zod` only under the SDK, so a flat lookup in `mcp/node_modules`
   * finds the two direct dependencies and stops. The walk therefore resolves each
   * package from the directory of the package that depends on it.
   */
  it('walks a transitive dependency that lives only under its dependent', () => {
    const tree = {
      '/mcp': { dependencies: { '@scope/server': '1' } },
      '/store/server': { name: '@scope/server', dependencies: { zod: '4' } },
      '/store/server/node_modules/zod': { name: 'zod' },
    };
    const { packages, missing } = dependencyClosure({
      rootDependencies: tree['/mcp'].dependencies,
      rootDir: '/mcp',
      resolvePackageDir: (name, fromDir) => {
        if (name === '@scope/server' && fromDir === '/mcp') return '/store/server';
        if (name === 'zod' && fromDir === '/store/server') return '/store/server/node_modules/zod';
        return null;
      },
      readManifest: (dir) => tree[dir] ?? null,
    });

    assert.deepEqual(missing, []);
    assert.deepEqual(packages.map(({ name }) => name), ['@scope/server', 'zod']);
  });

  it('reports a dependency it cannot resolve instead of shipping a bundle without it', () => {
    const { packages, missing } = dependencyClosure({
      rootDependencies: { absent: '1' },
      rootDir: '/mcp',
      resolvePackageDir: () => null,
      readManifest: () => null,
    });

    assert.deepEqual(packages, []);
    assert.deepEqual(missing, ['absent']);
  });
});

describe('bundle manifest', () => {
  it('starts the server the way a host does, and asks for the vault as a folder', () => {
    const manifest = bundleManifest({ version: '9.9.9', description: 'd' });

    assert.equal(manifest.server.type, 'node');
    assert.equal(manifest.server.mcp_config.command, 'node');
    assert.equal(manifest.server.mcp_config.args[0], '${__dirname}/server/src/index.js');
    assert.equal(manifest.server.mcp_config.env.OATLAS_VAULT, '${user_config.vault}');
    assert.equal(manifest.user_config.vault.type, 'directory');
    assert.equal(manifest.user_config.vault.required, true);
  });

  /**
   * The `engines` pin in `mcp/package.json` is this repository's toolchain
   * choice. A host supplies its own Node, and the bundle answered `tools/list`
   * with every tool on Node 20, 22, 24 and 25 once the one typed module was
   * stripped — so the manifest states the SDK's floor, not the pin.
   */
  it('claims the runtime floor the stripped bundle actually runs on', () => {
    assert.equal(bundleManifest({ version: '1', description: 'd' }).compatibility.runtimes.node, '>=20');
    assert.match(MCP_PACKAGE.engines.node, /^>=24/);
  });
});

describe('registry entry', () => {
  it('names both npm-free channels and no package registry', () => {
    const document = serverJson({ version: '0.13.0', description: 'd', tag: 'v1.1.0', fileSha256: 'a'.repeat(64) });

    assert.deepEqual(document.packages.map((entry) => entry.registryType), ['mcpb', 'oci']);
    assert.equal(document.name, REGISTRY_SERVER_NAME);
    assert.equal(document.packages[0].fileSha256, 'a'.repeat(64));
    assert.match(document.packages[1].identifier, /^ghcr\.io\/.+:0\.13\.0$/);
  });

  it('keeps the artifact URL verifiable: GitHub-hosted and carrying "mcp"', () => {
    assert.deepEqual(artifactUrlProblems(bundleDownloadUrl('v1.1.0', '0.13.0')), []);
    assert.deepEqual(artifactUrlProblems('https://example.com/bundle.mcpb'), [
      'the registry accepts MCPB artifacts hosted on GitHub or GitLab releases only',
    ]);
    assert.deepEqual(artifactUrlProblems('https://github.com/wlsdks/ontology-atlas/releases/download/v1/atlas.zip'), [
      'the artifact URL must contain "mcp" for registry ownership verification',
    ]);
  });

  it('holds the image label and the registry name to the same string', () => {
    assert.deepEqual(registryInvariantProblems({ dockerfile: DOCKERFILE, version: MCP_PACKAGE.version, tag: 'v1.1.0' }), []);

    const drifted = DOCKERFILE.replace(
      `LABEL ${OWNERSHIP_LABEL}="${REGISTRY_SERVER_NAME}"`,
      `LABEL ${OWNERSHIP_LABEL}="io.github.someone/else"`,
    );
    const problems = registryInvariantProblems({ dockerfile: drifted, version: MCP_PACKAGE.version, tag: 'v1.1.0' });
    assert.equal(problems.length, 1);
    assert.match(problems[0], /io\.github\.someone\/else/);
  });

  it('refuses a missing ownership label outright', () => {
    const problems = registryInvariantProblems({ dockerfile: 'FROM node:24-alpine\n', version: '1.0.0' });
    assert.ok(problems.some((problem) => problem.includes(OWNERSHIP_LABEL)));
  });
});

describe('server.json CLI', () => {
  it('requires a release tag shaped like a tag, since the artifact URL is built from it', () => {
    assert.deepEqual(tagProblems('v1.1.0'), []);
    assert.deepEqual(tagProblems('v1.1.0-rc.1'), []);
    assert.equal(tagProblems('1.1.0').length, 1);
    assert.equal(tagProblems(null).length, 1);
  });

  it('accepts the separator pnpm forwards and rejects an unknown flag', () => {
    assert.equal(parseArgs(['--', '--tag=v1.1.0']).tag, 'v1.1.0');
    assert.equal(parseArgs(['--check']).check, true);
    assert.match(parseArgs(['--publish']).error, /unknown argument/);
    assert.match(usage(), /--artifact/);
  });
});

describe('release wiring', () => {
  /**
   * A bundle nobody uploads is not a channel. The registry entry points at a
   * release asset by name, so the release must actually carry that name.
   */
  it('uploads the bundle and its checksum with the release', () => {
    assert.match(WORKFLOW, /release-assets\/mcp\/\*\.mcpb$/m);
    assert.match(WORKFLOW, /release-assets\/mcp\/\*\.mcpb\.sha256$/m);
    assert.match(WORKFLOW, /pnpm mcp:build-bundle/);
  });

  it('builds the bundle after the updater manifest, which splits architectures by folder', () => {
    assert.ok(
      WORKFLOW.indexOf('Build updater manifest') < WORKFLOW.indexOf('Build the MCP ecosystem bundle'),
      'the manifest builder must not see release-assets/mcp/',
    );
  });

  it('names the artifact the registry entry expects', () => {
    assert.equal(bundleArtifactName(MCP_PACKAGE.version), `ontology-atlas-mcp-${MCP_PACKAGE.version}.mcpb`);
    assert.ok(bundleDownloadUrl('v1.1.0', MCP_PACKAGE.version).endsWith(bundleArtifactName(MCP_PACKAGE.version)));
  });
});
