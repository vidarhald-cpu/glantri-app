import { describe, expect, it } from "vitest";

import { calculateDB } from "./calculateDB";

describe("calculateDB", () => {
  it("returns dex plus shield bonus when no situational modifier is present", () => {
    expect(calculateDB({ dex: 11, shieldBonus: 0 })).toBe(11);
    expect(calculateDB({ dex: 11, shieldBonus: 2 })).toBe(13);
  });

  it("adds the situational modifier on top of dex and shield", () => {
    expect(calculateDB({ dex: 10, shieldBonus: 3, situationalModifier: 2 })).toBe(15);
    expect(calculateDB({ dex: 10, shieldBonus: 0, situationalModifier: -2 })).toBe(8);
  });

  it("treats a missing situational modifier as zero", () => {
    expect(calculateDB({ dex: 14, shieldBonus: 1 })).toBe(
      calculateDB({ dex: 14, shieldBonus: 1, situationalModifier: 0 }),
    );
  });

  it("matches the basicCombatScenario attacker DB baseline: dex 11, no shield, no modifier", () => {
    // basicCombatScenario: level-1 combatant with Training Sword (baseOB 25).
    // No shield and no situational modifier, so DB equals dex directly.
    expect(calculateDB({ dex: 11, shieldBonus: 0 })).toBe(11);
  });
});
