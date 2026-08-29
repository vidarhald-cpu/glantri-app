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
        characterRevisionId: first.json().revision.id,
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
        directAcquisition: 0,
        effectiveLevel: 6,
        publicExplanation: "Competence acquired through prior experience",
        strongestHistoryContribution: 0,
      });
    });
  });
}
