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

/**
 * The four layers a vault folder holds, in the order the product introduces them.
 *
 * `module` was split out of `concept` on 2026-09-09 at the owner's request: the ask was a
 * growth picture "combining the ontology, the Library's documents and the architecture",
 * and architecture cannot be a third of that while it is being counted inside the first.
 * The split changes what past weeks count, so `VAULT_HISTORY_RULES_VERSION` moves with it.
 */
export type VaultLayer = "document" | "writeUp" | "concept" | "module";

/**
 * Every layer, once.
 *
 * ⚠️ **Three council seats independently found the same defect on 2026-09-09**: `module` was
 * added to `VaultLayer` and to both renderers and to **none** of the aggregates — not the
 * peak the tracks are scaled against, not the negative clamp, not the block-size divisor.
 * A folder whose `architecture/` dominates was drawn against a scale that did not know it
 * existed. The lists were written out by hand at each site, so the type could not catch it.
 * Anything that folds over the layers reads this.
 */
export const VAULT_LAYERS: readonly VaultLayer[] = ["concept", "module", "writeUp", "document"];

export interface VaultLayerCounts {
  /** Files kept verbatim under `sources/` — what the Library gathers. */
  document: number;
  /** Pages under `wiki/` — what was written from those documents. */
  writeUp: number;
  /** Markdown under `architecture/` — the implementation shape the map hangs meaning on. */
  module: number;
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
export const VAULT_HISTORY_RULES_VERSION = 2;

const WIKI_DIR = "wiki";
const SOURCES_DIR = "sources";
const ARCHITECTURE_DIR = "architecture";

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
  /*
   * ⚠️ **A folder is recognised by a path *segment*, not by a prefix.** A vault-relative
   * path starts with its folder, but the bundled sample's manifest carries a repo-relative
   * one (`samples/storefront/architecture/…`), and a prefix test silently counted every one
   * of those as an ordinary concept — measured on the sample board as architecture 0 beside
   * an architecture folder that plainly exists. Matching the segment is right for both, and
   * it is also what a reader means by "the file is in the wiki folder".
   */
  const segments = clean.split("/");
  // A trailing slash is a directory, not a file in it: `sources/` names the folder itself.
  if (!segments.at(-1)) return null;
  const dirs = segments.slice(0, -1);
  const inFolder = (dir: string) => dirs.includes(dir);
  if (inFolder(SOURCES_DIR)) return "document"; // any format at all; that is what sources/ means
  if (!clean.endsWith(".md")) return null;
  const name = segments.at(-1) ?? "";
  if (name.startsWith("_")) return null;
  if (inFolder(WIKI_DIR)) return "writeUp";
  if (inFolder(ARCHITECTURE_DIR)) return "module";
  return "concept";
}

const emptyCounts = (): VaultLayerCounts => ({ document: 0, writeUp: 0, module: 0, concept: 0 });

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
    for (const layer of VAULT_LAYERS) {
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
    for (const layer of VAULT_LAYERS) peak = Math.max(peak, week.counts[layer]);
  }
  return peak;
}

/**
 * **What a series says besides its shape.**
 *
 * A curve tells a reader the direction; it does not tell them *when* anything happened, and
 * a person cannot read a date off a column forty pixels wide. These are the two facts the
 * series can state exactly and a picture cannot: the week a layer first existed, and the
 * week it grew the most. Both are read straight off the same weekly points the chart draws,
 * so a milestone can never disagree with the shape beside it.
 */
export interface VaultLayerMilestones {
  layer: VaultLayer;
  /** The first week this layer held anything at all, or null if it never has. */
  began: { week: string; count: number } | null;
  /** The week this layer grew the most, and by how much. Null when it never grew. */
  grew: { week: string; delta: number } | null;
  /** What it holds at the end of the window. */
  latest: number;
}

/**
 * Milestones per layer, over an ascending weekly series.
 *
 * ⚠️ **The first week of the window is never reported as a beginning.** A folder whose
 * history reaches further back than the window opens with whatever it already held, and
 * calling that "began" would date the person's work to the day the window happens to start.
 * A beginning is a layer that was empty in one week and is not in the next.
 */
export function vaultLayerMilestones(
  weeks: readonly VaultHistoryWeek[],
  layer: VaultLayer,
): VaultLayerMilestones {
  let began: { week: string; count: number } | null = null;
  let grew: { week: string; delta: number } | null = null;
  for (let i = 1; i < weeks.length; i += 1) {
    const previous = weeks[i - 1]?.counts[layer] ?? 0;
    const point = weeks[i];
    if (!point) continue;
    const current = point.counts[layer];
    if (!began && previous === 0 && current > 0) began = { week: point.week, count: current };
    const delta = current - previous;
    if (delta > 0 && (!grew || delta > grew.delta)) grew = { week: point.week, delta };
  }
  /*
   * A layer that appeared and had its biggest week in the same week has one fact, not two;
   * printing both says the same date twice. The beginning is the more specific of the pair,
   * so it survives.
   */
  if (began && grew && began.week === grew.week) grew = null;
  return { layer, began, grew, latest: weeks.at(-1)?.counts[layer] ?? 0 };
}
