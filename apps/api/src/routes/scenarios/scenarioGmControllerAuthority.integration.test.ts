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
 * Forgejo issue #803 — the one-controlled-Character invariant must not limit GM authority.
 *
 * Product Owner ruling, issue #786 comment 18040, verbatim:
 *
 * > The one-controlled-Character invariant applies only to player-controlled PC assignments.
 * > It does not limit GM authority: the GM may control multiple Characters/participants in the
 * > same Scenario.
 *
 * The defect was observed as an **HTTP 400** on a real GM walk, so this spec drives the real
 * routes (`POST /scenarios/:id/participants/character`, `PUT /scenarios/:id/participants/:pid/
 * metadata`) through `app.inject` rather than calling the service helper, and reads the end
 * state back with a real `prisma.scenarioParticipant.count` on exactly the predicate the
 * invariant enforces.
 *
 * Both directions are measured over one fixture:
 *
 *   - the GM is admitted for a **second and a third** controlled `player_character`;
 *   - a player is still refused a second one, through the player's own self-add route **and**
 *     through the GM assigning that player as a second Character's controller.
 *
 * The counts are the assertion, not the status codes alone: a repair that returned 200 and
 * wrote nothing, or that refused and wrote anyway, fails here.
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
  describe.skip("#803 GM controller authority (task database not configured)", () => {});
} else {
  describe("The controller invariant limits players and not the GM, over the real routes (#803)", () => {
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
     * One active Campaign, one `live` Scenario, and five rostered `player_character`
     * Characters: three the GM will run, and two owned by one player so the player side of the
     * invariant has a genuine second Character to be refused.
     *
     * Only the Campaign, Scenario, Characters and roster are seeded directly. Every
     * controller assignment under test is written over HTTP.
     */
    async function seed() {
      const gm = await createTestUser(prisma, { displayName: "GM", roles: ["game_master"] });
      const player = await createTestUser(prisma, { displayName: "Player One" });
      const campaign = await createTestCampaign(prisma, gm.id, { status: "active" });

      const gmRun = [];
      for (const name of ["Hirelings' Captain", "Caravan Guard", "Temple Scribe"]) {
        gmRun.push(await createTestCharacter(prisma, gm.id, { name }));
      }
      const playerOwned = [];
      for (const name of ["Ari", "Bryn"]) {
        playerOwned.push(await createTestCharacter(prisma, player.id, { name }));
      }

      for (const character of [...gmRun, ...playerOwned]) {
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
        gm,
        gmCookie: await sessionCookie(gm.id),
        gmRun,
        player,
        playerCookie: await sessionCookie(player.id),
        playerOwned,
        scenarioId: scenario.id,
      };
    }

    /** `POST /scenarios/:scenarioId/participants/character`, as the given session. */
    const addCharacterParticipant = (input: {
      characterId: string;
      controlledByUserId?: string;
      cookie: string;
      scenarioId: string;
    }) =>
      app.inject({
        headers: { cookie: input.cookie, origin },
        method: "POST",
        payload:
          input.controlledByUserId === undefined
            ? { characterId: input.characterId }
            : { characterId: input.characterId, controlledByUserId: input.controlledByUserId },
        url: `/scenarios/${input.scenarioId}/participants/character`,
      });

    /** `PUT /scenarios/:scenarioId/participants/:participantId/metadata`, as the GM. */
    const assignController = (input: {
      controlledByUserId: string;
      cookie: string;
      participantId: string;
      scenarioId: string;
    }) =>
      app.inject({
        headers: { cookie: input.cookie, origin },
        method: "PUT",
        payload: { controlledByUserId: input.controlledByUserId },
        url: `/scenarios/${input.scenarioId}/participants/${input.participantId}/metadata`,
      });

    /**
     * A real count on exactly the predicate `assertControllerAssignmentAvailable` enforces:
     * active, controlled `player_character` rows for one user in one Scenario.
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

    it("admits the GM as controller of a second and a third Character in one Scenario", async () => {
      const fixture = await seed();
      const statusCodes: number[] = [];

      for (const character of fixture.gmRun) {
        const response = await addCharacterParticipant({
          characterId: character.id,
          controlledByUserId: fixture.gm.id,
          cookie: fixture.gmCookie,
          scenarioId: fixture.scenarioId,
        });
        statusCodes.push(response.statusCode);
        expect(response.statusCode, response.body).toBe(200);
        expect(response.json<{ participant: { controlledByUserId?: string } }>()).toMatchObject({
          participant: { controlledByUserId: fixture.gm.id },
        });
      }

      expect(statusCodes).toEqual([200, 200, 200]);
      expect(await activeControlledCount(fixture.scenarioId, fixture.gm.id)).toBe(3);
    });

    it("still refuses a player's second controlled Character on the player's own add route", async () => {
      const fixture = await seed();
      const [ari, bryn] = fixture.playerOwned;

      const first = await addCharacterParticipant({
        characterId: ari!.id,
        cookie: fixture.playerCookie,
        scenarioId: fixture.scenarioId,
      });
      expect(first.statusCode, first.body).toBe(200);
      expect(await activeControlledCount(fixture.scenarioId, fixture.player.id)).toBe(1);

      const second = await addCharacterParticipant({
        characterId: bryn!.id,
        cookie: fixture.playerCookie,
        scenarioId: fixture.scenarioId,
      });

      expect(second.statusCode).toBe(400);
      expect(second.json<{ error: string }>().error).toContain(
        "already the active controlled character",
      );
      expect(await activeControlledCount(fixture.scenarioId, fixture.player.id)).toBe(1);
    });

    it("still refuses the GM assigning one player as a second Character's controller", async () => {
      const fixture = await seed();
      const [ari, bryn] = fixture.playerOwned;

      const firstAdd = await addCharacterParticipant({
        characterId: ari!.id,
        controlledByUserId: fixture.player.id,
        cookie: fixture.gmCookie,
        scenarioId: fixture.scenarioId,
      });
      expect(firstAdd.statusCode, firstAdd.body).toBe(200);

      // The GM add route derives the GM as controller when none is sent, so this second
      // participant starts under the GM and is then reassigned to the player.
      const secondAdd = await addCharacterParticipant({
        characterId: bryn!.id,
        cookie: fixture.gmCookie,
        scenarioId: fixture.scenarioId,
      });
      expect(secondAdd.statusCode, secondAdd.body).toBe(200);
      const secondParticipantId = secondAdd.json<{ participant: { id: string } }>().participant.id;

      const reassign = await assignController({
        controlledByUserId: fixture.player.id,
        cookie: fixture.gmCookie,
        participantId: secondParticipantId,
        scenarioId: fixture.scenarioId,
      });

      expect(reassign.statusCode).toBe(400);
      expect(reassign.json<{ error: string }>().error).toContain(
        "already the active controlled character",
      );
      expect(await activeControlledCount(fixture.scenarioId, fixture.player.id)).toBe(1);
    });

    it("holds both directions at once in one Scenario", async () => {
      const fixture = await seed();
      const [ari, bryn] = fixture.playerOwned;

      for (const character of fixture.gmRun) {
        const response = await addCharacterParticipant({
          characterId: character.id,
          controlledByUserId: fixture.gm.id,
          cookie: fixture.gmCookie,
          scenarioId: fixture.scenarioId,
        });
        expect(response.statusCode, response.body).toBe(200);
      }
      const playerFirst = await addCharacterParticipant({
        characterId: ari!.id,
        cookie: fixture.playerCookie,
        scenarioId: fixture.scenarioId,
      });
      expect(playerFirst.statusCode, playerFirst.body).toBe(200);

      const playerSecond = await addCharacterParticipant({
        characterId: bryn!.id,
        cookie: fixture.playerCookie,
        scenarioId: fixture.scenarioId,
      });

      expect(playerSecond.statusCode).toBe(400);
      expect(await activeControlledCount(fixture.scenarioId, fixture.gm.id)).toBe(3);
      expect(await activeControlledCount(fixture.scenarioId, fixture.player.id)).toBe(1);
    });
  });
}
