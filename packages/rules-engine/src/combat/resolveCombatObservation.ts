import type { SkillDefinition } from "@glantri/domain";

import {
  resolveParticipantSkillRollProfile,
  resolveParticipantStatRollProfile,
  type ParticipantSkillRollProfile,
  type ResolveParticipantSkillRollProfileInput,
} from "../encounters/resolveParticipantSkillRollProfile";
import { isCombatFeintResistanceSkill } from "./resolveCombatFeint";

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
 * #948. The data an Observe Opponent basis cannot be derived without.
 *
 * The enumeration follows the rule rather than the actor's kind. The basis is
 * `linked-characteristic average + skill XP + unknown-skill penalty`, and Observe Opponent
 * substitutes Intelligence for the skill's ordinary linked characteristic, so the actor's
 * Intelligence value is the one datum the basis has no rule to answer without. Everything else
 * the basis reads has a rule for its absence and is therefore **not** missing data:
 *
 * - an unknown Observe skill is answered by the −3 unknown-skill default, a rule result;
 * - absent Combat modifiers resolve to a total of 0, which is a real total, not a substitute;
 * - a resulting negative basis is a valid derived figure (#922) and resolves without review.
 *
 * Deliberately not part of the enumeration: `entityId` (null by design for a temporary actor),
 * `characterId`, and the presence of a full Character build. A Template or monster actor carrying
 * Stats in its persisted snapshot derives an Intelligence value and is supported here.
 */
export const COMBAT_OBSERVATION_REQUIRED_BASIS_DATA = ["intelligence_characteristic"] as const;
export type CombatObservationRequiredBasisDatum =
  (typeof COMBAT_OBSERVATION_REQUIRED_BASIS_DATA)[number];

/**
 * Names the required Observation data this actor does not have. An empty result means the basis
 * is derivable from present data, whatever its sign and whatever kind of actor this is.
 */
export function findMissingCombatObservationBasisData(input: {
  build?: unknown;
  sheetSummary?: unknown;
  snapshot?: unknown;
}): readonly CombatObservationRequiredBasisDatum[] {
  const intelligence = resolveParticipantStatRollProfile({
    build: input.build,
    sheetSummary: input.sheetSummary,
    snapshot: input.snapshot,
    statId: "int",
  });
  return intelligence.statValue == null ? ["intelligence_characteristic"] : [];
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
