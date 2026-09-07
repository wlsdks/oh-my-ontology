import type { useTranslations } from "next-intl";

import type { LibraryUiModel } from "./use-library-model";

/**
 * **Where the folder stands, in the three words the shelf uses.**
 *
 * The derivation lived inside `LibraryStage` until 2026-09-06, which was fine while the
 * shelf was the only thing that said it. It is not any more: the Library's pane became
 * the graph, and the graph's header carries a one-line status strip — *Gather done ·
 * Compile next · 1 waiting* — so the same three states are now read in two places at
 * once, one of them permanently on screen and the other behind a chip.
 *
 * Two copies of this arithmetic would disagree the first time either one was edited, and
 * they would disagree **visibly**, in one viewport. So it is one function, and both
 * surfaces render what it returns.
 */

/**
 * `checking` is the fourth word, added 2026-09-07.
 *
 * Hashing is lazy: a source that has been listed but not yet measured is **neither**
 * written up nor waiting, and `needsCompileCount` counts only the ones known to be
 * waiting. Without this word the arithmetic read a folder mid-measurement as finished —
 * the guide said *Compile done · every source already has a write-up that matches its
 * bytes* while step three said *0 of 7 written up* and all seven rows said *checking*
 * (owner, on the merged build). Three surfaces, three answers, one folder.
 *
 * It is deliberately not `waiting`: nothing is wrong and there is nothing to press. It is
 * the honest "ask again in a moment" the source rows have carried since they shipped.
 */
export type LibraryStepState = "done" | "next" | "waiting" | "checking";

export interface LibraryStepStates {
  gather: LibraryStepState;
  compile: LibraryStepState;
  read: LibraryStepState;
  /**
   * Index of the earliest step that is `next`, or `-1` when none is.
   *
   * Two steps can honestly be next at once — a folder with pages already written and
   * sources still waiting can be compiled or read — but two emphases are no emphasis at
   * all. Every badge stays true; only the one visual lead moves.
   */
  leadIndex: number;
  /** Sources listed but not yet measured — the count the `checking` word stands for. */
  checkingCount: number;
}

/**
 * **What is still waiting, in the clauses a person acts on.**
 *
 * Three unfinished states, and they are not one number: a source nobody wrote up, a page
 * that has fallen behind its bytes, and a page written from the first part of a long file
 * are three different pieces of work. `needsCompileCount` adds them together for the
 * button; this is the same arithmetic as words, and it is one function because the index's
 * footnote and step two's caption both print it — two copies would disagree the first time
 * either was edited, and they would disagree in one viewport.
 *
 * Returns null when nothing is waiting, which is the caller's cue to say something else
 * rather than to print a zero.
 */
export function libraryWaitingLine(
  model: Pick<LibraryUiModel, "notCompiledCount" | "staleCount" | "partialCount">,
  t: ReturnType<typeof useTranslations<"library">>,
): string | null {
  const clauses: string[] = [];
  if (model.notCompiledCount > 0 && model.staleCount > 0) {
    clauses.push(
      t("sources.needsCompileSplit", {
        notCompiled: model.notCompiledCount,
        stale: model.staleCount,
      }),
    );
  } else if (model.staleCount > 0) {
    clauses.push(t("sources.staleOnly", { count: model.staleCount }));
  } else if (model.notCompiledCount > 0) {
    clauses.push(t("sources.needsCompile", { count: model.notCompiledCount }));
  }
  /*
   * Last, and never folded into the two above. A page that read part of a long file is
   * the least urgent of the three — it is right about what it covers — so it is named
   * after the work that is actually missing rather than counted alongside it.
   */
  if (model.partialCount > 0) {
    clauses.push(t("sources.partialOnly", { count: model.partialCount }));
  }
  return clauses.length === 0 ? null : clauses.join(" · ");
}

export function libraryStepStates(
  model: Pick<LibraryUiModel, "sources" | "wikiPages" | "needsCompileCount">,
): LibraryStepStates {
  const sourceCount = model.sources.length;
  /**
   * Sources listed but not yet hashed. The rows say `checking` for exactly these, and the
   * two steps that would otherwise claim a verdict about them say the same word.
   */
  const checkingCount = model.sources.filter((row) => row.state === "checking").length;
  const gather: LibraryStepState = sourceCount > 0 ? "done" : "next";
  const compile: LibraryStepState =
    model.needsCompileCount > 0 && sourceCount > 0
      ? "next"
      : sourceCount === 0
        ? "waiting"
        : checkingCount > 0
          ? "checking"
          : model.wikiPages.length > 0
            ? "done"
            : "next";
  /*
   * `next` was unreachable here until 2026-09-06: both branches returned `waiting`, so a
   * folder whose pages were all written still showed the last step as one whose turn had
   * not come. Reading is done only when every source is covered; with pages on the shelf
   * and sources still waiting, reading is exactly what to do next.
   */
  const read: LibraryStepState =
    model.wikiPages.length === 0
      ? "waiting"
      : model.needsCompileCount > 0
        ? "next"
        : checkingCount > 0
          ? "checking"
          : "done";
  return {
    gather,
    compile,
    read,
    leadIndex: [gather, compile, read].indexOf("next"),
    checkingCount,
  };
}
