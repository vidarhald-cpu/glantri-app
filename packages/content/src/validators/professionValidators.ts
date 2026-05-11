import type { CanonicalContent } from "../types";

export function validateProfessionRelationships(content: CanonicalContent): CanonicalContent {
  const professionIds = new Set(content.professions.map((profession) => profession.id));
  const familyIds = new Set(content.professionFamilies.map((family) => family.id));
  const skillIds = new Set(content.skills.map((skill) => skill.id));
  const skillGroupIds = new Set(content.skillGroups.map((group) => group.id));
  const issues: string[] = [];

  for (const profession of content.professions) {
    if (content.professionFamilies.length > 0 && !familyIds.has(profession.familyId)) {
      issues.push(
        `Profession "${profession.name}" (${profession.id}) references unknown family "${profession.familyId}".`,
      );
    }
  }

  for (const grant of content.professionSkills) {
    if (grant.scope === "family") {
      if (content.professionFamilies.length > 0 && !familyIds.has(grant.professionId)) {
        issues.push(
          `Profession grant "${grant.professionId}" uses scope family but references an unknown profession family.`,
        );
      }
    } else if (!professionIds.has(grant.professionId)) {
      issues.push(
        `Profession grant "${grant.professionId}" uses scope profession but references an unknown profession subtype.`,
      );
    }

    if (grant.grantType === "group") {
      if (!grant.skillGroupId || !skillGroupIds.has(grant.skillGroupId)) {
        issues.push(
          `Profession grant "${grant.professionId}" references unknown skill group "${grant.skillGroupId ?? ""}".`,
        );
      }

      continue;
    }

    if (!grant.skillId || !skillIds.has(grant.skillId)) {
      issues.push(
        `Profession grant "${grant.professionId}" references unknown skill "${grant.skillId ?? ""}".`,
      );
    }
  }

  if (issues.length > 0) {
    throw new Error(`Invalid profession content:\n${issues.join("\n")}`);
  }

  return content;
}
