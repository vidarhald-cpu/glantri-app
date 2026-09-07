import { randomUUID } from "node:crypto";

import { Prisma, type PrismaClient } from "@prisma/client";

import type {
  ArtifactBlackboardCandidate,
  BlackboardCategory,
  BlackboardGmCreate,
  BlackboardGmRevision,
  BlackboardRestrictedDetailInput,
} from "@glantri/domain";

import { prisma } from "../client";
import { ArtifactBlackboardResolver } from "../services/artifactService";
import { resolveBlackboardViewerCharacter } from "../services/blackboardViewerCharacter";
import { ArtifactRepository } from "./artifactRepository";

export class BlackboardRepositoryConflictError extends Error {
  constructor(readonly reason: "reference" | "retryable" | "stale") {
    super(reason);
    this.name = "BlackboardRepositoryConflictError";
  }
}

export interface BlackboardActor {
  id: string;
  label: string;
}

export interface BlackboardRepositoryConcurrencyHooks {
  afterEntryLock?: (
    operation: "archive" | "grant" | "layout" | "lifecycle" | "revision",
  ) => Promise<void> | void;
  afterGrantStreamLock?: (tx: Prisma.TransactionClient) => Promise<void> | void;
}

export interface BlackboardEntrySnapshot {
  category: string;
  createdByUserId: string;
  currentRevisionNumber: number;
  entryVersion: number;
  id: string;
  state: string;
}

export interface BlackboardBoardRecords {
  entries: Awaited<ReturnType<PrismaClient["campaignBlackboardEntry"]["findMany"]>>;
  layout: Awaited<ReturnType<PrismaClient["campaignBlackboardLayout"]["findUnique"]>>;
  placements: Awaited<ReturnType<PrismaClient["campaignBlackboardPlacement"]["findMany"]>>;
  revisions: Awaited<ReturnType<PrismaClient["campaignBlackboardEntryRevision"]["findMany"]>>;
}

export interface BlackboardSearchRecord {
  category: string;
  entryId: string;
  pinned: boolean;
  title: string;
}

type BlackboardDetailMembership = Awaited<
  ReturnType<PrismaClient["campaignBlackboardRevisionDetailUnit"]["findMany"]>
>[number];

function isRetryableTransactionError(error: unknown): boolean {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === "P2034") return true;
    if (error.code === "P2010") {
      const databaseCode = String(error.meta?.code ?? "");
      return databaseCode === "40P01" || databaseCode === "40001";
    }
  }
  if (
    error instanceof Prisma.PrismaClientUnknownRequestError &&
    /code:\s*"(?:40P01|40001)"/.test(error.message)
  ) {
    return true;
  }
  const code = (error as { code?: unknown }).code;
  return code === "40P01" || code === "40001";
}

function detailInputs(input: BlackboardGmCreate | BlackboardGmRevision) {
  return "restrictedDetails" in input ? input.restrictedDetails : undefined;
}

function revisionData(
  input: BlackboardGmCreate | BlackboardGmRevision,
  actor: BlackboardActor,
  candidate?: ArtifactBlackboardCandidate,
  current?: {
    imageCaption: string | null;
    sourceArtifactIdSnapshot: string | null;
    title: string;
  },
) {
  const base = {
    actorLabelSnapshot: actor.label,
    actorUserId: actor.id,
    approvedAt: null as Date | null,
    approvedByLabelSnapshot: null as string | null,
    approvedByUserId: null as string | null,
    clueFact: null as string | null,
    contextText: null as string | null,
    documentText: null as string | null,
    imageCaption: null as string | null,
    recapText: null as string | null,
    sourceArtifactAltText: null as string | null,
    sourceArtifactIdSnapshot: null as string | null,
    sourceArtifactKind: null as string | null,
    sourceArtifactMediaType: null as string | null,
    sourceArtifactTitle: null as string | null,
  };

  if (input.category === "clue_fact") {
    return {
      ...base,
      clueFact: input.fact,
      contextText: input.context ?? null,
      title: input.title,
    };
  }
  if (input.category === "document_text") {
    return {
      ...base,
      contextText: input.context ?? null,
      documentText: input.documentText,
      title: input.title,
    };
  }
  if (input.category === "recap") {
    const approvedAt = new Date();
    return {
      ...base,
      approvedAt,
      approvedByLabelSnapshot: actor.label,
      approvedByUserId: actor.id,
      recapText: input.recapText,
      title: input.title,
    };
  }
  if (!candidate) throw new BlackboardRepositoryConflictError("reference");
  const isRefresh = "changeKind" in input && input.changeKind === "refresh";
  return {
    ...base,
    imageCaption:
      isRefresh || !("caption" in input)
        ? (current?.imageCaption ?? null)
        : (input.caption ?? null),
    sourceArtifactAltText: candidate.altText,
    sourceArtifactIdSnapshot: candidate.id,
    sourceArtifactKind: candidate.artifactKind,
    sourceArtifactMediaType: candidate.mediaType,
    sourceArtifactTitle: candidate.title,
    title: isRefresh || !("title" in input) ? (current?.title ?? candidate.title) : input.title,
  };
}

export class BlackboardRepository {
  private readonly artifactRepository: ArtifactRepository;
  private readonly artifactResolver: ArtifactBlackboardResolver;

  constructor(
    private readonly client: PrismaClient = prisma,
    private readonly concurrencyHooks: BlackboardRepositoryConcurrencyHooks = {},
  ) {
    this.artifactRepository = new ArtifactRepository(client);
    this.artifactResolver = new ArtifactBlackboardResolver(this.artifactRepository);
  }

  async getCampaignActor(
    campaignId: string,
    userId: string,
  ): Promise<{ actor: BlackboardActor; isGm: boolean } | null> {
    const [campaign, user] = await Promise.all([
      this.client.campaign.findUnique({ select: { gmUserId: true }, where: { id: campaignId } }),
      this.client.user.findUnique({
        select: { displayName: true },
        where: { id: userId },
      }),
    ]);
    if (!campaign || !user) return null;
    const isGm = campaign.gmUserId === userId;
    return {
      actor: {
        id: userId,
        label: user.displayName?.trim() || (isGm ? "Game Master" : "Campaign player"),
      },
      isGm,
    };
  }

  async getArtifactCandidate(campaignId: string, artifactId: string) {
    return this.artifactRepository.getBlackboardCandidate(campaignId, artifactId);
  }

  async getArtifactSourceLink(campaignId: string, entryId: string, revisionNumber: number) {
    return this.client.campaignBlackboardArtifactSourceLink.findUnique({
      where: {
        campaignId_entryId_revisionNumber: { campaignId, entryId, revisionNumber },
      },
    });
  }

  async resolveViewerCharacter(input: {
    campaignId: string;
    userId: string;
    viewerCharacterId: string;
  }) {
    return resolveBlackboardViewerCharacter(input, this.client);
  }

  async loadBoard(campaignId: string): Promise<BlackboardBoardRecords> {
    const [entries, layout, placements] = await Promise.all([
      this.client.campaignBlackboardEntry.findMany({
        orderBy: { id: "asc" },
        where: { campaignId, state: { in: ["published", "retracted"] } },
      }),
      this.client.campaignBlackboardLayout.findUnique({ where: { campaignId } }),
      this.client.campaignBlackboardPlacement.findMany({
        orderBy: [{ layer: "asc" }, { entryId: "asc" }],
        where: { campaignId },
      }),
    ]);
    const revisions = entries.length
      ? await this.client.campaignBlackboardEntryRevision.findMany({
          where: {
            OR: entries.map((entry) => ({
              campaignId,
              entryId: entry.id,
              revisionNumber: entry.currentRevisionNumber,
            })),
          },
        })
      : [];
    return { entries, layout, placements, revisions };
  }

  async searchCommonEntries(
    campaignId: string,
    input: {
      category?: BlackboardCategory;
      pinned?: "pinned" | "unpinned";
      query: string;
    },
  ): Promise<BlackboardSearchRecord[]> {
    const category = input.category ?? null;
    const pinned = input.pinned === "pinned" ? true : input.pinned === "unpinned" ? false : null;

    return this.client.$queryRaw<BlackboardSearchRecord[]>(Prisma.sql`
      SELECT
        revision."category" AS "category",
        entry."id" AS "entryId",
        (placement."entryId" IS NOT NULL) AS "pinned",
        revision."title" AS "title"
      FROM "CampaignBlackboardEntry" entry
      JOIN "CampaignBlackboardEntryRevision" revision
        ON revision."campaignId" = entry."campaignId"
        AND revision."entryId" = entry."id"
        AND revision."revisionNumber" = entry."currentRevisionNumber"
      LEFT JOIN "CampaignBlackboardPlacement" placement
        ON placement."campaignId" = entry."campaignId"
        AND placement."entryId" = entry."id"
      WHERE entry."campaignId" = ${campaignId}
        AND entry."state" = 'published'
        AND (${category}::text IS NULL OR revision."category" = ${category})
        AND (${pinned}::boolean IS NULL OR (placement."entryId" IS NOT NULL) = ${pinned})
        AND (
          ${input.query} = ''
          OR POSITION(
            LOWER(${input.query}) IN LOWER(
              CONCAT_WS(
                ' ',
                revision."title",
                CASE revision."category"
                  WHEN 'clue_fact' THEN CONCAT_WS(' ', revision."clueFact", revision."contextText")
                  WHEN 'document_text' THEN CONCAT_WS(' ', revision."documentText", revision."contextText")
                  WHEN 'image_map' THEN CONCAT_WS(
                    ' ',
                    revision."imageCaption",
                    revision."sourceArtifactTitle",
                    revision."sourceArtifactAltText"
                  )
                  WHEN 'recap' THEN revision."recapText"
                  ELSE ''
                END
              )
            )
          ) > 0
        )
      ORDER BY LOWER(revision."title"), entry."id"
    `);
  }

  async loadEntry(campaignId: string, entryId: string) {
    const entry = await this.client.campaignBlackboardEntry.findUnique({ where: { id: entryId } });
    if (!entry || entry.campaignId !== campaignId || entry.state === "archived") return null;
    const revision = await this.client.campaignBlackboardEntryRevision.findUnique({
      where: {
        campaignId_entryId_revisionNumber: {
          campaignId,
          entryId,
          revisionNumber: entry.currentRevisionNumber,
        },
      },
    });
    const placement = await this.client.campaignBlackboardPlacement.findUnique({
      where: { campaignId_entryId: { campaignId, entryId } },
    });
    return revision ? { entry, placement, revision } : null;
  }

  async createEntry(input: {
    actor: BlackboardActor;
    campaignId: string;
    content: BlackboardGmCreate;
  }): Promise<string> {
    const entryId = randomUUID();
    await this.client.$transaction(async (tx) => {
      const candidate =
        input.content.category === "image_map"
          ? await this.artifactResolver.resolve(
              tx,
              input.campaignId,
              input.content.sourceArtifactId,
            )
          : undefined;
      if (input.content.category === "image_map" && !candidate) {
        throw new BlackboardRepositoryConflictError("reference");
      }
      const changedAt = new Date();
      await tx.campaignBlackboardEntry.create({
        data: {
          campaignId: input.campaignId,
          category: input.content.category,
          createdByLabelSnapshot: input.actor.label,
          createdByUserId: input.actor.id,
          currentRevisionNumber: 1,
          entryVersion: 1,
          id: entryId,
          state: "published",
          stateChangedAt: changedAt,
          stateChangedByLabelSnapshot: input.actor.label,
          stateChangedByUserId: input.actor.id,
          updatedAt: changedAt,
        },
      });
      const content = revisionData(input.content, input.actor, candidate ?? undefined);
      await tx.campaignBlackboardEntryRevision.create({
        data: {
          ...content,
          campaignId: input.campaignId,
          category: input.content.category,
          changeKind: "initial",
          changedAt,
          entryId,
          revisionNumber: 1,
        },
      });
      await tx.campaignBlackboardEntryEvent.create({
        data: {
          action: "initial",
          actorLabelSnapshot: input.actor.label,
          actorUserId: input.actor.id,
          campaignId: input.campaignId,
          entryId,
          entryVersion: 1,
          occurredAt: changedAt,
          revisionNumber: 1,
        },
      });
      if (candidate) {
        await tx.campaignBlackboardArtifactSourceLink.create({
          data: {
            artifactId: candidate.id,
            campaignId: input.campaignId,
            entryId,
            revisionNumber: 1,
          },
        });
      }
      await this.createInitialDetails(
        tx,
        input.campaignId,
        entryId,
        input.actor,
        detailInputs(input.content),
      );
    });
    return entryId;
  }

  async reviseEntry(input: {
    actor: BlackboardActor;
    campaignId: string;
    content: BlackboardGmRevision;
    entryId: string;
    isGm: boolean;
  }): Promise<void> {
    await this.client.$transaction(async (tx) => {
      const entry = await this.lockEntry(tx, input.campaignId, input.entryId);
      await this.concurrencyHooks.afterEntryLock?.("revision");
      if (
        !entry ||
        entry.state !== "published" ||
        entry.entryVersion !== input.content.expectedEntryVersion ||
        entry.category !== input.content.category
      ) {
        throw new BlackboardRepositoryConflictError(entry ? "stale" : "reference");
      }
      if (!input.isGm && entry.createdByUserId !== input.actor.id) {
        throw new BlackboardRepositoryConflictError("reference");
      }
      if (!input.isGm && input.content.category === "recap") {
        throw new BlackboardRepositoryConflictError("reference");
      }
      const current = await tx.campaignBlackboardEntryRevision.findUniqueOrThrow({
        where: {
          campaignId_entryId_revisionNumber: {
            campaignId: input.campaignId,
            entryId: input.entryId,
            revisionNumber: entry.currentRevisionNumber,
          },
        },
      });
      const currentMemberships = await tx.campaignBlackboardRevisionDetailUnit.findMany({
        orderBy: { sortOrder: "asc" },
        where: {
          campaignId: input.campaignId,
          entryId: input.entryId,
          revisionNumber: entry.currentRevisionNumber,
        },
      });
      let candidate: ArtifactBlackboardCandidate | undefined;
      if (input.content.category === "image_map") {
        const artifactId =
          input.content.changeKind === "refresh"
            ? current.sourceArtifactIdSnapshot
            : input.content.sourceArtifactId;
        if (!artifactId) throw new BlackboardRepositoryConflictError("reference");
        candidate =
          (await this.artifactResolver.resolve(tx, input.campaignId, artifactId)) ?? undefined;
        if (!candidate) throw new BlackboardRepositoryConflictError("reference");
      }
      const revisionNumber = entry.currentRevisionNumber + 1;
      const entryVersion = entry.entryVersion + 1;
      const changedAt = new Date();
      const content = revisionData(input.content, input.actor, candidate, current);
      await tx.campaignBlackboardEntryRevision.create({
        data: {
          ...content,
          campaignId: input.campaignId,
          category: input.content.category,
          changeKind: input.content.changeKind,
          changedAt,
          entryId: input.entryId,
          revisionNumber,
        },
      });
      await this.carryOrReplaceDetails(tx, {
        actor: input.actor,
        campaignId: input.campaignId,
        details: input.isGm ? detailInputs(input.content) : undefined,
        entryId: input.entryId,
        fromRevisionNumber: entry.currentRevisionNumber,
        memberships: currentMemberships,
        toRevisionNumber: revisionNumber,
      });
      if (candidate) {
        await tx.campaignBlackboardArtifactSourceLink.create({
          data: {
            artifactId: candidate.id,
            campaignId: input.campaignId,
            entryId: input.entryId,
            revisionNumber,
          },
        });
      }
      const updated = await tx.campaignBlackboardEntry.updateMany({
        data: {
          currentRevisionNumber: revisionNumber,
          entryVersion,
          stateChangedAt: changedAt,
          stateChangedByLabelSnapshot: input.actor.label,
          stateChangedByUserId: input.actor.id,
          updatedAt: changedAt,
        },
        where: {
          campaignId: input.campaignId,
          entryVersion: entry.entryVersion,
          id: input.entryId,
          state: "published",
        },
      });
      if (updated.count !== 1) throw new BlackboardRepositoryConflictError("stale");
      await tx.campaignBlackboardEntryEvent.create({
        data: {
          action: input.content.changeKind,
          actorLabelSnapshot: input.actor.label,
          actorUserId: input.actor.id,
          campaignId: input.campaignId,
          entryId: input.entryId,
          entryVersion,
          occurredAt: changedAt,
          revisionNumber,
        },
      });
    });
  }

  async retractEntry(input: {
    actor: BlackboardActor;
    campaignId: string;
    entryId: string;
    expectedEntryVersion: number;
    isGm: boolean;
  }): Promise<void> {
    await this.client.$transaction(async (tx) => {
      const entry = await this.lockEntry(tx, input.campaignId, input.entryId);
      await this.concurrencyHooks.afterEntryLock?.("lifecycle");
      if (!entry) throw new BlackboardRepositoryConflictError("reference");
      if (!input.isGm && entry.createdByUserId !== input.actor.id) {
        throw new BlackboardRepositoryConflictError("reference");
      }
      if (entry.state !== "published" || entry.entryVersion !== input.expectedEntryVersion) {
        throw new BlackboardRepositoryConflictError("stale");
      }
      const changedAt = new Date();
      const entryVersion = entry.entryVersion + 1;
      await tx.campaignBlackboardEntry.update({
        data: {
          entryVersion,
          state: "retracted",
          stateChangedAt: changedAt,
          stateChangedByLabelSnapshot: input.actor.label,
          stateChangedByUserId: input.actor.id,
          updatedAt: changedAt,
        },
        where: { id: input.entryId },
      });
      await tx.campaignBlackboardEntryEvent.create({
        data: {
          action: "retraction",
          actorLabelSnapshot: input.actor.label,
          actorUserId: input.actor.id,
          campaignId: input.campaignId,
          entryId: input.entryId,
          entryVersion,
          occurredAt: changedAt,
        },
      });
    });
  }

  async archiveEntry(input: {
    actor: BlackboardActor;
    campaignId: string;
    entryId: string;
    expectedEntryVersion: number;
    expectedLayoutVersion: number;
  }): Promise<void> {
    await this.client.$transaction(async (tx) => {
      const entry = await this.lockEntry(tx, input.campaignId, input.entryId);
      await this.concurrencyHooks.afterEntryLock?.("archive");
      if (!entry) throw new BlackboardRepositoryConflictError("reference");
      if (entry.state !== "retracted" || entry.entryVersion !== input.expectedEntryVersion) {
        throw new BlackboardRepositoryConflictError("stale");
      }
      const layout = await this.lockLayout(tx, input.campaignId);
      const layoutVersion = layout?.layoutVersion ?? 0;
      if (layoutVersion !== input.expectedLayoutVersion) {
        throw new BlackboardRepositoryConflictError("stale");
      }
      const placement = await tx.campaignBlackboardPlacement.findUnique({
        where: { campaignId_entryId: { campaignId: input.campaignId, entryId: input.entryId } },
      });
      if (placement) {
        await tx.campaignBlackboardPlacement.delete({
          where: { campaignId_entryId: { campaignId: input.campaignId, entryId: input.entryId } },
        });
        await this.advanceLayout(tx, input.campaignId, layoutVersion);
      }
      const changedAt = new Date();
      const entryVersion = entry.entryVersion + 1;
      await tx.campaignBlackboardEntry.update({
        data: {
          entryVersion,
          state: "archived",
          stateChangedAt: changedAt,
          stateChangedByLabelSnapshot: input.actor.label,
          stateChangedByUserId: input.actor.id,
          updatedAt: changedAt,
        },
        where: { id: input.entryId },
      });
      await tx.campaignBlackboardEntryEvent.create({
        data: {
          action: "archive",
          actorLabelSnapshot: input.actor.label,
          actorUserId: input.actor.id,
          campaignId: input.campaignId,
          entryId: input.entryId,
          entryVersion,
          occurredAt: changedAt,
        },
      });
    });
  }

  async loadSafeHistory(campaignId: string, entryId: string) {
    const entry = await this.client.campaignBlackboardEntry.findUnique({ where: { id: entryId } });
    if (!entry || entry.campaignId !== campaignId || entry.state === "archived") return null;
    if (entry.state === "retracted") return { entry, revisions: [] };
    const revisions = await this.client.campaignBlackboardEntryRevision.findMany({
      orderBy: { revisionNumber: "asc" },
      where: { campaignId, entryId },
    });
    return { entry, revisions };
  }

  async loadGmAudit(campaignId: string, entryId: string) {
    const entry = await this.client.campaignBlackboardEntry.findUnique({ where: { id: entryId } });
    if (!entry || entry.campaignId !== campaignId) return null;
    const [events, revisions, lineages, versions, memberships, grants, grantEvents, sources] =
      await Promise.all([
        this.client.campaignBlackboardEntryEvent.findMany({
          orderBy: { entryVersion: "asc" },
          where: { campaignId, entryId },
        }),
        this.client.campaignBlackboardEntryRevision.findMany({
          orderBy: { revisionNumber: "asc" },
          where: { campaignId, entryId },
        }),
        this.client.campaignBlackboardDetailUnitLineage.findMany({
          orderBy: { unitKey: "asc" },
          where: { campaignId, entryId },
        }),
        this.client.campaignBlackboardDetailUnitVersion.findMany({
          orderBy: [{ unitKey: "asc" }, { unitVersion: "asc" }],
          where: { campaignId, entryId },
        }),
        this.client.campaignBlackboardRevisionDetailUnit.findMany({
          orderBy: [{ revisionNumber: "asc" }, { sortOrder: "asc" }],
          where: { campaignId, entryId },
        }),
        this.client.campaignBlackboardDetailGrantStream.findMany({
          orderBy: [{ targetCharacterIdSnapshot: "asc" }, { unitKey: "asc" }],
          where: { campaignId, entryId },
        }),
        this.client.campaignBlackboardDetailGrantEvent.findMany({
          orderBy: [
            { targetCharacterIdSnapshot: "asc" },
            { unitKey: "asc" },
            { streamVersion: "asc" },
          ],
          where: { campaignId, entryId },
        }),
        this.client.campaignBlackboardArtifactSourceLink.findMany({
          orderBy: { revisionNumber: "asc" },
          where: { campaignId, entryId },
        }),
      ]);
    return {
      entry,
      events,
      grantEvents,
      grants,
      lineages,
      memberships,
      revisions,
      sources,
      versions,
    };
  }

  async loadExpandedDetails(input: { campaignId: string; characterId: string; entryId: string }) {
    return this.client.$queryRaw<Array<{ detailText: string; label: string | null }>>(Prisma.sql`
      SELECT version."detailText", version."labelSnapshot" AS "label"
      FROM "CampaignBlackboardEntry" entry
      JOIN "CampaignBlackboardRevisionDetailUnit" membership
        ON membership."campaignId" = entry."campaignId"
       AND membership."entryId" = entry."id"
       AND membership."revisionNumber" = entry."currentRevisionNumber"
      JOIN "CampaignBlackboardDetailUnitVersion" version
        ON version."campaignId" = membership."campaignId"
       AND version."entryId" = membership."entryId"
       AND version."unitKey" = membership."unitKey"
       AND version."unitVersion" = membership."unitVersion"
      JOIN "CampaignBlackboardDetailGrantStream" stream
        ON stream."campaignId" = membership."campaignId"
       AND stream."entryId" = membership."entryId"
       AND stream."unitKey" = membership."unitKey"
       AND stream."unitVersion" = membership."unitVersion"
       AND stream."targetCharacterIdSnapshot" = ${input.characterId}
       AND stream."liveCharacterId" = ${input.characterId}
       AND stream."state" = 'granted'
      WHERE entry."campaignId" = ${input.campaignId}
        AND entry."id" = ${input.entryId}
        AND entry."state" = 'published'
      ORDER BY membership."sortOrder", membership."unitKey"
    `);
  }

  async changeGrant(input: {
    action: "granted" | "revoked";
    actor: BlackboardActor;
    campaignId: string;
    characterId: string;
    entryId: string;
    expectedEntryVersion: number;
    expectedGrantVersion: number;
    unitKey: string;
    unitVersion: number;
  }): Promise<void> {
    try {
      await this.client.$transaction(async (tx) => {
        const entry = await this.lockEntry(tx, input.campaignId, input.entryId);
        await this.concurrencyHooks.afterEntryLock?.("grant");
        if (!entry) throw new BlackboardRepositoryConflictError("reference");
        const campaign = await tx.campaign.findUnique({
          select: { gmUserId: true },
          where: { id: input.campaignId },
        });
        if (!campaign || campaign.gmUserId !== input.actor.id || entry.state !== "published") {
          throw new BlackboardRepositoryConflictError("reference");
        }
        if (entry.entryVersion !== input.expectedEntryVersion) {
          throw new BlackboardRepositoryConflictError("stale");
        }
        const membership = await tx.campaignBlackboardRevisionDetailUnit.findUnique({
          where: {
            campaignId_entryId_revisionNumber_unitKey_unitVersion: {
              campaignId: input.campaignId,
              entryId: input.entryId,
              revisionNumber: entry.currentRevisionNumber,
              unitKey: input.unitKey,
              unitVersion: input.unitVersion,
            },
          },
        });
        if (!membership) throw new BlackboardRepositoryConflictError("reference");

        const streams = await tx.$queryRaw<
          Array<{ state: string; streamVersion: number; liveCharacterId: string | null }>
        >(Prisma.sql`
          SELECT "state", "streamVersion", "liveCharacterId"
          FROM "CampaignBlackboardDetailGrantStream"
          WHERE "campaignId" = ${input.campaignId}
            AND "entryId" = ${input.entryId}
            AND "targetCharacterIdSnapshot" = ${input.characterId}
            AND "unitKey" = ${input.unitKey}
            AND "unitVersion" = ${input.unitVersion}
          FOR UPDATE
        `);
        const stream = streams[0];
        await this.concurrencyHooks.afterGrantStreamLock?.(tx);

        const characters = await tx.$queryRaw<Array<{ id: string; name: string }>>(Prisma.sql`
          SELECT character."id", character."name"
          FROM "Character" character
          JOIN "CampaignRosterEntry" roster
            ON roster."sourceType" = 'character'
           AND roster."sourceId" = character."id"
           AND roster."campaignId" = ${input.campaignId}
          WHERE character."id" = ${input.characterId}
          FOR KEY SHARE OF character
        `);
        const character = characters[0];
        if (!character || (stream && stream.liveCharacterId === null)) {
          throw new BlackboardRepositoryConflictError("reference");
        }
        const actualVersion = stream?.streamVersion ?? 0;
        const actualState = stream?.state ?? "revoked";
        if (
          actualVersion !== input.expectedGrantVersion ||
          actualState === input.action ||
          (!stream && input.action === "revoked")
        ) {
          throw new BlackboardRepositoryConflictError("stale");
        }
        const nextVersion = actualVersion + 1;
        if (!stream) {
          await tx.campaignBlackboardDetailGrantStream.create({
            data: {
              campaignId: input.campaignId,
              currentEntryRevisionNumber: entry.currentRevisionNumber,
              entryId: input.entryId,
              liveCharacterId: character.id,
              state: input.action,
              streamVersion: nextVersion,
              targetCharacterIdSnapshot: character.id,
              unitKey: input.unitKey,
              unitVersion: input.unitVersion,
            },
          });
        } else {
          await tx.campaignBlackboardDetailGrantStream.update({
            data: {
              currentEntryRevisionNumber: entry.currentRevisionNumber,
              state: input.action,
              streamVersion: nextVersion,
            },
            where: {
              campaignId_entryId_targetCharacterIdSnapshot_unitKey_unitVersion: {
                campaignId: input.campaignId,
                entryId: input.entryId,
                targetCharacterIdSnapshot: input.characterId,
                unitKey: input.unitKey,
                unitVersion: input.unitVersion,
              },
            },
          });
        }
        await tx.campaignBlackboardDetailGrantEvent.create({
          data: {
            actorLabelSnapshot: input.actor.label,
            actorUserId: input.actor.id,
            campaignId: input.campaignId,
            entryId: input.entryId,
            entryRevisionNumber: entry.currentRevisionNumber,
            occurredAt: new Date(),
            resultState: input.action,
            streamVersion: nextVersion,
            targetCharacterIdSnapshot: character.id,
            targetCharacterLabelSnapshot: character.name,
            unitKey: input.unitKey,
            unitVersion: input.unitVersion,
          },
        });
      });
    } catch (error) {
      if (isRetryableTransactionError(error)) {
        throw new BlackboardRepositoryConflictError("retryable");
      }
      throw error;
    }
  }

  async createPlacement(input: {
    actor: BlackboardActor;
    campaignId: string;
    entryId: string;
    expectedLayoutVersion: number;
    groupId?: string | null;
    height: number;
    layer: number;
    width: number;
    x: number;
    y: number;
  }): Promise<void> {
    await this.client.$transaction(async (tx) => {
      const entry = await this.lockEntry(tx, input.campaignId, input.entryId);
      await this.concurrencyHooks.afterEntryLock?.("layout");
      if (!entry || entry.state !== "published") {
        throw new BlackboardRepositoryConflictError("reference");
      }
      const layout = await this.lockOrCreateLayout(tx, input.campaignId);
      const layoutVersion = layout.layoutVersion;
      if (layoutVersion !== input.expectedLayoutVersion) {
        throw new BlackboardRepositoryConflictError("stale");
      }
      if (
        await tx.campaignBlackboardPlacement.findUnique({
          where: { campaignId_entryId: { campaignId: input.campaignId, entryId: input.entryId } },
        })
      ) {
        throw new BlackboardRepositoryConflictError("stale");
      }
      await this.advanceLayout(tx, input.campaignId, layoutVersion);
      await tx.campaignBlackboardPlacement.create({
        data: {
          campaignId: input.campaignId,
          entryId: input.entryId,
          groupId: input.groupId ?? null,
          height: input.height,
          layer: input.layer,
          rowVersion: 1,
          updatedAt: new Date(),
          updatedByLabelSnapshot: input.actor.label,
          updatedByUserId: input.actor.id,
          width: input.width,
          x: input.x,
          y: input.y,
        },
      });
    });
  }

  async updatePlacement(input: {
    actor: BlackboardActor;
    campaignId: string;
    entryId: string;
    expectedLayoutVersion: number;
    expectedRowVersion: number;
    groupId?: string | null;
    height: number;
    layer: number;
    width: number;
    x: number;
    y: number;
  }): Promise<void> {
    await this.client.$transaction(async (tx) => {
      const entry = await this.lockEntry(tx, input.campaignId, input.entryId);
      await this.concurrencyHooks.afterEntryLock?.("layout");
      if (!entry || !["published", "retracted"].includes(entry.state)) {
        throw new BlackboardRepositoryConflictError("reference");
      }
      const layout = await this.lockLayout(tx, input.campaignId);
      if (!layout || layout.layoutVersion !== input.expectedLayoutVersion) {
        throw new BlackboardRepositoryConflictError("stale");
      }
      const updated = await tx.campaignBlackboardPlacement.updateMany({
        data: {
          groupId: input.groupId ?? null,
          height: input.height,
          layer: input.layer,
          rowVersion: { increment: 1 },
          updatedAt: new Date(),
          updatedByLabelSnapshot: input.actor.label,
          updatedByUserId: input.actor.id,
          width: input.width,
          x: input.x,
          y: input.y,
        },
        where: {
          campaignId: input.campaignId,
          entryId: input.entryId,
          rowVersion: input.expectedRowVersion,
        },
      });
      if (updated.count !== 1) throw new BlackboardRepositoryConflictError("stale");
      await this.advanceLayout(tx, input.campaignId, layout.layoutVersion);
    });
  }

  async deletePlacement(input: {
    campaignId: string;
    entryId: string;
    expectedLayoutVersion: number;
    expectedRowVersion: number;
  }): Promise<void> {
    await this.client.$transaction(async (tx) => {
      const entry = await this.lockEntry(tx, input.campaignId, input.entryId);
      await this.concurrencyHooks.afterEntryLock?.("layout");
      if (!entry || !["published", "retracted"].includes(entry.state)) {
        throw new BlackboardRepositoryConflictError("reference");
      }
      const layout = await this.lockLayout(tx, input.campaignId);
      if (!layout || layout.layoutVersion !== input.expectedLayoutVersion) {
        throw new BlackboardRepositoryConflictError("stale");
      }
      const deleted = await tx.campaignBlackboardPlacement.deleteMany({
        where: {
          campaignId: input.campaignId,
          entryId: input.entryId,
          rowVersion: input.expectedRowVersion,
        },
      });
      if (deleted.count !== 1) throw new BlackboardRepositoryConflictError("stale");
      await this.advanceLayout(tx, input.campaignId, layout.layoutVersion);
    });
  }

  async groupPlacements(input: {
    actor: BlackboardActor;
    campaignId: string;
    entryIds: string[];
    expectedLayoutVersion: number;
    expectedRowVersions: Record<string, number>;
    groupId?: string | null;
  }): Promise<string | null> {
    const groupId = input.groupId === undefined ? randomUUID() : input.groupId;
    await this.client.$transaction(async (tx) => {
      const entryIds = [...new Set(input.entryIds)].sort();
      if (entryIds.length !== input.entryIds.length) {
        throw new BlackboardRepositoryConflictError("reference");
      }
      for (const entryId of entryIds) {
        const entry = await this.lockEntry(tx, input.campaignId, entryId);
        await this.concurrencyHooks.afterEntryLock?.("layout");
        if (!entry || !["published", "retracted"].includes(entry.state)) {
          throw new BlackboardRepositoryConflictError("reference");
        }
      }
      const layout = await this.lockLayout(tx, input.campaignId);
      if (!layout || layout.layoutVersion !== input.expectedLayoutVersion) {
        throw new BlackboardRepositoryConflictError("stale");
      }
      for (const entryId of entryIds) {
        const expectedRowVersion = input.expectedRowVersions[entryId];
        if (!expectedRowVersion) throw new BlackboardRepositoryConflictError("reference");
        const updated = await tx.campaignBlackboardPlacement.updateMany({
          data: {
            groupId,
            rowVersion: { increment: 1 },
            updatedAt: new Date(),
            updatedByLabelSnapshot: input.actor.label,
            updatedByUserId: input.actor.id,
          },
          where: {
            campaignId: input.campaignId,
            entryId,
            rowVersion: expectedRowVersion,
          },
        });
        if (updated.count !== 1) throw new BlackboardRepositoryConflictError("stale");
      }
      await this.advanceLayout(tx, input.campaignId, layout.layoutVersion);
    });
    return groupId;
  }

  private async lockEntry(
    tx: Prisma.TransactionClient,
    campaignId: string,
    entryId: string,
  ): Promise<BlackboardEntrySnapshot | null> {
    const rows = await tx.$queryRaw<BlackboardEntrySnapshot[]>(Prisma.sql`
      SELECT
        "id", "category", "createdByUserId", "state", "entryVersion", "currentRevisionNumber"
      FROM "CampaignBlackboardEntry"
      WHERE "campaignId" = ${campaignId} AND "id" = ${entryId}
      FOR UPDATE
    `);
    return rows[0] ?? null;
  }

  private async lockLayout(tx: Prisma.TransactionClient, campaignId: string) {
    const rows = await tx.$queryRaw<Array<{ campaignId: string; layoutVersion: number }>>(
      Prisma.sql`
        SELECT "campaignId", "layoutVersion"
        FROM "CampaignBlackboardLayout"
        WHERE "campaignId" = ${campaignId}
        FOR UPDATE
      `,
    );
    return rows[0] ?? null;
  }

  private async lockOrCreateLayout(tx: Prisma.TransactionClient, campaignId: string) {
    await tx.$executeRaw(Prisma.sql`
      INSERT INTO "CampaignBlackboardLayout" ("campaignId", "layoutVersion", "updatedAt")
      VALUES (${campaignId}, 0, CURRENT_TIMESTAMP)
      ON CONFLICT ("campaignId") DO NOTHING
    `);
    const layout = await this.lockLayout(tx, campaignId);
    if (!layout) throw new BlackboardRepositoryConflictError("reference");
    return layout;
  }

  private async advanceLayout(
    tx: Prisma.TransactionClient,
    campaignId: string,
    currentVersion: number,
  ) {
    const updated = await tx.campaignBlackboardLayout.updateMany({
      data: { layoutVersion: { increment: 1 }, updatedAt: new Date() },
      where: { campaignId, layoutVersion: currentVersion },
    });
    if (updated.count !== 1) throw new BlackboardRepositoryConflictError("stale");
  }

  private async createInitialDetails(
    tx: Prisma.TransactionClient,
    campaignId: string,
    entryId: string,
    actor: BlackboardActor,
    details?: BlackboardRestrictedDetailInput[],
  ) {
    for (const detail of details ?? []) {
      if (detail.unitKey) throw new BlackboardRepositoryConflictError("reference");
      const unitKey = randomUUID();
      await tx.campaignBlackboardDetailUnitLineage.create({
        data: { campaignId, entryId, unitKey },
      });
      await tx.campaignBlackboardDetailUnitVersion.create({
        data: {
          campaignId,
          createdByLabelSnapshot: actor.label,
          createdByUserId: actor.id,
          detailText: detail.detailText,
          entryId,
          labelSnapshot: detail.label ?? null,
          unitKey,
          unitVersion: 1,
        },
      });
      await tx.campaignBlackboardRevisionDetailUnit.create({
        data: {
          campaignId,
          entryId,
          revisionNumber: 1,
          sortOrder: detail.sortOrder,
          unitKey,
          unitVersion: 1,
        },
      });
    }
  }

  private async carryOrReplaceDetails(
    tx: Prisma.TransactionClient,
    input: {
      actor: BlackboardActor;
      campaignId: string;
      details?: BlackboardRestrictedDetailInput[];
      entryId: string;
      fromRevisionNumber: number;
      memberships?: BlackboardDetailMembership[];
      toRevisionNumber: number;
    },
  ) {
    const memberships =
      input.memberships ??
      (await tx.campaignBlackboardRevisionDetailUnit.findMany({
        orderBy: { sortOrder: "asc" },
        where: {
          campaignId: input.campaignId,
          entryId: input.entryId,
          revisionNumber: input.fromRevisionNumber,
        },
      }));
    if (input.details === undefined) {
      if (memberships.length) {
        await tx.campaignBlackboardRevisionDetailUnit.createMany({
          data: memberships.map((membership) => ({
            campaignId: input.campaignId,
            entryId: input.entryId,
            revisionNumber: input.toRevisionNumber,
            sortOrder: membership.sortOrder,
            unitKey: membership.unitKey,
            unitVersion: membership.unitVersion,
          })),
        });
      }
      return;
    }
    const currentByKey = new Map(memberships.map((membership) => [membership.unitKey, membership]));
    for (const detail of input.details) {
      let unitKey = detail.unitKey;
      let unitVersion = 1;
      if (!unitKey) {
        unitKey = randomUUID();
        await tx.campaignBlackboardDetailUnitLineage.create({
          data: { campaignId: input.campaignId, entryId: input.entryId, unitKey },
        });
        await tx.campaignBlackboardDetailUnitVersion.create({
          data: {
            campaignId: input.campaignId,
            createdByLabelSnapshot: input.actor.label,
            createdByUserId: input.actor.id,
            detailText: detail.detailText,
            entryId: input.entryId,
            labelSnapshot: detail.label ?? null,
            unitKey,
            unitVersion,
          },
        });
      } else {
        const current = currentByKey.get(unitKey);
        if (!current) throw new BlackboardRepositoryConflictError("reference");
        const version = await tx.campaignBlackboardDetailUnitVersion.findUniqueOrThrow({
          where: {
            campaignId_entryId_unitKey_unitVersion: {
              campaignId: input.campaignId,
              entryId: input.entryId,
              unitKey,
              unitVersion: current.unitVersion,
            },
          },
        });
        if (
          version.detailText === detail.detailText &&
          version.labelSnapshot === (detail.label ?? null)
        ) {
          unitVersion = current.unitVersion;
        } else {
          const maximum = await tx.campaignBlackboardDetailUnitVersion.aggregate({
            _max: { unitVersion: true },
            where: { campaignId: input.campaignId, entryId: input.entryId, unitKey },
          });
          unitVersion = (maximum._max.unitVersion ?? 0) + 1;
          await tx.campaignBlackboardDetailUnitVersion.create({
            data: {
              campaignId: input.campaignId,
              createdByLabelSnapshot: input.actor.label,
              createdByUserId: input.actor.id,
              detailText: detail.detailText,
              entryId: input.entryId,
              labelSnapshot: detail.label ?? null,
              unitKey,
              unitVersion,
            },
          });
        }
      }
      await tx.campaignBlackboardRevisionDetailUnit.create({
        data: {
          campaignId: input.campaignId,
          entryId: input.entryId,
          revisionNumber: input.toRevisionNumber,
          sortOrder: detail.sortOrder,
          unitKey,
          unitVersion,
        },
      });
    }
  }
}
