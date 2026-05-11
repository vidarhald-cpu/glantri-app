import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import {
  collectCanonicalContentWarnings,
  defaultCanonicalContent,
  type CanonicalContent
} from "@glantri/content";
import {
  getPlayerFacingSkillCategoryId,
  getSkillGroupIds,
  type SkillDefinition,
  type SkillGroupDefinition
} from "@glantri/domain";
import { resolveEffectiveProfessionPackage } from "../../rules-engine/src/professions/resolveEffectiveProfessionPackage";
import { getMeleeCrossTrainingFactor } from "../../rules-engine/src/skills/deriveSkillRelationships";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "../../..");
const defaultOutputDir = path.join(repoRoot, "exports/skill-system-ai");

const EXPORT_VERSION = "2026-05-11.1";
const EXPORT_WARNING =
  "AI review/modeling export only. Do not import generated suggestions without canonical validation, stable-ID review, and admin reach audits.";

const ALLOWED_SMALL_GROUP_REASONS: Record<string, string> = {
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

type JsonRecord = Record<string, unknown>;

function byNameThenId<T extends { id: string; name: string }>(left: T, right: T): number {
  return left.name.localeCompare(right.name) || left.id.localeCompare(right.id);
}

function uniqueSorted(values: string[]): string[] {
  return [...new Set(values)].sort((left, right) => left.localeCompare(right));
}

function getGitCommit(): string | null {
  try {
    return execFileSync("git", ["rev-parse", "HEAD"], {
      cwd: repoRoot,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"]
    }).trim();
  } catch {
    return null;
  }
}

function getSkillWeight(skill: SkillDefinition | undefined): number {
  if (!skill) {
    return 0;
  }

  return skill.category === "secondary" ? 1 : 2;
}

function getGroupMemberships(
  content: CanonicalContent,
  group: SkillGroupDefinition
): NonNullable<SkillGroupDefinition["skillMemberships"]> {
  if (group.skillMemberships?.length) {
    return [...group.skillMemberships].sort((left, right) => {
      const leftSkill = content.skills.find((skill) => skill.id === left.skillId);
      const rightSkill = content.skills.find((skill) => skill.id === right.skillId);
      return (
        (leftSkill?.sortOrder ?? 0) - (rightSkill?.sortOrder ?? 0) ||
        (leftSkill?.name ?? left.skillId).localeCompare(rightSkill?.name ?? right.skillId)
      );
    });
  }

  return content.skills
    .filter((skill) => getSkillGroupIds(skill).includes(group.id))
    .map((skill) => ({
      relevance: skill.groupId === group.id ? ("core" as const) : ("optional" as const),
      skillId: skill.id
    }))
    .sort((left, right) => {
      const leftSkill = content.skills.find((skill) => skill.id === left.skillId);
      const rightSkill = content.skills.find((skill) => skill.id === right.skillId);
      return (
        (leftSkill?.sortOrder ?? 0) - (rightSkill?.sortOrder ?? 0) ||
        (leftSkill?.name ?? left.skillId).localeCompare(rightSkill?.name ?? right.skillId)
      );
    });
}

function getSkillName(content: CanonicalContent, skillId: string): string {
  return content.skills.find((skill) => skill.id === skillId)?.name ?? skillId;
}

function getGroupName(content: CanonicalContent, groupId: string): string {
  return content.skillGroups.find((group) => group.id === groupId)?.name ?? groupId;
}

function getProfessionName(content: CanonicalContent, professionId: string): string {
  return content.professions.find((profession) => profession.id === professionId)?.name ?? professionId;
}

function getFamilyName(content: CanonicalContent, familyId: string): string {
  return content.professionFamilies.find((family) => family.id === familyId)?.name ?? familyId;
}

function getSocietyName(content: CanonicalContent, societyId: string): string {
  return content.societies.find((society) => society.id === societyId)?.name ?? societyId;
}

function dynamicGroupCost(individualCostTotal: number): number {
  return Math.max(1, Math.floor(0.6 * individualCostTotal));
}

function buildGroupWarningMap(content: CanonicalContent): Map<string, string[]> {
  const warningsByGroupId = new Map<string, string[]>();

  for (const warning of collectCanonicalContentWarnings(content)) {
    const match = warning.detail.match(/\(([^)]+)\)/);

    if (!match) {
      continue;
    }

    warningsByGroupId.set(match[1], [
      ...(warningsByGroupId.get(match[1]) ?? []),
      warning.detail
    ]);
  }

  for (const group of content.skillGroups) {
    const memberships = getGroupMemberships(content, group);
    const weightedContentPoints = memberships.reduce(
      (total, membership) =>
        total + getSkillWeight(content.skills.find((skill) => skill.id === membership.skillId)),
      0
    );
    const warnings = warningsByGroupId.get(group.id) ?? [];

    if (weightedContentPoints <= 5) {
      warnings.push(
        `Weighted content points are ${weightedContentPoints}, which is at or below the low-size review threshold (5).`
      );
    }

    if (weightedContentPoints >= 12) {
      warnings.push(
        `Weighted content points are ${weightedContentPoints}, which is at or above the high-size review threshold (12).`
      );
    }

    if (warnings.length > 0) {
      warningsByGroupId.set(group.id, uniqueSorted(warnings));
    }
  }

  return warningsByGroupId;
}

function mapSkill(content: CanonicalContent, skill: SkillDefinition): JsonRecord {
  const groupIds = getSkillGroupIds(skill);
  const adminWarnings: string[] = [];

  if (skill.id === "longbow" && skill.specializationOfSkillId === "bow") {
    adminWarnings.push("Exports as specialization-only access: Longbow is modeled under Bow, not as a missile slot candidate.");
  }

  return {
    id: skill.id,
    name: skill.name,
    category: skill.category,
    playerFacingCategory: getPlayerFacingSkillCategoryId(skill),
    linkedStats: skill.linkedStats,
    description: skill.description ?? skill.shortDescription ?? null,
    shortDescription: skill.shortDescription ?? null,
    groupIds,
    groupNames: groupIds.map((groupId) => getGroupName(content, groupId)),
    primaryGroupId: skill.groupId,
    primaryGroupName: getGroupName(content, skill.groupId),
    allowsSpecializations: skill.allowsSpecializations,
    requiresLiteracy: skill.requiresLiteracy,
    dependencies: skill.dependencies.map((dependency) => ({
      skillId: dependency.skillId,
      skillName: getSkillName(content, dependency.skillId),
      strength: dependency.strength
    })),
    isSpecializationOnly: Boolean(skill.specializationOfSkillId),
    specializationParentId: skill.specializationOfSkillId ?? null,
    specializationParentName: skill.specializationOfSkillId
      ? getSkillName(content, skill.specializationOfSkillId)
      : null,
    societyLevel: skill.societyLevel,
    theoretical: skill.isTheoretical,
    adminNotes: adminWarnings
  };
}

function mapSkillGroup(content: CanonicalContent, group: SkillGroupDefinition, warnings: string[]): JsonRecord {
  const skillsById = new Map(content.skills.map((skill) => [skill.id, skill]));
  const memberships = getGroupMemberships(content, group);
  const fixedSkills = memberships.map((membership) => {
    const skill = skillsById.get(membership.skillId);

    return {
      skillId: membership.skillId,
      skillName: skill?.name ?? membership.skillId,
      relevance: membership.relevance,
      category: skill?.category ?? null
    };
  });
  const selectionSlots = (group.selectionSlots ?? [])
    .map((slot) => ({
      id: slot.id,
      label: slot.label,
      required: slot.required,
      choose: slot.chooseCount,
      count: slot.chooseCount,
      candidateSkillIds: [...slot.candidateSkillIds].sort((left, right) =>
        getSkillName(content, left).localeCompare(getSkillName(content, right))
      ),
      candidateSkills: [...slot.candidateSkillIds]
        .sort((left, right) => getSkillName(content, left).localeCompare(getSkillName(content, right)))
        .map((skillId) => ({
          skillId,
          skillName: getSkillName(content, skillId)
        }))
    }))
    .sort((left, right) => left.label.localeCompare(right.label) || left.id.localeCompare(right.id));
  const allReachableSkillIds = uniqueSorted([
    ...fixedSkills.map((skill) => skill.skillId),
    ...selectionSlots.flatMap((slot) => slot.candidateSkillIds)
  ]);
  const fixedIndividualCostTotal = fixedSkills.reduce(
    (total, fixedSkill) => total + getSkillWeight(skillsById.get(fixedSkill.skillId)),
    0
  );
  const allCandidateIndividualCostTotal = allReachableSkillIds.reduce(
    (total, skillId) => total + getSkillWeight(skillsById.get(skillId)),
    0
  );
  const ordinarySkillCount = allReachableSkillIds.filter(
    (skillId) => skillsById.get(skillId)?.category === "ordinary"
  ).length;
  const secondarySkillCount = allReachableSkillIds.filter(
    (skillId) => skillsById.get(skillId)?.category === "secondary"
  ).length;

  return {
    id: group.id,
    name: group.name,
    category: fixedSkills[0]?.category ?? null,
    description: group.description ?? null,
    fixedSkills,
    selectionSlots,
    allReachableSkillIds,
    allReachableSkills: allReachableSkillIds.map((skillId) => ({
      skillId,
      skillName: getSkillName(content, skillId)
    })),
    weightedValue: allCandidateIndividualCostTotal,
    economics: {
      ordinarySkillCount,
      secondarySkillCount,
      fixedIndividualCostTotal,
      allCandidateIndividualCostTotal,
      dynamicGroupCost:
        selectionSlots.length === 0 ? dynamicGroupCost(fixedIndividualCostTotal) : null,
      note:
        selectionSlots.length === 0
          ? "No active choice slots; dynamic group cost can be computed from fixed skills."
          : "Dynamic group cost depends on active selected slot skills. Unselected slot candidates do not count."
    },
    allowedSmallGroupReason: ALLOWED_SMALL_GROUP_REASONS[group.id] ?? null,
    adminWarnings: warnings
  };
}

function mapSpecialization(content: CanonicalContent, specialization: CanonicalContent["specializations"][number]): JsonRecord {
  return {
    id: specialization.id,
    name: specialization.name,
    parentSkillId: specialization.skillId,
    parentSkillName: getSkillName(content, specialization.skillId),
    minimumParentLevel: specialization.minimumParentLevel,
    minimumGroupLevel: specialization.minimumGroupLevel,
    description: specialization.description ?? null,
    isSelectableAsNormalSkill: false,
    accessNotes: specialization.specializationBridge
      ? {
          parentSkillId: specialization.specializationBridge.parentSkillId,
          parentSkillName: getSkillName(content, specialization.specializationBridge.parentSkillId),
          threshold: specialization.specializationBridge.threshold,
          parentExcessOffset: specialization.specializationBridge.parentExcessOffset,
          reverseFactor: specialization.specializationBridge.reverseFactor
        }
      : null
  };
}

function resolveProfessionPackage(content: CanonicalContent, professionId: string) {
  const resolved = resolveEffectiveProfessionPackage({ content, subtypeId: professionId });

  return {
    coreGroupIds: resolved.core.finalEffectiveGroupIds,
    favoredGroupIds: resolved.favored.finalEffectiveGroupIds,
    groupIds: uniqueSorted([...resolved.core.finalEffectiveGroupIds, ...resolved.favored.finalEffectiveGroupIds]),
    directSkillIds: uniqueSorted([...resolved.core.finalEffectiveSkillIds, ...resolved.favored.finalEffectiveSkillIds]),
    directOnlySkillIds: uniqueSorted([...resolved.core.directOnlySkillIds, ...resolved.favored.directOnlySkillIds]),
    reachableGroupSkillIds: uniqueSorted([
      ...resolved.core.reachableSkillIdsThroughGroups,
      ...resolved.favored.reachableSkillIdsThroughGroups
    ]),
    reachableSkillIds: uniqueSorted([
      ...resolved.core.finalEffectiveReachableSkillIds,
      ...resolved.favored.finalEffectiveReachableSkillIds
    ])
  };
}

function mapProfession(content: CanonicalContent, profession: CanonicalContent["professions"][number]): JsonRecord {
  const pkg = resolveProfessionPackage(content, profession.id);
  const grants = content.professionSkills.filter(
    (grant) => grant.professionId === profession.id || (grant.scope === "family" && grant.professionId === profession.familyId)
  );
  const availability = content.societyLevels
    .filter((row) => row.professionIds.includes(profession.id))
    .map((row) => ({
      societyId: row.societyId,
      societyName: row.societyName,
      societyStage: content.societies.find((society) => society.id === row.societyId)?.societyLevel ?? null,
      classBand: row.societyLevel,
      classLabel: row.socialClass
    }))
    .sort(
      (left, right) =>
        (left.societyStage ?? 99) - (right.societyStage ?? 99) ||
        left.societyName.localeCompare(right.societyName) ||
        left.classBand - right.classBand
    );

  return {
    id: profession.id,
    name: profession.name,
    familyId: profession.familyId,
    familyName: getFamilyName(content, profession.familyId),
    description: profession.description ?? null,
    role: null,
    category: null,
    effectiveGroups: pkg.groupIds.map((groupId) => ({
      groupId,
      groupName: getGroupName(content, groupId)
    })),
    directSkills: pkg.directSkillIds.map((skillId) => ({
      skillId,
      skillName: getSkillName(content, skillId)
    })),
    directSpecializations: grants
      .filter((grant) => grant.specializationId)
      .map((grant) => {
        const specialization = content.specializations.find((candidate) => candidate.id === grant.specializationId);
        return {
          specializationId: grant.specializationId,
          specializationName: specialization?.name ?? grant.specializationId
        };
      }),
    selectionNotes: null,
    reachMetrics: {
      uniqueReach: pkg.reachableSkillIds.length,
      groupReach: pkg.reachableGroupSkillIds.length,
      directOnlyReach: pkg.directOnlySkillIds.length,
      skillIdsReached: pkg.reachableSkillIds
    },
    availability,
    adminWarnings: []
  };
}

function buildAvailability(content: CanonicalContent): JsonRecord[] {
  const civilizationsBySocietyId = new Map<string, CanonicalContent["civilizations"]>();

  for (const civilization of content.civilizations) {
    const existing = civilizationsBySocietyId.get(civilization.linkedSocietyId) ?? [];
    existing.push(civilization);
    civilizationsBySocietyId.set(civilization.linkedSocietyId, existing);
  }

  return content.societyLevels
    .flatMap((row) => {
      const society = content.societies.find((candidate) => candidate.id === row.societyId);
      const civilizations = civilizationsBySocietyId.get(row.societyId) ?? [];
      const civilizationRows = civilizations.length > 0 ? civilizations : [undefined];

      return row.professionIds.flatMap((professionId) =>
        civilizationRows.map((civilization) => ({
          professionId,
          professionName: getProfessionName(content, professionId),
          civilizationId: civilization?.id ?? null,
          civilizationName: civilization?.name ?? null,
          societyId: row.societyId,
          societyName: row.societyName,
          societyStage: society?.societyLevel ?? null,
          classBand: row.societyLevel,
          classLabel: row.socialClass,
          sourceRowId: `${row.societyId}:class-${row.societyLevel}`
        }))
      );
    })
    .sort(
      (left, right) =>
        String(left.professionName).localeCompare(String(right.professionName)) ||
        String(left.civilizationName ?? "").localeCompare(String(right.civilizationName ?? "")) ||
        String(left.societyName).localeCompare(String(right.societyName)) ||
        Number(left.classBand) - Number(right.classBand)
    );
}

function entity(type: string, id: string, name: string): JsonRecord {
  return { type, id, name };
}

function buildRelationships(content: CanonicalContent): JsonRecord[] {
  const relationships: JsonRecord[] = [];

  for (const group of content.skillGroups) {
    for (const membership of getGroupMemberships(content, group)) {
      relationships.push({
        type: "skill_in_group",
        from: entity("skill", membership.skillId, getSkillName(content, membership.skillId)),
        to: entity("skillGroup", group.id, group.name),
        metadata: { relevance: membership.relevance }
      });
    }

    for (const slot of group.selectionSlots ?? []) {
      relationships.push({
        type: "group_has_selection_slot",
        from: entity("skillGroup", group.id, group.name),
        to: entity("selectionSlot", `${group.id}:${slot.id}`, slot.label),
        metadata: { required: slot.required, chooseCount: slot.chooseCount }
      });

      for (const skillId of slot.candidateSkillIds) {
        relationships.push({
          type: "slot_can_select_skill",
          from: entity("selectionSlot", `${group.id}:${slot.id}`, slot.label),
          to: entity("skill", skillId, getSkillName(content, skillId)),
          metadata: {}
        });
      }
    }
  }

  for (const specialization of content.specializations) {
    relationships.push({
      type: "specialization_of_skill",
      from: entity("specialization", specialization.id, specialization.name),
      to: entity("skill", specialization.skillId, getSkillName(content, specialization.skillId)),
      metadata: {
        minimumParentLevel: specialization.minimumParentLevel
      }
    });
  }

  for (const profession of content.professions) {
    const pkg = resolveProfessionPackage(content, profession.id);

    for (const groupId of pkg.groupIds) {
      relationships.push({
        type: "profession_grants_group",
        from: entity("profession", profession.id, profession.name),
        to: entity("skillGroup", groupId, getGroupName(content, groupId)),
        metadata: {}
      });
    }

    for (const skillId of pkg.directSkillIds) {
      relationships.push({
        type: "profession_grants_skill",
        from: entity("profession", profession.id, profession.name),
        to: entity("skill", skillId, getSkillName(content, skillId)),
        metadata: {
          directOnly: pkg.directOnlySkillIds.includes(skillId)
        }
      });
    }
  }

  for (const record of buildAvailability(content)) {
    relationships.push({
      type: "profession_available_in_society_class",
      from: entity("profession", String(record.professionId), String(record.professionName)),
      to: entity(
        "societyClass",
        `${String(record.societyId)}:class-${String(record.classBand)}`,
        `${String(record.societyName)} class ${String(record.classBand)}`
      ),
      metadata: record
    });
  }

  for (const civilization of content.civilizations) {
    relationships.push({
      type: "civilization_uses_society",
      from: entity("civilization", civilization.id, civilization.name),
      to: entity("society", civilization.linkedSocietyId, getSocietyName(content, civilization.linkedSocietyId)),
      metadata: { linkedSocietyLevel: civilization.linkedSocietyLevel }
    });

    for (const languageName of [
      civilization.motherTongueLanguageName,
      civilization.spokenLanguageName,
      civilization.writtenLanguageName,
      ...civilization.optionalLanguageNames
    ].filter((name): name is string => Boolean(name))) {
      relationships.push({
        type: "language_materialized_from_language_choice",
        from: entity("civilization", civilization.id, civilization.name),
        to: entity("language", languageName, languageName),
        metadata: {}
      });
    }
  }

  for (const rule of buildDerivedRules(content)) {
    relationships.push({
      type: "derived_skill_relationship",
      from: rule.source,
      to: rule.target,
      metadata: rule
    });
  }

  return relationships.sort(
    (left, right) =>
      String(left.type).localeCompare(String(right.type)) ||
      String((left.from as JsonRecord).name).localeCompare(String((right.from as JsonRecord).name)) ||
      String((left.to as JsonRecord).name).localeCompare(String((right.to as JsonRecord).name))
  );
}

function buildDerivedRules(content: CanonicalContent): JsonRecord[] {
  const rules: JsonRecord[] = [];

  for (const sourceSkill of content.skills) {
    for (const grant of sourceSkill.derivedGrants ?? []) {
      rules.push({
        source: entity("skill", sourceSkill.id, sourceSkill.name),
        target: entity("skill", grant.skillId, getSkillName(content, grant.skillId)),
        factor: grant.factor,
        threshold: null,
        ruleLabel: "explicit-derived-grant",
        description: `${sourceSkill.name} contributes derived XP to ${getSkillName(content, grant.skillId)} at ${Math.round(grant.factor * 100)}%.`,
        contributesDerivedXp: true,
        notes: null
      });
    }

    for (const targetSkill of content.skills) {
      if (targetSkill.id === sourceSkill.id) {
        continue;
      }

      const factor = getMeleeCrossTrainingFactor({
        source: sourceSkill.meleeCrossTraining,
        target: targetSkill.meleeCrossTraining
      });

      if (factor <= 0) {
        continue;
      }

      rules.push({
        source: entity("skill", sourceSkill.id, sourceSkill.name),
        target: entity("skill", targetSkill.id, targetSkill.name),
        factor,
        threshold: null,
        ruleLabel: "melee-cross-training",
        description: `${sourceSkill.name} cross-trains into ${targetSkill.name} at ${Math.round(factor * 100)}%.`,
        contributesDerivedXp: true,
        notes: "Melee cross-training is computed from attack style and hand class."
      });
    }

    if (sourceSkill.specializationBridge) {
      rules.push({
        source: entity("skill", sourceSkill.specializationBridge.parentSkillId, getSkillName(content, sourceSkill.specializationBridge.parentSkillId)),
        target: entity("skill", sourceSkill.id, sourceSkill.name),
        factor: 1,
        threshold: sourceSkill.specializationBridge.threshold,
        ruleLabel: "specialization-bridge-parent",
        description: `${getSkillName(content, sourceSkill.specializationBridge.parentSkillId)} can bridge into ${sourceSkill.name}.`,
        contributesDerivedXp: true,
        notes: {
          parentExcessOffset: sourceSkill.specializationBridge.parentExcessOffset,
          reverseFactor: sourceSkill.specializationBridge.reverseFactor
        }
      });
    }
  }

  for (const specialization of content.specializations) {
    if (!specialization.specializationBridge) {
      continue;
    }

    rules.push({
      source: entity(
        "skill",
        specialization.specializationBridge.parentSkillId,
        getSkillName(content, specialization.specializationBridge.parentSkillId)
      ),
      target: entity("specialization", specialization.id, specialization.name),
      factor: 1,
      threshold: specialization.specializationBridge.threshold,
      ruleLabel: "specialization-bridge-parent",
      description: `${getSkillName(content, specialization.specializationBridge.parentSkillId)} can bridge into ${specialization.name}.`,
      contributesDerivedXp: true,
      notes: {
        parentExcessOffset: specialization.specializationBridge.parentExcessOffset,
        reverseFactor: specialization.specializationBridge.reverseFactor
      }
    });
  }

  return rules.sort(
    (left, right) =>
      String((left.source as JsonRecord).name).localeCompare(String((right.source as JsonRecord).name)) ||
      String((left.target as JsonRecord).name).localeCompare(String((right.target as JsonRecord).name)) ||
      String(left.ruleLabel).localeCompare(String(right.ruleLabel))
  );
}

function buildAdminMetrics(content: CanonicalContent) {
  const groupWarnings = buildGroupWarningMap(content);
  const warningRows = collectCanonicalContentWarnings(content).map((warning) => ({
    code: warning.code,
    detail: warning.detail
  }));

  return {
    professionReach: content.professions
      .map((profession) => {
        const pkg = resolveProfessionPackage(content, profession.id);

        return {
          professionId: profession.id,
          name: profession.name,
          uniqueReach: pkg.reachableSkillIds.length,
          groupReach: pkg.reachableGroupSkillIds.length,
          directOnlyReach: pkg.directOnlySkillIds.length,
          skillIdsReached: pkg.reachableSkillIds
        };
      })
      .sort((left, right) => left.name.localeCompare(right.name) || left.professionId.localeCompare(right.professionId)),
    groupWeightedValues: content.skillGroups
      .map((group) => {
        const weightedValue = getGroupMemberships(content, group).reduce(
          (total, membership) =>
            total + getSkillWeight(content.skills.find((skill) => skill.id === membership.skillId)),
          0
        );

        return {
          groupId: group.id,
          name: group.name,
          weightedValue,
          belowNormalThreshold: weightedValue < 6,
          allowedExceptionReason: ALLOWED_SMALL_GROUP_REASONS[group.id] ?? null,
          warnings: groupWarnings.get(group.id) ?? []
        };
      })
      .sort((left, right) => left.name.localeCompare(right.name) || left.groupId.localeCompare(right.groupId)),
    validationWarnings: warningRows
  };
}

export function buildSkillSystemAiExport(input: {
  appCommit?: string | null;
  generatedAt?: string;
  content?: CanonicalContent;
} = {}) {
  const content = input.content ?? defaultCanonicalContent;
  const groupWarnings = buildGroupWarningMap(content);

  return {
    metadata: {
      exportVersion: EXPORT_VERSION,
      generatedAt: input.generatedAt ?? new Date().toISOString(),
      source: "packages/content/src/seeds/generatedRepoLocalGlantriSeed.ts via defaultCanonicalContent",
      appCommit: input.appCommit ?? getGitCommit(),
      warning: EXPORT_WARNING
    },
    civilizations: [...content.civilizations].sort(byNameThenId).map((civilization) => ({
      id: civilization.id,
      name: civilization.name,
      description: civilization.notes ?? civilization.shortDescription ?? null,
      shortDescription: civilization.shortDescription,
      historicalAnalogue: civilization.historicalAnalogue,
      period: civilization.period,
      linkedSocietyId: civilization.linkedSocietyId,
      linkedSocietyName: getSocietyName(content, civilization.linkedSocietyId),
      linkedSocietyLevel: civilization.linkedSocietyLevel,
      baselineLanguages: {
        motherTongue: civilization.motherTongueLanguageName,
        spoken: civilization.spokenLanguageName,
        written: civilization.writtenLanguageName,
        optional: civilization.optionalLanguageNames
      }
    })),
    societies: [...content.societies].sort(byNameThenId).map((society) => {
      const rows = content.societyLevels.filter((row) => row.societyId === society.id);

      return {
        id: society.id,
        name: society.name,
        societyLevel: society.societyLevel,
        stage: society.societyLevel,
        description: society.notes ?? society.shortDescription ?? null,
        shortDescription: society.shortDescription,
        historicalReference: society.historicalReference ?? null,
        glantriExamples: society.glantriExamples ?? null,
        baselineLanguages: (society.baselineLanguageIds ?? []).map((languageId) => ({
          languageId,
          languageName: content.languages.find((language) => language.id === languageId)?.name ?? languageId
        })),
        classBands: rows
          .map((row) => ({
            classBand: row.societyLevel,
            classLabel: row.socialClass,
            educationValue: row.baseEducation ?? null,
            professionAvailability: row.professionIds.map((professionId) => ({
              professionId,
              professionName: getProfessionName(content, professionId)
            })),
            notes: row.notes || null
          }))
          .sort((left, right) => left.classBand - right.classBand)
      };
    }),
    socialClasses: content.societyLevels
      .map((row) => ({
        id: `${row.societyId}:class-${row.societyLevel}`,
        societyId: row.societyId,
        societyName: row.societyName,
        societyStage: content.societies.find((society) => society.id === row.societyId)?.societyLevel ?? null,
        classBand: row.societyLevel,
        classLabel: row.socialClass,
        educationValue: row.baseEducation ?? null,
        professionIds: row.professionIds,
        skillGroupIds: row.skillGroupIds,
        skillIds: row.skillIds,
        notes: row.notes ?? null
      }))
      .sort(
        (left, right) =>
          String(left.societyName).localeCompare(String(right.societyName)) ||
          Number(left.classBand) - Number(right.classBand)
      ),
    skills: [...content.skills].sort(byNameThenId).map((skill) => mapSkill(content, skill)),
    skillGroups: [...content.skillGroups]
      .sort(byNameThenId)
      .map((group) => mapSkillGroup(content, group, groupWarnings.get(group.id) ?? [])),
    specializations: [...content.specializations].sort(byNameThenId).map((specialization) => mapSpecialization(content, specialization)),
    professions: [...content.professions].sort(byNameThenId).map((profession) => mapProfession(content, profession)),
    professionFamilies: [...content.professionFamilies].sort(byNameThenId).map((family) => ({
      id: family.id,
      name: family.name,
      description: family.description ?? null,
      professionIds: content.professions
        .filter((profession) => profession.familyId === family.id)
        .sort(byNameThenId)
        .map((profession) => profession.id)
    })),
    professionPackages: content.professions
      .map((profession) => {
        const pkg = resolveProfessionPackage(content, profession.id);
        const groupFan = (groupId: string, relevance: "core" | "optional") => {
          const group = content.skillGroups.find((candidate) => candidate.id === groupId);
          const memberships = group ? getGroupMemberships(content, group) : [];

          return {
            groupId,
            groupName: getGroupName(content, groupId),
            relevance,
            coreSkills: memberships
              .filter((membership) => membership.relevance === "core")
              .map((membership) => getSkillName(content, membership.skillId)),
            optionalSkills: memberships
              .filter((membership) => membership.relevance === "optional")
              .map((membership) => getSkillName(content, membership.skillId)),
            weightedContentPoints: memberships.reduce(
              (total, membership) =>
                total + getSkillWeight(content.skills.find((skill) => skill.id === membership.skillId)),
              0
            )
          };
        };

        return {
          professionId: profession.id,
          professionName: profession.name,
          familyId: profession.familyId,
          familyName: getFamilyName(content, profession.familyId),
          coreSkillGroups: pkg.coreGroupIds.map((groupId) => getGroupName(content, groupId)),
          optionalSkillGroups: pkg.favoredGroupIds.map((groupId) => getGroupName(content, groupId)),
          directlyGrantedSkills: pkg.directSkillIds.map((skillId) => getSkillName(content, skillId)),
          directSkillExceptions: pkg.directOnlySkillIds.map((skillId) => getSkillName(content, skillId)),
          reachableGroupSkills: pkg.reachableGroupSkillIds.map((skillId) => getSkillName(content, skillId)),
          totalReachableSkills: pkg.reachableSkillIds.length,
          groupFans: [
            ...pkg.coreGroupIds.map((groupId) => groupFan(groupId, "core")),
            ...pkg.favoredGroupIds.map((groupId) => groupFan(groupId, "optional"))
          ].sort(
            (left, right) =>
              (left.relevance === "core" ? 0 : 1) - (right.relevance === "core" ? 0 : 1) ||
              left.groupName.localeCompare(right.groupName)
          )
        };
      })
      .sort((left, right) => left.professionName.localeCompare(right.professionName)),
    availability: buildAvailability(content),
    relationships: buildRelationships(content),
    derivedRules: buildDerivedRules(content),
    adminMetrics: buildAdminMetrics(content)
  };
}

export function buildSkillSystemNote(): string {
  return `# Glantri Skill System AI Export Notes

## Purpose
This export is for AI review/modeling and possible later import proposals. It is not canonical content by itself, and generated suggestions must not be reimported without validation.

## Society/Class Model
- Society stage/level uses a 1-6 scale.
- Social class band uses a 1-4 scale.
- Class 4 is elite/high-status.
- Low social rolls still need playable options.
- Class 3 should support upward mobility.

## Skill Model
- Ordinary skills are the main skill rows used for broad learned capability.
- Secondary skills are narrower or more contextual skills.
- Specializations are not normal skill choices; they depend on a parent skill and minimum parent/group level.
- Concrete languages are materialized rather than relying on a raw generic Language skill.

## Skill-Group Economics
- Dynamic group cost: floor(0.6 × total individual cost of active group skills), minimum 1.
- Active group skills = fixed group skills + selected slot skills.
- Unselected slot candidates do not count.
- Normal groups should usually represent about 6+ weighted skill points unless deliberately narrow/allowed.

## Skill-Group Guardrails
- Dodge and Parry must not be taught alone.
- Any group containing Dodge or Parry must include melee weapon context.
- Combat support groups such as Defensive Soldiering and Veteran Soldiering should contain non-combat/military support skills, not ordinary weapon/Dodge/Parry fundamentals.
- Weapon slots should not include specialization-only entries.
- Longbow is specialization of Bow, not a missile skill choice.

## Profession/Package Principles
- Profession reach measures unique skills reachable from granted groups plus direct grants not already covered by groups.
- Avoid isolated combat skills in non-combat professions.
- Use coherent packages.
- C4 should not be crowded by ordinary labor/common roles when elite equivalents exist.
- C3 mobility paths are desirable.
- Low-class playable paths are intentional.

## Craft/Choice-Slot Model
- Craft professions can use common social/business/technical training plus craft choice slots.
- Master craft should usually choose craft specialties rather than automatically gaining all crafts.

## Import Caution
- Do not reimport generated suggestions without validation.
- Preserve stable IDs where possible.
- Retired IDs/compatibility aliases may exist.
- Run content validators and admin reach audits after changes.
`;
}

export function buildSkillSystemSchemaNote(): string {
  return `# Glantri Skill System AI Export Schema

This document describes the generated JSON in plain English. It is intentionally not a formal JSON Schema.

## metadata
Export version, generation timestamp, source path, optional git commit, and import-safety warning.

## civilizations
Civilization/culture records with display names, descriptions, linked society model, society stage, and language names.

## societies
Society-model records. \`societyLevel\` / \`stage\` is the 1-6 society-stage scale. \`classBands\` are the social class rows available inside that society.

## socialClasses
Flattened society class-band records. \`classBand\` is the 1-4 social class band, not the society stage. These rows include education values, profession IDs, skill group IDs, skill IDs, and notes where available.

## skills
Skill definitions with category, player-facing category, linked stats, description, group membership, specialization-only marker, dependencies, literacy requirement, and admin notes.

## skillGroups
Skill group definitions. \`fixedSkills\` are always part of the group. \`selectionSlots\` describe choices. \`allReachableSkillIds\` includes fixed skills plus slot candidates. Economics explain fixed and slot-dependent cost data.

## specializations
Specialization definitions keyed to parent skills. These are not selectable as ordinary skills.

## professions
Profession subtype definitions with family, effective package, direct grants, reach metrics, availability, and warnings.

## professionFamilies
Profession family definitions and their profession subtype IDs.

## professionPackages
Admin-facing package view: core/optional groups, direct grants, reachable skills, and group fan details.

## availability
Flattened profession availability by profession, civilization, society, society stage, and class band. Some civilization fields may be null when availability exists at society-model level without a specific civilization.

## relationships
Explicit graph-style records for AI modeling. Each row has a \`type\`, \`from\`, \`to\`, and \`metadata\`.

Relationship types include:
- \`skill_in_group\`
- \`group_has_selection_slot\`
- \`slot_can_select_skill\`
- \`specialization_of_skill\`
- \`profession_grants_group\`
- \`profession_grants_skill\`
- \`profession_available_in_society_class\`
- \`civilization_uses_society\`
- \`language_materialized_from_language_choice\`
- \`derived_skill_relationship\`

## derivedRules
Readable derived/cross-training/specialization bridge rules. These describe rule sources and targets, factors/thresholds where available, and whether the relationship contributes derived XP.

## adminMetrics
\`professionReach\` contains unique/group/direct-only reach metrics. \`groupWeightedValues\` contains weighted group values and small-group exceptions. \`validationWarnings\` contains non-blocking content warnings.
`;
}

export function writeSkillSystemAiExport(outputDir = defaultOutputDir): {
  exportPath: string;
  notePath: string;
  schemaPath: string;
} {
  fs.mkdirSync(outputDir, { recursive: true });

  const exportPath = path.join(outputDir, "glantri-skill-system-export.json");
  const notePath = path.join(outputDir, "glantri-skill-system-note.md");
  const schemaPath = path.join(outputDir, "glantri-skill-system-schema.md");
  const exportData = buildSkillSystemAiExport();

  fs.writeFileSync(exportPath, `${JSON.stringify(exportData, null, 2)}\n`, "utf8");
  fs.writeFileSync(notePath, buildSkillSystemNote(), "utf8");
  fs.writeFileSync(schemaPath, buildSkillSystemSchemaNote(), "utf8");

  return { exportPath, notePath, schemaPath };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const paths = writeSkillSystemAiExport();
  // Keep script output stable and concise for CI/log review.
  console.log(`Wrote ${path.relative(repoRoot, paths.exportPath)}`);
  console.log(`Wrote ${path.relative(repoRoot, paths.notePath)}`);
  console.log(`Wrote ${path.relative(repoRoot, paths.schemaPath)}`);
}
