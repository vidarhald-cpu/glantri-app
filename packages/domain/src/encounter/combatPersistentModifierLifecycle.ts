import {
  combatEffectSchema,
  combatEffectsStateSchema,
  type CombatEffect,
  type CombatEffectsState,
  type CombatEffectStatus,
} from "./combatEffects";
import {
  CANONICAL_COMBAT_MODIFIER_LIFECYCLE_SCHEMA_VERSION,
  canonicalCombatModifierEffectSchema,
  transitionCanonicalCombatModifierEffect,
  type CanonicalCombatModifierApplicability,
  type CanonicalCombatModifierDuration,
  type CanonicalCombatModifierEffect,
  type CanonicalCombatModifierLifecycleState,
  type CanonicalCombatModifierPayload,
  type CanonicalCombatModifierTransitionReason,
  type CanonicalCombatModifierTransitionType,
} from "./combatModifierLifecycle";
import { adaptCombatEffectToCanonicalModifierLifecycle } from "./combatModifierLifecycleCompatibility";

export interface PersistentCombatModifierCreationContext {
  commandId: string;
  createdAt: string;
  createdRevision?: string;
  createdSequence: number;
  encounterId?: string;
  eventId: string;
  ownerParticipantId: string;
  roundNumber: number;
}

function lifecycleStateForStatus(input: {
  activationCutoff?: CanonicalCombatModifierApplicability["activationCutoff"];
  status: CombatEffectStatus;
}): CanonicalCombatModifierLifecycleState {
  if (input.status === "pending") {
    return input.activationCutoff ? "pending_activation" : "pending_review";
  }
  return input.status;
}

function buildEffect(input: {
  applicability: CanonicalCombatModifierApplicability;
  context: PersistentCombatModifierCreationContext;
  duration: CanonicalCombatModifierDuration;
  effectId: string;
  payload: CanonicalCombatModifierPayload;
  publicLabel: string;
  publicNote?: string;
  sourceFamily: CanonicalCombatModifierEffect["sourceFamily"];
  sourceReferences?: CanonicalCombatModifierEffect["sourceReferences"];
  status: CombatEffectStatus;
}): CanonicalCombatModifierEffect {
  const missingFacts = input.context.createdRevision ? [] : (["creation_revision"] as const);
  return canonicalCombatModifierEffectSchema.parse({
    applicability: input.applicability,
    createdAt: input.context.createdAt,
    createdRevision: input.context.createdRevision,
    createdSequence: input.context.createdSequence,
    id: input.effectId,
    lifecycle: {
      duration: input.duration,
      state: lifecycleStateForStatus({
        activationCutoff: input.applicability.activationCutoff,
        status: input.status,
      }),
    },
    missingFacts,
    ownerParticipantId: input.context.ownerParticipantId,
    payload: input.payload,
    provenanceCompleteness: missingFacts.length === 0 ? "complete" : "partial",
    publicLabel: input.publicLabel,
    publicNote: input.publicNote?.trim() || undefined,
    schemaVersion: CANONICAL_COMBAT_MODIFIER_LIFECYCLE_SCHEMA_VERSION,
    sourceFamily: input.sourceFamily,
    sourceReferences: {
      commandId: input.context.commandId,
      eventId: input.context.eventId,
      ...input.sourceReferences,
    },
    version: 1,
    visibility: { audience: "involved", sourceIdentity: "restricted" },
  });
}

export function buildCombatExperiencePersistentLifecycle(input: {
  context: PersistentCombatModifierCreationContext;
  durationRounds: number;
  effectId: string;
  modifierValue: number;
  phase?: "phase1" | "phase2";
  status: CombatEffectStatus;
}): CanonicalCombatModifierEffect {
  return buildEffect({
    applicability: {
      combatWide: input.phase === undefined,
      encounterId: input.context.encounterId,
      phase: input.phase,
      rollPurposes: [],
      roundNumber: input.phase ? input.context.roundNumber : undefined,
    },
    context: input.context,
    duration: {
      creationRoundCounts: true,
      kind: "rounds",
      remaining: input.durationRounds,
      startRound: input.context.roundNumber,
      startSequence: input.context.createdSequence,
      transitionBoundary: "round_end_review",
    },
    effectId: input.effectId,
    payload: {
      category: "general_fatigue",
      contributionScope: "calculation",
      kind: "numeric",
      unit: "percentage",
      value: input.modifierValue,
    },
    publicLabel: "Combat Experience",
    sourceFamily: "combat_experience",
    sourceReferences: { effectId: input.effectId },
    status: input.status,
  });
}

export function buildManualPersistentLifecycle(input: {
  applicability: CanonicalCombatModifierApplicability;
  context: PersistentCombatModifierCreationContext;
  duration: CanonicalCombatModifierDuration;
  effectId: string;
  payload: CanonicalCombatModifierPayload;
  publicLabel: string;
  publicNote?: string;
  status?: CombatEffectStatus;
}): CanonicalCombatModifierEffect {
  return buildEffect({
    applicability: input.applicability,
    context: input.context,
    duration: input.duration,
    effectId: input.effectId,
    payload: input.payload,
    publicLabel: input.publicLabel,
    publicNote: input.publicNote,
    sourceFamily: "manual",
    sourceReferences: { effectId: input.effectId },
    status: input.status ?? "active",
  });
}

function activationApplicability(input: {
  context: PersistentCombatModifierCreationContext;
  effectiveAfterInitiativeGroupId?: string;
  initiativeGroupId?: string;
  phase?: "phase1" | "phase2";
}): CanonicalCombatModifierApplicability {
  return {
    activationCutoff: input.effectiveAfterInitiativeGroupId
      ? {
          afterInitiativeGroupId: input.effectiveAfterInitiativeGroupId,
          kind: "initiative_group",
        }
      : undefined,
    combatWide: true,
    encounterId: input.context.encounterId,
    initiativeGroupId: input.initiativeGroupId,
    phase: undefined,
    rollPurposes: [],
  };
}

export function isBoundedStunnedDamageEffect(input: {
  label: string;
  notes?: string;
  rowCategory?: string;
  sourceText?: string;
}): boolean {
  if (input.rowCategory !== "no_combat_action" && !/^stunned?$/i.test(input.label.trim())) {
    return false;
  }
  return /\bstun(?:ned)?\b/i.test(
    [input.label, input.notes, input.sourceText].filter(Boolean).join(" "),
  );
}

export function buildDamagePersistentLifecycle(input: {
  combatModifierBucket?: CombatEffect["combatModifierBucket"];
  context: PersistentCombatModifierCreationContext;
  durationRounds?: number;
  effectId: string;
  effectiveAfterInitiativeGroupId?: string;
  initiativeGroupId?: string;
  isStunned: boolean;
  label: string;
  modifierValue?: number;
  notes?: string;
  phase?: "phase1" | "phase2";
  rowCategory?: string;
  status: CombatEffectStatus;
  type: CombatEffect["type"];
}): CanonicalCombatModifierEffect | undefined {
  const common = {
    context: input.context,
    sourceReferences: { effectId: input.effectId },
    status: input.status,
  };
  const applicability = activationApplicability(input);
  const duration: CanonicalCombatModifierDuration = input.durationRounds
    ? {
        creationRoundCounts: true,
        kind: "rounds",
        remaining: input.durationRounds,
        startRound: input.context.roundNumber,
        startSequence: input.context.createdSequence,
        transitionBoundary: "round_end_review",
      }
    : {
        conditionId: input.effectId,
        conditionKind: "effect_cleared",
        kind: "until_condition",
        startRound: input.context.roundNumber,
        startSequence: input.context.createdSequence,
      };

  if (input.type === "bleed" || input.type === "internal_bleed") {
    return buildEffect({
      ...common,
      applicability,
      duration: {
        conditionId: input.effectId,
        conditionKind: "effect_cleared",
        kind: "until_condition",
        startRound: input.context.roundNumber,
        startSequence: input.context.createdSequence,
      },
      effectId: input.effectId,
      payload: {
        bleedState: {
          accumulatedTenths: 0,
          initializedRound: input.context.roundNumber,
        },
        category: "bleed_rate",
        contributionScope: "state",
        kind: "numeric",
        unit: "bleed_rate",
        value: Math.max(0, Math.trunc(input.modifierValue ?? 0)),
      },
      publicLabel: input.type === "internal_bleed" ? "Internal bleed" : "Bleed",
      publicNote: input.notes,
      sourceFamily: "bleed",
    });
  }

  if (input.isStunned) {
    return buildEffect({
      ...common,
      applicability,
      duration,
      effectId: input.effectId,
      payload: {
        effectKind: "stunned",
        kind: "restriction",
        operationalRestriction: "limited_action",
      },
      publicLabel: "Stunned",
      publicNote: input.notes,
      sourceFamily: "stunned",
    });
  }

  if (input.modifierValue !== undefined && input.combatModifierBucket) {
    const category =
      input.combatModifierBucket === "general"
        ? "general_fatigue"
        : input.combatModifierBucket === "initiative"
          ? "initiative"
          : input.combatModifierBucket === "skill_ob"
            ? "skill_ob"
            : "db_parry";
    return buildEffect({
      ...common,
      applicability,
      duration,
      effectId: input.effectId,
      payload: {
        category,
        contributionScope: "calculation",
        kind: "numeric",
        unit: input.combatModifierBucket === "initiative" ? "initiative_value" : "percentage",
        value: input.modifierValue,
      },
      publicLabel: input.label,
      publicNote: input.notes,
      sourceFamily: "damage",
    });
  }

  return undefined;
}

export function transitionPersistentCombatEffect(input: {
  acceptedRevision?: string;
  acceptedSequence: number;
  commandId: string;
  effect: CombatEffect;
  eventId?: string;
  nextDuration?: CanonicalCombatModifierDuration;
  nextPayload?: CanonicalCombatModifierPayload;
  nextState: CanonicalCombatModifierLifecycleState;
  reason: CanonicalCombatModifierTransitionReason;
  transitionType: Exclude<CanonicalCombatModifierTransitionType, "restore">;
}): CombatEffect {
  if (!input.effect.canonicalLifecycle) return input.effect;
  const revision = input.acceptedRevision ?? input.commandId;
  const transitioned = transitionCanonicalCombatModifierEffect({
    acceptedRevision: revision,
    acceptedSequence: input.acceptedSequence,
    commandId: input.commandId,
    effect: input.effect.canonicalLifecycle,
    eventId: input.eventId,
    nextDuration: input.nextDuration,
    nextPayload: input.nextPayload,
    nextState: input.nextState,
    reason: input.reason,
    transitionId: `${input.commandId}:modifier-transition:${input.effect.id}:${input.effect.canonicalLifecycle.version + 1}`,
    transitionType: input.transitionType,
  });
  return combatEffectSchema.parse({
    ...input.effect,
    canonicalLifecycle: transitioned.effect,
    canonicalTransitions: [...(input.effect.canonicalTransitions ?? []), transitioned.transition],
  });
}

/**
 * Adds bounded lifecycle metadata when a legacy/manual durable row already carries enough typed
 * facts to adapt safely. Whole-state editing remains a compatibility workflow: ambiguous units,
 * durations, or scopes are preserved unchanged and continue to report through the compatibility
 * adapter instead of being guessed here.
 */
export function attachCanonicalPersistentEffectLifecycles(input: {
  combatEffects?: CombatEffectsState;
  createdRevision?: string;
  createdSequence?: number;
  encounterId?: string;
}): CombatEffectsState {
  const combatEffects = combatEffectsStateSchema.parse(input.combatEffects);

  return combatEffectsStateSchema.parse({
    ...combatEffects,
    effects: combatEffects.effects.map((effect) => {
      if (effect.canonicalLifecycle) return effect;

      const adapted = adaptCombatEffectToCanonicalModifierLifecycle({
        context: {
          createdAt: effect.createdAt,
          createdRevision: input.createdRevision,
          createdSequence: input.createdSequence,
          encounterId: input.encounterId,
        },
        effect,
        events: combatEffects.events,
      });

      return adapted.effect
        ? combatEffectSchema.parse({ ...effect, canonicalLifecycle: adapted.effect })
        : effect;
    }),
  });
}
