import { describe, expect, it } from "vitest";

import {
  COMBAT_BREAK_OFF_RESULT_TABLE,
  resolveCombatBreakOffProposal,
  resolveCombatBreakOffTable,
} from "./combatBreakOff";

describe("Break Off Engagement source table (merged_3968_3980.pdf pp. 9–10)", () => {
  it.each([
    [-100, "defender_minus_21_or_less", false, 0, -4],
    [-21, "defender_minus_21_or_less", false, 0, -4],
    [-20, "defender_minus_16_to_minus_20", false, 0, -3],
    [-16, "defender_minus_16_to_minus_20", false, 0, -3],
    [-15, "defender_minus_11_to_minus_15", false, 0, -2],
    [-11, "defender_minus_11_to_minus_15", false, 0, -2],
    [-10, "defender_minus_10_to_0", false, 0, 0],
    [0, "defender_minus_10_to_0", false, 0, 0],
    [1, "defender_1_to_5", true, 0, 0],
    [5, "defender_1_to_5", true, 0, 0],
    [6, "defender_6_to_10", true, -1, 0],
    [10, "defender_6_to_10", true, -1, 0],
    [11, "defender_11_to_15", true, -2, 0],
    [15, "defender_11_to_15", true, -2, 0],
    [16, "defender_16_to_20", true, -3, 0],
    [20, "defender_16_to_20", true, -3, 0],
    [21, "defender_21_or_more", true, -4, 0],
    [100, "defender_21_or_more", true, -4, 0],
  ] as const)(
    "maps difference %i to %s",
    (difference, id, escaped, attackerObModifier, defenderDbParryModifier) => {
      expect(resolveCombatBreakOffTable(difference)).toMatchObject({
        attackerObModifier,
        defenderDbParryModifier,
        escaped,
        id,
      });
    },
  );

  it("has continuous, non-overlapping integer boundaries", () => {
    expect(COMBAT_BREAK_OFF_RESULT_TABLE).toHaveLength(9);
    for (let difference = -1000; difference <= 1000; difference += 1) {
      expect(() => resolveCombatBreakOffTable(difference)).not.toThrow();
    }
  });

  it("uses escapee minus attacker and treats only positive differences as escape", () => {
    expect(resolveCombatBreakOffProposal({ attackerTotal: 24, escapeeTotal: 24 })).toMatchObject({
      difference: 0,
      result: { escaped: false, tableRowId: "defender_minus_10_to_0" },
    });
    expect(resolveCombatBreakOffProposal({ attackerTotal: 24, escapeeTotal: 25 })).toMatchObject({
      difference: 1,
      result: { escaped: true, tableRowId: "defender_1_to_5" },
    });
  });
});
