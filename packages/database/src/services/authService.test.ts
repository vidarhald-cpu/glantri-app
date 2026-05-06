import { describe, expect, it } from "vitest";

import type { AuthRepository } from "../repositories/authRepository";
import { AuthService } from "./authService";

function createRepositoryStub(options?: {
  anyPrivilegedUserExists?: boolean;
  replacedUser?: {
    displayName?: string;
    email: string;
    id: string;
    roles: Array<"admin" | "game_master" | "player">;
  } | null;
}) {
  const calls = {
    replaceUserRoles: [] as Array<{ roles: Array<"admin" | "game_master" | "player">; userId: string }>,
  };

  const repository: AuthRepository = {
    anyPrivilegedUserExists: async () => options?.anyPrivilegedUserExists ?? false,
    createSession: async () => {
      throw new Error("not implemented");
    },
    createUser: async () => {
      throw new Error("not implemented");
    },
    deleteSessionByTokenHash: async () => {
      throw new Error("not implemented");
    },
    findSessionByTokenHash: async () => {
      throw new Error("not implemented");
    },
    findUserByEmail: async () => {
      throw new Error("not implemented");
    },
    findUserById: async () => {
      throw new Error("not implemented");
    },
    findUserCredentialByEmail: async () => {
      throw new Error("not implemented");
    },
    listUsers: async () => {
      throw new Error("not implemented");
    },
    replaceUserRoles: async (userId, roles) => {
      calls.replaceUserRoles.push({ roles, userId });
      return options?.replacedUser ?? {
        id: userId,
        email: "gm@example.com",
        roles: ["game_master"],
      };
    },
  };

  return { calls, repository };
}

describe("AuthService bootstrap GM", () => {
  it("allows bootstrap only while no admin or GM exists", async () => {
    const bootstrapOpen = new AuthService(createRepositoryStub().repository);
    const bootstrapClosed = new AuthService(
      createRepositoryStub({ anyPrivilegedUserExists: true }).repository,
    );

    await expect(bootstrapOpen.canBootstrapGameMaster()).resolves.toBe(true);
    await expect(bootstrapClosed.canBootstrapGameMaster()).resolves.toBe(false);
  });

  it("promotes the current user to game_master during bootstrap", async () => {
    const { calls, repository } = createRepositoryStub();
    const service = new AuthService(repository);

    const user = await service.bootstrapGameMasterForUser("user-1");

    expect(calls.replaceUserRoles).toEqual([{ roles: ["game_master"], userId: "user-1" }]);
    expect(user).toMatchObject({
      id: "user-1",
      roles: ["game_master"],
    });
  });

  it("blocks bootstrap once a privileged user already exists", async () => {
    const { calls, repository } = createRepositoryStub({ anyPrivilegedUserExists: true });
    const service = new AuthService(repository);

    await expect(service.bootstrapGameMasterForUser("user-1")).resolves.toBeNull();
    expect(calls.replaceUserRoles).toEqual([]);
  });
});
