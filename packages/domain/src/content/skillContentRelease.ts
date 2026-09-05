import type {
  PilotSkillAccessAvailability,
  PilotSkillAccessExceptionBasis,
  PilotSkillEconomicWeight,
  PilotSkillRelationshipStrength,
  PilotSpecializationEconomicWeight,
  PilotSpecializationPrerequisiteAuthoring,
  SkillCatalogueAuthoringStatus,
  SkillCatalogueRecordMetadata,
  SkillLearningGroupSelectionSlot,
  SkillTaskEnvelope,
} from "./skillCatalogueAuthoring";
import type { AccessBand, DevelopmentStage } from "./skillSemanticFixtures";

export const SKILL_CONTENT_RELEASE_SCHEMA_VERSION = "skill-content-release/v2" as const;
export const SKILL_CONTENT_RELEASE_SERIALIZATION = "canonical-json-lexicographic-keys/v1" as const;

export const SKILL_CONTENT_COMPATIBILITY_CLASSIFICATIONS = [
  "presentation-only",
  "mechanically-compatible",
  "migration-review-required",
] as const;
export type SkillContentCompatibilityClassification =
  (typeof SKILL_CONTENT_COMPATIBILITY_CLASSIFICATIONS)[number];

export interface SkillContentRecordDocumentation {
  description: string;
  name: string;
  shortDescription: string;
  shortLabel: string;
  taskEnvelope: SkillTaskEnvelope;
}

export interface SkillContentDomainRecord {
  description: string;
  id: string;
  kind: "domain";
  mechanics: "none";
  metadata: SkillCatalogueRecordMetadata;
  name: string;
}

export interface SkillContentScriptRecord {
  description: string;
  familyIds: readonly string[];
  id: string;
  kind: "script";
  metadata: SkillCatalogueRecordMetadata;
  name: string;
}

interface SkillContentCompetencyRecordBase extends SkillContentRecordDocumentation {
  domainId: string;
  id: string;
  metadata: SkillCatalogueRecordMetadata;
  prerequisites: readonly PilotSpecializationPrerequisiteAuthoring[];
  weight: PilotSkillEconomicWeight;
}

export interface SkillContentSkillRecord extends SkillContentCompetencyRecordBase {
  kind: "skill";
}

export interface SkillContentSpokenLanguageRecord extends SkillContentCompetencyRecordBase {
  familyIds: readonly string[];
  kind: "spoken-language";
}

export interface SkillContentWrittenTraditionRecord extends SkillContentCompetencyRecordBase {
  kind: "written-tradition";
  scriptId: string;
  spokenLanguageId: string;
}

export interface SkillContentSpecializationRecord extends SkillContentCompetencyRecordBase {
  acquisitionWeight: PilotSpecializationEconomicWeight;
  kind: "specialization";
  parentCompetencyId: string;
  transfer:
    | { kind: "explicit-relationships"; relationshipIds: readonly string[] }
    | { kind: "zero-transfer"; rationale: string };
}

export type SkillContentCompetencyRecord =
  | SkillContentSkillRecord
  | SkillContentSpokenLanguageRecord
  | SkillContentSpecializationRecord
  | SkillContentWrittenTraditionRecord;

export interface SkillContentRelationshipRecord {
  direction: "source-to-target";
  id: string;
  metadata: SkillCatalogueRecordMetadata;
  rationale: string;
  sourceCompetencyId: string;
  strength: PilotSkillRelationshipStrength;
  targetCompetencyId: string;
}

export interface SkillContentLearningHistoryRecord {
  context: string;
  fixedCompetencyIds: readonly string[];
  id: string;
  metadata: SkillCatalogueRecordMetadata;
  name: string;
  selectionSlots: readonly SkillLearningGroupSelectionSlot[];
}

export interface SkillContentAccessRoute {
  accessBand: AccessBand;
  competencyIds: readonly string[];
  description: string;
  id: string;
  metadata: SkillCatalogueRecordMetadata;
}

export interface SkillContentApplicabilityOverride {
  attributionId: string;
  availability: PilotSkillAccessAvailability;
  competencyIds: readonly string[];
  explanation: string;
}

export interface SkillContentApplicabilityProfile {
  accessBand: AccessBand;
  developmentStage: DevelopmentStage;
  id: string;
  metadata: SkillCatalogueRecordMetadata;
  name: string;
  normalRoutes: readonly SkillContentAccessRoute[];
  overrides: readonly SkillContentApplicabilityOverride[];
}

export interface SkillContentAccessException {
  basis: PilotSkillAccessExceptionBasis;
  competencyIds: readonly string[];
  explanation: string;
  grantsCompetence: 0;
  historyIds: readonly string[];
  id: string;
  metadata: SkillCatalogueRecordMetadata;
  profileId: string;
}

export interface SkillContentReleaseCompatibility {
  characterMigrationReviewRequired: boolean;
  classification: SkillContentCompatibilityClassification;
  rationale: string;
}

export interface SkillContentReleaseManifest {
  counts: {
    accessExceptions: number;
    competencies: number;
    domains: number;
    histories: number;
    profiles: number;
    relationships: number;
    scripts: number;
  };
  packageDigest: `sha256:${string}`;
  semanticDigest: `sha256:${string}`;
  serialization: typeof SKILL_CONTENT_RELEASE_SERIALIZATION;
}

/**
 * Additive documentation-complete content contract. Existing v1 releases remain valid under their
 * own immutable schema and are never coerced into this shape.
 */
export interface SkillContentRelease {
  accessExceptions: readonly SkillContentAccessException[];
  compatibility: SkillContentReleaseCompatibility;
  competencies: readonly SkillContentCompetencyRecord[];
  contentVersion: string;
  domains: readonly SkillContentDomainRecord[];
  histories: readonly SkillContentLearningHistoryRecord[];
  id: string;
  manifest: SkillContentReleaseManifest;
  profiles: readonly SkillContentApplicabilityProfile[];
  provenance: readonly string[];
  relationships: readonly SkillContentRelationshipRecord[];
  rulesVersion: string;
  schemaVersion: typeof SKILL_CONTENT_RELEASE_SCHEMA_VERSION;
  scripts: readonly SkillContentScriptRecord[];
  status: Extract<SkillCatalogueAuthoringStatus, "canonical" | "proposal">;
  title: string;
}

export interface SkillContentReferenceProjection {
  contentVersion: string;
  id: string;
  manifest: SkillContentReleaseManifest;
  records: {
    competencies: readonly SkillContentCompetencyRecord[];
    domains: readonly SkillContentDomainRecord[];
    histories: readonly SkillContentLearningHistoryRecord[];
    profiles: readonly SkillContentApplicabilityProfile[];
    relationships: readonly SkillContentRelationshipRecord[];
    scripts: readonly SkillContentScriptRecord[];
  };
  status: SkillContentRelease["status"];
  title: string;
}
