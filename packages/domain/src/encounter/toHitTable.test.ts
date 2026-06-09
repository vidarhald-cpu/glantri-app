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
      title: "Glantri Combat To Hit / Damage",
    });
    expect(COMBAT_TO_HIT_RULE_TABLE.notes.join(" ")).toContain("Legacy workbook sheet `To Hit table` is not canonical");
    expect(COMBAT_TO_HIT_RULE_TABLE.notes.join(" ")).toContain("Lookup totals 17 and 18 are resolved");
    expect(COMBAT_TO_HIT_RULE_TABLE.notes.join(" ")).toContain("Lookup totals above 34 continue");
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
      damage: 0,
      grazing: true,
      hit: true,
      lookupTotal: 11,
      resultKey: "grazing-hit",
      resultLabel: "Grazing hit",
    });
    expect(lookupCombatToHitDamageMetadata(11)).toEqual({
      damage: 0,
      damageRoll: {
        required: true,
        sourceLookupTotal: 12,
      },
      sourceRows: ["to hit (new)!A5:E5", "to hit (new)!A6:E6", "to hit (new)!C32"],
    });
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
      damage: 1,
      sourceRows: ["to hit (new)!A6:E6"],
    });
    expect(lookupCombatToHitDamageMetadata(16)).toEqual({
      damage: 3,
      sourceRows: ["to hit (new)!A10:E10"],
    });
    expect(lookupCombatToHitDamageMetadata(17)).toEqual({
      damage: 4,
      sourceRows: ["to hit (new)!A11:E11"],
    });
    expect(lookupCombatToHitDamageMetadata(18)).toEqual({
      damage: 5,
      sourceRows: ["to hit (new)!A12:E12"],
    });
    expect(lookupCombatToHitDamageMetadata(20)).toEqual({
      criticalGrade: "a",
      damage: 7,
      sourceRows: ["to hit (new)!A14:F14"],
    });
    expect(lookupCombatToHitDamageMetadata(22)).toEqual({
      criticalGrade: "b",
      damage: 9,
      minDamage: 1,
      sourceRows: ["to hit (new)!A16:G16"],
    });
    expect(lookupCombatToHitDamageMetadata(35)).toEqual({
      criticalGrade: "f",
      damage: 22,
      maxDamageNote: "max damage: 17 + GM STR when relevant",
      minDamage: 5,
      sourceRows: ["to hit (new)!A29:I29"],
    });
  });

  it("uses the refreshed resolved 17/18 rows for hit classification and damage metadata", () => {
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
    expect(lookupCombatToHitDamageMetadata(17)?.damage).toBe(4);
    expect(lookupCombatToHitDamageMetadata(18)?.damage).toBe(5);
  });

  it("continues above the displayed table without clamping high open-ended results", () => {
    expect(resolveCombatToHit({ db: 0, ob: 0, rollTotal: 50 })).toMatchObject({
      criticalGrade: "f",
      damage: 37,
      hit: true,
      lookupTotal: 50,
      minDamage: 5,
      resultKey: "hit",
    });
    expect(lookupCombatToHitDamageMetadata(50)).toEqual({
      criticalGrade: "f",
      damage: 37,
      maxDamageNote: "max damage: 17 + GM STR when relevant",
      minDamage: 5,
      sourceRows: ["to hit (new)!A29:I29"],
    });
  });

  it("rejects non-integer lookup totals instead of silently normalizing them", () => {
    expect(() => lookupCombatToHitResult(10.5)).toThrow(RangeError);
  });
});
