import { describe, expect, it } from "vitest";
import {
  summarizeVaultValidation,
  validateVaultDocFrontmatter,
  validateVaultDocument,
} from "./validate-vault-document";

describe("validateVaultDocument", () => {
  it("frontmatter 자체가 없는 docs 파일은 ok", () => {
    const r = validateVaultDocument("# Heading\n\n그냥 메모.");
    expect(r.ok).toBe(true);
    expect(r.issues).toHaveLength(0);
  });

  it("정상 frontmatter (canonical kind) 는 ok", () => {
    const raw = `---\nkind: project\nslug: foo\ntitle: Foo\n---\n# Foo`;
    const r = validateVaultDocument(raw);
    expect(r.ok).toBe(true);
    expect(r.issues).toHaveLength(0);
  });

  it("닫는 --- 가 없으면 unclosed-frontmatter error", () => {
    const raw = `---\nkind: project\nslug: foo\n# 어, 닫힘 빠짐`;
    const r = validateVaultDocument(raw);
    expect(r.ok).toBe(false);
    expect(r.issues).toHaveLength(1);
    expect(r.issues[0].code).toBe("unclosed-frontmatter");
    expect(r.issues[0].severity).toBe("error");
  });

  it("kind 값이 빈 문자열이면 empty-kind error", () => {
    const raw = `---\nkind:\nslug: foo\n---\n`;
    const r = validateVaultDocument(raw);
    expect(r.ok).toBe(false);
    expect(r.issues.map((i) => i.code)).toContain("empty-kind");
  });

  it("frontmatter 는 있는데 kind 자체가 없으면 missing-kind warning (ok)", () => {
    const raw = `---\nslug: foo\ntitle: Foo\n---\n`;
    const r = validateVaultDocument(raw);
    expect(r.ok).toBe(true);
    expect(r.issues.map((i) => i.code)).toContain("missing-kind");
    expect(r.issues[0].severity).toBe("warning");
  });

  it("canonical 외 kind 값은 unknown-kind warning (ok)", () => {
    const raw = `---\nkind: bogus\nslug: foo\n---\n`;
    const r = validateVaultDocument(raw);
    expect(r.ok).toBe(true);
    expect(r.issues.map((i) => i.code)).toContain("unknown-kind");
    expect(r.issues[0].message).toMatch(/bogus/);
  });

  it("frontmatter 블록은 있는데 key 가 0 추출되면 parse-zero-keys warning", () => {
    // 키 라인이 모두 leading-colon 등으로 무효
    const raw = `---\n: bad\n# comment\n---\n`;
    const r = validateVaultDocument(raw);
    expect(r.ok).toBe(true);
    expect(r.issues.map((i) => i.code)).toContain("parse-zero-keys");
  });

  it("trim 된 kind 가 canonical 이면 ok", () => {
    const raw = `---\nkind:    capability   \n---\n`;
    const r = validateVaultDocument(raw);
    expect(r.ok).toBe(true);
    expect(r.issues).toHaveLength(0);
  });

  it("6 종 모두 인식 (project / domain / capability / element / document / vault-readme)", () => {
    const kinds = [
      "project",
      "domain",
      "capability",
      "element",
      "document",
      "vault-readme",
    ];
    for (const k of kinds) {
      const r = validateVaultDocument(`---\nkind: ${k}\n---\n`);
      expect(r.ok, `kind=${k}`).toBe(true);
      expect(r.issues, `kind=${k}`).toHaveLength(0);
    }
  });

  it("error 와 warning 이 동시에 있으면 ok=false (error 우선)", () => {
    // unclosed → 즉시 return 이라 동시 케이스를 다른 형태로 만든다:
    // empty-kind (error) 만 있는 케이스가 ok=false 인지만 확인.
    const raw = `---\nkind:\n---\n`;
    const r = validateVaultDocument(raw);
    expect(r.ok).toBe(false);
    expect(r.issues.some((i) => i.severity === "error")).toBe(true);
  });
});

describe("validateVaultDocFrontmatter (parsed-only fast path)", () => {
  it("빈 frontmatter — ontology 시그널 0 — 정상 (docs-only)", () => {
    const r = validateVaultDocFrontmatter({});
    expect(r.ok).toBe(true);
    expect(r.issues).toHaveLength(0);
  });

  it("title 만 있는 frontmatter — ontology 시그널 0 — 정상 (docs-only)", () => {
    const r = validateVaultDocFrontmatter({
      title: "Just a doc",
      tags: ["foo"],
    });
    expect(r.ok).toBe(true);
    expect(r.issues).toHaveLength(0);
  });

  it("ontology 시그널 (capabilities) 있는데 kind 없으면 missing-kind warning", () => {
    const r = validateVaultDocFrontmatter({
      title: "X",
      capabilities: ["foo"],
    });
    expect(r.ok).toBe(true);
    expect(r.issues.map((i) => i.code)).toContain("missing-kind");
  });

  it("kind 가 빈 문자열이면 empty-kind error", () => {
    const r = validateVaultDocFrontmatter({ kind: "", title: "X" });
    expect(r.ok).toBe(false);
    expect(r.issues.map((i) => i.code)).toContain("empty-kind");
  });

  it("canonical kind 는 ok", () => {
    const r = validateVaultDocFrontmatter({ kind: "capability", title: "X" });
    expect(r.ok).toBe(true);
    expect(r.issues).toHaveLength(0);
  });

  it("non-canonical kind 는 unknown-kind warning", () => {
    const r = validateVaultDocFrontmatter({ kind: "weird", title: "X" });
    expect(r.ok).toBe(true);
    expect(r.issues.map((i) => i.code)).toContain("unknown-kind");
  });
});

describe("summarizeVaultValidation", () => {
  it("clean docs — ok / counts 0", () => {
    const summary = summarizeVaultValidation([
      { slug: "a", frontmatter: { kind: "project", title: "A" } },
      { slug: "b", frontmatter: {} }, // docs-only
    ]);
    expect(summary.ok).toBe(true);
    expect(summary.total).toBe(0);
    expect(summary.errorCount).toBe(0);
    expect(summary.warningCount).toBe(0);
    expect(summary.issuesBySlug).toHaveLength(0);
  });

  it("warning 만 있으면 ok=true, errorCount=0, warningCount > 0", () => {
    const summary = summarizeVaultValidation([
      { slug: "a", frontmatter: { kind: "weird" } },
      { slug: "b", frontmatter: { capabilities: ["x"] } },
    ]);
    expect(summary.ok).toBe(true);
    expect(summary.errorCount).toBe(0);
    expect(summary.warningCount).toBe(2);
    expect(summary.issuesBySlug).toHaveLength(2);
  });

  it("error 가 하나라도 있으면 ok=false", () => {
    const summary = summarizeVaultValidation([
      { slug: "a", frontmatter: { kind: "" } },
      { slug: "b", frontmatter: { kind: "project", title: "OK" } },
    ]);
    expect(summary.ok).toBe(false);
    expect(summary.errorCount).toBe(1);
  });

  it("issuesBySlug 가 slug 별로 묶여서 반환", () => {
    const summary = summarizeVaultValidation([
      { slug: "a", frontmatter: { kind: "weird" } },
    ]);
    expect(summary.issuesBySlug).toEqual([
      {
        slug: "a",
        issues: expect.arrayContaining([
          expect.objectContaining({ code: "unknown-kind" }),
        ]),
      },
    ]);
  });
});
