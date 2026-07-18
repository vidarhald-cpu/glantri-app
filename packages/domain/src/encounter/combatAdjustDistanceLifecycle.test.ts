import { describe, expect, it } from "vitest";

import {
  combatRoundStateSchema,
  commitCombatRoundAdjustDistance,
  getCombatRoundStartNextRoundBlocker,
  isCombatPhaseActionOpen,
  prepareCombatRoundEndReview,
  recordCombatRoundAdjustDistanceRoll,
  respondCombatRoundAdjustDistance,
  reviewCombatRoundAdjustDistanceRollAdjustment,
  undoLatestCombatRoundCommand,
} from "./combatRoundManager";

const createdAt = "2026-07-17T08:00:00.000Z";

function buildState() {
  return combatRoundStateSchema.parse({
    adjustDistanceProposals: [
      {
        attackerParticipantId: "scyrian",
        currentDistance: 3,
        defenderParticipantId: "gladiator",
        direction: "closer",
        id: "proposal",
        pairId: "gladiator::scyrian",
        phase1OpportunityId: "a1-maneuver",
        phase2AttackOpportunityId: "a2-attack",
        requestedDistance: 2,
        roundNumber: 1,
        status: "awaiting_defender_response",
      },
    ],
    currentCursor: { participantId: "scyrian", roundNumber: 1, step: "A1" },
    currentStep: "phase_1_actions",
    distanceState: {
      edges: {
        "gladiator::scyrian": {
          distance: 3,
          pairKey: "gladiator::scyrian",
          participantAId: "gladiator",
          participantBId: "scyrian",
          source: "gm_set",
        },
      },
    },
    phaseResolutionCursor: { participantId: "scyrian", phase: "phase1", substep: "adjust_distance" },
    participants: [
      {
        declaration: {
          actionId: "adjust_range_attack",
          adjustDistance: { currentDistance: 3, requestedDistance: 2, targetParticipantId: "gladiator" },
          attackOpportunities: [{ id: "a2-attack", origin: "adjust_range_attack", phase: "phase2", slot: "attack_2", targetParticipantId: "gladiator" }],
          phaseContexts: { phase1: { targetParticipantId: "gladiator" }, phase2: { targetParticipantId: "gladiator" } },
          roundNumber: 1,
          submittedBy: "player",
        },
        label: "Scyrian",
        participantId: "scyrian",
      },
      { label: "Gladiator", participantId: "gladiator" },
    ],
    roundNumber: 1,
  });
}

function roll(participantId: string, finalTotal: number, id: string) {
  return {
    dodgeSkillTotal: 6,
    finalTotal,
    generalFatigueModifier: 0,
    id,
    openEndedD10s: [],
    participantId,
    rollD20: 10,
    rollTotal: 10,
    rolledAt: createdAt,
    situationalAdjustment: 0,
  };
}

describe("Adjust Distance-Attack lifecycle", () => {
  it("opens A1 only after the canonical phase initiative commit", () => {
    const before = combatRoundStateSchema.parse({ ...buildState(), currentStep: "initiative_phase_1" });
    const after = combatRoundStateSchema.parse({ ...buildState(), currentStep: "phase_1_actions" });
    expect(isCombatPhaseActionOpen({ phase: "phase1", state: before })).toBe(false);
    expect(isCombatPhaseActionOpen({ phase: "phase1", state: after })).toBe(true);
    expect(isCombatPhaseActionOpen({ phase: "phase2", state: after })).toBe(false);
  });

  it("opposes, applies the GM adjustment once, resolves rolls, and commits the pair distance", () => {
    let state = respondCombatRoundAdjustDistance({ command: { createdAt }, proposalId: "proposal", response: "oppose", state: buildState() });
    state = reviewCombatRoundAdjustDistanceRollAdjustment({ command: { createdAt }, participantId: "scyrian", proposalId: "proposal", state, value: 2 });
    state = recordCombatRoundAdjustDistanceRoll({ command: { createdAt }, proposalId: "proposal", result: roll("scyrian", 20, "attacker-roll"), state });
    expect(state.adjustDistanceProposals[0]).toEqual(
      expect.objectContaining({ attackerRollRecorded: true, defenderRollRecorded: false }),
    );
    state = recordCombatRoundAdjustDistanceRoll({ command: { createdAt }, proposalId: "proposal", result: roll("gladiator", 18, "defender-roll"), state });
    expect(state.adjustDistanceProposals[0]).toEqual(expect.objectContaining({ attackerRollRecorded: true, defenderRollRecorded: true, difference: 2, standardOutcome: "successful", standardProposedDistance: 2, status: "awaiting_review" }));
    state = commitCombatRoundAdjustDistance({ command: { createdAt }, committedDistance: 2, outcome: "successful", proposalId: "proposal", state });
    expect(state.distanceState.edges["gladiator::scyrian"]?.distance).toBe(2);
    expect(state.adjustDistanceProposals[0]?.status).toBe("committed");
    expect(state.participants[0]?.declaration?.attackOpportunities?.[0]).toEqual(expect.objectContaining({ phase: "phase2", status: "committed" }));
  });

  it("Allow skips both Dodge rolls but still requires a GM commit", () => {
    const state = respondCombatRoundAdjustDistance({ command: { createdAt }, proposalId: "proposal", response: "allow", state: buildState() });
    expect(state.adjustDistanceProposals[0]).toEqual(expect.objectContaining({ standardOutcome: "allowed", standardProposedDistance: 2, status: "awaiting_review" }));
    expect(state.adjustDistanceProposals[0]?.attackerRoll).toBeUndefined();
  });

  it("accepts signed GM adjustments without policing the suggested range", () => {
    let state = respondCombatRoundAdjustDistance({ command: { createdAt }, proposalId: "proposal", response: "oppose", state: buildState() });
    state = reviewCombatRoundAdjustDistanceRollAdjustment({ command: { createdAt }, participantId: "gladiator", proposalId: "proposal", state, value: -10 });
    expect(state.adjustDistanceProposals[0]?.gmRollAdjustment).toEqual(
      expect.objectContaining({ participantId: "gladiator", value: -10 }),
    );
  });

  it("rejects non-integer GM adjustments with the focused validation error", () => {
    const state = respondCombatRoundAdjustDistance({ command: { createdAt }, proposalId: "proposal", response: "oppose", state: buildState() });
    expect(() =>
      reviewCombatRoundAdjustDistanceRollAdjustment({
        command: { createdAt },
        participantId: "gladiator",
        proposalId: "proposal",
        state,
        value: 1.5,
      }),
    ).toThrow("Maneuver adjustment must be an integer.");
  });

  it("does not create a duplicate SU contest after an in-round commit", () => {
    let state = respondCombatRoundAdjustDistance({ command: { createdAt }, proposalId: "proposal", response: "allow", state: buildState() });
    state = commitCombatRoundAdjustDistance({ command: { createdAt }, committedDistance: 3, outcome: "allowed", proposalId: "proposal", state });
    state = combatRoundStateSchema.parse({
      ...state,
      currentCursor: { roundNumber: 1, step: "SU" },
      currentStep: "round_summary",
      participants: state.participants.map((participant) =>
        participant.participantId === "scyrian"
          ? {
              ...participant,
              declaration: {
                ...participant.declaration,
                movementIntent: {
                  distancePreferences: [{ desiredDistance: 2, source: "player_declared", targetParticipantId: "gladiator" }],
                  mode: "set_distance_preferences",
                },
              },
            }
          : participant,
      ),
    });
    const reviewed = prepareCombatRoundEndReview({ state });
    expect(reviewed.roundEndReview?.proposedDistances).toHaveLength(0);
    expect(getCombatRoundStartNextRoundBlocker(reviewed)).toBeDefined();
  });

  it("undoes the commit atomically and restores the review and prior pair distance", () => {
    let state = respondCombatRoundAdjustDistance({ command: { createdAt }, proposalId: "proposal", response: "allow", state: buildState() });
    state = commitCombatRoundAdjustDistance({ command: { createdAt }, committedDistance: 2, outcome: "allowed", proposalId: "proposal", state });

    const undone = undoLatestCombatRoundCommand({ state });

    expect(undone?.distanceState.edges["gladiator::scyrian"]?.distance).toBe(3);
    expect(undone?.adjustDistanceProposals[0]).toEqual(
      expect.objectContaining({
        defenderResponse: "allow",
        status: "awaiting_review",
      }),
    );
    expect(undone?.participants[0]?.stepStatuses.phase_1_actions).toBe("ready");
    expect(undone?.events.some((event) => event.type === "adjust_distance_committed")).toBe(false);
  });
});
