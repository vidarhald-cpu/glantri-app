import { collectCanonicalContentWarnings, type CanonicalContent } from "@glantri/content";
import {
  getPlayerFacingSkillCategoryId,
  getSkillGroupIds,
  type SkillDefinition
} from "@glantri/domain";
import { getMeleeCrossTrainingFactor } from "@glantri/rules-engine";

import type { AuditSeverity } from "./audit";
import {
  uniqueSorted,
  formatCharacteristicList,
  summarizeAccessBands,
  getAuditSeverityRank,
  buildSkillMaps,
  buildSkillRelationshipContext,
  resolveProfessionGrantPackage,
  getWeightedSkillPoints,
  getGroupMemberships
} from "./_helpers";
import { getProfessionFamilyName } from "./professions";

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

const LOW_WEIGHTED_GROUP_POINTS_THRESHOLD = 5;
const HIGH_WEIGHTED_GROUP_POINTS_THRESHOLD = 12;

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
