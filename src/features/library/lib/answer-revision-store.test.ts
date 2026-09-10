import { describe, expect, it, vi } from 'vitest';
import { prepareAnswerRefresh, saveAnswerRevision, type AnswerRevisionStore } from './answer-revision-store';
import { buildAnswerRevision } from './answer-revision';

const slug = 'wiki/answers/original';
const path = 'sources/plan.md';
const hash = 'a'.repeat(64);
const body = '## Summary\nSeptember\n## Facts\n- September. [[src:sources/plan.md#l1]]\n## Decisions\n## Open questions\n- Approval?\n## Not in sources\n';
const old = `---\ntitle: When?\ncreated_by: human\nsources: [${path}]\nsource_hash: {}\nstatus: draft\nsummary: Date\ncompiled_at: 2026-09-10\n---\n${body}`;
function store() {
  const files = new Map([[slug, old]]);
  const hashes = new Map([[path, hash]]);
  const io: AnswerRevisionStore = {
    read: vi.fn(async (key) => { if (!files.has(key)) throw new Error('missing'); return files.get(key)!; }),
    observe: vi.fn(async () => new Map(hashes)),
    create: vi.fn(async (key, text) => { if (files.has(key)) return false; files.set(key, text); return true; }),
  };
  return { io, files, hashes };
}
async function draft(io: AnswerRevisionStore) {
  const snapshot = await prepareAnswerRefresh(io, slug, [path]);
  const page = buildAnswerRevision({ ...snapshot, response: body, writer: 'agent:test', now: new Date(), knownSources: [path] });
  return { snapshot, page };
}

describe('create-only answer revisions', () => {
  it('keeps the exact old page and saves a linked draft', async () => {
    const { io, files } = store();
    const { snapshot, page } = await draft(io);
    const result = await saveAnswerRevision(io, snapshot, page);
    expect(result.state).toBe('saved');
    expect(files.get(slug)).toBe(old);
    expect(files.get(page.slug)).toBe(page.text);
  });

  it.each(['old answer', 'original source'])('rejects an intervening change to the %s before writing', async (change) => {
    const { io, files, hashes } = store();
    const { snapshot, page } = await draft(io);
    if (change === 'old answer') files.set(slug, `${old}\nHuman correction.\n`);
    else hashes.set(path, 'b'.repeat(64));
    await expect(saveAnswerRevision(io, snapshot, page)).rejects.toThrow(/changed/);
    expect(io.create).not.toHaveBeenCalled();
  });

  it('refuses an unreadable source rather than inventing a comparison baseline', async () => {
    const { io, hashes } = store();
    hashes.clear();
    await expect(prepareAnswerRefresh(io, slug, [path])).rejects.toThrow(/measure/);
  });

  it('reports input changes during exclusive creation without deleting the saved draft', async () => {
    const { io, files, hashes } = store();
    const { snapshot, page } = await draft(io);
    io.create = vi.fn(async (key, text) => { files.set(key, text); hashes.set(path, 'b'.repeat(64)); return true; });
    expect((await saveAnswerRevision(io, snapshot, page)).state).toBe('saved-needs-review');
    expect(files.has(page.slug)).toBe(true);
    expect(files.get(slug)).toBe(old);
  });

  it('refuses a colliding filename without replacing it', async () => {
    const { io, files } = store();
    const { snapshot, page } = await draft(io);
    files.set(page.slug, 'Human page');
    await expect(saveAnswerRevision(io, snapshot, page)).rejects.toThrow(/exists/);
    expect(files.get(page.slug)).toBe('Human page');
  });
});
