import { defineConfig, devices } from "@playwright/test";

import { WEB_URL } from "./e2e/targets";

/**
 * Lane-scoped configuration for the #690 rendered proof. It runs only that spec, and uses the
 * lane's own seeded-game-master setup instead of the suite's account bootstrap, which is
 * incompatible with a seeded database.
 */
export default defineConfig({
  forbidOnly: !!process.env.CI,
  fullyParallel: false,
  globalSetup: "./e2e/lane690-global-setup",
  reporter: "list",
  retries: 0,
  testDir: "./e2e",
  testMatch: /lane690-.*\.spec\.ts/,
  use: {
    baseURL: WEB_URL,
    trace: "retain-on-failure",
  },
  workers: 1,
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
});
