import type {
  PilotSkillCompetenceBandId,
  PilotSkillEconomicWeight,
  PilotSkillRelationshipStrength,
  PilotSpecializationEconomicWeight,
  PilotSpecializationPrerequisiteAuthoring,
} from "@glantri/domain";

export type PilotSkillCompetencyKind =
  | "skill"
  | "specialization"
  | "spoken-language"
  | "written-tradition";

export interface PilotSkillCompetencyDefinition {
  id: string;
  kind: PilotSkillCompetencyKind;
  name: string;
  specialization?: {
    acquisitionWeight: PilotSpecializationEconomicWeight;
    prerequisites: readonly PilotSpecializationPrerequisiteAuthoring[];
  };
  weight?: PilotSkillEconomicWeight;
}

export interface PilotSkillAcquisition {
  competencyId: string;
  ranks: number;
}

export interface PilotSkillGrantedAcquisition extends PilotSkillAcquisition {
  sourceId: string;
  sourceKind: "background" | "society" | "other-explicit-grant";
}

export interface PilotSkillLearningGroup {
  competencyIds: readonly string[];
  id: string;
  level: number;
  name: string;
}

export interface PilotSkillRelationship {
  id: string;
  sourceCompetencyId: string;
  strength: PilotSkillRelationshipStrength;
  targetCompetencyId: string;
}

export interface PilotSkillRelationshipCandidate {
  candidateCompetence: number;
  relationshipId: string;
  sourceBaseCompetence: number;
  sourceCompetencyId: string;
  strength: PilotSkillRelationshipStrength;
  targetCompetencyId: string;
}

export interface PilotSkillGroupMembershipExplanation {
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

export interface PilotSkillGroupCompetencyExplanation {
  bestGroupContribution: number;
  competencyId: string;
  relationshipFloorBeforeOwnGroupContribution: number;
  usefulIncrementalCompetence: number;
  weightedUsefulIncrement: number;
}

export interface PilotSkillGroupBundleResult {
  bundleCost: number;
  byCompetencyId: Record<string, PilotSkillGroupCompetencyExplanation>;
  memberships: PilotSkillGroupMembershipExplanation[];
  weightedUsefulIncrement: number;
}

export interface PilotSpecializationEvaluation {
  acquiredRanks: number;
  eligible: boolean;
  owned: boolean;
  prerequisites: Array<{
    acquiredBaseCompetence: number;
    competencyId: string;
    met: boolean;
    threshold: number;
  }>;
}

export interface PilotSkillCompetencyResult {
  acquiredBaseCompetence: number;
  competenceBand: "untrained" | PilotSkillCompetenceBandId;
  competencyId: string;
  directRanks: number;
  effectiveCompetence: number;
  grantSources: PilotSkillGrantedAcquisition[];
  grantedRanks: number;
  groupContribution: number;
  relationshipCandidates: PilotSkillRelationshipCandidate[];
  relationshipFloor: number;
  relationshipGoverns: boolean;
  relationshipTargetBlockedUntilAcquired: boolean;
  selectedRelationship?: PilotSkillRelationshipCandidate;
  specialization?: PilotSpecializationEvaluation;
}

export interface PilotSkillBuildInput {
  competencies: readonly PilotSkillCompetencyDefinition[];
  directAcquisitions?: readonly PilotSkillAcquisition[];
  grantedAcquisitions?: readonly PilotSkillGrantedAcquisition[];
  groups?: readonly PilotSkillLearningGroup[];
  professionId?: string;
  relationships?: readonly PilotSkillRelationship[];
}

export interface PilotSkillBuildResult {
  byCompetencyId: Record<string, PilotSkillCompetencyResult>;
  directCost: number;
  groupBundle: PilotSkillGroupBundleResult;
  specializationCost: number;
  totalCost: number;
  v1RelationshipPolicy: {
    candidateRounding: "floor-before-selection";
    recursion: "non-recursive-temporary-pilot-limitation";
    reverseEdges: "explicit-only";
    sourceSelection: "strongest-result-then-relationship-id";
  };
}

export class PilotSkillRulesInputError extends Error {
  constructor(
    readonly code: string,
    message: string,
  ) {
    super(`${code}: ${message}`);
    this.name = "PilotSkillRulesInputError";
  }
}

export function assertPilotNonNegativeInteger(value: number, label: string): void {
  if (!Number.isInteger(value) || value < 0) {
    throw new PilotSkillRulesInputError(
      "PILOT_SKILL_INVALID_NON_NEGATIVE_INTEGER",
      `${label} must be a non-negative integer; received ${value}.`,
    );
  }
}

export function assertPilotPositiveInteger(value: number, label: string): void {
  if (!Number.isInteger(value) || value <= 0) {
    throw new PilotSkillRulesInputError(
      "PILOT_SKILL_INVALID_POSITIVE_INTEGER",
      `${label} must be a positive integer; received ${value}.`,
    );
  }
}
