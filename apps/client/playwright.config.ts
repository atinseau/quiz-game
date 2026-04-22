import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  globalSetup: "./tests/global-setup.ts",
  testDir: "./tests/e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 1,
  workers: 4,
  reporter: "html",
  use: {
    baseURL: "http://localhost:3000",
    trace: "on-first-retry",
  },
  projects: [
    {
      // Single-device specs: live under tests/e2e/solo/ and any single-device
      // regression tests (regression/repro-*). Multi-device regression files
      // (regression/multi-repro-*) belong to the multi-device project.
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
      testMatch: /(solo|regression)\/[^/]*\.spec\.ts/,
      testIgnore: /regression\/multi-repro-[^/]*\.spec\.ts/,
    },
    {
      // Multi-device tests share a single WS server and must run serially
      // to avoid race conditions with concurrent WebSocket connections.
      name: "multi-device",
      use: { ...devices["Desktop Chrome"] },
      testMatch: /multi\/[^/]*\.spec\.ts|regression\/multi-repro-[^/]*\.spec\.ts/,
      fullyParallel: false,
      workers: 1,
    },
  ],
  webServer: {
    // Unset CLERK_SECRET_KEY so the WS auth falls back to `?testUser=`
    // (see src/server/auth.ts). Without this, the server tries to verify a
    // Clerk JWT cookie that tests don't set and rejects every WS handshake.
    // Plain `bun index.ts` (no --hot). HMR was re-evaluating framework.ts
    // between edits and the game-engine's reference to _onRoundEnd drifted
    // across module instances, making special rounds never resume the game.
    // Dev uses --hot via `bun run dev`; tests want a stable single-instance
    // runtime.
    command: "bun index.ts",
    url: "http://localhost:3000",
    reuseExistingServer: !process.env.CI,
    env: {
      CLERK_SECRET_KEY: "",
      STRAPI_URL: "http://localhost:1337/api",
    },
  },
});
