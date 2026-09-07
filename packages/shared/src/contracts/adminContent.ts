export type ContentSnapshotSource = "database" | "seed";

export interface RevisionedContentSnapshot<TContent = unknown> {
  content: TContent;
  revision: number;
  source: ContentSnapshotSource;
  updatedAt?: string;
}

export interface AdminContentGetResponse<TContent = unknown>
  extends RevisionedContentSnapshot<TContent> {}

export interface AdminContentPutRequest<TContent = unknown> {
  content: TContent;
  expectedRevision: number;
}

export interface AdminContentPutResponse<TContent = unknown>
  extends RevisionedContentSnapshot<TContent> {}

export interface AdminContentConflictResponse<TContent = unknown> {
  current: RevisionedContentSnapshot<TContent>;
  error: string;
}

export interface AdminSkillReferenceCompetencyRecord {
  acquisitionWeight?: number;
  description: string;
  domainId: string;
  id: string;
  kind: "skill" | "spoken-language" | "specialization" | "written-tradition";
  name: string;
  parentCompetencyId?: string;
  prerequisites: readonly {
    competencyId: string;
    justification?: string;
    threshold: number;
  }[];
  shortDescription: string;
  shortLabel: string;
  status: "canonical" | "proposal";
  transfer?:
    | {
        kind: "explicit-relationships";
        relationshipIds: readonly string[];
      }
    | {
        kind: "zero-transfer";
        rationale: string;
      };
  weight: 1 | 2 | 3;
  writtenLanguageBinding?: {
    scriptId: string;
    spokenLanguageId: string;
  };
  provenance: readonly string[];
  recordVersion: string;
  taskEnvelope: {
    coreTasks: readonly string[];
    limits: readonly string[];
    methods: readonly string[];
    useGuidance: string;
  };
}

export interface AdminSkillReferenceAccessException {
  basis: string;
  competencyIds: readonly string[];
  explanation: string;
  grantsCompetence: 0;
  historyIds: readonly string[];
  id: string;
  profileId: string;
}

export interface AdminSkillReferenceProfile {
  accessBand: string;
  developmentStage: string;
  id: string;
  name: string;
  normalRoutes: readonly {
    accessBand: string;
    competencyIds: readonly string[];
    description: string;
    id: string;
  }[];
  overrides: readonly {
    attributionId: string;
    availability: string;
    competencyIds: readonly string[];
    explanation: string;
  }[];
}

export interface AdminSkillReferenceRecordContainer {
  accessExceptions: readonly AdminSkillReferenceAccessException[];
  competencies: readonly AdminSkillReferenceCompetencyRecord[];
  domains: readonly {
    description: string;
    id: string;
    name: string;
  }[];
  histories: readonly {
    context: string;
    fixedCompetencyIds: readonly string[];
    id: string;
    selectionSlots: readonly {
      candidateCompetencyIds: readonly string[];
      chooseCount: number;
      id: string;
      label: string;
    }[];
    name: string;
  }[];
  profiles: readonly AdminSkillReferenceProfile[];
  relationships: readonly {
    id: string;
    rationale: string;
    sourceCompetencyId: string;
    strength: 25 | 50 | 75 | 100;
    targetCompetencyId: string;
  }[];
  scripts: readonly {
    id: string;
    name: string;
    description: string;
    familyIds: readonly string[];
    domainId: string;
  }[];
}

export interface AdminSkillReferenceSnapshot {
  compatibility: {
    characterMigrationReviewRequired: boolean;
    classification: "presentation-only" | "mechanically-compatible" | "migration-review-required";
    rationale: string;
  };
  contentVersion: string;
  id: string;
  manifest: {
    counts: {
      accessExceptions: number;
      competencies: number;
      domains: number;
      histories: number;
      profiles: number;
      relationships: number;
      scripts: number;
    };
    packageDigest?: `sha256:${string}`;
    semanticDigest?: `sha256:${string}`;
    serialization?: string;
  };
  provenance: readonly string[];
  records: AdminSkillReferenceRecordContainer;
  rulesVersion: string;
  schemaVersion: string;
  status: "canonical" | "proposal";
  title: string;
}

export interface AdminSkillReferenceResponse {
  candidate: AdminSkillReferenceSnapshot;
  canonical: AdminSkillReferenceSnapshot;
}
