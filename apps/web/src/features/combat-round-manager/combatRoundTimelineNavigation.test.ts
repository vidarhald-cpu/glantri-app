import { describe, expect, it } from "vitest";
import { COMBAT_ROUND_STEPS } from "@glantri/domain";

import {
  getAdjacentCombatRoundTimelineParticipantSelection,
  getAdjacentCombatRoundTimelineStepSelection,
  getAdjacentVisibleCombatRoundTimelineStepSelection,
  getCombatRoundTimelineCellKey,
  getCombatRoundTimelineArrowMove,
  getParticipantIdsForTimelineRound,
} from "./combatRoundTimelineNavigation";
import { VISIBLE_COMBAT_ROUND_TRACKER_STEPS } from "../combat-history/view-models/buildCombatTrackerModel";

describe("combat round timeline navigation", () => {
  it("owns arrow keys on the tracker grid and its cell buttons, but not form controls", () => {
    expect(getCombatRoundTimelineArrowMove({ key: "ArrowRight", targetTagName: "DIV" })).toEqual({
      stepOffset: 1,
    });
    expect(getCombatRoundTimelineArrowMove({ key: "ArrowDown", targetTagName: "BUTTON" })).toEqual({
      participantOffset: 1,
    });
    expect(
      getCombatRoundTimelineArrowMove({ key: "ArrowLeft", targetTagName: "INPUT" }),
    ).toBeUndefined();
    expect(getCombatRoundTimelineArrowMove({ key: "PageDown" })).toBeUndefined();
  });
  it("moves next step across a round boundary", () => {
    expect(
      getAdjacentCombatRoundTimelineStepSelection({
        participantId: "gladiator",
        roundNumbers: [1, 2],
        selectedRoundNumber: 1,
        step: "round_summary",
        stepOffset: 1,
      }),
    ).toEqual({
      participantId: "gladiator",
      roundNumber: 2,
      // A round opens in the Combat Experience pre-declaration step (#215 ruling 2).
      step: "pre_declaration",
    });
  });

  it("moves next step from the pre-declaration step into declaration", () => {
    expect(
      getAdjacentCombatRoundTimelineStepSelection({
        participantId: "gladiator",
        roundNumbers: [1, 2],
        selectedRoundNumber: 2,
        step: "pre_declaration",
        stepOffset: 1,
      }),
    ).toEqual({
      participantId: "gladiator",
      roundNumber: 2,
      step: "select_actions",
    });
  });

  it("moves previous step across a round boundary", () => {
    expect(
      getAdjacentCombatRoundTimelineStepSelection({
        participantId: "gladiator",
        roundNumbers: [1, 2],
        selectedRoundNumber: 2,
        step: "pre_declaration",
        stepOffset: -1,
      }),
    ).toEqual({
      participantId: "gladiator",
      roundNumber: 1,
      step: "round_summary",
    });
  });

  it("moves previous step from declaration into the pre-declaration step", () => {
    expect(
      getAdjacentCombatRoundTimelineStepSelection({
        participantId: "gladiator",
        roundNumbers: [1, 2],
        selectedRoundNumber: 2,
        step: "select_actions",
        stepOffset: -1,
      }),
    ).toEqual({
      participantId: "gladiator",
      roundNumber: 2,
      step: "pre_declaration",
    });
  });

  /*
   * #771. The four cases above pin the ruled traversal (#215 ruling 2) and are unchanged. These
   * pin what the inspector is allowed to *land* on, which is a different question: R2-2 removed
   * `PD` from the rendered column set while leaving the step in the enum, so the ruled order now
   * contains a step the tracker draws no cell for.
   *
   * `visibleSteps` is given as an explicit list here rather than taken from the product constant,
   * so these assert the helper's contract and not today's column set; the last case below binds
   * the two together.
   */
  const VISIBLE_WITHOUT_PRE_DECLARATION = [
    "select_actions",
    "review_action_modifiers",
    "initiative_phase_1",
    "phase_1_actions",
    "review_phase_2_actions",
    "phase_1_damage",
    "review_phase_2_modifiers",
    "initiative_phase_2",
    "phase_2_actions",
    "review_phase_2_damage",
    "phase_2_damage",
    "round_summary",
  ] as const;

  it("skips a step with no tracker column when stepping back out of declaration", () => {
    expect(
      getAdjacentVisibleCombatRoundTimelineStepSelection({
        participantId: "gladiator",
        roundNumbers: [1, 2],
        selectedRoundNumber: 2,
        step: "select_actions",
        stepOffset: -1,
        visibleSteps: VISIBLE_WITHOUT_PRE_DECLARATION,
      }),
    ).toEqual({
      participantId: "gladiator",
      // Not round 2 `pre_declaration`, which the ruled order visits and the grid does not render:
      // the previous *visible* cell is the previous round's summary.
      roundNumber: 1,
      step: "round_summary",
    });
  });

  it("skips the hidden step when stepping forward across a round boundary", () => {
    expect(
      getAdjacentVisibleCombatRoundTimelineStepSelection({
        participantId: "gladiator",
        roundNumbers: [1, 2],
        selectedRoundNumber: 1,
        step: "round_summary",
        stepOffset: 1,
        visibleSteps: VISIBLE_WITHOUT_PRE_DECLARATION,
      }),
    ).toEqual({
      participantId: "gladiator",
      roundNumber: 2,
      step: "select_actions",
    });
  });

  it("keeps the current selection when no visible step remains in that direction", () => {
    // The first round's first visible step: backwards there is only the hidden step, so the
    // control is a defined no-op rather than a column-less landing or an empty inspector.
    expect(
      getAdjacentVisibleCombatRoundTimelineStepSelection({
        participantId: "gladiator",
        roundNumbers: [1],
        selectedRoundNumber: 1,
        step: "select_actions",
        stepOffset: -1,
        visibleSteps: VISIBLE_WITHOUT_PRE_DECLARATION,
      }),
    ).toEqual({
      participantId: "gladiator",
      roundNumber: 1,
      step: "select_actions",
    });
    // And the same at the far end, where the underlying clamp already stopped.
    expect(
      getAdjacentVisibleCombatRoundTimelineStepSelection({
        participantId: "gladiator",
        roundNumbers: [1],
        selectedRoundNumber: 1,
        step: "round_summary",
        stepOffset: 1,
        visibleSteps: VISIBLE_WITHOUT_PRE_DECLARATION,
      }),
    ).toEqual({
      participantId: "gladiator",
      roundNumber: 1,
      step: "round_summary",
    });
  });

  it("moves off a hidden step the cursor is already parked on", () => {
    // Nothing should put the cursor there any more, but if anything does, the controls must be
    // able to leave rather than being stuck on a cell with no column.
    expect(
      getAdjacentVisibleCombatRoundTimelineStepSelection({
        participantId: "gladiator",
        roundNumbers: [1, 2],
        selectedRoundNumber: 2,
        step: "pre_declaration",
        stepOffset: 1,
        visibleSteps: VISIBLE_WITHOUT_PRE_DECLARATION,
      }),
    ).toEqual({
      participantId: "gladiator",
      roundNumber: 2,
      step: "select_actions",
    });
  });

  it("never lands outside the column set both trackers actually render", () => {
    // Binds the helper to the real product constant, over every step and both directions, so a
    // future change to the visible set cannot reintroduce a column-less landing unnoticed.
    for (const step of COMBAT_ROUND_STEPS) {
      for (const stepOffset of [-1, 1]) {
        const landing = getAdjacentVisibleCombatRoundTimelineStepSelection({
          participantId: "gladiator",
          roundNumbers: [1, 2, 3],
          selectedRoundNumber: 2,
          step,
          stepOffset,
          visibleSteps: VISIBLE_COMBAT_ROUND_TRACKER_STEPS,
        });
        if (landing.step === step && landing.roundNumber === 2) {
          // A defined no-op at the ends of the range; `pre_declaration` is never a resting place.
          expect(VISIBLE_COMBAT_ROUND_TRACKER_STEPS, `${step} ${stepOffset} no-op`).not.toContain(
            step,
          );
          continue;
        }
        expect(
          VISIBLE_COMBAT_ROUND_TRACKER_STEPS,
          `${step} ${stepOffset} landed on ${landing.step}`,
        ).toContain(landing.step);
      }
    }
  });

  it("keeps participant navigation inside the selected round and step", () => {
    expect(
      getAdjacentCombatRoundTimelineParticipantSelection({
        participantId: "middle",
        participantIds: ["top", "middle", "bottom"],
        participantOffset: 1,
        roundNumber: 2,
        step: "phase_2_actions",
      }),
    ).toEqual({
      participantId: "bottom",
      roundNumber: 2,
      step: "phase_2_actions",
    });
  });

  it("uses stable keys for selected and current timeline cells", () => {
    expect(
      getCombatRoundTimelineCellKey({
        participantId: "gladiator",
        roundNumber: 2,
        step: "phase_1_actions",
      }),
    ).toBe("2:gladiator:phase_1_actions");
  });

  it("reads participant order from the selected visible round", () => {
    expect(
      getParticipantIdsForTimelineRound({
        fallbackParticipantIds: ["fallback"],
        roundNumber: 1,
        timelineRoundStates: [
          {
            archivedRounds: [],
            commands: [],
            currentStep: "select_actions",
            participants: [
              {
                declaration: undefined,
                initiatives: {},
                label: "Middle",
                participantId: "middle",
                stepStatuses: {},
              },
              {
                declaration: undefined,
                initiatives: {},
                label: "Top",
                participantId: "top",
                stepStatuses: {},
              },
            ],
            roundNumber: 1,
            selectedStep: "select_actions",
            stepSnapshots: [],
          } as unknown as Parameters<
            typeof getParticipantIdsForTimelineRound
          >[0]["timelineRoundStates"][number],
        ],
      }),
    ).toEqual(["middle", "top"]);
  });
});
