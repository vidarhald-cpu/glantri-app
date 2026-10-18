import { expect, test, type APIRequestContext, type Page } from "@playwright/test";
import {
  initializeCombatRoundState,
  rollCombatRoundCombatExperience,
  setCombatRoundCombatExperienceDifficulty,
  type CombatRoundState,
  type EncounterSession,
} from "@glantri/domain";

import { characterPayload } from "./character-fixture";
import { LANE694_STORAGE_STATE } from "./lane694-global-setup";

/**
 * #694 — a solo GM must be able to complete a whole round against the shipped seeded
 * *"Training Bandit"*: declaration, a connecting attack, the defence review, hit location, damage,
 * critical, committed damage, round complete, and into the next round.
 *
 * That walk used to stop one step after the attack connected. `commit-defense-review` returned
 * 400 *"Required defense context is unavailable. Refresh combat."* for **any** Template-derived
 * temporary actor, because the canonical calculation context demanded both a `characterId` and a
 * Character-sourced `equipmentState` — neither of which a temporary actor has, and by
 * `scenarioParticipantSnapshotSchema`'s `character_equipment_aggregate` provenance literal neither
 * of which it can ever acquire (#666). The same participant was therefore resolvable for the
 * attack step and unresolvable for the next one. #694 closes that asymmetry by resolving the
 * defence context from the build and recording Character-sourced equipment as **absent**.
 *
 * Nothing about the defender is authored here. The spec reads the seeded row and fails if it is
 * not the shipped seed, so it cannot pass against a hand-statted stand-in. It also asserts the
 * defender is genuinely Template-derived — no Character identity, no equipment state, no
 * equipment projection — so the capability under proof is the one the issue describes.
 *
 * The attacker is deliberately a very skilled brawler, exactly as #690's proof does it. That rank
 * is scaffolding so the attack connects on any die rather than on a lucky roll; it says nothing
 * about the seed and is not authored content.
 *
 * This spec needs a seeded database, so it runs under `playwright.lane694.config.ts` rather than
 * in the ordinary suite, whose account bootstrap is incompatible with a seeded game master.
 */
const API_URL = process.env.PLAYWRIGHT_API_URL ?? "http://127.0.0.1:4000";

const PUNCH_SOURCE_ID = "unarmed:virtual-weapon-template-punch";

const REFRESH_AND_RETRY = /review it before retrying|no longer current|Refresh combat/;

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

/** A Character whose Brawling is high enough that an unarmed attack connects on any die. */
function expertBrawlerPayload(id: string, name: string) {
  const payload = characterPayload(id, name);
  return {
    build: {
      ...payload.build,
      progression: {
        ...payload.build.progression,
        secondaryPoolTotal: 400,
        skills: [
          {
            category: "secondary",
            categoryId: "combat",
            groupId: "basic_melee_training",
            secondaryRanks: 60,
            skillId: "brawling",
          },
        ],
      },
    },
  };
}

async function readRoundState(input: {
  encounterId: string;
  request: APIRequestContext;
}): Promise<CombatRoundState> {
  const { encounter } = await json<{ encounter: { combatRoundState: CombatRoundState } }>(
    await input.request.get(`${API_URL}/encounters/${input.encounterId}`),
  );
  return encounter.combatRoundState;
}

async function selectGmInspectorParticipant(input: { label: string; page: Page }): Promise<void> {
  const heading = input.page.getByRole("heading", { name: /^Combat inspector — / });
  await expect(heading).toBeVisible();
  for (let attempt = 0; attempt < 10; attempt += 1) {
    if ((await heading.innerText()).includes(input.label)) return;
    await input.page.getByRole("button", { name: "Next participant" }).click();
  }
  throw new Error(`The GM inspector never reached ${input.label}.`);
}

/** Every enabled control on screen, so the GM workflow can be progressed step by step. */
async function enabledButtonNames(page: Page): Promise<string[]> {
  return page.getByRole("button").evaluateAll((nodes) =>
    nodes
      .filter((node) => !(node as HTMLButtonElement).disabled)
      .map((node) => (node.textContent ?? "").trim())
      .filter((label) => label.length > 0),
  );
}

interface AttackFixture {
  attackerName: string;
  campaignId: string;
  defenderName: string;
  encounterId: string;
  scenarioId: string;
}

/**
 * Builds the solo-GM fixture: one attacking Character and one temporary actor created from a
 * campaign Template through the real control, in an active encounter standing at declaration.
 */
async function buildAttackFixture(input: {
  defenderTemplateLabel: string;
  defenderName: string;
  page: Page;
  suffix: number;
}): Promise<AttackFixture> {
  const { page, suffix } = input;
  const attackerName = `Expert Brawler ${suffix}`;

  const { campaigns } = await json<{ campaigns: { id: string; name: string }[] }>(
    await page.request.get(`${API_URL}/campaigns`),
  );
  const campaign = campaigns.find((entry) => entry.name === "Local Dev Campaign");
  expect(campaign, "the local development seed's campaign must be present").toBeTruthy();
  const campaignId = campaign!.id;

  const { user } = await json<{ user: { id: string } }>(
    await page.request.get(`${API_URL}/auth/me`),
  );
  const characterId = `issue-694-brawler-${suffix}`;
  const createdCharacter = await page.request.post(`${API_URL}/characters`, {
    data: expertBrawlerPayload(characterId, attackerName),
  });
  expect(createdCharacter.ok(), await createdCharacter.text()).toBe(true);
  const equipment = await json<{ state: { revision: number } }>(
    await page.request.get(`${API_URL}/characters/${characterId}/equipment`),
  );
  // Unarmed: the attack resolves through the intrinsic Punch source and the Brawling competency.
  await post(page.request, `/characters/${characterId}/equipment/loadout/active-primary-weapon`, {
    expectedRevision: equipment.state.revision,
    itemId: null,
  });
  await post(page.request, `/campaigns/${campaignId}/roster`, {
    category: "pc",
    sourceId: characterId,
    sourceType: "character",
  });

  const scenario = await post<{ scenario: { id: string } }>(
    page.request,
    `/campaigns/${campaignId}/scenarios`,
    { name: `Issue 694 ${input.defenderName}`, status: "live" },
  );
  const scenarioId = scenario.scenario.id;
  const attackerParticipant = await post<{ participant: { id: string } }>(
    page.request,
    `/scenarios/${scenarioId}/participants/character`,
    { characterId, controlledByUserId: user.id },
  );
  await post(
    page.request,
    `/scenarios/${scenarioId}/participants/${attackerParticipant.participant.id}/refresh-character-equipment`,
  );

  // The defender is created the way a GM creates one: pick the Template, name the actor, create it.
  await page.goto(`/campaigns/${campaignId}/scenarios/${scenarioId}`);
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
  await templatePicker.selectOption({ label: input.defenderTemplateLabel });
  await page.getByPlaceholder("Temporary actor name override").fill(input.defenderName);
  await temporaryActorRole.selectOption("enemy");
  await createTemporaryActor.click();
  await expect(page.getByText(`Created temporary actor ${input.defenderName}.`)).toBeVisible();

  const participants = await json<{
    participants: {
      characterId?: string;
      id: string;
      snapshot: { displayName: string; equipmentProjection?: unknown; equipmentState?: unknown };
      sourceType: string;
    }[];
  }>(await page.request.get(`${API_URL}/scenarios/${scenarioId}/participants`));
  const defender = participants.participants.find(
    (entry) => entry.snapshot.displayName === input.defenderName,
  );
  expect(defender, `no scenario participant named ${input.defenderName}`).toBeTruthy();
  // Template-derived, with no Character identity and no committed equipment of any kind: the
  // defender really is a temporary actor off a Template, not a Character in disguise. This is the
  // exact participant shape #694 had to make the defence review reachable for.
  expect(defender!.sourceType).toBe("entity");
  expect(defender!.characterId).toBeFalsy();
  expect(defender!.snapshot.equipmentState).toBeFalsy();
  expect(defender!.snapshot.equipmentProjection).toBeFalsy();

  const attackerCombatantId = `issue-694-attacker-${suffix}`;
  const defenderCombatantId = `issue-694-defender-${suffix}`;
  const now = new Date().toISOString();
  const created = await post<{ encounter: EncounterSession }>(
    page.request,
    `/scenarios/${scenarioId}/encounters`,
    {
      session: {
        campaignId,
        createdAt: now,
        currentRound: 1,
        id: `issue-694-encounter-${suffix}`,
        kind: "combat",
        participantMembershipMode: "explicit",
        participants: [
          {
            characterId,
            id: attackerCombatantId,
            label: attackerName,
            participantType: "scenario",
            scenarioParticipantId: attackerParticipant.participant.id,
          },
          {
            id: defenderCombatantId,
            label: input.defenderName,
            participantType: "scenario",
            scenarioParticipantId: defender!.id,
          },
        ],
        scenarioId,
        status: "active",
        title: `Issue 694 Combat ${suffix}`,
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

  // Round 1 opens with a Combat Experience check that gates the declaration controls. Resolving it
  // is scaffolding, exactly as #690's and #666's evidence do it. The difficulty is deliberately
  // trivial: a failed check cancels the attack, and the subject here is the rest of the round.
  const activeEncounter = await json<{ encounter: EncounterSession }>(
    await page.request.get(`${API_URL}/encounters/${encounterId}`),
  );
  const combatRoundState = [attackerCombatantId, defenderCombatantId].reduce(
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

  return { attackerName, campaignId, defenderName: input.defenderName, encounterId, scenarioId };
}

/** Declares the Character's unarmed attack on the temporary actor, which passes. */
async function declareAttackAndPass(input: { fixture: AttackFixture; page: Page }): Promise<void> {
  const { fixture, page } = input;
  await page.goto(
    `/campaigns/${fixture.campaignId}?scenarioId=${fixture.scenarioId}&encounterId=${fixture.encounterId}&tab=combat`,
  );
  await selectGmInspectorParticipant({ label: fixture.attackerName, page });
  await page.getByRole("combobox", { name: "Action" }).first().selectOption("attack_parry");
  const sourceSelector = page.getByRole("combobox", { name: "Attack source" }).first();
  await expect(sourceSelector).toBeVisible();
  await sourceSelector.selectOption(PUNCH_SOURCE_ID);
  await page
    .getByRole("combobox", { name: "Target" })
    .first()
    .selectOption({ label: fixture.defenderName });
  const attackerDeclared = page.waitForResponse(
    (response) =>
      response.request().method() === "POST" && response.url().includes("/combat-declaration"),
  );
  await page.getByRole("button", { name: "Declare action" }).first().click();
  expect((await attackerDeclared).ok()).toBe(true);

  await selectGmInspectorParticipant({ label: fixture.defenderName, page });
  await page.getByRole("combobox", { name: "Action" }).first().selectOption("pass");
  const defenderDeclared = page.waitForResponse(
    (response) =>
      response.request().method() === "POST" && response.url().includes("/combat-declaration"),
  );
  await page.getByRole("button", { name: "Declare action" }).first().click();
  expect((await defenderDeclared).ok()).toBe(true);

  // Bounded poll rather than an open wait, so a round that does not progress ends the walk
  // instead of hanging.
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const state = await readRoundState({ encounterId: fixture.encounterId, request: page.request });
    if (state.currentStep !== "select_actions") return;
    await page.waitForTimeout(1000);
  }
  throw new Error("The round never left Declaration after both actors declared.");
}

/**
 * The canonical GM controls of a round, in the order the GM meets them. Only these labels are ever
 * clicked, and the first enabled one wins, so the walk is the real workflow rather than a sweep of
 * whatever happens to be on screen. The canonical current task decides which one is enabled at any
 * moment; this list only says which controls the walk is allowed to press.
 */
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

interface WalkStep {
  control: string;
  responses: { status: number; url: string }[];
  round: number;
  step: string;
}

/**
 * Walks the GM workflow one canonical control at a time, recording every step it passes through
 * and every combat-round response status. Bounded by an iteration count rather than by a
 * condition, so a workflow that stops progressing ends the walk instead of hanging.
 */
async function walkRound(input: {
  encounterId: string;
  iterations: number;
  page: Page;
  screenshotPrefix: string;
  stopAtRound?: number;
}): Promise<WalkStep[]> {
  const { encounterId, page } = input;
  const walked: WalkStep[] = [];
  const responses: { status: number; url: string }[] = [];
  const listener = (response: { status: () => number; url: () => string }) => {
    if (response.url().includes("/combat-round/")) {
      responses.push({ status: response.status(), url: response.url() });
    }
  };
  page.on("response", listener);
  try {
    for (let iteration = 0; iteration < input.iterations; iteration += 1) {
      const state = await readRoundState({ encounterId, request: page.request });
      if (input.stopAtRound !== undefined && state.roundNumber >= input.stopAtRound) {
        console.log(`[lane694] reached round ${state.roundNumber}`);
        return walked;
      }
      const currentTask = page.getByRole("button", { name: "Current task", exact: true });
      if (await currentTask.count()) {
        await currentTask.first().click();
        await page.waitForTimeout(500);
      }
      // The inspector's attack-source control is a local draft, so at the roll step the GM picks
      // the declared source again before rolling. Re-selecting it here is driving the UI as it is.
      const inspectorSource = page.getByRole("combobox", { name: "Attack source" }).first();
      if ((await inspectorSource.count()) && (await inspectorSource.inputValue()) === "") {
        const punch = inspectorSource.locator(`option[value="${PUNCH_SOURCE_ID}"]`);
        if (await punch.count()) {
          await inspectorSource.selectOption(PUNCH_SOURCE_ID);
          await page.waitForTimeout(500);
        }
      }
      const buttons = await enabledButtonNames(page);
      const label = ROUND_CONTROLS.find((candidate) => buttons.includes(candidate));
      console.log(
        `[lane694] round=${state.roundNumber} step=${state.currentStep} control=${label ?? "(none)"} enabled=${JSON.stringify(buttons)}`,
      );
      if (!label) {
        await page.screenshot({
          fullPage: true,
          path: `test-results/lane694/${input.screenshotPrefix}-stalled-${state.currentStep}.png`,
        });
        return walked;
      }
      responses.length = 0;
      await page.getByRole("button", { name: label, exact: true }).first().click();
      await page.waitForTimeout(1800);
      walked.push({
        control: label,
        responses: [...responses],
        round: state.roundNumber,
        step: state.currentStep,
      });
      await page.screenshot({
        fullPage: true,
        path: `test-results/lane694/${input.screenshotPrefix}-${String(iteration).padStart(2, "0")}-${state.currentStep}-${label.replace(/\s+/g, "-").toLowerCase()}.png`,
      });
    }
    return walked;
  } finally {
    page.off("response", listener);
  }
}

test.describe("a complete round against the seeded Training Bandit (#694)", () => {
  test.use({ storageState: LANE694_STORAGE_STATE });

  test("a solo GM completes declaration through committed damage and into the next round", async ({
    page,
  }) => {
    test.setTimeout(1_800_000);
    const suffix = Date.now();
    const defenderName = `Seeded Training Bandit ${suffix}`;

    // ---- The defender is the shipped seed, asserted rather than assumed. ----
    const { campaigns } = await json<{ campaigns: { id: string; name: string }[] }>(
      await page.request.get(`${API_URL}/campaigns`),
    );
    const campaignId = campaigns.find((entry) => entry.name === "Local Dev Campaign")!.id;
    const { entities } = await json<{
      entities: {
        name: string;
        snapshot?: {
          build?: { progression?: { skills?: { ranks?: number; skillId?: string }[] } };
        };
      }[];
    }>(await page.request.get(`${API_URL}/campaigns/${campaignId}/entities`));
    const seeded = entities.find((entry) => entry.name === "Training Bandit");
    expect(seeded, "the seeded Training Bandit entity must be present").toBeTruthy();
    const seededSkills = seeded!.snapshot?.build?.progression?.skills ?? [];
    // The authored demo content this walk depends on: #672's Brawling rank and #690's Dodge rank.
    // Without the second one no attack can be resolved at all, so the round could not reach the
    // defence review this issue is about.
    expect(seededSkills.find((skill) => skill.skillId === "brawling")?.ranks).toBe(9);
    expect(seededSkills.find((skill) => skill.skillId === "dodge")?.ranks).toBe(9);

    const fixture = await buildAttackFixture({
      defenderName,
      defenderTemplateLabel: "Training Bandit (template library)",
      page,
      suffix,
    });
    await declareAttackAndPass({ fixture, page });
    await page.screenshot({
      fullPage: true,
      path: "test-results/lane694/lane694-01-declarations-committed.png",
    });

    const walked = await walkRound({
      encounterId: fixture.encounterId,
      iterations: 40,
      page,
      screenshotPrefix: "lane694-walk",
      stopAtRound: 2,
    });

    const controls = walked.map((entry) => entry.control);
    console.log(`[lane694] controls=${JSON.stringify(controls)}`);

    // Every combat-round response the walk produced was accepted. The defect was a 400 on
    // `commit-defense-review`, so a single refused call here fails the proof.
    const refused = walked.flatMap((entry) =>
      entry.responses.filter((response) => response.status >= 400),
    );
    expect(refused, `refused combat-round calls: ${JSON.stringify(refused)}`).toEqual([]);

    // The attack connected, which is what carries the GM into the defence review.
    await expect(
      page
        .getByText(
          new RegExp(
            `${fixture.attackerName} attacked ${defenderName} with Punch\\. The attack hit\\.`,
          ),
        )
        .first(),
    ).toBeVisible();

    // The step #694 exists for: the defence review is committed for a Template-derived temporary
    // actor, and `commit-defense-review` is accepted rather than refused.
    expect(controls, "the GM must reach and commit the defence review").toContain(
      "Commit defense review",
    );
    const defenseReview = walked.find((entry) => entry.control === "Commit defense review")!;
    const defenseReviewCall = defenseReview.responses.find((response) =>
      response.url.includes("/combat-round/commit-defense-review"),
    );
    expect(defenseReviewCall, "the defence review commit must reach the server").toBeTruthy();
    expect(defenseReviewCall!.status).toBe(200);

    // Damage is committed, which was unreachable before: the round stopped at the defence review.
    expect(controls, "committed damage must be reachable").toContain("Commit damage");

    // And the round completes, so the GM is in the next one.
    const finalState = await readRoundState({
      encounterId: fixture.encounterId,
      request: page.request,
    });
    expect(finalState.roundNumber, "the round must complete and advance").toBeGreaterThanOrEqual(2);

    // None of it told the GM to refresh.
    await expect(page.getByText(REFRESH_AND_RETRY)).toHaveCount(0);
    await page.screenshot({
      fullPage: true,
      path: "test-results/lane694/lane694-99-next-round-reached.png",
    });
  });
});
