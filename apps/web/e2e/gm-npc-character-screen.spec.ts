import { writeFileSync } from "node:fs";

import {
  expect,
  test,
  type APIRequestContext,
  type BrowserContext,
  type Locator,
  type Page,
} from "@playwright/test";

import { characterPayload } from "./character-fixture";
import { API_URL } from "./targets";

/**
 * Forgejo #1118 — the GM reviews a generated NPC on the Encounter Character screen.
 *
 * The GM's Character selector lists the generated NPC next to the Character. Selecting it shows the
 * NPC's Physical state panel (location hit points, combat effects) from its Scenario participant,
 * with no loadout or equipment section, and the GM adds a combat effect that persists and reaches
 * the GM Combat tab. The Character's view, and the Player combat selectors, are unchanged.
 *
 * Privacy: a player in the same Scenario is offered no NPC on the Character screen, and none of the
 * NPC's state reaches the player's network responses on the Character and Player combat pages. The
 * player's normalized responses are written to the test output so a baseline run can be compared.
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

type Entity = { id: string; name: string; snapshot: Record<string, unknown> };
type Participant = {
  id: string;
  snapshot: { displayName: string };
  state: {
    combatEffects?: {
      effects: Array<{ damage?: number; id: string; location?: string }>;
      events: Array<{ description?: string; id: string }>;
    };
  };
};

interface Fixture {
  campaignId: string;
  encounterId: string;
  heroCharacterId: string;
  heroName: string;
  heroScenarioParticipantId: string;
  npcEntityId: string;
  npcName: string;
  npcScenarioParticipantId: string;
  scenarioId: string;
  templateId: string;
}

async function json<T>(response: Awaited<ReturnType<APIRequestContext["get"]>>): Promise<T> {
  if (!response.ok()) {
    throw new Error(`${response.status()} ${await response.text()}`);
  }
  return response.json() as Promise<T>;
}

async function post<T>(request: APIRequestContext, endpoint: string, data: unknown = {}) {
  return json<T>(await request.post(`${API_URL}${endpoint}`, { data }));
}

async function readParticipants(request: APIRequestContext, scenarioId: string) {
  const { participants } = await json<{ participants: Participant[] }>(
    await request.get(`${API_URL}/scenarios/${scenarioId}/participants`),
  );
  return participants;
}

/**
 * A generated NPC (from a Template, saved to the roster, added to the Scenario) and a Character in
 * an active Encounter. The Character belongs to `heroRequest`'s account.
 */
async function buildFixture(input: {
  gmPage: Page;
  heroRequest: APIRequestContext;
  suffix: string;
}): Promise<Fixture> {
  const { gmPage: page, heroRequest, suffix } = input;
  const { template } = await post<{ template: Entity }>(page.request, "/templates", {
    kind: "npc",
    name: `Issue 1118 garrison ${suffix}`,
    snapshot: TEMPLATE_SNAPSHOT,
  });
  const { campaign } = await post<{ campaign: { id: string } }>(page.request, "/campaigns", {
    name: `Issue 1118 ${suffix}`,
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
  const { entities } = await json<{ entities: Entity[] }>(
    await page.request.get(`${API_URL}/campaigns/${campaignId}/entities`),
  );
  const npc = entities.find((entity) => entity.snapshot?.actorClass === "campaign_npc");
  expect(npc, "the generated NPC is on the campaign roster").toBeTruthy();

  const { user: heroUser } = await json<{ user: { id: string } }>(
    await heroRequest.get(`${API_URL}/auth/me`),
  );
  const heroCharacterId = `issue-1118-hero-${suffix}`;
  const heroName = `Mr Thug ${suffix}`;
  await json(
    await heroRequest.post(`${API_URL}/characters`, {
      data: characterPayload(heroCharacterId, heroName),
    }),
  );
  await post(page.request, `/campaigns/${campaignId}/roster`, {
    category: "pc",
    sourceId: heroCharacterId,
    sourceType: "character",
  });
  const { scenario } = await post<{ scenario: { id: string } }>(
    page.request,
    `/campaigns/${campaignId}/scenarios`,
    { name: `Issue 1118 Scenario ${suffix}`, status: "live" },
  );
  const scenarioId = scenario.id;
  const { participant: heroParticipant } = await post<{ participant: { id: string } }>(
    page.request,
    `/scenarios/${scenarioId}/participants/character`,
    { characterId: heroCharacterId, controlledByUserId: heroUser.id },
  );
  await post(
    page.request,
    `/scenarios/${scenarioId}/participants/${heroParticipant.id}/refresh-character-equipment`,
  );

  await page.goto(`/campaigns/${campaignId}/scenarios/${scenarioId}`);
  await page.getByLabel(`Toggle ${npc!.name} scenario participation`).click();
  await expect(page.getByText(`Added ${npc!.name} to the scenario.`).first()).toBeVisible();
  const npcScenarioParticipantId = (await readParticipants(page.request, scenarioId)).find(
    (participant) => participant.snapshot.displayName === npc!.name,
  )!.id;

  const now = new Date().toISOString();
  const created = await post<{ encounter: { id: string } }>(
    page.request,
    `/scenarios/${scenarioId}/encounters`,
    {
      session: {
        campaignId,
        createdAt: now,
        currentRound: 1,
        id: `issue-1118-encounter-${suffix}`,
        kind: "combat",
        participantMembershipMode: "explicit",
        participants: [
          {
            id: `issue-1118-npc-c-${suffix}`,
            label: npc!.name,
            participantType: "scenario",
            scenarioParticipantId: npcScenarioParticipantId,
          },
          {
            characterId: heroCharacterId,
            id: `issue-1118-hero-c-${suffix}`,
            label: heroName,
            participantType: "scenario",
            scenarioParticipantId: heroParticipant.id,
          },
        ],
        scenarioId,
        status: "active",
        title: `Issue 1118 battle ${suffix}`,
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
    heroCharacterId,
    heroName,
    heroScenarioParticipantId: heroParticipant.id,
    npcEntityId: npc!.id,
    npcName: npc!.name,
    npcScenarioParticipantId,
    scenarioId,
    templateId: template.id,
  };
}

function workspaceUrl(fixture: Fixture, tab: string, participantId?: string): string {
  const participant = participantId ? `&participantId=${participantId}` : "";
  return `/campaigns/${fixture.campaignId}?scenarioId=${fixture.scenarioId}&encounterId=${fixture.encounterId}&tab=${tab}${participant}`;
}

async function readSelectOptions(page: Page): Promise<string[][]> {
  return page
    .locator("select")
    .evaluateAll((selects) =>
      selects.map((select) =>
        Array.from((select as HTMLSelectElement).options).map(
          (option) => option.textContent?.trim() ?? "",
        ),
      ),
    );
}

/** The damage column of one row in the Hitpoints and damage table. */
function hitpointsRow(scope: Locator, label: string): Locator {
  return scope
    .locator("section")
    .filter({ has: scope.page().getByRole("heading", { name: "Hitpoints and damage" }) })
    .locator("tr")
    .filter({ has: scope.page().getByRole("cell", { exact: true, name: label }) });
}

test.describe("#1118 the GM reviews a generated NPC on the Character screen", () => {
  test.use({ storageState: "e2e/.auth/gm.json", viewport: { height: 900, width: 1280 } });

  test("the GM selects the NPC, sees its location hit points and adds a persistent combat effect", async ({
    page,
  }) => {
    test.setTimeout(240_000);
    const suffix = `${Date.now()}`;
    const fixture = await buildFixture({ gmPage: page, heroRequest: page.request, suffix });

    await page.goto(workspaceUrl(fixture, "character"));
    const selector = page.getByRole("combobox", { exact: true, name: "Character" });
    await expect(selector).toBeVisible({ timeout: 30_000 });
    await expect(selector.locator("option")).toHaveText([fixture.npcName, fixture.heroName]);

    // The Character is unchanged: Physical state plus its loadout and ammunition sections.
    await selector.selectOption({ label: fixture.heroName });
    await expect(
      page.getByRole("heading", { name: `Character — ${fixture.heroName}` }),
    ).toBeVisible();
    await expect(page.getByRole("heading", { name: "Hitpoints and damage" })).toBeVisible();
    await expect(page.getByRole("region", { name: "Active ammunition" })).toBeVisible();
    await expect(page.getByTestId("character-npc-physical-state")).toHaveCount(0);

    // The NPC: its Physical state from the Scenario participant, and no loadout or equipment.
    await selector.selectOption({ label: fixture.npcName });
    await expect(
      page.getByRole("heading", { name: `Character — ${fixture.npcName}` }),
    ).toBeVisible();
    const npcState = page.getByTestId("character-npc-physical-state");
    await expect(npcState.getByRole("heading", { name: "Hitpoints and damage" })).toBeVisible();
    await expect(npcState.getByRole("heading", { name: "Combat effects by sum" })).toBeVisible();
    await expect(hitpointsRow(npcState, "Chest/back").locator("td").nth(2)).toHaveText("0");
    await expect(page.getByRole("region", { name: "Active ammunition" })).toHaveCount(0);
    await expect(page.getByText("Loading loadout...")).toHaveCount(0);

    // The GM adds 3 damage on the chest.
    await npcState.getByRole("checkbox", { exact: true, name: "Chest/back" }).check();
    await npcState.getByLabel("Dam").fill("3");
    await npcState.getByLabel("Description").fill(`Spear thrust ${suffix}`);
    await npcState.getByRole("button", { exact: true, name: "Save" }).click();
    await expect(hitpointsRow(npcState, "Chest/back").locator("td").nth(2)).toHaveText("3");

    const persisted = (await readParticipants(page.request, fixture.scenarioId)).find(
      (participant) => participant.id === fixture.npcScenarioParticipantId,
    )!;
    expect(persisted.state.combatEffects?.effects).toEqual([
      expect.objectContaining({ damage: 3, location: "chestBack" }),
    ]);
    expect(persisted.state.combatEffects?.events).toEqual([
      expect.objectContaining({ description: `Spear thrust ${suffix}` }),
    ]);
    const hero = (await readParticipants(page.request, fixture.scenarioId)).find(
      (participant) => participant.id === fixture.heroScenarioParticipantId,
    )!;
    expect(hero.state.combatEffects?.effects ?? []).toEqual([]);

    // It persists after a reload.
    await page.reload();
    await expect(
      hitpointsRow(page.getByTestId("character-npc-physical-state"), "Chest/back")
        .locator("td")
        .nth(2),
    ).toHaveText("3", { timeout: 30_000 });
    await page.screenshot({
      fullPage: true,
      path: test.info().outputPath("gm-npc-character-screen.png"),
    });
    const npcEffectsLog = page
      .getByTestId("character-npc-physical-state")
      .getByRole("heading", { exact: true, name: "Combat effects" });
    await npcEffectsLog.scrollIntoViewIfNeeded();
    await expect(page.getByText("No combat effects recorded.")).toHaveCount(0);
    await page.screenshot({ path: test.info().outputPath("gm-npc-combat-effects-log.png") });

    // The GM Combat tab shows it on the NPC.
    await page.goto(workspaceUrl(fixture, "combat"));
    const inspector = page.getByRole("heading", { name: /^Combat inspector — / });
    await expect(inspector).toBeVisible({ timeout: 30_000 });
    // Inspect the NPC through its tracker cell.
    await page
      .getByRole("button", { name: new RegExp(`^${fixture.npcName} · Round 1 · DE:`) })
      .click();
    await expect(inspector).toContainText(fixture.npcName, { timeout: 20_000 });
    const combatText = (await page.locator("main").innerText()).replace(/\s+/g, " ");
    writeFileSync(test.info().outputPath("gm-combat-npc.txt"), combatText);
    await page.screenshot({ fullPage: true, path: test.info().outputPath("gm-combat-npc.png") });
    expect(combatText).toContain(`Manual · Physical · Spear thrust ${suffix} 3 HP`);

    // The GM's Player combat selector is unchanged: the Character only.
    await page.goto(workspaceUrl(fixture, "player-combat"));
    const playerCombatSelector = page.getByRole("combobox", { exact: true, name: "Character" });
    await expect(playerCombatSelector).toBeVisible({ timeout: 30_000 });
    await expect(playerCombatSelector.locator("option")).toHaveText([fixture.heroName]);
  });
});

test.describe("#1118 privacy: a player sees no NPC state", () => {
  test.use({ storageState: "e2e/.auth/gm.json", viewport: { height: 900, width: 1280 } });

  test("the player's Character and Player combat pages carry no NPC selector or NPC state", async ({
    browser,
    page: gmPage,
  }) => {
    test.setTimeout(240_000);
    const suffix = `${Date.now()}`;
    const playerContext: BrowserContext = await browser.newContext({
      storageState: "e2e/.auth/player.json",
      viewport: { height: 900, width: 1280 },
    });
    const fixture = await buildFixture({
      gmPage,
      heroRequest: playerContext.request,
      suffix,
    });
    const { user: gmUser } = await json<{ user: { id: string } }>(
      await gmPage.request.get(`${API_URL}/auth/me`),
    );
    const { user: playerUser } = await json<{ user: { id: string } }>(
      await playerContext.request.get(`${API_URL}/auth/me`),
    );

    // The GM gives the NPC a distinctive combat effect through the participant-state route.
    const secret = `NPC-secret-wound-${suffix}`;
    const npc = (await readParticipants(gmPage.request, fixture.scenarioId)).find(
      (participant) => participant.id === fixture.npcScenarioParticipantId,
    )!;
    const now = new Date().toISOString();
    const effectId = `issue-1118-effect-${suffix}`;
    const eventId = `issue-1118-event-${suffix}`;
    await json(
      await gmPage.request.put(
        `${API_URL}/scenarios/${fixture.scenarioId}/participants/${npc.id}/state`,
        {
          data: {
            state: {
              ...npc.state,
              combatEffects: {
                effects: [
                  {
                    createdAt: now,
                    damage: 7,
                    effectGroup: "none",
                    generalDamage: 0,
                    id: effectId,
                    location: "chestBack",
                    sourceEventId: eventId,
                    status: "active",
                    targetParticipantId: npc.id,
                    type: "physical_damage",
                    updatedAt: now,
                  },
                ],
                events: [
                  {
                    createdAt: now,
                    description: secret,
                    id: eventId,
                    sourceLabel: secret,
                    sourceType: "manual",
                    targetParticipantId: npc.id,
                  },
                ],
              },
            },
          },
        },
      ),
    );

    const playerPage = await playerContext.newPage();
    const captured: Array<{ body: string; method: string; page: string; url: string }> = [];
    let currentPage = "";
    playerPage.on("response", async (response) => {
      const contentType = response.headers()["content-type"] ?? "";
      if (!/json|text\/x-component|text\/html/.test(contentType)) {
        return;
      }
      try {
        captured.push({
          body: await response.text(),
          method: response.request().method(),
          page: currentPage,
          url: response.url(),
        });
      } catch {
        // A redirect or aborted response has no body.
      }
    });

    const selectsByPage: Record<string, string[][]> = {};
    for (const tab of ["character", "player-combat"]) {
      currentPage = tab;
      await playerPage.goto(workspaceUrl(fixture, tab, fixture.npcScenarioParticipantId));
      await expect(playerPage.getByText(fixture.heroName).first()).toBeVisible({
        timeout: 30_000,
      });
      await playerPage.waitForTimeout(4000);
      selectsByPage[tab] = await readSelectOptions(playerPage);
      await playerPage.screenshot({
        fullPage: true,
        path: test.info().outputPath(`player-${tab}.png`),
      });
    }

    // No participant selector is offered to the player, and the Character screen offers no NPC.
    await playerPage.goto(workspaceUrl(fixture, "character"));
    await expect(playerPage.getByText(fixture.heroName).first()).toBeVisible({ timeout: 30_000 });
    await expect(playerPage.getByRole("combobox", { exact: true, name: "Character" })).toHaveCount(
      0,
    );
    for (const options of selectsByPage.character ?? []) {
      expect(options).not.toContain(fixture.npcName);
    }

    // None of the NPC's state reaches the player.
    expect(captured.length).toBeGreaterThan(0);
    for (const response of captured) {
      expect(response.body, `${response.method} ${response.url}`).not.toContain(secret);
      expect(response.body, `${response.method} ${response.url}`).not.toContain(effectId);
      expect(response.body, `${response.method} ${response.url}`).not.toContain(eventId);
    }

    // Normalized for a baseline comparison: ids, timestamps and revisions are replaced.
    const replacements: Array<[string, string]> = [
      [fixture.npcScenarioParticipantId, "<npc-participant>"],
      [fixture.heroScenarioParticipantId, "<hero-participant>"],
      [fixture.heroCharacterId, "<hero-character>"],
      [fixture.npcEntityId, "<npc-entity>"],
      [fixture.encounterId, "<encounter>"],
      [fixture.scenarioId, "<scenario>"],
      [fixture.campaignId, "<campaign>"],
      [fixture.templateId, "<template>"],
      [fixture.npcName, "<npc-name>"],
      [gmUser.id, "<gm-user>"],
      [playerUser.id, "<player-user>"],
      [suffix, "<suffix>"],
    ];
    function normalize(text: string): string {
      let next = text;
      for (const [from, to] of replacements) {
        next = next.split(from).join(to);
      }
      return next
        .replace(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z/g, "<ts>")
        .replace(/"(revision|expectedRevision|version|etag)":\s*("[^"]*"|\d+)/gi, '"$1":"<rev>"')
        .replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, "<uuid>");
    }
    const apiResponses: Record<string, string[]> = {};
    for (const response of captured) {
      if (!response.url.startsWith(API_URL)) {
        continue;
      }
      const key = `${response.page} ${response.method} ${normalize(response.url.slice(API_URL.length))}`;
      const body = normalize(response.body);
      apiResponses[key] = [...new Set([...(apiResponses[key] ?? []), body])].sort();
    }
    writeFileSync(
      test.info().outputPath("player-responses.normalized.json"),
      JSON.stringify(
        {
          apiResponses: Object.fromEntries(Object.entries(apiResponses).sort()),
          selectsByPage: JSON.parse(normalize(JSON.stringify(selectsByPage))),
        },
        null,
        2,
      ),
    );

    await playerContext.close();
  });
});
