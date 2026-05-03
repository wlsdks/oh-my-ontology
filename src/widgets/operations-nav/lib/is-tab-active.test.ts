import { describe, expect, it } from "vitest";
import { isOperationsTabActive } from "./is-tab-active";

describe("isOperationsTabActive", () => {
  it("'/' prefix 는 exact-match — 모든 path 에 false-positive 회피", () => {
    expect(isOperationsTabActive("/", ["/"])).toBe(true);
    // '/' prefix 가 startsWith 였다면 아래 모두 true 가 되어 사고.
    expect(isOperationsTabActive("/topology", ["/"])).toBe(false);
    expect(isOperationsTabActive("/docs", ["/"])).toBe(false);
    expect(isOperationsTabActive("/ontology", ["/"])).toBe(false);
  });

  it("non-'/' prefix 는 startsWith — sub-path 까지 활성", () => {
    expect(isOperationsTabActive("/ontology", ["/ontology"])).toBe(true);
    expect(isOperationsTabActive("/ontology/edit", ["/ontology"])).toBe(true);
    expect(isOperationsTabActive("/ontology/edit/foo", ["/ontology"])).toBe(true);
    expect(isOperationsTabActive("/topology", ["/ontology"])).toBe(false);
  });

  it("ontology 탭의 dual-surface — '/' + '/ontology' 둘 다 매칭", () => {
    const ontologyPrefixes = ["/", "/ontology"];
    expect(isOperationsTabActive("/", ontologyPrefixes)).toBe(true);
    expect(isOperationsTabActive("/ontology", ontologyPrefixes)).toBe(true);
    expect(isOperationsTabActive("/ontology/edit", ontologyPrefixes)).toBe(true);
    expect(isOperationsTabActive("/topology", ontologyPrefixes)).toBe(false);
    expect(isOperationsTabActive("/docs", ontologyPrefixes)).toBe(false);
  });

  it("빈 prefixes → 항상 false (안전)", () => {
    expect(isOperationsTabActive("/", [])).toBe(false);
    expect(isOperationsTabActive("/anything", [])).toBe(false);
  });
});
