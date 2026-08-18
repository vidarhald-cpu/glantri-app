import { z } from "zod";

export const CANONICAL_COMBAT_AUTOMATION_ELIGIBILITY_SCHEMA_VERSION = 1 as const;

export const combatAutomationWorkClassSchema = z.enum([
  "human_decision",
  "player_roll",
  "gm_roll",
  "deterministic",
  "not_applicable",
]);
export type CombatAutomationWorkClass = z.infer<typeof combatAutomationWorkClassSchema>;

export const combatAutomationEligibilityStatusSchema = z.enum([
  "eligible",
  "blocked",
  "not_allowed",
  "requires_warning",
  "unsupported",
]);
export type CombatAutomationEligibilityStatus = z.infer<
  typeof combatAutomationEligibilityStatusSchema
>;

export const combatAutomationReasonSchema = z.enum([
  "multiple_targets",
  "multiple_weapons",
  "multiple_parry_sources",
  "gm_modifier_pending",
  "effect_review_pending",
  "damage_review_pending",
  "double_attack_choice",
  "continue_backout_choice",
  "response_choice",
  "player_owned",
  "proxy_required",
  "gm_proxy_authority",
  "legacy_state",
  "stale_revision",
  "unsupported_process",
  "ordered_maneuver",
  "hidden_information",
  "relationship_ambiguity",
  "incomplete_canonical_facts",
  "task_not_executable",
  "human_decision_required",
  "deterministic_already_handled",
]);
export type CombatAutomationReason = z.infer<typeof combatAutomationReasonSchema>;

export const combatAutomationAuthorityKindSchema = z.enum([
  "player",
  "gm_proxy",
  "gm_controlled_participant",
  "gm",
  "ownerless",
  "shared_pair",
  "unknown",
]);
export type CombatAutomationAuthorityKind = z.infer<typeof combatAutomationAuthorityKindSchema>;

export const combatAutomationAuthoritySchema = z.object({
  kind: combatAutomationAuthorityKindSchema,
  participantId: z.string().min(1).optional(),
  proxyUserId: z.string().min(1).optional(),
});
export type CombatAutomationAuthority = z.infer<typeof combatAutomationAuthoritySchema>;

export const combatAutomationEligibilityFactSchema = z.object({
  authority: combatAutomationAuthoritySchema,
  eligibility: combatAutomationEligibilityStatusSchema,
  participationFactId: z.string().min(1).optional(),
  schemaVersion: z.literal(CANONICAL_COMBAT_AUTOMATION_ELIGIBILITY_SCHEMA_VERSION),
  stopReason: combatAutomationReasonSchema.optional(),
  taskId: z.string().min(1),
  warnings: z.array(combatAutomationReasonSchema).readonly(),
  workClass: combatAutomationWorkClassSchema,
});
export type CombatAutomationEligibilityFact = z.infer<typeof combatAutomationEligibilityFactSchema>;

/** Player-safe automation facts never carry proxy identity or another participant's authority. */
export const playerSafeCombatAutomationEligibilityFactSchema =
  combatAutomationEligibilityFactSchema.extend({
    authority: combatAutomationAuthoritySchema.pick({ kind: true, participantId: true }),
  });
export type PlayerSafeCombatAutomationEligibilityFact = z.infer<
  typeof playerSafeCombatAutomationEligibilityFactSchema
>;
