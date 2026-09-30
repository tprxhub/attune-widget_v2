import { expect, test, type Locator, type Page } from "@playwright/test";

const PASSWORD = "ChangeMe123!";

async function login(page: Page, email: string, organisation = false) {
  await page.goto("/login");
  if (organisation) await page.getByRole("tab", { name: "School / clinic" }).click();
  await page.getByLabel("Email Address").fill(email);
  await page.getByLabel("Password", { exact: true }).fill(PASSWORD);
  const submit = page.getByRole("button", { name: "Log in" });
  await expect(submit).toBeEnabled();
  await submit.click();
  await expect(page).toHaveURL(/\/(dashboard|org|admin)(?:[/?#]|$)/);
}

async function expectScreen(page: Page, path: string, heading: string) {
  const response = await page.goto(path);
  expect(response?.status(), `${path} should load successfully`).toBeLessThan(400);
  await expect(page.getByRole("heading", { name: heading, exact: true }).first()).toBeVisible();
}

async function chooseOption(scope: Page | Locator, labelText: string, optionText: string) {
  await scope.getByLabel(labelText).click();
  // The list is portalled to <body>, so look for options on the whole page, not inside a dialog.
  const page = "page" in scope ? scope.page() : scope;
  await page.getByRole("option", { name: optionText, exact: false }).click();
}

test("family Check-In persists and immediately updates Progress", async ({ page }) => {
  await login(page, "parent@playhub.local");
  await expect(page.getByRole("heading", { name: "Here's your Play Hub" })).toBeVisible();

  await page.goto("/check-in");
  await expect(page.getByRole("heading", { name: "Daily Check-In" })).toBeVisible();
  await expect(page.getByText("Logging an Session for Noah", { exact: false })).toBeVisible();
  await chooseOption(page, "Play Plan", "Bilateral Coordination");
  await chooseOption(page, "Play Dose", "Learn to Button a Shirt · Rookie");
  await expect(page.getByText("Assigned dose:", { exact: false })).toBeVisible();
  await page.getByRole("button", { name: "Finished" }).click();
  await page.getByRole("button", { name: "One reminder" }).click();
  await page.getByRole("button", { name: "Happy" }).click();
  await page
    .getByLabel("Parent win")
    .fill("Completed the activity with less help in the browser test.");

  const savedResponse = page.waitForResponse(
    (response) =>
      response.request().method() === "POST" && /\/children\/[^/]+\/attempts$/.test(response.url()),
  );
  await page.getByRole("button", { name: "Log this Session" }).click();
  expect((await savedResponse).status()).toBe(201);
  await expect(page.getByRole("status")).toContainText("Session saved");
  await expect(page.getByText(/^\d+%$/).first()).toBeVisible();

  await page.goto("/progress");
  await expect(page.getByRole("heading", { name: "Progress" })).toBeVisible();
  await expect(page.getByRole("img", { name: /Weekly progress chart/ })).toBeVisible();
  const nextSteps = page.getByRole("heading", { name: "Next steps" }).locator("..");
  await expect(nextSteps.locator("ol > li")).toHaveCount(5);
  await expect(page.getByRole("heading", { name: "Session history" })).toHaveCount(1);
  await expect(page.getByText(/\d+%$/).first()).toBeVisible();

  const planFilter = page.locator(
    'button[aria-labelledby="progress-plan-filter-label progress-plan-filter-value"]',
  );
  await planFilter.click();
  await expect(page.getByRole("listbox", { name: "Play Plan" })).toBeVisible();
  await page.getByRole("option", { name: /Learn to Button a Shirt.*Rookie level/ }).click();
  await expect(page.getByText("Showing filtered check-ins")).toBeVisible();
  await expect(planFilter).toHaveAccessibleName(/Play Plan Learn to Button a Shirt/);
  await planFilter.click();
  await page.getByRole("option", { name: /All Play Plans.*Compare all/ }).click();
  await expect(page.getByText("All Play Plans and dates")).toBeVisible();

  await page.reload();
  await expect(page.getByRole("img", { name: /Weekly progress chart/ })).toBeVisible();
});

test("Super Admin can operate platform controls and complete staff activation", async ({
  page,
  browser,
}) => {
  await login(page, "admin@playhub.local");
  await expect(page.getByRole("heading", { name: "Platform overview" })).toBeVisible();

  await page.goto("/admin/orgs");
  await page.getByRole("button", { name: "New organisation" }).click();
  await page.getByLabel("Name").fill("Browser Test School");
  await page.getByLabel("Licenses").fill("12");
  await page.getByRole("button", { name: "Create", exact: true }).click();
  await expect(page.getByText("Browser Test School")).toBeVisible();

  await page.goto("/admin/children");
  const noah = page.locator("article").filter({ hasText: "Noah" });
  await expect(noah).toBeVisible();
  await noah.getByRole("link", { name: "Check-in" }).click();
  await expect(page.getByText("Logging an Session for Noah", { exact: false })).toBeVisible();

  for (const [path, heading] of [
    ["/admin/progress", "Progress"],
    ["/admin/audit", "Audit log"],
    ["/admin/plans", "Play Plans library"],
    ["/admin/educators", "Admins & Moderators"],
  ] as const) {
    await page.goto(path);
    await expect(page.getByRole("heading", { name: heading, exact: true })).toBeVisible();
  }

  await page.getByRole("button", { name: "Add staff" }).click();
  const staffModal = page.getByRole("dialog");
  await staffModal.getByLabel("Full name").fill("Browser Test Admin");
  await staffModal.getByLabel("Email").fill("browser.admin@playhub.local");
  await chooseOption(staffModal, "Organisation", "Browser Test School");
  await staffModal.getByRole("button", { name: "Add Admin" }).click();
  await expect(staffModal.getByRole("heading", { name: "Credentials ready" })).toBeVisible();
  await expect(staffModal.getByText("browser.admin@playhub.local", { exact: true })).toBeVisible();
  const activationLink = await staffModal
    .getByRole("button", { name: "Copy one-time activation link" })
    .locator("..")
    .locator("p")
    .textContent();
  expect(activationLink).toMatch(/\/accept-invite\?token=.{20,}/);
  await expect(staffModal.getByRole("button", { name: "Copy credentials" })).toBeVisible();
  await staffModal.getByRole("button", { name: "Done" }).click();

  const moderatorCard = page.locator("article").filter({ hasText: "Priya Raman" });
  await expect(moderatorCard).toBeVisible();
  await moderatorCard.getByRole("button", { name: "Disable account" }).click();
  await expect(moderatorCard.getByText("Disabled", { exact: true })).toBeVisible();
  await moderatorCard.getByRole("button", { name: "Enable account" }).click();
  await expect(moderatorCard.getByText("Active", { exact: true })).toBeVisible();

  const inviteContext = await browser.newContext();
  const invitePage = await inviteContext.newPage();
  await invitePage.goto(activationLink!);
  await expect(invitePage.getByRole("button", { name: "Activate account" })).toBeEnabled();
  await invitePage.getByLabel("Display name").fill("Browser Test Admin");
  await invitePage.locator("#invite-password").fill(PASSWORD);
  await invitePage.locator("#invite-confirm").fill(PASSWORD);
  await invitePage.getByRole("button", { name: "Activate account" }).click();
  await expect(invitePage).toHaveURL(/\/org(?:[/?#]|$)/);
  await expect(invitePage.getByRole("heading", { name: "Children", exact: true })).toBeVisible();
  await inviteContext.close();
});

test("organisation Admin can create, track and activate a Moderator", async ({ page, browser }) => {
  const moderatorEmail = "browser.moderator@playhub.local";

  await login(page, "esther@sunrise.local", true);
  await page.goto("/org/supporters");
  await expect(page.getByRole("heading", { name: "Moderators", exact: true })).toBeVisible();

  await page.getByRole("button", { name: "Add a Moderator" }).click();
  const modal = page.getByRole("dialog");
  await modal.getByLabel("Full name").fill("Browser Test Moderator");
  await modal.getByLabel("Email").fill(moderatorEmail);
  await chooseOption(modal, "Assign a child", "Amira · Age 5");
  await modal.getByRole("button", { name: "Add Moderator" }).click();

  await expect(modal.getByRole("heading", { name: "Moderator login ready" })).toBeVisible();
  await expect(modal.getByText(moderatorEmail, { exact: true })).toBeVisible();
  const originalActivationLink = await modal
    .getByRole("button", { name: "Copy one-time activation link" })
    .locator("..")
    .locator("p")
    .textContent();
  expect(originalActivationLink).toMatch(/\/accept-invite\?token=.{20,}/);
  await expect(modal.getByRole("button", { name: "Copy login details" })).toBeVisible();
  await modal.getByRole("button", { name: "Done" }).click();

  let moderatorCard = page.locator("article").filter({ hasText: "Browser Test Moderator" });
  await expect(moderatorCard).toBeVisible();
  await expect(moderatorCard.getByText("Pending", { exact: true })).toBeVisible();
  await moderatorCard.getByRole("button", { name: "Generate new login link" }).click();
  await expect(modal.getByRole("heading", { name: "Moderator login ready" })).toBeVisible();
  const activationLink = await modal
    .getByRole("button", { name: "Copy one-time activation link" })
    .locator("..")
    .locator("p")
    .textContent();
  expect(activationLink).toMatch(/\/accept-invite\?token=.{20,}/);
  expect(activationLink).not.toBe(originalActivationLink);

  const inviteContext = await browser.newContext();
  const invitePage = await inviteContext.newPage();
  await invitePage.goto(activationLink!);
  await invitePage.getByLabel("Display name").fill("Browser Test Moderator");
  await invitePage.locator("#invite-password").fill(PASSWORD);
  await invitePage.locator("#invite-confirm").fill(PASSWORD);
  await invitePage.getByRole("button", { name: "Activate account" }).click();
  await expect(invitePage).toHaveURL(/\/org(?:[/?#]|$)/);
  await expect(invitePage.getByRole("heading", { name: "Children", exact: true })).toBeVisible();
  await expect(invitePage.getByText("Amira", { exact: true })).toBeVisible();
  await expect(invitePage.getByText("Omar", { exact: true })).toHaveCount(0);
  await inviteContext.close();

  await page.reload();
  moderatorCard = page.locator("article").filter({ hasText: "Browser Test Moderator" });
  await expect(moderatorCard.getByText("Active", { exact: true })).toBeVisible();
  await expect(moderatorCard.getByText("Children: Amira")).toBeVisible();
});

test("family can sign up, restore its session, change password and sign in again", async ({
  page,
}) => {
  const email = "browser.family@playhub.local";
  const nextPassword = "DemoReady456!";

  await page.goto("/signup");
  await expect(page.getByRole("button", { name: "Create Account" })).toBeEnabled();
  await page.getByLabel("Child's First Name").fill("Mia");
  await page.getByLabel("Child's Age").fill("6");
  await page.getByLabel("First Name", { exact: true }).fill("Demo");
  await page.getByLabel("Last Name").fill("Family");
  await page.getByLabel("Email Address").fill(email);
  await page.getByLabel("Password", { exact: true }).fill(PASSWORD);
  await page.getByRole("checkbox").check({ force: true });
  await page.getByRole("button", { name: "Create Account" }).click();
  await expect(page).toHaveURL(/\/dashboard(?:[/?#]|$)/);
  await expect(page.getByText("Mia", { exact: true }).first()).toBeVisible();

  await page.reload();
  await expect(page.getByRole("heading", { name: "Here's your Play Hub" })).toBeVisible();
  await page.goto("/account");
  await page.getByRole("button", { name: /Change password/ }).click();
  const passwordDialog = page.getByRole("dialog", { name: "Change password" });
  await passwordDialog.getByLabel("Current password").fill(PASSWORD);
  await passwordDialog.getByLabel("New password", { exact: true }).fill(nextPassword);
  await passwordDialog.getByLabel("Confirm new password").fill(nextPassword);
  await passwordDialog.getByRole("button", { name: "Update password" }).click();
  await expect(
    passwordDialog.getByText("Password updated. Use the new one next time you sign in."),
  ).toBeVisible();
  await passwordDialog.getByRole("button", { name: "Close" }).click();
  await page.getByRole("button", { name: "Sign out" }).click();
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole("heading", { name: "Please sign in" })).toHaveCount(0);

  await page.goto("/login");
  await page.getByLabel("Email Address").fill(email);
  await page.getByLabel("Password", { exact: true }).fill(nextPassword);
  await page.getByRole("button", { name: "Log in" }).click();
  await expect(page).toHaveURL(/\/dashboard(?:[/?#]|$)/);
});

test("organisation roles receive the correct writable and read-only experiences", async ({
  browser,
}) => {
  const adminContext = await browser.newContext();
  const adminPage = await adminContext.newPage();
  await login(adminPage, "esther@sunrise.local", true);
  await adminPage.goto("/org");
  await expect(adminPage.getByRole("heading", { name: "Children", exact: true })).toBeVisible();
  await adminPage.goto("/check-in");
  await expect(adminPage.getByText("Logging an Session for Amira", { exact: false })).toBeVisible();
  await adminPage.goto("/admin");
  await expect(
    adminPage.getByRole("heading", { name: "Not available for your role" }),
  ).toBeVisible();
  await adminContext.close();

  const parentContext = await browser.newContext();
  const parentPage = await parentContext.newPage();
  await login(parentPage, "hana@sunrise.local", true);
  await parentPage.goto("/check-in");
  await expect(parentPage.getByText("Read-only access", { exact: true })).toBeVisible();
  await expect(parentPage.getByRole("button", { name: "Log this Session" })).toHaveCount(0);
  await parentContext.close();
});

test("free family cannot log Sessions", async ({ page }) => {
  await login(page, "free.parent@playhub.local");

  await page.goto("/plans");
  await page
    .getByRole("link", { name: /Start Play Dose/ })
    .first()
    .click();
  await expect(page.getByRole("heading", { name: "Play Doses" })).toBeVisible();
  await expect(page.getByText("Locked", { exact: true })).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Upgrade to unlock" })).toHaveCount(0);

  await page.goto("/check-in");
  await expect(page.getByText("Logging is locked on the free plan", { exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: "Upgrade to unlock" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Log this Session" })).toHaveCount(0);

  await page.goto("/subscription");
  await page.getByRole("button", { name: /Subscribe .*£69/ }).click();
  await expect(page.getByRole("alert")).toContainText("Stripe payments are not configured");
  await expect(page.getByText("Free plan", { exact: true })).toBeVisible();
});

test("subscribed family can check in from an unassigned Play Dose", async ({ page }) => {
  await login(page, "parent@playhub.local");
  await page.goto("/plans");

  const bilateralPlan = page.locator("section").filter({
    has: page.getByRole("heading", {
      name: "Bilateral Coordination & Midline Crossing",
      exact: true,
    }),
  });
  await bilateralPlan
    .getByRole("link", { name: /Learn to Button a Shirt.*Rookie/ })
    .first()
    .click();
  await page
    .getByRole("link", { name: /Tap & Slide Stretch/ })
    .first()
    .click();

  await expect(page.getByText("not currently assigned", { exact: false })).toHaveCount(0);
  await page.getByRole("button", { name: "Finished" }).click();
  await page.getByRole("button", { name: "One reminder" }).click();
  await page.getByRole("button", { name: "Happy" }).click();
  await page.getByLabel("Parent win").fill("Logged directly from an unlocked Play Dose.");
  await page.getByRole("button", { name: "Log this Session" }).click();
  await expect(page.getByRole("status")).toContainText("Session logged");
});

test("user can choose a profile sticker and upload a profile photo", async ({ page }) => {
  await login(page, "parent@playhub.local");
  await page.goto("/account");

  await page.getByRole("button", { name: "Change profile picture" }).click();
  const editor = page.getByRole("dialog", { name: "Profile picture" });
  await expect(editor).toBeVisible();
  await editor.getByRole("button", { name: "Wise Owl" }).click();

  const stickerResponse = page.waitForResponse(
    (response) =>
      response.request().method() === "PUT" && response.url().endsWith("/auth/me/avatar"),
  );
  await editor.getByRole("button", { name: "Save profile picture" }).click();
  expect((await stickerResponse).status()).toBe(200);
  await expect(page.getByRole("img", { name: "Wise Owl profile sticker" }).first()).toBeVisible();

  await page.reload();
  await expect(page.getByRole("img", { name: "Wise Owl profile sticker" }).first()).toBeVisible();
  await page.getByRole("button", { name: "Change profile picture" }).click();

  const png = Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
    "base64",
  );
  await page.getByLabel("Choose a photo").setInputFiles({
    name: "profile.png",
    mimeType: "image/png",
    buffer: png,
  });
  const photoResponse = page.waitForResponse(
    (response) =>
      response.request().method() === "POST" && response.url().endsWith("/auth/me/avatar"),
  );
  await page.getByRole("button", { name: "Save profile picture" }).click();
  expect((await photoResponse).status()).toBe(200);
  await expect(page.getByRole("img", { name: /profile picture/ }).first()).toBeVisible();
});

test("every seeded persona can open its permitted screens and privileged screens stay blocked", async ({
  browser,
}) => {
  const personas: Array<{
    email: string;
    organisation?: boolean;
    screens: Array<[string, string]>;
    blocked: string;
  }> = [
    {
      email: "admin@playhub.local",
      screens: [
        ["/admin", "Platform overview"],
        ["/admin/children", "Children"],
        ["/check-in", "Daily Check-In"],
        ["/admin/progress", "Progress"],
        ["/admin/audit", "Audit log"],
        ["/plans", "Pick a Plan, pick a level, press play."],
        ["/admin/plans", "Play Plans library"],
        ["/admin/orgs", "Organisations"],
        ["/admin/educators", "Admins & Moderators"],
        ["/account", "My account"],
      ],
      blocked: "/subscription",
    },
    {
      email: "esther@sunrise.local",
      organisation: true,
      screens: [
        ["/dashboard", "Here's your Play Hub"],
        ["/plans", "Pick a Plan, pick a level, press play."],
        ["/check-in", "Daily Check-In"],
        ["/progress", "Progress"],
        ["/org", "Children"],
        ["/org/supporters", "Moderators"],
        ["/account", "My account"],
      ],
      blocked: "/admin",
    },
    {
      email: "moderator@playhub.local",
      organisation: true,
      screens: [
        ["/dashboard", "Here's your Play Hub"],
        ["/plans", "Pick a Plan, pick a level, press play."],
        ["/check-in", "Daily Check-In"],
        ["/progress", "Progress"],
        ["/org", "Children"],
        ["/account", "My account"],
      ],
      blocked: "/org/supporters",
    },
    {
      email: "hana@sunrise.local",
      organisation: true,
      screens: [
        ["/dashboard", "Here's your Play Hub"],
        ["/plans", "Pick a Plan, pick a level, press play."],
        ["/progress", "Progress"],
        ["/account", "My account"],
      ],
      blocked: "/org",
    },
    {
      email: "parent@playhub.local",
      screens: [
        ["/dashboard", "Here's your Play Hub"],
        ["/plans", "Pick a Plan, pick a level, press play."],
        ["/check-in", "Daily Check-In"],
        ["/progress", "Progress"],
        ["/subscription", "Subscription"],
        ["/invite", "Invite a Moderator"],
        ["/account", "My account"],
      ],
      blocked: "/org",
    },
    {
      email: "nanny@playhub.local",
      screens: [
        ["/dashboard", "Here's your Play Hub"],
        ["/plans", "Pick a Plan, pick a level, press play."],
        ["/check-in", "Daily Check-In"],
        ["/progress", "Progress"],
        ["/account", "My account"],
      ],
      blocked: "/org",
    },
    {
      email: "free.parent@playhub.local",
      screens: [
        ["/dashboard", "Here's your Play Hub"],
        ["/plans", "Pick a Plan, pick a level, press play."],
        ["/check-in", "Daily Check-In"],
        ["/progress", "Progress"],
        ["/subscription", "Subscription"],
        ["/account", "My account"],
      ],
      blocked: "/admin",
    },
  ];

  for (const persona of personas) {
    const context = await browser.newContext();
    const page = await context.newPage();
    const pageErrors: string[] = [];
    const serverErrors: string[] = [];
    page.on("pageerror", (error) => pageErrors.push(error.message));
    page.on("response", (response) => {
      if (response.status() >= 500) serverErrors.push(`${response.status()} ${response.url()}`);
    });

    await login(page, persona.email, persona.organisation);
    for (const [path, heading] of persona.screens) await expectScreen(page, path, heading);
    await page.goto(persona.blocked);
    await expect(page.getByRole("heading", { name: /Not available|Not part/ })).toBeVisible();
    expect(pageErrors, `${persona.email} had browser errors`).toEqual([]);
    expect(serverErrors, `${persona.email} received server errors`).toEqual([]);
    await context.close();
  }
});

test("Super Admin edits the home page wording and visitors see it", async ({ page, browser }) => {
  await login(page, "admin@playhub.local");
  await page.goto("/admin/homepage");
  await expect(page.getByRole("heading", { name: "Home page", exact: true })).toBeVisible();
  await expect(page.getByText("Showing the original wording.")).toBeVisible();

  const hero = page.locator("#home-section-hero");
  await hero.getByLabel("Headline, first line").fill("Play a little, grow a lot");
  await expect(page.getByText("You have unsaved changes.")).toBeVisible();

  // Mistakes are caught before saving: a blank button cannot go live.
  await hero.getByLabel("Main button").fill("");
  await expect(hero.getByText("This can't be empty.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Save changes" })).toBeDisabled();
  await hero.getByLabel("Main button").fill("Start free");

  // Picture addresses must be web or site addresses, never script URLs.
  await hero.getByLabel("Background picture").fill("javascript:alert(1)");
  await expect(hero.getByText(/Start with https:\/\//)).toBeVisible();
  await hero.getByLabel("Background picture").fill("");

  // A story can be added and removed.
  await page.getByRole("button", { name: /Stories/ }).click();
  const stories = page.locator("#home-section-stories");
  await stories.getByRole("button", { name: "Add a story" }).click();
  await stories.getByLabel("What they said").nth(3).fill("Lovely, thank you.");
  await stories.getByLabel("Name").nth(3).fill("A new parent");
  await stories.getByLabel("Who they are").nth(3).fill("Family account");

  await page.getByRole("button", { name: "Save changes" }).click();
  await expect(page.getByRole("status")).toContainText("Saved.");

  // Someone who is not signed in sees the new wording.
  const visitorContext = await browser.newContext();
  const visitor = await visitorContext.newPage();
  await visitor.goto("/");
  await expect(visitor.getByRole("heading", { level: 1 })).toContainText(
    "Play a little, grow a lot",
  );
  await expect(visitor.getByRole("link", { name: /Start free/ }).first()).toBeVisible();
  await expect(visitor.getByText("Lovely, thank you.")).toBeVisible();
  await visitorContext.close();

  // Resetting brings the original wording back.
  await page.getByRole("button", { name: "Reset to original wording" }).click();
  await page.getByRole("button", { name: "Yes, reset" }).click();
  await expect(page.getByRole("status")).toContainText("original wording");
  await page.reload();
  await expect(page.getByText("Showing the original wording.")).toBeVisible();
});

test("only a Super Admin can open the home page editor", async ({ page }) => {
  await login(page, "parent@playhub.local");
  await page.goto("/admin/homepage");
  await expect(page.getByRole("heading", { name: /Not available|Not part/ })).toBeVisible();
  await expect(page.getByLabel("Headline, first line")).toHaveCount(0);
});

test("Play Dose forms carry no SMART or GAS fields, and a Play Dose can be created and edited", async ({
  page,
}) => {
  const retiredLabels = [
    "SMART goal",
    "Level passed if",
    "Real-Life Try title",
    "Builds on (one per line)",
    "Real-Life Try steps (one per line)",
    "Items needed (one per line)",
  ];
  const retiredKeys = [
    "smart_goal",
    "passed_if",
    "gas_score",
    "builds_on",
    "real_life_try_title",
    "real_life_try_instructions",
    "real_life_try_items",
  ];

  await login(page, "admin@playhub.local");
  await page.goto("/admin/plans");

  // A fresh Play Plan, so the new Play Dose cannot clash with a level that already exists.
  await page.getByRole("button", { name: "New Play Plan" }).click();
  const planDialog = page.getByRole("dialog", { name: "New Play Plan" });
  await planDialog.getByLabel("Play Plan name").fill("Browser test plan");
  await planDialog.getByLabel("Created by (full name)").fill("Dr Jane Doe");
  await planDialog.getByRole("button", { name: "Create Play Plan" }).click();
  await expect(planDialog).toBeHidden();

  const plan = page.locator("section").filter({
    has: page.getByRole("heading", { name: "Browser test plan", exact: true }),
  });
  await expect(plan.getByTestId("plan-creator")).toHaveText("Created by Dr Jane Doe");
  await plan.getByRole("button", { name: "New Play Dose" }).click();
  const create = page.getByRole("dialog", { name: "New Play Dose" });
  await expect(create.getByLabel("Play Dose title")).toBeVisible();
  await expect(create.getByText("SMART + GAS tracking")).toHaveCount(0);
  for (const label of retiredLabels) await expect(create.getByLabel(label)).toHaveCount(0);
  await expect(create.getByLabel("Safety note")).toBeVisible();

  await create.getByLabel("Play Dose title").fill("Browser test dose");
  await create.getByRole("button", { name: "Edit activity" }).click();

  // One name, a day, steps and an optional video. No duplicate title, label, minutes or video title.
  await expect(create.getByLabel("Activity name")).toBeVisible();
  await expect(create.getByLabel("Day")).toBeVisible();
  await expect(create.getByLabel("Step 1", { exact: true })).toBeVisible();
  await expect(create.getByLabel("Video link")).toBeVisible();
  for (const gone of ["Activity title", "Label", "Minutes", "Video title"]) {
    await expect(create.getByLabel(gone, { exact: true })).toHaveCount(0);
  }
  await expect(create.getByText("More options")).toBeVisible();

  await create.getByLabel("Activity name").fill("Squeeze the sponge");
  await create.getByLabel("Step 1", { exact: true }).fill("Squeeze it ten times with one hand");
  const doseRequest = page.waitForRequest(
    (request) =>
      /\/play-plans\/[^/]+\/play-doses$/.test(request.url()) && request.method() === "POST",
  );
  const activityRequest = page.waitForRequest(
    (request) =>
      /\/play-doses\/[^/]+\/activities$/.test(request.url()) && request.method() === "POST",
  );
  await create.getByRole("button", { name: "Create Play Dose" }).click();

  const doseBody = (await doseRequest).postDataJSON() as Record<string, unknown>;
  expect(doseBody).toMatchObject({ title: "Browser test dose", level: "starter" });
  for (const key of retiredKeys) expect(doseBody).not.toHaveProperty(key);
  const activityBody = (await activityRequest).postDataJSON() as Record<string, unknown>;
  expect(activityBody["title"]).toBe("Squeeze the sponge");
  expect(activityBody["instructions"]).toEqual(["Squeeze it ten times with one hand"]);
  expect(activityBody).not.toHaveProperty("duration_minutes");
  await expect(create).toBeHidden();

  // Editing shows no SMART or GAS fields either, and saving never sends them.
  await plan.getByRole("button", { name: "Edit Play Dose" }).first().click();
  const edit = page.getByRole("dialog", { name: "Edit Play Dose" });
  await expect(edit.getByLabel("Play Dose title")).toHaveValue("Browser test dose");
  await expect(edit.getByLabel("Created by (full name)")).toHaveValue("Play Hub Admin");
  await expect(edit.getByText("SMART + GAS tracking")).toHaveCount(0);
  for (const label of retiredLabels) await expect(edit.getByLabel(label)).toHaveCount(0);
  await edit.getByLabel("Safety note").fill("Supervise small parts.");
  const patch = page.waitForRequest(
    (request) => /\/play-doses\/[^/]+$/.test(request.url()) && request.method() === "PATCH",
  );
  await edit.getByRole("button", { name: "Save changes" }).click();
  const patchBody = (await patch).postDataJSON() as Record<string, unknown>;
  expect(patchBody["safety_note"]).toBe("Supervise small parts.");
  for (const key of retiredKeys) expect(patchBody).not.toHaveProperty(key);
  await expect(edit).toBeHidden();
});

test("Super Admin gets a scannable progress overview with filters and details", async ({
  page,
}) => {
  await login(page, "admin@playhub.local");
  await page.goto("/admin/progress");
  await expect(page.getByRole("heading", { name: "Progress", exact: true })).toBeVisible();

  // One-line facts up top, and no retired GAS wording anywhere.
  for (const label of ["Children", "Sessions", "Average support", "Need attention"]) {
    await expect(page.getByText(label, { exact: true }).first()).toBeVisible();
  }
  await expect(page.getByText(/\bGAS\b/)).toHaveCount(0);

  // Column names appear once per table, not on every row.
  await expect(page.getByText("Last check-in", { exact: true }).first()).toBeVisible();
  const rows = page.locator("li[id^='child-']");
  const all = await rows.count();
  expect(all).toBeGreaterThan(0);

  // A status chip narrows the list, and clicking it again brings everyone back.
  const chips = page.getByRole("group", { name: "Filter by status" }).getByRole("button");
  const firstStatus = chips.nth(1);
  await firstStatus.click();
  await expect(firstStatus).toHaveAttribute("aria-pressed", "true");
  expect(await rows.count()).toBeLessThanOrEqual(all);
  await firstStatus.click();
  await expect(rows).toHaveCount(all);

  // A row opens to its weekly trend and the facts that are not already in the row.
  await rows.first().getByRole("button").first().click();
  await expect(page.getByText("Weekly trend")).toBeVisible();
  await expect(page.getByText("Daily check-ins")).toBeVisible();
});

test("Progress shows an empty state, not an endless skeleton, when the account has no children", async ({
  page,
}) => {
  await login(page, "esther@sunrise.local", true);
  await page.route(/\/api\/v1\/children(\?.*)?$/, (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: "[]" }),
  );
  await page.goto("/progress");
  await expect(page.getByRole("heading", { name: "Progress", exact: true })).toBeVisible();
  await expect(page.getByText("No children to show yet")).toBeVisible();
  await expect(page.getByRole("link", { name: "Go to Children" })).toBeVisible();
});
