import { expect, test } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";

const testState = JSON.parse(
  fs.readFileSync(path.join(__dirname, "test-state.json"), "utf-8"),
) as { campaignId: string; characterId: string };

// ---------------------------------------------------------------------------
// 1. Login flow
// ---------------------------------------------------------------------------
test("login: navigates to /auth, fills credentials and sees confirmation", async ({ page }) => {
  await page.goto("/auth");

  await page.getByLabel("Email").fill("smoke-player@test.local");
  await page.getByLabel("Password").fill("smoketest123");
  await page.getByRole("button", { name: "Login" }).click();

  await expect(page.getByText("Signed in as smoke-player@test.local.")).toBeVisible({
    timeout: 10_000,
  });
});

// ---------------------------------------------------------------------------
// 2. Characters list
// ---------------------------------------------------------------------------
test.describe("characters list", () => {
  test.use({ storageState: "e2e/.auth/player.json" });

  test("shows the seeded character after login", async ({ page }) => {
    await page.goto("/characters");

    await expect(page.getByText("Smoke Character")).toBeVisible({ timeout: 10_000 });
  });
});

// ---------------------------------------------------------------------------
// 3. Chargen minimal flow
// ---------------------------------------------------------------------------
test.describe("chargen flow", () => {
  test.use({ storageState: "e2e/.auth/player.json" });

  test("shows stat profile cards after clicking Roll all dice", async ({ page }) => {
    await page.goto("/chargen");

    await page.getByRole("button", { name: "Roll all dice" }).click();

    await expect(page.getByRole("radio").first()).toBeVisible({ timeout: 15_000 });
  });
});

// ---------------------------------------------------------------------------
// 4. Campaign workspace
// ---------------------------------------------------------------------------
test.describe("campaign workspace", () => {
  test.use({ storageState: "e2e/.auth/gm.json" });

  test("opens campaign workspace and shows the seeded scenario", async ({ page }) => {
    await page.goto(`/campaigns/${testState.campaignId}`);

    await expect(page.getByText("Smoke Test Campaign")).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText("Smoke Test Scenario", { exact: true })).toBeVisible({ timeout: 10_000 });
  });
});
