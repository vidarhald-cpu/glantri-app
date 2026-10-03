import type { CombatEffect } from "./combatEffects";
import type { RoundEndParticipantReview } from "./combatRoundManager";
import type { CanonicalCombatModifierDuration } from "./combatModifierLifecycle";

/** Client presentation only. Every field is selected explicitly from an approved public fact. */
export interface CombatRoundEndPublicMoment {
  readonly key: string;
  readonly kind:
    | "active_timed_effect"
    | "countdown_checkpoint"
    | "expiration"
    | "due_check"
    | "result";
  readonly label: string;
  readonly previous?: string;
  readonly next?: string;
}

function publicDuration(duration: CanonicalCombatModifierDuration | undefined): string | undefined {
  if (!duration) return undefined;
  if (duration.kind === "rounds") {
    return `${duration.remaining} round${duration.remaining === 1 ? "" : "s"}`;
  }
  if (duration.kind === "remainder_of_round") return "Remainder of round";
  if (duration.kind === "until_check") return "Awaiting check";
  return undefined;
}

/**
 * The source review and effects can contain private lifecycle data. This function never copies a
 * source object into its result; it constructs the narrow, participant-owned public chronology.
 */
export function buildCombatRoundEndPublicChronology(input: {
  effects?: readonly CombatEffect[];
  ownerParticipantIds: readonly string[];
  review?: RoundEndParticipantReview;
}): readonly CombatRoundEndPublicMoment[] {
  const review = input.review;
  if (!review || !input.ownerParticipantIds.includes(review.participantId)) return [];

  const effects = (input.effects ?? []).filter((effect) =>
    input.ownerParticipantIds.includes(effect.targetParticipantId),
  );
  const effectsById = new Map(effects.map((effect) => [effect.id, effect]));
  const legacyUpdatesByEffectId = new Map(
    review.proposedEffects.map((proposal) => [proposal.effectId, proposal]),
  );
  const legacyRemovalsByEffectId = new Map(
    review.proposedRemovals.map((proposal) => [proposal.effectId, proposal]),
  );
  const labelForEffect = (effectId: string): string => {
    const effect = effectsById.get(effectId);
    return (
      effect?.canonicalLifecycle?.publicLabel ??
      effect?.description ??
      legacyUpdatesByEffectId.get(effectId)?.label ??
      legacyRemovalsByEffectId.get(effectId)?.label ??
      "Timed effect"
    );
  };
  const moments: CombatRoundEndPublicMoment[] = [];
  const activeIds = new Set<string>();

  // The source effect is read only for its public name and current timer. Its transitions, notes,
  // diagnostics, correction metadata, and user identities never enter the result.
  for (const effect of effects) {
    if (effect.status !== "active" && effect.status !== "pending") continue;
    const current =
      publicDuration(effect.canonicalLifecycle?.lifecycle.duration) ?? effect.duration;
    if (!current) continue;
    activeIds.add(effect.id);
    moments.push({
      key: `active:${effect.id}`,
      kind: "active_timed_effect",
      label: labelForEffect(effect.id),
      previous: current,
    });
  }
  for (const proposal of review.canonicalReview?.proposals ?? []) {
    if (activeIds.has(proposal.effectId)) continue;
    activeIds.add(proposal.effectId);
    moments.push({
      key: `active:${proposal.id}`,
      kind: "active_timed_effect",
      label: labelForEffect(proposal.effectId),
      previous: publicDuration(proposal.priorDuration),
    });
  }
  for (const proposal of [...review.proposedEffects, ...review.proposedRemovals]) {
    if (activeIds.has(proposal.effectId)) continue;
    activeIds.add(proposal.effectId);
    moments.push({
      key: `active:${proposal.id}`,
      kind: "active_timed_effect",
      label: labelForEffect(proposal.effectId),
      previous: proposal.previousDuration,
    });
  }

  for (const proposal of review.proposedEffects) {
    if (!proposal.accepted) continue;
    moments.push({
      key: `countdown:${proposal.id}`,
      kind: "countdown_checkpoint",
      label: labelForEffect(proposal.effectId),
      previous: proposal.previousDuration,
      next: proposal.nextDuration,
    });
  }
  for (const proposal of review.canonicalReview?.proposals ?? []) {
    if (proposal.reason !== "duration_decremented") continue;
    if (legacyUpdatesByEffectId.has(proposal.effectId)) continue;
    moments.push({
      key: `countdown:${proposal.id}`,
      kind: "countdown_checkpoint",
      label: labelForEffect(proposal.effectId),
      previous: publicDuration(proposal.priorDuration),
      next: publicDuration(proposal.nextDuration),
    });
  }

  for (const proposal of review.proposedRemovals) {
    if (!proposal.accepted) continue;
    moments.push({
      key: `expiration:${proposal.id}`,
      kind: "expiration",
      label: labelForEffect(proposal.effectId),
      previous: proposal.previousDuration,
      next: "Expired",
    });
  }
  for (const proposal of review.canonicalReview?.proposals ?? []) {
    if (proposal.reason !== "natural_expiry") continue;
    if (legacyRemovalsByEffectId.has(proposal.effectId)) continue;
    moments.push({
      key: `expiration:${proposal.id}`,
      kind: "expiration",
      label: labelForEffect(proposal.effectId),
      previous: publicDuration(proposal.priorDuration),
      next: "Expired",
    });
  }

  for (const requirement of review.canonicalReview?.requirements ?? []) {
    if (requirement.resolved) continue;
    const label =
      requirement.kind === "health_check"
        ? "Health check"
        : requirement.kind === "recovery_check"
          ? "Recovery check"
          : requirement.kind === "condition"
            ? "Condition check"
            : "Check";
    moments.push({
      key: `due:${requirement.id}`,
      kind: "due_check",
      label,
      next: "Due",
    });
  }
  for (const proposal of review.proposedHealthRolls) {
    if (!proposal.accepted || proposal.status === "not_required") continue;
    moments.push({
      key: `due:${proposal.id}`,
      kind: "due_check",
      label: proposal.label,
      next: proposal.status === "pending" ? "Due" : "Rolled",
    });
  }
  for (const proposal of review.proposedHealthRolls) {
    if (!proposal.accepted || !proposal.result) continue;
    moments.push({
      key: `result:${proposal.id}`,
      kind: "result",
      label: proposal.label,
      next: proposal.result.success ? "Succeeded" : "Failed",
    });
  }
  return moments;
}
