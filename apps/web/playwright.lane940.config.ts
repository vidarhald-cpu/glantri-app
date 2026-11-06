import { defineConfig, devices } from "@playwright/test";

import { WEB_URL } from "./e2e/targets";

/**
 * Lane-scoped configuration for the #940 Tier A rendered proof. It runs only that spec and uses
 * the suite's ordinary account bootstrap, because the proof creates its own campaign, scenario and
 * encounter and therefore wants a freshly provisioned, migrated, **unseeded** task target — the
 * same state `pnpm db:task:e2e` gives the main suite.
 *
 * The bootstrap is not idempotent against a database it has already run against: a second run on
 * the same target fails in `globalSetup` with `CHARACTER_ALREADY_IN_ACTIVE_CAMPAIGN`. Re-provision
 * between runs (`db:task:cleanup`, `db:task:setup`, `db:task:migrate -- --target application`).
 */
export default defineConfig({
  forbidOnly: !!process.env.CI,
  fullyParallel: false,
  globalSetup: "./e2e/global-setup",
  reporter: "list",
  retries: 0,
  testDir: "./e2e",
  testMatch: /lane940-.*\.spec\.ts/,
  use: {
    baseURL: WEB_URL,
    trace: "retain-on-failure",
  },
  workers: 1,
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
});
