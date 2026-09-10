import { parseFrontmatter } from '@/shared/lib/parse-frontmatter';
import { getTauriVaultRootPath, nativeVaultFileHashes } from '@/shared/lib/tauri-vault-fs';
import { validateWikiPage } from '@/shared/lib/wiki-page-schema';
import type { AnswerPageResult } from './answer-page';
import { isRetainedAnswerPath } from './answer-revision';
import { createWikiFile } from './write-wiki-file';

export interface AnswerRevisionStore {
  read: (slug: string) => Promise<string>;
  observe: (paths: readonly string[]) => Promise<ReadonlyMap<string, string>>;
  create: (slug: string, text: string) => Promise<boolean>;
}

export interface AnswerRefreshSnapshot {
  question: string;
  previousSlug: string;
  previousText: string;
  previousHash: string;
  thread: string;
  observedAt: string;
  observations: ReadonlyMap<string, string>;
  sourcePaths: readonly string[];
}

export async function answerTextHash(text: string): Promise<string> {
  const bytes = new TextEncoder().encode(text);
  const hash = await crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(hash)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

/** The production adapter uses the same native exclusive create as initial answer filing. */
export function answerRevisionStore(vault: FileSystemDirectoryHandle): AnswerRevisionStore {
  const root = getTauriVaultRootPath(vault);
  if (!root) throw new Error('Answer refresh filing requires the installed app.');
  return {
    read: async (slug) => {
      if (!isRetainedAnswerPath(slug)) throw new Error('Invalid retained answer path.');
      const parts = `${slug}.md`.split('/');
      const name = parts.pop()!;
      let directory = vault;
      for (const part of parts) directory = await directory.getDirectoryHandle(part);
      return (await (await directory.getFileHandle(name)).getFile()).text();
    },
    observe: async (paths) => await nativeVaultFileHashes(root, [...paths]) ?? new Map(),
    create: (slug, text) => createWikiFile(vault, `${slug}.md`, text),
  };
}

export async function prepareAnswerRefresh(
  store: AnswerRevisionStore,
  previousSlug: string,
  sourcePaths: readonly string[],
): Promise<AnswerRefreshSnapshot> {
  if (!isRetainedAnswerPath(previousSlug)) throw new Error('Invalid retained answer path.');
  const previousText = await store.read(previousSlug);
  const { frontmatter } = parseFrontmatter(previousText);
  const question = typeof frontmatter.answer_question === 'string' ? frontmatter.answer_question : frontmatter.title;
  const thread = typeof frontmatter.answer_thread === 'string' ? frontmatter.answer_thread : previousSlug;
  if (typeof question !== 'string' || !question.trim() || !isRetainedAnswerPath(thread) || frontmatter.kind) {
    throw new Error('The retained question or its history cannot be read.');
  }
  const paths = [...new Set(sourcePaths)].sort();
  const observations = await store.observe(paths);
  if (paths.length === 0 || paths.some((path) => !/^[a-f0-9]{64}$/i.test(observations.get(path) ?? ''))) {
    throw new Error('Could not measure every original in this refresh scope. Restore readable originals and try again.');
  }
  if (await store.read(previousSlug) !== previousText) throw new Error('The previous answer changed while preparing the refresh.');
  return {
    question: question.trim(), previousSlug, previousText, previousHash: await answerTextHash(previousText),
    thread, observedAt: new Date().toISOString(), observations: new Map(observations), sourcePaths: paths,
  };
}

async function inputsUnchanged(store: AnswerRevisionStore, snapshot: AnswerRefreshSnapshot): Promise<boolean> {
  try {
    if (await store.read(snapshot.previousSlug) !== snapshot.previousText) return false;
    const current = await store.observe(snapshot.sourcePaths);
    if (snapshot.sourcePaths.some((path) => current.get(path) !== snapshot.observations.get(path))) return false;
    return await store.read(snapshot.previousSlug) === snapshot.previousText;
  } catch { return false; }
}

/** Pre/post checks bound the comparison; they do not claim a filesystem-wide transaction. */
export async function saveAnswerRevision(
  store: AnswerRevisionStore,
  snapshot: AnswerRefreshSnapshot,
  page: AnswerPageResult,
): Promise<{ state: 'saved' | 'saved-needs-review'; slug: string }> {
  const { frontmatter } = parseFrontmatter(page.text);
  if (!isRetainedAnswerPath(page.slug) || page.slug === snapshot.previousSlug || page.path !== `${page.slug}.md`
    || page.problems.length || !validateWikiPage(page.text, { knownSources: snapshot.sourcePaths }).ok
    || frontmatter.answer_previous !== snapshot.previousSlug || frontmatter.answer_thread !== snapshot.thread
    || frontmatter.answer_previous_hash !== snapshot.previousHash) {
    throw new Error('The proposed revision does not match the reviewed answer.');
  }
  if (!await inputsUnchanged(store, snapshot)) throw new Error('The previous answer or source evidence changed or could not be remeasured. Generate a fresh comparison before saving.');
  if (!await store.create(page.slug, page.text)) throw new Error('A page already exists at that revision path. Nothing was overwritten.');
  return { state: await inputsUnchanged(store, snapshot) ? 'saved' : 'saved-needs-review', slug: page.slug };
}
