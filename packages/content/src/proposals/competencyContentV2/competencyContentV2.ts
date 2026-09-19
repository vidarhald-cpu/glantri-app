/**
 * Competency Content V2 — deterministic builder, catalogue checks and effective-breadth analysis.
 *
 * NON-CANONICAL. Reference/analysis export only: nothing here is registered with Chargen, projected
 * into `CanonicalContent`, or exported from the package entry point.
 */

import { canonicalJsonSha256 } from "../../integrity/canonicalSha256";
import { fullSkillCatalogueProposal } from "../../skillContentPlatform/fullSkillCatalogueProposal";
import { targetLearningGroupCatalogue } from "../../skillContentPlatform/targetLearningGroups";
import {
  TARGET_PROFESSION_EXCLUSIVE_GROUP_PAIRS,
  targetProfessionCatalogue,
} from "../../targetProfessions";
import {
  COMPETENCY_CONTENT_V2_RETIRED_CATEGORY_ID,
  COMPETENCY_CONTENT_V2_SCHEMA_VERSION,
  COMPETENCY_CONTENT_V2_STATUS,
  competencyContentV2CategoryByDomain,
  competencyContentV2CategoryOverrides,
  competencyContentV2CivilizationLanguages,
  competencyContentV2Families,
  competencyContentV2LearningGroups,
  competencyContentV2RemovedGroups,
  type V2Family,
  type V2LearningGroup,
  type V2PathBody,
  type V2PlayerFacingCategoryId,
} from "./competencyContentV2Source";

export interface BreadthPath {
  professionCode: string;
  professionName: string;
  pathId: string;
  pathName: string;
  groupIds: string[];
  /** Base Skills every learner of this path is taught, deduplicated across all routes. */
  fixedSkillIds: string[];
  /** Total `chooseCount` across every selection slot reachable on this path. */
  slotSelections: number;
  /**
   * Fixed breadth plus one Skill per slot selection, assuming selections fall outside the fixed set.
   * This is the headline "effective distinct base Skills" figure.
   */
  effectiveBreadthNominal: number;
  /** Worst case: every slot selection duplicates a Skill already fixed on the path. */
  effectiveBreadthMinimum: number;
  reachableSpecializationIds: string[];
}

export interface BreadthDistribution {
  paths: number;
  distribution: Record<number, number>;
  minimum: number;
  lowerQuartile: number;
  median: number;
  upperQuartile: number;
  maximum: number;
  mean: number;
  atOrAboveTarget: number;
  belowTarget: number;
}

const TARGET_EFFECTIVE_BREADTH = 10;

function fail(message: string): never {
  throw new Error(`Invalid Competency Content V2 proposal: ${message}`);
}

function quantile(sorted: readonly number[], fraction: number): number {
  if (sorted.length === 0) return 0;
  const index = Math.min(sorted.length - 1, Math.floor(fraction * (sorted.length - 1)));
  return sorted[index]!;
}

export function summarizeBreadth(values: readonly number[]): BreadthDistribution {
  const sorted = [...values].sort((a, b) => a - b);
  const distribution: Record<number, number> = {};
  for (const value of sorted) distribution[value] = (distribution[value] ?? 0) + 1;
  return {
    paths: sorted.length,
    distribution,
    minimum: sorted[0] ?? 0,
    lowerQuartile: quantile(sorted, 0.25),
    median: quantile(sorted, 0.5),
    upperQuartile: quantile(sorted, 0.75),
    maximum: sorted[sorted.length - 1] ?? 0,
    mean: sorted.length
      ? Math.round((sorted.reduce((sum, value) => sum + value, 0) / sorted.length) * 100) / 100
      : 0,
    atOrAboveTarget: sorted.filter((value) => value >= TARGET_EFFECTIVE_BREADTH).length,
    belowTarget: sorted.filter((value) => value < TARGET_EFFECTIVE_BREADTH).length,
  };
}

/* ------------------------------------------------------------------------------------------ */
/* Approved-baseline measurement, using the identical counting rules                            */
/* ------------------------------------------------------------------------------------------ */

/**
 * Measures the currently approved catalogue under the #250 counting rules so the before/after
 * comparison is like for like. The approved 59-group catalogue has no selection slots, so every
 * approved path's nominal and minimum breadth are the same number.
 */
export function measureApprovedBaseline(): BreadthPath[] {
  const groupsById = new Map(targetLearningGroupCatalogue.groups.map((group) => [group.id, group]));
  const baseSkillIds = new Set(
    fullSkillCatalogueProposal.entries
      .filter((entry) => entry.competencyType === "base-skill")
      .map((entry) => entry.id),
  );
  const paths: BreadthPath[] = [];

  for (const family of targetProfessionCatalogue.families) {
    const opportunitySets: { id: string; name: string; opportunityIds: string[] }[] = [];
    if (family.tracks.length) {
      for (const track of family.tracks) {
        opportunitySets.push({
          id: track.id,
          name: track.name,
          opportunityIds: track.opportunityIds,
        });
      }
    } else {
      const all = family.opportunities.map((opportunity) => opportunity.id);
      const pairs = TARGET_PROFESSION_EXCLUSIVE_GROUP_PAIRS[family.id];
      if (pairs?.length) {
        for (const [left, right] of pairs) {
          for (const [keep, drop] of [
            [left, right],
            [right, left],
          ]) {
            opportunitySets.push({
              id: `${family.id}:${keep.toLowerCase()}`,
              name: `${groupsById.get(keep)?.name ?? keep} alternative`,
              opportunityIds: all.filter(
                (id) =>
                  !family.opportunities.some(
                    (opportunity) =>
                      opportunity.id === id &&
                      opportunity.kind === "group" &&
                      opportunity.targetId === drop,
                  ),
              ),
            });
          }
        }
      } else {
        opportunitySets.push({ id: family.id, name: family.name, opportunityIds: all });
      }
    }

    for (const set of opportunitySets) {
      const opportunities = family.opportunities.filter((opportunity) =>
        set.opportunityIds.includes(opportunity.id),
      );
      const skills = new Set<string>();
      const specializations = new Set<string>();
      const groupIds: string[] = [];
      for (const opportunity of opportunities) {
        if (opportunity.kind === "group") {
          groupIds.push(opportunity.targetId);
          const group =
            groupsById.get(opportunity.targetId) ?? fail(`unknown group ${opportunity.targetId}`);
          for (const member of group.members) {
            if (member.kind === "base-skill") skills.add(member.competencyId);
            else specializations.add(member.competencyId);
          }
        } else if (opportunity.kind === "specialization") {
          specializations.add(opportunity.targetId);
        } else if (baseSkillIds.has(opportunity.targetId)) {
          skills.add(opportunity.targetId);
        } else {
          specializations.add(opportunity.targetId);
        }
      }
      paths.push({
        professionCode: family.code,
        professionName: family.name,
        pathId: set.id,
        pathName: set.name,
        groupIds,
        fixedSkillIds: [...skills].sort(),
        slotSelections: 0,
        effectiveBreadthNominal: skills.size,
        effectiveBreadthMinimum: skills.size,
        reachableSpecializationIds: [...specializations].sort(),
      });
    }
  }
  return paths;
}

/* ------------------------------------------------------------------------------------------ */
/* Proposal build and deterministic catalogue checks                                            */
/* ------------------------------------------------------------------------------------------ */

export interface CompetencyContentV2Catalogue {
  schemaVersion: typeof COMPETENCY_CONTENT_V2_SCHEMA_VERSION;
  status: typeof COMPETENCY_CONTENT_V2_STATUS;
  groups: readonly V2LearningGroup[];
  families: readonly V2Family[];
  paths: BreadthPath[];
  categories: { competencyId: string; name: string; categoryId: V2PlayerFacingCategoryId }[];
  coverage: {
    baseSkills: number;
    baseSkillsInAGroup: number;
    baseSkillsWithAnyRoute: number;
    baseSkillsWithoutAnyRoute: { id: string; name: string }[];
    specializationsWithAnyRoute: number;
    specializationsWithoutAnyRoute: { id: string; name: string }[];
    specializationsWhoseParentIsUnreachableInTheSameFamily: {
      professionCode: string;
      specializationId: string;
      parentId: string;
    }[];
  };
  manifest: {
    groups: number;
    retainedGroups: number;
    revisedGroups: number;
    newGroups: number;
    removedGroups: number;
    groupsWithSelectionSlots: number;
    selectionSlots: number;
    families: number;
    validPaths: number;
    groupOpportunities: number;
    directSkillOpportunities: number;
    directSpecializationOpportunities: number;
    digest: `sha256:${string}`;
  };
}

function pathBodies(family: V2Family): { id: string; name: string; bodies: V2PathBody[] }[] {
  if (family.tracks?.length) {
    return family.tracks.map((track) => ({
      id: track.id,
      name: track.name,
      bodies: [family, track],
    }));
  }
  return [{ id: family.id, name: family.name, bodies: [family] }];
}

export function buildCompetencyContentV2Catalogue(): CompetencyContentV2Catalogue {
  const entries = new Map(fullSkillCatalogueProposal.entries.map((entry) => [entry.id, entry]));
  const baseSkills = fullSkillCatalogueProposal.entries.filter(
    (entry) => entry.competencyType === "base-skill",
  );
  const specializations = fullSkillCatalogueProposal.entries.filter(
    (entry) => entry.competencyType === "specialization",
  );
  const approvedGroupIds = new Set(targetLearningGroupCatalogue.groups.map((group) => group.id));

  const groupsById = new Map<string, V2LearningGroup>();
  for (const group of competencyContentV2LearningGroups) {
    if (groupsById.has(group.id)) fail(`duplicate proposed group ${group.id}`);
    groupsById.set(group.id, group);
    if (!group.fixedSkillIds.length && !group.selectionSlots?.length)
      fail(`group ${group.id} teaches nothing`);
    for (const skillId of group.fixedSkillIds) {
      const entry =
        entries.get(skillId) ?? fail(`group ${group.id} names unknown Skill ${skillId}`);
      if (entry.competencyType !== "base-skill")
        fail(
          `group ${group.id} lists ${skillId} as a base Skill, but it is a ${entry.competencyType}`,
        );
    }
    if (new Set(group.fixedSkillIds).size !== group.fixedSkillIds.length)
      fail(`group ${group.id} repeats a fixed Skill`);
    for (const specializationId of group.specializationIds ?? []) {
      const entry =
        entries.get(specializationId) ??
        fail(`group ${group.id} names unknown Specialization ${specializationId}`);
      if (entry.competencyType !== "specialization")
        fail(`group ${group.id} lists ${specializationId} as a Specialization, but it is not`);
    }
    const slotIds = new Set<string>();
    for (const slot of group.selectionSlots ?? []) {
      if (slotIds.has(slot.id)) fail(`group ${group.id} repeats slot ${slot.id}`);
      slotIds.add(slot.id);
      if (slot.chooseCount < 1) fail(`slot ${group.id}/${slot.id} must choose at least one`);
      if (slot.chooseCount > slot.candidateSkillIds.length)
        fail(`slot ${group.id}/${slot.id} chooses more candidates than it offers`);
      if (new Set(slot.candidateSkillIds).size !== slot.candidateSkillIds.length)
        fail(`slot ${group.id}/${slot.id} repeats a candidate`);
      for (const candidateId of slot.candidateSkillIds) {
        const entry =
          entries.get(candidateId) ??
          fail(`slot ${group.id}/${slot.id} names unknown Skill ${candidateId}`);
        if (entry.competencyType !== "base-skill")
          fail(`slot ${group.id}/${slot.id} candidate ${candidateId} is not a base Skill`);
        if (group.fixedSkillIds.includes(candidateId))
          fail(
            `slot ${group.id}/${slot.id} offers ${candidateId}, which the group already teaches`,
          );
      }
    }
    for (const supersededId of group.supersedes ?? [])
      if (!approvedGroupIds.has(supersededId))
        fail(`group ${group.id} supersedes unknown approved group ${supersededId}`);
  }

  for (const removed of competencyContentV2RemovedGroups) {
    if (!approvedGroupIds.has(removed.id)) fail(`removes unknown approved group ${removed.id}`);
    if (groupsById.has(removed.id)) fail(`group ${removed.id} is both removed and proposed`);
    for (const replacementId of removed.replacedBy)
      if (!groupsById.has(replacementId))
        fail(`removed group ${removed.id} points at unknown replacement ${replacementId}`);
  }
  const accountedFor = new Set([
    ...groupsById.keys(),
    ...competencyContentV2RemovedGroups.map((removed) => removed.id),
  ]);
  for (const approvedId of approvedGroupIds)
    if (!accountedFor.has(approvedId))
      fail(`approved group ${approvedId} is neither carried forward nor explicitly removed`);

  const paths: BreadthPath[] = [];
  const skillRoutes = new Map<string, Set<string>>();
  const specializationRoutes = new Map<string, Set<string>>();
  const parentGaps: {
    professionCode: string;
    specializationId: string;
    parentId: string;
  }[] = [];
  let groupOpportunities = 0;
  let directSkillOpportunities = 0;
  let directSpecializationOpportunities = 0;

  const familyCodes = new Set<string>();
  const familyIds = new Set<string>();
  for (const family of competencyContentV2Families) {
    if (familyCodes.has(family.code) || familyIds.has(family.id))
      fail(`duplicate family ${family.code}`);
    familyCodes.add(family.code);
    familyIds.add(family.id);

    for (const { id, name, bodies } of pathBodies(family)) {
      const fixed = new Set<string>();
      const reachableSpecializations = new Set<string>();
      const groupIds: string[] = [];
      let slotSelections = 0;

      for (const body of bodies) {
        if (
          ((body.skillIds?.length ?? 0) > 0 || (body.specializationIds?.length ?? 0) > 0) &&
          !body.directRoute?.trim()
        )
          fail(`${id} supplies direct competencies without a stated route`);
        for (const route of body.groups ?? []) {
          const group =
            groupsById.get(route.groupId) ??
            fail(`${family.code} names unknown proposed group ${route.groupId}`);
          if (!route.route.trim()) fail(`${family.code} route to ${route.groupId} has no label`);
          if (groupIds.includes(group.id)) fail(`${id} reaches ${group.id} twice`);
          groupIds.push(group.id);
          for (const skillId of group.fixedSkillIds) fixed.add(skillId);
          for (const specializationId of group.specializationIds ?? [])
            reachableSpecializations.add(specializationId);
          for (const slot of group.selectionSlots ?? []) slotSelections += slot.chooseCount;
        }
        for (const skillId of body.skillIds ?? []) {
          const entry =
            entries.get(skillId) ?? fail(`${family.code} names unknown Skill ${skillId}`);
          if (entry.competencyType !== "base-skill")
            fail(
              `${family.code} lists ${skillId} as a direct Skill, but it is a ${entry.competencyType}`,
            );
          fixed.add(skillId);
        }
        for (const specializationId of body.specializationIds ?? []) {
          const entry =
            entries.get(specializationId) ??
            fail(`${family.code} names unknown Specialization ${specializationId}`);
          if (entry.competencyType !== "specialization")
            fail(`${family.code} lists ${specializationId} as a Specialization, but it is not`);
          reachableSpecializations.add(specializationId);
        }
      }

      for (const specializationId of reachableSpecializations) {
        const parentId = entries.get(specializationId)?.parent?.id;
        if (parentId && !fixed.has(parentId) && !reachableSpecializations.has(parentId))
          parentGaps.push({ professionCode: family.code, specializationId, parentId });
      }

      for (const skillId of fixed) {
        if (!skillRoutes.has(skillId)) skillRoutes.set(skillId, new Set());
        skillRoutes.get(skillId)!.add(family.code);
      }
      for (const group of groupIds.map((groupId) => groupsById.get(groupId)!))
        for (const slot of group.selectionSlots ?? [])
          for (const candidateId of slot.candidateSkillIds) {
            if (!skillRoutes.has(candidateId)) skillRoutes.set(candidateId, new Set());
            skillRoutes.get(candidateId)!.add(family.code);
          }
      for (const specializationId of reachableSpecializations) {
        if (!specializationRoutes.has(specializationId))
          specializationRoutes.set(specializationId, new Set());
        specializationRoutes.get(specializationId)!.add(family.code);
      }

      paths.push({
        professionCode: family.code,
        professionName: family.name,
        pathId: id,
        pathName: name,
        groupIds,
        fixedSkillIds: [...fixed].sort(),
        slotSelections,
        effectiveBreadthNominal: fixed.size + slotSelections,
        effectiveBreadthMinimum: fixed.size,
        reachableSpecializationIds: [...reachableSpecializations].sort(),
      });
    }

    groupOpportunities +=
      (family.groups?.length ?? 0) +
      (family.tracks ?? []).reduce((sum, track) => sum + (track.groups?.length ?? 0), 0);
    directSkillOpportunities +=
      (family.skillIds?.length ?? 0) +
      (family.tracks ?? []).reduce((sum, track) => sum + (track.skillIds?.length ?? 0), 0);
    directSpecializationOpportunities +=
      (family.specializationIds?.length ?? 0) +
      (family.tracks ?? []).reduce((sum, track) => sum + (track.specializationIds?.length ?? 0), 0);
  }

  const groupedSkillIds = new Set(
    competencyContentV2LearningGroups.flatMap((group) => [
      ...group.fixedSkillIds,
      ...(group.selectionSlots ?? []).flatMap((slot) => slot.candidateSkillIds),
    ]),
  );

  const categories = [...baseSkills, ...specializations].map((entry) => {
    const categoryId =
      competencyContentV2CategoryOverrides[entry.id] ??
      (entry.competencyType === "specialization"
        ? (competencyContentV2CategoryOverrides[entry.parent?.id ?? ""] ??
          competencyContentV2CategoryByDomain[entry.domain])
        : competencyContentV2CategoryByDomain[entry.domain]);
    if (!categoryId) fail(`no player-facing category for ${entry.id} (domain ${entry.domain})`);
    if ((categoryId as string) === COMPETENCY_CONTENT_V2_RETIRED_CATEGORY_ID)
      fail(
        `${entry.id} is still assigned the retired ${COMPETENCY_CONTENT_V2_RETIRED_CATEGORY_ID} bucket`,
      );
    return { competencyId: entry.id, name: entry.name, categoryId };
  });

  const catalogue = {
    schemaVersion: COMPETENCY_CONTENT_V2_SCHEMA_VERSION,
    status: COMPETENCY_CONTENT_V2_STATUS,
    groups: competencyContentV2LearningGroups,
    families: competencyContentV2Families,
    paths,
    categories,
    coverage: {
      baseSkills: baseSkills.length,
      baseSkillsInAGroup: baseSkills.filter((entry) => groupedSkillIds.has(entry.id)).length,
      baseSkillsWithAnyRoute: baseSkills.filter((entry) => skillRoutes.has(entry.id)).length,
      baseSkillsWithoutAnyRoute: baseSkills
        .filter((entry) => !skillRoutes.has(entry.id))
        .map((entry) => ({ id: entry.id, name: entry.name })),
      specializationsWithAnyRoute: specializations.filter((entry) =>
        specializationRoutes.has(entry.id),
      ).length,
      specializationsWithoutAnyRoute: specializations
        .filter((entry) => !specializationRoutes.has(entry.id))
        .map((entry) => ({ id: entry.id, name: entry.name })),
      specializationsWhoseParentIsUnreachableInTheSameFamily: parentGaps,
    },
  };

  return {
    ...catalogue,
    manifest: {
      groups: competencyContentV2LearningGroups.length,
      retainedGroups: competencyContentV2LearningGroups.filter((g) => g.disposition === "retained")
        .length,
      revisedGroups: competencyContentV2LearningGroups.filter((g) => g.disposition === "revised")
        .length,
      newGroups: competencyContentV2LearningGroups.filter((g) => g.disposition === "new").length,
      removedGroups: competencyContentV2RemovedGroups.length,
      groupsWithSelectionSlots: competencyContentV2LearningGroups.filter(
        (g) => (g.selectionSlots?.length ?? 0) > 0,
      ).length,
      selectionSlots: competencyContentV2LearningGroups.reduce(
        (sum, g) => sum + (g.selectionSlots?.length ?? 0),
        0,
      ),
      families: competencyContentV2Families.length,
      validPaths: paths.length,
      groupOpportunities,
      directSkillOpportunities,
      directSpecializationOpportunities,
      digest: canonicalJsonSha256(catalogue),
    },
  };
}

export interface CompetencyContentV2Analysis {
  approved: BreadthDistribution;
  proposed: BreadthDistribution;
  proposedMinimum: BreadthDistribution;
  approvedPaths: BreadthPath[];
  proposedPaths: BreadthPath[];
  belowTarget: { professionCode: string; pathName: string; effectiveBreadthNominal: number }[];
}

export function analyseCompetencyContentV2(): CompetencyContentV2Analysis {
  const approvedPaths = measureApprovedBaseline();
  const catalogue = buildCompetencyContentV2Catalogue();
  const narrowByDesign = new Set(
    competencyContentV2Families
      .filter((family) => family.narrowByDesign)
      .map((family) => family.code),
  );
  return {
    approved: summarizeBreadth(approvedPaths.map((path) => path.effectiveBreadthNominal)),
    proposed: summarizeBreadth(catalogue.paths.map((path) => path.effectiveBreadthNominal)),
    proposedMinimum: summarizeBreadth(catalogue.paths.map((path) => path.effectiveBreadthMinimum)),
    approvedPaths,
    proposedPaths: catalogue.paths,
    belowTarget: catalogue.paths
      .filter(
        (path) =>
          path.effectiveBreadthNominal < TARGET_EFFECTIVE_BREADTH &&
          !narrowByDesign.has(path.professionCode),
      )
      .map((path) => ({
        professionCode: path.professionCode,
        pathName: path.pathName,
        effectiveBreadthNominal: path.effectiveBreadthNominal,
      })),
  };
}

export const competencyContentV2Catalogue = buildCompetencyContentV2Catalogue();
export { competencyContentV2CivilizationLanguages, TARGET_EFFECTIVE_BREADTH };
