import { expect, test } from "@playwright/test";
import { snapshotHomepage } from "./support/homepageSnapshot";
import { signIn } from "./support/signIn";

test("the Super Admin edits the progress chart heading, points and badge", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await signIn(page, "admin@playhub.local");
  const restore = await snapshotHomepage(page);
  await page.goto("/admin/homepage");
  const open = () =>
    page
      .getByRole("navigation", { name: "Editor sections" })
      .getByRole("button", { name: "Progress chart", exact: true })
      .click();
  await open();
  const section = page.locator("#home-section-progress");
  const fields = {
    eyebrow: section.getByLabel("Small heading", { exact: true }),
    title: section.getByLabel("Heading, first part", { exact: true }),
    highlight: section.getByLabel("Heading, highlighted part", { exact: true }),
    badge: section.getByLabel("Sample badge", { exact: true }),
    point: section.getByLabel("Title", { exact: true }).nth(1),
    body: section.getByLabel("Description", { exact: true }).nth(2),
  };
  const edited = {
    eyebrow: "Watch them grow",
    title: "Every session, in one",
    highlight: "clear picture",
    badge: "Sample only · not a real child",
    point: "Inside one Play Dose",
    body: "Each finished dose ends with a next step.",
  };
  for (const [k, f] of Object.entries(fields)) await f.fill(edited[k as keyof typeof edited]);
  await page.getByRole("button", { name: "Save changes", exact: true }).click();
  await expect(page.getByRole("status")).not.toContainText("unsaved changes");
  try {
    await page.goto("/");
    const block = page.locator('[aria-labelledby="sample-progress-title"]');
    await expect(block).toContainText("Watch them grow");
    await expect(page.locator("#sample-progress-title")).toHaveText(
      "Every session, in one clear picture",
    );
    await expect(block).toContainText("Sample only · not a real child");
    await expect(block).toContainText("Inside one Play Dose");
    await expect(block).toContainText("Each finished dose ends with a next step.");
  } finally {
    await restore();
  }
});
