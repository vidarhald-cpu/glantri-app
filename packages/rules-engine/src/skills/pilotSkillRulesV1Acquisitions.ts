import {
  assertPilotNonNegativeInteger,
  PilotSkillRulesInputError,
  type PilotSkillAcquisition,
  type PilotSkillCompetencyDefinition,
  type PilotSkillGrantedAcquisition,
} from "./pilotSkillRulesV1Contracts";

export function sumPilotSkillAcquisitions(
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

export function collectPilotSkillGrantSources(
  grants: readonly PilotSkillGrantedAcquisition[],
): Map<string, PilotSkillGrantedAcquisition[]> {
  const byCompetencyId = new Map<string, PilotSkillGrantedAcquisition[]>();

  for (const grant of grants) {
    const sources = byCompetencyId.get(grant.competencyId) ?? [];
    sources.push({ ...grant });
    byCompetencyId.set(grant.competencyId, sources);
  }

  for (const sources of byCompetencyId.values()) {
    sources.sort(
      (left, right) =>
        left.sourceKind.localeCompare(right.sourceKind) ||
        left.sourceId.localeCompare(right.sourceId) ||
        left.ranks - right.ranks,
    );
  }

  return byCompetencyId;
}

export function enforcePilotSpecializationPrerequisites(
  competencies: readonly PilotSkillCompetencyDefinition[],
  requestedBaseByCompetencyId: ReadonlyMap<string, number>,
): Map<string, number> {
  const acceptedBaseByCompetencyId = new Map(requestedBaseByCompetencyId);

  for (let pass = 0; pass < competencies.length; pass += 1) {
    let changed = false;

    for (const competency of competencies) {
      if (competency.kind !== "specialization") {
        continue;
      }
      const eligible = competency.specialization!.prerequisites.every(
        (prerequisite) =>
          (acceptedBaseByCompetencyId.get(prerequisite.competencyId) ?? 0) >=
          prerequisite.threshold,
      );
      const acceptedBase = eligible ? (requestedBaseByCompetencyId.get(competency.id) ?? 0) : 0;
      if (acceptedBaseByCompetencyId.get(competency.id) !== acceptedBase) {
        acceptedBaseByCompetencyId.set(competency.id, acceptedBase);
        changed = true;
      }
    }

    if (!changed) {
      break;
    }
  }

  return acceptedBaseByCompetencyId;
}
