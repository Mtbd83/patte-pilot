import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  retries: process.env.CI ? 2 : 0,
  // Generous per-test timeout: against `next dev`, each route compiles
  // on-demand the first time it's hit, which can take well past the
  // default 30s when a fresh server has to cold-compile many routes.
  timeout: 60_000,
  globalSetup: "./e2e/global-setup.ts",
  use: {
    baseURL: process.env.E2E_BASE_URL ?? "http://localhost:3000",
    trace: "on-first-retry",
  },
  webServer: {
    command: "npm run dev",
    url: "http://localhost:3000",
    reuseExistingServer: !process.env.CI,
    env: {
      ENABLE_TEST_MAIL_SINK: "true",
    },
  },
});
