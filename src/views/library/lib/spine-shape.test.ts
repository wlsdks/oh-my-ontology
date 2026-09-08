import { describe, expect, it } from "vitest";

import type { LibraryWriteUpLink } from "@/entities/docs-vault";

import { spineFreshness, spineWidthStep } from "./spine-shape";

/**
 * The shelf's whole claim is that a person can read a page's freshness **before** opening
 * it. That claim is only worth as much as this derivation, so the three states are pinned
 * against the shapes a real folder produces — including the two that are easy to draw as
 * "fine" and are not: a page nobody has measured, and a page whose citation names a file
 * the folder does not hold.
 */

function links(entries: Record<string, LibraryWriteUpLink[]>): Map<string, LibraryWriteUpLink[]> {
  return new Map(Object.entries(entries));
}

describe("a spine's freshness", () => {
  it("is stale when a cited source moved after the page was written", () => {
    expect(
      spineFreshness({
        page: { slug: "wiki/plan", sourcePaths: ["sources/plan.pdf"] },
        writeUpsBySource: links({
          "sources/plan.pdf": [{ slug: "wiki/plan", title: "Plan", freshness: "behind" }],
        }),
      }),
    ).toBe("stale");
  });

  it("is stale as soon as one of several sources moved, however fresh the rest are", () => {
    expect(
      spineFreshness({
        page: { slug: "wiki/plan", sourcePaths: ["sources/a.pdf", "sources/b.pdf"] },
        writeUpsBySource: links({
          "sources/a.pdf": [{ slug: "wiki/plan", title: "Plan", freshness: "current" }],
          "sources/b.pdf": [{ slug: "wiki/plan", title: "Plan", freshness: "behind" }],
        }),
      }),
    ).toBe("stale");
  });

  it("reads its own crossing, not another page's, when two pages cover one file", () => {
    // The source row is deliberately generous — one current page covers the file — but a
    // spine speaks for one page, and this page is the one that fell behind.
    expect(
      spineFreshness({
        page: { slug: "wiki/old", sourcePaths: ["sources/plan.pdf"] },
        writeUpsBySource: links({
          "sources/plan.pdf": [
            { slug: "wiki/new", title: "New", freshness: "current" },
            { slug: "wiki/old", title: "Old", freshness: "behind" },
          ],
        }),
      }),
    ).toBe("stale");
  });

  it("is fresh when every measured citation still matches, part-read included", () => {
    expect(
      spineFreshness({
        page: { slug: "wiki/notes", sourcePaths: ["sources/notes.txt"] },
        writeUpsBySource: links({
          "sources/notes.txt": [{ slug: "wiki/notes", title: "Notes", freshness: "partial" }],
        }),
      }),
    ).toBe("fresh");
  });

  it("is unverified when the page cites nothing — a hand-written page was never checked against a file", () => {
    expect(
      spineFreshness({ page: { slug: "wiki/handover", sourcePaths: [] }, writeUpsBySource: links({}) }),
    ).toBe("unverified");
  });

  it("is unverified while nothing has been measured, rather than fresh", () => {
    expect(
      spineFreshness({
        page: { slug: "wiki/plan", sourcePaths: ["sources/plan.pdf"] },
        writeUpsBySource: links({
          "sources/plan.pdf": [{ slug: "wiki/plan", title: "Plan", freshness: "unchecked" }],
        }),
      }),
    ).toBe("unverified");
  });

  it("is unverified when the cited file is not in this folder — unprovable is not proven", () => {
    expect(
      spineFreshness({
        page: { slug: "wiki/plan", sourcePaths: ["sources/gone.pdf"] },
        writeUpsBySource: links({}),
      }),
    ).toBe("unverified");
  });
});

describe("a spine's width", () => {
  it("climbs the four steps with the page's length", () => {
    expect(spineWidthStep(400)).toBe("xs");
    expect(spineWidthStep(2_000)).toBe("sm");
    expect(spineWidthStep(5_000)).toBe("md");
    expect(spineWidthStep(20_000)).toBe("lg");
  });

  it("does not draw an unread page as the shortest one on the shelf", () => {
    expect(spineWidthStep(null)).toBe("sm");
  });
});
