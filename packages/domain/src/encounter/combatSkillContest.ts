import { z } from "zod";

import { combatMovementBurdenSnapshotSchema } from "./combatMovementBurden";

const idSchema = z.string().min(1);

export const combatSkillContestTypeSchema = z.enum([
  "adjust_distance_attack",
  "round_end_adjust_distance",
  "movement_feint",
  "weapon_feint",
  "offensive_parry_brawling",
  "continued_contact_maintenance",
  "break_off",
]);
export type CombatSkillContestType = z.infer<typeof combatSkillContestTypeSchema>;

export const combatSkillContestRoleSchema = z.enum([
  "initiator",
  "resisting_opponent",
  "contestant",
  "movement_feint_initiator",
  "weapon_feint_initiator",
  "feint_defender",
  "offensive_parry_controller",
  "offensive_parry_responder",
  "continued_contact_controller",
  "continued_contact_responder",
  "break_off_escapee",
  "break_off_attacker",
]);
export type CombatSkillContestRole = z.infer<typeof combatSkillContestRoleSchema>;

export const combatSkillContestModifierCategorySchema = z.enum([
  "general_fatigue",
  "skill_ob",
  "relationship",
  "maneuver",
  "movement_mm",
  "encumbrance",
  "gm_adjustment",
  "withdrawal_backout",
]);
export type CombatSkillContestModifierCategory = z.infer<
  typeof combatSkillContestModifierCategorySchema
>;

export const combatSkillContestPercentageContributionSchema = z.object({
  category: combatSkillContestModifierCategorySchema,
  id: idSchema,
  label: z.string().min(1),
  provenance: z.string().min(1).optional(),
  sourceId: idSchema.optional(),
  unit: z.literal("percentage").default("percentage"),
  value: z.number().int(),
});
export type CombatSkillContestPercentageContribution = z.infer<
  typeof combatSkillContestPercentageContributionSchema
>;

export const COMBAT_SKILL_CONTEST_PREVIEW_SCHEMA_VERSION = 1 as const;

export const combatSkillContestPreviewSchema = z.object({
  baseSkill: z.number().int().optional(),
  completeness: z.enum(["complete", "partial", "unavailable"]),
  contestType: combatSkillContestTypeSchema,
  derivedIntegerAdjustment: z.number().int().optional(),
  governingStat: z
    .object({
      id: idSchema.optional(),
      label: z.string().min(1),
      value: z.number().int(),
    })
    .optional(),
  missingFacts: z.array(z.string().min(1)).default([]),
  participantId: idSchema,
  percentageContributions: z.array(combatSkillContestPercentageContributionSchema).default([]),
  preDieTotal: z.number().int().optional(),
  role: combatSkillContestRoleSchema,
  schemaVersion: z.literal(COMBAT_SKILL_CONTEST_PREVIEW_SCHEMA_VERSION),
  skill: z
    .object({
      id: idSchema.optional(),
      label: z.string().min(1),
      totalXp: z.number().int(),
    })
    .optional(),
  totalPercentageAdjustment: z.number().int().optional(),
});
export type CombatSkillContestPreview = z.infer<typeof combatSkillContestPreviewSchema>;

export const combatSkillContestCalculationSchema = z.object({
  baseSkill: z.number().int(),
  calculationId: idSchema,
  completeness: z.enum(["complete", "partial"]).default("complete"),
  contestType: combatSkillContestTypeSchema,
  derivedIntegerAdjustment: z.number().int(),
  finalResult: z.number().int(),
  governingStat: z.object({
    id: idSchema.optional(),
    label: z.string().min(1),
    value: z.number().int(),
  }),
  missingContributionPoints: z.array(combatSkillContestModifierCategorySchema).default([]),
  movementBurden: combatMovementBurdenSnapshotSchema.optional(),
  openEndedDie: z.object({
    openEndedD10s: z.array(z.number().int().min(1).max(10)).default([]),
    rollD20: z.number().int().min(1).max(20),
    rollTotal: z.number().int(),
  }),
  opponentParticipantId: idSchema.optional(),
  participantId: idSchema,
  percentageContributions: z.array(combatSkillContestPercentageContributionSchema).default([]),
  preDieTotal: z.number().int(),
  role: combatSkillContestRoleSchema,
  skill: z.object({
    id: idSchema.optional(),
    label: z.string().min(1),
    totalXp: z.number().int(),
  }),
  totalPercentageAdjustment: z.number().int(),
  visibility: z.enum(["roller_and_gm", "involved", "gm_only"]).default("roller_and_gm"),
});
export type CombatSkillContestCalculation = z.infer<typeof combatSkillContestCalculationSchema>;
