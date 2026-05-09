import { describe, expect, it } from "vitest";

import { calculateParryValue } from "./calculateParryValue";

describe("calculateParryValue", () => {
  it("returns allocated OB when no parry modifier is given", () => {
    expect(calculateParryValue({ allocatedOb: 15 })).toBe(15);
    expect(calculateParryValue({ allocatedOb: 0 })).toBe(0);
  });

  it("adds a positive parry modifier to allocated OB", () => {
    expect(calculateParryValue({ allocatedOb: 10, parryModifier: 5 })).toBe(15);
  });

  it("subtracts a negative parry modifier from allocated OB", () => {
    expect(calculateParryValue({ allocatedOb: 10, parryModifier: -3 })).toBe(7);
  });

  it("treats a missing parry modifier as zero", () => {
    expect(calculateParryValue({ allocatedOb: 20 })).toBe(
      calculateParryValue({ allocatedOb: 20, parryModifier: 0 }),
    );
  });

  it("produces the composeDefenseValues parry for the basicCombatScenario (allocatedOb 35, no modifier)", () => {
    // basicCombatScenario: availableOb 35, weaponParryModifier 0.
    // When the allocation is pending the caller adds availableOb as allocatedOb.
    expect(calculateParryValue({ allocatedOb: 35, parryModifier: 0 })).toBe(35);
  });
});
