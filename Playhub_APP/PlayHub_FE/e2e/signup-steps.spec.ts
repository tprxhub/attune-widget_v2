import { expect, test, type Page } from "@playwright/test";

/** The browser-test server makes every signup code this (SIGNUP_TEST_CODE). */
const CODE = "246810";

async function startWithEmail(page: Page, email: string) {
  await page.goto("/signup");
  await page.getByLabel("Email Address").fill(email);
  await page.getByRole("button", { name: "Get started" }).click();
  await expect(page.getByRole("heading", { name: "Check your email" })).toBeVisible();
}

test("signup verifies the email with a code, then account, child and a paid plan", async ({
  page,
}) => {
  const email = `steps.${Date.now()}@example.com`;
  await page.goto("/signup");
  await page.getByRole("button", { name: "Get started" }).click();
  await expect(page.getByText("Enter a valid email address.")).toBeVisible();

  await startWithEmail(page, email);
  await expect(page.getByText("Step 1 of 4")).toBeVisible();
  await expect(page.getByText(email)).toBeVisible();
  // This test server has no email provider, so it shows the code for testing.
  await expect(page.getByTestId("dev-code")).toContainText(CODE);

  // A wrong code is refused and cleared; the right one moves on.
  await page.getByLabel("Verification code").fill("111111");
  await page.getByRole("button", { name: "Verify email" }).click();
  await expect(page.getByText("That code isn't right")).toBeVisible();
  await expect(page.getByLabel("Verification code")).toHaveValue("");
  // Letters are ignored; only six digits fit.
  await page.getByLabel("Verification code").fill(`ab${CODE}99`);
  await expect(page.getByLabel("Verification code")).toHaveValue(CODE);
  await page.getByRole("button", { name: "Verify email" }).click();

  await expect(page.getByText("Step 2 of 4")).toBeVisible();
  await expect(page.getByLabel("Verified")).toBeVisible();
  await page.getByLabel("First Name", { exact: true }).fill("Sam");
  await page.getByLabel("Password", { exact: true }).fill("short");
  await page.getByRole("checkbox").check({ force: true });
  await page.getByRole("button", { name: "Next" }).click();
  await expect(page.getByText("Use at least 8 characters.")).toBeVisible();
  await page.getByLabel("Password", { exact: true }).fill("LongEnough123!");
  await page.getByRole("button", { name: "Next" }).click();

  await expect(page.getByText("Step 3 of 4")).toBeVisible();
  await page.getByLabel("Child's First Name").fill("Noor");
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page.getByText("Choose your child's age.")).toBeVisible();
  await page.getByRole("button", { name: "4", exact: true }).click();
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page.getByText("Step 4 of 4")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Choose your plan" })).toBeVisible();

  // Stripe is mocked: the chosen plan is sent for the new child.
  let sent: { plan?: string; child_id?: string } | null = null;
  await page.route("**/api/v1/billing/checkout", async (route) => {
    sent = route.request().postDataJSON();
    await route.fulfill({
      status: 201,
      json: { checkout_url: "/subscription?checkout=cancelled" },
    });
  });
  await expect(page.getByRole("radio", { checked: true })).not.toContainText("Free");
  await page.getByRole("button", { name: /^Pay AED .* securely/ }).click();
  await expect.poll(() => sent?.child_id).toBeTruthy();
  expect(sent!.plan).toMatch(/^\d+m$/);
  await expect(page).toHaveURL(/\/subscription\?checkout=cancelled/);
});

test("a new code can be sent after a short wait, and the email can be changed", async ({
  page,
}) => {
  const email = `resend.${Date.now()}@example.com`;
  await startWithEmail(page, email);
  await expect(page.getByText(/resend in \d+s/)).toBeVisible();
  await page.clock.install();
  await page.clock.fastForward(31_000);
  await page.getByRole("button", { name: "send a new code" }).click();
  await expect(page.getByRole("status")).toContainText("A new code is on its way");
  await page.getByRole("button", { name: "Change email" }).click();
  await expect(page.getByLabel("Email Address")).toHaveValue(email);
});

test("an email that already has an account is offered log in before any code", async ({ page }) => {
  await page.goto("/signup");
  await page.getByLabel("Email Address").fill("parent@playhub.local");
  await page.getByRole("button", { name: "Get started" }).click();
  const alert = page.getByRole("alert");
  await expect(alert).toContainText("already has a Play Hub account");
  await alert.getByRole("link", { name: "Log in instead" }).click();
  await expect(page).toHaveURL(/\/login/);
});
