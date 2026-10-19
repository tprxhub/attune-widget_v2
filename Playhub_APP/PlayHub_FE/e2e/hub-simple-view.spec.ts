import { expect, test } from "@playwright/test";
import { signIn } from "./support/signIn";

test("the simple Hub view is the default and keeps the same destinations", async ({ page }) => {
  await signIn(page, "esther@sunrise.local");
  await page.goto("/hub");

  const hub = page.locator(".hub-launcher");
  await expect(hub).toHaveAttribute("data-view-mode", "simple");
  // Organisation staff only get the simple view.
  await expect(page.getByRole("group", { name: "Hub view" })).toHaveCount(0);
  await expect(page.locator("[data-simple-profile]")).toHaveAttribute("href", "/dashboard");
  await expect(page.locator('[data-simple-destination="/org"]')).toContainText("Members");
  await expect(page.locator('[data-simple-destination="/attune"]')).toContainText("Ask Attune");
  await expect(page.locator('[data-simple-destination="/plans"]')).toContainText("Play Plans");
  await expect(page.locator("[data-simple-destination]")).toHaveCount(6);
  // Admins and Moderators get four shortcut places.
  for (const slot of [1, 2, 3, 4]) {
    await expect(page.getByRole("button", { name: `Add shortcut ${slot}` })).toBeVisible();
  }
  await expect(page.getByRole("button", { name: "Add shortcut 5" })).toHaveCount(0);
  const firstTile = await page.locator("[data-simple-destination]").nth(0).boundingBox();
  const secondTile = await page.locator("[data-simple-destination]").nth(1).boundingBox();
  const header = await page.locator(".hub-main-header").boundingBox();
  const profile = await page.locator("[data-simple-profile]").boundingBox();
  expect(firstTile).not.toBeNull();
  expect(secondTile).not.toBeNull();
  expect(header).not.toBeNull();
  expect(profile).not.toBeNull();
  expect(secondTile!.x - firstTile!.x - firstTile!.width).toBeGreaterThanOrEqual(24);
  expect(profile!.y - header!.y - header!.height).toBeGreaterThanOrEqual(88);
  const lastShortcut = await page.getByRole("button", { name: "Add shortcut 4" }).boundingBox();
  const customize = await page
    .getByRole("button", { name: "Customize", exact: true })
    .boundingBox();
  const customizeGap = customize!.y - lastShortcut!.y - lastShortcut!.height;
  expect(customizeGap).toBeGreaterThanOrEqual(24);
  expect(customizeGap).toBeLessThanOrEqual(48);
  await page.getByRole("button", { name: "Customize", exact: true }).click();
  const editingShortcut = await page.getByRole("button", { name: "Add shortcut 4" }).boundingBox();
  const footer = await page.locator(".hub-footer").boundingBox();
  expect(footer!.y - editingShortcut!.y - editingShortcut!.height).toBeGreaterThanOrEqual(64);
  await page.getByRole("button", { name: "Done", exact: true }).click();
  await page.screenshot({ path: "../../output/hub-design/simple-default.png" });
  await page.setViewportSize({ width: 900, height: 900 });
  await expect
    .poll(() => page.evaluate(() => document.documentElement.scrollWidth))
    .toBeLessThanOrEqual(900);
  await page.screenshot({ path: "../../output/hub-design/simple-tablet.png" });
  await page.setViewportSize({ width: 390, height: 844 });
  await expect
    .poll(() => page.evaluate(() => document.documentElement.scrollWidth))
    .toBeLessThanOrEqual(390);
  await page.screenshot({ path: "../../output/hub-design/simple-mobile.png" });
  await page.setViewportSize({ width: 1280, height: 720 });

  await page.locator('[data-simple-destination="/org"]').click();
  await expect(page).toHaveURL(/\/org$/);
});

for (const email of ["free.parent@playhub.local", "moderator@playhub.local"]) {
  test(`${email} only gets the simple view, even with a saved detailed choice`, async ({
    page,
  }) => {
    await page.addInitScript(() => {
      const read = Storage.prototype.getItem;
      Storage.prototype.getItem = function (key: string) {
        const saved = read.call(this, key);
        if (!key.startsWith("play-hub-launcher:")) return saved;
        return JSON.stringify({ ...(saved ? JSON.parse(saved) : {}), viewMode: "detailed" });
      };
    });
    await signIn(page, email);
    await page.goto("/hub");
    await expect(page.locator(".hub-launcher")).toHaveAttribute("data-view-mode", "simple");
    await expect(page.getByRole("button", { name: "Detailed view" })).toHaveCount(0);
  });
}

for (const email of ["admin@playhub.local", "ttp@playhub.local"]) {
  test(`${email} can switch between the simple and detailed views`, async ({ page }) => {
    await signIn(page, email);
    await page.goto("/hub");
    const hub = page.locator(".hub-launcher");
    await expect(hub).toHaveAttribute("data-view-mode", "simple");
    await page.getByRole("button", { name: "Detailed view" }).click();
    await expect(hub).toHaveAttribute("data-view-mode", "detailed");
    await expect(page.locator('[data-hub-card-id="apps"]')).toBeVisible();
    await page.reload();
    await expect(hub).toHaveAttribute("data-view-mode", "detailed");
    await page.getByRole("button", { name: "Simple view" }).click();
    await page.reload();
    await expect(hub).toHaveAttribute("data-view-mode", "simple");
  });
}

test("an empty shortcut slot adds a shortcut, not a tile", async ({ page }) => {
  await signIn(page, "admin@playhub.local");
  await page.goto("/hub");
  await page.getByRole("button", { name: "Add shortcut 1" }).click();
  const dialog = page.getByRole("dialog", { name: "Add shortcut" });
  await expect(dialog).toBeVisible();
  await dialog.getByRole("button", { name: "Play Pulse leads" }).click();
  await expect(page.locator("[data-simple-destination]")).toHaveCount(6);
  await expect(page.locator('.hub-simple-shortcuts a[href="/admin/play-pulse"]')).toContainText(
    "Play Pulse leads",
  );
  await expect(page.getByRole("button", { name: "Add shortcut 2" })).toBeVisible();
  // A Super Admin has two shortcut places.
  await expect(page.getByRole("button", { name: "Add shortcut 3" })).toHaveCount(0);
  // The toolbar's Add Tile still adds tiles.
  await page.getByRole("button", { name: "Add Tile", exact: true }).click();
  await page
    .getByRole("dialog", { name: "Add Tile" })
    .getByRole("button", { name: "Audit log" })
    .click();
  await expect(page.locator("[data-simple-destination]")).toHaveCount(7);
  await page.getByRole("button", { name: "Done", exact: true }).click();
  await page.reload();
  await expect(page.locator('.hub-simple-shortcuts a[href="/admin/play-pulse"]')).toBeVisible();
});

test("the profile card photo can be changed and reset", async ({ page }) => {
  await signIn(page, "esther@sunrise.local");
  await page.goto("/hub");
  const photo = page.locator(".hub-simple-profile-image");
  const original = await photo.getAttribute("src");
  await page.getByRole("button", { name: "Customize", exact: true }).click();
  await page.getByLabel("Change photo").setInputFiles({
    name: "photo.png",
    mimeType: "image/png",
    buffer: Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAIAAAD91JpzAAAAFklEQVR4nGP8z8DAwMDAxMDAwMDAAAANHQEDasKb6QAAAABJRU5ErkJggg==",
      "base64",
    ),
  });
  await expect(photo).toHaveAttribute("src", /^data:image\/jpeg/);
  await page.getByRole("button", { name: "Done", exact: true }).click();
  await page.reload();
  await expect(photo).toHaveAttribute("src", /^data:image\/jpeg/);
  await page.getByRole("button", { name: "Customize", exact: true }).click();
  await page.getByRole("button", { name: "Reset photo" }).click();
  await expect(photo).toHaveAttribute("src", original!);
});

test("quick-view shortcuts use the existing card customization flow", async ({ page }) => {
  await signIn(page, "free.parent@playhub.local");
  await page.goto("/hub");
  await expect(page.locator(".hub-launcher")).toHaveAttribute("data-view-mode", "simple");

  await page.getByRole("button", { name: "Add shortcut 1" }).click();
  await expect(page.locator(".hub-launcher")).toHaveAttribute("data-view-mode", "simple");
  await expect(page.locator(".hub-simple-grid")).toBeVisible();
  await expect(page.locator(".hub-grid")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Done", exact: true })).toBeVisible();
  await expect(page.getByRole("dialog", { name: "Add shortcut" })).toBeVisible();
  await page.getByText("Custom shortcut", { exact: true }).click();
  await page.getByLabel("New card title").fill("My shortcut");
  await page.getByRole("button", { name: "Add card" }).click();
  await page.getByRole("button", { name: "Done", exact: true }).click();
  await expect(page.locator(".hub-launcher")).toHaveAttribute("data-view-mode", "simple");
  await expect(page.getByRole("link", { name: "My shortcut" })).toHaveAttribute("href", "/plans");
  await page.getByRole("button", { name: "Customize", exact: true }).click();
  await page.getByRole("button", { name: "Remove My shortcut" }).click();
  await page.getByRole("button", { name: "Done", exact: true }).click();
  await page.reload();
  await expect(page.getByRole("link", { name: "My shortcut" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Add shortcut 1" })).toBeVisible();
});

test("simple service cards can be dragged and keep their order", async ({ page }) => {
  await signIn(page, "admin@playhub.local");
  await page.goto("/hub");
  await page.getByRole("button", { name: "Customize", exact: true }).click();

  const children = page.locator('[data-simple-destination="/admin/children"]');
  const progress = page.locator('[data-simple-destination="/admin/progress"]');
  await children.evaluate((element) =>
    element.scrollIntoView({ block: "center", behavior: "instant" }),
  );
  const source = await children.boundingBox();
  const target = await progress.boundingBox();
  expect(source).not.toBeNull();
  expect(target).not.toBeNull();
  await page.mouse.move(source!.x + source!.width / 2, source!.y + source!.height / 2);
  await page.mouse.down();
  await page.mouse.move(target!.x + target!.width / 2, target!.y + target!.height / 2, {
    steps: 12,
  });
  await expect(page.locator('.hub-simple-tile-wrap[data-dragging="true"]')).toHaveCount(1);
  await page.mouse.up();
  await expect(page.locator("[data-simple-destination]").nth(2)).toHaveAttribute(
    "data-simple-destination",
    "/admin/children",
  );

  await page.getByRole("button", { name: "Done", exact: true }).click();
  await page.reload();
  await expect(page.locator("[data-simple-destination]").nth(2)).toHaveAttribute(
    "data-simple-destination",
    "/admin/children",
  );
});

test("simple shortcuts can be dragged without changing views", async ({ page }) => {
  await signIn(page, "free.parent@playhub.local");
  await page.goto("/hub");
  await page.getByRole("button", { name: "Customize", exact: true }).click();

  for (const title of ["First shortcut", "Second shortcut"]) {
    await page
      .getByRole("button", { name: /Add shortcut \d/ })
      .first()
      .click();
    await page.getByText("Custom shortcut", { exact: true }).click();
    await page.getByLabel("New card title").fill(title);
    await page.getByRole("button", { name: "Add card" }).click();
  }

  const shortcuts = page.locator(".hub-simple-shortcut-wrap");
  await expect(shortcuts).toHaveCount(2);
  await shortcuts
    .first()
    .evaluate((element) => element.scrollIntoView({ block: "center", behavior: "instant" }));
  const source = await shortcuts.first().boundingBox();
  const target = await shortcuts.nth(1).boundingBox();
  expect(source).not.toBeNull();
  expect(target).not.toBeNull();
  await page.mouse.move(source!.x + source!.width / 2, source!.y + source!.height / 2);
  await page.mouse.down();
  await page.mouse.move(target!.x + target!.width / 2, target!.y + target!.height / 2, {
    steps: 12,
  });
  await expect(page.locator('.hub-simple-shortcut-wrap[data-dragging="true"]')).toHaveCount(1);
  await expect(shortcuts.nth(1)).toHaveAttribute("data-drag-over", "true");
  await page.mouse.up();
  await expect(shortcuts.first()).toContainText("Second shortcut");
  await expect(page.locator(".hub-launcher")).toHaveAttribute("data-view-mode", "simple");
  await page.getByRole("button", { name: "Done", exact: true }).click();
  await page.reload();
  await expect(shortcuts.first()).toContainText("Second shortcut");
});

test("the profile tile and service links keep platform routes", async ({ page }) => {
  await signIn(page, "admin@playhub.local");
  await page.goto("/hub");

  await expect(page.locator("[data-simple-destination]")).toHaveCount(6);
  await expect(page.getByRole("button", { name: "Add shortcut 1" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Add shortcut 2" })).toBeVisible();
  await expect(page.locator('[data-simple-destination="/admin/audit"]')).toHaveCount(0);
  await expect(page.locator("[data-simple-profile]")).toHaveAttribute("href", "/admin");
  await expect(page.locator('[data-simple-destination="/admin/children"]')).toContainText(
    "Members",
  );
  await expect(page.locator('[data-simple-destination="/admin/progress"]')).toContainText(
    "Progress",
  );
  await page.getByRole("button", { name: "Customize", exact: true }).click();
  await expect(page.locator(".hub-launcher")).toHaveAttribute("data-view-mode", "simple");
  await expect(page.locator(".hub-simple-grid")).toBeVisible();
  await expect(page.locator(".hub-grid")).toHaveCount(0);
  await page.getByRole("button", { name: "Add Tile", exact: true }).click();
  await page
    .getByRole("dialog", { name: "Add Tile" })
    .getByRole("button", { name: "Audit log" })
    .click();
  await expect(page.locator('[data-simple-destination="/admin/audit"]')).toBeVisible();
  await expect(page.locator("[data-simple-destination]")).toHaveCount(7);
  const addedTile = await page.locator('[data-simple-destination="/admin/audit"]').boundingBox();
  const cards = await page.locator(".hub-simple-cards").boundingBox();
  const firstShortcut = await page.getByRole("button", { name: "Add shortcut 1" }).boundingBox();
  const secondShortcut = await page.getByRole("button", { name: "Add shortcut 2" }).boundingBox();
  expect(addedTile).not.toBeNull();
  expect(cards).not.toBeNull();
  expect(firstShortcut).not.toBeNull();
  expect(secondShortcut).not.toBeNull();
  expect(
    Math.abs(addedTile!.x + addedTile!.width / 2 - cards!.x - cards!.width / 2),
  ).toBeLessThanOrEqual(2);
  expect(firstShortcut!.width).toBeLessThanOrEqual(270);
  expect(firstShortcut!.height).toBeLessThanOrEqual(120);
  expect(Math.abs(firstShortcut!.y - secondShortcut!.y)).toBeLessThanOrEqual(1);
  expect(firstShortcut!.y - addedTile!.y - addedTile!.height).toBeGreaterThanOrEqual(20);
  for (const width of [900, 390]) {
    await page.setViewportSize({ width, height: 900 });
    const narrowCards = await page.locator(".hub-simple-cards").boundingBox();
    const narrowTile = await page.locator('[data-simple-destination="/admin/audit"]').boundingBox();
    expect(narrowCards).not.toBeNull();
    expect(narrowTile).not.toBeNull();
    expect(
      Math.abs(narrowTile!.x + narrowTile!.width / 2 - narrowCards!.x - narrowCards!.width / 2),
    ).toBeLessThanOrEqual(2);
    await expect
      .poll(() => page.evaluate(() => document.documentElement.scrollWidth))
      .toBeLessThanOrEqual(width);
  }
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.getByRole("button", { name: "Done", exact: true }).click();
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
  await page.screenshot({ path: "../../output/hub-design/simple-added-card.png", fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({
    path: "../../output/hub-design/simple-added-card-mobile.png",
    fullPage: true,
  });
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.reload();
  await expect(page.locator("[data-simple-destination]")).toHaveCount(7);
  await page.getByRole("button", { name: "Customize", exact: true }).click();
  await page.getByRole("button", { name: "Remove Audit log tile" }).click();
  await expect(page.locator("[data-simple-destination]")).toHaveCount(6);
  await page.getByRole("button", { name: "Done", exact: true }).click();
  await page.locator("[data-simple-profile]").click();
  await expect(page).toHaveURL(/\/admin$/);
});

test("Ask Attune keeps a visible icon when dragged onto a cream tile", async ({ page }) => {
  await signIn(page, "admin@playhub.local");
  await page.goto("/hub");
  await page.getByRole("button", { name: "Customize", exact: true }).click();

  const attune = page.locator('[data-simple-destination="/attune"]');
  const first = page.locator("[data-simple-destination]").first();
  await attune.evaluate((element) =>
    element.scrollIntoView({ block: "center", behavior: "instant" }),
  );
  const source = await attune.boundingBox();
  const target = await first.boundingBox();
  await page.mouse.move(source!.x + source!.width / 2, source!.y + source!.height / 2);
  await page.mouse.down();
  await page.mouse.move(target!.x + target!.width / 2, target!.y + target!.height / 2, {
    steps: 12,
  });
  await page.mouse.up();
  await expect(first).toHaveAttribute("data-simple-destination", "/attune");
  await expect(attune).toHaveAttribute("data-tone", "cream");
  const image = attune.locator(".hub-simple-attune-image");
  await expect(image).toHaveCSS("mix-blend-mode", "multiply");
  await expect(image).toHaveCSS("filter", "none");
  await page.getByRole("button", { name: "Done", exact: true }).click();
  await attune.screenshot({ path: "../../output/hub-design/simple-attune-cream.png" });
});
