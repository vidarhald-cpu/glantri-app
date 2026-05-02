import { normalizeSkillGroupId } from "@glantri/domain";

import { canonicalContentSchema, type CanonicalContent } from "./types";
import {
  applySkillRelationshipMetadata,
  applySpecializationRelationshipMetadata
} from "./skillRelationshipMetadata";

const EXPECTED_SOCIAL_BANDS = [1, 2, 3, 4] as const;
const EXPECTED_SOCIETY_SCALE = [1, 2, 3, 4, 5, 6] as const;
const MINIMUM_GROUP_SKILL_COUNT = 3;
const MINIMUM_GROUP_SKILL_POINTS = 7;
const MINIMUM_DESIGN_GROUP_SKILL_POINTS = 6;

const RETIRED_SKILL_GROUP_IDS = [
  "field_soldiering",
  "officer_training",
  "trap_and_intrusion_work"
] as const;

const COMBAT_FUNDAMENTAL_SKILL_IDS = ["dodge", "parry", "brawling"] as const;
const MELEE_WEAPON_SKILL_IDS = [
  "one_handed_edged",
  "one_handed_concussion_axe",
  "two_handed_edged",
  "two_handed_concussion_axe",
  "polearms",
  "lance"
] as const;
const MISSILE_WEAPON_SKILL_IDS = ["throwing", "sling", "bow", "longbow", "crossbow"] as const;
const WEAPON_SKILL_IDS = [...MELEE_WEAPON_SKILL_IDS, ...MISSILE_WEAPON_SKILL_IDS] as const;

const ALLOWED_SMALL_SKILL_GROUP_REASONS: Partial<Record<string, string>> = {
  civic_learning: "Focused civic literacy and law foundation.",
  commercial_administration: "Focused ledger and office-administration foundation.",
  fieldcraft_stealth: "Focused stealth/camouflage fieldcraft cluster.",
  formal_performance: "Focused formal stage/oratory performance cluster.",
  healing_practice: "Focused practical healing foundation.",
  maritime_crew_training: "Focused shipboard crew baseline.",
  omen_and_ritual_practice: "Focused divination and ritual-reading cluster.",
  political_acumen: "Focused social-political reading cluster.",
  social_reading: "Focused social perception cluster.",
  stealth_group: "Broad stealth taxonomy group retained for compatibility.",
  street_theft: "Focused petty theft and concealment cluster."
};

const ALLOWED_WEAPON_PACKAGE_REASONS: Partial<Record<string, string>> = {
  advanced_melee_training: "Coherent melee package with Dodge, Parry, Brawling, and melee weapon choices.",
  advanced_missile_training: "Weapon-choice missile package.",
  basic_melee_training: "Coherent melee package with Dodge, Parry, Brawling, and a melee weapon choice.",
  basic_missile_training: "Weapon-choice missile package.",
  combat_group: "Broad combat taxonomy group.",
  mounted_warrior_training: "Coherent mounted combat package with Dodge, Parry, and fixed mounted weapons."
};

const MILITARY_SUPPORT_GROUP_IDS = ["defensive_soldiering", "veteran_soldiering"] as const;
const OFFICER_COMMAND_SKILL_IDS = ["captaincy", "tactics"] as const;

const CANONICAL_SKILL_GROUP_NAMES: Partial<Record<string, string>> = {
  covert_entry: "Covert Entry",
  veteran_leadership: "Veteran Leadership",
  veteran_soldiering: "Veteran Soldiering"
};

const CANONICAL_SKILL_GROUP_MEMBERSHIPS: Partial<Record<string, string[]>> = {
  defensive_soldiering: [
    "formation_fighting",
    "battlefield_awareness",
    "perception",
    "combat_experience",
    "first_aid"
  ],
  veteran_soldiering: [
    "combat_experience",
    "battlefield_awareness",
    "perception",
    "first_aid",
    "weapon_maintenance"
  ]
};

const REMOVED_SKILL_GROUP_IDS_BY_SKILL_ID: Partial<Record<string, string[]>> = {
  dodge: [
    "basic_missile_training",
    "advanced_missile_training",
    "defensive_soldiering",
    "veteran_soldiering"
  ],
  parry: ["defensive_soldiering", "veteran_soldiering"]
};

function removeRetiredSkillGroupMemberships(
  skill: CanonicalContent["skills"][number]
): CanonicalContent["skills"][number] {
  const removedGroupIds = new Set(REMOVED_SKILL_GROUP_IDS_BY_SKILL_ID[skill.id] ?? []);

  if (removedGroupIds.size === 0) {
    return skill;
  }

  const groupIds = skill.groupIds.filter((groupId) => !removedGroupIds.has(groupId));

  return {
    ...skill,
    groupId: groupIds.includes(skill.groupId) ? skill.groupId : (groupIds[0] ?? skill.groupId),
    groupIds
  };
}

function normalizeCanonicalSkillGroupMembershipsInSkill(
  activeCanonicalGroupIds: Set<string>,
  skill: CanonicalContent["skills"][number]
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
    groupIds: normalizedGroupIds
  };
}

function slugifyLanguageName(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function buildCanonicalLanguageId(name: string): string {
  return `${slugifyLanguageName(name)}_language`;
}

function isSocietyDerivedPlaceholderLanguage(input: {
  language: CanonicalContent["languages"][number];
  societiesById: Map<string, CanonicalContent["societies"][number]>;
}): boolean {
  if (!input.language.sourceSocietyId) {
    return false;
  }

  const society = input.societiesById.get(input.language.sourceSocietyId);

  return society?.name === input.language.name;
}

function normalizeLanguages(content: CanonicalContent): CanonicalContent {
  if (content.civilizations.length === 0) {
    return content;
  }

  const societiesById = new Map(content.societies.map((society) => [society.id, society]));
  const preservedLanguages = content.languages.filter(
    (language) => !isSocietyDerivedPlaceholderLanguage({ language, societiesById })
  );
  const languageByName = new Map(
    preservedLanguages.map((language) => [language.name, { ...language }])
  );
  const canonicalNameBySocietyId = new Map<string, string>();

  for (const civilization of content.civilizations) {
    const canonicalNames = [
      civilization.motherTongueLanguageName,
      civilization.spokenLanguageName,
      civilization.writtenLanguageName ?? undefined,
      ...(civilization.optionalLanguageNames ?? [])
    ].filter((name): name is string => Boolean(name?.trim()));

    for (const languageName of canonicalNames) {
      if (!languageByName.has(languageName)) {
        languageByName.set(languageName, {
          id: buildCanonicalLanguageId(languageName),
          name: languageName
        });
      }
    }

    if (!canonicalNameBySocietyId.has(civilization.linkedSocietyId)) {
      canonicalNameBySocietyId.set(
        civilization.linkedSocietyId,
        civilization.motherTongueLanguageName || civilization.spokenLanguageName
      );
    }
  }

  const normalizedLanguages = [...languageByName.values()].sort((left, right) =>
    left.name.localeCompare(right.name)
  );
  const normalizedLanguageIdByName = new Map(
    normalizedLanguages.map((language) => [language.name, language.id])
  );

  return {
    ...content,
    languages: normalizedLanguages,
    societies: content.societies.map((society) => {
      const canonicalBaselineName = canonicalNameBySocietyId.get(society.id);
      const canonicalBaselineId =
        canonicalBaselineName ? normalizedLanguageIdByName.get(canonicalBaselineName) : undefined;

      return canonicalBaselineId
        ? {
            ...society,
            baselineLanguageIds: [canonicalBaselineId]
          }
        : society;
    })
  };
}

function normalizeSkillGroups(content: CanonicalContent): CanonicalContent {
  const skillsById = new Map(content.skills.map((skill) => [skill.id, skill]));
  const groupsById = new Map<string, CanonicalContent["skillGroups"][number]>();
  const normalizeMembershipsForGroup = (
    groupId: string,
    memberships: NonNullable<CanonicalContent["skillGroups"][number]["skillMemberships"]>
  ): NonNullable<CanonicalContent["skillGroups"][number]["skillMemberships"]> => {
    const canonicalMembershipSkillIds = CANONICAL_SKILL_GROUP_MEMBERSHIPS[groupId];

    if (!canonicalMembershipSkillIds) {
      return memberships;
    }

    return canonicalMembershipSkillIds
      .filter((skillId) => skillsById.get(skillId)?.groupIds.includes(groupId))
      .map((skillId) => ({
        skillId,
        relevance: "optional" as const
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
            skillsById.get(membership.skillId)?.groupIds.includes(normalizedGroupId)
          )
        : group.skillMemberships
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
        ...(normalizedGroup.selectionSlots ?? [])
      ],
      skillMemberships: [
        ...(existing.skillMemberships ?? []),
        ...(normalizedGroup.skillMemberships ?? [])
      ],
      sortOrder: Math.min(existing.sortOrder, normalizedGroup.sortOrder)
    });
  }

  return {
    ...content,
    skillGroups: [...groupsById.values()].map((group) => ({
      ...group,
      selectionSlots: (group.selectionSlots ?? []).map((slot) => ({
        ...slot,
        candidateSkillIds: [...new Set(slot.candidateSkillIds)]
      })),
      skillMemberships: [
        ...new Map(
          normalizeMembershipsForGroup(group.id, group.skillMemberships ?? []).map(
            (membership) => {
              const skill = skillsById.get(membership.skillId);
              const relevance: "core" | "optional" =
                skill?.groupId === group.id ? "core" : "optional";

              return [
                membership.skillId,
                {
                  ...membership,
                  relevance
                }
              ];
            }
          )
        ).values()
      ]
    }))
  };
}

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

function getSelectionSlotSkillIdsForGroup(
  group: CanonicalContent["skillGroups"][number]
): string[] {
  return (group.selectionSlots ?? []).flatMap((slot) => slot.candidateSkillIds);
}

function getWeightedSkillPointsForGroup(
  content: CanonicalContent,
  group: CanonicalContent["skillGroups"][number]
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

function validateSkillGroupDesign(content: CanonicalContent): CanonicalContent {
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
        `Retired skill group "${group.name}" (${group.id}) must not appear as an active canonical skill group.`
      );
    }

    if (
      !hasSelectionSlots &&
      !ALLOWED_SMALL_SKILL_GROUP_REASONS[group.id] &&
      getWeightedSkillPointsForGroup(content, group) < MINIMUM_DESIGN_GROUP_SKILL_POINTS
    ) {
      issues.push(
        `Skill group "${group.name}" (${group.id}) has insufficient weighted value. Expected at least ${MINIMUM_DESIGN_GROUP_SKILL_POINTS} weighted points or an explicit allowed-small-group reason.`
      );
    }

    if (containsWeaponContext && !ALLOWED_WEAPON_PACKAGE_REASONS[group.id]) {
      issues.push(
        `Skill group "${group.name}" (${group.id}) contains weapon skills or weapon-choice slots but is not an explicit weapon/combat package.`
      );
    }

    if (hasParry && (!hasDodge || !hasMeleeWeaponContext)) {
      issues.push(
        `Skill group "${group.name}" (${group.id}) contains Parry without Dodge and melee weapon context.`
      );
    }

    if (hasDodge && (!hasParry || !hasMeleeWeaponContext)) {
      issues.push(
        `Skill group "${group.name}" (${group.id}) contains Dodge outside a coherent melee/defensive combat package.`
      );
    }

    if (hasBrawling && (!hasDodge || !hasParry || !hasMeleeWeaponContext)) {
      issues.push(
        `Skill group "${group.name}" (${group.id}) contains Brawling outside a coherent melee combat package.`
      );
    }

    if (MILITARY_SUPPORT_GROUP_IDS.includes(group.id as (typeof MILITARY_SUPPORT_GROUP_IDS)[number])) {
      const forbiddenSkillIds = allGroupSkillIds.filter(
        (skillId) =>
          combatFundamentalSkillIds.has(skillId) ||
          weaponSkillIds.has(skillId) ||
          OFFICER_COMMAND_SKILL_IDS.includes(skillId as (typeof OFFICER_COMMAND_SKILL_IDS)[number])
      );

      if (forbiddenSkillIds.length > 0) {
        issues.push(
          `Military-support skill group "${group.name}" (${group.id}) contains forbidden combat or command skill(s): ${forbiddenSkillIds.join(", ")}.`
        );
      }
    }
  }

  if (issues.length > 0) {
    throw new Error(`Invalid skill-group design content:\n${issues.join("\n")}`);
  }

  return content;
}

function shouldValidateSkillGroupDesign(content: CanonicalContent): boolean {
  const skillGroupIds = new Set(content.skillGroups.map((group) => group.id));

  return (
    content.civilizations.length > 0 &&
    skillGroupIds.has("basic_melee_training") &&
    skillGroupIds.has("defensive_soldiering") &&
    skillGroupIds.has("veteran_soldiering")
  );
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

    const seenOptionalLanguageNames = new Set<string>();

    for (const languageName of civilization.optionalLanguageNames ?? []) {
      if (languageName === civilization.motherTongueLanguageName) {
        issues.push(
          `Civilization "${civilization.name}" (${civilization.id}) repeats mother tongue "${languageName}" inside optionalLanguageNames.`
        );
      }

      if (seenOptionalLanguageNames.has(languageName)) {
        issues.push(
          `Civilization "${civilization.name}" (${civilization.id}) repeats optional language "${languageName}".`
        );
      }

      seenOptionalLanguageNames.add(languageName);
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
  const seenEntryKeys = new Set<string>();
  const skillIds = new Set(content.skills.map((skill) => skill.id));
  const societiesById = new Map(content.societies.map((society) => [society.id, society]));
  const societyBandRows = new Set(
    content.societyLevels.map((row) => `${row.societyId}:${row.societyLevel}`)
  );

  for (const entry of content.societyBandSkillAccess) {
    const entryKey = `${entry.societyId}:${entry.socialBand}:${entry.skillId}`;

    if (seenEntryKeys.has(entryKey)) {
      issues.push(
        `Duplicate society-band skill access row "${entry.societyId}:L${entry.socialBand}:${entry.skillId}".`
      );
      continue;
    }

    seenEntryKeys.add(entryKey);

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

    for (const grant of skill.derivedGrants ?? []) {
      if (grant.skillId === skill.id) {
        issues.push(`Skill "${skill.name}" (${skill.id}) cannot derive itself.`);
        continue;
      }

      if (!skillIds.has(grant.skillId)) {
        issues.push(
          `Skill "${skill.name}" (${skill.id}) references unknown derived skill "${grant.skillId}".`
        );
      }
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
  const activeCanonicalGroupIds = new Set(
    parsedContent.skillGroups.map((group) => normalizeSkillGroupId(group.id) ?? group.id)
  );
  const normalizedSkills: CanonicalContent["skills"] = applySkillRelationshipMetadata(
    parsedContent.skills
  ).map((skill): CanonicalContent["skills"][number] => {
    const normalizedSkill =
      skill.id === "language"
        ? {
            ...skill,
            category: "ordinary" as const,
            categoryId: "language" as const,
            allowsSpecializations: false
          }
        : skill;

    return normalizeCanonicalSkillGroupMembershipsInSkill(
      activeCanonicalGroupIds,
      removeRetiredSkillGroupMemberships(normalizedSkill)
    );
  });
  const normalizedContent: CanonicalContent = normalizeSkillGroups(normalizeLanguages({
    ...parsedContent,
    skills: normalizedSkills,
    specializations: applySpecializationRelationshipMetadata(
      parsedContent.specializations,
      normalizedSkills
    ).filter(
      (specialization) => specialization.skillId !== "language"
    ),
    civilizations:
      typeof input === "object" &&
      input !== null &&
      Array.isArray((input as { civilizations?: unknown[] }).civilizations)
        ? ((input as { civilizations: CanonicalContent["civilizations"] }).civilizations ?? [])
        : parsedContent.civilizations ?? []
  }));

  const validateDesign = shouldValidateSkillGroupDesign(normalizedContent)
    ? validateSkillGroupDesign
    : (content: CanonicalContent): CanonicalContent => content;

  return validateProfessionRelationships(
    validateDesign(
      validateSkillRelationships(
        validateCivilizations(
          validateLanguages(
            validateSocieties(
              validateSocietyBandSkillAccess(validateSocietyBandRows(normalizedContent))
            )
          )
        )
      )
    )
  );
}
