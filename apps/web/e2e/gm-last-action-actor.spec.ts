import { mkdirSync } from "node:fs";
import path from "node:path";

import { expect, test, type APIRequestContext, type Locator, type Page } from "@playwright/test";
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
 * Forgejo #836 (WO-836-S1) — the GM's persistent `Current step results` box is replaced by a
 * compact, actor-qualified one-line `Last action` above the tracker.
 *
 * The one measurement that matters, taken in a real browser through real GM actions: while the GM
 * inspects participant X, an event performed by participant Y is displayed naming Y, and X is not
 * presented as the actor. It is read for a declaration, an initiative roll and an attack (a miss;
 * the fixture makes the attacker unskilled against a high-Dodge defender and the test reads the
 * stored outcome and fails if the dice produced the other one).
 *
 * Reads are atomic (one `page.evaluate`, with `scrollY` and the usable width) because the page
 * autoscrolls after mount. Captures: `<repo>/.local-artifacts/836/captures/<label>-<surface>-<usable
 * width>.png` at usable widths 1280 and 1024. The label is `after` unless
 * `E836_CAPTURE_LABEL=before` (a run against the baseline build, where the Last action assertions
 * are skipped because the line does not exist there).
 */

const CAPTURE_LABEL = process.env.E836_CAPTURE_LABEL === "before" ? "before" : "after";
const CAPTURE_DIR = path.resolve(__dirname, "../../../.local-artifacts/836/captures");
const USABLE_WIDTHS = [1280, 1024] as const;

const PRIMARY_WEAPON_TEMPLATE = "weapon-template-longsword";
const SHIELD_TEMPLATE = "shield-template-medium-metal-shield";

const WALK_CONTROLS = [
  /^Roll Combat Experience$/,
  /^Complete modifier review$/,
  /^Roll initiative$/,
  /^Commit initiative$/,
  /^Roll attack$/,
  /^Roll parry$/,
  /^Commit defense review$/,
  /^Roll hit location$/,
  /^Roll damage$/,
  /^Roll critical$/,
  /^Commit damage$/,
  /^Complete phase/,
  /^Complete damage review$/,
  /^Complete phase 2 action review$/,
];

const GM_INSPECTOR_ANY_HEADING = /^Combat inspector — /;
const GM_INSPECTOR_PARTICIPANT_HEADING = /^Combat inspector — .+ · Round \d+ · /;

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

function escapeForRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

interface Skills {
  dodge: number;
  weapon: number;
}

function fighterPayload(id: string, name: string, skills: Skills) {
  const payload = characterPayload(id, name);
  return {
    build: {
      ...payload.build,
      progression: {
        ...payload.build.progression,
        secondaryPoolTotal: 600,
        skills: ["brawling", "dodge", "one_handed_edged", "parry"].map((skillId) => ({
          category: "secondary",
          categoryId: "combat",
          groupId: "basic_melee_training",
          secondaryRanks:
            skillId === "dodge" ? skills.dodge : skillId === "one_handed_edged" ? skills.weapon : 9,
          skillId,
        })),
      },
    },
  };
}

async function readRoundState(
  request: APIRequestContext,
  encounterId: string,
): Promise<CombatRoundState> {
  const { encounter } = await json<{ encounter: { combatRoundState: CombatRoundState } }>(
    await request.get(`${API_URL}/encounters/${encounterId}`),
  );
  return encounter.combatRoundState;
}

async function enabledButtonNames(page: Page): Promise<string[]> {
  return page.getByRole("button").evaluateAll((nodes) =>
    nodes
      .filter((node) => !(node as HTMLButtonElement).disabled)
      .map((node) => (node.textContent ?? "").trim())
      .filter((label) => label.length > 0),
  );
}

async function visibleWithin(locator: Locator, timeout: number): Promise<boolean> {
  return locator
    .waitFor({ state: "visible", timeout })
    .then(() => true)
    .catch(() => false);
}

/** Bounded walk of the inspector's own participant navigation to one participant (see #987/#988). */
async function selectGmInspectorParticipant(page: Page, label: string): Promise<void> {
  const target = page.getByRole("heading", {
    name: new RegExp(`^Combat inspector — ${escapeForRegExp(label)} · `),
  });
  if (await visibleWithin(target, 500)) return;
  await visibleWithin(
    page.getByRole("heading", { name: GM_INSPECTOR_ANY_HEADING }).first(),
    15_000,
  );
  if (
    !(await visibleWithin(
      page.getByRole("heading", { name: GM_INSPECTOR_PARTICIPANT_HEADING }),
      2_000,
    ))
  ) {
    for (const direction of ["Previous participant", "Next participant"]) {
      const button = page.getByRole("button", { name: direction, exact: true });
      if (!(await visibleWithin(button, 2_000))) continue;
      await button.click();
      if (
        await visibleWithin(
          page.getByRole("heading", { name: GM_INSPECTOR_PARTICIPANT_HEADING }),
          2_000,
        )
      ) {
        break;
      }
    }
  }
  for (const direction of ["Next participant", "Previous participant"]) {
    for (let attempt = 0; attempt < 5; attempt += 1) {
      if (await visibleWithin(target, 500)) return;
      const button = page.getByRole("button", { name: direction, exact: true });
      if (!(await visibleWithin(button, 2_000))) break;
      await button.click();
    }
  }
  if (!(await visibleWithin(target, 500))) {
    throw new Error(`The GM inspector never reached ${label}.`);
  }
}

interface Combatant {
  characterId: string;
  combatantId: string;
  name: string;
  scenarioParticipantId: string;
}

interface World {
  campaignId: string;
  combatants: Record<string, Combatant>;
  encounterId: string;
  gmPage: Page;
  playerContextClose: () => Promise<void>;
  playerPage: () => Promise<Page>;
  scenarioId: string;
}

/**
 * Characters, campaign, scenario, encounter, and the Combat Experience opening. Each entry is
 * created by the player (when `player`) or the GM, with the skill profile its case needs.
 */
async function openWorld(input: {
  browser: import("@playwright/test").Browser;
  entries: Array<{ key: string; player?: boolean; skills: Skills }>;
  gmPage: Page;
  tag: string;
}): Promise<World> {
  const { gmPage } = input;
  const suffix = Date.now();
  const playerContext = await input.browser.newContext({
    storageState: "e2e/.auth/player.json",
  });
  const playerUser = await json<{ user: { id: string } }>(
    await playerContext.request.get(`${API_URL}/auth/me`),
  );
  const gmUser = await json<{ user: { id: string } }>(
    await gmPage.request.get(`${API_URL}/auth/me`),
  );

  const makeFighter = async (
    request: APIRequestContext,
    id: string,
    name: string,
    skills: Skills,
  ) => {
    const created = await request.post(`${API_URL}/characters`, {
      data: fighterPayload(id, name, skills),
    });
    expect(created.ok(), await created.text()).toBe(true);
    let revision = (
      await json<{ state: { revision: number } }>(
        await request.get(`${API_URL}/characters/${id}/equipment`),
      )
    ).state.revision;
    const addItem = async (templateId: string) => {
      const withItem = await post<{
        state: { itemsById: Record<string, { id: string; templateId?: string }>; revision: number };
      }>(request, `/characters/${id}/equipment/items`, {
        expectedRevision: revision,
        initialCarryMode: "equipped",
        initialLocationId: `${id}:loc-equipped`,
        quantity: 1,
        templateId,
      });
      revision = withItem.state.revision;
      return Object.values(withItem.state.itemsById).find((item) => item.templateId === templateId)!
        .id;
    };
    const weaponItemId = await addItem(PRIMARY_WEAPON_TEMPLATE);
    const shieldItemId = await addItem(SHIELD_TEMPLATE);
    for (const [field, itemId] of [
      ["active-primary-weapon", weaponItemId],
      ["ready-shield", shieldItemId],
    ] as const) {
      const updated = await post<{ state: { revision: number } }>(
        request,
        `/characters/${id}/equipment/loadout/${field}`,
        { expectedRevision: revision, itemId },
      );
      revision = updated.state.revision;
    }
  };

  const campaign = await post<{ campaign: { id: string } }>(gmPage.request, "/campaigns", {
    name: `Issue 836 ${input.tag} ${suffix}`,
    status: "active",
  });
  const campaignId = campaign.campaign.id;
  const scenario = await post<{ scenario: { id: string } }>(
    gmPage.request,
    `/campaigns/${campaignId}/scenarios`,
    { name: `Issue 836 ${input.tag} Scenario ${suffix}`, status: "live" },
  );
  const scenarioId = scenario.scenario.id;
  const combatants: Record<string, Combatant> = {};
  for (const entry of input.entries) {
    const characterId = `issue-836-${input.tag}-${entry.key}-${suffix}`;
    const name = `${entry.key[0]!.toUpperCase()}${entry.key.slice(1)} ${suffix}`;
    await makeFighter(
      entry.player ? playerContext.request : gmPage.request,
      characterId,
      name,
      entry.skills,
    );
    await post(gmPage.request, `/campaigns/${campaignId}/roster`, {
      category: "pc",
      sourceId: characterId,
      sourceType: "character",
    });
    const participant = await post<{ participant: { id: string } }>(
      gmPage.request,
      `/scenarios/${scenarioId}/participants/character`,
      {
        characterId,
        controlledByUserId: entry.player ? playerUser.user.id : gmUser.user.id,
      },
    );
    await post(
      gmPage.request,
      `/scenarios/${scenarioId}/participants/${participant.participant.id}/refresh-character-equipment`,
    );
    combatants[entry.key] = {
      characterId,
      combatantId: `issue-836-${input.tag}-${entry.key}-combatant-${suffix}`,
      name,
      scenarioParticipantId: participant.participant.id,
    };
  }

  const now = new Date().toISOString();
  const encounter = await post<{ encounter: EncounterSession }>(
    gmPage.request,
    `/scenarios/${scenarioId}/encounters`,
    {
      session: {
        campaignId,
        createdAt: now,
        currentRound: 1,
        id: `issue-836-${input.tag}-encounter-${suffix}`,
        kind: "combat",
        participantMembershipMode: "explicit",
        participants: Object.values(combatants).map((combatant) => ({
          characterId: combatant.characterId,
          id: combatant.combatantId,
          label: combatant.name,
          participantType: "scenario",
          scenarioParticipantId: combatant.scenarioParticipantId,
        })),
        scenarioId,
        status: "active",
        title: `Issue 836 ${input.tag} ${suffix}`,
        updatedAt: now,
      },
    },
  );
  const encounterId = encounter.encounter.id;
  const refreshed = await json<{ encounter: EncounterSession }>(
    await gmPage.request.get(`${API_URL}/encounters/${encounterId}`),
  );
  const activated = await gmPage.request.patch(`${API_URL}/encounters/${encounterId}/status`, {
    data: { expectedRevision: refreshed.encounter.updatedAt, status: "active" },
  });
  expect(activated.ok(), await activated.text()).toBe(true);
  const active = await json<{ encounter: EncounterSession }>(
    await gmPage.request.get(`${API_URL}/encounters/${encounterId}`),
  );
  const combatRoundState = Object.values(combatants).reduce(
    (state, combatant, index) =>
      rollCombatRoundCombatExperience({
        command: { createdAt: new Date(Date.now() + index).toISOString() },
        participantId: combatant.combatantId,
        rng: () => 0.6,
        skillTotal: 26,
        state,
      }).state,
    setCombatRoundCombatExperienceDifficulty({
      difficulty: 1,
      state: initializeCombatRoundState({ encounter: active.encounter }),
    }),
  );
  expect(combatRoundState.currentStep).toBe("select_actions");
  const update = await gmPage.request.put(`${API_URL}/encounters/${encounterId}`, {
    data: {
      expectedRevision: active.encounter.updatedAt,
      session: { ...active.encounter, combatRoundState, currentRound: 1, status: "active" },
    },
  });
  expect(update.ok(), await update.text()).toBe(true);

  let playerPage: Page | undefined;
  return {
    campaignId,
    combatants,
    encounterId,
    gmPage,
    playerContextClose: () => playerContext.close(),
    playerPage: async () => (playerPage ??= await playerContext.newPage()),
    scenarioId,
  };
}

async function openGmCombat(world: World): Promise<void> {
  await world.gmPage.setViewportSize({ height: 900, width: 1440 });
  await world.gmPage.goto(
    `/campaigns/${world.campaignId}?scenarioId=${world.scenarioId}&encounterId=${world.encounterId}&tab=combat`,
  );
  await expect(world.gmPage.getByRole("heading", { name: "Combat Round Manager" })).toBeVisible();
}

/** Declares through the GM inspector, as a GM does: Action, Target, Declare action. */
async function declare(
  world: World,
  input: { actionId: string; who: string; targetName: string },
): Promise<void> {
  const page = world.gmPage;
  await selectGmInspectorParticipant(page, input.who);
  await page.getByRole("combobox", { name: "Action" }).first().selectOption(input.actionId);
  await page.waitForTimeout(400);
  const target = page.getByRole("combobox", { name: "Target" }).first();
  if (await visibleWithin(target, 1_500)) {
    await target.selectOption({ label: input.targetName });
  }
  const declared = page.waitForResponse(
    (response) =>
      response.request().method() === "POST" && response.url().includes("/combat-declaration"),
  );
  await page.getByRole("button", { name: "Declare action" }).first().click();
  const response = await declared;
  expect(response.ok(), await response.text()).toBe(true);
}

async function waitForResolution(world: World): Promise<void> {
  for (let attempt = 0; attempt < 30; attempt += 1) {
    const state = await readRoundState(world.gmPage.request, world.encounterId);
    if (state.currentStep !== "select_actions") return;
    await world.gmPage.waitForTimeout(1000);
  }
}

/**
 * Presses canonical GM controls until `stop` says to stop (checked before every press), or the
 * walk stalls. Returns why it stopped.
 */
async function walk(
  world: World,
  stop: (input: { buttons: string[]; state: CombatRoundState }) => boolean,
  options: { maxSteps?: number; skip?: RegExp[] } = {},
): Promise<"stopped" | "stalled" | "round_summary"> {
  const page = world.gmPage;
  for (let step = 0; step < (options.maxSteps ?? 80); step += 1) {
    const state = await readRoundState(page.request, world.encounterId);
    const currentTask = page.getByRole("button", { name: /^(Resume )?current task$/i });
    if (await currentTask.count()) {
      await currentTask.first().click();
      await page.waitForTimeout(500);
    }
    const buttons = await enabledButtonNames(page);
    if (stop({ buttons, state })) return "stopped";
    if (state.currentStep === "round_summary") return "round_summary";
    const control = buttons.find(
      (label) =>
        WALK_CONTROLS.some((rx) => rx.test(label)) &&
        !(options.skip ?? []).some((rx) => rx.test(label)),
    );
    if (!control) {
      console.log(
        `#836 walk stalled at ${state.currentStep}: ${JSON.stringify(buttons.slice(0, 30))}`,
      );
      return "stalled";
    }
    await page.getByRole("button", { name: control, exact: true }).first().click();
    await page.waitForTimeout(1500);
  }
  return "stalled";
}

function incomingAttacks(state: CombatRoundState, defenderId: string) {
  return state.participants.flatMap((participant) =>
    Object.values(participant.attackResultsByOpportunity ?? {}).filter(
      (result) => result.defenderParticipantId === defenderId,
    ),
  );
}

/** Full-page captures at usable widths 1280 and 1024, measured from the document itself. */
async function captureAtUsableWidths(page: Page, name: string): Promise<void> {
  mkdirSync(CAPTURE_DIR, { recursive: true });
  for (const width of USABLE_WIDTHS) {
    await page.setViewportSize({ height: 900, width });
    const usable = await page.evaluate(() => document.documentElement.clientWidth);
    if (usable !== width) {
      await page.setViewportSize({ height: 900, width: width + (width - usable) });
    }
    await page.waitForTimeout(400);
    const measured = await page.evaluate(() => document.documentElement.clientWidth);
    const row = await page.evaluate(() => {
      const heading = [...document.querySelectorAll("strong")].find(
        (node) => node.textContent === "Combat situation",
      );
      const container = heading?.closest("section")?.parentElement;
      return container
        ? {
            columns: getComputedStyle(container).gridTemplateColumns,
            items: [...container.children].map((child) => ({
              width: Math.round(child.getBoundingClientRect().width),
              label:
                child.getAttribute("aria-label") ??
                child.querySelector("strong")?.textContent ??
                "(empty)",
            })),
          }
        : null;
    });
    console.log(
      `#836 inspector row ${CAPTURE_LABEL} ${name} usable ${measured}: ${JSON.stringify(row)}`,
    );
    const file = path.join(CAPTURE_DIR, `${CAPTURE_LABEL}-${name}-${measured}.png`);
    await page.screenshot({ fullPage: true, path: file });
    console.log(`#836 capture ${name}: usable ${measured}px -> ${file}`);
  }
  await page.setViewportSize({ height: 900, width: 1440 });
}

interface GmRead {
  combatLogText: string;
  currentStepResultsRegions: number;
  currentStepResultsText: boolean;
  inspectorHeading: string;
  lastAction: string | null;
  lastActionAboveTracker: boolean | null;
  scrollY: number;
  usableWidth: number;
}

/** One atomic read of the GM surface: inspector heading, Last action line, legacy box, log. */
async function readGm(page: Page): Promise<GmRead> {
  return page.evaluate(() => {
    const clean = (value: string | null | undefined) => (value ?? "").replace(/\s+/g, " ").trim();
    const line = document.querySelector('[data-testid="combat-last-action"]');
    const tracker = document.querySelector('[aria-label="Combat round timeline grid"]');
    return {
      combatLogText: clean(document.querySelector('[aria-label="Combat Log"]')?.textContent),
      currentStepResultsRegions: document.querySelectorAll('[aria-label="Current step results"]')
        .length,
      currentStepResultsText: /Current step results/.test(document.body.textContent ?? ""),
      inspectorHeading: clean(
        [...document.querySelectorAll("h3")].find((node) =>
          (node.textContent ?? "").startsWith("Combat inspector — "),
        )?.textContent,
      ),
      lastAction: line ? clean(line.textContent) : null,
      lastActionAboveTracker:
        line && tracker
          ? Boolean(line.compareDocumentPosition(tracker) & Node.DOCUMENT_POSITION_FOLLOWING)
          : null,
      scrollY: Math.round(window.scrollY),
      usableWidth: document.documentElement.clientWidth,
    };
  });
}

function note(what: string, read: GmRead): string {
  return `${what} (scrollY ${read.scrollY}, usable ${read.usableWidth}px): ${JSON.stringify(read)}`;
}

/**
 * While inspecting `inspected`, the Last action line names `actor` and never presents the
 * inspected participant as the actor.
 */
async function expectActorNamed(input: {
  actor: string;
  inspected: string;
  page: Page;
  verb: RegExp;
  what: string;
}): Promise<void> {
  await selectGmInspectorParticipant(input.page, input.inspected);
  await input.page.waitForTimeout(600);
  const read = await readGm(input.page);
  console.log(`#836 ${input.what}: ${JSON.stringify(read)}`);
  expect(read.inspectorHeading, note(input.what, read)).toContain(input.inspected);
  if (CAPTURE_LABEL === "before") return;
  expect(read.lastAction, note(input.what, read)).toMatch(
    new RegExp(`^Last action: ${escapeForRegExp(input.actor)} ${input.verb.source}`),
  );
  if (input.actor !== input.inspected) {
    expect(read.lastAction, note(input.what, read)).not.toContain(
      `Last action: ${input.inspected}`,
    );
  }
  expect(read.lastActionAboveTracker, note(input.what, read)).toBe(true);
  expect(read.currentStepResultsRegions, note(input.what, read)).toBe(0);
  expect(read.currentStepResultsText, note(input.what, read)).toBe(false);
}

test.describe("GM Last action names the actor (#836)", () => {
  test.use({ storageState: "e2e/.auth/gm.json" });

  test("while inspecting X, an event performed by Y is displayed naming Y", async ({
    browser,
    page: gmPage,
  }) => {
    test.setTimeout(300_000);
    const world = await openWorld({
      browser,
      entries: [
        { key: "attacker", skills: { dodge: 1, weapon: 1 } },
        { key: "defender", player: true, skills: { dodge: 60, weapon: 9 } },
      ],
      gmPage,
      tag: "last-action",
    });
    const { attacker, defender } = world.combatants as Record<string, Combatant>;
    await openGmCombat(world);

    // Declarations: the defender declares last; the GM then inspects the attacker.
    await declare(world, {
      actionId: "attack_parry",
      who: attacker!.name,
      targetName: defender!.name,
    });
    await declare(world, { actionId: "parry", who: defender!.name, targetName: attacker!.name });
    await expectActorNamed({
      actor: defender!.name,
      inspected: attacker!.name,
      page: gmPage,
      verb: /declared /,
      what: "declaration: defender declared, attacker inspected",
    });

    // Initiative has no browser case: in the live GM flow initiative is committed in bulk by the
    // final modifier review (`commit_phase_initiative_resolution`) and records no per-participant
    // `initiative` event, so there is no single roller to name. The event-driven path is covered in
    // `buildCombatLastAction.test.ts`.
    await waitForResolution(world);

    // Attack: a miss. Walk until the attack is recorded, never pressing a defense review.
    const reasonAttack = await walk(
      world,
      ({ state }) => incomingAttacks(state, defender!.combatantId).length > 0,
      { skip: [/^Commit defense review$/] },
    );
    expect(reasonAttack).toBe("stopped");
    const state = await readRoundState(gmPage.request, world.encounterId);
    const [attack] = incomingAttacks(state, defender!.combatantId);
    expect(attack?.hit, "the fixture's unskilled attack must miss").toBe(false);
    await gmPage.reload();
    await expect(gmPage.getByRole("heading", { name: "Combat Round Manager" })).toBeVisible();

    // X = the defender (the inspected Character), Y = the attacker (the actor).
    await expectActorNamed({
      actor: attacker!.name,
      inspected: defender!.name,
      page: gmPage,
      verb: new RegExp(`attacked ${escapeForRegExp(defender!.name)} — miss$`),
      what: "attack miss, defender inspected",
    });
    await captureAtUsableWidths(gmPage, "gm-attack-miss-defender-inspected");

    // And the same line, unchanged, while inspecting the attacker.
    await expectActorNamed({
      actor: attacker!.name,
      inspected: attacker!.name,
      page: gmPage,
      verb: new RegExp(`attacked ${escapeForRegExp(defender!.name)} — miss$`),
      what: "attack miss, attacker inspected",
    });
    await captureAtUsableWidths(gmPage, "gm-attack-miss-attacker-inspected");

    // Detail stays reachable: the Combat Log carries the attack and the tracker still opens it.
    const detail = await readGm(gmPage);
    expect(detail.combatLogText).toMatch(
      new RegExp(`${escapeForRegExp(attacker!.name)} attacked ${escapeForRegExp(defender!.name)}`),
    );
    await gmPage
      .getByRole("region", { name: "Combat Log" })
      .getByRole("button", { name: /attacked/ })
      .first()
      .click();
    await gmPage.waitForTimeout(800);
    const afterLogSelect = await readGm(gmPage);
    expect(afterLogSelect.inspectorHeading).toMatch(/^Combat inspector — /);
    expect(
      await gmPage.getByRole("table").first().isVisible(),
      "the tracker remains reachable",
    ).toBe(true);

    // Player surface, for the before/after comparison: the player's own Current step results.
    const playerPage = await world.playerPage();
    await playerPage.setViewportSize({ height: 900, width: 1440 });
    await playerPage.goto(
      `/campaigns/${world.campaignId}/scenarios/${world.scenarioId}/player/combat`,
    );
    await playerPage.waitForTimeout(2500);
    const playerRead = await playerPage.evaluate(() => ({
      currentStepResultsRegions: document.querySelectorAll('[aria-label="Current step results"]')
        .length,
      lastActionLine: document.querySelectorAll('[data-testid="combat-last-action"]').length,
      regionText: (
        document.querySelector('[aria-label="Current step results"]')?.textContent ?? ""
      ).replace(/\s+/g, " "),
    }));
    console.log(`#836 player surface (${CAPTURE_LABEL}): ${JSON.stringify(playerRead)}`);
    expect(playerRead.lastActionLine, "the player surface gains no Last action line").toBe(0);
    await captureAtUsableWidths(playerPage, "player");
    await world.playerContextClose();
  });

  test("a connecting attack reads as a hit naming the attacker while the defender is inspected", async ({
    browser,
    page: gmPage,
  }) => {
    test.setTimeout(900_000);
    // The dice are real; a skilled attacker connects on the large majority of rolls. A miss opens
    // no defense review, so the case retries in a fresh world (as #874 does) up to five times.
    const reasons: string[] = [];
    for (let attempt = 1; attempt <= 5; attempt += 1) {
      const world = await openWorld({
        browser,
        entries: [
          { key: "attacker", skills: { dodge: 1, weapon: 60 } },
          { key: "defender", skills: { dodge: 1, weapon: 9 } },
        ],
        gmPage,
        tag: `last-action-hit-${attempt}`,
      });
      const { attacker, defender } = world.combatants as Record<string, Combatant>;
      await openGmCombat(world);
      await declare(world, {
        actionId: "attack_parry",
        who: attacker!.name,
        targetName: defender!.name,
      });
      await declare(world, { actionId: "parry", who: defender!.name, targetName: attacker!.name });
      await waitForResolution(world);
      const reason = await walk(world, ({ buttons }) => buttons.includes("Commit defense review"));
      await world.playerContextClose();
      if (reason !== "stopped") {
        reasons.push(`attempt ${attempt}: walk ended ${reason}`);
        continue;
      }
      const state = await readRoundState(gmPage.request, world.encounterId);
      expect(incomingAttacks(state, defender!.combatantId)[0]?.hit).toBe(true);
      await expectActorNamed({
        actor: attacker!.name,
        inspected: defender!.name,
        page: gmPage,
        verb: new RegExp(`attacked ${escapeForRegExp(defender!.name)} — hit$`),
        what: "attack hit, defender inspected",
      });
      await captureAtUsableWidths(gmPage, "gm-attack-hit-defender-inspected");
      return;
    }
    throw new Error(`no connecting attack in 5 attempts: ${reasons.join(" | ")}`);
  });

  test("three combatants: individual initiative, attack, parry and damage each name their own actor", async ({
    browser,
    page: gmPage,
  }) => {
    test.setTimeout(900_000);
    const world = await openWorld({
      browser,
      entries: [
        { key: "attacker", skills: { dodge: 1, weapon: 60 } },
        { key: "defender", skills: { dodge: 1, weapon: 9 } },
        { key: "bystander", skills: { dodge: 1, weapon: 9 } },
      ],
      gmPage,
      tag: "last-action-three",
    });
    const { attacker, defender, bystander } = world.combatants as Record<string, Combatant>;
    const everyone = [attacker!, defender!, bystander!];
    const nameOf = (combatantId?: string) =>
      everyone.find((combatant) => combatant.combatantId === combatantId)?.name;
    await openGmCombat(world);
    await declare(world, {
      actionId: "attack_parry",
      who: attacker!.name,
      targetName: defender!.name,
    });
    await declare(world, {
      actionId: "attack_parry",
      who: defender!.name,
      targetName: attacker!.name,
    });
    await declare(world, {
      actionId: "attack_parry",
      who: bystander!.name,
      targetName: defender!.name,
    });
    await waitForResolution(world);
    /** Reads the line while a participant other than `actor` is inspected. */
    const readLineWhileInspectingAnother = async (actor: string, what: string) => {
      const inspected = everyone.find((combatant) => combatant.name !== actor)!.name;
      await gmPage.reload();
      await expect(gmPage.getByRole("heading", { name: "Combat Round Manager" })).toBeVisible();
      await selectGmInspectorParticipant(gmPage, inspected);
      await gmPage.waitForTimeout(500);
      const read = await readGm(gmPage);
      console.log(
        `#836 ${what}: ${JSON.stringify({ line: read.lastAction, inspected: read.inspectorHeading })}`,
      );
      return read;
    };

    // Press one canonical control at a time. After each press, the newest new initiative, attack,
    // parry or damage event decides what the line must say, read while a different participant
    // than that event's actor is inspected.
    const seen = new Set<string>();
    const checked = { attack: 0, damage_committed: 0, initiative: 0, parry: 0 };
    for (let step = 0; step < 80 && checked.damage_committed === 0; step += 1) {
      const reason = await walk(world, () => false, { maxSteps: 1 });
      const state = await readRoundState(gmPage.request, world.encounterId);
      const fresh = state.events
        .filter(
          (event) =>
            (event.type === "initiative" ||
              event.type === "attack" ||
              event.type === "parry" ||
              event.type === "damage_committed") &&
            !seen.has(event.id),
        )
        .sort((left, right) => left.sequence - right.sequence);
      for (const event of fresh) seen.add(event.id);
      const newest = fresh.at(-1);
      if (!newest) {
        if (reason === "round_summary") break;
        continue;
      }
      const type = newest.type as keyof typeof checked;
      checked[type] += 1;
      const attackerName = nameOf(newest.attackerParticipantId ?? newest.actorParticipantId);
      const defenderName = nameOf(newest.defenderParticipantId ?? newest.targetParticipantId);
      const actor =
        type === "initiative"
          ? nameOf(newest.ownerParticipantId)!
          : type === "parry"
            ? (defenderName ?? nameOf(newest.actorParticipantId))!
            : attackerName!;
      const read = await readLineWhileInspectingAnother(actor, `${type} #${checked[type]}`);
      const expected =
        type === "initiative"
          ? `^Last action: ${escapeForRegExp(actor)} rolled Initiative ${String(newest.facts.publicOutcome.total)}$`
          : type === "attack"
            ? `^Last action: ${escapeForRegExp(actor)} attacked ${escapeForRegExp(defenderName!)} — `
            : type === "parry"
              ? `^Last action: ${escapeForRegExp(actor)} parried `
              : `^Last action: ${escapeForRegExp(actor)} dealt \\d+ damage to ${escapeForRegExp(defenderName!)}$`;
      expect(read.lastAction, `${type} by ${actor}`).toMatch(new RegExp(expected));
    }
    console.log(`#836 three-combatant checks: ${JSON.stringify(checked)}`);
    expect(checked.initiative, "initiative was rolled individually").toBeGreaterThan(0);
    expect(checked.attack).toBeGreaterThan(0);
    expect(checked.parry).toBeGreaterThan(0);
    expect(checked.damage_committed).toBeGreaterThan(0);
    await world.playerContextClose();
  });

  test("a bulk initiative commit reads as the GM's, then the next real action replaces it", async ({
    browser,
    page: gmPage,
  }) => {
    test.setTimeout(300_000);
    const world = await openWorld({
      browser,
      entries: [
        { key: "attacker", skills: { dodge: 1, weapon: 1 } },
        { key: "defender", skills: { dodge: 60, weapon: 9 } },
      ],
      gmPage,
      tag: "last-action-bulk",
    });
    const { attacker, defender } = world.combatants as Record<string, Combatant>;
    await openGmCombat(world);
    await declare(world, {
      actionId: "attack_parry",
      who: attacker!.name,
      targetName: defender!.name,
    });
    await declare(world, { actionId: "parry", who: defender!.name, targetName: attacker!.name });
    await waitForResolution(world);

    // Walk until the bulk commit is recorded and no attack has been made yet.
    const reason = await walk(world, ({ state }) => state.committedInitiativeOrders.length > 0);
    expect(reason).toBe("stopped");
    const committed = await readRoundState(gmPage.request, world.encounterId);
    expect(
      committed.events.some((event) => event.type === "initiative"),
      "a bulk commit, not individual rolls",
    ).toBe(false);
    await gmPage.reload();
    await expect(gmPage.getByRole("heading", { name: "Combat Round Manager" })).toBeVisible();
    await selectGmInspectorParticipant(gmPage, defender!.name);
    await gmPage.waitForTimeout(500);
    const afterCommit = await readGm(gmPage);
    console.log(`#836 bulk commit: ${JSON.stringify(afterCommit)}`);
    expect(afterCommit.inspectorHeading).toContain(defender!.name);
    expect(afterCommit.lastAction).toMatch(
      /^Last action: GM committed initiative for all combatants/,
    );
    expect(afterCommit.lastAction).not.toContain(`Last action: ${defender!.name}`);

    // The next real action (the attack) replaces it.
    const next = await walk(
      world,
      ({ state }) => incomingAttacks(state, defender!.combatantId).length > 0,
      { skip: [/^Commit defense review$/] },
    );
    expect(next).toBe("stopped");
    await gmPage.reload();
    await expect(gmPage.getByRole("heading", { name: "Combat Round Manager" })).toBeVisible();
    await selectGmInspectorParticipant(gmPage, defender!.name);
    await gmPage.waitForTimeout(500);
    const afterAttack = await readGm(gmPage);
    console.log(`#836 after attack: ${JSON.stringify({ line: afterAttack.lastAction })}`);
    expect(afterAttack.lastAction).toBe(
      `Last action: ${attacker!.name} attacked ${defender!.name} — miss`,
    );
    await world.playerContextClose();
  });
});
