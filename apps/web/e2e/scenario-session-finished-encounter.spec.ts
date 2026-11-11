import { expect, test, type APIRequestContext } from "@playwright/test";

import { createCharacterForE2e } from "./character-fixture";
import { API_URL } from "./targets";

/**
 * Forgejo #1136 — `GET /scenarios/:id/session` reads a finished Encounter without its combat
 * rounds, so the poll no longer grows with every finished fight. Everything the Scenario pages
 * show of a finished Encounter must survive that: its row in the Encounter list (title, status,
 * outcome) and the past Item outcome a player was shown in Activity, which is the one thing the
 * session projection reads out of an Encounter's combat state.
 *
 * The outcome is produced by the real Item-action lifecycle and the Encounter is closed through
 * the GM's own status route. The readings are taken on the rendered GM and player Scenario pages
 * and on the `/session` payload those pages render from, before and after the close.
 */

type SessionView = {
  encounters: Array<{ id: string; outcome?: string; status: string; title: string }>;
  history: Array<{ encounterId?: string; eventKind: string; id: string; summary: string }>;
  viewerMode: "gm" | "player";
};

async function postJson<T>(
  request: APIRequestContext,
  endpoint: string,
  data: unknown,
): Promise<T> {
  const response = await request.post(`${API_URL}${endpoint}`, { data });
  expect(response.ok(), `${endpoint}: ${await response.text()}`).toBe(true);
  return (await response.json()) as T;
}

async function encounterRevision(request: APIRequestContext, encounterId: string) {
  const response = await request.get(`${API_URL}/encounters/${encounterId}`);
  expect(response.ok(), await response.text()).toBe(true);
  return ((await response.json()) as { encounter: { updatedAt: string } }).encounter.updatedAt;
}

async function setStatus(
  request: APIRequestContext,
  encounterId: string,
  data: { playerOutcome?: string; status: "active" | "completed" | "paused" },
) {
  const response = await request.patch(`${API_URL}/encounters/${encounterId}/status`, {
    data: { ...data, expectedRevision: await encounterRevision(request, encounterId) },
  });
  expect(response.ok(), await response.text()).toBe(true);
}

async function loadSession(request: APIRequestContext, scenarioId: string) {
  const response = await request.get(`${API_URL}/scenarios/${scenarioId}/session`);
  expect(response.ok(), await response.text()).toBe(true);
  return ((await response.json()) as { session: SessionView }).session;
}

const itemRows = (session: SessionView) =>
  session.history
    .filter((row) => row.eventKind === "item_resolution")
    .map(({ encounterId, id, summary }) => ({ encounterId, id, summary }));

test.describe("Scenario session after an Encounter is closed (#1136)", () => {
  test.use({ storageState: "e2e/.auth/gm.json" });

  test("keeps the closed Encounter and its past Item outcome on the GM and player Scenario pages", async ({
    browser,
    page: gmPage,
  }) => {
    const suffix = Date.now();
    const playerContext = await browser.newContext({ storageState: "e2e/.auth/player.json" });
    const recipientContext = await browser.newContext({
      storageState: "e2e/.auth/non-holder.json",
    });
    const playerPage = await playerContext.newPage();
    const userId = async (request: APIRequestContext) =>
      ((await (await request.get(`${API_URL}/auth/me`)).json()) as { user: { id: string } }).user
        .id;
    const characterId = `s1136-source-${suffix}`;
    const recipientCharacterId = `s1136-recipient-${suffix}`;
    const characterName = `S1136 Source ${suffix}`;
    const recipientCharacterName = `S1136 Recipient ${suffix}`;
    await createCharacterForE2e({
      apiUrl: API_URL,
      id: characterId,
      name: characterName,
      request: playerContext.request,
    });
    await createCharacterForE2e({
      apiUrl: API_URL,
      id: recipientCharacterId,
      name: recipientCharacterName,
      request: recipientContext.request,
    });

    const campaignId = (
      await postJson<{ campaign: { id: string } }>(gmPage.request, "/campaigns", {
        name: `S1136 Campaign ${suffix}`,
        status: "active",
      })
    ).campaign.id;
    for (const sourceId of [characterId, recipientCharacterId]) {
      await postJson(gmPage.request, `/campaigns/${campaignId}/roster`, {
        category: "pc",
        sourceId,
        sourceType: "character",
      });
    }
    const scenarioId = (
      await postJson<{ scenario: { id: string } }>(
        gmPage.request,
        `/campaigns/${campaignId}/scenarios`,
        { name: `S1136 Scenario ${suffix}`, status: "live" },
      )
    ).scenario.id;
    const sourceParticipant = await postJson<{ participant: { id: string } }>(
      gmPage.request,
      `/scenarios/${scenarioId}/participants/character`,
      { characterId, controlledByUserId: await userId(playerContext.request) },
    );
    const recipientParticipant = await postJson<{ participant: { id: string } }>(
      gmPage.request,
      `/scenarios/${scenarioId}/participants/character`,
      {
        characterId: recipientCharacterId,
        controlledByUserId: await userId(recipientContext.request),
      },
    );
    const now = new Date().toISOString();
    const encounterTitle = `S1136 Ford ${suffix}`;
    const encounterId = (
      await postJson<{ encounter: { id: string } }>(
        gmPage.request,
        `/scenarios/${scenarioId}/encounters`,
        {
          session: {
            campaignId,
            createdAt: now,
            currentRound: 1,
            id: `s1136-encounter-${suffix}`,
            kind: "combat",
            participantMembershipMode: "explicit",
            participants: [
              {
                characterId,
                id: `s1136-source-${suffix}`,
                label: characterName,
                participantType: "scenario",
                scenarioParticipantId: sourceParticipant.participant.id,
              },
              {
                characterId: recipientCharacterId,
                id: `s1136-recipient-${suffix}`,
                label: recipientCharacterName,
                participantType: "scenario",
                scenarioParticipantId: recipientParticipant.participant.id,
              },
            ],
            scenarioId,
            status: "active",
            title: encounterTitle,
            updatedAt: now,
          },
        },
      )
    ).encounter.id;
    await setStatus(gmPage.request, encounterId, { status: "active" });

    // A real Item, passed from the player's Character to the recipient's through the real Item
    // action lifecycle, so the Activity row and its audience are production output.
    const itemName = `S1136 Lantern ${suffix}`;
    const itemState = await postJson<{
      state: { itemsById: Record<string, { displayName?: string; id: string }> };
    }>(gmPage.request, `/campaigns/${campaignId}/items`, {
      displayName: itemName,
      facts: { descriptiveTraits: [], unsupportedCapabilities: [] },
      holderCharacterId: characterId,
      templateId: "weapon-template-dagger",
    });
    const item = Object.values(itemState.state.itemsById).find(
      (candidate) => candidate.displayName === itemName,
    );
    expect(item).toBeTruthy();
    await postJson(
      gmPage.request,
      `/scenarios/${scenarioId}/participants/${sourceParticipant.participant.id}/reconcile-character-equipment`,
      {},
    );
    const optionsResponse = await playerContext.request.get(
      `${API_URL}/encounters/${encounterId}/combat-round/item-interactions/options`,
    );
    expect(optionsResponse.ok(), await optionsResponse.text()).toBe(true);
    const options = (await optionsResponse.json()) as {
      options: {
        actors: Array<{
          items: Array<{ id: string; revision: string }>;
          label: string;
          participantId: string;
        }>;
        recipients: Array<{ label: string; participantId: string }>;
      };
    };
    const sourceActor = options.options.actors.find(
      (candidate) => candidate.label === characterName,
    );
    const recipientEncounterParticipantId = options.options.recipients.find(
      (candidate) => candidate.label === recipientCharacterName,
    )?.participantId;
    expect(sourceActor?.items.map((candidate) => candidate.id)).toEqual([item!.id]);
    expect(recipientEncounterParticipantId).toBeTruthy();

    const actionId = `s1136-pass-${suffix}`;
    const resultText = `${itemName} changes hands at the ford.`;
    await postJson(
      playerContext.request,
      `/encounters/${encounterId}/combat-round/item-interactions`,
      {
        actionId,
        encounterId,
        expectedItemRevision: sourceActor!.items[0]!.revision,
        expectedRevision: await encounterRevision(playerContext.request, encounterId),
        itemId: item!.id,
        itemOperation: "pass",
        operation: "declare",
        participantId: sourceActor!.participantId,
        recipientParticipantId: recipientEncounterParticipantId,
      },
    );
    for (const operation of ["review", "activate", "resolve"] as const) {
      await postJson(gmPage.request, `/encounters/${encounterId}/combat-round/item-interactions`, {
        actionId,
        expectedRevision: await encounterRevision(gmPage.request, encounterId),
        operation,
        ...(operation === "resolve"
          ? {
              resultText,
              visibleToParticipantIds: [
                sourceActor!.participantId,
                recipientEncounterParticipantId!,
              ],
            }
          : {}),
      });
    }

    // Positive control while the Encounter is active: both players are shown the outcome.
    const expectedRow = expect.objectContaining({ encounterId, summary: resultText });
    const playerBefore = await loadSession(playerContext.request, scenarioId);
    const recipientBefore = await loadSession(recipientContext.request, scenarioId);
    expect(itemRows(playerBefore)).toEqual([expectedRow]);
    expect(itemRows(recipientBefore)).toEqual(itemRows(playerBefore));

    const playerOutcome = `The ford is held ${suffix}.`;
    await setStatus(gmPage.request, encounterId, { status: "paused" });
    await setStatus(gmPage.request, encounterId, { playerOutcome, status: "completed" });

    // The payload the pages render from: the closed Encounter's row, and the same past outcome.
    const closedRow = { id: encounterId, outcome: playerOutcome, status: "completed" };
    const gmAfter = await loadSession(gmPage.request, scenarioId);
    const playerAfter = await loadSession(playerContext.request, scenarioId);
    const recipientAfter = await loadSession(recipientContext.request, scenarioId);
    for (const session of [gmAfter, playerAfter, recipientAfter]) {
      expect(session.encounters).toEqual([expect.objectContaining(closedRow)]);
    }
    expect(itemRows(playerAfter)).toEqual(itemRows(playerBefore));
    expect(itemRows(recipientAfter)).toEqual(itemRows(recipientBefore));
    expect(itemRows(gmAfter)).toEqual([expectedRow]);

    // The rendered player Scenario page: the closed Encounter and the outcome in Activity.
    await playerPage.goto(`/campaigns/${campaignId}/scenarios/${scenarioId}/player`);
    const playerEncounters = playerPage.locator(
      'section[aria-labelledby="situation-encounters-heading"]',
    );
    await expect(playerEncounters).toContainText(encounterTitle);
    await expect(playerEncounters).toContainText("Combat · Closed");
    await expect(playerEncounters).toContainText(`Outcome: ${playerOutcome}`);
    await expect(
      playerPage.locator('section[aria-labelledby="situation-activity-heading"]'),
    ).toContainText(resultText);

    // The rendered GM Scenario page: the same Encounter row and the outcome in its history.
    await gmPage.goto(`/campaigns/${campaignId}/scenarios/${scenarioId}`);
    const gmEncounters = gmPage.locator('section[aria-labelledby="scenario-encounters-heading"]');
    await expect(gmEncounters).toContainText(encounterTitle);
    await expect(gmEncounters).toContainText("Combat · Closed");
    await expect(gmEncounters).toContainText(`Outcome: ${playerOutcome}`);
    await expect(
      gmPage.locator('section[aria-labelledby="scenario-history-heading"]'),
    ).toContainText(resultText);

    await playerContext.close();
    await recipientContext.close();
  });
});
