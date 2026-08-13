import { expect, test } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";

interface SmokeTestState {
  campaignId: string;
  characterId: string;
  delegatedCampaignId: string;
  delegatedCampaignName: string;
  delegatedScenarioDescription: string;
  delegatedScenarioId: string;
  delegatedScenarioName: string;
}

function loadTestState(): SmokeTestState {
  return JSON.parse(
    fs.readFileSync(path.join(__dirname, "test-state.json"), "utf-8"),
  ) as SmokeTestState;
}

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
    const testState = loadTestState();

    await page.goto(`/campaigns/${testState.campaignId}`);

    await expect(page.getByText("Smoke Test Campaign")).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText("Smoke Test Scenario", { exact: true })).toBeVisible({
      timeout: 10_000,
    });
  });
});

// ---------------------------------------------------------------------------
// 5. Player Campaign Home delegated-control privacy
// ---------------------------------------------------------------------------
test.describe("player Campaign Home privacy", () => {
  test.use({ storageState: "e2e/.auth/player.json" });

  test("withholds delegated Scenario payload and presentation from the Character owner", async ({
    page,
  }) => {
    const testState = loadTestState();
    await page.setViewportSize({ height: 844, width: 390 });
    const homeResponsePromise = page.waitForResponse(
      (response) => response.url().endsWith("/campaigns/player-home") && response.status() === 200,
    );

    await page.goto("/campaigns");
    const homeResponse = await homeResponsePromise;
    const payload = (await homeResponse.json()) as {
      campaigns: Array<{
        campaign: { id: string };
        characters: Array<{ id: string }>;
        resume: { scenarioId?: string; tab: string };
        scenarios: Array<{ scenario: { id: string } }>;
      }>;
    };
    const delegatedCampaign = payload.campaigns.find(
      (record) => record.campaign.id === testState.delegatedCampaignId,
    );

    expect(delegatedCampaign).toEqual({
      campaign: expect.objectContaining({ id: testState.delegatedCampaignId }),
      characters: [],
      resume: { tab: "campaign" },
      scenarios: [],
    });
    expect(JSON.stringify(payload)).not.toContain(testState.delegatedScenarioId);
    expect(JSON.stringify(payload)).not.toContain(testState.delegatedScenarioName);
    expect(JSON.stringify(payload)).not.toContain(testState.delegatedScenarioDescription);

    const campaignCard = page
      .getByRole("article")
      .filter({ hasText: testState.delegatedCampaignName });
    await expect(campaignCard).toBeVisible();
    await expect(
      campaignCard.getByText("No active scenario is currently available."),
    ).toBeVisible();
    await expect(campaignCard.getByRole("link", { name: "Open campaign" })).toHaveAttribute(
      "href",
      `/campaigns/${testState.delegatedCampaignId}?tab=campaign`,
    );
    await expect(page.getByText(testState.delegatedScenarioName)).toHaveCount(0);
    await expect(page.getByText(testState.delegatedScenarioDescription)).toHaveCount(0);
  });
});
