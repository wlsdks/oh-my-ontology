import { describe, expect, it } from "vitest";
import { isBottomTabActive } from "./is-tab-active";

describe("isBottomTabActive", () => {
  it("home 탭 ('/') — / 에서 active", () => {
    expect(
      isBottomTabActive("/", "/", ["/ontology", "/topology"]),
    ).toBe(true);
  });

  it("home 탭 — /ontology / /topology sub-surface 에서도 active (라벨 일관성)", () => {
    expect(
      isBottomTabActive("/ontology", "/", ["/ontology", "/topology"]),
    ).toBe(true);
    expect(
      isBottomTabActive("/topology", "/", ["/ontology", "/topology"]),
    ).toBe(true);
    expect(
      isBottomTabActive("/topology/?p=foo", "/", ["/ontology", "/topology"]),
    ).toBe(true);
  });

  it("projects 탭 — /projects + /project 둘 다 startsWith", () => {
    expect(
      isBottomTabActive("/projects", "/projects/", ["/projects", "/project"]),
    ).toBe(true);
    expect(
      isBottomTabActive("/project/foo", "/projects/", ["/projects", "/project"]),
    ).toBe(true);
  });

  it("docs 탭 — /docs prefix", () => {
    expect(isBottomTabActive("/docs", "/docs/", ["/docs"])).toBe(true);
    expect(isBottomTabActive("/docs/?slug=x", "/docs/", ["/docs"])).toBe(true);
  });

  it("fallback exact-match — prefix 가 안 잡히면 href 정확 일치만", () => {
    // 가상의 prefix 빈 탭
    expect(isBottomTabActive("/projects/", "/projects/", [])).toBe(true);
    // trailing-slash 변형 호환
    expect(isBottomTabActive("/projects", "/projects/", [])).toBe(true);
    // 다른 path 는 false
    expect(isBottomTabActive("/docs", "/projects/", [])).toBe(false);
  });

  it("home 탭 ('/') — 다른 path 에서는 prefix 아니면 false", () => {
    // matchPrefixes 빈 가상의 home 탭
    expect(isBottomTabActive("/docs", "/", [])).toBe(false);
  });
});
