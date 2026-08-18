import {
  buildRoleplayCalculationPreview,
  getSkillRollSuccessLevel,
  getStatRollSuccessLevel,
  rollOpenEndedD20,
  type CombatGenericActionRollRequest,
  type CombatGenericActionRollResult,
  type OpenEndedD20Roll,
} from "@glantri/domain";

export function resolveGenericCombatActionRoll(input: {
  request: CombatGenericActionRollRequest;
  roll?: OpenEndedD20Roll;
  rolledAt: string;
  rolledByUserId?: string;
}): CombatGenericActionRollResult {
  const roll = input.roll ?? rollOpenEndedD20();
  const basis = input.request.basis;
  const preview = buildRoleplayCalculationPreview({
    kind: basis.kind,
    roll,
    skillLabel: basis.kind === "skill" ? basis.skillLabel : basis.statLabel,
    skillValue: basis.baseValue,
  });
  const finalTotal = preview.finalTotal;
  if (finalTotal == null) throw new RangeError("The Combat action roll could not be resolved.");
  const level =
    basis.kind === "skill"
      ? getSkillRollSuccessLevel(finalTotal, roll.rollD20)
      : getStatRollSuccessLevel(finalTotal, roll.rollD20);

  return {
    achievedLevelId: level.id,
    achievedLevelLabel: level.label,
    calculationText: `${preview.calculationText} vs Difficulty ${input.request.difficulty}`,
    dieResult: roll.dieResult,
    finalTotal,
    openEndedD10s: roll.openEndedD10s,
    rollD20: roll.rollD20,
    rolledAt: input.rolledAt,
    rolledByUserId: input.rolledByUserId,
    success: !level.fumble && finalTotal >= input.request.difficulty,
  };
}
