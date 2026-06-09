import { describe, expect, it } from "vitest";

import {
  COMBAT_TO_HIT_RULE_TABLE,
  calculateToHitLookupTotal,
  lookupCombatToHitDamageMetadata,
  lookupCombatToHitResult,
  rollOpenEndedCombatToHitD20,
  resolveCombatToHit,
} from "./toHitTable";

describe("combat to-hit table helpers", () => {
  it("documents the updated workbook source sheet and range", () => {
    expect(COMBAT_TO_HIT_RULE_TABLE).toMatchObject({
      id: "combat-to-hit",
      source: {
        range: "A1:I32",
        sheet: "to hit (new)",
        workbook: "docs/source/combat/New_Combat_Arena.xlsx",
      },
      title: "Combat To Hit",
    });
    expect(COMBAT_TO_HIT_RULE_TABLE.notes.join(" ")).toContain("Legacy workbook sheet `To Hit table` is not canonical");
    expect(COMBAT_TO_HIT_RULE_TABLE.notes.join(" ")).toContain("Lookup totals 17 and 18 have duplicate damage rows");
  });

  it("resolves OB = DB and roll total 10 as a miss", () => {
    expect(calculateToHitLookupTotal({ db: 12, ob: 12, rollTotal: 10 })).toBe(10);
    expect(resolveCombatToHit({ db: 12, ob: 12, rollTotal: 10 })).toMatchObject({
      grazing: false,
      hit: false,
      lookupTotal: 10,
      resultKey: "miss",
      resultLabel: "Miss",
    });
    expect(lookupCombatToHitDamageMetadata(10)).toBeUndefined();
  });

  it("resolves OB = DB and roll total 11 as a grazing hit", () => {
    expect(resolveCombatToHit({ db: 12, ob: 12, rollTotal: 11 })).toMatchObject({
      grazing: true,
      hit: true,
      lookupTotal: 11,
      resultKey: "grazing-hit",
      resultLabel: "Grazing hit",
    });
    expect(() => lookupCombatToHitDamageMetadata(11)).toThrow(/Grazing damage/);
  });

  it("resolves OB 9, DB 11, roll total 18 as a hit", () => {
    expect(resolveCombatToHit({ db: 11, ob: 9, rollTotal: 18 })).toMatchObject({
      grazing: false,
      hit: true,
      lookupTotal: 16,
      resultKey: "hit",
      resultLabel: "Hit",
    });
  });

  it("rejects non-integer roll totals", () => {
    expect(() => resolveCombatToHit({ db: 0, ob: 0, rollTotal: 10.5 })).toThrow(RangeError);
  });

  it("rolls an open-ended combat to-hit d20 using the skill-roll convention", () => {
    const rolls = [(20 - 0.5) / 20, (10 - 0.5) / 10, (3 - 0.5) / 10];

    expect(rollOpenEndedCombatToHitD20(() => rolls.shift() ?? 0.5)).toEqual({
      dieResult: 33,
      openEndedD10s: [10, 3],
      rollD20: 20,
      rollTotal: 33,
    });
  });

  it("uses open-ended roll totals in lookup totals", () => {
    expect(resolveCombatToHit({ db: 11, ob: 9, rollTotal: 33 })).toMatchObject({
      hit: true,
      lookupTotal: 31,
      resultKey: "hit",
    });
  });

  it("returns damage metadata for unambiguous hit rows", () => {
    expect(lookupCombatToHitDamageMetadata(12)).toEqual({
      damageModifier: 1,
      sourceRows: ["to hit (new)!A6:E6"],
    });
    expect(lookupCombatToHitDamageMetadata(16)).toEqual({
      damageModifier: 3,
      sourceRows: ["to hit (new)!A10:E10"],
    });
    expect(lookupCombatToHitDamageMetadata(19)).toEqual({
      criticalGrade: "a",
      damageModifier: 8,
      sourceRows: ["to hit (new)!A15:F15"],
    });
    expect(lookupCombatToHitDamageMetadata(20)).toEqual({
      criticalGrade: "b",
      damageModifier: 9,
      minDamage: 1,
      sourceRows: ["to hit (new)!A16:G16"],
    });
    expect(lookupCombatToHitDamageMetadata(33)).toEqual({
      criticalGrade: "f",
      damageModifier: 22,
      minDamage: 5,
      sourceRows: ["to hit (new)!A29:G29"],
    });
  });

  it("does not let duplicate 17/18 damage rows affect hit classification and rejects their damage metadata", () => {
    expect(lookupCombatToHitResult(17)).toMatchObject({
      grazing: false,
      hit: true,
      resultKey: "hit",
    });
    expect(lookupCombatToHitResult(18)).toMatchObject({
      grazing: false,
      hit: true,
      resultKey: "hit",
    });
    expect(() => lookupCombatToHitDamageMetadata(17)).toThrow(/ambiguous damage metadata/);
    expect(() => lookupCombatToHitDamageMetadata(18)).toThrow(/ambiguous damage metadata/);
  });

  it("rejects non-integer lookup totals instead of silently normalizing them", () => {
    expect(() => lookupCombatToHitResult(10.5)).toThrow(RangeError);
  });
});
