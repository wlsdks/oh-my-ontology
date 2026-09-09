/**
 * **The Library's constellation — the folder as an object, before it has one.**
 *
 * The owner, 2026-09-09, on the Library's empty screen and its half-dead stage: *"this
 * screen isn't pretty… redesign it, make it cool! something with motion or animation
 * too… you can use three.js or whatever! something cool like geometric shapes!"*
 *
 * The answer this module takes is that the backdrop is not decoration. Atlas already
 * refuses a mark that carries no fact (`widgets/ontology-map/expressive/README.md`), and
 * a Library whose empty state showed abstract art would be teaching a newcomer nothing on
 * the one screen where they know least. So the object **is** the Library's own shape:
 *
 * | Mark | What it is |
 * |---|---|
 * | cube | a source — a document kept verbatim, the same square the Library's 2D graph draws |
 * | sphere | a wiki page — a write-up, the same filled circle that graph draws |
 * | line | a citation — a page and the document it was written from |
 *
 * It is drawn on **one** screen: the Library with no folder open. There is nothing true
 * to draw there, so the object is explicitly **anonymous** — a deterministic seeded folder
 * saying *this is the shape of the thing you are about to make*, never a claim about files
 * the person has. It is not drawn once a folder is open, and that is deliberate: a working
 * folder's object is small (the frame that settled it had ten marks), and ten marks behind
 * a working screen read as debris rather than as a picture. The Library already draws the
 * real folder properly, in 2D, in the graph the `Graph` chip opens.
 *
 * `buildConstellation` still takes a folder because the anonymous one **is** a folder —
 * one code path, one set of rules — and because the tests state the object's contract in
 * terms of folders rather than of one frozen constant.
 *
 * ## Why the maths lives here and not in the scene
 *
 * Same contract as the map's expressive folder: plain data in, plain numbers out, no
 * three.js, no React, no DOM, no clock. Placement is deterministic given its input, so it
 * is testable without a GPU, and `constellation-scene.ts` is left owning nothing but
 * materials, the camera and the frame. Delete the scene and this still answers "what
 * shape is this folder"; delete both and the Library is back to a flat panel.
 *
 * ## Placement
 *
 * Pages sit on an inner shell and sources on an outer one, both on a Fibonacci spiral so
 * the marks spread evenly rather than clumping at the poles the way a naive random
 * spherical pick does. A source is then pulled toward the page that cites it, which is
 * what makes the object read as *documents gathered around what was written from them*
 * instead of two abstract shells. A source nothing cites keeps its place on the outer
 * shell, which is a fact worth seeing: the Library's own list calls such a document
 * not-compiled, and the object says the same thing by leaving it out on the rim.
 */

/** One mark in the object, in a unit-radius space the scene scales as it likes. */
export interface ConstellationMark {
  kind: "source" | "page";
  x: number;
  y: number;
  z: number;
  /**
   * 0–1. Drives size and brightness so the object has a foreground: a page that gathered
   * several documents is a larger, brighter sphere than one written from a single file.
   */
  weight: number;
}

/** A citation: indices into `marks`, page first. */
type ConstellationLink = readonly [pageIndex: number, sourceIndex: number];

export interface ConstellationModel {
  marks: ConstellationMark[];
  links: ConstellationLink[];
}

/** What the object needs to know about a real folder. Counts and shape, never contents. */
export interface ConstellationInput {
  /** How many documents the folder keeps verbatim. */
  sourceCount: number;
  /** One entry per wiki page: how many of those documents it was written from. */
  pageSourceCounts: readonly number[];
}

/**
 * The anonymous folder drawn when nobody has opened one.
 *
 * Sized by eye against the rendered object rather than picked as a round number: at 18
 * sources nearly every one was claimed by a page and pulled off the outer shell, so the
 * silhouette collapsed on one side and the object read as a scatter. Leaving about a
 * third of the documents unclaimed keeps the shell round *and* is the truer picture of a
 * young folder, where most of what you have gathered has not been written up yet.
 */
const ANONYMOUS: ConstellationInput = {
  sourceCount: 26,
  pageSourceCounts: [3, 2, 2, 1, 1, 4, 2, 1],
};

/** Marks past this stop being placed; a backdrop is a texture, not an inventory. */
export const CONSTELLATION_MARK_CAP = 96;

const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5));

/**
 * How far a cited document travels toward the page that cites it.
 *
 * Enough that the pair reads as belonging together, not so much that a claimed source
 * leaves the outer shell — at 0.34 the shell dented visibly wherever a page had gathered
 * several documents, and a dent reads as a fault in the drawing rather than as structure.
 */
const PAGE_PULL = 0.24;

/**
 * The `i`-th of `count` points spread evenly over a sphere of radius `radius`.
 *
 * A Fibonacci spiral rather than random spherical coordinates: random picks clump, and a
 * clump in a backdrop reads as a defect in the data rather than as noise in the drawing.
 */
function spherePoint(
  i: number,
  count: number,
  radius: number,
): { x: number; y: number; z: number } {
  // `count + 1` keeps the very first point off the exact pole, where a mark reads as a
  // mistake because every line to it converges.
  const y = 1 - (2 * (i + 0.5)) / Math.max(1, count);
  const r = Math.sqrt(Math.max(0, 1 - y * y));
  const theta = GOLDEN_ANGLE * i;
  return { x: Math.cos(theta) * r * radius, y: y * radius, z: Math.sin(theta) * r * radius };
}

/**
 * Build the object.
 *
 * Pass no input for the anonymous folder. Pass a folder's real counts and the same
 * function returns that folder — one code path, so the picture a person meets before
 * choosing a folder and the picture they get after are the same drawing of two datasets.
 */
export function buildConstellation(input?: ConstellationInput): ConstellationModel {
  const source = input ?? ANONYMOUS;
  const pageCounts = source.pageSourceCounts.filter((count) => Number.isFinite(count));
  const wantedSources = Math.max(0, Math.floor(source.sourceCount));
  // The cap is spent on pages first: a page is the thing the Library is for, and a folder
  // of 400 sources should still show what was written from them.
  const pageTotal = Math.min(pageCounts.length, CONSTELLATION_MARK_CAP);
  const sourceTotal = Math.min(wantedSources, CONSTELLATION_MARK_CAP - pageTotal);

  const marks: ConstellationMark[] = [];
  const links: ConstellationLink[] = [];
  if (pageTotal === 0 && sourceTotal === 0) return { marks, links };

  const heaviest = Math.max(1, ...pageCounts.slice(0, pageTotal));
  for (let i = 0; i < pageTotal; i += 1) {
    const point = spherePoint(i, pageTotal, 0.52);
    marks.push({ kind: "page", ...point, weight: Math.min(1, (pageCounts[i] ?? 0) / heaviest) });
  }

  const sourceStart = marks.length;
  for (let i = 0; i < sourceTotal; i += 1) {
    const point = spherePoint(i, sourceTotal, 1);
    marks.push({ kind: "source", ...point, weight: 0 });
  }

  /*
   * Hand each page the next `n` sources in order and pull those sources a third of the way
   * toward it. Sequential rather than nearest-first: nearest-first made every page claim
   * the same dense band of the outer shell and left the far side bare, which drew a folder
   * with a hole in it. In order, the claimed sources spiral with the pages themselves, and
   * the object keeps its silhouette.
   */
  let cursor = sourceStart;
  for (let page = 0; page < pageTotal; page += 1) {
    const wanted = Math.max(0, Math.floor(pageCounts[page] ?? 0));
    for (let taken = 0; taken < wanted && cursor < marks.length; taken += 1, cursor += 1) {
      const sourceMark = marks[cursor]!;
      const pageMark = marks[page]!;
      sourceMark.x += (pageMark.x - sourceMark.x) * PAGE_PULL;
      sourceMark.y += (pageMark.y - sourceMark.y) * PAGE_PULL;
      sourceMark.z += (pageMark.z - sourceMark.z) * PAGE_PULL;
      links.push([page, cursor]);
    }
  }
  return { marks, links };
}

