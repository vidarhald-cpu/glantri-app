import { describe, expect, it } from "vitest";

import {
  CRITICAL_EFFECTS_TABLE,
  getCriticalEffectRollRequirements,
  getCriticalEffectsForCrit,
  getCriticalResult,
  getCriticalResultWithEffects,
  listCriticalFamilies,
  listCriticalIndexesFor,
  listCriticalLocations,
  validateCriticalTableCoverage,
} from "./criticalEffectsTable";

describe("critical effects table helpers", () => {
  it("loads the workbook-derived canonical row counts", () => {
    expect(CRITICAL_EFFECTS_TABLE.criticalResults).toHaveLength(608);
    expect(CRITICAL_EFFECTS_TABLE.effectTemplates).toHaveLength(2179);
    expect(CRITICAL_EFFECTS_TABLE.source).toMatchObject({
      criticalResultsRange: "AppFacing_Crits!A1:X609",
      effectTemplatesRange: "AppFacing_Effects!A1:AE2180",
      workbook: "docs/source/combat/Glantri_CriticalEffects_AppFacing_v13.xlsx",
    });
  });

  it("looks up sharp arm index 01 with title and full body text", () => {
    expect(getCriticalResult("sharp", "arm", 1)).toMatchObject({
      bodyText: "Your blow grazes your opponent's arm, causing them to drop anything held in that hand.",
      critBand: "minor",
      critIndex: 1,
      critKey: "sharp|arm|01",
      family: "sharp",
      hasLossOfUse: true,
      hasSpecial: true,
      location: "arm",
      title: "Hand slightly hindered",
    });
  });

  it("looks up sharp arm index 13 with multiple effect rows", () => {
    const result = getCriticalResultWithEffects("sharp", "arm", 13);

    expect(result?.result).toMatchObject({
      critKey: "sharp|arm|13",
      hasExternalBleed: true,
      hasStun: true,
      title: "Amputation; lower_arm unusable; no action / unconscious; external bleed 1d4 hp / round",
    });
    expect(result?.effects.map((effect) => effect.effectKey)).toEqual([
      "sharp|arm|13|01",
      "sharp|arm|13|02",
      "sharp|arm|13|03",
      "sharp|arm|13|04",
      "sharp|arm|13|05",
      "sharp|arm|13|06",
      "sharp|arm|13|07",
    ]);
    expect(result?.effects.map((effect) => effect.type)).toEqual([
      "Physical",
      "Stun",
      "Bleed",
      "Physical",
      "Special",
      "Special",
      "Special",
    ]);
  });

  it("returns effect rows sorted by effectOrder", () => {
    const effects = getCriticalEffectsForCrit("sharp|arm|13");

    expect(effects.map((effect) => effect.effectOrder)).toEqual([1, 2, 3, 4, 5, 6, 7]);
    expect(effects[0]).toMatchObject({
      effectKey: "sharp|arm|13|01",
      minDamageReason: "amputation / severing",
      minTotalDamage: 5,
      subtype: "minimum_damage_floor",
      type: "Physical",
    });
  });

  it("represents physical minimum damage floor rows", () => {
    const minimumFloorRows = CRITICAL_EFFECTS_TABLE.effectTemplates.filter(
      (effect) => effect.subtype === "minimum_damage_floor",
    );

    expect(minimumFloorRows.length).toBeGreaterThan(0);
    expect(minimumFloorRows).toContainEqual(
      expect.objectContaining({
        critKey: "sharp|arm|13",
        minTotalDamage: 5,
        sourceField: "min_total_damage",
        sourceValue: "5",
        type: "Physical",
      }),
    );
  });

  it("detects duration roll requirements without rolling them", () => {
    const d4Effect = getCriticalEffectsForCrit("sharp|arm|04").find(
      (effect) => effect.durationRoll === "d4",
    );
    const d6Effect = getCriticalEffectsForCrit("sharp|arm|05").find(
      (effect) => effect.durationRoll === "d6",
    );

    expect(d4Effect).toBeDefined();
    expect(d6Effect).toBeDefined();
    expect(getCriticalEffectRollRequirements(d4Effect!)).toContainEqual({
      formula: "d4",
      note: "D4 rounds",
      purpose: "duration",
      sourceField: "durationRoll",
      sourceValue: "d4",
    });
    expect(getCriticalEffectRollRequirements(d6Effect!)).toContainEqual({
      formula: "d6",
      note: "D6 rounds",
      purpose: "duration",
      sourceField: "durationRoll",
      sourceValue: "d6",
    });
  });

  it("detects rate roll formulas without rolling them", () => {
    const bleedEffect = getCriticalEffectsForCrit("sharp|arm|13").find(
      (effect) => effect.rateRollFormula === "1d4",
    );

    expect(bleedEffect).toBeDefined();
    expect(getCriticalEffectRollRequirements(bleedEffect!)).toEqual(
      expect.arrayContaining([
        {
          formula: "1d4",
          note: "1D4 HP / round",
          purpose: "rate",
          sourceField: "rateRollFormula",
          sourceValue: "1d4",
        },
        expect.objectContaining({
          formula: "1d4",
          purpose: "rate",
          sourceField: "sourceValue",
          sourceValue: "1D4 HP / round",
        }),
      ]),
    );
  });

  it("detects dice text in source values when no normalized roll field exists", () => {
    const deathTimerEffect = CRITICAL_EFFECTS_TABLE.effectTemplates.find(
      (effect) => effect.sourceValue === "fatal in D4 rounds",
    );

    expect(deathTimerEffect).toBeDefined();
    expect(getCriticalEffectRollRequirements(deathTimerEffect!)).toContainEqual(
      expect.objectContaining({
        formula: "d4",
        purpose: "rate",
        sourceField: "sourceValue",
        sourceValue: "fatal in D4 rounds",
      }),
    );
  });

  it("reports authored coverage and unsupported combinations distinctly", () => {
    const coverage = validateCriticalTableCoverage();

    expect(coverage.complete).toBe(true);
    expect(coverage.expectedIndexes).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16]);
    expect(coverage.missingCombinations).toEqual([]);
    expect(coverage.duplicateCritKeys).toEqual([]);
    expect(coverage.orphanEffectCritKeys).toEqual([]);
    expect(coverage.missingEffectCritKeys).toEqual([]);
    expect(coverage.unsupportedIndexPolicy).toBe("return-undefined");
    expect(coverage.unsupportedCombinations).toContainEqual({
      family: "arrows_bolts",
      location: "whole_body",
    });
    expect(listCriticalIndexesFor("sharp", "arm")).toEqual([
      1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16,
    ]);
    expect(getCriticalResult("sharp", "arm", 17)).toBeUndefined();
    expect(getCriticalResult("sharp", "whole_body", 1)).toBeUndefined();
  });

  it("lists critical families and locations from the canonical table", () => {
    expect(listCriticalFamilies()).toEqual([
      "arrows_bolts",
      "blunt",
      "falling_crushing",
      "fire_energy",
      "firearms",
      "pointed_weapons",
      "sharp",
      "teeth_claws",
    ]);
    expect(listCriticalLocations()).toEqual([
      "abdomen",
      "arm",
      "chest",
      "head",
      "lower_leg",
      "upper_leg",
      "whole_body",
    ]);
  });

  it("does not mutate caller state while using lookup helpers", () => {
    const callerState = Object.freeze({
      commands: Object.freeze(["roll_critical"]),
      currentCursor: Object.freeze({ participantId: "defender", step: "D1" }),
    });

    getCriticalResult("sharp", "arm", 13);
    getCriticalEffectsForCrit("sharp|arm|13");
    getCriticalResultWithEffects("sharp", "arm", 13);

    expect(callerState).toEqual({
      commands: ["roll_critical"],
      currentCursor: { participantId: "defender", step: "D1" },
    });
  });
});
