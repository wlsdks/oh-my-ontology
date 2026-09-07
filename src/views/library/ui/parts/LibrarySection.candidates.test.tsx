import { fireEvent, render, screen } from "@testing-library/react";
import { NextIntlClientProvider, useTranslations } from "next-intl";
import { describe, expect, it, vi } from "vitest";

import enMessages from "../../../../../messages/en.json";
import type { LintFinding, LintNodeCandidate } from "@/features/library";
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

const CANDIDATES: LintNodeCandidate[] = [
  { name: "Export Worker", kind: "element", pages: ["wiki/a", "wiki/b"], why: "named on three pages" },
  { name: "Teodor Vasquez", kind: "person", pages: ["wiki/a"], why: "" },
];

function Harness({ onPropose, candidates = CANDIDATES, onWriteModeChange = null, writeMode = "auto", findings = [], onFix = null }: { onPropose: ((c: LintNodeCandidate) => void) | null; candidates?: LintNodeCandidate[]; onWriteModeChange?: ((mode: "auto" | "ask") => void) | null; writeMode?: "auto" | "ask"; findings?: LintFinding[]; onFix?: ((f: LintFinding) => void) | null }) {
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
      candidates={candidates}
      onPropose={onPropose}
      writeMode={writeMode}
      onWriteModeChange={onWriteModeChange}
      findings={findings}
      onFix={onFix}
      /*
       * `transferNote` became `compileNote` and the drop hint left this column for the
       * empty-folder stage (2026-09-07 merge). The case is unchanged; it points at the
       * prop that carries the same fact.
       */
      compileNote={null}
      busy={false}
      t={t}
    />
  );
}

function mount(node: React.ReactNode) {
  return render(<NextIntlClientProvider locale="en" messages={enMessages}>{node}</NextIntlClientProvider>);
}

describe("names without a page become node candidates a person can propose", () => {
  it("lists each candidate with its kind and page count, and a Propose chip", () => {
    const onPropose = vi.fn();
    mount(<Harness onPropose={onPropose} />);
    const rows = screen.getAllByTestId("library-candidate");
    expect(rows).toHaveLength(2);
    expect(rows[0]!.textContent).toContain("Export Worker");
    expect(rows[0]!.textContent).toContain("element");
    expect(rows[0]!.textContent).toContain("on 2 pages");
    expect(rows[1]!.textContent).toContain("stays in the wiki");
    // One chip, not two: a person is a name the wiki keeps, never a node on the map.
    expect(screen.getAllByTestId("library-candidate-propose")).toHaveLength(1);
    fireEvent.click(screen.getAllByTestId("library-candidate-propose")[0]!);
    expect(onPropose).toHaveBeenCalledWith(CANDIDATES[0]);
  });

  it("shows five rows with the map kinds first and folds the rest behind a count", () => {
    const many: LintNodeCandidate[] = [
      { name: "Ines", kind: "person", pages: ["wiki/a"], why: "" },
      { name: "Halden", kind: "organisation", pages: ["wiki/a"], why: "" },
      { name: "Platform lift", kind: "element", pages: ["wiki/a"], why: "" },
      { name: "Callum", kind: "person", pages: ["wiki/a"], why: "" },
      { name: "Brightwater", kind: "organisation", pages: ["wiki/a"], why: "" },
      { name: "Fire letter", kind: "other", pages: ["wiki/a"], why: "" },
      { name: "Consent", kind: "other", pages: ["wiki/a"], why: "" },
    ];
    mount(<Harness onPropose={vi.fn()} candidates={many} />);
    const rows = screen.getAllByTestId("library-candidate");
    expect(rows).toHaveLength(5);
    expect(rows[0]!.textContent).toContain("Platform lift");
    const fold = screen.getByTestId("library-candidates-fold");
    expect(fold.textContent).toContain("2 more names");
    fireEvent.click(fold);
    expect(screen.getAllByTestId("library-candidate")).toHaveLength(7);
    expect(screen.getByTestId("library-candidates-fold").textContent).toContain("Fewer names");
  });

  it("offers the write-mode switch beside the doors, with the landing default active", () => {
    const onWriteModeChange = vi.fn();
    mount(<Harness onPropose={vi.fn()} onWriteModeChange={onWriteModeChange} />);
    expect(screen.getByTestId("library-write-mode-auto").getAttribute("aria-pressed")).toBe("true");
    fireEvent.click(screen.getByTestId("library-write-mode-ask"));
    expect(onWriteModeChange).toHaveBeenCalledWith("ask");
  });

  it("lists each finding with its kind and pages, and a Fix chip that hands the finding back", () => {
    const onFix = vi.fn();
    const findings: LintFinding[] = [{ code: "disagreement", pages: ["wiki/a", "wiki/b"], summary: "Budget 240,000 vs 210,000." }];
    mount(<Harness onPropose={null} findings={findings} onFix={onFix} />);
    const row = screen.getByTestId("library-finding");
    expect(row.textContent).toContain("Budget 240,000 vs 210,000.");
    expect(row.textContent).toContain("disagreement · a, b");
    fireEvent.click(screen.getByTestId("library-finding-fix"));
    expect(onFix).toHaveBeenCalledWith(findings[0]);
  });

  it("shows no rows when the last check named nobody, and no chip where no agent can run", () => {
    mount(<Harness onPropose={null} candidates={[]} />);
    expect(screen.queryByTestId("library-candidates")).toBeNull();
  });

  it("keeps the names visible on the web, where the chip cannot be offered", () => {
    mount(<Harness onPropose={null} />);
    expect(screen.getAllByTestId("library-candidate")).toHaveLength(2);
    expect(screen.queryByTestId("library-candidate-propose")).toBeNull();
  });
});
