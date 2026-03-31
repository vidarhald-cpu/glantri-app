import type {
  ProfessionDefinition,
  ProfessionFamilyDefinition,
  ProfessionSkillMap,
  SkillDefinition,
  SkillGroupDefinition
} from "@glantri/domain";
import { getSkillGroupIds } from "@glantri/domain";

interface ProfessionResolverContentShape {
  professionFamilies: ProfessionFamilyDefinition[];
  professionSkills: ProfessionSkillMap[];
  professions: ProfessionDefinition[];
  skillGroups: SkillGroupDefinition[];
  skills: SkillDefinition[];
}

export interface EffectiveProfessionPackageTierResult {
  directOnlySkillIds: string[];
  directSkillsCoveredByGroups: string[];
  finalEffectiveGroupIds: string[];
  finalEffectiveReachableSkillIds: string[];
  finalEffectiveReachableSkillCount: number;
  finalEffectiveSkillIds: string[];
  inheritedFamilyGroupIds: string[];
  inheritedFamilySkillIds: string[];
  reachableSkillIdsThroughGroups: string[];
  subtypeAddedGroupIds: string[];
  subtypeAddedSkillIds: string[];
}

export interface EffectiveProfessionPackageResolverResult {
  core: EffectiveProfessionPackageTierResult;
  family: ProfessionFamilyDefinition;
  favored: EffectiveProfessionPackageTierResult;
  subtype?: ProfessionDefinition;
  summary: {
    totalEffectiveCoreReachableSkills: number;
    totalEffectiveFavoredReachableSkills: number;
  };
}

export interface ResolveEffectiveProfessionPackageInput {
  content: ProfessionResolverContentShape;
  family?: ProfessionFamilyDefinition | string;
  familyId?: string;
  subtype?: ProfessionDefinition | string;
  subtypeId?: string;
}

function uniqueIds(ids: Iterable<string>): string[] {
  return [...new Set(ids)];
}

function sortGroupIds(content: ProfessionResolverContentShape, groupIds: string[]): string[] {
  const orderByGroupId = new Map(
    content.skillGroups.map((group, index) => [group.id, [group.sortOrder, index] as const])
  );

  return [...groupIds].sort((left, right) => {
    const leftOrder = orderByGroupId.get(left) ?? [Number.MAX_SAFE_INTEGER, Number.MAX_SAFE_INTEGER];
    const rightOrder = orderByGroupId.get(right) ?? [Number.MAX_SAFE_INTEGER, Number.MAX_SAFE_INTEGER];

    if (leftOrder[0] !== rightOrder[0]) {
      return leftOrder[0] - rightOrder[0];
    }

    if (leftOrder[1] !== rightOrder[1]) {
      return leftOrder[1] - rightOrder[1];
    }

    return left.localeCompare(right);
  });
}

function sortSkillIds(content: ProfessionResolverContentShape, skillIds: string[]): string[] {
  const orderBySkillId = new Map(
    content.skills.map((skill, index) => [skill.id, [skill.sortOrder, index] as const])
  );

  return [...skillIds].sort((left, right) => {
    const leftOrder = orderBySkillId.get(left) ?? [Number.MAX_SAFE_INTEGER, Number.MAX_SAFE_INTEGER];
    const rightOrder = orderBySkillId.get(right) ?? [Number.MAX_SAFE_INTEGER, Number.MAX_SAFE_INTEGER];

    if (leftOrder[0] !== rightOrder[0]) {
      return leftOrder[0] - rightOrder[0];
    }

    if (leftOrder[1] !== rightOrder[1]) {
      return leftOrder[1] - rightOrder[1];
    }

    return left.localeCompare(right);
  });
}

function resolveFamily(
  input: ResolveEffectiveProfessionPackageInput,
  subtype: ProfessionDefinition | undefined
): ProfessionFamilyDefinition {
  if (typeof input.family === "object") {
    return input.family;
  }

  const familyId = input.familyId ?? (typeof input.family === "string" ? input.family : subtype?.familyId);

  if (familyId) {
    const family = input.content.professionFamilies.find((candidate) => candidate.id === familyId);

    if (family) {
      return family;
    }

    if (subtype) {
      return {
        description: undefined,
        id: familyId,
        name: subtype.familyId === familyId ? subtype.name : familyId
      };
    }
  }

  throw new Error("A profession family or familyId is required to resolve the profession package.");
}

function resolveSubtype(
  input: ResolveEffectiveProfessionPackageInput
): ProfessionDefinition | undefined {
  if (typeof input.subtype === "object") {
    return input.subtype;
  }

  const subtypeId = input.subtypeId ?? (typeof input.subtype === "string" ? input.subtype : undefined);

  if (!subtypeId) {
    return undefined;
  }

  const subtype = input.content.professions.find((candidate) => candidate.id === subtypeId);

  if (!subtype) {
    throw new Error(`Unknown profession subtype "${subtypeId}".`);
  }

  return subtype;
}

function getTierGrants(input: {
  family: ProfessionFamilyDefinition;
  isCore: boolean;
  professionSkills: ProfessionSkillMap[];
  subtype?: ProfessionDefinition;
}) {
  const familyGrants = input.professionSkills.filter(
    (grant) =>
      grant.scope === "family" &&
      grant.professionId === input.family.id &&
      grant.isCore === input.isCore
  );
  const subtypeGrants = input.subtype
    ? input.professionSkills.filter(
        (grant) =>
          grant.scope === "profession" &&
          grant.professionId === input.subtype?.id &&
          grant.isCore === input.isCore
      )
    : [];

  return {
    familyGrants,
    subtypeGrants
  };
}

function collectGroupIds(grants: ProfessionSkillMap[]): string[] {
  return uniqueIds(
    grants
      .filter((grant) => grant.grantType === "group" && grant.skillGroupId)
      .map((grant) => grant.skillGroupId ?? "")
      .filter((groupId) => groupId.length > 0)
  );
}

function collectSkillIds(grants: ProfessionSkillMap[]): string[] {
  return uniqueIds(
    grants
      .filter((grant) => grant.grantType !== "group" && grant.skillId)
      .map((grant) => grant.skillId ?? "")
      .filter((skillId) => skillId.length > 0)
  );
}

function resolveTier(input: {
  content: ProfessionResolverContentShape;
  family: ProfessionFamilyDefinition;
  isCore: boolean;
  subtype?: ProfessionDefinition;
}): EffectiveProfessionPackageTierResult {
  const { familyGrants, subtypeGrants } = getTierGrants({
    family: input.family,
    isCore: input.isCore,
    professionSkills: input.content.professionSkills,
    subtype: input.subtype
  });
  const inheritedFamilyGroupIds = sortGroupIds(input.content, collectGroupIds(familyGrants));
  const inheritedFamilySkillIds = sortSkillIds(input.content, collectSkillIds(familyGrants));
  const subtypeAddedGroupIds = sortGroupIds(input.content, collectGroupIds(subtypeGrants));
  const subtypeAddedSkillIds = sortSkillIds(input.content, collectSkillIds(subtypeGrants));
  const finalEffectiveGroupIds = sortGroupIds(
    input.content,
    uniqueIds([...inheritedFamilyGroupIds, ...subtypeAddedGroupIds])
  );
  const finalEffectiveSkillIds = sortSkillIds(
    input.content,
    uniqueIds([...inheritedFamilySkillIds, ...subtypeAddedSkillIds])
  );
  const reachableSkillIdsThroughGroups = sortSkillIds(
    input.content,
    uniqueIds(
      input.content.skills
        .filter((skill) =>
          getSkillGroupIds(skill).some((groupId) => finalEffectiveGroupIds.includes(groupId))
        )
        .map((skill) => skill.id)
    )
  );
  const directSkillsCoveredByGroups = sortSkillIds(
    input.content,
    finalEffectiveSkillIds.filter((skillId) => reachableSkillIdsThroughGroups.includes(skillId))
  );
  const directOnlySkillIds = sortSkillIds(
    input.content,
    finalEffectiveSkillIds.filter((skillId) => !reachableSkillIdsThroughGroups.includes(skillId))
  );
  const finalEffectiveReachableSkillIds = sortSkillIds(
    input.content,
    uniqueIds([...reachableSkillIdsThroughGroups, ...directOnlySkillIds])
  );

  return {
    directOnlySkillIds,
    directSkillsCoveredByGroups,
    finalEffectiveGroupIds,
    finalEffectiveReachableSkillCount: finalEffectiveReachableSkillIds.length,
    finalEffectiveReachableSkillIds,
    finalEffectiveSkillIds,
    inheritedFamilyGroupIds,
    inheritedFamilySkillIds,
    reachableSkillIdsThroughGroups,
    subtypeAddedGroupIds,
    subtypeAddedSkillIds
  };
}

export function resolveEffectiveProfessionPackage(
  input: ResolveEffectiveProfessionPackageInput
): EffectiveProfessionPackageResolverResult {
  const subtype = resolveSubtype(input);
  const family = resolveFamily(input, subtype);

  if (subtype && subtype.familyId !== family.id) {
    throw new Error(
      `Profession subtype "${subtype.id}" does not belong to family "${family.id}".`
    );
  }

  const core = resolveTier({
    content: input.content,
    family,
    isCore: true,
    subtype
  });
  const favored = resolveTier({
    content: input.content,
    family,
    isCore: false,
    subtype
  });

  return {
    core,
    family,
    favored,
    subtype,
    summary: {
      totalEffectiveCoreReachableSkills: core.finalEffectiveReachableSkillCount,
      totalEffectiveFavoredReachableSkills: favored.finalEffectiveReachableSkillCount
    }
  };
}
