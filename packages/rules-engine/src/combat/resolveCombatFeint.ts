import {
  buildCombatObservationSkillContestContribution,
  COMBAT_FEINT_OUTCOME_TABLE,
  resolveCombatModifierContributions,
  type CombatObservationRelationship,
  type CombatCalculationContext,
  type CombatModifierContribution,
  type CombatSkillContestCalculation,
  type CombatSkillContestPreview,
  type CombatSkillContestPercentageContribution,
  type OpenEndedD20Roll,
  type SkillDefinition,
} from "@glantri/domain";

import {
  resolveParticipantSkillRollProfile,
  type ParticipantSkillRollProfile,
  type ResolveParticipantSkillRollProfileInput,
} from "../encounters/resolveParticipantSkillRollProfile";
import {
  resolveCombatSkillContest,
  resolveCombatSkillContestPreview,
} from "./resolveCombatSkillContest";

export type CombatFeintMethod = "movement" | "weapon";

export interface ResolveCombatFeintSkillContestInput {
  calculationId: string;
  governingStatValue: number;
  gmAdjustment?: number;
  method: CombatFeintMethod;
  observationRelationships: readonly CombatObservationRelationship[];
  opponentParticipantId: string;
  participantId: string;
  percentageContributions?: readonly CombatSkillContestPercentageContribution[];
  roll: OpenEndedD20Roll;
  side: "initiator" | "defender";
  skill: { id: string; label: string; totalXp: number };
  unknownSkillPenalty?: number;
}

/**
 * Canonical Feint adapter over the shared Skill Contest resolver.
 *
 * Weapon-derived OB/DB/shield/Parry and Movement Modifier are deliberately absent
 * from the contract. The only automatic relationship contribution is the defending
 * observer's one directional defensive-maneuver contribution.
 */
export function resolveCombatFeintSkillContest(
  input: ResolveCombatFeintSkillContestInput,
): CombatSkillContestCalculation {
  const contestType = input.method === "movement" ? "movement_feint" : "weapon_feint";
  const role =
    input.side === "defender"
      ? "feint_defender"
      : input.method === "movement"
        ? "movement_feint_initiator"
        : "weapon_feint_initiator";
  const relationshipContribution = buildCombatObservationSkillContestContribution({
    contestType,
    observerCombatantId: input.participantId,
    opponentCombatantId: input.opponentParticipantId,
    relationships: input.observationRelationships,
    role,
  });
  const percentageContributions = [
    ...(input.percentageContributions ?? []),
    ...(relationshipContribution ? [relationshipContribution] : []),
    ...(input.gmAdjustment
      ? [
          {
            category: "gm_adjustment" as const,
            id: `${input.calculationId}:gm-adjustment`,
            label: "GM maneuver adjustment",
            provenance: "Accepted Feint feasibility review",
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
      id: input.side === "defender" ? "int" : "dex",
      label: input.side === "defender" ? "Intelligence" : "Dexterity",
      value: input.governingStatValue,
    },
    missingContributionPoints: input.side === "initiator" ? ["withdrawal_backout"] : [],
    opponentParticipantId: input.opponentParticipantId,
    participantId: input.participantId,
    percentageContributions,
    role,
    roll: input.roll,
    skill: input.skill,
  });
}

export interface ResolveCombatFeintSkillPreviewInput {
  context: CombatCalculationContext;
  governingStatValue: number;
  method: CombatFeintMethod;
  modifierContributions?: readonly CombatModifierContribution[];
  observationRelationshipIds?: ReadonlySet<string>;
  participantId: string;
  skill: { id: string; label: string; totalXp: number };
  unknownSkillPenalty?: number;
}

/** Canonical pre-roll Feint profile. It never includes rolls, opponent totals, MM, or weapon data. */
export function resolveCombatFeintSkillPreview(
  input: ResolveCombatFeintSkillPreviewInput,
): CombatSkillContestPreview {
  const contributions = (input.modifierContributions ?? []).filter(
    (contribution) => !input.observationRelationshipIds?.has(contribution.sourceId ?? ""),
  );
  const rows = [
    ...resolveCombatModifierContributions({
      bucket: "general_fatigue",
      context: input.context,
      contributions,
    }).rows,
    ...resolveCombatModifierContributions({
      bucket: "skill_ob",
      context: input.context,
      contributions,
    }).rows,
  ];

  return resolveCombatSkillContestPreview({
    baseSkillAdjustment: input.unknownSkillPenalty,
    contestType: input.method === "movement" ? "movement_feint" : "weapon_feint",
    governingStat: { id: "dex", label: "Dexterity", value: input.governingStatValue },
    participantId: input.participantId,
    percentageContributions: rows
      .filter((row) => row.value !== 0)
      .map((row) => ({
        category: row.bucket === "skill_ob" ? ("skill_ob" as const) : ("general_fatigue" as const),
        id: row.id,
        label: row.label,
        provenance: row.sourceKind,
        sourceId: row.sourceId,
        unit: "percentage" as const,
        value: row.value,
      })),
    role: input.method === "movement" ? "movement_feint_initiator" : "weapon_feint_initiator",
    skill: input.skill,
  });
}

export interface CombatFeintTableResult {
  attackerPhase1DbParryModifier: number;
  band: "defender_strong" | "defender_edge" | "balanced" | "attacker_edge" | "attacker_strong";
  defenderObDbModifier: number;
  difference: number;
}

/** Canonical Finte-angrip table. Difference is attacker final total minus defender final total. */
export function resolveCombatFeintTable(difference: number): CombatFeintTableResult {
  if (!Number.isInteger(difference)) {
    throw new RangeError("Feint difference must be an integer.");
  }
  const row = COMBAT_FEINT_OUTCOME_TABLE.find(
    (candidate) => candidate.maximumDifference === null || difference <= candidate.maximumDifference,
  );
  if (!row) throw new RangeError("Feint difference is outside the canonical outcome table.");
  return {
    attackerPhase1DbParryModifier: row.attackerPhase1DbParryModifier,
    band: row.band,
    defenderObDbModifier: row.defenderPhase2ObDbModifier,
    difference,
  };
}

export function resolveCombatFeintSkillProfile(
  input: ResolveParticipantSkillRollProfileInput & { characteristic: "dex" | "int" },
): ParticipantSkillRollProfile {
  return resolveParticipantSkillRollProfile({
    ...input,
    linkedStatsOverride: [input.characteristic],
  });
}

const CLOSE_COMBAT_GROUP_IDS = new Set([
  "combat_group",
  "basic_melee_training",
  "advanced_melee_training",
  "mounted_warrior_training",
]);
const NON_RESISTANCE_SKILL_IDS = new Set(["dodge", "parry"]);

export function isCombatFeintResistanceSkill(skill: SkillDefinition): boolean {
  return (
    skill.categoryId === "combat" &&
    !NON_RESISTANCE_SKILL_IDS.has(skill.id) &&
    skill.groupIds.some((groupId) => CLOSE_COMBAT_GROUP_IDS.has(groupId))
  );
}

export function resolveHighestCombatFeintResistanceProfile(
  input: Omit<ResolveParticipantSkillRollProfileInput, "skill"> & { skills: SkillDefinition[] },
): ParticipantSkillRollProfile | undefined {
  return input.skills
    .filter(isCombatFeintResistanceSkill)
    .map((skill) =>
      resolveCombatFeintSkillProfile({
        ...input,
        characteristic: "int",
        skill,
      }),
    )
    .sort(
      (left, right) =>
        right.totalXP - left.totalXP || left.skillName.localeCompare(right.skillName),
    )[0];
}
