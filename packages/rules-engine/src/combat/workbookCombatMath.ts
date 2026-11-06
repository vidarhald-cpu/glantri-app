import { getWorkbookCharacterSheetGm } from "../stats/characteristicGms";

/**
 * The authored illustration of the percentage-adjustment rule: 50 base rows (0 through 49), each
 * spelling out 15 raw modifier steps.
 *
 * Source: `data/raw/glantri/Themistogenes 1.07.xlsx`, sheet `Prosent`, `A4:P57` — row 4 is the raw
 * step header 1..15, column A is the base, and rows 5 to 57 are bases 0 to 49. The sheet ends
 * there on both axes, so this grid's bound is the illustration's bound and not a transcription
 * cut-off. It is transcribed source data and is never extended here; it is exported only so the
 * conformance test can read every authored cell (#922).
 *
 * One authored row per line, over the 100-column print width: the grid is transcribed source data
 * and a row read as a row is how it is checked against the workbook, so it is left exactly as
 * transcribed rather than reflowed into one line per cell.
 */
// prettier-ignore
export const WORKBOOK_PERCENTAGE_ADJUSTMENT_TABLE: Record<number, Record<number, number>> = {
  0: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0, 7: 0, 8: 0, 9: 0, 10: 0, 11: 0, 12: 0, 13: 0, 14: 0, 15: 0 },
  1: { 1: 1, 2: 2, 3: 3, 4: 4, 5: 5, 6: 6, 7: 7, 8: 8, 9: 9, 10: 10, 11: 11, 12: 12, 13: 13, 14: 14, 15: 15 },
  2: { 1: 1, 2: 2, 3: 3, 4: 4, 5: 5, 6: 6, 7: 7, 8: 8, 9: 9, 10: 10, 11: 11, 12: 12, 13: 13, 14: 14, 15: 15 },
  3: { 1: 1, 2: 2, 3: 3, 4: 4, 5: 5, 6: 6, 7: 7, 8: 8, 9: 9, 10: 10, 11: 11, 12: 12, 13: 13, 14: 14, 15: 15 },
  4: { 1: 1, 2: 2, 3: 3, 4: 4, 5: 5, 6: 6, 7: 7, 8: 8, 9: 9, 10: 10, 11: 11, 12: 12, 13: 13, 14: 14, 15: 15 },
  5: { 1: 1, 2: 2, 3: 3, 4: 4, 5: 5, 6: 6, 7: 7, 8: 8, 9: 9, 10: 10, 11: 11, 12: 12, 13: 13, 14: 14, 15: 15 },
  6: { 1: 1, 2: 2, 3: 3, 4: 4, 5: 5, 6: 6, 7: 7, 8: 8, 9: 9, 10: 10, 11: 11, 12: 12, 13: 13, 14: 14, 15: 15 },
  7: { 1: 1, 2: 2, 3: 3, 4: 4, 5: 5, 6: 6, 7: 7, 8: 8, 9: 9, 10: 10, 11: 11, 12: 12, 13: 13, 14: 14, 15: 15 },
  8: { 1: 1, 2: 2, 3: 3, 4: 4, 5: 5, 6: 6, 7: 7, 8: 8, 9: 9, 10: 10, 11: 11, 12: 12, 13: 13, 14: 14, 15: 15 },
  9: { 1: 1, 2: 2, 3: 3, 4: 4, 5: 5, 6: 6, 7: 7, 8: 8, 9: 9, 10: 10, 11: 11, 12: 12, 13: 13, 14: 14, 15: 15 },
  10: { 1: 1, 2: 2, 3: 3, 4: 4, 5: 5, 6: 6, 7: 7, 8: 8, 9: 9, 10: 10, 11: 11, 12: 12, 13: 13, 14: 14, 15: 15 },
  11: { 1: 1, 2: 2, 3: 3, 4: 4, 5: 6, 6: 7, 7: 8, 8: 9, 9: 10, 10: 11, 11: 12, 12: 13, 13: 14, 14: 15, 15: 16 },
  12: { 1: 1, 2: 2, 3: 4, 4: 5, 5: 6, 6: 7, 7: 8, 8: 9, 9: 10, 10: 11, 11: 12, 12: 13, 13: 14, 14: 15, 15: 16 },
  13: { 1: 1, 2: 3, 3: 4, 4: 5, 5: 7, 6: 8, 7: 9, 8: 10, 9: 11, 10: 12, 11: 13, 12: 14, 13: 15, 14: 16, 15: 17 },
  14: { 1: 1, 2: 3, 3: 4, 4: 6, 5: 7, 6: 8, 7: 10, 8: 11, 9: 12, 10: 13, 11: 14, 12: 15, 13: 16, 14: 17, 15: 18 },
  15: { 1: 2, 2: 3, 3: 5, 4: 6, 5: 8, 6: 9, 7: 11, 8: 12, 9: 13, 10: 14, 11: 15, 12: 16, 13: 17, 14: 18, 15: 19 },
  16: { 1: 2, 2: 3, 3: 5, 4: 6, 5: 8, 6: 10, 7: 11, 8: 12, 9: 13, 10: 14, 11: 15, 12: 16, 13: 17, 14: 18, 15: 19 },
  17: { 1: 2, 2: 3, 3: 5, 4: 7, 5: 9, 6: 10, 7: 12, 8: 13, 9: 14, 10: 15, 11: 16, 12: 17, 13: 18, 14: 19, 15: 20 },
  18: { 1: 2, 2: 4, 3: 5, 4: 7, 5: 9, 6: 11, 7: 13, 8: 14, 9: 15, 10: 16, 11: 17, 12: 18, 13: 19, 14: 20, 15: 21 },
  19: { 1: 2, 2: 4, 3: 6, 4: 8, 5: 10, 6: 11, 7: 13, 8: 14, 9: 15, 10: 16, 11: 17, 12: 18, 13: 19, 14: 20, 15: 21 },
  20: { 1: 2, 2: 4, 3: 6, 4: 8, 5: 10, 6: 12, 7: 14, 8: 15, 9: 16, 10: 17, 11: 18, 12: 19, 13: 20, 14: 21, 15: 22 },
  21: { 1: 2, 2: 4, 3: 6, 4: 8, 5: 11, 6: 13, 7: 15, 8: 16, 9: 17, 10: 18, 11: 19, 12: 20, 13: 21, 14: 22, 15: 23 },
  22: { 1: 2, 2: 4, 3: 7, 4: 9, 5: 11, 6: 13, 7: 15, 8: 16, 9: 17, 10: 18, 11: 19, 12: 20, 13: 21, 14: 22, 15: 23 },
  23: { 1: 2, 2: 5, 3: 7, 4: 9, 5: 12, 6: 14, 7: 16, 8: 17, 9: 18, 10: 19, 11: 20, 12: 21, 13: 22, 14: 23, 15: 24 },
  24: { 1: 2, 2: 5, 3: 7, 4: 10, 5: 12, 6: 14, 7: 17, 8: 18, 9: 19, 10: 20, 11: 21, 12: 22, 13: 23, 14: 24, 15: 25 },
  25: { 1: 3, 2: 5, 3: 8, 4: 10, 5: 13, 6: 15, 7: 18, 8: 19, 9: 20, 10: 21, 11: 22, 12: 23, 13: 24, 14: 25, 15: 26 },
  26: { 1: 3, 2: 5, 3: 8, 4: 10, 5: 13, 6: 16, 7: 18, 8: 19, 9: 20, 10: 21, 11: 22, 12: 23, 13: 24, 14: 25, 15: 26 },
  27: { 1: 3, 2: 5, 3: 8, 4: 11, 5: 14, 6: 16, 7: 19, 8: 20, 9: 21, 10: 22, 11: 23, 12: 24, 13: 25, 14: 26, 15: 27 },
  28: { 1: 3, 2: 6, 3: 8, 4: 11, 5: 14, 6: 17, 7: 20, 8: 21, 9: 22, 10: 23, 11: 24, 12: 25, 13: 26, 14: 27, 15: 28 },
  29: { 1: 3, 2: 6, 3: 9, 4: 12, 5: 15, 6: 17, 7: 20, 8: 21, 9: 22, 10: 23, 11: 24, 12: 25, 13: 26, 14: 27, 15: 28 },
  30: { 1: 3, 2: 6, 3: 9, 4: 12, 5: 15, 6: 18, 7: 21, 8: 22, 9: 23, 10: 24, 11: 25, 12: 26, 13: 27, 14: 28, 15: 29 },
  31: { 1: 3, 2: 6, 3: 9, 4: 12, 5: 16, 6: 19, 7: 22, 8: 23, 9: 24, 10: 25, 11: 26, 12: 27, 13: 28, 14: 29, 15: 30 },
  32: { 1: 3, 2: 6, 3: 10, 4: 13, 5: 16, 6: 19, 7: 22, 8: 23, 9: 24, 10: 25, 11: 26, 12: 27, 13: 28, 14: 29, 15: 30 },
  33: { 1: 3, 2: 7, 3: 10, 4: 13, 5: 17, 6: 20, 7: 23, 8: 24, 9: 25, 10: 26, 11: 27, 12: 28, 13: 29, 14: 30, 15: 31 },
  34: { 1: 3, 2: 7, 3: 10, 4: 14, 5: 17, 6: 20, 7: 24, 8: 25, 9: 26, 10: 27, 11: 28, 12: 29, 13: 30, 14: 31, 15: 32 },
  35: { 1: 4, 2: 7, 3: 11, 4: 14, 5: 18, 6: 21, 7: 25, 8: 26, 9: 27, 10: 28, 11: 29, 12: 30, 13: 31, 14: 32, 15: 33 },
  36: { 1: 4, 2: 7, 3: 11, 4: 14, 5: 18, 6: 22, 7: 25, 8: 26, 9: 27, 10: 28, 11: 29, 12: 30, 13: 31, 14: 32, 15: 33 },
  37: { 1: 4, 2: 7, 3: 11, 4: 15, 5: 19, 6: 22, 7: 26, 8: 27, 9: 28, 10: 29, 11: 30, 12: 31, 13: 32, 14: 33, 15: 34 },
  38: { 1: 4, 2: 8, 3: 11, 4: 15, 5: 19, 6: 23, 7: 27, 8: 28, 9: 29, 10: 30, 11: 31, 12: 32, 13: 33, 14: 34, 15: 35 },
  39: { 1: 4, 2: 8, 3: 12, 4: 16, 5: 20, 6: 23, 7: 27, 8: 28, 9: 29, 10: 30, 11: 31, 12: 32, 13: 33, 14: 34, 15: 35 },
  40: { 1: 4, 2: 8, 3: 12, 4: 16, 5: 20, 6: 24, 7: 28, 8: 29, 9: 30, 10: 31, 11: 32, 12: 33, 13: 34, 14: 35, 15: 36 },
  41: { 1: 4, 2: 8, 3: 12, 4: 16, 5: 21, 6: 25, 7: 29, 8: 30, 9: 31, 10: 32, 11: 33, 12: 34, 13: 35, 14: 36, 15: 37 },
  42: { 1: 4, 2: 8, 3: 13, 4: 17, 5: 21, 6: 25, 7: 29, 8: 30, 9: 31, 10: 32, 11: 33, 12: 34, 13: 35, 14: 36, 15: 37 },
  43: { 1: 4, 2: 9, 3: 13, 4: 17, 5: 22, 6: 26, 7: 30, 8: 31, 9: 32, 10: 33, 11: 34, 12: 35, 13: 36, 14: 37, 15: 38 },
  44: { 1: 4, 2: 9, 3: 13, 4: 18, 5: 22, 6: 26, 7: 31, 8: 32, 9: 33, 10: 34, 11: 35, 12: 36, 13: 37, 14: 38, 15: 39 },
  45: { 1: 5, 2: 9, 3: 14, 4: 18, 5: 23, 6: 27, 7: 32, 8: 33, 9: 34, 10: 35, 11: 36, 12: 37, 13: 38, 14: 39, 15: 40 },
  46: { 1: 5, 2: 9, 3: 14, 4: 18, 5: 23, 6: 28, 7: 32, 8: 33, 9: 34, 10: 35, 11: 36, 12: 37, 13: 38, 14: 39, 15: 40 },
  47: { 1: 5, 2: 9, 3: 14, 4: 19, 5: 24, 6: 28, 7: 33, 8: 34, 9: 35, 10: 36, 11: 37, 12: 38, 13: 39, 14: 40, 15: 41 },
  48: { 1: 5, 2: 10, 3: 14, 4: 19, 5: 24, 6: 29, 7: 34, 8: 35, 9: 36, 10: 37, 11: 38, 12: 39, 13: 40, 14: 41, 15: 42 },
  49: { 1: 5, 2: 10, 3: 15, 4: 20, 5: 25, 6: 29, 7: 34, 8: 35, 9: 36, 10: 37, 11: 38, 12: 39, 13: 40, 14: 41, 15: 42 },
};

const WORKBOOK_REFERENCE_WEAPON_OB = 3;
export interface WorkbookMeleeObInput {
  armorActivityModifier?: number | null;
  dexterityGm: number;
  rawModifiers?: WorkbookRawModifier[];
  skillXp: number;
  strengthGm: number;
  weaponOb: number;
}

export interface WorkbookMeleeObResult {
  adjustment: number;
  combinedModifier: number;
  finalOb: number;
  rawOb: number;
  trace: WorkbookPercentageAdjustmentTrace;
}

export interface WorkbookProjectileObInput {
  armorActivityModifier?: number | null;
  dexterityGm: number;
  rawModifiers?: WorkbookRawModifier[];
  skillXp: number;
  weaponOb: number;
}

export interface WorkbookProjectileObResult {
  adjustment: number;
  combinedModifier: number;
  finalOb: number;
  rawOb: number;
  trace: WorkbookPercentageAdjustmentTrace;
}

export interface WorkbookMeleeDmbInput extends WorkbookMeleeObInput {
  weaponDmb: number;
}

export interface WorkbookMeleeDmbResult {
  finalDmb: number;
  rawDmb: number;
  referenceOb: number;
  workbookOb: WorkbookMeleeObResult;
}

export interface WorkbookMeleeInitiativeInput {
  dexterityGm: number;
  gameModifier?: number | null;
  skillXp: number;
  weaponInitiative: number;
}

export interface WorkbookMeleeInitiativeResult {
  baseInitiative: number;
  finalInitiative: number;
  gameModifier: number;
  skillModifier: number;
}

export interface WorkbookWeaponParryInput {
  armorActivityModifier?: number | null;
  dexterityGm: number;
  parrySkillXp: number;
  rawModifiers?: WorkbookRawModifier[];
  weaponParryModifier: number;
}

export interface WorkbookWeaponParryResult {
  adjustment: number;
  combinedModifier: number;
  finalParry: number;
  rawParry: number;
  trace: WorkbookPercentageAdjustmentTrace;
}

export interface WorkbookCombinedParryInput {
  armorActivityModifier?: number | null;
  dexterityGm: number;
  offHandParryModifier: number;
  parrySkillXp: number;
  primaryParryModifier: number;
  rawModifiers?: WorkbookRawModifier[];
}

export interface WorkbookCombinedParryResult {
  adjustment: number;
  combinedModifier: number;
  finalParry: number;
  offHandContribution: number;
  primaryContribution: number;
  rawParry: number;
  trace: WorkbookPercentageAdjustmentTrace;
}

export interface WorkbookEncumbranceLevelInput {
  carryCapacity: number;
  totalEncumbrance: number;
}

export interface WorkbookEncumbranceLevelResult {
  carryCapacity: number;
  encumbranceLevel: number;
  encumbrancePercent: number;
  totalEncumbrance: number;
}

export interface WorkbookMovementModifierInput {
  encumbranceLevel: number;
  shieldMovementModifier?: number | null;
}

export interface WorkbookMovementInput {
  baseMove: number;
  movementModifier: number;
}

export interface WorkbookDefensePairInput {
  baseDb: number;
  equipmentModifier?: number | null;
  rawModifiers?: WorkbookRawModifier[];
  toHitModifier?: number | null;
}

export interface WorkbookDefensePairResult {
  db: number;
  dm: number;
  fullAdjustment: number;
  fullModifier: number;
  noToHitAdjustment: number;
  noToHitDb: number;
  noToHitModifier: number;
  noToHitTrace: WorkbookPercentageAdjustmentTrace;
  fullTrace: WorkbookPercentageAdjustmentTrace;
}

export interface WorkbookRawModifier {
  label: string;
  value: number;
}

/**
 * An edge of the authored grid a percentage adjustment was resolved outside (#922).
 *
 * `base` and `modifier` are the two edges past the grid's last authored row and column.
 * `base_below_zero` is the third edge, below the grid rather than past it: the grid's first
 * authored row is base 0, so a base below zero has no authored row at all and every figure the
 * rule produces there is an extrapolation. Product Owner ruling on #922 (comment 20793) settles
 * what the rule says there; the standing ruling on the same issue (comment 20326) requires every
 * extrapolation to be flagged for review, and that applies to this edge as it does to the others.
 */
export type WorkbookPercentageAdjustmentAxis = "base" | "base_below_zero" | "modifier";

export interface WorkbookPercentageAdjustmentTrace {
  baseValue: number;
  /**
   * Whether `percentageAdjustment` was resolved by the open-ended rule past the edge of the
   * authored grid rather than read from an authored cell (#922). An extrapolated figure is a
   * resolved figure, not a guess, and it is flagged so the decision can be reviewed.
   */
  extrapolated: boolean;
  /** Which grid axes this adjustment ran past; empty whenever `extrapolated` is false. */
  extrapolatedAxes: WorkbookPercentageAdjustmentAxis[];
  finalValue: number;
  percentageAdjustment: number;
  rawModifierTotal: number;
  rawModifiers: WorkbookRawModifier[];
}

/** One percentage adjustment, with the provenance of the figure beside it (#922). */
export interface WorkbookPercentageAdjustmentResolution {
  extrapolated: boolean;
  extrapolatedAxes: WorkbookPercentageAdjustmentAxis[];
  value: number;
}

/** One authored row per line, as transcribed; see `WORKBOOK_PERCENTAGE_ADJUSTMENT_TABLE`. */
// prettier-ignore
export const WORKBOOK_MOVEMENT_PERCENT_TABLE: Record<number, Record<number, number>> = {
  0: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0, 7: 0, 8: 0, 9: 0, 10: 0, 11: 0, 12: 0, 13: 0, 14: 0, 15: 0 },
  1: { 1: 1, 2: 2, 3: 3, 4: 4, 5: 5, 6: 6, 7: 7, 8: 8, 9: 9, 10: 10, 11: 11, 12: 12, 13: 13, 14: 14, 15: 15 },
  2: { 1: 1, 2: 2, 3: 3, 4: 4, 5: 5, 6: 6, 7: 7, 8: 8, 9: 9, 10: 10, 11: 11, 12: 12, 13: 13, 14: 14, 15: 15 },
  3: { 1: 1, 2: 2, 3: 3, 4: 4, 5: 5, 6: 6, 7: 7, 8: 8, 9: 9, 10: 10, 11: 11, 12: 12, 13: 13, 14: 14, 15: 15 },
  4: { 1: 1, 2: 2, 3: 3, 4: 4, 5: 5, 6: 6, 7: 7, 8: 8, 9: 9, 10: 10, 11: 11, 12: 12, 13: 13, 14: 14, 15: 15 },
  5: { 1: 1, 2: 2, 3: 3, 4: 4, 5: 5, 6: 6, 7: 7, 8: 8, 9: 9, 10: 10, 11: 11, 12: 12, 13: 13, 14: 14, 15: 15 },
  6: { 1: 1, 2: 2, 3: 3, 4: 4, 5: 5, 6: 6, 7: 7, 8: 8, 9: 9, 10: 10, 11: 11, 12: 12, 13: 13, 14: 14, 15: 15 },
  7: { 1: 1, 2: 2, 3: 3, 4: 4, 5: 5, 6: 6, 7: 7, 8: 8, 9: 9, 10: 10, 11: 11, 12: 12, 13: 13, 14: 14, 15: 15 },
  8: { 1: 1, 2: 2, 3: 3, 4: 4, 5: 5, 6: 6, 7: 7, 8: 8, 9: 9, 10: 10, 11: 11, 12: 12, 13: 13, 14: 14, 15: 15 },
  9: { 1: 1, 2: 2, 3: 3, 4: 4, 5: 5, 6: 6, 7: 7, 8: 8, 9: 9, 10: 10, 11: 11, 12: 12, 13: 13, 14: 14, 15: 15 },
  10: { 1: 1, 2: 2, 3: 3, 4: 4, 5: 5, 6: 6, 7: 7, 8: 8, 9: 9, 10: 10, 11: 11, 12: 12, 13: 13, 14: 14, 15: 15 },
  11: { 1: 1, 2: 2, 3: 3, 4: 4, 5: 6, 6: 7, 7: 8, 8: 9, 9: 10, 10: 11, 11: 12, 12: 13, 13: 14, 14: 15, 15: 16 },
  12: { 1: 1, 2: 2, 3: 4, 4: 5, 5: 6, 6: 7, 7: 8, 8: 9, 9: 10, 10: 11, 11: 12, 12: 13, 13: 14, 14: 15, 15: 16 },
  13: { 1: 1, 2: 3, 3: 4, 4: 5, 5: 7, 6: 8, 7: 9, 8: 10, 9: 11, 10: 12, 11: 13, 12: 14, 13: 15, 14: 16, 15: 17 },
  14: { 1: 1, 2: 3, 3: 4, 4: 6, 5: 7, 6: 8, 7: 10, 8: 11, 9: 12, 10: 13, 11: 14, 12: 15, 13: 16, 14: 17, 15: 18 },
  15: { 1: 2, 2: 3, 3: 5, 4: 6, 5: 8, 6: 9, 7: 11, 8: 12, 9: 13, 10: 14, 11: 15, 12: 16, 13: 17, 14: 18, 15: 19 },
  16: { 1: 2, 2: 3, 3: 5, 4: 6, 5: 8, 6: 10, 7: 11, 8: 12, 9: 13, 10: 14, 11: 15, 12: 16, 13: 17, 14: 18, 15: 19 },
  17: { 1: 2, 2: 3, 3: 5, 4: 7, 5: 9, 6: 10, 7: 12, 8: 13, 9: 14, 10: 15, 11: 16, 12: 17, 13: 18, 14: 19, 15: 20 },
  18: { 1: 2, 2: 4, 3: 5, 4: 7, 5: 9, 6: 11, 7: 13, 8: 14, 9: 15, 10: 16, 11: 17, 12: 18, 13: 19, 14: 20, 15: 21 },
  19: { 1: 2, 2: 4, 3: 6, 4: 8, 5: 10, 6: 11, 7: 13, 8: 14, 9: 15, 10: 16, 11: 17, 12: 18, 13: 19, 14: 20, 15: 21 },
  20: { 1: 2, 2: 4, 3: 6, 4: 8, 5: 10, 6: 12, 7: 14, 8: 15, 9: 16, 10: 17, 11: 18, 12: 19, 13: 20, 14: 21, 15: 22 },
  21: { 1: 2, 2: 4, 3: 6, 4: 8, 5: 11, 6: 13, 7: 15, 8: 16, 9: 17, 10: 18, 11: 19, 12: 20, 13: 21, 14: 22, 15: 23 },
  22: { 1: 2, 2: 4, 3: 7, 4: 9, 5: 11, 6: 13, 7: 15, 8: 16, 9: 17, 10: 18, 11: 19, 12: 20, 13: 21, 14: 22, 15: 23 },
  23: { 1: 2, 2: 5, 3: 7, 4: 9, 5: 12, 6: 14, 7: 16, 8: 17, 9: 18, 10: 19, 11: 20, 12: 21, 13: 22, 14: 23, 15: 24 },
  24: { 1: 2, 2: 5, 3: 7, 4: 10, 5: 12, 6: 14, 7: 17, 8: 18, 9: 19, 10: 20, 11: 21, 12: 22, 13: 23, 14: 24, 15: 25 },
  25: { 1: 3, 2: 5, 3: 8, 4: 10, 5: 13, 6: 15, 7: 18, 8: 19, 9: 20, 10: 21, 11: 22, 12: 23, 13: 24, 14: 25, 15: 26 },
  26: { 1: 3, 2: 5, 3: 8, 4: 10, 5: 13, 6: 16, 7: 18, 8: 19, 9: 20, 10: 21, 11: 22, 12: 23, 13: 24, 14: 25, 15: 26 },
  27: { 1: 3, 2: 5, 3: 8, 4: 11, 5: 14, 6: 16, 7: 19, 8: 20, 9: 21, 10: 22, 11: 23, 12: 24, 13: 25, 14: 26, 15: 27 },
  28: { 1: 3, 2: 6, 3: 8, 4: 11, 5: 14, 6: 17, 7: 20, 8: 21, 9: 22, 10: 23, 11: 24, 12: 25, 13: 26, 14: 27, 15: 28 },
  29: { 1: 3, 2: 6, 3: 9, 4: 12, 5: 15, 6: 17, 7: 20, 8: 21, 9: 22, 10: 23, 11: 24, 12: 25, 13: 26, 14: 27, 15: 28 },
  30: { 1: 3, 2: 6, 3: 9, 4: 12, 5: 15, 6: 18, 7: 21, 8: 22, 9: 23, 10: 24, 11: 25, 12: 26, 13: 27, 14: 28, 15: 29 },
  31: { 1: 3, 2: 6, 3: 9, 4: 12, 5: 16, 6: 19, 7: 22, 8: 23, 9: 24, 10: 25, 11: 26, 12: 27, 13: 28, 14: 29, 15: 30 },
  32: { 1: 3, 2: 6, 3: 10, 4: 13, 5: 16, 6: 19, 7: 22, 8: 23, 9: 24, 10: 25, 11: 26, 12: 27, 13: 28, 14: 29, 15: 30 },
  33: { 1: 3, 2: 7, 3: 10, 4: 13, 5: 17, 6: 20, 7: 23, 8: 24, 9: 25, 10: 26, 11: 27, 12: 28, 13: 29, 14: 30, 15: 31 },
  34: { 1: 3, 2: 7, 3: 10, 4: 14, 5: 17, 6: 20, 7: 24, 8: 25, 9: 26, 10: 27, 11: 28, 12: 29, 13: 30, 14: 31, 15: 32 },
  35: { 1: 4, 2: 7, 3: 11, 4: 14, 5: 18, 6: 21, 7: 25, 8: 26, 9: 27, 10: 28, 11: 29, 12: 30, 13: 31, 14: 32, 15: 33 },
  36: { 1: 4, 2: 7, 3: 11, 4: 14, 5: 18, 6: 22, 7: 25, 8: 26, 9: 27, 10: 28, 11: 29, 12: 30, 13: 31, 14: 32, 15: 33 },
  37: { 1: 4, 2: 7, 3: 11, 4: 15, 5: 19, 6: 22, 7: 26, 8: 27, 9: 28, 10: 29, 11: 30, 12: 31, 13: 32, 14: 33, 15: 34 },
  38: { 1: 4, 2: 8, 3: 11, 4: 15, 5: 19, 6: 23, 7: 27, 8: 28, 9: 29, 10: 30, 11: 31, 12: 32, 13: 33, 14: 34, 15: 35 },
  39: { 1: 4, 2: 8, 3: 12, 4: 16, 5: 20, 6: 23, 7: 27, 8: 28, 9: 29, 10: 30, 11: 31, 12: 32, 13: 33, 14: 34, 15: 35 },
  40: { 1: 4, 2: 8, 3: 12, 4: 16, 5: 20, 6: 24, 7: 28, 8: 29, 9: 30, 10: 31, 11: 32, 12: 33, 13: 34, 14: 35, 15: 36 },
  41: { 1: 4, 2: 8, 3: 12, 4: 16, 5: 21, 6: 25, 7: 29, 8: 30, 9: 31, 10: 32, 11: 33, 12: 34, 13: 35, 14: 36, 15: 37 },
  42: { 1: 4, 2: 8, 3: 13, 4: 17, 5: 21, 6: 25, 7: 29, 8: 30, 9: 31, 10: 32, 11: 33, 12: 34, 13: 35, 14: 36, 15: 37 },
  43: { 1: 4, 2: 9, 3: 13, 4: 17, 5: 22, 6: 26, 7: 30, 8: 31, 9: 32, 10: 33, 11: 34, 12: 35, 13: 36, 14: 37, 15: 38 },
  44: { 1: 4, 2: 9, 3: 13, 4: 18, 5: 22, 6: 26, 7: 31, 8: 32, 9: 33, 10: 34, 11: 35, 12: 36, 13: 37, 14: 38, 15: 39 },
  45: { 1: 5, 2: 9, 3: 14, 4: 18, 5: 23, 6: 27, 7: 32, 8: 33, 9: 34, 10: 35, 11: 36, 12: 37, 13: 38, 14: 39, 15: 40 },
  46: { 1: 5, 2: 9, 3: 14, 4: 18, 5: 23, 6: 28, 7: 32, 8: 33, 9: 34, 10: 35, 11: 36, 12: 37, 13: 38, 14: 39, 15: 40 },
  47: { 1: 5, 2: 9, 3: 14, 4: 19, 5: 24, 6: 28, 7: 33, 8: 34, 9: 35, 10: 36, 11: 37, 12: 38, 13: 39, 14: 40, 15: 41 },
  48: { 1: 5, 2: 10, 3: 14, 4: 19, 5: 24, 6: 29, 7: 34, 8: 35, 9: 36, 10: 37, 11: 38, 12: 39, 13: 40, 14: 41, 15: 42 },
  49: { 1: 5, 2: 10, 3: 15, 4: 20, 5: 25, 6: 29, 7: 34, 8: 35, 9: 36, 10: 37, 11: 38, 12: 39, 13: 40, 14: 41, 15: 42 },
};

export const WORKBOOK_TO_HIT_MODIFIER_TABLE: Record<number, number> = {
  0: 2,
  1: 1,
  2: 1,
  3: 0,
  4: 0,
  5: -1,
  6: -1,
  7: -2,
  8: -2,
  9: -3,
  10: -3,
  11: -4,
  12: -4,
  13: -5,
  14: -5,
  15: -6,
};

export function getWorkbookCappedStrengthObModifier(strengthGm: number): number {
  return Math.min(strengthGm, 4);
}

export function getWorkbookStatGm(value: number | null | undefined): number | null {
  if (value == null) {
    return null;
  }

  return getWorkbookCharacterSheetGm(value);
}

/** The last base row and the last raw modifier step the authored grid spells out. */
const WORKBOOK_PERCENTAGE_ADJUSTMENT_AUTHORED_MAX_BASE = 49;
const WORKBOOK_PERCENTAGE_ADJUSTMENT_AUTHORED_MAX_STEP = 15;
/**
 * The step at which the authored grid stops scaling with the base. Up to this step every authored
 * row is the base scaled by ten percent per raw step; from it on, every authored row adds exactly
 * one point per further step, in all 50 rows.
 */
const WORKBOOK_PERCENTAGE_ADJUSTMENT_PROPORTIONAL_STEP_LIMIT = 7;

/**
 * Ten percent of the base per raw step, rounded half up, with a floor of one point per raw step.
 *
 * Integer arithmetic on purpose: `floor((2n + 10) / 20)` is round-half-up of `n / 10` without a
 * fractional intermediate, so no rounding mode is left to the floating-point unit.
 */
function workbookProportionalPercentageAdjustment(rawOb: number, step: number): number {
  return Math.max(step, Math.floor((step * rawOb * 2 + 10) / 20));
}

/**
 * The open-ended rule the authored grid illustrates (#922, Product Owner ruling on that issue:
 * "lookup tables are typically meant to be illustrations of open ended rules, we should make them
 * open ended, but probably also flag these for review").
 *
 * - up to step 7, the base scaled by ten percent per raw step, rounded half up, never less than
 *   one point per raw step;
 * - from step 8 on, the step-7 figure plus one point per further step.
 *
 * This is the source sheet's own arithmetic, not a curve fitted to its output. In
 * `data/raw/glantri/Themistogenes 1.07.xlsx`, sheet `Prosent`, the cells for bases 11 to 49 are
 * formulas: `B16:H57` is `=ROUND(B$4*$A16/10,0)` — the step header times the base over ten, with
 * Excel's half-away-from-zero rounding — and `I16:P57` is `=$H16+I$4-7`, the step-7 figure plus one
 * per further step. The one-point floor is the sheet's own treatment of the low bases: rows 5 to 15
 * (bases 0 to 10) are literal values, not formulas, and bases 1 to 10 are authored as one point per
 * raw step, which the formula alone would not produce.
 *
 * `workbookCombatMath.test.ts` spells the rule out a second time, independently of this module, and
 * compares it against all 750 authored cells. It reproduces 735. The 15 it does not are the whole
 * base-0 row, which this lookup already overrode by hand before #922 with exactly what the rule
 * predicts, so the rule reproduces every figure this function returned before #922.
 */
function workbookOpenEndedPercentageAdjustment(rawOb: number, absoluteModifier: number): number {
  if (absoluteModifier <= WORKBOOK_PERCENTAGE_ADJUSTMENT_PROPORTIONAL_STEP_LIMIT) {
    return workbookProportionalPercentageAdjustment(rawOb, absoluteModifier);
  }

  return (
    workbookProportionalPercentageAdjustment(
      rawOb,
      WORKBOOK_PERCENTAGE_ADJUSTMENT_PROPORTIONAL_STEP_LIMIT,
    ) +
    (absoluteModifier - WORKBOOK_PERCENTAGE_ADJUSTMENT_PROPORTIONAL_STEP_LIMIT)
  );
}

/**
 * One percentage adjustment and the provenance of the figure (#922).
 *
 * Inside the authored grid the authored cell is the answer, because the grid is the illustration
 * and nothing here second-guesses it. Outside it the open-ended rule answers, and the result says
 * so: before #922 this returned `null` past the last authored row, a defender carrying enough
 * committed damage could not be attacked at all, and the refusal blamed the defender for lacking a
 * defensive skill it had.
 *
 * A base of zero or below answers one point per raw step. Product Owner ruling on #922, comment
 * 20793, recorded verbatim there: *"One point per step is a better way to word it, and that's what
 * I meant"*, agreeing that *"for results below zero, we use the 1 per tenth rule"* means each point
 * of raw modifier moves the value by one point. So a defence is allowed to go below zero and is not
 * floored, and the proportional calculation — ten percent of the base per step — does not apply
 * there, because applied to a negative base it would move the magnitude the wrong way.
 *
 * That is one continuous rule with the authored grid's own treatment of the low bases: `Prosent`
 * authors bases 1 to 10 as a flat one point per raw step, so the rule this function applies below
 * zero is the rule the grid already stops scaling into. The base-0 row is the same figure for the
 * same reason, which is why one branch now covers a base of zero or below rather than two branches
 * that happened to agree. The two differ only in the flag: base 0 has an authored row, so it is not
 * an extrapolation on the base edge, while a base below zero has none and is flagged
 * `base_below_zero`.
 *
 * `null` survives for an input the rule has no reading of: a non-integer base or step, or a
 * negative step. A negative step cannot be reached through
 * `calculateWorkbookPercentageAdjustmentTrace`, which passes `Math.abs` of the raw total, so it is
 * a programming error rather than a game state; it is still refused rather than coerced.
 */
export function resolveWorkbookPercentageAdjustment(
  rawOb: number,
  absoluteModifier: number,
): WorkbookPercentageAdjustmentResolution | null {
  if (absoluteModifier === 0) {
    return { extrapolated: false, extrapolatedAxes: [], value: 0 };
  }

  if (!Number.isInteger(rawOb) || !Number.isInteger(absoluteModifier)) {
    return null;
  }

  if (absoluteModifier < 0) {
    return null;
  }

  const pastModifierEdge = absoluteModifier > WORKBOOK_PERCENTAGE_ADJUSTMENT_AUTHORED_MAX_STEP;

  if (rawOb <= 0) {
    // One point per raw step, for a base of zero and for every base below it, as one rule.
    //
    // Below zero this is the Product Owner's ruling on #922 (comment 20793). At zero the behaviour
    // is unchanged and pre-dates #922: the authored row for base 0 is all zeroes, while the
    // surrounding low-base rows encode one point per raw step, and this lookup has always applied
    // the low-base rule at zero so a combat value can move away from zero under live modifiers.
    // The ruling makes those two the same rule rather than two branches with the same arithmetic.
    //
    // `Prosent!B5:P5` is authored as literal zeroes in the source workbook, so the zero row is a
    // deliberate deviation from the source rather than a repair of a bad transcription. That
    // deviation is settled, not open: Product Owner question 15 (asked on #934) was ruled on #922,
    // comment 20880, 2026-11-04 — keep the zero override, base 0 follows the same one-point-per-step
    // rule as bases 1 to 10 and below zero, and the workbook's isolated frozen zero row is
    // superseded. The behaviour itself dates from 0f3682335bdeca4312ab096398eb24286092b177
    // (2026-05-19). Zero is a valid numerical base here, not "ability absent"; an ability that
    // genuinely cannot be used has to be represented explicitly, never through numeric zero. See
    // docs/decisions/rules/0013-workbook-zero-base-percentage-adjustment.md.
    const belowZeroAxes: WorkbookPercentageAdjustmentAxis[] = [];
    if (rawOb < 0) {
      // The grid's first authored row is base 0, so a base below zero is outside it on a third
      // edge and the figure is an extrapolation under the standing ruling (comment 20326). Base 0
      // has an authored row and is not flagged on this edge, though the figure it returns is the
      // superseding one-point-per-step rule rather than the authored zeroes.
      belowZeroAxes.push("base_below_zero");
    }
    if (pastModifierEdge) {
      belowZeroAxes.push("modifier");
    }

    return {
      extrapolated: belowZeroAxes.length > 0,
      extrapolatedAxes: belowZeroAxes,
      value: absoluteModifier,
    };
  }

  const authored = WORKBOOK_PERCENTAGE_ADJUSTMENT_TABLE[rawOb]?.[absoluteModifier];

  if (authored !== undefined) {
    return { extrapolated: false, extrapolatedAxes: [], value: authored };
  }

  const extrapolatedAxes: WorkbookPercentageAdjustmentAxis[] = [];
  if (rawOb > WORKBOOK_PERCENTAGE_ADJUSTMENT_AUTHORED_MAX_BASE) {
    extrapolatedAxes.push("base");
  }
  if (pastModifierEdge) {
    extrapolatedAxes.push("modifier");
  }

  return {
    extrapolated: true,
    extrapolatedAxes,
    value: workbookOpenEndedPercentageAdjustment(rawOb, absoluteModifier),
  };
}

export function lookupWorkbookPercentageAdjustment(
  rawOb: number,
  absoluteModifier: number,
): number | null {
  return resolveWorkbookPercentageAdjustment(rawOb, absoluteModifier)?.value ?? null;
}

export function calculateWorkbookPercentageAdjustmentTrace(input: {
  baseValue: number;
  rawModifiers: WorkbookRawModifier[];
}): WorkbookPercentageAdjustmentTrace | null {
  const rawModifierTotal = input.rawModifiers.reduce((sum, modifier) => sum + modifier.value, 0);
  const adjustment = resolveWorkbookPercentageAdjustment(
    input.baseValue,
    Math.abs(rawModifierTotal),
  );

  if (adjustment == null) {
    return null;
  }

  const percentageAdjustment = adjustment.value;

  return {
    baseValue: input.baseValue,
    extrapolated: adjustment.extrapolated,
    extrapolatedAxes: adjustment.extrapolatedAxes,
    finalValue:
      rawModifierTotal >= 0
        ? input.baseValue + percentageAdjustment
        : input.baseValue - percentageAdjustment,
    percentageAdjustment,
    rawModifierTotal,
    rawModifiers: input.rawModifiers,
  };
}

export function lookupWorkbookToHitModifier(encumbranceLevel: number): number | null {
  if (!Number.isInteger(encumbranceLevel)) {
    return null;
  }

  return WORKBOOK_TO_HIT_MODIFIER_TABLE[encumbranceLevel] ?? null;
}

export function calculateWorkbookBaseDb(input: {
  dexterityGm: number;
  dodgeSkillXp: number;
}): number {
  return Math.round(input.dodgeSkillXp / 2) + 4 + input.dexterityGm;
}

export function calculateWorkbookDefensePair(
  input: WorkbookDefensePairInput,
): WorkbookDefensePairResult | null {
  const sharedRawModifiers = [
    { label: "equipment", value: input.equipmentModifier ?? 0 },
    ...(input.rawModifiers ?? []),
  ];
  const fullRawModifiers = [
    ...sharedRawModifiers,
    { label: "to-hit", value: input.toHitModifier ?? 0 },
  ];
  const noToHitTrace = calculateWorkbookPercentageAdjustmentTrace({
    baseValue: input.baseDb,
    rawModifiers: sharedRawModifiers,
  });
  const fullTrace = calculateWorkbookPercentageAdjustmentTrace({
    baseValue: input.baseDb,
    rawModifiers: fullRawModifiers,
  });

  if (fullTrace == null || noToHitTrace == null) {
    return null;
  }

  return {
    db: fullTrace.finalValue,
    dm: fullTrace.finalValue - noToHitTrace.finalValue,
    fullAdjustment: fullTrace.percentageAdjustment,
    fullModifier: fullTrace.rawModifierTotal,
    fullTrace,
    noToHitAdjustment: noToHitTrace.percentageAdjustment,
    noToHitDb: noToHitTrace.finalValue,
    noToHitModifier: noToHitTrace.rawModifierTotal,
    noToHitTrace,
  };
}

export function calculateWorkbookMeleeOb(
  input: WorkbookMeleeObInput,
): WorkbookMeleeObResult | null {
  const rawOb =
    Math.round(input.skillXp / 2) +
    1 +
    Math.max(getWorkbookCappedStrengthObModifier(input.strengthGm), input.dexterityGm);
  const trace = calculateWorkbookPercentageAdjustmentTrace({
    baseValue: rawOb,
    rawModifiers: [
      { label: "armor activity", value: input.armorActivityModifier ?? 0 },
      { label: "weapon OB", value: input.weaponOb },
      ...(input.rawModifiers ?? []),
    ],
  });

  if (trace == null) {
    return null;
  }

  return {
    adjustment: trace.percentageAdjustment,
    combinedModifier: trace.rawModifierTotal,
    finalOb: trace.finalValue,
    rawOb,
    trace,
  };
}

export function calculateWorkbookProjectileOb(
  input: WorkbookProjectileObInput,
): WorkbookProjectileObResult | null {
  const rawOb = Math.round(input.skillXp / 2) + 1 + input.dexterityGm;
  const trace = calculateWorkbookPercentageAdjustmentTrace({
    baseValue: rawOb,
    rawModifiers: [
      { label: "armor activity", value: input.armorActivityModifier ?? 0 },
      { label: "weapon OB", value: input.weaponOb },
      ...(input.rawModifiers ?? []),
    ],
  });

  if (trace == null) {
    return null;
  }

  return {
    adjustment: trace.percentageAdjustment,
    combinedModifier: trace.rawModifierTotal,
    finalOb: trace.finalValue,
    rawOb,
    trace,
  };
}

export function calculateWorkbookMeleeDmb(
  input: WorkbookMeleeDmbInput,
): WorkbookMeleeDmbResult | null {
  const workbookOb = calculateWorkbookMeleeOb(input);

  if (!workbookOb) {
    return null;
  }

  const referenceAdjustment = lookupWorkbookPercentageAdjustment(
    workbookOb.rawOb,
    WORKBOOK_REFERENCE_WEAPON_OB,
  );

  if (referenceAdjustment == null) {
    return null;
  }

  const rawDmb = input.strengthGm + input.weaponDmb;
  const referenceOb = workbookOb.rawOb + referenceAdjustment;

  return {
    finalDmb:
      rawDmb + (referenceOb - workbookOb.finalOb) - (WORKBOOK_REFERENCE_WEAPON_OB - input.weaponOb),
    rawDmb,
    referenceOb,
    workbookOb,
  };
}

export function lookupWorkbookSkillInitiativeModifier(skillXp: number): number | null {
  if (!Number.isInteger(skillXp)) {
    return null;
  }

  // Workbook source: Themistogenes 1.07.xlsx -> Skill mod!A3:B34
  // 0..10 => 0, then the modifier increases by 1 for each five-point band:
  // 11..15 => 1, 16..20 => 2, ... , 31 => 5.
  if (skillXp < 0 || skillXp > 31) {
    return null;
  }

  if (skillXp <= 10) {
    return 0;
  }

  return Math.floor((skillXp - 6) / 5);
}

export function calculateWorkbookMeleeInitiative(
  input: WorkbookMeleeInitiativeInput,
): WorkbookMeleeInitiativeResult | null {
  const skillModifier = lookupWorkbookSkillInitiativeModifier(input.skillXp);

  if (skillModifier == null) {
    return null;
  }

  const baseInitiative = input.dexterityGm + input.weaponInitiative + skillModifier;
  const gameModifier = input.gameModifier ?? 0;
  const initiativeAdjustment =
    gameModifier > 2 || gameModifier < -2 ? Math.floor(gameModifier / 2) : 0;

  return {
    baseInitiative,
    finalInitiative: baseInitiative + initiativeAdjustment,
    gameModifier,
    skillModifier,
  };
}

export function calculateWorkbookWeaponParry(
  input: WorkbookWeaponParryInput,
): WorkbookWeaponParryResult | null {
  const rawParry = Math.round(input.parrySkillXp / 2) + 1 + input.dexterityGm;
  const trace = calculateWorkbookPercentageAdjustmentTrace({
    baseValue: rawParry,
    rawModifiers: [
      { label: "armor activity", value: input.armorActivityModifier ?? 0 },
      { label: "weapon parry", value: input.weaponParryModifier },
      ...(input.rawModifiers ?? []),
    ],
  });

  if (trace == null) {
    return null;
  }

  return {
    adjustment: trace.percentageAdjustment,
    combinedModifier: trace.rawModifierTotal,
    finalParry: trace.finalValue,
    rawParry,
    trace,
  };
}

export function calculateWorkbookCombinedParry(
  input: WorkbookCombinedParryInput,
): WorkbookCombinedParryResult | null {
  const rawParry = Math.round(input.parrySkillXp / 2) + 1 + input.dexterityGm;
  const primaryContribution = Math.max(1, input.primaryParryModifier);
  const offHandContribution = Math.max(1, input.offHandParryModifier);
  const trace = calculateWorkbookPercentageAdjustmentTrace({
    baseValue: rawParry,
    rawModifiers: [
      { label: "armor activity", value: input.armorActivityModifier ?? 0 },
      { label: "primary parry", value: primaryContribution },
      { label: "off-hand parry", value: offHandContribution },
      ...(input.rawModifiers ?? []),
    ],
  });

  if (trace == null) {
    return null;
  }

  return {
    adjustment: trace.percentageAdjustment,
    combinedModifier: trace.rawModifierTotal,
    finalParry: trace.finalValue,
    offHandContribution,
    primaryContribution,
    rawParry,
    trace,
  };
}

export function calculateWorkbookCarryCapacity(input: {
  constitution: number;
  size: number;
  strength: number;
}): number {
  return Math.round(input.strength + input.size + 0.5 * input.constitution);
}

export function calculateWorkbookEncumbranceLevel(
  input: WorkbookEncumbranceLevelInput,
): WorkbookEncumbranceLevelResult | null {
  if (input.carryCapacity <= 0) {
    return null;
  }

  const encumbrancePercent = Math.round((input.totalEncumbrance * 100) / input.carryCapacity);
  const encumbranceThresholds = [
    20, 40, 60, 90, 120, 150, 170, 190, 210, 230, 250, 260, 270, 280, 290,
  ];

  return {
    carryCapacity: input.carryCapacity,
    encumbranceLevel: encumbranceThresholds.reduce(
      (sum, threshold) => sum + (encumbrancePercent > threshold ? 1 : 0),
      0,
    ),
    encumbrancePercent,
    totalEncumbrance: input.totalEncumbrance,
  };
}

export function calculateWorkbookMovementModifier(input: WorkbookMovementModifierInput): number {
  return Math.round(input.encumbranceLevel / 2 + (input.shieldMovementModifier ?? 0));
}

export function calculateWorkbookBaseMove(input: {
  dexterityGm: number;
  sizeGm: number;
  strengthGm: number;
}): number {
  return input.sizeGm <= 2
    ? 10 + input.strengthGm + input.dexterityGm + input.sizeGm
    : 10 + input.strengthGm + input.dexterityGm + 2;
}

export function lookupWorkbookMovementAdjustment(
  baseMove: number,
  movementModifier: number,
): number | null {
  if (!Number.isInteger(baseMove) || !Number.isInteger(movementModifier)) {
    return null;
  }

  if (movementModifier <= 0) {
    return 0;
  }

  return WORKBOOK_MOVEMENT_PERCENT_TABLE[baseMove]?.[movementModifier] ?? null;
}

export function calculateWorkbookMovement(input: WorkbookMovementInput): number | null {
  const adjustment = lookupWorkbookMovementAdjustment(input.baseMove, input.movementModifier);

  if (adjustment == null) {
    return null;
  }

  return input.baseMove - adjustment;
}
