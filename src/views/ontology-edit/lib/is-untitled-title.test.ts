import { describe, expect, it } from "vitest";
import { isUntitledTitle } from "./is-untitled-title";

const EN_PLACEHOLDER = "(enter a name)";
const KO_PLACEHOLDER = "(이름 입력)";

describe("isUntitledTitle", () => {
  it("빈 문자열은 untitled", () => {
    expect(isUntitledTitle("", EN_PLACEHOLDER)).toBe(true);
  });

  it("공백만 있는 문자열은 untitled", () => {
    expect(isUntitledTitle("   ", EN_PLACEHOLDER)).toBe(true);
  });

  it("title 이 placeholder 와 정확히 같으면 untitled", () => {
    expect(isUntitledTitle(EN_PLACEHOLDER, EN_PLACEHOLDER)).toBe(true);
    expect(isUntitledTitle(KO_PLACEHOLDER, KO_PLACEHOLDER)).toBe(true);
  });

  it("placeholder 양쪽 trim 후 비교", () => {
    expect(isUntitledTitle("  (enter a name)  ", EN_PLACEHOLDER)).toBe(true);
  });

  it("실제 사용자 입력은 untitled 아님", () => {
    expect(isUntitledTitle("Auth Platform", EN_PLACEHOLDER)).toBe(false);
    expect(isUntitledTitle("프로젝트 X", KO_PLACEHOLDER)).toBe(false);
  });

  it("placeholder substring 만 포함된 입력은 untitled 아님", () => {
    expect(isUntitledTitle("(enter a name) — TODO", EN_PLACEHOLDER)).toBe(
      false,
    );
    expect(isUntitledTitle("Backup of (enter a name)", EN_PLACEHOLDER)).toBe(
      false,
    );
  });

  it("locale 바뀌어 placeholder 가 다르면 옛 placeholder 는 통과 (사용자 의도 가정)", () => {
    // 사용자가 ko 로 노드 추가 ("(이름 입력)") 후 en 으로 전환했을 때
    // 영어 placeholder ("(enter a name)") 와는 다르므로 통과.
    expect(isUntitledTitle(KO_PLACEHOLDER, EN_PLACEHOLDER)).toBe(false);
  });

  it("placeholder 자체가 빈 문자열이면 모든 비-empty 입력은 통과", () => {
    expect(isUntitledTitle("anything", "")).toBe(false);
    // 빈 입력은 placeholder 무관하게 untitled.
    expect(isUntitledTitle("", "")).toBe(true);
  });
});
