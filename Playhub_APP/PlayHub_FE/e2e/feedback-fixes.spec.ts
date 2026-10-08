import { expect, test, type Page } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    const getItem = Storage.prototype.getItem;
    Storage.prototype.getItem = function (key: string) {
      return key.startsWith("playhub:navigation-tour:") ? "complete" : getItem.call(this, key);
    };
  });
});

async function login(page: Page, email: string, organisation = false) {
  await page.goto("/login");
  if (organisation) await page.getByRole("tab", { name: "School / clinic" }).click();
  await page.getByLabel("Email Address").fill(email);
  await page.getByLabel("Password", { exact: true }).fill("ChangeMe123!");
  await page.getByRole("button", { name: "Log in", exact: true }).click();
  await expect(page).toHaveURL(/\/(dashboard|admin|org)/);
}

test("session edits persist without adding another session", async ({ page }) => {
  await login(page, "parent@playhub.local");
  await page.goto("/check-in");
  await page.getByRole("button", { name: "Edit session", exact: true }).first().click();
  const dialog = page.getByRole("dialog", { name: "Edit session", exact: true });
  await dialog
    .getByLabel("Big Win", { exact: true })
    .fill("Corrected session note from feedback test.");
  await dialog.getByRole("button", { name: "Save changes", exact: true }).click();
  await expect(dialog).not.toBeVisible();
  await page.reload();
  await expect(
    page.getByText("Corrected session note from feedback test.", { exact: true }),
  ).toBeVisible();
});

test("Play Plan details can be edited and survive a reload", async ({ page }) => {
  await login(page, "admin@playhub.local");
  await page.goto("/admin/plans");
  await page.getByRole("button", { name: "Edit Play Plan", exact: true }).first().click();
  const dialog = page.getByRole("dialog", { name: "Edit Play Plan", exact: true });
  await dialog.getByLabel("Name", { exact: true }).fill("Updated plan from feedback");
  await dialog.getByRole("button", { name: "Save Play Plan", exact: true }).click();
  await expect(dialog).not.toBeVisible();
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Updated plan from feedback", exact: true }),
  ).toBeVisible();
});

test("Start guide ends with a clear session logging goal", async ({ page }) => {
  await login(page, "parent@playhub.local");
  await page.getByRole("button", { name: "Start navigation guide", exact: true }).click();
  const guide = page.getByRole("dialog", { name: "Play Hub navigation guide" });
  await expect(
    guide.getByText("Your goal: log your first session.", { exact: true }),
  ).toBeVisible();
  while (await guide.getByRole("button", { name: "Next", exact: true }).count()) {
    await guide.getByRole("button", { name: "Next", exact: true }).click();
  }
  await guide.getByRole("button", { name: "Log your first session", exact: true }).click();
  await expect(guide).not.toBeVisible();
  await expect(page).toHaveURL(/\/check-in$/);
});

test("Progress exports the displayed graphs and insights as a printable PDF report", async ({
  page,
  context,
}) => {
  await context.addInitScript(() => {
    window.print = () => {};
  });
  await login(page, "parent@playhub.local");
  await page.goto("/progress");
  await expect(page.getByRole("heading", { name: "What am I seeing?", exact: true })).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "What does it mean?", exact: true }),
  ).toBeVisible();
  await expect(page.getByRole("heading", { name: "How it felt", exact: true })).toHaveCount(0);
  await expect(page.locator("svg[viewBox]").first()).toBeVisible();
  const popupPromise = page.waitForEvent("popup");
  await page.getByRole("button", { name: "Export report (PDF)", exact: true }).click();
  const report = await popupPromise;
  await expect(report.getByRole("heading", { name: "Play Progress", exact: true })).toBeVisible();
  await expect(
    report.getByRole("heading", { name: "What does it mean?", exact: true }),
  ).toBeVisible();
  await expect(report.getByRole("heading", { name: "Session history", exact: true })).toHaveCount(
    0,
  );
  await expect(report.locator("svg[viewBox]").first()).toBeVisible();
  const pdf = await report.pdf({
    path: "/tmp/playhub-progress-feedback.pdf",
    printBackground: true,
  });
  expect(pdf.subarray(0, 4).toString()).toBe("%PDF");
  await report.close();
});

test("Account shows children in a dropdown and puts account actions in Preferences", async ({
  page,
}) => {
  await login(page, "esther@sunrise.local", true);
  await page.goto("/account");
  const children = page
    .locator("details")
    .filter({ has: page.locator("summary", { hasText: /^Children/ }) });
  await expect(children).not.toHaveAttribute("open", "");
  await children.locator("summary").click();
  await expect(children.locator("li").first()).toBeVisible();
  await expect(page.getByRole("heading", { name: "Jump back in", exact: true })).toHaveCount(0);
  const preferences = page.getByRole("region", { name: "Preferences", exact: true });
  await expect(preferences.getByRole("button", { name: /Navigation guide/ })).toBeVisible();
  await preferences.getByRole("button", { name: /Change password/ }).click();
  await expect(page.getByRole("dialog").filter({ hasText: "Change password" })).toBeVisible();
});

test("Disabling a moderator requires confirmation and Cancel makes no changes", async ({
  page,
}) => {
  await login(page, "esther@sunrise.local", true);
  await page.goto("/org/supporters");
  let writes = 0;
  page.on("request", (request) => {
    if (request.method() === "PATCH" && request.url().includes("/users/")) writes++;
  });
  await page.getByRole("button", { name: "Disable account", exact: true }).first().click();
  const confirm = page.getByRole("dialog", { name: /^Disable / });
  await expect(confirm).toBeVisible();
  expect(writes).toBe(0);
  await confirm.getByRole("button", { name: "Cancel", exact: true }).click();
  await expect(confirm).not.toBeVisible();
  expect(writes).toBe(0);
  await page.getByRole("button", { name: "Disable account", exact: true }).first().click();
  await confirm.getByRole("button", { name: "Disable account", exact: true }).click();
  await expect(confirm).not.toBeVisible();
  expect(writes).toBe(1);
  await expect(page.getByRole("button", { name: "Re-enable account", exact: true })).toBeVisible();
});

test("Play Pulse recommendation opens its matching Play Plan", async ({ page }) => {
  await login(page, "parent@playhub.local");
  await page.evaluate(() =>
    localStorage.setItem(
      "playhub:play-pulse:v1",
      JSON.stringify({
        screen: "results",
        childName: "Kai",
        band: "preschool",
        goalId: "button-shirt",
        domainIndex: 3,
        answers: { Sensory: [65, 65], Motor: [65, 65], Cognition: [65, 65], Engagement: [65, 65] },
      }),
    ),
  );
  await page.goto("/play-pulse");
  const plan = page.getByRole("link", { name: "Start Play Plan" });
  await expect(plan).toHaveAttribute("href", /^\/plans\/[^/]+$/);
  await plan.click();
  await expect(page).toHaveURL(/\/plans\/[^/]+$/);
  await expect(
    page.getByRole("heading", { name: "Learn to Button a Shirt — Starter", exact: true }).first(),
  ).toBeVisible();
});
