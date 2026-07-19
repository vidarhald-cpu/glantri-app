import { describe, expect, it } from "vitest";

import type { ScenarioCombatModifierEntry } from "../campaign/scenario";
import {
  createCombatParticipantPairKey,
  doesCombatModifierContributionApply,
  filterApplicableCombatModifierContributions,
  isCombatModifierContributionActive,
  normalizeScenarioCombatModifierEntry,
  normalizeCombatRollAdjustment,
  reduceCombatModifierContributionsByBucket,
  resolveCombatDodgeModifiers,
  resolveCombatModifierContributions,
  sumCombatModifierContributions,
  type CombatModifierApplicability,
  type CombatModifierContribution,
  type CombatModifierResolutionContext,
} from "./combatModifierContributions";

const baseEntry: ScenarioCombatModifierEntry = {
  id: "row-1",
  scope: "until",
  value: 2,
};

function contribution(
  applicability: CombatModifierApplicability = {},
  overrides: Partial<CombatModifierContribution> = {},
): CombatModifierContribution {
  return {
    id: "contribution-1",
    schemaVersion: 1,
    ownerParticipantId: "attacker",
    sourceKind: "gm_situational",
    sourceId: "source-1",
    bucket: "skill_ob",
    value: 2,
    label: "Situational",
    applicability,
    lifetime: { kind: "encounter", status: "active" },
    editPolicy: "gm_editable",
    readOnly: false,
    ...overrides,
  };
}

function context(overrides: Partial<CombatModifierResolutionContext> = {}): CombatModifierResolutionContext {
  return {
    encounterId: "encounter-1",
    roundNumber: 1,
    ownerParticipantId: "attacker",
    ...overrides,
  };
}

describe("combat modifier contribution normalization", () => {
  it("maps imported character-effect rows to persistent source-only contributions", () => {
    const entry = normalizeScenarioCombatModifierEntry({
      bucket: "situation_db",
      entry: {
        ...baseEntry,
        id: "import:effect-1:db",
        imported: true,
        readOnly: true,
        sourceEffectId: "effect-1",
        sourceType: "character_effect",
        value: 0,
      },
      ownerParticipantId: "defender",
    });

    expect(entry).toMatchObject({
      id: "import:effect-1:db",
      ownerParticipantId: "defender",
      sourceKind: "persistent_effect",
      sourceId: "effect-1",
      bucket: "db_parry",
      value: 0,
      editPolicy: "source_only",
      readOnly: true,
      lifetime: { kind: "persistent", status: "active" },
    });
  });

  it("maps manual, generated, and Feint rows without changing their identity", () => {
    const manual = normalizeScenarioCombatModifierEntry({
      bucket: "general",
      entry: { ...baseEntry, notes: "darkness" },
      ownerParticipantId: "participant-1",
    });
    const generated = normalizeScenarioCombatModifierEntry({
      bucket: "situation_db",
      entry: {
        ...baseEntry,
        generated: true,
        id: "generated:double-attack:phase1:db",
        sourceActionId: "double_attack",
        sourcePhase: "phase1",
      },
      ownerParticipantId: "participant-1",
    });
    const feint = normalizeScenarioCombatModifierEntry({
      bucket: "situation_ob_skill",
      entry: {
        ...baseEntry,
        generated: true,
        id: "generated:feint:proposal-1:defender:phase2:ob",
        sourceProposalId: "proposal-1",
        sourceType: "feint",
        sourcePhase: "phase2",
      },
      ownerParticipantId: "defender",
    });

    expect(manual).toMatchObject({ sourceKind: "gm_situational", editPolicy: "gm_editable" });
    expect(generated).toMatchObject({
      id: "generated:double-attack:phase1:db",
      sourceKind: "action_generated",
      editPolicy: "gm_override",
      applicability: { actionId: "double_attack", phase: "phase1" },
    });
    expect(feint).toMatchObject({
      id: "generated:feint:proposal-1:defender:phase2:ob",
      sourceKind: "action_generated",
      sourceId: "proposal-1",
      applicability: { proposalId: "proposal-1", phase: "phase2", actionId: undefined },
    });
  });

  it("uses conservative defaults for unknown legacy rows", () => {
    const normalized = normalizeScenarioCombatModifierEntry({
      bucket: "situation_initiative",
      entry: { ...baseEntry, id: "legacy-row", notes: "old modifier" },
      ownerParticipantId: "participant-1",
    });

    expect(normalized).toMatchObject({
      id: "legacy-row",
      sourceKind: "gm_situational",
      sourceId: "legacy-row",
      bucket: "initiative",
      applicability: {},
      lifetime: { kind: "encounter", status: "active" },
    });
  });

  it("marks an expired row without mutating the input", () => {
    const entry = { ...baseEntry, expiresAtRound: 2 };
    const normalized = normalizeScenarioCombatModifierEntry({
      bucket: "general",
      currentRound: 3,
      entry,
      ownerParticipantId: "participant-1",
    });

    expect(normalized?.lifetime.status).toBe("expired");
    expect(entry).toEqual({ ...baseEntry, expiresAtRound: 2 });
  });

  it("safely ignores non-finite row values", () => {
    expect(
      normalizeScenarioCombatModifierEntry({
        bucket: "general",
        entry: { ...baseEntry, value: Number.NaN },
        ownerParticipantId: "participant-1",
      }),
    ).toBeUndefined();
  });
});

describe("combat modifier contribution applicability", () => {
  it("requires the owning participant", () => {
    const row = contribution();
    expect(doesCombatModifierContributionApply(row, context())).toBe(true);
    expect(
      doesCombatModifierContributionApply(row, context({ ownerParticipantId: "other" })),
    ).toBe(false);
  });

  it.each([
    ["opponentParticipantId", { opponentParticipantId: "defender" }, { opponentParticipantId: "other" }],
    ["pairKey", { pairKey: "attacker::defender" }, { pairKey: "other::defender" }],
    ["phase", { phase: "phase2" }, { phase: "phase1" }],
    ["step", { step: "phase_2_actions" }, { step: "phase_1_actions" }],
    ["proposalId", { proposalId: "proposal-1" }, { proposalId: "proposal-2" }],
    ["rollType", { rollType: "dodge" }, { rollType: "attack" }],
    ["skillId", { skillId: "dodge" }, { skillId: "weapon-skill" }],
  ] as const)("filters by %s", (_label, matching, nonMatching) => {
    const row = contribution(matching);
    expect(doesCombatModifierContributionApply(row, context(matching))).toBe(true);
    expect(doesCombatModifierContributionApply(row, context(nonMatching))).toBe(false);
  });

  it("filters by action and opportunity while leaving omitted dimensions broad", () => {
    const row = contribution({ actionId: "adjust_distance", opportunityId: "a1" });
    expect(
      doesCombatModifierContributionApply(
        row,
        context({ actionId: "adjust_distance", opportunityId: "a1" }),
      ),
    ).toBe(true);
    expect(
      doesCombatModifierContributionApply(
        row,
        context({ actionId: "adjust_distance", opportunityId: "a2" }),
      ),
    ).toBe(false);
    expect(doesCombatModifierContributionApply(contribution(), context({ opponentParticipantId: "any" }))).toBe(true);
  });

  it("requires context provenance for encounter-scoped rows", () => {
    const row = contribution({}, { sourceEncounterId: "encounter-1" });
    expect(doesCombatModifierContributionApply(row, context())).toBe(true);
    expect(
      doesCombatModifierContributionApply(row, context({ encounterId: "encounter-2" })),
    ).toBe(false);
  });

  it.each(["pending", "expired", "resolved", "removed"] as const)(
    "does not apply %s contributions",
    (status) => {
      const row = contribution({}, { lifetime: { kind: "encounter", status } });
      expect(isCombatModifierContributionActive(row)).toBe(false);
      expect(doesCombatModifierContributionApply(row, context())).toBe(false);
    },
  );

  it("honors round and phase expiry", () => {
    const roundRow = contribution({}, {
      lifetime: { kind: "round", status: "active", sourceRoundNumber: 2 },
    });
    expect(doesCombatModifierContributionApply(roundRow, context({ roundNumber: 2 }))).toBe(true);
    expect(doesCombatModifierContributionApply(roundRow, context({ roundNumber: 3 }))).toBe(false);

    const phaseRow = contribution({}, {
      lifetime: { kind: "phase", status: "active", expiresAfterPhase: "phase1" },
    });
    expect(doesCombatModifierContributionApply(phaseRow, context({ phase: "phase1" }))).toBe(true);
    expect(doesCombatModifierContributionApply(phaseRow, context({ phase: "phase2" }))).toBe(false);

    const roundExpiry = contribution({}, {
      lifetime: { kind: "encounter", status: "active", expiresAtRound: 2 },
    });
    expect(doesCombatModifierContributionApply(roundExpiry, context({ roundNumber: 2 }))).toBe(true);
    expect(doesCombatModifierContributionApply(roundExpiry, context({ roundNumber: 3 }))).toBe(false);
    expect(isCombatModifierContributionActive(roundExpiry, context({ roundNumber: 3 }))).toBe(false);
  });

  it("activates strictly after a sequence and excludes its simultaneous group", () => {
    const row = contribution({ activatesAfterSequence: 4, simultaneousGroupId: "group-1" });
    expect(
      doesCombatModifierContributionApply(row, context({ initiativeSequence: 4 })),
    ).toBe(false);
    expect(
      doesCombatModifierContributionApply(row, context({ initiativeSequence: 5 })),
    ).toBe(true);
    expect(
      doesCombatModifierContributionApply(
        row,
        context({ initiativeSequence: 5, simultaneousGroupId: "group-1" }),
      ),
    ).toBe(false);
  });

  it("retains zero-valued contributions and reduces deterministically by bucket", () => {
    const rows = [
      contribution({}, { id: "zero", value: 0, bucket: "db_parry" }),
      contribution({}, { id: "general", value: -1, bucket: "general_fatigue" }),
      contribution({}, { id: "initiative", value: 3, bucket: "initiative" }),
      contribution({}, { id: "skill", value: 2, bucket: "skill_ob" }),
    ];

    expect(filterApplicableCombatModifierContributions(rows, context())).toHaveLength(4);
    expect(sumCombatModifierContributions(rows)).toBe(4);
    expect(reduceCombatModifierContributionsByBucket(rows)).toEqual({
      db_parry: 0,
      general_fatigue: -1,
      initiative: 3,
      skill_ob: 2,
    });
  });

  it("resolves one initiative bucket with the same applicability and lifetime rules", () => {
    const rows: CombatModifierContribution[] = [
      contribution({}, { id: "manual", bucket: "initiative", value: 2 }),
      contribution(
        { phase: "phase1" },
        { id: "generated-phase1", bucket: "initiative", value: 3 },
      ),
      contribution(
        { phase: "phase2" },
        { id: "generated-phase2", bucket: "initiative", value: 20 },
      ),
      contribution(
        {},
        {
          id: "expired",
          bucket: "initiative",
          lifetime: { kind: "round", status: "active", expiresAtRound: 1 },
          value: 50,
        },
      ),
      contribution(
        {},
        {
          id: "inactive",
          bucket: "initiative",
          lifetime: { kind: "encounter", status: "removed" },
        },
      ),
      contribution({}, { id: "zero", bucket: "initiative", value: 0 }),
      contribution({}, { id: "other-bucket", bucket: "skill_ob", value: 99 }),
    ];

    const resolution = resolveCombatModifierContributions({
      bucket: "initiative",
      context: context({
        phase: "phase1",
        roundNumber: 2,
        step: "initiative_phase_1",
      }),
      contributions: rows,
    });

    expect(resolution.bucket).toBe("initiative");
    expect(resolution.rows.map((row) => row.id)).toEqual([
      "manual",
      "generated-phase1",
      "zero",
    ]);
    expect(resolution.total).toBe(5);
  });

  it("resolves relational DB/parry contributions for the exact defender and attack", () => {
    const pairKey = createCombatParticipantPairKey("defender", "attacker-a");
    const rows: CombatModifierContribution[] = [
      contribution({}, { id: "broad", ownerParticipantId: "defender", bucket: "db_parry", value: 1 }),
      contribution(
        { opponentParticipantId: "attacker-a" },
        { id: "attacker-a", ownerParticipantId: "defender", bucket: "db_parry", value: 2 },
      ),
      contribution(
        { opponentParticipantId: "attacker-b" },
        { id: "attacker-b", ownerParticipantId: "defender", bucket: "db_parry", value: 20 },
      ),
      contribution(
        { pairKey, phase: "phase2", opportunityId: "attack-2", proposalId: "proposal-1" },
        { id: "scoped", ownerParticipantId: "defender", bucket: "db_parry", value: 3 },
      ),
    ];

    const resolution = resolveCombatModifierContributions({
      bucket: "db_parry",
      context: context({
        opponentParticipantId: "attacker-a",
        ownerParticipantId: "defender",
        pairKey,
        phase: "phase2",
        opportunityId: "attack-2",
        proposalId: "proposal-1",
      }),
      contributions: rows,
    });

    expect(resolution.rows.map((row) => row.id)).toEqual(["broad", "attacker-a", "scoped"]);
    expect(resolution.total).toBe(6);
  });

  it("resolves the attack Skill/OB bucket with the complete relational context", () => {
    const pairKey = createCombatParticipantPairKey("attacker", "defender-a");
    const rows: CombatModifierContribution[] = [
      contribution({}, { id: "broad", value: 1 }),
      contribution(
        { opponentParticipantId: "defender-a" },
        { id: "defender-a", value: 2 },
      ),
      contribution(
        { opponentParticipantId: "defender-b" },
        { id: "defender-b", value: 50 },
      ),
      contribution(
        { pairKey },
        { id: "pair", value: 3 },
      ),
      contribution(
        { phase: "phase1" },
        { id: "phase1", value: 4 },
      ),
      contribution(
        { opportunityId: "attack-1" },
        { id: "opportunity", value: 5 },
      ),
      contribution(
        { proposalId: "proposal-1" },
        { id: "proposal", value: 6 },
      ),
      contribution(
        { rollType: "attack" },
        { id: "roll-type", value: 7 },
      ),
      contribution(
        { skillId: "long-sword" },
        { id: "skill", value: 8 },
      ),
    ];

    const resolution = resolveCombatModifierContributions({
      bucket: "skill_ob",
      context: context({
        opponentParticipantId: "defender-a",
        pairKey,
        phase: "phase1",
        opportunityId: "attack-1",
        proposalId: "proposal-1",
        rollType: "attack",
        skillId: "long-sword",
      }),
      contributions: rows,
    });

    expect(resolution.rows.map((row) => row.id)).toEqual([
      "broad",
      "defender-a",
      "pair",
      "phase1",
      "opportunity",
      "proposal",
      "roll-type",
      "skill",
    ]);
    expect(resolution.total).toBe(36);
  });

  it("keeps defender-owned generated rows in the defensive action context", () => {
    const generatedDefenderRow = normalizeScenarioCombatModifierEntry({
      bucket: "situation_db",
      entry: {
        ...baseEntry,
        generated: true,
        id: "generated:double-attack:phase1:db",
        sourceActionId: "double_attack",
        sourcePhase: "phase1",
        value: -4,
      },
      ownerParticipantId: "defender",
    });
    const feintDefenderRow = normalizeScenarioCombatModifierEntry({
      bucket: "situation_db",
      entry: {
        ...baseEntry,
        generated: true,
        id: "generated:feint:proposal-1:defender:phase2:db",
        sourceActionId: "feint_attack",
        sourcePhase: "phase2",
        sourceProposalId: "proposal-1",
        sourceType: "feint",
        value: -2,
      },
      ownerParticipantId: "defender",
    });

    expect(generatedDefenderRow).toBeDefined();
    expect(feintDefenderRow).toBeDefined();

    const resolution = resolveCombatModifierContributions({
      bucket: "db_parry",
      context: context({
        actionId: "double_attack",
        ownerParticipantId: "defender",
        phase: "phase1",
      }),
      contributions: [generatedDefenderRow!, feintDefenderRow!],
    });

    expect(resolution.rows.map((row) => row.id)).toEqual([
      "generated:double-attack:phase1:db",
    ]);

    const feintResolution = resolveCombatModifierContributions({
      bucket: "db_parry",
      context: context({
        actionId: "attack_parry",
        ownerParticipantId: "defender",
        phase: "phase2",
        proposalId: "proposal-1",
      }),
      contributions: [generatedDefenderRow!, feintDefenderRow!],
    });

    expect(feintResolution.rows.map((row) => row.id)).toEqual([
      "generated:feint:proposal-1:defender:phase2:db",
    ]);
  });
});

describe("combat Dodge modifier resolution", () => {
  it("combines supported Dodge buckets while retaining bucket totals and order", () => {
    const rows = [
      contribution({}, { id: "skill", bucket: "skill_ob", value: 2 }),
      contribution({}, { id: "general", bucket: "general_fatigue", value: -1 }),
      contribution({}, { id: "zero", bucket: "skill_ob", value: 0 }),
    ];

    const resolution = resolveCombatDodgeModifiers({
      context: context({ skillId: "dodge", rollType: "adjust_distance_dodge" }),
      contributions: rows,
    });

    expect(resolution.total).toBe(1);
    expect(resolution.bucketResolutions).toMatchObject([
      { bucket: "general_fatigue", total: -1, rows: [{ id: "general" }] },
      { bucket: "skill_ob", total: 2, rows: [{ id: "skill" }, { id: "zero" }] },
    ]);
    expect(resolution.rows.map((row) => row.id)).toEqual(["general", "skill", "zero"]);
  });

  it("filters Dodge-specific and relational rows before resolving", () => {
    const pairKey = createCombatParticipantPairKey("attacker", "defender");
    const rows = [
      contribution({ skillId: "dodge", rollType: "feint_dodge" }, { id: "dodge", value: 2 }),
      contribution({ skillId: "parry" }, { id: "other-skill", value: 4 }),
      contribution({ opponentParticipantId: "other" }, { id: "other-opponent", value: 8 }),
      contribution({ pairKey }, { id: "pair", value: 3 }),
    ];

    const resolution = resolveCombatDodgeModifiers({
      context: context({
        opponentParticipantId: "defender",
        pairKey,
        rollType: "feint_dodge",
        skillId: "dodge",
      }),
      contributions: rows,
    });

    expect(resolution.total).toBe(5);
    expect(resolution.rows.map((row) => row.id)).toEqual(["dodge", "pair"]);
  });

  it("normalizes a deterministic proposal-scoped roll adjustment", () => {
    const pairKey = createCombatParticipantPairKey("attacker", "defender");
    const adjustment = normalizeCombatRollAdjustment({
      encounterId: "encounter-1",
      ownerParticipantId: "attacker",
      opponentParticipantId: "defender",
      pairKey,
      phase: "phase1",
      step: "phase_1_actions",
      actionId: "adjust_range_attack",
      opportunityId: "a1-opportunity",
      proposalId: "proposal-1",
      rollType: "adjust_distance_dodge",
      roundNumber: 2,
      value: -3,
      notes: "footing",
    });

    expect(adjustment).toMatchObject({
      id: "roll-adjustment:proposal-1:attacker:adjust_distance_dodge",
      sourceKind: "roll_adjustment",
      sourceProposalId: "proposal-1",
      bucket: "general_fatigue",
      value: -3,
      applicability: {
        opponentParticipantId: "defender",
        pairKey,
        proposalId: "proposal-1",
        rollType: "adjust_distance_dodge",
        skillId: "dodge",
      },
      lifetime: { kind: "roll", status: "active", sourceRoundNumber: 2 },
    });
  });

  it("does not apply a roll adjustment to another proposal or participant", () => {
    const adjustment = normalizeCombatRollAdjustment({
      ownerParticipantId: "attacker",
      opponentParticipantId: "defender",
      proposalId: "proposal-1",
      rollType: "adjust_distance_dodge",
      value: 2,
    });
    expect(adjustment).toBeDefined();

    const contributions = [adjustment!];
    expect(
      resolveCombatDodgeModifiers({
        context: context({
          ownerParticipantId: "attacker",
          opponentParticipantId: "defender",
          proposalId: "proposal-2",
          rollType: "adjust_distance_dodge",
          skillId: "dodge",
        }),
        contributions,
      }).total,
    ).toBe(0);
    expect(
      resolveCombatDodgeModifiers({
        context: context({
          ownerParticipantId: "other",
          opponentParticipantId: "defender",
          proposalId: "proposal-1",
          rollType: "adjust_distance_dodge",
          skillId: "dodge",
        }),
        contributions,
      }).total,
    ).toBe(0);
  });

  it("consumes a duplicated roll-local projection only once", () => {
    const adjustment = normalizeCombatRollAdjustment({
      ownerParticipantId: "attacker",
      proposalId: "proposal-1",
      rollType: "adjust_distance_dodge",
      value: 2,
    });
    expect(adjustment).toBeDefined();

    const resolution = resolveCombatDodgeModifiers({
      context: context({
        ownerParticipantId: "attacker",
        proposalId: "proposal-1",
        rollType: "adjust_distance_dodge",
        skillId: "dodge",
      }),
      contributions: [adjustment!],
      rollAdjustments: [adjustment!],
    });

    expect(resolution.total).toBe(2);
    expect(resolution.rows.map((row) => row.id)).toEqual([adjustment!.id]);
  });
});

describe("combat modifier participant pair key", () => {
  it("is symmetric and deterministic", () => {
    expect(createCombatParticipantPairKey("b", "a")).toBe("a::b");
    expect(createCombatParticipantPairKey("a", "b")).toBe("a::b");
  });

  it("rejects blank and self pairs", () => {
    expect(() => createCombatParticipantPairKey("", "b")).toThrow();
    expect(() => createCombatParticipantPairKey("a", "a")).toThrow();
  });
});
