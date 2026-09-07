import { describe, expect, it } from "vitest";

import { answerSlug, buildAnswerPage } from "./answer-page";

const NOW = new Date("2026-09-07T03:00:00Z");

describe("buildAnswerPage files an answer back as a wiki page", () => {
  it("turns cited lines into facts, cited files into sources with hashes, and the rest into Not in sources", () => {
    const page = buildAnswerPage({
      question: "Why was the reopening moved?",
      answer: [
        "The change request moved the reopening to 2027-05-15 [[src:sources/change-request.docx#p1]].",
        "Retaining the sashes adds eleven weeks [[src:sources/site-survey.pdf#p2]] [[src:sources/change-request.docx#p1]].",
        "I could not find who signed the survey.",
      ].join("\n"),
      askedOn: "wiki/change-request",
      writer: "agent:claude-code",
      now: NOW,
      hashes: new Map([["sources/change-request.docx", "a".repeat(64)], ["sources/site-survey.pdf", "b".repeat(64)]]),
      knownSources: ["sources/change-request.docx", "sources/site-survey.pdf"],
    });
    expect(page.slug).toBe("wiki/answers/2026-09-07-why-was-the-reopening-moved");
    expect(page.text).toContain("sources:\n  - sources/change-request.docx\n  - sources/site-survey.pdf");
    expect(page.text).toContain(`sources/site-survey.pdf: ${"b".repeat(64)}`);
    expect(page.text).toContain("## Facts\n\n- The change request moved");
    expect(page.text).toContain("## Not in sources\n\n- I could not find who signed the survey.");
    expect(page.text).toContain("Asked while reading [[wiki/change-request]].");
  });

  it("points at the pages that already write up a cited source, so the folder check has nothing to raise", () => {
    const page = buildAnswerPage({
      question: "Why was the reopening moved?",
      answer: "Retaining the sashes adds eleven weeks [[src:sources/site-survey.pdf#p2]] [[src:sources/change-request.docx#p1]].",
      askedOn: "wiki/change-request",
      writer: "agent:claude-code",
      now: NOW,
      hashes: new Map(),
      knownSources: ["sources/change-request.docx", "sources/site-survey.pdf"],
      pagesForSource: (path) =>
        path === "sources/site-survey.pdf" ? ["wiki/site-survey", "wiki/change-request"] : ["wiki/change-request"],
    });
    expect(page.problems).toEqual([]);
    expect(page.text).toContain("Asked while reading [[wiki/change-request]]. See also [[wiki/site-survey]].");
    expect(page.problems).toEqual([]);
  });

  it("reads a citation written loosely, bare or in backticks, and files it in the wiki form", () => {
    const page = buildAnswerPage({
      question: "Where does this come from?",
      answer: [
        "The five facts all point at one place, `sources/change-request-CR3.docx#p1`, and the summary draws on it.",
        "The approval date is in the header: src:sources/change-request-CR3.docx#p1.",
        "A row of the quote table: [[sources/contractor-quotes.csv#r3]].",
      ].join("\n"),
      askedOn: "wiki/change-request-CR3",
      writer: "agent:claude-code",
      now: NOW,
      hashes: new Map([["sources/change-request-CR3.docx", "c".repeat(64)]]),
      knownSources: ["sources/change-request-CR3.docx", "sources/contractor-quotes.csv"],
    });
    expect(page.problems).toEqual([]);
    expect(page.text).toContain("one place, [[src:sources/change-request-CR3.docx#p1]], and the summary");
    expect(page.text).toContain("in the header: [[src:sources/change-request-CR3.docx#p1]].");
    expect(page.text).toContain("quote table: [[src:sources/contractor-quotes.csv#r3]].");
    expect(page.text).toContain("sources:\n  - sources/change-request-CR3.docx\n  - sources/contractor-quotes.csv");
    expect(page.text).toContain("sources/contractor-quotes.csv: unmeasured");
  });

  it("refuses an answer with no citation by name instead of planting a bullet the validator would reject", () => {
    const page = buildAnswerPage({
      question: "What is the budget?",
      answer: "The budget is 221,400.",
      askedOn: null,
      writer: "agent:claude-code",
      now: NOW,
      hashes: new Map(),
      knownSources: [],
    });
    expect(page.problems[0]?.code).toBe("no-cited-fact");
    expect(page.text).toContain("## Facts\n\n## Decisions");
    expect(page.text).toContain("## Not in sources\n\n- The budget is 221,400.");
  });

  it("makes a stable slug from the question's first words and the day", () => {
    expect(answerSlug("Is this figure final?!", NOW)).toBe("wiki/answers/2026-09-07-is-this-figure-final");
    expect(answerSlug("이 숫자 맞아?", NOW)).toBe("wiki/answers/2026-09-07-이-숫자-맞아");
  });
});
