import { expect, test, type Page } from "@playwright/test";
import { signIn } from "./support/signIn";

const card = (page: Page, name: string) =>
  page.locator("article").filter({ has: page.getByRole("heading", { name, exact: true }) });

/** The Moderators a member has, plus the ones their card offers to add. */
async function moderatorOptions(page: Page, name: string) {
  const member = card(page, name);
  const assigned = await member
    .getByRole("list", { name: `${name}'s Moderators` })
    .getByRole("listitem")
    .allInnerTexts()
    .catch(() => []);
  let addable: string[] = [];
  const add = member.getByRole("button", { name: /Add (a|another) Moderator for/ });
  if (await add.count()) {
    await add.click();
    addable = (await page.getByRole("option").allInnerTexts()).filter(
      (o) => !/Add (a|another) Moderator/.test(o),
    );
    await page.keyboard.press("Escape");
  }
  return [...assigned, ...addable].map((option) => option.trim());
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
  // Nothing is sent until the admin confirms the invitation; Back returns to the form.
  await expect(dialog).toContainText("Send an invitation email?");
  await expect(dialog).toContainText("omar.parent@example.com");
  await dialog.getByRole("button", { name: "Back" }).click();
  await expect(dialog.getByLabel("Member email")).toHaveValue("omar.parent@example.com");
  await dialog.getByRole("button", { name: /Save/ }).click();
  await dialog.getByRole("button", { name: "Send invitation and save" }).click();
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

test("the Super Admin edits a member's email from their card", async ({ page }) => {
  await signIn(page, "admin@playhub.local");
  await page.goto("/admin/members");
  // A linked member: this changes their sign-in email.
  const amira = card(page, "Amira");
  await amira.getByRole("button", { name: "Edit Amira's email" }).click();
  let dialog = page.getByRole("dialog", { name: "Member email" });
  await expect(dialog.getByLabel("Email")).toHaveValue("hana@sunrise.local");
  await expect(dialog).toContainText("sign-in email");
  const changed = page.waitForRequest((r) => r.method() === "PATCH" && /\/users\//.test(r.url()));
  await dialog.getByLabel("Email").fill("hana.omar@sunrise.local");
  await dialog.getByRole("button", { name: "Save email" }).click();
  expect((await changed).postDataJSON()).toEqual({ email: "hana.omar@sunrise.local" });
  await expect(dialog).toBeHidden();
  await expect(amira).toContainText("hana.omar@sunrise.local");
  // Put it back for other tests.
  await amira.getByRole("button", { name: "Edit Amira's email" }).click();
  dialog = page.getByRole("dialog", { name: "Member email" });
  await dialog.getByLabel("Email").fill("hana@sunrise.local");
  await dialog.getByRole("button", { name: "Save email" }).click();
  await expect(dialog).toBeHidden();

  // An email already used by another account is refused with a message.
  await amira.getByRole("button", { name: "Edit Amira's email" }).click();
  dialog = page.getByRole("dialog", { name: "Member email" });
  await dialog.getByLabel("Email").fill("esther@sunrise.local");
  await dialog.getByRole("button", { name: "Save email" }).click();
  await expect(dialog.getByRole("alert")).toContainText("already belongs to an account");
});

test("a member can have several Moderators, added and removed from their card", async ({
  page,
}) => {
  const name = await memberWithoutModerator(page);
  // A second Sunrise Moderator who has accepted their invitation.
  const login = await page.request.post(`${API}/auth/login`, {
    data: { email: "admin@playhub.local", password: "ChangeMe123!" },
  });
  const headers = { Authorization: `Bearer ${(await login.json()).access_token}` };
  const orgs = await (await page.request.get(`${API}/organisations`, { headers })).json();
  const sunrise = orgs.find((org: { name: string }) => org.name.startsWith("Sunrise"));
  const invited = await (
    await page.request.post(`${API}/invitations`, {
      headers,
      data: {
        email: `second.mod.${Date.now()}@example.com`,
        display_name: "Second Moderator",
        role: "moderator",
        account_scope: "organisation",
        organisation_id: sunrise.id,
      },
    })
  ).json();
  await page.request.post(`${API}/invitations/accept`, {
    data: { token: invited.acceptance_token, password: "A-secure-password" },
  });

  await signIn(page, "esther@sunrise.local");
  await page.goto("/org");
  const member = card(page, name);
  const chips = member.getByRole("list", { name: `${name}'s Moderators` });
  for (const moderator of ["Priya Raman", "Second Moderator"]) {
    await member.getByRole("button", { name: /Add (a|another) Moderator for/ }).click();
    await page.getByRole("option", { name: moderator }).click();
    await expect(chips).toContainText(moderator);
  }
  await expect(chips.getByRole("listitem")).toHaveCount(2);
  await member.getByRole("button", { name: "Remove Priya Raman" }).click();
  await expect(chips.getByRole("listitem")).toHaveCount(1);
  await expect(chips).toContainText("Second Moderator");
  await page.reload();
  await expect(card(page, name).getByRole("list", { name: `${name}'s Moderators` })).toContainText(
    "Second Moderator",
  );
});

test("the Super Admin opens member deletion directly from the card", async ({ page }) => {
  await signIn(page, "admin@playhub.local");
  await page.goto("/admin/members");
  const member = card(page, "Amira");
  await expect(member.getByRole("link", { name: "Check-in" })).toHaveCount(0);
  await member.getByRole("button", { name: "Delete Member", exact: true }).click();
  const dialog = page.getByRole("alertdialog", { name: "Delete Amira?" });
  await expect(dialog.getByRole("button", { name: "Delete member", exact: true })).toBeDisabled();
  await expect(dialog.getByLabel("What will be deleted")).toBeVisible();
  await dialog.getByRole("button", { name: "Cancel", exact: true }).click();
  await expect(dialog).toBeHidden();
  await expect(member).toBeVisible();
});
