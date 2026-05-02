import type {
  CivilizationDefinition,
  CharacterBuild,
  CharacterChargenSelections,
  CharacterProgression,
  CharacterSkill,
  CharacterSkillGroup,
  CharacterSpecialization,
  ChargenMode,
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
  getAccessibleFoundationalSkillIdsForSocietyBand,
  getCharacterSkillKey,
  normalizeCharacterSkillLanguageName,
  getSkillGroupIds
} from "@glantri/domain";

import { calculateEducation, type EducationBreakdown } from "../education/calculateEducation";
import { resolveEffectiveProfessionPackage } from "../professions/resolveEffectiveProfessionPackage";
import { calculateGroupLevel } from "../skills/calculateGroupLevel";
import { calculateSpecializationLevel } from "../skills/calculateSpecializationLevel";
import {
  applyRelationshipMinimumGrants,
  resolveRelationshipMinimumGrants,
  type SkillRelationshipSourceType
} from "../skills/deriveSkillRelationships";
import { evaluateSkillSelection } from "../skills/evaluateSkillSelection";
import { getActiveSkillGroupIds } from "../skills/getActiveSkillGroupIds";
import { selectBestSkillGroupContribution } from "../skills/selectBestSkillGroupContribution";
import { STANDARD_CHARGEN_METHOD_POLICY } from "./policy";
import {
  buildChargenLanguageSelectionSummary,
  buildChargenSelectableSkillSummary,
  syncChargenLanguageSkillRows,
  syncChargenMotherTongueSkillRow,
  syncChargenSelectionSkillRows
} from "./selectionStructure";
import { getResolvedProfileStats } from "./statResolution";

const ORDINARY_SKILL_POINT_COST = 2;
const SECONDARY_SKILL_POINT_COST = 1;
const LEGACY_GROUP_POINT_COST = 4;
const NEW_SPECIALIZATION_COST = 4;
const EXISTING_SPECIALIZATION_COST = 2;
const LITERACY_SKILL_ID = "literacy";
const LANGUAGE_SKILL_ID = "language";

interface CanonicalContentShape {
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

export interface SpendPrimaryPointInput {
  content: CanonicalContentShape;
  professionId: string;
  progression: CharacterProgression;
  societyId?: string;
  societyLevel: number;
  targetLanguageName?: string;
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
  targetLanguageName?: string;
  targetId: string;
  targetType: "skill" | "specialization";
}

export interface AllocateChargenPointInput {
  content: CanonicalContentShape;
  professionId: string;
  profile?: RolledCharacterProfile;
  progression: CharacterProgression;
  societyId?: string;
  societyLevel: number;
  targetLanguageName?: string;
  targetId: string;
  targetType: "group" | "skill";
}

export interface SpendPointResult {
  error?: string;
  progression: CharacterProgression;
  spentCost?: number;
  warnings: string[];
}

export interface ChargenGroupView {
  gms: number;
  groupId: string;
  groupLevel: number;
  name: string;
  primaryRanks: number;
  secondaryRanks: number;
  totalRanks: number;
}

export interface ChargenSkillView {
  category: "ordinary" | "secondary";
  categoryId?: SkillDefinition["categoryId"];
  contributingGroupId?: string;
  relationshipGrantedPreviewLevel?: number;
  relationshipGrantedSkillLevel?: number;
  relationshipSourceSkillId?: string;
  relationshipSourceSkillName?: string;
  relationshipSourceType?: SkillRelationshipSourceType;
  // Canonical workbook-equivalent combat skill XP. This is the full skill XP
  // used by combat math, combining the best contributing group with direct
  // skill ranks, before any linked-stat average is added.
  effectiveSkillNumber: number;
  groupId: string;
  groupIds: string[];
  groupLevel: number;
  languageName?: string;
  linkedStatAverage: number;
  literacyWarning?: string;
  name: string;
  primaryRanks: number;
  requiresLiteracy: SkillDefinition["requiresLiteracy"];
  secondaryRanks: number;
  skillId: string;
  skillKey: string;
  sourceTag?: CharacterSkill["sourceTag"];
  specificSkillLevel: number;
  totalSkill: number;
}

export function getCombatSkillXp(skill: Pick<ChargenSkillView, "effectiveSkillNumber">): number {
  return skill.effectiveSkillNumber;
}

export function getChargenSkillContributionForGroup(input: {
  content: CanonicalContentShape;
  groupId: string;
  progression: CharacterProgression;
  skill: SkillDefinition;
}): number {
  const progression = recalculateProgression(structuredClone(input.progression));
  const activeGroupIds = new Set(
    getActiveSkillGroupIds({
      progression,
      skill: input.skill,
      skillGroups: input.content.skillGroups
    })
  );

  if (!activeGroupIds.has(input.groupId)) {
    return 0;
  }

  const group = progression.skillGroups.find((candidate) => candidate.groupId === input.groupId);

  if (!group || group.ranks <= 0) {
    return 0;
  }

  return calculateGroupLevel({
    gms: group.gms,
    ranks: group.ranks
  });
}

export interface ChargenSpecializationView {
  relationshipGrantedPreviewLevel?: number;
  relationshipGrantedSourceSkillId?: string;
  relationshipGrantedSourceSkillName?: string;
  relationshipGrantedSourceType?: "specialization-bridge-parent";
  relationshipGrantedSpecializationLevel?: number;
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

export type ChargenSkillAccessSource =
  | "profession-group"
  | "profession-skill"
  | "society-foundational-skill"
  | "society-skill";

export interface ChargenSkillAccessSummary {
  normalSkillGroupIds: string[];
  normalSkillIds: string[];
  otherSkillIds: string[];
  skillSources: Record<string, ChargenSkillAccessSource[]>;
}

export interface ReviewChargenDraftInput {
  civilizationId?: string;
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
    secondaryRanks: 0,
    ranks: 0
  };
}

function createEmptySkill(skill: SkillDefinition): CharacterSkill {
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

function createEmptySpecialization(specialization: SkillSpecialization): CharacterSpecialization {
  return {
    level: 0,
    ranks: 0,
    relationshipGrantedRanks: 0,
    secondaryRanks: 0,
    skillId: specialization.skillId,
    specializationId: specialization.id
  };
}

function normalizeGroup(group: CharacterSkillGroup): CharacterSkillGroup {
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

function normalizeSkill(skill: CharacterSkill): CharacterSkill {
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

function normalizeSpecialization(
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

function recalculateProgression(progression: CharacterProgression): CharacterProgression {
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
    skillGroups: progression.skillGroups.map(normalizeGroup),
    skills: progression.skills.map(normalizeSkill),
    specializations: progression.specializations
      .map(normalizeSpecialization)
      .filter((specialization) => specialization.skillId !== LANGUAGE_SKILL_ID)
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

function resolveProfessionPackageInternal(
  content: CanonicalContentShape,
  professionId: string
) {
  return resolveEffectiveProfessionPackage({
    content,
    subtypeId: professionId
  });
}

function getAllowedSkillGroupIdsInternal(
  content: CanonicalContentShape,
  professionId: string,
  societyId: string | undefined,
  societyLevel: number
): string[] {
  const society = getSocietyAccess(content, societyLevel, societyId);

  if (!society) {
    return [];
  }

  const professionPackage = resolveProfessionPackageInternal(content, professionId);
  const professionGroupIds = new Set([
    ...professionPackage.core.finalEffectiveGroupIds,
    ...professionPackage.favored.finalEffectiveGroupIds
  ]);

  return society.skillGroupIds.filter((groupId) => professionGroupIds.has(groupId));
}

function buildChargenSkillAccessSummaryInternal(input: {
  content: CanonicalContentShape;
  professionId: string;
  societyId?: string;
  societyLevel: number;
}): ChargenSkillAccessSummary {
  const normalSkillGroupIds = getAllowedSkillGroupIdsInternal(
    input.content,
    input.professionId,
    input.societyId,
    input.societyLevel
  );
  const normalGroupIdSet = new Set(normalSkillGroupIds);
  const professionPackage = resolveProfessionPackageInternal(input.content, input.professionId);
  const professionDirectSkillIds = new Set([
    ...professionPackage.core.finalEffectiveSkillIds,
    ...professionPackage.favored.finalEffectiveSkillIds
  ]);
  const societySkillIds =
    getSocietyAccess(input.content, input.societyLevel, input.societyId)?.skillIds ?? [];
  const foundationalSkillIds = getAccessibleFoundationalSkillIdsForSocietyBand(
    input.content.societyBandSkillAccess ?? [],
    {
      socialBand: input.societyLevel,
      societyId: input.societyId ?? ""
    }
  );
  const skillSources = new Map<string, Set<ChargenSkillAccessSource>>();

  for (const skill of input.content.skills) {
    if (!getSkillDefinitionGroupIds(skill).some((groupId) => normalGroupIdSet.has(groupId))) {
      continue;
    }

    const sources = skillSources.get(skill.id) ?? new Set<ChargenSkillAccessSource>();
    sources.add("profession-group");
    skillSources.set(skill.id, sources);
  }

  for (const skillId of societySkillIds) {
    const sources = skillSources.get(skillId) ?? new Set<ChargenSkillAccessSource>();
    sources.add("society-skill");
    skillSources.set(skillId, sources);
  }

  for (const skillId of foundationalSkillIds) {
    const sources = skillSources.get(skillId) ?? new Set<ChargenSkillAccessSource>();
    sources.add("society-foundational-skill");
    skillSources.set(skillId, sources);
  }

  for (const skillId of professionDirectSkillIds) {
    const sources = skillSources.get(skillId) ?? new Set<ChargenSkillAccessSource>();
    sources.add("profession-skill");
    skillSources.set(skillId, sources);
  }

  const normalSkillIds = input.content.skills
    .filter((skill) => skillSources.has(skill.id))
    .map((skill) => skill.id);
  const normalSkillIdSet = new Set(normalSkillIds);

  return {
    normalSkillGroupIds,
    normalSkillIds,
    otherSkillIds: input.content.skills
      .filter((skill) => !normalSkillIdSet.has(skill.id))
      .map((skill) => skill.id),
    skillSources: Object.fromEntries(
      [...skillSources.entries()].map(([skillId, sources]) => [skillId, [...sources.values()]])
    )
  };
}

function getAllowedPrimaryGroupIdsInternal(
  content: CanonicalContentShape,
  professionId: string,
  societyId: string | undefined,
  societyLevel: number
): string[] {
  return getAllowedSkillGroupIdsInternal(content, professionId, societyId, societyLevel);
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

function getSkillDefinitionGroupIds(skill: SkillDefinition): string[] {
  return getSkillGroupIds(skill);
}

function getSkillGroupDefinition(
  content: CanonicalContentShape,
  groupId: string
): SkillGroupDefinition | undefined {
  return content.skillGroups.find((group) => group.id === groupId);
}

function getPurchasedParentGroups(
  progression: CharacterProgression,
  skillDefinition: SkillDefinition
): CharacterSkillGroup[] {
  const groupIds = new Set(getSkillDefinitionGroupIds(skillDefinition));

  return progression.skillGroups.filter((group) => group.ranks > 0 && groupIds.has(group.groupId));
}

function getBestGroupIdByDefinitionOrder(
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

function getBestPurchasedParentGroup(
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

function getBestActiveGroupContribution(input: {
  content: CanonicalContentShape;
  groupViewById: Map<string, ChargenGroupView>;
  progression: CharacterProgression;
  skill: SkillDefinition;
}):
  | {
      groupId: string;
      groupLevel: number;
      name: string;
      sortOrder: number;
    }
  | undefined {
  return selectBestSkillGroupContribution(
    getActiveSkillGroupIds({
      progression: input.progression,
      skill: input.skill,
      skillGroups: input.content.skillGroups
    })
      .map((groupId) => {
        const groupView = input.groupViewById.get(groupId);
        const groupDefinition = getSkillGroupDefinition(input.content, groupId);

        if (!groupView) {
          return null;
        }

        return {
          groupId,
          groupLevel: groupView.groupLevel,
          name: groupView.name,
          sortOrder: groupDefinition?.sortOrder ?? Number.MAX_SAFE_INTEGER
        };
      })
      .filter(isDefined)
  );
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
  const resolvedStats = getResolvedProfileStats(profile);

  if (!resolvedStats) {
    return 0;
  }

  const values = skill.linkedStats.map((stat) => resolvedStats[stat as GlantriCharacteristicKey] ?? 0);
  const total = values.reduce((sum, value) => sum + value, 0);

  return Math.floor(total / values.length);
}

function getSkillSpendCost(skill: SkillDefinition): number {
  return skill.category === "secondary" ? SECONDARY_SKILL_POINT_COST : ORDINARY_SKILL_POINT_COST;
}

function getSelectedSkillIdsForGroupSlot(input: {
  groupId: string;
  progression: CharacterProgression;
  slotId: string;
}): string[] {
  return (
    input.progression.chargenSelections?.selectedGroupSlots.find(
      (selection) => selection.groupId === input.groupId && selection.slotId === input.slotId
    )?.selectedSkillIds ?? []
  );
}

function getActiveGroupSkillCost(input: {
  content: CanonicalContentShape;
  groupId: string;
  progression: CharacterProgression;
}): { cost?: number; error?: string } {
  const group = input.content.skillGroups.find((candidate) => candidate.id === input.groupId);

  if (!group) {
    return { error: "Skill group definition not found." };
  }

  const skillsById = new Map(input.content.skills.map((skill) => [skill.id, skill]));
  const fixedGroupSkillIds = (group.skillMemberships ?? []).map((membership) => membership.skillId);
  const hasSelectionSlots = (group.selectionSlots?.length ?? 0) > 0;
  const activeSkillIds = new Set(
    fixedGroupSkillIds.length > 0
      ? fixedGroupSkillIds
      : hasSelectionSlots
        ? []
      : input.content.skills
          .filter((skill) => getSkillGroupIds(skill).includes(input.groupId))
          .map((skill) => skill.id)
  );

  for (const slot of group.selectionSlots ?? []) {
    const candidateSkillIds = new Set(slot.candidateSkillIds);
    const selectedSkillIds = getSelectedSkillIdsForGroupSlot({
      groupId: input.groupId,
      progression: input.progression,
      slotId: slot.id
    }).filter((skillId) => candidateSkillIds.has(skillId));

    if (slot.required && selectedSkillIds.length < slot.chooseCount) {
      return { error: `${group.name}: ${slot.label}.` };
    }

    for (const skillId of selectedSkillIds.slice(0, slot.chooseCount)) {
      activeSkillIds.add(skillId);
    }
  }

  const totalIndividualCost = [...activeSkillIds].reduce((total, skillId) => {
    const skill = skillsById.get(skillId);

    return skill ? total + getSkillSpendCost(skill) : total;
  }, 0);

  if (totalIndividualCost <= 0) {
    return { error: "This skill group has no active skills to price." };
  }

  return {
    cost: Math.max(1, Math.floor(totalIndividualCost * 0.6))
  };
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

function getProgressionSkillRows(
  progression: CharacterProgression,
  skillId: string
): CharacterSkill[] {
  return progression.skills.filter((skill) => skill.skillId === skillId);
}

function getPreferredProgressionSkillRow(
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

function getTargetedProgressionSkillRow(input: {
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

function getEvaluationMessages(input: {
  advisories: { message: string }[];
  warnings: { message: string }[];
}): string[] {
  return [...input.warnings, ...input.advisories].map((item) => item.message);
}

export function getOrdinaryPoolTotal(): number {
  return STANDARD_CHARGEN_METHOD_POLICY.primaryPoolTotal;
}

export function getFlexiblePoolTotal(
  profile: RolledCharacterProfile | undefined
): number {
  const resolvedStats = getResolvedProfileStats(profile);

  if (!resolvedStats) {
    return 0;
  }

  return (resolvedStats.int ?? 0) + (resolvedStats.lck ?? 0);
}

function getAvailableFlexiblePoolTotal(input: {
  profile: RolledCharacterProfile | undefined;
  progression: CharacterProgression;
}): number {
  const profileDrivenTotal = getFlexiblePoolTotal(input.profile);
  return profileDrivenTotal > 0 ? profileDrivenTotal : input.progression.secondaryPoolTotal;
}

export function createChargenProgression(mode: ChargenMode = "standard"): CharacterProgression {
  return recalculateProgression({
    chargenMode: mode,
    educationPoints: 0,
    level: 1,
    primaryPoolSpent: 0,
    primaryPoolTotal: STANDARD_CHARGEN_METHOD_POLICY.primaryPoolTotal,
    secondaryPoolSpent: 0,
    secondaryPoolTotal: STANDARD_CHARGEN_METHOD_POLICY.secondaryPoolTotal,
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
  return createChargenProgression(input.mode ?? "standard");
}

function chooseChargenPool(input: {
  cost: number;
  normalAccess: boolean;
  profile?: RolledCharacterProfile;
  progression: CharacterProgression;
}): "primary" | "secondary" | null {
  const ordinaryRemaining = getOrdinaryPoolTotal() - input.progression.primaryPoolSpent;
  const flexibleRemaining = getFlexiblePoolTotal(input.profile) - input.progression.secondaryPoolSpent;

  if (input.normalAccess && ordinaryRemaining >= input.cost) {
    return "primary";
  }

  if (flexibleRemaining >= input.cost) {
    return "secondary";
  }

  return null;
}

export function allocateChargenPoint(input: AllocateChargenPointInput): SpendPointResult {
  const progression = recalculateProgression(structuredClone(input.progression));
  const warnings: string[] = [];
  const access = buildChargenSkillAccessSummaryInternal({
    content: input.content,
    professionId: input.professionId,
    societyId: input.societyId,
    societyLevel: input.societyLevel
  });

  if (input.targetType === "group") {
    const normalAccess = access.normalSkillGroupIds.includes(input.targetId);

    if (!normalAccess) {
      return {
        error: "This skill group is not part of the selected profession and society access.",
        progression,
        warnings
      };
    }

    const groupCost = getActiveGroupSkillCost({
      content: input.content,
      groupId: input.targetId,
      progression
    });

    if (groupCost.error || groupCost.cost === undefined) {
      return {
        error: groupCost.error ?? "Skill group cost could not be calculated.",
        progression,
        warnings
      };
    }

    const cost = groupCost.cost;
    const pool = chooseChargenPool({
      cost,
      normalAccess,
      profile: input.profile,
      progression
    });

    if (!pool) {
      return {
        error: `Not enough ordinary or flexible points remain for this skill group. Cost: ${cost}.`,
        progression,
        warnings
      };
    }

    const group = ensureGroupExists(progression, input.targetId);

    if (pool === "primary") {
      group.primaryRanks += 1;
      progression.primaryPoolSpent += cost;
    } else {
      group.secondaryRanks += 1;
      progression.secondaryPoolSpent += cost;
    }

    group.ranks = group.grantedRanks + group.primaryRanks + group.secondaryRanks;

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

  const normalAccess = access.normalSkillIds.includes(skillDefinition.id);
  const dependencyEvaluation = evaluateSkillSelection({
    content: input.content,
    progression,
    target: {
      skill: skillDefinition,
      targetType: "skill"
    }
  });

  warnings.push(...getEvaluationMessages(dependencyEvaluation));

  if (!dependencyEvaluation.isAllowed) {
    return {
      error: dependencyEvaluation.blockingReasons[0]?.message ?? "Skill purchase is blocked.",
      progression,
      warnings
    };
  }

  const skill = ensureSkillExists(progression, skillDefinition, {
    languageName: input.targetLanguageName
  });
  const cost = getSkillSpendCost(skillDefinition);
  const pool = chooseChargenPool({
    cost,
    normalAccess,
    profile: input.profile,
    progression
  });

  if (!pool) {
    return {
      error: normalAccess
        ? `No ordinary or flexible points remain for this skill. Cost: ${cost}.`
        : "No flexible points remain for this other skill.",
      progression,
      warnings
    };
  }

  if (pool === "primary") {
    skill.primaryRanks += 1;
    progression.primaryPoolSpent += cost;
  } else {
    skill.secondaryRanks += 1;
    progression.secondaryPoolSpent += cost;
  }

  skill.ranks = skill.grantedRanks + skill.primaryRanks + skill.secondaryRanks;

  return {
    progression: recalculateProgression(progression),
    spentCost: cost,
    warnings
  };
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

    const groupCost = getActiveGroupSkillCost({
      content: input.content,
      groupId: input.targetId,
      progression
    });

    if (groupCost.error || groupCost.cost === undefined) {
      return {
        error: groupCost.error ?? "Skill group cost could not be calculated.",
        progression,
        warnings
      };
    }

    const group = ensureGroupExists(progression, input.targetId);
    const cost = groupCost.cost;

    if (progression.primaryPoolSpent + cost > progression.primaryPoolTotal) {
      return {
        error: "Not enough primary points remaining for that group purchase.",
        progression,
        warnings
      };
    }

    group.primaryRanks += 1;
    group.ranks = group.grantedRanks + group.primaryRanks + group.secondaryRanks;
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

  const allowedParentGroupIds = getSkillDefinitionGroupIds(skillDefinition).filter((groupId) =>
    allowedGroupIds.includes(groupId)
  );

  if (allowedParentGroupIds.length === 0) {
    return {
      error: "That skill is not available for the selected profession and society.",
      progression,
      warnings
    };
  }

  const dependencyEvaluation = evaluateSkillSelection({
    content: input.content,
    progression,
    target: {
      skill: skillDefinition,
      targetType: "skill"
    }
  });

  warnings.push(...getEvaluationMessages(dependencyEvaluation));

  if (!dependencyEvaluation.isAllowed) {
    return {
      error: dependencyEvaluation.blockingReasons[0]?.message ?? "Skill purchase is blocked.",
      progression,
      warnings
    };
  }

  const skill = ensureSkillExists(progression, skillDefinition, {
    languageName: input.targetLanguageName
  });
  const cost = getSkillSpendCost(skillDefinition);

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

function cleanupProgression(progression: CharacterProgression): CharacterProgression {
  progression.specializations = progression.specializations.filter(
    (specialization) => specialization.ranks > 0
  );
  progression.skills = progression.skills.filter((skill) => skill.ranks > 0);
  progression.skillGroups = progression.skillGroups.filter((group) => group.gms > 0 || group.ranks > 0);

  return recalculateProgression(progression);
}

function getGroupName(content: CanonicalContentShape, groupId: string): string {
  return content.skillGroups.find((group) => group.id === groupId)?.name ?? groupId;
}

function hasRemainingParentGroupAfterRemoval(input: {
  progression: CharacterProgression;
  removedGroupId: string;
  skillDefinition: SkillDefinition;
}): boolean {
  const remainingGroupIds = new Set(
    getSkillDefinitionGroupIds(input.skillDefinition).filter((groupId) => groupId !== input.removedGroupId)
  );

  return input.progression.skillGroups.some(
    (group) => group.ranks > 0 && remainingGroupIds.has(group.groupId)
  );
}

function getPrimaryGroupRemovalError(input: {
  content: CanonicalContentShape;
  groupId: string;
  progression: CharacterProgression;
}): string | undefined {
  const group = input.progression.skillGroups.find((item) => item.groupId === input.groupId);

  if (!group || group.primaryRanks < 1) {
    return "No primary-point group purchase to remove.";
  }

  const ranksAfterRemoval = group.grantedRanks + group.primaryRanks - 1;

  if (ranksAfterRemoval > 0) {
    return undefined;
  }

  const groupSkillIds = new Set(
    input.content.skills
      .filter((skill) => getSkillDefinitionGroupIds(skill).includes(input.groupId))
      .map((skill) => skill.id)
  );
  const hasDependentSpecializations = input.progression.specializations.some(
    (specialization) => {
      if (specialization.secondaryRanks < 1 || !groupSkillIds.has(specialization.skillId)) {
        return false;
      }

      const definition = getSkillById(input.content, specialization.skillId);

      if (!definition) {
        return false;
      }

      return !hasRemainingParentGroupAfterRemoval({
        progression: input.progression,
        removedGroupId: input.groupId,
        skillDefinition: definition
      });
    }
  );

  if (hasDependentSpecializations) {
    return `Remove specializations tied to the ${getGroupName(input.content, input.groupId)} group first.`;
  }

  return undefined;
}

function getPrimarySkillRemovalError(input: {
  content: CanonicalContentShape;
  progression: CharacterProgression;
  skillDefinition: SkillDefinition;
  targetLanguageName?: string;
}): string | undefined {
  const skill = getTargetedProgressionSkillRow({
    progression: input.progression,
    skillId: input.skillDefinition.id,
    targetLanguageName: input.targetLanguageName
  });

  if (!skill || skill.primaryRanks < 1) {
    return "No primary-point skill purchase to remove.";
  }

  const ranksAfterRemoval =
    skill.grantedRanks + skill.primaryRanks + skill.secondaryRanks - 1;

  if (ranksAfterRemoval > 0) {
    return undefined;
  }

  const dependentSpecializationNames = input.progression.specializations
    .filter(
      (specialization) =>
        specialization.skillId === input.skillDefinition.id && specialization.secondaryRanks > 0
    )
    .map(
      (specialization) =>
        getSpecializationById(input.content, specialization.specializationId)?.name ??
        specialization.specializationId
    );

  if (dependentSpecializationNames.length > 0) {
    return `Remove ${dependentSpecializationNames.join(", ")} before lowering ${input.skillDefinition.name}.`;
  }

  if (input.skillDefinition.id !== LITERACY_SKILL_ID) {
    return undefined;
  }

  const requiredLiteracySkills = input.progression.skills
    .filter((candidate) => candidate.skillId !== LITERACY_SKILL_ID && candidate.ranks > 0)
    .map((candidate) => getSkillById(input.content, candidate.skillId))
    .filter(
      (definition): definition is SkillDefinition =>
        Boolean(definition && definition.requiresLiteracy === "required")
    )
    .map((definition) => definition.name);

  if (requiredLiteracySkills.length > 0) {
    return `Remove skills that require Literacy before lowering Literacy: ${requiredLiteracySkills.join(", ")}.`;
  }

  return undefined;
}

function getChargenGroupRemovalError(input: {
  content: CanonicalContentShape;
  groupId: string;
  access: ChargenSkillAccessSummary;
  progression: CharacterProgression;
}): string | undefined {
  const group = input.progression.skillGroups.find((item) => item.groupId === input.groupId);

  if (!group || group.primaryRanks < 1) {
    return "No allocated skill-group points to remove.";
  }

  const ranksAfterRemoval = group.ranks - 1;

  if (ranksAfterRemoval > 0) {
    return undefined;
  }

  const groupSkillIds = new Set(
    input.content.skills
      .filter((skill) => getSkillDefinitionGroupIds(skill).includes(input.groupId))
      .map((skill) => skill.id)
  );
  const hasDependentSpecializations = input.progression.specializations.some(
    (specialization) => {
      if (specialization.secondaryRanks < 1 || !groupSkillIds.has(specialization.skillId)) {
        return false;
      }

      const definition = getSkillById(input.content, specialization.skillId);

      if (!definition) {
        return false;
      }

      return !hasRemainingParentGroupAfterRemoval({
        progression: input.progression,
        removedGroupId: input.groupId,
        skillDefinition: definition
      });
    }
  );

  if (hasDependentSpecializations) {
    return `Remove specializations tied to the ${getGroupName(input.content, input.groupId)} skill group first.`;
  }

  return undefined;
}

function getChargenSkillRemovalError(input: {
  content: CanonicalContentShape;
  progression: CharacterProgression;
  skillDefinition: SkillDefinition;
  targetLanguageName?: string;
}): string | undefined {
  const skill = getTargetedProgressionSkillRow({
    progression: input.progression,
    skillId: input.skillDefinition.id,
    targetLanguageName: input.targetLanguageName
  });

  if (!skill || skill.primaryRanks + skill.secondaryRanks < 1) {
    return "No allocated skill points to remove.";
  }

  const ranksAfterRemoval = skill.ranks - 1;

  if (ranksAfterRemoval > 0) {
    return undefined;
  }

  const dependentSpecializationNames = input.progression.specializations
    .filter(
      (specialization) =>
        specialization.skillId === input.skillDefinition.id && specialization.secondaryRanks > 0
    )
    .map(
      (specialization) =>
        getSpecializationById(input.content, specialization.specializationId)?.name ??
        specialization.specializationId
    );

  if (dependentSpecializationNames.length > 0) {
    return `Remove ${dependentSpecializationNames.join(", ")} before lowering ${input.skillDefinition.name}.`;
  }

  if (input.skillDefinition.id !== LITERACY_SKILL_ID) {
    return undefined;
  }

  const requiredLiteracySkills = input.progression.skills
    .filter((candidate) => candidate.skillId !== LITERACY_SKILL_ID && candidate.ranks > 0)
    .map((candidate) => getSkillById(input.content, candidate.skillId))
    .filter(
      (definition): definition is SkillDefinition =>
        Boolean(definition && definition.requiresLiteracy === "required")
    )
    .map((definition) => definition.name);

  if (requiredLiteracySkills.length > 0) {
    return `Remove skills that require Literacy before lowering Literacy: ${requiredLiteracySkills.join(", ")}.`;
  }

  return undefined;
}

export function removePrimaryPoint(input: SpendPrimaryPointInput): SpendPointResult {
  const progression = recalculateProgression(structuredClone(input.progression));
  const warnings: string[] = [];

  if (input.targetType === "group") {
    const group = progression.skillGroups.find((item) => item.groupId === input.targetId);
    const error = getPrimaryGroupRemovalError({
      content: input.content,
      groupId: input.targetId,
      progression
    });

    if (!group || error) {
      return {
        error,
        progression,
        warnings
      };
    }

    group.primaryRanks -= 1;
    group.ranks = group.grantedRanks + group.primaryRanks + group.secondaryRanks;
    const groupCost = getActiveGroupSkillCost({
      content: input.content,
      groupId: input.targetId,
      progression
    });
    const refundedCost = groupCost.cost;

    if (refundedCost === undefined) {
      return {
        error: groupCost.error ?? "Skill group refund could not be calculated.",
        progression,
        warnings
      };
    }

    progression.primaryPoolSpent = Math.max(0, progression.primaryPoolSpent - refundedCost);

    return {
      progression: cleanupProgression(progression),
      spentCost: refundedCost,
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

  const skill = getTargetedProgressionSkillRow({
    progression,
    skillId: input.targetId,
    targetLanguageName: input.targetLanguageName
  });
  const error = getPrimarySkillRemovalError({
    content: input.content,
    progression,
    skillDefinition,
    targetLanguageName: input.targetLanguageName
  });

  if (!skill || error) {
    return {
      error,
      progression,
      warnings
    };
  }

  skill.primaryRanks -= 1;
  skill.ranks = skill.grantedRanks + skill.primaryRanks + skill.secondaryRanks;
  const refundedCost = getSkillSpendCost(skillDefinition);
  progression.primaryPoolSpent = Math.max(0, progression.primaryPoolSpent - refundedCost);

  return {
    progression: cleanupProgression(progression),
    spentCost: refundedCost,
    warnings
  };
}

export function removeChargenPoint(
  input: AllocateChargenPointInput
): SpendPointResult {
  const progression = recalculateProgression(structuredClone(input.progression));
  const warnings: string[] = [];

  if (input.targetType === "group") {
    const group = progression.skillGroups.find((item) => item.groupId === input.targetId);
    const access = buildChargenSkillAccessSummaryInternal({
      content: input.content,
      professionId: input.professionId,
      societyId: input.societyId,
      societyLevel: input.societyLevel
    });
    const error = getChargenGroupRemovalError({
      access,
      content: input.content,
      groupId: input.targetId,
      progression
    });

    if (!group || error) {
      return {
        error,
        progression,
        warnings
      };
    }

    const groupCost = getActiveGroupSkillCost({
      content: input.content,
      groupId: input.targetId,
      progression
    });
    const refundCost = groupCost.cost;

    if (refundCost === undefined) {
      return {
        error: groupCost.error ?? "Skill group refund could not be calculated.",
        progression,
        warnings
      };
    }

    if (group.secondaryRanks > 0) {
      group.secondaryRanks -= 1;
      progression.secondaryPoolSpent = Math.max(0, progression.secondaryPoolSpent - refundCost);
    } else {
      group.primaryRanks -= 1;
      progression.primaryPoolSpent = Math.max(0, progression.primaryPoolSpent - refundCost);
    }

    group.ranks = group.grantedRanks + group.primaryRanks + group.secondaryRanks;

    return {
      progression: cleanupProgression(progression),
      spentCost: refundCost,
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

  const skill = getTargetedProgressionSkillRow({
    progression,
    skillId: input.targetId,
    targetLanguageName: input.targetLanguageName
  });
  const error = getChargenSkillRemovalError({
    content: input.content,
    progression,
    skillDefinition,
    targetLanguageName: input.targetLanguageName
  });

  if (!skill || error) {
    return {
      error,
      progression,
      warnings
    };
  }

  const usedSecondaryPool = skill.secondaryRanks > 0;

  if (usedSecondaryPool) {
    skill.secondaryRanks -= 1;
  } else {
    skill.primaryRanks -= 1;
  }

  skill.ranks = skill.grantedRanks + skill.primaryRanks + skill.secondaryRanks;
  const refundedCost = getSkillSpendCost(skillDefinition);

  if (usedSecondaryPool) {
    progression.secondaryPoolSpent = Math.max(0, progression.secondaryPoolSpent - refundedCost);
  } else {
    progression.primaryPoolSpent = Math.max(0, progression.primaryPoolSpent - refundedCost);
  }

  return {
    progression: cleanupProgression(progression),
    spentCost: refundedCost,
    warnings
  };
}

export function removeSecondaryPoint(input: SpendSecondaryPointInput): SpendPointResult {
  const progression = recalculateProgression(structuredClone(input.progression));
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

    const skill = getTargetedProgressionSkillRow({
      progression,
      skillId: input.targetId,
      targetLanguageName: input.targetLanguageName
    });

    if (!skill || skill.secondaryRanks < 1) {
      return {
        error: "No flexible-point skill purchase to remove.",
        progression,
        warnings
      };
    }

    const error = getChargenSkillRemovalError({
      content: input.content,
      progression,
      skillDefinition,
      targetLanguageName: input.targetLanguageName
    });

    if (error) {
      return {
        error,
        progression,
        warnings
      };
    }

    skill.secondaryRanks -= 1;
    skill.ranks = skill.grantedRanks + skill.primaryRanks + skill.secondaryRanks;
    const refundedCost = getSkillSpendCost(skillDefinition);
    progression.secondaryPoolSpent = Math.max(0, progression.secondaryPoolSpent - refundedCost);

    return {
      progression: cleanupProgression(progression),
      spentCost: refundedCost,
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

  const specialization = progression.specializations.find(
    (item) => item.specializationId === specializationDefinition.id
  );

  if (!specialization || specialization.secondaryRanks < 1) {
    return {
      error: "No specialization purchase to remove.",
      progression,
      warnings
    };
  }

  specialization.secondaryRanks -= 1;
  specialization.ranks = specialization.secondaryRanks;
  const refundedCost = getSpecializationSpendCost(specialization.secondaryRanks > 0);
  progression.secondaryPoolSpent = Math.max(0, progression.secondaryPoolSpent - refundedCost);

  return {
    progression: cleanupProgression(progression),
    spentCost: refundedCost,
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

    const allowedParentGroupIds = getSkillDefinitionGroupIds(skillDefinition).filter((groupId) =>
      allowedGroupIds.includes(groupId)
    );

    if (allowedParentGroupIds.length === 0) {
      return {
        error: "That skill is not exactly one society level above the current character.",
        progression,
        warnings
      };
    }

    const dependencyEvaluation = evaluateSkillSelection({
      content: input.content,
      progression,
      target: {
        skill: skillDefinition,
        targetType: "skill"
      }
    });

    warnings.push(...getEvaluationMessages(dependencyEvaluation));

    if (!dependencyEvaluation.isAllowed) {
      return {
        error: dependencyEvaluation.blockingReasons[0]?.message ?? "Skill purchase is blocked.",
        progression,
        warnings
      };
    }

    const skill = ensureSkillExists(progression, skillDefinition, {
      languageName: input.targetLanguageName
    });
    const cost = getSkillSpendCost(skillDefinition);

    if (
      progression.secondaryPoolSpent + cost >
      getAvailableFlexiblePoolTotal({
        profile: input.profile,
        progression
      })
    ) {
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

  const specializationEvaluation = evaluateSkillSelection({
    content: input.content,
    progression,
    target: {
      specialization: specializationDefinition,
      targetType: "specialization"
    }
  });

  warnings.push(...getEvaluationMessages(specializationEvaluation));

  if (!specializationEvaluation.isAllowed) {
    return {
      error:
        specializationEvaluation.blockingReasons[0]?.message ??
        "Specialization purchase is blocked.",
      progression,
      warnings
    };
  }

  const parentSkillDefinition = getSkillById(input.content, specializationDefinition.skillId);

  if (!parentSkillDefinition) {
    return {
      error: "Specialization definition not found.",
      progression,
      warnings
    };
  }

  if (!specializationDefinition.specializationBridge) {
    const allowedParentGroupIds = getSkillDefinitionGroupIds(parentSkillDefinition).filter((groupId) =>
      allowedGroupIds.includes(groupId)
    );

    if (allowedParentGroupIds.length === 0) {
      return {
        error:
          "This specialization is outside the current society/profession access for its parent skill.",
        progression,
        warnings
      };
    }

    const parentGroup = getBestPurchasedParentGroup(input.content, progression, parentSkillDefinition);

    if (!parentGroup) {
      return {
        error: "Acquire the parent group before purchasing a specialization.",
        progression,
        warnings
      };
    }
  }

  const specialization = ensureSpecializationExists(progression, specializationDefinition);
  const cost = getSpecializationSpendCost(specialization.secondaryRanks > 0);

  if (
    progression.secondaryPoolSpent + cost >
    getAvailableFlexiblePoolTotal({
      profile: input.profile,
      progression
    })
  ) {
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
  civilizationId?: string;
  content: CanonicalContentShape;
  professionId?: string;
  profile?: RolledCharacterProfile;
  progression: CharacterProgression;
  societyId?: string;
  societyLevel?: number;
}): ChargenDraftView {
  const selectionSyncedProgression = recalculateProgression(
    syncChargenSelectionSkillRows({
      content: input.content,
      progression: recalculateProgression(input.progression)
    })
  );
  const languageSyncedProgression = recalculateProgression(
    syncChargenLanguageSkillRows({
      civilizationId: input.civilizationId,
      content: input.content,
      progression: selectionSyncedProgression,
      societyId: input.societyId
    })
  );
  const education = buildEducationBreakdown({
    content: input.content,
    professionId: input.professionId,
    profile: input.profile,
    progression: languageSyncedProgression,
    societyId: input.societyId,
    societyLevel: input.societyLevel
  });
  const progression = recalculateProgression(
    syncChargenMotherTongueSkillRow({
      civilizationId: input.civilizationId,
      content: input.content,
      educationLevel: education.theoreticalSkillCount,
      progression: languageSyncedProgression
    })
  );

  const groups = progression.skillGroups
    .map((group) => {
      const definition = input.content.skillGroups.find((item) => item.id === group.groupId);

      return {
        gms: group.gms,
        groupId: group.groupId,
        groupLevel: calculateGroupLevel({
          gms: group.gms,
          ranks: group.ranks
        }),
        name: definition?.name ?? group.groupId,
        primaryRanks: group.primaryRanks,
        secondaryRanks: group.secondaryRanks,
        totalRanks: group.ranks
      };
    })
    .sort((left, right) => left.name.localeCompare(right.name));
  const groupViewById = new Map(groups.map((group) => [group.groupId, group]));
  const relationshipGrants = resolveRelationshipMinimumGrants({
    content: input.content,
    progression
  });

  const skills = input.content.skills
    .flatMap((definition) => {
      if (definition.specializationOfSkillId) {
        return [];
      }

      const progressionSkillRows = getProgressionSkillRows(progression, definition.id);
      const groupIds = getSkillDefinitionGroupIds(definition);
      const bestContributingGroup = getBestActiveGroupContribution({
        content: input.content,
        groupViewById,
        progression,
        skill: definition
      });
      const fallbackGroupId = getBestGroupIdByDefinitionOrder(input.content, groupIds);
      const resolvedGroupId = bestContributingGroup?.groupId ?? fallbackGroupId;
      const groupContribution = bestContributingGroup?.groupLevel ?? 0;
      const relationshipGrant = relationshipGrants.bySkillId.get(definition.id);
      const relationshipGrantedLevel = relationshipGrant?.relationshipGrantedRanks ?? 0;
      const skillRows =
        progressionSkillRows.length > 0
          ? progressionSkillRows
          : groupContribution > 0 || relationshipGrantedLevel > 0
            ? [undefined]
            : [];

      if (!resolvedGroupId) {
        return [];
      }

      return skillRows.map((skill) => {
        const specificSkillLevel =
          (skill?.grantedRanks ?? 0) + (skill?.primaryRanks ?? 0) + (skill?.secondaryRanks ?? 0);
        const rowRelationshipGrantedLevel = skill?.languageName ? 0 : relationshipGrantedLevel;
        const relationshipGrantedPreviewLevel = skill?.languageName
          ? 0
          : relationshipGrant?.previewAdditionalRanks ?? 0;
        const shouldSurfaceRelationshipSource =
          rowRelationshipGrantedLevel > 0 || relationshipGrantedPreviewLevel > 0;
        const effectiveSkillNumber =
          groupContribution + specificSkillLevel + rowRelationshipGrantedLevel;
        const linkedStatAverage = getLinkedStatAverage(input.profile, definition);
        const literacyWarning =
          definition.requiresLiteracy === "recommended" && !hasLiteracy(progression)
            ? "Literacy recommended"
            : undefined;

        const view: ChargenSkillView = {
          category: skill?.category ?? definition.category,
          categoryId: skill?.categoryId ?? definition.categoryId,
          contributingGroupId: bestContributingGroup?.groupId,
          relationshipGrantedPreviewLevel,
          relationshipGrantedSkillLevel: rowRelationshipGrantedLevel,
          relationshipSourceSkillId: skill?.languageName
            ? undefined
            : shouldSurfaceRelationshipSource
              ? (relationshipGrant?.sourceSkillId ??
                skill?.relationshipGrantSourceSkillId)
              : undefined,
          relationshipSourceSkillName: skill?.languageName
            ? undefined
            : shouldSurfaceRelationshipSource
              ? (relationshipGrant?.sourceSkillName ??
                skill?.relationshipGrantSourceName)
              : undefined,
          relationshipSourceType: skill?.languageName
            ? undefined
            : shouldSurfaceRelationshipSource
              ? (relationshipGrant?.sourceType ??
                skill?.relationshipGrantSourceType)
              : undefined,
          effectiveSkillNumber,
          groupId: resolvedGroupId,
          groupIds,
          groupLevel: groupContribution,
          languageName: skill?.languageName,
          linkedStatAverage,
          literacyWarning,
          name: definition.name,
          primaryRanks: skill?.primaryRanks ?? 0,
          requiresLiteracy: definition.requiresLiteracy,
          secondaryRanks: skill?.secondaryRanks ?? 0,
          skillId: definition.id,
          skillKey: getCharacterSkillKey({
            languageName: skill?.languageName,
            skillId: definition.id
          }),
          sourceTag: skill?.sourceTag,
          specificSkillLevel,
          totalSkill: effectiveSkillNumber + linkedStatAverage
        };

        return view;
      });
    })
    .sort(
      (left, right) =>
        left.name.localeCompare(right.name) ||
        (left.languageName ?? "").localeCompare(right.languageName ?? "")
    );

  const specializations = progression.specializations
    .map((specialization) => specialization.specializationId)
    .concat(
      input.content.specializations
        .filter(
          (definition) =>
            (relationshipGrants.bySpecializationId.get(definition.id)?.relationshipGrantedRanks ??
              0) > 0
        )
        .map((definition) => definition.id)
    )
    .filter((specializationId, index, specializationIds) => specializationIds.indexOf(specializationId) === index)
    .map((specializationId) => {
      const progressionSpecialization = progression.specializations.find(
        (specialization) => specialization.specializationId === specializationId
      );
      const definition = getSpecializationById(input.content, specializationId);
      const parentSkillDefinition = definition
        ? getSkillById(input.content, definition.skillId)
        : undefined;
      const groupView = parentSkillDefinition
        ? selectBestSkillGroupContribution(
            getActiveSkillGroupIds({
              progression,
              skill: parentSkillDefinition,
              skillGroups: input.content.skillGroups
            })
              .map((groupId) => {
                const groupView = groupViewById.get(groupId);
                const groupDefinition = getSkillGroupDefinition(input.content, groupId);

                if (!groupView) {
                  return null;
                }

                return {
                  groupId,
                  groupLevel: groupView.groupLevel,
                  name: groupView.name,
                  sortOrder: groupDefinition?.sortOrder ?? Number.MAX_SAFE_INTEGER
                };
              })
              .filter(isDefined)
          )
        : undefined;

      if (!definition || !parentSkillDefinition) {
        return null;
      }

      const relationshipGrant = relationshipGrants.bySpecializationId.get(definition.id);
      const relationshipGrantedSpecializationLevel =
        relationshipGrant?.relationshipGrantedRanks ?? 0;
      const relationshipGrantedPreviewLevel = relationshipGrant?.previewAdditionalRanks ?? 0;
      const shouldSurfaceRelationshipSource =
        relationshipGrantedSpecializationLevel > 0 || relationshipGrantedPreviewLevel > 0;
      const persistedRelationshipSourceType =
        progressionSpecialization?.relationshipGrantSourceType === "specialization-bridge-parent"
          ? progressionSpecialization.relationshipGrantSourceType
          : undefined;
      const specializationLevel =
        (progressionSpecialization?.secondaryRanks ?? 0) +
        relationshipGrantedSpecializationLevel;

      const view: ChargenSpecializationView = {
        effectiveSpecializationNumber: calculateSpecializationLevel({
          groupLevel: groupView?.groupLevel ?? 0,
          specializationLevel
        }),
        relationshipGrantedPreviewLevel,
        relationshipGrantedSourceSkillId:
          shouldSurfaceRelationshipSource
            ? (relationshipGrant?.sourceSkillId ??
              progressionSpecialization?.relationshipGrantSourceSkillId)
            : undefined,
        relationshipGrantedSourceSkillName:
          shouldSurfaceRelationshipSource
            ? (relationshipGrant?.sourceSkillName ??
              progressionSpecialization?.relationshipGrantSourceName)
            : undefined,
        relationshipGrantedSourceType:
          shouldSurfaceRelationshipSource
            ? relationshipGrant?.sourceType ?? persistedRelationshipSourceType
            : undefined,
        relationshipGrantedSpecializationLevel,
        name: definition.name,
        parentSkillName: parentSkillDefinition.name,
        secondaryRanks: progressionSpecialization?.secondaryRanks ?? 0,
        specializationId: definition.id,
        specializationLevel
      };

      return view;
    })
    .filter(isDefined)
    .sort((left, right) => left.name.localeCompare(right.name));

  return {
    education,
    groups,
    primaryPoolAvailable: Math.max(0, getOrdinaryPoolTotal() - progression.primaryPoolSpent),
    secondaryPoolAvailable: Math.max(
      0,
      getFlexiblePoolTotal(input.profile) - progression.secondaryPoolSpent
    ),
    skills,
    specializations,
    totalSkillPointsInvested: progression.primaryPoolSpent + progression.secondaryPoolSpent
  };
}

export function reviewChargenDraft(
  input: ReviewChargenDraftInput
): ReviewChargenDraftResult {
  const normalizedProgression = recalculateProgression(input.progression);
  const languageSyncedProgression = recalculateProgression(
    syncChargenLanguageSkillRows({
      civilizationId: input.civilizationId,
      content: input.content,
      progression: normalizedProgression,
      societyId: input.societyId
    })
  );
  const education = buildEducationBreakdown({
    content: input.content,
    professionId: input.professionId,
    profile: input.profile,
    progression: languageSyncedProgression,
    societyId: input.societyId,
    societyLevel: input.societyLevel
  });
  const progression = recalculateProgression(
    syncChargenMotherTongueSkillRow({
      civilizationId: input.civilizationId,
      content: input.content,
      educationLevel: education.theoreticalSkillCount,
      progression: languageSyncedProgression
    })
  );
  const access =
    input.professionId && input.societyLevel !== undefined
      ? buildChargenSkillAccessSummaryInternal({
          content: input.content,
          professionId: input.professionId,
          societyId: input.societyId,
          societyLevel: input.societyLevel
        })
      : {
          normalSkillGroupIds: [],
          normalSkillIds: [],
          otherSkillIds: input.content.skills.map((skill) => skill.id),
          skillSources: {}
        };
  const draftView = buildChargenDraftView({
    civilizationId: input.civilizationId,
    content: input.content,
    professionId: input.professionId,
    profile: input.profile,
    progression,
    societyId: input.societyId,
    societyLevel: input.societyLevel
  });

  const errorSet = new Set<string>();
  const warningSet = new Set<string>();

  if (!input.profile) {
    errorSet.add("Select a rolled profile before finalizing.");
  }

  if (input.societyLevel === undefined) {
    errorSet.add("Select a society before finalizing.");
  }

  if (!input.professionId) {
    errorSet.add("Select a profession before finalizing.");
  }

  if (progression.primaryPoolSpent > getOrdinaryPoolTotal()) {
    errorSet.add("Ordinary pool is overspent.");
  }

  if (progression.secondaryPoolSpent > getFlexiblePoolTotal(input.profile)) {
    errorSet.add("Flexible pool is overspent.");
  }

  for (const group of progression.skillGroups) {
    if (group.primaryRanks > 0 && !access.normalSkillGroupIds.includes(group.groupId)) {
      errorSet.add(`Ordinary spending on ${group.groupId} is not allowed for this profession and society.`);
    }
  }

  for (const skill of progression.skills) {
    const definition = getSkillById(input.content, skill.skillId);

    if (!definition) {
      errorSet.add(`Missing skill definition for ${skill.skillId}.`);
      continue;
    }

    if (skill.primaryRanks > 0 && !access.normalSkillIds.includes(definition.id)) {
      errorSet.add(`${definition.name} is not valid for ordinary-pool spending in this build.`);
    }

    const dependencyEvaluation = evaluateSkillSelection({
      content: input.content,
      progression,
      target: {
        skill: definition,
        targetType: "skill"
      }
    });

    for (const reason of dependencyEvaluation.blockingReasons) {
      errorSet.add(reason.message);
    }

    for (const message of getEvaluationMessages(dependencyEvaluation)) {
      warningSet.add(message);
    }
  }

  for (const specialization of progression.specializations) {
    const definition = getSpecializationById(input.content, specialization.specializationId);

    if (!definition) {
      errorSet.add(`Missing specialization definition for ${specialization.specializationId}.`);
      continue;
    }

    const specializationEvaluation = evaluateSkillSelection({
      content: input.content,
      progression,
      target: {
        specialization: definition,
        targetType: "specialization"
      }
    });

    for (const reason of specializationEvaluation.blockingReasons) {
      errorSet.add(reason.message);
    }

    for (const message of getEvaluationMessages(specializationEvaluation)) {
      warningSet.add(message);
    }
  }

  const selectableSkillSummary = buildChargenSelectableSkillSummary({
    content: input.content,
    professionId: input.professionId,
    progression,
    societyId: input.societyId,
    societyLevel: input.societyLevel
  });

  const ownedGroupIds = new Set(
    progression.skillGroups
      .filter((group) => (group.ranks ?? 0) > 0 || (group.grantedRanks ?? 0) > 0)
      .map((group) => group.groupId)
  );

  for (const slot of selectableSkillSummary.selectionSlots) {
    if (!ownedGroupIds.has(slot.groupId)) {
      continue;
    }

    if (slot.required && !slot.isSatisfied) {
      errorSet.add(`${slot.groupName}: ${slot.label}.`);
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

  let progression = recalculateProgression(structuredClone(input.progression));
  progression = recalculateProgression(
    syncChargenSelectionSkillRows({
      content: input.content,
      progression
    })
  );
  progression = recalculateProgression(
    syncChargenLanguageSkillRows({
      civilizationId: input.civilizationId,
      content: input.content,
      progression,
      societyId: input.societyId
    })
  );
  progression = recalculateProgression(
    syncChargenMotherTongueSkillRow({
      civilizationId: input.civilizationId,
      content: input.content,
      educationLevel: review.draftView.education.theoreticalSkillCount,
      progression
    })
  );
  progression.educationPoints = review.draftView.education.theoreticalSkillCount;
  const languageSummary = buildChargenLanguageSelectionSummary({
    civilizationId: input.civilizationId,
    content: input.content,
    progression,
    societyId: input.societyId
  });
  const selectableSkillSummary = buildChargenSelectableSkillSummary({
    content: input.content,
    professionId: input.professionId,
    progression,
    societyId: input.societyId,
    societyLevel: input.societyLevel
  });
  progression.chargenSelections = {
    selectedLanguageIds: languageSummary.selectedLanguageIds,
    selectedSkillIds: selectableSkillSummary.selectedSkillIds,
    selectedGroupSlots: progression.chargenSelections?.selectedGroupSlots ?? []
  };
  progression = recalculateProgression(
    applyRelationshipMinimumGrants({
      content: input.content,
      progression
    })
  );

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
  return group && group.ranks > 0 ? LEGACY_GROUP_POINT_COST : LEGACY_GROUP_POINT_COST * 2;
}

export function getPrimaryPurchaseCostForSkill(
  progression: CharacterProgression,
  skillDefinition: SkillDefinition
): number {
  void progression;

  return getSkillSpendCost(skillDefinition);
}

export function getSecondaryPurchaseCostForSkill(
  progression: CharacterProgression,
  skillDefinition: SkillDefinition
): number {
  void progression;

  return getSkillSpendCost(skillDefinition);
}

export function getSecondaryPurchaseCostForSpecialization(
  progression: CharacterProgression,
  specializationDefinition: SkillSpecialization
): number {
  const specialization = progression.specializations.find(
    (item) => item.specializationId === specializationDefinition.id
  );
  return getSpecializationSpendCost(Boolean(specialization && specialization.secondaryRanks > 0));
}

export function getAllowedPrimaryGroupIds(
  content: CanonicalContentShape,
  professionId: string,
  societyId: string | undefined,
  societyLevel: number
): string[] {
  return getAllowedSkillGroupIdsInternal(content, professionId, societyId, societyLevel);
}

export function buildChargenSkillAccessSummary(input: {
  content: CanonicalContentShape;
  professionId: string;
  societyId?: string;
  societyLevel: number;
}): ChargenSkillAccessSummary {
  return buildChargenSkillAccessSummaryInternal(input);
}

export function getAllowedSecondaryGroupIds(
  content: CanonicalContentShape,
  societyId: string | undefined,
  societyLevel: number
): string[] {
  return getAllowedSecondaryGroupIdsInternal(content, societyId, societyLevel);
}
