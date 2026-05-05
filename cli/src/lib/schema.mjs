/**
 * Vault kind schema — mirror copy of `mcp/src/schema.mjs`. The MCP server
 * (`add_concept`) and this CLI (`oh-my-ontology add`) must produce the same
 * frontmatter shape so an AI agent and a developer working side-by-side never
 * leave behind half-shaped nodes.
 *
 * `tests/contract/vault-schema.contract.test.ts` keeps the two copies in
 * lock-step; if you change anything here, mirror it in `mcp/src/schema.mjs`
 * (and vice versa) — the contract test will fail otherwise.
 *
 * See the documentation in `mcp/src/schema.mjs` for the field-category
 * conventions (arrayDefaults / optional / requiredExtras).
 */

export const VAULT_KINDS = ['project', 'domain', 'capability', 'element', 'document'];

export const VAULT_KIND_SCHEMA = {
  project: {
    folder: '',
    arrayDefaults: ['domains', 'capabilities', 'elements'],
    optional: ['dependencies', 'relates', 'description', 'status'],
    requiredExtras: [],
    bodyTemplate: (title) =>
      `# ${title}\n\n` +
      `One- or two-line summary of this project — *what / for whom / why*.\n\n` +
      `## How it grows\n\n` +
      `- Fill \`domains: [...]\` in the frontmatter and the domain nodes hang\n` +
      `  off the project tree automatically.\n` +
      `- Each domain's capabilities and elements follow the same pattern.\n`,
  },
  domain: {
    folder: 'domains/',
    arrayDefaults: ['capabilities'],
    optional: ['depends_on', 'relates', 'description'],
    requiredExtras: [],
    bodyTemplate: (title) =>
      `# ${title}\n\n` +
      `A *domain* is a large area of the project (auth, billing, search, …). ` +
      `Describe in one or two paragraphs what it covers and which capabilities live inside.\n`,
  },
  capability: {
    folder: 'capabilities/',
    arrayDefaults: ['elements'],
    optional: ['depends_on', 'relates', 'description'],
    requiredExtras: ['domain'],
    bodyTemplate: (title) =>
      `# ${title}\n\n` +
      `A *capability* is one user-visible feature within a domain. Describe what it does and one or two user scenarios.\n`,
  },
  element: {
    folder: 'elements/',
    arrayDefaults: [],
    optional: ['path', 'depends_on', 'relates', 'description'],
    requiredExtras: ['domain'],
    bodyTemplate: (title) =>
      `# ${title}\n\n` +
      `An *element* is a smaller unit a capability uses (jwt-token, indexeddb-adapter, sigma-canvas, …). Cover *what / why / which interface*.\n`,
  },
  document: {
    folder: '',
    arrayDefaults: [],
    optional: ['describes', 'relates'],
    requiredExtras: [],
    bodyTemplate: (title) => `# ${title}\n`,
  },
};

export function buildFrontmatter({ slug, kind, title, ...extras }) {
  if (!VAULT_KIND_SCHEMA[kind]) {
    throw new Error(
      `Unknown kind: ${kind}. Expected one of ${VAULT_KINDS.join(' / ')}.`,
    );
  }
  const schema = VAULT_KIND_SCHEMA[kind];
  const fm = { slug, kind, title };
  for (const key of schema.arrayDefaults) {
    fm[key] = Array.isArray(extras[key]) ? extras[key] : [];
  }
  for (const [key, value] of Object.entries(extras)) {
    if (value === undefined || value === null) continue;
    if (key in fm && Array.isArray(fm[key]) && Array.isArray(value)) {
      fm[key] = value;
      continue;
    }
    fm[key] = value;
  }
  return fm;
}

export function defaultBody(kind, title) {
  const schema = VAULT_KIND_SCHEMA[kind];
  if (!schema) throw new Error(`Unknown kind: ${kind}`);
  return schema.bodyTemplate(title);
}

export function folderForKind(kind) {
  const schema = VAULT_KIND_SCHEMA[kind];
  if (!schema) return '';
  return schema.folder;
}

export function missingExpectedFields(kind, frontmatter) {
  const schema = VAULT_KIND_SCHEMA[kind];
  if (!schema) return [];
  const missing = [];
  for (const key of schema.requiredExtras) {
    const value = frontmatter[key];
    if (value === undefined || value === null) {
      missing.push(key);
      continue;
    }
    if (typeof value === 'string' && value.trim() === '') {
      missing.push(key);
    }
  }
  return missing;
}
