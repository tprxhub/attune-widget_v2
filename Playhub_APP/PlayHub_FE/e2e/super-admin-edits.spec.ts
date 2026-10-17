import { expect, test } from "@playwright/test";
import { signIn } from "./support/signIn";

const API = "http://127.0.0.1:8765/api/v1";

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    const getItem = Storage.prototype.getItem;
    Storage.prototype.getItem = function (key: string) {
      return key.startsWith("playhub:navigation-tour:") ? "complete" : getItem.call(this, key);
    };
  });
});

test("Super Admin renames an organisation and changes its type", async ({ page }) => {
  const login = await page.request.post(`${API}/auth/login`, {
    data: { email: "admin@playhub.local", password: "ChangeMe123!" },
  });
  const { access_token: token } = await login.json();
  const name = `Edit Test School ${Date.now()}`;
  const created = await page.request.post(`${API}/organisations`, {
    headers: { Authorization: `Bearer ${token}` },
    data: { name, kind: "school", seat_limit: 3 },
  });
  expect(created.ok()).toBe(true);

  await signIn(page, "admin@playhub.local");
  await page.goto("/admin/orgs");
  await page.getByRole("button", { name: `Edit details for ${name}` }).click();
  await page.getByLabel(`Name of ${name}`).fill(`${name} Clinic`);
  await page.getByRole("button", { name: `Type of ${name}` }).click();
  await page.getByRole("option", { name: "Clinic", exact: true }).click();
  await page.getByRole("button", { name: "Save", exact: true }).click();
  const card = page.locator("article").filter({ hasText: `${name} Clinic` });
  await expect(card).toBeVisible();
  await expect(card.getByText("Clinic", { exact: true })).toBeVisible();
});

test("Super Admin edits a Moderator's name and email, then puts them back", async ({ page }) => {
  await signIn(page, "admin@playhub.local");
  await page.goto("/admin/educators");
  const edit = async (from: string, name: string, email: string) => {
    await page
      .getByRole("button", { name: `Edit ${from}`, exact: true })
      .first()
      .click();
    const dialog = page.getByRole("dialog", { name: "Edit Moderator" });
    await dialog.getByLabel("Full name").fill(name);
    await dialog.getByLabel("Email").fill(email);
    await dialog.getByRole("button", { name: "Save changes" }).click();
    await expect(dialog).toHaveCount(0);
    await expect(page.getByText(email, { exact: true })).toBeVisible();
  };
  await edit("Alex Morgan", "Alex Morgan-Edited", "alex.edited@brightsteps.local");
  await expect(page.getByRole("heading", { name: "Alex Morgan-Edited" })).toBeVisible();
  await edit("Alex Morgan-Edited", "Alex Morgan", "supporter@brightsteps.local");
});
