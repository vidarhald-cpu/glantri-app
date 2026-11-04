import { describe, expect, it } from "vitest";

import {
  resolveCombatSkillContest,
  resolveCombatSkillContestPreview,
} from "./resolveCombatSkillContest";

const roll = { dieResult: 6, openEndedD10s: [] as number[], rollD20: 6 };

describe("resolveCombatSkillContest", () => {
  it("projects the same workbook percentage path before a die is rolled", () => {
    const preview = resolveCombatSkillContestPreview({
      contestType: "movement_feint",
      governingStat: { id: "dex", label: "Dexterity", value: 16 },
      participantId: "participant-1",
      percentageContributions: [
        {
          category: "general_fatigue",
          id: "combat-experience",
          label: "Combat Experience",
          unit: "percentage",
          value: -2,
        },
      ],
      role: "movement_feint_initiator",
      skill: { id: "dodge", label: "Dodge", totalXp: 6 },
    });

    expect(preview).toMatchObject({
      baseSkill: 22,
      completeness: "complete",
      derivedIntegerAdjustment: -4,
      preDieTotal: 18,
      totalPercentageAdjustment: -2,
    });
    expect(preview).not.toHaveProperty("openEndedDie");
    expect(preview).not.toHaveProperty("finalResult");
  });

  it("uses stat plus canonical total skill XP and keeps percentage units distinct", () => {
    const result = resolveCombatSkillContest({
      calculationId: "adjust-distance:resister",
      contestType: "adjust_distance_attack",
      governingStat: { id: "dex", label: "Dexterity", value: 16 },
      participantId: "resister",
      percentageContributions: [
        {
          category: "relationship",
          id: "observe:a:b",
          label: "Observe Opponent",
          unit: "percentage",
          value: 1,
        },
      ],
      role: "resisting_opponent",
      roll,
      skill: { id: "dodge", label: "Dodge", totalXp: 6 },
    });

    expect(result).toMatchObject({
      baseSkill: 22,
      derivedIntegerAdjustment: 2,
      finalResult: 30,
      preDieTotal: 24,
      totalPercentageAdjustment: 1,
    });
    expect(result.skill.totalXp).toBe(6);
    expect(result.percentageContributions).toHaveLength(1);
  });

  it("applies all supported Skill Contest contributions through one workbook lookup", () => {
    const result = resolveCombatSkillContest({
      calculationId: "adjust-distance:all-modifiers",
      contestType: "round_end_adjust_distance",
      governingStat: { id: "dex", label: "Dexterity", value: 16 },
      participantId: "contestant",
      percentageContributions: [
        {
          category: "general_fatigue",
          id: "fatigue",
          label: "Fatigue",
          unit: "percentage",
          value: -1,
        },
        { category: "skill_ob", id: "skill", label: "Skill/OB", unit: "percentage", value: 2 },
        {
          category: "movement_mm",
          id: "movement",
          label: "Movement/MM",
          unit: "percentage",
          value: -2,
        },
        {
          category: "encumbrance",
          id: "load",
          label: "Encumbrance",
          unit: "percentage",
          value: -1,
        },
        {
          category: "gm_adjustment",
          id: "gm",
          label: "GM maneuver adjustment",
          unit: "percentage",
          value: 3,
        },
      ],
      role: "contestant",
      roll,
      skill: { id: "dodge", label: "Dodge", totalXp: 6 },
    });

    expect(result).toMatchObject({
      baseSkill: 22,
      derivedIntegerAdjustment: 2,
      finalResult: 30,
      preDieTotal: 24,
      totalPercentageAdjustment: 1,
    });
    expect(result.percentageContributions.map((entry) => entry.id)).toEqual([
      "fatigue",
      "skill",
      "movement",
      "load",
      "gm",
    ]);
  });

  it("deduplicates a canonical contribution and records unavailable rule inputs", () => {
    const duplicate = {
      category: "gm_adjustment" as const,
      id: "gm",
      label: "GM maneuver adjustment",
      unit: "percentage" as const,
      value: 1,
    };
    const result = resolveCombatSkillContest({
      calculationId: "adjust-distance:partial",
      contestType: "adjust_distance_attack",
      governingStat: { label: "Dexterity", value: 16 },
      missingContributionPoints: ["movement_mm", "encumbrance", "movement_mm"],
      participantId: "initiator",
      percentageContributions: [duplicate, duplicate],
      role: "initiator",
      roll,
      skill: { label: "Dodge", totalXp: 6 },
    });

    expect(result.completeness).toBe("partial");
    expect(result.missingContributionPoints).toEqual(["movement_mm", "encumbrance"]);
    expect(result.percentageContributions).toHaveLength(1);
    expect(result.totalPercentageAdjustment).toBe(1);
  });

  it("uses the canonical signed workbook rounding path", () => {
    const result = resolveCombatSkillContest({
      calculationId: "adjust-distance:negative",
      contestType: "adjust_distance_attack",
      governingStat: { label: "Dexterity", value: 16 },
      participantId: "initiator",
      percentageContributions: [
        {
          category: "general_fatigue",
          id: "fatigue",
          label: "Fatigue",
          unit: "percentage",
          value: -1,
        },
      ],
      role: "initiator",
      roll,
      skill: { label: "Dodge", totalXp: 6 },
    });

    expect(result).toMatchObject({
      baseSkill: 22,
      derivedIntegerAdjustment: -2,
      finalResult: 26,
      preDieTotal: 20,
      totalPercentageAdjustment: -1,
    });
  });

  it("uses identical arithmetic for attack-linked and round-end Adjust Distance", () => {
    const shared = {
      governingStat: { label: "Dexterity", value: 16 },
      participantId: "participant",
      percentageContributions: [
        {
          category: "general_fatigue" as const,
          id: "fatigue",
          label: "Fatigue",
          unit: "percentage" as const,
          value: -1,
        },
      ],
      role: "contestant" as const,
      roll,
      skill: { label: "Dodge", totalXp: 6 },
    };
    const attackLinked = resolveCombatSkillContest({
      ...shared,
      calculationId: "attack-linked",
      contestType: "adjust_distance_attack",
    });
    const roundEnd = resolveCombatSkillContest({
      ...shared,
      calculationId: "round-end",
      contestType: "round_end_adjust_distance",
    });

    expect(roundEnd).toMatchObject({
      baseSkill: attackLinked.baseSkill,
      derivedIntegerAdjustment: attackLinked.derivedIntegerAdjustment,
      finalResult: attackLinked.finalResult,
      preDieTotal: attackLinked.preDieTotal,
      totalPercentageAdjustment: attackLinked.totalPercentageAdjustment,
    });
  });

  it("#922 resolves a skill contest whose base skill is below zero", () => {
    // Product Owner ruling on #922, comment 20793. This call site throws a `RangeError` on a
    // no-answer, so a base below zero used to make the whole contest unresolvable. The base is
    // driven below zero by `baseSkillAdjustment`, and every figure asserted is the preview's own.
    const preview = resolveCombatSkillContestPreview({
      baseSkillAdjustment: -25,
      contestType: "movement_feint",
      governingStat: { id: "dex", label: "Dexterity", value: 16 },
      participantId: "participant-1",
      percentageContributions: [
        {
          category: "general_fatigue",
          id: "combat-experience",
          label: "Combat Experience",
          unit: "percentage",
          value: -4,
        },
      ],
      role: "movement_feint_initiator",
      skill: { id: "dodge", label: "Dodge", totalXp: 6 },
    });

    expect(preview.baseSkill).toBeLessThan(0);
    expect(preview.baseSkill).toBe(-3);
    expect(preview.totalPercentageAdjustment).toBe(-4);
    // One point per step below zero, not a tenth of a negative base.
    expect(preview.derivedIntegerAdjustment).toBe(-4);
    expect(preview.preDieTotal).toBe(-7);
  });
});
