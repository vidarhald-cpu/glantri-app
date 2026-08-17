import {
  resolveWeaponDisarmMismatch,
  type CombatDisarmCharacteristicChoice,
  type CombatDisarmSkillChoice,
  type CombatSkillContestCalculation,
  type CombatSkillContestPercentageContribution,
  type OpenEndedD20Roll,
} from "@glantri/domain";

import { resolveCombatSkillContest } from "./resolveCombatSkillContest";

export interface CombatDisarmConditionInput {
  id: string;
  kind: "stunned" | "unbalanced";
  sourceId: string;
}

export interface ResolveCombatDisarmRollInput {
  actingParryModifier?: number;
  actingWeaponControlRating: number;
  calculationId: string;
  characteristic: {
    choice: CombatDisarmCharacteristicChoice;
    value: number;
  };
  conditions?: readonly CombatDisarmConditionInput[];
  contactQualityModifier?: number;
  gmAdjustment?: number;
  opponentParticipantId: string;
  participantId: string;
  role: "actor" | "holder";
  roll: OpenEndedD20Roll;
  skill: {
    choice: CombatDisarmSkillChoice;
    id: string;
    label: string;
    totalXp: number;
  };
  targetWeaponControlRating: number;
}

export function buildCombatDisarmConditionContributions(input: {
  calculationId: string;
  conditions?: readonly CombatDisarmConditionInput[];
  role: "actor" | "holder";
}): CombatSkillContestPercentageContribution[] {
  if (input.role !== "holder") return [];
  const byId = new Map<string, CombatSkillContestPercentageContribution>();
  for (const condition of input.conditions ?? []) {
    const contribution: CombatSkillContestPercentageContribution = {
      category: "condition",
      id: `${input.calculationId}:condition:${condition.id}`,
      label: condition.kind === "stunned" ? "Stunned resistance" : "Unbalanced resistance",
      provenance:
        condition.kind === "stunned"
          ? "Typed Stunned condition · Disarm resistance only"
          : "Canonical Unbalanced condition · Disarm resistance",
      sourceId: condition.sourceId,
      unit: "percentage",
      value: -2,
    };
    if (!byId.has(contribution.id)) byId.set(contribution.id, contribution);
  }
  return [...byId.values()];
}

function buildWeaponContributions(
  input: ResolveCombatDisarmRollInput,
): CombatSkillContestPercentageContribution[] {
  if (input.role !== "actor") return [];
  const mismatch = resolveWeaponDisarmMismatch({
    actingControlRating: input.actingWeaponControlRating,
    targetControlRating: input.targetWeaponControlRating,
  });
  if (!mismatch.feasible) {
    throw new RangeError("The target weapon is too difficult to control with this weapon.");
  }
  const contributions: CombatSkillContestPercentageContribution[] = [
    {
      category: "weapon_control",
      id: `${input.calculationId}:weapon-control`,
      label: "Weapon-control mismatch",
      provenance: `Target ${input.targetWeaponControlRating} vs acting ${input.actingWeaponControlRating}`,
      sourceId: input.calculationId,
      unit: "percentage",
      value: mismatch.modifier,
    },
    {
      category: "maneuver",
      id: `${input.calculationId}:acting-parry`,
      label: "Acting weapon Parry",
      provenance: "Canonical acting weapon Parry modifier",
      sourceId: input.calculationId,
      unit: "percentage",
      value: input.actingParryModifier ?? 0,
    },
    {
      category: "maneuver",
      id: `${input.calculationId}:contact-quality`,
      label: "Contact quality",
      provenance: "Combat source p. 8 contact-quality band",
      sourceId: input.calculationId,
      unit: "percentage",
      value: input.contactQualityModifier ?? 0,
    },
  ];
  const sourceTotal = contributions.reduce((total, contribution) => total + contribution.value, 0);
  if (sourceTotal > 4) {
    contributions.push({
      category: "maneuver",
      id: `${input.calculationId}:source-cap`,
      label: "Disarm source cap",
      provenance: "Combat source p. 8 maximum combined +4%",
      sourceId: input.calculationId,
      unit: "percentage",
      value: 4 - sourceTotal,
    });
  }
  return contributions;
}

/**
 * Canonical Disarm opposed Skill Contest adapter. The selected weapon-skill-or-Parry
 * and Strength-or-Dexterity choices remain separate snapshot facts.
 */
export function resolveCombatDisarmRoll(
  input: ResolveCombatDisarmRollInput,
): CombatSkillContestCalculation {
  const percentageContributions = [
    ...buildWeaponContributions(input),
    ...buildCombatDisarmConditionContributions(input),
    ...(input.gmAdjustment
      ? [
          {
            category: "gm_adjustment" as const,
            id: `${input.calculationId}:gm-adjustment`,
            label: "GM Disarm adjustment",
            provenance: "Accepted GM situational adjustment",
            sourceId: input.calculationId,
            unit: "percentage" as const,
            value: input.gmAdjustment,
          },
        ]
      : []),
  ];

  return resolveCombatSkillContest({
    calculationId: input.calculationId,
    contestType: "disarm",
    governingStat: {
      id: input.characteristic.choice,
      label: input.characteristic.choice === "strength" ? "Strength" : "Dexterity",
      value: input.characteristic.value,
    },
    opponentParticipantId: input.opponentParticipantId,
    participantId: input.participantId,
    percentageContributions,
    role: input.role === "actor" ? "disarm_actor" : "disarm_holder",
    roll: input.roll,
    skill: {
      id: input.skill.id,
      label: input.skill.label,
      totalXp: input.skill.totalXp,
    },
  });
}
