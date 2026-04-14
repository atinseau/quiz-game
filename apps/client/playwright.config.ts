import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  globalSetup: "./tests/global-setup.ts",
  testDir: "./tests/e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 1,
  workers: 1,
  reporter: "html",
  use: {
    baseURL: "http://localhost:3000",
    trace: "on-first-retry",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
      testIgnore: /multi-.*\.spec\.ts/,
    },
    {
      // Multi-device tests share a single WS server and must run serially
      // to avoid race conditions with concurrent WebSocket connections
      name: "multi-device",
      use: { ...devices["Desktop Chrome"] },
      testMatch: /multi-.*\.spec\.ts/,
      fullyParallel: false,
    },
  ],
  webServer: {
    command: "bun --hot index.ts",
    url: "http://localhost:3000",
    reuseExistingServer: !process.env.CI,
  },
});
