import {
  campaignNoteSchema,
  type CampaignNote,
  type CampaignNoteReference,
  type CampaignNoteStatus,
} from "@glantri/domain";
import { PrismaClient } from "@prisma/client";

import { prisma as defaultPrisma } from "../client";

function mapCampaignNote(record: {
  campaignId: string;
  content: string;
  createdAt: Date;
  createdByUserId: string;
  id: string;
  referenceId: string | null;
  referenceLabelSnapshot: string | null;
  referenceType: string | null;
  resolvedAt: Date | null;
  resolvedByUserId: string | null;
  status: string;
  updatedAt: Date;
  updatedByUserId: string;
}): CampaignNote {
  return campaignNoteSchema.parse({
    campaignId: record.campaignId,
    content: record.content,
    createdAt: record.createdAt.toISOString(),
    createdByUserId: record.createdByUserId,
    id: record.id,
    reference:
      record.referenceType && record.referenceId && record.referenceLabelSnapshot
        ? {
            id: record.referenceId,
            label: record.referenceLabelSnapshot,
            type: record.referenceType,
          }
        : undefined,
    resolvedAt: record.resolvedAt?.toISOString(),
    resolvedByUserId: record.resolvedByUserId ?? undefined,
    status: record.status,
    updatedAt: record.updatedAt.toISOString(),
    updatedByUserId: record.updatedByUserId,
  });
}

export interface CampaignNoteRepository {
  create(input: {
    actorUserId: string;
    campaignId: string;
    content: string;
    reference?: CampaignNoteReference;
  }): Promise<CampaignNote>;
  getById(noteId: string): Promise<CampaignNote | null>;
  listByCampaign(campaignId: string): Promise<CampaignNote[]>;
  update(input: {
    actorUserId: string;
    content?: string;
    expectedRevision: string;
    noteId: string;
    reference?: CampaignNoteReference | null;
    status?: CampaignNoteStatus;
  }): Promise<CampaignNote | null>;
}

export function createPrismaCampaignNoteRepository(
  client: PrismaClient = defaultPrisma,
): CampaignNoteRepository {
  return {
    async create(input) {
      const record = await client.campaignNote.create({
        data: {
          campaignId: input.campaignId,
          content: input.content,
          createdByUserId: input.actorUserId,
          referenceId: input.reference?.id ?? null,
          referenceLabelSnapshot: input.reference?.label ?? null,
          referenceType: input.reference?.type ?? null,
          updatedByUserId: input.actorUserId,
        },
      });

      return mapCampaignNote(record);
    },
    async getById(noteId) {
      const record = await client.campaignNote.findUnique({ where: { id: noteId } });
      return record ? mapCampaignNote(record) : null;
    },
    async listByCampaign(campaignId) {
      const records = await client.campaignNote.findMany({
        orderBy: [{ status: "asc" }, { updatedAt: "desc" }],
        where: { campaignId },
      });
      return records.map(mapCampaignNote);
    },
    async update(input) {
      const expectedUpdatedAt = new Date(input.expectedRevision);
      const nextUpdatedAt = new Date(Math.max(Date.now(), expectedUpdatedAt.getTime() + 1));
      const statusData =
        input.status === undefined
          ? {}
          : input.status === "resolved"
            ? {
                resolvedAt: new Date(),
                resolvedByUserId: input.actorUserId,
                status: "resolved" as const,
              }
            : {
                resolvedAt: null,
                resolvedByUserId: null,
                status: "open" as const,
              };
      const referenceData =
        input.reference === undefined
          ? {}
          : {
              referenceId: input.reference?.id ?? null,
              referenceLabelSnapshot: input.reference?.label ?? null,
              referenceType: input.reference?.type ?? null,
            };
      const updated = await client.campaignNote.updateManyAndReturn({
        data: {
          ...(input.content === undefined ? {} : { content: input.content }),
          ...referenceData,
          ...statusData,
          updatedAt: nextUpdatedAt,
          updatedByUserId: input.actorUserId,
        },
        where: { id: input.noteId, updatedAt: expectedUpdatedAt },
      });
      const record = updated[0];
      if (!record) return null;

      return mapCampaignNote(record);
    },
  };
}
