import { expect, test } from "@playwright/test";
import { signIn } from "./support/signIn";

const API = process.env.E2E_API_URL ?? "http://127.0.0.1:8765/api/v1";

test("Super Admin deletes a mistaken check-in from its hover action", async ({ page }) => {
  const login = await page.request.post(`${API}/auth/login`, {
    data: { email: "admin@playhub.local", password: "ChangeMe123!" },
  });
  const token = (await login.json()).access_token;
  const headers = { Authorization: `Bearer ${token}` };
  const children = await (await page.request.get(`${API}/children`, { headers })).json();
  const doseId = children.find(
    (child: { name: string }) => child.name === "Amira",
  ).current_play_dose_id;
  const name = "Check-in removal member";
  const created = await page.request.post(`${API}/children`, {
    headers,
    data: { name, account_scope: "individual", current_play_dose_id: doseId },
  });
  expect(created.ok()).toBeTruthy();
  const child = await created.json();
  const logged = await page.request.post(`${API}/children/${child.id}/attempts`, {
    headers,
    data: {
      play_dose_id: doseId,
      occurred_on: "2026-10-29",
      completion_score: 3,
      mood_score: 4,
      big_win: "This check-in was logged for the wrong member",
      source: "daily_check_in",
    },
  });
  expect(logged.ok()).toBeTruthy();
  await page.addInitScript((token) => localStorage.setItem("playhub_access_token", token), token);
  await page.goto("/check-in");
  await page.getByRole("button", { name: /^Selected member:/ }).click();
  await page.getByRole("option", { name, exact: true }).click();
  await expect(page.getByRole("heading", { name, exact: true })).toBeVisible();
  const remove = page.getByRole("button", { name: /^Delete check-in:/ });
  const row = page.locator("#recent-sessions-list li").first();
  await row.hover();
  await expect(remove).toHaveCSS("opacity", "1");
  await page.mouse.move(0, 0);
  await remove.focus();
  await expect(remove).toHaveCSS("opacity", "1");
  await remove.click();
  const dialog = page.getByRole("alertdialog", { name: "Delete check-in?" });
  await expect(dialog).toContainText(name);
  await expect(dialog.getByRole("button", { name: "Delete check-in", exact: true })).toBeDisabled();
  await dialog.getByRole("button", { name: "Cancel", exact: true }).click();
  await expect(remove).toHaveCount(1);
  await row.hover();
  await remove.click();
  await dialog.getByRole("textbox").fill(name);
  await dialog.getByRole("button", { name: "Delete check-in", exact: true }).click();
  await expect(dialog).toBeHidden();
  await expect(page.getByText(`Nothing logged for ${name} yet.`, { exact: true })).toBeVisible();
  expect(
    await (await page.request.get(`${API}/children/${child.id}/attempts`, { headers })).json(),
  ).toEqual([]);
  const progress = await (
    await page.request.get(`${API}/children/${child.id}/progress`, { headers })
  ).json();
  expect(progress.total_attempts).toBe(0);
  await page.setViewportSize({ width: 320, height: 800 });
  await expect(page.getByRole("heading", { name, exact: true })).toBeVisible();
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth - innerWidth),
  ).toBeLessThanOrEqual(1);
});

test("other Admins cannot see a delete check-in action", async ({ page }) => {
  await signIn(page, "esther@sunrise.local");
  await page.goto("/check-in");
  await expect(page.getByRole("heading", { name: "Daily Check-In", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: /^Edit session:/ }).first()).toBeVisible();
  await expect(page.getByRole("button", { name: /^Delete check-in:/ })).toHaveCount(0);
});
