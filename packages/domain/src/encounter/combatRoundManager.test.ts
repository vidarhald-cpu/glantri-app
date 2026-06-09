import { describe, expect, it } from "vitest";

import type { EncounterParticipant, EncounterSession } from "./session";

import {
  COMBAT_ROUND_STEP_ABBREVIATIONS,
  COMBAT_ROUND_STEPS,
  advanceCombatRoundPhaseResolutionSubstepForParticipant,
  advanceCombatRoundStep,
  buildCombatRoundDamageResult,
  buildCombatRoundPhaseResolutionResult,
  buildCombatRoundAttackRollResult,
  buildCombatRoundInspector,
  buildCombatRoundInitiativeResult,
  canPlayerSubmitCombatDeclaration,
  canPlayerRollCombatInitiative,
  clearCombatRoundStep,
  clearCurrentCombatRoundStepAndRewind,
  combatRoundStateSchema,
  combatRoundParticipantHasPhaseAttack,
  commitCombatRoundPhaseDamage,
  completeCombatRoundPhaseResolutionForParticipant,
  combatRoundAttackRollResultSchema,
  getCombatRoundPhaseResolutionOrder,
  getCombatRoundPhaseResolutionStatus,
  getCombatRoundInitiativePhaseForStep,
  getCombatRoundModifierPhaseForStep,
  getCombatRoundInitiativePositions,
  getCombatRoundInitiativeRanks,
  getCombatRoundAttackResultsForParticipantPhase,
  getCombatRoundDisplayIncomingAttackResultForParticipantPhase,
  getCombatRoundDisplayPhaseResolutionResultForParticipantPhase,
  getCombatRoundOutgoingAttackResultForParticipantPhase,
  getCombatRoundParticipantPhaseStepStatus,
  getCombatRoundResolutionPhaseForStep,
  getCombatRoundStepSnapshot,
  getPreviousCombatRoundStep,
  initializeCombatRoundState,
  ensureCombatRoundPhaseResolutionResultsForPhase,
  initializeCombatRoundPhaseResolutionCursor,
  recordCombatRoundDeclaration,
  recordCombatRoundAttackResult,
  recordCombatRoundDamageReviewPlaceholder,
  recordCombatRoundDamageResult,
  recordCombatRoundInitiative,
  recordCombatRoundNoAttackPhaseReview,
  recordCombatRoundParryResult,
  recordCombatRoundParryResolution,
  recordCombatRoundParticipantStepReview,
  removeCombatRoundCommittedDamageEffects,
  rollOpenEndedD6,
  setCombatRoundActiveParticipant,
  setCombatRoundParticipantInitiative,
  setCombatRoundParticipantStepStatus,
  sortCombatRoundParticipantsByInitiative,
} from "./combatRoundManager";
import { encounterSessionSchema } from "./session";
import type { CombatRoundStepSnapshot } from "./combatRoundManager";
import type { CombatEffectsState } from "./combatEffects";

function participant(input: {
  id: string;
  initiative?: number;
  label: string;
}): EncounterParticipant {
  return {
    declaration: {
      actionType: "none",
      defenseFocus: "none",
      defensePosture: "none",
      targetLocation: "any",
    },
    facing: "north",
    id: input.id,
    initiative: input.initiative ?? 0,
    label: input.label,
    order: 0,
    orientation: "neutral",
    participantType: "scenario",
    position: { x: 0, y: 0, zone: "center" },
    scenarioParticipantId: `scenario-${input.id}`,
  };
}

function encounter(input: Partial<EncounterSession> = {}): EncounterSession {
  return encounterSessionSchema.parse({
    actionLog: [],
    createdAt: "2026-01-01T00:00:00.000Z",
    currentRound: 3,
    currentTurnIndex: 0,
    declarationsLocked: false,
    id: "encounter-1",
    kind: "combat",
    participants: [
      participant({ id: "gladiator", label: "The Gladiator" }),
      participant({ id: "guard", label: "City guard" }),
    ],
    scenarioId: "scenario-1",
    status: "active",
    title: "A doubtful success",
    turnOrderMode: "manual",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...input,
  });
}

function stepSnapshot(
  input: Partial<CombatRoundStepSnapshot> & Pick<CombatRoundStepSnapshot, "participantId" | "step">,
): CombatRoundStepSnapshot {
  return {
    ...input,
    committedAt: "2026-01-01T00:02:00.000Z",
    id: `snapshot-${input.participantId}-${input.step}`,
    participantId: input.participantId,
    participantLabel: input.participantId,
    roundNumber: 3,
  };
}

function advanceToStep(
  state: ReturnType<typeof initializeCombatRoundState>,
  step: (typeof COMBAT_ROUND_STEPS)[number],
): ReturnType<typeof initializeCombatRoundState> {
  let current = state;

  while (current.currentStep !== step) {
    current = advanceCombatRoundStep(current);
  }

  return current;
}

function declareRoundAction(input: {
  actionId: string;
  participantId: string;
  state: ReturnType<typeof initializeCombatRoundState>;
}): ReturnType<typeof initializeCombatRoundState> {
  return recordCombatRoundDeclaration({
    declaration: {
      actionId: input.actionId,
      roundNumber: 3,
    },
    participantId: input.participantId,
    state: input.state,
    submittedBy: "gm",
  });
}

describe("combat round manager", () => {
  it("defines the compact round timeline steps in order", () => {
    expect(COMBAT_ROUND_STEPS.map((step) => COMBAT_ROUND_STEP_ABBREVIATIONS[step])).toEqual([
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
    ]);
  });

  it("initializes round state from encounter participants", () => {
    const state = initializeCombatRoundState({ encounter: encounter() });

    expect(state.roundNumber).toBe(3);
    expect(state.currentStep).toBe("select_actions");
    expect(state.commands).toEqual([]);
    expect(state.currentCursor).toEqual({
      participantId: "gladiator",
      roundNumber: 3,
      step: "DE",
    });
    expect(state.phaseResolutionCursor).toBeUndefined();
    expect(state.phaseResolutionResults).toEqual([]);
    expect(state.phaseResolutionStatuses).toEqual({});
    expect(state.stepSnapshots).toEqual([]);
    expect(state.selectedParticipantId).toBe("gladiator");
    expect(state.participants.map((entry) => entry.participantId)).toEqual(["gladiator", "guard"]);
    expect(state.participants[0]?.stepStatuses.select_actions).toBe("pending");
    expect(state.participants[0]?.stepStatuses.round_summary).toBe("pending");
    expect(state.participants[0]?.attackResults).toEqual({});
    expect(
      getCombatRoundParticipantPhaseStepStatus({
        participantId: "guard",
        state,
        step: "review_phase_2_actions",
      }),
    ).toBe("pending");
    expect(
      getCombatRoundParticipantPhaseStepStatus({
        participantId: "guard",
        state,
        step: "phase_1_damage",
      }),
    ).toBe("pending");
  });

  it("parses legacy round state without commands or current cursor", () => {
    const state = initializeCombatRoundState({ encounter: encounter() });
    const { commands, currentCursor, ...legacyState } = state;
    const parsed = combatRoundStateSchema.parse(legacyState);

    expect(commands).toEqual([]);
    expect(currentCursor).toMatchObject({ step: "DE" });
    expect(parsed.commands).toEqual([]);
    expect(parsed.currentCursor).toBeUndefined();
  });

  it("falls back to the first participant when persisted selection is invalid", () => {
    const existing = initializeCombatRoundState({ encounter: encounter() });
    const state = initializeCombatRoundState({
      encounter: encounter({
        combatRoundState: {
          ...existing,
          selectedParticipantId: "missing",
          selectedStep: "select_actions",
        },
      }),
    });

    expect(state.selectedParticipantId).toBe("gladiator");
    expect(state.selectedStep).toBe("select_actions");
  });

  it("preserves a legacy manual DE participant selection when no current cursor exists", () => {
    const existing = initializeCombatRoundState({ encounter: encounter() });
    const { currentCursor, ...legacyExisting } = existing;
    const state = initializeCombatRoundState({
      encounter: encounter({
        combatRoundState: {
          ...legacyExisting,
          selectedParticipantId: "guard",
          selectedStep: "select_actions",
        },
      }),
    });

    expect(currentCursor).toMatchObject({ step: "DE" });
    expect(state.selectedParticipantId).toBe("guard");
    expect(state.selectedStep).toBe("select_actions");
  });

  it("uses persisted currentCursor over stale selected participant for global steps", () => {
    const existing = initializeCombatRoundState({ encounter: encounter() });
    const state = initializeCombatRoundState({
      encounter: encounter({
        combatRoundState: {
          ...existing,
          currentCursor: {
            participantId: "guard",
            roundNumber: existing.roundNumber,
            step: "DE",
          },
          selectedParticipantId: "gladiator",
          selectedStep: "select_actions",
        },
      }),
    });

    expect(state.selectedParticipantId).toBe("guard");
    expect(state.selectedStep).toBe("select_actions");
  });

  it("resets stale phase selection when reinitializing a DE round", () => {
    const existing = initializeCombatRoundState({ encounter: encounter() });
    const state = initializeCombatRoundState({
      encounter: encounter({
        combatRoundState: {
          ...existing,
          currentStep: "select_actions",
          phaseResolutionCursor: {
            participantId: "guard",
            phase: "phase1",
            substep: "damage",
          },
          selectedParticipantId: "guard",
          selectedStep: "phase_1_damage",
        },
      }),
    });

    expect(state.phaseResolutionCursor).toBeUndefined();
    expect(state.selectedParticipantId).toBe("gladiator");
    expect(state.selectedStep).toBe("select_actions");
  });

  it("advances steps in order and resets after round summary", () => {
    const state = initializeCombatRoundState({ encounter: encounter() });
    const reviewState = advanceCombatRoundStep(state);

    expect(reviewState.currentStep).toBe("review_action_modifiers");
    expect(reviewState.selectedStep).toBe("review_action_modifiers");
    expect(reviewState.participants[0]?.stepStatuses.select_actions).toBe("locked");

    const roundSummaryState = [
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
    ].reduce((current) => advanceCombatRoundStep(current), reviewState);
    const nextRoundState = advanceCombatRoundStep(roundSummaryState);

    expect(roundSummaryState.currentStep).toBe("round_summary");
    expect(nextRoundState.currentStep).toBe("select_actions");
    expect(nextRoundState.roundNumber).toBe(4);
    expect(nextRoundState.selectedParticipantId).toBe("gladiator");
    expect(nextRoundState.participants[0]?.stepStatuses.select_actions).toBe("pending");
  });

  it("starts a new round without stale declaration, initiative, attack, or phase-resolution state", () => {
    const result = buildCombatRoundAttackRollResult({
      actionId: "attack_parry",
      attackerParticipantId: "gladiator",
      defenderDb: 10,
      defenderParticipantId: "guard",
      ob: 10,
      phase: "phase1",
      rollD20: 12,
      rollTotal: 12,
      rolledAt: "2026-01-01T00:03:00.000Z",
      weaponName: "Broad sword",
    });
    const withDeclaration = declareRoundAction({
      actionId: "attack_parry",
      participantId: "gladiator",
      state: initializeCombatRoundState({ encounter: encounter() }),
    });
    const withInitiative = setCombatRoundParticipantInitiative({
      initiative: 14,
      participantId: "gladiator",
      phase: "phase1",
      state: withDeclaration,
    });
    const withAttack = recordCombatRoundAttackResult({
      participantId: "gladiator",
      result,
      state: withInitiative,
      submittedBy: "gm",
    });
    const withResolution = ensureCombatRoundPhaseResolutionResultsForPhase({
      phase: "phase1",
      state: withAttack,
      updatedAt: "2026-01-01T00:04:00.000Z",
    });
    const roundSummaryState: ReturnType<typeof initializeCombatRoundState> = {
      ...withResolution,
      currentStep: "round_summary",
      selectedParticipantId: "guard",
      selectedStep: "phase_1_damage",
    };
    const nextRoundState = advanceCombatRoundStep(roundSummaryState);

    expect(nextRoundState.currentStep).toBe("select_actions");
    expect(nextRoundState.roundNumber).toBe(4);
    expect(nextRoundState.phaseResolutionCursor).toBeUndefined();
    expect(nextRoundState.phaseResolutionResults).toEqual([]);
    expect(nextRoundState.phaseResolutionStatuses).toEqual({});
    expect(nextRoundState.selectedParticipantId).toBe("gladiator");
    expect(nextRoundState.participants[0]?.declaration).toBeUndefined();
    expect(nextRoundState.participants[0]?.initiatives).toEqual({});
    expect(nextRoundState.participants[0]?.attackResults).toEqual({});
  });

  it("commits per-participant snapshots when advancing a step", () => {
    const state = advanceCombatRoundStep(initializeCombatRoundState({ encounter: encounter() }));
    const snapshot = stepSnapshot({
      modifierSummary: {
        dbRaw: -4,
        generalFatigueRaw: -1,
        initiativeRaw: 0,
        obSkillRaw: 0,
        rows: [
          {
            bucketKey: "situation_db",
            entries: [
              {
                durationRounds: 1,
                generated: true,
                id: "generated-db",
                notes: "double attack",
                scope: "until",
                sourcePhase: "phase1",
                sourceRule: "double-attack-phase1-db-parry",
                value: -4,
              },
            ],
            label: "DB/Parry",
            total: -4,
          },
        ],
      },
      participantId: "gladiator",
      phase: "phase1",
      phaseContext: {
        mainHandParryDirection: "left_forward",
        modifierBuckets: {
          general: [],
          situationDb: [],
          situationInitiative: [],
          situationObSkill: [],
        },
      },
      step: "review_action_modifiers",
    });
    const advanced = advanceCombatRoundStep(state, { stepSnapshots: [snapshot] });

    expect(advanced.currentStep).toBe("initiative_phase_1");
    expect(
      getCombatRoundStepSnapshot({
        participantId: "gladiator",
        state: advanced,
        step: "review_action_modifiers",
      }),
    ).toMatchObject({
      modifierSummary: {
        dbRaw: -4,
        rows: [
          expect.objectContaining({
            bucketKey: "situation_db",
            total: -4,
          }),
        ],
      },
      participantId: "gladiator",
      phase: "phase1",
      step: "review_action_modifiers",
    });
  });

  it("keeps committed snapshots stable when later live state changes", () => {
    const state = advanceCombatRoundStep(initializeCombatRoundState({ encounter: encounter() }));
    const advanced = advanceCombatRoundStep(state, {
      stepSnapshots: [
        stepSnapshot({
          modifierSummary: {
            dbRaw: -4,
            generalFatigueRaw: 0,
            initiativeRaw: 0,
            obSkillRaw: 0,
            rows: [],
          },
          participantId: "gladiator",
          phase: "phase1",
          step: "review_action_modifiers",
        }),
      ],
    });
    const liveChanged = recordCombatRoundDeclaration({
      declaration: {
        actionId: "double_attack",
        movementId: "hold",
        roundNumber: 3,
      },
      participantId: "gladiator",
      state: advanced,
      submittedBy: "gm",
    });

    expect(
      getCombatRoundStepSnapshot({
        participantId: "gladiator",
        state: liveChanged,
        step: "review_action_modifiers",
      })?.modifierSummary?.dbRaw,
    ).toBe(-4);
  });

  it("finds the previous combat round step", () => {
    expect(getPreviousCombatRoundStep("select_actions")).toBeUndefined();
    expect(getPreviousCombatRoundStep("review_action_modifiers")).toBe("select_actions");
    expect(getPreviousCombatRoundStep("initiative_phase_1")).toBe("review_action_modifiers");
  });

  it("clears a single combat round step without mutating other step statuses", () => {
    const state = setCombatRoundParticipantStepStatus({
      participantId: "gladiator",
      state: setCombatRoundParticipantStepStatus({
        participantId: "gladiator",
        state: advanceCombatRoundStep(initializeCombatRoundState({ encounter: encounter() })),
        status: "complete",
        step: "review_action_modifiers",
      }),
      status: "submitted",
      step: "select_actions",
    });
    const cleared = clearCombatRoundStep({
      state,
      step: "review_action_modifiers",
    });

    expect(cleared.participants[0]?.stepStatuses.review_action_modifiers).toBe("pending");
    expect(cleared.participants[0]?.stepStatuses.select_actions).toBe("submitted");
    expect(state.participants[0]?.stepStatuses.review_action_modifiers).toBe("complete");
  });

  it("clears snapshots for the cleared step and later steps only", () => {
    const state = advanceCombatRoundStep(initializeCombatRoundState({ encounter: encounter() }));
    const withSnapshots = advanceCombatRoundStep(state, {
      stepSnapshots: [
        stepSnapshot({
          participantId: "gladiator",
          phase: "phase1",
          step: "review_action_modifiers",
        }),
      ],
    });
    const withLaterSnapshot = advanceCombatRoundStep(withSnapshots, {
      stepSnapshots: [
        stepSnapshot({
          participantId: "gladiator",
          phase: "phase1",
          step: "initiative_phase_1",
        }),
      ],
    });
    const clearableState = {
      ...withLaterSnapshot,
      participants: withLaterSnapshot.participants.map((participant) =>
        participant.participantId === "gladiator"
          ? {
              ...participant,
              stepStatuses: {
                ...participant.stepStatuses,
                review_action_modifiers: "complete" as const,
              },
            }
          : participant,
      ),
      selectedParticipantId: "gladiator",
      selectedStep: "review_action_modifiers" as const,
    };
    const cleared = clearCombatRoundStep({
      state: clearableState,
      step: "review_action_modifiers",
    });

    expect(
      getCombatRoundStepSnapshot({
        participantId: "gladiator",
        state: cleared,
        step: "review_action_modifiers",
      }),
    ).toBeUndefined();
    expect(
      getCombatRoundStepSnapshot({
        participantId: "gladiator",
        state: cleared,
        step: "initiative_phase_1",
      }),
    ).toBeUndefined();
  });

  it("clears initiative values when clearing initiative steps", () => {
    const state = setCombatRoundParticipantInitiative({
      initiative: 14,
      participantId: "gladiator",
      phase: "phase1",
      state: initializeCombatRoundState({ encounter: encounter() }),
    });
    const cleared = clearCombatRoundStep({
      state,
      step: "initiative_phase_1",
    });

    expect(state.participants[0]?.initiatives.phase1).toEqual({
      baseInitiative: 0,
      modifierAdjustment: 0,
      rolls: [],
      rollTotal: 14,
      total: 14,
    });
    expect(cleared.participants[0]?.initiatives.phase1).toBeUndefined();
  });

  it("clears i1 for the selected participant and returns to the selected i1 cell", () => {
    const baseState = initializeCombatRoundState({ encounter: encounter() });
    const withInitiatives = setCombatRoundParticipantInitiative({
      initiative: 12,
      participantId: "guard",
      phase: "phase1",
      state: setCombatRoundParticipantInitiative({
        initiative: 14,
        participantId: "gladiator",
        phase: "phase1",
        state: baseState,
      }),
    });
    const result = buildCombatRoundAttackRollResult({
      actionId: "attack_parry",
      attackerParticipantId: "gladiator",
      defenderDb: 10,
      defenderParticipantId: "guard",
      ob: 10,
      phase: "phase1",
      rollD20: 12,
      rollTotal: 12,
      rolledAt: "2026-01-01T00:03:00.000Z",
      weaponName: "Broad sword",
    });
    const withAttack = recordCombatRoundAttackResult({
      participantId: "gladiator",
      result,
      state: {
        ...withInitiatives,
        selectedParticipantId: "gladiator",
        selectedStep: "initiative_phase_1",
      },
      submittedBy: "gm",
    });
    const cleared = clearCombatRoundStep({
      state: {
        ...withAttack,
        selectedParticipantId: "gladiator",
        selectedStep: "initiative_phase_1",
      },
      step: "initiative_phase_1",
    });

    expect(cleared.selectedParticipantId).toBe("gladiator");
    expect(cleared.selectedStep).toBe("initiative_phase_1");
    expect(cleared.participants[0]?.initiatives.phase1).toBeUndefined();
    expect(cleared.participants[1]?.initiatives.phase1).toMatchObject({ total: 12 });
    expect(cleared.participants[0]?.attackResults.phase1).toBeUndefined();
    expect(cleared.participants[0]?.stepStatuses.phase_1_actions).toBe("pending");
    expect(cleared.participants[1]?.stepStatuses.review_phase_2_actions).toBe("pending");
  });

  it("clears the current step and rewinds to the previous step", () => {
    const state = advanceCombatRoundStep(initializeCombatRoundState({ encounter: encounter() }));
    const withCompleteReview = setCombatRoundParticipantStepStatus({
      participantId: "gladiator",
      state,
      status: "complete",
      step: "review_action_modifiers",
    });
    const rewound = clearCurrentCombatRoundStepAndRewind(withCompleteReview);

    expect(withCompleteReview.currentStep).toBe("review_action_modifiers");
    expect(rewound.currentStep).toBe("select_actions");
    expect(rewound.selectedStep).toBe("select_actions");
    expect(rewound.participants[0]?.stepStatuses.review_action_modifiers).toBe("pending");
    expect(rewound.participants[0]?.stepStatuses.select_actions).toBe("locked");
  });

  it("clears DE in place when called directly on the first step", () => {
    const state = recordCombatRoundDeclaration({
      declaration: {
        actionId: "attack_parry",
        movementId: "hold",
        roundNumber: 3,
      },
      participantId: "gladiator",
      state: initializeCombatRoundState({ encounter: encounter() }),
      submittedBy: "player",
    });
    const cleared = clearCurrentCombatRoundStepAndRewind(state);

    expect(cleared.currentStep).toBe("select_actions");
    expect(cleared.participants[0]?.stepStatuses.select_actions).toBe("pending");
    expect(cleared.participants[0]?.declaration).toBeUndefined();
  });

  it("clears stale A/P/D state when DE is cleared for the attacker", () => {
    const result = buildCombatRoundAttackRollResult({
      actionId: "attack_parry",
      attackerParticipantId: "gladiator",
      defenderDb: 10,
      defenderParticipantId: "guard",
      ob: 10,
      phase: "phase1",
      rollD20: 12,
      rollTotal: 12,
      rolledAt: "2026-01-01T00:03:00.000Z",
      weaponName: "Broad sword",
    });
    const withDeclaration = recordCombatRoundDeclaration({
      declaration: {
        actionId: "attack_parry",
        movementId: "hold",
        roundNumber: 3,
      },
      participantId: "gladiator",
      state: initializeCombatRoundState({ encounter: encounter() }),
      submittedBy: "player",
    });
    const withAttack = recordCombatRoundAttackResult({
      participantId: "gladiator",
      result,
      state: withDeclaration,
      submittedBy: "gm",
    });
    const withResolution = ensureCombatRoundPhaseResolutionResultsForPhase({
      phase: "phase1",
      state: withAttack,
      updatedAt: "2026-01-01T00:04:00.000Z",
    });
    const withSnapshots = {
      ...withResolution,
      selectedParticipantId: "gladiator",
      selectedStep: "select_actions" as const,
      stepSnapshots: [
        stepSnapshot({
          attackResult: result,
          participantId: "gladiator",
          phase: "phase1",
          step: "phase_1_actions",
        }),
        stepSnapshot({
          attackResult: result,
          participantId: "guard",
          phase: "phase1",
          phaseResolutionResult: withResolution.phaseResolutionResults[0],
          step: "review_phase_2_actions",
        }),
      ],
    };
    const cleared = clearCombatRoundStep({
      state: withSnapshots,
      step: "select_actions",
    });

    expect(cleared.participants[0]?.declaration).toBeUndefined();
    expect(cleared.participants[0]?.attackResults.phase1).toBeUndefined();
    expect(cleared.phaseResolutionCursor).toBeUndefined();
    expect(cleared.phaseResolutionResults).toEqual([]);
    expect(cleared.participants[0]?.stepStatuses.phase_1_actions).toBe("pending");
    expect(cleared.participants[1]?.stepStatuses.review_phase_2_actions).toBe("pending");
    expect(cleared.participants[1]?.stepStatuses.phase_1_damage).toBe("pending");
    expect(
      getCombatRoundParticipantPhaseStepStatus({
        participantId: "guard",
        state: cleared,
        step: "review_phase_2_actions",
      }),
    ).toBe("pending");
    expect(
      getCombatRoundStepSnapshot({
        participantId: "gladiator",
        state: cleared,
        step: "phase_1_actions",
      }),
    ).toBeUndefined();
    expect(
      getCombatRoundStepSnapshot({
        participantId: "guard",
        state: cleared,
        step: "review_phase_2_actions",
      }),
    ).toBeUndefined();
  });

  it("clears stale outgoing A/P/D state when a declaration is replaced", () => {
    const result = buildCombatRoundAttackRollResult({
      actionId: "attack_parry",
      attackerParticipantId: "gladiator",
      defenderDb: 10,
      defenderParticipantId: "guard",
      ob: 10,
      phase: "phase1",
      rollD20: 12,
      rollTotal: 12,
      rolledAt: "2026-01-01T00:03:00.000Z",
      weaponName: "Broad sword",
    });
    const withDeclaration = declareRoundAction({
      actionId: "attack_parry",
      participantId: "gladiator",
      state: initializeCombatRoundState({ encounter: encounter() }),
    });
    const withAttack = recordCombatRoundAttackResult({
      participantId: "gladiator",
      result,
      state: withDeclaration,
      submittedBy: "gm",
    });
    const withResolution = ensureCombatRoundPhaseResolutionResultsForPhase({
      phase: "phase1",
      state: withAttack,
      updatedAt: "2026-01-01T00:04:00.000Z",
    });
    const redeclared = recordCombatRoundDeclaration({
      declaration: {
        actionId: "parry_attack",
        movementId: "hold",
        roundNumber: 3,
      },
      participantId: "gladiator",
      state: withResolution,
      submittedBy: "gm",
    });

    expect(redeclared.participants[0]?.declaration).toMatchObject({
      actionId: "parry_attack",
    });
    expect(redeclared.participants[0]?.attackResults.phase1).toBeUndefined();
    expect(redeclared.phaseResolutionResults).toEqual([]);
    expect(redeclared.participants[1]?.stepStatuses.review_phase_2_actions).toBe("pending");
    expect(
      getCombatRoundParticipantPhaseStepStatus({
        participantId: "guard",
        state: redeclared,
        step: "review_phase_2_actions",
      }),
    ).toBe("pending");
  });

  it("clears declaration snapshots when DE is cleared", () => {
    const state = recordCombatRoundDeclaration({
      declaration: {
        actionId: "attack_parry",
        movementId: "hold",
        roundNumber: 3,
      },
      participantId: "gladiator",
      state: initializeCombatRoundState({ encounter: encounter() }),
      submittedBy: "player",
    });
    const withSnapshots = advanceCombatRoundStep(state, {
      stepSnapshots: [
        stepSnapshot({
          declarationSummary: {
            actionId: "attack_parry",
            movementId: "hold",
          },
          participantId: "gladiator",
          step: "select_actions",
        }),
      ],
    });
    const cleared = clearCombatRoundStep({
      state: withSnapshots,
      step: "select_actions",
    });

    expect(
      getCombatRoundStepSnapshot({
        participantId: "gladiator",
        state: cleared,
        step: "select_actions",
      }),
    ).toBeUndefined();
  });

  it("sets the active participant marker", () => {
    const state = initializeCombatRoundState({ encounter: encounter() });
    const nextState = setCombatRoundActiveParticipant(state, "guard");

    expect(nextState.activeParticipantId).toBe("guard");
    expect(nextState.selectedParticipantId).toBe("guard");
  });

  it("marks participant declaration status without advancing the whole round", () => {
    const state = initializeCombatRoundState({ encounter: encounter() });
    const nextState = setCombatRoundParticipantStepStatus({
      participantId: "gladiator",
      state,
      status: "submitted",
      step: "select_actions",
    });

    expect(nextState.currentStep).toBe("select_actions");
    expect(nextState.participants[0]?.stepStatuses.select_actions).toBe("submitted");
    expect(nextState.participants[1]?.stepStatuses.select_actions).toBe("pending");
  });

  it("records player and GM declaration statuses for DE cells", () => {
    const state = initializeCombatRoundState({ encounter: encounter() });
    const playerDeclared = recordCombatRoundDeclaration({
      declaration: {
        actionId: "attack_parry",
        additionalActionNotes: "Hold the bridge.",
        movementId: "hold",
        phaseContexts: {
          phase1: {
            mainHandParryDirection: "left",
            targetParticipantId: "guard",
            modifierBuckets: {
              general: [],
              situationDb: [],
              situationInitiative: [],
              situationObSkill: [],
            },
          },
          phase2: {
            offHandParryDirection: "right_forward",
            targetParticipantId: "goblin",
            modifierBuckets: {
              general: [],
              situationDb: [],
              situationInitiative: [],
              situationObSkill: [],
            },
          },
        },
        roundNumber: state.roundNumber,
        secondaryActionId: "observe_opponent",
        submittedAt: "2026-01-01T00:01:00.000Z",
        submittedByUserId: "player-1",
      },
      participantId: "gladiator",
      state,
      submittedBy: "player",
    });
    const gmDeclared = recordCombatRoundDeclaration({
      participantId: "guard",
      state: playerDeclared,
      submittedBy: "gm",
    });

    expect(gmDeclared.participants[0]?.stepStatuses.select_actions).toBe("submitted");
    expect(gmDeclared.participants[0]?.declaration).toMatchObject({
      actionId: "attack_parry",
      additionalActionNotes: "Hold the bridge.",
      movementId: "hold",
      phaseContexts: {
        phase1: expect.objectContaining({
          mainHandParryDirection: "left",
          targetParticipantId: "guard",
        }),
        phase2: expect.objectContaining({
          offHandParryDirection: "right_forward",
          targetParticipantId: "goblin",
        }),
      },
      roundNumber: 3,
      secondaryActionId: "observe_opponent",
      submittedBy: "player",
      submittedByUserId: "player-1",
    });
    expect(gmDeclared.participants[1]?.stepStatuses.select_actions).toBe("gmEdited");
    expect(
      canPlayerSubmitCombatDeclaration({ participantId: "gladiator", state: gmDeclared }),
    ).toBe(false);
  });

  it("records declare_action commands and advances the current cursor row by row", () => {
    const threeParticipantEncounter = encounter({
      participants: [
        participant({ id: "gladiator", label: "The Gladiator" }),
        participant({ id: "guard", label: "City guard" }),
        participant({ id: "archer", label: "Archer" }),
      ],
    });
    const initial = initializeCombatRoundState({ encounter: threeParticipantEncounter });
    const afterTop = recordCombatRoundDeclaration({
      command: {
        createdAt: "2026-01-01T00:01:00.000Z",
        createdByUserId: "gm-1",
      },
      declaration: {
        actionId: "attack_parry",
        roundNumber: initial.roundNumber,
      },
      participantId: "gladiator",
      state: initial,
      submittedBy: "gm",
    });
    const afterMiddle = recordCombatRoundDeclaration({
      command: {
        createdAt: "2026-01-01T00:02:00.000Z",
        createdByUserId: "gm-1",
      },
      declaration: {
        actionId: "parry_attack",
        roundNumber: initial.roundNumber,
      },
      participantId: "guard",
      state: afterTop,
      submittedBy: "gm",
    });
    const afterBottom = recordCombatRoundDeclaration({
      command: {
        createdAt: "2026-01-01T00:03:00.000Z",
        createdByUserId: "gm-1",
      },
      declaration: {
        actionId: "double_attack",
        roundNumber: initial.roundNumber,
      },
      participantId: "archer",
      state: afterMiddle,
      submittedBy: "gm",
    });

    expect(afterTop.commands).toHaveLength(1);
    expect(afterTop.commands[0]).toMatchObject({
      afterCursor: {
        participantId: "guard",
        roundNumber: 3,
        step: "DE",
      },
      beforeCursor: {
        participantId: "gladiator",
        roundNumber: 3,
        step: "DE",
      },
      createdByUserId: "gm-1",
      participantId: "gladiator",
      type: "declare_action",
    });
    expect(afterTop.currentCursor).toEqual(afterTop.commands[0]?.afterCursor);
    expect(afterTop.selectedParticipantId).toBe("guard");
    expect(afterTop.selectedStep).toBe("select_actions");
    expect(afterMiddle.currentCursor).toMatchObject({
      participantId: "archer",
      step: "DE",
    });
    expect(afterBottom.currentCursor).toMatchObject({
      participantId: "archer",
      step: "DE",
    });
    expect(afterBottom.selectedParticipantId).toBe("archer");
    expect(afterBottom.commands.map((command) => command.type)).toEqual([
      "declare_action",
      "declare_action",
      "declare_action",
    ]);
  });

  it("undoes the latest DE command even when an older DE cell is selected", () => {
    const threeParticipantEncounter = encounter({
      participants: [
        participant({ id: "gladiator", label: "The Gladiator" }),
        participant({ id: "guard", label: "City guard" }),
        participant({ id: "archer", label: "Archer" }),
      ],
    });
    const initial = initializeCombatRoundState({ encounter: threeParticipantEncounter });
    const afterTop = recordCombatRoundDeclaration({
      command: {
        createdAt: "2026-01-01T00:01:00.000Z",
        createdByUserId: "gm-1",
      },
      declaration: {
        actionId: "attack_parry",
        roundNumber: initial.roundNumber,
      },
      participantId: "gladiator",
      state: initial,
      submittedBy: "gm",
    });
    const afterGuard = recordCombatRoundDeclaration({
      command: {
        createdAt: "2026-01-01T00:02:00.000Z",
        createdByUserId: "gm-1",
      },
      declaration: {
        actionId: "parry_attack",
        roundNumber: initial.roundNumber,
      },
      participantId: "guard",
      state: afterTop,
      submittedBy: "gm",
    });
    const cleared = clearCombatRoundStep({
      state: {
        ...afterGuard,
        selectedParticipantId: "gladiator",
        selectedStep: "select_actions",
      },
      step: "select_actions",
    });

    expect(cleared.commands).toHaveLength(1);
    expect(cleared.commands[0]).toMatchObject({
      participantId: "gladiator",
      type: "declare_action",
    });
    expect(cleared.currentCursor).toEqual({
      participantId: "guard",
      roundNumber: 3,
      step: "DE",
    });
    expect(cleared.selectedParticipantId).toBe("guard");
    expect(cleared.selectedStep).toBe("select_actions");
    expect(cleared.participants[0]?.declaration?.actionId).toBe("attack_parry");
    expect(cleared.participants[0]?.stepStatuses.select_actions).toBe("gmEdited");
    expect(cleared.participants[1]?.declaration).toBeUndefined();
    expect(cleared.participants[1]?.stepStatuses.select_actions).toBe("pending");
  });

  it("unwinds top-advance DE skip commands in reverse participant order", () => {
    const initial = initializeCombatRoundState({ encounter: encounter() });
    const advanced = advanceCombatRoundStep(initial, {
      command: {
        createdAt: "2026-01-01T00:01:00.000Z",
        createdByUserId: "gm-1",
      },
    });
    const cleared = clearCombatRoundStep({
      state: {
        ...advanced,
        selectedParticipantId: "gladiator",
        selectedStep: "review_action_modifiers",
      },
      step: "review_action_modifiers",
    });
    const clearedAgain = clearCombatRoundStep({
      state: cleared,
      step: "select_actions",
    });

    expect(advanced.currentStep).toBe("review_action_modifiers");
    expect(advanced.commands.map((command) => command.participantId)).toEqual([
      "gladiator",
      "guard",
    ]);
    expect(advanced.commands.map((command) => command.type)).toEqual([
      "declare_action",
      "declare_action",
    ]);
    expect(advanced.participants[0]?.stepStatuses.select_actions).toBe("locked");
    expect(advanced.participants[1]?.stepStatuses.select_actions).toBe("locked");
    expect(cleared.commands).toHaveLength(1);
    expect(cleared.currentCursor).toEqual({
      participantId: "guard",
      roundNumber: 3,
      step: "DE",
    });
    expect(cleared.selectedParticipantId).toBe("guard");
    expect(cleared.selectedStep).toBe("select_actions");
    expect(cleared.participants[0]?.stepStatuses.select_actions).toBe("locked");
    expect(cleared.participants[1]?.stepStatuses.select_actions).toBe("pending");
    expect(clearedAgain.commands).toEqual([]);
    expect(clearedAgain.currentCursor).toEqual({
      participantId: "gladiator",
      roundNumber: 3,
      step: "DE",
    });
    expect(clearedAgain.selectedParticipantId).toBe("gladiator");
    expect(clearedAgain.selectedStep).toBe("select_actions");
    expect(clearedAgain.participants[0]?.stepStatuses.select_actions).toBe("pending");
    expect(clearedAgain.participants[1]?.stepStatuses.select_actions).toBe("pending");
  });

  it("maps initiative and action review steps to their initiative phase", () => {
    expect(getCombatRoundInitiativePhaseForStep("initiative_phase_1")).toBe("phase1");
    expect(getCombatRoundInitiativePhaseForStep("phase_1_actions")).toBe("phase1");
    expect(getCombatRoundInitiativePhaseForStep("review_phase_2_actions")).toBe("phase1");
    expect(getCombatRoundInitiativePhaseForStep("initiative_phase_2")).toBe("phase2");
    expect(getCombatRoundInitiativePhaseForStep("select_actions")).toBeUndefined();
  });

  it("maps round steps to their modifier phase context", () => {
    expect(getCombatRoundModifierPhaseForStep("select_actions")).toBeUndefined();
    expect(getCombatRoundModifierPhaseForStep("review_action_modifiers")).toBe("phase1");
    expect(getCombatRoundModifierPhaseForStep("initiative_phase_1")).toBe("phase1");
    expect(getCombatRoundModifierPhaseForStep("phase_1_actions")).toBe("phase1");
    expect(getCombatRoundModifierPhaseForStep("review_phase_2_actions")).toBe("phase1");
    expect(getCombatRoundModifierPhaseForStep("review_phase_2_modifiers")).toBe("phase2");
    expect(getCombatRoundModifierPhaseForStep("initiative_phase_2")).toBe("phase2");
    expect(getCombatRoundModifierPhaseForStep("phase_2_actions")).toBe("phase2");
    expect(getCombatRoundModifierPhaseForStep("review_phase_2_damage")).toBe("phase2");
    expect(getCombatRoundModifierPhaseForStep("round_summary")).toBeUndefined();
  });

  it("records initiative and marks the initiative step submitted", () => {
    const state = advanceCombatRoundStep(
      advanceCombatRoundStep(initializeCombatRoundState({ encounter: encounter() })),
    );
    const nextState = recordCombatRoundInitiative({
      initiative: 18,
      participantId: "gladiator",
      phase: "phase1",
      state,
      submittedBy: "player",
    });

    expect(state.currentStep).toBe("initiative_phase_1");
    expect(nextState.participants[0]?.initiatives.phase1).toEqual({
      baseInitiative: 0,
      modifierAdjustment: 0,
      rolls: [],
      rollTotal: 18,
      total: 18,
    });
    expect(nextState.participants[0]?.stepStatuses.initiative_phase_1).toBe("submitted");
    expect(
      canPlayerRollCombatInitiative({
        participantId: "gladiator",
        phase: "phase1",
        state: nextState,
      }),
    ).toBe(false);
  });

  it("records global review and initiative commands with same-step cursor movement", () => {
    const reviewPhase1 = advanceCombatRoundStep(
      initializeCombatRoundState({ encounter: encounter() }),
    );
    const reviewedPhase1 = recordCombatRoundParticipantStepReview({
      command: {
        createdAt: "2026-01-01T00:01:00.000Z",
        createdByUserId: "gm-1",
      },
      participantId: "gladiator",
      state: reviewPhase1,
      step: "review_action_modifiers",
      submittedBy: "gm",
    });
    const initiativePhase1 = advanceToStep(
      initializeCombatRoundState({ encounter: encounter() }),
      "initiative_phase_1",
    );
    const rolledPhase1 = recordCombatRoundInitiative({
      command: {
        createdAt: "2026-01-01T00:02:00.000Z",
        createdByUserId: "gm-1",
      },
      initiative: 12,
      participantId: "gladiator",
      phase: "phase1",
      state: initiativePhase1,
      submittedBy: "gm",
    });
    const reviewPhase2 = advanceToStep(
      initializeCombatRoundState({ encounter: encounter() }),
      "review_phase_2_modifiers",
    );
    const reviewedPhase2 = recordCombatRoundParticipantStepReview({
      command: {
        createdAt: "2026-01-01T00:03:00.000Z",
        createdByUserId: "gm-1",
      },
      participantId: "gladiator",
      state: reviewPhase2,
      step: "review_phase_2_modifiers",
      submittedBy: "gm",
    });
    const initiativePhase2 = advanceToStep(
      initializeCombatRoundState({ encounter: encounter() }),
      "initiative_phase_2",
    );
    const rolledPhase2 = recordCombatRoundInitiative({
      command: {
        createdAt: "2026-01-01T00:04:00.000Z",
        createdByUserId: "gm-1",
      },
      initiative: 9,
      participantId: "gladiator",
      phase: "phase2",
      state: initiativePhase2,
      submittedBy: "gm",
    });

    expect(reviewedPhase1.commands[0]).toMatchObject({
      afterCursor: { participantId: "guard", step: "M1" },
      beforeCursor: { participantId: "gladiator", step: "M1" },
      type: "review_modifiers_phase1",
    });
    expect(reviewedPhase1.currentCursor).toMatchObject({ participantId: "guard", step: "M1" });
    expect(rolledPhase1.commands[0]).toMatchObject({
      afterCursor: { participantId: "guard", step: "i1" },
      beforeCursor: { participantId: "gladiator", step: "i1" },
      type: "roll_initiative_phase1",
    });
    expect(rolledPhase1.currentCursor).toMatchObject({ participantId: "guard", step: "i1" });
    expect(reviewedPhase2.commands[0]).toMatchObject({
      afterCursor: { participantId: "guard", step: "M2" },
      beforeCursor: { participantId: "gladiator", step: "M2" },
      type: "review_modifiers_phase2",
    });
    expect(reviewedPhase2.currentCursor).toMatchObject({ participantId: "guard", step: "M2" });
    expect(rolledPhase2.commands[0]).toMatchObject({
      afterCursor: { participantId: "guard", step: "i2" },
      beforeCursor: { participantId: "gladiator", step: "i2" },
      type: "roll_initiative_phase2",
    });
    expect(rolledPhase2.currentCursor).toMatchObject({ participantId: "guard", step: "i2" });
  });

  it("undoes M1 and M2 review commands without clearing declarations", () => {
    const declared = recordCombatRoundDeclaration({
      declaration: {
        actionId: "attack_parry",
        roundNumber: 3,
      },
      participantId: "gladiator",
      state: initializeCombatRoundState({ encounter: encounter() }),
      submittedBy: "gm",
    });
    const reviewPhase1 = advanceToStep(declared, "review_action_modifiers");
    const reviewedPhase1 = recordCombatRoundParticipantStepReview({
      command: {
        createdAt: "2026-01-01T00:01:00.000Z",
        createdByUserId: "gm-1",
      },
      participantId: "gladiator",
      state: reviewPhase1,
      step: "review_action_modifiers",
      submittedBy: "gm",
    });
    const clearedPhase1 = clearCombatRoundStep({
      state: {
        ...reviewedPhase1,
        selectedParticipantId: "gladiator",
        selectedStep: "review_action_modifiers",
      },
      step: "review_action_modifiers",
    });
    const reviewPhase2 = advanceToStep(declared, "review_phase_2_modifiers");
    const reviewedPhase2 = recordCombatRoundParticipantStepReview({
      command: {
        createdAt: "2026-01-01T00:02:00.000Z",
        createdByUserId: "gm-1",
      },
      participantId: "gladiator",
      state: reviewPhase2,
      step: "review_phase_2_modifiers",
      submittedBy: "gm",
    });
    const clearedPhase2 = clearCombatRoundStep({
      state: {
        ...reviewedPhase2,
        selectedParticipantId: "gladiator",
        selectedStep: "review_phase_2_modifiers",
      },
      step: "review_phase_2_modifiers",
    });

    expect(clearedPhase1.commands).toEqual([]);
    expect(clearedPhase1.currentCursor).toEqual({
      participantId: "gladiator",
      roundNumber: 3,
      step: "M1",
    });
    expect(clearedPhase1.participants[0]?.stepStatuses.review_action_modifiers).toBe("pending");
    expect(clearedPhase1.participants[0]?.stepStatuses.select_actions).toBe("gmEdited");
    expect(clearedPhase1.participants[0]?.declaration?.actionId).toBe("attack_parry");
    expect(clearedPhase2.commands).toEqual([]);
    expect(clearedPhase2.currentCursor).toEqual({
      participantId: "gladiator",
      roundNumber: 3,
      step: "M2",
    });
    expect(clearedPhase2.participants[0]?.stepStatuses.review_phase_2_modifiers).toBe("pending");
    expect(clearedPhase2.participants[0]?.declaration?.actionId).toBe("attack_parry");
  });

  it("unwinds top-advance M1 commands in reverse participant order", () => {
    const reviewPhase1 = advanceToStep(
      initializeCombatRoundState({ encounter: encounter() }),
      "review_action_modifiers",
    );
    const advanced = advanceCombatRoundStep(reviewPhase1, {
      command: {
        createdAt: "2026-01-01T00:01:00.000Z",
        createdByUserId: "gm-1",
        participantId: "gladiator",
      },
      stepSnapshots: [
        stepSnapshot({
          participantId: "gladiator",
          step: "review_action_modifiers",
        }),
        stepSnapshot({
          participantId: "guard",
          step: "review_action_modifiers",
        }),
      ],
    });
    const cleared = clearCombatRoundStep({
      state: advanced,
      step: "initiative_phase_1",
    });
    const clearedAgain = clearCombatRoundStep({
      state: cleared,
      step: "review_action_modifiers",
    });

    expect(advanced.currentStep).toBe("initiative_phase_1");
    expect(advanced.commands.map((command) => command.participantId)).toEqual([
      "gladiator",
      "guard",
    ]);
    expect(advanced.commands[0]).toMatchObject({
      beforeCursor: { participantId: "gladiator", step: "M1" },
      participantId: "gladiator",
      type: "review_modifiers_phase1",
    });
    expect(advanced.commands[1]).toMatchObject({
      beforeCursor: { participantId: "guard", step: "M1" },
      facts: expect.objectContaining({
        source: "advance_step",
        status: "complete",
      }),
      participantId: "guard",
      type: "review_modifiers_phase1",
    });
    expect(advanced.participants[0]?.stepStatuses.review_action_modifiers).toBe("complete");
    expect(advanced.participants[1]?.stepStatuses.review_action_modifiers).toBe("complete");
    expect(cleared.commands).toHaveLength(1);
    expect(cleared.commands[0]).toMatchObject({
      participantId: "gladiator",
      type: "review_modifiers_phase1",
    });
    expect(cleared.currentCursor).toEqual({
      participantId: "guard",
      roundNumber: 3,
      step: "M1",
    });
    expect(cleared.currentStep).toBe("review_action_modifiers");
    expect(cleared.selectedParticipantId).toBe("guard");
    expect(cleared.selectedStep).toBe("review_action_modifiers");
    expect(cleared.participants[0]?.stepStatuses.review_action_modifiers).toBe("complete");
    expect(cleared.participants[1]?.stepStatuses.review_action_modifiers).toBe("pending");
    expect(
      getCombatRoundStepSnapshot({
        participantId: "gladiator",
        state: cleared,
        step: "review_action_modifiers",
      }),
    ).toMatchObject({
      participantId: "gladiator",
      step: "review_action_modifiers",
    });
    expect(
      getCombatRoundStepSnapshot({
        participantId: "guard",
        state: cleared,
        step: "review_action_modifiers",
      }),
    ).toBeUndefined();
    expect(clearedAgain.commands).toEqual([]);
    expect(clearedAgain.currentCursor).toEqual({
      participantId: "gladiator",
      roundNumber: 3,
      step: "M1",
    });
    expect(clearedAgain.selectedParticipantId).toBe("gladiator");
    expect(clearedAgain.selectedStep).toBe("review_action_modifiers");
    expect(clearedAgain.participants[0]?.stepStatuses.review_action_modifiers).toBe("pending");
    expect(clearedAgain.participants[1]?.stepStatuses.review_action_modifiers).toBe("pending");
  });

  it("unwinds top-advance M2 commands in reverse participant order", () => {
    const reviewPhase2 = advanceToStep(
      initializeCombatRoundState({ encounter: encounter() }),
      "review_phase_2_modifiers",
    );
    const advanced = advanceCombatRoundStep(reviewPhase2, {
      command: {
        createdAt: "2026-01-01T00:01:00.000Z",
        createdByUserId: "gm-1",
      },
      stepSnapshots: [
        stepSnapshot({
          participantId: "gladiator",
          step: "review_phase_2_modifiers",
        }),
        stepSnapshot({
          participantId: "guard",
          step: "review_phase_2_modifiers",
        }),
      ],
    });
    const cleared = clearCombatRoundStep({
      state: {
        ...advanced,
        selectedParticipantId: "gladiator",
        selectedStep: "initiative_phase_2",
      },
      step: "initiative_phase_2",
    });
    const clearedAgain = clearCombatRoundStep({
      state: cleared,
      step: "review_phase_2_modifiers",
    });

    expect(advanced.currentStep).toBe("initiative_phase_2");
    expect(advanced.commands.map((command) => command.participantId)).toEqual([
      "gladiator",
      "guard",
    ]);
    expect(advanced.commands.map((command) => command.type)).toEqual([
      "review_modifiers_phase2",
      "review_modifiers_phase2",
    ]);
    expect(cleared.commands).toHaveLength(1);
    expect(cleared.currentCursor).toEqual({
      participantId: "guard",
      roundNumber: 3,
      step: "M2",
    });
    expect(cleared.selectedParticipantId).toBe("guard");
    expect(cleared.selectedStep).toBe("review_phase_2_modifiers");
    expect(cleared.participants[0]?.stepStatuses.review_phase_2_modifiers).toBe("complete");
    expect(cleared.participants[1]?.stepStatuses.review_phase_2_modifiers).toBe("pending");
    expect(clearedAgain.commands).toEqual([]);
    expect(clearedAgain.currentCursor).toEqual({
      participantId: "gladiator",
      roundNumber: 3,
      step: "M2",
    });
    expect(clearedAgain.participants[0]?.stepStatuses.review_phase_2_modifiers).toBe("pending");
    expect(clearedAgain.participants[1]?.stepStatuses.review_phase_2_modifiers).toBe("pending");
  });

  it("undoes i1 commands and clears phase 1 downstream state for the participant", () => {
    const declared = recordCombatRoundDeclaration({
      declaration: {
        actionId: "attack_parry",
        roundNumber: 3,
      },
      participantId: "gladiator",
      state: initializeCombatRoundState({ encounter: encounter() }),
      submittedBy: "gm",
    });
    const withReviewedModifiers = setCombatRoundParticipantStepStatus({
      participantId: "gladiator",
      state: declared,
      status: "gmEdited",
      step: "review_action_modifiers",
    });
    const initiativePhase1 = setCombatRoundParticipantStepStatus({
      participantId: "gladiator",
      state: advanceToStep(withReviewedModifiers, "initiative_phase_1"),
      status: "gmEdited",
      step: "review_action_modifiers",
    });
    const afterTopRoll = recordCombatRoundInitiative({
      command: {
        createdAt: "2026-01-01T00:01:00.000Z",
        createdByUserId: "gm-1",
      },
      initiative: 14,
      participantId: "gladiator",
      phase: "phase1",
      state: initiativePhase1,
      submittedBy: "gm",
    });
    const afterGuardRoll = recordCombatRoundInitiative({
      command: {
        createdAt: "2026-01-01T00:02:00.000Z",
        createdByUserId: "gm-1",
      },
      initiative: 12,
      participantId: "guard",
      phase: "phase1",
      state: afterTopRoll,
      submittedBy: "gm",
    });
    const result = buildCombatRoundAttackRollResult({
      actionId: "attack_parry",
      attackerParticipantId: "gladiator",
      defenderDb: 10,
      defenderParticipantId: "guard",
      ob: 10,
      phase: "phase1",
      rollD20: 12,
      rollTotal: 12,
      rolledAt: "2026-01-01T00:03:00.000Z",
      weaponName: "Broad sword",
    });
    const withDownstreamPhaseState = recordCombatRoundAttackResult({
      participantId: "gladiator",
      result,
      state: afterGuardRoll,
      submittedBy: "gm",
    });
    const cleared = clearCombatRoundStep({
      state: {
        ...withDownstreamPhaseState,
        selectedParticipantId: "gladiator",
        selectedStep: "initiative_phase_1",
      },
      step: "initiative_phase_1",
    });

    expect(cleared.commands).toHaveLength(1);
    expect(cleared.commands[0]).toMatchObject({
      participantId: "gladiator",
      type: "roll_initiative_phase1",
    });
    expect(cleared.currentCursor).toEqual({
      participantId: "guard",
      roundNumber: 3,
      step: "i1",
    });
    expect(cleared.participants[0]?.initiatives.phase1).toMatchObject({ total: 14 });
    expect(cleared.participants[1]?.initiatives.phase1).toBeUndefined();
    expect(cleared.participants[0]?.attackResults.phase1).toEqual(result);
    expect(cleared.participants[0]?.declaration?.actionId).toBe("attack_parry");
    expect(cleared.participants[0]?.stepStatuses.review_action_modifiers).toBe("gmEdited");
  });

  it("undoes M1 commands by clearing dependent i1 and phase 1 state", () => {
    const declared = recordCombatRoundDeclaration({
      declaration: {
        actionId: "attack_parry",
        roundNumber: 3,
      },
      participantId: "gladiator",
      state: initializeCombatRoundState({ encounter: encounter() }),
      submittedBy: "gm",
    });
    const reviewPhase1 = advanceToStep(declared, "review_action_modifiers");
    const reviewed = recordCombatRoundParticipantStepReview({
      command: {
        createdAt: "2026-01-01T00:01:00.000Z",
        createdByUserId: "gm-1",
      },
      participantId: "gladiator",
      state: reviewPhase1,
      step: "review_action_modifiers",
      submittedBy: "gm",
    });
    const withInitiative = recordCombatRoundInitiative({
      initiative: 14,
      participantId: "gladiator",
      phase: "phase1",
      state: reviewed,
      submittedBy: "gm",
    });
    const result = buildCombatRoundAttackRollResult({
      actionId: "attack_parry",
      attackerParticipantId: "gladiator",
      defenderDb: 10,
      defenderParticipantId: "guard",
      ob: 10,
      phase: "phase1",
      rollD20: 12,
      rollTotal: 12,
      rolledAt: "2026-01-01T00:03:00.000Z",
      weaponName: "Broad sword",
    });
    const withDownstreamPhaseState = recordCombatRoundAttackResult({
      participantId: "gladiator",
      result,
      state: withInitiative,
      submittedBy: "gm",
    });
    const cleared = clearCombatRoundStep({
      state: {
        ...withDownstreamPhaseState,
        selectedParticipantId: "gladiator",
        selectedStep: "review_action_modifiers",
      },
      step: "review_action_modifiers",
    });

    expect(cleared.commands).toEqual([]);
    expect(cleared.currentCursor).toEqual({
      participantId: "gladiator",
      roundNumber: 3,
      step: "M1",
    });
    expect(cleared.participants[0]?.stepStatuses.review_action_modifiers).toBe("pending");
    expect(cleared.participants[0]?.stepStatuses.initiative_phase_1).toBe("pending");
    expect(cleared.participants[0]?.initiatives.phase1).toBeUndefined();
    expect(cleared.participants[0]?.attackResults.phase1).toBeUndefined();
    expect(cleared.phaseResolutionCursor).toBeUndefined();
  });

  it("unwinds top-advance i1 skip commands in reverse participant order", () => {
    const initiativePhase1 = advanceToStep(
      initializeCombatRoundState({ encounter: encounter() }),
      "initiative_phase_1",
    );
    const advanced = advanceCombatRoundStep(initiativePhase1, {
      command: {
        createdAt: "2026-01-01T00:01:00.000Z",
        createdByUserId: "gm-1",
        participantId: "gladiator",
      },
    });
    const cleared = clearCombatRoundStep({
      state: {
        ...advanced,
        selectedParticipantId: "gladiator",
        selectedStep: "phase_1_actions",
      },
      step: "phase_1_actions",
    });
    const clearedAgain = clearCombatRoundStep({
      state: cleared,
      step: "initiative_phase_1",
    });

    expect(advanced.currentStep).toBe("phase_1_actions");
    expect(advanced.commands.map((command) => command.participantId)).toEqual([
      "gladiator",
      "guard",
    ]);
    expect(advanced.commands.map((command) => command.type)).toEqual([
      "roll_initiative_phase1",
      "roll_initiative_phase1",
    ]);
    expect(advanced.commands[1]).toMatchObject({
      beforeCursor: { participantId: "guard", step: "i1" },
      facts: expect.objectContaining({
        source: "advance_step",
        status: "complete",
      }),
      participantId: "guard",
      type: "roll_initiative_phase1",
    });
    expect(cleared.commands).toHaveLength(1);
    expect(cleared.currentCursor).toEqual({
      participantId: "guard",
      roundNumber: 3,
      step: "i1",
    });
    expect(cleared.currentStep).toBe("initiative_phase_1");
    expect(cleared.selectedParticipantId).toBe("guard");
    expect(cleared.selectedStep).toBe("initiative_phase_1");
    expect(cleared.participants[0]?.stepStatuses.initiative_phase_1).toBe("complete");
    expect(cleared.participants[1]?.stepStatuses.initiative_phase_1).toBe("pending");
    expect(cleared.phaseResolutionCursor).toBeUndefined();
    expect(clearedAgain.commands).toEqual([]);
    expect(clearedAgain.currentCursor).toEqual({
      participantId: "gladiator",
      roundNumber: 3,
      step: "i1",
    });
    expect(clearedAgain.selectedParticipantId).toBe("gladiator");
    expect(clearedAgain.selectedStep).toBe("initiative_phase_1");
    expect(clearedAgain.participants[0]?.stepStatuses.initiative_phase_1).toBe("pending");
    expect(clearedAgain.participants[1]?.stepStatuses.initiative_phase_1).toBe("pending");
  });

  it("does not add invisible top-advance i1 commands for already rolled rows", () => {
    const initiativePhase1 = advanceToStep(
      initializeCombatRoundState({ encounter: encounter() }),
      "initiative_phase_1",
    );
    const afterGladiatorRoll = recordCombatRoundInitiative({
      command: {
        createdAt: "2026-01-01T00:01:00.000Z",
        createdByUserId: "gm-1",
      },
      initiative: 14,
      participantId: "gladiator",
      phase: "phase1",
      state: initiativePhase1,
      submittedBy: "gm",
    });
    const afterGuardRoll = recordCombatRoundInitiative({
      command: {
        createdAt: "2026-01-01T00:02:00.000Z",
        createdByUserId: "gm-1",
      },
      initiative: 12,
      participantId: "guard",
      phase: "phase1",
      state: afterGladiatorRoll,
      submittedBy: "gm",
    });
    const advanced = advanceCombatRoundStep(afterGuardRoll, {
      command: {
        createdAt: "2026-01-01T00:03:00.000Z",
        createdByUserId: "gm-1",
        participantId: "guard",
      },
    });

    expect(advanced.currentStep).toBe("phase_1_actions");
    expect(advanced.commands).toHaveLength(2);
    expect(advanced.commands.map((command) => command.type)).toEqual([
      "roll_initiative_phase1",
      "roll_initiative_phase1",
    ]);
    expect(advanced.participants[0]?.initiatives.phase1).toMatchObject({ total: 14 });
    expect(advanced.participants[1]?.initiatives.phase1).toMatchObject({ total: 12 });
    expect(advanced.participants[0]?.stepStatuses.initiative_phase_1).toBe("gmEdited");
    expect(advanced.participants[1]?.stepStatuses.initiative_phase_1).toBe("gmEdited");
  });

  it("undoes i2 commands and clears phase 2 downstream state for the participant", () => {
    const initiativePhase2 = advanceToStep(
      initializeCombatRoundState({ encounter: encounter() }),
      "initiative_phase_2",
    );
    const afterTopRoll = recordCombatRoundInitiative({
      command: {
        createdAt: "2026-01-01T00:01:00.000Z",
        createdByUserId: "gm-1",
      },
      initiative: 11,
      participantId: "gladiator",
      phase: "phase2",
      state: initiativePhase2,
      submittedBy: "gm",
    });
    const afterGuardRoll = recordCombatRoundInitiative({
      command: {
        createdAt: "2026-01-01T00:02:00.000Z",
        createdByUserId: "gm-1",
      },
      initiative: 9,
      participantId: "guard",
      phase: "phase2",
      state: afterTopRoll,
      submittedBy: "gm",
    });
    const result = buildCombatRoundAttackRollResult({
      actionId: "double_attack",
      attackerParticipantId: "gladiator",
      defenderDb: 10,
      defenderParticipantId: "guard",
      ob: 10,
      phase: "phase2",
      rollD20: 12,
      rollTotal: 12,
      rolledAt: "2026-01-01T00:03:00.000Z",
      weaponName: "Broad sword",
    });
    const withDownstreamPhaseState = recordCombatRoundAttackResult({
      participantId: "gladiator",
      result,
      state: afterGuardRoll,
      submittedBy: "gm",
    });
    const cleared = clearCombatRoundStep({
      state: {
        ...withDownstreamPhaseState,
        selectedParticipantId: "gladiator",
        selectedStep: "initiative_phase_2",
      },
      step: "initiative_phase_2",
    });

    expect(cleared.commands).toHaveLength(1);
    expect(cleared.commands[0]).toMatchObject({
      participantId: "gladiator",
      type: "roll_initiative_phase2",
    });
    expect(cleared.currentCursor).toEqual({
      participantId: "guard",
      roundNumber: 3,
      step: "i2",
    });
    expect(cleared.participants[0]?.initiatives.phase2).toMatchObject({ total: 11 });
    expect(cleared.participants[1]?.initiatives.phase2).toBeUndefined();
    expect(cleared.participants[0]?.attackResults.phase2).toEqual(result);
  });

  it("manual selection of an older DE cell still undoes the latest i1 command", () => {
    const declared = recordCombatRoundDeclaration({
      command: {
        createdAt: "2026-01-01T00:01:00.000Z",
        createdByUserId: "gm-1",
      },
      declaration: {
        actionId: "attack_parry",
        roundNumber: 3,
      },
      participantId: "gladiator",
      state: initializeCombatRoundState({ encounter: encounter() }),
      submittedBy: "gm",
    });
    const initiativePhase1 = {
      ...advanceToStep(declared, "initiative_phase_1"),
      selectedParticipantId: "gladiator",
      selectedStep: "initiative_phase_1" as const,
    };
    const rolled = recordCombatRoundInitiative({
      command: {
        createdAt: "2026-01-01T00:02:00.000Z",
        createdByUserId: "gm-1",
      },
      initiative: 14,
      participantId: "gladiator",
      phase: "phase1",
      state: initiativePhase1,
      submittedBy: "gm",
    });
    const cleared = clearCombatRoundStep({
      state: {
        ...rolled,
        selectedParticipantId: "gladiator",
        selectedStep: "select_actions",
      },
      step: "select_actions",
    });

    expect(cleared.commands).toHaveLength(1);
    expect(cleared.commands[0]).toMatchObject({
      participantId: "gladiator",
      type: "declare_action",
    });
    expect(cleared.currentCursor).toEqual({
      participantId: "gladiator",
      roundNumber: 3,
      step: "i1",
    });
    expect(cleared.currentStep).toBe("initiative_phase_1");
    expect(cleared.selectedParticipantId).toBe("gladiator");
    expect(cleared.selectedStep).toBe("initiative_phase_1");
    expect(cleared.participants[0]?.declaration?.actionId).toBe("attack_parry");
    expect(cleared.participants[0]?.initiatives.phase1).toBeUndefined();
  });

  it("falls back to the latest command undo when selected empty A1 has no local state", () => {
    const initiativePhase1 = advanceToStep(
      initializeCombatRoundState({ encounter: encounter() }),
      "initiative_phase_1",
    );
    const afterTopRoll = recordCombatRoundInitiative({
      command: {
        createdAt: "2026-01-01T00:01:00.000Z",
        createdByUserId: "gm-1",
      },
      initiative: 14,
      participantId: "gladiator",
      phase: "phase1",
      state: initiativePhase1,
      submittedBy: "gm",
    });
    const afterGuardRoll = recordCombatRoundInitiative({
      command: {
        createdAt: "2026-01-01T00:02:00.000Z",
        createdByUserId: "gm-1",
      },
      initiative: 12,
      participantId: "guard",
      phase: "phase1",
      state: afterTopRoll,
      submittedBy: "gm",
    });
    const cleared = clearCombatRoundStep({
      state: {
        ...afterGuardRoll,
        currentStep: "phase_1_actions",
        selectedParticipantId: "guard",
        selectedStep: "phase_1_actions",
      },
      step: "phase_1_actions",
    });

    expect(cleared.commands).toHaveLength(1);
    expect(cleared.commands[0]).toMatchObject({
      participantId: "gladiator",
      type: "roll_initiative_phase1",
    });
    expect(cleared.currentCursor).toEqual({
      participantId: "guard",
      roundNumber: 3,
      step: "i1",
    });
    expect(cleared.currentStep).toBe("initiative_phase_1");
    expect(cleared.selectedParticipantId).toBe("guard");
    expect(cleared.selectedStep).toBe("initiative_phase_1");
    expect(cleared.participants[1]?.initiatives.phase1).toBeUndefined();
    expect(cleared.participants[0]?.initiatives.phase1).toMatchObject({ total: 14 });
  });

  it("falls back from selected empty A1 to the latest M1 command", () => {
    const reviewPhase1 = advanceToStep(
      initializeCombatRoundState({ encounter: encounter() }),
      "review_action_modifiers",
    );
    const reviewed = recordCombatRoundParticipantStepReview({
      command: {
        createdAt: "2026-01-01T00:01:00.000Z",
        createdByUserId: "gm-1",
      },
      participantId: "gladiator",
      state: reviewPhase1,
      step: "review_action_modifiers",
      submittedBy: "gm",
    });
    const cleared = clearCombatRoundStep({
      state: {
        ...reviewed,
        currentStep: "phase_1_actions",
        selectedParticipantId: "guard",
        selectedStep: "phase_1_actions",
      },
      step: "phase_1_actions",
    });

    expect(cleared.commands).toEqual([]);
    expect(cleared.currentCursor).toEqual({
      participantId: "gladiator",
      roundNumber: 3,
      step: "M1",
    });
    expect(cleared.currentStep).toBe("review_action_modifiers");
    expect(cleared.selectedParticipantId).toBe("gladiator");
    expect(cleared.selectedStep).toBe("review_action_modifiers");
    expect(cleared.participants[0]?.stepStatuses.review_action_modifiers).toBe("pending");
  });

  it("falls back from selected empty A1 to the latest DE command", () => {
    const declared = recordCombatRoundDeclaration({
      command: {
        createdAt: "2026-01-01T00:01:00.000Z",
        createdByUserId: "gm-1",
      },
      declaration: {
        actionId: "attack_parry",
        roundNumber: 3,
      },
      participantId: "gladiator",
      state: initializeCombatRoundState({ encounter: encounter() }),
      submittedBy: "gm",
    });
    const cleared = clearCombatRoundStep({
      state: {
        ...declared,
        currentStep: "phase_1_actions",
        selectedParticipantId: "guard",
        selectedStep: "phase_1_actions",
      },
      step: "phase_1_actions",
    });

    expect(cleared.commands).toEqual([]);
    expect(cleared.currentCursor).toEqual({
      participantId: "gladiator",
      roundNumber: 3,
      step: "DE",
    });
    expect(cleared.currentStep).toBe("select_actions");
    expect(cleared.selectedParticipantId).toBe("gladiator");
    expect(cleared.selectedStep).toBe("select_actions");
    expect(cleared.participants[0]?.declaration).toBeUndefined();
    expect(cleared.participants[0]?.stepStatuses.select_actions).toBe("pending");
  });

  it("leaves selected empty A1 unchanged when there is no local state or command to undo", () => {
    const state = {
      ...initializeCombatRoundState({ encounter: encounter() }),
      currentStep: "phase_1_actions" as const,
      selectedParticipantId: "guard",
      selectedStep: "phase_1_actions" as const,
    };
    const cleared = clearCombatRoundStep({
      state,
      step: "phase_1_actions",
    });

    expect(cleared).toEqual(state);
  });

  it("builds a P1 attack result from the canonical to-hit table", () => {
    expect(
      buildCombatRoundAttackRollResult({
        actionId: "attack_parry",
        attackerParticipantId: "gladiator",
        defenderDb: 11,
        defenderParticipantId: "guard",
        ob: 9,
        openEndedD10s: [],
        phase: "phase1",
        rollD20: 18,
        rollTotal: 18,
        rolledAt: "2026-01-01T00:03:00.000Z",
        rolledByUserId: "gm-1",
        weaponName: "Broad sword",
      }),
    ).toEqual({
      actionId: "attack_parry",
      attackerParticipantId: "gladiator",
      defenderDb: 11,
      defenderParticipantId: "guard",
      grazing: false,
      hit: true,
      kind: "attackRoll",
      lookupTotal: 16,
      marginOverMissThreshold: 6,
      ob: 9,
      openEndedD10s: [],
      phase: "phase1",
      rollD20: 18,
      rollTotal: 18,
      rolledAt: "2026-01-01T00:03:00.000Z",
      rolledByUserId: "gm-1",
      tableResult: "Hit",
      weaponName: "Broad sword",
    });
  });

  it("uses open-ended roll totals for P1 attack lookup totals", () => {
    expect(
      buildCombatRoundAttackRollResult({
        actionId: "attack_parry",
        attackerParticipantId: "gladiator",
        defenderDb: 11,
        defenderParticipantId: "guard",
        ob: 9,
        openEndedD10s: [7],
        phase: "phase1",
        rollD20: 20,
        rollTotal: 27,
        rolledAt: "2026-01-01T00:03:00.000Z",
        weaponName: "Broad sword",
      }),
    ).toMatchObject({
      hit: true,
      lookupTotal: 25,
      openEndedD10s: [7],
      rollD20: 20,
      rollTotal: 27,
      tableResult: "Hit",
    });
  });

  it("normalizes legacy closed-roll attack results into the open-ended result shape", () => {
    expect(
      combatRoundAttackRollResultSchema.parse({
        actionId: "attack_parry",
        attackerParticipantId: "gladiator",
        defenderDb: 10,
        defenderParticipantId: "guard",
        grazing: false,
        hit: false,
        kind: "attackRoll",
        lookupTotal: 10,
        marginOverMissThreshold: 0,
        ob: 10,
        phase: "phase1",
        roll: 10,
        rolledAt: "2026-01-01T00:03:00.000Z",
        tableResult: "Miss",
        weaponName: "Broad sword",
      }),
    ).toMatchObject({
      openEndedD10s: [],
      roll: 10,
      rollD20: 10,
      rollTotal: 10,
    });
  });

  it("records P1 attack results and marks P1 submitted", () => {
    const state = advanceCombatRoundStep(
      advanceCombatRoundStep(
        advanceCombatRoundStep(initializeCombatRoundState({ encounter: encounter() })),
      ),
    );
    const result = buildCombatRoundAttackRollResult({
      actionId: "attack_parry",
      attackerParticipantId: "gladiator",
      defenderDb: 10,
      defenderParticipantId: "guard",
      ob: 10,
      phase: "phase1",
      rollD20: 11,
      rollTotal: 11,
      rolledAt: "2026-01-01T00:03:00.000Z",
      weaponName: "Broad sword",
    });
    const nextState = recordCombatRoundAttackResult({
      participantId: "gladiator",
      result,
      state,
      submittedBy: "gm",
    });

    expect(state.currentStep).toBe("phase_1_actions");
    expect(nextState.participants[0]?.attackResults.phase1).toMatchObject({
      grazing: true,
      hit: true,
      lookupTotal: 11,
      rollD20: 11,
      rollTotal: 11,
      tableResult: "Grazing hit",
    });
    expect(nextState.participants[0]?.stepStatuses.phase_1_actions).toBe("gmEdited");
  });

  it("records A1 hit attack commands with defender P1 as the explicit after cursor", () => {
    const state = initializeCombatRoundPhaseResolutionCursor({
      phase: "phase1",
      state: declareRoundAction({
        actionId: "attack_parry",
        participantId: "gladiator",
        state: initializeCombatRoundState({ encounter: encounter() }),
      }),
      updatedAt: "2026-01-01T00:02:00.000Z",
    });
    const result = buildCombatRoundAttackRollResult({
      actionId: "attack_parry",
      attackerParticipantId: "gladiator",
      defenderDb: 10,
      defenderParticipantId: "guard",
      ob: 10,
      phase: "phase1",
      rollD20: 12,
      rollTotal: 12,
      rolledAt: "2026-01-01T00:03:00.000Z",
      weaponName: "Broad sword",
    });
    const nextState = recordCombatRoundAttackResult({
      command: {
        createdAt: result.rolledAt,
        createdByUserId: "gm-1",
      },
      participantId: "gladiator",
      result,
      state,
      submittedBy: "gm",
    });

    expect(nextState.commands).toHaveLength(1);
    expect(nextState.commands[0]).toMatchObject({
      afterCursor: {
        participantId: "guard",
        roundNumber: 3,
        step: "P1",
      },
      beforeCursor: {
        participantId: "gladiator",
        roundNumber: 3,
        step: "A1",
      },
      facts: {
        attackResultId: "3:phase1:gladiator:guard",
        defenderParticipantId: "guard",
        grazing: false,
        hit: true,
        nextStepOpened: {
          participantId: "guard",
          step: "P1",
        },
      },
      participantId: "gladiator",
      phase: "phase1",
      step: "A1",
      type: "roll_attack",
    });
    expect(nextState.currentCursor).toEqual(nextState.commands[0]?.afterCursor);
    expect(nextState.currentStep).toBe("review_phase_2_actions");
    expect(nextState.selectedParticipantId).toBe("guard");
    expect(nextState.selectedStep).toBe("review_phase_2_actions");
  });

  it("records A1 miss attack commands with the next actor A1 as the explicit after cursor", () => {
    const state = initializeCombatRoundPhaseResolutionCursor({
      phase: "phase1",
      state: setCombatRoundParticipantInitiative({
        initiative: { baseInitiative: 0, modifierAdjustment: 0, rolls: [6], rollTotal: 6, total: 6 },
        participantId: "gladiator",
        phase: "phase1",
        state: setCombatRoundParticipantInitiative({
          initiative: {
            baseInitiative: 0,
            modifierAdjustment: 0,
            rolls: [4],
            rollTotal: 4,
            total: 4,
          },
          participantId: "guard",
          phase: "phase1",
          state: declareRoundAction({
            actionId: "attack_parry",
            participantId: "guard",
            state: declareRoundAction({
              actionId: "attack_parry",
              participantId: "gladiator",
              state: initializeCombatRoundState({ encounter: encounter() }),
            }),
          }),
        }),
      }),
      updatedAt: "2026-01-01T00:02:00.000Z",
    });
    const result = buildCombatRoundAttackRollResult({
      actionId: "attack_parry",
      attackerParticipantId: "gladiator",
      defenderDb: 10,
      defenderParticipantId: "guard",
      ob: 10,
      phase: "phase1",
      rollD20: 10,
      rollTotal: 10,
      rolledAt: "2026-01-01T00:03:00.000Z",
      weaponName: "Broad sword",
    });
    const nextState = recordCombatRoundAttackResult({
      command: {
        createdAt: result.rolledAt,
        createdByUserId: "gm-1",
      },
      participantId: "gladiator",
      result,
      state,
      submittedBy: "gm",
    });

    expect(nextState.commands).toHaveLength(1);
    expect(nextState.commands[0]).toMatchObject({
      afterCursor: {
        participantId: "guard",
        roundNumber: 3,
        step: "A1",
      },
      beforeCursor: {
        participantId: "gladiator",
        roundNumber: 3,
        step: "A1",
      },
      facts: expect.objectContaining({
        attackResultId: "3:phase1:gladiator:guard",
        defenderParticipantId: "guard",
        hit: false,
        nextStepOpened: {
          participantId: "guard",
          step: "A1",
        },
      }),
      participantId: "gladiator",
      phase: "phase1",
      step: "A1",
      type: "roll_attack",
    });
    expect(nextState.currentCursor).toEqual(nextState.commands[0]?.afterCursor);
    expect(nextState.currentStep).toBe("phase_1_actions");
    expect(nextState.selectedParticipantId).toBe("guard");
    expect(nextState.selectedStep).toBe("phase_1_actions");
  });

  it("records A2 attack commands with phase 2 cursor metadata", () => {
    const state = initializeCombatRoundPhaseResolutionCursor({
      phase: "phase2",
      state: declareRoundAction({
        actionId: "parry_attack",
        participantId: "guard",
        state: initializeCombatRoundState({ encounter: encounter() }),
      }),
      updatedAt: "2026-01-01T00:02:00.000Z",
    });
    const result = buildCombatRoundAttackRollResult({
      actionId: "parry_attack",
      attackerParticipantId: "guard",
      defenderDb: 10,
      defenderParticipantId: "gladiator",
      ob: 10,
      phase: "phase2",
      rollD20: 12,
      rollTotal: 12,
      rolledAt: "2026-01-01T00:03:00.000Z",
      weaponName: "Long sword",
    });
    const nextState = recordCombatRoundAttackResult({
      command: {
        createdAt: result.rolledAt,
        createdByUserId: "gm-1",
      },
      participantId: "guard",
      result,
      state,
      submittedBy: "gm",
    });

    expect(nextState.commands[0]).toMatchObject({
      afterCursor: {
        participantId: "gladiator",
        roundNumber: 3,
        step: "P2",
      },
      beforeCursor: {
        participantId: "guard",
        roundNumber: 3,
        step: "A2",
      },
      facts: expect.objectContaining({
        attackResultId: "3:phase2:guard:gladiator",
        defenderParticipantId: "gladiator",
        hit: true,
      }),
      participantId: "guard",
      phase: "phase2",
      step: "A2",
      type: "roll_attack",
    });
    expect(nextState.currentCursor).toEqual(nextState.commands[0]?.afterCursor);
    expect(nextState.currentStep).toBe("review_phase_2_damage");
    expect(nextState.selectedStep).toBe("review_phase_2_damage");
  });

  it("records successful P1 parry commands and undoes them back to the defender P1", () => {
    const state = initializeCombatRoundPhaseResolutionCursor({
      phase: "phase1",
      state: setCombatRoundParticipantInitiative({
        initiative: { baseInitiative: 0, modifierAdjustment: 0, rolls: [6], rollTotal: 6, total: 6 },
        participantId: "gladiator",
        phase: "phase1",
        state: setCombatRoundParticipantInitiative({
          initiative: {
            baseInitiative: 0,
            modifierAdjustment: 0,
            rolls: [4],
            rollTotal: 4,
            total: 4,
          },
          participantId: "guard",
          phase: "phase1",
          state: declareRoundAction({
            actionId: "attack_parry",
            participantId: "guard",
            state: declareRoundAction({
              actionId: "attack_parry",
              participantId: "gladiator",
              state: initializeCombatRoundState({ encounter: encounter() }),
            }),
          }),
        }),
      }),
      updatedAt: "2026-01-01T00:02:00.000Z",
    });
    const result = buildCombatRoundAttackRollResult({
      actionId: "attack_parry",
      attackerParticipantId: "gladiator",
      defenderDb: 10,
      defenderParticipantId: "guard",
      ob: 10,
      phase: "phase1",
      rollD20: 12,
      rollTotal: 12,
      rolledAt: "2026-01-01T00:03:00.000Z",
      weaponName: "Broad sword",
    });
    const afterAttack = recordCombatRoundAttackResult({
      command: {
        createdAt: result.rolledAt,
        createdByUserId: "gm-1",
      },
      participantId: "gladiator",
      result,
      state,
      submittedBy: "gm",
    });
    const parryResolution = {
      combinedParryScore: 9,
      modifierAdjustment: 0,
      openEndedD10s: [],
      resultLabel: "Parry successful",
      rollD20: 12,
      rollTotal: 12,
      status: "resolved" as const,
      success: true,
      targetNumber: 21,
      total: 21,
    };
    const afterParry = recordCombatRoundParryResult({
      attackResult: result,
      command: {
        createdAt: "2026-01-01T00:04:00.000Z",
        createdByUserId: "gm-1",
      },
      parryResolution,
      state: afterAttack,
      submittedBy: "gm",
      updatedAt: "2026-01-01T00:04:00.000Z",
    });

    expect(afterParry.commands.at(-1)).toMatchObject({
      afterCursor: {
        participantId: "guard",
        roundNumber: 3,
        step: "A1",
      },
      beforeCursor: {
        participantId: "guard",
        roundNumber: 3,
        step: "P1",
      },
      facts: {
        attackResultId: "3:phase1:gladiator:guard",
        attackerParticipantId: "gladiator",
        defenderParticipantId: "guard",
        nextStepOpened: {
          participantId: "guard",
          step: "A1",
        },
        success: true,
      },
      participantId: "guard",
      phase: "phase1",
      step: "P1",
      type: "roll_parry",
    });
    expect(afterParry.currentCursor).toEqual(afterParry.commands.at(-1)?.afterCursor);
    expect(afterParry.selectedStep).toBe("phase_1_actions");
    expect(afterParry.phaseResolutionResults[0]?.parryResolution).toMatchObject({
      status: "resolved",
      success: true,
    });
    expect(afterParry.phaseResolutionResults[0]?.damageRoll.status).toBe("not_required");

    const withSnapshots = {
      ...afterParry,
      stepSnapshots: [
        stepSnapshot({
          attackResult: result,
          participantId: "gladiator",
          phase: "phase1",
          step: "phase_1_actions",
        }),
        stepSnapshot({
          attackResult: result,
          participantId: "guard",
          phase: "phase1",
          phaseResolutionResult: afterParry.phaseResolutionResults[0],
          step: "review_phase_2_actions",
        }),
        stepSnapshot({
          attackResult: result,
          participantId: "guard",
          phase: "phase1",
          phaseResolutionResult: afterParry.phaseResolutionResults[0],
          step: "phase_1_damage",
        }),
      ],
    };
    const cleared = clearCombatRoundStep({
      state: withSnapshots,
      step: "review_phase_2_actions",
    });

    expect(cleared.commands).toHaveLength(1);
    expect(cleared.commands[0]).toMatchObject({
      participantId: "gladiator",
      type: "roll_attack",
    });
    expect(cleared.participants[0]?.attackResults.phase1).toEqual(result);
    expect(cleared.phaseResolutionResults).toHaveLength(1);
    expect(cleared.phaseResolutionResults[0]?.parryResolution.status).toBe("pending");
    expect(cleared.phaseResolutionResults[0]?.damageRoll.status).toBe("pending");
    expect(cleared.currentCursor).toEqual({
      participantId: "guard",
      roundNumber: 3,
      step: "P1",
    });
    expect(cleared.currentStep).toBe("review_phase_2_actions");
    expect(cleared.phaseResolutionCursor).toEqual({
      participantId: "guard",
      phase: "phase1",
      substep: "parry",
    });
    expect(cleared.selectedParticipantId).toBe("guard");
    expect(cleared.selectedStep).toBe("review_phase_2_actions");
    expect(
      getCombatRoundPhaseResolutionStatus({
        participantId: "gladiator",
        phase: "phase1",
        state: cleared,
      }).substep,
    ).toBe("parry");
    expect(
      getCombatRoundParticipantPhaseStepStatus({
        participantId: "guard",
        state: cleared,
        step: "review_phase_2_actions",
      }),
    ).toBe("pending");
    expect(
      getCombatRoundParticipantPhaseStepStatus({
        participantId: "guard",
        state: cleared,
        step: "phase_1_damage",
      }),
    ).toBe("pending");
    expect(
      getCombatRoundStepSnapshot({
        participantId: "gladiator",
        state: cleared,
        step: "phase_1_actions",
      }),
    ).toMatchObject({
      attackResult: result,
      step: "phase_1_actions",
    });
    expect(
      getCombatRoundStepSnapshot({
        participantId: "guard",
        state: cleared,
        step: "review_phase_2_actions",
      }),
    ).toBeUndefined();
    expect(
      getCombatRoundStepSnapshot({
        participantId: "guard",
        state: cleared,
        step: "phase_1_damage",
      }),
    ).toBeUndefined();
  });

  it("records failed P2 parry commands and undoes their D2 opening", () => {
    const state = initializeCombatRoundPhaseResolutionCursor({
      phase: "phase2",
      state: setCombatRoundParticipantInitiative({
        initiative: { baseInitiative: 0, modifierAdjustment: 0, rolls: [6], rollTotal: 6, total: 6 },
        participantId: "guard",
        phase: "phase2",
        state: declareRoundAction({
          actionId: "parry_attack",
          participantId: "guard",
          state: initializeCombatRoundState({ encounter: encounter() }),
        }),
      }),
      updatedAt: "2026-01-01T00:02:00.000Z",
    });
    const result = buildCombatRoundAttackRollResult({
      actionId: "parry_attack",
      attackerParticipantId: "guard",
      defenderDb: 10,
      defenderParticipantId: "gladiator",
      ob: 10,
      phase: "phase2",
      rollD20: 12,
      rollTotal: 12,
      rolledAt: "2026-01-01T00:03:00.000Z",
      weaponName: "Long sword",
    });
    const afterAttack = recordCombatRoundAttackResult({
      command: {
        createdAt: result.rolledAt,
        createdByUserId: "gm-1",
      },
      participantId: "guard",
      result,
      state,
      submittedBy: "gm",
    });
    const afterParry = recordCombatRoundParryResult({
      attackResult: result,
      command: {
        createdAt: "2026-01-01T00:04:00.000Z",
        createdByUserId: "gm-1",
      },
      parryResolution: {
        combinedParryScore: 9,
        modifierAdjustment: 0,
        openEndedD10s: [],
        resultLabel: "Parry failed",
        rollD20: 8,
        rollTotal: 8,
        status: "resolved",
        success: false,
        targetNumber: 21,
        total: 17,
      },
      state: afterAttack,
      submittedBy: "gm",
      updatedAt: "2026-01-01T00:04:00.000Z",
    });

    expect(afterParry.commands.at(-1)).toMatchObject({
      afterCursor: {
        participantId: "gladiator",
        roundNumber: 3,
        step: "D2",
      },
      beforeCursor: {
        participantId: "gladiator",
        roundNumber: 3,
        step: "P2",
      },
      facts: expect.objectContaining({
        attackResultId: "3:phase2:guard:gladiator",
        attackerParticipantId: "guard",
        defenderParticipantId: "gladiator",
        success: false,
      }),
      participantId: "gladiator",
      phase: "phase2",
      step: "P2",
      type: "roll_parry",
    });
    expect(afterParry.currentCursor).toEqual({
      participantId: "gladiator",
      roundNumber: 3,
      step: "D2",
    });
    expect(afterParry.currentStep).toBe("phase_2_damage");
    expect(afterParry.phaseResolutionCursor).toEqual({
      participantId: "gladiator",
      phase: "phase2",
      substep: "damage",
    });

    const cleared = clearCombatRoundStep({
      state: afterParry,
      step: "phase_2_damage",
    });

    expect(cleared.commands).toHaveLength(1);
    expect(cleared.participants[1]?.attackResults.phase2).toEqual(result);
    expect(cleared.phaseResolutionResults[0]?.parryResolution.status).toBe("pending");
    expect(cleared.phaseResolutionResults[0]?.damageRoll.status).toBe("pending");
    expect(cleared.currentCursor).toEqual({
      participantId: "gladiator",
      roundNumber: 3,
      step: "P2",
    });
    expect(cleared.currentStep).toBe("review_phase_2_damage");
    expect(cleared.phaseResolutionCursor).toEqual({
      participantId: "gladiator",
      phase: "phase2",
      substep: "parry",
    });
    expect(cleared.selectedParticipantId).toBe("gladiator");
    expect(cleared.selectedStep).toBe("review_phase_2_damage");
    expect(
      getCombatRoundParticipantPhaseStepStatus({
        participantId: "gladiator",
        state: cleared,
        step: "review_phase_2_damage",
      }),
    ).toBe("pending");
    expect(
      getCombatRoundParticipantPhaseStepStatus({
        participantId: "gladiator",
        state: cleared,
        step: "phase_2_damage",
      }),
    ).toBe("pending");
  });

  it("manual selection of an older i1 cell still undoes the latest roll_parry", () => {
    const state = initializeCombatRoundPhaseResolutionCursor({
      phase: "phase1",
      state: setCombatRoundParticipantInitiative({
        initiative: { baseInitiative: 0, modifierAdjustment: 0, rolls: [6], rollTotal: 6, total: 6 },
        participantId: "gladiator",
        phase: "phase1",
        state: setCombatRoundParticipantInitiative({
          initiative: {
            baseInitiative: 0,
            modifierAdjustment: 0,
            rolls: [4],
            rollTotal: 4,
            total: 4,
          },
          participantId: "guard",
          phase: "phase1",
          state: declareRoundAction({
            actionId: "attack_parry",
            participantId: "guard",
            state: declareRoundAction({
              actionId: "attack_parry",
              participantId: "gladiator",
              state: initializeCombatRoundState({ encounter: encounter() }),
            }),
          }),
        }),
      }),
      updatedAt: "2026-01-01T00:02:00.000Z",
    });
    const result = buildCombatRoundAttackRollResult({
      actionId: "attack_parry",
      attackerParticipantId: "gladiator",
      defenderDb: 10,
      defenderParticipantId: "guard",
      ob: 10,
      phase: "phase1",
      rollD20: 12,
      rollTotal: 12,
      rolledAt: "2026-01-01T00:03:00.000Z",
      weaponName: "Broad sword",
    });
    const afterAttack = recordCombatRoundAttackResult({
      command: {
        createdAt: result.rolledAt,
        createdByUserId: "gm-1",
      },
      participantId: "gladiator",
      result,
      state,
      submittedBy: "gm",
    });
    const afterParry = recordCombatRoundParryResult({
      attackResult: result,
      command: {
        createdAt: "2026-01-01T00:04:00.000Z",
        createdByUserId: "gm-1",
      },
      parryResolution: {
        combinedParryScore: 9,
        modifierAdjustment: 0,
        openEndedD10s: [],
        resultLabel: "Parry failed",
        rollD20: 8,
        rollTotal: 8,
        status: "resolved",
        success: false,
        targetNumber: 21,
        total: 17,
      },
      state: afterAttack,
      submittedBy: "gm",
      updatedAt: "2026-01-01T00:04:00.000Z",
    });
    const cleared = clearCombatRoundStep({
      state: {
        ...afterParry,
        selectedParticipantId: "gladiator",
        selectedStep: "initiative_phase_1",
      },
      step: "initiative_phase_1",
    });

    expect(afterParry.commands.at(-1)).toMatchObject({
      participantId: "guard",
      type: "roll_parry",
    });
    expect(cleared.commands).toHaveLength(1);
    expect(cleared.commands[0]).toMatchObject({
      participantId: "gladiator",
      type: "roll_attack",
    });
    expect(cleared.participants[0]?.attackResults.phase1).toEqual(result);
    expect(cleared.participants[0]?.initiatives.phase1).toMatchObject({ total: 6 });
    expect(cleared.phaseResolutionResults[0]?.parryResolution.status).toBe("pending");
    expect(cleared.currentCursor).toEqual({
      participantId: "guard",
      roundNumber: 3,
      step: "P1",
    });
    expect(cleared.currentStep).toBe("review_phase_2_actions");
    expect(cleared.selectedParticipantId).toBe("guard");
    expect(cleared.selectedStep).toBe("review_phase_2_actions");
  });

  it("records and undoes D1 placeholder damage review commands after failed parry", () => {
    const state = initializeCombatRoundPhaseResolutionCursor({
      phase: "phase1",
      state: setCombatRoundParticipantInitiative({
        initiative: { baseInitiative: 0, modifierAdjustment: 0, rolls: [6], rollTotal: 6, total: 6 },
        participantId: "gladiator",
        phase: "phase1",
        state: setCombatRoundParticipantInitiative({
          initiative: {
            baseInitiative: 0,
            modifierAdjustment: 0,
            rolls: [4],
            rollTotal: 4,
            total: 4,
          },
          participantId: "guard",
          phase: "phase1",
          state: declareRoundAction({
            actionId: "attack_parry",
            participantId: "guard",
            state: declareRoundAction({
              actionId: "attack_parry",
              participantId: "gladiator",
              state: initializeCombatRoundState({ encounter: encounter() }),
            }),
          }),
        }),
      }),
      updatedAt: "2026-01-01T00:02:00.000Z",
    });
    const result = buildCombatRoundAttackRollResult({
      actionId: "attack_parry",
      attackerParticipantId: "gladiator",
      defenderDb: 10,
      defenderParticipantId: "guard",
      ob: 10,
      phase: "phase1",
      rollD20: 12,
      rollTotal: 12,
      rolledAt: "2026-01-01T00:03:00.000Z",
      weaponName: "Broad sword",
    });
    const afterAttack = recordCombatRoundAttackResult({
      command: {
        createdAt: result.rolledAt,
        createdByUserId: "gm-1",
      },
      participantId: "gladiator",
      result,
      state,
      submittedBy: "gm",
    });
    const afterParry = recordCombatRoundParryResult({
      attackResult: result,
      command: {
        createdAt: "2026-01-01T00:04:00.000Z",
        createdByUserId: "gm-1",
      },
      parryResolution: {
        combinedParryScore: 9,
        modifierAdjustment: 0,
        openEndedD10s: [],
        resultLabel: "Parry failed",
        rollD20: 8,
        rollTotal: 8,
        status: "resolved",
        success: false,
        targetNumber: 21,
        total: 17,
      },
      state: afterAttack,
      submittedBy: "gm",
      updatedAt: "2026-01-01T00:04:00.000Z",
    });
    const afterDamageReview = recordCombatRoundDamageReviewPlaceholder({
      attackResult: result,
      command: {
        createdAt: "2026-01-01T00:05:00.000Z",
        createdByUserId: "gm-1",
      },
      state: afterParry,
      submittedBy: "gm",
      updatedAt: "2026-01-01T00:05:00.000Z",
    });
    const cleared = clearCombatRoundStep({
      state: {
        ...afterDamageReview,
        selectedParticipantId: "gladiator",
        selectedStep: "initiative_phase_1",
      },
      step: "initiative_phase_1",
    });

    expect(
      getCombatRoundParticipantPhaseStepStatus({
        participantId: "guard",
        state: afterParry,
        step: "phase_1_damage",
      }),
    ).toBe("pending");
    expect(afterDamageReview.commands.at(-1)).toMatchObject({
      afterCursor: {
        participantId: "guard",
        roundNumber: 3,
        step: "A1",
      },
      beforeCursor: {
        participantId: "guard",
        roundNumber: 3,
        step: "D1",
      },
      facts: {
        attackResultId: "3:phase1:gladiator:guard",
        attackerParticipantId: "gladiator",
        defenderParticipantId: "guard",
        nextStepOpened: {
          participantId: "guard",
          step: "A1",
        },
        status: "deferred",
      },
      participantId: "guard",
      phase: "phase1",
      step: "D1",
      type: "complete_damage_review_phase1",
    });
    expect(
      getCombatRoundParticipantPhaseStepStatus({
        participantId: "guard",
        state: afterDamageReview,
        step: "phase_1_damage",
      }),
    ).toBe("gmEdited");
    expect(afterDamageReview.phaseResolutionResults[0]?.damageProposal.proposedEffects).toEqual([]);
    expect(afterDamageReview.phaseResolutionResults[0]?.damageRoll.status).toBe("pending");
    expect(cleared.commands.at(-1)).toMatchObject({
      participantId: "guard",
      type: "roll_parry",
    });
    expect(cleared.currentCursor).toEqual({
      participantId: "guard",
      roundNumber: 3,
      step: "D1",
    });
    expect(cleared.currentStep).toBe("phase_1_damage");
    expect(cleared.phaseResolutionCursor).toEqual({
      participantId: "guard",
      phase: "phase1",
      substep: "damage",
    });
    expect(cleared.selectedParticipantId).toBe("guard");
    expect(cleared.selectedStep).toBe("phase_1_damage");
    expect(cleared.participants[0]?.attackResults.phase1).toEqual(result);
    expect(cleared.phaseResolutionResults[0]?.parryResolution).toMatchObject({
      status: "resolved",
      success: false,
    });
    expect(cleared.phaseResolutionResults[0]?.damageProposal.proposedEffects).toEqual([]);
    expect(cleared.phaseResolutionResults[0]?.damageRoll.status).toBe("pending");
    expect(
      getCombatRoundParticipantPhaseStepStatus({
        participantId: "guard",
        state: cleared,
        step: "phase_1_damage",
      }),
    ).toBe("pending");
  });

  it("records and undoes D1 damage result commands after failed parry", () => {
    const state = initializeCombatRoundPhaseResolutionCursor({
      phase: "phase1",
      state: setCombatRoundParticipantInitiative({
        initiative: { baseInitiative: 0, modifierAdjustment: 0, rolls: [6], rollTotal: 6, total: 6 },
        participantId: "gladiator",
        phase: "phase1",
        state: setCombatRoundParticipantInitiative({
          initiative: {
            baseInitiative: 0,
            modifierAdjustment: 0,
            rolls: [4],
            rollTotal: 4,
            total: 4,
          },
          participantId: "guard",
          phase: "phase1",
          state: declareRoundAction({
            actionId: "attack_parry",
            participantId: "guard",
            state: declareRoundAction({
              actionId: "attack_parry",
              participantId: "gladiator",
              state: initializeCombatRoundState({ encounter: encounter() }),
            }),
          }),
        }),
      }),
      updatedAt: "2026-01-01T00:02:00.000Z",
    });
    const result = buildCombatRoundAttackRollResult({
      actionId: "attack_parry",
      attackerParticipantId: "gladiator",
      defenderDb: 10,
      defenderParticipantId: "guard",
      ob: 10,
      phase: "phase1",
      rollD20: 12,
      rollTotal: 12,
      rolledAt: "2026-01-01T00:03:00.000Z",
      weaponName: "Broad sword",
    });
    const afterAttack = recordCombatRoundAttackResult({
      command: {
        createdAt: result.rolledAt,
        createdByUserId: "gm-1",
      },
      participantId: "gladiator",
      result,
      state,
      submittedBy: "gm",
    });
    const afterParry = recordCombatRoundParryResult({
      attackResult: result,
      command: {
        createdAt: "2026-01-01T00:04:00.000Z",
        createdByUserId: "gm-1",
      },
      parryResolution: {
        combinedParryScore: 9,
        modifierAdjustment: 0,
        openEndedD10s: [],
        resultLabel: "Parry failed",
        rollD20: 8,
        rollTotal: 8,
        status: "resolved",
        success: false,
        targetNumber: 21,
        total: 17,
      },
      state: afterAttack,
      submittedBy: "gm",
      updatedAt: "2026-01-01T00:04:00.000Z",
    });
    const afterDamage = recordCombatRoundDamageResult({
      attackResult: result,
      command: {
        createdAt: "2026-01-01T00:05:00.000Z",
        createdByUserId: "gm-1",
      },
      defenderDm: 0,
      dmb: 8,
      state: afterParry,
      submittedBy: "gm",
      updatedAt: "2026-01-01T00:05:00.000Z",
    });
    const cleared = clearCombatRoundStep({
      state: {
        ...afterDamage,
        selectedParticipantId: "gladiator",
        selectedStep: "initiative_phase_1",
      },
      step: "initiative_phase_1",
    });

    expect(afterDamage.commands.at(-1)).toMatchObject({
      afterCursor: {
        participantId: "guard",
        roundNumber: 3,
        step: "D1",
      },
      beforeCursor: {
        participantId: "guard",
        roundNumber: 3,
        step: "D1",
      },
      facts: expect.objectContaining({
        attackResultId: "3:phase1:gladiator:guard",
        attackerParticipantId: "gladiator",
        damageResultId: "3:phase1:gladiator:guard:damage",
        defenderParticipantId: "guard",
        status: "resolved",
        totalDamage: 9,
      }),
      participantId: "guard",
      phase: "phase1",
      step: "D1",
      type: "resolve_damage",
    });
    expect(afterDamage.phaseResolutionResults[0]?.damageResult).toMatchObject({
      armorModifier: 0,
      attackResultId: "3:phase1:gladiator:guard",
      attackerParticipantId: "gladiator",
      defenderDm: 0,
      defenderParticipantId: "guard",
      dmb: 8,
      grazing: false,
      kind: "damage_result",
      lookupTotal: 12,
      tableDamageModifier: 1,
      totalDamage: 9,
      weaponName: "Broad sword",
    });
    expect(afterDamage.phaseResolutionResults[0]?.damageRoll).toMatchObject({
      status: "rolled",
      total: 9,
    });
    expect(afterDamage.phaseResolutionResults[0]?.damageProposal.status).toBe("drafted");
    expect(afterDamage.phaseResolutionResults[0]?.damageProposal.proposedEffects).toEqual([]);
    expect(
      getCombatRoundParticipantPhaseStepStatus({
        participantId: "guard",
        state: afterDamage,
        step: "phase_1_damage",
      }),
    ).toBe("ready");
    expect(cleared.commands.at(-1)).toMatchObject({
      participantId: "guard",
      type: "roll_parry",
    });
    expect(cleared.currentCursor).toEqual({
      participantId: "guard",
      roundNumber: 3,
      step: "D1",
    });
    expect(cleared.currentStep).toBe("phase_1_damage");
    expect(cleared.selectedParticipantId).toBe("guard");
    expect(cleared.selectedStep).toBe("phase_1_damage");
    expect(cleared.participants[0]?.attackResults.phase1).toEqual(result);
    expect(cleared.phaseResolutionResults[0]?.parryResolution).toMatchObject({
      status: "resolved",
      success: false,
    });
    expect(cleared.phaseResolutionResults[0]?.damageResult).toBeUndefined();
    expect(cleared.phaseResolutionResults[0]?.damageRoll.status).toBe("pending");
    expect(cleared.phaseResolutionResults[0]?.damageProposal.proposedEffects).toEqual([]);
  });

  it("records D1 damage results for refreshed 17/18 hit rows", () => {
    const state = initializeCombatRoundPhaseResolutionCursor({
      phase: "phase1",
      state: declareRoundAction({
        actionId: "attack_parry",
        participantId: "gladiator",
        state: initializeCombatRoundState({ encounter: encounter() }),
      }),
      updatedAt: "2026-01-01T00:02:00.000Z",
    });
    const result = buildCombatRoundAttackRollResult({
      actionId: "attack_parry",
      attackerParticipantId: "gladiator",
      defenderDb: 10,
      defenderParticipantId: "guard",
      ob: 10,
      phase: "phase1",
      rollD20: 17,
      rollTotal: 17,
      rolledAt: "2026-01-01T00:03:00.000Z",
      weaponName: "Broad sword",
    });
    const afterAttack = recordCombatRoundAttackResult({
      participantId: "gladiator",
      result,
      state,
      submittedBy: "gm",
    });
    const afterParry = recordCombatRoundParryResult({
      attackResult: result,
      parryResolution: {
        combinedParryScore: 9,
        modifierAdjustment: 0,
        openEndedD10s: [],
        resultLabel: "Parry failed",
        rollD20: 8,
        rollTotal: 8,
        status: "resolved",
        success: false,
        targetNumber: 21,
        total: 17,
      },
      state: afterAttack,
      submittedBy: "gm",
      updatedAt: "2026-01-01T00:04:00.000Z",
    });

    const afterDamage = recordCombatRoundDamageResult({
      attackResult: result,
      command: {
        createdAt: "2026-01-01T00:05:00.000Z",
        createdByUserId: "gm-1",
      },
      defenderDm: 0,
      dmb: 8,
      state: afterParry,
      submittedBy: "gm",
      updatedAt: "2026-01-01T00:05:00.000Z",
    });

    expect(result.lookupTotal).toBe(17);
    expect(afterDamage.phaseResolutionResults[0]?.damageResult).toMatchObject({
      damageRoll: {
        required: false,
      },
      lookupTotal: 17,
      tableDamageModifier: 4,
      totalDamage: 12,
    });
    expect(afterDamage.commands.at(-1)).toMatchObject({
      facts: expect.objectContaining({
        totalDamage: 12,
      }),
      type: "resolve_damage",
    });
  });

  it("records and undoes grazing D1 damage rolls after failed parry", () => {
    const state = initializeCombatRoundPhaseResolutionCursor({
      phase: "phase1",
      state: setCombatRoundParticipantInitiative({
        initiative: { baseInitiative: 0, modifierAdjustment: 0, rolls: [6], rollTotal: 6, total: 6 },
        participantId: "gladiator",
        phase: "phase1",
        state: declareRoundAction({
          actionId: "attack_parry",
          participantId: "gladiator",
          state: initializeCombatRoundState({ encounter: encounter() }),
        }),
      }),
      updatedAt: "2026-01-01T00:02:00.000Z",
    });
    const result = buildCombatRoundAttackRollResult({
      actionId: "attack_parry",
      attackerParticipantId: "gladiator",
      defenderDb: 10,
      defenderParticipantId: "guard",
      ob: 10,
      phase: "phase1",
      rollD20: 11,
      rollTotal: 11,
      rolledAt: "2026-01-01T00:03:00.000Z",
      weaponName: "Broad sword",
    });
    const afterAttack = recordCombatRoundAttackResult({
      command: {
        createdAt: result.rolledAt,
        createdByUserId: "gm-1",
      },
      participantId: "gladiator",
      result,
      state,
      submittedBy: "gm",
    });
    const afterParry = recordCombatRoundParryResult({
      attackResult: result,
      command: {
        createdAt: "2026-01-01T00:04:00.000Z",
        createdByUserId: "gm-1",
      },
      parryResolution: {
        combinedParryScore: 9,
        modifierAdjustment: 0,
        openEndedD10s: [],
        resultLabel: "Parry failed",
        rollD20: 8,
        rollTotal: 8,
        status: "resolved",
        success: false,
        targetNumber: 21,
        total: 17,
      },
      state: afterAttack,
      submittedBy: "gm",
      updatedAt: "2026-01-01T00:04:00.000Z",
    });
    const afterDamage = recordCombatRoundDamageResult({
      attackResult: result,
      command: {
        createdAt: "2026-01-01T00:05:00.000Z",
        createdByUserId: "gm-1",
      },
      defenderDm: 0,
      dmb: 8,
      rng: () => 0,
      state: afterParry,
      submittedBy: "gm",
      updatedAt: "2026-01-01T00:05:00.000Z",
    });
    const cleared = clearCombatRoundStep({
      state: afterDamage,
      step: "phase_1_damage",
    });

    expect(result.lookupTotal).toBe(11);
    expect(result.grazing).toBe(true);
    expect(afterDamage.phaseResolutionResults[0]?.damageResult).toMatchObject({
      damageRoll: {
        derivedFromLookupTotal: 12,
        derivedNormalDamageTotal: 9,
        diceExpression: "1d9",
        required: true,
        rolls: [1],
        total: 1,
      },
      dmb: 8,
      grazing: true,
      lookupTotal: 11,
      tableDamageModifier: 0,
      totalDamage: 1,
    });
    expect(afterDamage.commands.at(-1)).toMatchObject({
      facts: expect.objectContaining({
        totalDamage: 1,
      }),
      type: "resolve_damage",
    });
    expect(cleared.currentCursor).toEqual({
      participantId: "guard",
      roundNumber: 3,
      step: "D1",
    });
    expect(cleared.phaseResolutionResults[0]?.parryResolution).toMatchObject({
      status: "resolved",
      success: false,
    });
    expect(cleared.phaseResolutionResults[0]?.damageResult).toBeUndefined();
    expect(cleared.phaseResolutionResults[0]?.damageRoll.status).toBe("pending");
  });

  it("uses at least a 1-sided grazing damage die with no DMB, DM, or armor modifier", () => {
    const result = buildCombatRoundAttackRollResult({
      actionId: "attack_parry",
      attackerParticipantId: "gladiator",
      defenderDb: 10,
      defenderParticipantId: "guard",
      ob: 10,
      phase: "phase1",
      rollD20: 11,
      rollTotal: 11,
      rolledAt: "2026-01-01T00:03:00.000Z",
      weaponName: "Broad sword",
    });
    const damageResult = buildCombatRoundDamageResult({
      armorModifier: 0,
      attackResult: result,
      createdAt: "2026-01-01T00:05:00.000Z",
      defenderDm: 0,
      dmb: 0,
      rng: () => 0,
      roundNumber: 3,
    });

    expect(damageResult).toMatchObject({
      damageRoll: {
        derivedFromLookupTotal: 12,
        derivedNormalDamageTotal: 1,
        diceExpression: "1d1",
        required: true,
        rolls: [1],
        total: 1,
      },
      grazing: true,
      tableDamageModifier: 0,
      totalDamage: 1,
    });
  });

  it("commits D1 damage rows and clears commit before clearing the proposal", () => {
    const state = initializeCombatRoundPhaseResolutionCursor({
      phase: "phase1",
      state: setCombatRoundParticipantInitiative({
        initiative: { baseInitiative: 0, modifierAdjustment: 0, rolls: [6], rollTotal: 6, total: 6 },
        participantId: "gladiator",
        phase: "phase1",
        state: declareRoundAction({
          actionId: "attack_parry",
          participantId: "gladiator",
          state: initializeCombatRoundState({ encounter: encounter() }),
        }),
      }),
      updatedAt: "2026-01-01T00:02:00.000Z",
    });
    const result = buildCombatRoundAttackRollResult({
      actionId: "attack_parry",
      attackerParticipantId: "gladiator",
      defenderDb: 10,
      defenderParticipantId: "guard",
      ob: 10,
      phase: "phase1",
      rollD20: 12,
      rollTotal: 12,
      rolledAt: "2026-01-01T00:03:00.000Z",
      weaponName: "Broad sword",
    });
    const afterAttack = recordCombatRoundAttackResult({
      command: {
        createdAt: result.rolledAt,
        createdByUserId: "gm-1",
      },
      participantId: "gladiator",
      result,
      state,
      submittedBy: "gm",
    });
    const afterParry = recordCombatRoundParryResult({
      attackResult: result,
      command: {
        createdAt: "2026-01-01T00:04:00.000Z",
        createdByUserId: "gm-1",
      },
      parryResolution: {
        combinedParryScore: 9,
        modifierAdjustment: 0,
        openEndedD10s: [],
        resultLabel: "Parry failed",
        rollD20: 8,
        rollTotal: 8,
        status: "resolved",
        success: false,
        targetNumber: 21,
        total: 17,
      },
      state: afterAttack,
      submittedBy: "gm",
      updatedAt: "2026-01-01T00:04:00.000Z",
    });
    const afterDamage = recordCombatRoundDamageResult({
      attackResult: result,
      command: {
        createdAt: "2026-01-01T00:05:00.000Z",
        createdByUserId: "gm-1",
      },
      defenderDm: 0,
      dmb: 8,
      state: afterParry,
      submittedBy: "gm",
      updatedAt: "2026-01-01T00:05:00.000Z",
    });
    const existingCombatEffects: CombatEffectsState = {
      effects: [
        {
          createdAt: "2026-01-01T00:00:00.000Z",
          damage: 0,
          effectGroup: "general",
          generalDamage: 0,
          id: "existing-stun",
          modifierValue: -1,
          sourceEventId: "existing-event",
          status: "active",
          targetParticipantId: "scenario-guard",
          type: "stun",
          updatedAt: "2026-01-01T00:00:00.000Z",
        },
      ],
      events: [
        {
          createdAt: "2026-01-01T00:00:00.000Z",
          description: "",
          id: "existing-event",
          sourceLabel: "Existing effect",
          sourceType: "manual",
          targetParticipantId: "scenario-guard",
        },
      ],
    };
    const committed = commitCombatRoundPhaseDamage({
      attackerScenarioParticipantId: "scenario-gladiator",
      command: {
        commandId: "commit-d1",
        createdAt: "2026-01-01T00:06:00.000Z",
        createdByUserId: "gm-1",
      },
      combatEffects: existingCombatEffects,
      defenderScenarioParticipantId: "scenario-guard",
      encounterId: "encounter-1",
      scenarioId: "scenario-1",
      state: afterDamage,
    });
    const commitCommand = committed.command;
    const expectedCommitEventId =
      "commit-d1:r3:phase1:3-phase1-gladiator-guard:3-phase1-gladiator-guard-damage:combat-effect-event";
    const expectedCommitEffectId =
      "commit-d1:r3:phase1:3-phase1-gladiator-guard:3-phase1-gladiator-guard-damage:combat-effect:general-damage";
    const clearedCommitState = clearCombatRoundStep({
      state: {
        ...committed.state,
        selectedParticipantId: "gladiator",
        selectedStep: "initiative_phase_1",
      },
      step: "initiative_phase_1",
    });
    const cleanedCombatEffects = removeCombatRoundCommittedDamageEffects({
      combatEffects: committed.combatEffects,
      command: commitCommand,
    });
    const clearedProposalState = clearCombatRoundStep({
      state: clearedCommitState,
      step: "phase_1_damage",
    });

    expect(afterDamage.phaseResolutionResults[0]?.damageProposal.status).toBe("drafted");
    expect(committed.command).toMatchObject({
      beforeCursor: {
        participantId: "guard",
        roundNumber: 3,
        step: "D1",
      },
      facts: expect.objectContaining({
        attackResultId: "3:phase1:gladiator:guard",
        attackerParticipantId: "gladiator",
        createdCombatEffectEventId: expectedCommitEventId,
        createdCombatEffectIds: [expectedCommitEffectId],
        damageResultId: "3:phase1:gladiator:guard:damage",
        defenderParticipantId: "guard",
        status: "committed",
        totalDamage: 9,
      }),
      participantId: "guard",
      phase: "phase1",
      step: "D1",
      type: "commit_phase_damage",
    });
    expect(committed.combatEffects.events).toContainEqual(
      expect.objectContaining({
        id: expectedCommitEventId,
        sourceActorId: "scenario-gladiator",
        sourceType: "combat_action",
        targetParticipantId: "scenario-guard",
      }),
    );
    expect(committed.combatEffects.effects).toContainEqual(
      expect.objectContaining({
        generalDamage: 9,
        id: expectedCommitEffectId,
        sourceEventId: expectedCommitEventId,
        status: "active",
        targetParticipantId: "scenario-guard",
        type: "general_damage",
      }),
    );
    expect(committed.state.phaseResolutionResults[0]?.damageProposal).toMatchObject({
      committedCombatEffectEventId: expectedCommitEventId,
      committedCombatEffectIds: [expectedCommitEffectId],
      status: "committed",
    });
    expect(clearedCommitState.commands.at(-1)).toMatchObject({
      type: "resolve_damage",
    });
    expect(clearedCommitState.currentCursor).toEqual({
      participantId: "guard",
      roundNumber: 3,
      step: "D1",
    });
    expect(clearedCommitState.phaseResolutionResults[0]?.damageResult).toBeDefined();
    expect(clearedCommitState.phaseResolutionResults[0]?.damageProposal.status).toBe("drafted");
    expect(cleanedCombatEffects.effects).toContainEqual(
      expect.objectContaining({
        id: "existing-stun",
        sourceEventId: "existing-event",
        status: "active",
      }),
    );
    expect(cleanedCombatEffects.effects).not.toContainEqual(
      expect.objectContaining({ id: expectedCommitEffectId }),
    );
    expect(cleanedCombatEffects.events).toContainEqual(
      expect.objectContaining({
        id: "existing-event",
        sourceLabel: "Existing effect",
      }),
    );
    expect(cleanedCombatEffects.events).not.toContainEqual(
      expect.objectContaining({ id: expectedCommitEventId }),
    );
    expect(clearedProposalState.commands.at(-1)).toMatchObject({
      type: "roll_parry",
    });
    expect(clearedProposalState.phaseResolutionResults[0]?.damageResult).toBeUndefined();
    expect(clearedProposalState.phaseResolutionResults[0]?.damageRoll.status).toBe("pending");
  });

  it("commits D2 damage rows and clears commit before clearing the proposal", () => {
    const state = initializeCombatRoundPhaseResolutionCursor({
      phase: "phase2",
      state: setCombatRoundParticipantInitiative({
        initiative: { baseInitiative: 0, modifierAdjustment: 0, rolls: [6], rollTotal: 6, total: 6 },
        participantId: "guard",
        phase: "phase2",
        state: declareRoundAction({
          actionId: "parry_attack",
          participantId: "guard",
          state: initializeCombatRoundState({ encounter: encounter() }),
        }),
      }),
      updatedAt: "2026-01-01T00:02:00.000Z",
    });
    const result = buildCombatRoundAttackRollResult({
      actionId: "parry_attack",
      attackerParticipantId: "guard",
      defenderDb: 10,
      defenderParticipantId: "gladiator",
      ob: 10,
      phase: "phase2",
      rollD20: 12,
      rollTotal: 12,
      rolledAt: "2026-01-01T00:03:00.000Z",
      weaponName: "Long sword",
    });
    const afterAttack = recordCombatRoundAttackResult({
      command: {
        createdAt: result.rolledAt,
        createdByUserId: "gm-1",
      },
      participantId: "guard",
      result,
      state,
      submittedBy: "gm",
    });
    const afterParry = recordCombatRoundParryResult({
      attackResult: result,
      command: {
        createdAt: "2026-01-01T00:04:00.000Z",
        createdByUserId: "gm-1",
      },
      parryResolution: {
        combinedParryScore: 9,
        modifierAdjustment: 0,
        openEndedD10s: [],
        resultLabel: "Parry failed",
        rollD20: 8,
        rollTotal: 8,
        status: "resolved",
        success: false,
        targetNumber: 21,
        total: 17,
      },
      state: afterAttack,
      submittedBy: "gm",
      updatedAt: "2026-01-01T00:04:00.000Z",
    });
    const afterDamage = recordCombatRoundDamageResult({
      attackResult: result,
      command: {
        createdAt: "2026-01-01T00:05:00.000Z",
        createdByUserId: "gm-1",
      },
      defenderDm: 0,
      dmb: 8,
      state: afterParry,
      submittedBy: "gm",
      updatedAt: "2026-01-01T00:05:00.000Z",
    });
    const committed = commitCombatRoundPhaseDamage({
      attackerScenarioParticipantId: "scenario-guard",
      command: {
        commandId: "commit-d2",
        createdAt: "2026-01-01T00:06:00.000Z",
        createdByUserId: "gm-1",
      },
      defenderScenarioParticipantId: "scenario-gladiator",
      encounterId: "encounter-1",
      scenarioId: "scenario-1",
      state: afterDamage,
    });
    const expectedCommitEventId =
      "commit-d2:r3:phase2:3-phase2-guard-gladiator:3-phase2-guard-gladiator-damage:combat-effect-event";
    const expectedCommitEffectId =
      "commit-d2:r3:phase2:3-phase2-guard-gladiator:3-phase2-guard-gladiator-damage:combat-effect:general-damage";
    const clearedCommitState = clearCombatRoundStep({
      state: committed.state,
      step: "phase_2_damage",
    });
    const cleanedCombatEffects = removeCombatRoundCommittedDamageEffects({
      combatEffects: committed.combatEffects,
      command: committed.command,
    });

    expect(afterDamage.phaseResolutionResults[0]?.damageProposal.status).toBe("drafted");
    expect(committed.command).toMatchObject({
      beforeCursor: {
        participantId: "gladiator",
        roundNumber: 3,
        step: "D2",
      },
      facts: expect.objectContaining({
        attackResultId: "3:phase2:guard:gladiator",
        attackerParticipantId: "guard",
        createdCombatEffectEventId: expectedCommitEventId,
        createdCombatEffectIds: [expectedCommitEffectId],
        damageResultId: "3:phase2:guard:gladiator:damage",
        defenderParticipantId: "gladiator",
        status: "committed",
        totalDamage: 9,
      }),
      participantId: "gladiator",
      phase: "phase2",
      step: "D2",
      type: "commit_phase_damage",
    });
    expect(committed.combatEffects.effects).toContainEqual(
      expect.objectContaining({
        generalDamage: 9,
        id: expectedCommitEffectId,
        sourceEventId: expectedCommitEventId,
        status: "active",
        targetParticipantId: "scenario-gladiator",
        type: "general_damage",
      }),
    );
    expect(committed.state.phaseResolutionResults[0]?.damageProposal).toMatchObject({
      committedCombatEffectEventId: expectedCommitEventId,
      committedCombatEffectIds: [expectedCommitEffectId],
      status: "committed",
    });
    expect(clearedCommitState.commands.at(-1)).toMatchObject({
      type: "resolve_damage",
    });
    expect(clearedCommitState.currentCursor).toEqual({
      participantId: "gladiator",
      roundNumber: 3,
      step: "D2",
    });
    expect(clearedCommitState.phaseResolutionResults[0]?.damageResult).toBeDefined();
    expect(clearedCommitState.phaseResolutionResults[0]?.damageProposal.status).toBe("drafted");
    expect(cleanedCombatEffects).toEqual({ effects: [], events: [] });
  });

  it("records and undoes D2 placeholder damage review commands after failed parry", () => {
    const state = initializeCombatRoundPhaseResolutionCursor({
      phase: "phase2",
      state: setCombatRoundParticipantInitiative({
        initiative: { baseInitiative: 0, modifierAdjustment: 0, rolls: [6], rollTotal: 6, total: 6 },
        participantId: "guard",
        phase: "phase2",
        state: declareRoundAction({
          actionId: "parry_attack",
          participantId: "guard",
          state: initializeCombatRoundState({ encounter: encounter() }),
        }),
      }),
      updatedAt: "2026-01-01T00:02:00.000Z",
    });
    const result = buildCombatRoundAttackRollResult({
      actionId: "parry_attack",
      attackerParticipantId: "guard",
      defenderDb: 10,
      defenderParticipantId: "gladiator",
      ob: 10,
      phase: "phase2",
      rollD20: 12,
      rollTotal: 12,
      rolledAt: "2026-01-01T00:03:00.000Z",
      weaponName: "Long sword",
    });
    const afterAttack = recordCombatRoundAttackResult({
      command: {
        createdAt: result.rolledAt,
        createdByUserId: "gm-1",
      },
      participantId: "guard",
      result,
      state,
      submittedBy: "gm",
    });
    const afterParry = recordCombatRoundParryResult({
      attackResult: result,
      command: {
        createdAt: "2026-01-01T00:04:00.000Z",
        createdByUserId: "gm-1",
      },
      parryResolution: {
        combinedParryScore: 9,
        modifierAdjustment: 0,
        openEndedD10s: [],
        resultLabel: "Parry failed",
        rollD20: 8,
        rollTotal: 8,
        status: "resolved",
        success: false,
        targetNumber: 21,
        total: 17,
      },
      state: afterAttack,
      submittedBy: "gm",
      updatedAt: "2026-01-01T00:04:00.000Z",
    });
    const afterDamageReview = recordCombatRoundDamageReviewPlaceholder({
      attackResult: result,
      command: {
        createdAt: "2026-01-01T00:05:00.000Z",
        createdByUserId: "gm-1",
      },
      state: afterParry,
      submittedBy: "gm",
      updatedAt: "2026-01-01T00:05:00.000Z",
    });
    const cleared = clearCombatRoundStep({
      state: afterDamageReview,
      step: "phase_2_damage",
    });

    expect(afterDamageReview.commands.at(-1)).toMatchObject({
      beforeCursor: {
        participantId: "gladiator",
        roundNumber: 3,
        step: "D2",
      },
      facts: expect.objectContaining({
        attackResultId: "3:phase2:guard:gladiator",
        status: "deferred",
      }),
      participantId: "gladiator",
      phase: "phase2",
      step: "D2",
      type: "complete_damage_review_phase2",
    });
    expect(
      getCombatRoundParticipantPhaseStepStatus({
        participantId: "gladiator",
        state: afterDamageReview,
        step: "phase_2_damage",
      }),
    ).toBe("gmEdited");
    expect(cleared.currentCursor).toEqual({
      participantId: "gladiator",
      roundNumber: 3,
      step: "D2",
    });
    expect(cleared.currentStep).toBe("phase_2_damage");
    expect(cleared.selectedParticipantId).toBe("gladiator");
    expect(cleared.selectedStep).toBe("phase_2_damage");
    expect(cleared.participants[1]?.attackResults.phase2).toEqual(result);
    expect(cleared.phaseResolutionResults[0]?.parryResolution).toMatchObject({
      status: "resolved",
      success: false,
    });
    expect(cleared.phaseResolutionResults[0]?.damageRoll.status).toBe("pending");
    expect(
      getCombatRoundParticipantPhaseStepStatus({
        participantId: "gladiator",
        state: cleared,
        step: "phase_2_damage",
      }),
    ).toBe("pending");
  });

  it("committed P1 snapshots can include an attack result", () => {
    const state = advanceCombatRoundStep(
      advanceCombatRoundStep(
        advanceCombatRoundStep(initializeCombatRoundState({ encounter: encounter() })),
      ),
    );
    const result = buildCombatRoundAttackRollResult({
      actionId: "attack_parry",
      attackerParticipantId: "gladiator",
      defenderDb: 10,
      defenderParticipantId: "guard",
      ob: 10,
      phase: "phase1",
      rollD20: 10,
      rollTotal: 10,
      rolledAt: "2026-01-01T00:03:00.000Z",
      weaponName: "Broad sword",
    });
    const advanced = advanceCombatRoundStep(state, {
      stepSnapshots: [
        stepSnapshot({
          actionResultSummary: "Main: Broad sword OB 10 - DB 10 + roll 10 = 10\nResult: Miss",
          attackResult: result,
          participantId: "gladiator",
          phase: "phase1",
          step: "phase_1_actions",
        }),
      ],
    });

    expect(
      getCombatRoundStepSnapshot({
        participantId: "gladiator",
        state: advanced,
        step: "phase_1_actions",
      }),
    ).toMatchObject({
      attackResult: {
        hit: false,
        lookupTotal: 10,
        rollTotal: 10,
        tableResult: "Miss",
      },
      participantId: "gladiator",
      phase: "phase1",
      step: "phase_1_actions",
    });
  });

  it("clears P1 attack result, snapshot, and status without clearing declaration", () => {
    const state = advanceCombatRoundStep(
      advanceCombatRoundStep(
        advanceCombatRoundStep(
          recordCombatRoundDeclaration({
            declaration: {
              actionId: "attack_parry",
              movementId: "hold",
              roundNumber: 3,
            },
            participantId: "gladiator",
            state: initializeCombatRoundState({ encounter: encounter() }),
            submittedBy: "player",
          }),
        ),
      ),
    );
    const result = buildCombatRoundAttackRollResult({
      actionId: "attack_parry",
      attackerParticipantId: "gladiator",
      defenderDb: 10,
      defenderParticipantId: "guard",
      ob: 10,
      phase: "phase1",
      rollD20: 10,
      rollTotal: 10,
      rolledAt: "2026-01-01T00:03:00.000Z",
      weaponName: "Broad sword",
    });
    const withResult = recordCombatRoundAttackResult({
      participantId: "gladiator",
      result,
      state,
      submittedBy: "gm",
    });
    const withSnapshot = advanceCombatRoundStep(withResult, {
      stepSnapshots: [
        stepSnapshot({
          attackResult: result,
          participantId: "gladiator",
          phase: "phase1",
          step: "phase_1_actions",
        }),
      ],
    });
    const cleared = clearCombatRoundStep({
      state: withSnapshot,
      step: "phase_1_actions",
    });

    expect(cleared.participants[0]?.attackResults.phase1).toBeUndefined();
    expect(cleared.participants[0]?.declaration).toMatchObject({ actionId: "attack_parry" });
    expect(cleared.participants[0]?.stepStatuses.phase_1_actions).toBe("pending");
    expect(
      getCombatRoundStepSnapshot({
        participantId: "gladiator",
        state: cleared,
        step: "phase_1_actions",
      }),
    ).toBeUndefined();
  });

  it("builds and records P2 attack results with attacker and defender lookup", () => {
    const state = advanceToStep(
      initializeCombatRoundState({ encounter: encounter() }),
      "phase_2_actions",
    );
    const result = buildCombatRoundAttackRollResult({
      actionId: "parry_attack",
      attackerParticipantId: "gladiator",
      defenderDb: 14,
      defenderParticipantId: "guard",
      ob: 11,
      openEndedD10s: [7],
      phase: "phase2",
      rollD20: 20,
      rollTotal: 27,
      rolledAt: "2026-01-01T00:03:00.000Z",
      weaponName: "Long sword",
    });
    const nextState = recordCombatRoundAttackResult({
      participantId: "gladiator",
      result,
      state,
      submittedBy: "gm",
    });

    expect(result).toMatchObject({
      hit: true,
      lookupTotal: 24,
      phase: "phase2",
      tableResult: "Hit",
    });
    expect(nextState.participants[0]?.attackResults.phase2).toEqual(result);
    expect(nextState.participants[0]?.stepStatuses.phase_2_actions).toBe("gmEdited");
    expect(
      getCombatRoundAttackResultsForParticipantPhase({
        participantId: "gladiator",
        phase: "phase2",
        state: nextState,
      }).outgoing,
    ).toEqual(result);
    expect(
      getCombatRoundAttackResultsForParticipantPhase({
        participantId: "guard",
        phase: "phase2",
        state: nextState,
      }).incoming,
    ).toEqual([result]);
    expect(
      getCombatRoundOutgoingAttackResultForParticipantPhase({
        participantId: "gladiator",
        phase: "phase2",
        state: nextState,
      }),
    ).toEqual(result);
    expect(
      getCombatRoundDisplayIncomingAttackResultForParticipantPhase({
        participantId: "guard",
        phase: "phase2",
        state: nextState,
      }),
    ).toEqual(result);
    expect(
      getCombatRoundDisplayIncomingAttackResultForParticipantPhase({
        participantId: "gladiator",
        phase: "phase2",
        state: nextState,
      }),
    ).toBeUndefined();
  });

  it("clears P2 attack result, snapshot, and status without clearing declaration", () => {
    const state = advanceToStep(
      recordCombatRoundDeclaration({
        declaration: {
          actionId: "parry_attack",
          movementId: "hold",
          roundNumber: 3,
        },
        participantId: "gladiator",
        state: initializeCombatRoundState({ encounter: encounter() }),
        submittedBy: "player",
      }),
      "phase_2_actions",
    );
    const result = buildCombatRoundAttackRollResult({
      actionId: "parry_attack",
      attackerParticipantId: "gladiator",
      defenderDb: 14,
      defenderParticipantId: "guard",
      ob: 11,
      phase: "phase2",
      rollD20: 10,
      rollTotal: 10,
      rolledAt: "2026-01-01T00:03:00.000Z",
      weaponName: "Long sword",
    });
    const withResult = recordCombatRoundAttackResult({
      participantId: "gladiator",
      result,
      state,
      submittedBy: "gm",
    });
    const withSnapshot = advanceCombatRoundStep(withResult, {
      stepSnapshots: [
        stepSnapshot({
          attackResult: result,
          participantId: "gladiator",
          phase: "phase2",
          step: "phase_2_actions",
        }),
      ],
    });
    const cleared = clearCombatRoundStep({
      state: withSnapshot,
      step: "phase_2_actions",
    });

    expect(cleared.participants[0]?.attackResults.phase2).toBeUndefined();
    expect(cleared.participants[0]?.declaration).toMatchObject({ actionId: "parry_attack" });
    expect(cleared.participants[0]?.stepStatuses.phase_2_actions).toBe("pending");
    expect(
      getCombatRoundStepSnapshot({
        participantId: "gladiator",
        state: cleared,
        step: "phase_2_actions",
      }),
    ).toBeUndefined();
  });

  it("builds phase resolution scaffolds for misses and hits", () => {
    const miss = buildCombatRoundAttackRollResult({
      actionId: "attack_parry",
      attackerParticipantId: "gladiator",
      defenderDb: 10,
      defenderParticipantId: "guard",
      ob: 10,
      phase: "phase1",
      rollD20: 10,
      rollTotal: 10,
      rolledAt: "2026-01-01T00:03:00.000Z",
      weaponName: "Broad sword",
    });
    const hit = buildCombatRoundAttackRollResult({
      actionId: "attack_parry",
      attackerParticipantId: "gladiator",
      defenderDb: 10,
      defenderParticipantId: "guard",
      ob: 10,
      phase: "phase1",
      rollD20: 12,
      rollTotal: 12,
      rolledAt: "2026-01-01T00:03:00.000Z",
      weaponName: "Broad sword",
    });

    expect(
      buildCombatRoundPhaseResolutionResult({
        attackResult: miss,
        roundNumber: 3,
        updatedAt: "2026-01-01T00:04:00.000Z",
      }),
    ).toMatchObject({
      attackResultId: "3:phase1:gladiator:guard",
      damageProposal: { proposedEffects: [], status: "not_ready" },
      damageRoll: { status: "not_required" },
      parryResolution: { resultLabel: "Attack missed", status: "not_applicable" },
    });
    expect(
      buildCombatRoundPhaseResolutionResult({
        attackResult: hit,
        roundNumber: 3,
        updatedAt: "2026-01-01T00:04:00.000Z",
      }),
    ).toMatchObject({
      damageProposal: { proposedEffects: [], status: "not_ready" },
      damageRoll: { notes: "Awaiting parry resolution.", status: "pending" },
      parryResolution: { status: "pending" },
    });
  });

  it("creates and retrieves phase1 and phase2 resolution scaffolds from attack results", () => {
    const state = initializeCombatRoundState({ encounter: encounter() });
    const phase1Attack = buildCombatRoundAttackRollResult({
      actionId: "attack_parry",
      attackerParticipantId: "gladiator",
      defenderDb: 10,
      defenderParticipantId: "guard",
      ob: 10,
      phase: "phase1",
      rollD20: 11,
      rollTotal: 11,
      rolledAt: "2026-01-01T00:03:00.000Z",
      weaponName: "Broad sword",
    });
    const phase2Attack = buildCombatRoundAttackRollResult({
      actionId: "parry_attack",
      attackerParticipantId: "guard",
      defenderDb: 10,
      defenderParticipantId: "gladiator",
      ob: 10,
      phase: "phase2",
      rollD20: 10,
      rollTotal: 10,
      rolledAt: "2026-01-01T00:03:00.000Z",
      weaponName: "Long sword",
    });
    const withPhase1Attack = recordCombatRoundAttackResult({
      participantId: "gladiator",
      result: phase1Attack,
      state,
      submittedBy: "gm",
    });
    const withPhase2Attack = recordCombatRoundAttackResult({
      participantId: "guard",
      result: phase2Attack,
      state: withPhase1Attack,
      submittedBy: "gm",
    });
    const withPhase1Resolution = ensureCombatRoundPhaseResolutionResultsForPhase({
      phase: "phase1",
      state: withPhase2Attack,
      updatedAt: "2026-01-01T00:04:00.000Z",
    });
    const withBothResolutions = ensureCombatRoundPhaseResolutionResultsForPhase({
      phase: "phase2",
      state: withPhase1Resolution,
      updatedAt: "2026-01-01T00:05:00.000Z",
    });

    expect(getCombatRoundResolutionPhaseForStep("review_phase_2_actions")).toBe("phase1");
    expect(getCombatRoundResolutionPhaseForStep("review_phase_2_damage")).toBe("phase2");
    expect(withBothResolutions.phaseResolutionResults).toHaveLength(2);
    expect(
      getCombatRoundDisplayPhaseResolutionResultForParticipantPhase({
        participantId: "gladiator",
        phase: "phase1",
        state: withBothResolutions,
      }),
    ).toMatchObject({
      attackResultId: "3:phase1:gladiator:guard",
      parryResolution: { status: "pending" },
    });
    expect(
      getCombatRoundDisplayPhaseResolutionResultForParticipantPhase({
        participantId: "gladiator",
        phase: "phase2",
        state: withBothResolutions,
      }),
    ).toMatchObject({
      attackResultId: "3:phase2:guard:gladiator",
      damageRoll: { status: "not_required" },
      parryResolution: { status: "not_applicable" },
    });
  });

  it("stores resolved parry rolls with open-ended d20 breakdown", () => {
    const state = initializeCombatRoundState({ encounter: encounter() });
    const result = buildCombatRoundAttackRollResult({
      actionId: "attack_parry",
      attackerParticipantId: "gladiator",
      defenderDb: 10,
      defenderParticipantId: "guard",
      ob: 10,
      phase: "phase1",
      rollD20: 12,
      rollTotal: 12,
      rolledAt: "2026-01-01T00:03:00.000Z",
      weaponName: "Broad sword",
    });
    const withResult = recordCombatRoundAttackResult({
      participantId: "gladiator",
      result,
      state,
      submittedBy: "gm",
    });
    const withParry = recordCombatRoundParryResolution({
      attackResult: result,
      parryResolution: {
        combinedParryScore: 9,
        mainHandParryScore: 4,
        modifierAdjustment: -1,
        offHandParryScore: 5,
        openEndedD10s: [7],
        resultLabel: "Parry successful",
        rollD20: 20,
        rollTotal: 27,
        status: "resolved",
        success: true,
        targetNumber: 21,
        total: 35,
        usedMainHand: true,
        usedOffHand: true,
      },
      state: withResult,
      updatedAt: "2026-01-01T00:04:00.000Z",
    });

    expect(
      getCombatRoundDisplayPhaseResolutionResultForParticipantPhase({
        participantId: "gladiator",
        phase: "phase1",
        state: withParry,
      }),
    ).toMatchObject({
      damageProposal: { proposedEffects: [], status: "not_ready" },
      damageRoll: { status: "not_required" },
      parryResolution: {
        combinedParryScore: 9,
        modifierAdjustment: -1,
        openEndedD10s: [7],
        resultLabel: "Parry successful",
        rollD20: 20,
        rollTotal: 27,
        status: "resolved",
        success: true,
        targetNumber: 21,
        total: 35,
      },
    });
  });

  it("derives A1/P1/D1 markers from attack, parry, and damage state", () => {
    const state = initializeCombatRoundState({ encounter: encounter() });
    const hit = buildCombatRoundAttackRollResult({
      actionId: "attack_parry",
      attackerParticipantId: "gladiator",
      defenderDb: 10,
      defenderParticipantId: "guard",
      ob: 10,
      phase: "phase1",
      rollD20: 12,
      rollTotal: 12,
      rolledAt: "2026-01-01T00:03:00.000Z",
      weaponName: "Broad sword",
    });
    const miss = buildCombatRoundAttackRollResult({
      actionId: "attack_parry",
      attackerParticipantId: "gladiator",
      defenderDb: 10,
      defenderParticipantId: "guard",
      ob: 10,
      phase: "phase1",
      rollD20: 10,
      rollTotal: 10,
      rolledAt: "2026-01-01T00:03:00.000Z",
      weaponName: "Broad sword",
    });
    const afterHit = recordCombatRoundAttackResult({
      participantId: "gladiator",
      result: hit,
      state,
      submittedBy: "gm",
    });

    expect(
      getCombatRoundParticipantPhaseStepStatus({
        participantId: "gladiator",
        state: afterHit,
        step: "phase_1_actions",
      }),
    ).toBe("gmEdited");
    expect(
      getCombatRoundParticipantPhaseStepStatus({
        participantId: "guard",
        state: afterHit,
        step: "review_phase_2_actions",
      }),
    ).toBe("pending");
    expect(
      getCombatRoundParticipantPhaseStepStatus({
        participantId: "guard",
        state: afterHit,
        step: "phase_1_damage",
      }),
    ).toBe("pending");

    const afterSuccessfulParry = recordCombatRoundParryResolution({
      attackResult: hit,
      parryResolution: {
        combinedParryScore: 9,
        modifierAdjustment: 0,
        openEndedD10s: [],
        resultLabel: "Parry successful",
        rollD20: 12,
        rollTotal: 12,
        status: "resolved",
        success: true,
        targetNumber: 21,
        total: 21,
      },
      state: afterHit,
      updatedAt: "2026-01-01T00:04:00.000Z",
    });

    expect(
      getCombatRoundParticipantPhaseStepStatus({
        participantId: "guard",
        state: afterSuccessfulParry,
        step: "review_phase_2_actions",
      }),
    ).toBe("complete");
    expect(
      getCombatRoundParticipantPhaseStepStatus({
        participantId: "guard",
        state: afterSuccessfulParry,
        step: "phase_1_damage",
      }),
    ).toBe("skipped");

    const afterFailedParry = recordCombatRoundParryResolution({
      attackResult: hit,
      parryResolution: {
        combinedParryScore: 9,
        modifierAdjustment: 0,
        openEndedD10s: [],
        resultLabel: "Parry failed",
        rollD20: 8,
        rollTotal: 8,
        status: "resolved",
        success: false,
        targetNumber: 21,
        total: 17,
      },
      state: afterHit,
      updatedAt: "2026-01-01T00:04:00.000Z",
    });

    expect(
      getCombatRoundParticipantPhaseStepStatus({
        participantId: "guard",
        state: afterFailedParry,
        step: "review_phase_2_actions",
      }),
    ).toBe("complete");
    expect(
      getCombatRoundParticipantPhaseStepStatus({
        participantId: "guard",
        state: afterFailedParry,
        step: "phase_1_damage",
      }),
    ).toBe("pending");

    const afterMiss = recordCombatRoundAttackResult({
      participantId: "gladiator",
      result: miss,
      state,
      submittedBy: "gm",
    });

    expect(
      getCombatRoundParticipantPhaseStepStatus({
        participantId: "guard",
        state: afterMiss,
        step: "review_phase_2_actions",
      }),
    ).toBe("skipped");
    expect(
      getCombatRoundParticipantPhaseStepStatus({
        participantId: "guard",
        state: afterMiss,
        step: "phase_1_damage",
      }),
    ).toBe("skipped");
  });

  it("clears P1 parry without clearing the A1 attack result", () => {
    const state = initializeCombatRoundState({ encounter: encounter() });
    const result = buildCombatRoundAttackRollResult({
      actionId: "attack_parry",
      attackerParticipantId: "gladiator",
      defenderDb: 10,
      defenderParticipantId: "guard",
      ob: 10,
      phase: "phase1",
      rollD20: 12,
      rollTotal: 12,
      rolledAt: "2026-01-01T00:03:00.000Z",
      weaponName: "Broad sword",
    });
    const withResult = recordCombatRoundAttackResult({
      participantId: "gladiator",
      result,
      state,
      submittedBy: "gm",
    });
    const withResolution = ensureCombatRoundPhaseResolutionResultsForPhase({
      phase: "phase1",
      state: withResult,
      updatedAt: "2026-01-01T00:04:00.000Z",
    });
    const withResolvedParry = recordCombatRoundParryResolution({
      attackResult: result,
      parryResolution: {
        combinedParryScore: 9,
        modifierAdjustment: 0,
        openEndedD10s: [],
        resultLabel: "Parry failed",
        rollD20: 8,
        rollTotal: 8,
        status: "resolved",
        success: false,
        targetNumber: 21,
        total: 17,
      },
      state: withResolution,
      updatedAt: "2026-01-01T00:05:00.000Z",
    });
    const withSnapshot = advanceCombatRoundStep(withResolution, {
      stepSnapshots: [
        stepSnapshot({
          attackResult: result,
          participantId: "gladiator",
          phase: "phase1",
          step: "phase_1_actions",
        }),
        stepSnapshot({
          attackResult: result,
          participantId: "guard",
          phase: "phase1",
          phaseResolutionResult: withResolution.phaseResolutionResults[0],
          step: "review_phase_2_actions",
        }),
        stepSnapshot({
          attackResult: result,
          participantId: "guard",
          phase: "phase1",
          phaseResolutionResult: withResolution.phaseResolutionResults[0],
          step: "phase_1_damage",
        }),
      ],
    });
    const cleared = clearCombatRoundStep({
      state: {
        ...withSnapshot,
        phaseResolutionResults: withResolvedParry.phaseResolutionResults,
        selectedParticipantId: "guard",
        selectedStep: "review_phase_2_actions",
      },
      step: "review_phase_2_actions",
    });

    expect(cleared.participants[0]?.attackResults.phase1).toEqual(result);
    expect(cleared.phaseResolutionResults).toHaveLength(1);
    expect(cleared.phaseResolutionResults[0]?.parryResolution.status).toBe("pending");
    expect(cleared.phaseResolutionResults[0]?.damageRoll.status).toBe("pending");
    expect(cleared.participants[1]?.stepStatuses.review_phase_2_actions).toBe("pending");
    expect(
      getCombatRoundStepSnapshot({
        participantId: "gladiator",
        state: cleared,
        step: "phase_1_actions",
      }),
    ).toMatchObject({
      attackResult: result,
      step: "phase_1_actions",
    });
    expect(
      getCombatRoundStepSnapshot({
        participantId: "guard",
        state: cleared,
        step: "review_phase_2_actions",
      }),
    ).toBeUndefined();
    expect(
      getCombatRoundStepSnapshot({
        participantId: "guard",
        state: cleared,
        step: "phase_1_damage",
      }),
    ).toBeUndefined();
  });

  it("clears A1 attack result and its downstream P1/D1 resolution", () => {
    const state = initializeCombatRoundState({ encounter: encounter() });
    const result = buildCombatRoundAttackRollResult({
      actionId: "attack_parry",
      attackerParticipantId: "gladiator",
      defenderDb: 10,
      defenderParticipantId: "guard",
      ob: 10,
      phase: "phase1",
      rollD20: 12,
      rollTotal: 12,
      rolledAt: "2026-01-01T00:03:00.000Z",
      weaponName: "Broad sword",
    });
    const withResult = recordCombatRoundAttackResult({
      participantId: "gladiator",
      result,
      state,
      submittedBy: "gm",
    });
    const withResolution = ensureCombatRoundPhaseResolutionResultsForPhase({
      phase: "phase1",
      state: withResult,
      updatedAt: "2026-01-01T00:04:00.000Z",
    });
    const withSnapshot = advanceCombatRoundStep(withResolution, {
      stepSnapshots: [
        stepSnapshot({
          attackResult: result,
          participantId: "gladiator",
          phase: "phase1",
          step: "phase_1_actions",
        }),
        stepSnapshot({
          attackResult: result,
          participantId: "guard",
          phase: "phase1",
          phaseResolutionResult: withResolution.phaseResolutionResults[0],
          step: "review_phase_2_actions",
        }),
        stepSnapshot({
          participantId: "guard",
          phase: "phase1",
          step: "phase_1_actions",
        }),
      ],
    });
    const cleared = clearCombatRoundStep({
      state: withSnapshot,
      step: "phase_1_actions",
    });

    expect(cleared.participants[0]?.attackResults.phase1).toBeUndefined();
    expect(cleared.phaseResolutionResults).toEqual([]);
    expect(cleared.participants[0]?.stepStatuses.phase_1_actions).toBe("pending");
    expect(cleared.participants[1]?.stepStatuses.review_phase_2_actions).toBe("pending");
    expect(cleared.participants[1]?.stepStatuses.phase_1_damage).toBe("pending");
    expect(
      getCombatRoundStepSnapshot({
        participantId: "gladiator",
        state: cleared,
        step: "phase_1_actions",
      }),
    ).toBeUndefined();
    expect(
      getCombatRoundStepSnapshot({
        participantId: "guard",
        state: cleared,
        step: "review_phase_2_actions",
      }),
    ).toBeUndefined();
    expect(
      getCombatRoundStepSnapshot({
        participantId: "guard",
        state: cleared,
        step: "phase_1_actions",
      }),
    ).toMatchObject({
      participantId: "guard",
      step: "phase_1_actions",
    });
  });

  it("undoes a command-backed A1 hit from the auto-opened defender P1 cell", () => {
    const state = initializeCombatRoundPhaseResolutionCursor({
      phase: "phase1",
      state: declareRoundAction({
        actionId: "attack_parry",
        participantId: "gladiator",
        state: initializeCombatRoundState({ encounter: encounter() }),
      }),
      updatedAt: "2026-01-01T00:02:00.000Z",
    });
    const result = buildCombatRoundAttackRollResult({
      actionId: "attack_parry",
      attackerParticipantId: "gladiator",
      defenderDb: 10,
      defenderParticipantId: "guard",
      ob: 10,
      phase: "phase1",
      rollD20: 12,
      rollTotal: 12,
      rolledAt: "2026-01-01T00:03:00.000Z",
      weaponName: "Broad sword",
    });
    const afterAttack = recordCombatRoundAttackResult({
      command: {
        createdAt: result.rolledAt,
        createdByUserId: "gm-1",
      },
      participantId: "gladiator",
      result,
      state,
      submittedBy: "gm",
    });
    const withResolution = ensureCombatRoundPhaseResolutionResultsForPhase({
      phase: "phase1",
      state: afterAttack,
      updatedAt: "2026-01-01T00:04:00.000Z",
    });
    const withSnapshot = advanceCombatRoundStep(withResolution, {
      stepSnapshots: [
        stepSnapshot({
          attackResult: result,
          participantId: "gladiator",
          phase: "phase1",
          step: "phase_1_actions",
        }),
        stepSnapshot({
          attackResult: result,
          participantId: "guard",
          phase: "phase1",
          phaseResolutionResult: withResolution.phaseResolutionResults[0],
          step: "review_phase_2_actions",
        }),
        stepSnapshot({
          attackResult: result,
          participantId: "guard",
          phase: "phase1",
          phaseResolutionResult: withResolution.phaseResolutionResults[0],
          step: "phase_1_damage",
        }),
      ],
    });
    const cleared = clearCombatRoundStep({
      state: {
        ...withSnapshot,
        selectedParticipantId: "guard",
        selectedStep: "review_phase_2_actions",
      },
      step: "review_phase_2_actions",
    });

    expect(cleared.commands).toEqual([]);
    expect(cleared.currentCursor).toEqual({
      participantId: "gladiator",
      roundNumber: 3,
      step: "A1",
    });
    expect(cleared.currentStep).toBe("phase_1_actions");
    expect(cleared.selectedParticipantId).toBe("gladiator");
    expect(cleared.selectedStep).toBe("phase_1_actions");
    expect(cleared.phaseResolutionCursor).toEqual({
      participantId: "gladiator",
      phase: "phase1",
      substep: "attack",
    });
    expect(cleared.participants[0]?.attackResults.phase1).toBeUndefined();
    expect(cleared.phaseResolutionResults).toEqual([]);
    expect(cleared.participants[0]?.stepStatuses.phase_1_actions).toBe("pending");
    expect(cleared.participants[1]?.stepStatuses.review_phase_2_actions).toBe("pending");
    expect(cleared.participants[1]?.stepStatuses.phase_1_damage).toBe("pending");
    expect(
      getCombatRoundStepSnapshot({
        participantId: "gladiator",
        state: cleared,
        step: "phase_1_actions",
      }),
    ).toBeUndefined();
    expect(
      getCombatRoundStepSnapshot({
        participantId: "guard",
        state: cleared,
        step: "review_phase_2_actions",
      }),
    ).toBeUndefined();
    expect(
      getCombatRoundStepSnapshot({
        participantId: "guard",
        state: cleared,
        step: "phase_1_damage",
      }),
    ).toBeUndefined();
  });

  it("undoes a command-backed selected A1 miss back to the attacker A1 cell", () => {
    const state = initializeCombatRoundPhaseResolutionCursor({
      phase: "phase1",
      state: declareRoundAction({
        actionId: "attack_parry",
        participantId: "gladiator",
        state: initializeCombatRoundState({ encounter: encounter() }),
      }),
      updatedAt: "2026-01-01T00:02:00.000Z",
    });
    const result = buildCombatRoundAttackRollResult({
      actionId: "attack_parry",
      attackerParticipantId: "gladiator",
      defenderDb: 10,
      defenderParticipantId: "guard",
      ob: 10,
      phase: "phase1",
      rollD20: 10,
      rollTotal: 10,
      rolledAt: "2026-01-01T00:03:00.000Z",
      weaponName: "Broad sword",
    });
    const afterAttack = recordCombatRoundAttackResult({
      command: {
        createdAt: result.rolledAt,
        createdByUserId: "gm-1",
      },
      participantId: "gladiator",
      result,
      state,
      submittedBy: "gm",
    });
    const cleared = clearCombatRoundStep({
      state: {
        ...afterAttack,
        selectedParticipantId: "gladiator",
        selectedStep: "phase_1_actions",
      },
      step: "phase_1_actions",
    });

    expect(cleared.commands).toEqual([]);
    expect(cleared.currentCursor).toEqual({
      participantId: "gladiator",
      roundNumber: 3,
      step: "A1",
    });
    expect(cleared.selectedParticipantId).toBe("gladiator");
    expect(cleared.selectedStep).toBe("phase_1_actions");
    expect(cleared.participants[0]?.attackResults.phase1).toBeUndefined();
    expect(cleared.participants[0]?.stepStatuses.phase_1_actions).toBe("pending");
  });

  it("manual selection of old i1 after later A1 attacks still undoes the latest roll_attack", () => {
    const threeParticipantEncounter = encounter({
      participants: [
        participant({ id: "gladiator", label: "The Gladiator" }),
        participant({ id: "guard", label: "City guard" }),
        participant({ id: "scout", label: "Scout" }),
      ],
    });
    const declared = declareRoundAction({
      actionId: "attack_parry",
      participantId: "guard",
      state: declareRoundAction({
        actionId: "attack_parry",
        participantId: "gladiator",
        state: initializeCombatRoundState({ encounter: threeParticipantEncounter }),
      }),
    });
    const withInitiatives = setCombatRoundParticipantInitiative({
      initiative: { baseInitiative: 0, modifierAdjustment: 0, rolls: [6], rollTotal: 6, total: 6 },
      participantId: "gladiator",
      phase: "phase1",
      state: setCombatRoundParticipantInitiative({
        initiative: { baseInitiative: 0, modifierAdjustment: 0, rolls: [4], rollTotal: 4, total: 4 },
        participantId: "guard",
        phase: "phase1",
        state: setCombatRoundParticipantInitiative({
          initiative: {
            baseInitiative: 0,
            modifierAdjustment: 0,
            rolls: [2],
            rollTotal: 2,
            total: 2,
          },
          participantId: "scout",
          phase: "phase1",
          state: declared,
        }),
      }),
    });
    const withCursor = initializeCombatRoundPhaseResolutionCursor({
      phase: "phase1",
      state: withInitiatives,
      updatedAt: "2026-01-01T00:02:00.000Z",
    });
    const gladiatorMiss = buildCombatRoundAttackRollResult({
      actionId: "attack_parry",
      attackerParticipantId: "gladiator",
      defenderDb: 10,
      defenderParticipantId: "guard",
      ob: 10,
      phase: "phase1",
      rollD20: 10,
      rollTotal: 10,
      rolledAt: "2026-01-01T00:03:00.000Z",
      weaponName: "Broad sword",
    });
    const afterGladiatorMiss = recordCombatRoundAttackResult({
      command: {
        createdAt: gladiatorMiss.rolledAt,
        createdByUserId: "gm-1",
      },
      participantId: "gladiator",
      result: gladiatorMiss,
      state: withCursor,
      submittedBy: "gm",
    });
    const guardMiss = buildCombatRoundAttackRollResult({
      actionId: "attack_parry",
      attackerParticipantId: "guard",
      defenderDb: 10,
      defenderParticipantId: "gladiator",
      ob: 10,
      phase: "phase1",
      rollD20: 10,
      rollTotal: 10,
      rolledAt: "2026-01-01T00:04:00.000Z",
      weaponName: "Spear",
    });
    const afterGuardMiss = recordCombatRoundAttackResult({
      command: {
        createdAt: guardMiss.rolledAt,
        createdByUserId: "gm-1",
      },
      participantId: "guard",
      result: guardMiss,
      state: afterGladiatorMiss,
      submittedBy: "gm",
    });
    const cleared = clearCombatRoundStep({
      state: {
        ...afterGuardMiss,
        currentCursor: {
          participantId: "scout",
          roundNumber: 3,
          step: "i1",
        },
        currentStep: "phase_1_actions",
        selectedParticipantId: "gladiator",
        selectedStep: "initiative_phase_1",
      },
      step: "initiative_phase_1",
    });

    expect(afterGuardMiss.commands.map((command) => command.participantId)).toEqual([
      "gladiator",
      "guard",
    ]);
    expect(cleared.commands).toHaveLength(1);
    expect(cleared.commands[0]).toMatchObject({
      participantId: "gladiator",
      type: "roll_attack",
    });
    expect(cleared.currentCursor).toEqual({
      participantId: "guard",
      roundNumber: 3,
      step: "A1",
    });
    expect(cleared.currentStep).toBe("phase_1_actions");
    expect(cleared.selectedParticipantId).toBe("guard");
    expect(cleared.selectedStep).toBe("phase_1_actions");
    expect(cleared.participants[0]?.attackResults.phase1).toEqual(gladiatorMiss);
    expect(cleared.participants[1]?.attackResults.phase1).toBeUndefined();
    expect(cleared.participants[0]?.initiatives.phase1).toMatchObject({ total: 6 });
  });

  it("committed D1 snapshots preserve resolution scaffold status", () => {
    const state = initializeCombatRoundState({ encounter: encounter() });
    const result = buildCombatRoundAttackRollResult({
      actionId: "attack_parry",
      attackerParticipantId: "gladiator",
      defenderDb: 10,
      defenderParticipantId: "guard",
      ob: 10,
      phase: "phase1",
      rollD20: 12,
      rollTotal: 12,
      rolledAt: "2026-01-01T00:03:00.000Z",
      weaponName: "Broad sword",
    });
    const withResult = recordCombatRoundAttackResult({
      participantId: "gladiator",
      result,
      state,
      submittedBy: "gm",
    });
    const withResolution = ensureCombatRoundPhaseResolutionResultsForPhase({
      phase: "phase1",
      state: withResult,
      updatedAt: "2026-01-01T00:04:00.000Z",
    });
    const snapshot = stepSnapshot({
      actionResultSummary:
        "Main: Broad sword OB 10 - DB 10 + roll 12 = 12 · Result: Hit\nParry: Pending · Damage roll: Pending\nProposal: Not ready",
      attackResult: result,
      participantId: "gladiator",
      phase: "phase1",
      phaseResolutionResult: withResolution.phaseResolutionResults[0],
      step: "review_phase_2_actions",
    });
    const advanced = advanceCombatRoundStep(withResolution, { stepSnapshots: [snapshot] });

    expect(
      getCombatRoundStepSnapshot({
        participantId: "gladiator",
        state: advanced,
        step: "review_phase_2_actions",
      }),
    ).toMatchObject({
      actionResultSummary: expect.stringContaining("Parry: Pending"),
      phaseResolutionResult: {
        damageProposal: { proposedEffects: [], status: "not_ready" },
        damageRoll: { status: "pending" },
        parryResolution: { status: "pending" },
      },
      step: "review_phase_2_actions",
    });
  });

  it("initializes phase1 cursor from initiative order with unrolled participants last", () => {
    const baseState = initializeCombatRoundState({
      encounter: encounter({
        participants: [
          participant({ id: "gladiator", label: "The Gladiator" }),
          participant({ id: "guard", label: "City guard" }),
          participant({ id: "scout", label: "Scout" }),
        ],
      }),
    });
    const withDeclarations = declareRoundAction({
      actionId: "attack_parry",
      participantId: "scout",
      state: declareRoundAction({
        actionId: "attack_parry",
        participantId: "guard",
        state: declareRoundAction({
          actionId: "attack_parry",
          participantId: "gladiator",
          state: baseState,
        }),
      }),
    });
    const withInitiatives = setCombatRoundParticipantInitiative({
      initiative: { baseInitiative: 0, modifierAdjustment: 0, rolls: [4], rollTotal: 4, total: 4 },
      participantId: "gladiator",
      phase: "phase1",
      state: setCombatRoundParticipantInitiative({
        initiative: {
          baseInitiative: 0,
          modifierAdjustment: 0,
          rolls: [6],
          rollTotal: 6,
          total: 6,
        },
        participantId: "guard",
        phase: "phase1",
        state: withDeclarations,
      }),
    });
    const withCursor = initializeCombatRoundPhaseResolutionCursor({
      phase: "phase1",
      state: withInitiatives,
      updatedAt: "2026-01-01T00:04:00.000Z",
    });

    expect(getCombatRoundPhaseResolutionOrder({ phase: "phase1", state: withCursor })).toEqual([
      "guard",
      "gladiator",
      "scout",
    ]);
    expect(withCursor.phaseResolutionCursor).toEqual({
      participantId: "guard",
      phase: "phase1",
      substep: "attack",
    });
    expect(withCursor.selectedParticipantId).toBe("guard");
  });

  it("advances cursor through one participant and then to the next initiative participant", () => {
    const baseState = initializeCombatRoundState({ encounter: encounter() });
    const withDeclarations = declareRoundAction({
      actionId: "attack_parry",
      participantId: "guard",
      state: declareRoundAction({
        actionId: "attack_parry",
        participantId: "gladiator",
        state: baseState,
      }),
    });
    const withInitiatives = setCombatRoundParticipantInitiative({
      initiative: { baseInitiative: 0, modifierAdjustment: 0, rolls: [6], rollTotal: 6, total: 6 },
      participantId: "gladiator",
      phase: "phase1",
      state: setCombatRoundParticipantInitiative({
        initiative: {
          baseInitiative: 0,
          modifierAdjustment: 0,
          rolls: [4],
          rollTotal: 4,
          total: 4,
        },
        participantId: "guard",
        phase: "phase1",
        state: withDeclarations,
      }),
    });
    const withCursor = initializeCombatRoundPhaseResolutionCursor({
      phase: "phase1",
      state: withInitiatives,
      updatedAt: "2026-01-01T00:04:00.000Z",
    });
    const result = buildCombatRoundAttackRollResult({
      actionId: "attack_parry",
      attackerParticipantId: "gladiator",
      defenderDb: 10,
      defenderParticipantId: "guard",
      ob: 10,
      phase: "phase1",
      rollD20: 12,
      rollTotal: 12,
      rolledAt: "2026-01-01T00:05:00.000Z",
      weaponName: "Broad sword",
    });
    const afterAttack = recordCombatRoundAttackResult({
      participantId: "gladiator",
      result,
      state: withCursor,
      submittedBy: "gm",
    });

    expect(afterAttack.phaseResolutionCursor).toEqual({
      participantId: "guard",
      phase: "phase1",
      substep: "parry",
    });
    expect(
      getCombatRoundPhaseResolutionStatus({
        participantId: "gladiator",
        phase: "phase1",
        state: afterAttack,
      }).substep,
    ).toBe("parry");

    const afterDone = completeCombatRoundPhaseResolutionForParticipant({
      participantId: "gladiator",
      phase: "phase1",
      state: afterAttack,
      submittedBy: "gm",
      updatedAt: "2026-01-01T00:06:00.000Z",
    });

    expect(
      getCombatRoundPhaseResolutionStatus({
        participantId: "gladiator",
        phase: "phase1",
        state: afterDone,
      }).substep,
    ).toBe("done");
    expect(afterDone.phaseResolutionCursor).toEqual({
      participantId: "guard",
      phase: "phase1",
      substep: "attack",
    });
    expect(afterDone.selectedParticipantId).toBe("guard");
  });

  it("clear A1/P1/D1 returns to the redo point in the phase1 dependency chain", () => {
    const state = declareRoundAction({
      actionId: "attack_parry",
      participantId: "gladiator",
      state: initializeCombatRoundState({ encounter: encounter() }),
    });
    const result = buildCombatRoundAttackRollResult({
      actionId: "attack_parry",
      attackerParticipantId: "gladiator",
      defenderDb: 10,
      defenderParticipantId: "guard",
      ob: 10,
      phase: "phase1",
      rollD20: 12,
      rollTotal: 12,
      rolledAt: "2026-01-01T00:05:00.000Z",
      weaponName: "Broad sword",
    });
    const withCursor = initializeCombatRoundPhaseResolutionCursor({
      phase: "phase1",
      state,
      updatedAt: "2026-01-01T00:04:00.000Z",
    });
    const afterAttack = recordCombatRoundAttackResult({
      participantId: "gladiator",
      result,
      state: withCursor,
      submittedBy: "gm",
    });
    const afterPendingP1Clear = clearCombatRoundStep({
      state: afterAttack,
      step: "review_phase_2_actions",
    });

    expect(afterPendingP1Clear.participants[0]?.attackResults.phase1).toBeUndefined();
    expect(afterPendingP1Clear.phaseResolutionCursor).toEqual({
      participantId: "gladiator",
      phase: "phase1",
      substep: "attack",
    });
    expect(afterPendingP1Clear.selectedParticipantId).toBe("gladiator");
    expect(afterPendingP1Clear.selectedStep).toBe("phase_1_actions");
    expect(
      getCombatRoundPhaseResolutionStatus({
        participantId: "gladiator",
        phase: "phase1",
        state: afterPendingP1Clear,
      }).substep,
    ).toBe("pending");

    const afterP1Clear = clearCombatRoundStep({
      state: afterAttack,
      step: "phase_1_actions",
    });

    expect(afterP1Clear.participants[0]?.attackResults.phase1).toBeUndefined();
    expect(afterP1Clear.phaseResolutionCursor).toEqual({
      participantId: "gladiator",
      phase: "phase1",
      substep: "attack",
    });
    expect(
      getCombatRoundPhaseResolutionStatus({
        participantId: "gladiator",
        phase: "phase1",
        state: afterP1Clear,
      }).substep,
    ).toBe("pending");

    const withFailedParry = recordCombatRoundParryResolution({
      attackResult: result,
      parryResolution: {
        combinedParryScore: 9,
        modifierAdjustment: 0,
        openEndedD10s: [],
        resultLabel: "Parry failed",
        rollD20: 8,
        rollTotal: 8,
        status: "resolved",
        success: false,
        targetNumber: 21,
        total: 17,
      },
      state: afterAttack,
      updatedAt: "2026-01-01T00:06:00.000Z",
    });
    const afterResolvedP1Clear = clearCombatRoundStep({
      state: withFailedParry,
      step: "review_phase_2_actions",
    });

    expect(afterResolvedP1Clear.participants[0]?.attackResults.phase1).toEqual(result);
    expect(afterResolvedP1Clear.phaseResolutionResults[0]?.parryResolution.status).toBe("pending");
    expect(afterResolvedP1Clear.phaseResolutionCursor).toEqual({
      participantId: "guard",
      phase: "phase1",
      substep: "parry",
    });
    expect(afterResolvedP1Clear.selectedParticipantId).toBe("guard");
    expect(afterResolvedP1Clear.selectedStep).toBe("review_phase_2_actions");

    const afterD1Clear = clearCombatRoundStep({
      state: {
        ...withFailedParry,
        selectedParticipantId: "guard",
        selectedStep: "phase_1_damage",
      },
      step: "phase_1_damage",
    });

    expect(afterD1Clear.participants[0]?.attackResults.phase1).toEqual(result);
    expect(afterD1Clear.phaseResolutionResults[0]?.parryResolution.status).toBe("resolved");
    expect(afterD1Clear.phaseResolutionResults[0]?.damageRoll.status).toBe("pending");
    expect(afterD1Clear.phaseResolutionCursor).toEqual({
      participantId: "guard",
      phase: "phase1",
      substep: "damage",
    });
    expect(afterD1Clear.selectedParticipantId).toBe("guard");
    expect(afterD1Clear.selectedStep).toBe("phase_1_damage");
  });

  it("phase2 cursor follows phase2 initiative and substeps", () => {
    const state = declareRoundAction({
      actionId: "parry_attack",
      participantId: "guard",
      state: initializeCombatRoundState({ encounter: encounter() }),
    });
    const withInitiatives = setCombatRoundParticipantInitiative({
      initiative: { baseInitiative: 0, modifierAdjustment: 0, rolls: [2], rollTotal: 2, total: 2 },
      participantId: "gladiator",
      phase: "phase2",
      state: setCombatRoundParticipantInitiative({
        initiative: {
          baseInitiative: 0,
          modifierAdjustment: 0,
          rolls: [5],
          rollTotal: 5,
          total: 5,
        },
        participantId: "guard",
        phase: "phase2",
        state,
      }),
    });
    const withCursor = initializeCombatRoundPhaseResolutionCursor({
      phase: "phase2",
      state: withInitiatives,
      updatedAt: "2026-01-01T00:04:00.000Z",
    });
    const result = buildCombatRoundAttackRollResult({
      actionId: "parry_attack",
      attackerParticipantId: "guard",
      defenderDb: 10,
      defenderParticipantId: "gladiator",
      ob: 10,
      phase: "phase2",
      rollD20: 10,
      rollTotal: 10,
      rolledAt: "2026-01-01T00:05:00.000Z",
      weaponName: "Long sword",
    });
    const afterMiss = recordCombatRoundAttackResult({
      participantId: "guard",
      result,
      state: withCursor,
      submittedBy: "gm",
    });

    expect(withCursor.phaseResolutionCursor).toEqual({
      participantId: "guard",
      phase: "phase2",
      substep: "attack",
    });
    expect(afterMiss.phaseResolutionCursor).toEqual({
      participantId: "gladiator",
      phase: "phase2",
      substep: "parry",
    });
    expect(
      getCombatRoundPhaseResolutionStatus({
        participantId: "guard",
        phase: "phase2",
        state: afterMiss,
      }).substep,
    ).toBe("done");
  });

  it("detects phase attack availability from the declared phase model", () => {
    const baseState = initializeCombatRoundState({ encounter: encounter() });
    const withAttackParry = recordCombatRoundDeclaration({
      declaration: {
        actionId: "attack_parry",
        roundNumber: 3,
      },
      participantId: "gladiator",
      state: baseState,
      submittedBy: "gm",
    });
    const withParryAttack = recordCombatRoundDeclaration({
      declaration: {
        actionId: "parry_attack",
        roundNumber: 3,
      },
      participantId: "guard",
      state: withAttackParry,
      submittedBy: "gm",
    });
    const withDoubleAttack = recordCombatRoundDeclaration({
      declaration: {
        actionId: "double_attack",
        roundNumber: 3,
      },
      participantId: "scout",
      state: initializeCombatRoundState({
        encounter: encounter({
          participants: [participant({ id: "scout", label: "Scout" })],
        }),
      }),
      submittedBy: "gm",
    });

    expect(
      combatRoundParticipantHasPhaseAttack({
        participantId: "gladiator",
        phase: "phase1",
        state: withParryAttack,
      }),
    ).toBe(true);
    expect(
      combatRoundParticipantHasPhaseAttack({
        participantId: "gladiator",
        phase: "phase2",
        state: withParryAttack,
      }),
    ).toBe(false);
    expect(
      combatRoundParticipantHasPhaseAttack({
        participantId: "guard",
        phase: "phase1",
        state: withParryAttack,
      }),
    ).toBe(false);
    expect(
      combatRoundParticipantHasPhaseAttack({
        participantId: "guard",
        phase: "phase2",
        state: withParryAttack,
      }),
    ).toBe(true);
    expect(
      combatRoundParticipantHasPhaseAttack({
        participantId: "scout",
        phase: "phase1",
        state: withDoubleAttack,
      }),
    ).toBe(true);
    expect(
      combatRoundParticipantHasPhaseAttack({
        participantId: "scout",
        phase: "phase2",
        state: withDoubleAttack,
      }),
    ).toBe(true);
  });

  it("starts a no-attack phase actor at review and lets the GM complete it without rolling", () => {
    const baseState = initializeCombatRoundState({ encounter: encounter() });
    const withDeclaration = recordCombatRoundDeclaration({
      declaration: {
        actionId: "parry_attack",
        roundNumber: 3,
      },
      participantId: "gladiator",
      state: baseState,
      submittedBy: "gm",
    });
    const withCursor = initializeCombatRoundPhaseResolutionCursor({
      phase: "phase1",
      state: withDeclaration,
      updatedAt: "2026-01-01T00:04:00.000Z",
    });

    expect(withCursor.phaseResolutionCursor).toEqual({
      participantId: "gladiator",
      phase: "phase1",
      substep: "parry",
    });

    const completed = completeCombatRoundPhaseResolutionForParticipant({
      participantId: "gladiator",
      phase: "phase1",
      state: withCursor,
      submittedBy: "gm",
      updatedAt: "2026-01-01T00:06:00.000Z",
    });

    expect(completed.participants[0]?.stepStatuses.phase_1_actions).toBe("skipped");
    expect(completed.participants[0]?.stepStatuses.review_phase_2_actions).toBe("gmEdited");
    expect(
      getCombatRoundPhaseResolutionStatus({
        participantId: "gladiator",
        phase: "phase1",
        state: completed,
      }).substep,
    ).toBe("done");
    expect(completed.phaseResolutionCursor).toEqual({
      participantId: "guard",
      phase: "phase1",
      substep: "parry",
    });
  });

  it("undoes a command-backed no-attack A1 skip in one visible Clear", () => {
    const baseState = initializeCombatRoundState({ encounter: encounter() });
    const withDeclaration = recordCombatRoundDeclaration({
      declaration: {
        actionId: "parry_attack",
        roundNumber: 3,
      },
      participantId: "gladiator",
      state: baseState,
      submittedBy: "gm",
    });
    const withCursor = initializeCombatRoundPhaseResolutionCursor({
      phase: "phase1",
      state: withDeclaration,
      updatedAt: "2026-01-01T00:04:00.000Z",
    });
    const completed = recordCombatRoundNoAttackPhaseReview({
      command: {
        createdAt: "2026-01-01T00:06:00.000Z",
        createdByUserId: "gm-1",
      },
      participantId: "gladiator",
      phase: "phase1",
      state: withCursor,
      submittedBy: "gm",
      updatedAt: "2026-01-01T00:06:00.000Z",
    });
    const cleared = clearCombatRoundStep({
      state: {
        ...completed,
        selectedParticipantId: "gladiator",
        selectedStep: "initiative_phase_1",
      },
      step: "initiative_phase_1",
    });

    expect(completed.commands).toHaveLength(1);
    expect(completed.commands[0]).toMatchObject({
      afterCursor: { participantId: "guard", step: "A1" },
      beforeCursor: { participantId: "gladiator", step: "A1" },
      facts: expect.objectContaining({
        status: "skipped",
      }),
      participantId: "gladiator",
      phase: "phase1",
      type: "skip_phase_action",
    });
    expect(completed.participants[0]?.stepStatuses.phase_1_actions).toBe("skipped");
    expect(completed.participants[0]?.stepStatuses.review_phase_2_actions).toBe("gmEdited");
    expect(cleared.commands).toEqual([]);
    expect(cleared.currentCursor).toEqual({
      participantId: "gladiator",
      roundNumber: 3,
      step: "A1",
    });
    expect(cleared.currentStep).toBe("phase_1_actions");
    expect(cleared.selectedParticipantId).toBe("gladiator");
    expect(cleared.selectedStep).toBe("phase_1_actions");
    expect(cleared.participants[0]?.stepStatuses.phase_1_actions).toBe("pending");
    expect(cleared.participants[0]?.stepStatuses.review_phase_2_actions).toBe("pending");
    expect(cleared.phaseResolutionCursor).toEqual({
      participantId: "gladiator",
      phase: "phase1",
      substep: "parry",
    });
    expect(
      getCombatRoundPhaseResolutionStatus({
        participantId: "guard",
        phase: "phase1",
        state: cleared,
      }).substep,
    ).toBe("pending");
  });

  it("advances parry and damage placeholders before completing effects review", () => {
    const state = declareRoundAction({
      actionId: "attack_parry",
      participantId: "gladiator",
      state: initializeCombatRoundState({ encounter: encounter() }),
    });
    const result = buildCombatRoundAttackRollResult({
      actionId: "attack_parry",
      attackerParticipantId: "gladiator",
      defenderDb: 10,
      defenderParticipantId: "guard",
      ob: 10,
      phase: "phase1",
      rollD20: 12,
      rollTotal: 12,
      rolledAt: "2026-01-01T00:05:00.000Z",
      weaponName: "Broad sword",
    });
    const afterAttack = recordCombatRoundAttackResult({
      participantId: "gladiator",
      result,
      state,
      submittedBy: "gm",
    });
    const afterParry = advanceCombatRoundPhaseResolutionSubstepForParticipant({
      participantId: "gladiator",
      phase: "phase1",
      state: afterAttack,
      updatedAt: "2026-01-01T00:06:00.000Z",
    });
    const afterDamage = advanceCombatRoundPhaseResolutionSubstepForParticipant({
      participantId: "gladiator",
      phase: "phase1",
      state: afterParry,
      updatedAt: "2026-01-01T00:07:00.000Z",
    });
    const afterEffects = completeCombatRoundPhaseResolutionForParticipant({
      participantId: "gladiator",
      phase: "phase1",
      state: afterDamage,
      submittedBy: "gm",
      updatedAt: "2026-01-01T00:08:00.000Z",
    });

    expect(
      getCombatRoundPhaseResolutionStatus({
        participantId: "gladiator",
        phase: "phase1",
        state: afterParry,
      }).substep,
    ).toBe("damage");
    expect(
      getCombatRoundPhaseResolutionStatus({
        participantId: "gladiator",
        phase: "phase1",
        state: afterDamage,
      }).substep,
    ).toBe("effects");
    expect(
      getCombatRoundPhaseResolutionStatus({
        participantId: "gladiator",
        phase: "phase1",
        state: afterEffects,
      }).substep,
    ).toBe("done");
  });

  it("rolls open-ended d6 initiative", () => {
    const openedOnceValues = [5 / 6, 1 / 6];
    const openedTwiceValues = [5 / 6, 5 / 6, 3 / 6];
    const singleRoll = rollOpenEndedD6({ randomFn: () => 2 / 6 });
    const openedOnce = rollOpenEndedD6({
      randomFn: () => openedOnceValues.shift() ?? 0,
    });
    const openedTwice = rollOpenEndedD6({
      randomFn: () => openedTwiceValues.shift() ?? 0,
    });

    expect(singleRoll).toMatchObject({ isOpenEnded: false, rolls: [3], total: 3 });
    expect(openedOnce).toMatchObject({ isOpenEnded: true, rolls: [6, 2], total: 8 });
    expect(openedTwice).toMatchObject({ isOpenEnded: true, rolls: [6, 6, 4], total: 16 });
  });

  it("combines initiative base with open-ended die roll total", () => {
    expect(
      buildCombatRoundInitiativeResult({
        baseInitiative: 3,
        roll: {
          baseInitiative: 0,
          modifierAdjustment: 0,
          rolls: [6, 4],
          rollTotal: 10,
          total: 10,
        },
      }),
    ).toEqual({
      baseInitiative: 3,
      modifierAdjustment: 0,
      rolls: [6, 4],
      rollTotal: 10,
      total: 13,
    });

    expect(
      buildCombatRoundInitiativeResult({
        baseInitiative: 3,
        modifierAdjustment: -1,
        roll: {
          baseInitiative: 0,
          modifierAdjustment: 0,
          rolls: [6, 4],
          rollTotal: 10,
          total: 10,
        },
      }),
    ).toEqual({
      baseInitiative: 3,
      modifierAdjustment: -1,
      rolls: [6, 4],
      rollTotal: 10,
      total: 12,
    });
  });

  it("guards open-ended initiative against endless sixes", () => {
    const result = rollOpenEndedD6({ maxRolls: 3, randomFn: () => 0.999 });

    expect(result.rolls).toEqual([6, 6, 6]);
    expect(result.total).toBe(18);
  });

  it("records participant step reviews without creating modifier data", () => {
    const state = advanceCombatRoundStep(initializeCombatRoundState({ encounter: encounter() }));
    const reviewed = recordCombatRoundParticipantStepReview({
      participantId: "gladiator",
      state,
      step: "review_action_modifiers",
      submittedBy: "gm",
    });

    expect(state.participants[0]?.stepStatuses.review_action_modifiers).toBe("pending");
    expect(reviewed.participants[0]?.stepStatuses.review_action_modifiers).toBe("gmEdited");
    expect(reviewed.participants[1]?.stepStatuses.review_action_modifiers).toBe("pending");
  });

  it("allows player initiative only on the matching open initiative step", () => {
    const state = advanceCombatRoundStep(
      advanceCombatRoundStep(initializeCombatRoundState({ encounter: encounter() })),
    );

    expect(state.currentStep).toBe("initiative_phase_1");
    expect(
      canPlayerRollCombatInitiative({ participantId: "gladiator", phase: "phase1", state }),
    ).toBe(true);
    expect(
      canPlayerRollCombatInitiative({ participantId: "gladiator", phase: "phase2", state }),
    ).toBe(false);
  });

  it("locks pending declarations when advancing past DE while preserving submitted markers", () => {
    const state = recordCombatRoundDeclaration({
      participantId: "gladiator",
      state: initializeCombatRoundState({ encounter: encounter() }),
      submittedBy: "player",
    });
    const nextState = advanceCombatRoundStep(state);

    expect(nextState.currentStep).toBe("review_action_modifiers");
    expect(nextState.participants[0]?.stepStatuses.select_actions).toBe("submitted");
    expect(nextState.participants[1]?.stepStatuses.select_actions).toBe("locked");
    expect(canPlayerSubmitCombatDeclaration({ participantId: "guard", state: nextState })).toBe(
      false,
    );
  });

  it("sorts participants by phase initiative values when available", () => {
    const state = initializeCombatRoundState({ encounter: encounter() });
    const withGuardInitiative = setCombatRoundParticipantInitiative({
      initiative: 12,
      participantId: "guard",
      phase: "phase1",
      state,
    });
    const withGladiatorInitiative = setCombatRoundParticipantInitiative({
      initiative: 18,
      participantId: "gladiator",
      phase: "phase1",
      state: withGuardInitiative,
    });

    expect(
      sortCombatRoundParticipantsByInitiative({
        phase: "phase1",
        state: withGladiatorInitiative,
      }).map((entry) => entry.participantId),
    ).toEqual(["gladiator", "guard"]);
  });

  it("sorts unrolled participants below rolled initiatives and assigns positions only to rolled participants", () => {
    const state = setCombatRoundParticipantInitiative({
      initiative: 12,
      participantId: "guard",
      phase: "phase1",
      state: initializeCombatRoundState({
        encounter: encounter({
          participants: [
            participant({ id: "gladiator", label: "The Gladiator" }),
            participant({ id: "guard", label: "City guard" }),
            participant({ id: "scyrian", label: "Scyrian cavalry guy" }),
          ],
        }),
      }),
    });

    expect(
      sortCombatRoundParticipantsByInitiative({
        phase: "phase1",
        state,
      }).map((entry) => entry.participantId),
    ).toEqual(["guard", "gladiator", "scyrian"]);
    expect(getCombatRoundInitiativePositions({ phase: "phase1", state })).toEqual({
      guard: 1,
    });
    expect(getCombatRoundInitiativeRanks({ phase: "phase1", state })).toEqual({
      guard: {
        rank: 1,
        rankTotal: 1,
        tiedCount: 1,
      },
    });
  });

  it("assigns shared initiative ranks to tied participants", () => {
    const state = [
      ["gladiator", 4],
      ["guard", 4],
    ].reduce(
      (nextState, [participantId, initiative]) =>
        setCombatRoundParticipantInitiative({
          initiative: initiative as number,
          participantId: participantId as string,
          phase: "phase1",
          state: nextState,
        }),
      initializeCombatRoundState({ encounter: encounter() }),
    );

    expect(getCombatRoundInitiativeRanks({ phase: "phase1", state })).toEqual({
      gladiator: {
        rank: 1,
        rankTotal: 2,
        tiedCount: 2,
      },
      guard: {
        rank: 1,
        rankTotal: 2,
        tiedCount: 2,
      },
    });
  });

  it("uses competition ranking after initiative ties", () => {
    const state = [
      ["gladiator", 4],
      ["guard", 4],
      ["scyrian", 2],
    ].reduce(
      (nextState, [participantId, initiative]) =>
        setCombatRoundParticipantInitiative({
          initiative: initiative as number,
          participantId: participantId as string,
          phase: "phase1",
          state: nextState,
        }),
      initializeCombatRoundState({
        encounter: encounter({
          participants: [
            participant({ id: "gladiator", label: "The Gladiator" }),
            participant({ id: "guard", label: "City guard" }),
            participant({ id: "scyrian", label: "Scyrian cavalry guy" }),
          ],
        }),
      }),
    );

    expect(getCombatRoundInitiativeRanks({ phase: "phase1", state })).toEqual({
      gladiator: {
        rank: 1,
        rankTotal: 3,
        tiedCount: 2,
      },
      guard: {
        rank: 1,
        rankTotal: 3,
        tiedCount: 2,
      },
      scyrian: {
        rank: 3,
        rankTotal: 3,
        tiedCount: 1,
      },
    });
  });

  it("skips ranks after lower-position initiative ties", () => {
    const state = [
      ["gladiator", 6],
      ["guard", 4],
      ["scyrian", 4],
      ["archer", 2],
    ].reduce(
      (nextState, [participantId, initiative]) =>
        setCombatRoundParticipantInitiative({
          initiative: initiative as number,
          participantId: participantId as string,
          phase: "phase1",
          state: nextState,
        }),
      initializeCombatRoundState({
        encounter: encounter({
          participants: [
            participant({ id: "gladiator", label: "The Gladiator" }),
            participant({ id: "guard", label: "City guard" }),
            participant({ id: "scyrian", label: "Scyrian cavalry guy" }),
            participant({ id: "archer", label: "Another guard" }),
          ],
        }),
      }),
    );

    expect(getCombatRoundInitiativeRanks({ phase: "phase1", state })).toMatchObject({
      gladiator: {
        rank: 1,
        rankTotal: 4,
        tiedCount: 1,
      },
      guard: {
        rank: 2,
        rankTotal: 4,
        tiedCount: 2,
      },
      scyrian: {
        rank: 2,
        rankTotal: 4,
        tiedCount: 2,
      },
      archer: {
        rank: 4,
        rankTotal: 4,
        tiedCount: 1,
      },
    });
  });

  it("builds inspector data for the selected participant and step", () => {
    const state = initializeCombatRoundState({ encounter: encounter() });
    const nextState = advanceCombatRoundStep(state);
    const inspector = buildCombatRoundInspector({
      participantId: "gladiator",
      state: nextState,
      step: "select_actions",
    });

    expect(inspector.participant?.label).toBe("The Gladiator");
    expect(inspector.step).toBe("select_actions");
    expect(inspector.status).toBe("locked");
  });

  it("does not alter combat effects or action log when advancing round steps", () => {
    const session = encounter({
      actionLog: [
        {
          attackRoll: { baseOb: 10, defenseTarget: 5, hit: true, margin: 5, roll: 50, total: 60 },
          attackerParticipantId: "gladiator",
          declaration: {
            actionType: "attack",
            defenseFocus: "none",
            defensePosture: "none",
            targetLocation: "any",
          },
          defenderParticipantId: "guard",
          defense: {
            dbApplied: false,
            dbValue: 0,
            defending: false,
            parryAttempted: false,
            parryBase: 0,
            parrySucceeded: false,
          },
          encounterId: "encounter-1",
          id: "attack-1",
          order: 0,
          outcome: "hit",
          resolvedAt: "2026-01-01T00:00:00.000Z",
          roundNumber: 3,
        },
      ],
    });
    const state = initializeCombatRoundState({ encounter: session });
    const nextState = advanceCombatRoundStep(state);
    const nextSession = encounterSessionSchema.parse({
      ...session,
      combatRoundState: nextState,
    });

    expect(nextSession.actionLog).toEqual(session.actionLog);
    expect(nextSession.combatRoundState?.currentStep).toBe("review_action_modifiers");
  });
});
