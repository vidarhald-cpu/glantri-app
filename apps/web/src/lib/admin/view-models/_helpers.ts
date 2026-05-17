import { type CanonicalContent } from "@glantri/content";
import { getSkillGroupIds } from "@glantri/domain";
import { resolveEffectiveProfessionPackage } from "@glantri/rules-engine";

export function uniqueSorted(values: string[]): string[] {
  return [...new Set(values)].sort((left, right) => left.localeCompare(right));
}

export function joinDisplayName(name: string, suffix?: string): string {
  return suffix ? `${name} (${suffix})` : name;
}

export function getWeightedSkillPoints(skill: CanonicalContent["skills"][number]): number {
  return skill.category === "secondary" ? 1 : 2;
}

export function getGroupMemberships(
  content: CanonicalContent,
  groupId: string
): Array<{ relevance: "core" | "optional"; skillId: string }> {
  const group = content.skillGroups.find((candidate) => candidate.id === groupId);

  if (group?.skillMemberships?.length) {
    return group.skillMemberships;
  }

  return content.skills
    .filter((skill) => getSkillGroupIds(skill).includes(groupId))
    .map((skill) => ({
      relevance: skill.groupId === groupId ? ("core" as const) : ("optional" as const),
      skillId: skill.id
    }));
}

export function formatSocietyEntryLabel(societyName: string, level: number, socialClass: string): string {
  return `${societyName} L${level} - ${socialClass}`;
}

export function formatCharacteristicList(characteristics: string[]): string {
  return characteristics.map((characteristic) => characteristic.toUpperCase()).join(", ");
}

export function getDieRange(level: number): string {
  switch (level) {
    case 1:
      return "1-10";
    case 2:
      return "11-15";
    case 3:
      return "16-18";
    case 4:
      return "19-20";
    default:
      return "Custom";
  }
}

export function summarizeAccessBands(bands: number[]): string {
  if (bands.length === 0) {
    return "—";
  }

  const uniqueBands = [...new Set(bands)].sort((left, right) => left - right);
  const ranges: string[] = [];
  let rangeStart = uniqueBands[0] ?? 0;
  let previous = uniqueBands[0] ?? 0;

  for (let index = 1; index < uniqueBands.length; index += 1) {
    const current = uniqueBands[index];

    if (current === previous + 1) {
      previous = current;
      continue;
    }

    ranges.push(rangeStart === previous ? `L${rangeStart}` : `L${rangeStart}-L${previous}`);
    rangeStart = current ?? previous;
    previous = current ?? previous;
  }

  ranges.push(rangeStart === previous ? `L${rangeStart}` : `L${rangeStart}-L${previous}`);

  return ranges.join(", ");
}

export function summarizeSocietyStages(levels: number[]): string {
  return summarizeAccessBands(levels).replaceAll("L", "S");
}

export type InternalAuditSeverity = "blocking" | "info" | "warning";

export function getAuditSeverityRank(severity: InternalAuditSeverity): number {
  if (severity === "blocking") {
    return 0;
  }

  if (severity === "warning") {
    return 1;
  }

  return 2;
}

export function buildSkillMaps(content: CanonicalContent) {
  const skillGroupsById = new Map(content.skillGroups.map((group) => [group.id, group]));
  const skillsById = new Map(content.skills.map((skill) => [skill.id, skill]));
  const professionsById = new Map(content.professions.map((profession) => [profession.id, profession]));
  const societiesById = new Map(
    content.societyLevels.map((societyLevel) => [
      societyLevel.societyId,
      societyLevel.societyName
    ])
  );

  return {
    professionsById,
    skillGroupsById,
    skillsById,
    societiesById
  };
}

export function createEmptyArrayMap(): Map<string, string[]> {
  return new Map<string, string[]>();
}

export function appendArrayMapValue(map: Map<string, string[]>, key: string, value: string): void {
  const existing = map.get(key);

  if (existing) {
    existing.push(value);
    return;
  }

  map.set(key, [value]);
}

export function buildSkillRelationshipContext(content: CanonicalContent) {
  const { skillGroupsById, skillsById } = buildSkillMaps(content);
  const dependedOnByIds = createEmptyArrayMap();
  const specializationChildIds = createEmptyArrayMap();
  const directSpecializationsBySkillId = createEmptyArrayMap();

  for (const skill of content.skills) {
    for (const dependencySkillId of skill.dependencySkillIds) {
      appendArrayMapValue(dependedOnByIds, dependencySkillId, skill.id);
    }

    if (skill.specializationOfSkillId) {
      appendArrayMapValue(specializationChildIds, skill.specializationOfSkillId, skill.id);
    }
  }

  for (const specialization of content.specializations) {
    appendArrayMapValue(directSpecializationsBySkillId, specialization.skillId, specialization.name);
  }

  const chainMemo = new Map<string, string[]>();

  function getLongestDependencyChain(skillId: string): string[] {
    const cached = chainMemo.get(skillId);

    if (cached) {
      return cached;
    }

    const skill = skillsById.get(skillId);

    if (!skill || skill.dependencySkillIds.length === 0) {
      const terminalChain = [skillId];

      chainMemo.set(skillId, terminalChain);
      return terminalChain;
    }

    let longestChain = [skillId];

    for (const dependencySkillId of skill.dependencySkillIds) {
      const candidateChain = [skillId, ...getLongestDependencyChain(dependencySkillId)];

      if (candidateChain.length > longestChain.length) {
        longestChain = candidateChain;
      }
    }

    chainMemo.set(skillId, longestChain);
    return longestChain;
  }

  function getSkillName(skillId: string): string {
    return skillsById.get(skillId)?.name ?? skillId;
  }

  return {
    directSpecializationsBySkillId,
    dependedOnByIds,
    getLongestDependencyChain,
    getSkillName,
    skillGroupsById,
    skillsById,
    specializationChildIds
  };
}

export function resolveProfessionGrantPackage(
  content: CanonicalContent,
  professionId: string
) {
  const professionPackage = resolveEffectiveProfessionPackage({
    content,
    subtypeId: professionId
  });
  const grantedSkillGroupIds = uniqueSorted([
    ...professionPackage.core.finalEffectiveGroupIds,
    ...professionPackage.favored.finalEffectiveGroupIds
  ]);
  const groupReachableSkillIds = uniqueSorted([
    ...professionPackage.core.reachableSkillIdsThroughGroups,
    ...professionPackage.favored.reachableSkillIdsThroughGroups
  ]);
  const directSkillIds = uniqueSorted([
    ...professionPackage.core.finalEffectiveSkillIds,
    ...professionPackage.favored.finalEffectiveSkillIds
  ]);
  const reachableSkillIds = uniqueSorted([
    ...professionPackage.core.finalEffectiveReachableSkillIds,
    ...professionPackage.favored.finalEffectiveReachableSkillIds
  ]);

  return {
    directSkillIds,
    grantedSkillGroupIds,
    groupReachableSkillIds,
    reachableSkillIds
  };
}

export function buildProfessionRelationshipContext(content: CanonicalContent) {
  const skillContext = buildSkillRelationshipContext(content);
  const groupSkillIdsByGroupId = new Map<string, string[]>();
  const societyEntriesByProfessionId = createEmptyArrayMap();

  for (const skill of content.skills) {
    for (const groupId of getSkillGroupIds(skill)) {
      appendArrayMapValue(groupSkillIdsByGroupId, groupId, skill.id);
    }
  }

  for (const societyLevel of content.societyLevels) {
    const label = formatSocietyEntryLabel(
      societyLevel.societyName,
      societyLevel.societyLevel,
      societyLevel.socialClass
    );

    for (const professionId of societyLevel.professionIds) {
      appendArrayMapValue(societyEntriesByProfessionId, professionId, label);
    }
  }

  function skillHasSpecializationLinks(skillId: string): boolean {
    const skill = skillContext.skillsById.get(skillId);

    if (!skill) {
      return false;
    }

    return (
      skill.allowsSpecializations ||
      Boolean(skill.specializationOfSkillId) ||
      (skillContext.directSpecializationsBySkillId.get(skillId)?.length ?? 0) > 0 ||
      (skillContext.specializationChildIds.get(skillId)?.length ?? 0) > 0
    );
  }

  return {
    ...skillContext,
    groupSkillIdsByGroupId,
    skillHasSpecializationLinks,
    societyEntriesByProfessionId
  };
}

export function buildProfessionMatrixRowsInternal(content: CanonicalContent) {
  const professionContext = buildProfessionRelationshipContext(content);

  return [...content.professions]
    .sort((left, right) => left.name.localeCompare(right.name))
    .map((profession) => {
      const { directSkillIds, grantedSkillGroupIds, groupReachableSkillIds, reachableSkillIds } =
        resolveProfessionGrantPackage(content, profession.id);
      const directSkillsById = new Map(
        directSkillIds.map((skillId) => [skillId, professionContext.skillsById.get(skillId)])
      );
      const directlyGrantedSkills = directSkillIds.map((skillId) => {
        const skill = directSkillsById.get(skillId);

        return joinDisplayName(
          skill?.name ?? skillId,
          skill?.category === "secondary" ? "secondary" : "ordinary"
        );
      });
      const duplicateDirectSkills = directSkillIds
        .filter((skillId) => groupReachableSkillIds.includes(skillId))
        .map((skillId) => professionContext.getSkillName(skillId));
      const directSkillExceptions = directSkillIds
        .filter((skillId) => !groupReachableSkillIds.includes(skillId))
        .map((skillId) => professionContext.getSkillName(skillId));
      const reachableSkills = reachableSkillIds.map((skillId) => professionContext.getSkillName(skillId));
      const reachableSecondarySkills = reachableSkillIds
        .filter((skillId) => professionContext.skillsById.get(skillId)?.category === "secondary")
        .map((skillId) => professionContext.getSkillName(skillId));
      const reachableSpecializationLinkedSkills = reachableSkillIds
        .filter((skillId) => professionContext.skillHasSpecializationLinks(skillId))
        .map((skillId) => professionContext.getSkillName(skillId));

      return {
        allowedSocietyEntries: uniqueSorted(
          professionContext.societyEntriesByProfessionId.get(profession.id) ?? []
        ),
        description: profession.description ?? "",
        directSkillExceptions: uniqueSorted(directSkillExceptions),
        directSkillOverrideCount: directSkillExceptions.length,
        directlyGrantedSkills: uniqueSorted(directlyGrantedSkills),
        duplicateDirectSkills: uniqueSorted(duplicateDirectSkills),
        grantedSkillGroups: uniqueSorted(
          grantedSkillGroupIds.map(
            (groupId) => professionContext.skillGroupsById.get(groupId)?.name ?? groupId
          )
        ),
        hasDirectSkillExceptions: directSkillExceptions.length > 0,
        id: profession.id,
        name: profession.name,
        notes: "",
        reachableGroupSkills: uniqueSorted(
          groupReachableSkillIds.map((skillId) => professionContext.getSkillName(skillId))
        ),
        reachableSecondarySkills: uniqueSorted(reachableSecondarySkills),
        reachableSkills: uniqueSorted(reachableSkills),
        reachableSpecializationLinkedSkills: uniqueSorted(reachableSpecializationLinkedSkills),
        totalReachableSkills: reachableSkillIds.length
      };
    });
}

export function applyProfessionReachBands(
  rows: Array<{
    allowedSocietyEntries: string[];
    description: string;
    directSkillExceptions: string[];
    directSkillOverrideCount: number;
    directlyGrantedSkills: string[];
    duplicateDirectSkills: string[];
    grantedSkillGroups: string[];
    hasDirectSkillExceptions: boolean;
    id: string;
    name: string;
    notes: string;
    reachableGroupSkills: string[];
    reachableSecondarySkills: string[];
    reachableSkills: string[];
    reachableSpecializationLinkedSkills: string[];
    totalReachableSkills: number;
  }>
) {
  const averageReach =
    rows.length === 0 ? 0 : rows.reduce((sum, row) => sum + row.totalReachableSkills, 0) / rows.length;
  const narrowThreshold = Math.max(1, Math.floor(averageReach / 2));
  const broadThreshold = Math.max(4, Math.ceil(averageReach * 1.5));

  return rows.map((row) => ({
    ...row,
    reachBand:
      row.totalReachableSkills <= narrowThreshold
        ? ("narrow" as const)
        : row.totalReachableSkills >= broadThreshold
          ? ("broad" as const)
          : ("medium" as const)
  }));
}

export function buildSocietyMatrixRowsInternal(content: CanonicalContent) {
  const societySkillContext = buildSkillRelationshipContext(content);
  const professionContext = buildProfessionRelationshipContext(content);
  const { professionsById, skillGroupsById, societiesById } = buildSkillMaps(content);

  return [...content.societyLevels]
    .sort(
      (left, right) =>
        left.societyName.localeCompare(right.societyName) ||
        left.societyLevel - right.societyLevel
    )
    .map((societyLevel) => {
      const reachableProfessionIds = uniqueSorted(societyLevel.professionIds);
      const professionDerivedSkillIds = uniqueSorted(
        reachableProfessionIds.flatMap(
          (professionId) => resolveProfessionGrantPackage(content, professionId).reachableSkillIds
        )
      );
      const directSkillGroupIds = uniqueSorted(societyLevel.skillGroupIds);
      const directGroupSkillIds = uniqueSorted(
        directSkillGroupIds.flatMap(
          (groupId) => professionContext.groupSkillIdsByGroupId.get(groupId) ?? []
        )
      );
      const directSkillIds = uniqueSorted(societyLevel.skillIds);
      const directAddedSkillIds = uniqueSorted([...directGroupSkillIds, ...directSkillIds]);
      const totalEffectiveSkillIds = uniqueSorted([
        ...professionDerivedSkillIds,
        ...directAddedSkillIds
      ]);
      const directOnlySkillIds = totalEffectiveSkillIds.filter(
        (skillId) => !professionDerivedSkillIds.includes(skillId)
      );

      return {
        baseEducation:
          societyLevel.baseEducation === undefined ? "" : String(societyLevel.baseEducation),
        directGroupOverrideCount: directSkillGroupIds.length,
        directOnlySkills: uniqueSorted(
          directOnlySkillIds.map((skillId) => societySkillContext.getSkillName(skillId))
        ),
        directSkillGroups: uniqueSorted(
          directSkillGroupIds.map((groupId) => skillGroupsById.get(groupId)?.name ?? groupId)
        ),
        directSkillOverrideCount: directSkillIds.length,
        directSkills: uniqueSorted(
          directSkillIds.map((skillId) => societySkillContext.getSkillName(skillId))
        ),
        dieRange: getDieRange(societyLevel.societyLevel),
        effectiveProfessionSkills: uniqueSorted(
          professionDerivedSkillIds.map((skillId) => societySkillContext.getSkillName(skillId))
        ),
        hasDirectOverrides: directSkillGroupIds.length > 0 || directSkillIds.length > 0,
        id: `${societyLevel.societyId}:${societyLevel.societyLevel}`,
        notes: societyLevel.notes ?? "",
        professionDerivedReachCount: professionDerivedSkillIds.length,
        reachableProfessions: uniqueSorted(
          reachableProfessionIds.map(
            (professionId) => professionsById.get(professionId)?.name ?? professionId
          )
        ),
        society: societiesById.get(societyLevel.societyId) ?? societyLevel.societyId,
        societyClassName: societyLevel.socialClass,
        societyLevel: societyLevel.societyLevel,
        totalEffectiveReachableSkills: totalEffectiveSkillIds.length
      };
    });
}

export function applySocietyReachBands(
  rows: Array<{
    baseEducation: string;
    directGroupOverrideCount: number;
    directOnlySkills: string[];
    directSkillGroups: string[];
    directSkillOverrideCount: number;
    directSkills: string[];
    dieRange: string;
    effectiveProfessionSkills: string[];
    hasDirectOverrides: boolean;
    id: string;
    notes: string;
    professionDerivedReachCount: number;
    reachableProfessions: string[];
    society: string;
    societyClassName: string;
    societyLevel: number;
    totalEffectiveReachableSkills: number;
  }>
) {
  const averageReach =
    rows.length === 0
      ? 0
      : rows.reduce((sum, row) => sum + row.totalEffectiveReachableSkills, 0) / rows.length;
  const narrowThreshold = Math.max(1, Math.floor(averageReach / 2));
  const broadThreshold = Math.max(4, Math.ceil(averageReach * 1.5));

  return rows.map((row) => ({
    ...row,
    reachBand:
      row.totalEffectiveReachableSkills <= narrowThreshold
        ? ("narrow" as const)
        : row.totalEffectiveReachableSkills >= broadThreshold
          ? ("broad" as const)
          : ("medium" as const)
  }));
}
