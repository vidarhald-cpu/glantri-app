import { describe, expect, it } from "vitest";

import { calculateParryValue } from "./calculateParryValue";

// Glantri Combat Workbook · Weapon 1 sheet · "Parry" column formula:
// Parry = allocatedOb + parryModifier
describe("calculateParryValue", () => {
  it("returns allocated OB when no parry modifier is given", () => {
    // Weapon 1 · Parry column · allocatedOb 15, no parryMod → Parry 15
    expect(calculateParryValue({ allocatedOb: 15 })).toBe(15);
    // Weapon 1 · Parry column · allocatedOb 0, no parryMod → Parry 0
    expect(calculateParryValue({ allocatedOb: 0 })).toBe(0);
  });

  it("adds a positive parry modifier to allocated OB", () => {
    // Weapon 1 · Parry column · allocatedOb 10, parryMod +5 → Parry 15
    expect(calculateParryValue({ allocatedOb: 10, parryModifier: 5 })).toBe(15);
  });

  it("subtracts a negative parry modifier from allocated OB", () => {
    // Weapon 1 · Parry column · allocatedOb 10, parryMod −3 → Parry 7
    expect(calculateParryValue({ allocatedOb: 10, parryModifier: -3 })).toBe(7);
  });

  it("treats a missing parry modifier as zero", () => {
    expect(calculateParryValue({ allocatedOb: 20 })).toBe(
      calculateParryValue({ allocatedOb: 20, parryModifier: 0 }),
    );
  });

  it("produces the composeDefenseValues parry for the basicCombatScenario (allocatedOb 35, no modifier)", () => {
    // basicCombatScenario (fixtures/basicCombatScenario.ts) · Weapon 1 sheet · Parry column:
    // Training Sword weaponParryModifier 0, full availableOb 35 allocated to parry → Parry 35
    expect(calculateParryValue({ allocatedOb: 35, parryModifier: 0 })).toBe(35);
  });
});
