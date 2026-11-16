import type { Page } from "@playwright/test";

const API = "http://127.0.0.1:8765/api/v1";

/**
 * Remembers the saved homepage copy and returns a function that puts it back exactly, removing
 * saved copy when there was none, so later tests still see the original wording.
 */
export async function snapshotHomepage(page: Page): Promise<() => Promise<void>> {
  const before = (await (await page.request.get(`${API}/site-content/homepage`)).json()).content;
  return async () => {
    const login = await page.request.post(`${API}/auth/login`, {
      data: { email: "admin@playhub.local", password: "ChangeMe123!" },
    });
    const headers = { Authorization: `Bearer ${(await login.json()).access_token}` };
    if (before) await page.request.put(`${API}/site-content/homepage`, { headers, data: before });
    else await page.request.delete(`${API}/site-content/homepage`, { headers });
  };
}
