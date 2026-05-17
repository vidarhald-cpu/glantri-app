import type { CanonicalContent } from "@glantri/content";
import type { EquipmentTemplate } from "@glantri/domain/equipment";

import { getPlayerFacingEquipmentTemplateName } from "@/features/equipment/playerFacingTemplateOptions";
import {
  type PlayerFacingSkillBucketId,
  getPlayerFacingSkillBucketDefinitions
} from "@/lib/chargen/chargenBrowse";
import type { NpcArchetypeSkillRelevance } from "@/lib/templates/npcArchetypeTemplates";

export function clampLevel(value: number): number {
  return Math.max(0, Math.min(99, Math.trunc(value)));
}

export function clampStat(value: number): number {
  return Math.max(1, Math.min(25, Math.trunc(value)));
}

export function sortTemplatesByName(templates: EquipmentTemplate[]): EquipmentTemplate[] {
  return [...templates].sort((left, right) =>
    getPlayerFacingEquipmentTemplateName(left).localeCompare(
      getPlayerFacingEquipmentTemplateName(right)
    )
  );
}

export function getProfessionDirectSkillGroupIds(
  content: CanonicalContent,
  professionId: string
): string[] {
  const profession = content.professions.find((candidate) => candidate.id === professionId);

  return content.professionSkills
    .filter((entry) => entry.grantType === "group" && typeof entry.skillGroupId === "string")
    .filter((entry) => {
      if (!profession) {
        return false;
      }

      if (entry.scope === "family") {
        return entry.professionId === profession.familyId;
      }

      return entry.professionId === profession.id;
    })
    .map((entry) => entry.skillGroupId as string);
}

export function getProfessionDirectSkillIds(
  content: CanonicalContent,
  professionId: string
): string[] {
  const profession = content.professions.find((candidate) => candidate.id === professionId);

  return content.professionSkills
    .filter((entry) => typeof entry.skillId === "string")
    .filter((entry) => {
      if (!profession) {
        return false;
      }

      if (entry.scope === "family") {
        return entry.professionId === profession.familyId;
      }

      return entry.professionId === profession.id;
    })
    .map((entry) => entry.skillId as string);
}

export function getGroupRelevanceLabel(input: {
  directProfessionGroupIds: string[];
  groupId: string;
  suggestedSkillGroupIds: string[];
}): string {
  if (input.directProfessionGroupIds.includes(input.groupId)) {
    return "Core to profession";
  }

  if (input.suggestedSkillGroupIds.includes(input.groupId)) {
    return "Optional to frame";
  }

  return "Manual expansion";
}

export function getSelectedGroupTypeLabel(input: {
  directProfessionGroupIds: string[];
  groupId: string;
  suggestedSkillGroupIds: string[];
}): string {
  if (input.directProfessionGroupIds.includes(input.groupId)) {
    return "Core";
  }

  if (input.suggestedSkillGroupIds.includes(input.groupId)) {
    return "Optional";
  }

  return "Other";
}

export function getSkillRelevance(input: {
  directProfessionSkillIds: string[];
  selectedGroupIds: string[];
  skill: CanonicalContent["skills"][number];
  suggestedSkillIds: string[];
}): NpcArchetypeSkillRelevance {
  if (input.directProfessionSkillIds.includes(input.skill.id)) {
    return "core";
  }

  if (
    input.suggestedSkillIds.includes(input.skill.id) ||
    input.skill.groupIds.some((groupId) => input.selectedGroupIds.includes(groupId))
  ) {
    return "optional";
  }

  return "other";
}

export function getSkillRelevanceLabel(relevance: NpcArchetypeSkillRelevance): string {
  if (relevance === "core") {
    return "Core";
  }

  if (relevance === "optional") {
    return "Optional";
  }

  return "Other";
}

export function formatPlayerFacingCategoryLabel(categoryId: PlayerFacingSkillBucketId): string {
  return (
    getPlayerFacingSkillBucketDefinitions().find((entry) => entry.id === categoryId)?.label ??
    categoryId.replaceAll("-", " ")
  );
}
