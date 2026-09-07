import { WIKI_DIR } from "@/shared/lib/wiki-page-schema";

/**
 * A page a person starts by hand. Owner direction 2026-09-07: the wiki is not only what
 * an agent writes. The page carries the contract's shape from the first byte — every
 * section, `created_by: human`, empty `sources:` (the contract allows it) — so the list
 * can say what it still lacks rather than calling the file foreign. The person writes
 * the body in any editor; the folder watcher brings it back.
 */
export function humanPageSlug(title: string): string {
  const words = title
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s-]/gu, " ")
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .join("-");
  return `${WIKI_DIR}/${words || "page"}`;
}

export function buildHumanPage({ title, now }: { title: string; now: Date }): { slug: string; path: string; text: string } {
  const slug = humanPageSlug(title);
  const text = [
    "---",
    `title: ${JSON.stringify(title.trim())}`,
    "created_by: human",
    `compiled_at: ${now.toISOString().replace(/\.\d{3}Z$/, "Z")}`,
    "sources: []",
    "source_hash: {}",
    "status: draft",
    `summary: ${JSON.stringify(title.trim())}`,
    "---",
    "",
    "## Summary",
    "",
    "## Facts",
    "",
    "## Decisions",
    "",
    "## Open questions",
    "",
    "## Not in sources",
    "",
  ].join("\n");
  return { slug, path: `${slug}.md`, text };
}
