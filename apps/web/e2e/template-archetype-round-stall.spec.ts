import { expect, test, type APIRequestContext, type Page, type Response } from "@playwright/test";
import {
  buildCombatProgressionProjection,
  getCurrentExecutableCombatTasks,
  initializeCombatRoundState,
  rollCombatRoundCombatExperience,
  setCombatRoundCombatExperienceDifficulty,
  type CombatRoundState,
  type EncounterSession,
} from "@glantri/domain";

import { characterPayload } from "./character-fixture";
import { API_URL } from "./targets";

/**
 * Forgejo #1001 — a round stuck at Phase 1 initiative on a combatant whose initiative cannot be
 * derived, and the GM's own Clear current step control answering 200 while the round stayed put.
 *
 * The stuck combatant is a temporary actor fielded directly from a humanoid archetype Template
 * authored through the Templates page, which carries no `build`, so its initiative context is
 * unavailable (#851 measurement 22556). It declares an attack, so with the Character also acting,
 * bulk initiative cannot skip it and its own roll is refused.
 *
 * Measured at `dev` `970ab220`: Clear current step undid the boundary that left modifier review,
 * the round manager immediately re-ran that boundary as a deterministic transition, and the round
 * stood at initiative exactly as before. The repair keeps the restored review stage under the GM's
 * backtrack hold, so the clear sticks, and refuses a clear that has nothing to undo.
 *
 * Recovery uses no new rule: the GM clears back to Declaration, declares the stuck actor's action
 * again as one that needs no initiative ordering, and the existing bulk completion carries the
 * round to its boundary.
 */

const PUNCH_SOURCE_ID = "unarmed:virtual-weapon-template-punch";
const SHOTS = "test-results/template-archetype-round-stall";

async function json<T>(response: Awaited<ReturnType<APIRequestContext["get"]>>): Promise<T> {
  if (!response.ok()) {
    throw new Error(`${response.status()} ${await response.text()}`);
  }
  return response.json() as Promise<T>;
}

async function post<T>(request: APIRequestContext, endpoint: string, data: unknown = {}) {
  return json<T>(await request.post(`${API_URL}${endpoint}`, { data }));
}

type RoundEncounter = EncounterSession & { combatRoundState: CombatRoundState };

async function readEncounter(request: APIRequestContext, encounterId: string) {
  return (
    await json<{ encounter: RoundEncounter }>(
      await request.get(`${API_URL}/encounters/${encounterId}`),
    )
  ).encounter;
}

function executableTasks(state: CombatRoundState) {
  return getCurrentExecutableCombatTasks(buildCombatProgressionProjection(state)).map((task) => ({
    command: task.expectedCommand,
    executionGroupId: task.executionGroupId,
    owner: task.owner?.kind === "combatant" ? task.owner.participantId : task.owner?.kind,
    taskId: task.id,
  }));
}

/** Authors a humanoid archetype Template the way a GM does, through the Templates page editor. */
async function authorArchetypeTemplate(page: Page, name: string) {
  await page.goto("/templates");
  await page.getByRole("button", { name: "Create template" }).first().click();
  await page.getByPlaceholder("City Guard").fill(name);
  const next = page.getByRole("button", { name: "Next", exact: true });
  await page.getByRole("button").filter({ hasText: "Society level" }).first().click();
  await next.click();
  await page.locator("xpath=//section[h3[normalize-space()='Profession']]//button").first().click();
  await next.click();
  await page.getByRole("button").filter({ hasText: "Core group" }).first().click();
  await next.click();
  await page
    .getByRole("button")
    .filter({ hasText: /• Level \d+/ })
    .first()
    .click();
  for (let attempt = 0; attempt < 6 && (await next.count()); attempt += 1) {
    await next.click();
  }
  await page.getByRole("button", { name: "Save archetype template" }).click();
  await expect(page.getByText(`Created archetype template ${name}.`)).toBeVisible();
  const { templates } = await json<{
    templates: {
      description?: string;
      id: string;
      kind: "npc" | "monster" | "animal";
      name: string;
      snapshot: Record<string, unknown>;
    }[];
  }>(await page.request.get(`${API_URL}/templates`));
  const template = templates.find((entry) => entry.name === name);
  expect(template, "the authored Template is saved").toBeTruthy();
  // The shape the authoring path really produces: an archetype, with no build of its own.
  expect(template!.snapshot.templateKind).toBe("humanoid_npc_archetype");
  expect(template!.snapshot.build).toBeUndefined();
  return template!;
}

/** Generates one concrete NPC from a Template on the Templates page and saves it to a roster. */
async function generateNpcFromTemplate(input: {
  campaignId: string;
  page: Page;
  templateId: string;
}): Promise<{ id: string; name: string }> {
  const { page } = input;
  await page.goto("/templates");
  await page.getByRole("button", { name: "Generate NPC" }).first().click();
  await page.getByLabel("Template").selectOption(input.templateId);
  await page.getByRole("button", { name: /^Generate$/ }).click();
  await page.getByLabel("Campaign roster").selectOption(input.campaignId);
  await page.getByRole("button", { name: "Save NPC to roster" }).click();
  await expect(page.getByText(/^Saved .+ as one reusable NPC on the /)).toBeVisible();
  const { entities } = await json<{
    entities: { id: string; name: string; snapshot?: Record<string, unknown> }[];
  }>(await page.request.get(`${API_URL}/campaigns/${input.campaignId}/entities`));
  const npc = entities.find(
    (entity) =>
      entity.snapshot?.actorClass === "campaign_npc" &&
      (entity.snapshot.generationProvenance as { sourceTemplateId?: string } | undefined)
        ?.sourceTemplateId === input.templateId,
  );
  expect(npc, "the generated NPC is on the campaign roster").toBeTruthy();
  expect(npc!.snapshot?.build, "a generated NPC carries a concrete build").toBeTruthy();
  return { id: npc!.id, name: npc!.name };
}

/** A fighter with Brawling and Dodge, so an unarmed attack has a skill and a defence to resolve. */
function fighterPayload(id: string, name: string) {
  const payload = characterPayload(id, name);
  return {
    build: {
      ...payload.build,
      progression: {
        ...payload.build.progression,
        secondaryPoolTotal: 120,
        skills: ["brawling", "dodge"].map((skillId) => ({
          category: "secondary",
          categoryId: "combat",
          groupId: "basic_melee_training",
          secondaryRanks: 9,
          skillId,
        })),
      },
    },
  };
}

interface RoundFixture {
  campaignId: string;
  encounterId: string;
  heroCombatantId: string;
  heroName: string;
  opponentCombatantId: string;
  opponentName: string;
  opponentScenarioParticipantId: string;
  scenarioId: string;
}

type OpponentKind =
  | { kind: "raw_template"; templateName: string }
  | { kind: "generated_npc"; npcName: string }
  | { kind: "character" };

/**
 * One Character and one opponent in an active encounter standing at Declaration. The opponent is a
 * temporary actor fielded straight from a Template, an NPC generated from one, or a Character.
 */
async function buildRound(input: {
  campaignId: string;
  opponent: OpponentKind;
  page: Page;
  suffix: string;
}): Promise<RoundFixture> {
  const { campaignId, page, suffix } = input;
  const { user } = await json<{ user: { id: string } }>(
    await page.request.get(`${API_URL}/auth/me`),
  );
  const addCharacter = async (role: string) => {
    const characterId = `issue-1001-${role}-${suffix}`;
    const name = `${role === "hero" ? "Hero" : "Rival"} ${suffix}`;
    await json(
      await page.request.post(`${API_URL}/characters`, {
        data: fighterPayload(characterId, name),
      }),
    );
    await post(page.request, `/campaigns/${campaignId}/roster`, {
      category: "pc",
      sourceId: characterId,
      sourceType: "character",
    });
    return { characterId, name };
  };
  const hero = await addCharacter("hero");
  const rival = input.opponent.kind === "character" ? await addCharacter("rival") : undefined;
  const scenario = await post<{ scenario: { id: string } }>(
    page.request,
    `/campaigns/${campaignId}/scenarios`,
    { name: `Issue 1001 Scenario ${suffix}`, status: "live" },
  );
  const scenarioId = scenario.scenario.id;
  const fieldCharacter = async (characterId: string) => {
    const { participant } = await post<{ participant: { id: string } }>(
      page.request,
      `/scenarios/${scenarioId}/participants/character`,
      { characterId, controlledByUserId: user.id },
    );
    await post(
      page.request,
      `/scenarios/${scenarioId}/participants/${participant.id}/refresh-character-equipment`,
    );
    return participant.id;
  };
  const heroParticipantId = await fieldCharacter(hero.characterId);

  let opponentName: string;
  let opponentParticipantId: string;
  if (input.opponent.kind === "character") {
    opponentName = rival!.name;
    opponentParticipantId = await fieldCharacter(rival!.characterId);
  } else {
    await page.goto(`/campaigns/${campaignId}/scenarios/${scenarioId}`);
    if (input.opponent.kind === "raw_template") {
      opponentName = `Soldier ${suffix}`;
      await page
        .locator("select")
        .filter({ has: page.locator("option", { hasText: "(template library)" }) })
        .first()
        .selectOption({ label: `${input.opponent.templateName} (template library)` });
      await page
        .locator("select")
        .filter({ has: page.locator('option[value="monster"]') })
        .first()
        .selectOption("enemy");
      await page.getByPlaceholder("Temporary actor name override").fill(opponentName);
      await page.getByRole("button", { name: "Create temporary actor" }).click();
      await expect(page.getByText(`Created temporary actor ${opponentName}.`)).toBeVisible();
    } else {
      opponentName = input.opponent.npcName;
      await page.getByLabel(`Toggle ${opponentName} scenario participation`).click();
      await expect(page.getByText(`Added ${opponentName} to the scenario.`).first()).toBeVisible();
    }
    const { participants } = await json<{
      participants: { id: string; snapshot: { displayName: string } }[];
    }>(await page.request.get(`${API_URL}/scenarios/${scenarioId}/participants`));
    opponentParticipantId = participants.find(
      (participant) => participant.snapshot.displayName === opponentName,
    )!.id;
  }

  const heroCombatantId = `issue-1001-hero-c-${suffix}`;
  const opponentCombatantId = `issue-1001-opponent-c-${suffix}`;
  const now = new Date().toISOString();
  const created = await post<{ encounter: EncounterSession }>(
    page.request,
    `/scenarios/${scenarioId}/encounters`,
    {
      session: {
        campaignId,
        createdAt: now,
        currentRound: 1,
        id: `issue-1001-encounter-${suffix}`,
        kind: "combat",
        participantMembershipMode: "explicit",
        participants: [
          {
            characterId: hero.characterId,
            id: heroCombatantId,
            label: hero.name,
            participantType: "scenario",
            scenarioParticipantId: heroParticipantId,
          },
          {
            characterId: rival?.characterId,
            id: opponentCombatantId,
            label: opponentName,
            participantType: "scenario",
            scenarioParticipantId: opponentParticipantId,
          },
        ],
        scenarioId,
        status: "active",
        title: `Issue 1001 Combat ${suffix}`,
        updatedAt: now,
      },
    },
  );
  const encounterId = created.encounter.id;
  let encounter = await readEncounter(page.request, encounterId);
  await json(
    await page.request.patch(`${API_URL}/encounters/${encounterId}/status`, {
      data: { expectedRevision: encounter.updatedAt, status: "active" },
    }),
  );
  // Round 1 opens with a Combat Experience check that gates declaration. Resolving it is
  // scaffolding, exactly as #666's, #690's and #694's evidence do it.
  encounter = await readEncounter(page.request, encounterId);
  const combatRoundState = [heroCombatantId, opponentCombatantId].reduce(
    (state, participantId, index) =>
      rollCombatRoundCombatExperience({
        command: { createdAt: new Date(Date.now() + index).toISOString() },
        participantId,
        rng: () => 0.6,
        skillTotal: 26,
        state,
      }).state,
    setCombatRoundCombatExperienceDifficulty({
      difficulty: 1,
      state: initializeCombatRoundState({ encounter }),
    }),
  );
  expect(combatRoundState.currentStep).toBe("select_actions");
  await json(
    await page.request.put(`${API_URL}/encounters/${encounterId}`, {
      data: {
        expectedRevision: encounter.updatedAt,
        session: { ...encounter, combatRoundState, currentRound: 1, status: "active" },
      },
    }),
  );

  return {
    campaignId,
    encounterId,
    heroCombatantId,
    heroName: hero.name,
    opponentCombatantId,
    opponentName,
    opponentScenarioParticipantId: opponentParticipantId,
    scenarioId,
  };
}

const INSPECTOR_HEADING = /^Combat inspector — .+ · Round \d+ · /;

async function openCombat(page: Page, fixture: RoundFixture) {
  await page.goto(
    `/campaigns/${fixture.campaignId}?scenarioId=${fixture.scenarioId}&encounterId=${fixture.encounterId}&tab=combat`,
  );
  await expect(page.getByRole("heading", { name: INSPECTOR_HEADING })).toBeVisible({
    timeout: 15_000,
  });
}

async function selectInspectorParticipant(page: Page, label: string) {
  const heading = page.getByRole("heading", { name: INSPECTOR_HEADING });
  for (let attempt = 0; attempt < 10; attempt += 1) {
    if ((await heading.innerText({ timeout: 5_000 })).includes(label)) return;
    await page.getByRole("button", { name: "Next participant" }).click({ timeout: 5_000 });
  }
  throw new Error(`The GM inspector never reached ${label}.`);
}

/** Declares through the GM inspector, as a GM does. Returns the declaration request body. */
async function declareInInspector(input: {
  action: "attack_parry" | "pass";
  label: string;
  page: Page;
  target?: string;
}): Promise<Record<string, unknown>> {
  const { page } = input;
  await selectInspectorParticipant(page, input.label);
  await page.getByRole("combobox", { name: "Action" }).first().selectOption(input.action);
  if (input.action === "attack_parry") {
    await page
      .getByRole("combobox", { name: "Attack source" })
      .first()
      .selectOption(PUNCH_SOURCE_ID);
    await page
      .getByRole("combobox", { name: "Target" })
      .first()
      .selectOption({ label: input.target! });
  }
  const declared = page.waitForResponse(
    (response) =>
      response.request().method() === "POST" && response.url().includes("/combat-declaration"),
  );
  await page.getByRole("button", { name: "Declare action" }).first().click();
  const response = await declared;
  expect(response.status(), await response.text()).toBe(200);
  return JSON.parse(response.request().postData() ?? "{}") as Record<string, unknown>;
}

/**
 * A raw archetype actor has no attack source the inspector can offer, so its declaration is sent
 * to the same declaration route the inspector uses, with the inspector's own body for the
 * Character's Punch retargeted. The route accepts it; that is the state #1001 measured.
 */
async function declareActorAttackOnRoute(input: {
  fixture: RoundFixture;
  heroBody: Record<string, unknown>;
  page: Page;
}) {
  const { fixture, heroBody, page } = input;
  const encounter = await readEncounter(page.request, fixture.encounterId);
  const task = executableTasks(encounter.combatRoundState).find(
    (candidate) =>
      candidate.command === "declare_action" && candidate.owner === fixture.opponentCombatantId,
  )!;
  const { participants } = await json<{ participants: { id: string; updatedAt: string }[] }>(
    await page.request.get(`${API_URL}/scenarios/${fixture.scenarioId}/participants`),
  );
  const phaseContexts = heroBody.phaseContexts as Record<string, Record<string, unknown>>;
  const response = await page.request.post(
    `${API_URL}/encounters/${fixture.encounterId}/combat-declaration`,
    {
      data: {
        ...heroBody,
        combatContext: {
          modifierBuckets: {
            general: [],
            situationDb: [],
            situationInitiative: [],
            situationObSkill: [],
          },
        },
        executionGroupId: task.executionGroupId,
        expectedParticipantRevision: participants.find(
          (participant) => participant.id === fixture.opponentScenarioParticipantId,
        )!.updatedAt,
        expectedRevision: encounter.updatedAt,
        phaseContexts: {
          ...phaseContexts,
          phase1: { ...phaseContexts.phase1, targetParticipantId: fixture.heroCombatantId },
        },
        scenarioParticipantId: fixture.opponentScenarioParticipantId,
        taskId: task.taskId,
      },
    },
  );
  expect(response.status(), await response.text()).toBe(200);
}

const ROUND_CONTROLS = [
  "Complete modifier review",
  "Roll initiative",
  "Roll attack",
  "Commit defense review",
  "Roll hit location",
  "Roll damage",
  "Roll critical",
  "Commit damage",
  "Complete phase 2 action review",
  "Complete damage review",
  "Complete phase",
  "Pass phase",
  "Complete round",
  "Open next round",
  "Start next round",
  "Next round",
];

async function enabledButtonNames(page: Page): Promise<string[]> {
  return page.getByRole("button").evaluateAll((nodes) =>
    nodes
      .filter((node) => !(node as HTMLButtonElement).disabled)
      .map((node) => (node.textContent ?? "").trim())
      .filter((label) => label.length > 0),
  );
}

/**
 * Walks the GM's canonical round controls one at a time, the first enabled one winning, and
 * records each step passed and every refused combat call. Bounded by iterations.
 */
async function walkToNextRound(input: { encounterId: string; page: Page; prefix: string }) {
  const { encounterId, page } = input;
  const walked: { control: string; step: string }[] = [];
  const refused: string[] = [];
  const listener = (response: Response) => {
    if (response.url().includes("/combat-") && response.status() >= 400) {
      void response
        .text()
        .catch(() => "")
        .then((body) =>
          refused.push(
            `${response.status()} ${response.url().split("/").slice(-1)[0]} ${body.slice(0, 160)}`,
          ),
        );
    }
  };
  page.on("response", listener);
  let idle = 0;
  try {
    for (let iteration = 0; iteration < 60; iteration += 1) {
      const state = (await readEncounter(page.request, encounterId)).combatRoundState;
      if (state.roundNumber >= 2) break;
      if (process.env.WALK_DEBUG) {
        console.log(
          `[1001] walk-debug ${state.currentStep} cursor=${JSON.stringify(state.currentCursor)} tasks=${JSON.stringify(executableTasks(state).map((t) => [t.command, t.owner]))}`,
        );
      }
      const currentTask = page.getByRole("button", { name: /^(Resume )?[Cc]urrent task$/ });
      if ((await currentTask.count()) && (await currentTask.first().isEnabled())) {
        await currentTask.first().click();
        await page.waitForTimeout(400);
      }
      const source = page.getByRole("combobox", { name: "Attack source" }).first();
      if ((await source.count()) && (await source.inputValue()) === "") {
        if (await source.locator(`option[value="${PUNCH_SOURCE_ID}"]`).count()) {
          await source.selectOption(PUNCH_SOURCE_ID);
          await page.waitForTimeout(400);
        }
      }
      // The inspector's Current action card carries the one control the canonical task offers.
      const currentAction = page
        .locator("div")
        .filter({ has: page.getByText("Current action", { exact: true }) })
        .last()
        .getByRole("button");
      const offered =
        (await currentAction.count()) && (await currentAction.last().isEnabled())
          ? ((await currentAction.last().textContent()) ?? "").trim()
          : "";
      const buttons = await enabledButtonNames(page);
      const label = offered || ROUND_CONTROLS.find((candidate) => buttons.includes(candidate));
      if (!label) {
        // A save may still be in flight; give it a moment before calling the walk stalled.
        if (idle < 3) {
          idle += 1;
          await page.waitForTimeout(2000);
          continue;
        }
        await page.screenshot({ fullPage: true, path: `${SHOTS}/${input.prefix}-stalled.png` });
        break;
      }
      idle = 0;
      if (offered) await currentAction.last().click();
      else await page.getByRole("button", { name: label, exact: true }).first().click();
      await page.waitForTimeout(1500);
      walked.push({ control: label, step: state.currentStep });
    }
  } finally {
    page.off("response", listener);
  }
  const final = await readEncounter(page.request, encounterId);
  return { final, refused, walked };
}

async function newCampaign(page: Page, suffix: string) {
  const { campaign } = await post<{ campaign: { id: string } }>(page.request, "/campaigns", {
    name: `Issue 1001 ${suffix}`,
    status: "active",
  });
  return campaign.id;
}

test.describe("a round stuck at initiative on a raw Template actor can be recovered (#1001)", () => {
  test.use({ storageState: "e2e/.auth/gm.json" });

  test("Clear current step really rewinds, and the round then reaches its boundary", async ({
    page,
  }) => {
    test.setTimeout(600_000);
    const suffix = String(Date.now());
    // A round already stuck this way cannot be newly produced from a Templates-page archetype any
    // more: fielding one is refused (#1001 scope 3, below). It is produced instead from a Template
    // that, like the archetype, carries no build but is not an archetype — authored through the same
    // entities route #666's CI spec uses — so the round reaches exactly the measured state.
    const templateName = `Garrison Soldier ${suffix}`;
    const campaignId = await newCampaign(page, suffix);
    await post(page.request, `/campaigns/${campaignId}/entities`, {
      kind: "npc",
      name: templateName,
      snapshot: { health: { currentHp: 10, maxHp: 10 }, roleLabel: "Gate guard" },
    });
    const fixture = await buildRound({
      campaignId,
      opponent: { kind: "raw_template", templateName },
      page,
      suffix,
    });

    // ---- Drive the round into the measured stuck state. ----
    await openCombat(page, fixture);
    const heroBody = await declareInInspector({
      action: "attack_parry",
      label: fixture.heroName,
      page,
      target: fixture.opponentName,
    });
    await declareActorAttackOnRoute({ fixture, heroBody, page });
    for (let attempt = 0; attempt < 6; attempt += 1) {
      const encounter = await readEncounter(page.request, fixture.encounterId);
      if (encounter.combatRoundState.currentStep === "initiative_phase_1") break;
      const task = executableTasks(encounter.combatRoundState)[0]!;
      const route =
        task.command === "review_modifiers_phase1"
          ? "complete-remaining-step"
          : "advance-deterministic";
      await json(
        await page.request.post(
          `${API_URL}/encounters/${fixture.encounterId}/combat-round/${route}`,
          {
            data: {
              executionGroupId: task.executionGroupId,
              expectedRevision: encounter.updatedAt,
              phase: "phase1",
              taskId: task.taskId,
            },
          },
        ),
      );
    }
    let encounter = await readEncounter(page.request, fixture.encounterId);
    expect(encounter.combatRoundState.currentStep).toBe("initiative_phase_1");
    const initiativeTask = executableTasks(encounter.combatRoundState).find(
      (task) => task.owner === fixture.opponentCombatantId,
    )!;
    const { participants } = await json<{ participants: { id: string; updatedAt: string }[] }>(
      await page.request.get(`${API_URL}/scenarios/${fixture.scenarioId}/participants`),
    );
    const roll = await page.request.post(
      `${API_URL}/encounters/${fixture.encounterId}/combat-initiative`,
      {
        data: {
          executionGroupId: initiativeTask.executionGroupId,
          expectedParticipantRevision: participants.find(
            (participant) => participant.id === fixture.opponentScenarioParticipantId,
          )!.updatedAt,
          expectedRevision: encounter.updatedAt,
          scenarioParticipantId: fixture.opponentScenarioParticipantId,
          taskId: initiativeTask.taskId,
        },
      },
    );
    expect(roll.status()).toBe(409);
    expect(((await roll.json()) as { code?: string }).code).toBe("initiative_context_unavailable");
    const bulk = await page.request.post(
      `${API_URL}/encounters/${fixture.encounterId}/combat-round/complete-remaining-step`,
      {
        data: {
          executionGroupId: initiativeTask.executionGroupId,
          expectedRevision: encounter.updatedAt,
          phase: "phase1",
          taskId: initiativeTask.taskId,
        },
      },
    );
    expect(bulk.status()).toBe(409);
    const stuck = await readEncounter(page.request, fixture.encounterId);
    expect(stuck.updatedAt, "neither refused call wrote anything").toBe(encounter.updatedAt);

    // ---- Clear current step, from the browser, back to Declaration with no declarations left. ----
    // Both go: the Character's attack targets the raw actor, and an attack on an actor with no
    // recorded characteristics or skills is refused by design (`defense_context_unavailable`), so
    // keeping it would only move the stall from initiative to the attack roll.
    console.log(
      `[1001] persisted before recovery: step=${stuck.combatRoundState.currentStep} round=${stuck.combatRoundState.roundNumber} commands=${JSON.stringify(stuck.combatRoundState.commands.map((command) => command.type))} revision=${stuck.updatedAt}`,
    );
    await openCombat(page, fixture);
    await page.screenshot({ fullPage: true, path: `${SHOTS}/01-stuck-at-initiative.png` });
    const clearSteps: string[] = [];
    for (let attempt = 0; attempt < 8; attempt += 1) {
      encounter = await readEncounter(page.request, fixture.encounterId);
      if (
        encounter.combatRoundState.currentStep === "select_actions" &&
        encounter.combatRoundState.participants.every((participant) => !participant.declaration)
      ) {
        break;
      }
      const cleared = page.waitForResponse((response) =>
        response.url().includes("/combat-round/clear-current-step"),
      );
      await page.getByRole("button", { name: "Clear current step" }).click();
      expect((await cleared).status()).toBe(200);
      await page.waitForTimeout(1500);
      const after = await readEncounter(page.request, fixture.encounterId);
      clearSteps.push(
        `${encounter.combatRoundState.currentStep}->${after.combatRoundState.currentStep} commands ${encounter.combatRoundState.commands.length}->${after.combatRoundState.commands.length}`,
      );
      // Every clear makes real, persisted progress backwards, and nothing re-runs it behind the GM.
      expect(
        after.combatRoundState.commands.length,
        `clear ${attempt} must remove a command and keep it removed (${clearSteps.join("; ")})`,
      ).toBeLessThan(encounter.combatRoundState.commands.length);
    }
    console.log(`[1001] clears: ${clearSteps.join("; ")}`);
    encounter = await readEncounter(page.request, fixture.encounterId);
    expect(encounter.combatRoundState.currentStep).toBe("select_actions");
    expect(encounter.combatRoundState.participants.every((p) => !p.declaration)).toBe(true);
    await page.screenshot({ fullPage: true, path: `${SHOTS}/02-rewound-to-declaration.png` });

    // ---- The GM declares again, choosing actions that need no initiative ordering. ----
    await openCombat(page, fixture);
    await declareInInspector({ action: "pass", label: fixture.heroName, page });
    await declareInInspector({ action: "pass", label: fixture.opponentName, page });

    const walk = await walkToNextRound({
      encounterId: fixture.encounterId,
      page,
      prefix: "03-recovery-walk",
    });
    console.log(
      `[1001] recovery walk: ${JSON.stringify(walk.walked)} refused=${JSON.stringify(walk.refused)}`,
    );
    await page.screenshot({ fullPage: true, path: `${SHOTS}/04-after-recovery-walk.png` });
    console.log(
      `[1001] persisted after recovery: step=${walk.final.combatRoundState.currentStep} round=${walk.final.combatRoundState.roundNumber} revision=${walk.final.updatedAt}`,
    );
    expect(walk.refused).toEqual([]);
    expect(
      walk.final.combatRoundState.roundNumber,
      "the round reaches its boundary",
    ).toBeGreaterThanOrEqual(2);
    // #850: the participant set is unchanged — the actor was never removed to unblock the round.
    expect(walk.final.combatRoundState.participants.map((p) => p.participantId).sort()).toEqual(
      [fixture.heroCombatantId, fixture.opponentCombatantId].sort(),
    );
  });

  test("Clear current step refuses, and writes nothing, when the round has nothing to undo", async ({
    page,
  }) => {
    test.setTimeout(300_000);
    const suffix = String(Date.now());
    const campaignId = await newCampaign(page, suffix);
    const fixture = await buildRound({ campaignId, opponent: { kind: "character" }, page, suffix });
    let last: { code?: string; status: number } = { status: 0 };
    for (let attempt = 0; attempt < 6; attempt += 1) {
      const before = await readEncounter(page.request, fixture.encounterId);
      const response = await page.request.post(
        `${API_URL}/encounters/${fixture.encounterId}/combat-round/clear-current-step`,
        { data: {} },
      );
      const after = await readEncounter(page.request, fixture.encounterId);
      last = {
        code: ((await response.json()) as { code?: string }).code,
        status: response.status(),
      };
      if (response.status() === 200) {
        expect(JSON.stringify(after.combatRoundState)).not.toBe(
          JSON.stringify(before.combatRoundState),
        );
        continue;
      }
      expect(after.updatedAt, "a refused clear writes nothing").toBe(before.updatedAt);
      break;
    }
    expect(last).toEqual({ code: "nothing_to_clear", status: 409 });
  });

  test("fielding a newly authored archetype Template is refused; generate an NPC first", async ({
    page,
  }) => {
    test.setTimeout(300_000);
    const suffix = String(Date.now());
    const templateName = `Gate Warden ${suffix}`;
    const template = await authorArchetypeTemplate(page, templateName);
    const campaignId = await newCampaign(page, suffix);
    const { scenario } = await post<{ scenario: { id: string } }>(
      page.request,
      `/campaigns/${campaignId}/scenarios`,
      { name: `Issue 1001 Fielding ${suffix}`, status: "live" },
    );
    // #851: the Scenario page does not offer the archetype Template as a direct-field source.
    await page.goto(`/campaigns/${campaignId}/scenarios/${scenario.id}`);
    await expect(page.getByRole("heading", { level: 1 })).toContainText("Issue 1001 Fielding");
    await page.waitForLoadState("networkidle");
    await expect(page.locator("option", { hasText: templateName })).toHaveCount(0);
    await expect(page.getByText(templateName)).toHaveCount(0);
    await page.screenshot({ fullPage: true, path: `${SHOTS}/06-archetype-not-offered.png` });
    // #1001: the server still refuses it. The body is the one `buildScenarioActorInputFromTemplate`
    // sends for a Template source.
    const response = await page.request.post(
      `${API_URL}/scenarios/${scenario.id}/participants/entity`,
      {
        data: {
          entityInput: {
            description: template.description,
            kind: template.kind,
            name: templateName,
            snapshot: {
              ...template.snapshot,
              templateId: template.id,
              templateName: template.name,
            },
          },
          isTemporary: true,
          joinSource: "gm_added",
          role: "enemy",
        },
      },
    );
    expect(response.status()).toBe(409);
    expect(await response.json()).toEqual({
      code: "generate_npc_from_template_first",
      error: "Generate an NPC from this Template first.",
    });
    const { participants } = await json<{ participants: unknown[] }>(
      await page.request.get(`${API_URL}/scenarios/${scenario.id}/participants`),
    );
    expect(participants).toEqual([]);
  });

  for (const opponent of ["character", "generated_npc"] as const) {
    test(`a round against a ${opponent === "character" ? "Character" : "generated NPC"} still reaches its boundary`, async ({
      page,
    }) => {
      test.setTimeout(600_000);
      const suffix = String(Date.now());
      const campaignId = await newCampaign(page, suffix);
      let kind: OpponentKind = { kind: "character" };
      if (opponent === "generated_npc") {
        const template = await authorArchetypeTemplate(page, `Watch Sergeant ${suffix}`);
        const npc = await generateNpcFromTemplate({ campaignId, page, templateId: template.id });
        kind = { kind: "generated_npc", npcName: npc.name };
      }
      const fixture = await buildRound({ campaignId, opponent: kind, page, suffix });
      await openCombat(page, fixture);
      // The Characters both attack. A generated NPC attacks the Character, who passes: the NPC's
      // authored skills are whatever the editor's first choices were, which need not include a
      // defence, and an attack on an opponent with no defence is refused by design (#690).
      await declareInInspector(
        opponent === "character"
          ? { action: "attack_parry", label: fixture.heroName, page, target: fixture.opponentName }
          : { action: "pass", label: fixture.heroName, page },
      );
      await declareInInspector({
        action: "attack_parry",
        label: fixture.opponentName,
        page,
        target: fixture.heroName,
      });
      const walk = await walkToNextRound({
        encounterId: fixture.encounterId,
        page,
        prefix: `05-control-${opponent}`,
      });
      console.log(
        `[1001] control ${opponent}: ${JSON.stringify(walk.walked.map((entry) => `${entry.step}:${entry.control}`))} refused=${JSON.stringify(walk.refused)}`,
      );
      // A `stale_revision` answer is this walk clicking while the panel's previous save was still
      // landing; the control is simply pressed again. Anything else is a real refusal.
      expect(walk.refused.filter((entry) => !entry.includes('"stale_revision"'))).toEqual([]);
      expect(walk.final.combatRoundState.roundNumber).toBeGreaterThanOrEqual(2);
    });
  }
});
