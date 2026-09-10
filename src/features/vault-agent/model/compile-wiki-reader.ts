import { parseFrontmatter } from '@/shared/lib/parse-frontmatter';
import { isWikiFurnitureSlug } from '@/shared/lib/wiki-page-schema';

import { wrapUntrusted } from './concept-evidence-pack';
import { SOURCE_TEXT_CHAR_CAP } from './source-text';
import type { ToolExecution } from './tool-executor';

type PageSnapshot = { text: string; mtime: number };

/** Only exact, vault-relative wiki addresses may enter the local Compile reader. */
function wikiAddress(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const slug = value.trim().replace(/\.md$/, '');
  if (!slug.startsWith('wiki/') || /[\\#?\u0000-\u001f]/.test(slug) || isWikiFurnitureSlug(slug)) return null;
  if (slug.split('/').some((part) => !part || part.startsWith('.') || part.startsWith('_'))) return null;
  return slug;
}

/** A turn reads one immutable snapshot per page; its mtime travels to the write guard. */
export function createCompileWikiReader(
  slugs: readonly string[],
  readPage: (slug: string) => Promise<PageSnapshot | null>,
) {
  const inventory = new Set(slugs.filter((slug) => wikiAddress(slug) === slug));
  const snapshots = new Map<string, { page: PageSnapshot; covered: number }>();
  const resolve = (value: unknown) => {
    const slug = wikiAddress(value);
    return slug && inventory.has(slug) ? slug : null;
  };
  return {
    resolve,
    snapshot(slug: string): PageSnapshot | null {
      const read = snapshots.get(slug);
      return read && read.covered === read.page.text.length ? read.page : null;
    },
    async execute(args: Record<string, unknown>): Promise<ToolExecution> {
      const slug = resolve(args.slug);
      const failure = (refusal: string, hint: string): ToolExecution => ({
        content: JSON.stringify({ readable: false, refusal, hint }),
        isError: true, outcome: 'error', target: slug ?? '', summary: hint, readSlugs: [], vaultChars: 0,
      });
      if (!slug) return failure('wiki-path-refused', 'Read an exact wiki slug from the page index; ontology nodes and index files are not wiki pages.');
      let record = snapshots.get(slug);
      if (!record) {
        const page = await readPage(slug).catch(() => null);
        if (!page) return failure('wiki-unreadable', `Could not read ${slug}; do not replace it.`);
        const { frontmatter } = parseFrontmatter(page.text);
        if (typeof frontmatter.kind === 'string' && frontmatter.kind.trim()) {
          return failure('wiki-kind-present', `${slug} is an ontology node and cannot be read or rewritten by Compile.`);
        }
        record = { page, covered: 0 };
        snapshots.set(slug, record);
      }
      const from = args.from ?? 0;
      // Reads advance a contiguous prefix. An omitted middle must never count as read.
      if (typeof from !== 'number' || !Number.isSafeInteger(from) || from < 0 || from > record.covered) {
        return failure('wiki-offset-invalid', `Continue reading ${slug} from offset ${record.covered}.`);
      }
      const text = record.page.text.slice(from, from + SOURCE_TEXT_CHAR_CAP);
      const end = from + text.length;
      record.covered = Math.max(record.covered, end);
      const truncated = end < record.page.text.length;
      return {
        content: JSON.stringify({ slug, from, text: wrapUntrusted(text), totalChars: record.page.text.length,
          truncated, ...(truncated ? { next: end } : {}),
          hint: 'This is a prior write-up, not a fresh source receipt. Read its originals before citing or revising it.',
        }),
        isError: false, outcome: 'ok', target: slug, summary: `Read ${slug}${truncated ? ' (continued read needed)' : ''}`,
        readSlugs: [], vaultChars: text.length,
      };
    },
  };
}
