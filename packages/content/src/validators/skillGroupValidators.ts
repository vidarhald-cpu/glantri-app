import type { CanonicalContent } from "../types";
import {
  ALLOWED_SMALL_SKILL_GROUP_REASONS,
  ALLOWED_WEAPON_PACKAGE_REASONS,
  CANONICAL_SELECTION_SLOT_CANDIDATES,
  CANONICAL_SKILL_GROUP_MEMBERSHIPS,
  CANONICAL_SKILL_GROUP_NAMES,
  COMBAT_FUNDAMENTAL_SKILL_IDS,
  MELEE_WEAPON_SKILL_IDS,
  MILITARY_SUPPORT_GROUP_IDS,
  MINIMUM_DESIGN_GROUP_SKILL_POINTS,
  MINIMUM_GROUP_SKILL_COUNT,
  MINIMUM_GROUP_SKILL_POINTS,
  OFFICER_COMMAND_SKILL_IDS,
  RETIRED_SKILL_GROUP_IDS,
  WEAPON_SKILL_IDS,
} from "./constants";
import { normalizeSkillGroupId } from "@glantri/domain";

export interface CanonicalContentWarning {
  code: string;
  detail: string;
}

function getSkillPointWeight(skill: CanonicalContent["skills"][number]): number {
  return skill.category === "secondary" ? 1 : 2;
}

export function getSkillIdsForGroup(content: CanonicalContent, groupId: string): string[] {
  const group = content.skillGroups.find((candidate) => candidate.id === groupId);

  if ((group?.skillMemberships?.length ?? 0) > 0 || (group?.selectionSlots?.length ?? 0) > 0) {
    return [
      ...new Set([
        ...(group?.skillMemberships ?? []).map((membership) => membership.skillId),
        ...(group?.selectionSlots ?? []).flatMap((slot) => slot.candidateSkillIds),
      ]),
    ];
  }

  return content.skills
    .filter((skill) => skill.groupIds.includes(groupId))
    .map((skill) => skill.id);
}

function getSelectionSlotSkillIdsForGroup(
  group: CanonicalContent["skillGroups"][number],
): string[] {
  return (group.selectionSlots ?? []).flatMap((slot) => slot.candidateSkillIds);
}

function getWeightedSkillPointsForGroup(
  content: CanonicalContent,
  group: CanonicalContent["skillGroups"][number],
): number {
  const skillIds = getSkillIdsForGroup(content, group.id);

  return skillIds.reduce((total, skillId) => {
    const skill = content.skills.find((candidate) => candidate.id === skillId);

    return total + (skill ? getSkillPointWeight(skill) : 0);
  }, 0);
}

function hasAnySkillId(candidateSkillIds: string[], targetSkillIds: readonly string[]): boolean {
  return candidateSkillIds.some((skillId) => targetSkillIds.includes(skillId));
}

export function normalizeSkillGroups(content: CanonicalContent): CanonicalContent {
  const skillsById = new Map(content.skills.map((skill) => [skill.id, skill]));
  const groupsById = new Map<string, CanonicalContent["skillGroups"][number]>();

  const normalizeMembershipsForGroup = (
    groupId: string,
    memberships: NonNullable<CanonicalContent["skillGroups"][number]["skillMemberships"]>,
  ): NonNullable<CanonicalContent["skillGroups"][number]["skillMemberships"]> => {
    const canonicalMembershipSkillIds = CANONICAL_SKILL_GROUP_MEMBERSHIPS[groupId];

    if (!canonicalMembershipSkillIds) {
      return memberships;
    }

    return canonicalMembershipSkillIds
      .filter((skillId) => skillsById.get(skillId)?.groupIds.includes(groupId))
      .map((skillId) => ({
        skillId,
        relevance: "optional" as const,
      }));
  };

  for (const group of content.skillGroups) {
    const normalizedGroupId = normalizeSkillGroupId(group.id) ?? group.id;
    const isRetiredAliasGroup = normalizedGroupId !== group.id;
    const existing = groupsById.get(normalizedGroupId);
    const normalizedGroup = {
      ...group,
      id: normalizedGroupId,
      name: CANONICAL_SKILL_GROUP_NAMES[normalizedGroupId] ?? group.name,
      skillMemberships: isRetiredAliasGroup
        ? (group.skillMemberships ?? []).filter((membership) =>
            skillsById.get(membership.skillId)?.groupIds.includes(normalizedGroupId),
          )
        : group.skillMemberships,
    };

    if (!existing) {
      groupsById.set(normalizedGroupId, normalizedGroup);
      continue;
    }

    groupsById.set(normalizedGroupId, {
      ...existing,
      description: existing.description ?? normalizedGroup.description,
      name: CANONICAL_SKILL_GROUP_NAMES[normalizedGroupId] ?? existing.name,
      selectionSlots: [
        ...(existing.selectionSlots ?? []),
        ...(normalizedGroup.selectionSlots ?? []),
      ],
      skillMemberships: [
        ...(existing.skillMemberships ?? []),
        ...(normalizedGroup.skillMemberships ?? []),
      ],
      sortOrder: Math.min(existing.sortOrder, normalizedGroup.sortOrder),
    });
  }

  return {
    ...content,
    skillGroups: [...groupsById.values()].map((group) => ({
      ...group,
      selectionSlots: (group.selectionSlots ?? []).map((slot) => ({
        ...slot,
        candidateSkillIds: [
          ...new Set(
            CANONICAL_SELECTION_SLOT_CANDIDATES[group.id]?.[slot.id] ?? slot.candidateSkillIds,
          ),
        ],
      })),
      skillMemberships: [
        ...new Map(
          normalizeMembershipsForGroup(group.id, group.skillMemberships ?? []).map((membership) => {
            const skill = skillsById.get(membership.skillId);
            const relevance: "core" | "optional" =
              skill?.groupId === group.id ? "core" : "optional";

            return [
              membership.skillId,
              {
                ...membership,
                relevance,
              },
            ];
          }),
        ).values(),
      ],
    })),
  };
}

export function validateSkillGroupDesign(content: CanonicalContent): CanonicalContent {
  const issues: string[] = [];
  const retiredSkillGroupIds = new Set<string>(RETIRED_SKILL_GROUP_IDS);
  const combatFundamentalSkillIds = new Set<string>(COMBAT_FUNDAMENTAL_SKILL_IDS);
  const weaponSkillIds = new Set<string>(WEAPON_SKILL_IDS);

  for (const group of content.skillGroups) {
    const fixedSkillIds = (group.skillMemberships ?? []).map((membership) => membership.skillId);
    const slotSkillIds = getSelectionSlotSkillIdsForGroup(group);
    const allGroupSkillIds = [...new Set([...fixedSkillIds, ...slotSkillIds])];
    const hasSelectionSlots = (group.selectionSlots?.length ?? 0) > 0;
    const hasDodge = fixedSkillIds.includes("dodge");
    const hasParry = fixedSkillIds.includes("parry");
    const hasBrawling = fixedSkillIds.includes("brawling");
    const hasMeleeWeaponContext =
      hasAnySkillId(fixedSkillIds, MELEE_WEAPON_SKILL_IDS) ||
      hasAnySkillId(slotSkillIds, MELEE_WEAPON_SKILL_IDS);
    const containsWeaponContext = allGroupSkillIds.some((skillId) => weaponSkillIds.has(skillId));

    if (retiredSkillGroupIds.has(group.id)) {
      issues.push(
        `Retired skill group "${group.name}" (${group.id}) must not appear as an active canonical skill group.`,
      );
    }

    if (
      !hasSelectionSlots &&
      !ALLOWED_SMALL_SKILL_GROUP_REASONS[group.id] &&
      getWeightedSkillPointsForGroup(content, group) < MINIMUM_DESIGN_GROUP_SKILL_POINTS
    ) {
      issues.push(
        `Skill group "${group.name}" (${group.id}) has insufficient weighted value. Expected at least ${MINIMUM_DESIGN_GROUP_SKILL_POINTS} weighted points or an explicit allowed-small-group reason.`,
      );
    }

    if (containsWeaponContext && !ALLOWED_WEAPON_PACKAGE_REASONS[group.id]) {
      issues.push(
        `Skill group "${group.name}" (${group.id}) contains weapon skills or weapon-choice slots but is not an explicit weapon/combat package.`,
      );
    }

    if (hasParry && (!hasDodge || !hasMeleeWeaponContext)) {
      issues.push(
        `Skill group "${group.name}" (${group.id}) contains Parry without Dodge and melee weapon context.`,
      );
    }

    if (hasDodge && (!hasParry || !hasMeleeWeaponContext)) {
      issues.push(
        `Skill group "${group.name}" (${group.id}) contains Dodge outside a coherent melee/defensive combat package.`,
      );
    }

    if (hasBrawling && (!hasDodge || !hasParry || !hasMeleeWeaponContext)) {
      issues.push(
        `Skill group "${group.name}" (${group.id}) contains Brawling outside a coherent melee combat package.`,
      );
    }

    if (MILITARY_SUPPORT_GROUP_IDS.includes(group.id as (typeof MILITARY_SUPPORT_GROUP_IDS)[number])) {
      const forbiddenSkillIds = allGroupSkillIds.filter(
        (skillId) =>
          combatFundamentalSkillIds.has(skillId) ||
          weaponSkillIds.has(skillId) ||
          OFFICER_COMMAND_SKILL_IDS.includes(skillId as (typeof OFFICER_COMMAND_SKILL_IDS)[number]),
      );

      if (forbiddenSkillIds.length > 0) {
        issues.push(
          `Military-support skill group "${group.name}" (${group.id}) contains forbidden combat or command skill(s): ${forbiddenSkillIds.join(", ")}.`,
        );
      }
    }
  }

  if (issues.length > 0) {
    throw new Error(`Invalid skill-group design content:\n${issues.join("\n")}`);
  }

  return content;
}

export function shouldValidateSkillGroupDesign(content: CanonicalContent): boolean {
  const skillGroupIds = new Set(content.skillGroups.map((group) => group.id));

  return (
    content.civilizations.length > 0 &&
    skillGroupIds.has("basic_melee_training") &&
    skillGroupIds.has("defensive_soldiering") &&
    skillGroupIds.has("veteran_soldiering")
  );
}

export function collectCanonicalContentWarnings(content: CanonicalContent): CanonicalContentWarning[] {
  const warnings: CanonicalContentWarning[] = [];

  for (const group of content.skillGroups) {
    const groupSkillIds = getSkillIdsForGroup(content, group.id);
    const points = groupSkillIds.reduce((total, skillId) => {
      const skill = content.skills.find((candidate) => candidate.id === skillId);
      return total + (skill ? getSkillPointWeight(skill) : 0);
    }, 0);

    if (groupSkillIds.length < MINIMUM_GROUP_SKILL_COUNT && points < MINIMUM_GROUP_SKILL_POINTS) {
      warnings.push({
        code: "weak-skill-group",
        detail: `Skill group "${group.name}" (${group.id}) is weak: ${groupSkillIds.length} skills / ${points} points. Expected at least ${MINIMUM_GROUP_SKILL_COUNT} skills or ${MINIMUM_GROUP_SKILL_POINTS} points.`,
      });
    }
  }

  return warnings;
}
