import { expect, test, type APIRequestContext, type Page } from "@playwright/test";
import { signIn } from "./support/signIn";

// These tests delete things, so each one makes its own records through the API instead of
// touching the shared demo data other tests rely on.
const API = "http://127.0.0.1:8765/api/v1";

async function adminApi(request: APIRequestContext) {
  const login = await request.post(`${API}/auth/login`, {
    data: { email: "admin@playhub.local", password: "ChangeMe123!" },
  });
  const headers = { Authorization: `Bearer ${(await login.json()).access_token}` };
  const post = async (path: string, data: unknown) => {
    const response = await request.post(`${API}${path}`, { headers, data });
    expect(response.ok(), await response.text()).toBeTruthy();
    return response.json();
  };
  return { post };
}

async function schoolWithMember(request: APIRequestContext, school: string, member: string) {
  const api = await adminApi(request);
  const org = await api.post("/organisations", { name: school, seat_limit: 10 });
  const child = await api.post("/children", {
    name: member,
    account_scope: "organisation",
    organisation_id: org.id,
  });
  return { api, org, child };
}

const card = (page: Page, name: string) =>
  page.locator("article").filter({ has: page.getByRole("heading", { name, exact: true }) });

test("the Super Admin removes a member's email from their profile", async ({ page, request }) => {
  const { api, org, child } = await schoolWithMember(request, "Clear Email School", "Clara");
  await api.post("/invitations", {
    email: "clara.parent@example.com",
    display_name: "Clara Parent",
    role: "member",
    account_scope: "organisation",
    organisation_id: org.id,
    child_id: child.id,
  });
  await signIn(page, "admin@playhub.local");
  await page.goto("/admin/members");
  await expect(card(page, "Clara")).toContainText("clara.parent@example.com");

  await card(page, "Clara").getByRole("button", { name: "Profile" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Member email").fill("");
  await expect(dialog).toContainText("withdraws the invitation sent to clara.parent@example.com");
  await dialog.getByRole("button", { name: /Save changes/ }).click();
  await expect(dialog).toBeHidden();
  await expect(card(page, "Clara")).toContainText("No email linked yet");
});

test("the Super Admin removes a family account holder's email; the family keeps working", async ({
  page,
  request,
}) => {
  const signup = await request.post(`${API}/auth/register-family`, {
    data: {
      email: "holder.family@example.com",
      display_name: "Holder Parent",
      guardian_name: "Holder Parent",
      child_name: "Hugo",
      password: "secure-password",
    },
  });
  expect(signup.ok()).toBeTruthy();
  await signIn(page, "admin@playhub.local");
  await page.goto("/admin/members");
  await expect(card(page, "Hugo")).toContainText("holder.family@example.com");
  await card(page, "Hugo").getByRole("button", { name: "Profile" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Member email").fill("");
  await expect(dialog).toContainText("keeps signing in and stays their Account Admin");
  await dialog.getByRole("button", { name: /Save changes/ }).click();
  await expect(dialog).toBeHidden();
  await expect(card(page, "Hugo")).toContainText("No email linked yet");
});

test("the Super Admin deletes a member after typing their name", async ({ page, request }) => {
  await schoolWithMember(request, "Delete Member School", "Dexter");
  await signIn(page, "admin@playhub.local");
  await page.goto("/admin/members");
  await card(page, "Dexter").getByRole("button", { name: "Profile" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Delete member" }).click();

  const confirm = page.getByRole("alertdialog", { name: "Delete Dexter?" });
  await expect(confirm.getByLabel("What will be deleted")).toContainText("Sessions");
  const remove = confirm.getByRole("button", { name: "Delete member" });
  await expect(remove).toBeDisabled();
  await confirm.getByLabel(/to confirm/).fill("dexter");
  await remove.click();
  await expect(confirm).toBeHidden();
  await expect(card(page, "Dexter")).toHaveCount(0);
});

test("the Super Admin deletes a Moderator account; a family account holder is protected", async ({
  page,
  request,
}) => {
  const { api, org } = await schoolWithMember(request, "Delete Mod School", "Molly");
  const invite = await api.post("/invitations", {
    email: "remove.me@example.com",
    display_name: "Remove Me",
    role: "moderator",
    account_scope: "organisation",
    organisation_id: org.id,
  });
  await request.post(`${API}/invitations/accept`, {
    data: { token: invite.acceptance_token, password: "A-secure-password" },
  });

  await signIn(page, "admin@playhub.local");
  await page.goto("/admin/educators");
  await page.getByRole("button", { name: "Delete Remove Me" }).click();
  const confirm = page.getByRole("alertdialog", { name: "Delete Remove Me?" });
  await expect(confirm).toContainText("remove.me@example.com");
  await confirm.getByLabel(/to confirm/).fill("Remove Me");
  await confirm.getByRole("button", { name: "Delete account" }).click();
  await expect(confirm).toBeHidden();
  await expect(page.getByRole("button", { name: "Delete Remove Me" })).toHaveCount(0);

  // Sumaya holds Noah's family account, so her account can't be deleted until Noah is dealt with.
  await page.getByRole("button", { name: "Delete Sumaya Idris" }).click();
  const blocked = page.getByRole("alertdialog", { name: "Delete Sumaya Idris?" });
  await expect(blocked.getByRole("alert")).toContainText("account holder for Noah");
  await expect(blocked.getByRole("button", { name: "Delete account" })).toBeDisabled();
  await blocked.getByRole("button", { name: "Cancel" }).click();
});

test("a Super Admin switches email notifications on and off; others don't see the switch", async ({
  page,
}) => {
  await signIn(page, "admin@playhub.local");
  await page.goto("/account");
  const toggle = page.getByRole("switch", { name: "Email notifications" });
  await expect(toggle).toHaveAttribute("aria-checked", "false");
  await toggle.click();
  await expect(toggle).toHaveAttribute("aria-checked", "true");
  await page.reload();
  await expect(page.getByRole("switch", { name: "Email notifications" })).toHaveAttribute(
    "aria-checked",
    "true",
  );
  await page.getByRole("switch", { name: "Email notifications" }).click();
  await expect(page.getByRole("switch", { name: "Email notifications" })).toHaveAttribute(
    "aria-checked",
    "false",
  );

  await page.context().clearCookies();
  await page.evaluate(() => localStorage.clear());
  await signIn(page, "esther@sunrise.local");
  await page.goto("/account");
  await expect(page.getByRole("heading", { name: "Preferences" })).toBeVisible();
  await expect(page.getByRole("switch", { name: "Email notifications" })).toHaveCount(0);
});
