import { describe, expect, it } from "vitest";

import type { AuthRepository } from "../repositories/authRepository";
import { AuthService } from "./authService";

function createRepositoryStub(options?: {
  anyPrivilegedUserExists?: boolean;
  bootstrapResult?: {
    displayName?: string;
    email: string;
    id: string;
    roles: Array<"admin" | "game_master" | "player">;
  } | null;
}) {
  const calls = {
    atomicBootstrapGameMaster: [] as string[],
  };

  const repository: AuthRepository = {
    anyPrivilegedUserExists: async () => options?.anyPrivilegedUserExists ?? false,
    atomicBootstrapGameMaster: async (userId) => {
      calls.atomicBootstrapGameMaster.push(userId);
      if (options && "bootstrapResult" in options) {
        return options.bootstrapResult ?? null;
      }
      return { id: userId, email: "gm@example.com", roles: ["game_master"] };
    },
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
    replaceUserRoles: async () => {
      throw new Error("not implemented");
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

  it("delegates bootstrap to the repository and returns the promoted user", async () => {
    const { calls, repository } = createRepositoryStub();
    const service = new AuthService(repository);

    const user = await service.bootstrapGameMasterForUser("user-1");

    expect(calls.atomicBootstrapGameMaster).toEqual(["user-1"]);
    expect(user).toMatchObject({ id: "user-1", roles: ["game_master"] });
  });

  it("returns null when the repository reports bootstrap is no longer available", async () => {
    const { calls, repository } = createRepositoryStub({ bootstrapResult: null });
    const service = new AuthService(repository);

    await expect(service.bootstrapGameMasterForUser("user-1")).resolves.toBeNull();
    expect(calls.atomicBootstrapGameMaster).toEqual(["user-1"]);
  });
});
