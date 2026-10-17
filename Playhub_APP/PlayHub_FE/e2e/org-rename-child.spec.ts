import { expect, test, type Page } from "@playwright/test";

async function signIn(page: Page, email: string) {
  await page.goto("/login");
  await page.getByRole("tab", { name: "School / clinic" }).click();
  await page.getByLabel("Email Address").fill(email);
  await page.getByLabel("Password", { exact: true }).fill("ChangeMe123!");
  await page.getByRole("button", { name: "Log in", exact: true }).click();
  await expect(page).toHaveURL(/\/(dashboard|org|hub)(?:[/?#]|$)/);
}

test("an organisation admin renames a child from the Children page", async ({ page }) => {
  await signIn(page, "esther@sunrise.local");
  await page.goto("/org");
  const card = page.locator("article").first();
  const heading = card.getByRole("heading", { level: 2 });
  await expect(heading).not.toHaveText("");
  const original = (await heading.textContent())!.trim();
  const renamed = `${original} Renamed`;

  // Escape leaves the name as it was.
  await card.getByRole("button", { name: `Edit ${original}'s name` }).click();
  await card.getByLabel("Child's name").fill("Something else");
  await card.getByLabel("Child's name").press("Escape");
  await expect(heading).toHaveText(original);

  // An empty name is refused.
  await card.getByRole("button", { name: `Edit ${original}'s name` }).click();
  await card.getByLabel("Child's name").fill("   ");
  await card.getByRole("button", { name: "Save name" }).click();
  await expect(card.getByRole("alert")).toHaveText("Please enter the child's name.");

  await card.getByLabel("Child's name").fill(`  ${renamed} `);
  await card.getByRole("button", { name: "Save name" }).click();
  await expect(card.getByRole("heading", { level: 2 })).toHaveText(renamed);
  await page.reload();
  await expect(page.locator("article").getByRole("heading", { name: renamed })).toBeVisible();

  // The list view has the same control; use it to put the name back.
  await page.getByRole("button", { name: "List" }).click();
  const row = page.getByRole("listitem").filter({ hasText: renamed });
  await row.getByRole("button", { name: `Edit ${renamed}'s name` }).click();
  // Only one name is being edited, and the row no longer shows the old text while it is.
  await page.getByLabel("Child's name").fill(original);
  await page.getByLabel("Child's name").press("Enter");
  await expect(
    page.getByRole("listitem").getByText(original, { exact: true }).first(),
  ).toBeVisible();
  await expect(page.getByRole("listitem").getByText(renamed, { exact: true })).toHaveCount(0);
  await page.getByRole("button", { name: "Cards" }).click();
});

test("a Moderator can't rename children", async ({ page }) => {
  await signIn(page, "moderator@playhub.local");
  await page.goto("/org");
  await expect(page.locator("article").first()).toBeVisible();
  await expect(page.getByRole("button", { name: /^Edit .*'s name$/ })).toHaveCount(0);
});
