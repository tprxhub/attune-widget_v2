import { expect, test } from "@playwright/test";
import { signIn } from "./support/signIn";

test("Super Admin opens billing from its own navigation tab", async ({ page }) => {
  await signIn(page, "admin@playhub.local");
  await page.goto("/admin");
  await page
    .getByRole("navigation", { name: "Main", exact: true })
    .getByRole("link", { name: "Billing", exact: true })
    .click();
  await expect(page).toHaveURL(/\/admin\/billing$/);
  await expect(page.getByRole("heading", { name: "Billing", exact: true })).toBeVisible();
  await expect(page.getByRole("region", { name: "Billing schedule" })).toBeVisible();
  await page.getByRole("button", { name: "Organisation", exact: true }).click();
  await expect(page.getByRole("option")).toHaveCount(2);
  await page.getByRole("option").last().click();
  await expect(page.getByRole("region", { name: "Billing schedule" })).toBeVisible();
});

test("organisation Admin keeps billing on Account instead of the navbar", async ({ page }) => {
  await signIn(page, "esther@sunrise.local");
  await page.goto("/org");
  await expect(
    page
      .getByRole("navigation", { name: "Main", exact: true })
      .getByRole("link", { name: "Billing", exact: true }),
  ).toHaveCount(0);
  await page.goto("/account");
  await page.getByRole("link", { name: /Billing.*View billing/ }).click();
  await expect(page).toHaveURL(/\/org\/billing/);
});
