import { fireEvent, render, screen } from "@testing-library/react";
import { NextIntlClientProvider, useTranslations } from "next-intl";
import { describe, expect, it, vi } from "vitest";

import enMessages from "../../../../../messages/en.json";
import type { LibraryUiModel } from "../../lib/use-library-model";
import { LibrarySection } from "./LibrarySection";

const MODEL = {
  sources: [],
  wikiPages: [
    { slug: "wiki/a", title: "A", sourcePaths: [], createdBy: "agent:claude", compiledAt: null },
    { slug: "wiki/b", title: "B", sourcePaths: [], createdBy: "agent:claude", compiledAt: null },
  ],
  needsCompileCount: 0,
  notCompiledCount: 0,
  staleCount: 0,
  pathsNeedingHash: [],
  verdicts: new Map(),
  offTemplateCount: 0,
  hashes: new Map(),
  pageTexts: new Map(),
  log: { lastCompile: null, lastLint: null },
} as unknown as LibraryUiModel;

function Harness({ onNewPage = null, report = null }: { onNewPage?: ((title: string) => void) | null; report?: { count: number; open: boolean; onOpen: () => void } | null }) {
  const t = useTranslations("library");
  return (
    <LibrarySection
      model={MODEL}
      selectedSlug={null}
      selectedSourcePath={null}
      onSelect={() => {}}
      onOpenSource={() => {}}
      onAddFiles={() => {}}
      onFindDocuments={() => {}}
      onImportFromService={() => {}}
      onCompile={() => {}}
      onLint={() => {}}
      onNewPage={onNewPage}
      report={report}
      /* The doors and the list are the wiki half of the column; the switch above it decides. */
      segment="wiki"
      compileNote={null}
      busy={false}
      t={t}
    />
  );
}

function mount(node: React.ReactNode) {
  return render(<NextIntlClientProvider locale="en" messages={enMessages}>{node}</NextIntlClientProvider>);
}

describe("the wiki half of the column is an index: search, three doors, the list", () => {
  it("filters the list from one field and says what matched", () => {
    mount(<Harness />);
    const rows = () => screen.getByTestId("library-wiki-list").querySelectorAll('[data-testid^="library-wiki-wiki/"]');
    expect(rows()).toHaveLength(2);
    fireEvent.change(screen.getByTestId("library-search"), { target: { value: "b" } });
    expect(rows()).toHaveLength(1);
    expect(screen.getByTestId("library-search-matches").textContent).toContain("1 page");
  });

  it("starts a page from a title on Enter and hands the title back", () => {
    const onNewPage = vi.fn();
    mount(<Harness onNewPage={onNewPage} />);
    fireEvent.click(screen.getByTestId("library-new-page"));
    const title = screen.getByTestId("library-new-page-title");
    fireEvent.change(title, { target: { value: "Meeting notes" } });
    fireEvent.keyDown(title, { key: "Enter" });
    expect(onNewPage).toHaveBeenCalledWith("Meeting notes");
  });

  it("holds nothing but the index: no findings, no names, no write switch, no log line (owner, 2026-09-07)", () => {
    mount(<Harness onNewPage={vi.fn()} />);
    for (const id of ["library-finding", "library-candidate", "library-write-mode", "library-file-answer", "library-wiki-log"]) {
      expect(screen.queryByTestId(id)).toBeNull();
    }
    // Two agent doors on one row; New page is the list's own last row, not a door.
    expect(screen.getByTestId("library-lint")).toBeInTheDocument();
    expect(screen.getByTestId("library-compile")).toBeInTheDocument();
    const list = screen.getByTestId("library-wiki-list");
    expect(list.contains(screen.getByTestId("library-new-page"))).toBe(true);
  });

  it("says where the check's answer is with one row above the list, only once the wiki was checked", () => {
    const onOpen = vi.fn();
    const { rerender } = mount(<Harness />);
    expect(screen.queryByTestId("library-open-report")).toBeNull();
    rerender(
      <NextIntlClientProvider locale="en" messages={enMessages}>
        <Harness report={{ count: 6, open: false, onOpen }} />
      </NextIntlClientProvider>,
    );
    const row = screen.getByTestId("library-open-report");
    expect(row.textContent).toContain("Check results 6");
    fireEvent.click(row);
    expect(onOpen).toHaveBeenCalledTimes(1);
  });
});
