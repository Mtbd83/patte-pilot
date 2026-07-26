import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  // Local runs cap concurrency: `next dev` compiles each route on demand,
  // and the app now spans enough distinct routes (animaux, familles
  // d'accueil, comptabilité, stock, candidatures, adopter...) that letting
  // every worker cold-compile in parallel thrashes a single dev server's
  // CPU budget. Fewer workers means less contention per compile.
  workers: process.env.CI ? undefined : 3,
  // A local retry absorbs whatever cold-compile contention remains — not
  // masking a real bug, since passes are consistent once the server is warm.
  retries: process.env.CI ? 2 : 1,
  // Generous per-test timeout: against `next dev`, each route compiles
  // on-demand the first time it's hit, which can take well past the
  // default 30s when a fresh server has to cold-compile many routes.
  timeout: 90_000,
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
