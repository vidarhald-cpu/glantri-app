import { describe, expect, it } from "vitest";

import {
  CANONICAL_COMBAT_MODIFIER_LIFECYCLE_SCHEMA_VERSION,
  canonicalCombatModifierConditionKindSchema,
  canonicalCombatModifierDurationSchema,
  canonicalCombatModifierEffectSchema,
  canonicalCombatModifierHistoricalSnapshotSchema,
  canonicalCombatModifierLifecycleStateSchema,
  canonicalCombatModifierPayloadSchema,
  classifyCanonicalCombatModifierDuration,
  evaluateCanonicalCombatModifierDurationAtRoundEnd,
  isCanonicalCombatModifierTransitionAllowed,
  projectPlayerSafeCanonicalCombatModifierEffect,
  restoreCanonicalCombatModifierEffectFromTransition,
  selectCanonicalCombatModifierEffect,
  transitionCanonicalCombatModifierEffect,
  type CanonicalCombatModifierDuration,
  type CanonicalCombatModifierEffect,
} from "./combatModifierLifecycle";

function effect(
  overrides: Partial<CanonicalCombatModifierEffect> = {},
): CanonicalCombatModifierEffect {
  return canonicalCombatModifierEffectSchema.parse({
    applicability: {
      combatWide: false,
      encounterId: "encounter-1",
      phase: "phase2",
      rollPurposes: [],
      roundNumber: 2,
    },
    createdAt: "2026-08-01T08:00:00.000Z",
    createdRevision: "revision-10",
    createdSequence: 40,
    id: "effect-1",
    lifecycle: {
      duration: {
        expiresAt: "phase_boundary",
        kind: "phase",
        phase: "phase2",
        startPhase: "phase2",
        startRound: 2,
        startSequence: 40,
      },
      state: "active",
    },
    ownerParticipantId: "participant-1",
    payload: {
      category: "db_parry",
      contributionScope: "calculation",
      kind: "numeric",
      unit: "percentage",
      value: -2,
    },
    provenanceCompleteness: "complete",
    publicLabel: "Feint",
    schemaVersion: CANONICAL_COMBAT_MODIFIER_LIFECYCLE_SCHEMA_VERSION,
    sourceFamily: "feint",
    sourceReferences: { eventId: "event-1", resultId: "result-1" },
    version: 1,
    visibility: { audience: "involved", sourceIdentity: "restricted" },
    ...overrides,
  });
}

describe("canonical combat modifier lifecycle", () => {
  it("requires an explicit unit for numeric effects and no fake value for restrictions", () => {
    expect(
      canonicalCombatModifierPayloadSchema.safeParse({
        category: "db_parry",
        contributionScope: "calculation",
        kind: "numeric",
        value: -2,
      }).success,
    ).toBe(false);
    expect(
      canonicalCombatModifierPayloadSchema.parse({
        effectKind: "stunned",
        kind: "restriction",
        operationalRestriction: "limited_action",
      }),
    ).not.toHaveProperty("value");
  });

  it("keeps combat-wide, roll-restricted, phase, and group applicability explicit", () => {
    const scoped = effect({
      applicability: {
        combatWide: false,
        initiativeGroupId: "initiative-group-2",
        opponentParticipantId: "participant-2",
        phase: "phase2",
        rollPurposes: ["parry"],
        roundNumber: 2,
      },
    });

    expect(
      selectCanonicalCombatModifierEffect({
        context: {
          initiativeGroupId: "initiative-group-2",
          opponentParticipantId: "participant-2",
          ownerParticipantId: "participant-1",
          phase: "phase2",
          rollPurpose: "parry",
          roundNumber: 2,
        },
        effect: scoped,
      }).selectedForCalculation,
    ).toBe(true);
    expect(
      selectCanonicalCombatModifierEffect({
        context: {
          initiativeGroupId: "initiative-group-2",
          opponentParticipantId: "participant-3",
          ownerParticipantId: "participant-1",
          phase: "phase2",
          rollPurpose: "parry",
          roundNumber: 2,
        },
        effect: scoped,
      }).selectedForCalculation,
    ).toBe(false);

    expect(effect().applicability.combatWide).toBe(false);
    expect(
      effect({ applicability: { combatWide: true, rollPurposes: [] } }).applicability.combatWide,
    ).toBe(true);
  });

  it("distinguishes discoverable pending activation from an active contribution", () => {
    const pending = effect({
      applicability: {
        activationCutoff: { afterSequence: 50, kind: "sequence" },
        combatWide: false,
        rollPurposes: [],
      },
      lifecycle: {
        duration: effect().lifecycle.duration,
        state: "pending_activation",
      },
    });
    const selected = selectCanonicalCombatModifierEffect({
      context: { acceptedSequence: 51, ownerParticipantId: "participant-1" },
      effect: pending,
    });
    expect(selected).toMatchObject({
      active: false,
      discoverable: true,
      selectedForCalculation: false,
    });
  });

  it("keeps every review and terminal lifecycle state distinct", () => {
    expect(canonicalCombatModifierLifecycleStateSchema.options).toEqual(
      expect.arrayContaining([
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
      ]),
    );
    expect(new Set(canonicalCombatModifierLifecycleStateSchema.options).size).toBe(
      canonicalCombatModifierLifecycleStateSchema.options.length,
    );
  });

  it("rejects illegal transitions deterministically", () => {
    expect(
      isCanonicalCombatModifierTransitionAllowed({
        from: "active",
        to: "provisional",
        transitionType: "make_provisional",
      }),
    ).toBe(false);
    expect(() =>
      transitionCanonicalCombatModifierEffect({
        acceptedRevision: "revision-11",
        acceptedSequence: 41,
        effect: effect(),
        nextState: "provisional",
        reason: "legacy_compatibility",
        transitionId: "transition-invalid",
        transitionType: "make_provisional",
      }),
    ).toThrow("Illegal combat modifier lifecycle transition");
  });

  it("represents phase, rounds, opportunity, check, relationship, and manual duration policies", () => {
    const common = { startRound: 2, startSequence: 40 };
    const durations = [
      {
        ...common,
        expiresAt: "phase_boundary",
        kind: "phase",
        phase: "phase1",
      },
      {
        ...common,
        creationRoundCounts: false,
        kind: "rounds",
        remaining: 3,
        transitionBoundary: "round_end_review",
      },
      {
        ...common,
        consumeOn: "execution",
        kind: "attack_opportunity_count",
        opportunityIds: ["opportunity-1"],
        remaining: 1,
      },
      {
        ...common,
        check: { checkId: "check-1", checkKind: "recovery" },
        kind: "until_check",
        resolvesOn: "accepted_result",
      },
      {
        ...common,
        endsWhen: "relationship_ends",
        kind: "relationship",
        relationshipId: "relationship-1",
      },
      { ...common, kind: "manual", removableBy: "gm" },
      { ...common, kind: "indefinite" },
    ];
    expect(
      durations.map((value) => canonicalCombatModifierDurationSchema.parse(value).kind),
    ).toEqual([
      "phase",
      "rounds",
      "attack_opportunity_count",
      "until_check",
      "relationship",
      "manual",
      "indefinite",
    ]);
  });

  it("retains transition provenance and restores exact prior lifecycle facts on undo", () => {
    const removed = transitionCanonicalCombatModifierEffect({
      acceptedRevision: "revision-11",
      acceptedSequence: 41,
      commandId: "command-remove",
      effect: effect(),
      gmOverride: { reasonCode: "gm-review", userId: "gm-1" },
      nextState: "removed",
      publicNote: "Effect removed.",
      reason: "gm_removed",
      transitionId: "transition-remove",
      transitionType: "remove",
    });
    expect(removed.transition).toMatchObject({
      prior: { lifecycle: { state: "active" }, version: 1 },
      next: { lifecycle: { state: "removed" }, version: 2 },
      reason: "gm_removed",
    });

    const restored = restoreCanonicalCombatModifierEffectFromTransition({
      acceptedRevision: "revision-12",
      acceptedSequence: 42,
      commandId: "command-undo",
      effect: removed.effect,
      transition: removed.transition,
      transitionId: "transition-restore",
    });
    expect(restored.effect.lifecycle).toEqual(effect().lifecycle);
    expect(restored.effect.version).toBe(3);
    expect(restored.transition).toMatchObject({
      reason: "undo_restored",
      restoresTransitionId: "transition-remove",
    });
  });

  it("retains replacement lineage instead of deleting provenance", () => {
    const superseded = transitionCanonicalCombatModifierEffect({
      acceptedRevision: "revision-11",
      acceptedSequence: 41,
      effect: effect(),
      nextState: "superseded",
      reason: "replaced",
      replacementEffectId: "effect-2",
      transitionId: "transition-replace",
      transitionType: "supersede",
    });
    expect(superseded.effect.lineage.replacedByEffectId).toBe("effect-2");
    expect(superseded.transition.prior.lineage).toEqual({});
  });

  it("captures an immutable sequence-bounded historical modifier snapshot", () => {
    const snapshot = canonicalCombatModifierHistoricalSnapshotSchema.parse({
      acceptedRevision: "revision-10",
      cutoffSequence: 40,
      effects: [effect()],
      encounterId: "encounter-1",
      ownerParticipantId: "participant-1",
      roundNumber: 2,
      schemaVersion: CANONICAL_COMBAT_MODIFIER_LIFECYCLE_SCHEMA_VERSION,
    });
    expect(snapshot.effects[0]?.payload).toMatchObject({ unit: "percentage", value: -2 });
    expect(snapshot.cutoffSequence).toBe(40);
  });

  it("removes private provenance and hidden opponent identity without changing public semantics", () => {
    const privateEffect = effect({
      applicability: {
        combatWide: false,
        opponentParticipantId: "hidden-opponent",
        rollPurposes: ["parry"],
      },
      privateDiagnostic: { code: "internal-check", referenceId: "private-1" },
      sourceReferences: { eventId: "hidden-event", processId: "hidden-process" },
    });
    const projected = projectPlayerSafeCanonicalCombatModifierEffect({
      effect: privateEffect,
      viewer: {
        controlledParticipantIds: new Set(["participant-1"]),
        isGm: false,
        visibleParticipantIds: new Set(["participant-1"]),
      },
    });
    expect(projected?.applicability.opponentParticipantId).toBeUndefined();
    expect(projected?.payload).toEqual(privateEffect.payload);
    expect(projected).not.toHaveProperty("privateDiagnostic");
    expect(projected).not.toHaveProperty("sourceReferences");
  });
});

// #215 S4 — the canonical temporal vocabulary and the one shared transition engine every round
// boundary must route through.
describe("canonical temporal vocabulary", () => {
  const start = { startRound: 7, startSequence: 4 };
  const fixed = (overrides: Record<string, unknown> = {}): CanonicalCombatModifierDuration =>
    canonicalCombatModifierDurationSchema.parse({
      creationRoundCounts: false,
      kind: "rounds",
      remaining: 2,
      transitionBoundary: "round_end_review",
      ...start,
      ...overrides,
    });

  it("classifies every duration shape into exactly one temporal class", () => {
    expect(classifyCanonicalCombatModifierDuration(fixed())).toBe("fixed");
    expect(
      classifyCanonicalCombatModifierDuration(
        fixed({ rolled: { formula: "d4", rolledAtRound: 7, value: 2 } }),
      ),
    ).toBe("bounded_uncertain");
    expect(classifyCanonicalCombatModifierDuration({ kind: "remainder_of_round", ...start })).toBe(
      "remainder_only",
    );
    expect(classifyCanonicalCombatModifierDuration({ kind: "instantaneous", ...start })).toBe(
      "instantaneous",
    );
    expect(
      classifyCanonicalCombatModifierDuration({
        check: { checkId: "recovery-1", checkKind: "recovery" },
        kind: "until_check",
        resolvesOn: "success",
        ...start,
      }),
    ).toBe("scheduled");
    expect(
      classifyCanonicalCombatModifierDuration({
        conditionId: "care-1",
        conditionKind: "participant_state",
        kind: "until_condition",
        ...start,
      }),
    ).toBe("condition_event");
    expect(classifyCanonicalCombatModifierDuration({ kind: "indefinite", ...start })).toBe("other");
    expect(
      classifyCanonicalCombatModifierDuration({ kind: "manual", removableBy: "gm", ...start }),
    ).toBe("other");
  });

  it("holds a fixed duration at its creation round and decrements only afterwards", () => {
    expect(
      evaluateCanonicalCombatModifierDurationAtRoundEnd({ duration: fixed(), roundNumber: 7 }),
    ).toEqual({ kind: "hold", reason: "creation_round_excluded" });
    expect(
      evaluateCanonicalCombatModifierDurationAtRoundEnd({ duration: fixed(), roundNumber: 8 }),
    ).toEqual({
      kind: "decrement",
      nextDuration: fixed({ remaining: 1 }),
    });
    expect(
      evaluateCanonicalCombatModifierDurationAtRoundEnd({
        duration: fixed({ remaining: 1 }),
        roundNumber: 9,
      }),
    ).toEqual({ kind: "expire", reason: "natural_expiry" });
  });

  it("counts the creation round only when the duration explicitly opts in", () => {
    expect(
      evaluateCanonicalCombatModifierDurationAtRoundEnd({
        duration: fixed({ creationRoundCounts: true }),
        roundNumber: 7,
      }),
    ).toEqual({
      kind: "decrement",
      nextDuration: fixed({ creationRoundCounts: true, remaining: 1 }),
    });
  });

  it("retains a bounded uncertain roll across every decrement instead of rerolling it", () => {
    const rolled = { formula: "d4", rolledAtRound: 7, value: 3 };
    const outcome = evaluateCanonicalCombatModifierDurationAtRoundEnd({
      duration: fixed({ remaining: 3, rolled }),
      roundNumber: 8,
    });

    expect(outcome).toEqual({
      kind: "decrement",
      nextDuration: fixed({ remaining: 2, rolled }),
    });
  });

  it("ends remainder-only state at its own Round End and never lets instantaneous state persist", () => {
    expect(
      evaluateCanonicalCombatModifierDurationAtRoundEnd({
        duration: { kind: "remainder_of_round", ...start },
        roundNumber: 7,
      }),
    ).toEqual({ kind: "expire", reason: "remainder_of_round_ended" });
    expect(
      evaluateCanonicalCombatModifierDurationAtRoundEnd({
        duration: { kind: "instantaneous", ...start },
        roundNumber: 7,
      }),
    ).toEqual({ kind: "expire", reason: "never_persists" });
  });

  it("routes scheduled, condition and legacy shapes to resolution instead of a fabricated roll", () => {
    expect(
      evaluateCanonicalCombatModifierDurationAtRoundEnd({
        duration: {
          check: { checkId: "recovery-1", checkKind: "recovery" },
          kind: "until_check",
          resolvesOn: "success",
          ...start,
        },
        roundNumber: 9,
      }),
    ).toEqual({ kind: "requires_resolution", requirement: "recovery_check" });
    expect(
      evaluateCanonicalCombatModifierDurationAtRoundEnd({
        duration: {
          conditionId: "care-1",
          conditionKind: "participant_state",
          kind: "until_condition",
          ...start,
        },
        roundNumber: 9,
      }),
    ).toEqual({ kind: "requires_resolution", requirement: "condition" });
    expect(
      evaluateCanonicalCombatModifierDurationAtRoundEnd({
        duration: { kind: "legacy_untyped", reason: "ambiguous_duration" },
        roundNumber: 9,
      }),
    ).toEqual({ kind: "requires_resolution", requirement: "legacy_incomplete" });
  });

  it("leaves shapes that are not driven by the round clock untouched", () => {
    for (const duration of [
      { expiresAt: "phase_boundary", kind: "phase", phase: "phase2", ...start },
      {
        consumeOn: "execution",
        kind: "attack_opportunity_count",
        opportunityIds: ["op-1"],
        remaining: 2,
        ...start,
      },
      { endsWhen: "relationship_ends", kind: "relationship", relationshipId: "rel-1", ...start },
      { kind: "manual", removableBy: "gm", ...start },
      { kind: "indefinite", ...start },
    ] as const) {
      expect(
        evaluateCanonicalCombatModifierDurationAtRoundEnd({
          duration: canonicalCombatModifierDurationSchema.parse(duration),
          roundNumber: 9,
        }),
      ).toEqual({ kind: "not_time_driven" });
    }
  });
});

describe("[#215 S6] the canonical condition/event vocabulary", () => {
  // The exact membership before S6, written out by hand rather than derived from the schema, so
  // this block fails if a later change removes or renames a pre-S6 member.
  const PRE_S6_CONDITION_KINDS = [
    "effect_cleared",
    "contact_ended",
    "participant_state",
    "source_process_completed",
  ] as const;

  const start = { startRound: 4, startSequence: 2 } as const;

  function untilCondition(conditionKind: string): unknown {
    return { conditionId: "condition-1", conditionKind, kind: "until_condition", ...start };
  }

  it("widens the vocabulary additively: every pre-S6 member still parses to itself", () => {
    for (const conditionKind of PRE_S6_CONDITION_KINDS) {
      const parsed = canonicalCombatModifierDurationSchema.parse(untilCondition(conditionKind));
      expect(parsed).toEqual({
        conditionId: "condition-1",
        conditionKind,
        kind: "until_condition",
        ...start,
      });
    }
    expect(canonicalCombatModifierConditionKindSchema.options).toEqual([
      ...PRE_S6_CONDITION_KINDS,
      "treated",
    ]);
  });

  it("binds `treated` canonically and keeps every pre-S6 interpretation unchanged", () => {
    for (const conditionKind of [...PRE_S6_CONDITION_KINDS, "treated"] as const) {
      const duration = canonicalCombatModifierDurationSchema.parse(untilCondition(conditionKind));

      // Interpretation is a property of the `until_condition` shape, not of the member. Pre-S6
      // rows therefore keep exactly the classification and boundary outcome they had, and the new
      // member acquires the same one rather than a new behaviour of its own.
      expect(classifyCanonicalCombatModifierDuration(duration)).toBe("condition_event");
      expect(
        evaluateCanonicalCombatModifierDurationAtRoundEnd({ duration, roundNumber: 9 }),
      ).toEqual({ kind: "requires_resolution", requirement: "condition" });
    }
  });

  it("rejects an unknown condition member rather than coercing or defaulting it", () => {
    expect(
      canonicalCombatModifierDurationSchema.safeParse(untilCondition("treated_then_permanent"))
        .success,
    ).toBe(false);
    expect(canonicalCombatModifierDurationSchema.safeParse(untilCondition("time")).success).toBe(
      false,
    );
  });

  it("keeps `conditionId` and `conditionKind` required, so no row acquires a member on read", () => {
    expect(
      canonicalCombatModifierDurationSchema.safeParse({
        conditionId: "condition-1",
        kind: "until_condition",
        ...start,
      }).success,
    ).toBe(false);
    expect(
      canonicalCombatModifierDurationSchema.safeParse({
        conditionKind: "treated",
        kind: "until_condition",
        ...start,
      }).success,
    ).toBe(false);
  });
});
