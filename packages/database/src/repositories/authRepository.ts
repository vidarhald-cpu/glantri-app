import type { AuthRole, AuthSession, AuthUser } from "@glantri/auth";
import { Prisma, type PrismaClient } from "@prisma/client";

import { prisma as defaultPrisma } from "../client";

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
  anyPrivilegedUserExists(): Promise<boolean>;
  atomicBootstrapGameMaster(userId: string): Promise<AuthUser | null>;
  createSession(input: CreateSessionInput): Promise<AuthSession>;
  createUser(input: CreateUserInput): Promise<AuthUser>;
  deleteSessionByTokenHash(tokenHash: string): Promise<void>;
  findSessionByTokenHash(tokenHash: string): Promise<AuthSession | null>;
  findUserById(id: string): Promise<AuthUser | null>;
  findUserByEmail(email: string): Promise<AuthUser | null>;
  listUsers(): Promise<AuthUser[]>;
  replaceUserRoles(userId: string, roles: AuthRole[]): Promise<AuthUser | null>;
  findUserCredentialByEmail(
    email: string
  ): Promise<{ passwordHash: string; user: AuthUser } | null>;
}

export function normalizeStoredAuthRole(roleName: string): AuthRole | null {
  if (roleName === "gm") {
    return "game_master";
  }

  if (roleName === "player" || roleName === "game_master" || roleName === "admin") {
    return roleName;
  }

  return null;
}

function getStoredPrivilegedRoleNames(): string[] {
  return ["admin", "game_master", "gm"];
}

function mapRoles(roles: Array<{ role: { name: string } }>): AuthRole[] {
  return roles
    .map((item) => normalizeStoredAuthRole(item.role.name))
    .filter((role): role is AuthRole => role !== null);
}

export function createPrismaAuthRepository(client?: PrismaClient): AuthRepository {
  const prisma = client ?? defaultPrisma;

  return {
    async anyPrivilegedUserExists() {
      const privilegedUserCount = await prisma.user.count({
        where: {
          roles: {
            some: {
              role: {
                name: {
                  in: getStoredPrivilegedRoleNames()
                }
              }
            }
          }
        }
      });

      return privilegedUserCount > 0;
    },
    async atomicBootstrapGameMaster(userId) {
      try {
        return await prisma.$transaction(async (tx) => {
          const count = await tx.user.count({
            where: {
              roles: {
                some: {
                  role: {
                    name: {
                      in: getStoredPrivilegedRoleNames()
                    }
                  }
                }
              }
            }
          });

          if (count > 0) {
            return null;
          }

          const targetUser = await tx.user.findUnique({
            select: { id: true },
            where: { id: userId }
          });

          if (!targetUser) {
            return null;
          }

          const gmRole = await tx.role.upsert({
            create: { name: "game_master" },
            update: {},
            where: { name: "game_master" }
          });

          await tx.userRole.deleteMany({ where: { userId } });
          await tx.userRole.create({ data: { roleId: gmRole.id, userId } });

          const user = await tx.user.findUnique({
            include: { roles: { include: { role: true } } },
            where: { id: userId }
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
        }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
      } catch {
        return null;
      }
    },
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
    async listUsers() {
      const users = await prisma.user.findMany({
        include: {
          roles: {
            include: {
              role: true
            }
          }
        },
        orderBy: {
          email: "asc"
        }
      });

      return users.map((user) => ({
        displayName: user.displayName ?? undefined,
        email: user.email,
        id: user.id,
        roles: mapRoles(user.roles)
      }));
    },
    async replaceUserRoles(userId, roles) {
      const normalizedRoles = [...new Set(roles)];
      const roleRecords = await Promise.all(
        normalizedRoles.map((roleName) =>
          prisma.role.upsert({
            create: {
              name: roleName
            },
            update: {},
            where: {
              name: roleName
            }
          }),
        ),
      );

      const user = await prisma.user.update({
        data: {
          roles: {
            deleteMany: {},
            create: roleRecords.map((role) => ({
              roleId: role.id
            }))
          }
        },
        include: {
          roles: {
            include: {
              role: true
            }
          }
        },
        where: {
          id: userId
        }
      }).catch(() => null);

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
