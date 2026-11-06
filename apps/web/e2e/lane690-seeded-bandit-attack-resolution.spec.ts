import { expect, test, type APIRequestContext, type Page } from "@playwright/test";
import {
  initializeCombatRoundState,
  rollCombatRoundCombatExperience,
  setCombatRoundCombatExperienceDifficulty,
  type CombatRoundState,
  type EncounterSession,
} from "@glantri/domain";

import { characterPayload } from "./character-fixture";
import { LANE690_STORAGE_STATE } from "./lane690-global-setup";
import { API_URL } from "./targets";

/**
 * #690 — an attack against the **shipped seeded** *"Training Bandit"* must resolve rather than be
 * refused, and a defender that genuinely has no defensive skill must be refused **honestly**.
 *
 * #672 proved the seeded opponent could *declare*, and that is as far as its proof reached. Attack
 * resolution needs more: the server refuses the roll outright when it can derive no defence for the
 * defender, which is how every attack against the seeded Bandit returned a conflict — and, worse,
 * surfaced to the GM as "refresh and retry", advice no refresh could ever satisfy.
 *
 * Both tests drive the configuration the issue reproduced: a Character attacking a temporary actor
 * created through the real *Template sources → Create temporary actor* control, in the seeded
 * campaign.
 *
 * 1. **The seeded Bandit.** Nothing about that defender is authored here — the assertion reads the
 *    seeded row and fails if it is not the shipped seed, so this cannot pass against a hand-statted
 *    stand-in. The attack is declared, rolled, connects, and the GM reaches the defence review.
 * 2. **An opponent with no defensive skill**, which is the condition the guard exists for. The roll
 *    is refused, and the GM is told what is missing instead of being sent to refresh and retry.
 *
 * The attacker is deliberately a very skilled brawler. Its Brawling rank is scaffolding for this
 * proof only — it makes the attack connect on any die, so the evidence does not depend on a lucky
 * roll. It says nothing about the seed and is not authored content.
 *
 * **What this spec deliberately does not reach: committed damage.** Once the attack connects, the
 * current task is the defence review, and `POST .../combat-round/commit-defense-review` refuses it
 * with 400 *"Required defense context is unavailable. Refresh combat."* for **any**
 * Template-derived temporary actor. `resolveCanonicalParticipantCalculationContext`
 * (`apps/api/src/routes/scenarios/combatParticipantCalculationResolution.ts`) returns `partial`
 * unless the defender has both a `characterId` and a `snapshot.equipmentState`, and a temporary
 * actor has neither by construction — #666 established that it never can. That is a structural gap
 * in the defence-review path, not a missing authored value, so #690's lane reported it rather than
 * inventing a way around it. It is independent of the authored Dodge rank: it refuses only after
 * the attack has already resolved.
 *
 * These tests need a seeded database, so they run under `playwright.lane690.config.ts` rather than
 * in the ordinary suite, whose account bootstrap is incompatible with a seeded game master.
 */

const PUNCH_SOURCE_ID = "unarmed:virtual-weapon-template-punch";

const REFRESH_AND_RETRY = /review it before retrying|no longer current/;

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

/**
 * A Template snapshot with an attack competency and **no defensive one** — the shape the seeded
 * Bandit had before #690, kept here as the live condition the guard exists for.
 */
function noDefenseTemplateSnapshot(id: string, name: string) {
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

async function readRoundState(input: {
  encounterId: string;
  request: APIRequestContext;
}): Promise<CombatRoundState> {
  const { encounter } = await json<{ encounter: { combatRoundState: CombatRoundState } }>(
    await input.request.get(`${API_URL}/encounters/${input.encounterId}`),
  );
  return encounter.combatRoundState;
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
  for (let attempt = 0; attempt < 10; attempt += 1) {
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
  const characterId = `issue-690-brawler-${suffix}`;
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
    { name: `Issue 690 ${input.defenderName}`, status: "live" },
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
  // defender really is a temporary actor off a Template, not a Character in disguise.
  expect(defender!.sourceType).toBe("entity");
  expect(defender!.characterId).toBeFalsy();
  expect(defender!.snapshot.equipmentState).toBeFalsy();
  expect(defender!.snapshot.equipmentProjection).toBeFalsy();

  const attackerCombatantId = `issue-690-attacker-${suffix}`;
  const defenderCombatantId = `issue-690-defender-${suffix}`;
  const now = new Date().toISOString();
  const created = await post<{ encounter: EncounterSession }>(
    page.request,
    `/scenarios/${scenarioId}/encounters`,
    {
      session: {
        campaignId,
        createdAt: now,
        currentRound: 1,
        id: `issue-690-encounter-${suffix}`,
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
        title: `Issue 690 Combat ${suffix}`,
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
  // is scaffolding, exactly as the #666 and #590 evidence do it. The difficulty is deliberately
  // trivial: a failed check cancels the attack, and the subject here is attack resolution.
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

  // Both declarations are committed, so the round must leave Declaration. Bounded poll rather than
  // an open wait, so a round that does not progress ends the walk instead of hanging.
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const state = await readRoundState({ encounterId: fixture.encounterId, request: page.request });
    if (state.currentStep !== "select_actions") return;
    await page.waitForTimeout(1000);
  }
  throw new Error("The round never left Declaration after both actors declared.");
}

const STEP_CONTROLS: Record<string, string[]> = {
  initiative_phase_1: ["Roll initiative"],
  phase_1_actions: ["Roll attack", "Roll Combat Experience"],
  review_action_modifiers: ["Complete modifier review"],
};

/**
 * Progresses the GM workflow one canonical control at a time until the phase 1 attack is rolled,
 * and returns that roll's response status. Bounded by an iteration count rather than by a
 * condition, so a workflow that stops progressing ends the walk instead of hanging.
 */
async function rollPhase1Attack(input: {
  encounterId: string;
  page: Page;
}): Promise<number | undefined> {
  const { encounterId, page } = input;
  for (let iteration = 0; iteration < 20; iteration += 1) {
    const state = await readRoundState({ encounterId, request: page.request });
    // Focus whatever the canonical current task is, exactly as the GM does, rather than acting on
    // whichever participant the inspector happened to be left on.
    const currentTask = page.getByRole("button", { name: "Current task", exact: true });
    if (await currentTask.count()) {
      await currentTask.first().click();
      await page.waitForTimeout(500);
    }
    // The inspector's attack-source control is a local draft, so at the roll step the GM picks the
    // declared source again before rolling. Re-selecting it here is driving the UI as it is.
    const inspectorSource = page.getByRole("combobox", { name: "Attack source" }).first();
    if ((await inspectorSource.count()) && (await inspectorSource.inputValue()) === "") {
      const punch = inspectorSource.locator(`option[value="${PUNCH_SOURCE_ID}"]`);
      if (await punch.count()) {
        await inspectorSource.selectOption(PUNCH_SOURCE_ID);
        await page.waitForTimeout(500);
      }
    }
    const buttons = await enabledButtonNames(page);
    const label = (STEP_CONTROLS[state.currentStep] ?? []).find((candidate) =>
      buttons.includes(candidate),
    );
    console.log(`[lane690] step=${state.currentStep} control=${label ?? "(none)"}`);
    if (!label) return undefined;
    if (label === "Roll attack") {
      const rolled = page.waitForResponse((response) =>
        response.url().includes("/combat-round/roll-attack"),
      );
      await page.getByRole("button", { name: label, exact: true }).first().click();
      const status = (await rolled).status();
      await page.waitForTimeout(1500);
      return status;
    }
    await page.getByRole("button", { name: label, exact: true }).first().click();
    await page.waitForTimeout(1500);
  }
  return undefined;
}

test.describe("attack resolution against a Template-derived opponent (#690)", () => {
  test.use({ storageState: LANE690_STORAGE_STATE });

  test("resolves a connecting attack against a temporary actor created from the shipped seed", async ({
    page,
  }) => {
    test.setTimeout(900_000);
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
    // The authored demo content under test: the Brawling rank from #672 and the Dodge rank from
    // #690. Without the second one, no attack below can be resolved at all.
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
      path: "test-results/lane690/lane690-01-seed-declarations-committed.png",
    });

    const status = await rollPhase1Attack({ encounterId: fixture.encounterId, page });
    // The whole of #690: this used to come back 409 attack_context_unavailable, because the seeded
    // defender had no defence to derive.
    expect(status, "the attack roll against the seeded opponent must be accepted").toBe(200);

    // Rendered proof that the attack resolved and connected, in the GM's own combat log.
    await expect(
      page
        .getByText(
          new RegExp(
            `${fixture.attackerName} attacked ${defenderName} with Punch\\. The attack hit\\.`,
          ),
        )
        .first(),
    ).toBeVisible();
    await expect(page.getByText(REFRESH_AND_RETRY)).toHaveCount(0);
    await page.screenshot({
      fullPage: true,
      path: "test-results/lane690/lane690-02-seed-attack-connected.png",
    });

    // The GM is carried on to the defence review for that hit, which is where this walk stops —
    // see the note at the top of this file.
    await expect(page.getByText("Commit defense review")).toBeVisible();
    await page.screenshot({
      fullPage: true,
      path: "test-results/lane690/lane690-03-seed-defense-review-reached.png",
    });
  });

  test("tells the GM what is missing when the defender genuinely has no defensive skill", async ({
    page,
  }) => {
    test.setTimeout(900_000);
    const suffix = Date.now();
    const defenderName = `No Defense Opponent ${suffix}`;

    const { campaigns } = await json<{ campaigns: { id: string; name: string }[] }>(
      await page.request.get(`${API_URL}/campaigns`),
    );
    const campaignId = campaigns.find((entry) => entry.name === "Local Dev Campaign")!.id;
    await post(page.request, `/campaigns/${campaignId}/entities`, {
      kind: "npc",
      name: defenderName,
      snapshot: noDefenseTemplateSnapshot(`issue-690-nodefense-${suffix}`, defenderName),
    });

    const fixture = await buildAttackFixture({
      defenderName,
      defenderTemplateLabel: `${defenderName} (template library)`,
      page,
      suffix,
    });
    await declareAttackAndPass({ fixture, page });

    const status = await rollPhase1Attack({ encounterId: fixture.encounterId, page });
    // The guard is correct and stays: this attack genuinely cannot be resolved.
    expect(status, "an attack on an opponent with no defence must still be refused").toBe(409);

    // What #690 corrects: the GM is told what is missing and what would change it, and is not sent
    // into a refresh-and-retry loop that cannot repair the condition.
    await expect(
      page.getByText(
        "This opponent has no defensive skill, so an attack against them cannot be resolved. Nothing was rolled. Give the opponent a defensive skill such as Dodge, then attack again.",
      ),
    ).toBeVisible();
    await expect(page.getByText(REFRESH_AND_RETRY)).toHaveCount(0);
    await page.screenshot({
      fullPage: true,
      path: "test-results/lane690/lane690-04-honest-refusal-rendered.png",
    });
  });
});
