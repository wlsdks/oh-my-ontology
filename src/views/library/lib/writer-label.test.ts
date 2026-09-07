import { describe, expect, it } from "vitest";

import { wikiStatusLabel, writerLabel } from "./writer-label";

const t = (key: string, values?: Record<string, string | number>) =>
  values ? `${key}:${Object.values(values).join(",")}` : key;

describe("writerLabel", () => {
  it("turns the contract forms into words and leaves the unknown as written", () => {
    expect(writerLabel("human", t)).toBe("wiki.writer.human");
    expect(writerLabel("agent:claude", t)).toBe("wiki.writer.agent:Claude");
    expect(writerLabel("agent:some-tool", t)).toBe("wiki.writer.agent:some-tool");
    expect(writerLabel("model:llama3.1", t)).toBe("wiki.writer.model:llama3.1");
    expect(writerLabel("team-b", t)).toBe("team-b");
    expect(writerLabel(null, t)).toBe("wiki.unknownAuthor");
  });
  it("names the two contract statuses and passes others through", () => {
    expect(wikiStatusLabel("draft", t)).toBe("wiki.status.draft");
    expect(wikiStatusLabel("reviewed", t)).toBe("wiki.status.reviewed");
    expect(wikiStatusLabel("archived", t)).toBe("archived");
    expect(wikiStatusLabel(null, t)).toBeNull();
  });
});

describe("a runtime id with a suffix still names the tool", () => {
  it("maps agent:claude-acp and agent:codex-acp to their tools", () => {
    const t = (key: string, values?: Record<string, string | number>) => `${key}:${values?.name ?? ""}`;
    expect(writerLabel("agent:claude-acp", t)).toBe("wiki.writer.agent:Claude");
    expect(writerLabel("agent:codex-acp", t)).toBe("wiki.writer.agent:Codex");
    expect(writerLabel("agent:other-tool", t)).toBe("wiki.writer.agent:other-tool");
  });
});
