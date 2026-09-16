export type ContentSnapshotSource = "database" | "seed";

export interface RevisionedContentSnapshot<TContent = unknown> {
  content: TContent;
  revision: number;
  source: ContentSnapshotSource;
  updatedAt?: string;
}

export interface AdminContentGetResponse<
  TContent = unknown,
> extends RevisionedContentSnapshot<TContent> {}

export interface AdminContentPutRequest<TContent = unknown> {
  content: TContent;
  expectedRevision: number;
}

export interface AdminContentPutResponse<
  TContent = unknown,
> extends RevisionedContentSnapshot<TContent> {}

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

export interface AdminSkillReferenceRecordMetadata {
  recordVersion: string;
  status: "canonical" | "proposal" | "evidence" | "legacy";
  provenance: {
    kind: "decision" | "evidence" | "legacy" | "proposal";
    note?: string;
    reference: string;
  };
}

export interface AdminSkillReferenceMetadata {
  archSkills: readonly {
    description: string;
    id: string;
    mechanics: "none";
    metadata: AdminSkillReferenceRecordMetadata;
    membershipMeaning: "navigation-only";
    name: string;
    skillMemberships: readonly {
      placement: "primary" | "secondary" | "contextual";
      skillId: string;
    }[];
  }[];
  archSocieties: readonly {
    description: string;
    id: string;
    metadata: AdminSkillReferenceRecordMetadata;
    name: string;
    societyLevel: 1 | 2 | 3 | 4 | 5 | 6;
  }[];
  historicalAvailability: readonly {
    archSocietyId: string;
    explanation: string;
    id: string;
    metadata: AdminSkillReferenceRecordMetadata;
    skillId: string;
    socialBand: "L1" | "L2" | "L3" | "L4";
    societyLevel: 1 | 2 | 3 | 4 | 5 | 6;
    status: "available" | "restricted" | "unavailable" | "unresolved" | "review-required";
  }[];
  skillSocietyFloors: readonly {
    explanation: string;
    id: string;
    metadata: AdminSkillReferenceRecordMetadata;
    skillId: string;
    societyLevel?: 1 | 2 | 3 | 4 | 5 | 6;
    status: "recorded" | "unresolved" | "held";
  }[];
  societyApplicability: readonly {
    archSocietyId: string;
    explanation: string;
    id: string;
    manifestationId?: string;
    metadata: AdminSkillReferenceRecordMetadata;
    skillId: string;
    standaloneRouteIds: readonly string[];
    status: "applicable" | "not-applicable" | "unresolved" | "held";
    supportingLearningGroupIds: readonly string[];
  }[];
  learningGroups: readonly {
    description: string;
    id: string;
    metadata: AdminSkillReferenceRecordMetadata;
    name: string;
    skillMemberships: readonly {
      kind: "core" | "optional";
      skillId: string;
    }[];
  }[];
  learningHistories: readonly {
    context: string;
    historyId: string;
    metadata: AdminSkillReferenceRecordMetadata;
    name: string;
    skillIds: readonly string[];
  }[];
  manifestations: readonly {
    archSocietyId: string;
    explanation?: string;
    id: string;
    metadata: AdminSkillReferenceRecordMetadata;
    skillId: string;
    status: "recorded" | "unresolved" | "review-required";
  }[];
  professionReferences: readonly {
    id: string;
    learningHistoryIds: readonly string[];
    metadata: AdminSkillReferenceRecordMetadata;
    name: string;
    suggestedSkillIds: readonly string[];
  }[];
  schemaVersion: string;
  societyLevelBandMatrix: {
    cells: readonly {
      historicalAvailabilityIds: readonly string[];
      socialBand: "L1" | "L2" | "L3" | "L4";
      societyLevel: 1 | 2 | 3 | 4 | 5 | 6;
      status: "recorded" | "context-dependent" | "unresolved";
    }[];
    socialBands: readonly { id: "L1" | "L2" | "L3" | "L4"; label: string }[];
    societyLevels: readonly {
      label: string;
      level: 1 | 2 | 3 | 4 | 5 | 6;
    }[];
  };
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
    domainId?: string;
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
  referenceMetadata: AdminSkillReferenceMetadata;
  records: AdminSkillReferenceRecordContainer;
  rulesVersion: string;
  schemaVersion: string;
  status: "canonical" | "proposal";
  title: string;
}

export interface AdminSkillReferenceResponse {
  candidate: AdminSkillReferenceSnapshot | null;
  canonical: AdminSkillReferenceSnapshot | null;
  fullCatalogue?: AdminFullSkillCatalogueProposal;
  targetLearningGroups?: TargetLearningGroupCatalogue;
}

/** Approved reference content. This contract does not activate acquisition. */
export interface TargetLearningGroup {
  id: string;
  name: string;
  shortDescription: string;
  description: string;
  equipment?: string;
  boundaries: readonly string[];
  members: readonly {
    competencyId: string;
    name: string;
    kind: "base-skill" | "specialization";
    parentId?: string;
    practice: string;
    sourceStatus: string;
  }[];
  provenance: {
    annotation: string;
    sourcePath: string;
    sourceSha256: string;
    startLine: number;
    endLine: number;
  };
}

export interface TargetLearningGroupCatalogue {
  schemaVersion: "target-learning-groups/v1";
  status: "approved-reference";
  groups: readonly TargetLearningGroup[];
  grouplessBaseSkillIds: readonly string[];
  pilotLearningGroups: readonly {
    id: string;
    name: string;
    skillIds: readonly string[];
    skillNames: readonly string[];
  }[];
  sources: readonly { path: string; sha256: string; byteSize: number }[];
  manifest: {
    groups: number;
    baseMemberships: number;
    specializationMemberships: number;
    totalMemberships: number;
    groupedBaseSkills: number;
    grouplessBaseSkills: number;
    pilotGroups: number;
    pilotLinks: number;
    digest: `sha256:${string}`;
  };
}

export type AdminFullSkillCatalogueCompetencyType =
  | "base-skill"
  | "specialization"
  | "spoken-language"
  | "written-tradition";

export interface AdminFullSkillCatalogueEntry {
  archSkillAnnotation: string;
  boundaries: readonly string[];
  compatibilityNote?: string;
  competencyType: AdminFullSkillCatalogueCompetencyType;
  context: string;
  description: string;
  domain: string;
  id: string;
  idStatus: string;
  learningGroupAnnotation: string;
  name: string;
  parent?: { id: string; name: string; note?: string };
  provenance: string;
  shortDescription: string;
  typicalUses: readonly string[];
}

export interface AdminFullSkillCatalogueProposal {
  archSkills: readonly {
    description: string;
    id: string;
    name: string;
    participantIds: readonly string[];
    participantNames: readonly string[];
  }[];
  entries: readonly AdminFullSkillCatalogueEntry[];
  exceptions: readonly { effect: string; item: string; unresolved: string }[];
  learningGroups: readonly {
    id: string;
    membershipStatus: string;
    name: string;
    participantIds: readonly string[];
    participantNames: readonly string[];
  }[];
  manifest: {
    archSkills: number;
    baseSkills: number;
    competencies: number;
    learningGroups: number;
    pilotLearningGroups: number;
    pilotLearningGroupLinks: number;
    proposalDigest: `sha256:${string}`;
    specializations: number;
    spokenLanguages: number;
    supportScripts: number;
    unresolvedBindings: number;
    writtenTraditions: number;
  };
  pilotLearningGroups: readonly {
    id: string;
    name: string;
    skillIds: readonly string[];
    skillNames: readonly string[];
  }[];
  schemaVersion: string;
  source: { byteSize: number; path: string; sha256: string };
  status: "proposal";
  supportScripts: readonly {
    id: string;
    name: string;
    status: string;
    writtenAssociation: string;
  }[];
  title: string;
  unresolvedBindings: readonly {
    evidence: string;
    name: string;
    sourceIdentity: string;
    unresolvedItem: string;
  }[];
}
