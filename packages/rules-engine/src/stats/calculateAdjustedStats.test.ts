import { describe, expect, it } from "vitest";

import { calculateAdjustedStats } from "./calculateAdjustedStats";

describe("calculateAdjustedStats", () => {
  it("returns a copy of base stats when no modifiers are provided", () => {
    const base = { str: 12, dex: 10, con: 14 };
    expect(calculateAdjustedStats({ baseStats: base })).toEqual(base);
  });

  it("adds modifier values on top of matching base stats", () => {
    const result = calculateAdjustedStats({
      baseStats: { str: 10, dex: 11 },
      modifiers: { str: 2, dex: -1 },
    });

    expect(result.str).toBe(12);
    expect(result.dex).toBe(10);
  });

  it("leaves unmodified stats untouched", () => {
    const result = calculateAdjustedStats({
      baseStats: { str: 10, dex: 11, con: 13 },
      modifiers: { str: 1 },
    });

    expect(result.dex).toBe(11);
    expect(result.con).toBe(13);
  });

  it("treats modifiers for stats absent in base as additions from zero", () => {
    const result = calculateAdjustedStats({
      baseStats: { str: 10 },
      modifiers: { lck: 3 },
    });

    expect(result.lck).toBe(3);
    expect(result.str).toBe(10);
  });

  it("does not mutate the original baseStats object", () => {
    const base = { str: 10 };
    calculateAdjustedStats({ baseStats: base, modifiers: { str: 5 } });

    expect(base.str).toBe(10);
  });

  it("returns an identical object when modifiers is an empty record", () => {
    const base = { str: 12, dex: 9 };
    expect(calculateAdjustedStats({ baseStats: base, modifiers: {} })).toEqual(base);
  });
});
