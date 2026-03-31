import {
  defaultCanonicalContent,
  type CanonicalContent,
  validateCanonicalContent
} from "@glantri/content";
import {
  createPrismaContentRepository,
  type ContentRepository
} from "@glantri/database";
import type { RevisionedContentSnapshot } from "@glantri/shared";

const CANONICAL_CONTENT_SNAPSHOT_KEY = "canonical-content";

export class CanonicalContentValidationError extends Error {}

export class CanonicalContentRevisionConflictError extends Error {
  constructor(public readonly current: RevisionedContentSnapshot<CanonicalContent>) {
    super("Canonical content revision conflict.");
  }
}

export class CanonicalContentService {
  constructor(
    private readonly repository: ContentRepository = createPrismaContentRepository(),
    private readonly snapshotKey = CANONICAL_CONTENT_SNAPSHOT_KEY
  ) {}

  async getCanonicalContent(): Promise<RevisionedContentSnapshot<CanonicalContent>> {
    const snapshot = await this.repository.findByKey(this.snapshotKey);

    if (!snapshot) {
      return {
        content: defaultCanonicalContent,
        revision: 0,
        source: "seed"
      };
    }

    return {
      content: validateCanonicalContent(snapshot.content),
      revision: snapshot.revision,
      source: "database",
      updatedAt: snapshot.updatedAt
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
        error instanceof Error ? error.message : "Canonical content validation failed."
      );
    }

    const saveResult = await this.repository.saveWithOptimisticRevision({
      content: validatedContent,
      expectedRevision: input.expectedRevision,
      key: this.snapshotKey
    });

    if (saveResult.status === "conflict") {
      throw new CanonicalContentRevisionConflictError(await this.getCanonicalContent());
    }

    return {
      content: validateCanonicalContent(saveResult.record.content),
      revision: saveResult.record.revision,
      source: "database",
      updatedAt: saveResult.record.updatedAt
    };
  }
}
