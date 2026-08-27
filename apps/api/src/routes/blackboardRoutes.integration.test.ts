import type { FastifyInstance } from "fastify";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

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
const origin = "http://localhost:3360";

async function sessionCookie(userId: string): Promise<string> {
  const { token } = await new AuthService().createSessionForUser(userId);
  return `${SESSION_COOKIE_NAME}=${token}`;
}

function mutationHeaders(cookie: string) {
  return { cookie, origin, "x-glantri-blackboard-mutation": "1" };
}

if (!hasTaskApplicationDatabase) {
  describe.skip("Blackboard API integration (task database not configured)", () => {});
} else {
  describe("Blackboard API integration", () => {
    let app: FastifyInstance;

    beforeEach(async () => {
      await resetTestDatabase(prisma);
      vi.stubEnv("WEB_ORIGIN", origin);
      vi.stubEnv("LOG_LEVEL", "silent");
      app = buildApiServer();
      await app.ready();
    });

    afterEach(async () => {
      await app.close();
      await resetTestDatabase(prisma);
      vi.unstubAllEnvs();
    });

    it("keeps common GM/player bytes identical and restricted detail behind explicit operations", async () => {
      const gm = await createTestUser(prisma, {
        displayName: "API GM",
        roles: ["game_master"],
      });
      const player = await createTestUser(prisma, { displayName: "API Player" });
      const campaign = await createTestCampaign(prisma, gm.id, { status: "active" });
      const character = await createTestCharacter(prisma, player.id, { name: "Ari" });
      await prisma.campaignRosterEntry.create({
        data: {
          campaignId: campaign.id,
          category: "pc",
          sourceId: character.id,
          sourceType: "character",
        },
      });
      const gmCookie = await sessionCookie(gm.id);
      const playerCookie = await sessionCookie(player.id);

      const create = await app.inject({
        headers: mutationHeaders(gmCookie),
        method: "POST",
        payload: {
          category: "document_text",
          documentText: "Public letter",
          restrictedDetails: [{ detailText: "Hidden ink", sortOrder: 0 }],
          title: "Letter",
        },
        url: `/campaigns/${campaign.id}/blackboard/entries`,
      });
      expect(create.statusCode, create.body).toBe(201);
      const entryId = create.json<{ entry: { id: string } }>().entry.id;

      const [gmBoard, playerBoard] = await Promise.all([
        app.inject({
          headers: { cookie: gmCookie },
          method: "GET",
          url: `/campaigns/${campaign.id}/blackboard`,
        }),
        app.inject({
          headers: { cookie: playerCookie },
          method: "GET",
          url: `/campaigns/${campaign.id}/blackboard`,
        }),
      ]);
      expect(gmBoard.statusCode).toBe(200);
      expect(gmBoard.body).toBe(playerBoard.body);
      expect(gmBoard.body).not.toMatch(/Hidden ink|unitKey|grant|audit/i);

      const audit = await app.inject({
        headers: { cookie: gmCookie },
        method: "GET",
        url: `/campaigns/${campaign.id}/blackboard/entries/${entryId}/audit`,
      });
      const unit = audit.json<{ unitVersions: Array<{ unitKey: string; unitVersion: number }> }>()
        .unitVersions[0]!;
      const playerAudit = await app.inject({
        headers: { cookie: playerCookie },
        method: "GET",
        url: `/campaigns/${campaign.id}/blackboard/entries/${entryId}/audit`,
      });
      expect(playerAudit.statusCode).toBe(404);
      expect(playerAudit.json()).toEqual({ error: "Blackboard reference unavailable." });

      const grant = await app.inject({
        headers: mutationHeaders(gmCookie),
        method: "POST",
        payload: {
          action: "grant",
          expectedEntryVersion: 1,
          expectedGrantVersion: 0,
          unitVersion: unit.unitVersion,
        },
        url: `/campaigns/${campaign.id}/blackboard/entries/${entryId}/detail-grants/${character.id}/${unit.unitKey}`,
      });
      expect(grant.statusCode, grant.body).toBe(200);
      const boardAfterGrant = await app.inject({
        headers: { cookie: gmCookie },
        method: "GET",
        url: `/campaigns/${campaign.id}/blackboard`,
      });
      expect(boardAfterGrant.body).toBe(gmBoard.body);

      const expanded = await app.inject({
        headers: { cookie: playerCookie },
        method: "GET",
        url: `/campaigns/${campaign.id}/blackboard/entries/${entryId}?viewerCharacterId=${character.id}`,
      });
      expect(expanded.statusCode, expanded.body).toBe(200);
      expect(expanded.json()).toMatchObject({
        restrictedDetails: [{ detailText: "Hidden ink" }],
      });
      const commonOnly = await app.inject({
        headers: { cookie: playerCookie },
        method: "GET",
        url: `/campaigns/${campaign.id}/blackboard/entries/${entryId}`,
      });
      expect(commonOnly.body).not.toContain("Hidden ink");
    });

    it("uses strict, privacy-equivalent failures and filters blank-alt Artifact candidates", async () => {
      const gm = await createTestUser(prisma, { roles: ["game_master"] });
      const player = await createTestUser(prisma);
      const foreign = await createTestUser(prisma);
      const campaign = await createTestCampaign(prisma, gm.id, { status: "active" });
      const character = await createTestCharacter(prisma, player.id);
      await prisma.campaignRosterEntry.create({
        data: {
          campaignId: campaign.id,
          category: "pc",
          sourceId: character.id,
          sourceType: "character",
        },
      });
      const gmCookie = await sessionCookie(gm.id);
      const playerCookie = await sessionCookie(player.id);
      const foreignCookie = await sessionCookie(foreign.id);
      const created = await app.inject({
        headers: mutationHeaders(playerCookie),
        method: "POST",
        payload: { category: "clue_fact", fact: "Fact", title: "Clue" },
        url: `/campaigns/${campaign.id}/blackboard/entries`,
      });
      const entryId = created.json<{ entry: { id: string } }>().entry.id;

      const invalid = await app.inject({
        headers: mutationHeaders(playerCookie),
        method: "POST",
        payload: { category: "clue_fact", fact: "Fact", hidden: true, title: "Clue" },
        url: `/campaigns/${campaign.id}/blackboard/entries`,
      });
      expect(invalid.statusCode).toBe(400);
      expect(await prisma.campaignBlackboardEntry.count()).toBe(1);

      const missing = await app.inject({
        headers: { cookie: playerCookie },
        method: "GET",
        url: `/campaigns/${campaign.id}/blackboard/entries/missing`,
      });
      const crossCampaign = await app.inject({
        headers: { cookie: playerCookie },
        method: "GET",
        url: `/campaigns/${campaign.id}/blackboard/entries/${entryId}-foreign`,
      });
      expect(missing.statusCode).toBe(404);
      expect(crossCampaign.body).toBe(missing.body);
      const unauthorized = await app.inject({
        headers: { cookie: foreignCookie },
        method: "GET",
        url: `/campaigns/${campaign.id}/blackboard`,
      });
      const anonymous = await app.inject({
        method: "GET",
        url: `/campaigns/${campaign.id}/blackboard`,
      });
      expect(unauthorized.statusCode).toBe(404);
      expect(unauthorized.body).toBe(anonymous.body);

      for (const [index, altText] of ["   ", "Visible map"].entries()) {
        await prisma.campaignAsset.create({
          data: {
            altText,
            artifactKind: "map",
            audience: "campaign",
            campaignId: campaign.id,
            createdByUserId: gm.id,
            lifecycleState: "active",
            mediaTypeDetected: "image/png",
            storageState: "ready",
            storageUrl: `artifact-internal:${index}`,
            title: `Map ${index}`,
            type: "map",
            visibility: "visible_to_all",
          },
        });
      }
      const candidates = await app.inject({
        headers: { cookie: gmCookie },
        method: "GET",
        url: `/campaigns/${campaign.id}/artifacts/blackboard-candidates`,
      });
      expect(candidates.statusCode).toBe(200);
      expect(candidates.json<{ artifacts: unknown[] }>().artifacts).toHaveLength(1);
      expect(candidates.body).not.toMatch(/storageUrl|storageKey|originalFilename|digest/);
    });
  });
}
