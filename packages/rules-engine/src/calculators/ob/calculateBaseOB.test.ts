import { describe, expect, it } from "vitest";

import { calculateBaseOB } from "./calculateBaseOB";

// Glantri Combat Workbook · Weapon 1 sheet · "OB" column formula:
// Base OB = effectiveSkillNumber (skill XP) + weaponBonus + situationalModifier
describe("calculateBaseOB", () => {
  it("sums skill and weapon bonus with no situational modifier", () => {
    // Weapon 1 · OB column · skill XP 10, weaponBonus 3, no situMod → OB 13
    expect(calculateBaseOB({ skill: 10, weaponBonus: 3 })).toBe(13);
    // Weapon 1 · OB column · skill XP 0, weaponBonus 0 → OB 0
    expect(calculateBaseOB({ skill: 0, weaponBonus: 0 })).toBe(0);
  });

  it("adds a positive situational modifier", () => {
    // Weapon 1 · OB column · skill XP 10, weaponBonus 3, situMod +2 → OB 15
    expect(calculateBaseOB({ skill: 10, weaponBonus: 3, situationalModifier: 2 })).toBe(15);
  });

  it("subtracts a negative situational modifier", () => {
    // Weapon 1 · OB column · skill XP 10, weaponBonus 3, situMod −3 → OB 10
    expect(calculateBaseOB({ skill: 10, weaponBonus: 3, situationalModifier: -3 })).toBe(10);
  });

  it("treats a missing situational modifier as zero", () => {
    expect(calculateBaseOB({ skill: 7, weaponBonus: 5 })).toBe(
      calculateBaseOB({ skill: 7, weaponBonus: 5, situationalModifier: 0 }),
    );
  });

  it("matches the basicCombatScenario weapon baseline: Training Sword baseOB 25", () => {
    // basicCombatScenario (fixtures/basicCombatScenario.ts) · Weapon 1 sheet · OB column · row 0 (skill XP 0):
    // Training Sword weaponBonus 25, skill XP 0 (level-1 combatant, no skill ranks), situMod 0 → Base OB 25
    expect(calculateBaseOB({ skill: 0, weaponBonus: 25 })).toBe(25);
  });
});
