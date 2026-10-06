import { expect, test, type Page } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  // These tests are not about the first-visit navigation guide, so mark it as seen.
  await page.addInitScript(() => {
    const getItem = Storage.prototype.getItem;
    Storage.prototype.getItem = function (key: string) {
      return key.startsWith("playhub:navigation-tour:") ? "complete" : getItem.call(this, key);
    };
  });
});

async function login(page: Page, email: string, org = false) {
  await page.goto("/login");
  if (org) await page.getByRole("tab", { name: "School / clinic" }).click();
  await page.getByLabel("Email Address").fill(email);
  await page.getByLabel("Password", { exact: true }).fill("ChangeMe123!");
  await page.getByRole("button", { name: "Log in" }).click();
  await expect(page).toHaveURL(/\/(dashboard|org|admin)(?:[/?#]|$)/);
}

async function fullyVisible(page: Page, name: string) {
  const list = page.getByRole("listbox").first();
  await expect(list).toBeVisible();
  const box = (await list.boundingBox())!;
  const vp = page.viewportSize()!;
  expect(box.y).toBeGreaterThanOrEqual(0);
  expect(box.y + box.height).toBeLessThanOrEqual(vp.height);
  expect(box.x + box.width).toBeLessThanOrEqual(vp.width);
}

test("card dropdown, child switcher and progress filter are not clipped", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  await login(page, "esther@sunrise.local", true);
  await page.goto("/org");
  // Assigned moderator dropdown sits at the bottom of a card.
  await page
    .getByRole("button", { name: /Not assigned|Assigned/ })
    .first()
    .click();
  await fullyVisible(page, "assigned-moderator");
  await page.keyboard.press("Escape");

  // Child switcher in the top bar, with Add a Member.
  await page.getByRole("button", { name: /Selected child/ }).click();
  await fullyVisible(page, "child-switcher");
  await page.getByRole("link", { name: "Add a Member" }).click();
  await expect(page).toHaveURL(/\/org\/enroll/);

  // Progress plan filter.
  await page.goto("/progress");
  await page
    .locator('button[aria-labelledby="progress-plan-filter-label progress-plan-filter-value"]')
    .click();
  await fullyVisible(page, "progress-filter");
});

test("a parent does not get Add a Member", async ({ page }) => {
  await login(page, "parent@playhub.local");
  await page.goto("/dashboard");
  const switcher = page.getByRole("button", { name: /Selected child/ });
  if (await switcher.count()) {
    await switcher.click();
    await expect(page.getByRole("link", { name: "Add a Member" })).toHaveCount(0);
  }
});
