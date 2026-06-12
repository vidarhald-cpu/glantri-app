import {
  CRITICAL_EFFECTS_TABLE_SOURCE,
  CRITICAL_EFFECT_TEMPLATES,
  CRITICAL_RESULTS,
} from "./criticalEffectsTableData";

export const CRITICAL_FAMILIES = [
  "arrows_bolts",
  "blunt",
  "falling_crushing",
  "fire_energy",
  "firearms",
  "pointed_weapons",
  "sharp",
  "teeth_claws",
] as const;

export type CriticalFamily = typeof CRITICAL_FAMILIES[number];

export const CRITICAL_LOCATION_SCOPES = [
  "abdomen",
  "arm",
  "chest",
  "head",
  "lower_leg",
  "upper_leg",
  "whole_body",
] as const;

export type CriticalLocationScope = typeof CRITICAL_LOCATION_SCOPES[number];

export const CRITICAL_INDEXES = [
  1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16,
] as const;

export type CriticalIndex = typeof CRITICAL_INDEXES[number];

export const CRITICAL_BANDS = [
  "minor",
  "moderate",
  "serious",
  "severe",
  "catastrophic",
  "fatal",
] as const;

export type CriticalBand = typeof CRITICAL_BANDS[number];

export const CRITICAL_MORTALITY_STATES = [
  "none",
  "death_countdown",
  "dying",
  "instant_death",
  "mortally_wounded",
  "rapidly_dying",
] as const;

export type CriticalMortalityState = typeof CRITICAL_MORTALITY_STATES[number];

export const CRITICAL_EFFECT_TYPES = [
  "Bleed",
  "Internal bleed",
  "Physical",
  "Special",
  "Stun",
] as const;

export type CriticalEffectType = typeof CRITICAL_EFFECT_TYPES[number];

export const CRITICAL_EFFECT_GROUPS = [
  "Bleed",
  "DB",
  "General",
  "Mobility",
  "None",
  "OB/Skill",
  "Special",
  "Stun/Action",
] as const;

export type CriticalEffectGroup = typeof CRITICAL_EFFECT_GROUPS[number];

export const CRITICAL_DURATION_MODES = [
  "death_timer_special",
  "fixed",
  "instant",
  "mixed_until_treated_then_permanent",
  "ongoing",
  "roll",
  "special",
  "stateful_special",
  "until_staunched",
  "until_treated",
] as const;

export type CriticalDurationMode = typeof CRITICAL_DURATION_MODES[number];

export const CRITICAL_RATE_MODES = [
  "death_timer",
  "fixed_fraction",
  "none",
  "roll_once_per_round_rate",
] as const;

export type CriticalRateMode = typeof CRITICAL_RATE_MODES[number];

export interface CriticalResult {
  bodyText: string;
  critBand: CriticalBand;
  critIndex: number;
  critKey: string;
  family: CriticalFamily;
  hasBalance: boolean;
  hasExternalBleed: boolean;
  hasInternalBleed: boolean;
  hasLossOfUse: boolean;
  hasSpecial: boolean;
  hasStun: boolean;
  location: CriticalLocationScope;
  minDamageReason: string;
  minTotalDamage: number;
  mortalityState: CriticalMortalityState;
  physicalImmediateOnly: boolean;
  selfStaunchLikelihood?: string;
  selfStaunchWindow?: string;
  sourceNotes?: string;
  sourceSpecialTags: readonly string[];
  title: string;
  treatmentDifficulty?: number;
  treatmentGateRaw?: string;
  urgency: number;
}

export interface CriticalEffectTemplate {
  actionState?: string;
  critKey: string;
  durationMode: CriticalDurationMode;
  durationRaw?: string;
  durationRoll?: string;
  durationUnit?: string;
  durationValue?: number;
  effectKey: string;
  effectOrder: number;
  endTrigger?: string;
  group: CriticalEffectGroup;
  implementationNote?: string;
  minDamageReason?: string;
  minTotalDamage?: number;
  penaltyPct?: number;
  rateMode: CriticalRateMode;
  rateRaw?: string;
  rateRollFormula?: string;
  rateValuePerRound?: number;
  selfStaunchLikelihood?: string;
  selfStaunchWindow?: string;
  severity?: number;
  sourceField?: string;
  sourceValue?: string;
  specialFlag?: string;
  subtype: string;
  target: string;
  treatmentDifficulty?: number;
  treatmentGate?: string;
  type: CriticalEffectType;
  urgency: number;
}

export interface CriticalResultWithEffects {
  effects: readonly CriticalEffectTemplate[];
  result: CriticalResult;
}

export interface CriticalTableCoverageGap {
  family: CriticalFamily;
  location: CriticalLocationScope;
  missingIndexes: readonly number[];
}

export interface CriticalTableCoverageReport {
  complete: boolean;
  duplicateCritKeys: readonly string[];
  expectedIndexes: readonly number[];
  families: readonly CriticalFamily[];
  locations: readonly CriticalLocationScope[];
  missingCombinations: readonly CriticalTableCoverageGap[];
  missingEffectCritKeys: readonly string[];
  orphanEffectCritKeys: readonly string[];
  source: typeof CRITICAL_EFFECTS_TABLE_SOURCE;
  unsupportedCombinations: readonly Omit<CriticalTableCoverageGap, "missingIndexes">[];
  unsupportedIndexPolicy: "return-undefined";
}

export type CriticalEffectRollRequirementPurpose =
  | "duration"
  | "rate"
  | "quantity"
  | "other";

export interface CriticalEffectRollRequirement {
  formula: string;
  note?: string;
  purpose: CriticalEffectRollRequirementPurpose;
  sourceField: "durationRoll" | "rateRollFormula" | "sourceValue";
  sourceValue?: string;
}

export const CRITICAL_EFFECTS_TABLE = {
  criticalResults: CRITICAL_RESULTS,
  effectTemplates: CRITICAL_EFFECT_TEMPLATES,
  notes: [
    "Critical result keys use family|location|NN.",
    "Critical indexes are explicitly represented from 1 through 16; no continuation or clamping rule is documented.",
    "Physical effect rows provide minimum total damage floors rather than a second normal damage stream.",
    "Effect roll formulas are detected but not executed by this domain table slice.",
  ],
  source: CRITICAL_EFFECTS_TABLE_SOURCE,
  title: "Glantri Critical Effects",
} as const;

const CRITICAL_RESULT_BY_KEY = new Map(
  CRITICAL_RESULTS.map((result) => [result.critKey, result]),
);

const CRITICAL_EFFECTS_BY_CRIT_KEY = new Map<string, CriticalEffectTemplate[]>();

for (const effect of CRITICAL_EFFECT_TEMPLATES) {
  const effects = CRITICAL_EFFECTS_BY_CRIT_KEY.get(effect.critKey) ?? [];
  effects.push(effect);
  CRITICAL_EFFECTS_BY_CRIT_KEY.set(effect.critKey, effects);
}

for (const effects of CRITICAL_EFFECTS_BY_CRIT_KEY.values()) {
  effects.sort((left, right) => left.effectOrder - right.effectOrder);
}

function formatCriticalIndex(critIndex: number): string {
  if (!Number.isInteger(critIndex)) {
    throw new RangeError("Critical index must be an integer.");
  }

  return critIndex.toString().padStart(2, "0");
}

function buildCritKey(
  family: string,
  location: string,
  critIndex: number,
): string {
  return `${family}|${location}|${formatCriticalIndex(critIndex)}`;
}

export function getCriticalResult(
  family: string,
  location: string,
  critIndex: number,
): CriticalResult | undefined {
  return CRITICAL_RESULT_BY_KEY.get(buildCritKey(family, location, critIndex));
}

export function getCriticalEffectsForCrit(
  critKey: string,
): readonly CriticalEffectTemplate[] {
  return CRITICAL_EFFECTS_BY_CRIT_KEY.get(critKey) ?? [];
}

export function getCriticalResultWithEffects(
  family: string,
  location: string,
  critIndex: number,
): CriticalResultWithEffects | undefined {
  const result = getCriticalResult(family, location, critIndex);

  if (!result) {
    return undefined;
  }

  return {
    effects: getCriticalEffectsForCrit(result.critKey),
    result,
  };
}

export function listCriticalFamilies(): readonly CriticalFamily[] {
  return [...CRITICAL_FAMILIES];
}

export function listCriticalLocations(): readonly CriticalLocationScope[] {
  return [...CRITICAL_LOCATION_SCOPES];
}

export function listCriticalIndexesFor(
  family: string,
  location: string,
): readonly number[] {
  return CRITICAL_RESULTS
    .filter((result) => result.family === family && result.location === location)
    .map((result) => result.critIndex)
    .sort((left, right) => left - right);
}

function findDuplicateCritKeys(): string[] {
  const counts = new Map<string, number>();

  for (const result of CRITICAL_RESULTS) {
    counts.set(result.critKey, (counts.get(result.critKey) ?? 0) + 1);
  }

  return [...counts.entries()]
    .filter(([, count]) => count > 1)
    .map(([critKey]) => critKey)
    .sort();
}

export function validateCriticalTableCoverage(): CriticalTableCoverageReport {
  const missingCombinations: CriticalTableCoverageGap[] = [];
  const unsupportedCombinations: Omit<CriticalTableCoverageGap, "missingIndexes">[] = [];

  for (const family of CRITICAL_FAMILIES) {
    for (const location of CRITICAL_LOCATION_SCOPES) {
      const indexes = new Set(listCriticalIndexesFor(family, location));

      if (indexes.size === 0) {
        unsupportedCombinations.push({
          family,
          location,
        });
        continue;
      }

      const missingIndexes = CRITICAL_INDEXES.filter((index) => !indexes.has(index));

      if (missingIndexes.length > 0) {
        missingCombinations.push({
          family,
          location,
          missingIndexes,
        });
      }
    }
  }

  const critKeys = new Set(CRITICAL_RESULTS.map((result) => result.critKey));
  const effectCritKeys = new Set(
    CRITICAL_EFFECT_TEMPLATES.map((effect) => effect.critKey),
  );
  const orphanEffectCritKeys = [...effectCritKeys]
    .filter((critKey) => !critKeys.has(critKey))
    .sort();
  const missingEffectCritKeys = [...critKeys]
    .filter((critKey) => !effectCritKeys.has(critKey))
    .sort();
  const duplicateCritKeys = findDuplicateCritKeys();

  return {
    complete:
      missingCombinations.length === 0 &&
      orphanEffectCritKeys.length === 0 &&
      missingEffectCritKeys.length === 0 &&
      duplicateCritKeys.length === 0,
    duplicateCritKeys,
    expectedIndexes: [...CRITICAL_INDEXES],
    families: listCriticalFamilies(),
    locations: listCriticalLocations(),
    missingCombinations,
    missingEffectCritKeys,
    orphanEffectCritKeys,
    source: CRITICAL_EFFECTS_TABLE_SOURCE,
    unsupportedCombinations,
    unsupportedIndexPolicy: "return-undefined",
  };
}

function normalizeDiceFormula(formula: string): string {
  return formula.trim().toLowerCase();
}

const SOURCE_VALUE_DICE_PATTERN = /\b(?:\d+)?d\d+\b/i;

function getSourceValueRollPurpose(
  effectTemplate: CriticalEffectTemplate,
): CriticalEffectRollRequirementPurpose {
  const sourceText = `${effectTemplate.sourceField ?? ""} ${effectTemplate.sourceValue ?? ""}`.toLowerCase();

  if (sourceText.includes("finger") || sourceText.includes("random")) {
    return "quantity";
  }

  if (sourceText.includes("rate") || sourceText.includes("fatal")) {
    return "rate";
  }

  return "other";
}

export function getCriticalEffectRollRequirements(
  effectTemplate: CriticalEffectTemplate,
): readonly CriticalEffectRollRequirement[] {
  const requirements: CriticalEffectRollRequirement[] = [];

  if (effectTemplate.durationRoll) {
    requirements.push({
      formula: normalizeDiceFormula(effectTemplate.durationRoll),
      note: effectTemplate.durationRaw,
      purpose: "duration",
      sourceField: "durationRoll",
      sourceValue: effectTemplate.durationRoll,
    });
  }

  if (effectTemplate.rateRollFormula) {
    requirements.push({
      formula: normalizeDiceFormula(effectTemplate.rateRollFormula),
      note: effectTemplate.rateRaw,
      purpose: "rate",
      sourceField: "rateRollFormula",
      sourceValue: effectTemplate.rateRollFormula,
    });
  }

  if (
    effectTemplate.sourceValue &&
    SOURCE_VALUE_DICE_PATTERN.test(effectTemplate.sourceValue)
  ) {
    const formula = effectTemplate.sourceValue.match(SOURCE_VALUE_DICE_PATTERN)?.[0];

    if (formula) {
      requirements.push({
        formula: normalizeDiceFormula(formula),
        note: effectTemplate.implementationNote,
        purpose: getSourceValueRollPurpose(effectTemplate),
        sourceField: "sourceValue",
        sourceValue: effectTemplate.sourceValue,
      });
    }
  }

  return requirements;
}
