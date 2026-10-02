import { expect, test } from "@playwright/test";

test("footer links open the privacy policy and terms of service pages", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("link", { name: "Privacy policy" }).click();
  await expect(page).toHaveURL(/\/policies\/privacy-policy$/);
  await expect(page.getByRole("heading", { name: "Privacy policy", level: 1 })).toBeVisible();
  await expect(page.getByText("info@thetoypharmacy.com").first()).toBeVisible();

  await page.goto("/");
  await page.getByRole("link", { name: "Terms of service" }).click();
  await expect(page).toHaveURL(/\/policies\/terms-of-service$/);
  await expect(page.getByRole("heading", { name: "Terms of service", level: 1 })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Section 20 - Contact information" })).toBeVisible();
});

test("policy pages are reachable directly", async ({ page }) => {
  for (const path of ["/policies/privacy-policy", "/policies/terms-of-service"]) {
    const response = await page.goto(path);
    expect(response?.status()).toBe(200);
  }
});
