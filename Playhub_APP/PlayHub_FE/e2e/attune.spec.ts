import { expect, test, type Page } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    const getItem = Storage.prototype.getItem;
    Storage.prototype.getItem = function (key: string) {
      return key.startsWith("playhub:navigation-tour:") ? "complete" : getItem.call(this, key);
    };
  });
});

async function login(page: Page, email: string) {
  await page.goto("/login");
  await page.getByLabel("Email Address").fill(email);
  await page.getByLabel("Password", { exact: true }).fill("ChangeMe123!");
  await page.getByRole("button", { name: "Log in", exact: true }).click();
  await expect(page).toHaveURL(/\/(dashboard|admin|org)/);
}

test("without an OpenAI key Attune says it is coming soon", async ({ page }) => {
  await login(page, "parent@playhub.local");
  await page.getByRole("link", { name: "Ask Attune" }).first().click();
  await expect(page).toHaveURL(/\/attune/);
  await expect(page.getByRole("heading", { name: "Attune is coming soon" })).toBeVisible();
});

test("a parent asks Attune, sees a formatted answer and can reopen and delete the chat", async ({
  page,
}) => {
  const now = new Date().toISOString();
  const conversation = { id: "c1", child_id: null, title: "", created_at: now, updated_at: now };
  const messages: {
    id: string;
    role: string;
    content: string;
    activity_id: string | null;
    created_at: string;
  }[] = [];
  let asked: Record<string, unknown> | null = null;
  let deleted = false;

  await page.route("**/api/v1/attune/**", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    if (url.pathname.endsWith("/attune/status")) {
      return route.fulfill({
        json: {
          enabled: true,
          daily_limit: 30,
          used_today: messages.length / 2,
          remaining_today: 30 - messages.length / 2,
        },
      });
    }
    if (url.pathname.endsWith("/attune/ask/stream")) {
      asked = request.postDataJSON() as Record<string, unknown>;
      conversation.title = String(asked["message"]);
      conversation.child_id = (asked["child_id"] as string | null) ?? null;
      const question = {
        id: "m1",
        role: "user",
        content: String(asked["message"]),
        activity_id: null,
        created_at: now,
      };
      const answer = {
        id: "m2",
        role: "assistant",
        content: "**Try this today:**\n- Use bigger pegs\n- Stop on a win",
        activity_id: null,
        created_at: now,
      };
      messages.push(question, answer);
      const lines = [
        { type: "delta", text: "**Try this today:**\n" },
        { type: "delta", text: "- Use bigger pegs\n- Stop on a win" },
        { type: "done", conversation, question, answer, remaining_today: 29 },
      ];
      await new Promise((r) => setTimeout(r, 300));
      return route.fulfill({
        contentType: "application/x-ndjson",
        body: lines.map((l) => JSON.stringify(l)).join("\n") + "\n",
      });
    }
    if (url.pathname.endsWith("/attune/conversations")) {
      return route.fulfill({ json: messages.length && !deleted ? [conversation] : [] });
    }
    if (url.pathname.endsWith("/attune/conversations/c1")) {
      if (request.method() === "DELETE") {
        deleted = true;
        return route.fulfill({ status: 204 });
      }
      return route.fulfill({ json: { ...conversation, messages } });
    }
    return route.fallback();
  });

  await login(page, "parent@playhub.local");
  await page.goto("/attune");
  await expect(page.getByRole("heading", { name: /how can I help with/ })).toBeVisible();
  await page.getByLabel("Your question for Attune").fill("She gets frustrated with pegs");
  await page.keyboard.press("Enter");

  await expect(page.getByLabel("Attune is thinking")).toBeVisible();
  await expect(page.getByText("Try this today:", { exact: true })).toBeVisible();
  await expect(page.getByRole("listitem").filter({ hasText: "Use bigger pegs" })).toBeVisible();
  await expect(page.getByText("29 of 30 left")).toBeVisible();
  await expect(page.getByRole("button", { name: "Copy answer" })).toBeAttached();
  expect(asked?.["message"]).toBe("She gets frustrated with pegs");
  expect(asked?.["child_id"]).toBeTruthy();

  // The chat is listed and reopens after a reload.
  await page.reload();
  await page
    .getByRole("button", { name: /She gets frustrated with pegs/ })
    .first()
    .click();
  await expect(page.getByText("Stop on a win")).toBeVisible();

  await page.getByRole("button", { name: "Delete chat: She gets frustrated with pegs" }).click();
  await page.getByRole("alertdialog").getByRole("button", { name: "Delete" }).click();
  await expect(page.getByText("No chats yet. Ask your first question.")).toBeVisible();
  await expect(page.getByRole("heading", { name: /how can I help with/ })).toBeVisible();
});

test("the chat list collapses to an icon rail and remembers it", async ({ page }) => {
  await page.route("**/api/v1/attune/status", (route) =>
    route.fulfill({ json: { enabled: true, daily_limit: 30, used_today: 0, remaining_today: 30 } }),
  );
  await login(page, "parent@playhub.local");
  await page.goto("/attune");
  await page.getByRole("button", { name: "Close sidebar" }).click();
  await expect(page.getByPlaceholder("Search chats")).toHaveCount(0);
  await page.reload();
  await expect(page.getByRole("button", { name: "Open sidebar" })).toBeVisible();
  await page.getByRole("button", { name: "Search chats" }).click();
  await expect(page.getByPlaceholder("Search chats")).toBeFocused();
});

test("the Activity page opens Attune about that Activity", async ({ page }) => {
  await page.route("**/api/v1/attune/status", (route) =>
    route.fulfill({ json: { enabled: true, daily_limit: 30, used_today: 0, remaining_today: 30 } }),
  );
  await login(page, "parent@playhub.local");
  // Open the first Play Dose linked from the dashboard.
  await page.goto("/dashboard");
  await page.locator("a[href^='/plans/'][href*='/'] >> nth=0").waitFor();
  await expect
    .poll(() =>
      page
        .locator("a[href^='/plans/']")
        .evaluateAll((links) =>
          links.some((l) => /^\/plans\/[^/]+\/[^/?#]+$/.test(l.getAttribute("href") ?? "")),
        ),
    )
    .toBe(true);
  const doseHref = await page
    .locator("a[href^='/plans/']")
    .evaluateAll((links) =>
      links
        .map((link) => link.getAttribute("href") ?? "")
        .find((href) => /^\/plans\/[^/]+\/[^/?#]+$/.test(href)),
    );
  expect(doseHref).toBeTruthy();
  await page.goto(doseHref as string);
  await page.getByRole("link", { name: "Ask Attune™" }).click();
  await expect(page).toHaveURL(/\/attune\?activity=/);
  await expect(page.getByText(/Asking about:/)).toBeVisible();
  await expect(
    page.getByRole("button", { name: /How can I make this Activity easier/ }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Stop asking about this Activity" }).click();
  await expect(page.getByText(/Asking about:/)).toHaveCount(0);
});

type Mock = {
  remaining?: number;
  /** What /ask/stream does: answer with this text, fail, or never finish. */
  reply?: string | "fail" | "hang";
};

/** A stand-in Attune API so the UI can be tested without a real model. */
async function mockAttune(page: Page, mock: Mock = {}) {
  const now = new Date().toISOString();
  const state = {
    remaining: mock.remaining ?? 30,
    asked: [] as string[],
    feedback: [] as unknown[],
    messages: [] as Record<string, unknown>[],
  };
  const conversation = { id: "c9", child_id: null, title: "", created_at: now, updated_at: now };
  await page.route("**/api/v1/attune/**", async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    if (path.endsWith("/attune/status")) {
      return route.fulfill({
        json: {
          enabled: true,
          daily_limit: 30,
          used_today: 30 - state.remaining,
          remaining_today: state.remaining,
        },
      });
    }
    if (path.endsWith("/attune/ask/stream")) {
      const body = request.postDataJSON() as { message: string };
      state.asked.push(body.message);
      if (mock.reply === "hang") return; // never answered: the page must let the user stop
      if (mock.reply === "fail") {
        return route.fulfill({
          contentType: "application/x-ndjson",
          body:
            JSON.stringify({ type: "error", detail: "Attune couldn’t answer just now." }) + "\n",
        });
      }
      conversation.title = body.message;
      const question = {
        id: `q${state.asked.length}`,
        role: "user",
        content: body.message,
        activity_id: null,
        feedback: null,
        created_at: now,
      };
      const answer = {
        id: `a${state.asked.length}`,
        role: "assistant",
        content: mock.reply ?? "Here is an idea.",
        activity_id: null,
        feedback: null,
        created_at: now,
      };
      state.messages.push(question, answer);
      state.remaining -= 1;
      return route.fulfill({
        contentType: "application/x-ndjson",
        body:
          [
            { type: "delta", text: answer.content },
            { type: "done", conversation, question, answer, remaining_today: state.remaining },
          ]
            .map((line) => JSON.stringify(line))
            .join("\n") + "\n",
      });
    }
    if (path.includes("/attune/messages/")) {
      const value = (request.postDataJSON() as { value: string | null }).value;
      state.feedback.push(value);
      const id = path.split("/").at(-2);
      const message = state.messages.find((m) => m["id"] === id);
      if (message) message["feedback"] = value;
      return route.fulfill({ json: message });
    }
    if (path.endsWith("/attune/conversations")) {
      return route.fulfill({ json: state.messages.length ? [conversation] : [] });
    }
    if (path.endsWith("/attune/conversations/c9")) {
      return route.fulfill({ json: { ...conversation, messages: state.messages } });
    }
    return route.fallback();
  });
  return state;
}

test("a question can be stopped while Attune is answering", async ({ page }) => {
  const state = await mockAttune(page, { reply: "hang" });
  await login(page, "parent@playhub.local");
  await page.goto("/attune");
  await page.getByLabel("Your question for Attune").fill("Help with pegs");
  await page.keyboard.press("Enter");
  await expect(page.getByLabel("Attune is thinking")).toBeVisible();
  await page.getByRole("button", { name: "Stop answering" }).click();
  await expect(page.getByText("Stopped. This reply wasn’t saved.")).toBeVisible();
  await expect(page.getByLabel("Attune is thinking")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Send question" })).toBeVisible();
  expect(state.asked).toEqual(["Help with pegs"]);
});

test("a failed answer can be retried, then rated, and tables are shown as tables", async ({
  page,
}) => {
  await mockAttune(page, { reply: "fail" });
  await login(page, "parent@playhub.local");
  await page.goto("/attune");
  await page.getByLabel("Your question for Attune").fill("Compare toys");
  await page.keyboard.press("Enter");
  await expect(page.getByRole("alert").filter({ hasText: "couldn’t answer" })).toBeVisible();

  await page.unrouteAll({ behavior: "ignoreErrors" });
  const state = await mockAttune(page, {
    reply: "| Toy | Skill |\n|---|---|\n| Pegs | Pinch |\n| Beads | Grip |",
  });
  await page.getByRole("button", { name: "Try again" }).click();
  const table = page.getByRole("table");
  await expect(table).toBeVisible();
  await expect(table.getByRole("columnheader", { name: "Skill" })).toBeVisible();
  await expect(table.getByRole("cell", { name: "Beads" })).toBeVisible();
  expect(state.asked).toEqual(["Compare toys"]);

  const helpful = page.getByRole("button", { name: "Helpful answer" });
  await helpful.click();
  await expect(helpful).toHaveAttribute("aria-pressed", "true");
  await helpful.click();
  await expect(helpful).toHaveAttribute("aria-pressed", "false");
  expect(state.feedback).toEqual(["up", null]);
});

test("when today's questions are used up the composer explains why", async ({ page }) => {
  await mockAttune(page, { remaining: 0 });
  await login(page, "parent@playhub.local");
  await page.goto("/attune");
  const box = page.getByLabel("Your question for Attune");
  await expect(box).toBeDisabled();
  await expect(box).toHaveAttribute("placeholder", /today’s question limit/);
  await expect(page.getByText("0 of 30 left")).toBeVisible();
});

test("the dashboard's Attune bar asks its question straight away", async ({ page }) => {
  const state = await mockAttune(page, { reply: "Try a quick game of tweezers." });
  await login(page, "parent@playhub.local");
  await page.goto("/dashboard");
  const bar = page.getByRole("region", { name: "Ask Attune" });
  await expect(bar).toBeVisible();
  await bar.getByRole("link", { name: "Ideas for today" }).click();
  await expect(page).toHaveURL(/\/attune$/);
  await expect(page.getByText("Try a quick game of tweezers.")).toBeVisible();
  expect(state.asked).toHaveLength(1);
  expect(state.asked[0]).toMatch(/quick play idea/);
});

test("on a phone the chat history opens as a drawer", async ({ page }) => {
  await mockAttune(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await login(page, "parent@playhub.local");
  await page.goto("/attune");
  await page.getByRole("button", { name: "Show chat history" }).click();
  const drawer = page.getByRole("dialog", { name: "Your chats with Attune" });
  await expect(drawer.getByRole("button", { name: "New chat" })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(drawer).toHaveCount(0);
  const width = await page.evaluate(() => document.documentElement.scrollWidth);
  expect(width).toBeLessThanOrEqual(390);
});
