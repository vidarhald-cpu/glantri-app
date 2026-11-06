import { expect, test, type APIRequestContext, type Page } from "@playwright/test";
import {
  commitCombatRoundEndParticipantReview,
  initializeCombatRoundState,
  isGlobalCombatRoundStep,
  prepareCombatRoundEndReview,
  rollCombatRoundCombatExperience,
  setCombatRoundCombatExperienceDifficulty,
  COMBAT_ROUND_STEPS,
  type CombatRoundState,
  type EncounterSession,
} from "@glantri/domain";

import { characterPayload } from "./character-fixture";
import { API_URL } from "./targets";

/**
 * Forgejo #988 — a GM whose inspector sits on a round-wide step can reach a participant.
 *
 * ## What was wrong
 *
 * `CombatRoundManagerPanel` renders one `Tracker inspection navigation` section, and it used to
 * render only inside the `inspector.participant` arm. On a round-wide step the canonical current
 * task is **ownerless** — measured for all seven members of `isGlobalCombatRoundStep` — so
 * `currentTaskSelection` carries no participant, the inspector renders its phase-wide arm, and the
 * one control that selects a participant was absent. Nothing on that arm moved the selection, so
 * the state sustained itself. CI task 10870 hit it at `round_summary` and reported the heading
 * `"Combat inspector — Round 1 · Summary/update"`, which is the string state B below reproduces.
 *
 * ## What this spec proves, and what it does not
 *
 * It **drives** the control: it reads the phase-wide heading, presses `Next participant`, and
 * requires the heading to name a participant afterwards. Reading that the section renders would
 * not settle it — a rendered-but-inert control looks identical in the DOM.
 *
 * It is a discrimination proof: restore the `inspector.participant ?` gate and the section is
 * absent, so `expect(nav.present).toBe(true)` fails at the first width of state A, before any
 * click. It does **not** assert anything about whether a round-wide step *should* select a
 * participant: the phase-wide arm's own content is asserted unchanged (its three empty panel
 * cards and its `Phase-wide` subheading are still there), because the repair adds a control and
 * decides nothing about what the step displays.
 *
 * ## Geometry method
 *
 * Usable widths 768 / 1024 / 1440, the set `server-derived-step-snapshots.spec.ts` uses on this
 * same panel. Every rectangle is read inside **one** `page.evaluate` together with
 * `window.scrollY`: the Combat page autoscrolls after mount, so reads taken across an `await`
 * straddle that scroll and report hundreds of pixels of movement that never happened. The usable
 * width is reported as `document.documentElement.clientWidth` alongside the requested viewport,
 * because the two differ by a chrome/scrollbar offset on some hosts.
 *
 * Occlusion is probed separately with `elementFromPoint`: a clip measurement reports 0 and is
 * correct for a control that is painted and then covered by an opaque sibling.
 */

const PRIMARY_WEAPON_TEMPLATE = "weapon-template-longsword";
const WIDTHS = [768, 1024, 1440] as const;
const NAV_SECTION = 'section[aria-label="Tracker inspection navigation"]';
/** Both inspector arms start with these words; only the participant arm has a label segment. */
const ANY_INSPECTOR_HEADING = /^Combat inspector — /;
const PARTICIPANT_INSPECTOR_HEADING = /^Combat inspector — .+ · Round \d+ · /;

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

interface NavReading {
  /** The inspector heading, which says which arm is on screen. */
  readonly heading: string;
  /** The `Phase-wide` subheading of the participant-less arm, if that arm is rendered. */
  readonly phaseWideSubheading: boolean;
  /** The participant-less arm's three empty panel cards, by label, in document order. */
  readonly phaseWideCardLabels: string[];
  readonly nav: {
    readonly buttons: { readonly disabled: boolean; readonly label: string }[];
    readonly height: number;
    readonly left: number;
    readonly present: boolean;
    readonly top: number;
    readonly width: number;
  };
  /** Every nav button's centre point, and whether that button is the element painted there. */
  readonly navOcclusion: { readonly label: string; readonly topmostIsSelf: boolean }[];
  /** Document-coordinate box of the panel title, an invariant of this header row. */
  readonly title: { readonly left: number; readonly top: number };
  /** Document-coordinate box of the step controller, the other occupant of the header row. */
  readonly stepController: { readonly left: number; readonly top: number; readonly width: number };
  readonly scrollY: number;
  /** What the browser actually gave the document, not what `setViewportSize` asked for. */
  readonly usableWidth: number;
  readonly viewportWidth: number;
}

/**
 * One atomic read of the header row and the inspector arm. Nothing here crosses an `await`, so
 * every rectangle below belongs to the same scroll position, which is reported with them.
 */
async function readNav(page: Page): Promise<NavReading> {
  return page.evaluate((navSelector) => {
    const scrollY = Math.round(window.scrollY);
    const scrollX = Math.round(window.scrollX);
    const box = (node: Element | null | undefined) => {
      if (!node) return undefined;
      const rect = node.getBoundingClientRect();
      return {
        height: Math.round(rect.height),
        left: Math.round(rect.left + scrollX),
        top: Math.round(rect.top + scrollY),
        width: Math.round(rect.width),
      };
    };
    const heading = [...document.querySelectorAll("h3")].find((node) =>
      (node.textContent ?? "").trim().startsWith("Combat inspector — "),
    );
    const nav = document.querySelector(navSelector);
    const navButtons = nav ? [...nav.querySelectorAll("button")] : [];
    const navBox = box(nav);
    const title = [...document.querySelectorAll("h2")].find(
      (node) => (node.textContent ?? "").trim() === "Combat Round Manager",
    );
    const stepController = document.querySelector('section[aria-label="Step controller"]');
    const inspectorSection = document.querySelector('section[aria-label="Combat round inspector"]');
    const phaseWideCardLabels = inspectorSection
      ? [...inspectorSection.querySelectorAll("section > strong")]
          .map((node) => (node.textContent ?? "").trim())
          .filter((label) => ["Declaration", "Phase 1", "Phase 2"].includes(label))
      : [];
    return {
      heading: (heading?.textContent ?? "<no Combat inspector heading>")
        .replace(/\s+/g, " ")
        .trim(),
      nav: {
        buttons: navButtons.map((button) => ({
          disabled: (button as HTMLButtonElement).disabled,
          label: button.getAttribute("aria-label") ?? "",
        })),
        height: navBox?.height ?? 0,
        left: navBox?.left ?? -1,
        present: Boolean(nav),
        top: navBox?.top ?? -1,
        width: navBox?.width ?? 0,
      },
      navOcclusion: navButtons.map((button) => {
        const rect = button.getBoundingClientRect();
        const topmost = document.elementFromPoint(
          Math.round(rect.left + rect.width / 2),
          Math.round(rect.top + rect.height / 2),
        );
        return {
          label: button.getAttribute("aria-label") ?? "",
          topmostIsSelf: Boolean(topmost && button.contains(topmost)),
        };
      }),
      phaseWideCardLabels,
      phaseWideSubheading: inspectorSection
        ? [...inspectorSection.querySelectorAll("div")].some((node) =>
            (node.textContent ?? "").trim().endsWith("· Phase-wide"),
          )
        : false,
      scrollY,
      stepController: {
        left: box(stepController)?.left ?? -1,
        top: box(stepController)?.top ?? -1,
        width: box(stepController)?.width ?? 0,
      },
      title: { left: box(title)?.left ?? -1, top: box(title)?.top ?? -1 },
      usableWidth: document.documentElement.clientWidth,
      viewportWidth: window.innerWidth,
    };
  }, NAV_SECTION);
}

test.describe("#988 — the GM inspector offers participant selection on a round-wide step", () => {
  test.use({ storageState: "e2e/.auth/gm.json" });

  test("reaches a participant from a round-wide step at 768 / 1024 / 1440", async ({
    browser,
    page: gmPage,
  }, testInfo) => {
    test.setTimeout(600_000);
    const suffix = Date.now();
    const shot = (name: string) => testInfo.outputPath(`${name}.png`);
    const playerContext = await browser.newContext({ storageState: "e2e/.auth/player.json" });
    const playerUser = await json<{ user: { id: string } }>(
      await playerContext.request.get(`${API_URL}/auth/me`),
    );

    // The predicate this spec is about, asserted rather than restated: seven round-wide steps.
    const globalSteps = COMBAT_ROUND_STEPS.filter((step) => isGlobalCombatRoundStep(step));
    expect(globalSteps, JSON.stringify(globalSteps)).toHaveLength(7);

    // ---- A fighter with a real build and a ready weapon, so the panel resolves its figures. ----
    const characterId = `inspector-988-${suffix}`;
    const characterName = `Inspector Fighter ${suffix}`;
    const created = await playerContext.request.post(`${API_URL}/characters`, {
      data: fighterPayload(characterId, characterName),
    });
    expect(created.ok(), await created.text()).toBe(true);

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
    await post(
      playerContext.request,
      `/characters/${characterId}/equipment/loadout/active-primary-weapon`,
      { expectedRevision: equipmentRevision, itemId: weaponItemId },
    );

    // ---- Campaign, scenario, two participants, encounter. ----
    const campaign = await post<{ campaign: { id: string } }>(gmPage.request, "/campaigns", {
      name: `Issue 988 Inspector ${suffix}`,
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
      { name: `Issue 988 Scenario ${suffix}`, status: "live" },
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
    const targetName = `Inspector Target ${suffix}`;
    const target = await post<{ participant: { id: string } }>(
      gmPage.request,
      `/scenarios/${scenarioId}/participants/entity`,
      {
        entityInput: { kind: "npc", name: targetName, snapshot: { displayName: targetName } },
        role: "enemy",
      },
    );

    const now = new Date().toISOString();
    const fighterCombatantId = `issue-988-fighter-${suffix}`;
    const targetCombatantId = `issue-988-target-${suffix}`;
    const encounter = await post<{ encounter: EncounterSession }>(
      gmPage.request,
      `/scenarios/${scenarioId}/encounters`,
      {
        session: {
          campaignId,
          createdAt: now,
          currentRound: 1,
          id: `issue-988-encounter-${suffix}`,
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
          title: `Issue 988 Combat ${suffix}`,
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

    const currentEncounter = async () =>
      (
        await json<{ encounter: EncounterSession }>(
          await gmPage.request.get(`${API_URL}/encounters/${encounterId}`),
        )
      ).encounter;
    /** Persists a round state through the real encounter route, as the GM's own writes do. */
    const putRoundState = async (label: string, combatRoundState: CombatRoundState) => {
      const before = await currentEncounter();
      const response = await gmPage.request.put(`${API_URL}/encounters/${encounterId}`, {
        data: {
          expectedRevision: before.updatedAt,
          session: { ...before, combatRoundState, currentRound: 1, status: "active" },
        },
      });
      expect(response.ok(), `${label}: ${await response.text()}`).toBe(true);
    };

    const openCombat = async (width: number) => {
      await gmPage.setViewportSize({ height: 900, width });
      await gmPage.goto(
        `/campaigns/${campaignId}?scenarioId=${scenarioId}&encounterId=${encounterId}&tab=combat`,
      );
      await expect(
        gmPage.getByRole("heading", { name: ANY_INSPECTOR_HEADING }).first(),
      ).toBeVisible({ timeout: 60_000 });
      await gmPage.waitForTimeout(400);
    };

    /**
     * Reads the three widths for one round-wide state, captures each, and then drives the control
     * at the last width. The captures are taken before any assertion so that a run without the
     * repair still writes its before-images while failing.
     */
    const measureState = async (label: string): Promise<NavReading[]> => {
      const readings: NavReading[] = [];
      for (const width of WIDTHS) {
        await openCombat(width);
        readings.push(await readNav(gmPage));
        await gmPage.screenshot({ fullPage: true, path: shot(`${label}-${width}`) });
      }
      console.log(`#988 ${label} readings: ${JSON.stringify(readings)}`);
      return readings;
    };

    const assertRoundWideArm = (label: string, readings: NavReading[]) => {
      expect(readings.map((reading) => reading.viewportWidth)).toEqual([...WIDTHS]);
      for (const reading of readings) {
        const context = `${label} width ${reading.viewportWidth} (usable ${reading.usableWidth}, scrollY ${reading.scrollY}): ${JSON.stringify(reading)}`;
        // The state under test really is the participant-less arm: the heading carries no label
        // segment, and the arm's own `Phase-wide` subheading is on screen.
        expect(reading.heading, context).toMatch(ANY_INSPECTOR_HEADING);
        expect(reading.heading, context).not.toMatch(PARTICIPANT_INSPECTOR_HEADING);
        expect(reading.phaseWideSubheading, context).toBe(true);
        // The arm's content is an invariant: #988 adds a control, it does not recompose the step.
        expect(reading.phaseWideCardLabels, context).toEqual(["Declaration", "Phase 1", "Phase 2"]);
        // The repair itself: the navigation is rendered, and none of it is disabled — the issue
        // records that a disabled pair of arrows would not be a way in.
        expect(reading.nav.present, context).toBe(true);
        expect(
          reading.nav.buttons.map((button) => button.label),
          context,
        ).toEqual(["Previous participant", "Next participant", "Previous step", "Next step"]);
        expect(
          reading.nav.buttons.filter((button) => button.disabled),
          context,
        ).toEqual([]);
        // Laid out, not collapsed, at this usable width.
        expect(reading.nav.height, context).toBeGreaterThan(0);
        expect(reading.nav.width, context).toBeGreaterThan(0);
        // Painted, not covered: a clip measurement reports 0 for an occluded control and is right.
        expect(
          reading.navOcclusion.filter((probe) => !probe.topmostIsSelf),
          context,
        ).toEqual([]);
        // The header row's other occupants are still there and still laid out.
        expect(reading.title.top, context).toBeGreaterThanOrEqual(0);
        expect(reading.stepController.width, context).toBeGreaterThan(0);
      }
    };

    /**
     * Drives the control rather than reading it. `Next participant` is pressed from the
     * participant-less arm; `getAdjacentCombatRoundTimelineParticipantSelection` reads an absent
     * participant as index 0, so it lands on the second row, and `Previous participant` from a
     * fresh load lands on the first. Both are asserted: one direction working would leave open
     * that the arrows only happen to agree with whatever the cursor already held.
     */
    const driveToParticipant = async (label: string, direction: string): Promise<string> => {
      await openCombat(1440);
      const before = await readNav(gmPage);
      expect(before.heading, `${label} ${direction} precondition`).not.toMatch(
        PARTICIPANT_INSPECTOR_HEADING,
      );
      await gmPage.getByRole("button", { name: direction, exact: true }).click();
      await expect(
        gmPage.getByRole("heading", { name: PARTICIPANT_INSPECTOR_HEADING }),
      ).toBeVisible({ timeout: 15_000 });
      const after = await readNav(gmPage);
      await gmPage.screenshot({
        fullPage: true,
        path: shot(`${label}-after-${direction.replace(/\s+/g, "-")}`),
      });
      console.log(
        `#988 ${label} ${direction}: ${JSON.stringify({ after: after.heading, before: before.heading })}`,
      );
      return after.heading;
    };

    // ===================== STATE A: the Declaration step, round-wide =====================
    //
    // At round start the Combat Experience window is not yet open, so the canonical current task
    // is the ownerless `combat_experience:difficulty` task. `currentTaskSelection` therefore
    // carries no participant and the inspector opens on its phase-wide arm, reading
    // `Combat inspector — Round 1 · Declaration`.
    const roundStart = initializeCombatRoundState({ encounter: await currentEncounter() });
    expect(isGlobalCombatRoundStep(roundStart.currentStep), roundStart.currentStep).toBe(true);
    await putRoundState("round start", roundStart);

    const declarationReadings = await measureState("declaration-round-wide");
    assertRoundWideArm("declaration", declarationReadings);
    const declarationNext = await driveToParticipant("declaration", "Next participant");
    const declarationPrevious = await driveToParticipant("declaration", "Previous participant");
    // Two different rows: the arrows move the selection rather than revealing one fixed row.
    expect(declarationNext, `both directions reached the same row: ${declarationNext}`).not.toBe(
      declarationPrevious,
    );

    // ===================== STATE B: the Summary/update step, round-wide =====================
    //
    // This is CI task 10870's exact state. With the round-end review prepared and every
    // participant review committed, the canonical task is the ownerless round-boundary advance, so
    // the inspector reads `Combat inspector — Round 1 · Summary/update` and names no participant.
    const experienceResolved = [fighterCombatantId, targetCombatantId].reduce(
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
        state: initializeCombatRoundState({ encounter: await currentEncounter() }),
      }),
    );
    const atRoundSummary = {
      ...experienceResolved,
      currentCursor: { roundNumber: experienceResolved.roundNumber, step: "SU" as const },
      currentStep: "round_summary" as const,
      selectedStep: "round_summary" as const,
    };
    const prepared = prepareCombatRoundEndReview({
      command: { createdAt: new Date().toISOString() },
      state: atRoundSummary,
    });
    const reviewed = (
      [
        [fighterCombatantId, participant.participant.id],
        [targetCombatantId, target.participant.id],
      ] as const
    ).reduce(
      (state, [combatantId, scenarioParticipantId]) =>
        commitCombatRoundEndParticipantReview({
          command: { createdAt: new Date().toISOString() },
          participantId: combatantId,
          scenarioParticipantId,
          state,
        }).state,
      prepared,
    );
    expect(reviewed.currentStep).toBe("round_summary");
    await putRoundState("round summary", reviewed);

    const summaryReadings = await measureState("summary-round-wide");
    // The string CI task 10870 reported, reproduced here.
    expect(summaryReadings[0]!.heading, JSON.stringify(summaryReadings[0])).toContain(
      "· Summary/update",
    );
    assertRoundWideArm("summary", summaryReadings);
    const summaryNext = await driveToParticipant("summary", "Next participant");
    const summaryPrevious = await driveToParticipant("summary", "Previous participant");
    expect(summaryNext, `both directions reached the same row: ${summaryNext}`).not.toBe(
      summaryPrevious,
    );
    // The step the GM was inspecting is kept: the arrows move along the row axis only.
    expect(summaryNext).toContain("· Summary/update");
    expect(summaryPrevious).toContain("· Summary/update");
  });
});
