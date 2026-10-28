import { expect, test } from "@playwright/test";
import { signIn } from "./support/signIn";

test("a signed-out user can ask for a reset link from the login page", async ({ page }) => {
  await page.goto("/login");
  await page.waitForLoadState("networkidle");
  await page.getByLabel("Email Address").fill("parent@playhub.local");
  await page.getByRole("link", { name: "Forgot password?" }).click();
  await expect(page).toHaveURL(/\/forgot-password/);
  // The email typed on the login page carries over.
  await expect(page.getByLabel("Email Address")).toHaveValue("parent@playhub.local");
  await page.getByRole("button", { name: "Send reset link" }).click();
  await expect(page.getByRole("status")).toContainText("Check your email");
});

test("an expired or made-up reset link explains what to do", async ({ page }) => {
  await page.goto("/reset-password?token=not-a-real-token-but-long-enough");
  await page.waitForLoadState("networkidle"); // submit only once the page is interactive
  await page.getByLabel("New password", { exact: true }).fill("Brand-new-pass-2");
  await page.getByLabel("Confirm new password").fill("Brand-new-pass-2");
  await page.getByRole("button", { name: "Save new password" }).click();
  await expect(page.getByRole("alert")).toContainText("expired or was already used");
  await expect(page.getByRole("link", { name: "Send a new link" })).toBeVisible();
});

test("the password pages show the picture chosen in the homepage editor", async ({ page }) => {
  const picture = "https://example.com/password-picture.jpg";
  const art = () => page.getByAltText("A member playing with colourful wooden toys");
  await page.setViewportSize({ width: 1280, height: 800 });
  await signIn(page, "admin@playhub.local");
  await page.goto("/admin/homepage");
  await page
    .getByRole("navigation", { name: "Editor sections" })
    .getByRole("button", { name: "Login, signup & password images", exact: true })
    .click();
  const field = page.getByLabel("Password pages image", { exact: true });
  const original = await field.inputValue();
  await field.fill(picture);
  await page.getByRole("button", { name: "Save changes", exact: true }).click();
  await expect(page.getByRole("status")).not.toContainText("unsaved changes");
  try {
    await page.goto("/forgot-password");
    await expect(art()).toHaveAttribute("src", picture);
    await page.goto("/reset-password?token=not-a-real-token-but-long-enough");
    await expect(art()).toHaveAttribute("src", picture);
  } finally {
    await page.goto("/admin/homepage");
    await page
      .getByRole("navigation", { name: "Editor sections" })
      .getByRole("button", { name: "Login, signup & password images", exact: true })
      .click();
    await page.getByLabel("Password pages image", { exact: true }).fill(original);
    await page.getByRole("button", { name: "Save changes", exact: true }).click();
    await expect(page.getByRole("status")).not.toContainText("unsaved changes");
  }
});
