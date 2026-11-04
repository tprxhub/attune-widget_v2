import { expect, test, type Page } from "@playwright/test";
import { signIn } from "./support/signIn";

const API = "http://127.0.0.1:8765/api/v1";

async function adminHeaders(page: Page) {
  const login = await page.request.post(`${API}/auth/login`, {
    data: { email: "admin@playhub.local", password: "ChangeMe123!" },
  });
  return { Authorization: `Bearer ${(await login.json()).access_token}` };
}

test.afterEach(async ({ page }) => {
  const headers = await adminHeaders(page);
  const rows: { id: string; code: string }[] = await (
    await page.request.get(`${API}/billing/discounts`, { headers })
  ).json();
  for (const row of rows.filter((r) => r.code.startsWith("E2E")))
    await page.request.delete(`${API}/billing/discounts/${row.id}`, { headers });
});

test("the Super Admin creates a coupon and a family applies it at checkout", async ({ page }) => {
  await signIn(page, "admin@playhub.local");
  // Super Admin > Subscription > Discounts & coupons.
  await page.goto("/admin");
  await page.getByRole("link", { name: "Subscription", exact: true }).first().click();
  await expect(page.getByRole("tab", { name: "Plans & pricing" })).toHaveAttribute(
    "aria-selected",
    "true",
  );
  // The pricing tab links to the discounts tab, and the old address still works.
  await page.getByRole("link", { name: /Manage discounts/ }).click();
  await expect(page.getByRole("tab", { name: "Discounts & coupons" })).toHaveAttribute(
    "aria-selected",
    "true",
  );
  await page.goto("/admin/discounts");
  await expect(page).toHaveURL(/\/admin\/subscription\?tab=discounts/);

  await page.getByRole("button", { name: "New discount" }).click();
  const form = page.getByRole("dialog", { name: "New discount" });
  await form.getByLabel("Coupon code").fill("e2esave15");
  await form.getByLabel("Title").fill("Fifteen off");
  await form.getByLabel("Percentage off").fill("15");
  await form.getByRole("button", { name: "Create discount" }).click();
  await expect(form).toBeHidden();
  const card = page.getByRole("listitem", { name: "E2ESAVE15" });
  await expect(card).toContainText("15% off · Fifteen off");
  await expect(card).toContainText("Live");

  // A family on the free plan sees it, applies it and checks out with it.
  await page.context().clearCookies();
  await page.evaluate(() => localStorage.clear());
  await signIn(page, "free.parent@playhub.local");
  await page.waitForLoadState("networkidle"); // let the sign-in redirect finish first
  let sent: { plan: string; discount_code?: string } | null = null;
  await page.route("**/api/v1/billing/checkout", async (route) => {
    sent = route.request().postDataJSON();
    await route.fulfill({
      status: 201,
      json: { checkout_url: "/subscription?checkout=cancelled" },
    });
  });
  await page.goto("/subscription?plan=3m");
  const offers = page.getByRole("region", { name: /Offers & coupons/ });
  await expect(offers).toContainText("E2ESAVE15");
  await expect(offers).toContainText("Save AED 28.35 on this plan"); // 15% of AED 189

  // A wrong code explains itself.
  await offers.getByLabel("Coupon code").fill("NOTREAL");
  await offers.getByRole("button", { name: "Apply", exact: true }).click();
  await expect(offers.getByRole("alert")).toContainText("isn’t valid");

  await offers.getByRole("button", { name: "Apply E2ESAVE15" }).click();
  await expect(offers).toContainText("E2ESAVE15 applied");
  await expect(page.getByText("Coupon (E2ESAVE15)")).toBeVisible();
  await expect(page.getByText("You save AED 28.35 on this subscription")).toBeVisible();
  const buy = page.getByRole("button", { name: /Subscribe .* — AED 160\.65/ });
  await expect(buy).toBeVisible();
  await buy.click();
  await expect.poll(() => sent).toMatchObject({ plan: "3m", discount_code: "E2ESAVE15" });
  await page.waitForURL(/checkout=cancelled/); // the (mocked) checkout's return trip

  // Removing the coupon goes back to the full price.
  await page.goto("/subscription?plan=3m");
  await page.getByRole("button", { name: "Apply E2ESAVE15" }).click();
  await page.getByRole("button", { name: "Remove" }).click();
  await expect(page.getByRole("button", { name: /— AED 189$/ })).toBeVisible();
});

test("only a Super Admin sees the discounts page", async ({ page }) => {
  await signIn(page, "free.parent@playhub.local");
  await page.goto("/admin/discounts");
  await expect(page.getByRole("button", { name: "New discount" })).toHaveCount(0);
});
