/**
 * **What the folder held, week by week** — rewound from Git, never accumulated.
 *
 * The owner asked for a growth view over the ontology, the Library and the architecture
 * (2026-09-09). The two PO seats routed it to a one-way door and set the terms this module
 * is built to, so they are written here rather than left in the ledger:
 *
 * 1. **Derived, not recorded.** Delete every byte of this and recompute from the folder
 *    plus its Git history, and the numbers are identical. Atlas writes no time series of
 *    its own: a runtime-appended log would be the only witness to its own facts, which is
 *    a second canonical store for something the vault already owns (`forbidden.md`), and
 *    it lives in a gitignored directory no diff a person reads can see.
 * 2. **Three counts, never one score.** A blend asserts that one concept equals one
 *    write-up equals one document. The measured reason is sharper than the principle: on
 *    this repository's own vault the concepts fell 107 → 71 between 2026-06-29 and
 *    2026-07-27 while the code grew, and a sum of the three moved 157 → 132 — "down a
 *    little". The entire signal is in the *divergence*, and a blend erases exactly it.
 * 3. **"No history" is not zero.** A folder outside Git, or one Atlas cannot reach Git in,
 *    has no series at all; drawing it as a flat line at zero says "you did nothing", which
 *    is a lie about the person rather than about the data.
 *
 * ## Why it rewinds instead of accumulating forward
 *
 * `git_history` returns the *last N* commits, so replaying forward from the oldest of them
 * starts at an unknown baseline and every later number inherits that error. The present is
 * the one count that is known exactly — the open folder is right there — so the walk runs
 * **backwards from now**: an added path means the file did not exist before that commit, a
 * deleted path means it did. Each step is exact, and the window is honestly bounded by
 * however much history was asked for.
 *
 * ## Why paths and not frontmatter
 *
 * `git_history` reads `kind:` from the file **on disk now**, not as it stood at that
 * commit, so a node whose kind changed — or one since deleted — would be counted wrong and
 * would look authoritative. Paths are in the commit itself. So the three counting rules are
 * path rules, and `classifyVaultPath` is the whole of the vocabulary.
 */

/** The three layers a vault folder holds, in the order the product introduces them. */
export type VaultLayer = "document" | "writeUp" | "concept";

export interface VaultLayerCounts {
  /** Files kept verbatim under `sources/` — what the Library gathers. */
  document: number;
  /** Pages under `wiki/` — what was written from those documents. */
  writeUp: number;
  /** Every other Markdown file in the folder — the ontology the map draws. */
  concept: number;
}

/** One commit as `git_history` reports it: newest first, paths vault-relative. */
export interface VaultHistoryCommit {
  hash: string;
  /** Authored/committed ISO timestamp. */
  isoTime: string;
  files: ReadonlyArray<{ path: string; status: "added" | "modified" | "deleted" | "renamed" }>;
}

export interface VaultHistoryPoint {
  /** ISO timestamp of the commit this count is *after*. */
  isoTime: string;
  /** The commit a reader recomputes from. Every point must be checkable. */
  hash: string;
  counts: VaultLayerCounts;
}

/**
 * The version of the counting rules below.
 *
 * Stamped on every series so an old picture is never silently redrawn by new rules. If
 * `classifyVaultPath` changes what it counts, this changes with it.
 */
export const VAULT_HISTORY_RULES_VERSION = 1;

const WIKI_DIR = "wiki/";
const SOURCES_DIR = "sources/";

/**
 * Which layer a vault-relative path belongs to, or `null` if it is not counted.
 *
 * Furniture is excluded on the same rule the rest of the product uses — a file under
 * `wiki/` whose name starts with `_` is the wiki's own scaffolding (`_template.md`,
 * `_log.md`), not a page somebody wrote.
 */
export function classifyVaultPath(path: string): VaultLayer | null {
  const clean = String(path ?? "").trim().replace(/^\.\//, "");
  if (!clean || clean.startsWith(".")) return null;
  if (clean.startsWith(SOURCES_DIR)) {
    // A document is any format at all; that is what `sources/` means.
    return clean.length > SOURCES_DIR.length ? "document" : null;
  }
  if (!clean.endsWith(".md")) return null;
  const name = clean.slice(clean.lastIndexOf("/") + 1);
  if (name.startsWith("_")) return null;
  return clean.startsWith(WIKI_DIR) ? "writeUp" : "concept";
}

const emptyCounts = (): VaultLayerCounts => ({ document: 0, writeUp: 0, concept: 0 });

/**
 * Count what the folder holds right now, from the paths it holds right now.
 *
 * Takes paths rather than documents so the present and the past are counted by the *same*
 * rule — the commonest way a series like this goes quietly wrong is a present computed one
 * way and a history another.
 */
export function countVaultPaths(paths: readonly string[]): VaultLayerCounts {
  const counts = emptyCounts();
  for (const path of paths) {
    const layer = classifyVaultPath(path);
    if (layer) counts[layer] += 1;
  }
  return counts;
}

/**
 * Rewind `commits` (newest first) from `present`, giving one point per commit.
 *
 * The result runs **oldest first**, which is the order a reader scans, and every point
 * names the commit it is true after. A modified file changes no count; only existence
 * does, which is the whole of the arithmetic.
 */
export function replayVaultHistory(
  present: VaultLayerCounts,
  commits: readonly VaultHistoryCommit[],
): VaultHistoryPoint[] {
  const points: VaultHistoryPoint[] = [];
  const running: VaultLayerCounts = { ...present };

  for (const commit of commits) {
    // The count *after* this commit is whatever the running total is when we reach it.
    points.push({ isoTime: commit.isoTime, hash: commit.hash, counts: { ...running } });
    for (const file of commit.files ?? []) {
      const layer = classifyVaultPath(file.path);
      if (!layer) continue;
      // Undo the commit: what it added did not exist before it, what it deleted did.
      if (file.status === "added") running[layer] -= 1;
      else if (file.status === "deleted") running[layer] += 1;
    }
  }

  // A count can only go negative when the window's oldest commit adds a file that some
  // earlier commit outside the window had already added — a rename pair split across the
  // boundary, most often. Clamp rather than draw a folder holding minus three documents.
  for (const point of points) {
    for (const layer of ["document", "writeUp", "concept"] as const) {
      if (point.counts[layer] < 0) point.counts[layer] = 0;
    }
  }
  return points.reverse();
}

export interface VaultHistoryWeek {
  /** ISO date (UTC) of the Monday that starts this week. */
  week: string;
  /** The commit the week's count is taken from — its last within the week. */
  hash: string;
  counts: VaultLayerCounts;
}

/** The Monday (UTC) that starts the week containing `iso`. */
function weekStart(iso: string): string | null {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  const utc = new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
  );
  utc.setUTCDate(utc.getUTCDate() - ((utc.getUTCDay() + 6) % 7));
  return utc.toISOString().slice(0, 10);
}

/**
 * One point per week: what the folder held at the **end** of that week.
 *
 * Weeks a person did not commit in are absent rather than zero — a gap in the walk is a
 * week nothing was recorded, not a week the folder was empty. A reader who needs the
 * distinction gets it from the dates.
 */
export function weeklyVaultHistory(
  points: readonly VaultHistoryPoint[],
): VaultHistoryWeek[] {
  const byWeek = new Map<string, VaultHistoryWeek>();
  for (const point of points) {
    const week = weekStart(point.isoTime);
    if (!week) continue;
    // Points arrive oldest first, so the last write for a week is that week's end state.
    byWeek.set(week, { week, hash: point.hash, counts: { ...point.counts } });
  }
  return [...byWeek.values()].sort((a, b) => a.week.localeCompare(b.week));
}

/** The largest count any layer reaches, which is what a shared baseline scales to. */
export function vaultHistoryPeak(weeks: readonly VaultHistoryWeek[]): number {
  let peak = 0;
  for (const week of weeks) {
    peak = Math.max(peak, week.counts.document, week.counts.writeUp, week.counts.concept);
  }
  return peak;
}
