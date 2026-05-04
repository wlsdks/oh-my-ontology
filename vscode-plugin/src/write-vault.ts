import { promises as fs } from 'fs';
import * as path from 'path';

/**
 * Write a new vault node `.md` file. Mirrors the contract enforced by
 * the CLI's `add` command (`cli/src/lib/write-vault.mjs`):
 *
 *   - Throws if the target file already exists (duplicate slug guard).
 *   - Creates parent directories as needed.
 *   - Frontmatter is rendered with explicit keys in order:
 *     `slug`, `kind`, `title`, `domain?`, then any extras.
 *   - Body defaults to `# {title}` when omitted.
 *
 * Returns the absolute path of the written file.
 */

export interface WriteDocOptions {
  frontmatter: Record<string, unknown>;
  body?: string;
}

const FOLDER_BY_KIND: Record<string, string> = {
  project: '',
  domain: 'domains/',
  capability: 'capabilities/',
  element: 'elements/',
  document: '',
};

/**
 * Resolve the effective slug. If `autoPrefix` is true and the slug
 * doesn't already start with the kind's folder, prepend it. Mirrors
 * the CLI's `--auto-prefix` flag (`cli/src/commands/add.mjs`).
 */
export function resolveSlug(
  kind: string,
  rawSlug: string,
  autoPrefix: boolean,
): string {
  const folder = FOLDER_BY_KIND[kind] ?? '';
  if (autoPrefix && folder && !rawSlug.startsWith(folder)) {
    return `${folder}${rawSlug}`;
  }
  return rawSlug;
}

export async function writeDoc(
  vaultRoot: string,
  slug: string,
  options: WriteDocOptions,
): Promise<string> {
  const filePath = path.join(vaultRoot, `${slug}.md`);
  try {
    await fs.access(filePath);
    throw new Error(
      `Doc already exists at ${path.relative(vaultRoot, filePath)} — refusing to overwrite. Edit the file directly or pick a different slug.`,
    );
  } catch (err) {
    // ENOENT (file doesn't exist) is the expected happy path.
    if (
      err instanceof Error &&
      'code' in err &&
      (err as NodeJS.ErrnoException).code !== 'ENOENT'
    ) {
      throw err;
    }
    if (
      err instanceof Error &&
      err.message.startsWith('Doc already exists')
    ) {
      throw err;
    }
  }
  const dir = path.dirname(filePath);
  await fs.mkdir(dir, { recursive: true });
  const md = renderMarkdown(options.frontmatter, options.body);
  await fs.writeFile(filePath, md, 'utf-8');
  return filePath;
}

function renderMarkdown(
  frontmatter: Record<string, unknown>,
  body?: string,
): string {
  const lines: string[] = ['---'];
  // Canonical key order for readability (matches CLI / mcp behavior).
  const ORDER = ['slug', 'kind', 'title', 'domain', 'path'];
  const ordered = new Set<string>();
  for (const key of ORDER) {
    if (key in frontmatter) {
      lines.push(formatKv(key, frontmatter[key]));
      ordered.add(key);
    }
  }
  for (const key of Object.keys(frontmatter)) {
    if (ordered.has(key)) continue;
    lines.push(formatKv(key, frontmatter[key]));
  }
  lines.push('---');
  const title = frontmatter.title;
  const fallbackBody = `\n# ${typeof title === 'string' ? title : 'Untitled'}\n`;
  return `${lines.join('\n')}\n${body ?? fallbackBody}`;
}

function formatKv(key: string, value: unknown): string {
  if (value == null) return `${key}:`;
  if (Array.isArray(value)) {
    if (value.length === 0) return `${key}: []`;
    const items = value.map((v) => `  - ${String(v)}`).join('\n');
    return `${key}:\n${items}`;
  }
  if (typeof value === 'object') {
    return `${key}: ${JSON.stringify(value)}`;
  }
  const str = String(value);
  // Wrap with quotes if the value would parse ambiguously
  if (/[:#]/.test(str) && !/^['"]/.test(str)) {
    return `${key}: "${str.replace(/"/g, '\\"')}"`;
  }
  return `${key}: ${str}`;
}
