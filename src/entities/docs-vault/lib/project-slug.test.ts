import { describe, expect, it } from "vitest";
import type { VaultDoc } from "../model/types";
import { computeProjectSlug } from "./project-slug";

function makeDoc(partial: Partial<VaultDoc>): VaultDoc {
  return {
    slug: partial.slug ?? "x",
    path: partial.path ?? `${partial.slug ?? "x"}.md`,
    title: partial.title ?? "",
    description: partial.description,
    tags: partial.tags ?? [],
    frontmatter: partial.frontmatter ?? {},
    headings: partial.headings ?? [],
    excerpt: partial.excerpt ?? "",
    wordCount: partial.wordCount ?? 0,
    updatedAt: partial.updatedAt ?? new Date(0).toISOString(),
    linksOut: partial.linksOut ?? [],
  };
}

describe("computeProjectSlug", () => {
  it("projects/ prefix 는 제거", () => {
    expect(computeProjectSlug(makeDoc({ slug: "projects/foo" }))).toBe("foo");
  });

  it("vault 루트 (projects/ 없는 경로) 는 마지막 segment", () => {
    expect(
      computeProjectSlug(makeDoc({ slug: "ontology/project" })),
    ).toBe("project");
  });

  it("slug 한 segment 인 경우 그대로", () => {
    expect(computeProjectSlug(makeDoc({ slug: "bar" }))).toBe("bar");
  });

  it("fm.slug 가 우선 — 앞뒤 공백 제거", () => {
    expect(
      computeProjectSlug(
        makeDoc({
          slug: "projects/foo",
          frontmatter: { slug: "  custom-slug  " },
        }),
      ),
    ).toBe("custom-slug");
  });

  it("fm.slug 가 빈 문자열 / 공백 only 면 무시 → fileSlug fallback", () => {
    expect(
      computeProjectSlug(
        makeDoc({ slug: "projects/foo", frontmatter: { slug: "   " } }),
      ),
    ).toBe("foo");
  });

  it("fm.slug 가 string 이 아니면 무시 (예: 숫자)", () => {
    expect(
      computeProjectSlug(
        makeDoc({ slug: "projects/foo", frontmatter: { slug: 42 } }),
      ),
    ).toBe("foo");
  });
});
