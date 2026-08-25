import type { AccessBand, DevelopmentStage } from "./skillSemanticFixtures";

export const SKILL_CATALOGUE_AUTHORING_SCHEMA_VERSION = "skill-catalogue-authoring/v1" as const;

export const SKILL_CATALOGUE_AUTHORING_STATUSES = [
  "canonical",
  "proposal",
  "evidence",
  "legacy",
] as const;
export type SkillCatalogueAuthoringStatus = (typeof SKILL_CATALOGUE_AUTHORING_STATUSES)[number];

export const PROVISIONAL_SKILL_SCOPE_CLASSES = [
  "narrow",
  "ordinary",
  "broad",
  "specialist",
] as const;
export type ProvisionalSkillScopeClass = (typeof PROVISIONAL_SKILL_SCOPE_CLASSES)[number];

export interface SkillCatalogueRecordProvenance {
  kind: "decision" | "evidence" | "legacy" | "proposal";
  reference: string;
  note?: string;
}

export interface SkillCatalogueRecordMetadata {
  recordVersion: string;
  status: SkillCatalogueAuthoringStatus;
  provenance: SkillCatalogueRecordProvenance;
}

interface SkillCatalogueAuthoredRecord {
  id: string;
  metadata: SkillCatalogueRecordMetadata;
  name: string;
}

interface NonMechanicalAuthoringIdentity extends SkillCatalogueAuthoredRecord {
  mechanics: "none";
  purchasable: false;
  xpBearing: false;
}

export interface SkillCatalogueDomainAuthoringRecord extends NonMechanicalAuthoringIdentity {
  description: string;
  kind: "domain";
}

export interface SkillCatalogueCategoryAuthoringRecord extends NonMechanicalAuthoringIdentity {
  description: string;
  domainIds: readonly string[];
  kind: "category";
  membershipMeaning: "navigation-only";
}

export interface SkillTaskEnvelope {
  coreTasks: readonly string[];
  limits: readonly string[];
  methods: readonly string[];
  useGuidance: string;
}

/**
 * Editorial comparison metadata only. It deliberately has no number, cost, or runtime pricing
 * authority while the final skill-weight scale remains a control-plane decision.
 */
export interface ProvisionalSkillEconomicWeight {
  pricingAuthority: "none";
  rationale: string;
  relativeScope: ProvisionalSkillScopeClass;
  status: "provisional";
}

interface ConcreteCompetencyAuthoringRecord extends SkillCatalogueAuthoredRecord {
  categoryIds: readonly string[];
  description: string;
  domainId: string;
  economicWeight: ProvisionalSkillEconomicWeight;
  purchasable: true;
  taskEnvelope: SkillTaskEnvelope;
  xpBearing: true;
}

export interface ConcreteSkillCatalogueAuthoringRecord extends ConcreteCompetencyAuthoringRecord {
  kind: "skill";
}

export interface SkillSpecializationCatalogueAuthoringRecord extends ConcreteCompetencyAuthoringRecord {
  basePrerequisiteEdgeIds: readonly string[];
  kind: "specialization";
  transferEdgeIds: readonly string[];
}

export interface SpokenLanguageCatalogueAuthoringRecord extends ConcreteCompetencyAuthoringRecord {
  familyIds: readonly string[];
  kind: "spoken-language";
}

export interface ScriptCatalogueAuthoringRecord extends NonMechanicalAuthoringIdentity {
  description: string;
  familyIds: readonly string[];
  kind: "script";
}

export interface WrittenTraditionCatalogueAuthoringRecord extends ConcreteCompetencyAuthoringRecord {
  kind: "written-tradition";
  scriptId: string;
  spokenLanguageId: string;
}

export interface LanguageFamilyCatalogueAuthoringRecord extends NonMechanicalAuthoringIdentity {
  description: string;
  kind: "language-family";
  memberIds: readonly string[];
  membershipMeaning: "authoring-only";
}

export interface ScriptFamilyCatalogueAuthoringRecord extends NonMechanicalAuthoringIdentity {
  description: string;
  kind: "script-family";
  memberIds: readonly string[];
  membershipMeaning: "authoring-only";
}

export type SkillCatalogueFamilyAuthoringRecord =
  | LanguageFamilyCatalogueAuthoringRecord
  | ScriptFamilyCatalogueAuthoringRecord;

export type SkillCatalogueCompetencyAuthoringRecord =
  | ConcreteSkillCatalogueAuthoringRecord
  | SkillSpecializationCatalogueAuthoringRecord
  | SpokenLanguageCatalogueAuthoringRecord
  | WrittenTraditionCatalogueAuthoringRecord;

export const SKILL_LEARNING_CONTEXT_KINDS = [
  "apprenticeship",
  "campaign",
  "crew",
  "household",
  "institution",
  "office",
  "teacher",
  "unit",
  "workshop",
] as const;
export type SkillLearningContextKind = (typeof SKILL_LEARNING_CONTEXT_KINDS)[number];

export interface SkillLearningGroupSelectionSlot {
  candidateCompetencyIds: readonly string[];
  chooseCount: number;
  id: string;
  label: string;
}

export interface SkillLearningGroupAuthoringRecord extends SkillCatalogueAuthoredRecord {
  context: {
    description: string;
    kind: SkillLearningContextKind;
  };
  fixedCompetencyIds: readonly string[];
  kind: "learning-group";
  selectedMemberships: readonly SkillLearningGroupSelectionSlot[];
}

interface SkillCatalogueRelationshipAuthoringRecordBase extends SkillCatalogueAuthoredRecord {
  direction: "source-to-target";
  reverseEdge: "not-inferred";
  sourceCompetencyId: string;
  targetCompetencyId: string;
}

export interface InclusionSkillRelationshipAuthoringRecord extends SkillCatalogueRelationshipAuthoringRecordBase {
  includedCorePercent: 100;
  kind: "inclusion";
  semantics: "complete-core-task-envelope";
}

export interface RelatedSkillRelationshipAuthoringRecord extends SkillCatalogueRelationshipAuthoringRecordBase {
  calibration: "unresolved";
  effect: "familiarity" | "learning-advantage" | "reinforcement" | "transfer";
  kind: "related";
}

export interface PrerequisiteSkillRelationshipAuthoringRecord extends SkillCatalogueRelationshipAuthoringRecordBase {
  enforcement: "not-implemented";
  kind: "prerequisite";
  threshold: {
    label: string;
    status: "placeholder";
  };
}

export type SkillCatalogueRelationshipAuthoringRecord =
  | InclusionSkillRelationshipAuthoringRecord
  | PrerequisiteSkillRelationshipAuthoringRecord
  | RelatedSkillRelationshipAuthoringRecord;

export interface SkillApplicabilityDefaultAuthoringRecord {
  availability: "available" | "restricted" | "unavailable";
  competencyId: string;
  note: string;
}

export interface SkillAccessBandDefaultAuthoringRecord {
  accessBand: AccessBand;
  competencyIds: readonly string[];
  routeDescription: string;
}

export interface SkillApplicabilityOverrideAuthoringRecord {
  attributionId: string;
  availability: "available" | "restricted" | "unavailable";
  basis: "biography" | "contact" | "institution" | "profile" | "teacher";
  competencyId: string;
  explanation: string;
}

export interface SkillApplicabilityProfileAuthoringRecord extends SkillCatalogueAuthoredRecord {
  accessBandDefaults: readonly SkillAccessBandDefaultAuthoringRecord[];
  defaults: readonly SkillApplicabilityDefaultAuthoringRecord[];
  developmentStage: DevelopmentStage;
  eligibilityEnforcement: "not-implemented";
  kind: "applicability-profile";
  overrides: readonly SkillApplicabilityOverrideAuthoringRecord[];
}

export interface SkillCatalogueAuthoringDocument {
  applicabilityProfiles: readonly SkillApplicabilityProfileAuthoringRecord[];
  catalogueVersion: string;
  categories: readonly SkillCatalogueCategoryAuthoringRecord[];
  domains: readonly SkillCatalogueDomainAuthoringRecord[];
  families: readonly SkillCatalogueFamilyAuthoringRecord[];
  id: string;
  kind: "skill-catalogue-authoring";
  learningGroups: readonly SkillLearningGroupAuthoringRecord[];
  policies: {
    categoryAndFamilyMechanics: "none";
    inclusionSemantics: "explicit-directed-100-percent";
    relationshipArithmetic: "unresolved-except-inclusion";
    relationshipInference: "explicit-edges-only";
    relationshipSourceCombination: "non-stacking";
    reverseRelationships: "not-inferred";
    runtimeEligibility: "not-implemented";
    runtimePricing: "not-implemented";
  };
  relationships: readonly SkillCatalogueRelationshipAuthoringRecord[];
  runtimeIntegration: "none";
  schemaVersion: typeof SKILL_CATALOGUE_AUTHORING_SCHEMA_VERSION;
  scripts: readonly ScriptCatalogueAuthoringRecord[];
  skills: readonly ConcreteSkillCatalogueAuthoringRecord[];
  specializations: readonly SkillSpecializationCatalogueAuthoringRecord[];
  spokenLanguages: readonly SpokenLanguageCatalogueAuthoringRecord[];
  title: string;
  writtenTraditions: readonly WrittenTraditionCatalogueAuthoringRecord[];
}
