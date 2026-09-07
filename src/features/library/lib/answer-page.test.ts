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
    expect(page.problems).toEqual([]);
  });

  it("reports the contract problems of an answer with no citation instead of writing a claim", () => {
    const page = buildAnswerPage({
      question: "What is the budget?",
      answer: "The budget is 221,400.",
      askedOn: null,
      writer: "agent:claude-code",
      now: NOW,
      hashes: new Map(),
      knownSources: [],
    });
    expect(page.problems.length).toBeGreaterThan(0);
  });

  it("makes a stable slug from the question's first words and the day", () => {
    expect(answerSlug("Is this figure final?!", NOW)).toBe("wiki/answers/2026-09-07-is-this-figure-final");
    expect(answerSlug("이 숫자 맞아?", NOW)).toBe("wiki/answers/2026-09-07-이-숫자-맞아");
  });
});
