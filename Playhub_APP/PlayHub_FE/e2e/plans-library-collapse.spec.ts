import { expect, test } from "@playwright/test";
import { signIn } from "./support/signIn";

test("Play Plan cards start collapsed, open one at a time or all, and searching opens them", async ({
  page,
}) => {
  await signIn(page, "admin@playhub.local");
  await page.goto("/admin/plans");
  const plans = page.locator("section.ph-card");
  await expect(plans.first()).toBeVisible();
  const editDose = page.getByRole("button", { name: "Edit Play Dose", exact: true });
  await expect(editDose).toHaveCount(0);
  // Plan order and editing stay available while collapsed.
  await expect(
    plans.first().getByRole("button", { name: /^Move Play Plan .* down$/ }),
  ).toBeVisible();
  await expect(plans.first().getByRole("button", { name: "Edit Play Plan" })).toBeVisible();

  const name = (await plans.first().locator("h2").textContent())!;
  const toggle = page.getByRole("button", { name: `Show ${name} Play Doses` });
  await expect(toggle).toHaveAttribute("aria-expanded", "false");
  await toggle.click();
  const hide = page.getByRole("button", { name: `Hide ${name} Play Doses` });
  await expect(hide).toHaveAttribute("aria-expanded", "true");
  await expect(
    plans.first().getByRole("button", { name: "Edit Play Dose", exact: true }).first(),
  ).toBeVisible();
  await hide.click();
  await expect(editDose).toHaveCount(0);

  await page.getByRole("button", { name: "Expand all" }).click();
  expect(await editDose.count()).toBeGreaterThan(3);
  await page.getByRole("button", { name: "Collapse all" }).click();
  await expect(editDose).toHaveCount(0);

  // A search shows every match without opening cards by hand.
  await page.getByLabel("Search Play Plans").fill("Pencil");
  await expect(editDose.first()).toBeVisible();
  await page.getByLabel("Search Play Plans").fill("");
  await expect(editDose).toHaveCount(0);
});
