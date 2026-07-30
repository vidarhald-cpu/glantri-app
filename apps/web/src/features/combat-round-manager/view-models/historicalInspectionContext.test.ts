import {
  combatRoundStateSchema,
  combatStepEventSchema,
  type CombatRoundStep,
} from "@glantri/domain";
import { describe, expect, it } from "vitest";

import { buildHistoricalInspectionContext } from "./historicalInspectionContext";

function observationEvent(input: {
  progress: number;
  sequence: number;
  status?: "progress" | "no_progress" | "period_complete";
}) {
  return combatStepEventSchema.parse({
    actorParticipantId: "observer",
    completeness: "complete",
    encounterId: "encounter-1",
    facts: {
      involvedOutcome: {
        bestBonusAfter: 0,
        completedAttempts: 0,
        observationStatus: input.status ?? "progress",
        relationshipId: "observation:observer:target",
        requiredQualifyingRounds: 3,
        roundsTowardNextAttempt: input.progress,
        targetParticipantId: "target",
      },
    },
    id: `event-${input.sequence}`,
    occurredAt: "2026-07-30T10:00:00.000Z",
    ownerParticipantId: "observer",
    roundNumber: 1,
    schemaVersion: 1,
    sequence: input.sequence,
    source: { kind: "canonical", sourceIds: [] },
    status: "recorded",
    step: "round_summary",
    targetParticipantId: "target",
    type: "observation",
    visibility: {
      identityRefs: [],
      involvedParticipantIds: ["observer"],
      outcomeScope: "gm_only",
    },
  });
}

function roundState(events: ReturnType<typeof observationEvent>[]) {
  return combatRoundStateSchema.parse({
    currentStep: "round_summary",
    events,
    participants: [
      { label: "Observer", participantId: "observer" },
      { label: "Target", participantId: "target" },
    ],
    roundNumber: 1,
  });
}

describe("historical inspection context", () => {
  it("does not project SU observation progress into earlier historical steps", () => {
    const state = roundState([observationEvent({ progress: 1, sequence: 4 })]);

    const declaration = buildHistoricalInspectionContext({
      participantId: "observer",
      roundState: state,
      step: "select_actions",
    });
    const summary = buildHistoricalInspectionContext({
      participantId: "observer",
      roundState: state,
      step: "round_summary",
    });

    expect(declaration.observationRelationships).toEqual([]);
    expect(declaration.selectedCanonicalSequenceCutoff).toBeUndefined();
    expect(summary.observationRelationships).toMatchObject([
      {
        observerParticipantId: "observer",
        roundsTowardNextAttempt: 1,
        targetParticipantId: "target",
      },
    ]);
    expect(summary.selectedCanonicalSequenceCutoff).toBe(4);
  });

  it("carries the previous archived relationship until a current-round event changes it", () => {
    const previous = combatRoundStateSchema.parse({
      currentStep: "round_summary",
      observationRelationships: [
        {
          bestBonus: 1,
          completedAttempts: 1,
          id: "observation:observer:target",
          observerParticipantId: "observer",
          roundsTowardNextAttempt: 0,
          targetParticipantId: "target",
        },
      ],
      participants: [
        { label: "Observer", participantId: "observer" },
        { label: "Target", participantId: "target" },
      ],
      roundNumber: 1,
    });
    const current = combatRoundStateSchema.parse({
      currentStep: "round_summary",
      events: [
        {
          ...observationEvent({ progress: 1, sequence: 2 }),
          facts: {
            involvedOutcome: {
              bestBonusAfter: 1,
              completedAttempts: 1,
              observationStatus: "progress",
              relationshipId: "observation:observer:target",
              requiredQualifyingRounds: 6,
              roundsTowardNextAttempt: 1,
              targetParticipantId: "target",
            },
            gmReview: {},
            publicOutcome: {},
            rollerPrivate: {},
          },
          roundNumber: 2,
        },
      ],
      participants: previous.participants,
      roundNumber: 2,
    });
    const resolve = (step: CombatRoundStep) =>
      buildHistoricalInspectionContext({
        participantId: "observer",
        previousRoundState: previous,
        roundState: current,
        step,
      });

    expect(resolve("phase_1_actions").observationRelationships[0]).toMatchObject({
      bestBonus: 1,
      roundsTowardNextAttempt: 0,
    });
    expect(resolve("round_summary").observationRelationships[0]).toMatchObject({
      bestBonus: 1,
      roundsTowardNextAttempt: 1,
    });
  });
});
