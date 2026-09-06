import { expect, test, type APIRequestContext } from "@playwright/test";

const API_URL = process.env.PLAYWRIGHT_API_URL ?? "http://localhost:4000";

async function json<T>(response: Awaited<ReturnType<APIRequestContext["get"]>>): Promise<T> {
  expect(response.ok(), await response.text()).toBe(true);
  return response.json() as Promise<T>;
}

async function postJson<T>(
  request: APIRequestContext,
  endpoint: string,
  data: unknown,
): Promise<T> {
  return json<T>(await request.post(`${API_URL}${endpoint}`, { data }));
}

test.describe("Critical Bleed treatment command repair", () => {
  test.use({ storageState: "e2e/.auth/gm.json" });

  test("keeps treatment in Current Action and reverses it through Clear after reload", async ({
    browser,
    page: gmPage,
  }) => {
    const suffix = Date.now();
    const playerContext = await browser.newContext({ storageState: "e2e/.auth/player.json" });
    const gmMe = await json<{ user: { id: string } }>(
      await gmPage.request.get(`${API_URL}/auth/me`),
    );
    const playerMe = await json<{ user: { id: string } }>(
      await playerContext.request.get(`${API_URL}/auth/me`),
    );
    const campaign = await postJson<{ campaign: { id: string } }>(gmPage.request, "/campaigns", {
      name: `Critical treatment repair ${suffix}`,
      status: "active",
    });
    const scenario = await postJson<{ scenario: { id: string } }>(
      gmPage.request,
      `/campaigns/${campaign.campaign.id}/scenarios`,
      { name: `Critical treatment scenario ${suffix}`, status: "live" },
    );
    const participant = await postJson<{
      participant: { id: string; state: Record<string, unknown> };
    }>(gmPage.request, `/scenarios/${scenario.scenario.id}/participants/entity`, {
      controlledByUserId: playerMe.user.id,
      entityInput: {
        kind: "npc",
        name: `Treated guard ${suffix}`,
        snapshot: { displayName: `Treated guard ${suffix}` },
      },
      role: "player_character",
    });
    const effectId = `critical-bleed-${suffix}`;
    const sourceEventId = `critical-event-${suffix}`;
    const createdAt = new Date().toISOString();
    await json(
      await gmPage.request.put(
        `${API_URL}/scenarios/${scenario.scenario.id}/participants/${participant.participant.id}/state`,
        {
          data: {
            state: {
              ...participant.participant.state,
              combatEffects: {
                effects: [
                  {
                    createdAt,
                    criticalRuntime: {
                      bleed: {
                        allowedControlStates: ["active", "partial", "staunched_zero", "resolved"],
                        controlState: "active",
                        currentRate: { denominator: 2, numerator: 1 },
                        firstTickRound: 2,
                        kind: "external",
                        rate: { denominator: 2, numerator: 1 },
                        sourceEffectKey: "blunt|arm|12|03",
                        sourceRate: "1 HP / 2 rounds",
                      },
                      criticalKey: "blunt|arm|12",
                      fixtureVersion: "c1-five-key-post-393-2026-09-06",
                      kind: "bleed",
                    },
                    damage: 0,
                    description: "Bleed 1/2 HP per round.",
                    effectGroup: "bleed",
                    generalDamage: 0,
                    id: effectId,
                    sourceEventId,
                    status: "active",
                    targetParticipantId: participant.participant.id,
                    type: "bleed",
                    updatedAt: createdAt,
                  },
                ],
                events: [],
              },
            },
          },
        },
      ),
    );
    const encounterId = `critical-treatment-${suffix}`;
    const encounterParticipantId = `treated-guard-${suffix}`;
    await postJson(gmPage.request, `/scenarios/${scenario.scenario.id}/encounters`, {
      session: {
        campaignId: campaign.campaign.id,
        createdAt,
        currentRound: 1,
        id: encounterId,
        kind: "combat",
        participants: [
          {
            id: encounterParticipantId,
            label: `Treated guard ${suffix}`,
            participantType: "scenario",
            scenarioParticipantId: participant.participant.id,
          },
        ],
        scenarioId: scenario.scenario.id,
        status: "active",
        title: `Critical treatment ${suffix}`,
        updatedAt: createdAt,
      },
    });

    await gmPage.setViewportSize({ height: 844, width: 390 });
    await gmPage.goto(
      `/campaigns/${campaign.campaign.id}?tab=combat&scenarioId=${scenario.scenario.id}&encounterId=${encounterId}`,
    );
    await gmPage
      .getByRole("button", {
        name: new RegExp(`Treated guard ${suffix} · Round 1 · DE:`),
      })
      .click();
    const currentAction = gmPage.getByText("Current action", { exact: true }).locator("..");
    const treatment = currentAction.getByLabel("Current Action Bleed treatment");
    await expect(treatment).toBeVisible();
    await expect(gmPage.locator('section[aria-label="Critical Bleed treatment"]')).toHaveCount(0);
    const staunchButton = treatment.getByRole("button", { name: "Mark staunched" });
    await staunchButton.focus();
    await expect(staunchButton).toBeFocused();
    await staunchButton.press("Enter");
    await expect(treatment).toContainText("staunched");
    await expect(gmPage.getByRole("button", { name: "Clear current step" })).toBeEnabled();
    const declarationTreatmentLogEntry = gmPage.getByRole("button", {
      name: /Round 1 · Declaration.*Bleed changed from active to staunched/,
    });
    await expect(declarationTreatmentLogEntry).toBeVisible();

    const treatedEncounter = await json<{
      encounter: {
        combatRoundState: {
          commands: Array<{
            createdByUserId?: string;
            facts: Record<string, unknown>;
            participantId: string;
            type: string;
          }>;
        };
      };
    }>(await gmPage.request.get(`${API_URL}/encounters/${encounterId}`));
    expect(treatedEncounter.encounter.combatRoundState.commands.at(-1)).toMatchObject({
      createdByUserId: gmMe.user.id,
      participantId: encounterParticipantId,
      type: "transition_critical_bleed",
      facts: {
        actorUserId: gmMe.user.id,
        scenarioParticipantId: participant.participant.id,
        targetParticipantId: encounterParticipantId,
      },
    });
    const gmHistory = await json<unknown>(
      await gmPage.request.get(`${API_URL}/encounters/${encounterId}/combat-history`),
    );
    expect(JSON.stringify(gmHistory)).toContain("bleed_treatment");
    expect(JSON.stringify(gmHistory)).toContain("staunched_zero");

    const playerEncounter = await json<unknown>(
      await playerContext.request.get(`${API_URL}/encounters/${encounterId}`),
    );
    expect(JSON.stringify(playerEncounter)).not.toContain("transition_critical_bleed");
    expect(JSON.stringify(playerEncounter)).not.toContain('"gmReview"');
    expect(JSON.stringify(playerEncounter)).not.toContain('"previousEffect"');
    expect(JSON.stringify(playerEncounter)).not.toContain('"nextEffect"');

    await gmPage.setViewportSize({ height: 900, width: 1280 });
    await gmPage.reload();
    await gmPage
      .getByRole("button", {
        name: new RegExp(`Treated guard ${suffix} · Round 1 · DE:`),
      })
      .click();
    await expect(
      gmPage
        .getByText("Current action", { exact: true })
        .locator("..")
        .getByLabel("Current Action Bleed treatment"),
    ).toContainText("staunched");
    await expect(declarationTreatmentLogEntry).toBeVisible();
    const clearButton = gmPage.getByRole("button", { name: "Clear current step" });
    await expect(clearButton).toBeEnabled();
    await clearButton.click();
    await expect(
      gmPage
        .getByText("Current action", { exact: true })
        .locator("..")
        .getByLabel("Current Action Bleed treatment"),
    ).toContainText("active");

    const clearedEncounter = await json<unknown>(
      await gmPage.request.get(`${API_URL}/encounters/${encounterId}`),
    );
    expect(JSON.stringify(clearedEncounter)).not.toContain("transition_critical_bleed");
    const clearedHistory = await json<unknown>(
      await gmPage.request.get(`${API_URL}/encounters/${encounterId}/combat-history`),
    );
    expect(JSON.stringify(clearedHistory)).not.toContain("bleed_treatment");
    const reloadedParticipants = await json<{
      participants: Array<{
        id: string;
        state: { combatEffects?: { effects?: Array<Record<string, unknown>>; events?: unknown[] } };
      }>;
    }>(await gmPage.request.get(`${API_URL}/scenarios/${scenario.scenario.id}/participants`));
    const restored = reloadedParticipants.participants.find(
      (candidate) => candidate.id === participant.participant.id,
    );
    expect(restored?.state.combatEffects?.effects?.[0]).toMatchObject({
      criticalRuntime: {
        bleed: {
          controlState: "active",
          currentRate: { denominator: 2, numerator: 1 },
        },
      },
      description: "Bleed 1/2 HP per round.",
    });
    expect(restored?.state.combatEffects?.events).toEqual([]);

    await playerContext.close();
  });
});
