export const DEVELOPMENT_STAGES = ["DS1", "DS2", "DS3", "DS4", "DS5", "DS6"] as const;
export type DevelopmentStage = (typeof DEVELOPMENT_STAGES)[number];

export const ACCESS_BANDS = ["AB1", "AB2", "AB3", "AB4"] as const;
export type AccessBand = (typeof ACCESS_BANDS)[number];

export type SkillEconomicClass = "primary" | "secondary";

interface SemanticNodeBase {
  id: string;
  name: string;
}

export interface SkillDomainSemanticNode extends SemanticNodeBase {
  kind: "domain";
  purchasable: false;
  xpBearing: false;
}

export interface SkillCategorySemanticNode extends SemanticNodeBase {
  categoryMembershipIsMechanical: false;
  domainId: string;
  kind: "category";
  purchasable: false;
  xpBearing: false;
}

export interface ConcreteSkillSemanticNode extends SemanticNodeBase {
  categoryIds: readonly string[];
  domainId: string;
  economicClass: SkillEconomicClass;
  kind: "skill";
  purchasable: true;
  xpBearing: true;
}

export interface SkillSpecializationSemanticNode extends SemanticNodeBase {
  domainId: string;
  economicClass: SkillEconomicClass;
  kind: "specialization";
  parentSkillId: string;
  purchasable: true;
  xpBearing: true;
}

export type SkillSemanticNode =
  | SkillDomainSemanticNode
  | SkillCategorySemanticNode
  | ConcreteSkillSemanticNode
  | SkillSpecializationSemanticNode;

export type LearningHistoryKind =
  | "apprenticeship"
  | "campaign"
  | "crew"
  | "household"
  | "institution"
  | "office"
  | "unit"
  | "workshop";

export interface LearningHistorySemanticFixture {
  basis: "shared-training-history";
  competencyIds: readonly string[];
  id: string;
  identity: {
    kind: LearningHistoryKind;
    name: string;
    sharedContext: string;
  };
}

export type SkillRelationshipEffect =
  | "familiarity"
  | "learning-advantage"
  | "prerequisite"
  | "reinforcement"
  | "specialization";

export interface SkillRelationshipPolicy {
  availability: "availability-first";
  recursion: "non-recursive";
  sourceSelection: "strongest-source-only";
  sourceValues: "authored-only";
  stacking: "non-stacking";
}

export interface SkillRelationshipSemanticFixture {
  effect: SkillRelationshipEffect;
  id: string;
  sourceCompetencyId: string;
  sourceValue: "authored";
  targetCompetencyId: string;
}

export interface CampaignLanguageEntitySemanticFixture {
  authoredBy: {
    campaignId: string;
    kind: "campaign";
  };
  id: string;
  kind: "script" | "spoken-language";
  name: string;
}

export interface LanguageCompetencySemanticFixture {
  competencyId: string;
  entityId: string;
  facets?: readonly ("reading" | "writing")[];
  mode: "spoken" | "written";
}

export interface LanguageSemanticPolicy {
  allowCampaignAuthoredStableIds: true;
  closedVocabulary: false;
  universalLiteracySkill: false;
}

export interface CivilizationAccessRouteSemanticFixture {
  accessBand: AccessBand;
  channel: string;
  competencyIds: readonly string[];
}

export interface AvailabilityExceptionSemanticFixture {
  attribution: string;
  basis: "biography" | "contact" | "domain-override" | "institution" | "teacher";
  competencyId: string;
}

export interface CivilizationProfileSemanticFixture {
  accessRoutes: readonly CivilizationAccessRouteSemanticFixture[];
  availabilityExceptions: readonly AvailabilityExceptionSemanticFixture[];
  defaultAvailableCompetencyIds: readonly string[];
  developmentStage: DevelopmentStage;
  id: string;
  name: string;
}

/**
 * Design-only evidence for the accepted Skills architecture. These fixtures are not
 * CanonicalContent and must not be used by runtime eligibility, costs, advancement, or persistence.
 */
export interface SkillSemanticFixture {
  civilizationProfiles: readonly CivilizationProfileSemanticFixture[];
  id: string;
  languageCompetencies: readonly LanguageCompetencySemanticFixture[];
  languageEntities: readonly CampaignLanguageEntitySemanticFixture[];
  languagePolicy: LanguageSemanticPolicy;
  learningHistories: readonly LearningHistorySemanticFixture[];
  nodes: readonly SkillSemanticNode[];
  relationshipPolicy: SkillRelationshipPolicy;
  relationships: readonly SkillRelationshipSemanticFixture[];
  title: string;
}
