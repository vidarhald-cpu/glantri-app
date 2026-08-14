import { describe, expect, it } from "vitest";

import { resolveGenericCombatActionRoll } from "./resolveGenericCombatActionRoll";

const rolledAt = "2026-08-14T18:00:00.000Z";

describe("resolveGenericCombatActionRoll", () => {
  it("uses canonical Skill total semantics with numeric Difficulty", () => {
    expect(
      resolveGenericCombatActionRoll({
        request: {
          basis: {
            avgStats: 14,
            baseValue: 21,
            derivedXp: 1,
            groupXp: 4,
            kind: "skill",
            skillId: "perception",
            skillLabel: "Perception",
            skillXp: 2,
            unknownSkillPenalty: 0,
          },
          difficulty: 26,
        },
        roll: { dieResult: 8, openEndedD10s: [], rollD20: 8 },
        rolledAt,
      }),
    ).toMatchObject({
      achievedLevelLabel: "Medium",
      finalTotal: 29,
      success: true,
    });
  });

  it("uses Current Stat/open-ended d20 semantics without Skill XP", () => {
    expect(
      resolveGenericCombatActionRoll({
        request: {
          basis: {
            baseValue: 12,
            kind: "stat",
            statId: "con",
            statLabel: "Constitution",
          },
          difficulty: 20,
        },
        roll: { dieResult: 8, openEndedD10s: [], rollD20: 8 },
        rolledAt,
      }),
    ).toMatchObject({
      achievedLevelLabel: "Medium -",
      finalTotal: 20,
      success: true,
    });
  });
});
