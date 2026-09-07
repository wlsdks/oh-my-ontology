import { fireEvent, render, screen } from "@testing-library/react";
import { NextIntlClientProvider, useTranslations } from "next-intl";
import { describe, expect, it, vi } from "vitest";

import enMessages from "../../../../../messages/en.json";
import type { LintFinding, LintNodeCandidate } from "@/features/library";
import { LibraryCheckReport, findingKey } from "./LibraryCheckReport";

const CANDIDATES: LintNodeCandidate[] = [
  { name: "Export Worker", kind: "element", pages: ["wiki/a", "wiki/b"], why: "named on three pages" },
  { name: "Teodor Vasquez", kind: "person", pages: ["wiki/a"], why: "" },
];

type Props = Partial<Parameters<typeof LibraryCheckReport>[0]>;

function Harness(props: Props) {
  const t = useTranslations("library");
  return (
    <LibraryCheckReport
      findings={[]}
      candidates={[]}
      lastLint={{ at: "2026-09-07T06:10:32.356Z", summary: "disagreement 2 · superseded 2 · missing-link 2 · name-without-page 7" }}
      busy={false}
      onLint={null}
      onFix={null}
      onPropose={null}
      onOpenPage={() => {}}
      t={t}
      {...props}
    />
  );
}

function mount(node: React.ReactNode) {
  return render(<NextIntlClientProvider locale="en" messages={enMessages}>{node}</NextIntlClientProvider>);
}

describe("the check's answer is a page in the pane", () => {
  it("heads with the app's own record of the last check", () => {
    mount(<Harness />);
    expect(screen.getByTestId("library-check-report-when").textContent).toContain("superseded 2");
  });

  it("does not call a reopened app clean: an empty page under a log that counts findings says they are gone", () => {
    mount(<Harness />);
    expect(screen.getByTestId("library-check-report").textContent).toContain("does not survive reopening");
    expect(screen.getByTestId("library-check-report").textContent).not.toContain("nothing to fix");
  });

  it("says the last check found nothing to fix only when its own counts are all zero", () => {
    mount(<Harness lastLint={{ at: "2026-09-07T06:10:32.356Z", summary: "disagreement 0 · superseded 0 · missing-link 0 · name-without-page 0" }} />);
    expect(screen.getByTestId("library-check-report").textContent).toContain("nothing to fix");
  });

  it("offers the check itself when the wiki was never checked, and says it writes nothing", () => {
    const onLint = vi.fn();
    mount(<Harness lastLint={null} onLint={onLint} />);
    expect(screen.getByTestId("library-check-report-when").textContent).toContain("Not checked yet");
    fireEvent.click(screen.getByTestId("library-check-report-lint"));
    expect(onLint).toHaveBeenCalledTimes(1);
  });

  it("groups findings by kind, keeps every summary whole, links the pages, and hands the finding to Fix", () => {
    const onFix = vi.fn();
    const onOpenPage = vi.fn();
    const findings: LintFinding[] = [
      { code: "disagreement", pages: ["wiki/a", "wiki/b"], summary: "Budget 240,000 vs 210,000." },
      { code: "missing-link", pages: ["wiki/a", "wiki/answers/x"], summary: "Both cite the charter and neither links the other." },
    ];
    mount(<Harness findings={findings} onFix={onFix} onOpenPage={onOpenPage} />);
    expect(screen.getByTestId("library-check-report-disagreement").textContent).toContain("Budget 240,000 vs 210,000.");
    expect(screen.getByTestId("library-check-report-missing-link").textContent).toContain("neither links the other");
    fireEvent.click(screen.getAllByTestId("library-finding-page")[1]!);
    expect(onOpenPage).toHaveBeenCalledWith("wiki/b");
    fireEvent.click(screen.getAllByTestId("library-finding-fix")[0]!);
    expect(onFix).toHaveBeenCalledWith(findings[0]);
  });

  it("marks a finding a Fix turn completed and takes its door away until the next check", () => {
    const findings: LintFinding[] = [
      { code: "disagreement", pages: ["wiki/a", "wiki/b"], summary: "Budget 240,000 vs 210,000." },
      { code: "superseded", pages: ["wiki/a"], summary: "Reopening moved." },
    ];
    mount(<Harness findings={findings} onFix={vi.fn()} fixedKeys={new Set([findingKey(findings[0]!)])} />);
    const rows = screen.getAllByTestId("library-finding");
    expect(rows[0]!.getAttribute("data-state")).toBe("fixed");
    expect(rows[0]!.textContent).toContain("Fixed");
    expect(rows[1]!.getAttribute("data-state")).toBeNull();
    expect(screen.getAllByTestId("library-finding-fix")).toHaveLength(1);
  });

  it("lists each name with its kind and page count, and a Propose chip only for a map kind", () => {
    const onPropose = vi.fn();
    mount(<Harness candidates={CANDIDATES} onPropose={onPropose} />);
    const rows = screen.getAllByTestId("library-candidate");
    expect(rows).toHaveLength(2);
    expect(rows[0]!.textContent).toContain("Export Worker");
    expect(rows[0]!.textContent).toContain("element");
    expect(rows[0]!.textContent).toContain("on 2 pages");
    expect(rows[1]!.textContent).toContain("stays in the wiki");
    expect(screen.getAllByTestId("library-candidate-propose")).toHaveLength(1);
    fireEvent.click(screen.getAllByTestId("library-candidate-propose")[0]!);
    expect(onPropose).toHaveBeenCalledWith(CANDIDATES[0]);
  });

  it("shows five names with the map kinds first and folds the rest behind a count", () => {
    const many: LintNodeCandidate[] = [
      { name: "Ines", kind: "person", pages: ["wiki/a"], why: "" },
      { name: "Halden", kind: "organisation", pages: ["wiki/a"], why: "" },
      { name: "Platform lift", kind: "element", pages: ["wiki/a"], why: "" },
      { name: "Callum", kind: "person", pages: ["wiki/a"], why: "" },
      { name: "Brightwater", kind: "organisation", pages: ["wiki/a"], why: "" },
      { name: "Fire letter", kind: "other", pages: ["wiki/a"], why: "" },
      { name: "Consent", kind: "other", pages: ["wiki/a"], why: "" },
    ];
    mount(<Harness candidates={many} />);
    expect(screen.getAllByTestId("library-candidate")).toHaveLength(5);
    expect(screen.getAllByTestId("library-candidate")[0]!.textContent).toContain("Platform lift");
    const fold = screen.getByTestId("library-candidates-fold");
    expect(fold.textContent).toContain("2 more names");
    fireEvent.click(fold);
    expect(screen.getAllByTestId("library-candidate")).toHaveLength(7);
  });

  it("keeps the names visible on the web, where the chip cannot be offered", () => {
    mount(<Harness candidates={CANDIDATES} />);
    expect(screen.getAllByTestId("library-candidate")).toHaveLength(2);
    expect(screen.queryByTestId("library-candidate-propose")).toBeNull();
  });
});
