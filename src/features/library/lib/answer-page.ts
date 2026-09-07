import { WIKI_DIR, validateWikiPage } from "@/shared/lib/wiki-page-schema";

/**
 * File an answer back into the wiki as a page (the LLM Wiki pattern's "good answers can
 * be filed back"). Owner direction 2026-09-07: the answer to a question a person asked
 * should not vanish into the chat.
 *
 * The page is built by the app, not by another agent turn: the question becomes the
 * summary, every answer line that carries a `[[src:…]]` citation becomes a fact, the cited
 * files become `sources:` with the hashes the Library already measured, and lines with no
 * citation go under "Not in sources" so the page never claims more than the answer proved.
 * The result is judged by the same validator every page meets; a page that does not fit
 * is not written, and the problems come back instead.
 */
export interface AnswerPageInput {
  question: string;
  answer: string;
  /** `wiki/<slug>` of the page the question was asked on, linked from the summary. */
  askedOn: string | null;
  writer: string;
  now: Date;
  /** sha256 by vault-relative source path, from the Library's own measurement. */
  hashes: ReadonlyMap<string, string>;
  knownSources: readonly string[];
}

export interface AnswerPageResult {
  slug: string;
  path: string;
  text: string;
  problems: ReadonlyArray<{ code: string; message: string; line?: number }>;
}

const CITATION = /\[\[src:([^\]#|]+)(?:#[^\]]*)?\]\]/g;

export function answerSlug(question: string, now: Date): string {
  const words = question
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s-]/gu, " ")
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 6)
    .join("-");
  const stamp = now.toISOString().slice(0, 10);
  return `${WIKI_DIR}/answers/${stamp}-${words || "answer"}`;
}

export function buildAnswerPage(input: AnswerPageInput): AnswerPageResult {
  const lines = input.answer.split("\n").map((line) => line.trim()).filter(Boolean);
  const cited: string[] = [];
  const uncited: string[] = [];
  const sources = new Set<string>();
  for (const line of lines) {
    const bare = line.replace(/^[-*]\s+/, "");
    if (/^#{1,6}\s/.test(bare) || /^```/.test(bare)) continue;
    const found = [...bare.matchAll(CITATION)].map((match) => match[1]!.trim());
    if (found.length > 0) {
      found.forEach((path) => sources.add(path));
      cited.push(`- ${bare}`);
    } else if (!/^[{[]/.test(bare)) {
      uncited.push(`- ${bare}`);
    }
  }
  const slug = answerSlug(input.question, input.now);
  const sourceList = [...sources];
  const yaml = (value: string) => JSON.stringify(value);
  const text = [
    "---",
    `title: ${yaml(input.question.trim())}`,
    `created_by: ${input.writer}`,
    `compiled_at: ${input.now.toISOString().replace(/\.\d{3}Z$/, "Z")}`,
    "sources:",
    ...sourceList.map((path) => `  - ${path}`),
    "source_hash:",
    ...sourceList.map((path) => `  ${path}: ${input.hashes.get(path) ?? "unmeasured"}`),
    "status: draft",
    `summary: ${yaml(`An answer filed from the conversation${input.askedOn ? ` while reading ${input.askedOn}` : ""}.`)}`,
    "---",
    "",
    "## Summary",
    "",
    `${input.question.trim()}${input.askedOn ? ` Asked while reading [[${input.askedOn}]].` : ""}`,
    "",
    "## Facts",
    "",
    ...(cited.length > 0 ? cited : ["- (no cited fact in the answer)"]),
    "",
    "## Decisions",
    "",
    "## Open questions",
    "",
    "## Not in sources",
    "",
    ...uncited,
    "",
  ].join("\n");
  const verdict = validateWikiPage(text, { knownSources: input.knownSources });
  return { slug, path: `${slug}.md`, text, problems: verdict.problems };
}
