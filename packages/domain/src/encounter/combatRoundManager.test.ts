import { describe, expect, it } from "vitest";

import type { EncounterParticipant, EncounterSession } from "./session";

import {
  COMBAT_ROUND_STEP_ABBREVIATIONS,
  COMBAT_ROUND_STEPS,
  advanceCombatRoundStep,
  buildCombatRoundInspector,
  buildCombatRoundInitiativeResult,
  canPlayerSubmitCombatDeclaration,
  canPlayerRollCombatInitiative,
  clearCombatRoundStep,
  clearCurrentCombatRoundStepAndRewind,
  getCombatRoundInitiativePhaseForStep,
  getCombatRoundInitiativePositions,
  getCombatRoundInitiativeRanks,
  getPreviousCombatRoundStep,
  initializeCombatRoundState,
  recordCombatRoundDeclaration,
  recordCombatRoundInitiative,
  recordCombatRoundParticipantStepReview,
  rollOpenEndedD6,
  setCombatRoundActiveParticipant,
  setCombatRoundParticipantInitiative,
  setCombatRoundParticipantStepStatus,
  sortCombatRoundParticipantsByInitiative,
} from "./combatRoundManager";
import { encounterSessionSchema } from "./session";

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

describe("combat round manager", () => {
  it("defines the compact round timeline steps in order", () => {
    expect(COMBAT_ROUND_STEPS.map((step) => COMBAT_ROUND_STEP_ABBREVIATIONS[step])).toEqual([
      "DE",
      "M1",
      "i1",
      "P1",
      "D1",
      "M2",
      "i2",
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
      "review_phase_2_modifiers",
      "initiative_phase_2",
      "phase_2_actions",
      "review_phase_2_damage",
    ].reduce((current) => advanceCombatRoundStep(current), reviewState);
    const nextRoundState = advanceCombatRoundStep(roundSummaryState);

    expect(roundSummaryState.currentStep).toBe("round_summary");
    expect(nextRoundState.currentStep).toBe("select_actions");
    expect(nextRoundState.roundNumber).toBe(4);
    expect(nextRoundState.participants[0]?.stepStatuses.select_actions).toBe("pending");
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
            modifierBuckets: {
              general: [],
              situationDb: [],
              situationInitiative: [],
              situationObSkill: [],
            },
          },
          phase2: {
            offHandParryDirection: "right_forward",
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
        }),
        phase2: expect.objectContaining({
          offHandParryDirection: "right_forward",
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
