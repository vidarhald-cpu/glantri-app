import { canonicalContentSchema, type CanonicalContent } from "./types";

const EXPECTED_SOCIAL_BANDS = [1, 2, 3, 4] as const;
const EXPECTED_SOCIETY_SCALE = [1, 2, 3, 4, 5, 6] as const;
const MINIMUM_GROUP_SKILL_COUNT = 3;
const MINIMUM_GROUP_SKILL_POINTS = 7;

export interface CanonicalContentWarning {
  code: string;
  detail: string;
}

function getSkillPointWeight(skill: CanonicalContent["skills"][number]): number {
  return skill.category === "secondary" ? 1 : 2;
}

function getSkillIdsForGroup(content: CanonicalContent, groupId: string): string[] {
  const group = content.skillGroups.find((candidate) => candidate.id === groupId);

  if ((group?.skillMemberships?.length ?? 0) > 0 || (group?.selectionSlots?.length ?? 0) > 0) {
    return [
      ...new Set([
        ...(group?.skillMemberships ?? []).map((membership) => membership.skillId),
        ...(group?.selectionSlots ?? []).flatMap((slot) => slot.candidateSkillIds)
      ])
    ];
  }

  return content.skills
    .filter((skill) => skill.groupIds.includes(groupId))
    .map((skill) => skill.id);
}

function validateSocieties(content: CanonicalContent): CanonicalContent {
  if ((content.societies?.length ?? 0) === 0) {
    return content;
  }

  const societyIdsFromRows = new Set(content.societyLevels.map((entry) => entry.societyId));
  const societyNamesById = new Map(
    content.societyLevels.map((entry) => [entry.societyId, entry.societyName])
  );
  const issues: string[] = [];

  for (const society of content.societies ?? []) {
    if (
      !EXPECTED_SOCIETY_SCALE.includes(
        society.societyLevel as (typeof EXPECTED_SOCIETY_SCALE)[number]
      )
    ) {
      issues.push(
        `Society "${society.name}" (${society.id}) uses unsupported society level ${society.societyLevel}. Expected 1-6.`
      );
    }

    const bandName = societyNamesById.get(society.id);

    if (bandName && bandName !== society.name) {
      issues.push(
        `Society "${society.id}" uses mismatched names between societies ("${society.name}") and societyLevels ("${bandName}").`
      );
    }
  }

  const societyDefinitionIds = new Set((content.societies ?? []).map((society) => society.id));
  const missingDefinitions = [...societyIdsFromRows].filter((societyId) => !societyDefinitionIds.has(societyId));

  if (missingDefinitions.length > 0) {
    issues.push(
      `Missing society definitions for: ${missingDefinitions
        .map((societyId) => `${societyNamesById.get(societyId) ?? societyId} (${societyId})`)
        .join(", ")}.`
    );
  }

  if (issues.length > 0) {
    throw new Error(`Invalid society definition content:\n${issues.join("\n")}`);
  }

  return content;
}

function validateLanguages(content: CanonicalContent): CanonicalContent {
  const languageIds = new Set(content.languages.map((language) => language.id));
  const issues: string[] = [];

  for (const society of content.societies) {
    for (const languageId of society.baselineLanguageIds ?? []) {
      if (!languageIds.has(languageId)) {
        issues.push(
          `Society "${society.name}" (${society.id}) references unknown baseline language "${languageId}".`
        );
      }
    }
  }

  if (issues.length > 0) {
    throw new Error(`Invalid language content:\n${issues.join("\n")}`);
  }

  return content;
}

function validateCivilizations(content: CanonicalContent): CanonicalContent {
  if (content.civilizations.length === 0) {
    return content;
  }

  const societiesById = new Map(content.societies.map((society) => [society.id, society]));
  const issues: string[] = [];

  for (const civilization of content.civilizations) {
    const linkedSociety = societiesById.get(civilization.linkedSocietyId);

    if (!linkedSociety) {
      issues.push(
        `Civilization "${civilization.name}" (${civilization.id}) references unknown linked society "${civilization.linkedSocietyId}".`
      );
      continue;
    }

    if (linkedSociety.societyLevel !== civilization.linkedSocietyLevel) {
      issues.push(
        `Civilization "${civilization.name}" (${civilization.id}) uses linked society level ${civilization.linkedSocietyLevel}, but linked society "${linkedSociety.name}" (${linkedSociety.id}) is level ${linkedSociety.societyLevel}.`
      );
    }
  }

  if (issues.length > 0) {
    throw new Error(`Invalid civilization content:\n${issues.join("\n")}`);
  }

  return content;
}

function getSkillDependencies(skill: CanonicalContent["skills"][number]) {
  const strongestDependencyBySkillId = new Map<
    string,
    CanonicalContent["skills"][number]["dependencies"][number]
  >();
  const strengthPriority = {
    helpful: 0,
    recommended: 1,
    required: 2
  } as const;

  for (const dependency of skill.dependencies) {
    const existing = strongestDependencyBySkillId.get(dependency.skillId);

    if (
      !existing ||
      strengthPriority[dependency.strength] > strengthPriority[existing.strength]
    ) {
      strongestDependencyBySkillId.set(dependency.skillId, dependency);
    }
  }

  return [...strongestDependencyBySkillId.values()];
}

function validateSocietyBandRows(content: CanonicalContent): CanonicalContent {
  const seenBandKeys = new Set<string>();
  const bandsBySociety = new Map<
    string,
    {
      bands: Set<number>;
      societyName: string;
    }
  >();
  const issues: string[] = [];

  for (const societyLevel of content.societyLevels) {
    const bandKey = `${societyLevel.societyId}:${societyLevel.societyLevel}`;

    if (seenBandKeys.has(bandKey)) {
      issues.push(
        `Duplicate social band row for society "${societyLevel.societyName}" (${societyLevel.societyId}), band ${societyLevel.societyLevel}.`
      );
      continue;
    }

    seenBandKeys.add(bandKey);

    if (!EXPECTED_SOCIAL_BANDS.includes(societyLevel.societyLevel as (typeof EXPECTED_SOCIAL_BANDS)[number])) {
      issues.push(
        `Society "${societyLevel.societyName}" (${societyLevel.societyId}) uses unsupported social band ${societyLevel.societyLevel}. Expected bands: ${EXPECTED_SOCIAL_BANDS.join(", ")}.`
      );
      continue;
    }

    const existing = bandsBySociety.get(societyLevel.societyId);

    if (existing) {
      existing.bands.add(societyLevel.societyLevel);
      continue;
    }

    bandsBySociety.set(societyLevel.societyId, {
      bands: new Set([societyLevel.societyLevel]),
      societyName: societyLevel.societyName
    });
  }

  for (const [societyId, society] of bandsBySociety) {
    const missingBands = EXPECTED_SOCIAL_BANDS.filter((band) => !society.bands.has(band));

    if (missingBands.length > 0) {
      issues.push(
        `Society "${society.societyName}" (${societyId}) is missing social band(s): ${missingBands.join(", ")}.`
      );
    }
  }

  if (issues.length > 0) {
    throw new Error(`Invalid society social-band content:\n${issues.join("\n")}`);
  }

  return content;
}

function validateSocietyBandSkillAccess(content: CanonicalContent): CanonicalContent {
  if (content.societyBandSkillAccess.length === 0) {
    return content;
  }

  const issues: string[] = [];
  const skillIds = new Set(content.skills.map((skill) => skill.id));
  const societiesById = new Map(content.societies.map((society) => [society.id, society]));
  const societyBandRows = new Set(
    content.societyLevels.map((row) => `${row.societyId}:${row.societyLevel}`)
  );

  for (const entry of content.societyBandSkillAccess) {
    if (!skillIds.has(entry.skillId)) {
      issues.push(
        `Society-band skill access "${entry.societyId}:L${entry.socialBand}:${entry.skillId}" references unknown skill "${entry.skillId}".`
      );
    }

    const society = societiesById.get(entry.societyId);

    if (!society) {
      issues.push(
        `Society-band skill access "${entry.societyId}:L${entry.socialBand}:${entry.skillId}" references unknown society "${entry.societyId}".`
      );
      continue;
    }

    if (society.name !== entry.societyName) {
      issues.push(
        `Society-band skill access "${entry.societyId}:L${entry.socialBand}:${entry.skillId}" uses mismatched society name "${entry.societyName}". Expected "${society.name}".`
      );
    }

    if (society.societyLevel !== entry.linkedSocietyLevel) {
      issues.push(
        `Society-band skill access "${entry.societyId}:L${entry.socialBand}:${entry.skillId}" uses linked society level ${entry.linkedSocietyLevel}, but society "${society.name}" (${society.id}) is level ${society.societyLevel}.`
      );
    }

    if (!societyBandRows.has(`${entry.societyId}:${entry.socialBand}`)) {
      issues.push(
        `Society-band skill access "${entry.societyId}:L${entry.socialBand}:${entry.skillId}" references missing social-band row "${entry.societyId}:${entry.socialBand}".`
      );
    }
  }

  if (issues.length > 0) {
    throw new Error(`Invalid society-band skill access content:\n${issues.join("\n")}`);
  }

  return content;
}

function validateSkillRelationships(content: CanonicalContent): CanonicalContent {
  const skillIds = new Set(content.skills.map((skill) => skill.id));
  const skillGroupIds = new Set(content.skillGroups.map((group) => group.id));
  const issues: string[] = [];

  for (const skill of content.skills) {
    if (!skill.categoryId) {
      issues.push(
        `Skill "${skill.name}" (${skill.id}) is missing an explicit player-facing categoryId.`
      );
    }

    for (const groupId of skill.groupIds) {
      if (!skillGroupIds.has(groupId)) {
        issues.push(`Skill "${skill.name}" (${skill.id}) references unknown skill group "${groupId}".`);
      }
    }

    if (!skill.groupIds.includes(skill.groupId)) {
      issues.push(
        `Skill "${skill.name}" (${skill.id}) uses primary group "${skill.groupId}" that is missing from groupIds.`
      );
    }

    for (const dependency of getSkillDependencies(skill)) {
      const dependencySkillId = dependency.skillId;

      if (dependencySkillId === skill.id) {
        issues.push(`Skill "${skill.name}" (${skill.id}) cannot depend on itself.`);
        continue;
      }

      if (!skillIds.has(dependencySkillId)) {
        issues.push(
          `Skill "${skill.name}" (${skill.id}) references unknown dependency skill "${dependencySkillId}".`
        );
      }
    }

    if (skill.secondaryOfSkillId && !skillIds.has(skill.secondaryOfSkillId)) {
      issues.push(
        `Skill "${skill.name}" (${skill.id}) references unknown secondary-of skill "${skill.secondaryOfSkillId}".`
      );
    }

    if (skill.specializationOfSkillId && !skillIds.has(skill.specializationOfSkillId)) {
      issues.push(
        `Skill "${skill.name}" (${skill.id}) references unknown specialization-of skill "${skill.specializationOfSkillId}".`
      );
    }
  }

  for (const group of content.skillGroups) {
    for (const membership of group.skillMemberships ?? []) {
      if (!skillIds.has(membership.skillId)) {
        issues.push(
          `Skill group "${group.name}" (${group.id}) references unknown skill "${membership.skillId}".`
        );
        continue;
      }

      const skill = content.skills.find((candidate) => candidate.id === membership.skillId);

      if (!skill) {
        continue;
      }

      if (!skill.groupIds.includes(group.id)) {
        issues.push(
          `Skill group "${group.name}" (${group.id}) references skill "${membership.skillId}" that does not include the group in its groupIds.`
        );
        continue;
      }

      if (skill.groupId === group.id && membership.relevance !== "core") {
        issues.push(
          `Skill group "${group.name}" (${group.id}) should mark primary skill "${skill.name}" (${skill.id}) as core.`
        );
      }

      if (skill.groupId !== group.id && membership.relevance !== "optional") {
        issues.push(
          `Skill group "${group.name}" (${group.id}) should mark cross-listed skill "${skill.name}" (${skill.id}) as optional.`
        );
      }
    }

    for (const slot of group.selectionSlots ?? []) {
      if (slot.chooseCount > slot.candidateSkillIds.length) {
        issues.push(
          `Skill group "${group.name}" (${group.id}) has selection slot "${slot.id}" choosing ${slot.chooseCount} skill(s) from only ${slot.candidateSkillIds.length} candidate(s).`
        );
      }

      for (const candidateSkillId of slot.candidateSkillIds) {
        if (!skillIds.has(candidateSkillId)) {
          issues.push(
            `Skill group "${group.name}" (${group.id}) selection slot "${slot.id}" references unknown skill "${candidateSkillId}".`
          );
          continue;
        }

        const skill = content.skills.find((candidate) => candidate.id === candidateSkillId);

        if (!skill) {
          continue;
        }

        if (!skill.groupIds.includes(group.id)) {
          issues.push(
            `Skill group "${group.name}" (${group.id}) selection slot "${slot.id}" references skill "${candidateSkillId}" that does not include the group in its groupIds.`
          );
        }
      }
    }
  }

  const visitState = new Map<string, "done" | "visiting">();

  function visit(skillId: string, trail: string[]) {
    const currentState = visitState.get(skillId);

    if (currentState === "done") {
      return;
    }

    if (currentState === "visiting") {
      const cycleStartIndex = trail.indexOf(skillId);
      const cycle = [...trail.slice(cycleStartIndex), skillId];

      issues.push(`Circular skill dependency chain detected: ${cycle.join(" -> ")}.`);
      return;
    }

    visitState.set(skillId, "visiting");
    const skill = content.skills.find((candidate) => candidate.id === skillId);

    if (skill) {
      for (const dependency of getSkillDependencies(skill)) {
        const dependencySkillId = dependency.skillId;

        if (!skillIds.has(dependencySkillId) || dependencySkillId === skillId) {
          continue;
        }

        visit(dependencySkillId, [...trail, skillId]);
      }
    }

    visitState.set(skillId, "done");
  }

  for (const skill of content.skills) {
    visit(skill.id, []);
  }

  if (issues.length > 0) {
    throw new Error(`Invalid skill content:\n${issues.join("\n")}`);
  }

  return content;
}

export function collectCanonicalContentWarnings(content: CanonicalContent): CanonicalContentWarning[] {
  const warnings: CanonicalContentWarning[] = [];

  for (const group of content.skillGroups) {
    const groupSkillIds = getSkillIdsForGroup(content, group.id);
    const points = groupSkillIds.reduce((total, skillId) => {
      const skill = content.skills.find((candidate) => candidate.id === skillId);
      return total + (skill ? getSkillPointWeight(skill) : 0);
    }, 0);

    if (
      groupSkillIds.length < MINIMUM_GROUP_SKILL_COUNT &&
      points < MINIMUM_GROUP_SKILL_POINTS
    ) {
      warnings.push({
        code: "weak-skill-group",
        detail: `Skill group "${group.name}" (${group.id}) is weak: ${groupSkillIds.length} skills / ${points} points. Expected at least ${MINIMUM_GROUP_SKILL_COUNT} skills or ${MINIMUM_GROUP_SKILL_POINTS} points.`
      });
    }
  }

  return warnings;
}

function validateProfessionRelationships(content: CanonicalContent): CanonicalContent {
  const professionIds = new Set(content.professions.map((profession) => profession.id));
  const familyIds = new Set(content.professionFamilies.map((family) => family.id));
  const skillIds = new Set(content.skills.map((skill) => skill.id));
  const skillGroupIds = new Set(content.skillGroups.map((group) => group.id));
  const issues: string[] = [];

  for (const profession of content.professions) {
    if (content.professionFamilies.length > 0 && !familyIds.has(profession.familyId)) {
      issues.push(
        `Profession "${profession.name}" (${profession.id}) references unknown family "${profession.familyId}".`
      );
    }
  }

  for (const grant of content.professionSkills) {
    if (grant.scope === "family") {
      if (content.professionFamilies.length > 0 && !familyIds.has(grant.professionId)) {
        issues.push(
          `Profession grant "${grant.professionId}" uses scope family but references an unknown profession family.`
        );
      }
    } else if (!professionIds.has(grant.professionId)) {
      issues.push(
        `Profession grant "${grant.professionId}" uses scope profession but references an unknown profession subtype.`
      );
    }

    if (grant.grantType === "group") {
      if (!grant.skillGroupId || !skillGroupIds.has(grant.skillGroupId)) {
        issues.push(
          `Profession grant "${grant.professionId}" references unknown skill group "${grant.skillGroupId ?? ""}".`
        );
      }

      continue;
    }

    if (!grant.skillId || !skillIds.has(grant.skillId)) {
      issues.push(
        `Profession grant "${grant.professionId}" references unknown skill "${grant.skillId ?? ""}".`
      );
    }
  }

  if (issues.length > 0) {
    throw new Error(`Invalid profession content:\n${issues.join("\n")}`);
  }

  return content;
}

export function validateCanonicalContent(input: unknown): CanonicalContent {
  const parsedContent = canonicalContentSchema.parse(input);
  const normalizedContent = {
    ...parsedContent,
    civilizations:
      typeof input === "object" &&
      input !== null &&
      Array.isArray((input as { civilizations?: unknown[] }).civilizations)
        ? ((input as { civilizations: CanonicalContent["civilizations"] }).civilizations ?? [])
        : parsedContent.civilizations ?? []
  } satisfies CanonicalContent;

  return validateProfessionRelationships(
    validateSkillRelationships(
      validateCivilizations(
        validateLanguages(
          validateSocieties(
            validateSocietyBandSkillAccess(validateSocietyBandRows(normalizedContent))
          )
        )
      )
    )
  );
}
