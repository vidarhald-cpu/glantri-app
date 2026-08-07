import { describe, expect, it } from "vitest";

import type { CombatStepAutomationRunResult } from "@glantri/domain";

import { buildCombatStepWorkflowStatusPresentation } from "./combatStepWorkflowStatus";

function result(patch: Partial<CombatStepAutomationRunResult> = {}): CombatStepAutomationRunResult {
  return {
    acceptedTasks: [],
    alreadyAccepted: false,
    attemptedTasks: [],
    finalRevision: "revision-2",
    identity: {
      encounterId: "encounter-1",
      gmActorUserId: "gm-1",
      operationFamily: "roll_remaining",
      runId: "run-1",
      schemaVersion: 1,
      startExecutionGroupId: "group-1",
      startingRevision: "revision-1",
      startingRound: 1,
      startingSequence: 2,
      startingStep: "initiative_phase_1",
      startTaskId: "task-1",
    },
    processedCount: 3,
    stepComplete: false,
    stopParticipantId: "player-1",
    stopReason: "player_action_required",
    ...patch,
  };
}

describe("GM combat Workflow Status presentation", () => {
  it("reports a player-owned initiative stop without technical identifiers", () => {
    expect(
      buildCombatStepWorkflowStatusPresentation({
        participantLabelsById: new Map([["player-1", "The Gladiator"]]),
        result: result(),
      }),
    ).toEqual({
      completion: undefined,
      operationLabel: "Roll remaining GM Phase 1 initiative",
      processedSummary: "Rolled 3 NPC initiatives.",
      stopMessage: "Player action required.",
      stopParticipantLabel: "The Gladiator",
    });
  });

  it("reports completed M1 as one transient workflow story", () => {
    const presentation = buildCombatStepWorkflowStatusPresentation({
      participantLabelsById: new Map(),
      result: result({
        identity: {
          ...result().identity,
          operationFamily: "accept_remaining",
          startingStep: "review_action_modifiers",
        },
        processedCount: 10,
        stepComplete: true,
        stopParticipantId: undefined,
        stopReason: "end_of_step",
      }),
    });

    expect(presentation.processedSummary).toBe("Accepted 10 NPC reviews.");
    expect(presentation.completion).toBe("Completed M1.");
    expect(presentation.stopMessage).toBeUndefined();
  });
});
