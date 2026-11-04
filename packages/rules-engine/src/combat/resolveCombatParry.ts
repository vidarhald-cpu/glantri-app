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

  if (rawModifiers.length > 0 && trace === null) {
    // #922. A no-answer used to fall through as `modifierAdjustment: 0` and `rawModifierTotal: 0`,
    // which reports a parry resolved with no modifiers rather than a parry whose modifiers were
    // dropped — the caller cannot tell those apart, and the parry total is wrong either way. The
    // settled rule removes the cause a parry base below zero used to be; the remaining cause is a
    // non-integer figure, which this resolver already refuses for its own two inputs above. So it
    // refuses the same way here rather than resolving on a figure it knows is wrong.
    throw new RangeError(
      "Combat parry modifiers are outside the canonical workbook calculation's readable range.",
    );
  }

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
