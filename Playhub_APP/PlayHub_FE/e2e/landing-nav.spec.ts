import { expect, test } from "@playwright/test";

test.use({ viewport: { width: 1440, height: 900 } });

test("header links scroll to their section on the home page", async ({ page }) => {
  await page.goto("/");
  await page.waitForLoadState("networkidle");
  const nav = page.getByRole("navigation", { name: "Main" });

  for (const [label, id] of [
    ["Play Plans", "play-plans"],
    ["Progress", "progress"],
    ["Pricing", "pricing"],
  ] as const) {
    await nav.getByRole("link", { name: label }).click();
    await expect(page).toHaveURL(new RegExp(`/#${id}$`));
    // Wait for the smooth scroll to finish, then the section must be at the top of the page.
    await expect
      .poll(
        async () =>
          page.locator(`#${id}`).evaluate((el) => Math.round(el.getBoundingClientRect().top)),
        {
          timeout: 5000,
        },
      )
      .toBeLessThan(120);
    await expect(nav.getByRole("link", { name: label })).toHaveAttribute(
      "aria-current",
      "location",
    );
  }

  // The Pricing section shows the real prices, not just links.
  await page.goto("/#pricing");
  const pricing = page.locator("#pricing");
  await expect(pricing.getByRole("heading", { name: "Simple pricing, per child" })).toBeVisible();
  for (const price of ["AED 0", "AED 189", "AED 339", "AED 579"]) await expect(pricing).toContainText(price);
  await expect(pricing.getByRole("link", { name: /Choose 12-month/ })).toBeVisible();

  // Play Pulse is a separate page, not a section.
  await nav.getByRole("link", { name: "Play Pulse" }).click();
  await expect(page).toHaveURL(/\/play-pulse$/);
});
