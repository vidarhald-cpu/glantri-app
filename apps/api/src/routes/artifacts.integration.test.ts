import { mkdtemp, readdir, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
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

async function sessionCookie(userId: string): Promise<string> {
  const { token } = await new AuthService().createSessionForUser(userId);
  return `${SESSION_COOKIE_NAME}=${token}`;
}

function multipartPayload(input: {
  bytes: Buffer;
  ending?: "complete" | "malformed" | "trailing-field";
  filename: string;
  mediaType: string;
  metadata: unknown;
}) {
  const boundary = "glantri-artifact-boundary";
  const ending = input.ending ?? "complete";
  const suffix =
    ending === "malformed"
      ? Buffer.alloc(0)
      : ending === "trailing-field"
        ? Buffer.from(
            `\r\n--${boundary}\r\nContent-Disposition: form-data; name="forbidden"\r\n\r\nlate\r\n--${boundary}--\r\n`,
          )
        : Buffer.from(`\r\n--${boundary}--\r\n`);
  return {
    boundary,
    payload: Buffer.concat([
      Buffer.from(
        `--${boundary}\r\nContent-Disposition: form-data; name="metadata"\r\n\r\n${JSON.stringify(input.metadata)}\r\n` +
          `--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="${input.filename}"\r\n` +
          `Content-Type: ${input.mediaType}\r\n\r\n`,
      ),
      input.bytes,
      suffix,
    ]),
  };
}

if (!hasTaskApplicationDatabase) {
  describe.skip("Artifact API integration (task database not configured)", () => {});
} else {
  describe("Artifact API integration", () => {
    let app: FastifyInstance;
    let root: string;

    beforeEach(async () => {
      await resetTestDatabase(prisma);
      root = await mkdtemp(path.join(os.tmpdir(), "glantri-artifact-api-"));
      vi.stubEnv("ARTIFACT_STORAGE_PROVIDER", "local");
      vi.stubEnv("ARTIFACT_LOCAL_ROOT", root);
      vi.stubEnv("WEB_ORIGIN", "http://localhost:3350");
      vi.stubEnv("LOG_LEVEL", "silent");
      app = buildApiServer();
      await app.ready();
    });

    afterEach(async () => {
      await app.close();
      await resetTestDatabase(prisma);
      await rm(root, { force: true, recursive: true });
      vi.unstubAllEnvs();
    });

    it("rejects trailing forbidden and malformed multipart without committing readable state", async () => {
      const gm = await createTestUser(prisma, { roles: ["game_master"] });
      const campaign = await createTestCampaign(prisma, gm.id, { status: "active" });
      const gmCookie = await sessionCookie(gm.id);

      for (const ending of ["trailing-field", "malformed"] as const) {
        const upload = multipartPayload({
          bytes: Buffer.from("89504e470d0a1a0a00000000", "hex"),
          ending,
          filename: "map.png",
          mediaType: "image/png",
          metadata: { altText: "A pass", artifactKind: "map", title: "Rejected map" },
        });
        const response = await app.inject({
          headers: {
            "content-type": `multipart/form-data; boundary=${upload.boundary}`,
            cookie: gmCookie,
            origin: "http://localhost:3350",
            "x-glantri-artifact-mutation": "1",
          },
          method: "POST",
          payload: upload.payload,
          url: `/campaigns/${campaign.id}/artifacts`,
        });

        expect(response.statusCode, `${ending}: ${response.body}`).toBe(400);
        expect(
          await prisma.campaignAsset.count({
            where: { campaignId: campaign.id, storageState: "ready" },
          }),
        ).toBe(0);
        expect(await readdir(root)).toEqual([]);
      }
    });

    it("keeps a private upload absent across player, foreign GM, and unauthenticated probes", async () => {
      const gm = await createTestUser(prisma, { roles: ["game_master"] });
      const player = await createTestUser(prisma);
      const foreignGm = await createTestUser(prisma, { roles: ["game_master"] });
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
      const foreignCookie = await sessionCookie(foreignGm.id);
      const upload = multipartPayload({
        bytes: Buffer.from("89504e470d0a1a0a00000000", "hex"),
        filename: "..\\..\\hostile-name.png",
        mediaType: "image/png",
        metadata: { altText: "A private pass", artifactKind: "map", title: "Private pass" },
      });
      const response = await app.inject({
        headers: {
          "content-type": `multipart/form-data; boundary=${upload.boundary}`,
          cookie: gmCookie,
          origin: "http://localhost:3350",
          "x-glantri-artifact-mutation": "1",
        },
        method: "POST",
        payload: upload.payload,
        url: `/campaigns/${campaign.id}/artifacts`,
      });
      expect(response.statusCode, response.body).toBe(201);
      const artifact = response.json().artifact as { id: string };
      expect(response.body).not.toMatch(/storageKey|storageUrl|artifact-internal/);

      const privateUrl = `/campaigns/${campaign.id}/artifacts/${artifact.id}/content`;
      const gmRead = await app.inject({
        headers: { cookie: gmCookie },
        method: "GET",
        url: privateUrl,
      });
      expect(gmRead.statusCode).toBe(200);
      expect(gmRead.headers["cache-control"]).toBe("private, no-store");
      expect(gmRead.headers["x-content-type-options"]).toBe("nosniff");

      const probes = await Promise.all([
        app.inject({ headers: { cookie: playerCookie }, method: "GET", url: privateUrl }),
        app.inject({ headers: { cookie: foreignCookie }, method: "GET", url: privateUrl }),
        app.inject({ method: "GET", url: privateUrl }),
        app.inject({
          headers: { cookie: playerCookie },
          method: "GET",
          url: `/campaigns/wrong-campaign/artifacts/${artifact.id}/content`,
        }),
        app.inject({
          headers: { cookie: playerCookie },
          method: "GET",
          url: `/campaigns/${campaign.id}/artifacts/nonexistent/content`,
        }),
      ]);
      expect(probes.map((probe) => [probe.statusCode, probe.body])).toEqual(
        Array.from({ length: 5 }, () => [404, JSON.stringify({ error: "Artifact not found." })]),
      );
    });

    it("publishes and withdraws Campaign access after reload without locator leakage", async () => {
      const gm = await createTestUser(prisma, { roles: ["game_master"] });
      const player = await createTestUser(prisma);
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
      const upload = multipartPayload({
        bytes: Buffer.from("%PDF-1.7\n1 0 obj\n%%EOF\n"),
        filename: "handout.pdf",
        mediaType: "application/pdf",
        metadata: { artifactKind: "handout", title: "The sealed letter" },
      });
      const created = await app.inject({
        headers: {
          "content-type": `multipart/form-data; boundary=${upload.boundary}`,
          cookie: gmCookie,
          origin: "http://localhost:3350",
          "x-glantri-artifact-mutation": "1",
        },
        method: "POST",
        payload: upload.payload,
        url: `/campaigns/${campaign.id}/artifacts`,
      });
      const artifact = created.json().artifact as { id: string; metadataVersion: number };
      const publish = await app.inject({
        headers: {
          cookie: gmCookie,
          origin: "http://localhost:3350",
          "x-glantri-artifact-mutation": "1",
        },
        method: "PUT",
        payload: { audience: "campaign", expectedMetadataVersion: artifact.metadataVersion },
        url: `/campaigns/${campaign.id}/artifacts/${artifact.id}/audience`,
      });
      expect(publish.statusCode, publish.body).toBe(200);
      const published = publish.json().artifact as { metadataVersion: number };

      const list = await app.inject({
        headers: { cookie: playerCookie },
        method: "GET",
        url: `/campaigns/${campaign.id}/artifacts`,
      });
      expect(list.statusCode).toBe(200);
      expect(list.body).toContain("The sealed letter");
      expect(list.body).not.toMatch(/storage|filename|digest|provenance|creator/i);
      const pdf = await app.inject({
        headers: { cookie: playerCookie },
        method: "GET",
        url: `/campaigns/${campaign.id}/artifacts/${artifact.id}/content`,
      });
      expect(pdf.statusCode).toBe(200);
      expect(pdf.headers["content-disposition"]).toMatch(/^attachment; filename="artifact-/);
      expect(pdf.headers["content-security-policy"]).toContain("sandbox");

      const stored = await prisma.campaignAsset.findUniqueOrThrow({
        select: { byteSize: true, storageKey: true },
        where: { id: artifact.id },
      });
      await writeFile(
        path.join(root, stored.storageKey!),
        Buffer.alloc(Number(stored.byteSize), 120),
      );
      const corrupted = await app.inject({
        headers: { cookie: playerCookie },
        method: "GET",
        url: `/campaigns/${campaign.id}/artifacts/${artifact.id}/content`,
      });
      expect(corrupted.statusCode).toBe(503);
      expect(corrupted.json()).toEqual({ error: "Artifact storage is temporarily unavailable." });
      expect(corrupted.body).not.toMatch(/digest|storageKey|storageUrl|private\/tmp/i);

      const withdraw = await app.inject({
        headers: {
          cookie: gmCookie,
          origin: "http://localhost:3350",
          "x-glantri-artifact-mutation": "1",
        },
        method: "PUT",
        payload: { audience: "gm_private", expectedMetadataVersion: published.metadataVersion },
        url: `/campaigns/${campaign.id}/artifacts/${artifact.id}/audience`,
      });
      expect(withdraw.statusCode).toBe(200);
      expect(
        (
          await app.inject({
            headers: { cookie: playerCookie },
            method: "GET",
            url: `/campaigns/${campaign.id}/artifacts/${artifact.id}/content`,
          })
        ).statusCode,
      ).toBe(404);
    });

    it("keeps private Scenario attachment hidden until publish and limits it to entitled players", async () => {
      const gm = await createTestUser(prisma, { roles: ["game_master"] });
      const playerA = await createTestUser(prisma);
      const playerB = await createTestUser(prisma);
      const campaign = await createTestCampaign(prisma, gm.id, { status: "active" });
      const foreignCampaign = await createTestCampaign(prisma, gm.id, { status: "active" });
      const characterA = await createTestCharacter(prisma, playerA.id);
      const characterB = await createTestCharacter(prisma, playerB.id);
      for (const character of [characterA, characterB]) {
        await prisma.campaignRosterEntry.create({
          data: {
            campaignId: campaign.id,
            category: "pc",
            sourceId: character.id,
            sourceType: "character",
          },
        });
      }
      const scenario = await prisma.scenario.create({
        data: {
          campaignId: campaign.id,
          description: "",
          kind: "mixed",
          name: "Pass",
          status: "live",
        },
      });
      const foreignScenario = await prisma.scenario.create({
        data: {
          campaignId: foreignCampaign.id,
          description: "",
          kind: "mixed",
          name: "Foreign",
          status: "live",
        },
      });
      await prisma.scenarioParticipant.create({
        data: {
          characterId: characterA.id,
          controlledByUserId: playerA.id,
          isActive: true,
          joinSource: "gm_added",
          role: "player_character",
          scenarioId: scenario.id,
          snapshotJson: { displayName: "Player A" },
          sourceType: "character",
          stateJson: { combat: {}, equipment: {}, health: {}, resources: {} },
        },
      });
      const gmCookie = await sessionCookie(gm.id);
      const playerACookie = await sessionCookie(playerA.id);
      const playerBCookie = await sessionCookie(playerB.id);
      const unrelatedBefore = await Promise.all([
        prisma.character.count(),
        prisma.characterEquipmentItem.count(),
        prisma.encounter.count(),
        prisma.encounterActiveCombatState.count(),
        prisma.encounterArchivedCombatRound.count(),
        prisma.scenarioEventLog.count(),
      ]);
      const upload = multipartPayload({
        bytes: Buffer.from("89504e470d0a1a0a00000000", "hex"),
        filename: "scenario.png",
        mediaType: "image/png",
        metadata: { altText: "A hidden route", artifactKind: "map", title: "Route" },
      });
      const created = await app.inject({
        headers: {
          "content-type": `multipart/form-data; boundary=${upload.boundary}`,
          cookie: gmCookie,
          origin: "http://localhost:3350",
          "x-glantri-artifact-mutation": "1",
        },
        method: "POST",
        payload: upload.payload,
        url: `/campaigns/${campaign.id}/artifacts`,
      });
      const artifact = created.json().artifact as { id: string; metadataVersion: number };
      const mutationHeaders = {
        cookie: gmCookie,
        origin: "http://localhost:3350",
        "x-glantri-artifact-mutation": "1",
      };

      const crossCampaign = await app.inject({
        headers: mutationHeaders,
        method: "POST",
        payload: { expectedArtifactVersion: artifact.metadataVersion },
        url: `/campaigns/${campaign.id}/scenarios/${foreignScenario.id}/artifacts/${artifact.id}/attach`,
      });
      expect(crossCampaign.statusCode).toBe(404);
      expect(await prisma.scenarioArtifactReference.count()).toBe(0);

      const attached = await app.inject({
        headers: mutationHeaders,
        method: "POST",
        payload: { caption: "Northern route", expectedArtifactVersion: artifact.metadataVersion },
        url: `/campaigns/${campaign.id}/scenarios/${scenario.id}/artifacts/${artifact.id}/attach`,
      });
      expect(attached.statusCode, attached.body).toBe(200);
      const attachedBody = attached.json() as {
        artifact: { metadataVersion: number };
        reference: { version: number };
      };
      const contentUrl = `/campaigns/${campaign.id}/artifacts/${artifact.id}/content`;
      expect(
        (await app.inject({ headers: { cookie: playerACookie }, method: "GET", url: contentUrl }))
          .statusCode,
      ).toBe(404);

      const published = await app.inject({
        headers: mutationHeaders,
        method: "POST",
        payload: {
          expectedArtifactVersion: attachedBody.artifact.metadataVersion,
          expectedReferenceVersion: attachedBody.reference.version,
        },
        url: `/campaigns/${campaign.id}/scenarios/${scenario.id}/artifacts/${artifact.id}/publish`,
      });
      expect(published.statusCode, published.body).toBe(200);
      const publishedBody = published.json() as {
        artifact: { metadataVersion: number };
        reference: { version: number };
      };
      const playerARead = await app.inject({
        headers: { cookie: playerACookie },
        method: "GET",
        url: contentUrl,
      });
      expect(playerARead.statusCode, playerARead.body).toBe(200);
      expect(
        (await app.inject({ headers: { cookie: playerBCookie }, method: "GET", url: contentUrl }))
          .statusCode,
      ).toBe(404);

      const campaignPublished = await app.inject({
        headers: mutationHeaders,
        method: "PUT",
        payload: {
          audience: "campaign",
          expectedMetadataVersion: publishedBody.artifact.metadataVersion,
        },
        url: `/campaigns/${campaign.id}/artifacts/${artifact.id}/audience`,
      });
      expect(campaignPublished.statusCode, campaignPublished.body).toBe(200);
      const campaignPublishedBody = campaignPublished.json().artifact as {
        metadataVersion: number;
      };
      const scenarioWithdrawn = await app.inject({
        headers: mutationHeaders,
        method: "POST",
        payload: {
          expectedArtifactVersion: campaignPublishedBody.metadataVersion,
          expectedReferenceVersion: publishedBody.reference.version,
        },
        url: `/campaigns/${campaign.id}/scenarios/${scenario.id}/artifacts/${artifact.id}/withdraw`,
      });
      expect(scenarioWithdrawn.statusCode, scenarioWithdrawn.body).toBe(200);
      const scenarioWithdrawnBody = scenarioWithdrawn.json() as {
        artifact: { metadataVersion: number };
        reference: { version: number };
      };
      expect(
        await Promise.all(
          [playerACookie, playerBCookie].map(
            async (cookie) =>
              (await app.inject({ headers: { cookie }, method: "GET", url: contentUrl }))
                .statusCode,
          ),
        ),
      ).toEqual([200, 200]);

      const scenarioRepublished = await app.inject({
        headers: mutationHeaders,
        method: "POST",
        payload: {
          expectedArtifactVersion: scenarioWithdrawnBody.artifact.metadataVersion,
          expectedReferenceVersion: scenarioWithdrawnBody.reference.version,
        },
        url: `/campaigns/${campaign.id}/scenarios/${scenario.id}/artifacts/${artifact.id}/publish`,
      });
      expect(scenarioRepublished.statusCode, scenarioRepublished.body).toBe(200);
      const scenarioRepublishedBody = scenarioRepublished.json() as {
        artifact: { metadataVersion: number };
      };
      const campaignWithdrawn = await app.inject({
        headers: mutationHeaders,
        method: "PUT",
        payload: {
          audience: "gm_private",
          expectedMetadataVersion: scenarioRepublishedBody.artifact.metadataVersion,
        },
        url: `/campaigns/${campaign.id}/artifacts/${artifact.id}/audience`,
      });
      expect(campaignWithdrawn.statusCode, campaignWithdrawn.body).toBe(200);
      const campaignWithdrawnBody = campaignWithdrawn.json().artifact as {
        metadataVersion: number;
      };
      expect(
        (await app.inject({ headers: { cookie: playerACookie }, method: "GET", url: contentUrl }))
          .statusCode,
      ).toBe(200);
      expect(
        (await app.inject({ headers: { cookie: playerBCookie }, method: "GET", url: contentUrl }))
          .statusCode,
      ).toBe(404);
      const removePublishedAlt = await app.inject({
        headers: mutationHeaders,
        method: "PATCH",
        payload: {
          altText: null,
          expectedMetadataVersion: campaignWithdrawnBody.metadataVersion,
        },
        url: `/campaigns/${campaign.id}/artifacts/${artifact.id}`,
      });
      expect(removePublishedAlt.statusCode, removePublishedAlt.body).toBe(400);
      expect(
        await Promise.all([
          prisma.character.count(),
          prisma.characterEquipmentItem.count(),
          prisma.encounter.count(),
          prisma.encounterActiveCombatState.count(),
          prisma.encounterArchivedCombatRound.count(),
          prisma.scenarioEventLog.count(),
        ]),
      ).toEqual(unrelatedBefore);
    });

    it("rejects CSRF, bad signatures, and unlisted formats without ready rows or readable orphans", async () => {
      const gm = await createTestUser(prisma, { roles: ["game_master"] });
      const campaign = await createTestCampaign(prisma, gm.id, { status: "active" });
      const cookie = await sessionCookie(gm.id);
      const invalid = multipartPayload({
        bytes: Buffer.from("<svg><script>alert(1)</script></svg>"),
        filename: "map.png",
        mediaType: "image/png",
        metadata: { artifactKind: "map", title: "Spoofed" },
      });
      const csrf = await app.inject({
        headers: { "content-type": `multipart/form-data; boundary=${invalid.boundary}`, cookie },
        method: "POST",
        payload: invalid.payload,
        url: `/campaigns/${campaign.id}/artifacts`,
      });
      expect(csrf.statusCode).toBe(403);
      const rejected = await app.inject({
        headers: {
          "content-type": `multipart/form-data; boundary=${invalid.boundary}`,
          cookie,
          origin: "http://localhost:3350",
          "x-glantri-artifact-mutation": "1",
        },
        method: "POST",
        payload: invalid.payload,
        url: `/campaigns/${campaign.id}/artifacts`,
      });
      expect(rejected.statusCode).toBe(400);
      expect(await prisma.campaignAsset.count({ where: { storageState: "ready" } })).toBe(0);
      expect(await readdir(root)).toEqual([]);
    });
  });
}
