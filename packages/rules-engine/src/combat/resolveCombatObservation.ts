import type { SkillDefinition } from "@glantri/domain";

import {
  resolveParticipantSkillRollProfile,
  type ParticipantSkillRollProfile,
  type ResolveParticipantSkillRollProfileInput,
} from "../encounters/resolveParticipantSkillRollProfile";
import {
  isCombatFeintResistanceSkill,
} from "./resolveCombatFeint";

export interface CombatObservationSkillProfile {
  baseValue: number;
  intelligenceValue: number;
  intelligenceXp: number;
  profile: ParticipantSkillRollProfile;
  skillXp: number;
  skillId: string;
  skillLabel: string;
}

/**
 * Observe Opponent uses the better of Dodge and the best close-combat skill, with Intelligence
 * substituted for the skill's ordinary linked characteristic.
 */
export function resolveCombatObservationSkillProfile(
  input: Omit<ResolveParticipantSkillRollProfileInput, "skill"> & {
    skills: SkillDefinition[];
  },
): CombatObservationSkillProfile | undefined {
  const dodge = input.skills.find((skill) => skill.id === "dodge");
  const candidates: ParticipantSkillRollProfile[] = [];
  if (dodge) {
    const profile = resolveParticipantSkillRollProfile({
      ...input,
      linkedStatsOverride: ["int"],
      preferAdjustedStats: true,
      skill: dodge,
    });
    candidates.push(profile);
  }
  for (const skill of input.skills.filter(isCombatFeintResistanceSkill)) {
    const profile = resolveParticipantSkillRollProfile({
      ...input,
      linkedStatsOverride: ["int"],
      preferAdjustedStats: true,
      skill,
    });
    candidates.push(profile);
  }

  const profile = candidates.sort(
    (left, right) =>
      right.avgStats +
        right.totalXP +
        right.unknownSkillPenalty -
        (left.avgStats + left.totalXP + left.unknownSkillPenalty) ||
      left.skillName.localeCompare(right.skillName),
  )[0];
  return profile
    ? {
        baseValue: profile.avgStats + profile.totalXP + profile.unknownSkillPenalty,
        intelligenceValue: profile.baseAvgStats,
        intelligenceXp: profile.linkedStatXp,
        profile,
        skillXp: profile.totalXP + profile.unknownSkillPenalty,
        skillId: profile.skillId,
        skillLabel: profile.skillName,
      }
    : undefined;
}
