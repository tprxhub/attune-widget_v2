import { expect, test, type Page } from "@playwright/test";
import { signIn } from "./support/signIn";

const card = (page: Page, name: string) =>
  page.locator("article").filter({ has: page.getByRole("heading", { name, exact: true }) });

async function moderatorOptions(page: Page, name: string) {
  const member = card(page, name);
  await member.locator('button[aria-haspopup="listbox"]').click();
  const options = await page.getByRole("option").allInnerTexts();
  await page.keyboard.press("Escape");
  return options.map((option) => option.trim());
}

test("a member's Moderator list only offers Moderators from their organisation or family", async ({
  page,
}) => {
  await signIn(page, "admin@playhub.local");
  await page.goto("/admin/members");
  await expect(card(page, "Amira")).toBeVisible();

  const school = await moderatorOptions(page, "Amira");
  expect(school).toContain("Priya Raman");
  expect(school).not.toContain("Alex Morgan"); // Bright Steps
  expect(school).not.toContain("Grace Adeniyi"); // a family's Moderator

  const family = await moderatorOptions(page, "Noah");
  expect(family).toContain("Grace Adeniyi");
  expect(family).not.toContain("Priya Raman");
  expect(family).not.toContain("Alex Morgan");
});

test("the Super Admin adds a member's email from their profile", async ({ page }) => {
  await signIn(page, "admin@playhub.local");
  await page.goto("/admin/members");
  const omar = card(page, "Omar");
  await expect(omar).toContainText("No email linked yet");
  await omar.getByRole("button", { name: "Profile" }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByLabel("Member email")).toHaveValue("");
  await expect(dialog).toContainText("Saving sends an invitation");
  const invitation = page.waitForRequest(
    (request) => request.url().endsWith("/invitations") && request.method() === "POST",
  );
  await dialog.getByLabel("Member email").fill("omar.parent@example.com");
  await dialog.getByRole("button", { name: /Save/ }).click();
  expect((await invitation).postDataJSON()).toMatchObject({
    email: "omar.parent@example.com",
    role: "member",
  });
  await expect(dialog).toBeHidden();
  await expect(omar).toContainText("omar.parent@example.com");

  // A linked member's email is their sign-in email, which only a Super Admin can change.
  await card(page, "Amira").getByRole("button", { name: "Profile" }).click();
  await expect(page.getByRole("dialog").getByLabel("Member email")).toHaveValue(
    "hana@sunrise.local",
  );
  await expect(page.getByRole("dialog")).toContainText("sign-in email");
});

const API = "http://127.0.0.1:8765/api/v1";

/** A Sunrise member with no Moderator, created through the API. */
async function memberWithoutModerator(page: Page) {
  const login = await page.request.post(`${API}/auth/login`, {
    data: { email: "admin@playhub.local", password: "ChangeMe123!" },
  });
  const headers = { Authorization: `Bearer ${(await login.json()).access_token}` };
  const orgs = await (await page.request.get(`${API}/organisations`, { headers })).json();
  const sunrise = orgs.find((org: { name: string }) => org.name.startsWith("Sunrise"));
  const name = `Zara ${Date.now() % 100000}`;
  const created = await page.request.post(`${API}/children`, {
    headers,
    data: { name, account_scope: "organisation", organisation_id: sunrise.id },
  });
  expect(created.ok()).toBeTruthy();
  return name;
}

test("a school member without a Moderator offers Invite Moderator, not Invite Member", async ({
  page,
}) => {
  const name = await memberWithoutModerator(page);
  await signIn(page, "admin@playhub.local");
  await page.goto("/admin/members");
  const member = card(page, name);
  await expect(member).toBeVisible();
  await expect(member.getByRole("button", { name: "Invite Member" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Invite Member" })).toHaveCount(0);
  await member.getByRole("button", { name: "Invite Moderator" }).click();
  const dialog = page.getByRole("dialog", { name: "Add a Moderator" });
  await expect(dialog.locator("#sup-child")).toContainText(name);
  await dialog.locator("#sup-name").fill("Mira Test");
  await dialog.locator("#sup-email").fill(`mira.${Date.now()}@example.com`);
  await dialog.getByRole("button", { name: "Add Moderator" }).click();
  await expect(page.getByRole("dialog", { name: "Moderator login ready" })).toBeVisible();

  // A member who already has a Moderator shows neither button.
  await page.keyboard.press("Escape");
  await expect(card(page, "Amira").getByRole("button", { name: "Invite Moderator" })).toHaveCount(
    0,
  );
});

test("the school Admin invites a Moderator from a member's card", async ({ page }) => {
  const name = await memberWithoutModerator(page);
  await signIn(page, "esther@sunrise.local");
  await page.goto("/org");
  const member = card(page, name);
  await member.getByRole("button", { name: "Invite Moderator" }).click();
  const dialog = page.getByRole("dialog", { name: "Add a Moderator" });
  await expect(dialog.locator("#sup-child")).toContainText(name);
  await expect(card(page, "Amira").getByRole("button", { name: "Invite Moderator" })).toHaveCount(
    0,
  );
});

test("the old Members address still opens the page", async ({ page }) => {
  await signIn(page, "admin@playhub.local");
  await page.goto("/admin/children");
  await expect(page).toHaveURL(/\/admin\/members$/);
});
