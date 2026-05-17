import type {
  CharacterProgression,
  RolledCharacterProfile,
  SkillDefinition,
  SkillSpecialization
} from "@glantri/domain";
import { getSkillGroupIds } from "@glantri/domain";

import { STANDARD_CHARGEN_METHOD_POLICY } from "../policy";
import { getResolvedProfileStats } from "../statResolution";
import type { CanonicalContentShape } from "./_helpers";

export const ORDINARY_SKILL_POINT_COST = 2;
export const SECONDARY_SKILL_POINT_COST = 1;
export const LEGACY_GROUP_POINT_COST = 4;
export const NEW_SPECIALIZATION_COST = 4;
export const EXISTING_SPECIALIZATION_COST = 2;

export function getSkillSpendCost(skill: SkillDefinition): number {
  return skill.category === "secondary" ? SECONDARY_SKILL_POINT_COST : ORDINARY_SKILL_POINT_COST;
}

export function getSpecializationSpendCost(exists: boolean): number {
  return exists ? EXISTING_SPECIALIZATION_COST : NEW_SPECIALIZATION_COST;
}

export function getSelectedSkillIdsForGroupSlot(input: {
  groupId: string;
  progression: CharacterProgression;
  slotId: string;
}): string[] {
  return (
    input.progression.chargenSelections?.selectedGroupSlots.find(
      (selection) => selection.groupId === input.groupId && selection.slotId === input.slotId
    )?.selectedSkillIds ?? []
  );
}

export function getActiveGroupSkillCost(input: {
  content: CanonicalContentShape;
  groupId: string;
  progression: CharacterProgression;
}): { cost?: number; error?: string } {
  const group = input.content.skillGroups.find((candidate) => candidate.id === input.groupId);

  if (!group) {
    return { error: "Skill group definition not found." };
  }

  const skillsById = new Map(input.content.skills.map((skill) => [skill.id, skill]));
  const fixedGroupSkillIds = (group.skillMemberships ?? []).map((membership) => membership.skillId);
  const hasSelectionSlots = (group.selectionSlots?.length ?? 0) > 0;
  const activeSkillIds = new Set(
    fixedGroupSkillIds.length > 0
      ? fixedGroupSkillIds
      : hasSelectionSlots
        ? []
      : input.content.skills
          .filter((skill) => getSkillGroupIds(skill).includes(input.groupId))
          .map((skill) => skill.id)
  );

  for (const slot of group.selectionSlots ?? []) {
    const candidateSkillIds = new Set(slot.candidateSkillIds);
    const selectedSkillIds = getSelectedSkillIdsForGroupSlot({
      groupId: input.groupId,
      progression: input.progression,
      slotId: slot.id
    }).filter((skillId) => candidateSkillIds.has(skillId));

    if (slot.required && selectedSkillIds.length < slot.chooseCount) {
      return { error: `${group.name}: ${slot.label}.` };
    }

    for (const skillId of selectedSkillIds.slice(0, slot.chooseCount)) {
      activeSkillIds.add(skillId);
    }
  }

  const totalIndividualCost = [...activeSkillIds].reduce((total, skillId) => {
    const skill = skillsById.get(skillId);

    return skill ? total + getSkillSpendCost(skill) : total;
  }, 0);

  if (totalIndividualCost <= 0) {
    return { error: "This skill group has no active skills to price." };
  }

  return {
    cost: Math.max(1, Math.floor(totalIndividualCost * 0.6))
  };
}

export function getActiveGroupSkillPurchaseCost(input: {
  content: CanonicalContentShape;
  groupId: string;
  progression: CharacterProgression;
}): { cost?: number; error?: string } {
  return getActiveGroupSkillCost(input);
}

export function getOrdinaryPoolTotal(progression?: CharacterProgression): number {
  return progression?.primaryPoolTotal ?? STANDARD_CHARGEN_METHOD_POLICY.primaryPoolTotal;
}

export function getFlexiblePoolTotal(
  profile: RolledCharacterProfile | undefined,
  progression?: Pick<CharacterProgression, "flexiblePointFactor" | "secondaryPoolTotal">
): number {
  const resolvedStats = getResolvedProfileStats(profile);

  if (!resolvedStats) {
    return progression?.secondaryPoolTotal ?? 0;
  }

  return Math.floor(
    ((resolvedStats.int ?? 0) + (resolvedStats.lck ?? 0)) *
      (progression?.flexiblePointFactor ?? STANDARD_CHARGEN_METHOD_POLICY.flexiblePointFactor)
  );
}

export function getAvailableFlexiblePoolTotal(input: {
  profile: RolledCharacterProfile | undefined;
  progression: CharacterProgression;
}): number {
  const profileDrivenTotal = getFlexiblePoolTotal(input.profile, input.progression);
  return profileDrivenTotal > 0 ? profileDrivenTotal : input.progression.secondaryPoolTotal;
}

export function chooseChargenPool(input: {
  cost: number;
  normalAccess: boolean;
  profile?: RolledCharacterProfile;
  progression: CharacterProgression;
}): "primary" | "secondary" | null {
  const ordinaryRemaining = getOrdinaryPoolTotal(input.progression) - input.progression.primaryPoolSpent;
  const flexibleRemaining =
    getFlexiblePoolTotal(input.profile, input.progression) - input.progression.secondaryPoolSpent;

  if (input.normalAccess && ordinaryRemaining >= input.cost) {
    return "primary";
  }

  if (flexibleRemaining >= input.cost) {
    return "secondary";
  }

  return null;
}

export function getPrimaryPurchaseCostForGroup(
  progression: CharacterProgression,
  groupId: string
): number {
  const group = progression.skillGroups.find((item) => item.groupId === groupId);
  return group && group.ranks > 0 ? LEGACY_GROUP_POINT_COST : LEGACY_GROUP_POINT_COST * 2;
}

export function getPrimaryPurchaseCostForSkill(
  progression: CharacterProgression,
  skillDefinition: SkillDefinition
): number {
  void progression;

  return getSkillSpendCost(skillDefinition);
}

export function getSecondaryPurchaseCostForSkill(
  progression: CharacterProgression,
  skillDefinition: SkillDefinition
): number {
  void progression;

  return getSkillSpendCost(skillDefinition);
}

export function getSecondaryPurchaseCostForSpecialization(
  progression: CharacterProgression,
  specializationDefinition: SkillSpecialization
): number {
  const specialization = progression.specializations.find(
    (item) => item.specializationId === specializationDefinition.id
  );
  return getSpecializationSpendCost(Boolean(specialization && specialization.secondaryRanks > 0));
}
