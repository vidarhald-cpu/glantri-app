import type {
  CharacterBuild,
  CharacterProgression,
  CharacterSkill,
  CharacterSkillGroup,
  CharacterSpecialization,
  ChargenMode,
  GlantriCharacteristicKey,
  ProfessionDefinition,
  ProfessionSkillMap,
  RolledCharacterProfile,
  SkillDefinition,
  SkillGroupDefinition,
  SkillSpecialization,
  SocietyLevelAccess
} from "@glantri/domain";

import { calculateEducation, type EducationBreakdown } from "../education/calculateEducation";
import { calculateGroupLevel } from "../skills/calculateGroupLevel";
import { calculateSpecializationLevel } from "../skills/calculateSpecializationLevel";

const GROUP_POINT_COST = 4;
const ORDINARY_SKILL_POINT_COST = 2;
const SECONDARY_SKILL_POINT_COST = 1;
const NEW_SPECIALIZATION_COST = 4;
const EXISTING_SPECIALIZATION_COST = 2;
const DEFAULT_PRIMARY_POOL_TOTAL = 12;
const DEFAULT_SECONDARY_POOL_TOTAL = 6;
const LITERACY_SKILL_ID = "literacy";

interface CanonicalContentShape {
  professionSkills: ProfessionSkillMap[];
  professions: ProfessionDefinition[];
  skillGroups: SkillGroupDefinition[];
  skills: SkillDefinition[];
  societyLevels: SocietyLevelAccess[];
  specializations: SkillSpecialization[];
}

export interface SpendPrimaryPointInput {
  content: CanonicalContentShape;
  professionId: string;
  progression: CharacterProgression;
  societyId?: string;
  societyLevel: number;
  targetId: string;
  targetType: "group" | "skill";
}

export interface SpendSecondaryPointInput {
  content: CanonicalContentShape;
  professionId?: string;
  profile?: RolledCharacterProfile;
  progression: CharacterProgression;
  societyId?: string;
  societyLevel: number;
  targetId: string;
  targetType: "skill" | "specialization";
}

export interface SpendPointResult {
  error?: string;
  progression: CharacterProgression;
  spentCost?: number;
  warnings: string[];
}

export interface ChargenGroupView {
  gms: number;
  grantedRanks: number;
  groupId: string;
  groupLevel: number;
  name: string;
  primaryRanks: number;
  totalRanks: number;
}

export interface ChargenSkillView {
  category: "ordinary" | "secondary";
  effectiveSkillNumber: number;
  grantedRanks: number;
  groupId: string;
  groupLevel: number;
  linkedStatAverage: number;
  literacyWarning?: string;
  name: string;
  primaryRanks: number;
  requiresLiteracy: SkillDefinition["requiresLiteracy"];
  secondaryRanks: number;
  skillId: string;
  specificSkillLevel: number;
  totalSkill: number;
}

export interface ChargenSpecializationView {
  effectiveSpecializationNumber: number;
  name: string;
  parentSkillName: string;
  secondaryRanks: number;
  specializationId: string;
  specializationLevel: number;
}

export interface ChargenDraftView {
  education: EducationBreakdown;
  groups: ChargenGroupView[];
  primaryPoolAvailable: number;
  secondaryPoolAvailable: number;
  skills: ChargenSkillView[];
  specializations: ChargenSpecializationView[];
  totalSkillPointsInvested: number;
}

export interface ReviewChargenDraftInput {
  content: CanonicalContentShape;
  professionId?: string;
  profile?: RolledCharacterProfile;
  progression: CharacterProgression;
  socialClass?: string;
  societyId?: string;
  societyLevel?: number;
}

export interface ReviewChargenDraftResult {
  canFinalize: boolean;
  draftView: ChargenDraftView;
  errors: string[];
  warnings: string[];
}

export interface FinalizeChargenDraftInput extends ReviewChargenDraftInput {
  name?: string;
}

export interface FinalizeChargenDraftResult {
  build?: CharacterBuild;
  errors: string[];
  warnings: string[];
}

function isDefined<T>(value: T | null): value is T {
  return value !== null;
}

function createEmptyGroup(groupId: string): CharacterSkillGroup {
  return {
    gms: 0,
    grantedRanks: 0,
    groupId,
    primaryRanks: 0,
    ranks: 0
  };
}

function createEmptySkill(skill: SkillDefinition): CharacterSkill {
  return {
    category: skill.category,
    grantedRanks: 0,
    groupId: skill.groupId,
    level: 0,
    primaryRanks: 0,
    ranks: 0,
    secondaryRanks: 0,
    skillId: skill.id
  };
}

function createEmptySpecialization(specialization: SkillSpecialization): CharacterSpecialization {
  return {
    level: 0,
    ranks: 0,
    secondaryRanks: 0,
    skillId: specialization.skillId,
    specializationId: specialization.id
  };
}

function normalizeGroup(group: CharacterSkillGroup): CharacterSkillGroup {
  const grantedRanks = group.grantedRanks ?? 0;
  const primaryRanks = group.primaryRanks ?? 0;

  return {
    ...group,
    grantedRanks,
    gms: group.gms ?? 0,
    primaryRanks,
    ranks: grantedRanks + primaryRanks
  };
}

function normalizeSkill(skill: CharacterSkill): CharacterSkill {
  const grantedRanks = skill.grantedRanks ?? 0;
  const primaryRanks = skill.primaryRanks ?? 0;
  const secondaryRanks = skill.secondaryRanks ?? 0;

  return {
    ...skill,
    category: skill.category ?? "ordinary",
    grantedRanks,
    groupId: skill.groupId,
    level: skill.level ?? 0,
    primaryRanks,
    ranks: grantedRanks + primaryRanks + secondaryRanks,
    secondaryRanks
  };
}

function normalizeSpecialization(
  specialization: CharacterSpecialization
): CharacterSpecialization {
  const secondaryRanks = specialization.secondaryRanks ?? 0;

  return {
    ...specialization,
    level: specialization.level ?? 0,
    ranks: secondaryRanks,
    secondaryRanks,
    skillId: specialization.skillId
  };
}

function recalculateProgression(progression: CharacterProgression): CharacterProgression {
  return {
    ...progression,
    chargenMode: progression.chargenMode ?? "standard",
    educationPoints: progression.educationPoints ?? 0,
    primaryPoolSpent: progression.primaryPoolSpent ?? 0,
    primaryPoolTotal: progression.primaryPoolTotal ?? DEFAULT_PRIMARY_POOL_TOTAL,
    secondaryPoolSpent: progression.secondaryPoolSpent ?? 0,
    secondaryPoolTotal: progression.secondaryPoolTotal ?? DEFAULT_SECONDARY_POOL_TOTAL,
    skillGroups: progression.skillGroups.map(normalizeGroup),
    skills: progression.skills.map(normalizeSkill),
    specializations: progression.specializations.map(normalizeSpecialization)
  };
}

function getSocietyAccess(
  content: CanonicalContentShape,
  societyLevel: number,
  societyId?: string
): SocietyLevelAccess | undefined {
  return content.societyLevels.find(
    (item) =>
      item.societyLevel === societyLevel && (societyId === undefined || item.societyId === societyId)
  );
}

function getNextSocietyAccess(
  content: CanonicalContentShape,
  societyLevel: number,
  societyId?: string
): SocietyLevelAccess | undefined {
  return getSocietyAccess(content, societyLevel + 1, societyId);
}

function getProfessionById(
  content: CanonicalContentShape,
  professionId: string | undefined
): ProfessionDefinition | undefined {
  if (!professionId) {
    return undefined;
  }

  return content.professions.find((profession) => profession.id === professionId);
}

function getProfessionGrants(
  content: CanonicalContentShape,
  professionId: string
): ProfessionSkillMap[] {
  return content.professionSkills.filter((item) => item.professionId === professionId);
}

function getAllowedPrimaryGroupIdsInternal(
  content: CanonicalContentShape,
  professionId: string,
  societyId: string | undefined,
  societyLevel: number
): string[] {
  const society = getSocietyAccess(content, societyLevel, societyId);

  if (!society) {
    return [];
  }

  const professionGroupIds = new Set(
    getProfessionGrants(content, professionId)
      .filter((item) => item.grantType === "group" && item.skillGroupId)
      .map((item) => item.skillGroupId as string)
  );

  return society.skillGroupIds.filter((groupId) => professionGroupIds.has(groupId));
}

function getAllowedSecondaryGroupIdsInternal(
  content: CanonicalContentShape,
  societyId: string | undefined,
  societyLevel: number
): string[] {
  const current = getSocietyAccess(content, societyLevel, societyId);
  const next = getNextSocietyAccess(content, societyLevel, societyId);

  if (!current || !next) {
    return [];
  }

  return next.skillGroupIds.filter((groupId) => !current.skillGroupIds.includes(groupId));
}

function hasLiteracy(progression: CharacterProgression): boolean {
  return progression.skills.some((skill) => skill.skillId === LITERACY_SKILL_ID && skill.ranks > 0);
}

function getSkillById(
  content: CanonicalContentShape,
  skillId: string
): SkillDefinition | undefined {
  return content.skills.find((skill) => skill.id === skillId);
}

function getSpecializationById(
  content: CanonicalContentShape,
  specializationId: string
): SkillSpecialization | undefined {
  return content.specializations.find((specialization) => specialization.id === specializationId);
}

function getLinkedStatAverage(
  profile: RolledCharacterProfile | undefined,
  skill: SkillDefinition
): number {
  if (!profile) {
    return 0;
  }

  const values = skill.linkedStats.map(
    (stat) => profile.rolledStats[stat as GlantriCharacteristicKey] ?? 0
  );
  const total = values.reduce((sum, value) => sum + value, 0);

  return Math.floor(total / values.length);
}

function getSkillSpendCost(skill: SkillDefinition, exists: boolean): number {
  const baseCost =
    skill.category === "secondary" ? SECONDARY_SKILL_POINT_COST : ORDINARY_SKILL_POINT_COST;

  return exists ? baseCost : baseCost * 2;
}

function getGroupSpendCost(exists: boolean): number {
  return exists ? GROUP_POINT_COST : GROUP_POINT_COST * 2;
}

function getSpecializationSpendCost(exists: boolean): number {
  return exists ? EXISTING_SPECIALIZATION_COST : NEW_SPECIALIZATION_COST;
}

function ensureGroupExists(
  progression: CharacterProgression,
  groupId: string
): CharacterSkillGroup {
  const existing = progression.skillGroups.find((group) => group.groupId === groupId);

  if (existing) {
    return existing;
  }

  const created = createEmptyGroup(groupId);
  progression.skillGroups.push(created);
  return created;
}

function ensureSkillExists(
  progression: CharacterProgression,
  skill: SkillDefinition
): CharacterSkill {
  const existing = progression.skills.find((item) => item.skillId === skill.id);

  if (existing) {
    return existing;
  }

  const created = createEmptySkill(skill);
  progression.skills.push(created);
  return created;
}

function ensureSpecializationExists(
  progression: CharacterProgression,
  specialization: SkillSpecialization
): CharacterSpecialization {
  const existing = progression.specializations.find(
    (item) => item.specializationId === specialization.id
  );

  if (existing) {
    return existing;
  }

  const created = createEmptySpecialization(specialization);
  progression.specializations.push(created);
  return created;
}

function buildEducationBreakdown(input: {
  content: CanonicalContentShape;
  professionId?: string;
  profile?: RolledCharacterProfile;
  progression: CharacterProgression;
  societyId?: string;
  societyLevel?: number;
}): EducationBreakdown {
  return calculateEducation({
    profession: getProfessionById(input.content, input.professionId) ?? null,
    progression: input.progression,
    profile: input.profile,
    skills: input.content.skills,
    society:
      input.societyLevel !== undefined
        ? getSocietyAccess(input.content, input.societyLevel, input.societyId)
        : undefined,
    societyLevel: input.societyLevel
  });
}

function getReadableErrors(errors: Iterable<string>): string[] {
  return [...new Set(errors)];
}

export function createChargenProgression(mode: ChargenMode = "standard"): CharacterProgression {
  return recalculateProgression({
    chargenMode: mode,
    educationPoints: 0,
    level: 1,
    primaryPoolSpent: 0,
    primaryPoolTotal: DEFAULT_PRIMARY_POOL_TOTAL,
    secondaryPoolSpent: 0,
    secondaryPoolTotal: DEFAULT_SECONDARY_POOL_TOTAL,
    skillGroups: [],
    skills: [],
    specializations: []
  });
}

export function normalizeChargenProgression(
  progression: CharacterProgression | undefined
): CharacterProgression {
  return recalculateProgression(progression ?? createChargenProgression());
}

export function applyProfessionGrants(input: {
  content: CanonicalContentShape;
  mode?: ChargenMode;
  professionId: string;
}): CharacterProgression {
  const progression = createChargenProgression(input.mode ?? "standard");
  const grants = getProfessionGrants(input.content, input.professionId);

  for (const grant of grants) {
    if (grant.grantType === "group" && grant.skillGroupId) {
      const group = ensureGroupExists(progression, grant.skillGroupId);
      group.grantedRanks += grant.ranks;
      group.ranks = group.grantedRanks + group.primaryRanks;
      continue;
    }

    if (!grant.skillId) {
      continue;
    }

    const skillDefinition = getSkillById(input.content, grant.skillId);

    if (!skillDefinition) {
      continue;
    }

    ensureGroupExists(progression, skillDefinition.groupId);

    const skill = ensureSkillExists(progression, skillDefinition);
    skill.category = skillDefinition.category;
    skill.grantedRanks += grant.ranks;
    skill.groupId = skillDefinition.groupId;
    skill.ranks = skill.grantedRanks + skill.primaryRanks + skill.secondaryRanks;
  }

  return recalculateProgression(progression);
}

export function spendPrimaryPoint(input: SpendPrimaryPointInput): SpendPointResult {
  const progression = recalculateProgression(structuredClone(input.progression));
  const allowedGroupIds = getAllowedPrimaryGroupIdsInternal(
    input.content,
    input.professionId,
    input.societyId,
    input.societyLevel
  );
  const warnings: string[] = [];

  if (input.targetType === "group") {
    if (!allowedGroupIds.includes(input.targetId)) {
      return {
        error: "That group is not available for the selected profession and society.",
        progression,
        warnings
      };
    }

    const group = ensureGroupExists(progression, input.targetId);
    const cost = getGroupSpendCost(group.ranks > 0);

    if (progression.primaryPoolSpent + cost > progression.primaryPoolTotal) {
      return {
        error: "Not enough primary points remaining for that group purchase.",
        progression,
        warnings
      };
    }

    group.primaryRanks += 1;
    group.ranks = group.grantedRanks + group.primaryRanks;
    progression.primaryPoolSpent += cost;

    return {
      progression: recalculateProgression(progression),
      spentCost: cost,
      warnings
    };
  }

  const skillDefinition = getSkillById(input.content, input.targetId);

  if (!skillDefinition) {
    return {
      error: "Skill definition not found.",
      progression,
      warnings
    };
  }

  if (!allowedGroupIds.includes(skillDefinition.groupId)) {
    return {
      error: "That skill is not available for the selected profession and society.",
      progression,
      warnings
    };
  }

  const parentGroup = progression.skillGroups.find(
    (group) => group.groupId === skillDefinition.groupId
  );

  if (!parentGroup || parentGroup.ranks < 1) {
    return {
      error: "Buy or gain the parent group before purchasing this skill.",
      progression,
      warnings
    };
  }

  const literacyPresent = hasLiteracy(progression);

  if (
    skillDefinition.id !== LITERACY_SKILL_ID &&
    skillDefinition.requiresLiteracy === "required" &&
    !literacyPresent
  ) {
    return {
      error: "Literacy is required before this skill can be purchased.",
      progression,
      warnings
    };
  }

  if (
    skillDefinition.id !== LITERACY_SKILL_ID &&
    skillDefinition.requiresLiteracy === "recommended" &&
    !literacyPresent
  ) {
    warnings.push("Literacy is recommended for this skill, but the purchase is allowed.");
  }

  const skill = ensureSkillExists(progression, skillDefinition);
  const cost = getSkillSpendCost(skillDefinition, skill.ranks > 0);

  if (progression.primaryPoolSpent + cost > progression.primaryPoolTotal) {
    return {
      error: "Not enough primary points remaining for that skill purchase.",
      progression,
      warnings
    };
  }

  skill.primaryRanks += 1;
  skill.ranks = skill.grantedRanks + skill.primaryRanks + skill.secondaryRanks;
  progression.primaryPoolSpent += cost;

  return {
    progression: recalculateProgression(progression),
    spentCost: cost,
    warnings
  };
}

export function spendSecondaryPoint(input: SpendSecondaryPointInput): SpendPointResult {
  const progression = recalculateProgression(structuredClone(input.progression));
  const allowedGroupIds = getAllowedSecondaryGroupIdsInternal(
    input.content,
    input.societyId,
    input.societyLevel
  );
  const warnings: string[] = [];

  if (input.targetType === "skill") {
    const skillDefinition = getSkillById(input.content, input.targetId);

    if (!skillDefinition) {
      return {
        error: "Skill definition not found.",
        progression,
        warnings
      };
    }

    if (!allowedGroupIds.includes(skillDefinition.groupId)) {
      return {
        error: "That skill is not exactly one society level above the current character.",
        progression,
        warnings
      };
    }

    const literacyPresent = hasLiteracy(progression);

    if (
      skillDefinition.id !== LITERACY_SKILL_ID &&
      skillDefinition.requiresLiteracy === "required" &&
      !literacyPresent
    ) {
      return {
        error: "Literacy is required before this skill can be purchased.",
        progression,
        warnings
      };
    }

    if (
      skillDefinition.id !== LITERACY_SKILL_ID &&
      skillDefinition.requiresLiteracy === "recommended" &&
      !literacyPresent
    ) {
      warnings.push("Literacy is recommended for this skill, but the purchase is allowed.");
    }

    ensureGroupExists(progression, skillDefinition.groupId);

    const skill = ensureSkillExists(progression, skillDefinition);
    const cost = getSkillSpendCost(skillDefinition, skill.ranks > 0);

    if (progression.secondaryPoolSpent + cost > progression.secondaryPoolTotal) {
      return {
        error: "Not enough secondary points remaining for that skill purchase.",
        progression,
        warnings
      };
    }

    skill.secondaryRanks += 1;
    skill.ranks = skill.grantedRanks + skill.primaryRanks + skill.secondaryRanks;
    progression.secondaryPoolSpent += cost;

    return {
      progression: recalculateProgression(progression),
      spentCost: cost,
      warnings
    };
  }

  const specializationDefinition = getSpecializationById(input.content, input.targetId);

  if (!specializationDefinition) {
    return {
      error: "Specialization definition not found.",
      progression,
      warnings
    };
  }

  const parentSkillDefinition = getSkillById(input.content, specializationDefinition.skillId);

  if (!parentSkillDefinition || !parentSkillDefinition.allowsSpecializations) {
    return {
      error: "That specialization is not available for purchase.",
      progression,
      warnings
    };
  }

  if (!allowedGroupIds.includes(parentSkillDefinition.groupId)) {
    return {
      error: "That specialization is not exactly one society level above the current character.",
      progression,
      warnings
    };
  }

  const parentGroup = progression.skillGroups.find(
    (group) => group.groupId === parentSkillDefinition.groupId
  );

  if (!parentGroup) {
    return {
      error: "Acquire the parent group before purchasing a specialization.",
      progression,
      warnings
    };
  }

  const parentSkill = progression.skills.find(
    (skill) => skill.skillId === specializationDefinition.skillId && skill.ranks > 0
  );

  if (!parentSkill) {
    return {
      error: "Acquire the parent skill before purchasing a specialization.",
      progression,
      warnings
    };
  }

  const education = buildEducationBreakdown({
    content: input.content,
    professionId: input.professionId,
    profile: input.profile,
    progression,
    societyId: input.societyId,
    societyLevel: input.societyLevel
  });
  const parentGroupLevel = calculateGroupLevel({
    educationBonus: education.theoreticalSkillCount,
    gms: parentGroup.gms,
    ranks: parentGroup.ranks
  });

  if (parentGroupLevel < specializationDefinition.minimumGroupLevel) {
    return {
      error: "Group level 11 or higher is required before acquiring a specialization.",
      progression,
      warnings
    };
  }

  const specialization = ensureSpecializationExists(progression, specializationDefinition);
  const cost = getSpecializationSpendCost(specialization.ranks > 0);

  if (progression.secondaryPoolSpent + cost > progression.secondaryPoolTotal) {
    return {
      error: "Not enough secondary points remaining for that specialization purchase.",
      progression,
      warnings
    };
  }

  specialization.secondaryRanks += 1;
  specialization.skillId = specializationDefinition.skillId;
  specialization.ranks = specialization.secondaryRanks;
  progression.secondaryPoolSpent += cost;

  return {
    progression: recalculateProgression(progression),
    spentCost: cost,
    warnings
  };
}

export function buildChargenDraftView(input: {
  content: CanonicalContentShape;
  professionId?: string;
  profile?: RolledCharacterProfile;
  progression: CharacterProgression;
  societyId?: string;
  societyLevel?: number;
}): ChargenDraftView {
  const progression = recalculateProgression(input.progression);
  const education = buildEducationBreakdown({
    content: input.content,
    professionId: input.professionId,
    profile: input.profile,
    progression: input.progression,
    societyId: input.societyId,
    societyLevel: input.societyLevel
  });

  const groups = progression.skillGroups
    .map((group) => {
      const definition = input.content.skillGroups.find((item) => item.id === group.groupId);

      return {
        gms: group.gms,
        grantedRanks: group.grantedRanks,
        groupId: group.groupId,
        groupLevel: calculateGroupLevel({
          educationBonus: education.theoreticalSkillCount,
          gms: group.gms,
          ranks: group.ranks
        }),
        name: definition?.name ?? group.groupId,
        primaryRanks: group.primaryRanks,
        totalRanks: group.ranks
      };
    })
    .sort((left, right) => left.name.localeCompare(right.name));

  const skills = progression.skills
    .map((skill) => {
      const definition = getSkillById(input.content, skill.skillId);
      const groupView = groups.find((group) => group.groupId === skill.groupId);

      if (!definition || !groupView) {
        return null;
      }

      const specificSkillLevel = skill.ranks;
      const effectiveSkillNumber = groupView.groupLevel + specificSkillLevel;
      const linkedStatAverage = getLinkedStatAverage(input.profile, definition);
      const literacyWarning =
        definition.requiresLiteracy === "recommended" && !hasLiteracy(progression)
          ? "Literacy recommended"
          : undefined;

      const view: ChargenSkillView = {
        category: skill.category,
        effectiveSkillNumber,
        grantedRanks: skill.grantedRanks,
        groupId: skill.groupId,
        groupLevel: groupView.groupLevel,
        linkedStatAverage,
        literacyWarning,
        name: definition.name,
        primaryRanks: skill.primaryRanks,
        requiresLiteracy: definition.requiresLiteracy,
        secondaryRanks: skill.secondaryRanks,
        skillId: skill.skillId,
        specificSkillLevel,
        totalSkill: effectiveSkillNumber + linkedStatAverage
      };

      return view;
    })
    .filter(isDefined)
    .sort((left, right) => left.name.localeCompare(right.name));

  const specializations = progression.specializations
    .map((specialization) => {
      const definition = getSpecializationById(input.content, specialization.specializationId);
      const parentSkillDefinition = definition
        ? getSkillById(input.content, definition.skillId)
        : undefined;
      const groupView = parentSkillDefinition
        ? groups.find((group) => group.groupId === parentSkillDefinition.groupId)
        : undefined;

      if (!definition || !parentSkillDefinition || !groupView) {
        return null;
      }

      const view: ChargenSpecializationView = {
        effectiveSpecializationNumber: calculateSpecializationLevel({
          groupLevel: groupView.groupLevel,
          specializationLevel: specialization.ranks
        }),
        name: definition.name,
        parentSkillName: parentSkillDefinition.name,
        secondaryRanks: specialization.secondaryRanks,
        specializationId: specialization.specializationId,
        specializationLevel: specialization.ranks
      };

      return view;
    })
    .filter(isDefined)
    .sort((left, right) => left.name.localeCompare(right.name));

  return {
    education,
    groups,
    primaryPoolAvailable: progression.primaryPoolTotal - progression.primaryPoolSpent,
    secondaryPoolAvailable: progression.secondaryPoolTotal - progression.secondaryPoolSpent,
    skills,
    specializations,
    totalSkillPointsInvested: progression.primaryPoolSpent + progression.secondaryPoolSpent
  };
}

export function reviewChargenDraft(
  input: ReviewChargenDraftInput
): ReviewChargenDraftResult {
  const progression = recalculateProgression(input.progression);
  const draftView = buildChargenDraftView({
    content: input.content,
    professionId: input.professionId,
    profile: input.profile,
    progression,
    societyId: input.societyId,
    societyLevel: input.societyLevel
  });

  const errorSet = new Set<string>();
  const warningSet = new Set<string>();
  const literacyPresent = hasLiteracy(progression);

  if (!input.profile) {
    errorSet.add("Select a rolled profile before finalizing.");
  }

  if (input.societyLevel === undefined) {
    errorSet.add("Select a society before finalizing.");
  }

  if (!input.professionId) {
    errorSet.add("Select a profession before finalizing.");
  }

  if (progression.primaryPoolSpent > progression.primaryPoolTotal) {
    errorSet.add("Primary pool is overspent.");
  }

  if (progression.secondaryPoolSpent > progression.secondaryPoolTotal) {
    errorSet.add("Secondary pool is overspent.");
  }

  const allowedPrimaryGroupIds =
    input.professionId && input.societyLevel !== undefined
      ? getAllowedPrimaryGroupIdsInternal(
          input.content,
          input.professionId,
          input.societyId,
          input.societyLevel
        )
      : [];
  const allowedSecondaryGroupIds =
    input.societyLevel !== undefined
      ? getAllowedSecondaryGroupIdsInternal(input.content, input.societyId, input.societyLevel)
      : [];

  for (const group of progression.skillGroups) {
    if (group.primaryRanks > 0 && !allowedPrimaryGroupIds.includes(group.groupId)) {
      errorSet.add(`Primary spending on ${group.groupId} is not allowed for this profession and society.`);
    }
  }

  for (const skill of progression.skills) {
    const definition = getSkillById(input.content, skill.skillId);

    if (!definition) {
      errorSet.add(`Missing skill definition for ${skill.skillId}.`);
      continue;
    }

    if (skill.primaryRanks > 0 && !allowedPrimaryGroupIds.includes(definition.groupId)) {
      errorSet.add(`${definition.name} is not valid for primary-pool spending in this build.`);
    }

    if (skill.secondaryRanks > 0 && !allowedSecondaryGroupIds.includes(definition.groupId)) {
      errorSet.add(`${definition.name} is not valid for secondary-pool spending in this build.`);
    }

    if (
      definition.id !== LITERACY_SKILL_ID &&
      definition.requiresLiteracy === "required" &&
      skill.ranks > 0 &&
      !literacyPresent
    ) {
      errorSet.add(`${definition.name} requires Literacy before finalization.`);
    }

    if (
      definition.id !== LITERACY_SKILL_ID &&
      definition.requiresLiteracy === "recommended" &&
      skill.ranks > 0 &&
      !literacyPresent
    ) {
      warningSet.add(`${definition.name} recommends Literacy.`);
    }
  }

  for (const specialization of progression.specializations) {
    const definition = getSpecializationById(input.content, specialization.specializationId);

    if (!definition) {
      errorSet.add(`Missing specialization definition for ${specialization.specializationId}.`);
      continue;
    }

    const parentSkillDefinition = getSkillById(input.content, definition.skillId);

    if (!parentSkillDefinition || !parentSkillDefinition.allowsSpecializations) {
      errorSet.add(`${definition.name} does not have a valid parent skill.`);
      continue;
    }

    const parentSkill = progression.skills.find(
      (skill) => skill.skillId === definition.skillId && skill.ranks > 0
    );

    if (!parentSkill) {
      errorSet.add(`${definition.name} requires the parent skill to be present.`);
    }

    const parentGroup = draftView.groups.find(
      (group) => group.groupId === parentSkillDefinition.groupId
    );

    if (!parentGroup) {
      errorSet.add(`${definition.name} requires the parent group to exist.`);
      continue;
    }

    if (parentGroup.groupLevel < definition.minimumGroupLevel) {
      errorSet.add(`${definition.name} requires group level ${definition.minimumGroupLevel} or higher.`);
    }

    if (
      specialization.secondaryRanks > 0 &&
      !allowedSecondaryGroupIds.includes(parentSkillDefinition.groupId)
    ) {
      errorSet.add(`${definition.name} is not valid for secondary-pool spending in this build.`);
    }
  }

  return {
    canFinalize: errorSet.size === 0,
    draftView,
    errors: getReadableErrors(errorSet),
    warnings: getReadableErrors(warningSet)
  };
}

export function finalizeChargenDraft(
  input: FinalizeChargenDraftInput
): FinalizeChargenDraftResult {
  const review = reviewChargenDraft(input);

  if (!review.canFinalize || !input.profile) {
    return {
      errors: review.errors,
      warnings: review.warnings
    };
  }

  const progression = recalculateProgression(structuredClone(input.progression));
  progression.educationPoints = review.draftView.education.theoreticalSkillCount;

  const profession = getProfessionById(input.content, input.professionId);
  const build: CharacterBuild = {
    equipment: {
      items: []
    },
    id:
      globalThis.crypto && "randomUUID" in globalThis.crypto
        ? globalThis.crypto.randomUUID()
        : `character-${Date.now()}`,
    name:
      input.name?.trim() ||
      `${profession?.name ?? "Character"} ${input.profile.label}`.trim(),
    profile: input.profile,
    professionId: input.professionId,
    progression,
    socialClass: input.socialClass,
    societyId: input.societyId,
    societyLevel: input.societyLevel
  };

  return {
    build,
    errors: [],
    warnings: review.warnings
  };
}

export function getPrimaryPurchaseCostForGroup(
  progression: CharacterProgression,
  groupId: string
): number {
  const group = progression.skillGroups.find((item) => item.groupId === groupId);
  return getGroupSpendCost(Boolean(group && group.ranks > 0));
}

export function getPrimaryPurchaseCostForSkill(
  progression: CharacterProgression,
  skillDefinition: SkillDefinition
): number {
  const skill = progression.skills.find((item) => item.skillId === skillDefinition.id);
  return getSkillSpendCost(skillDefinition, Boolean(skill && skill.ranks > 0));
}

export function getSecondaryPurchaseCostForSkill(
  progression: CharacterProgression,
  skillDefinition: SkillDefinition
): number {
  const skill = progression.skills.find((item) => item.skillId === skillDefinition.id);
  return getSkillSpendCost(skillDefinition, Boolean(skill && skill.ranks > 0));
}

export function getSecondaryPurchaseCostForSpecialization(
  progression: CharacterProgression,
  specializationDefinition: SkillSpecialization
): number {
  const specialization = progression.specializations.find(
    (item) => item.specializationId === specializationDefinition.id
  );
  return getSpecializationSpendCost(Boolean(specialization && specialization.ranks > 0));
}

export function getAllowedPrimaryGroupIds(
  content: CanonicalContentShape,
  professionId: string,
  societyId: string | undefined,
  societyLevel: number
): string[] {
  return getAllowedPrimaryGroupIdsInternal(content, professionId, societyId, societyLevel);
}

export function getAllowedSecondaryGroupIds(
  content: CanonicalContentShape,
  societyId: string | undefined,
  societyLevel: number
): string[] {
  return getAllowedSecondaryGroupIdsInternal(content, societyId, societyLevel);
}
