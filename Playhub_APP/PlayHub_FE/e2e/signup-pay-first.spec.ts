import { expect, test, type Page } from "@playwright/test";

/** The browser-test server makes every signup code this (SIGNUP_TEST_CODE). */
const CODE = "246810";

async function verifyEmail(page: Page, email: string) {
  await page.getByLabel("Email Address").fill(email);
  await page.getByRole("button", { name: "Get started" }).click();
  await page.getByLabel("Verification code").fill(CODE);
  await page.getByRole("button", { name: "Verify email" }).click();
}

test("choosing a plan: verify the email, pay, then set up the account", async ({ page }) => {
  const email = `payfirst.${Date.now()}@example.com`;
  // Stripe is mocked: checkout returns straight to signup, and the payment confirms on the 2nd check.
  let token = "";
  let plan = "";
  await page.route("**/api/v1/billing/signup-checkout", async (route) => {
    const body = route.request().postDataJSON() as { email_token: string; plan: string };
    token = body.email_token;
    plan = body.plan;
    await route.fulfill({ status: 201, json: { checkout_url: "/signup?session_id=cs_e2e_paid" } });
  });
  let checks = 0;
  await page.route("**/api/v1/billing/signup-checkout/cs_e2e_paid", async (route) => {
    checks += 1;
    const paid = checks > 1;
    await route.fulfill({
      json: {
        status: paid ? "paid" : "pending",
        email,
        plan,
        plan_label: "Play Hub — 3-Month",
        amount_paid: 18900,
        ...(paid ? { email_token: token } : {}),
      },
    });
  });

  // The pricing section's button carries the plan into signup.
  await page.goto("/");
  await page.locator("#pricing").getByRole("link", { name: "Choose 3-month" }).click();
  await expect(page).toHaveURL(/\/signup\?plan=3m/);

  await verifyEmail(page, email);
  await expect(page.getByRole("heading", { name: "Confirm your plan" })).toBeVisible();
  await expect(page.getByText("Step 2 of 4")).toBeVisible();
  // The plan chosen on the pricing section is selected; it can still be changed.
  await expect(page.getByRole("radio", { checked: true })).toContainText("3-Month");
  // Signup lists what a paid plan includes in its own short words.
  for (const line of [
    "Activities for the week",
    "Log Sessions",
    "Progress charts",
    "Invite a Moderator",
    "Attune, your 24/7 play partner",
  ])
    await expect(page.getByText(line, { exact: true })).toBeVisible();
  await expect(page.getByText("Every activity video, unblurred")).toHaveCount(0);
  await page.getByRole("button", { name: /^Pay AED 189 securely/ }).click();

  await expect(page.getByRole("heading", { name: "Create your account" })).toBeVisible();
  expect(plan).toBe("3m");
  await expect(page.getByRole("status")).toContainText("Payment received");
  await expect(page.getByText("Step 3 of 4")).toBeVisible();
  await expect(page.getByText(email)).toBeVisible();
  await page.getByLabel("First Name", { exact: true }).fill("Paid");
  await page.getByLabel("Password", { exact: true }).fill("LongEnough123!");
  await page.getByRole("checkbox").check({ force: true });
  await page.getByRole("button", { name: "Next" }).click();

  await expect(page.getByText("Step 4 of 4")).toBeVisible();
  await page.getByLabel("Child's First Name").fill("Leo");
  await page.getByRole("button", { name: "7", exact: true }).click();
  await page.getByRole("button", { name: "Create account" }).click();
  // Paid already, so no plan step: straight into Play Hub.
  await expect(page).toHaveURL(/\/hub(?:[/?#]|$)/);
});

test("a cancelled payment comes back to the plan with the email still verified", async ({
  page,
}) => {
  const email = `cancel.${Date.now()}@example.com`;
  let calls = 0;
  await page.route("**/api/v1/billing/signup-checkout", async (route) => {
    calls += 1;
    await route.fulfill({ status: 201, json: { checkout_url: "/signup?checkout=cancelled" } });
  });
  await page.goto("/signup?plan=6m");
  await verifyEmail(page, email);
  await page.getByRole("button", { name: /^Pay .* securely/ }).click();
  await expect(page.getByRole("status")).toContainText("Payment cancelled");
  await expect(page.getByRole("heading", { name: "Confirm your plan" })).toBeVisible();
  await expect(page.getByText(email)).toBeVisible();
  // Paying again works without another code.
  await page.getByRole("button", { name: /^Pay .* securely/ }).click();
  await expect.poll(() => calls).toBe(2);
});

test("not ready to pay: start free goes on with the normal signup", async ({ page }) => {
  await page.goto("/signup?plan=6m");
  await verifyEmail(page, `free.${Date.now()}@example.com`);
  await page.getByRole("button", { name: "Start free instead" }).click();
  await expect(page.getByRole("heading", { name: "Create your account" })).toBeVisible();
  await expect(page.getByText("Step 2 of 4")).toBeVisible();
});

test("plain signup still verifies, then asks for details before any plan", async ({ page }) => {
  await page.goto("/signup");
  await verifyEmail(page, `normal.${Date.now()}@example.com`);
  await expect(page.getByRole("heading", { name: "Create your account" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Confirm your plan" })).toHaveCount(0);
});

test("without Stripe set up, paying explains itself", async ({ page }) => {
  await page.goto("/signup?plan=6m");
  await verifyEmail(page, `nostripe.${Date.now()}@example.com`);
  await page.getByRole("button", { name: /^Pay .* securely/ }).click();
  await expect(page.getByRole("alert")).toContainText("Stripe payments are not configured");
});

test("paying first: longest plan first and selected, and a coupon lowers the price", async ({
  page,
}) => {
  const API = "http://127.0.0.1:8765/api/v1";
  const login = await page.request.post(`${API}/auth/login`, {
    data: { email: "admin@playhub.local", password: "ChangeMe123!" },
  });
  const headers = { Authorization: `Bearer ${(await login.json()).access_token}` };
  const created = await page.request.post(`${API}/billing/discounts`, {
    headers,
    data: {
      code: "E2ESIGNUP10",
      title: "Ten off",
      description: "",
      kind: "percent",
      value: 10,
      plans: [],
      once_per_account: true,
    },
  });
  const couponId = (await created.json()).id as string;
  let sent: { plan?: string; discount_code?: string } | null = null;
  await page.route("**/api/v1/billing/signup-checkout", async (route) => {
    sent = route.request().postDataJSON();
    await route.fulfill({ status: 201, json: { checkout_url: "/signup?checkout=cancelled" } });
  });
  try {
    await page.goto("/signup?plan=99m"); // an unknown plan falls back to the longest
    await verifyEmail(page, `coupon.${Date.now()}@example.com`);
    const plans = page.getByRole("radio");
    const months = (await plans.allTextContents()).map((text) =>
      Number(text.match(/(\d+)-Month/)?.[1]),
    );
    expect(months).toEqual([...months].sort((a, b) => b - a));
    await expect(plans.first()).toHaveAttribute("aria-checked", "true");

    const offers = page.getByRole("region", { name: /Offers & coupons/ });
    await offers.getByLabel("Coupon code").fill("NOTREAL");
    await offers.getByRole("button", { name: "Apply", exact: true }).click();
    await expect(offers.getByRole("alert")).toContainText("isn’t valid");
    await offers.getByLabel("Coupon code").fill("e2esignup10");
    await offers.getByRole("button", { name: "Apply", exact: true }).click();
    await expect(offers).toContainText("E2ESIGNUP10 applied");
    await expect(page.getByText("Coupon (E2ESIGNUP10)")).toBeVisible();
    await page.getByRole("button", { name: /^Pay AED .* securely/ }).click();
    await expect.poll(() => sent?.discount_code).toBe("E2ESIGNUP10");
  } finally {
    await page.request.delete(`${API}/billing/discounts/${couponId}`, { headers });
  }
});
