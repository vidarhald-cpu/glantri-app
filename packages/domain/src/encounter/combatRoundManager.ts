import { z } from "zod";

import {
  scenarioCombatModifierBucketSchema,
  scenarioCombatModifierEntrySchema,
  scenarioParticipantCombatContextSchema,
  type ScenarioCombatModifierEntry,
  type ScenarioParticipantCombatContext,
} from "../campaign/scenario";
import { rollOpenEndedD20, type OpenEndedD20Roll } from "../dice/openEndedD20";
import {
  combatArmorModifierClassSchema,
  lookupCombatArmorModifier,
  normalizeCombatArmorModifierClass,
  type CombatArmorModifierClass,
} from "./armorModifier";
import {
  restoreCombatActionGeneratedBackOutModifiers,
  softenCombatActionGeneratedBackOutModifier,
} from "./combatActionModifiers";
import {
  combatDistanceEdgeSchema,
  combatDistanceSchema,
  combatDistanceStateSchema,
  ensureDistanceEdgesForParticipantPairs,
  getCombatDistanceParticipantAliases,
  getDistanceEdgeBetween,
  makeDistancePairKey,
  setDistanceBetween,
  type CombatDistance,
  type CombatDistanceEdge,
  type CombatDistanceParticipantAliasLike,
  type CombatDistanceState,
  type CombatDistanceSource,
  type CombatDistanceWeaponLike,
} from "./combatDistance";
import {
  getCombatDeclarationAttackPhases,
  validateCombatDeclarationTargets,
} from "./combatDeclarationValidation";
import { movementIntentSchema, type DistancePreferenceIntent } from "./combatMovementIntent";
import {
  combatEffectEventSchema,
  combatEffectBleedStateSchema,
  combatEffectsStateSchema,
  combatEffectSchema,
  type CombatEffect,
  type CombatEffectGroup,
  type CombatEffectType,
  type CombatEffectsState,
} from "./combatEffects";
import { lookupCombatCriticalModifier } from "./critical";
import {
  buildCriticalEffectProposalFromDamageResult,
  buildCriticalEffectProposalSummary,
} from "./criticalEffectProposal";
import {
  getCriticalResultWithEffects,
  type CriticalEffectTemplate,
  type CriticalResult,
} from "./criticalEffectsTable";
import {
  getHitLocationFullLabel,
  hitLocationSchema,
  hitLocationTargetSchema,
  resolveHitLocationSelection,
  type HitLocation,
  type HitLocationSelection,
} from "./hitLocation";
import { lookupCombatToHitDamageMetadata, resolveCombatToHit } from "./toHitTable";
import type { EncounterParticipant, EncounterSession } from "./session";

const idSchema = z.string().min(1);
const COMBAT_ROUND_STRENGTH_GM_MAX_DAMAGE_NOTE = "max damage: 17 + GM STR when relevant";
const COMBAT_ROUND_BLEED_HEALTH_CHECK_INTERVAL_ROUNDS = 10;
const COMBAT_ROUND_EXTERNAL_BLEED_HEALTH_DIFFICULTY = 21;
const COMBAT_ROUND_INTERNAL_BLEED_HEALTH_DIFFICULTY = 26;
export const COMBAT_EXPERIENCE_TABLE_DIFFICULTY = 21;
export const COMBAT_EXPERIENCE_DEFAULT_DIFFICULTY = 26;

export const combatRoundStepSchema = z.enum([
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
]);

export const COMBAT_ROUND_STEPS = combatRoundStepSchema.options;
export type CombatRoundStep = z.infer<typeof combatRoundStepSchema>;

export const COMBAT_ROUND_STEP_ABBREVIATIONS = {
  initiative_phase_1: "i1",
  initiative_phase_2: "i2",
  phase_1_actions: "A1",
  phase_1_damage: "D1",
  phase_2_actions: "A2",
  phase_2_damage: "D2",
  review_action_modifiers: "M1",
  review_phase_2_actions: "P1",
  review_phase_2_damage: "P2",
  review_phase_2_modifiers: "M2",
  round_summary: "SU",
  select_actions: "DE",
} satisfies Record<CombatRoundStep, string>;

export const COMBAT_ROUND_STEP_LABELS = {
  initiative_phase_1: "Initiative phase 1",
  initiative_phase_2: "Initiative phase 2",
  phase_1_actions: "A1 Attack/action roll",
  phase_1_damage: "D1 Damage/effects review",
  phase_2_actions: "A2 Attack/action roll",
  phase_2_damage: "D2 Damage/effects review",
  review_action_modifiers: "Review phase 1 modifiers",
  review_phase_2_actions: "P1 Parry/defense resolution",
  review_phase_2_damage: "P2 Parry/defense resolution",
  review_phase_2_modifiers: "Review/modify phase 2 actions/modifiers",
  round_summary: "Summary/update",
  select_actions: "Declaration",
} satisfies Record<CombatRoundStep, string>;

export const combatRoundCursorStepSchema = z.enum([
  "DE",
  "M1",
  "i1",
  "A1",
  "P1",
  "D1",
  "M2",
  "i2",
  "A2",
  "P2",
  "D2",
  "SU",
]);
export type CombatRoundCursorStep = z.infer<typeof combatRoundCursorStepSchema>;

export const combatRoundCursorSchema = z.object({
  participantId: idSchema.optional(),
  roundNumber: z.number().int().positive(),
  step: combatRoundCursorStepSchema,
});
export type CombatRoundCursor = z.infer<typeof combatRoundCursorSchema>;

export const combatRoundPhaseSchema = z.enum(["phase1", "phase2"]);
export type CombatRoundPhase = z.infer<typeof combatRoundPhaseSchema>;

export const combatRoundAttackDirectionSchema = z.enum(["front", "back"]);
export type CombatRoundAttackDirection = z.infer<typeof combatRoundAttackDirectionSchema>;

export const combatRoundArmorRegionSchema = z.enum([
  "head",
  "frontArm",
  "chest",
  "backArm",
  "abdomen",
  "frontThigh",
  "frontFoot",
  "backThigh",
  "backFoot",
]);
export type CombatRoundArmorRegion = z.infer<typeof combatRoundArmorRegionSchema>;

export const COMBAT_ROUND_ARMOR_REGION_LABELS = {
  abdomen: "Abdomen",
  backArm: "Back Arm",
  backFoot: "Back Foot",
  backThigh: "Back Thigh",
  chest: "Chest",
  frontArm: "Front Arm",
  frontFoot: "Front Foot",
  frontThigh: "Front Thigh",
  head: "Head",
} satisfies Record<CombatRoundArmorRegion, string>;

const combatRoundDamageArmorCoverageEntrySchema = z.object({
  armorClass: combatArmorModifierClassSchema.optional(),
  coverageLabel: z.string().min(1).optional(),
  label: z.string().min(1).optional(),
  value: z.number().int().min(0).optional(),
});
export type CombatRoundDamageArmorCoverageEntry = z.infer<
  typeof combatRoundDamageArmorCoverageEntrySchema
>;

export const combatRoundDamageArmorCoverageSchema = z
  .object({
    abdomen: combatRoundDamageArmorCoverageEntrySchema.optional(),
    backArm: combatRoundDamageArmorCoverageEntrySchema.optional(),
    backFoot: combatRoundDamageArmorCoverageEntrySchema.optional(),
    backThigh: combatRoundDamageArmorCoverageEntrySchema.optional(),
    chest: combatRoundDamageArmorCoverageEntrySchema.optional(),
    frontArm: combatRoundDamageArmorCoverageEntrySchema.optional(),
    frontFoot: combatRoundDamageArmorCoverageEntrySchema.optional(),
    frontThigh: combatRoundDamageArmorCoverageEntrySchema.optional(),
    head: combatRoundDamageArmorCoverageEntrySchema.optional(),
  })
  .default({});
export type CombatRoundDamageArmorCoverage = z.infer<typeof combatRoundDamageArmorCoverageSchema>;

export const combatRoundCommandTypeSchema = z.enum([
  "declare_action",
  "review_modifiers_phase1",
  "roll_initiative_phase1",
  "review_modifiers_phase2",
  "roll_initiative_phase2",
  "roll_attack",
  "roll_parry",
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
  "complete_round",
]);
export type CombatRoundCommandType = z.infer<typeof combatRoundCommandTypeSchema>;

export const combatRoundCommandSchema = z.object({
  afterCursor: combatRoundCursorSchema,
  beforeCursor: combatRoundCursorSchema,
  createdAt: z.string().datetime(),
  createdByUserId: idSchema.optional(),
  facts: z.record(z.string(), z.unknown()).default({}),
  id: idSchema,
  participantId: idSchema,
  phase: combatRoundPhaseSchema.optional(),
  roundNumber: z.number().int().positive(),
  step: combatRoundCursorStepSchema.optional(),
  type: combatRoundCommandTypeSchema,
});
export type CombatRoundCommand = z.infer<typeof combatRoundCommandSchema>;

export const combatRoundStepStatusSchema = z.enum([
  "pending",
  "ready",
  "submitted",
  "gmEdited",
  "locked",
  "complete",
  "skipped",
]);

const combatRoundEndBleedTypeSchema = z.enum(["external", "internal"]);
export type CombatRoundEndBleedType = z.infer<typeof combatRoundEndBleedTypeSchema>;

const combatRoundEndParticipantReviewStatusSchema = z.enum([
  "pending",
  "review_ready",
  "committed",
  "health_roll_pending",
  "distance_roll_pending",
  "complete",
]);
export type CombatRoundEndParticipantReviewStatus = z.infer<
  typeof combatRoundEndParticipantReviewStatusSchema
>;

export const combatRoundEndEffectProposalSchema = z.object({
  accepted: z.boolean().default(true),
  effectId: idSchema,
  id: idSchema,
  kind: z.literal("duration_update"),
  label: z.string().min(1),
  nextDuration: z.string().min(1).optional(),
  nextExpiresAtRound: z.number().int().positive().optional(),
  notes: z.string().min(1).optional(),
  participantId: idSchema,
  previousDuration: z.string().min(1).optional(),
  previousExpiresAtRound: z.number().int().positive().optional(),
});
export type CombatRoundEndEffectProposal = z.infer<typeof combatRoundEndEffectProposalSchema>;

export const combatRoundEndDamageProposalSchema = z.object({
  accepted: z.boolean().default(true),
  amount: z.number().int().nonnegative(),
  accumulatedTenths: z.number().int().nonnegative().default(0),
  bleedType: combatRoundEndBleedTypeSchema,
  bleedRate: z.number().int().nonnegative().default(0),
  healthCheckDue: z.boolean().default(false),
  id: idSchema,
  initializedRound: z.number().int().positive().optional(),
  label: z.string().min(1),
  lastHealthCheckRound: z.number().int().positive().optional(),
  notes: z.string().min(1).optional(),
  participantId: idSchema,
  previousAccumulatedTenths: z.number().int().nonnegative().default(0),
  remainingAccumulatedTenths: z.number().int().min(0).max(9).default(0),
  roundsUntilHealthCheck: z.number().int().nonnegative().optional(),
  sourceEffectId: idSchema,
});
export type CombatRoundEndDamageProposal = z.infer<typeof combatRoundEndDamageProposalSchema>;

export const combatRoundEndRemovalProposalSchema = z.object({
  accepted: z.boolean().default(true),
  effectId: idSchema,
  id: idSchema,
  kind: z.literal("duration_expire"),
  label: z.string().min(1),
  notes: z.string().min(1).optional(),
  participantId: idSchema,
  previousDuration: z.string().min(1).optional(),
  previousExpiresAtRound: z.number().int().positive().optional(),
  previousStatus: z.enum(["active", "resolved", "expired", "superseded"]).default("active"),
});
export type CombatRoundEndRemovalProposal = z.infer<typeof combatRoundEndRemovalProposalSchema>;

export const combatRoundEndHealthRollResultSchema = z.object({
  difficulty: z.number().int().positive(),
  finalTotal: z.number().int(),
  healthStat: z.number().int(),
  openEndedD10s: z.array(z.number().int().min(1).max(10)).default([]),
  rolledAt: z.string().datetime(),
  rolledBy: z.enum(["player", "gm_proxy"]).default("gm_proxy"),
  rolledByUserId: idSchema.optional(),
  rollD20: z.number().int().min(1).max(20),
  rollTotal: z.number().int(),
  success: z.boolean(),
});
export type CombatRoundEndHealthRollResult = z.infer<typeof combatRoundEndHealthRollResultSchema>;

export const combatRoundEndHealthRollProposalSchema = z.object({
  accepted: z.boolean().default(true),
  bleedType: combatRoundEndBleedTypeSchema,
  bleedReduction: z.number().int().nonnegative().optional(),
  damageProposalId: idSchema.optional(),
  difficulty: z.number().int().positive(),
  healthStat: z.number().int().default(0),
  id: idSchema,
  label: z.string().min(1),
  nextBleedRate: z.number().int().nonnegative().optional(),
  participantId: idSchema,
  previousBleedRate: z.number().int().nonnegative().optional(),
  result: combatRoundEndHealthRollResultSchema.optional(),
  sourceEffectId: idSchema,
  status: z.enum(["pending", "rolled", "not_required"]).default("pending"),
  warnings: z.array(z.string().min(1)).default([]),
});
export type CombatRoundEndHealthRollProposal = z.infer<
  typeof combatRoundEndHealthRollProposalSchema
>;

export const combatRoundEndDistanceRollResultSchema = z.object({
  dodgeSkillTotal: z.number().int().default(0),
  finalTotal: z.number().int(),
  generalFatigueModifier: z.number().int().default(0),
  openEndedD10s: z.array(z.number().int().min(1).max(10)).default([]),
  rolledAt: z.string().datetime(),
  rolledAtRound: z.number().int().positive(),
  rolledBy: z.enum(["player", "gm_proxy"]).default("gm_proxy"),
  rolledByUserId: idSchema.optional(),
  rollD20: z.number().int().min(1).max(20),
  rollTotal: z.number().int(),
});
export type CombatRoundEndDistanceRollResult = z.infer<
  typeof combatRoundEndDistanceRollResultSchema
>;

export const combatRoundEndDistanceControlSideSchema = z.object({
  desiredDistance: combatDistanceSchema.optional(),
  dodgeSkillTotal: z.number().int().default(0),
  generalFatigueModifier: z.number().int().default(0),
  participantId: idSchema,
  result: combatRoundEndDistanceRollResultSchema.optional(),
  status: z.enum(["pending", "rolled", "not_required"]).default("pending"),
  warnings: z.array(z.string().min(1)).default([]),
});
export type CombatRoundEndDistanceControlSide = z.infer<
  typeof combatRoundEndDistanceControlSideSchema
>;

export const combatRoundEndDistanceProposalSchema = z.object({
  accepted: z.boolean().default(true),
  appliedDistance: combatDistanceSchema.optional(),
  appliesFromRound: z.number().int().positive(),
  currentDistance: combatDistanceSchema,
  gmOverrideDistance: combatDistanceSchema.optional(),
  id: idSchema,
  notes: z.string().min(1).optional(),
  outcome: z
    .enum([
      "uncontested",
      "contest_pending",
      "participant_a_wins",
      "participant_b_wins",
      "tie",
      "gm_override",
    ])
    .default("contest_pending"),
  pairKey: idSchema,
  participantA: combatRoundEndDistanceControlSideSchema,
  participantAId: idSchema,
  participantB: combatRoundEndDistanceControlSideSchema,
  participantBId: idSchema,
  proposedDistance: combatDistanceSchema.optional(),
  requiresContest: z.boolean().default(false),
  status: z
    .enum(["pending", "pending_rolls", "rolled", "review_ready", "committed"])
    .default("pending"),
  warnings: z.array(z.string().min(1)).default([]),
  winnerParticipantId: idSchema.optional(),
});
export type CombatRoundEndDistanceProposal = z.infer<typeof combatRoundEndDistanceProposalSchema>;

export const combatRoundEndParticipantReviewSchema = z.object({
  committedAt: z.string().datetime().optional(),
  committedByUserId: idSchema.optional(),
  participantId: idSchema,
  proposedDamage: z.array(combatRoundEndDamageProposalSchema).default([]),
  proposedDistances: z.array(combatRoundEndDistanceProposalSchema).default([]),
  proposedEffects: z.array(combatRoundEndEffectProposalSchema).default([]),
  proposedHealthRolls: z.array(combatRoundEndHealthRollProposalSchema).default([]),
  proposedRemovals: z.array(combatRoundEndRemovalProposalSchema).default([]),
  status: combatRoundEndParticipantReviewStatusSchema.default("pending"),
  warnings: z.array(z.string().min(1)).default([]),
});
export type RoundEndParticipantReview = z.infer<typeof combatRoundEndParticipantReviewSchema>;

export const combatRoundEndReviewSchema = z.object({
  participantReviews: z.record(idSchema, combatRoundEndParticipantReviewSchema).default({}),
  preparedAt: z.string().datetime().optional(),
  preparedByUserId: idSchema.optional(),
  proposedDistances: z.array(combatRoundEndDistanceProposalSchema).default([]),
  roundNumber: z.number().int().positive(),
});
export type CombatRoundEndReview = z.infer<typeof combatRoundEndReviewSchema>;

export const combatRoundInitiativeResultSchema = z.object({
  baseInitiative: z.number().int().default(0),
  modifierAdjustment: z.number().int().default(0),
  rolls: z.array(z.number().int().min(1).max(6)).default([]),
  rollTotal: z.number().int().optional(),
  total: z.number().int(),
});
const legacyCombatRoundInitiativeResultSchema = z
  .number()
  .int()
  .transform((total) => ({
    baseInitiative: 0,
    modifierAdjustment: 0,
    rolls: [],
    rollTotal: total,
    total,
  }));

export const combatRoundInitiativesSchema = z.object({
  phase1: z
    .union([combatRoundInitiativeResultSchema, legacyCombatRoundInitiativeResultSchema])
    .optional(),
  phase2: z
    .union([combatRoundInitiativeResultSchema, legacyCombatRoundInitiativeResultSchema])
    .optional(),
});

export const combatExperienceTriggerSchema = z.enum([
  "combat_start",
  "phase1_attack",
  "phase2_attack",
]);
export type CombatExperienceTrigger = z.infer<typeof combatExperienceTriggerSchema>;
export type CombatRoundVisibility = Record<string, Record<string, boolean>>;

export interface CombatRoundPhaseCombatExperienceThreat {
  attackerInitiative: number;
  attackerParticipantId: string;
  initiativeDifference: number;
  participantInitiative: number;
  reason: "close_initiative" | "higher_initiative" | "lower_initiative";
}

export interface CombatRoundPhaseCombatExperienceRequirement {
  participantId: string;
  phase: CombatRoundPhase;
  reason: "attacked_while_attacking";
  threats: CombatRoundPhaseCombatExperienceThreat[];
  trigger: CombatExperienceTrigger;
}

export interface CombatRoundPhaseAttackBackOutOpportunity {
  ceRequired: boolean;
  participantId: string;
  phase: CombatRoundPhase;
  reason: "attacked_while_attacking";
  threats: CombatRoundPhaseCombatExperienceThreat[];
  trigger: CombatExperienceTrigger;
}

export interface CombatRoundPhaseCombatExperienceDetectionIncomingAttackerReport {
  actionId?: string;
  aware: boolean;
  initiativeTotal?: number;
  participantId: string;
  phaseAttackCapable: boolean;
  targetId?: string;
  targetMatchesParticipant: boolean;
}

export interface CombatRoundPhaseCombatExperienceDetectionParticipantReport {
  actionId?: string;
  detectedIncomingAttackers: CombatRoundPhaseCombatExperienceDetectionIncomingAttackerReport[];
  hasA1A2AlreadyResolved: boolean;
  initiativeTotal?: number;
  label: string;
  participantId: string;
  phaseAttackCapable: boolean;
  phaseTargetActiveInEncounter: boolean;
  phaseTargetId?: string;
  backOutAvailable: boolean;
  reasonIfNo?: string;
  required: boolean;
}

export const combatExperienceResultBandSchema = z.enum([
  "panic",
  "passive",
  "active_penalty",
  "active",
]);
export type CombatExperienceResultBand = z.infer<typeof combatExperienceResultBandSchema>;

export const combatExperienceEvaluationSchema = z.object({
  difficultyShift: z.number().int().optional(),
  durationRounds: z.number().int().nonnegative(),
  effectiveTableTotal: z.number().int().optional(),
  label: z.string().min(1),
  modifierValue: z.number().int(),
  needsEffectRow: z.boolean(),
  note: z.string().min(1),
  resultBand: combatExperienceResultBandSchema,
});
export type CombatExperienceEvaluation = z.infer<typeof combatExperienceEvaluationSchema>;

export const combatRoundCombatExperienceResultSchema = combatExperienceEvaluationSchema.extend({
  difficulty: z.number().int().positive(),
  finalTotal: z.number().int(),
  noRollRequired: z.boolean().default(false),
  openEndedD10s: z.array(z.number().int().min(1).max(10)).default([]),
  rolledAt: z.string().datetime(),
  rolledByUserId: idSchema.optional(),
  rollD20: z.number().int().min(1).max(20).optional(),
  rollTotal: z.number().int().optional(),
  roundNumber: z.number().int().positive(),
  skillTotal: z.number().int(),
  skillTotalSource: z.string().min(1).optional(),
  skillTotalWarning: z.string().min(1).optional(),
  trigger: combatExperienceTriggerSchema,
});
export type CombatRoundCombatExperienceResult = z.infer<
  typeof combatRoundCombatExperienceResultSchema
>;

export const combatRoundPhaseInitiativeChoiceKindSchema = z.enum([
  "roll_ce_result",
  "back_out",
  "continue_without_ce",
]);
export type CombatRoundPhaseInitiativeChoiceKind = z.infer<
  typeof combatRoundPhaseInitiativeChoiceKindSchema
>;

export const combatRoundPhaseInitiativeChoiceSchema = z.object({
  attackActionId: idSchema.optional(),
  attackStep: z.enum(["A1", "A2"]),
  ceRequired: z.boolean(),
  choice: combatRoundPhaseInitiativeChoiceKindSchema,
  combatExperience: combatRoundCombatExperienceResultSchema.optional(),
  commandId: idSchema,
  defaultedOnCommit: z.boolean().default(false),
  phase: combatRoundPhaseSchema,
  participantId: idSchema,
  roundNumber: z.number().int().positive(),
  submittedAt: z.string().datetime(),
  submittedByUserId: idSchema.optional(),
  threatened: z.boolean(),
});
export type CombatRoundPhaseInitiativeChoice = z.infer<
  typeof combatRoundPhaseInitiativeChoiceSchema
>;

export const combatRoundPhaseContextsSchema = z.object({
  phase1: scenarioParticipantCombatContextSchema.optional(),
  phase2: scenarioParticipantCombatContextSchema.optional(),
});

export const combatRoundPhaseResolutionSubstepSchema = z.enum([
  "attack",
  "parry",
  "damage",
  "effects",
  "done",
]);
export const combatRoundPhaseResolutionStatusSubstepSchema = z.enum([
  "pending",
  ...combatRoundPhaseResolutionSubstepSchema.options,
]);
export type CombatRoundPhaseResolutionSubstep = z.infer<
  typeof combatRoundPhaseResolutionSubstepSchema
>;

export const combatRoundAttackRollResultSchema = z
  .object({
    actionId: idSchema,
    attackerParticipantId: idSchema,
    defenderParticipantId: idSchema,
    defenderDb: z.number().int(),
    defenderParryModifier: z.number().int().default(0),
    grazing: z.boolean(),
    hit: z.boolean(),
    kind: z.literal("attackRoll"),
    lookupTotal: z.number().int(),
    marginOverMissThreshold: z.number().int(),
    ob: z.number().int(),
    openEndedD10s: z.array(z.number().int().min(1).max(10)).default([]),
    phase: combatRoundPhaseSchema,
    roll: z.number().int().min(1).max(20).optional(),
    rollD20: z.number().int().min(1).max(20).optional(),
    rollTotal: z.number().int().optional(),
    rolledAt: z.string().datetime(),
    rolledByUserId: idSchema.optional(),
    tableResult: z.string().min(1),
    weaponCriticalCode: z.string().min(1).optional(),
    weaponDamageClass: z.string().min(1).optional(),
    weaponName: z.string().min(1),
  })
  .superRefine((result, context) => {
    if (result.rollTotal === undefined && result.roll === undefined) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Combat attack result requires rollTotal or legacy roll.",
        path: ["rollTotal"],
      });
    }
    if (result.rollD20 === undefined && result.roll === undefined) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Combat attack result requires rollD20 or legacy roll.",
        path: ["rollD20"],
      });
    }
  })
  .transform((result) => {
    const rollTotal = result.rollTotal ?? result.roll;
    const rollD20 = result.rollD20 ?? result.roll;

    if (rollTotal === undefined || rollD20 === undefined) {
      throw new RangeError("Combat attack result requires an open-ended roll breakdown.");
    }

    return {
      ...result,
      rollD20,
      rollTotal,
    };
  });

export const combatRoundAttackResultsSchema = z.object({
  phase1: combatRoundAttackRollResultSchema.optional(),
  phase2: combatRoundAttackRollResultSchema.optional(),
});

export const combatRoundPhaseResolutionCursorSchema = z.object({
  participantId: idSchema,
  phase: combatRoundPhaseSchema,
  substep: combatRoundPhaseResolutionSubstepSchema,
});

export const combatRoundPhaseResolutionParticipantStatusSchema = z.object({
  substep: combatRoundPhaseResolutionStatusSubstepSchema.default("pending"),
  updatedAt: z.string().datetime().optional(),
});

export const combatRoundPhaseResolutionStatusesSchema = z.record(
  idSchema,
  z
    .object({
      phase1: combatRoundPhaseResolutionParticipantStatusSchema.optional(),
      phase2: combatRoundPhaseResolutionParticipantStatusSchema.optional(),
    })
    .default({}),
);

export const combatRoundParryModifierBreakdownEntrySchema = z.object({
  label: z.string().min(1),
  value: z.number().int(),
});
export type CombatRoundParryModifierBreakdownEntry = z.infer<
  typeof combatRoundParryModifierBreakdownEntrySchema
>;

export const combatRoundParryResolutionSchema = z.object({
  combinedParryScore: z.number().int().optional(),
  mainHandParryScore: z.number().int().optional(),
  modifiedParryBeforeRoll: z.number().int().optional(),
  modifierAdjustment: z.number().int().optional(),
  modifierBreakdown: z.array(combatRoundParryModifierBreakdownEntrySchema).optional(),
  notes: z.string().optional(),
  offHandParryScore: z.number().int().optional(),
  parrySourceLabel: z.string().min(1).optional(),
  openEndedD10s: z.array(z.number().int().min(1).max(10)).default([]),
  rawModifierTotal: z.number().int().optional(),
  resultLabel: z.string().min(1).optional(),
  rollD20: z.number().int().min(1).max(20).optional(),
  rollTotal: z.number().int().optional(),
  status: z.enum(["pending", "not_applicable", "resolved"]),
  success: z.boolean().optional(),
  targetNumber: z.number().int().positive().optional(),
  total: z.number().int().optional(),
  usedMainHand: z.boolean().optional(),
  usedOffHand: z.boolean().optional(),
});
export type CombatRoundParryResolution = z.infer<typeof combatRoundParryResolutionSchema>;

export const combatRoundDamageReviewAdditionalEffectKindSchema = z.enum([
  "modifier",
  "fatigue",
  "special",
  "note",
]);
export const combatRoundDamageReviewRowCategorySchema = z.enum([
  "physical_damage",
  "general_modifier",
  "ob_skill_modifier",
  "db_parry_modifier",
  "fatigue",
  "bleed",
  "internal_bleed",
  "no_combat_action",
  "loss_of_use",
  "dropped_item",
  "special_note",
]);
export const combatRoundDamageReviewModifierBucketSchema = z.enum(["general", "obSkill", "db"]);
export const combatRoundDamageReviewEffectPhaseSchema = z.enum([
  "phase1",
  "phase2",
  "round",
  "untilCleared",
]);
export const combatRoundCriticalEffectRollReportSchema = z.object({
  effectKey: z.string().min(1),
  formula: z.string().min(1),
  purpose: z.enum(["duration", "rate", "quantity", "other"]),
  rolls: z.array(z.number().int()),
  sourceField: z.enum(["durationRoll", "rateRollFormula", "sourceValue"]),
  total: z.number().int(),
});

export const combatRoundDamageReviewAdditionalEffectSchema = z
  .object({
    accepted: z.boolean().optional(),
    durationRounds: z.number().int().positive().optional(),
    effectOrder: z.number().int().positive().optional(),
    id: idSchema,
    kind: combatRoundDamageReviewAdditionalEffectKindSchema,
    label: z.string().min(1),
    minDamageReason: z.string().min(1).optional(),
    minTotalDamage: z.number().int().min(0).optional(),
    modifierBucket: combatRoundDamageReviewModifierBucketSchema.optional(),
    modifierValue: z.number().int().optional(),
    notes: z.string().optional(),
    phase: combatRoundDamageReviewEffectPhaseSchema.optional(),
    rateValuePerRound: z.number().positive().optional(),
    rowCategory: combatRoundDamageReviewRowCategorySchema.optional(),
    rollReports: z.array(combatRoundCriticalEffectRollReportSchema).optional(),
    sourceCritKey: z.string().min(1).optional(),
    sourceEffectKey: z.string().min(1).optional(),
    sourceText: z.string().min(1).optional(),
    sourceKind: z.literal("critical_table").optional(),
  })
  .superRefine((effect, context) => {
    if (effect.kind === "modifier" && !effect.modifierBucket) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Modifier effects require a modifier bucket.",
        path: ["modifierBucket"],
      });
    }

    if (
      (effect.kind === "modifier" || effect.kind === "fatigue") &&
      effect.modifierValue === undefined
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Modifier and fatigue effects require a modifier value.",
        path: ["modifierValue"],
      });
    }
  });

export const combatRoundDamageReviewOperationalConsequenceSchema = z.object({
  accepted: z.boolean().default(true),
  hand: z.enum(["mainHand", "offHand", "unknown"]).optional(),
  id: idSchema,
  itemId: idSchema.optional(),
  itemLabel: z.string().min(1).optional(),
  kind: z.enum(["drop_item", "cancel_pending_action", "note"]),
  label: z.string().min(1),
  notes: z.string().optional(),
  participantId: idSchema,
  phase: combatRoundPhaseSchema.optional(),
  reason: z.string().min(1),
  sourceCritKey: z.string().min(1).optional(),
  sourceEffectKey: z.string().min(1).optional(),
  sourceText: z.string().optional(),
  step: z.enum(["A1", "A2"]).optional(),
  targetActionId: idSchema.optional(),
});

export const combatRoundHitLocationRollResultSchema = z
  .object({
    attackResultId: idSchema.optional(),
    attackerParticipantId: idSchema.optional(),
    defenderParticipantId: idSchema.optional(),
    hitLocationRolls: z.array(z.number().int().min(1).max(20)).default([]),
    rolledAt: z.string().datetime().optional(),
    rolledByParticipantId: idSchema.optional(),
    rolledByUserId: idSchema.optional(),
    rollPrivilege: z.literal("attacker").default("attacker"),
    selectedHitLocation: hitLocationSchema.optional(),
    selectedHitLocationRoll: z.number().int().min(1).max(20).optional(),
    selectionReason: z.enum(["single_roll", "targeted_closest"]).optional(),
    status: z.enum(["pending", "rolled"]).default("pending"),
    targetLocation: hitLocationTargetSchema.optional(),
  })
  .default({});
export type CombatRoundHitLocationRollResult = z.infer<
  typeof combatRoundHitLocationRollResultSchema
>;

export const combatRoundCriticalRollResultSchema = z
  .object({
    armorCriticalModifier: z.number().int().default(0),
    armorCriticalModifierSource: z
      .object({
        reason: z.string().min(1).optional(),
        status: z.enum(["applied", "not_applied"]),
      })
      .default({
        reason: "Hit-location armor critical modifier is not wired to live defender equipment yet.",
        status: "not_applied",
      }),
    attackResultId: idSchema.optional(),
    attackerParticipantId: idSchema.optional(),
    criticalDice: z
      .tuple([z.number().int().min(1).max(8), z.number().int().min(1).max(8)])
      .optional(),
    criticalDiceTotal: z.number().int().optional(),
    criticalGrade: z.string().min(1).optional(),
    criticalTypeModifier: z.number().int().optional(),
    defenderParticipantId: idSchema.optional(),
    finalCriticalRoll: z.number().int().optional(),
    rolledAt: z.string().datetime().optional(),
    rolledByParticipantId: idSchema.optional(),
    rolledByUserId: idSchema.optional(),
    rollPrivilege: z.literal("attacker").default("attacker"),
    selectedHitLocation: hitLocationSchema.optional(),
    status: z.enum(["not_required", "pending", "rolled"]).default("not_required"),
  })
  .default({});
export type CombatRoundCriticalRollResult = z.infer<typeof combatRoundCriticalRollResultSchema>;

export const combatRoundDamageResultSchema = z.object({
  armorAppliesToDamage: z.boolean().default(true),
  armorAppliesToMinimumDamage: z.boolean().default(true),
  armorClass: combatArmorModifierClassSchema.optional(),
  armorCoverage: combatRoundDamageArmorCoverageSchema,
  armorCoverageLabel: z.string().min(1).optional(),
  armorDamageModifier: z.number().int().optional(),
  armorModifier: z.number().int().optional(),
  armorModifierSource: z
    .object({
      armorClass: combatArmorModifierClassSchema.optional(),
      label: z.string().min(1).optional(),
      reason: z.string().min(1).optional(),
      status: z.enum(["applied", "not_applied"]),
      weaponArmorClass: combatArmorModifierClassSchema.optional(),
    })
    .default({
      label: "No armor coverage",
      reason: "No defender armor coverage was available for this damage proposal.",
      status: "not_applied",
    }),
  armorRegion: combatRoundArmorRegionSchema.optional(),
  armorRegionLabel: z.string().min(1).optional(),
  armorValue: z.number().int().min(0).optional(),
  armorWarnings: z.array(z.string().min(1)).default([]),
  attackDirection: combatRoundAttackDirectionSchema.default("front"),
  attackResultId: idSchema,
  attackerParticipantId: idSchema,
  createdAt: z.string().datetime(),
  createdByUserId: idSchema.optional(),
  criticalGrade: z.string().min(1).optional(),
  damageRoll: z
    .object({
      derivedFromLookupTotal: z.number().int().optional(),
      derivedNormalDamageTotal: z.number().int().optional(),
      diceExpression: z.string().min(1).optional(),
      grazingDieSides: z.number().int().min(1).optional(),
      grazingReferenceDamage: z.number().int().optional(),
      grazingReferenceDamageLookupTotal: z.number().int().optional(),
      grazingReferenceHitLookupTotal: z.number().int().optional(),
      grazingReferenceTableDamage: z.number().int().optional(),
      rawGrazingDamage: z.number().int().optional(),
      required: z.boolean(),
      rolls: z.array(z.number().int()).optional(),
      total: z.number().int().optional(),
    })
    .default({ required: false }),
  defenderDm: z.number().int(),
  defenderParticipantId: idSchema,
  damageLookupTotal: z.number().int().optional(),
  dmb: z.number().int(),
  grazing: z.boolean(),
  hitLocationRolls: z.array(z.number().int().min(1).max(20)).default([]),
  hitLocationSelectionReason: z.enum(["single_roll", "targeted_closest"]).optional(),
  hitLookupTotal: z.number().int().optional(),
  kind: z.literal("damage_result"),
  attackerStrengthGm: z.number().int().optional(),
  cappedTotalDamage: z.number().int().min(0).optional(),
  maxDamageApplied: z.boolean().default(false),
  maxDamageCap: z.number().int().min(0).optional(),
  lookupTotal: z.number().int().optional(),
  maxDamageNote: z.string().min(1).optional(),
  minDamage: z.number().int().optional(),
  parryResultId: idSchema.optional(),
  phase: combatRoundPhaseSchema,
  review: z
    .object({
      additionalEffects: z.array(combatRoundDamageReviewAdditionalEffectSchema).default([]),
      attackDirectionOverride: combatRoundAttackDirectionSchema.optional(),
      armorModifierOverride: z.number().int().optional(),
      criticalGradeOverride: z.string().min(1).nullable().optional(),
      armorCriticalModifierOverride: z.number().int().optional(),
      criticalEffectProposal: z
        .object({
          bodyText: z.string().min(1).optional(),
          criticalIndexStatus: z
            .enum(["no_effect", "table_lookup", "unsupported_high", "unsupported"])
            .optional(),
          critIndex: z.number().int().positive().optional(),
          critKey: z.string().min(1).optional(),
          family: z.string().min(1).optional(),
          location: z.string().min(1).optional(),
          minDamageReason: z.string().min(1).optional(),
          minTotalDamage: z.number().int().min(0).optional(),
          rollReports: z.array(combatRoundCriticalEffectRollReportSchema).default([]),
          title: z.string().min(1).optional(),
          warnings: z.array(z.string().min(1)).default([]),
        })
        .optional(),
      criticalLocationOverride: hitLocationSchema.optional(),
      criticalTypeModifierOverride: z.number().int().optional(),
      finalCriticalRollOverride: z.number().int().optional(),
      notes: z.string().optional(),
      operationalConsequences: z
        .array(combatRoundDamageReviewOperationalConsequenceSchema)
        .default([]),
      reviewedAt: z.string().datetime().optional(),
      reviewedByUserId: idSchema.optional(),
      selectedHitLocationOverride: hitLocationSchema.optional(),
      totalDamageOverride: z.number().int().min(0).optional(),
    })
    .optional(),
  selectedHitLocation: hitLocationSchema.optional(),
  selectedHitLocationRoll: z.number().int().min(1).max(20).optional(),
  minimumDamageAfterArmor: z.number().int().min(0).optional(),
  minimumDamageBeforeArmor: z.number().int().min(0).optional(),
  provisionalDamageAfterArmor: z.number().int().optional(),
  rawTableDamage: z.number().int().optional(),
  tableDamage: z.number().int().optional(),
  tableDamageModifier: z.number().int().optional(),
  targetLocation: hitLocationTargetSchema.optional(),
  rawTotalDamage: z.number().int().min(0).optional(),
  totalDamage: z.number().int(),
  weaponArmorClass: combatArmorModifierClassSchema.optional(),
  weaponName: z.string().min(1).optional(),
});
export type CombatRoundDamageResult = z.infer<typeof combatRoundDamageResultSchema>;
export type CombatRoundDamageReview = NonNullable<CombatRoundDamageResult["review"]>;
export type CombatRoundDamageReviewAdditionalEffect = NonNullable<
  CombatRoundDamageReview["additionalEffects"]
>[number];
export type CombatRoundDamageReviewOperationalConsequence = NonNullable<
  CombatRoundDamageReview["operationalConsequences"]
>[number];

function isCombatRoundCriticalTableReviewEffect(
  effect: CombatRoundDamageReviewAdditionalEffect,
): boolean {
  return (
    effect.sourceKind === "critical_table" ||
    Boolean(effect.sourceCritKey) ||
    Boolean(effect.sourceEffectKey)
  );
}

function isCombatRoundCriticalTableOperationalConsequence(
  consequence: CombatRoundDamageReviewOperationalConsequence,
): boolean {
  return Boolean(consequence.sourceCritKey || consequence.sourceEffectKey);
}

function removeCombatRoundCriticalEffectProposalFromReview(
  review?: CombatRoundDamageReview,
): CombatRoundDamageReview | undefined {
  if (!review) {
    return undefined;
  }

  const additionalEffects = review.additionalEffects.filter(
    (effect) => !isCombatRoundCriticalTableReviewEffect(effect),
  );
  const operationalConsequences = review.operationalConsequences.filter(
    (consequence) => !isCombatRoundCriticalTableOperationalConsequence(consequence),
  );
  const nextReview = {
    ...review,
    additionalEffects,
    criticalEffectProposal: undefined,
    operationalConsequences,
  };

  return combatRoundDamageResultSchema.shape.review.unwrap().parse(nextReview);
}

function sanitizeCombatRoundReviewIdPart(value: string): string {
  return value.replace(/[^A-Za-z0-9_-]+/g, "-");
}

function getCombatRoundHandForHitLocation(
  location?: HitLocation,
): CombatRoundDamageReviewOperationalConsequence["hand"] {
  if (location === "rightArm") {
    return "mainHand";
  }

  if (location === "leftArm") {
    return "offHand";
  }

  return "unknown";
}

function getCriticalOperationalText(
  effect: CriticalEffectTemplate,
  result?: CriticalResult,
): string {
  return [
    result?.title,
    result?.bodyText,
    ...(result?.sourceSpecialTags ?? []),
    effect.type,
    effect.group,
    effect.subtype,
    effect.target,
    effect.specialFlag,
    effect.sourceField,
    effect.sourceValue,
    effect.implementationNote,
  ]
    .filter((entry): entry is string => Boolean(entry))
    .join(" ")
    .toLowerCase();
}

function criticalEffectImpliesDropItem(
  effect: CriticalEffectTemplate,
  result?: CriticalResult,
): boolean {
  const text = getCriticalOperationalText(effect, result);

  return (
    criticalEffectHasStructuredDropItem(effect) ||
    text.includes("drop anything") ||
    text.includes("dropped") ||
    text.includes("drop weapon") ||
    text.includes("drop item")
  );
}

function criticalEffectHasStructuredDropItem(effect: CriticalEffectTemplate): boolean {
  return effect.specialFlag === "drop_item" || effect.sourceValue?.toLowerCase() === "drop_item";
}

function criticalEffectImpliesLossOfArmUse(
  effect: CriticalEffectTemplate,
  result?: CriticalResult,
): boolean {
  const text = getCriticalOperationalText(effect, result);
  const target = effect.target?.toLowerCase() ?? "";
  const targetsArmOrHand =
    target.includes("arm") || target.includes("hand") || target.includes("lower_arm");

  return (
    (effect.subtype === "loss_of_use" && targetsArmOrHand) ||
    (targetsArmOrHand && effect.sourceValue?.toUpperCase() === "NO ACTION") ||
    (targetsArmOrHand && text.includes("no action")) ||
    text.includes("hand unusable") ||
    text.includes("arm unusable") ||
    text.includes("cannot use")
  );
}

function criticalEffectBlocksCombatAction(
  effect: CriticalEffectTemplate,
  result?: CriticalResult,
): boolean {
  const text = [
    result?.title,
    result?.bodyText,
    ...(result?.sourceSpecialTags ?? []),
    effect.actionState,
    effect.durationRaw,
    effect.specialFlag,
    effect.sourceField,
    effect.sourceValue,
  ]
    .filter((entry): entry is string => Boolean(entry))
    .join(" ")
    .toLowerCase();
  const actionState = effect.actionState?.toLowerCase();
  const sourceValue = effect.sourceValue?.toUpperCase();
  const specialFlag = effect.specialFlag?.toLowerCase();
  const resultTags = result?.sourceSpecialTags ?? [];

  return Boolean(
    actionState === "no_action" ||
    actionState === "no_meaningful_action" ||
    actionState === "unconscious" ||
    sourceValue === "NO ACTION" ||
    specialFlag === "unconscious" ||
    specialFlag === "collapse" ||
    resultTags.includes("unconscious") ||
    resultTags.includes("collapse") ||
    resultTags.includes("collapse_from_shock") ||
    text.includes("unconscious") ||
    text.includes("no action") ||
    text.includes("no actions") ||
    text.includes("may do nothing") ||
    text.includes("collapses") ||
    text.includes("collapse"),
  );
}

function findCombatRoundPendingPhaseAttackCandidate(input: {
  participantId: string;
  phase: CombatRoundPhase;
  state: CombatRoundState;
}):
  | {
      actionId?: string;
      itemLabel?: string;
      phase: CombatRoundPhase;
      step: "A1" | "A2";
    }
  | undefined {
  const normalized = combatRoundStateSchema.parse(input.state);
  const participant = normalized.participants.find(
    (entry) => entry.participantId === input.participantId,
  );

  if (!participant) {
    return undefined;
  }

  if (
    !combatRoundParticipantHasExecutablePhaseAttack({
      participantId: input.participantId,
      phase: input.phase,
      state: normalized,
    })
  ) {
    return undefined;
  }

  if (
    getCombatRoundOutgoingAttackResultForParticipantPhase({
      participantId: input.participantId,
      phase: input.phase,
      state: normalized,
    }) ||
    combatRoundParticipantPhaseActionHasCompletionEvidence({
      participantId: input.participantId,
      phase: input.phase,
      state: normalized,
    })
  ) {
    return undefined;
  }

  const status = getEffectiveCombatRoundPhaseResolutionStatus({
    participantId: input.participantId,
    phase: input.phase,
    state: normalized,
  });

  if (status.substep === "done") {
    return undefined;
  }

  const actionStep = getCombatRoundPhaseActionStepForPhase(input.phase);
  const snapshot = getCombatRoundStepSnapshot({
    participantId: input.participantId,
    roundNumber: normalized.roundNumber,
    state: normalized,
    step: actionStep,
  });

  return {
    actionId: participant.declaration?.actionId,
    itemLabel: snapshot?.attackSummary?.weaponName,
    phase: input.phase,
    step: input.phase === "phase1" ? "A1" : "A2",
  };
}

function buildCombatRoundCriticalOperationalConsequences(input: {
  damageResult: CombatRoundDamageResult;
  proposal: ReturnType<typeof buildCriticalEffectProposalFromDamageResult>;
  state?: CombatRoundState;
}): CombatRoundDamageReviewOperationalConsequence[] {
  const criticalResult = input.proposal.criticalResult;

  if (!criticalResult) {
    return [];
  }

  const resultWithEffects = getCriticalResultWithEffects(
    criticalResult.family,
    criticalResult.location,
    criticalResult.critIndex,
  );

  if (!resultWithEffects) {
    return [];
  }

  const relevantEffects = resultWithEffects.effects.filter(
    (effect) =>
      criticalEffectImpliesDropItem(effect, resultWithEffects.result) ||
      criticalEffectImpliesLossOfArmUse(effect, resultWithEffects.result) ||
      criticalEffectBlocksCombatAction(effect, resultWithEffects.result),
  );

  if (relevantEffects.length === 0) {
    return [];
  }

  const primaryEffect =
    relevantEffects.find((effect) =>
      criticalEffectBlocksCombatAction(effect, resultWithEffects.result),
    ) ??
    relevantEffects.find(criticalEffectHasStructuredDropItem) ??
    relevantEffects.find((effect) =>
      criticalEffectImpliesDropItem(effect, resultWithEffects.result),
    ) ??
    relevantEffects[0];
  const actionBlockingEffect = relevantEffects.find((effect) =>
    criticalEffectBlocksCombatAction(effect, resultWithEffects.result),
  );
  const dropEffect =
    relevantEffects.find(criticalEffectHasStructuredDropItem) ??
    relevantEffects.find((effect) =>
      criticalEffectImpliesDropItem(effect, resultWithEffects.result),
    );
  const sourceText = resultWithEffects.result.bodyText;
  const participantId = input.damageResult.defenderParticipantId;
  const hand = getCombatRoundHandForHitLocation(input.damageResult.selectedHitLocation);
  const phases: CombatRoundPhase[] =
    input.damageResult.phase === "phase1" ? ["phase1", "phase2"] : ["phase2"];
  const state = input.state;
  const candidates = state
    ? phases
        .map((phase) =>
          findCombatRoundPendingPhaseAttackCandidate({
            participantId,
            phase,
            state,
          }),
        )
        .filter(
          (
            candidate,
          ): candidate is {
            actionId?: string;
            itemLabel?: string;
            phase: CombatRoundPhase;
            step: "A1" | "A2";
          } => Boolean(candidate),
        )
    : [];
  const consequences: CombatRoundDamageReviewOperationalConsequence[] = [];
  const seen = new Set<string>();
  const addConsequence = (consequence: CombatRoundDamageReviewOperationalConsequence) => {
    const key = [
      consequence.kind,
      consequence.phase,
      consequence.step,
      consequence.itemLabel,
      consequence.sourceEffectKey,
    ].join(":");

    if (seen.has(key)) {
      return;
    }

    seen.add(key);
    consequences.push(combatRoundDamageReviewOperationalConsequenceSchema.parse(consequence));
  };

  for (const candidate of candidates) {
    if (candidate.itemLabel && dropEffect) {
      addConsequence({
        accepted: true,
        hand,
        id: `critical-operational-${sanitizeCombatRoundReviewIdPart(
          dropEffect.effectKey,
        )}-drop-${sanitizeCombatRoundReviewIdPart(candidate.itemLabel)}`,
        itemLabel: candidate.itemLabel,
        kind: "drop_item",
        label: `Drop item: ${candidate.itemLabel}`,
        participantId,
        reason: "Critical effect indicates the held item is dropped.",
        sourceCritKey: criticalResult.critKey,
        sourceEffectKey: dropEffect.effectKey,
        sourceText,
      });
    }

    addConsequence({
      accepted: true,
      hand,
      id: `critical-operational-${sanitizeCombatRoundReviewIdPart(
        actionBlockingEffect?.effectKey ?? primaryEffect?.effectKey ?? criticalResult.critKey,
      )}-cancel-${candidate.phase}-${candidate.step}`,
      itemLabel: candidate.itemLabel,
      kind: "cancel_pending_action",
      label: `Cancel pending ${candidate.phase === "phase1" ? "phase 1" : "phase 2"} attack${
        candidate.itemLabel ? `: ${candidate.itemLabel} attack` : ""
      }`,
      participantId,
      phase: candidate.phase,
      reason: actionBlockingEffect
        ? "Critical effect prevents combat action for this pending same-round attack."
        : "Critical effect prevents using the item/limb for this pending same-round attack.",
      sourceCritKey: criticalResult.critKey,
      sourceEffectKey: actionBlockingEffect?.effectKey ?? primaryEffect?.effectKey,
      sourceText,
      step: candidate.step,
      targetActionId: candidate.actionId,
    });
  }

  if (actionBlockingEffect) {
    const actionBlockingText = normalizeCombatRoundDedupeText(
      [
        actionBlockingEffect.actionState,
        actionBlockingEffect.durationRaw,
        actionBlockingEffect.sourceValue,
        sourceText,
      ]
        .filter(Boolean)
        .join(" "),
    );
    const isParryOnlyActionLock =
      actionBlockingEffect.actionState === "parry_only" ||
      combatRoundTextIndicatesParryOnly(actionBlockingText);

    addConsequence({
      accepted: true,
      hand,
      id: `critical-operational-${sanitizeCombatRoundReviewIdPart(
        actionBlockingEffect.effectKey,
      )}-no-action`,
      kind: "note",
      label: isParryOnlyActionLock ? "Action limited to parry" : "No combat action possible",
      notes: isParryOnlyActionLock
        ? "Committed as a visible specific action-limited row. Full next-round action gating remains GM-managed for now."
        : "Committed as a visible special combat/session row. Full next-round action gating remains GM-managed for now.",
      participantId,
      reason: isParryOnlyActionLock
        ? "Critical effect clearly limits combat action to parry."
        : "Critical effect clearly prevents combat action.",
      sourceCritKey: criticalResult.critKey,
      sourceEffectKey: actionBlockingEffect.effectKey,
      sourceText,
    });
  }

  if (candidates.length === 0 || candidates.some((candidate) => !candidate.itemLabel)) {
    const effect = primaryEffect ?? relevantEffects[0];

    if (effect) {
      addConsequence({
        accepted: false,
        hand,
        id: `critical-operational-${sanitizeCombatRoundReviewIdPart(effect.effectKey)}-note`,
        kind: "note",
        label: criticalEffectImpliesDropItem(effect, resultWithEffects.result)
          ? "Critical indicates dropped item"
          : "Critical may cancel limb-dependent action",
        notes: "GM should choose the affected item/action if one is pending.",
        participantId,
        reason:
          "Critical effect was clear, but the app could not safely identify a matching pending item/action.",
        sourceCritKey: criticalResult.critKey,
        sourceEffectKey: effect.effectKey,
        sourceText,
      });
    }
  }

  return consequences;
}

function mergeCombatRoundCriticalEffectProposalIntoReview(input: {
  damageResult: CombatRoundDamageResult;
  finalCriticalRoll?: number;
  rng?: () => number;
  selectedHitLocation?: HitLocation;
  state?: CombatRoundState;
  weaponCriticalCode?: string;
  weaponDamageClass?: string;
}): CombatRoundDamageReview {
  const existingReview = removeCombatRoundCriticalEffectProposalFromReview(
    input.damageResult.review,
  ) ?? { additionalEffects: [], operationalConsequences: [] };
  const proposal = buildCriticalEffectProposalFromDamageResult({
    existingCommittedDamageAmount: getCombatRoundEffectiveDamageResult(input.damageResult)
      .effectiveTotalDamage,
    finalCriticalRoll: input.finalCriticalRoll,
    rng: input.rng,
    selectedHitLocation: input.selectedHitLocation,
    weaponCriticalCode: input.weaponCriticalCode,
    weaponDamageClass: input.weaponDamageClass,
  });
  const operationalConsequences = buildCombatRoundCriticalOperationalConsequences({
    damageResult: input.damageResult,
    proposal,
    state: input.state,
  });

  return combatRoundDamageResultSchema.shape.review.unwrap().parse({
    ...existingReview,
    additionalEffects: [...existingReview.additionalEffects, ...proposal.proposedEffects],
    criticalEffectProposal: buildCriticalEffectProposalSummary(proposal),
    operationalConsequences: [
      ...(existingReview.operationalConsequences ?? []),
      ...operationalConsequences,
    ],
  });
}

export const combatRoundDamageSubstateSchema = z.enum([
  "location_pending",
  "location_rolled",
  "damage_proposal_ready",
  "critical_pending",
  "critical_rolled",
  "review_ready",
  "committed",
]);
export type CombatRoundDamageSubstate = z.infer<typeof combatRoundDamageSubstateSchema>;

export interface CombatRoundEffectiveDamageResult {
  computedArmorModifier: number;
  computedAttackDirection: CombatRoundAttackDirection;
  computedCriticalGrade?: string;
  computedDamageLookupTotal?: number;
  computedCappedTotalDamage?: number;
  computedMaxDamageApplied: boolean;
  computedMaxDamageCap?: number;
  computedMaxDamageNote?: string;
  computedMinDamage?: number;
  computedMinimumDamageAfterArmor?: number;
  computedProvisionalDamageAfterArmor?: number;
  computedSelectedHitLocation?: HitLocation;
  computedTableDamage?: number;
  computedTotalDamage: number;
  effectiveArmorClass?: CombatArmorModifierClass;
  effectiveArmorCoverageLabel?: string;
  effectiveArmorModifier: number;
  effectiveArmorRegion?: CombatRoundArmorRegion;
  effectiveArmorRegionLabel?: string;
  effectiveArmorValue: number;
  effectiveArmorWarnings: string[];
  effectiveAttackDirection: CombatRoundAttackDirection;
  effectiveCriticalGrade?: string;
  effectiveDamageLookupTotal?: number;
  effectiveDamageRoll: CombatRoundDamageResult["damageRoll"];
  effectiveCappedTotalDamage?: number;
  effectiveMaxDamageApplied: boolean;
  effectiveMaxDamageCap?: number;
  effectiveMaxDamageNote?: string;
  effectiveMinDamage?: number;
  effectiveMinimumDamageAfterArmor?: number;
  effectiveProvisionalDamageAfterArmor?: number;
  preCriticalEffectiveDamage: number;
  criticalMinTotalDamage?: number;
  criticalMinApplied: boolean;
  criticalMinExtra?: number;
  finalCommittedDamage: number;
  effectiveRawTotalDamage: number;
  effectiveSelectedHitLocation?: HitLocation;
  effectiveTableDamage?: number;
  effectiveTotalDamage: number;
  effectiveWeaponArmorClass?: CombatArmorModifierClass;
  hasReviewOverrides: boolean;
  requiresTotalDamageOverride: boolean;
  review?: CombatRoundDamageReview;
}

export interface CombatRoundPhaseDamageCommitReadiness {
  attackResultId?: string;
  ready: boolean;
  reason?: string;
  warnings: string[];
}

export const combatRoundPhaseResolutionResultSchema = z.object({
  attackResultId: idSchema,
  attackerParticipantId: idSchema,
  criticalRoll: combatRoundCriticalRollResultSchema,
  damageProposal: z
    .object({
      committedCombatEffectEventId: idSchema.optional(),
      committedCombatEffectIds: z.array(idSchema).default([]),
      proposedEffects: z.array(z.never()).default([]),
      status: z.enum(["not_ready", "drafted", "committed"]),
    })
    .default({ committedCombatEffectIds: [], proposedEffects: [], status: "not_ready" }),
  damageRoll: z
    .object({
      diceExpression: z.string().min(1).optional(),
      notes: z.string().optional(),
      rolls: z.array(z.number().int()).optional(),
      status: z.enum(["not_required", "pending", "rolled"]),
      total: z.number().int().optional(),
    })
    .default({ status: "pending" }),
  damageResult: combatRoundDamageResultSchema.optional(),
  defenderParticipantId: idSchema,
  hitLocationRoll: combatRoundHitLocationRollResultSchema,
  parryResolution: combatRoundParryResolutionSchema.default({ status: "pending" }),
  phase: combatRoundPhaseSchema,
  roundNumber: z.number().int().positive(),
  updatedAt: z.string().datetime(),
});

export const combatRoundDeclarationSchema = z.object({
  actionId: idSchema.optional(),
  additionalActionNotes: z.string().optional(),
  combatContext: scenarioParticipantCombatContextSchema.optional(),
  movementId: z.string().min(1).optional(),
  movementIntent: movementIntentSchema.optional(),
  phaseContexts: combatRoundPhaseContextsSchema.optional(),
  roundNumber: z.number().int().positive(),
  secondaryActionId: idSchema.optional(),
  submittedAt: z.string().datetime().optional(),
  submittedBy: z.enum(["gm", "player"]),
  submittedByUserId: idSchema.optional(),
});

const combatRoundStepStatusesSchema = z.record(combatRoundStepSchema, combatRoundStepStatusSchema);

export const combatRoundParticipantStateSchema = z.object({
  attackResults: combatRoundAttackResultsSchema.default({}),
  characterId: idSchema.optional(),
  combatExperience: combatRoundCombatExperienceResultSchema.optional(),
  declaration: combatRoundDeclarationSchema.optional(),
  initiatives: combatRoundInitiativesSchema.default({}),
  label: z.string().min(1),
  participantId: idSchema,
  scenarioParticipantId: idSchema.optional(),
  stepStatuses: combatRoundStepStatusesSchema.default(
    Object.fromEntries(COMBAT_ROUND_STEPS.map((step) => [step, "pending"])),
  ),
});

export const combatRoundStepSnapshotSchema = z.object({
  actionResultSummary: z.string().optional(),
  attackResult: combatRoundAttackRollResultSchema.optional(),
  attackSummary: z
    .object({
      attackMode: z.string(),
      dmb: z.string(),
      initiative: z.string(),
      maxCrits: z.string(),
      ob: z.string(),
      weaponName: z.string(),
    })
    .optional(),
  committedAt: z.string().datetime(),
  declarationSummary: z
    .object({
      actionId: idSchema.optional(),
      additionalActionNotes: z.string().optional(),
      movementId: idSchema.optional(),
      movementIntent: movementIntentSchema.optional(),
      secondaryActionId: idSchema.optional(),
    })
    .optional(),
  defenseSummary: z
    .object({
      db: z.string(),
      dm: z.string(),
      parry: z.string(),
      sourceName: z.string(),
    })
    .optional(),
  id: idSchema,
  initiativeRank: z
    .object({
      rank: z.number().int().positive(),
      rankTotal: z.number().int().nonnegative(),
      tiedCount: z.number().int().positive(),
    })
    .optional(),
  initiativeResult: combatRoundInitiativeResultSchema.optional(),
  modifierSummary: z
    .object({
      dbRaw: z.number().int().default(0),
      generalFatigueRaw: z.number().int().default(0),
      initiativeRaw: z.number().int().default(0),
      obSkillRaw: z.number().int().default(0),
      rows: z
        .array(
          z.object({
            bucketKey: scenarioCombatModifierBucketSchema,
            entries: z.array(scenarioCombatModifierEntrySchema).default([]),
            label: z.string().min(1),
            total: z.number().int(),
          }),
        )
        .default([]),
    })
    .optional(),
  participantId: idSchema,
  participantLabel: z.string().min(1),
  phase: combatRoundPhaseSchema.optional(),
  phaseContext: scenarioParticipantCombatContextSchema.optional(),
  phaseResolutionStatus: combatRoundPhaseResolutionParticipantStatusSchema.optional(),
  phaseResolutionResult: combatRoundPhaseResolutionResultSchema.optional(),
  roundNumber: z.number().int().positive(),
  step: combatRoundStepSchema,
});

export const completedCombatRoundSchema = z.object({
  activeParticipantId: idSchema.optional(),
  combatExperienceDifficulty: z.number().int().positive().optional(),
  commands: z.array(combatRoundCommandSchema).default([]),
  completedAt: z.string().datetime().optional(),
  completedByUserId: idSchema.optional(),
  currentCursor: combatRoundCursorSchema.optional(),
  currentStep: combatRoundStepSchema.default("round_summary"),
  distanceState: combatDistanceStateSchema.optional(),
  encounterId: idSchema.optional(),
  phaseResolutionCursor: combatRoundPhaseResolutionCursorSchema.optional(),
  phaseResolutionResults: z.array(combatRoundPhaseResolutionResultSchema).default([]),
  phaseResolutionStatuses: combatRoundPhaseResolutionStatusesSchema.default({}),
  participants: z.array(combatRoundParticipantStateSchema).default([]),
  roundEndReview: combatRoundEndReviewSchema.optional(),
  roundNumber: z.number().int().positive(),
  selectedParticipantId: idSchema.optional(),
  selectedStep: combatRoundStepSchema.optional(),
  stepSnapshots: z.array(combatRoundStepSnapshotSchema).default([]),
});

export const combatRoundStateSchema = z.object({
  activeParticipantId: idSchema.optional(),
  combatExperienceDifficulty: z.number().int().positive().optional(),
  commands: z.array(combatRoundCommandSchema).default([]),
  currentCursor: combatRoundCursorSchema.optional(),
  currentStep: combatRoundStepSchema.default("select_actions"),
  distanceState: combatDistanceStateSchema.default({ edges: {} }),
  encounterId: idSchema.optional(),
  phaseResolutionCursor: combatRoundPhaseResolutionCursorSchema.optional(),
  phaseResolutionResults: z.array(combatRoundPhaseResolutionResultSchema).default([]),
  phaseResolutionStatuses: combatRoundPhaseResolutionStatusesSchema.default({}),
  participants: z.array(combatRoundParticipantStateSchema).default([]),
  roundEndReview: combatRoundEndReviewSchema.optional(),
  roundNumber: z.number().int().positive().default(1),
  rounds: z.array(completedCombatRoundSchema).default([]),
  selectedParticipantId: idSchema.optional(),
  selectedStep: combatRoundStepSchema.optional(),
  stepSnapshots: z.array(combatRoundStepSnapshotSchema).default([]),
});

export type CombatRoundStepStatus = z.infer<typeof combatRoundStepStatusSchema>;
export type CombatRoundDeclaration = z.infer<typeof combatRoundDeclarationSchema>;
export type CombatRoundPhaseContexts = z.infer<typeof combatRoundPhaseContextsSchema>;
export type CombatRoundInitiativeResult = z.infer<typeof combatRoundInitiativeResultSchema>;
export type CombatRoundInitiatives = z.infer<typeof combatRoundInitiativesSchema>;
export type CombatRoundCombatExperienceRollResult = z.infer<
  typeof combatRoundCombatExperienceResultSchema
>;
export type CombatRoundAttackRollResult = z.infer<typeof combatRoundAttackRollResultSchema>;
export type CombatRoundAttackResults = z.infer<typeof combatRoundAttackResultsSchema>;
export type CombatRoundPhaseResolutionCursor = z.infer<
  typeof combatRoundPhaseResolutionCursorSchema
>;
export type CombatRoundPhaseResolutionResult = z.infer<
  typeof combatRoundPhaseResolutionResultSchema
>;
export type CombatRoundPhaseResolutionParticipantStatus = z.infer<
  typeof combatRoundPhaseResolutionParticipantStatusSchema
>;
export type CombatRoundPhaseResolutionStatuses = z.infer<
  typeof combatRoundPhaseResolutionStatusesSchema
>;
export type CombatRoundParticipantState = z.infer<typeof combatRoundParticipantStateSchema>;
export type CombatRoundStepSnapshot = z.infer<typeof combatRoundStepSnapshotSchema>;
export type CompletedCombatRound = z.infer<typeof completedCombatRoundSchema>;
export type CombatRoundState = z.infer<typeof combatRoundStateSchema>;
export interface CombatRoundInitiativeRank {
  rank: number;
  rankTotal: number;
  tiedCount: number;
}

function getCombatExperienceEffectiveTableTotal(input: {
  difficulty?: number;
  finalTotal: number;
}): {
  difficultyShift: number;
  effectiveTableTotal: number;
} {
  const finalTotal = Math.trunc(input.finalTotal);
  const difficulty = Math.trunc(input.difficulty ?? COMBAT_EXPERIENCE_TABLE_DIFFICULTY);
  const difficultyShift = difficulty - COMBAT_EXPERIENCE_TABLE_DIFFICULTY;

  return {
    difficultyShift,
    effectiveTableTotal: finalTotal - difficultyShift,
  };
}

export function evaluateCombatExperienceResult(
  finalTotal: number,
  input: { difficulty?: number; panicDurationRounds?: number } = {},
): CombatExperienceEvaluation {
  const { difficultyShift, effectiveTableTotal } = getCombatExperienceEffectiveTableTotal({
    difficulty: input.difficulty,
    finalTotal,
  });
  const baseEvaluation = {
    difficultyShift,
    effectiveTableTotal,
  };

  if (effectiveTableTotal <= 5) {
    return combatExperienceEvaluationSchema.parse({
      ...baseEvaluation,
      durationRounds: input.panicDurationRounds ?? 5,
      label: "Panic",
      modifierValue: -4,
      needsEffectRow: true,
      note: "combat exp panic",
      resultBand: "panic",
    });
  }

  if (effectiveTableTotal <= 10) {
    return combatExperienceEvaluationSchema.parse({
      ...baseEvaluation,
      durationRounds: 4,
      label: "Passive",
      modifierValue: -2,
      needsEffectRow: true,
      note: "combat exp passive",
      resultBand: "passive",
    });
  }

  if (effectiveTableTotal <= 15) {
    return combatExperienceEvaluationSchema.parse({
      ...baseEvaluation,
      durationRounds: 2,
      label: "Active",
      modifierValue: -2,
      needsEffectRow: true,
      note: "combat exp active -2",
      resultBand: "active_penalty",
    });
  }

  if (effectiveTableTotal <= 20) {
    return combatExperienceEvaluationSchema.parse({
      ...baseEvaluation,
      durationRounds: 1,
      label: "Active",
      modifierValue: -1,
      needsEffectRow: true,
      note: "combat exp active -1",
      resultBand: "active_penalty",
    });
  }

  return combatExperienceEvaluationSchema.parse({
    ...baseEvaluation,
    durationRounds: 0,
    label: "Active",
    modifierValue: 0,
    needsEffectRow: false,
    note: "combat exp active",
    resultBand: "active",
  });
}

export function evaluatePhaseCombatExperienceResult(
  finalTotal: number,
  input: { difficulty?: number } = {},
): CombatExperienceEvaluation {
  const { difficultyShift, effectiveTableTotal } = getCombatExperienceEffectiveTableTotal({
    difficulty: input.difficulty,
    finalTotal,
  });
  const baseEvaluation = {
    difficultyShift,
    effectiveTableTotal,
  };

  if (effectiveTableTotal <= 5) {
    return combatExperienceEvaluationSchema.parse({
      ...baseEvaluation,
      durationRounds: 0,
      label: "No attack",
      modifierValue: 0,
      needsEffectRow: false,
      note: "combat exp attack cancelled",
      resultBand: "panic",
    });
  }

  if (effectiveTableTotal <= 10) {
    return combatExperienceEvaluationSchema.parse({
      ...baseEvaluation,
      durationRounds: 0,
      label: "Attack continues",
      modifierValue: -4,
      needsEffectRow: false,
      note: "combat exp phase attack OB -4",
      resultBand: "passive",
    });
  }

  if (effectiveTableTotal <= 15) {
    return combatExperienceEvaluationSchema.parse({
      ...baseEvaluation,
      durationRounds: 0,
      label: "Attack continues",
      modifierValue: -3,
      needsEffectRow: false,
      note: "combat exp phase attack OB -3",
      resultBand: "active_penalty",
    });
  }

  if (effectiveTableTotal <= 20) {
    return combatExperienceEvaluationSchema.parse({
      ...baseEvaluation,
      durationRounds: 0,
      label: "Attack continues",
      modifierValue: -2,
      needsEffectRow: false,
      note: "combat exp phase attack OB -2",
      resultBand: "active_penalty",
    });
  }

  return combatExperienceEvaluationSchema.parse({
    ...baseEvaluation,
    durationRounds: 0,
    label: "Attack continues",
    modifierValue: 0,
    needsEffectRow: false,
    note: "combat exp phase attack continues",
    resultBand: "active",
  });
}

function isCombatRoundRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readCombatRoundNumber(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? Math.trunc(value) : undefined;
}

function normalizeCombatExperienceSkillKey(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function compactCombatExperienceSkillKey(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "");
}

function isCombatExperienceSkillIdentifier(identifier: string): boolean {
  const normalized = normalizeCombatExperienceSkillKey(identifier);
  const compact = compactCombatExperienceSkillKey(identifier);

  return (
    normalized === "combat_experience" ||
    normalized === "combat_experience_skill" ||
    compact === "combatexperience" ||
    compact === "combatexperienceskill"
  );
}

function getCombatExperienceSkillTotalSkillLists(participant: unknown): Array<{
  label: string;
  skills: unknown[];
}> {
  const lists: Array<{ label: string; skills: unknown[] }> = [];
  const addSkills = (label: string, owner: unknown) => {
    if (!isCombatRoundRecord(owner)) {
      return;
    }

    const draftView = isCombatRoundRecord(owner.draftView) ? owner.draftView : undefined;
    const skills = Array.isArray(draftView?.skills)
      ? draftView.skills
      : Array.isArray(owner.skills)
        ? owner.skills
        : [];

    if (skills.length > 0) {
      lists.push({ label, skills });
    }
  };

  if (isCombatRoundRecord(participant)) {
    addSkills("participant.sheetSummary.draftView.skills", participant.sheetSummary);
    addSkills("participant.draftView.skills", participant.draftView);

    if (isCombatRoundRecord(participant.snapshot)) {
      addSkills(
        "participant.snapshot.sheetSummary.draftView.skills",
        participant.snapshot.sheetSummary,
      );
      addSkills("participant.snapshot.draftView.skills", participant.snapshot.draftView);
    }
  }

  addSkills("snapshot.sheetSummary.draftView.skills", participant);

  return lists;
}

export interface ParticipantCombatExperienceSkillTotalLookup {
  matchedIdentifier?: string;
  skillTotal: number;
  source?: string;
  warning?: string;
}

function getCombatExperienceDisplayedSkillTotal(input: {
  label: string;
  skill: Record<string, unknown>;
}): ParticipantCombatExperienceSkillTotalLookup | undefined {
  const displayedTotalFields = [
    "totalSkill",
    "totalSkillLevel",
    "skillLevel",
    "total",
    "displayedTotal",
    "effectiveTotal",
    "effectiveSkillTotal",
  ] as const;
  const statAverageFields = [
    "linkedStatAverage",
    "linkedStatsAverage",
    "statAverage",
    "statsContribution",
    "stats",
    "avgStats",
  ] as const;
  const skillXpFields = ["effectiveSkillNumber", "totalXp", "skillXp", "xp"] as const;

  for (const field of displayedTotalFields) {
    const displayedTotal = readCombatRoundNumber(input.skill[field]);

    if (displayedTotal !== undefined) {
      return {
        skillTotal: displayedTotal,
        source: `${input.label}.${field}`,
      };
    }
  }

  const statAverageEntry = statAverageFields
    .map((field) => ({
      field,
      value: readCombatRoundNumber(input.skill[field]),
    }))
    .find(
      (entry): entry is { field: (typeof statAverageFields)[number]; value: number } =>
        entry.value !== undefined,
    );
  const skillXpEntry = skillXpFields
    .map((field) => ({
      field,
      value: readCombatRoundNumber(input.skill[field]),
    }))
    .find(
      (entry): entry is { field: (typeof skillXpFields)[number]; value: number } =>
        entry.value !== undefined,
    );

  if (statAverageEntry && skillXpEntry) {
    return {
      skillTotal: statAverageEntry.value + skillXpEntry.value,
      source: `${input.label}.${statAverageEntry.field}+${skillXpEntry.field}`,
    };
  }

  if (skillXpEntry) {
    return {
      skillTotal: skillXpEntry.value,
      source: `${input.label}.${skillXpEntry.field}`,
      warning: "Combat Experience displayed total was unavailable; using XP-only fallback.",
    };
  }

  return undefined;
}

export function getParticipantCombatExperienceSkillTotalLookup(
  participant: unknown,
): ParticipantCombatExperienceSkillTotalLookup {
  const skillLists = getCombatExperienceSkillTotalSkillLists(participant);

  if (skillLists.length === 0) {
    return {
      skillTotal: 0,
      warning: "Combat Experience skill data is missing from participant sheet summary.",
    };
  }

  for (const skillList of skillLists) {
    for (const skill of skillList.skills) {
      if (!isCombatRoundRecord(skill)) {
        continue;
      }

      const identifiers = [
        skill.skillId,
        skill.skillKey,
        skill.id,
        skill.name,
        skill.skillName,
      ].filter((entry): entry is string => typeof entry === "string");
      const matchedIdentifier = identifiers.find(isCombatExperienceSkillIdentifier);

      if (!matchedIdentifier) {
        continue;
      }

      const displayedTotal = getCombatExperienceDisplayedSkillTotal({
        label: skillList.label,
        skill,
      });

      if (displayedTotal) {
        return {
          ...displayedTotal,
          matchedIdentifier,
        };
      }

      return {
        matchedIdentifier,
        skillTotal: 0,
        source: skillList.label,
        warning: "Combat Experience skill exists, but no numeric total was available.",
      };
    }
  }

  return {
    skillTotal: 0,
    warning: "Combat Experience skill was not found in participant sheet summary skills.",
  };
}

export function getParticipantCombatExperienceSkillTotal(participant: unknown): number {
  return getParticipantCombatExperienceSkillTotalLookup(participant).skillTotal;
}

export function getCombatExperienceSkillTotalFromSnapshot(snapshot: unknown): number {
  return getParticipantCombatExperienceSkillTotalLookup({ snapshot }).skillTotal;
}

function rollCombatExperiencePanicDuration(randomFn: () => number): number {
  return Math.floor(randomFn() * 6) + 5;
}

export function rollOpenEndedD6(
  input: {
    maxRolls?: number;
    randomFn?: () => number;
  } = {},
): CombatRoundInitiativeResult & { isOpenEnded: boolean } {
  const randomFn = input.randomFn ?? Math.random;
  const maxRolls = input.maxRolls ?? 100;
  const rolls: number[] = [];

  for (let index = 0; index < maxRolls; index += 1) {
    const roll = Math.min(6, Math.max(1, Math.floor(randomFn() * 6) + 1));
    rolls.push(roll);

    if (roll !== 6) {
      break;
    }
  }

  return {
    baseInitiative: 0,
    isOpenEnded: rolls.length > 1,
    modifierAdjustment: 0,
    rolls,
    rollTotal: rolls.reduce((sum, roll) => sum + roll, 0),
    total: rolls.reduce((sum, roll) => sum + roll, 0),
  };
}

export function buildCombatRoundInitiativeResult(input: {
  baseInitiative?: number;
  modifierAdjustment?: number;
  roll: CombatRoundInitiativeResult;
}): CombatRoundInitiativeResult {
  const rollTotal = input.roll.rollTotal ?? input.roll.total;
  const baseInitiative = input.baseInitiative ?? 0;
  const modifierAdjustment = input.modifierAdjustment ?? 0;

  return combatRoundInitiativeResultSchema.parse({
    baseInitiative,
    modifierAdjustment,
    rolls: input.roll.rolls,
    rollTotal,
    total: baseInitiative + modifierAdjustment + rollTotal,
  });
}

function normalizeCombatRoundInitiativeResult(
  initiative: CombatRoundInitiativeResult | number | undefined,
): CombatRoundInitiativeResult | undefined {
  if (initiative === undefined) {
    return undefined;
  }

  return combatRoundInitiativeResultSchema.parse(
    typeof initiative === "number"
      ? { baseInitiative: 0, rolls: [], rollTotal: initiative, total: initiative }
      : {
          ...initiative,
          modifierAdjustment:
            initiative.modifierAdjustment ??
            initiative.total -
              (initiative.baseInitiative ?? 0) -
              (initiative.rollTotal ?? initiative.total - (initiative.baseInitiative ?? 0)),
          rollTotal: initiative.rollTotal ?? initiative.total - (initiative.baseInitiative ?? 0),
        },
  );
}

export function getCombatRoundInitiativeTotal(
  initiative?: CombatRoundInitiativeResult,
): number | undefined {
  return initiative?.total;
}

function buildDefaultStepStatuses(): Record<CombatRoundStep, CombatRoundStepStatus> {
  return Object.fromEntries(COMBAT_ROUND_STEPS.map((step) => [step, "pending"])) as Record<
    CombatRoundStep,
    CombatRoundStepStatus
  >;
}

function mergeStepStatuses(
  existing?: Partial<Record<CombatRoundStep, CombatRoundStepStatus>>,
): Record<CombatRoundStep, CombatRoundStepStatus> {
  return {
    ...buildDefaultStepStatuses(),
    ...existing,
  };
}

export function getCombatRoundCursorStepForStep(step: CombatRoundStep): CombatRoundCursorStep {
  return combatRoundCursorStepSchema.parse(COMBAT_ROUND_STEP_ABBREVIATIONS[step]);
}

export function getCombatRoundStepForCursorStep(step: CombatRoundCursorStep): CombatRoundStep {
  const entry = COMBAT_ROUND_STEPS.find(
    (candidate) => COMBAT_ROUND_STEP_ABBREVIATIONS[candidate] === step,
  );

  if (!entry) {
    throw new RangeError(`Unsupported combat round cursor step: ${step}`);
  }

  return entry;
}

export function isGlobalCombatRoundCursorStep(step: CombatRoundCursorStep): boolean {
  return (
    step === "DE" ||
    step === "M1" ||
    step === "i1" ||
    step === "M2" ||
    step === "i2" ||
    step === "SU"
  );
}

function isGlobalCombatRoundStep(step: CombatRoundStep): boolean {
  return (
    step === "select_actions" ||
    step === "review_action_modifiers" ||
    step === "initiative_phase_1" ||
    step === "review_phase_2_modifiers" ||
    step === "initiative_phase_2" ||
    step === "round_summary"
  );
}

function getCombatRoundGlobalCommandTypeForStep(
  step: CombatRoundStep,
): CombatRoundCommandType | undefined {
  switch (step) {
    case "select_actions":
      return "declare_action";
    case "review_action_modifiers":
      return "review_modifiers_phase1";
    case "initiative_phase_1":
      return "roll_initiative_phase1";
    case "review_phase_2_modifiers":
      return "review_modifiers_phase2";
    case "initiative_phase_2":
      return "roll_initiative_phase2";
    case "round_summary":
      return "complete_round";
    default:
      return undefined;
  }
}

function getNextCombatRoundGlobalParticipantId(input: {
  participantId: string;
  state: CombatRoundState;
}): string {
  const participantIds = input.state.participants.map((participant) => participant.participantId);
  const participantIndex = participantIds.indexOf(input.participantId);

  if (participantIndex < 0 || participantIndex >= participantIds.length - 1) {
    return input.participantId;
  }

  return participantIds[participantIndex + 1] ?? input.participantId;
}

function getDefaultCombatRoundCursor(input: {
  participantId?: string;
  roundNumber: number;
  step: CombatRoundStep;
}): CombatRoundCursor {
  return combatRoundCursorSchema.parse({
    participantId: input.participantId,
    roundNumber: input.roundNumber,
    step: getCombatRoundCursorStepForStep(input.step),
  });
}

function getCombatRoundAttackCursorStepForPhase(phase: CombatRoundPhase): CombatRoundCursorStep {
  return phase === "phase1" ? "A1" : "A2";
}

function getCombatRoundParryCursorStepForPhase(phase: CombatRoundPhase): CombatRoundCursorStep {
  return phase === "phase1" ? "P1" : "P2";
}

function getCombatRoundDamageCursorStepForPhase(phase: CombatRoundPhase): CombatRoundCursorStep {
  return phase === "phase1" ? "D1" : "D2";
}

function getCombatRoundCursorStepForPhaseResolutionSubstep(input: {
  phase: CombatRoundPhase;
  substep: CombatRoundPhaseResolutionSubstep;
}): CombatRoundCursorStep {
  switch (input.substep) {
    case "attack":
    case "done":
    case "effects":
      return getCombatRoundAttackCursorStepForPhase(input.phase);
    case "parry":
      return getCombatRoundParryCursorStepForPhase(input.phase);
    case "damage":
      return getCombatRoundDamageCursorStepForPhase(input.phase);
  }
}

function getCombatRoundPhaseCompletionCursor(input: {
  phase: CombatRoundPhase;
  state: CombatRoundState;
}): CombatRoundCursor {
  const participantId = input.state.participants[0]?.participantId;

  return combatRoundCursorSchema.parse({
    participantId,
    roundNumber: input.state.roundNumber,
    step: input.phase === "phase1" ? "M2" : "SU",
  });
}

function moveCombatRoundToPhaseCompletion(input: {
  phase: CombatRoundPhase;
  state: CombatRoundState;
}): CombatRoundState {
  const normalized = combatRoundStateSchema.parse(input.state);
  const currentCursor = getCombatRoundPhaseCompletionCursor({
    phase: input.phase,
    state: normalized,
  });
  const selectedStep = getCombatRoundStepForCursorStep(currentCursor.step);

  return {
    ...normalized,
    currentCursor,
    currentStep: selectedStep,
    phaseResolutionCursor: undefined,
    selectedParticipantId: currentCursor.participantId ?? normalized.selectedParticipantId,
    selectedStep,
  };
}

function getCombatRoundPhaseActionOrCompletionCursor(input: {
  phase: CombatRoundPhase;
  state: CombatRoundState;
}): CombatRoundCursor {
  const normalized = clearUnsupportedCombatRoundPhaseActionProgress({
    phase: input.phase,
    state: input.state,
  });
  const participantId = getNextCombatRoundPhaseActionParticipantId({
    phase: input.phase,
    state: normalized,
  });

  if (!participantId) {
    return getCombatRoundPhaseCompletionCursor(input);
  }

  return combatRoundCursorSchema.parse({
    participantId,
    roundNumber: normalized.roundNumber,
    step: getCombatRoundAttackCursorStepForPhase(input.phase),
  });
}

function getCombatRoundCursorForPhaseResolutionCursor(input: {
  cursor: CombatRoundPhaseResolutionCursor;
  roundNumber?: number;
  state: CombatRoundState;
}): CombatRoundCursor {
  const incomingAttackResult = getCombatRoundDisplayIncomingAttackResultForParticipantPhase({
    participantId: input.cursor.participantId,
    phase: input.cursor.phase,
    state: input.state,
  });
  const step =
    input.cursor.substep === "parry" && !incomingAttackResult
      ? getCombatRoundAttackCursorStepForPhase(input.cursor.phase)
      : getCombatRoundCursorStepForPhaseResolutionSubstep({
          phase: input.cursor.phase,
          substep: input.cursor.substep,
        });

  return combatRoundCursorSchema.parse({
    participantId: input.cursor.participantId,
    roundNumber: input.roundNumber ?? input.state.roundNumber,
    step,
  });
}

function buildCombatRoundCommandId(input: {
  createdAt: string;
  participantId: string;
  state: CombatRoundState;
  type: CombatRoundCommandType;
}): string {
  return [
    "combat-command",
    input.state.roundNumber,
    input.state.commands.length + 1,
    input.type,
    input.participantId,
    input.createdAt,
  ].join(":");
}

export function recordCombatRoundGlobalParticipantCommand(input: {
  commandId?: string;
  createdAt: string;
  createdByUserId?: string;
  facts?: Record<string, unknown>;
  participantId: string;
  state: CombatRoundState;
  step: CombatRoundStep;
  type?: CombatRoundCommandType;
}): CombatRoundState {
  const normalized = combatRoundStateSchema.parse(input.state);
  const commandType = input.type ?? getCombatRoundGlobalCommandTypeForStep(input.step);

  if (!commandType || !isGlobalCombatRoundStep(input.step)) {
    return normalized;
  }

  const actorExists = normalized.participants.some(
    (participant) => participant.participantId === input.participantId,
  );

  if (!actorExists) {
    return normalized;
  }

  const beforeCursor = getDefaultCombatRoundCursor({
    participantId: input.participantId,
    roundNumber: normalized.roundNumber,
    step: input.step,
  });
  const afterParticipantId = getNextCombatRoundGlobalParticipantId({
    participantId: input.participantId,
    state: normalized,
  });
  const afterCursor = getDefaultCombatRoundCursor({
    participantId: afterParticipantId,
    roundNumber: normalized.roundNumber,
    step: input.step,
  });
  const command = combatRoundCommandSchema.parse({
    afterCursor,
    beforeCursor,
    createdAt: input.createdAt,
    createdByUserId: input.createdByUserId,
    facts: {
      step: beforeCursor.step,
      ...input.facts,
    },
    id:
      input.commandId ??
      buildCombatRoundCommandId({
        createdAt: input.createdAt,
        participantId: input.participantId,
        state: normalized,
        type: commandType,
      }),
    participantId: input.participantId,
    roundNumber: normalized.roundNumber,
    type: commandType,
  });
  const selectedStep = getCombatRoundStepForCursorStep(command.afterCursor.step);

  return {
    ...normalized,
    commands: [...normalized.commands, command],
    currentCursor: command.afterCursor,
    selectedParticipantId: command.afterCursor.participantId ?? normalized.selectedParticipantId,
    selectedStep,
  };
}

export function isCombatStartExperienceRollRequired(input: {
  participantId: string;
  state: CombatRoundState;
}): boolean {
  const normalized = combatRoundStateSchema.parse(input.state);

  if (normalized.roundNumber !== 1) {
    return false;
  }

  const participant = normalized.participants.find(
    (entry) => entry.participantId === input.participantId,
  );

  if (!participant) {
    return false;
  }

  return !(
    participant.combatExperience?.trigger === "combat_start" &&
    participant.combatExperience.roundNumber === normalized.roundNumber
  );
}

export function getCombatRoundCombatExperienceDifficulty(state: CombatRoundState): number {
  const normalized = combatRoundStateSchema.parse(state);

  return normalized.combatExperienceDifficulty ?? COMBAT_EXPERIENCE_DEFAULT_DIFFICULTY;
}

export function isCombatRoundCombatExperienceWindowOpen(state: CombatRoundState): boolean {
  const normalized = combatRoundStateSchema.parse(state);

  return normalized.combatExperienceDifficulty !== undefined;
}

export function hasCombatRoundCombatExperienceRoll(state: CombatRoundState): boolean {
  const normalized = combatRoundStateSchema.parse(state);

  return normalized.participants.some(
    (participant) =>
      participant.combatExperience?.trigger === "combat_start" &&
      participant.combatExperience.roundNumber === normalized.roundNumber,
  );
}

export function setCombatRoundCombatExperienceDifficulty(input: {
  difficulty: number;
  state: CombatRoundState;
}): CombatRoundState {
  const normalized = combatRoundStateSchema.parse(input.state);
  const difficulty = Math.trunc(input.difficulty);

  if (!Number.isInteger(difficulty) || difficulty <= 0) {
    throw new RangeError("Combat Experience difficulty must be a positive integer.");
  }

  if (normalized.currentStep !== "select_actions") {
    throw new RangeError("Combat Experience difficulty can only be changed during declaration.");
  }

  if (hasCombatRoundCombatExperienceRoll(normalized)) {
    throw new RangeError(
      "Combat Experience difficulty cannot be changed after rolls have been recorded. Clear Combat Experience results first.",
    );
  }

  return combatRoundStateSchema.parse({
    ...normalized,
    combatExperienceDifficulty: difficulty,
  });
}

export function getCombatRoundDistanceEdge(input: {
  participantAId: string;
  participantBId: string;
  state: CombatRoundState;
}): CombatDistanceEdge | undefined {
  const normalized = combatRoundStateSchema.parse(input.state);

  return getDistanceEdgeBetween(
    normalized.distanceState,
    input.participantAId,
    input.participantBId,
  );
}

export function setCombatRoundPairDistance(input: {
  command?: {
    commandId?: string;
    createdAt: string;
    createdByUserId?: string;
  };
  distance: CombatDistance | number | string;
  participantAId: string;
  participantBId: string;
  source?: CombatDistanceSource;
  state: CombatRoundState;
}): CombatRoundState {
  const normalized = combatRoundStateSchema.parse(input.state);
  const participantIds = new Set(
    normalized.participants.map((participant) => participant.participantId),
  );

  if (!participantIds.has(input.participantAId) || !participantIds.has(input.participantBId)) {
    throw new RangeError("Pair distance can only be set for active combat participants.");
  }

  const previousEdge = getDistanceEdgeBetween(
    normalized.distanceState,
    input.participantAId,
    input.participantBId,
  );
  const distance = combatDistanceSchema.parse(
    typeof input.distance === "string" ? Number(input.distance) : input.distance,
  );
  const nextDistanceState = setDistanceBetween({
    distance,
    lastChangedRound: normalized.roundNumber,
    participantAId: input.participantAId,
    participantBId: input.participantBId,
    source: input.source ?? "gm_set",
    state: normalized.distanceState,
  });
  const nextEdge = getDistanceEdgeBetween(
    nextDistanceState,
    input.participantAId,
    input.participantBId,
  );
  const stateWithDistance = combatRoundStateSchema.parse({
    ...normalized,
    distanceState: nextDistanceState,
  });

  if (!input.command) {
    return stateWithDistance;
  }

  const beforeCursor =
    normalized.currentCursor ??
    getDefaultCombatRoundCursor({
      participantId: normalized.selectedParticipantId ?? input.participantAId,
      roundNumber: normalized.roundNumber,
      step: normalized.currentStep,
    });
  const commandType = "set_pair_distance" satisfies CombatRoundCommandType;
  const commandId =
    input.command.commandId ??
    buildCombatRoundCommandId({
      createdAt: input.command.createdAt,
      participantId: input.participantAId,
      state: normalized,
      type: commandType,
    });
  const command = combatRoundCommandSchema.parse({
    afterCursor: beforeCursor,
    beforeCursor,
    createdAt: input.command.createdAt,
    createdByUserId: input.command.createdByUserId,
    facts: {
      newDistance: distance,
      nextEdge,
      pairKey: makeDistancePairKey(input.participantAId, input.participantBId),
      participantAId: input.participantAId,
      participantBId: input.participantBId,
      previousEdge,
      source: input.source ?? "gm_set",
    },
    id: commandId,
    participantId: input.participantAId,
    roundNumber: normalized.roundNumber,
    type: commandType,
  });

  return combatRoundStateSchema.parse({
    ...stateWithDistance,
    commands: [...stateWithDistance.commands, command],
    currentCursor: command.afterCursor,
    currentStep: getCombatRoundStepForCursorStep(command.afterCursor.step),
    selectedParticipantId: command.afterCursor.participantId ?? input.participantAId,
    selectedStep: getCombatRoundStepForCursorStep(command.afterCursor.step),
  });
}

export function getCombatExperienceTriggerForPhase(
  phase: CombatRoundPhase,
): CombatExperienceTrigger {
  return phase === "phase1" ? "phase1_attack" : "phase2_attack";
}

export function getCombatExperiencePhaseForTrigger(
  trigger: CombatExperienceTrigger,
): CombatRoundPhase | undefined {
  if (trigger === "phase1_attack") {
    return "phase1";
  }

  if (trigger === "phase2_attack") {
    return "phase2";
  }

  return undefined;
}

function getCombatRoundPhaseInitiativeStepForPhase(phase: CombatRoundPhase): CombatRoundStep {
  return phase === "phase1" ? "initiative_phase_1" : "initiative_phase_2";
}

function getCombatRoundPhaseInitiativeCursorStepForPhase(
  phase: CombatRoundPhase,
): CombatRoundCursorStep {
  return phase === "phase1" ? "i1" : "i2";
}

function getCombatRoundCombatExperienceTriggerForStep(
  step: CombatRoundStep,
): CombatExperienceTrigger | undefined {
  if (step === "select_actions") {
    return "combat_start";
  }

  if (step === "phase_1_actions") {
    return "phase1_attack";
  }

  if (step === "phase_2_actions") {
    return "phase2_attack";
  }

  if (step === "initiative_phase_1") {
    return "phase1_attack";
  }

  if (step === "initiative_phase_2") {
    return "phase2_attack";
  }

  return undefined;
}

function participantHasCombatExperienceForTrigger(input: {
  participant: CombatRoundParticipantState;
  roundNumber: number;
  trigger: CombatExperienceTrigger;
}): boolean {
  return (
    input.participant.combatExperience?.trigger === input.trigger &&
    input.participant.combatExperience.roundNumber === input.roundNumber
  );
}

function getCombatRoundParticipantTargetAliases(
  participant: Pick<
    CombatRoundParticipantState,
    "characterId" | "participantId" | "scenarioParticipantId"
  >,
): string[] {
  return [
    participant.participantId,
    participant.scenarioParticipantId,
    participant.characterId,
  ].filter(
    (entry, index, aliases): entry is string =>
      typeof entry === "string" && entry.length > 0 && aliases.indexOf(entry) === index,
  );
}

function combatRoundTargetMatchesParticipant(input: {
  participant: Pick<
    CombatRoundParticipantState,
    "characterId" | "participantId" | "scenarioParticipantId"
  >;
  targetParticipantId?: string;
}): boolean {
  return Boolean(
    input.targetParticipantId &&
    getCombatRoundParticipantTargetAliases(input.participant).includes(input.targetParticipantId),
  );
}

function getCombatRoundParticipantByTargetId(input: {
  state: CombatRoundState;
  targetParticipantId?: string;
}): CombatRoundParticipantState | undefined {
  const normalized = combatRoundStateSchema.parse(input.state);

  if (!input.targetParticipantId) {
    return undefined;
  }

  return normalized.participants.find((participant) =>
    combatRoundTargetMatchesParticipant({
      participant,
      targetParticipantId: input.targetParticipantId,
    }),
  );
}

function getCombatRoundVisibilityValue(input: {
  seenAliases: string[];
  viewerAliases: string[];
  visibility?: CombatRoundVisibility;
}): boolean | undefined {
  for (const viewerAlias of input.viewerAliases) {
    const participantVisibility = input.visibility?.[viewerAlias];

    if (!participantVisibility) {
      continue;
    }

    for (const seenAlias of input.seenAliases) {
      const value = participantVisibility[seenAlias];

      if (value !== undefined) {
        return value;
      }
    }
  }

  return undefined;
}

function isCombatRoundParticipantAwareOfPhaseAttacker(input: {
  attacker: CombatRoundParticipantState;
  participant: CombatRoundParticipantState;
  visibility?: CombatRoundVisibility;
}): boolean {
  const attackerIsVisible = getCombatRoundVisibilityValue({
    seenAliases: getCombatRoundParticipantTargetAliases(input.attacker),
    viewerAliases: getCombatRoundParticipantTargetAliases(input.participant),
    visibility: input.visibility,
  });

  return attackerIsVisible !== false;
}

function combatRoundParticipantHasPendingExecutablePhaseAttack(input: {
  participantId: string;
  phase: CombatRoundPhase;
  state: CombatRoundState;
}): boolean {
  const normalized = combatRoundStateSchema.parse(input.state);
  const participant = normalized.participants.find(
    (entry) => entry.participantId === input.participantId,
  );
  const actionStep = getCombatRoundPhaseActionStepForPhase(input.phase);
  const status = getEffectiveCombatRoundPhaseResolutionStatus({
    participantId: input.participantId,
    phase: input.phase,
    state: normalized,
  });

  if (!participant) {
    return false;
  }

  if (status.substep === "done") {
    return false;
  }

  if (
    participant.stepStatuses[actionStep] === "skipped" ||
    participant.stepStatuses[actionStep] === "complete"
  ) {
    return false;
  }

  if (
    combatRoundParticipantPhaseActionHasCompletionEvidence({
      participantId: input.participantId,
      phase: input.phase,
      state: normalized,
    })
  ) {
    return false;
  }

  return combatRoundParticipantHasExecutablePhaseAttack({
    participantId: input.participantId,
    phase: input.phase,
    state: normalized,
  });
}

function combatRoundPhaseThreatRequiresCombatExperience(
  threat: Pick<CombatRoundPhaseCombatExperienceThreat, "reason">,
): boolean {
  return threat.reason === "close_initiative" || threat.reason === "lower_initiative";
}

export function getCombatRoundPhaseInitiativeChoice(input: {
  participantId: string;
  phase: CombatRoundPhase;
  state: CombatRoundState;
}): CombatRoundPhaseInitiativeChoice | undefined {
  const normalized = combatRoundStateSchema.parse(input.state);

  for (let index = normalized.commands.length - 1; index >= 0; index -= 1) {
    const command = normalized.commands[index];

    if (
      !command ||
      command.roundNumber !== normalized.roundNumber ||
      command.type !== "submit_phase_initiative_choice" ||
      command.participantId !== input.participantId ||
      command.phase !== input.phase
    ) {
      continue;
    }

    const parsed = combatRoundPhaseInitiativeChoiceSchema.safeParse({
      ...command.facts,
      commandId: command.id,
      participantId: command.participantId,
      phase: command.phase,
      roundNumber: command.roundNumber,
      submittedAt: command.createdAt,
      submittedByUserId: command.createdByUserId,
    });

    return parsed.success ? parsed.data : undefined;
  }

  return undefined;
}

function combatRoundPhaseInitiativeChoiceSubmitted(input: {
  participantId: string;
  phase: CombatRoundPhase;
  state: CombatRoundState;
}): boolean {
  return Boolean(getCombatRoundPhaseInitiativeChoice(input));
}

export function getCombatRoundPhaseAttackBackOutOpportunity(input: {
  participantId: string;
  phase: CombatRoundPhase;
  state: CombatRoundState;
  visibility?: CombatRoundVisibility;
}): CombatRoundPhaseAttackBackOutOpportunity | undefined {
  const normalized = combatRoundStateSchema.parse(input.state);
  const participant = normalized.participants.find(
    (entry) => entry.participantId === input.participantId,
  );
  const trigger = getCombatExperienceTriggerForPhase(input.phase);

  if (!participant) {
    return undefined;
  }

  if (!isCombatRoundPhaseInitiativeComplete({ phase: input.phase, state: normalized })) {
    return undefined;
  }

  if (
    participantHasCombatExperienceForTrigger({
      participant,
      roundNumber: normalized.roundNumber,
      trigger,
    })
  ) {
    return undefined;
  }

  if (
    !combatRoundParticipantHasPendingExecutablePhaseAttack({
      participantId: input.participantId,
      phase: input.phase,
      state: normalized,
    })
  ) {
    return undefined;
  }

  const participantInitiative = getCombatRoundInitiativeTotal(participant.initiatives[input.phase]);

  if (participantInitiative === undefined) {
    return undefined;
  }

  const threats = normalized.participants.flatMap((attacker) => {
    if (attacker.participantId === input.participantId) {
      return [];
    }

    if (
      !combatRoundParticipantHasPendingExecutablePhaseAttack({
        participantId: attacker.participantId,
        phase: input.phase,
        state: normalized,
      })
    ) {
      return [];
    }

    const attackerTargetId =
      attacker.declaration?.phaseContexts?.[input.phase]?.targetParticipantId;

    if (
      !combatRoundTargetMatchesParticipant({
        participant,
        targetParticipantId: attackerTargetId,
      })
    ) {
      return [];
    }

    if (
      !isCombatRoundParticipantAwareOfPhaseAttacker({
        attacker,
        participant,
        visibility: input.visibility,
      })
    ) {
      return [];
    }

    const attackerInitiative = getCombatRoundInitiativeTotal(attacker.initiatives[input.phase]);

    if (attackerInitiative === undefined) {
      return [];
    }

    const initiativeDifference = Math.abs(participantInitiative - attackerInitiative);
    const reason =
      initiativeDifference <= 3
        ? ("close_initiative" as const)
        : participantInitiative < attackerInitiative
          ? ("lower_initiative" as const)
          : ("higher_initiative" as const);

    return [
      {
        attackerInitiative,
        attackerParticipantId: attacker.participantId,
        initiativeDifference,
        participantInitiative,
        reason,
      },
    ];
  });

  if (threats.length === 0) {
    return undefined;
  }

  const ceRequired = threats.some(combatRoundPhaseThreatRequiresCombatExperience);

  return {
    ceRequired,
    participantId: input.participantId,
    phase: input.phase,
    reason: "attacked_while_attacking",
    threats,
    trigger,
  };
}

export function getCombatRoundPhaseCombatExperienceRequirement(input: {
  participantId: string;
  phase: CombatRoundPhase;
  state: CombatRoundState;
  visibility?: CombatRoundVisibility;
}): CombatRoundPhaseCombatExperienceRequirement | undefined {
  const normalized = combatRoundStateSchema.parse(input.state);

  if (
    normalized.currentStep === getCombatRoundPhaseActionStepForPhase(input.phase) &&
    normalized.phaseResolutionCursor?.phase === input.phase
  ) {
    return undefined;
  }

  if (
    combatRoundPhaseInitiativeChoiceSubmitted({
      participantId: input.participantId,
      phase: input.phase,
      state: normalized,
    })
  ) {
    return undefined;
  }

  const opportunity = getCombatRoundPhaseAttackBackOutOpportunity({
    participantId: input.participantId,
    phase: input.phase,
    state: normalized,
    visibility: input.visibility,
  });
  const threats = opportunity?.threats.filter(combatRoundPhaseThreatRequiresCombatExperience) ?? [];

  if (!opportunity || threats.length === 0) {
    return undefined;
  }

  return {
    participantId: opportunity.participantId,
    phase: opportunity.phase,
    reason: opportunity.reason,
    threats,
    trigger: opportunity.trigger,
  };
}

export function getCombatRoundPhaseCombatExperienceDetectionReport(input: {
  phase: CombatRoundPhase;
  state: CombatRoundState;
  visibility?: CombatRoundVisibility;
}): CombatRoundPhaseCombatExperienceDetectionParticipantReport[] {
  const normalized = combatRoundStateSchema.parse(input.state);

  return normalized.participants.map((participant) => {
    const phaseTargetId =
      participant.declaration?.phaseContexts?.[input.phase]?.targetParticipantId;
    const phaseAttackCapable = combatRoundParticipantHasPhaseAttack({
      participantId: participant.participantId,
      phase: input.phase,
      state: normalized,
    });
    const phaseTargetActiveInEncounter = Boolean(
      getCombatRoundParticipantByTargetId({
        state: normalized,
        targetParticipantId: phaseTargetId,
      }),
    );
    const hasA1A2AlreadyResolved = combatRoundParticipantPhaseActionHasCompletionEvidence({
      participantId: participant.participantId,
      phase: input.phase,
      state: normalized,
    });
    const initiativeTotal = getCombatRoundInitiativeTotal(participant.initiatives[input.phase]);
    const requirement = getCombatRoundPhaseCombatExperienceRequirement({
      participantId: participant.participantId,
      phase: input.phase,
      state: normalized,
      visibility: input.visibility,
    });
    const backOutOpportunity = getCombatRoundPhaseAttackBackOutOpportunity({
      participantId: participant.participantId,
      phase: input.phase,
      state: normalized,
      visibility: input.visibility,
    });
    const detectedIncomingAttackers = normalized.participants
      .filter((attacker) => attacker.participantId !== participant.participantId)
      .map((attacker) => {
        const targetId = attacker.declaration?.phaseContexts?.[input.phase]?.targetParticipantId;

        return {
          actionId: attacker.declaration?.actionId,
          aware: isCombatRoundParticipantAwareOfPhaseAttacker({
            attacker,
            participant,
            visibility: input.visibility,
          }),
          initiativeTotal: getCombatRoundInitiativeTotal(attacker.initiatives[input.phase]),
          participantId: attacker.participantId,
          phaseAttackCapable: combatRoundParticipantHasPhaseAttack({
            participantId: attacker.participantId,
            phase: input.phase,
            state: normalized,
          }),
          targetId,
          targetMatchesParticipant: combatRoundTargetMatchesParticipant({
            participant,
            targetParticipantId: targetId,
          }),
        };
      });
    const actionableIncomingAttackers = detectedIncomingAttackers.filter(
      (attacker) => attacker.phaseAttackCapable && attacker.targetMatchesParticipant,
    );
    let reasonIfNo: string | undefined;

    if (!requirement) {
      if (!phaseAttackCapable) {
        reasonIfNo = "participant has no attack in this phase";
      } else if (!phaseTargetId) {
        reasonIfNo = "participant phase target is missing";
      } else if (!phaseTargetActiveInEncounter) {
        reasonIfNo = "participant phase target is not active in the encounter";
      } else if (hasA1A2AlreadyResolved) {
        reasonIfNo = "participant phase attack is already rolled, skipped, or cancelled";
      } else if (initiativeTotal === undefined) {
        reasonIfNo = "participant initiative is missing";
      } else if (actionableIncomingAttackers.length === 0) {
        reasonIfNo = "no incoming phase attack targets this participant";
      } else if (actionableIncomingAttackers.every((attacker) => !attacker.aware)) {
        reasonIfNo = "incoming phase attacker is not visible or known to this participant";
      } else if (backOutOpportunity) {
        reasonIfNo = "initiative comparison does not require CE; back out remains available";
      } else {
        reasonIfNo = "initiative comparison does not require this participant";
      }
    }

    return {
      actionId: participant.declaration?.actionId,
      detectedIncomingAttackers,
      hasA1A2AlreadyResolved,
      initiativeTotal,
      label: participant.label,
      participantId: participant.participantId,
      phaseAttackCapable,
      phaseTargetActiveInEncounter,
      phaseTargetId,
      backOutAvailable: Boolean(backOutOpportunity),
      reasonIfNo,
      required: Boolean(requirement),
    };
  });
}

export function isCombatRoundPhaseCombatExperienceRollRequired(input: {
  participantId: string;
  phase: CombatRoundPhase;
  state: CombatRoundState;
  visibility?: CombatRoundVisibility;
}): boolean {
  return Boolean(getCombatRoundPhaseCombatExperienceRequirement(input));
}

export function canBackOutCombatRoundPhaseAttack(input: {
  participantId: string;
  phase: CombatRoundPhase;
  state: CombatRoundState;
  visibility?: CombatRoundVisibility;
}): boolean {
  const normalized = combatRoundStateSchema.parse(input.state);
  const initiativeStep = getCombatRoundPhaseInitiativeStepForPhase(input.phase);

  return Boolean(
    normalized.currentStep === initiativeStep &&
    getCombatRoundPhaseAttackBackOutOpportunity({
      participantId: input.participantId,
      phase: input.phase,
      state: normalized,
      visibility: input.visibility,
    }) &&
    !combatRoundPhaseInitiativeChoiceSubmitted({
      participantId: input.participantId,
      phase: input.phase,
      state: normalized,
    }) &&
    !getCombatRoundOutgoingAttackResultForParticipantPhase({
      participantId: input.participantId,
      phase: input.phase,
      state: normalized,
    }),
  );
}

export function getCombatRoundPhaseCombatExperienceRequiredParticipantIds(input: {
  phase: CombatRoundPhase;
  state: CombatRoundState;
  visibility?: CombatRoundVisibility;
}): string[] {
  const normalized = combatRoundStateSchema.parse(input.state);

  return getCombatRoundPhaseResolutionOrder({
    phase: input.phase,
    state: normalized,
  }).filter((participantId) =>
    isCombatRoundPhaseCombatExperienceRollRequired({
      participantId,
      phase: input.phase,
      state: normalized,
      visibility: input.visibility,
    }),
  );
}

export interface CombatRoundPhaseInitiativeChoiceStatus {
  ceRequired: boolean;
  choice?: CombatRoundPhaseInitiativeChoice;
  participantId: string;
  phase: CombatRoundPhase;
  threatened: boolean;
  threats: CombatRoundPhaseCombatExperienceThreat[];
  unresolved: boolean;
}

export function getCombatRoundPhaseInitiativeChoiceStatuses(input: {
  phase: CombatRoundPhase;
  state: CombatRoundState;
  visibility?: CombatRoundVisibility;
}): CombatRoundPhaseInitiativeChoiceStatus[] {
  const normalized = combatRoundStateSchema.parse(input.state);

  return getCombatRoundPhaseResolutionOrder({
    phase: input.phase,
    state: normalized,
  }).flatMap((participantId) => {
    const opportunity = getCombatRoundPhaseAttackBackOutOpportunity({
      participantId,
      phase: input.phase,
      state: normalized,
      visibility: input.visibility,
    });

    if (!opportunity) {
      return [];
    }

    const choice = getCombatRoundPhaseInitiativeChoice({
      participantId,
      phase: input.phase,
      state: normalized,
    });

    return [
      {
        ceRequired: opportunity.ceRequired,
        choice,
        participantId,
        phase: input.phase,
        threatened: true,
        threats: opportunity.threats,
        unresolved: !choice,
      },
    ];
  });
}

function getFirstUnresolvedCombatRoundPhaseInitiativeChoiceParticipantId(input: {
  phase: CombatRoundPhase;
  state: CombatRoundState;
  visibility?: CombatRoundVisibility;
}): string | undefined {
  return getCombatRoundPhaseInitiativeChoiceStatuses(input).find((status) => status.unresolved)
    ?.participantId;
}

export function isCombatRoundPhaseInitiativeResolutionOpen(input: {
  phase: CombatRoundPhase;
  state: CombatRoundState;
  visibility?: CombatRoundVisibility;
}): boolean {
  const normalized = combatRoundStateSchema.parse(input.state);

  return (
    normalized.currentStep === getCombatRoundPhaseInitiativeStepForPhase(input.phase) &&
    isCombatRoundPhaseInitiativeComplete({ phase: input.phase, state: normalized }) &&
    getCombatRoundPhaseInitiativeChoiceStatuses(input).length > 0
  );
}

export function getFirstCombatRoundPhaseCombatExperienceRequiredParticipantId(input: {
  phase: CombatRoundPhase;
  state: CombatRoundState;
  visibility?: CombatRoundVisibility;
}): string | undefined {
  return getCombatRoundPhaseCombatExperienceRequiredParticipantIds(input)[0];
}

export function getFirstCombatStartExperienceRequiredParticipantId(
  state: CombatRoundState,
): string | undefined {
  const normalized = combatRoundStateSchema.parse(state);

  return normalized.participants.find((participant) =>
    isCombatStartExperienceRollRequired({
      participantId: participant.participantId,
      state: normalized,
    }),
  )?.participantId;
}

export function getCombatRoundRequiredCombatExperienceTrigger(input: {
  participantId: string;
  state: CombatRoundState;
  visibility?: CombatRoundVisibility;
}): CombatExperienceTrigger | undefined {
  const normalized = combatRoundStateSchema.parse(input.state);
  const trigger = getCombatRoundCombatExperienceTriggerForStep(normalized.currentStep);

  if (!trigger) {
    return undefined;
  }

  if (trigger === "combat_start") {
    return isCombatStartExperienceRollRequired({
      participantId: input.participantId,
      state: normalized,
    })
      ? trigger
      : undefined;
  }

  const phase = getCombatExperiencePhaseForTrigger(trigger);

  if (!phase) {
    return undefined;
  }

  return isCombatRoundPhaseCombatExperienceRollRequired({
    participantId: input.participantId,
    phase,
    state: normalized,
    visibility: input.visibility,
  })
    ? trigger
    : undefined;
}

export function isCombatRoundCombatExperienceRollRequired(input: {
  participantId: string;
  state: CombatRoundState;
  visibility?: CombatRoundVisibility;
}): boolean {
  return Boolean(getCombatRoundRequiredCombatExperienceTrigger(input));
}

function isCombatRoundDeclarationComplete(participant: CombatRoundParticipantState): boolean {
  const declarationStatus = participant.stepStatuses.select_actions ?? "pending";
  const declarationTargetValidation = participant.declaration
    ? validateCombatDeclarationTargets({
        actionId: participant.declaration.actionId,
        phaseContexts: participant.declaration.phaseContexts,
        secondaryActionId: participant.declaration.secondaryActionId,
      })
    : undefined;
  const hasCompleteStatus =
    declarationStatus === "submitted" ||
    declarationStatus === "gmEdited" ||
    declarationStatus === "locked" ||
    declarationStatus === "complete" ||
    declarationStatus === "skipped";

  if (participant.declaration && !declarationTargetValidation?.valid) {
    return false;
  }

  return (
    hasCompleteStatus || Boolean(participant.declaration && declarationTargetValidation?.valid)
  );
}

export function getFirstCombatRoundDeclarationRequiredParticipantId(
  state: CombatRoundState,
): string | undefined {
  const normalized = combatRoundStateSchema.parse(state);

  return normalized.participants.find(
    (participant) => !isCombatRoundDeclarationComplete(participant),
  )?.participantId;
}

function buildCombatExperienceEffectEventId(input: {
  commandId: string;
  participantId: string;
  roundNumber: number;
}): string {
  return [
    "combat-effect-event",
    "combat-experience",
    input.roundNumber,
    input.participantId,
    input.commandId,
  ].join(":");
}

function buildCombatExperienceEffectId(input: {
  commandId: string;
  participantId: string;
  roundNumber: number;
}): string {
  return [
    "combat-effect",
    "combat-experience",
    input.roundNumber,
    input.participantId,
    input.commandId,
  ].join(":");
}

function buildCombatExperiencePhaseModifierId(input: {
  commandId: string;
  participantId: string;
  phase: CombatRoundPhase;
  roundNumber: number;
}): string {
  return [
    "combat-modifier",
    "combat-experience",
    input.roundNumber,
    input.phase,
    input.participantId,
    input.commandId,
  ].join(":");
}

function addCombatRoundPhaseCombatExperienceModifier(input: {
  combatContext?: ScenarioParticipantCombatContext;
  commandId: string;
  participant: CombatRoundParticipantState;
  participantId: string;
  phase: CombatRoundPhase;
  result: CombatRoundCombatExperienceResult;
}): {
  combatContext: ScenarioParticipantCombatContext;
  modifierIds: string[];
} {
  const currentContext = scenarioParticipantCombatContextSchema.parse(input.combatContext ?? {});

  if (input.result.modifierValue >= 0) {
    return {
      combatContext: currentContext,
      modifierIds: [],
    };
  }

  const modifierId = buildCombatExperiencePhaseModifierId({
    commandId: input.commandId,
    participantId: input.participantId,
    phase: input.phase,
    roundNumber: input.result.roundNumber,
  });
  const modifier = scenarioCombatModifierEntrySchema.parse({
    durationRounds: 1,
    generated: true,
    id: modifierId,
    notes: "combat experience attacked while attacking",
    scope: "until",
    sourceActionId: input.participant.declaration?.actionId,
    sourcePhase: input.phase,
    sourceRule: `combat-experience-${input.phase}-attacked-while-attacking`,
    value: input.result.modifierValue,
  } satisfies ScenarioCombatModifierEntry);

  return {
    combatContext: scenarioParticipantCombatContextSchema.parse({
      ...currentContext,
      modifierBuckets: {
        ...currentContext.modifierBuckets,
        situationObSkill: [
          ...currentContext.modifierBuckets.situationObSkill.filter(
            (entry) => entry.id !== modifierId,
          ),
          modifier,
        ],
      },
    }),
    modifierIds: [modifierId],
  };
}

export function removeCombatRoundCombatExperienceCombatContextModifiers(input: {
  combatContext?: ScenarioParticipantCombatContext;
  command: CombatRoundCommand;
}): ScenarioParticipantCombatContext {
  const currentContext = scenarioParticipantCombatContextSchema.parse(input.combatContext ?? {});
  const createdModifierIds = new Set(
    Array.isArray(input.command.facts.createdCombatModifierIds)
      ? input.command.facts.createdCombatModifierIds.filter(
          (entry): entry is string => typeof entry === "string",
        )
      : [],
  );

  if (createdModifierIds.size === 0) {
    return currentContext;
  }

  return scenarioParticipantCombatContextSchema.parse({
    ...currentContext,
    modifierBuckets: Object.fromEntries(
      Object.entries(currentContext.modifierBuckets).map(([bucketKey, entries]) => [
        bucketKey,
        entries.filter((entry) => !createdModifierIds.has(entry.id)),
      ]),
    ),
  });
}

export function restoreCombatRoundBackOutCombatContextModifiers(input: {
  combatContext?: ScenarioParticipantCombatContext;
  command: CombatRoundCommand;
}): ScenarioParticipantCombatContext {
  const currentContext = scenarioParticipantCombatContextSchema.parse(input.combatContext ?? {});
  const softenedModifiers = Array.isArray(input.command.facts.softenedModifiers)
    ? input.command.facts.softenedModifiers
    : [];

  return restoreCombatActionGeneratedBackOutModifiers({
    combatContext: currentContext,
    softenedModifiers,
  });
}

export function rollCombatRoundCombatExperience(input: {
  combatContext?: ScenarioParticipantCombatContext;
  combatEffects?: CombatEffectsState;
  command: {
    commandId?: string;
    createdAt: string;
    createdByUserId?: string;
  };
  difficulty?: number;
  encounterId?: string;
  participantId: string;
  rng?: () => number;
  scenarioId?: string;
  scenarioParticipantId?: string;
  skillTotal?: number;
  skillTotalSource?: string;
  skillTotalWarning?: string;
  state: CombatRoundState;
  trigger?: CombatExperienceTrigger;
  visibility?: CombatRoundVisibility;
}): {
  combatContext: ScenarioParticipantCombatContext;
  combatEffects: CombatEffectsState;
  command: CombatRoundCommand;
  result: CombatRoundCombatExperienceResult;
  state: CombatRoundState;
} {
  const normalized = combatRoundStateSchema.parse(input.state);
  const participant = normalized.participants.find(
    (entry) => entry.participantId === input.participantId,
  );
  const trigger =
    input.trigger ??
    getCombatRoundRequiredCombatExperienceTrigger({
      participantId: input.participantId,
      state: normalized,
      visibility: input.visibility,
    }) ??
    "combat_start";
  const phase = getCombatExperiencePhaseForTrigger(trigger);
  const phaseRequirement = phase
    ? getCombatRoundPhaseCombatExperienceRequirement({
        participantId: input.participantId,
        phase,
        state: normalized,
        visibility: input.visibility,
      })
    : undefined;

  if (!participant) {
    throw new RangeError("Combat Experience participant is not in the active round.");
  }

  if (trigger === "combat_start" && normalized.currentStep !== "select_actions") {
    throw new RangeError("Combat Experience can only be rolled during declaration.");
  }

  if (trigger === "combat_start" && !isCombatRoundCombatExperienceWindowOpen(normalized)) {
    throw new RangeError(
      "Combat Experience rolls are not open. Set Combat Experience difficulty first.",
    );
  }

  if (phase) {
    const requiredStep = getCombatRoundPhaseInitiativeStepForPhase(phase);

    if (normalized.currentStep !== requiredStep) {
      throw new RangeError(
        "Combat Experience can only be rolled during phase initiative resolution.",
      );
    }

    if (!phaseRequirement) {
      throw new RangeError("Combat Experience is not required for this participant.");
    }

    if (
      combatRoundPhaseInitiativeChoiceSubmitted({
        participantId: input.participantId,
        phase,
        state: normalized,
      })
    ) {
      throw new RangeError("Phase initiative choice already submitted for this participant.");
    }
  }

  if (
    participant.combatExperience?.trigger === trigger &&
    participant.combatExperience.roundNumber === normalized.roundNumber
  ) {
    throw new RangeError("Combat Experience already rolled for this participant.");
  }

  const rng = input.rng ?? Math.random;
  const difficulty = input.difficulty ?? getCombatRoundCombatExperienceDifficulty(normalized);
  const skillTotal = Math.trunc(input.skillTotal ?? 0);
  const noRollRequired = skillTotal >= difficulty;
  const roll = noRollRequired ? undefined : rollOpenEndedD20(rng);
  const finalTotal = noRollRequired ? skillTotal : skillTotal + (roll?.dieResult ?? 0);
  const { difficultyShift, effectiveTableTotal } = getCombatExperienceEffectiveTableTotal({
    difficulty,
    finalTotal,
  });
  const panicDurationRounds =
    !phase && effectiveTableTotal <= 5 ? rollCombatExperiencePanicDuration(rng) : undefined;
  const evaluation = phase
    ? evaluatePhaseCombatExperienceResult(finalTotal, {
        difficulty,
      })
    : evaluateCombatExperienceResult(finalTotal, {
        difficulty,
        panicDurationRounds,
      });
  const result = combatRoundCombatExperienceResultSchema.parse({
    ...evaluation,
    difficulty,
    finalTotal,
    noRollRequired,
    openEndedD10s: roll?.openEndedD10s ?? [],
    rolledAt: input.command.createdAt,
    rolledByUserId: input.command.createdByUserId,
    rollD20: roll?.rollD20,
    rollTotal: roll?.dieResult,
    roundNumber: normalized.roundNumber,
    skillTotal,
    skillTotalSource: input.skillTotalSource,
    skillTotalWarning: input.skillTotalWarning,
    trigger,
  });
  const commandId =
    input.command.commandId ??
    buildCombatRoundCommandId({
      createdAt: input.command.createdAt,
      participantId: input.participantId,
      state: normalized,
      type: phase ? "submit_phase_initiative_choice" : "roll_combat_experience",
    });

  if (phase) {
    const initiativeStep = getCombatRoundPhaseInitiativeStepForPhase(phase);
    const beforeCursor =
      normalized.currentCursor?.roundNumber === normalized.roundNumber &&
      normalized.currentCursor.step === getCombatRoundPhaseInitiativeCursorStepForPhase(phase)
        ? normalized.currentCursor
        : getDefaultCombatRoundCursor({
            participantId: input.participantId,
            roundNumber: normalized.roundNumber,
            step: initiativeStep,
          });
    const attackStep = getCombatRoundAttackCursorStepForPhase(phase);
    const commandShell = combatRoundCommandSchema.parse({
      afterCursor: beforeCursor,
      beforeCursor,
      createdAt: input.command.createdAt,
      createdByUserId: input.command.createdByUserId,
      facts: {
        attackActionId: participant.declaration?.actionId,
        attackStep,
        ceRequired: true,
        choice: "roll_ce_result",
        combatExperience: result,
        createdCombatEffectEventId: undefined,
        createdCombatEffectIds: [],
        createdCombatModifierIds: [],
        difficulty,
        difficultyShift,
        durationRounds: result.durationRounds,
        effectiveTableTotal,
        evaluatedResult: evaluation,
        finalTotal,
        modifierValue: result.modifierValue,
        noRollRequired,
        openEndedD10s: roll?.openEndedD10s ?? [],
        phase,
        phaseCombatExperienceReason: phaseRequirement?.reason,
        phaseCombatExperienceThreats: phaseRequirement?.threats ?? [],
        resultBand: result.resultBand,
        resultLabel: result.label,
        rollD20: roll?.rollD20,
        rollTotal: roll?.dieResult,
        scenarioParticipantId: input.scenarioParticipantId ?? input.participantId,
        skillTotal,
        skillTotalSource: input.skillTotalSource,
        skillTotalWarning: input.skillTotalWarning,
        source: "phase_initiative_resolution",
        threatened: true,
        trigger,
      },
      id: commandId,
      participantId: input.participantId,
      phase,
      roundNumber: normalized.roundNumber,
      step: getCombatRoundPhaseInitiativeCursorStepForPhase(phase),
      type: "submit_phase_initiative_choice",
    });
    const stateWithCommandShell = combatRoundStateSchema.parse({
      ...normalized,
      combatExperienceDifficulty: difficulty,
      commands: [
        ...normalized.commands.filter((existingCommand) => existingCommand.id !== commandId),
        commandShell,
      ],
    });
    const stateAfterChoice = moveCombatRoundToPhaseInitiativeResolution({
      phase,
      state: stateWithCommandShell,
    });
    const afterCursor = stateAfterChoice.currentCursor ?? beforeCursor;
    const command = combatRoundCommandSchema.parse({
      ...commandShell,
      afterCursor,
      facts: {
        ...commandShell.facts,
        ...(afterCursor.participantId && afterCursor.participantId !== input.participantId
          ? {
              nextChoiceParticipantId: afterCursor.participantId,
            }
          : {}),
      },
    });
    const currentCombatEffects = combatEffectsStateSchema.parse(input.combatEffects);

    return {
      combatContext: scenarioParticipantCombatContextSchema.parse(input.combatContext ?? {}),
      combatEffects: currentCombatEffects,
      command,
      result,
      state: combatRoundStateSchema.parse({
        ...stateAfterChoice,
        commands: [
          ...stateAfterChoice.commands.filter(
            (existingCommand) => existingCommand.id !== commandId,
          ),
          command,
        ],
      }),
    };
  }

  const phaseActionStep = phase ? getCombatRoundPhaseActionStepForPhase(phase) : undefined;
  const previousPhaseActionStepStatus = phaseActionStep
    ? participant.stepStatuses[phaseActionStep]
    : undefined;
  const previousPhaseResolutionStatus = phase
    ? normalized.phaseResolutionStatuses[input.participantId]?.[phase]
    : undefined;
  const defaultBeforeCursor = getDefaultCombatRoundCursor({
    participantId: input.participantId,
    roundNumber: normalized.roundNumber,
    step: phase ? getCombatRoundPhaseActionStepForPhase(phase) : "select_actions",
  });
  const beforeCursor =
    phase &&
    normalized.currentCursor?.roundNumber === normalized.roundNumber &&
    normalized.currentCursor.step === getCombatRoundAttackCursorStepForPhase(phase)
      ? normalized.currentCursor
      : defaultBeforeCursor;
  const targetParticipantId = input.scenarioParticipantId ?? input.participantId;
  const createdCombatEffectEventId = result.needsEffectRow
    ? buildCombatExperienceEffectEventId({
        commandId,
        participantId: targetParticipantId,
        roundNumber: normalized.roundNumber,
      })
    : undefined;
  const createdCombatEffectIds = result.needsEffectRow
    ? [
        buildCombatExperienceEffectId({
          commandId,
          participantId: targetParticipantId,
          roundNumber: normalized.roundNumber,
        }),
      ]
    : [];
  const phaseCombatModifier = phase
    ? addCombatRoundPhaseCombatExperienceModifier({
        combatContext: input.combatContext,
        commandId,
        participant,
        participantId: targetParticipantId,
        phase,
        result,
      })
    : {
        combatContext: scenarioParticipantCombatContextSchema.parse(input.combatContext ?? {}),
        modifierIds: [],
      };
  const phaseAttackCancelled = phaseCombatExperienceCancelsAttack(result);
  const stateAfterResult = moveCombatRoundAfterCombatExperienceResult({
    createdAt: input.command.createdAt,
    participantId: input.participantId,
    result,
    state: {
      ...normalized,
      combatExperienceDifficulty: difficulty,
    },
    visibility: input.visibility,
  });
  const afterCursor = stateAfterResult.currentCursor ?? beforeCursor;
  const command = combatRoundCommandSchema.parse({
    afterCursor,
    beforeCursor,
    createdAt: input.command.createdAt,
    createdByUserId: input.command.createdByUserId,
    facts: {
      createdCombatEffectEventId,
      createdCombatEffectIds,
      createdCombatModifierIds: phaseCombatModifier.modifierIds,
      difficulty,
      difficultyShift,
      durationRounds: result.durationRounds,
      effectiveTableTotal,
      evaluatedResult: evaluation,
      finalTotal,
      modifierValue: result.modifierValue,
      noRollRequired,
      openEndedD10s: roll?.openEndedD10s ?? [],
      phaseAttackCancelled,
      ...(phaseRequirement
        ? {
            phaseCombatExperienceReason: phaseRequirement.reason,
            phaseCombatExperienceThreats: phaseRequirement.threats,
          }
        : {}),
      previousCombatExperience: participant.combatExperience,
      ...(previousPhaseActionStepStatus
        ? {
            previousPhaseActionStepStatus,
          }
        : {}),
      ...(previousPhaseResolutionStatus
        ? {
            previousPhaseResolutionStatus,
          }
        : {}),
      resultBand: result.resultBand,
      resultLabel: result.label,
      rollD20: roll?.rollD20,
      rollTotal: roll?.dieResult,
      phase,
      skillTotalSource: input.skillTotalSource,
      skillTotalWarning: input.skillTotalWarning,
      scenarioParticipantId: targetParticipantId,
      skillTotal,
      trigger,
    },
    id: commandId,
    participantId: input.participantId,
    phase,
    roundNumber: normalized.roundNumber,
    step: phase ? getCombatRoundAttackCursorStepForPhase(phase) : "DE",
    type: "roll_combat_experience",
  });
  const currentCombatEffects = combatEffectsStateSchema.parse(input.combatEffects);
  const nextCombatEffects =
    result.needsEffectRow && createdCombatEffectEventId && createdCombatEffectIds[0]
      ? combatEffectsStateSchema.parse({
          effects: [
            ...currentCombatEffects.effects,
            combatEffectSchema.parse({
              createdAt: input.command.createdAt,
              damage: 0,
              description: result.note,
              duration: `${result.durationRounds} ${
                result.durationRounds === 1 ? "round" : "rounds"
              }`,
              effectGroup: "general",
              generalDamage: 0,
              id: createdCombatEffectIds[0],
              modifierValue: result.modifierValue,
              roundNumber: normalized.roundNumber,
              sourceEventId: createdCombatEffectEventId,
              status: "active",
              targetParticipantId,
              type: "general_modifier",
              updatedAt: input.command.createdAt,
            }),
          ],
          events: [
            ...currentCombatEffects.events,
            combatEffectEventSchema.parse({
              createdAt: input.command.createdAt,
              createdByUserId: input.command.createdByUserId,
              description: `Combat Experience: ${result.label}`,
              encounterId: input.encounterId,
              id: createdCombatEffectEventId,
              roundNumber: normalized.roundNumber,
              scenarioId: input.scenarioId,
              sourceActorId: targetParticipantId,
              sourceLabel: "Combat Experience",
              sourceType: "skill_roll",
              targetParticipantId,
            }),
          ],
        })
      : currentCombatEffects;

  return {
    combatContext: phaseCombatModifier.combatContext,
    combatEffects: nextCombatEffects,
    command,
    result,
    state: combatRoundStateSchema.parse({
      ...stateAfterResult,
      commands: [...normalized.commands, command],
      combatExperienceDifficulty: difficulty,
    }),
  };
}

export function removeCombatRoundCombatExperienceEffects(input: {
  combatEffects?: CombatEffectsState;
  command: CombatRoundCommand;
}): CombatEffectsState {
  const currentCombatEffects = combatEffectsStateSchema.parse(input.combatEffects);
  const createdCombatEffectIds = new Set(
    Array.isArray(input.command.facts.createdCombatEffectIds)
      ? input.command.facts.createdCombatEffectIds.filter(
          (entry): entry is string => typeof entry === "string",
        )
      : [],
  );
  const createdCombatEffectEventId =
    typeof input.command.facts.createdCombatEffectEventId === "string"
      ? input.command.facts.createdCombatEffectEventId
      : undefined;

  return combatEffectsStateSchema.parse({
    ...currentCombatEffects,
    effects: currentCombatEffects.effects.filter(
      (effect) => !createdCombatEffectIds.has(effect.id),
    ),
    events: currentCombatEffects.events.filter((event) => event.id !== createdCombatEffectEventId),
  });
}

function getLatestCombatRoundGlobalParticipantCommandIndex(input: {
  commandType: CombatRoundCommandType;
  participantId: string;
  roundNumber: number;
  state: CombatRoundState;
}): number {
  for (let index = input.state.commands.length - 1; index >= 0; index -= 1) {
    const command = input.state.commands[index];

    if (
      command?.roundNumber === input.roundNumber &&
      command.participantId === input.participantId &&
      command.type === input.commandType
    ) {
      return index;
    }
  }

  return -1;
}

function isGlobalCombatRoundCommandType(type: CombatRoundCommandType): boolean {
  return (
    type === "declare_action" ||
    type === "review_modifiers_phase1" ||
    type === "roll_initiative_phase1" ||
    type === "review_modifiers_phase2" ||
    type === "roll_initiative_phase2" ||
    type === "complete_round"
  );
}

function isUndoableCombatRoundCommandType(type: CombatRoundCommandType): boolean {
  return (
    isGlobalCombatRoundCommandType(type) ||
    type === "roll_attack" ||
    type === "roll_parry" ||
    type === "roll_hit_location" ||
    type === "roll_critical" ||
    type === "skip_phase_action" ||
    type === "back_out_phase_attack" ||
    type === "submit_phase_initiative_choice" ||
    type === "commit_phase_initiative_resolution" ||
    type === "roll_combat_experience" ||
    type === "set_pair_distance" ||
    type === "complete_damage_review_phase1" ||
    type === "complete_damage_review_phase2" ||
    type === "resolve_damage" ||
    type === "commit_phase_damage" ||
    type === "prepare_round_end_review" ||
    type === "commit_round_end_participant_review" ||
    type === "roll_round_end_health_check" ||
    type === "roll_round_end_distance_control" ||
    type === "commit_round_end_distance_control"
  );
}

function getLatestCombatRoundGlobalCommandIndex(input: {
  roundNumber: number;
  state: CombatRoundState;
}): number {
  for (let index = input.state.commands.length - 1; index >= 0; index -= 1) {
    const command = input.state.commands[index];

    if (
      command?.roundNumber === input.roundNumber &&
      isGlobalCombatRoundCommandType(command.type)
    ) {
      return index;
    }
  }

  return -1;
}

function getLatestCombatRoundUndoableCommandIndex(input: {
  roundNumber: number;
  state: CombatRoundState;
}): number {
  for (let index = input.state.commands.length - 1; index >= 0; index -= 1) {
    const command = input.state.commands[index];

    if (
      command?.roundNumber === input.roundNumber &&
      isUndoableCombatRoundCommandType(command.type)
    ) {
      return index;
    }
  }

  return -1;
}

function getStepIndex(step: CombatRoundStep): number {
  return COMBAT_ROUND_STEPS.indexOf(step);
}

function isSameCombatRoundStepSnapshot(
  left: CombatRoundStepSnapshot,
  right: Pick<CombatRoundStepSnapshot, "participantId" | "roundNumber" | "step">,
): boolean {
  return (
    left.roundNumber === right.roundNumber &&
    left.participantId === right.participantId &&
    left.step === right.step
  );
}

function clearSnapshotsFromStep(input: {
  participantId?: string;
  roundNumber: number;
  snapshots: CombatRoundStepSnapshot[];
  step: CombatRoundStep;
}): CombatRoundStepSnapshot[] {
  const clearFromIndex = getStepIndex(input.step);

  return input.snapshots.filter((snapshot) => {
    if (snapshot.roundNumber !== input.roundNumber) {
      return true;
    }

    if (input.participantId && snapshot.participantId !== input.participantId) {
      return true;
    }

    return getStepIndex(snapshot.step) < clearFromIndex;
  });
}

function clearSnapshotsForCombatRoundStep(input: {
  participantId?: string;
  roundNumber: number;
  selectedAttackResult?: CombatRoundAttackRollResult;
  snapshots: CombatRoundStepSnapshot[];
  step: CombatRoundStep;
}): CombatRoundStepSnapshot[] {
  const pairedStepsByStep: Partial<Record<CombatRoundStep, CombatRoundStep[]>> = {
    phase_1_actions: ["phase_1_actions", "review_phase_2_actions", "phase_1_damage"],
    phase_1_damage: ["phase_1_damage"],
    phase_2_actions: ["phase_2_actions", "review_phase_2_damage", "phase_2_damage"],
    phase_2_damage: ["phase_2_damage"],
    review_phase_2_actions: ["review_phase_2_actions"],
    review_phase_2_damage: ["review_phase_2_damage"],
  };
  const pairedSteps = pairedStepsByStep[input.step];

  if (!pairedSteps) {
    return clearSnapshotsFromStep(input);
  }

  if (input.selectedAttackResult) {
    const attackStep = getCombatRoundPhaseActionStepForPhase(input.selectedAttackResult.phase);
    const parryStep = getCombatRoundParryReviewStepForPhase(input.selectedAttackResult.phase);
    const damageStep = getCombatRoundDamageReviewStepForPhase(input.selectedAttackResult.phase);
    const clearedSnapshotKeys = new Set<string>();

    if (input.step === attackStep) {
      clearedSnapshotKeys.add(`${input.selectedAttackResult.attackerParticipantId}:${attackStep}`);
      clearedSnapshotKeys.add(`${input.selectedAttackResult.defenderParticipantId}:${parryStep}`);
      clearedSnapshotKeys.add(`${input.selectedAttackResult.defenderParticipantId}:${damageStep}`);
    } else if (input.step === parryStep) {
      clearedSnapshotKeys.add(`${input.selectedAttackResult.defenderParticipantId}:${parryStep}`);
      clearedSnapshotKeys.add(`${input.selectedAttackResult.defenderParticipantId}:${damageStep}`);
    } else if (input.step === damageStep) {
      clearedSnapshotKeys.add(`${input.selectedAttackResult.defenderParticipantId}:${damageStep}`);
    }

    return input.snapshots.filter(
      (snapshot) =>
        snapshot.roundNumber !== input.roundNumber ||
        !clearedSnapshotKeys.has(`${snapshot.participantId}:${snapshot.step}`),
    );
  }

  if (input.participantId) {
    return input.snapshots.filter((snapshot) => {
      if (snapshot.roundNumber !== input.roundNumber) {
        return true;
      }

      if (snapshot.participantId !== input.participantId) {
        return true;
      }

      if (input.step === "review_phase_2_actions") {
        return snapshot.step !== "review_phase_2_actions" && snapshot.step !== "phase_1_damage";
      }

      if (input.step === "review_phase_2_damage") {
        return snapshot.step !== "review_phase_2_damage" && snapshot.step !== "phase_2_damage";
      }

      return !pairedSteps.includes(snapshot.step);
    });
  }

  return input.snapshots.filter(
    (snapshot) =>
      snapshot.roundNumber !== input.roundNumber || !pairedSteps.includes(snapshot.step),
  );
}

function clearCombatRoundParticipantOutgoingResolutionState(input: {
  participantId: string;
  phase?: CombatRoundPhase;
  state: CombatRoundState;
}): CombatRoundState {
  const normalized = combatRoundStateSchema.parse(input.state);
  const outgoingResults = normalized.participants
    .filter((participant) => participant.participantId === input.participantId)
    .flatMap((participant) =>
      [participant.attackResults.phase1, participant.attackResults.phase2].filter(
        (result): result is CombatRoundAttackRollResult => Boolean(result),
      ),
    )
    .filter((result) => !input.phase || result.phase === input.phase);
  const affectedParticipantIds = new Set<string>([input.participantId]);
  const affectedDefenderSteps = new Map<string, Partial<Record<CombatRoundStep, "pending">>>();
  const affectedSnapshotSteps = new Map<string, Set<CombatRoundStep>>();

  for (const result of outgoingResults) {
    affectedParticipantIds.add(result.defenderParticipantId);
    const attackerSteps = affectedSnapshotSteps.get(result.attackerParticipantId) ?? new Set();
    attackerSteps.add(getCombatRoundPhaseActionStepForPhase(result.phase));
    affectedSnapshotSteps.set(result.attackerParticipantId, attackerSteps);

    const defenderSteps = affectedSnapshotSteps.get(result.defenderParticipantId) ?? new Set();
    affectedDefenderSteps.set(result.defenderParticipantId, {
      ...affectedDefenderSteps.get(result.defenderParticipantId),
      ...(result.phase === "phase1"
        ? {
            phase_1_damage: "pending",
            review_phase_2_actions: "pending",
          }
        : {
            phase_2_damage: "pending",
            review_phase_2_damage: "pending",
          }),
    });
    defenderSteps.add(getCombatRoundParryReviewStepForPhase(result.phase));
    defenderSteps.add(getCombatRoundDamageReviewStepForPhase(result.phase));
    affectedSnapshotSteps.set(result.defenderParticipantId, defenderSteps);
  }

  return {
    ...normalized,
    phaseResolutionCursor:
      normalized.phaseResolutionCursor &&
      affectedParticipantIds.has(normalized.phaseResolutionCursor.participantId)
        ? undefined
        : normalized.phaseResolutionCursor,
    phaseResolutionResults: normalized.phaseResolutionResults.filter(
      (result) =>
        result.roundNumber !== normalized.roundNumber ||
        result.attackerParticipantId !== input.participantId ||
        (input.phase !== undefined && result.phase !== input.phase),
    ),
    phaseResolutionStatuses: {
      ...normalized.phaseResolutionStatuses,
      [input.participantId]: input.phase
        ? {
            ...normalized.phaseResolutionStatuses[input.participantId],
            [input.phase]: undefined,
          }
        : {},
    },
    participants: normalized.participants.map((participant) => {
      if (participant.participantId === input.participantId) {
        const nextAttackResults =
          input.phase === "phase1"
            ? { ...participant.attackResults, phase1: undefined }
            : input.phase === "phase2"
              ? { ...participant.attackResults, phase2: undefined }
              : {};
        const phaseStepStatuses =
          input.phase === "phase1"
            ? {
                phase_1_actions: "pending" as const,
                phase_1_damage: "pending" as const,
                review_phase_2_actions: "pending" as const,
              }
            : input.phase === "phase2"
              ? {
                  phase_2_actions: "pending" as const,
                  phase_2_damage: "pending" as const,
                  review_phase_2_damage: "pending" as const,
                }
              : {
                  phase_1_actions: "pending" as const,
                  phase_1_damage: "pending" as const,
                  phase_2_actions: "pending" as const,
                  phase_2_damage: "pending" as const,
                  review_phase_2_actions: "pending" as const,
                  review_phase_2_damage: "pending" as const,
                };

        return {
          ...participant,
          attackResults: nextAttackResults,
          stepStatuses: {
            ...participant.stepStatuses,
            ...phaseStepStatuses,
          },
        };
      }

      const defenderSteps = affectedDefenderSteps.get(participant.participantId);

      return defenderSteps
        ? {
            ...participant,
            stepStatuses: {
              ...participant.stepStatuses,
              ...defenderSteps,
            },
          }
        : participant;
    }),
    stepSnapshots: normalized.stepSnapshots.filter((snapshot) => {
      if (snapshot.roundNumber !== normalized.roundNumber) {
        return true;
      }

      return !affectedSnapshotSteps.get(snapshot.participantId)?.has(snapshot.step);
    }),
  };
}

function participantStateFromEncounterParticipant(input: {
  existing?: CombatRoundParticipantState;
  participant: EncounterParticipant;
}): CombatRoundParticipantState {
  return {
    attackResults: input.existing?.attackResults ?? {},
    characterId: input.participant.characterId,
    combatExperience: input.existing?.combatExperience,
    declaration: input.existing?.declaration,
    initiatives: input.existing?.initiatives ?? {},
    label: input.participant.label,
    participantId: input.participant.id,
    scenarioParticipantId: input.participant.scenarioParticipantId,
    stepStatuses: mergeStepStatuses(input.existing?.stepStatuses),
  };
}

function getCombatRoundEncounterTargetIds(participants: EncounterParticipant[]): Set<string> {
  const targetIds = new Set<string>();

  participants.forEach((participant) => {
    targetIds.add(participant.id);

    if (participant.scenarioParticipantId) {
      targetIds.add(participant.scenarioParticipantId);
    }

    if (participant.characterId) {
      targetIds.add(participant.characterId);
    }
  });

  return targetIds;
}

function sanitizeCombatRoundContextTargetIds(
  context: z.infer<typeof scenarioParticipantCombatContextSchema> | undefined,
  validTargetIds: Set<string>,
): z.infer<typeof scenarioParticipantCombatContextSchema> | undefined {
  if (!context) {
    return undefined;
  }

  const targetParticipantId =
    context.targetParticipantId && validTargetIds.has(context.targetParticipantId)
      ? context.targetParticipantId
      : undefined;
  const selectedOpponentId =
    context.selectedOpponentId && validTargetIds.has(context.selectedOpponentId)
      ? context.selectedOpponentId
      : undefined;

  return scenarioParticipantCombatContextSchema.parse({
    ...context,
    selectedOpponentId,
    targetParticipantId,
  });
}

function sanitizeCombatRoundDeclarationTargets(input: {
  participant: CombatRoundParticipantState;
  validTargetIds: Set<string>;
}): { participant: CombatRoundParticipantState; repaired: boolean } {
  const declaration = input.participant.declaration;

  if (!declaration) {
    return { participant: input.participant, repaired: false };
  }

  const phase1 = sanitizeCombatRoundContextTargetIds(
    declaration.phaseContexts?.phase1,
    input.validTargetIds,
  );
  const phase2 = sanitizeCombatRoundContextTargetIds(
    declaration.phaseContexts?.phase2,
    input.validTargetIds,
  );
  const combatContext = sanitizeCombatRoundContextTargetIds(
    declaration.combatContext,
    input.validTargetIds,
  );
  const movementIntent = declaration.movementIntent
    ? movementIntentSchema.parse({
        ...declaration.movementIntent,
        distancePreferences: declaration.movementIntent.distancePreferences.filter((preference) =>
          input.validTargetIds.has(preference.targetParticipantId),
        ),
      })
    : undefined;
  const repaired =
    declaration.phaseContexts?.phase1?.targetParticipantId !== phase1?.targetParticipantId ||
    declaration.phaseContexts?.phase2?.targetParticipantId !== phase2?.targetParticipantId ||
    declaration.combatContext?.targetParticipantId !== combatContext?.targetParticipantId ||
    declaration.combatContext?.selectedOpponentId !== combatContext?.selectedOpponentId ||
    (declaration.movementIntent?.distancePreferences.length ?? 0) !==
      (movementIntent?.distancePreferences.length ?? 0);

  if (!repaired) {
    return { participant: input.participant, repaired: false };
  }

  return {
    participant: {
      ...input.participant,
      declaration: combatRoundDeclarationSchema.parse({
        ...declaration,
        combatContext,
        movementIntent,
        phaseContexts: {
          phase1,
          phase2,
        },
      }),
      stepStatuses: {
        ...input.participant.stepStatuses,
        select_actions: "pending",
      },
    },
    repaired: true,
  };
}

export function buildCombatRoundAttackRollResult(input: {
  actionId: string;
  attackerParticipantId: string;
  defenderDb: number;
  defenderParticipantId: string;
  ob: number;
  openEndedD10s?: number[];
  phase: CombatRoundPhase;
  roll?: number;
  rollD20?: number;
  rollTotal?: number;
  rolledAt: string;
  rolledByUserId?: string;
  weaponCriticalCode?: string;
  weaponDamageClass?: string;
  weaponName: string;
}): CombatRoundAttackRollResult {
  const rollTotal = input.rollTotal ?? input.roll;

  if (rollTotal === undefined) {
    throw new RangeError("Combat attack result requires an open-ended roll total.");
  }

  const toHit = resolveCombatToHit({
    db: input.defenderDb,
    ob: input.ob,
    rollTotal,
  });

  return combatRoundAttackRollResultSchema.parse({
    actionId: input.actionId,
    attackerParticipantId: input.attackerParticipantId,
    defenderDb: input.defenderDb,
    defenderParryModifier: toHit.parryModifier,
    defenderParticipantId: input.defenderParticipantId,
    grazing: toHit.grazing,
    hit: toHit.hit,
    kind: "attackRoll",
    lookupTotal: toHit.lookupTotal,
    marginOverMissThreshold: toHit.lookupTotal - 10,
    ob: input.ob,
    openEndedD10s: input.openEndedD10s ?? [],
    phase: input.phase,
    roll: input.roll,
    rollD20: input.rollD20 ?? input.roll,
    rollTotal,
    rolledAt: input.rolledAt,
    rolledByUserId: input.rolledByUserId,
    tableResult: toHit.resultLabel,
    weaponCriticalCode: input.weaponCriticalCode,
    weaponDamageClass: input.weaponDamageClass,
    weaponName: input.weaponName,
  });
}

export function getCombatRoundAttackResultsForParticipantPhase(input: {
  participantId: string;
  phase: CombatRoundPhase;
  state: CombatRoundState;
}): {
  incoming: CombatRoundAttackRollResult[];
  outgoing?: CombatRoundAttackRollResult;
} {
  const normalized = combatRoundStateSchema.parse(input.state);
  const outgoing = normalized.participants.find(
    (participant) => participant.participantId === input.participantId,
  )?.attackResults[input.phase];
  const incoming = normalized.participants
    .map((participant) => participant.attackResults[input.phase])
    .filter(
      (result): result is CombatRoundAttackRollResult =>
        result !== undefined && result.defenderParticipantId === input.participantId,
    );

  return { incoming, outgoing };
}

export function getCombatRoundOutgoingAttackResultForParticipantPhase(input: {
  participantId: string;
  phase: CombatRoundPhase;
  state: CombatRoundState;
}): CombatRoundAttackRollResult | undefined {
  return getCombatRoundAttackResultsForParticipantPhase(input).outgoing;
}

export function getCombatRoundIncomingAttackResultsForParticipantPhase(input: {
  participantId: string;
  phase: CombatRoundPhase;
  state: CombatRoundState;
}): CombatRoundAttackRollResult[] {
  return getCombatRoundAttackResultsForParticipantPhase(input).incoming;
}

export function getCombatRoundDisplayIncomingAttackResultForParticipantPhase(input: {
  participantId: string;
  phase: CombatRoundPhase;
  state: CombatRoundState;
}): CombatRoundAttackRollResult | undefined {
  const normalized = combatRoundStateSchema.parse(input.state);
  const incoming = getCombatRoundIncomingAttackResultsForParticipantPhase({
    participantId: input.participantId,
    phase: input.phase,
    state: normalized,
  });

  return (
    incoming.find((attackResult) => {
      const resolution = getCombatRoundPhaseResolutionResultForAttack({
        attackResult,
        state: normalized,
      });

      return resolution?.parryResolution.status === "pending";
    }) ?? incoming[0]
  );
}

export function getCombatRoundDisplayAttackResultForParticipantPhase(input: {
  participantId: string;
  phase: CombatRoundPhase;
  state: CombatRoundState;
}): CombatRoundAttackRollResult | undefined {
  const results = getCombatRoundAttackResultsForParticipantPhase(input);

  return results.outgoing ?? results.incoming[0];
}

export function getCombatRoundResolutionPhaseForStep(
  step: CombatRoundStep,
): CombatRoundPhase | undefined {
  if (step === "review_phase_2_actions" || step === "phase_1_damage") {
    return "phase1";
  }

  if (step === "review_phase_2_damage" || step === "phase_2_damage") {
    return "phase2";
  }

  return undefined;
}

export function getCombatRoundParryReviewStepForPhase(phase: CombatRoundPhase): CombatRoundStep {
  return phase === "phase1" ? "review_phase_2_actions" : "review_phase_2_damage";
}

export function getCombatRoundDamageReviewStepForPhase(phase: CombatRoundPhase): CombatRoundStep {
  return phase === "phase1" ? "phase_1_damage" : "phase_2_damage";
}

export function getCombatRoundPhaseActionStepForPhase(phase: CombatRoundPhase): CombatRoundStep {
  return phase === "phase1" ? "phase_1_actions" : "phase_2_actions";
}

function getCombatRoundAttackPhaseForStep(step: CombatRoundStep): CombatRoundPhase | undefined {
  if (step === "phase_1_actions") {
    return "phase1";
  }

  if (step === "phase_2_actions") {
    return "phase2";
  }

  return undefined;
}

function getCombatRoundPhaseParryStepForPhase(phase: CombatRoundPhase): CombatRoundStep {
  return phase === "phase1" ? "review_phase_2_actions" : "review_phase_2_damage";
}

export function combatRoundParticipantHasPhaseAttack(input: {
  participantId: string;
  phase: CombatRoundPhase;
  state: CombatRoundState;
}): boolean {
  const normalized = combatRoundStateSchema.parse(input.state);
  const participant = normalized.participants.find(
    (entry) => entry.participantId === input.participantId,
  );

  if (!participant?.declaration) {
    return false;
  }

  return getCombatDeclarationAttackPhases({
    actionId: participant.declaration.actionId,
    secondaryActionId: participant.declaration.secondaryActionId,
  }).includes(input.phase);
}

export function combatRoundParticipantHasExecutablePhaseAttack(input: {
  participantId: string;
  phase: CombatRoundPhase;
  state: CombatRoundState;
}): boolean {
  const normalized = combatRoundStateSchema.parse(input.state);
  const participant = normalized.participants.find(
    (entry) => entry.participantId === input.participantId,
  );
  const targetParticipantId =
    participant?.declaration?.phaseContexts?.[input.phase]?.targetParticipantId;

  return Boolean(
    combatRoundParticipantHasPhaseAttack({
      participantId: input.participantId,
      phase: input.phase,
      state: normalized,
    }) &&
    targetParticipantId &&
    getCombatRoundParticipantByTargetId({
      state: normalized,
      targetParticipantId,
    }),
  );
}

function getNextCombatRoundPhaseActionParticipantId(input: {
  phase: CombatRoundPhase;
  state: CombatRoundState;
}): string | undefined {
  const normalized = combatRoundStateSchema.parse(input.state);
  const order = getCombatRoundPhaseResolutionOrder({
    phase: input.phase,
    state: normalized,
  });

  return order.find((participantId) => {
    const status = getEffectiveCombatRoundPhaseResolutionStatus({
      participantId,
      phase: input.phase,
      state: normalized,
    });
    const existingAttackResult = getCombatRoundOutgoingAttackResultForParticipantPhase({
      participantId,
      phase: input.phase,
      state: normalized,
    });

    return (
      status.substep !== "done" &&
      existingAttackResult === undefined &&
      combatRoundParticipantHasExecutablePhaseAttack({
        participantId,
        phase: input.phase,
        state: normalized,
      })
    );
  });
}

function combatRoundCommandCancelsPhaseAction(input: {
  command: CombatRoundCommand;
  participantId: string;
  phase: CombatRoundPhase;
}): boolean {
  if (input.command.type === "commit_phase_initiative_resolution") {
    const appliedChoices = Array.isArray(input.command.facts.appliedChoices)
      ? input.command.facts.appliedChoices
      : [];

    return appliedChoices.some(
      (choice) =>
        choice &&
        typeof choice === "object" &&
        "participantId" in choice &&
        "choice" in choice &&
        choice.participantId === input.participantId &&
        input.command.phase === input.phase &&
        (choice.choice === "back_out" || choice.phaseAttackCancelled === true),
    );
  }

  if (input.command.type !== "commit_phase_damage") {
    return false;
  }

  const cancelledActions = input.command.facts.cancelledActions;

  return (
    Array.isArray(cancelledActions) &&
    cancelledActions.some(
      (entry) =>
        typeof entry === "object" &&
        entry !== null &&
        "participantId" in entry &&
        "phase" in entry &&
        entry.participantId === input.participantId &&
        entry.phase === input.phase,
    )
  );
}

function combatRoundParticipantPhaseActionHasCompletionEvidence(input: {
  participantId: string;
  phase: CombatRoundPhase;
  state: CombatRoundState;
}): boolean {
  const normalized = combatRoundStateSchema.parse(input.state);
  const participant = normalized.participants.find(
    (entry) => entry.participantId === input.participantId,
  );
  const actionStep = getCombatRoundPhaseActionStepForPhase(input.phase);

  if (participant?.stepStatuses[actionStep] === "skipped") {
    return true;
  }

  if (
    getCombatRoundOutgoingAttackResultForParticipantPhase({
      participantId: input.participantId,
      phase: input.phase,
      state: normalized,
    })
  ) {
    return true;
  }

  if (
    participant?.combatExperience?.roundNumber === normalized.roundNumber &&
    getCombatExperiencePhaseForTrigger(participant.combatExperience.trigger) === input.phase &&
    phaseCombatExperienceCancelsAttack(participant.combatExperience)
  ) {
    return true;
  }

  return normalized.commands.some(
    (command) =>
      command.roundNumber === normalized.roundNumber &&
      command.participantId === input.participantId &&
      ((command.phase === input.phase &&
        (command.type === "roll_attack" ||
          command.type === "skip_phase_action" ||
          command.type === "back_out_phase_attack")) ||
        combatRoundCommandCancelsPhaseAction({
          command,
          participantId: input.participantId,
          phase: input.phase,
        })),
  );
}

function getEffectiveCombatRoundPhaseResolutionStatus(input: {
  participantId: string;
  phase: CombatRoundPhase;
  state: CombatRoundState;
}): CombatRoundPhaseResolutionParticipantStatus {
  const normalized = combatRoundStateSchema.parse(input.state);
  const participant = normalized.participants.find(
    (entry) => entry.participantId === input.participantId,
  );
  const actionStep = getCombatRoundPhaseActionStepForPhase(input.phase);
  const status = getCombatRoundPhaseResolutionStatus({
    participantId: input.participantId,
    phase: input.phase,
    state: normalized,
  });

  if (
    status.substep !== "done" ||
    !combatRoundParticipantHasExecutablePhaseAttack({
      participantId: input.participantId,
      phase: input.phase,
      state: normalized,
    }) ||
    (participant?.stepStatuses[actionStep] ?? "pending") === "pending" ||
    combatRoundParticipantPhaseActionHasCompletionEvidence({
      participantId: input.participantId,
      phase: input.phase,
      state: normalized,
    })
  ) {
    return status;
  }

  return {
    substep: "pending",
    updatedAt: status.updatedAt,
  };
}

function clearUnsupportedCombatRoundPhaseActionProgress(input: {
  phase: CombatRoundPhase;
  state: CombatRoundState;
}): CombatRoundState {
  const normalized = combatRoundStateSchema.parse(input.state);
  const actionStep = getCombatRoundPhaseActionStepForPhase(input.phase);
  let changed = false;
  const phaseResolutionStatuses: CombatRoundPhaseResolutionStatuses = {
    ...normalized.phaseResolutionStatuses,
  };
  const participants = normalized.participants.map((participant) => {
    const executable = combatRoundParticipantHasExecutablePhaseAttack({
      participantId: participant.participantId,
      phase: input.phase,
      state: normalized,
    });
    const hasCompletionEvidence = combatRoundParticipantPhaseActionHasCompletionEvidence({
      participantId: participant.participantId,
      phase: input.phase,
      state: normalized,
    });
    const phaseStatus = phaseResolutionStatuses[participant.participantId]?.[input.phase];

    if (
      !executable ||
      hasCompletionEvidence ||
      phaseStatus?.substep !== "done" ||
      participant.stepStatuses[actionStep] === "pending"
    ) {
      return participant;
    }

    changed = true;
    phaseResolutionStatuses[participant.participantId] = {
      ...phaseResolutionStatuses[participant.participantId],
      [input.phase]: undefined,
    };

    return {
      ...participant,
      stepStatuses: {
        ...participant.stepStatuses,
        [actionStep]: "pending",
      },
    };
  });

  return changed
    ? combatRoundStateSchema.parse({
        ...normalized,
        participants,
        phaseResolutionStatuses,
      })
    : normalized;
}

function getCombatRoundInitialPhaseResolutionSubstep(input: {
  participantId: string;
  phase: CombatRoundPhase;
  state: CombatRoundState;
}): CombatRoundPhaseResolutionSubstep {
  return combatRoundParticipantHasExecutablePhaseAttack(input) ? "attack" : "done";
}

function getCombatRoundPostAttackResolutionSubstep(
  attackResult: CombatRoundAttackRollResult,
): CombatRoundPhaseResolutionSubstep {
  return attackResult.hit ? "parry" : "effects";
}

export function getCombatRoundPhaseResolutionStatus(input: {
  participantId: string;
  phase: CombatRoundPhase;
  state: CombatRoundState;
}): CombatRoundPhaseResolutionParticipantStatus {
  const normalized = combatRoundStateSchema.parse(input.state);

  return (
    normalized.phaseResolutionStatuses[input.participantId]?.[input.phase] ?? {
      substep: "pending",
    }
  );
}

export function getCombatRoundParticipantPhaseStepStatus(input: {
  participantId: string;
  state: CombatRoundState;
  step: CombatRoundStep;
}): CombatRoundStepStatus {
  const normalized = combatRoundStateSchema.parse(input.state);
  const phase =
    getCombatRoundAttackPhaseForStep(input.step) ??
    getCombatRoundResolutionPhaseForStep(input.step);
  const participant = normalized.participants.find(
    (entry) => entry.participantId === input.participantId,
  );
  const storedStatus = participant?.stepStatuses[input.step] ?? "pending";

  if (!phase) {
    return storedStatus;
  }

  const actionStep = getCombatRoundPhaseActionStepForPhase(phase);
  const parryStep = getCombatRoundPhaseParryStepForPhase(phase);
  const damageStep = getCombatRoundDamageReviewStepForPhase(phase);
  const phaseStatus = getCombatRoundPhaseResolutionStatus({
    participantId: input.participantId,
    phase,
    state: normalized,
  });

  if (input.step === actionStep) {
    const hasPhaseAttack = combatRoundParticipantHasPhaseAttack({
      participantId: input.participantId,
      phase,
      state: normalized,
    });

    if (!hasPhaseAttack) {
      return phaseStatus.substep === "done" ? "skipped" : storedStatus;
    }

    const outgoingAttackResult = getCombatRoundOutgoingAttackResultForParticipantPhase({
      participantId: input.participantId,
      phase,
      state: normalized,
    });

    if (
      !outgoingAttackResult &&
      storedStatus !== "pending" &&
      combatRoundParticipantHasExecutablePhaseAttack({
        participantId: input.participantId,
        phase,
        state: normalized,
      }) &&
      !combatRoundParticipantPhaseActionHasCompletionEvidence({
        participantId: input.participantId,
        phase,
        state: normalized,
      })
    ) {
      return "pending";
    }

    return outgoingAttackResult ? "gmEdited" : storedStatus;
  }

  const incomingAttackResult = getCombatRoundDisplayIncomingAttackResultForParticipantPhase({
    participantId: input.participantId,
    phase,
    state: normalized,
  });

  if (!incomingAttackResult) {
    return storedStatus;
  }

  const resolution =
    getCombatRoundPhaseResolutionResultForAttack({
      attackResult: incomingAttackResult,
      state: normalized,
    }) ??
    buildCombatRoundPhaseResolutionResult({
      attackResult: incomingAttackResult,
      roundNumber: normalized.roundNumber,
      updatedAt: incomingAttackResult.rolledAt,
    });

  if (input.step === parryStep) {
    if (!incomingAttackResult.hit || resolution.parryResolution.status === "not_applicable") {
      return "skipped";
    }

    return resolution.parryResolution.status === "resolved" ? "complete" : "pending";
  }

  if (input.step === damageStep) {
    if (!incomingAttackResult.hit || resolution.damageRoll.status === "not_required") {
      return "skipped";
    }

    if (resolution.damageProposal.status === "committed") {
      return "complete";
    }

    if (resolution.damageResult) {
      return "ready";
    }

    if (
      storedStatus === "submitted" ||
      storedStatus === "gmEdited" ||
      storedStatus === "complete"
    ) {
      return storedStatus;
    }

    return "pending";
  }

  return storedStatus;
}

function setCombatRoundPhaseResolutionStatus(input: {
  participantId: string;
  phase: CombatRoundPhase;
  state: CombatRoundState;
  status: CombatRoundPhaseResolutionParticipantStatus;
}): CombatRoundState {
  const normalized = combatRoundStateSchema.parse(input.state);

  return {
    ...normalized,
    phaseResolutionStatuses: {
      ...normalized.phaseResolutionStatuses,
      [input.participantId]: {
        ...normalized.phaseResolutionStatuses[input.participantId],
        [input.phase]: combatRoundPhaseResolutionParticipantStatusSchema.parse(input.status),
      },
    },
  };
}

export function getCombatRoundPhaseResolutionOrder(input: {
  phase: CombatRoundPhase;
  state: CombatRoundState;
}): string[] {
  return sortCombatRoundParticipantsByInitiative(input).map(
    (participant) => participant.participantId,
  );
}

function moveCombatRoundToPhaseInitiativeResolution(input: {
  participantId?: string;
  phase: CombatRoundPhase;
  state: CombatRoundState;
}): CombatRoundState {
  const normalized = combatRoundStateSchema.parse(input.state);
  const initiativeStep = getCombatRoundPhaseInitiativeStepForPhase(input.phase);
  const participantId =
    input.participantId ??
    getFirstUnresolvedCombatRoundPhaseInitiativeChoiceParticipantId({
      phase: input.phase,
      state: normalized,
    }) ??
    normalized.currentCursor?.participantId ??
    normalized.selectedParticipantId ??
    normalized.participants[0]?.participantId;

  return combatRoundStateSchema.parse({
    ...normalized,
    currentCursor: {
      participantId,
      roundNumber: normalized.roundNumber,
      step: getCombatRoundPhaseInitiativeCursorStepForPhase(input.phase),
    },
    currentStep: initiativeStep,
    phaseResolutionCursor: undefined,
    selectedParticipantId: participantId,
    selectedStep: initiativeStep,
  });
}

function moveCombatRoundAfterCompletedPhaseInitiative(input: {
  phase: CombatRoundPhase;
  state: CombatRoundState;
  visibility?: CombatRoundVisibility;
}): CombatRoundState {
  const normalized = combatRoundStateSchema.parse(input.state);
  const initiativeStep = getCombatRoundPhaseInitiativeStepForPhase(input.phase);
  const baseState = combatRoundStateSchema.parse({
    ...normalized,
    currentCursor: getDefaultCombatRoundCursor({
      participantId: normalized.currentCursor?.participantId ?? normalized.selectedParticipantId,
      roundNumber: normalized.roundNumber,
      step: initiativeStep,
    }),
    currentStep: initiativeStep,
    phaseResolutionCursor: undefined,
    selectedStep: initiativeStep,
  });
  const threatenedParticipantId = getCombatRoundPhaseInitiativeChoiceStatuses({
    phase: input.phase,
    state: baseState,
    visibility: input.visibility,
  })[0]?.participantId;

  return threatenedParticipantId
    ? moveCombatRoundToPhaseInitiativeResolution({
        participantId: threatenedParticipantId,
        phase: input.phase,
        state: baseState,
      })
    : initializeCombatRoundPhaseResolutionCursor({
        phase: input.phase,
        state: baseState,
      });
}

function phaseCombatExperienceCancelsAttack(result: CombatRoundCombatExperienceResult): boolean {
  return (
    getCombatExperiencePhaseForTrigger(result.trigger) !== undefined &&
    result.noRollRequired !== true &&
    result.effectiveTableTotal !== undefined &&
    result.effectiveTableTotal <= 5
  );
}

function applyPhaseCombatExperienceAttackCancellation(input: {
  participantId: string;
  phase: CombatRoundPhase;
  state: CombatRoundState;
  updatedAt: string;
}): CombatRoundState {
  const actionStep = getCombatRoundPhaseActionStepForPhase(input.phase);
  const withDoneStatus = setCombatRoundPhaseResolutionStatus({
    participantId: input.participantId,
    phase: input.phase,
    state: input.state,
    status: {
      substep: "done",
      updatedAt: input.updatedAt,
    },
  });

  return setCombatRoundParticipantStepStatus({
    participantId: input.participantId,
    state: withDoneStatus,
    status: "skipped",
    step: actionStep,
  });
}

function moveCombatRoundAfterCombatExperienceResult(input: {
  createdAt: string;
  participantId: string;
  result: CombatRoundCombatExperienceResult;
  state: CombatRoundState;
  visibility?: CombatRoundVisibility;
}): CombatRoundState {
  const withParticipantResult = combatRoundStateSchema.parse({
    ...input.state,
    participants: input.state.participants.map((entry) =>
      entry.participantId === input.participantId
        ? {
            ...entry,
            combatExperience: input.result,
          }
        : entry,
    ),
  });
  const phase = getCombatExperiencePhaseForTrigger(input.result.trigger);

  if (!phase) {
    return combatRoundStateSchema.parse({
      ...withParticipantResult,
      currentCursor: getDefaultCombatRoundCursor({
        participantId: input.participantId,
        roundNumber: withParticipantResult.roundNumber,
        step: "select_actions",
      }),
      currentStep: "select_actions",
      selectedParticipantId: input.participantId,
      selectedStep: "select_actions",
    });
  }

  const withPhaseOutcome = phaseCombatExperienceCancelsAttack(input.result)
    ? applyPhaseCombatExperienceAttackCancellation({
        participantId: input.participantId,
        phase,
        state: withParticipantResult,
        updatedAt: input.createdAt,
      })
    : withParticipantResult;
  const nextParticipantId = getFirstCombatRoundPhaseCombatExperienceRequiredParticipantId({
    phase,
    state: withPhaseOutcome,
    visibility: input.visibility,
  });

  if (nextParticipantId) {
    return moveCombatRoundToPhaseInitiativeResolution({
      participantId: nextParticipantId,
      phase,
      state: withPhaseOutcome,
    });
  }

  return initializeCombatRoundPhaseResolutionCursor({
    phase,
    state: withPhaseOutcome,
    updatedAt: input.createdAt,
  });
}

export function initializeCombatRoundPhaseResolutionCursor(input: {
  phase: CombatRoundPhase;
  state: CombatRoundState;
  updatedAt?: string;
}): CombatRoundState {
  const normalized = clearUnsupportedCombatRoundPhaseActionProgress({
    phase: input.phase,
    state: input.state,
  });
  const participantId = getNextCombatRoundPhaseActionParticipantId({
    phase: input.phase,
    state: normalized,
  });

  if (!participantId) {
    return moveCombatRoundToPhaseCompletion({
      phase: input.phase,
      state: normalized,
    });
  }

  const existingStatus = getEffectiveCombatRoundPhaseResolutionStatus({
    participantId,
    phase: input.phase,
    state: normalized,
  });
  const nextSubstep =
    existingStatus.substep === "pending"
      ? getCombatRoundInitialPhaseResolutionSubstep({
          participantId,
          phase: input.phase,
          state: normalized,
        })
      : existingStatus.substep;
  const withStatus = setCombatRoundPhaseResolutionStatus({
    participantId,
    phase: input.phase,
    state: normalized,
    status: {
      substep: nextSubstep,
      updatedAt: input.updatedAt ?? existingStatus.updatedAt,
    },
  });
  const phaseResolutionCursor = {
    participantId,
    phase: input.phase,
    substep: nextSubstep,
  };
  const currentCursor = getCombatRoundCursorForPhaseResolutionCursor({
    cursor: phaseResolutionCursor,
    state: withStatus,
  });
  const selectedStep = getCombatRoundStepForCursorStep(currentCursor.step);

  return {
    ...withStatus,
    currentCursor,
    currentStep: selectedStep,
    phaseResolutionCursor,
    selectedParticipantId: participantId,
    selectedStep,
  };
}

function moveCombatRoundPhaseResolutionCursorToNextParticipant(input: {
  phase: CombatRoundPhase;
  state: CombatRoundState;
  updatedAt: string;
}): CombatRoundState {
  const normalized = clearUnsupportedCombatRoundPhaseActionProgress({
    phase: input.phase,
    state: input.state,
  });
  const participantId = getNextCombatRoundPhaseActionParticipantId({
    phase: input.phase,
    state: normalized,
  });

  if (!participantId) {
    return moveCombatRoundToPhaseCompletion({
      phase: input.phase,
      state: normalized,
    });
  }

  const nextSubstep = getCombatRoundInitialPhaseResolutionSubstep({
    participantId,
    phase: input.phase,
    state: normalized,
  });
  const withStatus = setCombatRoundPhaseResolutionStatus({
    participantId,
    phase: input.phase,
    state: normalized,
    status: {
      substep: nextSubstep,
      updatedAt: input.updatedAt,
    },
  });
  const phaseResolutionCursor = {
    participantId,
    phase: input.phase,
    substep: nextSubstep,
  };
  const currentCursor = getCombatRoundCursorForPhaseResolutionCursor({
    cursor: phaseResolutionCursor,
    state: withStatus,
  });
  const selectedStep = getCombatRoundStepForCursorStep(currentCursor.step);

  return {
    ...withStatus,
    currentCursor,
    currentStep: selectedStep,
    phaseResolutionCursor,
    selectedParticipantId: participantId,
    selectedStep,
  };
}

export function recordCombatRoundPhaseResolutionAttackDone(input: {
  attackResult: CombatRoundAttackRollResult;
  state: CombatRoundState;
  updatedAt: string;
}): CombatRoundState {
  if (!input.attackResult.hit) {
    const withMissDoneStatus = setCombatRoundPhaseResolutionStatus({
      participantId: input.attackResult.attackerParticipantId,
      phase: input.attackResult.phase,
      state: input.state,
      status: {
        substep: "done",
        updatedAt: input.updatedAt,
      },
    });

    return moveCombatRoundPhaseResolutionCursorToNextParticipant({
      phase: input.attackResult.phase,
      state: withMissDoneStatus,
      updatedAt: input.updatedAt,
    });
  }

  const nextSubstep = getCombatRoundPostAttackResolutionSubstep(input.attackResult);
  const withStatus = setCombatRoundPhaseResolutionStatus({
    participantId: input.attackResult.attackerParticipantId,
    phase: input.attackResult.phase,
    state: input.state,
    status: {
      substep: nextSubstep,
      updatedAt: input.updatedAt,
    },
  });

  return {
    ...withStatus,
    phaseResolutionCursor: {
      participantId: input.attackResult.hit
        ? input.attackResult.defenderParticipantId
        : input.attackResult.attackerParticipantId,
      phase: input.attackResult.phase,
      substep: nextSubstep,
    },
    selectedParticipantId: input.attackResult.hit
      ? input.attackResult.defenderParticipantId
      : input.attackResult.attackerParticipantId,
    selectedStep: input.attackResult.hit
      ? getCombatRoundParryReviewStepForPhase(input.attackResult.phase)
      : getCombatRoundDamageReviewStepForPhase(input.attackResult.phase),
  };
}

export function advanceCombatRoundPhaseResolutionSubstepForParticipant(input: {
  participantId: string;
  phase: CombatRoundPhase;
  state: CombatRoundState;
  updatedAt: string;
}): CombatRoundState {
  const normalized = combatRoundStateSchema.parse(input.state);
  const currentStatus = getCombatRoundPhaseResolutionStatus({
    participantId: input.participantId,
    phase: input.phase,
    state: normalized,
  });
  const currentSubstep =
    currentStatus.substep === "pending"
      ? getCombatRoundInitialPhaseResolutionSubstep(input)
      : currentStatus.substep;

  if (currentSubstep === "done") {
    return normalized;
  }

  if (currentSubstep === "effects") {
    return completeCombatRoundPhaseResolutionForParticipant({
      participantId: input.participantId,
      phase: input.phase,
      state: normalized,
      submittedBy: "gm",
      updatedAt: input.updatedAt,
    });
  }

  const nextSubstep: CombatRoundPhaseResolutionSubstep =
    currentSubstep === "attack" ? "parry" : currentSubstep === "parry" ? "damage" : "effects";
  const withStatus = setCombatRoundPhaseResolutionStatus({
    participantId: input.participantId,
    phase: input.phase,
    state: normalized,
    status: {
      substep: nextSubstep,
      updatedAt: input.updatedAt,
    },
  });

  return {
    ...withStatus,
    phaseResolutionCursor: {
      participantId: input.participantId,
      phase: input.phase,
      substep: nextSubstep,
    },
    selectedParticipantId: input.participantId,
    selectedStep:
      nextSubstep === "parry"
        ? getCombatRoundParryReviewStepForPhase(input.phase)
        : getCombatRoundDamageReviewStepForPhase(input.phase),
  };
}

export function completeCombatRoundPhaseResolutionForParticipant(input: {
  participantId: string;
  phase: CombatRoundPhase;
  state: CombatRoundState;
  submittedBy: "gm" | "player";
  updatedAt: string;
}): CombatRoundState {
  const withStatus = setCombatRoundPhaseResolutionStatus({
    participantId: input.participantId,
    phase: input.phase,
    state: input.state,
    status: {
      substep: "done",
      updatedAt: input.updatedAt,
    },
  });
  const hasPhaseAttack = combatRoundParticipantHasPhaseAttack({
    participantId: input.participantId,
    phase: input.phase,
    state: withStatus,
  });
  const attackResult = getCombatRoundOutgoingAttackResultForParticipantPhase({
    participantId: input.participantId,
    phase: input.phase,
    state: withStatus,
  });
  const withActionStepStatus = hasPhaseAttack
    ? withStatus
    : setCombatRoundParticipantStepStatus({
        participantId: input.participantId,
        state: withStatus,
        status: "skipped",
        step: getCombatRoundPhaseActionStepForPhase(input.phase),
      });
  const reviewParticipantId =
    hasPhaseAttack && attackResult?.hit ? attackResult.defenderParticipantId : input.participantId;
  const reviewStep =
    hasPhaseAttack && attackResult?.hit
      ? getCombatRoundDamageReviewStepForPhase(input.phase)
      : getCombatRoundParryReviewStepForPhase(input.phase);
  const withStepStatus =
    hasPhaseAttack && !attackResult?.hit
      ? withActionStepStatus
      : setCombatRoundParticipantStepStatus({
          participantId: reviewParticipantId,
          state: withActionStepStatus,
          status: input.submittedBy === "gm" ? "gmEdited" : "submitted",
          step: reviewStep,
        });

  return moveCombatRoundPhaseResolutionCursorToNextParticipant({
    phase: input.phase,
    state: withStepStatus,
    updatedAt: input.updatedAt,
  });
}

function getCombatRoundPhaseActionSkipCommandAfterCursor(input: {
  phase: CombatRoundPhase;
  state: CombatRoundState;
}): CombatRoundCursor {
  return getCombatRoundPhaseActionOrCompletionCursor(input);
}

function recordCombatRoundPhaseActionSkipCommand(input: {
  command: {
    commandId?: string;
    createdAt: string;
    createdByUserId?: string;
  };
  participantId: string;
  phase: CombatRoundPhase;
  state: CombatRoundState;
}): CombatRoundState {
  const normalized = combatRoundStateSchema.parse(input.state);
  const beforeCursor = combatRoundCursorSchema.parse({
    participantId: input.participantId,
    roundNumber: normalized.roundNumber,
    step: getCombatRoundAttackCursorStepForPhase(input.phase),
  });
  const afterCursor = getCombatRoundPhaseActionSkipCommandAfterCursor({
    phase: input.phase,
    state: normalized,
  });
  const commandType = "skip_phase_action" satisfies CombatRoundCommandType;
  const command = combatRoundCommandSchema.parse({
    afterCursor,
    beforeCursor,
    createdAt: input.command.createdAt,
    createdByUserId: input.command.createdByUserId,
    facts: {
      phase: input.phase,
      status: "skipped",
      ...(afterCursor.participantId
        ? {
            nextStepOpened: {
              participantId: afterCursor.participantId,
              step: afterCursor.step,
            },
          }
        : {}),
    },
    id:
      input.command.commandId ??
      buildCombatRoundCommandId({
        createdAt: input.command.createdAt,
        participantId: input.participantId,
        state: normalized,
        type: commandType,
      }),
    participantId: input.participantId,
    phase: input.phase,
    roundNumber: normalized.roundNumber,
    step: beforeCursor.step,
    type: commandType,
  });
  const selectedStep = getCombatRoundStepForCursorStep(command.afterCursor.step);

  return {
    ...normalized,
    commands: [...normalized.commands, command],
    currentCursor: command.afterCursor,
    currentStep: selectedStep,
    selectedParticipantId: command.afterCursor.participantId ?? normalized.selectedParticipantId,
    selectedStep,
  };
}

export function skipCombatRoundCurrentPhaseAction(input: {
  command: {
    commandId?: string;
    createdAt: string;
    createdByUserId?: string;
  };
  participantId: string;
  phase: CombatRoundPhase;
  reason?: string;
  state: CombatRoundState;
  submittedBy: "gm" | "player";
  updatedAt: string;
}): CombatRoundState {
  const normalized = combatRoundStateSchema.parse(input.state);
  const actionStep = getCombatRoundPhaseActionStepForPhase(input.phase);
  const beforeCursor = combatRoundCursorSchema.parse({
    participantId: input.participantId,
    roundNumber: normalized.roundNumber,
    step: getCombatRoundAttackCursorStepForPhase(input.phase),
  });

  if (
    !combatRoundParticipantHasExecutablePhaseAttack({
      participantId: input.participantId,
      phase: input.phase,
      state: normalized,
    })
  ) {
    throw new RangeError(
      "Current phase action cannot be skipped because it is not attack-capable.",
    );
  }

  if (
    getCombatRoundOutgoingAttackResultForParticipantPhase({
      participantId: input.participantId,
      phase: input.phase,
      state: normalized,
    })
  ) {
    throw new RangeError("Current phase action cannot be skipped after the attack is rolled.");
  }

  const withDoneStatus = setCombatRoundPhaseResolutionStatus({
    participantId: input.participantId,
    phase: input.phase,
    state: normalized,
    status: {
      substep: "done",
      updatedAt: input.updatedAt,
    },
  });
  const withSkippedAction = setCombatRoundParticipantStepStatus({
    participantId: input.participantId,
    state: withDoneStatus,
    status: "skipped",
    step: actionStep,
  });
  const commandType = "skip_phase_action" satisfies CombatRoundCommandType;
  const commandId =
    input.command.commandId ??
    buildCombatRoundCommandId({
      createdAt: input.command.createdAt,
      participantId: input.participantId,
      state: normalized,
      type: commandType,
    });
  const commandShell = combatRoundCommandSchema.parse({
    afterCursor: beforeCursor,
    beforeCursor,
    createdAt: input.command.createdAt,
    createdByUserId: input.command.createdByUserId,
    facts: {
      phase: input.phase,
      reason: input.reason?.trim() || "GM skipped action",
      status: "skipped",
    },
    id: commandId,
    participantId: input.participantId,
    phase: input.phase,
    roundNumber: normalized.roundNumber,
    step: beforeCursor.step,
    type: commandType,
  });
  const stateForAfterCursor = combatRoundStateSchema.parse({
    ...withSkippedAction,
    commands: [
      ...withSkippedAction.commands.filter((command) => command.id !== commandId),
      commandShell,
    ],
  });
  const afterCursor = getCombatRoundPhaseActionSkipCommandAfterCursor({
    phase: input.phase,
    state: stateForAfterCursor,
  });
  const command = combatRoundCommandSchema.parse({
    ...commandShell,
    afterCursor,
    facts: {
      ...commandShell.facts,
      ...(afterCursor.participantId
        ? {
            nextStepOpened: {
              participantId: afterCursor.participantId,
              step: afterCursor.step,
            },
          }
        : {}),
    },
  });
  const selectedStep = getCombatRoundStepForCursorStep(command.afterCursor.step);

  return combatRoundStateSchema.parse({
    ...withSkippedAction,
    commands: [
      ...withSkippedAction.commands.filter((existingCommand) => existingCommand.id !== commandId),
      command,
    ],
    currentCursor: command.afterCursor,
    currentStep: selectedStep,
    phaseResolutionCursor:
      afterCursor.participantId && afterCursor.step === beforeCursor.step
        ? {
            participantId: afterCursor.participantId,
            phase: input.phase,
            substep: "attack",
          }
        : undefined,
    selectedParticipantId: command.afterCursor.participantId ?? input.participantId,
    selectedStep,
  });
}

function submitCombatRoundPhaseInitiativeChoiceCommand(input: {
  combatContext?: ScenarioParticipantCombatContext;
  command: {
    commandId?: string;
    createdAt: string;
    createdByUserId?: string;
  };
  choice: "back_out" | "continue_without_ce";
  participantId: string;
  phase: CombatRoundPhase;
  state: CombatRoundState;
  visibility?: CombatRoundVisibility;
}): {
  combatContext: ScenarioParticipantCombatContext;
  command: CombatRoundCommand;
  state: CombatRoundState;
} {
  const normalized = combatRoundStateSchema.parse(input.state);
  const participant = normalized.participants.find(
    (entry) => entry.participantId === input.participantId,
  );
  const initiativeStep = getCombatRoundPhaseInitiativeStepForPhase(input.phase);
  const trigger = getCombatExperienceTriggerForPhase(input.phase);
  const backOutOpportunity = getCombatRoundPhaseAttackBackOutOpportunity({
    participantId: input.participantId,
    phase: input.phase,
    state: normalized,
    visibility: input.visibility,
  });
  const phaseRequirement = getCombatRoundPhaseCombatExperienceRequirement({
    participantId: input.participantId,
    phase: input.phase,
    state: normalized,
    visibility: input.visibility,
  });

  if (!participant) {
    throw new RangeError("Phase initiative participant is not in the active round.");
  }

  if (normalized.currentStep !== initiativeStep) {
    throw new RangeError(
      "Phase initiative choices can only be submitted during initiative resolution.",
    );
  }

  if (!backOutOpportunity) {
    throw new RangeError("Phase initiative choice is only available while attacked and attacking.");
  }

  if (input.choice === "continue_without_ce" && backOutOpportunity.ceRequired) {
    throw new RangeError("Combat Experience is required before continuing this attack.");
  }

  if (
    combatRoundPhaseInitiativeChoiceSubmitted({
      participantId: input.participantId,
      phase: input.phase,
      state: normalized,
    })
  ) {
    throw new RangeError("Phase initiative choice already submitted for this participant.");
  }

  if (
    getCombatRoundOutgoingAttackResultForParticipantPhase({
      participantId: input.participantId,
      phase: input.phase,
      state: normalized,
    })
  ) {
    throw new RangeError("Back out cannot be chosen after the attack is rolled.");
  }

  const beforeCursor =
    normalized.currentCursor?.roundNumber === normalized.roundNumber &&
    normalized.currentCursor.participantId === input.participantId &&
    normalized.currentCursor.step === getCombatRoundPhaseInitiativeCursorStepForPhase(input.phase)
      ? normalized.currentCursor
      : combatRoundCursorSchema.parse({
          participantId: input.participantId,
          roundNumber: normalized.roundNumber,
          step: getCombatRoundPhaseInitiativeCursorStepForPhase(input.phase),
        });
  const commandType = "submit_phase_initiative_choice" satisfies CombatRoundCommandType;
  const commandId =
    input.command.commandId ??
    buildCombatRoundCommandId({
      createdAt: input.command.createdAt,
      participantId: input.participantId,
      state: normalized,
      type: commandType,
    });
  const currentCombatContext = scenarioParticipantCombatContextSchema.parse(
    input.combatContext ?? {},
  );
  const softenedModifierResult =
    input.choice === "back_out"
      ? softenCombatActionGeneratedBackOutModifier({
          actionId: participant.declaration?.actionId,
          combatContext: currentCombatContext,
          phase: input.phase,
        })
      : {
          combatContext: currentCombatContext,
          softenedModifiers: [],
          warning: undefined,
        };
  const commandShell = combatRoundCommandSchema.parse({
    afterCursor: beforeCursor,
    beforeCursor,
    createdAt: input.command.createdAt,
    createdByUserId: input.command.createdByUserId,
    facts: {
      ...(participant.declaration?.actionId
        ? {
            attackActionId: participant.declaration.actionId,
          }
        : {}),
      attackStep: getCombatRoundAttackCursorStepForPhase(input.phase),
      ...(softenedModifierResult.warning
        ? {
            modifierSofteningWarning: softenedModifierResult.warning,
          }
        : {}),
      backOutAvailableReason: backOutOpportunity.reason,
      ceRequired: Boolean(phaseRequirement),
      ceWasRequired: Boolean(phaseRequirement),
      choice: input.choice,
      initiativeComparison: backOutOpportunity.threats,
      phase: input.phase,
      ...(phaseRequirement
        ? {
            phaseCombatExperienceReason: phaseRequirement.reason,
            phaseCombatExperienceThreats: phaseRequirement.threats,
          }
        : {}),
      reason:
        input.choice === "back_out"
          ? "Backed out while attacked"
          : "Continued attack without Combat Experience",
      skippedAttack: input.choice === "back_out",
      softenedModifierIds: softenedModifierResult.softenedModifiers.map(
        (change) => change.modifierId,
      ),
      softenedModifiers: softenedModifierResult.softenedModifiers,
      source: "phase_initiative_resolution",
      status: input.choice === "back_out" ? "submitted" : "submitted",
      step: beforeCursor.step,
      threatened: true,
      trigger,
    },
    id: commandId,
    participantId: input.participantId,
    phase: input.phase,
    roundNumber: normalized.roundNumber,
    step: beforeCursor.step,
    type: commandType,
  });
  const stateWithCommandShell = combatRoundStateSchema.parse({
    ...normalized,
    commands: [
      ...normalized.commands.filter((existingCommand) => existingCommand.id !== commandId),
      commandShell,
    ],
  });
  const stateAfterChoice = moveCombatRoundToPhaseInitiativeResolution({
    phase: input.phase,
    state: stateWithCommandShell,
  });
  const afterCursor = stateAfterChoice.currentCursor ?? beforeCursor;
  const command = combatRoundCommandSchema.parse({
    ...commandShell,
    afterCursor,
    facts: {
      ...commandShell.facts,
      ...(afterCursor.participantId
        ? {
            nextStepOpened: {
              participantId: afterCursor.participantId,
              step: afterCursor.step,
            },
          }
        : {}),
    },
  });
  const selectedStep = getCombatRoundStepForCursorStep(command.afterCursor.step);

  return {
    combatContext: currentCombatContext,
    command,
    state: combatRoundStateSchema.parse({
      ...stateAfterChoice,
      commands: [
        ...stateAfterChoice.commands.filter((existingCommand) => existingCommand.id !== commandId),
        command,
      ],
      currentCursor: command.afterCursor,
      currentStep: selectedStep,
      selectedParticipantId: command.afterCursor.participantId ?? input.participantId,
      selectedStep,
    }),
  };
}

export function backOutCombatRoundPhaseAttack(input: {
  combatContext?: ScenarioParticipantCombatContext;
  command: {
    commandId?: string;
    createdAt: string;
    createdByUserId?: string;
  };
  participantId: string;
  phase: CombatRoundPhase;
  state: CombatRoundState;
  updatedAt: string;
  visibility?: CombatRoundVisibility;
}): {
  combatContext: ScenarioParticipantCombatContext;
  command: CombatRoundCommand;
  state: CombatRoundState;
} {
  return submitCombatRoundPhaseInitiativeChoiceCommand({
    combatContext: input.combatContext,
    command: input.command,
    choice: "back_out",
    participantId: input.participantId,
    phase: input.phase,
    state: input.state,
    visibility: input.visibility,
  });
}

export function continueCombatRoundPhaseAttack(input: {
  command: {
    commandId?: string;
    createdAt: string;
    createdByUserId?: string;
  };
  participantId: string;
  phase: CombatRoundPhase;
  state: CombatRoundState;
  visibility?: CombatRoundVisibility;
}): {
  command: CombatRoundCommand;
  state: CombatRoundState;
} {
  const submitted = submitCombatRoundPhaseInitiativeChoiceCommand({
    command: input.command,
    choice: "continue_without_ce",
    participantId: input.participantId,
    phase: input.phase,
    state: input.state,
    visibility: input.visibility,
  });

  return {
    command: submitted.command,
    state: submitted.state,
  };
}

export interface CombatRoundPhaseInitiativeCommitParticipantInput {
  combatContext?: ScenarioParticipantCombatContext;
  scenarioParticipantId?: string;
  skillTotal?: number;
  skillTotalSource?: string;
  skillTotalWarning?: string;
}

function buildCommittedPhaseCombatExperienceResult(input: {
  command: {
    createdAt: string;
    createdByUserId?: string;
  };
  difficulty: number;
  participantId: string;
  phase: CombatRoundPhase;
  rng: () => number;
  roundNumber: number;
  skillTotal?: number;
  skillTotalSource?: string;
  skillTotalWarning?: string;
}): CombatRoundCombatExperienceResult {
  const skillTotal = Math.trunc(input.skillTotal ?? 0);
  const noRollRequired = skillTotal >= input.difficulty;
  const roll = noRollRequired ? undefined : rollOpenEndedD20(input.rng);
  const finalTotal = noRollRequired ? skillTotal : skillTotal + (roll?.dieResult ?? 0);
  const evaluation = evaluatePhaseCombatExperienceResult(finalTotal, {
    difficulty: input.difficulty,
  });

  return combatRoundCombatExperienceResultSchema.parse({
    ...evaluation,
    difficulty: input.difficulty,
    finalTotal,
    noRollRequired,
    openEndedD10s: roll?.openEndedD10s ?? [],
    rolledAt: input.command.createdAt,
    rolledByUserId: input.command.createdByUserId,
    rollD20: roll?.rollD20,
    rollTotal: roll?.dieResult,
    roundNumber: input.roundNumber,
    skillTotal,
    skillTotalSource: input.skillTotalSource,
    skillTotalWarning: input.skillTotalWarning,
    trigger: getCombatExperienceTriggerForPhase(input.phase),
  });
}

function applyCommittedPhaseCombatExperienceResult(input: {
  createdAt: string;
  participantId: string;
  phase: CombatRoundPhase;
  result: CombatRoundCombatExperienceResult;
  state: CombatRoundState;
}): CombatRoundState {
  const withParticipantResult = combatRoundStateSchema.parse({
    ...input.state,
    participants: input.state.participants.map((entry) =>
      entry.participantId === input.participantId
        ? {
            ...entry,
            combatExperience: input.result,
          }
        : entry,
    ),
  });

  return phaseCombatExperienceCancelsAttack(input.result)
    ? applyPhaseCombatExperienceAttackCancellation({
        participantId: input.participantId,
        phase: input.phase,
        state: withParticipantResult,
        updatedAt: input.createdAt,
      })
    : withParticipantResult;
}

function applyCommittedPhaseBackOut(input: {
  createdAt: string;
  participantId: string;
  phase: CombatRoundPhase;
  state: CombatRoundState;
}): CombatRoundState {
  const actionStep = getCombatRoundPhaseActionStepForPhase(input.phase);
  const withDoneStatus = setCombatRoundPhaseResolutionStatus({
    participantId: input.participantId,
    phase: input.phase,
    state: input.state,
    status: {
      substep: "done",
      updatedAt: input.createdAt,
    },
  });

  return setCombatRoundParticipantStepStatus({
    participantId: input.participantId,
    state: withDoneStatus,
    status: "skipped",
    step: actionStep,
  });
}

export function commitCombatRoundPhaseInitiativeResolution(input: {
  command: {
    commandId?: string;
    createdAt: string;
    createdByUserId?: string;
    participantId?: string;
  };
  participants?: Record<string, CombatRoundPhaseInitiativeCommitParticipantInput>;
  phase: CombatRoundPhase;
  rng?: () => number;
  state: CombatRoundState;
  visibility?: CombatRoundVisibility;
}): {
  combatContextsByParticipantId: Record<string, ScenarioParticipantCombatContext>;
  command: CombatRoundCommand;
  state: CombatRoundState;
} {
  const normalized = combatRoundStateSchema.parse(input.state);
  const initiativeStep = getCombatRoundPhaseInitiativeStepForPhase(input.phase);

  if (normalized.currentStep !== initiativeStep) {
    throw new RangeError("Phase initiative resolution can only be committed from initiative.");
  }

  if (!isCombatRoundPhaseInitiativeComplete({ phase: input.phase, state: normalized })) {
    throw new RangeError("Phase initiative must be complete before resolution can be committed.");
  }

  const statuses = getCombatRoundPhaseInitiativeChoiceStatuses({
    phase: input.phase,
    state: normalized,
    visibility: input.visibility,
  });
  const commandParticipantId =
    input.command.participantId ??
    statuses[0]?.participantId ??
    normalized.currentCursor?.participantId ??
    normalized.selectedParticipantId ??
    normalized.participants[0]?.participantId;

  if (!commandParticipantId) {
    throw new RangeError("No participant is available for phase initiative resolution.");
  }

  const commandId =
    input.command.commandId ??
    buildCombatRoundCommandId({
      createdAt: input.command.createdAt,
      participantId: commandParticipantId,
      state: normalized,
      type: "commit_phase_initiative_resolution",
    });
  const beforeCursor =
    normalized.currentCursor?.step === getCombatRoundPhaseInitiativeCursorStepForPhase(input.phase)
      ? normalized.currentCursor
      : getDefaultCombatRoundCursor({
          participantId: commandParticipantId,
          roundNumber: normalized.roundNumber,
          step: initiativeStep,
        });
  const difficulty = getCombatRoundCombatExperienceDifficulty(normalized);
  const rng = input.rng ?? Math.random;
  const combatContextsByParticipantId = new Map<string, ScenarioParticipantCombatContext>();
  let workingState = normalized;
  const appliedChoices: Array<Record<string, unknown>> = [];
  const createdCombatModifierIds: string[] = [];
  const softenedModifiers: unknown[] = [];

  for (const status of statuses) {
    const participant = workingState.participants.find(
      (entry) => entry.participantId === status.participantId,
    );

    if (!participant) {
      continue;
    }

    const participantInput = input.participants?.[status.participantId] ?? {};
    const targetParticipantId = participantInput.scenarioParticipantId ?? status.participantId;
    const participantCombatContext = scenarioParticipantCombatContextSchema.parse(
      combatContextsByParticipantId.get(status.participantId) ??
        participantInput.combatContext ??
        {},
    );
    const choice =
      status.choice ??
      (status.ceRequired
        ? combatRoundPhaseInitiativeChoiceSchema.parse({
            attackActionId: participant.declaration?.actionId,
            attackStep: getCombatRoundAttackCursorStepForPhase(input.phase),
            ceRequired: true,
            choice: "roll_ce_result",
            commandId: `${commandId}:${status.participantId}:auto-ce`,
            defaultedOnCommit: true,
            phase: input.phase,
            participantId: status.participantId,
            roundNumber: normalized.roundNumber,
            submittedAt: input.command.createdAt,
            submittedByUserId: input.command.createdByUserId,
            threatened: true,
          })
        : combatRoundPhaseInitiativeChoiceSchema.parse({
            attackActionId: participant.declaration?.actionId,
            attackStep: getCombatRoundAttackCursorStepForPhase(input.phase),
            ceRequired: false,
            choice: "continue_without_ce",
            commandId: `${commandId}:${status.participantId}:default-continue`,
            defaultedOnCommit: true,
            phase: input.phase,
            participantId: status.participantId,
            roundNumber: normalized.roundNumber,
            submittedAt: input.command.createdAt,
            submittedByUserId: input.command.createdByUserId,
            threatened: true,
          }));
    let nextCombatContext = participantCombatContext;
    let combatExperienceResult = choice.combatExperience;
    let phaseAttackCancelled = false;
    let modifierSofteningWarning: string | undefined;
    let currentSoftenedModifiers: unknown[] = [];

    if (choice.choice === "roll_ce_result") {
      combatExperienceResult =
        combatExperienceResult ??
        buildCommittedPhaseCombatExperienceResult({
          command: input.command,
          difficulty,
          participantId: status.participantId,
          phase: input.phase,
          rng,
          roundNumber: normalized.roundNumber,
          skillTotal: participantInput.skillTotal,
          skillTotalSource: participantInput.skillTotalSource,
          skillTotalWarning: participantInput.skillTotalWarning,
        });
      const phaseModifier = addCombatRoundPhaseCombatExperienceModifier({
        combatContext: participantCombatContext,
        commandId,
        participant,
        participantId: targetParticipantId,
        phase: input.phase,
        result: combatExperienceResult,
      });

      nextCombatContext = phaseModifier.combatContext;
      createdCombatModifierIds.push(...phaseModifier.modifierIds);
      workingState = applyCommittedPhaseCombatExperienceResult({
        createdAt: input.command.createdAt,
        participantId: status.participantId,
        phase: input.phase,
        result: combatExperienceResult,
        state: workingState,
      });
      phaseAttackCancelled = phaseCombatExperienceCancelsAttack(combatExperienceResult);
    } else if (choice.choice === "back_out") {
      const softenedModifierResult = softenCombatActionGeneratedBackOutModifier({
        actionId: participant.declaration?.actionId,
        combatContext: participantCombatContext,
        phase: input.phase,
      });

      nextCombatContext = softenedModifierResult.combatContext;
      modifierSofteningWarning = softenedModifierResult.warning;
      currentSoftenedModifiers = softenedModifierResult.softenedModifiers;
      softenedModifiers.push(...currentSoftenedModifiers);
      workingState = applyCommittedPhaseBackOut({
        createdAt: input.command.createdAt,
        participantId: status.participantId,
        phase: input.phase,
        state: workingState,
      });
    }

    combatContextsByParticipantId.set(status.participantId, nextCombatContext);
    appliedChoices.push({
      ceRequired: status.ceRequired,
      choice: choice.choice,
      combatExperience: combatExperienceResult,
      defaultedOnCommit: choice.defaultedOnCommit,
      modifierSofteningWarning,
      participantId: status.participantId,
      phaseAttackCancelled,
      scenarioParticipantId: targetParticipantId,
      softenedModifierIds:
        choice.choice === "back_out"
          ? currentSoftenedModifiers
              .filter((change): change is { modifierId: string } =>
                Boolean(change && typeof change === "object" && "modifierId" in change),
              )
              .map((change) => change.modifierId)
          : [],
    });
  }

  const stateAfterPhaseOpen = initializeCombatRoundPhaseResolutionCursor({
    phase: input.phase,
    state: workingState,
    updatedAt: input.command.createdAt,
  });
  const afterCursor = stateAfterPhaseOpen.currentCursor ?? beforeCursor;
  const command = combatRoundCommandSchema.parse({
    afterCursor,
    beforeCursor,
    createdAt: input.command.createdAt,
    createdByUserId: input.command.createdByUserId,
    facts: {
      appliedChoices,
      attackStep: getCombatRoundAttackCursorStepForPhase(input.phase),
      autoResolvedCount: appliedChoices.filter(
        (choice) => choice.choice === "roll_ce_result" && choice.defaultedOnCommit === true,
      ).length,
      createdCombatModifierIds,
      defaultedContinueCount: appliedChoices.filter(
        (choice) => choice.choice === "continue_without_ce" && choice.defaultedOnCommit === true,
      ).length,
      difficulty,
      phase: input.phase,
      previousState: normalized,
      softenedModifiers,
      source: "phase_initiative_resolution_commit",
    },
    id: commandId,
    participantId: commandParticipantId,
    phase: input.phase,
    roundNumber: normalized.roundNumber,
    step: getCombatRoundPhaseInitiativeCursorStepForPhase(input.phase),
    type: "commit_phase_initiative_resolution",
  });
  const selectedStep = getCombatRoundStepForCursorStep(command.afterCursor.step);

  return {
    combatContextsByParticipantId: Object.fromEntries(combatContextsByParticipantId),
    command,
    state: combatRoundStateSchema.parse({
      ...stateAfterPhaseOpen,
      commands: [...stateAfterPhaseOpen.commands, command],
      currentCursor: command.afterCursor,
      currentStep: selectedStep,
      selectedParticipantId: command.afterCursor.participantId ?? commandParticipantId,
      selectedStep,
    }),
  };
}

export function restoreCombatRoundPhaseInitiativeResolutionCombatContextModifiers(input: {
  combatContext?: ScenarioParticipantCombatContext;
  command: CombatRoundCommand;
  participantId: string;
}): ScenarioParticipantCombatContext {
  const currentContext = removeCombatRoundCombatExperienceCombatContextModifiers({
    combatContext: input.combatContext,
    command: input.command,
  });
  const appliedChoices = Array.isArray(input.command.facts.appliedChoices)
    ? input.command.facts.appliedChoices
    : [];
  const participantSoftenedModifiers = appliedChoices
    .filter((choice): choice is Record<string, unknown> =>
      Boolean(
        choice &&
        typeof choice === "object" &&
        choice.participantId === input.participantId &&
        choice.choice === "back_out",
      ),
    )
    .flatMap((choice) => {
      const softenedModifierIds = Array.isArray(choice.softenedModifierIds)
        ? choice.softenedModifierIds.filter((entry): entry is string => typeof entry === "string")
        : [];
      const softenedModifiers = Array.isArray(input.command.facts.softenedModifiers)
        ? input.command.facts.softenedModifiers
        : [];

      return softenedModifiers.filter((change): change is Record<string, unknown> =>
        Boolean(
          change &&
          typeof change === "object" &&
          typeof change.modifierId === "string" &&
          softenedModifierIds.includes(change.modifierId),
        ),
      );
    });

  return restoreCombatActionGeneratedBackOutModifiers({
    combatContext: currentContext,
    softenedModifiers: participantSoftenedModifiers,
  });
}

export function recordCombatRoundNoAttackPhaseReview(input: {
  command?: {
    commandId?: string;
    createdAt: string;
    createdByUserId?: string;
  };
  participantId: string;
  phase: CombatRoundPhase;
  state: CombatRoundState;
  submittedBy: "gm" | "player";
  updatedAt: string;
}): CombatRoundState {
  const normalized = combatRoundStateSchema.parse(input.state);
  const hasPhaseAttack = combatRoundParticipantHasPhaseAttack({
    participantId: input.participantId,
    phase: input.phase,
    state: normalized,
  });

  if (hasPhaseAttack) {
    throw new RangeError("No-attack phase review cannot complete an attack-capable phase.");
  }

  const completed = completeCombatRoundPhaseResolutionForParticipant({
    participantId: input.participantId,
    phase: input.phase,
    state: normalized,
    submittedBy: input.submittedBy,
    updatedAt: input.updatedAt,
  });

  return input.command
    ? recordCombatRoundPhaseActionSkipCommand({
        command: input.command,
        participantId: input.participantId,
        phase: input.phase,
        state: completed,
      })
    : completed;
}

export function getCombatRoundAttackResultId(input: {
  result: Pick<
    CombatRoundAttackRollResult,
    "attackerParticipantId" | "defenderParticipantId" | "phase"
  >;
  roundNumber: number;
}): string {
  return [
    input.roundNumber,
    input.result.phase,
    input.result.attackerParticipantId,
    input.result.defenderParticipantId,
  ].join(":");
}

export function getCombatRoundAttackResultById(input: {
  attackResultId: string;
  state: CombatRoundState;
}): CombatRoundAttackRollResult | undefined {
  const phases: CombatRoundPhase[] = ["phase1", "phase2"];

  for (const participant of input.state.participants) {
    for (const phase of phases) {
      const result = participant.attackResults[phase];

      if (
        result &&
        getCombatRoundAttackResultId({
          result,
          roundNumber: input.state.roundNumber,
        }) === input.attackResultId
      ) {
        return result;
      }
    }
  }

  return undefined;
}

export interface CombatRoundAttackDistanceModifierDetail {
  actualDistance?: number;
  createdCombatModifierIds: string[];
  modifierId?: string;
  nearestPreferredDistance?: number;
  notes?: string;
  preferredDistances: number[];
  value: number;
  warning?: string;
  weaponName?: string;
}

function parseCombatRoundAttackDistanceModifierDetail(
  value: unknown,
): CombatRoundAttackDistanceModifierDetail | undefined {
  if (!value || typeof value !== "object") {
    return undefined;
  }

  const record = value as Record<string, unknown>;
  const preferredDistances = Array.isArray(record.preferredDistances)
    ? record.preferredDistances.filter((entry): entry is number => Number.isInteger(entry))
    : [];
  const createdCombatModifierIds = Array.isArray(record.createdCombatModifierIds)
    ? record.createdCombatModifierIds.filter((entry): entry is string => typeof entry === "string")
    : [];
  const valueNumber =
    typeof record.value === "number" && Number.isInteger(record.value) ? record.value : 0;

  return {
    actualDistance:
      typeof record.actualDistance === "number" && Number.isInteger(record.actualDistance)
        ? record.actualDistance
        : undefined,
    createdCombatModifierIds,
    modifierId: typeof record.modifierId === "string" ? record.modifierId : undefined,
    nearestPreferredDistance:
      typeof record.nearestPreferredDistance === "number" &&
      Number.isInteger(record.nearestPreferredDistance)
        ? record.nearestPreferredDistance
        : undefined,
    notes: typeof record.notes === "string" ? record.notes : undefined,
    preferredDistances,
    value: valueNumber,
    warning: typeof record.warning === "string" ? record.warning : undefined,
    weaponName: typeof record.weaponName === "string" ? record.weaponName : undefined,
  };
}

export function getCombatRoundAttackDistanceModifierDetail(input: {
  result: CombatRoundAttackRollResult;
  state: CombatRoundState;
}): CombatRoundAttackDistanceModifierDetail | undefined {
  const normalized = combatRoundStateSchema.parse(input.state);
  const attackResultId = getCombatRoundAttackResultId({
    result: input.result,
    roundNumber: normalized.roundNumber,
  });
  const command = [...normalized.commands]
    .reverse()
    .find(
      (entry) =>
        entry.type === "roll_attack" &&
        entry.roundNumber === normalized.roundNumber &&
        entry.facts.attackResultId === attackResultId,
    );

  return parseCombatRoundAttackDistanceModifierDetail(command?.facts.distanceModifier);
}

export function buildCombatRoundPhaseResolutionResult(input: {
  attackResult: CombatRoundAttackRollResult;
  roundNumber: number;
  updatedAt: string;
}): CombatRoundPhaseResolutionResult {
  const attackResultId = getCombatRoundAttackResultId({
    result: input.attackResult,
    roundNumber: input.roundNumber,
  });

  return combatRoundPhaseResolutionResultSchema.parse({
    attackResultId,
    attackerParticipantId: input.attackResult.attackerParticipantId,
    damageProposal: {
      proposedEffects: [],
      status: "not_ready",
    },
    damageRoll: input.attackResult.hit
      ? {
          notes: "Awaiting parry resolution.",
          status: "pending",
        }
      : {
          status: "not_required",
        },
    defenderParticipantId: input.attackResult.defenderParticipantId,
    parryResolution: input.attackResult.hit
      ? {
          status: "pending",
        }
      : {
          resultLabel: "Attack missed",
          status: "not_applicable",
        },
    phase: input.attackResult.phase,
    roundNumber: input.roundNumber,
    updatedAt: input.updatedAt,
  });
}

export function getCombatRoundPhaseResolutionResultForAttack(input: {
  attackResult: CombatRoundAttackRollResult;
  state: CombatRoundState;
}): CombatRoundPhaseResolutionResult | undefined {
  const normalized = combatRoundStateSchema.parse(input.state);
  const attackResultId = getCombatRoundAttackResultId({
    result: input.attackResult,
    roundNumber: normalized.roundNumber,
  });

  return normalized.phaseResolutionResults.find(
    (resolution) => resolution.attackResultId === attackResultId,
  );
}

export function getCombatRoundDisplayPhaseResolutionResultForParticipantPhase(input: {
  participantId: string;
  phase: CombatRoundPhase;
  state: CombatRoundState;
  updatedAt?: string;
}): CombatRoundPhaseResolutionResult | undefined {
  const normalized = combatRoundStateSchema.parse(input.state);
  const attackResult = getCombatRoundDisplayAttackResultForParticipantPhase({
    participantId: input.participantId,
    phase: input.phase,
    state: normalized,
  });

  if (!attackResult) {
    return undefined;
  }

  return (
    getCombatRoundPhaseResolutionResultForAttack({
      attackResult,
      state: normalized,
    }) ??
    buildCombatRoundPhaseResolutionResult({
      attackResult,
      roundNumber: normalized.roundNumber,
      updatedAt: input.updatedAt ?? attackResult.rolledAt,
    })
  );
}

function upsertCombatRoundPhaseResolutionResults(input: {
  results: CombatRoundPhaseResolutionResult[];
  state: CombatRoundState;
}): CombatRoundState {
  const normalized = combatRoundStateSchema.parse(input.state);
  const nextResults = input.results.map((result) =>
    combatRoundPhaseResolutionResultSchema.parse(result),
  );

  return {
    ...normalized,
    phaseResolutionResults: [
      ...normalized.phaseResolutionResults.filter(
        (existing) =>
          !nextResults.some((result) => result.attackResultId === existing.attackResultId),
      ),
      ...nextResults,
    ],
  };
}

export function ensureCombatRoundPhaseResolutionResultsForPhase(input: {
  phase: CombatRoundPhase;
  state: CombatRoundState;
  updatedAt: string;
}): CombatRoundState {
  const normalized = combatRoundStateSchema.parse(input.state);
  const results = normalized.participants
    .map((participant) => participant.attackResults[input.phase])
    .filter((result): result is CombatRoundAttackRollResult => result !== undefined)
    .map((attackResult) => {
      const existing = getCombatRoundPhaseResolutionResultForAttack({
        attackResult,
        state: normalized,
      });

      return (
        existing ??
        buildCombatRoundPhaseResolutionResult({
          attackResult,
          roundNumber: normalized.roundNumber,
          updatedAt: input.updatedAt,
        })
      );
    });

  return upsertCombatRoundPhaseResolutionResults({
    results,
    state: normalized,
  });
}

export function recordCombatRoundParryResolution(input: {
  attackResult: CombatRoundAttackRollResult;
  parryResolution: CombatRoundParryResolution;
  state: CombatRoundState;
  updatedAt: string;
}): CombatRoundState {
  const normalized = combatRoundStateSchema.parse(input.state);
  const existing =
    getCombatRoundPhaseResolutionResultForAttack({
      attackResult: input.attackResult,
      state: normalized,
    }) ??
    buildCombatRoundPhaseResolutionResult({
      attackResult: input.attackResult,
      roundNumber: normalized.roundNumber,
      updatedAt: input.updatedAt,
    });
  const nextResult = combatRoundPhaseResolutionResultSchema.parse({
    ...existing,
    criticalRoll: {
      status: "not_required",
    },
    damageProposal: {
      committedCombatEffectIds: [],
      proposedEffects: [],
      status: "not_ready",
    },
    damageRoll:
      input.attackResult.hit && input.parryResolution.success !== true
        ? {
            notes: "Parry resolved unsuccessfully. Damage roll is pending.",
            status: "pending",
          }
        : {
            notes: input.attackResult.hit
              ? "Parry resolved successfully. Damage is not required."
              : undefined,
            status: "not_required",
          },
    damageResult: undefined,
    hitLocationRoll:
      input.attackResult.hit && input.parryResolution.success !== true
        ? existing.hitLocationRoll
        : {
            status: "pending",
          },
    parryResolution: input.parryResolution,
    updatedAt: input.updatedAt,
  });

  return upsertCombatRoundPhaseResolutionResults({
    results: [nextResult],
    state: normalized,
  });
}

function getCombatRoundParryCommandAfterCursor(input: {
  attackResult: CombatRoundAttackRollResult;
  parryResolution: CombatRoundParryResolution;
  state: CombatRoundState;
}): CombatRoundCursor {
  if (input.parryResolution.success === true) {
    return getCombatRoundPhaseActionOrCompletionCursor({
      phase: input.attackResult.phase,
      state: input.state,
    });
  }

  return combatRoundCursorSchema.parse({
    participantId: input.attackResult.defenderParticipantId,
    roundNumber: input.state.roundNumber,
    step: getCombatRoundDamageCursorStepForPhase(input.attackResult.phase),
  });
}

function recordCombatRoundParryCommand(input: {
  attackResult: CombatRoundAttackRollResult;
  command: {
    commandId?: string;
    createdAt: string;
    createdByUserId?: string;
  };
  parryResolution: CombatRoundParryResolution;
  state: CombatRoundState;
}): CombatRoundState {
  const normalized = combatRoundStateSchema.parse(input.state);
  const beforeCursor = combatRoundCursorSchema.parse({
    participantId: input.attackResult.defenderParticipantId,
    roundNumber: normalized.roundNumber,
    step: getCombatRoundParryCursorStepForPhase(input.attackResult.phase),
  });
  const afterCursor = getCombatRoundParryCommandAfterCursor({
    attackResult: input.attackResult,
    parryResolution: input.parryResolution,
    state: normalized,
  });
  const commandType = "roll_parry" satisfies CombatRoundCommandType;
  const command = combatRoundCommandSchema.parse({
    afterCursor,
    beforeCursor,
    createdAt: input.command.createdAt,
    createdByUserId: input.command.createdByUserId,
    facts: {
      attackResultId: getCombatRoundAttackResultId({
        result: input.attackResult,
        roundNumber: normalized.roundNumber,
      }),
      attackerParticipantId: input.attackResult.attackerParticipantId,
      defenderParticipantId: input.attackResult.defenderParticipantId,
      success: input.parryResolution.success === true,
      ...(afterCursor.participantId
        ? {
            nextStepOpened: {
              participantId: afterCursor.participantId,
              step: afterCursor.step,
            },
          }
        : {}),
    },
    id:
      input.command.commandId ??
      buildCombatRoundCommandId({
        createdAt: input.command.createdAt,
        participantId: input.attackResult.defenderParticipantId,
        state: normalized,
        type: commandType,
      }),
    participantId: input.attackResult.defenderParticipantId,
    phase: input.attackResult.phase,
    roundNumber: normalized.roundNumber,
    step: beforeCursor.step,
    type: commandType,
  });
  const selectedStep = getCombatRoundStepForCursorStep(command.afterCursor.step);

  return {
    ...normalized,
    commands: [...normalized.commands, command],
    currentCursor: command.afterCursor,
    currentStep: selectedStep,
    selectedParticipantId: command.afterCursor.participantId ?? normalized.selectedParticipantId,
    selectedStep,
  };
}

export function recordCombatRoundParryResult(input: {
  attackResult: CombatRoundAttackRollResult;
  command?: {
    commandId?: string;
    createdAt: string;
    createdByUserId?: string;
  };
  parryResolution: CombatRoundParryResolution;
  state: CombatRoundState;
  submittedBy: "gm" | "player";
  updatedAt: string;
}): CombatRoundState {
  const phase = input.attackResult.phase;
  const withParry = recordCombatRoundParryResolution({
    attackResult: input.attackResult,
    parryResolution: input.parryResolution,
    state: input.state,
    updatedAt: input.updatedAt,
  });
  const nextRoundState =
    input.parryResolution.success === true
      ? completeCombatRoundPhaseResolutionForParticipant({
          participantId: input.attackResult.attackerParticipantId,
          phase,
          state: withParry,
          submittedBy: input.submittedBy,
          updatedAt: input.updatedAt,
        })
      : advanceCombatRoundPhaseResolutionSubstepForParticipant({
          participantId: input.attackResult.attackerParticipantId,
          phase,
          state: withParry,
          updatedAt: input.updatedAt,
        });
  const defenderOwnedNextRoundState =
    input.parryResolution.success === true
      ? nextRoundState
      : {
          ...nextRoundState,
          phaseResolutionCursor: {
            participantId: input.attackResult.defenderParticipantId,
            phase,
            substep: "damage" as const,
          },
          selectedParticipantId: input.attackResult.defenderParticipantId,
          selectedStep: getCombatRoundDamageReviewStepForPhase(phase),
        };

  return input.command
    ? recordCombatRoundParryCommand({
        attackResult: input.attackResult,
        command: input.command,
        parryResolution: input.parryResolution,
        state: defenderOwnedNextRoundState,
      })
    : defenderOwnedNextRoundState;
}

export function getCombatRoundDamageResultId(input: { attackResultId: string }): string {
  return `${input.attackResultId}:damage`;
}

function rollCombatDamageDie(input: { rng: () => number; sides: number }): number {
  if (!Number.isInteger(input.sides) || input.sides < 1) {
    throw new RangeError("Combat damage die must have at least one side.");
  }

  return Math.min(input.sides, Math.floor(input.rng() * input.sides) + 1);
}

function rollClosedCombatD20(rng: () => number): number {
  return Math.min(20, Math.floor(rng() * 20) + 1);
}

function rollClosedCombatD8(rng: () => number): number {
  return Math.min(8, Math.floor(rng() * 8) + 1);
}

function buildCombatRoundHitLocationRollResult(input: {
  attackResult: CombatRoundAttackRollResult;
  hitLocationRolls?: number[];
  rng?: () => number;
  rolledAt: string;
  rolledByParticipantId: string;
  rolledByUserId?: string;
  roundNumber: number;
  targetLocation?: CombatRoundDamageResult["targetLocation"];
}): CombatRoundHitLocationRollResult {
  const rng = input.rng ?? Math.random;
  const targetedLocation = Boolean(input.targetLocation && input.targetLocation !== "none");
  const rollA = input.hitLocationRolls?.[0] ?? rollClosedCombatD20(rng);
  const rollB = targetedLocation
    ? (input.hitLocationRolls?.[1] ?? rollClosedCombatD20(rng))
    : undefined;
  const hitLocationSelection = resolveHitLocationSelection({
    rollA,
    rollB,
    targetLocation: input.targetLocation,
  });

  return combatRoundHitLocationRollResultSchema.parse({
    attackResultId: getCombatRoundAttackResultId({
      result: input.attackResult,
      roundNumber: input.roundNumber,
    }),
    attackerParticipantId: input.attackResult.attackerParticipantId,
    defenderParticipantId: input.attackResult.defenderParticipantId,
    hitLocationRolls: hitLocationSelection.hitLocationRolls,
    rolledAt: input.rolledAt,
    rolledByParticipantId: input.rolledByParticipantId,
    rolledByUserId: input.rolledByUserId,
    selectedHitLocation: hitLocationSelection.selectedHitLocation,
    selectedHitLocationRoll: hitLocationSelection.selectedHitLocationRoll,
    selectionReason: hitLocationSelection.hitLocationSelectionReason,
    status: "rolled",
    targetLocation: hitLocationSelection.targetLocation,
  });
}

function getHitLocationSelectionFromRoll(
  locationRoll: CombatRoundHitLocationRollResult,
): HitLocationSelection {
  if (
    locationRoll.status !== "rolled" ||
    !locationRoll.selectedHitLocation ||
    !locationRoll.selectedHitLocationRoll ||
    !locationRoll.selectionReason
  ) {
    throw new RangeError("Hit location roll required before resolving damage.");
  }

  return {
    hitLocationRolls: locationRoll.hitLocationRolls,
    hitLocationSelectionReason: locationRoll.selectionReason,
    selectedHitLocation: locationRoll.selectedHitLocation,
    selectedHitLocationRoll: locationRoll.selectedHitLocationRoll,
    targetLocation: locationRoll.targetLocation,
  };
}

function buildCombatRoundCriticalRollResult(input: {
  attackResult: CombatRoundAttackRollResult;
  armorCriticalModifier?: number;
  criticalDice?: [number, number];
  criticalGrade: string;
  rng?: () => number;
  rolledAt: string;
  rolledByParticipantId: string;
  rolledByUserId?: string;
  roundNumber: number;
  selectedHitLocation?: HitLocation;
}): CombatRoundCriticalRollResult {
  const rng = input.rng ?? Math.random;
  const dieA = input.criticalDice?.[0] ?? rollClosedCombatD8(rng);
  const dieB = input.criticalDice?.[1] ?? rollClosedCombatD8(rng);
  const criticalMetadata = lookupCombatCriticalModifier(input.criticalGrade);
  const armorCriticalModifier = input.armorCriticalModifier ?? 0;
  const criticalDiceTotal = dieA + dieB;

  return combatRoundCriticalRollResultSchema.parse({
    armorCriticalModifier,
    attackResultId: getCombatRoundAttackResultId({
      result: input.attackResult,
      roundNumber: input.roundNumber,
    }),
    attackerParticipantId: input.attackResult.attackerParticipantId,
    criticalDice: [dieA, dieB],
    criticalDiceTotal,
    criticalGrade: criticalMetadata.criticalGrade,
    criticalTypeModifier: criticalMetadata.criticalTypeModifier,
    defenderParticipantId: input.attackResult.defenderParticipantId,
    finalCriticalRoll:
      criticalDiceTotal + criticalMetadata.criticalTypeModifier + armorCriticalModifier,
    rolledAt: input.rolledAt,
    rolledByParticipantId: input.rolledByParticipantId,
    rolledByUserId: input.rolledByUserId,
    selectedHitLocation: input.selectedHitLocation,
    status: "rolled",
  });
}

function calculateCombatRoundDamageLookupTotal(input: {
  defenderDm: number;
  dmb: number;
  hitLookupTotal: number;
}): number {
  return input.hitLookupTotal + input.dmb + input.defenderDm;
}

function getCombatRoundDamageMetadataForLookup(damageLookupTotal: number) {
  const damageMetadata = lookupCombatToHitDamageMetadata(damageLookupTotal);
  if (!damageMetadata) {
    throw new RangeError(
      `Combat To Hit damage lookup total ${damageLookupTotal} does not produce damage.`,
    );
  }

  return damageMetadata;
}

function combatRoundReviewHasOwnField(
  review: CombatRoundDamageReview | undefined,
  field: keyof CombatRoundDamageReview,
): boolean {
  return Boolean(review && Object.prototype.hasOwnProperty.call(review, field));
}

function hasCombatRoundDamageReviewOverrides(review: CombatRoundDamageReview | undefined): boolean {
  return Boolean(
    review &&
    (review.armorModifierOverride !== undefined ||
      review.attackDirectionOverride !== undefined ||
      review.armorCriticalModifierOverride !== undefined ||
      (review.additionalEffects?.length ?? 0) > 0 ||
      review.criticalLocationOverride !== undefined ||
      review.criticalTypeModifierOverride !== undefined ||
      review.finalCriticalRollOverride !== undefined ||
      review.selectedHitLocationOverride !== undefined ||
      review.totalDamageOverride !== undefined ||
      combatRoundReviewHasOwnField(review, "criticalGradeOverride") ||
      Boolean(review.notes?.trim())),
  );
}

function getCombatRoundReviewedCriticalGrade(input: {
  computedCriticalGrade?: string;
  review?: CombatRoundDamageReview;
  tableCriticalGrade?: string;
}): string | undefined {
  if (combatRoundReviewHasOwnField(input.review, "criticalGradeOverride")) {
    return input.review?.criticalGradeOverride ?? undefined;
  }

  return input.tableCriticalGrade ?? input.computedCriticalGrade;
}

function getCombatRoundCriticalMinimumTotalDamage(review?: CombatRoundDamageReview): {
  minDamageReason?: string;
  minTotalDamage?: number;
} {
  let minTotalDamage = review?.criticalEffectProposal?.minTotalDamage;
  let minDamageReason = review?.criticalEffectProposal?.minDamageReason;

  for (const effect of review?.additionalEffects ?? []) {
    if (effect.minTotalDamage === undefined) {
      continue;
    }

    if (minTotalDamage === undefined || effect.minTotalDamage > minTotalDamage) {
      minTotalDamage = effect.minTotalDamage;
      minDamageReason = effect.minDamageReason;
    }
  }

  return {
    minDamageReason,
    minTotalDamage,
  };
}

function getCombatRoundMaxDamageCap(input: {
  attackerStrengthGm?: number;
  maxDamageNote?: string;
}): number | undefined {
  if (
    input.maxDamageNote !== COMBAT_ROUND_STRENGTH_GM_MAX_DAMAGE_NOTE ||
    input.attackerStrengthGm === undefined
  ) {
    return undefined;
  }

  return 17 + input.attackerStrengthGm;
}

function applyCombatRoundMaxDamageCap(input: { maxDamageCap?: number; rawTotalDamage: number }): {
  cappedTotalDamage?: number;
  maxDamageApplied: boolean;
  totalDamage: number;
} {
  if (input.maxDamageCap === undefined) {
    return {
      maxDamageApplied: false,
      totalDamage: input.rawTotalDamage,
    };
  }

  const cappedTotalDamage = Math.min(input.rawTotalDamage, input.maxDamageCap);

  return {
    cappedTotalDamage,
    maxDamageApplied: input.rawTotalDamage > input.maxDamageCap,
    totalDamage: cappedTotalDamage,
  };
}

export function mapHitLocationAndDirectionToArmorRegion(input: {
  direction: CombatRoundAttackDirection;
  hitLocation: HitLocation;
}): {
  armorRegion: CombatRoundArmorRegion;
  armorRegionLabel: string;
  note?: string;
} {
  const { direction, hitLocation } = input;

  switch (hitLocation) {
    case "head":
      return { armorRegion: "head", armorRegionLabel: COMBAT_ROUND_ARMOR_REGION_LABELS.head };
    case "chest":
      return { armorRegion: "chest", armorRegionLabel: COMBAT_ROUND_ARMOR_REGION_LABELS.chest };
    case "abdomen":
      return {
        armorRegion: "abdomen",
        armorRegionLabel: COMBAT_ROUND_ARMOR_REGION_LABELS.abdomen,
      };
    case "leftArm":
    case "rightArm":
      return direction === "front"
        ? {
            armorRegion: "frontArm",
            armorRegionLabel: COMBAT_ROUND_ARMOR_REGION_LABELS.frontArm,
          }
        : {
            armorRegion: "backArm",
            armorRegionLabel: COMBAT_ROUND_ARMOR_REGION_LABELS.backArm,
          };
    case "upperLeftLeg":
    case "upperRightLeg":
      return direction === "front"
        ? {
            armorRegion: "frontThigh",
            armorRegionLabel: COMBAT_ROUND_ARMOR_REGION_LABELS.frontThigh,
          }
        : {
            armorRegion: "backThigh",
            armorRegionLabel: COMBAT_ROUND_ARMOR_REGION_LABELS.backThigh,
          };
    case "lowerLeftLeg":
    case "lowerRightLeg":
      return direction === "front"
        ? {
            armorRegion: "frontFoot",
            armorRegionLabel: COMBAT_ROUND_ARMOR_REGION_LABELS.frontFoot,
          }
        : {
            armorRegion: "backFoot",
            armorRegionLabel: COMBAT_ROUND_ARMOR_REGION_LABELS.backFoot,
          };
    case "leftLeg":
    case "rightLeg":
      return direction === "front"
        ? {
            armorRegion: "frontThigh",
            armorRegionLabel: COMBAT_ROUND_ARMOR_REGION_LABELS.frontThigh,
            note: "Legacy whole-leg hit mapped to front thigh; review as upper or lower leg when critical or armor precision matters.",
          }
        : {
            armorRegion: "backThigh",
            armorRegionLabel: COMBAT_ROUND_ARMOR_REGION_LABELS.backThigh,
            note: "Legacy whole-leg hit mapped to back thigh; review as upper or lower leg when critical or armor precision matters.",
          };
  }
}

export function parseCombatRoundArmorCoverageLabel(value: string | undefined | null): {
  armorClass?: CombatArmorModifierClass;
  armorValue?: number;
} {
  if (!value) {
    return {};
  }

  const match = value.trim().match(/^(\d+)\s*([A-E])?$/i);
  if (!match) {
    return {};
  }

  const armorValue = Number(match[1]);
  const armorClass = normalizeCombatArmorModifierClass(match[2]);

  return {
    armorClass,
    armorValue: Number.isFinite(armorValue) ? armorValue : undefined,
  };
}

function formatCombatRoundArmorCoverageLabel(input: {
  armorClass?: CombatArmorModifierClass;
  armorValue?: number;
}): string | undefined {
  if (input.armorValue === undefined) {
    return undefined;
  }

  return `${input.armorValue}${input.armorClass ?? ""}`;
}

function resolveCombatRoundArmorContext(input: {
  armorCoverage?: CombatRoundDamageArmorCoverage;
  attackDirection: CombatRoundAttackDirection;
  selectedHitLocation?: HitLocation;
  weaponArmorClass?: CombatArmorModifierClass;
}): {
  armorClass?: CombatArmorModifierClass;
  armorCoverageLabel?: string;
  armorDamageModifier: number;
  armorModifierSource: CombatRoundDamageResult["armorModifierSource"];
  armorRegion?: CombatRoundArmorRegion;
  armorRegionLabel?: string;
  armorValue: number;
  armorWarnings: string[];
  weaponArmorClass?: CombatArmorModifierClass;
} {
  const armorCoverage = combatRoundDamageArmorCoverageSchema.parse(input.armorCoverage);
  const warnings: string[] = [];

  if (!input.selectedHitLocation) {
    warnings.push("Hit location is missing; armor was not applied.");
    return {
      armorDamageModifier: 0,
      armorModifierSource: {
        label: "Armor not applied",
        reason: "Hit location is missing.",
        status: "not_applied",
      },
      armorValue: 0,
      armorWarnings: warnings,
      weaponArmorClass: input.weaponArmorClass,
    };
  }

  const mapping = mapHitLocationAndDirectionToArmorRegion({
    direction: input.attackDirection,
    hitLocation: input.selectedHitLocation,
  });
  if (mapping.note) {
    warnings.push(mapping.note);
  }

  const coverage = armorCoverage[mapping.armorRegion];
  const parsedCoverage = parseCombatRoundArmorCoverageLabel(coverage?.coverageLabel);
  const armorValue = coverage?.value ?? parsedCoverage.armorValue ?? 0;
  const armorClass = coverage?.armorClass ?? parsedCoverage.armorClass ?? "A";
  const armorCoverageLabel =
    coverage?.coverageLabel ??
    formatCombatRoundArmorCoverageLabel({ armorClass, armorValue }) ??
    `${armorValue}${armorClass}`;

  if (!coverage) {
    warnings.push(`${mapping.armorRegionLabel} armor coverage was not available; using 0A.`);
  }

  if (!input.weaponArmorClass) {
    warnings.push("Weapon armor class was not available; armor table modifier is 0.");
  }

  const armorDamageModifier = input.weaponArmorClass
    ? lookupCombatArmorModifier({
        armorClass,
        weaponArmorClass: input.weaponArmorClass,
      })
    : 0;
  const label = `${mapping.armorRegionLabel.toLowerCase()}/${input.attackDirection} ${armorCoverageLabel}`;

  return {
    armorClass,
    armorCoverageLabel,
    armorDamageModifier,
    armorModifierSource: {
      armorClass,
      label,
      reason: coverage
        ? undefined
        : `${mapping.armorRegionLabel} armor coverage was not available; using 0A.`,
      status: coverage ? "applied" : "not_applied",
      weaponArmorClass: input.weaponArmorClass,
    },
    armorRegion: mapping.armorRegion,
    armorRegionLabel: mapping.armorRegionLabel,
    armorValue,
    armorWarnings: warnings,
    weaponArmorClass: input.weaponArmorClass,
  };
}

function calculateCombatRoundArmorAdjustedDamage(input: {
  armorDamageModifier: number;
  armorValue: number;
  tableDamage: number;
  tableMinDamage?: number;
}): {
  minimumDamageAfterArmor?: number;
  minimumDamageBeforeArmor?: number;
  provisionalDamageAfterArmor: number;
  rawTotalDamage: number;
} {
  const provisionalDamageAfterArmor =
    input.tableDamage - input.armorValue + input.armorDamageModifier;
  const minimumDamageAfterArmor =
    input.tableMinDamage === undefined
      ? undefined
      : Math.max(0, input.tableMinDamage + input.armorDamageModifier);
  const rawTotalDamage = Math.max(provisionalDamageAfterArmor, minimumDamageAfterArmor ?? 0, 0);

  return {
    minimumDamageAfterArmor,
    minimumDamageBeforeArmor: input.tableMinDamage,
    provisionalDamageAfterArmor,
    rawTotalDamage,
  };
}

export function getCombatRoundEffectiveDamageResult(
  damageResult: CombatRoundDamageResult,
): CombatRoundEffectiveDamageResult {
  const computedArmorModifier = damageResult.armorModifier ?? 0;
  const computedAttackDirection = damageResult.attackDirection;
  const effectiveAttackDirection =
    damageResult.review?.attackDirectionOverride ?? computedAttackDirection;
  const computedSelectedHitLocation = damageResult.selectedHitLocation;
  const effectiveSelectedHitLocation =
    damageResult.review?.selectedHitLocationOverride ?? computedSelectedHitLocation;
  const hitLookupTotal = damageResult.hitLookupTotal ?? damageResult.lookupTotal;
  const hasTotalDamageOverride = damageResult.review?.totalDamageOverride !== undefined;
  const computedDamageRoll = damageResult.damageRoll;
  const armorContext = resolveCombatRoundArmorContext({
    armorCoverage: damageResult.armorCoverage,
    attackDirection: effectiveAttackDirection,
    selectedHitLocation: effectiveSelectedHitLocation,
    weaponArmorClass: damageResult.weaponArmorClass,
  });
  const computedArmorContext = {
    armorDamageModifier: damageResult.armorDamageModifier ?? computedArmorModifier,
    armorValue: damageResult.armorValue ?? 0,
    minimumDamageAfterArmor: damageResult.minimumDamageAfterArmor,
    provisionalDamageAfterArmor: damageResult.provisionalDamageAfterArmor,
  };
  const effectiveArmorModifier =
    damageResult.review?.armorModifierOverride ?? armorContext.armorDamageModifier;
  let effectiveDamageLookupTotal = damageResult.damageLookupTotal;
  let effectiveTableDamage = damageResult.tableDamage ?? damageResult.tableDamageModifier;
  let effectiveCriticalGrade = getCombatRoundReviewedCriticalGrade({
    computedCriticalGrade: damageResult.criticalGrade,
    review: damageResult.review,
  });
  let effectiveMaxDamageNote = damageResult.maxDamageNote;
  let effectiveMinDamage = damageResult.minDamage;
  let effectiveMinimumDamageAfterArmor = damageResult.minimumDamageAfterArmor;
  let effectiveProvisionalDamageAfterArmor = damageResult.provisionalDamageAfterArmor;
  let effectiveDamageRoll: CombatRoundDamageResult["damageRoll"] = computedDamageRoll;
  let effectiveRawTotalDamage =
    damageResult.review?.totalDamageOverride ??
    damageResult.rawTotalDamage ??
    damageResult.totalDamage;
  let requiresTotalDamageOverride = false;
  const computedMaxDamageCap =
    damageResult.maxDamageCap ??
    getCombatRoundMaxDamageCap({
      attackerStrengthGm: damageResult.attackerStrengthGm,
      maxDamageNote: damageResult.maxDamageNote,
    });
  const computedCappedDamage = applyCombatRoundMaxDamageCap({
    maxDamageCap: computedMaxDamageCap,
    rawTotalDamage: damageResult.rawTotalDamage ?? damageResult.totalDamage,
  });

  if (hitLookupTotal !== undefined) {
    if (damageResult.grazing) {
      const grazingReferenceHitLookupTotal = 12;
      effectiveDamageLookupTotal = calculateCombatRoundDamageLookupTotal({
        defenderDm: damageResult.defenderDm,
        dmb: damageResult.dmb,
        hitLookupTotal: grazingReferenceHitLookupTotal,
      });
      const metadata = getCombatRoundDamageMetadataForLookup(effectiveDamageLookupTotal);
      effectiveTableDamage = metadata.damage;
      effectiveMaxDamageNote = metadata.maxDamageNote;
      effectiveMinDamage = metadata.minDamage;
      effectiveCriticalGrade = getCombatRoundReviewedCriticalGrade({
        computedCriticalGrade: damageResult.criticalGrade,
        review: damageResult.review,
        tableCriticalGrade: undefined,
      });

      const referenceTableDamage = metadata.damage;
      const dieSides = Math.max(1, referenceTableDamage);
      const existingRoll =
        computedDamageRoll.rolls?.[0] ?? computedDamageRoll.total ?? damageResult.totalDamage;
      const canKeepExistingRoll =
        Number.isInteger(existingRoll) && existingRoll >= 1 && existingRoll <= dieSides;
      requiresTotalDamageOverride = !hasTotalDamageOverride && !canKeepExistingRoll;
      const rawGrazingDamage =
        canKeepExistingRoll && !hasTotalDamageOverride ? existingRoll : computedDamageRoll.total;
      const adjustedGrazingDamage =
        rawGrazingDamage !== undefined
          ? calculateCombatRoundArmorAdjustedDamage({
              armorDamageModifier: effectiveArmorModifier,
              armorValue: armorContext.armorValue,
              tableDamage: rawGrazingDamage,
              tableMinDamage: metadata.minDamage,
            })
          : undefined;
      effectiveMinimumDamageAfterArmor = adjustedGrazingDamage?.minimumDamageAfterArmor;
      effectiveProvisionalDamageAfterArmor = adjustedGrazingDamage?.provisionalDamageAfterArmor;
      effectiveRawTotalDamage = hasTotalDamageOverride
        ? (damageResult.review?.totalDamageOverride ?? 0)
        : (adjustedGrazingDamage?.rawTotalDamage ?? damageResult.totalDamage);
      effectiveDamageRoll = {
        derivedFromLookupTotal: grazingReferenceHitLookupTotal,
        derivedNormalDamageTotal: referenceTableDamage,
        diceExpression: `1d${dieSides}`,
        grazingDieSides: dieSides,
        grazingReferenceDamage: referenceTableDamage,
        grazingReferenceDamageLookupTotal: effectiveDamageLookupTotal,
        grazingReferenceHitLookupTotal,
        grazingReferenceTableDamage: referenceTableDamage,
        rawGrazingDamage,
        required: true,
        rolls: canKeepExistingRoll && !hasTotalDamageOverride ? [existingRoll] : undefined,
        total: hasTotalDamageOverride ? rawGrazingDamage : existingRoll,
      };
    } else {
      effectiveDamageLookupTotal = calculateCombatRoundDamageLookupTotal({
        defenderDm: damageResult.defenderDm,
        dmb: damageResult.dmb,
        hitLookupTotal,
      });
      const metadata = getCombatRoundDamageMetadataForLookup(effectiveDamageLookupTotal);
      effectiveTableDamage = metadata.damage;
      effectiveMaxDamageNote = metadata.maxDamageNote;
      effectiveMinDamage = metadata.minDamage;
      effectiveCriticalGrade = getCombatRoundReviewedCriticalGrade({
        computedCriticalGrade: damageResult.criticalGrade,
        review: damageResult.review,
        tableCriticalGrade: metadata.criticalGrade,
      });
      const adjustedDamage = calculateCombatRoundArmorAdjustedDamage({
        armorDamageModifier: effectiveArmorModifier,
        armorValue: armorContext.armorValue,
        tableDamage: metadata.damage,
        tableMinDamage: metadata.minDamage,
      });
      effectiveMinimumDamageAfterArmor = adjustedDamage.minimumDamageAfterArmor;
      effectiveProvisionalDamageAfterArmor = adjustedDamage.provisionalDamageAfterArmor;
      effectiveRawTotalDamage =
        damageResult.review?.totalDamageOverride ?? adjustedDamage.rawTotalDamage;
      effectiveDamageRoll = {
        required: false,
      };
    }
  }

  const effectiveMaxDamageCap = getCombatRoundMaxDamageCap({
    attackerStrengthGm: damageResult.attackerStrengthGm,
    maxDamageNote: effectiveMaxDamageNote,
  });
  const effectiveCappedDamage = applyCombatRoundMaxDamageCap({
    maxDamageCap: effectiveMaxDamageCap,
    rawTotalDamage: effectiveRawTotalDamage,
  });
  const preCriticalEffectiveDamage = hasTotalDamageOverride
    ? effectiveRawTotalDamage
    : effectiveCappedDamage.totalDamage;
  const criticalMinimum = getCombatRoundCriticalMinimumTotalDamage(damageResult.review);
  const criticalMinTotalDamage = criticalMinimum.minTotalDamage;
  const criticalMinApplied =
    !hasTotalDamageOverride &&
    criticalMinTotalDamage !== undefined &&
    criticalMinTotalDamage > preCriticalEffectiveDamage;
  const criticalMinExtra = criticalMinApplied
    ? criticalMinTotalDamage - preCriticalEffectiveDamage
    : undefined;
  const effectiveTotalDamage = criticalMinApplied
    ? criticalMinTotalDamage
    : preCriticalEffectiveDamage;
  const effectiveCappedTotalDamage = hasTotalDamageOverride
    ? undefined
    : effectiveCappedDamage.cappedTotalDamage;
  const effectiveMaxDamageApplied = hasTotalDamageOverride
    ? false
    : effectiveCappedDamage.maxDamageApplied;

  return {
    computedArmorModifier,
    computedAttackDirection,
    computedCriticalGrade: damageResult.criticalGrade,
    computedDamageLookupTotal: damageResult.damageLookupTotal,
    computedCappedTotalDamage: computedCappedDamage.cappedTotalDamage,
    computedMaxDamageApplied: computedCappedDamage.maxDamageApplied,
    computedMaxDamageCap,
    computedMaxDamageNote: damageResult.maxDamageNote,
    computedMinDamage: damageResult.minDamage,
    computedMinimumDamageAfterArmor: computedArmorContext.minimumDamageAfterArmor,
    computedProvisionalDamageAfterArmor: computedArmorContext.provisionalDamageAfterArmor,
    computedSelectedHitLocation,
    computedTableDamage: damageResult.tableDamage ?? damageResult.tableDamageModifier,
    computedTotalDamage: damageResult.totalDamage,
    preCriticalEffectiveDamage,
    criticalMinTotalDamage,
    criticalMinApplied,
    criticalMinExtra,
    finalCommittedDamage: effectiveTotalDamage,
    effectiveArmorClass: armorContext.armorClass,
    effectiveArmorCoverageLabel: armorContext.armorCoverageLabel,
    effectiveArmorModifier,
    effectiveArmorRegion: armorContext.armorRegion,
    effectiveArmorRegionLabel: armorContext.armorRegionLabel,
    effectiveArmorValue: armorContext.armorValue,
    effectiveArmorWarnings: armorContext.armorWarnings,
    effectiveAttackDirection,
    effectiveCriticalGrade,
    effectiveDamageLookupTotal,
    effectiveDamageRoll,
    effectiveCappedTotalDamage,
    effectiveMaxDamageApplied,
    effectiveMaxDamageCap,
    effectiveMaxDamageNote,
    effectiveMinDamage,
    effectiveMinimumDamageAfterArmor,
    effectiveProvisionalDamageAfterArmor,
    effectiveRawTotalDamage,
    effectiveSelectedHitLocation,
    effectiveTableDamage,
    effectiveTotalDamage,
    effectiveWeaponArmorClass: armorContext.weaponArmorClass,
    hasReviewOverrides: hasCombatRoundDamageReviewOverrides(damageResult.review),
    requiresTotalDamageOverride,
    review: damageResult.review,
  };
}

export function getCombatRoundEffectiveCriticalRoll(input: {
  criticalRoll?: CombatRoundCriticalRollResult;
  review?: CombatRoundDamageReview;
}): {
  armorCriticalModifier?: number;
  criticalLocation?: HitLocation;
  criticalTypeModifier?: number;
  finalCriticalRoll?: number;
  hasReviewOverrides: boolean;
} {
  const criticalRoll = input.criticalRoll;
  const review = input.review;

  return {
    armorCriticalModifier:
      review?.armorCriticalModifierOverride ?? criticalRoll?.armorCriticalModifier,
    criticalLocation: review?.criticalLocationOverride ?? criticalRoll?.selectedHitLocation,
    criticalTypeModifier:
      review?.criticalTypeModifierOverride ?? criticalRoll?.criticalTypeModifier,
    finalCriticalRoll: review?.finalCriticalRollOverride ?? criticalRoll?.finalCriticalRoll,
    hasReviewOverrides: Boolean(
      review?.armorCriticalModifierOverride !== undefined ||
      review?.criticalLocationOverride !== undefined ||
      review?.criticalTypeModifierOverride !== undefined ||
      review?.finalCriticalRollOverride !== undefined,
    ),
  };
}

export function getCombatRoundDamageSubstate(
  resolution?: CombatRoundPhaseResolutionResult,
): CombatRoundDamageSubstate {
  if (!resolution) {
    return "location_pending";
  }

  if (resolution.damageProposal.status === "committed") {
    return "committed";
  }

  if (resolution.hitLocationRoll.status !== "rolled") {
    return "location_pending";
  }

  if (!resolution.damageResult) {
    return "location_rolled";
  }

  if (resolution.criticalRoll.status === "pending") {
    return "critical_pending";
  }

  if (resolution.criticalRoll.status === "rolled") {
    return "critical_rolled";
  }

  if (resolution.damageProposal.status === "drafted") {
    return "review_ready";
  }

  return "damage_proposal_ready";
}

export function buildCombatRoundDamageResult(input: {
  armorCoverage?: CombatRoundDamageArmorCoverage;
  armorModifier?: number;
  armorModifierSource?: CombatRoundDamageResult["armorModifierSource"];
  attackDirection?: CombatRoundAttackDirection;
  attackerStrengthGm?: number;
  attackResult: CombatRoundAttackRollResult;
  createdAt: string;
  createdByUserId?: string;
  defenderDm: number;
  dmb: number;
  hitLocationSelection: HitLocationSelection;
  rng?: () => number;
  roundNumber: number;
  weaponArmorClass?: CombatArmorModifierClass;
}): CombatRoundDamageResult {
  if (!input.attackResult.hit) {
    throw new RangeError("Damage cannot be resolved for a missed attack.");
  }

  const hitLookupTotal = input.attackResult.lookupTotal;
  const rng = input.rng ?? Math.random;
  const hitLocationSelection = input.hitLocationSelection;
  const attackDirection = input.attackDirection ?? "front";
  const armorContext = resolveCombatRoundArmorContext({
    armorCoverage: input.armorCoverage,
    attackDirection,
    selectedHitLocation: hitLocationSelection.selectedHitLocation,
    weaponArmorClass: input.weaponArmorClass,
  });
  const armorModifier = input.armorModifier ?? armorContext.armorDamageModifier;
  const armorModifierSource =
    input.armorModifierSource ??
    (input.armorModifier !== undefined
      ? {
          ...armorContext.armorModifierSource,
          label: armorContext.armorModifierSource.label ?? "Manual armor modifier",
        }
      : armorContext.armorModifierSource);
  const normalDamageLookupTotal = calculateCombatRoundDamageLookupTotal({
    defenderDm: input.defenderDm,
    dmb: input.dmb,
    hitLookupTotal,
  });
  let damageRoll: CombatRoundDamageResult["damageRoll"] = {
    required: false,
  };
  let damageRollTotal = 0;
  let damageLookupTotal = normalDamageLookupTotal;
  let tableDamage: number;
  let criticalGrade: string | undefined;
  let maxDamageNote: string | undefined;
  let minDamage: number | undefined;

  if (input.attackResult.grazing) {
    const grazingReferenceHitLookupTotal = 12;
    const grazingReferenceDamageLookupTotal = calculateCombatRoundDamageLookupTotal({
      defenderDm: input.defenderDm,
      dmb: input.dmb,
      hitLookupTotal: grazingReferenceHitLookupTotal,
    });
    const grazingReferenceDamageMetadata = getCombatRoundDamageMetadataForLookup(
      grazingReferenceDamageLookupTotal,
    );
    const grazingReferenceDamage = grazingReferenceDamageMetadata.damage;
    const dieSides = Math.max(1, grazingReferenceDamage);

    damageRollTotal = rollCombatDamageDie({
      rng,
      sides: dieSides,
    });
    damageLookupTotal = grazingReferenceDamageLookupTotal;
    tableDamage = grazingReferenceDamageMetadata.damage;
    minDamage = grazingReferenceDamageMetadata.minDamage;
    damageRoll = {
      derivedFromLookupTotal: grazingReferenceHitLookupTotal,
      derivedNormalDamageTotal: grazingReferenceDamage,
      diceExpression: `1d${dieSides}`,
      grazingDieSides: dieSides,
      grazingReferenceDamage,
      grazingReferenceDamageLookupTotal,
      grazingReferenceHitLookupTotal,
      grazingReferenceTableDamage: grazingReferenceDamage,
      rawGrazingDamage: damageRollTotal,
      required: true,
      rolls: [damageRollTotal],
      total: damageRollTotal,
    };
  } else {
    const damageMetadata = getCombatRoundDamageMetadataForLookup(normalDamageLookupTotal);
    tableDamage = damageMetadata.damage;
    criticalGrade = damageMetadata.criticalGrade;
    maxDamageNote = damageMetadata.maxDamageNote;
    minDamage = damageMetadata.minDamage;
  }

  const adjustedDamage = input.attackResult.grazing
    ? calculateCombatRoundArmorAdjustedDamage({
        armorDamageModifier: armorModifier,
        armorValue: armorContext.armorValue,
        tableDamage: damageRollTotal,
        tableMinDamage: minDamage,
      })
    : calculateCombatRoundArmorAdjustedDamage({
        armorDamageModifier: armorModifier,
        armorValue: armorContext.armorValue,
        tableDamage,
        tableMinDamage: minDamage,
      });
  const totalDamage = adjustedDamage.rawTotalDamage;
  const maxDamageCap = getCombatRoundMaxDamageCap({
    attackerStrengthGm: input.attackerStrengthGm,
    maxDamageNote,
  });
  const cappedDamage = applyCombatRoundMaxDamageCap({
    maxDamageCap,
    rawTotalDamage: totalDamage,
  });
  const attackResultId = getCombatRoundAttackResultId({
    result: input.attackResult,
    roundNumber: input.roundNumber,
  });

  return combatRoundDamageResultSchema.parse({
    armorAppliesToDamage: true,
    armorAppliesToMinimumDamage: true,
    armorClass: armorContext.armorClass,
    armorCoverage: input.armorCoverage,
    armorCoverageLabel: armorContext.armorCoverageLabel,
    armorDamageModifier: armorModifier,
    armorModifier,
    armorModifierSource,
    armorRegion: armorContext.armorRegion,
    armorRegionLabel: armorContext.armorRegionLabel,
    armorValue: armorContext.armorValue,
    armorWarnings: armorContext.armorWarnings,
    attackDirection,
    attackResultId,
    attackerParticipantId: input.attackResult.attackerParticipantId,
    attackerStrengthGm: input.attackerStrengthGm,
    cappedTotalDamage: cappedDamage.cappedTotalDamage,
    createdAt: input.createdAt,
    createdByUserId: input.createdByUserId,
    criticalGrade,
    damageRoll,
    damageLookupTotal,
    defenderDm: input.defenderDm,
    defenderParticipantId: input.attackResult.defenderParticipantId,
    dmb: input.dmb,
    grazing: input.attackResult.grazing,
    hitLocationRolls: hitLocationSelection.hitLocationRolls,
    hitLocationSelectionReason: hitLocationSelection.hitLocationSelectionReason,
    hitLookupTotal,
    kind: "damage_result",
    maxDamageApplied: cappedDamage.maxDamageApplied,
    maxDamageCap,
    maxDamageNote,
    minDamage,
    parryResultId: `${attackResultId}:parry`,
    phase: input.attackResult.phase,
    selectedHitLocation: hitLocationSelection.selectedHitLocation,
    selectedHitLocationRoll: hitLocationSelection.selectedHitLocationRoll,
    minimumDamageAfterArmor: adjustedDamage.minimumDamageAfterArmor,
    minimumDamageBeforeArmor: adjustedDamage.minimumDamageBeforeArmor,
    provisionalDamageAfterArmor: adjustedDamage.provisionalDamageAfterArmor,
    rawTableDamage: tableDamage,
    tableDamage,
    targetLocation: hitLocationSelection.targetLocation,
    rawTotalDamage: totalDamage,
    totalDamage,
    weaponArmorClass: input.weaponArmorClass,
    weaponName: input.attackResult.weaponName,
  });
}

function recordCombatRoundDamageResolution(input: {
  attackResult: CombatRoundAttackRollResult;
  damageResult: CombatRoundDamageResult;
  state: CombatRoundState;
  updatedAt: string;
}): CombatRoundState {
  const normalized = combatRoundStateSchema.parse(input.state);
  const existing =
    getCombatRoundPhaseResolutionResultForAttack({
      attackResult: input.attackResult,
      state: normalized,
    }) ??
    buildCombatRoundPhaseResolutionResult({
      attackResult: input.attackResult,
      roundNumber: normalized.roundNumber,
      updatedAt: input.updatedAt,
    });
  const nextResult = combatRoundPhaseResolutionResultSchema.parse({
    ...existing,
    criticalRoll: input.damageResult.criticalGrade
      ? {
          status: "pending",
        }
      : {
          status: "not_required",
        },
    damageProposal: {
      committedCombatEffectIds: [],
      proposedEffects: [],
      status: "drafted",
    },
    damageResult: input.damageResult,
    damageRoll: {
      notes: "Damage resolved. Combat Effects are not created yet.",
      status: "rolled",
      total: input.damageResult.totalDamage,
    },
    updatedAt: input.updatedAt,
  });

  return upsertCombatRoundPhaseResolutionResults({
    results: [nextResult],
    state: normalized,
  });
}

function recordCombatRoundResolveDamageCommand(input: {
  attackResult: CombatRoundAttackRollResult;
  command: {
    commandId?: string;
    createdAt: string;
    createdByUserId?: string;
  };
  damageResult: CombatRoundDamageResult;
  state: CombatRoundState;
}): CombatRoundState {
  const normalized = combatRoundStateSchema.parse(input.state);
  const beforeCursor = combatRoundCursorSchema.parse({
    participantId: input.attackResult.defenderParticipantId,
    roundNumber: normalized.roundNumber,
    step: getCombatRoundDamageCursorStepForPhase(input.attackResult.phase),
  });
  const afterCursor = beforeCursor;
  const commandType = "resolve_damage" satisfies CombatRoundCommandType;
  const command = combatRoundCommandSchema.parse({
    afterCursor,
    beforeCursor,
    createdAt: input.command.createdAt,
    createdByUserId: input.command.createdByUserId,
    facts: {
      attackResultId: input.damageResult.attackResultId,
      attackerParticipantId: input.attackResult.attackerParticipantId,
      criticalGrade: input.damageResult.criticalGrade,
      damageResultId: getCombatRoundDamageResultId({
        attackResultId: input.damageResult.attackResultId,
      }),
      defenderParticipantId: input.attackResult.defenderParticipantId,
      hitLocationRolls: input.damageResult.hitLocationRolls,
      hitLocationSelectionReason: input.damageResult.hitLocationSelectionReason,
      selectedHitLocation: input.damageResult.selectedHitLocation,
      selectedHitLocationRoll: input.damageResult.selectedHitLocationRoll,
      targetLocation: input.damageResult.targetLocation,
      armorClass: input.damageResult.armorClass,
      armorCoverageLabel: input.damageResult.armorCoverageLabel,
      armorDamageModifier: input.damageResult.armorDamageModifier,
      armorModifier: input.damageResult.armorModifier,
      armorModifierSource: input.damageResult.armorModifierSource,
      armorRegion: input.damageResult.armorRegion,
      armorRegionLabel: input.damageResult.armorRegionLabel,
      armorValue: input.damageResult.armorValue,
      attackDirection: input.damageResult.attackDirection,
      minimumDamageAfterArmor: input.damageResult.minimumDamageAfterArmor,
      provisionalDamageAfterArmor: input.damageResult.provisionalDamageAfterArmor,
      status: "resolved",
      totalDamage: input.damageResult.totalDamage,
      weaponArmorClass: input.damageResult.weaponArmorClass,
      ...(afterCursor.participantId
        ? {
            nextStepOpened: {
              participantId: afterCursor.participantId,
              step: afterCursor.step,
            },
          }
        : {}),
    },
    id:
      input.command.commandId ??
      buildCombatRoundCommandId({
        createdAt: input.command.createdAt,
        participantId: input.attackResult.defenderParticipantId,
        state: normalized,
        type: commandType,
      }),
    participantId: input.attackResult.defenderParticipantId,
    phase: input.attackResult.phase,
    roundNumber: normalized.roundNumber,
    step: beforeCursor.step,
    type: commandType,
  });
  const selectedStep = getCombatRoundStepForCursorStep(command.afterCursor.step);

  return {
    ...normalized,
    commands: [...normalized.commands, command],
    currentCursor: command.afterCursor,
    currentStep: selectedStep,
    selectedParticipantId: command.afterCursor.participantId ?? normalized.selectedParticipantId,
    selectedStep,
  };
}

function recordCombatRoundHitLocationRollCommand(input: {
  attackResult: CombatRoundAttackRollResult;
  command: {
    commandId?: string;
    createdAt: string;
    createdByUserId?: string;
  };
  hitLocationRoll: CombatRoundHitLocationRollResult;
  state: CombatRoundState;
}): CombatRoundState {
  const normalized = combatRoundStateSchema.parse(input.state);
  const beforeCursor = combatRoundCursorSchema.parse({
    participantId: input.attackResult.defenderParticipantId,
    roundNumber: normalized.roundNumber,
    step: getCombatRoundDamageCursorStepForPhase(input.attackResult.phase),
  });
  const commandType = "roll_hit_location" satisfies CombatRoundCommandType;
  const command = combatRoundCommandSchema.parse({
    afterCursor: beforeCursor,
    beforeCursor,
    createdAt: input.command.createdAt,
    createdByUserId: input.command.createdByUserId,
    facts: {
      attackResultId: input.hitLocationRoll.attackResultId,
      attackerParticipantId: input.attackResult.attackerParticipantId,
      defenderParticipantId: input.attackResult.defenderParticipantId,
      hitLocationRolls: input.hitLocationRoll.hitLocationRolls,
      rolledByParticipantId: input.hitLocationRoll.rolledByParticipantId,
      rollPrivilege: "attacker",
      selectedHitLocation: input.hitLocationRoll.selectedHitLocation,
      selectedHitLocationRoll: input.hitLocationRoll.selectedHitLocationRoll,
      selectionReason: input.hitLocationRoll.selectionReason,
      targetLocation: input.hitLocationRoll.targetLocation,
    },
    id:
      input.command.commandId ??
      buildCombatRoundCommandId({
        createdAt: input.command.createdAt,
        participantId: input.attackResult.defenderParticipantId,
        state: normalized,
        type: commandType,
      }),
    participantId: input.attackResult.defenderParticipantId,
    phase: input.attackResult.phase,
    roundNumber: normalized.roundNumber,
    step: beforeCursor.step,
    type: commandType,
  });
  const selectedStep = getCombatRoundStepForCursorStep(command.afterCursor.step);

  return {
    ...normalized,
    commands: [...normalized.commands, command],
    currentCursor: command.afterCursor,
    currentStep: selectedStep,
    selectedParticipantId: input.attackResult.defenderParticipantId,
    selectedStep,
  };
}

export function recordCombatRoundHitLocationRoll(input: {
  attackResult: CombatRoundAttackRollResult;
  command?: {
    commandId?: string;
    createdAt: string;
    createdByUserId?: string;
  };
  damageProposal?: {
    armorCoverage?: CombatRoundDamageArmorCoverage;
    armorModifier?: number;
    armorModifierSource?: CombatRoundDamageResult["armorModifierSource"];
    attackDirection?: CombatRoundAttackDirection;
    attackerStrengthGm?: number;
    defenderDm: number;
    dmb: number;
    weaponArmorClass?: CombatArmorModifierClass;
  };
  hitLocationRolls?: number[];
  rng?: () => number;
  rolledByParticipantId: string;
  state: CombatRoundState;
  submittedBy: "gm" | "player";
  targetLocation?: CombatRoundDamageResult["targetLocation"];
  updatedAt: string;
}): CombatRoundState {
  const normalized = combatRoundStateSchema.parse(input.state);
  const resolution = getCombatRoundPhaseResolutionResultForAttack({
    attackResult: input.attackResult,
    state: normalized,
  });

  if (!input.attackResult.hit) {
    throw new RangeError("Hit location cannot be rolled for a missed attack.");
  }

  if (
    !resolution ||
    resolution.parryResolution.status !== "resolved" ||
    resolution.parryResolution.success !== false ||
    resolution.damageRoll.status !== "pending" ||
    resolution.damageResult ||
    resolution.hitLocationRoll.status === "rolled"
  ) {
    throw new RangeError("Hit location is not pending for this attack.");
  }

  if (
    input.submittedBy !== "gm" &&
    input.rolledByParticipantId !== input.attackResult.attackerParticipantId
  ) {
    throw new RangeError("Only the attacker can roll hit location.");
  }

  const hitLocationRoll = buildCombatRoundHitLocationRollResult({
    attackResult: input.attackResult,
    hitLocationRolls: input.hitLocationRolls,
    rng: input.rng,
    rolledAt: input.updatedAt,
    rolledByParticipantId: input.rolledByParticipantId,
    rolledByUserId: input.command?.createdByUserId,
    roundNumber: normalized.roundNumber,
    targetLocation: input.targetLocation,
  });
  const damageStep = getCombatRoundDamageReviewStepForPhase(input.attackResult.phase);
  const withLocationRoll = upsertCombatRoundPhaseResolutionResults({
    results: [
      combatRoundPhaseResolutionResultSchema.parse({
        ...resolution,
        hitLocationRoll,
        updatedAt: input.updatedAt,
      }),
    ],
    state: {
      ...normalized,
      currentCursor: {
        participantId: input.attackResult.defenderParticipantId,
        roundNumber: normalized.roundNumber,
        step: getCombatRoundDamageCursorStepForPhase(input.attackResult.phase),
      },
      currentStep: damageStep,
      phaseResolutionCursor: {
        participantId: input.attackResult.defenderParticipantId,
        phase: input.attackResult.phase,
        substep: "damage",
      },
      selectedParticipantId: input.attackResult.defenderParticipantId,
      selectedStep: damageStep,
    },
  });
  const withReadyDamage = setCombatRoundParticipantStepStatus({
    participantId: input.attackResult.defenderParticipantId,
    state: withLocationRoll,
    status: "ready",
    step: damageStep,
  });

  const withLocationCommand = input.command
    ? recordCombatRoundHitLocationRollCommand({
        attackResult: input.attackResult,
        command: input.command,
        hitLocationRoll,
        state: withReadyDamage,
      })
    : withReadyDamage;

  if (!input.damageProposal) {
    return withLocationCommand;
  }

  return recordCombatRoundDamageResult({
    armorCoverage: input.damageProposal.armorCoverage,
    armorModifier: input.damageProposal.armorModifier,
    armorModifierSource: input.damageProposal.armorModifierSource,
    attackDirection: input.damageProposal.attackDirection,
    attackerStrengthGm: input.damageProposal.attackerStrengthGm,
    attackResult: input.attackResult,
    command: input.command,
    defenderDm: input.damageProposal.defenderDm,
    dmb: input.damageProposal.dmb,
    rng: input.rng,
    state: withLocationCommand,
    submittedBy: input.submittedBy,
    updatedAt: input.updatedAt,
    weaponArmorClass: input.damageProposal.weaponArmorClass,
  });
}

export function recordCombatRoundDamageResult(input: {
  armorCoverage?: CombatRoundDamageArmorCoverage;
  armorModifier?: number;
  armorModifierSource?: CombatRoundDamageResult["armorModifierSource"];
  attackDirection?: CombatRoundAttackDirection;
  attackerStrengthGm?: number;
  attackResult: CombatRoundAttackRollResult;
  command?: {
    commandId?: string;
    createdAt: string;
    createdByUserId?: string;
  };
  defenderDm: number;
  dmb: number;
  rng?: () => number;
  state: CombatRoundState;
  submittedBy: "gm" | "player";
  updatedAt: string;
  weaponArmorClass?: CombatArmorModifierClass;
}): CombatRoundState {
  const normalized = combatRoundStateSchema.parse(input.state);
  const resolution = getCombatRoundPhaseResolutionResultForAttack({
    attackResult: input.attackResult,
    state: normalized,
  });

  if (!input.attackResult.hit) {
    throw new RangeError("Damage cannot be resolved for a missed attack.");
  }

  if (
    !resolution ||
    resolution.parryResolution.status !== "resolved" ||
    resolution.parryResolution.success !== false ||
    resolution.damageRoll.status !== "pending"
  ) {
    throw new RangeError("Damage is not pending for this attack.");
  }

  if (resolution.hitLocationRoll.status !== "rolled") {
    throw new RangeError("Hit location roll required before resolving damage.");
  }

  const damageResult = buildCombatRoundDamageResult({
    armorCoverage: input.armorCoverage,
    armorModifier: input.armorModifier,
    armorModifierSource: input.armorModifierSource,
    attackDirection: input.attackDirection,
    attackerStrengthGm: input.attackerStrengthGm,
    attackResult: input.attackResult,
    createdAt: input.updatedAt,
    createdByUserId: input.command?.createdByUserId,
    defenderDm: input.defenderDm,
    dmb: input.dmb,
    hitLocationSelection: getHitLocationSelectionFromRoll(resolution.hitLocationRoll),
    rng: input.rng,
    roundNumber: normalized.roundNumber,
    weaponArmorClass: input.weaponArmorClass,
  });
  const withDamageResult = recordCombatRoundDamageResolution({
    attackResult: input.attackResult,
    damageResult,
    state: normalized,
    updatedAt: input.updatedAt,
  });
  const damageStep = getCombatRoundDamageReviewStepForPhase(input.attackResult.phase);
  const withDraftedReview = setCombatRoundParticipantStepStatus({
    participantId: input.attackResult.defenderParticipantId,
    state: {
      ...withDamageResult,
      currentCursor: {
        participantId: input.attackResult.defenderParticipantId,
        roundNumber: normalized.roundNumber,
        step: getCombatRoundDamageCursorStepForPhase(input.attackResult.phase),
      },
      currentStep: damageStep,
      phaseResolutionCursor: {
        participantId: input.attackResult.defenderParticipantId,
        phase: input.attackResult.phase,
        substep: "damage",
      },
      selectedParticipantId: input.attackResult.defenderParticipantId,
      selectedStep: damageStep,
    },
    status: "ready",
    step: damageStep,
  });

  return input.command
    ? recordCombatRoundResolveDamageCommand({
        attackResult: input.attackResult,
        command: input.command,
        damageResult,
        state: withDraftedReview,
      })
    : withDraftedReview;
}

export function reviewCombatRoundDamageResult(input: {
  attackResultId: string;
  reviewedAt: string;
  reviewedByUserId?: string;
  review: Omit<CombatRoundDamageReview, "reviewedAt" | "reviewedByUserId">;
  state: CombatRoundState;
}): CombatRoundState {
  const normalized = combatRoundStateSchema.parse(input.state);
  const nextReview = combatRoundDamageResultSchema.shape.review.unwrap().parse({
    ...input.review,
    reviewedAt: input.reviewedAt,
    reviewedByUserId: input.reviewedByUserId,
  });
  const nextResults = normalized.phaseResolutionResults.map((result) => {
    if (result.attackResultId !== input.attackResultId || !result.damageResult) {
      return result;
    }

    const attackResult = getCombatRoundAttackResultById({
      attackResultId: result.attackResultId,
      state: normalized,
    });
    const review =
      result.criticalRoll.status === "rolled"
        ? mergeCombatRoundCriticalEffectProposalIntoReview({
            damageResult: {
              ...result.damageResult,
              review: nextReview,
            },
            finalCriticalRoll: getCombatRoundEffectiveCriticalRoll({
              criticalRoll: result.criticalRoll,
              review: nextReview,
            }).finalCriticalRoll,
            selectedHitLocation: getCombatRoundEffectiveCriticalRoll({
              criticalRoll: result.criticalRoll,
              review: nextReview,
            }).criticalLocation,
            state: normalized,
            weaponCriticalCode: attackResult?.weaponCriticalCode,
            weaponDamageClass: attackResult?.weaponDamageClass,
          })
        : nextReview;

    return combatRoundPhaseResolutionResultSchema.parse({
      ...result,
      damageProposal: {
        committedCombatEffectIds: [],
        proposedEffects: [],
        status: "drafted",
      },
      damageResult: {
        ...result.damageResult,
        review,
      },
      updatedAt: input.reviewedAt,
    });
  });

  return combatRoundStateSchema.parse({
    ...normalized,
    phaseResolutionResults: nextResults,
  });
}

function recordCombatRoundCriticalRollCommand(input: {
  attackResult: CombatRoundAttackRollResult;
  command: {
    commandId?: string;
    createdAt: string;
    createdByUserId?: string;
  };
  criticalRoll: CombatRoundCriticalRollResult;
  state: CombatRoundState;
}): CombatRoundState {
  const normalized = combatRoundStateSchema.parse(input.state);
  const beforeCursor = combatRoundCursorSchema.parse({
    participantId: input.attackResult.defenderParticipantId,
    roundNumber: normalized.roundNumber,
    step: getCombatRoundDamageCursorStepForPhase(input.attackResult.phase),
  });
  const commandType = "roll_critical" satisfies CombatRoundCommandType;
  const command = combatRoundCommandSchema.parse({
    afterCursor: beforeCursor,
    beforeCursor,
    createdAt: input.command.createdAt,
    createdByUserId: input.command.createdByUserId,
    facts: {
      armorCriticalModifier: input.criticalRoll.armorCriticalModifier,
      attackResultId: input.criticalRoll.attackResultId,
      attackerParticipantId: input.attackResult.attackerParticipantId,
      criticalDice: input.criticalRoll.criticalDice,
      criticalDiceTotal: input.criticalRoll.criticalDiceTotal,
      criticalGrade: input.criticalRoll.criticalGrade,
      criticalTypeModifier: input.criticalRoll.criticalTypeModifier,
      defenderParticipantId: input.attackResult.defenderParticipantId,
      finalCriticalRoll: input.criticalRoll.finalCriticalRoll,
      rolledByParticipantId: input.criticalRoll.rolledByParticipantId,
      rollPrivilege: "attacker",
      selectedHitLocation: input.criticalRoll.selectedHitLocation,
    },
    id:
      input.command.commandId ??
      buildCombatRoundCommandId({
        createdAt: input.command.createdAt,
        participantId: input.attackResult.defenderParticipantId,
        state: normalized,
        type: commandType,
      }),
    participantId: input.attackResult.defenderParticipantId,
    phase: input.attackResult.phase,
    roundNumber: normalized.roundNumber,
    step: beforeCursor.step,
    type: commandType,
  });
  const selectedStep = getCombatRoundStepForCursorStep(command.afterCursor.step);

  return {
    ...normalized,
    commands: [...normalized.commands, command],
    currentCursor: command.afterCursor,
    currentStep: selectedStep,
    selectedParticipantId: input.attackResult.defenderParticipantId,
    selectedStep,
  };
}

export function recordCombatRoundCriticalRoll(input: {
  armorCriticalModifier?: number;
  attackResult: CombatRoundAttackRollResult;
  command?: {
    commandId?: string;
    createdAt: string;
    createdByUserId?: string;
  };
  criticalDice?: [number, number];
  rng?: () => number;
  rolledByParticipantId: string;
  state: CombatRoundState;
  submittedBy: "gm" | "player";
  updatedAt: string;
}): CombatRoundState {
  const normalized = combatRoundStateSchema.parse(input.state);
  const resolution = getCombatRoundPhaseResolutionResultForAttack({
    attackResult: input.attackResult,
    state: normalized,
  });
  const damageResult = resolution?.damageResult;
  const effectiveDamage = damageResult
    ? getCombatRoundEffectiveDamageResult(damageResult)
    : undefined;
  const criticalGrade = effectiveDamage?.effectiveCriticalGrade;

  if (!resolution || !damageResult || resolution.damageProposal.status === "committed") {
    throw new RangeError("Damage proposal is not ready for a critical roll.");
  }

  if (!criticalGrade || resolution.criticalRoll.status !== "pending") {
    throw new RangeError("Critical roll is not pending for this attack.");
  }

  if (
    input.submittedBy !== "gm" &&
    input.rolledByParticipantId !== input.attackResult.attackerParticipantId
  ) {
    throw new RangeError("Only the attacker can roll the critical die.");
  }

  const criticalRoll = buildCombatRoundCriticalRollResult({
    armorCriticalModifier: input.armorCriticalModifier ?? 0,
    attackResult: input.attackResult,
    criticalDice: input.criticalDice,
    criticalGrade,
    rng: input.rng,
    rolledAt: input.updatedAt,
    rolledByParticipantId: input.rolledByParticipantId,
    rolledByUserId: input.command?.createdByUserId,
    roundNumber: normalized.roundNumber,
    selectedHitLocation: effectiveDamage.effectiveSelectedHitLocation,
  });
  const damageResultWithCriticalProposal = combatRoundDamageResultSchema.parse({
    ...damageResult,
    review: mergeCombatRoundCriticalEffectProposalIntoReview({
      damageResult,
      finalCriticalRoll: criticalRoll.finalCriticalRoll,
      rng: input.rng,
      selectedHitLocation: criticalRoll.selectedHitLocation,
      state: normalized,
      weaponCriticalCode: input.attackResult.weaponCriticalCode,
      weaponDamageClass: input.attackResult.weaponDamageClass,
    }),
  });
  const withCriticalRoll = upsertCombatRoundPhaseResolutionResults({
    results: [
      combatRoundPhaseResolutionResultSchema.parse({
        ...resolution,
        criticalRoll,
        damageResult: damageResultWithCriticalProposal,
        updatedAt: input.updatedAt,
      }),
    ],
    state: normalized,
  });

  return input.command
    ? recordCombatRoundCriticalRollCommand({
        attackResult: input.attackResult,
        command: input.command,
        criticalRoll,
        state: withCriticalRoll,
      })
    : withCriticalRoll;
}

type CombatRoundDamageCommitIdInput = {
  attackResultId: string;
  commandId: string;
  damageResultId: string;
  phase: CombatRoundPhase;
  roundNumber: number;
};

function formatCombatRoundDamageCommitIdPart(value: string): string {
  return value.replace(/[^A-Za-z0-9_-]+/g, "-");
}

function buildCombatRoundDamageCommitIdBase(input: CombatRoundDamageCommitIdInput): string {
  return [
    input.commandId,
    `r${input.roundNumber}`,
    input.phase,
    formatCombatRoundDamageCommitIdPart(input.attackResultId),
    formatCombatRoundDamageCommitIdPart(input.damageResultId),
  ].join(":");
}

export function buildCombatRoundDamageCommitEventId(input: CombatRoundDamageCommitIdInput): string {
  return `${buildCombatRoundDamageCommitIdBase(input)}:combat-effect-event`;
}

export function buildCombatRoundDamageCommitEffectId(
  input: CombatRoundDamageCommitIdInput & {
    commandId: string;
    kind: string;
  },
): string {
  return `${buildCombatRoundDamageCommitIdBase(input)}:combat-effect:${formatCombatRoundDamageCommitIdPart(input.kind)}`;
}

function formatCombatRoundDamageCommitPhaseLabel(phase: CombatRoundPhase): string {
  return phase === "phase1" ? "Phase 1" : "Phase 2";
}

function ensureSentence(value: string): string {
  const trimmed = value.trim();

  if (!trimmed) {
    return "";
  }

  return /[.!?]$/.test(trimmed) ? trimmed : `${trimmed}.`;
}

function normalizeCombatRoundSentence(value: string | undefined): string | undefined {
  const sentence = ensureSentence(value ?? "");

  return sentence || undefined;
}

function combatRoundTextIncludesAny(value: string, patterns: readonly string[]): boolean {
  const normalized = value.toLowerCase();

  return patterns.some((pattern) => normalized.includes(pattern));
}

function buildCombatRoundReviewEffectText(effect: CombatRoundDamageReviewAdditionalEffect): string {
  return [effect.label, effect.notes, effect.sourceText].filter(Boolean).join(" ");
}

function formatCombatRoundDamageReviewEffectPreviewDescription(
  effect: CombatRoundDamageReviewAdditionalEffect,
): string {
  const notes = effect.notes?.trim();

  if (!notes) {
    return effect.label;
  }

  const normalizedLabel = effect.label
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
  const normalizedNotes = notes
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

  if (normalizedNotes && normalizedLabel.includes(normalizedNotes)) {
    return effect.label;
  }

  return notes.toLowerCase().startsWith(`${effect.label.toLowerCase()}:`)
    ? notes
    : `${effect.label}: ${notes}`;
}

function formatCombatRoundDamageReviewRateSentence(value: number | undefined): string | undefined {
  if (value === undefined) {
    return undefined;
  }

  return `${value}/10 HP per round`;
}

function formatCombatRoundDamageReviewEffectStatusDetail(
  effect: CombatRoundDamageReviewAdditionalEffect,
): string | undefined {
  if (effect.phase === "untilCleared") {
    return "Until cleared.";
  }

  if (effect.phase === "phase1") {
    return "Phase 1.";
  }

  if (effect.phase === "phase2") {
    return "Phase 2.";
  }

  if (effect.phase === "round") {
    return "This round.";
  }

  return undefined;
}

function formatCombatRoundLossOfUseDescription(
  effect: CombatRoundDamageReviewAdditionalEffect,
): string {
  const notes = effect.notes?.trim();
  const match = notes?.match(/no actions? with ([^.]+)\.?/i);
  const actionText = match?.[1]
    ? `No actions with ${match[1].trim()}.`
    : "No actions with affected body part.";
  const details = [actionText];

  if (notes && /until treated/i.test(notes)) {
    details.push("Until treated.");
  }

  for (const report of effect.rollReports ?? []) {
    if (report.purpose === "duration") {
      details.push(`Duration roll ${report.formula} = ${report.total}.`);
      break;
    }
  }

  return details.join(" ");
}

function formatCombatRoundDamageReviewEffectCommittedDescription(
  effect: CombatRoundDamageReviewAdditionalEffect,
): string {
  const text = buildCombatRoundReviewEffectText(effect);
  const isNextRound = /\bnext round\b/i.test(text);

  if (
    effect.rowCategory === "no_combat_action" &&
    combatRoundTextIncludesAny(text, ["parry only", "limited to parry"])
  ) {
    return isNextRound ? "Action limited to parry next round." : "Action limited to parry.";
  }

  if (effect.rowCategory === "no_combat_action") {
    return isNextRound ? "No combat action possible next round." : "No combat action possible.";
  }

  if (effect.rowCategory === "loss_of_use") {
    return formatCombatRoundLossOfUseDescription(effect);
  }

  if (effect.rowCategory === "bleed" || effect.rowCategory === "internal_bleed") {
    const label = effect.rowCategory === "internal_bleed" ? "Internal bleed" : "Bleed";
    const rate = formatCombatRoundDamageReviewRateSentence(effect.rateValuePerRound);
    const treatment = /until treated/i.test(effect.notes ?? "") ? " until treated" : "";

    return rate ? `${label}: ${rate}${treatment}.` : `${label}.`;
  }

  if (effect.rowCategory === "dropped_item") {
    return /^dropped/i.test(effect.label)
      ? (normalizeCombatRoundSentence(effect.label) ?? effect.label)
      : "Dropped item.";
  }

  const preview = formatCombatRoundDamageReviewEffectPreviewDescription(effect);
  const status = formatCombatRoundDamageReviewEffectStatusDetail(effect);
  const parts = [normalizeCombatRoundSentence(preview), status].filter((entry): entry is string =>
    Boolean(entry),
  );

  return parts.join(" ") || effect.label;
}

function formatCombatRoundCommittedEffectDuration(
  effect: CombatRoundDamageReviewAdditionalEffect,
): string | undefined {
  return effect.durationRounds !== undefined ? String(effect.durationRounds) : undefined;
}

function formatCombatRoundDamageReviewEffectDuration(
  effect: CombatRoundDamageReviewAdditionalEffect,
): string | undefined {
  const parts: string[] = [];

  if (effect.durationRounds !== undefined) {
    parts.push(`${effect.durationRounds} round${effect.durationRounds === 1 ? "" : "s"}`);
  }

  if (effect.phase === "phase1") {
    parts.push("phase 1");
  } else if (effect.phase === "phase2") {
    parts.push("phase 2");
  } else if (effect.phase === "round") {
    parts.push("this round");
  } else if (effect.phase === "untilCleared") {
    parts.push("until cleared");
  }

  return parts.length > 0 ? parts.join(" · ") : undefined;
}

function formatCombatRoundDamageReviewRateValue(value: number): string {
  return `${value}/10 HP / round`;
}

export function getCombatRoundDamageReviewEffectRowPreview(
  effect: CombatRoundDamageReviewAdditionalEffect,
): {
  accepted: boolean;
  details: string;
  duration?: string;
  rowType: string;
  target: string;
  value: string;
} {
  const shape = getCombatRoundDamageReviewEffectRowShape(effect);
  const duration = formatCombatRoundDamageReviewEffectDuration(effect);
  const rowType =
    effect.rowCategory === "bleed"
      ? "Bleed"
      : effect.rowCategory === "internal_bleed"
        ? "Internal bleed"
        : effect.rowCategory === "no_combat_action"
          ? "No combat action"
          : effect.rowCategory === "loss_of_use"
            ? "Loss of use"
            : effect.rowCategory === "dropped_item"
              ? "Dropped item"
              : effect.rowCategory === "ob_skill_modifier"
                ? "OB/Skill modifier"
                : effect.rowCategory === "db_parry_modifier"
                  ? "DB/Parry modifier"
                  : effect.rowCategory === "general_modifier"
                    ? "General modifier"
                    : effect.rowCategory === "fatigue" || effect.kind === "fatigue"
                      ? "Fatigue"
                      : effect.kind === "note"
                        ? "Note"
                        : shape.type === "special"
                          ? "Special"
                          : effect.label;
  const target =
    shape.effectGroup === "obSkill"
      ? "OB/Skill"
      : shape.effectGroup === "db"
        ? "DB/Parry"
        : shape.effectGroup === "general"
          ? "General"
          : shape.effectGroup === "bleed"
            ? "Bleed"
            : shape.effectGroup === "fatigue"
              ? "Fatigue"
              : shape.effectGroup === "special"
                ? "Special"
                : "None";
  const value =
    effect.rowCategory === "bleed" || effect.rowCategory === "internal_bleed"
      ? effect.rateValuePerRound !== undefined
        ? formatCombatRoundDamageReviewRateValue(effect.rateValuePerRound)
        : ""
      : shape.modifierValue !== undefined
        ? `${shape.modifierValue > 0 ? "+" : ""}${shape.modifierValue}`
        : "";

  return {
    accepted: effect.accepted !== false,
    details: formatCombatRoundDamageReviewEffectPreviewDescription(effect),
    duration,
    rowType,
    target,
    value,
  };
}

function getAcceptedCombatRoundOperationalConsequences(
  damageResult: CombatRoundDamageResult,
): CombatRoundDamageReviewOperationalConsequence[] {
  return (damageResult.review?.operationalConsequences ?? []).filter(
    (consequence) => consequence.accepted,
  );
}

function isCombatRoundOperationalConsequenceCommittedAsEffect(
  consequence: CombatRoundDamageReviewOperationalConsequence,
): boolean {
  return consequence.kind === "drop_item" || consequence.kind === "note";
}

function normalizeCombatRoundDedupeText(value?: string): string {
  return (value ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function combatRoundTextIndicatesParryOnly(text: string): boolean {
  return (
    text.includes("parry only") ||
    text.includes("limited to parry") ||
    text.includes("only parry") ||
    text.includes("except parry") ||
    text.includes("nothing but parry")
  );
}

function combatRoundReviewEffectActionCategory(
  effect: CombatRoundDamageReviewAdditionalEffect,
): "dropped_item" | "loss_of_use" | "no_combat_action" | "parry_only" | undefined {
  const text = normalizeCombatRoundDedupeText(
    [effect.label, effect.notes, effect.sourceText, effect.rowCategory].filter(Boolean).join(" "),
  );

  if (effect.rowCategory === "dropped_item" || text.includes("dropped item")) {
    return "dropped_item";
  }

  if (effect.rowCategory === "loss_of_use" || text.includes("loss of use")) {
    return "loss_of_use";
  }

  if (effect.rowCategory === "no_combat_action" && combatRoundTextIndicatesParryOnly(text)) {
    return "parry_only";
  }

  if (
    effect.rowCategory === "no_combat_action" ||
    text.includes("no combat action") ||
    text.includes("no action possible") ||
    text.includes("may do nothing") ||
    text.includes("unconscious")
  ) {
    return "no_combat_action";
  }

  return undefined;
}

function combatRoundOperationalConsequenceActionCategory(
  consequence: CombatRoundDamageReviewOperationalConsequence,
): "dropped_item" | "loss_of_use" | "no_combat_action" | "parry_only" | undefined {
  const text = normalizeCombatRoundDedupeText(
    [consequence.label, consequence.notes, consequence.reason, consequence.sourceText]
      .filter(Boolean)
      .join(" "),
  );

  if (consequence.kind === "drop_item" || text.includes("drop item")) {
    return "dropped_item";
  }

  if (text.includes("loss of use")) {
    return "loss_of_use";
  }

  if (combatRoundTextIndicatesParryOnly(text)) {
    return "parry_only";
  }

  if (
    text.includes("no combat action") ||
    text.includes("no action possible") ||
    text.includes("may do nothing") ||
    text.includes("unconscious")
  ) {
    return "no_combat_action";
  }

  return undefined;
}

function combatRoundOperationalConsequenceMatchesReviewEffect(input: {
  consequence: CombatRoundDamageReviewOperationalConsequence;
  effect: CombatRoundDamageReviewAdditionalEffect;
}): boolean {
  const consequenceCategory = combatRoundOperationalConsequenceActionCategory(input.consequence);
  const effectCategory = combatRoundReviewEffectActionCategory(input.effect);

  if (!consequenceCategory || !effectCategory || consequenceCategory !== effectCategory) {
    return false;
  }

  return true;
}

function getCombatRoundOperationalConsequencesCommittedAsEffects(input: {
  additionalEffects: readonly CombatRoundDamageReviewAdditionalEffect[];
  operationalConsequences: readonly CombatRoundDamageReviewOperationalConsequence[];
}): CombatRoundDamageReviewOperationalConsequence[] {
  return input.operationalConsequences
    .filter(isCombatRoundOperationalConsequenceCommittedAsEffect)
    .filter(
      (consequence) =>
        !input.additionalEffects.some((effect) =>
          combatRoundOperationalConsequenceMatchesReviewEffect({ consequence, effect }),
        ),
    );
}

function formatCombatRoundOperationalConsequenceDescription(
  consequence: CombatRoundDamageReviewOperationalConsequence,
): string {
  const notes = consequence.notes?.trim();
  const category = combatRoundOperationalConsequenceActionCategory(consequence);

  if (consequence.kind === "drop_item") {
    return consequence.itemLabel ? `Dropped ${consequence.itemLabel}.` : "Dropped item.";
  }

  if (category === "parry_only") {
    return "Action limited to parry.";
  }

  if (consequence.kind === "note" && /no combat action/i.test(consequence.label)) {
    return "No combat action possible.";
  }

  return (
    normalizeCombatRoundSentence(notes || consequence.label || consequence.reason) ??
    consequence.label
  );
}

function formatCombatRoundOperationalConsequenceSummary(
  consequence: CombatRoundDamageReviewOperationalConsequence,
): string {
  if (consequence.kind === "cancel_pending_action" && consequence.phase) {
    return `${consequence.label}`;
  }

  return consequence.label;
}

function formatCombatRoundCriticalReference(input: {
  criticalGrade?: string;
  includeFullText?: boolean;
  proposal?: CombatRoundDamageReview["criticalEffectProposal"];
}): string {
  const grade = input.criticalGrade?.trim().toUpperCase();
  const title = input.proposal?.title?.trim();
  const bodyText = input.includeFullText ? input.proposal?.bodyText?.trim() : undefined;

  if (!grade && !title && !bodyText) {
    return "";
  }

  const heading = grade
    ? title
      ? `Critical ${grade}: ${title}.`
      : `Critical ${grade}.`
    : title
      ? `Critical: ${title}.`
      : "Critical.";
  const fullText = bodyText ? ` Full text: ${bodyText}` : "";

  return ` ${heading}${fullText}`;
}

function getCombatRoundDamageReviewEffectRowShape(
  effect: CombatRoundDamageReviewAdditionalEffect,
): {
  effectGroup: CombatEffectGroup;
  modifierValue?: number;
  type: CombatEffectType;
} {
  if (effect.rowCategory === "bleed") {
    return {
      effectGroup: "bleed",
      modifierValue: effect.rateValuePerRound ?? effect.modifierValue,
      type: "bleed",
    };
  }

  if (effect.rowCategory === "internal_bleed") {
    return {
      effectGroup: "bleed",
      modifierValue: effect.rateValuePerRound ?? effect.modifierValue,
      type: "internal_bleed",
    };
  }

  if (effect.rowCategory === "fatigue") {
    return {
      effectGroup: "fatigue",
      modifierValue: effect.modifierValue,
      type: "fatigue",
    };
  }

  if (effect.rowCategory === "general_modifier") {
    return {
      effectGroup: "general",
      modifierValue: effect.modifierValue,
      type: "general_modifier",
    };
  }

  if (effect.rowCategory === "ob_skill_modifier") {
    return {
      effectGroup: "obSkill",
      modifierValue: effect.modifierValue,
      type: "ob_skill_modifier",
    };
  }

  if (effect.rowCategory === "db_parry_modifier") {
    return {
      effectGroup: "db",
      modifierValue: effect.modifierValue,
      type: "db_modifier",
    };
  }

  if (
    effect.rowCategory === "no_combat_action" ||
    effect.rowCategory === "loss_of_use" ||
    effect.rowCategory === "dropped_item" ||
    effect.rowCategory === "special_note"
  ) {
    return {
      effectGroup: "special",
      type: "special",
    };
  }

  if (effect.kind === "fatigue") {
    return {
      effectGroup: "fatigue",
      modifierValue: effect.modifierValue,
      type: "fatigue",
    };
  }

  if (effect.kind === "modifier") {
    if (effect.modifierBucket === "obSkill") {
      return {
        effectGroup: "obSkill",
        modifierValue: effect.modifierValue,
        type: "ob_skill_modifier",
      };
    }

    if (effect.modifierBucket === "db") {
      return {
        effectGroup: "db",
        modifierValue: effect.modifierValue,
        type: "db_modifier",
      };
    }

    return {
      effectGroup: "general",
      modifierValue: effect.modifierValue,
      type: "general_modifier",
    };
  }

  return {
    effectGroup: "special",
    type: "special",
  };
}

function getCombatRoundCommittedDamageLocation(
  location?: HitLocation,
): { id: string; label: string; note?: string } | undefined {
  switch (location) {
    case "head":
      return { id: "head", label: "Head" };
    case "leftArm":
      return { id: "leftArm", label: "Left arm" };
    case "rightArm":
      return { id: "rightArm", label: "Right arm" };
    case "chest":
      return { id: "chestBack", label: "Chest/back" };
    case "abdomen":
      return { id: "abdomenLowerBack", label: "Abdomen/lower back" };
    case "upperLeftLeg":
      return { id: "upperLeftLeg", label: "Upper left leg" };
    case "lowerLeftLeg":
      return { id: "lowerLeftLeg", label: "Lower left leg" };
    case "upperRightLeg":
      return { id: "upperRightLeg", label: "Upper right leg" };
    case "lowerRightLeg":
      return { id: "lowerRightLeg", label: "Lower right leg" };
    case "leftLeg":
      return {
        id: "upperLeftLeg",
        label: "Upper left leg",
        note: "Legacy whole-leg hit mapped to upper left leg; review as upper or lower leg when needed.",
      };
    case "rightLeg":
      return {
        id: "upperRightLeg",
        label: "Upper right leg",
        note: "Legacy whole-leg hit mapped to upper right leg; review as upper or lower leg when needed.",
      };
    default:
      return undefined;
  }
}

function formatCombatRoundDamageCommitDescription(input: {
  criticalRoll?: CombatRoundCriticalRollResult;
  damageResult: CombatRoundDamageResult;
}): string {
  const effectiveDamage = getCombatRoundEffectiveDamageResult(input.damageResult);
  const effectiveCritical = getCombatRoundEffectiveCriticalRoll({
    criticalRoll: input.criticalRoll,
    review: input.damageResult.review,
  });
  const location = getCombatRoundCommittedDamageLocation(
    effectiveDamage.effectiveSelectedHitLocation,
  );
  const target =
    location?.label ??
    (effectiveDamage.effectiveSelectedHitLocation
      ? getHitLocationFullLabel(effectiveDamage.effectiveSelectedHitLocation)
      : "unlocated hit");
  const weapon = input.damageResult.weaponName ?? "Attack";
  const critical = effectiveDamage.effectiveCriticalGrade
    ? ` Critical ${effectiveDamage.effectiveCriticalGrade.toUpperCase()} pending.`
    : "";
  const criticalRoll =
    input.criticalRoll?.status === "rolled" && effectiveCritical.finalCriticalRoll !== undefined
      ? ` Critical roll ${effectiveCritical.finalCriticalRoll}${
          effectiveCritical.criticalLocation
            ? ` at ${getHitLocationFullLabel(effectiveCritical.criticalLocation).toLowerCase()}`
            : ""
        }.`
      : "";
  const damage = effectiveDamage.criticalMinApplied
    ? `${effectiveDamage.effectiveTotalDamage} damage`
    : `${effectiveDamage.effectiveTotalDamage} damage`;
  const criticalReference = formatCombatRoundCriticalReference({
    criticalGrade: effectiveDamage.effectiveCriticalGrade,
    includeFullText: true,
    proposal: input.damageResult.review?.criticalEffectProposal,
  });
  const damageAdjustment =
    effectiveDamage.criticalMinApplied && effectiveDamage.criticalMinTotalDamage !== undefined
      ? ` Critical minimum raised damage from ${effectiveDamage.preCriticalEffectiveDamage} to ${effectiveDamage.criticalMinTotalDamage}.`
      : effectiveDamage.effectiveMaxDamageApplied &&
          effectiveDamage.effectiveMaxDamageCap !== undefined
        ? ` Maximum damage capped raw ${effectiveDamage.effectiveRawTotalDamage} to ${effectiveDamage.effectiveTotalDamage}.`
        : "";
  const armor =
    effectiveDamage.effectiveArmorRegionLabel && effectiveDamage.effectiveArmorCoverageLabel
      ? ` Armor ${effectiveDamage.effectiveArmorCoverageLabel} at ${effectiveDamage.effectiveArmorRegionLabel.toLowerCase()}/${effectiveDamage.effectiveAttackDirection}${
          effectiveDamage.effectiveTableDamage !== undefined
            ? ` reduced damage from ${effectiveDamage.effectiveTableDamage} to ${effectiveDamage.preCriticalEffectiveDamage}`
            : ` resulted in ${effectiveDamage.preCriticalEffectiveDamage} damage`
        }.`
      : "";
  const armorWarnings = effectiveDamage.effectiveArmorWarnings.length
    ? ` ${effectiveDamage.effectiveArmorWarnings.join(" ")}`
    : "";
  const notes = input.damageResult.review?.notes?.trim()
    ? ` GM review: ${input.damageResult.review.notes.trim()}`
    : "";
  const acceptedAdditionalEffects = (input.damageResult.review?.additionalEffects ?? []).filter(
    (effect) => effect.accepted !== false,
  );
  const additionalEffects = acceptedAdditionalEffects.length
    ? ` Accepted rows: ${acceptedAdditionalEffects.map((effect) => effect.label).join(", ")}.`
    : "";
  const operationalConsequences = getAcceptedCombatRoundOperationalConsequences(input.damageResult);
  const operational = operationalConsequences.length
    ? ` Operational consequences: ${operationalConsequences
        .map(formatCombatRoundOperationalConsequenceSummary)
        .join(", ")}.`
    : "";

  return `${formatCombatRoundDamageCommitPhaseLabel(
    input.damageResult.phase,
  )} damage result: ${weapon} to ${target.toLowerCase()}: ${damage}.${armor}${damageAdjustment}${criticalReference || critical}${criticalRoll}${armorWarnings}${notes}${additionalEffects}${operational}`;
}

function formatCombatRoundPhysicalDamageEffectDescription(input: {
  criticalRoll?: CombatRoundCriticalRollResult;
  damageResult: CombatRoundDamageResult;
}): string {
  const effectiveDamage = getCombatRoundEffectiveDamageResult(input.damageResult);
  const effectiveCritical = getCombatRoundEffectiveCriticalRoll({
    criticalRoll: input.criticalRoll,
    review: input.damageResult.review,
  });
  const location = getCombatRoundCommittedDamageLocation(
    effectiveDamage.effectiveSelectedHitLocation,
  );
  const target =
    location?.label ??
    (effectiveDamage.effectiveSelectedHitLocation
      ? getHitLocationFullLabel(effectiveDamage.effectiveSelectedHitLocation)
      : "unlocated hit");
  const weapon = input.damageResult.weaponName ?? "Attack";
  const armor =
    effectiveDamage.effectiveArmorCoverageLabel &&
    effectiveDamage.effectiveTableDamage !== undefined
      ? ` Armor ${effectiveDamage.effectiveArmorCoverageLabel} reduced damage from ${effectiveDamage.effectiveTableDamage} to ${effectiveDamage.preCriticalEffectiveDamage}.`
      : "";
  const criticalMin =
    effectiveDamage.criticalMinApplied && effectiveDamage.criticalMinTotalDamage !== undefined
      ? ` Critical minimum raised damage from ${effectiveDamage.preCriticalEffectiveDamage} to ${effectiveDamage.criticalMinTotalDamage}.`
      : "";
  const criticalReference = formatCombatRoundCriticalReference({
    criticalGrade: effectiveDamage.effectiveCriticalGrade,
    proposal: input.damageResult.review?.criticalEffectProposal,
  });
  const criticalRoll =
    input.criticalRoll?.status === "rolled" && effectiveCritical.finalCriticalRoll !== undefined
      ? ` Critical roll ${effectiveCritical.finalCriticalRoll}${
          effectiveCritical.criticalLocation
            ? ` at ${getHitLocationFullLabel(effectiveCritical.criticalLocation).toLowerCase()}`
            : ""
        }.`
      : "";
  const notes = input.damageResult.review?.notes?.trim()
    ? ` GM review: ${input.damageResult.review.notes.trim()}`
    : "";

  return `${weapon} hit ${target.toLowerCase()} for ${effectiveDamage.effectiveTotalDamage} damage.${armor}${criticalMin}${criticalReference}${criticalRoll}${notes}`;
}

function buildCombatRoundDamageCommitRows(input: {
  attackerScenarioParticipantId?: string;
  command: CombatRoundCommand;
  combatEffects?: CombatEffectsState;
  criticalRoll?: CombatRoundCriticalRollResult;
  damageResult: CombatRoundDamageResult;
  defenderScenarioParticipantId: string;
  encounterId?: string;
  scenarioId?: string;
}): {
  eventId: string;
  effectIds: string[];
  nextCombatEffects: CombatEffectsState;
} {
  const currentCombatEffects = combatEffectsStateSchema.parse(input.combatEffects);
  const effectiveDamage = getCombatRoundEffectiveDamageResult(input.damageResult);
  if (effectiveDamage.requiresTotalDamageOverride) {
    throw new RangeError(
      "Grazing damage review changed the die size; enter a total damage override before committing.",
    );
  }

  const damageResultId = getCombatRoundDamageResultId({
    attackResultId: input.damageResult.attackResultId,
  });
  const idInput = {
    attackResultId: input.damageResult.attackResultId,
    commandId: input.command.id,
    damageResultId,
    phase: input.damageResult.phase,
    roundNumber: input.command.roundNumber,
  };
  const eventId = buildCombatRoundDamageCommitEventId(idInput);
  const reviewAdditionalEffects = (input.damageResult.review?.additionalEffects ?? []).filter(
    (effect) => effect.accepted !== false,
  );
  const reviewOperationalConsequences = getAcceptedCombatRoundOperationalConsequences(
    input.damageResult,
  );
  const operationalEffectConsequences = getCombatRoundOperationalConsequencesCommittedAsEffects({
    additionalEffects: reviewAdditionalEffects,
    operationalConsequences: reviewOperationalConsequences,
  });
  const damageLocation = getCombatRoundCommittedDamageLocation(
    effectiveDamage.effectiveSelectedHitLocation,
  );
  const committedDamageEffectIds =
    effectiveDamage.effectiveTotalDamage > 0
      ? [
          buildCombatRoundDamageCommitEffectId({
            ...idInput,
            kind: damageLocation ? `physical-damage-${damageLocation.id}` : "general-damage",
          }),
        ]
      : [];
  const additionalEffectIds = reviewAdditionalEffects.map((effect) =>
    buildCombatRoundDamageCommitEffectId({
      ...idInput,
      kind: `additional-${effect.id}`,
    }),
  );
  const operationalEffectIds = operationalEffectConsequences.map((consequence) =>
    buildCombatRoundDamageCommitEffectId({
      ...idInput,
      kind: `operational-${consequence.id}`,
    }),
  );
  const effectIds = [...committedDamageEffectIds, ...additionalEffectIds, ...operationalEffectIds];
  const description = formatCombatRoundDamageCommitDescription({
    criticalRoll: input.criticalRoll,
    damageResult: input.damageResult,
  });
  const physicalDamageDescription = formatCombatRoundPhysicalDamageEffectDescription({
    criticalRoll: input.criticalRoll,
    damageResult: input.damageResult,
  });
  const event = combatEffectEventSchema.parse({
    createdAt: input.command.createdAt,
    createdByUserId: input.command.createdByUserId,
    description,
    encounterId: input.encounterId,
    id: eventId,
    phase: input.damageResult.phase,
    roundNumber: input.command.roundNumber,
    scenarioId: input.scenarioId,
    sourceActorId: input.attackerScenarioParticipantId,
    sourceLabel: `${formatCombatRoundDamageCommitPhaseLabel(input.damageResult.phase)} damage`,
    sourceType: "combat_action",
    targetParticipantId: input.defenderScenarioParticipantId,
  });
  const committedDamageEffects: CombatEffect[] =
    effectiveDamage.effectiveTotalDamage > 0
      ? [
          combatEffectSchema.parse({
            createdAt: input.command.createdAt,
            damage: damageLocation ? effectiveDamage.effectiveTotalDamage : 0,
            description: damageLocation?.note
              ? `${physicalDamageDescription} ${damageLocation.note}`
              : physicalDamageDescription,
            effectGroup: "none",
            generalDamage: damageLocation ? 0 : effectiveDamage.effectiveTotalDamage,
            id:
              committedDamageEffectIds[0] ??
              buildCombatRoundDamageCommitEffectId({
                ...idInput,
                kind: damageLocation ? `physical-damage-${damageLocation.id}` : "general-damage",
              }),
            location: damageLocation?.id,
            roundNumber: input.command.roundNumber,
            sourceEventId: eventId,
            status: "active",
            targetParticipantId: input.defenderScenarioParticipantId,
            type: damageLocation ? "physical_damage" : "general_damage",
            updatedAt: input.command.createdAt,
          }),
        ]
      : [];
  const additionalEffects = reviewAdditionalEffects.map((effect, index) => {
    const rowShape = getCombatRoundDamageReviewEffectRowShape(effect);

    return combatEffectSchema.parse({
      createdAt: input.command.createdAt,
      damage: 0,
      description: formatCombatRoundDamageReviewEffectCommittedDescription(effect),
      duration: formatCombatRoundCommittedEffectDuration(effect),
      effectGroup: rowShape.effectGroup,
      generalDamage: 0,
      id:
        additionalEffectIds[index] ??
        buildCombatRoundDamageCommitEffectId({
          ...idInput,
          kind: `additional-${effect.id}`,
        }),
      modifierValue: rowShape.modifierValue,
      roundNumber: input.command.roundNumber,
      sourceEventId: eventId,
      status: "active",
      targetParticipantId: input.defenderScenarioParticipantId,
      type: rowShape.type,
      updatedAt: input.command.createdAt,
    });
  });
  const operationalEffects = operationalEffectConsequences.map((consequence, index) =>
    combatEffectSchema.parse({
      createdAt: input.command.createdAt,
      damage: 0,
      description: formatCombatRoundOperationalConsequenceDescription(consequence),
      effectGroup: "special",
      generalDamage: 0,
      id:
        operationalEffectIds[index] ??
        buildCombatRoundDamageCommitEffectId({
          ...idInput,
          kind: `operational-${consequence.id}`,
        }),
      roundNumber: input.command.roundNumber,
      sourceEventId: eventId,
      status: "active",
      targetParticipantId: input.defenderScenarioParticipantId,
      type: "special",
      updatedAt: input.command.createdAt,
    }),
  );
  const effects = [...committedDamageEffects, ...additionalEffects, ...operationalEffects];

  return {
    effectIds,
    eventId,
    nextCombatEffects: combatEffectsStateSchema.parse({
      effects: [
        ...currentCombatEffects.effects.filter((effect) => !effectIds.includes(effect.id)),
        ...effects,
      ],
      events: [
        ...currentCombatEffects.events.filter((existingEvent) => existingEvent.id !== eventId),
        event,
      ],
    }),
  };
}

export function removeCombatRoundCommittedDamageEffects(input: {
  combatEffects?: CombatEffectsState;
  command: CombatRoundCommand;
}): CombatEffectsState {
  const currentCombatEffects = combatEffectsStateSchema.parse(input.combatEffects);
  const eventId =
    typeof input.command.facts.createdCombatEffectEventId === "string"
      ? input.command.facts.createdCombatEffectEventId
      : undefined;
  const effectIds = Array.isArray(input.command.facts.createdCombatEffectIds)
    ? input.command.facts.createdCombatEffectIds.filter(
        (effectId): effectId is string => typeof effectId === "string",
      )
    : [];
  const effectIdSet = new Set(effectIds);

  return combatEffectsStateSchema.parse({
    effects: currentCombatEffects.effects.filter((effect) => !effectIdSet.has(effect.id)),
    events: currentCombatEffects.events.filter((event) => event.id !== eventId),
  });
}

function getCombatRoundEndReviewCursor(input: {
  boundary?: boolean;
  participantId?: string;
  state: CombatRoundState;
}): CombatRoundCursor {
  return combatRoundCursorSchema.parse({
    participantId: input.boundary
      ? undefined
      : (input.participantId ?? input.state.participants[0]?.participantId),
    roundNumber: input.state.roundNumber,
    step: "SU",
  });
}

function parseCombatRoundEffectRoundDuration(duration?: string): number | undefined {
  if (!duration) {
    return undefined;
  }

  const match = duration.match(/\b(\d+)\s*(?:r|rnd|round|rounds)\b/i);
  const value = match?.[1] ? Number.parseInt(match[1], 10) : Number.NaN;

  return Number.isFinite(value) && value > 0 ? value : undefined;
}

function formatCombatRoundEffectRoundDuration(input: {
  nextRounds: number;
  previousDuration?: string;
}): string {
  const replacement = `${input.nextRounds} ${input.nextRounds === 1 ? "round" : "rounds"}`;

  if (input.previousDuration?.match(/\b\d+\s*(?:r|rnd|round|rounds)\b/i)) {
    return input.previousDuration.replace(/\b\d+\s*(?:r|rnd|round|rounds)\b/i, replacement);
  }

  return replacement;
}

function getCombatRoundEffectBleedType(effect: CombatEffect): CombatRoundEndBleedType | undefined {
  if (effect.type === "internal_bleed") {
    return "internal";
  }

  if (effect.type === "bleed" || effect.effectGroup === "bleed") {
    return "external";
  }

  return undefined;
}

function getCombatRoundEffectBleedAmount(effect: CombatEffect): number {
  return Math.max(
    0,
    Math.trunc(effect.modifierValue ?? effect.generalDamage ?? effect.damage ?? 0),
  );
}

function setCombatRoundEffectBleedAmount(input: {
  effect: CombatEffect;
  nextAmount: number;
  updatedAt: string;
}): CombatEffect {
  const nextAmount = Math.max(0, Math.trunc(input.nextAmount));
  const nextEffect = {
    ...input.effect,
    status: nextAmount <= 0 ? ("expired" as const) : input.effect.status,
    updatedAt: input.updatedAt,
  };

  if (input.effect.modifierValue !== undefined) {
    return combatEffectSchema.parse({
      ...nextEffect,
      modifierValue: nextAmount,
    });
  }

  if (input.effect.generalDamage > 0) {
    return combatEffectSchema.parse({
      ...nextEffect,
      generalDamage: nextAmount,
    });
  }

  if (input.effect.damage > 0) {
    return combatEffectSchema.parse({
      ...nextEffect,
      damage: nextAmount,
    });
  }

  return combatEffectSchema.parse({
    ...nextEffect,
    modifierValue: nextAmount,
  });
}

function getCombatRoundEffectBleedSourceRound(input: {
  combatEffects: CombatEffectsState;
  effect: CombatEffect;
}): number | undefined {
  if (input.effect.bleedState?.initializedRound !== undefined) {
    return input.effect.bleedState.initializedRound;
  }

  if (input.effect.roundNumber !== undefined) {
    return input.effect.roundNumber;
  }

  const sourceEvent = input.combatEffects.events.find(
    (event) => event.id === input.effect.sourceEventId,
  );

  return sourceEvent?.roundNumber;
}

function getCombatRoundBleedHealthCheckCadence(input: {
  combatEffects: CombatEffectsState;
  effect: CombatEffect;
  roundNumber: number;
}): {
  due: boolean;
  initializedRound: number;
  lastHealthCheckRound?: number;
  roundsUntilHealthCheck: number;
  warning?: string;
} {
  const lastHealthCheckRound = input.effect.bleedState?.lastHealthCheckRound;

  if (lastHealthCheckRound !== undefined) {
    const roundsSinceCheck = Math.max(0, input.roundNumber - lastHealthCheckRound);
    const roundsUntilHealthCheck = Math.max(
      0,
      COMBAT_ROUND_BLEED_HEALTH_CHECK_INTERVAL_ROUNDS - roundsSinceCheck,
    );

    return {
      due: roundsSinceCheck >= COMBAT_ROUND_BLEED_HEALTH_CHECK_INTERVAL_ROUNDS,
      initializedRound:
        input.effect.bleedState?.initializedRound ??
        getCombatRoundEffectBleedSourceRound(input) ??
        input.roundNumber,
      lastHealthCheckRound,
      roundsUntilHealthCheck,
    };
  }

  const sourceRound = getCombatRoundEffectBleedSourceRound(input);
  const initializedRound = sourceRound ?? input.roundNumber;
  const roundsElapsed = Math.max(1, input.roundNumber - initializedRound + 1);
  const roundsUntilHealthCheck = Math.max(
    0,
    COMBAT_ROUND_BLEED_HEALTH_CHECK_INTERVAL_ROUNDS - roundsElapsed,
  );

  return {
    due: roundsElapsed >= COMBAT_ROUND_BLEED_HEALTH_CHECK_INTERVAL_ROUNDS,
    initializedRound,
    roundsUntilHealthCheck,
    warning:
      sourceRound === undefined
        ? "Bleed creation round is unavailable; health-check cadence starts from this SU."
        : undefined,
  };
}

function buildCombatRoundBleedAccumulationNotes(input: {
  amount: number;
  accumulatedTenths: number;
  remainingAccumulatedTenths: number;
}): string {
  if (input.amount > 0) {
    return `Bleed accumulation: ${input.accumulatedTenths}/10 tenths, ${input.amount} general damage. Remainder ${input.remainingAccumulatedTenths}/10 tenths.`;
  }

  return `Bleed accumulation: ${input.accumulatedTenths}/10 tenths, no damage this round.`;
}

export interface CombatRoundEndDistanceControlParticipantInput {
  dodgeSkillTotal?: number;
  generalFatigueModifier?: number;
  warnings?: readonly string[];
}

type CombatRoundEndDistancePreferenceAccumulator = {
  participantAId: string;
  participantBId: string;
  preferenceA?: DistancePreferenceIntent;
  preferenceB?: DistancePreferenceIntent;
};

function findCombatRoundParticipantByAlias(input: {
  id?: string;
  state: CombatRoundState;
}): CombatRoundParticipantState | undefined {
  if (!input.id) {
    return undefined;
  }

  const id = input.id;

  return input.state.participants.find((participant) =>
    getCombatDistanceParticipantAliases(participant).includes(id),
  );
}

function buildCombatRoundEndDistanceControlSide(input: {
  desiredDistance?: CombatDistance;
  participantId: string;
  participantInput?: CombatRoundEndDistanceControlParticipantInput;
  requiresRoll: boolean;
}): CombatRoundEndDistanceControlSide {
  const warnings = [...(input.participantInput?.warnings ?? [])];

  if (input.participantInput?.dodgeSkillTotal === undefined) {
    warnings.push("Dodge total unavailable; using +0 for distance control.");
  }

  return combatRoundEndDistanceControlSideSchema.parse({
    desiredDistance: input.desiredDistance,
    dodgeSkillTotal: input.participantInput?.dodgeSkillTotal ?? 0,
    generalFatigueModifier: input.participantInput?.generalFatigueModifier ?? 0,
    participantId: input.participantId,
    status: input.requiresRoll ? "pending" : "not_required",
    warnings: [...new Set(warnings)],
  });
}

function buildCombatRoundEndDistanceProposalId(input: {
  pairKey: string;
  roundNumber: number;
}): string {
  return `round-end:${input.roundNumber}:distance:${input.pairKey}`;
}

function buildCombatRoundEndDistanceProposals(input: {
  participantInputs?: Record<string, CombatRoundEndDistanceControlParticipantInput>;
  state: CombatRoundState;
}): CombatRoundEndDistanceProposal[] {
  const normalized = combatRoundStateSchema.parse(input.state);
  const preferencesByPair = new Map<string, CombatRoundEndDistancePreferenceAccumulator>();

  for (const participant of normalized.participants) {
    const movementIntent = participant.declaration?.movementIntent;

    if (
      !movementIntent ||
      movementIntent.mode !== "set_distance_preferences" ||
      movementIntent.distancePreferences.length === 0
    ) {
      continue;
    }

    for (const preference of movementIntent.distancePreferences) {
      const target = findCombatRoundParticipantByAlias({
        id: preference.targetParticipantId,
        state: normalized,
      });

      if (!target || target.participantId === participant.participantId) {
        continue;
      }

      const pairKey = makeDistancePairKey(participant.participantId, target.participantId);
      const [participantAId, participantBId] = pairKey.split("::");

      if (!participantAId || !participantBId) {
        continue;
      }

      const existing = preferencesByPair.get(pairKey) ?? {
        participantAId,
        participantBId,
      };
      const next =
        participant.participantId === participantAId
          ? { ...existing, preferenceA: preference }
          : { ...existing, preferenceB: preference };

      preferencesByPair.set(pairKey, next);
    }
  }

  return [...preferencesByPair.entries()].map(([pairKey, entry]) => {
    const currentEdge = getDistanceEdgeBetween(
      normalized.distanceState,
      entry.participantAId,
      entry.participantBId,
    );
    const warnings = currentEdge
      ? []
      : ["Current distance was unavailable; using 2 for this review until GM resolves it."];
    const currentDistance = currentEdge?.distance ?? combatDistanceSchema.parse(2);
    const desiredDistanceA = entry.preferenceA?.desiredDistance;
    const desiredDistanceB = entry.preferenceB?.desiredDistance;
    const samePreference =
      desiredDistanceA !== undefined &&
      desiredDistanceB !== undefined &&
      desiredDistanceA === desiredDistanceB;
    const requiresContest = !samePreference;
    const proposedDistance = samePreference ? desiredDistanceA : undefined;
    const status = samePreference ? "review_ready" : "pending_rolls";
    const outcome = samePreference ? "uncontested" : "contest_pending";

    return combatRoundEndDistanceProposalSchema.parse({
      appliesFromRound: normalized.roundNumber + 1,
      currentDistance,
      id: buildCombatRoundEndDistanceProposalId({
        pairKey,
        roundNumber: normalized.roundNumber,
      }),
      outcome,
      pairKey,
      participantA: buildCombatRoundEndDistanceControlSide({
        desiredDistance: desiredDistanceA,
        participantId: entry.participantAId,
        participantInput: input.participantInputs?.[entry.participantAId],
        requiresRoll: requiresContest,
      }),
      participantAId: entry.participantAId,
      participantB: buildCombatRoundEndDistanceControlSide({
        desiredDistance: desiredDistanceB,
        participantId: entry.participantBId,
        participantInput: input.participantInputs?.[entry.participantBId],
        requiresRoll: requiresContest,
      }),
      participantBId: entry.participantBId,
      proposedDistance,
      requiresContest,
      status,
      warnings,
    });
  });
}

function getCombatRoundEndReviewParticipantStatus(
  review: Omit<RoundEndParticipantReview, "status">,
): CombatRoundEndParticipantReviewStatus {
  if (
    review.proposedHealthRolls.some(
      (proposal) => proposal.accepted && proposal.status === "pending",
    )
  ) {
    return "health_roll_pending";
  }

  return "review_ready";
}

function buildCombatRoundEndParticipantReview(input: {
  combatEffects?: CombatEffectsState;
  healthStat?: number;
  participantId: string;
  proposedDistances?: readonly CombatRoundEndDistanceProposal[];
  roundNumber: number;
}): RoundEndParticipantReview {
  const combatEffects = combatEffectsStateSchema.parse(input.combatEffects);
  const proposedEffects: CombatRoundEndEffectProposal[] = [];
  const proposedDamage: CombatRoundEndDamageProposal[] = [];
  const proposedHealthRolls: CombatRoundEndHealthRollProposal[] = [];
  const proposedRemovals: CombatRoundEndRemovalProposal[] = [];
  const warnings: string[] = [];

  for (const effect of combatEffects.effects) {
    if (effect.status !== "active") {
      continue;
    }

    const durationRounds = parseCombatRoundEffectRoundDuration(effect.duration);

    if (durationRounds !== undefined) {
      if (durationRounds <= 1) {
        proposedRemovals.push(
          combatRoundEndRemovalProposalSchema.parse({
            effectId: effect.id,
            id: `round-end:${input.roundNumber}:${input.participantId}:expire:${effect.id}`,
            kind: "duration_expire",
            label: effect.description
              ? `Expire ${effect.description}`
              : `Expire ${effect.type.replaceAll("_", " ")}`,
            notes: "Round-based duration reaches 0 at SU.",
            participantId: input.participantId,
            previousDuration: effect.duration,
            previousExpiresAtRound: effect.expiresAtRound,
            previousStatus: effect.status,
          }),
        );
      } else {
        const nextRounds = durationRounds - 1;

        proposedEffects.push(
          combatRoundEndEffectProposalSchema.parse({
            effectId: effect.id,
            id: `round-end:${input.roundNumber}:${input.participantId}:duration:${effect.id}`,
            kind: "duration_update",
            label: effect.description
              ? `Reduce duration: ${effect.description}`
              : `Reduce duration: ${effect.type.replaceAll("_", " ")}`,
            nextDuration: formatCombatRoundEffectRoundDuration({
              nextRounds,
              previousDuration: effect.duration,
            }),
            notes: "Round-based duration ticks down at SU.",
            participantId: input.participantId,
            previousDuration: effect.duration,
            previousExpiresAtRound: effect.expiresAtRound,
          }),
        );
      }
    } else if (effect.expiresAtRound !== undefined && effect.expiresAtRound <= input.roundNumber) {
      proposedRemovals.push(
        combatRoundEndRemovalProposalSchema.parse({
          effectId: effect.id,
          id: `round-end:${input.roundNumber}:${input.participantId}:expire:${effect.id}`,
          kind: "duration_expire",
          label: effect.description
            ? `Expire ${effect.description}`
            : `Expire ${effect.type.replaceAll("_", " ")}`,
          notes: `Effect expires at round ${effect.expiresAtRound}.`,
          participantId: input.participantId,
          previousDuration: effect.duration,
          previousExpiresAtRound: effect.expiresAtRound,
          previousStatus: effect.status,
        }),
      );
    }

    const bleedType = getCombatRoundEffectBleedType(effect);
    const bleedRate = bleedType ? getCombatRoundEffectBleedAmount(effect) : 0;

    if (bleedType && bleedRate > 0) {
      const previousAccumulatedTenths = Math.max(
        0,
        Math.trunc(effect.bleedState?.accumulatedTenths ?? 0),
      );
      const accumulatedTenths = previousAccumulatedTenths + bleedRate;
      const bleedDamage = Math.floor(accumulatedTenths / 10);
      const remainingAccumulatedTenths = accumulatedTenths % 10;
      const cadence = getCombatRoundBleedHealthCheckCadence({
        combatEffects,
        effect,
        roundNumber: input.roundNumber,
      });
      const difficulty =
        bleedType === "internal"
          ? COMBAT_ROUND_INTERNAL_BLEED_HEALTH_DIFFICULTY
          : COMBAT_ROUND_EXTERNAL_BLEED_HEALTH_DIFFICULTY;
      const damageProposalId = `round-end:${input.roundNumber}:${input.participantId}:${bleedType}-bleed:${effect.id}`;
      const healthRollWarnings =
        input.healthStat === undefined
          ? ["Health stat not available; using +0 until a character health stat is supplied."]
          : [];
      const cadenceWarnings = cadence.warning ? [cadence.warning] : [];

      proposedDamage.push(
        combatRoundEndDamageProposalSchema.parse({
          accumulatedTenths,
          amount: bleedDamage,
          bleedType,
          bleedRate,
          healthCheckDue: cadence.due,
          id: damageProposalId,
          initializedRound: cadence.initializedRound,
          label:
            bleedType === "internal"
              ? `Internal bleed ${bleedRate}/10 HP per round`
              : `Bleed ${bleedRate}/10 HP per round`,
          lastHealthCheckRound: cadence.lastHealthCheckRound,
          notes: buildCombatRoundBleedAccumulationNotes({
            accumulatedTenths,
            amount: bleedDamage,
            remainingAccumulatedTenths,
          }),
          participantId: input.participantId,
          previousAccumulatedTenths,
          remainingAccumulatedTenths,
          roundsUntilHealthCheck: cadence.roundsUntilHealthCheck,
          sourceEffectId: effect.id,
        }),
      );

      if (cadence.due) {
        proposedHealthRolls.push(
          combatRoundEndHealthRollProposalSchema.parse({
            bleedType,
            damageProposalId,
            difficulty,
            healthStat: input.healthStat ?? 0,
            id: `${damageProposalId}:health`,
            label:
              bleedType === "internal"
                ? `Health check vs internal bleed ${difficulty}`
                : `Health check vs bleed ${difficulty}`,
            participantId: input.participantId,
            previousBleedRate: bleedRate,
            sourceEffectId: effect.id,
            warnings: healthRollWarnings,
          }),
        );
        warnings.push(...healthRollWarnings);
      }

      warnings.push(...cadenceWarnings);
    }
  }

  const reviewWithoutStatus = {
    participantId: input.participantId,
    proposedDamage,
    proposedDistances: [...(input.proposedDistances ?? [])],
    proposedEffects,
    proposedHealthRolls,
    proposedRemovals,
    warnings: [...new Set(warnings)],
  };

  return combatRoundEndParticipantReviewSchema.parse({
    ...reviewWithoutStatus,
    status: getCombatRoundEndReviewParticipantStatus(reviewWithoutStatus),
  });
}

export function isCombatRoundEndReviewComplete(state: CombatRoundState): boolean {
  const normalized = combatRoundStateSchema.parse(state);
  const review = normalized.roundEndReview;

  if (!review || review.roundNumber !== normalized.roundNumber) {
    return false;
  }

  if (
    review.proposedDistances.some(
      (proposal) => proposal.accepted && proposal.status !== "committed",
    )
  ) {
    return false;
  }

  return normalized.participants.every((participant) => {
    const participantReview = review.participantReviews[participant.participantId];

    return participantReview?.status === "complete";
  });
}

export function getCombatRoundEndDistanceControlPendingRollCount(input: {
  participantId: string;
  state: CombatRoundState;
}): number {
  const normalized = combatRoundStateSchema.parse(input.state);
  const review = normalized.roundEndReview;

  if (!review || review.roundNumber !== normalized.roundNumber) {
    return 0;
  }

  return review.proposedDistances.filter((proposal) => {
    if (!proposal.accepted || proposal.status !== "pending_rolls") {
      return false;
    }

    const side =
      proposal.participantAId === input.participantId
        ? proposal.participantA
        : proposal.participantBId === input.participantId
          ? proposal.participantB
          : undefined;

    return side?.status === "pending";
  }).length;
}

export function getCombatRoundEndHealthCheckPendingRolls(input: {
  participantId: string;
  state: CombatRoundState;
}): CombatRoundEndHealthRollProposal[] {
  const normalized = combatRoundStateSchema.parse(input.state);
  const review = normalized.roundEndReview;
  const participantReview = review?.participantReviews[input.participantId];

  if (!review || review.roundNumber !== normalized.roundNumber || !participantReview) {
    return [];
  }

  return participantReview.proposedHealthRolls.filter(
    (proposal) => proposal.accepted && proposal.status === "pending",
  );
}

export function getCombatRoundEndHealthCheckPendingRollCount(input: {
  participantId: string;
  state: CombatRoundState;
}): number {
  return getCombatRoundEndHealthCheckPendingRolls(input).length;
}

export function getCombatRoundStartNextRoundBlocker(state: CombatRoundState): string | undefined {
  const normalized = combatRoundStateSchema.parse(state);
  const review = normalized.roundEndReview;

  if (!review || review.roundNumber !== normalized.roundNumber) {
    return "Round-end review incomplete.";
  }

  const pendingDistanceProposal = review.proposedDistances.find(
    (proposal) =>
      proposal.accepted && (proposal.status === "pending" || proposal.status === "pending_rolls"),
  );

  if (pendingDistanceProposal) {
    return "Distance control roll pending.";
  }

  const uncommittedDistanceProposal = review.proposedDistances.find(
    (proposal) => proposal.accepted && proposal.status !== "committed",
  );

  if (uncommittedDistanceProposal) {
    return "Distance control commit pending.";
  }

  for (const participant of normalized.participants) {
    const participantReview = review.participantReviews[participant.participantId];

    if (!participantReview) {
      return `Round-end review missing for ${participant.label}.`;
    }

    const pendingHealthRoll = participantReview.proposedHealthRolls.find(
      (proposal) => proposal.accepted && proposal.status === "pending",
    );

    if (pendingHealthRoll) {
      return `Health roll pending for ${participant.label}.`;
    }

    if (participantReview.status !== "complete") {
      return `Round-end review incomplete for ${participant.label}.`;
    }
  }

  return undefined;
}

export function prepareCombatRoundEndReview(input: {
  command?: {
    commandId?: string;
    createdAt: string;
    createdByUserId?: string;
  };
  participantInputs?: Record<
    string,
    {
      combatEffects?: CombatEffectsState;
      distanceControl?: CombatRoundEndDistanceControlParticipantInput;
      healthStat?: number;
    }
  >;
  state: CombatRoundState;
}): CombatRoundState {
  const normalized = combatRoundStateSchema.parse(input.state);

  if (normalized.currentStep !== "round_summary") {
    throw new RangeError("Round-end review can only be prepared at SU.");
  }

  const distanceControlInputs = Object.fromEntries(
    Object.entries(input.participantInputs ?? {}).map(([participantId, participantInput]) => [
      participantId,
      participantInput.distanceControl ?? {},
    ]),
  );
  const distanceProposals = buildCombatRoundEndDistanceProposals({
    participantInputs: distanceControlInputs,
    state: normalized,
  });
  const participantReviews = Object.fromEntries(
    normalized.participants.map((participant) => {
      const participantInput = input.participantInputs?.[participant.participantId];

      return [
        participant.participantId,
        buildCombatRoundEndParticipantReview({
          combatEffects: participantInput?.combatEffects,
          healthStat: participantInput?.healthStat,
          participantId: participant.participantId,
          roundNumber: normalized.roundNumber,
        }),
      ];
    }),
  );
  const preparedAt = input.command?.createdAt ?? new Date().toISOString();
  const roundEndReview = combatRoundEndReviewSchema.parse({
    participantReviews,
    preparedAt,
    preparedByUserId: input.command?.createdByUserId,
    proposedDistances: distanceProposals,
    roundNumber: normalized.roundNumber,
  });
  const firstReviewParticipant = normalized.participants.find(
    (participant) =>
      roundEndReview.participantReviews[participant.participantId]?.status !== "complete",
  );
  const beforeCursor = getCombatRoundEndReviewCursor({
    participantId:
      normalized.currentCursor?.participantId ??
      firstReviewParticipant?.participantId ??
      normalized.participants[0]?.participantId,
    state: normalized,
  });
  const afterCursor = getCombatRoundEndReviewCursor({
    boundary: !firstReviewParticipant,
    participantId: firstReviewParticipant?.participantId,
    state: normalized,
  });
  const command = input.command
    ? combatRoundCommandSchema.parse({
        afterCursor,
        beforeCursor,
        createdAt: input.command.createdAt,
        createdByUserId: input.command.createdByUserId,
        facts: {
          participantIds: normalized.participants.map((participant) => participant.participantId),
          reviewStatus: "prepared",
        },
        id:
          input.command.commandId ??
          buildCombatRoundCommandId({
            createdAt: input.command.createdAt,
            participantId: afterCursor.participantId ?? "round-end",
            state: normalized,
            type: "prepare_round_end_review",
          }),
        participantId: afterCursor.participantId ?? "round-end",
        roundNumber: normalized.roundNumber,
        step: "SU",
        type: "prepare_round_end_review",
      })
    : undefined;

  return combatRoundStateSchema.parse({
    ...normalized,
    commands: command ? [...normalized.commands, command] : normalized.commands,
    currentCursor: afterCursor,
    currentStep: "round_summary",
    roundEndReview,
    selectedParticipantId: afterCursor.participantId,
    selectedStep: "round_summary",
  });
}

export function ensureCombatRoundEndReviewPrepared(input: {
  command?: {
    commandId?: string;
    createdAt: string;
    createdByUserId?: string;
  };
  participantInputs?: Record<
    string,
    {
      combatEffects?: CombatEffectsState;
      distanceControl?: CombatRoundEndDistanceControlParticipantInput;
      healthStat?: number;
    }
  >;
  state: CombatRoundState;
}): CombatRoundState {
  const normalized = combatRoundStateSchema.parse(input.state);

  if (normalized.currentStep !== "round_summary") {
    return normalized;
  }

  if (normalized.roundEndReview?.roundNumber === normalized.roundNumber) {
    return normalized;
  }

  return prepareCombatRoundEndReview({
    command: input.command,
    participantInputs: input.participantInputs,
    state: normalized,
  });
}

type CombatRoundEndUpdatedEffectFact = {
  effectId: string;
  nextEffect?: unknown;
  previousEffect?: unknown;
};

function isCombatRoundEndUpdatedEffectFact(
  value: unknown,
): value is CombatRoundEndUpdatedEffectFact {
  return (
    typeof value === "object" &&
    value !== null &&
    "effectId" in value &&
    typeof value.effectId === "string"
  );
}

function buildCombatRoundEndParticipantReviewEffectIds(input: {
  commandId: string;
  participantId: string;
  proposalIds: readonly string[];
  roundNumber: number;
}): string[] {
  return input.proposalIds.map((proposalId) =>
    [
      "combat-effect",
      "round-end",
      input.roundNumber,
      input.participantId,
      input.commandId,
      proposalId,
    ].join(":"),
  );
}

function buildCombatRoundEndParticipantReviewEventId(input: {
  commandId: string;
  participantId: string;
  roundNumber: number;
}): string {
  return [
    "combat-effect-event",
    "round-end",
    input.roundNumber,
    input.participantId,
    input.commandId,
  ].join(":");
}

function applyCombatRoundEndReviewEffects(input: {
  combatEffects?: CombatEffectsState;
  command: CombatRoundCommand;
  encounterId?: string;
  participantReview: RoundEndParticipantReview;
  scenarioId?: string;
  scenarioParticipantId: string;
}): {
  combatEffects: CombatEffectsState;
  createdCombatEffectEventId?: string;
  createdCombatEffectIds: string[];
  updatedEffects: CombatRoundEndUpdatedEffectFact[];
} {
  const currentCombatEffects = combatEffectsStateSchema.parse(input.combatEffects);
  const acceptedDamage = input.participantReview.proposedDamage.filter(
    (proposal) => proposal.accepted && proposal.amount > 0,
  );
  const acceptedBleedProposals = input.participantReview.proposedDamage.filter(
    (proposal) => proposal.accepted,
  );
  const updatedEffects: CombatRoundEndUpdatedEffectFact[] = [];
  const updatedEffectIds = new Set<string>();
  const nextEffects = currentCombatEffects.effects.map((effect) => {
    const durationUpdate = input.participantReview.proposedEffects.find(
      (proposal) => proposal.accepted && proposal.effectId === effect.id,
    );
    const removal = input.participantReview.proposedRemovals.find(
      (proposal) => proposal.accepted && proposal.effectId === effect.id,
    );
    const bleedProposal = acceptedBleedProposals.find(
      (proposal) => proposal.sourceEffectId === effect.id,
    );
    let nextEffect = effect;

    if (durationUpdate) {
      nextEffect = combatEffectSchema.parse({
        ...nextEffect,
        duration: durationUpdate.nextDuration ?? effect.duration,
        expiresAtRound: durationUpdate.nextExpiresAtRound,
        updatedAt: input.command.createdAt,
      });
    }

    if (removal) {
      nextEffect = combatEffectSchema.parse({
        ...nextEffect,
        status: "expired",
        updatedAt: input.command.createdAt,
      });
    }

    if (bleedProposal) {
      nextEffect = combatEffectSchema.parse({
        ...nextEffect,
        bleedState: combatEffectBleedStateSchema.parse({
          ...nextEffect.bleedState,
          accumulatedTenths: bleedProposal.remainingAccumulatedTenths,
          initializedRound:
            nextEffect.bleedState?.initializedRound ?? bleedProposal.initializedRound,
        }),
        updatedAt: input.command.createdAt,
      });
    }

    if (nextEffect !== effect) {
      updatedEffectIds.add(effect.id);
      updatedEffects.push({
        effectId: effect.id,
        nextEffect,
        previousEffect: effect,
      });
    }

    return nextEffect;
  });

  const createdCombatEffectIds = buildCombatRoundEndParticipantReviewEffectIds({
    commandId: input.command.id,
    participantId: input.command.participantId,
    proposalIds: acceptedDamage.map((proposal) => proposal.id),
    roundNumber: input.command.roundNumber,
  });
  const createdCombatEffectEventId =
    acceptedDamage.length > 0
      ? buildCombatRoundEndParticipantReviewEventId({
          commandId: input.command.id,
          participantId: input.command.participantId,
          roundNumber: input.command.roundNumber,
        })
      : undefined;
  const createdEvent = createdCombatEffectEventId
    ? combatEffectEventSchema.parse({
        createdAt: input.command.createdAt,
        createdByUserId: input.command.createdByUserId,
        description: `Round ${input.command.roundNumber} end review applied bleed damage.`,
        encounterId: input.encounterId,
        id: createdCombatEffectEventId,
        phase: "round_end",
        roundNumber: input.command.roundNumber,
        scenarioId: input.scenarioId,
        sourceLabel: "Round-end bleed damage",
        sourceType: "bleed_tick",
        targetParticipantId: input.scenarioParticipantId,
      })
    : undefined;
  const createdEffects = createdCombatEffectEventId
    ? acceptedDamage.map((proposal, index) =>
        combatEffectSchema.parse({
          createdAt: input.command.createdAt,
          damage: 0,
          description:
            proposal.bleedType === "internal"
              ? `Round ${input.command.roundNumber} end: internal bleed causes ${proposal.amount} general damage.`
              : `Round ${input.command.roundNumber} end: bleed causes ${proposal.amount} general damage.`,
          effectGroup: "none",
          generalDamage: proposal.amount,
          id: createdCombatEffectIds[index],
          roundNumber: input.command.roundNumber,
          sourceEventId: createdCombatEffectEventId,
          status: "active",
          targetParticipantId: input.scenarioParticipantId,
          type: "general_damage",
          updatedAt: input.command.createdAt,
        }),
      )
    : [];

  return {
    combatEffects: combatEffectsStateSchema.parse({
      effects: [
        ...nextEffects.filter(
          (effect) =>
            !createdCombatEffectIds.includes(effect.id) || updatedEffectIds.has(effect.id),
        ),
        ...createdEffects,
      ],
      events: [
        ...currentCombatEffects.events.filter((event) => event.id !== createdCombatEffectEventId),
        ...(createdEvent ? [createdEvent] : []),
      ],
    }),
    createdCombatEffectEventId,
    createdCombatEffectIds,
    updatedEffects,
  };
}

function getNextRoundEndReviewParticipantId(input: {
  participantId: string;
  roundEndReview: CombatRoundEndReview;
  state: CombatRoundState;
}): string | undefined {
  const currentIndex = input.state.participants.findIndex(
    (participant) => participant.participantId === input.participantId,
  );
  const orderedParticipants = [
    ...input.state.participants.slice(Math.max(0, currentIndex + 1)),
    ...input.state.participants.slice(0, Math.max(0, currentIndex + 1)),
  ];

  return orderedParticipants.find(
    (participant) =>
      input.roundEndReview.participantReviews[participant.participantId]?.status !== "complete",
  )?.participantId;
}

export function commitCombatRoundEndParticipantReview(input: {
  command: {
    commandId?: string;
    createdAt: string;
    createdByUserId?: string;
  };
  combatEffects?: CombatEffectsState;
  encounterId?: string;
  participantId: string;
  scenarioId?: string;
  scenarioParticipantId: string;
  state: CombatRoundState;
}): {
  combatEffects: CombatEffectsState;
  command: CombatRoundCommand;
  state: CombatRoundState;
} {
  const normalized = combatRoundStateSchema.parse(input.state);
  const roundEndReview = normalized.roundEndReview;
  const participantReview = roundEndReview?.participantReviews[input.participantId];

  if (!roundEndReview || roundEndReview.roundNumber !== normalized.roundNumber) {
    throw new RangeError("Round-end review has not been prepared.");
  }

  if (!participantReview) {
    throw new RangeError("Round-end review is missing for this participant.");
  }

  if (participantReview.status !== "review_ready") {
    throw new RangeError("Round-end participant review is not ready to commit.");
  }

  const pendingHealthRolls = participantReview.proposedHealthRolls.filter(
    (proposal) => proposal.accepted && proposal.status === "pending",
  );

  if (pendingHealthRolls.length > 0) {
    throw new RangeError("Round-end health rolls must be resolved before committing review.");
  }

  const rolledHealthRolls = participantReview.proposedHealthRolls.filter(
    (proposal) => proposal.accepted && proposal.status === "rolled",
  );
  const nextStatus: CombatRoundEndParticipantReviewStatus = "complete";
  const beforeCursor = getCombatRoundEndReviewCursor({
    participantId: input.participantId,
    state: normalized,
  });
  const commandId =
    input.command.commandId ??
    buildCombatRoundCommandId({
      createdAt: input.command.createdAt,
      participantId: input.participantId,
      state: normalized,
      type: "commit_round_end_participant_review",
    });
  const provisionalCommand = combatRoundCommandSchema.parse({
    afterCursor: beforeCursor,
    beforeCursor,
    createdAt: input.command.createdAt,
    createdByUserId: input.command.createdByUserId,
    facts: {},
    id: commandId,
    participantId: input.participantId,
    roundNumber: normalized.roundNumber,
    step: "SU",
    type: "commit_round_end_participant_review",
  });
  const effectApplication = applyCombatRoundEndReviewEffects({
    combatEffects: input.combatEffects,
    command: provisionalCommand,
    encounterId: input.encounterId,
    participantReview,
    scenarioId: input.scenarioId,
    scenarioParticipantId: input.scenarioParticipantId,
  });
  const committedReview = combatRoundEndParticipantReviewSchema.parse({
    ...participantReview,
    committedAt: input.command.createdAt,
    committedByUserId: input.command.createdByUserId,
    status: nextStatus,
  });
  const nextRoundEndReview = combatRoundEndReviewSchema.parse({
    ...roundEndReview,
    participantReviews: {
      ...roundEndReview.participantReviews,
      [input.participantId]: committedReview,
    },
  });
  const nextParticipantId = getNextRoundEndReviewParticipantId({
    participantId: input.participantId,
    roundEndReview: nextRoundEndReview,
    state: normalized,
  });
  const afterCursor = getCombatRoundEndReviewCursor({
    boundary: !nextParticipantId,
    participantId: nextParticipantId,
    state: normalized,
  });
  const command = combatRoundCommandSchema.parse({
    ...provisionalCommand,
    afterCursor,
    facts: {
      acceptedDamageProposalIds: participantReview.proposedDamage
        .filter((proposal) => proposal.accepted && proposal.amount > 0)
        .map((proposal) => proposal.id),
      acceptedDurationProposalIds: participantReview.proposedEffects
        .filter((proposal) => proposal.accepted)
        .map((proposal) => proposal.id),
      acceptedHealthRollIds: rolledHealthRolls.map((proposal) => proposal.id),
      acceptedRemovalProposalIds: participantReview.proposedRemovals
        .filter((proposal) => proposal.accepted)
        .map((proposal) => proposal.id),
      createdCombatEffectEventId: effectApplication.createdCombatEffectEventId,
      createdCombatEffectIds: effectApplication.createdCombatEffectIds,
      nextReviewStatus: nextStatus,
      nextStatus,
      previousReviewStatus: participantReview.status,
      scenarioParticipantId: input.scenarioParticipantId,
      updatedEffects: effectApplication.updatedEffects,
    },
  });

  return {
    combatEffects: effectApplication.combatEffects,
    command,
    state: combatRoundStateSchema.parse({
      ...normalized,
      commands: [...normalized.commands, command],
      currentCursor: afterCursor,
      currentStep: "round_summary",
      participants: normalized.participants.map((participant) =>
        participant.participantId === input.participantId
          ? {
              ...participant,
              stepStatuses: {
                ...participant.stepStatuses,
                round_summary: nextStatus === "complete" ? "complete" : "ready",
              },
            }
          : participant,
      ),
      roundEndReview: nextRoundEndReview,
      selectedParticipantId: afterCursor.participantId,
      selectedStep: "round_summary",
    }),
  };
}

export function removeCombatRoundEndParticipantReviewEffects(input: {
  combatEffects?: CombatEffectsState;
  command: CombatRoundCommand;
}): CombatEffectsState {
  const currentCombatEffects = combatEffectsStateSchema.parse(input.combatEffects);
  const eventId =
    typeof input.command.facts.createdCombatEffectEventId === "string"
      ? input.command.facts.createdCombatEffectEventId
      : undefined;
  const effectIds = Array.isArray(input.command.facts.createdCombatEffectIds)
    ? input.command.facts.createdCombatEffectIds.filter(
        (effectId): effectId is string => typeof effectId === "string",
      )
    : [];
  const effectIdSet = new Set(effectIds);
  const updatedEffects = Array.isArray(input.command.facts.updatedEffects)
    ? input.command.facts.updatedEffects.filter(isCombatRoundEndUpdatedEffectFact)
    : [];
  const restoredById = new Map(
    updatedEffects
      .map((entry) => {
        const parsed = combatEffectSchema.safeParse(entry.previousEffect);
        return parsed.success ? ([entry.effectId, parsed.data] as const) : undefined;
      })
      .filter((entry): entry is readonly [string, CombatEffect] => entry !== undefined),
  );
  const existingWithoutCreated = currentCombatEffects.effects.filter(
    (effect) => !effectIdSet.has(effect.id),
  );
  const restoredExisting = existingWithoutCreated.map(
    (effect) => restoredById.get(effect.id) ?? effect,
  );
  const missingRestored = [...restoredById.values()].filter(
    (effect) => !restoredExisting.some((existingEffect) => existingEffect.id === effect.id),
  );

  return combatEffectsStateSchema.parse({
    effects: [...restoredExisting, ...missingRestored],
    events: currentCombatEffects.events.filter((event) => event.id !== eventId),
  });
}

export function rollCombatRoundEndHealthCheck(input: {
  command: {
    commandId?: string;
    createdAt: string;
    createdByUserId?: string;
  };
  combatEffects?: CombatEffectsState;
  difficulty?: number;
  healthRollId?: string;
  participantId: string;
  roll?: OpenEndedD20Roll;
  rolledBy?: "player" | "gm_proxy";
  rng?: () => number;
  state: CombatRoundState;
}): {
  combatEffects: CombatEffectsState;
  command: CombatRoundCommand;
  state: CombatRoundState;
} {
  const normalized = combatRoundStateSchema.parse(input.state);
  const currentCombatEffects = combatEffectsStateSchema.parse(input.combatEffects);
  const roundEndReview = normalized.roundEndReview;
  const participantReview = roundEndReview?.participantReviews[input.participantId];

  if (!roundEndReview || roundEndReview.roundNumber !== normalized.roundNumber) {
    throw new RangeError("Round-end review has not been prepared.");
  }

  if (!participantReview || participantReview.status !== "health_roll_pending") {
    throw new RangeError("No round-end health roll is pending for this participant.");
  }

  const healthRoll = participantReview.proposedHealthRolls.find(
    (proposal) =>
      proposal.accepted &&
      proposal.status === "pending" &&
      (!input.healthRollId || proposal.id === input.healthRollId),
  );

  if (!healthRoll) {
    throw new RangeError("No pending round-end health roll matches this participant.");
  }

  const difficulty = input.difficulty ?? healthRoll.difficulty;
  const roll = input.roll ?? rollOpenEndedD20(input.rng);
  const finalTotal = roll.dieResult + healthRoll.healthStat;
  const result = combatRoundEndHealthRollResultSchema.parse({
    difficulty,
    finalTotal,
    healthStat: healthRoll.healthStat,
    openEndedD10s: roll.openEndedD10s,
    rolledAt: input.command.createdAt,
    rolledBy: input.rolledBy ?? "gm_proxy",
    rolledByUserId: input.command.createdByUserId,
    rollD20: roll.rollD20,
    rollTotal: roll.dieResult,
    success: finalTotal >= difficulty,
  });
  const sourceBleedEffect = currentCombatEffects.effects.find(
    (effect) => effect.id === healthRoll.sourceEffectId,
  );
  const previousBleedRate = sourceBleedEffect
    ? getCombatRoundEffectBleedAmount(sourceBleedEffect)
    : healthRoll.previousBleedRate;
  const nextBleedRate =
    result.success && previousBleedRate !== undefined
      ? Math.max(0, previousBleedRate - 1)
      : previousBleedRate;
  const updatedBleedEffect =
    sourceBleedEffect && nextBleedRate !== undefined
      ? combatEffectSchema.parse({
          ...setCombatRoundEffectBleedAmount({
            effect: sourceBleedEffect,
            nextAmount: result.success ? nextBleedRate : (previousBleedRate ?? 0),
            updatedAt: input.command.createdAt,
          }),
          bleedState: combatEffectBleedStateSchema.parse({
            ...sourceBleedEffect.bleedState,
            accumulatedTenths: sourceBleedEffect.bleedState?.accumulatedTenths ?? 0,
            initializedRound:
              sourceBleedEffect.bleedState?.initializedRound ??
              getCombatRoundEffectBleedSourceRound({
                combatEffects: currentCombatEffects,
                effect: sourceBleedEffect,
              }) ??
              normalized.roundNumber,
            lastHealthCheckRound: normalized.roundNumber,
          }),
        })
      : undefined;
  const updatedEffects: CombatRoundEndUpdatedEffectFact[] =
    sourceBleedEffect && updatedBleedEffect
      ? [
          {
            effectId: sourceBleedEffect.id,
            nextEffect: updatedBleedEffect,
            previousEffect: sourceBleedEffect,
          },
        ]
      : [];
  const nextCombatEffects =
    sourceBleedEffect && updatedBleedEffect
      ? combatEffectsStateSchema.parse({
          ...currentCombatEffects,
          effects: currentCombatEffects.effects.map((effect) =>
            effect.id === sourceBleedEffect.id ? updatedBleedEffect : effect,
          ),
        })
      : currentCombatEffects;
  const updatedHealthRolls = participantReview.proposedHealthRolls.map((proposal) =>
    proposal.id === healthRoll.id
      ? combatRoundEndHealthRollProposalSchema.parse({
          ...proposal,
          bleedReduction:
            result.success && previousBleedRate !== undefined && nextBleedRate !== undefined
              ? previousBleedRate - nextBleedRate
              : undefined,
          difficulty,
          nextBleedRate: result.success ? nextBleedRate : undefined,
          previousBleedRate,
          result,
          status: "rolled",
        })
      : proposal,
  );
  const reviewWithoutStatus = {
    ...participantReview,
    proposedHealthRolls: updatedHealthRolls,
  };
  const updatedParticipantReview = combatRoundEndParticipantReviewSchema.parse({
    ...reviewWithoutStatus,
    status: getCombatRoundEndReviewParticipantStatus(reviewWithoutStatus),
  });
  const nextRoundEndReview = combatRoundEndReviewSchema.parse({
    ...roundEndReview,
    participantReviews: {
      ...roundEndReview.participantReviews,
      [input.participantId]: updatedParticipantReview,
    },
  });
  const nextParticipantId = input.participantId;
  const beforeCursor = getCombatRoundEndReviewCursor({
    participantId: input.participantId,
    state: normalized,
  });
  const afterCursor = getCombatRoundEndReviewCursor({
    boundary: !nextParticipantId,
    participantId: nextParticipantId,
    state: normalized,
  });
  const commandType = "roll_round_end_health_check" satisfies CombatRoundCommandType;
  const command = combatRoundCommandSchema.parse({
    afterCursor,
    beforeCursor,
    createdAt: input.command.createdAt,
    createdByUserId: input.command.createdByUserId,
    facts: {
      bleedType: healthRoll.bleedType,
      bleedReduced:
        result.success &&
        previousBleedRate !== undefined &&
        nextBleedRate !== undefined &&
        nextBleedRate < previousBleedRate,
      difficulty,
      finalTotal,
      healthRollId: healthRoll.id,
      healthStat: healthRoll.healthStat,
      nextBleedRate: result.success ? nextBleedRate : undefined,
      openEndedD10s: roll.openEndedD10s,
      previousBleedRate,
      rollD20: roll.rollD20,
      rolledBy: result.rolledBy,
      rollTotal: roll.dieResult,
      sourceEffectId: healthRoll.sourceEffectId,
      success: result.success,
      updatedEffects,
    },
    id:
      input.command.commandId ??
      buildCombatRoundCommandId({
        createdAt: input.command.createdAt,
        participantId: input.participantId,
        state: normalized,
        type: commandType,
      }),
    participantId: input.participantId,
    roundNumber: normalized.roundNumber,
    step: "SU",
    type: commandType,
  });

  return {
    combatEffects: nextCombatEffects,
    command,
    state: combatRoundStateSchema.parse({
      ...normalized,
      commands: [...normalized.commands, command],
      currentCursor: afterCursor,
      currentStep: "round_summary",
      participants: normalized.participants.map((participant) =>
        participant.participantId === input.participantId
          ? {
              ...participant,
              stepStatuses: {
                ...participant.stepStatuses,
                round_summary: "ready",
              },
            }
          : participant,
      ),
      roundEndReview: nextRoundEndReview,
      selectedParticipantId: afterCursor.participantId,
      selectedStep: "round_summary",
    }),
  };
}

function buildCombatRoundEndDistanceRollResult(input: {
  command: {
    createdAt: string;
    createdByUserId?: string;
  };
  rolledAtRound: number;
  rolledBy: "player" | "gm_proxy";
  roll: OpenEndedD20Roll;
  side: CombatRoundEndDistanceControlSide;
}): CombatRoundEndDistanceRollResult {
  const finalTotal =
    input.roll.dieResult + input.side.dodgeSkillTotal + input.side.generalFatigueModifier;

  return combatRoundEndDistanceRollResultSchema.parse({
    dodgeSkillTotal: input.side.dodgeSkillTotal,
    finalTotal,
    generalFatigueModifier: input.side.generalFatigueModifier,
    openEndedD10s: input.roll.openEndedD10s,
    rolledAt: input.command.createdAt,
    rolledAtRound: input.rolledAtRound,
    rolledBy: input.rolledBy,
    rolledByUserId: input.command.createdByUserId,
    rollD20: input.roll.rollD20,
    rollTotal: input.roll.dieResult,
  });
}

function getCombatRoundEndDistanceControlOutcome(
  proposal: CombatRoundEndDistanceProposal,
): Pick<
  CombatRoundEndDistanceProposal,
  "outcome" | "proposedDistance" | "status" | "winnerParticipantId"
> {
  const resultA = proposal.participantA.result;
  const resultB = proposal.participantB.result;

  if (!proposal.requiresContest) {
    return {
      outcome: proposal.outcome,
      proposedDistance: proposal.proposedDistance,
      status: "review_ready",
      winnerParticipantId: proposal.winnerParticipantId,
    };
  }

  if (!resultA || !resultB) {
    return {
      outcome: "contest_pending",
      proposedDistance: undefined,
      status: "pending_rolls",
      winnerParticipantId: undefined,
    };
  }

  if (resultA.finalTotal > resultB.finalTotal) {
    return {
      outcome: "participant_a_wins",
      proposedDistance: proposal.participantA.desiredDistance ?? proposal.currentDistance,
      status: "rolled",
      winnerParticipantId: proposal.participantAId,
    };
  }

  if (resultB.finalTotal > resultA.finalTotal) {
    return {
      outcome: "participant_b_wins",
      proposedDistance: proposal.participantB.desiredDistance ?? proposal.currentDistance,
      status: "rolled",
      winnerParticipantId: proposal.participantBId,
    };
  }

  return {
    outcome: "tie",
    proposedDistance: proposal.currentDistance,
    status: "rolled",
    winnerParticipantId: undefined,
  };
}

export function rollCombatRoundEndDistanceControl(input: {
  command: {
    commandId?: string;
    createdAt: string;
    createdByUserId?: string;
  };
  distanceProposalId?: string;
  participantId: string;
  roll?: OpenEndedD20Roll;
  rolledBy?: "player" | "gm_proxy";
  rng?: () => number;
  state: CombatRoundState;
}): {
  command: CombatRoundCommand;
  state: CombatRoundState;
} {
  const normalized = combatRoundStateSchema.parse(input.state);
  const roundEndReview = normalized.roundEndReview;

  if (!roundEndReview || roundEndReview.roundNumber !== normalized.roundNumber) {
    throw new RangeError("Round-end review has not been prepared.");
  }

  const distanceProposal = roundEndReview.proposedDistances.find(
    (proposal) =>
      proposal.accepted &&
      (proposal.status === "pending_rolls" || proposal.status === "pending") &&
      (!input.distanceProposalId || proposal.id === input.distanceProposalId),
  );

  if (!distanceProposal) {
    throw new RangeError("No pending distance control proposal matches this round.");
  }

  const sideKey =
    distanceProposal.participantAId === input.participantId
      ? "participantA"
      : distanceProposal.participantBId === input.participantId
        ? "participantB"
        : undefined;

  if (!sideKey) {
    throw new RangeError("Participant is not part of this distance control proposal.");
  }

  const side = distanceProposal[sideKey];

  if (side.status !== "pending" || side.result) {
    throw new RangeError("Distance control roll is not pending for this participant.");
  }

  const participantRoll = input.roll ?? rollOpenEndedD20(input.rng);
  const participantResult = buildCombatRoundEndDistanceRollResult({
    command: input.command,
    roll: participantRoll,
    rolledAtRound: normalized.roundNumber,
    rolledBy: input.rolledBy ?? "gm_proxy",
    side,
  });
  const proposalWithRoll = combatRoundEndDistanceProposalSchema.parse({
    ...distanceProposal,
    [sideKey]: {
      ...side,
      result: participantResult,
      status: "rolled",
    },
  });
  const outcome = getCombatRoundEndDistanceControlOutcome(proposalWithRoll);
  const nextProposal = combatRoundEndDistanceProposalSchema.parse({
    ...proposalWithRoll,
    outcome: outcome.outcome,
    proposedDistance: outcome.proposedDistance,
    status: outcome.status,
    winnerParticipantId: outcome.winnerParticipantId,
  });
  const updatedDistanceProposals = roundEndReview.proposedDistances.map((proposal) =>
    proposal.id === distanceProposal.id ? nextProposal : proposal,
  );
  const nextRoundEndReview = combatRoundEndReviewSchema.parse({
    ...roundEndReview,
    proposedDistances: updatedDistanceProposals,
  });
  const beforeCursor = getCombatRoundEndReviewCursor({
    participantId: input.participantId,
    state: normalized,
  });
  const afterCursor = getCombatRoundEndReviewCursor({
    participantId: input.participantId,
    state: normalized,
  });
  const commandType = "roll_round_end_distance_control" satisfies CombatRoundCommandType;
  const command = combatRoundCommandSchema.parse({
    afterCursor,
    beforeCursor,
    createdAt: input.command.createdAt,
    createdByUserId: input.command.createdByUserId,
    facts: {
      currentDistance: distanceProposal.currentDistance,
      distanceProposalId: distanceProposal.id,
      nextProposal,
      outcome: nextProposal.outcome,
      pairKey: distanceProposal.pairKey,
      participantAId: distanceProposal.participantAId,
      participantBId: distanceProposal.participantBId,
      previousProposal: distanceProposal,
      proposedDistance: nextProposal.proposedDistance,
      rolledBy: participantResult.rolledBy,
      rolledParticipantFinalTotal: participantResult.finalTotal,
      rolledParticipantId: input.participantId,
      rolledParticipantRoll: participantResult,
    },
    id:
      input.command.commandId ??
      buildCombatRoundCommandId({
        createdAt: input.command.createdAt,
        participantId: input.participantId,
        state: normalized,
        type: commandType,
      }),
    participantId: input.participantId,
    roundNumber: normalized.roundNumber,
    step: "SU",
    type: commandType,
  });

  return {
    command,
    state: combatRoundStateSchema.parse({
      ...normalized,
      commands: [...normalized.commands, command],
      currentCursor: afterCursor,
      currentStep: "round_summary",
      participants: normalized.participants.map((participant) =>
        participant.participantId === input.participantId
          ? {
              ...participant,
              stepStatuses: {
                ...participant.stepStatuses,
                round_summary: "ready",
              },
            }
          : participant,
      ),
      roundEndReview: nextRoundEndReview,
      selectedParticipantId: afterCursor.participantId,
      selectedStep: "round_summary",
    }),
  };
}

export function commitCombatRoundEndDistanceControl(input: {
  command: {
    commandId?: string;
    createdAt: string;
    createdByUserId?: string;
  };
  distanceOverride?: CombatDistance | number | string;
  distanceProposalId: string;
  participantId?: string;
  state: CombatRoundState;
}): {
  command: CombatRoundCommand;
  state: CombatRoundState;
} {
  const normalized = combatRoundStateSchema.parse(input.state);
  const roundEndReview = normalized.roundEndReview;

  if (!roundEndReview || roundEndReview.roundNumber !== normalized.roundNumber) {
    throw new RangeError("Round-end review has not been prepared.");
  }

  const distanceProposal = roundEndReview.proposedDistances.find(
    (proposal) => proposal.accepted && proposal.id === input.distanceProposalId,
  );

  if (!distanceProposal) {
    throw new RangeError("No distance control proposal matches this round.");
  }

  if (distanceProposal.status === "pending" || distanceProposal.status === "pending_rolls") {
    throw new RangeError("Round-end distance control roll must be resolved before committing.");
  }

  if (distanceProposal.status === "committed") {
    throw new RangeError("Round-end distance control proposal is already committed.");
  }

  const appliedDistance =
    input.distanceOverride !== undefined
      ? combatDistanceSchema.parse(input.distanceOverride)
      : distanceProposal.proposedDistance;

  if (appliedDistance === undefined) {
    throw new RangeError("Round-end distance control has no proposed distance to commit.");
  }

  const previousEdge = getDistanceEdgeBetween(
    normalized.distanceState,
    distanceProposal.participantAId,
    distanceProposal.participantBId,
  );
  const nextDistanceState = setDistanceBetween({
    distance: appliedDistance,
    lastChangedPhase: "round_end",
    lastChangedRound: normalized.roundNumber,
    notes: `Round ${normalized.roundNumber} distance control; applies from round ${distanceProposal.appliesFromRound}.`,
    participantAId: distanceProposal.participantAId,
    participantBId: distanceProposal.participantBId,
    source: "round_end_review",
    state: normalized.distanceState,
  });
  const nextEdge = getDistanceEdgeBetween(
    nextDistanceState,
    distanceProposal.participantAId,
    distanceProposal.participantBId,
  );

  if (!nextEdge) {
    throw new RangeError("Round-end distance control could not apply the distance edge.");
  }

  const nextProposal = combatRoundEndDistanceProposalSchema.parse({
    ...distanceProposal,
    appliedDistance,
    gmOverrideDistance:
      input.distanceOverride !== undefined ? appliedDistance : distanceProposal.gmOverrideDistance,
    outcome: input.distanceOverride !== undefined ? "gm_override" : distanceProposal.outcome,
    status: "committed",
  });
  const nextRoundEndReview = combatRoundEndReviewSchema.parse({
    ...roundEndReview,
    proposedDistances: roundEndReview.proposedDistances.map((proposal) =>
      proposal.id === distanceProposal.id ? nextProposal : proposal,
    ),
  });
  const commandParticipantId =
    input.participantId ??
    normalized.currentCursor?.participantId ??
    distanceProposal.participantAId;
  const beforeCursor = getCombatRoundEndReviewCursor({
    participantId: normalized.currentCursor?.participantId ?? commandParticipantId,
    state: normalized,
  });
  const afterCursor = getCombatRoundEndReviewCursor({
    participantId: beforeCursor.participantId ?? commandParticipantId,
    state: normalized,
  });
  const commandType = "commit_round_end_distance_control" satisfies CombatRoundCommandType;
  const command = combatRoundCommandSchema.parse({
    afterCursor,
    beforeCursor,
    createdAt: input.command.createdAt,
    createdByUserId: input.command.createdByUserId,
    facts: {
      appliedDistance,
      distanceProposalId: distanceProposal.id,
      nextEdge,
      nextProposal,
      pairKey: distanceProposal.pairKey,
      previousEdge,
      previousProposal: distanceProposal,
    },
    id:
      input.command.commandId ??
      buildCombatRoundCommandId({
        createdAt: input.command.createdAt,
        participantId: commandParticipantId,
        state: normalized,
        type: commandType,
      }),
    participantId: commandParticipantId,
    roundNumber: normalized.roundNumber,
    step: "SU",
    type: commandType,
  });

  return {
    command,
    state: combatRoundStateSchema.parse({
      ...normalized,
      commands: [...normalized.commands, command],
      currentCursor: afterCursor,
      currentStep: "round_summary",
      distanceState: nextDistanceState,
      roundEndReview: nextRoundEndReview,
      selectedParticipantId: afterCursor.participantId,
      selectedStep: "round_summary",
    }),
  };
}

export function removeCombatRoundEndHealthCheckEffects(input: {
  combatEffects?: CombatEffectsState;
  command: CombatRoundCommand;
}): CombatEffectsState {
  const currentCombatEffects = combatEffectsStateSchema.parse(input.combatEffects);
  const updatedEffects = Array.isArray(input.command.facts.updatedEffects)
    ? input.command.facts.updatedEffects.filter(isCombatRoundEndUpdatedEffectFact)
    : [];
  const restoredById = new Map(
    updatedEffects
      .map((entry) => {
        const parsed = combatEffectSchema.safeParse(entry.previousEffect);
        return parsed.success ? ([entry.effectId, parsed.data] as const) : undefined;
      })
      .filter((entry): entry is readonly [string, CombatEffect] => entry !== undefined),
  );
  const restoredExisting = currentCombatEffects.effects.map(
    (effect) => restoredById.get(effect.id) ?? effect,
  );
  const missingRestored = [...restoredById.values()].filter(
    (effect) => !restoredExisting.some((existingEffect) => existingEffect.id === effect.id),
  );

  return combatEffectsStateSchema.parse({
    ...currentCombatEffects,
    effects: [...restoredExisting, ...missingRestored],
  });
}

type CombatRoundOperationalCancelledAction = {
  participantId: string;
  phase: CombatRoundPhase;
  previousPhaseResolutionStatus?: CombatRoundPhaseResolutionParticipantStatus;
  previousStepStatus?: CombatRoundStepStatus;
  reason: string;
  sourceCritKey?: string;
  sourceEffectKey?: string;
  step: "A1" | "A2";
};

function isCombatRoundOperationalCancelledAction(
  value: unknown,
): value is CombatRoundOperationalCancelledAction {
  return (
    typeof value === "object" &&
    value !== null &&
    "participantId" in value &&
    "phase" in value &&
    "step" in value &&
    "reason" in value &&
    typeof value.participantId === "string" &&
    (value.phase === "phase1" || value.phase === "phase2") &&
    (value.step === "A1" || value.step === "A2") &&
    typeof value.reason === "string"
  );
}

function getCombatRoundOperationalCancelledActionsFromCommand(
  command: CombatRoundCommand,
): CombatRoundOperationalCancelledAction[] {
  const cancelledActions = command.facts.cancelledActions;

  return Array.isArray(cancelledActions)
    ? cancelledActions.filter(isCombatRoundOperationalCancelledAction)
    : [];
}

function buildCombatRoundOperationalCancelledActions(input: {
  damageResult: CombatRoundDamageResult;
  state: CombatRoundState;
}): CombatRoundOperationalCancelledAction[] {
  const normalized = combatRoundStateSchema.parse(input.state);
  const seen = new Set<string>();
  const actions: CombatRoundOperationalCancelledAction[] = [];

  for (const consequence of getAcceptedCombatRoundOperationalConsequences(input.damageResult)) {
    if (consequence.kind !== "cancel_pending_action" || !consequence.phase || !consequence.step) {
      continue;
    }

    const key = `${consequence.participantId}:${consequence.phase}`;

    if (seen.has(key)) {
      continue;
    }

    const pending = findCombatRoundPendingPhaseAttackCandidate({
      participantId: consequence.participantId,
      phase: consequence.phase,
      state: normalized,
    });

    if (!pending) {
      continue;
    }

    seen.add(key);
    const participant = normalized.participants.find(
      (entry) => entry.participantId === consequence.participantId,
    );
    const actionStep = getCombatRoundPhaseActionStepForPhase(consequence.phase);

    actions.push({
      participantId: consequence.participantId,
      phase: consequence.phase,
      previousPhaseResolutionStatus:
        normalized.phaseResolutionStatuses[consequence.participantId]?.[consequence.phase],
      previousStepStatus: participant?.stepStatuses[actionStep],
      reason: consequence.reason,
      sourceCritKey: consequence.sourceCritKey,
      sourceEffectKey: consequence.sourceEffectKey,
      step: consequence.step,
    });
  }

  return actions;
}

function applyCombatRoundOperationalActionCancellations(input: {
  cancelledActions: readonly CombatRoundOperationalCancelledAction[];
  state: CombatRoundState;
  updatedAt: string;
}): CombatRoundState {
  if (input.cancelledActions.length === 0) {
    return combatRoundStateSchema.parse(input.state);
  }

  const normalized = combatRoundStateSchema.parse(input.state);
  const cancelledByParticipant = new Map<string, CombatRoundOperationalCancelledAction[]>();
  const phaseResolutionStatuses: CombatRoundPhaseResolutionStatuses = {
    ...normalized.phaseResolutionStatuses,
  };

  for (const action of input.cancelledActions) {
    cancelledByParticipant.set(action.participantId, [
      ...(cancelledByParticipant.get(action.participantId) ?? []),
      action,
    ]);
    phaseResolutionStatuses[action.participantId] = {
      ...phaseResolutionStatuses[action.participantId],
      [action.phase]: {
        substep: "done",
        updatedAt: input.updatedAt,
      },
    };
  }

  return combatRoundStateSchema.parse({
    ...normalized,
    phaseResolutionCursor:
      normalized.phaseResolutionCursor &&
      input.cancelledActions.some(
        (action) =>
          action.participantId === normalized.phaseResolutionCursor?.participantId &&
          action.phase === normalized.phaseResolutionCursor.phase,
      )
        ? undefined
        : normalized.phaseResolutionCursor,
    phaseResolutionStatuses,
    participants: normalized.participants.map((participant) => {
      const actions = cancelledByParticipant.get(participant.participantId);

      if (!actions?.length) {
        return participant;
      }

      return {
        ...participant,
        stepStatuses: actions.reduce(
          (statuses, action) => ({
            ...statuses,
            [getCombatRoundPhaseActionStepForPhase(action.phase)]: "skipped" as const,
          }),
          participant.stepStatuses,
        ),
      };
    }),
  });
}

function recordCombatRoundCommitPhaseDamageCommand(input: {
  attackerScenarioParticipantId?: string;
  command: {
    commandId?: string;
    createdAt: string;
    createdByUserId?: string;
  };
  combatEffects?: CombatEffectsState;
  criticalRoll?: CombatRoundCriticalRollResult;
  damageResult: CombatRoundDamageResult;
  defenderScenarioParticipantId: string;
  encounterId?: string;
  scenarioId?: string;
  state: CombatRoundState;
}): {
  combatEffects: CombatEffectsState;
  command: CombatRoundCommand;
  state: CombatRoundState;
} {
  const normalized = combatRoundStateSchema.parse(input.state);
  const acceptedOperationalConsequences = getAcceptedCombatRoundOperationalConsequences(
    input.damageResult,
  );
  const cancelledActions = buildCombatRoundOperationalCancelledActions({
    damageResult: input.damageResult,
    state: normalized,
  });
  const stateWithOperationalCancellations = applyCombatRoundOperationalActionCancellations({
    cancelledActions,
    state: normalized,
    updatedAt: input.command.createdAt,
  });
  const beforeCursor = combatRoundCursorSchema.parse({
    participantId: input.damageResult.defenderParticipantId,
    roundNumber: stateWithOperationalCancellations.roundNumber,
    step: getCombatRoundDamageCursorStepForPhase(input.damageResult.phase),
  });
  const commandId =
    input.command.commandId ??
    buildCombatRoundCommandId({
      createdAt: input.command.createdAt,
      participantId: input.damageResult.defenderParticipantId,
      state: normalized,
      type: "commit_phase_damage",
    });
  const stateForCompletion =
    cancelledActions.length > 0
      ? combatRoundStateSchema.parse({
          ...stateWithOperationalCancellations,
          commands: [
            ...stateWithOperationalCancellations.commands.filter(
              (existingCommand) => existingCommand.id !== commandId,
            ),
            combatRoundCommandSchema.parse({
              afterCursor: beforeCursor,
              beforeCursor,
              createdAt: input.command.createdAt,
              createdByUserId: input.command.createdByUserId,
              facts: { cancelledActions },
              id: commandId,
              participantId: input.damageResult.defenderParticipantId,
              phase: input.damageResult.phase,
              roundNumber: stateWithOperationalCancellations.roundNumber,
              step: beforeCursor.step,
              type: "commit_phase_damage",
            }),
          ],
        })
      : stateWithOperationalCancellations;
  const completed = completeCombatRoundPhaseResolutionForParticipant({
    participantId: input.damageResult.attackerParticipantId,
    phase: input.damageResult.phase,
    state: stateForCompletion,
    submittedBy: "gm",
    updatedAt: input.command.createdAt,
  });
  const afterCursor = getCombatRoundDamageReviewCommandAfterCursor({
    phase: input.damageResult.phase,
    state: completed,
  });
  const effectiveDamage = getCombatRoundEffectiveDamageResult(input.damageResult);
  if (effectiveDamage.requiresTotalDamageOverride) {
    throw new RangeError(
      "Grazing damage review changed the die size; enter a total damage override before committing.",
    );
  }

  if (input.criticalRoll?.status === "pending") {
    throw new RangeError("Critical roll is required before committing phase damage.");
  }

  const damageResultId = getCombatRoundDamageResultId({
    attackResultId: input.damageResult.attackResultId,
  });
  const idInput = {
    attackResultId: input.damageResult.attackResultId,
    commandId,
    damageResultId,
    phase: input.damageResult.phase,
    roundNumber: normalized.roundNumber,
  };
  const createdCombatEffectEventId = buildCombatRoundDamageCommitEventId(idInput);
  const damageLocation = getCombatRoundCommittedDamageLocation(
    effectiveDamage.effectiveSelectedHitLocation,
  );
  const createdDamageEffectIds =
    effectiveDamage.effectiveTotalDamage > 0
      ? [
          buildCombatRoundDamageCommitEffectId({
            ...idInput,
            kind: damageLocation ? `physical-damage-${damageLocation.id}` : "general-damage",
          }),
        ]
      : [];
  const createdAdditionalCombatEffectIds = (input.damageResult.review?.additionalEffects ?? [])
    .filter((effect) => effect.accepted !== false)
    .map((effect) =>
      buildCombatRoundDamageCommitEffectId({
        ...idInput,
        kind: `additional-${effect.id}`,
      }),
    );
  const acceptedAdditionalEffects = (input.damageResult.review?.additionalEffects ?? []).filter(
    (effect) => effect.accepted !== false,
  );
  const operationalEffectConsequences = getCombatRoundOperationalConsequencesCommittedAsEffects({
    additionalEffects: acceptedAdditionalEffects,
    operationalConsequences: acceptedOperationalConsequences,
  });
  const createdOperationalCombatEffectIds = operationalEffectConsequences.map((consequence) =>
    buildCombatRoundDamageCommitEffectId({
      ...idInput,
      kind: `operational-${consequence.id}`,
    }),
  );
  const createdCombatEffectIds = [
    ...createdDamageEffectIds,
    ...createdAdditionalCombatEffectIds,
    ...createdOperationalCombatEffectIds,
  ];
  const command = combatRoundCommandSchema.parse({
    afterCursor,
    beforeCursor,
    createdAt: input.command.createdAt,
    createdByUserId: input.command.createdByUserId,
    facts: {
      attackResultId: input.damageResult.attackResultId,
      attackerParticipantId: input.damageResult.attackerParticipantId,
      additionalEffects: (input.damageResult.review?.additionalEffects ?? []).filter(
        (effect) => effect.accepted !== false,
      ),
      cancelledActions,
      createdAdditionalCombatEffectIds,
      createdCombatEffectEventId,
      createdCombatEffectIds,
      createdDamageEffectIds,
      createdOperationalCombatEffectIds,
      computedCriticalGrade: input.damageResult.criticalGrade,
      computedTotalDamage: input.damageResult.totalDamage,
      preCriticalEffectiveDamage: effectiveDamage.preCriticalEffectiveDamage,
      criticalMinTotalDamage: effectiveDamage.criticalMinTotalDamage,
      criticalMinApplied: effectiveDamage.criticalMinApplied,
      criticalMinExtra: effectiveDamage.criticalMinExtra,
      finalCommittedDamage: effectiveDamage.finalCommittedDamage,
      criticalRoll:
        input.criticalRoll?.status === "rolled"
          ? {
              armorCriticalModifier: input.criticalRoll.armorCriticalModifier,
              criticalDice: input.criticalRoll.criticalDice,
              criticalDiceTotal: input.criticalRoll.criticalDiceTotal,
              criticalGrade: input.criticalRoll.criticalGrade,
              criticalTypeModifier: input.criticalRoll.criticalTypeModifier,
              finalCriticalRoll: getCombatRoundEffectiveCriticalRoll({
                criticalRoll: input.criticalRoll,
                review: input.damageResult.review,
              }).finalCriticalRoll,
              selectedHitLocation: getCombatRoundEffectiveCriticalRoll({
                criticalRoll: input.criticalRoll,
                review: input.damageResult.review,
              }).criticalLocation,
            }
          : undefined,
      criticalGrade: effectiveDamage.effectiveCriticalGrade,
      damageResultId,
      defenderParticipantId: input.damageResult.defenderParticipantId,
      effectiveArmorModifier: effectiveDamage.effectiveArmorModifier,
      effectiveArmorClass: effectiveDamage.effectiveArmorClass,
      effectiveArmorCoverageLabel: effectiveDamage.effectiveArmorCoverageLabel,
      effectiveArmorRegion: effectiveDamage.effectiveArmorRegion,
      effectiveArmorRegionLabel: effectiveDamage.effectiveArmorRegionLabel,
      effectiveArmorValue: effectiveDamage.effectiveArmorValue,
      effectiveArmorWarnings: effectiveDamage.effectiveArmorWarnings,
      effectiveAttackDirection: effectiveDamage.effectiveAttackDirection,
      effectiveCappedTotalDamage: effectiveDamage.effectiveCappedTotalDamage,
      effectiveDamageLookupTotal: effectiveDamage.effectiveDamageLookupTotal,
      effectiveHitLocation: effectiveDamage.effectiveSelectedHitLocation,
      effectiveMinimumDamageAfterArmor: effectiveDamage.effectiveMinimumDamageAfterArmor,
      effectivePhysicalDamageLocation: damageLocation,
      effectiveProvisionalDamageAfterArmor: effectiveDamage.effectiveProvisionalDamageAfterArmor,
      effectiveTableDamage: effectiveDamage.effectiveTableDamage,
      effectiveWeaponArmorClass: effectiveDamage.effectiveWeaponArmorClass,
      maxDamageApplied: effectiveDamage.effectiveMaxDamageApplied,
      maxDamageCap: effectiveDamage.effectiveMaxDamageCap,
      rawTotalDamage: effectiveDamage.effectiveRawTotalDamage,
      operationalConsequences: acceptedOperationalConsequences,
      review: input.damageResult.review,
      status: "committed",
      totalDamage: effectiveDamage.effectiveTotalDamage,
      ...(afterCursor.participantId
        ? {
            nextStepOpened: {
              participantId: afterCursor.participantId,
              step: afterCursor.step,
            },
          }
        : {}),
    },
    id: commandId,
    participantId: input.damageResult.defenderParticipantId,
    phase: input.damageResult.phase,
    roundNumber: normalized.roundNumber,
    step: beforeCursor.step,
    type: "commit_phase_damage",
  });
  const rows = buildCombatRoundDamageCommitRows({
    attackerScenarioParticipantId: input.attackerScenarioParticipantId,
    command,
    combatEffects: input.combatEffects,
    criticalRoll: input.criticalRoll,
    damageResult: input.damageResult,
    defenderScenarioParticipantId: input.defenderScenarioParticipantId,
    encounterId: input.encounterId,
    scenarioId: input.scenarioId,
  });
  const selectedStep = getCombatRoundStepForCursorStep(command.afterCursor.step);
  const stateWithCommittedProposal = {
    ...completed,
    commands: [
      ...completed.commands.filter((existingCommand) => existingCommand.id !== commandId),
      command,
    ],
    currentCursor: command.afterCursor,
    currentStep: selectedStep,
    phaseResolutionResults: completed.phaseResolutionResults.map((result) =>
      result.attackResultId === input.damageResult.attackResultId
        ? combatRoundPhaseResolutionResultSchema.parse({
            ...result,
            damageProposal: {
              committedCombatEffectEventId: rows.eventId,
              committedCombatEffectIds: rows.effectIds,
              proposedEffects: [],
              status: "committed",
            },
            updatedAt: input.command.createdAt,
          })
        : result,
    ),
    selectedParticipantId: command.afterCursor.participantId ?? normalized.selectedParticipantId,
    selectedStep,
  };

  return {
    combatEffects: rows.nextCombatEffects,
    command,
    state: combatRoundStateSchema.parse(stateWithCommittedProposal),
  };
}

function getCombatRoundAttackResultForAttackResultId(input: {
  attackResultId: string;
  state: CombatRoundState;
}): CombatRoundAttackRollResult | undefined {
  const normalized = combatRoundStateSchema.parse(input.state);
  const phases: CombatRoundPhase[] = ["phase1", "phase2"];

  for (const participant of normalized.participants) {
    for (const phase of phases) {
      const result = participant.attackResults[phase];

      if (
        result &&
        getCombatRoundAttackResultId({ result, roundNumber: normalized.roundNumber }) ===
          input.attackResultId
      ) {
        return result;
      }
    }
  }

  return undefined;
}

function getCombatRoundPhaseDamageCommitTarget(input: {
  attackResultId?: string;
  state: CombatRoundState;
}): {
  attackResult?: CombatRoundAttackRollResult;
  damageResult?: CombatRoundDamageResult;
  resolution?: CombatRoundPhaseResolutionResult;
} {
  const normalized = combatRoundStateSchema.parse(input.state);

  if (input.attackResultId) {
    const resolution = normalized.phaseResolutionResults.find(
      (result) => result.attackResultId === input.attackResultId,
    );
    const attackResult = getCombatRoundAttackResultForAttackResultId({
      attackResultId: input.attackResultId,
      state: normalized,
    });

    return {
      attackResult,
      damageResult: resolution?.damageResult,
      resolution,
    };
  }

  if (normalized.phaseResolutionCursor) {
    const attackResult = getCombatRoundDisplayIncomingAttackResultForParticipantPhase({
      participantId: normalized.phaseResolutionCursor.participantId,
      phase: normalized.phaseResolutionCursor.phase,
      state: normalized,
    });
    const resolution = attackResult
      ? getCombatRoundPhaseResolutionResultForAttack({
          attackResult,
          state: normalized,
        })
      : undefined;

    if (resolution?.damageResult) {
      return {
        attackResult,
        damageResult: resolution.damageResult,
        resolution,
      };
    }
  }

  const selectedResolutionPhase = normalized.selectedStep
    ? getCombatRoundResolutionPhaseForStep(normalized.selectedStep)
    : undefined;

  if (normalized.selectedParticipantId && selectedResolutionPhase) {
    const attackResult = getCombatRoundDisplayIncomingAttackResultForParticipantPhase({
      participantId: normalized.selectedParticipantId,
      phase: selectedResolutionPhase,
      state: normalized,
    });
    const resolution = attackResult
      ? getCombatRoundPhaseResolutionResultForAttack({
          attackResult,
          state: normalized,
        })
      : undefined;

    if (resolution?.damageResult) {
      return {
        attackResult,
        damageResult: resolution.damageResult,
        resolution,
      };
    }
  }

  const uncommittedDamageResolutions = normalized.phaseResolutionResults.filter(
    (result) => result.damageResult && result.damageProposal.status !== "committed",
  );

  if (uncommittedDamageResolutions.length === 1) {
    const [resolution] = uncommittedDamageResolutions;
    const attackResult = getCombatRoundAttackResultForAttackResultId({
      attackResultId: resolution.attackResultId,
      state: normalized,
    });

    return {
      attackResult,
      damageResult: resolution.damageResult,
      resolution,
    };
  }

  return {};
}

function getCombatRoundPhaseDamageCommitReadinessDetail(input: {
  attackResultId?: string;
  state: CombatRoundState;
}): CombatRoundPhaseDamageCommitReadiness & {
  attackResult?: CombatRoundAttackRollResult;
  damageResult?: CombatRoundDamageResult;
  resolution?: CombatRoundPhaseResolutionResult;
} {
  const normalized = combatRoundStateSchema.parse(input.state);
  const target = getCombatRoundPhaseDamageCommitTarget({
    attackResultId: input.attackResultId,
    state: normalized,
  });
  const attackResultId =
    input.attackResultId ??
    target.resolution?.attackResultId ??
    target.damageResult?.attackResultId;
  const damageResult = target.damageResult;
  const resolution = target.resolution;
  const effectiveDamage = damageResult
    ? getCombatRoundEffectiveDamageResult(damageResult)
    : undefined;
  const warnings = [
    ...(damageResult?.review?.criticalEffectProposal?.warnings ?? []).map(
      (warning) => `Critical effects unavailable: ${warning}`,
    ),
    ...(effectiveDamage?.effectiveArmorWarnings ?? []),
  ];

  if (damageResult?.armorModifierSource.status === "not_applied") {
    warnings.push(damageResult.armorModifierSource.reason ?? "Armor modifier is not applied yet.");
  }

  if (
    resolution?.criticalRoll.status === "rolled" &&
    resolution.criticalRoll.armorCriticalModifierSource.status === "not_applied"
  ) {
    warnings.push(
      resolution.criticalRoll.armorCriticalModifierSource.reason ??
        "Armor critical modifier is not applied yet.",
    );
  }

  if (damageResult && !effectiveDamage?.effectiveSelectedHitLocation) {
    warnings.push("No effective hit location is available; committing General damage.");
  }

  if (
    damageResult?.review?.totalDamageOverride !== undefined &&
    effectiveDamage?.criticalMinTotalDamage !== undefined &&
    damageResult.review.totalDamageOverride < effectiveDamage.criticalMinTotalDamage
  ) {
    warnings.push(
      `GM damage override ${damageResult.review.totalDamageOverride} is below critical minimum ${effectiveDamage.criticalMinTotalDamage}; the override will commit as final.`,
    );
  }

  if (effectiveDamage?.effectiveCriticalGrade && !damageResult?.review?.criticalEffectProposal) {
    warnings.push("Critical effects unavailable: no critical effect proposal was generated.");
  }

  if (!resolution || !damageResult) {
    return {
      ...target,
      attackResultId,
      ready: false,
      reason: "Cannot commit: no damage proposal exists.",
      warnings,
    };
  }

  if (!target.attackResult) {
    return {
      ...target,
      attackResultId,
      ready: false,
      reason: "Cannot commit: attack result is missing.",
      warnings,
    };
  }

  if (resolution.damageProposal.status === "committed") {
    return {
      ...target,
      attackResultId,
      ready: false,
      reason: "Cannot commit: phase damage is already committed.",
      warnings,
    };
  }

  if (resolution.hitLocationRoll.status !== "rolled") {
    return {
      ...target,
      attackResultId,
      ready: false,
      reason: "Cannot commit: hit location roll is missing.",
      warnings,
    };
  }

  if (resolution.criticalRoll.status !== "rolled" && effectiveDamage?.effectiveCriticalGrade) {
    return {
      ...target,
      attackResultId,
      ready: false,
      reason: "Cannot commit: critical roll is required.",
      warnings,
    };
  }

  if (effectiveDamage?.requiresTotalDamageOverride) {
    return {
      ...target,
      attackResultId,
      ready: false,
      reason:
        "Cannot commit: grazing damage review changed the die size; enter a total damage override.",
      warnings,
    };
  }

  if (!effectiveDamage || !Number.isFinite(effectiveDamage.effectiveTotalDamage)) {
    return {
      ...target,
      attackResultId,
      ready: false,
      reason: "Cannot commit: effective damage is missing.",
      warnings,
    };
  }

  return {
    ...target,
    attackResultId,
    ready: true,
    warnings,
  };
}

export function getCombatRoundPhaseDamageCommitReadiness(input: {
  attackResultId?: string;
  state: CombatRoundState;
}): CombatRoundPhaseDamageCommitReadiness {
  const readiness = getCombatRoundPhaseDamageCommitReadinessDetail(input);

  return {
    attackResultId: readiness.attackResultId,
    ready: readiness.ready,
    reason: readiness.reason,
    warnings: readiness.warnings,
  };
}

export function commitCombatRoundPhaseDamage(input: {
  attackResultId?: string;
  attackerScenarioParticipantId?: string;
  command: {
    commandId?: string;
    createdAt: string;
    createdByUserId?: string;
  };
  combatEffects?: CombatEffectsState;
  defenderScenarioParticipantId: string;
  encounterId?: string;
  scenarioId?: string;
  state: CombatRoundState;
}): {
  combatEffects: CombatEffectsState;
  command: CombatRoundCommand;
  state: CombatRoundState;
} {
  const normalized = combatRoundStateSchema.parse(input.state);
  const readiness = getCombatRoundPhaseDamageCommitReadinessDetail({
    attackResultId: input.attackResultId,
    state: normalized,
  });

  if (!readiness.ready) {
    throw new RangeError(readiness.reason ?? "Cannot commit: phase damage is not ready.");
  }

  if (!readiness.damageResult || !readiness.resolution) {
    throw new RangeError("Cannot commit: no damage proposal exists.");
  }

  return recordCombatRoundCommitPhaseDamageCommand({
    attackerScenarioParticipantId: input.attackerScenarioParticipantId,
    command: input.command,
    combatEffects: input.combatEffects,
    criticalRoll: readiness.resolution.criticalRoll,
    damageResult: readiness.damageResult,
    defenderScenarioParticipantId: input.defenderScenarioParticipantId,
    encounterId: input.encounterId,
    scenarioId: input.scenarioId,
    state: normalized,
  });
}

function getCombatRoundDamageReviewCommandTypeForPhase(
  phase: CombatRoundPhase,
): CombatRoundCommandType {
  return phase === "phase1" ? "complete_damage_review_phase1" : "complete_damage_review_phase2";
}

function getCombatRoundDamageReviewCommandAfterCursor(input: {
  phase: CombatRoundPhase;
  state: CombatRoundState;
}): CombatRoundCursor {
  return getCombatRoundPhaseActionOrCompletionCursor(input);
}

function recordCombatRoundDamageReviewCommand(input: {
  attackResult: CombatRoundAttackRollResult;
  command: {
    commandId?: string;
    createdAt: string;
    createdByUserId?: string;
  };
  state: CombatRoundState;
}): CombatRoundState {
  const normalized = combatRoundStateSchema.parse(input.state);
  const beforeCursor = combatRoundCursorSchema.parse({
    participantId: input.attackResult.defenderParticipantId,
    roundNumber: normalized.roundNumber,
    step: getCombatRoundDamageCursorStepForPhase(input.attackResult.phase),
  });
  const afterCursor = getCombatRoundDamageReviewCommandAfterCursor({
    phase: input.attackResult.phase,
    state: normalized,
  });
  const commandType = getCombatRoundDamageReviewCommandTypeForPhase(input.attackResult.phase);
  const command = combatRoundCommandSchema.parse({
    afterCursor,
    beforeCursor,
    createdAt: input.command.createdAt,
    createdByUserId: input.command.createdByUserId,
    facts: {
      attackResultId: getCombatRoundAttackResultId({
        result: input.attackResult,
        roundNumber: normalized.roundNumber,
      }),
      attackerParticipantId: input.attackResult.attackerParticipantId,
      defenderParticipantId: input.attackResult.defenderParticipantId,
      status: "deferred",
      ...(afterCursor.participantId
        ? {
            nextStepOpened: {
              participantId: afterCursor.participantId,
              step: afterCursor.step,
            },
          }
        : {}),
    },
    id:
      input.command.commandId ??
      buildCombatRoundCommandId({
        createdAt: input.command.createdAt,
        participantId: input.attackResult.defenderParticipantId,
        state: normalized,
        type: commandType,
      }),
    participantId: input.attackResult.defenderParticipantId,
    phase: input.attackResult.phase,
    roundNumber: normalized.roundNumber,
    step: beforeCursor.step,
    type: commandType,
  });
  const selectedStep = getCombatRoundStepForCursorStep(command.afterCursor.step);

  return {
    ...normalized,
    commands: [...normalized.commands, command],
    currentCursor: command.afterCursor,
    currentStep: selectedStep,
    selectedParticipantId: command.afterCursor.participantId ?? normalized.selectedParticipantId,
    selectedStep,
  };
}

export function recordCombatRoundDamageReviewPlaceholder(input: {
  attackResult: CombatRoundAttackRollResult;
  command?: {
    commandId?: string;
    createdAt: string;
    createdByUserId?: string;
  };
  state: CombatRoundState;
  submittedBy: "gm" | "player";
  updatedAt: string;
}): CombatRoundState {
  const normalized = combatRoundStateSchema.parse(input.state);
  const resolution = getCombatRoundPhaseResolutionResultForAttack({
    attackResult: input.attackResult,
    state: normalized,
  });

  if (!input.attackResult.hit) {
    throw new RangeError("Damage review cannot be completed for a missed attack.");
  }

  if (
    !resolution ||
    resolution.parryResolution.status !== "resolved" ||
    resolution.parryResolution.success !== false ||
    resolution.damageRoll.status !== "pending"
  ) {
    throw new RangeError("Damage review is not pending for this attack.");
  }

  const withCompletedReview = completeCombatRoundPhaseResolutionForParticipant({
    participantId: input.attackResult.attackerParticipantId,
    phase: input.attackResult.phase,
    state: normalized,
    submittedBy: input.submittedBy,
    updatedAt: input.updatedAt,
  });

  return input.command
    ? recordCombatRoundDamageReviewCommand({
        attackResult: input.attackResult,
        command: input.command,
        state: withCompletedReview,
      })
    : withCompletedReview;
}

function combatRoundStateHasPhaseResolutionEvidence(input: {
  commands: CombatRoundCommand[];
  currentStep: CombatRoundStep;
  cursor: CombatRoundPhaseResolutionCursor;
  participants: CombatRoundParticipantState[];
  phaseResolutionResults: CombatRoundPhaseResolutionResult[];
  phaseResolutionStatuses: CombatRoundPhaseResolutionStatuses;
  roundNumber: number;
  stepSnapshots: CombatRoundStepSnapshot[];
  validTargetIds: Set<string>;
}): boolean {
  const cursorStep = getCombatRoundStepForCursorStep(
    getCombatRoundCursorStepForPhaseResolutionSubstep({
      phase: input.cursor.phase,
      substep: input.cursor.substep,
    }),
  );

  if (cursorStep !== input.currentStep) {
    return false;
  }

  if (
    input.cursor.substep === "attack" &&
    !combatRoundCursorHasValidPhaseAttackTarget({
      cursor: input.cursor,
      participants: input.participants,
      validTargetIds: input.validTargetIds,
    })
  ) {
    return false;
  }

  if (
    input.commands.some((command) =>
      combatRoundCommandSupportsPhaseResolutionCursor({
        command,
        cursor: input.cursor,
        roundNumber: input.roundNumber,
      }),
    )
  ) {
    return true;
  }

  if (
    input.phaseResolutionResults.some(
      (result) =>
        result.roundNumber === input.roundNumber &&
        result.phase === input.cursor.phase &&
        (result.attackerParticipantId === input.cursor.participantId ||
          result.defenderParticipantId === input.cursor.participantId),
    )
  ) {
    return true;
  }

  if (
    input.participants.some((participant) => {
      const result = participant.attackResults[input.cursor.phase];

      return (
        result !== undefined &&
        (result.attackerParticipantId === input.cursor.participantId ||
          result.defenderParticipantId === input.cursor.participantId)
      );
    })
  ) {
    return true;
  }

  if (input.cursor.substep === "attack") {
    const setupCommandType =
      input.cursor.phase === "phase1" ? "roll_initiative_phase1" : "roll_initiative_phase2";

    return input.commands.some(
      (command) => command.roundNumber === input.roundNumber && command.type === setupCommandType,
    );
  }

  return false;
}

function combatRoundCommandSupportsPhaseResolutionCursor(input: {
  command: CombatRoundCommand;
  cursor: CombatRoundPhaseResolutionCursor;
  roundNumber: number;
}): boolean {
  if (input.command.roundNumber !== input.roundNumber) {
    return false;
  }

  if (input.command.phase === input.cursor.phase) {
    return true;
  }

  const cursorSteps = new Set<CombatRoundCursorStep>([
    getCombatRoundAttackCursorStepForPhase(input.cursor.phase),
    getCombatRoundParryCursorStepForPhase(input.cursor.phase),
    getCombatRoundDamageCursorStepForPhase(input.cursor.phase),
  ]);

  return (
    cursorSteps.has(input.command.beforeCursor.step) ||
    cursorSteps.has(input.command.afterCursor.step)
  );
}

function combatRoundCursorHasValidPhaseAttackTarget(input: {
  cursor: CombatRoundPhaseResolutionCursor;
  participants: CombatRoundParticipantState[];
  validTargetIds: Set<string>;
}): boolean {
  const participant = input.participants.find(
    (entry) => entry.participantId === input.cursor.participantId,
  );
  const declaration = participant?.declaration;
  const targetParticipantId = declaration?.phaseContexts?.[input.cursor.phase]?.targetParticipantId;

  return Boolean(
    declaration &&
    getCombatDeclarationAttackPhases({
      actionId: declaration.actionId,
      secondaryActionId: declaration.secondaryActionId,
    }).includes(input.cursor.phase) &&
    targetParticipantId &&
    input.validTargetIds.has(targetParticipantId),
  );
}

function combatRoundCursorsMatch(left?: CombatRoundCursor, right?: CombatRoundCursor): boolean {
  return Boolean(
    left &&
    right &&
    left.roundNumber === right.roundNumber &&
    left.step === right.step &&
    left.participantId === right.participantId,
  );
}

function getLatestValidCombatRoundCommandCursor(input: {
  commands: CombatRoundCommand[];
  participantIds: Set<string>;
  roundNumber: number;
}): CombatRoundCursor | undefined {
  for (let index = input.commands.length - 1; index >= 0; index -= 1) {
    const command = input.commands[index];

    if (command?.roundNumber !== input.roundNumber) {
      continue;
    }

    if (
      command.afterCursor.participantId &&
      !input.participantIds.has(command.afterCursor.participantId)
    ) {
      continue;
    }

    return command.afterCursor;
  }

  return undefined;
}

function combatRoundCurrentCursorHasSupport(input: {
  commands: CombatRoundCommand[];
  currentStep: CombatRoundStep;
  cursor: CombatRoundCursor;
  existingPhaseResolutionCursor?: CombatRoundPhaseResolutionCursor;
  participants: CombatRoundParticipantState[];
  participantIds: Set<string>;
  phaseResolutionResults: CombatRoundPhaseResolutionResult[];
  phaseResolutionStatuses: CombatRoundPhaseResolutionStatuses;
  roundNumber: number;
  stepSnapshots: CombatRoundStepSnapshot[];
  validTargetIds: Set<string>;
}): boolean {
  const cursorStep = getCombatRoundStepForCursorStep(input.cursor.step);

  if (
    input.cursor.roundNumber !== input.roundNumber ||
    cursorStep !== input.currentStep ||
    (input.cursor.participantId && !input.participantIds.has(input.cursor.participantId))
  ) {
    return false;
  }

  if (isGlobalCombatRoundStep(input.currentStep)) {
    return true;
  }

  if (
    input.commands.some((command) => combatRoundCursorsMatch(command.afterCursor, input.cursor))
  ) {
    return true;
  }

  if (!input.existingPhaseResolutionCursor) {
    return false;
  }

  const phaseCursorStep = getCombatRoundStepForCursorStep(
    getCombatRoundCursorStepForPhaseResolutionSubstep({
      phase: input.existingPhaseResolutionCursor.phase,
      substep: input.existingPhaseResolutionCursor.substep,
    }),
  );

  if (
    phaseCursorStep !== input.currentStep ||
    input.existingPhaseResolutionCursor.participantId !== input.cursor.participantId
  ) {
    return false;
  }

  return combatRoundStateHasPhaseResolutionEvidence({
    commands: input.commands,
    currentStep: input.currentStep,
    cursor: input.existingPhaseResolutionCursor,
    participants: input.participants,
    phaseResolutionResults: input.phaseResolutionResults,
    phaseResolutionStatuses: input.phaseResolutionStatuses,
    roundNumber: input.roundNumber,
    stepSnapshots: input.stepSnapshots,
    validTargetIds: input.validTargetIds,
  });
}

function resetCombatRoundPhaseProgress(
  participant: CombatRoundParticipantState,
): CombatRoundParticipantState {
  return {
    ...participant,
    attackResults: {},
    stepStatuses: {
      ...participant.stepStatuses,
      phase_1_actions: "pending",
      phase_1_damage: "pending",
      phase_2_actions: "pending",
      phase_2_damage: "pending",
      review_phase_2_actions: "pending",
      review_phase_2_damage: "pending",
    },
  };
}

function resetCombatRoundParticipantToRoundStart(
  participant: CombatRoundParticipantState,
): CombatRoundParticipantState {
  return {
    ...participant,
    attackResults: {},
    combatExperience: undefined,
    declaration: undefined,
    initiatives: {},
    stepStatuses: buildDefaultStepStatuses(),
  };
}

function normalizeCompletedCombatRounds(input: {
  activeRoundNumber: number;
  participantIds: Set<string>;
  rounds?: CompletedCombatRound[];
}): CompletedCombatRound[] {
  return (input.rounds ?? [])
    .filter((round) => round.roundNumber < input.activeRoundNumber)
    .map((round) => {
      const participants = round.participants.filter((participant) =>
        input.participantIds.has(participant.participantId),
      );
      const commands = round.commands.filter(
        (command) =>
          command.roundNumber === round.roundNumber &&
          input.participantIds.has(command.participantId) &&
          (!command.beforeCursor.participantId ||
            input.participantIds.has(command.beforeCursor.participantId)) &&
          (!command.afterCursor.participantId ||
            input.participantIds.has(command.afterCursor.participantId)),
      );
      const phaseResolutionResults = round.phaseResolutionResults.filter(
        (result) =>
          result.roundNumber === round.roundNumber &&
          input.participantIds.has(result.attackerParticipantId) &&
          input.participantIds.has(result.defenderParticipantId),
      );
      const phaseResolutionStatuses = Object.fromEntries(
        Object.entries(round.phaseResolutionStatuses).filter(([participantId]) =>
          input.participantIds.has(participantId),
        ),
      );
      const stepSnapshots = round.stepSnapshots.filter(
        (snapshot) =>
          snapshot.roundNumber === round.roundNumber &&
          input.participantIds.has(snapshot.participantId),
      );
      const currentCursor =
        round.currentCursor &&
        round.currentCursor.roundNumber === round.roundNumber &&
        (!round.currentCursor.participantId ||
          input.participantIds.has(round.currentCursor.participantId))
          ? round.currentCursor
          : undefined;
      const selectedParticipantId =
        round.selectedParticipantId && input.participantIds.has(round.selectedParticipantId)
          ? round.selectedParticipantId
          : participants[0]?.participantId;
      const activeParticipantId =
        round.activeParticipantId && input.participantIds.has(round.activeParticipantId)
          ? round.activeParticipantId
          : undefined;
      const phaseResolutionCursor =
        round.phaseResolutionCursor &&
        input.participantIds.has(round.phaseResolutionCursor.participantId)
          ? round.phaseResolutionCursor
          : undefined;
      const roundEndReview = round.roundEndReview
        ? combatRoundEndReviewSchema.parse({
            ...round.roundEndReview,
            participantReviews: Object.fromEntries(
              Object.entries(round.roundEndReview.participantReviews).filter(([participantId]) =>
                input.participantIds.has(participantId),
              ),
            ),
          })
        : undefined;

      return completedCombatRoundSchema.parse({
        ...round,
        activeParticipantId,
        commands,
        currentCursor,
        distanceState: filterCombatDistanceStateForParticipantIds({
          participants,
          participantIds: input.participantIds,
          state: round.distanceState,
        }),
        phaseResolutionCursor,
        phaseResolutionResults,
        phaseResolutionStatuses,
        participants,
        roundEndReview,
        selectedParticipantId,
        stepSnapshots,
      });
    })
    .sort((left, right) => left.roundNumber - right.roundNumber);
}

function filterCombatDistanceStateForParticipantIds(input: {
  participants?: readonly CombatDistanceParticipantAliasLike[];
  participantIds: Set<string>;
  state?: CombatDistanceState;
}): CombatDistanceState {
  const parsed = combatDistanceStateSchema.parse(input.state ?? {});
  const canonicalParticipantIdByAlias = new Map<string, string>();

  for (const participantId of input.participantIds) {
    canonicalParticipantIdByAlias.set(participantId, participantId);
  }

  for (const participant of input.participants ?? []) {
    const canonicalParticipantId = participant.participantId ?? participant.id;

    if (!canonicalParticipantId || !input.participantIds.has(canonicalParticipantId)) {
      continue;
    }

    for (const alias of getCombatDistanceParticipantAliases(participant)) {
      canonicalParticipantIdByAlias.set(alias, canonicalParticipantId);
    }
  }

  const edges: Record<string, CombatDistanceEdge> = {};

  for (const edge of Object.values(parsed.edges)) {
    const participantAId = canonicalParticipantIdByAlias.get(edge.participantAId);
    const participantBId = canonicalParticipantIdByAlias.get(edge.participantBId);

    if (!participantAId || !participantBId || participantAId === participantBId) {
      continue;
    }

    const pairKey = makeDistancePairKey(participantAId, participantBId);
    const [normalizedParticipantAId, normalizedParticipantBId] = pairKey.split("::");

    if (!normalizedParticipantAId || !normalizedParticipantBId) {
      continue;
    }

    const nextEdge = combatDistanceEdgeSchema.parse({
      ...edge,
      pairKey,
      participantAId: normalizedParticipantAId,
      participantBId: normalizedParticipantBId,
    });

    const existingEdge = edges[pairKey];

    if (existingEdge) {
      const existingIsFallbackDefault =
        existingEdge.source === "default_weapon_reach" &&
        existingEdge.notes?.includes("metadata was missing or invalid");
      const nextIsFallbackDefault =
        nextEdge.source === "default_weapon_reach" &&
        nextEdge.notes?.includes("metadata was missing or invalid");
      const edgeAlreadyUsesCanonicalIds =
        input.participantIds.has(edge.participantAId) &&
        input.participantIds.has(edge.participantBId);

      if (!existingIsFallbackDefault && nextIsFallbackDefault) {
        continue;
      }

      if (!existingIsFallbackDefault && !edgeAlreadyUsesCanonicalIds) {
        continue;
      }
    }

    edges[pairKey] = nextEdge;
  }

  return combatDistanceStateSchema.parse({ edges });
}

function buildCompletedCombatRound(input: {
  completedAt?: string;
  completedByUserId?: string;
  state: CombatRoundState;
}): CompletedCombatRound {
  const normalized = combatRoundStateSchema.parse(input.state);

  return completedCombatRoundSchema.parse({
    activeParticipantId: normalized.activeParticipantId,
    commands: normalized.commands,
    completedAt: input.completedAt,
    completedByUserId: input.completedByUserId,
    currentCursor: normalized.currentCursor,
    currentStep: normalized.currentStep,
    distanceState: normalized.distanceState,
    encounterId: normalized.encounterId,
    phaseResolutionCursor: normalized.phaseResolutionCursor,
    phaseResolutionResults: normalized.phaseResolutionResults,
    phaseResolutionStatuses: normalized.phaseResolutionStatuses,
    participants: normalized.participants,
    roundEndReview: normalized.roundEndReview,
    roundNumber: normalized.roundNumber,
    selectedParticipantId: normalized.selectedParticipantId,
    selectedStep: normalized.selectedStep,
    stepSnapshots: normalized.stepSnapshots,
  });
}

function getFallbackCombatRoundCursor(input: {
  commands: CombatRoundCommand[];
  participantId?: string;
  participantIds: Set<string>;
  roundNumber: number;
}): CombatRoundCursor {
  return (
    getLatestValidCombatRoundCommandCursor({
      commands: input.commands,
      participantIds: input.participantIds,
      roundNumber: input.roundNumber,
    }) ??
    getDefaultCombatRoundCursor({
      participantId: input.participantId,
      roundNumber: input.roundNumber,
      step: "select_actions",
    })
  );
}

function getUnsupportedCombatRoundPhaseStepRecoveryCursor(input: {
  commands: CombatRoundCommand[];
  currentCursor?: CombatRoundCursor;
  currentStep: CombatRoundStep;
  encounterId?: string;
  existingPhaseResolutionCursor?: CombatRoundPhaseResolutionCursor;
  participants: CombatRoundParticipantState[];
  phaseResolutionResults: CombatRoundPhaseResolutionResult[];
  phaseResolutionStatuses: CombatRoundPhaseResolutionStatuses;
  roundNumber: number;
  selectedParticipantId?: string;
  selectedStep?: CombatRoundStep;
  stepSnapshots: CombatRoundStepSnapshot[];
}): CombatRoundCursor | undefined {
  const phase = getCombatRoundAttackPhaseForStep(input.currentStep);

  if (!phase || input.commands.length === 0) {
    return undefined;
  }

  const recoveryState = combatRoundStateSchema.parse({
    commands: input.commands,
    currentCursor: input.currentCursor,
    currentStep: input.currentStep,
    encounterId: input.encounterId,
    phaseResolutionCursor: input.existingPhaseResolutionCursor,
    phaseResolutionResults: input.phaseResolutionResults,
    phaseResolutionStatuses: input.phaseResolutionStatuses,
    participants: input.participants,
    roundNumber: input.roundNumber,
    selectedParticipantId: input.selectedParticipantId,
    selectedStep: input.selectedStep,
    stepSnapshots: input.stepSnapshots,
  });

  if (
    !isCombatRoundPhaseInitiativeComplete({
      phase,
      state: recoveryState,
    })
  ) {
    return undefined;
  }

  return getCombatRoundPhaseActionOrCompletionCursor({
    phase,
    state: recoveryState,
  });
}

function combatRoundStateHasUnsupportedPhaseStep(input: {
  commands: CombatRoundCommand[];
  currentStep: CombatRoundStep;
  currentCursor?: CombatRoundCursor;
  existingPhaseResolutionCursor?: CombatRoundPhaseResolutionCursor;
  participants: CombatRoundParticipantState[];
  participantIds: Set<string>;
  phaseResolutionResults: CombatRoundPhaseResolutionResult[];
  phaseResolutionStatuses: CombatRoundPhaseResolutionStatuses;
  roundNumber: number;
  stepSnapshots: CombatRoundStepSnapshot[];
  validTargetIds: Set<string>;
}): boolean {
  if (isGlobalCombatRoundStep(input.currentStep)) {
    return false;
  }

  if (
    input.currentCursor &&
    combatRoundCurrentCursorHasSupport({
      commands: input.commands,
      currentStep: input.currentStep,
      cursor: input.currentCursor,
      existingPhaseResolutionCursor: input.existingPhaseResolutionCursor,
      participants: input.participants,
      participantIds: input.participantIds,
      phaseResolutionResults: input.phaseResolutionResults,
      phaseResolutionStatuses: input.phaseResolutionStatuses,
      roundNumber: input.roundNumber,
      stepSnapshots: input.stepSnapshots,
      validTargetIds: input.validTargetIds,
    })
  ) {
    return false;
  }

  if (
    input.existingPhaseResolutionCursor &&
    combatRoundStateHasPhaseResolutionEvidence({
      commands: input.commands,
      currentStep: input.currentStep,
      cursor: input.existingPhaseResolutionCursor,
      participants: input.participants,
      phaseResolutionResults: input.phaseResolutionResults,
      phaseResolutionStatuses: input.phaseResolutionStatuses,
      roundNumber: input.roundNumber,
      stepSnapshots: input.stepSnapshots,
      validTargetIds: input.validTargetIds,
    })
  ) {
    return false;
  }

  return true;
}

export function initializeCombatRoundState(input: {
  encounter: Pick<EncounterSession, "combatRoundState" | "currentRound" | "id" | "participants">;
  weaponsByParticipantId?: Record<string, readonly (CombatDistanceWeaponLike | undefined | null)[]>;
}): CombatRoundState {
  const parsedExisting = input.encounter.combatRoundState
    ? combatRoundStateSchema.parse(input.encounter.combatRoundState)
    : undefined;
  const existing =
    parsedExisting?.encounterId && parsedExisting.encounterId !== input.encounter.id
      ? undefined
      : parsedExisting;
  const existingByParticipantId = new Map(
    existing?.participants.map((participant) => [participant.participantId, participant]) ?? [],
  );
  const validTargetIds = getCombatRoundEncounterTargetIds(input.encounter.participants);
  const targetRepairParticipantIds = new Set<string>();
  const participants = input.encounter.participants.map((participant) => {
    const sanitized = sanitizeCombatRoundDeclarationTargets({
      participant: participantStateFromEncounterParticipant({
        existing: existingByParticipantId.get(participant.id),
        participant,
      }),
      validTargetIds,
    });

    if (sanitized.repaired) {
      targetRepairParticipantIds.add(sanitized.participant.participantId);
    }

    return sanitized.participant;
  });
  const participantIds = new Set(participants.map((participant) => participant.participantId));
  const persistedCurrentStep = existing?.currentStep ?? "select_actions";
  const roundNumber = existing?.roundNumber ?? input.encounter.currentRound;
  const completedRounds = normalizeCompletedCombatRounds({
    activeRoundNumber: roundNumber,
    participantIds,
    rounds: existing?.rounds,
  });
  const distanceState = ensureDistanceEdgesForParticipantPairs({
    lastChangedRound: roundNumber,
    participantIds: [...participantIds],
    refreshFallbackDefaultEdges: Boolean(input.weaponsByParticipantId),
    state: filterCombatDistanceStateForParticipantIds({
      participants,
      participantIds,
      state: existing?.distanceState,
    }),
    weaponsByParticipantId: input.weaponsByParticipantId,
  });
  const commands = (existing?.commands ?? []).filter(
    (command) =>
      command.roundNumber === roundNumber &&
      participantIds.has(command.participantId) &&
      (!command.beforeCursor.participantId ||
        participantIds.has(command.beforeCursor.participantId)) &&
      (!command.afterCursor.participantId || participantIds.has(command.afterCursor.participantId)),
  );
  const phaseResolutionResults = (existing?.phaseResolutionResults ?? []).filter(
    (result) =>
      result.roundNumber === roundNumber &&
      participantIds.has(result.attackerParticipantId) &&
      participantIds.has(result.defenderParticipantId),
  );
  const phaseResolutionStatuses = Object.fromEntries(
    Object.entries(existing?.phaseResolutionStatuses ?? {}).filter(([participantId]) =>
      participantIds.has(participantId),
    ),
  );
  const stepSnapshots = (existing?.stepSnapshots ?? []).filter(
    (snapshot) =>
      snapshot.roundNumber === roundNumber && participantIds.has(snapshot.participantId),
  );
  const roundEndReview =
    existing?.roundEndReview?.roundNumber === roundNumber
      ? combatRoundEndReviewSchema.parse({
          ...existing.roundEndReview,
          participantReviews: Object.fromEntries(
            Object.entries(existing.roundEndReview.participantReviews).filter(([participantId]) =>
              participantIds.has(participantId),
            ),
          ),
        })
      : undefined;
  const existingPhaseResolutionCursorCandidate =
    existing?.phaseResolutionCursor &&
    participantIds.has(existing.phaseResolutionCursor.participantId)
      ? existing.phaseResolutionCursor
      : undefined;
  const repairsUnsupportedPhaseStep = combatRoundStateHasUnsupportedPhaseStep({
    commands,
    currentCursor: existing?.currentCursor,
    currentStep: persistedCurrentStep,
    existingPhaseResolutionCursor: existingPhaseResolutionCursorCandidate,
    participants,
    participantIds,
    phaseResolutionResults,
    phaseResolutionStatuses,
    roundNumber,
    stepSnapshots,
    validTargetIds,
  });
  const targetRepairCursor =
    repairsUnsupportedPhaseStep && targetRepairParticipantIds.size > 0
      ? getDefaultCombatRoundCursor({
          participantId: [...targetRepairParticipantIds][0] ?? participants[0]?.participantId,
          roundNumber,
          step: "select_actions",
        })
      : undefined;
  const phaseStepRecoveryCursor =
    repairsUnsupportedPhaseStep && !targetRepairCursor
      ? getUnsupportedCombatRoundPhaseStepRecoveryCursor({
          commands,
          currentCursor: existing?.currentCursor,
          currentStep: persistedCurrentStep,
          encounterId: input.encounter.id,
          existingPhaseResolutionCursor: existingPhaseResolutionCursorCandidate,
          participants,
          phaseResolutionResults,
          phaseResolutionStatuses,
          roundNumber,
          selectedParticipantId: existing?.selectedParticipantId,
          selectedStep: existing?.selectedStep,
          stepSnapshots,
        })
      : undefined;
  const fallbackCursor = targetRepairCursor
    ? targetRepairCursor
    : phaseStepRecoveryCursor
      ? phaseStepRecoveryCursor
      : repairsUnsupportedPhaseStep
        ? getFallbackCombatRoundCursor({
            commands,
            participantId: participants[0]?.participantId,
            participantIds,
            roundNumber,
          })
        : undefined;
  const phaseStepRecoveryPhase = phaseStepRecoveryCursor
    ? getCombatRoundAttackPhaseForStep(
        getCombatRoundStepForCursorStep(phaseStepRecoveryCursor.step),
      )
    : undefined;
  const fallbackPhaseResolutionCursor =
    phaseStepRecoveryCursor?.participantId && phaseStepRecoveryPhase
      ? combatRoundPhaseResolutionCursorSchema.parse({
          participantId: phaseStepRecoveryCursor.participantId,
          phase: phaseStepRecoveryPhase,
          substep: "attack",
        })
      : undefined;
  const currentStep = fallbackCursor
    ? getCombatRoundStepForCursorStep(fallbackCursor.step)
    : persistedCurrentStep;
  const participantsForState = repairsUnsupportedPhaseStep
    ? commands.length === 0
      ? participants.map(resetCombatRoundParticipantToRoundStart)
      : participants.map(resetCombatRoundPhaseProgress)
    : participants;
  const phaseResolutionResultsForState = repairsUnsupportedPhaseStep ? [] : phaseResolutionResults;
  const phaseResolutionStatusesForState = repairsUnsupportedPhaseStep
    ? {}
    : phaseResolutionStatuses;
  const stepSnapshotsForState = repairsUnsupportedPhaseStep
    ? commands.length === 0
      ? []
      : stepSnapshots.filter(
          (snapshot) =>
            !getCombatRoundAttackPhaseForStep(snapshot.step) &&
            !getCombatRoundResolutionPhaseForStep(snapshot.step),
        )
    : stepSnapshots;
  const existingCursorParticipantId = existing?.currentCursor?.participantId;
  const canUseExistingCurrentCursor =
    !fallbackCursor &&
    existing?.currentCursor &&
    combatRoundCurrentCursorHasSupport({
      commands,
      currentStep,
      cursor: existing.currentCursor,
      existingPhaseResolutionCursor: existingPhaseResolutionCursorCandidate,
      participants: participantsForState,
      participantIds,
      phaseResolutionResults: phaseResolutionResultsForState,
      phaseResolutionStatuses: phaseResolutionStatusesForState,
      roundNumber,
      stepSnapshots: stepSnapshotsForState,
      validTargetIds,
    });
  const canUseExistingPhaseResolutionCursor =
    !fallbackCursor &&
    currentStep !== "select_actions" &&
    existingPhaseResolutionCursorCandidate &&
    combatRoundStateHasPhaseResolutionEvidence({
      commands,
      currentStep,
      cursor: existingPhaseResolutionCursorCandidate,
      participants: participantsForState,
      phaseResolutionResults: phaseResolutionResultsForState,
      phaseResolutionStatuses: phaseResolutionStatusesForState,
      roundNumber,
      stepSnapshots: stepSnapshotsForState,
      validTargetIds,
    });
  const existingPhaseResolutionCursor = canUseExistingPhaseResolutionCursor
    ? existingPhaseResolutionCursorCandidate
    : undefined;
  const recoveredPhaseResolutionCursor =
    !canUseExistingCurrentCursor && existingPhaseResolutionCursor
      ? getCombatRoundCursorForPhaseResolutionCursor({
          cursor: existingPhaseResolutionCursor,
          roundNumber,
          state: combatRoundStateSchema.parse({
            ...existing,
            commands,
            currentStep,
            phaseResolutionResults: phaseResolutionResultsForState,
            phaseResolutionStatuses: phaseResolutionStatusesForState,
            participants: participantsForState,
            distanceState,
            roundEndReview,
            roundNumber,
            rounds: completedRounds,
            stepSnapshots: stepSnapshotsForState,
          }),
        })
      : undefined;
  const canUseRecoveredPhaseResolutionCursor =
    recoveredPhaseResolutionCursor &&
    getCombatRoundStepForCursorStep(recoveredPhaseResolutionCursor.step) === currentStep;
  const resetsStaleDeclarationSelection =
    currentStep === "select_actions" &&
    existing?.selectedStep !== undefined &&
    existing.selectedStep !== "select_actions";
  const selectedParticipantId = fallbackCursor?.participantId
    ? fallbackCursor.participantId
    : canUseExistingCurrentCursor && existingCursorParticipantId
      ? existingCursorParticipantId
      : canUseRecoveredPhaseResolutionCursor && recoveredPhaseResolutionCursor.participantId
        ? recoveredPhaseResolutionCursor.participantId
        : !resetsStaleDeclarationSelection &&
            existing?.selectedParticipantId &&
            participantIds.has(existing.selectedParticipantId)
          ? existing.selectedParticipantId
          : participantsForState[0]?.participantId;
  const activeParticipantId =
    existing?.activeParticipantId && participantIds.has(existing.activeParticipantId)
      ? existing.activeParticipantId
      : undefined;

  return {
    activeParticipantId,
    combatExperienceDifficulty: existing?.combatExperienceDifficulty,
    commands,
    currentCursor: fallbackCursor
      ? fallbackCursor
      : canUseExistingCurrentCursor
        ? existing.currentCursor
        : canUseRecoveredPhaseResolutionCursor
          ? recoveredPhaseResolutionCursor
          : isGlobalCombatRoundStep(currentStep)
            ? getDefaultCombatRoundCursor({
                participantId: selectedParticipantId,
                roundNumber,
                step: currentStep,
              })
            : undefined,
    distanceState,
    encounterId: input.encounter.id,
    currentStep,
    phaseResolutionCursor: fallbackPhaseResolutionCursor
      ? fallbackPhaseResolutionCursor
      : currentStep === "select_actions" || !existingPhaseResolutionCursor
        ? undefined
        : existingPhaseResolutionCursor,
    phaseResolutionResults: phaseResolutionResultsForState,
    phaseResolutionStatuses: phaseResolutionStatusesForState,
    participants: participantsForState,
    roundEndReview: repairsUnsupportedPhaseStep ? undefined : roundEndReview,
    roundNumber,
    rounds: completedRounds,
    selectedParticipantId,
    selectedStep: fallbackCursor
      ? currentStep
      : canUseExistingCurrentCursor
        ? currentStep
        : resetsStaleDeclarationSelection
          ? "select_actions"
          : (existing?.selectedStep ?? currentStep),
    stepSnapshots: stepSnapshotsForState,
  };
}

export function getNextCombatRoundStep(step: CombatRoundStep): CombatRoundStep {
  const currentIndex = COMBAT_ROUND_STEPS.indexOf(step);

  return COMBAT_ROUND_STEPS[currentIndex + 1] ?? "select_actions";
}

export function getPreviousCombatRoundStep(step: CombatRoundStep): CombatRoundStep | undefined {
  const currentIndex = COMBAT_ROUND_STEPS.indexOf(step);

  return currentIndex > 0 ? COMBAT_ROUND_STEPS[currentIndex - 1] : undefined;
}

export function upsertCombatRoundStepSnapshots(input: {
  snapshots: CombatRoundStepSnapshot[];
  state: CombatRoundState;
}): CombatRoundState {
  const normalized = combatRoundStateSchema.parse(input.state);
  const nextSnapshots = input.snapshots.map((snapshot) =>
    combatRoundStepSnapshotSchema.parse(snapshot),
  );

  return {
    ...normalized,
    stepSnapshots: [
      ...normalized.stepSnapshots.filter(
        (existingSnapshot) =>
          !nextSnapshots.some((snapshot) =>
            isSameCombatRoundStepSnapshot(existingSnapshot, snapshot),
          ),
      ),
      ...nextSnapshots,
    ],
  };
}

export function getCombatRoundStepSnapshot(input: {
  participantId?: string;
  roundNumber?: number;
  state: CombatRoundState;
  step?: CombatRoundStep;
}): CombatRoundStepSnapshot | undefined {
  const normalized = combatRoundStateSchema.parse(input.state);
  const participantId = input.participantId ?? normalized.selectedParticipantId;
  const roundNumber = input.roundNumber ?? normalized.roundNumber;
  const step = input.step ?? normalized.selectedStep ?? normalized.currentStep;

  if (!participantId) {
    return undefined;
  }

  return normalized.stepSnapshots.find((snapshot) =>
    isSameCombatRoundStepSnapshot(snapshot, {
      participantId,
      roundNumber,
      step,
    }),
  );
}

function isTopAdvanceModifierReviewStep(step: CombatRoundStep): boolean {
  return step === "review_action_modifiers" || step === "review_phase_2_modifiers";
}

function isCombatRoundStepStatusOpenForTopAdvance(status: CombatRoundStepStatus): boolean {
  return status === "pending" || status === "ready";
}

function getCombatRoundTopAdvanceParticipantStatus(input: {
  participant: CombatRoundParticipantState;
  step: CombatRoundStep;
}): CombatRoundStepStatus | undefined {
  if (input.step === "round_summary") {
    return "complete";
  }

  const currentStatus = input.participant.stepStatuses[input.step] ?? "pending";

  if (!isCombatRoundStepStatusOpenForTopAdvance(currentStatus)) {
    return undefined;
  }

  switch (input.step) {
    case "select_actions":
      return "locked";
    case "review_action_modifiers":
    case "review_phase_2_modifiers":
      return "complete";
    case "initiative_phase_1":
      return input.participant.initiatives.phase1 ? undefined : "complete";
    case "initiative_phase_2":
      return input.participant.initiatives.phase2 ? undefined : "complete";
    default:
      return undefined;
  }
}

export function advanceCombatRoundStep(
  state: CombatRoundState,
  input: {
    command?: {
      commandId?: string;
      createdAt: string;
      createdByUserId?: string;
      facts?: Record<string, unknown>;
      participantId?: string;
    };
    stepSnapshots?: CombatRoundStepSnapshot[];
    visibility?: CombatRoundVisibility;
  } = {},
): CombatRoundState {
  const normalized = combatRoundStateSchema.parse(state);
  const advanceCommand = input.command;
  const startsNextRound = normalized.currentStep === "round_summary";

  if (advanceCommand && normalized.currentStep === "select_actions") {
    const combatExperienceParticipantId =
      getFirstCombatStartExperienceRequiredParticipantId(normalized);

    if (combatExperienceParticipantId) {
      return combatRoundStateSchema.parse({
        ...normalized,
        currentCursor: getDefaultCombatRoundCursor({
          participantId: combatExperienceParticipantId,
          roundNumber: normalized.roundNumber,
          step: "select_actions",
        }),
        currentStep: "select_actions",
        selectedParticipantId: combatExperienceParticipantId,
        selectedStep: "select_actions",
      });
    }

    const declarationParticipantId =
      getFirstCombatRoundDeclarationRequiredParticipantId(normalized);

    if (declarationParticipantId) {
      return combatRoundStateSchema.parse({
        ...normalized,
        currentCursor: getDefaultCombatRoundCursor({
          participantId: declarationParticipantId,
          roundNumber: normalized.roundNumber,
          step: "select_actions",
        }),
        currentStep: "select_actions",
        selectedParticipantId: declarationParticipantId,
        selectedStep: "select_actions",
      });
    }
  }

  if (startsNextRound) {
    const blocker = getCombatRoundStartNextRoundBlocker(normalized);

    if (blocker) {
      throw new RangeError(blocker);
    }
  }

  const commandBackedGlobalAdvanceStatuses =
    advanceCommand && isGlobalCombatRoundStep(normalized.currentStep)
      ? normalized.participants
          .map((participant) => ({
            participantId: participant.participantId,
            status: getCombatRoundTopAdvanceParticipantStatus({
              participant,
              step: normalized.currentStep,
            }),
          }))
          .filter(
            (entry): entry is { participantId: string; status: CombatRoundStepStatus } =>
              entry.status !== undefined,
          )
      : [];
  const commandBackedGlobalAdvanceStatusByParticipantId = new Map(
    commandBackedGlobalAdvanceStatuses.map((entry) => [entry.participantId, entry.status]),
  );
  const withCommand =
    advanceCommand && commandBackedGlobalAdvanceStatuses.length > 0
      ? commandBackedGlobalAdvanceStatuses.reduce(
          (current, entry) =>
            recordCombatRoundGlobalParticipantCommand({
              createdAt: advanceCommand.createdAt,
              createdByUserId: advanceCommand.createdByUserId,
              facts: {
                source: "advance_step",
                status: entry.status,
                ...(normalized.currentStep === "round_summary"
                  ? {
                      completedRoundNumber: normalized.roundNumber,
                      nextRoundNumber: normalized.roundNumber + 1,
                      participantIds: normalized.participants.map(
                        (participant) => participant.participantId,
                      ),
                    }
                  : {}),
                ...advanceCommand.facts,
              },
              participantId: entry.participantId,
              state: current,
              step: normalized.currentStep,
            }),
          normalized,
        )
      : normalized;
  const withSnapshots = input.stepSnapshots
    ? upsertCombatRoundStepSnapshots({
        snapshots: input.stepSnapshots,
        state: withCommand,
      })
    : withCommand;
  const nextStep = getNextCombatRoundStep(normalized.currentStep);
  const advancesDeclarationStep = normalized.currentStep === "select_actions";
  const startsPhaseResolution =
    nextStep === "phase_1_actions"
      ? "phase1"
      : nextStep === "phase_2_actions"
        ? "phase2"
        : undefined;
  const nextRoundNumber = startsNextRound
    ? withSnapshots.roundNumber + 1
    : withSnapshots.roundNumber;
  const nextGlobalParticipantId = withSnapshots.participants[0]?.participantId;

  if (startsNextRound) {
    const completedRoundState = combatRoundStateSchema.parse({
      ...withSnapshots,
      currentCursor:
        withSnapshots.currentCursor ??
        getDefaultCombatRoundCursor({
          participantId: nextGlobalParticipantId,
          roundNumber: withSnapshots.roundNumber,
          step: "round_summary",
        }),
      currentStep: "round_summary",
      participants: withSnapshots.participants.map((participant) => ({
        ...participant,
        stepStatuses: {
          ...participant.stepStatuses,
          round_summary:
            commandBackedGlobalAdvanceStatusByParticipantId.get(participant.participantId) ??
            (advanceCommand ? "complete" : participant.stepStatuses.round_summary),
        },
      })),
      selectedParticipantId: withSnapshots.selectedParticipantId ?? nextGlobalParticipantId,
      selectedStep: "round_summary",
    });
    const completedRound = buildCompletedCombatRound({
      completedAt: advanceCommand?.createdAt,
      completedByUserId: advanceCommand?.createdByUserId,
      state: completedRoundState,
    });
    const nextParticipants = completedRoundState.participants.map(
      resetCombatRoundParticipantToRoundStart,
    );
    const nextParticipantId = nextParticipants[0]?.participantId;

    return combatRoundStateSchema.parse({
      ...completedRoundState,
      activeParticipantId: undefined,
      combatExperienceDifficulty: undefined,
      commands: [],
      currentCursor: getDefaultCombatRoundCursor({
        participantId: nextParticipantId,
        roundNumber: nextRoundNumber,
        step: "select_actions",
      }),
      currentStep: "select_actions",
      distanceState: completedRoundState.distanceState,
      phaseResolutionCursor: undefined,
      phaseResolutionResults: [],
      phaseResolutionStatuses: {},
      participants: nextParticipants,
      roundEndReview: undefined,
      roundNumber: nextRoundNumber,
      rounds: [
        ...completedRoundState.rounds.filter(
          (round) => round.roundNumber !== completedRound.roundNumber,
        ),
        completedRound,
      ].sort((left, right) => left.roundNumber - right.roundNumber),
      selectedParticipantId: nextParticipantId,
      selectedStep: "select_actions",
      stepSnapshots: [],
    });
  }

  const baseState: CombatRoundState = {
    ...withSnapshots,
    activeParticipantId: startsNextRound ? undefined : withSnapshots.activeParticipantId,
    commands: startsNextRound ? [] : withSnapshots.commands,
    currentCursor:
      startsNextRound || isGlobalCombatRoundStep(nextStep)
        ? getDefaultCombatRoundCursor({
            participantId: nextGlobalParticipantId,
            roundNumber: nextRoundNumber,
            step: nextStep,
          })
        : undefined,
    currentStep: nextStep,
    phaseResolutionCursor: startsNextRound ? undefined : withSnapshots.phaseResolutionCursor,
    phaseResolutionResults: startsNextRound ? [] : withSnapshots.phaseResolutionResults,
    phaseResolutionStatuses: startsNextRound ? {} : withSnapshots.phaseResolutionStatuses,
    participants: withSnapshots.participants.map((participant) => ({
      ...participant,
      attackResults: startsNextRound ? {} : participant.attackResults,
      declaration: startsNextRound ? undefined : participant.declaration,
      initiatives: startsNextRound ? {} : participant.initiatives,
      stepStatuses: startsNextRound
        ? buildDefaultStepStatuses()
        : {
            ...participant.stepStatuses,
            [normalized.currentStep]:
              advanceCommand && isGlobalCombatRoundStep(normalized.currentStep)
                ? (commandBackedGlobalAdvanceStatusByParticipantId.get(participant.participantId) ??
                  participant.stepStatuses[normalized.currentStep])
                : advancesDeclarationStep
                  ? participant.stepStatuses.select_actions === "submitted" ||
                    participant.stepStatuses.select_actions === "gmEdited"
                    ? participant.stepStatuses.select_actions
                    : "locked"
                  : isTopAdvanceModifierReviewStep(normalized.currentStep)
                    ? participant.stepStatuses[normalized.currentStep]
                    : "complete",
          },
    })),
    roundNumber: nextRoundNumber,
    selectedParticipantId: startsNextRound
      ? nextGlobalParticipantId
      : isGlobalCombatRoundStep(nextStep)
        ? nextGlobalParticipantId
        : withSnapshots.selectedParticipantId,
    selectedStep: nextStep,
  };

  if (startsPhaseResolution) {
    const threatenedParticipantId = getCombatRoundPhaseInitiativeChoiceStatuses({
      phase: startsPhaseResolution,
      state: baseState,
      visibility: input.visibility,
    })[0]?.participantId;

    return threatenedParticipantId
      ? moveCombatRoundToPhaseInitiativeResolution({
          participantId: threatenedParticipantId,
          phase: startsPhaseResolution,
          state: baseState,
        })
      : initializeCombatRoundPhaseResolutionCursor({
          phase: startsPhaseResolution,
          state: baseState,
        });
  }

  return baseState;
}

export function recordCombatRoundDeclaration(input: {
  command?: {
    commandId?: string;
    createdAt: string;
    createdByUserId?: string;
  };
  declaration?: Omit<CombatRoundDeclaration, "submittedBy">;
  participantId: string;
  state: CombatRoundState;
  submittedBy: "gm" | "player";
}): CombatRoundState {
  const normalizedInput = combatRoundStateSchema.parse(input.state);

  if (
    normalizedInput.currentStep === "select_actions" &&
    isCombatStartExperienceRollRequired({
      participantId: input.participantId,
      state: normalizedInput,
    })
  ) {
    throw new RangeError("Roll Combat Experience before declaring an action.");
  }

  const withoutStaleResolution = clearCombatRoundParticipantOutgoingResolutionState({
    participantId: input.participantId,
    state: normalizedInput,
  });
  const withStatus = setCombatRoundParticipantStepStatus({
    participantId: input.participantId,
    state: withoutStaleResolution,
    status: input.submittedBy === "gm" ? "gmEdited" : "submitted",
    step: "select_actions",
  });

  if (!input.declaration) {
    return input.command
      ? recordCombatRoundGlobalParticipantCommand({
          ...input.command,
          facts: {
            status: input.submittedBy === "gm" ? "gmEdited" : "submitted",
          },
          participantId: input.participantId,
          state: withStatus,
          step: "select_actions",
          type: "declare_action",
        })
      : withStatus;
  }

  const normalized = combatRoundStateSchema.parse(withStatus);
  const declaration = combatRoundDeclarationSchema.parse({
    ...input.declaration,
    submittedBy: input.submittedBy,
  });

  const withDeclaration: CombatRoundState = {
    ...normalized,
    participants: normalized.participants.map((participant) =>
      participant.participantId === input.participantId
        ? {
            ...participant,
            declaration,
          }
        : participant,
    ),
  };

  return input.command
    ? recordCombatRoundGlobalParticipantCommand({
        ...input.command,
        facts: {
          actionId: declaration.actionId,
          movementIntent: declaration.movementIntent,
          status: input.submittedBy === "gm" ? "gmEdited" : "submitted",
        },
        participantId: input.participantId,
        state: withDeclaration,
        step: "select_actions",
        type: "declare_action",
      })
    : withDeclaration;
}

export function getCombatRoundInitiativePhaseForStep(
  step: CombatRoundStep,
): "phase1" | "phase2" | undefined {
  if (
    step === "initiative_phase_1" ||
    step === "phase_1_actions" ||
    step === "review_phase_2_actions" ||
    step === "phase_1_damage"
  ) {
    return "phase1";
  }

  if (
    step === "initiative_phase_2" ||
    step === "phase_2_actions" ||
    step === "review_phase_2_damage" ||
    step === "phase_2_damage"
  ) {
    return "phase2";
  }

  return undefined;
}

export function getCombatRoundModifierPhaseForStep(
  step: CombatRoundStep,
): "phase1" | "phase2" | undefined {
  if (
    step === "review_action_modifiers" ||
    step === "initiative_phase_1" ||
    step === "phase_1_actions" ||
    step === "review_phase_2_actions" ||
    step === "phase_1_damage"
  ) {
    return "phase1";
  }

  if (
    step === "review_phase_2_modifiers" ||
    step === "initiative_phase_2" ||
    step === "phase_2_actions" ||
    step === "review_phase_2_damage" ||
    step === "phase_2_damage"
  ) {
    return "phase2";
  }

  return undefined;
}

export function recordCombatRoundInitiative(input: {
  command?: {
    commandId?: string;
    createdAt: string;
    createdByUserId?: string;
  };
  initiative: CombatRoundInitiativeResult | number;
  participantId: string;
  phase: "phase1" | "phase2";
  state: CombatRoundState;
  submittedBy: "gm" | "player";
  visibility?: CombatRoundVisibility;
}): CombatRoundState {
  const initiativeStep = input.phase === "phase1" ? "initiative_phase_1" : "initiative_phase_2";
  const withInitiative = setCombatRoundParticipantInitiative({
    initiative: input.initiative,
    participantId: input.participantId,
    phase: input.phase,
    state: input.state,
  });

  const withStatus = setCombatRoundParticipantStepStatus({
    participantId: input.participantId,
    state: withInitiative,
    status: input.submittedBy === "gm" ? "gmEdited" : "submitted",
    step: initiativeStep,
  });

  if (!input.command) {
    return withStatus;
  }

  if (!isCombatRoundPhaseInitiativeComplete({ phase: input.phase, state: withStatus })) {
    return recordCombatRoundGlobalParticipantCommand({
      ...input.command,
      facts: {
        phase: input.phase,
        status: input.submittedBy === "gm" ? "gmEdited" : "submitted",
      },
      participantId: input.participantId,
      state: withStatus,
      step: initiativeStep,
      type: input.phase === "phase1" ? "roll_initiative_phase1" : "roll_initiative_phase2",
    });
  }

  const commandType =
    input.phase === "phase1" ? "roll_initiative_phase1" : "roll_initiative_phase2";
  const beforeCursor = getDefaultCombatRoundCursor({
    participantId: input.participantId,
    roundNumber: withStatus.roundNumber,
    step: initiativeStep,
  });
  const stateAfterCompletedInitiative = moveCombatRoundAfterCompletedPhaseInitiative({
    phase: input.phase,
    state: withStatus,
    visibility: input.visibility,
  });
  const afterCursor = stateAfterCompletedInitiative.currentCursor ?? beforeCursor;
  const command = combatRoundCommandSchema.parse({
    afterCursor,
    beforeCursor,
    createdAt: input.command.createdAt,
    createdByUserId: input.command.createdByUserId,
    facts: {
      phase: input.phase,
      status: input.submittedBy === "gm" ? "gmEdited" : "submitted",
      step: beforeCursor.step,
    },
    id:
      input.command.commandId ??
      buildCombatRoundCommandId({
        createdAt: input.command.createdAt,
        participantId: input.participantId,
        state: withStatus,
        type: commandType,
      }),
    participantId: input.participantId,
    roundNumber: withStatus.roundNumber,
    type: commandType,
  });
  const selectedStep = getCombatRoundStepForCursorStep(command.afterCursor.step);

  return combatRoundStateSchema.parse({
    ...stateAfterCompletedInitiative,
    commands: [...withStatus.commands, command],
    currentCursor: command.afterCursor,
    currentStep: selectedStep,
    selectedParticipantId:
      command.afterCursor.participantId ?? stateAfterCompletedInitiative.selectedParticipantId,
    selectedStep,
  });
}

function getCombatRoundAttackCommandAfterCursor(input: {
  result: CombatRoundAttackRollResult;
  state: CombatRoundState;
}): CombatRoundCursor {
  if (input.result.hit) {
    return combatRoundCursorSchema.parse({
      participantId: input.result.defenderParticipantId,
      roundNumber: input.state.roundNumber,
      step: getCombatRoundCursorStepForPhaseResolutionSubstep({
        phase: input.result.phase,
        substep: "parry",
      }),
    });
  }

  return getCombatRoundPhaseActionOrCompletionCursor({
    phase: input.result.phase,
    state: input.state,
  });
}

function recordCombatRoundAttackCommand(input: {
  command: {
    commandId?: string;
    createdAt: string;
    createdByUserId?: string;
    facts?: Record<string, unknown>;
  };
  participantId: string;
  result: CombatRoundAttackRollResult;
  state: CombatRoundState;
}): CombatRoundState {
  const normalized = combatRoundStateSchema.parse(input.state);
  const beforeCursor = combatRoundCursorSchema.parse({
    participantId: input.participantId,
    roundNumber: normalized.roundNumber,
    step: getCombatRoundAttackCursorStepForPhase(input.result.phase),
  });
  const afterCursor = getCombatRoundAttackCommandAfterCursor({
    result: input.result,
    state: normalized,
  });
  const commandType = "roll_attack" satisfies CombatRoundCommandType;
  const command = combatRoundCommandSchema.parse({
    afterCursor,
    beforeCursor,
    createdAt: input.command.createdAt,
    createdByUserId: input.command.createdByUserId,
    facts: {
      ...(input.command.facts ?? {}),
      attackResultId: getCombatRoundAttackResultId({
        result: input.result,
        roundNumber: normalized.roundNumber,
      }),
      defenderParticipantId: input.result.defenderParticipantId,
      defenderParryModifier: input.result.defenderParryModifier,
      grazing: input.result.grazing,
      hit: input.result.hit,
      ...(afterCursor.participantId
        ? {
            nextStepOpened: {
              participantId: afterCursor.participantId,
              step: afterCursor.step,
            },
          }
        : {}),
    },
    id:
      input.command.commandId ??
      buildCombatRoundCommandId({
        createdAt: input.command.createdAt,
        participantId: input.participantId,
        state: normalized,
        type: commandType,
      }),
    participantId: input.participantId,
    phase: input.result.phase,
    roundNumber: normalized.roundNumber,
    step: beforeCursor.step,
    type: commandType,
  });
  const selectedStep = getCombatRoundStepForCursorStep(command.afterCursor.step);

  return {
    ...normalized,
    commands: [...normalized.commands, command],
    currentCursor: command.afterCursor,
    currentStep: selectedStep,
    selectedParticipantId: command.afterCursor.participantId ?? normalized.selectedParticipantId,
    selectedStep,
  };
}

export function recordCombatRoundAttackResult(input: {
  command?: {
    commandId?: string;
    createdAt: string;
    createdByUserId?: string;
    facts?: Record<string, unknown>;
  };
  participantId: string;
  result: CombatRoundAttackRollResult;
  state: CombatRoundState;
  submittedBy: "gm" | "player";
}): CombatRoundState {
  const attackStep = input.result.phase === "phase1" ? "phase_1_actions" : "phase_2_actions";
  const normalized = combatRoundStateSchema.parse(input.state);
  const existingAttackResult = getCombatRoundOutgoingAttackResultForParticipantPhase({
    participantId: input.participantId,
    phase: input.result.phase,
    state: normalized,
  });

  if (existingAttackResult) {
    throw new RangeError("Attack already rolled for this participant and phase.");
  }

  const withResult: CombatRoundState = {
    ...normalized,
    participants: normalized.participants.map((participant) =>
      participant.participantId === input.participantId
        ? {
            ...participant,
            attackResults: {
              ...participant.attackResults,
              [input.result.phase]: input.result,
            },
          }
        : participant,
    ),
  };

  const withStatus = setCombatRoundParticipantStepStatus({
    participantId: input.participantId,
    state: recordCombatRoundPhaseResolutionAttackDone({
      attackResult: input.result,
      state: withResult,
      updatedAt: input.result.rolledAt,
    }),
    status: input.submittedBy === "gm" ? "gmEdited" : "submitted",
    step: attackStep,
  });

  return input.command
    ? recordCombatRoundAttackCommand({
        command: input.command,
        participantId: input.participantId,
        result: input.result,
        state: withStatus,
      })
    : withStatus;
}

export function recordCombatRoundParticipantStepReview(input: {
  command?: {
    commandId?: string;
    createdAt: string;
    createdByUserId?: string;
  };
  participantId: string;
  state: CombatRoundState;
  step: CombatRoundStep;
  submittedBy: "gm" | "player";
}): CombatRoundState {
  const withStatus = setCombatRoundParticipantStepStatus({
    participantId: input.participantId,
    state: input.state,
    status: input.submittedBy === "gm" ? "gmEdited" : "submitted",
    step: input.step,
  });

  const commandType =
    input.step === "review_action_modifiers"
      ? "review_modifiers_phase1"
      : input.step === "review_phase_2_modifiers"
        ? "review_modifiers_phase2"
        : undefined;

  return input.command && commandType
    ? recordCombatRoundGlobalParticipantCommand({
        ...input.command,
        facts: {
          status: input.submittedBy === "gm" ? "gmEdited" : "submitted",
        },
        participantId: input.participantId,
        state: withStatus,
        step: input.step,
        type: commandType,
      })
    : withStatus;
}

function resetCombatRoundParryForAttackResult(input: {
  attackResult: CombatRoundAttackRollResult;
  resolution: CombatRoundPhaseResolutionResult;
  updatedAt: string;
}): CombatRoundPhaseResolutionResult {
  return combatRoundPhaseResolutionResultSchema.parse({
    ...input.resolution,
    damageProposal: {
      proposedEffects: [],
      status: "not_ready",
    },
    damageRoll: input.attackResult.hit
      ? {
          notes: "Awaiting parry resolution.",
          status: "pending",
        }
      : {
          status: "not_required",
        },
    damageResult: undefined,
    criticalRoll: {
      status: "not_required",
    },
    hitLocationRoll: {
      status: "pending",
    },
    parryResolution: input.attackResult.hit
      ? {
          status: "pending",
        }
      : {
          resultLabel: "Attack missed",
          status: "not_applicable",
        },
    updatedAt: input.updatedAt,
  });
}

function resetCombatRoundDamageForAttackResult(input: {
  attackResult: CombatRoundAttackRollResult;
  preserveHitLocationRoll?: boolean;
  resolution: CombatRoundPhaseResolutionResult;
  updatedAt: string;
}): CombatRoundPhaseResolutionResult {
  return combatRoundPhaseResolutionResultSchema.parse({
    ...input.resolution,
    criticalRoll: {
      status: "not_required",
    },
    damageProposal: {
      proposedEffects: [],
      status: "not_ready",
    },
    damageRoll:
      input.attackResult.hit && input.resolution.parryResolution.success !== true
        ? {
            notes:
              input.resolution.parryResolution.status === "resolved"
                ? "Parry resolved unsuccessfully. Damage roll is pending."
                : "Awaiting parry resolution.",
            status: "pending",
          }
        : {
            notes: input.attackResult.hit
              ? "Parry resolved successfully. Damage is not required."
              : undefined,
            status: "not_required",
          },
    damageResult: undefined,
    hitLocationRoll: input.preserveHitLocationRoll
      ? input.resolution.hitLocationRoll
      : {
          status: "pending",
        },
    updatedAt: input.updatedAt,
  });
}

function getCombatRoundGlobalDependencyPhaseForStep(
  step: CombatRoundStep,
): CombatRoundPhase | undefined {
  if (step === "review_action_modifiers" || step === "initiative_phase_1") {
    return "phase1";
  }

  if (step === "review_phase_2_modifiers" || step === "initiative_phase_2") {
    return "phase2";
  }

  return undefined;
}

function clearCombatRoundStepLegacy(input: {
  state: CombatRoundState;
  step: CombatRoundStep;
}): CombatRoundState {
  const parsed = combatRoundStateSchema.parse(input.state);
  const selectedParticipantId =
    parsed.selectedParticipantId &&
    parsed.participants.some(
      (participant) => participant.participantId === parsed.selectedParticipantId,
    )
      ? parsed.selectedParticipantId
      : undefined;
  const globalDependencyPhase = getCombatRoundGlobalDependencyPhaseForStep(input.step);
  const declarationClearParticipantId =
    input.step === "select_actions" && selectedParticipantId ? selectedParticipantId : undefined;
  const dependencyClearParticipantId =
    declarationClearParticipantId ?? (globalDependencyPhase ? selectedParticipantId : undefined);
  const normalized = dependencyClearParticipantId
    ? clearCombatRoundParticipantOutgoingResolutionState({
        participantId: dependencyClearParticipantId,
        phase: globalDependencyPhase,
        state: parsed,
      })
    : parsed;
  const clearsPhaseAction = input.step === "phase_1_actions" || input.step === "phase_2_actions";
  const clearsParryReview =
    input.step === "review_phase_2_actions" || input.step === "review_phase_2_damage";
  const clearResolutionPhase =
    input.step === "phase_1_actions" ||
    input.step === "review_phase_2_actions" ||
    input.step === "phase_1_damage"
      ? "phase1"
      : input.step === "phase_2_actions" ||
          input.step === "review_phase_2_damage" ||
          input.step === "phase_2_damage"
        ? "phase2"
        : undefined;
  const clearsDamageReview = input.step === "phase_1_damage" || input.step === "phase_2_damage";
  const selectedParticipantForClear = clearResolutionPhase
    ? normalized.selectedParticipantId &&
      normalized.participants.some(
        (participant) => participant.participantId === normalized.selectedParticipantId,
      )
      ? normalized.selectedParticipantId
      : normalized.phaseResolutionCursor?.phase === clearResolutionPhase
        ? normalized.phaseResolutionCursor.participantId
        : undefined
    : undefined;
  const selectedOutgoingAttackResult =
    clearResolutionPhase && selectedParticipantForClear
      ? getCombatRoundOutgoingAttackResultForParticipantPhase({
          participantId: selectedParticipantForClear,
          phase: clearResolutionPhase,
          state: normalized,
        })
      : undefined;
  const selectedIncomingAttackResult =
    clearResolutionPhase && selectedParticipantForClear
      ? getCombatRoundDisplayIncomingAttackResultForParticipantPhase({
          participantId: selectedParticipantForClear,
          phase: clearResolutionPhase,
          state: normalized,
        })
      : undefined;
  const selectedAttackResultForClear = clearsPhaseAction
    ? (selectedOutgoingAttackResult ?? selectedIncomingAttackResult)
    : selectedIncomingAttackResult;
  const selectedResolutionForClear = selectedAttackResultForClear
    ? getCombatRoundPhaseResolutionResultForAttack({
        attackResult: selectedAttackResultForClear,
        state: normalized,
      })
    : undefined;
  const clearsAutoCreatedPendingParry =
    clearsParryReview &&
    Boolean(selectedAttackResultForClear?.hit) &&
    (!selectedResolutionForClear ||
      selectedResolutionForClear.parryResolution.status === "pending");
  const clearsPhaseActionRedo = clearsPhaseAction || clearsAutoCreatedPendingParry;
  const selectedAttackResultId = selectedAttackResultForClear
    ? getCombatRoundAttackResultId({
        result: selectedAttackResultForClear,
        roundNumber: normalized.roundNumber,
      })
    : undefined;
  const nextPhaseResolutionStatuses = clearResolutionPhase
    ? Object.fromEntries(
        Object.entries(normalized.phaseResolutionStatuses).map(([participantId, statuses]) => {
          const clearsOwnerStatus =
            selectedAttackResultForClear?.attackerParticipantId === participantId;
          const nextStatus =
            clearsOwnerStatus && clearsPhaseActionRedo
              ? undefined
              : clearsOwnerStatus && clearsParryReview && selectedAttackResultForClear
                ? {
                    substep: getCombatRoundPostAttackResolutionSubstep(
                      selectedAttackResultForClear,
                    ),
                    updatedAt: selectedAttackResultForClear.rolledAt,
                  }
                : clearsOwnerStatus && clearsDamageReview && selectedAttackResultForClear
                  ? {
                      substep: "damage" as const,
                      updatedAt: selectedAttackResultForClear.rolledAt,
                    }
                  : statuses[clearResolutionPhase];

          return [
            participantId,
            {
              ...statuses,
              [clearResolutionPhase]: nextStatus,
            },
          ];
        }),
      )
    : normalized.phaseResolutionStatuses;
  const nextCursorParticipant =
    clearResolutionPhase && clearsPhaseActionRedo
      ? (selectedAttackResultForClear?.attackerParticipantId ??
        selectedParticipantForClear ??
        getCombatRoundPhaseResolutionOrder({
          phase: clearResolutionPhase,
          state: normalized,
        })[0])
      : clearResolutionPhase && (clearsParryReview || clearsDamageReview)
        ? selectedParticipantForClear
        : undefined;
  const nextCursorSubstep =
    clearResolutionPhase && nextCursorParticipant
      ? clearsParryReview && selectedAttackResultForClear
        ? clearsAutoCreatedPendingParry
          ? getCombatRoundInitialPhaseResolutionSubstep({
              participantId: selectedAttackResultForClear.attackerParticipantId,
              phase: clearResolutionPhase,
              state: normalized,
            })
          : getCombatRoundPostAttackResolutionSubstep(selectedAttackResultForClear)
        : clearsDamageReview
          ? selectedResolutionForClear?.damageRoll.status === "pending" &&
            selectedResolutionForClear.parryResolution.status === "resolved" &&
            selectedResolutionForClear.parryResolution.success === false
            ? "damage"
            : "parry"
          : selectedAttackResultForClear && clearsPhaseActionRedo
            ? getCombatRoundInitialPhaseResolutionSubstep({
                participantId: selectedAttackResultForClear.attackerParticipantId,
                phase: clearResolutionPhase,
                state: normalized,
              })
            : getCombatRoundInitialPhaseResolutionSubstep({
                participantId: nextCursorParticipant,
                phase: clearResolutionPhase,
                state: normalized,
              })
      : undefined;

  return {
    ...normalized,
    phaseResolutionCursor:
      clearResolutionPhase && nextCursorParticipant && nextCursorSubstep
        ? {
            participantId: nextCursorParticipant,
            phase: clearResolutionPhase,
            substep: nextCursorSubstep,
          }
        : clearResolutionPhase && normalized.phaseResolutionCursor?.phase === clearResolutionPhase
          ? undefined
          : globalDependencyPhase &&
              normalized.phaseResolutionCursor?.phase === globalDependencyPhase
            ? undefined
            : normalized.phaseResolutionCursor,
    phaseResolutionResults: clearResolutionPhase
      ? normalized.phaseResolutionResults
          .filter((result) => {
            if (
              result.roundNumber !== normalized.roundNumber ||
              result.phase !== clearResolutionPhase
            ) {
              return true;
            }

            return !(clearsPhaseActionRedo && result.attackResultId === selectedAttackResultId);
          })
          .map((result) => {
            if (result.attackResultId !== selectedAttackResultId || !selectedAttackResultForClear) {
              return result;
            }

            if (clearsParryReview) {
              return resetCombatRoundParryForAttackResult({
                attackResult: selectedAttackResultForClear,
                resolution: result,
                updatedAt: selectedAttackResultForClear.rolledAt,
              });
            }

            if (clearsDamageReview) {
              return resetCombatRoundDamageForAttackResult({
                attackResult: selectedAttackResultForClear,
                resolution: result,
                updatedAt: selectedAttackResultForClear.rolledAt,
              });
            }

            return result;
          })
      : normalized.phaseResolutionResults,
    phaseResolutionStatuses: nextPhaseResolutionStatuses,
    participants: normalized.participants.map((participant) => {
      const nextAttackResults = { ...participant.attackResults };
      const nextInitiatives = { ...participant.initiatives };

      if (
        input.step === "phase_1_actions" &&
        clearsPhaseActionRedo &&
        participant.participantId === selectedAttackResultForClear?.attackerParticipantId
      ) {
        delete nextAttackResults.phase1;
      }

      if (
        input.step === "phase_2_actions" &&
        clearsPhaseActionRedo &&
        participant.participantId === selectedAttackResultForClear?.attackerParticipantId
      ) {
        delete nextAttackResults.phase2;
      }

      if (
        clearsAutoCreatedPendingParry &&
        selectedAttackResultForClear?.phase === "phase1" &&
        participant.participantId === selectedAttackResultForClear.attackerParticipantId
      ) {
        delete nextAttackResults.phase1;
      }

      if (
        clearsAutoCreatedPendingParry &&
        selectedAttackResultForClear?.phase === "phase2" &&
        participant.participantId === selectedAttackResultForClear.attackerParticipantId
      ) {
        delete nextAttackResults.phase2;
      }

      if (
        input.step === "initiative_phase_1" &&
        participant.participantId === selectedParticipantId
      ) {
        delete nextInitiatives.phase1;
      }

      if (
        input.step === "review_action_modifiers" &&
        participant.participantId === selectedParticipantId
      ) {
        delete nextInitiatives.phase1;
      }

      if (
        input.step === "initiative_phase_2" &&
        participant.participantId === selectedParticipantId
      ) {
        delete nextInitiatives.phase2;
      }

      if (
        input.step === "review_phase_2_modifiers" &&
        participant.participantId === selectedParticipantId
      ) {
        delete nextInitiatives.phase2;
      }

      const resetsSelectedStep =
        (!clearResolutionPhase && participant.participantId === selectedParticipantId) ||
        participant.participantId === selectedParticipantForClear ||
        (clearsPhaseActionRedo &&
          participant.participantId === selectedAttackResultForClear?.attackerParticipantId);
      const resetsDownstreamReview =
        clearsPhaseActionRedo &&
        participant.participantId === selectedAttackResultForClear?.defenderParticipantId;
      const resetsGlobalPhaseDependency =
        !clearResolutionPhase &&
        participant.participantId === selectedParticipantId &&
        globalDependencyPhase;

      return {
        ...participant,
        attackResults: nextAttackResults,
        declaration:
          input.step === "select_actions" && participant.participantId === selectedParticipantId
            ? undefined
            : participant.declaration,
        initiatives: nextInitiatives,
        stepStatuses:
          resetsSelectedStep || resetsDownstreamReview
            ? {
                ...participant.stepStatuses,
                ...(resetsSelectedStep ? { [input.step]: "pending" as const } : {}),
                ...(clearsPhaseActionRedo &&
                participant.participantId === selectedAttackResultForClear?.attackerParticipantId &&
                selectedAttackResultForClear.phase === "phase1"
                  ? {
                      phase_1_actions: "pending" as const,
                    }
                  : {}),
                ...(clearsPhaseActionRedo &&
                participant.participantId === selectedAttackResultForClear?.attackerParticipantId &&
                selectedAttackResultForClear.phase === "phase2"
                  ? {
                      phase_2_actions: "pending" as const,
                    }
                  : {}),
                ...(input.step === "review_action_modifiers" && resetsGlobalPhaseDependency
                  ? {
                      initiative_phase_1: "pending" as const,
                    }
                  : {}),
                ...(input.step === "review_phase_2_modifiers" && resetsGlobalPhaseDependency
                  ? {
                      initiative_phase_2: "pending" as const,
                    }
                  : {}),
                ...(input.step === "phase_1_actions" && resetsDownstreamReview
                  ? {
                      phase_1_damage: "pending" as const,
                      review_phase_2_actions: "pending" as const,
                    }
                  : {}),
                ...(input.step === "review_phase_2_actions" && resetsSelectedStep
                  ? {
                      phase_1_damage: "pending" as const,
                    }
                  : {}),
                ...(input.step === "phase_2_actions" && resetsDownstreamReview
                  ? {
                      phase_2_damage: "pending" as const,
                      review_phase_2_damage: "pending" as const,
                    }
                  : {}),
                ...(input.step === "review_phase_2_damage" && resetsSelectedStep
                  ? {
                      phase_2_damage: "pending" as const,
                    }
                  : {}),
              }
            : participant.stepStatuses,
      };
    }),
    selectedParticipantId: nextCursorParticipant ?? normalized.selectedParticipantId,
    selectedStep:
      clearResolutionPhase && nextCursorParticipant
        ? clearsPhaseActionRedo
          ? getCombatRoundPhaseActionStepForPhase(clearResolutionPhase)
          : clearsParryReview
            ? getCombatRoundParryReviewStepForPhase(clearResolutionPhase)
            : getCombatRoundDamageReviewStepForPhase(clearResolutionPhase)
        : normalized.selectedStep,
    stepSnapshots: clearSnapshotsForCombatRoundStep({
      participantId: normalized.selectedParticipantId,
      roundNumber: normalized.roundNumber,
      selectedAttackResult: selectedAttackResultForClear,
      snapshots: normalized.stepSnapshots,
      step:
        clearsAutoCreatedPendingParry && clearResolutionPhase
          ? getCombatRoundPhaseActionStepForPhase(clearResolutionPhase)
          : input.step,
    }),
  };
}

export function undoLatestCombatRoundGlobalParticipantCommand(input: {
  participantId?: string;
  state: CombatRoundState;
  step: CombatRoundStep;
}): CombatRoundState | undefined {
  const normalized = combatRoundStateSchema.parse(input.state);
  const commandType = getCombatRoundGlobalCommandTypeForStep(input.step);
  const participantId =
    input.participantId ??
    (normalized.selectedParticipantId &&
    normalized.participants.some(
      (participant) => participant.participantId === normalized.selectedParticipantId,
    )
      ? normalized.selectedParticipantId
      : undefined);

  if (!commandType || !isGlobalCombatRoundStep(input.step) || !participantId) {
    return undefined;
  }

  const commandIndex = getLatestCombatRoundGlobalParticipantCommandIndex({
    commandType,
    participantId,
    roundNumber: normalized.roundNumber,
    state: normalized,
  });
  const command = normalized.commands[commandIndex];

  if (!command) {
    return undefined;
  }

  return undoCombatRoundGlobalCommandAtIndex({
    commandIndex,
    state: normalized,
  });
}

function getCombatRoundAttackCommandPhase(
  command: CombatRoundCommand,
): CombatRoundPhase | undefined {
  if (command.phase) {
    return command.phase;
  }

  const step = command.step ?? command.beforeCursor.step ?? command.afterCursor.step;

  if (step === "A1" || step === "P1" || step === "D1") {
    return "phase1";
  }

  if (step === "A2" || step === "P2" || step === "D2") {
    return "phase2";
  }

  return undefined;
}

function combatRoundCommandAfterCursorOpensPhaseAction(input: {
  command: CombatRoundCommand;
  phase: CombatRoundPhase;
}): boolean {
  return (
    input.command.afterCursor.step === getCombatRoundAttackCursorStepForPhase(input.phase) &&
    Boolean(input.command.afterCursor.participantId)
  );
}

function undoCombatRoundGlobalCommandAtIndex(input: {
  commandIndex: number;
  state: CombatRoundState;
}): CombatRoundState | undefined {
  const normalized = combatRoundStateSchema.parse(input.state);
  const command = normalized.commands[input.commandIndex];

  if (
    !command ||
    command.roundNumber !== normalized.roundNumber ||
    !isGlobalCombatRoundCommandType(command.type)
  ) {
    return undefined;
  }

  const step = getCombatRoundStepForCursorStep(command.beforeCursor.step);
  const participantId = command.beforeCursor.participantId ?? command.participantId;

  const stateForLegacyClear = setCombatRoundSelection({
    participantId,
    state: normalized,
    step,
  });
  const cleared = clearCombatRoundStepLegacy({
    state: stateForLegacyClear,
    step,
  });
  const selectedStep = getCombatRoundStepForCursorStep(command.beforeCursor.step);

  return {
    ...cleared,
    commands: normalized.commands.filter((_, index) => index !== input.commandIndex),
    currentCursor: command.beforeCursor,
    currentStep: selectedStep,
    selectedParticipantId: command.beforeCursor.participantId ?? participantId,
    selectedStep,
  };
}

function undoCombatRoundAttackCommandAtIndex(input: {
  commandIndex: number;
  state: CombatRoundState;
}): CombatRoundState | undefined {
  const normalized = combatRoundStateSchema.parse(input.state);
  const command = normalized.commands[input.commandIndex];

  if (
    !command ||
    command.roundNumber !== normalized.roundNumber ||
    command.type !== "roll_attack"
  ) {
    return undefined;
  }

  const phase = getCombatRoundAttackCommandPhase(command);

  if (!phase) {
    return undefined;
  }

  const participantId = command.beforeCursor.participantId ?? command.participantId;
  const selectedStep = getCombatRoundStepForCursorStep(command.beforeCursor.step);
  const stateForLegacyClear = setCombatRoundSelection({
    participantId,
    state: normalized,
    step: getCombatRoundPhaseActionStepForPhase(phase),
  });
  const cleared = clearCombatRoundStepLegacy({
    state: stateForLegacyClear,
    step: getCombatRoundPhaseActionStepForPhase(phase),
  });

  return {
    ...cleared,
    commands: normalized.commands.filter((_, index) => index !== input.commandIndex),
    currentCursor: command.beforeCursor,
    currentStep: selectedStep,
    phaseResolutionCursor: {
      participantId,
      phase,
      substep: "attack",
    },
    selectedParticipantId: participantId,
    selectedStep,
  };
}

function undoCombatRoundCombatExperienceCommandAtIndex(input: {
  commandIndex: number;
  state: CombatRoundState;
}): CombatRoundState | undefined {
  const normalized = combatRoundStateSchema.parse(input.state);
  const command = normalized.commands[input.commandIndex];

  if (
    !command ||
    command.roundNumber !== normalized.roundNumber ||
    command.type !== "roll_combat_experience"
  ) {
    return undefined;
  }

  const previousCombatExperience = combatRoundCombatExperienceResultSchema.safeParse(
    command.facts.previousCombatExperience,
  );
  const selectedStep = getCombatRoundStepForCursorStep(command.beforeCursor.step);
  const phase = command.phase;
  const previousPhaseResolutionStatus = combatRoundPhaseResolutionParticipantStatusSchema.safeParse(
    command.facts.previousPhaseResolutionStatus,
  );
  const previousPhaseActionStepStatus = combatRoundStepStatusSchema.safeParse(
    command.facts.previousPhaseActionStepStatus,
  );
  const phaseResolutionStatusesAfterUndo: CombatRoundPhaseResolutionStatuses =
    command.facts.phaseAttackCancelled === true && phase
      ? {
          ...normalized.phaseResolutionStatuses,
          [command.participantId]: {
            ...normalized.phaseResolutionStatuses[command.participantId],
            [phase]: previousPhaseResolutionStatus.success
              ? previousPhaseResolutionStatus.data
              : undefined,
          },
        }
      : normalized.phaseResolutionStatuses;

  return combatRoundStateSchema.parse({
    ...normalized,
    commands: normalized.commands.filter((_, index) => index !== input.commandIndex),
    currentCursor: command.beforeCursor,
    currentStep: selectedStep,
    phaseResolutionCursor:
      command.beforeCursor.step === "A1" || command.beforeCursor.step === "A2"
        ? undefined
        : normalized.phaseResolutionCursor,
    phaseResolutionStatuses: phaseResolutionStatusesAfterUndo,
    participants: normalized.participants.map((participant) =>
      participant.participantId === command.participantId
        ? {
            ...participant,
            combatExperience: previousCombatExperience.success
              ? previousCombatExperience.data
              : undefined,
            stepStatuses:
              command.facts.phaseAttackCancelled === true && phase
                ? {
                    ...participant.stepStatuses,
                    [getCombatRoundPhaseActionStepForPhase(phase)]:
                      previousPhaseActionStepStatus.success
                        ? previousPhaseActionStepStatus.data
                        : "pending",
                  }
                : participant.stepStatuses,
          }
        : participant,
    ),
    selectedParticipantId: command.beforeCursor.participantId ?? command.participantId,
    selectedStep,
  });
}

function undoCombatRoundPairDistanceCommandAtIndex(input: {
  commandIndex: number;
  state: CombatRoundState;
}): CombatRoundState | undefined {
  const normalized = combatRoundStateSchema.parse(input.state);
  const command = normalized.commands[input.commandIndex];

  if (
    !command ||
    command.roundNumber !== normalized.roundNumber ||
    command.type !== "set_pair_distance"
  ) {
    return undefined;
  }

  const participantAId =
    typeof command.facts.participantAId === "string" ? command.facts.participantAId : undefined;
  const participantBId =
    typeof command.facts.participantBId === "string" ? command.facts.participantBId : undefined;
  const previousEdge = combatDistanceEdgeSchema.safeParse(command.facts.previousEdge);

  if (!participantAId || !participantBId) {
    return undefined;
  }

  const pairKey = makeDistancePairKey(participantAId, participantBId);
  const distanceEdges = { ...normalized.distanceState.edges };

  if (previousEdge.success) {
    distanceEdges[pairKey] = previousEdge.data;
  } else {
    delete distanceEdges[pairKey];
  }

  const selectedStep = getCombatRoundStepForCursorStep(command.beforeCursor.step);

  return combatRoundStateSchema.parse({
    ...normalized,
    commands: normalized.commands.filter((_, index) => index !== input.commandIndex),
    currentCursor: command.beforeCursor,
    currentStep: selectedStep,
    distanceState: {
      edges: distanceEdges,
    },
    selectedParticipantId: command.beforeCursor.participantId ?? command.participantId,
    selectedStep,
  });
}

function undoCombatRoundPhaseInitiativeChoiceCommandAtIndex(input: {
  commandIndex: number;
  state: CombatRoundState;
}): CombatRoundState | undefined {
  const normalized = combatRoundStateSchema.parse(input.state);
  const command = normalized.commands[input.commandIndex];

  if (
    !command ||
    command.roundNumber !== normalized.roundNumber ||
    command.type !== "submit_phase_initiative_choice"
  ) {
    return undefined;
  }

  const selectedStep = getCombatRoundStepForCursorStep(command.beforeCursor.step);

  return combatRoundStateSchema.parse({
    ...normalized,
    commands: normalized.commands.filter((_, index) => index !== input.commandIndex),
    currentCursor: command.beforeCursor,
    currentStep: selectedStep,
    phaseResolutionCursor: undefined,
    selectedParticipantId: command.beforeCursor.participantId ?? command.participantId,
    selectedStep,
  });
}

function undoCombatRoundPhaseInitiativeResolutionCommitCommandAtIndex(input: {
  commandIndex: number;
  state: CombatRoundState;
}): CombatRoundState | undefined {
  const normalized = combatRoundStateSchema.parse(input.state);
  const command = normalized.commands[input.commandIndex];

  if (
    !command ||
    command.roundNumber !== normalized.roundNumber ||
    command.type !== "commit_phase_initiative_resolution"
  ) {
    return undefined;
  }

  const previousState = combatRoundStateSchema.safeParse(command.facts.previousState);

  if (previousState.success) {
    return previousState.data;
  }

  const selectedStep = getCombatRoundStepForCursorStep(command.beforeCursor.step);

  return combatRoundStateSchema.parse({
    ...normalized,
    commands: normalized.commands.filter((_, index) => index !== input.commandIndex),
    currentCursor: command.beforeCursor,
    currentStep: selectedStep,
    phaseResolutionCursor: undefined,
    selectedParticipantId: command.beforeCursor.participantId ?? command.participantId,
    selectedStep,
  });
}

function undoCombatRoundPhaseActionSkipCommandAtIndex(input: {
  commandIndex: number;
  state: CombatRoundState;
}): CombatRoundState | undefined {
  const normalized = combatRoundStateSchema.parse(input.state);
  const command = normalized.commands[input.commandIndex];

  if (
    !command ||
    command.roundNumber !== normalized.roundNumber ||
    command.type !== "skip_phase_action"
  ) {
    return undefined;
  }

  const phase = getCombatRoundAttackCommandPhase(command);

  if (!phase) {
    return undefined;
  }

  const participantId = command.beforeCursor.participantId ?? command.participantId;
  const selectedStep = getCombatRoundStepForCursorStep(command.beforeCursor.step);
  const actionStep = getCombatRoundPhaseActionStepForPhase(phase);
  const parryStep = getCombatRoundParryReviewStepForPhase(phase);
  const damageStep = getCombatRoundDamageReviewStepForPhase(phase);
  const nextSubstep = getCombatRoundInitialPhaseResolutionSubstep({
    participantId,
    phase,
    state: normalized,
  });
  const phaseResolutionStatusesAfterUndo: CombatRoundPhaseResolutionStatuses = {
    ...normalized.phaseResolutionStatuses,
    [participantId]: {
      ...normalized.phaseResolutionStatuses[participantId],
      [phase]: {
        substep: nextSubstep,
        updatedAt: command.createdAt,
      },
    },
  };

  if (
    combatRoundCommandAfterCursorOpensPhaseAction({ command, phase }) &&
    command.afterCursor.participantId &&
    command.afterCursor.participantId !== participantId
  ) {
    phaseResolutionStatusesAfterUndo[command.afterCursor.participantId] = {
      ...phaseResolutionStatusesAfterUndo[command.afterCursor.participantId],
      [phase]: undefined,
    };
  }

  return {
    ...normalized,
    commands: normalized.commands.filter((_, index) => index !== input.commandIndex),
    currentCursor: command.beforeCursor,
    currentStep: selectedStep,
    phaseResolutionCursor: {
      participantId,
      phase,
      substep: nextSubstep,
    },
    phaseResolutionStatuses: phaseResolutionStatusesAfterUndo,
    participants: normalized.participants.map((participant) =>
      participant.participantId === participantId
        ? {
            ...participant,
            stepStatuses: {
              ...participant.stepStatuses,
              [actionStep]: "pending",
              [parryStep]: "pending",
              [damageStep]: "pending",
            },
          }
        : participant,
    ),
    selectedParticipantId: participantId,
    selectedStep,
    stepSnapshots: clearSnapshotsForCombatRoundStep({
      participantId,
      roundNumber: normalized.roundNumber,
      snapshots: normalized.stepSnapshots,
      step: actionStep,
    }),
  };
}

function undoCombatRoundBackOutPhaseAttackCommandAtIndex(input: {
  commandIndex: number;
  state: CombatRoundState;
}): CombatRoundState | undefined {
  const normalized = combatRoundStateSchema.parse(input.state);
  const command = normalized.commands[input.commandIndex];

  if (
    !command ||
    command.roundNumber !== normalized.roundNumber ||
    command.type !== "back_out_phase_attack"
  ) {
    return undefined;
  }

  const phase = getCombatRoundAttackCommandPhase(command);

  if (!phase) {
    return undefined;
  }

  const participantId = command.beforeCursor.participantId ?? command.participantId;
  const selectedStep = getCombatRoundStepForCursorStep(command.beforeCursor.step);
  const actionStep = getCombatRoundPhaseActionStepForPhase(phase);
  const parryStep = getCombatRoundParryReviewStepForPhase(phase);
  const damageStep = getCombatRoundDamageReviewStepForPhase(phase);
  const previousPhaseResolutionStatus = combatRoundPhaseResolutionParticipantStatusSchema.safeParse(
    command.facts.previousPhaseResolutionStatus,
  );
  const previousPhaseActionStepStatus = combatRoundStepStatusSchema.safeParse(
    command.facts.previousPhaseActionStepStatus,
  );
  const previousPhaseResolutionCursor = combatRoundPhaseResolutionCursorSchema.safeParse(
    command.facts.previousPhaseResolutionCursor,
  );
  const ceWasRequired = command.facts.ceWasRequired !== false;
  const phaseResolutionStatusesAfterUndo: CombatRoundPhaseResolutionStatuses = {
    ...normalized.phaseResolutionStatuses,
    [participantId]: {
      ...normalized.phaseResolutionStatuses[participantId],
      [phase]: previousPhaseResolutionStatus.success
        ? previousPhaseResolutionStatus.data
        : undefined,
    },
  };

  if (
    combatRoundCommandAfterCursorOpensPhaseAction({ command, phase }) &&
    command.afterCursor.participantId &&
    command.afterCursor.participantId !== participantId
  ) {
    phaseResolutionStatusesAfterUndo[command.afterCursor.participantId] = {
      ...phaseResolutionStatusesAfterUndo[command.afterCursor.participantId],
      [phase]: undefined,
    };
  }

  return combatRoundStateSchema.parse({
    ...normalized,
    commands: normalized.commands.filter((_, index) => index !== input.commandIndex),
    currentCursor: command.beforeCursor,
    currentStep: selectedStep,
    phaseResolutionCursor: ceWasRequired
      ? undefined
      : previousPhaseResolutionCursor.success
        ? previousPhaseResolutionCursor.data
        : {
            participantId,
            phase,
            substep: "attack",
          },
    phaseResolutionStatuses: phaseResolutionStatusesAfterUndo,
    participants: normalized.participants.map((participant) =>
      participant.participantId === participantId
        ? {
            ...participant,
            stepStatuses: {
              ...participant.stepStatuses,
              [actionStep]: previousPhaseActionStepStatus.success
                ? previousPhaseActionStepStatus.data
                : "pending",
              [parryStep]: "pending",
              [damageStep]: "pending",
            },
          }
        : participant,
    ),
    selectedParticipantId: participantId,
    selectedStep,
    stepSnapshots: clearSnapshotsForCombatRoundStep({
      participantId,
      roundNumber: normalized.roundNumber,
      snapshots: normalized.stepSnapshots,
      step: actionStep,
    }),
  });
}

function undoCombatRoundParryCommandAtIndex(input: {
  commandIndex: number;
  state: CombatRoundState;
}): CombatRoundState | undefined {
  const normalized = combatRoundStateSchema.parse(input.state);
  const command = normalized.commands[input.commandIndex];

  if (!command || command.roundNumber !== normalized.roundNumber || command.type !== "roll_parry") {
    return undefined;
  }

  const phase = getCombatRoundAttackCommandPhase(command);
  const attackResultId =
    typeof command.facts.attackResultId === "string" ? command.facts.attackResultId : undefined;

  if (!phase || !attackResultId) {
    return undefined;
  }

  const attackResult = getCombatRoundAttackResultById({
    attackResultId,
    state: normalized,
  });

  if (!attackResult) {
    return undefined;
  }

  const resolution = getCombatRoundPhaseResolutionResultForAttack({
    attackResult,
    state: normalized,
  });
  const participantId = command.beforeCursor.participantId ?? command.participantId;
  const selectedStep = getCombatRoundStepForCursorStep(command.beforeCursor.step);
  const parryStep = getCombatRoundParryReviewStepForPhase(phase);
  const damageStep = getCombatRoundDamageReviewStepForPhase(phase);

  return {
    ...normalized,
    commands: normalized.commands.filter((_, index) => index !== input.commandIndex),
    currentCursor: command.beforeCursor,
    currentStep: selectedStep,
    phaseResolutionCursor: {
      participantId,
      phase,
      substep: "parry",
    },
    phaseResolutionResults: resolution
      ? normalized.phaseResolutionResults.map((result) =>
          result.attackResultId === attackResultId
            ? resetCombatRoundParryForAttackResult({
                attackResult,
                resolution: result,
                updatedAt: attackResult.rolledAt,
              })
            : result,
        )
      : normalized.phaseResolutionResults,
    phaseResolutionStatuses: {
      ...normalized.phaseResolutionStatuses,
      [attackResult.attackerParticipantId]: {
        ...normalized.phaseResolutionStatuses[attackResult.attackerParticipantId],
        [phase]: {
          substep: "parry",
          updatedAt: attackResult.rolledAt,
        },
      },
    },
    participants: normalized.participants.map((participant) =>
      participant.participantId === attackResult.defenderParticipantId
        ? {
            ...participant,
            stepStatuses: {
              ...participant.stepStatuses,
              [parryStep]: "pending",
              [damageStep]: "pending",
            },
          }
        : participant,
    ),
    selectedParticipantId: participantId,
    selectedStep,
    stepSnapshots: clearSnapshotsForCombatRoundStep({
      participantId,
      roundNumber: normalized.roundNumber,
      selectedAttackResult: attackResult,
      snapshots: normalized.stepSnapshots,
      step: parryStep,
    }),
  };
}

function undoCombatRoundDamageReviewCommandAtIndex(input: {
  commandIndex: number;
  state: CombatRoundState;
}): CombatRoundState | undefined {
  const normalized = combatRoundStateSchema.parse(input.state);
  const command = normalized.commands[input.commandIndex];

  if (
    !command ||
    command.roundNumber !== normalized.roundNumber ||
    (command.type !== "complete_damage_review_phase1" &&
      command.type !== "complete_damage_review_phase2")
  ) {
    return undefined;
  }

  const phase = getCombatRoundAttackCommandPhase(command);
  const attackResultId =
    typeof command.facts.attackResultId === "string" ? command.facts.attackResultId : undefined;

  if (!phase || !attackResultId) {
    return undefined;
  }

  const attackResult = getCombatRoundAttackResultById({
    attackResultId,
    state: normalized,
  });

  if (!attackResult) {
    return undefined;
  }

  const resolution = getCombatRoundPhaseResolutionResultForAttack({
    attackResult,
    state: normalized,
  });
  const participantId = command.beforeCursor.participantId ?? command.participantId;
  const selectedStep = getCombatRoundStepForCursorStep(command.beforeCursor.step);
  const damageStep = getCombatRoundDamageReviewStepForPhase(phase);
  const cancelledActions = getCombatRoundOperationalCancelledActionsFromCommand(command);
  const phaseResolutionStatusesAfterUndo: CombatRoundPhaseResolutionStatuses = {
    ...normalized.phaseResolutionStatuses,
    [attackResult.attackerParticipantId]: {
      ...normalized.phaseResolutionStatuses[attackResult.attackerParticipantId],
      [phase]: {
        substep: "damage",
        updatedAt: attackResult.rolledAt,
      },
    },
  };

  if (
    combatRoundCommandAfterCursorOpensPhaseAction({ command, phase }) &&
    command.afterCursor.participantId &&
    command.afterCursor.participantId !== attackResult.attackerParticipantId
  ) {
    phaseResolutionStatusesAfterUndo[command.afterCursor.participantId] = {
      ...phaseResolutionStatusesAfterUndo[command.afterCursor.participantId],
      [phase]: undefined,
    };
  }

  for (const action of cancelledActions) {
    phaseResolutionStatusesAfterUndo[action.participantId] = {
      ...phaseResolutionStatusesAfterUndo[action.participantId],
      [action.phase]: action.previousPhaseResolutionStatus,
    };
  }

  return {
    ...normalized,
    commands: normalized.commands.filter((_, index) => index !== input.commandIndex),
    currentCursor: command.beforeCursor,
    currentStep: selectedStep,
    phaseResolutionCursor: {
      participantId,
      phase,
      substep: "damage",
    },
    phaseResolutionResults: resolution
      ? normalized.phaseResolutionResults.map((result) =>
          result.attackResultId === attackResultId
            ? resetCombatRoundDamageForAttackResult({
                attackResult,
                preserveHitLocationRoll: true,
                resolution: result,
                updatedAt: attackResult.rolledAt,
              })
            : result,
        )
      : normalized.phaseResolutionResults,
    phaseResolutionStatuses: phaseResolutionStatusesAfterUndo,
    participants: normalized.participants.map((participant) =>
      participant.participantId === attackResult.defenderParticipantId
        ? {
            ...participant,
            stepStatuses: {
              ...participant.stepStatuses,
              [damageStep]: "pending",
            },
          }
        : participant,
    ),
    selectedParticipantId: participantId,
    selectedStep,
    stepSnapshots: clearSnapshotsForCombatRoundStep({
      participantId,
      roundNumber: normalized.roundNumber,
      selectedAttackResult: attackResult,
      snapshots: normalized.stepSnapshots,
      step: damageStep,
    }),
  };
}

function undoCombatRoundHitLocationRollCommandAtIndex(input: {
  commandIndex: number;
  state: CombatRoundState;
}): CombatRoundState | undefined {
  const normalized = combatRoundStateSchema.parse(input.state);
  const command = normalized.commands[input.commandIndex];

  if (
    !command ||
    command.roundNumber !== normalized.roundNumber ||
    command.type !== "roll_hit_location"
  ) {
    return undefined;
  }

  const phase = getCombatRoundAttackCommandPhase(command);
  const attackResultId =
    typeof command.facts.attackResultId === "string" ? command.facts.attackResultId : undefined;

  if (!phase || !attackResultId) {
    return undefined;
  }

  const attackResult = getCombatRoundAttackResultById({
    attackResultId,
    state: normalized,
  });

  if (!attackResult) {
    return undefined;
  }

  const participantId = command.beforeCursor.participantId ?? command.participantId;
  const selectedStep = getCombatRoundStepForCursorStep(command.beforeCursor.step);
  const damageStep = getCombatRoundDamageReviewStepForPhase(phase);

  return {
    ...normalized,
    commands: normalized.commands.filter((_, index) => index !== input.commandIndex),
    currentCursor: command.beforeCursor,
    currentStep: selectedStep,
    phaseResolutionCursor: {
      participantId,
      phase,
      substep: "damage",
    },
    phaseResolutionResults: normalized.phaseResolutionResults.map((result) =>
      result.attackResultId === attackResultId
        ? combatRoundPhaseResolutionResultSchema.parse({
            ...result,
            hitLocationRoll: {
              status: "pending",
            },
            updatedAt: command.createdAt,
          })
        : result,
    ),
    participants: normalized.participants.map((participant) =>
      participant.participantId === attackResult.defenderParticipantId
        ? {
            ...participant,
            stepStatuses: {
              ...participant.stepStatuses,
              [damageStep]: "pending",
            },
          }
        : participant,
    ),
    selectedParticipantId: participantId,
    selectedStep,
    stepSnapshots: clearSnapshotsForCombatRoundStep({
      participantId,
      roundNumber: normalized.roundNumber,
      selectedAttackResult: attackResult,
      snapshots: normalized.stepSnapshots,
      step: damageStep,
    }),
  };
}

function undoCombatRoundCriticalRollCommandAtIndex(input: {
  commandIndex: number;
  state: CombatRoundState;
}): CombatRoundState | undefined {
  const normalized = combatRoundStateSchema.parse(input.state);
  const command = normalized.commands[input.commandIndex];

  if (
    !command ||
    command.roundNumber !== normalized.roundNumber ||
    command.type !== "roll_critical"
  ) {
    return undefined;
  }

  const phase = getCombatRoundAttackCommandPhase(command);
  const attackResultId =
    typeof command.facts.attackResultId === "string" ? command.facts.attackResultId : undefined;

  if (!phase || !attackResultId) {
    return undefined;
  }

  const attackResult = getCombatRoundAttackResultById({
    attackResultId,
    state: normalized,
  });

  if (!attackResult) {
    return undefined;
  }

  const participantId = command.beforeCursor.participantId ?? command.participantId;
  const selectedStep = getCombatRoundStepForCursorStep(command.beforeCursor.step);
  const damageStep = getCombatRoundDamageReviewStepForPhase(phase);

  return {
    ...normalized,
    commands: normalized.commands.filter((_, index) => index !== input.commandIndex),
    currentCursor: command.beforeCursor,
    currentStep: selectedStep,
    phaseResolutionCursor: {
      participantId,
      phase,
      substep: "damage",
    },
    phaseResolutionResults: normalized.phaseResolutionResults.map((result) =>
      result.attackResultId === attackResultId
        ? combatRoundPhaseResolutionResultSchema.parse({
            ...result,
            criticalRoll: {
              status: "pending",
            },
            damageResult: result.damageResult
              ? {
                  ...result.damageResult,
                  review: removeCombatRoundCriticalEffectProposalFromReview(
                    result.damageResult.review,
                  ),
                }
              : undefined,
            updatedAt: command.createdAt,
          })
        : result,
    ),
    participants: normalized.participants.map((participant) =>
      participant.participantId === attackResult.defenderParticipantId
        ? {
            ...participant,
            stepStatuses: {
              ...participant.stepStatuses,
              [damageStep]: "ready",
            },
          }
        : participant,
    ),
    selectedParticipantId: participantId,
    selectedStep,
  };
}

function undoCombatRoundCommittedDamageCommandAtIndex(input: {
  commandIndex: number;
  state: CombatRoundState;
}): CombatRoundState | undefined {
  const normalized = combatRoundStateSchema.parse(input.state);
  const command = normalized.commands[input.commandIndex];

  if (
    !command ||
    command.roundNumber !== normalized.roundNumber ||
    command.type !== "commit_phase_damage"
  ) {
    return undefined;
  }

  const phase = getCombatRoundAttackCommandPhase(command);
  const attackResultId =
    typeof command.facts.attackResultId === "string" ? command.facts.attackResultId : undefined;

  if (!phase || !attackResultId) {
    return undefined;
  }

  const attackResult = getCombatRoundAttackResultById({
    attackResultId,
    state: normalized,
  });

  if (!attackResult) {
    return undefined;
  }

  const resolution = getCombatRoundPhaseResolutionResultForAttack({
    attackResult,
    state: normalized,
  });
  const participantId = command.beforeCursor.participantId ?? command.participantId;
  const selectedStep = getCombatRoundStepForCursorStep(command.beforeCursor.step);
  const damageStep = getCombatRoundDamageReviewStepForPhase(phase);
  const cancelledActions = getCombatRoundOperationalCancelledActionsFromCommand(command);
  const phaseResolutionStatusesAfterUndo: CombatRoundPhaseResolutionStatuses = {
    ...normalized.phaseResolutionStatuses,
    [attackResult.attackerParticipantId]: {
      ...normalized.phaseResolutionStatuses[attackResult.attackerParticipantId],
      [phase]: {
        substep: "damage",
        updatedAt: command.createdAt,
      },
    },
  };

  if (
    combatRoundCommandAfterCursorOpensPhaseAction({ command, phase }) &&
    command.afterCursor.participantId &&
    command.afterCursor.participantId !== attackResult.attackerParticipantId
  ) {
    phaseResolutionStatusesAfterUndo[command.afterCursor.participantId] = {
      ...phaseResolutionStatusesAfterUndo[command.afterCursor.participantId],
      [phase]: undefined,
    };
  }

  for (const action of cancelledActions) {
    phaseResolutionStatusesAfterUndo[action.participantId] = {
      ...phaseResolutionStatusesAfterUndo[action.participantId],
      [action.phase]: action.previousPhaseResolutionStatus,
    };
  }

  return {
    ...normalized,
    commands: normalized.commands.filter((_, index) => index !== input.commandIndex),
    currentCursor: command.beforeCursor,
    currentStep: selectedStep,
    phaseResolutionCursor: {
      participantId,
      phase,
      substep: "damage",
    },
    phaseResolutionResults: resolution
      ? normalized.phaseResolutionResults.map((result) =>
          result.attackResultId === attackResultId
            ? combatRoundPhaseResolutionResultSchema.parse({
                ...result,
                damageProposal: {
                  committedCombatEffectIds: [],
                  proposedEffects: [],
                  status: "drafted",
                },
                updatedAt: command.createdAt,
              })
            : result,
        )
      : normalized.phaseResolutionResults,
    phaseResolutionStatuses: phaseResolutionStatusesAfterUndo,
    participants: normalized.participants.map((participant) => {
      const cancelledForParticipant = cancelledActions.filter(
        (action) => action.participantId === participant.participantId,
      );
      const withRestoredCancellations = cancelledForParticipant.reduce(
        (current, action) => ({
          ...current,
          [getCombatRoundPhaseActionStepForPhase(action.phase)]:
            action.previousStepStatus ?? "pending",
        }),
        participant.stepStatuses,
      );

      return participant.participantId === attackResult.defenderParticipantId
        ? {
            ...participant,
            stepStatuses: {
              ...withRestoredCancellations,
              [damageStep]: "ready",
            },
          }
        : cancelledForParticipant.length > 0
          ? {
              ...participant,
              stepStatuses: withRestoredCancellations,
            }
          : participant;
    }),
    selectedParticipantId: participantId,
    selectedStep,
  };
}

function undoCombatRoundResolvedDamageCommandAtIndex(input: {
  commandIndex: number;
  state: CombatRoundState;
}): CombatRoundState | undefined {
  const normalized = combatRoundStateSchema.parse(input.state);
  const command = normalized.commands[input.commandIndex];

  if (
    !command ||
    command.roundNumber !== normalized.roundNumber ||
    command.type !== "resolve_damage"
  ) {
    return undefined;
  }

  const phase = getCombatRoundAttackCommandPhase(command);
  const attackResultId =
    typeof command.facts.attackResultId === "string" ? command.facts.attackResultId : undefined;

  if (!phase || !attackResultId) {
    return undefined;
  }

  const attackResult = getCombatRoundAttackResultById({
    attackResultId,
    state: normalized,
  });

  if (!attackResult) {
    return undefined;
  }

  const resolution = getCombatRoundPhaseResolutionResultForAttack({
    attackResult,
    state: normalized,
  });
  const participantId = command.beforeCursor.participantId ?? command.participantId;
  const selectedStep = getCombatRoundStepForCursorStep(command.beforeCursor.step);
  const damageStep = getCombatRoundDamageReviewStepForPhase(phase);
  const phaseResolutionStatusesAfterUndo: CombatRoundPhaseResolutionStatuses = {
    ...normalized.phaseResolutionStatuses,
    [attackResult.attackerParticipantId]: {
      ...normalized.phaseResolutionStatuses[attackResult.attackerParticipantId],
      [phase]: {
        substep: "damage",
        updatedAt: attackResult.rolledAt,
      },
    },
  };

  if (
    combatRoundCommandAfterCursorOpensPhaseAction({ command, phase }) &&
    command.afterCursor.participantId &&
    command.afterCursor.participantId !== attackResult.attackerParticipantId
  ) {
    phaseResolutionStatusesAfterUndo[command.afterCursor.participantId] = {
      ...phaseResolutionStatusesAfterUndo[command.afterCursor.participantId],
      [phase]: undefined,
    };
  }

  return {
    ...normalized,
    commands: normalized.commands.filter((_, index) => index !== input.commandIndex),
    currentCursor: command.beforeCursor,
    currentStep: selectedStep,
    phaseResolutionCursor: {
      participantId,
      phase,
      substep: "damage",
    },
    phaseResolutionResults: resolution
      ? normalized.phaseResolutionResults.map((result) =>
          result.attackResultId === attackResultId
            ? resetCombatRoundDamageForAttackResult({
                attackResult,
                preserveHitLocationRoll: true,
                resolution: result,
                updatedAt: attackResult.rolledAt,
              })
            : result,
        )
      : normalized.phaseResolutionResults,
    phaseResolutionStatuses: phaseResolutionStatusesAfterUndo,
    participants: normalized.participants.map((participant) =>
      participant.participantId === attackResult.defenderParticipantId
        ? {
            ...participant,
            stepStatuses: {
              ...participant.stepStatuses,
              [damageStep]: "ready",
            },
          }
        : participant,
    ),
    selectedParticipantId: participantId,
    selectedStep,
    stepSnapshots: clearSnapshotsForCombatRoundStep({
      participantId,
      roundNumber: normalized.roundNumber,
      selectedAttackResult: attackResult,
      snapshots: normalized.stepSnapshots,
      step: damageStep,
    }),
  };
}

function undoCombatRoundEndReviewPrepareCommandAtIndex(input: {
  commandIndex: number;
  state: CombatRoundState;
}): CombatRoundState | undefined {
  const normalized = combatRoundStateSchema.parse(input.state);
  const command = normalized.commands[input.commandIndex];

  if (
    !command ||
    command.roundNumber !== normalized.roundNumber ||
    command.type !== "prepare_round_end_review"
  ) {
    return undefined;
  }

  return combatRoundStateSchema.parse({
    ...normalized,
    commands: normalized.commands.filter((_, index) => index !== input.commandIndex),
    currentCursor: command.beforeCursor,
    currentStep: "round_summary",
    participants: normalized.participants.map((participant) => ({
      ...participant,
      stepStatuses: {
        ...participant.stepStatuses,
        round_summary: "pending",
      },
    })),
    roundEndReview: undefined,
    selectedParticipantId: command.beforeCursor.participantId,
    selectedStep: "round_summary",
  });
}

function undoCombatRoundEndParticipantReviewCommitCommandAtIndex(input: {
  commandIndex: number;
  state: CombatRoundState;
}): CombatRoundState | undefined {
  const normalized = combatRoundStateSchema.parse(input.state);
  const command = normalized.commands[input.commandIndex];

  if (
    !command ||
    command.roundNumber !== normalized.roundNumber ||
    command.type !== "commit_round_end_participant_review"
  ) {
    return undefined;
  }

  const roundEndReview = normalized.roundEndReview;
  const participantReview = roundEndReview?.participantReviews[command.participantId];

  if (!roundEndReview || !participantReview) {
    return undefined;
  }

  const acceptedDistanceProposalIds = Array.isArray(command.facts.acceptedDistanceProposalIds)
    ? command.facts.acceptedDistanceProposalIds.filter(
        (proposalId): proposalId is string => typeof proposalId === "string",
      )
    : [];
  const acceptedDistanceProposalIdSet = new Set(acceptedDistanceProposalIds);
  const restoredDistanceProposals = participantReview.proposedDistances.map((proposal) =>
    acceptedDistanceProposalIdSet.has(proposal.id)
      ? combatRoundEndDistanceProposalSchema.parse({
          ...proposal,
          appliedDistance: undefined,
          status: "review_ready",
        })
      : proposal,
  );
  const restoredReview = combatRoundEndParticipantReviewSchema.parse({
    ...participantReview,
    committedAt: undefined,
    committedByUserId: undefined,
    proposedDistances: restoredDistanceProposals,
    status: "review_ready",
  });
  const distanceEdges = { ...normalized.distanceState.edges };
  const appliedDistanceEdges = Array.isArray(command.facts.appliedDistanceEdges)
    ? command.facts.appliedDistanceEdges
    : [];

  for (const fact of appliedDistanceEdges) {
    if (!fact || typeof fact !== "object") {
      continue;
    }

    const record = fact as Record<string, unknown>;
    const nextEdge = combatDistanceEdgeSchema.safeParse(record.nextEdge);
    const previousEdge = combatDistanceEdgeSchema.safeParse(record.previousEdge);
    const pairKey = nextEdge.success
      ? nextEdge.data.pairKey
      : previousEdge.success
        ? previousEdge.data.pairKey
        : undefined;

    if (!pairKey) {
      continue;
    }

    if (previousEdge.success) {
      distanceEdges[pairKey] = previousEdge.data;
    } else {
      delete distanceEdges[pairKey];
    }
  }

  return combatRoundStateSchema.parse({
    ...normalized,
    commands: normalized.commands.filter((_, index) => index !== input.commandIndex),
    currentCursor: command.beforeCursor,
    currentStep: "round_summary",
    distanceState: {
      edges: distanceEdges,
    },
    participants: normalized.participants.map((participant) =>
      participant.participantId === command.participantId
        ? {
            ...participant,
            stepStatuses: {
              ...participant.stepStatuses,
              round_summary: "ready",
            },
          }
        : participant,
    ),
    roundEndReview: {
      ...roundEndReview,
      participantReviews: {
        ...roundEndReview.participantReviews,
        [command.participantId]: restoredReview,
      },
    },
    selectedParticipantId: command.beforeCursor.participantId,
    selectedStep: "round_summary",
  });
}

function undoCombatRoundEndHealthCheckCommandAtIndex(input: {
  commandIndex: number;
  state: CombatRoundState;
}): CombatRoundState | undefined {
  const normalized = combatRoundStateSchema.parse(input.state);
  const command = normalized.commands[input.commandIndex];

  if (
    !command ||
    command.roundNumber !== normalized.roundNumber ||
    command.type !== "roll_round_end_health_check"
  ) {
    return undefined;
  }

  const healthRollId =
    typeof command.facts.healthRollId === "string" ? command.facts.healthRollId : undefined;
  const roundEndReview = normalized.roundEndReview;
  const participantReview = roundEndReview?.participantReviews[command.participantId];

  if (!roundEndReview || !participantReview || !healthRollId) {
    return undefined;
  }

  const restoredHealthRolls = participantReview.proposedHealthRolls.map((proposal) =>
    proposal.id === healthRollId
      ? combatRoundEndHealthRollProposalSchema.parse({
          ...proposal,
          bleedReduction: undefined,
          nextBleedRate: undefined,
          result: undefined,
          status: "pending",
        })
      : proposal,
  );
  const restoredReview = combatRoundEndParticipantReviewSchema.parse({
    ...participantReview,
    proposedHealthRolls: restoredHealthRolls,
    status: "health_roll_pending",
  });

  return combatRoundStateSchema.parse({
    ...normalized,
    commands: normalized.commands.filter((_, index) => index !== input.commandIndex),
    currentCursor: command.beforeCursor,
    currentStep: "round_summary",
    participants: normalized.participants.map((participant) =>
      participant.participantId === command.participantId
        ? {
            ...participant,
            stepStatuses: {
              ...participant.stepStatuses,
              round_summary: "ready",
            },
          }
        : participant,
    ),
    roundEndReview: {
      ...roundEndReview,
      participantReviews: {
        ...roundEndReview.participantReviews,
        [command.participantId]: restoredReview,
      },
    },
    selectedParticipantId: command.beforeCursor.participantId,
    selectedStep: "round_summary",
  });
}

function undoCombatRoundEndDistanceControlCommandAtIndex(input: {
  commandIndex: number;
  state: CombatRoundState;
}): CombatRoundState | undefined {
  const normalized = combatRoundStateSchema.parse(input.state);
  const command = normalized.commands[input.commandIndex];

  if (
    !command ||
    command.roundNumber !== normalized.roundNumber ||
    command.type !== "roll_round_end_distance_control"
  ) {
    return undefined;
  }

  const distanceProposalId =
    typeof command.facts.distanceProposalId === "string"
      ? command.facts.distanceProposalId
      : undefined;
  const previousProposal = combatRoundEndDistanceProposalSchema.safeParse(
    command.facts.previousProposal,
  );
  const roundEndReview = normalized.roundEndReview;

  if (!roundEndReview || !distanceProposalId || !previousProposal.success) {
    return undefined;
  }

  const restoredDistanceProposals = roundEndReview.proposedDistances.map((proposal) =>
    proposal.id === distanceProposalId ? previousProposal.data : proposal,
  );

  return combatRoundStateSchema.parse({
    ...normalized,
    commands: normalized.commands.filter((_, index) => index !== input.commandIndex),
    currentCursor: command.beforeCursor,
    currentStep: "round_summary",
    participants: normalized.participants.map((participant) =>
      participant.participantId === command.participantId
        ? {
            ...participant,
            stepStatuses: {
              ...participant.stepStatuses,
              round_summary: "ready",
            },
          }
        : participant,
    ),
    roundEndReview: {
      ...roundEndReview,
      proposedDistances: restoredDistanceProposals,
    },
    selectedParticipantId: command.beforeCursor.participantId,
    selectedStep: "round_summary",
  });
}

function undoCombatRoundEndDistanceControlCommitCommandAtIndex(input: {
  commandIndex: number;
  state: CombatRoundState;
}): CombatRoundState | undefined {
  const normalized = combatRoundStateSchema.parse(input.state);
  const command = normalized.commands[input.commandIndex];

  if (
    !command ||
    command.roundNumber !== normalized.roundNumber ||
    command.type !== "commit_round_end_distance_control"
  ) {
    return undefined;
  }

  const distanceProposalId =
    typeof command.facts.distanceProposalId === "string"
      ? command.facts.distanceProposalId
      : undefined;
  const previousProposal = combatRoundEndDistanceProposalSchema.safeParse(
    command.facts.previousProposal,
  );
  const roundEndReview = normalized.roundEndReview;

  if (!roundEndReview || !distanceProposalId || !previousProposal.success) {
    return undefined;
  }

  const restoredDistanceProposals = roundEndReview.proposedDistances.map((proposal) =>
    proposal.id === distanceProposalId ? previousProposal.data : proposal,
  );
  const distanceEdges = { ...normalized.distanceState.edges };
  const nextEdge = combatDistanceEdgeSchema.safeParse(command.facts.nextEdge);
  const previousEdge = combatDistanceEdgeSchema.safeParse(command.facts.previousEdge);
  const pairKey = nextEdge.success
    ? nextEdge.data.pairKey
    : previousEdge.success
      ? previousEdge.data.pairKey
      : previousProposal.data.pairKey;

  if (previousEdge.success) {
    distanceEdges[pairKey] = previousEdge.data;
  } else {
    delete distanceEdges[pairKey];
  }

  return combatRoundStateSchema.parse({
    ...normalized,
    commands: normalized.commands.filter((_, index) => index !== input.commandIndex),
    currentCursor: command.beforeCursor,
    currentStep: "round_summary",
    distanceState: {
      edges: distanceEdges,
    },
    roundEndReview: {
      ...roundEndReview,
      proposedDistances: restoredDistanceProposals,
    },
    selectedParticipantId: command.beforeCursor.participantId,
    selectedStep: "round_summary",
  });
}

export function undoLatestCombatRoundGlobalCommand(input: {
  state: CombatRoundState;
}): CombatRoundState | undefined {
  const normalized = combatRoundStateSchema.parse(input.state);
  const commandIndex = getLatestCombatRoundGlobalCommandIndex({
    roundNumber: normalized.roundNumber,
    state: normalized,
  });

  return undoCombatRoundGlobalCommandAtIndex({
    commandIndex,
    state: normalized,
  });
}

function undoCombatRoundCommandAtIndex(input: {
  commandIndex: number;
  state: CombatRoundState;
}): CombatRoundState | undefined {
  const normalized = combatRoundStateSchema.parse(input.state);
  const command = normalized.commands[input.commandIndex];

  if (!command) {
    return undefined;
  }

  if (command.type === "roll_attack") {
    return undoCombatRoundAttackCommandAtIndex({
      commandIndex: input.commandIndex,
      state: normalized,
    });
  }

  if (command.type === "skip_phase_action") {
    return undoCombatRoundPhaseActionSkipCommandAtIndex({
      commandIndex: input.commandIndex,
      state: normalized,
    });
  }

  if (command.type === "back_out_phase_attack") {
    return undoCombatRoundBackOutPhaseAttackCommandAtIndex({
      commandIndex: input.commandIndex,
      state: normalized,
    });
  }

  if (command.type === "submit_phase_initiative_choice") {
    return undoCombatRoundPhaseInitiativeChoiceCommandAtIndex({
      commandIndex: input.commandIndex,
      state: normalized,
    });
  }

  if (command.type === "commit_phase_initiative_resolution") {
    return undoCombatRoundPhaseInitiativeResolutionCommitCommandAtIndex({
      commandIndex: input.commandIndex,
      state: normalized,
    });
  }

  if (command.type === "roll_combat_experience") {
    return undoCombatRoundCombatExperienceCommandAtIndex({
      commandIndex: input.commandIndex,
      state: normalized,
    });
  }

  if (command.type === "set_pair_distance") {
    return undoCombatRoundPairDistanceCommandAtIndex({
      commandIndex: input.commandIndex,
      state: normalized,
    });
  }

  if (command.type === "roll_parry") {
    return undoCombatRoundParryCommandAtIndex({
      commandIndex: input.commandIndex,
      state: normalized,
    });
  }

  if (
    command.type === "complete_damage_review_phase1" ||
    command.type === "complete_damage_review_phase2"
  ) {
    return undoCombatRoundDamageReviewCommandAtIndex({
      commandIndex: input.commandIndex,
      state: normalized,
    });
  }

  if (command.type === "roll_hit_location") {
    return undoCombatRoundHitLocationRollCommandAtIndex({
      commandIndex: input.commandIndex,
      state: normalized,
    });
  }

  if (command.type === "roll_critical") {
    return undoCombatRoundCriticalRollCommandAtIndex({
      commandIndex: input.commandIndex,
      state: normalized,
    });
  }

  if (command.type === "commit_phase_damage") {
    return undoCombatRoundCommittedDamageCommandAtIndex({
      commandIndex: input.commandIndex,
      state: normalized,
    });
  }

  if (command.type === "roll_round_end_health_check") {
    return undoCombatRoundEndHealthCheckCommandAtIndex({
      commandIndex: input.commandIndex,
      state: normalized,
    });
  }

  if (command.type === "roll_round_end_distance_control") {
    return undoCombatRoundEndDistanceControlCommandAtIndex({
      commandIndex: input.commandIndex,
      state: normalized,
    });
  }

  if (command.type === "commit_round_end_distance_control") {
    return undoCombatRoundEndDistanceControlCommitCommandAtIndex({
      commandIndex: input.commandIndex,
      state: normalized,
    });
  }

  if (command.type === "commit_round_end_participant_review") {
    return undoCombatRoundEndParticipantReviewCommitCommandAtIndex({
      commandIndex: input.commandIndex,
      state: normalized,
    });
  }

  if (command.type === "prepare_round_end_review") {
    return undoCombatRoundEndReviewPrepareCommandAtIndex({
      commandIndex: input.commandIndex,
      state: normalized,
    });
  }

  if (command.type === "resolve_damage") {
    return undoCombatRoundResolvedDamageCommandAtIndex({
      commandIndex: input.commandIndex,
      state: normalized,
    });
  }

  return undoCombatRoundGlobalCommandAtIndex({
    commandIndex: input.commandIndex,
    state: normalized,
  });
}

export function undoLatestCombatRoundCommand(input: {
  state: CombatRoundState;
}): CombatRoundState | undefined {
  const normalized = combatRoundStateSchema.parse(input.state);
  const commandIndex = getLatestCombatRoundUndoableCommandIndex({
    roundNumber: normalized.roundNumber,
    state: normalized,
  });

  return undoCombatRoundCommandAtIndex({
    commandIndex,
    state: normalized,
  });
}

function combatRoundSelectedStepHasClearableState(input: {
  state: CombatRoundState;
  step: CombatRoundStep;
}): boolean {
  const normalized = combatRoundStateSchema.parse(input.state);
  const selectedParticipant = normalized.participants.find(
    (participant) => participant.participantId === normalized.selectedParticipantId,
  );

  if (!selectedParticipant) {
    return false;
  }

  const status = selectedParticipant.stepStatuses[input.step] ?? "pending";
  const hasNonPendingStatus = status !== "pending";
  const phase =
    getCombatRoundAttackPhaseForStep(input.step) ??
    getCombatRoundResolutionPhaseForStep(input.step);

  if (!phase) {
    if (input.step === "select_actions") {
      return Boolean(selectedParticipant.declaration) || hasNonPendingStatus;
    }

    if (input.step === "initiative_phase_1") {
      return Boolean(selectedParticipant.initiatives.phase1) || hasNonPendingStatus;
    }

    if (input.step === "initiative_phase_2") {
      return Boolean(selectedParticipant.initiatives.phase2) || hasNonPendingStatus;
    }

    return hasNonPendingStatus;
  }

  const actionStep = getCombatRoundPhaseActionStepForPhase(phase);

  if (input.step === actionStep) {
    return (
      Boolean(
        getCombatRoundOutgoingAttackResultForParticipantPhase({
          participantId: selectedParticipant.participantId,
          phase,
          state: normalized,
        }),
      ) ||
      Boolean(
        getCombatRoundDisplayIncomingAttackResultForParticipantPhase({
          participantId: selectedParticipant.participantId,
          phase,
          state: normalized,
        }),
      ) ||
      hasNonPendingStatus
    );
  }

  return (
    Boolean(
      getCombatRoundDisplayIncomingAttackResultForParticipantPhase({
        participantId: selectedParticipant.participantId,
        phase,
        state: normalized,
      }),
    ) || hasNonPendingStatus
  );
}

export function canClearCombatRoundStep(input: {
  state: CombatRoundState;
  step: CombatRoundStep;
}): boolean {
  const normalized = combatRoundStateSchema.parse(input.state);
  const commandIndex = getLatestCombatRoundUndoableCommandIndex({
    roundNumber: normalized.roundNumber,
    state: normalized,
  });

  return (
    commandIndex >= 0 ||
    combatRoundSelectedStepHasClearableState({
      state: normalized,
      step: input.step,
    })
  );
}

export function clearCombatRoundStep(input: {
  state: CombatRoundState;
  step: CombatRoundStep;
}): CombatRoundState {
  const normalized = combatRoundStateSchema.parse(input.state);
  const commandUndoneState = undoLatestCombatRoundCommand({ state: normalized });

  if (commandUndoneState) {
    return commandUndoneState;
  }

  if (combatRoundSelectedStepHasClearableState({ state: normalized, step: input.step })) {
    return clearCombatRoundStepLegacy({ state: normalized, step: input.step });
  }

  return normalized;
}

export function clearCurrentCombatRoundStepAndRewind(state: CombatRoundState): CombatRoundState {
  const normalized = combatRoundStateSchema.parse(state);
  const commandIndex = getLatestCombatRoundUndoableCommandIndex({
    roundNumber: normalized.roundNumber,
    state: normalized,
  });
  const clearedState = clearCombatRoundStep({
    state: normalized,
    step: normalized.currentStep,
  });

  if (commandIndex >= 0) {
    return clearedState;
  }

  const previousStep = getPreviousCombatRoundStep(normalized.currentStep);
  const nextStep = previousStep ?? normalized.currentStep;

  return {
    ...clearedState,
    currentStep: nextStep,
    selectedStep: nextStep,
  };
}

export function canPlayerSubmitCombatDeclaration(input: {
  participantId: string;
  state: CombatRoundState;
}): boolean {
  const normalized = combatRoundStateSchema.parse(input.state);
  const participant = normalized.participants.find(
    (entry) => entry.participantId === input.participantId,
  );
  const declarationStatus = participant?.stepStatuses.select_actions ?? "pending";
  const existingDeclarationIsIncomplete = participant?.declaration
    ? !validateCombatDeclarationTargets({
        actionId: participant.declaration.actionId,
        phaseContexts: participant.declaration.phaseContexts,
        secondaryActionId: participant.declaration.secondaryActionId,
      }).valid
    : false;
  const declarationStatusIsHardClosed =
    declarationStatus === "locked" ||
    declarationStatus === "complete" ||
    declarationStatus === "skipped";
  const combatExperienceRequired = isCombatStartExperienceRollRequired({
    participantId: input.participantId,
    state: normalized,
  });

  return (
    normalized.currentStep === "select_actions" &&
    !combatExperienceRequired &&
    !declarationStatusIsHardClosed &&
    (declarationStatus === "pending" || existingDeclarationIsIncomplete)
  );
}

export function canPlayerRollCombatInitiative(input: {
  participantId: string;
  phase: "phase1" | "phase2";
  state: CombatRoundState;
}): boolean {
  const normalized = combatRoundStateSchema.parse(input.state);
  const requiredStep = input.phase === "phase1" ? "initiative_phase_1" : "initiative_phase_2";
  const participant = normalized.participants.find(
    (entry) => entry.participantId === input.participantId,
  );
  const initiativeValue = participant?.initiatives[input.phase];
  const stepStatus = participant?.stepStatuses[requiredStep] ?? "pending";

  return (
    normalized.currentStep === requiredStep &&
    initiativeValue === undefined &&
    stepStatus === "pending"
  );
}

export function isCombatRoundPhaseInitiativeComplete(input: {
  phase: "phase1" | "phase2";
  state: CombatRoundState;
}): boolean {
  const normalized = combatRoundStateSchema.parse(input.state);
  const requiredStep = input.phase === "phase1" ? "initiative_phase_1" : "initiative_phase_2";

  return normalized.participants.every((participant) => {
    if (participant.initiatives[input.phase] !== undefined) {
      return true;
    }

    const stepStatus = participant.stepStatuses[requiredStep] ?? "pending";

    return (
      stepStatus === "complete" ||
      stepStatus === "gmEdited" ||
      stepStatus === "locked" ||
      stepStatus === "skipped" ||
      stepStatus === "submitted"
    );
  });
}

export function canPlayerRollCombatAttack(input: {
  participantId: string;
  phase: "phase1" | "phase2";
  state: CombatRoundState;
}): boolean {
  const normalized = combatRoundStateSchema.parse(input.state);
  const requiredStep = input.phase === "phase1" ? "phase_1_actions" : "phase_2_actions";
  const requiredCursorStep = input.phase === "phase1" ? "A1" : "A2";
  const existingAttackResult = getCombatRoundOutgoingAttackResultForParticipantPhase({
    participantId: input.participantId,
    phase: input.phase,
    state: normalized,
  });

  return (
    normalized.currentStep === requiredStep &&
    normalized.currentCursor?.participantId === input.participantId &&
    normalized.currentCursor.step === requiredCursorStep &&
    normalized.phaseResolutionCursor?.participantId === input.participantId &&
    normalized.phaseResolutionCursor.phase === input.phase &&
    normalized.phaseResolutionCursor.substep === "attack" &&
    combatRoundParticipantHasExecutablePhaseAttack(input) &&
    existingAttackResult === undefined
  );
}

export type PlayerCombatCurrentRollAction =
  | {
      kind: "attack";
      participantId: string;
      phase: CombatRoundPhase;
      step: "A1" | "A2";
    }
  | {
      attackResultId: string;
      attackerParticipantId: string;
      defenderParticipantId: string;
      kind: "parry";
      participantId: string;
      phase: CombatRoundPhase;
      step: "P1" | "P2";
    }
  | {
      attackResultId: string;
      attackerParticipantId: string;
      defenderParticipantId: string;
      kind: "hit_location";
      participantId: string;
      phase: CombatRoundPhase;
      step: "D1" | "D2";
    }
  | {
      attackResultId: string;
      attackerParticipantId: string;
      defenderParticipantId: string;
      kind: "critical";
      participantId: string;
      phase: CombatRoundPhase;
      step: "D1" | "D2";
    };

function getCombatRoundAttackPhaseForCursorStep(
  step: CombatRoundCursorStep,
): CombatRoundPhase | undefined {
  if (step === "A1") {
    return "phase1";
  }

  if (step === "A2") {
    return "phase2";
  }

  return undefined;
}

function getCombatRoundParryPhaseForCursorStep(
  step: CombatRoundCursorStep,
): CombatRoundPhase | undefined {
  if (step === "P1") {
    return "phase1";
  }

  if (step === "P2") {
    return "phase2";
  }

  return undefined;
}

function getCombatRoundDamagePhaseForCursorStep(
  step: CombatRoundCursorStep,
): CombatRoundPhase | undefined {
  if (step === "D1") {
    return "phase1";
  }

  if (step === "D2") {
    return "phase2";
  }

  return undefined;
}

function getCurrentCursorIncomingAttackContext(input: {
  phase: CombatRoundPhase;
  state: CombatRoundState;
}):
  | {
      attackResult: CombatRoundAttackRollResult;
      attackResultId: string;
      resolution: CombatRoundPhaseResolutionResult;
    }
  | undefined {
  const normalized = combatRoundStateSchema.parse(input.state);
  const participantId = normalized.currentCursor?.participantId;

  if (!participantId) {
    return undefined;
  }

  const attackResult = getCombatRoundDisplayIncomingAttackResultForParticipantPhase({
    participantId,
    phase: input.phase,
    state: normalized,
  });

  if (!attackResult) {
    return undefined;
  }

  return {
    attackResult,
    attackResultId: getCombatRoundAttackResultId({
      result: attackResult,
      roundNumber: normalized.roundNumber,
    }),
    resolution:
      getCombatRoundPhaseResolutionResultForAttack({
        attackResult,
        state: normalized,
      }) ??
      buildCombatRoundPhaseResolutionResult({
        attackResult,
        roundNumber: normalized.roundNumber,
        updatedAt: attackResult.rolledAt,
      }),
  };
}

export function getPlayerCombatCurrentRollAction(input: {
  participantId: string;
  state: CombatRoundState;
}): PlayerCombatCurrentRollAction | undefined {
  const normalized = combatRoundStateSchema.parse(input.state);
  const cursor = normalized.currentCursor;

  if (!cursor || cursor.roundNumber !== normalized.roundNumber) {
    return undefined;
  }

  const attackPhase = getCombatRoundAttackPhaseForCursorStep(cursor.step);

  if (
    attackPhase &&
    (cursor.step === "A1" || cursor.step === "A2") &&
    cursor.participantId === input.participantId
  ) {
    return canPlayerRollCombatAttack({
      participantId: input.participantId,
      phase: attackPhase,
      state: normalized,
    })
      ? {
          kind: "attack",
          participantId: input.participantId,
          phase: attackPhase,
          step: cursor.step,
        }
      : undefined;
  }

  const parryPhase = getCombatRoundParryPhaseForCursorStep(cursor.step);

  if (
    parryPhase &&
    (cursor.step === "P1" || cursor.step === "P2") &&
    cursor.participantId === input.participantId
  ) {
    const context = getCurrentCursorIncomingAttackContext({
      phase: parryPhase,
      state: normalized,
    });

    return context?.attackResult.hit &&
      context.attackResult.defenderParticipantId === input.participantId &&
      context.resolution.parryResolution.status === "pending"
      ? {
          attackResultId: context.attackResultId,
          attackerParticipantId: context.attackResult.attackerParticipantId,
          defenderParticipantId: context.attackResult.defenderParticipantId,
          kind: "parry",
          participantId: input.participantId,
          phase: parryPhase,
          step: cursor.step,
        }
      : undefined;
  }

  const damagePhase = getCombatRoundDamagePhaseForCursorStep(cursor.step);

  if (!damagePhase || (cursor.step !== "D1" && cursor.step !== "D2")) {
    return undefined;
  }

  const context = getCurrentCursorIncomingAttackContext({
    phase: damagePhase,
    state: normalized,
  });

  if (
    !context ||
    context.attackResult.attackerParticipantId !== input.participantId ||
    context.attackResult.defenderParticipantId !== cursor.participantId
  ) {
    return undefined;
  }

  const damageSubstate = getCombatRoundDamageSubstate(context.resolution);

  if (damageSubstate === "location_pending") {
    return {
      attackResultId: context.attackResultId,
      attackerParticipantId: context.attackResult.attackerParticipantId,
      defenderParticipantId: context.attackResult.defenderParticipantId,
      kind: "hit_location",
      participantId: input.participantId,
      phase: damagePhase,
      step: cursor.step,
    };
  }

  if (damageSubstate === "critical_pending") {
    return {
      attackResultId: context.attackResultId,
      attackerParticipantId: context.attackResult.attackerParticipantId,
      defenderParticipantId: context.attackResult.defenderParticipantId,
      kind: "critical",
      participantId: input.participantId,
      phase: damagePhase,
      step: cursor.step,
    };
  }

  return undefined;
}

export function setCombatRoundActiveParticipant(
  state: CombatRoundState,
  participantId?: string,
): CombatRoundState {
  const normalized = combatRoundStateSchema.parse(state);
  const hasParticipant = normalized.participants.some(
    (participant) => participant.participantId === participantId,
  );

  return {
    ...normalized,
    activeParticipantId: hasParticipant ? participantId : undefined,
    selectedParticipantId: hasParticipant ? participantId : normalized.selectedParticipantId,
  };
}

export function setCombatRoundSelection(input: {
  participantId?: string;
  state: CombatRoundState;
  step?: CombatRoundStep;
}): CombatRoundState {
  const normalized = combatRoundStateSchema.parse(input.state);
  const hasParticipant = normalized.participants.some(
    (participant) => participant.participantId === input.participantId,
  );

  return {
    ...normalized,
    selectedParticipantId: hasParticipant ? input.participantId : normalized.selectedParticipantId,
    selectedStep: input.step ?? normalized.selectedStep,
  };
}

export function setCombatRoundParticipantInitiative(input: {
  initiative?: CombatRoundInitiativeResult | number;
  participantId: string;
  phase: "phase1" | "phase2";
  state: CombatRoundState;
}): CombatRoundState {
  const normalized = combatRoundStateSchema.parse(input.state);
  const initiative = normalizeCombatRoundInitiativeResult(input.initiative);

  return {
    ...normalized,
    participants: normalized.participants.map((participant) =>
      participant.participantId === input.participantId
        ? {
            ...participant,
            initiatives: {
              ...participant.initiatives,
              [input.phase]: initiative,
            },
          }
        : participant,
    ),
  };
}

export function setCombatRoundParticipantStepStatus(input: {
  participantId: string;
  state: CombatRoundState;
  status: CombatRoundStepStatus;
  step: CombatRoundStep;
}): CombatRoundState {
  const normalized = combatRoundStateSchema.parse(input.state);

  return {
    ...normalized,
    participants: normalized.participants.map((participant) =>
      participant.participantId === input.participantId
        ? {
            ...participant,
            stepStatuses: {
              ...participant.stepStatuses,
              [input.step]: input.status,
            },
          }
        : participant,
    ),
  };
}

export function sortCombatRoundParticipantsByInitiative(input: {
  phase: "phase1" | "phase2";
  state: CombatRoundState;
}): CombatRoundParticipantState[] {
  const normalized = combatRoundStateSchema.parse(input.state);
  const originalIndexByParticipantId = new Map(
    normalized.participants.map((participant, index) => [participant.participantId, index]),
  );

  return [...normalized.participants].sort((left, right) => {
    const leftInitiative = getCombatRoundInitiativeTotal(left.initiatives[input.phase]);
    const rightInitiative = getCombatRoundInitiativeTotal(right.initiatives[input.phase]);

    if (leftInitiative !== undefined && rightInitiative !== undefined) {
      return (
        rightInitiative - leftInitiative ||
        (originalIndexByParticipantId.get(left.participantId) ?? 0) -
          (originalIndexByParticipantId.get(right.participantId) ?? 0)
      );
    }

    if (leftInitiative !== undefined) {
      return -1;
    }

    if (rightInitiative !== undefined) {
      return 1;
    }

    return (
      (originalIndexByParticipantId.get(left.participantId) ?? 0) -
      (originalIndexByParticipantId.get(right.participantId) ?? 0)
    );
  });
}

export function getCombatRoundInitiativePositions(input: {
  phase: "phase1" | "phase2";
  state: CombatRoundState;
}): Record<string, number> {
  const ranks = getCombatRoundInitiativeRanks(input);

  return Object.fromEntries(
    Object.entries(ranks).map(([participantId, rank]) => [participantId, rank.rank]),
  );
}

export function getCombatRoundInitiativeRanks(input: {
  phase: "phase1" | "phase2";
  state: CombatRoundState;
}): Record<string, CombatRoundInitiativeRank> {
  const sortedParticipants = sortCombatRoundParticipantsByInitiative(input);
  const rolledParticipants = sortedParticipants
    .map((participant) => ({
      participant,
      total: getCombatRoundInitiativeTotal(participant.initiatives[input.phase]),
    }))
    .filter(
      (entry): entry is { participant: CombatRoundParticipantState; total: number } =>
        entry.total !== undefined,
    );
  const tiedCountsByTotal = rolledParticipants.reduce((counts, entry) => {
    counts.set(entry.total, (counts.get(entry.total) ?? 0) + 1);

    return counts;
  }, new Map<number, number>());
  const ranks: Record<string, CombatRoundInitiativeRank> = {};
  let currentRank = 0;
  let previousTotal: number | undefined;

  rolledParticipants.forEach((entry, index) => {
    if (entry.total !== previousTotal) {
      currentRank = index + 1;
      previousTotal = entry.total;
    }

    ranks[entry.participant.participantId] = {
      rank: currentRank,
      rankTotal: rolledParticipants.length,
      tiedCount: tiedCountsByTotal.get(entry.total) ?? 1,
    };
  });

  return ranks;
}

export function buildCombatRoundInspector(input: {
  participantId?: string;
  state: CombatRoundState;
  step?: CombatRoundStep;
}): {
  participant?: CombatRoundParticipantState;
  snapshot?: CombatRoundStepSnapshot;
  status?: CombatRoundStepStatus;
  step: CombatRoundStep;
} {
  const normalized = combatRoundStateSchema.parse(input.state);
  const step = input.step ?? normalized.selectedStep ?? normalized.currentStep;
  const participant =
    normalized.participants.find((entry) => entry.participantId === input.participantId) ??
    normalized.participants.find(
      (entry) => entry.participantId === normalized.selectedParticipantId,
    ) ??
    normalized.participants[0];

  return {
    participant,
    snapshot: participant
      ? getCombatRoundStepSnapshot({
          participantId: participant.participantId,
          roundNumber: normalized.roundNumber,
          state: normalized,
          step,
        })
      : undefined,
    status: participant?.stepStatuses[step],
    step,
  };
}

export interface CombatRoundLatestEventSummary {
  commandId?: string;
  details?: string;
  phase?: CombatRoundPhase;
  resultId?: string;
  roundNumber: number;
  shortTitle: string;
  step?: CombatRoundCursorStep;
  summaryText: string;
}

type CombatRoundLatestEventParticipantLabel = {
  label: string;
  participantId: string;
};

function getCombatRoundLatestEventFactRecord(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}

function getCombatRoundLatestEventFactString(
  facts: Record<string, unknown>,
  key: string,
): string | undefined {
  const value = facts[key];

  return typeof value === "string" ? value : undefined;
}

function getCombatRoundLatestEventFactNumber(
  facts: Record<string, unknown>,
  key: string,
): number | undefined {
  const value = facts[key];

  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function getCombatRoundLatestEventFactBoolean(
  facts: Record<string, unknown>,
  key: string,
): boolean | undefined {
  const value = facts[key];

  return typeof value === "boolean" ? value : undefined;
}

function getCombatRoundLatestEventFactArray(
  facts: Record<string, unknown>,
  key: string,
): unknown[] {
  const value = facts[key];

  return Array.isArray(value) ? value : [];
}

function getCombatRoundLatestEventPhaseLabel(phase?: CombatRoundPhase): string {
  return phase === "phase1" ? "Phase 1" : phase === "phase2" ? "Phase 2" : "Round";
}

function getCombatRoundLatestEventHitLocationLabel(location?: string): string | undefined {
  const parsed = hitLocationSchema.safeParse(location);

  return parsed.success ? getHitLocationFullLabel(parsed.data).toLowerCase() : undefined;
}

function getCombatRoundLatestEventDamageLocationSuffix(location?: string): string {
  const label = getCombatRoundLatestEventHitLocationLabel(location);

  return label ? ` to ${label}` : "";
}

function getCombatRoundLatestEventCriticalEffectCount(effects: readonly unknown[]): number {
  return effects.filter((effect) => {
    const record = getCombatRoundLatestEventFactRecord(effect);

    return Boolean(
      record &&
      (record.sourceKind === "critical_table" ||
        typeof record.sourceCritKey === "string" ||
        typeof record.sourceEffectKey === "string"),
    );
  }).length;
}

function getCombatRoundLatestEventCriticalProposalDetails(damageResult?: CombatRoundDamageResult): {
  proposedCriticalEffects: number;
  proposalStatus?: string;
  warnings: string[];
} {
  const proposal = damageResult?.review?.criticalEffectProposal;
  const proposedCriticalEffects = getCombatRoundLatestEventCriticalEffectCount(
    damageResult?.review?.additionalEffects ?? [],
  );

  if (!proposal) {
    return {
      proposedCriticalEffects,
      warnings: [],
    };
  }

  if (proposal.warnings.length > 0) {
    return {
      proposedCriticalEffects,
      proposalStatus: `Critical effects unavailable: ${proposal.warnings.join(" ")}`,
      warnings: proposal.warnings,
    };
  }

  return {
    proposedCriticalEffects,
    proposalStatus: `Critical-derived rows: ${proposedCriticalEffects} row${
      proposedCriticalEffects === 1 ? "" : "s"
    }.`,
    warnings: [],
  };
}

function getCombatRoundLatestEventLabel(input: {
  labelByParticipantId: Map<string, string>;
  participantId?: string;
}): string {
  return input.participantId
    ? (input.labelByParticipantId.get(input.participantId) ?? input.participantId)
    : "Unknown participant";
}

function findCombatRoundLatestEventResolution(input: {
  command: CombatRoundCommand;
  state: CombatRoundState;
}): CombatRoundPhaseResolutionResult | undefined {
  const attackResultId = getCombatRoundLatestEventFactString(input.command.facts, "attackResultId");

  if (attackResultId) {
    return input.state.phaseResolutionResults.find(
      (result) => result.attackResultId === attackResultId,
    );
  }

  return input.state.phaseResolutionResults.find(
    (result) =>
      result.roundNumber === input.command.roundNumber &&
      result.phase === input.command.phase &&
      (result.attackerParticipantId === input.command.participantId ||
        result.defenderParticipantId === input.command.participantId),
  );
}

function findCombatRoundLatestEventAttackResult(input: {
  command: CombatRoundCommand;
  state: CombatRoundState;
}): CombatRoundAttackRollResult | undefined {
  if (!input.command.phase) {
    return undefined;
  }

  const participant = input.state.participants.find(
    (entry) => entry.participantId === input.command.participantId,
  );

  return participant?.attackResults[input.command.phase];
}

function getCombatRoundLatestEventForCommand(input: {
  command: CombatRoundCommand;
  labelByParticipantId: Map<string, string>;
  state: CombatRoundState;
}): CombatRoundLatestEventSummary | undefined {
  const { command, labelByParticipantId, state } = input;
  const facts = command.facts;
  const actorLabel = getCombatRoundLatestEventLabel({
    labelByParticipantId,
    participantId: command.participantId,
  });
  const phaseLabel = getCombatRoundLatestEventPhaseLabel(command.phase);

  if (command.type === "complete_round") {
    const nextRoundNumber =
      getCombatRoundLatestEventFactNumber(facts, "nextRoundNumber") ??
      command.afterCursor.roundNumber;

    return {
      commandId: command.id,
      roundNumber: nextRoundNumber,
      shortTitle: "New round started",
      step: command.afterCursor.step,
      summaryText: `Round ${nextRoundNumber}: New round started.`,
    };
  }

  if (command.type === "roll_combat_experience") {
    const skillTotal = getCombatRoundLatestEventFactNumber(facts, "skillTotal") ?? 0;
    const rollTotal = getCombatRoundLatestEventFactNumber(facts, "rollTotal");
    const finalTotal = getCombatRoundLatestEventFactNumber(facts, "finalTotal");
    const noRollRequired = getCombatRoundLatestEventFactBoolean(facts, "noRollRequired") ?? false;
    const effectiveTableTotal = getCombatRoundLatestEventFactNumber(facts, "effectiveTableTotal");
    const difficulty =
      getCombatRoundLatestEventFactNumber(facts, "difficulty") ??
      COMBAT_EXPERIENCE_DEFAULT_DIFFICULTY;
    const resultLabel = getCombatRoundLatestEventFactString(facts, "resultLabel") ?? "Active";
    const modifierValue = getCombatRoundLatestEventFactNumber(facts, "modifierValue") ?? 0;
    const durationRounds = getCombatRoundLatestEventFactNumber(facts, "durationRounds") ?? 0;
    const phaseAttackCancelled =
      getCombatRoundLatestEventFactBoolean(facts, "phaseAttackCancelled") ?? false;
    const isPhaseCombatExperience = command.step === "A1" || command.step === "A2";
    const effectText = phaseAttackCancelled
      ? " No attack made."
      : isPhaseCombatExperience && modifierValue < 0
        ? ` Phase attack OB ${modifierValue}.`
        : modifierValue !== 0 && durationRounds > 0
          ? ` General ${modifierValue} for ${durationRounds} round${durationRounds === 1 ? "" : "s"}.`
          : " No modifier.";
    const effectiveTableText =
      effectiveTableTotal !== undefined
        ? ` Effective CE table result: ${effectiveTableTotal}.`
        : "";
    const stepLabel = command.step ?? "DE";

    return {
      commandId: command.id,
      roundNumber: command.roundNumber,
      shortTitle: "Combat Experience",
      step: command.step,
      summaryText: noRollRequired
        ? `Round ${command.roundNumber}, ${stepLabel}: ${actorLabel} Combat Experience ${skillTotal} vs ${difficulty}.${effectiveTableText} Result: ${resultLabel}, no roll required.${effectText}`
        : `Round ${command.roundNumber}, ${stepLabel}: ${actorLabel} Combat Experience ${skillTotal} + roll ${
            rollTotal ?? "?"
          } = ${finalTotal ?? "?"} vs ${difficulty}.${effectiveTableText} Result: ${resultLabel}.${effectText}`,
    };
  }

  if (command.type === "commit_phase_initiative_resolution") {
    const attackStep = getCombatRoundLatestEventFactString(facts, "attackStep") ?? "A";

    return {
      commandId: command.id,
      roundNumber: command.roundNumber,
      shortTitle: "Phase initiative committed",
      step: command.step,
      summaryText: `Round ${command.roundNumber}, ${phaseLabel}: Phase initiative resolution committed; ${attackStep} opened.`,
    };
  }

  if (command.type === "back_out_phase_attack") {
    const softenedModifierIds = getCombatRoundLatestEventFactArray(facts, "softenedModifierIds");
    const warning = getCombatRoundLatestEventFactString(facts, "modifierSofteningWarning");
    const modifierText =
      softenedModifierIds.length > 0
        ? " DB/Parry attack penalty reduced from -4 to -2 for this phase."
        : " No generated DB/Parry -4 modifier was found to soften.";

    return {
      commandId: command.id,
      details: warning,
      roundNumber: command.roundNumber,
      shortTitle: "Backed out of attack",
      step: command.step,
      summaryText: `Round ${command.roundNumber}, ${phaseLabel}: ${actorLabel} backed out of attack; attack skipped.${modifierText}`,
    };
  }

  if (command.type === "roll_round_end_health_check") {
    const finalTotal = getCombatRoundLatestEventFactNumber(facts, "finalTotal");
    const difficulty = getCombatRoundLatestEventFactNumber(facts, "difficulty");
    const success = getCombatRoundLatestEventFactBoolean(facts, "success");
    const bleedType = getCombatRoundLatestEventFactString(facts, "bleedType");
    const previousBleedRate = getCombatRoundLatestEventFactNumber(facts, "previousBleedRate");
    const nextBleedRate = getCombatRoundLatestEventFactNumber(facts, "nextBleedRate");
    const bleedLabel = bleedType === "internal" ? "internal bleed" : "bleed";
    const bleedResult =
      success && previousBleedRate !== undefined && nextBleedRate !== undefined
        ? `; ${bleedLabel} reduced from ${previousBleedRate} to ${nextBleedRate}.`
        : success === false && previousBleedRate !== undefined
          ? `; ${bleedLabel} remains ${previousBleedRate}.`
          : ".";

    return {
      commandId: command.id,
      roundNumber: command.roundNumber,
      shortTitle: success ? "Health roll succeeded" : "Health roll failed",
      step: command.step,
      summaryText: `Round ${command.roundNumber}, SU: ${actorLabel} health roll ${
        finalTotal ?? "?"
      }${difficulty !== undefined ? ` vs ${difficulty}` : ""}${
        success === undefined ? "." : success ? ` succeeded${bleedResult}` : ` failed${bleedResult}`
      }`,
    };
  }

  if (command.type === "commit_round_end_participant_review") {
    const damageIds = getCombatRoundLatestEventFactArray(facts, "acceptedDamageProposalIds");
    const healthIds = getCombatRoundLatestEventFactArray(facts, "acceptedHealthRollIds");

    return {
      commandId: command.id,
      details:
        healthIds.length > 0
          ? `${healthIds.length} health roll${healthIds.length === 1 ? "" : "s"} pending.`
          : undefined,
      roundNumber: command.roundNumber,
      shortTitle: "Round-end review committed",
      step: command.step,
      summaryText: `Round ${command.roundNumber}, SU: ${actorLabel} round-end review committed${
        damageIds.length > 0
          ? ` with ${damageIds.length} bleed damage proposal${
              damageIds.length === 1 ? "" : "s"
            } applied`
          : ""
      }.`,
    };
  }

  if (command.type === "prepare_round_end_review") {
    return {
      commandId: command.id,
      roundNumber: command.roundNumber,
      shortTitle: "Round-end review ready",
      step: command.step,
      summaryText: `Round ${command.roundNumber}, SU: Round-end review proposals prepared.`,
    };
  }

  if (command.type === "commit_phase_damage") {
    const attackerLabel = getCombatRoundLatestEventLabel({
      labelByParticipantId,
      participantId: getCombatRoundLatestEventFactString(facts, "attackerParticipantId"),
    });
    const defenderLabel = getCombatRoundLatestEventLabel({
      labelByParticipantId,
      participantId: getCombatRoundLatestEventFactString(facts, "defenderParticipantId"),
    });
    const totalDamage = getCombatRoundLatestEventFactNumber(facts, "totalDamage") ?? 0;
    const location = getCombatRoundLatestEventFactString(facts, "effectiveHitLocation");
    const criticalGrade = getCombatRoundLatestEventFactString(facts, "criticalGrade");
    const criticalRollRecord = getCombatRoundLatestEventFactRecord(facts.criticalRoll);
    const finalCriticalRoll =
      criticalRollRecord && typeof criticalRollRecord.finalCriticalRoll === "number"
        ? criticalRollRecord.finalCriticalRoll
        : undefined;
    const criticalLocation =
      criticalRollRecord && typeof criticalRollRecord.selectedHitLocation === "string"
        ? criticalRollRecord.selectedHitLocation
        : location;
    const additionalEffects = getCombatRoundLatestEventFactArray(facts, "additionalEffects");
    const criticalEffectsCommitted =
      getCombatRoundLatestEventCriticalEffectCount(additionalEffects);
    const critical =
      criticalGrade || finalCriticalRoll !== undefined
        ? ` Critical${criticalGrade ? ` ${criticalGrade.toUpperCase()} pending` : ""}${
            finalCriticalRoll !== undefined
              ? `${criticalGrade ? "," : ""} critical roll ${finalCriticalRoll}${getCombatRoundLatestEventDamageLocationSuffix(
                  criticalLocation,
                )}`
              : ""
          }.`
        : "";
    const cap =
      getCombatRoundLatestEventFactBoolean(facts, "maxDamageApplied") === true
        ? ` Raw damage ${
            getCombatRoundLatestEventFactNumber(facts, "rawTotalDamage") ?? totalDamage
          } was capped to ${totalDamage}.`
        : "";

    return {
      commandId: command.id,
      details: `${cap} Critical effects committed: ${criticalEffectsCommitted} row${
        criticalEffectsCommitted === 1 ? "" : "s"
      }.`.trim(),
      phase: command.phase,
      resultId: getCombatRoundLatestEventFactString(facts, "damageResultId"),
      roundNumber: command.roundNumber,
      shortTitle: "Phase damage committed",
      step: command.step,
      summaryText: `Round ${command.roundNumber}, ${phaseLabel}: ${attackerLabel} hit ${defenderLabel} for ${totalDamage} damage${getCombatRoundLatestEventDamageLocationSuffix(
        location,
      )}.${critical}`,
    };
  }

  if (command.type === "roll_critical") {
    const resolution = findCombatRoundLatestEventResolution({ command, state });
    const criticalRoll = resolution?.criticalRoll;
    const proposalDetails = getCombatRoundLatestEventCriticalProposalDetails(
      resolution?.damageResult,
    );
    const finalCriticalRoll =
      criticalRoll?.finalCriticalRoll ??
      getCombatRoundLatestEventFactNumber(facts, "finalCriticalRoll");
    const location =
      criticalRoll?.selectedHitLocation ??
      getCombatRoundLatestEventFactString(facts, "selectedHitLocation");

    return {
      commandId: command.id,
      details: proposalDetails.proposalStatus,
      phase: command.phase,
      resultId: getCombatRoundLatestEventFactString(facts, "attackResultId"),
      roundNumber: command.roundNumber,
      shortTitle: "Critical rolled",
      step: command.step,
      summaryText: `Round ${command.roundNumber}, ${phaseLabel}: ${actorLabel} rolled critical ${
        finalCriticalRoll ?? "?"
      }${getCombatRoundLatestEventDamageLocationSuffix(location)}.`,
    };
  }

  if (command.type === "resolve_damage") {
    const totalDamage = getCombatRoundLatestEventFactNumber(facts, "totalDamage") ?? 0;
    const defenderLabel = getCombatRoundLatestEventLabel({
      labelByParticipantId,
      participantId:
        getCombatRoundLatestEventFactString(facts, "defenderParticipantId") ??
        command.participantId,
    });
    const location = getCombatRoundLatestEventFactString(facts, "selectedHitLocation");
    const criticalGrade = getCombatRoundLatestEventFactString(facts, "criticalGrade");

    return {
      commandId: command.id,
      phase: command.phase,
      resultId: getCombatRoundLatestEventFactString(facts, "damageResultId"),
      roundNumber: command.roundNumber,
      shortTitle: "Damage proposal ready",
      step: command.step,
      summaryText: `Round ${command.roundNumber}, ${phaseLabel}: Damage proposal for ${defenderLabel}: ${totalDamage} damage${getCombatRoundLatestEventDamageLocationSuffix(
        location,
      )}${criticalGrade ? `, Critical ${criticalGrade.toUpperCase()} pending` : ""}.`,
    };
  }

  if (command.type === "roll_hit_location") {
    const location = getCombatRoundLatestEventFactString(facts, "selectedHitLocation");
    const rolls = getCombatRoundLatestEventFactArray(facts, "hitLocationRolls").filter(
      (roll): roll is number => typeof roll === "number",
    );

    return {
      commandId: command.id,
      phase: command.phase,
      resultId: getCombatRoundLatestEventFactString(facts, "attackResultId"),
      roundNumber: command.roundNumber,
      shortTitle: "Hit location rolled",
      step: command.step,
      summaryText: `Round ${command.roundNumber}, ${phaseLabel}: ${actorLabel} hit location ${
        rolls.length > 0 ? `roll ${rolls.join(", ")} ` : ""
      }selected ${getCombatRoundLatestEventHitLocationLabel(location) ?? "unknown location"}.`,
    };
  }

  if (command.type === "roll_parry") {
    const defenderLabel = getCombatRoundLatestEventLabel({
      labelByParticipantId,
      participantId:
        getCombatRoundLatestEventFactString(facts, "defenderParticipantId") ??
        command.participantId,
    });
    const attackerLabel = getCombatRoundLatestEventLabel({
      labelByParticipantId,
      participantId: getCombatRoundLatestEventFactString(facts, "attackerParticipantId"),
    });
    const success = getCombatRoundLatestEventFactBoolean(facts, "success");

    return {
      commandId: command.id,
      phase: command.phase,
      resultId: getCombatRoundLatestEventFactString(facts, "attackResultId"),
      roundNumber: command.roundNumber,
      shortTitle: success ? "Parry succeeded" : "Parry failed",
      step: command.step,
      summaryText: `Round ${command.roundNumber}, ${phaseLabel}: ${defenderLabel} ${
        success ? "parried" : "failed to parry"
      } ${attackerLabel}'s attack.`,
    };
  }

  if (command.type === "roll_attack") {
    const attackResult = findCombatRoundLatestEventAttackResult({ command, state });
    const defenderLabel = getCombatRoundLatestEventLabel({
      labelByParticipantId,
      participantId:
        attackResult?.defenderParticipantId ??
        getCombatRoundLatestEventFactString(facts, "defenderParticipantId"),
    });
    const hit = attackResult?.hit ?? getCombatRoundLatestEventFactBoolean(facts, "hit");
    const grazing = attackResult?.grazing ?? getCombatRoundLatestEventFactBoolean(facts, "grazing");
    const resultLabel = grazing ? "grazed" : hit ? "hit" : "missed";

    return {
      commandId: command.id,
      phase: command.phase,
      resultId:
        getCombatRoundLatestEventFactString(facts, "attackResultId") ??
        (attackResult
          ? getCombatRoundAttackResultId({
              result: attackResult,
              roundNumber: command.roundNumber,
            })
          : undefined),
      roundNumber: command.roundNumber,
      shortTitle: "Attack rolled",
      step: command.step,
      summaryText: `Round ${command.roundNumber}, ${phaseLabel}: ${actorLabel} ${resultLabel} ${defenderLabel}.`,
    };
  }

  if (command.type === "roll_initiative_phase1" || command.type === "roll_initiative_phase2") {
    const phase = command.type === "roll_initiative_phase1" ? "phase1" : "phase2";
    const participant = state.participants.find(
      (entry) => entry.participantId === command.participantId,
    );
    const total = getCombatRoundInitiativeTotal(participant?.initiatives[phase]);

    return {
      commandId: command.id,
      phase,
      roundNumber: command.roundNumber,
      shortTitle: "Initiative recorded",
      step: command.step,
      summaryText: `Round ${command.roundNumber}, ${getCombatRoundLatestEventPhaseLabel(
        phase,
      )}: Initiative recorded for ${actorLabel}${total !== undefined ? ` (${total})` : ""}.`,
    };
  }

  return undefined;
}

export function getLatestCombatEventSummary(
  state: CombatRoundState,
  participants: readonly CombatRoundLatestEventParticipantLabel[] = [],
): CombatRoundLatestEventSummary | undefined {
  const normalized = combatRoundStateSchema.parse(state);
  const timelineStates = getCombatRoundTimelineRoundStates(normalized);
  const labelByParticipantId = new Map<string, string>();

  for (const participant of participants) {
    labelByParticipantId.set(participant.participantId, participant.label);
  }

  for (const timelineState of timelineStates) {
    for (const participant of timelineState.participants) {
      labelByParticipantId.set(participant.participantId, participant.label);
    }
  }

  for (let stateIndex = timelineStates.length - 1; stateIndex >= 0; stateIndex -= 1) {
    const timelineState = timelineStates[stateIndex];

    for (
      let commandIndex = timelineState.commands.length - 1;
      commandIndex >= 0;
      commandIndex -= 1
    ) {
      const command = timelineState.commands[commandIndex];
      const summary = getCombatRoundLatestEventForCommand({
        command,
        labelByParticipantId,
        state: timelineState,
      });

      if (summary) {
        return summary;
      }
    }
  }

  return undefined;
}

export function getCombatRoundTimelineRoundStates(state: CombatRoundState): CombatRoundState[] {
  const normalized = combatRoundStateSchema.parse(state);
  const completedRounds = normalized.rounds
    .filter((round) => round.roundNumber !== normalized.roundNumber)
    .sort((left, right) => left.roundNumber - right.roundNumber)
    .map((round) =>
      combatRoundStateSchema.parse({
        activeParticipantId: round.activeParticipantId,
        commands: round.commands,
        currentCursor: round.currentCursor,
        currentStep: round.currentStep,
        encounterId: round.encounterId ?? normalized.encounterId,
        phaseResolutionCursor: round.phaseResolutionCursor,
        phaseResolutionResults: round.phaseResolutionResults,
        phaseResolutionStatuses: round.phaseResolutionStatuses,
        participants: round.participants,
        roundEndReview: round.roundEndReview,
        roundNumber: round.roundNumber,
        rounds: [],
        selectedParticipantId: round.selectedParticipantId,
        selectedStep: round.selectedStep,
        stepSnapshots: round.stepSnapshots,
      }),
    );

  return [
    ...completedRounds,
    combatRoundStateSchema.parse({
      ...normalized,
      rounds: [],
    }),
  ];
}
