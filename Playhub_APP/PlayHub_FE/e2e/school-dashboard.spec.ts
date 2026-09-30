import { expect, test, type Page } from "@playwright/test";

async function login(page: Page, email: string) {
  await page.goto("/login");
  await page.getByRole("tab", { name: "School / clinic" }).click();
  await page.getByLabel("Email Address").fill(email);
  await page.getByLabel("Password", { exact: true }).fill("ChangeMe123!");
  await page.getByRole("button", { name: "Log in" }).click();
  await expect(page).toHaveURL(/\/(dashboard|org|admin)(?:[/?#]|$)/);
}

test("school Admin sees every child on the dashboard and can open one", async ({ page }) => {
  await login(page, "esther@sunrise.local");
  await page.goto("/dashboard");

  await expect(page.getByText("Children enrolled")).toBeVisible();
  await expect(page.getByText("With a moderator")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Amira" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Omar" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Sara" })).toBeVisible();
  await expect(page.getByRole("button", { name: /Selected child: All children/ })).toBeVisible();

  // The status donut and the "needs your eye" card are gone; graphs start collapsed.
  await expect(page.getByText("How the children are doing")).toHaveCount(0);
  await expect(page.getByText("Weekly notes")).toHaveCount(0);
  await page.getByRole("button", { name: "Show progress graph" }).first().click();
  await expect(page.getByText("Weekly notes").first()).toBeVisible();
  await page.getByRole("button", { name: "Hide progress graph" }).first().click();
  await expect(page.getByText("Weekly notes")).toHaveCount(0);

  const filters = page.getByRole("group", { name: "Filter by status" });
  await filters.getByRole("button", { name: /Holding steady/ }).click();
  await expect(page.getByRole("heading", { name: "Sara" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Omar" })).toHaveCount(0);
  await filters.getByRole("button", { name: /^All/ }).click();

  await page.getByRole("button", { name: /Selected child/ }).click();
  await page.getByRole("option", { name: /Omar/ }).click();
  await expect(page.getByText("Assigned moderator")).toBeVisible();
  await expect(page.getByText("Recent check-ins")).toBeVisible();
  await page.getByRole("button", { name: "All children" }).click();
  await expect(page.getByText("Children enrolled")).toBeVisible();
});

test("a Moderator keeps the single-child dashboard", async ({ page }) => {
  await login(page, "moderator@playhub.local");
  await page.goto("/dashboard");
  await expect(page.getByText("Today's Play Dose")).toBeVisible();
  await expect(page.getByText("Children enrolled")).toHaveCount(0);
});
