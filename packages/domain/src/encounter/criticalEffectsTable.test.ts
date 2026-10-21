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
      workbook: "docs/source/combat/Glantri_CriticalEffects_AppFacing_v14.xlsx",
    });
  });

  it("looks up sharp arm index 01 with title and full body text", () => {
    expect(getCriticalResult("sharp", "arm", 1)).toMatchObject({
      bodyText:
        "Your blow grazes your opponent's arm, causing them to drop anything held in that hand.",
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
      title: "Amputation; forearm unusable; no action / unconscious; external bleed 1d4 hp / round",
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

  it("preserves representative blunt and whole-body outcomes without flattening them", () => {
    expect(getCriticalResult("blunt", "head", 16)).toMatchObject({
      critKey: "blunt|head|16",
      mortalityState: "instant_death",
      title: "Head struck clean off and flung clear; instant death",
    });
    expect(getCriticalResultWithEffects("fire_energy", "whole_body", 8)).toMatchObject({
      effects: expect.arrayContaining([
        expect.objectContaining({ effectKey: "fire_energy|whole_body|08|05" }),
      ]),
      result: expect.objectContaining({
        critIndex: 8,
        location: "whole_body",
      }),
    });
  });

  it("preserves fractional rates and unresolved stateful source mappings", () => {
    expect(getCriticalEffectsForCrit("sharp|chest|09")).toContainEqual(
      expect.objectContaining({
        effectKey: "sharp|chest|09|03",
        rateMode: "fixed_fraction",
        rateRaw: "1 HP / 2 rounds",
        rateValuePerRound: 0.5,
      }),
    );
    expect(getCriticalEffectsForCrit("blunt|lower_leg|01")).toContainEqual(
      expect.objectContaining({
        durationMode: "special",
        durationRaw: "instant stumble",
        effectKey: "blunt|lower_leg|01|01",
        sourceField: "balance_penalty",
        sourceValue: "-1",
      }),
    );
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
    expect(coverage.expectedIndexes).toEqual([
      1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16,
    ]);
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

/**
 * Forgejo #747: machine/internal tokens must not reach the reader through `title`.
 *
 * The #734 publication ruling bars `sourceSpecialTags` and per-effect `specialFlag` from
 * publication, and both of #734's exclusion suites enforce that for the field *names* plus the
 * 608 `critKey` literals. Neither forbids the tag and flag *values*, and 18 of them reached the
 * reader inside the authoritative `title` field of 91 rows — the bar satisfied for columns and
 * defeated in the published text. These assertions close that gap at the value level.
 *
 * They are deliberately derived from the dataset itself rather than from a list of the 20 tokens
 * #747 happened to find: a newly authored row carrying a new tag whose value leaks into its title
 * must fail here too.
 */
describe("published Critical titles carry no machine or internal token values", () => {
  const results = CRITICAL_EFFECTS_TABLE.criticalResults;
  const effects = CRITICAL_EFFECTS_TABLE.effectTemplates;

  /**
   * Any `snake_case` run: the shape every leaked tag and flag value has.
   *
   * Deliberately NOT `g`-flagged. A global regex reused with `.test()` carries `lastIndex`
   * between calls, so a match in one title makes the scan of the next title start partway in
   * and miss an offender. The size of the loss depends on where the tokens sit, so it is not a
   * fixed fraction: measured on this dataset, two consecutive leaking titles reported 1, the
   * real pre-#747 91-of-608 state reported 79, and all 608 leaking reported 360. It never
   * reported zero, so the assertion still failed correctly — but the offender list is the
   * diagnostic the next lane reads, and it silently dropped part of it.
   */
  const SNAKE_CASE_RUN = /[A-Za-z]+(?:_[A-Za-z]+)+/;

  it("no title contains a snake_case run", () => {
    const offenders = results
      .filter((result) => SNAKE_CASE_RUN.test(result.title))
      .map((result) => `${result.critKey}: ${result.title}`);

    expect(offenders).toEqual([]);
  });

  /**
   * Only underscored values are machine-shaped. Several tag and flag values are single ordinary
   * English words — `unconscious`, `collapse`, `death`, `dying`, `scar`, `amputation` — which the
   * authored titles publish deliberately and correctly ("no action / unconscious", "instant
   * death"). Matching those would indict 399 titles that are not defective, so the guard is bound
   * to the shape that is never reader-facing: a value carrying an underscore.
   */
  const isMachineShaped = (value: string) => value.includes("_");

  it("no title contains any underscored sourceSpecialTags value used anywhere in the table", () => {
    const tagValues = [
      ...new Set(results.flatMap((result) => result.sourceSpecialTags ?? [])),
    ].filter(isMachineShaped);
    const offenders = results.flatMap((result) =>
      tagValues
        .filter((tag) => result.title.includes(tag))
        .map((tag) => `${result.critKey} leaks tag '${tag}' in '${result.title}'`),
    );

    expect(tagValues).toContain("permanent_dex_loss");
    expect(tagValues.length).toBeGreaterThan(20);
    expect(offenders).toEqual([]);
  });

  it("no title contains any underscored per-effect specialFlag value used in the table", () => {
    const flagValues = [
      ...new Set(
        effects
          .map((effect) => effect.specialFlag)
          .filter((flag): flag is string => typeof flag === "string" && flag.length > 0),
      ),
    ].filter(isMachineShaped);
    const offenders = results.flatMap((result) =>
      flagValues
        .filter((flag) => result.title.includes(flag))
        .map((flag) => `${result.critKey} leaks flag '${flag}' in '${result.title}'`),
    );

    expect(flagValues).toContain("embedded_missile");
    expect(flagValues.length).toBeGreaterThan(20);
    expect(offenders).toEqual([]);
  });

  it("no title contains a location enum value in its raw underscored form", () => {
    const rawLocations = [...new Set(results.map((result) => result.location))].filter((location) =>
      location.includes("_"),
    );
    const offenders = results.flatMap((result) =>
      rawLocations
        .filter((location) => result.title.includes(location))
        .map((location) => `${result.critKey} leaks location '${location}' in '${result.title}'`),
    );

    expect(rawLocations).toContain("whole_body");
    expect(offenders).toEqual([]);
  });
});
