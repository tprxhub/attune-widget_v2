import { expect, test } from "@playwright/test";
import { signIn } from "./support/signIn";

test("an organisation Admin can edit a Moderator's name but not their sign-in email", async ({
  page,
}) => {
  await signIn(page, "esther@sunrise.local");
  await page.goto("/org/supporters");
  const edit = page.getByRole("button", { name: "Edit Priya Raman" }).first();
  await edit.click();
  const dialog = page.getByRole("dialog", { name: "Edit Moderator" });
  await expect(dialog.getByLabel("Email")).toBeDisabled();
  await dialog.getByLabel("Full name").fill("Priya Raman-Iyer");
  await dialog.getByRole("button", { name: "Save changes" }).click();
  await expect(dialog).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "Priya Raman-Iyer" })).toBeVisible();

  // The list view offers the same Edit; put the name back.
  await page.getByRole("button", { name: "List view" }).click();
  await page.getByRole("button", { name: "Edit Priya Raman-Iyer" }).click();
  await dialog.getByLabel("Full name").fill("Priya Raman");
  await dialog.getByRole("button", { name: "Save changes" }).click();
  await expect(dialog).toHaveCount(0);
  await expect(page.getByText("Priya Raman", { exact: true }).first()).toBeVisible();
});
