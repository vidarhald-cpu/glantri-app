import {
  combatSkillContestCalculationSchema,
  combatSkillContestPreviewSchema,
  combatSkillContestPercentageContributionSchema,
  type CombatSkillContestCalculation,
  type CombatSkillContestPreview,
  type CombatSkillContestModifierCategory,
  type CombatSkillContestPercentageContribution,
  type CombatSkillContestRole,
  type CombatSkillContestType,
  type CombatMovementBurdenSnapshot,
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
  movementBurden?: CombatMovementBurdenSnapshot;
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

export type ResolveCombatSkillContestPreviewInput = Omit<
  ResolveCombatSkillContestInput,
  "calculationId" | "movementBurden" | "opponentParticipantId" | "roll" | "visibility"
>;

export function resolveCombatSkillContestPreview(
  input: ResolveCombatSkillContestPreviewInput,
): CombatSkillContestPreview {
  const contributionsById = new Map<string, CombatSkillContestPercentageContribution>();
  for (const contribution of input.percentageContributions ?? []) {
    const parsed = combatSkillContestPercentageContributionSchema.parse(contribution);
    if (!contributionsById.has(parsed.id)) contributionsById.set(parsed.id, parsed);
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
  const missingFacts = [...new Set(input.missingContributionPoints ?? [])];

  return combatSkillContestPreviewSchema.parse({
    baseSkill,
    completeness: missingFacts.length > 0 ? "partial" : "complete",
    contestType: input.contestType,
    derivedIntegerAdjustment: percentageTrace.finalValue - baseSkill,
    governingStat: input.governingStat,
    missingFacts,
    participantId: input.participantId,
    percentageContributions,
    preDieTotal: percentageTrace.finalValue,
    role: input.role,
    schemaVersion: 1,
    skill: input.skill,
    totalPercentageAdjustment: percentageTrace.rawModifierTotal,
  });
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
  const preview = resolveCombatSkillContestPreview(input);
  const baseSkill = preview.baseSkill!;
  const preDieTotal = preview.preDieTotal!;

  return combatSkillContestCalculationSchema.parse({
    baseSkill,
    calculationId: input.calculationId,
    completeness: preview.completeness,
    contestType: input.contestType,
    derivedIntegerAdjustment: preview.derivedIntegerAdjustment,
    finalResult: preDieTotal + input.roll.dieResult,
    governingStat: input.governingStat,
    missingContributionPoints: preview.missingFacts,
    movementBurden: input.movementBurden,
    openEndedDie: {
      openEndedD10s: input.roll.openEndedD10s,
      rollD20: input.roll.rollD20,
      rollTotal: input.roll.dieResult,
    },
    opponentParticipantId: input.opponentParticipantId,
    participantId: input.participantId,
    percentageContributions: preview.percentageContributions,
    preDieTotal,
    role: input.role,
    skill: input.skill,
    totalPercentageAdjustment: preview.totalPercentageAdjustment,
    visibility: input.visibility ?? "roller_and_gm",
  });
}
