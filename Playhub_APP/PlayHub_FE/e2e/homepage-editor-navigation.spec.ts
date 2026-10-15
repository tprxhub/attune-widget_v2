import { expect, test, type Page } from "@playwright/test";
import { signIn } from "./support/signIn";

async function chooseSection(page: Page, id: string, label: string) {
  const dropdown = page.getByLabel("Choose a section", { exact: true });
  if (await dropdown.isVisible()) await dropdown.selectOption(id);
  else
    await page
      .getByRole("navigation", { name: "Editor sections" })
      .getByRole("button", { name: label, exact: true })
      .click();
}

for (const width of [375, 768, 1440]) {
  test(`homepage editor shows one section and retains drafts at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await signIn(page, "admin@playhub.local");
    await page.goto("/admin/homepage");
    const headline = page.getByLabel("Headline, first line", { exact: true });
    await expect(headline).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Subscription pricing", exact: true }),
    ).not.toBeVisible();
    const original = await headline.inputValue();
    await headline.fill(`Unsaved draft at ${width}`);
    if (width < 640) {
      const save = await page
        .getByRole("button", { name: "Save changes", exact: true })
        .boundingBox();
      const bottomNav = await page
        .getByRole("navigation", { name: "Main", exact: true })
        .boundingBox();
      expect(save).not.toBeNull();
      expect(bottomNav).not.toBeNull();
      expect(save!.y + save!.height).toBeLessThanOrEqual(bottomNav!.y);
    }

    await chooseSection(page, "policy-privacy", "Privacy policy");
    await expect(headline).not.toBeVisible();
    await expect(
      page.locator("#home-section-policy-privacy").getByLabel("Page content", { exact: true }),
    ).toBeVisible();
    await chooseSection(page, "hero", "Top of the page");
    await expect(headline).toHaveValue(`Unsaved draft at ${width}`);
    await expect(page.getByRole("status")).toContainText("unsaved changes");
    await headline.fill(original);

    await chooseSection(page, "pricing", "Subscription pricing");
    const pricing = page.getByRole("region", { name: "Subscription pricing", exact: true });
    const badge = pricing
      .getByRole("group", { name: "Plan 1", exact: true })
      .getByLabel("Badge text", { exact: true });
    await badge.fill("Draft badge");
    await chooseSection(page, "dimensions", "Image dimensions");
    await expect(
      page.getByRole("heading", { name: "Image dimensions", exact: true }),
    ).toBeVisible();
    await expect(page.getByRole("button", { name: "Save changes", exact: true })).not.toBeVisible();
    await chooseSection(page, "pricing", "Subscription pricing");
    await expect(badge).toHaveValue("Draft badge");
    await pricing.getByRole("button", { name: "Discard pricing changes", exact: true }).click();

    await chooseSection(page, "hero", "Top of the page");
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
    ).toBe(true);
    await page.screenshot({ path: `test-results/home-editor-${width}.png`, fullPage: false });
  });
}
