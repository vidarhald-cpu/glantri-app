import { expect, test, type APIRequestContext, type Page } from "@playwright/test";
import { createCharacterForE2e } from "./character-fixture";
import { API_URL } from "./targets";

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
      combatRoundState?: {
        genericActions?: Array<{
          duration: { kind: string };
          id: string;
          itemInteraction?: {
            itemLabel: string;
            operation: string;
            recipientParticipantId?: string;
          };
          resolution?: { text: string };
          status: string;
        }>;
      };
      updatedAt: string;
    };
  };
}

/**
 * A3, Forgejo issue #335 — Combat Panel Contract §12.15, P8 of the parity matrix.
 *
 * `GenericCombatActionPanel` is retired, so the Item facts this spec used to read off its render
 * inside Combat are asserted on the payloads their surviving surfaces consume instead. That is the
 * demonstrated equivalent P8 allows, and the payload-not-DOM rule the matrix carries from #271.
 *
 * - Encounter Item presence, label and audience: `GET /encounters/:encounterId/items`, the payload
 *   `EncounterItemsPanel` reads on its surviving render outside Combat
 *   (`RoleplayEncounterScreens.tsx`), which is M8's relocated access.
 * - An Item action's declared status and its GM-authored resolution text: the viewer's own
 *   `GET /encounters/:encounterId` projection, which is what every Combat surface renders from.
 */
async function getEncounterItems(request: APIRequestContext, encounterId: string) {
  const response = await request.get(`${API_URL}/encounters/${encounterId}/items`);
  expect(response.ok(), await response.text()).toBe(true);
  return (await response.json()) as {
    items: Array<{ itemId: string; label: string; visibility: "players" | "gm_only" }>;
  };
}

async function getItemAction(
  request: APIRequestContext,
  encounterId: string,
  actionId: string,
): Promise<
  NonNullable<
    NonNullable<
      Awaited<ReturnType<typeof getEncounter>>["encounter"]["combatRoundState"]
    >["genericActions"]
  >[number]
> {
  const { encounter } = await getEncounter(request, encounterId);
  const action = encounter.combatRoundState?.genericActions?.find(
    (candidate) => candidate.id === actionId,
  );
  expect(
    action,
    `Item action ${actionId} is absent from the payload this viewer is served`,
  ).toBeTruthy();
  return action!;
}

/**
 * Forgejo issue #834 — the persistent `Items in this Combat` block is removed from the Combat
 * declaration/inspector UI for Alpha, on both the GM and player surfaces, with no replacement
 * surface. This asserts the removal positively: the block's heading, its accessible name, each
 * of its three resolved-state lines, and its per-Item operation buttons are all absent.
 *
 * A caller pairs this with a positive control for the surface the block used to render inside —
 * otherwise an unrendered page would satisfy every absence here.
 */
async function expectNoCombatItemBlock(page: Page): Promise<void> {
  await expect(page.getByRole("heading", { name: "Items in this Combat" })).toHaveCount(0);
  await expect(page.getByLabel("Items in this Combat")).toHaveCount(0);
  for (const line of [
    "No available Items.",
    "No supported Items for this participant.",
    "Loading Items\u2026",
    "Items unavailable.",
  ]) {
    await expect(page.getByText(line, { exact: true })).toHaveCount(0);
  }
  await expect(
    page.getByRole("button", {
      name: /: (Draw \/ ready|Drop|Pass \/ give|Pick up|Stow \/ unequip|Use \/ interact)$/,
    }),
  ).toHaveCount(0);
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
    const characterName = `ACoV4 Source ${suffix}`;
    const recipientCharacterName = `ACoV4 Recipient ${suffix}`;
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
    const requestedEncounterId = `acov4-item-encounter-${suffix}`;
    const createdEncounter = await postJson<{
      encounter: { id: string; updatedAt: string };
    }>(gmPage.request, `/scenarios/${scenarioId}/encounters`, {
      session: {
        campaignId,
        createdAt: now,
        currentRound: 1,
        id: requestedEncounterId,
        kind: "combat",
        participantMembershipMode: "explicit",
        participants: [
          {
            characterId,
            id: `acov4-source-${suffix}`,
            label: characterName,
            participantType: "scenario",
            scenarioParticipantId: sourceParticipant.participant.id,
          },
          {
            characterId: recipientCharacterId,
            id: `acov4-recipient-${suffix}`,
            label: recipientCharacterName,
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
    const encounterId = createdEncounter.encounter.id;
    const refreshedEncounter = (await (
      await gmPage.request.get(`${API_URL}/encounters/${encounterId}`)
    ).json()) as { encounter: { updatedAt: string } };
    const startEncounterResponse = await gmPage.request.patch(
      `${API_URL}/encounters/${encounterId}/status`,
      {
        data: {
          expectedRevision: refreshedEncounter.encounter.updatedAt,
          status: "active",
        },
      },
    );
    expect(startEncounterResponse.ok(), await startEncounterResponse.text()).toBe(true);

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
    await postJson(
      gmPage.request,
      `/scenarios/${scenarioId}/participants/${sourceParticipant.participant.id}/reconcile-character-equipment`,
      {},
    );

    const initialOptionsResponse = await playerContext.request.get(
      `${API_URL}/encounters/${encounterId}/combat-round/item-interactions/options`,
    );
    const initialOptionsText = await initialOptionsResponse.text();
    expect(initialOptionsResponse.ok(), initialOptionsText).toBe(true);
    const initialOptions = JSON.parse(initialOptionsText) as {
      options: {
        actors: Array<{
          items: Array<{ id: string; revision: string }>;
          label: string;
          participantId: string;
        }>;
        recipients: Array<{ label: string; participantId: string }>;
      };
    };
    const sourceActor = initialOptions.options.actors.find(
      (candidate) => candidate.label === characterName,
    );
    const sourceEncounterParticipantId = sourceActor?.participantId;
    const recipientEncounterParticipantId = initialOptions.options.recipients.find(
      (candidate) => candidate.label === recipientCharacterName,
    )?.participantId;
    expect(sourceEncounterParticipantId).toBeTruthy();
    expect(recipientEncounterParticipantId).toBeTruthy();
    expect(sourceActor?.items.map((candidate) => candidate.id)).toEqual([item!.id]);

    await playerPage.setViewportSize({ height: 844, width: 390 });
    await playerPage.goto(`/characters/${characterId}/equipment`);
    await expect(
      playerPage.getByRole("heading", { name: `Inventory by location - ${characterName}` }),
    ).toBeVisible();
    await expect(playerPage.getByText("On person", { exact: true })).toBeVisible();
    await expect(playerPage.locator(`input[value="${itemName}"]`)).toBeVisible();

    await playerPage.goto(`/campaigns/${campaignId}/scenarios/${scenarioId}/player/combat`);
    // Forgejo issue #834 — the persistent `Items in this Combat` block is removed from the player
    // Combat surface for Alpha, with no replacement surface. The Action Selector is asserted
    // first as a positive control: the block used to render inside it, so its presence is what
    // makes the absence below a real measurement rather than a vacuous one on an unrendered page.
    await expect(playerPage.getByText(/^Action selector/)).toBeVisible();
    await expect(playerPage.getByRole("heading", { name: "Items in this Combat" })).toHaveCount(0);
    await expect(playerPage.getByLabel("Items in this Combat")).toHaveCount(0);
    // No replacement Item surface appeared in its place: every string and control the removed
    // block owned is absent. (A broad `/Item/` heading match is not used — the surviving
    // Equipment and Combat Log surfaces legitimately name Items.)
    await expectNoCombatItemBlock(playerPage);
    // A3, Forgejo issue #335 — no Combat surface embeds Encounter Item presence any more, and no
    // "Actions and tasks" panel is rendered. Presence itself is asserted on the payload.
    await expect(playerPage.getByRole("heading", { name: "Encounter Items" })).toHaveCount(0);
    await expect(playerPage.getByRole("heading", { name: "Actions and tasks" })).toHaveCount(0);
    await expect(playerPage.getByRole("heading", { name: "Items and task history" })).toHaveCount(
      0,
    );
    expect((await getEncounterItems(playerContext.request, encounterId)).items).toEqual([]);

    const passActionId = `acov4-pass-${suffix}`;
    let current = await getEncounter(playerContext.request, encounterId);
    await postJson(
      playerContext.request,
      `/encounters/${encounterId}/combat-round/item-interactions`,
      {
        actionId: passActionId,
        encounterId,
        expectedItemRevision: sourceActor!.items[0]!.revision,
        expectedRevision: current.encounter.updatedAt,
        itemId: item!.id,
        itemOperation: "pass",
        operation: "declare",
        participantId: sourceEncounterParticipantId,
        recipientParticipantId: recipientEncounterParticipantId,
      },
    );
    // A3 — the declared Item action and its pending review are asserted on the payload the viewer
    // is served rather than on the retired panel's status line and history selector.
    expect(await getItemAction(playerContext.request, encounterId, passActionId)).toMatchObject({
      duration: { kind: "gm_decided" },
      itemInteraction: {
        itemLabel: itemName,
        operation: "pass",
        recipientParticipantId: recipientEncounterParticipantId,
      },
      status: "declared",
    });

    const declaredPass = await getEncounter(gmPage.request, encounterId);
    const passAction = declaredPass.encounter.combatRoundState?.genericActions?.find(
      (candidate) => candidate.id === passActionId && candidate.status === "declared",
    );
    expect(passAction).toBeTruthy();

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
    // A3 — the GM's Combat Inspector renders no "Actions and tasks" panel, and the resolution the
    // GM authored is read from the payload the Inspector itself renders from.
    await expect(gmPage.getByRole("heading", { name: "Actions and tasks" })).toHaveCount(0);
    // Forgejo issue #834 — the GM surface's own absence proof is **not** taken here. At this
    // point Round 1 still sits on its Combat Experience check, so the Inspector renders no
    // Action Selector and the removed block would not have rendered at the baseline either: an
    // absence asserted here would measure nothing. It is taken at the end of this test instead,
    // once the Inspector can be driven to a selected participant with the Action Selector up.
    expect(
      (await getItemAction(gmPage.request, encounterId, passAction!.id)).resolution?.text,
    ).toContain(`${itemName} changes hands.`);

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
    current = await getEncounter(recipientContext.request, encounterId);
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
    await playerPage.reload();
    // A3 — the dropped Item's Encounter presence and its player-visible audience, read from the
    // payload `EncounterItemsPanel` consumes on its surviving surface outside Combat rather than
    // from a Combat render that no longer exists.
    //
    // Forgejo issue #834 — the Item is no longer named anywhere on the player's Combat surface:
    // the block that named it is gone and nothing replaced it. The reload itself is the positive
    // control for the page having re-rendered with the dropped Item present in the projection,
    // which the `presentItems` payload assertion below reads.
    await expect(playerPage.getByText(/^Action selector/)).toBeVisible();
    await expectNoCombatItemBlock(playerPage);
    // The Item name may still legitimately appear in the Combat Log's accepted `item_resolution`
    // outcome, so the absence asserted here is the block and its controls, not the Item's name.
    await expect(playerPage.getByRole("heading", { name: "Encounter Items" })).toHaveCount(0);
    await gmPage.reload();
    await expect(gmPage.getByRole("heading", { name: "Encounter Items" })).toHaveCount(0);
    expect((await getEncounterItems(playerContext.request, encounterId)).items).toEqual([
      expect.objectContaining({ itemId: item!.id, label: itemName }),
    ]);
    expect((await getEncounterItems(gmPage.request, encounterId)).items).toEqual([
      expect.objectContaining({ itemId: item!.id, label: itemName, visibility: "players" }),
    ]);

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
    // A3 — the resolution the player is entitled to, and the Item's Encounter presence, both read
    // from the payloads their surviving surfaces consume.
    expect(
      (await getItemAction(playerContext.request, encounterId, pickupActionId)).resolution?.text,
    ).toContain(`${itemName} is picked up again.`);
    expect((await getEncounterItems(playerContext.request, encounterId)).items).toEqual([]);
    await playerPage.goto(`/characters/${characterId}/equipment`);
    await expect(playerPage.getByText("On person", { exact: true })).toBeVisible();
    await expect(playerPage.locator(`input[value="${itemName}"]`)).toBeVisible();

    // ---- Forgejo issue #834: the GM Combat Inspector renders no Items block. ----
    //
    // On the GM surface the removed block was mounted by the Inspector's Action Selector, under
    // `inspector.participant && !inspectorIsHistorical`. With no participant selected the
    // Inspector falls back to its phase-wide branch, which renders no Action Selector and would
    // not have rendered the block at the baseline either — so a participant is selected first,
    // by clicking this combatant's own enabled tracker cell, exactly as a GM would.
    await gmPage.goto(
      `/campaigns/${campaignId}?tab=combat&scenarioId=${scenarioId}&encounterId=${encounterId}`,
    );
    await expect(gmPage.getByRole("heading", { name: "Combat Round Manager" })).toBeVisible();
    await gmPage
      .locator('[aria-label="Combat round timeline grid"] tbody tr')
      .filter({ hasText: characterName })
      .locator("button:not([disabled])")
      .first()
      .click();
    const inspectorHeading = gmPage.getByRole("heading", { name: /^Combat inspector — / });
    await expect(inspectorHeading).toContainText(characterName);
    // Positive controls: the Inspector holds a selected scenario participant and renders the
    // Action Selector — the exact branch that embedded `Items in this Combat` on the GM surface.
    // Without these two the absences below would pass on a page that renders no selector at all.
    await expect(gmPage.getByText(/^Action selector/).first()).toBeVisible();
    await expect(gmPage.getByRole("combobox", { name: "Secondary action" }).first()).toBeVisible();
    // And the block, with every string and control it owned, is absent; nothing replaced it.
    await expectNoCombatItemBlock(gmPage);

    await playerContext.close();
    await recipientContext.close();
  });
});
