import { describe, expect, it } from "vitest";

import { scenarioCombatModifierEntrySchema } from "../campaign/scenario";
import { resolveCombatAttackPhaseDefensivePenalty } from "./combatAttackPhasePenalty";
import { combatEffectEventSchema, combatEffectSchema } from "./combatEffects";
import {
  adaptAttackPenaltyToCanonicalModifierLifecycle,
  adaptCombatEffectToCanonicalModifierLifecycle,
  adaptModifierBucketRowToCanonicalLifecycle,
  attachCanonicalLifecycleToModifierBucketRow,
  projectObservationRelationshipToCanonicalModifierLifecycle,
  projectProcessNumericContributionToCanonicalModifierLifecycle,
  projectProcessRestrictionToCanonicalModifierLifecycle,
  transitionCanonicalModifierBucketRow,
  type CanonicalCombatModifierCompatibilityContext,
} from "./combatModifierLifecycleCompatibility";
import { combatObservationRelationshipSchema } from "./combatObservation";

const completeContext: CanonicalCombatModifierCompatibilityContext = {
  createdAt: "2026-08-01T08:00:00.000Z",
  createdRevision: "revision-10",
  createdSequence: 40,
  encounterId: "encounter-1",
  explicitDuration: {
    kind: "manual",
    removableBy: "gm",
    startRound: 2,
    startSequence: 40,
  },
  visibility: { audience: "involved", sourceIdentity: "restricted" },
};

function legacyEffect(overrides: Record<string, unknown> = {}) {
  return combatEffectSchema.parse({
    createdAt: "2026-08-01T08:00:00.000Z",
    damage: 0,
    effectGroup: "general",
    generalDamage: 0,
    id: "legacy-effect-1",
    modifierValue: -2,
    sourceEventId: "event-1",
    status: "active",
    targetParticipantId: "participant-1",
    type: "general_modifier",
    updatedAt: "2026-08-01T08:00:00.000Z",
    ...overrides,
  });
}

const sourceEvent = combatEffectEventSchema.parse({
  createdAt: "2026-08-01T08:00:00.000Z",
  encounterId: "encounter-1",
  id: "event-1",
  sourceLabel: "Combat Experience",
  sourceType: "skill_roll",
  targetParticipantId: "participant-1",
});

describe("canonical modifier lifecycle compatibility adapters", () => {
  it("preserves explicit legacy percentage and flat-DB rows without conflating their units", () => {
    const percentage = adaptModifierBucketRowToCanonicalLifecycle({
      bucket: "situation_db",
      context: completeContext,
      entry: scenarioCombatModifierEntrySchema.parse({
        application: "percentage",
        id: "percentage-row",
        notes: "Attack penalty",
        value: -4,
      }),
      ownerParticipantId: "participant-1",
    });
    const flat = adaptModifierBucketRowToCanonicalLifecycle({
      bucket: "situation_db",
      context: completeContext,
      entry: scenarioCombatModifierEntrySchema.parse({
        application: "flat_db",
        id: "flat-row",
        notes: "Legacy direct DB record",
        value: 2,
      }),
      ownerParticipantId: "participant-1",
    });

    expect(percentage.effect?.payload).toMatchObject({ unit: "percentage", value: -4 });
    expect(flat.effect?.payload).toMatchObject({ unit: "flat_db", value: 2 });
  });

  it("marks an ambiguous-unit bucket row incomplete instead of guessing", () => {
    const adapted = adaptModifierBucketRowToCanonicalLifecycle({
      bucket: "situation_db",
      context: completeContext,
      entry: scenarioCombatModifierEntrySchema.parse({
        id: "ambiguous-row",
        notes: "Legacy DB row",
        value: -2,
      }),
      ownerParticipantId: "participant-1",
    });
    expect(adapted).toMatchObject({
      classification: "unsupported_ambiguity",
      missingFacts: ["unit"],
    });
    expect(adapted.effect).toBeUndefined();
  });

  it("updates a projected opportunity effect with one versioned lifecycle transition", () => {
    const attached = attachCanonicalLifecycleToModifierBucketRow({
      bucket: "situation_db",
      context: {
        ...completeContext,
        explicitDuration: {
          expiresAt: "phase_boundary",
          kind: "phase",
          phase: "phase2",
          startPhase: "phase2",
          startRound: 2,
          startSequence: 40,
        },
      },
      entry: scenarioCombatModifierEntrySchema.parse({
        application: "percentage",
        generated: true,
        id: "attack-row",
        sourceOpportunityId: "opportunity-1",
        sourcePhase: "phase2",
        sourceRoundNumber: 2,
        value: -4,
      }),
      ownerParticipantId: "participant-1",
    });
    const softened = transitionCanonicalModifierBucketRow({
      acceptedRevision: "revision-11",
      acceptedSequence: 41,
      entry: attached,
      nextValue: -2,
      reason: "source_resolved",
      transitionId: "transition-1",
      transitionType: "update",
    });

    expect(softened).toMatchObject({
      canonicalLifecycle: {
        id: "attack-row",
        payload: { unit: "percentage", value: -2 },
        version: 2,
      },
      value: -2,
    });
    expect(softened.canonicalTransitions).toHaveLength(1);
  });

  it("retains CE combat-wide and phase-only applicability as distinct facts", () => {
    const combatWide = adaptCombatEffectToCanonicalModifierLifecycle({
      context: { ...completeContext, explicitUnit: "percentage" },
      effect: legacyEffect({ combatModifierBucket: "general", combatWide: true }),
      events: [sourceEvent],
    });
    const phaseOnly = adaptCombatEffectToCanonicalModifierLifecycle({
      context: { ...completeContext, explicitUnit: "percentage" },
      effect: legacyEffect({
        combatModifierBucket: "general",
        combatWide: false,
        initiativePhase: "phase2",
      }),
      events: [sourceEvent],
    });
    expect(combatWide.effect).toMatchObject({
      applicability: { combatWide: true },
      sourceFamily: "combat_experience",
    });
    expect(phaseOnly.effect).toMatchObject({
      applicability: { combatWide: false, phase: "phase2" },
      sourceFamily: "combat_experience",
    });
  });

  it("does not parse a Stunned duration of 2 as canonical rounds", () => {
    const adapted = adaptCombatEffectToCanonicalModifierLifecycle({
      context: {
        createdAt: completeContext.createdAt,
        createdRevision: completeContext.createdRevision,
        createdSequence: completeContext.createdSequence,
      },
      effect: legacyEffect({ duration: "2", effectGroup: "special", type: "stun" }),
      events: [sourceEvent],
    });
    expect(adapted.classification).toBe("legacy_incomplete");
    expect(adapted.effect?.lifecycle.duration).toEqual({
      kind: "legacy_untyped",
      rawValue: "2",
      reason: "ambiguous_duration",
    });
    expect(adapted.effect?.payload).toMatchObject({
      effectKind: "stunned",
      kind: "restriction",
    });
  });

  it("represents Bleed as a typed rate with its accumulated state", () => {
    const adapted = adaptCombatEffectToCanonicalModifierLifecycle({
      context: completeContext,
      effect: legacyEffect({
        bleedState: { accumulatedTenths: 4, initializedRound: 2 },
        effectGroup: "bleed",
        modifierValue: 2,
        type: "bleed",
      }),
      events: [sourceEvent],
    });
    expect(adapted.effect?.payload).toMatchObject({
      bleedState: { accumulatedTenths: 4, initializedRound: 2 },
      category: "bleed_rate",
      unit: "bleed_rate",
      value: 2,
    });
  });

  it("retains exact attack-opportunity provenance and percentage application", () => {
    const penalty = resolveCombatAttackPhaseDefensivePenalty({
      commitment: "committed",
      opportunity: {
        actionId: "single_attack",
        id: "opportunity-1",
        phase: "phase1",
        slot: "attack_1",
        status: "committed",
        targetParticipantId: "participant-2",
      },
      participantId: "participant-1",
      roundNumber: 2,
    });
    const adapted = adaptAttackPenaltyToCanonicalModifierLifecycle({
      context: completeContext,
      penalty,
    });
    expect(adapted).toMatchObject({
      authority: "attack_opportunity",
      effect: {
        payload: { category: "db_parry", unit: "percentage", value: -4 },
        sourceFamily: "attack_opportunity",
        sourceReferences: { opportunityId: "opportunity-1" },
      },
    });
  });

  it("keeps Feint Skill/OB and DB/Parry consequences as separate identities", () => {
    const entry = (id: string, value: number) =>
      scenarioCombatModifierEntrySchema.parse({
        generated: true,
        id,
        notes: "feint",
        sourcePhase: "phase2",
        sourceProposalId: "proposal-1",
        sourceRoundNumber: 2,
        sourceRule: `feint:proposal-1:participant-1:phase2:${id}`,
        sourceType: "feint",
        value,
      });
    const skill = adaptModifierBucketRowToCanonicalLifecycle({
      bucket: "situation_ob_skill",
      context: { ...completeContext, explicitDuration: undefined },
      entry: entry("ob-skill", -2),
      ownerParticipantId: "participant-1",
    });
    const db = adaptModifierBucketRowToCanonicalLifecycle({
      bucket: "situation_db",
      context: { ...completeContext, explicitDuration: undefined },
      entry: entry("db-parry", -1),
      ownerParticipantId: "participant-1",
    });
    expect(skill.effect).toMatchObject({
      id: "ob-skill",
      payload: { category: "skill_ob", unit: "percentage", value: -2 },
    });
    expect(db.effect).toMatchObject({
      id: "db-parry",
      payload: { category: "db_parry", unit: "percentage", value: -1 },
    });
  });

  it("projects Observe as two directional relationship-owned candidates", () => {
    const relationship = combatObservationRelationshipSchema.parse({
      bestBonus: 2,
      completedAttempts: 1,
      id: "relationship-1",
      observerParticipantId: "combatant-1",
      roundsTowardNextAttempt: 0,
      targetParticipantId: "combatant-2",
    });
    const projected = projectObservationRelationshipToCanonicalModifierLifecycle({
      context: completeContext,
      observerParticipantId: "participant-1",
      relationship,
      targetParticipantId: "participant-2",
    });
    expect(projected).toHaveLength(2);
    expect(projected.map((entry) => entry.effect?.payload)).toEqual([
      expect.objectContaining({ category: "skill_ob", unit: "percentage", value: 2 }),
      expect.objectContaining({ category: "db_parry", unit: "percentage", value: 2 }),
    ]);
    for (const entry of projected) {
      expect(entry).toMatchObject({
        authority: "observe_relationship",
        effect: {
          applicability: { opponentParticipantId: "participant-2" },
          sourceReferences: { relationshipId: "relationship-1" },
        },
      });
    }
  });

  it("keeps Continued Contact and Unbalanced process-owned during migration", () => {
    const duration = {
      conditionId: "contact-1",
      conditionKind: "contact_ended" as const,
      kind: "until_condition" as const,
      startRound: 2,
      startSequence: 40,
    };
    const contact = projectProcessRestrictionToCanonicalModifierLifecycle({
      context: completeContext,
      duration,
      effectId: "contact-effect-1",
      effectKind: "continued_contact",
      opponentParticipantId: "participant-2",
      ownerParticipantId: "participant-1",
      processId: "contact-process-1",
      publicLabel: "Continued Contact",
    });
    const unbalanced = projectProcessRestrictionToCanonicalModifierLifecycle({
      context: completeContext,
      duration,
      effectId: "unbalanced-effect-1",
      effectKind: "unbalanced",
      ownerParticipantId: "participant-2",
      processId: "contact-process-1",
      publicLabel: "Unbalanced",
    });
    expect(contact).toMatchObject({
      authority: "process_state",
      effect: {
        payload: { effectKind: "continued_contact", kind: "restriction" },
        sourceFamily: "continued_contact",
      },
    });
    expect(unbalanced).toMatchObject({
      authority: "process_state",
      effect: {
        payload: { effectKind: "unbalanced", kind: "restriction" },
        sourceFamily: "unbalanced",
      },
    });
  });

  it("projects one calculation-facing Unbalanced contribution from process authority", () => {
    const projected = projectProcessNumericContributionToCanonicalModifierLifecycle({
      category: "general_fatigue",
      context: completeContext,
      duration: {
        conditionId: "contact-1",
        conditionKind: "contact_ended",
        kind: "until_condition",
        startRound: 2,
        startSequence: 40,
      },
      effectId: "unbalanced-1",
      excludedRollPurposes: ["escape_continued_contact"],
      ownerParticipantId: "participant-1",
      processId: "contact-1",
      publicLabel: "Unbalanced",
      sourceFamily: "unbalanced",
      unit: "percentage",
      value: -2,
    });

    expect(projected.effect).toMatchObject({
      payload: {
        category: "general_fatigue",
        rollPurposePolicy: { excluded: ["escape_continued_contact"] },
        unit: "percentage",
        value: -2,
      },
      sourceFamily: "unbalanced",
      sourceReferences: { processId: "contact-1" },
    });
  });
});
