import { expect, test } from "@playwright/test";

test("Play Pulse shows the heartbeat progress without a step tracker", async ({ page }) => {
  await page.goto("/play-pulse");
  await expect(page.getByRole("navigation", { name: "Play Pulse steps" })).toHaveCount(0);

  await page.getByPlaceholder("e.g. Zayd").fill("Kai");
  await page.getByRole("button", { name: /Preschooler/ }).click();
  await page.getByRole("button", { name: /Choose a goal/ }).click();
  await expect(page.getByRole("button", { name: /Start the quick check/ })).toBeVisible();
});
