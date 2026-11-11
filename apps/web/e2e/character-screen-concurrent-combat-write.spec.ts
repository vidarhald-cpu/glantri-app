import { writeFileSync } from "node:fs";

import {
  expect,
  test,
  type APIRequestContext,
  type APIResponse,
  type Locator,
  type Page,
} from "@playwright/test";

import { characterPayload } from "./character-fixture";
import { API_URL } from "./targets";

/**
 * Forgejo #1126 — a GM save on the Character screen must never silently discard a combat write
 * that landed while the screen was open.
 *
 * The screen sends the GM's edit as a change (add effect, remove effect id, edit effect id); the
 * server applies it to the participant's state as stored. The race test opens the Character
 * screen for a generated NPC and for a Character, lets real combat (Combat Experience rolls
 * through the GM's round-manager routes) add an effect to both, then adds an effect on the NPC's
 * screen and removes one on the Character's. Both combat effects must survive.
 *
 * The other tests hold the ordinary add / edit / delete results and the paused-Scenario message
 * for a PC and an NPC, and the refusal of an edit to an effect that changed meanwhile.
 */

const STATS = {
  cha: 10,
  com: 10,
  con: 10,
  dex: 10,
  health: 10,
  int: 10,
  lck: 10,
  pow: 10,
  siz: 10,
  str: 10,
  will: 10,
};
const TEMPLATE_SNAPSHOT = {
  actorClass: "template",
  archetypeType: "humanoid_npc",
  equipmentProfile: "Broad sword and shield",
  humanoidNpcArchetype: {
    gear: {
      templateIds: ["weapon-template-broad-sword", "shield-template-medium-metal-shield"],
      templateNames: ["Broad sword", "Medium metal shield"],
    },
    generationHints: {
      competencyBands: [
        { label: "unskilled", max: 0, min: 0 },
        { label: "basic", max: 5, min: 1 },
        { label: "under_training", max: 10, min: 6 },
        { label: "fully_trained", max: 15, min: 11 },
        { label: "veteran", max: 19, min: 16 },
        { label: "expert", max: 99, min: 20 },
      ],
      suitabilityScale: [
        { bonus: 0, label: "ordinary" },
        { bonus: 1, label: "suitable" },
        { bonus: 2, label: "gifted" },
      ],
    },
    profession: {
      familyId: "military_security",
      familyName: "Military / Security",
      id: "city_watch_officer",
      name: "City Watch Officer",
    },
    schemaVersion: 1,
    seniority: "fully_trained",
    skillGroupIds: ["basic_melee_training", "defensive_soldiering"],
    skills: ["one_handed_edged", "brawling", "combat_experience", "dodge", "parry"].map(
      (skillId) => ({ skillId, skillName: skillId, targetLevel: 10 }),
    ),
    society: {
      societyId: "classical_polis_city_state",
      societyName: "Classical polis / city-state civilization",
    },
    stats: { base: STATS, final: STATS },
    variability: { skillVariance: 2, statVariance: 1 },
  },
  profession: "City Watch Officer",
  roleLabel: "Garrison Soldier",
  templateKind: "humanoid_npc_archetype",
};
/** Far above the table's own difficulty, so every Combat Experience roll leaves an effect row. */
const COMBAT_EXPERIENCE_DIFFICULTY = 90;
const CHANGED_MEANWHILE =
  "This combatant changed meanwhile; the screen has been refreshed, please apply your change again.";

type Effect = {
  damage?: number;
  description?: string;
  id: string;
  location?: string;
  modifierValue?: number;
  sourceEventId: string;
  type: string;
};
type EffectEvent = { description?: string; id: string; sourceLabel?: string; sourceType?: string };
type Participant = {
  id: string;
  snapshot: { displayName: string };
  state: Record<string, unknown> & {
    combatEffects?: { effects: Effect[]; events: EffectEvent[] };
  };
  updatedAt: string;
};

interface Fixture {
  campaignId: string;
  encounterId: string;
  encounterRows: Array<{ id: string; scenarioParticipantId: string }>;
  heroName: string;
  heroId: string;
  npcName: string;
  npcId: string;
  scenarioId: string;
}

async function json<T>(response: APIResponse): Promise<T> {
  if (!response.ok()) {
    throw new Error(`${response.status()} ${await response.text()}`);
  }
  return response.json() as Promise<T>;
}

async function post<T>(request: APIRequestContext, endpoint: string, data: unknown = {}) {
  return json<T>(await request.post(`${API_URL}${endpoint}`, { data }));
}

async function readParticipant(request: APIRequestContext, scenarioId: string, id: string) {
  const { participants } = await json<{ participants: Participant[] }>(
    await request.get(`${API_URL}/scenarios/${scenarioId}/participants`),
  );
  return participants.find((participant) => participant.id === id)!;
}

/** A generated NPC and a Character (owned by the GM account) in an active Encounter. */
async function buildFixture(page: Page, suffix: string): Promise<Fixture> {
  const { template } = await post<{ template: { id: string } }>(page.request, "/templates", {
    kind: "npc",
    name: `Issue 1126 garrison ${suffix}`,
    snapshot: TEMPLATE_SNAPSHOT,
  });
  const { campaign } = await post<{ campaign: { id: string } }>(page.request, "/campaigns", {
    name: `Issue 1126 ${suffix}`,
    status: "active",
  });
  const campaignId = campaign.id;

  await page.goto("/templates");
  await page.getByRole("button", { name: "Generate NPC" }).first().click();
  await page.getByLabel("Template").selectOption(template.id);
  await page.getByRole("button", { name: /^Generate$/ }).click();
  await expect(page.getByText(/^Generated .+ from /)).toBeVisible();
  await page.getByLabel("Campaign roster").selectOption(campaignId);
  await page.getByRole("button", { name: "Save NPC to roster" }).click();
  await expect(page.getByText(/^Saved .+ as one reusable NPC on the /)).toBeVisible();
  const { entities } = await json<{
    entities: Array<{ name: string; snapshot?: { actorClass?: string } }>;
  }>(await page.request.get(`${API_URL}/campaigns/${campaignId}/entities`));
  const npc = entities.find((entity) => entity.snapshot?.actorClass === "campaign_npc")!;
  expect(npc, "the generated NPC is on the campaign roster").toBeTruthy();

  const { user } = await json<{ user: { id: string } }>(
    await page.request.get(`${API_URL}/auth/me`),
  );
  const heroCharacterId = `issue-1126-hero-${suffix}`;
  const heroName = `Mr Thug ${suffix}`;
  await post(page.request, "/characters", characterPayload(heroCharacterId, heroName));
  await post(page.request, `/campaigns/${campaignId}/roster`, {
    category: "pc",
    sourceId: heroCharacterId,
    sourceType: "character",
  });
  const { scenario } = await post<{ scenario: { id: string } }>(
    page.request,
    `/campaigns/${campaignId}/scenarios`,
    { name: `Issue 1126 Scenario ${suffix}`, status: "live" },
  );
  const scenarioId = scenario.id;
  const { participant: hero } = await post<{ participant: { id: string } }>(
    page.request,
    `/scenarios/${scenarioId}/participants/character`,
    { characterId: heroCharacterId, controlledByUserId: user.id },
  );
  await post(
    page.request,
    `/scenarios/${scenarioId}/participants/${hero.id}/refresh-character-equipment`,
  );

  await page.goto(`/campaigns/${campaignId}/scenarios/${scenarioId}`);
  await page.getByLabel(`Toggle ${npc.name} scenario participation`).click();
  await expect(page.getByText(`Added ${npc.name} to the scenario.`).first()).toBeVisible();
  const { participants } = await json<{ participants: Participant[] }>(
    await page.request.get(`${API_URL}/scenarios/${scenarioId}/participants`),
  );
  const npcId = participants.find((entry) => entry.snapshot.displayName === npc.name)!.id;

  const now = new Date().toISOString();
  const encounterRows = [
    { id: `issue-1126-npc-c-${suffix}`, label: npc.name, scenarioParticipantId: npcId },
    {
      characterId: heroCharacterId,
      id: `issue-1126-hero-c-${suffix}`,
      label: heroName,
      scenarioParticipantId: hero.id,
    },
  ];
  const created = await post<{ encounter: { id: string } }>(
    page.request,
    `/scenarios/${scenarioId}/encounters`,
    {
      session: {
        campaignId,
        createdAt: now,
        currentRound: 1,
        id: `issue-1126-encounter-${suffix}`,
        kind: "combat",
        participantMembershipMode: "explicit",
        participants: encounterRows.map((row) => ({ ...row, participantType: "scenario" })),
        scenarioId,
        status: "draft",
        title: `Issue 1126 battle ${suffix}`,
        updatedAt: now,
      },
    },
  );
  const encounterId = created.encounter.id;
  const { encounter } = await json<{ encounter: { updatedAt: string } }>(
    await page.request.get(`${API_URL}/encounters/${encounterId}`),
  );
  await json(
    await page.request.patch(`${API_URL}/encounters/${encounterId}/status`, {
      data: { expectedRevision: encounter.updatedAt, status: "active" },
    }),
  );

  return {
    campaignId,
    encounterId,
    encounterRows,
    heroId: hero.id,
    heroName,
    npcId,
    npcName: npc.name,
    scenarioId,
  };
}

function characterScreenUrl(fixture: Fixture, participantId: string): string {
  return `/campaigns/${fixture.campaignId}?scenarioId=${fixture.scenarioId}&encounterId=${fixture.encounterId}&tab=character&participantId=${participantId}`;
}

/**
 * Rolls every Combat Experience check due at the start of the round through the routes the GM's
 * round manager uses, and returns the scenario participants it rolled for.
 */
async function rollDueCombatExperience(request: APIRequestContext, fixture: Fixture) {
  const rolledFor: string[] = [];
  for (let attempt = 0; attempt < 8; attempt++) {
    const { encounter } = await json<{ encounter: { updatedAt: string } }>(
      await request.get(`${API_URL}/encounters/${fixture.encounterId}`),
    );
    const probe = await request.post(
      `${API_URL}/encounters/${fixture.encounterId}/combat-round/advance-deterministic`,
      {
        data: {
          executionGroupId: "issue1126",
          expectedRevision: encounter.updatedAt,
          taskId: "issue1126",
        },
      },
    );
    const task = (
      (await probe.json()) as {
        actualTask?: { executionGroupId: string; kind: string; taskId: string };
      }
    ).actualTask;
    if (task?.kind !== "combat_experience") {
      break;
    }
    if (task.taskId.includes(":stage:difficulty:")) {
      await post(
        request,
        `/encounters/${fixture.encounterId}/combat-round/combat-experience-difficulty`,
        {
          difficulty: COMBAT_EXPERIENCE_DIFFICULTY,
          executionGroupId: task.executionGroupId,
          expectedRevision: encounter.updatedAt,
          taskId: task.taskId,
        },
      );
      continue;
    }
    const encounterParticipantId = task.taskId.slice(task.taskId.lastIndexOf(":") + 1);
    const row = fixture.encounterRows.find((candidate) => candidate.id === encounterParticipantId)!;
    await post(request, `/encounters/${fixture.encounterId}/combat-round/roll-combat-experience`, {
      difficulty: COMBAT_EXPERIENCE_DIFFICULTY,
      executionGroupId: task.executionGroupId,
      expectedRevision: encounter.updatedAt,
      scenarioParticipantId: row.scenarioParticipantId,
      taskId: task.taskId,
    });
    rolledFor.push(row.scenarioParticipantId);
  }
  return rolledFor;
}

function combatExperienceEffects(participant: Participant): Effect[] {
  const events = participant.state.combatEffects?.events ?? [];
  return (participant.state.combatEffects?.effects ?? []).filter((effect) =>
    events.some(
      (event) => event.id === effect.sourceEventId && event.sourceLabel === "Combat Experience",
    ),
  );
}

/** The Combat effects log of one Physical state panel. */
function logRows(scope: Locator): Locator {
  return scope
    .locator("section")
    .filter({ has: scope.page().getByRole("heading", { exact: true, name: "Combat effects" }) })
    .last()
    .locator("tbody tr");
}

/** The damage column of one location in the Hitpoints and damage table. */
function hitpointsDamage(scope: Locator, label: string): Locator {
  return scope
    .locator("section")
    .filter({ has: scope.page().getByRole("heading", { name: "Hitpoints and damage" }) })
    .locator("tr")
    .filter({ has: scope.page().getByRole("cell", { exact: true, name: label }) })
    .locator("td")
    .nth(2);
}

async function addEffect(
  scope: Locator,
  options: {
    damage?: string;
    description: string;
    location?: string;
    modifier?: string;
    type?: string;
  },
) {
  await scope.getByRole("button", { exact: true, name: "Cancel" }).click();
  if (options.type) {
    await scope
      .locator("label")
      .filter({ has: scope.page().locator("span", { hasText: /^Type$/ }) })
      .locator("select")
      .selectOption({ label: options.type });
  }
  if (options.location) {
    await scope.getByRole("checkbox", { exact: true, name: options.location }).check();
  }
  if (options.damage !== undefined) {
    await scope.getByLabel("Dam", { exact: true }).fill(options.damage);
  }
  if (options.modifier !== undefined) {
    await scope.getByLabel("Mod", { exact: true }).fill(options.modifier);
  }
  await scope.getByLabel("Description", { exact: true }).fill(options.description);
  return clickAndAwaitStateSave(scope, "Save");
}

/** Clicks Save or Delete and returns the participant-state save the click sent. */
async function clickAndAwaitStateSave(scope: Locator, button: "Delete" | "Save") {
  const response = scope
    .page()
    .waitForResponse(
      (candidate) =>
        candidate.request().method() === "PUT" &&
        /\/participants\/[^/]+\/state$/.test(candidate.url()),
    );
  await scope.getByRole("button", { exact: true, name: button }).click();
  return response;
}

/** Opens the Character screen for one participant and waits for its Physical state panel. */
async function openCharacterScreen(page: Page, fixture: Fixture, participantId: string) {
  await page.goto(characterScreenUrl(fixture, participantId));
  const name = participantId === fixture.npcId ? fixture.npcName : fixture.heroName;
  await expect(page.getByRole("heading", { name: `Character — ${name}` })).toBeVisible({
    timeout: 30_000,
  });
  const scope =
    participantId === fixture.npcId
      ? page.getByTestId("character-npc-physical-state")
      : page.locator("main");
  await expect(scope.getByRole("heading", { name: "Hitpoints and damage" }).first()).toBeVisible({
    timeout: 30_000,
  });
  return scope;
}

test.describe("#1126 a Character-screen save keeps concurrent combat writes", () => {
  test.use({ storageState: "e2e/.auth/gm.json", viewport: { height: 900, width: 1280 } });

  test("combat adds an effect to an NPC and a Character while their screens are open; the GM's add and remove keep it", async ({
    context,
    page,
  }) => {
    test.setTimeout(300_000);
    const suffix = `${Date.now()}`;
    const fixture = await buildFixture(page, suffix);

    // The Character starts with a manual wound the GM will remove from the screen.
    const npcPage = page;
    const heroPage = await context.newPage();
    const npcScope = await openCharacterScreen(npcPage, fixture, fixture.npcId);
    const heroScope = await openCharacterScreen(heroPage, fixture, fixture.heroId);
    const seeded = await addEffect(heroScope, {
      damage: "2",
      description: `Old wound ${suffix}`,
      location: "Head",
    });
    expect(seeded.status()).toBe(200);
    const seededEffectId = (
      await readParticipant(page.request, fixture.scenarioId, fixture.heroId)
    ).state.combatEffects!.effects.find((effect) => effect.location === "head")!.id;

    // Real combat writes to both participants while both screens stay open.
    const rolledFor = await rollDueCombatExperience(page.request, fixture);
    expect(rolledFor.sort()).toEqual([fixture.heroId, fixture.npcId].sort());
    const npcCombat = combatExperienceEffects(
      await readParticipant(page.request, fixture.scenarioId, fixture.npcId),
    );
    const heroCombat = combatExperienceEffects(
      await readParticipant(page.request, fixture.scenarioId, fixture.heroId),
    );
    expect(npcCombat).toHaveLength(1);
    expect(heroCombat).toHaveLength(1);
    // Neither screen has reloaded: neither shows the combat write.
    await expect(logRows(npcScope).filter({ hasText: "combat exp" })).toHaveCount(0);
    await expect(logRows(heroScope)).toHaveCount(1);
    await expect(logRows(heroScope).filter({ hasText: "combat exp" })).toHaveCount(0);

    // NPC: the GM adds an effect.
    const npcSave = await addEffect(npcScope, {
      damage: "3",
      description: `Spear thrust ${suffix}`,
      location: "Chest/back",
    });
    expect(npcSave.status(), await npcSave.text()).toBe(200);
    const npcAfter = await readParticipant(page.request, fixture.scenarioId, fixture.npcId);
    // Soft, so a run where the NPC's combat write is lost still goes on to the Character's.
    expect
      .soft(
        npcAfter.state.combatEffects!.effects.map((effect) => effect.id),
        "the NPC's combat write survives the GM's save",
      )
      .toEqual(expect.arrayContaining([npcCombat[0]!.id]));
    expect(npcAfter.state.combatEffects!.effects).toEqual(
      expect.arrayContaining([expect.objectContaining({ damage: 3, location: "chestBack" })]),
    );
    expect.soft(npcAfter.state.combatEffects!.effects).toHaveLength(2);

    // Character: the GM removes the old wound, the one row its stale screen shows.
    await logRows(heroScope).first().click();
    const heroDelete = await clickAndAwaitStateSave(heroScope, "Delete");
    expect(heroDelete.status(), await heroDelete.text()).toBe(200);
    const heroAfter = await readParticipant(page.request, fixture.scenarioId, fixture.heroId);
    expect
      .soft(
        heroAfter.state.combatEffects!.effects.map((effect) => effect.id),
        "the Character's combat write survives the GM's removal",
      )
      .toEqual([heroCombat[0]!.id]);
    expect(heroAfter.state.combatEffects!.effects.map((effect) => effect.id)).not.toContain(
      seededEffectId,
    );

    // Both screens now show the combat write the save kept.
    await expect(logRows(npcScope)).toHaveCount(2);
    await expect(logRows(npcScope).filter({ hasText: "combat exp" })).toHaveCount(1);
    await expect(logRows(heroScope)).toHaveCount(1);
    await expect(logRows(heroScope).filter({ hasText: "combat exp" })).toHaveCount(1);
    await npcPage.screenshot({
      fullPage: true,
      path: test.info().outputPath("npc-after-race.png"),
    });
    await heroPage.screenshot({
      fullPage: true,
      path: test.info().outputPath("hero-after-race.png"),
    });
  });

  for (const who of ["Character", "NPC"] as const) {
    test(`ordinary ${who} effect add, edit and delete, and the paused-Scenario message`, async ({
      page,
    }) => {
      test.setTimeout(240_000);
      const suffix = `${Date.now()}`;
      const fixture = await buildFixture(page, suffix);
      const participantId = who === "NPC" ? fixture.npcId : fixture.heroId;
      const scope = await openCharacterScreen(page, fixture, participantId);
      // Each step's stored effects, without ids and timestamps, for a comparison with baseline.
      const record: Record<string, unknown> = {};
      const stored = async (step?: string) => {
        const effects = (await readParticipant(page.request, fixture.scenarioId, participantId))
          .state.combatEffects ?? { effects: [], events: [] };
        if (step) {
          const eventIndex = (id: string) => effects.events.findIndex((event) => event.id === id);
          record[step] = {
            effects: effects.effects.map((effect) => ({
              ...effect,
              canonicalLifecycle: undefined,
              createdAt: undefined,
              hasCanonicalLifecycle: Boolean(
                (effect as { canonicalLifecycle?: unknown }).canonicalLifecycle,
              ),
              id: undefined,
              sourceEventId: eventIndex(effect.sourceEventId),
              targetParticipantId: undefined,
              updatedAt: undefined,
            })),
            events: effects.events.map((event) => ({
              ...event,
              createdAt: undefined,
              description: event.description?.replace(suffix, "<suffix>"),
              encounterId: Boolean((event as { encounterId?: string }).encounterId),
              id: undefined,
              scenarioId: Boolean((event as { scenarioId?: string }).scenarioId),
              sourceLabel: event.sourceLabel?.replace(suffix, "<suffix>"),
              targetParticipantId: undefined,
            })),
          };
        }
        return effects;
      };

      // One event with an effect at each of two locations.
      await scope.getByRole("checkbox", { exact: true, name: "Chest/back" }).check();
      await scope.getByRole("checkbox", { exact: true, name: "Head" }).check();
      await scope.getByLabel("Dam", { exact: true }).fill("2");
      await scope.getByLabel("Description", { exact: true }).fill(`Two ${suffix}`);
      expect((await clickAndAwaitStateSave(scope, "Save")).status()).toBe(200);
      let effects = await stored("1-add-two-locations");
      expect(effects.effects.map((effect) => [effect.location, effect.damage])).toEqual([
        ["chestBack", 2],
        ["head", 2],
      ]);
      expect(effects.events).toHaveLength(1);
      expect(effects.effects[0]!.sourceEventId).toBe(effects.events[0]!.id);

      // A Fatigue effect, then edited from -1 to -3.
      expect(
        (
          await addEffect(scope, {
            description: `Fatigue ${suffix}`,
            modifier: "-1",
            type: "Fatigue",
          })
        ).status(),
      ).toBe(200);
      effects = await stored("2-add-fatigue");
      const fatigue = effects.effects.find((effect) => effect.type === "fatigue")!;
      expect(fatigue.modifierValue).toBe(-1);
      expect(effects.effects).toHaveLength(3);
      expect(effects.events).toHaveLength(2);

      await logRows(scope).filter({ hasText: "Fatigue" }).first().click();
      await scope.getByLabel("Mod", { exact: true }).fill("-3");
      const edit = await clickAndAwaitStateSave(scope, "Save");
      expect(edit.status(), await edit.text()).toBe(200);
      effects = await stored("3-edit-fatigue");
      expect(effects.effects.map((effect) => effect.id)).toEqual(
        expect.arrayContaining([fatigue.id]),
      );
      expect(effects.effects.find((effect) => effect.id === fatigue.id)!.modifierValue).toBe(-3);
      expect(effects.effects).toHaveLength(3);
      expect(effects.events).toHaveLength(2);

      await logRows(scope).filter({ hasText: "Fatigue" }).first().click();
      expect((await clickAndAwaitStateSave(scope, "Delete")).status()).toBe(200);
      effects = await stored("4-delete-fatigue");
      expect(effects.effects.map((effect) => effect.location)).toEqual(["chestBack", "head"]);
      await expect(page.getByText(CHANGED_MEANWHILE)).toHaveCount(0);

      // With the Scenario paused, a save shows the server's message and changes nothing.
      await json(
        await page.request.put(`${API_URL}/scenarios/${fixture.scenarioId}`, {
          data: { status: "paused" },
        }),
      );
      const refused = await addEffect(scope, {
        damage: "1",
        description: `Paused ${suffix}`,
        location: "Head",
      });
      expect(refused.status()).toBe(403);
      await expect(
        page.getByText("Scenario is not currently open for live updates."),
      ).toBeVisible();
      expect((await stored("5-paused")).effects).toHaveLength(2);
      writeFileSync(
        test.info().outputPath(`${who.toLowerCase()}-edits.normalized.json`),
        JSON.stringify(record, null, 2),
      );
    });
  }

  test("an edit of an effect that changed meanwhile is refused, the screen refreshes, and saving again applies it", async ({
    page,
  }) => {
    test.setTimeout(240_000);
    const suffix = `${Date.now()}`;
    const fixture = await buildFixture(page, suffix);
    const scope = await openCharacterScreen(page, fixture, fixture.npcId);
    expect(
      (
        await addEffect(scope, {
          damage: "3",
          description: `Cut ${suffix}`,
          location: "Chest/back",
        })
      ).status(),
    ).toBe(200);
    const loaded = await readParticipant(page.request, fixture.scenarioId, fixture.npcId);
    const cut = loaded.state.combatEffects!.effects[0]!;

    // Another writer changes that effect while the screen is open.
    await json(
      await page.request.put(
        `${API_URL}/scenarios/${fixture.scenarioId}/participants/${fixture.npcId}/state`,
        {
          data: {
            state: {
              ...loaded.state,
              combatEffects: {
                ...loaded.state.combatEffects,
                effects: [{ ...cut, damage: 5 }],
              },
            },
          },
        },
      ),
    );

    // The GM edits the stale copy: refused, nothing written, the screen shows the current damage.
    await expect(hitpointsDamage(scope, "Chest/back")).toHaveText("3");
    await logRows(scope).first().click();
    await scope.getByLabel("Dam", { exact: true }).fill("4");
    const refused = await clickAndAwaitStateSave(scope, "Save");
    expect(refused.status()).toBe(409);
    await expect(page.getByText(CHANGED_MEANWHILE)).toBeVisible();
    expect(
      (await readParticipant(page.request, fixture.scenarioId, fixture.npcId)).state.combatEffects!
        .effects[0]!.damage,
    ).toBe(5);
    await expect(hitpointsDamage(scope, "Chest/back")).toHaveText("5");

    // Saving again applies the GM's edit to the refreshed effect.
    const applied = await clickAndAwaitStateSave(scope, "Save");
    expect(applied.status(), await applied.text()).toBe(200);
    const after = await readParticipant(page.request, fixture.scenarioId, fixture.npcId);
    expect(after.state.combatEffects!.effects.map((effect) => [effect.id, effect.damage])).toEqual([
      [cut.id, 4],
    ]);
    await expect(page.getByText(CHANGED_MEANWHILE)).toHaveCount(0);
    await expect(hitpointsDamage(scope, "Chest/back")).toHaveText("4");
  });
});
