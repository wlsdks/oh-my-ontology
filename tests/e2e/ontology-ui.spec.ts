import { expect, test } from "@playwright/test";

/**
 * /ontology surface smoke (T-6 / T-9 / UX 정정).
 *
 * Static dogfood vault has ontology nodes, so verify the current local-first
 * browse surface rather than the removed knowledge/review queue surfaces.
 */
test.describe("ontology view UI", () => {
  test("desktop: landing CTA 로 ontology browse 진입 가능", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto("/en/");
    const demoLink = page.getByRole("link", { name: "See the demo first" });
    await expect(demoLink).toBeVisible();
    await demoLink.click();
    await expect(page).toHaveURL(/\/en\/ontology\/?$/);
  });

  test("desktop: ontology tree renders dogfood nodes", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto("/en/ontology/");

    await expect(page.getByRole("heading", { name: "Ontology tree" })).toBeVisible();
    await expect(page.locator('button[title="oh-my-ontology"]')).toBeVisible();
    await expect(page.locator('button[title="AI Agent Partner"]')).toBeVisible();
    await expect(page.getByRole("link", { name: "Browse" })).toHaveAttribute(
      "aria-current",
      "page",
    );
  });

  test("mobile: bottom tab ontology link is active", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/en/ontology/");

    const ontologyTab = page.getByRole("link", { name: "Ontology" }).last();
    await expect(ontologyTab).toBeVisible();
    await expect(ontologyTab).toHaveAttribute("aria-current", "page");
  });

  test("mobile: projects page exposes ontology shortcut", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/en/projects/");

    const ontologyCardCta = page.getByRole("link", {
      name: /Open ontology tree/,
    });
    await expect(ontologyCardCta).toBeVisible();
    await ontologyCardCta.click();
    await expect(page).toHaveURL(/\/en\/ontology\/?(\?|$)/);
  });

  test("desktop: 데이터가 없으면 detail 패널은 노출되지 않음 (빈 상태 회귀 방지)", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto("/en/ontology/");
    // 빈 상태에서는 트리에 row 가 없으므로 클릭할 게 없고, 패널도 처음부터 숨김.
    await expect(page.getByTestId("ontology-node-detail")).toHaveCount(0);
  });

  test("mobile: dogfood tree content is visible without horizontal overflow", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/en/ontology/");

    await expect(page.getByText("oh-my-ontology").first()).toBeVisible();
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
    );
    expect(overflow).toBe(false);
  });
});
