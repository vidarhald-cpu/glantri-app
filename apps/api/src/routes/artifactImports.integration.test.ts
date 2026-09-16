import { createHash } from "node:crypto";
import { mkdtemp, rm, readdir } from "node:fs/promises";
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
const png = Buffer.from("89504e470d0a1a0a00000000", "hex");
const hash = createHash("sha256").update(png).digest("hex");
const manifest = () => ({
  schemaVersion: 1,
  producer: "author",
  packageId: "p",
  version: "1",
  title: "Private package",
  resources: [{ id: "picture", mediaType: "image/png", sha256: hash }],
  objects: [
    {
      id: "portrait",
      type: "Artifact",
      resourceId: "picture",
      metadata: { artifactKind: "portrait", title: "Private portrait", altText: "A portrait" },
    },
  ],
});
function payload(data = manifest(), ending = "complete", bytes = png) {
  const boundary = "am1-boundary";
  const suffix =
    ending === "malformed"
      ? ""
      : ending === "trailing"
        ? `\r\n--${boundary}\r\nContent-Disposition: form-data; name="extra"\r\n\r\nforbidden\r\n--${boundary}--\r\n`
        : `\r\n--${boundary}--\r\n`;
  return {
    boundary,
    body: Buffer.concat([
      Buffer.from(
        `--${boundary}\r\nContent-Disposition: form-data; name="manifest"\r\n\r\n${JSON.stringify(data)}\r\n--${boundary}\r\nContent-Disposition: form-data; name="picture"; filename="secret.png"\r\nContent-Type: image/png\r\n\r\n`,
      ),
      bytes,
      Buffer.from(suffix),
    ]),
  };
}
if (process.env.GLANTRI_DB_MODE !== "task")
  describe.skip("AM1 API integration (owned database required)", () => {});
else
  describe("AM1 private import API", () => {
    let app: FastifyInstance, root: string;
    beforeEach(async () => {
      await resetTestDatabase(prisma);
      root = await mkdtemp(path.join(os.tmpdir(), "am1-api-"));
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
      await rm(root, { recursive: true, force: true });
      vi.unstubAllEnvs();
    });
    async function setup() {
      const gm = await createTestUser(prisma, { roles: ["game_master"] });
      const campaign = await createTestCampaign(prisma, gm.id, { status: "active" });
      const { token } = await new AuthService().createSessionForUser(gm.id);
      return {
        gm,
        campaign,
        headers: {
          cookie: `${SESSION_COOKIE_NAME}=${token}`,
          origin: "http://localhost:3350",
          "x-glantri-artifact-mutation": "1",
        },
        base: `/campaigns/${campaign.id}/artifact-imports`,
      };
    }
    it("keeps stage, history, import records and bytes absent for nonowners and requires CSRF defense", async () => {
      const { campaign, headers, base } = await setup();
      const body = payload();
      const upload = await app.inject({
        method: "POST",
        url: base,
        headers: { ...headers, "content-type": `multipart/form-data; boundary=${body.boundary}` },
        payload: body.body,
      });
      expect(upload.statusCode, upload.body).toBe(201);
      const preview = upload.json().preview;
      expect(await prisma.campaignAsset.count()).toBe(0);
      const forbiddenCookies: string[] = [];
      for (const roles of [["player"], ["game_master"], ["admin"]]) {
        const user = await createTestUser(prisma, { roles });
        if (roles.includes("player")) {
          const character = await createTestCharacter(prisma, user.id);
          await prisma.campaignRosterEntry.create({
            data: {
              campaignId: campaign.id,
              sourceId: character.id,
              sourceType: "character",
              category: "pc",
              labelSnapshot: character.name,
            },
          });
        }
        const { token } = await new AuthService().createSessionForUser(user.id);
        forbiddenCookies.push(`${SESSION_COOKIE_NAME}=${token}`);
        for (const url of [
          base,
          `${base}/${preview.id}`,
          `${base}/${preview.id}/resources/picture`,
        ]) {
          const denied = await app.inject({
            method: "GET",
            url,
            headers: { cookie: `${SESSION_COOKIE_NAME}=${token}` },
          });
          expect(denied.statusCode).toBe(404);
          expect(denied.json()).toEqual({ error: "Artifact not found." });
        }
      }
      expect((await app.inject({ method: "GET", url: `${base}/${preview.id}` })).statusCode).toBe(
        404,
      );
      expect(
        (
          await app.inject({
            method: "POST",
            url: `${base}/${preview.id}/accept`,
            headers: { cookie: headers.cookie },
            payload: { previewToken: preview.previewToken, approvedUpdates: [] },
          })
        ).statusCode,
      ).toBe(403);
      const staged = await app.inject({
        method: "GET",
        url: `${base}/${preview.id}/resources/picture`,
        headers,
      });
      expect(staged.statusCode).toBe(200);
      expect(staged.rawPayload).toEqual(png);
      expect(staged.headers["cache-control"]).toBe("private, no-store");
      const accepted = await app.inject({
        method: "POST",
        url: `${base}/${preview.id}/accept`,
        headers,
        payload: { previewToken: preview.previewToken, approvedUpdates: [] },
      });
      expect(accepted.statusCode, accepted.body).toBe(200);
      const id = accepted.json().preview.result.portrait;
      const historyUrl = `/campaigns/${campaign.id}/artifacts/${id}/history`;
      expect(
        (await app.inject({ method: "GET", url: historyUrl, headers })).json().revisions,
      ).toHaveLength(1);
      expect((await app.inject({ method: "GET", url: historyUrl })).statusCode).toBe(404);
      for (const cookie of forbiddenCookies) {
        for (const url of [
          historyUrl,
          `${base}/${preview.id}`,
          `${base}/${preview.id}/resources/picture`,
        ]) {
          const response = await app.inject({ method: "GET", url, headers: { cookie } });
          expect(response.statusCode).toBe(404);
          expect(response.body).not.toMatch(
            /secret.png|Private portrait|storageKey|producer|sourceId/,
          );
        }
      }
      const deletion = await app.inject({
        method: "DELETE",
        url: `/campaigns/${campaign.id}/artifacts/${id}`,
        headers,
        payload: { expectedMetadataVersion: 1 },
      });
      expect(deletion.statusCode).toBe(400);
      expect(await prisma.artifactRevision.count()).toBe(1);
    });
    it("rejects malformed/trailing multipart, wrong digests, spoofed bytes and undeclared instructions without accepted rows", async () => {
      const { headers, base } = await setup();
      const wrong = manifest();
      wrong.resources[0]!.sha256 = "a".repeat(64);
      for (const body of [
        payload(manifest(), "trailing"),
        payload(manifest(), "malformed"),
        payload(wrong),
        payload(manifest(), "complete", Buffer.from("<script>evil</script>")),
        payload({ ...manifest(), commands: ["equip"] } as ReturnType<typeof manifest>),
      ]) {
        const response = await app.inject({
          method: "POST",
          url: base,
          headers: { ...headers, "content-type": `multipart/form-data; boundary=${body.boundary}` },
          payload: body.body,
        });
        expect(response.statusCode, response.body).toBe(400);
        expect(await prisma.campaignAsset.count()).toBe(0);
        expect(await readdir(root)).toEqual([]);
      }
    });
  });
