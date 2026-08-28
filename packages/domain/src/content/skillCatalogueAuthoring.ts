import type { AccessBand, DevelopmentStage } from "./skillSemanticFixtures";

export const SKILL_CATALOGUE_AUTHORING_SCHEMA_VERSION = "skill-catalogue-authoring/v1" as const;

export const PILOT_SKILL_RULES_VERSION = "pilot-skill-rules/v1" as const;
export type PilotSkillRulesVersion = typeof PILOT_SKILL_RULES_VERSION;

export const PILOT_SKILL_ECONOMIC_WEIGHTS = [1, 2, 3] as const;
export type PilotSkillEconomicWeight = (typeof PILOT_SKILL_ECONOMIC_WEIGHTS)[number];

export const PILOT_SPECIALIZATION_ECONOMIC_WEIGHTS = [1, 2] as const;
export type PilotSpecializationEconomicWeight =
  (typeof PILOT_SPECIALIZATION_ECONOMIC_WEIGHTS)[number];

export const PILOT_SKILL_RELATIONSHIP_STRENGTHS = [100, 75, 50, 25] as const;
export type PilotSkillRelationshipStrength = (typeof PILOT_SKILL_RELATIONSHIP_STRENGTHS)[number];

export const PILOT_SKILL_ACCESS_AVAILABILITIES = [
  "available",
  "restricted",
  "unavailable",
] as const;
export type PilotSkillAccessAvailability = (typeof PILOT_SKILL_ACCESS_AVAILABILITIES)[number];

export const PILOT_SKILL_ACCESS_EXCEPTION_BASES = [
  "biography",
  "contact",
  "domain",
  "institution",
  "profile",
  "teacher",
  "text",
  "tradition",
] as const;
export type PilotSkillAccessExceptionBasis = (typeof PILOT_SKILL_ACCESS_EXCEPTION_BASES)[number];

export const PILOT_SKILL_COMPETENCE_BANDS = [
  { id: "beginner", minimum: 1 },
  { id: "intermediate", minimum: 6 },
  { id: "experienced", minimum: 11 },
  { id: "expert", minimum: 16 },
  { id: "world-class", minimum: 21 },
] as const;
export type PilotSkillCompetenceBandId = (typeof PILOT_SKILL_COMPETENCE_BANDS)[number]["id"];

export interface PilotSkillEconomicWeightAuthoring {
  rationale: string;
  rulesVersion: PilotSkillRulesVersion;
  value: PilotSkillEconomicWeight;
}

export interface PilotSpecializationPrerequisiteAuthoring {
  competencyId: string;
  justification?: string;
  threshold: number;
}

export interface PilotSpecializationEconomicsAuthoring {
  acquisitionWeight: PilotSpecializationEconomicWeight;
  initiationCost: 2;
  prerequisites: readonly PilotSpecializationPrerequisiteAuthoring[];
  rulesVersion: PilotSkillRulesVersion;
}

export interface PilotSkillRelationshipAuthoring {
  id: string;
  rulesVersion: PilotSkillRulesVersion;
  sourceCompetencyId: string;
  strength: PilotSkillRelationshipStrength;
  targetCompetencyId: string;
}

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

export type SkillApplicabilityOverrideBasis =
  | "biography"
  | "contact"
  | "institution"
  | "profile"
  | "teacher"
  | "text"
  | "tradition";

export interface SkillApplicabilityOverrideAuthoringRecord {
  attributionId: string;
  availability: "available" | "restricted" | "unavailable";
  basis: SkillApplicabilityOverrideBasis;
  competencyId: string;
  explanation: string;
}

export interface SkillDomainApplicabilityOverrideAuthoringRecord {
  accessBand: AccessBand;
  attributionId: string;
  availability: "available" | "restricted" | "unavailable";
  basis: SkillApplicabilityOverrideBasis;
  domainId: string;
  explanation: string;
}

export interface SkillApplicabilityProfileAuthoringRecord extends SkillCatalogueAuthoredRecord {
  accessBandDefaults: readonly SkillAccessBandDefaultAuthoringRecord[];
  defaults: readonly SkillApplicabilityDefaultAuthoringRecord[];
  developmentStage: DevelopmentStage;
  domainOverrides: readonly SkillDomainApplicabilityOverrideAuthoringRecord[];
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

/**
 * Canonical, bounded content released for the eight retained pilot Characters. This is an
 * immutable semantic-content contract, not runtime Character persistence or catalogue activation.
 */
export const PILOT_SKILL_CONTENT_RELEASE_SCHEMA_VERSION = "pilot-skill-content-release/v1" as const;

export interface PilotSkillContentCompetencyRecord {
  description: string;
  domainId: string;
  id: string;
  kind: "skill" | "spoken-language" | "written-tradition";
  name: string;
  weight: PilotSkillEconomicWeight;
}

export interface PilotSkillContentSpecializationRecord {
  acquisitionWeight: PilotSpecializationEconomicWeight;
  description: string;
  id: string;
  kind: "specialization";
  name: string;
  prerequisites: readonly PilotSpecializationPrerequisiteAuthoring[];
  transfer:
    | { kind: "explicit-relationships"; relationshipIds: readonly string[] }
    | { kind: "zero-transfer"; rationale: string };
}

export interface PilotSkillContentHistoryRecord {
  context: string;
  fixedCompetencyIds: readonly string[];
  id: string;
  intensity: { maximum: 4; minimum: 1 };
  name: string;
  selectionSlots: readonly SkillLearningGroupSelectionSlot[];
}

export interface PilotSkillContentProfessionRecord {
  id: string;
  mechanics: "none";
  name: string;
  suggestedCompetencyIds: readonly string[];
  suggestedHistoryIds: readonly string[];
}

export interface PilotSkillContentBackgroundRecord {
  id: string;
  name: string;
  profileId: string;
  startingSpokenLanguageId: string;
  startingSpokenLanguageRule: "max(11,education)";
}

export interface PilotSkillContentAccessRoute {
  accessBand: AccessBand;
  competencyIds: readonly string[];
  description: string;
  id: string;
}

export interface PilotSkillContentApplicabilityOverride {
  attributionId: string;
  availability: PilotSkillAccessAvailability;
  competencyIds: readonly string[];
  explanation: string;
}

export interface PilotSkillContentProfileRecord {
  accessBand: AccessBand;
  developmentStage: DevelopmentStage;
  id: string;
  name: string;
  normalRoutes: readonly PilotSkillContentAccessRoute[];
  overrides: readonly PilotSkillContentApplicabilityOverride[];
}

export interface PilotSkillContentAccessExceptionRecord {
  basis: PilotSkillAccessExceptionBasis;
  competencyIds: readonly string[];
  grantsCompetence: 0;
  historyIds: readonly string[];
  id: string;
  profileId: string;
  explanation: string;
}

export interface PilotSkillContentRelationshipRecord extends PilotSkillRelationshipAuthoring {
  direction: "source-to-target";
  futureCascadeRisk: string;
  rationale: string;
  reverseEdge: "not-inferred";
}

export interface PilotSkillContentCharacterHistorySelection {
  historyId: string;
  level: number;
  selectedCompetencyIds: readonly string[];
}

export interface PilotSkillContentCharacterFixture {
  accessExceptionIds: readonly string[];
  backgroundId: string;
  concept: string;
  directAcquisitions: readonly { competencyId: string; ranks: number }[];
  expected: {
    flexSpent: number;
    groupCost: number;
    totalCost: number;
  };
  histories: readonly PilotSkillContentCharacterHistorySelection[];
  id: string;
  professionId: string;
  specializationAcquisitions: readonly { competencyId: string; ranks: 2 }[];
  startingSpokenLanguageRanks: 11;
}

export interface PilotSkillContentReleaseManifest {
  counts: {
    accessExceptions: 4;
    backgrounds: 8;
    characters: 8;
    competencies: 53;
    histories: 17;
    professions: 8;
    profiles: 7;
    relationships: 15;
    specializations: 8;
  };
  payloadDigest: `sha256:${string}`;
  serialization: "canonical-json-lexicographic-keys/v1";
}

export interface PilotSkillContentRelease {
  accessExceptions: readonly PilotSkillContentAccessExceptionRecord[];
  backgrounds: readonly PilotSkillContentBackgroundRecord[];
  characters: readonly PilotSkillContentCharacterFixture[];
  competencies: readonly PilotSkillContentCompetencyRecord[];
  contentVersion: string;
  histories: readonly PilotSkillContentHistoryRecord[];
  id: string;
  manifest: PilotSkillContentReleaseManifest;
  policies: {
    accessGrantsCompetence: 0;
    navigationTaxonomyMechanics: "none";
    professionMechanics: "none";
    relationshipInference: "explicit-directional-only";
    relationshipRecursion: "non-recursive-pilot-v1";
    spokenLanguageImpliesWriting: false;
  };
  professions: readonly PilotSkillContentProfessionRecord[];
  profiles: readonly PilotSkillContentProfileRecord[];
  provenance: readonly string[];
  relationships: readonly PilotSkillContentRelationshipRecord[];
  rulesVersion: PilotSkillRulesVersion;
  schemaVersion: typeof PILOT_SKILL_CONTENT_RELEASE_SCHEMA_VERSION;
  specializations: readonly PilotSkillContentSpecializationRecord[];
  status: "canonical-bounded-pilot";
  title: string;
}
