import type { SkillDefinition } from "@glantri/domain";

import {
  resolveParticipantSkillRollProfile,
  type ParticipantSkillRollProfile,
  type ResolveParticipantSkillRollProfileInput,
} from "../encounters/resolveParticipantSkillRollProfile";

export type CombatFeintMethod = "movement" | "weapon";

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
  if (difference <= -16) {
    return {
      attackerPhase1DbParryModifier: -4,
      band: "defender_strong",
      defenderObDbModifier: 2,
      difference,
    };
  }
  if (difference <= -6) {
    return {
      attackerPhase1DbParryModifier: -2,
      band: "defender_edge",
      defenderObDbModifier: 0,
      difference,
    };
  }
  if (difference <= 0) {
    return {
      attackerPhase1DbParryModifier: -1,
      band: "balanced",
      defenderObDbModifier: 0,
      difference,
    };
  }
  if (difference <= 10) {
    return {
      attackerPhase1DbParryModifier: 0,
      band: "attacker_edge",
      defenderObDbModifier: -2,
      difference,
    };
  }
  return {
    attackerPhase1DbParryModifier: 0,
    band: "attacker_strong",
    defenderObDbModifier: -4,
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
        right.rollBaseValue - left.rollBaseValue || left.skillName.localeCompare(right.skillName),
    )[0];
}
