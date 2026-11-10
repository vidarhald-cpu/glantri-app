import { expect, test, type APIRequestContext, type Page, type Response } from "@playwright/test";
import {
  buildCombatProgressionProjection,
  getCurrentExecutableCombatTasks,
  type CombatRoundState,
  type EncounterSession,
} from "@glantri/domain";

import { characterPayload } from "./character-fixture";
import { API_URL } from "./targets";

/**
 * Forgejo #1103 — an armed generated NPC can defend after a hit.
 *
 * Generate NPC writes the NPC's Items without a `revision` (it has no persistent Item record), and
 * the per-attack defence snapshot requires one for every wielded slot. At `0122f4f4` a Character's
 * hit on a generated NPC holding a Broad sword therefore refused the NPC's defence review with
 * "Defense sources changed" and the round could not continue; the panel also listed no defence
 * source, because the generated snapshot stores its templates flat.
 *
 * The NPC is generated from the "City Watch Officer" archetype the Templates page wrote at
 * `0122f4f4` (gear: Broad sword), captured verbatim by the #1078 investigation.
 */

const SHOTS = "test-results/issue-1103";
const PUNCH_SOURCE_ID = "unarmed:virtual-weapon-template-punch";

const EARLIER_CATALOGUE_TEMPLATE_SNAPSHOT = {
  roleLabel: "City Watch Officer",
  actorClass: "template",
  profession: "City Watch Officer",
  templateKind: "humanoid_npc_archetype",
  archetypeType: "humanoid_npc",
  equipmentProfile: "Broad sword",
  humanoidNpcArchetype: {
    gear: { templateIds: ["weapon-template-broad-sword"], templateNames: ["Broad sword"] },
    stats: {
      base: {
        cha: 10,
        com: 10,
        con: 10,
        dex: 10,
        int: 10,
        lck: 10,
        pow: 10,
        siz: 10,
        str: 10,
        will: 10,
        health: 10,
      },
      final: {
        cha: 10,
        com: 10,
        con: 10,
        dex: 10,
        int: 10,
        lck: 10,
        pow: 10,
        siz: 10,
        str: 10,
        will: 10,
        health: 10,
      },
    },
    skills: [
      { skillId: "one_handed_concussion_axe", skillName: "1-h conc./axe", targetLevel: 8 },
      { skillId: "one_handed_edged", skillName: "1-h edged", targetLevel: 8 },
      { skillId: "two_handed_concussion_axe", skillName: "2-h conc./axe", targetLevel: 8 },
      { skillId: "two_handed_edged", skillName: "2-h edged", targetLevel: 8 },
      { skillId: "battlefield_awareness", skillName: "Battlefield Awareness", targetLevel: 8 },
      { skillId: "brawling", skillName: "Brawling", targetLevel: 8 },
      { skillId: "bureaucratic_writing", skillName: "Bureaucratic Writing", targetLevel: 8 },
      { skillId: "captaincy", skillName: "Captaincy", targetLevel: 8 },
      { skillId: "combat_experience", skillName: "Combat Experience", targetLevel: 8 },
      { skillId: "dodge", skillName: "Dodge", targetLevel: 8 },
      { skillId: "first_aid", skillName: "First aid", targetLevel: 8 },
      { skillId: "formation_fighting", skillName: "Formation Fighting", targetLevel: 8 },
      { skillId: "insight", skillName: "Insight", targetLevel: 8 },
      { skillId: "lance", skillName: "Lance", targetLevel: 8 },
      { skillId: "law", skillName: "Law", targetLevel: 8 },
      { skillId: "literacy", skillName: "Literacy", targetLevel: 8 },
      { skillId: "parry", skillName: "Parry", targetLevel: 8 },
      { skillId: "perception", skillName: "Perception", targetLevel: 8 },
      { skillId: "polearms", skillName: "Polearms", targetLevel: 8 },
      { skillId: "rhetorical_composition", skillName: "Rhetorical Composition", targetLevel: 8 },
      { skillId: "search", skillName: "Search", targetLevel: 8 },
      { skillId: "social_perception", skillName: "Social Perception", targetLevel: 8 },
      { skillId: "tactics", skillName: "Tactics", targetLevel: 8 },
    ],
    society: {
      societyId: "classical_polis_city_state",
      societyName: "Classical polis / city-state civilization",
    },
    seniority: "fully_trained",
    profession: {
      id: "city_watch_officer",
      name: "City Watch Officer",
      familyId: "military_security",
      familyName: "Military / Security",
    },
    variability: { statVariance: 1, skillVariance: 2 },
    schemaVersion: 1,
    skillGroupIds: [
      "basic_melee_training",
      "civic_learning",
      "defensive_soldiering",
      "veteran_leadership",
      "watch_civic_guard",
    ],
    generationHints: {
      competencyBands: [
        { max: 0, min: 0, label: "unskilled" },
        { max: 5, min: 1, label: "basic" },
        { max: 10, min: 6, label: "under_training" },
        { max: 15, min: 11, label: "fully_trained" },
        { max: 19, min: 16, label: "veteran" },
        { max: 99, min: 20, label: "expert" },
      ],
      suitabilityScale: [
        { bonus: 0, label: "ordinary" },
        { bonus: 1, label: "suitable" },
        { bonus: 2, label: "gifted" },
      ],
    },
  },
};

type RoundEncounter = EncounterSession & { combatRoundState: CombatRoundState };
type Entity = { id: string; name: string; snapshot: Record<string, unknown> };

async function json<T>(response: Awaited<ReturnType<APIRequestContext["get"]>>): Promise<T> {
  if (!response.ok()) {
    throw new Error(`${response.status()} ${await response.text()}`);
  }
  return response.json() as Promise<T>;
}

async function post<T>(request: APIRequestContext, endpoint: string, data: unknown = {}) {
  return json<T>(await request.post(`${API_URL}${endpoint}`, { data }));
}

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
    kind: task.kind,
    owner: task.owner?.kind === "combatant" ? task.owner.participantId : task.owner?.kind,
    taskId: task.id,
  }));
}

/** Generates one NPC from a Template on the Templates page and saves it to a campaign roster. */
async function generateNpcFromTemplate(input: {
  campaignId: string;
  page: Page;
  templateId: string;
}): Promise<Entity> {
  const { page } = input;
  await page.goto("/templates");
  await page.getByRole("button", { name: "Generate NPC" }).first().click();
  await page.getByLabel("Template").selectOption(input.templateId);
  await page.getByRole("button", { name: /^Generate$/ }).click();
  await expect(page.getByText(/^Generated .+ from /)).toBeVisible();
  await page.getByLabel("Campaign roster").selectOption(input.campaignId);
  await page.getByRole("button", { name: "Save NPC to roster" }).click();
  await expect(page.getByText(/^Saved .+ as one reusable NPC on the /)).toBeVisible();
  const { entities } = await json<{ entities: Entity[] }>(
    await page.request.get(`${API_URL}/campaigns/${input.campaignId}/entities`),
  );
  const npc = entities.find(
    (entity) =>
      entity.snapshot?.actorClass === "campaign_npc" &&
      (entity.snapshot.generationProvenance as { sourceTemplateId?: string } | undefined)
        ?.sourceTemplateId === input.templateId,
  );
  expect(npc, "the generated NPC is on the campaign roster").toBeTruthy();
  return npc!;
}

/** A Character with Brawling, Dodge and Parry, so a Punch has a skill and a defence. */
function heroPayload(id: string, name: string) {
  const payload = characterPayload(id, name);
  return {
    build: {
      ...payload.build,
      progression: {
        ...payload.build.progression,
        secondaryPoolTotal: 120,
        skills: ["brawling", "dodge", "parry", "combat_experience"].map((skillId) => ({
          category: "secondary",
          categoryId: "combat",
          groupId: "basic_melee_training",
          // A high Brawling makes the Punch connect more often; a miss only costs a retry.
          secondaryRanks: skillId === "brawling" ? 20 : 9,
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
  heroScenarioParticipantId: string;
  npcCombatantId: string;
  npcName: string;
  npcScenarioParticipantId: string;
  scenarioId: string;
}

/** A Character and the generated NPC, added from the roster in the Scenario, in an active Encounter. */
async function buildRound(input: {
  campaignId: string;
  npcName: string;
  page: Page;
  suffix: string;
}): Promise<RoundFixture> {
  const { campaignId, page, suffix } = input;
  const { user } = await json<{ user: { id: string } }>(
    await page.request.get(`${API_URL}/auth/me`),
  );
  const heroId = `issue-1103-hero-${suffix}`;
  const heroName = `Hero ${suffix}`;
  await json(
    await page.request.post(`${API_URL}/characters`, { data: heroPayload(heroId, heroName) }),
  );
  await post(page.request, `/campaigns/${campaignId}/roster`, {
    category: "pc",
    sourceId: heroId,
    sourceType: "character",
  });
  const scenario = await post<{ scenario: { id: string } }>(
    page.request,
    `/campaigns/${campaignId}/scenarios`,
    { name: `Issue 1103 Scenario ${suffix}`, status: "live" },
  );
  const scenarioId = scenario.scenario.id;
  const { participant: heroParticipant } = await post<{ participant: { id: string } }>(
    page.request,
    `/scenarios/${scenarioId}/participants/character`,
    { characterId: heroId, controlledByUserId: user.id },
  );
  await post(
    page.request,
    `/scenarios/${scenarioId}/participants/${heroParticipant.id}/refresh-character-equipment`,
  );

  // The GM adds the generated NPC to the Scenario from the campaign roster.
  await page.goto(`/campaigns/${campaignId}/scenarios/${scenarioId}`);
  await page.getByLabel(`Toggle ${input.npcName} scenario participation`).click();
  await expect(page.getByText(`Added ${input.npcName} to the scenario.`).first()).toBeVisible();
  const { participants } = await json<{
    participants: { id: string; snapshot: { displayName: string } }[];
  }>(await page.request.get(`${API_URL}/scenarios/${scenarioId}/participants`));
  const npcScenarioParticipantId = participants.find(
    (participant) => participant.snapshot.displayName === input.npcName,
  )!.id;

  const heroCombatantId = `issue-1103-hero-c-${suffix}`;
  const npcCombatantId = `issue-1103-npc-c-${suffix}`;
  const now = new Date().toISOString();
  const created = await post<{ encounter: EncounterSession }>(
    page.request,
    `/scenarios/${scenarioId}/encounters`,
    {
      session: {
        campaignId,
        createdAt: now,
        currentRound: 1,
        id: `issue-1103-encounter-${suffix}`,
        kind: "combat",
        participantMembershipMode: "explicit",
        participants: [
          {
            characterId: heroId,
            id: heroCombatantId,
            label: heroName,
            participantType: "scenario",
            scenarioParticipantId: heroParticipant.id,
          },
          {
            id: npcCombatantId,
            label: input.npcName,
            participantType: "scenario",
            scenarioParticipantId: npcScenarioParticipantId,
          },
        ],
        scenarioId,
        status: "active",
        title: `Issue 1103 Combat ${suffix}`,
        updatedAt: now,
      },
    },
  );
  const encounterId = created.encounter.id;
  const encounter = await readEncounter(page.request, encounterId);
  await json(
    await page.request.patch(`${API_URL}/encounters/${encounterId}/status`, {
      data: { expectedRevision: encounter.updatedAt, status: "active" },
    }),
  );
  return {
    campaignId,
    encounterId,
    heroCombatantId,
    heroName,
    heroScenarioParticipantId: heroParticipant.id,
    npcCombatantId,
    npcName: input.npcName,
    npcScenarioParticipantId,
    scenarioId,
  };
}

/**
 * Rolls every Combat Experience check round 1 opens with, through the server routes the GM's
 * round manager uses (difficulty first when asked), and returns each roll keyed by combatant.
 */
async function rollCombatExperienceChecks(page: Page, fixture: RoundFixture) {
  const rolls: Record<string, { skillTotal: number; source?: string; warning?: string }> = {};
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const encounter = await readEncounter(page.request, fixture.encounterId);
    const task = executableTasks(encounter.combatRoundState).find(
      (candidate) => candidate.kind === "combat_experience",
    );
    if (!task) break;
    if (task.taskId.includes(":stage:difficulty:")) {
      await json(
        await page.request.post(
          `${API_URL}/encounters/${fixture.encounterId}/combat-round/combat-experience-difficulty`,
          {
            data: {
              difficulty: 1,
              executionGroupId: task.executionGroupId,
              expectedRevision: encounter.updatedAt,
              taskId: task.taskId,
            },
          },
        ),
      );
      continue;
    }
    const combatantId = task.taskId.slice(task.taskId.lastIndexOf(":") + 1);
    const scenarioParticipantId =
      combatantId === fixture.npcCombatantId
        ? fixture.npcScenarioParticipantId
        : fixture.heroScenarioParticipantId;
    const rolled = await json<{
      combatExperience: {
        skillTotal: number;
        skillTotalSource?: string;
        skillTotalWarning?: string;
      };
    }>(
      await page.request.post(
        `${API_URL}/encounters/${fixture.encounterId}/combat-round/roll-combat-experience`,
        {
          data: {
            executionGroupId: task.executionGroupId,
            expectedRevision: encounter.updatedAt,
            scenarioParticipantId,
            taskId: task.taskId,
          },
        },
      ),
    );
    rolls[combatantId] = {
      skillTotal: rolled.combatExperience.skillTotal,
      source: rolled.combatExperience.skillTotalSource,
      warning: rolled.combatExperience.skillTotalWarning,
    };
  }
  return rolls;
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

/** Declares an attack through the GM inspector, as a GM does; returns the chosen source. */
async function declareAttack(input: {
  label: string;
  page: Page;
  source: (options: { label: string; value: string }[]) => string;
  target: string;
}): Promise<{ label: string; value: string }> {
  const { page } = input;
  await selectInspectorParticipant(page, input.label);
  await page.getByRole("combobox", { name: "Action" }).first().selectOption("attack_parry");
  const sourceSelect = page.getByRole("combobox", { name: "Attack source" }).first();
  const options = await sourceSelect.locator("option").evaluateAll((nodes) =>
    nodes.map((node) => ({
      label: (node.textContent ?? "").trim(),
      value: (node as HTMLOptionElement).value,
    })),
  );
  const value = input.source(options);
  await sourceSelect.selectOption(value);
  await page
    .getByRole("combobox", { name: "Target" })
    .first()
    .selectOption({ label: input.target });
  const declared = page.waitForResponse(
    (response) =>
      response.request().method() === "POST" && response.url().includes("/combat-declaration"),
  );
  await page.getByRole("button", { name: "Declare action" }).first().click();
  const response = await declared;
  expect(response.status(), await response.text()).toBe(200);
  return options.find((option) => option.value === value)!;
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

async function newCampaign(page: Page, suffix: string) {
  const { campaign } = await post<{ campaign: { id: string } }>(page.request, "/campaigns", {
    name: `Issue 1103 ${suffix}`,
    status: "active",
  });
  return campaign.id;
}

async function clickCommit(page: Page) {
  const resp = page.waitForResponse(
    (response) => response.url().includes("/combat-round/commit-defense-review"),
    { timeout: 15_000 },
  );
  const currentAction = page
    .locator("div")
    .filter({ has: page.getByText("Current action", { exact: true }) })
    .last()
    .getByRole("button", { name: "Commit defense review" });
  if (await currentAction.count()) await currentAction.last().click();
  else
    await page.getByRole("button", { name: "Commit defense review", exact: true }).first().click();
  const response = await resp;
  const body = await response.text();
  await page.waitForTimeout(800);
  return {
    body: body.slice(0, 250),
    request: response.request().postDataJSON(),
    status: response.status(),
  };
}

/** One step of the GM's canonical walk; returns the clicked label or "" when nothing offered. */
async function stepOnce(page: Page): Promise<string> {
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
  if (!label) return "";
  if (offered) await currentAction.last().click();
  else await page.getByRole("button", { name: label, exact: true }).first().click();
  await page.waitForTimeout(1500);
  return label;
}

function npcDefenseDue(state: CombatRoundState, npcCombatantId: string) {
  const cursor = (
    state as unknown as { phaseResolutionCursor?: { participantId?: string; substep?: string } }
  ).phaseResolutionCursor;
  return cursor?.substep === "defense" && cursor.participantId === npcCombatantId;
}

/** Walks the GM's round controls until `done` holds, recording every refused combat command. */
async function walkUntil(input: {
  done: (state: CombatRoundState) => boolean;
  fixture: RoundFixture;
  maxSteps?: number;
  page: Page;
}): Promise<{ reached: boolean; refused: string[]; walked: string[] }> {
  const { fixture, page } = input;
  const walked: string[] = [];
  const refused: string[] = [];
  const listener = (response: Response) => {
    if (response.url().includes("/combat-") && response.status() >= 400) {
      void response
        .text()
        .catch(() => "")
        .then((body) =>
          refused.push(
            `${response.status()} ${response.url().split("/").slice(-1)[0]} ${body.slice(0, 200)}`,
          ),
        );
    }
  };
  page.on("response", listener);
  let idle = 0;
  let last = "";
  let repeats = 0;
  try {
    for (let step = 0; step < (input.maxSteps ?? 60); step += 1) {
      const state = (await readEncounter(page.request, fixture.encounterId)).combatRoundState;
      if (input.done(state)) return { reached: true, refused, walked };
      const label = await stepOnce(page);
      if (!label) {
        if (idle++ < 3) {
          await page.waitForTimeout(2000);
          continue;
        }
        return { reached: false, refused, walked };
      }
      idle = 0;
      walked.push(`${state.currentStep}:${label}`);
      repeats = label === last ? repeats + 1 : 0;
      last = label;
      if (repeats >= 2) {
        await openCombat(page, fixture);
        repeats = 0;
      }
    }
  } finally {
    page.off("response", listener);
  }
  return { reached: false, refused, walked };
}

/** Generates an armed NPC, fields it against a Character and declares both attacks. */
async function setupArmedNpcRound(page: Page, suffix: string) {
  const { template } = await post<{ template: Entity }>(page.request, "/templates", {
    kind: "npc",
    name: `Issue 1103 watch ${suffix}`,
    snapshot: EARLIER_CATALOGUE_TEMPLATE_SNAPSHOT,
  });
  const campaignId = await newCampaign(page, suffix);
  const npc = await generateNpcFromTemplate({ campaignId, page, templateId: template.id });
  const items = Object.values(
    (npc.snapshot.equipmentState as { itemsById: Record<string, { templateId?: string }> })
      .itemsById,
  );
  expect(items.map((item) => item.templateId)).toContain("weapon-template-broad-sword");
  const fixture = await buildRound({ campaignId, npcName: npc.name, page, suffix });
  await rollCombatExperienceChecks(page, fixture);
  await openCombat(page, fixture);
  await declareAttack({
    label: fixture.heroName,
    page,
    source: () => PUNCH_SOURCE_ID,
    target: fixture.npcName,
  });
  await declareAttack({
    label: fixture.npcName,
    page,
    source: (options) => options.find((option) => /Broad sword/.test(option.label))!.value,
    target: fixture.heroName,
  });
  return fixture;
}

test.describe("#1103 an armed generated NPC defends after a hit", () => {
  test.use({ storageState: "e2e/.auth/gm.json" });

  test("the GM commits the NPC's defence review with its weapon Parry and the round continues", async ({
    page,
  }) => {
    test.setTimeout(1_200_000);
    // An attack roll can miss, and then no defence review is due. Each attempt is a fresh round.
    let fixture: RoundFixture | undefined;
    for (let attempt = 0; attempt < 12 && !fixture; attempt += 1) {
      const candidate = await setupArmedNpcRound(page, `${Date.now()}-${attempt}`);
      const walk = await walkUntil({
        done: (state) => state.roundNumber >= 2 || npcDefenseDue(state, candidate.npcCombatantId),
        fixture: candidate,
        page,
      });
      // A stale-revision 409 from the walker racing a re-render is retried by the walk itself; a
      // defence-source refusal is the #1103 failure.
      expect(walk.refused.join("\n")).not.toMatch(/Defense sources changed/);
      const state = (await readEncounter(page.request, candidate.encounterId)).combatRoundState;
      console.log(`[1103] attempt ${attempt}: ${walk.walked.join(" | ")}`);
      if (npcDefenseDue(state, candidate.npcCombatantId)) fixture = candidate;
    }
    expect(fixture, "the Character's attack connected with the NPC").toBeTruthy();
    const round = fixture!;

    await openCombat(page, round);
    await page
      .getByRole("button", { name: /^(Resume )?[Cc]urrent task$/ })
      .first()
      .click();
    const choices = page.getByLabel("Defense review choices").first();
    await expect(choices).toContainText("Broad sword");
    await expect(choices).not.toContainText("No shield or weapon defense source");
    await page.screenshot({ fullPage: true, path: `${SHOTS}/01-npc-defense-review.png` });

    const committed = await clickCommit(page);
    expect(committed.status, committed.body).toBe(200);
    expect(committed.request?.sourceSelections).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ included: true, itemId: expect.stringMatching(/:gear:1$/) }),
      ]),
    );
    const afterCommit = (await readEncounter(page.request, round.encounterId)).combatRoundState;
    expect(npcDefenseDue(afterCommit, round.npcCombatantId)).toBe(false);
    await page.screenshot({ fullPage: true, path: `${SHOTS}/02-npc-defense-committed.png` });

    const rest = await walkUntil({
      done: (state) => state.roundNumber >= 2,
      fixture: round,
      maxSteps: 80,
      page,
    });
    expect(rest.refused.join("\n")).not.toMatch(/Defense sources changed/);
    expect(rest.reached, rest.walked.join(" | ")).toBe(true);
    await page.screenshot({ fullPage: true, path: `${SHOTS}/03-round-2.png` });
  });
});
