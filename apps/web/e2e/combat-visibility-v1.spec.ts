import { expect, test, type APIRequestContext, type Locator, type Page } from "@playwright/test";
import {
  advanceCombatRoundStep,
  initializeCombatRoundState,
  recordCombatRoundDeclaration,
  rollCombatRoundCombatExperience,
  setCombatRoundCombatExperienceDifficulty,
  type EncounterSession,
} from "@glantri/domain";

import { characterPayload } from "./character-fixture";
import { API_URL } from "./targets";

/**
 * #862 V1 — rendered evidence for the two user-visible rows of the player Combat visibility lane,
 * on the GM surface **and** the player surface.
 *
 * Row 5, declaration summary wording. `buildCombatEventResultModel` emitted
 * `"<who> declared an action."` unconditionally — for every viewer including the GM, with the
 * action and target already listed as `Action: …` / `Target: …` rows directly underneath. The
 * repository's own unit test pinned that with full facts present. The Product Owner's ruling
 * (#854 comment 19297) reverses it, so the summary names the committed action and target when
 * those facts are present. Measured here as rendered text on both surfaces rather than as a
 * view-model return value, because the view model is shared and a unit test cannot show that the
 * GM's own inspector reached the new sentence.
 *
 * Row 6, blank-cell navigation on the player keyboard/arrow path. The player handler refused to
 * move onto any non-`inspectable` cell; the GM handler has no such guard. The ruling is that every
 * rendered cell is a landing and the inspector may show nothing. The measurement is the rendered
 * grid: which cells the cursor reaches, and what the inspector shows when it lands on one with no
 * recorded content.
 *
 * Both measurements are taken inside a single `page.evaluate`. `boundingBox()` and sequential
 * locator reads are viewport-relative and this page scrolls itself after mount (`CombatLog` runs
 * `scrollIntoView` on the newest event), so reads taken across awaits can straddle the scroll.
 * Nothing here compares geometry, but the same atomicity rule is applied to the text reads so a
 * re-render cannot land between two halves of one assertion.
 */

/** The twelve columns the player and GM trackers both render (#771 R2-2). `PD` is not one. */
const VISIBLE_STEP_ABBREVIATIONS = [
  "DE",
  "M1",
  "i1",
  "A1",
  "P1",
  "D1",
  "M2",
  "i2",
  "A2",
  "P2",
  "D2",
  "SU",
] as const;

/** Field names from `rollerPrivate`/`gmReview` that no player-reachable panel may carry. */
const PRIVATE_FIELD_NAMES = [
  "baseInitiative",
  "modifierAdjustment",
  "rollTotal",
  "rollD20",
  "combinedParryScore",
  "modifierBreakdown",
  "targetNumber",
  "defenderDb",
  "lookupTotal",
  "openEndedD10s",
  "privateCalculation",
  "gmReview",
] as const;

/*
 * Forgejo #987. `CombatRoundManagerPanel` renders one `h3` per arm of a single
 * `{inspector.participant ? (` ternary, and both arms begin with the same seven words:
 *
 * - the participant arm: `Combat inspector — {inspector.participant.label} · Round {n} · {step}`;
 * - the phase-wide arm:  `Combat inspector — Round {n} · {step}`, which names no participant.
 *
 * The narrowed matcher requires the ` · Round <n> · ` that can only follow a label, so the
 * phase-wide text — whose `Round <n>` is its first segment — cannot satisfy it. The loose
 * pattern is kept for diagnosis only, to report which arm is actually on screen.
 */
const GM_INSPECTOR_ANY_HEADING = /^Combat inspector — /;
const GM_INSPECTOR_PARTICIPANT_HEADING = /^Combat inspector — .+ · Round \d+ · /;
/**
 * Every read of and click on the participant arm carries this. `innerText()` and `click()` are
 * unbounded by default — `playwright.config.ts` sets no `actionTimeout` — so on the phase-wide
 * arm, where these locators never resolve, the only ceiling is `test.setTimeout(240_000)`: the
 * 240-second timeout naming nothing that #987 exists to remove.
 */
const GM_INSPECTOR_CONTROL_TIMEOUT_MS = 2_000;
/** The participant arm can take a beat to mount after a `goto`; its own controls cannot. */
const GM_INSPECTOR_SETTLE_TIMEOUT_MS = 15_000;

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

interface TrackerReading {
  /** Whole rendered text of the result panel the inspector is showing, whitespace-collapsed. */
  readonly resultPanelText?: string;
  readonly resultPanelTitle?: string;
  /** Title attribute of every tracker cell carrying the selection outline. */
  readonly selectedCellTitles: readonly string[];
  readonly visibleColumns: readonly string[];
}

/**
 * One atomic read of the rendered tracker and the rendered result panel. `CombatTracker.tsx` draws
 * `outline: 2px solid #2f5d62` on the selected cell and on nothing else, so the selection is read
 * from computed style rather than from the model — the model populates cells the grid does not
 * draw, so only the rendered grid can answer where the cursor actually is.
 */
async function readTracker(page: Page): Promise<TrackerReading> {
  return page.evaluate(() => {
    const grid = document.querySelector('[aria-label="Combat round timeline grid"]');
    const headerCells = grid?.querySelectorAll("thead tr")[1]?.querySelectorAll("th") ?? [];
    const resultPanel = Array.from(document.querySelectorAll("section[aria-label]")).find((node) =>
      (node.getAttribute("aria-label") ?? "").startsWith("Historical result"),
    );
    return {
      resultPanelText: resultPanel
        ? (resultPanel.textContent ?? "").replace(/\s+/g, " ").trim()
        : undefined,
      resultPanelTitle: resultPanel?.getAttribute("aria-label") ?? undefined,
      selectedCellTitles: Array.from(grid?.querySelectorAll("tbody td") ?? [])
        .filter((node) => {
          const style = getComputedStyle(node);
          return style.outlineStyle === "solid" && style.outlineWidth === "2px";
        })
        .map((node) => node.querySelector("button")?.getAttribute("title") ?? ""),
      visibleColumns: Array.from(headerCells).map((node) => (node.textContent ?? "").trim()),
    };
  });
}

/** `<label> · Round <n> · <ABBREVIATION>: <hover text>` — `buildProjectedCombatTrackerModel.ts`. */
function selectedAbbreviations(reading: TrackerReading): string[] {
  return reading.selectedCellTitles.map((title) => title.split(" · ")[2]?.split(":")[0] ?? title);
}

/** Presses one navigation control and returns the rendered state after React has re-rendered. */
async function pressStep(input: { label: string; page: Page }): Promise<TrackerReading> {
  const before = selectedAbbreviations(await readTracker(input.page))[0];
  await input.page.getByRole("button", { exact: true, name: input.label }).click();
  /*
   * Playwright's click resolves when the event is dispatched, not when React has re-rendered, and
   * the behaviour this spec is about shows up only in the frame after the click. Where the landing
   * is expected to change, poll until it does; where it must be a defined no-op at the end of the
   * range, hold the reading over several frames so a later bad render cannot slip in behind a
   * passing read.
   */
  await expect
    .poll(async () => selectedAbbreviations(await readTracker(input.page))[0], { timeout: 10_000 })
    .not.toBe(undefined);
  if (before !== undefined) {
    await input.page.waitForTimeout(150);
  }
  return readTracker(input.page);
}

test.describe("Player Combat visibility V1 — declaration wording and blank-cell navigation (#862)", () => {
  test.use({ storageState: "e2e/.auth/gm.json", viewport: { height: 900, width: 1280 } });

  test("names the declared action and target on both surfaces and lets the player cursor land on blank tracker cells", async ({
    browser,
    page: gmPage,
  }) => {
    test.setTimeout(240_000);
    const suffix = Date.now();
    const playerContext = await browser.newContext({
      storageState: "e2e/.auth/player.json",
      viewport: { height: 900, width: 1280 },
    });
    const secondContext = await browser.newContext({ storageState: "e2e/.auth/non-holder.json" });
    const playerUser = await json<{ user: { id: string } }>(
      await playerContext.request.get(`${API_URL}/auth/me`),
    );
    const secondUser = await json<{ user: { id: string } }>(
      await secondContext.request.get(`${API_URL}/auth/me`),
    );

    // Two player-held Characters. One account may hold only one active Character per Scenario, so
    // the second combatant needs a second account; this also gives the player surface a tracker
    // row it does not control, which is what row 6's traversal has to cross.
    const characters = [
      {
        context: playerContext,
        id: `v1-player-${suffix}`,
        name: `V1 Player ${suffix}`,
        userId: playerUser.user.id,
      },
      {
        context: secondContext,
        id: `v1-second-${suffix}`,
        name: `V1 Second ${suffix}`,
        userId: secondUser.user.id,
      },
    ];
    for (const character of characters) {
      const created = await character.context.request.post(`${API_URL}/characters`, {
        data: characterPayload(character.id, character.name),
      });
      expect(created.ok(), await created.text()).toBe(true);
    }

    const campaign = await post<{ campaign: { id: string } }>(gmPage.request, "/campaigns", {
      name: `Issue 862 Visibility ${suffix}`,
      status: "active",
    });
    const campaignId = campaign.campaign.id;
    for (const character of characters) {
      await post(gmPage.request, `/campaigns/${campaignId}/roster`, {
        category: "pc",
        sourceId: character.id,
        sourceType: "character",
      });
    }
    const scenario = await post<{ scenario: { id: string } }>(
      gmPage.request,
      `/campaigns/${campaignId}/scenarios`,
      { name: `Issue 862 Scenario ${suffix}`, status: "live" },
    );
    const scenarioId = scenario.scenario.id;
    const participantIdByCharacterId: Record<string, string> = {};
    for (const character of characters) {
      const participant = await post<{ participant: { id: string } }>(
        gmPage.request,
        `/scenarios/${scenarioId}/participants/character`,
        { characterId: character.id, controlledByUserId: character.userId },
      );
      participantIdByCharacterId[character.id] = participant.participant.id;
      await post(
        gmPage.request,
        `/scenarios/${scenarioId}/participants/${participant.participant.id}/refresh-character-equipment`,
      );
    }

    const now = new Date().toISOString();
    const combatantIds = characters.map((character) => `issue-862-${character.id}`);
    const created = await post<{ encounter: EncounterSession }>(
      gmPage.request,
      `/scenarios/${scenarioId}/encounters`,
      {
        session: {
          campaignId,
          createdAt: now,
          currentRound: 1,
          id: `issue-862-encounter-${suffix}`,
          kind: "combat",
          participantMembershipMode: "explicit",
          participants: characters.map((character, index) => ({
            characterId: character.id,
            id: combatantIds[index]!,
            label: character.name,
            participantType: "scenario",
            scenarioParticipantId: participantIdByCharacterId[character.id],
          })),
          scenarioId,
          status: "active",
          title: `Issue 862 Combat ${suffix}`,
          updatedAt: now,
        },
      },
    );
    const encounterId = created.encounter.id;
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

    // Round 1 opens on the Combat Experience check, which gates declaration. Resolving it is
    // scaffolding, exactly as the GM panel's own component fixture does it.
    const afterExperience = combatantIds.reduce(
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
    expect(afterExperience.currentStep).toBe("select_actions");

    /*
     * Each combatant declares `Single attack` against the other, so both an action label and a
     * target identity exist on each declaration event — the two facts row 5 names. The target
     * rides in `phaseContexts.phase1.targetParticipantId`, which is what
     * `declarationTargetParticipantId` reads for the event's `targetParticipantId`.
     */
    const afterDeclarations = combatantIds.reduce((state, participantId, index) => {
      const opponentId = combatantIds[index === 0 ? 1 : 0]!;
      return recordCombatRoundDeclaration({
        command: { createdAt: new Date(Date.now() + 100 + index).toISOString() },
        declaration: {
          actionId: "attack_parry",
          phaseContexts: {
            phase1: {
              modifierBuckets: {
                general: [],
                situationDb: [],
                situationInitiative: [],
                situationObSkill: [],
              },
              targetParticipantId: opponentId,
            },
          },
          roundNumber: 1,
        },
        participantId,
        state,
        submittedBy: "player",
      });
    }, afterExperience);

    /*
     * ---- The shared-stage rule, measured on a live round before anything is advanced ----
     *
     * `buildProjectedCombatTrackerModel` refuses to draw the inspection cursor on an active-round
     * cell past the canonical current step (`docs/architecture/combat-ux-principles.md`: "a future
     * no-work stage remains neutral until the shared board reaches it"). Row 6's handler change
     * borrows that same rule, so a forward press on a live round is still a defined no-op rather
     * than a selection the tracker would not draw. Measured here, on the state this round is
     * actually in, before the advance below removes every future step.
     */
    const liveUpdate = await gmPage.request.put(`${API_URL}/encounters/${encounterId}`, {
      data: {
        expectedRevision: activeEncounter.encounter.updatedAt,
        session: {
          ...activeEncounter.encounter,
          combatRoundState: afterDeclarations,
          currentRound: 1,
          status: "active",
        },
      },
    });
    expect(liveUpdate.ok(), await liveUpdate.text()).toBe(true);
    const liveEncounter = await json<{ encounter: EncounterSession }>(
      await gmPage.request.get(`${API_URL}/encounters/${encounterId}`),
    );

    const livePlayerPage = await playerContext.newPage();
    await livePlayerPage.goto(`/campaigns/${campaignId}/scenarios/${scenarioId}/player/combat`);
    await expect(livePlayerPage.locator('[aria-label="Combat round timeline grid"]')).toBeVisible();
    const liveCurrentTask = livePlayerPage.getByRole("button", {
      name: /^(Current task|Resume current task)$/,
    });
    await expect(liveCurrentTask).toHaveText("Current task");
    const liveBefore = await readTracker(livePlayerPage);
    expect(
      selectedAbbreviations(liveBefore),
      "Player live round: positive control — exactly one highlighted cell to start from",
    ).toEqual(["DE"]);
    await livePlayerPage.getByRole("button", { exact: true, name: "Next step" }).click();
    /*
     * Held over several frames rather than read once: a stale pre-click frame and a correct frame
     * look identical for a no-op, so a single read would pass on the wrong one.
     */
    for (let hold = 1; hold <= 5; hold += 1) {
      const reading = await readTracker(livePlayerPage);
      expect(
        selectedAbbreviations(reading),
        `Player live round: the cursor must not move ahead of the shared board (hold ${hold}/5)`,
      ).toEqual(["DE"]);
      await livePlayerPage.waitForTimeout(120);
    }
    await expect(
      liveCurrentTask,
      "Player live round: a refused move must not open the historical inspector either",
    ).toHaveText("Current task");
    await livePlayerPage.close();

    /*
     * Advance to the round summary. Two things this buys, both load-bearing:
     *
     * - the Declaration cell becomes *historical*, which is the only state in which the GM
     *   inspector renders the `Historical result` panel the row-5 summary lives in;
     * - every visible step of the active round becomes `stageReached`, so the twelve rendered
     *   columns are all reached and all but Declaration are blank — no initiative was rolled, no
     *   attack was made and no step snapshot was written. That is exactly row 6's subject: cells
     *   the grid draws, which the player cursor refused to land on.
     *
     * Bounded loop. `advanceCombatRoundStep` throws `Round-end review incomplete.` at
     * `round_summary`, so the bound is both a guard and the stop condition.
     */
    let combatRoundState = afterDeclarations;
    for (
      let advance = 0;
      advance < 16 && combatRoundState.currentStep !== "round_summary";
      advance += 1
    ) {
      combatRoundState = advanceCombatRoundStep(combatRoundState, {
        command: { createdAt: new Date(Date.now() + 200 + advance).toISOString() },
      });
    }
    expect(combatRoundState.currentStep).toBe("round_summary");
    const stateUpdate = await gmPage.request.put(`${API_URL}/encounters/${encounterId}`, {
      data: {
        expectedRevision: liveEncounter.encounter.updatedAt,
        session: {
          ...liveEncounter.encounter,
          combatRoundState,
          currentRound: 1,
          status: "active",
        },
      },
    });
    expect(stateUpdate.ok(), await stateUpdate.text()).toBe(true);

    const [firstLabel, secondLabel] = characters.map((character) => character.name) as [
      string,
      string,
    ];

    // ---- Row 5, GM surface ----
    await gmPage.goto(
      `/campaigns/${campaignId}?scenarioId=${scenarioId}&encounterId=${encounterId}&tab=combat`,
    );
    /*
     * Forgejo #987. `/^Combat inspector — /` also matched the phase-wide heading, so the
     * precondition that is supposed to establish "the inspector is on a participant" passed in
     * exactly the state it exists to exclude; this block then read the inspected label out of
     * that heading (it returned `Round`) and clicked `Previous step`, a control the phase-wide arm
     * does not render. The narrowed matcher below discriminates the two arms, and every later read
     * and click on the arm carries its own bound, so the phase-wide arm is named here rather than
     * waiting out the test timeout on a locator that will never resolve.
     */
    const anyInspectorHeading = gmPage
      .getByRole("heading", { name: GM_INSPECTOR_ANY_HEADING })
      .first();
    const inspectorHeading = gmPage.getByRole("heading", {
      name: GM_INSPECTOR_PARTICIPANT_HEADING,
    });
    /** Which arm is on screen, for the failure message only. Bounded, and never a subject here. */
    const renderedInspectorHeading = async () =>
      (
        (await anyInspectorHeading
          .innerText({ timeout: GM_INSPECTOR_CONTROL_TIMEOUT_MS })
          .catch(() => undefined)) ?? "<no Combat inspector heading>"
      ).replace(/\s+/g, " ");
    const visibleWithin = async (locator: Locator, timeout: number) =>
      locator
        .waitFor({ state: "visible", timeout })
        .then(() => true)
        .catch(() => false);
    /*
     * The precondition is re-established at each later point that needs the participant arm,
     * because the step walk between them moves the selection and `buildCombatRoundInspector`
     * returns `participant: undefined` for any cell carrying no `participantId`. So the arm can be
     * a participant here and phase-wide by the label read below.
     */
    const phaseWideArm = async (what: string): Promise<never> => {
      throw new Error(
        `GM: ${what} needs the inspector's participant arm, but the inspector is on its ` +
          `phase-wide row, which names no participant and renders no tracker inspection ` +
          `navigation. The rendered heading is ${JSON.stringify(await renderedInspectorHeading())}.`,
      );
    };
    await expect(
      inspectorHeading,
      "the GM inspector is on a participant, not on its phase-wide row",
    ).toBeVisible({ timeout: GM_INSPECTOR_SETTLE_TIMEOUT_MS });
    await expect(gmPage.locator('[aria-label="Combat round timeline grid"]')).toBeVisible();

    // Walk the GM cursor back to the Declaration column, whichever step it opened on.
    const previousStep = gmPage.getByRole("button", { exact: true, name: "Previous step" });
    await expect
      .poll(
        async () => {
          const reading = await readTracker(gmPage);
          if (selectedAbbreviations(reading)[0] === "DE") return "DE";
          /*
           * `Previous step` is inside the same `inspector.participant` ternary as the heading
           * above (`CombatRoundManagerPanel.tsx:12941`) and carries no `disabled` prop at any
           * state, so an absent control is the phase-wide arm rather than a slow page. Existence
           * with its own bound, then a bounded click. The un-timed click was not unbounded —
           * `pollAgainstDeadline` races the generator against this poll's own deadline, measured
           * at 30 001 ms — but it reported only `Timeout 30000ms exceeded while waiting on the
           * predicate`, naming neither the control nor the arm (#987).
           */
          if (!(await visibleWithin(previousStep, GM_INSPECTOR_CONTROL_TIMEOUT_MS))) {
            await phaseWideArm("the step walk back to the Declaration cell");
          }
          await previousStep.click({ timeout: GM_INSPECTOR_CONTROL_TIMEOUT_MS });
          return selectedAbbreviations(await readTracker(gmPage))[0];
        },
        { message: "GM: reach the Declaration cell", timeout: 30_000 },
      )
      .toBe("DE");

    const gmDeclaration = await readTracker(gmPage);
    expect(
      gmDeclaration.visibleColumns,
      "GM: positive control — the twelve ruled columns are rendered",
    ).toEqual([...VISIBLE_STEP_ABBREVIATIONS]);
    expect(
      gmDeclaration.resultPanelTitle,
      "GM: the historical result panel must be the one rendered",
    ).toContain("Declare action");
    /*
     * The read that #987's QA failed this candidate on. Narrowing the matcher without bounding the
     * read moved the hang rather than removing it: on the phase-wide arm the narrowed locator
     * resolves to nothing, and an un-timed `innerText()` waits for it until the 240-second test
     * timeout. Bounded, and the arm is named instead of the locator.
     */
    const inspectedHeadingText = await inspectorHeading
      .innerText({ timeout: GM_INSPECTOR_CONTROL_TIMEOUT_MS })
      .catch(() => undefined);
    const gmInspectedLabel = (
      inspectedHeadingText ?? (await phaseWideArm("reading the inspected participant label"))
    )
      .replace(/^Combat inspector — /, "")
      .split(" · ")[0]!;
    const gmOpponentLabel = gmInspectedLabel === firstLabel ? secondLabel : firstLabel;
    expect(
      gmDeclaration.resultPanelText,
      "GM: the summary must name the committed action and the target",
    ).toContain(`${gmInspectedLabel} declared Single attack against ${gmOpponentLabel}.`);
    expect(
      gmDeclaration.resultPanelText,
      "GM: the unconditional wording must be gone, not merely supplemented",
    ).not.toContain("declared an action.");
    // The detail rows that were already there are unchanged, so the summary is additive wording
    // over facts this viewer already had rather than a new disclosure.
    expect(gmDeclaration.resultPanelText).toContain("Action: Single attack");
    expect(gmDeclaration.resultPanelText).toContain(`Target: ${gmOpponentLabel}`);

    // ---- Row 5, player surface, for the player's own declaration ----
    const playerPage = await playerContext.newPage();
    await playerPage.goto(`/campaigns/${campaignId}/scenarios/${scenarioId}/player/combat`);
    await expect(playerPage.getByText("Combat history", { exact: true })).toBeVisible();
    await expect(playerPage.locator('[aria-label="Combat round timeline grid"]')).toBeVisible();

    await expect
      .poll(
        async () => {
          const reading = await readTracker(playerPage);
          if (selectedAbbreviations(reading)[0] === "DE") return "DE";
          await playerPage.getByRole("button", { exact: true, name: "Previous step" }).click();
          return selectedAbbreviations(await readTracker(playerPage))[0];
        },
        { message: "Player: reach the Declaration cell", timeout: 30_000 },
      )
      .toBe("DE");

    const playerDeclaration = await readTracker(playerPage);
    expect(
      playerDeclaration.visibleColumns,
      "Player: positive control — the twelve ruled columns are rendered",
    ).toEqual([...VISIBLE_STEP_ABBREVIATIONS]);
    const playerSelectedLabel = playerDeclaration.selectedCellTitles[0]?.split(" · ")[0];
    const playerOpponentLabel = playerSelectedLabel === firstLabel ? secondLabel : firstLabel;
    expect(
      playerDeclaration.resultPanelText,
      "Player: the summary must name the committed action and the target",
    ).toContain(`${playerSelectedLabel} declared Single attack against ${playerOpponentLabel}.`);
    expect(playerDeclaration.resultPanelText).not.toContain("declared an action.");
    for (const field of PRIVATE_FIELD_NAMES) {
      expect(
        playerDeclaration.resultPanelText,
        `Player: ${field} must not appear in the rendered inspector`,
      ).not.toContain(field);
    }

    // ---- Row 6, player surface ----
    /*
     * The measurement is the rendered landing sequence. On the unrepaired baseline the player
     * cursor refuses to move onto a non-`inspectable` cell at all, so pressing `Next step` from
     * `DE` clamps: the same cell stays highlighted however many times it is pressed. Here the
     * whole visible column set must be reachable, blank cells included, and the tracker must keep
     * exactly one highlighted cell after every press.
     */
    const visited: string[] = ["DE"];
    for (let press = 1; press < VISIBLE_STEP_ABBREVIATIONS.length; press += 1) {
      const reading = await pressStep({ label: "Next step", page: playerPage });
      const abbreviations = selectedAbbreviations(reading);
      expect(
        abbreviations,
        `Player: exactly one highlighted tracker cell after press ${press}`,
      ).toHaveLength(1);
      expect(
        abbreviations[0],
        `Player: the removed step has no cell to land on (press ${press})`,
      ).not.toBe("PD");
      visited.push(abbreviations[0]!);
      // The paired disabled control: whatever the cursor lands on, the panel it opens carries no
      // field from `rollerPrivate` or `gmReview`. A navigation change must not pass by granting
      // data, and a landing on an empty cell must not pass by rendering nothing at all.
      for (const field of PRIVATE_FIELD_NAMES) {
        expect(
          reading.resultPanelText ?? "",
          `Player: ${field} must not appear after landing on ${abbreviations[0]}`,
        ).not.toContain(field);
      }
    }

    expect(
      visited,
      "Player: every rendered column must be a landing, blank cells included",
    ).toEqual([...VISIBLE_STEP_ABBREVIATIONS]);

    // A landing with nothing recorded shows the inspector's own empty text rather than a blank
    // workspace, and the tracker and the navigation controls are still there to leave it with.
    const playerAtEnd = await readTracker(playerPage);
    expect(playerAtEnd.resultPanelText ?? "").toContain("No recorded result for this step.");
    await expect(playerPage.locator('[aria-label="Combat round timeline grid"]')).toBeVisible();
    await expect(
      playerPage.getByRole("button", { exact: true, name: "Previous step" }),
    ).toBeVisible();

    // Reversible, and the arrow keys drive the same path as the buttons.
    await playerPage.locator('[aria-label="Combat round timeline grid"]').focus();
    await playerPage.keyboard.press("ArrowLeft");
    await expect
      .poll(async () => selectedAbbreviations(await readTracker(playerPage))[0], {
        message: "Player: ArrowLeft must move back off the clamp",
        timeout: 10_000,
      })
      .toBe("D2");

    await playerPage.screenshot({
      fullPage: true,
      path: "test-results/issue-862-player-combat.png",
    });
    await gmPage.screenshot({ fullPage: true, path: "test-results/issue-862-gm-combat.png" });

    await playerPage.close();
    await playerContext.close();
    await secondContext.close();
  });
});
