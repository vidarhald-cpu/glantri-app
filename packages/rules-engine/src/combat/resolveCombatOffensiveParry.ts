import {
  buildCombatObservationSkillContestContribution,
  type CombatObservationRelationship,
  type CombatSkillContestCalculation,
  type CombatSkillContestPercentageContribution,
  type OpenEndedD20Roll,
} from "@glantri/domain";

import { resolveCombatSkillContest } from "./resolveCombatSkillContest";

export type CombatOffensiveParryBrawlingPurpose =
  | "initial_offensive_parry"
  | "continued_contact_maintenance";

export interface ResolveCombatOffensiveParryBrawlingInput {
  calculationId: string;
  characteristicAverage: number;
  gmAdjustment?: number;
  observationRelationships: readonly CombatObservationRelationship[];
  opponentParticipantId: string;
  participantId: string;
  parryQualityModifier?: number;
  percentageContributions?: readonly CombatSkillContestPercentageContribution[];
  purpose: CombatOffensiveParryBrawlingPurpose;
  roll: OpenEndedD20Roll;
  side: "controller" | "responder";
  skill: { id: string; label: string; totalXp: number };
  unknownSkillPenalty?: number;
}

/**
 * Canonical Brawling Skill Contest adapter for Offensive Parry and Continued Contact.
 *
 * The preceding attack and parry remain Weapon Resolution. This calculation has no
 * weapon OB, DB, shield, Parry, or Movement Modifier inputs. Parry quality is one
 * percentage contribution on the initial controller roll only; maintenance rolls
 * deliberately omit it.
 */
export function resolveCombatOffensiveParryBrawling(
  input: ResolveCombatOffensiveParryBrawlingInput,
): CombatSkillContestCalculation {
  const maintenance = input.purpose === "continued_contact_maintenance";
  const contestType = maintenance
    ? ("continued_contact_maintenance" as const)
    : ("offensive_parry_brawling" as const);
  const role = maintenance
    ? input.side === "controller"
      ? ("continued_contact_controller" as const)
      : ("continued_contact_responder" as const)
    : input.side === "controller"
      ? ("offensive_parry_controller" as const)
      : ("offensive_parry_responder" as const);
  const observationContribution = buildCombatObservationSkillContestContribution({
    contestType,
    observerCombatantId: input.participantId,
    opponentCombatantId: input.opponentParticipantId,
    relationships: input.observationRelationships,
    role,
  });
  const parryQualityModifier =
    !maintenance && input.side === "controller" ? (input.parryQualityModifier ?? 0) : 0;
  const percentageContributions = [
    ...(input.percentageContributions ?? []),
    ...(parryQualityModifier
      ? [
          {
            category: "maneuver" as const,
            id: `${input.calculationId}:parry-quality`,
            label: "Parry quality",
            provenance: "Canonical Offensive Parry quality band",
            sourceId: input.calculationId,
            unit: "percentage" as const,
            value: parryQualityModifier,
          },
        ]
      : []),
    ...(observationContribution ? [observationContribution] : []),
    ...(input.gmAdjustment
      ? [
          {
            category: "gm_adjustment" as const,
            id: `${input.calculationId}:gm-adjustment`,
            label: "GM maneuver adjustment",
            provenance: "Accepted Offensive Parry contest adjustment",
            sourceId: input.calculationId,
            unit: "percentage" as const,
            value: input.gmAdjustment,
          },
        ]
      : []),
  ];

  return resolveCombatSkillContest({
    baseSkillAdjustment: input.unknownSkillPenalty,
    calculationId: input.calculationId,
    contestType,
    governingStat: {
      id: "str_dex_average",
      label: "Strength / Dexterity average",
      value: input.characteristicAverage,
    },
    opponentParticipantId: input.opponentParticipantId,
    participantId: input.participantId,
    percentageContributions,
    role,
    roll: input.roll,
    skill: input.skill,
  });
}
