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
 * #666 — A temporary actor instantiated from a campaign Template must be able to act in combat, and
 * must not depend on the Character-only "refresh scenario equipment" operation that does not exist
 * for it.
 *
 * This is the rendered/executed evidence for the **normal solo-GM path**. The whole scenario is
 * built by one game master, every combatant is a Template-derived temporary actor, and **no second
 * player account participates at all** — which is the point of the issue, because the #664 smoke
 * test reached combat only by registering a second account and fighting player-character against
 * player-character, something a solo GM playtest cannot do.
 *
 * ## What was wrong
 *
 * A scenario-equipment projection is Character-sourced by construction:
 * `scenarioParticipantSnapshotSchema.equipmentProjection.provenance.source` is the literal
 * `"character_equipment_aggregate"`, and the only operation that writes one is the Character-only
 * `refresh-character-equipment` reconcile, whose button the participant assignment grid renders
 * only where `sourceType === "character" && characterId`. A Template-derived temporary actor
 * therefore never has such a projection and never can.
 *
 * That structural absence was read as a *repairable Character data fault*: the equipment status came
 * back `incomplete`, which (a) rendered a banner sending the GM to a control that is not on the
 * page, and (b) cleared `allowUnarmedFallback`, withholding the intrinsic Punch and Kick sources
 * that are such an actor's only legal attack sources — leaving `Declare action` disabled and the
 * round unable to leave Declaration. A `null` equipment state additionally made the combat loadout
 * derivation return an empty model, so even the always-derived brawling rows never appeared.
 *
 * ## What is asserted
 *
 * The legal attack sources here are the existing intrinsic ones (#575/#590): Punch and Kick.
 * Nothing new is invented, and no equipment or pseudo-Character state is manufactured — the fixture
 * asserts each participant really has no Character identity, no `equipmentState` and no
 * `equipmentProjection`, so a future change that satisfied the Character-shaped path by writing fake
 * state would fail here rather than pass.
 *
 * The second case covers a Template carrying no combat statistics at all — the shape
 * `packages/database/scripts/seedLocalDev.ts` authors for the seeded *"Training Bandit"*, whose
 * snapshot is health and nothing else. Such an actor still cannot resolve an attack, because it has
 * no attributes and no competencies for an attack to resolve through; that is a content question
 * about the seeded Template, not about this code path. What it must no longer do is instruct the GM
 * to use a control that does not exist, and that is what the second case binds.
 */

const PUNCH_SOURCE_ID = "unarmed:virtual-weapon-template-punch";
const KICK_SOURCE_ID = "unarmed:virtual-weapon-template-kick";

/** The seeded Template's snapshot, exactly as the local development bootstrap authors it. */
const SEEDED_TRAINING_BANDIT_SNAPSHOT = {
  health: {
    currentHp: 12,
    maxHp: 12,
  },
};

/**
 * A Template that carries combat statistics: the same Brawling rank the #590 unarmed evidence uses,
 * so an intrinsic attack has a competency to resolve through. This is authored Template content, not
 * a Character — no Character record exists anywhere in this test.
 */
function brawlerTemplateSnapshot(id: string, name: string) {
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
    health: {
      currentHp: 12,
      maxHp: 12,
    },
  };
}

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

async function selectGmInspectorParticipant(input: { label: string; page: Page }): Promise<void> {
  const heading = input.page.getByRole("heading", { name: /^Combat inspector — / });
  await expect(heading).toBeVisible();
  for (let attempt = 0; attempt < 8; attempt += 1) {
    if ((await heading.innerText()).includes(input.label)) return;
    await input.page.getByRole("button", { name: "Next participant" }).click();
  }
  throw new Error(`The GM inspector never reached ${input.label}.`);
}

interface TemplateCombatFixture {
  campaignId: string;
  combatantIdByName: Record<string, string>;
  encounterId: string;
  scenarioId: string;
}

/**
 * Builds a scenario whose combatants are all temporary actors created through the scenario's own
 * Template sources control — the GM path the issue describes, driven as a GM drives it rather than
 * through a shortcut that would produce a differently shaped participant.
 */
async function createTemplateOnlyCombat(input: {
  page: Page;
  snapshotByName: Record<string, unknown>;
  suffix: number;
}): Promise<TemplateCombatFixture> {
  const { page, suffix } = input;
  const names = Object.keys(input.snapshotByName);
  const campaign = await post<{ campaign: { id: string } }>(page.request, "/campaigns", {
    name: `Issue 666 Template NPC ${suffix}`,
    status: "active",
  });
  const campaignId = campaign.campaign.id;
  for (const name of names) {
    await post(page.request, `/campaigns/${campaignId}/entities`, {
      kind: "npc",
      name,
      snapshot: input.snapshotByName[name],
    });
  }
  const scenario = await post<{ scenario: { id: string } }>(
    page.request,
    `/campaigns/${campaignId}/scenarios`,
    { name: `Issue 666 Scenario ${suffix}`, status: "live" },
  );
  const scenarioId = scenario.scenario.id;

  await page.goto(`/campaigns/${campaignId}/scenarios/${scenarioId}`);
  // Sections nest, so both selects are addressed by the options they actually carry rather than by
  // position inside an ancestor that also contains the scenario Status control.
  const templatePicker = page
    .locator("select")
    .filter({ has: page.locator("option", { hasText: "(template library)" }) })
    .first();
  const temporaryActorRole = page
    .locator("select")
    .filter({ has: page.locator('option[value="monster"]') })
    .first();
  const createTemporaryActor = page.getByRole("button", { name: "Create temporary actor" });
  await expect(createTemporaryActor).toBeVisible();
  for (const name of names) {
    await templatePicker.selectOption({ label: `${name} (template library)` });
    await temporaryActorRole.selectOption("enemy");
    await createTemporaryActor.click();
    await expect(page.getByText(`Created temporary actor ${name}.`)).toBeVisible();
  }

  const participants = await json<{
    participants: {
      characterId?: string;
      id: string;
      snapshot: { displayName: string; equipmentProjection?: unknown; equipmentState?: unknown };
      sourceType: string;
    }[];
  }>(await page.request.get(`${API_URL}/scenarios/${scenarioId}/participants`));
  const participantByName = Object.fromEntries(
    names.map((name) => {
      const record = participants.participants.find((entry) => entry.snapshot.displayName === name);
      if (!record) throw new Error(`No scenario participant named ${name}.`);
      // No Character identity and no committed equipment of any kind. Asserted rather than assumed,
      // so a fix that manufactured Character or equipment state would fail here.
      expect(record.sourceType).toBe("entity");
      expect(record.characterId).toBeFalsy();
      expect(record.snapshot.equipmentState).toBeFalsy();
      expect(record.snapshot.equipmentProjection).toBeFalsy();
      return [name, record];
    }),
  );

  const combatantIdByName = Object.fromEntries(
    names.map((name, index) => [name, `issue-666-combatant-${index}-${suffix}`]),
  );
  const now = new Date().toISOString();
  const created = await post<{ encounter: EncounterSession }>(
    page.request,
    `/scenarios/${scenarioId}/encounters`,
    {
      session: {
        campaignId,
        createdAt: now,
        currentRound: 1,
        id: `issue-666-encounter-${suffix}`,
        kind: "combat",
        participantMembershipMode: "explicit",
        participants: names.map((name) => ({
          id: combatantIdByName[name],
          label: name,
          participantType: "scenario",
          scenarioParticipantId: participantByName[name]!.id,
        })),
        scenarioId,
        status: "active",
        title: `Issue 666 Combat ${suffix}`,
        updatedAt: now,
      },
    },
  );
  const encounterId = created.encounter.id;
  const refreshed = await json<{ encounter: EncounterSession }>(
    await page.request.get(`${API_URL}/encounters/${encounterId}`),
  );
  const activated = await page.request.patch(`${API_URL}/encounters/${encounterId}/status`, {
    data: { expectedRevision: refreshed.encounter.updatedAt, status: "active" },
  });
  expect(activated.ok(), await activated.text()).toBe(true);

  const activeEncounter = await json<{ encounter: EncounterSession }>(
    await page.request.get(`${API_URL}/encounters/${encounterId}`),
  );
  // Round 1 always opens with a Combat Experience check, which gates the declaration controls.
  // Resolving it is scaffolding, exactly as the GM panel's own component fixture does it.
  const combatRoundState = names.reduce(
    (state, name, index) =>
      rollCombatRoundCombatExperience({
        command: { createdAt: new Date(Date.now() + index).toISOString() },
        participantId: combatantIdByName[name]!,
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
  const stateUpdate = await page.request.put(`${API_URL}/encounters/${encounterId}`, {
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

  return { campaignId, combatantIdByName, encounterId, scenarioId };
}

test.describe("Template-derived temporary actors can act in combat (#666)", () => {
  test.use({ storageState: "e2e/.auth/gm.json" });

  test("lets a solo GM declare and commit an intrinsic attack for a Template NPC, with no second account", async ({
    page: gmPage,
  }) => {
    test.setTimeout(240_000);
    const suffix = Date.now();
    const banditName = `Training Bandit ${suffix}`;
    const opponentName = `Training Bandit Rival ${suffix}`;
    const fixture = await createTemplateOnlyCombat({
      page: gmPage,
      snapshotByName: {
        [banditName]: brawlerTemplateSnapshot(`issue-666-bandit-${suffix}`, banditName),
        [opponentName]: brawlerTemplateSnapshot(`issue-666-rival-${suffix}`, opponentName),
      },
      suffix,
    });

    // ---- The participant assignment grid offers the Template NPC no equipment control. ----
    // This is the half of #666 that must stop being *instructed*: the control is correctly absent,
    // because there is no Character equipment aggregate to reconcile.
    await gmPage.goto(`/campaigns/${fixture.campaignId}/scenarios/${fixture.scenarioId}`);
    await expect(gmPage.getByRole("button", { name: "Update Scenario equipment" })).toHaveCount(0);

    // ---- The Declaration panel offers a legal attack source and lets the GM declare. ----
    await gmPage.goto(
      `/campaigns/${fixture.campaignId}?scenarioId=${fixture.scenarioId}&encounterId=${fixture.encounterId}&tab=combat`,
    );
    await selectGmInspectorParticipant({ label: banditName, page: gmPage });

    // The banner must not instruct the GM to use the control the scenario page does not have.
    await expect(gmPage.getByText(/scenario equipment is incomplete or out of date/)).toHaveCount(
      0,
    );
    await expect(
      gmPage.getByText(/Refresh it from the participant assignment grid on the scenario page/),
    ).toHaveCount(0);

    const gmAction = gmPage.getByRole("combobox", { name: "Action" }).first();
    await expect(gmAction).toBeVisible();
    await gmAction.selectOption("attack_parry");

    // The existing intrinsic sources are offered. The empty state #666 reported is gone.
    await expect(
      gmPage.getByText("No ready weapon can be declared as an attack source."),
    ).toHaveCount(0);
    const sourceSelector = gmPage.getByRole("combobox", { name: "Attack source" }).first();
    await expect(sourceSelector).toBeVisible();
    await expect(sourceSelector.locator(`option[value="${PUNCH_SOURCE_ID}"]`)).toHaveText(
      "Punch · Unarmed",
    );
    await expect(sourceSelector.locator(`option[value="${KICK_SOURCE_ID}"]`)).toHaveText(
      "Kick · Unarmed",
    );
    // Nothing is chosen on the GM's behalf.
    await expect(sourceSelector).toHaveValue("");
    await sourceSelector.selectOption(PUNCH_SOURCE_ID);
    await expect(sourceSelector).toHaveValue(PUNCH_SOURCE_ID);

    // Defense information is available for a Template NPC, in both phases.
    await expect(gmPage.getByText("Defense information unavailable.")).toHaveCount(0);

    await gmPage
      .getByRole("combobox", { name: "Target" })
      .first()
      .selectOption({ label: opponentName });

    const declareButton = gmPage.getByRole("button", { name: "Declare action" }).first();
    await expect(declareButton).toBeEnabled();
    await gmPage.screenshot({
      fullPage: true,
      path: "test-results/lane666/lane666-template-npc-declaration-enabled.png",
    });

    const declareResponse = gmPage.waitForResponse(
      (response) =>
        response.request().method() === "POST" && response.url().includes("/combat-declaration"),
    );
    await declareButton.click();
    const response = await declareResponse;
    expect(response.ok(), await response.text()).toBe(true);

    // ---- The declaration is committed for the Template NPC, from an intrinsic source. ----
    const declaration = await readDeclaration({
      encounterId: fixture.encounterId,
      participantId: fixture.combatantIdByName[banditName]!,
      request: gmPage.request,
    });
    expect(declaration?.actionId).toBe("attack_parry");
    expect(declaration?.submittedBy).toBe("gm");
    const opportunity = declaration?.attackOpportunities?.find((entry) => entry.phase === "phase1");
    expect(opportunity).toMatchObject({
      sourceKind: "unarmed",
      status: "committed",
      targetParticipantId: fixture.combatantIdByName[opponentName]!,
      weaponSourceId: PUNCH_SOURCE_ID,
      weaponSourceSlot: "virtual",
      weaponTemplateId: "virtual-weapon-template-punch",
    });
    // No Item instance is required, requested or invented for a Template NPC.
    expect(opportunity?.itemId).toBeUndefined();
    expect(opportunity?.weaponInstanceId).toBeUndefined();

    // ---- The round leaves Declaration once every participant has declared. ----
    await selectGmInspectorParticipant({ label: opponentName, page: gmPage });
    await gmPage.getByRole("combobox", { name: "Action" }).first().selectOption("attack_parry");
    await gmPage
      .getByRole("combobox", { name: "Attack source" })
      .first()
      .selectOption(KICK_SOURCE_ID);
    await gmPage
      .getByRole("combobox", { name: "Target" })
      .first()
      .selectOption({ label: banditName });
    const opponentDeclareResponse = gmPage.waitForResponse(
      (response) =>
        response.request().method() === "POST" && response.url().includes("/combat-declaration"),
    );
    await gmPage.getByRole("button", { name: "Declare action" }).first().click();
    expect((await opponentDeclareResponse).ok()).toBe(true);

    await expect(
      gmPage.getByRole("heading", { name: /^Combat inspector — .* · Round 1 · Declaration$/ }),
    ).toHaveCount(0);
    await gmPage.screenshot({
      fullPage: true,
      path: "test-results/lane666/lane666-template-npc-round-left-declaration.png",
    });
  });

  test("never sends a GM to the Character-only equipment-refresh control for a Template NPC that carries no statistics", async ({
    page: gmPage,
  }) => {
    test.setTimeout(240_000);
    const suffix = Date.now();
    const bareName = `Seeded Training Bandit ${suffix}`;
    const otherName = `Seeded Training Bandit Rival ${suffix}`;
    const fixture = await createTemplateOnlyCombat({
      page: gmPage,
      snapshotByName: {
        [bareName]: SEEDED_TRAINING_BANDIT_SNAPSHOT,
        [otherName]: SEEDED_TRAINING_BANDIT_SNAPSHOT,
      },
      suffix,
    });

    await gmPage.goto(
      `/campaigns/${fixture.campaignId}?scenarioId=${fixture.scenarioId}&encounterId=${fixture.encounterId}&tab=combat`,
    );
    await selectGmInspectorParticipant({ label: bareName, page: gmPage });

    // A Template with no statistics still has nothing to attack with — that is a question about the
    // seeded Template's content, not about this code path. What it must never do is name a remedy
    // the scenario page does not offer for a temporary actor.
    await expect(gmPage.getByText(/scenario equipment is incomplete or out of date/)).toHaveCount(
      0,
    );
    await expect(
      gmPage.getByText(/Refresh it from the participant assignment grid on the scenario page/),
    ).toHaveCount(0);
    await expect(gmPage.getByRole("button", { name: "Update Scenario equipment" })).toHaveCount(0);
  });
});
