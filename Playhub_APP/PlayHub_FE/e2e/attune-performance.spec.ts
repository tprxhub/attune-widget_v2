import { expect, test } from "@playwright/test";
import { signIn } from "./support/signIn";

type RenderStats = { replies: number; commits: number };

test("long Attune history stays responsive while typing", async ({ page }) => {
  await page.addInitScript(() => {
    type Fiber = { type?: { name?: string }; flags: number; child?: Fiber; sibling?: Fiber };
    const stats = { replies: 0, commits: 0 };
    const renderers = new Map<number, unknown>();
    Object.assign(window, {
      __attuneStats: stats,
      __REACT_DEVTOOLS_GLOBAL_HOOK__: {
        supportsFiber: true,
        renderers,
        inject: (renderer: unknown) => {
          renderers.set(1, renderer);
          return 1;
        },
        onCommitFiberRoot: (_id: number, root: { current: Fiber }) => {
          stats.commits++;
          const pending = [root.current];
          while (pending.length) {
            const fiber = pending.pop()!;
            if (fiber.type?.name === "AttuneReply" && fiber.flags & 1) stats.replies++;
            if (fiber.child) pending.push(fiber.child);
            if (fiber.sibling) pending.push(fiber.sibling);
          }
        },
      },
    });
  });
  const now = new Date().toISOString();
  const chat = {
    id: "long",
    child_id: null,
    title: "Long conversation",
    created_at: now,
    updated_at: now,
  };
  const answer = Array.from(
    { length: 8 },
    (_, index) =>
      `### Play idea ${index + 1}\n\nTry **large wooden pegs** together. Offer one small choice, give time to respond, and celebrate the effort. ${"A calm short session keeps play comfortable. ".repeat(5)}\n\n- Set up the toys\n- Let the child explore\n- Stop on a win`,
  ).join("\n\n");
  const messages = Array.from({ length: 60 }, (_, index) => [
    {
      id: `q${index}`,
      role: "user",
      content: `Question ${index + 1}`,
      activity_id: null,
      created_at: now,
    },
    { id: `a${index}`, role: "assistant", content: answer, activity_id: null, created_at: now },
  ]).flat();
  await page.route("**/api/v1/attune/**", (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path.endsWith("/status"))
      return route.fulfill({
        json: { enabled: true, daily_limit: 30, used_today: 0, remaining_today: 30 },
      });
    if (path.endsWith("/conversations")) return route.fulfill({ json: [chat] });
    if (path.endsWith("/conversations/long")) return route.fulfill({ json: { ...chat, messages } });
    return route.fallback();
  });
  await signIn(page, "parent@playhub.local");
  await page.goto("/attune");
  await page.getByRole("button", { name: "Long conversation", exact: true }).click();
  await expect(page.getByText("Question 60", { exact: true })).toBeVisible();
  await expect
    .poll(() =>
      page.evaluate(
        () => (window as unknown as { __attuneStats: RenderStats }).__attuneStats.replies,
      ),
    )
    .toBeGreaterThan(0);
  await page.evaluate(() => {
    const stats = (window as unknown as { __attuneStats: RenderStats }).__attuneStats;
    stats.replies = 0;
    stats.commits = 0;
  });
  const start = Date.now();
  const text = "How can we try a calmer play session today?";
  await page.getByLabel("Your question for Attune").pressSequentially(text);
  await expect(page.getByLabel("Your question for Attune")).toHaveValue(text);
  const stats = await page.evaluate(
    () => (window as unknown as { __attuneStats: RenderStats }).__attuneStats,
  );
  expect(stats.replies).toBeLessThan(60);
  console.log(
    JSON.stringify({
      workload: "60 saved answers, 42 typed characters",
      elapsedMs: Date.now() - start,
      ...stats,
    }),
  );
});
