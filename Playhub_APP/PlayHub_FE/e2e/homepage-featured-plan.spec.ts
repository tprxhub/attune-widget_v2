import { expect, test } from "@playwright/test";
import { snapshotHomepage } from "./support/homepageSnapshot";
import { signIn } from "./support/signIn";

test("the Super Admin chooses the Featured focus Play Plan for the home page", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await signIn(page, "admin@playhub.local");
  const restore = await snapshotHomepage(page);
  try {
    await page.goto("/admin/homepage");
    await page
      .getByRole("navigation", { name: "Editor sections" })
      .getByRole("button", { name: "Skill areas", exact: true })
      .click();
    const picker = page.locator("#home-section-skills").getByLabel("Featured focus");
    // The default is the first Play Plan; every published Play Plan is offered.
    await expect(picker).toHaveValue("");
    const options = await picker.locator("option").allTextContents();
    expect(options.length).toBeGreaterThan(2);
    const chosen = options[2]!; // the second Play Plan in the library
    await picker.selectOption({ label: chosen });
    await page.getByRole("button", { name: "Save changes", exact: true }).click();
    await expect(page.getByRole("status")).not.toContainText("unsaved changes");

    await page.goto("/");
    const featured = page.locator("#play-plans").getByTestId("featured-plan");
    await expect(featured).toContainText(chosen);
    await expect(featured).toContainText("Featured focus");
    // It isn't repeated among the other cards.
    await expect(page.locator("#play-plans li").filter({ hasText: chosen })).toHaveCount(0);
  } finally {
    await restore();
  }
});
