import { expect, test } from "@playwright/test";
import { signIn } from "./support/signIn";

test("floating page search filters and opens a destination with the keyboard", async ({ page }) => {
  await page.addInitScript(() => {
    const getItem = Storage.prototype.getItem;
    Storage.prototype.getItem = function (key: string) {
      return key.startsWith("playhub:navigation-tour:") ? "complete" : getItem.call(this, key);
    };
  });
  await signIn(page, "parent@playhub.local");

  await page.getByRole("button", { name: "Search and navigate" }).click();
  const dialog = page.getByRole("dialog", { name: "Where would you like to go?" });
  const search = dialog.getByRole("searchbox", { name: "Search application pages" });
  await expect(search).toBeFocused();
  await search.fill("daily check");
  await expect(dialog.getByRole("option")).toHaveCount(1);
  await expect(dialog.getByRole("option", { name: /Daily Check-In/ })).toBeVisible();
  await search.press("ArrowDown");
  await search.press("Enter");

  await expect(page).toHaveURL(/\/check-in$/);
  await expect(page.getByRole("button", { name: "Search and navigate" })).toBeVisible();

  await page.getByRole("button", { name: "Search and navigate" }).click();
  const restrictedSearch = page.getByRole("searchbox", { name: "Search application pages" });
  await restrictedSearch.fill("admin");
  await expect(page.getByRole("option")).toHaveCount(0);
  await expect(page.getByText("No pages found")).toBeVisible();
});

test("floating page search fits and remains usable on a phone", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.addInitScript(() => {
    const getItem = Storage.prototype.getItem;
    Storage.prototype.getItem = function (key: string) {
      return key.startsWith("playhub:navigation-tour:") ? "complete" : getItem.call(this, key);
    };
  });
  await signIn(page, "parent@playhub.local");

  await expect
    .poll(() => page.evaluate(() => document.documentElement.scrollWidth - innerWidth))
    .toBeLessThanOrEqual(1);
  await page.getByRole("button", { name: "Search and navigate" }).click();
  const dialog = page.getByRole("dialog", { name: "Where would you like to go?" });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole("searchbox")).toBeFocused();
  await dialog.getByRole("searchbox").fill("progress");
  await expect(dialog.getByRole("option", { name: /Progress/ })).toBeVisible();
  await dialog.getByRole("button", { name: "Close search" }).click();
  await expect(dialog).toHaveCount(0);
});
