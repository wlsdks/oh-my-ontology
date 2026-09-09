import { describe, expect, it } from "vitest";

import {
  classifyVaultPath,
  countVaultPaths,
  replayVaultHistory,
  vaultHistoryPeak,
  weeklyVaultHistory,
  type VaultHistoryCommit,
} from "./vault-history";

/**
 * These pin the two properties the whole surface rests on: the present and the past are
 * counted by the *same* rule, and every number is recomputable from Git rather than
 * remembered. A series that drifts between those two is the failure mode that makes a
 * curve look authoritative while being wrong.
 */

const commit = (
  hash: string,
  isoTime: string,
  files: Array<[string, "added" | "modified" | "deleted"]>,
): VaultHistoryCommit => ({
  hash,
  isoTime,
  files: files.map(([path, status]) => ({ path, status })),
});

describe("classifyVaultPath — the three counting rules", () => {
  it("counts anything under sources/ as a document, whatever its format", () => {
    expect(classifyVaultPath("sources/plan.pdf")).toBe("document");
    expect(classifyVaultPath("sources/budget.xlsx")).toBe("document");
    expect(classifyVaultPath("sources/notes.txt")).toBe("document");
  });

  it("counts Markdown under wiki/ as a write-up", () => {
    expect(classifyVaultPath("wiki/quarter-plan.md")).toBe("writeUp");
  });

  it("counts every other Markdown file as a concept", () => {
    expect(classifyVaultPath("capabilities/checkout.md")).toBe("concept");
    expect(classifyVaultPath("project.md")).toBe("concept");
    expect(classifyVaultPath("domains/commerce.md")).toBe("concept");
  });

  /*
   * The same rule the rest of the product uses: a `wiki/_*` file is the wiki's own
   * scaffolding — the template and the log — not a page anybody wrote.
   */
  it("leaves the wiki's own furniture out of the count", () => {
    expect(classifyVaultPath("wiki/_template.md")).toBeNull();
    expect(classifyVaultPath("wiki/_log.md")).toBeNull();
  });

  it("counts nothing that is not Markdown outside sources/", () => {
    expect(classifyVaultPath("README.png")).toBeNull();
    expect(classifyVaultPath("script.mjs")).toBeNull();
  });

  it("ignores dotfiles and the app's own directory", () => {
    expect(classifyVaultPath(".ontology-atlas/activity.jsonl")).toBeNull();
    expect(classifyVaultPath(".gitignore")).toBeNull();
  });

  it("survives a path that is empty or shaped oddly", () => {
    expect(classifyVaultPath("")).toBeNull();
    expect(classifyVaultPath("sources/")).toBeNull();
    expect(classifyVaultPath("./capabilities/x.md")).toBe("concept");
  });
});

describe("countVaultPaths — the present, by the same rule as the past", () => {
  it("counts each layer separately and never blends them", () => {
    expect(
      countVaultPaths([
        "project.md",
        "capabilities/checkout.md",
        "wiki/quarter-plan.md",
        "wiki/_log.md",
        "sources/plan.pdf",
        "sources/budget.xlsx",
        "logo.png",
      ]),
    ).toEqual({ concept: 2, writeUp: 1, document: 2 });
  });

  it("counts an empty folder as zero of everything", () => {
    expect(countVaultPaths([])).toEqual({ concept: 0, writeUp: 0, document: 0 });
  });
});

describe("replayVaultHistory — rewound from the present, not accumulated forward", () => {
  const present = { concept: 3, writeUp: 2, document: 4 };

  it("returns oldest first, so a reader scans it the way time runs", () => {
    const points = replayVaultHistory(present, [
      commit("c3", "2026-09-03T10:00:00Z", []),
      commit("c2", "2026-09-02T10:00:00Z", []),
      commit("c1", "2026-09-01T10:00:00Z", []),
    ]);
    expect(points.map((p) => p.hash)).toEqual(["c1", "c2", "c3"]);
  });

  /*
   * The newest commit's point *is* the present: nothing has been undone yet when the walk
   * reaches it. If this ever drifts, every number behind it drifts with it.
   */
  it("puts the present at the newest commit", () => {
    const points = replayVaultHistory(present, [
      commit("c2", "2026-09-02T10:00:00Z", [["capabilities/new.md", "added"]]),
      commit("c1", "2026-09-01T10:00:00Z", []),
    ]);
    expect(points.at(-1)!.counts).toEqual(present);
  });

  it("undoes an addition, so the file is absent before the commit that added it", () => {
    const points = replayVaultHistory(present, [
      commit("c2", "2026-09-02T10:00:00Z", [["capabilities/new.md", "added"]]),
      commit("c1", "2026-09-01T10:00:00Z", []),
    ]);
    expect(points[0]!.counts.concept).toBe(2);
    expect(points[1]!.counts.concept).toBe(3);
  });

  it("undoes a deletion, so the file is present before the commit that removed it", () => {
    const points = replayVaultHistory(present, [
      commit("c2", "2026-09-02T10:00:00Z", [["wiki/gone.md", "deleted"]]),
      commit("c1", "2026-09-01T10:00:00Z", []),
    ]);
    expect(points[0]!.counts.writeUp).toBe(3);
    expect(points[1]!.counts.writeUp).toBe(2);
  });

  it("treats a modification as no change at all, because only existence counts", () => {
    const points = replayVaultHistory(present, [
      commit("c2", "2026-09-02T10:00:00Z", [["capabilities/checkout.md", "modified"]]),
      commit("c1", "2026-09-01T10:00:00Z", []),
    ]);
    expect(points[0]!.counts).toEqual(present);
  });

  it("moves the three layers independently in one commit", () => {
    const points = replayVaultHistory(present, [
      commit("c2", "2026-09-02T10:00:00Z", [
        ["capabilities/new.md", "added"],
        ["wiki/page.md", "added"],
        ["sources/old.pdf", "deleted"],
      ]),
      commit("c1", "2026-09-01T10:00:00Z", []),
    ]);
    expect(points[0]!.counts).toEqual({ concept: 2, writeUp: 1, document: 5 });
  });

  it("ignores a path no rule counts", () => {
    const points = replayVaultHistory(present, [
      commit("c2", "2026-09-02T10:00:00Z", [["wiki/_log.md", "added"], ["logo.png", "added"]]),
      commit("c1", "2026-09-01T10:00:00Z", []),
    ]);
    expect(points[0]!.counts).toEqual(present);
  });

  /*
   * ⚠️ A rename arrives as delete + add (`--no-renames`). Split across the window's oldest
   * edge, the add is inside and its matching earlier state is not, so the rewind can run
   * past zero. A folder holding minus three documents is worse than a slightly short
   * window, so it clamps.
   */
  it("never draws a folder holding a negative number of anything", () => {
    const points = replayVaultHistory({ concept: 1, writeUp: 0, document: 0 }, [
      commit("c2", "2026-09-02T10:00:00Z", [["a.md", "added"]]),
      commit("c1", "2026-09-01T10:00:00Z", [["b.md", "added"]]),
    ]);
    for (const point of points) expect(point.counts.concept).toBeGreaterThanOrEqual(0);
  });

  it("returns nothing at all when there is no history, rather than a zero point", () => {
    expect(replayVaultHistory(present, [])).toEqual([]);
  });
});

describe("weeklyVaultHistory — what the folder held at the end of each week", () => {
  it("keeps the last commit of a week and drops the ones before it", () => {
    const weeks = weeklyVaultHistory([
      { isoTime: "2026-09-01T09:00:00Z", hash: "mon", counts: { concept: 1, writeUp: 0, document: 0 } },
      { isoTime: "2026-09-04T09:00:00Z", hash: "thu", counts: { concept: 4, writeUp: 1, document: 2 } },
      { isoTime: "2026-09-09T09:00:00Z", hash: "nextTue", counts: { concept: 6, writeUp: 2, document: 3 } },
    ]);
    expect(weeks).toHaveLength(2);
    expect(weeks[0]).toMatchObject({ week: "2026-08-31", hash: "thu" });
    expect(weeks[0]!.counts.concept).toBe(4);
    expect(weeks[1]).toMatchObject({ week: "2026-09-07", hash: "nextTue" });
  });

  it("sorts weeks forward whatever order the points arrived in", () => {
    const weeks = weeklyVaultHistory([
      { isoTime: "2026-09-09T09:00:00Z", hash: "b", counts: { concept: 2, writeUp: 0, document: 0 } },
      { isoTime: "2026-09-01T09:00:00Z", hash: "a", counts: { concept: 1, writeUp: 0, document: 0 } },
    ]);
    expect(weeks.map((w) => w.week)).toEqual(["2026-08-31", "2026-09-07"]);
  });

  /*
   * A week nobody committed in is absent, not zero. Drawn as zero it says the folder was
   * emptied and refilled, which is a lie about the person rather than about the data.
   */
  it("leaves a quiet week out rather than drawing it as empty", () => {
    const weeks = weeklyVaultHistory([
      { isoTime: "2026-08-31T09:00:00Z", hash: "a", counts: { concept: 5, writeUp: 0, document: 0 } },
      { isoTime: "2026-09-14T09:00:00Z", hash: "b", counts: { concept: 6, writeUp: 0, document: 0 } },
    ]);
    expect(weeks.map((w) => w.week)).toEqual(["2026-08-31", "2026-09-14"]);
  });

  it("drops a point whose timestamp cannot be read", () => {
    const weeks = weeklyVaultHistory([
      { isoTime: "not a date", hash: "bad", counts: { concept: 1, writeUp: 0, document: 0 } },
    ]);
    expect(weeks).toEqual([]);
  });
});

describe("vaultHistoryPeak — the shared baseline the three tracks scale to", () => {
  it("takes the largest count any one layer reaches", () => {
    expect(
      vaultHistoryPeak([
        { week: "2026-09-01", hash: "a", counts: { concept: 12, writeUp: 3, document: 40 } },
        { week: "2026-09-08", hash: "b", counts: { concept: 60, writeUp: 4, document: 41 } },
      ]),
    ).toBe(60);
  });

  it("is zero for no weeks at all", () => {
    expect(vaultHistoryPeak([])).toBe(0);
  });
});

/**
 * The measurement that decided this surface exists, kept as a case so the shape it is
 * built to read cannot be refactored away: on this repository's own vault the concepts
 * fell while the folder kept being worked in. A single blended score moves 157 → 132 and
 * calls that "down a little"; the three series show a third of the meaning layer going.
 */
describe("the divergence a blended score would erase", () => {
  it("keeps the layers apart, so a fall in one is visible beside a rise in another", () => {
    const weeks = weeklyVaultHistory([
      { isoTime: "2026-06-29T10:00:00Z", hash: "a", counts: { concept: 107, writeUp: 0, document: 50 } },
      { isoTime: "2026-07-27T10:00:00Z", hash: "b", counts: { concept: 71, writeUp: 0, document: 61 } },
    ]);
    expect(weeks[0]!.counts.concept - weeks[1]!.counts.concept).toBe(36);
    expect(weeks[1]!.counts.document - weeks[0]!.counts.document).toBe(11);
    const blended = weeks.map((w) => w.counts.concept + w.counts.writeUp + w.counts.document);
    expect(blended).toEqual([157, 132]);
  });
});
