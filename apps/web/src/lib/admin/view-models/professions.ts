import { type CanonicalContent } from "@glantri/content";

import type { AuditSeverity } from "./audit";
import {
  uniqueSorted,
  getWeightedSkillPoints,
  getGroupMemberships,
  summarizeSocietyStages,
  getAuditSeverityRank,
  buildProfessionMatrixRowsInternal,
  applyProfessionReachBands,
  resolveProfessionGrantPackage
} from "./_helpers";

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
  societyStageLevels: number[];
  societyStageSummary: string;
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
    const societyStageLevels = [
      ...new Set(
        allowedSocietySlots
          .map((slot) => slot.canonicalSocietyLevel)
          .filter((level): level is number => typeof level === "number")
      )
    ].sort((left, right) => left - right);

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
      societyStageLevels,
      societyStageSummary: summarizeSocietyStages(societyStageLevels),
      totalReachableSkills: profession.totalReachableSkills
    };
  });
}

export function filterProfessionAdminRowsBySocietyStage(
  rows: ProfessionAdminRow[],
  societyStage: "all" | number | string
): ProfessionAdminRow[] {
  if (societyStage === "all") {
    return rows;
  }

  const parsedSocietyStage =
    typeof societyStage === "number" ? societyStage : Number(societyStage);

  if (!Number.isInteger(parsedSocietyStage)) {
    return rows;
  }

  return rows.filter((row) => row.societyStageLevels.includes(parsedSocietyStage));
}
