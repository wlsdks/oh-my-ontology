import { describe, expect, it } from "vitest";

import { buildAskBrief } from "./ask-brief";

describe("buildAskBrief", () => {
  const base = { selection: "  The budget  becomes 221,400. ", pageSlug: "wiki/change-request", vaultRoot: "/v/atlas", locale: "en" as const };

  it("carries the passage, the page, the chosen question, and the read-only rule", () => {
    const brief = buildAskBrief({ ...base, question: "evidence" });
    expect(brief).toContain("> The budget becomes 221,400.");
    expect(brief).toContain("Page being read: wiki/change-request.md");
    expect(brief).toContain("Where does this come from?");
    expect(brief).toContain("Write nothing.");
    // The answer can be filed as a page, so the brief names the one citation form that counts.
    expect(brief).toContain("`[[src:sources/<file>#p<page>]]`");
  });

  it("uses the person's own words for a custom question, in the screen's language", () => {
    const brief = buildAskBrief({ ...base, locale: "ko", question: "custom", customQuestion: "이 숫자 맞아?" });
    expect(brief).toContain("질문: 이 숫자 맞아?");
    expect(brief).toContain("아무것도 쓰지 마.");
    expect(brief).toContain("`[[src:sources/<파일>#p<쪽>]]`");
  });
});
