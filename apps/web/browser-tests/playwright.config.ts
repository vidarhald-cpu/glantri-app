import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: ".",
  testMatch: "**/*.spec.mts",
  workers: 1,
  retries: 0,
  reporter: "list",
  use: { browserName: "chromium", trace: "retain-on-failure" },
});
