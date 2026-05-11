import type { CanonicalContent } from "../types";
import {
  CANONICAL_SKILL_GROUP_MEMBERSHIPS,
  REMOVED_SKILL_GROUP_IDS_BY_SKILL_ID,
} from "./constants";

function removeRetiredSkillGroupMemberships(
  skill: CanonicalContent["skills"][number],
): CanonicalContent["skills"][number] {
  const removedGroupIds = new Set(REMOVED_SKILL_GROUP_IDS_BY_SKILL_ID[skill.id] ?? []);

  if (removedGroupIds.size === 0) {
    return skill;
  }

  const groupIds = skill.groupIds.filter((groupId) => !removedGroupIds.has(groupId));

  return {
    ...skill,
    groupId: groupIds.includes(skill.groupId) ? skill.groupId : (groupIds[0] ?? skill.groupId),
    groupIds,
  };
}

function normalizeCanonicalSkillGroupMembershipsInSkill(
  activeCanonicalGroupIds: Set<string>,
  skill: CanonicalContent["skills"][number],
): CanonicalContent["skills"][number] {
  const groupIds = new Set(skill.groupIds);

  for (const [groupId, skillIds] of Object.entries(CANONICAL_SKILL_GROUP_MEMBERSHIPS)) {
    if (!skillIds || !activeCanonicalGroupIds.has(groupId)) {
      continue;
    }

    if (skillIds.includes(skill.id)) {
      groupIds.add(groupId);
    } else {
      groupIds.delete(groupId);
    }
  }

  const normalizedGroupIds = [...groupIds];

  return {
    ...skill,
    groupId: normalizedGroupIds.includes(skill.groupId)
      ? skill.groupId
      : (normalizedGroupIds[0] ?? skill.groupId),
    groupIds: normalizedGroupIds,
  };
}

function getSkillDependencies(skill: CanonicalContent["skills"][number]) {
  const strongestDependencyBySkillId = new Map<
    string,
    CanonicalContent["skills"][number]["dependencies"][number]
  >();
  const strengthPriority = {
    helpful: 0,
    recommended: 1,
    required: 2,
  } as const;

  for (const dependency of skill.dependencies) {
    const existing = strongestDependencyBySkillId.get(dependency.skillId);

    if (!existing || strengthPriority[dependency.strength] > strengthPriority[existing.strength]) {
      strongestDependencyBySkillId.set(dependency.skillId, dependency);
    }
  }

  return [...strongestDependencyBySkillId.values()];
}

export function normalizeSkills(
  skills: CanonicalContent["skills"],
  activeCanonicalGroupIds: Set<string>,
): CanonicalContent["skills"] {
  return skills.map((skill): CanonicalContent["skills"][number] => {
    const normalizedSkill =
      skill.id === "language"
        ? {
            ...skill,
            category: "ordinary" as const,
            categoryId: "language" as const,
            allowsSpecializations: false,
          }
        : skill;

    return normalizeCanonicalSkillGroupMembershipsInSkill(
      activeCanonicalGroupIds,
      removeRetiredSkillGroupMemberships(normalizedSkill),
    );
  });
}

export function validateSkillRelationships(content: CanonicalContent): CanonicalContent {
  const skillIds = new Set(content.skills.map((skill) => skill.id));
  const skillGroupIds = new Set(content.skillGroups.map((group) => group.id));
  const issues: string[] = [];

  for (const skill of content.skills) {
    if (!skill.categoryId) {
      issues.push(`Skill "${skill.name}" (${skill.id}) is missing an explicit player-facing categoryId.`);
    }

    for (const groupId of skill.groupIds) {
      if (!skillGroupIds.has(groupId)) {
        issues.push(`Skill "${skill.name}" (${skill.id}) references unknown skill group "${groupId}".`);
      }
    }

    if (!skill.groupIds.includes(skill.groupId)) {
      issues.push(
        `Skill "${skill.name}" (${skill.id}) uses primary group "${skill.groupId}" that is missing from groupIds.`,
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
          `Skill "${skill.name}" (${skill.id}) references unknown dependency skill "${dependencySkillId}".`,
        );
      }
    }

    if (skill.secondaryOfSkillId && !skillIds.has(skill.secondaryOfSkillId)) {
      issues.push(
        `Skill "${skill.name}" (${skill.id}) references unknown secondary-of skill "${skill.secondaryOfSkillId}".`,
      );
    }

    if (skill.specializationOfSkillId && !skillIds.has(skill.specializationOfSkillId)) {
      issues.push(
        `Skill "${skill.name}" (${skill.id}) references unknown specialization-of skill "${skill.specializationOfSkillId}".`,
      );
    }

    for (const grant of skill.derivedGrants ?? []) {
      if (grant.skillId === skill.id) {
        issues.push(`Skill "${skill.name}" (${skill.id}) cannot derive itself.`);
        continue;
      }

      if (!skillIds.has(grant.skillId)) {
        issues.push(
          `Skill "${skill.name}" (${skill.id}) references unknown derived skill "${grant.skillId}".`,
        );
      }
    }
  }

  for (const group of content.skillGroups) {
    for (const membership of group.skillMemberships ?? []) {
      if (!skillIds.has(membership.skillId)) {
        issues.push(`Skill group "${group.name}" (${group.id}) references unknown skill "${membership.skillId}".`);
        continue;
      }

      const skill = content.skills.find((candidate) => candidate.id === membership.skillId);

      if (!skill) {
        continue;
      }

      if (!skill.groupIds.includes(group.id)) {
        issues.push(
          `Skill group "${group.name}" (${group.id}) references skill "${membership.skillId}" that does not include the group in its groupIds.`,
        );
        continue;
      }

      if (skill.groupId === group.id && membership.relevance !== "core") {
        issues.push(
          `Skill group "${group.name}" (${group.id}) should mark primary skill "${skill.name}" (${skill.id}) as core.`,
        );
      }

      if (skill.groupId !== group.id && membership.relevance !== "optional") {
        issues.push(
          `Skill group "${group.name}" (${group.id}) should mark cross-listed skill "${skill.name}" (${skill.id}) as optional.`,
        );
      }
    }

    for (const slot of group.selectionSlots ?? []) {
      if (slot.chooseCount > slot.candidateSkillIds.length) {
        issues.push(
          `Skill group "${group.name}" (${group.id}) has selection slot "${slot.id}" choosing ${slot.chooseCount} skill(s) from only ${slot.candidateSkillIds.length} candidate(s).`,
        );
      }

      for (const candidateSkillId of slot.candidateSkillIds) {
        if (!skillIds.has(candidateSkillId)) {
          issues.push(
            `Skill group "${group.name}" (${group.id}) selection slot "${slot.id}" references unknown skill "${candidateSkillId}".`,
          );
          continue;
        }

        const skill = content.skills.find((candidate) => candidate.id === candidateSkillId);

        if (!skill) {
          continue;
        }

        if (!skill.groupIds.includes(group.id)) {
          issues.push(
            `Skill group "${group.name}" (${group.id}) selection slot "${slot.id}" references skill "${candidateSkillId}" that does not include the group in its groupIds.`,
          );
        }

        if (skill.specializationOfSkillId) {
          issues.push(
            `Skill group "${group.name}" (${group.id}) selection slot "${slot.id}" references specialization "${skill.name}" (${candidateSkillId}) as a normal skill candidate.`,
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
