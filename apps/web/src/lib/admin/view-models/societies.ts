import { type CanonicalContent } from "@glantri/content";
import { getSkillGroupIds } from "@glantri/domain";

import type { AuditSeverity } from "./audit";
import {
  uniqueSorted,
  summarizeAccessBands,
  getAuditSeverityRank,
  buildSkillMaps,
  buildProfessionRelationshipContext,
  buildSocietyMatrixRowsInternal,
  applySocietyReachBands,
  resolveProfessionGrantPackage
} from "./_helpers";

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
