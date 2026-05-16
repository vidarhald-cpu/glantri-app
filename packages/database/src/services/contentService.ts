import type { CanonicalContentSnapshotRecord } from "../repositories/contentRepository";
import { createPrismaContentRepository } from "../repositories/contentRepository";

export type { CanonicalContentSnapshotRecord };

export class ContentService {
  constructor(private readonly repository = createPrismaContentRepository()) {}

  async findByKey(key: string): Promise<CanonicalContentSnapshotRecord | null> {
    return this.repository.findByKey(key);
  }

  async saveWithOptimisticRevision(input: {
    content: unknown;
    expectedRevision: number;
    key: string;
  }): Promise<{ record: CanonicalContentSnapshotRecord; status: "saved" } | { status: "conflict" }> {
    return this.repository.saveWithOptimisticRevision(input);
  }
}
