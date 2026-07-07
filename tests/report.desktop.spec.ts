import { test, expect } from "@playwright/test";

test.describe("Desktop tap-to-report", () => {
  test.use({ viewport: { width: 1366, height: 900 } });

  test("click to pin → sheet opens right", async ({ page }) => {
    await page.goto("/map");
    await page.getByRole("button", { name: "Report" }).click();
    await expect(page.getByText(/Click the map to set the incident location/i)).toBeVisible();

    const map = page.locator("#map");
    const b = await map.boundingBox();
    if (!b) throw new Error("map bounding box not found");
    await page.mouse.click(b.x + b.width / 2, b.y + b.height / 2);

    await expect(page.getByText(/Location set:/i)).toBeVisible();
    // Sheet is right-sided: has translate-x on desktop container or an attribute/class
    await expect(page.locator('[data-side="right"]')).toBeVisible();
  });

  test("Esc cancels", async ({ page }) => {
    await page.goto("/map");
    await page.getByRole("button", { name: "Report" }).click();
    await expect(page.getByText(/Click the map/i)).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.getByText(/Click the map/i)).toBeHidden();
    await expect(page.getByRole("button", { name: "Report" })).toBeFocused();
  });

  test("mobile regression", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/map");
    await page.getByRole("button", { name: "Report" }).click();
    await expect(page.getByRole("button", { name: /Use my current location/i })).toBeVisible();
    await expect(page.getByText(/Click the map/i)).toHaveCount(0);
  });

  test("Drop a pin closes sheet and re-enters report mode", async ({ page }) => {
    await page.goto("/map");
    await page.getByRole("button", { name: "Report" }).click();

    // first pin
    const map = page.locator("#map");
    const b = await map.boundingBox();
    if (!b) throw new Error("map not found");
    await page.mouse.click(b.x + b.width / 2, b.y + b.height / 2);
    await expect(page.getByText(/Location set:/i)).toBeVisible();

    // re-enter pin mode
    await page.getByRole("button", { name: /^Drop a pin$/i }).click();
    await expect(page.getByText(/Click the map to set the incident location/i)).toBeVisible();

    // second pin
    await page.mouse.click(b.x + b.width / 2 + 60, b.y + b.height / 2 + 60);
    await expect(page.getByText(/Location set:/i)).toBeVisible();
  });
});