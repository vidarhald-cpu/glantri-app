import { z } from "zod";

const idSchema = z.string().min(1);

export const encounterStatusSchema = z.enum(["setup", "active", "complete"]);
export const encounterTurnOrderModeSchema = z.enum(["manual"]);
export const encounterFacingSchema = z.enum(["north", "east", "south", "west"]);
export const encounterOrientationSchema = z.enum(["neutral", "front", "side", "behind"]);
export const encounterParticipantTypeSchema = z.enum(["character", "ad-hoc"]);
export const encounterActionTypeSchema = z.enum(["none", "attack", "move", "defend", "ready", "other"]);
export const encounterDefensePostureSchema = z.enum([
  "none",
  "guard",
  "parry",
  "shield",
  "full-defense"
]);
export const encounterTargetLocationSchema = z.enum(["any", "head", "torso", "arm", "leg"]);
export const encounterDefenseFocusSchema = z.enum([
  "none",
  "self",
  "weapon-side",
  "shield-side"
]);
export const encounterCombatOutcomeSchema = z.enum([
  "miss",
  "hit",
  "parried",
  "hit-pending-damage",
  "critical-pending",
  "critical-resolved"
]);
export const encounterCriticalStatusSchema = z.enum(["none", "pending", "resolved"]);
export const encounterCriticalTypeSchema = z.enum(["general", "limb"]);
export const encounterCriticalSeveritySchema = z.enum(["none", "minor", "major", "severe"]);

export const encounterPositionSchema = z.object({
  x: z.number().int().default(0),
  y: z.number().int().default(0),
  zone: z.string().min(1).default("center")
});

export const encounterParticipantDeclarationSchema = z.object({
  actionType: encounterActionTypeSchema.default("none"),
  defenseFocus: encounterDefenseFocusSchema.default("none"),
  defensePosture: encounterDefensePostureSchema.default("none"),
  shieldItemId: idSchema.optional(),
  targetLocation: encounterTargetLocationSchema.default("any"),
  targetParticipantId: idSchema.optional(),
  weaponItemId: idSchema.optional()
});

export const encounterAttackRollResultSchema = z.object({
  baseOb: z.number().int(),
  defenseTarget: z.number().int(),
  hit: z.boolean(),
  margin: z.number().int(),
  roll: z.number().int().min(1).max(100),
  total: z.number().int()
});

export const encounterDefenseRollResultSchema = z.object({
  dbApplied: z.boolean().default(false),
  dbValue: z.number().int().default(0),
  defending: z.boolean().default(false),
  parryAttempted: z.boolean().default(false),
  parryBase: z.number().int().default(0),
  parryRoll: z.number().int().min(1).max(100).optional(),
  parrySucceeded: z.boolean().default(false),
  parryTotal: z.number().int().optional(),
  selectedShieldItemId: idSchema.optional(),
  selectedWeaponItemId: idSchema.optional()
});

export const encounterHitLocationResultSchema = z.object({
  aimedLocation: encounterTargetLocationSchema.default("any"),
  resolvedLocation: encounterTargetLocationSchema,
  roll: z.number().int().min(1).max(100).optional()
});

export const encounterDamageResolutionSchema = z.object({
  armorLabel: z.string().min(1).optional(),
  armorValue: z.number().int().default(0),
  criticalPending: z.boolean().default(false),
  finalDamage: z.number().int().default(0),
  rawDamage: z.number().int().default(0),
  weaponArmorModifier: z.number().int().default(0)
});

export const encounterCriticalEffectSummarySchema = z.object({
  severity: encounterCriticalSeveritySchema.default("none"),
  summary: z.string().min(1),
  tags: z.array(z.string().min(1)).default([])
});

export const encounterCriticalRollResultSchema = z.object({
  baseModifier: z.number().int().default(0),
  finalRoll: z.number().int().optional(),
  locationModifier: z.number().int().default(0),
  resultKey: z.string().min(1).optional(),
  resultRow: z.string().min(1).optional(),
  roll: z.number().int().min(1).max(100).optional(),
  totalModifier: z.number().int().default(0)
});

export const encounterCriticalResolutionSchema = z.object({
  effect: encounterCriticalEffectSummarySchema.optional(),
  provisionalRuleLabel: z.string().min(1).optional(),
  roll: encounterCriticalRollResultSchema.default({
    baseModifier: 0,
    locationModifier: 0,
    totalModifier: 0
  }),
  status: encounterCriticalStatusSchema.default("none"),
  triggerDamage: z.number().int().default(0),
  triggerThreshold: z.number().int().positive().optional(),
  type: encounterCriticalTypeSchema.optional()
});

export const encounterAttackResolutionSchema = z.object({
  attackerParticipantId: idSchema,
  attackRoll: encounterAttackRollResultSchema,
  critical: encounterCriticalResolutionSchema.optional(),
  declaration: encounterParticipantDeclarationSchema,
  defenderParticipantId: idSchema,
  defense: encounterDefenseRollResultSchema,
  damage: encounterDamageResolutionSchema.optional(),
  encounterId: idSchema,
  hitLocation: encounterHitLocationResultSchema.optional(),
  id: idSchema,
  order: z.number().int().nonnegative(),
  outcome: encounterCombatOutcomeSchema,
  resolvedAt: z.string().min(1),
  roundNumber: z.number().int().positive(),
  selectedShieldItemId: idSchema.optional(),
  selectedWeaponItemId: idSchema.optional()
});

export const encounterParticipantSchema = z.object({
  adHocName: z.string().min(1).optional(),
  characterId: idSchema.optional(),
  declaration: encounterParticipantDeclarationSchema.default({
    actionType: "none",
    defenseFocus: "none",
    defensePosture: "none",
    targetLocation: "any"
  }),
  facing: encounterFacingSchema.default("north"),
  id: idSchema,
  initiative: z.number().int().default(0),
  label: z.string().min(1),
  order: z.number().int().nonnegative().default(0),
  orientation: encounterOrientationSchema.default("neutral"),
  participantType: encounterParticipantTypeSchema,
  position: encounterPositionSchema.default({
    x: 0,
    y: 0,
    zone: "center"
  })
});

export const encounterSessionSchema = z.object({
  actionLog: z.array(encounterAttackResolutionSchema).default([]),
  campaignId: idSchema.optional(),
  createdAt: z.string().min(1),
  currentRound: z.number().int().positive().default(1),
  currentTurnIndex: z.number().int().nonnegative().default(0),
  declarationsLocked: z.boolean().default(false),
  id: idSchema,
  participants: z.array(encounterParticipantSchema).default([]),
  scenarioId: idSchema.optional(),
  status: encounterStatusSchema.default("setup"),
  title: z.string().min(1),
  turnOrderMode: encounterTurnOrderModeSchema.default("manual"),
  updatedAt: z.string().min(1)
});

export type EncounterStatus = z.infer<typeof encounterStatusSchema>;
export type EncounterTurnOrderMode = z.infer<typeof encounterTurnOrderModeSchema>;
export type EncounterFacing = z.infer<typeof encounterFacingSchema>;
export type EncounterOrientation = z.infer<typeof encounterOrientationSchema>;
export type EncounterParticipantType = z.infer<typeof encounterParticipantTypeSchema>;
export type EncounterActionType = z.infer<typeof encounterActionTypeSchema>;
export type EncounterDefensePosture = z.infer<typeof encounterDefensePostureSchema>;
export type EncounterTargetLocation = z.infer<typeof encounterTargetLocationSchema>;
export type EncounterDefenseFocus = z.infer<typeof encounterDefenseFocusSchema>;
export type EncounterCombatOutcome = z.infer<typeof encounterCombatOutcomeSchema>;
export type EncounterCriticalStatus = z.infer<typeof encounterCriticalStatusSchema>;
export type EncounterCriticalType = z.infer<typeof encounterCriticalTypeSchema>;
export type EncounterCriticalSeverity = z.infer<typeof encounterCriticalSeveritySchema>;
export type EncounterPosition = z.infer<typeof encounterPositionSchema>;
export type EncounterParticipantDeclaration = z.infer<typeof encounterParticipantDeclarationSchema>;
export type EncounterAttackRollResult = z.infer<typeof encounterAttackRollResultSchema>;
export type EncounterDefenseRollResult = z.infer<typeof encounterDefenseRollResultSchema>;
export type EncounterHitLocationResult = z.infer<typeof encounterHitLocationResultSchema>;
export type EncounterDamageResolution = z.infer<typeof encounterDamageResolutionSchema>;
export type EncounterCriticalEffectSummary = z.infer<typeof encounterCriticalEffectSummarySchema>;
export type EncounterCriticalRollResult = z.infer<typeof encounterCriticalRollResultSchema>;
export type EncounterCriticalResolution = z.infer<typeof encounterCriticalResolutionSchema>;
export type EncounterAttackResolution = z.infer<typeof encounterAttackResolutionSchema>;
export type EncounterParticipant = z.infer<typeof encounterParticipantSchema>;
export type EncounterSession = z.infer<typeof encounterSessionSchema>;
