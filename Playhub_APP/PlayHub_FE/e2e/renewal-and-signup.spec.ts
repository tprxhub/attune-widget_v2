import { expect, test, type Page } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  // These tests are not about the first-visit navigation guide, so mark it as seen.
  await page.addInitScript(() => {
    const getItem = Storage.prototype.getItem;
    Storage.prototype.getItem = function (key: string) {
      return key.startsWith("playhub:navigation-tour:") ? "complete" : getItem.call(this, key);
    };
  });
});

async function login(page: Page, email: string) {
  await page.goto("/login");
  await page.getByLabel("Email Address").fill(email);
  await page.getByLabel("Password", { exact: true }).fill("ChangeMe123!");
  await page.getByRole("button", { name: "Log in" }).click();
  await expect(page).toHaveURL(/\/(dashboard|org|admin)(?:[/?#]|$)/);
}

const isoInDays = (days: number) => {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
};

test("sign up buttons open the sign up page, and signed-in people skip log in and sign up", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("link", { name: "Sign up free" }).first().click();
  await expect(page).toHaveURL(/\/signup$/);
  await expect(page.getByRole("button", { name: "Create Account" })).toBeVisible();

  await login(page, "parent@playhub.local");
  await page.goto("/login");
  await expect(page).toHaveURL(/\/dashboard(?:[/?#]|$)/);
  await page.goto("/signup");
  await expect(page).toHaveURL(/\/dashboard(?:[/?#]|$)/);
});

test("the home page shows the real progress chart with sample data", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: /Every Play Dose, in one/ })).toBeVisible();
  await expect(page.getByText("Example only · sample data, not a real child")).toBeVisible();
  await expect(page.getByRole("region", { name: "Within a Play Plan" })).toBeVisible();
  await expect(page.getByRole("region", { name: "Within a Play Dose" })).toBeVisible();
});

test("a family sees the last day and a soft renewal reminder in the final days", async ({
  page,
}) => {
  const lastDay = isoInDays(5);
  // Pretend the subscription ends in five days; the server opens renewing in the last 14.
  await page.route("**/api/v1/children", async (route) => {
    try {
      const response = await route.fetch();
      const children = (await response.json()) as Array<{
        subscription: Record<string, unknown> | null;
      }>;
      for (const child of children) {
        if (child.subscription?.["status"] === "active") {
          child.subscription["ends_on"] = lastDay;
          child.subscription["renewal_open"] = true;
        }
      }
      await route.fulfill({ response, json: children });
    } catch {
      // The page navigated away while this request was in flight; nothing is waiting for it.
    }
  });

  await login(page, "parent@playhub.local");
  const reminder = page.getByRole("status", { name: /Subscription reminder for/ }).first();
  await expect(reminder).toContainText("subscription ends in 5 days");
  await reminder.getByRole("link", { name: "Renew subscription" }).click();

  await expect(page).toHaveURL(/\/subscription/);
  await expect(page.getByText("Last day of subscription")).toBeVisible();
  await expect(page.getByText("Ends in 5 days", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: /^Renew .*AED 339/ })).toBeEnabled();

  // Dismissing keeps it hidden for this stage.
  await page.goto("/dashboard");
  const reminders = page.getByRole("status", { name: /Subscription reminder for/ });
  await expect(reminders.first()).toBeVisible();
  const before = await reminders.count();
  await page.getByRole("button", { name: "Dismiss reminder" }).first().click();
  await page.reload();
  await expect(page.getByRole("heading", { name: "Here's your Play Hub" })).toBeVisible();
  await expect(reminders).toHaveCount(before - 1);
});
