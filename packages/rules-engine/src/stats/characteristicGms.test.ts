import { describe, expect, it } from "vitest";

import {
  getDexteritySizeModifier,
  getGlantriStatModifier,
  getWorkbookCharacterSheetGm,
} from "./characteristicGms";

describe("getGlantriStatModifier", () => {
  it("returns the correct modifier for key boundary values", () => {
    // Stat 1 → −5 (table index 0)
    expect(getGlantriStatModifier(1)).toBe(-5);
    // Stat 9 → −1
    expect(getGlantriStatModifier(9)).toBe(-1);
    // Stat 10 → 0
    expect(getGlantriStatModifier(10)).toBe(0);
    // Stat 11 → 0
    expect(getGlantriStatModifier(11)).toBe(0);
    // Stat 12 → 0
    expect(getGlantriStatModifier(12)).toBe(0);
    // Stat 17 → +3
    expect(getGlantriStatModifier(17)).toBe(3);
    // Stat 25 (last entry) → +7
    expect(getGlantriStatModifier(25)).toBe(7);
  });

  it("returns 0 for values outside the table range", () => {
    expect(getGlantriStatModifier(0)).toBe(0);
    expect(getGlantriStatModifier(26)).toBe(0);
  });
});

describe("getWorkbookCharacterSheetGm", () => {
  it("returns 0 for stat 11 (the midpoint in the workbook formula)", () => {
    expect(getWorkbookCharacterSheetGm(11)).toBe(0);
  });

  it("returns 3 for stat 17", () => {
    expect(getWorkbookCharacterSheetGm(17)).toBe(3);
  });

  it("returns -2 for stat 7", () => {
    expect(getWorkbookCharacterSheetGm(7)).toBe(-2);
  });

  it("truncates towards zero for even values", () => {
    // (16 − 11) / 2 = 2.5 → trunc → 2
    expect(getWorkbookCharacterSheetGm(16)).toBe(2);
    // (12 − 11) / 2 = 0.5 → trunc → 0
    expect(getWorkbookCharacterSheetGm(12)).toBe(0);
  });

  it("covers the basicCombatScenario level-1 strength 11 → gm 0", () => {
    // basicCombatScenario: attacker level 1. Strength 11 (average) yields GM 0.
    expect(getWorkbookCharacterSheetGm(11)).toBe(0);
  });
});

describe("getDexteritySizeModifier", () => {
  it("returns 0 for average size (10–14)", () => {
    expect(getDexteritySizeModifier(10)).toBe(0);
    expect(getDexteritySizeModifier(14)).toBe(0);
  });

  it("returns a positive value for small size (< 10)", () => {
    // siz 8: getGlantriStatModifier(8) = −1, result = −(−1) = 1
    expect(getDexteritySizeModifier(8)).toBe(1);
    // siz 5: getGlantriStatModifier(5) = −3, result = −(−3) = 3
    expect(getDexteritySizeModifier(5)).toBe(3);
  });

  it("returns a negative value for large size (> 14)", () => {
    // siz 18: getGlantriStatModifier(18) = 3, result = −(3 − 1) = −2
    expect(getDexteritySizeModifier(18)).toBe(-2);
    // siz 20: getGlantriStatModifier(20) = 4, result = −(4 − 1) = −3
    expect(getDexteritySizeModifier(20)).toBe(-3);
  });
});
