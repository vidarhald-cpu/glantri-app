import type { FastifyInstance } from "fastify";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { AuthService, prisma } from "@glantri/database";
import { createTestUser, resetTestDatabase } from "@glantri/database/testing";

import { buildApiServer } from "../app";
import { SESSION_COOKIE_NAME } from "../lib/sessionAuth";

// Forgejo #1089: the one-time first-GM bootstrap claim also grants admin (an explicit Alpha
// bootstrap simplification). Nothing else grants admin.

const hasTaskApplicationDatabase =
  process.env.GLANTRI_DB_MODE === "task" && Boolean(process.env.DATABASE_URL);

async function sessionCookie(userId: string): Promise<string> {
  const { token } = await new AuthService().createSessionForUser(userId);
  return `${SESSION_COOKIE_NAME}=${token}`;
}

async function storedRoles(userId: string): Promise<string[]> {
  const rows = await prisma.userRole.findMany({
    include: { role: true },
    where: { userId },
  });
  return rows.map((row) => row.role.name).sort();
}

if (!hasTaskApplicationDatabase) {
  describe.skip("Bootstrap GM claim API integration (task database not configured)", () => {});
} else {
  describe("Bootstrap GM claim API integration", () => {
    let app: FastifyInstance;

    beforeEach(async () => {
      await resetTestDatabase(prisma);
      app = buildApiServer();
      await app.ready();
    });

    afterEach(async () => {
      await app.close();
      await resetTestDatabase(prisma);
    });

    it("grants game_master and admin to the claimant, replacing player", async () => {
      const claimant = await createTestUser(prisma, { email: "claimant@example.test" });
      const cookie = await sessionCookie(claimant.id);

      const response = await app.inject({
        headers: { cookie },
        method: "POST",
        url: "/auth/bootstrap-gm",
      });

      expect(response.statusCode, response.body).toBe(200);
      expect([...response.json().user.roles].sort()).toEqual(["admin", "game_master"]);
      expect(await storedRoles(claimant.id)).toEqual(["admin", "game_master"]);
    });

    it("refuses a second claim, and an admin-appointed GM is not an admin", async () => {
      const first = await createTestUser(prisma, { email: "first@example.test" });
      const second = await createTestUser(prisma, { email: "second@example.test" });
      const firstCookie = await sessionCookie(first.id);
      const secondCookie = await sessionCookie(second.id);

      const claim = await app.inject({
        headers: { cookie: firstCookie },
        method: "POST",
        url: "/auth/bootstrap-gm",
      });
      expect(claim.statusCode, claim.body).toBe(200);

      const refused = await app.inject({
        headers: { cookie: secondCookie },
        method: "POST",
        url: "/auth/bootstrap-gm",
      });
      expect(refused.statusCode).toBe(403);
      expect(await storedRoles(second.id)).toEqual(["player"]);

      const appoint = await app.inject({
        headers: { cookie: firstCookie },
        method: "POST",
        payload: { role: "game_master" },
        url: `/auth/users/${second.id}/role`,
      });
      expect(appoint.statusCode, appoint.body).toBe(200);
      expect(await storedRoles(second.id)).toEqual(["game_master"]);

      // A GM who is not an admin still cannot assign roles.
      const denied = await app.inject({
        headers: { cookie: secondCookie },
        method: "POST",
        payload: { role: "game_master" },
        url: `/auth/users/${first.id}/role`,
      });
      expect(denied.statusCode).toBe(403);
    });

    it("yields exactly one privileged user for simultaneous claims", async () => {
      const users = await Promise.all(
        [1, 2, 3, 4].map((n) => createTestUser(prisma, { email: `racer-${n}@example.test` })),
      );
      const cookies = await Promise.all(users.map((user) => sessionCookie(user.id)));

      const responses = await Promise.all(
        cookies.map((cookie) =>
          app.inject({ headers: { cookie }, method: "POST", url: "/auth/bootstrap-gm" }),
        ),
      );

      expect(responses.filter((r) => r.statusCode === 200)).toHaveLength(1);
      expect(responses.filter((r) => r.statusCode === 403)).toHaveLength(3);

      const privileged = await prisma.user.count({
        where: { roles: { some: { role: { name: { in: ["admin", "game_master"] } } } } },
      });
      expect(privileged).toBe(1);
    });
  });
}
