import { expect, test } from "@playwright/test";

const API = "http://127.0.0.1:8765/api/v1";

test("the skill tiles show each Play Plan's picture and no numbers", async ({ page, request }) => {
  const login = await request.post(`${API}/auth/login`, {
    data: { email: "admin@playhub.local", password: "ChangeMe123!" },
  });
  const headers = { Authorization: `Bearer ${(await login.json()).access_token}` };
  const plans: {
    category_name: string;
    play_doses: { id: string; thumbnail_url: string | null }[];
  }[] = await (await request.get(`${API}/play-plans`, { headers })).json();
  const plan = plans.find((p) => p.category_name === "Bilateral Coordination & Midline Crossing")!;
  const dose = plan.play_doses[0]!;
  const picture = "https://example.com/bilateral-picture.jpg";
  const patch = (thumbnail_url: string | null) =>
    request.patch(`${API}/play-doses/${dose.id}`, { headers, data: { thumbnail_url } });
  expect((await patch(picture)).ok()).toBeTruthy();

  try {
    await page.goto("/");
    const section = page.locator("#play-plans");
    const tile = section.getByRole("link").filter({ hasText: "Bilateral Coordination" });
    await expect(tile.getByTestId("skill-picture")).toHaveAttribute("src", picture);
    // Every tile has a picture, built-in until its plan has one of its own.
    const pictures = section.getByTestId("skill-picture");
    expect(await pictures.count()).toBeGreaterThan(1);
    for (const img of await pictures.all()) await expect(img).toHaveAttribute("src", /.+/);
    // No counts or positions: the library grows past seven skills.
    await expect(section).not.toContainText("01 / 07");
    await expect(section).not.toContainText("focus areas");
    await expect(section.getByText(/^0[2-9]$/)).toHaveCount(0);
    // Rookie, Starter and Pro read as −1, 0 and +1.
    await expect(page.getByText("−1", { exact: true })).toBeVisible();
    await expect(page.getByText("+1", { exact: true })).toBeVisible();
  } finally {
    await patch(dose.thumbnail_url);
  }
});
