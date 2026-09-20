import {
  campaignNoteSchema,
  type CampaignNote,
  type CampaignNoteReference,
  type CampaignNoteStatus,
} from "@glantri/domain";
import { PrismaClient } from "@prisma/client";

import { prisma as defaultPrisma } from "../client";

interface CampaignNoteAssociationRecord {
  labelSnapshot: string;
  position: number;
  scenarioId: string | null;
  targetId: string;
  type: string;
}

interface CampaignNoteRecord {
  associations?: CampaignNoteAssociationRecord[];
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
}

function legacyReference(record: CampaignNoteRecord): CampaignNoteReference | undefined {
  return record.referenceType && record.referenceId && record.referenceLabelSnapshot
    ? {
        id: record.referenceId,
        label: record.referenceLabelSnapshot,
        type: record.referenceType as CampaignNoteReference["type"],
      }
    : undefined;
}

/**
 * Association rows are authoritative. A Note stored before multi-association support
 * that still has no association row falls back to its legacy single reference, so
 * existing Notes remain readable even if the migration backfill did not reach them.
 */
function mapAssociations(record: CampaignNoteRecord): CampaignNoteReference[] {
  const rows = record.associations ?? [];
  if (rows.length > 0) {
    return [...rows]
      .sort((left, right) => left.position - right.position)
      .map((row) => ({
        id: row.targetId,
        label: row.labelSnapshot,
        ...(row.scenarioId ? { scenarioId: row.scenarioId } : {}),
        type: row.type as CampaignNoteReference["type"],
      }));
  }

  const legacy = legacyReference(record);
  return legacy ? [legacy] : [];
}

function mapCampaignNote(record: CampaignNoteRecord): CampaignNote {
  return campaignNoteSchema.parse({
    associations: mapAssociations(record),
    campaignId: record.campaignId,
    content: record.content,
    createdAt: record.createdAt.toISOString(),
    createdByUserId: record.createdByUserId,
    id: record.id,
    reference: legacyReference(record),
    resolvedAt: record.resolvedAt?.toISOString(),
    resolvedByUserId: record.resolvedByUserId ?? undefined,
    status: record.status,
    updatedAt: record.updatedAt.toISOString(),
    updatedByUserId: record.updatedByUserId,
  });
}

/**
 * The legacy single-reference columns keep mirroring the first object association, so
 * readers that have not moved to `associations` still see a meaningful reference.
 */
function legacyColumnsFor(associations: CampaignNoteReference[]) {
  const primary = associations.find((association) => association.type !== "tag");
  return {
    referenceId: primary?.id ?? null,
    referenceLabelSnapshot: primary?.label ?? null,
    referenceType: (primary?.type ?? null) as never,
  };
}

function associationRows(associations: CampaignNoteReference[]) {
  return associations.map((association, index) => ({
    labelSnapshot: association.label,
    position: index,
    scenarioId: association.scenarioId ?? null,
    targetId: association.id,
    type: association.type as never,
  }));
}

const associationInclude = {
  associations: {
    orderBy: { position: "asc" },
    select: {
      labelSnapshot: true,
      position: true,
      scenarioId: true,
      targetId: true,
      type: true,
    },
  },
} as const;

export interface CampaignNoteRepository {
  create(input: {
    actorUserId: string;
    associations?: CampaignNoteReference[];
    campaignId: string;
    content: string;
  }): Promise<CampaignNote>;
  getById(noteId: string): Promise<CampaignNote | null>;
  listByCampaign(campaignId: string): Promise<CampaignNote[]>;
  update(input: {
    actorUserId: string;
    associations?: CampaignNoteReference[];
    content?: string;
    expectedRevision: string;
    noteId: string;
    status?: CampaignNoteStatus;
  }): Promise<CampaignNote | null>;
}

export function createPrismaCampaignNoteRepository(
  client: PrismaClient = defaultPrisma,
): CampaignNoteRepository {
  return {
    async create(input) {
      const associations = input.associations ?? [];
      const record = await client.campaignNote.create({
        data: {
          associations: { create: associationRows(associations) },
          campaignId: input.campaignId,
          content: input.content,
          createdByUserId: input.actorUserId,
          ...legacyColumnsFor(associations),
          updatedByUserId: input.actorUserId,
        },
        include: associationInclude,
      });

      return mapCampaignNote(record as unknown as CampaignNoteRecord);
    },
    async getById(noteId) {
      const record = await client.campaignNote.findUnique({
        include: associationInclude,
        where: { id: noteId },
      });
      return record ? mapCampaignNote(record as unknown as CampaignNoteRecord) : null;
    },
    async listByCampaign(campaignId) {
      const records = await client.campaignNote.findMany({
        include: associationInclude,
        orderBy: [{ status: "asc" }, { updatedAt: "desc" }],
        where: { campaignId },
      });
      return records.map((record) => mapCampaignNote(record as unknown as CampaignNoteRecord));
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

      // Optimistic concurrency stays on the CampaignNote row: the guarded update decides
      // whether this actor won, and associations are only rewritten inside the same
      // transaction once that guard has already matched.
      return client.$transaction(async (tx) => {
        const updated = await tx.campaignNote.updateMany({
          data: {
            ...(input.content === undefined ? {} : { content: input.content }),
            ...(input.associations === undefined ? {} : legacyColumnsFor(input.associations)),
            ...statusData,
            updatedAt: nextUpdatedAt,
            updatedByUserId: input.actorUserId,
          },
          where: { id: input.noteId, updatedAt: expectedUpdatedAt },
        });
        if (updated.count === 0) return null;

        if (input.associations !== undefined) {
          await tx.campaignNoteAssociation.deleteMany({ where: { noteId: input.noteId } });
          const rows = associationRows(input.associations);
          if (rows.length > 0) {
            await tx.campaignNoteAssociation.createMany({
              data: rows.map((row) => ({ ...row, noteId: input.noteId })),
            });
          }
        }

        const record = await tx.campaignNote.findUnique({
          include: associationInclude,
          where: { id: input.noteId },
        });
        return record ? mapCampaignNote(record as unknown as CampaignNoteRecord) : null;
      });
    },
  };
}
