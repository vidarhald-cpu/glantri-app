import { beforeEach, describe, expect, it } from "vitest";

import { createPrismaAuthRepository } from "../repositories/authRepository";
import { getTestPrismaClient, resetTestDatabase } from "../testing/testDatabase";
import { createTestUser } from "../testing/factories";
import { AuthService } from "./authService";

const prisma = getTestPrismaClient();

if (!process.env.DATABASE_URL_TEST) {
  describe.skip("AuthService integration tests (DATABASE_URL_TEST not set)", () => {});
} else {
  describe("AuthService integration", () => {
    beforeEach(async () => {
      await resetTestDatabase(prisma!);
    });

    it("registers a user and logs in with valid credentials returning a session token", async () => {
      const repository = createPrismaAuthRepository(prisma!);
      const service = new AuthService(repository);

      await service.registerLocalUser({
        displayName: "Integration User",
        email: "integration@example.com",
        password: "securepassword"
      });

      const loggedIn = await service.loginWithCredentials({
        email: "integration@example.com",
        password: "securepassword"
      });

      expect(loggedIn).not.toBeNull();
      expect(loggedIn!.email).toBe("integration@example.com");

      const { token } = await service.createSessionForUser(loggedIn!.id);

      expect(typeof token).toBe("string");
      expect(token.length).toBeGreaterThan(0);
    });

    it("returns null when logging in with a wrong password", async () => {
      const repository = createPrismaAuthRepository(prisma!);
      const service = new AuthService(repository);

      await service.registerLocalUser({
        email: "wrongpass@example.com",
        password: "correctpassword"
      });

      const result = await service.loginWithCredentials({
        email: "wrongpass@example.com",
        password: "wrongpassword"
      });

      expect(result).toBeNull();
    });

    it("getCurrentUserForToken returns the correct user for a valid token", async () => {
      const repository = createPrismaAuthRepository(prisma!);
      const service = new AuthService(repository);

      await service.registerLocalUser({
        displayName: "Token User",
        email: "tokenuser@example.com",
        password: "tokenpassword"
      });

      const loggedIn = await service.loginWithCredentials({
        email: "tokenuser@example.com",
        password: "tokenpassword"
      });

      const { token } = await service.createSessionForUser(loggedIn!.id);
      const resolvedUser = await service.getCurrentUserForToken(token);

      expect(resolvedUser).not.toBeNull();
      expect(resolvedUser!.id).toBe(loggedIn!.id);
      expect(resolvedUser!.email).toBe("tokenuser@example.com");
    });

    it("getCurrentUserForToken returns null for an invalid token", async () => {
      const repository = createPrismaAuthRepository(prisma!);
      const service = new AuthService(repository);

      const result = await service.getCurrentUserForToken("completely-invalid-token");

      expect(result).toBeNull();
    });

    it("getCurrentUserForToken returns null after logout", async () => {
      const repository = createPrismaAuthRepository(prisma!);
      const service = new AuthService(repository);

      await createTestUser(prisma!, { email: "logout@example.com", password: "logoutpass" });

      const loggedIn = await service.loginWithCredentials({
        email: "logout@example.com",
        password: "logoutpass"
      });

      const { token } = await service.createSessionForUser(loggedIn!.id);

      await service.logout(token);

      const result = await service.getCurrentUserForToken(token);

      expect(result).toBeNull();
    });

    describe("bootstrapGameMasterForUser", () => {
      it("promotes user to GM when no privileged users exist", async () => {
        const repository = createPrismaAuthRepository(prisma!);
        const service = new AuthService(repository);

        const { id } = await createTestUser(prisma!, { email: "bootstrap@example.com" });

        expect(await service.canBootstrapGameMaster()).toBe(true);

        const result = await service.bootstrapGameMasterForUser(id);

        expect(result).not.toBeNull();
        expect(result!.roles).toContain("game_master");
        expect(await service.canBootstrapGameMaster()).toBe(false);
      });

      it("returns null and makes no change when a privileged user already exists", async () => {
        const repository = createPrismaAuthRepository(prisma!);
        const service = new AuthService(repository);

        const existing = await createTestUser(prisma!, {
          email: "existing-gm@example.com",
          roles: ["game_master"]
        });
        const newcomer = await createTestUser(prisma!, { email: "newcomer@example.com" });

        const result = await service.bootstrapGameMasterForUser(newcomer.id);

        expect(result).toBeNull();

        const newcomerUser = await repository.findUserById(newcomer.id);
        expect(newcomerUser!.roles).not.toContain("game_master");

        const existingUser = await repository.findUserById(existing.id);
        expect(existingUser!.roles).toContain("game_master");
      });

      it("returns null for a non-existent user id", async () => {
        const repository = createPrismaAuthRepository(prisma!);
        const service = new AuthService(repository);

        const result = await service.bootstrapGameMasterForUser("non-existent-id");

        expect(result).toBeNull();
      });
    });
  });
}
