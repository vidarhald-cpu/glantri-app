import type { FastifyInstance } from "fastify";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  encounterSessionSchema,
  initializeCombatRoundState,
  type EncounterSession,
} from "@glantri/domain";
import { updateRoleplayVisibility } from "@glantri/rules-engine";

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
 * Forgejo #798 tranche A — a participant the GM has explicitly hidden must not
 * be inferable through the player-facing surface.
 *
 * Product Owner rulings this spec encodes:
 *   D1 visibility is per viewer, taken from the Encounter/session visibility
 *      state the GM UI writes, not collapsed into flat `visibilityOverrides`;
 *   D2 hidden means no identity and no presence leak — no name, id,
 *      placeholder, count or ordinal signal;
 *   D3 an empty visibility matrix still means visible by default; #798 fixes
 *      only an explicit GM hide.
 *
 * Method, per the ruling that the regression must "structurally diff full
 * serialized player output for visible vs hidden state, not just search for
 * name/id": every case reads the **raw HTTP body** of a player-reachable route
 * twice over **one fixture** — once with the GM's hide written through the GM's
 * own control path, once with it cleared — and diffs the two bodies
 * structurally. One fixture rather than two Scenarios removes the fixture
 * confound the characterization recorded (distinct Characters, names and
 * orderings produced differences that were not channels).
 *
 * Each case also carries its control: the visible read is asserted to contain
 * the name and the id, so the instrument is shown capable of reporting dirty
 * through that exact field. A clean result from an instrument never shown
 * capable of failing is worth nothing here.
 *
 * These specs are gated on `GLANTRI_DB_MODE === "task"`, which appears in no
 * workflow file (#801), so this file is **local evidence only and runs in no
 * CI**. Run one API integration spec per `vitest` invocation: they share the
 * task database.
 */

const hasTaskApplicationDatabase =
  process.env.GLANTRI_DB_MODE === "task" && Boolean(process.env.DATABASE_URL);
const origin = "http://localhost:3360";
/** Resolved from the repository root, which is `vitest`'s cwd here. */
const ROUTE_SOURCE_PATH = "apps/api/src/routes/scenarios/encounterRoutes.ts";

async function sessionCookie(userId: string): Promise<string> {
  const { token } = await new AuthService().createSessionForUser(userId);
  return `${SESSION_COOKIE_NAME}=${token}`;
}

interface SessionParticipant {
  displayName: string;
  id: string;
  presence: { encounterId?: string; encounterName?: string; kind: string };
}
interface SessionPayload {
  session: {
    history: { actorParticipantId?: string; id: string; summary: string; type: string }[];
    participants: SessionParticipant[];
  };
}

/** A structural difference between two serialized bodies, by JSON path. */
interface StructuralDifference {
  path: string;
  visible: unknown;
  hidden: unknown;
}

/**
 * Walks both bodies and reports every differing path, including array length
 * changes. Four of the measured channels are invisible to a name search and
 * two to an id search as well, because the leak is an array length or an
 * arithmetic gap, so the diff is structural rather than textual.
 */
function structuralDifferences(
  visible: unknown,
  hidden: unknown,
  path = "$",
): StructuralDifference[] {
  if (Array.isArray(visible) && Array.isArray(hidden)) {
    const differences: StructuralDifference[] = [];
    if (visible.length !== hidden.length) {
      differences.push({ hidden: hidden.length, path: `${path}.length`, visible: visible.length });
    }
    for (let index = 0; index < Math.max(visible.length, hidden.length); index += 1) {
      differences.push(
        ...structuralDifferences(visible[index], hidden[index], `${path}[${index}]`),
      );
    }
    return differences;
  }
  const bothObjects =
    visible !== null &&
    hidden !== null &&
    typeof visible === "object" &&
    typeof hidden === "object" &&
    !Array.isArray(visible) &&
    !Array.isArray(hidden);
  if (bothObjects) {
    const keys = [
      ...new Set([
        ...Object.keys(visible as Record<string, unknown>),
        ...Object.keys(hidden as Record<string, unknown>),
      ]),
    ];
    return keys.flatMap((key) =>
      structuralDifferences(
        (visible as Record<string, unknown>)[key],
        (hidden as Record<string, unknown>)[key],
        `${path}.${key}`,
      ),
    );
  }
  if (JSON.stringify(visible) === JSON.stringify(hidden)) return [];
  return [{ hidden, path, visible }];
}

/** Paths that move for reasons other than visibility and are excluded by name. */
const NOISE_PATHS = [/\.updatedAt$/, /^\$\.session\.revision$/, /\.revision$/, /\.occurredAt$/];
const withoutNoise = (differences: StructuralDifference[]) =>
  differences.filter((difference) => !NOISE_PATHS.some((pattern) => pattern.test(difference.path)));

if (!hasTaskApplicationDatabase) {
  describe.skip("#798 participant disclosure (task database not configured)", () => {});
} else {
  describe("A GM-hidden participant is not inferable through the player surface (#798)", () => {
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
     * One Scenario, two Encounters, two players.
     *
     *  - Gatehouse (active, explicit): Ari (player 1), Gate Sergeant Rell
     *    (visible NPC) and Lurking Shade (the participant the GM hides);
     *  - Cellar (active, explicit): Bryn (player 2) only, so Bryn shares no
     *    Encounter with Shade and the cross-Encounter boundary is measurable;
     *  - Watchman Dorn: a Scenario-level NPC in no Encounter, which must keep
     *    appearing or the Situation rail empties.
     *
     * Encounter participant ids use the production shape
     * `scenario-${ScenarioParticipant.id}`, which is what the web writes. A
     * fixture with synthetic ids hides real leaks.
     */
    async function seed(names?: { hiddenNpc?: string; playerTwo?: string; visibleNpc?: string }) {
      // #798 F1. The display names are parameters because the defect is a
      // property of the *name*, not of the participant: a short name is a
      // substring of ordinary English in the production summary templates.
      const hiddenNpcName = names?.hiddenNpc ?? "Lurking Shade";
      const playerTwoName = names?.playerTwo ?? "Bryn";
      const visibleNpcName = names?.visibleNpc ?? "Gate Sergeant Rell";
      const gm = await createTestUser(prisma, { displayName: "GM", roles: ["game_master"] });
      const playerOne = await createTestUser(prisma, { displayName: "Player One" });
      const playerTwo = await createTestUser(prisma, { displayName: "Player Two" });
      const campaign = await createTestCampaign(prisma, gm.id, { status: "active" });
      const ariCharacter = await createTestCharacter(prisma, playerOne.id, { name: "Ari" });
      const brynCharacter = await createTestCharacter(prisma, playerTwo.id, {
        name: playerTwoName,
      });
      for (const sourceId of [ariCharacter.id, brynCharacter.id]) {
        await prisma.campaignRosterEntry.create({
          data: { campaignId: campaign.id, category: "pc", sourceId, sourceType: "character" },
        });
      }

      const scenarioService = new ScenarioService();
      const scenario = await scenarioService.createScenario({
        campaignId: campaign.id,
        name: "The keep",
        status: "live",
      });
      const ari = await scenarioService.addCharacterParticipant({
        characterId: ariCharacter.id,
        controlledByUserId: playerOne.id,
        joinSource: "gm_added",
        scenarioId: scenario.id,
      });
      const bryn = await scenarioService.addCharacterParticipant({
        characterId: brynCharacter.id,
        controlledByUserId: playerTwo.id,
        joinSource: "gm_added",
        scenarioId: scenario.id,
      });
      const rell = await scenarioService.addEntityParticipant({
        entityInput: { gmUserId: gm.id, kind: "npc", name: visibleNpcName },
        joinSource: "gm_added",
        role: "npc",
        scenarioId: scenario.id,
      });
      const shade = await scenarioService.addEntityParticipant({
        entityInput: { gmUserId: gm.id, kind: "npc", name: hiddenNpcName },
        joinSource: "gm_added",
        role: "enemy",
        scenarioId: scenario.id,
      });
      const dorn = await scenarioService.addEntityParticipant({
        entityInput: { gmUserId: gm.id, kind: "npc", name: "Watchman Dorn" },
        joinSource: "gm_added",
        role: "npc",
        scenarioId: scenario.id,
      });

      const encounterService = new EncounterService();
      const makeEncounter = async (input: {
        id: string;
        participantIds: string[];
        title: string;
      }) => {
        const draft = await encounterService.createEncounter({
          campaignId: campaign.id,
          scenarioId: scenario.id,
          session: encounterSessionSchema.parse({
            createdAt: "2026-10-26T10:00:00.000Z",
            id: input.id,
            participantMembershipMode: "explicit",
            participants: input.participantIds.map((scenarioParticipantId, order) => ({
              id: `scenario-${scenarioParticipantId}`,
              label: scenarioParticipantId,
              order,
              participantType: "scenario",
              scenarioParticipantId,
            })),
            scenarioId: scenario.id,
            status: "draft",
            title: input.title,
            updatedAt: "2026-10-26T10:00:00.000Z",
          }),
        });
        const reread = await encounterService.getEncounterById(draft.id);
        await encounterService.updateEncounter({
          campaignId: campaign.id,
          encounterId: draft.id,
          expectedRevision: reread!.updatedAt,
          objectiveEvent: {
            actorUserId: gm.id,
            eventType: "encounter_started",
            summary: `Started encounter ${input.title}.`,
          },
          scenarioId: scenario.id,
          session: { ...reread!, status: "active" },
        });
        return draft.id;
      };

      const gatehouseId = await makeEncounter({
        id: `encounter-gatehouse-${scenario.id}`,
        participantIds: [ari.id, rell.id, shade.id],
        title: "Gatehouse",
      });
      const cellarId = await makeEncounter({
        id: `encounter-cellar-${scenario.id}`,
        participantIds: [bryn.id],
        title: "Cellar",
      });

      // A Campaign Item made available, so the player-initiated pick-up POST —
      // a second delivery path for the same projection — returns a real 200.
      const equipmentWriteService = new CharacterEquipmentWriteService();
      await equipmentWriteService.ensureCharacterEquipmentInitialized(ariCharacter.id);
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
      await scenarioService.updateScenarioSessionState({
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
        ari,
        bryn,
        campaignId: campaign.id,
        cellarId,
        dorn,
        gatehouseId,
        gmCookie: await sessionCookie(gm.id),
        gmUserId: gm.id,
        hiddenNpcName,
        playerOneCookie: await sessionCookie(playerOne.id),
        playerTwoCookie: await sessionCookie(playerTwo.id),
        playerTwoName,
        rell,
        scenario,
        shade,
        visibleNpcName,
      };
    }

    const get = async (cookie: string, url: string) =>
      app.inject({ headers: { cookie, origin }, method: "GET", url });

    /**
     * Writes the GM's hide through the GM's own control chain:
     * `RoleplayEncounterScreens` → `updateRoleplayVisibility` →
     * `PUT /encounters/:id`. Nothing here writes `visibilityOverrides`, which
     * is the store no production path can write (ruling D1).
     */
    async function setVisibility(input: {
      encounterId: string;
      gmCookie: string;
      targetParticipantId: string;
      viewerParticipantId: string;
      visible: boolean;
    }) {
      const read = await get(input.gmCookie, `/encounters/${input.encounterId}`);
      expect(read.statusCode, read.body).toBe(200);
      const session = read.json<{ encounter: EncounterSession }>().encounter;
      const next = updateRoleplayVisibility({
        session,
        targetParticipantId: `scenario-${input.targetParticipantId}`,
        viewerParticipantId: `scenario-${input.viewerParticipantId}`,
        visible: input.visible,
      });
      const write = await app.inject({
        headers: { cookie: input.gmCookie, origin },
        method: "PUT",
        payload: { expectedRevision: session.updatedAt, session: next },
        url: `/encounters/${input.encounterId}`,
      });
      expect(write.statusCode, write.body).toBe(200);
      return write.json<{ encounter: EncounterSession }>().encounter;
    }

    async function setEncounterStatus(input: {
      encounterId: string;
      gmCookie: string;
      status: EncounterSession["status"];
    }) {
      const read = await get(input.gmCookie, `/encounters/${input.encounterId}`);
      expect(read.statusCode, read.body).toBe(200);
      const session = read.json<{ encounter: EncounterSession }>().encounter;
      const write = await app.inject({
        headers: { cookie: input.gmCookie, origin },
        method: "PUT",
        payload: {
          expectedRevision: session.updatedAt,
          session: { ...session, status: input.status },
        },
        url: `/encounters/${input.encounterId}`,
      });
      expect(write.statusCode, write.body).toBe(200);
    }

    /**
     * L1 + the differential method itself. The two reads differ only in the
     * boolean the GM wrote, so every structural difference between them is
     * attributable to the hide.
     */
    it("L1 — removes the hidden participant from session.participants, and nothing else moves", async () => {
      const fixture = await seed();
      const url = `/scenarios/${fixture.scenario.id}/session`;

      await setVisibility({
        encounterId: fixture.gatehouseId,
        gmCookie: fixture.gmCookie,
        targetParticipantId: fixture.rell.id,
        viewerParticipantId: fixture.ari.id,
        visible: true,
      });
      await setVisibility({
        encounterId: fixture.gatehouseId,
        gmCookie: fixture.gmCookie,
        targetParticipantId: fixture.shade.id,
        viewerParticipantId: fixture.ari.id,
        visible: true,
      });
      const visible = await get(fixture.playerOneCookie, url);
      expect(visible.statusCode, visible.body).toBe(200);

      // CONTROL: with the hide cleared the instrument sees the name, the
      // ScenarioParticipant id and the Encounter alias in this exact body.
      expect(visible.body).toContain("Lurking Shade");
      expect(visible.body).toContain(fixture.shade.id);
      const visibleParticipants = visible.json<SessionPayload>().session.participants;
      expect(visibleParticipants.map((entry) => entry.displayName).sort()).toEqual([
        "Ari",
        "Gate Sergeant Rell",
        "Lurking Shade",
        "Watchman Dorn",
      ]);

      await setVisibility({
        encounterId: fixture.gatehouseId,
        gmCookie: fixture.gmCookie,
        targetParticipantId: fixture.shade.id,
        viewerParticipantId: fixture.ari.id,
        visible: false,
      });
      const hidden = await get(fixture.playerOneCookie, url);
      expect(hidden.statusCode, hidden.body).toBe(200);

      // MEASUREMENT: no name, no id, no alias, anywhere in the body (D2).
      expect(hidden.body).not.toContain("Lurking Shade");
      expect(hidden.body).not.toContain(fixture.shade.id);

      const differences = withoutNoise(structuralDifferences(visible.json(), hidden.json()));
      const paths = differences.map((difference) => difference.path);

      // The entire structural delta is confined to the roster. Removing an
      // element shifts the elements after it, so the delta is stated as the
      // region it touches plus the exact set difference, not by index.
      expect(paths.filter((path) => !path.startsWith("$.session.participants"))).toEqual([]);
      expect(
        differences.find((difference) => difference.path === "$.session.participants.length"),
      ).toEqual({ hidden: 3, path: "$.session.participants.length", visible: 4 });
      const hiddenParticipantsPayload = hidden.json<SessionPayload>().session.participants;
      const removed = visibleParticipants.filter(
        (entry) => !hiddenParticipantsPayload.some((candidate) => candidate.id === entry.id),
      );
      expect(removed.map((entry) => entry.displayName)).toEqual(["Lurking Shade"]);
      expect(removed[0]?.presence).toEqual({
        encounterId: fixture.gatehouseId,
        encounterName: "Gatehouse",
        kind: "encounter",
      });

      // The player's legitimate Activity is unchanged. Measured consequence,
      // recorded because it was not obvious: the `encounter_started` row for an
      // Encounter the player is in carries every member in its never-emitted
      // `audienceParticipantIds`, and scanning that field for identity
      // suppressed the row for the viewer who was in its own audience.
      expect(paths).not.toContain("$.session.history.length");

      // Regressions the characterization named explicitly.
      const hiddenParticipants = hidden.json<SessionPayload>().session.participants;
      expect(hiddenParticipants.map((entry) => entry.displayName).sort()).toEqual([
        "Ari",
        "Gate Sergeant Rell",
        "Watchman Dorn",
      ]);
      // The viewer's own participant survives, with its Encounter presence.
      expect(hiddenParticipants.find((entry) => entry.displayName === "Ari")?.presence).toEqual({
        encounterId: fixture.gatehouseId,
        encounterName: "Gatehouse",
        kind: "encounter",
      });
      // A Scenario-level participant in no Encounter survives.
      expect(
        hiddenParticipants.find((entry) => entry.displayName === "Watchman Dorn")?.presence,
      ).toEqual({ kind: "scenario" });
    });

    /**
     * L1 second delivery path. `POST …/pick-up` returns a full
     * `buildScenarioSessionView`, so it re-delivers the same projection on a
     * player-initiated POST. Privacy claims are per path, so this is measured
     * rather than inferred.
     */
    it("L1 — closes the pick-up POST body, which re-delivers the same projection", async () => {
      const fixture = await seed();
      const pickUp = async (requestId: string) => {
        const scenarioRead = await get(
          fixture.gmCookie,
          `/scenarios/${fixture.scenario.id}/session`,
        );
        const revision = scenarioRead.json<{ session: { revision: string } }>().session.revision;
        return app.inject({
          headers: { cookie: fixture.playerOneCookie, origin },
          method: "POST",
          payload: {
            expectedRevision: revision,
            requestId,
            targetParticipantId: fixture.ari.id,
          },
          url: `/scenarios/${fixture.scenario.id}/available-objects/available-seal/pick-up`,
        });
      };

      // One requestId for both calls: the second is idempotent and still
      // returns a freshly built session view, so the two reads differ only in
      // the GM's hide rather than in whether the Item was still available.
      // The GM marks the visible NPC visible first, so this case isolates the
      // Shade hide. Without it the matrix becomes non-empty with no `true` for
      // Rell, and Rell is withheld too — the characterized consequence of
      // reusing the honoured resolver, measured separately.
      for (const target of [fixture.rell.id, fixture.shade.id]) {
        await setVisibility({
          encounterId: fixture.gatehouseId,
          gmCookie: fixture.gmCookie,
          targetParticipantId: target,
          viewerParticipantId: fixture.ari.id,
          visible: true,
        });
      }
      const visible = await pickUp("pickup-798");
      expect(visible.statusCode, visible.body).toBe(200);
      // CONTROL.
      expect(visible.body).toContain("Lurking Shade");
      expect(visible.body).toContain(fixture.shade.id);

      await setVisibility({
        encounterId: fixture.gatehouseId,
        gmCookie: fixture.gmCookie,
        targetParticipantId: fixture.shade.id,
        viewerParticipantId: fixture.ari.id,
        visible: false,
      });
      const hidden = await pickUp("pickup-798");
      expect(hidden.statusCode, hidden.body).toBe(200);

      expect(hidden.body).not.toContain("Lurking Shade");
      expect(hidden.body).not.toContain(fixture.shade.id);
      const participants = hidden.json<SessionPayload>().session.participants;
      // Control that the body is a real session view, not an error shell, and
      // that exactly the hidden participant is missing from it.
      expect(participants.map((entry) => entry.displayName).sort()).toEqual([
        "Ari",
        "Gate Sergeant Rell",
        "Watchman Dorn",
      ]);
      expect(visible.json<SessionPayload>().session.participants).toHaveLength(4);
    });

    /**
     * L2 — `/player-projection`. Two leaks on one route: the GM's hide, and the
     * whole-Scenario roster shipped to a player who shares no Encounter with
     * those participants.
     */
    it("L2 — scopes /player-projection to the viewer, and renames the mode that described the old behaviour", async () => {
      const fixture = await seed();
      const url = `/scenarios/${fixture.scenario.id}/player-projection`;

      const visible = await get(fixture.playerOneCookie, url);
      expect(visible.statusCode, visible.body).toBe(200);
      // CONTROL.
      expect(visible.body).toContain("Lurking Shade");
      expect(visible.body).toContain(fixture.shade.id);

      await setVisibility({
        encounterId: fixture.gatehouseId,
        gmCookie: fixture.gmCookie,
        targetParticipantId: fixture.shade.id,
        viewerParticipantId: fixture.ari.id,
        visible: false,
      });
      const hidden = await get(fixture.playerOneCookie, url);
      expect(hidden.statusCode, hidden.body).toBe(200);
      expect(hidden.body).not.toContain("Lurking Shade");
      expect(hidden.body).not.toContain(fixture.shade.id);

      const differences = withoutNoise(structuralDifferences(visible.json(), hidden.json()));
      expect(
        differences.find(
          (difference) => difference.path === "$.projection.visibleParticipants.length",
        ),
      ).toBeDefined();

      // The cross-Encounter half: player two is in the Cellar only, shares no
      // Encounter with Shade or Rell, and is in no visibility row at all.
      const playerTwoBody = await get(fixture.playerTwoCookie, url);
      expect(playerTwoBody.statusCode, playerTwoBody.body).toBe(200);
      expect(playerTwoBody.body).not.toContain("Lurking Shade");
      expect(playerTwoBody.body).not.toContain("Gate Sergeant Rell");
      expect(playerTwoBody.body).not.toContain(fixture.shade.id);
      // Control: player two's own participant and the Scenario-level NPC remain.
      expect(playerTwoBody.body).toContain("Bryn");
      expect(playerTwoBody.body).toContain("Watchman Dorn");
      // And the mode value no longer claims to be every active participant.
      expect(
        playerTwoBody.json<{ projection: { visibilityMode: string } }>().projection.visibilityMode,
      ).toBe("viewer_visible_participants");
    });

    /**
     * L3 — the Encounter-status bypass. Measured at baseline for `paused`,
     * `completed` and `archived`: the occupant of an Encounter the player
     * cannot read reappeared as `presence: {kind:"scenario"}` while the
     * Encounter itself answered 404 to the same player.
     */
    it("L3 — keeps a non-member out of the roster whatever the Encounter's status", async () => {
      const fixture = await seed();
      const url = `/scenarios/${fixture.scenario.id}/session`;

      for (const status of ["active", "paused", "completed", "archived"] as const) {
        await setEncounterStatus({
          encounterId: fixture.gatehouseId,
          gmCookie: fixture.gmCookie,
          status,
        });
        const body = await get(fixture.playerTwoCookie, url);
        expect(body.statusCode, body.body).toBe(200);
        const names = body
          .json<SessionPayload>()
          .session.participants.map((entry) => entry.displayName)
          .sort();

        // Player two is in the Cellar only and must not learn the Gatehouse roster.
        expect(names, `gatehouse status ${status}`).toEqual(["Bryn", "Watchman Dorn"]);
        expect(body.body, `gatehouse status ${status}`).not.toContain("Lurking Shade");
        expect(body.body, `gatehouse status ${status}`).not.toContain("Gate Sergeant Rell");

        // And the Encounter itself is refused, in the same breath.
        const encounterRead = await get(
          fixture.playerTwoCookie,
          `/encounters/${fixture.gatehouseId}`,
        );
        expect(encounterRead.statusCode, `gatehouse status ${status}`).toBe(404);
      }
    });

    /**
     * L5 + L6 — a persisted summary that names the participant, and the
     * `actorParticipantId` beside a roster that resolves it.
     *
     * Both suppressions are already plumbed through
     * `eventIdentifiesExcludedParticipant`; #798 fixes **where the excluded set
     * comes from**. The rows here are written with the exact summary templates
     * the two production routes write — `encounterRoutes.ts:20233` and
     * `:20509`/`:20520` — because the leak is in rows **already persisted** in
     * the Alpha database, for which read-time suppression is the only remedy. A
     * source assertion below pins the fixture to those templates so they cannot
     * drift apart silently; driving the roll pipeline end to end is not
     * reproduced here and is named as such in the report.
     */
    it("L5/L6 — withholds persisted prose naming the hidden participant and its actor id", async () => {
      const fixture = await seed();
      const url = `/scenarios/${fixture.scenario.id}/session`;
      const scenarioService = new ScenarioService();

      // L5 first site, `encounterRoutes.ts:20233`. Recorded with the route's
      // own event type and summary. MEASURED BELOW: `encounter_updated` is not
      // a member of `scenarioObjectiveHistoryEventTypeSchema`, so the row is
      // dropped by the type parse for the GM as well as the player — this
      // persisted prose reaches no history surface at all today.
      await scenarioService.recordScenarioEvent({
        actorUserId: fixture.gmUserId,
        eventType: "encounter_updated",
        payload: {
          encounterId: fixture.gatehouseId,
          participantId: `scenario-${fixture.shade.id}`,
        },
        scenarioId: fixture.scenario.id,
        summary: `Assigned Dexterity Stat check to Lurking Shade.`,
      });
      await scenarioService.recordScenarioEvent({
        actorUserId: fixture.gmUserId,
        eventType: "encounter_skill_outcome",
        payload: { encounterId: fixture.gatehouseId },
        scenarioId: fixture.scenario.id,
        summary: `Lurking Shade used Stealth: success.`,
      });
      // L6: a row whose prose names nobody but whose actor id resolves through
      // the roster in the same body.
      await scenarioService.recordScenarioEvent({
        actorUserId: fixture.gmUserId,
        eventType: "encounter_skill_outcome",
        participantId: fixture.shade.id,
        payload: { actorParticipantId: fixture.shade.id, encounterId: fixture.gatehouseId },
        scenarioId: fixture.scenario.id,
        summary: `An unseen attacker moved.`,
      });

      const visible = await get(fixture.playerOneCookie, url);
      expect(visible.statusCode, visible.body).toBe(200);
      const visibleHistory = visible.json<SessionPayload>().session.history;

      // CONTROL: before the hide, all three rows reach the player, the prose
      // carries the name, and the id-only row carries the actor id. The
      // instrument is demonstrably capable of reporting dirty through each
      // specific field.
      expect(visibleHistory.map((event) => event.summary)).toEqual(
        expect.arrayContaining([
          "Lurking Shade used Stealth: success.",
          "An unseen attacker moved.",
        ]),
      );
      // The `:20233` row is absent from the GM's own history too: its event
      // type is not projected. Asserted on both viewers so the absence is a
      // measurement of where that prose goes, not an untested assumption.
      const gmVisible = await get(fixture.gmCookie, url);
      expect(gmVisible.statusCode, gmVisible.body).toBe(200);
      expect(gmVisible.body).not.toContain("Assigned Dexterity Stat check");
      expect(visible.body).not.toContain("Assigned Dexterity Stat check");
      // Control for that negative: the GM body does carry the hidden
      // participant's other, projected prose, so the search can see this fixture.
      expect(gmVisible.body).toContain("Lurking Shade used Stealth: success.");
      expect(visibleHistory.map((event) => event.actorParticipantId ?? "")).toContain(
        fixture.shade.id,
      );

      await setVisibility({
        encounterId: fixture.gatehouseId,
        gmCookie: fixture.gmCookie,
        targetParticipantId: fixture.shade.id,
        viewerParticipantId: fixture.ari.id,
        visible: false,
      });
      const hidden = await get(fixture.playerOneCookie, url);
      expect(hidden.statusCode, hidden.body).toBe(200);
      const hiddenPayload = hidden.json<SessionPayload>();

      // MEASUREMENT, over the whole serialized body rather than the history
      // array, so a copy of the string anywhere else fails too (D2).
      expect(hidden.body).not.toContain("Lurking Shade");
      expect(hidden.body).not.toContain(fixture.shade.id);
      expect(hidden.body).not.toContain(`scenario-${fixture.shade.id}`);
      expect(hiddenPayload.session.history.map((event) => event.summary)).not.toContain(
        "An unseen attacker moved.",
      );
      expect(
        hiddenPayload.session.history.map((event) => event.actorParticipantId ?? ""),
      ).not.toContain(fixture.shade.id);

      // CONTROL the other way: legitimate player history survives, so this is
      // not a result an emptied list would also produce.
      expect(hiddenPayload.session.history.map((event) => event.type)).toContain(
        "encounter_started",
      );
      expect(hiddenPayload.session.history.length).toBeGreaterThan(0);

      // The structural delta is confined to the history array and the roster.
      const differencePaths = withoutNoise(
        structuralDifferences(visible.json(), hidden.json()),
      ).map((difference) => difference.path);
      expect(
        differencePaths.every(
          (path) =>
            path.startsWith("$.session.history") || path.startsWith("$.session.participants"),
        ),
        differencePaths.join(", "),
      ).toBe(true);
    });

    /**
     * L7 — `/combat-history`. The prose layer anonymises the hidden actor to
     * "another combatant" and drops `actor.participantId`, while `id` and
     * `sourceEventIds` on the same object carried `scenario-<participant id>`,
     * built in neither branch of the `mayInspect` gate. The declaration round
     * is advanced past the declaration boundary so the player actually
     * receives the row — otherwise the measurement would be vacuous.
     */
    it("L7 — removes the hidden participant id from the player's combat log", async () => {
      const fixture = await seed();
      const encounterService = new EncounterService();
      const encounter = await encounterService.getEncounterById(fixture.gatehouseId);
      const baseState = initializeCombatRoundState({ encounter: encounter! });
      const withDeclaration = {
        ...baseState,
        currentStep: "review_action_modifiers" as const,
        participants: baseState.participants.map((participant) =>
          participant.participantId === `scenario-${fixture.shade.id}`
            ? {
                ...participant,
                declaration: {
                  actionId: "attack_parry",
                  phaseContexts: {
                    phase1: {
                      modifierBuckets: {
                        general: [],
                        situationDb: [],
                        situationInitiative: [],
                        situationObSkill: [],
                      },
                      targetParticipantId: `scenario-${fixture.ari.id}`,
                    },
                  },
                  roundNumber: baseState.roundNumber,
                  submittedAt: "2026-10-26T11:00:00.000Z",
                  submittedBy: "gm" as const,
                },
              }
            : participant,
        ),
      };
      await encounterService.updateCombatEncounter({
        campaignId: fixture.campaignId,
        encounterId: fixture.gatehouseId,
        expectedRevision: encounter!.updatedAt,
        scenarioId: fixture.scenario.id,
        session: { ...encounter!, combatRoundState: withDeclaration },
      });

      const url = `/encounters/${fixture.gatehouseId}/combat-history`;
      const visible = await get(fixture.playerOneCookie, url);
      expect(visible.statusCode, visible.body).toBe(200);

      // CONTROL: the hidden participant's id reaches the player before the
      // hide, through this exact route and body.
      expect(visible.body).toContain(`scenario-${fixture.shade.id}`);

      await setVisibility({
        encounterId: fixture.gatehouseId,
        gmCookie: fixture.gmCookie,
        targetParticipantId: fixture.shade.id,
        viewerParticipantId: fixture.ari.id,
        visible: false,
      });
      const hidden = await get(fixture.playerOneCookie, url);
      expect(hidden.statusCode, hidden.body).toBe(200);

      // MEASUREMENT: neither the alias form nor the bare ScenarioParticipant id
      // survives anywhere in the serialized body, and neither does the name.
      expect(hidden.body).not.toContain(`scenario-${fixture.shade.id}`);
      expect(hidden.body).not.toContain(fixture.shade.id);
      expect(hidden.body).not.toContain("Lurking Shade");
      // Non-vacuous: the anonymised row is still delivered and the redaction
      // demonstrably ran, rather than the row being dropped.
      expect(hidden.body).toContain("another combatant");
      expect(hidden.body).toContain("hidden-participant");
      // The viewer's own id is untouched, so client correlation survives.
      expect(hidden.body).toContain(`scenario-${fixture.ari.id}`);
    });

    /**
     * F1 — the stored-prose scan must match names, not substrings.
     *
     * QA's measurement at `4d65b52f`: hiding an NPC named `Ed` withheld **0 of
     * 5** of Ari's own Activity rows, because `Ed` occurs inside `used`,
     * `Started`, `Paused` and `Scenario`. The rows carry no identifying content
     * and several are Ari's own.
     *
     * Method as ruled: the full serialized body is read twice over one
     * fixture and diffed structurally. The hide is the only thing that changes
     * between the reads, so every difference is attributable to it — and after
     * the repair the only differences are in the roster, not the history.
     */
    it("F1 — a hidden name occurring only inside another word withholds no row", async () => {
      const fixture = await seed({ hiddenNpc: "Ed" });
      const url = `/scenarios/${fixture.scenario.id}/session`;
      const scenarioService = new ScenarioService();

      // Ari's own rows, with the summaries their production write sites
      // persist: `encounterRoutes.ts` (`encounter_skill_outcome`) and
      // `scenarioService.ts` (the pick-up). `Started encounter Gatehouse.` and
      // `Paused encounter Gatehouse because the Scenario paused.` already exist
      // from the seed and the pause below.
      await scenarioService.recordScenarioEvent({
        actorUserId: fixture.gmUserId,
        eventType: "encounter_skill_outcome",
        payload: { encounterId: fixture.gatehouseId },
        scenarioId: fixture.scenario.id,
        summary: `Ari used Stealth: success.`,
      });
      await scenarioService.recordScenarioEvent({
        actorUserId: fixture.gmUserId,
        eventType: "item_transferred",
        participantId: fixture.ari.id,
        payload: { encounterId: fixture.gatehouseId },
        scenarioId: fixture.scenario.id,
        summary: `Ari picked up Lost Seal.`,
      });
      await scenarioService.recordScenarioEvent({
        actorUserId: fixture.gmUserId,
        eventType: "encounter_created",
        payload: { encounterId: fixture.gatehouseId },
        scenarioId: fixture.scenario.id,
        summary: `Created combat encounter Gatehouse.`,
      });

      // The visible NPC is given an explicit `true`, as the L1 case does: once
      // the matrix is non-empty a viewer needs their own row for each target
      // (the PR's finding 1), so without this the delta would also carry that
      // pre-existing behaviour instead of only the hide.
      await setVisibility({
        encounterId: fixture.gatehouseId,
        gmCookie: fixture.gmCookie,
        targetParticipantId: fixture.rell.id,
        viewerParticipantId: fixture.ari.id,
        visible: true,
      });
      await setVisibility({
        encounterId: fixture.gatehouseId,
        gmCookie: fixture.gmCookie,
        targetParticipantId: fixture.shade.id,
        viewerParticipantId: fixture.ari.id,
        visible: true,
      });
      const visible = await get(fixture.playerOneCookie, url);
      expect(visible.statusCode, visible.body).toBe(200);
      const visibleSummaries = visible
        .json<SessionPayload>()
        .session.history.map((event) => event.summary);
      // CONTROL: every row this case is about reaches Ari before the hide, and
      // each one carries a word the substring scan matched on `Ed`.
      expect(visibleSummaries).toEqual(
        expect.arrayContaining([
          "Created combat encounter Gatehouse.",
          "Started encounter Gatehouse.",
          "Ari used Stealth: success.",
          "Ari picked up Lost Seal.",
        ]),
      );
      expect(visible.body).toContain("Ed");

      await setVisibility({
        encounterId: fixture.gatehouseId,
        gmCookie: fixture.gmCookie,
        targetParticipantId: fixture.shade.id,
        viewerParticipantId: fixture.ari.id,
        visible: false,
      });
      const hidden = await get(fixture.playerOneCookie, url);
      expect(hidden.statusCode, hidden.body).toBe(200);
      const hiddenPayload = hidden.json<SessionPayload>();

      // MEASUREMENT: the hide removes the NPC from the roster and nothing else.
      // Asserted on the structural diff of the whole body, not on a name search.
      const differences = withoutNoise(structuralDifferences(visible.json(), hidden.json()));
      expect(
        differences.every((difference) => difference.path.startsWith("$.session.participants")),
        differences.map((difference) => difference.path).join(", "),
      ).toBe(true);
      expect(hiddenPayload.session.history.map((event) => event.summary)).toEqual(visibleSummaries);
      // And the hide did happen, so this is not a vacuous pass.
      expect(hiddenPayload.session.participants.map((entry) => entry.displayName)).not.toContain(
        "Ed",
      );
      expect(hiddenPayload.session.participants.map((entry) => entry.displayName)).toContain("Ari");
    });

    /**
     * F1, second trigger. The suppressed set is non-empty with **no GM hide at
     * all**: a participant sharing no Encounter with the viewer is suppressed
     * by the cross-Encounter boundary. QA measured a party split withholding
     * 0 of 3 of Ari's rows. Bryn is renamed `Ed` and stays in the Cellar;
     * no visibility row is written anywhere.
     */
    it("F1 — a party split with empty visibility matrices leaves the viewer's rows intact", async () => {
      const fixture = await seed({ playerTwo: "Ed" });
      const scenarioService = new ScenarioService();
      for (const summary of ["Ari used Stealth: success.", "Ari picked up Lost Seal."]) {
        await scenarioService.recordScenarioEvent({
          actorUserId: fixture.gmUserId,
          eventType: "encounter_skill_outcome",
          payload: { encounterId: fixture.gatehouseId },
          scenarioId: fixture.scenario.id,
          summary,
        });
      }

      const read = await get(fixture.playerOneCookie, `/scenarios/${fixture.scenario.id}/session`);
      expect(read.statusCode, read.body).toBe(200);
      const payload = read.json<SessionPayload>();

      // CONTROL that the split is real: Ed is suppressed from Ari's roster with
      // no matrix written, which is the condition that fed the name scan.
      expect(payload.session.participants.map((entry) => entry.displayName)).not.toContain("Ed");
      // MEASUREMENT: Ari's rows survive it.
      expect(payload.session.history.map((event) => event.summary)).toEqual(
        expect.arrayContaining([
          "Started encounter Gatehouse.",
          "Ari used Stealth: success.",
          "Ari picked up Lost Seal.",
        ]),
      );
    });

    /**
     * F1, acceptance item 5 — the decision, measured end to end. The hidden
     * `Guard`'s name is a whole word inside the **visible** `Gate Guard
     * Captain`, so word boundaries alone do not settle it.
     *
     * **Rule: the longest matching name wins.** An occurrence of a suppressed
     * name inside an occurrence of a strictly longer visible participant's name
     * is that visible participant's mention and does not suppress the row; an
     * occurrence not covered that way still does. Rationale: the alternative
     * withholds a visible participant's own rows, which is F1's defect again.
     */
    it("F1 — a whole-word hit inside a visible participant's longer name keeps the row", async () => {
      // The visible NPC is renamed so the hidden word is a whole word inside a
      // longer **visible** participant's name — the case word boundaries alone
      // do not settle.
      const fixture = await seed({ hiddenNpc: "Guard", visibleNpc: "Gate Guard Captain" });
      const url = `/scenarios/${fixture.scenario.id}/session`;
      const scenarioService = new ScenarioService();
      const record = (summary: string) =>
        scenarioService.recordScenarioEvent({
          actorUserId: fixture.gmUserId,
          eventType: "encounter_skill_outcome",
          payload: { encounterId: fixture.gatehouseId },
          scenarioId: fixture.scenario.id,
          summary,
        });
      // Three rows: one naming the longer **visible** participant that contains
      // the hidden word, one naming the hidden participant alone, and one where
      // the hidden name occurs only inside a longer ordinary word.
      await record("Gate Guard Captain used Persuade: success.");
      await record("Guard used Persuade: success.");
      await record("Ari found a guardrail.");

      // The visible NPC is given an explicit `true`, as the L1 case does: once
      // the matrix is non-empty a viewer needs their own row for each target
      // (the PR's finding 1), so without this the delta would also carry that
      // pre-existing behaviour instead of only the hide.
      await setVisibility({
        encounterId: fixture.gatehouseId,
        gmCookie: fixture.gmCookie,
        targetParticipantId: fixture.rell.id,
        viewerParticipantId: fixture.ari.id,
        visible: true,
      });
      await setVisibility({
        encounterId: fixture.gatehouseId,
        gmCookie: fixture.gmCookie,
        targetParticipantId: fixture.shade.id,
        viewerParticipantId: fixture.ari.id,
        visible: true,
      });

      const visible = await get(fixture.playerOneCookie, url);
      expect(visible.statusCode, visible.body).toBe(200);
      expect(visible.json<SessionPayload>().session.history.map((event) => event.summary)).toEqual(
        expect.arrayContaining([
          "Gate Guard Captain used Persuade: success.",
          "Guard used Persuade: success.",
          "Ari found a guardrail.",
        ]),
      );

      await setVisibility({
        encounterId: fixture.gatehouseId,
        gmCookie: fixture.gmCookie,
        targetParticipantId: fixture.shade.id,
        viewerParticipantId: fixture.ari.id,
        visible: false,
      });
      const hidden = await get(fixture.playerOneCookie, url);
      expect(hidden.statusCode, hidden.body).toBe(200);
      const summaries = hidden.json<SessionPayload>().session.history.map((event) => event.summary);
      // Covered by a longer visible name, and by a longer word: both kept.
      expect(summaries).toContain("Gate Guard Captain used Persuade: success.");
      expect(summaries).toContain("Ari found a guardrail.");
      // Not covered: still withheld, so the rule did not disarm the scan.
      expect(summaries).not.toContain("Guard used Persuade: success.");
    });

    /**
     * Pins the L5 fixture to the production summary templates. The rows above
     * are written directly, so if a route's wording changed the differential
     * would keep passing while measuring a string nothing produces — the
     * "check the instrument's target" failure.
     */
    it("L5 — the fixture's summary templates are the ones the routes still write", async () => {
      const { readFile } = await import("node:fs/promises");
      const { join } = await import("node:path");
      const source = await readFile(join(process.cwd(), ROUTE_SOURCE_PATH), "utf8");
      expect(source).toContain(
        "summary: `Assigned ${statProfile.statLabel} Stat check to ${participant.label}.`",
      );
      expect(source).toContain("summary: `${participant.label} rolled ${pendingRoll.skillLabel}.`");
      expect(source).toContain(
        "objectiveSummary = `${participant.label} used ${pendingRoll.skillLabel}: ${",
      );
      // #798 F1 additionally fixtures the Encounter-lifecycle templates, which
      // name no participant at all and were withheld purely on a substring.
      expect(source).toContain(
        "summary: `Created ${encounter.kind} encounter ${encounter.title}.`",
      );
      expect(source).toContain('"Archived" : "Started"} encounter ${existingEncounter.title}.`');
      const repositorySource = await readFile(
        join(process.cwd(), "packages/database/src/repositories/scenarioRepository.ts"),
        "utf8",
      );
      expect(repositorySource).toContain(
        "summary: `Paused encounter ${encounter.name} because the Scenario paused.`",
      );
      const serviceSource = await readFile(
        join(process.cwd(), "packages/database/src/services/scenarioService.ts"),
        "utf8",
      );
      expect(serviceSource).toContain(
        'summary: `${participant.snapshot.displayName} picked up ${availableObject?.name ?? "an Item"}.`',
      );
    });
  });
}
