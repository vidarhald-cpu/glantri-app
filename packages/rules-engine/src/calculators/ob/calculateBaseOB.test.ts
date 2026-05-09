import { describe, expect, it } from "vitest";

import { calculateBaseOB } from "./calculateBaseOB";

describe("calculateBaseOB", () => {
  it("sums skill and weapon bonus with no situational modifier", () => {
    expect(calculateBaseOB({ skill: 10, weaponBonus: 3 })).toBe(13);
    expect(calculateBaseOB({ skill: 0, weaponBonus: 0 })).toBe(0);
  });

  it("adds a positive situational modifier", () => {
    expect(calculateBaseOB({ skill: 10, weaponBonus: 3, situationalModifier: 2 })).toBe(15);
  });

  it("subtracts a negative situational modifier", () => {
    expect(calculateBaseOB({ skill: 10, weaponBonus: 3, situationalModifier: -3 })).toBe(10);
  });

  it("treats a missing situational modifier as zero", () => {
    expect(calculateBaseOB({ skill: 7, weaponBonus: 5 })).toBe(
      calculateBaseOB({ skill: 7, weaponBonus: 5, situationalModifier: 0 }),
    );
  });

  it("matches the basicCombatScenario weapon baseline: Training Sword baseOB 25", () => {
    // basicCombatScenario weapon has baseOB 25.  With skill 0 and weaponBonus 25
    // and no situational modifier the result must be 25.
    expect(calculateBaseOB({ skill: 0, weaponBonus: 25 })).toBe(25);
  });
});
