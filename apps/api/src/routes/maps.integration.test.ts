import { createHash } from "node:crypto";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

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

/** A minimal but structurally valid prepared-map PNG and a GM handout PDF. */
const PREPARED_MAP_PNG = Buffer.from("89504e470d0a1a0a0000000d49484452", "hex");
const GM_HANDOUT_PDF = Buffer.from("%PDF-1.4\n1 0 obj\n<<>>\nendobj\ntrailer\n%%EOF\n", "latin1");

/** Exactly what the browser derivation computes from the bytes it holds. */
function derivedDigest(bytes: Buffer): string {
  return createHash("sha256").update(bytes).digest("hex");
}

/**
 * The manifest an ordinary Glantri authoring session produces: semantic facts
 * from the author, and one resource digest derived from the bytes themselves.
 */
function preparedMapManifest(overrides: { pngDigest?: string } = {}): Record<string, unknown> {
  return {
    objects: [
      {
        id: "gatehouse-map",
        metadata: {
          altText: "A hand-drawn plan of the Old Gatehouse and its approach.",
          artifactKind: "map",
          description: "The prepared player-safe plan of the Old Gatehouse.",
          title: "Old Gatehouse",
        },
        resourceId: "gatehouse-image",
        type: "Artifact",
      },
      {
        id: "varro-orders",
        metadata: {
          artifactKind: "document",
          title: "Captain Varro's standing orders",
        },
        resourceId: "orders-document",
        type: "Artifact",
      },
    ],
    packageId: "ai-intake-old-gatehouse",
    producer: "glantri-app/ai-intake",
    resources: [
      {
        id: "gatehouse-image",
        mediaType: "image/png",
        sha256: overrides.pngDigest ?? derivedDigest(PREPARED_MAP_PNG),
      },
      {
        id: "orders-document",
        mediaType: "application/pdf",
        sha256: derivedDigest(GM_HANDOUT_PDF),
      },
    ],
    schemaVersion: 1,
    title: "AI intake: 2 entries",
    version: "1",
  };
}

function importPayload(manifest: unknown) {
  const boundary = "glantri-map-import-boundary";
  const part = (name: string, filename: string, mediaType: string, bytes: Buffer) =>
    Buffer.concat([
      Buffer.from(
        `--${boundary}\r\nContent-Disposition: form-data; name="${name}"; filename="${filename}"\r\n` +
          `Content-Type: ${mediaType}\r\n\r\n`,
      ),
      bytes,
      Buffer.from("\r\n"),
    ]);
  return {
    boundary,
    payload: Buffer.concat([
      Buffer.from(
        `--${boundary}\r\nContent-Disposition: form-data; name="manifest"\r\n\r\n${JSON.stringify(manifest)}\r\n`,
      ),
      part("gatehouse-image", "old-gatehouse.png", "image/png", PREPARED_MAP_PNG),
      part("orders-document", "varro-orders.pdf", "application/pdf", GM_HANDOUT_PDF),
      Buffer.from(`--${boundary}--\r\n`),
    ]),
  };
}

if (!hasTaskApplicationDatabase) {
  describe.skip("Map API integration (task database not configured)", () => {});
} else {
  describe("Map API integration", () => {
    let app: FastifyInstance;
    let artifactRoot: string;

    beforeEach(async () => {
      await resetTestDatabase(prisma);
      artifactRoot = await mkdtemp(path.join(os.tmpdir(), "glantri-map-background-"));
      vi.stubEnv("ARTIFACT_STORAGE_PROVIDER", "local");
      vi.stubEnv("ARTIFACT_LOCAL_ROOT", artifactRoot);
      vi.stubEnv("WEB_ORIGIN", "http://localhost:3350");
      vi.stubEnv("LOG_LEVEL", "silent");
      app = buildApiServer();
      await app.ready();
    });

    afterEach(async () => {
      await app.close();
      await resetTestDatabase(prisma);
      await rm(artifactRoot, { force: true, recursive: true });
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

    it("carries an authored package into a GM and party-wide player Map background", async () => {
      const gm = await createTestUser(prisma, { roles: ["game_master"] });
      const player = await createTestUser(prisma);
      const foreignGm = await createTestUser(prisma, { roles: ["game_master"] });
      const campaign = await createTestCampaign(prisma, gm.id, { status: "active" });
      const playerCharacter = await createTestCharacter(prisma, player.id);
      await prisma.campaignRosterEntry.create({
        data: {
          campaignId: campaign.id,
          category: "pc",
          labelSnapshot: playerCharacter.name,
          sourceId: playerCharacter.id,
          sourceType: "character",
        },
      });
      const gmCookie = await sessionCookie(gm.id);
      const playerCookie = await sessionCookie(player.id);
      const foreignCookie = await sessionCookie(foreignGm.id);
      const artifactHeaders = {
        cookie: gmCookie,
        origin: "http://localhost:3350",
        "x-glantri-artifact-mutation": "1",
      };
      const mapHeaders = {
        cookie: gmCookie,
        origin: "http://localhost:3350",
        "x-glantri-map-mutation": "1",
      };

      // The complete authored package imports in one step: the GM supplies no
      // digest anywhere on this path, and no repair step stands between the
      // authoring output and a usable Artifact.
      const upload = importPayload(preparedMapManifest());
      const imported = await app.inject({
        headers: {
          ...artifactHeaders,
          "content-type": `multipart/form-data; boundary=${upload.boundary}`,
        },
        method: "POST",
        payload: upload.payload,
        url: `/campaigns/${campaign.id}/artifact-imports`,
      });
      expect(imported.statusCode, imported.body).toBe(201);
      const preview = imported.json().preview;
      const accepted = await app.inject({
        headers: artifactHeaders,
        method: "POST",
        payload: { approvedUpdates: [], previewToken: preview.previewToken },
        url: `/campaigns/${campaign.id}/artifact-imports/${preview.id}/accept`,
      });
      expect(accepted.statusCode, accepted.body).toBe(200);
      const backgroundArtifactId = accepted.json().preview.result["gatehouse-map"] as string;
      const documentArtifactId = accepted.json().preview.result["varro-orders"] as string;
      expect(
        await prisma.campaignAsset.findUniqueOrThrow({ where: { id: backgroundArtifactId } }),
      ).toMatchObject({
        artifactKind: "map",
        audience: "gm_private",
        lifecycleState: "active",
        mediaTypeDetected: "image/png",
        sha256Digest: derivedDigest(PREPARED_MAP_PNG),
        storageState: "ready",
      });

      // A new Map arrives with a Layer, so a marker can be placed immediately.
      const createdResponse = await app.inject({
        headers: mapHeaders,
        method: "POST",
        payload: { access: "players", name: "Old Gatehouse" },
        url: `/campaigns/${campaign.id}/maps`,
      });
      expect(createdResponse.statusCode, createdResponse.body).toBe(200);
      const created = createdResponse.json().map;
      expect(created.layers).toHaveLength(1);
      expect(created.layers[0]).toMatchObject({ markers: [], sortOrder: 0, visibility: "gm_only" });
      const mapUrl = `/campaigns/${campaign.id}/maps/${created.id}`;

      // Only an eligible visual Artifact of this Campaign may become a
      // background: the five selection predicates are enforced at the source.
      const options = await app.inject({
        headers: { cookie: gmCookie },
        method: "GET",
        url: `${mapUrl.replace(`/${created.id}`, "")}/authoring-options`,
      });
      expect(options.statusCode, options.body).toBe(200);
      expect(options.json().options.artifacts).toEqual([
        {
          altText: "A hand-drawn plan of the Old Gatehouse and its approach.",
          id: backgroundArtifactId,
          title: "Old Gatehouse",
        },
      ]);

      const mutation = (backgroundId: string | null, expectedVersion: number) => ({
        access: "players",
        backgroundArtifactId: backgroundId,
        description: "The gatehouse and its approach.",
        expectedVersion,
        layers: [
          {
            id: created.layers[0].id,
            markers: [
              {
                description: "",
                destinationMapId: null,
                entityLabelSnapshot: null,
                entityReferenceId: null,
                entityReferenceType: null,
                id: "gate-marker",
                kind: "annotation",
                label: "The gate",
                presentation: "pin",
                sortOrder: 0,
                visibility: "inherit",
                x: 0.25,
                y: 0.75,
              },
            ],
            name: "Places",
            sortOrder: 0,
            visibility: "player_visible",
          },
        ],
        name: "Old Gatehouse",
        role: "area",
      });

      for (const rejected of [documentArtifactId, "no-such-artifact"]) {
        const response = await app.inject({
          headers: mapHeaders,
          method: "PUT",
          payload: mutation(rejected, created.version),
          url: mapUrl,
        });
        expect(response.statusCode, response.body).toBe(400);
        expect(response.json()).toEqual({
          error: "Choose an active visual Artifact from this Campaign.",
        });
      }

      const attached = await app.inject({
        headers: mapHeaders,
        method: "PUT",
        payload: mutation(backgroundArtifactId, created.version),
        url: mapUrl,
      });
      expect(attached.statusCode, attached.body).toBe(200);
      expect(attached.json().map.background).toMatchObject({
        artifactId: backgroundArtifactId,
        available: true,
        playerCanView: false,
        title: "Old Gatehouse",
      });
      const attachedVersion = attached.json().map.version as number;

      const backgroundUrl = `${mapUrl}/background`;
      const gmBackground = await app.inject({
        headers: { cookie: gmCookie },
        method: "GET",
        url: backgroundUrl,
      });
      expect(gmBackground.statusCode, gmBackground.body).toBe(200);
      expect(gmBackground.rawPayload).toEqual(PREPARED_MAP_PNG);
      expect(gmBackground.headers["content-type"]).toBe("image/png");
      expect(gmBackground.headers["cache-control"]).toBe("private, no-store");

      // While the Artifact is GM-private the player gate is closed, even though
      // the Map itself is shared with the party.
      const privateForPlayer = await app.inject({
        headers: { cookie: playerCookie },
        method: "GET",
        url: mapUrl,
      });
      expect(privateForPlayer.statusCode, privateForPlayer.body).toBe(200);
      expect(privateForPlayer.json().mode).toBe("player");
      expect(privateForPlayer.json().map.background).toBeUndefined();
      const privateBytes = await app.inject({
        headers: { cookie: playerCookie },
        method: "GET",
        url: backgroundUrl,
      });
      expect(privateBytes.statusCode).toBe(404);
      expect(privateBytes.rawPayload).not.toEqual(PREPARED_MAP_PNG);

      const artifact = await app.inject({
        headers: { cookie: gmCookie },
        method: "GET",
        url: `/campaigns/${campaign.id}/artifacts/${backgroundArtifactId}`,
      });
      expect(artifact.statusCode, artifact.body).toBe(200);
      const shared = await app.inject({
        headers: artifactHeaders,
        method: "PUT",
        payload: {
          audience: "campaign",
          expectedMetadataVersion: artifact.json().artifact.metadataVersion,
        },
        url: `/campaigns/${campaign.id}/artifacts/${backgroundArtifactId}/audience`,
      });
      expect(shared.statusCode, shared.body).toBe(200);

      const playerMap = await app.inject({
        headers: { cookie: playerCookie },
        method: "GET",
        url: mapUrl,
      });
      expect(playerMap.statusCode, playerMap.body).toBe(200);
      expect(playerMap.json().map).toMatchObject({
        background: {
          altText: "A hand-drawn plan of the Old Gatehouse and its approach.",
          available: true,
        },
        layers: [{ markers: [{ label: "The gate", x: 0.25, y: 0.75 }] }],
      });
      const playerBytes = await app.inject({
        headers: { cookie: playerCookie },
        method: "GET",
        url: backgroundUrl,
      });
      expect(playerBytes.statusCode, playerBytes.body).toBe(200);
      expect(playerBytes.rawPayload).toEqual(PREPARED_MAP_PNG);
      expect(playerBytes.headers["content-type"]).toBe("image/png");

      const gmAfterSharing = await app.inject({
        headers: { cookie: gmCookie },
        method: "GET",
        url: mapUrl,
      });
      expect(gmAfterSharing.json().map.background).toMatchObject({ playerCanView: true });

      // Outsiders never reach the bytes, whatever the Artifact's audience is.
      for (const cookie of [foreignCookie, undefined]) {
        const response = await app.inject({
          headers: cookie ? { cookie } : {},
          method: "GET",
          url: backgroundUrl,
        });
        expect(response.statusCode).toBe(404);
        expect(response.rawPayload).not.toEqual(PREPARED_MAP_PNG);
      }

      // Withdrawing the Map from the party closes the gate again without
      // disturbing the Map's own content.
      const withdrawn = await app.inject({
        headers: mapHeaders,
        method: "PUT",
        payload: { ...mutation(backgroundArtifactId, attachedVersion), access: "gm_only" },
        url: mapUrl,
      });
      expect(withdrawn.statusCode, withdrawn.body).toBe(200);
      expect(
        (await app.inject({ headers: { cookie: playerCookie }, method: "GET", url: backgroundUrl }))
          .statusCode,
      ).toBe(404);
    });

    it("rejects a package whose digest a human supplied instead of deriving", async () => {
      const gm = await createTestUser(prisma, { roles: ["game_master"] });
      const campaign = await createTestCampaign(prisma, gm.id, { status: "active" });
      const headers = {
        cookie: await sessionCookie(gm.id),
        origin: "http://localhost:3350",
        "x-glantri-artifact-mutation": "1",
      };

      // The Captain Varro / Old Gatehouse regression: a packaging step without
      // the bytes can only guess a digest. Every shape of guess is refused at
      // import, so no placeholder manifest can reach a Map background and no
      // second technical repair step is ever the way forward.
      for (const supplied of [
        "<sha256>",
        "PLACEHOLDER",
        "TODO-compute-sha256",
        "",
        derivedDigest(PREPARED_MAP_PNG).toUpperCase(),
        "0".repeat(64),
        derivedDigest(GM_HANDOUT_PDF),
      ]) {
        const upload = importPayload(preparedMapManifest({ pngDigest: supplied }));
        const response = await app.inject({
          headers: {
            ...headers,
            "content-type": `multipart/form-data; boundary=${upload.boundary}`,
          },
          method: "POST",
          payload: upload.payload,
          url: `/campaigns/${campaign.id}/artifact-imports`,
        });
        expect(response.statusCode, `${supplied}: ${response.body}`).toBe(400);
      }
      expect(await prisma.campaignAsset.count()).toBe(0);

      // Only the digest derived from the bytes themselves is accepted, and the
      // Artifact it produces is the one a Map may use as a background.
      const upload = importPayload(preparedMapManifest());
      const accepted = await app.inject({
        headers: { ...headers, "content-type": `multipart/form-data; boundary=${upload.boundary}` },
        method: "POST",
        payload: upload.payload,
        url: `/campaigns/${campaign.id}/artifact-imports`,
      });
      expect(accepted.statusCode, accepted.body).toBe(201);
    });
  });
}
