import { expect, test, type APIRequestContext } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";

const API_URL = process.env.PLAYWRIGHT_API_URL ?? "http://localhost:4000";

function loadCharacters(): { characterId: string; nonHolderCharacterId: string } {
  return JSON.parse(fs.readFileSync(path.join(__dirname, "test-state.json"), "utf8")) as {
    characterId: string;
    nonHolderCharacterId: string;
  };
}

async function json<T>(response: Awaited<ReturnType<APIRequestContext["get"]>>): Promise<T> {
  if (!response.ok()) {
    throw new Error(`${response.status()} ${await response.text()}`);
  }
  return response.json() as Promise<T>;
}

test.describe("Lost Seal Scenario happy path", () => {
  test.use({ storageState: "e2e/.auth/gm.json" });

  test("runs GM preparation, disjoint Encounters, Skill, Item, privacy, reload, and close", async ({
    browser,
    page,
  }) => {
    const { characterId: characterAId, nonHolderCharacterId: characterBId } = loadCharacters();
    const playerAContext = await browser.newContext({ storageState: "e2e/.auth/player.json" });
    const playerBContext = await browser.newContext({
      storageState: "e2e/.auth/non-holder.json",
    });
    const unrelatedContext = await browser.newContext({
      storageState: "e2e/.auth/unrelated.json",
    });
    const anonymousContext = await browser.newContext({
      storageState: { cookies: [], origins: [] },
    });
    const playerAUser = await json<{ user: { id: string } }>(
      await playerAContext.request.get(`${API_URL}/auth/me`),
    );
    const playerBUser = await json<{ user: { id: string } }>(
      await playerBContext.request.get(`${API_URL}/auth/me`),
    );

    const campaign = await json<{ campaign: { id: string } }>(
      await page.request.post(`${API_URL}/campaigns`, {
        data: { name: `Lost Seal ${Date.now()}`, status: "active" },
      }),
    );
    for (const characterId of [characterAId, characterBId]) {
      await json(
        await page.request.post(`${API_URL}/campaigns/${campaign.campaign.id}/roster`, {
          data: { category: "pc", sourceId: characterId, sourceType: "character" },
        }),
      );
    }
    const scenario = await json<{ scenario: { id: string; updatedAt: string } }>(
      await page.request.post(`${API_URL}/campaigns/${campaign.campaign.id}/scenarios`, {
        data: {
          description: "Recover the Lost Seal before the council meets.",
          name: "Lost Seal",
          status: "live",
        },
      }),
    );
    const participantA = await json<{ participant: { id: string } }>(
      await page.request.post(
        `${API_URL}/scenarios/${scenario.scenario.id}/participants/character`,
        { data: { characterId: characterAId, controlledByUserId: playerAUser.user.id } },
      ),
    );
    const participantB = await json<{ participant: { id: string } }>(
      await page.request.post(
        `${API_URL}/scenarios/${scenario.scenario.id}/participants/character`,
        { data: { characterId: characterBId, controlledByUserId: playerBUser.user.id } },
      ),
    );
    const itemResponse = await json<{
      state: { itemsById: Record<string, { displayName?: string | null; id: string }> };
    }>(
      await page.request.post(`${API_URL}/campaigns/${campaign.campaign.id}/items`, {
        data: {
          displayName: "Lost Seal",
          facts: { descriptiveTraits: [], unsupportedCapabilities: [] },
          holderCharacterId: characterBId,
          templateId: "weapon-template-dagger",
        },
      }),
    );
    const seal = Object.values(itemResponse.state.itemsById).find(
      (item) => item.displayName === "Lost Seal",
    );
    expect(seal).toBeTruthy();
    const currentScenario = await json<{ scenario: { updatedAt: string } }>(
      await page.request.get(`${API_URL}/scenarios/${scenario.scenario.id}`),
    );
    await json(
      await page.request.patch(`${API_URL}/scenarios/${scenario.scenario.id}/session`, {
        data: {
          availableObjects: [
            {
              addedAt: new Date().toISOString(),
              id: "lost-seal-available",
              sourceId: seal!.id,
              sourceKind: "campaign_item",
              visibility: "players",
            },
          ],
          expectedRevision: currentScenario.scenario.updatedAt,
          gmPrivateNotes: "The steward moved it after midnight.",
        },
      }),
    );

    const createEncounter = async (input: {
      id: string;
      kind: "combat" | "roleplay";
      memberId: string;
      participantId: string;
      title: string;
    }) =>
      json<{ encounter: Record<string, unknown> & { id: string; updatedAt: string } }>(
        await page.request.post(`${API_URL}/scenarios/${scenario.scenario.id}/encounters`, {
          data: {
            session: {
              campaignId: campaign.campaign.id,
              createdAt: new Date().toISOString(),
              id: input.id,
              kind: input.kind,
              participantMembershipMode: "explicit",
              participants: [
                {
                  characterId:
                    input.participantId === participantA.participant.id
                      ? characterAId
                      : characterBId,
                  id: input.memberId,
                  label: input.title,
                  participantType: "scenario",
                  scenarioParticipantId: input.participantId,
                },
              ],
              scenarioId: scenario.scenario.id,
              status: "planned",
              title: input.title,
              updatedAt: new Date().toISOString(),
            },
          },
        }),
      );
    const library = await createEncounter({
      id: `lost-seal-library-${Date.now()}`,
      kind: "roleplay",
      memberId: "library-player-a",
      participantId: participantA.participant.id,
      title: "Seal Library Investigation",
    });
    const courtyard = await createEncounter({
      id: `lost-seal-courtyard-${Date.now()}`,
      kind: "combat",
      memberId: "courtyard-player-b",
      participantId: participantB.participant.id,
      title: "Courtyard Ambush",
    });
    const refreshedLibrary = await json<{ encounter: { id: string; updatedAt: string } }>(
      await page.request.get(`${API_URL}/encounters/${library.encounter.id}`),
    );
    const refreshedCourtyard = await json<{ encounter: { id: string; updatedAt: string } }>(
      await page.request.get(`${API_URL}/encounters/${courtyard.encounter.id}`),
    );
    const starts = await Promise.all([
      page.request.patch(`${API_URL}/encounters/${library.encounter.id}/status`, {
        data: { expectedRevision: refreshedLibrary.encounter.updatedAt, status: "active" },
      }),
      page.request.patch(`${API_URL}/encounters/${courtyard.encounter.id}/status`, {
        data: { expectedRevision: refreshedCourtyard.encounter.updatedAt, status: "active" },
      }),
    ]);
    expect(starts.map((response) => response.status())).toEqual([200, 200]);

    const overlap = await createEncounter({
      id: `lost-seal-overlap-${Date.now()}`,
      kind: "roleplay",
      memberId: "overlap-player-a",
      participantId: participantA.participant.id,
      title: "Overlapping Interview",
    });
    const overlapStart = await page.request.patch(
      `${API_URL}/encounters/${overlap.encounter.id}/status`,
      { data: { expectedRevision: overlap.encounter.updatedAt, status: "active" } },
    );
    expect(overlapStart.status()).toBe(409);
    expect(await overlapStart.text()).not.toContain("Courtyard Ambush");

    const activeLibrary = await json<{
      encounter: Record<string, unknown> & { updatedAt: string };
    }>(await page.request.get(`${API_URL}/encounters/${library.encounter.id}`));
    const assignedRoll = await json<{ encounter: { updatedAt: string } }>(
      await page.request.put(`${API_URL}/encounters/${library.encounter.id}`, {
        data: {
          expectedRevision: activeLibrary.encounter.updatedAt,
          session: {
            ...activeLibrary.encounter,
            roleplayState: {
              actionLog: [],
              gmMessage: "",
              participantDescriptions: {},
              pendingSkillRolls: [
                {
                  assignedAt: new Date().toISOString(),
                  difficulty: "medium",
                  id: "lost-seal-investigation-roll",
                  mode: "difficulty",
                  otherMod: 0,
                  participantId: "library-player-a",
                  silent: false,
                  skillId: "investigation",
                  skillLabel: "Investigation",
                  skillValue: 12,
                },
              ],
              pendingStatChecks: [],
              visibility: {},
            },
          },
        },
      }),
    );
    const skillRoll = await playerAContext.request.post(
      `${API_URL}/encounters/${library.encounter.id}/player-roll`,
      {
        data: {
          expectedRevision: assignedRoll.encounter.updatedAt,
          pendingRollId: "lost-seal-investigation-roll",
          roll: { dieResult: 12, openEndedD10s: [], rollD20: 12 },
        },
      },
    );
    expect(skillRoll.status(), await skillRoll.text()).toBe(200);

    const playerAPage = await playerAContext.newPage();
    await playerAPage.goto(
      `/campaigns/${campaign.campaign.id}/scenarios/${scenario.scenario.id}/player`,
    );
    await expect(playerAPage.getByRole("heading", { name: "Lost Seal" })).toBeVisible();
    await expect(playerAPage.getByText("Encounter: Seal Library Investigation")).toBeVisible();
    await expect(playerAPage.getByText("Courtyard Ambush")).toHaveCount(0);
    const pickUp = playerAPage.getByRole("button", { name: /Pick up as Smoke Character/ });
    await pickUp.focus();
    await expect(pickUp).toBeFocused();
    await pickUp.press("Enter");
    await expect(playerAPage.getByRole("status")).toHaveText("Item picked up.");
    await expect(playerAPage.getByText("No objects are currently available.")).toBeVisible();
    await expect(playerAPage.getByText(/used Investigation:/)).toBeVisible();
    await expect(playerAPage.getByText(/picked up Lost Seal/)).toBeVisible();

    await playerAPage.setViewportSize({ height: 844, width: 390 });
    await playerAPage.reload();
    await expect(playerAPage.getByText(/picked up Lost Seal/)).toBeVisible();
    await expect(playerAPage.getByText("Courtyard Ambush")).toHaveCount(0);

    const playerBSession = await playerBContext.request.get(
      `${API_URL}/scenarios/${scenario.scenario.id}/session`,
    );
    expect(playerBSession.status()).toBe(200);
    const playerBPayload = await playerBSession.text();
    expect(playerBPayload).toContain("Courtyard Ambush");
    expect(playerBPayload).not.toContain("Seal Library Investigation");
    expect(playerBPayload).not.toContain("steward");
    expect(playerBPayload).not.toContain("investigation-roll");
    expect(
      (
        await unrelatedContext.request.get(`${API_URL}/scenarios/${scenario.scenario.id}/session`)
      ).status(),
    ).toBe(404);
    expect(
      (
        await anonymousContext.request.get(`${API_URL}/scenarios/${scenario.scenario.id}/session`)
      ).status(),
    ).toBe(401);

    const closeEncounter = async (encounterId: string, outcome: string, privateNote: string) => {
      const current = await json<{ encounter: { updatedAt: string } }>(
        await page.request.get(`${API_URL}/encounters/${encounterId}`),
      );
      const paused = await json<{ encounter: { updatedAt: string } }>(
        await page.request.patch(`${API_URL}/encounters/${encounterId}/status`, {
          data: { expectedRevision: current.encounter.updatedAt, status: "paused" },
        }),
      );
      const resumed = await json<{ encounter: { updatedAt: string } }>(
        await page.request.patch(`${API_URL}/encounters/${encounterId}/status`, {
          data: { expectedRevision: paused.encounter.updatedAt, status: "active" },
        }),
      );
      return page.request.patch(`${API_URL}/encounters/${encounterId}/status`, {
        data: {
          expectedRevision: resumed.encounter.updatedAt,
          gmPrivateClosingNote: privateNote,
          playerOutcome: outcome,
          status: "complete",
        },
      });
    };
    expect(
      (
        await closeEncounter(
          library.encounter.id,
          "The seal was recovered.",
          "The steward remains under suspicion.",
        )
      ).status(),
    ).toBe(200);
    expect(
      (
        await closeEncounter(
          courtyard.encounter.id,
          "The ambushers withdrew.",
          "Their patron is unknown.",
        )
      ).status(),
    ).toBe(200);
    await playerAPage.reload();
    await expect(playerAPage.getByText("Outcome: The seal was recovered.")).toBeVisible();
    const finalPlayerPayload = await (
      await playerAContext.request.get(`${API_URL}/scenarios/${scenario.scenario.id}/session`)
    ).text();
    expect(finalPlayerPayload).not.toContain("steward remains");
    expect(finalPlayerPayload).not.toContain("Their patron");

    await page.goto(`/campaigns/${campaign.campaign.id}/scenarios/${scenario.scenario.id}`);
    await expect(page.getByRole("heading", { name: "Session preparation" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Private GM notes" })).toBeVisible();

    await Promise.all([
      playerAContext.close(),
      playerBContext.close(),
      unrelatedContext.close(),
      anonymousContext.close(),
    ]);
  });
});
