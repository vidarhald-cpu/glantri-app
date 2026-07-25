import { describe, expect, it } from "vitest";

import { deriveParryPrimaryActionModifier } from "./deriveParryPrimaryActionModifier";

describe("deriveParryPrimaryActionModifier", () => {
  it.each([
    [17, 3],
    [15, 3],
    [14, 2],
  ])("derives floor(%i / 5) as a percentage modifier", (dodge, expected) => {
    expect(deriveParryPrimaryActionModifier(dodge)).toEqual({
      dodgeSkillValue: dodge,
      percentageModifier: expected,
      roundingRule: "floor_one_fifth",
    });
  });

  it("rejects values that cannot be canonical Dodge skill totals", () => {
    expect(() => deriveParryPrimaryActionModifier(-1)).toThrow(
      "Parry requires a non-negative whole-number Dodge skill.",
    );
    expect(() => deriveParryPrimaryActionModifier(3.5)).toThrow(
      "Parry requires a non-negative whole-number Dodge skill.",
    );
  });
});
