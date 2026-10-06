import { expect, test } from "@playwright/test";

test("the Microsoft sign-in callback page loads on its own", async ({ page }) => {
  const response = await page.goto("/auth/microsoft-callback");
  expect(response?.status()).toBeLessThan(400);
  await expect(page.getByText("Signing you in…")).toBeVisible();
});
