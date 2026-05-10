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
  });
}
