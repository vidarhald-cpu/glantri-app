import type { FastifyInstance } from "fastify";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { AuthService, prisma } from "@glantri/database";
import type { CharacterBuild } from "@glantri/domain";
import {
  createTestCampaign,
  createTestCharacter,
  createTestUser,
  resetTestDatabase,
} from "@glantri/database/testing";

import { buildApiServer } from "../app";
import { SESSION_COOKIE_NAME } from "../lib/sessionAuth";

const testDatabaseUrl = process.env.DATABASE_URL_TEST;
const appUsesTestDatabase = Boolean(
  testDatabaseUrl && process.env.DATABASE_URL === testDatabaseUrl,
);

async function sessionCookie(userId: string): Promise<string> {
  const { token } = await new AuthService().createSessionForUser(userId);
  return `${SESSION_COOKIE_NAME}=${token}`;
}

function retainedBuild(characterId: string): CharacterBuild {
  return {
    equipment: { items: [] },
    id: characterId,
    name: "API retained veteran",
    profile: {
      description: "Headless API integration Character",
      distractionLevel: 3,
      id: `profile:${characterId}`,
      label: "API retained profile",
      rolledStats: {
        cha: 10,
        com: 10,
        con: 10,
        dex: 10,
        health: 10,
        int: 10,
        lck: 10,
        pow: 10,
        siz: 10,
        str: 10,
        will: 10,
      },
      societyLevel: 0,
    },
    progression: {
      chargenMode: "standard",
      educationPoints: 0,
      flexiblePointFactor: 1,
      level: 1,
      primaryPoolSpent: 0,
      primaryPoolTotal: 60,
      secondaryPoolSpent: 0,
      secondaryPoolTotal: 26,
      skillGroups: [],
      skills: [],
      specializations: [],
    },
    progressionState: {
      availablePoints: 0,
      checks: [],
      history: [],
      pendingAttempts: [],
    },
  };
}

if (!appUsesTestDatabase) {
  describe.skip("Character API integration (DATABASE_URL must match DATABASE_URL_TEST)", () => {});
} else {
  describe("Character API authorization and lifecycle integration", () => {
    let app: FastifyInstance;

    beforeEach(async () => {
      await resetTestDatabase(prisma);
      app = buildApiServer();
      await app.ready();
    });

    afterEach(async () => {
      await app.close();
    });

    it("enforces owner, owning-GM, other-GM, and admin scope through real routes", async () => {
      const owner = await createTestUser(prisma, { email: "owner-api@example.com" });
      const owningGm = await createTestUser(prisma, {
        email: "owning-gm-api@example.com",
        roles: ["game_master"],
      });
      const otherGm = await createTestUser(prisma, {
        email: "other-gm-api@example.com",
        roles: ["game_master"],
      });
      const admin = await createTestUser(prisma, {
        email: "admin-api@example.com",
        roles: ["admin"],
      });
      const character = await createTestCharacter(prisma, owner.id, { name: "Scoped Hero" });
      const campaign = await createTestCampaign(prisma, owningGm.id);
      await prisma.campaignRosterEntry.create({
        data: {
          campaignId: campaign.id,
          category: "pc",
          sourceId: character.id,
          sourceType: "character",
        },
      });
      const cookies = {
        admin: await sessionCookie(admin.id),
        otherGm: await sessionCookie(otherGm.id),
        owner: await sessionCookie(owner.id),
        owningGm: await sessionCookie(owningGm.id),
      };

      for (const cookie of [cookies.owner, cookies.owningGm, cookies.admin]) {
        const listResponse = await app.inject({
          headers: { cookie },
          method: "GET",
          url: "/characters",
        });
        const readResponse = await app.inject({
          headers: { cookie },
          method: "GET",
          url: `/characters/${character.id}`,
        });

        expect(listResponse.statusCode).toBe(200);
        expect(listResponse.json().characters.map((item: { id: string }) => item.id)).toContain(
          character.id,
        );
        expect(readResponse.statusCode).toBe(200);
      }

      const hiddenList = await app.inject({
        headers: { cookie: cookies.otherGm },
        method: "GET",
        url: "/characters",
      });
      const hiddenRead = await app.inject({
        headers: { cookie: cookies.otherGm },
        method: "GET",
        url: `/characters/${character.id}`,
      });
      expect(hiddenList.json().characters).toEqual([]);
      expect(hiddenRead.statusCode).toBe(404);

      const canonical = (
        await app.inject({
          headers: { cookie: cookies.owner },
          method: "GET",
          url: `/characters/${character.id}`,
        })
      ).json().character;
      const owningGmUpdate = await app.inject({
        headers: { cookie: cookies.owningGm },
        method: "PUT",
        payload: {
          build: { ...canonical.build, name: "GM-adjusted Hero" },
          expectedUpdatedAt: canonical.updatedAt,
        },
        url: `/characters/${character.id}`,
      });
      expect(owningGmUpdate.statusCode).toBe(200);

      const updated = owningGmUpdate.json().character;
      const hiddenDelete = await app.inject({
        headers: { cookie: cookies.otherGm },
        method: "DELETE",
        payload: { expectedUpdatedAt: updated.updatedAt },
        url: `/characters/${character.id}`,
      });
      expect(hiddenDelete.statusCode).toBe(404);

      const adminDelete = await app.inject({
        headers: { cookie: cookies.admin },
        method: "DELETE",
        payload: { expectedUpdatedAt: updated.updatedAt },
        url: `/characters/${character.id}`,
      });
      expect(adminDelete.statusCode).toBe(204);
      await expect(
        prisma.character.findUnique({ where: { id: character.id } }),
      ).resolves.toBeNull();
    });

    it("returns a deterministic divergent-id conflict and preserves the canonical row", async () => {
      const owner = await createTestUser(prisma, { email: "collision-owner@example.com" });
      const character = await createTestCharacter(prisma, owner.id, { name: "Canonical Hero" });
      const cookie = await sessionCookie(owner.id);
      const canonical = (
        await app.inject({
          headers: { cookie },
          method: "GET",
          url: `/characters/${character.id}`,
        })
      ).json().character;

      const response = await app.inject({
        headers: { cookie },
        method: "POST",
        payload: { build: { ...canonical.build, name: "Divergent chargen retry" } },
        url: "/characters",
      });

      expect(response.statusCode).toBe(409);
      expect(response.json()).toMatchObject({ code: "character_already_exists" });
      await expect(
        prisma.character.findUnique({ where: { id: character.id } }),
      ).resolves.toMatchObject({
        build: canonical.build,
        name: "Canonical Hero",
        ownerId: owner.id,
        updatedAt: new Date(canonical.updatedAt),
      });
      await expect(prisma.character.count({ where: { id: character.id } })).resolves.toBe(1);
    });

    it("finalizes, replays, reloads, and projects the pinned retained Skill model", async () => {
      const owner = await createTestUser(prisma, { email: "retained-api@example.com" });
      const cookie = await sessionCookie(owner.id);
      const payload = {
        build: retainedBuild("retained-api-veteran"),
        configuration: { flexBudget: 26, formationBudget: 60, id: "api-pilot-v1" },
        idempotencyKey: "api-finalize-veteran",
        pilotCharacterId: "character:pilot:glantrian-retainer-veteran",
      };
      const first = await app.inject({
        headers: { cookie },
        method: "POST",
        payload,
        url: "/chargen/headless/finalize",
      });
      const replay = await app.inject({
        headers: { cookie },
        method: "POST",
        payload,
        url: "/chargen/headless/finalize",
      });

      expect(first.statusCode).toBe(200);
      expect(replay.statusCode).toBe(200);
      expect(replay.json()).toEqual(first.json());

      const response = await app.inject({
        headers: { cookie },
        method: "GET",
        url: "/characters/retained-api-veteran/effective-skills",
      });
      expect(response.statusCode).toBe(200);
      expect(response.json().retainedCharacter).toMatchObject({
        characterId: "retained-api-veteran",
        characterRevisionId: first.json().revision.characterRevisionId,
        effectiveSkills: {
          versionEnvelope: {
            contentRelease: {
              contentVersion: "pilot-skills-content/1.0.1",
              digest: "sha256:f524303b274b546c42daac06b65403957e896f35609d42ce7456ff5781c9f419",
              id: "content-release:pilot-skills:1",
            },
          },
        },
        perspective: "owner",
        provenanceDetail: "owner_safe",
      });
      expect(
        response
          .json()
          .retainedCharacter.effectiveSkills.rows.find(
            (row: { competencyId: string }) => row.competencyId === "skill:sword",
          ),
      ).toMatchObject({
        directAcquisition: 2,
        effectiveLevel: 6,
        publicExplanation: "2 acquired directly, 4 from strongest learning history",
        strongestHistoryContribution: 4,
      });
    });

    it("denies retained-command probes before replay or stale details and binds migrations", async () => {
      const owner = await createTestUser(prisma, { email: "private-owner-api@example.com" });
      const outsider = await createTestUser(prisma, { email: "private-outsider-api@example.com" });
      const ownerCookie = await sessionCookie(owner.id);
      const outsiderCookie = await sessionCookie(outsider.id);
      const payload = {
        build: retainedBuild("retained-private-a"),
        configuration: { flexBudget: 26, formationBudget: 60, id: "api-private-v1" },
        idempotencyKey: "api-private-finalize",
        pilotCharacterId: "character:pilot:iest-dockside-investigator",
      };
      const finalized = await app.inject({
        headers: { cookie: ownerCookie },
        method: "POST",
        payload,
        url: "/chargen/headless/finalize",
      });
      expect(finalized.statusCode).toBe(200);
      const protectedSourcePattern =
        /Copper Latch|Night-Entry Crew|Iest Dockside Network|hist:iest-|iest-dockside-childhood|access:iest-contact-copper-latch/;
      expect(finalized.body).not.toMatch(protectedSourcePattern);
      expect(finalized.json().revision).not.toHaveProperty("state");
      expect(finalized.json().revision).not.toHaveProperty("commandDigest");
      expect(finalized.json().revision).not.toHaveProperty("revisionDigest");
      const finalizedEvents = finalized.json().revision.events as Array<{
        component: string;
        economics?: Record<string, unknown>;
        targetId: string;
      }>;
      expect(finalizedEvents.find((entry) => entry.component === "history")).toMatchObject({
        economics: { finalBundleCost: 32 },
        targetId: "protected-history-1",
      });
      expect(finalizedEvents.find((entry) => entry.component === "direct")).toMatchObject({
        economics: { ranks: 3 },
      });
      const currentRevisionId = finalized.json().revision.characterRevisionId as string;
      const historyInstanceId = "protected-history-probe";
      const ownerProjection = await app.inject({
        headers: { cookie: ownerCookie },
        method: "GET",
        url: "/characters/retained-private-a/effective-skills",
      });
      expect(ownerProjection.statusCode).toBe(200);
      expect(ownerProjection.body).not.toMatch(protectedSourcePattern);
      expect(
        ownerProjection
          .json()
          .retainedCharacter.events.find(
            (entry: { component: string }) => entry.component === "history",
          ),
      ).toMatchObject({ economics: { finalBundleCost: 32 }, targetId: "protected-history-1" });
      expect(
        ownerProjection
          .json()
          .retainedCharacter.events.find(
            (entry: { component: string }) => entry.component === "direct",
          ),
      ).toMatchObject({ economics: { ranks: 3 } });
      expect(
        ownerProjection
          .json()
          .retainedCharacter.effectiveSkills.rows.find(
            (row: { competencyId: string }) => row.competencyId === "skill:lockpicking",
          ),
      ).toMatchObject({
        acquiredBase: 6,
        directAcquisition: 3,
        effectiveLevel: 6,
        groupCandidates: [
          {
            historyInstanceId: "protected-history-2",
            historyLabel: "Protected learning history",
            level: 3,
            selectedAsStrongest: true,
          },
        ],
        strongestHistoryContribution: 3,
      });
      expect(
        ownerProjection.json().retainedCharacter.effectiveSkills.versionEnvelope,
      ).toMatchObject({
        contentRelease: {
          contentVersion: "pilot-skills-content/1.0.1",
          digest: "sha256:f524303b274b546c42daac06b65403957e896f35609d42ce7456ff5781c9f419",
          id: "content-release:pilot-skills:1",
        },
      });

      const replayProbe = await app.inject({
        headers: { cookie: outsiderCookie },
        method: "POST",
        payload,
        url: "/chargen/headless/finalize",
      });
      expect(replayProbe.statusCode).toBe(404);
      expect(replayProbe.json()).toEqual({
        code: "retained_character_unauthorized",
        error: "Character not found.",
      });
      expect(replayProbe.body).not.toMatch(
        /eventId|actorUserId|revision|ledger|economics|protectedProvenance|Copper Latch|access:iest-contact-copper-latch|effectiveSkills/,
      );

      const ownerStale = await app.inject({
        headers: { cookie: ownerCookie },
        method: "POST",
        payload: {
          expectedRevisionId: "known-stale-revision",
          idempotencyKey: "owner-stale-profession",
          professionId: "profession:stale",
        },
        url: "/characters/retained-private-a/profession",
      });
      expect(ownerStale.statusCode).toBe(409);
      expect(ownerStale.json()).toMatchObject({
        code: "retained_character_stale_revision",
        currentRevisionId,
      });

      const outsiderCommands = [
        {
          payload: {
            expectedRevisionId: "known-stale-revision",
            idempotencyKey: "outsider-profession",
            professionId: "profession:probe",
          },
          url: "/characters/retained-private-a/profession",
        },
        {
          payload: {
            expectedRevisionId: "known-stale-revision",
            idempotencyKey: "outsider-advance",
            reason: "Probe",
            targetLevel: 99,
          },
          url: `/characters/retained-private-a/histories/${historyInstanceId}/advance`,
        },
        {
          payload: {
            expectedRevisionId: "known-stale-revision",
            migrationId: "migration:probe",
            targetEnvelope: finalized.json().revision.effectiveSkills.versionEnvelope,
          },
          url: "/characters/retained-private-a/migrations/preview",
        },
        {
          payload: {
            expectedRevisionId: "known-stale-revision",
            idempotencyKey: "outsider-rollback",
            migrationRevisionId: "known-migration-revision",
          },
          url: "/characters/retained-private-a/migrations/rollback",
        },
      ];
      for (const command of outsiderCommands) {
        const response = await app.inject({
          headers: { cookie: outsiderCookie },
          method: "POST",
          payload: command.payload,
          url: command.url,
        });
        expect(response.statusCode).toBe(404);
        expect(response.json()).toEqual({
          code: "retained_character_unauthorized",
          error: "Character not found.",
        });
        expect(response.body).not.toMatch(/currentRevisionId|eventId|actorUserId|economics/);
      }

      const previewResponse = await app.inject({
        headers: { cookie: ownerCookie },
        method: "POST",
        payload: {
          expectedRevisionId: currentRevisionId,
          migrationId: "migration:api-bound-a",
          targetEnvelope: finalized.json().revision.effectiveSkills.versionEnvelope,
        },
        url: "/characters/retained-private-a/migrations/preview",
      });
      expect(previewResponse.statusCode).toBe(200);
      expect(previewResponse.body).not.toMatch(protectedSourcePattern);
      const preview = previewResponse.json().preview;

      const outsiderApply = await app.inject({
        headers: { cookie: outsiderCookie },
        method: "POST",
        payload: { idempotencyKey: "outsider-apply", preview },
        url: "/characters/retained-private-a/migrations/apply",
      });
      expect(outsiderApply.statusCode).toBe(404);
      expect(outsiderApply.body).not.toMatch(/currentRevisionId|previewDigest|revision|economics/);

      const finalizedB = await app.inject({
        headers: { cookie: ownerCookie },
        method: "POST",
        payload: {
          ...payload,
          build: retainedBuild("retained-private-b"),
          idempotencyKey: "api-private-finalize-b",
        },
        url: "/chargen/headless/finalize",
      });
      expect(finalizedB.statusCode).toBe(200);
      const beforeFailedApplyCount = await prisma.characterRevision.count();

      const routeMismatch = await app.inject({
        headers: { cookie: ownerCookie },
        method: "POST",
        payload: { idempotencyKey: "route-b-plan-a", preview },
        url: "/characters/retained-private-b/migrations/apply",
      });
      expect(routeMismatch.statusCode).toBe(409);
      expect(routeMismatch.json()).toMatchObject({ code: "retained_character_invalid_command" });

      const sourceMismatch = await app.inject({
        headers: { cookie: ownerCookie },
        method: "POST",
        payload: {
          idempotencyKey: "source-b-plan-a",
          preview: {
            ...preview,
            expectedRevisionId: finalizedB.json().revision.characterRevisionId,
          },
        },
        url: "/characters/retained-private-a/migrations/apply",
      });
      expect(sourceMismatch.statusCode).toBe(409);
      expect(sourceMismatch.json()).toMatchObject({ code: "retained_character_stale_revision" });

      const tamperedPlan = await app.inject({
        headers: { cookie: ownerCookie },
        method: "POST",
        payload: {
          idempotencyKey: "tampered-plan-a",
          preview: { ...preview, migrationId: "migration:tampered" },
        },
        url: "/characters/retained-private-a/migrations/apply",
      });
      expect(tamperedPlan.statusCode).toBe(409);
      expect(tamperedPlan.json()).toMatchObject({ code: "retained_character_invalid_command" });
      await expect(prisma.characterRevision.count()).resolves.toBe(beforeFailedApplyCount);

      const applied = await app.inject({
        headers: { cookie: ownerCookie },
        method: "POST",
        payload: { idempotencyKey: "valid-plan-a", preview },
        url: "/characters/retained-private-a/migrations/apply",
      });
      expect(applied.statusCode).toBe(200);
      expect(applied.body).not.toMatch(protectedSourcePattern);
      expect(applied.json().revision.migrationLineage).toMatchObject({
        sourceRevisionId: currentRevisionId,
        status: "migration_applied",
      });

      const rolledBack = await app.inject({
        headers: { cookie: ownerCookie },
        method: "POST",
        payload: {
          expectedRevisionId: applied.json().revision.characterRevisionId,
          idempotencyKey: "valid-rollback-a",
          migrationRevisionId: applied.json().revision.characterRevisionId,
        },
        url: "/characters/retained-private-a/migrations/rollback",
      });
      expect(rolledBack.statusCode).toBe(200);
      expect(rolledBack.body).not.toMatch(protectedSourcePattern);
      expect(rolledBack.json().revision.migrationLineage).toMatchObject({
        rollbackOfRevisionId: applied.json().revision.characterRevisionId,
        sourceRevisionId: currentRevisionId,
        status: "rollback_applied",
      });

      const currentGm = await createTestUser(prisma, {
        email: "private-current-gm-api@example.com",
        roles: ["game_master"],
      });
      const admin = await createTestUser(prisma, {
        email: "private-admin-api@example.com",
        roles: ["admin"],
      });
      const campaign = await createTestCampaign(prisma, currentGm.id);
      await prisma.campaignRosterEntry.create({
        data: {
          campaignId: campaign.id,
          category: "pc",
          sourceId: "retained-private-a",
          sourceType: "character",
        },
      });
      for (const cookie of [await sessionCookie(currentGm.id), await sessionCookie(admin.id)]) {
        const fullProjection = await app.inject({
          headers: { cookie },
          method: "GET",
          url: "/characters/retained-private-a/effective-skills",
        });
        expect(fullProjection.statusCode).toBe(200);
        expect(fullProjection.json().retainedCharacter.provenanceDetail).toBe("full");
        expect(fullProjection.body).toMatch(
          /Night-Entry Crew|Iest Dockside Network|access:iest-contact-copper-latch/,
        );
      }

      const uninvolvedProjection = await app.inject({
        headers: { cookie: outsiderCookie },
        method: "GET",
        url: "/characters/retained-private-a/effective-skills",
      });
      expect(uninvolvedProjection.statusCode).toBe(404);
      expect(uninvolvedProjection.body).not.toMatch(
        /revision|event|ledger|economics|Night-Entry|Iest Dockside|Copper Latch/,
      );
    });
  });
}
