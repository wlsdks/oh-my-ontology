/**
 * The pure part of the MCP Bundle (`.mcpb`) build.
 *
 * An `.mcpb` is a zip holding one MCP server plus a `manifest.json` that says
 * how to start it — the same idea as `.vsix` or `.crx`. It is the one
 * distribution channel the official MCP Registry accepts that publishes nothing
 * to a package registry: the artifact is a GitHub Release asset, and the
 * registry verifies only its URL and SHA-256. That is why Atlas can be
 * discoverable in the MCP ecosystem while `docs/DECISIONS.md` (2026-07-27) keeps
 * the npm channel retired.
 *
 * Two things here are measured, not assumed:
 *
 * 1. **The bundle carries exactly `mcp/package.json`'s `files` list.** That list
 *    is what the server itself declares as its own shipping surface, so the
 *    bundle cannot drift from it by hand-editing a second list.
 * 2. **One file must lose its types.** `mcp/src/analysis-record.mts` is imported
 *    directly and relies on Node's type stripping, which is unflagged only from
 *    Node 23.6. A host supplies its own Node to a bundle, so the server died on
 *    Node 20 and 22 (`ERR_UNKNOWN_FILE_EXTENSION`) until that single file was
 *    compiled to `.mjs`. With it stripped, the same bundle answered `tools/list`
 *    with all 38 tools on Node 20, 22, 24 and 25. The `engines` floor of
 *    `>=24 <25` is this repository's toolchain choice; the SDK's own floor is
 *    `>=20`.
 */

/** The bundle's own layout. `server/` mirrors `mcp/`, so entry paths stay readable. */
export const BUNDLE_SERVER_DIR = 'server';
export const BUNDLE_ENTRY_POINT = `${BUNDLE_SERVER_DIR}/src/index.js`;

/** The typed module the server imports directly, and the plain name it takes in a bundle. */
export const TYPED_MODULE = 'src/analysis-record.mts';
export const STRIPPED_MODULE = 'src/analysis-record.mjs';

/**
 * A test fixture is not a shipping surface. `mcp/package.json` lists it because
 * `npm test` inside a published package runs the parser smoke test
 * (`check-package-contracts` holds that contract), but a bundle a host installs
 * has no test runner and no reason to carry one.
 */
export const EXCLUDED_FROM_BUNDLE = Object.freeze(['src/parser.test.mjs']);

/**
 * Runtime dependencies are vendored, so the closure is walked the way Node
 * itself resolves it: each package is looked up **from the directory of the
 * package that depends on it**. A flat lookup in `mcp/node_modules` finds the
 * two direct dependencies and misses `zod`, which pnpm keeps in its store and
 * links only under the SDK — measured, and the reason this takes a resolver
 * rather than a path join.
 *
 * `resolvePackageDir(name, fromDir)` returns the real directory or null.
 */
export function dependencyClosure({ rootDependencies, rootDir, resolvePackageDir, readManifest }) {
  const pending = Object.keys(rootDependencies ?? {}).map((name) => ({ name, fromDir: rootDir }));
  const found = new Map();
  const missing = [];
  while (pending.length > 0) {
    const { name, fromDir } = pending.shift();
    if (found.has(name)) continue;
    const dir = resolvePackageDir(name, fromDir);
    if (!dir) {
      missing.push(name);
      continue;
    }
    found.set(name, dir);
    for (const next of Object.keys(readManifest(dir)?.dependencies ?? {})) {
      if (!found.has(next)) pending.push({ name: next, fromDir: dir });
    }
  }
  return {
    packages: [...found.entries()].map(([name, dir]) => ({ name, dir })).sort((a, b) => a.name.localeCompare(b.name)),
    missing: missing.sort(),
  };
}

/** The files copied into `server/`, with the typed module renamed to its stripped twin. */
export function bundleFileList(declaredFiles) {
  return declaredFiles
    .filter((file) => !EXCLUDED_FROM_BUNDLE.includes(file))
    .map((file) => (file === TYPED_MODULE ? STRIPPED_MODULE : file))
    .sort();
}

/**
 * The MCPB manifest. `user_config.vault` is a directory prompt rather than a
 * free-text path because the host renders it as a folder picker, and the server
 * reads exactly one environment variable (`OATLAS_VAULT`) to find the vault.
 *
 * `compatibility.runtimes.node` states the SDK's real floor rather than this
 * repository's `engines` pin — see the note at the top of this file.
 */
export function bundleManifest({ version, description }) {
  return {
    manifest_version: '0.3',
    name: 'ontology-atlas-mcp',
    display_name: 'Ontology Atlas',
    version,
    description,
    long_description:
      'Ontology Atlas keeps what a codebase builds, why its boundaries exist, and what a change ' +
      'affects as an ordinary folder of Markdown inside the repository. This server exposes that ' +
      'folder to an agent as typed tools: read a concept, follow backlinks, find a path between ' +
      'two things, measure a blast radius from declared dependencies only, and propose writes that ' +
      'land as Markdown and a Git diff a person reviews. Nothing is uploaded and no account is ' +
      'involved; the folder on disk is the whole database.',
    author: { name: 'Ontology Atlas', url: 'https://ontologyatlas.com' },
    homepage: 'https://ontologyatlas.com',
    documentation: 'https://github.com/wlsdks/ontology-atlas/blob/main/mcp/README.md',
    support: 'https://github.com/wlsdks/ontology-atlas/issues',
    repository: { type: 'git', url: 'https://github.com/wlsdks/ontology-atlas' },
    license: 'MIT',
    keywords: ['ontology', 'codebase', 'markdown', 'knowledge-graph', 'local-first'],
    server: {
      type: 'node',
      entry_point: BUNDLE_ENTRY_POINT,
      mcp_config: {
        command: 'node',
        args: [`\${__dirname}/${BUNDLE_ENTRY_POINT}`],
        env: { OATLAS_VAULT: '${user_config.vault}' },
      },
    },
    user_config: {
      vault: {
        type: 'directory',
        title: 'Vault folder',
        description:
          'The Markdown folder that holds the ontology — normally atlas/ inside the repository it describes.',
        required: true,
        multiple: false,
      },
    },
    compatibility: {
      platforms: ['darwin', 'win32', 'linux'],
      runtimes: { node: '>=20' },
    },
  };
}

/** The registry entry for the built artifact. Metadata only; the registry hosts no files. */
function registryPackageEntry({ downloadUrl, fileSha256 }) {
  return {
    registryType: 'mcpb',
    identifier: downloadUrl,
    fileSha256,
    transport: { type: 'stdio' },
    environmentVariables: [
      {
        name: 'OATLAS_VAULT',
        description:
          'The Markdown folder that holds the ontology — normally atlas/ inside the repository it describes.',
        isRequired: false,
        format: 'filepath',
        isSecret: false,
      },
    ],
  };
}

/**
 * The registry identity. GitHub-authenticated namespaces are `io.github.<owner>/`,
 * so this name and the repository owner cannot disagree, and the Dockerfile's
 * ownership label must repeat it exactly — `registryInvariantProblems` checks that
 * rather than trusting two files to stay in step.
 */
export const REGISTRY_SERVER_NAME = 'io.github.wlsdks/ontology-atlas';
const OCI_IMAGE_REPOSITORY = 'ghcr.io/wlsdks/ontology-atlas-mcp';
export const OWNERSHIP_LABEL = 'io.modelcontextprotocol.server.name';
const RELEASE_DOWNLOAD_BASE = 'https://github.com/wlsdks/ontology-atlas/releases/download';

/** The artifact's file name, which is also what makes its URL contain "mcp". */
export function bundleArtifactName(version) {
  return `ontology-atlas-mcp-${version}.mcpb`;
}

export function bundleDownloadUrl(tag, version) {
  return `${RELEASE_DOWNLOAD_BASE}/${tag}/${bundleArtifactName(version)}`;
}

/**
 * The complete `server.json` the publisher sends. Every value is derived: the
 * version and description from `mcp/package.json`, the MCPB URL from the release
 * tag, its digest from the built artifact, the image tag from the same version.
 * Nothing here is hand-typed, because a hand-typed digest is a lie the registry
 * would then serve.
 */
export function serverJson({ version, description, tag, fileSha256 }) {
  return {
    $schema: 'https://static.modelcontextprotocol.io/schemas/2025-12-11/server.schema.json',
    name: REGISTRY_SERVER_NAME,
    title: 'Ontology Atlas',
    description,
    version,
    repository: { url: 'https://github.com/wlsdks/ontology-atlas', source: 'github' },
    websiteUrl: 'https://ontologyatlas.com',
    packages: [
      { ...registryPackageEntry({ downloadUrl: bundleDownloadUrl(tag, version), fileSha256 }) },
      {
        registryType: 'oci',
        identifier: `${OCI_IMAGE_REPOSITORY}:${version}`,
        transport: { type: 'stdio' },
        environmentVariables: [
          {
            name: 'OATLAS_VAULT',
            description:
              'The mounted Markdown folder that holds the ontology. The image defaults it to /vault.',
            isRequired: false,
            format: 'filepath',
            isSecret: false,
          },
        ],
      },
    ],
  };
}

/**
 * What must hold whether or not an artifact exists yet: the image label repeats
 * the registry name, the image the label sits on is the one the entry names, and
 * the artifact URL still carries "mcp".
 */
export function registryInvariantProblems({ dockerfile, version, tag = 'v0.0.0' }) {
  const problems = [];
  const label = new RegExp(`^LABEL\\s+${OWNERSHIP_LABEL}="([^"]+)"`, 'm').exec(dockerfile);
  if (!label) {
    problems.push(`mcp/Dockerfile must carry LABEL ${OWNERSHIP_LABEL}="${REGISTRY_SERVER_NAME}" for OCI ownership verification`);
  } else if (label[1] !== REGISTRY_SERVER_NAME) {
    problems.push(`mcp/Dockerfile declares ${OWNERSHIP_LABEL}="${label[1]}" but the registry entry is named ${REGISTRY_SERVER_NAME}`);
  }
  if (!/^ENV\s+OATLAS_VAULT=\/vault$/m.test(dockerfile)) {
    problems.push('mcp/Dockerfile must default OATLAS_VAULT to /vault — the registry entry documents that path');
  }
  problems.push(...artifactUrlProblems(bundleDownloadUrl(tag, version)));
  return problems;
}

/**
 * The registry requires the artifact URL to contain "mcp" — the `.mcpb`
 * extension satisfies it, but only while the file keeps that name, so the rule
 * is checked rather than trusted.
 */
export function artifactUrlProblems(downloadUrl) {
  const problems = [];
  if (!downloadUrl.startsWith('https://github.com/')) {
    problems.push('the registry accepts MCPB artifacts hosted on GitHub or GitLab releases only');
  }
  if (!downloadUrl.toLowerCase().includes('mcp')) {
    problems.push('the artifact URL must contain "mcp" for registry ownership verification');
  }
  return problems;
}
