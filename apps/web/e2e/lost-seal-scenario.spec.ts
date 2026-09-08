import { expect, test, type APIRequestContext } from "@playwright/test";
import { setScenarioParticipantVisibilityForTest } from "@glantri/database/testing/scenarioPrivacy";
import { createCharacterForE2e } from "./character-fixture";

const API_URL = process.env.PLAYWRIGHT_API_URL ?? "http://localhost:4000";

async function json<T>(response: Awaited<ReturnType<APIRequestContext["get"]>>): Promise<T> {
  if (!response.ok()) {
    throw new Error(`${response.status()} ${await response.text()}`);
  }
  return response.json() as Promise<T>;
}

async function setParticipantVisibility(
  participantId: string,
  visibility: "gm_only" | "hidden" | "visible_to_all",
): Promise<void> {
  if (!process.env.DATABASE_URL) {
    if (process.env.CI !== "true") {
      throw new Error("Lost Seal privacy setup requires the guarded task database environment.");
    }
    process.env.DATABASE_URL = "postgresql://postgres:postgres@localhost:5432/glantri_test";
  }

  await setScenarioParticipantVisibilityForTest({ participantId, visibility });
}

test.describe("Lost Seal Scenario happy path", () => {
  test.use({ storageState: "e2e/.auth/gm.json" });

  test("runs GM preparation, disjoint Encounters, Skill, Item, privacy, reload, and close", async ({
    browser,
    page,
  }) => {
    test.setTimeout(90_000);
    const suffix = Date.now();
    const characterAId = `lost-seal-player-${suffix}`;
    const characterBId = `lost-seal-other-${suffix}`;
    const characterAName = `Lost Seal Player ${suffix}`;
    const characterBName = `Lost Seal Other ${suffix}`;
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
    await createCharacterForE2e({
      apiUrl: API_URL,
      id: characterAId,
      name: characterAName,
      request: playerAContext.request,
    });
    await createCharacterForE2e({
      apiUrl: API_URL,
      id: characterBId,
      name: characterBName,
      request: playerBContext.request,
    });

    const campaign = await json<{ campaign: { id: string } }>(
      await page.request.post(`${API_URL}/campaigns`, {
        data: { name: `Lost Seal ${suffix}`, status: "active" },
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
    const participantB = await json<{
      participant: { id: string; snapshot: { displayName: string } };
    }>(
      await page.request.post(
        `${API_URL}/scenarios/${scenario.scenario.id}/participants/character`,
        { data: { characterId: characterBId, controlledByUserId: playerBUser.user.id } },
      ),
    );
    await setParticipantVisibility(participantB.participant.id, "gm_only");

    const hiddenParticipantName = participantB.participant.snapshot.displayName;
    const nonexistentParticipantName = "Nonexistent Lost Seal Participant";
    const initialDirectPlayerScenario = await playerAContext.request.get(
      `${API_URL}/scenarios/${scenario.scenario.id}`,
    );
    expect(initialDirectPlayerScenario.status()).toBe(200);
    const initialDirectPlayerScenarioPayload = await initialDirectPlayerScenario.text();
    for (const privateKey of [
      "session",
      "appliedRequestIds",
      "availableObjects",
      "gmPrivateNotes",
      "version",
    ]) {
      expect(initialDirectPlayerScenarioPayload).not.toContain(`"${privateKey}"`);
    }
    const initialPlayerSession = await playerAContext.request.get(
      `${API_URL}/scenarios/${scenario.scenario.id}/session`,
    );
    expect(initialPlayerSession.status()).toBe(200);
    const initialPlayerSessionPayload = await initialPlayerSession.text();
    for (const privateIdentity of [
      participantB.participant.id,
      hiddenParticipantName,
      "nonexistent-participant",
      nonexistentParticipantName,
    ]) {
      expect(initialPlayerSessionPayload).not.toContain(privateIdentity);
    }
    const initialPlayerCombatProjection = await playerAContext.request.get(
      `${API_URL}/scenarios/${scenario.scenario.id}/player-projection`,
    );
    expect(initialPlayerCombatProjection.status()).toBe(200);
    const initialPlayerCombatProjectionPayload = await initialPlayerCombatProjection.text();
    for (const privateIdentity of [
      participantB.participant.id,
      hiddenParticipantName,
      "nonexistent-participant",
      nonexistentParticipantName,
    ]) {
      expect(initialPlayerCombatProjectionPayload).not.toContain(privateIdentity);
    }
    const initialPlayerBCombatProjection = await playerBContext.request.get(
      `${API_URL}/scenarios/${scenario.scenario.id}/player-projection`,
    );
    expect(initialPlayerBCombatProjection.status()).toBe(200);
    expect(await initialPlayerBCombatProjection.text()).toContain(hiddenParticipantName);
    const initialGmCombatProjection = await page.request.get(
      `${API_URL}/scenarios/${scenario.scenario.id}/player-projection`,
    );
    expect(initialGmCombatProjection.status()).toBe(200);
    expect(await initialGmCombatProjection.text()).toContain(hiddenParticipantName);

    const playerAPage = await playerAContext.newPage();
    await playerAPage.goto(
      `/campaigns/${campaign.campaign.id}/scenarios/${scenario.scenario.id}/player`,
    );
    await expect(playerAPage.getByRole("heading", { name: "Lost Seal" })).toBeVisible();
    await expect(playerAPage.getByText(hiddenParticipantName, { exact: false })).toHaveCount(0);
    await expect(playerAPage.getByText(nonexistentParticipantName, { exact: false })).toHaveCount(
      0,
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
              status: "draft",
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

    await expect(playerAPage.getByText("Encounter: Seal Library Investigation")).toBeVisible();
    await expect(playerAPage.getByText("Courtyard Ambush")).toHaveCount(0);
    await expect(playerAPage.getByText(hiddenParticipantName, { exact: false })).toHaveCount(0);
    const pickUp = playerAPage.getByRole("button", {
      name: `Pick up as ${characterAName}`,
    });
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
    await expect(playerAPage.getByText(hiddenParticipantName, { exact: false })).toHaveCount(0);

    const playerBSession = await playerBContext.request.get(
      `${API_URL}/scenarios/${scenario.scenario.id}/session`,
    );
    expect(playerBSession.status()).toBe(200);
    const playerBPayload = await playerBSession.text();
    expect(playerBPayload).toContain("Courtyard Ambush");
    expect(playerBPayload).toContain(participantB.participant.id);
    expect(playerBPayload).toContain(hiddenParticipantName);
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
          status: "completed",
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

    const sharedCombat = await json<{ encounter: { id: string; updatedAt: string } }>(
      await page.request.post(`${API_URL}/scenarios/${scenario.scenario.id}/encounters`, {
        data: {
          session: {
            campaignId: campaign.campaign.id,
            createdAt: new Date().toISOString(),
            id: `lost-seal-shared-combat-${Date.now()}`,
            kind: "combat",
            participantMembershipMode: "explicit",
            participants: [
              {
                characterId: characterAId,
                id: "shared-combat-player-a",
                label: characterAName,
                participantType: "scenario",
                scenarioParticipantId: participantA.participant.id,
              },
              {
                characterId: characterBId,
                id: "shared-combat-player-b",
                label: hiddenParticipantName,
                participantType: "scenario",
                scenarioParticipantId: participantB.participant.id,
              },
            ],
            scenarioId: scenario.scenario.id,
            status: "draft",
            title: "Seal Vault Confrontation",
            updatedAt: new Date().toISOString(),
          },
        },
      }),
    );
    const activeSharedCombat = await json<{ encounter: { id: string; updatedAt: string } }>(
      await page.request.patch(`${API_URL}/encounters/${sharedCombat.encounter.id}/status`, {
        data: { expectedRevision: sharedCombat.encounter.updatedAt, status: "active" },
      }),
    );
    const postClosePlayerProjection = await playerAContext.request.get(
      `${API_URL}/scenarios/${scenario.scenario.id}/player-projection`,
    );
    expect(postClosePlayerProjection.status()).toBe(200);
    const postClosePlayerProjectionPayload = await postClosePlayerProjection.text();
    for (const privateIdentity of [
      participantB.participant.id,
      hiddenParticipantName,
      "nonexistent-participant",
      nonexistentParticipantName,
    ]) {
      expect(postClosePlayerProjectionPayload).not.toContain(privateIdentity);
    }

    await setParticipantVisibility(participantB.participant.id, "visible_to_all");

    const playerCombatHref = `/campaigns/${campaign.campaign.id}?tab=player-combat&scenarioId=${scenario.scenario.id}&encounterId=${activeSharedCombat.encounter.id}`;
    await playerAPage.setViewportSize({ height: 900, width: 1280 });
    await playerAPage.goto(playerCombatHref);
    await expect(
      playerAPage.getByRole("heading", { name: `Combat — ${characterAName}` }),
    ).toBeVisible();
    await expect(
      playerAPage.getByText(hiddenParticipantName, { exact: false }).first(),
    ).toBeVisible();
    await expect(
      playerAPage.locator("option").filter({ hasText: hiddenParticipantName }),
    ).not.toHaveCount(0);

    async function restrictDuringOpenCombat(visibility: "gm_only" | "hidden") {
      const cleanProjectionResponse = playerAPage.waitForResponse(
        async (response) =>
          response.url().includes(`/scenarios/${scenario.scenario.id}/player-projection`) &&
          response.status() === 200 &&
          !(await response.text()).includes(participantB.participant.id),
        { timeout: 12_000 },
      );
      const successfulRevisionResponse = playerAPage.waitForResponse(
        (response) =>
          response.url().includes(`/encounters/${activeSharedCombat.encounter.id}/revision`) &&
          response.status() === 200,
        { timeout: 12_000 },
      );
      await setParticipantVisibility(participantB.participant.id, visibility);
      await Promise.all([cleanProjectionResponse, successfulRevisionResponse]);
      await expect(playerAPage.getByText(hiddenParticipantName, { exact: false })).toHaveCount(0);
      await expect(
        playerAPage.locator("option").filter({ hasText: hiddenParticipantName }),
      ).toHaveCount(0);
    }

    async function restoreVisibleParticipant() {
      const visibleProjectionResponse = playerAPage.waitForResponse(
        async (response) =>
          response.url().includes(`/scenarios/${scenario.scenario.id}/player-projection`) &&
          response.status() === 200 &&
          (await response.text()).includes(participantB.participant.id),
        { timeout: 12_000 },
      );
      await setParticipantVisibility(participantB.participant.id, "visible_to_all");
      await visibleProjectionResponse;
      await expect(
        playerAPage.getByText(hiddenParticipantName, { exact: false }).first(),
      ).toBeVisible();
      await expect(
        playerAPage.locator("option").filter({ hasText: hiddenParticipantName }),
      ).not.toHaveCount(0);
    }

    await restrictDuringOpenCombat("gm_only");
    await restoreVisibleParticipant();
    await playerAPage.setViewportSize({ height: 844, width: 390 });
    await restrictDuringOpenCombat("hidden");
    await restoreVisibleParticipant();
    await restrictDuringOpenCombat("gm_only");

    await playerAPage.reload();
    await playerAPage.goto(
      `/campaigns/${campaign.campaign.id}/scenarios/${scenario.scenario.id}/player`,
    );
    await expect(playerAPage.getByText("Outcome: The seal was recovered.")).toBeVisible();
    const finalPlayerPayload = await (
      await playerAContext.request.get(`${API_URL}/scenarios/${scenario.scenario.id}/session`)
    ).text();
    expect(finalPlayerPayload).not.toContain("steward remains");
    expect(finalPlayerPayload).not.toContain("Their patron");
    for (const privateIdentity of [
      participantB.participant.id,
      hiddenParticipantName,
      "nonexistent-participant",
      nonexistentParticipantName,
    ]) {
      expect(finalPlayerPayload).not.toContain(privateIdentity);
    }
    await expect(playerAPage.getByText(hiddenParticipantName, { exact: false })).toHaveCount(0);
    await playerAPage.close();
    const reconnectedPlayerAPage = await playerAContext.newPage();
    await reconnectedPlayerAPage.goto(playerCombatHref);
    await expect(
      reconnectedPlayerAPage.getByRole("heading", { name: `Combat — ${characterAName}` }),
    ).toBeVisible();
    await expect(
      reconnectedPlayerAPage.getByText(hiddenParticipantName, { exact: false }),
    ).toHaveCount(0);
    await expect(
      reconnectedPlayerAPage.locator("option").filter({ hasText: hiddenParticipantName }),
    ).toHaveCount(0);
    await expect(
      reconnectedPlayerAPage.getByText(nonexistentParticipantName, { exact: false }),
    ).toHaveCount(0);

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
