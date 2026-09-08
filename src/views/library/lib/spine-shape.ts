import type { LibraryWikiPage, LibraryWriteUpLink } from "@/entities/docs-vault";

/**
 * **What a spine on the library shelf is allowed to say, and from which fact.**
 *
 * The wiki list used to be a column of identical rows: a page that had fallen behind the
 * file it was written from looked exactly like one that still described it, and the only
 * way to find out was to open the page. The shelf answers that before the press — which
 * is the whole reason it is a shelf and not a prettier list — so every mark on a spine
 * has to come from a fact the folder already holds. Nothing here guesses.
 *
 * Two facts, two marks, and they are deliberately **not** merged into one badge:
 *
 * 1. {@link spineFreshness} — how the page stands to the bytes it was written from,
 *    derived from `source_hash` through the pairing `vault-library.ts` already builds.
 * 2. {@link spineWidthStep} — how long the page is, which is the one thing allowed to
 *    change a spine's geometry. Height never varies (`--library-spine-height`), because
 *    a row whose boxes differ in height by their copy is the Don't this repository has
 *    held since the beginning.
 */

/**
 * How a page stands to its sources.
 *
 * - `stale` — some source this page cites has moved since the page was written, or the
 *   page never recorded a hash for it. Both mean *the write-up may no longer describe
 *   the file*, which is `vault-library.ts`'s own reading of `behind`, and both have the
 *   same cure: compile it again.
 * - `unverified` — **nothing has ever measured this page against a file.** It cites no
 *   source at all (a page somebody wrote by hand), or every citation it makes is still
 *   unmeasured. Drawing it as fresh would be the claim `vault-library.ts` refuses to
 *   make one list up: *a claim nothing has verified is not shown as verified.*
 * - `fresh` — at least one citation was measured and none of them is behind. A page read
 *   only in part counts as fresh here: what it says is current, and the fact that it
 *   stops short of the document is the **source** row's to carry, not the page's.
 */
export type SpineFreshness = "stale" | "unverified" | "fresh";

/** The four width steps, smallest first. Each names a token, never a number. */
export type SpineWidthStep = "xs" | "sm" | "md" | "lg";

/**
 * One page's freshness, from the crossings the library model already derived.
 *
 * `writeUpsBySource` is `LibraryModel.pairing.writeUpsBySource`: source path → the wiki
 * pages citing it, each with how **that page** stands to the bytes. Reading the page's
 * own entry rather than the source row's state matters, because the source row is
 * deliberately generous — two pages may cover one document and one of them may be older,
 * and the source is still covered. A spine speaks for one page.
 */
export function spineFreshness({
  page,
  writeUpsBySource,
}: {
  page: Pick<LibraryWikiPage, "slug" | "sourcePaths">;
  writeUpsBySource: ReadonlyMap<string, readonly LibraryWriteUpLink[]>;
}): SpineFreshness {
  if (page.sourcePaths.length === 0) return "unverified";
  let measured = 0;
  for (const path of page.sourcePaths) {
    const link = (writeUpsBySource.get(path) ?? []).find((entry) => entry.slug === page.slug);
    // No crossing at all means the folder holds no such file. The page's claim is
    // unprovable rather than wrong, so it is not counted as measured either.
    if (!link) continue;
    if (link.freshness === "behind") return "stale";
    if (link.freshness === "unchecked") continue;
    measured += 1;
  }
  return measured > 0 ? "fresh" : "unverified";
}

/**
 * The width ramp: how much page is behind the spine.
 *
 * Thresholds in characters of the page's own text, as the library model last read it.
 * They are four because four is what an eye can compare in a row without a legend; a
 * continuous width would claim a precision nobody can read off a 26px book.
 *
 * `null` is *not yet read*, and it takes `sm` rather than `xs`: an unmeasured page must
 * not be drawn as the shortest one on the shelf, which is a fact nothing established.
 */
export function spineWidthStep(chars: number | null): SpineWidthStep {
  if (chars === null) return "sm";
  if (chars < 1_200) return "xs";
  if (chars < 3_500) return "sm";
  if (chars < 8_000) return "md";
  return "lg";
}

/** The token each width step reads. Widths live in `app/globals.css`, never here. */
export const SPINE_WIDTH_TOKEN: Readonly<Record<SpineWidthStep, string>> = {
  xs: "var(--library-spine-width-xs)",
  sm: "var(--library-spine-width-sm)",
  md: "var(--library-spine-width-md)",
  lg: "var(--library-spine-width-lg)",
};

/**
 * The Compile sweep's dwell, read from `--library-spine-sweep-dwell` once.
 *
 * The light steps from spine to spine on a JS clock, because the number of spines is a
 * property of the folder and a CSS keyframe cannot hold a per-folder cycle without
 * writing the duration twice. Reading the token instead of transcribing it is what keeps
 * the value on the ramp; the fallback matches the token so a test environment without
 * the stylesheet still steps.
 */
export function readSpineSweepDwellMs(): number {
  if (typeof window === "undefined" || typeof window.getComputedStyle !== "function") return 240;
  const raw = window
    .getComputedStyle(document.documentElement)
    .getPropertyValue("--library-spine-sweep-dwell")
    .trim();
  const ms = raw.endsWith("ms") ? Number.parseFloat(raw) : raw.endsWith("s") ? Number.parseFloat(raw) * 1000 : NaN;
  return Number.isFinite(ms) && ms > 0 ? ms : 240;
}
