import { readFileSync } from "node:fs";
import { expect, test, type Page } from "@playwright/test";
import { signIn } from "./support/signIn";

async function addPeriod(
  page: Page,
  sequence: number,
  fields: { start?: string; months: string; licences: string; price: string; total?: string },
) {
  await page.getByRole("button", { name: `Add Billing ${sequence}`, exact: true }).click();
  const dialog = page.getByRole("dialog", { name: `Add Billing ${sequence}` });
  if (fields.start) await dialog.getByLabel("Start date").fill(fields.start);
  await dialog.getByLabel("Duration (months)").fill(fields.months);
  await dialog.getByLabel("Licences (members)").fill(fields.licences);
  await dialog.getByLabel("Price per licence per month (AED)").fill(fields.price);
  if (fields.total) await dialog.getByLabel("Total for the period (AED)").fill(fields.total);
  return dialog;
}

test("the Super Admin and the organisation's Admin share one billing schedule and export it", async ({
  page,
}) => {
  await signIn(page, "admin@playhub.local");
  await page.goto("/admin/orgs");
  // Without a schedule the card shows only the licence billing, with a way to start one.
  const sunrise = page.locator("article").filter({ hasText: "Sunrise Montessori" });
  await expect(sunrise.getByLabel("Billing schedule summary")).toHaveCount(0);
  await sunrise
    .getByRole("button", { name: "Start a billing schedule for Sunrise Montessori" })
    .click();
  const schedule = page.getByRole("dialog", { name: "Billing schedule for Sunrise Montessori" });
  await expect(schedule).toContainText("No billing periods yet");

  // Billing 1: 1 Jan for 4 months, an agreed total of AED 1,500.
  // Billing 1 starts from the organisation's licences and cycle.
  await page.getByRole("button", { name: "Add Billing 1", exact: true }).click();
  const prefilled = page.getByRole("dialog", { name: "Add Billing 1" });
  await expect(prefilled.getByLabel("Duration (months)")).toHaveValue("12");
  await expect(prefilled.getByLabel("Licences (members)")).toHaveValue("40");
  await prefilled.getByRole("button", { name: "Cancel" }).click();
  let dialog = await addPeriod(page, 1, {
    start: "2026-01-01",
    months: "4",
    licences: "10",
    price: "40",
    total: "1500",
  });
  await expect(dialog.getByLabel("Period summary")).toHaveText(
    "1st Jan, 2026 – 30th Apr, 2026 · 4 months · AED 1,500",
  );
  await dialog.getByRole("button", { name: "Add Billing 1" }).click();
  await expect(dialog).toBeHidden();

  // Billing 2 starts the day after Billing 1 ends; its total is worked out.
  dialog = await addPeriod(page, 2, { months: "6", licences: "10", price: "33.5" });
  await expect(dialog.getByLabel("Start date")).toHaveValue("2026-05-01");
  await expect(dialog).toContainText("the day after Billing 1 ends, or pick a later date");
  // It can't start before Billing 1 ends.
  await dialog.getByLabel("Start date").fill("2026-04-20");
  await dialog.getByRole("button", { name: "Add Billing 2" }).click();
  await expect(dialog.getByRole("alert")).toContainText("1st May, 2026 at the earliest");
  await dialog.getByLabel("Start date").fill("2026-05-01");
  await expect(dialog.getByLabel("Period summary")).toHaveText(
    "1st May, 2026 – 31st Oct, 2026 · 6 months · AED 2,010",
  );
  await dialog.getByRole("button", { name: "Add Billing 2" }).click();
  await expect(dialog).toBeHidden();
  await expect(schedule.getByRole("listitem", { name: "Billing 2", exact: true })).toContainText(
    "AED 2,010",
  );
  await expect(schedule).toContainText("10 months");
  await expect(schedule).toContainText("AED 3,510");
  await schedule.getByRole("button", { name: "List view" }).click();
  await expect(schedule.getByRole("row", { name: "Billing 2" })).toContainText("AED 2,010");
  await schedule.getByRole("button", { name: "Card view" }).click();

  // The organisation's Admin sees the same schedule and adds the renewal.
  await page.context().clearCookies();
  await page.evaluate(() => localStorage.clear());
  await signIn(page, "esther@sunrise.local");
  await page.goto("/dashboard");
  await page.getByRole("link", { name: "Billing", exact: true }).first().click();
  await expect(page.getByRole("listitem", { name: "Billing 1", exact: true })).toContainText(
    "AED 1,500",
  );
  await expect(page.getByRole("listitem", { name: "Billing 1", exact: true })).toContainText(
    "Added by Play Hub Admin",
  );
  // A period that has started is the Super Admin's to change.
  await expect(page.getByRole("button", { name: "Edit Billing 1" })).toHaveCount(0);
  dialog = await addPeriod(page, 3, { months: "12", licences: "12", price: "30" });
  await dialog.getByRole("button", { name: "Add Billing 3" }).click();
  await expect(page.getByRole("listitem", { name: "Billing 3", exact: true })).toContainText(
    "1st Nov, 2026 – 31st Oct, 2027",
  );
  await expect(page.getByRole("listitem", { name: "Billing 3", exact: true })).toContainText(
    "AED 4,320",
  );

  const [download] = await Promise.all([
    page.waitForEvent("download"),
    page.getByRole("button", { name: "Export to Excel" }).click(),
  ]);
  expect(download.suggestedFilename()).toMatch(/^billing-sunrise-montessori-.*\.xlsx$/);
  const file = readFileSync((await download.path())!);
  expect(file.subarray(0, 2).toString()).toBe("PK"); // an Excel (zip) file

  // Back as Super Admin: the Admin's period is there, and every organisation exports at once.
  await page.context().clearCookies();
  await page.evaluate(() => localStorage.clear());
  await signIn(page, "admin@playhub.local");
  await page.goto("/admin/orgs");
  await page.getByRole("button", { name: "Billing schedule for Sunrise Montessori" }).click();
  await expect(page.getByRole("listitem", { name: "Billing 3", exact: true })).toContainText(
    "Added by Esther Mwangi",
  );
  await page.getByRole("button", { name: "Close" }).click();
  // The organisation's card shows the schedule at a glance.
  const summary = page
    .locator("article")
    .filter({ hasText: "Sunrise Montessori" })
    .getByLabel("Billing schedule summary");
  await expect(summary).toContainText("3 periods");
  await expect(summary).toContainText("paid until 31st Oct, 2027");
  // The schedule replaces the licence price and renewal date for this organisation.
  const card = page.locator("article").filter({ hasText: "Sunrise Montessori" });
  await expect(card.getByRole("button", { name: "Record renewal" })).toHaveCount(0);
  await page.getByRole("button", { name: "List view" }).click();
  await expect(page.getByRole("listitem").filter({ hasText: "Sunrise Montessori" })).toContainText(
    "Paid until 31st Oct, 2027",
  );
  await page.getByRole("button", { name: "Card view" }).click();
  const [all] = await Promise.all([
    page.waitForEvent("download"),
    page.getByRole("button", { name: "Export billing" }).click(),
  ]);
  expect(all.suggestedFilename()).toMatch(/^billing-all-organisations-.*\.xlsx$/);
});

test("the organisation's Admin opens Billing from Account and comes back", async ({ page }) => {
  await signIn(page, "esther@sunrise.local");
  await page.goto("/account");
  await page.locator('main a[href*="from=account"]').click();
  await expect(page).toHaveURL(/\/org\/billing\?from=account/);
  await expect(page.getByRole("heading", { name: "Billing schedule" })).toBeVisible();
  await page.getByRole("link", { name: "Back to Account" }).click();
  await expect(page).toHaveURL(/\/account$/);
});
