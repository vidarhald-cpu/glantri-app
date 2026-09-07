import { z } from "zod";

import {
  canonicalCombatModifierEffectSchema,
  canonicalCombatModifierLifecycleTransitionSchema,
} from "./combatModifierLifecycle";
import {
  combatCriticalBleedAccumulatorSchema,
  combatCriticalBleedControlStateSchema,
  combatCriticalEffectRuntimeSchema,
  combatCriticalExactRationalSchema,
  getCombatCriticalBleedControlStateLabel,
  getCombatCriticalBleedEffectiveRate,
  transitionCombatCriticalBleedControl,
  type CombatCriticalBleedControlState,
  type CombatCriticalExactRational,
} from "./combatCriticalRuntime";

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
  "pending",
  "active",
  "resolved",
  "expired",
  "superseded",
]);

export const combatEffectModifierBucketSchema = z.enum([
  "general",
  "initiative",
  "skill_ob",
  "db_parry",
]);

export const combatEffectBleedStateSchema = z.object({
  accumulatedTenths: z.number().int().nonnegative().default(0),
  initializedRound: z.number().int().positive().optional(),
  lastHealthCheckRound: z.number().int().positive().optional(),
});

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

export const combatEffectSchema = z
  .object({
    canonicalLifecycle: canonicalCombatModifierEffectSchema.optional(),
    canonicalTransitions: z.array(canonicalCombatModifierLifecycleTransitionSchema).optional(),
    checkRequired: z.boolean().optional(),
    checkSkillOrStat: z.string().optional(),
    combatWide: z.boolean().optional(),
    criticalRuntime: combatCriticalEffectRuntimeSchema.optional(),
    combatModifierBucket: combatEffectModifierBucketSchema.optional(),
    createdInInitiativeGroupId: idSchema.optional(),
    createdAt: timestampSchema,
    damage: z.number().default(0),
    description: z.string().optional(),
    duration: z.string().optional(),
    excludedRollPurposes: z.array(z.string().min(1)).optional(),
    effectGroup: combatEffectGroupSchema,
    effectiveAfterInitiativeGroupId: idSchema.optional(),
    expiresAtRound: z.number().int().positive().optional(),
    generalDamage: z.number().default(0),
    id: idSchema,
    initiativePhase: z.enum(["phase1", "phase2"]).optional(),
    initiativeValue: z.number().int().optional(),
    location: z.string().optional(),
    modifierValue: z.number().optional(),
    bleedState: combatEffectBleedStateSchema.optional(),
    roundNumber: z.number().int().positive().optional(),
    sourceAttackResultId: idSchema.optional(),
    sourceEventId: idSchema,
    sourceOpportunityId: idSchema.optional(),
    status: combatEffectStatusSchema.default("active"),
    targetParticipantId: idSchema,
    type: combatEffectTypeSchema,
    updatedAt: timestampSchema,
  })
  .superRefine((effect, context) => {
    if (effect.canonicalLifecycle && effect.canonicalLifecycle.id !== effect.id) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Canonical lifecycle identity must match the durable combat effect.",
        path: ["canonicalLifecycle", "id"],
      });
    }
    if (
      effect.canonicalLifecycle &&
      effect.canonicalLifecycle.ownerParticipantId !== effect.targetParticipantId
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Canonical lifecycle owner must match the durable combat effect target.",
        path: ["canonicalLifecycle", "ownerParticipantId"],
      });
    }
  });

export const combatEffectsStateSchema = z
  .object({
    criticalBleedAccumulator: combatCriticalBleedAccumulatorSchema.optional(),
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
export type CombatEffectModifierBucket = z.infer<typeof combatEffectModifierBucketSchema>;
export type CombatEffectBleedState = z.infer<typeof combatEffectBleedStateSchema>;
export type CombatEffectEvent = z.infer<typeof combatEffectEventSchema>;
export type CombatEffect = z.infer<typeof combatEffectSchema>;
export type CombatEffectsState = z.infer<typeof combatEffectsStateSchema>;

export interface CombatEffectInitiativeTimingContext {
  currentInitiativeGroupId?: string;
}

export function transitionCombatCriticalBleedEffect(input: {
  combatEffects?: CombatEffectsState;
  createdAt: string;
  createdByUserId?: string;
  effectId: string;
  encounterId?: string;
  nextState: CombatCriticalBleedControlState;
  partialRate?: CombatCriticalExactRational;
  roundNumber?: number;
  scenarioId?: string;
}): {
  combatEffects: CombatEffectsState;
  nextState: CombatCriticalBleedControlState;
  previousState: CombatCriticalBleedControlState;
  rate: CombatCriticalExactRational;
  treatmentEventId: string;
} {
  const combatEffects = combatEffectsStateSchema.parse(input.combatEffects);
  const nextState = combatCriticalBleedControlStateSchema.parse(input.nextState);
  const partialRate = input.partialRate
    ? combatCriticalExactRationalSchema.parse(input.partialRate)
    : undefined;
  const source = combatEffects.effects.find((effect) => effect.id === input.effectId);
  if (!source || source.criticalRuntime?.kind !== "bleed") {
    throw new RangeError("The selected consequence is not an active structured Bleed source.");
  }
  if (source.status === "resolved" || source.status === "expired") {
    throw new RangeError("The selected Bleed source is no longer available for treatment.");
  }
  const previousState = source.criticalRuntime.bleed.controlState;
  if (previousState === nextState) {
    throw new RangeError("Choose a different Bleed lifecycle state.");
  }
  const bleed = transitionCombatCriticalBleedControl({
    bleed: source.criticalRuntime.bleed,
    nextState,
    partialRate,
  });
  const rate = getCombatCriticalBleedEffectiveRate(bleed);
  const treatmentEventId = `${source.id}:treatment:${input.createdAt}`;
  const stateLabel = getCombatCriticalBleedControlStateLabel(nextState);

  return {
    combatEffects: combatEffectsStateSchema.parse({
      ...combatEffects,
      effects: combatEffects.effects.map((effect) =>
        effect.id === source.id
          ? {
              ...effect,
              criticalRuntime: { ...source.criticalRuntime, bleed },
              description: `${bleed.kind === "internal" ? "Internal Bleed" : "Bleed"} ${rate.numerator}/${rate.denominator} HP per round · ${stateLabel}.`,
              updatedAt: input.createdAt,
            }
          : effect,
      ),
      events: [
        ...combatEffects.events,
        combatEffectEventSchema.parse({
          createdAt: input.createdAt,
          createdByUserId: input.createdByUserId,
          description: `${bleed.kind === "internal" ? "Internal Bleed" : "Bleed"} changed from ${getCombatCriticalBleedControlStateLabel(previousState)} to ${stateLabel}.`,
          encounterId: input.encounterId,
          id: treatmentEventId,
          roundNumber: input.roundNumber,
          scenarioId: input.scenarioId,
          sourceLabel: "Critical Bleed treatment",
          sourceType: "healing",
          targetParticipantId: source.targetParticipantId,
        }),
      ],
    }),
    nextState,
    previousState,
    rate,
    treatmentEventId,
  };
}

/**
 * Pending initiative effects are committed facts. They become effective as soon as their
 * creating simultaneous group is no longer current; this derived boundary makes reload and undo
 * deterministic without a second manual activation command.
 */
export function getCombatEffectEffectiveStatus(
  effect: CombatEffect,
  context: CombatEffectInitiativeTimingContext = {},
): CombatEffectStatus {
  if (
    effect.effectiveAfterInitiativeGroupId &&
    context.currentInitiativeGroupId === effect.effectiveAfterInitiativeGroupId
  ) {
    return "pending";
  }
  if (
    effect.status === "pending" &&
    effect.effectiveAfterInitiativeGroupId &&
    context.currentInitiativeGroupId !== effect.effectiveAfterInitiativeGroupId
  ) {
    return "active";
  }
  return effect.status;
}
