import { expect, test, type APIRequestContext, type Page, type Response } from "@playwright/test";
import {
  ARCHIVED_COMBAT_ROUND_UNDO_ONLY_COMMAND_FACT_KEYS,
  initializeCombatRoundState,
  rollCombatRoundCombatExperience,
  setCombatRoundCombatExperienceDifficulty,
  type CombatRoundState,
  type EncounterSession,
} from "@glantri/domain";

import { characterPayload } from "./character-fixture";
import { API_URL } from "./targets";

/**
 * Forgejo #1135, part 1. Product Owner ruling of 2026-11-10: "unnecessary to store undo data from
 * previous rounds … discard it after the round end is committed", and "Undo will not go back to a
 * previous round, that is today's behavior".
 *
 * A real round between two Characters is played through the GM's own controls. At the round end
 * the archived round must keep its record (commands, events, step snapshots) and none of the
 * command facts only an in-round undo reads. In the new round, no control the GM has, in the
 * browser or on the route behind it, may reopen the finished round: Clear current step at the new
 * round's first step undoes only the new round's own commands, and on the finished round itself
 * it is not offered at all. In-round Clear current step keeps working, also after a reload.
 */

const PUNCH_SOURCE_ID = "unarmed:virtual-weapon-template-punch";
const SHOTS = "test-results/round-end-discards-undo-data";

type RoundEncounter = EncounterSession & { combatRoundState: CombatRoundState };

async function json<T>(response: Awaited<ReturnType<APIRequestContext["get"]>>): Promise<T> {
  if (!response.ok()) throw new Error(`${response.status()} ${await response.text()}`);
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

/** Reads the encounter once its revision has stopped moving (the GM page runs deterministic steps). */
async function readSettledEncounter(request: APIRequestContext, encounterId: string) {
  let last = await readEncounter(request, encounterId);
  for (let stable = 0, attempt = 0; stable < 2 && attempt < 30; attempt += 1) {
    await new Promise((resolve) => setTimeout(resolve, 1000));
    const next = await readEncounter(request, encounterId);
    stable = next.updatedAt === last.updatedAt ? stable + 1 : 0;
    last = next;
  }
  return last;
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

interface Fixture {
  campaignId: string;
  encounterId: string;
  heroName: string;
  rivalName: string;
  scenarioId: string;
}

/** Two GM-controlled Characters in an active encounter standing at round 1 Declaration. */
async function buildFixture(page: Page, suffix: string): Promise<Fixture> {
  const { user } = await json<{ user: { id: string } }>(
    await page.request.get(`${API_URL}/auth/me`),
  );
  const { campaign } = await post<{ campaign: { id: string } }>(page.request, "/campaigns", {
    name: `Issue 1135 ${suffix}`,
    status: "active",
  });
  const { scenario } = await post<{ scenario: { id: string } }>(
    page.request,
    `/campaigns/${campaign.id}/scenarios`,
    { name: `Issue 1135 Scenario ${suffix}`, status: "live" },
  );
  const combatants = [];
  for (const role of ["hero", "rival"] as const) {
    const characterId = `issue-1135-${role}-${suffix}`;
    const name = `${role === "hero" ? "Hero" : "Rival"} ${suffix}`;
    await json(
      await page.request.post(`${API_URL}/characters`, { data: fighterPayload(characterId, name) }),
    );
    await post(page.request, `/campaigns/${campaign.id}/roster`, {
      category: "pc",
      sourceId: characterId,
      sourceType: "character",
    });
    const { participant } = await post<{ participant: { id: string } }>(
      page.request,
      `/scenarios/${scenario.id}/participants/character`,
      { characterId, controlledByUserId: user.id },
    );
    await post(
      page.request,
      `/scenarios/${scenario.id}/participants/${participant.id}/refresh-character-equipment`,
    );
    combatants.push({
      characterId,
      id: `issue-1135-${role}-c-${suffix}`,
      label: name,
      participantType: "scenario",
      scenarioParticipantId: participant.id,
    });
  }
  const now = new Date().toISOString();
  const created = await post<{ encounter: EncounterSession }>(
    page.request,
    `/scenarios/${scenario.id}/encounters`,
    {
      session: {
        campaignId: campaign.id,
        createdAt: now,
        currentRound: 1,
        id: `issue-1135-encounter-${suffix}`,
        kind: "combat",
        participantMembershipMode: "explicit",
        participants: combatants,
        scenarioId: scenario.id,
        status: "active",
        title: `Issue 1135 Combat ${suffix}`,
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
  // scaffolding, exactly as #1001's evidence does it.
  encounter = await readEncounter(page.request, encounterId);
  const combatRoundState = combatants.reduce(
    (state, combatant, index) =>
      rollCombatRoundCombatExperience({
        command: { createdAt: new Date(Date.now() + index).toISOString() },
        participantId: combatant.id,
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
    campaignId: campaign.id,
    encounterId,
    heroName: combatants[0]!.label,
    rivalName: combatants[1]!.label,
    scenarioId: scenario.id,
  };
}

const INSPECTOR_HEADING = /^Combat inspector — (.+ · )?Round \d+ · /;

async function openCombat(page: Page, fixture: Fixture) {
  await page.goto(
    `/campaigns/${fixture.campaignId}?scenarioId=${fixture.scenarioId}&encounterId=${fixture.encounterId}&tab=combat`,
  );
  await expect(page.getByRole("heading", { name: INSPECTOR_HEADING })).toBeVisible({
    timeout: 30_000,
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

/** Declares a Punch at `target` through the GM inspector, as a GM does. */
async function declarePunch(page: Page, label: string, target: string) {
  await selectInspectorParticipant(page, label);
  await page.getByRole("combobox", { name: "Action" }).first().selectOption("attack_parry");
  await page.getByRole("combobox", { name: "Attack source" }).first().selectOption(PUNCH_SOURCE_ID);
  await page.getByRole("combobox", { name: "Target" }).first().selectOption({ label: target });
  const declared = page.waitForResponse(
    (response) =>
      response.request().method() === "POST" && response.url().includes("/combat-declaration"),
  );
  await page.getByRole("button", { name: "Declare action" }).first().click();
  const response = await declared;
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

/** Presses the GM's canonical round controls, first enabled one first, until round 2 opens. */
async function walkToNextRound(page: Page, encounterId: string) {
  const refused: string[] = [];
  const listener = (response: Response) => {
    if (response.url().includes("/combat-") && response.status() >= 400) {
      void response
        .text()
        .catch(() => "")
        .then((body) =>
          refused.push(`${response.status()} ${response.url()} ${body.slice(0, 160)}`),
        );
    }
  };
  page.on("response", listener);
  let idle = 0;
  try {
    for (let iteration = 0; iteration < 80; iteration += 1) {
      const state = (await readEncounter(page.request, encounterId)).combatRoundState;
      if (state.roundNumber >= 2) break;
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
      if (!label) {
        if (idle < 3) {
          idle += 1;
          await page.waitForTimeout(2000);
          continue;
        }
        await page.screenshot({ fullPage: true, path: `${SHOTS}/walk-stalled.png` });
        break;
      }
      idle = 0;
      if (offered) await currentAction.last().click();
      else await page.getByRole("button", { name: label, exact: true }).first().click();
      await page.waitForTimeout(1500);
    }
  } finally {
    page.off("response", listener);
  }
  return refused;
}

const UNDO_ONLY_KEYS = new Set<string>(ARCHIVED_COMBAT_ROUND_UNDO_ONLY_COMMAND_FACT_KEYS);

function undoFactsIn(round: { commands: { facts: Record<string, unknown>; type: string }[] }) {
  return round.commands.flatMap((command) =>
    Object.entries(command.facts)
      .filter(
        ([key, value]) =>
          UNDO_ONLY_KEYS.has(key) ||
          (key === "previousState" && typeof value === "object" && value !== null),
      )
      .map(([key]) => `${command.type}.${key}`),
  );
}

const clearButton = (page: Page) => page.getByRole("button", { name: "Clear current step" });

test.describe("the round end discards undo data, and undo never reopens a finished round (#1135)", () => {
  test.use({ storageState: "e2e/.auth/gm.json" });

  test("archives the round without its undo data; no control reaches the finished round", async ({
    page,
  }) => {
    test.setTimeout(600_000);
    const suffix = String(Date.now());
    const fixture = await buildFixture(page, suffix);
    await openCombat(page, fixture);
    await declarePunch(page, fixture.heroName, fixture.rivalName);
    await declarePunch(page, fixture.rivalName, fixture.heroName);

    // ---- In-round Clear current step works, and what it cleared stays cleared after a reload. ----
    const declared = await readSettledEncounter(page.request, fixture.encounterId);
    const latestCommand = declared.combatRoundState.commands.at(-1);
    const clearedInRound = page.waitForResponse((response) =>
      response.url().includes("/combat-round/clear-current-step"),
    );
    await clearButton(page).click();
    expect((await clearedInRound).status()).toBe(200);
    const afterInRoundClear = await readSettledEncounter(page.request, fixture.encounterId);
    console.log(
      `[1135] in-round clear at ${declared.combatRoundState.currentStep}: ${JSON.stringify(declared.combatRoundState.commands.map((command) => command.type))} -> ${JSON.stringify(afterInRoundClear.combatRoundState.commands.map((command) => command.type))}`,
    );
    expect(afterInRoundClear.combatRoundState.roundNumber).toBe(1);
    expect(
      afterInRoundClear.combatRoundState.commands.some(
        (command) => command.id === latestCommand?.id,
      ),
      "the latest command of the round is undone",
    ).toBe(false);
    await page.reload();
    await expect(page.getByRole("heading", { name: INSPECTOR_HEADING })).toBeVisible({
      timeout: 30_000,
    });
    const reloaded = await readSettledEncounter(page.request, fixture.encounterId);
    expect(reloaded.combatRoundState.commands).toEqual(afterInRoundClear.combatRoundState.commands);
    // The cleared declaration is made again, and the round is played to its end.
    for (const participant of reloaded.combatRoundState.participants) {
      if (participant.declaration) continue;
      const label = participant.label ?? "";
      await declarePunch(
        page,
        label,
        label === fixture.heroName ? fixture.rivalName : fixture.heroName,
      );
    }

    const refused = await walkToNextRound(page, fixture.encounterId);
    // A `stale_revision` answer is the walk clicking while the previous save was still landing.
    expect(refused.filter((entry) => !entry.includes('"stale_revision"'))).toEqual([]);

    // ---- The archived round keeps its record and none of its undo data. ----
    const opened = await readSettledEncounter(page.request, fixture.encounterId);
    expect(opened.combatRoundState.roundNumber).toBe(2);
    expect(opened.combatRoundState.rounds).toHaveLength(1);
    const archived = opened.combatRoundState.rounds[0]!;
    console.log(
      `[1135] round 2 opened at ${opened.combatRoundState.currentStep}; archived round 1: ${archived.commands.length} commands, ${archived.events.length} events, ${archived.stepSnapshots.length} step snapshots, ${JSON.stringify(archived).length} bytes`,
    );
    expect(archived.commands.some((command) => command.type === "advance_combat_boundary")).toBe(
      true,
    );
    expect(archived.events.length).toBeGreaterThan(0);
    expect(archived.stepSnapshots.length).toBeGreaterThan(0);
    expect(undoFactsIn(archived), "undo-only facts left in the archived round").toEqual([]);
    const boundary = archived.commands.find(
      (command) => command.type === "advance_combat_boundary",
    );
    expect(boundary?.facts).toMatchObject({
      currentBoundary: expect.any(String),
      targetBoundary: expect.any(String),
    });
    const finishedRound = JSON.stringify(archived);

    const expectFinishedRoundUntouched = async (moment: string) => {
      const now = await readEncounter(page.request, fixture.encounterId);
      expect(now.combatRoundState.roundNumber, moment).toBe(2);
      expect(now.combatRoundState.rounds, moment).toHaveLength(1);
      expect(JSON.stringify(now.combatRoundState.rounds[0]), moment).toBe(finishedRound);
      return now;
    };

    // ---- At the new round's first step, Clear current step undoes only the new round. ----
    const clearInBrowser = async (moment: string) => {
      const clears: string[] = [];
      for (let attempt = 0; attempt < 8; attempt += 1) {
        const button = clearButton(page);
        if (!(await button.isEnabled())) break;
        const before = await readSettledEncounter(page.request, fixture.encounterId);
        const response = page.waitForResponse((candidate) =>
          candidate.url().includes("/combat-round/clear-current-step"),
        );
        await button.click();
        const status = (await response).status();
        await readSettledEncounter(page.request, fixture.encounterId);
        const after = await expectFinishedRoundUntouched(`${moment}: browser clear ${attempt}`);
        clears.push(
          `${status} ${before.combatRoundState.currentStep}->${after.combatRoundState.currentStep} commands ${before.combatRoundState.commands.length}->${after.combatRoundState.commands.length}`,
        );
      }
      console.log(`[1135] ${moment}: browser clears ${JSON.stringify(clears)}`);
    };
    await openCombat(page, fixture);
    await readSettledEncounter(page.request, fixture.encounterId);
    await page.screenshot({ fullPage: true, path: `${SHOTS}/01-round-2-first-step.png` });
    await clearInBrowser("round 2 first step");

    // The route behind the control, pressed until it has nothing left, never reaches round 1. The
    // page is closed first, so nothing re-runs a deterministic step between the presses.
    await page.goto("about:blank");
    const routeClears: string[] = [];
    let last = { code: undefined as string | undefined, status: 0 };
    for (let attempt = 0; attempt < 8; attempt += 1) {
      const response = await page.request.post(
        `${API_URL}/encounters/${fixture.encounterId}/combat-round/clear-current-step`,
        { data: {} },
      );
      last = {
        code: ((await response.json()) as { code?: string }).code,
        status: response.status(),
      };
      routeClears.push(`${last.status} ${last.code ?? ""}`);
      await expectFinishedRoundUntouched(`route clear ${attempt}`);
      if (response.status() !== 200) break;
    }
    console.log(`[1135] route clears in round 2: ${JSON.stringify(routeClears)}`);
    expect(last).toEqual({ code: "nothing_to_clear", status: 409 });
    // Aimed explicitly at the finished round's last step, it still clears nothing of round 1.
    const aimed = await page.request.post(
      `${API_URL}/encounters/${fixture.encounterId}/combat-round/clear-current-step`,
      {
        data: {
          participantId: opened.combatRoundState.participants[0]!.participantId,
          step: "round_summary",
        },
      },
    );
    console.log(`[1135] clear aimed at round_summary: ${aimed.status()}`);
    await expectFinishedRoundUntouched("clear aimed at round_summary");

    // ---- After a reload, and on the finished round itself, the control reaches nothing. ----
    await openCombat(page, fixture);
    await readSettledEncounter(page.request, fixture.encounterId);
    await clearInBrowser("round 2 after a reload");
    const heading = page.getByRole("heading", { name: INSPECTOR_HEADING });
    for (let attempt = 0; attempt < 40; attempt += 1) {
      if (/ · Round 1 · /.test(await heading.innerText())) break;
      await page.getByRole("button", { name: "Previous step" }).click();
      await page.waitForTimeout(300);
    }
    await expect(heading).toContainText("Round 1");
    await page.screenshot({ fullPage: true, path: `${SHOTS}/02-finished-round-inspected.png` });
    // On a finished round the control is not offered at all.
    await expect(clearButton(page)).toBeDisabled();
    await expectFinishedRoundUntouched("finished round inspected");
  });
});
