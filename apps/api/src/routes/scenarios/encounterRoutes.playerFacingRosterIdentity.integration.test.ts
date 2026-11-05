import type { FastifyInstance } from "fastify";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { encounterSessionSchema, playerFacingEncounterRosterRefusal } from "@glantri/domain";

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
 * Forgejo #963 — a player who joins a Scenario after a roster was written receives an Encounter
 * they are not in.
 *
 * The reaching path is two steps and **neither is refused**:
 *
 * 1. the GM writes a roster row that declares the onstage combatant's mapping and carries the
 *    Character of a player who has not joined the Scenario yet. The write boundary's identity
 *    condition asks the Scenario's participants, and at this moment there is no participant for
 *    that Character, so the row corresponds only to its own mapping and the `PATCH` is accepted;
 * 2. that player then joins the Scenario with their own session, through the ordinary
 *    `POST /scenarios/:scenarioId/participants/character`.
 *
 * The stored roster now violates #947's condition and nothing re-asked it, so a read resolves a
 * roster the branch's own condition forbids. Every figure below is driven through the product's
 * own HTTP routes under real session cookies, and the player readings are classified **by response
 * key** over the whole raw body rather than by status code: the two leaks before this one were
 * single keys inside otherwise-clean bodies.
 *
 * The GM control read is what makes the player refusals meaningful. It runs against the same
 * stored state and still returns the violating roster, so a refusing player read is a projection
 * result and not an empty fixture.
 */

const hasTaskApplicationDatabase =
  process.env.GLANTRI_DB_MODE === "task" && Boolean(process.env.DATABASE_URL);
const origin = "http://localhost:3362";

vi.setConfig({ testTimeout: 120_000 });

const ITEM_FACTS = {
  activeMechanics: [],
  descriptiveTraits: [],
  templateOverrides: [],
  unsupportedCapabilities: [],
  version: 1 as const,
};

async function sessionCookie(userId: string): Promise<string> {
  const { token } = await new AuthService().createSessionForUser(userId);
  return `${SESSION_COOKIE_NAME}=${token}`;
}

/**
 * Every leaf of a response body with the key path that carries it. A projection defect is a single
 * key, so the classification is per key rather than per route.
 */
function responseLeaves(value: unknown, path = "$"): { path: string; value: string }[] {
  if (value === null || value === undefined) {
    return [];
  }
  if (Array.isArray(value)) {
    return value.flatMap((entry, index) => responseLeaves(entry, `${path}[${index}]`));
  }
  if (typeof value === "object") {
    return Object.entries(value as Record<string, unknown>).flatMap(([key, entry]) =>
      responseLeaves(entry, `${path}.${key}`),
    );
  }
  return [{ path, value: String(value) }];
}

/** The leaves whose value is one of the identifiers this viewer must not receive. */
function disclosedLeaves(input: {
  body: unknown;
  forbidden: Readonly<Record<string, string>>;
}): { identifier: string; path: string; value: string }[] {
  const byValue = new Map(Object.entries(input.forbidden).map(([name, value]) => [value, name]));
  return responseLeaves(input.body).flatMap((leaf) => {
    const identifier = byValue.get(leaf.value);
    return identifier ? [{ identifier, path: leaf.path, value: leaf.value }] : [];
  });
}

if (!hasTaskApplicationDatabase) {
  describe.skip("Player-facing roster identity (task database not configured)", () => {});
} else {
  describe("A player-facing Encounter read fails closed on an unresolved roster (#963)", () => {
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
     * Bran and Ceri are the Encounter's roster. Eira is an active Scenario participant in no
     * Encounter, so the readings below cannot be explained by blanket suppression. Dag's player
     * has a Campaign Character but has **not** joined the Scenario, which is the condition that
     * makes step 1 acceptable.
     */
    async function seed() {
      const gm = await createTestUser(prisma, { displayName: "GM", roles: ["game_master"] });
      const onstageUser = await createTestUser(prisma, { displayName: "Onstage player" });
      const partnerUser = await createTestUser(prisma, { displayName: "Partner player" });
      const latecomerUser = await createTestUser(prisma, { displayName: "Latecomer player" });
      const bystanderUser = await createTestUser(prisma, { displayName: "Bystander player" });
      const campaign = await createTestCampaign(prisma, gm.id, { status: "active" });
      const onstageCharacter = await createTestCharacter(prisma, onstageUser.id, { name: "Bran" });
      const partnerCharacter = await createTestCharacter(prisma, partnerUser.id, { name: "Ceri" });
      const latecomerCharacter = await createTestCharacter(prisma, latecomerUser.id, {
        name: "Dag",
      });
      const bystanderCharacter = await createTestCharacter(prisma, bystanderUser.id, {
        name: "Eira",
      });
      const characters = [
        onstageCharacter,
        partnerCharacter,
        latecomerCharacter,
        bystanderCharacter,
      ];
      await prisma.campaignRosterEntry.createMany({
        data: characters.map((character) => ({
          campaignId: campaign.id,
          category: "pc",
          sourceId: character.id,
          sourceType: "character",
        })),
      });

      const equipment = new CharacterEquipmentWriteService();
      for (const character of characters) {
        await equipment.ensureCharacterEquipmentInitialized(character.id);
      }
      await equipment.createCampaignEquipmentItem({
        campaignId: campaign.id,
        displayName: "Silver dagger",
        holderCharacterId: onstageCharacter.id,
        itemFacts: { ...ITEM_FACTS },
        templateId: "weapon-template-dagger",
      });

      const scenarioService = new ScenarioService();
      const scenario = await scenarioService.createScenario({
        campaignId: campaign.id,
        name: "Crossing the Vesubia",
        status: "live",
      });
      const onstage = await scenarioService.addCharacterParticipant({
        characterId: onstageCharacter.id,
        controlledByUserId: onstageUser.id,
        joinSource: "gm_added",
        scenarioId: scenario.id,
      });
      const partner = await scenarioService.addCharacterParticipant({
        characterId: partnerCharacter.id,
        controlledByUserId: partnerUser.id,
        joinSource: "gm_added",
        scenarioId: scenario.id,
      });
      const bystander = await scenarioService.addCharacterParticipant({
        characterId: bystanderCharacter.id,
        controlledByUserId: bystanderUser.id,
        joinSource: "gm_added",
        scenarioId: scenario.id,
      });

      const legitimateRoster = [
        {
          characterId: onstageCharacter.id,
          id: "encounter-participant-onstage",
          label: onstageCharacter.name,
          participantType: "character",
          scenarioParticipantId: onstage.id,
        },
        {
          characterId: partnerCharacter.id,
          id: "encounter-participant-partner",
          label: partnerCharacter.name,
          participantType: "character",
          scenarioParticipantId: partner.id,
        },
      ];
      // A non-empty per-viewer matrix — the store the GM's hide control actually writes, and the
      // only one that is not inert (#798). Each roster member may see the other, so no reading
      // below is explained by the empty-matrix fail-open default.
      const visibility = {
        "encounter-participant-onstage": { "encounter-participant-partner": true },
        "encounter-participant-partner": { "encounter-participant-onstage": true },
      };

      const encounterService = new EncounterService();
      const draft = await encounterService.createEncounter({
        campaignId: campaign.id,
        scenarioId: scenario.id,
        session: encounterSessionSchema.parse({
          createdAt: "2026-11-05T10:00:00.000Z",
          id: `encounter-${scenario.id}`,
          kind: "combat",
          participantMembershipMode: "explicit",
          participants: legitimateRoster,
          roleplayState: { visibility },
          scenarioId: scenario.id,
          status: "draft",
          title: "Ambush at the ford",
          updatedAt: "2026-11-05T10:00:00.000Z",
        }),
      });
      const started = await encounterService.updateEncounter({
        campaignId: campaign.id,
        encounterId: draft.id,
        expectedRevision: draft.updatedAt,
        objectiveEvent: {
          actorUserId: gm.id,
          eventType: "encounter_started",
          summary: `Started encounter ${draft.title}.`,
        },
        scenarioId: scenario.id,
        session: { ...draft, status: "active" },
      });

      return {
        campaign,
        characters: {
          bystander: bystanderCharacter,
          latecomer: latecomerCharacter,
          onstage: onstageCharacter,
          partner: partnerCharacter,
        },
        cookies: {
          gm: await sessionCookie(gm.id),
          latecomer: await sessionCookie(latecomerUser.id),
          onstage: await sessionCookie(onstageUser.id),
          partner: await sessionCookie(partnerUser.id),
        },
        encounterId: started.id,
        encounterTitle: started.title,
        legitimateRoster,
        participants: { bystander, onstage, partner },
        scenario,
      };
    }

    /** The GM's own roster write. Returns the route's verdict rather than asserting it. */
    async function patchRoster(input: {
      cookie: string;
      encounterId: string;
      participants: unknown[];
    }) {
      const current = await new EncounterService().getEncounterById(input.encounterId);
      expect(current).toBeTruthy();
      const response = await app.inject({
        headers: { cookie: input.cookie, origin },
        method: "PATCH",
        payload: {
          expectedRevision: current!.updatedAt,
          participantMembershipMode: "explicit",
          participants: input.participants,
        },
        url: `/encounters/${input.encounterId}/participants`,
      });
      return {
        error: (() => {
          try {
            return (response.json() as { error?: string }).error;
          } catch {
            return undefined;
          }
        })(),
        statusCode: response.statusCode,
      };
    }

    /** The Scenario-session read: the body #963 measured the disclosure in. */
    async function readScenarioSession(cookie: string, scenarioId: string) {
      const response = await app.inject({
        headers: { cookie, origin },
        method: "GET",
        url: `/scenarios/${scenarioId}/session`,
      });
      const payload =
        response.statusCode === 200
          ? response.json<{
              session: {
                encounters?: { id: string; title: string }[];
                participants?: {
                  displayName?: string;
                  id: string;
                  presence?: { encounterId?: string; kind: string };
                }[];
                viewerMode: string;
              };
            }>()
          : undefined;
      return {
        body: (() => {
          try {
            return response.json<unknown>();
          } catch {
            return response.body;
          }
        })(),
        encounterIds: (payload?.session.encounters ?? []).map((entry) => entry.id),
        participantNames: (payload?.session.participants ?? []).map(
          (entry) => entry.displayName ?? entry.id,
        ),
        presenceEncounterIds: (payload?.session.participants ?? []).flatMap((entry) =>
          entry.presence?.encounterId ? [entry.presence.encounterId] : [],
        ),
        statusCode: response.statusCode,
        viewerMode: payload?.session.viewerMode,
      };
    }

    /** The direct Encounter read: the player-facing Encounter projection itself. */
    async function readEncounter(cookie: string, encounterId: string) {
      const response = await app.inject({
        headers: { cookie, origin },
        method: "GET",
        url: `/encounters/${encounterId}`,
      });
      const parsed = (() => {
        try {
          return response.json<unknown>();
        } catch {
          return response.body;
        }
      })();
      return {
        body: parsed,
        participantLabels: (() => {
          const encounter = (parsed as { encounter?: { participants?: { label?: string }[] } })
            .encounter;
          return (encounter?.participants ?? []).map((entry) => entry.label ?? "");
        })(),
        statusCode: response.statusCode,
      };
    }

    /**
     * The readers that reach Encounter state without going through the player-facing Encounter
     * projection. Enumerated from the route table rather than assumed: of the 69 Encounter-touching
     * routes under `apps/api/src/routes/scenarios`, 28 build their response through
     * `buildPlayerFacingEncounterForUser` and 9 have a player branch that does not. These are the
     * ones that carry Encounter identity or roster-derived state.
     */
    async function readBypassingRoutes(input: {
      cookie: string;
      encounterId: string;
      scenarioId: string;
    }) {
      const read = async (url: string) => {
        const response = await app.inject({
          headers: { cookie: input.cookie, origin },
          method: "GET",
          url,
        });
        return {
          body: (() => {
            try {
              return response.json<unknown>();
            } catch {
              return response.body;
            }
          })(),
          statusCode: response.statusCode,
        };
      };
      return {
        combatHistory: await read(`/encounters/${input.encounterId}/combat-history`),
        encounterItems: await read(`/encounters/${input.encounterId}/items`),
        encounterSummaries: await read(`/scenarios/${input.scenarioId}/encounter-summaries`),
        itemInteractionOptions: await read(
          `/encounters/${input.encounterId}/combat-round/item-interactions/options`,
        ),
        revision: await read(`/encounters/${input.encounterId}/revision`),
        scenarioPlayerProjection: await read(`/scenarios/${input.scenarioId}/player-projection`),
      };
    }

    /** Step 2: the latecomer joins, with their own session, through the ordinary route. */
    async function joinScenario(input: {
      characterId: string;
      cookie: string;
      scenarioId: string;
    }) {
      const response = await app.inject({
        headers: { cookie: input.cookie, origin },
        method: "POST",
        payload: { characterId: input.characterId },
        url: `/scenarios/${input.scenarioId}/participants/character`,
      });
      return { body: response.body, statusCode: response.statusCode };
    }

    /**
     * The whole reaching path, and both directions of the refusal, in one driven arrangement so
     * that the before and after readings are of the same fixture.
     */
    it("refuses every player read of the unresolved roster and preserves the GM's", async () => {
      const current = await seed();
      const scenarioId = current.scenario.id;

      // ---- Before: the roster is legitimate and the player reads work. ----
      const onstageBefore = await readEncounter(current.cookies.onstage, current.encounterId);
      const onstageSessionBefore = await readScenarioSession(current.cookies.onstage, scenarioId);
      const latecomerSessionBefore = await readScenarioSession(
        current.cookies.latecomer,
        scenarioId,
      );

      // ---- Step 1: the GM prepares a row for a Character that has not joined. ----
      const prepared = [
        { ...current.legitimateRoster[0]!, characterId: current.characters.latecomer.id },
        current.legitimateRoster[1]!,
      ];
      const preparedWrite = await patchRoster({
        cookie: current.cookies.gm,
        encounterId: current.encounterId,
        participants: prepared,
      });

      // ---- Step 2: that Character's player joins, with their own session. ----
      const join = await joinScenario({
        characterId: current.characters.latecomer.id,
        cookie: current.cookies.latecomer,
        scenarioId,
      });

      const storedAfter = await new EncounterService().getEncounterById(current.encounterId);
      const scenarioParticipantsAfter = await new ScenarioService().listScenarioParticipants(
        scenarioId,
      );
      const refusalForStoredState = playerFacingEncounterRosterRefusal({
        encounter: storedAfter!,
        scenarioParticipants: scenarioParticipantsAfter,
      });

      // ---- The GM control read: the violating state is there to be found. ----
      const gmEncounter = await readEncounter(current.cookies.gm, current.encounterId);
      const gmSession = await readScenarioSession(current.cookies.gm, scenarioId);

      // ---- The three player viewer positions. ----
      const onstageEncounter = await readEncounter(current.cookies.onstage, current.encounterId);
      const partnerEncounter = await readEncounter(current.cookies.partner, current.encounterId);
      const latecomerEncounter = await readEncounter(
        current.cookies.latecomer,
        current.encounterId,
      );
      const onstageSession = await readScenarioSession(current.cookies.onstage, scenarioId);
      const partnerSession = await readScenarioSession(current.cookies.partner, scenarioId);
      const latecomerSession = await readScenarioSession(current.cookies.latecomer, scenarioId);

      // ---- Classification by response key. ----
      const encounterFacts = {
        encounterId: current.encounterId,
        encounterTitle: current.encounterTitle,
        rowOnstage: "encounter-participant-onstage",
        rowPartner: "encounter-participant-partner",
      };
      const latecomerForbidden = {
        ...encounterFacts,
        onstageCharacterId: current.characters.onstage.id,
        onstageName: current.characters.onstage.name,
        onstageParticipantId: current.participants.onstage.id,
        partnerCharacterId: current.characters.partner.id,
        partnerName: current.characters.partner.name,
        partnerParticipantId: current.participants.partner.id,
      };
      const rosterMemberForbidden = {
        ...encounterFacts,
        latecomerCharacterId: current.characters.latecomer.id,
      };
      // ---- The readers that bypass the projection, for every viewer position. ----
      const bypassing = {
        gm: await readBypassingRoutes({
          cookie: current.cookies.gm,
          encounterId: current.encounterId,
          scenarioId,
        }),
        latecomer: await readBypassingRoutes({
          cookie: current.cookies.latecomer,
          encounterId: current.encounterId,
          scenarioId,
        }),
        onstage: await readBypassingRoutes({
          cookie: current.cookies.onstage,
          encounterId: current.encounterId,
          scenarioId,
        }),
        partner: await readBypassingRoutes({
          cookie: current.cookies.partner,
          encounterId: current.encounterId,
          scenarioId,
        }),
      };

      const classified = {
        latecomerEncounterRead: disclosedLeaves({
          body: latecomerEncounter.body,
          forbidden: latecomerForbidden,
        }),
        latecomerSessionRead: disclosedLeaves({
          body: latecomerSession.body,
          forbidden: latecomerForbidden,
        }),
        onstageEncounterRead: disclosedLeaves({
          body: onstageEncounter.body,
          forbidden: rosterMemberForbidden,
        }),
        onstageSessionRead: disclosedLeaves({
          body: onstageSession.body,
          forbidden: rosterMemberForbidden,
        }),
        partnerEncounterRead: disclosedLeaves({
          body: partnerEncounter.body,
          forbidden: rosterMemberForbidden,
        }),
        partnerSessionRead: disclosedLeaves({
          body: partnerSession.body,
          forbidden: rosterMemberForbidden,
        }),
      };

      // ---- The owed measurement: is there a GM repair path for this state? ----
      // First, the write that changes nothing: the same stored roster, re-submitted. The write
      // boundary asks the condition of the submitted roster against the Scenario as it is now, so
      // any write that round-trips this roster unchanged is refused. That is #968's subject.
      const resubmission = await patchRoster({
        cookie: current.cookies.gm,
        encounterId: current.encounterId,
        participants: prepared,
      });
      const repair = await patchRoster({
        cookie: current.cookies.gm,
        encounterId: current.encounterId,
        participants: current.legitimateRoster,
      });
      const storedAfterRepair = await new EncounterService().getEncounterById(current.encounterId);
      const onstageAfterRepair = await readEncounter(current.cookies.onstage, current.encounterId);
      const latecomerAfterRepair = await readScenarioSession(current.cookies.latecomer, scenarioId);

      console.log(
        "B963-PLAYER-FACING-FAIL-CLOSED",
        JSON.stringify(
          {
            afterRepair: {
              latecomerSessionEncounterIds: latecomerAfterRepair.encounterIds,
              latecomerSessionParticipantNames: latecomerAfterRepair.participantNames,
              onstageEncounterRead: onstageAfterRepair.statusCode,
              onstageParticipantLabels: onstageAfterRepair.participantLabels,
              repairStatusCode: repair.statusCode,
              repairedStoredRoster: (storedAfterRepair?.participants ?? []).map((participant) => [
                participant.id,
                participant.characterId,
              ]),
              residualRefusal:
                playerFacingEncounterRosterRefusal({
                  encounter: storedAfterRepair!,
                  scenarioParticipants: scenarioParticipantsAfter,
                }) ?? "none",
            },
            before: {
              latecomerSessionEncounterIds: latecomerSessionBefore.encounterIds,
              onstageEncounterRead: onstageBefore.statusCode,
              onstageParticipantLabels: onstageBefore.participantLabels,
              onstageSessionEncounterIds: onstageSessionBefore.encounterIds,
            },
            classifiedDisclosures: classified,
            bypassingReaders: Object.fromEntries(
              Object.entries(bypassing).map(([viewer, readings]) => [
                viewer,
                Object.fromEntries(
                  Object.entries(readings).map(([route, reading]) => [
                    route,
                    {
                      disclosedPaths: disclosedLeaves({
                        body: reading.body,
                        forbidden:
                          viewer === "latecomer" ? latecomerForbidden : rosterMemberForbidden,
                      }).map((disclosure) => disclosure.path),
                      statusCode: reading.statusCode,
                    },
                  ]),
                ),
              ]),
            ),
            gmControlRead: {
              encounterReadStatusCode: gmEncounter.statusCode,
              sessionEncounterIds: gmSession.encounterIds,
              sessionParticipantNames: gmSession.participantNames,
              storedRoster: (storedAfter?.participants ?? []).map((participant) => [
                participant.id,
                participant.scenarioParticipantId,
                participant.characterId,
              ]),
              storedStateRefusal: refusalForStoredState,
            },
            playerReads: {
              latecomerEncounterStatusCode: latecomerEncounter.statusCode,
              latecomerSessionEncounterIds: latecomerSession.encounterIds,
              latecomerSessionParticipantNames: latecomerSession.participantNames,
              latecomerSessionPresenceEncounterIds: latecomerSession.presenceEncounterIds,
              onstageEncounterStatusCode: onstageEncounter.statusCode,
              onstageSessionEncounterIds: onstageSession.encounterIds,
              partnerEncounterStatusCode: partnerEncounter.statusCode,
              partnerSessionEncounterIds: partnerSession.encounterIds,
            },
            gmWritePath: {
              repairStatusCode: repair.statusCode,
              resubmissionError: resubmission.error,
              resubmissionStatusCode: resubmission.statusCode,
            },
            reachingPath: {
              joinStatusCode: join.statusCode,
              preparedWriteError: preparedWrite.error,
              preparedWriteStatusCode: preparedWrite.statusCode,
            },
          },
          null,
          2,
        ),
      );

      // Neither step of the reaching path is refused.
      expect(preparedWrite.statusCode).toBe(200);
      expect(join.statusCode).toBe(200);

      // The stored state violates the condition, and the GM can still read it.
      expect(refusalForStoredState).toBeDefined();
      expect(gmEncounter.statusCode).toBe(200);
      expect(gmSession.encounterIds).toEqual([current.encounterId]);
      expect(
        (storedAfter?.participants ?? []).map((participant) => participant.characterId),
      ).toContain(current.characters.latecomer.id);

      // Every player read of that Encounter refuses, including its own roster members'.
      expect(onstageEncounter.statusCode).not.toBe(200);
      expect(partnerEncounter.statusCode).not.toBe(200);
      expect(latecomerEncounter.statusCode).not.toBe(200);

      // The Scenario-session read still answers, and carries nothing of the Encounter.
      for (const reading of [onstageSession, partnerSession, latecomerSession]) {
        expect(reading.statusCode).toBe(200);
        expect(reading.viewerMode).toBe("player");
        expect(reading.encounterIds).toEqual([]);
        expect(reading.presenceEncounterIds).toEqual([]);
      }

      // Classified by response key. The viewer with no legitimate relation to this Encounter
      // receives nothing of it under any key, and nothing of either roster member.
      expect(classified.latecomerEncounterRead).toEqual([]);
      expect(classified.latecomerSessionRead).toEqual([]);
      // Not only by key: the latecomer's raw body contains none of these identifiers as text
      // either, which is where a name inside stored prose would otherwise survive key-level
      // classification.
      const latecomerRaw = JSON.stringify(latecomerSession.body);
      for (const identifier of Object.values(latecomerForbidden)) {
        expect(latecomerRaw, `latecomer raw body carries ${identifier}`).not.toContain(identifier);
      }

      // The two roster members receive nothing of the Encounter from the keys that resolve it, and
      // nothing of the latecomer's Character anywhere.
      expect(classified.onstageEncounterRead).toEqual([]);
      expect(classified.partnerEncounterRead).toEqual([]);
      for (const [reading, disclosures] of [
        ["onstageSessionRead", classified.onstageSessionRead],
        ["partnerSessionRead", classified.partnerSessionRead],
      ] as const) {
        // The measured residual, stated rather than summarised: the Scenario's own objective
        // history still records that this Encounter started, under the Encounter id, for the
        // players who were in it when it did. It is a recorded event rather than a resolved
        // roster — no combatant name, no roster row and nothing of the latecomer reaches it —
        // and retroactively rewriting the event log is not this issue's subject.
        expect(
          disclosures.map((disclosure) => [disclosure.identifier, disclosure.path]),
          reading,
        ).toEqual([["encounterId", "$.session.history[0].encounterId"]]);
      }

      // The latecomer receives only their own participant; Eira, in no Encounter, is unaffected.
      expect([...latecomerSession.participantNames].sort()).toEqual(
        [current.characters.bystander.name, current.characters.latecomer.name].sort(),
      );

      // Before the violation, the same fixture answered: the refusal is caused by the state.
      expect(onstageBefore.statusCode).toBe(200);
      expect([...onstageBefore.participantLabels].sort()).toEqual(
        [current.characters.onstage.name, current.characters.partner.name].sort(),
      );
      expect(onstageSessionBefore.encounterIds).toEqual([current.encounterId]);
      expect(latecomerSessionBefore.encounterIds).toEqual([]);

      // ---- The readers that bypass the projection. ----
      // The GM keeps every one of them, which is the half of the ruling that is easy to break.
      for (const [route, reading] of Object.entries(bypassing.gm)) {
        expect(reading.statusCode, `gm ${route}`).toBe(200);
      }
      // No player reaches Encounter state through any of them.
      for (const viewer of ["latecomer", "onstage", "partner"] as const) {
        const readings = bypassing[viewer];
        for (const route of [
          "combatHistory",
          "encounterItems",
          "itemInteractionOptions",
          "revision",
        ] as const) {
          expect(readings[route].statusCode, `${viewer} ${route}`).not.toBe(200);
        }
        // The summaries list and the player projection answer, and carry nothing of it.
        for (const route of ["encounterSummaries", "scenarioPlayerProjection"] as const) {
          expect(readings[route].statusCode, `${viewer} ${route}`).toBe(200);
          expect(
            disclosedLeaves({
              body: readings[route].body,
              forbidden: viewer === "latecomer" ? latecomerForbidden : rosterMemberForbidden,
            }),
            `${viewer} ${route}`,
          ).toEqual([]);
        }
      }

      // The owed measurement, recorded rather than built on: a GM roster write that submits a
      // resolvable roster is accepted on this state, and the player reads come back.
      // Re-submitting the stored roster unchanged is refused, so a GM write that carries this
      // roster through cannot land.
      expect(resubmission.statusCode).not.toBe(200);
      expect(resubmission.error).toContain("own identity");
      // A GM write that submits a resolvable roster *is* accepted on this same state, so a repair
      // path exists through the roster `PATCH`. #968 owns what that means for write semantics;
      // this issue records the figure and builds nothing on it.
      expect(repair.statusCode).toBe(200);
      expect(onstageAfterRepair.statusCode).toBe(200);
      expect([...onstageAfterRepair.participantLabels].sort()).toEqual(
        [current.characters.onstage.name, current.characters.partner.name].sort(),
      );
      expect(latecomerAfterRepair.encounterIds).toEqual([]);
    });
  });
}
