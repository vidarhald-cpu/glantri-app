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
 * Forgejo issue #977 — one GM predicate, and it narrows.
 *
 * Product Owner ruling, 2026-11-06, verbatim:
 *
 * > use the same GM predicate everywhere — Campaign.gmUserId and current game_master role. A
 * > demoted account loses GM exemptions.
 *
 * Independent QA of #803 measured, at head `77dadbef`, that the controller-conflict exemption
 * resolved from `Campaign.gmUserId` **alone**, so two user classes held it without being GMs by
 * any action gate:
 *
 *   - a Campaign owner demoted to `player` through `POST /auth/users/:id/role` self-added three
 *     owned Characters for `[200, 200, 200]`, leaving **3** active controlled rows;
 *   - an `admin`-only Campaign owner added two for `[200, 200]`, leaving **2**.
 *
 * **The decisive evidence here is the refusal.** The fourth case — a Campaign owner who holds
 * `game_master` — is a non-regression control for #803's Alpha case and proves nothing about
 * the narrowing on its own, so it is measured over the same fixture shape as the refusals and
 * never alone.
 *
 * Every arm drives the real routes through `app.inject` and asserts on a real
 * `prisma.scenarioParticipant.count` over exactly the predicate
 * `assertControllerAssignmentAvailable` enforces, because a repair that answered `400` and wrote
 * anyway, or `200` and wrote nothing, would pass a status-only assertion.
 *
 * Each arm also reads `GET /scenarios/:id/my-participant`, which issue #977 recorded as
 * silently returning one of several rows for these classes. With the exemption removed there is
 * at most one row to return, so the single-valued read is no longer under-determined for them;
 * that read itself is unchanged and #806 keeps its scope.
 *
 * These specs are gated on `GLANTRI_DB_MODE === "task"`, which appears in no workflow file
 * (#801), so this file is **local evidence only and runs in no CI**. Run one API integration
 * spec per `vitest` invocation: they share the task database.
 */

const hasTaskApplicationDatabase =
  process.env.GLANTRI_DB_MODE === "task" && Boolean(process.env.DATABASE_URL);
const origin = "http://localhost:3360";

async function sessionCookie(userId: string): Promise<string> {
  const { token } = await new AuthService().createSessionForUser(userId);
  return `${SESSION_COOKIE_NAME}=${token}`;
}

if (!hasTaskApplicationDatabase) {
  describe.skip("#977 GM predicate narrowing (task database not configured)", () => {});
} else {
  describe("The controller exemption requires the game_master role as well as Campaign.gmUserId (#977)", () => {
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

    /**
     * One active Campaign owned by `ownerRoles`, one `live` Scenario, three Characters the owner
     * owns and has rostered, and an ordinary player with two rostered Characters for the control
     * arm. A separate strict `admin` exists only to drive the role route.
     *
     * The owner's three Characters are the same fixture in every arm: only the owner's stored
     * role set differs, which is the single variable the ruling made decisive.
     */
    async function seed(ownerRoles: string[]) {
      const owner = await createTestUser(prisma, { displayName: "Owner", roles: ownerRoles });
      const player = await createTestUser(prisma, { displayName: "Player One" });
      const siteAdmin = await createTestUser(prisma, {
        displayName: "Site Admin",
        roles: ["admin"],
      });
      const campaign = await createTestCampaign(prisma, owner.id, { status: "active" });

      const ownerCharacters = [];
      for (const name of ["Hirelings' Captain", "Caravan Guard", "Temple Scribe"]) {
        ownerCharacters.push(await createTestCharacter(prisma, owner.id, { name }));
      }
      const playerCharacters = [];
      for (const name of ["Ari", "Bryn"]) {
        playerCharacters.push(await createTestCharacter(prisma, player.id, { name }));
      }

      for (const character of [...ownerCharacters, ...playerCharacters]) {
        await prisma.campaignRosterEntry.create({
          data: {
            campaignId: campaign.id,
            category: "pc",
            sourceId: character.id,
            sourceType: "character",
          },
        });
      }

      const scenario = await new ScenarioService().createScenario({
        campaignId: campaign.id,
        name: "The keep",
        status: "live",
      });

      return {
        campaignId: campaign.id,
        owner,
        ownerCharacters,
        ownerCookie: await sessionCookie(owner.id),
        player,
        playerCharacters,
        playerCookie: await sessionCookie(player.id),
        scenarioId: scenario.id,
        siteAdminCookie: await sessionCookie(siteAdmin.id),
      };
    }

    /** `POST /scenarios/:scenarioId/participants/character`, as the given session. */
    const addOwnCharacter = (input: { characterId: string; cookie: string; scenarioId: string }) =>
      app.inject({
        headers: { cookie: input.cookie, origin },
        method: "POST",
        payload: { characterId: input.characterId },
        url: `/scenarios/${input.scenarioId}/participants/character`,
      });

    /** `GET /scenarios/:scenarioId/my-participant`, as the given session. */
    const myParticipant = (input: { cookie: string; scenarioId: string }) =>
      app.inject({
        headers: { cookie: input.cookie, origin },
        method: "GET",
        url: `/scenarios/${input.scenarioId}/my-participant`,
      });

    /**
     * The predicate `assertControllerAssignmentAvailable` enforces: active, controlled
     * `player_character` rows for one user in one Scenario.
     */
    const activeControlledCount = (scenarioId: string, userId: string) =>
      prisma.scenarioParticipant.count({
        where: {
          controlledByUserId: userId,
          isActive: true,
          role: "player_character",
          scenarioId,
        },
      });

    /** Adds each Character in turn and returns the status of every attempt, in order. */
    async function addEachInTurn(input: {
      characters: Array<{ id: string }>;
      cookie: string;
      scenarioId: string;
    }): Promise<number[]> {
      const statusCodes: number[] = [];

      for (const character of input.characters) {
        const response = await addOwnCharacter({
          characterId: character.id,
          cookie: input.cookie,
          scenarioId: input.scenarioId,
        });
        statusCodes.push(response.statusCode);
      }

      return statusCodes;
    }

    it("refuses a Campaign owner demoted to player after the first Character, and writes one row", async () => {
      const fixture = await seed(["game_master"]);

      // The demotion runs through the product's own route, as the measured configuration did.
      // `POST /auth/users/:id/role` replaces the whole role set with the one named role.
      const demotion = await app.inject({
        headers: { cookie: fixture.siteAdminCookie, origin },
        method: "POST",
        payload: { role: "player" },
        url: `/auth/users/${fixture.owner.id}/role`,
      });
      expect(demotion.statusCode, demotion.body).toBe(200);
      expect(demotion.json<{ user: { roles: string[] } }>().user.roles).toEqual(["player"]);

      const statusCodes = await addEachInTurn({
        characters: fixture.ownerCharacters,
        cookie: fixture.ownerCookie,
        scenarioId: fixture.scenarioId,
      });

      expect(statusCodes).toEqual([200, 400, 400]);
      expect(await activeControlledCount(fixture.scenarioId, fixture.owner.id)).toBe(1);

      const read = await myParticipant({
        cookie: fixture.ownerCookie,
        scenarioId: fixture.scenarioId,
      });
      expect(read.statusCode, read.body).toBe(200);
      expect(
        read.json<{ participant: { characterId?: string } | null }>().participant,
      ).toMatchObject({ characterId: fixture.ownerCharacters[0]!.id });
    });

    it("refuses an admin-only Campaign owner after the first Character, and writes one row", async () => {
      const fixture = await seed(["admin"]);

      const statusCodes = await addEachInTurn({
        characters: fixture.ownerCharacters,
        cookie: fixture.ownerCookie,
        scenarioId: fixture.scenarioId,
      });

      expect(statusCodes).toEqual([200, 400, 400]);
      expect(await activeControlledCount(fixture.scenarioId, fixture.owner.id)).toBe(1);

      const read = await myParticipant({
        cookie: fixture.ownerCookie,
        scenarioId: fixture.scenarioId,
      });
      expect(read.statusCode, read.body).toBe(200);
      expect(
        read.json<{ participant: { characterId?: string } | null }>().participant,
      ).toMatchObject({ characterId: fixture.ownerCharacters[0]!.id });
    });

    it("leaves an ordinary player in the same Campaign exactly as before", async () => {
      const fixture = await seed(["game_master"]);

      const statusCodes = await addEachInTurn({
        characters: fixture.playerCharacters,
        cookie: fixture.playerCookie,
        scenarioId: fixture.scenarioId,
      });

      expect(statusCodes).toEqual([200, 400]);
      expect(await activeControlledCount(fixture.scenarioId, fixture.player.id)).toBe(1);

      const read = await myParticipant({
        cookie: fixture.playerCookie,
        scenarioId: fixture.scenarioId,
      });
      expect(read.statusCode, read.body).toBe(200);
      expect(
        read.json<{ participant: { characterId?: string } | null }>().participant,
      ).toMatchObject({ characterId: fixture.playerCharacters[0]!.id });
    });

    it("still admits a Campaign owner who holds game_master for all three Characters (#803)", async () => {
      const fixture = await seed(["game_master"]);

      const statusCodes = await addEachInTurn({
        characters: fixture.ownerCharacters,
        cookie: fixture.ownerCookie,
        scenarioId: fixture.scenarioId,
      });

      expect(statusCodes).toEqual([200, 200, 200]);
      expect(await activeControlledCount(fixture.scenarioId, fixture.owner.id)).toBe(3);

      const read = await myParticipant({
        cookie: fixture.ownerCookie,
        scenarioId: fixture.scenarioId,
      });
      expect(read.statusCode, read.body).toBe(200);
      expect(
        read.json<{ participant: { characterId?: string } | null }>().participant,
      ).not.toBeNull();
    });

    it("still admits a Campaign owner who holds game_master alongside admin", async () => {
      const fixture = await seed(["admin", "game_master"]);

      const statusCodes = await addEachInTurn({
        characters: fixture.ownerCharacters,
        cookie: fixture.ownerCookie,
        scenarioId: fixture.scenarioId,
      });

      expect(statusCodes).toEqual([200, 200, 200]);
      expect(await activeControlledCount(fixture.scenarioId, fixture.owner.id)).toBe(3);
    });

    it("takes the exemption away mid-Scenario without removing the rows already written", async () => {
      const fixture = await seed(["game_master"]);

      const before = await addEachInTurn({
        characters: fixture.ownerCharacters,
        cookie: fixture.ownerCookie,
        scenarioId: fixture.scenarioId,
      });
      expect(before).toEqual([200, 200, 200]);
      expect(await activeControlledCount(fixture.scenarioId, fixture.owner.id)).toBe(3);

      const demotion = await app.inject({
        headers: { cookie: fixture.siteAdminCookie, origin },
        method: "POST",
        payload: { role: "player" },
        url: `/auth/users/${fixture.owner.id}/role`,
      });
      expect(demotion.statusCode, demotion.body).toBe(200);

      // Removing an exemption does not retroactively remove rows. The three controlled
      // participants persist exactly as written, and nothing deletes or deactivates them.
      expect(await activeControlledCount(fixture.scenarioId, fixture.owner.id)).toBe(3);

      // The single-valued player read now picks one of the three it inherited. That
      // under-determination is #806's subject and is unchanged here; what changed is that no
      // further row can be added to the set.
      const read = await myParticipant({
        cookie: fixture.ownerCookie,
        scenarioId: fixture.scenarioId,
      });
      expect(read.statusCode, read.body).toBe(200);
      const inherited = read.json<{ participant: { characterId?: string } | null }>().participant;
      expect(fixture.ownerCharacters.map((character) => character.id)).toContain(
        inherited?.characterId,
      );

      // This 403 does not come from the shared predicate: the route's first statement,
      // requireAdminUser, refuses a player-only account before the predicate is reached.
      // With the ownership-only predicate restored this assertion still passes.
      const gmOnlyRoute = await app.inject({
        headers: { cookie: fixture.ownerCookie, origin },
        method: "PUT",
        payload: { roleTag: "vanguard" },
        url: `/scenarios/${fixture.scenarioId}/participants/${
          (
            await prisma.scenarioParticipant.findFirstOrThrow({
              select: { id: true },
              where: { scenarioId: fixture.scenarioId },
            })
          ).id
        }/metadata`,
      });
      expect(gmOnlyRoute.statusCode).toBe(403);
    });
  });
}
