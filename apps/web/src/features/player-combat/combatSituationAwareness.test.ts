import { describe, expect, it } from "vitest";

import {
  canonicalCombatModifierDurationSchema,
  canonicalCombatModifierEffectSchema,
  type CanonicalCombatModifierDuration,
  type CanonicalCombatModifierEffect,
} from "@glantri/domain";

import {
  buildCombatSituationAwarenessModel,
  collectCanonicalCombatSituationEffects,
  formatDuration,
} from "./combatSituationAwareness";

function numericEffect(input: {
  category: "general_fatigue" | "skill_ob" | "db_parry" | "bleed_rate";
  id: string;
  label: string;
  opponentParticipantId?: string;
  sourceFamily?: "feint" | "observe_relationship" | "declaration" | "combat_experience" | "bleed";
  unit?: "percentage" | "bleed_rate";
  value: number;
}): CanonicalCombatModifierEffect {
  return canonicalCombatModifierEffectSchema.parse({
    applicability: {
      combatWide: !input.opponentParticipantId,
      opponentParticipantId: input.opponentParticipantId,
      phase: input.category === "bleed_rate" ? undefined : "phase2",
      rollPurposes: [],
      roundNumber: 3,
    },
    createdAt: "2026-08-01T10:00:00.000Z",
    createdRevision: "revision-3",
    createdSequence: 12,
    id: input.id,
    lifecycle: {
      duration:
        input.sourceFamily === "observe_relationship"
          ? {
              endsWhen: "relationship_ends",
              kind: "relationship",
              relationshipId: "observe:scyrian:gladiator",
              startRound: 3,
              startSequence: 12,
            }
          : {
              expiresAt: "phase_boundary",
              kind: "phase",
              phase: "phase2",
              startPhase: "phase2",
              startRound: 3,
              startSequence: 12,
            },
      state: "active",
    },
    lineage: {},
    missingFacts: [],
    ownerParticipantId: "scyrian",
    payload: {
      category: input.category,
      contributionScope: input.category === "bleed_rate" ? "state" : "calculation",
      kind: "numeric",
      unit: input.unit ?? "percentage",
      value: input.value,
    },
    provenanceCompleteness: "complete",
    publicLabel: input.label,
    schemaVersion: 1,
    sourceFamily: input.sourceFamily ?? "feint",
    sourceReferences:
      input.sourceFamily === "observe_relationship"
        ? { relationshipId: "observe:scyrian:gladiator" }
        : {},
    version: 1,
    visibility: { audience: "involved", sourceIdentity: "public" },
  });
}

function restrictionEffect(input: {
  id: string;
  kind: "stunned" | "continued_contact" | "unbalanced" | "no_combat_action";
  label: string;
}): CanonicalCombatModifierEffect {
  return canonicalCombatModifierEffectSchema.parse({
    applicability: { combatWide: true, rollPurposes: [], roundNumber: 3 },
    createdAt: "2026-08-01T10:00:00.000Z",
    createdRevision: "revision-3",
    createdSequence: 12,
    id: input.id,
    lifecycle: {
      duration: { kind: "indefinite", startRound: 3, startSequence: 12 },
      state: "active",
    },
    lineage: {},
    missingFacts: [],
    ownerParticipantId: "scyrian",
    payload: {
      effectKind: input.kind,
      kind: "restriction",
      operationalRestriction: input.kind === "no_combat_action" ? "cannot_act" : "none",
    },
    provenanceCompleteness: "complete",
    publicLabel: input.label,
    schemaVersion: 1,
    sourceFamily: input.kind === "continued_contact" ? "continued_contact" : "system",
    sourceReferences: {},
    version: 1,
    visibility: { audience: "public", sourceIdentity: "public" },
  });
}

describe("buildCombatSituationAwarenessModel", () => {
  it("shows SU-owned pending and expiring work without fabricating modifier values", () => {
    const model = buildCombatSituationAwarenessModel({
      pendingRows: [
        {
          durationLabel: "Expires after this review",
          id: "ce-expiry",
          label: "Combat Experience",
        },
        {
          durationLabel: "Required",
          id: "bleed-health",
          label: "Health check vs external bleed",
        },
      ],
      rows: [],
    });

    expect(model.pending.map((row) => row.id)).toEqual(["ce-expiry", "bleed-health"]);
    expect(model.pending.every((row) => !("valueLabel" in row))).toBe(true);
    expect(model.empty).toBe(false);
  });
  it("keeps the five Feint, Observe, and Parry sources visible when DB/Parry totals zero", () => {
    const feintSkill = numericEffect({
      category: "skill_ob",
      id: "feint:skill",
      label: "Feint",
      value: -2,
    });
    const feintDb = numericEffect({
      category: "db_parry",
      id: "feint:db",
      label: "Feint",
      value: -2,
    });
    const observeSkill = numericEffect({
      category: "skill_ob",
      id: "observe:skill",
      label: "Observe Opponent",
      opponentParticipantId: "gladiator",
      sourceFamily: "observe_relationship",
      value: 1,
    });
    const observeDb = numericEffect({
      category: "db_parry",
      id: "observe:db",
      label: "Observe Opponent",
      opponentParticipantId: "gladiator",
      sourceFamily: "observe_relationship",
      value: 1,
    });
    const parry = numericEffect({
      category: "db_parry",
      id: "parry",
      label: "Parry",
      sourceFamily: "declaration",
      value: 1,
    });
    const model = buildCombatSituationAwarenessModel({
      context: {
        opponentParticipantId: "gladiator",
        participantLabels: { gladiator: "The Gladiator" },
        phase: "phase2",
        roundNumber: 3,
      },
      rows: [
        {
          bucketKey: "situation_ob_skill",
          derivedEntries: [
            {
              application: "percentage",
              canonicalLifecycle: observeSkill,
              id: observeSkill.id,
              value: 1,
            },
          ],
          entries: [
            {
              application: "percentage",
              canonicalLifecycle: feintSkill,
              id: "row:feint:skill",
              scope: "until",
              value: -2,
            },
          ],
          label: "Skill/OB",
          total: -1,
        },
        {
          bucketKey: "situation_db",
          derivedEntries: [
            {
              application: "percentage",
              canonicalLifecycle: observeDb,
              id: observeDb.id,
              value: 1,
            },
          ],
          entries: [
            {
              application: "percentage",
              canonicalLifecycle: feintDb,
              id: "row:feint:db",
              scope: "until",
              value: -2,
            },
            {
              application: "percentage",
              canonicalLifecycle: parry,
              id: "row:parry",
              scope: "until",
              value: 1,
            },
          ],
          label: "DB/Parry",
          total: 0,
        },
      ],
    });

    expect(model.calculationGroups.map((group) => [group.label, group.totalLabel])).toEqual([
      ["Skill/OB", "-1%"],
      ["DB/Parry", "+0%"],
    ]);
    expect(model.calculationGroups.flatMap((group) => group.rows.map((row) => row.id))).toEqual([
      "feint:skill",
      "observe:skill",
      "feint:db",
      "parry",
      "observe:db",
    ]);
    expect(model.calculationGroups[1]?.rows).toHaveLength(3);
    expect(
      model.calculationGroups.flatMap((group) => group.rows).filter((row) => row.scopeLabel),
    ).toEqual([
      expect.objectContaining({ scopeLabel: "Against The Gladiator" }),
      expect.objectContaining({ scopeLabel: "Against The Gladiator" }),
    ]);
  });

  it("removes opponent-specific effects when the selected opponent changes", () => {
    const observe = numericEffect({
      category: "skill_ob",
      id: "observe:skill",
      label: "Observe Opponent",
      opponentParticipantId: "gladiator",
      sourceFamily: "observe_relationship",
      value: 1,
    });
    const model = buildCombatSituationAwarenessModel({
      context: { opponentParticipantId: "orc", phase: "phase2", roundNumber: 3 },
      lifecycleEffects: [observe],
      rows: [{ bucketKey: "situation_ob_skill", entries: [], label: "Skill/OB", total: 0 }],
    });
    expect(model.empty).toBe(true);
  });

  it("does not project later-phase rows into an earlier combat context", () => {
    const phaseTwo = numericEffect({
      category: "db_parry",
      id: "feint:phase-two",
      label: "Feint",
      value: -2,
    });
    const model = buildCombatSituationAwarenessModel({
      context: { phase: "phase1", roundNumber: 3 },
      rows: [
        {
          bucketKey: "situation_db",
          entries: [
            {
              application: "percentage",
              canonicalLifecycle: phaseTwo,
              id: "row:feint:phase-two",
              scope: "until",
              sourcePhase: "phase2",
              value: -2,
            },
          ],
          label: "DB/Parry",
          total: 0,
        },
      ],
    });

    expect(model.empty).toBe(true);
  });

  it("names persistent conditions and operational restrictions without fake values", () => {
    const model = buildCombatSituationAwarenessModel({
      context: { roundNumber: 3 },
      lifecycleEffects: [
        numericEffect({
          category: "bleed_rate",
          id: "bleed",
          label: "Bleeding",
          sourceFamily: "bleed",
          unit: "bleed_rate",
          value: 2,
        }),
        restrictionEffect({ id: "stunned", kind: "stunned", label: "Stunned" }),
        restrictionEffect({ id: "contact", kind: "continued_contact", label: "Continued Contact" }),
        restrictionEffect({ id: "unbalanced", kind: "unbalanced", label: "Unbalanced" }),
        restrictionEffect({ id: "no-action", kind: "no_combat_action", label: "No combat action" }),
      ],
      rows: [],
    });
    expect(model.conditions.map((row) => row.label)).toEqual([
      "Bleeding",
      "Continued Contact",
      "Stunned",
      "Unbalanced",
    ]);
    expect(model.conditions.find((row) => row.label === "Bleeding")?.valueLabel).toBe(
      "2/10 HP per round",
    );
    expect(model.restrictions).toEqual([
      expect.objectContaining({ label: "No combat action", valueLabel: undefined }),
    ]);
  });

  it("keeps a persistent Combat Experience contribution named and auditable", () => {
    const combatExperience = numericEffect({
      category: "general_fatigue",
      id: "ce:combat-wide",
      label: "Combat Experience",
      sourceFamily: "combat_experience",
      value: -2,
    });
    const model = buildCombatSituationAwarenessModel({
      context: { phase: "phase2", roundNumber: 3 },
      lifecycleEffects: [combatExperience],
      rows: [
        {
          bucketKey: "general",
          entries: [],
          label: "General/Fatigue",
          total: -2,
        },
      ],
    });

    expect(model.calculationGroups).toEqual([
      expect.objectContaining({
        label: "General/Fatigue",
        rows: [expect.objectContaining({ label: "Combat Experience", valueLabel: "-2%" })],
        totalLabel: "-2%",
      }),
    ]);
  });

  it("deduplicates process and durable projections by canonical effect identity", () => {
    const unbalanced = restrictionEffect({
      id: "unbalanced",
      kind: "unbalanced",
      label: "Unbalanced",
    });
    const collected = collectCanonicalCombatSituationEffects({
      combatEffects: [
        {
          canonicalLifecycle: unbalanced,
          createdAt: "2026-08-01T10:00:00.000Z",
          damage: 0,
          effectGroup: "general",
          generalDamage: 0,
          id: "unbalanced",
          sourceEventId: "event-1",
          status: "active",
          targetParticipantId: "scyrian",
          type: "general_modifier",
          updatedAt: "2026-08-01T10:00:00.000Z",
        },
      ],
      ownerParticipantId: "scyrian",
      unbalancedConditions: [
        {
          affectedParticipantId: "scyrian",
          canonicalLifecycle: unbalanced,
          establishedRound: 3,
          id: "unbalanced",
          modifierValue: -2,
          sourceActionId: "offensive_parry",
          sourceContinuedContactId: "contact-1",
          status: "active",
        },
      ],
    });
    expect(collected.map((effect) => effect.id)).toEqual(["unbalanced"]);
  });
});

type CanonicalDurationKind = CanonicalCombatModifierDuration["kind"];

/**
 * One fixture per duration kind. The `Record` key type is derived from the schema
 * union, so a new duration kind fails to compile here until a fixture exists, and
 * the schema/fixture parity test below fails at runtime for the same reason.
 */
const DURATION_FIXTURES: Record<CanonicalDurationKind, CanonicalCombatModifierDuration> = {
  attack_opportunity_count: {
    consumeOn: "resolution",
    kind: "attack_opportunity_count",
    opportunityIds: ["opportunity-1"],
    remaining: 1,
    startRound: 3,
    startSequence: 12,
  },
  indefinite: { kind: "indefinite", startRound: 3, startSequence: 12 },
  instantaneous: { kind: "instantaneous", startRound: 3, startSequence: 12 },
  legacy_untyped: { kind: "legacy_untyped", reason: "missing_duration" },
  manual: { kind: "manual", removableBy: "gm", startRound: 3, startSequence: 12 },
  phase: {
    expiresAt: "phase_boundary",
    kind: "phase",
    phase: "phase2",
    startPhase: "phase2",
    startRound: 3,
    startSequence: 12,
  },
  relationship: {
    endsWhen: "relationship_ends",
    kind: "relationship",
    relationshipId: "observe:scyrian:gladiator",
    startRound: 3,
    startSequence: 12,
  },
  remainder_of_round: { kind: "remainder_of_round", startRound: 3, startSequence: 12 },
  rounds: {
    creationRoundCounts: true,
    kind: "rounds",
    remaining: 2,
    startRound: 3,
    startSequence: 12,
    transitionBoundary: "round_boundary",
  },
  until_check: {
    check: { checkId: "check-1", checkKind: "health" },
    kind: "until_check",
    resolvesOn: "success",
    startRound: 3,
    startSequence: 12,
  },
  until_condition: {
    conditionId: "condition-1",
    conditionKind: "effect_cleared",
    kind: "until_condition",
    startRound: 3,
    startSequence: 12,
  },
};

/**
 * Kinds that intentionally render no duration chip. This set is the deliberate
 * half of the exhaustiveness contract: every other kind must render something.
 */
const DELIBERATE_BLANK_KINDS: readonly CanonicalDurationKind[] = [
  "indefinite",
  "legacy_untyped",
  "manual",
  "relationship",
];

function effectWithDuration(
  duration: CanonicalCombatModifierDuration,
): CanonicalCombatModifierEffect {
  return canonicalCombatModifierEffectSchema.parse({
    applicability: { combatWide: true, rollPurposes: [], roundNumber: 3 },
    createdAt: "2026-08-01T10:00:00.000Z",
    createdRevision: "revision-3",
    createdSequence: 12,
    id: `duration-${duration.kind}`,
    lifecycle: { duration, state: "active" },
    lineage: {},
    missingFacts: [],
    ownerParticipantId: "scyrian",
    payload: {
      category: "skill_ob",
      contributionScope: "calculation",
      kind: "numeric",
      unit: "percentage",
      value: -10,
    },
    provenanceCompleteness: "complete",
    publicLabel: "Duration probe",
    schemaVersion: 1,
    sourceFamily: "feint",
    sourceReferences: {},
    version: 1,
    visibility: { audience: "involved", sourceIdentity: "public" },
  });
}

describe("formatDuration exhaustiveness", () => {
  it("exercises every duration kind the schema declares, enumerated from the schema", () => {
    const schemaKinds = canonicalCombatModifierDurationSchema.options
      .map((option) => option.shape.kind.value)
      .sort();
    expect(Object.keys(DURATION_FIXTURES).sort()).toEqual(schemaKinds);
  });

  it("renders a non-empty label for every kind that is not a deliberate blank", () => {
    const rendered = Object.values(DURATION_FIXTURES)
      .filter((duration) => !DELIBERATE_BLANK_KINDS.includes(duration.kind))
      .map((duration) => [duration.kind, formatDuration(effectWithDuration(duration))] as const);

    for (const [kind, label] of rendered) {
      expect(label, `duration kind ${kind} rendered no label`).toBeTypeOf("string");
      expect(label, `duration kind ${kind} rendered an empty label`).not.toBe("");
    }
  });

  it("preserves the deliberate blanks rather than fabricating a duration for them", () => {
    for (const kind of DELIBERATE_BLANK_KINDS) {
      expect(formatDuration(effectWithDuration(DURATION_FIXTURES[kind])), kind).toBeUndefined();
    }
  });

  it("keeps the rendered strings for the handled kinds byte-identical", () => {
    expect(formatDuration(effectWithDuration(DURATION_FIXTURES.phase))).toBe("Phase 2");
    expect(formatDuration(effectWithDuration(DURATION_FIXTURES.rounds))).toBe("2 rounds");
    expect(formatDuration(effectWithDuration(DURATION_FIXTURES.attack_opportunity_count))).toBe(
      "1 attack",
    );
    expect(formatDuration(effectWithDuration(DURATION_FIXTURES.until_check))).toBe(
      "Check required",
    );
    expect(formatDuration(effectWithDuration(DURATION_FIXTURES.until_condition))).toBe(
      "Until cleared",
    );
  });

  it("renders remainder-only state without collapsing it into a one-round duration", () => {
    const label = formatDuration(effectWithDuration(DURATION_FIXTURES.remainder_of_round));
    expect(label).toBe("Rest of this round");
    // The distinction from `rounds` with `remaining: 1` is the reason this kind exists, so the
    // chip must not render the same text a one-round duration would.
    const oneRound = formatDuration(
      effectWithDuration({
        creationRoundCounts: true,
        kind: "rounds",
        remaining: 1,
        startRound: 3,
        startSequence: 12,
        transitionBoundary: "round_boundary",
      }),
    );
    expect(oneRound).toBe("1 round");
    expect(label).not.toBe(oneRound);
  });

  it("renders instantaneous outcomes explicitly rather than leaving the chip blank", () => {
    expect(formatDuration(effectWithDuration(DURATION_FIXTURES.instantaneous))).toBe(
      "Instantaneous",
    );
  });
});
