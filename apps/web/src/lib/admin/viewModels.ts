import { collectCanonicalContentWarnings, type CanonicalContent } from "@glantri/content";
import { equipmentTemplates } from "@glantri/content/equipment";
import {
  getPlayerFacingSkillCategoryId,
  getSkillGroupIds,
  type SkillDefinition
} from "@glantri/domain";
import { getMeleeCrossTrainingFactor, resolveEffectiveProfessionPackage } from "@glantri/rules-engine";
import type { ArmorTemplate, GearTemplate, ShieldTemplate, ValuableTemplate, WeaponTemplate } from "@glantri/domain";

import {
  isCatalogMeleeWeaponTemplate,
  isCatalogMissileWeaponTemplate
} from "../../features/equipment/weaponCatalogTables";

/*
  Terminology guardrail:
  Keep mechanical Type separate from player-facing Skill category.
  When changing shared wording in admin review models, update
  packages/domain/src/docs/glantriTerms.ts in the same patch.
*/

export interface SkillAdminRow {
  characteristics: string;
  dependencies: string[];
  foundationalAccessBandsSummary: string;
  foundationalAccessMatrixRows: Array<{
    canonicalSocietyLevel?: number;
    societyName: string;
    socialBands: number[];
  }>;
  foundationalAccessSlots: Array<{
    accessBand: number;
    canonicalSocietyLevel?: number;
    societyName: string;
  }>;
  groupNames: string[];
  hasSkillRelationships: boolean;
  id: string;
  incomingDerivedGrants: Array<{
    factorPercent: number;
    sourceSkillId: string;
    sourceSkillName: string;
  }>;
  incomingMeleeCrossTraining: Array<{
    factorPercent: number;
    sourceSkillId: string;
    sourceSkillName: string;
  }>;
  incomingSpecializationBridges: Array<{
    factorPercent: number;
    sourceName: string;
    sourceType: "skill" | "specialization";
  }>;
  meleeCrossTraining?:
    | {
        attackStyle: string;
        handClass: string;
      }
    | undefined;
  name: string;
  optionalGroupCount: number;
  optionalGroupNames: string[];
  outgoingDerivedGrants: Array<{
    factorPercent: number;
    targetSkillId: string;
    targetSkillName: string;
  }>;
  outgoingMeleeCrossTraining: Array<{
    factorPercent: number;
    targetSkillId: string;
    targetSkillName: string;
  }>;
  outgoingSpecializationBridges: Array<{
    parentExcessOffset: number;
    reverseFactorPercent: number;
    targetName: string;
    targetType: "skill" | "specialization";
    threshold: number;
  }>;
  primaryGroup: string;
  professionNames: string[];
  relationshipSummaryBadges: string[];
  secondaryOf: string;
  description: string;
  skillCategory: string;
  shortDescription: string;
  skillType: string;
  societyLevel: number;
  sortOrder: number;
  specializationOf: string;
  theoretical: boolean;
}

export interface SkillMatrixRow {
  allowsSpecializations: boolean;
  dependencies: string[];
  dependedOnBy: string[];
  dependentCount: number;
  groupNames: string[];
  hasSpecializations: boolean;
  id: string;
  literacyRequirement: string;
  longestDependencyChain: string[];
  name: string;
  secondaryOf: string;
  shortDescription: string;
  skillType: string;
  societyLevel: number;
  sortOrder: number;
  specializationOf: string;
}

export type AuditSeverity = "blocking" | "info" | "warning";

export interface SkillAuditIssue {
  category: string;
  detail: string;
  id: string;
  relatedSkills: string[];
  severity: AuditSeverity;
  skillId: string;
  skillName: string;
}

export interface SkillGroupAdminRow {
  allowedProfessions: string[];
  associatedProfessionLinks: Array<{
    familyId: string;
    familyName: string;
    professionId: string;
    professionName: string;
  }>;
  coreSkills: string[];
  fixedSkills: Array<{
    name: string;
    relevance: "core" | "optional";
  }>;
  fixedSkillNames: string[];
  id: string;
  includedSkills: string[];
  name: string;
  notes: string;
  optionalSkills: string[];
  selectionSlotCount: number;
  selectionSlots: Array<{
    candidateSkills: string[];
    chooseCount: number;
    id: string;
    label: string;
    required: boolean;
  }>;
  sortOrder: number;
  visibleProfessionFamilyIds: string[];
  warningDetails: string[];
  weightedContentPoints: number;
}

export interface ProfessionAdminRow {
  allowedSocietyEntries: string[];
  allowedSocietySlots: Array<{
    accessBand: number;
    canonicalSocietyLevel?: number;
    socialClass: string;
    societyName: string;
  }>;
  coreSkillGroups: string[];
  description: string;
  directSkillExceptions: string[];
  directlyGrantedSkills: string[];
  familyId: string;
  familyName: string;
  groupFans: Array<{
    coreSkills: string[];
    groupName: string;
    optionalSkills: string[];
    relevance: "core" | "optional";
    weightedContentPoints: number;
  }>;
  grantedSkillGroups: string[];
  id: string;
  name: string;
  notes: string;
  optionalSkillGroups: string[];
  reachableGroupSkills: string[];
  totalReachableSkills: number;
}

export interface ProfessionMatrixRow {
  allowedSocietyEntries: string[];
  description: string;
  directSkillExceptions: string[];
  directSkillOverrideCount: number;
  directlyGrantedSkills: string[];
  duplicateDirectSkills: string[];
  grantedSkillGroups: string[];
  hasDirectSkillExceptions: boolean;
  id: string;
  name: string;
  notes: string;
  reachBand: "broad" | "medium" | "narrow";
  reachableGroupSkills: string[];
  reachableSecondarySkills: string[];
  reachableSkills: string[];
  reachableSpecializationLinkedSkills: string[];
  totalReachableSkills: number;
}

export interface ProfessionAuditIssue {
  category: string;
  detail: string;
  id: string;
  relatedEntries: string[];
  severity: AuditSeverity;
  professionId: string;
  professionName: string;
}

export interface SocietyAdminRow {
  baseEducation: string;
  baselineLanguages: string[];
  canonicalSocietyLevel?: number;
  directOnlySkills: string[];
  directSkillGroups: string[];
  directSkills: string[];
  dieRange: string;
  effectiveProfessionSkills: string[];
  glantriExamples?: string;
  historicalReference?: string;
  id: string;
  literacyAccessSummary: string;
  notes: string;
  professionFans: Array<{
    coreGroups: Array<{
      coreSkills: string[];
      groupName: string;
      optionalSkills: string[];
    }>;
    optionalGroups: Array<{
      coreSkills: string[];
      groupName: string;
      optionalSkills: string[];
    }>;
    professionName: string;
    reachableSkills: string[];
  }>;
  reachableProfessions: string[];
  shortDescription: string;
  society: string;
  societyClassName: string;
  societyLevel: number;
  totalEffectiveReachableSkills: number;
}

const LOW_WEIGHTED_GROUP_POINTS_THRESHOLD = 5;
const HIGH_WEIGHTED_GROUP_POINTS_THRESHOLD = 12;

export interface SocietyMatrixRow {
  baseEducation: string;
  directGroupOverrideCount: number;
  directOnlySkills: string[];
  directSkillGroups: string[];
  directSkillOverrideCount: number;
  directSkills: string[];
  dieRange: string;
  effectiveProfessionSkills: string[];
  hasDirectOverrides: boolean;
  id: string;
  notes: string;
  professionDerivedReachCount: number;
  reachableProfessions: string[];
  reachBand: "broad" | "medium" | "narrow";
  society: string;
  societyClassName: string;
  societyLevel: number;
  totalEffectiveReachableSkills: number;
}

export interface SocietyAuditIssue {
  category: string;
  detail: string;
  id: string;
  relatedEntries: string[];
  severity: AuditSeverity;
  societyRowId: string;
  societyRowName: string;
}

export function getProfessionFamilyName(content: CanonicalContent, familyId: string): string {
  return content.professionFamilies.find((family) => family.id === familyId)?.name ?? familyId;
}

export function buildProfessionFamilyFilterOptions(
  content: CanonicalContent,
  familyIds: Iterable<string>
): string[] {
  return ["all", ...new Set(Array.from(familyIds).filter((value) => value.length > 0))].sort(
    (left, right) => {
      if (left === "all") {
        return -1;
      }

      if (right === "all") {
        return 1;
      }

      return getProfessionFamilyName(content, left).localeCompare(
        getProfessionFamilyName(content, right)
      );
    }
  );
}

export interface ProfessionAccessRow {
  id: string;
  name: string;
  societyEntries: string[];
  skillGroups: string[];
  skills: string[];
}

export interface SocietyAccessRow {
  id: string;
  professions: string[];
  skillGroups: string[];
  skills: string[];
  societyEntry: string;
}

export interface AdminOverviewStats {
  accountCount?: number;
  armorCount: number;
  documentsCount?: number;
  gearCount: number;
  languageCount: number;
  languageCountLabel: string;
  meleeWeaponCount: number;
  missileWeaponCount: number;
  professionCount: number;
  societyCount: number;
  societyAccessRowCount: number;
  shieldCount: number;
  skillCount: number;
  skillGroupCount: number;
  tablesCount?: number;
  valuablesCount: number;
}

function uniqueSorted(values: string[]): string[] {
  return [...new Set(values)].sort((left, right) => left.localeCompare(right));
}

function joinDisplayName(name: string, suffix?: string): string {
  return suffix ? `${name} (${suffix})` : name;
}

function getWeightedSkillPoints(skill: CanonicalContent["skills"][number]): number {
  return skill.category === "secondary" ? 1 : 2;
}

function getGroupMemberships(
  content: CanonicalContent,
  groupId: string
): Array<{ relevance: "core" | "optional"; skillId: string }> {
  const group = content.skillGroups.find((candidate) => candidate.id === groupId);

  if (group?.skillMemberships?.length) {
    return group.skillMemberships;
  }

  return content.skills
    .filter((skill) => getSkillGroupIds(skill).includes(groupId))
    .map((skill) => ({
      relevance: skill.groupId === groupId ? ("core" as const) : ("optional" as const),
      skillId: skill.id
    }));
}

function formatSocietyEntryLabel(societyName: string, level: number, socialClass: string): string {
  return `${societyName} L${level} - ${socialClass}`;
}

function formatCharacteristicList(characteristics: string[]): string {
  return characteristics.map((characteristic) => characteristic.toUpperCase()).join(", ");
}

function getDieRange(level: number): string {
  switch (level) {
    case 1:
      return "1-10";
    case 2:
      return "11-15";
    case 3:
      return "16-18";
    case 4:
      return "19-20";
    default:
      return "Custom";
  }
}

function summarizeAccessBands(bands: number[]): string {
  if (bands.length === 0) {
    return "—";
  }

  const uniqueBands = [...new Set(bands)].sort((left, right) => left - right);
  const ranges: string[] = [];
  let rangeStart = uniqueBands[0] ?? 0;
  let previous = uniqueBands[0] ?? 0;

  for (let index = 1; index < uniqueBands.length; index += 1) {
    const current = uniqueBands[index];

    if (current === previous + 1) {
      previous = current;
      continue;
    }

    ranges.push(rangeStart === previous ? `L${rangeStart}` : `L${rangeStart}-L${previous}`);
    rangeStart = current ?? previous;
    previous = current ?? previous;
  }

  ranges.push(rangeStart === previous ? `L${rangeStart}` : `L${rangeStart}-L${previous}`);

  return ranges.join(", ");
}

function getAuditSeverityRank(severity: AuditSeverity): number {
  if (severity === "blocking") {
    return 0;
  }

  if (severity === "warning") {
    return 1;
  }

  return 2;
}

function buildSkillMaps(content: CanonicalContent) {
  const skillGroupsById = new Map(content.skillGroups.map((group) => [group.id, group]));
  const skillsById = new Map(content.skills.map((skill) => [skill.id, skill]));
  const professionsById = new Map(content.professions.map((profession) => [profession.id, profession]));
  const societiesById = new Map(
    content.societyLevels.map((societyLevel) => [
      societyLevel.societyId,
      societyLevel.societyName
    ])
  );

  return {
    professionsById,
    skillGroupsById,
    skillsById,
    societiesById
  };
}

function createEmptyArrayMap(): Map<string, string[]> {
  return new Map<string, string[]>();
}

function appendArrayMapValue(map: Map<string, string[]>, key: string, value: string): void {
  const existing = map.get(key);

  if (existing) {
    existing.push(value);
    return;
  }

  map.set(key, [value]);
}

function buildSkillRelationshipContext(content: CanonicalContent) {
  const { skillGroupsById, skillsById } = buildSkillMaps(content);
  const dependedOnByIds = createEmptyArrayMap();
  const specializationChildIds = createEmptyArrayMap();
  const directSpecializationsBySkillId = createEmptyArrayMap();

  for (const skill of content.skills) {
    for (const dependencySkillId of skill.dependencySkillIds) {
      appendArrayMapValue(dependedOnByIds, dependencySkillId, skill.id);
    }

    if (skill.specializationOfSkillId) {
      appendArrayMapValue(specializationChildIds, skill.specializationOfSkillId, skill.id);
    }
  }

  for (const specialization of content.specializations) {
    appendArrayMapValue(directSpecializationsBySkillId, specialization.skillId, specialization.name);
  }

  const chainMemo = new Map<string, string[]>();

  function getLongestDependencyChain(skillId: string): string[] {
    const cached = chainMemo.get(skillId);

    if (cached) {
      return cached;
    }

    const skill = skillsById.get(skillId);

    if (!skill || skill.dependencySkillIds.length === 0) {
      const terminalChain = [skillId];

      chainMemo.set(skillId, terminalChain);
      return terminalChain;
    }

    let longestChain = [skillId];

    for (const dependencySkillId of skill.dependencySkillIds) {
      const candidateChain = [skillId, ...getLongestDependencyChain(dependencySkillId)];

      if (candidateChain.length > longestChain.length) {
        longestChain = candidateChain;
      }
    }

    chainMemo.set(skillId, longestChain);
    return longestChain;
  }

  function getSkillName(skillId: string): string {
    return skillsById.get(skillId)?.name ?? skillId;
  }

  return {
    directSpecializationsBySkillId,
    dependedOnByIds,
    getLongestDependencyChain,
    getSkillName,
    skillGroupsById,
    skillsById,
    specializationChildIds
  };
}

export function buildSkillRelationshipSummary(input: {
  content: CanonicalContent;
  skillId: string;
}) {
  const skillsById = new Map(input.content.skills.map((skill) => [skill.id, skill]));
  const specializationsById = new Map(
    input.content.specializations.map((specialization) => [specialization.id, specialization])
  );
  const skill = skillsById.get(input.skillId);
  const specialization = specializationsById.get(input.skillId);

  if (!skill && !specialization) {
    return {
      hasSkillRelationships: false,
      incomingDerivedGrants: [],
      incomingMeleeCrossTraining: [],
      incomingSpecializationBridges: [],
      meleeCrossTraining: undefined,
      outgoingDerivedGrants: [],
      outgoingMeleeCrossTraining: [],
      outgoingSpecializationBridges: [],
      relationshipSummaryBadges: []
    };
  }

  if (!skill && specialization) {
    const parentSkill = skillsById.get(specialization.skillId);
    const incomingSpecializationBridges = specialization.specializationBridge
      ? [
          {
            factorPercent: Math.floor(specialization.specializationBridge.reverseFactor * 100),
            sourceName:
              skillsById.get(specialization.specializationBridge.parentSkillId)?.name ??
              specialization.specializationBridge.parentSkillId,
            sourceType: "skill" as const
          }
        ]
      : [];
    const relationshipSummaryBadges = [
      ...(incomingSpecializationBridges.length > 0
        ? [`Specialized from ${incomingSpecializationBridges.length}`]
        : []),
      ...(parentSkill ? [`Parent ${parentSkill.name}`] : [])
    ];

    return {
      hasSkillRelationships: incomingSpecializationBridges.length > 0,
      incomingDerivedGrants: [],
      incomingMeleeCrossTraining: [],
      incomingSpecializationBridges,
      meleeCrossTraining: undefined,
      outgoingDerivedGrants: [],
      outgoingMeleeCrossTraining: [],
      outgoingSpecializationBridges: [],
      relationshipSummaryBadges
    };
  }

  if (!skill) {
    throw new Error(`Missing skill row for relationship summary "${input.skillId}".`);
  }

  const correspondingSpecializationBridge = specialization?.specializationBridge;

  const outgoingDerivedGrants = (skill.derivedGrants ?? [])
    .map((grant) => ({
      factorPercent: Math.floor(grant.factor * 100),
      targetSkillId: grant.skillId,
      targetSkillName: skillsById.get(grant.skillId)?.name ?? grant.skillId
    }))
    .sort(
      (left, right) =>
        left.targetSkillName.localeCompare(right.targetSkillName) ||
        left.factorPercent - right.factorPercent
    );

  const incomingDerivedGrants = input.content.skills
    .flatMap((candidate) =>
      (candidate.derivedGrants ?? [])
        .filter((grant) => grant.skillId === skill.id)
        .map((grant) => ({
          factorPercent: Math.floor(grant.factor * 100),
          sourceSkillId: candidate.id,
          sourceSkillName: candidate.name
        }))
    )
    .sort(
      (left, right) =>
        left.sourceSkillName.localeCompare(right.sourceSkillName) ||
        left.factorPercent - right.factorPercent
    );

  const outgoingMeleeCrossTraining = input.content.skills
    .filter((candidate) => candidate.id !== skill.id)
    .flatMap((candidate) => {
      const factor = getMeleeCrossTrainingFactor({
        source: skill.meleeCrossTraining,
        target: candidate.meleeCrossTraining
      });

      if (factor <= 0) {
        return [];
      }

      return [
        {
          factorPercent: Math.floor(factor * 100),
          targetSkillId: candidate.id,
          targetSkillName: candidate.name
        }
      ];
    })
    .sort(
      (left, right) =>
        right.factorPercent - left.factorPercent ||
        left.targetSkillName.localeCompare(right.targetSkillName)
    );

  const incomingMeleeCrossTraining = input.content.skills
    .filter((candidate) => candidate.id !== skill.id)
    .flatMap((candidate) => {
      const factor = getMeleeCrossTrainingFactor({
        source: candidate.meleeCrossTraining,
        target: skill.meleeCrossTraining
      });

      if (factor <= 0) {
        return [];
      }

      return [
        {
          factorPercent: Math.floor(factor * 100),
          sourceSkillId: candidate.id,
          sourceSkillName: candidate.name
        }
      ];
    })
    .sort(
      (left, right) =>
        right.factorPercent - left.factorPercent ||
        left.sourceSkillName.localeCompare(right.sourceSkillName)
    );

  const meleeCrossTraining = skill.meleeCrossTraining
    ? {
        attackStyle: skill.meleeCrossTraining.attackStyle,
        handClass: skill.meleeCrossTraining.handClass
      }
    : undefined;

  const outgoingSpecializationBridges = [
    ...input.content.skills
      .filter((candidate) => candidate.specializationBridge?.parentSkillId === skill.id)
      .map((candidate) => ({
        parentExcessOffset: candidate.specializationBridge!.parentExcessOffset,
        reverseFactorPercent: Math.floor(candidate.specializationBridge!.reverseFactor * 100),
        targetName: candidate.name,
        targetType: "skill" as const,
        threshold: candidate.specializationBridge!.threshold
      })),
    ...input.content.specializations
      .filter((candidate) => candidate.specializationBridge?.parentSkillId === skill.id)
      .map((candidate) => ({
        parentExcessOffset: candidate.specializationBridge!.parentExcessOffset,
        reverseFactorPercent: Math.floor(candidate.specializationBridge!.reverseFactor * 100),
        targetName: candidate.name,
        targetType: "specialization" as const,
        threshold: candidate.specializationBridge!.threshold
      }))
  ].sort(
    (left, right) =>
      left.targetName.localeCompare(right.targetName) ||
      left.threshold - right.threshold
  );

  const incomingSpecializationBridges = [
    ...(skill.specializationBridge ?? correspondingSpecializationBridge
      ? [
          {
            factorPercent: Math.floor(
              (skill.specializationBridge ?? correspondingSpecializationBridge)!.reverseFactor * 100
            ),
            sourceName:
              skillsById.get(
                (skill.specializationBridge ?? correspondingSpecializationBridge)!.parentSkillId
              )?.name ?? (skill.specializationBridge ?? correspondingSpecializationBridge)!.parentSkillId,
            sourceType: "skill" as const
          }
        ]
      : []),
    ...input.content.skills
      .filter((candidate) => candidate.specializationBridge?.parentSkillId === skill.id)
      .map((candidate) => ({
        factorPercent: Math.floor(candidate.specializationBridge!.reverseFactor * 100),
        sourceName: candidate.name,
        sourceType: "skill" as const
      })),
    ...input.content.specializations
      .filter((candidate) => candidate.specializationBridge?.parentSkillId === skill.id)
      .map((candidate) => ({
        factorPercent: Math.floor(candidate.specializationBridge!.reverseFactor * 100),
        sourceName: candidate.name,
        sourceType: "specialization" as const
      }))
  ].sort(
    (left, right) =>
      left.sourceName.localeCompare(right.sourceName) ||
      left.factorPercent - right.factorPercent
  );

  const relationshipSummaryBadges = [
    ...(outgoingDerivedGrants.length > 0 ? [`Grants ${outgoingDerivedGrants.length}`] : []),
    ...(incomingDerivedGrants.length > 0 ? [`Receives ${incomingDerivedGrants.length}`] : []),
    ...(outgoingMeleeCrossTraining.length > 0
      ? [`Cross-trains ${outgoingMeleeCrossTraining.length}`]
      : []),
    ...(incomingMeleeCrossTraining.length > 0
      ? [`Cross-trained from ${incomingMeleeCrossTraining.length}`]
      : []),
    ...(outgoingSpecializationBridges.length > 0
      ? [`Specializes ${outgoingSpecializationBridges.length}`]
      : []),
    ...(incomingSpecializationBridges.length > 0
      ? [`Specialized from ${incomingSpecializationBridges.length}`]
      : [])
  ];

  return {
    hasSkillRelationships:
      outgoingDerivedGrants.length > 0 ||
      incomingDerivedGrants.length > 0 ||
      outgoingMeleeCrossTraining.length > 0 ||
      incomingMeleeCrossTraining.length > 0 ||
      outgoingSpecializationBridges.length > 0 ||
      incomingSpecializationBridges.length > 0,
    incomingDerivedGrants,
    incomingMeleeCrossTraining,
    incomingSpecializationBridges,
    meleeCrossTraining,
    outgoingDerivedGrants,
    outgoingMeleeCrossTraining,
    outgoingSpecializationBridges,
    relationshipSummaryBadges
  };
}

export function buildAdminOverviewStats(content: CanonicalContent): AdminOverviewStats {
  const meleeWeaponCount = equipmentTemplates.filter(
    (template): template is WeaponTemplate =>
      template.category === "weapon" && isCatalogMeleeWeaponTemplate(template)
  ).length;
  const missileWeaponCount = equipmentTemplates.filter(
    (template): template is WeaponTemplate =>
      template.category === "weapon" && isCatalogMissileWeaponTemplate(template)
  ).length;
  const shieldCount = equipmentTemplates.filter(
    (template): template is ShieldTemplate => template.category === "shield"
  ).length;
  const armorCount = equipmentTemplates.filter(
    (template): template is ArmorTemplate => template.category === "armor"
  ).length;
  const gearCount = equipmentTemplates.filter(
    (template): template is GearTemplate => template.category === "gear"
  ).length;
  const valuablesCount = equipmentTemplates.filter(
    (template): template is ValuableTemplate => template.category === "valuables"
  ).length;

  return {
    accountCount: undefined,
    armorCount,
    documentsCount: undefined,
    gearCount,
    languageCount: content.languages.length,
    languageCountLabel: "Baseline / provisional languages",
    meleeWeaponCount,
    missileWeaponCount,
    professionCount: content.professions.length,
    societyCount: content.societies.length,
    societyAccessRowCount: content.societyLevels.length,
    shieldCount,
    skillCount: content.skills.length,
    skillGroupCount: content.skillGroups.length,
    tablesCount: undefined,
    valuablesCount
  };
}

export function buildSkillAdminRows(content: CanonicalContent): SkillAdminRow[] {
  const { skillGroupsById, skillsById } = buildSkillMaps(content);
  const professionPackages = content.professions.map((profession) => {
    const resolvedPackage = resolveProfessionGrantPackage(content, profession.id);

    return {
      name: profession.name,
      reachableSkillIds: resolvedPackage.reachableSkillIds
    };
  });

  function buildSkillRow(skill: SkillDefinition): SkillAdminRow {
      const relationshipSummary = buildSkillRelationshipSummary({
        content,
        skillId: skill.id
      });
      const groupIds = getSkillGroupIds(skill);
      const primaryGroupId = skill.groupId ?? groupIds[0];
      const primaryGroup = primaryGroupId
        ? skillGroupsById.get(primaryGroupId)?.name ?? primaryGroupId
        : "";
      const optionalGroupNames = uniqueSorted(
        groupIds
          .filter((groupId) => groupId !== primaryGroupId)
          .map((groupId) => skillGroupsById.get(groupId)?.name ?? groupId)
      );
      const professionNames = uniqueSorted(
        professionPackages
          .filter((professionPackage) => professionPackage.reachableSkillIds.includes(skill.id))
          .map((professionPackage) => professionPackage.name)
      );
      const foundationalAccessSlots = content.societyBandSkillAccess
        .filter((entry) => entry.skillId === skill.id)
        .map((entry) => ({
          accessBand: entry.socialBand,
          canonicalSocietyLevel: entry.linkedSocietyLevel,
          societyName: entry.societyName
        }))
        .sort(
          (left, right) =>
            (left.canonicalSocietyLevel ?? 99) - (right.canonicalSocietyLevel ?? 99) ||
          left.societyName.localeCompare(right.societyName) ||
          left.accessBand - right.accessBand
        );
      const foundationalAccessMatrixRows = Array.from(
        foundationalAccessSlots.reduce(
          (map, slot) => {
            const existing = map.get(slot.societyName);

            if (existing) {
              existing.socialBands.push(slot.accessBand);
              return map;
            }

            map.set(slot.societyName, {
              canonicalSocietyLevel: slot.canonicalSocietyLevel,
              societyName: slot.societyName,
              socialBands: [slot.accessBand]
            });

            return map;
          },
          new Map<
            string,
            {
              canonicalSocietyLevel?: number;
              societyName: string;
              socialBands: number[];
            }
          >()
        ).values()
      )
        .map((row) => ({
          ...row,
          socialBands: [...new Set(row.socialBands)].sort((left, right) => left - right)
        }))
        .sort(
          (left, right) =>
            (left.canonicalSocietyLevel ?? 99) - (right.canonicalSocietyLevel ?? 99) ||
            left.societyName.localeCompare(right.societyName)
        );

      return {
        characteristics: formatCharacteristicList(skill.linkedStats),
        dependencies: uniqueSorted(
          skill.dependencySkillIds.map(
            (dependencySkillId) => skillsById.get(dependencySkillId)?.name ?? dependencySkillId
          )
        ),
        foundationalAccessBandsSummary: summarizeAccessBands(
          foundationalAccessSlots.map((slot) => slot.accessBand)
        ),
        foundationalAccessMatrixRows,
        foundationalAccessSlots,
        groupNames: groupIds.map((groupId) => skillGroupsById.get(groupId)?.name ?? groupId),
        hasSkillRelationships: relationshipSummary.hasSkillRelationships,
        id: skill.id,
        incomingDerivedGrants: relationshipSummary.incomingDerivedGrants,
        incomingMeleeCrossTraining: relationshipSummary.incomingMeleeCrossTraining,
        incomingSpecializationBridges: relationshipSummary.incomingSpecializationBridges,
        meleeCrossTraining: relationshipSummary.meleeCrossTraining,
        name: skill.name,
        optionalGroupCount: optionalGroupNames.length,
        optionalGroupNames,
        outgoingDerivedGrants: relationshipSummary.outgoingDerivedGrants,
        outgoingMeleeCrossTraining: relationshipSummary.outgoingMeleeCrossTraining,
        outgoingSpecializationBridges: relationshipSummary.outgoingSpecializationBridges,
        primaryGroup,
        professionNames,
        relationshipSummaryBadges: relationshipSummary.relationshipSummaryBadges,
        secondaryOf: skill.secondaryOfSkillId
          ? skillsById.get(skill.secondaryOfSkillId)?.name ?? skill.secondaryOfSkillId
          : "",
        description: skill.description ?? "",
        skillCategory: getPlayerFacingSkillCategoryId(skill),
        shortDescription: skill.shortDescription ?? "",
        skillType: skill.category,
        societyLevel: skill.societyLevel,
        sortOrder: skill.sortOrder,
        specializationOf: skill.specializationOfSkillId
          ? skillsById.get(skill.specializationOfSkillId)?.name ?? skill.specializationOfSkillId
          : "",
        theoretical: skill.isTheoretical
      };
  }

  function buildSpecializationOnlyRow(
    specialization: CanonicalContent["specializations"][number]
  ): SkillAdminRow | null {
    const parentSkill = skillsById.get(specialization.skillId);

    if (!parentSkill) {
      return null;
    }

    const relationshipSummary = buildSkillRelationshipSummary({
      content,
      skillId: specialization.id
    });
    const groupIds = getSkillGroupIds(parentSkill);
    const primaryGroupId = parentSkill.groupId ?? groupIds[0];
    const primaryGroup = primaryGroupId
      ? skillGroupsById.get(primaryGroupId)?.name ?? primaryGroupId
      : "";
    const optionalGroupNames = uniqueSorted(
      groupIds
        .filter((groupId) => groupId !== primaryGroupId)
        .map((groupId) => skillGroupsById.get(groupId)?.name ?? groupId)
    );
    const professionNames = uniqueSorted(
      professionPackages
        .filter((professionPackage) =>
          professionPackage.reachableSkillIds.includes(parentSkill.id)
        )
        .map((professionPackage) => professionPackage.name)
    );

    return {
      characteristics: formatCharacteristicList(parentSkill.linkedStats),
      dependencies: [parentSkill.name],
      description: specialization.description ?? "",
      foundationalAccessBandsSummary: "—",
      foundationalAccessMatrixRows: [],
      foundationalAccessSlots: [],
      groupNames: groupIds.map((groupId) => skillGroupsById.get(groupId)?.name ?? groupId),
      hasSkillRelationships: relationshipSummary.hasSkillRelationships,
      id: specialization.id,
      incomingDerivedGrants: relationshipSummary.incomingDerivedGrants,
      incomingMeleeCrossTraining: relationshipSummary.incomingMeleeCrossTraining,
      incomingSpecializationBridges: relationshipSummary.incomingSpecializationBridges,
      meleeCrossTraining: relationshipSummary.meleeCrossTraining,
      name: specialization.name,
      optionalGroupCount: optionalGroupNames.length,
      optionalGroupNames,
      outgoingDerivedGrants: relationshipSummary.outgoingDerivedGrants,
      outgoingMeleeCrossTraining: relationshipSummary.outgoingMeleeCrossTraining,
      outgoingSpecializationBridges: relationshipSummary.outgoingSpecializationBridges,
      primaryGroup,
      professionNames,
      relationshipSummaryBadges: relationshipSummary.relationshipSummaryBadges,
      secondaryOf: "",
      skillCategory: getPlayerFacingSkillCategoryId(parentSkill),
      shortDescription: specialization.description ?? "",
      skillType: "specialization",
      societyLevel: specialization.minimumParentLevel,
      sortOrder: specialization.sortOrder,
      specializationOf: parentSkill.name,
      theoretical: parentSkill.isTheoretical
    };
  }

  const skillRows = content.skills.map(buildSkillRow);
  const skillIds = new Set(content.skills.map((skill) => skill.id));
  const specializationRows = content.specializations
    .filter((specialization) => !skillIds.has(specialization.id))
    .map(buildSpecializationOnlyRow)
    .filter((row): row is SkillAdminRow => row !== null);

  return [...skillRows, ...specializationRows].sort(
    (left, right) => left.name.localeCompare(right.name) || left.sortOrder - right.sortOrder
  );
}

export function buildSkillMatrixRows(content: CanonicalContent): SkillMatrixRow[] {
  const relationshipContext = buildSkillRelationshipContext(content);

  return [...content.skills]
    .sort((left, right) => left.name.localeCompare(right.name) || left.sortOrder - right.sortOrder)
    .map((skill) => {
      const groupIds = getSkillGroupIds(skill);
      const dependencyNames = uniqueSorted(
        skill.dependencySkillIds.map(relationshipContext.getSkillName)
      );
      const dependedOnByNames = uniqueSorted(
        (relationshipContext.dependedOnByIds.get(skill.id) ?? []).map(relationshipContext.getSkillName)
      );
      const hasSpecializations =
        (relationshipContext.directSpecializationsBySkillId.get(skill.id)?.length ?? 0) > 0 ||
        (relationshipContext.specializationChildIds.get(skill.id)?.length ?? 0) > 0;

      return {
        allowsSpecializations: skill.allowsSpecializations,
        dependencies: dependencyNames,
        dependedOnBy: dependedOnByNames,
        dependentCount: dependedOnByNames.length,
        groupNames: groupIds.map(
          (groupId) => relationshipContext.skillGroupsById.get(groupId)?.name ?? groupId
        ),
        hasSpecializations,
        id: skill.id,
        literacyRequirement: skill.requiresLiteracy,
        longestDependencyChain: relationshipContext
          .getLongestDependencyChain(skill.id)
          .map(relationshipContext.getSkillName),
        name: skill.name,
        secondaryOf: skill.secondaryOfSkillId
          ? relationshipContext.getSkillName(skill.secondaryOfSkillId)
          : "",
        shortDescription: skill.shortDescription ?? "",
        skillType: skill.category,
        societyLevel: skill.societyLevel,
        sortOrder: skill.sortOrder,
        specializationOf: skill.specializationOfSkillId
          ? relationshipContext.getSkillName(skill.specializationOfSkillId)
          : ""
      };
    });
}

export function buildSkillAuditIssues(content: CanonicalContent): SkillAuditIssue[] {
  const relationshipContext = buildSkillRelationshipContext(content);
  const issues: SkillAuditIssue[] = [];

  for (const skill of content.skills) {
    const groupIds = getSkillGroupIds(skill);
    const dependedOnBy = relationshipContext.dependedOnByIds.get(skill.id) ?? [];
    const structuralRelationshipCount =
      skill.dependencySkillIds.length +
      dependedOnBy.length +
      (skill.secondaryOfSkillId ? 1 : 0) +
      (skill.specializationOfSkillId ? 1 : 0) +
      (relationshipContext.specializationChildIds.get(skill.id)?.length ?? 0) +
      (relationshipContext.directSpecializationsBySkillId.get(skill.id)?.length ?? 0);

    if (groupIds.length === 0 && structuralRelationshipCount === 0) {
      issues.push({
        category: "Orphaned skill",
        detail: "This skill has no group membership and no structural relationship hooks.",
        id: `orphaned:${skill.id}`,
        relatedSkills: [],
        severity: "warning",
        skillId: skill.id,
        skillName: skill.name
      });
    } else if (structuralRelationshipCount === 0) {
      issues.push({
        category: "Structurally isolated",
        detail: "This skill is grouped, but nothing depends on it and it has no other structural links.",
        id: `isolated:${skill.id}`,
        relatedSkills: [],
        severity: "info",
        skillId: skill.id,
        skillName: skill.name
      });
    }

    if (!skill.shortDescription?.trim()) {
      issues.push({
        category: "Missing short description",
        detail: "Add short list copy so this skill reads well in matrix, profession, and society review views.",
        id: `missing-short-description:${skill.id}`,
        relatedSkills: [],
        severity: "info",
        skillId: skill.id,
        skillName: skill.name
      });
    }

    if (dependedOnBy.length >= 3) {
      issues.push({
        category: "Many dependents",
        detail: `This skill is a prerequisite hub for ${dependedOnBy.length} other skills.`,
        id: `many-dependents:${skill.id}`,
        relatedSkills: uniqueSorted(dependedOnBy.map(relationshipContext.getSkillName)),
        severity: "info",
        skillId: skill.id,
        skillName: skill.name
      });
    }

    const longestChain = relationshipContext.getLongestDependencyChain(skill.id);

    if (longestChain.length >= 4) {
      issues.push({
        category: "Long dependency chain",
        detail: `Dependency chain length ${longestChain.length - 1}: ${longestChain
          .map(relationshipContext.getSkillName)
          .join(" -> ")}.`,
        id: `long-chain:${skill.id}`,
        relatedSkills: longestChain.slice(1).map(relationshipContext.getSkillName),
        severity: "warning",
        skillId: skill.id,
        skillName: skill.name
      });
    }

    if (skill.specializationOfSkillId) {
      const parentSkill = relationshipContext.skillsById.get(skill.specializationOfSkillId);

      if (!parentSkill) {
        issues.push({
          category: "Specialization parent missing",
          detail: "This specialization-linked skill points at a parent skill that does not exist.",
          id: `missing-specialization-parent:${skill.id}`,
          relatedSkills: [skill.specializationOfSkillId],
          severity: "blocking",
          skillId: skill.id,
          skillName: skill.name
        });
      } else if (!parentSkill.allowsSpecializations) {
        issues.push({
          category: "Specialization parent mismatch",
          detail: `Parent skill "${parentSkill.name}" does not currently allow specializations.`,
          id: `specialization-parent-mismatch:${skill.id}`,
          relatedSkills: [parentSkill.name],
          severity: "blocking",
          skillId: skill.id,
          skillName: skill.name
        });
      }

      if (parentSkill && skill.societyLevel < parentSkill.societyLevel) {
        issues.push({
          category: "Society level mismatch",
          detail: `This skill is available at society level ${skill.societyLevel}, earlier than specialization parent "${parentSkill.name}" at level ${parentSkill.societyLevel}.`,
          id: `specialization-level-mismatch:${skill.id}`,
          relatedSkills: [parentSkill.name],
          severity: "warning",
          skillId: skill.id,
          skillName: skill.name
        });
      }
    }

    if (skill.secondaryOfSkillId) {
      const parentSkill = relationshipContext.skillsById.get(skill.secondaryOfSkillId);

      if (parentSkill && skill.societyLevel < parentSkill.societyLevel) {
        issues.push({
          category: "Society level mismatch",
          detail: `This skill is available at society level ${skill.societyLevel}, earlier than related secondary parent "${parentSkill.name}" at level ${parentSkill.societyLevel}.`,
          id: `secondary-level-mismatch:${skill.id}`,
          relatedSkills: [parentSkill.name],
          severity: "warning",
          skillId: skill.id,
          skillName: skill.name
        });
      }
    }

    const higherLevelDependencies = skill.dependencySkillIds
      .map((dependencySkillId) => relationshipContext.skillsById.get(dependencySkillId))
      .filter(
        (dependencySkill): dependencySkill is NonNullable<typeof dependencySkill> =>
          Boolean(dependencySkill && dependencySkill.societyLevel > skill.societyLevel)
      );

    if (higherLevelDependencies.length > 0) {
      issues.push({
        category: "Society level mismatch",
        detail: `This skill is available earlier than dependency skill(s): ${higherLevelDependencies
          .map((dependencySkill) => `${dependencySkill.name} (L${dependencySkill.societyLevel})`)
          .join(", ")}.`,
        id: `dependency-level-mismatch:${skill.id}`,
        relatedSkills: higherLevelDependencies.map((dependencySkill) => dependencySkill.name),
        severity: "warning",
        skillId: skill.id,
        skillName: skill.name
      });
    }
  }

  return issues.sort(
    (left, right) =>
      getAuditSeverityRank(left.severity) - getAuditSeverityRank(right.severity) ||
      left.category.localeCompare(right.category) ||
      left.skillName.localeCompare(right.skillName)
  );
}

function buildProfessionRelationshipContext(content: CanonicalContent) {
  const skillContext = buildSkillRelationshipContext(content);
  const groupSkillIdsByGroupId = new Map<string, string[]>();
  const societyEntriesByProfessionId = createEmptyArrayMap();

  for (const skill of content.skills) {
    for (const groupId of getSkillGroupIds(skill)) {
      appendArrayMapValue(groupSkillIdsByGroupId, groupId, skill.id);
    }
  }

  for (const societyLevel of content.societyLevels) {
    const label = formatSocietyEntryLabel(
      societyLevel.societyName,
      societyLevel.societyLevel,
      societyLevel.socialClass
    );

    for (const professionId of societyLevel.professionIds) {
      appendArrayMapValue(societyEntriesByProfessionId, professionId, label);
    }
  }

  function skillHasSpecializationLinks(skillId: string): boolean {
    const skill = skillContext.skillsById.get(skillId);

    if (!skill) {
      return false;
    }

    return (
      skill.allowsSpecializations ||
      Boolean(skill.specializationOfSkillId) ||
      (skillContext.directSpecializationsBySkillId.get(skillId)?.length ?? 0) > 0 ||
      (skillContext.specializationChildIds.get(skillId)?.length ?? 0) > 0
    );
  }

  return {
    ...skillContext,
    groupSkillIdsByGroupId,
    skillHasSpecializationLinks,
    societyEntriesByProfessionId
  };
}

function resolveProfessionGrantPackage(
  content: CanonicalContent,
  professionId: string
) {
  const professionPackage = resolveEffectiveProfessionPackage({
    content,
    subtypeId: professionId
  });
  const grantedSkillGroupIds = uniqueSorted([
    ...professionPackage.core.finalEffectiveGroupIds,
    ...professionPackage.favored.finalEffectiveGroupIds
  ]);
  const groupReachableSkillIds = uniqueSorted([
    ...professionPackage.core.reachableSkillIdsThroughGroups,
    ...professionPackage.favored.reachableSkillIdsThroughGroups
  ]);
  const directSkillIds = uniqueSorted([
    ...professionPackage.core.finalEffectiveSkillIds,
    ...professionPackage.favored.finalEffectiveSkillIds
  ]);
  const reachableSkillIds = uniqueSorted([
    ...professionPackage.core.finalEffectiveReachableSkillIds,
    ...professionPackage.favored.finalEffectiveReachableSkillIds
  ]);

  return {
    directSkillIds,
    grantedSkillGroupIds,
    groupReachableSkillIds,
    reachableSkillIds
  };
}

function buildProfessionMatrixRowsInternal(content: CanonicalContent): Array<
  Omit<ProfessionMatrixRow, "reachBand">
> {
  const professionContext = buildProfessionRelationshipContext(content);

  return [...content.professions]
    .sort((left, right) => left.name.localeCompare(right.name))
    .map((profession) => {
      const { directSkillIds, grantedSkillGroupIds, groupReachableSkillIds, reachableSkillIds } =
        resolveProfessionGrantPackage(content, profession.id);
      const directSkillsById = new Map(
        directSkillIds.map((skillId) => [skillId, professionContext.skillsById.get(skillId)])
      );
      const directlyGrantedSkills = directSkillIds.map((skillId) => {
        const skill = directSkillsById.get(skillId);

        return joinDisplayName(
          skill?.name ?? skillId,
          skill?.category === "secondary" ? "secondary" : "ordinary"
        );
      });
      const duplicateDirectSkills = directSkillIds
        .filter((skillId) => groupReachableSkillIds.includes(skillId))
        .map((skillId) => professionContext.getSkillName(skillId));
      const directSkillExceptions = directSkillIds
        .filter((skillId) => !groupReachableSkillIds.includes(skillId))
        .map((skillId) => professionContext.getSkillName(skillId));
      const reachableSkills = reachableSkillIds.map((skillId) => professionContext.getSkillName(skillId));
      const reachableSecondarySkills = reachableSkillIds
        .filter((skillId) => professionContext.skillsById.get(skillId)?.category === "secondary")
        .map((skillId) => professionContext.getSkillName(skillId));
      const reachableSpecializationLinkedSkills = reachableSkillIds
        .filter((skillId) => professionContext.skillHasSpecializationLinks(skillId))
        .map((skillId) => professionContext.getSkillName(skillId));

      return {
        allowedSocietyEntries: uniqueSorted(
          professionContext.societyEntriesByProfessionId.get(profession.id) ?? []
        ),
        description: profession.description ?? "",
        directSkillExceptions: uniqueSorted(directSkillExceptions),
        directSkillOverrideCount: directSkillExceptions.length,
        directlyGrantedSkills: uniqueSorted(directlyGrantedSkills),
        duplicateDirectSkills: uniqueSorted(duplicateDirectSkills),
        grantedSkillGroups: uniqueSorted(
          grantedSkillGroupIds.map(
            (groupId) => professionContext.skillGroupsById.get(groupId)?.name ?? groupId
          )
        ),
        hasDirectSkillExceptions: directSkillExceptions.length > 0,
        id: profession.id,
        name: profession.name,
        notes: "",
        reachableGroupSkills: uniqueSorted(
          groupReachableSkillIds.map((skillId) => professionContext.getSkillName(skillId))
        ),
        reachableSecondarySkills: uniqueSorted(reachableSecondarySkills),
        reachableSkills: uniqueSorted(reachableSkills),
        reachableSpecializationLinkedSkills: uniqueSorted(reachableSpecializationLinkedSkills),
        totalReachableSkills: reachableSkillIds.length
      };
    });
}

function applyProfessionReachBands(
  rows: Array<Omit<ProfessionMatrixRow, "reachBand">>
): ProfessionMatrixRow[] {
  const averageReach =
    rows.length === 0 ? 0 : rows.reduce((sum, row) => sum + row.totalReachableSkills, 0) / rows.length;
  const narrowThreshold = Math.max(1, Math.floor(averageReach / 2));
  const broadThreshold = Math.max(4, Math.ceil(averageReach * 1.5));

  return rows.map((row) => ({
    ...row,
    reachBand:
      row.totalReachableSkills <= narrowThreshold
        ? "narrow"
        : row.totalReachableSkills >= broadThreshold
          ? "broad"
          : "medium"
  }));
}

export function buildProfessionMatrixRows(content: CanonicalContent): ProfessionMatrixRow[] {
  return applyProfessionReachBands(buildProfessionMatrixRowsInternal(content));
}

export function buildProfessionAuditIssues(content: CanonicalContent): ProfessionAuditIssue[] {
  const professionRows = buildProfessionMatrixRows(content);
  const issues: ProfessionAuditIssue[] = [];

  for (const profession of professionRows) {
    if (profession.grantedSkillGroups.length === 0 && profession.directlyGrantedSkills.length === 0) {
      issues.push({
        category: "No grants",
        detail: "This profession grants neither skill groups nor direct skills.",
        id: `no-grants:${profession.id}`,
        relatedEntries: [],
        severity: "blocking",
        professionId: profession.id,
        professionName: profession.name
      });
    }

    if (profession.duplicateDirectSkills.length > 0) {
      issues.push({
        category: "Duplicate direct skills",
        detail: "These direct skill grants are already reachable through granted groups.",
        id: `duplicate-direct-skills:${profession.id}`,
        relatedEntries: profession.duplicateDirectSkills,
        severity: "warning",
        professionId: profession.id,
        professionName: profession.name
      });
    }

    if (profession.reachBand === "broad") {
      issues.push({
        category: "Broad skill reach",
        detail: `This profession reaches ${profession.totalReachableSkills} skills, which is broad relative to the current profession set.`,
        id: `broad-reach:${profession.id}`,
        relatedEntries: profession.grantedSkillGroups,
        severity: "info",
        professionId: profession.id,
        professionName: profession.name
      });
    }

    if (profession.reachBand === "narrow") {
      issues.push({
        category: "Narrow skill reach",
        detail: `This profession reaches only ${profession.totalReachableSkills} skill${profession.totalReachableSkills === 1 ? "" : "s"}.`,
        id: `narrow-reach:${profession.id}`,
        relatedEntries: profession.grantedSkillGroups,
        severity: "info",
        professionId: profession.id,
        professionName: profession.name
      });
    }

    if (!profession.description.trim()) {
      issues.push({
        category: "Missing description",
        detail: "Add profession description text so downstream society and chargen views can explain this package clearly.",
        id: `missing-description:${profession.id}`,
        relatedEntries: [],
        severity: "info",
        professionId: profession.id,
        professionName: profession.name
      });
    }

    if (profession.allowedSocietyEntries.length === 0) {
      issues.push({
        category: "Missing society access",
        detail: "This profession is not currently available from any society/class row.",
        id: `missing-society-access:${profession.id}`,
        relatedEntries: [],
        severity: "warning",
        professionId: profession.id,
        professionName: profession.name
      });
    }
  }

  return issues.sort(
    (left, right) =>
      getAuditSeverityRank(left.severity) - getAuditSeverityRank(right.severity) ||
      left.category.localeCompare(right.category) ||
      left.professionName.localeCompare(right.professionName)
  );
}

function buildSocietyMatrixRowsInternal(content: CanonicalContent): Array<
  Omit<SocietyMatrixRow, "reachBand">
> {
  const societySkillContext = buildSkillRelationshipContext(content);
  const professionContext = buildProfessionRelationshipContext(content);
  const { professionsById, skillGroupsById, societiesById } = buildSkillMaps(content);

  return [...content.societyLevels]
    .sort(
      (left, right) =>
        left.societyName.localeCompare(right.societyName) ||
        left.societyLevel - right.societyLevel
    )
    .map((societyLevel) => {
      const reachableProfessionIds = uniqueSorted(societyLevel.professionIds);
      const professionDerivedSkillIds = uniqueSorted(
        reachableProfessionIds.flatMap(
          (professionId) => resolveProfessionGrantPackage(content, professionId).reachableSkillIds
        )
      );
      const directSkillGroupIds = uniqueSorted(societyLevel.skillGroupIds);
      const directGroupSkillIds = uniqueSorted(
        directSkillGroupIds.flatMap(
          (groupId) => professionContext.groupSkillIdsByGroupId.get(groupId) ?? []
        )
      );
      const directSkillIds = uniqueSorted(societyLevel.skillIds);
      const directAddedSkillIds = uniqueSorted([...directGroupSkillIds, ...directSkillIds]);
      const totalEffectiveSkillIds = uniqueSorted([
        ...professionDerivedSkillIds,
        ...directAddedSkillIds
      ]);
      const directOnlySkillIds = totalEffectiveSkillIds.filter(
        (skillId) => !professionDerivedSkillIds.includes(skillId)
      );

      return {
        baseEducation:
          societyLevel.baseEducation === undefined ? "" : String(societyLevel.baseEducation),
        directGroupOverrideCount: directSkillGroupIds.length,
        directOnlySkills: uniqueSorted(
          directOnlySkillIds.map((skillId) => societySkillContext.getSkillName(skillId))
        ),
        directSkillGroups: uniqueSorted(
          directSkillGroupIds.map((groupId) => skillGroupsById.get(groupId)?.name ?? groupId)
        ),
        directSkillOverrideCount: directSkillIds.length,
        directSkills: uniqueSorted(
          directSkillIds.map((skillId) => societySkillContext.getSkillName(skillId))
        ),
        dieRange: getDieRange(societyLevel.societyLevel),
        effectiveProfessionSkills: uniqueSorted(
          professionDerivedSkillIds.map((skillId) => societySkillContext.getSkillName(skillId))
        ),
        hasDirectOverrides: directSkillGroupIds.length > 0 || directSkillIds.length > 0,
        id: `${societyLevel.societyId}:${societyLevel.societyLevel}`,
        notes: societyLevel.notes ?? "",
        professionDerivedReachCount: professionDerivedSkillIds.length,
        reachableProfessions: uniqueSorted(
          reachableProfessionIds.map(
            (professionId) => professionsById.get(professionId)?.name ?? professionId
          )
        ),
        society: societiesById.get(societyLevel.societyId) ?? societyLevel.societyId,
        societyClassName: societyLevel.socialClass,
        societyLevel: societyLevel.societyLevel,
        totalEffectiveReachableSkills: totalEffectiveSkillIds.length
      };
    });
}

function applySocietyReachBands(
  rows: Array<Omit<SocietyMatrixRow, "reachBand">>
): SocietyMatrixRow[] {
  const averageReach =
    rows.length === 0
      ? 0
      : rows.reduce((sum, row) => sum + row.totalEffectiveReachableSkills, 0) / rows.length;
  const narrowThreshold = Math.max(1, Math.floor(averageReach / 2));
  const broadThreshold = Math.max(4, Math.ceil(averageReach * 1.5));

  return rows.map((row) => ({
    ...row,
    reachBand:
      row.totalEffectiveReachableSkills <= narrowThreshold
        ? "narrow"
        : row.totalEffectiveReachableSkills >= broadThreshold
          ? "broad"
          : "medium"
  }));
}

export function buildSocietyMatrixRows(content: CanonicalContent): SocietyMatrixRow[] {
  return applySocietyReachBands(buildSocietyMatrixRowsInternal(content));
}

export function buildSocietyAuditIssues(content: CanonicalContent): SocietyAuditIssue[] {
  const rows = buildSocietyMatrixRows(content);
  const professionContext = buildProfessionRelationshipContext(content);
  const { professionsById, skillGroupsById } = buildSkillMaps(content);
  const issues: SocietyAuditIssue[] = [];

  for (const row of rows) {
    const societyLevel = content.societyLevels.find(
      (candidate) => `${candidate.societyId}:${candidate.societyLevel}` === row.id
    );

    if (!societyLevel) {
      continue;
    }

    const reachableProfessionIds = uniqueSorted(societyLevel.professionIds);
    const professionDerivedSkillIds = uniqueSorted(
      reachableProfessionIds.flatMap(
        (professionId) => resolveProfessionGrantPackage(content, professionId).reachableSkillIds
      )
    );
    const duplicateDirectSkillNames = uniqueSorted(
      societyLevel.skillIds
        .filter((skillId) => professionDerivedSkillIds.includes(skillId))
        .map((skillId) => professionContext.getSkillName(skillId))
    );
    const duplicateDirectGroupNames = uniqueSorted(
      societyLevel.skillGroupIds
        .filter((groupId) => {
          const groupSkillIds = professionContext.groupSkillIdsByGroupId.get(groupId) ?? [];
          return (
            groupSkillIds.length > 0 &&
            groupSkillIds.every((skillId) => professionDerivedSkillIds.includes(skillId))
          );
        })
        .map((groupId) => skillGroupsById.get(groupId)?.name ?? groupId)
    );

    if (reachableProfessionIds.length === 0 && societyLevel.skillGroupIds.length === 0 && societyLevel.skillIds.length === 0) {
      issues.push({
        category: "No access grants",
        detail: "This society row grants no professions, no direct groups, and no direct skills.",
        id: `no-access:${row.id}`,
        relatedEntries: [],
        severity: "blocking",
        societyRowId: row.id,
        societyRowName: `${row.society} L${row.societyLevel} - ${row.societyClassName}`
      });
    }

    if (duplicateDirectSkillNames.length > 0) {
      issues.push({
        category: "Duplicate direct skills",
        detail: "These direct society skills are already reachable through this row's professions.",
        id: `duplicate-direct-skills:${row.id}`,
        relatedEntries: duplicateDirectSkillNames,
        severity: "warning",
        societyRowId: row.id,
        societyRowName: `${row.society} L${row.societyLevel} - ${row.societyClassName}`
      });
    }

    if (duplicateDirectGroupNames.length > 0) {
      issues.push({
        category: "Duplicate direct groups",
        detail: "These direct society skill groups are already fully covered by profession-derived reach.",
        id: `duplicate-direct-groups:${row.id}`,
        relatedEntries: duplicateDirectGroupNames,
        severity: "warning",
        societyRowId: row.id,
        societyRowName: `${row.society} L${row.societyLevel} - ${row.societyClassName}`
      });
    }

    if (row.reachBand === "broad") {
      issues.push({
        category: "Broad total reach",
        detail: `This row reaches ${row.totalEffectiveReachableSkills} skills, which is broad relative to the current society set.`,
        id: `broad-reach:${row.id}`,
        relatedEntries: row.reachableProfessions,
        severity: "info",
        societyRowId: row.id,
        societyRowName: `${row.society} L${row.societyLevel} - ${row.societyClassName}`
      });
    }

    if (row.reachBand === "narrow") {
      issues.push({
        category: "Narrow total reach",
        detail: `This row reaches only ${row.totalEffectiveReachableSkills} skill${row.totalEffectiveReachableSkills === 1 ? "" : "s"}.`,
        id: `narrow-reach:${row.id}`,
        relatedEntries: row.reachableProfessions,
        severity: "info",
        societyRowId: row.id,
        societyRowName: `${row.society} L${row.societyLevel} - ${row.societyClassName}`
      });
    }

    if (!row.baseEducation && row.totalEffectiveReachableSkills >= 6) {
      issues.push({
        category: "Education metadata mismatch",
        detail: "This row has broad reach but no base education value set.",
        id: `missing-education:${row.id}`,
        relatedEntries: [],
        severity: "warning",
        societyRowId: row.id,
        societyRowName: `${row.society} L${row.societyLevel} - ${row.societyClassName}`
      });
    }
  }

  const rowsBySociety = new Map<string, SocietyMatrixRow[]>();

  for (const row of rows) {
    const existing = rowsBySociety.get(row.society);

    if (existing) {
      existing.push(row);
      continue;
    }

    rowsBySociety.set(row.society, [row]);
  }

  for (const [societyName, societyRows] of rowsBySociety) {
    const sortedRows = societyRows
      .slice()
      .sort((left, right) => left.societyLevel - right.societyLevel);

    for (let index = 1; index < sortedRows.length; index += 1) {
      const previous = sortedRows[index - 1];
      const current = sortedRows[index];
      const previousLevel = content.societyLevels.find((row) => `${row.societyId}:${row.societyLevel}` === previous.id);
      const currentLevel = content.societyLevels.find((row) => `${row.societyId}:${row.societyLevel}` === current.id);

      if (!previousLevel || !currentLevel) {
        continue;
      }

      const missingProfessions = previousLevel.professionIds.filter(
        (professionId) => !currentLevel.professionIds.includes(professionId)
      );

      if (missingProfessions.length > 0) {
        issues.push({
          category: "Inconsistent profession progression",
          detail: `Higher level ${current.societyLevel} removes profession access from lower level ${previous.societyLevel}.`,
          id: `profession-regression:${current.id}`,
          relatedEntries: missingProfessions.map(
            (professionId) => professionsById.get(professionId)?.name ?? professionId
          ),
          severity: "warning",
          societyRowId: current.id,
          societyRowName: `${current.society} L${current.societyLevel} - ${current.societyClassName}`
        });
      }

      const previousEducation = previous.baseEducation.length > 0 ? Number(previous.baseEducation) : undefined;
      const currentEducation = current.baseEducation.length > 0 ? Number(current.baseEducation) : undefined;

      if (
        previousEducation !== undefined &&
        currentEducation !== undefined &&
        currentEducation < previousEducation
      ) {
        issues.push({
          category: "Education regression",
          detail: `Base education drops from ${previousEducation} at level ${previous.societyLevel} to ${currentEducation} at level ${current.societyLevel}.`,
          id: `education-regression:${current.id}`,
          relatedEntries: [societyName],
          severity: "warning",
          societyRowId: current.id,
          societyRowName: `${current.society} L${current.societyLevel} - ${current.societyClassName}`
        });
      }

      if (current.totalEffectiveReachableSkills < previous.totalEffectiveReachableSkills) {
        issues.push({
          category: "Reach regression",
          detail: `Higher level ${current.societyLevel} has narrower total reach (${current.totalEffectiveReachableSkills}) than level ${previous.societyLevel} (${previous.totalEffectiveReachableSkills}).`,
          id: `reach-regression:${current.id}`,
          relatedEntries: [societyName],
          severity: "warning",
          societyRowId: current.id,
          societyRowName: `${current.society} L${current.societyLevel} - ${current.societyClassName}`
        });
      }
    }
  }

  return issues.sort(
    (left, right) =>
      getAuditSeverityRank(left.severity) - getAuditSeverityRank(right.severity) ||
      left.category.localeCompare(right.category) ||
      left.societyRowName.localeCompare(right.societyRowName)
  );
}

export function buildSkillGroupAdminRows(content: CanonicalContent): SkillGroupAdminRow[] {
  const warningsByGroupId = new Map<string, string[]>();

  for (const warning of collectCanonicalContentWarnings(content)) {
    const match = warning.detail.match(/\(([^)]+)\)/);

    if (!match) {
      continue;
    }

    const existing = warningsByGroupId.get(match[1]) ?? [];
    existing.push(warning.detail);
    warningsByGroupId.set(match[1], existing);
  }

  return [...content.skillGroups]
    .sort((left, right) => left.name.localeCompare(right.name) || left.sortOrder - right.sortOrder)
    .map((group) => {
      const associatedProfessionLinks = content.professionSkills
        .filter((professionSkill) => professionSkill.skillGroupId === group.id)
        .map((professionSkill) => {
          const profession = content.professions.find(
            (candidate) => candidate.id === professionSkill.professionId
          );

          if (!profession) {
            return undefined;
          }

          return {
            familyId: profession.familyId,
            familyName: getProfessionFamilyName(content, profession.familyId),
            professionId: profession.id,
            professionName: profession.name
          };
        })
        .filter((entry): entry is NonNullable<typeof entry> => Boolean(entry))
        .sort(
          (left, right) =>
            left.familyName.localeCompare(right.familyName) ||
            left.professionName.localeCompare(right.professionName)
        );
      const memberships = getGroupMemberships(content, group.id);
      const fixedSkillRows = memberships
        .map((membership) => {
          const skill = content.skills.find((candidate) => candidate.id === membership.skillId);

          if (!skill) {
            return undefined;
          }

          return {
            name: skill.name,
            points: getWeightedSkillPoints(skill),
            relevance: membership.relevance,
            sortOrder: skill.sortOrder
          };
        })
        .filter((entry): entry is NonNullable<typeof entry> => Boolean(entry))
        .sort((left, right) => left.sortOrder - right.sortOrder || left.name.localeCompare(right.name));
      const fixedSkillNames = fixedSkillRows.map((skill) => skill.name);
      const coreSkills = fixedSkillRows
        .filter((skill) => skill.relevance === "core")
        .map((skill) => skill.name);
      const optionalSkills = fixedSkillRows
        .filter((skill) => skill.relevance === "optional")
        .sort((left, right) => left.sortOrder - right.sortOrder || left.name.localeCompare(right.name))
        .map((skill) => skill.name);
      const selectionSlots = (group.selectionSlots ?? []).map((slot) => ({
        candidateSkills: slot.candidateSkillIds
          .map((skillId) => content.skills.find((candidate) => candidate.id === skillId)?.name)
          .filter((name): name is string => Boolean(name))
          .sort((left, right) => left.localeCompare(right)),
        chooseCount: slot.chooseCount,
        id: slot.id,
        label: slot.label,
        required: slot.required
      }));
      const allowedProfessions = content.professionSkills
        .filter((professionSkill) => professionSkill.skillGroupId === group.id)
        .map((professionSkill) => {
          const profession = content.professions.find(
            (candidate) => candidate.id === professionSkill.professionId
          );

          return profession?.name;
        })
        .filter((name): name is string => Boolean(name))
        .sort((left, right) => left.localeCompare(right));

      const weightedContentPoints = fixedSkillRows.reduce((sum, skill) => sum + skill.points, 0);
      const warningDetails = [...(warningsByGroupId.get(group.id) ?? [])];

      if (weightedContentPoints <= LOW_WEIGHTED_GROUP_POINTS_THRESHOLD) {
        warningDetails.push(
          `Weighted content points are ${weightedContentPoints}, which is at or below the low-size review threshold (${LOW_WEIGHTED_GROUP_POINTS_THRESHOLD}).`
        );
      }

      if (weightedContentPoints >= HIGH_WEIGHTED_GROUP_POINTS_THRESHOLD) {
        warningDetails.push(
          `Weighted content points are ${weightedContentPoints}, which is at or above the high-size review threshold (${HIGH_WEIGHTED_GROUP_POINTS_THRESHOLD}).`
        );
      }

      return {
        allowedProfessions: uniqueSorted(allowedProfessions),
        associatedProfessionLinks,
        coreSkills,
        fixedSkills: fixedSkillRows.map((skill) => ({
          name: skill.name,
          relevance: skill.relevance
        })),
        fixedSkillNames,
        id: group.id,
        includedSkills: fixedSkillNames,
        name: group.name,
        notes: group.description ?? "",
        optionalSkills,
        selectionSlotCount: selectionSlots.length,
        selectionSlots,
        sortOrder: group.sortOrder,
        visibleProfessionFamilyIds: uniqueSorted(
          associatedProfessionLinks.map((link) => link.familyId)
        ),
        warningDetails: uniqueSorted(warningDetails),
        weightedContentPoints
      };
    });
}

export function buildProfessionAdminRows(content: CanonicalContent): ProfessionAdminRow[] {
  const familiesById = new Map(
    content.professionFamilies.map((family) => [family.id, family.name])
  );
  const professionsById = new Map(
    content.professions.map((profession) => [profession.id, profession])
  );
  const societiesById = new Map(
    content.societies.map((society) => [society.id, society])
  );

  return buildProfessionMatrixRows(content).map((profession) => {
    const groupGrants = content.professionSkills
      .filter(
        (professionSkill) =>
          professionSkill.professionId === profession.id &&
          professionSkill.grantType === "group" &&
          professionSkill.skillGroupId
      )
      .map((professionSkill) => {
        const group = content.skillGroups.find(
          (candidate) => candidate.id === professionSkill.skillGroupId
        );
        const memberships = professionSkill.skillGroupId
          ? getGroupMemberships(content, professionSkill.skillGroupId)
          : [];
        const membershipRows = memberships
          .map((membership) => {
            const skill = content.skills.find((candidate) => candidate.id === membership.skillId);

            if (!skill) {
              return undefined;
            }

            return {
              name: skill.name,
              points: getWeightedSkillPoints(skill),
              relevance: membership.relevance,
              sortOrder: skill.sortOrder
            };
          })
          .filter((entry): entry is NonNullable<typeof entry> => Boolean(entry))
          .sort((left, right) => left.sortOrder - right.sortOrder || left.name.localeCompare(right.name));

        return {
          coreSkills: membershipRows
            .filter((membership) => membership.relevance === "core")
            .map((membership) => membership.name),
          isCore: professionSkill.isCore,
          name: group?.name ?? professionSkill.skillGroupId ?? "",
          optionalSkills: membershipRows
            .filter((membership) => membership.relevance === "optional")
            .map((membership) => membership.name),
          relevance: professionSkill.isCore ? ("core" as const) : ("optional" as const),
          weightedContentPoints: membershipRows.reduce(
            (sum, membership) => sum + membership.points,
            0
          )
        };
      });
    const professionDefinition = professionsById.get(profession.id);
    const allowedSocietySlots = content.societyLevels
      .filter((societyLevel) => societyLevel.professionIds.includes(profession.id))
      .map((societyLevel) => ({
        accessBand: societyLevel.societyLevel,
        canonicalSocietyLevel: societiesById.get(societyLevel.societyId)?.societyLevel,
        socialClass: societyLevel.socialClass,
        societyName: societyLevel.societyName
      }))
      .sort(
        (left, right) =>
          (left.canonicalSocietyLevel ?? 99) - (right.canonicalSocietyLevel ?? 99) ||
          left.societyName.localeCompare(right.societyName) ||
          left.accessBand - right.accessBand ||
          left.socialClass.localeCompare(right.socialClass)
      );

    return {
      allowedSocietyEntries: profession.allowedSocietyEntries,
      allowedSocietySlots,
      coreSkillGroups: uniqueSorted(
        groupGrants.filter((grant) => grant.isCore).map((grant) => grant.name)
      ),
      description: profession.description,
      directSkillExceptions: profession.directSkillExceptions,
      directlyGrantedSkills: profession.directlyGrantedSkills,
      familyId: professionDefinition?.familyId ?? "",
      familyName: professionDefinition
        ? familiesById.get(professionDefinition.familyId) ?? professionDefinition.familyId
        : "",
      groupFans: groupGrants
        .map((grant) => ({
          coreSkills: grant.coreSkills,
          groupName: grant.name,
          optionalSkills: grant.optionalSkills,
          relevance: grant.relevance,
          weightedContentPoints: grant.weightedContentPoints
        }))
        .sort(
          (left, right) =>
            (left.relevance === "core" ? 0 : 1) - (right.relevance === "core" ? 0 : 1) ||
            left.groupName.localeCompare(right.groupName)
        ),
      grantedSkillGroups: profession.grantedSkillGroups,
      id: profession.id,
      name: profession.name,
      notes: profession.notes,
      optionalSkillGroups: uniqueSorted(
        groupGrants.filter((grant) => !grant.isCore).map((grant) => grant.name)
      ),
      reachableGroupSkills: profession.reachableGroupSkills,
      totalReachableSkills: profession.totalReachableSkills
    };
  });
}

export function buildSocietyAdminRows(content: CanonicalContent): SocietyAdminRow[] {
  return buildSocietyMatrixRows(content)
    .map((societyRow) => {
    const society = content.societies.find((candidate) => candidate.id === societyRow.id.split(":")[0]);
    const literacyAccessSummary = summarizeAccessBands(
      content.societyBandSkillAccess
        .filter(
          (entry) => entry.societyId === societyRow.id.split(":")[0] && entry.skillId === "literacy"
        )
        .map((entry) => entry.socialBand)
    );
    const baselineLanguages = (society?.baselineLanguageIds ?? [])
      .map((languageId) => content.languages.find((candidate) => candidate.id === languageId)?.name ?? languageId);
    const professionFans = societyRow.reachableProfessions.map((professionName) => {
      const profession = content.professions.find((candidate) => candidate.name === professionName);

      if (!profession) {
        return {
          coreGroups: [],
          optionalGroups: [],
          professionName,
          reachableSkills: []
        };
      }

      const grants = content.professionSkills.filter(
        (candidate) =>
          candidate.professionId === profession.id &&
          candidate.grantType === "group" &&
          candidate.skillGroupId
      );
      const mapGroup = (skillGroupId: string) => {
        const group = content.skillGroups.find((candidate) => candidate.id === skillGroupId);
        const memberships =
          group?.skillMemberships?.length
            ? group.skillMemberships
            : content.skills
                .filter((skill) => getSkillGroupIds(skill).includes(skillGroupId))
                .map((skill) => ({
                  relevance: skill.groupId === skillGroupId ? ("core" as const) : ("optional" as const),
                  skillId: skill.id
                }));

        return {
          coreSkills: memberships
            .filter((membership) => membership.relevance === "core")
            .map((membership) => content.skills.find((skill) => skill.id === membership.skillId)?.name ?? membership.skillId),
          groupName: group?.name ?? skillGroupId,
          optionalSkills: memberships
            .filter((membership) => membership.relevance === "optional")
            .map((membership) => content.skills.find((skill) => skill.id === membership.skillId)?.name ?? membership.skillId)
        };
      };
      const resolvedPackage = resolveProfessionGrantPackage(content, profession.id);

      return {
        coreGroups: grants
          .filter((grant) => grant.isCore && grant.skillGroupId)
          .map((grant) => mapGroup(grant.skillGroupId ?? "")),
        optionalGroups: grants
          .filter((grant) => !grant.isCore && grant.skillGroupId)
          .map((grant) => mapGroup(grant.skillGroupId ?? "")),
        professionName,
        reachableSkills: uniqueSorted(
          resolvedPackage.reachableSkillIds.map(
            (skillId) => content.skills.find((skill) => skill.id === skillId)?.name ?? skillId
          )
        )
      };
    });

    return {
      baseEducation: societyRow.baseEducation,
      baselineLanguages,
      canonicalSocietyLevel: society?.societyLevel,
      directOnlySkills: societyRow.directOnlySkills,
      directSkillGroups: societyRow.directSkillGroups,
      directSkills: societyRow.directSkills,
      dieRange: societyRow.dieRange,
      effectiveProfessionSkills: societyRow.effectiveProfessionSkills,
      glantriExamples: society?.glantriExamples,
      historicalReference: society?.historicalReference,
      id: societyRow.id,
      literacyAccessSummary,
      notes: societyRow.notes,
      professionFans,
      reachableProfessions: societyRow.reachableProfessions,
      shortDescription: society?.shortDescription ?? "",
      society: societyRow.society,
      societyClassName: societyRow.societyClassName,
      societyLevel: societyRow.societyLevel,
      totalEffectiveReachableSkills: societyRow.totalEffectiveReachableSkills
    };
  })
    .sort(
      (left, right) =>
        left.society.localeCompare(right.society) ||
        (left.canonicalSocietyLevel ?? left.societyLevel) -
          (right.canonicalSocietyLevel ?? right.societyLevel) ||
        left.societyLevel - right.societyLevel
    );
}

export function buildProfessionAccessRows(content: CanonicalContent): ProfessionAccessRow[] {
  const professionRows = buildProfessionAdminRows(content);

  return professionRows.map((profession) => ({
    id: profession.id,
    name: profession.name,
    societyEntries: profession.allowedSocietyEntries,
    skillGroups: profession.grantedSkillGroups,
    skills: uniqueSorted(
      profession.reachableGroupSkills.concat(profession.directlyGrantedSkills)
    )
  }));
}

export function buildSocietyAccessRows(content: CanonicalContent): SocietyAccessRow[] {
  return buildSocietyAdminRows(content).map((societyRow) => ({
    id: societyRow.id,
    professions: societyRow.reachableProfessions,
    skillGroups: societyRow.directSkillGroups,
    skills: uniqueSorted(
      societyRow.effectiveProfessionSkills.concat(societyRow.directOnlySkills)
    ),
    societyEntry: formatSocietyEntryLabel(
      societyRow.society,
      societyRow.societyLevel,
      societyRow.societyClassName
    )
  }));
}
