import {
  calculateWorkbookPercentageAdjustmentTrace,
  type WorkbookRawModifier,
} from "./workbookCombatMath";

export interface ResolveCombatParryInput {
  parryBase: number;
  rawModifiers?: readonly WorkbookRawModifier[];
  rollTotal: number;
  targetNumber?: number;
}

export interface CombatParryResolution {
  modifierAdjustment: number;
  parryBase: number;
  rawModifierTotal: number;
  rawModifiers: readonly WorkbookRawModifier[];
  success: boolean;
  targetNumber: number;
  total: number;
}

export function resolveCombatParry(input: ResolveCombatParryInput): CombatParryResolution {
  if (!Number.isInteger(input.parryBase)) {
    throw new RangeError("Combat parry base must be an integer.");
  }

  if (!Number.isInteger(input.rollTotal)) {
    throw new RangeError("Combat parry roll total must be an integer.");
  }

  const targetNumber = input.targetNumber ?? 21;
  const rawModifiers = input.rawModifiers?.filter((modifier) => modifier.value !== 0) ?? [];
  const trace = calculateWorkbookPercentageAdjustmentTrace({
    baseValue: input.parryBase,
    rawModifiers,
  });
  const modifierAdjustment = trace ? trace.finalValue - input.parryBase : 0;
  const total = input.parryBase + modifierAdjustment + input.rollTotal;

  return {
    modifierAdjustment,
    parryBase: input.parryBase,
    rawModifierTotal: trace?.rawModifierTotal ?? 0,
    rawModifiers,
    success: total >= targetNumber,
    targetNumber,
    total,
  };
}
