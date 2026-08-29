import { z } from "zod";

import type { CharacterBuild } from "./build";

export const CHARACTER_REVISION_CONTRACT_VERSION = "character-revision/v1" as const;
export const CHARACTER_ACQUISITION_LEDGER_VERSION = "character-acquisition-ledger/v1" as const;
export const CHARACTER_SKILL_READ_MODEL_VERSION = "character-skill-read-model/v1" as const;
export const CHARACTER_MIGRATION_PREVIEW_VERSION = "character-migration-preview/v1" as const;
export const PILOT_SKILL_RULES_RELEASE_ID = "pilot-skill-rules/v1" as const;
export const PILOT_SKILL_CONTENT_RELEASE_ID = "content-release:pilot-skills:1" as const;
export const PILOT_SKILL_CONTENT_VERSION = "pilot-skills-content/1.0.1" as const;
export const PILOT_SKILL_CONTENT_DIGEST =
  "sha256:f524303b274b546c42daac06b65403957e896f35609d42ce7456ff5781c9f419" as const;

export type CharacterLedgerAuthority = "owner" | "campaign_gm" | "admin" | "system";
export type CharacterLedgerVisibility = "public" | "owner_and_gm" | "gm_only";
export type CharacterAcquisitionPhase = "chargen" | "post_chargen" | "migration" | "legacy_import";
export type CharacterLedgerEventKind =
  | "direct_skill_acquired"
  | "learning_history_acquired"
  | "learning_history_advanced"
  | "specialization_acquired"
  | "specialization_advanced"
  | "background_competence_granted"
  | "gm_competence_granted"
  | "gm_adjustment_recorded"
  | "grandfathering_applied"
  | "migration_applied"
  | "migration_rollback_applied"
  | "legacy_baseline_recorded"
  | "profession_context_changed";

export interface CharacterChargenConfigurationSnapshot {
  contractVersion: "pilot-chargen-configuration/v1";
  digest: `sha256:${string}`;
  id: string;
  values: {
    flexBudget: number;
    formationBudget: number;
    migrationPolicy: "accepted-release-maintenance";
    progressionPolicy: "gm-authorized-history-advancement";
    startingSpokenLanguageRule: "max(11,education)";
    visibilityPolicy: "server-projected-provenance/v1";
  };
}

export interface CharacterVersionEnvelope {
  acquisitionLedgerVersion: typeof CHARACTER_ACQUISITION_LEDGER_VERSION;
  characterRevisionVersion: typeof CHARACTER_REVISION_CONTRACT_VERSION;
  chargenConfiguration: CharacterChargenConfigurationSnapshot;
  contentRelease: {
    contentVersion: typeof PILOT_SKILL_CONTENT_VERSION;
    digest: typeof PILOT_SKILL_CONTENT_DIGEST;
    id: typeof PILOT_SKILL_CONTENT_RELEASE_ID;
  };
  skillReadModelVersion: typeof CHARACTER_SKILL_READ_MODEL_VERSION;
  skillRules: {
    engineVersion: typeof PILOT_SKILL_RULES_RELEASE_ID;
    id: typeof PILOT_SKILL_RULES_RELEASE_ID;
    policy: "floor-strongest-explicit-directional-non-recursive/v1";
  };
}

export interface CharacterLearningHistoryState {
  competencyIds: string[];
  definitionId: string;
  definitionLabel: string;
  instanceId: string;
  level: number;
  selectedCompetencyIds: string[];
}

export interface CharacterCompetenceAcquisitionState {
  competencyId: string;
  ranks: number;
}

export interface CharacterGrantedCompetenceState extends CharacterCompetenceAcquisitionState {
  sourceId: string;
  sourceKind: "background" | "society" | "other-explicit-grant";
}

export interface RetainedCharacterState {
  backgroundId: string;
  directAcquisitions: CharacterCompetenceAcquisitionState[];
  grants: CharacterGrantedCompetenceState[];
  histories: CharacterLearningHistoryState[];
  pilotCharacterId: string;
  professionId: string;
  specializationAcquisitions: CharacterCompetenceAcquisitionState[];
}

export interface CharacterLedgerEvent {
  actorUserId: string | null;
  authority: CharacterLedgerAuthority;
  characterId: string;
  characterRevisionId: string;
  component: "direct" | "explicit_grant" | "history" | "specialization" | "migration" | "context";
  economics?: Record<string, unknown>;
  eventId: string;
  eventKind: CharacterLedgerEventKind;
  idempotencyKey: string;
  occurredAt: string;
  phase: CharacterAcquisitionPhase;
  prerequisiteEvidence?: Record<string, unknown>;
  protectedProvenance?: Record<string, unknown>;
  publicExplanation: string;
  sequence: number;
  sourceId: string;
  sourceKind: string;
  sourceLabel: string;
  targetId: string;
  targetKind:
    | "skill"
    | "spoken-language"
    | "written-tradition"
    | "specialization"
    | "history"
    | "character";
  valueAfter: number | null;
  valueBefore: number | null;
  valueDelta: number | null;
  versionEnvelope: CharacterVersionEnvelope;
  visibility: CharacterLedgerVisibility;
}

export interface CharacterSkillGroupCandidate {
  historyInstanceId: string;
  historyLabel: string;
  level: number;
  selectedAsStrongest: boolean;
  suppressedByHistoryInstanceId?: string;
  usefulIncrementalCompetence: number;
}

export interface CharacterSkillRelationshipCandidate {
  candidateCompetence: number;
  relationshipId: string;
  sourceAcquiredBase: number;
  sourceCompetencyId: string;
  strength: 25 | 50 | 75 | 100;
}

export interface CharacterEffectiveSkillRow {
  acquiredBase: number;
  competenceBand: string;
  competencyId: string;
  competencyKind: "skill" | "spoken-language" | "written-tradition" | "specialization";
  displayName: string;
  directAcquisition: number;
  effectiveLevel: number;
  explicitGrants: number;
  groupCandidates: CharacterSkillGroupCandidate[];
  publicExplanation: string;
  relationshipCandidates: CharacterSkillRelationshipCandidate[];
  relationshipDerivedContribution: number;
  selectedRelationshipId?: string;
  strongestHistoryContribution: number;
  specialization?: {
    acquiredRanks: number;
    eligible: boolean;
    owned: boolean;
    state: "active" | "grandfathered" | "deprecated" | "mapped" | "unmapped";
  };
  suppressedOverlaps: CharacterSkillGroupCandidate[];
}

export interface CharacterEffectiveSkillReadModel {
  calculationDigest: `sha256:${string}`;
  characterId: string;
  characterRevisionId: string;
  rows: CharacterEffectiveSkillRow[];
  versionEnvelope: CharacterVersionEnvelope;
}

export interface CharacterRevisionSnapshotReference {
  characterId: string;
  characterRevisionId: string;
  characterRevisionSequence: number;
  contentDigest: string;
  contentReleaseId: string;
  readModelDigest: string;
  rulesVersion: string;
  snapshotContractVersion: "character-revision-snapshot/v1";
}

export interface CharacterRevisionRecord {
  actorUserId: string | null;
  characterId: string;
  commandDigest: `sha256:${string}`;
  commandIdempotencyKey: string;
  createdAt: string;
  effectiveSkills: CharacterEffectiveSkillReadModel;
  events: CharacterLedgerEvent[];
  id: string;
  migrationLineage: {
    migrationId?: string;
    rollbackOfRevisionId?: string;
    sourceRevisionId?: string;
    status: "current" | "historical" | "migration_applied" | "rollback_applied";
  };
  parentRevisionId: string | null;
  reason: string;
  revisionDigest: `sha256:${string}`;
  revisionState: "current" | "historical";
  sequence: number;
  state: RetainedCharacterState;
  versionEnvelope: CharacterVersionEnvelope;
}

export type CharacterProvenancePerspective =
  | "owner"
  | "current_campaign_gm"
  | "entitled_player"
  | "uninvolved_player"
  | "admin";

export type CharacterOwnerSafeLedgerEvent = Omit<CharacterLedgerEvent, "protectedProvenance"> & {
  protectedProvenance?: never;
};

export type CharacterEffectiveSkillProjection =
  | {
      characterId: string;
      characterRevisionId?: never;
      effectiveSkills: Omit<
        CharacterEffectiveSkillReadModel,
        "calculationDigest" | "characterRevisionId"
      >;
      events?: never;
      migrationLineage?: never;
      perspective: "entitled_player";
      provenanceDetail: "summary_only";
      revisionState?: never;
    }
  | {
      characterId: string;
      characterRevisionId: string;
      effectiveSkills: CharacterEffectiveSkillReadModel;
      events: CharacterOwnerSafeLedgerEvent[];
      migrationLineage: CharacterRevisionRecord["migrationLineage"];
      perspective: "owner";
      provenanceDetail: "owner_safe";
      revisionState: CharacterRevisionRecord["revisionState"];
    }
  | {
      characterId: string;
      characterRevisionId: string;
      effectiveSkills: CharacterEffectiveSkillReadModel;
      events: CharacterLedgerEvent[];
      migrationLineage: CharacterRevisionRecord["migrationLineage"];
      perspective: "admin" | "current_campaign_gm";
      provenanceDetail: "full";
      revisionState: CharacterRevisionRecord["revisionState"];
    };

export interface HeadlessChargenFinalizeInput {
  build: CharacterBuild;
  configuration: {
    flexBudget: number;
    formationBudget: number;
    id: string;
  };
  idempotencyKey: string;
  pilotCharacterId: string;
}

export const headlessChargenFinalizeInputSchema = z.object({
  build: z.unknown(),
  configuration: z.object({
    flexBudget: z.number().int().nonnegative(),
    formationBudget: z.number().int().nonnegative(),
    id: z.string().min(1),
  }),
  idempotencyKey: z.string().min(1).max(200),
  pilotCharacterId: z.string().min(1),
});

export interface CharacterMigrationPreview {
  after: CharacterEffectiveSkillReadModel;
  before: CharacterEffectiveSkillReadModel;
  characterId: string;
  expiresAt: string;
  expectedRevisionId: string;
  migrationId: string;
  mutatesCharacter: false;
  previewDigest: `sha256:${string}`;
  targetEnvelope: CharacterVersionEnvelope;
  version: typeof CHARACTER_MIGRATION_PREVIEW_VERSION;
  warnings: string[];
}
