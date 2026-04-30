import { describe, expect, it } from "vitest";
import {
  getKnowledgeDocumentDetailHref,
  getKnowledgeDocumentListHref,
  getKnowledgeDocumentNewHref,
  getKnowledgeReviewWorkspaceHref,
} from "./detail-href";

describe("knowledge document href helpers", () => {
  it("builds the query-based detail route used by static export admin pages", () => {
    expect(getKnowledgeDocumentDetailHref("auth spec")).toBe(
      "/knowledge/documents/view/?id=auth%20spec",
    );
  });

  it("returns the knowledge document list and create routes", () => {
    expect(getKnowledgeDocumentListHref()).toBe("/knowledge/documents/");
    expect(getKnowledgeDocumentNewHref()).toBe("/knowledge/documents/new/");
  });

  it("preserves account query for scoped knowledge routes", () => {
    expect(getKnowledgeDocumentDetailHref("auth spec", "demo-workspace")).toBe(
      "/knowledge/documents/view/?id=auth+spec&account=demo-workspace",
    );
    expect(getKnowledgeDocumentListHref("demo-workspace")).toBe(
      "/knowledge/documents/?account=demo-workspace",
    );
    expect(getKnowledgeDocumentNewHref("demo-workspace")).toBe(
      "/knowledge/documents/new/?account=demo-workspace",
    );
  });

  it("appends ?pj for workspaceProject container context", () => {
    expect(
      getKnowledgeDocumentDetailHref("auth", "stark", {
        workspaceProjectId: "demo",
      }),
    ).toBe(
      "/knowledge/documents/view/?id=auth&account=stark&pj=demo",
    );
    expect(
      getKnowledgeDocumentListHref("stark", { workspaceProjectId: "demo" }),
    ).toBe("/knowledge/documents/?account=stark&pj=demo");
    expect(
      getKnowledgeReviewWorkspaceHref("doc-1", "stark", {
        workspaceProjectId: "demo",
      }),
    ).toBe("/review/knowledge/?id=doc-1&account=stark&pj=demo");
  });

  it("can append project and return context for round-trip flows", () => {
    expect(
      getKnowledgeDocumentListHref("demo-workspace", {
        projectId: "sandbox-core",
        returnTo: "/project/view/?slug=sandbox-core&account=demo-workspace",
      }),
    ).toBe(
      "/knowledge/documents/?project=sandbox-core&returnTo=%2Fproject%2Fview%2F%3Fslug%3Dsandbox-core%26account%3Ddemo-workspace&account=demo-workspace",
    );

    expect(
      getKnowledgeDocumentNewHref("demo-workspace", {
        projectId: "sandbox-core",
        returnTo: "/project/view/?slug=sandbox-core&account=demo-workspace",
        title: "샌드박스 코어 명세",
      }),
    ).toBe(
      "/knowledge/documents/new/?project=sandbox-core&returnTo=%2Fproject%2Fview%2F%3Fslug%3Dsandbox-core%26account%3Ddemo-workspace&title=%EC%83%8C%EB%93%9C%EB%B0%95%EC%8A%A4+%EC%BD%94%EC%96%B4+%EB%AA%85%EC%84%B8&account=demo-workspace",
    );

    expect(
      getKnowledgeReviewWorkspaceHref("doc-1", "demo-workspace", {
        projectId: "sandbox-core",
        returnTo: "/project/view/?slug=sandbox-core&account=demo-workspace",
      }),
    ).toBe(
      "/review/knowledge/?id=doc-1&project=sandbox-core&returnTo=%2Fproject%2Fview%2F%3Fslug%3Dsandbox-core%26account%3Ddemo-workspace&account=demo-workspace",
    );
  });
});
