import { expect, test } from "@playwright/test";
import { seedFirstRunSeen } from "./first-run-seed";

/**
 * **Growth replay** (2026-09-02, `model/growth-replay.ts`; toggle semantics 2026-09-07).
 *
 * Pixels cannot tell "appearing in order" from "already there", so this spec
 * reads the idle gate's own activity names through `?e2e=1`: while the replay
 * runs, `growthReplaying` is what keeps the frame awake, and once it ends the
 * name is gone.
 *
 * The rule it holds: **the control is a toggle, not a hold.** The owner's report
 * (2026-09-07) was that moving or scrolling the mouse killed a replay they had
 * just asked for — *"nobody keeps the mouse still after pressing a button"*. So
 * pointer movement and wheel-zoom must leave it running, the tile must wear the
 * active state (`aria-pressed`) while it does, and a second press must stop it.
 */
async function lastActiveCauses(page: import("@playwright/test").Page): Promise<string[]> {
  return page.evaluate(() => {
    const m = (window as unknown as { __atlasMap?: { idleDebug: () => { lastActive: { causes: string[] } | null } } }).__atlasMap;
    return m?.idleDebug().lastActive?.causes ?? [];
  });
}

test("the play tile toggles the replay, survives pointer input, and stops on a second press", async ({ page }) => {
  test.setTimeout(120_000);
  await page.setViewportSize({ width: 1400, height: 860 });
  await seedFirstRunSeen(page);
  await page.goto("/ko/topology/?e2e=1&guides=off", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(2500);

  const tile = page.locator('[data-testid="topology-replay-growth"]');
  await expect(tile).toBeVisible();
  await expect(tile, "쉬는 동안에는 눌린 상태가 아니다").toHaveAttribute("aria-pressed", "false");

  await tile.click();
  await page.waitForTimeout(1200);
  expect(await lastActiveCauses(page), "재생 중에는 유휴 게이트가 재생을 이름으로 부른다").toContain("growthReplaying");
  await expect(tile, "재생 중에는 컨트롤이 눌린 상태다").toHaveAttribute("aria-pressed", "true");

  // Moving and wheel-zooming must NOT end it — this is the whole point of the toggle.
  const canvas = page.locator('[data-testid="topology-map-v2-canvas"]');
  const box = (await canvas.boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.move(box.x + box.width / 2 + 40, box.y + box.height / 2 + 30);
  await page.mouse.wheel(0, -120);
  await page.waitForTimeout(700);
  expect(await lastActiveCauses(page), "마우스를 움직이고 휠을 굴려도 재생은 계속된다").toContain("growthReplaying");
  await expect(tile, "움직였다고 눌린 상태가 풀리지 않는다").toHaveAttribute("aria-pressed", "true");

  // A second press stops it, and the control returns to rest.
  await tile.click();
  await page.waitForTimeout(600);
  expect(await lastActiveCauses(page), "두 번째 누름으로 재생이 끝난다").not.toContain("growthReplaying");
  await expect(tile, "멈추면 컨트롤도 쉰다").toHaveAttribute("aria-pressed", "false");
});

test("Escape and a press on the canvas each end a running replay", async ({ page }) => {
  test.setTimeout(120_000);
  await page.setViewportSize({ width: 1400, height: 860 });
  await seedFirstRunSeen(page);
  await page.goto("/ko/topology/?e2e=1&guides=off", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(2500);

  const tile = page.locator('[data-testid="topology-replay-growth"]');
  await tile.click();
  await page.waitForTimeout(1000);
  expect(await lastActiveCauses(page)).toContain("growthReplaying");
  await page.keyboard.press("Escape");
  await page.waitForTimeout(600);
  expect(await lastActiveCauses(page), "Esc 로 재생이 끝난다").not.toContain("growthReplaying");
  await expect(tile).toHaveAttribute("aria-pressed", "false");

  // A press on the canvas is a deliberate "look at this instead" — including on
  // empty ground, which no selection callback would have reported.
  await tile.click();
  await page.waitForTimeout(1000);
  expect(await lastActiveCauses(page)).toContain("growthReplaying");
  const canvas = page.locator('[data-testid="topology-map-v2-canvas"]');
  const box = (await canvas.boundingBox())!;
  await page.mouse.click(box.x + box.width - 60, box.y + box.height - 60);
  await page.waitForTimeout(600);
  expect(await lastActiveCauses(page), "캔버스를 누르면 재생이 끝난다").not.toContain("growthReplaying");
  await expect(tile).toHaveAttribute("aria-pressed", "false");
});
