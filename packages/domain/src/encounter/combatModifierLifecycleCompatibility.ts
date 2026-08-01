import type { ScenarioCombatModifierEntry } from "../campaign/scenario";
import type {
  CombatAttackPhaseDefensivePenalty,
  CombatAttackPhasePenaltyCommitment,
} from "./combatAttackPhasePenalty";
import type { CombatEffect, CombatEffectEvent } from "./combatEffects";
import {
  CANONICAL_COMBAT_MODIFIER_LIFECYCLE_SCHEMA_VERSION,
  canonicalCombatModifierEffectSchema,
  type CanonicalCombatModifierCompleteness,
  type CanonicalCombatModifierDuration,
  type CanonicalCombatModifierEffect,
  type CanonicalCombatModifierLifecycleState,
  type CanonicalCombatModifierMissingFact,
  type CanonicalCombatModifierPayload,
  type CanonicalCombatModifierSourceFamily,
  type CanonicalCombatModifierUnit,
} from "./combatModifierLifecycle";
import type { CombatObservationRelationship } from "./combatObservation";

export type LegacyCombatModifierBucket =
  | "general"
  | "situation_initiative"
  | "situation_ob_skill"
  | "situation_db";

export type CanonicalCombatModifierCompatibilityAuthority =
  | "combat_effect"
  | "modifier_bucket"
  | "attack_opportunity"
  | "observe_relationship"
  | "process_state";

export interface CanonicalCombatModifierCompatibilityResult {
  authority: CanonicalCombatModifierCompatibilityAuthority;
  classification: CanonicalCombatModifierCompleteness;
  effect?: CanonicalCombatModifierEffect;
  legacyFacts?: {
    rawDuration?: string;
    rawValue?: number;
  };
  missingFacts: CanonicalCombatModifierMissingFact[];
}

export interface CanonicalCombatModifierCompatibilityContext {
  createdAt: string;
  createdRevision?: string;
  createdSequence?: number;
  encounterId?: string;
  explicitDuration?: CanonicalCombatModifierDuration;
  explicitRestriction?: {
    effectKind:
      | "continued_contact"
      | "distance_restriction"
      | "loss_of_use"
      | "dropped_item"
      | "no_combat_action"
      | "action_limited"
      | "unbalanced"
      | "condition"
      | "special";
    operationalRestriction:
      | "none"
      | "cannot_act"
      | "limited_action"
      | "cannot_use_body_part"
      | "dropped_item"
      | "distance_controlled"
      | "contact_maintained"
      | "disadvantaged";
  };
  explicitUnit?: CanonicalCombatModifierUnit;
  visibility?: {
    audience: "public" | "owner" | "involved" | "gm";
    sourceIdentity: "public" | "restricted" | "hidden";
  };
}

const defaultVisibility = {
  audience: "gm" as const,
  sourceIdentity: "restricted" as const,
};

function uniqueMissingFacts(
  facts: readonly CanonicalCombatModifierMissingFact[],
): CanonicalCombatModifierMissingFact[] {
  return [...new Set(facts)];
}

function completenessFor(input: {
  ambiguity?: boolean;
  legacy?: boolean;
  missingFacts: readonly CanonicalCombatModifierMissingFact[];
}): CanonicalCombatModifierCompleteness {
  if (input.ambiguity) return "unsupported_ambiguity";
  if (input.legacy) return "legacy_incomplete";
  return input.missingFacts.length === 0 ? "complete" : "partial";
}

function creationMissingFacts(
  context: CanonicalCombatModifierCompatibilityContext,
): CanonicalCombatModifierMissingFact[] {
  return [
    ...(context.createdRevision ? [] : (["creation_revision"] as const)),
    ...(context.createdSequence === undefined ? (["creation_sequence"] as const) : []),
  ];
}

function compatibilityDuration(input: {
  context: CanonicalCombatModifierCompatibilityContext;
  rawDuration?: string;
}): {
  duration: CanonicalCombatModifierDuration;
  missingFacts: CanonicalCombatModifierMissingFact[];
} {
  if (input.context.explicitDuration) {
    return { duration: input.context.explicitDuration, missingFacts: [] };
  }
  return {
    duration: {
      kind: "legacy_untyped",
      rawValue: input.rawDuration,
      reason: input.rawDuration ? "ambiguous_duration" : "missing_duration",
    },
    missingFacts: ["duration"],
  };
}

function eventForEffect(
  effect: CombatEffect,
  events: readonly CombatEffectEvent[],
): CombatEffectEvent | undefined {
  return events.find((event) => event.id === effect.sourceEventId);
}

function lifecycleStateForEffect(effect: CombatEffect): {
  missingFacts: CanonicalCombatModifierMissingFact[];
  state: CanonicalCombatModifierLifecycleState;
} {
  if (effect.status === "pending") {
    return effect.effectiveAfterInitiativeGroupId
      ? { missingFacts: [], state: "pending_activation" }
      : { missingFacts: ["lifecycle"], state: "pending_review" };
  }
  return { missingFacts: [], state: effect.status };
}

function sourceFamilyForEffect(
  effect: CombatEffect,
  event: CombatEffectEvent | undefined,
): CanonicalCombatModifierSourceFamily {
  if (effect.type === "bleed" || effect.type === "internal_bleed") return "bleed";
  if (effect.type === "stun") return "stunned";
  if (effect.type === "physical_damage" || effect.type === "general_damage") return "damage";
  if (event?.sourceLabel === "Combat Experience") return "combat_experience";
  if (event?.sourceType === "manual") return "manual";
  return "persistent_effect";
}

function restrictionPayloadForEffect(input: {
  context: CanonicalCombatModifierCompatibilityContext;
  effect: CombatEffect;
}): CanonicalCombatModifierPayload | undefined {
  const effect = input.effect;
  if (effect.type === "stun") {
    return {
      effectKind: "stunned",
      kind: "restriction",
      operationalRestriction: "limited_action",
    };
  }
  if (effect.type === "special" && input.context.explicitRestriction) {
    return { ...input.context.explicitRestriction, kind: "restriction" };
  }
  return undefined;
}

function categoryForEffect(effect: CombatEffect) {
  if (effect.type === "bleed" || effect.type === "internal_bleed") return "bleed_rate" as const;
  if (effect.type === "physical_damage" || effect.type === "general_damage")
    return "damage" as const;
  if (effect.combatModifierBucket === "initiative") return "initiative" as const;
  if (effect.combatModifierBucket === "skill_ob") return "skill_ob" as const;
  if (effect.combatModifierBucket === "db_parry") return "db_parry" as const;
  if (effect.combatModifierBucket === "general") return "general_fatigue" as const;
  return undefined;
}

function numericValueForEffect(effect: CombatEffect): number | undefined {
  if (effect.type === "bleed" || effect.type === "internal_bleed") {
    return effect.modifierValue;
  }
  if (effect.type === "physical_damage") return effect.damage;
  if (effect.type === "general_damage") return effect.generalDamage;
  return effect.modifierValue ?? effect.initiativeValue;
}

function canonicalUnitForEffect(
  effect: CombatEffect,
  explicitUnit: CanonicalCombatModifierUnit | undefined,
): CanonicalCombatModifierUnit | undefined {
  if (explicitUnit) return explicitUnit;
  if (effect.type === "bleed" || effect.type === "internal_bleed") return "bleed_rate";
  if (effect.type === "physical_damage" || effect.type === "general_damage") return "damage";
  if (effect.combatModifierBucket === "initiative" && effect.initiativeValue !== undefined) {
    return "initiative_value";
  }
  return undefined;
}

/**
 * Compatibility view over durable combatEffects. Unknown application and duration semantics remain
 * incomplete; this adapter never upgrades free-text legacy data into canonical facts by guessing.
 */
export function adaptCombatEffectToCanonicalModifierLifecycle(input: {
  context: CanonicalCombatModifierCompatibilityContext;
  effect: CombatEffect;
  events?: readonly CombatEffectEvent[];
}): CanonicalCombatModifierCompatibilityResult {
  const event = eventForEffect(input.effect, input.events ?? []);
  const restrictionPayload = restrictionPayloadForEffect({
    context: input.context,
    effect: input.effect,
  });
  const category = categoryForEffect(input.effect);
  const unit = canonicalUnitForEffect(input.effect, input.context.explicitUnit);
  const value = numericValueForEffect(input.effect);
  const payload =
    restrictionPayload ??
    (category && unit !== undefined && value !== undefined
      ? ({
          bleedState: input.effect.bleedState,
          category,
          contributionScope:
            category === "damage" || category === "bleed_rate" ? "state" : "calculation",
          kind: "numeric",
          rollPurposePolicy: input.effect.excludedRollPurposes
            ? { excluded: input.effect.excludedRollPurposes, included: [] }
            : undefined,
          unit,
          value,
        } satisfies CanonicalCombatModifierPayload)
      : undefined);
  const duration = compatibilityDuration({
    context: input.context,
    rawDuration: input.effect.duration,
  });
  const lifecycle = lifecycleStateForEffect(input.effect);
  const missingFacts = uniqueMissingFacts([
    ...creationMissingFacts(input.context),
    ...duration.missingFacts,
    ...lifecycle.missingFacts,
    ...(payload ? [] : ([unit ? "payload" : "unit"] as const)),
    ...(event ? [] : (["source"] as const)),
  ]);
  if (!payload) {
    return {
      authority: "combat_effect",
      classification: completenessFor({ ambiguity: !unit, legacy: true, missingFacts }),
      legacyFacts: {
        rawDuration: input.effect.duration,
        rawValue: value,
      },
      missingFacts,
    };
  }

  const effect = canonicalCombatModifierEffectSchema.parse({
    applicability: {
      activationCutoff: input.effect.effectiveAfterInitiativeGroupId
        ? {
            afterInitiativeGroupId: input.effect.effectiveAfterInitiativeGroupId,
            kind: "initiative_group",
          }
        : undefined,
      combatWide: input.effect.combatWide ?? false,
      encounterId: event?.encounterId ?? input.context.encounterId,
      initiativeGroupId: input.effect.createdInInitiativeGroupId,
      phase: input.effect.initiativePhase,
      rollPurposes: [],
      roundNumber: input.effect.roundNumber,
    },
    createdAt: input.effect.createdAt,
    createdRevision: input.context.createdRevision,
    createdSequence: input.context.createdSequence,
    id: input.effect.id,
    lifecycle: { duration: duration.duration, state: lifecycle.state },
    missingFacts,
    ownerParticipantId: input.effect.targetParticipantId,
    payload,
    provenanceCompleteness: completenessFor({ legacy: true, missingFacts }),
    publicLabel: event?.sourceLabel || input.effect.description || input.effect.type,
    schemaVersion: CANONICAL_COMBAT_MODIFIER_LIFECYCLE_SCHEMA_VERSION,
    sourceFamily: sourceFamilyForEffect(input.effect, event),
    sourceReferences: {
      effectId: input.effect.id,
      eventId: input.effect.sourceEventId,
      opportunityId: input.effect.sourceOpportunityId,
      resultId: input.effect.sourceAttackResultId,
    },
    version: 1,
    visibility: input.context.visibility ?? defaultVisibility,
  });
  return {
    authority: "combat_effect",
    classification: effect.provenanceCompleteness,
    effect,
    legacyFacts: { rawDuration: input.effect.duration, rawValue: value },
    missingFacts,
  };
}

function categoryForBucket(bucket: LegacyCombatModifierBucket) {
  if (bucket === "general") return "general_fatigue" as const;
  if (bucket === "situation_initiative") return "initiative" as const;
  if (bucket === "situation_ob_skill") return "skill_ob" as const;
  return "db_parry" as const;
}

function familyForBucketRow(
  entry: ScenarioCombatModifierEntry,
): CanonicalCombatModifierSourceFamily {
  if (entry.sourceType === "feint" || entry.sourceRule?.startsWith("feint:")) return "feint";
  if (entry.sourceOpportunityId) return "attack_opportunity";
  if (entry.sourceRule === "offensive_parry:declaration_penalty") return "offensive_parry";
  if (entry.sourceType === "character_effect") return "persistent_effect";
  return entry.generated ? "system" : "manual";
}

function durationForBucketRow(input: {
  context: CanonicalCombatModifierCompatibilityContext;
  entry: ScenarioCombatModifierEntry;
}): {
  duration: CanonicalCombatModifierDuration;
  missingFacts: CanonicalCombatModifierMissingFact[];
} {
  if (input.context.explicitDuration) {
    return { duration: input.context.explicitDuration, missingFacts: [] };
  }
  if (
    input.entry.sourceType === "feint" &&
    input.entry.sourcePhase &&
    input.entry.sourceRoundNumber !== undefined &&
    input.context.createdSequence !== undefined
  ) {
    return {
      duration: {
        expiresAt: "phase_boundary",
        kind: "phase",
        phase: input.entry.sourcePhase,
        startPhase: input.entry.sourcePhase,
        startRound: input.entry.sourceRoundNumber,
        startSequence: input.context.createdSequence,
      },
      missingFacts: [],
    };
  }
  return compatibilityDuration({
    context: input.context,
    rawDuration:
      input.entry.sourceDuration ??
      (input.entry.durationRounds === undefined
        ? undefined
        : `${input.entry.durationRounds} rounds`),
  });
}

/** Compatibility adapter for editable modifier-bucket rows; no persistence is changed. */
export function adaptModifierBucketRowToCanonicalLifecycle(input: {
  bucket: LegacyCombatModifierBucket;
  context: CanonicalCombatModifierCompatibilityContext;
  entry: ScenarioCombatModifierEntry;
  ownerParticipantId: string;
}): CanonicalCombatModifierCompatibilityResult {
  const sourceFamily = familyForBucketRow(input.entry);
  const knownFeintPercentage = sourceFamily === "feint";
  const unit =
    input.context.explicitUnit ??
    input.entry.application ??
    (knownFeintPercentage ? "percentage" : undefined);
  const duration = durationForBucketRow(input);
  const missingFacts = uniqueMissingFacts([
    ...creationMissingFacts(input.context),
    ...duration.missingFacts,
    ...(unit ? [] : (["unit"] as const)),
  ]);
  if (!unit) {
    return {
      authority: "modifier_bucket",
      classification: "unsupported_ambiguity",
      legacyFacts: {
        rawDuration: input.entry.sourceDuration,
        rawValue: input.entry.value,
      },
      missingFacts,
    };
  }

  const state = input.entry.provisional
    ? "provisional"
    : input.entry.sourcePhase && input.entry.sourceRoundNumber
      ? "active"
      : "pending_review";
  const effect = canonicalCombatModifierEffectSchema.parse({
    applicability: {
      combatWide: input.entry.combatWide ?? false,
      encounterId: input.entry.sourceEncounterId ?? input.context.encounterId,
      opportunityId: input.entry.sourceOpportunityId,
      phase: input.entry.sourcePhase,
      processId: input.entry.sourceProcessId,
      rollPurposes: [],
      roundNumber: input.entry.sourceRoundNumber,
    },
    createdAt: input.context.createdAt,
    createdRevision: input.context.createdRevision,
    createdSequence: input.context.createdSequence,
    id: input.entry.id,
    lifecycle: { duration: duration.duration, state },
    missingFacts,
    ownerParticipantId: input.ownerParticipantId,
    payload: {
      category: categoryForBucket(input.bucket),
      contributionScope: "calculation",
      kind: "numeric",
      rollPurposePolicy: input.entry.excludedRollPurposes
        ? { excluded: input.entry.excludedRollPurposes, included: [] }
        : undefined,
      unit,
      value: input.entry.value,
    },
    provenanceCompleteness: completenessFor({ legacy: true, missingFacts }),
    publicLabel: input.entry.notes || "Combat modifier",
    schemaVersion: CANONICAL_COMBAT_MODIFIER_LIFECYCLE_SCHEMA_VERSION,
    sourceFamily,
    sourceReferences: {
      effectId: input.entry.sourceEffectId,
      opportunityId: input.entry.sourceOpportunityId,
      processId: input.entry.sourceProcessId,
      proposalId: input.entry.sourceProposalId,
      rowId: input.entry.id,
    },
    version: 1,
    visibility: input.context.visibility ?? defaultVisibility,
  });
  return {
    authority: "modifier_bucket",
    classification: effect.provenanceCompleteness,
    effect,
    legacyFacts: { rawDuration: input.entry.sourceDuration, rawValue: input.entry.value },
    missingFacts,
  };
}

function stateForAttackPenalty(
  commitment: CombatAttackPhasePenaltyCommitment,
): CanonicalCombatModifierLifecycleState {
  if (commitment === "provisional") return "provisional";
  if (commitment === "uncommitted") return "proposed";
  return "active";
}

/** Attack opportunity remains authoritative; this is its canonical lifecycle projection. */
export function adaptAttackPenaltyToCanonicalModifierLifecycle(input: {
  context: CanonicalCombatModifierCompatibilityContext;
  penalty: CombatAttackPhaseDefensivePenalty;
}): CanonicalCombatModifierCompatibilityResult {
  const missingFacts = uniqueMissingFacts(creationMissingFacts(input.context));
  const effect = canonicalCombatModifierEffectSchema.parse({
    applicability: {
      actionId: input.penalty.sourceActionId,
      combatWide: false,
      encounterId: input.context.encounterId,
      initiativeGroupId: input.penalty.initiativeGroupId,
      opportunityId: input.penalty.attackOpportunityId,
      phase: input.penalty.phase,
      processId: input.penalty.attackProcessId,
      rollPurposes: ["parry", "db"],
      roundNumber: input.penalty.roundNumber,
      targetParticipantId: input.penalty.targetParticipantId,
    },
    createdAt: input.context.createdAt,
    createdRevision: input.context.createdRevision,
    createdSequence: input.context.createdSequence,
    id: input.penalty.id,
    lifecycle: {
      duration: {
        expiresAt: "phase_boundary",
        kind: "phase",
        phase: input.penalty.phase,
        startPhase: input.penalty.phase,
        startRound: input.penalty.roundNumber,
        startSequence: input.context.createdSequence ?? 0,
      },
      state: stateForAttackPenalty(input.penalty.commitment),
    },
    missingFacts,
    ownerParticipantId: input.penalty.participantId,
    payload: {
      category: "db_parry",
      contributionScope: "live_value",
      kind: "numeric",
      unit: "percentage",
      value: input.penalty.penalty,
    },
    provenanceCompleteness: completenessFor({
      legacy: input.penalty.completeness === "legacy_partial",
      missingFacts,
    }),
    publicLabel: "Attack DB/Parry",
    schemaVersion: CANONICAL_COMBAT_MODIFIER_LIFECYCLE_SCHEMA_VERSION,
    sourceFamily: "attack_opportunity",
    sourceReferences: {
      opportunityId: input.penalty.attackOpportunityId,
      processId: input.penalty.attackProcessId,
    },
    version: 1,
    visibility: input.context.visibility ?? defaultVisibility,
  });
  return {
    authority: "attack_opportunity",
    classification: effect.provenanceCompleteness,
    effect,
    missingFacts,
  };
}

/**
 * Observe remains relationship-owned. These two directional weapon contributions are projections,
 * not persisted duplicate effects, and retain target scope explicitly.
 */
export function projectObservationRelationshipToCanonicalModifierLifecycle(input: {
  context: CanonicalCombatModifierCompatibilityContext;
  observerParticipantId: string;
  relationship: CombatObservationRelationship;
  targetParticipantId: string;
}): CanonicalCombatModifierCompatibilityResult[] {
  if (input.relationship.bestBonus <= 0) return [];
  const missingFacts = uniqueMissingFacts(creationMissingFacts(input.context));
  const startRound = input.relationship.lastAttempt?.roundNumber ?? 1;
  const startSequence = input.context.createdSequence ?? 0;
  return (["skill_ob", "db_parry"] as const).map((category) => {
    const effect = canonicalCombatModifierEffectSchema.parse({
      applicability: {
        combatWide: false,
        encounterId: input.context.encounterId,
        opponentParticipantId: input.targetParticipantId,
        rollPurposes: [],
      },
      createdAt: input.context.createdAt,
      createdRevision: input.context.createdRevision,
      createdSequence: input.context.createdSequence,
      id: `${input.relationship.id}:canonical:${category}`,
      lifecycle: {
        duration: {
          endsWhen: "relationship_ends",
          kind: "relationship",
          relationshipId: input.relationship.id,
          startRound,
          startSequence,
        },
        state: "active",
      },
      missingFacts,
      ownerParticipantId: input.observerParticipantId,
      payload: {
        category,
        contributionScope: "calculation",
        kind: "numeric",
        unit: "percentage",
        value: input.relationship.bestBonus,
      },
      provenanceCompleteness: completenessFor({ missingFacts }),
      publicLabel: "Observe Opponent",
      schemaVersion: CANONICAL_COMBAT_MODIFIER_LIFECYCLE_SCHEMA_VERSION,
      sourceFamily: "observe_relationship",
      sourceReferences: { relationshipId: input.relationship.id },
      version: 1,
      visibility: input.context.visibility ?? defaultVisibility,
    });
    return {
      authority: "observe_relationship" as const,
      classification: effect.provenanceCompleteness,
      effect,
      missingFacts,
    };
  });
}

/**
 * Bounded projection for process-owned Continued Contact and Unbalanced state. The caller must
 * supply typed facts; this helper intentionally cannot derive them from process labels or UI text.
 */
export function projectProcessRestrictionToCanonicalModifierLifecycle(input: {
  context: CanonicalCombatModifierCompatibilityContext;
  duration: CanonicalCombatModifierDuration;
  effectId: string;
  effectKind: "continued_contact" | "unbalanced";
  opponentParticipantId?: string;
  ownerParticipantId: string;
  processId: string;
  publicLabel: string;
}): CanonicalCombatModifierCompatibilityResult {
  const missingFacts = uniqueMissingFacts(creationMissingFacts(input.context));
  const sourceFamily = input.effectKind;
  const effect = canonicalCombatModifierEffectSchema.parse({
    applicability: {
      combatWide: false,
      encounterId: input.context.encounterId,
      opponentParticipantId: input.opponentParticipantId,
      processId: input.processId,
      rollPurposes: [],
    },
    createdAt: input.context.createdAt,
    createdRevision: input.context.createdRevision,
    createdSequence: input.context.createdSequence,
    id: input.effectId,
    lifecycle: { duration: input.duration, state: "active" },
    missingFacts,
    ownerParticipantId: input.ownerParticipantId,
    payload: {
      effectKind: input.effectKind,
      kind: "restriction",
      operationalRestriction:
        input.effectKind === "continued_contact" ? "contact_maintained" : "disadvantaged",
    },
    provenanceCompleteness: completenessFor({ missingFacts }),
    publicLabel: input.publicLabel,
    schemaVersion: CANONICAL_COMBAT_MODIFIER_LIFECYCLE_SCHEMA_VERSION,
    sourceFamily,
    sourceReferences: { processId: input.processId },
    version: 1,
    visibility: input.context.visibility ?? defaultVisibility,
  });
  return {
    authority: "process_state",
    classification: effect.provenanceCompleteness,
    effect,
    missingFacts,
  };
}
