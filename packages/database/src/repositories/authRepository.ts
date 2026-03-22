import type { AuthRole, AuthSession, AuthUser } from "@glantri/auth";

import { prisma } from "../client";

export interface CreateUserInput {
  displayName?: string;
  email: string;
  passwordHash: string;
}

export interface CreateSessionInput {
  expiresAt: string;
  tokenHash: string;
  userId: string;
}

export interface AuthRepository {
  createSession(input: CreateSessionInput): Promise<AuthSession>;
  createUser(input: CreateUserInput): Promise<AuthUser>;
  deleteSessionByTokenHash(tokenHash: string): Promise<void>;
  findSessionByTokenHash(tokenHash: string): Promise<AuthSession | null>;
  findUserById(id: string): Promise<AuthUser | null>;
  findUserByEmail(email: string): Promise<AuthUser | null>;
  findUserCredentialByEmail(
    email: string
  ): Promise<{ passwordHash: string; user: AuthUser } | null>;
}

function mapRoles(roles: Array<{ role: { name: string } }>): AuthRole[] {
  return roles
    .map((item) => item.role.name)
    .filter((role): role is AuthRole => role === "player" || role === "game_master" || role === "admin");
}

export function createPrismaAuthRepository(): AuthRepository {
  return {
    async createSession(input) {
      const session = await prisma.session.create({
        data: {
          expiresAt: new Date(input.expiresAt),
          tokenHash: input.tokenHash,
          userId: input.userId
        }
      });

      return {
        expiresAt: session.expiresAt.toISOString(),
        id: session.id,
        tokenHash: session.tokenHash,
        userId: session.userId
      };
    },
    async createUser(input) {
      const playerRole = await prisma.role.upsert({
        create: {
          name: "player"
        },
        update: {},
        where: {
          name: "player"
        }
      });

      const user = await prisma.user.create({
        data: {
          displayName: input.displayName,
          email: input.email,
          passwordHash: input.passwordHash,
          roles: {
            create: {
              roleId: playerRole.id
            }
          }
        },
        include: {
          roles: {
            include: {
              role: true
            }
          }
        }
      });

      return {
        displayName: user.displayName ?? undefined,
        email: user.email,
        id: user.id,
        roles: mapRoles(user.roles)
      };
    },
    async deleteSessionByTokenHash(tokenHash) {
      await prisma.session.deleteMany({
        where: {
          tokenHash
        }
      });
    },
    async findSessionByTokenHash(tokenHash) {
      const session = await prisma.session.findFirst({
        where: {
          expiresAt: {
            gt: new Date()
          },
          tokenHash
        }
      });

      if (!session) {
        return null;
      }

      return {
        expiresAt: session.expiresAt.toISOString(),
        id: session.id,
        tokenHash: session.tokenHash,
        userId: session.userId
      };
    },
    async findUserById(id) {
      const user = await prisma.user.findUnique({
        include: {
          roles: {
            include: {
              role: true
            }
          }
        },
        where: {
          id
        }
      });

      if (!user) {
        return null;
      }

      return {
        displayName: user.displayName ?? undefined,
        email: user.email,
        id: user.id,
        roles: mapRoles(user.roles)
      };
    },
    async findUserByEmail(email) {
      const user = await prisma.user.findUnique({
        include: {
          roles: {
            include: {
              role: true
            }
          }
        },
        where: {
          email
        }
      });

      if (!user) {
        return null;
      }

      return {
        displayName: user.displayName ?? undefined,
        email: user.email,
        id: user.id,
        roles: mapRoles(user.roles)
      };
    },
    async findUserCredentialByEmail(email) {
      const user = await prisma.user.findUnique({
        include: {
          roles: {
            include: {
              role: true
            }
          }
        },
        where: {
          email
        }
      });

      if (!user) {
        return null;
      }

      return {
        passwordHash: user.passwordHash,
        user: {
          displayName: user.displayName ?? undefined,
          email: user.email,
          id: user.id,
          roles: mapRoles(user.roles)
        }
      };
    }
  };
}
