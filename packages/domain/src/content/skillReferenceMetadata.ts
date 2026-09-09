import type { SkillCatalogueRecordMetadata } from "./skillCatalogueAuthoring";

export const SKILL_REFERENCE_METADATA_SCHEMA_VERSION = "skill-reference-metadata/v1" as const;

export const SKILL_REFERENCE_MEMBERSHIP_PLACEMENTS = [
  "primary",
  "secondary",
  "contextual",
] as const;
export type SkillReferenceMembershipPlacement =
  (typeof SKILL_REFERENCE_MEMBERSHIP_PLACEMENTS)[number];

export const SKILL_REFERENCE_GROUP_MEMBERSHIP_KINDS = ["core", "optional"] as const;
export type SkillReferenceGroupMembershipKind =
  (typeof SKILL_REFERENCE_GROUP_MEMBERSHIP_KINDS)[number];

export const SKILL_REFERENCE_MANIFESTATION_STATUSES = [
  "recorded",
  "unresolved",
  "review-required",
] as const;
export type SkillReferenceManifestationStatus =
  (typeof SKILL_REFERENCE_MANIFESTATION_STATUSES)[number];

export const SKILL_REFERENCE_HISTORICAL_AVAILABILITY_STATUSES = [
  "available",
  "restricted",
  "unavailable",
  "unresolved",
  "review-required",
] as const;
export type SkillReferenceHistoricalAvailabilityStatus =
  (typeof SKILL_REFERENCE_HISTORICAL_AVAILABILITY_STATUSES)[number];

export interface SkillReferenceArchSkillMembership {
  placement: SkillReferenceMembershipPlacement;
  skillId: string;
}

export interface SkillReferenceArchSkill {
  description: string;
  id: string;
  mechanics: "none";
  metadata: SkillCatalogueRecordMetadata;
  membershipMeaning: "navigation-only";
  name: string;
  skillMemberships: readonly SkillReferenceArchSkillMembership[];
}

export interface SkillReferenceLearningGroupMembership {
  kind: SkillReferenceGroupMembershipKind;
  skillId: string;
}

export interface SkillReferenceLearningGroup {
  description: string;
  id: string;
  mechanics: "none";
  metadata: SkillCatalogueRecordMetadata;
  membershipMeaning: "navigation-only";
  name: string;
  skillMemberships: readonly SkillReferenceLearningGroupMembership[];
}

export interface SkillReferenceArchSociety {
  description: string;
  id: string;
  metadata: SkillCatalogueRecordMetadata;
  name: string;
  societyLevel: 1 | 2 | 3 | 4 | 5 | 6;
}

export interface SkillReferenceManifestation {
  archSocietyId: string;
  explanation?: string;
  id: string;
  metadata: SkillCatalogueRecordMetadata;
  skillId: string;
  status: SkillReferenceManifestationStatus;
}

export interface SkillReferenceHistoricalAvailability {
  archSocietyId: string;
  explanation: string;
  id: string;
  metadata: SkillCatalogueRecordMetadata;
  skillId: string;
  socialBand: "L1" | "L2" | "L3" | "L4";
  societyLevel: 1 | 2 | 3 | 4 | 5 | 6;
  status: SkillReferenceHistoricalAvailabilityStatus;
}

export interface SkillReferenceSkillSocietyFloor {
  explanation: string;
  id: string;
  metadata: SkillCatalogueRecordMetadata;
  skillId: string;
  societyLevel?: 1 | 2 | 3 | 4 | 5 | 6;
  status: "recorded" | "unresolved" | "held";
}

export interface SkillReferenceSocietyApplicability {
  archSocietyId: string;
  explanation: string;
  id: string;
  metadata: SkillCatalogueRecordMetadata;
  manifestationId?: string;
  skillId: string;
  standaloneRouteIds: readonly string[];
  status: "applicable" | "not-applicable" | "unresolved" | "held";
  supportingLearningGroupIds: readonly string[];
}

export interface SkillReferenceLearningHistory {
  context: string;
  historyId: string;
  metadata: SkillCatalogueRecordMetadata;
  name: string;
  skillIds: readonly string[];
}

export interface SkillReferenceProfession {
  id: string;
  learningHistoryIds: readonly string[];
  metadata: SkillCatalogueRecordMetadata;
  name: string;
  suggestedSkillIds: readonly string[];
}

export interface SkillReferenceSocietyLevel {
  label: string;
  level: 1 | 2 | 3 | 4 | 5 | 6;
}

export interface SkillReferenceSocialBand {
  id: "L1" | "L2" | "L3" | "L4";
  label: string;
}

export interface SkillReferenceSocietyLevelBandCell {
  historicalAvailabilityIds: readonly string[];
  socialBand: SkillReferenceSocialBand["id"];
  societyLevel: SkillReferenceSocietyLevel["level"];
  status: "recorded" | "context-dependent" | "unresolved";
}

export interface SkillReferenceSocietyLevelBandMatrix {
  cells: readonly SkillReferenceSocietyLevelBandCell[];
  socialBands: readonly SkillReferenceSocialBand[];
  societyLevels: readonly SkillReferenceSocietyLevel[];
}

export interface SkillReferenceMetadata {
  archSkills: readonly SkillReferenceArchSkill[];
  archSocieties: readonly SkillReferenceArchSociety[];
  historicalAvailability: readonly SkillReferenceHistoricalAvailability[];
  skillSocietyFloors: readonly SkillReferenceSkillSocietyFloor[];
  societyApplicability: readonly SkillReferenceSocietyApplicability[];
  learningGroups: readonly SkillReferenceLearningGroup[];
  learningHistories: readonly SkillReferenceLearningHistory[];
  manifestations: readonly SkillReferenceManifestation[];
  professionReferences: readonly SkillReferenceProfession[];
  schemaVersion: typeof SKILL_REFERENCE_METADATA_SCHEMA_VERSION;
  societyLevelBandMatrix: SkillReferenceSocietyLevelBandMatrix;
}
