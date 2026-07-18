import { describe, expect, it } from "vitest";

import type { ScenarioCombatModifierEntry } from "../campaign/scenario";
import {
  createCombatParticipantPairKey,
  doesCombatModifierContributionApply,
  filterApplicableCombatModifierContributions,
  isCombatModifierContributionActive,
  normalizeScenarioCombatModifierEntry,
  reduceCombatModifierContributionsByBucket,
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
      applicability: { proposalId: "proposal-1", phase: "phase2" },
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
