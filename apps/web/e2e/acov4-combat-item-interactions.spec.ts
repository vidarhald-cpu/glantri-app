import { expect, test, type APIRequestContext } from "@playwright/test";
import { createCharacterForE2e } from "./character-fixture";

const API_URL = process.env.PLAYWRIGHT_API_URL ?? "http://localhost:4000";

async function postJson<T>(
  request: APIRequestContext,
  endpoint: string,
  data: unknown,
): Promise<T> {
  const response = await request.post(`${API_URL}${endpoint}`, { data });
  expect(response.ok(), `${endpoint}: ${await response.text()}`).toBe(true);
  return (await response.json()) as T;
}

async function getEncounter(request: APIRequestContext, encounterId: string) {
  const response = await request.get(`${API_URL}/encounters/${encounterId}`);
  expect(response.ok()).toBe(true);
  return (await response.json()) as {
    encounter: {
      combatRoundState?: { genericActions?: Array<{ id: string; status: string }> };
      updatedAt: string;
    };
  };
}

async function gmCompleteItemAction(input: {
  actionId: string;
  encounterId: string;
  gmRequest: APIRequestContext;
  participantIds: string[];
  resultText: string;
}) {
  let current = await getEncounter(input.gmRequest, input.encounterId);
  for (const operation of ["review", "activate"] as const) {
    current = await postJson(
      input.gmRequest,
      `/encounters/${input.encounterId}/combat-round/item-interactions`,
      {
        actionId: input.actionId,
        expectedRevision: current.encounter.updatedAt,
        operation,
      },
    );
  }
  return postJson(
    input.gmRequest,
    `/encounters/${input.encounterId}/combat-round/item-interactions`,
    {
      actionId: input.actionId,
      expectedRevision: current.encounter.updatedAt,
      operation: "resolve",
      resultText: input.resultText,
      visibleToParticipantIds: input.participantIds,
    },
  );
}

test.describe("ACoV4 canonical Combat Item interactions", () => {
  test.use({ storageState: "e2e/.auth/gm.json" });

  test("passes, drops, and picks up one canonical Item across narrow and desktop views", async ({
    browser,
    page: gmPage,
  }) => {
    const suffix = Date.now();
    const playerContext = await browser.newContext({ storageState: "e2e/.auth/player.json" });
    const playerPage = await playerContext.newPage();
    const recipientContext = await browser.newContext({
      storageState: "e2e/.auth/non-holder.json",
    });
    const playerMe = (await (await playerContext.request.get(`${API_URL}/auth/me`)).json()) as {
      user: { id: string };
    };
    const recipientMe = (await (
      await recipientContext.request.get(`${API_URL}/auth/me`)
    ).json()) as { user: { id: string } };
    const characterId = `acov4-player-${suffix}`;
    const recipientCharacterId = `acov4-recipient-${suffix}`;
    await createCharacterForE2e({
      apiUrl: API_URL,
      id: characterId,
      name: "Smoke Character",
      request: playerContext.request,
    });
    await createCharacterForE2e({
      apiUrl: API_URL,
      id: recipientCharacterId,
      name: "Smoke Non-holder Character",
      request: recipientContext.request,
    });

    const campaign = await postJson<{ campaign: { id: string } }>(gmPage.request, "/campaigns", {
      name: `ACoV4 Item Combat ${suffix}`,
      status: "active",
    });
    const campaignId = campaign.campaign.id;
    for (const sourceId of [characterId, recipientCharacterId]) {
      await postJson(gmPage.request, `/campaigns/${campaignId}/roster`, {
        category: "pc",
        sourceId,
        sourceType: "character",
      });
    }
    const scenario = await postJson<{ scenario: { id: string } }>(
      gmPage.request,
      `/campaigns/${campaignId}/scenarios`,
      { name: `ACoV4 Item Scenario ${suffix}`, status: "live" },
    );
    const scenarioId = scenario.scenario.id;
    const sourceParticipant = await postJson<{ participant: { id: string } }>(
      gmPage.request,
      `/scenarios/${scenarioId}/participants/character`,
      { characterId, controlledByUserId: playerMe.user.id },
    );
    const recipientParticipant = await postJson<{ participant: { id: string } }>(
      gmPage.request,
      `/scenarios/${scenarioId}/participants/character`,
      { characterId: recipientCharacterId, controlledByUserId: recipientMe.user.id },
    );
    const now = new Date().toISOString();
    const encounterId = `acov4-item-encounter-${suffix}`;
    await postJson(gmPage.request, `/scenarios/${scenarioId}/encounters`, {
      session: {
        campaignId,
        createdAt: now,
        currentRound: 1,
        id: encounterId,
        kind: "combat",
        participants: [
          {
            characterId,
            id: `acov4-source-${suffix}`,
            label: "Smoke Character",
            participantType: "scenario",
            scenarioParticipantId: sourceParticipant.participant.id,
          },
          {
            characterId: recipientCharacterId,
            id: `acov4-recipient-${suffix}`,
            label: "Smoke Non-holder Character",
            participantType: "scenario",
            scenarioParticipantId: recipientParticipant.participant.id,
          },
        ],
        scenarioId,
        status: "active",
        title: `ACoV4 Item Encounter ${suffix}`,
        updatedAt: now,
      },
    });

    const itemName = `ACoV4 Silver Dagger ${suffix}`;
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

    const initialOptionsResponse = await playerContext.request.get(
      `${API_URL}/encounters/${encounterId}/combat-round/item-interactions/options`,
    );
    expect(initialOptionsResponse.ok()).toBe(true);
    const initialOptions = (await initialOptionsResponse.json()) as {
      options: {
        actors: Array<{ label: string; participantId: string }>;
        recipients: Array<{ label: string; participantId: string }>;
      };
    };
    const sourceEncounterParticipantId = initialOptions.options.actors.find(
      (candidate) => candidate.label === "Smoke Character",
    )?.participantId;
    const recipientEncounterParticipantId = initialOptions.options.recipients.find(
      (candidate) => candidate.label === "Smoke Non-holder Character",
    )?.participantId;
    expect(sourceEncounterParticipantId).toBeTruthy();
    expect(recipientEncounterParticipantId).toBeTruthy();

    await playerPage.setViewportSize({ height: 844, width: 390 });
    await playerPage.goto(`/campaigns/${campaignId}/scenarios/${scenarioId}/player/combat`);
    await expect(playerPage.getByRole("heading", { name: "Items in this Combat" })).toBeVisible();
    await expect(playerPage.getByText(itemName, { exact: true })).toBeVisible();
    await expect(playerPage.getByText("Held · On person", { exact: true })).toBeVisible();
    await playerPage
      .getByLabel(`Pass ${itemName} to`)
      .selectOption({ label: "Smoke Non-holder Character" });
    await playerPage.getByRole("button", { name: `${itemName}: Pass / give` }).click();
    await expect(playerPage.getByText("Waiting for GM review · GM decides")).toBeVisible();

    const declaredPass = await getEncounter(gmPage.request, encounterId);
    const passAction = declaredPass.encounter.combatRoundState?.genericActions?.find(
      (candidate) => candidate.status === "declared",
    );
    expect(passAction).toBeTruthy();
    await playerPage.reload();
    await expect(
      playerPage.getByLabel("Action and task history").locator("option:checked"),
    ).toContainText(`Pass / give ${itemName}`);

    await gmCompleteItemAction({
      actionId: passAction!.id,
      encounterId,
      gmRequest: gmPage.request,
      participantIds: [sourceEncounterParticipantId!, recipientEncounterParticipantId!],
      resultText: `${itemName} changes hands.`,
    });
    await gmPage.setViewportSize({ height: 900, width: 1280 });
    await gmPage.goto(
      `/campaigns/${campaignId}?tab=combat&scenarioId=${scenarioId}&encounterId=${encounterId}`,
    );
    await expect(gmPage.getByText("Result:", { exact: true }).locator("..")).toContainText(
      `${itemName} changes hands.`,
    );

    let optionsResponse = await recipientContext.request.get(
      `${API_URL}/encounters/${encounterId}/combat-round/item-interactions/options`,
    );
    expect(optionsResponse.ok()).toBe(true);
    let options = (await optionsResponse.json()) as {
      options: {
        actors: Array<{ items: Array<{ id: string; revision: string }>; participantId: string }>;
        presentItems: Array<{ id: string; revision: string }>;
      };
    };
    const recipientActor = options.options.actors.find(
      (candidate) => candidate.participantId === recipientEncounterParticipantId,
    );
    expect(recipientActor?.items.map((candidate) => candidate.id)).toEqual([item!.id]);

    const dropActionId = `acov4-drop-${suffix}`;
    let current = await getEncounter(recipientContext.request, encounterId);
    await postJson(
      recipientContext.request,
      `/encounters/${encounterId}/combat-round/item-interactions`,
      {
        actionId: dropActionId,
        encounterId,
        expectedItemRevision: recipientActor!.items[0]!.revision,
        expectedRevision: current.encounter.updatedAt,
        itemId: item!.id,
        itemOperation: "drop",
        operation: "declare",
        participantId: recipientEncounterParticipantId,
      },
    );
    await gmCompleteItemAction({
      actionId: dropActionId,
      encounterId,
      gmRequest: gmPage.request,
      participantIds: [sourceEncounterParticipantId!, recipientEncounterParticipantId!],
      resultText: `${itemName} is present and unheld.`,
    });

    optionsResponse = await playerContext.request.get(
      `${API_URL}/encounters/${encounterId}/combat-round/item-interactions/options`,
    );
    options = (await optionsResponse.json()) as typeof options;
    expect(options.options.presentItems.map((candidate) => candidate.id)).toEqual([item!.id]);
    const pickupActionId = `acov4-pickup-${suffix}`;
    current = await getEncounter(playerContext.request, encounterId);
    await postJson(
      playerContext.request,
      `/encounters/${encounterId}/combat-round/item-interactions`,
      {
        actionId: pickupActionId,
        expectedItemRevision: options.options.presentItems[0]!.revision,
        expectedRevision: current.encounter.updatedAt,
        itemId: item!.id,
        itemOperation: "pickup",
        operation: "declare",
        participantId: sourceEncounterParticipantId,
      },
    );
    await gmCompleteItemAction({
      actionId: pickupActionId,
      encounterId,
      gmRequest: gmPage.request,
      participantIds: [sourceEncounterParticipantId!, recipientEncounterParticipantId!],
      resultText: `${itemName} is picked up again.`,
    });

    const canonical = (await (
      await gmPage.request.get(`${API_URL}/campaigns/${campaignId}/items`)
    ).json()) as {
      state: { itemsById: Record<string, { holderCharacterId: string; id: string }> };
    };
    expect(
      Object.values(canonical.state.itemsById).filter((candidate) => candidate.id === item!.id),
    ).toEqual([expect.objectContaining({ holderCharacterId: characterId, id: item!.id })]);
    await playerPage.reload();
    await expect(playerPage.getByText("Result:", { exact: true }).locator("..")).toContainText(
      `${itemName} is picked up again.`,
    );

    await playerContext.close();
    await recipientContext.close();
  });
});
