import {
  WIKI_CITATION_ANCHOR_PATTERN,
  WIKI_CITATION_PATTERN,
  WIKI_DIR,
  WIKI_SECTION_ORDER,
  WIKI_SOURCES_DIR,
  validateWikiPage,
} from "@/shared/lib/wiki-page-schema";

/**
 * File an answer back into the wiki as a page (the LLM Wiki pattern's "good answers can
 * be filed back"). Owner direction 2026-09-07: the answer to a question a person asked
 * should not vanish into the chat.
 *
 * The page is built by the app, not by another agent turn: a response that uses the
 * canonical wiki headings keeps each line in its declared section, while an unstructured
 * response keeps the legacy citation-driven filing (cited lines become facts and uncited
 * lines go under "Not in sources"). The cited files become `sources:` either way.
 * Citation presence is not proof of semantic entailment. Nor do the Library's current
 * file hashes prove which bytes the answer read: a retained answer may predate them.
 * Until the answer carries a verified read receipt, its source hashes stay unmeasured.
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
  /** A fresh filing identity; callers may supply one for a deterministic retry/test. */
  filingId?: string;
  /**
   * The wiki pages that already write up a source path, so the answer can point at them.
   * A page that lists a source another page lists and links neither is the folder finding
   * `shared-source-unlinked`; the first answer filed from the installed app raised it on
   * three pages at once (2026-09-07). One "See also" line under the summary settles it.
   */
  pagesForSource?: (sourcePath: string) => readonly string[];
  knownSources: readonly string[];
  /** An observation at filing, never a receipt proving which bytes the answer read. */
  observations?: ReadonlyMap<string, string>;
  observedAt?: string;
}

export interface AnswerPageResult {
  slug: string;
  path: string;
  text: string;
  problems: ReadonlyArray<{ code: string; message: string; line?: number }>;
}

/**
 * A citation the way an agent tends to write one when answering in prose: the wiki form
 * `[[src:sources/<file>#p3]]`, or the same address bare or in backticks, with or without the
 * `src:` prefix. All of them mean one place in one document; only the wiki form survives
 * the page contract, so the others are rewritten into it before the page is judged. Seen
 * in the installed app on 2026-09-07: an answer whose every fact pointed at
 * `sources/change-request-CR3.docx#p1` in backticks was refused as uncited.
 */
const LOOSE_CITATION = new RegExp(
  `\`?(?:\\[\\[)?(?:src:)?(${WIKI_SOURCES_DIR}\\/[^\\s\\]\\)\`#|]+)#(${WIKI_CITATION_ANCHOR_PATTERN})(?:\\]\\])?\`?`,
  "g",
);

/** The wiki form only, anchor included; what the validator will count. */
const CITATION = new RegExp(WIKI_CITATION_PATTERN, "g");

// A colon after a plain-text source path names a line, never a PDF page or an
// extracted Office-document paragraph. Ranges retain both explicit endpoints.
const TEXT_LINE_CITATION = new RegExp(
  '(^|[\\s(,;])`?(?:src:)?(' + WIKI_SOURCES_DIR +
    '\\/[^\\s`()[\\]#|:]+\\.(?:md|markdown|txt|csv|tsv|json|jsonl|yaml|yml|toml|ini|log|xml|html|htm|rst)):' +
    '([1-9]\\d*)(?:[-–]([1-9]\\d*))?`?(?!\\.\\d)(?=$|[\\s),.;])',
  'gi',
);

/** Every loose citation in a line rewritten as `[[src:sources/<file>#<anchor>]]`. */
function normalizeCitations(line: string): string {
  const normalizedLines = line.replace(TEXT_LINE_CITATION, (whole, prefix: string, path: string, first: string, last: string | undefined, offset: number) => {
    const start = Number(first);
    const end = last === undefined ? start : Number(last);
    // Do not rewrite a Markdown link destination or a malformed/range-like number.
    if ((prefix === '(' && line.slice(0, offset).endsWith(']')) || !Number.isSafeInteger(start) || !Number.isSafeInteger(end) || end < start) return whole;
    return `${prefix}[[src:${path}#l${start}]]${end === start ? '' : `–[[src:${path}#l${end}]]`}`;
  });
  return normalizedLines.replace(LOOSE_CITATION, (_whole, path: string, anchor: string) => `[[src:${path}#${anchor}]]`);
}

type AnswerSection = (typeof WIKI_SECTION_ORDER)[number];

type AnswerSections = Record<AnswerSection, string[]>;

interface ParsedAnswerLine {
  line: string;
  section: AnswerSection | null;
  fenced: boolean;
}

interface ParsedAnswerSections {
  sections: AnswerSections;
  lines: ParsedAnswerLine[];
}

function emptyAnswerSections(): AnswerSections {
  return {
    Summary: [],
    Facts: [],
    Decisions: [],
    "Open questions": [],
    "Not in sources": [],
  };
}

function answerSection(value: string): AnswerSection | null {
  return (WIKI_SECTION_ORDER as readonly string[]).includes(value)
    ? value as AnswerSection
    : null;
}

/**
 * A response gets section semantics only from the exact wiki headings. Phrases such as
 * "Decision:" in an ordinary answer stay on the old citation-driven path. Unknown level-2
 * headings also end the structured section; their body is handled as unstructured text so
 * this formatter never invents a category for it.
 */
function parseAnswerSections(answer: string): ParsedAnswerSections | null {
  const sections = emptyAnswerSections();
  const lines: ParsedAnswerLine[] = [];
  let current: AnswerSection | null = null;
  let foundCanonicalHeading = false;
  let inFence = false;

  for (const rawLine of answer.split("\n")) {
    const line = rawLine.trim();
    const fence = /^(```|~~~)/.test(line);
    if (!inFence && !fence) {
      const heading = /^##\s+(.+?)\s*$/.exec(line);
      if (heading) {
        current = answerSection(heading[1]!);
        foundCanonicalHeading ||= current !== null;
        if (current === null) lines.push({ line: rawLine, section: null, fenced: false });
        continue;
      }
    }
    lines.push({ line: rawLine, section: current, fenced: inFence || fence });
    if (fence) inFence = !inFence;
  }
  return foundCanonicalHeading ? { sections, lines } : null;
}

export function answerSlug(question: string, now: Date): string {
  const words = Array.from(question
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s-]/gu, " ")
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 6)
    .join("-")).slice(0, 32).join('');
  const stamp = now.toISOString().slice(0, 10);
  return `${WIKI_DIR}/answers/${stamp}-${words || "answer"}`;
}

export function buildAnswerPage(input: AnswerPageInput): AnswerPageResult {
  const parsed = parseAnswerSections(input.answer);
  const cited: string[] = [];
  const uncited: string[] = [];
  const summaryExtras: string[] = [];
  const sources = new Set<string>();
  const collectLine = (rawLine: string, section: AnswerSection | null, fenced = false) => {
    const line = rawLine.trim();
    const normalized = normalizeCitations(line);
    const bare = normalized.replace(/^[-*]\s+/, "");
    const found = [...normalized.matchAll(CITATION)].map((match) => match[1]!.trim());
    found.forEach((path) => sources.add(path));
    if (!parsed) {
      if (!line || /^#{1,6}\s/.test(bare) || /^```/.test(bare)) return;
      if (found.length > 0) {
        cited.push(`- ${bare}`);
      } else if (!/^[{[]/.test(bare)) {
        uncited.push(`- ${bare}`);
      }
      return;
    }
    if (section) {
      if (!line) {
        parsed.sections[section].push("");
        return;
      }
      if (fenced || /^```/.test(normalized)) {
        parsed.sections[section].push(normalized);
        return;
      }
      if (/^#{1,6}\s/.test(bare)) return;
      parsed!.sections[section].push(
        section === "Summary" ? bare : `- ${bare}`,
      );
      return;
    }
    summaryExtras.push(normalized);
  };
  if (parsed) {
    for (const entry of parsed.lines) collectLine(entry.line, entry.section, entry.fenced);
  } else {
    for (const line of input.answer.split("\n")) collectLine(line, null);
  }
  const filingId = input.filingId ?? globalThis.crypto.randomUUID();
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(filingId)) {
    throw new Error('A filed answer requires a fresh UUIDv4 identity.');
  }
  const slug = `${answerSlug(input.question, input.now)}-${filingId.toLowerCase()}`;
  const sourceList = [...sources];
  const related = [
    ...new Set(sourceList.flatMap((path) => input.pagesForSource?.(path) ?? [])),
  ].filter((page) => page !== input.askedOn && page !== slug);
  const summaryContext = `${input.askedOn ? ` Asked while reading [[${input.askedOn}]].` : ""}${
    related.length > 0 ? ` See also ${related.map((page) => `[[${page}]]`).join(", ")}.` : ""
  }`;
  const summary = parsed && parsed.sections.Summary.length > 0
    ? [...parsed.sections.Summary]
    : [input.question.trim()];
  if (parsed) summary.push(...summaryExtras);
  summary[summary.length - 1] = `${summary[summary.length - 1]!}${summaryContext}`;
  const facts = parsed ? parsed.sections.Facts : cited;
  const decisions = parsed ? parsed.sections.Decisions : [];
  const openQuestions = parsed ? parsed.sections["Open questions"] : [];
  const notInSources = parsed ? [...parsed.sections["Not in sources"], ...uncited] : uncited;
  const yaml = (value: string) => JSON.stringify(value);
  const text = [
    "---",
    `title: ${yaml(input.question.trim())}`,
    `created_by: ${input.writer}`,
    `compiled_at: ${input.now.toISOString().replace(/\.\d{3}Z$/, "Z")}`,
    "sources:",
    ...sourceList.map((path) => `  - ${path}`),
    "source_hash:",
    ...sourceList.map((path) => `  ${path}: unmeasured`),
    "status: draft",
    `summary: ${yaml(`An answer filed from the conversation${input.askedOn ? ` while reading ${input.askedOn}` : ""}.`)}`,
    `answer_question: ${yaml(input.question.trim())}`,
    `answer_thread: ${yaml(slug)}`,
    `answer_observed_at: ${yaml(input.observedAt ?? input.now.toISOString())}`,
    'answer_scope_sources:',
    ...input.knownSources.map((path) => `  - ${path}`),
    'answer_source_observations:',
    ...sourceList.map((path) => {
      const hash = input.observations?.get(path);
      return `  ${path}: ${hash && /^[a-f0-9]{64}$/i.test(hash) ? hash.toLowerCase() : 'unmeasured'}`;
    }),
    "---",
    "",
    "## Summary",
    "",
    ...summary,
    "",
    "## Facts",
    "",
    ...facts,
    "",
    "## Decisions",
    "",
    ...decisions,
    "",
    "## Open questions",
    "",
    ...openQuestions,
    "",
    "## Not in sources",
    "",
    ...notInSources,
    "",
  ]
    .join("\n")
    // An empty Facts or Not in sources list would leave two blank lines in a row.
    .replace(/\n{3,}/g, "\n\n");
  const verdict = validateWikiPage(text, { knownSources: input.knownSources });
  // An answer that cites nothing is not filed: a page whose every line sits under "Not in
  // sources" would carry the question's title into the wiki with no evidence behind it.
  const problems =
    sources.size === 0
      ? [
          {
            code: "no-cited-fact",
            message: "The answer cites no place in any source, so there is no fact to file.",
          },
          ...verdict.problems,
        ]
      : verdict.problems;
  return { slug, path: `${slug}.md`, text, problems };
}
