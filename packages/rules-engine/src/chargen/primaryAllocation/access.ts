import { getAccessibleFoundationalSkillIdsForSocietyBand } from "@glantri/domain";

import { resolveEffectiveProfessionPackage } from "../../professions/resolveEffectiveProfessionPackage";
import { resolveCompetencyV2PathAvailability } from "../../professions/resolveCompetencyV2Path";
import {
  type CanonicalContentShape,
  getSkillDefinitionGroupIds,
  getSocietyAccess,
  getNextSocietyAccess,
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

function resolveProfessionPackageInternal(content: CanonicalContentShape, professionId: string) {
  return resolveEffectiveProfessionPackage({
    content,
    subtypeId: professionId,
  });
}

export function getAllowedSkillGroupIdsInternal(
  content: CanonicalContentShape,
  professionId: string,
  societyId: string | undefined,
  societyLevel: number,
): string[] {
  if (content.competencyV2) {
    const available = resolveCompetencyV2PathAvailability({
      content,
      professionId,
      societyId,
      socialBand: societyLevel,
    });
    return available?.valid ? available.availableGroupIds : [];
  }
  if (content.chargenCatalogue?.professionIds) {
    if (!content.chargenCatalogue.professionIds.includes(professionId))
      throw new Error("Unknown target Profession.");
    const resolved = resolveProfessionPackageInternal(content, professionId);
    return [
      ...new Set([
        ...resolved.core.finalEffectiveGroupIds,
        ...resolved.favored.finalEffectiveGroupIds,
      ]),
    ];
  }
  const society = getSocietyAccess(content, societyLevel, societyId);

  if (!society) {
    return [];
  }

  const professionPackage = resolveProfessionPackageInternal(content, professionId);
  const professionGroupIds = new Set([
    ...professionPackage.core.finalEffectiveGroupIds,
    ...professionPackage.favored.finalEffectiveGroupIds,
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
    input.societyLevel,
  );
  const normalGroupIdSet = new Set(normalSkillGroupIds);
  const professionPackage = resolveProfessionPackageInternal(input.content, input.professionId);
  const v2Available = resolveCompetencyV2PathAvailability({
    content: input.content,
    professionId: input.professionId,
    societyId: input.societyId,
    socialBand: input.societyLevel,
  });
  const professionDirectSkillIds = new Set(
    v2Available
      ? v2Available.valid
        ? v2Available.availableDirectSkillIds
        : []
      : [
          ...professionPackage.core.finalEffectiveSkillIds,
          ...professionPackage.favored.finalEffectiveSkillIds,
        ],
  );
  const societySkillIds = input.content.chargenCatalogue?.professionIds
    ? []
    : (getSocietyAccess(input.content, input.societyLevel, input.societyId)?.skillIds ?? []);
  const foundationalSkillIds = input.content.chargenCatalogue?.professionIds
    ? []
    : getAccessibleFoundationalSkillIdsForSocietyBand(input.content.societyBandSkillAccess ?? [], {
        socialBand: input.societyLevel,
        societyId: input.societyId ?? "",
      });
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
  return {
    normalSkillGroupIds,
    normalSkillIds,
    // Individual-Skill discoverability is deliberately not a partition of normal access.
    // Eligibility and pool cost are resolved separately when the player buys a rank.
    otherSkillIds: input.content.skills.map((skill) => skill.id),
    skillSources: Object.fromEntries(
      [...skillSources.entries()].map(([skillId, sources]) => [skillId, [...sources.values()]]),
    ),
  };
}

export function getAllowedPrimaryGroupIdsInternal(
  content: CanonicalContentShape,
  professionId: string,
  societyId: string | undefined,
  societyLevel: number,
): string[] {
  return getAllowedSkillGroupIdsInternal(content, professionId, societyId, societyLevel);
}

/*
 * UNRULED / NON-CANONICAL (Forgejo #494, control-plane ruling 2026-10-04, Option C).
 * The V2 branch below (Social-Band "at or below your band" via groupBounds) is NOT an approved
 * Glantri rule. Its presence, and any test that reproduces it, is not a product ruling. Whether
 * Profession participates in eligibility is also unruled; do not infer it from the groupBounds
 * shape. The Product Owner ruling on the intended eligibility rule is still owed.
 * Flexible-pool group purchase is explicitly disabled at its entry point (`spendSecondaryPoint`
 * in draftState.ts). This result is nevertheless consumed to filter skill and specialization
 * parent groups there, so its return value must not be changed without that ruling.
 */
export function getAllowedSecondaryGroupIdsInternal(
  content: CanonicalContentShape,
  societyId: string | undefined,
  societyLevel: number,
): string[] {
  if (content.competencyV2) {
    const actualLevel = content.societies?.find(
      (society) => society.id === societyId,
    )?.societyLevel;
    if (!actualLevel || societyLevel < 1 || societyLevel > 4) return [];
    return content.competencyV2.groupBounds
      .filter(
        (bound) =>
          (bound.minSocietyLevel ?? 1) <= actualLevel &&
          Number((bound.minSocialBand ?? "L1").slice(1)) <= societyLevel,
      )
      .map((bound) => bound.groupId);
  }
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
  societyLevel: number,
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
  societyLevel: number,
): string[] {
  return getAllowedSecondaryGroupIdsInternal(content, societyId, societyLevel);
}
