import { expect, test } from "@playwright/test";

import { openLibraryWorkScenario } from "./library-work-harness";

test.describe("Library live work activity", () => {
  test("visualizes a real ACP read, permission wait, and observed file revision", async ({ page }) => {
    const consoleErrors: string[] = [];
    page.on("console", (message) => {
      if (message.type() === "error") consoleErrors.push(message.text());
    });
    const harness = await openLibraryWorkScenario(page);

    await harness.read(page);
    await expect(page.getByTestId("acp-chat-tool-target")).toContainText("sources/architecture.docx");
    await expect(page.getByTestId("library-work-current")).toHaveAttribute("data-work-kind", "read");

    // A document stands the mounted graph aside; active work cannot paint a hidden canvas.
    await page.evaluate(() => {
      (window as any).__libraryPaintCount = 0;
      const fill = CanvasRenderingContext2D.prototype.fillRect;
      CanvasRenderingContext2D.prototype.fillRect = function (...args) {
        if (this.canvas.dataset.testid === "library-graph-canvas") (window as any).__libraryPaintCount += 1;
        return fill.apply(this, args);
      };
    });
    await expect.poll(() => page.evaluate(() => (window as any).__libraryPaintCount)).toBeGreaterThan(5);
    await page.getByTestId("library-graph-canvas").press("ArrowRight");
    await page.getByTestId("library-graph-canvas").press("Enter");
    await expect(page.getByTestId("library-graph-canvas")).not.toBeVisible();
    const hiddenPaints = await page.evaluate(() => (window as any).__libraryPaintCount);
    await page.waitForTimeout(500);
    expect(await page.evaluate(() => (window as any).__libraryPaintCount)).toBe(hiddenPaints);
    await page.getByTestId("library-reader-back").click();
    await expect.poll(() => page.evaluate(() => (window as any).__libraryPaintCount)).toBeGreaterThan(hiddenPaints);

    await harness.wait(page);
    await expect(page.getByTestId("acp-permission-card")).toBeVisible();
    await expect(page.getByTestId("library-work-current")).toHaveAttribute("data-work-kind", "waiting");
    await expect(page.getByTestId("library-work-current")).toHaveAttribute("data-work-phase", "active");

    await page.getByTestId("acp-permission-allow").click();
    await harness.write(page);
    await expect.poll(async () => (await harness.snapshot(page)).writes.some((write) => write.relativePath === "wiki/architecture.md")).toBe(true);
    await expect(page.getByTestId("library-work-recent")).toContainText("File changed");
    await expect(page.getByTestId("library-work-current")).toHaveAttribute("data-work-kind", "write");
    await expect(page.getByTestId("library-work-current")).toHaveAttribute("data-work-phase", "complete");
    await harness.finish(page);
    await expect(page.getByTestId("acp-chat-panel")).toHaveAttribute("data-acp-status", "ready");
    await page.getByRole("button", { name: "Close conversation" }).click();
    await page.getByRole("button", { name: "File changed · wiki/architecture", exact: true }).focus();
    await expect(page.getByRole("button", { name: "File changed · wiki/architecture", exact: true })).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(page.getByTestId("library-reader-back")).toBeVisible();
    expect(consoleErrors, consoleErrors.join("\n")).toEqual([]);
  });

  test("rejected unknown target never becomes a saved-file receipt", async ({ page }) => {
    const harness = await openLibraryWorkScenario(page, { scenario: "failed-unknown-target" });
    await harness.read(page);
    await harness.wait(page);
    await expect(page.getByTestId("acp-permission-card")).toBeVisible();
    await expect(page.getByTestId("library-work-current")).toHaveAttribute("data-work-kind", "waiting");

    await page.getByTestId("acp-permission-reject").click();
    await expect.poll(async () => (await harness.snapshot(page)).writes.length).toBe(0);
    await harness.finish(page);
    await expect(page.getByTestId("library-work-recent")).not.toContainText("File changed");
    await expect(page.getByTestId("library-work-current")).toHaveAttribute("data-work-kind", "error");
    await expect(page.getByTestId("library-work-current")).toHaveAttribute("data-work-phase", "complete");
  });
});

test.describe("Library work receipts on touch", () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
  test("keeps changed-file receipts reachable without the conversation", async ({ page }) => {
    const harness = await openLibraryWorkScenario(page);
    await harness.read(page);
    await harness.wait(page);
    await page.getByTestId("acp-permission-allow").click();
    await harness.write(page);
    await expect(page.getByTestId("library-work-recent")).toContainText("File changed");
    await harness.finish(page);
    await page.getByRole("button", { name: "Close conversation" }).click();
    const receipt = page.getByRole("button", { name: "File changed · wiki/architecture", exact: true });
    await expect(receipt).toBeVisible();
    const box = await receipt.boundingBox();
    expect(box!.height).toBeGreaterThanOrEqual(44);
    expect(box!.width).toBeGreaterThanOrEqual(44);
    expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBe(0);
    await receipt.tap();
    await expect(page.getByTestId("library-reader-back")).toBeVisible();
  });
});
