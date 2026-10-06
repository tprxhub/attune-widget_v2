import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";

const PASSWORD = "ChangeMe123!";

test("Super Admin adds a TTP employee with chosen access, who then sees only those pages", async ({
  page,
  browser,
}) => {
  const email = `ttp.${Date.now()}@playhub.local`;
  await page.goto("/login");
  await page.getByLabel("Email Address").fill("admin@playhub.local");
  await page.getByLabel("Password", { exact: true }).fill(PASSWORD);
  await page.getByRole("button", { name: "Log in" }).click();
  await expect(page).toHaveURL(/\/admin/);

  await page.getByRole("link", { name: "TTP Employees" }).first().click();
  await page.getByRole("button", { name: "Add TTP employee" }).click();
  const dialog = page.getByRole("dialog", { name: "Add TTP employee" });
  await dialog.getByLabel("Full name").fill("Tara Test");
  await dialog.getByLabel("Email").fill(email);
  await dialog.getByLabel(/Audit log/).check();
  const logTypes = dialog.getByRole("group", { name: "Audit log types" });
  await expect(logTypes.getByLabel(/Check-ins/)).toBeChecked();
  await expect(logTypes.getByLabel(/Billing & payments/)).not.toBeChecked();
  await expect(logTypes.getByLabel(/Accounts/)).not.toBeChecked();
  await logTypes.getByLabel(/Accounts/).check();
  await dialog.getByLabel(/Plans library/).check();
  await dialog.getByRole("button", { name: "Add employee" }).click();

  const linkDialog = page.getByRole("dialog", { name: "Activation link ready" });
  const link = (await linkDialog.getByText(/accept-invite\?token=/).textContent())!
    .replace("One-time activation link", "")
    .trim();
  expect(link).toMatch(/\/accept-invite\?token=.{20,}/);
  await linkDialog.getByRole("button", { name: "Done" }).click();
  await expect(page.locator("li").filter({ hasText: "Tara Test" })).toContainText("Invite pending");

  // The employee activates the account and signs in.
  const context = await browser.newContext();
  const employee = await context.newPage();
  await employee.goto(link);
  await employee.getByLabel("Display name").fill("Tara Test");
  await employee.locator("#invite-password").fill(PASSWORD);
  await employee.locator("#invite-confirm").fill(PASSWORD);
  await employee.getByRole("button", { name: "Activate account" }).click();
  await expect(employee).toHaveURL(/\/admin/);

  const nav = employee.getByRole("navigation").first();
  await expect(employee.getByRole("link", { name: "Audit log" }).first()).toBeVisible();
  await expect(employee.getByRole("link", { name: "Plans library" }).first()).toBeVisible();
  for (const hidden of ["Children", "Organisations", "Home page", "TTP Employees"]) {
    await expect(employee.getByRole("link", { name: hidden, exact: true })).toHaveCount(0);
  }
  void nav;

  // Pages that were not ticked are blocked, ticked pages work, and Excel export downloads.
  await employee.goto("/admin/children");
  await expect(
    employee.getByRole("heading", { name: "You don't have access to this page" }),
  ).toBeVisible();
  await employee.goto("/admin/ttp");
  await expect(
    employee.getByRole("heading", { name: "Not available for your role" }),
  ).toBeVisible();
  await employee.goto("/admin/audit");
  await expect(employee.getByRole("heading", { name: "Audit log", exact: true })).toBeVisible();
  const download = employee.waitForEvent("download");
  await employee.getByRole("button", { name: "Export to Excel" }).click();
  const file = await download;
  expect(file.suggestedFilename()).toMatch(/^playhub-audit-log-\d{4}-\d{2}-\d{2}\.xlsx$/);
  const bytes = readFileSync((await file.path())!);
  expect(bytes.subarray(0, 2).toString()).toBe("PK"); // .xlsx is a zip archive

  await employee.goto("/admin/audit");
  await expect(employee.getByText(/You can see these log types:/)).toBeVisible();
  await expect(employee.getByText(/Billing/)).toHaveCount(0);

  // The Super Admin ticks one more page; it appears for the employee without a new login.
  await page.reload();
  const card = page.locator("li").filter({ hasText: "Tara Test" });
  await expect(card).toContainText("Active");
  await card.getByRole("button", { name: "Edit access" }).click();
  const edit = page.getByRole("dialog", { name: "Edit access" });
  await edit.getByLabel(/^Children/).check();
  await edit.getByRole("button", { name: "Save access" }).click();
  await expect(card).toContainText("Children");
  await employee.reload();
  await expect(employee.getByRole("link", { name: "Children", exact: true }).first()).toBeVisible();
  await employee.goto("/admin/children");
  await expect(employee.getByRole("heading", { name: "Children", exact: true })).toBeVisible();
  await context.close();
});
