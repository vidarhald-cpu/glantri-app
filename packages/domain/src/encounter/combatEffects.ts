import { z } from "zod";

const idSchema = z.string().min(1);
const timestampSchema = z.string().min(1);

export const combatEffectSourceTypeSchema = z.enum([
  "manual",
  "combat_action",
  "skill_roll",
  "critical",
  "bleed_tick",
  "healing",
  "gm_adjustment",
]);

export const combatEffectTypeSchema = z.enum([
  "physical_damage",
  "general_damage",
  "bleed",
  "internal_bleed",
  "fatigue",
  "stun",
  "fear",
  "morale",
  "general_modifier",
  "ob_skill_modifier",
  "db_modifier",
  "other_modifier",
  "special",
  "healing",
]);

export const combatEffectGroupSchema = z.enum([
  "none",
  "general",
  "obSkill",
  "db",
  "other",
  "bleed",
  "fatigue",
  "special",
]);

export const combatEffectStatusSchema = z.enum([
  "active",
  "resolved",
  "expired",
  "superseded",
]);

export const combatEffectEventSchema = z.object({
  createdAt: timestampSchema,
  createdByUserId: idSchema.optional(),
  description: z.string().default(""),
  encounterId: idSchema.optional(),
  id: idSchema,
  phase: z.string().optional(),
  roundNumber: z.number().int().positive().optional(),
  scenarioId: idSchema.optional(),
  sourceActorId: idSchema.optional(),
  sourceLabel: z.string().default("Manual combat effect"),
  sourceType: combatEffectSourceTypeSchema.default("manual"),
  targetParticipantId: idSchema,
});

export const combatEffectSchema = z.object({
  checkRequired: z.boolean().optional(),
  checkSkillOrStat: z.string().optional(),
  createdAt: timestampSchema,
  damage: z.number().default(0),
  description: z.string().optional(),
  duration: z.string().optional(),
  effectGroup: combatEffectGroupSchema,
  expiresAtRound: z.number().int().positive().optional(),
  generalDamage: z.number().default(0),
  id: idSchema,
  location: z.string().optional(),
  modifierValue: z.number().optional(),
  roundNumber: z.number().int().positive().optional(),
  sourceEventId: idSchema,
  status: combatEffectStatusSchema.default("active"),
  targetParticipantId: idSchema,
  type: combatEffectTypeSchema,
  updatedAt: timestampSchema,
});

export const combatEffectsStateSchema = z
  .object({
    effects: z.array(combatEffectSchema).default([]),
    events: z.array(combatEffectEventSchema).default([]),
  })
  .default({
    effects: [],
    events: [],
  });

export type CombatEffectSourceType = z.infer<typeof combatEffectSourceTypeSchema>;
export type CombatEffectType = z.infer<typeof combatEffectTypeSchema>;
export type CombatEffectGroup = z.infer<typeof combatEffectGroupSchema>;
export type CombatEffectStatus = z.infer<typeof combatEffectStatusSchema>;
export type CombatEffectEvent = z.infer<typeof combatEffectEventSchema>;
export type CombatEffect = z.infer<typeof combatEffectSchema>;
export type CombatEffectsState = z.infer<typeof combatEffectsStateSchema>;
