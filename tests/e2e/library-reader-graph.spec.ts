import { expect, test } from "@playwright/test";

import { seedFirstRunSeen } from "./first-run-seed";
import { installLibraryWorkHarness } from "./library-work-harness";

const LONG_PAGE = [
  "---", "title: Workshop notes", "created_by: human", "sources: []", "status: draft", "---", "",
  "## Summary", "", "A long document keeps a real reading position while inspecting connections.", "",
  ...Array.from({ length: 45 }, (_, i) => `Paragraph ${i + 1}. The workshop has a question, supporting evidence, and a decision still to review.\n`),
  "## Facts", "", "## Decisions", "", "## Open questions", "", "## Not in sources", "",
].join("\n");

test("the graph returns to the same reading position and opener, including immediate reopen", async ({ page }) => {
  await seedFirstRunSeen(page);
  await installLibraryWorkHarness(page, { files: {
    "wiki/workshop.md": LONG_PAGE,
    "sources/notes.txt": "Workshop source notes.\n",
  } });
  await page.goto("/en/docs/");
  await page.getByRole("button", { name: /Open my folder/i }).click();
  await expect(page.getByTestId("library-page")).toBeVisible();
  await page.getByTestId("library-index-segment-wiki").click();
  const selectedRow = page.getByTestId("library-wiki-wiki/workshop");
  await selectedRow.click();
  await expect(selectedRow).toHaveAttribute("aria-current", "true");
  // A border colour alone does not draw a selected edge on the row primitive.
  await expect.poll(() => selectedRow.evaluate((el) => parseFloat(getComputedStyle(el).borderLeftWidth))).toBeGreaterThan(0);
  const reader = page.getByTestId("library-reading-pane");
  await expect(reader).toBeVisible();
  const scroller = reader.locator(".overflow-auto");
  await scroller.hover();
  await page.mouse.wheel(0, 700);
  await expect.poll(() => scroller.evaluate((el) => el.scrollTop)).toBeGreaterThan(300);
  // Wait for the browser's wheel momentum to settle before keeping the actual position.
  await expect.poll(async () => {
    const first = await scroller.evaluate((el) => el.scrollTop);
    await page.waitForTimeout(100);
    return Math.abs(await scroller.evaluate((el) => el.scrollTop) - first);
  }).toBeLessThan(1);
  const position = await scroller.evaluate((el) => el.scrollTop);
  const opener = page.getByTestId("library-graph-open");
  await expect(opener).toHaveCount(1);
  await opener.click();
  const dialog = page.getByTestId("library-graph-dialog");
  await expect(dialog).toBeVisible();
  await expect(dialog.getByTestId("library-graph-canvas")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
  await expect(opener).toBeFocused();
  await expect(reader).toBeVisible();
  expect(await scroller.evaluate((el) => el.scrollTop)).toBe(position);
  await expect(page.getByTestId("library-graph-canvas")).toHaveCount(0);

  await page.keyboard.press("Enter");
  await expect(dialog).toBeVisible();
  await dialog.getByRole("button", { name: "Close", exact: true }).click();
  await opener.click();
  await expect(dialog).toBeVisible();
  await expect.poll(() => dialog.evaluate((el) => el.contains(document.activeElement))).toBe(true);
  await page.keyboard.press("Escape");
  await expect(opener).toBeFocused();
  expect(await scroller.evaluate((el) => el.scrollTop)).toBe(position);
});
