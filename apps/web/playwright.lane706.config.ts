import { defineConfig, devices } from "@playwright/test";

import { WEB_URL } from "./e2e/targets";

/**
 * Lane-scoped configuration for the #706 session-cookie proof. It follows the convention #690's
 * lane introduced, and the ordinary `playwright.config.ts` excludes the spec through its
 * `testIgnore: /lane\d+-.*\.spec\.ts/` pattern.
 *
 * There is deliberately no `globalSetup` and no injected `storageState`: the subject of the proof
 * is the browser's own handling of the session cookie the API sets, so the session must be
 * established by logging in through the UI inside each browser engine.
 *
 * Two engines run, because the defect is engine-dependent: Chromium treats `http://localhost` as a
 * trustworthy origin and stores a `Secure` cookie there, which masks the defect, while WebKit —
 * the engine behind Safari — refuses it.
 */
export default defineConfig({
  forbidOnly: !!process.env.CI,
  fullyParallel: false,
  reporter: "list",
  retries: 0,
  testDir: "./e2e",
  testMatch: /lane706-.*\.spec\.ts/,
  use: {
    baseURL: WEB_URL,
    trace: "retain-on-failure",
  },
  workers: 1,
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
    { name: "webkit", use: { ...devices["Desktop Safari"] } },
  ],
});
