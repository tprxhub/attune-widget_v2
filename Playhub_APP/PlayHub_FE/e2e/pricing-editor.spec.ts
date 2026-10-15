import { signIn } from "./support/signIn";
import { expect, test } from "@playwright/test";

test("Super Admin publishes up to five subscription plans and image dimensions", async ({
  page,
  browser,
}) => {
  await signIn(page, "admin@playhub.local");
  await page.goto("/admin/homepage");
  await page.getByRole("button", { name: "Image dimensions", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Image dimensions", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Subscription pricing", exact: true }).click();
  const pricing = page.getByRole("region", { name: "Subscription pricing", exact: true });
  await expect(
    pricing.getByRole("group", { name: "Plan 1", exact: true }).getByLabel("Duration (months)"),
  ).toHaveValue("1");
  await expect(page.locator("#home-section-hero")).toContainText("1080 × 1920 px");
  await expect(page.locator("#home-section-hero")).toContainText("2400 × 1600 px");

  await pricing.getByRole("button", { name: /Add subscription plan/ }).click();
  const fourth = pricing.getByRole("group", { name: "Plan 4", exact: true });
  await fourth.getByLabel("Duration (months)").fill("3");
  await fourth.getByLabel("Total price (AED)").fill("499.50");
  await expect(pricing.getByRole("alert")).toContainText("different month duration");
  await expect(pricing.getByRole("button", { name: "Save pricing", exact: true })).toBeDisabled();
  await fourth.getByLabel("Duration (months)").fill("9");
  await fourth.getByLabel("Plan name").fill("9-Month family plan");
  await fourth.getByLabel("Show badge", { exact: true }).check();
  await fourth.getByLabel("Badge text", { exact: true }).fill("Most popular");
  await pricing
    .getByRole("group", { name: "Plan 3", exact: true })
    .getByLabel("Badge text", { exact: true })
    .fill("Popular Value");
  await expect(
    pricing
      .getByRole("group", { name: "Plan 3", exact: true })
      .getByLabel("Show badge", { exact: true }),
  ).toBeChecked();

  await pricing.getByRole("button", { name: /Add subscription plan/ }).click();
  const fifth = pricing.getByRole("group", { name: "Plan 5", exact: true });
  await fifth.getByLabel("Duration (months)").fill("12");
  await fifth.getByLabel("Total price (AED)").fill("579");
  await fifth.getByLabel("Plan name").fill("12-Month");
  await expect(pricing.getByRole("button", { name: /Add subscription plan/ })).toBeDisabled();
  await pricing.getByRole("button", { name: "Save pricing", exact: true }).click();
  await expect(pricing.getByRole("status")).toContainText("Pricing saved.");
  await page.reload();
  await page.getByRole("button", { name: "Subscription pricing", exact: true }).click();
  await expect(
    pricing.getByRole("group", { name: "Plan 4", exact: true }).getByLabel("Total price (AED)"),
  ).toHaveValue("499.5");
  await expect(pricing.getByRole("group", { name: /^Plan \d+$/ })).toHaveCount(5);

  const context = await browser.newContext();
  const visitor = await context.newPage();
  await visitor.goto("/");
  const publicPricing = visitor.locator("#pricing");
  await expect(
    publicPricing.getByRole("heading", { name: "9-Month family plan", exact: true }),
  ).toBeVisible();
  await expect(publicPricing).toContainText("AED 499.50");
  await expect(publicPricing.getByText("Most popular", { exact: true })).toBeVisible();
  await expect(publicPricing.getByText("Popular Value", { exact: true })).toBeVisible();
  await expect(publicPricing.locator("article")).toHaveCount(6); // Free plus five paid plans.
  for (const width of [375, 768, 1440]) {
    await visitor.setViewportSize({ width, height: 900 });
    await publicPricing.scrollIntoViewIfNeeded();
    expect(
      await visitor.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
    ).toBe(true);
    await visitor.screenshot({ path: `test-results/pricing-${width}.png`, fullPage: false });
  }
  await signIn(visitor, "free.parent@playhub.local");
  await visitor.goto("/");
  await visitor
    .locator("#pricing")
    .getByRole("link", { name: /Choose 9-month family plan/ })
    .click();
  await expect(visitor).toHaveURL(/\/subscription\?plan=9m/);
  await expect(visitor.getByText("Most popular", { exact: true })).toBeVisible();
  await expect(visitor.getByText("Popular Value", { exact: true })).toBeVisible();
  await expect(visitor.getByRole("button", { name: /9-Month family plan/ })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await expect(visitor.getByRole("button", { name: /Subscribe .*AED 499.50/ })).toBeEnabled();
  let selected: unknown;
  await visitor.route("**/api/v1/billing/checkout", async (route) => {
    selected = route.request().postDataJSON();
    await route.fulfill({
      status: 201,
      contentType: "application/json",
      body: JSON.stringify({
        checkout_url: "http://127.0.0.1:4174/subscription?checkout=cancelled",
      }),
    });
  });
  await visitor.getByRole("button", { name: /Subscribe .*AED 499.50/ }).click();
  await expect(visitor).toHaveURL(/checkout=cancelled/);
  expect(selected).toMatchObject({ plan: "9m" });
  await context.close();

  // Restore the default catalogue so subsequent tests see the standard choices.
  await pricing
    .getByRole("group", { name: "Plan 3", exact: true })
    .getByLabel("Badge text", { exact: true })
    .fill("Best value");
  await pricing.getByRole("button", { name: "Remove plan 5", exact: true }).click();
  await pricing.getByRole("button", { name: "Remove plan 4", exact: true }).click();
  await pricing
    .getByRole("group", { name: "Plan 3", exact: true })
    .getByLabel("Show badge", { exact: true })
    .check();
  await pricing.getByRole("button", { name: "Save pricing", exact: true }).click();
  await expect(pricing.getByRole("status")).toContainText("Pricing saved.");
});
