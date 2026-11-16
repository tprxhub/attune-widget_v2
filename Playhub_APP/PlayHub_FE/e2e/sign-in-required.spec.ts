import { expect, test } from "@playwright/test";

test("a signed-out visitor on a members-only page is offered log in and sign up", async ({
  page,
}) => {
  await page.goto("/plans");
  await expect(page.getByRole("heading", { name: "Please sign in" })).toBeVisible();
  await expect(page.getByText("Inside Play Hub")).toBeVisible();
  await page.getByRole("link", { name: "Create a free account" }).click();
  await expect(page).toHaveURL(/\/signup/);
  await page.goBack();
  await page.getByRole("link", { name: "Log in", exact: true }).click();
  await expect(page).toHaveURL(/\/login/);
});
