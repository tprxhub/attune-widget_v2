import { expect, test, type Page } from "@playwright/test";

const API = "http://127.0.0.1:8765/api/v1";
const SHOTS = process.env.PULSE_SHOTS;

async function tokenFor(page: Page, email: string) {
  const response = await page.request.post(`${API}/auth/login`, {
    data: { email, password: "ChangeMe123!" },
  });
  return (await response.json()).access_token as string;
}

async function signIn(page: Page, email: string) {
  const token = await tokenFor(page, email);
  await page.addInitScript((token) => {
    localStorage.setItem("playhub_access_token", token);
    const original = Storage.prototype.getItem;
    Storage.prototype.getItem = function (key) {
      return key.startsWith("playhub:navigation-tour:") ? "complete" : original.call(this, key);
    };
  }, token);
}

/** Answer every question with its first option and return when the last domain is done. */
async function takeCheck(page: Page, child: string) {
  await page.goto("/play-pulse");
  await page.getByPlaceholder("e.g. Zayd").fill(child);
  await page.getByRole("button", { name: /Preschooler/ }).click();
  await page.getByRole("button", { name: /Choose a goal/ }).click();
  await page.getByRole("button", { name: /Colour Inside the Lines/ }).click();
  await page.getByRole("button", { name: /Start the quick check/ }).click();
  for (let domain = 0; domain < 4; domain++) {
    const questions = page.locator("main h2");
    await expect(questions).toHaveCount(2);
    for (let question = 0; question < 2; question++) {
      await questions
        .nth(question)
        .locator("xpath=following-sibling::div[1]//button")
        .first()
        .click();
    }
    // Scroll down before moving on: the next step must open at the top.
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(100);
    await page
      .getByRole("button", { name: domain === 3 ? /See Support Score/ : /Next domain/ })
      .click();
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(0);
  }
}

/** Choose an option from one of the app's dropdowns. */
async function pick(page: Page, label: string, option: string | RegExp) {
  await page.getByRole("button", { name: label, exact: true }).click();
  await page.getByRole("option", { name: option }).click();
}

async function adminRows(page: Page, query: string) {
  const token = await tokenFor(page, "admin@playhub.local");
  const response = await page.request.get(
    `${API}/admin/play-pulse/results?q=${encodeURIComponent(query)}`,
    { headers: { Authorization: `Bearer ${token}` } },
  );
  expect(response.ok()).toBe(true);
  return (await response.json()).items as { name: string; source: string; phone: string | null }[];
}

test("a guest fills the form once, sees the Progress-style result, and is saved", async ({
  page,
}) => {
  const email = `guest-${Date.now()}@example.com`;
  await page.setViewportSize({ width: 1440, height: 900 });
  await takeCheck(page, "Noor");

  const form = page.locator("form").filter({ hasText: "Show My Child’s Score" });
  await expect(form).toBeVisible();
  await expect(page.getByRole("button", { name: /Sign in with Google/ })).toHaveCount(0);
  await form.getByRole("button", { name: /Unlock My Child’s Score/ }).click();
  await expect(form.getByText("Please enter your name.")).toBeVisible();
  await expect(form.getByText(/valid phone number/)).toBeVisible();
  await expect(form.getByText(/valid email address/)).toBeVisible();

  await form.getByLabel(/Your name/).fill("Guest Parent");
  await form.getByLabel(/Phone number/).fill("+971 50 765 4321");
  await form.getByLabel(/Email/).fill(email);
  await form.getByRole("button", { name: /Unlock My Child’s Score/ }).click();

  await expect(page.getByText("Play Pulse result", { exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Noor", exact: true })).toBeVisible();
  await expect(page.getByText(/Celebrating Noor!/)).toBeVisible();
  await expect(page.getByText(/Independence Score: \d+%/)).toBeVisible();
  await expect(page.getByText("Saved for Guest Parent.")).toBeVisible();
  await expect(page.getByRole("link", { name: /Start the Play Plan free/ })).toHaveAttribute(
    "href",
    "/signup",
  );
  await expect(page.getByText(/Could not load this Play Plan/)).toHaveCount(0);
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/pulse-result-1440.png`, fullPage: true });

  await expect.poll(async () => (await adminRows(page, email)).length).toBe(1);
  const [row] = await adminRows(page, email);
  expect(row).toMatchObject({ name: "Guest Parent", source: "guest", phone: "+971 50 765 4321" });

  // A second check goes straight to the result and is saved under the same person.
  await page.getByRole("button", { name: /Start a new check/ }).click();
  await page.getByRole("button", { name: "Start new check", exact: true }).click();
  await takeCheck(page, "Omar");
  await expect(page.getByRole("heading", { name: "Omar", exact: true })).toBeVisible();
  await expect.poll(async () => (await adminRows(page, email)).length).toBe(2);

  // Revisiting the same result does not save it again.
  await page.reload();
  await expect(page.getByRole("heading", { name: "Omar", exact: true })).toBeVisible();
  await page.waitForTimeout(500);
  expect((await adminRows(page, email)).length).toBe(2);
});

test("the result card fits a phone", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 800 });
  await page.addInitScript(() =>
    localStorage.setItem(
      "playhub:play-pulse:contact",
      JSON.stringify({ name: "Phone Parent", email: "phone@example.com", phone: "+971500000000" }),
    ),
  );
  await takeCheck(page, "Lina");
  await expect(page.getByRole("heading", { name: "Lina", exact: true })).toBeVisible();
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth),
  ).toBeLessThanOrEqual(1);
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/pulse-result-375.png`, fullPage: true });
});

test("signed-in people skip the form and appear with their role", async ({ page }) => {
  await signIn(page, "parent@playhub.local");
  await page.setViewportSize({ width: 1280, height: 900 });
  const before = (await adminRows(page, "parent@playhub.local")).length;
  await takeCheck(page, "Kai");
  await expect(page.locator("form").filter({ hasText: "Show My Child’s Score" })).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "Kai", exact: true })).toBeVisible();
  await expect
    .poll(async () => (await adminRows(page, "parent@playhub.local")).length)
    .toBe(before + 1);
  const [row] = await adminRows(page, "parent@playhub.local");
  expect(row?.source).toBe("admin");
  expect(row?.phone).toBeNull();
});

test("the Super Admin searches, filters, pages and exports the leads", async ({ page }) => {
  const token = await tokenFor(page, "admin@playhub.local");
  // Enough guests for two pages of ten.
  for (let i = 0; i < 12; i++) {
    const response = await page.request.post(`${API}/play-pulse/results`, {
      data: {
        contact: {
          name: `Lead ${i}`,
          email: `lead-${i}-${Date.now()}@example.com`,
          phone: `+971 55 000 00${String(i).padStart(2, "0")}`,
        },
        child_name: `Child ${i}`,
        age_band: i % 2 ? "toddler" : "school",
        goal_id: i % 3 ? "reading" : "scissors",
        support_score: 30,
        tier: "ontrack",
        areas_on_track: 4,
        areas_assessed: 4,
        domain_tiers: {
          Sensory: "ontrack",
          Motor: "ontrack",
          Cognition: "ontrack",
          Engagement: "ontrack",
        },
        answers: { Sensory: [90, 90], Motor: [90, 90], Cognition: [90, 90], Engagement: [90, 90] },
      },
    });
    expect(response.status()).toBe(201);
  }
  await signIn(page, "admin@playhub.local");
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/admin");
  await page.getByRole("link", { name: "Play Pulse leads" }).first().click();
  await expect(page).toHaveURL(/\/admin\/play-pulse$/);

  const table = page.getByRole("region", { name: "Play Pulse results" });
  await expect(table.locator("tbody tr")).toHaveCount(10);
  await expect(page.getByRole("navigation", { name: "Pagination" })).toContainText(/1–10 of/);
  await page.getByRole("button", { name: "Next page" }).click();
  await expect(page.getByRole("button", { name: "Page 2" })).toHaveAttribute(
    "aria-current",
    "page",
  );

  await pick(page, "Rows per page", "50");
  await expect(page.getByRole("button", { name: "Page 1" })).toHaveAttribute(
    "aria-current",
    "page",
  );

  await page.getByPlaceholder("Search name, email or phone").fill("Lead 7");
  await expect(table.locator("tbody tr")).toHaveCount(1);
  await expect(table).toContainText("Child 7");
  await page.getByPlaceholder("Search name, email or phone").fill("55 000 0007");
  await expect(table.locator("tbody tr")).toHaveCount(1);

  await page.getByRole("button", { name: /Clear filters/ }).click();
  await pick(page, "Goal", "Learn to Use Scissors");
  await pick(page, "Age", /School Age/);
  await expect(table.locator("tbody tr").first()).toContainText("Learn to Use Scissors");
  const rows = table.locator("tbody tr");
  await expect(rows.filter({ hasNotText: "Learn to Use Scissors" })).toHaveCount(0);
  await expect(rows.filter({ hasNotText: "School Age" })).toHaveCount(0);
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/pulse-admin-1440.png`, fullPage: true });

  await page.getByRole("button", { name: "Export" }).click();
  const [download] = await Promise.all([
    page.waitForEvent("download"),
    page.getByRole("menuitem", { name: /Export filtered results/ }).click(),
  ]);
  expect(download.suggestedFilename()).toMatch(/^play-pulse-filtered-.*\.csv$/);
  const csv = await (await download.createReadStream()).toArray();
  const text = Buffer.concat(csv).toString("utf8");
  expect(text).toContain("Learn to Use Scissors");
  expect(text).not.toContain("Make Reading Easy");

  await page.getByRole("button", { name: "Export" }).click();
  const [all] = await Promise.all([
    page.waitForEvent("download"),
    page.getByRole("menuitem", { name: /Export everything/ }).click(),
  ]);
  expect(all.suggestedFilename()).toMatch(/^play-pulse-all-.*\.csv$/);

  // Other roles can't open the page or the API.
  const parent = await tokenFor(page, "parent@playhub.local");
  const denied = await page.request.get(`${API}/admin/play-pulse/results`, {
    headers: { Authorization: `Bearer ${parent}` },
  });
  expect(denied.status()).toBe(403);
  expect(token).toBeTruthy();
});
