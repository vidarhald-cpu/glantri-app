import { expect, test, type APIResponse } from "@playwright/test";

const API_URL = process.env.PLAYWRIGHT_API_URL ?? "http://localhost:4000";

async function json<T>(response: APIResponse): Promise<T> {
  if (!response.ok()) {
    throw new Error(`${response.status()} ${await response.text()}`);
  }

  return response.json() as Promise<T>;
}

test.describe("Campaign workspace late authorization denial", () => {
  test.use({ storageState: "e2e/.auth/gm.json" });

  test("clears private context when a transient child failure precedes a real 401", async ({
    page,
  }) => {
    expect(
      (
        await page.request.post(`${API_URL}/auth/login`, {
          data: { email: "smoke-gm@test.local", password: "smoketest123" },
        })
      ).status(),
    ).toBe(200);

    const suffix = Date.now();
    const privateNote = `Late authorization private note ${suffix}`;
    const campaign = await json<{ campaign: { id: string } }>(
      await page.request.post(`${API_URL}/campaigns`, {
        data: { name: `Late authorization Campaign ${suffix}`, status: "active" },
      }),
    );
    const scenario = await json<{ scenario: { id: string; updatedAt: string } }>(
      await page.request.post(`${API_URL}/campaigns/${campaign.campaign.id}/scenarios`, {
        data: { name: `Late authorization Scenario ${suffix}`, status: "live" },
      }),
    );
    await json(
      await page.request.patch(`${API_URL}/scenarios/${scenario.scenario.id}/session`, {
        data: {
          availableObjects: [],
          expectedRevision: scenario.scenario.updatedAt,
          gmPrivateNotes: privateNote,
        },
      }),
    );

    await page.goto(
      `/campaigns/${campaign.campaign.id}?tab=scenario&scenarioId=${scenario.scenario.id}`,
    );
    await expect(page.getByRole("heading", { name: "Private GM notes" })).toBeVisible();
    await expect
      .poll(() =>
        page
          .locator("textarea")
          .evaluateAll((elements) =>
            elements.map((element) => (element as HTMLTextAreaElement).value).join("|"),
          ),
      )
      .toContain(privateNote);
    await expect(
      page.getByRole("navigation", { name: "Scenario and Encounter context" }),
    ).toBeVisible();

    await page.route(
      `${API_URL}/campaigns/${campaign.campaign.id}/scenarios`,
      async (route) => {
        const authorizedScenarios = await route.fetch();
        expect(authorizedScenarios.status()).toBe(200);
        expect((await page.request.post(`${API_URL}/auth/logout`)).status()).toBe(200);
        await route.fulfill({ response: authorizedScenarios });
      },
      { times: 1 },
    );
    await page.route(
      `${API_URL}/scenarios/${scenario.scenario.id}/encounter-summaries`,
      (route) =>
        route.fulfill({
          body: JSON.stringify({ error: "Injected transient refresh failure" }),
          contentType: "application/json",
          status: 503,
        }),
      { times: 1 },
    );
    let releaseParticipantRequests!: () => void;
    const participantRequestGate = new Promise<void>((resolve) => {
      releaseParticipantRequests = resolve;
    });
    await page.route(`${API_URL}/scenarios/${scenario.scenario.id}/participants`, async (route) => {
      await participantRequestGate;
      await route.continue();
    });

    const deniedWorkspaceRefresh = page.waitForResponse(
      (response) =>
        response.url() === `${API_URL}/scenarios/${scenario.scenario.id}/participants` &&
        response.status() === 401,
    );
    await page.evaluate(() => window.dispatchEvent(new Event("focus")));
    await expect(
      page.getByText("We couldn't refresh the Campaign context. Try again or reload the page."),
    ).toBeVisible();
    await expect(page.getByRole("textbox", { name: "Private GM notes" })).toHaveValue(privateNote);

    releaseParticipantRequests();
    const denialResponse = await deniedWorkspaceRefresh;
    expect(await denialResponse.json()).toEqual({ error: "Authentication required." });

    await expect(page).toHaveURL(/\/campaigns$/);
    await expect(
      page.getByText("Sign in to see your Campaigns and continue playing."),
    ).toBeVisible();
    await expect(page.getByText(privateNote)).toHaveCount(0);
    await expect(page.getByRole("heading", { name: "Private GM notes" })).toHaveCount(0);
    await expect(
      page.getByRole("navigation", { name: "Scenario and Encounter context" }),
    ).toHaveCount(0);

    const rememberedSelectionKeys = [
      "glantri.remembered-selection.campaign-id",
      `glantri.remembered-selection.scenario-id:${campaign.campaign.id}`,
      `glantri.remembered-selection.encounter-id:${campaign.campaign.id}`,
      `glantri.remembered-selection.workspace-tab:${campaign.campaign.id}`,
    ];
    await expect
      .poll(() =>
        page.evaluate(
          (keys) => keys.map((key) => localStorage.getItem(key)),
          rememberedSelectionKeys,
        ),
      )
      .toEqual([null, null, null, null]);
  });
});
