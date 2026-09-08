import type { LibraryWikiPage, LibraryWriteUpLink } from "@/entities/docs-vault";

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

/**
 * One page's freshness, from the crossings the library model already derived.
 *
 * `writeUpsBySource` is `LibraryModel.pairing.writeUpsBySource`: source path → the wiki
 * pages citing it, each with how **that page** stands to the bytes. Reading the page's
 * own entry rather than the source row's state matters, because the source row is
 * deliberately generous — two pages may cover one document and one of them may be older,
 * and the source is still covered. Each index row speaks for one page.
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
