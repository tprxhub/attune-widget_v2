import { expect, test } from "@playwright/test";

for (const width of [375, 768, 1440]) {
  test(`progress wireframe and shared chart controls at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 1000 });
    await page.addInitScript(() => {
      const get = Storage.prototype.getItem;
      Storage.prototype.getItem = function (key) {
        return key.startsWith("playhub:navigation-tour:") ? "complete" : get.call(this, key);
      };
    });
    await page.goto("/login");
    await page.getByLabel("Email Address").fill("parent@playhub.local");
    await page.getByLabel("Password", { exact: true }).fill("ChangeMe123!");
    await page.getByRole("button", { name: "Log in", exact: true }).click();
    await expect(page).toHaveURL(/\/(dashboard|org|admin)/);
    await page.goto("/progress");
    const plan = page.getByRole("region", { name: "Within a Play Plan", exact: true });
    const dose = page.getByRole("region", { name: "Within a Play Dose", exact: true });
    const insights = page.getByRole("region", { name: "Progress insights", exact: true });
    await expect(plan).toBeVisible();
    await expect(dose).toBeVisible();
    await expect(insights).toBeVisible();
    const rings = page.getByRole("group", { name: "Independence and mood rings" });
    const supportFill = rings.locator('circle[stroke="#2459A0"]');
    const markers = rings.locator('g[transform^="translate("]');
    await expect(supportFill).toHaveCount(1);
    await expect(markers).toHaveCount(2);
    const initialFill = await supportFill.getAttribute("stroke-dasharray");
    const initialMarker = await markers.first().getAttribute("transform");
    await page.waitForTimeout(250);
    expect(await supportFill.getAttribute("stroke-dasharray")).not.toBe(initialFill);
    expect(await markers.first().getAttribute("transform")).not.toBe(initialMarker);

    const centerLogo = rings.locator("xpath=following-sibling::div//img");
    await expect(centerLogo).toBeVisible();
    expect(
      await centerLogo.evaluate((image: HTMLImageElement) => image.naturalWidth),
    ).toBeGreaterThan(0);
    const planBox = (await plan.boundingBox())!;
    const doseBox = (await dose.boundingBox())!;
    expect(doseBox.y).toBeGreaterThan(planBox.y + planBox.height);
    if (width >= 1024) expect((await insights.boundingBox())!.x).toBeGreaterThan(planBox.x);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    const mood = page.getByLabel("Show mood line", { exact: true });
    await expect(mood).toHaveCount(1);
    await mood.uncheck();
    await expect(plan.locator('svg circle[fill="#7B4FA6"]')).toHaveCount(0);
    await expect(dose.locator('svg circle[fill="#7B4FA6"]')).toHaveCount(0);
    await mood.check();
    await expect(plan.locator('svg circle[fill="#7B4FA6"]').first()).toBeAttached();
    const selector = page.getByRole("button", { name: "Play Dose", exact: true });
    await selector.click();
    const option = page.getByRole("option").first();
    const selectedText = await option.innerText();
    await option.click();
    await expect(selector).toContainText(selectedText.split("\n")[0]!);
    const history = page.getByRole("button", { name: /Session history/ });
    await expect(history).toHaveAttribute("aria-expanded", "false");
    await history.click();
    await expect(history).toHaveAttribute("aria-expanded", "true");
    await expect(insights.getByRole("link", { name: "Ask Attune", exact: true })).toHaveAttribute(
      "href",
      /\/attune\?q=/,
    );
    await page.screenshot({ path: `test-results/progress-wireframe-${width}.png`, fullPage: true });
  });
}
