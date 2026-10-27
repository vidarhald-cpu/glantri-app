import { describe, expect, it } from "vitest";

import type {
  CombatRoundState,
  CombatRoundStep,
  EncounterParticipant,
  EncounterSession,
} from "@glantri/domain";
import {
  advanceCombatRoundStep,
  commitCombatRoundEndParticipantReview,
  encounterSessionSchema,
  initializeCombatRoundState,
  prepareCombatRoundEndReview,
  rollCombatRoundCombatExperience,
  setCombatRoundCombatExperienceDifficulty,
} from "@glantri/domain";

import { VISIBLE_COMBAT_ROUND_TRACKER_STEPS } from "@/features/combat-history";

import {
  getCombatRoundManagerInspectionSelection,
  getCurrentCombatRoundTaskSelection,
  resolveVisibleCombatRoundInspectionSelection,
} from "./combatRoundSelection";
import {
  getVisibleCombatRoundTimelineStep,
  getVisibleCombatRoundTimelineSelection,
} from "./combatRoundTimelineNavigation";
import {
  applyCombatTrackerSelectionOverlay,
  buildActiveCombatPresentation,
  buildArchivedCombatPresentation,
  buildArchivedCombatPresentationIdentity,
  buildCombatSelectionOverlay,
} from "./view-models/combatPresentationModel";

function participant(input: { id: string; label: string }): EncounterParticipant {
  return {
    declaration: {
      actionType: "none",
      defenseFocus: "none",
      defensePosture: "none",
      targetLocation: "any",
    },
    facing: "north",
    id: input.id,
    initiative: 0,
    label: input.label,
    order: 0,
    orientation: "neutral",
    participantType: "scenario",
    position: { x: 0, y: 0, zone: "center" },
    scenarioParticipantId: `scenario-${input.id}`,
  };
}

function encounter(): EncounterSession {
  return encounterSessionSchema.parse({
    actionLog: [],
    createdAt: "2026-01-01T00:00:00.000Z",
    currentRound: 1,
    currentTurnIndex: 0,
    declarationsLocked: false,
    id: "encounter-783",
    kind: "combat",
    participants: [
      participant({ id: "gladiator", label: "The Gladiator" }),
      participant({ id: "guard", label: "City guard" }),
    ],
    scenarioId: "scenario-783",
    status: "active",
    title: "Entry-point regression",
    turnOrderMode: "manual",
    updatedAt: "2026-01-01T00:00:00.000Z",
  });
}

function completeCleanRoundEndReview(state: CombatRoundState): CombatRoundState {
  const reviewed = prepareCombatRoundEndReview({
    command: { createdAt: "2026-01-01T00:09:00.000Z", createdByUserId: "gm-1" },
    state,
  });

  return reviewed.participants.reduce<CombatRoundState>((current, entry, index) => {
    if (current.roundEndReview?.participantReviews[entry.participantId]?.status === "complete") {
      return current;
    }

    return commitCombatRoundEndParticipantReview({
      command: {
        createdAt: `2026-01-01T00:09:${String(index + 1).padStart(2, "0")}.000Z`,
        createdByUserId: "gm-1",
      },
      participantId: entry.participantId,
      scenarioParticipantId: `scenario-${entry.participantId}`,
      state: current,
    }).state;
  }, reviewed);
}

/**
 * #783 — a round-2 `pre_declaration` state the **engine itself produced**.
 *
 * Independent QA could not drive its fixture past `select_actions` in 25 calls and fell back to a
 * `combatRoundStateSchema.parse`-accepted state that merely set `currentStep` and `currentCursor`.
 * That is the instrument failure this project keeps recording, not a reason to downgrade the
 * finding: the step *is* reachable, by advancing the engine's own schedule rather than by writing
 * the two fields. The walk below starts at `initializeCombatRoundState`, discharges the round-1
 * Combat Experience obligations (round 1 opens at `select_actions`, so they belong there), then
 * calls `advanceCombatRoundStep` until the round-end review is due, completes it, and lets
 * `Start New Round` put the round in `pre_declaration` — which is the step under test.
 */
function roundTwoPreDeclarationState(): { state: CombatRoundState } {
  let state: CombatRoundState = initializeCombatRoundState({ encounter: encounter() });

  state = setCombatRoundCombatExperienceDifficulty({ difficulty: 26, state });
  for (const entry of state.participants) {
    state = rollCombatRoundCombatExperience({
      command: { createdAt: "2026-01-01T00:01:00.000Z", createdByUserId: "gm-1" },
      participantId: entry.participantId,
      rng: () => 0.5,
      skillTotal: 0,
      state,
    }).state;
  }

  for (let guard = 0; guard < 200; guard += 1) {
    if (state.currentStep === "round_summary") {
      state = completeCleanRoundEndReview(state);
    }
    state = advanceCombatRoundStep(state);

    if (state.currentStep === "pre_declaration") {
      return { state };
    }
  }

  throw new Error("The engine never reached pre_declaration.");
}

/**
 * The GM tracker exactly as the panel composes it: the active presentation, the archived
 * presentation, the selection overlay and the overlay application. `selectedCellKey` is the
 * rendered artefact under test — `applyCombatTrackerSelectionOverlay` only sets it when
 * `base.cells` actually holds a cell for the selected round/participant/step, which is why a
 * column-less step produced zero highlighted cells rather than an error.
 */
function buildGmTracker(
  input: { selection: { participantId?: string; step: CombatRoundStep } },
  state: CombatRoundState,
) {
  const active = buildActiveCombatPresentation({
    encounterId: "encounter-783",
    encounterRevision: "revision-1",
    resolveStepStatus: ({ status }) => status,
    roundState: state,
  });
  const participantRows = active.displayParticipants.map((entry) => ({
    label: entry.label,
    participantId: entry.participantId,
  }));
  const archived = buildArchivedCombatPresentation({
    buildHistoricalActionResult: () => ({ interpretedResult: "not under test" }),
    identity: buildArchivedCombatPresentationIdentity({ participantRows, roundState: state }),
    participantRows,
    resolveStepStatus: ({ status }) => status,
    roundState: state,
  });
  const selection = buildCombatSelectionOverlay({
    active,
    archived,
    localSelection: input.selection,
    manualSelection: input.selection,
    pendingSelection: input.selection,
    selectedRoundNumber: state.roundNumber,
  });

  return applyCombatTrackerSelectionOverlay({ base: active.tracker, selection });
}

/**
 * A cell is on screen only when its step has a column: the tracker renders its header row and its
 * body cells from `steps`, while `cells` is keyed from the cell-fact list, which both builders
 * still populate for `pre_declaration`. The rendered highlight is therefore the intersection.
 */
function renderedSelectedCellsOf(tracker: {
  cells: Record<string, { cellKey: string; selected: boolean; step: CombatRoundStep }>;
  steps: readonly CombatRoundStep[];
}) {
  return Object.values(tracker.cells).filter(
    (cell) => cell.selected && tracker.steps.includes(cell.step),
  );
}

describe("#783 GM inspector entry point at round 2 pre-declaration", () => {
  it("reaches round 2 pre-declaration by driving the engine, not by hand-writing two fields", () => {
    const { state } = roundTwoPreDeclarationState();

    expect(state.currentStep).toBe("pre_declaration");
    expect(state.roundNumber).toBe(2);
    expect(state.currentCursor?.step).toBe("PD");
    expect(state.currentCursor?.roundNumber).toBe(2);
    expect(state.participants.length).toBeGreaterThan(0);
  });

  it("confirms the defect's premise: all three producers report the column-less step", () => {
    const { state } = roundTwoPreDeclarationState();

    expect(getCombatRoundManagerInspectionSelection({ state })?.step).toBe("pre_declaration");
    expect(getCurrentCombatRoundTaskSelection(state)?.step).toBe("pre_declaration");
    expect(state.currentStep).toBe("pre_declaration");
    expect(VISIBLE_COMBAT_ROUND_TRACKER_STEPS).not.toContain("pre_declaration");
  });

  it("opens the inspector on a step the GM tracker actually renders a column for", () => {
    const { state } = roundTwoPreDeclarationState();
    const selection = resolveVisibleCombatRoundInspectionSelection({
      state,
      visibleSteps: VISIBLE_COMBAT_ROUND_TRACKER_STEPS,
    });

    expect(VISIBLE_COMBAT_ROUND_TRACKER_STEPS).toContain(selection.step);
    expect(selection.step).toBe("select_actions");
    expect(selection.participantId).toBe(state.participants[0]?.participantId);
  });

  /**
   * The failing assertion on the unrepaired baseline. Before the repair the resolved selection is
   * `pre_declaration`, `base.cells` holds no cell for it, so `selectedCellKey` is `undefined` and
   * every rendered cell stays unselected — the measured `selected: []` with 24/24 disabled.
   */
  it("highlights exactly one rendered cell instead of none", () => {
    const { state } = roundTwoPreDeclarationState();
    const selection = resolveVisibleCombatRoundInspectionSelection({
      state,
      visibleSteps: VISIBLE_COMBAT_ROUND_TRACKER_STEPS,
    });
    const tracker = buildGmTracker({ selection }, state);
    const renderedSelectedCells = renderedSelectedCellsOf(tracker);

    expect(renderedSelectedCells).toHaveLength(1);
    expect(renderedSelectedCells[0]?.step).toBe(selection.step);
    expect(renderedSelectedCells[0]?.cellKey).toBe(tracker.selectedCellKey);
    expect(tracker.steps).toEqual(VISIBLE_COMBAT_ROUND_TRACKER_STEPS);
  });

  it("keeps the unrepaired selection column-less, so the assertion above is not vacuous", () => {
    const { state } = roundTwoPreDeclarationState();
    const unrepaired = getCombatRoundManagerInspectionSelection({ state });
    const tracker = buildGmTracker({ selection: unrepaired! }, state);

    expect(unrepaired?.step).toBe("pre_declaration");
    expect(renderedSelectedCellsOf(tracker)).toHaveLength(0);
    /*
     * `selectedCellKey` is *not* undefined here, and that is the instrument correction worth
     * recording: both tracker builders still populate a `pre_declaration` entry in `cells`, so a
     * selection on that step does mark a cell object — it simply has no column. Asserting on
     * `selectedCellKey` would therefore have read as a pass on the unrepaired baseline. The
     * rendered predicate is `steps.includes(cell.step)`, which is what the header row and the body
     * cells are drawn from.
     */
    expect(tracker.selectedCellKey).toBe(
      `${state.roundNumber}:${unrepaired?.participantId}:pre_declaration`,
    );
    expect(tracker.steps).not.toContain("pre_declaration");
  });
});

describe("#783 rendered-column normalization", () => {
  it("is an identity for every step the tracker renders", () => {
    for (const step of VISIBLE_COMBAT_ROUND_TRACKER_STEPS) {
      expect(
        getVisibleCombatRoundTimelineStep({
          step,
          visibleSteps: VISIBLE_COMBAT_ROUND_TRACKER_STEPS,
        }),
      ).toBe(step);
    }
  });

  it("moves pre_declaration forward to the declaration column the player surface also uses", () => {
    expect(
      getVisibleCombatRoundTimelineStep({
        step: "pre_declaration",
        visibleSteps: VISIBLE_COMBAT_ROUND_TRACKER_STEPS,
      }),
    ).toBe("select_actions");
  });

  it("keeps the participant and only rewrites the step", () => {
    expect(
      getVisibleCombatRoundTimelineSelection({
        selection: { participantId: "gladiator", step: "pre_declaration" },
        visibleSteps: VISIBLE_COMBAT_ROUND_TRACKER_STEPS,
      }),
    ).toEqual({ participantId: "gladiator", step: "select_actions" });
  });

  it("becomes an identity again if pre_declaration is ever restored to the visible set", () => {
    expect(
      getVisibleCombatRoundTimelineStep({
        step: "pre_declaration",
        visibleSteps: ["pre_declaration", ...VISIBLE_COMBAT_ROUND_TRACKER_STEPS],
      }),
    ).toBe("pre_declaration");
  });

  it("falls back backwards when no later step is rendered", () => {
    expect(
      getVisibleCombatRoundTimelineStep({
        step: "round_summary",
        visibleSteps: VISIBLE_COMBAT_ROUND_TRACKER_STEPS.filter((step) => step !== "round_summary"),
      }),
    ).toBe(VISIBLE_COMBAT_ROUND_TRACKER_STEPS.filter((step) => step !== "round_summary").at(-1));
  });
});
