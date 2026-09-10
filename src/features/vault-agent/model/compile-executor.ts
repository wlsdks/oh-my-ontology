import { isWikiFurnitureSlug, WIKI_DIR } from '@/shared/lib/wiki-page-schema';

import { wrapUntrusted } from './concept-evidence-pack';
import type { NormalizedToolCall } from './provider-adapter';
import type { SourceReadPort } from './source-read-port';
import {
  classifySourceFormat,
  decodeSourceText,
  measureSourceText,
  numberParagraphs,
  sourcePathProblem,
  SOURCE_TEXT_CHAR_CAP,
} from './source-text';
import type { ToolExecution } from './tool-executor';
import { AGENT_TURN_VAULT_CHAR_CAP } from './types';
import {
  buildWikiPageProposal,
  type CompileSourceRead,
  type WikiPageProposal,
} from './wiki-proposal';

/**
 * The Compile turn's tool executor — **the second place in this feature where a model's
 * write call does not reach the disk.**
 *
 * It is injected with a `SourceReadPort` (no write method) and returns proposals; the file
 * is created only by `applyProposal`, from the consent card's handler, exactly as a
 * concept change is. `propose_wiki_page` is declared `effect: 'write'` and is still
 * executed here, because "executing" it means assembling and judging a page — no byte
 * leaves this module.
 *
 * **Two facts a model may not assert are asserted here instead**: which sources it
 * actually received, and the sha256 of each. Both are recorded as the read happens, and
 * `wiki-proposal.ts` builds the frontmatter from this record rather than from the writer's
 * answer.
 *
 * **A failed proposal is returned to the writer, not swallowed.** The problems come back
 * as the tool result so the next round can fix them; only the last proposal for a given
 * page survives, so a corrected second attempt replaces the first rather than queueing two
 * cards for one file.
 */

export interface CompileExecutorDeps {
  sourcePort: SourceReadPort;
  /** The runner's model name — `created_by: model:<name>`. */
  model: string;
  /** Injected so a proposal's `compiled_at` is testable. */
  now: () => Date;
  /** The page already at this slug, when one is there. Null otherwise. */
  readExistingPage: (slug: string) => Promise<{ text: string; mtime: number } | null>;
  /** How many pages this turn may propose. */
  pageCap: number;
}

export interface CompileExecutor {
  execute(call: NormalizedToolCall): Promise<ToolExecution>;
  /** Everything `read_source_text` touched this turn, in call order. */
  reads(): CompileSourceRead[];
  /** The surviving proposal per page, in first-proposed order. */
  proposals(): WikiPageProposal[];
}

function fail(name: string, target: string, summary: string, payload: unknown): ToolExecution {
  return {
    content: JSON.stringify(payload),
    isError: true,
    outcome:
      name === 'read_source_text' || name === 'read_wiki_page' || name === 'propose_wiki_page'
        ? 'error'
        : 'unknown-tool',
    target,
    summary,
    readSlugs: [],
    vaultChars: 0,
  };
}

function asArgs(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
}

function stringList(value: unknown): string[] {
  if (!Array.isArray(value)) return typeof value === 'string' ? [value] : [];
  return value.filter((entry): entry is string => typeof entry === 'string');
}

/** A Compile Wiki target is deliberately narrower than the general Wiki slug helper. */
const WIKI_BASENAME_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const WIKI_CHUNK_CHAR_CAP = 4_000;

interface CompileWikiTarget {
  basename: string;
  slug: string;
  path: string;
}

interface CompileWikiSnapshot {
  text: string;
  mtime: number;
}

interface CompileWikiReadState {
  target: CompileWikiTarget;
  exists: boolean;
  snapshot: CompileWikiSnapshot | null;
  nextCursor: number | null;
  receipt: string | null;
  failed: boolean;
}

/**
 * Resolve only the two spellings the local runner can safely address: `records` and
 * `wiki/records.md`. Dropping a folder, punctuation or an extension here would turn an
 * invalid model argument into a different file, which is precisely what this boundary
 * prevents.
 */
function compileWikiTarget(raw: unknown): CompileWikiTarget | null {
  if (typeof raw !== 'string') return null;
  const value = raw.trim();
  if (!value || /[\u0000-\u001f\u007f]/.test(value) || value.includes('\\')) return null;

  let basename = value;
  if (value.startsWith(`${WIKI_DIR}/`)) {
    if (!value.endsWith('.md') || value.slice(`${WIKI_DIR}/`.length, -'.md'.length).includes('/')) return null;
    basename = value.slice(`${WIKI_DIR}/`.length, -'.md'.length);
  } else if (value.includes('/')) {
    return null;
  }

  if (basename.length > 80 || !WIKI_BASENAME_PATTERN.test(basename)) return null;
  const slug = `${WIKI_DIR}/${basename}`;
  if (isWikiFurnitureSlug(slug)) return null;
  return { basename, slug, path: `${slug}.md` };
}

function mintWikiReceipt(): string | null {
  const crypto = globalThis.crypto;
  try {
    if (crypto?.randomUUID) return crypto.randomUUID();
  } catch {
    // Fall through to the other Web Crypto primitive, if one is available.
  }
  if (crypto?.getRandomValues) {
    try {
      const bytes = new Uint8Array(18);
      crypto.getRandomValues(bytes);
      return [...bytes].map((byte) => byte.toString(16).padStart(2, '0')).join('');
    } catch {
      // Refuse below when the runtime cannot provide an unpredictable token.
    }
  }
  // Without Web Crypto the runner cannot make a receipt unpredictable. Refuse the
  // replacement gate instead of weakening it with a timestamp or Math.random token.
  return null;
}

function finiteCursor(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
}

const REFUSAL_SENTENCES: Record<string, string> = {
  'needs-a-parser':
    'Atlas cannot open this format without a parser it does not ship. Name the file in plain words under Not in sources and do not guess what it contains. Do not write a [[src:...]] citation for it — a citation points at text you were given.',
  'unknown-format':
    'Atlas does not know how to read this format as text. Name the file in plain words under Not in sources and do not guess what it contains. Do not write a [[src:...]] citation for it.',
  'not-in-this-folder':
    'This folder holds no such file under sources/. Use one of the paths you were given; do not invent one.',
  'path-refused':
    'Only a plain path under sources/ that this folder holds can be read. No parent segments, no absolute paths.',
  unreadable: 'The file is in the folder but could not be opened just now.',
  'hash-unavailable':
    'The file was read, but this computer could not measure its sha256, so a page cannot record what it read.',
};

export function createCompileExecutor(deps: CompileExecutorDeps): CompileExecutor {
  const inventory = new Map(deps.sourcePort.sources.map((entry) => [entry.path, entry]));
  const reads: CompileSourceRead[] = [];
  const readByPath = new Map<string, CompileSourceRead>();
  const proposals = new Map<string, WikiPageProposal>();
  const wikiReads = new Map<string, CompileWikiReadState>();
  let transferredChars = 0;

  function reserveVaultChars(chars: number): boolean {
    if (chars < 0 || transferredChars + chars > AGENT_TURN_VAULT_CHAR_CAP) return false;
    transferredChars += chars;
    return true;
  }

  function revokeProposal(slug: string, code: string, message: string): void {
    const previous = proposals.get(slug);
    if (!previous) return;
    const alreadyReported = previous.problems.some(
      (problem) => problem.code === code && problem.message === message,
    );
    proposals.set(slug, {
      ...previous,
      ok: false,
      problems: alreadyReported
        ? previous.problems
        : [...previous.problems, { code, message }],
    });
  }

  function record(read: CompileSourceRead): CompileSourceRead {
    const existing = readByPath.get(read.path);
    if (existing) {
      Object.assign(existing, read);
      return existing;
    }
    reads.push(read);
    readByPath.set(read.path, read);
    return read;
  }

  async function readSource(rawPath: unknown): Promise<ToolExecution> {
    const path = typeof rawPath === 'string' ? rawPath.trim() : '';
    const shape = sourcePathProblem(path);
    if (shape) {
      record({
        path: path || '(no path)',
        format: '',
        readable: false,
        refusal: 'path-refused',
        truncated: false,
        sha256: null,
        measure: null,
      });
      return fail('read_source_text', path, `Refused ${path || 'an empty path'}`, {
        path,
        readable: false,
        refusal: 'path-refused',
        detail: shape,
        hint: REFUSAL_SENTENCES['path-refused'],
      });
    }

    const entry = inventory.get(path);
    if (!entry) {
      record({
        path,
        format: '',
        readable: false,
        refusal: 'not-in-this-folder',
        truncated: false,
        sha256: null,
        measure: null,
      });
      return fail('read_source_text', path, `${path} is not in this folder`, {
        path,
        readable: false,
        refusal: 'not-in-this-folder',
        hint: REFUSAL_SENTENCES['not-in-this-folder'],
        available: [...inventory.keys()].slice(0, 30),
      });
    }

    const verdict = classifySourceFormat(entry.format);
    if (verdict !== 'readable') {
      record({
        path,
        format: entry.format,
        readable: false,
        refusal: verdict,
        truncated: false,
        sha256: null,
        measure: null,
      });
      return fail('read_source_text', path, `Cannot read ${entry.format || 'this format'} here`, {
        path,
        format: entry.format,
        readable: false,
        refusal: verdict,
        hint: REFUSAL_SENTENCES[verdict],
      });
    }

    let bytes: ArrayBuffer | null = null;
    try {
      bytes = await deps.sourcePort.readSourceBytes(path);
    } catch {
      bytes = null;
    }
    if (!bytes) {
      record({
        path,
        format: entry.format,
        readable: false,
        refusal: 'unreadable',
        truncated: false,
        sha256: null,
        measure: null,
      });
      return fail('read_source_text', path, `Could not open ${path}`, {
        path,
        readable: false,
        refusal: 'unreadable',
        hint: REFUSAL_SENTENCES.unreadable,
      });
    }

    const decoded = decodeSourceText(bytes, entry.format);
    const measure = measureSourceText(decoded.text);
    /*
     * The hash is of **the whole file**, never of the capped slice. `deriveSourceState`
     * in `vault-library.ts` compares a page's recorded hash against the file's own
     * sha256, so a partial-bytes hash would render a brand-new page stale the moment it
     * landed (PO steward, 2026-09-06). What the cap costs is stated instead: `truncated`
     * rides the result, the page says it under Not in sources, and the card says it too.
     */
    let sha256: string | null = null;
    try {
      sha256 = await deps.sourcePort.hashSource(path);
    } catch {
      sha256 = null;
    }

    const text = numberParagraphs(decoded.text);
    if (!reserveVaultChars(text.length)) {
      return fail('read_source_text', path, `Read budget reached before ${path} could be returned`, {
        path,
        readable: false,
        refusal: 'over-budget',
        budget: AGENT_TURN_VAULT_CHAR_CAP,
        used: transferredChars,
      });
    }

    const read = record({
      path,
      format: entry.format,
      readable: true,
      refusal: sha256 ? null : 'hash-unavailable',
      truncated: decoded.truncated,
      sha256,
      measure,
    });

    return {
      content: JSON.stringify({
        path,
        format: entry.format,
        readable: true,
        paragraphs: measure.paragraphs,
        lines: measure.lines,
        headings: measure.headings,
        truncated: decoded.truncated,
        totalChars: decoded.totalChars,
        charCap: SOURCE_TEXT_CHAR_CAP,
        citeAs: `[[src:${path}#p<n>]]`,
        hint: read.sha256
          ? 'Cite a paragraph by the number in front of it. Never use a number this result did not print.'
          : REFUSAL_SENTENCES['hash-unavailable'],
        text: wrapUntrusted(text),
      }),
      isError: false,
      outcome: 'ok',
      target: path,
      summary: decoded.truncated
        ? `Read the first ${SOURCE_TEXT_CHAR_CAP.toLocaleString('en-US')} characters of ${path}`
        : `Read ${path}`,
      readSlugs: [],
      // Measured: these are the characters that ride the next round trip and land in the
      // audit line's `vaultChars`. A source's contents leaving this computer is the fact
      // the transfer sentence on the shelf is about, so it is counted, never estimated.
      vaultChars: text.length,
    };
  }

  function proposalFields(args: Record<string, unknown>, target: CompileWikiTarget) {
    return {
      slug: target.slug,
      title: String(args.title ?? ''),
      summary: String(args.summary ?? ''),
      overview: stringList(args.overview),
      facts: stringList(args.facts),
      decisions: stringList(args.decisions),
      openQuestions: stringList(args.open_questions),
      notInSources: stringList(args.not_in_sources),
    };
  }

  function proposalFailure(
    args: Record<string, unknown>,
    target: CompileWikiTarget,
    code: string,
    reason: string,
    message: string,
    existing: CompileWikiSnapshot | null,
  ): ToolExecution {
    const draft = buildWikiPageProposal(
      proposalFields(args, target),
      { reads, model: deps.model, now: deps.now(), existing },
    );
    const proposal: WikiPageProposal = {
      ...draft,
      ok: false,
      problems: [{ code, message }, ...draft.problems],
    };
    proposals.set(target.slug, proposal);
    return {
      content: JSON.stringify({
        proposed: false,
        path: target.path,
        slug: target.slug,
        reason,
        problems: proposal.problems,
        hint: 'Nothing was written. Read the current page as instructed, then propose it again with the returned receipt.',
      }),
      isError: true,
      outcome: 'error',
      target: target.path,
      summary: message,
      readSlugs: [],
      vaultChars: 0,
    };
  }

  function wikiReadFailure(
    target: CompileWikiTarget | null,
    rawSlug: unknown,
    reason: string,
    summary: string,
    extra: Record<string, unknown> = {},
  ): ToolExecution {
    const path = target?.path ?? String(rawSlug ?? '');
    return fail('read_wiki_page', path, summary, {
      path,
      ...(target ? { slug: target.slug } : {}),
      reason,
      complete: false,
      ...extra,
    });
  }

  function wikiChunk(state: CompileWikiReadState): ToolExecution {
    const snapshot = state.snapshot;
    if (!snapshot) {
      return wikiReadFailure(state.target, state.target.slug, 'not-found', 'No Wiki page exists at this path', {
        exists: false,
        cursor: 0,
        nextCursor: null,
        coverage: { start: 0, end: 0, total: 0, complete: true },
      });
    }

    const cursor = state.nextCursor ?? 0;
    const end = Math.min(cursor + WIKI_CHUNK_CHAR_CAP, snapshot.text.length);
    const chunk = snapshot.text.slice(cursor, end);
    if (!reserveVaultChars(chunk.length)) {
      state.failed = true;
      revokeProposal(
        state.target.slug,
        'wiki-read-over-budget',
        `The current Wiki page could not be read within the ${AGENT_TURN_VAULT_CHAR_CAP.toLocaleString('en-US')}-character turn budget.`,
      );
      return wikiReadFailure(
        state.target,
        state.target.slug,
        'over-budget',
        'The Wiki read stopped before this chunk could be returned',
        {
          exists: true,
          cursor,
          nextCursor: cursor,
          coverage: { start: cursor, end: cursor, total: snapshot.text.length, complete: false },
          remainingChars: snapshot.text.length - cursor,
          budget: AGENT_TURN_VAULT_CHAR_CAP,
          used: transferredChars,
        },
      );
    }

    const complete = end === snapshot.text.length;
    const receipt = complete ? mintWikiReceipt() : null;
    if (complete && !receipt) {
      state.failed = true;
      revokeProposal(
        state.target.slug,
        'wiki-receipt-unavailable',
        'The runtime could not mint an unpredictable Wiki replacement receipt.',
      );
      return wikiReadFailure(
        state.target,
        state.target.slug,
        'receipt-unavailable',
        'The complete Wiki read cannot authorize a replacement on this runtime',
        {
          exists: true,
          cursor,
          nextCursor: null,
          coverage: { start: cursor, end, total: snapshot.text.length, complete: false },
          remainingChars: 0,
        },
      );
    }
    state.nextCursor = complete ? null : end;
    state.receipt = receipt;
    return {
      content: JSON.stringify({
        path: state.target.path,
        slug: state.target.slug,
        exists: true,
        readable: true,
        cursor,
        nextCursor: state.nextCursor,
        complete,
        coverage: { start: cursor, end, total: snapshot.text.length, complete },
        remainingChars: snapshot.text.length - end,
        text: wrapUntrusted(chunk),
        ...(state.receipt ? { receipt: state.receipt } : {}),
      }),
      isError: false,
      outcome: 'ok',
      target: state.target.path,
      summary: complete
        ? `Read ${state.target.path} completely; the replacement receipt is ready`
        : `Read ${state.target.path} characters ${cursor.toLocaleString('en-US')}–${end.toLocaleString('en-US')}`,
      readSlugs: [],
      // As with source reads, charge only the untrusted page text that enters the next
      // request; wrappers and protocol metadata are not vault content.
      vaultChars: chunk.length,
    };
  }

  async function readWikiPage(args: Record<string, unknown>): Promise<ToolExecution> {
    const rawSlug = args.slug;
    const target = compileWikiTarget(rawSlug);
    if (!target) {
      return wikiReadFailure(
        null,
        rawSlug,
        'path-refused',
        'Refused the Wiki path before opening the vault',
        { detail: 'Use a safe basename such as `records` or the exact `wiki/records.md` spelling.' },
      );
    }

    const cursorProvided = Object.prototype.hasOwnProperty.call(args, 'cursor');
    const rawCursor = args.cursor;
    if (cursorProvided && rawCursor !== undefined && !finiteCursor(rawCursor)) {
      const previous = wikiReads.get(target.slug);
      if (previous) previous.failed = true;
      revokeProposal(target.slug, 'wiki-cursor-invalid', 'The Wiki continuation cursor was not a non-negative integer.');
      return wikiReadFailure(target, rawSlug, 'invalid-cursor', 'The Wiki continuation cursor is invalid', {
        cursor: rawCursor,
      });
    }

    const previous = wikiReads.get(target.slug);
    // Cursor 0 is accepted as an explicit first cursor for clients that always send the
    // optional field. Once a read is in progress, an omitted cursor is still an omission;
    // an explicit restart is allowed after a failed/complete read so the model can recover
    // from a changed page without carrying its old receipt forward.
    const initial =
      !cursorProvided ||
      rawCursor === undefined ||
      rawCursor === 0 &&
        (!previous || previous.failed || previous.nextCursor === null);
    if (initial) {
      if (previous && !previous.failed && previous.nextCursor !== null && !cursorProvided) {
        revokeProposal(target.slug, 'wiki-read-restarted', 'The Wiki read was restarted before its previous cursor was consumed.');
        return wikiReadFailure(target, rawSlug, 'cursor-required', 'Continue the existing Wiki read with its returned cursor');
      }

      if (previous || proposals.has(target.slug)) {
        revokeProposal(target.slug, 'wiki-read-restarted', 'The previous Wiki receipt is no longer valid; the page is being read again.');
      }

      let current: CompileWikiSnapshot | null;
      try {
        current = await deps.readExistingPage(target.slug);
      } catch {
        if (previous) previous.failed = true;
        revokeProposal(target.slug, 'wiki-unreadable', `Could not read ${target.path} on this turn.`);
        return wikiReadFailure(target, rawSlug, 'unreadable', `Could not read ${target.path} on this turn`, {
          exists: null,
          cursor: 0,
          nextCursor: null,
        });
      }

      if (!current) {
        const prior = proposals.get(target.slug);
        if (previous?.exists || prior?.existing !== null && prior?.existing !== undefined) {
          if (previous) previous.failed = true;
          revokeProposal(target.slug, 'wiki-page-deleted', `${target.path} disappeared while it was being read.`);
          return wikiReadFailure(target, rawSlug, 'page-deleted', `${target.path} disappeared while it was being read`, {
            exists: false,
            cursor: 0,
          });
        }
        wikiReads.set(target.slug, {
          target,
          exists: false,
          snapshot: null,
          nextCursor: null,
          receipt: null,
          failed: false,
        });
        return {
          content: JSON.stringify({
            path: target.path,
            slug: target.slug,
            exists: false,
            readable: false,
            cursor: 0,
            nextCursor: null,
            complete: true,
            coverage: { start: 0, end: 0, total: 0, complete: true },
            remainingChars: 0,
            text: '',
          }),
          isError: false,
          outcome: 'ok',
          target: target.path,
          summary: `${target.path} does not exist; a create-only proposal is allowed`,
          readSlugs: [],
          vaultChars: 0,
        };
      }

      const state: CompileWikiReadState = {
        target,
        exists: true,
        snapshot: { text: current.text, mtime: current.mtime },
        nextCursor: 0,
        receipt: null,
        failed: false,
      };
      wikiReads.set(target.slug, state);
      return wikiChunk(state);
    }

    if (!previous) {
      revokeProposal(target.slug, 'wiki-read-missing', 'The Wiki read must start at cursor 0 before a continuation.');
      return wikiReadFailure(target, rawSlug, 'missing-read', 'No prior Wiki read exists for this continuation');
    }
    if (previous.failed) {
      return wikiReadFailure(target, rawSlug, 'read-invalidated', 'The previous Wiki read was invalidated; start a new turn');
    }
    if (previous.nextCursor === null) {
      revokeProposal(target.slug, 'wiki-read-complete', 'The Wiki page was already read completely; use its receipt for replacement.');
      return wikiReadFailure(target, rawSlug, 'read-complete', 'The Wiki page was already read completely');
    }
    if (rawCursor !== previous.nextCursor) {
      previous.failed = true;
      revokeProposal(target.slug, 'wiki-cursor-mismatch', 'The Wiki continuation cursor did not match the returned next cursor.');
      return wikiReadFailure(target, rawSlug, 'cursor-mismatch', 'The Wiki continuation cursor did not match the returned next cursor', {
        cursor: rawCursor,
        expectedCursor: previous.nextCursor,
      });
    }

    let current: CompileWikiSnapshot | null;
    try {
      current = await deps.readExistingPage(target.slug);
    } catch {
      previous.failed = true;
      revokeProposal(target.slug, 'wiki-unreadable', `Could not re-read ${target.path} on this turn.`);
      return wikiReadFailure(target, rawSlug, 'unreadable', `Could not re-read ${target.path} on this turn`, {
        exists: true,
        cursor: rawCursor,
      });
    }
    if (!current) {
      previous.failed = true;
      revokeProposal(target.slug, 'wiki-page-deleted', `${target.path} disappeared while it was being read.`);
      return wikiReadFailure(target, rawSlug, 'page-deleted', `${target.path} disappeared while it was being read`, {
        exists: false,
        cursor: rawCursor,
      });
    }
    if (current.text !== previous.snapshot?.text || !Object.is(current.mtime, previous.snapshot?.mtime)) {
      previous.failed = true;
      revokeProposal(target.slug, 'wiki-page-changed', `${target.path} changed while it was being read.`);
      return wikiReadFailure(target, rawSlug, 'page-changed', `${target.path} changed while it was being read`, {
        exists: true,
        cursor: rawCursor,
      });
    }
    return wikiChunk(previous);
  }

  async function proposePage(args: Record<string, unknown>): Promise<ToolExecution> {
    const rawSlug = args.slug;
    const target = compileWikiTarget(rawSlug);
    if (!target) {
      return fail('propose_wiki_page', String(rawSlug ?? ''), 'Refused the Wiki path before opening the vault', {
        proposed: false,
        path: String(rawSlug ?? ''),
        reason: 'path-refused',
        hint: 'Use a safe basename such as `records` or the exact `wiki/records.md` spelling.',
      });
    }

    if (proposals.size >= deps.pageCap && !proposals.has(target.slug)) {
      return fail('propose_wiki_page', target.path, 'Page cap reached', {
        proposed: false,
        path: target.path,
        slug: target.slug,
        reason: 'page-cap',
        hint: `This turn proposes at most ${deps.pageCap} pages. Stop here; the person decides on the ones already proposed.`,
      });
    }

    let existing: CompileWikiSnapshot | null;
    try {
      existing = await deps.readExistingPage(target.slug);
    } catch {
      const previous = wikiReads.get(target.slug);
      if (previous) previous.failed = true;
      revokeProposal(target.slug, 'wiki-unreadable', `Could not re-read ${target.path} before proposing it.`);
      return proposalFailure(
        args,
        target,
        'wiki-unreadable',
        'unreadable',
        `Could not re-read ${target.path} before proposing it.`,
        previous?.snapshot ?? null,
      );
    }

    const state = wikiReads.get(target.slug);
    const prior = proposals.get(target.slug);
    if (!existing) {
      if (state?.exists || prior?.existing !== null && prior?.existing !== undefined) {
        if (state) state.failed = true;
        revokeProposal(target.slug, 'wiki-page-deleted', `${target.path} disappeared before the proposal was ready.`);
        return proposalFailure(
          args,
          target,
          'wiki-page-deleted',
          'page-deleted',
          `${target.path} disappeared before the proposal was ready.`,
          state?.snapshot ?? prior?.existing ?? null,
        );
      }
      // A never-existing page is create-only and does not need a receipt.
    } else {
      if (!state?.exists || !state.snapshot) {
        return proposalFailure(
          args,
          target,
          'wiki-read-required',
          'read-required',
          `${target.path} already exists. Read it completely with read_wiki_page before replacing it.`,
          existing,
        );
      }
      if (state.failed || state.nextCursor !== null || state.receipt === null) {
        return proposalFailure(
          args,
          target,
          'wiki-read-incomplete',
          state.failed ? 'read-invalidated' : 'incomplete-read',
          `${target.path} cannot be replaced until its complete current Wiki read is returned.`,
          existing,
        );
      }
      if (existing.text !== state.snapshot.text || !Object.is(existing.mtime, state.snapshot.mtime)) {
        state.failed = true;
        revokeProposal(target.slug, 'wiki-page-changed', `${target.path} changed before the proposal was ready.`);
        return proposalFailure(
          args,
          target,
          'wiki-page-changed',
          'page-changed',
          `${target.path} changed before the proposal was ready.`,
          existing,
        );
      }
      if (typeof args.receipt !== 'string' || args.receipt !== state.receipt) {
        return proposalFailure(
          args,
          target,
          'wiki-receipt-mismatch',
          'receipt-mismatch',
          `${target.path} needs the exact receipt returned by its complete read.`,
          existing,
        );
      }
    }

    const draft = buildWikiPageProposal(
      proposalFields(args, target),
      { reads, model: deps.model, now: deps.now(), existing },
    );
    const proposal: WikiPageProposal = { ...draft, existing };
    proposals.set(target.slug, proposal);

    if (!proposal.ok) {
      return {
        content: JSON.stringify({
          proposed: false,
          path: proposal.path,
          problems: proposal.problems,
          hint: 'Fix these and call propose_wiki_page once more for this page. Nothing was written.',
        }),
        isError: true,
        outcome: 'error',
        target: proposal.path,
        summary: `${proposal.path} does not fit the template yet (${proposal.problems.length})`,
        readSlugs: [],
        vaultChars: 0,
      };
    }

    return {
      content: JSON.stringify({
        proposed: true,
        path: proposal.path,
        citations: proposal.citationCount,
        sources: proposal.sourcesRead,
        hint: 'The person now decides whether this is written. Do not propose this page again; move to the next file or stop.',
      }),
      isError: false,
      outcome: 'ok',
      target: proposal.path,
      summary: `Proposed ${proposal.path} — ${proposal.citationCount} citations, waiting for approval`,
      readSlugs: [],
      vaultChars: 0,
    };
  }

  return {
    async execute(call) {
      if (call.argsInvalid) {
        return {
          content: JSON.stringify({
            error: 'The arguments were not valid JSON. Send them again.',
          }),
          isError: true,
          outcome: 'args-invalid',
          target: '',
          summary: 'The tool arguments could not be read',
          readSlugs: [],
          vaultChars: 0,
        };
      }
      const args = asArgs(call.args);
      if (call.name === 'read_source_text') return readSource(args.path);
      if (call.name === 'read_wiki_page') return readWikiPage(args);
      if (call.name === 'propose_wiki_page') return proposePage(args);
      return {
        content: JSON.stringify({
          error: `No tool named ${call.name} on this turn. You have read_source_text, read_wiki_page and propose_wiki_page.`,
        }),
        isError: true,
        outcome: 'unknown-tool',
        target: '',
        summary: `${call.name} is not a tool here`,
        readSlugs: [],
        vaultChars: 0,
      };
    },
    reads: () => [...reads],
    proposals: () => [...proposals.values()],
  };
}
