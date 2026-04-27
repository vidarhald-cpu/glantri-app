import { Prisma } from "@prisma/client";

import { prisma } from "../client";

export interface CanonicalContentSnapshotRecord {
  content: unknown;
  createdAt: string;
  key: string;
  revision: number;
  updatedAt: string;
}

export interface SaveCanonicalContentSnapshotInput {
  content: unknown;
  expectedRevision: number;
  key: string;
}

export interface ContentRepository {
  findByKey(key: string): Promise<CanonicalContentSnapshotRecord | null>;
  saveWithOptimisticRevision(
    input: SaveCanonicalContentSnapshotInput
  ): Promise<{ record: CanonicalContentSnapshotRecord; status: "saved" } | { status: "conflict" }>;
}

function mapSnapshotRecord(record: {
  content: unknown;
  createdAt: Date;
  key: string;
  revision: number;
  updatedAt: Date;
}): CanonicalContentSnapshotRecord {
  return {
    content: record.content,
    createdAt: record.createdAt.toISOString(),
    key: record.key,
    revision: record.revision,
    updatedAt: record.updatedAt.toISOString()
  };
}

export function createPrismaContentRepository(): ContentRepository {
  return {
    async findByKey(key) {
      const record = await prisma.canonicalContentSnapshot.findUnique({
        where: {
          key
        }
      });

      return record ? mapSnapshotRecord(record) : null;
    },
    async saveWithOptimisticRevision(input) {
      return prisma.$transaction(async (transaction: Prisma.TransactionClient) => {
        const existing = await transaction.canonicalContentSnapshot.findUnique({
          where: {
            key: input.key
          }
        });

        if (!existing) {
          if (input.expectedRevision !== 0) {
            return {
              status: "conflict" as const
            };
          }

          const created = await transaction.canonicalContentSnapshot.create({
            data: {
              content: input.content as never,
              key: input.key,
              revision: 1
            }
          });

          return {
            record: mapSnapshotRecord(created),
            status: "saved" as const
          };
        }

        if (existing.revision !== input.expectedRevision) {
          return {
            status: "conflict" as const
          };
        }

        const updated = await transaction.canonicalContentSnapshot.update({
          data: {
            content: input.content as never,
            revision: existing.revision + 1
          },
          where: {
            key: input.key
          }
        });

        return {
          record: mapSnapshotRecord(updated),
          status: "saved" as const
        };
      });
    }
  };
}
