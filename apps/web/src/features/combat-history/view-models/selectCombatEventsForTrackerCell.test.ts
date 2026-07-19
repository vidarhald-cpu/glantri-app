import { describe, expect, it } from "vitest";

import { combatStepEventSchema, type CombatStepEvent } from "@glantri/domain";

import { selectCombatEventsForTrackerCell } from "./selectCombatEventsForTrackerCell";

function event(input: {
  attackResultId?: string;
  id: string;
  ownerParticipantId: string;
  sequence: number;
  step: CombatStepEvent["step"];
  type: CombatStepEvent["type"];
}): CombatStepEvent {
  return combatStepEventSchema.parse({
    ...input,
    completeness: "complete",
    encounterId: "encounter-1",
    facts: {},
    missingFacts: [],
    occurredAt: null,
    roundNumber: 1,
    schemaVersion: 1,
    source: { kind: "canonical", sourceIds: [] },
    status: "recorded",
    visibility: { involvedParticipantIds: [], outcomeScope: "involved" },
  });
}

describe("selectCombatEventsForTrackerCell", () => {
  const events = [
    event({
      attackResultId: "attack-1",
      id: "attack",
      ownerParticipantId: "attacker",
      sequence: 1,
      step: "phase_1_actions",
      type: "attack",
    }),
    event({
      attackResultId: "attack-1",
      id: "parry",
      ownerParticipantId: "defender",
      sequence: 2,
      step: "review_phase_2_actions",
      type: "parry",
    }),
    event({
      id: "unrelated",
      ownerParticipantId: "other",
      sequence: 3,
      step: "initiative_phase_1",
      type: "initiative",
    }),
  ];

  it("includes the related attack and parry chain for either owned cell", () => {
    expect(
      selectCombatEventsForTrackerCell({
        events,
        participantId: "attacker",
        retainLatestWhenEmpty: false,
        step: "phase_1_actions",
      }).map((entry) => entry.id),
    ).toEqual(["attack", "parry"]);
  });

  it("keeps historical selection isolated when the selected cell has no events", () => {
    expect(
      selectCombatEventsForTrackerCell({
        events,
        participantId: "defender",
        retainLatestWhenEmpty: false,
        step: "phase_1_damage",
      }),
    ).toEqual([]);
  });

  it("retains the latest result only for an empty live current cell", () => {
    expect(
      selectCombatEventsForTrackerCell({
        events,
        participantId: "attacker",
        retainLatestWhenEmpty: true,
        step: "phase_1_damage",
      }).map((entry) => entry.id),
    ).toEqual(["attack", "parry"]);
  });

  it("includes all chronological distance-control events for the selected SU cell", () => {
    const distanceEvents = [
      event({
        id: "roll-a",
        ownerParticipantId: "attacker",
        sequence: 4,
        step: "round_summary",
        type: "distance_control_roll",
      }),
      event({
        id: "roll-b",
        ownerParticipantId: "defender",
        sequence: 5,
        step: "round_summary",
        type: "distance_control_roll",
      }),
      event({
        id: "distance-result",
        ownerParticipantId: "defender",
        sequence: 6,
        step: "round_summary",
        type: "distance_control_result",
      }),
      event({
        id: "distance-applied",
        ownerParticipantId: "attacker",
        sequence: 7,
        step: "round_summary",
        type: "distance_control_applied",
      }),
    ].map((entry) => ({ ...entry, distanceProposalId: "distance-1" }));

    expect(
      selectCombatEventsForTrackerCell({
        events: distanceEvents,
        participantId: "attacker",
        retainLatestWhenEmpty: false,
        step: "round_summary",
      }).map((entry) => entry.id),
    ).toEqual(["roll-a", "roll-b", "distance-result", "distance-applied"]);
  });
});
