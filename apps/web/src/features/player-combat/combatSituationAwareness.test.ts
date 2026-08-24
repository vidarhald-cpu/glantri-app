import { describe, expect, it } from "vitest";

import {
  canonicalCombatModifierEffectSchema,
  type CanonicalCombatModifierEffect,
} from "@glantri/domain";

import {
  buildCombatSituationAwarenessModel,
  collectCanonicalCombatSituationEffects,
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
