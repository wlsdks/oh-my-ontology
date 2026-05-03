import { describe, expect, it } from "vitest";
import { buildOntologyNodeHref } from "./ontology-node-href";

describe("buildOntologyNodeHref", () => {
  it("kind:slug 형식 노드 ID", () => {
    expect(buildOntologyNodeHref("domain:ontology-core")).toBe(
      `/ontology/?node=${encodeURIComponent("domain:ontology-core")}`,
    );
    expect(buildOntologyNodeHref("project:reactor")).toBe(
      `/ontology/?node=${encodeURIComponent("project:reactor")}`,
    );
  });

  it("특수 문자 / 한글 encodeURIComponent escape", () => {
    expect(buildOntologyNodeHref("project:한글")).toBe(
      `/ontology/?node=${encodeURIComponent("project:한글")}`,
    );
    expect(buildOntologyNodeHref("a/b:c d")).toBe(
      `/ontology/?node=${encodeURIComponent("a/b:c d")}`,
    );
  });

  it("빈 ID 도 그대로 반환 (caller contract)", () => {
    expect(buildOntologyNodeHref("")).toBe("/ontology/?node=");
  });
});
