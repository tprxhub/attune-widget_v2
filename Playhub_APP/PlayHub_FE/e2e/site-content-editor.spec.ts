import { expect, test } from "@playwright/test";

const tinyPng = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jx3sAAAAASUVORK5CYII=",
  "base64",
);

test("editor publishes phone wallpaper, separate auth images and policy pages", async ({
  page,
  browser,
}) => {
  const visitorContext = await browser.newContext({ viewport: { width: 375, height: 812 } });
  const visitor = await visitorContext.newPage();
  await visitor.goto("/");
  const hero = visitor.locator("main picture img").first();
  await expect
    .poll(() => hero.evaluate((img: HTMLImageElement) => img.currentSrc))
    .toContain("home-mobile-wallpaper");
  for (const width of [375, 768, 1440]) {
    await visitor.setViewportSize({ width, height: 900 });
    expect(
      await visitor.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
    ).toBe(true);
  }
  await visitor.setViewportSize({ width: 375, height: 812 });
  await visitor.screenshot({ path: "test-results/home-phone-wallpaper.png", fullPage: false });

  await page.goto("/login");
  await page.getByLabel("Email Address").fill("admin@playhub.local");
  await page.getByLabel("Password", { exact: true }).fill("ChangeMe123!");
  await page.getByRole("button", { name: "Log in", exact: true }).click();
  await expect(page).toHaveURL(/\/hub(?:[/?#]|$)/);
  await page.goto("/admin/homepage");

  const phone = page.locator("#home-section-hero");
  await phone.getByLabel("Upload a picture for Phone wallpaper", { exact: true }).setInputFiles({
    name: "phone.png",
    mimeType: "image/png",
    buffer: tinyPng,
  });
  const phoneField = phone.getByLabel("Phone wallpaper", { exact: true });
  await expect(phoneField).toHaveValue(/\/uploads\/media\/homepage\//);
  const phoneUrl = await phoneField.inputValue();

  await page.getByRole("button", { name: /Login & signup images/ }).click();
  const auth = page.locator("#home-section-auth-images");
  const authUrls: Record<string, string> = {};
  for (const name of ["Login", "Signup"]) {
    await auth.getByLabel(`Upload a picture for ${name} image`, { exact: true }).setInputFiles({
      name: `${name}.png`,
      mimeType: "image/png",
      buffer: tinyPng,
    });
    const input = auth.getByLabel(`${name} image`, { exact: true });
    await expect(input).toHaveValue(/\/uploads\/media\/homepage\//);
    authUrls[name] = await input.inputValue();
  }
  for (const [key, title] of [
    ["privacy", "Privacy policy"],
    ["terms", "Terms of service"],
  ] as const) {
    await page.getByRole("button", { name: new RegExp(`^${title}`) }).click();
    const policy = page.locator(`#home-section-policy-${key}`);
    await policy.getByLabel("Page title", { exact: true }).fill(`Play Hub ${title}`);
    await policy
      .getByLabel("Page content", { exact: true })
      .fill(
        `Updated ${key} introduction.\n\n## Your ${key} choices\n\n- First choice\n- Second choice\n\n<script>window.policyInjected = true</script>`,
      );
  }
  // Drafts do not affect public pages until Save changes is pressed.
  await visitor.goto("/policies/privacy-policy");
  await expect(visitor.getByRole("heading", { level: 1 })).toHaveText("Privacy policy");
  await page.getByRole("button", { name: "Save changes", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("Saved.");
  await page.reload();
  await expect(page.getByLabel("Phone wallpaper", { exact: true })).toHaveValue(phoneUrl);

  await visitor.goto("/");
  await expect
    .poll(() => hero.evaluate((img: HTMLImageElement) => img.currentSrc))
    .toContain(phoneUrl);
  await visitor.setViewportSize({ width: 1280, height: 900 });
  await expect
    .poll(() => hero.evaluate((img: HTMLImageElement) => img.currentSrc))
    .not.toContain(phoneUrl);
  for (const [route, name] of [
    ["/login", "Login"],
    ["/signup", "Signup"],
  ] as const) {
    await visitor.goto(route);
    const art = visitor.getByAltText("A child playing with colourful wooden toys");
    await expect(art).toHaveAttribute(
      "src",
      new RegExp(authUrls[name]!.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")),
    );
    await expect
      .poll(() => art.evaluate((img: HTMLImageElement) => img.naturalWidth))
      .toBeGreaterThan(0);
  }
  await visitor.getByRole("button", { name: "Terms & Condition", exact: true }).click();
  const dialog = visitor.getByRole("dialog");
  await expect(dialog.getByRole("heading", { name: "Play Hub Terms of service" })).toBeVisible();
  await expect(dialog.getByText("Updated terms introduction.", { exact: true })).toBeVisible();
  await dialog.getByRole("tab", { name: "Privacy policy" }).click();
  await expect(dialog.getByText("Updated privacy introduction.", { exact: true })).toBeVisible();
  await dialog.getByRole("button", { name: "Close", exact: true }).last().click();
  for (const [route, key, title] of [
    ["/policies/privacy-policy", "privacy", "Privacy policy"],
    ["/policies/terms-of-service", "terms", "Terms of service"],
  ] as const) {
    await visitor.goto(route);
    await expect(visitor.getByRole("heading", { level: 1 })).toHaveText(`Play Hub ${title}`);
    await expect(visitor.getByRole("heading", { name: `Your ${key} choices` })).toBeVisible();
    await expect(visitor.getByRole("listitem")).toHaveCount(2);
    await expect(
      visitor.getByText("<script>window.policyInjected = true</script>", { exact: true }),
    ).toBeVisible();
    expect(await visitor.evaluate(() => "policyInjected" in window)).toBe(false);
  }
  await visitorContext.close();
});
