import { characterBuildSchema, type CharacterBuild, type CharacterRecord } from "@glantri/domain";
import type { PrismaClient } from "@prisma/client";

import { prisma as defaultPrisma } from "../client";

export type { CharacterRecord };

export interface CreateCharacterRecordInput {
  build: CharacterBuild;
  id: string;
  level?: number;
  name: string;
  ownerId?: string | null;
}

export interface VersionedCharacterRecordInput extends CreateCharacterRecordInput {
  expectedUpdatedAt: string;
}

export interface CharacterRepository {
  createOwned(input: CreateCharacterRecordInput): Promise<CharacterRecord>;
  deleteVersioned(id: string, expectedUpdatedAt: string): Promise<boolean>;
  findById(id: string): Promise<CharacterRecord | null>;
  findInGmCampaigns(gmUserId: string, id: string): Promise<CharacterRecord | null>;
  findOwnedById(ownerId: string, id: string): Promise<CharacterRecord | null>;
  listAll(): Promise<CharacterRecord[]>;
  listInGmCampaigns(gmUserId: string): Promise<CharacterRecord[]>;
  listByOwner(ownerId: string): Promise<CharacterRecord[]>;
  updateVersioned(input: VersionedCharacterRecordInput): Promise<CharacterRecord | null>;
}

function mapCharacterRecord(character: {
  build: unknown;
  createdAt: Date;
  id: string;
  level: number;
  name: string;
  owner?: {
    displayName: string | null;
    email: string;
    id: string;
  } | null;
  ownerId: string | null;
  currentRetainedRevision?: {
    effectiveSkillsJson: unknown;
    id: string;
    sequence: number;
    versionEnvelopeJson: unknown;
  } | null;
  updatedAt: Date;
}): CharacterRecord {
  const retainedEnvelope = character.currentRetainedRevision?.versionEnvelopeJson as
    | {
        contentRelease?: { digest?: string; id?: string };
        skillRules?: { id?: string };
      }
    | undefined;
  const retainedSkills = character.currentRetainedRevision?.effectiveSkillsJson as
    | { calculationDigest?: string }
    | undefined;
  return {
    build: characterBuildSchema.parse(character.build),
    createdAt: character.createdAt.toISOString(),
    id: character.id,
    level: character.level,
    name: character.name,
    owner: character.owner
      ? {
          displayName: character.owner.displayName,
          email: character.owner.email,
          id: character.owner.id,
        }
      : null,
    ownerId: character.ownerId,
    retainedRevision:
      character.currentRetainedRevision &&
      retainedEnvelope?.contentRelease?.digest &&
      retainedEnvelope.contentRelease.id &&
      retainedEnvelope.skillRules?.id &&
      retainedSkills?.calculationDigest
        ? {
            characterId: character.id,
            characterRevisionId: character.currentRetainedRevision.id,
            characterRevisionSequence: character.currentRetainedRevision.sequence,
            contentDigest: retainedEnvelope.contentRelease.digest,
            contentReleaseId: retainedEnvelope.contentRelease.id,
            readModelDigest: retainedSkills.calculationDigest,
            rulesVersion: retainedEnvelope.skillRules.id,
            snapshotContractVersion: "character-revision-snapshot/v1",
          }
        : null,
    updatedAt: character.updatedAt.toISOString(),
  };
}

export function createPrismaCharacterRepository(client?: PrismaClient): CharacterRepository {
  const prisma = client ?? defaultPrisma;

  async function findById(id: string): Promise<CharacterRecord | null> {
    const character = await prisma.character.findUnique({
      include: {
        currentRetainedRevision: {
          select: {
            effectiveSkillsJson: true,
            id: true,
            sequence: true,
            versionEnvelopeJson: true,
          },
        },
        owner: {
          select: {
            displayName: true,
            email: true,
            id: true,
          },
        },
      },
      where: {
        id,
      },
    });

    return character ? mapCharacterRecord(character) : null;
  }

  return {
    async createOwned(input) {
      const character = await prisma.character.create({
        data: {
          build: input.build,
          id: input.id,
          level: input.level ?? 1,
          name: input.name,
          ownerId: input.ownerId ?? null,
        },
      });

      return mapCharacterRecord(character);
    },
    async deleteVersioned(id, expectedUpdatedAt) {
      return prisma.$transaction(async (transaction) => {
        const result = await transaction.character.deleteMany({
          where: {
            id,
            updatedAt: new Date(expectedUpdatedAt),
          },
        });

        if (result.count !== 1) {
          return false;
        }

        await transaction.campaignRosterEntry.deleteMany({
          where: {
            sourceId: id,
            sourceType: "character",
          },
        });

        return true;
      });
    },
    findById,
    async findInGmCampaigns(gmUserId, id) {
      const entry = await prisma.campaignRosterEntry.findFirst({
        where: {
          sourceType: "character",
          sourceId: id,
          campaign: { gmUserId },
        },
      });

      if (!entry) return null;

      const character = await prisma.character.findUnique({
        include: {
          currentRetainedRevision: {
            select: {
              effectiveSkillsJson: true,
              id: true,
              sequence: true,
              versionEnvelopeJson: true,
            },
          },
          owner: {
            select: {
              displayName: true,
              email: true,
              id: true,
            },
          },
        },
        where: { id },
      });

      return character ? mapCharacterRecord(character) : null;
    },
    async findOwnedById(ownerId, id) {
      const character = await prisma.character.findFirst({
        include: {
          currentRetainedRevision: {
            select: {
              effectiveSkillsJson: true,
              id: true,
              sequence: true,
              versionEnvelopeJson: true,
            },
          },
          owner: {
            select: {
              displayName: true,
              email: true,
              id: true,
            },
          },
        },
        where: {
          id,
          ownerId,
        },
      });

      return character ? mapCharacterRecord(character) : null;
    },
    async listAll() {
      const characters = await prisma.character.findMany({
        include: {
          currentRetainedRevision: {
            select: {
              effectiveSkillsJson: true,
              id: true,
              sequence: true,
              versionEnvelopeJson: true,
            },
          },
          owner: {
            select: {
              displayName: true,
              email: true,
              id: true,
            },
          },
        },
        orderBy: {
          createdAt: "desc",
        },
      });

      return characters.map(mapCharacterRecord);
    },
    async listInGmCampaigns(gmUserId) {
      const rosterEntries = await prisma.campaignRosterEntry.findMany({
        select: {
          sourceId: true,
        },
        where: {
          campaign: { gmUserId },
          sourceType: "character",
        },
      });
      const characterIds = [...new Set(rosterEntries.map((entry) => entry.sourceId))];

      if (characterIds.length === 0) {
        return [];
      }

      const characters = await prisma.character.findMany({
        include: {
          currentRetainedRevision: {
            select: {
              effectiveSkillsJson: true,
              id: true,
              sequence: true,
              versionEnvelopeJson: true,
            },
          },
          owner: {
            select: {
              displayName: true,
              email: true,
              id: true,
            },
          },
        },
        orderBy: {
          createdAt: "desc",
        },
        where: {
          id: { in: characterIds },
        },
      });

      return characters.map(mapCharacterRecord);
    },
    async listByOwner(ownerId) {
      const characters = await prisma.character.findMany({
        include: {
          currentRetainedRevision: {
            select: {
              effectiveSkillsJson: true,
              id: true,
              sequence: true,
              versionEnvelopeJson: true,
            },
          },
          owner: {
            select: {
              displayName: true,
              email: true,
              id: true,
            },
          },
        },
        orderBy: {
          createdAt: "desc",
        },
        where: {
          ownerId,
        },
      });

      return characters.map(mapCharacterRecord);
    },
    async updateVersioned(input) {
      const result = await prisma.character.updateMany({
        data: {
          build: input.build,
          level: input.level ?? 1,
          name: input.name,
          ownerId: input.ownerId ?? null,
        },
        where: {
          id: input.id,
          updatedAt: new Date(input.expectedUpdatedAt),
        },
      });

      return result.count === 1 ? findById(input.id) : null;
    },
  };
}
