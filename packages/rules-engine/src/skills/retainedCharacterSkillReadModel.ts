import {
  getPilotSkillCharacterBuildInput,
  pilotSkillContentReleaseV1,
  validatePilotSkillContentRelease,
} from "@glantri/content";
import {
  PILOT_SKILL_CONTENT_DIGEST,
  PILOT_SKILL_CONTENT_RELEASE_ID,
  PILOT_SKILL_CONTENT_VERSION,
  PILOT_SKILL_RULES_RELEASE_ID,
  type CharacterEffectiveSkillProjection,
  type CharacterEffectiveSkillRow,
  type CharacterProvenancePerspective,
  type CharacterRevisionRecord,
  type RetainedCharacterState,
} from "@glantri/domain";

import {
  calculatePilotSkillBuild,
  evaluatePilotChargenBudget,
  validatePilotSkillFinalization,
  type PilotSkillBuildResult,
} from "./pilotSkillRulesV1";

export class RetainedCharacterRulesError extends Error {
  constructor(
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "RetainedCharacterRulesError";
  }
}

export function assertCanonicalPilotRelease(): void {
  const validation = validatePilotSkillContentRelease(pilotSkillContentReleaseV1);
  if (
    !validation.valid ||
    pilotSkillContentReleaseV1.id !== PILOT_SKILL_CONTENT_RELEASE_ID ||
    pilotSkillContentReleaseV1.contentVersion !== PILOT_SKILL_CONTENT_VERSION ||
    pilotSkillContentReleaseV1.manifest.payloadDigest !== PILOT_SKILL_CONTENT_DIGEST ||
    pilotSkillContentReleaseV1.rulesVersion !== PILOT_SKILL_RULES_RELEASE_ID
  ) {
    throw new RetainedCharacterRulesError(
      "RETAINED_CHARACTER_CANONICAL_RELEASE_UNAVAILABLE",
      "The exact accepted Pilot Skills content release is not available.",
    );
  }
}

export function createRetainedCharacterStateFromPilotRelease(input: {
  characterId: string;
  pilotCharacterId: string;
}): RetainedCharacterState {
  assertCanonicalPilotRelease();
  const fixture = pilotSkillContentReleaseV1.characters.find(
    (candidate) => candidate.id === input.pilotCharacterId,
  );
  if (!fixture) {
    throw new RetainedCharacterRulesError(
      "RETAINED_CHARACTER_UNKNOWN_PILOT_CHARACTER",
      `Unknown retained Pilot Character "${input.pilotCharacterId}".`,
    );
  }
  const background = pilotSkillContentReleaseV1.backgrounds.find(
    (candidate) => candidate.id === fixture.backgroundId,
  )!;

  return {
    backgroundId: fixture.backgroundId,
    directAcquisitions: fixture.directAcquisitions.map((entry) => ({ ...entry })),
    grants: [
      {
        competencyId: background.startingSpokenLanguageId,
        ranks: fixture.startingSpokenLanguageRanks,
        sourceId: background.id,
        sourceKind: "background",
      },
    ],
    histories: fixture.histories.map((selection, index) => {
      const definition = pilotSkillContentReleaseV1.histories.find(
        (candidate) => candidate.id === selection.historyId,
      )!;
      return {
        competencyIds: [...definition.fixedCompetencyIds, ...selection.selectedCompetencyIds],
        definitionId: definition.id,
        definitionLabel: definition.name,
        instanceId: `${input.characterId}:history:${index + 1}:${definition.id}`,
        level: selection.level,
        selectedCompetencyIds: [...selection.selectedCompetencyIds],
      };
    }),
    pilotCharacterId: fixture.id,
    professionId: fixture.professionId,
    specializationAcquisitions: fixture.specializationAcquisitions.map((entry) => ({ ...entry })),
  };
}

function buildPilotInputFromRetainedState(state: RetainedCharacterState) {
  const canonical = getPilotSkillCharacterBuildInput(
    pilotSkillContentReleaseV1,
    state.pilotCharacterId,
  );
  return {
    ...canonical,
    directAcquisitions: [...state.directAcquisitions, ...state.specializationAcquisitions],
    grantedAcquisitions: state.grants,
    groups: state.histories.map((history) => ({
      competencyIds: history.competencyIds,
      id: history.instanceId,
      level: history.level,
      name: history.definitionLabel,
    })),
    professionId: state.professionId,
  };
}

export function calculateRetainedCharacterSkills(state: RetainedCharacterState): {
  pilotResult: PilotSkillBuildResult;
  rows: CharacterEffectiveSkillRow[];
} {
  assertCanonicalPilotRelease();
  const input = buildPilotInputFromRetainedState(state);
  const pilotResult = calculatePilotSkillBuild(input);
  const competencyById = new Map(input.competencies.map((entry) => [entry.id, entry]));
  const historyByInstanceId = new Map(state.histories.map((entry) => [entry.instanceId, entry]));

  const rows = Object.values(pilotResult.byCompetencyId)
    .map((result): CharacterEffectiveSkillRow => {
      const definition = competencyById.get(result.competencyId)!;
      const groupCandidates = pilotResult.groupBundle.memberships
        .filter((membership) => membership.competencyId === result.competencyId)
        .map((membership) => ({
          historyInstanceId: membership.groupId,
          historyLabel:
            historyByInstanceId.get(membership.groupId)?.definitionLabel ?? membership.groupName,
          level: membership.groupLevel,
          selectedAsStrongest: membership.selectedAsStrongest,
          suppressedByHistoryInstanceId: membership.suppressedByGroupId,
          usefulIncrementalCompetence: membership.usefulIncrementalCompetence,
        }));
      const suppressedOverlaps = groupCandidates.filter(
        (candidate) => !candidate.selectedAsStrongest,
      );
      const relationshipCandidates = result.relationshipCandidates.map((candidate) => ({
        candidateCompetence: candidate.candidateCompetence,
        relationshipId: candidate.relationshipId,
        sourceAcquiredBase: candidate.sourceBaseCompetence,
        sourceCompetencyId: candidate.sourceCompetencyId,
        strength: candidate.strength,
      }));
      const parts = [
        result.directRanks > 0 ? `${result.directRanks} acquired directly` : undefined,
        result.grantedRanks > 0 ? `${result.grantedRanks} granted` : undefined,
        result.groupContribution > 0
          ? `${result.groupContribution} from strongest learning history`
          : undefined,
        result.relationshipGoverns
          ? `${result.relationshipFloor} from related competence`
          : undefined,
      ].filter(Boolean);

      return {
        acquiredBase: result.acquiredBaseCompetence,
        competenceBand: result.competenceBand,
        competencyId: result.competencyId,
        competencyKind: definition.kind,
        displayName: definition.name,
        directAcquisition: result.directRanks,
        effectiveLevel: result.effectiveCompetence,
        explicitGrants: result.grantedRanks,
        groupCandidates,
        publicExplanation: parts.length > 0 ? parts.join(", ") : "No acquired competence",
        relationshipCandidates,
        relationshipDerivedContribution: Math.max(
          0,
          result.relationshipFloor - result.acquiredBaseCompetence,
        ),
        selectedRelationshipId: result.selectedRelationship?.relationshipId,
        strongestHistoryContribution: result.groupContribution,
        specialization: result.specialization
          ? {
              acquiredRanks: result.specialization.acquiredRanks,
              eligible: result.specialization.eligible,
              owned: result.specialization.owned,
              state: "active",
            }
          : undefined,
        suppressedOverlaps,
      };
    })
    .sort((left, right) => left.competencyId.localeCompare(right.competencyId));

  return { pilotResult, rows };
}

export function validateRetainedCharacterHeadlessChargen(input: {
  flexBudget: number;
  formationBudget: number;
  state: RetainedCharacterState;
}): { flexSpent: number; formationSpent: number; totalCost: number } {
  const { pilotResult } = calculateRetainedCharacterSkills(input.state);
  const finalization = validatePilotSkillFinalization({
    build: pilotResult,
    competencies: buildPilotInputFromRetainedState(input.state).competencies,
  });
  if (!finalization.valid) {
    throw new RetainedCharacterRulesError(
      finalization.errors[0]!.code,
      finalization.errors[0]!.message,
    );
  }
  const budget = evaluatePilotChargenBudget({
    configuration: {
      flexBudget: input.flexBudget,
      formationBudget: input.formationBudget,
    },
    purchases: [
      {
        access: "available",
        cost: pilotResult.totalCost,
        formationEligible: true,
        id: "retained-character-total",
      },
    ],
  });
  if (!budget.valid) {
    throw new RetainedCharacterRulesError(
      budget.errors[0]!.code,
      "The retained Character exceeds the pinned Chargen budgets.",
    );
  }
  return {
    flexSpent: budget.flexSpent,
    formationSpent: budget.formationSpent,
    totalCost: pilotResult.totalCost,
  };
}

function sanitizeSummaryRow(row: CharacterEffectiveSkillRow): CharacterEffectiveSkillRow {
  return {
    ...row,
    directAcquisition: 0,
    explicitGrants: 0,
    groupCandidates: [],
    publicExplanation:
      row.effectiveLevel > 0 ? "Competence acquired through prior experience" : "Untrained",
    relationshipCandidates: [],
    selectedRelationshipId: undefined,
    strongestHistoryContribution: 0,
    suppressedOverlaps: [],
  };
}

function sanitizeOwnerEvent(
  event: CharacterRevisionRecord["events"][number],
): CharacterRevisionRecord["events"][number] {
  if (!event.protectedProvenance) {
    return { ...event, protectedProvenance: undefined };
  }

  return {
    ...event,
    economics: undefined,
    prerequisiteEvidence: undefined,
    protectedProvenance: undefined,
    publicExplanation: "Acquisition retained from a protected source.",
    sourceId: "protected-source",
    sourceKind: "protected",
    sourceLabel: "Protected source",
  };
}

function sanitizeOwnerSkillRows(revision: CharacterRevisionRecord): CharacterEffectiveSkillRow[] {
  const protectedHistoryIds = revision.events
    .filter(
      (entry) =>
        entry.component === "history" &&
        entry.targetKind === "history" &&
        entry.protectedProvenance,
    )
    .map((entry) => entry.targetId);
  const protectedHistoryAliases = new Map(
    protectedHistoryIds.map((historyId, index) => [historyId, `protected-history-${index + 1}`]),
  );
  const sanitizeCandidate = (candidate: CharacterEffectiveSkillRow["groupCandidates"][number]) => {
    const alias = protectedHistoryAliases.get(candidate.historyInstanceId);
    const suppressedAlias = candidate.suppressedByHistoryInstanceId
      ? protectedHistoryAliases.get(candidate.suppressedByHistoryInstanceId)
      : undefined;
    return {
      ...candidate,
      historyInstanceId: alias ?? candidate.historyInstanceId,
      historyLabel: alias ? "Protected learning history" : candidate.historyLabel,
      suppressedByHistoryInstanceId: suppressedAlias ?? candidate.suppressedByHistoryInstanceId,
    };
  };
  return revision.effectiveSkills.rows.map((row) => ({
    ...row,
    groupCandidates: row.groupCandidates.map(sanitizeCandidate),
    suppressedOverlaps: row.suppressedOverlaps.map(sanitizeCandidate),
  }));
}

export function projectRetainedCharacterRevision(
  revision: CharacterRevisionRecord,
  perspective: CharacterProvenancePerspective,
): CharacterEffectiveSkillProjection | null {
  if (perspective === "uninvolved_player") return null;
  if (perspective === "entitled_player") {
    const {
      calculationDigest: _calculationDigest,
      characterRevisionId: _characterRevisionId,
      ...summarySkills
    } = revision.effectiveSkills;
    return {
      characterId: revision.characterId,
      effectiveSkills: {
        ...summarySkills,
        rows: revision.effectiveSkills.rows
          .filter((row) => row.effectiveLevel > 0)
          .map(sanitizeSummaryRow),
      },
      perspective,
      provenanceDetail: "summary_only",
    };
  }

  const isGmOrAdmin = perspective === "current_campaign_gm" || perspective === "admin";
  return {
    characterId: revision.characterId,
    characterRevisionId: revision.id,
    effectiveSkills:
      perspective === "owner"
        ? { ...revision.effectiveSkills, rows: sanitizeOwnerSkillRows(revision) }
        : revision.effectiveSkills,
    events: revision.events
      .filter((event) => isGmOrAdmin || event.visibility !== "gm_only")
      .map((event) => (isGmOrAdmin ? event : sanitizeOwnerEvent(event))),
    migrationLineage: revision.migrationLineage,
    perspective,
    provenanceDetail: isGmOrAdmin ? "full" : "owner_safe",
    revisionState: revision.revisionState,
  };
}
