import { expect, test, type Locator, type Page } from "@playwright/test";
import { signIn } from "./support/signIn";

async function holdCardOver(page: Page, source: Locator, target: Locator) {
  await source.evaluate((element) =>
    element.scrollIntoView({ block: "center", behavior: "instant" }),
  );
  const sourceBox = (await source.boundingBox())!;
  await page.mouse.move(sourceBox.x + 40, sourceBox.y + 40);
  await page.mouse.down();
  await target.evaluate((element) =>
    element.scrollIntoView({ block: "center", behavior: "instant" }),
  );
  const targetBox = (await target.boundingBox())!;
  const targetScroll = await page.evaluate(() => window.scrollY);
  const point = { x: targetBox.x + targetBox.width / 2, y: targetBox.y + targetBox.height / 2 };
  await page.mouse.move(point.x, point.y, { steps: 12 });
  await expect(source).toHaveAttribute("data-dragging", "true");
  return { sourceBox, targetBox, point, targetScroll };
}

test("Open Hub shows the signed-in launch screen before the dashboard", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await signIn(page, "free.parent@playhub.local");
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await page.getByRole("banner").getByRole("link", { name: "Open Hub" }).click();

  await expect(page).toHaveURL(/\/hub$/);
  await expect(page.getByRole("heading", { name: "Noor", exact: true })).toBeVisible();
  await expect(page.locator('[data-hub-card-id="apps"]')).toBeVisible();
  await expect(page.getByRole("heading", { name: "Ask Attune", exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: "Play Plans" }).first()).toBeVisible();
  await expect(page.getByRole("heading", { name: "Daily Check-In" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Progress" }).last()).toBeVisible();
  const hubHeader = page.locator("main > header");
  await page.evaluate(() => window.scrollTo(0, 700));
  await expect(hubHeader).toHaveCSS("position", "sticky");
  await expect(hubHeader).toHaveCSS("top", "0px");
  await expect.poll(async () => (await hubHeader.boundingBox())?.y).toBe(0);
  await page.evaluate(() => window.scrollTo(0, 0));

  await page.getByRole("button", { name: "Customize" }).click();
  await expect(page.getByRole("button", { name: "Done", exact: true })).toBeVisible();
  await expect(page.locator('[data-hub-card-id="profile"] button')).toHaveCount(0);
  const plansCard = page.locator("article").filter({
    has: page.getByRole("heading", { name: "Play Plans", exact: true }),
  });
  await expect(plansCard).toHaveCSS("order", "1");
  const profileCard = page.locator('[data-hub-card-id="profile"]');
  const progressCard = page.locator('[data-hub-card-id="progress"]');
  const appsCard = page.locator('[data-hub-card-id="apps"]');
  const attuneCard = page.locator('[data-hub-card-id="attune"]');
  const dragCardTo = async (source: typeof plansCard, target: typeof appsCard) => {
    const { targetScroll } = await holdCardOver(page, source, target);
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(targetScroll);
    await expect(target).toHaveAttribute("data-drag-over", "true");
    await page.mouse.up();
  };
  await dragCardTo(plansCard, attuneCard);
  await expect(plansCard).toHaveCSS("order", "5");
  await expect(page).toHaveURL(/\/hub$/);
  await expect(profileCard).toHaveCSS("order", "0");
  await dragCardTo(plansCard, appsCard);
  await expect(plansCard).toHaveCSS("order", "1");
  await plansCard.getByRole("button", { name: "Card options for Play Plans" }).click();
  await page.getByText("Tile settings", { exact: true }).click();
  await page.getByRole("button", { name: "Make narrow Play Plans" }).click();
  await expect(plansCard).toHaveClass(/col-span-1/);
  await page.getByRole("button", { name: "Make wide Play Plans" }).click();
  await expect(plansCard).toHaveClass(/sm:col-span-2/);
  await appsCard.getByRole("button", { name: "Card options for Apps" }).click();
  await page.getByText("Tile settings", { exact: true }).click();
  await page.getByLabel("Apps card title").fill("My Apps");
  await expect(page.getByRole("heading", { name: "My Apps" })).toBeVisible();
  await page.getByLabel("My Apps card title").fill("Apps");

  await page.getByRole("button", { name: "Remove Daily Check-In card" }).click();
  await expect(page.getByRole("heading", { name: "Daily Check-In" })).toHaveCount(0);
  await page.getByRole("button", { name: "Add Tile" }).click();
  await page.getByRole("button", { name: "Restore Daily Check-In" }).click();

  await page.getByRole("button", { name: "Add Tile" }).click();
  await page.getByText("Custom shortcut", { exact: true }).click();
  await page.getByLabel("New card title").fill("My Shortcut");
  await page.getByRole("button", { name: "Add card" }).click();
  await expect(page.getByRole("heading", { name: "My Shortcut" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Open My Shortcut" })).toHaveAttribute(
    "href",
    "/plans",
  );

  await page.getByRole("button", { name: "Select Background Color" }).click();
  await page.getByRole("button", { name: "green background" }).click();
  await page.getByRole("button", { name: "Remove Daily Check-In", exact: true }).click();
  await page.getByRole("button", { name: "Add Tile" }).click();
  await page.getByRole("button", { name: "Restore Daily Check-In app", exact: true }).click();
  await page.getByRole("button", { name: "Done" }).click();
  await expect(page.getByRole("button", { name: "Customize" })).toBeVisible();

  await expect(page.locator("footer")).toContainText("Privacy policy");
  await expect(page.locator("footer")).not.toContainText("Get started free");

  await page.getByRole("button", { name: "Open Apps", exact: true }).click();
  await page
    .getByRole("dialog", { name: "Apps", exact: true })
    .getByRole("link", { name: "Dashboard", exact: true })
    .click();
  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(page.getByRole("heading", { name: "Here's your Play Hub" })).toBeVisible();
});

test("dragging a narrow card into Apps previews slot widths and pushes cards forward", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 1060 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await signIn(page, "free.parent@playhub.local");
  await page.goto("/hub");
  await page.getByRole("button", { name: "Customize", exact: true }).click();
  const source = page.locator('[data-hub-card-id="check-ins"]');
  const apps = page.locator('[data-hub-card-id="apps"]');
  const progress = page.locator('[data-hub-card-id="progress"]');
  const saved = await page.evaluate(
    () => Object.entries(localStorage).find(([key]) => key.startsWith("play-hub-launcher:"))?.[1],
  );
  const { targetBox, point } = await holdCardOver(page, source, apps);
  await expect(source).toHaveCSS("order", "2");
  await expect(source).toHaveAttribute("data-card-width", "wide");
  await expect(apps).toHaveCSS("order", "3");
  await expect(apps).toHaveAttribute("data-card-width", "narrow");
  await expect(progress).toHaveCSS("order", "4");
  await expect(page.locator(".hub-drag-placeholder")).toHaveCSS("width", `${targetBox.width}px`);
  for (let step = 0; step < 8; step++) {
    await page.mouse.move(point.x + (step % 2), point.y + (step % 2));
    await page.evaluate(() => new Promise(requestAnimationFrame));
  }
  await expect(source).toHaveCSS("order", "2");
  expect(
    await page.evaluate(
      () => Object.entries(localStorage).find(([key]) => key.startsWith("play-hub-launcher:"))?.[1],
    ),
  ).toBe(saved);
  await page.screenshot({ path: "../../output/hub-design/drag-slot-preview.png" });
  await page.mouse.up();
  await expect(page.locator(".hub-drag-placeholder")).toHaveCount(0);
  await expect(source).toHaveCSS("width", `${targetBox.width}px`);
  await page.getByRole("button", { name: "Done", exact: true }).click();
  await page.reload();
  await expect(source).toHaveCSS("order", "2");
  await expect(source).toHaveAttribute("data-card-width", "wide");
  await expect(apps).toHaveCSS("order", "3");
  await expect(apps).toHaveAttribute("data-card-width", "narrow");
  await expect(progress).toHaveCSS("order", "4");
  await expect(page.locator('[data-hub-card-id="profile"]')).toHaveCSS("order", "0");
  await page.mouse.move(5, 75);
  await page.screenshot({ path: "../../output/hub-design/drag-slot-saved.png" });
});

test("canceling a wide-to-narrow preview restores layout; keyboard moves use the same slots", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await signIn(page, "free.parent@playhub.local");
  await page.goto("/hub");
  await page.getByRole("button", { name: "Customize", exact: true }).click();
  const apps = page.locator('[data-hub-card-id="apps"]');
  const progress = page.locator('[data-hub-card-id="progress"]');
  await holdCardOver(page, apps, progress);
  await expect(apps).toHaveAttribute("data-card-width", "narrow");
  await expect(progress).toHaveAttribute("data-card-width", "wide");
  await page.keyboard.press("Escape");
  await page.mouse.up();
  await expect(apps).toHaveCSS("order", "2");
  await expect(apps).toHaveAttribute("data-card-width", "wide");
  await expect(progress).toHaveAttribute("data-card-width", "narrow");
  await holdCardOver(page, apps, progress);
  await page.mouse.move(5, 300);
  await page.mouse.up();
  await expect(apps).toHaveCSS("order", "2");
  await expect(apps).toHaveAttribute("data-card-width", "wide");
  await expect(progress).toHaveAttribute("data-card-width", "narrow");
  await expect(page.locator(".hub-drag-placeholder")).toHaveCount(0);
  const checkIn = page.locator('[data-hub-card-id="check-ins"]');
  await checkIn.focus();
  await page.keyboard.press("Alt+ArrowUp");
  await page.keyboard.press("Alt+ArrowUp");
  await expect(checkIn).toHaveCSS("order", "2");
  await expect(checkIn).toHaveAttribute("data-card-width", "wide");
  await expect(apps).toHaveCSS("order", "3");
  await expect(apps).toHaveAttribute("data-card-width", "narrow");
  await page.reload();
  await expect(checkIn).toHaveCSS("order", "2");
  await expect(checkIn).toHaveAttribute("data-card-width", "wide");
});

test("brand wallpaper, upload, reset, and color theme persist together", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await signIn(page, "free.parent@playhub.local");
  await page.goto("/hub");
  const hub = page.locator(".hub-launcher");
  await expect(hub).toHaveAttribute("data-background-mode", "wallpaper");
  await expect(page.locator(".hub-wallpaper-image")).toHaveAttribute(
    "src",
    /Brand(?:%20| )pattern/,
  );
  const hubFooter = page.locator(".hub-footer-surface");
  const initialFooterBackground = await hubFooter.evaluate(
    (element) => getComputedStyle(element).backgroundImage,
  );
  await page.getByRole("button", { name: "Customize", exact: true }).click();
  await page.getByRole("button", { name: "Select Background Color" }).click();
  await page.getByRole("button", { name: "red background" }).click();
  await expect(hub).toHaveAttribute("data-theme", "red");
  await expect(hub).toHaveAttribute("data-background-mode", "color");
  await expect(hubFooter).not.toHaveCSS("background-image", initialFooterBackground);
  await expect(page.locator('.hub-card[data-card-kind="plans"] .hub-card-header')).toHaveCSS(
    "background-image",
    /rgb\(96, 59, 61\)/,
  );
  await expect(page.locator('.hub-card[data-card-kind="plans"] .hub-card-header')).not.toHaveCSS(
    "background-image",
    /rgb\(60, 72, 100\)/,
  );
  await page.getByRole("button", { name: "Done", exact: true }).click();
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({ path: "../../output/hub-design/theme-red-coordinated.png" });
  await page.getByRole("button", { name: "Customize", exact: true }).click();
  await page.getByRole("button", { name: "Choose Wallpaper" }).click();
  const wallpaper = page.getByRole("dialog", { name: "Wallpaper options" });
  await wallpaper.getByRole("button", { name: "Brand wallpaper" }).click();
  await expect(hub).toHaveAttribute("data-background-mode", "wallpaper");
  await page.getByRole("button", { name: "Choose Wallpaper" }).click();
  await wallpaper
    .getByLabel("Upload a wallpaper")
    .setInputFiles("src/assets/Icon_of_Service/Brand pattern.png");
  await expect(page.locator(".hub-wallpaper-image")).toHaveAttribute("src", /^data:image\/jpeg/);
  await page.getByRole("button", { name: "Done", exact: true }).click();
  await page.reload();
  await expect(page.locator(".hub-wallpaper-image")).toHaveAttribute("src", /^data:image\/jpeg/);
  await page.getByRole("button", { name: "Customize", exact: true }).click();
  await page.getByRole("button", { name: "Choose Wallpaper" }).click();
  await wallpaper.getByRole("button", { name: "Reset to brand wallpaper" }).click();
  await expect(page.locator(".hub-wallpaper-image")).toHaveAttribute(
    "src",
    /Brand(?:%20| )pattern/,
  );
  await page.getByRole("button", { name: "Choose Wallpaper" }).click();
  await wallpaper.getByRole("button", { name: "Use background color" }).click();
  await expect(hub).toHaveAttribute("data-theme", "red");
  await expect(hub).toHaveAttribute("data-background-mode", "color");
  await page.setViewportSize({ width: 320, height: 800 });
  await expect
    .poll(() => page.evaluate(() => document.documentElement.scrollWidth))
    .toBeLessThanOrEqual(320);
  await expect(page.getByRole("button", { name: "Choose Wallpaper" })).toBeVisible();
});

test("organisation shortcut cards show live moderator, member, and dashboard details", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await signIn(page, "esther@sunrise.local");
  await page.goto("/hub");
  await page.getByRole("button", { name: "Customize", exact: true }).click();
  for (const title of ["Dashboard", "Moderators", "Members"]) {
    await page.getByRole("button", { name: "Add Tile", exact: true }).click();
    await page
      .getByRole("dialog", { name: "Add Tile", exact: true })
      .getByRole("button", { name: title, exact: true })
      .click();
  }
  const dashboard = page
    .locator('[data-hub-card-id^="custom-"]')
    .filter({ has: page.getByRole("heading", { name: "Dashboard", exact: true }) });
  const moderators = page
    .locator('[data-hub-card-id^="custom-"]')
    .filter({ has: page.getByRole("heading", { name: "Moderators", exact: true }) });
  const members = page
    .locator('[data-hub-card-id^="custom-"]')
    .filter({ has: page.getByRole("heading", { name: "Members", exact: true }) });
  await expect(moderators.getByLabel("Moderator information")).toContainText("Priya Raman");
  await expect(moderators.getByLabel("Moderator information")).not.toContainText("Alex Morgan");
  await expect(members.getByLabel("Member information")).toContainText("Amira");
  await expect(dashboard.getByLabel("Dashboard summary")).toContainText("members");
  await expect(dashboard.getByRole("link", { name: "Open Dashboard" })).toHaveAttribute(
    "href",
    "/dashboard",
  );
  await expect(members.getByRole("link", { name: "Open Members" })).toHaveAttribute("href", "/org");
  const dashboardApp = page
    .locator('[data-hub-card-id="apps"]')
    .getByRole("link", { name: "Dashboard", exact: true });
  await page.getByRole("button", { name: "Done", exact: true }).click();
  await expect(dashboardApp).toHaveAttribute("href", "/dashboard");
  await page.evaluate(() => {
    const key = Object.keys(localStorage).find((item) => item.startsWith("play-hub-launcher:"));
    if (!key) throw new Error("Missing saved Hub preferences");
    const preferences = JSON.parse(localStorage.getItem(key) ?? "{}");
    preferences.customCards = preferences.customCards.map((card: { title: string; to: string }) =>
      card.title === "Dashboard" ? { ...card, to: "/org" } : card,
    );
    localStorage.setItem(key, JSON.stringify(preferences));
  });
  await page.reload();
  await expect(dashboard.getByRole("link", { name: "Open Dashboard" })).toHaveAttribute(
    "href",
    "/dashboard",
  );
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({
    path: "../../output/hub-design/org-shortcut-details.png",
    fullPage: true,
  });
  await dashboardApp.click();
  await expect(page).toHaveURL(/\/dashboard$/);
});

test("Customize jiggles movable cards without interrupting controls or reduced-motion preferences", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await signIn(page, "free.parent@playhub.local");
  await page.goto("/hub");
  await page.getByRole("button", { name: "Customize", exact: true }).click();
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.mouse.click(10, 200);

  const plans = page.locator('[data-hub-card-id="plans"]');
  const progress = page.locator('[data-hub-card-id="progress"]');
  const profile = page.locator('[data-hub-card-id="profile"]');
  const isJiggling = (card: Locator) =>
    card.evaluate((element) =>
      element
        .getAnimations()
        .some(
          (animation) =>
            animation instanceof CSSAnimation &&
            animation.animationName === "hub-edit-jiggle" &&
            animation.playState === "running",
        ),
    );
  await expect.poll(() => isJiggling(plans)).toBe(true);
  await expect.poll(() => isJiggling(profile)).toBe(false);
  const firstRotation = await plans.evaluate((element) => getComputedStyle(element).rotate);
  await expect
    .poll(() => plans.evaluate((element) => getComputedStyle(element).rotate))
    .not.toBe(firstRotation);

  const options = plans.getByRole("button", { name: "Card options for Play Plans" });
  await options.hover({ force: true });
  await expect.poll(() => isJiggling(plans)).toBe(false);
  await options.click();
  await page.getByText("Tile settings", { exact: true }).click();
  await page.getByRole("button", { name: "Make narrow Play Plans" }).click();
  await expect.poll(() => isJiggling(progress)).toBe(true);
  await page.getByRole("button", { name: "Make wide Play Plans" }).click();
  await options.click();
  await page.mouse.click(10, 200);
  await expect.poll(() => isJiggling(plans)).toBe(true);

  await page.getByRole("button", { name: "Done", exact: true }).click();
  await expect.poll(() => isJiggling(plans)).toBe(false);
  await page.getByRole("button", { name: "Customize", exact: true }).click();
  await page.emulateMedia({ reducedMotion: "reduce" });
  await expect.poll(() => isJiggling(plans)).toBe(false);
  await expect.poll(() => isJiggling(progress)).toBe(false);
});

test("Hub icon pickers replace and add real tiles and save all six background choices", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await signIn(page, "free.parent@playhub.local");
  await page.goto("/hub");
  const appsTrigger = page.getByRole("button", { name: "Open Apps", exact: true });
  await appsTrigger.press("Enter");
  const appsMenu = page.getByRole("dialog", { name: "Apps", exact: true });
  await expect(appsMenu.getByRole("link", { name: "Dashboard", exact: true })).toBeFocused();
  await expect(appsMenu.getByRole("link", { name: "Dashboard", exact: true })).toHaveAttribute(
    "href",
    "/dashboard",
  );
  await expect(appsMenu.getByRole("link", { name: "Your Progress", exact: true })).toHaveAttribute(
    "href",
    "/progress",
  );
  await page.keyboard.press("Escape");
  await expect(appsMenu).toHaveCount(0);
  await expect(appsTrigger).toBeFocused();
  await appsTrigger.click();
  await appsMenu.getByRole("button", { name: "Customize Home Page" }).click();

  const slot = page.locator('[data-hub-card-id="plans"]');
  await slot.getByRole("button", { name: "Card options for Play Plans" }).click();
  const replacementPicker = page.getByRole("dialog", { name: "Choose tile for Play Plans" });
  await expect(replacementPicker.getByRole("heading")).toHaveText("Which tile do you want to use?");
  await expect(
    replacementPicker.getByRole("button", { name: "Play Plans", exact: true }),
  ).toBeDisabled();
  await replacementPicker.getByRole("button", { name: "Progress", exact: true }).click();
  await expect(slot).toHaveAttribute("data-card-kind", "progress");
  await expect(slot).toHaveCSS("order", "1");
  await expect(slot).toHaveAttribute("data-card-width", "wide");
  await expect(slot.getByRole("link", { name: "Session history" })).toBeVisible();

  await page.getByRole("button", { name: "Add Tile", exact: true }).click();
  const addPicker = page.getByRole("dialog", { name: "Add Tile", exact: true });
  await expect(addPicker.getByRole("heading")).toHaveText("Which tile do you want to add?");
  await addPicker.getByRole("button", { name: "Play Plans", exact: true }).click();
  const added = page.locator('[data-hub-card-id^="custom-"][data-card-kind="plans"]');
  await expect(added).toHaveCount(1);
  await added.getByRole("button", { name: "Play Plans display options" }).click();
  await expect(
    page
      .getByRole("dialog", { name: "Show Play Plans", exact: true })
      .getByRole("link", { name: "Browse all Play Plans" }),
  ).toHaveAttribute("href", "/plans");
  await page.keyboard.press("Escape");
  await expect(page.locator('[data-hub-card-id="profile"] button')).toHaveCount(0);

  const backgroundTrigger = page.getByRole("button", { name: "Select Background Color" });
  await backgroundTrigger.click();
  const colors = page.getByRole("dialog", { name: "Background colors" });
  await expect(colors.getByRole("button")).toHaveCount(6);
  for (const color of ["blue", "purple", "green", "red", "orange", "yellow"]) {
    await expect(colors.getByRole("button", { name: color + " background" })).toBeVisible();
  }
  await expect(colors.getByRole("button", { name: "blue background" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await colors.getByRole("button", { name: "purple background" }).click();
  await expect(colors).toHaveCount(0);
  await expect(backgroundTrigger).toBeFocused();
  await backgroundTrigger.click();
  await expect(colors.getByRole("button", { name: "purple background" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await page.mouse.click(10, 200);
  await expect(colors).toHaveCount(0);
  await page.getByRole("button", { name: "Done", exact: true }).click();
  await page.reload();
  await expect(slot).toHaveAttribute("data-card-kind", "progress");
  await expect(added).toHaveCount(1);
  await page.getByRole("button", { name: "Customize", exact: true }).click();
  await backgroundTrigger.click();
  await expect(colors.getByRole("button", { name: "purple background" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
});

test("Play Plans Show menu filters live plans and keeps links usable on mobile", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1920, height: 1120 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await signIn(page, "free.parent@playhub.local");
  await page.goto("/hub");
  const plans = page.locator('[data-hub-card-id="plans"]');
  const rows = plans.locator(".hub-plan-row");
  await expect(rows).toHaveCount(6);
  await plans.screenshot({ path: "../../output/hub-design/play-plans-drive.png" });
  const more = plans.getByRole("button", { name: "Play Plans display options" });
  await more.click();
  const menu = page.getByRole("dialog", { name: "Show Play Plans", exact: true });
  await expect(menu.getByRole("radio", { name: "All Play Plans", exact: true })).toBeChecked();
  await page.screenshot({ path: "../../output/hub-design/play-plans-menu.png" });
  await menu.getByRole("radio", { name: "Starter dose" }).click();
  await expect(menu).toHaveCount(0);
  await expect(more).toBeFocused();
  await expect(rows).toHaveCount(6);
  for (const row of await rows.all()) await expect(row).toContainText("Starter dose");
  await more.click();
  await expect(menu.getByRole("radio", { name: "Starter dose" })).toBeChecked();
  await menu.getByRole("radio", { name: "All Play Plans", exact: true }).click();
  await expect(rows).toHaveCount(6);
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(plans.locator(".hub-plan-row:visible")).toHaveCount(3);
  await plans.screenshot({ path: "../../output/hub-design/play-plans-mobile.png" });
  const destination = await rows.first().getAttribute("href");
  await rows.first().click();
  await expect(page).toHaveURL(new RegExp(destination! + "$"));
});

test("Hub popovers stay within a mobile viewport and the Apps menu navigates", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await signIn(page, "free.parent@playhub.local");
  await page.goto("/hub");
  await page.getByRole("button", { name: "Open Apps", exact: true }).click();
  const appsMenu = page.getByRole("dialog", { name: "Apps", exact: true });
  await appsMenu.getByRole("link", { name: "Account", exact: true }).first().click();
  await expect(page).toHaveURL(/\/account$/);
  await page.goto("/hub");
  await page.getByRole("button", { name: "Customize", exact: true }).click();
  await page.getByRole("button", { name: "Add Tile", exact: true }).click();
  const addPicker = page.getByRole("dialog", { name: "Add Tile", exact: true });
  await expect(addPicker).toBeVisible();
  const box = await addPicker.boundingBox();
  expect(box!.x).toBeGreaterThanOrEqual(12);
  expect(box!.x + box!.width).toBeLessThanOrEqual(378);
  expect(box!.y + box!.height).toBeLessThanOrEqual(832);
  await page.keyboard.press("Escape");
  await expect(addPicker).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Add Tile", exact: true })).toBeFocused();
});

test("mobile Hub centers square cards, keeps navigation sticky and offers all actions", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await signIn(page, "free.parent@playhub.local");
  await page.goto("/hub");
  const header = page.locator(".hub-main-header");
  const profile = page.locator('[data-hub-card-id="profile"]');
  const apps = page.locator('[data-hub-card-id="apps"]');
  for (const width of [320, 390, 440, 768]) {
    await page.setViewportSize({ width, height: 900 });
    await page.evaluate(() => window.scrollTo(0, 0));
    const box = (await profile.boundingBox())!;
    expect(Math.abs(box.width - box.height)).toBeLessThan(2);
    expect(Math.abs(box.x - (width - box.width) / 2)).toBeLessThan(2);
    expect(box.width).toBeLessThanOrEqual(360);
    expect(box.x).toBeGreaterThan(30);
    expect((await header.boundingBox())!.height).toBeLessThanOrEqual(52);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
      width,
    );
    const first = (await apps.locator(".hub-app-link").nth(0).boundingBox())!;
    const fourth = (await apps.locator(".hub-app-link").nth(3).boundingBox())!;
    expect(Math.abs(first.y - fourth.y)).toBeLessThan(2);
    expect(fourth.x).toBeGreaterThan(first.x);
    await page.screenshot({ path: `../../output/hub-design/mobile-${width}.png`, fullPage: true });
    if (width === 440) await page.screenshot({ path: "../../output/hub-design/mobile-top.png" });
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole("button", { name: "Your account", exact: true }).click();
  await expect(
    page
      .getByRole("dialog", { name: "Your account", exact: true })
      .getByRole("button", { name: "Sign out", exact: true }),
  ).toBeVisible();
  await page.keyboard.press("Escape");
  await page.evaluate(() => window.scrollTo(0, 900));
  await expect.poll(async () => (await header.boundingBox())?.y).toBe(0);
  await page.screenshot({ path: "../../output/hub-design/mobile-scrolled.png" });
  await page.getByRole("button", { name: "Customize", exact: true }).scrollIntoViewIfNeeded();
  await page.screenshot({ path: "../../output/hub-design/mobile-bottom.png" });
  await page.getByRole("button", { name: "Create New", exact: true }).click();
  const createMenu = page.getByRole("dialog", { name: "Create New", exact: true });
  await expect(createMenu.getByRole("link", { name: "Daily Check-In", exact: true })).toHaveCount(
    0,
  );
  await createMenu.getByRole("button", { name: "Home Page Tile", exact: true }).click();
  await expect(page.getByRole("dialog", { name: "Add Tile", exact: true })).toBeVisible();
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "Done", exact: true }).click();
  await expect(page.locator("footer")).toContainText("Privacy policy");
  await expect(page.locator("footer")).not.toContainText("Get started free");
  await page.getByRole("button", { name: "Your account", exact: true }).click();
  const menu = page.getByRole("dialog", { name: "Your account", exact: true });
  await menu.getByRole("button", { name: "Sign out", exact: true }).click();
  const confirmation = page.getByRole("alertdialog");
  await confirmation.getByRole("button", { name: "Cancel", exact: true }).click();
  await expect(menu).toBeVisible();
  await menu.getByRole("button", { name: "Sign out", exact: true }).click();
  await confirmation.getByRole("button", { name: "Sign out", exact: true }).click();
  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByLabel("Email Address")).toBeVisible();
});

test("Hub header offers circled creation and account menus on desktop and mobile", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await signIn(page, "parent@playhub.local");
  await page.goto("/hub");
  const header = page.locator(".hub-main-header");
  const createTrigger = header.getByRole("button", { name: "Create New", exact: true });
  const accountTrigger = header.getByRole("button", { name: "Your account", exact: true });
  const accountMenu = page.getByRole("dialog", { name: "Your account", exact: true });
  const createMenu = page.getByRole("dialog", { name: "Create New", exact: true });
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 900 });
    await expect(header.getByRole("link", { name: "Open Hub", exact: true })).toHaveCount(0);
    await expect(header.getByRole("button", { name: "Sign out", exact: true })).toHaveCount(0);
    await expect(accountTrigger.locator(":scope > span")).toHaveCSS("border-radius", "50%");
    await createTrigger.click();
    await expect(
      createMenu.getByRole("heading", { name: "Create New", exact: true }),
    ).toBeVisible();
    await expect(
      createMenu.getByRole("link", { name: "Daily Check-In", exact: true }),
    ).toHaveAttribute("href", "/check-in");
    await expect(
      createMenu.getByRole("link", { name: "Attune Conversation", exact: true }),
    ).toHaveAttribute("href", "/attune");
    await expect(
      createMenu.getByRole("link", { name: "Moderator Invitation", exact: true }),
    ).toHaveAttribute("href", "/invite");
    await page.screenshot({ path: `../../output/hub-design/header-create-${width}.png` });
    await accountTrigger.click();
    await expect(createMenu).toHaveCount(0);
    await expect(accountMenu.getByRole("heading")).toBeVisible();
    await expect(
      accountMenu.getByRole("button", { name: "Play Hub Settings", exact: true }),
    ).toBeFocused();
    await page.screenshot({ path: `../../output/hub-design/header-account-${width}.png` });
    const box = await accountMenu.boundingBox();
    expect(box!.x).toBeGreaterThanOrEqual(12);
    expect(box!.x + box!.width).toBeLessThanOrEqual(width - 12);
    await page.keyboard.press("Escape");
    await expect(accountMenu).toHaveCount(0);
    await expect(accountTrigger).toBeFocused();
  }
  await accountTrigger.click();
  await accountMenu.getByRole("link", { name: "Manage Account", exact: true }).click();
  await expect(page).toHaveURL(/\/account$/);
  await page.goto("/hub");
  await accountTrigger.click();
  await accountMenu.getByRole("button", { name: "Play Hub Settings", exact: true }).click();
  await expect(page.getByRole("button", { name: "Done", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Done", exact: true }).click();
  await createTrigger.click();
  await createMenu.getByRole("link", { name: "Attune Conversation", exact: true }).click();
  await expect(page).toHaveURL(/\/attune$/);
});

test.describe("mobile Hub touch", () => {
  test.use({
    viewport: { width: 390, height: 844 },
    hasTouch: true,
    isMobile: true,
    reducedMotion: "reduce",
  });

  test("a card follows a touch drag and saves its new position", async ({ page }) => {
    await signIn(page, "free.parent@playhub.local");
    await page.goto("/hub");
    await page.getByRole("button", { name: "Customize", exact: true }).tap();
    const source = page.locator('[data-hub-card-id="plans"]');
    const target = page.locator('[data-hub-card-id="apps"]');
    await source.scrollIntoViewIfNeeded();
    const from = (await source.boundingBox())!;
    const to = (await target.boundingBox())!;
    const start = { x: from.x + from.width / 2, y: from.y + 30 };
    const end = { x: to.x + to.width / 2, y: Math.min(to.y + to.height / 2, 740) };
    const client = await page.context().newCDPSession(page);
    await client.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [start] });
    for (let step = 1; step <= 12; step++) {
      await client.send("Input.dispatchTouchEvent", {
        type: "touchMove",
        touchPoints: [
          {
            x: start.x + ((end.x - start.x) * step) / 12,
            y: start.y + ((end.y - start.y) * step) / 12,
          },
        ],
      });
      await page.evaluate(() => new Promise(requestAnimationFrame));
    }
    await expect(source).toHaveAttribute("data-dragging", "true");
    await expect(target).toHaveAttribute("data-drag-over", "true");
    expect((await source.boundingBox())!.y).toBeGreaterThan(from.y + 100);
    await page.screenshot({ path: "../../output/hub-design/mobile-drag.png" });
    await client.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
    await expect(source).toHaveCSS("order", "2");
    await expect(target).toHaveCSS("order", "1");
    await expect(page.locator('[data-hub-card-id="profile"]')).toHaveCSS("order", "0");
    await page.getByRole("button", { name: "Done", exact: true }).tap();
    await page.reload();
    await expect(source).toHaveCSS("order", "2");
  });
});
