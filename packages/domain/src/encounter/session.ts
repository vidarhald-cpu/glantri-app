import { z } from "zod";

const idSchema = z.string().min(1);

export const encounterKindSchema = z.enum(["combat", "roleplay"]);
export const encounterStatusSchema = z.enum([
  "setup",
  "planned",
  "active",
  "paused",
  "complete",
  "archived"
]);
export const encounterTurnOrderModeSchema = z.enum(["manual"]);
export const encounterFacingSchema = z.enum(["north", "east", "south", "west"]);
export const encounterOrientationSchema = z.enum(["neutral", "front", "side", "behind"]);
export const encounterParticipantTypeSchema = z.enum(["character", "ad-hoc", "scenario"]);
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

export const roleplayDifficultySchema = z.preprocess(
  (input) => (input === "critical_plus" ? "legendary" : input),
  z.enum([
    "trivial_success",
    "easy",
    "medium_minus",
    "medium",
    "medium_plus",
    "hard",
    "very_hard",
    "critical",
    "legendary",
    "godly"
  ])
);

export const roleplayParticipantDescriptionSchema = z.object({
  detailedDescription: z.string().default(""),
  name: z.string().min(1).optional(),
  shortDescription: z.string().default("")
});

const roleplayRollModifierSchema = z.object({
  otherMod: z.number().int().default(0),
  useDbMod: z.boolean().default(false),
  useGenMod: z.boolean().default(false),
  useObSkillMod: z.boolean().default(false)
});

export const roleplayPendingSkillRollSchema = z.object({
  assignedAt: z.string().min(1),
  difficulty: roleplayDifficultySchema,
  id: idSchema,
  participantId: idSchema,
  silent: z.boolean().default(false),
  skillId: idSchema,
  skillLabel: z.string().min(1),
  skillValue: z.number().int().optional()
}).merge(roleplayRollModifierSchema);

export const roleplayActionLogEntrySchema = z.object({
  achievedSuccessLevelId: z.string().min(1).optional(),
  achievedSuccessLevelLabel: z.string().min(1).optional(),
  autoSuccess: z.boolean().default(false),
  calculationText: z.string().optional(),
  createdAt: z.string().min(1),
  dieResult: z.number().int().optional(),
  difficulty: roleplayDifficultySchema.optional(),
  finalTotal: z.number().int().optional(),
  fumble: z.boolean().default(false),
  id: idSchema,
  numericSubtotal: z.number().int().optional(),
  openEndedD10s: z.array(z.number().int().min(1).max(10)).default([]),
  partial: z.boolean().default(false),
  participantId: idSchema.optional(),
  resultModifier: z.number().int().optional(),
  roll: z.number().int().optional(),
  rollD20: z.number().int().min(1).max(20).optional(),
  silent: z.boolean().default(false),
  skillId: idSchema.optional(),
  skillLabel: z.string().optional(),
  success: z.boolean().optional(),
  summary: z.string().min(1),
  type: z.enum(["gm_message_updated", "skill_roll_assigned", "gm_skill_roll"])
}).merge(roleplayRollModifierSchema.partial());

export const roleplayStateSchema = z.object({
  actionLog: z.array(roleplayActionLogEntrySchema).default([]),
  gmMessage: z.string().default(""),
  participantDescriptions: z.record(idSchema, roleplayParticipantDescriptionSchema).default({}),
  pendingSkillRolls: z.array(roleplayPendingSkillRollSchema).default([]),
  visibility: z.record(idSchema, z.record(idSchema, z.boolean())).default({})
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
  }),
  scenarioParticipantId: idSchema.optional()
});

export const encounterSessionSchema = z.object({
  actionLog: z.array(encounterAttackResolutionSchema).default([]),
  campaignId: idSchema.optional(),
  createdAt: z.string().min(1),
  currentRound: z.number().int().positive().default(1),
  currentTurnIndex: z.number().int().nonnegative().default(0),
  declarationsLocked: z.boolean().default(false),
  description: z.string().optional(),
  id: idSchema,
  kind: encounterKindSchema.default("combat"),
  participants: z.array(encounterParticipantSchema).default([]),
  roleplayState: roleplayStateSchema.optional(),
  scenarioId: idSchema.optional(),
  status: encounterStatusSchema.default("setup"),
  timelineLabel: z.string().optional(),
  title: z.string().min(1),
  turnOrderMode: encounterTurnOrderModeSchema.default("manual"),
  updatedAt: z.string().min(1)
});

export type EncounterStatus = z.infer<typeof encounterStatusSchema>;
export type EncounterKind = z.infer<typeof encounterKindSchema>;
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
export type RoleplayDifficulty = z.infer<typeof roleplayDifficultySchema>;
export type RoleplayParticipantDescription = z.infer<typeof roleplayParticipantDescriptionSchema>;
export type RoleplayPendingSkillRoll = z.infer<typeof roleplayPendingSkillRollSchema>;
export type RoleplayActionLogEntry = z.infer<typeof roleplayActionLogEntrySchema>;
export type RoleplayState = z.infer<typeof roleplayStateSchema>;
export type EncounterAttackResolution = z.infer<typeof encounterAttackResolutionSchema>;
export type EncounterParticipant = z.infer<typeof encounterParticipantSchema>;
export type EncounterSession = z.infer<typeof encounterSessionSchema>;
