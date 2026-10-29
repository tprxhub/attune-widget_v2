import { expect, test, type Page } from "@playwright/test";
import { signIn } from "./support/signIn";

const API = "http://127.0.0.1:8765/api/v1";

async function openSettings(page: Page) {
  await signIn(page, "admin@playhub.local");
  await page.goto("/admin");
  await page.getByRole("link", { name: "Attune settings" }).first().click();
  await expect(page.getByRole("heading", { name: "Attune settings", level: 1 })).toBeVisible();
}

async function adminToken(page: Page) {
  const login = await page.request.post(`${API}/auth/login`, {
    data: { email: "admin@playhub.local", password: "ChangeMe123!" },
  });
  return (await login.json()).access_token as string;
}

// Settings apply to every question, so each test leaves Attune on its built-in settings.
async function resetAll(page: Page) {
  await page.request.delete(`${API}/attune/settings`, {
    headers: { Authorization: `Bearer ${await adminToken(page)}` },
  });
}

test.afterEach(async ({ page }) => resetAll(page));

test("the Super Admin edits Attune's prompt and labels, then resets them", async ({ page }) => {
  await openSettings(page);
  const prompt = page.getByLabel("Prompt", { exact: true });
  await expect(prompt).toHaveValue(/You are Attune™/);
  await expect(page.getByRole("status")).toContainText("Everything is saved.");

  // The reference list placeholder can't be removed.
  const original = await prompt.inputValue();
  await prompt.fill(original.replace("{sources}", ""));
  await expect(page.getByText("Keep {sources}")).toBeVisible();
  await expect(page.getByRole("button", { name: "Save changes" })).toBeDisabled();
  await prompt.fill(`Always answer in a warm, brief way.\n\n${original}`);

  const ways = page.getByRole("region", { name: "Ways into Attune" });
  await ways.getByLabel("Button name").nth(1).fill("Hard moment");
  await page.getByLabel("Questions per person per day").fill("12");
  await expect(page.getByRole("status")).toContainText("You have unsaved changes.");

  await page.getByRole("button", { name: "Save changes" }).click();
  await page.getByRole("alertdialog").getByRole("button", { name: "Save and apply" }).click();
  await expect(page.getByRole("status")).toContainText("Saved.");
  await expect(page.getByLabel("Attune status")).toContainText("3 settings changed from built-in");
  await expect(page.getByRole("region", { name: /Main prompt/ })).toContainText(
    "Changed from built-in",
  );

  // Saved for everyone: a fresh load shows it, and people see the new button name.
  await page.reload();
  await expect(page.getByLabel("Prompt", { exact: true })).toHaveValue(
    /^Always answer in a warm, brief way\./,
  );
  const token = await adminToken(page);
  const status = await (
    await page.request.get(`${API}/attune/status`, {
      headers: { Authorization: `Bearer ${token}` },
    })
  ).json();
  expect(status.mode_labels.regulation).toBe("Hard moment");
  expect(status.daily_limit).toBe(12);

  // One section back to built-in, then everything.
  await page
    .getByRole("region", { name: /Ways into Attune/ })
    .getByRole("button", { name: /Use the built-in/ })
    .click();
  await expect(ways.getByLabel("Button name").nth(1)).toHaveValue("My member is struggling");
  await page.getByRole("button", { name: "Discard changes" }).click();
  await page.getByRole("alertdialog").getByRole("button", { name: "Discard changes" }).click();
  await page.getByRole("button", { name: "Reset all to built-in" }).click();
  await page.getByRole("alertdialog").getByRole("button", { name: "Reset Attune" }).click();
  await expect(page.getByRole("status")).toContainText("back to its built-in settings");
  await expect(page.getByLabel("Attune status")).toContainText("Using the built-in settings.");
});

test("an unsaved prompt can be tried before saving", async ({ page }) => {
  // The test server has no model key: report one, and answer the try instead of calling a model.
  await page.route("**/api/v1/attune/settings", async (route) => {
    if (route.request().method() !== "GET") return route.continue();
    const response = await route.fetch();
    return route.fulfill({ response, json: { ...(await response.json()), key_configured: true } });
  });
  let sent: { settings: { instructions: string }; message: string; mode: string | null } | null =
    null;
  await page.route("**/api/v1/attune/settings/test", async (route) => {
    sent = route.request().postDataJSON();
    return route.fulfill({
      json: {
        answer: "**What you can try**\n- Chunky crayons for a week.",
        references: [{ id: "nmt", title: "Neurosequential Model" }],
        safety: false,
        seconds: 1.4,
      },
    });
  });

  await openSettings(page);
  const prompt = page.getByLabel("Prompt", { exact: true });
  await prompt.fill(`DRAFT: answer in two sentences.\n\n${await prompt.inputValue()}`);
  const tryPanel = page.getByRole("region", { name: "Try an answer" });
  await tryPanel.getByLabel("Question").fill("He grips the pencil with his fist.");
  await tryPanel.getByLabel("Asked as").selectOption("idea");
  await tryPanel.getByRole("button", { name: "Try it" }).click();

  const answer = page.getByLabel("Test answer");
  await expect(answer).toContainText("Chunky crayons for a week.");
  await expect(answer).toContainText("1.4s · not saved");
  expect(sent!.settings.instructions.startsWith("DRAFT: answer in two sentences.")).toBe(true);
  expect(sent!.message).toBe("He grips the pencil with his fist.");
  expect(sent!.mode).toBe("idea");
  // Trying doesn't save.
  await expect(page.getByRole("status")).toContainText("You have unsaved changes.");
});

test("only a Super Admin can open Attune settings", async ({ page }) => {
  await signIn(page, "parent@playhub.local");
  await page.goto("/admin/attune-settings");
  await expect(page.getByRole("heading", { name: "Attune settings" })).toHaveCount(0);
  await expect(page.getByLabel("Prompt", { exact: true })).toHaveCount(0);
});

test("the prompt editor makes bulleted and numbered lists that are saved as written", async ({
  page,
}) => {
  await openSettings(page);
  const section = page.getByRole("region", { name: /“Share this” note/ });
  const box = section.getByLabel("Instructions for the note", { exact: true });
  await box.fill("Keep it short\nUse plain words\nEnd with one tip");

  // Select everything, then make it a bulleted list.
  await box.focus();
  await box.press("ControlOrMeta+a");
  await section.getByRole("button", { name: "Bulleted list" }).click();
  await expect(box).toHaveValue("- Keep it short\n- Use plain words\n- End with one tip");

  // Switch the same lines to numbers.
  await box.press("ControlOrMeta+a");
  await section.getByRole("button", { name: "Numbered list" }).click();
  await expect(box).toHaveValue("1. Keep it short\n2. Use plain words\n3. End with one tip");

  // Enter at the end continues the numbering; Enter on the empty item ends the list.
  // The list stays selected after a toolbar change; the right arrow puts the caret at its end.
  await box.press("ArrowRight");
  await box.press("Enter");
  await box.pressSequentially("Name the child");
  await expect(box).toHaveValue(
    "1. Keep it short\n2. Use plain words\n3. End with one tip\n4. Name the child",
  );
  await box.press("Enter");
  await box.press("Enter");
  await box.pressSequentially("Thanks.");
  await expect(box).toHaveValue(
    "1. Keep it short\n2. Use plain words\n3. End with one tip\n4. Name the child\nThanks.",
  );

  // The toolbar's changes are ordinary typing, so Undo takes them back.
  await box.press("ControlOrMeta+a");
  await section.getByRole("button", { name: "Bulleted list" }).click();
  await expect(box).toHaveValue(/^- Keep it short/);
  await section.getByRole("button", { name: "Undo" }).click();
  await expect(box).toHaveValue(/^1\. Keep it short/);

  // Preview shows a real numbered list.
  await section.getByRole("button", { name: "Preview" }).click();
  const preview = section.getByLabel("Instructions for the note preview");
  await expect(preview.locator("ol li")).toHaveCount(4);
  await expect(preview).toContainText("Name the child");
  await section.getByRole("button", { name: "Edit" }).click();

  await page.getByRole("button", { name: "Save changes" }).click();
  await page.getByRole("alertdialog").getByRole("button", { name: "Save and apply" }).click();
  await expect(page.getByRole("status")).toContainText("Saved.");
  const saved = await (
    await page.request.get(`${API}/attune/settings`, {
      headers: { Authorization: `Bearer ${await adminToken(page)}` },
    })
  ).json();
  expect(saved.settings.summary_instructions).toBe(
    "1. Keep it short\n2. Use plain words\n3. End with one tip\n4. Name the child\nThanks.",
  );
});
