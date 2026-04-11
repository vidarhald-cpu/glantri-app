import { getWorkbookCharacterSheetGm } from "../stats/characteristicGms";

const WORKBOOK_PERCENTAGE_ADJUSTMENT_TABLE: Record<number, Record<number, number>> = {
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
const WORKBOOK_SKILL_INITIATIVE_MODIFIERS: Record<number, number> = {
  1: -5,
  2: -4,
  3: -4,
  4: -3,
  5: -3,
  6: -2,
  7: -2,
  8: -1,
  9: -1,
  10: 0,
  11: 0,
  12: 0,
  13: 1,
  14: 1,
  15: 2,
  16: 2,
  17: 3,
  18: 3,
  19: 4,
  20: 4,
  21: 5,
  22: 5,
  23: 6,
  24: 6,
  25: 7,
};

export interface WorkbookMeleeObInput {
  armorActivityModifier?: number | null;
  dexterityGm: number;
  skillXp: number;
  strengthGm: number;
  weaponOb: number;
}

export interface WorkbookMeleeObResult {
  adjustment: number;
  combinedModifier: number;
  finalOb: number;
  rawOb: number;
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

export function getWorkbookCappedStrengthObModifier(strengthGm: number): number {
  return Math.min(strengthGm, 4);
}

export function getWorkbookStatGm(value: number | null | undefined): number | null {
  if (value == null) {
    return null;
  }

  return getWorkbookCharacterSheetGm(value);
}

export function lookupWorkbookPercentageAdjustment(
  rawOb: number,
  absoluteModifier: number,
): number | null {
  if (absoluteModifier === 0) {
    return 0;
  }

  if (!Number.isInteger(rawOb) || !Number.isInteger(absoluteModifier)) {
    return null;
  }

  return WORKBOOK_PERCENTAGE_ADJUSTMENT_TABLE[rawOb]?.[absoluteModifier] ?? null;
}

export function calculateWorkbookMeleeOb(
  input: WorkbookMeleeObInput,
): WorkbookMeleeObResult | null {
  const rawOb =
    Math.round(input.skillXp / 2) +
    1 +
    Math.max(getWorkbookCappedStrengthObModifier(input.strengthGm), input.dexterityGm);
  const combinedModifier = (input.armorActivityModifier ?? 0) + input.weaponOb;
  const adjustment = lookupWorkbookPercentageAdjustment(rawOb, Math.abs(combinedModifier));

  if (adjustment == null) {
    return null;
  }

  return {
    adjustment,
    combinedModifier,
    finalOb: combinedModifier >= 0 ? rawOb + adjustment : rawOb - adjustment,
    rawOb,
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
      rawDmb +
      (referenceOb - workbookOb.finalOb) -
      (WORKBOOK_REFERENCE_WEAPON_OB - input.weaponOb),
    rawDmb,
    referenceOb,
    workbookOb,
  };
}

export function lookupWorkbookSkillInitiativeModifier(skillXp: number): number | null {
  if (!Number.isInteger(skillXp)) {
    return null;
  }

  return WORKBOOK_SKILL_INITIATIVE_MODIFIERS[skillXp] ?? null;
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
