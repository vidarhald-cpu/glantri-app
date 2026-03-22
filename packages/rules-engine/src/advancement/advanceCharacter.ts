import type {
  CharacterBuild,
  CharacterProgression,
  CharacterSkill,
  CharacterSkillGroup,
  CharacterSpecialization,
  ProfessionDefinition,
  ProfessionSkillMap,
  SkillDefinition,
  SkillGroupDefinition,
  SkillSpecialization,
  SocietyLevelAccess
} from "@glantri/domain";

import { calculateEducation } from "../education/calculateEducation";
import { calculateGroupLevel } from "../skills/calculateGroupLevel";
import { calculateSpecializationLevel } from "../skills/calculateSpecializationLevel";
import {
  buildChargenDraftView,
  getPrimaryPurchaseCostForGroup,
  getPrimaryPurchaseCostForSkill,
  getSecondaryPurchaseCostForSkill,
  getSecondaryPurchaseCostForSpecialization,
  normalizeChargenProgression,
  type ChargenDraftView
} from "../chargen/primaryAllocation";

const LITERACY_SKILL_ID = "literacy";

interface CanonicalContentShape {
  professions: ProfessionDefinition[];
  professionSkills: ProfessionSkillMap[];
  skillGroups: SkillGroupDefinition[];
  skills: SkillDefinition[];
  societyLevels: SocietyLevelAccess[];
  specializations: SkillSpecialization[];
}

export interface CharacterAdvancementView {
  advancementPointsAvailable: number;
  advancementPointsSpent: number;
  advancementPointsTotal: number;
  draftView: ChargenDraftView;
  seniority: number;
  totalSkillPointsInvested: number;
}

export interface ReviewCharacterAdvancementInput {
  advancementPointsSpent: number;
  advancementPointsTotal: number;
  build: CharacterBuild;
  content: CanonicalContentShape;
}

export interface ReviewCharacterAdvancementResult {
  canSave: boolean;
  errors: string[];
  view: CharacterAdvancementView;
  warnings: string[];
}

export interface SpendAdvancementPointInput extends ReviewCharacterAdvancementInput {
  targetId: string;
  targetType: "group" | "skill" | "specialization";
}

export interface SpendAdvancementPointResult {
  advancementPointsSpent: number;
  build: CharacterBuild;
  error?: string;
  spentCost?: number;
  warnings: string[];
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

function hasLiteracy(progression: CharacterProgression): boolean {
  return progression.skills.some((skill) => skill.skillId === LITERACY_SKILL_ID && skill.ranks > 0);
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

function createEmptySpecialization(
  specialization: SkillSpecialization
): CharacterSpecialization {
  return {
    level: 0,
    ranks: 0,
    secondaryRanks: 0,
    skillId: specialization.skillId,
    specializationId: specialization.id
  };
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

function buildEducation(input: {
  build: CharacterBuild;
  content: CanonicalContentShape;
}): ReturnType<typeof calculateEducation> {
  return calculateEducation({
    profession: getProfessionById(input.content, input.build.professionId) ?? null,
    progression: input.build.progression,
    profile: input.build.profile,
    skills: input.content.skills,
    society:
      input.build.societyLevel !== undefined
        ? input.content.societyLevels.find(
            (society) =>
              society.societyLevel === input.build.societyLevel &&
              (input.build.societyId === undefined || society.societyId === input.build.societyId)
          )
        : undefined,
    societyLevel: input.build.societyLevel
  });
}

function getGroupLevel(input: {
  build: CharacterBuild;
  content: CanonicalContentShape;
  group: CharacterSkillGroup;
}): number {
  const education = buildEducation(input);

  return calculateGroupLevel({
    educationBonus: education.theoreticalSkillCount,
    gms: input.group.gms,
    ranks: input.group.ranks
  });
}

export function getAdvancementPurchaseCostForSkill(
  progression: CharacterProgression,
  skillDefinition: SkillDefinition
): number {
  return skillDefinition.category === "secondary"
    ? getSecondaryPurchaseCostForSkill(progression, skillDefinition)
    : getPrimaryPurchaseCostForSkill(progression, skillDefinition);
}

export function buildCharacterAdvancementView(
  input: ReviewCharacterAdvancementInput
): CharacterAdvancementView {
  const draftView = buildChargenDraftView({
    content: input.content,
    professionId: input.build.professionId,
    profile: input.build.profile,
    progression: input.build.progression,
    societyId: input.build.societyId,
    societyLevel: input.build.societyLevel
  });
  const totalSkillPointsInvested =
    draftView.totalSkillPointsInvested + input.advancementPointsSpent;

  return {
    advancementPointsAvailable: input.advancementPointsTotal - input.advancementPointsSpent,
    advancementPointsSpent: input.advancementPointsSpent,
    advancementPointsTotal: input.advancementPointsTotal,
    draftView,
    seniority: totalSkillPointsInvested,
    totalSkillPointsInvested
  };
}

export function reviewCharacterAdvancement(
  input: ReviewCharacterAdvancementInput
): ReviewCharacterAdvancementResult {
  const progression = normalizeChargenProgression(input.build.progression);
  const view = buildCharacterAdvancementView(input);
  const errors = new Set<string>();
  const warnings = new Set<string>();
  const literacyPresent = hasLiteracy(progression);

  if (input.advancementPointsSpent > input.advancementPointsTotal) {
    errors.add("Advancement points are overspent.");
  }

  for (const skill of progression.skills) {
    const definition = getSkillById(input.content, skill.skillId);

    if (!definition) {
      errors.add(`Missing skill definition for ${skill.skillId}.`);
      continue;
    }

    const parentGroup = progression.skillGroups.find((group) => group.groupId === definition.groupId);

    if (!parentGroup || parentGroup.ranks < 1) {
      errors.add(`${definition.name} requires the parent group to exist.`);
    }

    if (
      definition.id !== LITERACY_SKILL_ID &&
      definition.requiresLiteracy === "required" &&
      skill.ranks > 0 &&
      !literacyPresent
    ) {
      errors.add(`${definition.name} requires Literacy before it can be retained.`);
    }

    if (
      definition.id !== LITERACY_SKILL_ID &&
      definition.requiresLiteracy === "recommended" &&
      skill.ranks > 0 &&
      !literacyPresent
    ) {
      warnings.add(`${definition.name} recommends Literacy.`);
    }
  }

  for (const specialization of progression.specializations) {
    const definition = getSpecializationById(input.content, specialization.specializationId);

    if (!definition) {
      errors.add(`Missing specialization definition for ${specialization.specializationId}.`);
      continue;
    }

    const parentSkillDefinition = getSkillById(input.content, definition.skillId);

    if (!parentSkillDefinition || !parentSkillDefinition.allowsSpecializations) {
      errors.add(`${definition.name} does not have a valid parent skill.`);
      continue;
    }

    const parentSkill = progression.skills.find(
      (skill) => skill.skillId === definition.skillId && skill.ranks > 0
    );

    if (!parentSkill) {
      errors.add(`${definition.name} requires the parent skill to exist.`);
      continue;
    }

    const parentGroup = progression.skillGroups.find(
      (group) => group.groupId === parentSkillDefinition.groupId
    );

    if (!parentGroup) {
      errors.add(`${definition.name} requires the parent group to exist.`);
      continue;
    }

    const groupLevel = getGroupLevel({
      build: input.build,
      content: input.content,
      group: parentGroup
    });

    if (groupLevel < definition.minimumGroupLevel) {
      errors.add(`${definition.name} requires group level ${definition.minimumGroupLevel} or higher.`);
    }
  }

  return {
    canSave: errors.size === 0,
    errors: [...errors],
    view,
    warnings: [...warnings]
  };
}

export function spendAdvancementPoint(
  input: SpendAdvancementPointInput
): SpendAdvancementPointResult {
  const build: CharacterBuild = structuredClone(input.build);
  const progression = normalizeChargenProgression(build.progression);
  const warnings: string[] = [];

  if (input.targetType === "group") {
    const cost = getPrimaryPurchaseCostForGroup(progression, input.targetId);

    if (input.advancementPointsSpent + cost > input.advancementPointsTotal) {
      return {
        advancementPointsSpent: input.advancementPointsSpent,
        build,
        error: "Not enough advancement points remaining for that group purchase.",
        warnings
      };
    }

    const group = ensureGroupExists(progression, input.targetId);
    group.primaryRanks += 1;
    group.ranks = group.grantedRanks + group.primaryRanks;
    build.progression = normalizeChargenProgression(progression);

    return {
      advancementPointsSpent: input.advancementPointsSpent + cost,
      build,
      spentCost: cost,
      warnings
    };
  }

  if (input.targetType === "skill") {
    const skillDefinition = getSkillById(input.content, input.targetId);

    if (!skillDefinition) {
      return {
        advancementPointsSpent: input.advancementPointsSpent,
        build,
        error: "Skill definition not found.",
        warnings
      };
    }

    const parentGroup = progression.skillGroups.find(
      (group) => group.groupId === skillDefinition.groupId
    );

    if (!parentGroup || parentGroup.ranks < 1) {
      return {
        advancementPointsSpent: input.advancementPointsSpent,
        build,
        error: "Buy or gain the parent group before purchasing this skill.",
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
        advancementPointsSpent: input.advancementPointsSpent,
        build,
        error: "Literacy is required before this skill can be purchased.",
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

    const cost = getAdvancementPurchaseCostForSkill(progression, skillDefinition);

    if (input.advancementPointsSpent + cost > input.advancementPointsTotal) {
      return {
        advancementPointsSpent: input.advancementPointsSpent,
        build,
        error: "Not enough advancement points remaining for that skill purchase.",
        warnings
      };
    }

    const skill = ensureSkillExists(progression, skillDefinition);

    if (skillDefinition.category === "secondary") {
      skill.secondaryRanks += 1;
    } else {
      skill.primaryRanks += 1;
    }

    skill.ranks = skill.grantedRanks + skill.primaryRanks + skill.secondaryRanks;
    build.progression = normalizeChargenProgression(progression);

    return {
      advancementPointsSpent: input.advancementPointsSpent + cost,
      build,
      spentCost: cost,
      warnings
    };
  }

  const specializationDefinition = getSpecializationById(input.content, input.targetId);

  if (!specializationDefinition) {
    return {
      advancementPointsSpent: input.advancementPointsSpent,
      build,
      error: "Specialization definition not found.",
      warnings
    };
  }

  const parentSkillDefinition = getSkillById(input.content, specializationDefinition.skillId);

  if (!parentSkillDefinition || !parentSkillDefinition.allowsSpecializations) {
    return {
      advancementPointsSpent: input.advancementPointsSpent,
      build,
      error: "That specialization is not available for purchase.",
      warnings
    };
  }

  const parentGroup = progression.skillGroups.find(
    (group) => group.groupId === parentSkillDefinition.groupId
  );

  if (!parentGroup) {
    return {
      advancementPointsSpent: input.advancementPointsSpent,
      build,
      error: "Acquire the parent group before purchasing a specialization.",
      warnings
    };
  }

  const parentSkill = progression.skills.find(
    (skill) => skill.skillId === specializationDefinition.skillId && skill.ranks > 0
  );

  if (!parentSkill) {
    return {
      advancementPointsSpent: input.advancementPointsSpent,
      build,
      error: "Acquire the parent skill before purchasing a specialization.",
      warnings
    };
  }

  const parentGroupLevel = getGroupLevel({
    build,
    content: input.content,
    group: parentGroup
  });

  if (parentGroupLevel < specializationDefinition.minimumGroupLevel) {
    return {
      advancementPointsSpent: input.advancementPointsSpent,
      build,
      error: `Group level ${specializationDefinition.minimumGroupLevel} or higher is required before acquiring a specialization.`,
      warnings
    };
  }

  const cost = getSecondaryPurchaseCostForSpecialization(progression, specializationDefinition);

  if (input.advancementPointsSpent + cost > input.advancementPointsTotal) {
    return {
      advancementPointsSpent: input.advancementPointsSpent,
      build,
      error: "Not enough advancement points remaining for that specialization purchase.",
      warnings
    };
  }

  const specialization = ensureSpecializationExists(progression, specializationDefinition);
  specialization.secondaryRanks += 1;
  specialization.ranks = specialization.secondaryRanks;
  specialization.skillId = specializationDefinition.skillId;
  build.progression = normalizeChargenProgression(progression);

  return {
    advancementPointsSpent: input.advancementPointsSpent + cost,
    build,
    spentCost: cost,
    warnings
  };
}

export function getEffectiveSpecializationNumber(input: {
  build: CharacterBuild;
  content: CanonicalContentShape;
  specializationId: string;
}): number | undefined {
  const specializationDefinition = getSpecializationById(input.content, input.specializationId);

  if (!specializationDefinition) {
    return undefined;
  }

  const specialization = input.build.progression.specializations.find(
    (item) => item.specializationId === input.specializationId
  );
  const parentSkillDefinition = getSkillById(input.content, specializationDefinition.skillId);
  const parentGroup = parentSkillDefinition
    ? input.build.progression.skillGroups.find((group) => group.groupId === parentSkillDefinition.groupId)
    : undefined;

  if (!specialization || !parentGroup) {
    return undefined;
  }

  return calculateSpecializationLevel({
    groupLevel: getGroupLevel({
      build: input.build,
      content: input.content,
      group: parentGroup
    }),
    specializationLevel: specialization.ranks
  });
}
