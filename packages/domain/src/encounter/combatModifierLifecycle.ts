import { z } from "zod";

import { combatRoundStepSchema } from "./combatRoundManager";

/**
 * Versioned target contract for durable combatEffects. During migration, modifier buckets remain
 * editable compatibility projections; relationship, opportunity, contact, unbalanced, and distance
 * process state remain authoritative in their own bounded models and only project through this
 * contract when a modifier view or calculation needs them.
 */

const idSchema = z.string().min(1);
const revisionSchema = z.string().min(1);
const sequenceSchema = z.number().int().nonnegative();

export const CANONICAL_COMBAT_MODIFIER_LIFECYCLE_SCHEMA_VERSION = 1 as const;

export const canonicalCombatModifierLifecycleStateSchema = z.enum([
  "proposed",
  "provisional",
  "pending_review",
  "pending_activation",
  "active",
  "resolved",
  "consumed",
  "expired",
  "removed",
  "superseded",
  "rejected",
]);
export type CanonicalCombatModifierLifecycleState = z.infer<
  typeof canonicalCombatModifierLifecycleStateSchema
>;

export const canonicalCombatModifierNumericCategorySchema = z.enum([
  "general_fatigue",
  "initiative",
  "skill_ob",
  "db_parry",
  "movement_modifier",
  "damage",
  "bleed_rate",
  "integer_count",
]);
export type CanonicalCombatModifierNumericCategory = z.infer<
  typeof canonicalCombatModifierNumericCategorySchema
>;

export const canonicalCombatModifierUnitSchema = z.enum([
  "percentage",
  "flat_db",
  "initiative_value",
  "damage",
  "bleed_rate",
  "integer_count",
]);
export type CanonicalCombatModifierUnit = z.infer<typeof canonicalCombatModifierUnitSchema>;

export const canonicalCombatModifierContributionScopeSchema = z.enum([
  "calculation",
  "live_value",
  "state",
  "result_only",
]);

export const canonicalCombatModifierRollPurposePolicySchema = z.object({
  excluded: z.array(idSchema).default([]),
  included: z.array(idSchema).default([]),
});

export const canonicalCombatModifierBleedStateSchema = z.object({
  accumulatedTenths: z.number().int().nonnegative().default(0),
  initializedRound: z.number().int().positive().optional(),
  lastHealthCheckRound: z.number().int().positive().optional(),
});

export const canonicalCombatModifierNumericPayloadSchema = z
  .object({
    bleedState: canonicalCombatModifierBleedStateSchema.optional(),
    category: canonicalCombatModifierNumericCategorySchema,
    contributionScope: canonicalCombatModifierContributionScopeSchema,
    kind: z.literal("numeric"),
    rollPurposePolicy: canonicalCombatModifierRollPurposePolicySchema.optional(),
    unit: canonicalCombatModifierUnitSchema,
    value: z.number().finite(),
  })
  .superRefine((payload, context) => {
    if (payload.category === "damage" && payload.unit !== "damage") {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Damage contributions require the damage unit.",
        path: ["unit"],
      });
    }
    if (payload.category === "bleed_rate" && payload.unit !== "bleed_rate") {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Bleed contributions require the bleed-rate unit.",
        path: ["unit"],
      });
    }
    if (payload.category === "movement_modifier" && payload.unit !== "percentage") {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Movement Modifier contributions require the percentage unit.",
        path: ["unit"],
      });
    }
    if (payload.category === "integer_count" && payload.unit !== "integer_count") {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Count contributions require the integer-count unit.",
        path: ["unit"],
      });
    }
  });

export const canonicalCombatRestrictionKindSchema = z.enum([
  "stunned",
  "continued_contact",
  "distance_restriction",
  "loss_of_use",
  "dropped_item",
  "no_combat_action",
  "action_limited",
  "unbalanced",
  "condition",
  "special",
]);
export type CanonicalCombatRestrictionKind = z.infer<typeof canonicalCombatRestrictionKindSchema>;

export const canonicalCombatModifierRestrictionPayloadSchema = z.object({
  conditionReferenceId: idSchema.optional(),
  count: z.number().int().nonnegative().optional(),
  effectKind: canonicalCombatRestrictionKindSchema,
  kind: z.literal("restriction"),
  operationalRestriction: z
    .enum([
      "none",
      "cannot_act",
      "limited_action",
      "cannot_use_body_part",
      "dropped_item",
      "distance_controlled",
      "contact_maintained",
      "disadvantaged",
    ])
    .default("none"),
  severity: z.number().int().nonnegative().optional(),
});

export const canonicalCombatModifierPayloadSchema = z.union([
  canonicalCombatModifierNumericPayloadSchema,
  canonicalCombatModifierRestrictionPayloadSchema,
]);
export type CanonicalCombatModifierPayload = z.infer<typeof canonicalCombatModifierPayloadSchema>;

const durationStartSchema = z.object({
  startPhase: z.enum(["phase1", "phase2"]).optional(),
  startRound: z.number().int().positive(),
  startSequence: sequenceSchema,
});

export const canonicalCombatModifierDurationSchema = z.discriminatedUnion("kind", [
  durationStartSchema.extend({
    expiresAt: z.literal("phase_boundary"),
    kind: z.literal("phase"),
    phase: z.enum(["phase1", "phase2"]),
  }),
  durationStartSchema.extend({
    consumeOn: z.enum(["commitment", "execution", "resolution"]),
    kind: z.literal("attack_opportunity_count"),
    opportunityIds: z.array(idSchema).min(1),
    remaining: z.number().int().positive(),
  }),
  durationStartSchema.extend({
    creationRoundCounts: z.boolean(),
    kind: z.literal("rounds"),
    remaining: z.number().int().positive(),
    transitionBoundary: z.enum(["round_end_review", "round_boundary"]),
  }),
  durationStartSchema.extend({
    check: z.object({
      checkId: idSchema,
      checkKind: z.enum(["health", "recovery", "skill", "stat", "gm_review"]),
      skillOrStatId: idSchema.optional(),
    }),
    kind: z.literal("until_check"),
    resolvesOn: z.enum(["success", "accepted_result"]),
  }),
  durationStartSchema.extend({
    conditionId: idSchema,
    conditionKind: z.enum([
      "effect_cleared",
      "contact_ended",
      "participant_state",
      "source_process_completed",
    ]),
    kind: z.literal("until_condition"),
  }),
  durationStartSchema.extend({
    endsWhen: z.enum(["relationship_ends", "relationship_replaced"]),
    kind: z.literal("relationship"),
    relationshipId: idSchema,
  }),
  durationStartSchema.extend({
    kind: z.literal("manual"),
    removableBy: z.literal("gm"),
  }),
  durationStartSchema.extend({
    kind: z.literal("indefinite"),
  }),
  z.object({
    kind: z.literal("legacy_untyped"),
    rawValue: z.string().min(1).optional(),
    reason: z.enum(["missing_duration", "ambiguous_duration", "unsupported_duration"]),
  }),
]);
export type CanonicalCombatModifierDuration = z.infer<typeof canonicalCombatModifierDurationSchema>;

export const canonicalCombatModifierActivationCutoffSchema = z.discriminatedUnion("kind", [
  z.object({ afterSequence: sequenceSchema, kind: z.literal("sequence") }),
  z.object({ afterInitiativeGroupId: idSchema, kind: z.literal("initiative_group") }),
]);

export const canonicalCombatModifierApplicabilitySchema = z.object({
  actionId: idSchema.optional(),
  activationCutoff: canonicalCombatModifierActivationCutoffSchema.optional(),
  combatWide: z.boolean(),
  encounterId: idSchema.optional(),
  initiativeGroupId: idSchema.optional(),
  opponentParticipantId: idSchema.optional(),
  opportunityId: idSchema.optional(),
  pairKey: idSchema.optional(),
  phase: z.enum(["phase1", "phase2"]).optional(),
  processId: idSchema.optional(),
  rankGroupId: idSchema.optional(),
  rollPurposes: z.array(idSchema).default([]),
  roundNumber: z.number().int().positive().optional(),
  step: combatRoundStepSchema.optional(),
  targetParticipantId: idSchema.optional(),
});
export type CanonicalCombatModifierApplicability = z.infer<
  typeof canonicalCombatModifierApplicabilitySchema
>;

export const canonicalCombatModifierSourceFamilySchema = z.enum([
  "manual",
  "persistent_effect",
  "declaration",
  "attack_opportunity",
  "feint",
  "observe_relationship",
  "offensive_parry",
  "combat_experience",
  "bleed",
  "stunned",
  "continued_contact",
  "unbalanced",
  "damage",
  "health",
  "system",
  "legacy",
]);
export type CanonicalCombatModifierSourceFamily = z.infer<
  typeof canonicalCombatModifierSourceFamilySchema
>;

export const canonicalCombatModifierSourceReferencesSchema = z.object({
  commandId: idSchema.optional(),
  effectId: idSchema.optional(),
  eventId: idSchema.optional(),
  opportunityId: idSchema.optional(),
  processId: idSchema.optional(),
  proposalId: idSchema.optional(),
  relationshipId: idSchema.optional(),
  resultId: idSchema.optional(),
  rowId: idSchema.optional(),
});

export const canonicalCombatModifierVisibilitySchema = z.object({
  audience: z.enum(["public", "owner", "involved", "gm"]),
  sourceIdentity: z.enum(["public", "restricted", "hidden"]),
});

export const canonicalCombatModifierCompletenessSchema = z.enum([
  "complete",
  "partial",
  "legacy_incomplete",
  "unsupported_ambiguity",
]);
export type CanonicalCombatModifierCompleteness = z.infer<
  typeof canonicalCombatModifierCompletenessSchema
>;

export const canonicalCombatModifierMissingFactSchema = z.enum([
  "unit",
  "duration",
  "applicability",
  "lifecycle",
  "source",
  "visibility",
  "creation_revision",
  "creation_sequence",
  "payload",
]);
export type CanonicalCombatModifierMissingFact = z.infer<
  typeof canonicalCombatModifierMissingFactSchema
>;

export const canonicalCombatModifierPrivateDiagnosticSchema = z.object({
  code: idSchema,
  referenceId: idSchema.optional(),
});

export const canonicalCombatModifierLifecycleSchema = z.object({
  duration: canonicalCombatModifierDurationSchema,
  state: canonicalCombatModifierLifecycleStateSchema,
});

export const canonicalCombatModifierLineageSchema = z.object({
  replacedByEffectId: idSchema.optional(),
  replacesEffectId: idSchema.optional(),
  supersedesEffectId: idSchema.optional(),
});

export const canonicalCombatModifierEffectSchema = z
  .object({
    applicability: canonicalCombatModifierApplicabilitySchema,
    createdAt: z.string().datetime(),
    createdRevision: revisionSchema.optional(),
    createdSequence: sequenceSchema.optional(),
    id: idSchema,
    lifecycle: canonicalCombatModifierLifecycleSchema,
    lineage: canonicalCombatModifierLineageSchema.default({}),
    missingFacts: z.array(canonicalCombatModifierMissingFactSchema).default([]),
    ownerParticipantId: idSchema,
    payload: canonicalCombatModifierPayloadSchema,
    privateDiagnostic: canonicalCombatModifierPrivateDiagnosticSchema.optional(),
    provenanceCompleteness: canonicalCombatModifierCompletenessSchema,
    publicLabel: z.string().min(1),
    publicNote: z.string().min(1).optional(),
    schemaVersion: z.literal(CANONICAL_COMBAT_MODIFIER_LIFECYCLE_SCHEMA_VERSION),
    sourceFamily: canonicalCombatModifierSourceFamilySchema,
    sourceReferences: canonicalCombatModifierSourceReferencesSchema.default({}),
    version: z.number().int().positive(),
    visibility: canonicalCombatModifierVisibilitySchema,
  })
  .superRefine((effect, context) => {
    if (effect.provenanceCompleteness === "complete") {
      if (!effect.createdRevision) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Complete canonical effects require a creation revision.",
          path: ["createdRevision"],
        });
      }
      if (effect.createdSequence === undefined) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Complete canonical effects require a creation sequence.",
          path: ["createdSequence"],
        });
      }
    }
    if (effect.lifecycle.state === "pending_activation" && !effect.applicability.activationCutoff) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Pending activation requires an explicit activation cutoff.",
        path: ["applicability", "activationCutoff"],
      });
    }
    if (effect.sourceFamily === "attack_opportunity" && !effect.sourceReferences.opportunityId) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Attack-opportunity effects require opportunity provenance.",
        path: ["sourceReferences", "opportunityId"],
      });
    }
    if (effect.sourceFamily === "observe_relationship" && !effect.sourceReferences.relationshipId) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Observe projections require relationship provenance.",
        path: ["sourceReferences", "relationshipId"],
      });
    }
  });
export type CanonicalCombatModifierEffect = z.infer<typeof canonicalCombatModifierEffectSchema>;

export const canonicalCombatModifierTransitionTypeSchema = z.enum([
  "make_provisional",
  "submit_review",
  "accept",
  "activate",
  "resolve",
  "consume",
  "expire",
  "remove",
  "supersede",
  "reject",
  "restore",
]);
export type CanonicalCombatModifierTransitionType = z.infer<
  typeof canonicalCombatModifierTransitionTypeSchema
>;

export const canonicalCombatModifierTransitionReasonSchema = z.enum([
  "created",
  "review_submitted",
  "review_accepted",
  "review_rejected",
  "activation_cutoff_reached",
  "natural_expiry",
  "opportunity_consumed",
  "check_succeeded",
  "condition_cleared",
  "gm_removed",
  "replaced",
  "source_resolved",
  "undo_restored",
  "legacy_compatibility",
]);

export const canonicalCombatModifierVersionFactSchema = z.object({
  lifecycle: canonicalCombatModifierLifecycleSchema,
  lineage: canonicalCombatModifierLineageSchema,
  version: z.number().int().positive(),
});

export const canonicalCombatModifierLifecycleTransitionSchema = z.object({
  acceptedRevision: revisionSchema,
  acceptedSequence: sequenceSchema,
  commandId: idSchema.optional(),
  effectId: idSchema,
  eventId: idSchema.optional(),
  gmOverride: z
    .object({
      reasonCode: idSchema,
      userId: idSchema.optional(),
    })
    .optional(),
  id: idSchema,
  next: canonicalCombatModifierVersionFactSchema,
  prior: canonicalCombatModifierVersionFactSchema,
  privateDiagnostic: canonicalCombatModifierPrivateDiagnosticSchema.optional(),
  publicNote: z.string().min(1).optional(),
  reason: canonicalCombatModifierTransitionReasonSchema,
  restoresTransitionId: idSchema.optional(),
  transitionType: canonicalCombatModifierTransitionTypeSchema,
});
export type CanonicalCombatModifierLifecycleTransition = z.infer<
  typeof canonicalCombatModifierLifecycleTransitionSchema
>;

const legalNextStates: Readonly<
  Record<CanonicalCombatModifierLifecycleState, readonly CanonicalCombatModifierLifecycleState[]>
> = {
  proposed: [
    "provisional",
    "pending_review",
    "pending_activation",
    "active",
    "rejected",
    "removed",
  ],
  provisional: ["pending_review", "pending_activation", "active", "rejected", "removed"],
  pending_review: ["pending_activation", "active", "rejected", "removed"],
  pending_activation: ["active", "expired", "removed", "superseded"],
  active: ["resolved", "consumed", "expired", "removed", "superseded"],
  resolved: [],
  consumed: [],
  expired: [],
  removed: [],
  superseded: [],
  rejected: [],
};

const transitionTargetStates: Readonly<
  Partial<
    Record<CanonicalCombatModifierTransitionType, readonly CanonicalCombatModifierLifecycleState[]>
  >
> = {
  make_provisional: ["provisional"],
  submit_review: ["pending_review"],
  accept: ["pending_activation", "active"],
  activate: ["active"],
  resolve: ["resolved"],
  consume: ["consumed"],
  expire: ["expired"],
  remove: ["removed"],
  supersede: ["superseded"],
  reject: ["rejected"],
};

export function isCanonicalCombatModifierTransitionAllowed(input: {
  from: CanonicalCombatModifierLifecycleState;
  to: CanonicalCombatModifierLifecycleState;
  transitionType: CanonicalCombatModifierTransitionType;
}): boolean {
  if (input.transitionType === "restore") return true;
  return (
    legalNextStates[input.from].includes(input.to) &&
    (transitionTargetStates[input.transitionType]?.includes(input.to) ?? false)
  );
}

function versionFact(effect: CanonicalCombatModifierEffect) {
  return canonicalCombatModifierVersionFactSchema.parse({
    lifecycle: effect.lifecycle,
    lineage: effect.lineage,
    version: effect.version,
  });
}

export function transitionCanonicalCombatModifierEffect(input: {
  acceptedRevision: string;
  acceptedSequence: number;
  commandId?: string;
  effect: CanonicalCombatModifierEffect;
  eventId?: string;
  gmOverride?: { reasonCode: string; userId?: string };
  nextDuration?: CanonicalCombatModifierDuration;
  nextState: CanonicalCombatModifierLifecycleState;
  privateDiagnostic?: { code: string; referenceId?: string };
  publicNote?: string;
  reason: z.infer<typeof canonicalCombatModifierTransitionReasonSchema>;
  replacementEffectId?: string;
  transitionId: string;
  transitionType: Exclude<CanonicalCombatModifierTransitionType, "restore">;
}): {
  effect: CanonicalCombatModifierEffect;
  transition: CanonicalCombatModifierLifecycleTransition;
} {
  const effect = canonicalCombatModifierEffectSchema.parse(input.effect);
  if (
    !isCanonicalCombatModifierTransitionAllowed({
      from: effect.lifecycle.state,
      to: input.nextState,
      transitionType: input.transitionType,
    })
  ) {
    throw new RangeError(
      `Illegal combat modifier lifecycle transition: ${effect.lifecycle.state} -> ${input.nextState} (${input.transitionType}).`,
    );
  }
  if (input.nextState === "superseded" && !input.replacementEffectId) {
    throw new RangeError("Superseding a combat modifier requires the replacement effect id.");
  }

  const nextEffect = canonicalCombatModifierEffectSchema.parse({
    ...effect,
    lifecycle: {
      duration: input.nextDuration ?? effect.lifecycle.duration,
      state: input.nextState,
    },
    lineage: {
      ...effect.lineage,
      ...(input.replacementEffectId ? { replacedByEffectId: input.replacementEffectId } : {}),
    },
    version: effect.version + 1,
  });
  const transition = canonicalCombatModifierLifecycleTransitionSchema.parse({
    acceptedRevision: input.acceptedRevision,
    acceptedSequence: input.acceptedSequence,
    commandId: input.commandId,
    effectId: effect.id,
    eventId: input.eventId,
    gmOverride: input.gmOverride,
    id: input.transitionId,
    next: versionFact(nextEffect),
    prior: versionFact(effect),
    privateDiagnostic: input.privateDiagnostic,
    publicNote: input.publicNote,
    reason: input.reason,
    transitionType: input.transitionType,
  });

  return { effect: nextEffect, transition };
}

export function restoreCanonicalCombatModifierEffectFromTransition(input: {
  acceptedRevision: string;
  acceptedSequence: number;
  commandId?: string;
  effect: CanonicalCombatModifierEffect;
  transition: CanonicalCombatModifierLifecycleTransition;
  transitionId: string;
}): {
  effect: CanonicalCombatModifierEffect;
  transition: CanonicalCombatModifierLifecycleTransition;
} {
  const effect = canonicalCombatModifierEffectSchema.parse(input.effect);
  const sourceTransition = canonicalCombatModifierLifecycleTransitionSchema.parse(input.transition);
  if (
    sourceTransition.effectId !== effect.id ||
    sourceTransition.next.version !== effect.version ||
    sourceTransition.next.lifecycle.state !== effect.lifecycle.state
  ) {
    throw new RangeError("Combat modifier undo does not match the current effect version.");
  }

  const restoredEffect = canonicalCombatModifierEffectSchema.parse({
    ...effect,
    lifecycle: sourceTransition.prior.lifecycle,
    lineage: sourceTransition.prior.lineage,
    version: effect.version + 1,
  });
  const restoreTransition = canonicalCombatModifierLifecycleTransitionSchema.parse({
    acceptedRevision: input.acceptedRevision,
    acceptedSequence: input.acceptedSequence,
    commandId: input.commandId,
    effectId: effect.id,
    id: input.transitionId,
    next: versionFact(restoredEffect),
    prior: versionFact(effect),
    reason: "undo_restored",
    restoresTransitionId: sourceTransition.id,
    transitionType: "restore",
  });

  return { effect: restoredEffect, transition: restoreTransition };
}

export interface CanonicalCombatModifierResolutionContext {
  acceptedSequence?: number;
  actionId?: string;
  encounterId?: string;
  initiativeGroupId?: string;
  opponentParticipantId?: string;
  opportunityId?: string;
  ownerParticipantId: string;
  pairKey?: string;
  phase?: "phase1" | "phase2";
  processId?: string;
  rankGroupId?: string;
  rollPurpose?: string;
  roundNumber?: number;
  step?: z.infer<typeof combatRoundStepSchema>;
  targetParticipantId?: string;
}

export interface CanonicalCombatModifierSelection {
  active: boolean;
  conditionallyApplicable: boolean;
  discoverable: boolean;
  selectedForCalculation: boolean;
}

export function selectCanonicalCombatModifierEffect(input: {
  context: CanonicalCombatModifierResolutionContext;
  effect: CanonicalCombatModifierEffect;
}): CanonicalCombatModifierSelection {
  const effect = canonicalCombatModifierEffectSchema.parse(input.effect);
  const applicability = effect.applicability;
  const context = input.context;
  const active = effect.lifecycle.state === "active";
  const conditionallyApplicable = Boolean(
    applicability.opponentParticipantId ||
    applicability.targetParticipantId ||
    applicability.pairKey ||
    applicability.rollPurposes.length ||
    applicability.actionId ||
    applicability.processId ||
    applicability.opportunityId,
  );
  const cutoffSatisfied = !applicability.activationCutoff
    ? true
    : applicability.activationCutoff.kind === "sequence"
      ? context.acceptedSequence !== undefined &&
        context.acceptedSequence > applicability.activationCutoff.afterSequence
      : context.initiativeGroupId !== undefined &&
        context.initiativeGroupId !== applicability.activationCutoff.afterInitiativeGroupId;
  const matches =
    context.ownerParticipantId === effect.ownerParticipantId &&
    (!applicability.encounterId || context.encounterId === applicability.encounterId) &&
    (!applicability.roundNumber || context.roundNumber === applicability.roundNumber) &&
    (!applicability.step || context.step === applicability.step) &&
    (!applicability.phase || context.phase === applicability.phase) &&
    (!applicability.initiativeGroupId ||
      context.initiativeGroupId === applicability.initiativeGroupId) &&
    (!applicability.rankGroupId || context.rankGroupId === applicability.rankGroupId) &&
    (!applicability.actionId || context.actionId === applicability.actionId) &&
    (!applicability.processId || context.processId === applicability.processId) &&
    (!applicability.opportunityId || context.opportunityId === applicability.opportunityId) &&
    (!applicability.opponentParticipantId ||
      context.opponentParticipantId === applicability.opponentParticipantId) &&
    (!applicability.targetParticipantId ||
      context.targetParticipantId === applicability.targetParticipantId) &&
    (!applicability.pairKey || context.pairKey === applicability.pairKey) &&
    (applicability.rollPurposes.length === 0 ||
      (context.rollPurpose !== undefined &&
        applicability.rollPurposes.includes(context.rollPurpose))) &&
    cutoffSatisfied;

  return {
    active,
    conditionallyApplicable,
    discoverable: !["rejected", "removed"].includes(effect.lifecycle.state),
    selectedForCalculation: active && effect.payload.kind === "numeric" && matches,
  };
}

export const canonicalCombatModifierHistoricalSnapshotSchema = z.object({
  acceptedRevision: revisionSchema,
  cutoffSequence: sequenceSchema,
  effects: z.array(canonicalCombatModifierEffectSchema),
  encounterId: idSchema,
  ownerParticipantId: idSchema,
  roundNumber: z.number().int().positive(),
  schemaVersion: z.literal(CANONICAL_COMBAT_MODIFIER_LIFECYCLE_SCHEMA_VERSION),
});
export type CanonicalCombatModifierHistoricalSnapshot = z.infer<
  typeof canonicalCombatModifierHistoricalSnapshotSchema
>;

export const playerSafeCanonicalCombatModifierEffectSchema = z.object({
  applicability: canonicalCombatModifierApplicabilitySchema.omit({
    actionId: true,
    activationCutoff: true,
    opportunityId: true,
    processId: true,
  }),
  id: idSchema,
  lifecycle: canonicalCombatModifierLifecycleSchema,
  ownerParticipantId: idSchema,
  payload: canonicalCombatModifierPayloadSchema,
  provenanceCompleteness: canonicalCombatModifierCompletenessSchema,
  publicLabel: z.string().min(1),
  publicNote: z.string().min(1).optional(),
  schemaVersion: z.literal(CANONICAL_COMBAT_MODIFIER_LIFECYCLE_SCHEMA_VERSION),
  sourceFamily: canonicalCombatModifierSourceFamilySchema,
});
export type PlayerSafeCanonicalCombatModifierEffect = z.infer<
  typeof playerSafeCanonicalCombatModifierEffectSchema
>;

export const playerSafeCanonicalCombatModifierHistoricalSnapshotSchema = z.object({
  acceptedRevision: revisionSchema,
  cutoffSequence: sequenceSchema,
  effects: z.array(playerSafeCanonicalCombatModifierEffectSchema),
  encounterId: idSchema,
  ownerParticipantId: idSchema,
  roundNumber: z.number().int().positive(),
  schemaVersion: z.literal(CANONICAL_COMBAT_MODIFIER_LIFECYCLE_SCHEMA_VERSION),
});
export type PlayerSafeCanonicalCombatModifierHistoricalSnapshot = z.infer<
  typeof playerSafeCanonicalCombatModifierHistoricalSnapshotSchema
>;

export interface CanonicalCombatModifierViewer {
  controlledParticipantIds: ReadonlySet<string>;
  isGm: boolean;
  visibleParticipantIds: ReadonlySet<string>;
}

export function projectPlayerSafeCanonicalCombatModifierEffect(input: {
  effect: CanonicalCombatModifierEffect;
  viewer: CanonicalCombatModifierViewer;
}): PlayerSafeCanonicalCombatModifierEffect | undefined {
  const effect = canonicalCombatModifierEffectSchema.parse(input.effect);
  const audience = effect.visibility.audience;
  const visible =
    input.viewer.isGm ||
    audience === "public" ||
    (audience === "owner" &&
      input.viewer.controlledParticipantIds.has(effect.ownerParticipantId)) ||
    (audience === "involved" &&
      (input.viewer.controlledParticipantIds.has(effect.ownerParticipantId) ||
        (effect.applicability.targetParticipantId !== undefined &&
          input.viewer.controlledParticipantIds.has(effect.applicability.targetParticipantId))));
  if (!visible) return undefined;

  const opponentVisible =
    !effect.applicability.opponentParticipantId ||
    input.viewer.visibleParticipantIds.has(effect.applicability.opponentParticipantId);
  const targetVisible =
    !effect.applicability.targetParticipantId ||
    input.viewer.visibleParticipantIds.has(effect.applicability.targetParticipantId);

  return playerSafeCanonicalCombatModifierEffectSchema.parse({
    applicability: {
      combatWide: effect.applicability.combatWide,
      encounterId: effect.applicability.encounterId,
      initiativeGroupId: effect.applicability.initiativeGroupId,
      opponentParticipantId: opponentVisible
        ? effect.applicability.opponentParticipantId
        : undefined,
      pairKey: opponentVisible && targetVisible ? effect.applicability.pairKey : undefined,
      phase: effect.applicability.phase,
      rankGroupId: effect.applicability.rankGroupId,
      rollPurposes: effect.applicability.rollPurposes,
      roundNumber: effect.applicability.roundNumber,
      step: effect.applicability.step,
      targetParticipantId: targetVisible ? effect.applicability.targetParticipantId : undefined,
    },
    id: effect.id,
    lifecycle: effect.lifecycle,
    ownerParticipantId: effect.ownerParticipantId,
    payload: effect.payload,
    provenanceCompleteness: effect.provenanceCompleteness,
    publicLabel: effect.publicLabel,
    publicNote: effect.publicNote,
    schemaVersion: effect.schemaVersion,
    sourceFamily: effect.sourceFamily,
  });
}

export function projectPlayerSafeCanonicalCombatModifierSnapshot(input: {
  snapshot: CanonicalCombatModifierHistoricalSnapshot;
  viewer: CanonicalCombatModifierViewer;
}): PlayerSafeCanonicalCombatModifierHistoricalSnapshot {
  const snapshot = canonicalCombatModifierHistoricalSnapshotSchema.parse(input.snapshot);
  return playerSafeCanonicalCombatModifierHistoricalSnapshotSchema.parse({
    ...snapshot,
    effects: snapshot.effects.flatMap((effect) => {
      const projected = projectPlayerSafeCanonicalCombatModifierEffect({
        effect,
        viewer: input.viewer,
      });
      return projected ? [projected] : [];
    }),
  });
}
