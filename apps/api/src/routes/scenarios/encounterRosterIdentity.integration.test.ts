import type { FastifyInstance } from "fastify";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { encounterParticipantSchema, encounterSessionSchema } from "@glantri/domain";

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
 * Forgejo #947 — an identity two rows can claim is not an identity.
 *
 * `encounterParticipantSchema` put no condition on a roster row's `id` and no condition
 * between that id, the row's Scenario-participant mapping and the character, while
 * `PATCH /encounters/:encounterId/participants` writes the collection wholesale. Two
 * rosters were therefore writable that no reader has a reading for:
 *
 * - two rows claiming one identity, which makes the GM's per-viewer visibility matrix
 *   answer a question about one combatant from the other's entry; and
 * - a row whose `id` is a Scenario participant's own identifier, which makes that
 *   participant **control** the row. Control is tested before visibility, so the
 *   visibility question is skipped rather than answered wrongly.
 *
 * Every figure here is driven through the product's own HTTP routes: the roster is
 * written with the GM's own `PATCH`, its acceptance or refusal is that route's status
 * code, and the consequence is read as the **raw 200 body** of
 * `GET /scenarios/:scenarioId/session` under a real player session cookie.
 */

const hasTaskApplicationDatabase =
  process.env.GLANTRI_DB_MODE === "task" && Boolean(process.env.DATABASE_URL);
const origin = "http://localhost:3361";

vi.setConfig({ testTimeout: 60_000 });

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

if (!hasTaskApplicationDatabase) {
  describe.skip("Encounter roster identity (task database not configured)", () => {});
} else {
  describe("The Encounter roster refuses an identity two rows can claim (#947)", () => {
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
     * Three Scenario participants. Two of them — `onstage` and `partner` — are the
     * Encounter's roster. `offstage` is an active Scenario participant who is **not** in
     * the Encounter, which is the condition that makes the control-resolution reach
     * invisible to any roster-local condition: their identity is not in the document the
     * roster schema sees.
     */
    async function seed() {
      const gm = await createTestUser(prisma, { displayName: "GM", roles: ["game_master"] });
      const onstageUser = await createTestUser(prisma, { displayName: "Onstage player" });
      const partnerUser = await createTestUser(prisma, { displayName: "Partner player" });
      const offstageUser = await createTestUser(prisma, { displayName: "Offstage player" });
      const campaign = await createTestCampaign(prisma, gm.id, { status: "active" });
      const onstageCharacter = await createTestCharacter(prisma, onstageUser.id, { name: "Bran" });
      const partnerCharacter = await createTestCharacter(prisma, partnerUser.id, { name: "Ceri" });
      const offstageCharacter = await createTestCharacter(prisma, offstageUser.id, { name: "Dag" });
      await prisma.campaignRosterEntry.createMany({
        data: [onstageCharacter, partnerCharacter, offstageCharacter].map((character) => ({
          campaignId: campaign.id,
          category: "pc",
          sourceId: character.id,
          sourceType: "character",
        })),
      });

      const equipment = new CharacterEquipmentWriteService();
      for (const character of [onstageCharacter, partnerCharacter, offstageCharacter]) {
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
        name: "The ford",
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
      const offstage = await scenarioService.addCharacterParticipant({
        characterId: offstageCharacter.id,
        controlledByUserId: offstageUser.id,
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
      // A non-empty per-viewer matrix: the store the GM's hide control writes, and the
      // only one that is not inert. Each roster member may see the other, and the matrix
      // carries no entry for the offstage participant at all — so no reading below can be
      // explained by an empty-matrix fail-open default.
      const visibility = {
        "encounter-participant-onstage": { "encounter-participant-partner": true },
        "encounter-participant-partner": { "encounter-participant-onstage": true },
      };

      const encounterService = new EncounterService();
      const draft = await encounterService.createEncounter({
        campaignId: campaign.id,
        scenarioId: scenario.id,
        session: encounterSessionSchema.parse({
          createdAt: "2026-11-04T10:00:00.000Z",
          id: `encounter-${scenario.id}`,
          kind: "combat",
          participantMembershipMode: "explicit",
          participants: legitimateRoster,
          roleplayState: { visibility },
          scenarioId: scenario.id,
          status: "draft",
          title: "The ford",
          updatedAt: "2026-11-04T10:00:00.000Z",
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
          offstage: offstageCharacter,
          onstage: onstageCharacter,
          partner: partnerCharacter,
        },
        cookies: {
          gm: await sessionCookie(gm.id),
          offstage: await sessionCookie(offstageUser.id),
          onstage: await sessionCookie(onstageUser.id),
          partner: await sessionCookie(partnerUser.id),
        },
        encounterId: started.id,
        legitimateRoster,
        participants: { offstage, onstage, partner },
        scenario,
        visibility,
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
        body: response.body,
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

    /** What a real player session receives, read as the raw 200 body. */
    async function playerSession(cookie: string, scenarioId: string) {
      const response = await app.inject({
        headers: { cookie, origin },
        method: "GET",
        url: `/scenarios/${scenarioId}/session`,
      });
      expect(response.statusCode, response.body).toBe(200);
      const payload = response.json<{
        session: {
          encounters?: { id: string; title: string }[];
          participants?: { displayName?: string; id: string }[];
          viewerMode: string;
        };
      }>();
      return {
        encounterIds: (payload.session.encounters ?? []).map((entry) => entry.id),
        participantNames: (payload.session.participants ?? []).map(
          (entry) => entry.displayName ?? entry.id,
        ),
        raw: response.body,
        viewerMode: payload.session.viewerMode,
      };
    }

    it("accepts a roster in which every combatant holds its own identity", async () => {
      const current = await seed();
      const accepted = await patchRoster({
        cookie: current.cookies.gm,
        encounterId: current.encounterId,
        participants: current.legitimateRoster,
      });
      const readBack = await new EncounterService().getEncounterById(current.encounterId);

      console.log(
        "B947-ROUTE-LEGITIMATE",
        JSON.stringify(
          {
            readBack: readBack!.participants.map((row) => [row.id, row.scenarioParticipantId]),
            statusCode: accepted.statusCode,
          },
          null,
          2,
        ),
      );

      expect(accepted.statusCode).toBe(200);
      expect(readBack!.participants.map((row) => row.id)).toEqual([
        "encounter-participant-onstage",
        "encounter-participant-partner",
      ]);
    });

    it("refuses a roster in which two rows claim one identity", async () => {
      const current = await seed();
      const refused = await patchRoster({
        cookie: current.cookies.gm,
        encounterId: current.encounterId,
        participants: [
          current.legitimateRoster[0]!,
          // The partner's row takes the onstage combatant's row id. The GM's matrix grants
          // sight of that id, so the entry the GM wrote about one combatant would answer
          // for the other.
          { ...current.legitimateRoster[1]!, id: "encounter-participant-onstage" },
        ],
      });
      const readBack = await new EncounterService().getEncounterById(current.encounterId);

      console.log(
        "B947-ROUTE-COLLIDING-IDENTITY",
        JSON.stringify(
          {
            error: refused.error,
            readBackUnchanged: readBack!.participants.map((row) => row.id),
            statusCode: refused.statusCode,
          },
          null,
          2,
        ),
      );

      expect(refused.statusCode).not.toBe(200);
      expect(refused.error).toContain("claim the identity");
      expect(readBack!.participants.map((row) => row.id)).toEqual([
        "encounter-participant-onstage",
        "encounter-participant-partner",
      ]);
    });

    it("refuses a roster row whose identity belongs to a Scenario participant it does not describe", async () => {
      const current = await seed();
      // The reaching condition the roster schema cannot see on its own: the identity the
      // row borrows belongs to a participant who is not on this roster at all.
      const borrowed = [
        { ...current.legitimateRoster[0]!, id: current.participants.offstage.id },
        current.legitimateRoster[1]!,
      ];
      const refused = await patchRoster({
        cookie: current.cookies.gm,
        encounterId: current.encounterId,
        participants: borrowed,
      });
      const readBack = await new EncounterService().getEncounterById(current.encounterId);
      const offstageReading = await playerSession(current.cookies.offstage, current.scenario.id);

      console.log(
        "B947-ROUTE-BORROWED-IDENTITY",
        JSON.stringify(
          {
            error: refused.error,
            offstageEncounterIds: offstageReading.encounterIds,
            offstageParticipantNames: offstageReading.participantNames,
            offstageViewerMode: offstageReading.viewerMode,
            readBackUnchanged: readBack!.participants.map((row) => row.id),
            statusCode: refused.statusCode,
          },
          null,
          2,
        ),
      );

      expect(refused.statusCode).not.toBe(200);
      expect(refused.error).toContain("own identity");
      expect(readBack!.participants.map((row) => row.id)).toEqual([
        "encounter-participant-onstage",
        "encounter-participant-partner",
      ]);
      // The offstage player is not in this Encounter and, with the borrowed identity
      // refused, nothing about it reaches their real 200 session body.
      expect(offstageReading.viewerMode).toBe("player");
      expect(offstageReading.encounterIds).toEqual([]);
      expect(offstageReading.participantNames).toEqual([current.characters.offstage.name]);
    });

    it("refuses a roster row carrying another participant's character", async () => {
      const current = await seed();
      const refused = await patchRoster({
        cookie: current.cookies.gm,
        encounterId: current.encounterId,
        participants: [
          { ...current.legitimateRoster[0]!, characterId: current.characters.offstage.id },
          current.legitimateRoster[1]!,
        ],
      });

      console.log(
        "B947-ROUTE-BORROWED-CHARACTER",
        JSON.stringify({ error: refused.error, statusCode: refused.statusCode }, null, 2),
      );

      expect(refused.statusCode).not.toBe(200);
      expect(refused.error).toContain("own identity");
    });

    it("refuses an identity collision placed in the roster held for the round boundary", async () => {
      const current = await seed();
      const encounterService = new EncounterService();
      const live = await encounterService.getEncounterById(current.encounterId);
      const refusal = await encounterService
        .updateEncounter({
          campaignId: current.campaign.id,
          encounterId: current.encounterId,
          expectedRevision: live!.updatedAt,
          scenarioId: current.scenario.id,
          session: {
            ...live!,
            pendingParticipants: [
              encounterParticipantSchema.parse(current.legitimateRoster[0]!),
              encounterParticipantSchema.parse({
                ...current.legitimateRoster[1]!,
                id: "encounter-participant-onstage",
              }),
            ],
          },
        })
        .then(() => undefined)
        .catch((error: unknown) => (error instanceof Error ? error.message : String(error)));

      console.log("B947-ROUTE-HELD-ROSTER", JSON.stringify({ refusal }, null, 2));

      expect(refusal).toContain("claim the identity");
    });
  });
}
