import { expect, test, type Page } from "@playwright/test";

const API = "http://127.0.0.1:8765/api/v1";
const SHOTS = process.env.LICENSE_SHOTS;

async function token(page: Page, email: string) {
  const response = await page.request.post(`${API}/auth/login`, {
    data: { email, password: "ChangeMe123!" },
  });
  return (await response.json()).access_token as string;
}

async function signIn(page: Page, email: string) {
  const access = await token(page, email);
  await page.addInitScript((access) => {
    localStorage.setItem("playhub_access_token", access);
    const original = Storage.prototype.getItem;
    Storage.prototype.getItem = function (key) {
      return key.startsWith("playhub:navigation-tour:") ? "complete" : original.call(this, key);
    };
  }, access);
}

test("the Super Admin licenses an organisation by member or by Moderator", async ({ page }) => {
  await signIn(page, "admin@playhub.local");
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/admin/orgs");

  await page.getByRole("button", { name: /New organisation/ }).click();
  await page.getByLabel("Name").fill("Licence Test Clinic");
  await page.getByRole("button", { name: "Licence type", exact: true }).click();
  await page.getByRole("option", { name: /Moderator licences/ }).click();
  await page.getByLabel("Moderator licences").fill("3");
  await page.getByRole("button", { name: "Billing cycle", exact: true }).click();
  await page.getByRole("option", { name: /^Monthly/ }).click();
  await page.getByLabel("Price per licence per month (AED)").fill("9");
  await expect(page.getByText(/AED 27 per month/)).toBeVisible();
  await page.getByRole("button", { name: "Create", exact: true }).click();

  const card = page.locator("article").filter({ hasText: "Licence Test Clinic" });
  await expect(card).toContainText("0 / 3 Moderator licences");
  await expect(card).toContainText("Members are unlimited");
  await expect(card).toContainText("Monthly billing");
  await expect(card).toContainText("AED 27");
  await expect(card).toContainText("3 Moderator licences × AED 9 a month · AED 324 a year");
  const renewal = card.getByText(/^Renews /);
  const before = await renewal.textContent();
  await card.getByRole("button", { name: /Record renewal/ }).click();
  await page.getByRole("alertdialog").getByRole("button", { name: "Record renewal" }).click();
  await expect(card.getByText(/^Renews /)).not.toHaveText(before ?? "");

  // Sunrise has active children, so child licences can't go below that count.
  const sunrise = page.locator("article").filter({ hasText: "Sunrise Montessori" });
  await expect(sunrise).toContainText(/\d+ \/ 40 child licences/);
  await sunrise.getByRole("button", { name: "Edit Sunrise Montessori" }).click();
  const sunriseEdit = page.getByRole("dialog", { name: "Edit Sunrise Montessori" });
  await sunriseEdit.getByLabel("Number of licences").fill("1");
  await sunriseEdit.getByRole("button", { name: "Save changes" }).click();
  await expect(sunriseEdit.getByRole("alert")).toContainText(/children are active/);
  await sunriseEdit.getByRole("button", { name: "Cancel" }).click();
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/orgs-1440.png`, fullPage: true });

  // Switch the new clinic to child licences.
  await card.getByRole("button", { name: /^Edit / }).click();
  const clinicEdit = page.getByRole("dialog", { name: /^Edit / });
  await clinicEdit.getByRole("button", { name: "Licence type" }).click();
  await page.getByRole("option", { name: /Child licences/ }).click();
  await expect(clinicEdit).toContainText(
    "Members will no longer use licences".replace("Members", "Moderators"),
  );
  await clinicEdit.getByLabel("Number of licences").fill("10");
  await clinicEdit.getByRole("button", { name: "Save changes" }).click();
  await expect(clinicEdit).toHaveCount(0);
  await expect(card).toContainText("0 / 10 member licences");
});

test("organisation admins see Moderator licence use on the Moderators page", async ({ page }) => {
  const admin = await token(page, "admin@playhub.local");
  const orgs = await (
    await page.request.get(`${API}/organisations`, {
      headers: { Authorization: `Bearer ${admin}` },
    })
  ).json();
  const sunrise = orgs.find((org: { name: string }) => org.name === "Sunrise Montessori");
  const original = { seat_limit: sunrise.seat_limit, license_type: sunrise.license_type };
  const setLicence = (body: object) =>
    page.request.patch(`${API}/organisations/${sunrise.id}`, {
      headers: { Authorization: `Bearer ${admin}` },
      data: body,
    });
  const switched = await setLicence({ license_type: "moderators", seat_limit: 50 });
  expect(switched.ok()).toBe(true);
  const used = (await switched.json()).licenses_used as number;
  try {
    expect(
      (await setLicence({ license_type: "moderators", seat_limit: Math.max(1, used) })).ok(),
    ).toBe(true);
    await signIn(page, "esther@sunrise.local");
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto("/org/supporters");
    const note = page.getByRole("region", { name: "Licences" });
    await expect(note).toContainText(`${used} of ${Math.max(1, used)} Moderator licence`);
    if (used >= 1) await expect(note).toContainText("All Moderator licences are in use");
    if (SHOTS) await page.screenshot({ path: `${SHOTS}/org-moderators.png` });
    // The children page doesn't show it: children aren't licensed now.
    await page.goto("/org");
    await expect(page.getByRole("region", { name: "Licences" })).toHaveCount(0);
  } finally {
    await setLicence(original);
  }
});

test("a full organisation is told to contact Play Hub when adding past its licences", async ({
  page,
}) => {
  const admin = await token(page, "admin@playhub.local");
  const orgs = await (
    await page.request.get(`${API}/organisations`, {
      headers: { Authorization: `Bearer ${admin}` },
    })
  ).json();
  const sunrise = orgs.find((org: { name: string }) => org.name === "Sunrise Montessori");
  const original = { seat_limit: sunrise.seat_limit, license_type: sunrise.license_type };
  const setLicence = (body: object) =>
    page.request.patch(`${API}/organisations/${sunrise.id}`, {
      headers: { Authorization: `Bearer ${admin}` },
      data: body,
    });
  try {
    // Child licences, all used.
    expect(
      (await setLicence({ license_type: "children", seat_limit: sunrise.licenses_used || 1 })).ok(),
    ).toBe(true);
    await signIn(page, "esther@sunrise.local");
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto("/org");
    if (sunrise.licenses_used) {
      await page.getByRole("link", { name: /Enrol a child/ }).click();
      const dialog = page.getByRole("dialog", { name: "All member licences are in use" });
      await expect(dialog).toContainText("Contact the Play Hub team");
      await expect(dialog.getByRole("link", { name: "esther@thetoypharmacy.com" })).toHaveAttribute(
        "href",
        /^mailto:esther@thetoypharmacy\.com\?subject=Licence%20increase/,
      );
      if (SHOTS) await page.screenshot({ path: `${SHOTS}/licence-modal.png` });
      await page.keyboard.press("Escape");
      await expect(dialog).toHaveCount(0);
      await expect(page).toHaveURL(/\/org$/);
    }

    // Moderator licences, all used: the Moderators button opens the same message.
    const switched = await setLicence({ license_type: "moderators", seat_limit: 50 });
    const used = (await switched.json()).licenses_used as number;
    expect(
      (await setLicence({ license_type: "moderators", seat_limit: Math.max(1, used) })).ok(),
    ).toBe(true);
    if (used) {
      await page.goto("/org/supporters");
      await page
        .getByRole("button", { name: /Add a Moderator/ })
        .first()
        .click();
      await expect(
        page.getByRole("dialog", { name: "All Moderator licences are in use" }),
      ).toBeVisible();
    }
  } finally {
    await setLicence(original);
  }
});
