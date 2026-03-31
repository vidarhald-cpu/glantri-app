import type { CanonicalContent } from "@glantri/content";
import type {
  ProfessionDefinition,
  ProfessionSkillMap,
  SkillDefinition,
  SkillGroupDefinition
} from "@glantri/domain";

function uniqueValues(values: string[]): string[] {
  return [...new Set(values.filter((value) => value.trim().length > 0))];
}

export function parseCommaSeparatedList(value: string): string[] {
  return uniqueValues(
    value
      .split(",")
      .map((item) => item.trim())
      .filter((item) => item.length > 0)
  );
}

export function normalizeOptionalId(value: string): string | undefined {
  const normalized = value.trim();

  return normalized.length > 0 ? normalized : undefined;
}

export function buildNormalizedGroupIds(
  selectedGroupIds: string[],
  fallbackGroupId: string
): string[] {
  const normalized = uniqueValues(selectedGroupIds);

  if (normalized.length > 0) {
    return normalized;
  }

  return [fallbackGroupId];
}

export function normalizeSkillDefinition(
  skill: SkillDefinition,
  selectedGroupIds: string[]
): SkillDefinition {
  const groupIds = buildNormalizedGroupIds(selectedGroupIds, skill.groupId);

  return {
    ...skill,
    dependencySkillIds: uniqueValues(skill.dependencySkillIds),
    groupId: groupIds[0],
    groupIds
  };
}

export function updateSkillInContent(
  content: CanonicalContent,
  nextSkill: SkillDefinition
): CanonicalContent {
  return {
    ...content,
    skills: content.skills.map((skill) => (skill.id === nextSkill.id ? nextSkill : skill))
  };
}

export function updateSkillGroupInContent(
  content: CanonicalContent,
  nextGroup: SkillGroupDefinition
): CanonicalContent {
  return {
    ...content,
    skillGroups: content.skillGroups.map((group) => (group.id === nextGroup.id ? nextGroup : group))
  };
}

export function updateProfessionInContent(
  content: CanonicalContent,
  nextProfession: ProfessionDefinition
): CanonicalContent {
  return {
    ...content,
    professions: content.professions.map((profession) =>
      profession.id === nextProfession.id ? nextProfession : profession
    )
  };
}

export function replaceProfessionRelations(
  content: CanonicalContent,
  professionId: string,
  relations: {
    groupIds: string[];
    ordinarySkillIds: string[];
    secondarySkillIds: string[];
  }
): CanonicalContent {
  const existingProfessionGrants = content.professionSkills.filter(
    (professionSkill) => professionSkill.professionId === professionId
  );
  const otherProfessionGrants = content.professionSkills.filter(
    (professionSkill) => professionSkill.professionId !== professionId
  );

  const buildGrant = (
    grantType: ProfessionSkillMap["grantType"],
    targetId: string
  ): ProfessionSkillMap => {
    const existing = existingProfessionGrants.find((professionSkill) =>
      grantType === "group"
        ? professionSkill.grantType === "group" && professionSkill.skillGroupId === targetId
        : professionSkill.grantType === grantType && professionSkill.skillId === targetId
    );

    if (existing) {
      return existing;
    }

    return {
      grantType,
      isCore: false,
      professionId,
      ranks: 0,
      scope: "profession",
      skillGroupId: grantType === "group" ? targetId : undefined,
      skillId: grantType === "group" ? undefined : targetId
    };
  };

  return {
    ...content,
    professionSkills: [
      ...otherProfessionGrants,
      ...uniqueValues(relations.groupIds).map((groupId) => buildGrant("group", groupId)),
      ...uniqueValues(relations.ordinarySkillIds).map((skillId) =>
        buildGrant("ordinary-skill", skillId)
      ),
      ...uniqueValues(relations.secondarySkillIds).map((skillId) =>
        buildGrant("secondary-skill", skillId)
      )
    ]
  };
}
