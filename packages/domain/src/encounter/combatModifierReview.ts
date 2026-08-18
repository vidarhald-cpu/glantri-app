import { z } from "zod";

import {
  CANONICAL_COMBAT_MODIFIER_LIFECYCLE_SCHEMA_VERSION,
  canonicalCombatModifierApplicabilitySchema,
  canonicalCombatModifierDurationSchema,
  canonicalCombatModifierEffectSchema,
  canonicalCombatModifierLifecycleTransitionSchema,
  canonicalCombatModifierPayloadSchema,
  canonicalCombatModifierTransitionReasonSchema,
  canonicalCombatModifierTransitionTypeSchema,
  transitionCanonicalCombatModifierEffect,
  projectPlayerSafeCanonicalCombatModifierEffect,
  type CanonicalCombatModifierEffect,
  type CanonicalCombatModifierDuration,
  type CanonicalCombatModifierLifecycleTransition,
  type CanonicalCombatModifierNumericCategory,
  type CanonicalCombatModifierViewer,
} from "./combatModifierLifecycle";

const idSchema = z.string().min(1);
const revisionSchema = z.string().min(1);
const sequenceSchema = z.number().int().nonnegative();

export const CANONICAL_COMBAT_MODIFIER_REVIEW_SCHEMA_VERSION = 1 as const;

export const canonicalCombatModifierReviewPhaseSchema = z.enum(["M1", "M2"]);
export type CanonicalCombatModifierReviewPhase = z.infer<
  typeof canonicalCombatModifierReviewPhaseSchema
>;

export const canonicalCombatModifierReviewStateSchema = z.enum([
  "pending",
  "blocked",
  "ready",
  "committing",
  "committed",
  "failed",
  "undone",
]);
export type CanonicalCombatModifierReviewState = z.infer<
  typeof canonicalCombatModifierReviewStateSchema
>;

export const canonicalCombatModifierReviewRequiredRollSchema = z.object({
  blocksReview: z.boolean(),
  id: idSchema,
  kind: z.enum(["health", "recovery", "skill", "stat", "gm_review"]),
  owner: z.enum(["modifier_review", "su"]),
  resolved: z.boolean(),
  sourceEffectId: idSchema.optional(),
});
export type CanonicalCombatModifierReviewRequiredRoll = z.infer<
  typeof canonicalCombatModifierReviewRequiredRollSchema
>;

export const canonicalCombatModifierReviewProposalSchema = z.object({
  effectId: idSchema,
  expectedVersion: z.number().int().positive(),
  id: idSchema,
  mayOverride: z.boolean(),
  nextApplicability: canonicalCombatModifierApplicabilitySchema.optional(),
  nextDuration: canonicalCombatModifierDurationSchema.optional(),
  nextPayload: canonicalCombatModifierPayloadSchema.optional(),
  nextState: z.enum([
    "pending_activation",
    "active",
    "resolved",
    "consumed",
    "expired",
    "removed",
    "superseded",
  ]),
  owner: z.enum(["modifier_review", "su", "source_process"]),
  reason: canonicalCombatModifierTransitionReasonSchema,
  transitionType: canonicalCombatModifierTransitionTypeSchema.exclude(["restore"]),
});
export type CanonicalCombatModifierReviewProposal = z.infer<
  typeof canonicalCombatModifierReviewProposalSchema
>;

const additionSchema = z.object({
  decisionId: idSchema,
  effect: canonicalCombatModifierEffectSchema,
  kind: z.literal("add"),
});

const editSchema = z.object({
  decisionId: idSchema,
  effectId: idSchema,
  expectedVersion: z.number().int().positive(),
  kind: z.literal("edit"),
  nextApplicability: canonicalCombatModifierApplicabilitySchema.optional(),
  nextDuration: canonicalCombatModifierDurationSchema.optional(),
  nextPayload: canonicalCombatModifierPayloadSchema.optional(),
  nextPublicLabel: z.string().min(1).optional(),
  nextPublicNote: z.string().min(1).optional(),
});

const replacementSchema = z.object({
  decisionId: idSchema,
  effectId: idSchema,
  expectedVersion: z.number().int().positive(),
  kind: z.literal("replace"),
  replacement: canonicalCombatModifierEffectSchema,
});

const removalSchema = z.object({
  decisionId: idSchema,
  effectId: idSchema,
  expectedVersion: z.number().int().positive(),
  kind: z.literal("remove"),
  publicNote: z.string().min(1).optional(),
});

const acceptProposalDecisionSchema = z.object({
  decisionId: idSchema,
  kind: z.literal("accept_proposal"),
  proposalId: idSchema,
  publicNote: z.string().min(1).optional(),
});

const retainProposalDecisionSchema = z.object({
  decisionId: idSchema,
  kind: z.literal("retain"),
  proposalId: idSchema,
  publicNote: z.string().min(1).optional(),
});

export const canonicalCombatModifierReviewDecisionSchema = z.discriminatedUnion("kind", [
  additionSchema,
  editSchema,
  replacementSchema,
  removalSchema,
  acceptProposalDecisionSchema,
  retainProposalDecisionSchema,
]);
export type CanonicalCombatModifierReviewDecision = z.infer<
  typeof canonicalCombatModifierReviewDecisionSchema
>;

export const canonicalCombatModifierReviewInputSchema = z.object({
  automaticProposals: z.array(canonicalCombatModifierReviewProposalSchema).default([]),
  batchId: idSchema.optional(),
  canonicalCutoff: sequenceSchema,
  decisions: z.array(canonicalCombatModifierReviewDecisionSchema).default([]),
  encounterId: idSchema,
  expectedEncounterRevision: revisionSchema,
  inputEffects: z.array(canonicalCombatModifierEffectSchema),
  participantId: idSchema,
  phase: canonicalCombatModifierReviewPhaseSchema,
  publicNote: z.string().min(1).optional(),
  requiredRolls: z.array(canonicalCombatModifierReviewRequiredRollSchema).default([]),
  reviewId: idSchema,
  roundNumber: z.number().int().positive(),
  schemaVersion: z.literal(CANONICAL_COMBAT_MODIFIER_REVIEW_SCHEMA_VERSION),
});
export type CanonicalCombatModifierReviewInput = z.infer<
  typeof canonicalCombatModifierReviewInputSchema
>;

export const canonicalCombatModifierReviewChangeSchema = z.object({
  effectId: idSchema,
  kind: z.enum([
    "added",
    "edited",
    "replaced",
    "removed",
    "expired",
    "consumed",
    "resolved",
    "retained",
    "rejected_proposal",
  ]),
  nextVersion: z.number().int().positive().optional(),
  priorVersion: z.number().int().positive().optional(),
  proposalId: idSchema.optional(),
  publicLabel: z.string().min(1),
});
export type CanonicalCombatModifierReviewChange = z.infer<
  typeof canonicalCombatModifierReviewChangeSchema
>;

export const canonicalCombatModifierReviewTransactionSchema = z.object({
  acceptedRevision: revisionSchema,
  acceptedSequence: sequenceSchema,
  changes: z.array(canonicalCombatModifierReviewChangeSchema),
  commandId: idSchema,
  input: canonicalCombatModifierReviewInputSchema,
  outputEffects: z.array(canonicalCombatModifierEffectSchema),
  reviewState: z.literal("committed"),
  schemaVersion: z.literal(CANONICAL_COMBAT_MODIFIER_REVIEW_SCHEMA_VERSION),
  transitions: z.array(canonicalCombatModifierLifecycleTransitionSchema),
});
export type CanonicalCombatModifierReviewTransaction = z.infer<
  typeof canonicalCombatModifierReviewTransactionSchema
>;

export const canonicalCombatModifierReviewPublicChangeSchema = z.object({
  category: z.string().min(1),
  changeType: canonicalCombatModifierReviewChangeSchema.shape.kind,
  duration: z.string().min(1).optional(),
  label: z.string().min(1),
  previousDuration: z.string().min(1).optional(),
  previousValue: z.number().finite().optional(),
  unit: z.string().min(1).optional(),
  value: z.number().finite().optional(),
});

export const canonicalCombatModifierReviewPublicResultSchema = z.object({
  changed: z.boolean(),
  changes: z.array(canonicalCombatModifierReviewPublicChangeSchema),
  publicNote: z.string().min(1).optional(),
  resultLabel: z.string().min(1),
  schemaVersion: z.literal(CANONICAL_COMBAT_MODIFIER_REVIEW_SCHEMA_VERSION),
});
export type CanonicalCombatModifierReviewPublicResult = z.infer<
  typeof canonicalCombatModifierReviewPublicResultSchema
>;

export class CanonicalCombatModifierReviewError extends RangeError {
  constructor(
    readonly code:
      | "blocked_required_roll"
      | "duplicate_effect"
      | "illegal_decision"
      | "stale_effect_version"
      | "stale_review",
    message: string,
  ) {
    super(message);
    this.name = "CanonicalCombatModifierReviewError";
  }
}

export function getCanonicalCombatModifierReviewState(
  input: CanonicalCombatModifierReviewInput,
): CanonicalCombatModifierReviewState {
  const review = canonicalCombatModifierReviewInputSchema.parse(input);
  return review.requiredRolls.some((roll) => roll.blocksReview && !roll.resolved)
    ? "blocked"
    : "ready";
}

function ensureExpectedVersion(
  effectsById: Map<string, CanonicalCombatModifierEffect>,
  effectId: string,
  expectedVersion: number,
): CanonicalCombatModifierEffect {
  const effect = effectsById.get(effectId);
  if (!effect || effect.version !== expectedVersion) {
    throw new CanonicalCombatModifierReviewError(
      "stale_effect_version",
      `Combat modifier ${effectId} changed while the review was open.`,
    );
  }
  return effect;
}

function changeKindForProposal(
  proposal: CanonicalCombatModifierReviewProposal,
): CanonicalCombatModifierReviewChange["kind"] {
  if (proposal.nextState === "expired") return "expired";
  if (proposal.nextState === "consumed") return "consumed";
  if (proposal.nextState === "resolved") return "resolved";
  if (proposal.nextState === "removed") return "removed";
  return "edited";
}

function appendTransition(input: {
  acceptedRevision: string;
  acceptedSequence: number;
  commandId: string;
  effect: CanonicalCombatModifierEffect;
  nextApplicability?: z.infer<typeof canonicalCombatModifierApplicabilitySchema>;
  nextDuration?: z.infer<typeof canonicalCombatModifierDurationSchema>;
  nextPayload?: z.infer<typeof canonicalCombatModifierPayloadSchema>;
  nextPublicLabel?: string;
  nextPublicNote?: string;
  nextState: CanonicalCombatModifierEffect["lifecycle"]["state"];
  publicNote?: string;
  reason: z.infer<typeof canonicalCombatModifierTransitionReasonSchema>;
  replacementEffectId?: string;
  transitionId: string;
  transitionType: Exclude<z.infer<typeof canonicalCombatModifierTransitionTypeSchema>, "restore">;
}): { effect: CanonicalCombatModifierEffect; transition: CanonicalCombatModifierLifecycleTransition } {
  return transitionCanonicalCombatModifierEffect(input);
}

/**
 * Applies one participant-scoped review in memory. Persistence callers must commit the returned
 * effect set together with the encounter command that stores this exact transaction.
 */
export function commitCanonicalCombatModifierReview(input: {
  acceptedRevision: string;
  acceptedSequence: number;
  commandId: string;
  review: CanonicalCombatModifierReviewInput;
}): CanonicalCombatModifierReviewTransaction {
  const review = canonicalCombatModifierReviewInputSchema.parse(input.review);
  if (getCanonicalCombatModifierReviewState(review) === "blocked") {
    throw new CanonicalCombatModifierReviewError(
      "blocked_required_roll",
      "Resolve the required modifier-review roll before committing.",
    );
  }
  if (review.expectedEncounterRevision !== input.acceptedRevision) {
    throw new CanonicalCombatModifierReviewError(
      "stale_review",
      "Combat state changed while the modifier review was open.",
    );
  }

  const effectsById = new Map<string, CanonicalCombatModifierEffect>();
  for (const effect of review.inputEffects) {
    if (effect.ownerParticipantId !== review.participantId) {
      throw new CanonicalCombatModifierReviewError(
        "illegal_decision",
        "A modifier review may only contain effects owned by its participant.",
      );
    }
    if (effectsById.has(effect.id)) {
      throw new CanonicalCombatModifierReviewError(
        "duplicate_effect",
        `Combat modifier ${effect.id} appears more than once in the review.`,
      );
    }
    effectsById.set(effect.id, effect);
  }

  const proposalsById = new Map(review.automaticProposals.map((proposal) => [proposal.id, proposal]));
  const transitions: CanonicalCombatModifierLifecycleTransition[] = [];
  const changes: CanonicalCombatModifierReviewChange[] = [];
  const decidedProposalIds = new Set<string>();

  for (const decision of review.decisions) {
    if (decision.kind === "add") {
      const effect = canonicalCombatModifierEffectSchema.parse(decision.effect);
      if (
        effect.ownerParticipantId !== review.participantId ||
        effect.schemaVersion !== CANONICAL_COMBAT_MODIFIER_LIFECYCLE_SCHEMA_VERSION ||
        effectsById.has(effect.id)
      ) {
        throw new CanonicalCombatModifierReviewError(
          "illegal_decision",
          "The added modifier does not match this participant review.",
        );
      }
      effectsById.set(effect.id, effect);
      changes.push({
        effectId: effect.id,
        kind: "added",
        nextVersion: effect.version,
        publicLabel: effect.publicLabel,
      });
      continue;
    }

    if (decision.kind === "accept_proposal" || decision.kind === "retain") {
      const proposal = proposalsById.get(decision.proposalId);
      if (!proposal || decidedProposalIds.has(proposal.id)) {
        throw new CanonicalCombatModifierReviewError(
          "illegal_decision",
          "The modifier proposal is no longer available.",
        );
      }
      const effect = ensureExpectedVersion(
        effectsById,
        proposal.effectId,
        proposal.expectedVersion,
      );
      decidedProposalIds.add(proposal.id);
      if (proposal.owner !== "modifier_review") {
        throw new CanonicalCombatModifierReviewError(
          "illegal_decision",
          "This modifier transition belongs to another canonical process.",
        );
      }
      if (decision.kind === "retain") {
        if (!proposal.mayOverride) {
          throw new CanonicalCombatModifierReviewError(
            "illegal_decision",
            "This automatic modifier transition cannot be overridden.",
          );
        }
        const transitioned = appendTransition({
          acceptedRevision: input.acceptedRevision,
          acceptedSequence: input.acceptedSequence,
          commandId: input.commandId,
          effect,
          nextState: effect.lifecycle.state,
          publicNote: decision.publicNote,
          reason: "review_rejected",
          transitionId: `${review.reviewId}:${decision.decisionId}`,
          transitionType: "update",
        });
        effectsById.set(effect.id, transitioned.effect);
        transitions.push(transitioned.transition);
        changes.push({
          effectId: effect.id,
          kind: "retained",
          nextVersion: transitioned.effect.version,
          priorVersion: effect.version,
          proposalId: proposal.id,
          publicLabel: transitioned.effect.publicLabel,
        });
        continue;
      }
      const transitioned = appendTransition({
        acceptedRevision: input.acceptedRevision,
        acceptedSequence: input.acceptedSequence,
        commandId: input.commandId,
        effect,
        nextApplicability: proposal.nextApplicability,
        nextDuration: proposal.nextDuration,
        nextPayload: proposal.nextPayload,
        nextState: proposal.nextState,
        publicNote: decision.publicNote,
        reason: proposal.reason,
        transitionId: `${review.reviewId}:${decision.decisionId}`,
        transitionType: proposal.transitionType,
      });
      effectsById.set(effect.id, transitioned.effect);
      transitions.push(transitioned.transition);
      changes.push({
        effectId: effect.id,
        kind: changeKindForProposal(proposal),
        nextVersion: transitioned.effect.version,
        priorVersion: effect.version,
        proposalId: proposal.id,
        publicLabel: transitioned.effect.publicLabel,
      });
      continue;
    }

    const effect = ensureExpectedVersion(
      effectsById,
      decision.effectId,
      decision.expectedVersion,
    );
    if (decision.kind === "edit") {
      if (
        decision.nextPayload &&
        (decision.nextPayload.kind !== effect.payload.kind ||
          (decision.nextPayload.kind === "numeric" &&
            effect.payload.kind === "numeric" &&
            (decision.nextPayload.category !== effect.payload.category ||
              decision.nextPayload.unit !== effect.payload.unit)))
      ) {
        throw new CanonicalCombatModifierReviewError(
          "illegal_decision",
          "Changing modifier kind, category, or unit requires replacement.",
        );
      }
      const transitioned = appendTransition({
        acceptedRevision: input.acceptedRevision,
        acceptedSequence: input.acceptedSequence,
        commandId: input.commandId,
        effect,
        nextApplicability: decision.nextApplicability,
        nextDuration: decision.nextDuration,
        nextPayload: decision.nextPayload,
        nextPublicLabel: decision.nextPublicLabel,
        nextPublicNote: decision.nextPublicNote,
        nextState: effect.lifecycle.state,
        reason: "review_accepted",
        transitionId: `${review.reviewId}:${decision.decisionId}`,
        transitionType: "update",
      });
      effectsById.set(effect.id, transitioned.effect);
      transitions.push(transitioned.transition);
      changes.push({
        effectId: effect.id,
        kind: "edited",
        nextVersion: transitioned.effect.version,
        priorVersion: effect.version,
        publicLabel: transitioned.effect.publicLabel,
      });
      continue;
    }
    if (decision.kind === "remove") {
      const transitioned = appendTransition({
        acceptedRevision: input.acceptedRevision,
        acceptedSequence: input.acceptedSequence,
        commandId: input.commandId,
        effect,
        nextState: "removed",
        publicNote: decision.publicNote,
        reason: "gm_removed",
        transitionId: `${review.reviewId}:${decision.decisionId}`,
        transitionType: "remove",
      });
      effectsById.set(effect.id, transitioned.effect);
      transitions.push(transitioned.transition);
      changes.push({
        effectId: effect.id,
        kind: "removed",
        nextVersion: transitioned.effect.version,
        priorVersion: effect.version,
        publicLabel: transitioned.effect.publicLabel,
      });
      continue;
    }

    const replacement = canonicalCombatModifierEffectSchema.parse(decision.replacement);
    if (
      replacement.ownerParticipantId !== review.participantId ||
      replacement.id === effect.id ||
      effectsById.has(replacement.id)
    ) {
      throw new CanonicalCombatModifierReviewError(
        "illegal_decision",
        "The replacement modifier identity is invalid.",
      );
    }
    const transitioned = appendTransition({
      acceptedRevision: input.acceptedRevision,
      acceptedSequence: input.acceptedSequence,
      commandId: input.commandId,
      effect,
      nextState: "superseded",
      reason: "replaced",
      replacementEffectId: replacement.id,
      transitionId: `${review.reviewId}:${decision.decisionId}:supersede`,
      transitionType: "supersede",
    });
    effectsById.set(effect.id, transitioned.effect);
    effectsById.set(replacement.id, replacement);
    transitions.push(transitioned.transition);
    changes.push({
      effectId: effect.id,
      kind: "replaced",
      nextVersion: transitioned.effect.version,
      priorVersion: effect.version,
      publicLabel: replacement.publicLabel,
    });
  }

  return canonicalCombatModifierReviewTransactionSchema.parse({
    acceptedRevision: input.acceptedRevision,
    acceptedSequence: input.acceptedSequence,
    changes,
    commandId: input.commandId,
    input: review,
    outputEffects: [...effectsById.values()].sort((left, right) => left.id.localeCompare(right.id)),
    reviewState: "committed",
    schemaVersion: CANONICAL_COMBAT_MODIFIER_REVIEW_SCHEMA_VERSION,
    transitions,
  });
}

export function getCanonicalCombatModifierReviewResultLabel(
  transaction: CanonicalCombatModifierReviewTransaction,
): string {
  return transaction.changes.length === 0 ? "No changes" : "Changes accepted";
}

function reviewCategoryLabel(effect: CanonicalCombatModifierEffect): string {
  if (effect.payload.kind === "restriction") return "Condition";
  const labels: Record<CanonicalCombatModifierNumericCategory, string> = {
    bleed_rate: "Bleed",
    damage: "Damage",
    db_parry: "DB/Parry",
    general_fatigue: "General/Fatigue",
    initiative: "Initiative",
    integer_count: "Count",
    movement_modifier: "Movement Modifier",
    skill_ob: "Skill/OB",
  };
  return labels[effect.payload.category];
}

function reviewDurationLabel(duration: CanonicalCombatModifierDuration): string | undefined {
  switch (duration.kind) {
    case "phase":
      return duration.phase === "phase1" ? "Phase 1" : "Phase 2";
    case "attack_opportunity_count":
      return `${duration.remaining} attack${duration.remaining === 1 ? "" : "s"}`;
    case "rounds":
      return `${duration.remaining} round${duration.remaining === 1 ? "" : "s"}`;
    case "until_check":
      return `Until ${duration.check.checkKind} check`;
    case "until_condition":
      return "Until condition clears";
    case "relationship":
      return "While relationship remains";
    case "manual":
      return "Until removed";
    case "indefinite":
      return "Indefinite";
    case "legacy_untyped":
      return undefined;
  }
}

/**
 * Removes lifecycle identities, versions, private diagnostics, and hidden effect facts before a
 * review result is placed in player-safe command state or event presentation.
 */
export function projectCanonicalCombatModifierReviewPublicResult(input: {
  transaction: CanonicalCombatModifierReviewTransaction;
  viewer?: CanonicalCombatModifierViewer;
}): CanonicalCombatModifierReviewPublicResult {
  const transaction = canonicalCombatModifierReviewTransactionSchema.parse(input.transaction);
  const inputById = new Map(transaction.input.inputEffects.map((effect) => [effect.id, effect]));
  const outputById = new Map(transaction.outputEffects.map((effect) => [effect.id, effect]));
  const changes = transaction.changes.flatMap((change) => {
    const previous = inputById.get(change.effectId);
    const current = outputById.get(change.effectId);
    const rawEffect = current ?? previous;
    if (!rawEffect) return [];
    const effect = input.viewer
      ? projectPlayerSafeCanonicalCombatModifierEffect({ effect: rawEffect, viewer: input.viewer })
      : rawEffect;
    if (!effect) return [];
    const visiblePrevious = previous
      ? input.viewer
        ? projectPlayerSafeCanonicalCombatModifierEffect({ effect: previous, viewer: input.viewer })
        : previous
      : undefined;
    const numericCurrent = effect.payload.kind === "numeric" ? effect.payload : undefined;
    const numericPrevious =
      visiblePrevious?.payload.kind === "numeric" ? visiblePrevious.payload : undefined;
    return [
      {
        category: reviewCategoryLabel(rawEffect),
        changeType: change.kind,
        duration: reviewDurationLabel(effect.lifecycle.duration),
        label: effect.publicLabel,
        previousDuration: visiblePrevious
          ? reviewDurationLabel(visiblePrevious.lifecycle.duration)
          : undefined,
        previousValue: numericPrevious?.value,
        unit: numericCurrent?.unit ?? numericPrevious?.unit,
        value: numericCurrent?.value,
      },
    ];
  });

  return canonicalCombatModifierReviewPublicResultSchema.parse({
    changed: changes.length > 0,
    changes,
    publicNote: transaction.input.publicNote,
    resultLabel: changes.length === 0 ? "No changes" : "Changes accepted",
    schemaVersion: CANONICAL_COMBAT_MODIFIER_REVIEW_SCHEMA_VERSION,
  });
}
