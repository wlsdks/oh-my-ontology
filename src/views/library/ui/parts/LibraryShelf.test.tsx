import { act, fireEvent, render, screen } from "@testing-library/react";
import { NextIntlClientProvider, useTranslations } from "next-intl";
import { afterEach, describe, expect, it, vi } from "vitest";

import enMessages from "../../../../../messages/en.json";
import type { LibraryUiModel } from "../../lib/use-library-model";
import { LibrarySection } from "./LibrarySection";

/**
 * The shelf, measured where a browser cannot be asked: which mark each page wears, that a
 * search puts the rows back, and that Compile's light really steps from spine to spine
 * rather than sitting on one — the sequence a screenshot can show a frame of but not
 * prove.
 */

const PAGES = [
  { slug: "wiki/plan", title: "Quarter plan", sourcePaths: ["sources/plan.pdf"], createdBy: "agent:claude", compiledAt: null },
  { slug: "wiki/budget", title: "Budget review", sourcePaths: ["sources/budget.xlsx"], createdBy: "agent:claude", compiledAt: null },
  { slug: "wiki/handover", title: "Handover notes", sourcePaths: [], createdBy: "agent:claude", compiledAt: null },
];

const MODEL = {
  sources: [],
  wikiPages: PAGES,
  needsCompileCount: 0,
  notCompiledCount: 0,
  staleCount: 0,
  partialCount: 0,
  pathsNeedingHash: [],
  verdicts: new Map(),
  offTemplateCount: 0,
  hashes: new Map(),
  pageTexts: new Map([
    ["wiki/plan", "x".repeat(200)],
    ["wiki/budget", "x".repeat(5_000)],
  ]),
  log: { lastCompile: null, lastLint: null },
  pairing: {
    originalsByWiki: new Map(),
    writeUpsBySource: new Map([
      ["sources/plan.pdf", [{ slug: "wiki/plan", title: "Quarter plan", freshness: "current" }]],
      ["sources/budget.xlsx", [{ slug: "wiki/budget", title: "Budget review", freshness: "behind" }]],
    ]),
  },
} as unknown as LibraryUiModel;

function Harness({
  compiling = false,
  selectedSlug = null,
  onSelect = () => {},
}: {
  compiling?: boolean;
  selectedSlug?: string | null;
  onSelect?: (slug: string) => void;
}) {
  const t = useTranslations("library");
  return (
    <LibrarySection
      model={MODEL}
      selectedSlug={selectedSlug}
      selectedSourcePath={null}
      onSelect={onSelect}
      onOpenSource={() => {}}
      onAddFiles={() => {}}
      onFindDocuments={() => {}}
      onImportFromService={() => {}}
      onCompile={() => {}}
      onLint={() => {}}
      onNewPage={() => {}}
      segment="wiki"
      compileNote={null}
      busy={false}
      compiling={compiling}
      t={t}
    />
  );
}

function mount(node: React.ReactNode) {
  return render(<NextIntlClientProvider locale="en" messages={enMessages}>{node}</NextIntlClientProvider>);
}

afterEach(() => {
  vi.useRealTimers();
});

describe("the wiki list at rest is a shelf, and every spine carries its freshness", () => {
  it("draws one spine per page, each with the state the folder derived", () => {
    mount(<Harness />);
    expect(screen.getByTestId("library-wiki-shelf")).toBeInTheDocument();
    expect(screen.getByTestId("library-wiki-wiki/plan")).toHaveAttribute("data-freshness", "fresh");
    expect(screen.getByTestId("library-wiki-wiki/budget")).toHaveAttribute("data-freshness", "stale");
    // A page citing nothing has never been checked against a file, and says so rather
    // than borrowing the look of one that was.
    expect(screen.getByTestId("library-wiki-wiki/handover")).toHaveAttribute(
      "data-freshness",
      "unverified",
    );
  });

  it("marks the stale page and nothing else, so the amber rim is a state and not a texture", () => {
    mount(<Harness />);
    expect(screen.getAllByTestId("library-spine-stale-rim")).toHaveLength(1);
    expect(
      screen.getByTestId("library-wiki-wiki/budget").querySelector('[data-testid="library-spine-stale-rim"]'),
    ).not.toBeNull();
  });

  it("varies width with the page's length and never with its height", () => {
    mount(<Harness />);
    expect(screen.getByTestId("library-wiki-wiki/plan")).toHaveAttribute("data-width-step", "xs");
    expect(screen.getByTestId("library-wiki-wiki/budget")).toHaveAttribute("data-width-step", "md");
    // Unread: the middle-low step, never the shortest — that would be a fact nothing established.
    expect(screen.getByTestId("library-wiki-wiki/handover")).toHaveAttribute("data-width-step", "sm");
    for (const slug of ["plan", "budget", "handover"]) {
      expect(screen.getByTestId(`library-wiki-wiki/${slug}`).style.height).toBe(
        "var(--library-spine-height)",
      );
    }
  });

  it("carries the whole title and the state in words, because a spine truncates", () => {
    mount(<Harness />);
    const spine = screen.getByTestId("library-wiki-wiki/budget");
    expect(spine.getAttribute("aria-label")).toContain("Budget review");
    expect(spine.getAttribute("aria-label")).toContain("its source changed after this page was written");
    expect(spine.getAttribute("title")).toContain("Budget review");
  });

  it("opens the page it is pressed on", () => {
    const onSelect = vi.fn();
    mount(<Harness onSelect={onSelect} />);
    fireEvent.click(screen.getByTestId("library-wiki-wiki/plan"));
    expect(onSelect).toHaveBeenCalledWith("wiki/plan");
  });

  it("marks the open page and only it", () => {
    mount(<Harness selectedSlug="wiki/plan" />);
    expect(screen.getByTestId("library-wiki-wiki/plan")).toHaveAttribute("aria-current", "true");
    expect(screen.getByTestId("library-wiki-wiki/budget")).not.toHaveAttribute("aria-current");
  });

  it("puts the rows back while a search is running — an answer reads down a column", () => {
    mount(<Harness />);
    fireEvent.change(screen.getByTestId("library-search"), { target: { value: "plan" } });
    expect(screen.queryByTestId("library-wiki-shelf")).toBeNull();
    expect(screen.getByTestId("library-wiki-list").querySelectorAll("li")).toHaveLength(2);
  });
});

describe("Compile marks the shelf, never one book on it", () => {
  it("states the turn on the board and in words, and puts no light on a spine", () => {
    vi.useFakeTimers();
    const { rerender } = mount(<Harness compiling />);
    expect(screen.getByTestId("library-shelf-compiling")).toBeInTheDocument();
    expect(screen.getByTestId("library-wiki-list")).toHaveAttribute("data-compiling", "board");
    expect(screen.getByTestId("library-wiki-shelf")).toHaveAttribute("aria-busy", "true");
    // No clock: a light that rested on one spine at a time measured 1.29:1 against the
    // open page's own fill and claimed a per-page progress nothing here holds.
    act(() => void vi.advanceTimersByTime(2_000));
    expect(document.querySelectorAll("[data-sweep]")).toHaveLength(0);
    rerender(
      <NextIntlClientProvider locale="en" messages={enMessages}>
        <Harness compiling={false} />
      </NextIntlClientProvider>,
    );
    expect(screen.queryByTestId("library-shelf-compiling")).toBeNull();
    expect(screen.getByTestId("library-wiki-list")).not.toHaveAttribute("data-compiling");
  });

  it("reads the same with reduced motion, because nothing moved to begin with", () => {
    const matchMedia = vi.spyOn(window, "matchMedia").mockImplementation(
      (query: string) =>
        ({
          matches: query.includes("prefers-reduced-motion"),
          media: query,
          addEventListener: () => {},
          removeEventListener: () => {},
          addListener: () => {},
          removeListener: () => {},
          onchange: null,
          dispatchEvent: () => false,
        }) as unknown as MediaQueryList,
    );
    try {
      mount(<Harness compiling />);
      expect(screen.getByTestId("library-wiki-list")).toHaveAttribute("data-compiling", "board");
      expect(screen.getByTestId("library-shelf-compiling")).toBeInTheDocument();
      expect(screen.getByTestId("library-shelf-board")).toBeInTheDocument();
    } finally {
      matchMedia.mockRestore();
    }
  });
});
