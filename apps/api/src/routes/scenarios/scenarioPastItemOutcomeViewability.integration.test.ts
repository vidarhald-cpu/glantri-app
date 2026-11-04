import type { FastifyInstance } from "fastify";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  advanceCombatRoundStep,
  combatRoundStateSchema,
  commitCombatRoundEndParticipantReview,
  encounterSessionSchema,
  initializeCombatRoundState,
  isCombatRoundEndReviewComplete,
  prepareCombatRoundEndReview,
  type EncounterSession,
} from "@glantri/domain";

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
 * Forgejo #930 — whether a **past** Item action can be viewed must not be decided by who is on the
 * Encounter roster **now**.
 *
 * `canViewCurrentItemOutcome` resolved the action's owner against `encounter.participants` and then
 * asked the live player-safe combat scope whether that owner is visible. Both reads are the present
 * roster, so removing the acting combatant changed the viewability of an outcome that had already
 * happened — the breach the Product Owner's architecture statement forbids.
 *
 * Every figure below is driven through the product's own HTTP routes:
 *
 * - the Item outcome is written by the real `item-interactions` lifecycle (`declare`, `review`,
 *   `activate`, `resolve`), so the `encounter_combat_outcome` row and its recorded audience are
 *   production output rather than fixture data;
 * - the roster change is made with the GM's own `PATCH /encounters/:encounterId/participants`, in
 *   the between-rounds window the roster ruling sanctions;
 * - viewability is read as the **raw 200 body** of `GET /scenarios/:scenarioId/session` under a
 *   real player session cookie, never from a render and never by calling the gate directly.
 *
 * The round boundary itself is taken with the real engine — the round-end review is prepared and
 * committed per participant, and `advanceCombatRoundStep` then archives the round through the same
 * path a GM's Start New Round takes — rather than by walking a whole round of GM decisions through
 * their routes, and the advanced state is persisted through the real `EncounterService`. That is
 * the only place this file uses the engine instead of a route, and it is not the behaviour under
 * measurement: the active-round case below reaches the same figure without it.
 */

const hasTaskApplicationDatabase =
  process.env.GLANTRI_DB_MODE === "task" && Boolean(process.env.DATABASE_URL);
const origin = "http://localhost:3361";

vi.setConfig({ testTimeout: 60_000 });

type HistoryRow = {
  actorParticipantId?: string;
  eventKind: string;
  id: string;
  summary: string;
  type: string;
};
type SessionPayload = { session: { history: HistoryRow[]; viewerMode: string } };

const ITEM_FACTS = {
  activeMechanics: [],
  descriptiveTraits: [],
  templateOverrides: [],
  unsupportedCapabilities: [],
  version: 1 as const,
};

const RESULT_TEXT = "The dagger changed hands.";

async function sessionCookie(userId: string): Promise<string> {
  const { token } = await new AuthService().createSessionForUser(userId);
  return `${SESSION_COOKIE_NAME}=${token}`;
}

if (!hasTaskApplicationDatabase) {
  describe.skip("Past Item outcome viewability (task database not configured)", () => {});
} else {
  describe("A past Item outcome's viewability does not follow the present roster (#930)", () => {
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
     * Three combatants, so the measurement has both of its controls:
     *
     * - **recipient** is the viewer whose own status never changes. The Item is *passed* to them, so
     *   the recorded audience of the outcome is `{owner, recipient}` — a `drop` would have recorded
     *   the owner alone and made every reading of the recipient vacuous.
     * - **owner** performs the Item action and is the combatant later removed.
     * - **bystander** is in the Encounter and sees everyone, but is not in the recorded audience.
     *   They must never receive the row, before or after the removal.
     */
    async function seed() {
      const gm = await createTestUser(prisma, { displayName: "GM", roles: ["game_master"] });
      const ownerUser = await createTestUser(prisma, { displayName: "Owner player" });
      const recipientUser = await createTestUser(prisma, { displayName: "Recipient player" });
      const bystanderUser = await createTestUser(prisma, { displayName: "Bystander player" });
      const campaign = await createTestCampaign(prisma, gm.id, { status: "active" });
      const ownerCharacter = await createTestCharacter(prisma, ownerUser.id, { name: "Bran" });
      const recipientCharacter = await createTestCharacter(prisma, recipientUser.id, {
        name: "Ceri",
      });
      const bystanderCharacter = await createTestCharacter(prisma, bystanderUser.id, {
        name: "Dag",
      });
      await prisma.campaignRosterEntry.createMany({
        data: [ownerCharacter, recipientCharacter, bystanderCharacter].map((character) => ({
          campaignId: campaign.id,
          category: "pc",
          sourceId: character.id,
          sourceType: "character",
        })),
      });

      // Equipment is settled before any participant snapshot is taken: a Campaign Item created
      // after the snapshot makes Scenario equipment stale and the GM must reconcile it first.
      const equipment = new CharacterEquipmentWriteService();
      for (const character of [ownerCharacter, recipientCharacter, bystanderCharacter]) {
        await equipment.ensureCharacterEquipmentInitialized(character.id);
      }
      const created = await equipment.createCampaignEquipmentItem({
        campaignId: campaign.id,
        displayName: "Silver dagger",
        holderCharacterId: ownerCharacter.id,
        itemFacts: { ...ITEM_FACTS },
        templateId: "weapon-template-dagger",
      });
      await equipment.setCharacterActiveWeapon(ownerCharacter.id, "primary", created.id);

      const scenarioService = new ScenarioService();
      const scenario = await scenarioService.createScenario({
        campaignId: campaign.id,
        name: "The ford",
        status: "live",
      });
      const ownerParticipant = await scenarioService.addCharacterParticipant({
        characterId: ownerCharacter.id,
        controlledByUserId: ownerUser.id,
        joinSource: "gm_added",
        scenarioId: scenario.id,
      });
      const recipientParticipant = await scenarioService.addCharacterParticipant({
        characterId: recipientCharacter.id,
        controlledByUserId: recipientUser.id,
        joinSource: "gm_added",
        scenarioId: scenario.id,
      });
      const bystanderParticipant = await scenarioService.addCharacterParticipant({
        characterId: bystanderCharacter.id,
        controlledByUserId: bystanderUser.id,
        joinSource: "gm_added",
        scenarioId: scenario.id,
      });

      const encounterService = new EncounterService();
      const encounterId = `encounter-${scenario.id}`;
      const encounterParticipants = [
        {
          characterId: ownerCharacter.id,
          id: "encounter-participant-owner",
          label: ownerCharacter.name,
          participantType: "character",
          scenarioParticipantId: ownerParticipant.id,
        },
        {
          characterId: recipientCharacter.id,
          id: "encounter-participant-recipient",
          label: recipientCharacter.name,
          participantType: "character",
          scenarioParticipantId: recipientParticipant.id,
        },
        {
          characterId: bystanderCharacter.id,
          id: "encounter-participant-bystander",
          label: bystanderCharacter.name,
          participantType: "character",
          scenarioParticipantId: bystanderParticipant.id,
        },
      ];
      // A non-empty per-viewer matrix, which is the store the GM's hide control writes and the only
      // one that is not inert. Every combatant is given sight of every other, so the before/after
      // pair cannot be explained by an empty-matrix fail-open default.
      const everyoneSeesEveryone = Object.fromEntries(
        encounterParticipants.map((viewer) => [
          viewer.id,
          Object.fromEntries(
            encounterParticipants
              .filter((target) => target.id !== viewer.id)
              .map((target) => [target.id, true]),
          ),
        ]),
      );
      const draft = await encounterService.createEncounter({
        campaignId: campaign.id,
        scenarioId: scenario.id,
        session: encounterSessionSchema.parse({
          createdAt: "2026-11-04T10:00:00.000Z",
          id: encounterId,
          kind: "combat",
          participantMembershipMode: "explicit",
          participants: encounterParticipants,
          roleplayState: { visibility: everyoneSeesEveryone },
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
        encounterId: started.id,
        encounterService,
        item: created,
        participants: {
          bystander: bystanderParticipant,
          owner: ownerParticipant,
          recipient: recipientParticipant,
        },
        scenario,
        cookies: {
          bystander: await sessionCookie(bystanderUser.id),
          gm: await sessionCookie(gm.id),
          owner: await sessionCookie(ownerUser.id),
          recipient: await sessionCookie(recipientUser.id),
        },
      };
    }

    async function encounterRevision(encounterId: string): Promise<EncounterSession> {
      const current = await new EncounterService().getEncounterById(encounterId);
      expect(current).toBeTruthy();
      return current!;
    }

    async function itemAction(input: {
      cookie: string;
      encounterId: string;
      payload: Record<string, unknown>;
    }) {
      const current = await encounterRevision(input.encounterId);
      const response = await app.inject({
        headers: { cookie: input.cookie, origin },
        method: "POST",
        payload: { expectedRevision: current.updatedAt, ...input.payload },
        url: `/encounters/${input.encounterId}/combat-round/item-interactions`,
      });
      expect(response.statusCode, response.body).toBe(200);
      return response;
    }

    /** The outcome row as the Activity projection delivers it to this viewer, at HTTP 200. */
    async function itemOutcomeRows(cookie: string, scenarioId: string) {
      const response = await app.inject({
        headers: { cookie, origin },
        method: "GET",
        url: `/scenarios/${scenarioId}/session`,
      });
      expect(response.statusCode, response.body).toBe(200);
      const payload = response.json<SessionPayload>();
      return {
        all: payload.session.history,
        itemRows: payload.session.history.filter((row) => row.eventKind === "item_resolution"),
        raw: response.body,
        viewerMode: payload.session.viewerMode,
      };
    }

    /** Resolve a passed Item through the real Item-action lifecycle, as the GM. */
    async function resolveItemPass(current: Awaited<ReturnType<typeof seed>>) {
      const actionId = "item-action-pass-930";
      const latestItem = await prisma.characterEquipmentItem.findUniqueOrThrow({
        where: { id: current.item.id },
      });
      await itemAction({
        cookie: current.cookies.gm,
        encounterId: current.encounterId,
        payload: {
          actionId,
          expectedItemRevision: latestItem.updatedAt.toISOString(),
          itemId: current.item.id,
          itemOperation: "pass",
          operation: "declare",
          participantId: "encounter-participant-owner",
          recipientParticipantId: "encounter-participant-recipient",
          visibleToParticipantIds: [],
        },
      });
      await itemAction({
        cookie: current.cookies.gm,
        encounterId: current.encounterId,
        payload: { actionId, operation: "review", visibleToParticipantIds: [] },
      });
      await itemAction({
        cookie: current.cookies.gm,
        encounterId: current.encounterId,
        payload: { actionId, operation: "activate", visibleToParticipantIds: [] },
      });
      await itemAction({
        cookie: current.cookies.gm,
        encounterId: current.encounterId,
        payload: {
          actionId,
          operation: "resolve",
          resultText: RESULT_TEXT,
          visibleToParticipantIds: [
            "encounter-participant-owner",
            "encounter-participant-recipient",
          ],
        },
      });
      return actionId;
    }

    /** Take the round boundary, so the resolved action belongs to a completed round. */
    async function completeRound(current: Awaited<ReturnType<typeof seed>>) {
      const before = await encounterRevision(current.encounterId);
      const createdAt = "2026-11-04T11:00:00.000Z";
      const scenarioParticipantByEncounterParticipantId = new Map(
        before.participants.map((participant) => [
          participant.id,
          participant.scenarioParticipantId!,
        ]),
      );
      let state = combatRoundStateSchema.parse({
        ...initializeCombatRoundState({ encounter: before }),
        currentStep: "round_summary",
      });
      const roundNumber = state.roundNumber;
      state = prepareCombatRoundEndReview({ command: { createdAt }, state });
      for (const participant of state.participants) {
        state = commitCombatRoundEndParticipantReview({
          command: { createdAt, createdByUserId: "gm" },
          participantId: participant.participantId,
          scenarioParticipantId: scenarioParticipantByEncounterParticipantId.get(
            participant.participantId,
          )!,
          state,
        }).state;
      }
      expect(isCombatRoundEndReviewComplete(state)).toBe(true);
      const advanced = advanceCombatRoundStep(state, { command: { createdAt } });
      expect(advanced.roundNumber).toBe(roundNumber + 1);
      expect(advanced.rounds.map((round) => round.roundNumber)).toEqual([roundNumber]);
      await current.encounterService.updateCombatEncounter({
        campaignId: current.campaign.id,
        encounterId: current.encounterId,
        expectedRevision: before.updatedAt,
        scenarioId: current.scenario.id,
        session: { ...before, combatRoundState: advanced },
      });
      return advanced;
    }

    /** The GM's own roster route, in the between-rounds window. */
    async function removeOwnerFromRoster(current: Awaited<ReturnType<typeof seed>>) {
      const before = await encounterRevision(current.encounterId);
      const response = await app.inject({
        headers: { cookie: current.cookies.gm, origin },
        method: "PATCH",
        payload: {
          expectedRevision: before.updatedAt,
          participantMembershipMode: "explicit",
          participants: before.participants.filter(
            (participant) => participant.id !== "encounter-participant-owner",
          ),
        },
        url: `/encounters/${current.encounterId}/participants`,
      });
      expect(response.statusCode, response.body).toBe(200);
      const after = await encounterRevision(current.encounterId);
      // The change applied now rather than waiting: that is the between-rounds window, and it is
      // the state the measurement needs. `pendingParticipants` being unset proves nothing was held.
      expect(after.participants.map((participant) => participant.id)).toEqual([
        "encounter-participant-recipient",
        "encounter-participant-bystander",
      ]);
      expect(after.pendingParticipants).toBeUndefined();
      return after;
    }

    it("keeps a completed round's Item outcome viewable to an unchanged viewer after the actor leaves", async () => {
      const current = await seed();
      await resolveItemPass(current);
      await completeRound(current);

      const archived = await encounterRevision(current.encounterId);
      expect(
        archived.combatRoundState!.rounds.flatMap((round) =>
          round.genericActions.map((action) => action.id),
        ),
      ).toContain("item-action-pass-930");

      const before = await itemOutcomeRows(current.cookies.recipient, current.scenario.id);
      expect(before.viewerMode).toBe("player");

      await removeOwnerFromRoster(current);

      const after = await itemOutcomeRows(current.cookies.recipient, current.scenario.id);
      expect(after.viewerMode).toBe("player");

      // The measurement, asserted as the pair rather than as two readings, so a failure prints the
      // before and the after together. The recipient's own participation, control and visibility
      // rows are untouched by the removal, so a difference here can only come from the past being
      // recalculated against the present roster.
      expect({
        afterTheRemoval: after.itemRows.map((row) => row.summary),
        beforeTheRemoval: before.itemRows.map((row) => row.summary),
      }).toEqual({
        afterTheRemoval: [RESULT_TEXT],
        beforeTheRemoval: [RESULT_TEXT],
      });

      // Enumerated by response key rather than by route: the repair restores the departed actor's
      // row into the collection the entitlement helper resolves over, and that row must not reach
      // the body. The delivered keys are identical before and after, and the only Encounter
      // participant id in either body is the viewer's own.
      expect(new Set(after.all.flatMap((row) => Object.keys(row)))).toEqual(
        new Set(before.all.flatMap((row) => Object.keys(row))),
      );
      // No Encounter participant id reaches this body at all, before or after: the Activity row
      // addresses its actor in Scenario-participant space, which is the space the row recorded.
      for (const body of [before.raw, after.raw]) {
        expect(body).not.toContain("encounter-participant-owner");
        expect(body).not.toContain("encounter-participant-recipient");
      }
      expect(after.all.map((row) => row.actorParticipantId)).toContain(
        current.participants.owner.id,
      );
    });

    it("gives the same answer while the action is still in the active round", async () => {
      const current = await seed();
      await resolveItemPass(current);

      const before = await itemOutcomeRows(current.cookies.recipient, current.scenario.id);
      expect(before.itemRows).toHaveLength(1);

      // A roster change part-way through a round is held to the boundary, so the active-round
      // reading needs the boundary taken first; the action is carried forward and is therefore in
      // the active round as well as the archive.
      await completeRound(current);
      await removeOwnerFromRoster(current);
      const live = await encounterRevision(current.encounterId);
      expect(live.combatRoundState!.genericActions.map((action) => action.id)).toContain(
        "item-action-pass-930",
      );

      const after = await itemOutcomeRows(current.cookies.recipient, current.scenario.id);
      expect(after.itemRows).toHaveLength(1);
    });

    it("discloses the outcome to nobody new, and keeps the GM record whole", async () => {
      const current = await seed();
      await resolveItemPass(current);
      await completeRound(current);

      const bystanderBefore = await itemOutcomeRows(current.cookies.bystander, current.scenario.id);
      expect(bystanderBefore.itemRows).toEqual([]);
      expect(bystanderBefore.raw).not.toContain(RESULT_TEXT);

      await removeOwnerFromRoster(current);

      // The direction that would be the more serious defect: a removal must not open a past
      // outcome to a viewer who was never in its recorded audience.
      const bystanderAfter = await itemOutcomeRows(current.cookies.bystander, current.scenario.id);
      expect(bystanderAfter.itemRows).toEqual([]);
      expect(bystanderAfter.raw).not.toContain(RESULT_TEXT);

      const gmAfter = await itemOutcomeRows(current.cookies.gm, current.scenario.id);
      expect(gmAfter.viewerMode).toBe("gm");
      expect(gmAfter.itemRows.map((row) => row.summary)).toEqual([RESULT_TEXT]);
    });

    it("still withholds the outcome from an audience member the GM has hidden the actor from", async () => {
      const current = await seed();
      await resolveItemPass(current);
      await completeRound(current);

      // The GM hides the acting combatant from the recipient. This is the live per-viewer store,
      // and it must keep denying after the removal: the visibility gate is a separate decision
      // from the identity of a historical actor, and repairing the identity half must not collapse
      // it.
      const beforeHide = await encounterRevision(current.encounterId);
      await current.encounterService.updateCombatEncounter({
        campaignId: current.campaign.id,
        encounterId: current.encounterId,
        expectedRevision: beforeHide.updatedAt,
        scenarioId: current.scenario.id,
        session: {
          ...beforeHide,
          roleplayState: {
            ...beforeHide.roleplayState!,
            visibility: {
              ...beforeHide.roleplayState!.visibility,
              "encounter-participant-recipient": {
                "encounter-participant-bystander": true,
                "encounter-participant-owner": false,
              },
            },
          },
        },
      });

      const hiddenBefore = await itemOutcomeRows(current.cookies.recipient, current.scenario.id);
      expect(hiddenBefore.itemRows).toEqual([]);
      expect(hiddenBefore.raw).not.toContain(RESULT_TEXT);

      await removeOwnerFromRoster(current);

      const hiddenAfter = await itemOutcomeRows(current.cookies.recipient, current.scenario.id);
      expect(hiddenAfter.itemRows).toEqual([]);
      expect(hiddenAfter.raw).not.toContain(RESULT_TEXT);
    });
  });
}
