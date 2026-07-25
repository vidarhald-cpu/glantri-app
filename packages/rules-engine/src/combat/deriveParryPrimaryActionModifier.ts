export interface ParryPrimaryActionModifier {
  dodgeSkillValue: number;
  percentageModifier: number;
  roundingRule: "floor_one_fifth";
}

/**
 * Parry's declaration benefit is one fifth of the canonical total Dodge skill,
 * rounded down, expressed as a raw percentage modifier for workbook combat math.
 */
export function deriveParryPrimaryActionModifier(
  dodgeSkillValue: number,
): ParryPrimaryActionModifier {
  if (!Number.isInteger(dodgeSkillValue) || dodgeSkillValue < 0) {
    throw new RangeError("Parry requires a non-negative whole-number Dodge skill.");
  }

  return {
    dodgeSkillValue,
    percentageModifier: Math.floor(dodgeSkillValue / 5),
    roundingRule: "floor_one_fifth",
  };
}
