import { expect, test } from "@playwright/test";
import { signIn } from "./support/signIn";

const SHOTS = process.env["MENU_SHOTS"];

test("signed in, the home page header shows the avatar menu instead of a Sign out button", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await signIn(page, "parent@playhub.local");
  await page.goto("/", { waitUntil: "domcontentloaded" });
  const header = page.locator("header").first();
  await expect(header.getByRole("link", { name: "Open Hub" })).toBeVisible();
  await expect(header.getByRole("button", { name: "Sign out" })).toHaveCount(0);

  await header.getByRole("button", { name: "Your account" }).click();
  const menu = page.getByRole("menu", { name: "Your account" });
  await expect(menu).toBeVisible();
  await expect(menu.getByRole("menuitem", { name: "Play Hub Settings" })).toHaveAttribute(
    "href",
    "/account",
  );
  await expect(menu.getByRole("button", { name: "Sign out" })).toBeVisible();
  if (SHOTS) {
    await page.waitForTimeout(600);
    await page.screenshot({
      path: `${SHOTS}/home-account-menu-1440.png`,
      clip: { x: 900, y: 0, width: 540, height: 380 },
    });
  }

  await page.keyboard.press("Escape");
  await expect(menu).toHaveCount(0);

  // Sign out still asks first, and cancelling keeps you signed in with the menu open.
  await header.getByRole("button", { name: "Your account" }).click();
  await menu.getByRole("button", { name: "Sign out" }).click();
  const confirm = page.getByRole("alertdialog");
  await expect(confirm).toContainText("Sign out of Play Hub?");
  await confirm.getByRole("button", { name: "Cancel" }).click();
  await expect(menu).toBeVisible();
  await menu.getByRole("menuitem", { name: "Play Hub Settings" }).click();
  await expect(page).toHaveURL(/\/account$/);
});

test("on a phone the avatar stays out of the way and Sign out is in the menu", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 800 });
  await signIn(page, "parent@playhub.local");
  await page.goto("/", { waitUntil: "domcontentloaded" });
  const header = page.locator("header").first();
  await expect(header.getByRole("button", { name: "Your account" })).toBeHidden();
  await header.getByRole("button", { name: "Open menu" }).click();
  await expect(page.locator("#home-menu").getByRole("button", { name: "Sign out" })).toBeVisible();
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth),
  ).toBeLessThanOrEqual(1);
});
