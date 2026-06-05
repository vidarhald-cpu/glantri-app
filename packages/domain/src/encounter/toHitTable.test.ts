import { describe, expect, it } from "vitest";

import {
  COMBAT_TO_HIT_RULE_TABLE,
  calculateToHitLookupTotal,
  lookupCombatToHitResult,
  resolveCombatToHit,
} from "./toHitTable";

describe("combat to-hit table helpers", () => {
  it("documents the updated workbook source sheet and range", () => {
    expect(COMBAT_TO_HIT_RULE_TABLE).toMatchObject({
      id: "combat-to-hit",
      source: {
        range: "A1:I32",
        sheet: "to hit (new)",
        workbook: "docs/source/combat/New Combat Arena.xlsx",
      },
      title: "Combat To Hit",
    });
    expect(COMBAT_TO_HIT_RULE_TABLE.notes.join(" ")).toContain("Legacy workbook sheet `To Hit table` is not canonical");
  });

  it("resolves OB = DB and roll 10 as a miss", () => {
    expect(calculateToHitLookupTotal({ db: 12, ob: 12, roll: 10 })).toBe(10);
    expect(resolveCombatToHit({ db: 12, ob: 12, roll: 10 })).toMatchObject({
      grazing: false,
      hit: false,
      lookupTotal: 10,
      resultKey: "miss",
      resultLabel: "Miss",
    });
  });

  it("resolves OB = DB and roll 11 as a grazing hit", () => {
    expect(resolveCombatToHit({ db: 12, ob: 12, roll: 11 })).toMatchObject({
      grazing: true,
      hit: true,
      lookupTotal: 11,
      resultKey: "grazing-hit",
      resultLabel: "Grazing hit",
    });
  });

  it("resolves OB 9, DB 11, roll 18 as a hit", () => {
    expect(resolveCombatToHit({ db: 11, ob: 9, roll: 18 })).toMatchObject({
      grazing: false,
      hit: true,
      lookupTotal: 16,
      resultKey: "hit",
      resultLabel: "Hit",
    });
  });

  it("rejects rolls outside a closed 1d20", () => {
    expect(() => resolveCombatToHit({ db: 0, ob: 0, roll: 0 })).toThrow(RangeError);
    expect(() => resolveCombatToHit({ db: 0, ob: 0, roll: 21 })).toThrow(RangeError);
  });

  it("does not let duplicate 17/18 damage rows affect hit classification", () => {
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
    expect(COMBAT_TO_HIT_RULE_TABLE.notes.join(" ")).toContain("duplicate 17/18 rows");
  });

  it("rejects non-integer lookup totals instead of silently normalizing them", () => {
    expect(() => lookupCombatToHitResult(10.5)).toThrow(RangeError);
  });
});
