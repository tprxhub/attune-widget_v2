import { expect, test } from "@playwright/test";

test("edited sessions show the correction date and updated text after reload and in Progress", async ({
  page,
}) => {
  const response = await page.request.post("http://127.0.0.1:8765/api/v1/auth/login", {
    data: { email: "parent@playhub.local", password: "ChangeMe123!" },
  });
  const { access_token: token } = await response.json();
  await page.addInitScript((token) => {
    localStorage.setItem("playhub_access_token", token);
    const original = Storage.prototype.getItem;
    Storage.prototype.getItem = function (key) {
      return key.startsWith("playhub:navigation-tour:") ? "complete" : original.call(this, key);
    };
  }, token);
  await page.setViewportSize({ width: 320, height: 800 });
  await page.goto("/check-in");
  await page
    .getByRole("button", { name: /^Edit session:/ })
    .first()
    .click();
  const dialog = page.getByRole("dialog", { name: "Edit session", exact: true });
  await dialog.locator("textarea").first().fill("Updated session note for edit-date verification");
  await dialog.getByRole("button", { name: "Save changes", exact: true }).click();
  await expect(dialog).toHaveCount(0);
  const stamp = page.getByText(/^Edited ·/).first();
  await expect(stamp).toBeVisible();
  await expect(stamp).toContainText(/at \d{2}:\d{2}/);
  await expect(
    page.getByText("Updated session note for edit-date verification", { exact: true }),
  ).toBeVisible();
  await page.reload();
  await expect(page.getByText(/^Edited ·/).first()).toBeVisible();
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth - innerWidth),
  ).toBeLessThanOrEqual(1);
  await page.goto("/progress");
  await expect(page.getByText(/^Edited ·/).first()).toBeVisible();
  await expect(
    page.getByText("Updated session note for edit-date verification", { exact: true }),
  ).toBeVisible();
});
