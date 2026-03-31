import { canonicalContentSchema, type CanonicalContent } from "./types";

const EXPECTED_SOCIAL_BANDS = [1, 2, 3, 4] as const;

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

function validateSkillRelationships(content: CanonicalContent): CanonicalContent {
  const skillIds = new Set(content.skills.map((skill) => skill.id));
  const skillGroupIds = new Set(content.skillGroups.map((group) => group.id));
  const issues: string[] = [];

  for (const skill of content.skills) {
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
  return validateProfessionRelationships(
    validateSkillRelationships(validateSocietyBandRows(canonicalContentSchema.parse(input)))
  );
}
