import { render, screen } from "@testing-library/react";
import { NextIntlClientProvider, useTranslations } from "next-intl";
import { describe, expect, it } from "vitest";

import ko from "../../../../../messages/ko.json";
import en from "../../../../../messages/en.json";
import { WikiTemplateProblems, type WikiTemplateProblem } from "./WikiTemplateProblems";

/**
 * **What this panel says about a page must be the same thing the header counts.**
 *
 * Measured 2026-09-09 on a four-page folder that fit the template perfectly: the status
 * strip printed no off-template clause, and this panel simultaneously headed every
 * finding *This page does not fit the wiki template*. The findings were folder findings —
 * about how the pages link each other, not about any page's shape — and the heading in
 * the larger type was the wrong one.
 *
 * The second thing measured that day: a Korean reader was handed `dangling-wikilink:15`
 * followed by an English paragraph, because the sentence shipped from the validator,
 * where it is written once for machines.
 */

/** The panel takes `t` from its parent, so the harness is the only thing that calls the hook. */
function Harness({ problems }: { problems: WikiTemplateProblem[] }) {
  const t = useTranslations("library");
  return <WikiTemplateProblems problems={problems} t={t} />;
}

function renderPanel(problems: WikiTemplateProblem[], locale: "ko" | "en" = "ko") {
  return render(
    <NextIntlClientProvider locale={locale} messages={locale === "ko" ? ko : en}>
      <Harness problems={problems} />
    </NextIntlClientProvider>,
  );
}

const TEMPLATE_PROBLEM: WikiTemplateProblem = {
  code: "missing-field:title",
  message: "`title:` is missing. The page name a person reads.",
  detail: { key: "missing-field", values: { field: "title" } },
};

const LINK_PROBLEM: WikiTemplateProblem = {
  code: "dangling-wikilink",
  message: "`[[wiki/gone]]` names a page that is not in this folder.",
  line: 15,
  detail: { key: "dangling-wikilink", values: { target: "wiki/gone" } },
};

describe("WikiTemplateProblems — a folder finding is not an off-template verdict", () => {
  it("a page whose only finding is a link keeps the off-template heading off the screen", () => {
    renderPanel([LINK_PROBLEM]);
    expect(screen.queryByTestId("library-wiki-problems")).toBeNull();
    expect(screen.getByTestId("library-wiki-link-findings")).toBeInTheDocument();
    expect(screen.getByText(ko.library.wiki.linkFindingsTitle)).toBeInTheDocument();
    expect(screen.queryByText(ko.library.wiki.offTemplateTitle)).toBeNull();
  });

  it("a page whose only finding is its own shape keeps the link heading off the screen", () => {
    renderPanel([TEMPLATE_PROBLEM]);
    expect(screen.getByTestId("library-wiki-problems")).toBeInTheDocument();
    expect(screen.queryByTestId("library-wiki-link-findings")).toBeNull();
  });

  it("a page carrying both gets both headings, each over its own findings", () => {
    renderPanel([TEMPLATE_PROBLEM, LINK_PROBLEM]);
    const shape = screen.getByTestId("library-wiki-problems");
    const folder = screen.getByTestId("library-wiki-link-findings");
    expect(shape.textContent).toContain("missing-field:title");
    expect(shape.textContent).not.toContain("dangling-wikilink");
    expect(folder.textContent).toContain("dangling-wikilink");
    expect(folder.textContent).not.toContain("missing-field:title");
  });

  it("renders nothing at all when the page is clean", () => {
    const { container } = renderPanel([]);
    expect(container).toBeEmptyDOMElement();
  });
});

describe("WikiTemplateProblems — the sentence is in the reader's language", () => {
  it("retells a finding from its detail rather than shipping the validator's English", () => {
    renderPanel([LINK_PROBLEM]);
    const row = screen.getByTestId("library-wiki-problem");
    expect(row.textContent).toContain("이 폴더에 없습니다");
    expect(row.textContent).not.toContain("names a page that is not in this folder");
  });

  it("interpolates the value the finding carries, so the sentence names the link", () => {
    renderPanel([LINK_PROBLEM]);
    expect(screen.getByTestId("library-wiki-problem").textContent).toContain("[[wiki/gone]]");
  });

  it("keeps the machine code and its line beside the sentence, for the agent and the CLI", () => {
    renderPanel([LINK_PROBLEM]);
    expect(screen.getByTestId("library-wiki-problem").textContent).toContain(
      "dangling-wikilink:15",
    );
  });

  it("English reads the same finding from the same detail", () => {
    renderPanel([LINK_PROBLEM], "en");
    expect(screen.getByTestId("library-wiki-problem").textContent).toContain(
      "names a page that is not in this folder",
    );
  });

  /*
   * A finding the validator grows before this file learns about it must degrade to the
   * English sentence, never to a raw `library.wiki.problem.…` lookup path on screen.
   */
  it("falls back to the validator's message when the finding has no localised retelling", () => {
    renderPanel([
      { code: "future-code", message: "Something new the validator found.", detail: { key: "not-translated-yet" } },
    ]);
    const row = screen.getByTestId("library-wiki-problem");
    expect(row.textContent).toContain("Something new the validator found.");
    expect(row.textContent).not.toContain("wiki.problem");
  });

  it("falls back the same way when a finding carries no detail at all", () => {
    renderPanel([{ code: "legacy", message: "An older finding with no pieces." }]);
    expect(screen.getByTestId("library-wiki-problem").textContent).toContain(
      "An older finding with no pieces.",
    );
  });
});
