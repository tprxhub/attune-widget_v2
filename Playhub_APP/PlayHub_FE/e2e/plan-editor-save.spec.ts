import { expect, test, type Page } from "@playwright/test";

const API = "http://127.0.0.1:8765/api/v1";
const VIDEO = {
  name: "demo.mp4",
  mimeType: "video/mp4",
  buffer: Buffer.from("\x00\x00\x00\x18ftypmp42playhub"),
};

/** Sign in as the Super Admin and create a Play Plan with one dose of three activities. */
async function setUp(page: Page, name: string) {
  const login = await page.request.post(`${API}/auth/login`, {
    data: { email: "admin@playhub.local", password: "ChangeMe123!" },
  });
  const { access_token: token } = await login.json();
  const headers = { Authorization: `Bearer ${token}` };
  const slug = `${name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${Date.now()}`;
  const plan = await (
    await page.request.post(`${API}/play-plans`, { headers, data: { name, slug } })
  ).json();
  const dose = await (
    await page.request.post(`${API}/play-plans/${plan.id}/play-doses`, {
      headers,
      data: { level: "rookie", title: `${name} dose` },
    })
  ).json();
  for (const day of [1, 2, 3]) {
    await page.request.post(`${API}/play-doses/${dose.id}/activities`, {
      headers,
      data: { day, title: `Activity ${day}`, instructions: [`Step ${day}`] },
    });
  }
  await page.addInitScript((accessToken) => {
    localStorage.setItem("playhub_access_token", accessToken);
    const original = Storage.prototype.getItem;
    Storage.prototype.getItem = function (key: string) {
      return key.startsWith("playhub:navigation-tour:") ? "complete" : original.call(this, key);
    };
  }, token);
  await page.goto("/admin/plans");
  const section = page.locator("section").filter({
    has: page.getByRole("heading", { name, exact: true }),
  });
  // Play Plan cards start collapsed.
  await section.getByRole("button", { name: `Show ${name} Play Doses` }).click();
  return { section, headers, doseId: dose.id as string };
}

async function openEditor(page: Page, section: ReturnType<Page["locator"]>) {
  await section.getByRole("button", { name: "Edit Play Dose" }).first().click();
  return page.getByRole("dialog", { name: "Edit Play Dose" });
}

test("editing every activity and its video saves all of it in one go", async ({ page }) => {
  const { section, headers, doseId } = await setUp(page, "Save all plan");
  let edit = await openEditor(page, section);
  const activities = edit.getByRole("button", { name: "Edit activity" });
  for (let index = 0; index < 3; index++) {
    await activities.nth(index).click();
    await edit.getByLabel("Activity name").fill(`Renamed ${index + 1}`);
    const steps = edit.getByRole("textbox", { name: "Steps" });
    await steps.click();
    await page.keyboard.press("ControlOrMeta+End");
    await steps.pressSequentially(` and more ${index + 1}`);
    if (index === 0) {
      await edit.getByLabel(/upload a video file/i).setInputFiles(VIDEO);
      // The video starts uploading as soon as it is picked.
      await expect(edit.getByText("uploaded", { exact: true })).toBeVisible();
    } else await edit.getByLabel("Video link").fill(`https://videos.example.com/${index + 1}.mp4`);
  }
  const requests: string[] = [];
  page.on("request", (request) => {
    if (request.url().startsWith(API) && request.method() !== "GET") {
      requests.push(`${request.method()} ${new URL(request.url()).pathname}`);
    }
  });
  await edit.getByRole("button", { name: "Save changes" }).click();
  await expect(edit).toBeHidden();
  // The video was already uploaded, so saving is one request for the dose and every activity.
  expect(requests).toEqual([`PUT /api/v1/play-doses/${doseId}/content`]);

  const stored = async () => {
    const catalog = await (
      await page.request.get(`${API}/play-plans?include_inactive=true`, { headers })
    ).json();
    return catalog
      .flatMap((plan: { play_doses: unknown[] }) => plan.play_doses)
      .find((dose: { id: string }) => dose.id === doseId).activities as {
      title: string;
      instructions: string[];
      video_url: string | null;
      video_source_type: string | null;
    }[];
  };
  let saved = await stored();
  expect(saved.map((a) => a.title)).toEqual(["Renamed 1", "Renamed 2", "Renamed 3"]);
  expect(saved[0]!.instructions.join(" ")).toContain("and more 1");
  expect(saved[0]!.video_source_type).toBe("upload");
  expect(saved[2]!.video_url).toBe("https://videos.example.com/3.mp4");
  const uploadedVideo = saved[0]!.video_url;

  // Reopening shows the saved content; saving again keeps the uploaded video.
  edit = await openEditor(page, section);
  await edit.getByRole("button", { name: "Edit activity" }).nth(1).click();
  await expect(edit.getByLabel("Activity name")).toHaveValue("Renamed 2");
  await edit.getByLabel("Activity name").fill("Renamed 2 again");
  await edit.getByRole("button", { name: "Save changes" }).click();
  await expect(edit).toBeHidden();
  saved = await stored();
  expect(saved[1]!.title).toBe("Renamed 2 again");
  expect(saved[0]!.video_url).toBe(uploadedVideo);
  expect(saved[0]!.video_source_type).toBe("upload");
  expect((await page.request.get(`http://127.0.0.1:8765${uploadedVideo}`)).ok()).toBeTruthy();
});

test("each activity has its own Save, and Save changes still saves the rest", async ({ page }) => {
  const { section, headers, doseId } = await setUp(page, "Save one plan");
  const edit = await openEditor(page, section);
  const activities = edit.getByRole("button", { name: "Edit activity" });

  await activities.nth(0).click();
  await expect(edit.getByRole("button", { name: "Save activity" })).toBeDisabled();
  await edit.getByLabel("Activity name").fill("Saved on its own");
  await expect(edit.getByText("Unsaved changes")).toHaveCount(1);
  await edit.getByRole("button", { name: "Save activity" }).click();
  await expect(edit.getByText("Activity saved")).toBeVisible();
  await expect(edit.getByText("Unsaved changes")).toHaveCount(0);

  // A new activity can be saved on its own too.
  await edit.getByRole("button", { name: "Add activity" }).click();
  await activities.nth(3).click();
  await edit.getByLabel("Activity name").fill("Added and saved");
  await edit.getByRole("button", { name: "Save activity" }).click();
  await expect(edit.getByText("Activity saved")).toBeVisible();

  // This one is left for the main Save.
  await activities.nth(1).click();
  await edit.getByLabel("Activity name").fill("Saved with everything");
  await edit.getByRole("button", { name: "Save changes" }).click();
  await expect(edit).toBeHidden();

  const catalog = await (
    await page.request.get(`${API}/play-plans?include_inactive=true`, { headers })
  ).json();
  const dose = catalog
    .flatMap((plan: { play_doses: unknown[] }) => plan.play_doses)
    .find((item: { id: string }) => item.id === doseId);
  expect(dose.activities.map((a: { title: string }) => a.title)).toEqual([
    "Saved on its own",
    "Saved with everything",
    "Activity 3",
    "Added and saved",
  ]);
});

test("closing with unsaved changes asks first, and a failed save says so", async ({ page }) => {
  const { section } = await setUp(page, "Guard plan");
  const edit = await openEditor(page, section);
  await edit.getByRole("button", { name: "Edit activity" }).first().click();
  await edit.getByLabel("Activity name").fill("Not saved yet");
  page.once("dialog", (dialog) => void dialog.dismiss());
  await edit.getByRole("button", { name: "Cancel" }).click();
  await expect(edit).toBeVisible();

  await page.route("**/play-doses/*/content", (route) =>
    route.fulfill({
      status: 500,
      contentType: "application/json",
      body: '{"detail":"Server unavailable"}',
    }),
  );
  await edit.getByRole("button", { name: "Save changes" }).click();
  await expect(edit.getByRole("alert")).toContainText("Nothing was saved");
  await expect(edit.getByLabel("Activity name")).toHaveValue("Not saved yet");
});

test("saving waits for a video still uploading, then attaches it", async ({ page }) => {
  const { section, headers, doseId } = await setUp(page, "Slow upload plan");
  // Hold the upload until the test lets it go, as a large file on a slow connection would.
  let release!: () => void;
  const held = new Promise<void>((resolve) => (release = resolve));
  await page.route("**/media/videos", async (route) => {
    await held;
    await route.continue();
  });
  const edit = await openEditor(page, section);
  await edit.getByRole("button", { name: "Edit activity" }).first().click();
  await edit.getByLabel(/upload a video file/i).setInputFiles(VIDEO);
  await expect(edit.getByText(/uploading \d+%/)).toBeVisible();
  await edit.getByRole("button", { name: "Save changes" }).click();
  await expect(edit.getByRole("button", { name: /Uploading videos…/ })).toBeVisible();
  release();
  await expect(edit).toBeHidden();
  const catalog = await (
    await page.request.get(`${API}/play-plans?include_inactive=true`, { headers })
  ).json();
  const dose = catalog
    .flatMap((plan: { play_doses: unknown[] }) => plan.play_doses)
    .find((item: { id: string }) => item.id === doseId);
  expect(dose.activities[0].video_source_type).toBe("upload");
  expect(dose.activities[0].video_url).toBeTruthy();
});
