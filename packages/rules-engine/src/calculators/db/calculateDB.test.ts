import { describe, expect, it } from "vitest";

import { calculateDB } from "./calculateDB";

// Glantri Combat Workbook · Weapon 1 sheet · "DB" column formula:
// DB = dex modifier + shieldBonus + situationalModifier
describe("calculateDB", () => {
  it("returns dex plus shield bonus when no situational modifier is present", () => {
    // Weapon 1 · DB column · dex 11, shieldBonus 0, no situMod → DB 11
    expect(calculateDB({ dex: 11, shieldBonus: 0 })).toBe(11);
    // Weapon 1 · DB column · dex 11, shieldBonus 2, no situMod → DB 13
    expect(calculateDB({ dex: 11, shieldBonus: 2 })).toBe(13);
  });

  it("adds the situational modifier on top of dex and shield", () => {
    // Weapon 1 · DB column · dex 10, shieldBonus 3, situMod +2 → DB 15
    expect(calculateDB({ dex: 10, shieldBonus: 3, situationalModifier: 2 })).toBe(15);
    // Weapon 1 · DB column · dex 10, shieldBonus 0, situMod −2 → DB 8
    expect(calculateDB({ dex: 10, shieldBonus: 0, situationalModifier: -2 })).toBe(8);
  });

  it("treats a missing situational modifier as zero", () => {
    expect(calculateDB({ dex: 14, shieldBonus: 1 })).toBe(
      calculateDB({ dex: 14, shieldBonus: 1, situationalModifier: 0 }),
    );
  });

  it("matches the basicCombatScenario attacker DB baseline: dex 11, no shield, no modifier", () => {
    // basicCombatScenario (fixtures/basicCombatScenario.ts) · Weapon 1 sheet · DB column:
    // level-1 combatant, dex 11, no shield, no situMod → DB 11
    expect(calculateDB({ dex: 11, shieldBonus: 0 })).toBe(11);
  });
});
