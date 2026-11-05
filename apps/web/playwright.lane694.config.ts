import { defineConfig, devices } from "@playwright/test";

import { WEB_URL } from "./e2e/targets";

/**
 * Lane-scoped configuration for the #694 rendered proof. It follows the convention #690's lane
 * introduced: the spec runs only here, and uses the lane's own seeded-game-master setup instead of
 * the suite's account bootstrap, which is incompatible with a seeded database. The ordinary
 * `playwright.config.ts` excludes it through its `testIgnore: /lane\d+-.*\.spec\.ts/` pattern.
 */
export default defineConfig({
  forbidOnly: !!process.env.CI,
  fullyParallel: false,
  globalSetup: "./e2e/lane694-global-setup",
  reporter: "list",
  retries: 0,
  testDir: "./e2e",
  testMatch: /lane694-.*\.spec\.ts/,
  use: {
    baseURL: WEB_URL,
    trace: "retain-on-failure",
  },
  workers: 1,
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
});
