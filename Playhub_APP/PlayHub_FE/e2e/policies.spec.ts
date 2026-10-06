import { expect, test } from "@playwright/test";

test("footer links open the privacy policy and terms of service pages", async ({ page }) => {
  await page.goto("/");
  await page.waitForLoadState("networkidle"); // lazy images shift the footer while loading
  await page.getByRole("link", { name: "Privacy policy" }).click();
  await expect(page).toHaveURL(/\/policies\/privacy-policy$/);
  await expect(page.getByRole("heading", { name: "Privacy policy", level: 1 })).toBeVisible();
  await expect(page.getByText("info@thetoypharmacy.com").first()).toBeVisible();

  await page.goto("/");
  await page.waitForLoadState("networkidle");
  await page.getByRole("link", { name: "Terms of service" }).click();
  await expect(page).toHaveURL(/\/policies\/terms-of-service$/);
  await expect(page.getByRole("heading", { name: "Terms of service", level: 1 })).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Section 20 - Contact information" }),
  ).toBeVisible();
});

test("policy pages are reachable directly", async ({ page }) => {
  for (const path of ["/policies/privacy-policy", "/policies/terms-of-service"]) {
    const response = await page.goto(path);
    expect(response?.status()).toBe(200);
  }
});

test("sign up opens the terms in a dialog, and I agree ticks the box", async ({ page }) => {
  await page.goto("/signup");
  await expect(page.getByRole("button", { name: "Create Account" })).toBeEnabled();
  const checkbox = page.getByRole("checkbox");
  await page.getByRole("button", { name: "Terms & Condition" }).click();
  const dialog = page.getByRole("dialog", { name: "Terms of service" });
  await expect(dialog).toBeVisible();
  await expect(checkbox).not.toBeChecked();
  await dialog.getByRole("tab", { name: "Privacy policy" }).click();
  await expect(page.getByRole("dialog", { name: "Privacy policy" })).toBeVisible();
  await page.getByRole("dialog").getByRole("button", { name: "I agree" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(checkbox).toBeChecked();
  await expect(page).toHaveURL(/\/signup$/);
});
