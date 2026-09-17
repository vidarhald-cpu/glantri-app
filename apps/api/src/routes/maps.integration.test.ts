import type { FastifyInstance } from "fastify";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { AuthService, CampaignMapService, prisma } from "@glantri/database";
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
  describe.skip("Map API integration (task database not configured)", () => {});
} else {
  describe("Map API integration", () => {
    let app: FastifyInstance;

    beforeEach(async () => {
      await resetTestDatabase(prisma);
      vi.stubEnv("WEB_ORIGIN", "http://localhost:3350");
      vi.stubEnv("LOG_LEVEL", "silent");
      app = buildApiServer();
      await app.ready();
    });

    afterEach(async () => {
      await app.close();
      await resetTestDatabase(prisma);
      vi.unstubAllEnvs();
    });

    it("separates GM authoring from player-safe consumption across all relationship perspectives", async () => {
      const gm = await createTestUser(prisma, { roles: ["game_master"] });
      const player = await createTestUser(prisma);
      const secondPlayer = await createTestUser(prisma);
      const foreignGm = await createTestUser(prisma, { roles: ["game_master"] });
      const unrelatedAdmin = await createTestUser(prisma, { roles: ["admin"] });
      const campaign = await createTestCampaign(prisma, gm.id, { status: "active" });
      for (const owner of [player, secondPlayer]) {
        const character = await createTestCharacter(prisma, owner.id);
        await prisma.campaignRosterEntry.create({
          data: {
            campaignId: campaign.id,
            category: "pc",
            labelSnapshot: character.name,
            sourceId: character.id,
            sourceType: "character",
          },
        });
      }
      const entity = await prisma.reusableEntity.create({
        data: {
          gmUserId: gm.id,
          kind: "npc",
          name: "The Hidden Captain",
          notes: "GM-only operational notes",
        },
      });
      const maps = new CampaignMapService();
      const created = await maps.create({
        actorUserId: gm.id,
        campaignId: campaign.id,
        payload: { access: "players", name: "Shared Border" },
      });
      const shared = await maps.replaceAggregate({
        actorUserId: gm.id,
        campaignId: campaign.id,
        mapId: created.id,
        payload: {
          access: "players",
          backgroundArtifactId: null,
          description: "The road west",
          expectedVersion: created.version,
          layers: [
            {
              id: "public-layer",
              markers: [
                {
                  description: "Visible Map-facing description",
                  destinationMapId: null,
                  entityLabelSnapshot: entity.name,
                  entityReferenceId: entity.id,
                  entityReferenceType: "reusable_entity",
                  id: "npc-marker",
                  kind: "entity_reference",
                  label: "The Watcher",
                  presentation: "W",
                  sortOrder: 0,
                  visibility: "inherit",
                  x: 0.2,
                  y: 0.3,
                },
                {
                  description: "",
                  destinationMapId: null,
                  entityLabelSnapshot: null,
                  entityReferenceId: null,
                  entityReferenceType: null,
                  id: "private-marker",
                  kind: "annotation",
                  label: "Hidden camp",
                  presentation: "pin",
                  sortOrder: 1,
                  visibility: "gm_only",
                  x: 0.5,
                  y: 0.5,
                },
              ],
              name: "Known places",
              sortOrder: 0,
              visibility: "player_visible",
            },
            {
              id: "secret-layer",
              markers: [
                {
                  description: "Revealed without its secret Layer",
                  destinationMapId: null,
                  entityLabelSnapshot: null,
                  entityReferenceId: null,
                  entityReferenceType: null,
                  id: "exception-marker",
                  kind: "annotation",
                  label: "Old ruin",
                  presentation: "R",
                  sortOrder: 0,
                  visibility: "player_visible",
                  x: 0.7,
                  y: 0.8,
                },
              ],
              name: "GM Secrets",
              sortOrder: 1,
              visibility: "gm_only",
            },
          ],
          name: "Shared Border",
          role: "area",
        },
      });

      const cookies = Object.fromEntries(
        await Promise.all(
          [gm, player, secondPlayer, foreignGm, unrelatedAdmin].map(async (user) => [
            user.id,
            await sessionCookie(user.id),
          ]),
        ),
      );
      const url = `/campaigns/${campaign.id}/maps/${created.id}`;
      const gmRead = await app.inject({ headers: { cookie: cookies[gm.id] }, method: "GET", url });
      expect(gmRead.statusCode, gmRead.body).toBe(200);
      expect(gmRead.json().mode).toBe("gm");
      expect(gmRead.body).toContain(entity.id);

      for (const entitled of [player, secondPlayer]) {
        const response = await app.inject({
          headers: { cookie: cookies[entitled.id] },
          method: "GET",
          url,
        });
        expect(response.statusCode, response.body).toBe(200);
        expect(response.json()).toMatchObject({
          map: {
            layers: [{ markers: [{ label: "The Watcher" }], name: "Known places" }],
            revealedMarkers: [{ label: "Old ruin" }],
          },
          mode: "player",
        });
        expect(response.body).not.toContain(entity.id);
        expect(response.body).not.toContain(entity.name);
        expect(response.body).not.toContain("GM-only operational notes");
        expect(response.body).not.toContain("GM Secrets");
        expect(response.body).not.toContain("Hidden camp");
      }

      for (const cookie of [cookies[foreignGm.id], cookies[unrelatedAdmin.id], undefined]) {
        const response = await app.inject({
          headers: cookie ? { cookie } : {},
          method: "GET",
          url,
        });
        expect(response.statusCode, response.body).toBe(404);
        expect(response.body).toBe(JSON.stringify({ error: "Map not found." }));
      }

      const mutation = {
        access: "gm_only",
        backgroundArtifactId: null,
        description: "Unauthorized overwrite",
        expectedVersion: shared.version,
        layers: [],
        name: "Overwritten",
        role: "area",
      };
      for (const cookie of [
        cookies[player.id],
        cookies[foreignGm.id],
        cookies[unrelatedAdmin.id],
        undefined,
      ]) {
        const response = await app.inject({
          headers: {
            ...(cookie ? { cookie } : {}),
            origin: "http://localhost:3350",
            "x-glantri-map-mutation": "1",
          },
          method: "PUT",
          payload: mutation,
          url,
        });
        expect([401, 403, 404]).toContain(response.statusCode);
      }
      expect(await prisma.campaignMap.findUnique({ where: { id: created.id } })).toMatchObject({
        name: "Shared Border",
        version: shared.version,
      });

      await prisma.campaignRosterEntry.updateMany({
        data: { membershipState: "former" },
        where: {
          campaignId: campaign.id,
          sourceId: (await prisma.character.findFirstOrThrow({ where: { ownerId: player.id } })).id,
        },
      });
      const afterLoss = await app.inject({
        headers: { cookie: cookies[player.id] },
        method: "GET",
        url,
      });
      expect(afterLoss.statusCode).toBe(404);
      expect(afterLoss.body).not.toContain("The Watcher");
    });
  });
}
