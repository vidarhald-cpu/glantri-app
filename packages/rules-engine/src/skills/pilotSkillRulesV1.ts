import {
  PILOT_SKILL_COMPETENCE_BANDS,
  PILOT_SKILL_ECONOMIC_WEIGHTS,
  PILOT_SKILL_RELATIONSHIP_STRENGTHS,
  PILOT_SPECIALIZATION_ECONOMIC_WEIGHTS,
  type PilotSkillCompetenceBandId,
  type PilotSkillEconomicWeight,
  type PilotSpecializationEconomicWeight,
} from "@glantri/domain";

import {
  assertPilotNonNegativeInteger,
  assertPilotPositiveInteger,
  PilotSkillRulesInputError,
  type PilotSkillAcquisition,
  type PilotSkillBuildInput,
  type PilotSkillBuildResult,
  type PilotSkillCompetencyDefinition,
  type PilotSkillCompetencyResult,
  type PilotSkillGroupBundleResult,
  type PilotSkillGroupCompetencyExplanation,
  type PilotSkillGroupMembershipExplanation,
  type PilotSkillLearningGroup,
  type PilotSkillRelationship,
  type PilotSkillRelationshipCandidate,
  type PilotSpecializationEvaluation,
} from "./pilotSkillRulesV1Contracts";

export * from "./pilotSkillRulesV1Contracts";
export * from "./pilotSkillRulesV1Support";

function buildCompetencyMap(
  competencies: readonly PilotSkillCompetencyDefinition[],
): Map<string, PilotSkillCompetencyDefinition> {
  const byId = new Map<string, PilotSkillCompetencyDefinition>();

  for (const competency of competencies) {
    if (!competency.id.trim()) {
      throw new PilotSkillRulesInputError(
        "PILOT_SKILL_EMPTY_COMPETENCY_ID",
        "Competency IDs must be non-empty.",
      );
    }
    if (byId.has(competency.id)) {
      throw new PilotSkillRulesInputError(
        "PILOT_SKILL_DUPLICATE_COMPETENCY_ID",
        `Competency ID "${competency.id}" is duplicated.`,
      );
    }
    if (competency.kind === "specialization") {
      if (!competency.specialization) {
        throw new PilotSkillRulesInputError(
          "PILOT_SKILL_MISSING_SPECIALIZATION_ECONOMICS",
          `Specialization "${competency.id}" needs Pilot v1 economics and prerequisites.`,
        );
      }
      if (
        !PILOT_SPECIALIZATION_ECONOMIC_WEIGHTS.includes(competency.specialization.acquisitionWeight)
      ) {
        throw new PilotSkillRulesInputError(
          "PILOT_SKILL_INVALID_SPECIALIZATION_WEIGHT",
          `Specialization "${competency.id}" has an invalid acquisition weight.`,
        );
      }
    } else if (
      competency.weight === undefined ||
      !PILOT_SKILL_ECONOMIC_WEIGHTS.includes(competency.weight)
    ) {
      throw new PilotSkillRulesInputError(
        "PILOT_SKILL_INVALID_ECONOMIC_WEIGHT",
        `Competency "${competency.id}" must have economic weight 1, 2, or 3.`,
      );
    }

    byId.set(competency.id, competency);
  }

  for (const competency of competencies) {
    for (const prerequisite of competency.specialization?.prerequisites ?? []) {
      if (!byId.has(prerequisite.competencyId)) {
        throw new PilotSkillRulesInputError(
          "PILOT_SKILL_UNKNOWN_SPECIALIZATION_PREREQUISITE",
          `Specialization "${competency.id}" references unknown prerequisite "${prerequisite.competencyId}".`,
        );
      }
      assertPilotPositiveInteger(
        prerequisite.threshold,
        `Specialization "${competency.id}" prerequisite threshold`,
      );
      if (
        prerequisite.threshold !== 6 &&
        prerequisite.threshold !== 11 &&
        !prerequisite.justification?.trim()
      ) {
        throw new PilotSkillRulesInputError(
          "PILOT_SKILL_NONSTANDARD_SPECIALIZATION_THRESHOLD_NEEDS_JUSTIFICATION",
          `Specialization "${competency.id}" uses threshold ${prerequisite.threshold}; thresholds other than 6 or 11 need authored justification.`,
        );
      }
    }
  }

  return byId;
}

function sumAcquisitions(
  acquisitions: readonly PilotSkillAcquisition[],
  competencyById: ReadonlyMap<string, PilotSkillCompetencyDefinition>,
  label: string,
): Map<string, number> {
  const ranksById = new Map<string, number>();

  for (const acquisition of acquisitions) {
    if (!competencyById.has(acquisition.competencyId)) {
      throw new PilotSkillRulesInputError(
        "PILOT_SKILL_UNKNOWN_ACQUISITION_TARGET",
        `${label} references unknown competency "${acquisition.competencyId}".`,
      );
    }
    assertPilotNonNegativeInteger(acquisition.ranks, `${label} ranks`);
    ranksById.set(
      acquisition.competencyId,
      (ranksById.get(acquisition.competencyId) ?? 0) + acquisition.ranks,
    );
  }

  return ranksById;
}

function compareRelationshipCandidates(
  left: PilotSkillRelationshipCandidate,
  right: PilotSkillRelationshipCandidate,
): number {
  return (
    right.candidateCompetence - left.candidateCompetence ||
    left.relationshipId.localeCompare(right.relationshipId) ||
    left.sourceCompetencyId.localeCompare(right.sourceCompetencyId)
  );
}

function resolveRelationshipCandidates(input: {
  acquiredBaseByCompetencyId: ReadonlyMap<string, number>;
  competencyById: ReadonlyMap<string, PilotSkillCompetencyDefinition>;
  relationships: readonly PilotSkillRelationship[];
}): Map<string, PilotSkillRelationshipCandidate[]> {
  const candidatesByTargetId = new Map<string, PilotSkillRelationshipCandidate[]>();
  const relationshipIds = new Set<string>();

  for (const relationship of input.relationships) {
    if (relationshipIds.has(relationship.id)) {
      throw new PilotSkillRulesInputError(
        "PILOT_SKILL_DUPLICATE_RELATIONSHIP_ID",
        `Relationship ID "${relationship.id}" is duplicated.`,
      );
    }
    relationshipIds.add(relationship.id);

    if (!input.competencyById.has(relationship.sourceCompetencyId)) {
      throw new PilotSkillRulesInputError(
        "PILOT_SKILL_UNKNOWN_RELATIONSHIP_SOURCE",
        `Relationship "${relationship.id}" references unknown source "${relationship.sourceCompetencyId}".`,
      );
    }
    if (!input.competencyById.has(relationship.targetCompetencyId)) {
      throw new PilotSkillRulesInputError(
        "PILOT_SKILL_UNKNOWN_RELATIONSHIP_TARGET",
        `Relationship "${relationship.id}" references unknown target "${relationship.targetCompetencyId}".`,
      );
    }
    if (relationship.sourceCompetencyId === relationship.targetCompetencyId) {
      throw new PilotSkillRulesInputError(
        "PILOT_SKILL_SELF_RELATIONSHIP",
        `Relationship "${relationship.id}" cannot target its own source.`,
      );
    }
    if (!PILOT_SKILL_RELATIONSHIP_STRENGTHS.includes(relationship.strength)) {
      throw new PilotSkillRulesInputError(
        "PILOT_SKILL_INVALID_RELATIONSHIP_STRENGTH",
        `Relationship "${relationship.id}" must use 100, 75, 50, or 25 percent.`,
      );
    }

    const sourceBaseCompetence =
      input.acquiredBaseByCompetencyId.get(relationship.sourceCompetencyId) ?? 0;
    const candidate: PilotSkillRelationshipCandidate = {
      candidateCompetence: Math.floor((sourceBaseCompetence * relationship.strength) / 100),
      relationshipId: relationship.id,
      sourceBaseCompetence,
      sourceCompetencyId: relationship.sourceCompetencyId,
      strength: relationship.strength,
      targetCompetencyId: relationship.targetCompetencyId,
    };
    const targetCandidates = candidatesByTargetId.get(relationship.targetCompetencyId) ?? [];
    targetCandidates.push(candidate);
    candidatesByTargetId.set(relationship.targetCompetencyId, targetCandidates);
  }

  for (const candidates of candidatesByTargetId.values()) {
    candidates.sort(compareRelationshipCandidates);
  }

  return candidatesByTargetId;
}

export function calculatePilotDirectSkillCost(
  weight: PilotSkillEconomicWeight,
  acquiredRanks: number,
): number {
  if (!PILOT_SKILL_ECONOMIC_WEIGHTS.includes(weight)) {
    throw new PilotSkillRulesInputError(
      "PILOT_SKILL_INVALID_ECONOMIC_WEIGHT",
      `Direct Skill weight must be 1, 2, or 3; received ${weight}.`,
    );
  }
  assertPilotNonNegativeInteger(acquiredRanks, "Direct acquired ranks");
  return weight * acquiredRanks;
}

export function calculatePilotSpecializationAcquisitionCost(input: {
  acquiredRanks: number;
  alreadyOwned?: boolean;
  weight: PilotSpecializationEconomicWeight;
}): number {
  if (!PILOT_SPECIALIZATION_ECONOMIC_WEIGHTS.includes(input.weight)) {
    throw new PilotSkillRulesInputError(
      "PILOT_SKILL_INVALID_SPECIALIZATION_WEIGHT",
      `Specialization weight must be 1 or 2; received ${input.weight}.`,
    );
  }
  assertPilotNonNegativeInteger(input.acquiredRanks, "Specialization acquired ranks");
  if (input.acquiredRanks === 0) {
    return 0;
  }

  return input.weight * input.acquiredRanks + (input.alreadyOwned ? 0 : 2);
}

export function getPilotSkillCompetenceBand(
  competence: number,
): "untrained" | PilotSkillCompetenceBandId {
  assertPilotNonNegativeInteger(competence, "Competence");

  if (competence === 0) {
    return "untrained";
  }

  return [...PILOT_SKILL_COMPETENCE_BANDS].reverse().find((band) => competence >= band.minimum)!.id;
}

function getBestGroupCandidates(input: {
  competencyById: ReadonlyMap<string, PilotSkillCompetencyDefinition>;
  groups: readonly PilotSkillLearningGroup[];
}): Map<
  string,
  Array<{ competencyId: string; groupId: string; groupLevel: number; groupName: string }>
> {
  const candidatesByCompetencyId = new Map<
    string,
    Array<{ competencyId: string; groupId: string; groupLevel: number; groupName: string }>
  >();
  const groupIds = new Set<string>();

  for (const group of input.groups) {
    if (groupIds.has(group.id)) {
      throw new PilotSkillRulesInputError(
        "PILOT_SKILL_DUPLICATE_GROUP_ID",
        `Learning group ID "${group.id}" is duplicated.`,
      );
    }
    groupIds.add(group.id);
    assertPilotNonNegativeInteger(group.level, `Learning group "${group.id}" level`);

    for (const competencyId of new Set(group.competencyIds)) {
      const competency = input.competencyById.get(competencyId);
      if (!competency) {
        throw new PilotSkillRulesInputError(
          "PILOT_SKILL_UNKNOWN_GROUP_MEMBER",
          `Learning group "${group.id}" references unknown competency "${competencyId}".`,
        );
      }
      if (competency.kind === "specialization") {
        throw new PilotSkillRulesInputError(
          "PILOT_SKILL_SPECIALIZATION_CANNOT_BE_GROUP_MEMBER",
          `Specialization "${competencyId}" cannot receive group competence in Pilot v1.`,
        );
      }

      const candidates = candidatesByCompetencyId.get(competencyId) ?? [];
      candidates.push({
        competencyId,
        groupId: group.id,
        groupLevel: group.level,
        groupName: group.name,
      });
      candidatesByCompetencyId.set(competencyId, candidates);
    }
  }

  for (const candidates of candidatesByCompetencyId.values()) {
    candidates.sort(
      (left, right) =>
        right.groupLevel - left.groupLevel ||
        left.groupId.localeCompare(right.groupId) ||
        left.groupName.localeCompare(right.groupName),
    );
  }

  return candidatesByCompetencyId;
}

export function calculatePilotLearningGroupBundle(input: {
  competencies: readonly PilotSkillCompetencyDefinition[];
  groups: readonly PilotSkillLearningGroup[];
  relationships?: readonly PilotSkillRelationship[];
}): PilotSkillGroupBundleResult {
  const competencyById = buildCompetencyMap(input.competencies);
  const groupCandidatesByCompetencyId = getBestGroupCandidates({
    competencyById,
    groups: input.groups,
  });
  const groupBaseByCompetencyId = new Map(
    input.competencies.map((competency) => [
      competency.id,
      groupCandidatesByCompetencyId.get(competency.id)?.[0]?.groupLevel ?? 0,
    ]),
  );
  const relationshipCandidatesByTargetId = resolveRelationshipCandidates({
    acquiredBaseByCompetencyId: groupBaseByCompetencyId,
    competencyById,
    relationships: input.relationships ?? [],
  });
  const byCompetencyId: Record<string, PilotSkillGroupCompetencyExplanation> = {};
  const memberships: PilotSkillGroupMembershipExplanation[] = [];
  let weightedUsefulIncrement = 0;

  for (const competencyId of [...groupCandidatesByCompetencyId.keys()].sort()) {
    const competency = competencyById.get(competencyId)!;
    const candidates = groupCandidatesByCompetencyId.get(competencyId)!;
    const best = candidates[0]!;
    const relationshipFloor =
      relationshipCandidatesByTargetId.get(competencyId)?.[0]?.candidateCompetence ?? 0;
    const usefulIncrementalCompetence = Math.max(0, best.groupLevel - relationshipFloor);
    const weightedUseful = usefulIncrementalCompetence * competency.weight!;
    weightedUsefulIncrement += weightedUseful;
    byCompetencyId[competencyId] = {
      bestGroupContribution: best.groupLevel,
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
    bundleCost: Math.ceil((2 * weightedUsefulIncrement) / 3),
    byCompetencyId,
    memberships,
    weightedUsefulIncrement,
  };
}

export function calculatePilotSkillBuild(input: PilotSkillBuildInput): PilotSkillBuildResult {
  const competencyById = buildCompetencyMap(input.competencies);
  const directRanksById = sumAcquisitions(
    input.directAcquisitions ?? [],
    competencyById,
    "Direct acquisition",
  );
  const grantedRanksById = sumAcquisitions(
    input.grantedAcquisitions ?? [],
    competencyById,
    "Granted acquisition",
  );
  const groupCandidatesByCompetencyId = getBestGroupCandidates({
    competencyById,
    groups: input.groups ?? [],
  });
  const groupBundle = calculatePilotLearningGroupBundle({
    competencies: input.competencies,
    groups: input.groups ?? [],
    relationships: input.relationships,
  });
  const acquiredBaseByCompetencyId = new Map<string, number>();

  for (const competency of input.competencies) {
    acquiredBaseByCompetencyId.set(
      competency.id,
      (directRanksById.get(competency.id) ?? 0) +
        (grantedRanksById.get(competency.id) ?? 0) +
        (groupCandidatesByCompetencyId.get(competency.id)?.[0]?.groupLevel ?? 0),
    );
  }

  const relationshipCandidatesByTargetId = resolveRelationshipCandidates({
    acquiredBaseByCompetencyId,
    competencyById,
    relationships: input.relationships ?? [],
  });
  const byCompetencyId: Record<string, PilotSkillCompetencyResult> = {};
  let directCost = 0;
  let specializationCost = 0;

  for (const competency of input.competencies) {
    const directRanks = directRanksById.get(competency.id) ?? 0;
    const grantedRanks = grantedRanksById.get(competency.id) ?? 0;
    const groupContribution =
      groupCandidatesByCompetencyId.get(competency.id)?.[0]?.groupLevel ?? 0;
    const acquiredBaseCompetence = acquiredBaseByCompetencyId.get(competency.id) ?? 0;
    const relationshipCandidates = relationshipCandidatesByTargetId.get(competency.id) ?? [];
    const selectedRelationship = relationshipCandidates[0];
    const relationshipFloor = selectedRelationship?.candidateCompetence ?? 0;
    const relationshipTargetBlockedUntilAcquired =
      competency.kind === "specialization" && acquiredBaseCompetence === 0;
    const effectiveCompetence = relationshipTargetBlockedUntilAcquired
      ? 0
      : Math.max(acquiredBaseCompetence, relationshipFloor);
    let specialization: PilotSpecializationEvaluation | undefined;

    if (competency.kind === "specialization") {
      const prerequisites = competency.specialization!.prerequisites.map((prerequisite) => {
        const prerequisiteBase = acquiredBaseByCompetencyId.get(prerequisite.competencyId) ?? 0;
        return {
          acquiredBaseCompetence: prerequisiteBase,
          competencyId: prerequisite.competencyId,
          met: prerequisiteBase >= prerequisite.threshold,
          threshold: prerequisite.threshold,
        };
      });
      specialization = {
        acquiredRanks: acquiredBaseCompetence,
        eligible: prerequisites.every((prerequisite) => prerequisite.met),
        owned: acquiredBaseCompetence >= 1,
        prerequisites,
      };
      specializationCost += calculatePilotSpecializationAcquisitionCost({
        acquiredRanks: directRanks,
        weight: competency.specialization!.acquisitionWeight,
      });
    } else {
      directCost += calculatePilotDirectSkillCost(competency.weight!, directRanks);
    }

    byCompetencyId[competency.id] = {
      acquiredBaseCompetence,
      competenceBand: getPilotSkillCompetenceBand(effectiveCompetence),
      competencyId: competency.id,
      directRanks,
      effectiveCompetence,
      grantedRanks,
      groupContribution,
      relationshipCandidates,
      relationshipFloor,
      relationshipGoverns:
        !relationshipTargetBlockedUntilAcquired && relationshipFloor > acquiredBaseCompetence,
      relationshipTargetBlockedUntilAcquired,
      selectedRelationship,
      specialization,
    };
  }

  return {
    byCompetencyId,
    directCost,
    groupBundle,
    specializationCost,
    totalCost: directCost + specializationCost + groupBundle.bundleCost,
    v1RelationshipPolicy: {
      candidateRounding: "floor-before-selection",
      recursion: "non-recursive-temporary-pilot-limitation",
      reverseEdges: "explicit-only",
      sourceSelection: "strongest-result-then-relationship-id",
    },
  };
}
