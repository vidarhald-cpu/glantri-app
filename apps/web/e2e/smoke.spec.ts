import { expect, test } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";

const API_URL = process.env.PLAYWRIGHT_API_URL ?? "http://localhost:4000";

interface SmokeTestState {
  campaignId: string;
  characterId: string;
  delegatedCampaignId: string;
  delegatedCampaignName: string;
  delegatedEncounterDescription: string;
  delegatedEncounterId: string;
  delegatedEncounterName: string;
  delegatedScenarioDescription: string;
  delegatedScenarioId: string;
  delegatedScenarioName: string;
  nonHolderCharacterId: string;
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

  test("discovers and rosters another player's Character through the safe candidate view", async ({
    page,
  }) => {
    const testState = loadTestState();
    const createResponse = await page.request.post(`${API_URL}/campaigns`, {
      data: { name: `Cross-player candidate ${Date.now()}` },
    });
    expect(createResponse.ok()).toBe(true);
    const { campaign } = (await createResponse.json()) as { campaign: { id: string } };

    const candidateResponsePromise = page.waitForResponse(
      (response) =>
        response.url().endsWith(`/campaigns/${campaign.id}/roster-candidates/characters`) &&
        response.status() === 200,
    );
    await page.goto(`/campaigns/${campaign.id}`);
    const candidateResponse = await candidateResponsePromise;
    const candidatePayload = (await candidateResponse.json()) as {
      characters: Array<Record<string, unknown>>;
    };
    const otherPlayerCharacter = candidatePayload.characters.find(
      (candidate) => candidate.id === testState.nonHolderCharacterId,
    );

    expect(otherPlayerCharacter).toEqual({
      alreadyRostered: false,
      id: testState.nonHolderCharacterId,
      name: "Smoke Non-holder Character",
      ownerLabel: "Smoke Non-holder",
    });
    expect(Object.keys(otherPlayerCharacter ?? {}).sort()).toEqual([
      "alreadyRostered",
      "id",
      "name",
      "ownerLabel",
    ]);

    const rosterToggle = page.getByRole("checkbox", {
      name: "Toggle Smoke Non-holder Character campaign roster membership",
    });
    await expect(rosterToggle).toBeVisible({ timeout: 10_000 });
    await expect(rosterToggle).not.toBeChecked();

    const rosterResponsePromise = page.waitForResponse(
      (response) =>
        response.url().endsWith(`/campaigns/${campaign.id}/roster`) &&
        response.request().method() === "POST",
    );
    await rosterToggle.click();
    expect((await rosterResponsePromise).status()).toBe(200);
    await expect(rosterToggle).toBeChecked();
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

  test("fails closed on delegated Scenario and Encounter direct routes", async ({ page }) => {
    const testState = loadTestState();
    await page.setViewportSize({ height: 844, width: 390 });
    const endpoints = [
      `/scenarios/${testState.delegatedScenarioId}`,
      `/scenarios/${testState.delegatedScenarioId}/player-projection`,
      `/scenarios/${testState.delegatedScenarioId}/encounters`,
      `/encounters/${testState.delegatedEncounterId}`,
    ];

    for (const endpoint of endpoints) {
      const response = await page.request.get(`${API_URL}${endpoint}`);
      expect(response.status()).toBe(404);
      const body = await response.text();
      expect(body).not.toContain(testState.delegatedScenarioName);
      expect(body).not.toContain(testState.delegatedScenarioDescription);
      expect(body).not.toContain(testState.delegatedEncounterName);
      expect(body).not.toContain(testState.delegatedEncounterDescription);
    }

    await page.goto(
      `/campaigns/${testState.delegatedCampaignId}/scenarios/${testState.delegatedScenarioId}/player`,
    );
    await expect(page.getByText("No encounter is currently available.")).toBeVisible({
      timeout: 10_000,
    });
    const pageText = await page.locator("body").innerText();
    expect(pageText).not.toContain(testState.delegatedScenarioName);
    expect(pageText).not.toContain(testState.delegatedScenarioDescription);
    expect(pageText).not.toContain(testState.delegatedEncounterName);
    expect(pageText).not.toContain(testState.delegatedEncounterDescription);
  });
});

test.describe("delegated Scenario controller access", () => {
  test.use({ storageState: "e2e/.auth/non-holder.json" });

  test("retains direct Scenario and Encounter access", async ({ page }) => {
    const testState = loadTestState();
    const responses = await Promise.all([
      page.request.get(`${API_URL}/scenarios/${testState.delegatedScenarioId}`),
      page.request.get(`${API_URL}/scenarios/${testState.delegatedScenarioId}/player-projection`),
      page.request.get(`${API_URL}/scenarios/${testState.delegatedScenarioId}/encounters`),
      page.request.get(`${API_URL}/encounters/${testState.delegatedEncounterId}`),
    ]);

    for (const response of responses) {
      expect(response.status()).toBe(200);
    }
    expect(await responses[0]!.text()).toContain(testState.delegatedScenarioName);
    expect(await responses[1]!.text()).toContain(testState.delegatedScenarioName);
    expect(await responses[2]!.text()).toContain(testState.delegatedEncounterName);
    expect(await responses[3]!.text()).toContain(testState.delegatedEncounterName);
  });
});

test.describe("delegated Scenario GM access", () => {
  test.use({ storageState: "e2e/.auth/gm.json" });

  test("retains direct private Scenario and Encounter access", async ({ page }) => {
    const testState = loadTestState();
    const scenarioResponse = await page.request.get(
      `${API_URL}/scenarios/${testState.delegatedScenarioId}`,
    );
    const encounterResponse = await page.request.get(
      `${API_URL}/encounters/${testState.delegatedEncounterId}`,
    );

    expect(scenarioResponse.status()).toBe(200);
    expect(encounterResponse.status()).toBe(200);
    expect(await scenarioResponse.text()).toContain(testState.delegatedScenarioName);
    expect(await encounterResponse.text()).toContain(testState.delegatedEncounterName);
  });
});
