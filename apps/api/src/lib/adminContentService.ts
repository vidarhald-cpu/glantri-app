import {
  buildSkillContentRelease,
  defaultCanonicalContent,
  type CanonicalContent,
  pilotSkillContentReleaseProposalInput,
  projectSkillContentReleaseForReference,
  validateCanonicalContent,
  targetLearningGroupCatalogue,
} from "@glantri/content";
import { fullSkillCatalogueProposal } from "@glantri/content/full-skill-catalogue-proposal";
import { ContentService } from "@glantri/database";
import type {
  AdminSkillReferenceResponse,
  AdminSkillReferenceSnapshot,
  RevisionedContentSnapshot,
} from "@glantri/shared";

const CANONICAL_CONTENT_SNAPSHOT_KEY = "canonical-content";

function buildCandidateSkillReferenceSnapshot(): AdminSkillReferenceSnapshot {
  const projection = projectSkillContentReleaseForReference(
    buildSkillContentRelease(pilotSkillContentReleaseProposalInput),
  );

  return {
    ...projection,
    records: {
      accessExceptions: projection.records.accessExceptions,
      competencies: projection.records.competencies.map((competency) => ({
        ...competency,
        provenance: [
          competency.metadata.provenance.reference,
          ...(competency.metadata.provenance.note ? [competency.metadata.provenance.note] : []),
        ],
        recordVersion: competency.metadata.recordVersion,
        status: competency.metadata.status === "canonical" ? "canonical" : "proposal",
        writtenLanguageBinding:
          competency.kind === "written-tradition"
            ? {
                scriptId: competency.scriptId,
                spokenLanguageId: competency.spokenLanguageId,
              }
            : undefined,
      })),
      domains: projection.records.domains,
      histories: projection.records.histories,
      profiles: projection.records.profiles,
      relationships: projection.records.relationships,
      scripts: projection.records.scripts,
    },
    referenceMetadata: projection.referenceMetadata,
  };
}

export class CanonicalContentValidationError extends Error {}

export class CanonicalContentRevisionConflictError extends Error {
  constructor(public readonly current: RevisionedContentSnapshot<CanonicalContent>) {
    super("Canonical content revision conflict.");
  }
}

export class CanonicalContentService {
  constructor(
    private readonly contentService: ContentService = new ContentService(),
    private readonly snapshotKey = CANONICAL_CONTENT_SNAPSHOT_KEY,
  ) {}

  async getCanonicalContent(): Promise<RevisionedContentSnapshot<CanonicalContent>> {
    const snapshot = await this.contentService.findByKey(this.snapshotKey);

    if (!snapshot) {
      return {
        content: defaultCanonicalContent,
        revision: 0,
        source: "seed",
      };
    }

    return {
      content: validateCanonicalContent(snapshot.content),
      revision: snapshot.revision,
      source: "database",
      updatedAt: snapshot.updatedAt,
    };
  }

  async getSkillReference(): Promise<AdminSkillReferenceResponse> {
    return {
      candidate: buildCandidateSkillReferenceSnapshot(),
      canonical: null,
      fullCatalogue: fullSkillCatalogueProposal,
      targetLearningGroups: targetLearningGroupCatalogue,
    };
  }

  async saveCanonicalContent(input: {
    content: unknown;
    expectedRevision: number;
  }): Promise<RevisionedContentSnapshot<CanonicalContent>> {
    let validatedContent: CanonicalContent;

    try {
      validatedContent = validateCanonicalContent(input.content);
    } catch (error) {
      throw new CanonicalContentValidationError(
        error instanceof Error ? error.message : "Canonical content validation failed.",
      );
    }

    const saveResult = await this.contentService.saveWithOptimisticRevision({
      content: validatedContent,
      expectedRevision: input.expectedRevision,
      key: this.snapshotKey,
    });

    if (saveResult.status === "conflict") {
      throw new CanonicalContentRevisionConflictError(await this.getCanonicalContent());
    }

    return {
      content: validateCanonicalContent(saveResult.record.content),
      revision: saveResult.record.revision,
      source: "database",
      updatedAt: saveResult.record.updatedAt,
    };
  }
}
