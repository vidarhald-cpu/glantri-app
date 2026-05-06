import { characterBuildSchema, type CharacterBuild } from "@glantri/domain";

import { prisma } from "../client";

export interface CharacterRecord {
  build: CharacterBuild;
  createdAt: string;
  id: string;
  name: string;
  level: number;
  owner?:
    | {
        displayName?: string | null;
        email: string;
        id: string;
      }
    | null;
  ownerId?: string | null;
  updatedAt: string;
}

export interface CreateCharacterRecordInput {
  build: CharacterBuild;
  id: string;
  level?: number;
  name: string;
  ownerId?: string | null;
}

export interface CharacterRepository {
  findById(id: string): Promise<CharacterRecord | null>;
  findOwnedById(ownerId: string, id: string): Promise<CharacterRecord | null>;
  listAll(): Promise<CharacterRecord[]>;
  saveOwned(input: CreateCharacterRecordInput): Promise<CharacterRecord>;
  listByOwner(ownerId: string): Promise<CharacterRecord[]>;
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
  updatedAt: Date;
}): CharacterRecord {
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
          id: character.owner.id
        }
      : null,
    ownerId: character.ownerId,
    updatedAt: character.updatedAt.toISOString()
  };
}

export function createPrismaCharacterRepository(): CharacterRepository {
  return {
    async findById(id) {
      const character = await prisma.character.findUnique({
        include: {
          owner: {
            select: {
              displayName: true,
              email: true,
              id: true
            }
          }
        },
        where: {
          id
        }
      });

      return character ? mapCharacterRecord(character) : null;
    },
    async findOwnedById(ownerId, id) {
      const character = await prisma.character.findFirst({
        include: {
          owner: {
            select: {
              displayName: true,
              email: true,
              id: true
            }
          }
        },
        where: {
          id,
          ownerId
        }
      });

      return character ? mapCharacterRecord(character) : null;
    },
    async listAll() {
      const characters = await prisma.character.findMany({
        include: {
          owner: {
            select: {
              displayName: true,
              email: true,
              id: true
            }
          }
        },
        orderBy: {
          createdAt: "desc"
        }
      });

      return characters.map(mapCharacterRecord);
    },
    async saveOwned(input) {
      const existing = await prisma.character.findUnique({
        where: {
          id: input.id
        }
      });

      if (existing && existing.ownerId !== input.ownerId) {
        throw new Error("Character ownership mismatch.");
      }

      const character = existing
        ? await prisma.character.update({
            data: {
              build: input.build,
              level: input.level ?? 1,
              name: input.name,
              ownerId: input.ownerId ?? null
            },
            where: {
              id: input.id
            }
          })
        : await prisma.character.create({
            data: {
              build: input.build,
              id: input.id,
              level: input.level ?? 1,
              name: input.name,
              ownerId: input.ownerId ?? null
            }
          });

      return mapCharacterRecord(character);
    },
    async listByOwner(ownerId) {
      const characters = await prisma.character.findMany({
        include: {
          owner: {
            select: {
              displayName: true,
              email: true,
              id: true
            }
          }
        },
        orderBy: {
          createdAt: "desc"
        },
        where: {
          ownerId
        }
      });

      return characters.map(mapCharacterRecord);
    }
  };
}
