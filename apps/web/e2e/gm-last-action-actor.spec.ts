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
  await page
    .getByRole("button", { name: /^(Declare action|Update declaration)$/ })
    .first()
    .click();
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

    // This two-combatant world commits initiative in bulk; individually rolled initiative and the
    // bulk line have their own cases below.
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

  test("a bulk initiative commit produces no line: the previous real action stays, then the next real action replaces it", async ({
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
    // The bulk commit is no action: the line keeps the last declaration (the defender's parry).
    expect(afterCommit.lastAction).toMatch(/^Last action: .+ declared /);
    expect(afterCommit.lastAction).not.toContain("GM committed");
    expect(afterCommit.lastAction).not.toContain("initiative");

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

  for (const scenario of [
    { bulk: false, name: "three combatants with individually rolled initiative" },
    { bulk: true, name: "two combatants with a bulk initiative commit" },
  ]) {
    test(`${scenario.name}: through the Phase 2 review to Round End and into round 2, the line follows the newest action`, async ({
      browser,
      page: gmPage,
    }) => {
      test.setTimeout(1_200_000);
      const world = await openWorld({
        browser,
        entries: scenario.bulk
          ? [
              { key: "halgeir", skills: { dodge: 1, weapon: 60 } },
              { key: "gangho", skills: { dodge: 1, weapon: 9 } },
            ]
          : [
              { key: "halgeir", skills: { dodge: 1, weapon: 60 } },
              // Bramwell attacks Halgeir, so each defender faces exactly one attacker and one parry.
              { key: "bramwell", skills: { dodge: 1, weapon: 1 } },
              { key: "gangho", skills: { dodge: 1, weapon: 9 } },
            ],
        gmPage,
        tag: scenario.bulk ? "last-action-round-bulk" : "last-action-round-three",
      });
      const everyone = Object.values(world.combatants);
      const { halgeir, gangho } = world.combatants as Record<string, Combatant>;
      const bramwell = world.combatants.bramwell;
      await openGmCombat(world);
      const result = await walkRoundAgainstOracle({
        declarations: [
          { actionId: "attack_parry", targetName: gangho!.name, who: halgeir!.name },
          ...(bramwell
            ? [{ actionId: "attack_parry", targetName: halgeir!.name, who: bramwell.name }]
            : []),
          // Take-back: the GM re-declares an earlier actor (Update declaration).
          { actionId: "attack_parry", targetName: gangho!.name, who: halgeir!.name },
          { actionId: "parry", targetName: halgeir!.name, who: gangho!.name },
        ],
        everyone,
        world,
      });
      console.log(`#836 round walk ${scenario.name}: ${JSON.stringify(result.reached)}`);
      expect(result.violations, result.violations.join("\n")).toEqual([]);
      expect(result.reached.phase2Review, "the walk reached the Phase 2 review").toBe(true);
      expect(result.reached.roundEnd, "the walk reached Round End").toBe(true);
      expect(result.reached.round2, "the walk crossed into round 2").toBe(true);
      expect(result.reached.laterActionAfterInitiative).toBe(true);
      if (scenario.bulk) {
        // Both the Phase 1 and the Phase 2 bulk commits were passed, with the line following the
        // previous real action (checked at every press, including Round End).
        expect(result.reached.bulkCommits).toBe(2);
      } else {
        expect(result.reached.individualInitiative).toBeGreaterThan(0);
      }
      await world.playerContextClose();
    });
  }
});

const ROUND_CONTROLS = [
  ...WALK_CONTROLS,
  /^Begin round end$/,
  /^Roll health check$/,
  /^Commit participant SU review$/,
  /^Mark SU review complete$/,
  /^Complete effect review$/,
  /^Roll distance control for /,
  /^Apply distance control$/,
  /^Start next round$/,
  /^Open next round$/,
];

interface OracleAction {
  actor: string;
  key: string;
  order: [number, number];
  pattern: RegExp;
  what: string;
}

/**
 * The independent oracle: from the server's own round state, the actions that exist now. A press
 * that creates none must leave the line exactly as it was; a press that creates one or more must
 * show the newest of them. "Newest" is the round's command journal order, then event sequence.
 */
function oracleActions(state: CombatRoundState, nameOf: (id?: string) => string): OracleAction[] {
  const round = state.roundNumber;
  const commands = state.commands.filter((command) => command.roundNumber === round);
  const journalIndex = new Map(commands.map((command, index) => [command.id, index]));
  const actions: OracleAction[] = [];
  const name = (id?: string) => escapeForRegExp(nameOf(id));
  for (const [index, command] of commands.entries()) {
    if (command.type === "declare_action") {
      actions.push({
        actor: nameOf(command.participantId),
        key: `declare:${command.id}:${command.createdAt}`,
        order: [index, 0],
        pattern: new RegExp(`^Last action: ${name(command.participantId)} declared `),
        what: "declaration",
      });
    }
    // A bulk initiative commit (no individual rolls in its phase) is deliberately not an action:
    // it produces no line, so the previous real action stays (WO-836-S1/A2).
  }
  for (const event of state.events) {
    if (event.roundNumber !== round) continue;
    const order: [number, number] = [journalIndex.get(event.commandId ?? "") ?? -1, event.sequence];
    const publicOutcome = (event.facts.publicOutcome ?? {}) as Record<string, unknown>;
    const involved = (event.facts.involvedOutcome ?? {}) as Record<string, unknown>;
    const attackerId = event.attackerParticipantId ?? event.actorParticipantId;
    const defenderId = event.defenderParticipantId ?? event.targetParticipantId;
    if (event.type === "initiative" && typeof publicOutcome.total === "number") {
      actions.push({
        actor: nameOf(event.ownerParticipantId),
        key: `event:${event.id}`,
        order,
        pattern: new RegExp(
          `^Last action: ${name(event.ownerParticipantId)} rolled Initiative ${publicOutcome.total}$`,
        ),
        what: "individual initiative",
      });
    } else if (
      event.type === "attack" &&
      attackerId &&
      defenderId &&
      (typeof publicOutcome.hit === "boolean" || typeof publicOutcome.grazing === "boolean")
    ) {
      actions.push({
        actor: nameOf(attackerId),
        key: `event:${event.id}`,
        order,
        pattern: new RegExp(
          `^Last action: ${name(attackerId)} attacked ${name(defenderId)} — (hit|miss|graze)$`,
        ),
        what: "attack",
      });
    } else if (event.type === "parry" && typeof publicOutcome.success === "boolean") {
      const parrier = event.defenderParticipantId ?? event.actorParticipantId;
      actions.push({
        actor: nameOf(parrier),
        key: `event:${event.id}`,
        order,
        pattern: new RegExp(`^Last action: ${name(parrier)} parried `),
        what: "parry",
      });
    } else if (
      event.type === "damage_committed" &&
      attackerId &&
      defenderId &&
      typeof involved.finalCommittedDamage === "number"
    ) {
      actions.push({
        actor: nameOf(attackerId),
        key: `event:${event.id}`,
        order,
        pattern: new RegExp(
          `^Last action: ${name(attackerId)} dealt \\d+ damage to ${name(defenderId)}$`,
        ),
        what: "damage",
      });
    }
  }
  return actions;
}

function newestOf(actions: readonly OracleAction[]): OracleAction | undefined {
  return [...actions].sort(
    (left, right) => left.order[0] - right.order[0] || left.order[1] - right.order[1],
  )[actions.length - 1];
}

/**
 * Declares, then presses one canonical GM control at a time from the declaration step, through
 * Phase 1, the Phase 2 modifier review and Round End, into round 2 (where the line must name no
 * round-1 actor, live and after a reload). After every press it reads the line live (no reload) while
 * each participant other than the expected actor is inspected, and compares it with the oracle.
 * Violations are collected rather than thrown at the first one, so a run lists every bad moment.
 */
async function walkRoundAgainstOracle(input: {
  declarations: Array<{ actionId: string; targetName: string; who: string }>;
  everyone: Combatant[];
  world: World;
}) {
  const { world } = input;
  const page = world.gmPage;
  const nameOf = (id?: string) =>
    input.everyone.find((combatant) => combatant.combatantId === id)?.name ?? `(unknown ${id})`;
  const violations: string[] = [];
  const reached = {
    bulkCommits: 0,
    individualInitiative: 0,
    laterActionAfterInitiative: false,
    phase2Review: false,
    presses: 0,
    round2: false,
    roundEnd: false,
  };
  const seen = new Set<string>();
  const bulkPhasesSeen = new Set<string>();
  let expected: OracleAction | undefined;
  let expectedLine: string | null = null;
  let sawInitiative = false;

  const check = async (moment: string) => {
    // A press can trigger follow-up commands; read the round only once its journal is settled.
    let state = await readRoundState(page.request, world.encounterId);
    for (let attempt = 0; attempt < 10; attempt += 1) {
      await page.waitForTimeout(800);
      const again = await readRoundState(page.request, world.encounterId);
      const settled =
        again.commands.length === state.commands.length &&
        again.events.length === state.events.length &&
        again.currentStep === state.currentStep;
      state = again;
      if (settled) break;
    }
    for (const command of state.commands) {
      if (
        command.roundNumber === 1 &&
        command.type === "commit_phase_initiative_resolution" &&
        !state.commands.some((other) => other.type === `roll_initiative_${command.phase}`)
      ) {
        bulkPhasesSeen.add(`${command.phase}`);
      }
    }
    reached.bulkCommits = bulkPhasesSeen.size;
    if (bulkPhasesSeen.size > 0) sawInitiative = true;
    const actions = oracleActions(state, nameOf);
    const fresh = actions.filter((action) => !seen.has(action.key));
    for (const action of actions) seen.add(action.key);
    const newest = newestOf(fresh);
    if (state.roundNumber === 2 && !reached.round2) {
      reached.round2 = true;
      expected = undefined;
      expectedLine = null;
    }
    if (newest) {
      expected = newest;
      expectedLine = null;
      if (newest.what === "individual initiative") reached.individualInitiative += 1;
      if (/initiative/.test(newest.what)) sawInitiative = true;
      else if (sawInitiative && newest.what !== "declaration") {
        reached.laterActionAfterInitiative = true;
      }
    }
    if (state.currentStep === "review_phase_2_modifiers") reached.phase2Review = true;
    if (state.currentStep === "round_summary") reached.roundEnd = true;
    const inspectable = input.everyone.filter((combatant) => combatant.name !== expected?.actor);
    for (const combatant of inspectable) {
      await selectGmInspectorParticipant(page, combatant.name);
      await page.waitForTimeout(400);
      let read = await readGm(page);
      if (expected && expectedLine === null) {
        // A new action: allow the live view to re-render, then pin its exact text.
        for (
          let attempt = 0;
          attempt < 20 && !expected.pattern.test(read.lastAction ?? "");
          attempt += 1
        ) {
          await page.waitForTimeout(500);
          read = await readGm(page);
        }
      }
      const where = `${moment} [step ${state.currentStep}, round ${state.roundNumber}, inspecting ${combatant.name}]`;
      console.log(
        `#836 oracle ${where}: expected ${expected ? `${expected.what} by ${expected.actor}` : "no line"}; line ${JSON.stringify(read.lastAction)}`,
      );
      if (!read.inspectorHeading.includes(combatant.name)) {
        // E.g. Round End, where the inspector shows the round rather than a participant.
        console.log(
          `#836 note ${where}: inspector heading ${JSON.stringify(read.inspectorHeading)}`,
        );
      }
      if (read.currentStepResultsRegions !== 0) {
        violations.push(`${where}: the GM "Current step results" box is back`);
      }
      if (read.lastAction?.includes("GM committed")) {
        violations.push(`${where}: a bulk initiative commit is on the line: ${read.lastAction}`);
      }
      if (!expected) {
        if (read.lastAction !== null) {
          violations.push(`${where}: expected no line, read ${JSON.stringify(read.lastAction)}`);
        }
        continue;
      }
      if (!expected.pattern.test(read.lastAction ?? "")) {
        violations.push(
          `${where}: expected ${expected.what} by ${expected.actor} (${expected.pattern.source}), read ${JSON.stringify(read.lastAction)}`,
        );
        continue;
      }
      if (expectedLine === null) {
        expectedLine = read.lastAction;
      } else if (read.lastAction !== expectedLine) {
        violations.push(
          `${where}: no new action, but the line changed from ${JSON.stringify(expectedLine)} to ${JSON.stringify(read.lastAction)}`,
        );
      }
    }
  };

  const declareAll = async (roundLabel: string) => {
    for (const declaration of input.declarations) {
      await declare(world, declaration);
      await page.waitForTimeout(900);
      await check(`${roundLabel}: ${declaration.who} declared ${declaration.actionId}`);
    }
  };

  await check("start");
  await declareAll("round 1");
  await waitForResolution(world);
  let repeat = { commands: -1, control: "", count: 0 };
  let blocked = { commands: -1, controls: new Set<string>() };
  let reloadedAt = -1;
  for (let step = 0; step < 160; step += 1) {
    const state = await readRoundState(page.request, world.encounterId);
    if (state.roundNumber >= 2) {
      // Round 2 is open (its Combat Experience step): the line must name no round-1 actor, live
      // (checked after the press above) and after a reload.
      await page.reload();
      await expect(page.getByRole("heading", { name: "Combat Round Manager" })).toBeVisible();
      await check("round 2 open, after a reload");
      break;
    }
    const currentTask = page.getByRole("button", { name: /^(Resume )?current task$/i });
    if (await currentTask.count()) {
      await currentTask.first().click();
      await page.waitForTimeout(500);
    }
    const buttons = await enabledButtonNames(page);
    if (blocked.commands !== state.commands.length) {
      blocked = { commands: state.commands.length, controls: new Set() };
    }
    const control = buttons.find(
      (label) => ROUND_CONTROLS.some((rx) => rx.test(label)) && !blocked.controls.has(label),
    );
    if (!control && reloadedAt !== state.commands.length) {
      // The GM's current-task focus can hide the next control; one reload restores it.
      reloadedAt = state.commands.length;
      await page.reload();
      await expect(page.getByRole("heading", { name: "Combat Round Manager" })).toBeVisible();
      await page.waitForTimeout(1500);
      continue;
    }
    if (!control) {
      violations.push(
        `walk stalled at ${state.currentStep} round ${state.roundNumber}: ${JSON.stringify(buttons.slice(0, 30))}`,
      );
      break;
    }
    // A control that records nothing, pressed again and again, is a stall, not progress.
    repeat =
      repeat.control === control && repeat.commands === state.commands.length
        ? { ...repeat, count: repeat.count + 1 }
        : { commands: state.commands.length, control, count: 1 };
    if (repeat.count > 2) {
      // E.g. a defender who already parried this phase: try the next canonical control instead.
      console.log(
        `#836 walk: "${control}" records nothing at ${state.currentStep}; buttons ${JSON.stringify(buttons.slice(0, 40))}`,
      );
      blocked.controls.add(control);
      repeat = { commands: -1, control: "", count: 0 };
      continue;
    }
    await page.getByRole("button", { name: control, exact: true }).first().click();
    await page.waitForTimeout(1500);
    reached.presses += 1;
    if (control === "Open next round") reached.roundEnd = true;
    await check(`press ${reached.presses} "${control}"`);
  }
  return { reached, violations };
}
