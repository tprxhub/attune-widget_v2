import { expect, test, type Page } from "@playwright/test";

const PASSWORD = "ChangeMe123!";
const API = "16-192-12-132.sslip.io";

const personas: Array<{ email: string; organisation?: boolean; screens: Array<[string, string]>; blocked: string }> = [
  { email: "admin@playhub.local", blocked: "/subscription", screens: [
    ["/admin", "Platform overview"], ["/admin/children", "Children"], ["/check-in", "Daily Check-In"],
    ["/admin/progress", "Progress"], ["/admin/audit", "Audit log"],
    ["/plans", "Pick a Plan, pick a level, press play."], ["/admin/plans", "Play Plans library"],
    ["/admin/orgs", "Organisations"], ["/admin/educators", "Admins & Moderators"], ["/account", "My account"] ] },
  { email: "esther@sunrise.local", organisation: true, blocked: "/admin", screens: [
    ["/dashboard", "Here's your Play Hub"], ["/plans", "Pick a Plan, pick a level, press play."],
    ["/check-in", "Daily Check-In"], ["/progress", "Progress"], ["/org", "Children"],
    ["/org/supporters", "Moderators"], ["/account", "My account"] ] },
  { email: "moderator@playhub.local", organisation: true, blocked: "/org/supporters", screens: [
    ["/dashboard", "Here's your Play Hub"], ["/plans", "Pick a Plan, pick a level, press play."],
    ["/check-in", "Daily Check-In"], ["/progress", "Progress"], ["/org", "Children"], ["/account", "My account"] ] },
  { email: "hana@sunrise.local", organisation: true, blocked: "/org", screens: [
    ["/dashboard", "Here's your Play Hub"], ["/plans", "Pick a Plan, pick a level, press play."],
    ["/progress", "Progress"], ["/account", "My account"] ] },
  { email: "parent@playhub.local", blocked: "/org", screens: [
    ["/dashboard", "Here's your Play Hub"], ["/plans", "Pick a Plan, pick a level, press play."],
    ["/check-in", "Daily Check-In"], ["/progress", "Progress"], ["/subscription", "Subscription"],
    ["/invite", "Invite a Moderator"], ["/account", "My account"] ] },
  { email: "free.parent@playhub.local", blocked: "/admin", screens: [
    ["/dashboard", "Here's your Play Hub"], ["/plans", "Pick a Plan, pick a level, press play."],
    ["/check-in", "Daily Check-In"], ["/progress", "Progress"], ["/subscription", "Subscription"],
    ["/account", "My account"] ] },
];

function watch(page: Page) {
  const problems: string[] = [];
  page.on("pageerror", (e) => problems.push(`pageerror: ${e.message}`));
  page.on("console", (m) => { if (m.type() === "error") problems.push(`console: ${m.text().slice(0, 200)}`); });
  page.on("requestfailed", (r) => problems.push(`requestfailed: ${r.method()} ${r.url().slice(0, 120)} ${r.failure()?.errorText}`));
  page.on("response", (r) => {
    if (r.status() >= 400 && r.url().includes(API)) problems.push(`api ${r.status()}: ${r.request().method()} ${r.url().replace(/^https:\/\/[^/]+/, "").slice(0, 100)}`);
  });
  return problems;
}

test("public pages load and reach the API", async ({ page }) => {
  const problems = watch(page);
  for (const path of ["/", "/login", "/signup"]) {
    const res = await page.goto(path);
    expect(res?.status(), path).toBeLessThan(400);
  }
  console.log("public problems:", JSON.stringify(problems));
  expect(problems).toEqual([]);
});

for (const persona of personas) {
  test(`deployed: ${persona.email}`, async ({ page }) => {
    const problems = watch(page);
    await page.goto("/login");
    if (persona.organisation) await page.getByRole("tab", { name: "School / clinic" }).click();
    await page.getByLabel("Email Address").fill(persona.email);
    await page.getByLabel("Password", { exact: true }).fill(PASSWORD);
    await page.getByRole("button", { name: "Log in" }).click();
    await expect(page).toHaveURL(/\/(dashboard|org|admin)(?:[/?#]|$)/);
    const missing: string[] = [];
    for (const [path, heading] of persona.screens) {
      const res = await page.goto(path);
      if ((res?.status() ?? 0) >= 400) missing.push(`${path} -> HTTP ${res?.status()}`);
      try {
        await expect(page.getByRole("heading", { name: heading, exact: true }).first()).toBeVisible({ timeout: 15_000 });
      } catch { missing.push(`${path} heading "${heading}" not shown`); }
    }
    await page.goto(persona.blocked);
    try { await expect(page.getByRole("heading", { name: /Not available|Not part/ })).toBeVisible({ timeout: 10_000 }); }
    catch { missing.push(`${persona.blocked} should be blocked`); }
    console.log(`${persona.email} problems:`, JSON.stringify([...missing, ...problems], null, 1));
    expect(missing, `${persona.email} screens`).toEqual([]);
    expect(problems, `${persona.email} network/console`).toEqual([]);
  });
}
