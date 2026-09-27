/**
 * Canonical Learning Group acquisition arithmetic.
 *
 * This is the single deterministic rules calculation for what a Learning Group bundle is
 * worth and what it costs. Both acquisition paths consume it:
 *
 * - the Pilot/runtime path, through `calculatePilotLearningGroupBundle`;
 * - the Chargen path, through `packages/rules-engine/src/chargen/primaryAllocation/costs.ts`.
 *
 * The rules implemented here are the approved Pilot v1 rules
 * (`docs/rules/pilot-skill-rules-v1.md` section 4, and "Overlapping Learning Groups do not
 * stack" in `docs/rules/competency-rules.md`):
 *
 * 1. only the strongest applicable Learning Group contributes to a competency;
 * 2. competency relationships establish non-additive minimum floors;
 * 3. a Group contribution that yields no useful competence produces no corresponding price.
 *
 * ```text
 * G_s            = highest contribution among the memberships supplied for s
 * usefulGroup_s  = max(0, G_s - relationshipFloor_s)
 * weightedUseful = sum(weight_s * usefulGroup_s)
 * bundle cost    = ceil(2/3 * weightedUseful)
 * ```
 *
 * The ceiling is applied once to a complete bundle, never per group and never per rank, so
 * the price cannot be decomposed into a level-independent per-group scalar.
 */

/** One competency that may receive Learning Group competence, with its economic weight. */
export interface LearningGroupCompetencyInput {
  competencyId: string;
  /**
   * Strongest floor-rounded incoming relationship result for this competency, sourced only by
   * group competence in the bundle. Competence already guaranteed by a floor is not useful
   * group competence and is therefore not priced.
   */
  relationshipFloor?: number;
  /** Economic weight, in the consuming path's own point unit. */
  weight: number;
}

/** One Learning Group membership offering `groupLevel` competence in `competencyId`. */
export interface LearningGroupMembershipInput {
  competencyId: string;
  groupId: string;
  groupLevel: number;
  groupName: string;
  /** Authored presentation order, where the consuming path has one. */
  groupSortOrder?: number;
}

export interface LearningGroupMembershipCandidate {
  groupId: string;
  groupLevel: number;
  groupName: string;
  groupSortOrder: number;
}

export interface LearningGroupCompetencyResult {
  bestGroupContribution: number;
  bestGroupId: string;
  competencyId: string;
  relationshipFloorBeforeOwnGroupContribution: number;
  usefulIncrementalCompetence: number;
  weightedUsefulIncrement: number;
}

export interface LearningGroupMembershipResult {
  competencyId: string;
  groupId: string;
  groupLevel: number;
  groupName: string;
  relationshipOverlapCompetence: number;
  selectedAsStrongest: boolean;
  suppressedByGroupId?: string;
  suppressedByGroupLevel?: number;
  usefulIncrementalCompetence: number;
  weightedUsefulIncrement: number;
}

export interface LearningGroupAcquisitionResult {
  /** `ceil(2/3 * weightedUsefulIncrement)` over every supplied membership. */
  bundleCost: number;
  byCompetencyId: Record<string, LearningGroupCompetencyResult>;
  memberships: LearningGroupMembershipResult[];
  weightedUsefulIncrement: number;
}

/**
 * Pilot v1 ordering: strongest contribution first, then the lexicographically first group
 * identity. Consuming paths with an authored presentation order supply their own comparator.
 */
export function compareLearningGroupMembershipCandidates(
  left: LearningGroupMembershipCandidate,
  right: LearningGroupMembershipCandidate,
): number {
  return (
    right.groupLevel - left.groupLevel ||
    left.groupId.localeCompare(right.groupId) ||
    left.groupName.localeCompare(right.groupName)
  );
}

/** The one canonical group-bundle price. Applied once to a complete bundle. */
export function priceLearningGroupBundle(weightedUsefulIncrement: number): number {
  return Math.ceil((2 * weightedUsefulIncrement) / 3);
}

export function calculateLearningGroupAcquisition(input: {
  competencies: readonly LearningGroupCompetencyInput[];
  compareCandidates?: (
    left: LearningGroupMembershipCandidate,
    right: LearningGroupMembershipCandidate,
  ) => number;
  memberships: readonly LearningGroupMembershipInput[];
}): LearningGroupAcquisitionResult {
  const compareCandidates = input.compareCandidates ?? compareLearningGroupMembershipCandidates;
  const competencyById = new Map(
    input.competencies.map((competency) => [competency.competencyId, competency]),
  );
  const candidatesByCompetencyId = new Map<string, LearningGroupMembershipCandidate[]>();

  for (const membership of input.memberships) {
    if (!competencyById.has(membership.competencyId)) {
      continue;
    }

    const candidates = candidatesByCompetencyId.get(membership.competencyId) ?? [];
    candidates.push({
      groupId: membership.groupId,
      groupLevel: membership.groupLevel,
      groupName: membership.groupName,
      groupSortOrder: membership.groupSortOrder ?? Number.MAX_SAFE_INTEGER,
    });
    candidatesByCompetencyId.set(membership.competencyId, candidates);
  }

  for (const candidates of candidatesByCompetencyId.values()) {
    candidates.sort(compareCandidates);
  }

  const byCompetencyId: Record<string, LearningGroupCompetencyResult> = {};
  const memberships: LearningGroupMembershipResult[] = [];
  let weightedUsefulIncrement = 0;

  for (const competencyId of [...candidatesByCompetencyId.keys()].sort()) {
    const competency = competencyById.get(competencyId)!;
    const candidates = candidatesByCompetencyId.get(competencyId)!;
    const best = candidates[0]!;
    const relationshipFloor = competency.relationshipFloor ?? 0;
    const usefulIncrementalCompetence = Math.max(0, best.groupLevel - relationshipFloor);
    const weightedUseful = usefulIncrementalCompetence * competency.weight;

    weightedUsefulIncrement += weightedUseful;
    byCompetencyId[competencyId] = {
      bestGroupContribution: best.groupLevel,
      bestGroupId: best.groupId,
      competencyId,
      relationshipFloorBeforeOwnGroupContribution: relationshipFloor,
      usefulIncrementalCompetence,
      weightedUsefulIncrement: weightedUseful,
    };

    for (const candidate of candidates) {
      const selectedAsStrongest = candidate === best;

      memberships.push({
        competencyId,
        groupId: candidate.groupId,
        groupLevel: candidate.groupLevel,
        groupName: candidate.groupName,
        relationshipOverlapCompetence: selectedAsStrongest
          ? Math.min(best.groupLevel, relationshipFloor)
          : 0,
        selectedAsStrongest,
        suppressedByGroupId: selectedAsStrongest ? undefined : best.groupId,
        suppressedByGroupLevel: selectedAsStrongest ? undefined : best.groupLevel,
        usefulIncrementalCompetence: selectedAsStrongest ? usefulIncrementalCompetence : 0,
        weightedUsefulIncrement: selectedAsStrongest ? weightedUseful : 0,
      });
    }
  }

  memberships.sort(
    (left, right) =>
      left.groupId.localeCompare(right.groupId) ||
      left.competencyId.localeCompare(right.competencyId),
  );

  return {
    bundleCost: priceLearningGroupBundle(weightedUsefulIncrement),
    byCompetencyId,
    memberships,
    weightedUsefulIncrement,
  };
}
