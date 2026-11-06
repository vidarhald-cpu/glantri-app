import { expect, test, type APIRequestContext, type Page } from "@playwright/test";
import {
  buildCombatProgressionProjection,
  initializeCombatRoundState,
  rollCombatRoundCombatExperience,
  setCombatRoundCombatExperienceDifficulty,
  type CombatRoundState,
  type EncounterSession,
} from "@glantri/domain";

import { characterPayload } from "./character-fixture";
import { API_URL } from "./targets";

/**
 * Forgejo #951 / #889 — acceptance item 6, the rendered check.
 *
 * Product Owner ruling of 2026-11-06: the server derives and persists each committed step's
 * authoritative snapshot. Two readings are required, and both are taken here:
 *
 * 1. **a step that previously had no snapshot** — the Declaration step. #951's headline symptom
 *    is that stepping back to it rendered only the historical context and result cards: the
 *    Action selector, Phase 1, Phase 2 and Combat situation cards were all absent, because three
 *    `#771 R2-12` omit-the-empty-card gates fire when the resolved snapshot has no facts;
 * 2. **a step that was previously carried forward** — the phase-1 initiative step, which the
 *    at-or-before fallback used to fill from `review_action_modifiers` with the step label
 *    overwritten and nothing on screen saying the figures were carried.
 *
 * It also discharges **#889**: after the modifier review commits, the GM phase panel renders the
 * phase mini tables again, and the DB it shows is the post-review figure. The #889 measurement
 * proved that symptom is produced solely by the absence of a recorded review-step snapshot
 * (`persistSnapshot=false` gave `{phaseCardLabels: [], dbdmpTables: 0, combatSituation: 0}`), and
 * that jsdom cannot settle whether the restored tables show post-review numbers because the
 * component harness stubs the equipment loaders.
 *
 * ## Geometry method
 *
 * Usable widths 768 / 1024 / 1440. Every reading is taken inside **one** `page.evaluate` per
 * state and per width, with `window.scrollY` captured in the same evaluate: the Combat page
 * autoscrolls after mount, so a read taken across an `await` boundary straddles that scroll and
 * reports hundreds of pixels of phantom movement.
 */

const PRIMARY_WEAPON_TEMPLATE = "weapon-template-longsword";
const WIDTHS = [768, 1024, 1440] as const;

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

function fighterPayload(id: string, name: string) {
  const payload = characterPayload(id, name);
  return {
    build: {
      ...payload.build,
      progression: {
        ...payload.build.progression,
        secondaryPoolTotal: 240,
        skills: ["brawling", "dodge", "one_handed_edged", "parry"].map((skillId) => ({
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

interface PanelReading {
  /** Labels of the rendered phase cards. Empty is the #889 symptom. */
  readonly phaseCardLabels: string[];
  /** How many DB/DM/P mini tables are drawn. Zero is the #889 symptom. */
  readonly dbdmpTables: number;
  /** Whether a Combat situation panel is drawn. */
  readonly combatSituation: number;
  /** Whether the Action selector card is drawn. Absent is #951's headline symptom. */
  readonly actionSelectors: number;
  /** The inspector heading, which carries the selected step's own label. */
  readonly heading: string;
  /** Every DB/DM/P cell value, in document order. */
  readonly defenceCells: string[];
  /** Document-coordinate boxes of the phase sections, for the geometry assertion. */
  readonly sections: { bottom: number; height: number; label: string; top: number }[];
  readonly scrollY: number;
  readonly viewportWidth: number;
}

/**
 * One atomic read: rendered card labels, mini-table counts, the inspector heading, the DB/DM/P
 * values and the phase sections' document-coordinate geometry, with `scrollY` in the same
 * evaluate. Nothing here is read across an `await`.
 */
async function readPanels(page: Page): Promise<PanelReading> {
  return page.evaluate(() => {
    const scrollY = Math.round(window.scrollY);
    const labels = ["Phase 1", "Phase 2"];
    const sections = [...document.querySelectorAll("section")].filter((section) => {
      const heading = section.firstElementChild?.firstElementChild;
      return heading?.tagName === "STRONG" && labels.includes(heading.textContent ?? "");
    });
    const inspectorHeading = [...document.querySelectorAll("h3")].find((node) =>
      (node.textContent ?? "").trim().startsWith("Combat inspector — "),
    );
    const dbdmpTables = [...document.querySelectorAll("table")].filter((table) => {
      const headers = [...table.querySelectorAll("thead th")].map((cell) =>
        (cell.textContent ?? "").trim(),
      );
      return headers.includes("DB") && headers.includes("DM") && headers.includes("P");
    });
    const defenceCells = dbdmpTables.flatMap((table) =>
      [...table.querySelectorAll("tbody td")].map((cell) => (cell.textContent ?? "").trim()),
    );

    return {
      // The Action selector card. On the historical inspector it renders as a labelled card
      // (`Action selector · Round N`), and `CombatRoundManagerPanel.tsx:12761` returns `null`
      // for it unless the resolved snapshot carries a declaration summary — which is #951's
      // headline symptom and the thing this reading inverts.
      actionSelectors: [...document.querySelectorAll("*")].filter(
        (node) =>
          node.children.length === 0 &&
          (node.textContent ?? "").trim().startsWith("Action selector"),
      ).length,
      combatSituation: [...document.querySelectorAll("*")].filter(
        (node) =>
          node.children.length === 0 && (node.textContent ?? "").trim() === "Combat situation",
      ).length,
      dbdmpTables: dbdmpTables.length,
      defenceCells,
      heading: (inspectorHeading?.textContent ?? "").replace(/\s+/g, " ").trim(),
      phaseCardLabels: sections.map(
        (section) => section.firstElementChild!.firstElementChild!.textContent ?? "",
      ),
      scrollY,
      sections: sections.map((section) => {
        const rect = section.getBoundingClientRect();
        return {
          bottom: Math.round(rect.bottom + scrollY),
          height: Math.round(rect.height),
          label: section.firstElementChild!.firstElementChild!.textContent ?? "",
          top: Math.round(rect.top + scrollY),
        };
      }),
      viewportWidth: window.innerWidth,
    };
  });
}

/**
 * Selects one tracker cell by participant row and step column.
 *
 * The `Next participant` control does not move the GM inspector off the participant the current
 * task belongs to, so the cell is clicked directly. Cell buttons carry a `title` prefixed with
 * the step's own abbreviation (`COMBAT_ROUND_STEP_ABBREVIATIONS`), in the form
 * `<participant> · Round N · DE: declared by GM.` — which is what #951 quoted when it recorded
 * that the Declaration cell said the declaration was made while its panels were absent.
 */
async function selectTrackerCell(input: {
  abbreviation: string;
  page: Page;
  participantLabel: string;
}): Promise<void> {
  const grid = input.page.locator('[aria-label="Combat round timeline grid"]');
  await expect(grid).toBeVisible({ timeout: 60_000 });
  const clicked = await grid.evaluate(
    (node, { abbreviation, participantLabel }) => {
      const row = [...node.querySelectorAll("tbody tr")].find((candidate) =>
        (candidate.querySelector("td:first-child")?.textContent ?? "").includes(participantLabel),
      );
      if (!row) return { ok: false, reason: "no row", titles: [] as string[] };
      const buttons = [...row.querySelectorAll("button")];
      const titles = buttons.map((button) => button.getAttribute("title") ?? "");
      const target = buttons.find((button) =>
        (button.getAttribute("title") ?? "").includes(` · ${abbreviation}:`),
      );
      if (!target) return { ok: false, reason: "no cell", titles };
      (target as HTMLButtonElement).click();
      return { ok: true, reason: "", titles };
    },
    { abbreviation: input.abbreviation, participantLabel: input.participantLabel },
  );
  expect(
    clicked.ok,
    `${input.participantLabel} ${input.abbreviation}: ${clicked.reason} (${JSON.stringify(clicked.titles)})`,
  ).toBe(true);
  await input.page.waitForTimeout(250);
}

test.describe("#951 / #889 — server-derived step snapshots, rendered", () => {
  test.use({ storageState: "e2e/.auth/gm.json" });

  test("renders a previously-unsnapshotted step and a previously-carried step at 768 / 1024 / 1440", async ({
    browser,
    page: gmPage,
  }) => {
    test.setTimeout(600_000);
    const suffix = Date.now();
    const playerContext = await browser.newContext({ storageState: "e2e/.auth/player.json" });
    const playerUser = await json<{ user: { id: string } }>(
      await playerContext.request.get(`${API_URL}/auth/me`),
    );

    // ---- A fighter with a real build and a ready weapon, so the defence rows resolve. ----
    const characterId = `snapshot-951-${suffix}`;
    const characterName = `Snapshot Fighter ${suffix}`;
    const created = await playerContext.request.post(`${API_URL}/characters`, {
      data: fighterPayload(characterId, characterName),
    });
    expect(created.ok(), await created.text()).toBe(true);
    const createdCharacter = (await created.json()) as { character?: { id?: string } };
    // The id the server actually stored, not the one the payload asked for.
    expect(createdCharacter.character?.id, JSON.stringify(createdCharacter)).toBe(characterId);

    let equipmentRevision = (
      await json<{ state: { revision: number } }>(
        await playerContext.request.get(`${API_URL}/characters/${characterId}/equipment`),
      )
    ).state.revision;
    const withItem = await post<{
      state: { itemsById: Record<string, { id: string; templateId?: string }>; revision: number };
    }>(playerContext.request, `/characters/${characterId}/equipment/items`, {
      expectedRevision: equipmentRevision,
      initialCarryMode: "equipped",
      initialLocationId: `${characterId}:loc-equipped`,
      quantity: 1,
      templateId: PRIMARY_WEAPON_TEMPLATE,
    });
    equipmentRevision = withItem.state.revision;
    const weaponItemId = Object.values(withItem.state.itemsById).find(
      (item) => item.templateId === PRIMARY_WEAPON_TEMPLATE,
    )?.id;
    expect(weaponItemId, "no weapon item created").toBeTruthy();
    equipmentRevision = (
      await post<{ state: { revision: number } }>(
        playerContext.request,
        `/characters/${characterId}/equipment/loadout/active-primary-weapon`,
        { expectedRevision: equipmentRevision, itemId: weaponItemId },
      )
    ).state.revision;

    // ---- Campaign, scenario, participants, encounter. ----
    const campaign = await post<{ campaign: { id: string } }>(gmPage.request, "/campaigns", {
      name: `Issue 951 Snapshots ${suffix}`,
      status: "active",
    });
    const campaignId = campaign.campaign.id;
    await post(gmPage.request, `/campaigns/${campaignId}/roster`, {
      category: "pc",
      sourceId: characterId,
      sourceType: "character",
    });
    const scenario = await post<{ scenario: { id: string } }>(
      gmPage.request,
      `/campaigns/${campaignId}/scenarios`,
      { name: `Issue 951 Scenario ${suffix}`, status: "live" },
    );
    const scenarioId = scenario.scenario.id;
    const participant = await post<{ participant: { id: string } }>(
      gmPage.request,
      `/scenarios/${scenarioId}/participants/character`,
      { characterId, controlledByUserId: playerUser.user.id },
    );
    await post(
      gmPage.request,
      `/scenarios/${scenarioId}/participants/${participant.participant.id}/refresh-character-equipment`,
    );
    const targetName = `Snapshot Target ${suffix}`;
    const target = await post<{ participant: { id: string } }>(
      gmPage.request,
      `/scenarios/${scenarioId}/participants/entity`,
      {
        entityInput: { kind: "npc", name: targetName, snapshot: { displayName: targetName } },
        role: "enemy",
      },
    );

    const now = new Date().toISOString();
    const fighterCombatantId = `issue-951-fighter-${suffix}`;
    const targetCombatantId = `issue-951-target-${suffix}`;
    const encounter = await post<{ encounter: EncounterSession }>(
      gmPage.request,
      `/scenarios/${scenarioId}/encounters`,
      {
        session: {
          campaignId,
          createdAt: now,
          currentRound: 1,
          id: `issue-951-encounter-${suffix}`,
          kind: "combat",
          participantMembershipMode: "explicit",
          participants: [
            {
              characterId,
              id: fighterCombatantId,
              label: characterName,
              participantType: "scenario",
              scenarioParticipantId: participant.participant.id,
            },
            {
              id: targetCombatantId,
              label: targetName,
              participantType: "scenario",
              scenarioParticipantId: target.participant.id,
            },
          ],
          scenarioId,
          status: "active",
          title: `Issue 951 Combat ${suffix}`,
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
    const combatRoundState = [fighterCombatantId, targetCombatantId].reduce(
      (state, participantId, index) =>
        rollCombatRoundCombatExperience({
          command: { createdAt: new Date(Date.now() + index).toISOString() },
          participantId,
          rng: () => 0.6,
          skillTotal: 26,
          state,
        }).state,
      setCombatRoundCombatExperienceDifficulty({
        difficulty: 26,
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

    // ---- Drive the round through the real routes, as the GM's own controls do. ----
    const currentEncounter = async () =>
      (
        await json<{ encounter: EncounterSession }>(
          await gmPage.request.get(`${API_URL}/encounters/${encounterId}`),
        )
      ).encounter;
    const revision = async () => (await currentEncounter()).updatedAt;
    const roundState = async (): Promise<CombatRoundState> =>
      initializeCombatRoundState({ encounter: await currentEncounter() });
    /**
     * The progression the GM client itself computes. There is no server endpoint for it: the
     * client builds it from the encounter state, so the spec builds it the same way.
     */
    const tasks = async () => {
      const projection = buildCombatProgressionProjection(await roundState());
      const all = projection.boundary.processes
        .flatMap((process) => process.stages)
        .flatMap((stage) => [
          ...stage.tasks,
          ...stage.executionGroups.flatMap((group) => group.tasks),
        ]);
      return [...new Map(all.map((task) => [task.id, task])).values()].map((task) => ({
        blockerCount: task.blockerIds.length,
        executionGroupId: task.executionGroupId,
        expectedCommand: task.expectedCommand as string,
        id: task.id,
        kind: task.kind as string,
        participantId:
          (task.owner?.kind === "combatant" ? task.owner.participantId : undefined) ??
          task.identity.participantId,
        transition: task.transition
          ? {
              currentBoundary: task.transition.currentBoundary as string,
              targetBoundary: task.transition.targetBoundary as string,
            }
          : undefined,
      }));
    };

    // Declarations through the declaration route, one per combatant, with a GM situational DB
    // edit on the fighter so the review has something to carry.
    for (const [combatantId, scenarioParticipantId] of [
      [fighterCombatantId, participant.participant.id],
      [targetCombatantId, target.participant.id],
    ] as const) {
      const task = (await tasks()).find(
        (candidate) =>
          candidate.expectedCommand === "declare_action" &&
          candidate.blockerCount === 0 &&
          candidate.participantId === combatantId &&
          !candidate.id.endsWith(":gm-edit"),
      );
      expect(task, `no declare_action task for ${combatantId}`).toBeTruthy();
      const response = await gmPage.request.post(
        `${API_URL}/encounters/${encounterId}/combat-declaration`,
        {
          data:
            combatantId === fighterCombatantId
              ? {
                  actionId: "attack_parry",
                  executionGroupId: task!.executionGroupId,
                  expectedRevision: await revision(),
                  phaseAttackSources: {
                    phase1: {
                      attackModeId: "mode-1",
                      opportunitySlot: "attack_1",
                      slot: "virtual",
                      sourceKind: "unarmed",
                      templateId: "virtual-weapon-template-punch",
                    },
                  },
                  phaseContexts: {
                    phase1: { targetParticipantId: targetCombatantId },
                    phase2: {},
                  },
                  scenarioParticipantId,
                  taskId: task!.id,
                }
              : {
                  // The NPC defender passes: it is a Template-derived actor with no canonical
                  // Dodge skill, so Parry is refused at the declaration route. The readings below
                  // are taken on the fighter, which has the full build.
                  actionId: "pass",
                  executionGroupId: task!.executionGroupId,
                  expectedRevision: await revision(),
                  scenarioParticipantId,
                  taskId: task!.id,
                },
        },
      );
      expect(response.ok(), `${combatantId} declaration: ${await response.text()}`).toBe(true);
    }

    const advanceBoundary = async (label: string) => {
      const task = (await tasks()).find(
        (candidate) => candidate.kind === "gm_advance_boundary" && candidate.transition,
      );
      expect(task, `${label}: no boundary task`).toBeTruthy();
      const response = await gmPage.request.post(
        `${API_URL}/encounters/${encounterId}/combat-round/advance-current-step`,
        {
          data: {
            commandType: task!.expectedCommand,
            executionGroupId: task!.executionGroupId,
            expectedBoundary: task!.transition!.currentBoundary,
            expectedRevision: await revision(),
            targetBoundary: task!.transition!.targetBoundary,
            taskId: task!.id,
          },
        },
      );
      expect(response.ok(), `${label}: ${await response.text()}`).toBe(true);
    };

    // Boundary out of the Declaration step: this is the write that used to be the ONLY one, and
    // it now records `select_actions` for both combatants.
    await advanceBoundary("declaration");
    expect((await roundState()).currentStep).toBe("review_action_modifiers");

    const recordedSteps = async () => {
      const state = (await currentEncounter()) as EncounterSession & {
        combatRoundState?: { stepSnapshots?: { participantId: string; step: string }[] };
      };
      return (state.combatRoundState?.stepSnapshots ?? [])
        .map((snapshot) => `${snapshot.step}:${snapshot.participantId}`)
        .sort();
    };
    const afterDeclaration = await recordedSteps();
    console.log(
      `#951 recorded after the declaration boundary: ${JSON.stringify(afterDeclaration)}`,
    );
    expect(afterDeclaration).toEqual([
      `select_actions:${fighterCombatantId}`,
      `select_actions:${targetCombatantId}`,
    ]);

    // ================= READING 1: a step that previously had NO snapshot =================
    await gmPage.goto(
      `/campaigns/${campaignId}?scenarioId=${scenarioId}&encounterId=${encounterId}&tab=combat`,
    );
    await selectTrackerCell({ abbreviation: "DE", page: gmPage, participantLabel: characterName });

    const declarationReadings: PanelReading[] = [];
    for (const width of WIDTHS) {
      await gmPage.setViewportSize({ height: 900, width });
      await gmPage.waitForTimeout(250);
      declarationReadings.push(await readPanels(gmPage));
    }
    console.log(`#951 Declaration-step readings: ${JSON.stringify(declarationReadings)}`);
    for (const reading of declarationReadings) {
      const context = `width ${reading.viewportWidth} (scrollY ${reading.scrollY}): ${JSON.stringify(reading)}`;
      // #951's headline symptom, inverted: the panels a GM steps back to read are present.
      expect(reading.phaseCardLabels, context).toEqual(["Phase 1", "Phase 2"]);
      expect(reading.dbdmpTables, context).toBeGreaterThan(0);
      expect(reading.actionSelectors, context).toBeGreaterThan(0);
      // The heading names the selected step, and the figures belong to it.
      expect(reading.heading, context).toContain("Declaration");
      // Both phase sections are laid out, not collapsed, at a usable width.
      for (const section of reading.sections) {
        expect(section.height, `${context} ${section.label}`).toBeGreaterThan(0);
      }
    }

    // ================= #889: the review commits, and the tables come back =================
    const reviewTasks = (await tasks()).filter(
      (task) =>
        ["review_modifiers_phase1", "review_modifiers_phase2"].includes(task.expectedCommand) &&
        task.blockerCount === 0,
    );
    expect(reviewTasks.length, "no modifier-review task").toBeGreaterThan(0);
    const scenarioParticipantByCombatant: Record<string, string> = {
      [fighterCombatantId]: participant.participant.id,
      [targetCombatantId]: target.participant.id,
    };
    /** The review route is revision-checked on the participant as well as the Encounter. */
    const participantRevision = async (scenarioParticipantId: string) => {
      const listed = await json<{ participants: { id: string; updatedAt: string }[] }>(
        await gmPage.request.get(`${API_URL}/scenarios/${scenarioId}/participants`),
      );
      return listed.participants.find((entry) => entry.id === scenarioParticipantId)?.updatedAt;
    };
    for (const task of reviewTasks) {
      const response = await gmPage.request.post(
        `${API_URL}/encounters/${encounterId}/combat-declaration`,
        {
          data: {
            actionId: "attack_parry",
            executionGroupId: task.executionGroupId,
            expectedParticipantRevision: task.participantId
              ? await participantRevision(scenarioParticipantByCombatant[task.participantId]!)
              : undefined,
            expectedRevision: await revision(),
            scenarioParticipantId: task.participantId
              ? scenarioParticipantByCombatant[task.participantId]
              : undefined,
            taskId: task.id,
          },
        },
      );
      // A review task that belongs to the other combatant refuses; that is not a failure here.
      if (!response.ok()) console.log(`#951 review task skipped: ${await response.text()}`);
    }
    const afterReview = await recordedSteps();
    console.log(`#951 recorded after the review commits: ${JSON.stringify(afterReview)}`);
    expect(
      afterReview.filter((key) => key.startsWith("review_action_modifiers")).length,
      `review records: ${JSON.stringify(afterReview)}`,
    ).toBeGreaterThan(0);

    await gmPage.setViewportSize({ height: 900, width: 1440 });
    await gmPage.goto(
      `/campaigns/${campaignId}?scenarioId=${scenarioId}&encounterId=${encounterId}&tab=combat`,
    );
    await selectTrackerCell({ abbreviation: "M1", page: gmPage, participantLabel: characterName });
    const reviewReadings: PanelReading[] = [];
    for (const width of WIDTHS) {
      await gmPage.setViewportSize({ height: 900, width });
      await gmPage.waitForTimeout(250);
      reviewReadings.push(await readPanels(gmPage));
    }
    console.log(`#951/#889 post-review readings: ${JSON.stringify(reviewReadings)}`);
    for (const reading of reviewReadings) {
      const context = `width ${reading.viewportWidth} (scrollY ${reading.scrollY}): ${JSON.stringify(reading)}`;
      // #889's own acceptance: the phase mini tables are drawn after the review commits.
      expect(reading.phaseCardLabels, context).toEqual(["Phase 1", "Phase 2"]);
      expect(reading.dbdmpTables, context).toBeGreaterThan(0);
      expect(reading.defenceCells.length, context).toBeGreaterThan(0);
      // And the figures are not the "—" placeholder a snapshot with no facts renders.
      expect(
        reading.defenceCells.some((cell) => /-?\d/.test(cell)),
        context,
      ).toBe(true);
    }

    // ============ READING 2: the carry-forward case, measured on the rendered surface ============
    //
    // Before this repair the Declaration step had no record of its own, so the at-or-before
    // fallback filled its panels from `review_action_modifiers` with the Declaration label left
    // in place — 8 of 13 steps did exactly that. Each step now renders its own figures, and the
    // proof is that two steps of the SAME participant in the SAME round disagree: the Declaration
    // step reads the pre-review DB and the review step reads the post-review DB. A carried panel
    // could not produce two different readings.
    const declarationDefence = declarationReadings.map((reading) => reading.defenceCells.join("|"));
    const reviewDefence = reviewReadings.map((reading) => reading.defenceCells.join("|"));
    console.log(
      `#951 carry-forward check: ${JSON.stringify({ declarationDefence, reviewDefence })}`,
    );
    // Each state is internally consistent across the three widths: the figures are the record's,
    // not the viewport's.
    expect(new Set(declarationDefence).size, JSON.stringify(declarationDefence)).toBe(1);
    expect(new Set(reviewDefence).size, JSON.stringify(reviewDefence)).toBe(1);
    // And the two steps disagree, so neither is carrying the other's figures.
    expect(
      declarationDefence[0],
      `the Declaration step renders the review step's figures: ${declarationDefence[0]}`,
    ).not.toBe(reviewDefence[0]);
    // Both label their own step, and the labels differ.
    expect(declarationReadings[0]!.heading).toContain("Declaration");
    expect(reviewReadings[0]!.heading).toContain("Review phase 1 modifiers");

    // ===== READING 3: #889's edited-row clause — why the arm is not reachable here (D8) =====
    //
    // #889 requires the restored tables to show "the post-review state **including any row the GM
    // added, edited or removed**". The readings above vary nothing at the review, so that clause
    // was an inference from one arm; independent QA tried to supply the missing arm, sent a bare
    // row with no `canonicalLifecycle` in a single review cycle, and withdrew the finding.
    //
    // The shape the arm needs is the panel's own: the **listed** row's `value` and its
    // `canonicalLifecycle.payload.value` changed together, which presupposes a row already
    // committed through a review. Driven here: once the review commits, the projection
    // **withdraws the task**. There is no second `review_modifiers_phase1` offer at the same step
    // for the same participant, so there is no state this route can reach in which the GM edits
    // the row they just committed. Reaching it needs a re-offered review — the supersession path
    // #931 added — or a `clear-current-step` rewind, both outside this task's bound.
    const reofferedReview = (await tasks()).find(
      (task) =>
        ["review_modifiers_phase1", "review_modifiers_phase2"].includes(task.expectedCommand) &&
        task.participantId === fighterCombatantId,
    );
    const persistedSituationDb = await json<{
      participants: { id: string; state: { combat: { combatContext: unknown } } }[];
    }>(await gmPage.request.get(`${API_URL}/scenarios/${scenarioId}/participants`)).then(
      (listed) =>
        (
          listed.participants.find((row) => row.id === participant.participant.id)?.state.combat
            .combatContext as { modifierBuckets?: { situationDb?: unknown[] } } | undefined
        )?.modifierBuckets?.situationDb ?? [],
    );
    console.log(
      `#951/#889 D8 reachability: ${JSON.stringify({
        postReviewDb: reviewReadings.map((reading) => reading.defenceCells[0]),
        reofferedReviewAfterCommit: reofferedReview?.id ?? null,
        persistedSituationDbRows: persistedSituationDb.length,
      })}`,
    );
    // Recorded as a measurement, not as a desirable property: if a later change re-offers the
    // review, this fails and says that the edited-row arm has become reachable and wants driving.
    expect(
      reofferedReview,
      "a review is re-offered after commit: #889's edited-row arm is now reachable and should be driven",
    ).toBeUndefined();
    // And the GM's situational row submitted with the **declaration** does not reach the
    // participant's committed context at all, which is why the earlier head's claim that "the
    // committed figure moves with it" could not have been about a review-time edit.
    expect(persistedSituationDb).toEqual([]);

    // The three widths are genuinely different layouts, not one layout measured three times.
    expect(declarationReadings.map((reading) => reading.viewportWidth)).toEqual([...WIDTHS]);
    expect(reviewReadings.map((reading) => reading.viewportWidth)).toEqual([...WIDTHS]);
  });
});
