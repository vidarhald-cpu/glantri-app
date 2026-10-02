import { z } from "zod";

import { combatRoundStepSchema } from "./combatRoundStep";

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

// Combat modifiers use percentage application unless an authoritative source explicitly defines
// direct points. `flat_db` remains for those bounded exceptions and exact legacy replay only.
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

/**
 * The canonical persisted vocabulary of duration units. This is the single canonical home for the
 * meaning of each member; other layers — including the persisted Critical runtime duration in
 * `combatCriticalRuntime.ts` and its hand-maintained fixture twin — reference this vocabulary
 * rather than restating the members.
 *
 * - `round` — measured in Combat rounds. The round clock owns expiry, through
 *   `evaluateCanonicalCombatModifierDurationAtRoundEnd`.
 * - `hour` — measured in elapsed hours. The app has no hour clock and this vocabulary does not add
 *   one: an hour-measured quantity is a faithfully stored and displayed fact whose expiry is
 *   executed by the GM. A round boundary must never consume it, which is why the round-measured
 *   `rounds` duration below narrows its rolled evidence to `round`.
 */
export const canonicalCombatModifierDurationUnitSchema = z.enum(["round", "hour"]);
export type CanonicalCombatModifierDurationUnit = z.infer<
  typeof canonicalCombatModifierDurationUnitSchema
>;

/**
 * The rolled quantity itself: a formula, the value it produced, and the unit that value is measured
 * in. It is separated from the round-anchored duration below so that layers which record a rolled
 * quantity without a round anchor — the inert Critical case carrier in `criticalInjuryDomain.ts` —
 * reference this shape instead of re-declaring `formula`/`value`/`unit`.
 *
 * `unit` is additive and deliberately carries no `.default()`. A fact written before the unit
 * existed omits it, still parses, and still means exactly what it meant then: rounds. A
 * `.default()` would materialise `"round"` on read, making a pre-widening fact indistinguishable
 * from one written after it. `getCanonicalCombatModifierRolledDurationUnit` is the one place that
 * absent-means-round interpretation is stated.
 */
export const canonicalCombatModifierRolledQuantitySchema = z.object({
  formula: z.string().min(1),
  unit: canonicalCombatModifierDurationUnitSchema.optional(),
  value: z.number().int().positive(),
});
export type CanonicalCombatModifierRolledQuantity = z.infer<
  typeof canonicalCombatModifierRolledQuantitySchema
>;

/**
 * A bounded uncertain duration is rolled once at creation and retained as reviewable evidence. It
 * then behaves exactly like a fixed duration of the rolled length: no later boundary rerolls it.
 */
export const canonicalCombatModifierRolledDurationSchema =
  canonicalCombatModifierRolledQuantitySchema.extend({
    rolledAtRound: z.number().int().positive(),
  });
export type CanonicalCombatModifierRolledDuration = z.infer<
  typeof canonicalCombatModifierRolledDurationSchema
>;

/**
 * The unit a rolled quantity is measured in, for a fact that may predate the unit field. Absent is
 * exactly the pre-widening meaning: rounds.
 */
export function getCanonicalCombatModifierRolledDurationUnit(
  rolled: CanonicalCombatModifierRolledQuantity,
): CanonicalCombatModifierDurationUnit {
  return rolled.unit ?? "round";
}

/**
 * The canonical persisted vocabulary of condition/event terminations. An `until_condition`
 * duration ends only when its named condition/event transition occurs; no round boundary may
 * invent a recovery roll for one.
 *
 * This is the single canonical home for the meaning of each member. Other layers — including the
 * unpersisted Critical operational-effect carrier in `criticalInjuryDomain.ts` and the Critical
 * runtime duration in `combatCriticalRuntime.ts` — reference this vocabulary rather than
 * maintaining a second encoding of the same distinctions.
 *
 * - `effect_cleared` — ends when the referenced effect is cleared.
 * - `contact_ended` — ends when the referenced contact/process relationship ends.
 * - `participant_state` — ends when the referenced participant state changes.
 * - `source_process_completed` — ends when the originating process completes.
 * - `treated` — ends when treatment of the originating injury is declared. The accepted Critical
 *   source names this event explicitly (`end_trigger: treated`); it carries no DC and no app-side
 *   check, so the declaration remains GM-owned and no recovery roll is manufactured for it.
 *
 * Added members are additive: a persisted row written before a widening still parses, and still
 * carries exactly the member it was written with. No reader branches on `conditionKind`, so a
 * widening does not reinterpret any pre-existing row.
 */
export const canonicalCombatModifierConditionKindSchema = z.enum([
  "effect_cleared",
  "contact_ended",
  "participant_state",
  "source_process_completed",
  "treated",
]);
export type CanonicalCombatModifierConditionKind = z.infer<
  typeof canonicalCombatModifierConditionKindSchema
>;

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
    // `false` is the canonical rule: creation alone does not consume a full round, so the creation
    // round's own Round End does not decrement. `true` preserves legacy/phase-scoped rows that
    // deliberately count their creation round.
    creationRoundCounts: z.boolean(),
    kind: z.literal("rounds"),
    remaining: z.number().int().positive(),
    // This duration is measured in rounds and `remaining` is consumed by the round boundary, so its
    // rolled evidence is narrowed to the round-measured member of the canonical unit vocabulary.
    // That is a narrowing of one vocabulary at one site, not a second vocabulary: an hour-measured
    // quantity is simply unrepresentable here, so no boundary can consume hours as rounds and the
    // widening needs no clock to stay correct. Pre-widening rows omit `unit` entirely and are
    // unaffected.
    rolled: canonicalCombatModifierRolledDurationSchema
      .extend({ unit: z.literal("round").optional() })
      .optional(),
    transitionBoundary: z.enum(["round_end_review", "round_boundary"]),
  }),
  // Remainder-only state runs from creation through that same round's Round End and is absent when
  // the next round begins. It is deliberately NOT encoded as `rounds` with `remaining: 1`.
  durationStartSchema.extend({
    kind: z.literal("remainder_of_round"),
  }),
  // Instantaneous outcomes resolve where they are created and must never persist across a
  // boundary. The shape exists so a source can state "instantaneous" instead of borrowing a
  // one-round duration that would survive a Round End.
  durationStartSchema.extend({
    kind: z.literal("instantaneous"),
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
    conditionKind: canonicalCombatModifierConditionKindSchema,
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

/**
 * The canonical temporal vocabulary for Combat effects and recovery. Every duration shape above
 * belongs to exactly one class, so effects, critical outcomes, Combat Experience and Combat Tasks
 * all describe time in the same terms:
 *
 * - `fixed` — deterministic expiry after N full subsequent rounds. The creation round is the
 *   remainder of a round, not one of the N.
 * - `bounded_uncertain` — rolled once at creation, retained as evidence, then exactly `fixed`.
 * - `scheduled` — a named check becomes due at a boundary. Becoming due is not expiry.
 * - `condition_event` — state persists until its explicit condition/event transition. No boundary
 *   may invent a recovery roll for it.
 * - `remainder_only` — from creation through that round's Round End, and no further.
 * - `instantaneous` — resolves at creation and never persists across a boundary.
 * - `other` — shapes whose lifetime is not driven by the round clock at all (phase scope,
 *   attack-opportunity counts, relationships, manual/indefinite state, untyped legacy rows).
 */
export const canonicalCombatModifierTemporalClassSchema = z.enum([
  "fixed",
  "bounded_uncertain",
  "scheduled",
  "condition_event",
  "remainder_only",
  "instantaneous",
  "other",
]);
export type CanonicalCombatModifierTemporalClass = z.infer<
  typeof canonicalCombatModifierTemporalClassSchema
>;

export function classifyCanonicalCombatModifierDuration(
  duration: CanonicalCombatModifierDuration,
): CanonicalCombatModifierTemporalClass {
  switch (duration.kind) {
    case "rounds":
      return duration.rolled ? "bounded_uncertain" : "fixed";
    case "remainder_of_round":
      return "remainder_only";
    case "instantaneous":
      return "instantaneous";
    case "until_check":
      return "scheduled";
    case "until_condition":
      return "condition_event";
    default:
      return "other";
  }
}

/**
 * The single decision a round boundary may make about a canonical duration.
 *
 * `hold` is the `creationRoundCounts` correction: the creation round's own Round End must not
 * consume a round of a duration that is measured in full subsequent rounds.
 */
export type CanonicalCombatModifierBoundaryOutcome =
  | { kind: "hold"; reason: "creation_round_excluded" }
  | { kind: "decrement"; nextDuration: CanonicalCombatModifierDuration }
  | { kind: "expire"; reason: "natural_expiry" | "remainder_of_round_ended" | "never_persists" }
  | {
      kind: "requires_resolution";
      requirement: "recovery_check" | "condition" | "legacy_incomplete";
    }
  | { kind: "not_time_driven" };

/**
 * The one shared transition engine for the canonical temporal vocabulary. Every consumer that
 * advances effects at a Round End must route through this function rather than re-deriving
 * duration semantics locally; that is what keeps fixed, bounded uncertain, scheduled,
 * condition/event, remainder-only and instantaneous outcomes on a single rule.
 *
 * Applicability (phase scope, source family) is deliberately NOT considered here — it is a
 * separate concern owned by the caller.
 */
export function evaluateCanonicalCombatModifierDurationAtRoundEnd(input: {
  duration: CanonicalCombatModifierDuration;
  roundNumber: number;
}): CanonicalCombatModifierBoundaryOutcome {
  const duration = input.duration;
  switch (duration.kind) {
    case "rounds": {
      if (!duration.creationRoundCounts && input.roundNumber <= duration.startRound) {
        return { kind: "hold", reason: "creation_round_excluded" };
      }
      return duration.remaining > 1
        ? { kind: "decrement", nextDuration: { ...duration, remaining: duration.remaining - 1 } }
        : { kind: "expire", reason: "natural_expiry" };
    }
    case "remainder_of_round":
      return input.roundNumber >= duration.startRound
        ? { kind: "expire", reason: "remainder_of_round_ended" }
        : { kind: "hold", reason: "creation_round_excluded" };
    // An instantaneous outcome must not survive a boundary. Terminating it here carries no new
    // persisted transition reason: `natural_expiry` is exactly its declared lifecycle end.
    case "instantaneous":
      return { kind: "expire", reason: "never_persists" };
    case "until_check":
      return { kind: "requires_resolution", requirement: "recovery_check" };
    case "until_condition":
      return { kind: "requires_resolution", requirement: "condition" };
    case "legacy_untyped":
      return { kind: "requires_resolution", requirement: "legacy_incomplete" };
    default:
      return { kind: "not_time_driven" };
  }
}

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
  "update",
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
  "duration_decremented",
  "bleed_state_updated",
  "gm_removed",
  "replaced",
  "source_resolved",
  "undo_restored",
  "legacy_compatibility",
]);
export type CanonicalCombatModifierTransitionReason = z.infer<
  typeof canonicalCombatModifierTransitionReasonSchema
>;

export const canonicalCombatModifierVersionFactSchema = z.object({
  applicability: canonicalCombatModifierApplicabilitySchema,
  lifecycle: canonicalCombatModifierLifecycleSchema,
  lineage: canonicalCombatModifierLineageSchema,
  payload: canonicalCombatModifierPayloadSchema,
  publicLabel: z.string().min(1),
  publicNote: z.string().min(1).optional(),
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
  update: ["active", "pending_activation", "pending_review"],
};

export function isCanonicalCombatModifierTransitionAllowed(input: {
  from: CanonicalCombatModifierLifecycleState;
  to: CanonicalCombatModifierLifecycleState;
  transitionType: CanonicalCombatModifierTransitionType;
}): boolean {
  if (input.transitionType === "restore") return true;
  if (input.transitionType === "update") {
    return input.from === input.to && transitionTargetStates.update?.includes(input.to) === true;
  }
  return (
    legalNextStates[input.from].includes(input.to) &&
    (transitionTargetStates[input.transitionType]?.includes(input.to) ?? false)
  );
}

function versionFact(effect: CanonicalCombatModifierEffect) {
  return canonicalCombatModifierVersionFactSchema.parse({
    applicability: effect.applicability,
    lifecycle: effect.lifecycle,
    lineage: effect.lineage,
    payload: effect.payload,
    publicLabel: effect.publicLabel,
    publicNote: effect.publicNote,
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
  nextApplicability?: CanonicalCombatModifierApplicability;
  nextPayload?: CanonicalCombatModifierPayload;
  nextPublicLabel?: string;
  nextPublicNote?: string;
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
    applicability: input.nextApplicability ?? effect.applicability,
    lifecycle: {
      duration: input.nextDuration ?? effect.lifecycle.duration,
      state: input.nextState,
    },
    lineage: {
      ...effect.lineage,
      ...(input.replacementEffectId ? { replacedByEffectId: input.replacementEffectId } : {}),
    },
    payload: input.nextPayload ?? effect.payload,
    publicLabel: input.nextPublicLabel ?? effect.publicLabel,
    publicNote: input.nextPublicNote ?? effect.publicNote,
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
    applicability: sourceTransition.prior.applicability,
    lifecycle: sourceTransition.prior.lifecycle,
    lineage: sourceTransition.prior.lineage,
    payload: sourceTransition.prior.payload,
    publicLabel: sourceTransition.prior.publicLabel,
    publicNote: sourceTransition.prior.publicNote,
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
