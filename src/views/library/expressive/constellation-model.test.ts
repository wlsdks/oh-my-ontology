import { describe, expect, it } from "vitest";

import {
  buildConstellation,
  CONSTELLATION_MARK_CAP,
  type ConstellationModel,
} from "./constellation-model";

/**
 * The object is the folder's own shape, so these are assertions about a folder rather
 * than about a picture: how many marks a folder produces, which ones a citation joins,
 * and that the same folder always draws the same object.
 */

const kinds = (model: ConstellationModel) => model.marks.map((mark) => mark.kind);
const radius = (mark: { x: number; y: number; z: number }) =>
  Math.sqrt(mark.x * mark.x + mark.y * mark.y + mark.z * mark.z);

describe("buildConstellation — the anonymous folder", () => {
  it("draws a structure rather than an empty space when nobody has opened a folder", () => {
    const model = buildConstellation();
    expect(model.marks.length).toBeGreaterThan(12);
    expect(kinds(model)).toContain("page");
    expect(kinds(model)).toContain("source");
    expect(model.links.length).toBeGreaterThan(0);
  });

  it("is the same object every time, so it does not shuffle between renders", () => {
    expect(buildConstellation()).toEqual(buildConstellation());
  });
});

describe("buildConstellation — a real folder", () => {
  it("draws one mark per page and one per source", () => {
    const model = buildConstellation({ sourceCount: 6, pageSourceCounts: [2, 1] });
    expect(kinds(model).filter((kind) => kind === "page")).toHaveLength(2);
    expect(kinds(model).filter((kind) => kind === "source")).toHaveLength(6);
  });

  it("joins each page to as many sources as it declares", () => {
    const model = buildConstellation({ sourceCount: 6, pageSourceCounts: [2, 3] });
    expect(model.links).toHaveLength(5);
    expect(model.links.filter(([page]) => page === 0)).toHaveLength(2);
    expect(model.links.filter(([page]) => page === 1)).toHaveLength(3);
  });

  it("points every citation from a page to a source, never the other way", () => {
    const model = buildConstellation({ sourceCount: 5, pageSourceCounts: [2, 2] });
    for (const [pageIndex, sourceIndex] of model.links) {
      expect(model.marks[pageIndex]!.kind).toBe("page");
      expect(model.marks[sourceIndex]!.kind).toBe("source");
    }
  });

  /*
   * A page written from several documents is the foreground of the object. Without this
   * the sphere is a uniform field and there is nothing for an eye to land on.
   */
  it("gives the page that gathered the most documents the greatest weight", () => {
    const model = buildConstellation({ sourceCount: 8, pageSourceCounts: [1, 4, 2] });
    const pages = model.marks.filter((mark) => mark.kind === "page");
    expect(pages[1]!.weight).toBe(1);
    expect(pages[0]!.weight).toBeLessThan(pages[2]!.weight);
  });

  it("keeps a source nobody cites out on the shell, where the eye can find it", () => {
    const model = buildConstellation({ sourceCount: 4, pageSourceCounts: [1] });
    const cited = new Set(model.links.map(([, sourceIndex]) => sourceIndex));
    const uncited = model.marks
      .map((mark, index) => ({ mark, index }))
      .filter(({ mark, index }) => mark.kind === "source" && !cited.has(index));
    expect(uncited).not.toHaveLength(0);
    for (const { mark } of uncited) expect(radius(mark)).toBeCloseTo(1, 5);
  });

  it("pulls a cited source in toward the page that cites it", () => {
    const model = buildConstellation({ sourceCount: 3, pageSourceCounts: [1] });
    const [[, sourceIndex]] = model.links as [[number, number]];
    expect(radius(model.marks[sourceIndex]!)).toBeLessThan(1);
  });
});

describe("buildConstellation — a backdrop is a texture, not an inventory", () => {
  it("caps the marks it places however large the folder is", () => {
    const model = buildConstellation({ sourceCount: 5000, pageSourceCounts: [1, 1, 1] });
    expect(model.marks.length).toBeLessThanOrEqual(CONSTELLATION_MARK_CAP);
  });

  it("spends the cap on pages first, because a page is what the Library is for", () => {
    const pageSourceCounts = Array.from({ length: CONSTELLATION_MARK_CAP + 40 }, () => 1);
    const model = buildConstellation({ sourceCount: 900, pageSourceCounts });
    expect(kinds(model).filter((kind) => kind === "page")).toHaveLength(CONSTELLATION_MARK_CAP);
    expect(kinds(model).filter((kind) => kind === "source")).toHaveLength(0);
  });

  it("draws nothing at all for a folder with nothing in it", () => {
    expect(buildConstellation({ sourceCount: 0, pageSourceCounts: [] })).toEqual({
      marks: [],
      links: [],
    });
  });

  it("survives a folder describing itself with nonsense", () => {
    const model = buildConstellation({ sourceCount: -3, pageSourceCounts: [Number.NaN, -1, 2] });
    expect(model.marks.every((mark) => Number.isFinite(mark.x + mark.y + mark.z))).toBe(true);
    expect(model.links.every(([page, src]) => model.marks[page] && model.marks[src])).toBe(true);
  });
});
