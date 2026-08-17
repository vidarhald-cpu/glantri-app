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
      const recipientUser = await createTestUser(prisma!);
      const character = await createTestCharacter(prisma!, player.id);
      const recipient = await createTestCharacter(prisma!, recipientUser.id);
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
      await prisma!.campaignRosterEntry.createMany({
        data: [character, recipient].map((entry) => ({
          campaignId: campaign.id,
          category: "pc",
          sourceId: entry.id,
          sourceType: "character",
        })),
      });

      const itemRepository = createPrismaCharacterEquipmentRepository(prisma!);
      const equipmentService = new CharacterEquipmentWriteService(itemRepository);
      await equipmentService.ensureCharacterEquipmentInitialized(character.id);
      await equipmentService.ensureCharacterEquipmentInitialized(recipient.id);
      const createdItem = await equipmentService.createCampaignEquipmentItem({
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
      await equipmentService.setCharacterActiveWeapon(character.id, "primary", createdItem.id);
      const item = (await itemRepository.getCanonicalEquipmentItemById(createdItem.id))!;

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
          {
            characterId: recipient.id,
            id: `participant-recipient-${suffix}`,
            label: recipient.name,
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
        recipient,
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

    it("atomically drops the exact thrown Item on attack execution and restores it on exact undo", async () => {
      for (const boundary of ["item", "encounter", "event"] as const) {
        const current = await fixture(`thrown-rollback-${boundary}`);
        const commandId = `thrown-command-${boundary}`;
        const cursor = current.persisted.combatRoundState!.currentCursor;
        const session = encounterSessionSchema.parse({
          ...current.persisted,
          combatRoundState: {
            ...current.persisted.combatRoundState!,
            commands: [
              ...current.persisted.combatRoundState!.commands,
              {
                afterCursor: cursor,
                beforeCursor: cursor,
                createdAt: "2026-08-16T10:04:00.000Z",
                facts: { attackResult: boundary === "item" ? "miss" : "hit" },
                id: commandId,
                participantId: `participant-thrown-rollback-${boundary}`,
                roundNumber: 1,
                type: "roll_attack",
              },
            ],
          },
          updatedAt: "2026-08-16T10:04:00.000Z",
        });
        const beforeItem = await current.itemRepository.getCanonicalEquipmentItemById(
          current.item.id,
        );
        const beforeLoadouts = await current.itemRepository.getCharacterLoadouts(
          current.character.id,
        );
        const beforeEncounter = await prisma!.encounter.findUniqueOrThrow({
          include: { activeCombatState: true },
          where: { id: current.encounterId },
        });
        const service = new CombatItemInteractionService(
          current.itemRepository,
          prisma!,
          (reached) => {
            if (reached === boundary) throw new Error(`injected-thrown-${boundary}`);
          },
        );

        await expect(
          service.commitThrownWeaponAttack({
            actorUserId: current.gm.id,
            campaignId: current.campaign.id,
            commandId,
            encounterId: current.encounterId,
            expectedEncounterRevision: current.persisted.updatedAt,
            itemId: current.item.id,
            ownerCharacterId: current.character.id,
            roundNumber: 1,
            scenarioId: current.scenario.id,
            session,
            templateId: current.item.templateId,
          }),
        ).rejects.toThrow(`injected-thrown-${boundary}`);

        expect(await current.itemRepository.getCanonicalEquipmentItemById(current.item.id)).toEqual(
          beforeItem,
        );
        expect(await current.itemRepository.getCharacterLoadouts(current.character.id)).toEqual(
          beforeLoadouts,
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
      }

      const current = await fixture("thrown-success");
      const commandId = "thrown-command-success";
      const cursor = current.persisted.combatRoundState!.currentCursor;
      const session = encounterSessionSchema.parse({
        ...current.persisted,
        combatRoundState: {
          ...current.persisted.combatRoundState!,
          commands: [
            ...current.persisted.combatRoundState!.commands,
            {
              afterCursor: cursor,
              beforeCursor: cursor,
              createdAt: "2026-08-16T10:04:00.000Z",
              facts: { attackResult: "miss" },
              id: commandId,
              participantId: "participant-thrown-success",
              roundNumber: 1,
              type: "roll_attack",
            },
          ],
        },
        updatedAt: "2026-08-16T10:04:00.000Z",
      });
      const service = new CombatItemInteractionService(current.itemRepository, prisma!);
      const committed = await service.commitThrownWeaponAttack({
        actorUserId: current.gm.id,
        campaignId: current.campaign.id,
        commandId,
        encounterId: current.encounterId,
        expectedEncounterRevision: current.persisted.updatedAt,
        itemId: current.item.id,
        ownerCharacterId: current.character.id,
        roundNumber: 1,
        scenarioId: current.scenario.id,
        session,
        templateId: current.item.templateId,
      });

      expect(committed.item.item).toMatchObject({
        holderCharacterId: null,
        id: current.item.id,
        isEquipped: false,
        storageAssignment: null,
      });
      expect(
        (await current.itemRepository.getCharacterLoadouts(current.character.id))[0]
          ?.activePrimaryWeaponItemId,
      ).toBeNull();
      const persistedCommand = committed.encounter.combatRoundState!.commands.find(
        (command) => command.id === commandId,
      )!;
      expect(persistedCommand.facts.thrownWeaponUndo).toMatchObject({
        actionId: commandId,
        itemBefore: { id: current.item.id },
        ownerCharacterId: current.character.id,
        version: 1,
      });
      expect(
        await current.itemRepository.getCombatItemInteractionRecords(current.campaign.id),
      ).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            item: expect.objectContaining({ holderCharacterId: null, id: current.item.id }),
            presentEncounterId: current.encounterId,
          }),
        ]),
      );

      await expect(
        service.commitThrownWeaponAttack({
          actorUserId: current.gm.id,
          campaignId: current.campaign.id,
          commandId,
          encounterId: current.encounterId,
          expectedEncounterRevision: current.persisted.updatedAt,
          itemId: current.item.id,
          ownerCharacterId: current.character.id,
          roundNumber: 1,
          scenarioId: current.scenario.id,
          session,
          templateId: current.item.templateId,
        }),
      ).rejects.toBeInstanceOf(Error);
      expect(await prisma!.characterEquipmentItem.count({ where: { id: current.item.id } })).toBe(
        1,
      );
      expect(
        await prisma!.scenarioEventLog.count({ where: { scenarioId: current.scenario.id } }),
      ).toBe(1);

      const restoredSession = encounterSessionSchema.parse({
        ...committed.encounter,
        combatRoundState: {
          ...committed.encounter.combatRoundState!,
          commands: committed.encounter.combatRoundState!.commands.filter(
            (command) => command.id !== commandId,
          ),
        },
        updatedAt: "2026-08-16T10:05:00.000Z",
      });
      await service.commitThrownWeaponAttackUndo({
        actorUserId: current.gm.id,
        campaignId: current.campaign.id,
        encounterId: current.encounterId,
        expectedEncounterRevision: committed.encounter.updatedAt,
        scenarioId: current.scenario.id,
        session: restoredSession,
        undos: [
          {
            commandId,
            undo: persistedCommand.facts.thrownWeaponUndo as never,
          },
        ],
      });

      expect(
        await current.itemRepository.getCanonicalEquipmentItemById(current.item.id),
      ).toMatchObject({
        holderCharacterId: current.character.id,
        id: current.item.id,
        isEquipped: true,
      });
      expect(
        (await current.itemRepository.getCharacterLoadouts(current.character.id))[0]
          ?.activePrimaryWeaponItemId,
      ).toBe(current.item.id);
      expect(await prisma!.characterEquipmentItem.count({ where: { id: current.item.id } })).toBe(
        1,
      );
    });

    it("scopes idempotency to the exact Encounter fingerprint and rejects forged mismatches", async () => {
      const current = await fixture("collision");
      const service = new CombatItemInteractionService(current.itemRepository, prisma!);
      const firstInput = {
        actionId: current.actionId,
        actorUserId: current.gm.id,
        campaignId: current.campaign.id,
        encounterId: current.encounterId,
        encounterSession: current.completedSession,
        expectedEncounterRevision: current.persisted.updatedAt,
        interaction: current.completedSession.combatRoundState!.genericActions[0]!.itemInteraction!,
        ownerCharacterId: current.character.id,
        roundNumber: 1,
        scenarioId: current.scenario.id,
      };
      const first = await service.commitResolution(firstInput);
      expect(first.item.item).toMatchObject({ holderCharacterId: null, id: current.item.id });

      const pickedUp = await current.itemRepository.applyCombatItemInteraction({
        actionId: "collision-pickup",
        campaignId: current.campaign.id,
        encounterId: current.encounterId,
        expectedItemRevision: first.item.item.revision!,
        itemId: current.item.id,
        operation: "pickup",
        ownerCharacterId: current.character.id,
      });
      expect(pickedUp.item).toMatchObject({
        holderCharacterId: current.character.id,
        id: current.item.id,
      });

      const secondEncounterId = "atomic-encounter-collision-second";
      const secondBase = encounterSessionSchema.parse({
        campaignId: current.campaign.id,
        createdAt: "2026-08-16T11:00:00.000Z",
        currentRound: 1,
        id: secondEncounterId,
        kind: "combat",
        participants: [
          {
            characterId: current.character.id,
            id: "participant-collision-second",
            label: current.character.name,
            participantType: "character",
          },
          {
            characterId: current.recipient.id,
            id: "participant-recipient-collision-second",
            label: current.recipient.name,
            participantType: "character",
          },
        ],
        scenarioId: current.scenario.id,
        status: "active",
        title: "Atomic collision second encounter",
        updatedAt: "2026-08-16T11:00:00.000Z",
      });
      const secondRound = initializeCombatRoundState({ encounter: secondBase });
      const secondActive = encounterSessionSchema.parse({
        ...secondBase,
        combatRoundState: {
          ...secondRound,
          genericActions: [
            {
              createdAt: "2026-08-16T11:01:00.000Z",
              duration: { kind: "gm_decided" },
              id: current.actionId,
              intent: "Drop the exact dagger again",
              itemInteraction: {
                itemId: current.item.id,
                itemLabel: "Atomic dagger collision",
                itemRevision: pickedUp.item.revision!,
                operation: "drop",
                stateAtDeclaration: "held",
                visibleToParticipantIds: ["participant-collision-second"],
              },
              lastUpdatedAt: "2026-08-16T11:02:00.000Z",
              ownerParticipantId: "participant-collision-second",
              preset: "item_interaction",
              progress: {
                completedRounds: 0,
                startedRoundNumber: 1,
                startedStep: "select_actions",
              },
              reference: {
                itemId: current.item.id,
                kind: "item",
                label: "Atomic dagger collision",
                ownerParticipantId: "participant-collision-second",
              },
              status: "active",
            },
          ],
        },
      });
      const secondCreated = await prisma!.encounter.create({
        data: {
          campaignId: current.campaign.id,
          id: secondEncounterId,
          name: secondActive.title,
          scenarioId: current.scenario.id,
          sessionJson: secondActive as never,
          status: secondActive.status,
        },
      });
      const secondPersisted = await createPrismaCombatStatePersistenceRepository(
        prisma!,
      ).updateCombatEncounter({
        campaignId: current.campaign.id,
        encounterId: secondEncounterId,
        expectedRevision: secondCreated.updatedAt.toISOString(),
        scenarioId: current.scenario.id,
        session: secondActive,
      });
      const secondCompleted = encounterSessionSchema.parse({
        ...secondPersisted,
        combatRoundState: {
          ...secondPersisted.combatRoundState!,
          genericActions: secondPersisted.combatRoundState!.genericActions.map((action) => ({
            ...action,
            lastUpdatedAt: "2026-08-16T11:03:00.000Z",
            resolution: {
              resolvedAt: "2026-08-16T11:03:00.000Z",
              text: "The exact dagger is present and unheld in the second Encounter.",
              visibleToParticipantIds: ["participant-collision-second"],
            },
            status: "completed",
          })),
        },
      });
      const secondInput = {
        actionId: current.actionId,
        actorUserId: current.gm.id,
        campaignId: current.campaign.id,
        encounterId: secondEncounterId,
        encounterSession: secondCompleted,
        expectedEncounterRevision: secondPersisted.updatedAt,
        interaction: secondCompleted.combatRoundState!.genericActions[0]!.itemInteraction!,
        ownerCharacterId: current.character.id,
        roundNumber: 1,
        scenarioId: current.scenario.id,
      };
      const beforeItem = await current.itemRepository.getCanonicalEquipmentItemById(
        current.item.id,
      );
      const beforeEncounter = await prisma!.encounter.findUniqueOrThrow({
        include: { activeCombatState: true },
        where: { id: secondEncounterId },
      });
      const beforeEvents = await prisma!.scenarioEventLog.count({
        where: { scenarioId: current.scenario.id },
      });
      const forge = (changes: {
        operation?: "use";
        ownerCharacterId?: string;
        recipientCharacterId?: string;
        recipientParticipantId?: string;
        revision?: string;
      }) => {
        const forgedSession = encounterSessionSchema.parse({
          ...secondCompleted,
          combatRoundState: {
            ...secondCompleted.combatRoundState!,
            genericActions: secondCompleted.combatRoundState!.genericActions.map((action) => ({
              ...action,
              itemInteraction: {
                ...action.itemInteraction!,
                itemRevision: changes.revision ?? action.itemInteraction!.itemRevision,
                operation: changes.operation ?? action.itemInteraction!.operation,
                recipientParticipantId: changes.recipientParticipantId,
              },
            })),
          },
        });
        return service.commitResolution({
          ...secondInput,
          encounterSession: forgedSession,
          interaction: forgedSession.combatRoundState!.genericActions[0]!.itemInteraction!,
          ownerCharacterId: changes.ownerCharacterId ?? secondInput.ownerCharacterId,
          recipientCharacterId: changes.recipientCharacterId,
        });
      };

      for (const changes of [
        { operation: "use" as const },
        { revision: "2026-08-16T00:00:00.000Z" },
        {
          recipientCharacterId: current.recipient.id,
          recipientParticipantId: "participant-recipient-collision-second",
        },
        { ownerCharacterId: current.recipient.id },
      ]) {
        await expect(forge(changes)).rejects.toThrow();
      }
      expect(await current.itemRepository.getCanonicalEquipmentItemById(current.item.id)).toEqual(
        beforeItem,
      );
      const afterForgedEncounter = await prisma!.encounter.findUniqueOrThrow({
        include: { activeCombatState: true },
        where: { id: secondEncounterId },
      });
      expect(afterForgedEncounter.updatedAt).toEqual(beforeEncounter.updatedAt);
      expect(afterForgedEncounter.activeCombatState?.stateJson).toEqual(
        beforeEncounter.activeCombatState?.stateJson,
      );
      expect(
        await prisma!.scenarioEventLog.count({ where: { scenarioId: current.scenario.id } }),
      ).toBe(beforeEvents);

      const second = await service.commitResolution(secondInput);
      expect(second.item).toMatchObject({
        alreadyApplied: false,
        item: { holderCharacterId: null, id: current.item.id },
      });
      expect(second.item.item.revision).not.toBe(pickedUp.item.revision);
      expect(await prisma!.characterEquipmentItem.count({ where: { id: current.item.id } })).toBe(
        1,
      );
      expect(
        await prisma!.scenarioEventLog.count({ where: { scenarioId: current.scenario.id } }),
      ).toBe(2);

      const exactRetry = await service.commitResolution(secondInput);
      expect(exactRetry.item).toMatchObject({
        alreadyApplied: true,
        item: { holderCharacterId: null, id: current.item.id },
      });
      expect(exactRetry.item.item.revision).toBe(second.item.item.revision);
      expect(exactRetry.encounter.updatedAt).toBe(second.encounter.updatedAt);
      expect(
        await prisma!.scenarioEventLog.count({ where: { scenarioId: current.scenario.id } }),
      ).toBe(2);
      const stored = await prisma!.characterEquipmentItem.findUniqueOrThrow({
        where: { id: current.item.id },
      });
      expect(JSON.stringify(stored.statusTagsJson)).not.toContain("combat-item:applied");
    });
  });
}
