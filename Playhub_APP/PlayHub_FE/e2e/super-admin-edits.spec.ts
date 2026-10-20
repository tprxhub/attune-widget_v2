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
  await page.getByRole("button", { name: `Edit ${name}`, exact: true }).click();
  const dialog = page.getByRole("dialog", { name: `Edit ${name}` });
  await dialog.getByLabel("Organisation name").fill(`${name} Clinic`);
  await dialog.getByRole("button", { name: "Organisation type" }).click();
  await page.getByRole("option", { name: "Clinic", exact: true }).click();
  await dialog.getByLabel("Number of licences").fill("7");
  await dialog.getByRole("button", { name: "Save changes" }).click();
  await expect(dialog).toHaveCount(0);
  const card = page.locator("article").filter({ hasText: `${name} Clinic` });
  await expect(card).toBeVisible();
  await expect(card.getByText("Clinic", { exact: true })).toBeVisible();
  await expect(card).toContainText("0 / 7 member licences");
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

test("Super Admin deletes an organisation with everything in it after typing its name", async ({
  page,
}) => {
  const login = await page.request.post(`${API}/auth/login`, {
    data: { email: "admin@playhub.local", password: "ChangeMe123!" },
  });
  const headers = { Authorization: `Bearer ${(await login.json()).access_token}` };
  const name = `Delete Test School ${Date.now()}`;
  const org = await (
    await page.request.post(`${API}/organisations`, { headers, data: { name, seat_limit: 5 } })
  ).json();
  const child = await page.request.post(`${API}/children`, {
    headers,
    data: { name: "Gone", account_scope: "organisation", organisation_id: org.id },
  });
  expect(child.ok()).toBe(true);

  await signIn(page, "admin@playhub.local");
  await page.goto("/admin/orgs");
  const card = page.locator("article").filter({ hasText: name });
  // Only a suspended organisation can be deleted.
  await expect(card.getByRole("button", { name: `Delete ${name}` })).toHaveCount(0);
  await card.getByRole("button", { name: "Suspend" }).click();
  await page.getByRole("alertdialog").getByRole("button", { name: "Suspend organisation" }).click();
  await card.getByRole("button", { name: `Delete ${name}` }).click();
  const dialog = page.getByRole("alertdialog", { name: `Delete ${name}` });
  const counts = dialog.getByRole("definition");
  await expect(dialog.getByLabel("What will be deleted")).toContainText("Members1");
  await expect(counts.first()).toBeVisible();
  const confirm = dialog.getByRole("button", { name: "Delete everything" });
  await expect(confirm).toBeDisabled();
  await dialog.getByLabel(/to confirm/).fill("wrong name");
  await expect(confirm).toBeDisabled();
  await dialog.getByLabel(/to confirm/).fill(name);
  await confirm.click();
  await expect(dialog).toHaveCount(0);
  await expect(page.getByText(name, { exact: true })).toHaveCount(0);
  const gone = await page.request.get(`${API}/organisations/${org.id}/deletion-preview`, {
    headers,
  });
  expect(gone.status()).toBe(404);
});
