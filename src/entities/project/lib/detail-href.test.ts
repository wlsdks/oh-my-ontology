import { describe, expect, it } from "vitest";
import { getProjectDetailHref, getProjectDetailUrl } from "./detail-href";

describe("getProjectDetailHref", () => {
  it("/project/<encoded-slug>/ 형식", () => {
    expect(getProjectDetailHref("foo")).toBe("/project/foo/");
  });

  it("URL-unsafe 문자 → encodeURIComponent escape", () => {
    expect(getProjectDetailHref("a/b")).toBe("/project/a%2Fb/");
    expect(getProjectDetailHref("foo bar")).toBe("/project/foo%20bar/");
    expect(getProjectDetailHref("한글")).toBe(
      `/project/${encodeURIComponent("한글")}/`,
    );
  });

  it("빈 slug 도 그대로 (caller contract)", () => {
    expect(getProjectDetailHref("")).toBe("/project//");
  });
});

describe("getProjectDetailUrl", () => {
  it("origin + canonical path", () => {
    expect(getProjectDetailUrl("https://example.com", "foo")).toBe(
      "https://example.com/project/foo/",
    );
  });

  it("origin trailing slash 정규화 (URL constructor)", () => {
    expect(getProjectDetailUrl("https://example.com/", "foo")).toBe(
      "https://example.com/project/foo/",
    );
  });

  it("encodeURIComponent 가 path 에 적용", () => {
    expect(getProjectDetailUrl("https://example.com", "한글")).toBe(
      `https://example.com/project/${encodeURIComponent("한글")}/`,
    );
  });
});
