import type {
  CharacterBuild,
  CharacterLedgerEvent,
  CharacterRevisionRecord,
  CharacterVersionEnvelope,
  RetainedCharacterState,
  CharacterEffectiveSkillReadModel,
} from "@glantri/domain";
import { Prisma, type PrismaClient } from "@prisma/client";

import { prisma as defaultPrisma } from "../client";

type RevisionWrite = Omit<CharacterRevisionRecord, "createdAt" | "events" | "revisionState"> & {
  events: Array<Omit<CharacterLedgerEvent, "occurredAt">>;
};

export interface RetainedCharacterRepository {
  appendRevision(input: {
    expectedRevisionId: string;
    revision: RevisionWrite;
  }): Promise<
    | { kind: "committed" | "idempotent"; revision: CharacterRevisionRecord }
    | { currentRevisionId: string | null; kind: "stale" }
  >;
  createFinalized(input: {
    build: CharacterBuild;
    ownerId: string;
    revision: RevisionWrite;
  }): Promise<CharacterRevisionRecord>;
  findActiveCampaignMembership(characterId: string): Promise<{
    campaignId: string;
    campaignStatus: "draft" | "active" | "archived";
    gmUserId: string;
    rosterEntryId: string;
  } | null>;
  findCurrent(characterId: string): Promise<CharacterRevisionRecord | null>;
  findByCommand(
    characterId: string,
    commandIdempotencyKey: string,
  ): Promise<CharacterRevisionRecord | null>;
  findRevision(characterId: string, revisionId: string): Promise<CharacterRevisionRecord | null>;
}

function json(value: unknown): Prisma.InputJsonValue {
  return value as Prisma.InputJsonValue;
}

function eventData(event: Omit<CharacterLedgerEvent, "occurredAt">) {
  return {
    actorUserId: event.actorUserId,
    authority: event.authority,
    characterId: event.characterId,
    characterRevisionId: event.characterRevisionId,
    component: event.component,
    economicsJson: event.economics ? json(event.economics) : Prisma.JsonNull,
    eventKind: event.eventKind,
    id: event.eventId,
    idempotencyKey: event.idempotencyKey,
    phase: event.phase,
    prerequisiteEvidenceJson: event.prerequisiteEvidence
      ? json(event.prerequisiteEvidence)
      : Prisma.JsonNull,
    protectedProvenanceJson: event.protectedProvenance
      ? json(event.protectedProvenance)
      : Prisma.JsonNull,
    publicExplanation: event.publicExplanation,
    sequence: event.sequence,
    sourceId: event.sourceId,
    sourceKind: event.sourceKind,
    sourceLabel: event.sourceLabel,
    targetId: event.targetId,
    targetKind: event.targetKind,
    valueAfter: event.valueAfter,
    valueBefore: event.valueBefore,
    valueDelta: event.valueDelta,
    versionEnvelopeJson: json(event.versionEnvelope),
    visibility: event.visibility,
  };
}

function revisionData(revision: RevisionWrite) {
  return {
    actorUserId: revision.actorUserId,
    characterId: revision.characterId,
    commandDigest: revision.commandDigest,
    commandIdempotencyKey: revision.commandIdempotencyKey,
    effectiveSkillsJson: json(revision.effectiveSkills),
    id: revision.id,
    migrationLineageJson: json(revision.migrationLineage),
    parentRevisionId: revision.parentRevisionId,
    reason: revision.reason,
    revisionDigest: revision.revisionDigest,
    sequence: revision.sequence,
    stateJson: json(revision.state),
    versionEnvelopeJson: json(revision.versionEnvelope),
  };
}

function mapEvent(record: {
  actorUserId: string | null;
  authority: string;
  characterId: string;
  characterRevisionId: string;
  component: string;
  economicsJson: unknown;
  eventKind: string;
  id: string;
  idempotencyKey: string;
  occurredAt: Date;
  phase: string;
  prerequisiteEvidenceJson: unknown;
  protectedProvenanceJson: unknown;
  publicExplanation: string;
  sequence: number;
  sourceId: string;
  sourceKind: string;
  sourceLabel: string;
  targetId: string;
  targetKind: string;
  valueAfter: number | null;
  valueBefore: number | null;
  valueDelta: number | null;
  versionEnvelopeJson: unknown;
  visibility: string;
}): CharacterLedgerEvent {
  return {
    actorUserId: record.actorUserId,
    authority: record.authority as CharacterLedgerEvent["authority"],
    characterId: record.characterId,
    characterRevisionId: record.characterRevisionId,
    component: record.component as CharacterLedgerEvent["component"],
    economics: (record.economicsJson as Record<string, unknown> | null) ?? undefined,
    eventId: record.id,
    eventKind: record.eventKind as CharacterLedgerEvent["eventKind"],
    idempotencyKey: record.idempotencyKey,
    occurredAt: record.occurredAt.toISOString(),
    phase: record.phase as CharacterLedgerEvent["phase"],
    prerequisiteEvidence:
      (record.prerequisiteEvidenceJson as Record<string, unknown> | null) ?? undefined,
    protectedProvenance:
      (record.protectedProvenanceJson as Record<string, unknown> | null) ?? undefined,
    publicExplanation: record.publicExplanation,
    sequence: record.sequence,
    sourceId: record.sourceId,
    sourceKind: record.sourceKind,
    sourceLabel: record.sourceLabel,
    targetId: record.targetId,
    targetKind: record.targetKind as CharacterLedgerEvent["targetKind"],
    valueAfter: record.valueAfter,
    valueBefore: record.valueBefore,
    valueDelta: record.valueDelta,
    versionEnvelope: record.versionEnvelopeJson as CharacterVersionEnvelope,
    visibility: record.visibility as CharacterLedgerEvent["visibility"],
  };
}

function mapRevision(record: {
  actorUserId: string | null;
  characterId: string;
  commandDigest: string;
  commandIdempotencyKey: string;
  createdAt: Date;
  effectiveSkillsJson: unknown;
  events: Parameters<typeof mapEvent>[0][];
  id: string;
  migrationLineageJson: unknown;
  parentRevisionId: string | null;
  reason: string;
  revisionDigest: string;
  sequence: number;
  stateJson: unknown;
  versionEnvelopeJson: unknown;
}): CharacterRevisionRecord {
  return {
    actorUserId: record.actorUserId,
    characterId: record.characterId,
    commandDigest: record.commandDigest as `sha256:${string}`,
    commandIdempotencyKey: record.commandIdempotencyKey,
    createdAt: record.createdAt.toISOString(),
    effectiveSkills: record.effectiveSkillsJson as CharacterEffectiveSkillReadModel,
    events: record.events.map(mapEvent),
    id: record.id,
    migrationLineage: record.migrationLineageJson as CharacterRevisionRecord["migrationLineage"],
    parentRevisionId: record.parentRevisionId,
    reason: record.reason,
    revisionDigest: record.revisionDigest as `sha256:${string}`,
    revisionState: "historical",
    sequence: record.sequence,
    state: record.stateJson as RetainedCharacterState,
    versionEnvelope: record.versionEnvelopeJson as CharacterVersionEnvelope,
  };
}

const revisionInclude = { events: { orderBy: { sequence: "asc" as const } } };

async function mapRevisionWithCumulativeLedger(
  client: {
    character: {
      findUnique(input: unknown): Promise<{ currentRetainedRevisionId: string | null } | null>;
    };
    characterLedgerEvent: {
      findMany(input: unknown): Promise<Parameters<typeof mapEvent>[0][]>;
    };
  },
  record: Parameters<typeof mapRevision>[0],
): Promise<CharacterRevisionRecord> {
  const [events, character] = await Promise.all([
    client.characterLedgerEvent.findMany({
      orderBy: [{ characterRevision: { sequence: "asc" } }, { sequence: "asc" }],
      where: {
        characterId: record.characterId,
        characterRevision: { sequence: { lte: record.sequence } },
      },
    }),
    client.character.findUnique({
      select: { currentRetainedRevisionId: true },
      where: { id: record.characterId },
    }),
  ]);
  return {
    ...mapRevision({ ...record, events }),
    revisionState: character?.currentRetainedRevisionId === record.id ? "current" : "historical",
  };
}

export function createPrismaRetainedCharacterRepository(
  client?: PrismaClient,
): RetainedCharacterRepository {
  const prisma = client ?? defaultPrisma;

  async function findRevision(characterId: string, revisionId: string) {
    const revision = await prisma.characterRevision.findFirst({
      include: revisionInclude,
      where: { characterId, id: revisionId },
    });
    return revision ? mapRevisionWithCumulativeLedger(prisma, revision) : null;
  }

  return {
    async appendRevision(input) {
      try {
        return await prisma.$transaction(
          async (transaction) => {
            const replay = await transaction.characterRevision.findUnique({
              include: revisionInclude,
              where: {
                characterId_commandIdempotencyKey: {
                  characterId: input.revision.characterId,
                  commandIdempotencyKey: input.revision.commandIdempotencyKey,
                },
              },
            });
            if (replay) {
              if (replay.commandDigest !== input.revision.commandDigest) {
                throw new Error("retained_character_idempotency_conflict");
              }
              return {
                kind: "idempotent" as const,
                revision: await mapRevisionWithCumulativeLedger(transaction, replay),
              };
            }

            const character = await transaction.character.findUnique({
              select: { currentRetainedRevisionId: true },
              where: { id: input.revision.characterId },
            });
            if (!character || character.currentRetainedRevisionId !== input.expectedRevisionId) {
              return {
                currentRevisionId: character?.currentRetainedRevisionId ?? null,
                kind: "stale" as const,
              };
            }

            await transaction.characterRevision.create({ data: revisionData(input.revision) });
            await transaction.characterLedgerEvent.createMany({
              data: input.revision.events.map(eventData),
            });
            const moved = await transaction.character.updateMany({
              data: { currentRetainedRevisionId: input.revision.id },
              where: {
                currentRetainedRevisionId: input.expectedRevisionId,
                id: input.revision.characterId,
              },
            });
            if (moved.count !== 1) throw new Error("retained_character_stale_revision");
            const committed = await transaction.characterRevision.findUniqueOrThrow({
              include: revisionInclude,
              where: { id: input.revision.id },
            });
            return {
              kind: "committed" as const,
              revision: await mapRevisionWithCumulativeLedger(transaction, committed),
            };
          },
          { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
        );
      } catch (error) {
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2034") {
          const replay = await prisma.characterRevision.findUnique({
            include: revisionInclude,
            where: {
              characterId_commandIdempotencyKey: {
                characterId: input.revision.characterId,
                commandIdempotencyKey: input.revision.commandIdempotencyKey,
              },
            },
          });
          if (replay) {
            if (replay.commandDigest !== input.revision.commandDigest) {
              throw new Error("retained_character_idempotency_conflict");
            }
            return {
              kind: "idempotent",
              revision: await mapRevisionWithCumulativeLedger(prisma, replay),
            };
          }
          const character = await prisma.character.findUnique({
            select: { currentRetainedRevisionId: true },
            where: { id: input.revision.characterId },
          });
          return {
            currentRevisionId: character?.currentRetainedRevisionId ?? null,
            kind: "stale",
          };
        }
        throw error;
      }
    },
    async createFinalized(input) {
      return prisma.$transaction(
        async (transaction) => {
          await transaction.character.create({
            data: {
              build: json(input.build),
              id: input.build.id,
              level: input.build.progression.level,
              name: input.build.name,
              ownerId: input.ownerId,
            },
          });
          await transaction.characterRevision.create({ data: revisionData(input.revision) });
          await transaction.characterLedgerEvent.createMany({
            data: input.revision.events.map(eventData),
          });
          await transaction.character.update({
            data: { currentRetainedRevisionId: input.revision.id },
            where: { id: input.build.id },
          });
          const committed = await transaction.characterRevision.findUniqueOrThrow({
            include: revisionInclude,
            where: { id: input.revision.id },
          });
          return mapRevisionWithCumulativeLedger(transaction, committed);
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );
    },
    async findActiveCampaignMembership(characterId) {
      const entry = await prisma.campaignRosterEntry.findFirst({
        include: { campaign: { select: { gmUserId: true, status: true } } },
        where: { sourceId: characterId, sourceType: "character" },
      });
      return entry
        ? {
            campaignId: entry.campaignId,
            campaignStatus: entry.campaign.status,
            gmUserId: entry.campaign.gmUserId,
            rosterEntryId: entry.id,
          }
        : null;
    },
    async findByCommand(characterId, commandIdempotencyKey) {
      const revision = await prisma.characterRevision.findUnique({
        include: revisionInclude,
        where: {
          characterId_commandIdempotencyKey: { characterId, commandIdempotencyKey },
        },
      });
      return revision ? mapRevisionWithCumulativeLedger(prisma, revision) : null;
    },
    async findCurrent(characterId) {
      const character = await prisma.character.findUnique({
        select: { currentRetainedRevisionId: true },
        where: { id: characterId },
      });
      return character?.currentRetainedRevisionId
        ? findRevision(characterId, character.currentRetainedRevisionId)
        : null;
    },
    findRevision,
  };
}
