import type { FastifyInstance } from "fastify";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { AuthService, ScenarioService, prisma } from "@glantri/database";
import {
  createTestCampaign,
  createTestCharacter,
  createTestUser,
  resetTestDatabase,
} from "@glantri/database/testing";

import { buildApiServer } from "../../app";
import { SESSION_COOKIE_NAME } from "../../lib/sessionAuth";

/**
 * Forgejo #339 — `CampaignAsset.visibility` is not a player-access axis.
 *
 * Content authoring §18.24 settles two canonical Artifact access states, and
 * the Product Owner ruling of 2026-09-26 settles that the legacy `visibility`
 * column carries no independent V1 player-access authority and must never
 * broaden access beyond the resolved `audience`.
 *
 * The 2026-08-24 migration added `audience` with `DEFAULT 'gm_private'` and did
 * not touch `visibility`, so a pre-migration row can legitimately carry
 * `audience = 'gm_private'` with `visibility = 'visible_to_all'`. These tests
 * construct exactly that divergence and assert on **API payloads** that no
 * player-reachable projection exposes it.
 */

const hasTaskApplicationDatabase =
  process.env.GLANTRI_DB_MODE === "task" && Boolean(process.env.DATABASE_URL);
const origin = "http://localhost:3360";

async function sessionCookie(userId: string): Promise<string> {
  const { token } = await new AuthService().createSessionForUser(userId);
  return `${SESSION_COOKIE_NAME}=${token}`;
}

type SessionPayload = {
  session: {
    availableObjects: { id: string; name: string }[];
  };
};

if (!hasTaskApplicationDatabase) {
  describe.skip("Scenario available Artifact audience (task database not configured)", () => {});
} else {
  describe("Scenario available-object Artifact access is governed by audience alone", () => {
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

    async function seedLiveScenarioWithAvailableArtifact() {
      const gm = await createTestUser(prisma, { displayName: "GM", roles: ["game_master"] });
      const player = await createTestUser(prisma, { displayName: "Player" });
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

      // A well-formed post-migration row: shared with Campaign players, with the
      // legacy column in agreement. The divergence is introduced later.
      const asset = await prisma.campaignAsset.create({
        data: {
          audience: "campaign",
          campaignId: campaign.id,
          createdByUserId: gm.id,
          description: "Secret tunnels under the keep",
          storageUrl: `artifact-internal:${campaign.id}/keep-map`,
          title: "Keep map",
          type: "map",
          visibility: "visible_to_all",
        },
      });

      const scenarioService = new ScenarioService();
      const scenario = await scenarioService.createScenario({
        campaignId: campaign.id,
        name: "The keep",
        status: "live",
      });
      await scenarioService.addCharacterParticipant({
        characterId: character.id,
        controlledByUserId: player.id,
        joinSource: "gm_added",
        scenarioId: scenario.id,
      });

      const gmCookie = await sessionCookie(gm.id);
      const playerCookie = await sessionCookie(player.id);
      const availableObjects = [
        {
          addedAt: "2026-09-26T10:00:00.000Z",
          id: "available-keep-map",
          sourceId: asset.id,
          sourceKind: "campaign_asset",
          visibility: "players",
        },
      ];
      const prepared = await app.inject({
        headers: { cookie: gmCookie, origin },
        method: "PATCH",
        payload: { availableObjects, expectedRevision: scenario.updatedAt, gmPrivateNotes: "" },
        url: `/scenarios/${scenario.id}/session`,
      });
      expect(prepared.statusCode, prepared.body).toBe(200);

      return { asset, availableObjects, gmCookie, playerCookie, prepared, scenario };
    }

    async function sessionAvailableObjectIds(cookie: string, scenarioId: string) {
      const response = await app.inject({
        headers: { cookie, origin },
        method: "GET",
        url: `/scenarios/${scenarioId}/session`,
      });
      expect(response.statusCode, response.body).toBe(200);
      return response.json<SessionPayload>().session.availableObjects.map((object) => object.id);
    }

    it("withholds a divergent pre-migration Artifact from the player session payload", async () => {
      const { asset, playerCookie, gmCookie, scenario } =
        await seedLiveScenarioWithAvailableArtifact();

      // Control: while the audience genuinely is `campaign`, the player sees it.
      // Without this the assertions below would also pass for a gate that
      // withheld everything.
      expect(await sessionAvailableObjectIds(playerCookie, scenario.id)).toEqual([
        "available-keep-map",
      ]);

      // Construct the divergence the 2026-08-24 migration makes possible: the
      // canonical audience is GM-only while the legacy column still says
      // `visible_to_all`. Written as raw SQL on purpose — no live surface can
      // produce this today, so it cannot be reached through the API.
      await prisma.$executeRaw`
        UPDATE "CampaignAsset"
        SET "audience" = 'gm_private', "visibility" = 'visible_to_all'::"ScenarioVisibility"
        WHERE "id" = ${asset.id}
      `;
      const stored = await prisma.campaignAsset.findUniqueOrThrow({
        select: { audience: true, visibility: true },
        where: { id: asset.id },
      });
      expect(stored).toEqual({ audience: "gm_private", visibility: "visible_to_all" });

      // The player-reachable projection no longer exposes it, on the payload.
      expect(await sessionAvailableObjectIds(playerCookie, scenario.id)).toEqual([]);

      // The GM projection is unchanged: `visibility` never broadened access, and
      // withdrawing its authority must not narrow the GM's own view either.
      expect(await sessionAvailableObjectIds(gmCookie, scenario.id)).toEqual([
        "available-keep-map",
      ]);
    });

    it("withholds an unresolvable legacy audience from the player session payload", async () => {
      const { asset, playerCookie, scenario } = await seedLiveScenarioWithAvailableArtifact();

      // The retired legacy `scenario` audience, per §18.24's fail-closed safety
      // rule, resolves to `gm_private` and must never widen into player access.
      await prisma.$executeRaw`
        UPDATE "CampaignAsset"
        SET "audience" = 'scenario', "visibility" = 'visible_to_all'::"ScenarioVisibility"
        WHERE "id" = ${asset.id}
      `;
      expect(await sessionAvailableObjectIds(playerCookie, scenario.id)).toEqual([]);
    });

    it("refuses to make a GM-only Artifact available to players", async () => {
      const { asset, availableObjects, gmCookie, scenario } =
        await seedLiveScenarioWithAvailableArtifact();

      await prisma.$executeRaw`
        UPDATE "CampaignAsset"
        SET "audience" = 'gm_private', "visibility" = 'visible_to_all'::"ScenarioVisibility"
        WHERE "id" = ${asset.id}
      `;
      const refreshed = await new ScenarioService().getScenarioById(scenario.id);
      const rejected = await app.inject({
        headers: { cookie: gmCookie, origin },
        method: "PATCH",
        payload: {
          availableObjects,
          expectedRevision: refreshed!.updatedAt,
          gmPrivateNotes: "",
        },
        url: `/scenarios/${scenario.id}/session`,
      });

      expect(rejected.statusCode, rejected.body).toBe(400);
      expect(rejected.json<{ error: string }>().error).toBe(
        "Share this Campaign Artifact with players before making it available to players.",
      );
    });
  });
}
