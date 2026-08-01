import { z } from "zod";

import {
  canonicalCombatModifierDurationSchema,
  canonicalCombatModifierLifecycleStateSchema,
} from "./combatModifierLifecycle";

const idSchema = z.string().min(1);

export const CANONICAL_COMBAT_SU_REVIEW_SCHEMA_VERSION = 1 as const;

export const canonicalCombatSuReviewStateSchema = z.enum([
  "pending",
  "blocked",
  "awaiting_roll",
  "awaiting_review",
  "ready",
  "committed",
  "failed",
  "undone",
]);

export const canonicalCombatSuRequirementSchema = z.object({
  blocksReview: z.boolean(),
  completeness: z.enum(["complete", "legacy_incomplete", "unsupported_ambiguity"]),
  effectId: idSchema.optional(),
  id: idSchema,
  kind: z.enum(["health_check", "recovery_check", "condition", "legacy_incomplete"]),
  label: z.string().min(1),
  owner: z.enum(["su", "source_process"]),
  resolved: z.boolean(),
});
export type CanonicalCombatSuRequirement = z.infer<typeof canonicalCombatSuRequirementSchema>;

export const canonicalCombatSuLifecycleProposalSchema = z.object({
  automatic: z.boolean(),
  effectId: idSchema,
  expectedEffectVersion: z.number().int().positive(),
  id: idSchema,
  mayOverride: z.boolean(),
  nextDuration: canonicalCombatModifierDurationSchema.optional(),
  nextState: canonicalCombatModifierLifecycleStateSchema,
  owner: z.literal("su"),
  priorDuration: canonicalCombatModifierDurationSchema,
  priorState: canonicalCombatModifierLifecycleStateSchema,
  reason: z.enum(["duration_decremented", "natural_expiry"]),
  transitionType: z.enum(["update", "expire"]),
});
export type CanonicalCombatSuLifecycleProposal = z.infer<
  typeof canonicalCombatSuLifecycleProposalSchema
>;

export const canonicalCombatSuReviewSchema = z.object({
  canonicalCutoff: z.number().int().nonnegative(),
  effectVersions: z.record(idSchema, z.number().int().positive()),
  participantId: idSchema,
  proposals: z.array(canonicalCombatSuLifecycleProposalSchema),
  requirements: z.array(canonicalCombatSuRequirementSchema),
  reviewId: idSchema,
  roundNumber: z.number().int().positive(),
  schemaVersion: z.literal(CANONICAL_COMBAT_SU_REVIEW_SCHEMA_VERSION),
  state: canonicalCombatSuReviewStateSchema,
});
export type CanonicalCombatSuReview = z.infer<typeof canonicalCombatSuReviewSchema>;

export function assertCanonicalCombatSuReviewEffectVersions(input: {
  currentVersions: Readonly<Record<string, number>>;
  review: CanonicalCombatSuReview;
}): void {
  for (const [effectId, expectedVersion] of Object.entries(input.review.effectVersions)) {
    if (input.currentVersions[effectId] !== expectedVersion) {
      throw new RangeError("Persistent effect state changed while the SU review was open.");
    }
  }
}
