import { expect, test } from "@playwright/test";

test("a signed-out user can ask for a reset link from the login page", async ({ page }) => {
  await page.goto("/login");
  await page.waitForLoadState("networkidle");
  await page.getByLabel("Email Address").fill("parent@playhub.local");
  await page.getByRole("link", { name: "Forgot password?" }).click();
  await expect(page).toHaveURL(/\/forgot-password/);
  // The email typed on the login page carries over.
  await expect(page.getByLabel("Email Address")).toHaveValue("parent@playhub.local");
  await page.getByRole("button", { name: "Send reset link" }).click();
  await expect(page.getByRole("status")).toContainText("Check your email");
});

test("an expired or made-up reset link explains what to do", async ({ page }) => {
  await page.goto("/reset-password?token=not-a-real-token-but-long-enough");
  await page.waitForLoadState("networkidle"); // submit only once the page is interactive
  await page.getByLabel("New password", { exact: true }).fill("Brand-new-pass-2");
  await page.getByLabel("Confirm new password").fill("Brand-new-pass-2");
  await page.getByRole("button", { name: "Save new password" }).click();
  await expect(page.getByRole("alert")).toContainText("expired or was already used");
  await expect(page.getByRole("link", { name: "Send a new link" })).toBeVisible();
});
