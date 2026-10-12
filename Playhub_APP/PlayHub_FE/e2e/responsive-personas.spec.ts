import { expect, test, type Page } from "@playwright/test";

const API = "http://127.0.0.1:8765/api/v1";
const common = ["/dashboard", "/plans", "/progress", "/account"];
const personas: Array<[string, string, string[]]> = [
  [
    "Super Admin",
    "admin@playhub.local",
    [
      "/admin",
      "/admin/children",
      "/admin/progress",
      "/admin/audit",
      "/admin/plans",
      "/admin/homepage",
      "/admin/orgs",
      "/admin/educators",
      "/admin/ttp",
      "/org/enroll",
      "/plans",
      "/check-in",
      "/account",
    ],
  ],
  [
    "TTP employee",
    "ttp@playhub.local",
    ["/admin", "/admin/children", "/admin/progress", "/admin/audit", "/org/enroll", "/account"],
  ],
  [
    "School Admin",
    "esther@sunrise.local",
    [...common, "/org", "/org/supporters", "/org/enroll", "/check-in"],
  ],
  [
    "Clinic Admin",
    "daniel@brightsteps.local",
    [...common, "/org", "/org/supporters", "/org/enroll", "/check-in"],
  ],
  ["School Moderator", "moderator@playhub.local", [...common, "/org", "/check-in"]],
  ["Clinic Moderator", "supporter@brightsteps.local", [...common, "/org", "/check-in"]],
  ["Organisation Member", "hana@sunrise.local", common],
  [
    "Subscribed family",
    "parent@playhub.local",
    [...common, "/check-in", "/subscription", "/invite"],
  ],
  ["Family Moderator", "nanny@playhub.local", [...common, "/check-in"]],
  ["Free family", "free.parent@playhub.local", [...common, "/check-in", "/subscription"]],
];

async function authenticate(page: Page, email: string) {
  const response = await page.request.post(`${API}/auth/login`, {
    data: { email, password: "ChangeMe123!" },
  });
  expect(response.ok(), email).toBeTruthy();
  const { access_token: token } = await response.json();
  await page.addInitScript((accessToken) => {
    localStorage.setItem("playhub_access_token", accessToken);
    const original = Storage.prototype.getItem;
    Storage.prototype.getItem = function (key: string) {
      return key.startsWith("playhub:navigation-tour:") ? "complete" : original.call(this, key);
    };
  }, token);
  return { Authorization: `Bearer ${token}` };
}

async function expectFits(page: Page) {
  await expect
    .poll(() => page.evaluate(() => document.documentElement.scrollWidth - innerWidth), {
      message: "The page must fit the viewport without horizontal scrolling",
    })
    .toBeLessThanOrEqual(1);
}

for (const [persona, email, routes] of personas) {
  test(`${persona}: every permitted page fits phone, tablet and desktop and loads data`, async ({
    page,
  }) => {
    test.setTimeout(240_000);
    await authenticate(page, email);
    const errors: string[] = [];
    const failed: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    page.on("response", (response) => {
      if (response.url().startsWith(API) && response.status() >= 400)
        failed.push(`${response.status()} ${response.url()}`);
    });
    for (const width of [320, 390, 768, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      for (const route of routes) {
        await test.step(`${width}px ${route}`, async () => {
          await page.goto(route);
          await expect(page.locator("main h1").first()).toBeVisible();
          await page.waitForLoadState("networkidle");
          await expect(page.getByText("We couldn't load this page", { exact: true })).toHaveCount(
            0,
          );
          await expect(page.getByText("This page didn't load", { exact: true })).toHaveCount(0);
          await expectFits(page);
          expect(errors, `${persona} ${route}`).toEqual([]);
          expect(failed, `${persona} ${route}`).toEqual([]);
        });
      }
    }
  });
}

test("public pages fit phones, tablets and desktops", async ({ page }) => {
  test.setTimeout(120_000);
  for (const width of [320, 390, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    for (const path of [
      "/",
      "/login",
      "/signup",
      "/forgot-password",
      "/reset-password",
      "/accept-invite",
      "/play-pulse",
      "/policies/privacy-policy",
      "/policies/terms-of-service",
    ]) {
      await page.goto(path);
      await expect(page.locator("h1").first()).toBeVisible();
      await expectFits(page);
    }
  }
});

test("phone navigation exposes all permitted destinations and keeps focus inside its menu", async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 700 });
  await authenticate(page, "admin@playhub.local");
  await page.goto("/admin");
  await page.getByRole("button", { name: "More", exact: true }).click();
  const menu = page.getByRole("dialog", { name: "Your workspace" });
  await expect(menu).toBeVisible();
  await expect(menu.getByRole("button", { name: "Close navigation" })).toBeFocused();
  for (const label of [
    "Home page",
    "Organisations",
    "Admins & Moderators",
    "TTP Employees",
    "Account",
  ])
    await expect(menu.getByRole("link", { name: label, exact: true })).toBeVisible();
  await page.keyboard.press("Shift+Tab");
  await expect(menu.getByRole("link", { name: "Account", exact: true })).toBeFocused();
  await menu.getByRole("link", { name: "Plans library", exact: true }).click();
  await expect(page).toHaveURL(/\/admin\/plans/);
  await expect(menu).toHaveCount(0);
  await expectFits(page);
});

test("organisation cards show API session counts, activities and distinct skill areas", async ({
  page,
}) => {
  const headers = await authenticate(page, "esther@sunrise.local");
  const children = await (await page.request.get(`${API}/children`, { headers })).json();
  const plans = await (await page.request.get(`${API}/play-plans`, { headers })).json();
  await page.goto("/org");
  const goalByDose = new Map<string, string>(
    plans.flatMap((plan: { id: string; play_doses: Array<{ id: string }> }) =>
      plan.play_doses.map((dose) => [dose.id, plan.id]),
    ),
  );
  const areas = new Set(
    children
      .filter((child: { is_active: boolean }) => child.is_active)
      .map((child: { current_play_dose_id: string }) => goalByDose.get(child.current_play_dose_id))
      .filter(Boolean),
  );
  await expect(page.getByText("Skill areas in play", { exact: true }).locator("..")).toContainText(
    String(areas.size),
  );
  for (const child of children.filter((child: { is_active: boolean }) => child.is_active)) {
    const report = await (
      await page.request.get(`${API}/children/${child.id}/progress`, { headers })
    ).json();
    const card = page
      .locator("article")
      .filter({ has: page.getByRole("heading", { name: child.name, exact: true }) });
    await expect(
      card
        .locator("dl > div")
        .filter({ has: page.getByText("Sessions", { exact: true }) })
        .locator("dd"),
    ).toHaveText(String(report.total_attempts));
    await expect(
      card
        .locator("dl > div")
        .filter({ has: page.getByText("Activities", { exact: true }) })
        .locator("dd"),
    ).toHaveText(String(report.activities_completed));
  }
});

test("failed data requests show a retry state and recover without refreshing", async ({ page }) => {
  await authenticate(page, "parent@playhub.local");
  let unavailable = true;
  await page.route("**/api/v1/children/*/progress", (route) =>
    unavailable
      ? route.fulfill({ status: 503, json: { detail: "Temporarily unavailable" } })
      : route.continue(),
  );
  await page.goto("/progress");
  await expect(page.getByRole("heading", { name: "We couldn't load this page" })).toBeVisible();
  unavailable = false;
  await page.getByRole("button", { name: "Try again", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Progress", exact: true })).toBeVisible();
  await expect(page.getByRole("region", { name: "Within a Play Plan" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "We couldn't load this page" })).toHaveCount(0);
});

test("phone editors keep long forms within the screen and allow scrolling", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 740 });
  await authenticate(page, "admin@playhub.local");
  for (const [route, button] of [
    ["/admin/plans", "New Play Dose"],
    ["/admin/plans", "Edit Play Dose"],
    ["/admin/ttp", "Add TTP employee"],
  ]) {
    await page.goto(route);
    await page.getByRole("button", { name: button, exact: true }).first().click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    const bounds = await dialog.boundingBox();
    expect(bounds).not.toBeNull();
    expect(bounds!.x).toBeGreaterThanOrEqual(0);
    expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(320);
    expect(bounds!.y + bounds!.height).toBeLessThanOrEqual(740);
    await expectFits(page);
    expect(await dialog.evaluate((el) => el.scrollWidth <= el.clientWidth + 1)).toBeTruthy();
    await dialog.evaluate((el) => {
      el.scrollTop = el.scrollHeight;
    });
    expect(
      await dialog.evaluate((el) => (el.scrollHeight > el.clientHeight ? el.scrollTop > 0 : true)),
    ).toBeTruthy();
  }
});
