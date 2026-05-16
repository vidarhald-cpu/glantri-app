import type {
  CharacterChargenSelections,
  CharacterProgression,
  CharacterSkill,
  CharacterSkillGroup,
  CharacterSpecialization,
  CivilizationDefinition,
  GlantriCharacteristicKey,
  LanguageDefinition,
  ProfessionDefinition,
  ProfessionFamilyDefinition,
  ProfessionSkillMap,
  RolledCharacterProfile,
  SkillDefinition,
  SkillGroupDefinition,
  SkillSpecialization,
  SocietyBandSkillAccess,
  SocietyDefinition,
  SocietyLevelAccess
} from "@glantri/domain";
import {
  getCharacterSkillKey,
  normalizeCharacterSkillLanguageName,
  getSkillGroupIds
} from "@glantri/domain";

import { calculateEducation, type EducationBreakdown } from "../../education/calculateEducation";
import { calculateGroupLevel } from "../../skills/calculateGroupLevel";
import { selectBestSkillGroupContribution } from "../../skills/selectBestSkillGroupContribution";
import { STANDARD_CHARGEN_METHOD_POLICY } from "../policy";
import { getResolvedProfileStats } from "../statResolution";

export const LITERACY_SKILL_ID = "literacy";
export const LANGUAGE_SKILL_ID = "language";

export interface CanonicalContentShape {
  civilizations?: CivilizationDefinition[];
  languages?: LanguageDefinition[];
  professionFamilies: ProfessionFamilyDefinition[];
  professionSkills: ProfessionSkillMap[];
  professions: ProfessionDefinition[];
  skillGroups: SkillGroupDefinition[];
  skills: SkillDefinition[];
  societyBandSkillAccess?: SocietyBandSkillAccess[];
  societies?: SocietyDefinition[];
  societyLevels: SocietyLevelAccess[];
  specializations: SkillSpecialization[];
}

export function isDefined<T>(value: T | null): value is T {
  return value !== null;
}

export function createEmptyGroup(groupId: string): CharacterSkillGroup {
  return {
    gms: 0,
    grantedRanks: 0,
    groupId,
    primaryRanks: 0,
    secondaryRanks: 0,
    ranks: 0
  };
}

export function createEmptySkill(skill: SkillDefinition): CharacterSkill {
  return {
    category: skill.category,
    categoryId: skill.categoryId,
    grantedRanks: 0,
    groupId: getSkillDefinitionGroupIds(skill)[0],
    level: 0,
    primaryRanks: 0,
    ranks: 0,
    relationshipGrantedRanks: 0,
    secondaryRanks: 0,
    skillId: skill.id
  };
}

export function createEmptySpecialization(specialization: SkillSpecialization): CharacterSpecialization {
  return {
    level: 0,
    ranks: 0,
    relationshipGrantedRanks: 0,
    secondaryRanks: 0,
    skillId: specialization.skillId,
    specializationId: specialization.id
  };
}

export function normalizeGroup(group: CharacterSkillGroup): CharacterSkillGroup {
  const grantedRanks = group.grantedRanks ?? 0;
  const primaryRanks = group.primaryRanks ?? 0;
  const secondaryRanks = group.secondaryRanks ?? 0;

  return {
    ...group,
    grantedRanks,
    gms: group.gms ?? 0,
    primaryRanks,
    ranks: grantedRanks + primaryRanks + secondaryRanks,
    secondaryRanks
  };
}

export function normalizeSkill(skill: CharacterSkill): CharacterSkill {
  const grantedRanks = skill.grantedRanks ?? 0;
  const primaryRanks = skill.primaryRanks ?? 0;
  const relationshipGrantedRanks = skill.relationshipGrantedRanks ?? 0;
  const secondaryRanks = skill.secondaryRanks ?? 0;

  return {
    ...skill,
    category: skill.category ?? "ordinary",
    categoryId: skill.categoryId,
    grantedRanks,
    groupId: skill.groupId,
    languageName: normalizeCharacterSkillLanguageName(skill.languageName),
    level: skill.level ?? 0,
    primaryRanks,
    ranks: grantedRanks + primaryRanks + relationshipGrantedRanks + secondaryRanks,
    relationshipGrantedRanks,
    secondaryRanks,
    sourceTag: skill.sourceTag
  };
}

export function normalizeSpecialization(
  specialization: CharacterSpecialization
): CharacterSpecialization {
  const relationshipGrantedRanks = specialization.relationshipGrantedRanks ?? 0;
  const secondaryRanks = specialization.secondaryRanks ?? 0;

  return {
    ...specialization,
    level: specialization.level ?? 0,
    ranks: relationshipGrantedRanks + secondaryRanks,
    relationshipGrantedRanks,
    secondaryRanks,
    skillId: specialization.skillId
  };
}

export function recalculateProgression(progression: CharacterProgression): CharacterProgression {
  const chargenSelections: CharacterChargenSelections = {
    selectedLanguageIds: [...new Set(progression.chargenSelections?.selectedLanguageIds ?? [])],
    selectedSkillIds: [...new Set(progression.chargenSelections?.selectedSkillIds ?? [])],
    selectedGroupSlots: [
      ...new Map(
        (progression.chargenSelections?.selectedGroupSlots ?? []).map((selection) => [
          `${selection.groupId}:${selection.slotId}`,
          {
            groupId: selection.groupId,
            selectedSkillIds: [...new Set(selection.selectedSkillIds ?? [])],
            slotId: selection.slotId
          }
        ])
      ).values()
    ]
  };

  return {
    ...progression,
    chargenMode: progression.chargenMode ?? "standard",
    chargenSelections,
    educationPoints: progression.educationPoints ?? 0,
    primaryPoolSpent: progression.primaryPoolSpent ?? 0,
    primaryPoolTotal:
      progression.primaryPoolTotal ?? STANDARD_CHARGEN_METHOD_POLICY.primaryPoolTotal,
    secondaryPoolSpent: progression.secondaryPoolSpent ?? 0,
    secondaryPoolTotal:
      progression.secondaryPoolTotal ?? STANDARD_CHARGEN_METHOD_POLICY.secondaryPoolTotal,
    flexiblePointFactor:
      progression.flexiblePointFactor ?? STANDARD_CHARGEN_METHOD_POLICY.flexiblePointFactor,
    skillGroups: progression.skillGroups.map(normalizeGroup),
    skills: progression.skills.map(normalizeSkill),
    specializations: progression.specializations
      .map(normalizeSpecialization)
      .filter((specialization) => specialization.skillId !== LANGUAGE_SKILL_ID)
  };
}

export function cleanupProgression(progression: CharacterProgression): CharacterProgression {
  progression.specializations = progression.specializations.filter(
    (specialization) => specialization.ranks > 0
  );
  progression.skills = progression.skills.filter((skill) => skill.ranks > 0);
  progression.skillGroups = progression.skillGroups.filter((group) => group.gms > 0 || group.ranks > 0);

  return recalculateProgression(progression);
}

export function getSocietyAccess(
  content: CanonicalContentShape,
  societyLevel: number,
  societyId?: string
): SocietyLevelAccess | undefined {
  return content.societyLevels.find(
    (item) =>
      item.societyLevel === societyLevel && (societyId === undefined || item.societyId === societyId)
  );
}

export function getNextSocietyAccess(
  content: CanonicalContentShape,
  societyLevel: number,
  societyId?: string
): SocietyLevelAccess | undefined {
  return getSocietyAccess(content, societyLevel + 1, societyId);
}

export function getProfessionById(
  content: CanonicalContentShape,
  professionId: string | undefined
): ProfessionDefinition | undefined {
  if (!professionId) {
    return undefined;
  }

  return content.professions.find((profession) => profession.id === professionId);
}

export function hasLiteracy(progression: CharacterProgression): boolean {
  return progression.skills.some((skill) => skill.skillId === LITERACY_SKILL_ID && skill.ranks > 0);
}

export function getSkillById(
  content: CanonicalContentShape,
  skillId: string
): SkillDefinition | undefined {
  return content.skills.find((skill) => skill.id === skillId);
}

export function getSkillDefinitionGroupIds(skill: SkillDefinition): string[] {
  return getSkillGroupIds(skill);
}

export function getSkillGroupDefinition(
  content: CanonicalContentShape,
  groupId: string
): SkillGroupDefinition | undefined {
  return content.skillGroups.find((group) => group.id === groupId);
}

export function getSpecializationById(
  content: CanonicalContentShape,
  specializationId: string
): SkillSpecialization | undefined {
  return content.specializations.find((specialization) => specialization.id === specializationId);
}

export function getPurchasedParentGroups(
  progression: CharacterProgression,
  skillDefinition: SkillDefinition
): CharacterSkillGroup[] {
  const groupIds = new Set(getSkillDefinitionGroupIds(skillDefinition));

  return progression.skillGroups.filter((group) => group.ranks > 0 && groupIds.has(group.groupId));
}

export function getBestPurchasedParentGroup(
  content: CanonicalContentShape,
  progression: CharacterProgression,
  skillDefinition: SkillDefinition
): CharacterSkillGroup | undefined {
  const candidates = getPurchasedParentGroups(progression, skillDefinition).map((group) => {
    const definition = getSkillGroupDefinition(content, group.groupId);

    return {
      group,
      contribution: {
        groupId: group.groupId,
        groupLevel: calculateGroupLevel({
          gms: group.gms,
          ranks: group.ranks
        }),
        name: definition?.name ?? group.groupId,
        sortOrder: definition?.sortOrder ?? Number.MAX_SAFE_INTEGER
      }
    };
  });
  const bestContribution = selectBestSkillGroupContribution(
    candidates.map((candidate) => candidate.contribution)
  );

  return candidates.find((candidate) => candidate.contribution.groupId === bestContribution?.groupId)?.group;
}

export function getLinkedStatAverage(
  profile: RolledCharacterProfile | undefined,
  skill: SkillDefinition
): number {
  const resolvedStats = getResolvedProfileStats(profile);

  if (!resolvedStats) {
    return 0;
  }

  const values = skill.linkedStats.map((stat) => resolvedStats[stat as GlantriCharacteristicKey] ?? 0);
  const total = values.reduce((sum, value) => sum + value, 0);

  return Math.floor(total / values.length);
}

export function ensureGroupExists(
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

export function ensureSkillExists(
  progression: CharacterProgression,
  skill: SkillDefinition,
  variant?: Pick<CharacterSkill, "languageName">
): CharacterSkill {
  const existing = progression.skills.find(
    (item) =>
      getCharacterSkillKey(item) ===
      getCharacterSkillKey({
        languageName: variant?.languageName,
        skillId: skill.id
      })
  );

  if (existing) {
    return existing;
  }

  const created = createEmptySkill(skill);
  created.languageName = variant?.languageName;
  progression.skills.push(created);
  return created;
}

export function ensureSpecializationExists(
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

export function getProgressionSkillRows(
  progression: CharacterProgression,
  skillId: string
): CharacterSkill[] {
  return progression.skills.filter((skill) => skill.skillId === skillId);
}

export function getPreferredProgressionSkillRow(
  progression: CharacterProgression,
  skillId: string
): CharacterSkill | undefined {
  const rows = getProgressionSkillRows(progression, skillId);

  return (
    rows.find((skill) => skill.sourceTag === "mother-tongue") ??
    rows.find((skill) => skill.languageName) ??
    rows[0]
  );
}

export function getTargetedProgressionSkillRow(input: {
  progression: CharacterProgression;
  skillId: string;
  targetLanguageName?: string;
}): CharacterSkill | undefined {
  if (input.targetLanguageName) {
    return input.progression.skills.find(
      (skill) =>
        getCharacterSkillKey(skill) ===
        getCharacterSkillKey({
          languageName: input.targetLanguageName,
          skillId: input.skillId
        })
    );
  }

  return getPreferredProgressionSkillRow(input.progression, input.skillId);
}

export function buildEducationBreakdown(input: {
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

export function getEvaluationMessages(input: {
  advisories: { message: string }[];
  warnings: { message: string }[];
}): string[] {
  return [...input.warnings, ...input.advisories].map((item) => item.message);
}

export function getBestGroupIdByDefinitionOrder(
  content: CanonicalContentShape,
  groupIds: string[]
): string | undefined {
  const candidates = groupIds
    .map((groupId) => {
      const definition = getSkillGroupDefinition(content, groupId);

      return {
        groupId,
        groupLevel: 0,
        name: definition?.name ?? groupId,
        sortOrder: definition?.sortOrder ?? Number.MAX_SAFE_INTEGER
      };
    });

  return selectBestSkillGroupContribution(candidates)?.groupId;
}
