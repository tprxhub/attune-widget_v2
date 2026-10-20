import { expect, test, type Page } from "@playwright/test";

async function login(page: Page, email: string) {
  await page.goto("/login");
  await page.getByLabel("Email Address").fill(email);
  await page.getByLabel("Password", { exact: true }).fill("ChangeMe123!");
  await page.getByRole("button", { name: "Log in", exact: true }).click();
  await expect(page).toHaveURL(/\/(hub|dashboard|admin|org)/);
}

type Reply = { content: string; safety?: boolean };

/** A stand-in Attune API: records each question's body and answers with references. */
async function mockAttune(page: Page, reply: Reply) {
  const now = new Date().toISOString();
  const state = { bodies: [] as Record<string, unknown>[], summaries: 0 };
  const conversation = { id: "c7", child_id: null, title: "", created_at: now, updated_at: now };
  const messages: Record<string, unknown>[] = [];
  await page.route("**/api/v1/attune/**", async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    if (path.endsWith("/attune/status")) {
      return route.fulfill({
        json: {
          enabled: true,
          daily_limit: 30,
          used_today: 0,
          remaining_today: 30,
          free_plan: false,
        },
      });
    }
    if (path.endsWith("/attune/ask/stream")) {
      const body = request.postDataJSON() as Record<string, unknown>;
      state.bodies.push(body);
      conversation.title = String(body["message"]);
      const question = {
        id: `q${state.bodies.length}`,
        role: "user",
        content: body["message"],
        activity_id: null,
        mode: body["mode"],
        created_at: now,
      };
      const answer = {
        id: `a${state.bodies.length}`,
        role: "assistant",
        content: reply.content,
        activity_id: null,
        feedback: null,
        mode: body["mode"],
        safety: reply.safety ?? false,
        references: [
          { id: "nmt", title: "Neurosequential Model of Therapeutics (Dr. Bruce Perry)" },
          { id: "polyvagal", title: "Polyvagal Theory (Dr. Stephen Porges)" },
        ],
        created_at: now,
      };
      messages.push(question, answer);
      return route.fulfill({
        contentType: "application/x-ndjson",
        body:
          [
            { type: "delta", text: reply.content },
            { type: "done", conversation, question, answer, remaining_today: 29 },
          ]
            .map((line) => JSON.stringify(line))
            .join("\n") + "\n",
      });
    }
    if (path.endsWith("/summary")) {
      state.summaries += 1;
      return route.fulfill({
        json: {
          summary:
            "Leaving the park has been hard for Kai.\n\nA two-minute warning and staying close helped.\n\nWatch for him coming back to you sooner.",
        },
      });
    }
    if (path.endsWith("/attune/conversations")) {
      return route.fulfill({ json: messages.length ? [conversation] : [] });
    }
    if (path.endsWith(`/attune/conversations/${conversation.id}`)) {
      return route.fulfill({ json: { ...conversation, messages } });
    }
    return route.fallback();
  });
  return state;
}

test("the dashboard offers Attune's three moments, and a struggling parent gets calm, cited help to share", async ({
  page,
}) => {
  const state = await mockAttune(page, {
    content:
      "That sounds really hard for both of you.\n\n**What you can try**\n- Stay close and use fewer words.\n\n**Let's Attune**\nYou paused and asked. What happened next?",
  });
  await login(page, "parent@playhub.local");
  await page.goto("/dashboard");
  const bar = page.getByRole("region", { name: "Ask Attune" });
  await expect(bar.getByRole("link", { name: "Get an idea" })).toBeVisible();
  await expect(bar.getByRole("link", { name: "What does this mean?" })).toBeVisible();
  await bar.getByRole("link", { name: "My member is struggling" }).click();

  await expect(page).toHaveURL(/\/attune\?mode=regulation/);
  await expect(
    page.getByRole("heading", { name: "Take a breath. Let’s work through this together." }),
  ).toBeVisible();
  await expect(page.getByText(/call 999 \(police\) or 998 \(ambulance\) first/)).toBeVisible();
  await expect(page.getByText("My member is struggling", { exact: true })).toBeVisible();
  await expect(
    page.getByText(/OT-informed tool created by a licensed occupational therapist/),
  ).toBeVisible();

  await page.getByRole("button", { name: /I’m losing my patience/ }).click();
  await expect(page.getByText("You paused and asked. What happened next?")).toBeVisible();
  expect(state.bodies[0]).toMatchObject({
    message: "Nothing is working and I’m losing my patience.",
    mode: "regulation",
  });

  // The research icon lists what informed the answer, as plain text.
  await page.getByRole("button", { name: "Show references" }).click();
  const panel = page.getByText("What informed this answer").locator("..");
  await expect(panel).toContainText("Neurosequential Model of Therapeutics (Dr. Bruce Perry)");
  await expect(panel.getByRole("link")).toHaveCount(0);
  await page.getByRole("button", { name: "Hide references" }).click();
  await expect(page.getByText("What informed this answer")).toHaveCount(0);

  // "Share this" writes a plain handover note to copy or share.
  await page.getByRole("button", { name: "Share this" }).click();
  const dialog = page.getByRole("dialog", { name: "Share this" });
  await expect(dialog).toContainText("Leaving the park has been hard for Kai.");
  await expect(dialog.locator("p", { hasText: "Watch for him" })).toBeVisible();
  await expect(dialog.getByRole("button", { name: "Copy note" })).toBeEnabled();
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
  expect(state.summaries).toBe(1);

  // Clearing the moment goes back to ordinary questions.
  await page.getByRole("button", { name: "Stop: My member is struggling" }).click();
  await expect(page).not.toHaveURL(/mode=/);
});

test("an answer that used the safety pathway shows who to call", async ({ page }) => {
  await mockAttune(page, {
    content: "Please call 998 for an ambulance now, and stay with him.",
    safety: true,
  });
  await login(page, "parent@playhub.local");
  await page.goto("/attune");
  await page.getByLabel("Your question for Attune").fill("He swallowed a button battery");
  await page.keyboard.press("Enter");
  const alert = page.getByRole("alert").filter({ hasText: "get help first" });
  await expect(alert).toBeVisible();
  await expect(alert.getByRole("link", { name: "999" })).toHaveAttribute("href", "tel:999");
  await expect(alert.getByRole("link", { name: "998" })).toHaveAttribute("href", "tel:998");
});

test("Progress asks Attune what the chart means", async ({ page }) => {
  const state = await mockAttune(page, { content: "Support has eased across the dose." });
  await login(page, "parent@playhub.local");
  await page.goto("/progress");
  await page.getByRole("link", { name: "What does this mean?", exact: true }).click();
  await expect(page.getByText("Support has eased across the dose.")).toBeVisible();
  expect(state.bodies[0]?.["mode"]).toBe("progress");
  expect(String(state.bodies[0]?.["message"])).toMatch(/progress chart mean/);
});

test("Activity and Play Dose pages offer Get an idea and My member is struggling", async ({
  page,
}) => {
  await mockAttune(page, { content: "An idea." });
  await login(page, "parent@playhub.local");
  await page.goto("/plans");
  await page.locator('a[href^="/plans/"]').first().click();
  await expect(page).toHaveURL(/\/plans\/[^/]+$/);
  const card = page.getByRole("region", { name: "Ask Attune" });
  await expect(card.getByRole("link", { name: "Get an idea" })).toHaveAttribute(
    "href",
    /mode=idea/,
  );
  await expect(card.getByRole("link", { name: "My member is struggling" })).toHaveAttribute(
    "href",
    /mode=regulation/,
  );
});
