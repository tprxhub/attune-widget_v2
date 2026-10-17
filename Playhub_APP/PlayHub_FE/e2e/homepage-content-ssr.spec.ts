import { expect, test } from "@playwright/test";
import { signIn } from "./support/signIn";

const API = "http://127.0.0.1:8765/api/v1";
const DEFAULT_TITLE = "Small doses of play,";
const SAVED_TITLE = "Edited headline from the editor";

test("edited homepage text is in the first HTML, so the built-in text never flashes", async ({
  page,
  browser,
}) => {
  const login = await page.request.post(`${API}/auth/login`, {
    data: { email: "admin@playhub.local", password: "ChangeMe123!" },
  });
  const auth = { Authorization: `Bearer ${(await login.json()).access_token}` };
  const before = (await (await page.request.get(`${API}/site-content/homepage`)).json()).content;

  await signIn(page, "admin@playhub.local");
  await page.goto("/admin/homepage");
  await page.getByLabel("Headline, first line").fill(SAVED_TITLE);
  await page.getByRole("button", { name: "Save changes" }).click();
  await expect(page.getByText(/Saved\. Your page content/)).toBeVisible();

  try {
    // The server-rendered page, before any script runs.
    const html = await (await page.request.get("/")).text();
    const headline = html.match(/<h1[^>]*>([^<]*)/)?.[1];
    expect(headline).toBe(SAVED_TITLE);

    // A fresh visitor's browser: the headline never shows the built-in title while loading.
    const visitor = await browser.newPage();
    await visitor.addInitScript((defaultTitle) => {
      new MutationObserver(() => {
        if (document.querySelector("h1")?.textContent?.includes(defaultTitle)) {
          (window as unknown as { sawDefault: boolean }).sawDefault = true;
        }
      }).observe(document, { subtree: true, childList: true, characterData: true });
    }, DEFAULT_TITLE);
    await visitor.goto("/");
    await expect(visitor.getByRole("heading", { level: 1 })).toContainText(SAVED_TITLE);
    await visitor.waitForTimeout(1500);
    await expect(visitor.getByRole("heading", { level: 1 })).toContainText(SAVED_TITLE);
    expect(
      await visitor.evaluate(() => (window as unknown as { sawDefault?: boolean }).sawDefault),
    ).toBeFalsy();
    await visitor.close();
  } finally {
    if (before) {
      await page.request.put(`${API}/site-content/homepage`, { headers: auth, data: before });
    } else {
      await page.request.delete(`${API}/site-content/homepage`, { headers: auth });
    }
  }
});
