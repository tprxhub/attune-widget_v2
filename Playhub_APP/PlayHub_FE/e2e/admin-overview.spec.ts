import { expect, test, type Page } from "@playwright/test";

const SHOTS = process.env["OVERVIEW_SHOTS"];
test.use({ viewport: { width: 1440, height: 1000 } });

test.beforeEach(async ({ page }) => {
  // These tests are about the Overview, so mark the first-visit navigation guide as seen.
  await page.addInitScript(() => {
    const getItem = Storage.prototype.getItem;
    Storage.prototype.getItem = function (key: string) {
      return key.startsWith("playhub:navigation-tour:") ? "complete" : getItem.call(this, key);
    };
  });
});

async function login(page: Page, email: string) {
  await page.goto("/login");
  await page.getByLabel("Email Address").fill(email);
  await page.getByLabel("Password", { exact: true }).fill("ChangeMe123!");
  await page.getByRole("button", { name: "Log in" }).click();
  await expect(page).toHaveURL(/\/admin/);
  await expect(page.getByRole("heading", { name: "Platform overview" })).toBeVisible();
}

test("Super Admin sees every area of the Overview", async ({ page }) => {
  await login(page, "admin@playhub.local");
  for (const name of [
    "Key figures",
    "Needs attention",
    "Sessions and outcomes",
    "Engagement",
    "Families and revenue",
    "Schools and clinics",
    "Organisation staff",
    "Plans library",
    "Recent activity",
  ]) {
    await expect(page.getByRole("region", { name }).first()).toBeVisible();
  }
  await expect(page.getByRole("region", { name: "Your access" })).toHaveCount(0);
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/overview-admin.png`, fullPage: true });
});

test("a TTP employee sees only the areas they were given", async ({ page }) => {
  await login(page, "ttp@playhub.local");
  const access = page.getByRole("region", { name: "Your access" });
  await expect(access.getByRole("link", { name: "Children" })).toBeVisible();
  await expect(access.getByRole("link", { name: "Subscriptions" })).toBeVisible();
  await expect(access.getByRole("link", { name: "Organisations" })).toHaveCount(0);
  await expect(access.getByText("Organisations")).toBeVisible();

  await expect(page.getByRole("region", { name: "Families and revenue" })).toBeVisible();
  await expect(page.getByRole("region", { name: "Sessions and outcomes" })).toBeVisible();
  for (const hidden of ["Schools and clinics", "Organisation staff", "Plans library"]) {
    await expect(page.getByRole("region", { name: hidden })).toHaveCount(0);
  }
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/overview-ttp.png`, fullPage: true });

  // Subscriptions access means the Subscription button shows for family children.
  await page.goto("/admin/children");
  await expect(page.getByRole("button", { name: "Subscription" }).first()).toBeVisible();
});
