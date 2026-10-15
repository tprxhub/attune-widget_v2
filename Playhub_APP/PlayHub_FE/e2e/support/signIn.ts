import { expect, type Page } from "@playwright/test";

export async function signIn(page: Page, email: string) {
  await page.goto("/login");
  await page.getByLabel("Email Address").fill(email);
  await page.getByLabel("Password", { exact: true }).fill("ChangeMe123!");
  await Promise.all([
    page.waitForURL(/\/(admin|dashboard)/),
    page.getByRole("button", { name: "Log in", exact: true }).click(),
  ]);
  await expect(page.getByLabel("Password", { exact: true })).toHaveCount(0);
}
