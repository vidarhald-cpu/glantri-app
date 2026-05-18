import { describe, expect, it } from "vitest";

import type { EncounterParticipant, EncounterSession } from "./session";

import {
  advanceCombatRoundStep,
  buildCombatRoundInspector,
  initializeCombatRoundState,
  setCombatRoundActiveParticipant,
  setCombatRoundParticipantInitiative,
  sortCombatRoundParticipantsByInitiative,
} from "./combatRoundManager";
import { encounterSessionSchema } from "./session";

function participant(input: { id: string; initiative?: number; label: string }): EncounterParticipant {
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
  it("initializes round state from encounter participants", () => {
    const state = initializeCombatRoundState({ encounter: encounter() });

    expect(state.roundNumber).toBe(3);
    expect(state.currentStep).toBe("select_actions");
    expect(state.selectedParticipantId).toBe("gladiator");
    expect(state.participants.map((entry) => entry.participantId)).toEqual([
      "gladiator",
      "guard",
    ]);
    expect(state.participants[0]?.stepStatuses.select_actions).toBe("pending");
    expect(state.participants[0]?.stepStatuses.round_summary).toBe("pending");
  });

  it("advances steps in order and resets after round summary", () => {
    const state = initializeCombatRoundState({ encounter: encounter() });
    const reviewState = advanceCombatRoundStep(state);

    expect(reviewState.currentStep).toBe("review_action_modifiers");
    expect(reviewState.selectedStep).toBe("review_action_modifiers");
    expect(reviewState.participants[0]?.stepStatuses.select_actions).toBe("complete");

    const roundSummaryState = [
      "review_action_modifiers",
      "initiative_phase_1",
      "phase_1_actions",
      "review_phase_2_actions",
      "review_phase_2_modifiers",
      "initiative_phase_2",
      "phase_2_actions",
    ].reduce((current) => advanceCombatRoundStep(current), reviewState);
    const nextRoundState = advanceCombatRoundStep(roundSummaryState);

    expect(roundSummaryState.currentStep).toBe("round_summary");
    expect(nextRoundState.currentStep).toBe("select_actions");
    expect(nextRoundState.roundNumber).toBe(4);
    expect(nextRoundState.participants[0]?.stepStatuses.select_actions).toBe("pending");
  });

  it("sets the active participant marker", () => {
    const state = initializeCombatRoundState({ encounter: encounter() });
    const nextState = setCombatRoundActiveParticipant(state, "guard");

    expect(nextState.activeParticipantId).toBe("guard");
    expect(nextState.selectedParticipantId).toBe("guard");
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
    expect(inspector.status).toBe("complete");
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
