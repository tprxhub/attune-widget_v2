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
  await page.goto("/admin/children");
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
  await page.goto("/admin/children");
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
