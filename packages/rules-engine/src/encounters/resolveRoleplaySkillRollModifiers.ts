import { resolveWorkbookPercentageAdjustment } from "../combat/workbookCombatMath";

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
  const adjustment = resolveWorkbookPercentageAdjustment(skillTotal, absoluteModifier);

  if (adjustment == null) {
    // #922. This is no longer reachable from this entry point, and it is kept rather than deleted
    // because unreachable is not a safety property. After the Product Owner's ruling (comment
    // 20793) the rule answers a base below zero, so the only remaining no-answer is a non-integer
    // figure — and `normalizeInteger` above truncates both the skill total and every modifier
    // value before the lookup sees them, which the spec asserts rather than assumes. The reaction
    // stays a warning plus no modifier rather than a silent zero: this pipeline has a warning
    // channel, so an unapplied modifier is disclosed on it.
    warnings.push(
      `No percentage modifier table entry for skill total ${skillTotal} and raw modifier ${rawModifierSum}.`,
    );

    return {
      appliedModifiers,
      percentageModifier: 0,
      rawModifierSum,
      warnings,
    };
  }

  if (adjustment.extrapolated) {
    // #922. This path reached the open edge on the **base** axis: a skill total is total skill XP
    // and routinely exceeds the authored grid's last row of 49, where this used to drop the
    // modifier to zero and warn that no entry existed. The modifier now applies, by the
    // open-ended rule, and the extrapolation is flagged for review on the channel this pipeline
    // already carries.
    warnings.push(
      `Percentage modifier ${adjustment.value} for skill total ${skillTotal} and raw modifier ${rawModifierSum} was extrapolated past the authored table (${adjustment.extrapolatedAxes.join(
        ", ",
      )}). Review the figure.`,
    );
  }

  return {
    appliedModifiers,
    percentageModifier: rawModifierSum >= 0 ? adjustment.value : -adjustment.value,
    rawModifierSum,
    warnings,
  };
}
