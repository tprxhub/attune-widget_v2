import { expect, test } from "@playwright/test";
import { signIn } from "./support/signIn";

test("Super Admin opens a member's progress graph from the Progress page", async ({ page }) => {
  await signIn(page, "admin@playhub.local");
  await page.goto("/admin/progress");
  const row = page.locator("li[id^=child-] > button").filter({ hasText: "Maya" });
  await row.click();
  // One count of check-ins, whatever page they were logged from.
  const details = page.locator("li[id^=child-]").filter({ hasText: "Maya" });
  await expect(details.getByText("Check-ins", { exact: true })).toBeVisible();
  await expect(details.getByText("Daily check-ins")).toHaveCount(0);
  await details.getByRole("button", { name: "View progress graph" }).click();
  const dialog = page.getByRole("dialog", { name: "Maya's progress" });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole("heading", { name: "Within a Play Plan" })).toBeVisible();
  await expect(dialog.getByRole("heading", { name: "Within a Play Dose" })).toBeVisible();
  await dialog.getByRole("button", { name: "Close" }).click();
  await expect(dialog).toHaveCount(0);
});

test("on a phone each member row keeps the name readable", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await signIn(page, "admin@playhub.local");
  await page.goto("/admin/progress");
  const name = page
    .locator("li[id^=child-] > button")
    .filter({ hasText: "Amira" })
    .getByText("Amira", { exact: true });
  await expect(name).toBeVisible();
  // The name isn't squeezed into an ellipsis next to the status.
  expect(await name.evaluate((el) => el.scrollWidth <= el.clientWidth)).toBe(true);
});
