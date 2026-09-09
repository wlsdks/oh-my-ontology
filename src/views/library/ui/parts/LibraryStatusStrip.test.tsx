import { render, screen } from "@testing-library/react";
import { NextIntlClientProvider, useTranslations } from "next-intl";
import { describe, expect, it } from "vitest";

import ko from "../../../../../messages/ko.json";
import type { LibraryUiModel } from "../../lib/use-library-model";
import { LibraryStatusStrip } from "./LibraryStatusStrip";

/**
 * **"3 broken links" must mean three links.**
 *
 * The clause counted *pages* (measured 2026-09-09): a folder holding six broken links
 * across three pages said **3**. A person reading it goes looking for three, fixes those
 * three, and the header still says 3 — the number never moves toward zero because it was
 * never counting the thing it names.
 *
 * Its neighbour is genuinely per-page and stays that way: *off-template* is a property of
 * a page, and one page with four shape problems is still one row to open.
 */

type Verdict = LibraryUiModel["verdicts"] extends Map<string, infer V> ? V : never;

const verdict = (codes: readonly string[]): Verdict =>
  ({
    ok: codes.length === 0,
    firstProblem: codes[0] ?? null,
    firstProblemMessage: null,
    problemCount: codes.length,
    problems: codes.map((code) => ({ code, message: code })),
  }) as unknown as Verdict;

/** Only the fields the strip reads; a fuller fixture would be unverifiable against it. */
const model = (verdicts: Record<string, readonly string[]>): LibraryUiModel =>
  ({
    sources: [{ state: "compiled" }],
    wikiPages: Object.keys(verdicts).map((slug) => ({ slug })),
    needsCompileCount: 0,
    partialCount: 0,
    staleCount: 0,
    verdicts: new Map(Object.entries(verdicts).map(([slug, codes]) => [slug, verdict(codes)])),
  }) as unknown as LibraryUiModel;

function Harness({ value }: { value: LibraryUiModel }) {
  const t = useTranslations("library");
  return <LibraryStatusStrip model={value} t={t} />;
}

const strip = (verdicts: Record<string, readonly string[]>) => {
  render(
    <NextIntlClientProvider locale="ko" messages={ko}>
      <Harness value={model(verdicts)} />
    </NextIntlClientProvider>,
  );
  return screen.getByTestId("library-status-strip").textContent ?? "";
};

describe("LibraryStatusStrip — the broken-link clause counts links", () => {
  it("counts six findings across three pages as six, not three", () => {
    const text = strip({
      "wiki/a": ["dangling-wikilink"],
      "wiki/b": ["dangling-wikilink", "dangling-wikilink"],
      "wiki/c": ["dangling-wikilink", "dangling-wikilink", "dangling-wikilink"],
    });
    expect(text).toContain("끊긴 링크 6개");
  });

  it("counts two findings on one page as two", () => {
    expect(strip({ "wiki/a": ["dangling-wikilink", "dangling-wikilink"] })).toContain(
      "끊긴 링크 2개",
    );
  });

  it("says nothing about links when every page's links resolve", () => {
    expect(strip({ "wiki/a": [], "wiki/b": [] })).not.toContain("끊긴 링크");
  });

  /*
   * `orphan-page` and `shared-source-unlinked` are true of a young wiki rather than of a
   * page, and the Check-the-wiki report is where a judgement about the whole wiki belongs.
   */
  it("leaves the advisory folder findings out of the count entirely", () => {
    const text = strip({
      "wiki/a": ["orphan-page", "shared-source-unlinked"],
      "wiki/b": ["orphan-page"],
    });
    expect(text).not.toContain("끊긴 링크");
  });
});

describe("LibraryStatusStrip — the off-template clause still counts pages", () => {
  it("counts one page carrying three shape problems as one", () => {
    const text = strip({
      "wiki/a": ["missing-field:title", "section-order", "uncited-fact"],
    });
    expect(text).toContain("서식 벗어남 1개");
  });

  it("counts the pages, not the problems, across a folder", () => {
    const text = strip({
      "wiki/a": ["section-order", "uncited-fact"],
      "wiki/b": ["section-order"],
    });
    expect(text).toContain("서식 벗어남 2개");
  });
});
