import { expect, test } from "@playwright/test";

test("Play Pulse shows a labelled step tracker that advances with the quiz", async ({ page }) => {
  await page.goto("/play-pulse");
  const steps = page.getByRole("navigation", { name: "Play Pulse steps" }).getByRole("listitem");
  await expect(steps).toHaveCount(7);
  await expect(steps.nth(0)).toHaveAttribute("aria-current", "step");
  await expect(steps.nth(0)).toContainText("About");

  await page.getByPlaceholder("e.g. Zayd").fill("Kai");
  await page.getByRole("button", { name: /Preschooler/ }).click();
  await page.getByRole("button", { name: /Choose a goal/ }).click();
  await expect(steps.nth(1)).toHaveAttribute("aria-current", "step");
  await expect(steps.nth(1)).toContainText("Goal");
});
