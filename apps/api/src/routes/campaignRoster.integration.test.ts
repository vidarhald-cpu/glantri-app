import type { FastifyInstance } from "fastify";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { AuthService, prisma } from "@glantri/database";
import {
  createTestCampaign,
  createTestCharacter,
  createTestUser,
  resetTestDatabase,
} from "@glantri/database/testing";

import { buildApiServer } from "../app";
import { SESSION_COOKIE_NAME } from "../lib/sessionAuth";

const hasTaskApplicationDatabase =
  process.env.GLANTRI_DB_MODE === "task" && Boolean(process.env.DATABASE_URL);

async function sessionCookie(userId: string): Promise<string> {
  const { token } = await new AuthService().createSessionForUser(userId);
  return `${SESSION_COOKIE_NAME}=${token}`;
}

if (!hasTaskApplicationDatabase) {
  describe.skip("Campaign roster API integration (task database not configured)", () => {});
} else {
  describe("Campaign roster API integration", () => {
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

    it("returns two equivalent successes and persists one row for simultaneous adds", async () => {
      const gm = await createTestUser(prisma, {
        email: "concurrent-gm@example.test",
        roles: ["game_master"],
      });
      const player = await createTestUser(prisma, {
        displayName: "Player One",
        email: "concurrent-player@example.test",
      });
      const campaign = await createTestCampaign(prisma, gm.id, { status: "active" });
      const character = await createTestCharacter(prisma, player.id, {
        name: "Concurrent Hero",
      });
      const cookie = await sessionCookie(gm.id);
      const request = {
        headers: { cookie },
        method: "POST" as const,
        payload: {
          category: "pc",
          sourceId: character.id,
          sourceType: "character",
        },
        url: `/campaigns/${campaign.id}/roster`,
      };

      const [first, second] = await Promise.all([app.inject(request), app.inject(request)]);

      expect(first.statusCode, first.body).toBe(200);
      expect(second.statusCode, second.body).toBe(200);
      expect(second.json()).toEqual(first.json());
      await expect(
        prisma.campaignRosterEntry.findMany({
          where: {
            campaignId: campaign.id,
            sourceId: character.id,
            sourceType: "character",
          },
        }),
      ).resolves.toHaveLength(1);
    });
  });
}
