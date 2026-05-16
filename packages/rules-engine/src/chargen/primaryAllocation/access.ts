import { getAccessibleFoundationalSkillIdsForSocietyBand } from "@glantri/domain";

import { resolveEffectiveProfessionPackage } from "../../professions/resolveEffectiveProfessionPackage";
import {
  type CanonicalContentShape,
  getSkillDefinitionGroupIds,
  getSocietyAccess,
  getNextSocietyAccess
} from "./_helpers";

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

function resolveProfessionPackageInternal(
  content: CanonicalContentShape,
  professionId: string
) {
  return resolveEffectiveProfessionPackage({
    content,
    subtypeId: professionId
  });
}

export function getAllowedSkillGroupIdsInternal(
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

export function buildChargenSkillAccessSummaryInternal(input: {
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

export function getAllowedPrimaryGroupIdsInternal(
  content: CanonicalContentShape,
  professionId: string,
  societyId: string | undefined,
  societyLevel: number
): string[] {
  return getAllowedSkillGroupIdsInternal(content, professionId, societyId, societyLevel);
}

export function getAllowedSecondaryGroupIdsInternal(
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
