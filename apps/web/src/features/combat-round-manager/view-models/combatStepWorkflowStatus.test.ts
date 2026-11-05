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
    skippedTasks: [],
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
      skippedReports: [],
      skippedSummary: undefined,
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

  it("reports completed declaration carry-forward without creating a combat result", () => {
    const presentation = buildCombatStepWorkflowStatusPresentation({
      participantLabelsById: new Map(),
      result: result({
        identity: {
          ...result().identity,
          operationFamily: "accept_remaining",
          startingStep: "select_actions",
        },
        processedCount: 7,
        stepComplete: true,
        stopParticipantId: undefined,
        stopReason: "end_of_step",
      }),
    });

    expect(presentation).toMatchObject({
      completion: "Completed DE.",
      operationLabel: "Accept remaining NPC declarations",
      processedSummary: "Accepted 7 NPC declarations.",
    });
  });

  it("reports completed Combat Experience as a single GM workflow story", () => {
    const presentation = buildCombatStepWorkflowStatusPresentation({
      participantLabelsById: new Map(),
      result: result({
        identity: {
          ...result().identity,
          startProcessId: "round:1:boundary:declaration:process:combat_experience",
          startingStep: "select_actions",
        },
        processedCount: 10,
        stepComplete: true,
        stopParticipantId: undefined,
        stopReason: "end_of_step",
      }),
    });

    expect(presentation).toMatchObject({
      completion: "Completed Combat Experience.",
      operationLabel: "Roll remaining GM Combat Experience",
      processedSummary: "Rolled 10 NPC Combat Experience checks.",
      stopMessage: undefined,
    });
  });

  it("uses CE-specific wording for player and review stops", () => {
    const combatExperienceResult = result({
      identity: {
        ...result().identity,
        startProcessId: "round:1:boundary:declaration:process:combat_experience",
        startingStep: "select_actions",
      },
    });
    expect(
      buildCombatStepWorkflowStatusPresentation({
        participantLabelsById: new Map([["player-1", "The Gladiator"]]),
        result: combatExperienceResult,
      }).stopMessage,
    ).toBe("Player roll required.");
    expect(
      buildCombatStepWorkflowStatusPresentation({
        participantLabelsById: new Map([["npc-1", "Orc Captain"]]),
        result: {
          ...combatExperienceResult,
          stopParticipantId: "npc-1",
          stopReason: "combat_experience_review_required",
        },
      }).stopMessage,
    ).toBe("Combat Experience requires GM review.");
  });

  it("reports Health/Bleed completion and effect-review stops without technical details", () => {
    const healthResult = result({
      identity: {
        ...result().identity,
        startProcessFamily: "health_bleed",
        startingStep: "round_summary",
      },
      processedCount: 5,
      stepComplete: true,
      stopParticipantId: undefined,
      stopReason: "end_of_step",
    });
    expect(
      buildCombatStepWorkflowStatusPresentation({
        participantLabelsById: new Map(),
        result: healthResult,
      }),
    ).toMatchObject({
      completion: "Completed Health/Bleed work.",
      operationLabel: "Roll remaining GM Health checks",
      processedSummary: "Rolled 5 NPC Health checks.",
    });
    expect(
      buildCombatStepWorkflowStatusPresentation({
        participantLabelsById: new Map([["npc-1", "Orc Captain"]]),
        result: {
          ...healthResult,
          processedCount: 2,
          stepComplete: false,
          stopParticipantId: "npc-1",
          stopReason: "effect_review_required",
        },
      }),
    ).toMatchObject({
      completion: undefined,
      stopMessage: "Effect review required.",
      stopParticipantLabel: "Orc Captain",
    });
  });

  it("reports Observe completion and relationship-review stops without hidden details", () => {
    const observationResult = result({
      identity: {
        ...result().identity,
        startProcessFamily: "observation",
        startingStep: "round_summary",
      },
      processedCount: 4,
      stepComplete: true,
      stopParticipantId: undefined,
      stopReason: "end_of_step",
    });
    expect(
      buildCombatStepWorkflowStatusPresentation({
        participantLabelsById: new Map(),
        result: observationResult,
      }),
    ).toMatchObject({
      completion: "Completed Observe work.",
      operationLabel: "Roll remaining GM Observe checks",
      processedSummary: "Rolled 4 NPC Observe checks.",
    });
    expect(
      buildCombatStepWorkflowStatusPresentation({
        participantLabelsById: new Map([["npc-1", "Orc Captain"]]),
        result: {
          ...observationResult,
          processedCount: 3,
          stepComplete: false,
          stopParticipantId: "npc-1",
          stopReason: "observation_review_required",
        },
      }),
    ).toMatchObject({
      completion: undefined,
      stopMessage: "Observe relationship requires review.",
      stopParticipantLabel: "Orc Captain",
    });
  });

  it("reports Continued Contact counts, player boundaries, and distance fences", () => {
    const maintenanceResult = result({
      identity: {
        ...result().identity,
        startProcessFamily: "continued_contact",
        startingStep: "round_summary",
      },
      processedCount: 4,
      stepComplete: true,
      stopParticipantId: undefined,
      stopReason: "end_of_step",
    });
    expect(
      buildCombatStepWorkflowStatusPresentation({
        participantLabelsById: new Map(),
        result: maintenanceResult,
      }),
    ).toMatchObject({
      completion: "Completed Continued Contact maintenance.",
      operationLabel: "Roll remaining GM Continued Contact checks",
      processedSummary: "Rolled 4 Continued Contact checks.",
    });
    expect(
      buildCombatStepWorkflowStatusPresentation({
        participantLabelsById: new Map([["player-1", "The Gladiator"]]),
        result: {
          ...maintenanceResult,
          processedCount: 1,
          stepComplete: false,
          stopParticipantId: "player-1",
          stopReason: "player_action_required",
        },
      }),
    ).toMatchObject({
      stopMessage: "Player roll required.",
      stopParticipantLabel: "The Gladiator",
    });
    expect(
      buildCombatStepWorkflowStatusPresentation({
        participantLabelsById: new Map(),
        result: { ...maintenanceResult, stopReason: "distance_decision_required" },
      }).stopMessage,
    ).toBe("Distance decision required.");
  });

  it("reports distance-roll completion and preserves the manual GM review boundary", () => {
    const distanceResult = result({
      identity: {
        ...result().identity,
        startProcessFamily: "ordinary_distance_roll",
        startingStep: "round_summary",
      },
      processedCount: 6,
      stepComplete: true,
      stopParticipantId: undefined,
      stopReason: "distance_review_required",
    });
    expect(
      buildCombatStepWorkflowStatusPresentation({
        participantLabelsById: new Map(),
        result: distanceResult,
      }),
    ).toMatchObject({
      completion: "Completed distance rolls.",
      operationLabel: "Roll remaining GM distance-control checks",
      processedSummary: "Rolled 6 NPC distance checks.",
      stopMessage: "GM distance review required.",
    });
    expect(
      buildCombatStepWorkflowStatusPresentation({
        participantLabelsById: new Map([["player-1", "The Gladiator"]]),
        result: {
          ...distanceResult,
          processedCount: 1,
          stepComplete: false,
          stopParticipantId: "player-1",
          stopReason: "player_action_required",
        },
      }),
    ).toMatchObject({
      completion: undefined,
      processedSummary: "Rolled 1 NPC distance check.",
      stopMessage: "Player roll required.",
      stopParticipantLabel: "The Gladiator",
    });
  });

  it("gives a concise changed-target stop message", () => {
    const presentation = buildCombatStepWorkflowStatusPresentation({
      participantLabelsById: new Map([["npc-8", "Orc Captain"]]),
      result: result({
        identity: {
          ...result().identity,
          operationFamily: "accept_remaining",
          startingStep: "select_actions",
        },
        processedCount: 4,
        stopParticipantId: "npc-8",
        stopReason: "target_invalid",
      }),
    });

    expect(presentation.stopParticipantLabel).toBe("Orc Captain");
    expect(presentation.stopMessage).toBe(
      "Previous target is no longer valid. GM declaration required.",
    );
  });

  /**
   * #948. A skip the GM cannot see does not satisfy the ruling, so the Workflow Status line the GM
   * already reads carries the skipped participant and the reason.
   */
  describe("#948 skipped Observe participants", () => {
    function observationResult(
      skippedTasks: CombatStepAutomationRunResult["skippedTasks"],
    ): CombatStepAutomationRunResult {
      return result({
        identity: { ...result().identity, startProcessFamily: "observation" },
        processedCount: 4,
        skippedTasks,
        stepComplete: false,
        stopParticipantId: undefined,
        stopReason: "end_of_step",
      });
    }

    function skipped(input: {
      missingData?: string[];
      participantId: string;
      reason: CombatStepAutomationRunResult["skippedTasks"][number]["reason"];
    }): CombatStepAutomationRunResult["skippedTasks"][number] {
      return {
        missingData: input.missingData ?? [],
        participantId: input.participantId,
        reason: input.reason,
        task: {
          executionGroupId: `group:${input.participantId}`,
          kind: "observation_roll",
          participantId: input.participantId,
          taskId: `task:${input.participantId}`,
        },
      };
    }

    it("names the participant, the reason, and the missing datum", () => {
      const presentation = buildCombatStepWorkflowStatusPresentation({
        participantLabelsById: new Map([["npc-3", "Scyrian cavalry guy"]]),
        result: observationResult([
          skipped({
            missingData: ["intelligence_characteristic"],
            participantId: "npc-3",
            reason: "observation_basis_data_missing",
          }),
        ]),
      });

      expect(presentation.skippedSummary).toBe(
        "Skipped 1 NPC Observe check, left unresolved for manual resolution.",
      );
      expect(presentation.skippedReports).toEqual([
        "Skipped Scyrian cavalry guy: required Observation data is missing for this participant (Intelligence).",
      ]);
      // The run is not reported as a completed step while a task is still unresolved.
      expect(presentation.completion).toBeUndefined();
    });

    it("reports each skipped participant and distinguishes the reasons", () => {
      const presentation = buildCombatStepWorkflowStatusPresentation({
        participantLabelsById: new Map([
          ["npc-2", "Orc Captain"],
          ["npc-5", "Bandit"],
        ]),
        result: observationResult([
          skipped({
            participantId: "npc-2",
            reason: "observation_observed_basis_data_missing",
          }),
          skipped({ participantId: "npc-5", reason: "observation_target_invalid" }),
        ]),
      });

      expect(presentation.skippedSummary).toBe(
        "Skipped 2 NPC Observe checks, left unresolved for manual resolution.",
      );
      expect(presentation.skippedReports).toEqual([
        "Skipped Orc Captain: required Observation data is missing for the observed participant.",
        "Skipped Bandit: the observed participant is no longer active.",
      ]);
    });

    it("negative control — a run with no skips reports none", () => {
      const presentation = buildCombatStepWorkflowStatusPresentation({
        participantLabelsById: new Map(),
        result: observationResult([]),
      });

      expect(presentation.skippedSummary).toBeUndefined();
      expect(presentation.skippedReports).toEqual([]);
    });
  });
});
