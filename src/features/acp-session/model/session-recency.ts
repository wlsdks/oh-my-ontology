import type { AcpSessionSummary } from './acp-client';

/**
 * **Which past conversation is the latest one** — the only ordering question the panel asks.
 *
 * `session/list` arrives in whatever order the adapter kept it in, and the screen drew it
 * that way: the list has a date column, so the reader takes the top row to be the most
 * recent conversation whether or not the adapter agreed. Once reopening the dock resumes
 * *the latest* conversation (owner, installed app, 2026-09-08), that reading stops being a
 * cosmetic question — the row a person points at and the conversation that opens have to
 * be the same one.
 *
 * So the order is ours, from the one fact the adapter gives us. A row with a readable
 * `updatedAt` sorts newest first; rows without one keep the adapter's own order and stand
 * below the dated ones, because an unknown time is not a claim that it is old.
 */
function timeOf(session: AcpSessionSummary): number | null {
  if (!session.updatedAt) return null;
  const value = Date.parse(session.updatedAt);
  return Number.isFinite(value) ? value : null;
}

/**
 * Newest first, stable everywhere the answer is unknown.
 *
 * `Array.prototype.sort` is specified as stable, so two rows that compare equal — two
 * undated rows, or two rows stamped the same second — come out in the order the adapter
 * listed them.
 */
export function orderSessionsByRecency(
  sessions: readonly AcpSessionSummary[],
): AcpSessionSummary[] {
  return [...sessions].sort((left, right) => {
    const a = timeOf(left);
    const b = timeOf(right);
    if (a === null && b === null) return 0;
    if (a === null) return 1;
    if (b === null) return -1;
    return b - a;
  });
}

/**
 * The conversation reopening resumes, or `null` when this folder has none.
 *
 * With no date anywhere, this is the adapter's own first row rather than nothing. The
 * adapter is the only party that knows its list, and the head of the list is the same
 * conversation the person sees at the top of the history door — resuming that one keeps
 * those two answers identical, which is the whole point of ordering here.
 */
export function latestSession(
  sessions: readonly AcpSessionSummary[],
): AcpSessionSummary | null {
  return orderSessionsByRecency(sessions)[0] ?? null;
}
