import { z } from "zod";

const idSchema = z.string().min(1);
const factRecordSchema = z.record(z.string(), z.unknown());

export const combatStepEventTypeSchema = z.enum([
  "declaration",
  "combat_experience",
  "initiative",
  "attack",
  "parry",
  "offensive_parry_brawling",
  "continued_contact_maintenance",
  "observation",
  "hit_location",
  "critical",
  "damage_proposed",
  "damage_committed",
  "distance_control_roll",
  "distance_control_result",
  "distance_control_applied",
  "health_check",
  "participant_su_review",
  "feint_feasibility",
  "feint_roll",
  "feint_result",
  "feint_committed",
  "feint_impossible",
  "adjust_distance_response",
  "adjust_distance_adjustment",
  "adjust_distance_roll",
  "adjust_distance_result",
  "adjust_distance_committed",
]);
export type CombatStepEventType = z.infer<typeof combatStepEventTypeSchema>;

export const combatStepEventStatusSchema = z.enum([
  "recorded",
  "proposed",
  "committed",
  "skipped",
  "not_applicable",
]);
export type CombatStepEventStatus = z.infer<typeof combatStepEventStatusSchema>;

export const combatStepEventOutcomeScopeSchema = z.enum([
  "public",
  "involved",
  "perceived",
  "gm_only",
]);
export type CombatStepEventOutcomeScope = z.infer<typeof combatStepEventOutcomeScopeSchema>;

export const combatStepEventIdentityRoleSchema = z.enum([
  "actor",
  "target",
  "attacker",
  "defender",
  "roller",
]);
export type CombatStepEventIdentityRole = z.infer<typeof combatStepEventIdentityRoleSchema>;

export const combatStepEventHiddenIdentityFallbackSchema = z.enum([
  "omit",
  "unseen_attacker",
  "unseen_target",
]);
export type CombatStepEventHiddenIdentityFallback = z.infer<
  typeof combatStepEventHiddenIdentityFallbackSchema
>;

export const combatStepEventSourceKindSchema = z.enum([
  "canonical",
  "legacy_command",
  "legacy_result",
  "legacy_snapshot",
]);
export type CombatStepEventSourceKind = z.infer<typeof combatStepEventSourceKindSchema>;

export const combatStepEventCompletenessSchema = z.enum([
  "complete",
  "legacy_derived",
  "incomplete",
]);
export type CombatStepEventCompleteness = z.infer<typeof combatStepEventCompletenessSchema>;

export const combatStepEventFactsSchema = z.object({
  gmReview: factRecordSchema.default({}),
  involvedOutcome: factRecordSchema.default({}),
  publicOutcome: factRecordSchema.default({}),
  rollerPrivate: factRecordSchema.default({}),
});
export type CombatStepEventFacts = z.infer<typeof combatStepEventFactsSchema>;

export const combatStepEventIdentityRefSchema = z.object({
  hiddenIdentityFallback: combatStepEventHiddenIdentityFallbackSchema.optional(),
  participantId: idSchema,
  role: combatStepEventIdentityRoleSchema,
});
export type CombatStepEventIdentityRef = z.infer<typeof combatStepEventIdentityRefSchema>;

export const combatStepEventVisibilitySchema = z.object({
  identityRefs: z.array(combatStepEventIdentityRefSchema).default([]),
  involvedParticipantIds: z.array(idSchema).default([]),
  outcomeScope: combatStepEventOutcomeScopeSchema,
  rollerParticipantId: idSchema.optional(),
});
export type CombatStepEventVisibility = z.infer<typeof combatStepEventVisibilitySchema>;

export const combatStepEventCommandTypeSchema = z.enum([
  "declare_action",
  "review_modifiers_phase1",
  "roll_initiative_phase1",
  "review_modifiers_phase2",
  "roll_initiative_phase2",
  "roll_attack",
  "roll_parry",
  "roll_offensive_parry_brawling",
  "roll_continued_contact_maintenance",
  "roll_observation",
  "roll_hit_location",
  "roll_critical",
  "skip_phase_action",
  "back_out_phase_attack",
  "submit_phase_initiative_choice",
  "commit_phase_initiative_resolution",
  "complete_damage_review_phase1",
  "complete_damage_review_phase2",
  "resolve_damage",
  "commit_phase_damage",
  "roll_combat_experience",
  "set_pair_distance",
  "prepare_round_end_review",
  "commit_round_end_participant_review",
  "roll_round_end_health_check",
  "roll_round_end_distance_control",
  "commit_round_end_distance_control",
  "advance_combat_boundary",
  "complete_round",
  "review_feint_feasibility",
  "roll_feint",
  "commit_feint_result",
  "respond_adjust_distance",
  "review_adjust_distance_roll_adjustment",
  "roll_adjust_distance",
  "commit_adjust_distance",
]);

export const combatStepEventSourceSchema = z.object({
  commandType: combatStepEventCommandTypeSchema.optional(),
  kind: combatStepEventSourceKindSchema,
  sourceIds: z.array(idSchema).default([]),
});
export type CombatStepEventSource = z.infer<typeof combatStepEventSourceSchema>;

export const combatStepEventSchema = z.object({
  actorParticipantId: idSchema.optional(),
  attackResultId: idSchema.optional(),
  attackerParticipantId: idSchema.optional(),
  combatEffectEventId: idSchema.optional(),
  combatEffectIds: z.array(idSchema).default([]),
  commandId: idSchema.optional(),
  completeness: combatStepEventCompletenessSchema,
  damageResultId: idSchema.optional(),
  defenderParticipantId: idSchema.optional(),
  distanceProposalId: idSchema.optional(),
  encounterId: idSchema,
  facts: combatStepEventFactsSchema,
  healthRollId: idSchema.optional(),
  id: idSchema,
  missingFacts: z.array(z.string().min(1)).default([]),
  occurredAt: z.string().datetime().nullable(),
  opportunityId: idSchema.optional(),
  ownerParticipantId: idSchema.optional(),
  parryResultId: idSchema.optional(),
  phase: z.enum(["phase1", "phase2"]).optional(),
  rollerParticipantId: idSchema.optional(),
  roundNumber: z.number().int().positive(),
  schemaVersion: z.literal(1),
  sequence: z.number().int().nonnegative(),
  source: combatStepEventSourceSchema,
  status: combatStepEventStatusSchema,
  step: z.enum([
    "select_actions",
    "review_action_modifiers",
    "initiative_phase_1",
    "phase_1_actions",
    "review_phase_2_actions",
    "phase_1_damage",
    "review_phase_2_modifiers",
    "initiative_phase_2",
    "phase_2_actions",
    "review_phase_2_damage",
    "phase_2_damage",
    "round_summary",
  ]),
  targetParticipantId: idSchema.optional(),
  type: combatStepEventTypeSchema,
  visibility: combatStepEventVisibilitySchema,
});
export type CombatStepEvent = z.infer<typeof combatStepEventSchema>;
