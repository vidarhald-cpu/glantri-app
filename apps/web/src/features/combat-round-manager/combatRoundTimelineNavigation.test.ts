import { describe, expect, it } from "vitest";

import {
  getAdjacentCombatRoundTimelineParticipantSelection,
  getAdjacentCombatRoundTimelineStepSelection,
  getCombatRoundTimelineCellKey,
  getParticipantIdsForTimelineRound,
} from "./combatRoundTimelineNavigation";

describe("combat round timeline navigation", () => {
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
      step: "select_actions",
    });
  });

  it("moves previous step across a round boundary", () => {
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
      roundNumber: 1,
      step: "round_summary",
    });
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
