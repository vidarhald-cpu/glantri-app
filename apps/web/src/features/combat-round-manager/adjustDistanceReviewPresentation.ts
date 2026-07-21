import type { CombatAdjustDistanceProposal } from "@glantri/domain";

export interface AdjustDistanceReviewPresentation {
  readonly actor: { readonly id: string; readonly label: string };
  readonly currentDistance: number;
  readonly legalDistances: readonly number[];
  readonly loser?: { readonly id: string; readonly label: string };
  readonly outcome: string;
  readonly proposedDistance: number;
  readonly requestedDistance: number;
  readonly target: { readonly id: string; readonly label: string };
  readonly winner?: { readonly id: string; readonly label: string };
}

const LEGAL_COMBAT_DISTANCES = Object.freeze([0, 1, 2, 3, 4, 5, 6, 7, 8]);

function subject(
  participantId: string,
  participantLabelsById: Readonly<Record<string, string>>,
): { id: string; label: string } {
  return { id: participantId, label: participantLabelsById[participantId] ?? participantId };
}

/** Builds the existing GM-adjustable review from authoritative proposal facts only. */
export function buildAdjustDistanceReviewPresentation(input: {
  participantLabelsById: Readonly<Record<string, string>>;
  proposal?: CombatAdjustDistanceProposal;
}): AdjustDistanceReviewPresentation | undefined {
  const proposal = input.proposal;
  if (!proposal || proposal.status !== "awaiting_review" || !proposal.standardOutcome) {
    return undefined;
  }
  const actor = subject(proposal.attackerParticipantId, input.participantLabelsById);
  const target = subject(proposal.defenderParticipantId, input.participantLabelsById);
  const winner =
    proposal.standardOutcome === "successful"
      ? actor
      : proposal.standardOutcome === "unsuccessful"
        ? target
        : undefined;
  const loser = winner?.id === actor.id ? target : winner ? actor : undefined;
  const outcome =
    proposal.standardOutcome === "allowed"
      ? `${target.label} allowed the movement.`
      : `${winner?.label ?? "The contest winner"} won the distance contest.`;

  return Object.freeze({
    actor,
    currentDistance: proposal.currentDistance,
    legalDistances: LEGAL_COMBAT_DISTANCES,
    loser,
    outcome,
    proposedDistance: proposal.standardProposedDistance ?? proposal.currentDistance,
    requestedDistance: proposal.requestedDistance,
    target,
    winner,
  });
}
