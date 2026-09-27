import type {
  CharacterProgression,
  ChargenTargetSkillDefinition,
  RolledCharacterProfile,
  SkillDefinition,
  SkillSpecialization,
} from "@glantri/domain";
import { getSkillGroupIds } from "@glantri/domain";

import { STANDARD_CHARGEN_METHOD_POLICY } from "../policy";
import { getResolvedProfileStats } from "../statResolution";
import { calculateGroupLevel } from "../../skills/calculateGroupLevel";
import { deriveBestSkillRelationships } from "../../skills/deriveSkillRelationships";
import {
  calculateLearningGroupAcquisition,
  priceLearningGroupBundle,
  type LearningGroupCompetencyResult,
  type LearningGroupMembershipInput,
} from "../../skills/learningGroupAcquisition";
import { compareSkillGroupContributionCandidates } from "../../skills/selectBestSkillGroupContribution";
import type { CanonicalContentShape } from "./_helpers";

export const ORDINARY_SKILL_POINT_COST = 2;
export const SECONDARY_SKILL_POINT_COST = 1;
export const LEGACY_GROUP_POINT_COST = 4;
export const NEW_SPECIALIZATION_COST = 4;
export const EXISTING_SPECIALIZATION_COST = 2;
/**
 * A Learning Group that teaches no base membership and exists only to open authored
 * Specialization access keeps its recorded flat price of one point per purchase, from
 * `max(1, floor(0.6 * 0))` in `docs/rules/chargen-calculations.md`. The canonical group
 * competence arithmetic cannot price it, because it grants no group competence at all.
 */
export const SPECIALIZATION_ACCESS_GROUP_POINT_COST = 1;

export type ChargenSkillAccessRoute = "ordinary" | "flexible";

export interface ChargenPoolAllocation {
  primary: number;
  secondary: number;
}

export function getSkillSpendCost(skill: SkillDefinition): number;
export function getSkillSpendCost(
  skill: SkillDefinition | ChargenTargetSkillDefinition,
  accessRoute: ChargenSkillAccessRoute,
): number;
export function getSkillSpendCost(
  skill: SkillDefinition | ChargenTargetSkillDefinition,
  accessRoute?: ChargenSkillAccessRoute,
): number {
  if ("competencyType" in skill) {
    if (!accessRoute) throw new Error("Target Skill cost requires an active access route.");
    return accessRoute === "flexible" ? SECONDARY_SKILL_POINT_COST : ORDINARY_SKILL_POINT_COST;
  }
  return skill.category === "secondary" ? SECONDARY_SKILL_POINT_COST : ORDINARY_SKILL_POINT_COST;
}

export function getSpecializationSpendCost(exists: boolean): number {
  return exists ? EXISTING_SPECIALIZATION_COST : NEW_SPECIALIZATION_COST;
}

export function getSelectedSkillIdsForGroupSlot(input: {
  groupId: string;
  progression: CharacterProgression;
  slotId: string;
}): string[] {
  return (
    input.progression.chargenSelections?.selectedGroupSlots.find(
      (selection) => selection.groupId === input.groupId && selection.slotId === input.slotId,
    )?.selectedSkillIds ?? []
  );
}

interface ActiveGroupMembership {
  activeSkillIds: string[];
  skillsById: Map<string, SkillDefinition | ChargenTargetSkillDefinition>;
}

/**
 * Resolve the Learning Group's currently active base memberships. Authored Specialization
 * memberships are access only and never part of the group's competence or price.
 */
function resolveActiveGroupMembership(input: {
  content: CanonicalContentShape;
  groupId: string;
  progression: CharacterProgression;
}): { error?: string; membership?: ActiveGroupMembership } {
  const group = input.content.skillGroups.find((candidate) => candidate.id === input.groupId);

  if (!group) {
    return { error: "Skill group definition not found." };
  }

  const skillsById = new Map(
    (input.content.chargenCatalogue?.groupIds?.includes(input.groupId)
      ? input.content
      : (input.content.compatibilityContent ?? input.content)
    ).skills.map((skill) => [skill.id, skill]),
  );
  const fixedGroupSkillIds = (group.skillMemberships ?? []).map((membership) => membership.skillId);
  const hasSelectionSlots = (group.selectionSlots?.length ?? 0) > 0;
  const activeSkillIds = new Set(
    fixedGroupSkillIds.length > 0
      ? fixedGroupSkillIds
      : hasSelectionSlots
        ? []
        : input.content.skills
            .filter((skill) => getSkillGroupIds(skill).includes(input.groupId))
            .map((skill) => skill.id),
  );

  for (const slot of group.selectionSlots ?? []) {
    const candidateSkillIds = new Set(slot.candidateSkillIds);
    const selectedSkillIds = getSelectedSkillIdsForGroupSlot({
      groupId: input.groupId,
      progression: input.progression,
      slotId: slot.id,
    }).filter((skillId) => candidateSkillIds.has(skillId));

    if (slot.required && selectedSkillIds.length < slot.chooseCount) {
      return { error: `${group.name}: ${slot.label}.` };
    }

    for (const skillId of selectedSkillIds.slice(0, slot.chooseCount)) {
      activeSkillIds.add(skillId);
    }
  }

  const pricedSkillIds = [...activeSkillIds].filter((skillId) => skillsById.has(skillId));

  if (pricedSkillIds.length === 0 && (group.specializationIds?.length ?? 0) === 0) {
    return { error: "This skill group has no active skills to price." };
  }

  return { membership: { activeSkillIds: pricedSkillIds, skillsById } };
}

function getChargenSkillWeight(skill: SkillDefinition | ChargenTargetSkillDefinition): number {
  return "competencyType" in skill
    ? getSkillSpendCost(skill, "ordinary")
    : getSkillSpendCost(skill);
}

function compareChargenGroupCandidates(
  left: { groupId: string; groupLevel: number; groupName: string; groupSortOrder: number },
  right: { groupId: string; groupLevel: number; groupName: string; groupSortOrder: number },
): number {
  return compareSkillGroupContributionCandidates(
    {
      groupId: left.groupId,
      groupLevel: left.groupLevel,
      name: left.groupName,
      sortOrder: left.groupSortOrder,
    },
    {
      groupId: right.groupId,
      groupLevel: right.groupLevel,
      name: right.groupName,
      sortOrder: right.groupSortOrder,
    },
  );
}

export interface ChargenGroupBundle {
  byCompetencyId: Record<string, LearningGroupCompetencyResult>;
  /** Per-group validation failure, keyed by group id, for callers that report them. */
  errorsByGroupId: Map<string, string>;
  /**
   * Groups that teach no priced base membership and exist only to open authored
   * Specialization access. They carry no group competence, so the shared competence
   * arithmetic cannot price them; they keep their recorded flat access price instead.
   */
  specializationAccessOnlyGroupIds: Set<string>;
  /** Weighted useful increment attributed to each group that is the strongest contributor. */
  weightedUsefulIncrementByGroupId: Map<string, number>;
}

/**
 * Project the Chargen purchase state onto the shared canonical Learning Group acquisition
 * arithmetic. Chargen keeps its own weights (its ordinary/flexible point costs) and its own
 * membership resolution; it owns no group-pricing arithmetic of its own.
 */
export function calculateChargenGroupBundle(input: {
  content: CanonicalContentShape;
  /** Replacement purchased-rank counts, used to price a prospective purchase or removal. */
  groupRankOverrides?: ReadonlyMap<string, number>;
  progression: CharacterProgression;
}): ChargenGroupBundle {
  const errorsByGroupId = new Map<string, string>();
  const levelByGroupId = new Map<string, number>();

  for (const group of input.progression.skillGroups) {
    levelByGroupId.set(
      group.groupId,
      calculateGroupLevel({ gms: group.gms ?? 0, ranks: group.ranks }),
    );
  }

  for (const [groupId, purchasedRanks] of input.groupRankOverrides ?? []) {
    const group = input.progression.skillGroups.find((item) => item.groupId === groupId);
    levelByGroupId.set(
      groupId,
      calculateGroupLevel({
        gms: group?.gms ?? 0,
        ranks: (group?.grantedRanks ?? 0) + purchasedRanks,
      }),
    );
  }

  const memberships: LearningGroupMembershipInput[] = [];
  const weightByCompetencyId = new Map<string, number>();
  const specializationAccessOnlyGroupIds = new Set<string>();

  for (const [groupId, groupLevel] of levelByGroupId) {
    const resolved = resolveActiveGroupMembership({
      content: input.content,
      groupId,
      progression: input.progression,
    });

    if (resolved.error || !resolved.membership) {
      errorsByGroupId.set(groupId, resolved.error ?? "Skill group cost could not be calculated.");
      continue;
    }

    if (resolved.membership.activeSkillIds.length === 0) {
      specializationAccessOnlyGroupIds.add(groupId);
      continue;
    }

    if (groupLevel <= 0) {
      continue;
    }

    const definition = input.content.skillGroups.find((candidate) => candidate.id === groupId);

    for (const skillId of resolved.membership.activeSkillIds) {
      weightByCompetencyId.set(
        skillId,
        getChargenSkillWeight(resolved.membership.skillsById.get(skillId)!),
      );
      memberships.push({
        competencyId: skillId,
        groupId,
        groupLevel,
        groupName: definition?.name ?? groupId,
        groupSortOrder: definition?.sortOrder ?? Number.MAX_SAFE_INTEGER,
      });
    }
  }

  const competencies = [...weightByCompetencyId].map(([competencyId, weight]) => ({
    competencyId,
    weight,
  }));
  // Pass one establishes the strongest group contribution per competency. That group-only
  // base is the only competence allowed to source a relationship floor
  // (docs/rules/pilot-skill-rules-v1.md:57), so pass two re-prices against those floors.
  const groupOnly = calculateLearningGroupAcquisition({
    compareCandidates: compareChargenGroupCandidates,
    competencies,
    memberships,
  });
  const relationshipFloors = deriveBestSkillRelationships({
    skillBaseXpBySkillId: new Map(
      Object.values(groupOnly.byCompetencyId).map((result) => [
        result.competencyId,
        result.bestGroupContribution,
      ]),
    ),
    skills: input.content.skills,
  });
  const acquisition = calculateLearningGroupAcquisition({
    compareCandidates: compareChargenGroupCandidates,
    competencies: competencies.map((competency) => ({
      ...competency,
      relationshipFloor: relationshipFloors.bestDerivedBySkillId.get(competency.competencyId)?.xp,
    })),
    memberships,
  });
  const weightedUsefulIncrementByGroupId = new Map<string, number>();

  for (const result of Object.values(acquisition.byCompetencyId)) {
    weightedUsefulIncrementByGroupId.set(
      result.bestGroupId,
      (weightedUsefulIncrementByGroupId.get(result.bestGroupId) ?? 0) +
        result.weightedUsefulIncrement,
    );
  }

  return {
    byCompetencyId: acquisition.byCompetencyId,
    errorsByGroupId,
    specializationAccessOnlyGroupIds,
    weightedUsefulIncrementByGroupId,
  };
}

/**
 * Total primary/flexible-eligible price of the Learning Groups the Character has purchased.
 * The canonical ceiling is applied once to the complete chargeable bundle, never per group
 * and never per rank.
 */
export function getChargenGroupBundleCost(input: {
  chargeableGroupIds?: Iterable<string>;
  content: CanonicalContentShape;
  groupRankOverrides?: ReadonlyMap<string, number>;
  progression: CharacterProgression;
}): { bundle: ChargenGroupBundle; cost: number } {
  const bundle = calculateChargenGroupBundle(input);
  const chargeable =
    input.chargeableGroupIds === undefined ? undefined : new Set(input.chargeableGroupIds);
  let weightedUsefulIncrement = 0;

  for (const [groupId, weighted] of bundle.weightedUsefulIncrementByGroupId) {
    if (chargeable && !chargeable.has(groupId)) {
      continue;
    }
    weightedUsefulIncrement += weighted;
  }

  let specializationAccessCost = 0;

  for (const groupId of bundle.specializationAccessOnlyGroupIds) {
    if (chargeable && !chargeable.has(groupId)) {
      continue;
    }

    const group = input.progression.skillGroups.find((item) => item.groupId === groupId);
    const purchasedRanks =
      input.groupRankOverrides?.get(groupId) ??
      (group?.primaryRanks ?? 0) + (group?.secondaryRanks ?? 0);
    specializationAccessCost += purchasedRanks * SPECIALIZATION_ACCESS_GROUP_POINT_COST;
  }

  return {
    bundle,
    cost: priceLearningGroupBundle(weightedUsefulIncrement) + specializationAccessCost,
  };
}

/**
 * Marginal price of changing one Learning Group's purchased ranks by `rankDelta` (default a
 * single additional rank). A Group contribution that yields no useful competence yields no
 * price, so a membership fully suppressed by a stronger Group quotes `0`.
 */
export function getActiveGroupSkillCost(input: {
  chargeableGroupIds?: Iterable<string>;
  content: CanonicalContentShape;
  groupId: string;
  progression: CharacterProgression;
  rankDelta?: number;
}): { cost?: number; error?: string } {
  const resolved = resolveActiveGroupMembership(input);

  if (resolved.error) {
    return { error: resolved.error };
  }

  const group = input.progression.skillGroups.find((item) => item.groupId === input.groupId);
  const purchasedRanks = (group?.primaryRanks ?? 0) + (group?.secondaryRanks ?? 0);
  const rankDelta = input.rankDelta ?? 1;
  const chargeableGroupIds =
    input.chargeableGroupIds === undefined
      ? undefined
      : [...new Set([...input.chargeableGroupIds, input.groupId])];
  const lower = getChargenGroupBundleCost({
    chargeableGroupIds,
    content: input.content,
    groupRankOverrides: new Map([
      [input.groupId, Math.max(0, purchasedRanks + Math.min(0, rankDelta))],
    ]),
    progression: input.progression,
  });
  const upper = getChargenGroupBundleCost({
    chargeableGroupIds,
    content: input.content,
    groupRankOverrides: new Map([
      [input.groupId, Math.max(0, purchasedRanks + Math.max(0, rankDelta))],
    ]),
    progression: input.progression,
  });

  return { cost: Math.max(0, upper.cost - lower.cost) };
}

export function getActiveGroupSkillPurchaseCost(input: {
  content: CanonicalContentShape;
  groupId: string;
  progression: CharacterProgression;
}): { cost?: number; error?: string } {
  return getActiveGroupSkillCost(input);
}

export function getOrdinaryPoolTotal(progression?: CharacterProgression): number {
  return progression?.primaryPoolTotal ?? STANDARD_CHARGEN_METHOD_POLICY.primaryPoolTotal;
}

export function getFlexiblePoolTotal(
  profile: RolledCharacterProfile | undefined,
  progression?: Pick<CharacterProgression, "flexiblePointFactor" | "secondaryPoolTotal">,
): number {
  const resolvedStats = getResolvedProfileStats(profile);

  if (!resolvedStats) {
    return progression?.secondaryPoolTotal ?? 0;
  }

  return Math.floor(
    ((resolvedStats.int ?? 0) + (resolvedStats.lck ?? 0)) *
      (progression?.flexiblePointFactor ?? STANDARD_CHARGEN_METHOD_POLICY.flexiblePointFactor),
  );
}

export function getAvailableFlexiblePoolTotal(input: {
  profile: RolledCharacterProfile | undefined;
  progression: CharacterProgression;
}): number {
  const profileDrivenTotal = getFlexiblePoolTotal(input.profile, input.progression);
  return profileDrivenTotal > 0 ? profileDrivenTotal : input.progression.secondaryPoolTotal;
}

export function chooseChargenPool(input: {
  cost: number;
  normalAccess: boolean;
  profile?: RolledCharacterProfile;
  progression: CharacterProgression;
}): ChargenPoolAllocation | null {
  const ordinaryRemaining =
    getOrdinaryPoolTotal(input.progression) - input.progression.primaryPoolSpent;
  const flexibleRemaining =
    getFlexiblePoolTotal(input.profile, input.progression) - input.progression.secondaryPoolSpent;

  const primary = input.normalAccess ? Math.min(Math.max(0, ordinaryRemaining), input.cost) : 0;
  const secondary = input.cost - primary;

  if (flexibleRemaining >= secondary) {
    return { primary, secondary };
  }

  return null;
}

export function getPrimaryPurchaseCostForGroup(
  progression: CharacterProgression,
  groupId: string,
): number {
  const group = progression.skillGroups.find((item) => item.groupId === groupId);
  return group && group.ranks > 0 ? LEGACY_GROUP_POINT_COST : LEGACY_GROUP_POINT_COST * 2;
}

export function getPrimaryPurchaseCostForSkill(
  progression: CharacterProgression,
  skillDefinition: SkillDefinition,
): number {
  void progression;

  return "catalogueSource" in skillDefinition
    ? getSkillSpendCost(skillDefinition, "ordinary")
    : getSkillSpendCost(skillDefinition);
}

export function getSecondaryPurchaseCostForSkill(
  progression: CharacterProgression,
  skillDefinition: SkillDefinition,
): number {
  void progression;

  return "catalogueSource" in skillDefinition
    ? getSkillSpendCost(skillDefinition, "flexible")
    : getSkillSpendCost(skillDefinition);
}

export function getSecondaryPurchaseCostForSpecialization(
  progression: CharacterProgression,
  specializationDefinition: SkillSpecialization,
): number {
  const specialization = progression.specializations.find(
    (item) => item.specializationId === specializationDefinition.id,
  );
  return getSpecializationSpendCost(Boolean(specialization && specialization.secondaryRanks > 0));
}
