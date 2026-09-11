import type { NormalizedResponse, ProviderAdapter, TurnAssembly } from './provider-adapter';
import { openaiAdapter } from './providers/openai';

/** How many times one turn may be told to stop answering in prose and propose the page. */
const COMPILE_NUDGE_CAP = 2;

function readablePathsRead(exchanges: TurnAssembly['exchanges']): string[] {
  const paths: string[] = [];
  for (const exchange of exchanges) {
    for (const result of exchange.toolResults) {
      if (result.name !== 'read_source_text' || result.isError) continue;
      try {
        const payload = JSON.parse(result.content) as { path?: unknown; readable?: unknown };
        if (payload.readable === true && typeof payload.path === 'string') paths.push(payload.path);
      } catch {
        // A malformed past result must not stop the rest of the turn from being judged.
      }
    }
  }
  return [...new Set(paths)];
}

interface WikiReadObservation {
  path: string;
  complete: boolean;
  exists: boolean | null;
  nextCursor: number | null;
  isError: boolean;
}

function payloadOf(result: TurnAssembly['exchanges'][number]['toolResults'][number]): Record<string, unknown> {
  try {
    const payload = JSON.parse(result.content) as unknown;
    return payload && typeof payload === 'object' ? (payload as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

function wikiPath(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  return /^wiki\/[a-z0-9]+(?:-[a-z0-9]+)*\.md$/.test(value) ? value : null;
}

function wikiTargetsMentioned(userText: string): string[] {
  const paths: string[] = [];
  const regex = /\bwiki\/[a-z0-9]+(?:-[a-z0-9]+)*\.md\b/g;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(userText)) !== null) {
    if (!paths.includes(match[0]!)) paths.push(match[0]!);
  }
  return paths;
}

function wikiReads(exchanges: TurnAssembly['exchanges']): Map<string, WikiReadObservation> {
  const states = new Map<string, WikiReadObservation>();
  for (const exchange of exchanges) {
    for (const result of exchange.toolResults) {
      if (result.name !== 'read_wiki_page') continue;
      const payload = payloadOf(result);
      const path = wikiPath(payload.path);
      if (!path) continue;
      states.set(path, {
        path,
        complete: payload.complete === true && !result.isError,
        exists: typeof payload.exists === 'boolean' ? payload.exists : null,
        nextCursor: typeof payload.nextCursor === 'number' ? payload.nextCursor : null,
        isError: result.isError,
      });
    }
  }
  return states;
}

/** Only the latest proposal result for a page decides whether it remains ready. */
function finalProposalStatuses(exchanges: TurnAssembly['exchanges']): Map<string, boolean> {
  const statuses = new Map<string, boolean>();
  for (const exchange of exchanges) {
    for (const result of exchange.toolResults) {
      const payload = payloadOf(result);
      const path = wikiPath(payload.path);
      if (!path) continue;
      if (result.name === 'propose_wiki_page') statuses.set(path, !result.isError);
      // Any later Wiki read for the same path starts a new read attempt (or reports a
      // changed/unavailable continuation), so a previous proposal for that path is no
      // longer current. The next model request must not finish on stale history.
      if (result.name === 'read_wiki_page' && statuses.has(path)) statuses.set(path, false);
    }
  }
  return statuses;
}

/**
 * The adapter a Compile turn uses on the connect-by-address route.
 *
 * **Why not `localAdapter`.** That adapter is the ontology conversation's, and it
 * enforces that conversation's shape: the first round trip is pinned to `get_concept` or
 * `list_kinds` by name, the allowed tools are narrowed to that one, and after three tool
 * rounds the tools are withdrawn and an answer is forced. Every one of those is right for
 * "answer a question about the map" and wrong here — a Compile turn's first call is
 * `read_source_text`, and narrowing the tool list to `list_kinds` would leave it with no
 * tool at all. Sharing that adapter would mean adding a job-kind branch to a file whose
 * rules were each written for one measured failure of a different job.
 *
 * What is kept is the one measurement that is about the runner rather than the job:
 * `reasoning_effort: 'none'`. Measured 2026-08-02 against Ollama with gemma4:12b, the
 * first tool call took 59.7s at `low` and 0.632s at `none`. A local runner thinking for a
 * minute before opening a file it was told to open is time a person spends watching
 * nothing happen.
 *
 * Body assembly and response parsing are the OpenAI-compatible ones, which is what lets
 * Ollama, LM Studio, llama.cpp server, and vLLM run this unchanged with only the address
 * swapped.
 */
export const compileAdapter: ProviderAdapter = {
  provider: 'local',
  defaultModel: '',

  buildBody(turn: TurnAssembly): string {
    const base = JSON.parse(openaiAdapter.buildBody(turn)) as Record<string, unknown>;
    return JSON.stringify({ ...base, reasoning_effort: 'none' });
  },

  parseResponse(body: string) {
    return openaiAdapter.parseResponse(body);
  },

  /**
   * **A turn that read a file and then talked about it is not finished.**
   *
   * Measured 2026-09-06 in the installed app against Ollama: gemma4:12b called
   * `read_source_text` once, received the text, and answered in prose. The loop takes a
   * response with no tool call as a completed turn, so the person got a spinner that
   * vanished and no card — the whole transfer spent for nothing. The same model produced
   * two clean pages once told, in one deterministic sentence, to call the tool.
   *
   * This is the mechanism `providers/local.ts` already uses for the ontology conversation
   * and for the same reason: a small model's compliance with a prompt-only instruction
   * cannot be assumed, so the execution contract asks again. It is bounded — two nudges,
   * inside the turn's own round cap — and it never fires once a page has been proposed,
   * because then the turn really is finished.
   */
  reviewResponse(turn: TurnAssembly, parsed: NormalizedResponse) {
    if (parsed.toolCalls.length > 0) return { action: 'accept' as const };
    if (turn.tools.length === 0) return { action: 'accept' as const };
    if ([...finalProposalStatuses(turn.exchanges).values()].some(Boolean)) {
      return { action: 'accept' as const };
    }

    const retryCount = turn.exchanges.filter((exchange) => exchange.retry).length;
    const reads = wikiReads(turn.exchanges);
    const requiredWiki = wikiTargetsMentioned(turn.userText);
    const unfinished = [...reads.values()].filter(
      (read) => !read.isError && !read.complete && read.nextCursor !== null,
    );
    const missingRequired = requiredWiki.filter((path) => {
      const read = reads.get(path);
      return !read || read.isError || !read.complete;
    });

    if (unfinished.length > 0 || missingRequired.length > 0) {
      if (retryCount >= COMPILE_NUDGE_CAP) return { action: 'accept' as const };
      if (unfinished.length > 0) {
        return {
          action: 'retry' as const,
          expectedTool: 'read_wiki_page',
          message:
            `Continue reading ${unfinished.map((read) => `\`${read.path}\``).join(', ')} ` +
            'with the exact `nextCursor` from the last result. Do not propose or answer in prose until the complete current page has been returned.',
        };
      }
      return {
        action: 'retry' as const,
        expectedTool: 'read_wiki_page',
        message:
          `Read the existing page ${missingRequired.map((path) => `\`${path}\``).join(', ')} ` +
          'through `read_wiki_page` before proposing a replacement. Follow every cursor and echo the final receipt; do not answer in prose.',
      };
    }

    const read = readablePathsRead(turn.exchanges);
    if (read.length === 0) return { action: 'accept' as const };
    if (retryCount >= COMPILE_NUDGE_CAP) {
      return { action: 'accept' as const };
    }
    return {
      action: 'retry' as const,
      expectedTool: 'propose_wiki_page',
      message:
        `You already have the text of ${read.map((path) => `\`${path}\``).join(', ')}. ` +
        'Call propose_wiki_page now, once per file, with the fields for the page. ' +
        'Do not answer in prose and do not describe what you would write: nothing reaches ' +
        'the person until that tool is called.',
    };
  },
};
