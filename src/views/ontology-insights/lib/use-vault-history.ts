"use client";

import { useEffect, useMemo, useState } from "react";

import { gitHistory, isGitBridgeAvailable } from "@/shared/lib/tauri-git";
import type { VaultDoc } from "@/entities/docs-vault";

import {
  countVaultPaths,
  replayVaultHistory,
  vaultHistoryPeak,
  weeklyVaultHistory,
  VAULT_HISTORY_RULES_VERSION,
  type VaultHistoryWeek,
  type VaultLayerCounts,
} from "./vault-history";

/**
 * **Where the weekly counts come from** — one Git read, on demand, and nothing kept.
 *
 * The arithmetic is `vault-history.ts` and is tested without a browser. This is only the
 * plumbing: it asks the Git bridge for the commits that touched the folder, hands them to
 * the rewind along with the counts of the folder as it stands, and holds the result for
 * as long as the screen is open. Nothing is written anywhere; close the app and the series
 * is gone until it is recomputed, which is the property that keeps it derived rather than
 * a second record of the person's work.
 *
 * ## The three states, and why "none" is not "empty"
 *
 * - `unavailable` — there is no Git bridge. That is the web, and it is not a failure: the
 *   history lives in the repository on the person's disk and the browser cannot reach it.
 * - `none` — the bridge answered and there is no history: a folder nobody ran `git init`
 *   in, or one with no commits yet. **Distinct from a series of zeroes**, which would say
 *   the folder was empty, a claim about the person rather than about the data.
 * - `ready` — weeks, each naming the commit it is true after.
 */
export type VaultHistoryState = {
  /**
   * What the folder holds **right now**, counted from paths by the same rule the past is.
   *
   * ⚠️ Always present, in every status, and that is the point. The first build drew nothing at
   * all in three of its four states, which was honest about time and silent about the folder —
   * so in a browser, where Git is out of reach, the surface was a paragraph explaining an
   * absence. The present needs no history: it is the folder, counted. The time axis is the part
   * that needs Git, and only that part waits.
   */
  present: VaultLayerCounts;
} & (
  | { status: "idle" | "loading" | "unavailable" | "none" }
  | {
      status: "ready";
      weeks: VaultHistoryWeek[];
      peak: number;
      /** Stamped so an old picture is never silently redrawn by new counting rules. */
      rulesVersion: number;
    }
);

/**
 * How far back to ask.
 *
 * Enough that a folder worked in for a year still shows its shape, and bounded because
 * every commit costs a row over IPC. The rewind is exact for whatever window it is given
 * and simply starts later when the window runs out, so this number trades reach for time,
 * never accuracy.
 */
const HISTORY_COMMIT_LIMIT = 1500;

export function useVaultHistory(
  vaultPath: string | null,
  docs: readonly VaultDoc[] | undefined,
  /** Raw source files; they carry no `kind:` and are counted by path like everything else. */
  sourcePaths: readonly string[] | undefined,
): VaultHistoryState {
  /*
   * Only the *fetched* answer is state. Whether a bridge exists at all, and whether there
   * is a folder to ask about, are facts of this render — deriving them here rather than
   * writing them from an effect keeps the effect to the one thing it is for, which is
   * talking to something outside React.
   */
  const reachable = Boolean(vaultPath) && isGitBridgeAvailable();
  const [fetched, setFetched] = useState<VaultHistoryState | null>(null);

  // The present is counted from paths, by the same rule the past is, so the newest point
  // and the week before it can never be counted two different ways.
  const presentKey = [
    ...(docs ?? []).map((doc) => doc.path),
    ...(sourcePaths ?? []),
  ].sort().join("\n");


  /*
   * Counted once per path set, and used by the effect and the return alike, so the present
   * cannot be counted one way for the newest point of the series and another for the
   * standalone stack. Memoised on the joined paths, which is also what the effect keys on.
   */
  const presentCounts = useMemo(
    () => countVaultPaths(presentKey ? presentKey.split("\n") : []),
    [presentKey],
  );

  useEffect(() => {
    if (!reachable || !vaultPath) return;
    let cancelled = false;
    void (async () => {
      const commits = await gitHistory(vaultPath, HISTORY_COMMIT_LIMIT).catch(() => null);
      if (cancelled) return;
      if (!commits || commits.length === 0) {
        setFetched({ status: "none", present: presentCounts });
        return;
      }
      const present = presentCounts;
      const weeks = weeklyVaultHistory(replayVaultHistory(present, commits));
      // One week is a dot, not a shape; say "no history" rather than draw a single column
      // and let it read as a trend.
      if (weeks.length < 2) {
        setFetched({ status: "none", present });
        return;
      }
      setFetched({
        status: "ready",
        present,
        weeks,
        peak: vaultHistoryPeak(weeks),
        rulesVersion: VAULT_HISTORY_RULES_VERSION,
      });
    })();
    return () => {
      cancelled = true;
    };
  }, [reachable, vaultPath, presentKey, presentCounts]);

  if (!isGitBridgeAvailable()) return { status: "unavailable", present: presentCounts };
  if (!vaultPath) return { status: "none", present: presentCounts };
  return fetched ?? { status: "loading", present: presentCounts };
}
