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

    it("searches only current common fields with composable filters and privacy-equivalent access", async () => {
      const gm = await createTestUser(prisma, { displayName: "Search GM", roles: ["game_master"] });
      const player = await createTestUser(prisma, { displayName: "Search Player" });
      const foreign = await createTestUser(prisma, { displayName: "Foreign Player" });
      const campaign = await createTestCampaign(prisma, gm.id, { status: "active" });
      const character = await createTestCharacter(prisma, player.id, { name: "Search Ari" });
      await prisma.campaignRosterEntry.create({
        data: {
          campaignId: campaign.id,
          category: "pc",
          sourceId: character.id,
          sourceType: "character",
        },
      });
      const [gmCookie, playerCookie, foreignCookie] = await Promise.all([
        sessionCookie(gm.id),
        sessionCookie(player.id),
        sessionCookie(foreign.id),
      ]);

      async function share(payload: Record<string, unknown>) {
        const response = await app.inject({
          headers: mutationHeaders(gmCookie),
          method: "POST",
          payload,
          url: `/campaigns/${campaign.id}/blackboard/entries`,
        });
        expect(response.statusCode, response.body).toBe(201);
        return response.json<{ entry: { entryVersion: number; id: string } }>().entry;
      }

      const clue = await share({
        category: "clue_fact",
        context: "Beneath the old gatehouse",
        fact: "The bronze bell rings twice.",
        title: "Bell signal",
      });
      const document = await share({
        category: "document_text",
        context: "Recovered from the courier",
        documentText: "Meet beneath the western arch.",
        restrictedDetails: [{ detailText: "The courier is a royal agent.", sortOrder: 0 }],
        title: "Intercepted letter",
      });
      const recap = await share({
        category: "recap",
        recapText: "The group recovered the obsidian seal.",
        title: "Last session",
      });
      const otherCampaign = await createTestCampaign(prisma, gm.id, { status: "active" });
      const crossCampaignEntry = await app.inject({
        headers: mutationHeaders(gmCookie),
        method: "POST",
        payload: {
          category: "clue_fact",
          fact: "The southern envoy carries the ivory token.",
          title: "Envoy token",
        },
        url: `/campaigns/${otherCampaign.id}/blackboard/entries`,
      });
      expect(crossCampaignEntry.statusCode, crossCampaignEntry.body).toBe(201);

      const changedAt = new Date("2026-08-28T12:00:00.000Z");
      await prisma.$transaction(async (tx) => {
        await tx.campaignBlackboardEntry.create({
          data: {
            campaignId: campaign.id,
            category: "image_map",
            createdByLabelSnapshot: "Search GM",
            createdByUserId: gm.id,
            currentRevisionNumber: 1,
            entryVersion: 1,
            id: "search-map-entry",
            state: "published",
            stateChangedAt: changedAt,
            stateChangedByLabelSnapshot: "Search GM",
            stateChangedByUserId: gm.id,
          },
        });
        await tx.campaignBlackboardEntryRevision.create({
          data: {
            actorLabelSnapshot: "Search GM",
            actorUserId: gm.id,
            campaignId: campaign.id,
            category: "image_map",
            changeKind: "initial",
            changedAt,
            entryId: "search-map-entry",
            imageCaption: "The safe route avoids the watchtower.",
            revisionNumber: 1,
            sourceArtifactAltText: "A hand-drawn path to the hill caves",
            sourceArtifactIdSnapshot: "withdrawn-artifact",
            sourceArtifactKind: "map",
            sourceArtifactMediaType: "image/png",
            sourceArtifactTitle: "Eastern road source",
            title: "Route to the caves",
          },
        });
      });

      const pin = await app.inject({
        headers: mutationHeaders(playerCookie),
        method: "POST",
        payload: {
          entryId: clue.id,
          expectedLayoutVersion: 0,
          height: 180,
          layer: 1,
          width: 260,
          x: 0,
          y: 0,
        },
        url: `/campaigns/${campaign.id}/blackboard/placements`,
      });
      expect(pin.statusCode, pin.body).toBe(200);

      const search = async (query: string, cookie = playerCookie) =>
        app.inject({
          headers: { cookie },
          method: "GET",
          url: `/campaigns/${campaign.id}/blackboard/search?${query}`,
        });

      for (const [query, expectedId] of [
        ["q=signal", clue.id],
        ["q=bronze%20bell", clue.id],
        ["q=gatehouse", clue.id],
        ["q=letter", document.id],
        ["q=western%20arch", document.id],
        ["q=courier", document.id],
        ["q=route%20to%20the%20caves", "search-map-entry"],
        ["q=watchtower", "search-map-entry"],
        ["q=eastern%20road", "search-map-entry"],
        ["q=hand-drawn%20path", "search-map-entry"],
        ["q=last%20session", recap.id],
        ["q=obsidian%20seal", recap.id],
      ]) {
        const response = await search(query);
        expect(response.statusCode, response.body).toBe(200);
        expect(response.json<{ results: Array<{ entryId: string }> }>().results).toEqual([
          expect.objectContaining({ entryId: expectedId }),
        ]);
      }

      const combined = await search("category=clue_fact&pinned=pinned&q=bell");
      expect(combined.json()).toEqual({
        results: [{ category: "clue_fact", entryId: clue.id, pinned: true, title: "Bell signal" }],
      });
      expect((await search("pinned=unpinned&q=bell")).json()).toEqual({ results: [] });
      expect((await search("q=royal%20agent")).json()).toEqual({ results: [] });
      expect((await search("q=ivory%20token")).json()).toEqual({ results: [] });
      const crossCampaignDenied = await app.inject({
        headers: { cookie: playerCookie },
        method: "GET",
        url: `/campaigns/${otherCampaign.id}/blackboard/search?q=ivory%20token`,
      });
      expect(crossCampaignDenied.statusCode).toBe(404);
      expect(crossCampaignDenied.json()).toEqual({ error: "Blackboard unavailable." });
      expect(combined.body).not.toMatch(
        /royal agent|restrictedDetails|artifactId|sourceArtifact|"content"|"context"|"fact"|documentText|recapText|unitKey|grant|actor|userId|provenance|relationship/i,
      );

      const correction = await app.inject({
        headers: mutationHeaders(gmCookie),
        method: "POST",
        payload: {
          category: "clue_fact",
          changeKind: "correction",
          expectedEntryVersion: clue.entryVersion,
          fact: "Three knocks open the passage.",
          title: "Gate knocks",
        },
        url: `/campaigns/${campaign.id}/blackboard/entries/${clue.id}/revisions`,
      });
      expect(correction.statusCode, correction.body).toBe(200);
      expect((await search("q=bronze%20bell")).json()).toEqual({ results: [] });
      expect((await search("q=three%20knocks")).json()).toMatchObject({
        results: [{ entryId: clue.id, title: "Gate knocks" }],
      });

      const replacement = await app.inject({
        headers: mutationHeaders(gmCookie),
        method: "POST",
        payload: {
          category: "clue_fact",
          changeKind: "replacement",
          expectedEntryVersion: 2,
          fact: "A hooded lantern marks the safe passage.",
          title: "Lantern code",
        },
        url: `/campaigns/${campaign.id}/blackboard/entries/${clue.id}/revisions`,
      });
      expect(replacement.statusCode, replacement.body).toBe(200);
      expect((await search("q=three%20knocks")).json()).toEqual({ results: [] });
      expect((await search("q=hooded%20lantern")).json()).toMatchObject({
        results: [{ entryId: clue.id, title: "Lantern code" }],
      });

      const retract = await app.inject({
        headers: mutationHeaders(gmCookie),
        method: "POST",
        payload: { expectedEntryVersion: 3 },
        url: `/campaigns/${campaign.id}/blackboard/entries/${clue.id}/retract`,
      });
      expect(retract.statusCode, retract.body).toBe(200);
      const retractDocument = await app.inject({
        headers: mutationHeaders(gmCookie),
        method: "POST",
        payload: { expectedEntryVersion: document.entryVersion },
        url: `/campaigns/${campaign.id}/blackboard/entries/${document.id}/retract`,
      });
      expect(retractDocument.statusCode, retractDocument.body).toBe(200);
      const archive = await app.inject({
        headers: mutationHeaders(gmCookie),
        method: "POST",
        payload: { expectedEntryVersion: 2, expectedLayoutVersion: 1 },
        url: `/campaigns/${campaign.id}/blackboard/entries/${document.id}/archive`,
      });
      expect(archive.statusCode, archive.body).toBe(200);
      expect((await search("q=knocks")).json()).toEqual({ results: [] });
      expect((await search("q=western%20arch")).json()).toEqual({ results: [] });

      const [unauthorized, anonymous] = await Promise.all([
        search("q=obsidian", foreignCookie),
        app.inject({
          method: "GET",
          url: `/campaigns/${campaign.id}/blackboard/search?q=obsidian`,
        }),
      ]);
      expect(unauthorized.statusCode).toBe(404);
      expect(unauthorized.body).toBe(anonymous.body);
      expect(unauthorized.json()).toEqual({ error: "Blackboard unavailable." });

      const invalid = await search("q=seal&viewerCharacterId=secret");
      expect(invalid.statusCode).toBe(400);
      expect(invalid.json()).toEqual({ error: "Invalid Blackboard request." });

      await prisma.campaignRosterEntry.delete({
        where: {
          campaignId_sourceType_sourceId: {
            campaignId: campaign.id,
            sourceId: character.id,
            sourceType: "character",
          },
        },
      });
      const accessRemoved = await search("q=obsidian");
      expect(accessRemoved.statusCode).toBe(404);
      expect(accessRemoved.body).toBe(anonymous.body);
    });

    it("projects exact viewer capabilities without owner identity or display-label authority", async () => {
      const gm = await createTestUser(prisma, {
        displayName: "Capability GM",
        roles: ["game_master"],
      });
      const playerA = await createTestUser(prisma, { displayName: "Same Player" });
      const playerB = await createTestUser(prisma, { displayName: "Same Player" });
      const foreign = await createTestUser(prisma, { displayName: "Same Player" });
      const campaign = await createTestCampaign(prisma, gm.id, { status: "active" });
      const [characterA, characterB] = await Promise.all([
        createTestCharacter(prisma, playerA.id, { name: "Ari" }),
        createTestCharacter(prisma, playerB.id, { name: "Bea" }),
      ]);
      await prisma.campaignRosterEntry.createMany({
        data: [characterA, characterB].map((character) => ({
          campaignId: campaign.id,
          category: "pc",
          sourceId: character.id,
          sourceType: "character",
        })),
      });
      const [gmCookie, playerACookie, playerBCookie, foreignCookie] = await Promise.all([
        sessionCookie(gm.id),
        sessionCookie(playerA.id),
        sessionCookie(playerB.id),
        sessionCookie(foreign.id),
      ]);

      const ownedCreate = await app.inject({
        headers: mutationHeaders(playerACookie),
        method: "POST",
        payload: { category: "clue_fact", fact: "The gate is open.", title: "Gate" },
        url: `/campaigns/${campaign.id}/blackboard/entries`,
      });
      expect(ownedCreate.statusCode, ownedCreate.body).toBe(201);
      const ownedEntry = ownedCreate.json<{ entry: { id: string } }>().entry;
      const recapCreate = await app.inject({
        headers: mutationHeaders(gmCookie),
        method: "POST",
        payload: { category: "recap", recapText: "The party arrived.", title: "Arrival" },
        url: `/campaigns/${campaign.id}/blackboard/entries`,
      });
      expect(recapCreate.statusCode, recapCreate.body).toBe(201);
      const recapEntry = recapCreate.json<{ entry: { id: string } }>().entry;

      const boardResponses = await Promise.all(
        [gmCookie, playerACookie, playerBCookie].map((cookie) =>
          app.inject({
            headers: { cookie },
            method: "GET",
            url: `/campaigns/${campaign.id}/blackboard`,
          }),
        ),
      );
      expect(boardResponses[0]!.body).toBe(boardResponses[1]!.body);
      expect(boardResponses[1]!.body).toBe(boardResponses[2]!.body);

      const [gmCapabilities, playerACapabilities, playerBCapabilities] = await Promise.all(
        [gmCookie, playerACookie, playerBCookie].map((cookie) =>
          app.inject({
            headers: { cookie },
            method: "GET",
            url: `/campaigns/${campaign.id}/blackboard/capabilities`,
          }),
        ),
      );
      const capabilityFor = (response: (typeof boardResponses)[number], entryId: string) =>
        response
          .json<{
            entries: Array<{ canCorrect: boolean; canRemove: boolean; entryId: string }>;
          }>()
          .entries.find((entry) => entry.entryId === entryId);

      expect(capabilityFor(gmCapabilities, ownedEntry.id)).toEqual({
        canCorrect: true,
        canRemove: true,
        entryId: ownedEntry.id,
      });
      expect(capabilityFor(gmCapabilities, recapEntry.id)).toMatchObject({
        canCorrect: true,
        canRemove: true,
      });
      expect(capabilityFor(playerACapabilities, ownedEntry.id)).toMatchObject({
        canCorrect: true,
        canRemove: true,
      });
      expect(capabilityFor(playerACapabilities, recapEntry.id)).toMatchObject({
        canCorrect: false,
        canRemove: false,
      });
      expect(capabilityFor(playerBCapabilities, ownedEntry.id)).toMatchObject({
        canCorrect: false,
        canRemove: false,
      });
      expect(playerBCapabilities.body).not.toMatch(/owner|userId|displayName|Same Player/i);

      const revisionsBefore = await prisma.campaignBlackboardEntryRevision.count();
      const deniedCorrection = await app.inject({
        headers: mutationHeaders(playerBCookie),
        method: "POST",
        payload: {
          category: "clue_fact",
          changeKind: "correction",
          expectedEntryVersion: 1,
          fact: "This must not be accepted.",
          title: "Gate",
        },
        url: `/campaigns/${campaign.id}/blackboard/entries/${ownedEntry.id}/revisions`,
      });
      expect(deniedCorrection.statusCode).toBe(404);
      expect(await prisma.campaignBlackboardEntryRevision.count()).toBe(revisionsBefore);

      const [foreignCapabilities, anonymousCapabilities, missingCapabilities] = await Promise.all([
        app.inject({
          headers: { cookie: foreignCookie },
          method: "GET",
          url: `/campaigns/${campaign.id}/blackboard/capabilities`,
        }),
        app.inject({
          method: "GET",
          url: `/campaigns/${campaign.id}/blackboard/capabilities`,
        }),
        app.inject({
          headers: { cookie: playerACookie },
          method: "GET",
          url: "/campaigns/nonexistent/blackboard/capabilities",
        }),
      ]);
      expect(foreignCapabilities.statusCode).toBe(404);
      expect(foreignCapabilities.body).toBe(anonymousCapabilities.body);
      expect(missingCapabilities.body).toBe(anonymousCapabilities.body);
      expect(foreignCapabilities.json()).toEqual({ error: "Blackboard unavailable." });
    });
  });
}
