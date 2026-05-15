import { lookupWorkbookPercentageAdjustment } from "../combat/workbookCombatMath";

export type RoleplaySkillRollModifierBucket = "general" | "obSkill" | "db" | "other";
export type RoleplaySkillRollModifierSource =
  | "manual"
  | "characterState"
  | "situationMap"
  | "equipment"
  | "gmOverride";

export interface RoleplaySkillRollModifierEntry {
  bucket: RoleplaySkillRollModifierBucket;
  label: string;
  notes?: string;
  source: RoleplaySkillRollModifierSource;
  value: number;
}

export interface RoleplaySkillRollModifierPipelineResult {
  appliedModifiers: RoleplaySkillRollModifierEntry[];
  percentageModifier: number;
  rawModifierSum: number;
  warnings: string[];
}

function normalizeInteger(value: number): number {
  return Number.isFinite(value) ? Math.trunc(value) : 0;
}

export function resolveRoleplaySkillRollModifiers(input: {
  modifiers?: RoleplaySkillRollModifierEntry[];
  skillTotal: number;
}): RoleplaySkillRollModifierPipelineResult {
  const skillTotal = normalizeInteger(input.skillTotal);
  const warnings: string[] = [];
  const appliedModifiers = (input.modifiers ?? []).map((modifier) => ({
    ...modifier,
    value: normalizeInteger(modifier.value),
  }));
  const rawModifierSum = appliedModifiers.reduce((sum, modifier) => sum + modifier.value, 0);

  if (rawModifierSum === 0) {
    return {
      appliedModifiers,
      percentageModifier: 0,
      rawModifierSum,
      warnings,
    };
  }

  const absoluteModifier = Math.abs(rawModifierSum);
  const adjustment = lookupWorkbookPercentageAdjustment(skillTotal, absoluteModifier);

  if (adjustment == null) {
    warnings.push(
      `No percentage modifier table entry for skill total ${skillTotal} and raw modifier ${rawModifierSum}.`
    );

    return {
      appliedModifiers,
      percentageModifier: 0,
      rawModifierSum,
      warnings,
    };
  }

  return {
    appliedModifiers,
    percentageModifier: rawModifierSum >= 0 ? adjustment : -adjustment,
    rawModifierSum,
    warnings,
  };
}
