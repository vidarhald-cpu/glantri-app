import { describe, expect, it } from "vitest";

import type { EncounterParticipant, EncounterSession } from "./session";

import {
  COMBAT_ROUND_STEP_ABBREVIATIONS,
  COMBAT_ROUND_STEPS,
  advanceCombatRoundPhaseResolutionSubstepForParticipant,
  advanceCombatRoundStep,
  buildCombatRoundPhaseResolutionResult,
  buildCombatRoundAttackRollResult,
  buildCombatRoundInspector,
  buildCombatRoundInitiativeResult,
  canPlayerSubmitCombatDeclaration,
  canPlayerRollCombatInitiative,
  clearCombatRoundStep,
  clearCurrentCombatRoundStepAndRewind,
  combatRoundParticipantHasPhaseAttack,
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
  recordCombatRoundInitiative,
  recordCombatRoundParryResolution,
  recordCombatRoundParticipantStepReview,
  rollOpenEndedD6,
  setCombatRoundActiveParticipant,
  setCombatRoundParticipantInitiative,
  setCombatRoundParticipantStepStatus,
  sortCombatRoundParticipantsByInitiative,
} from "./combatRoundManager";
import { encounterSessionSchema } from "./session";
import type { CombatRoundStepSnapshot } from "./combatRoundManager";

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
    expect(state.selectedParticipantId).toBe("gladiator");
    expect(state.participants.map((entry) => entry.participantId)).toEqual(["gladiator", "guard"]);
    expect(state.participants[0]?.stepStatuses.select_actions).toBe("pending");
    expect(state.participants[0]?.stepStatuses.round_summary).toBe("pending");
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

  it("preserves a manual DE participant selection when it is still valid", () => {
    const existing = initializeCombatRoundState({ encounter: encounter() });
    const state = initializeCombatRoundState({
      encounter: encounter({
        combatRoundState: {
          ...existing,
          selectedParticipantId: "guard",
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
    const cleared = clearCombatRoundStep({
      state: withLaterSnapshot,
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
    ).toBe("skipped");
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
    ).toBe("skipped");
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
      ],
    });
    const cleared = clearCombatRoundStep({
      state: withSnapshot,
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

  it("clear P1 and D1 reset phase1 cursor/status at the right level", () => {
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
    const afterD1Clear = clearCombatRoundStep({
      state: afterAttack,
      step: "review_phase_2_actions",
    });

    expect(afterD1Clear.participants[0]?.attackResults.phase1).toEqual(result);
    expect(afterD1Clear.phaseResolutionCursor).toEqual({
      participantId: "guard",
      phase: "phase1",
      substep: "parry",
    });
    expect(
      getCombatRoundPhaseResolutionStatus({
        participantId: "gladiator",
        phase: "phase1",
        state: afterD1Clear,
      }).substep,
    ).toBe("parry");

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
          participants: [
            participant({ id: "scout", label: "Scout" }),
          ],
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
