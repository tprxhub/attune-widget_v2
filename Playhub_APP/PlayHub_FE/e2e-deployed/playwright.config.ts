import { defineConfig, devices } from "@playwright/test";
export default defineConfig({
  testDir: ".",
  workers: 1,
  timeout: 120_000,
  expect: { timeout: 15_000 },
  reporter: [["list"]],
  use: { baseURL: "https://main.d26shnrmjkyydp.amplifyapp.com", ...devices["Desktop Chrome"] },
});
