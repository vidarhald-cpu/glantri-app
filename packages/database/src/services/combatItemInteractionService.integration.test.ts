import { beforeEach, describe, expect, it } from "vitest";

import { encounterSessionSchema, initializeCombatRoundState } from "@glantri/domain";

import { createPrismaCharacterEquipmentRepository } from "../repositories/characterEquipmentRepository";
import { createPrismaCombatStatePersistenceRepository } from "../repositories/combatStatePersistenceRepository";
import { getTestPrismaClient, resetTestDatabase } from "../testing/testDatabase";
import { createTestCampaign, createTestCharacter, createTestUser } from "../testing/factories";
import { CharacterEquipmentWriteService } from "./characterEquipmentWriteService";
import { CombatItemInteractionService } from "./combatItemInteractionService";

const prisma = getTestPrismaClient();

if (!process.env.DATABASE_URL_TEST) {
  describe.skip("Combat Item atomic resolution integration (DATABASE_URL_TEST not set)", () => {});
} else {
  describe("Combat Item atomic resolution integration", () => {
    beforeEach(async () => {
      await resetTestDatabase(prisma!);
    });

    async function fixture(suffix: string) {
      const gm = await createTestUser(prisma!, { roles: ["game_master"] });
      const player = await createTestUser(prisma!);
      const character = await createTestCharacter(prisma!, player.id);
      const campaign = await createTestCampaign(prisma!, gm.id);
      const scenario = await prisma!.scenario.create({
        data: {
          campaignId: campaign.id,
          description: "Atomic Item resolution",
          kind: "combat",
          name: `Atomic ${suffix}`,
          status: "live",
        },
      });
      await prisma!.campaignRosterEntry.create({
        data: {
          campaignId: campaign.id,
          category: "pc",
          sourceId: character.id,
          sourceType: "character",
        },
      });

      const itemRepository = createPrismaCharacterEquipmentRepository(prisma!);
      const equipmentService = new CharacterEquipmentWriteService(itemRepository);
      await equipmentService.ensureCharacterEquipmentInitialized(character.id);
      const item = await equipmentService.createCampaignEquipmentItem({
        campaignId: campaign.id,
        displayName: `Atomic dagger ${suffix}`,
        holderCharacterId: character.id,
        itemFacts: {
          activeMechanics: [],
          descriptiveTraits: [],
          templateOverrides: [],
          unsupportedCapabilities: [],
          version: 1,
        },
        templateId: "weapon-template-dagger",
      });

      const encounterId = `atomic-encounter-${suffix}`;
      const base = encounterSessionSchema.parse({
        campaignId: campaign.id,
        createdAt: "2026-08-16T10:00:00.000Z",
        currentRound: 1,
        id: encounterId,
        kind: "combat",
        participants: [
          {
            characterId: character.id,
            id: `participant-${suffix}`,
            label: character.name,
            participantType: "character",
          },
        ],
        scenarioId: scenario.id,
        status: "active",
        title: `Atomic encounter ${suffix}`,
        updatedAt: "2026-08-16T10:00:00.000Z",
      });
      const roundState = initializeCombatRoundState({ encounter: base });
      const actionId = `atomic-action-${suffix}`;
      const activeSession = encounterSessionSchema.parse({
        ...base,
        combatRoundState: {
          ...roundState,
          genericActions: [
            {
              createdAt: "2026-08-16T10:01:00.000Z",
              duration: { kind: "gm_decided" },
              id: actionId,
              intent: `Drop Atomic dagger ${suffix}`,
              itemInteraction: {
                itemId: item.id,
                itemLabel: `Atomic dagger ${suffix}`,
                itemRevision: item.revision,
                operation: "drop",
                stateAtDeclaration: "held",
                visibleToParticipantIds: [`participant-${suffix}`],
              },
              lastUpdatedAt: "2026-08-16T10:02:00.000Z",
              ownerParticipantId: `participant-${suffix}`,
              preset: "item_interaction",
              progress: {
                completedRounds: 0,
                startedRoundNumber: 1,
                startedStep: "select_actions",
              },
              reference: {
                itemId: item.id,
                kind: "item",
                label: `Atomic dagger ${suffix}`,
                ownerParticipantId: `participant-${suffix}`,
              },
              status: "active",
            },
          ],
        },
      });
      const created = await prisma!.encounter.create({
        data: {
          campaignId: campaign.id,
          id: encounterId,
          name: activeSession.title,
          scenarioId: scenario.id,
          sessionJson: activeSession as never,
          status: activeSession.status,
        },
      });
      const persisted = await createPrismaCombatStatePersistenceRepository(
        prisma!,
      ).updateCombatEncounter({
        campaignId: campaign.id,
        encounterId,
        expectedRevision: created.updatedAt.toISOString(),
        scenarioId: scenario.id,
        session: activeSession,
      });
      const completedSession = encounterSessionSchema.parse({
        ...persisted,
        combatRoundState: {
          ...persisted.combatRoundState!,
          genericActions: persisted.combatRoundState!.genericActions.map((action) => ({
            ...action,
            lastUpdatedAt: "2026-08-16T10:03:00.000Z",
            resolution: {
              resolvedAt: "2026-08-16T10:03:00.000Z",
              text: "The exact dagger is now present and unheld.",
              visibleToParticipantIds: [`participant-${suffix}`],
            },
            status: "completed",
          })),
        },
      });

      return {
        actionId,
        campaign,
        character,
        completedSession,
        encounterId,
        gm,
        item,
        itemRepository,
        persisted,
        scenario,
      };
    }

    it("rolls back Item, Encounter completion, and event after every injected transaction boundary", async () => {
      for (const boundary of ["item", "encounter", "event"] as const) {
        const current = await fixture(boundary);
        const beforeItem = await current.itemRepository.getCanonicalEquipmentItemById(
          current.item.id,
        );
        const beforeEncounter = await prisma!.encounter.findUniqueOrThrow({
          include: { activeCombatState: true },
          where: { id: current.encounterId },
        });
        const failing = new CombatItemInteractionService(
          current.itemRepository,
          prisma!,
          (reached) => {
            if (reached === boundary) throw new Error(`injected-${boundary}`);
          },
        );
        const input = {
          actionId: current.actionId,
          actorUserId: current.gm.id,
          campaignId: current.campaign.id,
          encounterId: current.encounterId,
          encounterSession: current.completedSession,
          expectedEncounterRevision: current.persisted.updatedAt,
          interaction:
            current.completedSession.combatRoundState!.genericActions[0]!.itemInteraction!,
          ownerCharacterId: current.character.id,
          roundNumber: 1,
          scenarioId: current.scenario.id,
        };

        await expect(failing.commitResolution(input)).rejects.toThrow(`injected-${boundary}`);

        expect(await current.itemRepository.getCanonicalEquipmentItemById(current.item.id)).toEqual(
          beforeItem,
        );
        const afterEncounter = await prisma!.encounter.findUniqueOrThrow({
          include: { activeCombatState: true },
          where: { id: current.encounterId },
        });
        expect(afterEncounter.updatedAt).toEqual(beforeEncounter.updatedAt);
        expect(afterEncounter.activeCombatState?.stateJson).toEqual(
          beforeEncounter.activeCombatState?.stateJson,
        );
        expect(
          await prisma!.scenarioEventLog.count({ where: { scenarioId: current.scenario.id } }),
        ).toBe(0);

        const committed = await new CombatItemInteractionService(
          current.itemRepository,
          prisma!,
        ).commitResolution(input);
        expect(committed.item).toMatchObject({
          alreadyApplied: false,
          item: { holderCharacterId: null, id: current.item.id },
        });
        expect(committed.encounter.combatRoundState?.genericActions[0]).toMatchObject({
          status: "completed",
        });
        expect(await prisma!.characterEquipmentItem.count({ where: { id: current.item.id } })).toBe(
          1,
        );
        expect(
          await prisma!.scenarioEventLog.count({ where: { scenarioId: current.scenario.id } }),
        ).toBe(1);
      }
    });
  });
}
