import { z } from "zod";

import type { ActiveCombatRoundState, CombatRoundPhase } from "../combatRoundManager";
import type {
  CanonicalCombatModifierReviewInput,
  CanonicalCombatModifierReviewPhase,
} from "../combatModifierReview";

const idSchema = z.string().min(1);

export const CANONICAL_COMBAT_PARTICIPATION_SCHEMA_VERSION = 1 as const;

export const combatParticipationStatusSchema = z.enum([
  "required",
  "conditional",
  "not_required",
  "blocked",
  "already_resolved",
]);
export type CombatParticipationStatus = z.infer<typeof combatParticipationStatusSchema>;

export const combatParticipationWorkClassSchema = z.enum([
  "human_decision",
  "player_roll",
  "gm_roll",
  "deterministic_transition",
  "no_work",
]);
export type CombatParticipationWorkClass = z.infer<typeof combatParticipationWorkClassSchema>;

export const combatParticipationCompletenessSchema = z.enum([
  "complete",
  "partial",
  "legacy_incomplete",
  "unsupported",
]);
export type CombatParticipationCompleteness = z.infer<typeof combatParticipationCompletenessSchema>;

export const combatParticipationOrderingSchema = z.enum([
  "none",
  "participant_sequence",
  "initiative_order",
  "initiative_group",
  "pair_order",
  "ownerless_boundary",
]);
export type CombatParticipationOrdering = z.infer<typeof combatParticipationOrderingSchema>;

export const combatParticipationProcessFamilySchema = z.enum([
  "combat_start_experience",
  "declaration",
  "modifier_review",
  "initiative",
  "phase_action",
  "phase_response",
  "damage_chain",
  "double_attack_decision",
  "phase_combat_experience",
  "feint",
  "adjust_distance",
  "offensive_parry",
  "continued_contact",
  "observation",
  "distance_control",
  "health_bleed",
  "effect_review",
  "participant_completion",
  "boundary",
]);
export type CombatParticipationProcessFamily = z.infer<
  typeof combatParticipationProcessFamilySchema
>;

export const combatParticipationReasonSchema = z.enum([
  "combat_experience_roll_required",
  "no_combat_experience_work",
  "declaration_required",
  "modifier_review_required",
  "automatic_modifier_transition",
  "no_modifier_work",
  "executable_phase_action",
  "no_executable_phase_action",
  "initiative_order_required",
  "sole_actor_order_irrelevant",
  "attack_opportunity",
  "response_required",
  "damage_chain_required",
  "health_check_due",
  "observation_attempt_due",
  "distance_control_due",
  "continued_contact_due",
  "effect_review_required",
  "no_su_work",
  "deterministic_boundary",
  "unresolved_choice",
  "stale_or_invalid_source",
  "already_resolved",
]);
export type CombatParticipationReason = z.infer<typeof combatParticipationReasonSchema>;

export const combatParticipationOwnershipKindSchema = z.enum([
  "player_owned",
  "gm_controlled_participant",
  "gm_proxy",
  "gm_owned",
  "ownerless",
  "shared_pair",
  "unknown",
]);
export type CombatParticipationOwnershipKind = z.infer<
  typeof combatParticipationOwnershipKindSchema
>;

export const combatParticipationPairRoleSchema = z.object({
  authority: z.enum(["player", "gm", "unknown"]),
  participantId: idSchema,
  role: z.string().min(1),
});
export type CombatParticipationPairRole = z.infer<typeof combatParticipationPairRoleSchema>;

export const combatParticipationOwnershipSchema = z.object({
  kind: combatParticipationOwnershipKindSchema,
  participantId: idSchema.optional(),
  proxyUserId: idSchema.optional(),
  roles: z.array(combatParticipationPairRoleSchema).optional(),
});
export type CombatParticipationOwnership = z.infer<typeof combatParticipationOwnershipSchema>;

export const combatParticipationIdentitySchema = z.object({
  actionProcessId: idSchema.optional(),
  attackResultId: idSchema.optional(),
  encounterId: idSchema,
  encounterRevision: idSchema,
  initiativeGroupId: idSchema.optional(),
  opponentParticipantId: idSchema.optional(),
  opportunityId: idSchema.optional(),
  pairId: idSchema.optional(),
  participantId: idSchema.optional(),
  phase: z.enum(["phase1", "phase2"]).optional(),
  processFamily: combatParticipationProcessFamilySchema,
  processId: idSchema.optional(),
  proposalId: idSchema.optional(),
  roundNumber: z.number().int().positive(),
  sequence: z.number().int().nonnegative(),
  step: z.string().min(1),
});
export type CombatParticipationIdentity = z.infer<typeof combatParticipationIdentitySchema>;

export const combatParticipationFactSchema = z.object({
  completeness: combatParticipationCompletenessSchema,
  id: idSchema,
  identity: combatParticipationIdentitySchema,
  ordering: combatParticipationOrderingSchema,
  ownership: combatParticipationOwnershipSchema,
  reason: combatParticipationReasonSchema,
  schemaVersion: z.literal(CANONICAL_COMBAT_PARTICIPATION_SCHEMA_VERSION),
  status: combatParticipationStatusSchema,
  workClass: combatParticipationWorkClassSchema,
});
export type CombatParticipationFact = z.infer<typeof combatParticipationFactSchema>;

export const combatParticipationProjectionSchema = z.object({
  encounterId: idSchema,
  encounterRevision: idSchema,
  facts: z.array(combatParticipationFactSchema),
  roundNumber: z.number().int().positive(),
  schemaVersion: z.literal(CANONICAL_COMBAT_PARTICIPATION_SCHEMA_VERSION),
  sequence: z.number().int().nonnegative(),
});
export type CombatParticipationProjection = z.infer<typeof combatParticipationProjectionSchema>;

export interface CombatParticipantAuthoritySource {
  readonly authority: "gm" | "player";
  readonly participantId: string;
  readonly playerUserId?: string;
}

/** Exact, already-authorized proxy scope. Merely viewing GM Combat never creates this source. */
export interface CombatParticipationProxyAuthoritySource {
  readonly actionProcessId?: string;
  readonly active: true;
  readonly participantId: string;
  readonly phase?: CombatRoundPhase;
  readonly processFamily: CombatParticipationProcessFamily;
  readonly proxyUserId: string;
}

export interface CombatDeclarationParticipationSource {
  readonly completeness: CombatParticipationCompleteness;
  readonly forcedNoAction: boolean;
  readonly legalChoiceCount: number;
  readonly participantId: string;
}

export interface CombatParticipationProjectionInput {
  readonly declarationSources?: readonly CombatDeclarationParticipationSource[];
  readonly encounterRevision: string;
  readonly modifierReviews?: readonly CanonicalCombatModifierReviewInput[];
  /** Explicit encounter-combatant mapping for durable scenario-participant review inputs. */
  readonly modifierReviewSources?: readonly ParticipantModifierReviewSource[];
  readonly participantAuthorities: readonly CombatParticipantAuthoritySource[];
  readonly proxyAuthorities?: readonly CombatParticipationProxyAuthoritySource[];
  /** Active state only. Archived rounds are intentionally outside this projection boundary. */
  readonly state: ActiveCombatRoundState;
}

export interface ParticipantModifierReviewSource {
  readonly participantId: string;
  readonly phase: CanonicalCombatModifierReviewPhase;
  readonly review: CanonicalCombatModifierReviewInput;
}

export const playerSafeCombatParticipationFactSchema = z.object({
  completeness: combatParticipationCompletenessSchema,
  id: idSchema,
  identity: z.object({
    encounterId: idSchema,
    encounterRevision: idSchema,
    participantId: idSchema.optional(),
    phase: z.enum(["phase1", "phase2"]).optional(),
    processFamily: combatParticipationProcessFamilySchema,
    roundNumber: z.number().int().positive(),
    sequence: z.number().int().nonnegative(),
    step: z.string().min(1),
  }),
  ordering: combatParticipationOrderingSchema,
  ownership: combatParticipationOwnershipSchema.omit({ proxyUserId: true, roles: true }),
  reason: combatParticipationReasonSchema,
  schemaVersion: z.literal(CANONICAL_COMBAT_PARTICIPATION_SCHEMA_VERSION),
  status: combatParticipationStatusSchema,
  workClass: combatParticipationWorkClassSchema,
});
export type PlayerSafeCombatParticipationFact = z.infer<
  typeof playerSafeCombatParticipationFactSchema
>;

export const playerSafeCombatParticipationProjectionSchema = z.object({
  encounterId: idSchema,
  encounterRevision: idSchema,
  facts: z.array(playerSafeCombatParticipationFactSchema),
  roundNumber: z.number().int().positive(),
  schemaVersion: z.literal(CANONICAL_COMBAT_PARTICIPATION_SCHEMA_VERSION),
  sequence: z.number().int().nonnegative(),
});
export type PlayerSafeCombatParticipationProjection = z.infer<
  typeof playerSafeCombatParticipationProjectionSchema
>;
