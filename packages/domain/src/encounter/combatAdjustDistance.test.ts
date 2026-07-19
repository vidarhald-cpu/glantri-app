import { describe, expect, it } from "vitest";

import {
  buildCombatAdjustDistanceProposalId,
  combatAdjustDistanceProposalSchema,
  getCombatAdjustDistanceDirection,
  resolveCombatAdjustDistanceStandardProposal,
} from "./combatAdjustDistance";

describe("Adjust Distance-Attack proposal rules", () => {
  it("uses the established strict opposed-roll convention, so a tie is unsuccessful", () => {
    expect(
      resolveCombatAdjustDistanceStandardProposal({
        attackerTotal: 18,
        currentDistance: 3,
        defenderTotal: 18,
        requestedDistance: 2,
      }),
    ).toEqual({ difference: 0, outcome: "unsuccessful", proposedDistance: 3 });
    expect(
      resolveCombatAdjustDistanceStandardProposal({
        attackerTotal: 19,
        currentDistance: 3,
        defenderTotal: 18,
        requestedDistance: 2,
      }),
    ).toEqual({ difference: 1, outcome: "successful", proposedDistance: 2 });
  });

  it("allows the defender to grant the requested distance without rolls", () => {
    expect(
      resolveCombatAdjustDistanceStandardProposal({
        currentDistance: 3,
        defenderAllowed: true,
        requestedDistance: 2,
      }),
    ).toEqual({ outcome: "allowed", proposedDistance: 2 });
  });

  it("derives direction and a deterministic proposal identity", () => {
    expect(getCombatAdjustDistanceDirection({ currentDistance: 3, requestedDistance: 2 })).toBe(
      "closer",
    );
    expect(getCombatAdjustDistanceDirection({ currentDistance: 3, requestedDistance: 4 })).toBe(
      "farther",
    );
    expect(
      buildCombatAdjustDistanceProposalId({ attackerParticipantId: "scyrian", roundNumber: 2 }),
    ).toBe("combat-adjust-distance:round:2:attacker:scyrian");
  });

  it("preserves the focused persisted lifecycle shape", () => {
    expect(
      combatAdjustDistanceProposalSchema.parse({
        attackerParticipantId: "scyrian",
        currentDistance: 3,
        defenderParticipantId: "gladiator",
        direction: "closer",
        id: "proposal",
        pairId: "gladiator::scyrian",
        phase1OpportunityId: "a1",
        phase2AttackOpportunityId: "a2",
        requestedDistance: 2,
        roundNumber: 1,
      }),
    ).toEqual(expect.objectContaining({ defenderResponse: "pending", status: "awaiting_action_turn" }));
  });
});
