import { expect, test } from "@playwright/test";

test("school member cards keep icons and View aligned and status labels on one line", async ({
  page,
}) => {
  const response = await page.request.post("http://127.0.0.1:8765/api/v1/auth/login", {
    data: { email: "esther@sunrise.local", password: "ChangeMe123!" },
  });
  const { access_token: token } = await response.json();
  await page.addInitScript((token) => {
    localStorage.setItem("playhub_access_token", token);
    const original = Storage.prototype.getItem;
    Storage.prototype.getItem = function (key) {
      return key.startsWith("playhub:navigation-tour:") ? "complete" : original.call(this, key);
    };
  }, token);
  for (const width of [320, 375, 390, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/dashboard");
    const cards = page.getByRole("region", { name: "Members", exact: true }).locator("article");
    await expect(cards.first()).toBeVisible();
    await page.evaluate(() => document.fonts.ready);
    for (const card of await cards.all()) {
      const header = card.locator(":scope > div").first();
      const icon = await header.locator(":scope > span").boundingBox();
      const view = await header.getByRole("button", { name: "View", exact: true }).boundingBox();
      const status = await header
        .getByRole("button")
        .filter({ has: page.locator("svg") })
        .last()
        .boundingBox();
      expect(icon).not.toBeNull();
      expect(view).not.toBeNull();
      expect(status).not.toBeNull();
      expect(Math.abs(icon!.y + icon!.height / 2 - view!.y - view!.height / 2)).toBeLessThanOrEqual(
        1,
      );
      expect(status!.height).toBeLessThanOrEqual(30);
      expect(status!.y).toBeGreaterThanOrEqual(icon!.y + icon!.height);
    }
  }
});
