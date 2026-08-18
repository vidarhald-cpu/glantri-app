import { describe, expect, it } from "vitest";

import type { CombatAdjustDistanceProposal } from "@glantri/domain";

import { buildAdjustDistanceReviewPresentation } from "./adjustDistanceReviewPresentation";

function proposal(
  overrides: Partial<CombatAdjustDistanceProposal> = {},
): CombatAdjustDistanceProposal {
  return {
    attackerParticipantId: "rider",
    attackerRollRecorded: true,
    currentDistance: 3,
    defenderParticipantId: "guard",
    defenderResponse: "oppose",
    defenderRollRecorded: true,
    direction: "closer",
    id: "distance-proposal",
    pairId: "guard::rider",
    phase1OpportunityId: "phase1-opportunity",
    phase2AttackOpportunityId: "phase2-opportunity",
    requestedDistance: 2,
    roundNumber: 1,
    standardOutcome: "successful",
    standardProposedDistance: 2,
    standardTableRowId: "initiator_wins",
    status: "awaiting_review",
    ...overrides,
  };
}

describe("Adjust Distance review presentation", () => {
  it("shows the actor, target, winner, distances, and existing legal GM adjustment range", () => {
    expect(
      buildAdjustDistanceReviewPresentation({
        participantLabelsById: { guard: "The Gladiator", rider: "Scyrian Cavalry" },
        proposal: proposal(),
      }),
    ).toEqual({
      actor: { id: "rider", label: "Scyrian Cavalry" },
      applicableTableRowId: "initiator_wins",
      currentDistance: 3,
      legalDistances: [0, 1, 2, 3, 4, 5, 6, 7, 8],
      loser: { id: "guard", label: "The Gladiator" },
      outcome: "Scyrian Cavalry won the distance contest.",
      proposedDistance: 2,
      requestedDistance: 2,
      target: { id: "guard", label: "The Gladiator" },
      tableRows: [
        expect.objectContaining({ id: "defender_allows" }),
        expect.objectContaining({ id: "initiator_wins" }),
        expect.objectContaining({ id: "tie_or_opponent_wins" }),
      ],
      winner: { id: "rider", label: "Scyrian Cavalry" },
    });
  });

  it("shows the defender as winner on failure and handles the allow path without a loser", () => {
    expect(
      buildAdjustDistanceReviewPresentation({
        participantLabelsById: { guard: "Guard", rider: "Rider" },
        proposal: proposal({
          standardOutcome: "unsuccessful",
          standardProposedDistance: 3,
          standardTableRowId: "tie_or_opponent_wins",
        }),
      }),
    ).toMatchObject({
      loser: { id: "rider" },
      outcome: "Guard won the distance contest.",
      proposedDistance: 3,
      winner: { id: "guard" },
    });
    expect(
      buildAdjustDistanceReviewPresentation({
        participantLabelsById: { guard: "Guard", rider: "Rider" },
        proposal: proposal({
          defenderResponse: "allow",
          standardOutcome: "allowed",
          standardTableRowId: "defender_allows",
        }),
      }),
    ).toMatchObject({
      outcome: "Guard allowed the movement.",
      winner: undefined,
    });
  });

  it("does not expose review controls before the proposal is ready", () => {
    expect(
      buildAdjustDistanceReviewPresentation({
        participantLabelsById: {},
        proposal: proposal({ status: "awaiting_rolls" }),
      }),
    ).toBeUndefined();
  });
});
