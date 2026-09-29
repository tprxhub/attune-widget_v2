import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  workers: 1,
  timeout: 75_000,
  expect: { timeout: 10_000 },
  reporter: [["list"]],
  use: {
    baseURL: "http://127.0.0.1:4174",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    ...devices["Desktop Chrome"],
  },
  webServer: [
    {
      command: "sh scripts/run-e2e-backend.sh",
      cwd: "../PlayHub_BE",
      url: "http://127.0.0.1:8765/ready",
      timeout: 120_000,
      reuseExistingServer: false,
    },
    {
      command:
        "VITE_API_URL=http://127.0.0.1:8765/api/v1 VITE_ENABLE_PERSONA_SWITCHER=false VITE_ENABLE_DEVTOOLS_GUARD=true bun run dev -- --host 127.0.0.1 --port 4174",
      url: "http://127.0.0.1:4174/login",
      timeout: 120_000,
      reuseExistingServer: false,
    },
  ],
});
