import { describe, expect, it } from "vitest";
import type { VaultDoc } from "../model/types";
import { buildTopologyDeeplinkForDoc } from "./topology-deeplink";

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

describe("buildTopologyDeeplinkForDoc", () => {
  it("kind 가 'project' 가 아니면 null", () => {
    expect(
      buildTopologyDeeplinkForDoc(
        makeDoc({ slug: "domains/x", frontmatter: { kind: "domain" } }),
      ),
    ).toBeNull();
    expect(buildTopologyDeeplinkForDoc(makeDoc({ slug: "y" }))).toBeNull();
  });

  it("projects/ prefix 는 제거하고 ?p= 로 직링크", () => {
    expect(
      buildTopologyDeeplinkForDoc(
        makeDoc({
          slug: "projects/my-app",
          frontmatter: { kind: "project" },
        }),
      ),
    ).toBe(`/topology/?p=${encodeURIComponent("my-app")}`);
  });

  it("fm.slug 가 있으면 우선", () => {
    expect(
      buildTopologyDeeplinkForDoc(
        makeDoc({
          slug: "projects/my-app",
          frontmatter: { kind: "project", slug: "custom-slug" },
        }),
      ),
    ).toBe(`/topology/?p=${encodeURIComponent("custom-slug")}`);
  });

  it("vault 루트 doc (예: ontology/project) 은 마지막 segment", () => {
    expect(
      buildTopologyDeeplinkForDoc(
        makeDoc({
          slug: "ontology/project",
          frontmatter: { kind: "project" },
        }),
      ),
    ).toBe(`/topology/?p=${encodeURIComponent("project")}`);
  });
});
