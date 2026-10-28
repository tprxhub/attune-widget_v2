import { expect, test } from "@playwright/test";
import { signIn } from "./support/signIn";

test("an admin can put multiple Play Plans in one category and the library groups them", async ({
  page,
}) => {
  await signIn(page, "admin@playhub.local");
  await page.goto("/admin/plans");

  await page.getByRole("button", { name: "New Category", exact: true }).click();
  const newCategory = page.getByRole("dialog", { name: "New Category" });
  await newCategory.getByRole("textbox", { name: "Category name" }).fill("Fine Motor Games");
  await newCategory.getByRole("button", { name: "Create Category" }).click();

  const category = page
    .locator("section")
    .filter({ has: page.getByRole("heading", { name: "Fine Motor Games", exact: true }) })
    .first();
  await expect(category).toBeVisible();
  for (const name of ["Finger Strength Games", "Pencil Grip Games"]) {
    await category.getByRole("button", { name: "New Play Plan" }).click();
    const dialog = page.getByRole("dialog", { name: "New Play Plan" });
    await expect(dialog.getByLabel("Category")).toHaveValue(/.+/);
    await dialog.getByRole("textbox", { name: "Play Plan name" }).fill(name);
    await dialog.getByRole("button", { name: "Create Play Plan" }).click();
    await expect(category.getByRole("heading", { name, exact: true })).toBeVisible();
  }

  await page.goto("/plans");
  const libraryCategory = page
    .locator("section")
    .filter({ has: page.getByRole("heading", { name: "Fine Motor Games", exact: true }) })
    .first();
  await expect(
    libraryCategory.getByRole("heading", { name: "Finger Strength Games" }),
  ).toBeVisible();
  await expect(libraryCategory.getByRole("heading", { name: "Pencil Grip Games" })).toBeVisible();
});
