import { describe, expect, it } from "vitest";
import { getDemoDataset } from "./demo-data";

/**
 * 데모 시드 sanity — 청사진이 의도된 풀-스케일로 펼쳐지는지 점검.
 */
describe("demo dataset sanity", () => {
  it("flat projects 200+ (데모 풀-스케일 기준)", () => {
    const total = getDemoDataset().projects.length;
    expect(total).toBeGreaterThanOrEqual(200);
  });

  it("hub 비율이 일정 수준 (최소 30 hubs)", () => {
    const hubs = getDemoDataset().projects.filter((p) => p.isHub);
    expect(hubs.length).toBeGreaterThanOrEqual(30);
  });

  it("cross-project 의존이 풍부 (총 dependencies 수 100+)", () => {
    const total = getDemoDataset().projects.reduce(
      (sum, p) => sum + p.dependencies.length,
      0,
    );
    expect(total).toBeGreaterThan(100);
  });
});
