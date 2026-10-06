import { expect, test } from "@playwright/test";

test("navigation guide auto-runs once and can be restarted from its CTA", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("Email Address").fill("parent@playhub.local");
  await page.getByLabel("Password", { exact: true }).fill("ChangeMe123!");
  await page.getByRole("button", { name: "Log in" }).click();
  await expect(page).toHaveURL(/\/dashboard/);

  const guide = page.getByRole("dialog", { name: "Play Hub navigation guide" });
  await expect(guide).toBeVisible();
  await expect(guide.getByRole("heading", { name: "Dashboard" })).toBeVisible();

  const startingUrl = page.url();
  await guide.getByRole("button", { name: /Next/ }).click();
  await expect(guide.getByRole("heading", { name: "Play Plans" })).toBeVisible();
  await expect(page).toHaveURL(startingUrl);

  await guide.getByRole("button", { name: "Exit navigation guide" }).click();
  await expect(guide).toHaveCount(0);

  await page.reload();
  await page.waitForTimeout(1_000);
  await expect(guide).toHaveCount(0);

  await page.getByRole("button", { name: "Start navigation guide" }).click();
  await expect(guide).toBeVisible();
  await expect(guide.getByRole("heading", { name: "Dashboard" })).toBeVisible();
});
