import { defineConfig, devices } from "@playwright/test";

/**
 * Lane-scoped configuration for the #875 rendered proof. It runs only that spec and keeps it out
 * of the ordinary suite (whose `testIgnore` excludes `lane<n>-` specs), so adding a rendered proof
 * does not change what CI runs.
 *
 * Unlike the #690 and #694 lane configs it reuses the suite's own `global-setup`, because this
 * spec builds its whole fixture through the API on a freshly migrated, UNSEEDED target rather than
 * reading a seeded game.
 */
export default defineConfig({
  forbidOnly: !!process.env.CI,
  fullyParallel: false,
  globalSetup: "./e2e/global-setup",
  reporter: "list",
  retries: 0,
  testDir: "./e2e",
  testMatch: /lane875-.*\.spec\.ts/,
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:3000",
    trace: "retain-on-failure",
  },
  workers: 1,
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
});
