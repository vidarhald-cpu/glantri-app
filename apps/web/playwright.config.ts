import { defineConfig, devices } from "@playwright/test";

import { WEB_URL } from "./e2e/targets";

export default defineConfig({
  testDir: "./e2e",
  // Lane-scoped proof specs (`e2e/lane<issue>-*.spec.ts`) are deliberately excluded from the
  // ordinary suite. They need a database that has already been through `pnpm db:task:seed`, which
  // is incompatible with this config's account bootstrap and is never what CI runs; each carries
  // its own `playwright.lane<issue>.config.ts` and is run by hand against a task stack (#690).
  testIgnore: /lane\d+-.*\.spec\.ts/,
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: 0,
  workers: 1,
  reporter: process.env.CI ? "list" : "html",
  globalSetup: "./e2e/global-setup",
  use: {
    baseURL: WEB_URL,
    trace: "retain-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
});
