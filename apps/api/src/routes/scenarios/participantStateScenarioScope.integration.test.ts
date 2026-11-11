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
 * Forgejo issue #1140 (QA finding F1 on #1126, comment 25576). The whole-state body of
 * `PUT /scenarios/:scenarioId/participants/:participantId/state` wrote the participant by id
 * alone. QA measured two consequences:
 *
 *   - a user who is GM of their own live Scenario overwrote a participant in another GM's
 *     Campaign by putting that participant's id in their own Scenario's URL;
 *   - a GM wrote to a participant of a paused Scenario through a live Scenario's URL, which
 *     bypasses the live-update gate.
 *
 * Both must now be answered 404 with nothing written and nothing logged. The stored row is the
 * assertion, not the status alone: its state, its `updatedAt`, and the Scenario event log are
 * read back with real queries. A repair that refused and wrote anyway fails here.
 *
 * The legitimate writes are measured over the same fixture so the repair cannot pass by refusing
 * everything: the GM and the controlling player in their own Scenario, the #1126
 * `combatEffectsChange` body, and the paused gate on the URL's own Scenario.
 *
 * Gated on `GLANTRI_DB_MODE === "task"`, so this is local evidence and runs in no CI (#801). Run
 * it alone: API integration specs share the task database.
 */

const hasTaskApplicationDatabase =
  process.env.GLANTRI_DB_MODE === "task" && Boolean(process.env.DATABASE_URL);
const origin = "http://localhost:3360";
const NOT_FOUND = { error: "Scenario participant not found." };
const MARKER = "#1140 written through another Scenario's URL";

async function sessionCookie(userId: string): Promise<string> {
  const { token } = await new AuthService().createSessionForUser(userId);
  return `${SESSION_COOKIE_NAME}=${token}`;
}

if (!hasTaskApplicationDatabase) {
  describe.skip("#1140 participant state write scope (task database not configured)", () => {});
} else {
  describe("A participant state write reaches only participants of the URL's Scenario (#1140)", () => {
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

    /** `POST /scenarios/:scenarioId/participants/character` as the Campaign's GM. */
    async function addParticipant(input: {
      characterId: string;
      controlledByUserId: string;
      cookie: string;
      scenarioId: string;
    }): Promise<string> {
      const response = await app.inject({
        headers: { cookie: input.cookie, origin },
        method: "POST",
        payload: { characterId: input.characterId, controlledByUserId: input.controlledByUserId },
        url: `/scenarios/${input.scenarioId}/participants/character`,
      });
      expect(response.statusCode, response.body).toBe(200);
      return response.json<{ participant: { id: string } }>().participant.id;
    }

    /**
     * Two Campaigns with different GMs.
     *
     * - Campaign A (GM A): Scenario `aLive` is live and holds the GM's NPC-like Character and the
     *   player's Character; Scenario `aPaused` holds one participant and is then paused.
     * - Campaign B (GM B): Scenario `bLive` is live and holds GM B's own Character.
     *
     * Only users, Campaigns, Characters, roster rows and the pause are seeded directly; every
     * participant is added over HTTP.
     */
    async function seed() {
      const scenarioService = new ScenarioService();
      const gmA = await createTestUser(prisma, { displayName: "GM A", roles: ["game_master"] });
      const gmB = await createTestUser(prisma, { displayName: "GM B", roles: ["game_master"] });
      const player = await createTestUser(prisma, { displayName: "Player of A" });
      const campaignA = await createTestCampaign(prisma, gmA.id, { status: "active" });
      const campaignB = await createTestCampaign(prisma, gmB.id, { status: "active" });
      const guard = await createTestCharacter(prisma, gmA.id, { name: "Caravan Guard" });
      const scout = await createTestCharacter(prisma, gmA.id, { name: "Paused Scout" });
      const ari = await createTestCharacter(prisma, player.id, { name: "Ari" });
      const bandit = await createTestCharacter(prisma, gmB.id, { name: "B's Bandit" });

      for (const [campaignId, character] of [
        [campaignA.id, guard],
        [campaignA.id, scout],
        [campaignA.id, ari],
        [campaignB.id, bandit],
      ] as const) {
        await prisma.campaignRosterEntry.create({
          data: { campaignId, category: "pc", sourceId: character.id, sourceType: "character" },
        });
      }

      const aLive = await scenarioService.createScenario({
        campaignId: campaignA.id,
        name: "A live",
        status: "live",
      });
      const aPaused = await scenarioService.createScenario({
        campaignId: campaignA.id,
        name: "A paused",
        status: "live",
      });
      const bLive = await scenarioService.createScenario({
        campaignId: campaignB.id,
        name: "B live",
        status: "live",
      });
      const gmACookie = await sessionCookie(gmA.id);
      const gmBCookie = await sessionCookie(gmB.id);

      const guardId = await addParticipant({
        characterId: guard.id,
        controlledByUserId: gmA.id,
        cookie: gmACookie,
        scenarioId: aLive.id,
      });
      const ariId = await addParticipant({
        characterId: ari.id,
        controlledByUserId: player.id,
        cookie: gmACookie,
        scenarioId: aLive.id,
      });
      const scoutId = await addParticipant({
        characterId: scout.id,
        controlledByUserId: gmA.id,
        cookie: gmACookie,
        scenarioId: aPaused.id,
      });
      const banditId = await addParticipant({
        characterId: bandit.id,
        controlledByUserId: gmB.id,
        cookie: gmBCookie,
        scenarioId: bLive.id,
      });
      await prisma.scenario.update({ data: { status: "paused" }, where: { id: aPaused.id } });

      return {
        aLiveId: aLive.id,
        aPausedId: aPaused.id,
        ariId,
        banditId,
        bLiveId: bLive.id,
        gmACookie,
        gmBCookie,
        guardId,
        playerCookie: await sessionCookie(player.id),
        scoutId,
      };
    }

    /** The row as stored, and every event logged against it or its Scenario. */
    async function stored(participantId: string) {
      const row = await prisma.scenarioParticipant.findUniqueOrThrow({
        where: { id: participantId },
      });
      return {
        events: await prisma.scenarioEventLog.count({ where: { participantId } }),
        scenarioEvents: await prisma.scenarioEventLog.count({
          where: { scenarioId: row.scenarioId },
        }),
        state: row.stateJson,
        updatedAt: row.updatedAt.toISOString(),
      };
    }

    const putState = (input: {
      body: Record<string, unknown>;
      cookie: string;
      participantId: string;
      scenarioId: string;
    }) =>
      app.inject({
        headers: { cookie: input.cookie, origin },
        method: "PUT",
        payload: input.body,
        url: `/scenarios/${input.scenarioId}/participants/${input.participantId}/state`,
      });

    /** The participant's stored state with the marker written into the declaration notes. */
    async function markedState(participantId: string) {
      const row = await prisma.scenarioParticipant.findUniqueOrThrow({
        where: { id: participantId },
      });
      const state = row.stateJson as { combat: Record<string, unknown> };
      return { ...state, combat: { ...state.combat, lastDeclarationNotes: MARKER } };
    }

    it("refuses a GM writing another GM's Campaign participant through their own live Scenario", async () => {
      const fixture = await seed();
      const before = await stored(fixture.guardId);
      const ownBefore = await stored(fixture.banditId);

      const response = await putState({
        body: { state: await markedState(fixture.guardId) },
        cookie: fixture.gmBCookie,
        participantId: fixture.guardId,
        scenarioId: fixture.bLiveId,
      });

      expect(response.statusCode, response.body).toBe(404);
      expect(response.json()).toEqual(NOT_FOUND);
      expect(await stored(fixture.guardId)).toEqual(before);
      // Nothing is logged in the Scenario whose URL was used either.
      expect(await stored(fixture.banditId)).toEqual(ownBefore);
    });

    it("refuses a GM writing a paused Scenario's participant through a live Scenario's URL", async () => {
      const fixture = await seed();
      const before = await stored(fixture.scoutId);
      const urlScenarioBefore = await stored(fixture.guardId);

      const response = await putState({
        body: { state: await markedState(fixture.scoutId) },
        cookie: fixture.gmACookie,
        participantId: fixture.scoutId,
        scenarioId: fixture.aLiveId,
      });

      expect(response.statusCode, response.body).toBe(404);
      expect(response.json()).toEqual(NOT_FOUND);
      expect(await stored(fixture.scoutId)).toEqual(before);
      expect(await stored(fixture.guardId)).toEqual(urlScenarioBefore);
    });

    it("keeps the paused gate on the URL's own Scenario, before the participant is looked at", async () => {
      const fixture = await seed();
      const before = await stored(fixture.scoutId);

      const response = await putState({
        body: { state: await markedState(fixture.scoutId) },
        cookie: fixture.gmACookie,
        participantId: fixture.scoutId,
        scenarioId: fixture.aPausedId,
      });

      expect(response.statusCode, response.body).toBe(403);
      expect(response.json()).toEqual({
        error: "Scenario is not currently open for live updates.",
      });
      expect(await stored(fixture.scoutId)).toEqual(before);
    });

    it("still writes the GM's whole state to a participant of the GM's own Scenario, and logs it", async () => {
      const fixture = await seed();
      const before = await stored(fixture.guardId);

      const response = await putState({
        body: { state: await markedState(fixture.guardId) },
        cookie: fixture.gmACookie,
        participantId: fixture.guardId,
        scenarioId: fixture.aLiveId,
      });

      expect(response.statusCode, response.body).toBe(200);
      const after = await stored(fixture.guardId);
      expect(
        (after.state as { combat: { lastDeclarationNotes?: string } }).combat.lastDeclarationNotes,
      ).toBe(MARKER);
      expect(after.updatedAt).not.toBe(before.updatedAt);
      expect(after.events).toBe(before.events + 1);
    });

    it("still writes the controlling player's state in their own Scenario", async () => {
      const fixture = await seed();
      const received = await app.inject({
        headers: { cookie: fixture.playerCookie, origin },
        method: "GET",
        url: `/scenarios/${fixture.aLiveId}/my-participant`,
      });
      expect(received.statusCode, received.body).toBe(200);
      const state = received.json<{
        participant: { state: { combat: Record<string, unknown> } };
      }>().participant.state;
      const before = await stored(fixture.ariId);

      const response = await putState({
        body: { state: { ...state, combat: { ...state.combat, lastDeclarationNotes: MARKER } } },
        cookie: fixture.playerCookie,
        participantId: fixture.ariId,
        scenarioId: fixture.aLiveId,
      });

      expect(response.statusCode, response.body).toBe(200);
      const after = await stored(fixture.ariId);
      expect(
        (after.state as { combat: { lastDeclarationNotes?: string } }).combat.lastDeclarationNotes,
      ).toBe(MARKER);
      expect(after.events).toBe(before.events + 1);
    });

    it("leaves a player's refusal for a participant they do not control as it was", async () => {
      const fixture = await seed();
      const before = await stored(fixture.guardId);

      const response = await putState({
        body: { state: await markedState(fixture.guardId) },
        cookie: fixture.playerCookie,
        participantId: fixture.guardId,
        scenarioId: fixture.aLiveId,
      });

      expect(response.statusCode, response.body).toBe(403);
      expect(response.json()).toEqual({ error: "Access denied." });
      expect(await stored(fixture.guardId)).toEqual(before);
    });

    it("leaves the #1126 combat-effects change as it was: written in scope, refused out of it", async () => {
      const fixture = await seed();
      const change = { effectId: "effect-absent", kind: "remove_effect" };
      const outsideBefore = await stored(fixture.scoutId);
      const insideBefore = await stored(fixture.guardId);

      const outside = await putState({
        body: { combatEffectsChange: change },
        cookie: fixture.gmACookie,
        participantId: fixture.scoutId,
        scenarioId: fixture.aLiveId,
      });
      const inside = await putState({
        body: { combatEffectsChange: change },
        cookie: fixture.gmACookie,
        participantId: fixture.guardId,
        scenarioId: fixture.aLiveId,
      });

      expect(outside.statusCode, outside.body).toBe(400);
      expect(outside.json()).toEqual(NOT_FOUND);
      expect(await stored(fixture.scoutId)).toEqual(outsideBefore);
      expect(inside.statusCode, inside.body).toBe(200);
      expect((await stored(fixture.guardId)).events).toBe(insideBefore.events + 1);
    });
  });
}
