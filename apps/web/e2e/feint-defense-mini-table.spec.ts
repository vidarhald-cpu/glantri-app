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
 * Forgejo #877 — Product Owner ruling: the phase panels show their DB/DM/P mini tables by default.
 *
 * Phase 1 of a Feint-Attack used to hide the whole Defense / Parry group on every step (the flag
 * was keyed on the declared action and the phase, not on the step), including at the
 * `P1 Parry/defense resolution` step. This spec binds, on the GM and on the player surface:
 *
 * - the DB/DM/P mini-table is present on Phase 1 of a Feint-Attack, and at the parry step;
 * - Phase 1 of a Feint-Attack still carries no *attack* presentation (OB / DMB / Attack mode);
 * - the ordinary Single attack, and Parry, are unchanged: both phases keep the group;
 * - the parry source selector stays absent for a Feint-Attack (its gate is unchanged);
 * - the feint modifier measurement the issue owes: the defending participant's DB/DM/P read from
 *   the rendered panel before and after the feint is committed.
 *
 * Every rendered read is taken inside one `page.evaluate` — these pages autoscroll after mount, so
 * reads across `await` boundaries straddle the scroll.
 *
 * The Defender attacks the Feinter in Phase 1, so the Feinter (declared Feint - Attack) reaches a
 * real `P1 Parry/defense resolution` step. The Feinter is very skilled so the committed feint lands
 * in the top table band and carries a real modifier for the Defender without a GM override.
 */

/** The canonical GM controls the walk may press, first enabled one wins. */
const WALK_CONTROLS = [
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

const PRIMARY_WEAPON_TEMPLATE = "weapon-template-longsword";
const SHIELD_TEMPLATE = "shield-template-medium-metal-shield";

interface DefenseRead {
  cells: string[];
  headers: string[];
  mainHand: boolean;
  offHand: boolean;
  parrySourceSelectors: number;
  tablePresent: boolean;
}

interface AttackRead {
  attackMode: number;
  attackSource: number;
  dmbHeader: boolean;
  obHeader: boolean;
}

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

function fighterPayload(id: string, name: string, dodgeRanks = 9) {
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
          secondaryRanks: skillId === "dodge" ? dodgeRanks : 9,
          skillId,
        })),
      },
    },
  };
}

function phaseSection(page: Page, label: "Phase 1" | "Phase 2"): Locator {
  return page.locator(`section:has(> div > strong:text-is("${label}"))`).first();
}

/**
 * Reads the Defense / Parry mini-table of one phase panel in a single evaluate. The table is the
 * one whose header row carries `DB`, `DM` and `P`; the Attack mini-table carries `OB` / `DMB`.
 */
async function readPhasePanel(
  page: Page,
  label: "Phase 1" | "Phase 2",
): Promise<{ attack: AttackRead; defense: DefenseRead; scrollY: number }> {
  return page.evaluate((phaseLabel) => {
    const section = [...document.querySelectorAll("section")].find((candidate) => {
      const heading = candidate.firstElementChild?.firstElementChild;
      return heading?.tagName === "STRONG" && heading.textContent === phaseLabel;
    });
    const empty = {
      attack: { attackMode: 0, attackSource: 0, dmbHeader: false, obHeader: false },
      defense: {
        cells: [],
        headers: [],
        mainHand: false,
        offHand: false,
        parrySourceSelectors: 0,
        tablePresent: false,
      },
      scrollY: Math.round(window.scrollY),
    };
    if (!section) return empty;
    const headersOf = (table: Element) =>
      [...table.querySelectorAll("th")].map((cell) => (cell.textContent ?? "").trim());
    const tables = [...section.querySelectorAll("table")];
    const defenseTable = tables.find((table) => headersOf(table).includes("DB"));
    const text = section.textContent ?? "";
    return {
      attack: {
        attackMode: section.querySelectorAll('select[aria-label="Attack mode"]').length,
        attackSource: section.querySelectorAll('select[aria-label="Attack source"]').length,
        dmbHeader: tables.some((table) => headersOf(table).includes("DMB")),
        obHeader: tables.some((table) => headersOf(table).includes("OB")),
      },
      defense: {
        cells: defenseTable
          ? [...defenseTable.querySelectorAll("tbody td")].map((cell) =>
              (cell.textContent ?? "").trim(),
            )
          : [],
        headers: defenseTable ? headersOf(defenseTable) : [],
        mainHand: text.includes("Main hand"),
        offHand: text.includes("Off hand"),
        parrySourceSelectors: section.querySelectorAll('select[aria-label="Parry source"]').length,
        tablePresent: Boolean(defenseTable),
      },
      scrollY: Math.round(window.scrollY),
    };
  }, label);
}

async function selectGmInspectorParticipant(input: { label: string; page: Page }): Promise<void> {
  const heading = input.page.getByRole("heading", { name: /^Combat inspector — / });
  await expect(heading).toBeVisible();
  // The inspector does not wrap, so walk forward and then back; bounded either way.
  for (const direction of ["Next participant", "Previous participant"]) {
    for (let attempt = 0; attempt < 4; attempt += 1) {
      if ((await heading.innerText()).includes(input.label)) return;
      const button = input.page.getByRole("button", { name: direction, exact: true });
      if (!(await button.isEnabled())) break;
      await button.click();
    }
  }
  if ((await heading.innerText()).includes(input.label)) return;
  throw new Error(`The GM inspector never reached ${input.label}.`);
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

async function enabledButtonNames(page: Page): Promise<string[]> {
  return page.getByRole("button").evaluateAll((nodes) =>
    nodes
      .filter((node) => !(node as HTMLButtonElement).disabled)
      .map((node) => (node.textContent ?? "").trim())
      .filter((label) => label.length > 0),
  );
}

test.describe("Phase panels show their DB/DM/P mini tables (#877)", () => {
  test.use({ storageState: "e2e/.auth/gm.json" });

  test("a Feint-Attack Phase 1 shows the defense mini-table on both surfaces and across the feint", async ({
    browser,
    page: gmPage,
  }, testInfo) => {
    test.setTimeout(240_000);
    const suffix = Date.now();
    const shots = (name: string) => testInfo.outputPath(`${name}.png`);
    const playerContext = await browser.newContext({ storageState: "e2e/.auth/player.json" });
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
      dodgeRanks?: number,
    ) => {
      const created = await request.post(`${API_URL}/characters`, {
        data: fighterPayload(id, name, dodgeRanks),
      });
      expect(created.ok(), await created.text()).toBe(true);
      let revision = (
        await json<{ state: { revision: number } }>(
          await request.get(`${API_URL}/characters/${id}/equipment`),
        )
      ).state.revision;
      const addItem = async (templateId: string) => {
        const withItem = await post<{
          state: {
            itemsById: Record<string, { id: string; templateId?: string }>;
            revision: number;
          };
        }>(request, `/characters/${id}/equipment/items`, {
          expectedRevision: revision,
          initialCarryMode: "equipped",
          initialLocationId: `${id}:loc-equipped`,
          quantity: 1,
          templateId,
        });
        revision = withItem.state.revision;
        return Object.values(withItem.state.itemsById).find(
          (item) => item.templateId === templateId,
        )!.id;
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

    const feinterId = `feint-877-a-${suffix}`;
    const defenderId = `feint-877-b-${suffix}`;
    const feinterName = `Feinter ${suffix}`;
    const defenderName = `Defender ${suffix}`;
    // A very skilled feinter: the Feint opposed result then lands in the top table band on any die,
    // so the committed feint carries a real modifier for the defender without a GM override.
    await makeFighter(playerContext.request, feinterId, feinterName, 60);
    await makeFighter(gmPage.request, defenderId, defenderName);

    const campaign = await post<{ campaign: { id: string } }>(gmPage.request, "/campaigns", {
      name: `Issue 877 Mini Tables ${suffix}`,
      status: "active",
    });
    const campaignId = campaign.campaign.id;
    for (const characterId of [feinterId, defenderId]) {
      await post(gmPage.request, `/campaigns/${campaignId}/roster`, {
        category: "pc",
        sourceId: characterId,
        sourceType: "character",
      });
    }
    const scenario = await post<{ scenario: { id: string } }>(
      gmPage.request,
      `/campaigns/${campaignId}/scenarios`,
      { name: `Issue 877 Scenario ${suffix}`, status: "live" },
    );
    const scenarioId = scenario.scenario.id;
    const feinter = await post<{ participant: { id: string } }>(
      gmPage.request,
      `/scenarios/${scenarioId}/participants/character`,
      { characterId: feinterId, controlledByUserId: playerUser.user.id },
    );
    const defender = await post<{ participant: { id: string } }>(
      gmPage.request,
      `/scenarios/${scenarioId}/participants/character`,
      { characterId: defenderId, controlledByUserId: gmUser.user.id },
    );
    for (const participantId of [feinter.participant.id, defender.participant.id]) {
      await post(
        gmPage.request,
        `/scenarios/${scenarioId}/participants/${participantId}/refresh-character-equipment`,
      );
    }

    const now = new Date().toISOString();
    const feinterCombatantId = `issue-877-feinter-${suffix}`;
    const defenderCombatantId = `issue-877-defender-${suffix}`;
    const encounter = await post<{ encounter: EncounterSession }>(
      gmPage.request,
      `/scenarios/${scenarioId}/encounters`,
      {
        session: {
          campaignId,
          createdAt: now,
          currentRound: 1,
          id: `issue-877-encounter-${suffix}`,
          kind: "combat",
          participantMembershipMode: "explicit",
          participants: [
            {
              characterId: feinterId,
              id: feinterCombatantId,
              label: feinterName,
              participantType: "scenario",
              scenarioParticipantId: feinter.participant.id,
            },
            {
              characterId: defenderId,
              id: defenderCombatantId,
              label: defenderName,
              participantType: "scenario",
              scenarioParticipantId: defender.participant.id,
            },
          ],
          scenarioId,
          status: "active",
          title: `Issue 877 Combat ${suffix}`,
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
    const activeEncounter = await json<{ encounter: EncounterSession }>(
      await gmPage.request.get(`${API_URL}/encounters/${encounterId}`),
    );
    const combatRoundState = [feinterCombatantId, defenderCombatantId].reduce(
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
    const stateUpdate = await gmPage.request.put(`${API_URL}/encounters/${encounterId}`, {
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

    const measurements: Record<string, unknown> = {};
    const record = (key: string, value: unknown) => {
      measurements[key] = value;
      console.log(`#877 measured ${key}: ${JSON.stringify(value)}`);
    };
    // Soft: a failure is reported with every other failure and the captures are still taken, so
    // the same spec also produces the before-the-change evidence against an unfixed build.
    const expectDefenseGroup = (
      read: Awaited<ReturnType<typeof readPhasePanel>>,
      context: string,
    ) => {
      const note = `${context} (scrollY ${read.scrollY}): ${JSON.stringify(read.defense)}`;
      expect.soft(read.defense.tablePresent, note).toBe(true);
      expect.soft(read.defense.headers, note).toEqual(["DB", "DM", "P"]);
      expect.soft(read.defense.cells.length, note).toBe(3);
      expect.soft(read.defense.mainHand && read.defense.offHand, note).toBe(true);
    };
    const expectNoAttackPresentation = (
      read: Awaited<ReturnType<typeof readPhasePanel>>,
      context: string,
    ) => {
      const note = `${context}: ${JSON.stringify(read.attack)}`;
      expect.soft(read.attack.obHeader, note).toBe(false);
      expect.soft(read.attack.dmbHeader, note).toBe(false);
      expect.soft(read.attack.attackMode, note).toBe(0);
    };

    // ================= PLAYER SURFACE (the feinter's own panel) =================
    const playerPage = await playerContext.newPage();
    await playerPage.setViewportSize({ height: 900, width: 1440 });
    await playerPage.goto(`/campaigns/${campaignId}/scenarios/${scenarioId}/player/combat`);
    const playerAction = playerPage.getByRole("combobox", { name: "Action" }).first();
    await expect(playerAction).toBeVisible();
    const readPlayer = async (actionId: string, label: string) => {
      await playerAction.selectOption(actionId);
      await expect(phaseSection(playerPage, "Phase 1")).toBeVisible();
      await playerPage.waitForTimeout(600);
      const read = {
        phase1: await readPhasePanel(playerPage, "Phase 1"),
        phase2: await readPhasePanel(playerPage, "Phase 2"),
      };
      record(`player ${label}`, {
        phase1: read.phase1.defense,
        phase2: read.phase2.defense,
        phase1Attack: read.phase1.attack,
      });
      return read;
    };

    // Ordinary declarations are unchanged: both phases keep the Defense / Parry group.
    for (const actionId of ["attack_parry", "parry_attack", "parry"]) {
      const read = await readPlayer(actionId, actionId);
      expectDefenseGroup(read.phase1, `player ${actionId} Phase 1`);
      expectDefenseGroup(read.phase2, `player ${actionId} Phase 2`);
    }
    // Parry source selector: offered on a Single attack, not on a Feint-Attack (gate unchanged).
    const single = await readPlayer("attack_parry", "attack_parry (selector)");
    expect(single.phase1.defense.parrySourceSelectors, "Single attack offers the selector").toBe(1);

    // The rule under change: a Feint-Attack Phase 1 shows the group, but no attack presentation.
    const playerFeint = await readPlayer("feint_attack", "feint_attack declared");
    expectDefenseGroup(playerFeint.phase1, "player feint_attack Phase 1");
    expectDefenseGroup(playerFeint.phase2, "player feint_attack Phase 2");
    expectNoAttackPresentation(playerFeint.phase1, "player feint_attack Phase 1");
    expect(playerFeint.phase1.defense.parrySourceSelectors, "selector gate unchanged").toBe(0);
    expect(playerFeint.phase2.attack.obHeader, "Phase 2 keeps its attack table").toBe(true);
    await playerPage.screenshot({ fullPage: true, path: shots("player-feint-declared") });

    // ================= GM SURFACE: ordinary declaration, then the Feint-Attack =================
    await gmPage.setViewportSize({ height: 900, width: 1440 });
    await gmPage.goto(
      `/campaigns/${campaignId}?scenarioId=${scenarioId}&encounterId=${encounterId}&tab=combat`,
    );
    await selectGmInspectorParticipant({ label: feinterName, page: gmPage });
    const gmAction = gmPage.getByRole("combobox", { name: "Action" }).first();
    await gmAction.selectOption("attack_parry");
    await gmPage.waitForTimeout(500);
    const gmSingle = {
      phase1: await readPhasePanel(gmPage, "Phase 1"),
      phase2: await readPhasePanel(gmPage, "Phase 2"),
    };
    record("gm attack_parry", { phase1: gmSingle.phase1.defense, phase2: gmSingle.phase2.defense });
    expectDefenseGroup(gmSingle.phase1, "GM attack_parry Phase 1");
    expectDefenseGroup(gmSingle.phase2, "GM attack_parry Phase 2");
    expect(gmSingle.phase1.defense.parrySourceSelectors, "GM Single attack selector").toBe(1);

    await gmAction.selectOption("feint_attack");
    await gmPage.waitForTimeout(500);
    const gmFeint = {
      phase1: await readPhasePanel(gmPage, "Phase 1"),
      phase2: await readPhasePanel(gmPage, "Phase 2"),
    };
    record("gm feint_attack declared", {
      phase1: gmFeint.phase1.defense,
      phase2: gmFeint.phase2.defense,
    });
    expectDefenseGroup(gmFeint.phase1, "GM feint_attack Phase 1");
    expectDefenseGroup(gmFeint.phase2, "GM feint_attack Phase 2");
    expectNoAttackPresentation(gmFeint.phase1, "GM feint_attack Phase 1");
    expect(gmFeint.phase1.defense.parrySourceSelectors, "GM selector gate unchanged").toBe(0);

    await gmPage
      .getByRole("combobox", { name: "Target" })
      .first()
      .selectOption({ label: defenderName });
    await gmPage.screenshot({ fullPage: true, path: shots("gm-feint-declared-p1") });
    const declare = async () => {
      const declared = gmPage.waitForResponse(
        (response) =>
          response.request().method() === "POST" && response.url().includes("/combat-declaration"),
      );
      await gmPage.getByRole("button", { name: "Declare action" }).first().click();
      const response = await declared;
      expect(response.ok(), await response.text()).toBe(true);
    };
    await declare();
    // The defender attacks the feinter in Phase 1, so the feinter reaches a real
    // `P1 Parry/defense resolution` step while their declared action is Feint - Attack.
    await selectGmInspectorParticipant({ label: defenderName, page: gmPage });
    await gmPage.getByRole("combobox", { name: "Action" }).first().selectOption("attack_parry");
    await gmPage
      .getByRole("combobox", { name: "Target" })
      .first()
      .selectOption({ label: feinterName });
    await declare();
    for (let attempt = 0; attempt < 20; attempt += 1) {
      const state = await readRoundState({ encounterId, request: gmPage.request });
      if (state.currentStep !== "select_actions") break;
      await gmPage.waitForTimeout(1000);
    }

    const inspectorHeading = () =>
      gmPage.getByRole("heading", { name: /^Combat inspector — / }).innerText();
    const measureBoth = async (label: string) => {
      const startHeading = await inspectorHeading();
      const out: Record<string, unknown> = {};
      const startedOn = [feinterName, defenderName].find((who) => startHeading.includes(who));
      for (const who of [feinterName, defenderName]) {
        await selectGmInspectorParticipant({ label: who, page: gmPage });
        await gmPage.waitForTimeout(500);
        const phase1 = await readPhasePanel(gmPage, "Phase 1");
        const phase2 = await readPhasePanel(gmPage, "Phase 2");
        expectDefenseGroup(phase1, `GM ${label} ${who} Phase 1`);
        expectDefenseGroup(phase2, `GM ${label} ${who} Phase 2`);
        out[who.split(" ")[0]!] = {
          heading: (await inspectorHeading()).replace(/^Combat inspector — /, ""),
          phase1: phase1.defense.cells,
          phase2: phase2.defense.cells,
        };
      }
      record(`gm ${label}`, out);
      if (startedOn) await selectGmInspectorParticipant({ label: startedOn, page: gmPage });
      return out;
    };

    const returnToCurrentTask = async () => {
      const currentTask = gmPage.getByRole("button", { name: /^(Resume )?current task$/i });
      if (await currentTask.count()) {
        await currentTask.first().click();
        await gmPage.waitForTimeout(500);
      }
    };

    // What the domain actually stored: generated feint rows wherever the participant state keeps
    // them, read from the API rather than inferred from the panel.
    const readFeintRows = async (label: string) => {
      const { participants } = await json<{
        participants: { snapshot: { displayName: string }; state: unknown }[];
      }>(await gmPage.request.get(`${API_URL}/scenarios/${scenarioId}/participants`));
      // Walk each stored state for generated feint rows wherever the domain keeps them.
      const feintRows = (node: unknown, path: string): Record<string, unknown>[] => {
        if (Array.isArray(node)) {
          return node.flatMap((entry, index) => feintRows(entry, `${path}[${index}]`));
        }
        if (node && typeof node === "object") {
          const record = node as Record<string, unknown>;
          if (
            record.sourceType === "feint" ||
            String(record.id ?? "").startsWith("generated:feint:")
          ) {
            return [
              {
                application: record.application,
                path,
                sourcePhase: record.sourcePhase,
                value: record.value,
              },
            ];
          }
          return Object.entries(record).flatMap(([key, value]) =>
            feintRows(value, `${path}.${key}`),
          );
        }
        return [];
      };
      const rows = participants.map((participant) => ({
        name: participant.snapshot.displayName,
        rows: feintRows(participant.state, "state"),
      }));
      record(`domain feint rows ${label}`, rows);
      return rows;
    };

    const measuredLiveSteps = new Set<string>();
    let before: Record<string, unknown> | undefined;
    let afterLive: Record<string, unknown> | undefined;
    let committed = false;
    let sawP1ParryStep = false;
    for (let iteration = 0; iteration < 60; iteration += 1) {
      const state = await readRoundState({ encounterId, request: gmPage.request });
      if (state.currentStep === "round_summary") break;
      const currentTask = gmPage.getByRole("button", { name: /^(Resume )?current task$/i });
      if (await currentTask.count()) {
        await currentTask.first().click();
        await gmPage.waitForTimeout(500);
      }
      const heading = await inspectorHeading();
      const buttons = await enabledButtonNames(gmPage);

      if (committed && !measuredLiveSteps.has(state.currentStep)) {
        // The next LIVE steps after the commit: the panel is re-read here, not at the frozen A1.
        measuredLiveSteps.add(state.currentStep);
        const live = await measureBoth(`after commit, live step ${state.currentStep}`);
        await readFeintRows(`at live step ${state.currentStep}`);
        if (state.currentStep === "phase_1_actions") afterLive = live;
      }

      if (!before && buttons.some((label) => /^Roll feint$/i.test(label))) {
        // ---- BEFORE: live, before the feint is rolled, so nothing is yet written ----
        before = await measureBoth("before the feint is rolled (live step A1)");
        continue;
      }

      if (buttons.includes("Commit Feint result") && !committed) {
        // ---- BEFORE the commit ----

        await gmPage.screenshot({ fullPage: true, path: shots("gm-feint-before-commit") });
        const commitRequest = gmPage.waitForRequest(
          (request) => request.url().includes("/combat-round/commit-feint"),
          { timeout: 10_000 },
        );
        await gmPage.getByRole("button", { name: "Commit Feint result", exact: true }).click();
        const commitBody = JSON.parse((await commitRequest).postData() ?? "{}") as Record<
          string,
          unknown
        >;
        record("commit-feint request review fields", {
          gmAttackerDbParryModifier: commitBody.gmAttackerDbParryModifier,
          gmDefenderDbParryModifier: commitBody.gmDefenderDbParryModifier,
          gmDefenderSkillObModifier: commitBody.gmDefenderSkillObModifier,
        });
        await gmPage.waitForTimeout(2000);
        committed = true;
        // ---- AFTER the commit ----
        const after = await measureBoth("after feint commit");
        record("feint before/after", { after, before });
        // What the domain actually wrote: the feint rows in each participant's stored combat
        // context, read from the API rather than inferred from the panel.
        const written = await readFeintRows("right after the commit");
        // Precondition of the measurement: the domain really wrote a feint row for the defender.
        // Without it, "the panel did not change" would measure nothing.
        expect(
          written.find((entry) => entry.name === defenderName)?.rows.length,
          "the committed feint wrote rows for the defender",
        ).toBeGreaterThan(0);
        await returnToCurrentTask();

        continue;
      }

      if (heading.includes("P1 Parry/defense resolution")) {
        // The Feint-Attack declarer, at a parry step, in Phase 1.
        expect(heading, "the inspected participant is the feinter").toContain(feinterName);
        const phase1 = await readPhasePanel(gmPage, "Phase 1");
        const phase2 = await readPhasePanel(gmPage, "Phase 2");
        record("gm P1 Parry/defense resolution (feinter, declared Feint - Attack)", {
          heading,
          phase1: phase1.defense,
          phase1Attack: phase1.attack,
          phase2: phase2.defense,
        });
        expectDefenseGroup(phase1, "GM P1 Parry/defense resolution Phase 1");
        expectDefenseGroup(phase2, "GM P1 Parry/defense resolution Phase 2");
        expectNoAttackPresentation(phase1, "GM P1 Parry/defense resolution Phase 1");
        expect(phase1.defense.parrySourceSelectors).toBe(0);
        await gmPage.screenshot({ fullPage: true, path: shots("gm-p1-parry-defense-resolution") });
        sawP1ParryStep = true;

        // The same step, on the player's own surface.
        await playerPage.reload();
        await expect(phaseSection(playerPage, "Phase 1")).toBeVisible();
        await playerPage.waitForTimeout(1000);
        const playerStep = {
          phase1: await readPhasePanel(playerPage, "Phase 1"),
          phase2: await readPhasePanel(playerPage, "Phase 2"),
        };
        record("player at the feinter's P1 parry step", {
          phase1: playerStep.phase1.defense,
          phase2: playerStep.phase2.defense,
        });
        await playerPage.screenshot({ fullPage: true, path: shots("player-p1-parry-step") });
      }

      const control = buttons.find((label) => WALK_CONTROLS.some((rx) => rx.test(label)));
      if (!control) {
        console.log(
          `#877 walk stalled at ${state.currentStep} / ${heading}: ${JSON.stringify(buttons.slice(0, 30))}`,
        );
        await gmPage.screenshot({ fullPage: true, path: shots("walk-stalled") });
        break;
      }
      await gmPage.getByRole("button", { name: control, exact: true }).first().click();
      await gmPage.waitForTimeout(1800);
    }
    expect(committed, "the feint was committed").toBe(true);
    // The measurement the issue owes: the defender's Phase 2 DB/DM/P, read from the rendered
    // panel, differs before the feint and at the first live step after it — the live panel
    // re-reads the modifier the domain wrote. (It does not at every later step: see the report.)
    const phase2Of = (value: Record<string, unknown> | undefined) =>
      (
        (value?.[defenderName.split(" ")[0]!] as { phase2?: string[] } | undefined)?.phase2 ?? []
      ).join("/");
    expect(
      phase2Of(afterLive),
      "defender Phase 2 DB/DM/P changed after the committed feint",
    ).not.toBe(phase2Of(before));
    expect(sawP1ParryStep, "the walk reached the feinter's P1 Parry/defense resolution step").toBe(
      true,
    );

    // The player's own panel after the commit.
    await playerPage.reload();
    await expect(phaseSection(playerPage, "Phase 1")).toBeVisible();
    await playerPage.waitForTimeout(1000);
    const playerAfter = {
      phase1: await readPhasePanel(playerPage, "Phase 1"),
      phase2: await readPhasePanel(playerPage, "Phase 2"),
    };
    record("player after feint commit", {
      phase1: playerAfter.phase1.defense,
      phase2: playerAfter.phase2.defense,
    });

    await testInfo.attach("feint-measurements.json", {
      body: JSON.stringify(measurements, null, 2),
      contentType: "application/json",
    });
  });
});
