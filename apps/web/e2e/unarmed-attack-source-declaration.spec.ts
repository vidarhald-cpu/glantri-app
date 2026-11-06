import { expect, test, type APIRequestContext, type Page } from "@playwright/test";
import {
  initializeCombatRoundState,
  rollCombatRoundCombatExperience,
  setCombatRoundCombatExperienceDifficulty,
  type CombatRoundState,
  type EncounterSession,
} from "@glantri/domain";

import { characterPayload } from "./character-fixture";
import { API_URL } from "./targets";

/**
 * #590 — Punch and Kick are intrinsic combat attack sources and must be declarable without
 * equipment, through the existing Brawling competency and their existing authored stats.
 *
 * This is the rendered/executed evidence on a running stack. It also proves the authored catalogue
 * field reaches the served bundle and the rendered option list, not only the source file: a
 * snapshot persists the rest of the catalogue, so a source edit alone would prove nothing.
 */

const PUNCH_SOURCE_ID = "unarmed:virtual-weapon-template-punch";
const KICK_SOURCE_ID = "unarmed:virtual-weapon-template-kick";

async function json<T>(response: Awaited<ReturnType<APIRequestContext["get"]>>): Promise<T> {
  if (!response.ok()) {
    throw new Error(`${response.status()} ${await response.text()}`);
  }
  return response.json() as Promise<T>;
}

async function post<T>(
  request: APIRequestContext,
  endpoint: string,
  data: unknown = {},
): Promise<T> {
  return json<T>(await request.post(`${API_URL}${endpoint}`, { data }));
}

/** A character with a Brawling rank, so unarmed resolution has a competency to resolve through. */
function brawlerPayload(id: string, name: string) {
  const payload = characterPayload(id, name);
  return {
    build: {
      ...payload.build,
      progression: {
        ...payload.build.progression,
        secondaryPoolTotal: 60,
        skills: [
          {
            category: "secondary",
            categoryId: "combat",
            groupId: "basic_melee_training",
            secondaryRanks: 9,
            skillId: "brawling",
          },
        ],
      },
    },
  };
}

async function readDeclaration(input: {
  encounterId: string;
  participantId: string;
  request: APIRequestContext;
}) {
  const { encounter } = await json<{ encounter: { combatRoundState: CombatRoundState } }>(
    await input.request.get(`${API_URL}/encounters/${input.encounterId}`),
  );
  return encounter.combatRoundState.participants.find(
    (participant) => participant.participantId === input.participantId,
  )?.declaration;
}

/**
 * Picks an attack source from the rendered control, after proving both brawling rows are offered
 * as explicit labelled options and that nothing unarmed was selected on the actor's behalf.
 */
async function chooseUnarmedAttackSource(input: { page: Page; value: string }): Promise<void> {
  const selector = input.page.getByRole("combobox", { name: "Attack source" }).first();
  await expect(selector).toBeVisible();
  await expect(selector.locator(`option[value="${PUNCH_SOURCE_ID}"]`)).toHaveText(
    "Punch · Unarmed",
  );
  await expect(selector.locator(`option[value="${KICK_SOURCE_ID}"]`)).toHaveText("Kick · Unarmed");
  await expect(selector).toHaveValue("");
  await selector.selectOption(input.value);
  await expect(selector).toHaveValue(input.value);
}

/**
 * Reads the rendered attack stats row (I, OB, DMB, AM, MC — `Range` was removed from this
 * mini-table by Forgejo issue #771 R2-9). Criterion 3: the OB must be a
 * real number derived through the mode's Brawling competency, never `COMBAT_COMPETENCY_REFUSED`.
 *
 * The cell indices were **re-measured** after #771 moved the attack source and mode controls into
 * the mini-table's source/name cell: that cell is a sibling of the `<table>`, not a `<td>`, so the
 * `<td>` positions below are unchanged.
 */
async function readRenderedAttackStats(page: Page): Promise<string[]> {
  const row = page.locator("table").filter({ hasText: "OB" }).first().locator("tbody tr").first();
  await expect(row).toBeVisible();
  return row.locator("td").allInnerTexts();
}

/**
 * Forgejo #987. `/^Combat inspector — /` also matches `CombatRoundManagerPanel`'s phase-wide
 * heading — `Combat inspector — Round {n} · {step}`, naming no participant — which is the state
 * this precondition exists to exclude. The `Next participant` button it then clicks is rendered
 * only inside the participant arm and never carries `disabled`, so an absent control used to be
 * waited out to the test timeout instead of reported. The matcher now requires the
 * ` · Round <n> · ` that only follows a label, and every read and click carries its own timeout.
 */
const GM_INSPECTOR_PARTICIPANT_HEADING = /^Combat inspector — .+ · Round \d+ · /;
const GM_INSPECTOR_CONTROL_TIMEOUT_MS = 5_000;
/** The panel can take a beat to mount after a `goto`; its controls cannot. */
const GM_INSPECTOR_MOUNT_TIMEOUT_MS = 15_000;

async function selectGmInspectorParticipant(input: { label: string; page: Page }): Promise<void> {
  const heading = input.page.getByRole("heading", { name: GM_INSPECTOR_PARTICIPANT_HEADING });
  await expect(
    heading,
    "the GM inspector is on a participant, not on its phase-wide row",
  ).toBeVisible({ timeout: GM_INSPECTOR_MOUNT_TIMEOUT_MS });
  for (let attempt = 0; attempt < 8; attempt += 1) {
    if (
      (await heading.innerText({ timeout: GM_INSPECTOR_CONTROL_TIMEOUT_MS })).includes(input.label)
    ) {
      return;
    }
    await input.page
      .getByRole("button", { name: "Next participant" })
      .click({ timeout: GM_INSPECTOR_CONTROL_TIMEOUT_MS });
  }
  throw new Error(`The GM inspector never reached ${input.label}.`);
}

async function declare(input: { page: Page }): Promise<Record<string, unknown>> {
  const sent: Array<Record<string, unknown>> = [];
  const listener = (request: {
    method: () => string;
    postDataJSON: () => unknown;
    url: () => string;
  }) => {
    if (request.method() === "POST" && request.url().includes("/combat-declaration")) {
      sent.push(request.postDataJSON() as Record<string, unknown>);
    }
  };
  input.page.on("request", listener);
  const responsePromise = input.page.waitForResponse(
    (response) =>
      response.request().method() === "POST" && response.url().includes("/combat-declaration"),
  );
  await input.page.getByRole("button", { name: "Declare action" }).first().click();
  const response = await responsePromise;
  expect(response.ok(), await response.text()).toBe(true);
  input.page.off("request", listener);
  expect(sent).toHaveLength(1);
  return sent[0]!;
}

test.describe("Declarable intrinsic unarmed attack sources (#590)", () => {
  test.use({ storageState: "e2e/.auth/gm.json" });

  test("lets a player and a GM each explicitly declare Punch or Kick with no Item instance", async ({
    browser,
    page: gmPage,
  }) => {
    test.setTimeout(240_000);
    const suffix = Date.now();
    const playerContext = await browser.newContext({ storageState: "e2e/.auth/player.json" });
    const proxyContext = await browser.newContext({ storageState: "e2e/.auth/non-holder.json" });
    const armedContext = await browser.newContext({ storageState: "e2e/.auth/unrelated.json" });
    const playerUser = await json<{ user: { id: string } }>(
      await playerContext.request.get(`${API_URL}/auth/me`),
    );
    const proxyUser = await json<{ user: { id: string } }>(
      await proxyContext.request.get(`${API_URL}/auth/me`),
    );
    const armedUser = await json<{ user: { id: string } }>(
      await armedContext.request.get(`${API_URL}/auth/me`),
    );

    // Two unequipped brawlers: the player declares for their own, the GM proxies the other, so
    // neither half can mask the other. One player may hold only one active character per scenario,
    // so the proxied character belongs to a second account.
    const playerCharacter = {
      context: playerContext,
      id: `unarmed-player-${suffix}`,
      name: `Unarmed Player ${suffix}`,
      userId: playerUser.user.id,
    };
    const proxyCharacter = {
      context: proxyContext,
      id: `unarmed-proxy-${suffix}`,
      name: `Unarmed Proxy ${suffix}`,
      userId: proxyUser.user.id,
    };
    // A third brawler with a ready dagger, for criterion 4: normal melee declaration must be
    // untouched by Punch and Kick becoming offerable, and must stay what is preselected.
    const armedCharacter = {
      context: armedContext,
      id: `unarmed-armed-${suffix}`,
      name: `Armed Brawler ${suffix}`,
      userId: armedUser.user.id,
    };
    const characters = [playerCharacter, proxyCharacter, armedCharacter];
    let daggerItemId = "";
    for (const character of characters) {
      const created = await character.context.request.post(`${API_URL}/characters`, {
        data: brawlerPayload(character.id, character.name),
      });
      expect(created.ok(), await created.text()).toBe(true);
      const equipment = await json<{ state: { revision: number } }>(
        await character.context.request.get(`${API_URL}/characters/${character.id}/equipment`),
      );
      if (character !== armedCharacter) {
        // No ready weapon: the state #586 reported as unable to declare an attack at all.
        await post(
          character.context.request,
          `/characters/${character.id}/equipment/loadout/active-primary-weapon`,
          { expectedRevision: equipment.state.revision, itemId: null },
        );
        continue;
      }
      const withItem = await post<{
        state: { itemsById: Record<string, { id: string; templateId?: string }>; revision: number };
      }>(armedContext.request, `/characters/${character.id}/equipment/items`, {
        expectedRevision: equipment.state.revision,
        initialCarryMode: "equipped",
        initialLocationId: `${character.id}:loc-equipped`,
        quantity: 1,
        templateId: "weapon-template-dagger",
      });
      daggerItemId =
        Object.values(withItem.state.itemsById).find(
          (item) => item.templateId === "weapon-template-dagger",
        )?.id ?? "";
      expect(daggerItemId).not.toBe("");
      await post(
        armedContext.request,
        `/characters/${character.id}/equipment/loadout/active-primary-weapon`,
        { expectedRevision: withItem.state.revision, itemId: daggerItemId },
      );
    }

    const campaign = await post<{ campaign: { id: string } }>(gmPage.request, "/campaigns", {
      name: `Issue 590 Unarmed ${suffix}`,
      status: "active",
    });
    const campaignId = campaign.campaign.id;
    for (const character of characters) {
      await post(gmPage.request, `/campaigns/${campaignId}/roster`, {
        category: "pc",
        sourceId: character.id,
        sourceType: "character",
      });
    }
    const scenario = await post<{ scenario: { id: string } }>(
      gmPage.request,
      `/campaigns/${campaignId}/scenarios`,
      { name: `Issue 590 Scenario ${suffix}`, status: "live" },
    );
    const scenarioId = scenario.scenario.id;
    const participantIdByCharacterId: Record<string, string> = {};
    for (const character of characters) {
      const participant = await post<{ participant: { id: string } }>(
        gmPage.request,
        `/scenarios/${scenarioId}/participants/character`,
        { characterId: character.id, controlledByUserId: character.userId },
      );
      participantIdByCharacterId[character.id] = participant.participant.id;
      await post(
        gmPage.request,
        `/scenarios/${scenarioId}/participants/${participant.participant.id}/refresh-character-equipment`,
      );
    }
    const targetName = `Unarmed target ${suffix}`;
    const target = await post<{ participant: { id: string } }>(
      gmPage.request,
      `/scenarios/${scenarioId}/participants/entity`,
      {
        entityInput: { kind: "npc", name: targetName, snapshot: { displayName: targetName } },
        role: "enemy",
      },
    );

    const now = new Date().toISOString();
    const playerCombatantId = `issue-590-player-${suffix}`;
    const proxyCombatantId = `issue-590-proxy-${suffix}`;
    const armedCombatantId = `issue-590-armed-${suffix}`;
    const targetCombatantId = `issue-590-target-${suffix}`;
    const created = await post<{ encounter: EncounterSession }>(
      gmPage.request,
      `/scenarios/${scenarioId}/encounters`,
      {
        session: {
          campaignId,
          createdAt: now,
          currentRound: 1,
          id: `issue-590-encounter-${suffix}`,
          kind: "combat",
          participantMembershipMode: "explicit",
          participants: [
            {
              characterId: playerCharacter.id,
              id: playerCombatantId,
              label: playerCharacter.name,
              participantType: "scenario",
              scenarioParticipantId: participantIdByCharacterId[playerCharacter.id],
            },
            {
              characterId: proxyCharacter.id,
              id: proxyCombatantId,
              label: proxyCharacter.name,
              participantType: "scenario",
              scenarioParticipantId: participantIdByCharacterId[proxyCharacter.id],
            },
            {
              characterId: armedCharacter.id,
              id: armedCombatantId,
              label: armedCharacter.name,
              participantType: "scenario",
              scenarioParticipantId: participantIdByCharacterId[armedCharacter.id],
            },
            {
              id: targetCombatantId,
              label: targetName,
              participantType: "scenario",
              scenarioParticipantId: target.participant.id,
            },
          ],
          scenarioId,
          status: "active",
          title: `Issue 590 Combat ${suffix}`,
          updatedAt: now,
        },
      },
    );
    const encounterId = created.encounter.id;
    const refreshed = await json<{ encounter: EncounterSession }>(
      await gmPage.request.get(`${API_URL}/encounters/${encounterId}`),
    );
    const activated = await gmPage.request.patch(`${API_URL}/encounters/${encounterId}/status`, {
      data: { expectedRevision: refreshed.encounter.updatedAt, status: "active" },
    });
    expect(activated.ok(), await activated.text()).toBe(true);

    const activeEncounter = await json<{ encounter: EncounterSession }>(
      await gmPage.request.get(`${API_URL}/encounters/${encounterId}`),
    );
    // Round 1 always opens with a Combat Experience check, which gates the declaration controls.
    // Resolving it is scaffolding, exactly as the GM panel's own component fixture does it.
    const combatRoundState = [
      playerCombatantId,
      proxyCombatantId,
      armedCombatantId,
      targetCombatantId,
    ].reduce(
      (state, participantId, index) =>
        rollCombatRoundCombatExperience({
          command: { createdAt: new Date(Date.now() + index).toISOString() },
          participantId,
          rng: () => 0.6,
          skillTotal: 26,
          state,
        }).state,
      setCombatRoundCombatExperienceDifficulty({
        difficulty: 26,
        state: initializeCombatRoundState({ encounter: activeEncounter.encounter }),
      }),
    );
    expect(combatRoundState.currentStep).toBe("select_actions");
    const stateUpdate = await gmPage.request.put(`${API_URL}/encounters/${encounterId}`, {
      data: {
        expectedRevision: activeEncounter.encounter.updatedAt,
        session: {
          ...activeEncounter.encounter,
          combatRoundState,
          currentRound: 1,
          status: "active",
        },
      },
    });
    expect(stateUpdate.ok(), await stateUpdate.text()).toBe(true);

    // ---- Criterion 1: a player explicitly chooses Punch and attacks with it. ----
    const playerPage = await playerContext.newPage();
    await playerPage.goto(`/campaigns/${campaignId}/scenarios/${scenarioId}/player/combat`);
    const playerAction = playerPage.getByRole("combobox", { name: "Action" }).first();
    await expect(playerAction).toBeVisible();
    await playerAction.selectOption("attack_parry");
    await chooseUnarmedAttackSource({ page: playerPage, value: PUNCH_SOURCE_ID });
    // Criterion 3, rendered: the stats this declaration will use name Punch and resolve through
    // its authored Brawling competency, so the OB is a number rather than a refusal.
    //
    // The source is read from the mini-table's own source/name cell, where #771 put the selector.
    // A bare `getByText("Punch")` would also match the equipment panel's Weapons table further
    // down the page, and would therefore keep passing even if the mini-table named nothing.
    await expect(playerPage.getByRole("combobox", { name: "Attack source" }).first()).toHaveValue(
      PUNCH_SOURCE_ID,
    );
    const punchStats = await readRenderedAttackStats(playerPage);
    expect(punchStats.join(" | ")).not.toContain("Refused");
    expect(punchStats[1]).toMatch(/^\d+$/);
    expect(Number(punchStats[1])).toBeGreaterThan(0);
    await expect(playerPage.getByText(/Refused: no competency reference/)).toHaveCount(0);
    await playerPage
      .getByRole("combobox", { name: "Target" })
      .first()
      .selectOption({ label: targetName });

    const playerSent = await declare({ page: playerPage });
    const playerSentSources = playerSent["phaseAttackSources"] as Record<
      string,
      Record<string, unknown>
    >;
    expect(playerSentSources.phase1).toMatchObject({
      slot: "virtual",
      sourceKind: "unarmed",
      templateId: "virtual-weapon-template-punch",
    });
    // Criterion 5: no Item instance is required, requested or sent.
    expect(playerSentSources.phase1).not.toHaveProperty("scenarioItemId");

    const playerDeclaration = await readDeclaration({
      encounterId,
      participantId: playerCombatantId,
      request: gmPage.request,
    });
    expect(playerDeclaration?.actionId).toBe("attack_parry");
    expect(playerDeclaration?.submittedBy).toBe("player");
    // Persisted: the server committed a real Punch attack opportunity from the explicit choice,
    // and it names no Item instance.
    const playerOpportunity = playerDeclaration?.attackOpportunities?.find(
      (opportunity) => opportunity.phase === "phase1",
    );
    expect(playerOpportunity).toMatchObject({
      sourceKind: "unarmed",
      status: "committed",
      targetParticipantId: targetCombatantId,
      weaponSourceId: PUNCH_SOURCE_ID,
      weaponSourceSlot: "virtual",
      weaponTemplateId: "virtual-weapon-template-punch",
    });
    expect(playerOpportunity?.itemId).toBeUndefined();
    expect(playerOpportunity?.weaponInstanceId).toBeUndefined();
    await playerPage.close();

    // ---- Criterion 2: a GM/proxy explicitly chooses Kick and attacks with it. ----
    await gmPage.goto(
      `/campaigns/${campaignId}?scenarioId=${scenarioId}&encounterId=${encounterId}&tab=combat`,
    );
    await selectGmInspectorParticipant({ label: proxyCharacter.name, page: gmPage });
    const gmAction = gmPage.getByRole("combobox", { name: "Action" }).first();
    await expect(gmAction).toBeVisible();
    await gmAction.selectOption("attack_parry");
    await chooseUnarmedAttackSource({ page: gmPage, value: KICK_SOURCE_ID });
    await gmPage
      .getByRole("combobox", { name: "Target" })
      .first()
      .selectOption({ label: targetName });

    const gmSent = await declare({ page: gmPage });
    const gmSentSources = gmSent["phaseAttackSources"] as Record<string, Record<string, unknown>>;
    expect(gmSentSources.phase1).toMatchObject({
      slot: "virtual",
      sourceKind: "unarmed",
      templateId: "virtual-weapon-template-kick",
    });
    expect(gmSentSources.phase1).not.toHaveProperty("scenarioItemId");

    const gmDeclaration = await readDeclaration({
      encounterId,
      participantId: proxyCombatantId,
      request: gmPage.request,
    });
    expect(gmDeclaration?.submittedBy).toBe("gm");
    const gmOpportunity = gmDeclaration?.attackOpportunities?.find(
      (opportunity) => opportunity.phase === "phase1",
    );
    expect(gmOpportunity).toMatchObject({
      sourceKind: "unarmed",
      status: "committed",
      targetParticipantId: targetCombatantId,
      weaponSourceId: KICK_SOURCE_ID,
      weaponSourceSlot: "virtual",
      weaponTemplateId: "virtual-weapon-template-kick",
    });
    expect(gmOpportunity?.itemId).toBeUndefined();
    expect(gmOpportunity?.weaponInstanceId).toBeUndefined();

    // ---- Criterion 4: normal melee resolution is unchanged, and never implicitly unarmed. ----
    await selectGmInspectorParticipant({ label: armedCharacter.name, page: gmPage });
    await gmPage.getByRole("combobox", { name: "Action" }).first().selectOption("attack_parry");
    const armedSourceSelector = gmPage.getByRole("combobox", { name: "Attack source" }).first();
    await expect(armedSourceSelector).toBeVisible();
    // The ready weapon is still offered and still preselected, with Punch and Kick beside it as
    // choices the GM has to make deliberately.
    await expect(armedSourceSelector).toHaveValue(`weapon:${daggerItemId}`);
    await expect(armedSourceSelector.locator(`option[value="${PUNCH_SOURCE_ID}"]`)).toHaveText(
      "Punch · Unarmed",
    );
    await expect(armedSourceSelector.locator(`option[value="${KICK_SOURCE_ID}"]`)).toHaveText(
      "Kick · Unarmed",
    );
    await gmPage
      .getByRole("combobox", { name: "Target" })
      .first()
      .selectOption({ label: targetName });

    const armedSent = await declare({ page: gmPage });
    const armedSentSources = armedSent["phaseAttackSources"] as Record<
      string,
      Record<string, unknown>
    >;
    expect(armedSentSources.phase1).toMatchObject({
      scenarioItemId: daggerItemId,
      slot: "primary",
      sourceKind: "weapon",
      templateId: "weapon-template-dagger",
    });

    const armedDeclaration = await readDeclaration({
      encounterId,
      participantId: armedCombatantId,
      request: gmPage.request,
    });
    const armedOpportunity = armedDeclaration?.attackOpportunities?.find(
      (opportunity) => opportunity.phase === "phase1",
    );
    expect(armedOpportunity).toMatchObject({
      sourceKind: "weapon",
      status: "committed",
      targetParticipantId: targetCombatantId,
      weaponInstanceId: daggerItemId,
      weaponTemplateId: "weapon-template-dagger",
    });
  });
});
