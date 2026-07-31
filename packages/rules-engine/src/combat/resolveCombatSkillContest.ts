import {
  combatSkillContestCalculationSchema,
  combatSkillContestPercentageContributionSchema,
  type CombatSkillContestCalculation,
  type CombatSkillContestModifierCategory,
  type CombatSkillContestPercentageContribution,
  type CombatSkillContestRole,
  type CombatSkillContestType,
  type OpenEndedD20Roll,
} from "@glantri/domain";

import { calculateWorkbookPercentageAdjustmentTrace } from "./workbookCombatMath";

export interface ResolveCombatSkillContestInput {
  baseSkillAdjustment?: number;
  calculationId: string;
  contestType: CombatSkillContestType;
  governingStat: {
    id?: string;
    label: string;
    value: number;
  };
  missingContributionPoints?: readonly CombatSkillContestModifierCategory[];
  opponentParticipantId?: string;
  participantId: string;
  percentageContributions?: readonly CombatSkillContestPercentageContribution[];
  role: CombatSkillContestRole;
  roll: OpenEndedD20Roll;
  skill: {
    id?: string;
    label: string;
    totalXp: number;
  };
  visibility?: CombatSkillContestCalculation["visibility"];
}

/**
 * Canonical resolver for opposed combat Skill Contests.
 *
 * It composes the existing total-XP skill profile with the workbook-faithful
 * percentage-adjustment lookup. It deliberately has no access to weapon OB, DB,
 * shield, Parry, or other Weapon Resolution facts.
 */
export function resolveCombatSkillContest(
  input: ResolveCombatSkillContestInput,
): CombatSkillContestCalculation {
  const contributionsById = new Map<string, CombatSkillContestPercentageContribution>();
  for (const contribution of input.percentageContributions ?? []) {
    const parsed = combatSkillContestPercentageContributionSchema.parse(contribution);
    if (!contributionsById.has(parsed.id)) {
      contributionsById.set(parsed.id, parsed);
    }
  }
  const percentageContributions = [...contributionsById.values()];
  const baseSkill =
    input.governingStat.value + input.skill.totalXp + (input.baseSkillAdjustment ?? 0);
  const percentageTrace = calculateWorkbookPercentageAdjustmentTrace({
    baseValue: baseSkill,
    rawModifiers: percentageContributions.map((contribution) => ({
      label: contribution.label,
      value: contribution.value,
    })),
  });
  if (!percentageTrace) {
    throw new RangeError("Skill Contest modifiers are outside the canonical workbook table.");
  }
  const missingContributionPoints = [...new Set(input.missingContributionPoints ?? [])];
  const preDieTotal = percentageTrace.finalValue;

  return combatSkillContestCalculationSchema.parse({
    baseSkill,
    calculationId: input.calculationId,
    completeness: missingContributionPoints.length > 0 ? "partial" : "complete",
    contestType: input.contestType,
    derivedIntegerAdjustment: preDieTotal - baseSkill,
    finalResult: preDieTotal + input.roll.dieResult,
    governingStat: input.governingStat,
    missingContributionPoints,
    openEndedDie: {
      openEndedD10s: input.roll.openEndedD10s,
      rollD20: input.roll.rollD20,
      rollTotal: input.roll.dieResult,
    },
    opponentParticipantId: input.opponentParticipantId,
    participantId: input.participantId,
    percentageContributions,
    preDieTotal,
    role: input.role,
    skill: input.skill,
    totalPercentageAdjustment: percentageTrace.rawModifierTotal,
    visibility: input.visibility ?? "roller_and_gm",
  });
}
