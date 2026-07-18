import { describe, expect, it } from "vitest";

import { formatSignedCombatModifier } from "./formatCombatModifier";

describe("formatSignedCombatModifier", () => {
  it("uses an explicit sign for positive combat modifiers", () => {
    expect(formatSignedCombatModifier(2)).toBe("+2");
  });

  it("keeps zero and negative modifiers unambiguous", () => {
    expect(formatSignedCombatModifier(0)).toBe("0");
    expect(formatSignedCombatModifier(-2)).toBe("-2");
  });
});
