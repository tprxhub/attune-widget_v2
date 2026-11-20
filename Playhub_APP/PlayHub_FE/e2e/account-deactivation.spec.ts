import { expect, test, type APIRequestContext } from "@playwright/test";
import { signIn } from "./support/signIn";

const API = "http://127.0.0.1:8765/api/v1";
const PASSWORD = "DeactivateMe123!";

/** A brand-new family, signed up through the API (the test server's signup code is fixed). */
async function newFamily(request: APIRequestContext, email: string) {
  await request.post(`${API}/auth/signup/send-code`, { data: { email } });
  const { email_token } = await (
    await request.post(`${API}/auth/signup/verify-code`, { data: { email, code: "246810" } })
  ).json();
  const created = await request.post(`${API}/auth/register-family`, {
    data: {
      email,
      password: PASSWORD,
      guardian_name: "Pause Family",
      child_name: "Rumi",
      email_token,
    },
  });
  expect(created.status()).toBe(201);
}

test("a family deactivates their account, Super Admin sees it, and logging in reactivates it", async ({
  page,
}) => {
  const email = `pause.${Date.now()}@example.com`;
  await newFamily(page.request, email);

  await page.goto("/login");
  await page.getByLabel("Email Address").fill(email);
  await page.getByLabel("Password", { exact: true }).fill(PASSWORD);
  await page.getByRole("button", { name: "Log in" }).click();
  await expect(page).toHaveURL(/\/hub/);

  await page.goto("/account");
  await page.getByRole("button", { name: /Deactivate account/ }).click();
  const dialog = page.getByRole("dialog", { name: "Deactivate your account?" });
  await expect(dialog).toContainText("Nothing is deleted");
  await dialog.getByRole("button", { name: "Deactivate", exact: true }).click();
  await expect(dialog.getByRole("alert")).toContainText("Enter your password");
  await dialog.getByLabel("Your password").fill("not-the-password");
  await dialog.getByRole("button", { name: "Deactivate", exact: true }).click();
  await expect(dialog.getByRole("alert")).toContainText("isn't right");
  await dialog.getByLabel("Your password").fill(PASSWORD);
  await dialog.getByRole("button", { name: "Deactivate", exact: true }).click();
  await expect(page).toHaveURL(/\/login\?deactivated=true/);
  await expect(page.getByRole("status")).toContainText("Your account is deactivated");

  // Super Admin sees it on the member card, as deactivated by the family.
  const admin = await page.context().browser()!.newContext();
  const adminPage = await admin.newPage();
  await signIn(adminPage, "admin@playhub.local");
  await adminPage.goto("/admin/members");
  await adminPage.getByLabel("Search members").fill("Rumi");
  const card = adminPage.locator("article").filter({ hasText: "Rumi" }).first();
  await expect(card).toContainText("Deactivated");
  await expect(card).toContainText("Deactivated by the family");
  await admin.close();

  // Logging in offers to reactivate; doing so goes straight in.
  await page.getByLabel("Email Address").fill(email);
  await page.getByLabel("Password", { exact: true }).fill(PASSWORD);
  await page.getByRole("button", { name: "Log in" }).click();
  const offer = page.getByRole("alertdialog", { name: "This account is deactivated" });
  await expect(offer).toBeVisible();
  await offer.getByRole("button", { name: "Reactivate and log in" }).click();
  await expect(page).toHaveURL(/\/hub/);
});
