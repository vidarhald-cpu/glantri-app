import type { FastifyInstance } from "fastify";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { encounterSessionSchema } from "@glantri/domain";

import {
  AuthService,
  CharacterEquipmentWriteService,
  EncounterService,
  ScenarioService,
  prisma,
} from "@glantri/database";
import {
  createTestCampaign,
  createTestCharacter,
  createTestUser,
  resetTestDatabase,
} from "@glantri/database/testing";

import { buildApiServer } from "../../app";
import { SESSION_COOKIE_NAME } from "../../lib/sessionAuth";

/**
 * Forgejo #788 — Scenario membership changes and implementation/maintenance
 * events are GM operational state and must not reach player Activity/history
 * automatically.
 *
 * The Product Owner's boundary, restated:
 *   1. participant additions/removals are GM-only by default;
 *   2. they become player-visible only on explicit GM publication/reveal;
 *   3. implementation/maintenance events — equipment reconciliation named
 *      explicitly — are not player history either;
 *   4. the internal audit record is unchanged: audience and presentation only;
 *   5. no invented automatic narrative.
 *
 * Every assertion below reads the **raw HTTP response body** of a
 * player-reachable endpoint under a real player session cookie. Nothing here
 * asserts on rendering: the web `RequireRole` gate is client-only, so a
 * surface can render correctly while its 200 body discloses everything.
 */

const hasTaskApplicationDatabase =
  process.env.GLANTRI_DB_MODE === "task" && Boolean(process.env.DATABASE_URL);
const origin = "http://localhost:3360";

async function sessionCookie(userId: string): Promise<string> {
  const { token } = await new AuthService().createSessionForUser(userId);
  return `${SESSION_COOKIE_NAME}=${token}`;
}

type HistoryRow = { eventKind: string; id: string; summary: string; type: string };
type SessionPayload = { session: { history: HistoryRow[]; viewerMode: string } };

if (!hasTaskApplicationDatabase) {
  describe.skip("Scenario Activity audience (task database not configured)", () => {});
} else {
  describe("Player Activity excludes GM membership and maintenance events (#788)", () => {
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
     * Builds the Product Owner's two cases in one Scenario:
     *  - negative visibility case: a GM-only participant (an NPC the GM added,
     *    in both the explicitly `gm_only` form and the far more common form
     *    that carries no `visibilityOverrides` at all);
     *  - positive navigation case: the player's own Character, in an Encounter
     *    the GM has started, so legitimate player-visible history exists and
     *    over-restriction would be detectable.
     */
    async function seedScenario() {
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

      const scenarioService = new ScenarioService();
      const scenario = await scenarioService.createScenario({
        campaignId: campaign.id,
        name: "The keep",
        status: "live",
      });

      // Positive-case participant: the player's own Character.
      const playerParticipant = await scenarioService.addCharacterParticipant({
        characterId: character.id,
        controlledByUserId: player.id,
        joinSource: "gm_added",
        scenarioId: scenario.id,
      });

      // Negative-case participant A: a GM-added NPC with NO visibility override.
      // This is the default shape — `visibilityOverrides` is optional on
      // `scenarioParticipantSchema` and no writer sets it.
      const openNpc = await scenarioService.addEntityParticipant({
        entityInput: { gmUserId: gm.id, kind: "npc", name: "Watchman Dorn" },
        joinSource: "gm_added",
        role: "npc",
        scenarioId: scenario.id,
      });

      // Negative-case participant C: a second GM-added NPC with no override,
      // kept active so it can legitimately join the live Encounter below.
      const activeNpc = await scenarioService.addEntityParticipant({
        entityInput: { gmUserId: gm.id, kind: "npc", name: "Gate Sergeant Rell" },
        joinSource: "gm_added",
        role: "npc",
        scenarioId: scenario.id,
      });

      // Negative-case participant B: explicitly gm_only.
      const hiddenNpc = await scenarioService.addEntityParticipant({
        entityInput: { gmUserId: gm.id, kind: "npc", name: "Cowled Assassin" },
        joinSource: "gm_added",
        role: "enemy",
        scenarioId: scenario.id,
      });
      await prisma.scenarioParticipant.update({
        data: { visibilityOverridesJson: { visibility: "gm_only" } },
        where: { id: hiddenNpc.id },
      });

      // Membership removal: deactivating the open NPC.
      await scenarioService.updateScenarioParticipantMetadata({
        isActive: false,
        participantId: openNpc.id,
        scenarioId: scenario.id,
      });

      // Implementation/maintenance event: equipment reconciliation on the
      // player's own Character.
      await scenarioService.refreshCharacterParticipantEquipmentSnapshot({
        participantId: playerParticipant.id,
        scenarioId: scenario.id,
      });

      // Positive navigation case: an Encounter the player's Character is in,
      // started by the GM. `encounter_created` and `encounter_started` are
      // objective Scenario facts, not membership changes.
      const encounterService = new EncounterService();
      const draft = await encounterService.createEncounter({
        campaignId: campaign.id,
        scenarioId: scenario.id,
        session: encounterSessionSchema.parse({
          createdAt: "2026-10-26T10:00:00.000Z",
          id: `encounter-${scenario.id}`,
          participantMembershipMode: "explicit",
          participants: [
            {
              id: "encounter-participant-ari",
              label: "Ari",
              participantType: "scenario",
              scenarioParticipantId: playerParticipant.id,
            },
          ],
          scenarioId: scenario.id,
          status: "draft",
          title: "Gatehouse",
          updatedAt: "2026-10-26T10:00:00.000Z",
        }),
      });
      await encounterService.updateEncounter({
        campaignId: campaign.id,
        encounterId: draft.id,
        expectedRevision: draft.updatedAt,
        objectiveEvent: {
          actorUserId: gm.id,
          eventType: "encounter_created",
          summary: `Created encounter ${draft.title}.`,
        },
        scenarioId: scenario.id,
        session: { ...draft, status: "draft" },
      });
      const reread = await encounterService.getEncounterById(draft.id);
      const started = await encounterService.updateEncounter({
        campaignId: campaign.id,
        encounterId: draft.id,
        expectedRevision: reread!.updatedAt,
        objectiveEvent: {
          actorUserId: gm.id,
          eventType: "encounter_started",
          summary: `Started encounter ${draft.title}.`,
        },
        scenarioId: scenario.id,
        session: { ...reread!, status: "active" },
      });

      // A membership change inside the live Encounter.
      const afterStart = await encounterService.getEncounterById(started.id);
      await encounterService.updateEncounter({
        campaignId: campaign.id,
        encounterId: started.id,
        expectedRevision: afterStart!.updatedAt,
        objectiveEvent: {
          actorUserId: gm.id,
          eventType: "encounter_participants_updated",
          summary: `Updated encounter ${draft.title} participants.`,
        },
        scenarioId: scenario.id,
        session: encounterSessionSchema.parse({
          ...afterStart!,
          participants: [
            ...afterStart!.participants,
            {
              id: "encounter-participant-rell",
              label: "Gate Sergeant Rell",
              participantType: "scenario",
              // Deliberately the NPC that carries NO visibility override, so
              // that the row is not suppressed incidentally by the pre-existing
              // excluded-participant filter. Measured at baseline: with the
              // explicitly `gm_only` NPC here the row was already withheld,
              // which would have made the assertion below vacuous.
              scenarioParticipantId: activeNpc.id,
            },
          ],
        }),
      });

      // A Campaign Item the GM has made available to players, so the
      // player-reachable pick-up route can be exercised for a real 200 body
      // rather than an error body that trivially carries no history.
      const equipmentWriteService = new CharacterEquipmentWriteService();
      await equipmentWriteService.ensureCharacterEquipmentInitialized(character.id);
      const seal = await equipmentWriteService.createCampaignEquipmentItem({
        campaignId: campaign.id,
        displayName: "Lost Seal",
        holderCharacterId: null,
        itemFacts: {
          activeMechanics: [],
          descriptiveTraits: [],
          templateOverrides: [],
          unsupportedCapabilities: [],
          version: 1,
        },
        templateId: "weapon-template-dagger",
      });
      const latest = await scenarioService.getScenarioById(scenario.id);
      const prepared = await scenarioService.updateScenarioSessionState({
        actorUserId: gm.id,
        availableObjects: [
          {
            addedAt: "2026-10-26T10:00:00.000Z",
            id: "available-seal",
            sourceId: seal.id,
            sourceKind: "campaign_item",
            visibility: "players",
          },
        ],
        expectedRevision: latest!.updatedAt,
        gmPrivateNotes: "",
        scenarioId: scenario.id,
      });

      return {
        availabilityId: "available-seal",
        encounterId: started.id,
        preparedRevision: prepared.updatedAt,
        gmCookie: await sessionCookie(gm.id),
        activeNpc,
        hiddenNpc,
        openNpc,
        playerCookie: await sessionCookie(player.id),
        playerParticipant,
        scenario,
      };
    }

    async function sessionHistory(cookie: string, scenarioId: string) {
      const response = await app.inject({
        headers: { cookie, origin },
        method: "GET",
        url: `/scenarios/${scenarioId}/session`,
      });
      expect(response.statusCode, response.body).toBe(200);
      const payload = response.json<SessionPayload>();
      return {
        history: payload.session.history,
        raw: response.body,
        viewerMode: payload.session.viewerMode,
      };
    }

    /**
     * Path 1 — `GET /scenarios/:scenarioId/session`. The web player Situation
     * view (`SituationActivity`) and the Scenario detail Session panel
     * (`ScenarioSessionPanel`) both render `session.history` from this body;
     * neither adds a second history model.
     */
    it("withholds membership and maintenance events from the player session body", async () => {
      const { gmCookie, playerCookie, scenario } = await seedScenario();

      const player = await sessionHistory(playerCookie, scenario.id);
      expect(player.viewerMode).toBe("player");

      if (process.env.GLANTRI_788_DUMP) {
        const gmDump = await sessionHistory(gmCookie, scenario.id);
        console.log(
          "#788-CHARACTERIZATION " +
            JSON.stringify(
              {
                gm: gmDump.history.map((e) => [e.type, e.eventKind, e.summary]),
                player: player.history.map((e) => [e.type, e.eventKind, e.summary]),
              },
              null,
              1,
            ),
        );
      }

      const playerTypes = player.history.map((event) => event.type);

      // Requirement 1 and 3 on the raw body.
      expect(playerTypes).not.toContain("participant_added");
      expect(playerTypes).not.toContain("participant_activated");
      expect(playerTypes).not.toContain("participant_deactivated");
      expect(playerTypes).not.toContain("encounter_participants_updated");
      expect(playerTypes).not.toContain("equipment_reconciled");

      // The summary strings those rows carry are unique to the history model,
      // so they are asserted against the WHOLE raw body: if any of them
      // survives anywhere in the 200 — under a different `type`, in a nested
      // object, anywhere — the boundary has not held.
      expect(player.raw).not.toContain("to the scenario");
      expect(player.raw).not.toContain("equipment was reconciled");
      expect(player.raw).not.toContain("in the Scenario.");
      expect(player.raw).not.toContain("Gatehouse participants");

      // Participant NAMES are asserted against the serialized history only,
      // not the whole body. `session.participants` legitimately carries the
      // roster — "Gate Sergeant Rell" is an active NPC with no visibility
      // override, in an Encounter this player is in — and that roster boundary
      // is a separate, pre-existing one (`buildScenarioSessionView`
      // participants filter / `visibilityOverrides`), outside #788's scope.
      // Measured: at baseline the player body contained the name in BOTH the
      // roster and the history; after the repair only the roster.
      const playerHistoryJson = JSON.stringify(player.history);
      expect(playerHistoryJson).not.toContain("Watchman Dorn");
      expect(playerHistoryJson).not.toContain("Gate Sergeant Rell");
      expect(playerHistoryJson).not.toContain("Cowled Assassin");
      expect(playerHistoryJson).not.toContain("Ari");

      // Positive navigation case: legitimate player-visible objective history
      // is still present. Without this the test would also pass for a fix that
      // emptied the list.
      expect(playerTypes).toContain("encounter_started");
      expect(player.raw).toContain("Started encounter Gatehouse.");

      // Requirement 4: the GM audit record is unchanged and complete.
      const gm = await sessionHistory(gmCookie, scenario.id);
      expect(gm.viewerMode).toBe("gm");
      const gmTypes = gm.history.map((event) => event.type);
      expect(gmTypes).toContain("participant_added");
      expect(gmTypes).toContain("participant_deactivated");
      expect(gmTypes).toContain("encounter_participants_updated");
      expect(gmTypes).toContain("equipment_reconciled");
      expect(gm.raw).toContain("Watchman Dorn");
      expect(gm.raw).toContain("Gate Sergeant Rell");
      expect(gm.raw).toContain("Cowled Assassin");
    });

    /**
     * Path 2 — `POST /scenarios/:scenarioId/available-objects/:availabilityId/pick-up`
     * returns a full `buildScenarioSessionView` body on the same player
     * identity. Privacy claims here are per-path, so this sibling is measured
     * separately rather than inferred from Path 1.
     */
    it("withholds the same events from the pick-up response body on the same identity", async () => {
      const { availabilityId, playerCookie, playerParticipant, preparedRevision, scenario } =
        await seedScenario();

      // A real 200 from the sibling route, which returns a full
      // `buildScenarioSessionView` body on the player identity. Privacy claims
      // here are per-path, so this is measured rather than inferred from the
      // GET /session result above.
      const response = await app.inject({
        headers: { cookie: playerCookie, origin },
        method: "POST",
        payload: {
          expectedRevision: preparedRevision,
          requestId: "pickup-788",
          targetParticipantId: playerParticipant.id,
        },
        url: `/scenarios/${scenario.id}/available-objects/${availabilityId}/pick-up`,
      });
      expect(response.statusCode, response.body).toBe(200);

      const history = response.json<SessionPayload>().session.history;
      const types = history.map((event) => event.type);
      expect(types).not.toContain("participant_added");
      expect(types).not.toContain("participant_deactivated");
      expect(types).not.toContain("encounter_participants_updated");
      expect(types).not.toContain("equipment_reconciled");

      expect(response.body).not.toContain("to the scenario");
      expect(response.body).not.toContain("equipment was reconciled");
      expect(response.body).not.toContain("in the Scenario.");
      expect(response.body).not.toContain("Gatehouse participants");

      // Names, scoped to the history for the same reason as above.
      const pickUpHistoryJson = JSON.stringify(history);
      expect(pickUpHistoryJson).not.toContain("Watchman Dorn");
      expect(pickUpHistoryJson).not.toContain("Gate Sergeant Rell");
      expect(pickUpHistoryJson).not.toContain("Cowled Assassin");

      // Control: this body is not simply empty of history.
      expect(types).toContain("encounter_started");
    });

    /**
     * Requirement 2 — publication. There is no GM publication/reveal affordance
     * for a Scenario event log row, so this asserts the only property that can
     * be asserted today: suppression is not conditional on anything a player
     * controls, and no code path turns a suppressed row player-visible.
     */
    it("exposes no player-reachable route that republishes a suppressed row", async () => {
      const { playerCookie, scenario } = await seedScenario();

      const projection = await app.inject({
        headers: { cookie: playerCookie, origin },
        method: "GET",
        url: `/scenarios/${scenario.id}/player-projection`,
      });
      expect(projection.statusCode, projection.body).toBe(200);
      expect(projection.body).not.toContain("to the scenario");
      expect(projection.body).not.toContain("equipment was reconciled");
      expect(projection.body).not.toContain("in the Scenario.");
      expect(projection.body).not.toContain("Cowled Assassin");

      const scenarioRead = await app.inject({
        headers: { cookie: playerCookie, origin },
        method: "GET",
        url: `/scenarios/${scenario.id}`,
      });
      expect(scenarioRead.statusCode, scenarioRead.body).toBe(200);
      expect(scenarioRead.body).not.toContain("equipment was reconciled");
    });
  });
}
