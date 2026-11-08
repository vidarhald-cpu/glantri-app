import { createHash } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
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
 * Forgejo #874 (WO-874-S1 / S2 / A1) — rendered GM evidence that the defense review is bound to
 * the attack under resolution, driven through real attacks.
 *
 * Every attack, review, parry and damage step here is pressed on the real GM surface, so each one
 * goes through its real route; only the Combat Experience opening is composed, as the #877 spec
 * does. Dice are real. The fixtures make the outcome reliable instead: a highly skilled attacker
 * against a defender with no Dodge to speak of connects, and an unskilled attacker against a
 * defender with a very high Dodge misses. Each case reads the outcome it needs from the stored
 * state and fails if the dice produced the other one.
 *
 * Cases:
 * - **miss**: a visible attacker's melee miss — no defense-review surface, no review task, the
 *   miss recorded at the attack commit;
 * - **hit**: both sources default to included, an untick changes the mini-table row, and the
 *   Parry the server then resolves uses the same row's value;
 * - **two attackers**: while the GM reviews the second attack, the panel shows that attack's own
 *   allocation (both included) and not the first attack's committed review (shield excluded);
 * - **Feint**: a participant who declared Feint - Attack is attacked; the review offers both
 *   sources, both included, and an untick moves that panel's mini-table; the player's own
 *   declaration surface for that Feint is read and hashed for the before/after comparison.
 *
 * Reads are atomic: every rectangle and value is taken in one `page.evaluate` together with
 * `scrollY` and the usable width, because this page autoscrolls after mount.
 *
 * Captures: `<repo>/.local-artifacts/874/captures/<label>-<case>-<usable width>.png`, at usable
 * widths 1280 and 1024 (the viewport is widened by the measured scrollbar so the document's own
 * `clientWidth` is the stated width). The label is `after` unless `E874_CAPTURE_LABEL` is `before`
 * (a run against the baseline build) or `prerepair` (the head before a QA repair). Most
 * expectations are soft so the same spec produces that evidence and shows each probe capable of
 * failing.
 */

const CAPTURE_LABEL =
  process.env.E874_CAPTURE_LABEL === "before" || process.env.E874_CAPTURE_LABEL === "prerepair"
    ? process.env.E874_CAPTURE_LABEL
    : "after";
const CAPTURE_DIR = path.resolve(__dirname, "../../../.local-artifacts/874/captures");
const USABLE_WIDTHS = [1280, 1024] as const;

const PRIMARY_WEAPON_TEMPLATE = "weapon-template-longsword";
const SHIELD_TEMPLATE = "shield-template-medium-metal-shield";

/** The canonical GM controls a walk may press, first enabled one wins. */
const WALK_CONTROLS = [
  /^Roll Combat Experience$/,
  /^Complete modifier review$/,
  /^Roll initiative$/,
  /^Roll feint/i,
  /^Commit feint/i,
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

interface SurfaceRead {
  checkboxes: Array<{ checked: boolean; name: string }>;
  combinationLine: string | null;
  commitControlPresent: boolean;
  heading: string;
  missedTextPresent: boolean;
  phase1DefenseCells: string[];
  phase1ParrySourceSelectors: number;
  /** The Phase 1 Parry source selector's state: disabled, and the option it shows. */
  phase1ParrySource: { disabled: boolean; selected: string } | null;
  regionPresent: boolean;
  scrollY: number;
  snapshotPanels: string[];
  usableWidth: number;
}

/** One atomic read of the GM surface: review region, snapshot panels, the Phase 1 mini-table. */
async function readSurface(page: Page): Promise<SurfaceRead> {
  return page.evaluate(() => {
    const clean = (value: string | null | undefined) => (value ?? "").replace(/\s+/g, " ").trim();
    const region = document.querySelector('[aria-label="Defense review choices"]');
    const checkboxes = [...(region?.querySelectorAll('input[type="checkbox"]') ?? [])].map(
      (node) => {
        const input = node as HTMLInputElement;
        return { checked: input.checked, name: clean(input.closest("label")?.textContent) };
      },
    );
    const spans = [...(region?.querySelectorAll(":scope > span") ?? [])].map((node) =>
      clean(node.textContent),
    );
    const phase1 = [...document.querySelectorAll("section")].find((candidate) => {
      const heading = candidate.firstElementChild?.firstElementChild;
      return heading?.tagName === "STRONG" && heading.textContent === "Phase 1";
    });
    const headersOf = (table: Element) =>
      [...table.querySelectorAll("th")].map((cell) => clean(cell.textContent));
    const defenseTable = phase1
      ? [...phase1.querySelectorAll("table")].find((table) => headersOf(table).includes("DB"))
      : undefined;
    return {
      checkboxes,
      combinationLine: spans.find((text) => text.includes(" · P ")) ?? null,
      commitControlPresent: [...document.querySelectorAll("button")].some(
        (button) => clean(button.textContent) === "Commit defense review",
      ),
      heading: clean(
        [...document.querySelectorAll("h3")].find((node) =>
          (node.textContent ?? "").startsWith("Combat inspector — "),
        )?.textContent,
      ),
      missedTextPresent: /\bmissed\b/i.test(document.body.textContent ?? ""),
      phase1DefenseCells: defenseTable
        ? [...defenseTable.querySelectorAll("tbody td")].map((cell) => clean(cell.textContent))
        : [],
      phase1ParrySourceSelectors:
        phase1?.querySelectorAll('select[aria-label="Parry source"]').length ?? 0,
      phase1ParrySource: (() => {
        const select = phase1?.querySelector('select[aria-label="Parry source"]') as
          | HTMLSelectElement
          | null
          | undefined;
        return select
          ? {
              disabled: select.disabled,
              selected: clean(select.selectedOptions[0]?.textContent),
            }
          : null;
      })(),
      regionPresent: Boolean(region),
      scrollY: Math.round(window.scrollY),
      snapshotPanels: [
        ...document.querySelectorAll('[aria-label="Latest committed defense review"]'),
      ].map((node) => clean(node.textContent)),
      usableWidth: document.documentElement.clientWidth,
    };
  });
}

function note(what: string, read: SurfaceRead): string {
  return `${what} (scrollY ${read.scrollY}, usable ${read.usableWidth}px): ${JSON.stringify(read)}`;
}

/** The DB | DM | P values of a combination line, for comparison with a mini-table row. */
function combinationValues(line: string | null): string[] {
  const match = /· DB (.+?) · DM (.+?) · P (.+)$/.exec(line ?? "");
  return match ? [match[1]!, match[2]!, match[3]!] : [];
}

/**
 * True when the mini-table's DB and DM cells are this row's. Its P cell is the Parry in force for
 * the attack under resolution — the row's base plus that attack's modifiers — so P is compared as a
 * delta (`parryMovesWith`) and, once rolled, against what the server resolved.
 */
function tableShows(cells: string[], values: string[]): boolean {
  return values.length === 3 && cells.slice(-3, -1).join("|") === values.slice(0, 2).join("|");
}

/**
 * How the mini-table's P moved against the combination row's base. P is the base after the
 * attack's workbook percentage adjustment, which is not linear, so only the direction is compared;
 * the exact value is checked against the Parry the server resolves.
 */
function parryMovesWith(input: { after: SurfaceRead; before: SurfaceRead }): {
  combinationDelta: number;
  tableDelta: number;
} {
  const p = (read: SurfaceRead) => Number(read.phase1DefenseCells.at(-1));
  const c = (read: SurfaceRead) => Number(combinationValues(read.combinationLine)[2]);
  return {
    combinationDelta: c(input.after) - c(input.before),
    tableDelta: p(input.after) - p(input.before),
  };
}

/** Full-page captures at usable widths 1280 and 1024, measured from the document itself. */
async function captureAtUsableWidths(page: Page, name: string): Promise<string[]> {
  mkdirSync(CAPTURE_DIR, { recursive: true });
  const written: string[] = [];
  for (const width of USABLE_WIDTHS) {
    await page.setViewportSize({ height: 900, width });
    const usable = await page.evaluate(() => document.documentElement.clientWidth);
    if (usable !== width) {
      await page.setViewportSize({ height: 900, width: width + (width - usable) });
    }
    await page.waitForTimeout(400);
    const measured = await page.evaluate(() => document.documentElement.clientWidth);
    const file = path.join(CAPTURE_DIR, `${CAPTURE_LABEL}-${name}-${measured}.png`);
    await page.screenshot({ fullPage: true, path: file });
    written.push(file);
    console.log(`#874 capture ${name}: usable ${measured}px -> ${file}`);
  }
  await page.setViewportSize({ height: 900, width: 1440 });
  return written;
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
    name: `Issue 874 ${input.tag} ${suffix}`,
    status: "active",
  });
  const campaignId = campaign.campaign.id;
  const scenario = await post<{ scenario: { id: string } }>(
    gmPage.request,
    `/campaigns/${campaignId}/scenarios`,
    { name: `Issue 874 ${input.tag} Scenario ${suffix}`, status: "live" },
  );
  const scenarioId = scenario.scenario.id;
  const combatants: Record<string, Combatant> = {};
  for (const entry of input.entries) {
    const characterId = `issue-874-${input.tag}-${entry.key}-${suffix}`;
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
      combatantId: `issue-874-${input.tag}-${entry.key}-combatant-${suffix}`,
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
        id: `issue-874-${input.tag}-encounter-${suffix}`,
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
        title: `Issue 874 ${input.tag} ${suffix}`,
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
        `#874 walk stalled at ${state.currentStep}: ${JSON.stringify(buttons.slice(0, 30))}`,
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

/**
 * #874 (amendment A5). The walk-based cases need a real attack to connect, and the dice are real:
 * under the 2026-11-08 ruling a visible attacker's miss opens no defense review, so a case whose
 * attack misses never reaches the review it measures. Each such case therefore runs in a fresh
 * world up to `CONNECTING_ATTEMPTS` times. A failed attempt reads the stored state and records why
 * (the incoming attacks, their outcome, and the misses recorded without a review), and only a run
 * with no connecting attack in all attempts fails — explicitly, with every recorded reason.
 *
 * N = 5. The skilled attacker connects on the large majority of rolls (lookup = d20 + OB 38 −
 * DB 7..11, so a miss needs an unusually low roll); across this lane's runs before A5 exactly one
 * walk ended without its review. Five independent attempts leave a residual failure chance below
 * one in three thousand even at a pessimistic one-in-five miss rate (0.2^5).
 */
const CONNECTING_ATTEMPTS = 5;

async function withConnectingAttack(
  label: string,
  attemptCase: (attempt: number) => Promise<string | undefined>,
): Promise<void> {
  const reasons: string[] = [];
  for (let attempt = 1; attempt <= CONNECTING_ATTEMPTS; attempt += 1) {
    const retryReason = await attemptCase(attempt);
    if (retryReason === undefined) {
      console.log(
        `#874 ${label}: connected on attempt ${attempt}${reasons.length ? `; earlier: ${reasons.join(" | ")}` : ""}`,
      );
      return;
    }
    reasons.push(`attempt ${attempt}: ${retryReason}`);
    console.log(`#874 retry ${label} attempt ${attempt}: ${retryReason}`);
  }
  throw new Error(
    `${label}: no connecting attack within ${CONNECTING_ATTEMPTS} attempts — ${reasons.join(" | ")}`,
  );
}

/** Why a walk ended without the review its case needs, read from the stored state. */
async function noReviewReason(
  world: World,
  defenderParticipantId: string,
  expectation: string,
): Promise<string> {
  const state = await readRoundState(world.gmPage.request, world.encounterId);
  const attacks = incomingAttacks(state, defenderParticipantId).map((attack) => ({
    hit: attack.hit,
    lookupTotal: attack.lookupTotal,
    phase: attack.phase,
  }));
  const missesWithoutReview = state.commands.filter(
    (command) => command.type === "roll_attack" && command.facts.defenseReviewNotOwed === true,
  ).length;
  await world.playerContextClose();
  return `${expectation} — not reached (step ${state.currentStep}); incoming attacks ${JSON.stringify(attacks)}; misses recorded with defenseReviewNotOwed: ${missesWithoutReview}`;
}

test.describe("Defense review is bound to the attack under resolution (#874)", () => {
  test.use({ storageState: "e2e/.auth/gm.json" });

  test("a visible attacker's melee miss asks for no defense review at all", async ({
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
      tag: "miss",
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

    // Walk until the attacker's attack is recorded. Never press a defense review.
    const reason = await walk(
      world,
      ({ state }) => incomingAttacks(state, defender!.combatantId).length > 0,
      { skip: [/^Commit defense review$/] },
    );
    expect(reason).toBe("stopped");
    const state = await readRoundState(gmPage.request, world.encounterId);
    const [attack] = incomingAttacks(state, defender!.combatantId);
    console.log(
      `#874 miss case attack: ob=${attack?.ob} rollTotal=${attack?.rollTotal} defenderDb=${attack?.defenderDb} lookupTotal=${attack?.lookupTotal} hit=${attack?.hit}`,
    );
    expect(attack?.hit, "the fixture's unskilled attack must miss").toBe(false);

    // Route/persisted state: resolved at the attack commit, no review owed, no snapshot.
    const rollCommand = [...state.commands]
      .reverse()
      .find((command) => command.type === "roll_attack");
    const resolution = state.phaseResolutionResults.find(
      (entry) => entry.attackResultId === rollCommand?.facts.attackResultId,
    );
    console.log(
      `#874 miss case persisted: cursor=${JSON.stringify(state.phaseResolutionCursor)} defenseReviewNotOwed=${String(rollCommand?.facts.defenseReviewNotOwed)} resolution=${Boolean(resolution)} snapshots=${state.defenseSnapshots.length}`,
    );
    expect.soft(rollCommand?.facts.defenseReviewNotOwed).toBe(true);
    expect.soft(resolution?.defenseSnapshotId).toBeUndefined();
    expect.soft(Boolean(resolution)).toBe(true);
    expect.soft(state.defenseSnapshots).toEqual([]);
    expect.soft(state.phaseResolutionCursor?.substep).not.toBe("defense");

    // Rendered: on the defender's own panel and on the current task, no review surface at all.
    await gmPage.reload();
    await expect(gmPage.getByRole("heading", { name: "Combat Round Manager" })).toBeVisible();
    await selectGmInspectorParticipant(gmPage, defender!.name);
    await gmPage.waitForTimeout(800);
    const onDefender = await readSurface(gmPage);
    console.log(`#874 miss defender: ${JSON.stringify(onDefender)}`);
    // Positive control: the inspected defender's Phase 1 defense mini-table is mounted.
    expect(onDefender.phase1DefenseCells.length, note("miss defender", onDefender)).toBeGreaterThan(
      0,
    );
    expect.soft(onDefender.commitControlPresent, note("miss defender", onDefender)).toBe(false);
    expect.soft(onDefender.regionPresent, note("miss defender", onDefender)).toBe(false);
    await captureAtUsableWidths(gmPage, "miss");
    const currentTask = gmPage.getByRole("button", { name: /^(Resume )?current task$/i });
    if (await currentTask.count()) await currentTask.first().click();
    await gmPage.waitForTimeout(800);
    const onTask = await readSurface(gmPage);
    console.log(`#874 miss current task: ${JSON.stringify(onTask)}`);
    expect.soft(onTask.commitControlPresent, note("miss current task", onTask)).toBe(false);
    expect.soft(onTask.regionPresent, note("miss current task", onTask)).toBe(false);
    await world.playerContextClose();
  });

  test("a hit offers both sources by default; an untick moves the row and the resolved Parry", async ({
    browser,
    page: gmPage,
  }) => {
    test.setTimeout(900_000);
    await withConnectingAttack("hit case", async () => {
      const world = await openWorld({
        browser,
        entries: [
          { key: "attacker", skills: { dodge: 1, weapon: 60 } },
          { key: "defender", skills: { dodge: 1, weapon: 9 } },
        ],
        gmPage,
        tag: "hit",
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
      if (reason !== "stopped") {
        return noReviewReason(
          world,
          defender!.combatantId,
          "the walk must reach the defense review",
        );
      }
      const state = await readRoundState(gmPage.request, world.encounterId);
      const [attack] = incomingAttacks(state, defender!.combatantId);
      console.log(
        `#874 hit case attack: ob=${attack?.ob} rollTotal=${attack?.rollTotal} defenderDb=${attack?.defenderDb} hit=${attack?.hit}`,
      );
      expect(attack?.hit, "the fixture's skilled attack must connect").toBe(true);
      await selectGmInspectorParticipant(gmPage, defender!.name);
      await expect(gmPage.getByRole("checkbox", { name: /^Off hand: / })).toBeVisible();

      const both = await readSurface(gmPage);
      console.log(`#874 hit both: ${JSON.stringify(both)}`);
      expect(both.regionPresent, note("hit both", both)).toBe(true);
      expect(both.checkboxes.length, note("hit both", both)).toBe(2);
      expect(
        both.checkboxes.every((entry) => entry.checked),
        note("hit both", both),
      ).toBe(true);
      expect
        .soft(
          tableShows(both.phase1DefenseCells, combinationValues(both.combinationLine)),
          note("hit both: the mini-table shows the row in force", both),
        )
        .toBe(true);
      await captureAtUsableWidths(gmPage, "hit");

      // Untick the shield for this attack: the row in force becomes the weapon-only row.
      await gmPage.getByRole("checkbox", { name: /^Off hand: / }).click();
      const weaponOnly = await readSurface(gmPage);
      console.log(`#874 hit weapon only: ${JSON.stringify(weaponOnly)}`);
      expect(weaponOnly.combinationLine, note("weapon only", weaponOnly)).not.toBe(
        both.combinationLine,
      );
      expect
        .soft(
          tableShows(weaponOnly.phase1DefenseCells, combinationValues(weaponOnly.combinationLine)),
          note("weapon only: the mini-table shows the row in force", weaponOnly),
        )
        .toBe(true);
      const weaponOnlyParry = combinationValues(weaponOnly.combinationLine)[2];
      const hitDelta = parryMovesWith({ after: weaponOnly, before: both });
      console.log(`#874 hit parry delta on untick: ${JSON.stringify(hitDelta)}`);
      expect
        .soft(Math.sign(hitDelta.tableDelta), note("weapon only: P follows the row", weaponOnly))
        .toBe(Math.sign(hitDelta.combinationDelta));
      expect.soft(hitDelta.tableDelta, note("weapon only: P moved", weaponOnly)).not.toBe(0);
      const reviewTimeParry = weaponOnly.phase1DefenseCells.at(-1);

      const committed = gmPage.waitForResponse((response) =>
        response.url().includes("/combat-round/commit-defense-review"),
      );
      await gmPage.getByRole("button", { name: "Commit defense review", exact: true }).click();
      expect((await committed).ok()).toBe(true);
      await gmPage.waitForTimeout(1500);

      const afterCommit = await readRoundState(gmPage.request, world.encounterId);
      const snapshot = afterCommit.defenseSnapshots.at(-1);
      console.log(`#874 hit committed snapshot sources: ${JSON.stringify(snapshot?.sources)}`);
      expect(snapshot?.sources.find((source) => source.slot === "offHand")?.decision).toBe(
        "gm_excluded",
      );

      // Walk to the Parry roll, read the panel, roll, and compare with what the server resolved.
      const toParry = await walk(world, ({ buttons }) => buttons.includes("Roll parry"));
      if (toParry === "stopped") {
        await selectGmInspectorParticipant(gmPage, defender!.name);
        await gmPage.waitForTimeout(800);
        const atParry = await readSurface(gmPage);
        console.log(`#874 hit at parry step: ${JSON.stringify(atParry)}`);
        const parryRequest = gmPage.waitForResponse((response) =>
          response.url().includes("/combat-round/roll-parry"),
        );
        const currentTask = gmPage.getByRole("button", { name: /^(Resume )?current task$/i });
        if (await currentTask.count()) await currentTask.first().click();
        await gmPage.getByRole("button", { name: "Roll parry", exact: true }).first().click();
        expect((await parryRequest).ok()).toBe(true);
        const resolved = await readRoundState(gmPage.request, world.encounterId);
        const parry = resolved.phaseResolutionResults.find(
          (entry) => entry.attackResultId === snapshot?.attackId,
        )?.parryResolution;
        const stored = parry as
          | {
              combinedParryScore?: number;
              modifiedParryBeforeRoll?: number;
              usedMainHand?: boolean;
              usedOffHand?: boolean;
            }
          | undefined;
        console.log(
          `#874 hit resolved parry: ${JSON.stringify({ combinedParryScore: stored?.combinedParryScore, displayedAtParryStepP: atParry.phase1DefenseCells.at(-1), displayedWeaponOnlyRowP: weaponOnlyParry, modifiedParryBeforeRoll: stored?.modifiedParryBeforeRoll, usedMainHand: stored?.usedMainHand, usedOffHand: stored?.usedOffHand })}`,
        );
        // The value the mini-table showed — during the review, under the GM's untick, and at the
        // Parry step — is the value the server resolved the Parry with.
        expect
          .soft(String(stored?.modifiedParryBeforeRoll), note("parry step P", atParry))
          .toBe(atParry.phase1DefenseCells.at(-1));
        expect
          .soft(String(stored?.modifiedParryBeforeRoll), note("review-time P", weaponOnly))
          .toBe(reviewTimeParry);
        expect.soft(String(stored?.combinedParryScore)).toBe(weaponOnlyParry);
        expect.soft(parry && "usedOffHand" in parry ? parry.usedOffHand : undefined).toBe(false);
      } else {
        console.log(`#874 hit: the walk did not reach Roll parry (${toParry}).`);
      }
      await world.playerContextClose();
      return undefined;
    });
  });

  test("an attack_parry defender keeps its Parry source selector while an allocation is in force", async ({
    browser,
    page: gmPage,
  }) => {
    test.setTimeout(900_000);
    await withConnectingAttack("selector case", async () => {
      const world = await openWorld({
        browser,
        entries: [
          { key: "attacker", skills: { dodge: 1, weapon: 60 } },
          { key: "defender", skills: { dodge: 1, weapon: 9 } },
        ],
        gmPage,
        tag: "selector",
      });
      const { attacker, defender } = world.combatants as Record<string, Combatant>;
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
      await waitForResolution(world);

      // Walk to the defender's own review (any other review is committed at its default).
      const reason = await walk(
        world,
        ({ buttons, state }) =>
          buttons.includes("Commit defense review") &&
          state.phaseResolutionCursor?.participantId === defender!.combatantId &&
          state.phaseResolutionCursor.substep === "defense",
      );
      if (reason !== "stopped") {
        return noReviewReason(
          world,
          defender!.combatantId,
          "the walk must reach the attack_parry defender's review",
        );
      }
      await selectGmInspectorParticipant(gmPage, defender!.name);
      await expect(gmPage.getByRole("checkbox", { name: /^Off hand: / })).toBeVisible();
      await gmPage.waitForTimeout(800);
      const both = await readSurface(gmPage);
      console.log(`#874 selector both: ${JSON.stringify(both)}`);
      await captureAtUsableWidths(gmPage, "allocation-selector");
      // QA B1: the selector stays rendered while the allocation is in force.
      expect(both.phase1ParrySourceSelectors, note("selector with allocation", both)).toBe(1);

      await gmPage.getByRole("checkbox", { name: /^Off hand: / }).click();
      const weaponOnly = await readSurface(gmPage);
      console.log(`#874 selector weapon only: ${JSON.stringify(weaponOnly)}`);
      expect(weaponOnly.phase1ParrySourceSelectors, note("selector after untick", weaponOnly)).toBe(
        1,
      );
      // It shows the row in force and is not a second, contradicting chooser.
      const rowName = (read: SurfaceRead) => (read.combinationLine ?? "").split(" · DB ")[0] ?? "";
      expect
        .soft(
          weaponOnly.phase1ParrySource?.selected.startsWith(`${rowName(weaponOnly)} · `),
          note("selector shows the row in force", weaponOnly),
        )
        .toBe(true);
      expect
        .soft(
          both.phase1ParrySource?.selected.startsWith(`${rowName(both)} · `),
          note("both", both),
        )
        .toBe(true);
      expect
        .soft(weaponOnly.phase1ParrySource?.disabled, note("selector disabled", weaponOnly))
        .toBe(true);
      expect
        .soft(both.phase1ParrySource?.selected, note("selector shows both", both))
        .not.toBe(weaponOnly.phase1ParrySource?.selected);
      await world.playerContextClose();
      return undefined;
    });
  });

  test("while the GM reviews the second attack the panel shows that attack, not the first", async ({
    browser,
    page: gmPage,
  }) => {
    test.setTimeout(1_500_000);
    await withConnectingAttack("two-attacker case", async () => {
      const world = await openWorld({
        browser,
        entries: [
          { key: "first", skills: { dodge: 1, weapon: 60 } },
          { key: "second", skills: { dodge: 1, weapon: 60 } },
          { key: "defender", skills: { dodge: 1, weapon: 9 } },
        ],
        gmPage,
        tag: "two",
      });
      const { first, second, defender } = world.combatants as Record<string, Combatant>;
      await openGmCombat(world);
      await declare(world, {
        actionId: "attack_parry",
        who: first!.name,
        targetName: defender!.name,
      });
      await declare(world, {
        actionId: "attack_parry",
        who: second!.name,
        targetName: defender!.name,
      });
      await declare(world, { actionId: "parry", who: defender!.name, targetName: first!.name });
      await waitForResolution(world);

      // First review: untick the shield and commit.
      if (
        (await walk(world, ({ buttons }) => buttons.includes("Commit defense review"))) !==
        "stopped"
      ) {
        return noReviewReason(world, defender!.combatantId, "the walk must reach the first review");
      }
      await selectGmInspectorParticipant(gmPage, defender!.name);
      await expect(gmPage.getByRole("checkbox", { name: /^Off hand: / })).toBeVisible();
      const firstReview = await readSurface(gmPage);
      console.log(`#874 two: first review: ${JSON.stringify(firstReview)}`);
      await gmPage.getByRole("checkbox", { name: /^Off hand: / }).click();
      const firstCommitted = gmPage.waitForResponse((response) =>
        response.url().includes("/combat-round/commit-defense-review"),
      );
      await gmPage.getByRole("button", { name: "Commit defense review", exact: true }).click();
      expect((await firstCommitted).ok()).toBe(true);
      await gmPage.waitForTimeout(1500);
      const afterFirst = await readRoundState(gmPage.request, world.encounterId);
      const firstSnapshot = afterFirst.defenseSnapshots.at(-1)!;
      console.log(
        `#874 two: first snapshot attacker=${firstSnapshot.attackerParticipantId} direction=${firstSnapshot.attackDirection} sources=${JSON.stringify(firstSnapshot.sources.map((source) => [source.slot, source.included, source.decision]))}`,
      );

      // Walk on (parry, damage, ...) until the second attack's review opens.
      const reached = await walk(
        world,
        ({ buttons, state }) =>
          buttons.includes("Commit defense review") && state.defenseSnapshots.length === 1,
      );
      if (reached !== "stopped") {
        return noReviewReason(
          world,
          defender!.combatantId,
          "the walk must reach the second attack's review",
        );
      }
      const atSecond = await readRoundState(gmPage.request, world.encounterId);
      const attacks = incomingAttacks(atSecond, defender!.combatantId);
      console.log(
        `#874 two: incoming attacks ${JSON.stringify(attacks.map((attack) => [attack.attackerParticipantId, attack.hit]))}`,
      );
      await selectGmInspectorParticipant(gmPage, defender!.name);
      await expect(gmPage.getByRole("checkbox", { name: /^Off hand: / })).toBeVisible();
      await gmPage.waitForTimeout(800);
      const secondReview = await readSurface(gmPage);
      console.log(`#874 two: second review: ${JSON.stringify(secondReview)}`);
      // The second attack starts from the default: both included.
      expect(
        secondReview.checkboxes.every((entry) => entry.checked),
        note("second review defaults", secondReview),
      ).toBe(true);
      // The panel shows no committed review of the first attack while the second is under review.
      expect
        .soft(
          secondReview.snapshotPanels.some((text) => text.includes("excluded")),
          note("second review must not show the first attack's committed review", secondReview),
        )
        .toBe(false);
      // Its mini-table shows the second attack's own allocation.
      expect
        .soft(
          tableShows(
            secondReview.phase1DefenseCells,
            combinationValues(secondReview.combinationLine),
          ),
          note("second review: the mini-table shows the second attack's row", secondReview),
        )
        .toBe(true);
      await captureAtUsableWidths(gmPage, "two-attackers-second");

      // Commit the second at the default; its own review then shows both included.
      const secondCommitted = gmPage.waitForResponse((response) =>
        response.url().includes("/combat-round/commit-defense-review"),
      );
      await gmPage.getByRole("button", { name: "Commit defense review", exact: true }).click();
      expect((await secondCommitted).ok()).toBe(true);
      await gmPage.waitForTimeout(1500);
      await selectGmInspectorParticipant(gmPage, defender!.name);
      const afterSecond = await readSurface(gmPage);
      const secondSnapshot = (
        await readRoundState(gmPage.request, world.encounterId)
      ).defenseSnapshots.at(-1)!;
      console.log(
        `#874 two: second snapshot attacker=${secondSnapshot.attackerParticipantId} direction=${secondSnapshot.attackDirection} sources=${JSON.stringify(secondSnapshot.sources.map((source) => [source.slot, source.included, source.decision]))}; panel=${JSON.stringify(afterSecond.snapshotPanels)}`,
      );
      expect(secondSnapshot.attackerParticipantId).not.toBe(firstSnapshot.attackerParticipantId);
      expect
        .soft(
          afterSecond.snapshotPanels.every((text) => !text.includes("excluded")),
          note("after the second commit the panel shows the second attack's review", afterSecond),
        )
        .toBe(true);
      await world.playerContextClose();
      return undefined;
    });
  });

  test("a Feint-Attack defense review offers both sources and an untick moves only that review", async ({
    browser,
    page: gmPage,
  }) => {
    test.setTimeout(900_000);
    await withConnectingAttack("Feint case", async () => {
      const world = await openWorld({
        browser,
        entries: [
          { key: "attacker", skills: { dodge: 1, weapon: 60 } },
          { key: "feinter", player: true, skills: { dodge: 1, weapon: 9 } },
        ],
        gmPage,
        tag: "feint",
      });
      const { attacker, feinter } = world.combatants as Record<string, Combatant>;
      await openGmCombat(world);
      await declare(world, {
        actionId: "feint_attack",
        who: feinter!.name,
        targetName: attacker!.name,
      });
      await declare(world, {
        actionId: "attack_parry",
        who: attacker!.name,
        targetName: feinter!.name,
      });

      // The player's own declaration surface for that Feint, read and hashed once declared.
      const playerPage = await world.playerPage();
      await playerPage.setViewportSize({ height: 900, width: 1440 });
      await playerPage.goto(
        `/campaigns/${world.campaignId}/scenarios/${world.scenarioId}/player/combat`,
      );
      await expect(
        playerPage.locator('section:has(> div > strong:text-is("Phase 1"))').first(),
      ).toBeVisible({ timeout: 30_000 });
      await playerPage.waitForTimeout(1500);
      const playerRead = await playerPage.evaluate(
        (names) => {
          const sections = [...document.querySelectorAll("section")].filter((candidate) => {
            const heading = candidate.firstElementChild?.firstElementChild;
            return (
              heading?.tagName === "STRONG" &&
              (heading.textContent === "Phase 1" || heading.textContent === "Phase 2")
            );
          });
          let html = sections.map((section) => section.outerHTML).join("\n");
          for (const name of names) html = html.split(name).join("<name>");
          html = html.replace(/\d{13}/g, "<suffix>");
          // Equipment item ids are generated per run; the rendered surface is otherwise identical.
          html = html.replace(
            /item-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/g,
            "item-<uuid>",
          );
          return {
            html,
            parrySourceSelectors: sections.map(
              (section) => section.querySelectorAll('select[aria-label="Parry source"]').length,
            ),
            scrollY: Math.round(window.scrollY),
            usableWidth: document.documentElement.clientWidth,
          };
        },
        [feinter!.name, attacker!.name],
      );
      const playerHash = createHash("sha256").update(playerRead.html).digest("hex");
      mkdirSync(CAPTURE_DIR, { recursive: true });
      writeFileSync(
        path.join(CAPTURE_DIR, `${CAPTURE_LABEL}-feint-player-declaration.html`),
        playerRead.html,
      );
      console.log(
        `#874 feint player declaration surface: selectors=${JSON.stringify(playerRead.parrySourceSelectors)} sha256=${playerHash} length=${playerRead.html.length} usable=${playerRead.usableWidth}`,
      );
      expect(playerRead.parrySourceSelectors, "player Feint selector gate unchanged").toEqual([
        0, 0,
      ]);

      await waitForResolution(world);
      const reason = await walk(world, ({ buttons }) => buttons.includes("Commit defense review"));
      if (reason !== "stopped") {
        return noReviewReason(
          world,
          feinter!.combatantId,
          "the walk must reach the Feint-Attack declarer's defense review",
        );
      }
      const state = await readRoundState(gmPage.request, world.encounterId);
      const [attack] = incomingAttacks(state, feinter!.combatantId);
      expect(attack?.hit, "the skilled attack on the feinter must connect").toBe(true);
      await selectGmInspectorParticipant(gmPage, feinter!.name);
      await expect(gmPage.getByRole("checkbox", { name: /^Off hand: / })).toBeVisible();
      await gmPage.waitForTimeout(800);
      const feintBoth = await readSurface(gmPage);
      console.log(`#874 feint review both: ${JSON.stringify(feintBoth)}`);
      expect(feintBoth.checkboxes.map((entry) => entry.name.split(":")[0]).sort()).toEqual([
        "Main hand",
        "Off hand",
      ]);
      expect(
        feintBoth.checkboxes.every((entry) => entry.checked),
        note("feint both", feintBoth),
      ).toBe(true);
      expect
        .soft(
          tableShows(feintBoth.phase1DefenseCells, combinationValues(feintBoth.combinationLine)),
          note("feint both: the mini-table shows the row in force", feintBoth),
        )
        .toBe(true);
      await captureAtUsableWidths(gmPage, "feint");

      await gmPage.getByRole("checkbox", { name: /^Main hand: / }).click();
      const shieldOnly = await readSurface(gmPage);
      console.log(`#874 feint review shield only: ${JSON.stringify(shieldOnly)}`);
      const feintDelta = parryMovesWith({ after: shieldOnly, before: feintBoth });
      console.log(`#874 feint parry delta on untick: ${JSON.stringify(feintDelta)}`);
      expect
        .soft(
          Math.sign(feintDelta.tableDelta),
          note("feint shield only: P follows the row", shieldOnly),
        )
        .toBe(Math.sign(feintDelta.combinationDelta));
      expect(shieldOnly.combinationLine).not.toBe(feintBoth.combinationLine);
      expect
        .soft(
          tableShows(shieldOnly.phase1DefenseCells, combinationValues(shieldOnly.combinationLine)),
          note("feint shield only: the mini-table shows the row in force", shieldOnly),
        )
        .toBe(true);
      const committed = gmPage.waitForResponse((response) =>
        response.url().includes("/combat-round/commit-defense-review"),
      );
      await gmPage.getByRole("button", { name: "Commit defense review", exact: true }).click();
      expect((await committed).ok()).toBe(true);
      const after = await readRoundState(gmPage.request, world.encounterId);
      const snapshot = after.defenseSnapshots.at(-1);
      console.log(`#874 feint committed sources: ${JSON.stringify(snapshot?.sources)}`);
      expect(snapshot?.sources.find((source) => source.slot === "mainHand")?.decision).toBe(
        "gm_excluded",
      );
      // A GM-submitted selection records every source as the GM's decision (`gm_included`).
      expect(snapshot?.sources.find((source) => source.slot === "offHand")?.included).toBe(true);
      await world.playerContextClose();
      return undefined;
    });
  });
});
