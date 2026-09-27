import { describe, expect, it } from "vitest";

import { calculateGms } from "./calculateGms";
import { calculateGroupLevel } from "./calculateGroupLevel";
import { calculateSkillLevel } from "./calculateSkillLevel";
import { calculateSpecializationLevel } from "./calculateSpecializationLevel";

describe("calculateGms", () => {
  it("returns ranks when no bonuses are present", () => {
    expect(calculateGms({ ranks: 5 })).toBe(5);
    expect(calculateGms({ ranks: 0 })).toBe(0);
  });

  it("adds stat and profession bonuses to ranks", () => {
    expect(calculateGms({ ranks: 3, statBonus: 2, professionBonus: 1 })).toBe(6);
  });

  it("treats absent bonuses as zero", () => {
    expect(calculateGms({ ranks: 4, statBonus: 2 })).toBe(6);
    expect(calculateGms({ ranks: 4, professionBonus: 3 })).toBe(7);
  });

  it("handles negative bonuses", () => {
    expect(calculateGms({ ranks: 5, statBonus: -2 })).toBe(3);
  });
});

describe("calculateGroupLevel", () => {
  it("returns ranks when no gms modifier is given", () => {
    expect(calculateGroupLevel({ ranks: 7 })).toBe(7);
    expect(calculateGroupLevel({ ranks: 0 })).toBe(0);
  });

  it("adds gms to ranks", () => {
    expect(calculateGroupLevel({ ranks: 4, gms: 3 })).toBe(7);
  });

  it("handles negative gms", () => {
    expect(calculateGroupLevel({ ranks: 5, gms: -1 })).toBe(4);
  });

  it("treats missing gms as zero", () => {
    expect(calculateGroupLevel({ ranks: 6 })).toBe(calculateGroupLevel({ ranks: 6, gms: 0 }));
  });
});

// Glantri Character Sheet Workbook · Skills sheet · "Eff. Skill No." column formula:
// effectiveSkillNumber = bestGroupLevel + directSkillRanks + directSkillGms
describe("calculateSkillLevel", () => {
  it("sums group level, ranks, and gms", () => {
    expect(calculateSkillLevel({ groupLevel: 3, ranks: 2, gms: 1 })).toBe(6);
  });

  it("returns group level plus ranks when gms is absent", () => {
    expect(calculateSkillLevel({ groupLevel: 5, ranks: 2 })).toBe(7);
  });

  it("handles zero ranks and zero gms", () => {
    expect(calculateSkillLevel({ groupLevel: 4, ranks: 0, gms: 0 })).toBe(4);
  });

  it("handles negative gms (penalty)", () => {
    expect(calculateSkillLevel({ groupLevel: 6, ranks: 3, gms: -2 })).toBe(7);
  });

  it("effectiveSkillNumber includes group-derived contribution alongside direct skill ranks", () => {
    // Character Sheet · Skills sheet · "Eff. Skill No." column:
    // Weapon Group has 8 ranks + gms 0 → groupLevel 8 (via calculateGroupLevel).
    // Sword (direct): ranks 5, gms 1.
    // effectiveSkillNumber = 8 (group) + 5 (direct ranks) + 1 (direct gms) = 14
    const groupLevel = calculateGroupLevel({ ranks: 8, gms: 0 });
    expect(calculateSkillLevel({ groupLevel, ranks: 5, gms: 1 })).toBe(14);
  });

  it("effectiveSkillNumber equals groupLevel when skill has no direct ranks (pure group-derived)", () => {
    // Character Sheet · Skills sheet · "Eff. Skill No." column:
    // Combat Group has 10 ranks + gms 2 → groupLevel 12 (via calculateGroupLevel).
    // Brawling (direct): ranks 0, gms 0 — skill XP comes entirely from the group.
    // effectiveSkillNumber = 12 (group) + 0 + 0 = 12
    const groupLevel = calculateGroupLevel({ ranks: 10, gms: 2 });
    expect(calculateSkillLevel({ groupLevel, ranks: 0, gms: 0 })).toBe(12);
  });
});

describe("calculateSpecializationLevel", () => {
  // Rule decision 0010 ruling 3 clauses 1, 4, 5 and 6: Group cost and Group XP apply to a
  // Learning Group's base Skills. A Specialization the Group teaches is acquired and
  // progressed separately, receives no retroactive Group-XP catch-up, and gains nothing from
  // further Group purchases. No Learning Group level is therefore an input to this value, and
  // the function deliberately does not accept one.
  it("is the Character's own Specialization XP, with no Learning Group term", () => {
    expect(calculateSpecializationLevel({ ownedSpecializationXp: 3 })).toBe(3);
    expect(calculateSpecializationLevel({ ownedSpecializationXp: 0 })).toBe(0);
  });

  // Ruling 3 clause 7: relationships establish non-additive minima. The shared calculation in
  // `deriveSkillRelationships` resolves the minimum into the shortfall that tops owned XP up to
  // the floor, so the two terms compose without a second local formula and without stacking.
  it("carries the non-additive relationship minimum supplied by the shared calculation", () => {
    expect(
      calculateSpecializationLevel({ ownedSpecializationXp: 1, relationshipGrantedXp: 4 }),
    ).toBe(5);
    expect(
      calculateSpecializationLevel({ ownedSpecializationXp: 5, relationshipGrantedXp: 0 }),
    ).toBe(5);
  });

  it("returns 0 when nothing is owned and nothing is granted", () => {
    expect(
      calculateSpecializationLevel({ ownedSpecializationXp: 0, relationshipGrantedXp: 0 }),
    ).toBe(0);
  });
});
