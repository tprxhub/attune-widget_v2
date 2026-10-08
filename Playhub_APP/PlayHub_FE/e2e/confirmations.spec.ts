import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    const original = Storage.prototype.getItem;
    Storage.prototype.getItem = function (key) {
      return key.startsWith("playhub:navigation-tour:") ? "complete" : original.call(this, key);
    };
  });
  await page.goto("/login");
  await page.getByLabel("Email Address").fill("admin@playhub.local");
  await page.getByLabel("Password", { exact: true }).fill("ChangeMe123!");
  await page.getByRole("button", { name: "Log in", exact: true }).click();
  await expect(page).toHaveURL(/\/admin/);
});

test("suspending an organisation waits for confirmation and supports error retry", async ({
  page,
}) => {
  await page.goto("/admin/orgs");
  let writes = 0;
  let reject = true;
  await page.route("**/api/v1/organisations/*", async (route) => {
    if (route.request().method() !== "PATCH") return route.continue();
    writes++;
    if (reject) return route.fulfill({ status: 503, json: { detail: "Please try again" } });
    return route.continue();
  });
  const suspend = page.getByRole("button", { name: "Suspend", exact: true }).first();
  await suspend.click();
  const dialog = page.getByRole("alertdialog");
  await expect(dialog.getByRole("button", { name: "Cancel", exact: true })).toBeFocused();
  expect(writes).toBe(0);
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
  expect(writes).toBe(0);
  await suspend.click();
  await dialog.getByRole("button", { name: "Suspend organisation" }).click();
  await expect(dialog.getByRole("alert")).toHaveText("Please try again");
  expect(writes).toBe(1);
  reject = false;
  await dialog.getByRole("button", { name: "Suspend organisation" }).click();
  await expect(dialog).toHaveCount(0);
  expect(writes).toBe(2);
  await expect(page.getByRole("button", { name: "Reactivate", exact: true }).first()).toBeVisible();
});

test("removing a draft activity confirms without closing the Play Dose editor", async ({
  page,
}) => {
  await page.goto("/admin/plans");
  await page.getByRole("button", { name: "Edit Play Dose", exact: true }).first().click();
  const editor = page.getByRole("dialog", { name: "Edit Play Dose", exact: true });
  const remove = editor.getByRole("button", { name: "Remove activity", exact: true });
  const initial = await remove.count();
  expect(initial).toBeGreaterThan(0);
  await remove.first().click();
  const confirm = page.getByRole("alertdialog");
  await confirm.getByRole("button", { name: "Cancel", exact: true }).click();
  await expect(remove).toHaveCount(initial);
  await remove.first().click();
  await confirm.getByRole("button", { name: "Remove activity", exact: true }).click();
  await expect(confirm).toHaveCount(0);
  await expect(editor).toBeVisible();
  await expect(remove).toHaveCount(initial - 1);
});
