import { beforeEach, describe, expect, it } from "vitest";

import {
  buildScenarioSessionView,
  commitCombatRoundDisarm,
  encounterSessionSchema,
  initializeCombatRoundState,
  undoLatestCombatRoundCommand,
} from "@glantri/domain";

import { createPrismaCharacterEquipmentRepository } from "../repositories/characterEquipmentRepository";
import { createPrismaCharacterRepository } from "../repositories/characterRepository";
import { createPrismaCombatStateReadRepository } from "../repositories/combatStateReadRepository";
import { createPrismaCombatStatePersistenceRepository } from "../repositories/combatStatePersistenceRepository";
import { createPrismaScenarioRepository } from "../repositories/scenarioRepository";
import { getTestPrismaClient, resetTestDatabase } from "../testing/testDatabase";
import { createTestCampaign, createTestCharacter, createTestUser } from "../testing/factories";
import { CharacterEquipmentReadModelService } from "./characterEquipmentReadModelService";
import { CharacterEquipmentWriteService } from "./characterEquipmentWriteService";
import { CharacterService } from "./characterService";
import {
  CombatItemInteractionService,
  CombatItemUnavailableError,
  ScenarioEquipmentStaleError,
} from "./combatItemInteractionService";
import { ScenarioService } from "./scenarioService";

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
      const scenarioService = new ScenarioService(
        createPrismaScenarioRepository(prisma!),
        new CharacterService(createPrismaCharacterRepository(prisma!)),
        new CharacterEquipmentReadModelService(itemRepository),
        prisma!,
      );
      const scenarioParticipants = [
        await scenarioService.addCharacterParticipant({
          characterId: character.id,
          controlledByUserId: player.id,
          joinSource: "gm_added",
          scenarioId: scenario.id,
        }),
        await scenarioService.addCharacterParticipant({
          characterId: recipient.id,
          controlledByUserId: recipientUser.id,
          joinSource: "gm_added",
          scenarioId: scenario.id,
        }),
      ];
      await prisma!.scenarioEventLog.deleteMany({ where: { scenarioId: scenario.id } });

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
            scenarioParticipantId: scenarioParticipants[0]!.id,
            label: character.name,
            participantType: "character",
          },
          {
            characterId: recipient.id,
            id: `participant-recipient-${suffix}`,
            scenarioParticipantId: scenarioParticipants[1]!.id,
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
        scenarioParticipants,
        scenarioService,
      };
    }

    async function disarmFixture(suffix: string) {
      const current = await fixture(`disarm-${suffix}`);
      const attemptId = `disarm-attempt-${suffix}`;
      const commandId = `disarm-command-${suffix}`;
      const awaitingAttempt = {
        actingParticipantId: `participant-recipient-disarm-${suffix}`,
        actingWeaponItemId: `acting-item-${suffix}`,
        actingWeaponTemplateId: "weapon-template-main-gauche",
        contactQualityModifier: 0,
        difference: 11,
        disarmCapability: "trap" as const,
        id: attemptId,
        method: "proactive" as const,
        phase: "phase1" as const,
        resistingParticipantId: `participant-disarm-${suffix}`,
        result: { disarmed: true, tableRowId: "disarmed" as const, unbalanced: false },
        roundNumber: 1,
        status: "awaiting_commit" as const,
        targetWeaponItemId: current.item.id,
        targetWeaponItemRevision: current.item.revision!,
        targetWeaponTemplateId: current.item.templateId,
      };
      const waitingSession = encounterSessionSchema.parse({
        ...current.persisted,
        combatRoundState: {
          ...current.persisted.combatRoundState!,
          disarmAttempts: [awaitingAttempt],
        },
      });
      const waiting = await createPrismaCombatStatePersistenceRepository(
        prisma!,
      ).updateCombatEncounter({
        campaignId: current.campaign.id,
        encounterId: current.encounterId,
        expectedRevision: current.persisted.updatedAt,
        scenarioId: current.scenario.id,
        session: waitingSession,
      });
      const completedState = commitCombatRoundDisarm({
        attemptId,
        command: {
          commandId,
          createdAt: "2026-08-16T10:04:00.000Z",
          createdByUserId: current.gm.id,
        },
        state: waiting.combatRoundState!,
      });
      const completedSession = encounterSessionSchema.parse({
        ...waiting,
        combatRoundState: completedState,
        updatedAt: "2026-08-16T10:04:00.000Z",
      });
      return { ...current, attemptId, commandId, completedSession, waiting };
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
        ).toBe(2);
        const events = await prisma!.scenarioEventLog.findMany({
          where: { scenarioId: current.scenario.id },
        });
        expect(events.map((event) => event.eventType).sort()).toEqual([
          "encounter_combat_outcome",
          "encounter_updated",
        ]);
        const retried = await new CombatItemInteractionService(
          current.itemRepository,
          prisma!,
        ).commitResolution(input);
        expect(retried.item.alreadyApplied).toBe(true);
        expect(
          await prisma!.scenarioEventLog.count({ where: { scenarioId: current.scenario.id } }),
        ).toBe(2);
      }
    });

    it("records pass/drop/pickup once with mapped intersected audiences and reload chronology", async () => {
      const current = await fixture("history-sequence");
      const service = new CombatItemInteractionService(current.itemRepository, prisma!);
      let latest = current.persisted;
      let item = current.item;
      const ownerIds = ["participant-history-sequence", "participant-recipient-history-sequence"];
      const lifecycleTypes = ["encounter_paused", "encounter_resumed", "encounter_closed"];
      for (const [index, operation] of (["pass", "drop", "pickup"] as const).entries()) {
        const ownerIndex = operation === "drop" ? 1 : 0;
        const template = current.persisted.combatRoundState!.genericActions[0]!;
        const action = {
          ...template,
          id: `history-${operation}`,
          ownerParticipantId: ownerIds[ownerIndex]!,
          itemInteraction: {
            ...template.itemInteraction!,
            operation,
            itemRevision: item.revision!,
            recipientParticipantId: operation === "pass" ? ownerIds[1] : undefined,
            visibleToParticipantIds: [ownerIds[0]!],
          },
          reference: { ...template.reference!, ownerParticipantId: ownerIds[ownerIndex]! },
        };
        latest = await createPrismaCombatStatePersistenceRepository(prisma!).updateCombatEncounter({
          campaignId: current.campaign.id,
          encounterId: current.encounterId,
          expectedRevision: latest.updatedAt,
          scenarioId: current.scenario.id,
          session: encounterSessionSchema.parse({
            ...latest,
            combatRoundState: {
              ...latest.combatRoundState!,
              genericActions: [
                ...latest.combatRoundState!.genericActions.filter(
                  (entry) => entry.status === "completed",
                ),
                action,
              ],
            },
          }),
        });
        const completed = encounterSessionSchema.parse({
          ...latest,
          combatRoundState: {
            ...latest.combatRoundState!,
            genericActions: latest.combatRoundState!.genericActions.map((entry) =>
              entry.id === action.id
                ? {
                    ...entry,
                    status: "completed",
                    resolution: {
                      resolvedAt: "2026-08-16T10:03:00.000Z",
                      text: `Safe ${operation} result.`,
                      resolvedByUserId: current.gm.id,
                      visibleToParticipantIds: ownerIds,
                    },
                  }
                : entry,
            ),
          },
        });
        const input = {
          actionId: action.id,
          actorUserId: current.gm.id,
          campaignId: current.campaign.id,
          encounterId: current.encounterId,
          encounterSession: completed,
          expectedEncounterRevision: latest.updatedAt,
          interaction: action.itemInteraction,
          ownerCharacterId: ownerIndex === 0 ? current.character.id : current.recipient.id,
          recipientCharacterId: operation === "pass" ? current.recipient.id : undefined,
          roundNumber: 1,
          scenarioId: current.scenario.id,
        };
        const committed = await service.commitResolution(input);
        expect(committed.item.item.holderCharacterId).toBe(
          operation === "drop"
            ? null
            : operation === "pass"
              ? current.recipient.id
              : current.character.id,
        );
        latest = committed.encounter;
        item = committed.item.item;
        const beforeRetry = await prisma!.scenarioEventLog.findMany({
          where: { scenarioId: current.scenario.id },
        });
        expect((await service.commitResolution(input)).item.alreadyApplied).toBe(true);
        expect(
          await prisma!.scenarioEventLog.findMany({ where: { scenarioId: current.scenario.id } }),
        ).toEqual(beforeRetry);
        await prisma!.scenarioEventLog.create({
          data: {
            eventType: lifecycleTypes[index]!,
            payloadJson: { encounterId: current.encounterId },
            scenarioId: current.scenario.id,
            summary: `Lifecycle ${index}.`,
          },
        });
      }
      const events = await current.scenarioService.listScenarioEventLogs(current.scenario.id);
      const safe = events.filter((event) => event.eventType === "encounter_combat_outcome");
      expect(safe).toHaveLength(3);
      for (const event of safe) {
        expect(event.payload).toEqual({
          actionId: expect.stringMatching(/^history-(pass|drop|pickup)$/),
          actorParticipantId: expect.any(String),
          audienceParticipantIds: [current.scenarioParticipants[0]!.id],
          encounterId: current.encounterId,
          eventKind: "item_resolution",
        });
      }
      expect(events.filter((event) => event.eventType === "encounter_updated")).toHaveLength(3);
      const reloaded = (await createPrismaCombatStateReadRepository(prisma!).getFullEncounterById(
        current.encounterId,
      ))!.encounter;
      const scenario = (await current.scenarioService.getScenarioById(current.scenario.id))!;
      const view = (userId: string, viewerMode: "gm" | "player") =>
        buildScenarioSessionView({
          availableObjects: [],
          encounters: [reloaded],
          eventLogs: [...events].reverse(),
          participants: current.scenarioParticipants,
          scenario,
          userId,
          viewerMode,
        });
      const expected = [
        "Safe pass result.",
        "Lifecycle 0.",
        "Safe drop result.",
        "Lifecycle 1.",
        "Safe pickup result.",
        "Lifecycle 2.",
      ];
      expect(view(current.gm.id, "gm").history.map((event) => event.summary)).toEqual(expected);
      const playerHistory = view(
        current.scenarioParticipants[0]!.controlledByUserId!,
        "player",
      ).history;
      expect(playerHistory.map((event) => event.summary)).toEqual(expected);
      expect(
        view(current.scenarioParticipants[1]!.controlledByUserId!, "player").history.filter(
          (event) => event.type === "encounter_combat_outcome",
        ),
      ).toEqual([]);
      expect(JSON.stringify(playerHistory)).not.toMatch(
        /holderCharacterId|itemRevision|resolvedByUserId|payload|audienceParticipantIds/,
      );
      const storedScenario = await prisma!.scenario.findUniqueOrThrow({
        select: { liveStateJson: true },
        where: { id: current.scenario.id },
      });
      expect(JSON.stringify(storedScenario.liveStateJson)).not.toContain(current.item.id);
    });

    it("materializes every legacy present Item and authorizes the new drop in Scenario state", async () => {
      const current = await fixture("legacy-materialization");
      const equipmentService = new CharacterEquipmentWriteService(current.itemRepository);
      const legacyItem = await equipmentService.createCampaignEquipmentItem({
        campaignId: current.campaign.id,
        displayName: "Unrelated hidden legacy Item",
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
      await prisma!.characterEquipmentItem.update({
        data: {
          statusTagsJson: ["hidden", `glantri:combat-item:present:${current.encounterId}`],
        },
        where: { id: legacyItem.id },
      });

      const service = new CombatItemInteractionService(current.itemRepository, prisma!);
      const committed = await service.commitResolution({
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
      });

      expect(committed.encounter.itemReferencesVersion).toBe(1);
      expect(committed.encounter.itemReferences).toEqual(
        expect.arrayContaining([
          { itemId: legacyItem.id, visibility: "gm_only" },
          { itemId: current.item.id, visibility: "players" },
        ]),
      );
      const storedScenario = await prisma!.scenario.findUniqueOrThrow({
        select: { liveStateJson: true },
        where: { id: current.scenario.id },
      });
      expect(storedScenario.liveStateJson).toMatchObject({
        session: {
          availableObjects: expect.arrayContaining([
            expect.objectContaining({
              sourceId: current.item.id,
              sourceKind: "campaign_item",
              visibility: "players",
            }),
            expect.objectContaining({
              sourceId: legacyItem.id,
              sourceKind: "campaign_item",
              visibility: "gm_only",
            }),
          ]),
        },
      });
      const options = await service.getOptions({
        campaignId: current.campaign.id,
        encounterId: current.encounterId,
        participants: committed.encounter.participants.map((participant) => ({
          characterId: participant.characterId,
          label: participant.label,
          participantId: participant.id,
        })),
        viewer: { kind: "gm" },
      });
      expect(options.presentItems.map((item) => item.id)).toEqual(
        expect.arrayContaining([legacyItem.id, current.item.id]),
      );
    });

    it("keeps an unmapped Item audience empty rather than public", async () => {
      const current = await fixture("unmapped-history");
      const session = encounterSessionSchema.parse(current.completedSession);
      session.participants = session.participants.map((entry) => ({
        ...entry,
        scenarioParticipantId: undefined,
      }));
      await new CombatItemInteractionService(current.itemRepository, prisma!).commitResolution({
        actionId: current.actionId,
        actorUserId: current.gm.id,
        campaignId: current.campaign.id,
        encounterId: current.encounterId,
        encounterSession: session,
        expectedEncounterRevision: current.persisted.updatedAt,
        interaction: session.combatRoundState!.genericActions[0]!.itemInteraction!,
        ownerCharacterId: current.character.id,
        roundNumber: 1,
        scenarioId: current.scenario.id,
      });
      const safe = await prisma!.scenarioEventLog.findFirstOrThrow({
        where: { scenarioId: current.scenario.id, eventType: "encounter_combat_outcome" },
      });
      expect(safe.payloadJson).toMatchObject({ audienceParticipantIds: [] });
    });

    it("blocks authoritative Combat after an external equipment change until GM reconciliation", async () => {
      const current = await fixture("external-stale");
      const equipmentService = new CharacterEquipmentWriteService(current.itemRepository);
      await equipmentService.createCampaignEquipmentItem({
        campaignId: current.campaign.id,
        displayName: "External change",
        holderCharacterId: current.character.id,
        itemFacts: {
          activeMechanics: [],
          descriptiveTraits: [],
          templateOverrides: [],
          unsupportedCapabilities: [],
          version: 1,
        },
        templateId: "weapon-template-dagger",
      });
      const input = {
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
      const service = new CombatItemInteractionService(current.itemRepository, prisma!);

      await expect(service.commitResolution(input)).rejects.toBeInstanceOf(
        ScenarioEquipmentStaleError,
      );
      await expect(
        current.itemRepository.getCanonicalEquipmentItemById(current.item.id),
      ).resolves.toMatchObject({ holderCharacterId: current.character.id });

      await current.scenarioService.refreshCharacterParticipantEquipmentSnapshot({
        participantId: current.scenarioParticipants[0]!.id,
        scenarioId: current.scenario.id,
      });
      const committed = await service.commitResolution(input);
      expect(committed.item.item).toMatchObject({
        holderCharacterId: null,
        id: current.item.id,
      });
    });

    it("rejects combat-item commands for terminal Scenario states", async () => {
      for (const terminalStatus of ["paused", "completed", "archived"] as const) {
        const current = await fixture(`terminal-${terminalStatus}`);
        const commandId = `terminal-${terminalStatus}-command`;
        const cursor = current.persisted.combatRoundState!.currentCursor;
        const commandType = terminalStatus === "completed" ? "miss" : "hit";
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
                facts: { attackResult: commandType },
                id: commandId,
                participantId: `participant-terminal-${terminalStatus}`,
                roundNumber: 1,
                type: "roll_attack",
              },
            ],
          },
        });

        await prisma!.scenario.update({
          data: { status: terminalStatus },
          where: { id: current.scenario.id },
        });

        const service = new CombatItemInteractionService(current.itemRepository, prisma!);
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
            templateId: current.item.templateId!,
          }),
        ).rejects.toBeInstanceOf(CombatItemUnavailableError);
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
            templateId: current.item.templateId!,
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
        templateId: current.item.templateId!,
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
            presentEncounterId: undefined,
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
          templateId: current.item.templateId!,
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
      const exactUndo = persistedCommand.facts.thrownWeaponUndo as Record<string, unknown>;
      await expect(
        service.commitThrownWeaponAttackUndo({
          actorUserId: current.gm.id,
          campaignId: current.campaign.id,
          encounterId: current.encounterId,
          expectedEncounterRevision: committed.encounter.updatedAt,
          scenarioId: current.scenario.id,
          session: restoredSession,
          undos: [
            {
              commandId,
              undo: { ...exactUndo, ownerCharacterId: current.recipient.id } as never,
            },
          ],
        }),
      ).rejects.toBeInstanceOf(Error);
      expect(
        await current.itemRepository.getCanonicalEquipmentItemById(current.item.id),
      ).toMatchObject({ holderCharacterId: null, id: current.item.id });
      expect(
        await prisma!.scenarioEventLog.count({ where: { scenarioId: current.scenario.id } }),
      ).toBe(1);

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
            undo: exactUndo as never,
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

    it("persists final-shot exhaustion, rejects another shot after reload, and restores exact ammunition on undo", async () => {
      const current = await fixture("missile-ammo");
      const equipmentService = new CharacterEquipmentWriteService(current.itemRepository);
      const createdAmmo = await equipmentService.createCampaignEquipmentItem({
        campaignId: current.campaign.id,
        holderCharacterId: current.character.id,
        itemFacts: {
          activeMechanics: [],
          descriptiveTraits: [],
          templateOverrides: [],
          unsupportedCapabilities: [],
          version: 1,
        },
        templateId: "gear-template-arrows",
      });
      await prisma!.characterEquipmentItem.update({
        data: { isStackable: true, quantity: 1 },
        where: { id: createdAmmo.id },
      });
      let ammo = (await current.itemRepository.getCanonicalEquipmentItemById(createdAmmo.id))!;
      const loadout = (await current.itemRepository.getCharacterLoadouts(current.character.id))[0]!;
      await current.itemRepository.upsertCharacterLoadout({
        ...loadout,
        activeAmmoItemIds: [ammo.id],
      });
      ammo = (await current.itemRepository.getCanonicalEquipmentItemById(createdAmmo.id))!;
      await current.scenarioService.refreshCharacterParticipantEquipmentSnapshot({
        participantId: current.scenarioParticipants[0]!.id,
        scenarioId: current.scenario.id,
      });
      await prisma!.scenarioEventLog.deleteMany({ where: { scenarioId: current.scenario.id } });
      const commandId = "missile-ammo-command";
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
              facts: {
                previousMissileReadiness: {
                  ammoItemId: ammo.id,
                  ammoItemRevision: ammo.revision,
                },
              },
              id: commandId,
              participantId: "participant-missile-ammo",
              roundNumber: 1,
              type: "roll_attack",
            },
          ],
        },
        updatedAt: "2026-08-16T10:04:00.000Z",
      });
      const service = new CombatItemInteractionService(current.itemRepository, prisma!);
      const committed = await service.commitMissileWeaponAttack({
        actorUserId: current.gm.id,
        ammoItemId: ammo.id,
        ammoItemRevision: ammo.revision!,
        campaignId: current.campaign.id,
        commandId,
        encounterId: current.encounterId,
        expectedEncounterRevision: current.persisted.updatedAt,
        ownerCharacterId: current.character.id,
        roundNumber: 1,
        scenarioId: current.scenario.id,
        session,
      });
      expect(
        (await prisma!.characterEquipmentItem.findUniqueOrThrow({ where: { id: ammo.id } }))
          .quantity,
      ).toBe(0);
      const replay = await service.commitMissileWeaponAttack({
        actorUserId: current.gm.id,
        ammoItemId: ammo.id,
        ammoItemRevision: ammo.revision!,
        campaignId: current.campaign.id,
        commandId,
        encounterId: current.encounterId,
        expectedEncounterRevision: current.persisted.updatedAt,
        ownerCharacterId: current.character.id,
        roundNumber: 1,
        scenarioId: current.scenario.id,
        session,
      });
      expect(replay.undo).toEqual(committed.undo);
      expect(
        (await prisma!.characterEquipmentItem.findUniqueOrThrow({ where: { id: ammo.id } }))
          .quantity,
      ).toBe(0);
      const reloadedAmmo = (await current.itemRepository.getCanonicalEquipmentItemById(ammo.id))!;
      expect(reloadedAmmo.quantity).toBe(0);
      await expect(
        service.commitMissileWeaponAttack({
          actorUserId: current.gm.id,
          ammoItemId: ammo.id,
          ammoItemRevision: reloadedAmmo.revision!,
          campaignId: current.campaign.id,
          commandId: "second-empty-shot",
          encounterId: current.encounterId,
          expectedEncounterRevision: committed.encounter.updatedAt,
          ownerCharacterId: current.character.id,
          roundNumber: 1,
          scenarioId: current.scenario.id,
          session: encounterSessionSchema.parse({
            ...committed.encounter,
            updatedAt: "2026-08-16T10:04:30.000Z",
            combatRoundState: {
              ...committed.encounter.combatRoundState!,
              commands: [
                ...committed.encounter.combatRoundState!.commands,
                {
                  ...session.combatRoundState!.commands.find(
                    (command) => command.id === commandId,
                  )!,
                  id: "second-empty-shot",
                  facts: {
                    previousMissileReadiness: {
                      ammoItemId: ammo.id,
                      ammoItemRevision: reloadedAmmo.revision,
                    },
                  },
                },
              ],
            },
          }),
        }),
      ).rejects.toThrow();
      expect((await current.itemRepository.getCanonicalEquipmentItemById(ammo.id))!.quantity).toBe(
        0,
      );
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
      await service.commitMissileWeaponAttackUndo({
        actorUserId: current.gm.id,
        campaignId: current.campaign.id,
        commandId,
        encounterId: current.encounterId,
        expectedEncounterRevision: committed.encounter.updatedAt,
        scenarioId: current.scenario.id,
        session: restoredSession,
        undo: committed.undo,
      });
      expect(
        (await prisma!.characterEquipmentItem.findUniqueOrThrow({ where: { id: ammo.id } }))
          .quantity,
      ).toBe(1);
    });

    it("atomically disarms the exact Item with rollback, idempotent retry, and exact undo", async () => {
      for (const boundary of ["item", "encounter", "event"] as const) {
        const current = await disarmFixture(`rollback-${boundary}`);
        const beforeItem = await current.itemRepository.getCanonicalEquipmentItemById(
          current.item.id,
        );
        const beforeEncounter = await prisma!.encounter.findUniqueOrThrow({
          include: { activeCombatState: true },
          where: { id: current.encounterId },
        });
        const service = new CombatItemInteractionService(
          current.itemRepository,
          prisma!,
          (reached) => {
            if (reached === boundary) throw new Error(`injected-disarm-${boundary}`);
          },
        );
        await expect(
          service.commitDisarm({
            actorUserId: current.gm.id,
            campaignId: current.campaign.id,
            commandId: current.commandId,
            encounterId: current.encounterId,
            expectedEncounterRevision: current.waiting.updatedAt,
            ownerCharacterId: current.character.id,
            roundNumber: 1,
            scenarioId: current.scenario.id,
            session: current.completedSession,
          }),
        ).rejects.toThrow(`injected-disarm-${boundary}`);
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
      }

      const current = await disarmFixture("success");
      const service = new CombatItemInteractionService(current.itemRepository, prisma!);
      const input = {
        actorUserId: current.gm.id,
        campaignId: current.campaign.id,
        commandId: current.commandId,
        encounterId: current.encounterId,
        expectedEncounterRevision: current.waiting.updatedAt,
        ownerCharacterId: current.character.id,
        roundNumber: 1,
        scenarioId: current.scenario.id,
        session: current.completedSession,
      };
      const committed = await service.commitDisarm(input);
      expect(committed.item?.item).toMatchObject({
        holderCharacterId: null,
        id: current.item.id,
        isEquipped: false,
      });
      expect(await prisma!.characterEquipmentItem.count({ where: { id: current.item.id } })).toBe(
        1,
      );
      expect(
        (await current.itemRepository.getCharacterLoadouts(current.character.id))[0]
          ?.activePrimaryWeaponItemId,
      ).toBeNull();
      const persistedCommand = committed.encounter.combatRoundState!.commands.find(
        (command) => command.id === current.commandId,
      )!;
      expect(persistedCommand.facts.disarmItemUndo).toMatchObject({
        actionId: current.commandId,
        itemBefore: { id: current.item.id },
        ownerCharacterId: current.character.id,
        version: 1,
      });

      const eventCountBeforeRetry = await prisma!.scenarioEventLog.count({
        where: { scenarioId: current.scenario.id },
      });
      const retry = await service.commitDisarm(input);
      expect(retry.item).toMatchObject({ alreadyApplied: true, item: { id: current.item.id } });
      expect(retry.encounter.updatedAt).toBe(committed.encounter.updatedAt);
      expect(
        await prisma!.scenarioEventLog.count({ where: { scenarioId: current.scenario.id } }),
      ).toBe(eventCountBeforeRetry);

      await expect(
        service.commitDisarm({ ...input, ownerCharacterId: current.recipient.id }),
      ).rejects.toBeInstanceOf(Error);
      expect(
        await prisma!.scenarioEventLog.count({ where: { scenarioId: current.scenario.id } }),
      ).toBe(eventCountBeforeRetry);

      const exactUndo = persistedCommand.facts.disarmItemUndo as Record<string, unknown>;
      const undoneState = undoLatestCombatRoundCommand({
        state: committed.encounter.combatRoundState!,
      })!;
      const restoredSession = encounterSessionSchema.parse({
        ...committed.encounter,
        combatRoundState: undoneState,
      });
      await expect(
        service.commitDisarmUndo({
          actorUserId: current.gm.id,
          campaignId: current.campaign.id,
          encounterId: current.encounterId,
          expectedEncounterRevision: committed.encounter.updatedAt,
          scenarioId: current.scenario.id,
          session: restoredSession,
          undos: [
            {
              commandId: current.commandId,
              undo: { ...exactUndo, ownerCharacterId: current.recipient.id } as never,
            },
          ],
        }),
      ).rejects.toBeInstanceOf(Error);
      expect(
        await current.itemRepository.getCanonicalEquipmentItemById(current.item.id),
      ).toMatchObject({ holderCharacterId: null, id: current.item.id });

      const restored = await service.commitDisarmUndo({
        actorUserId: current.gm.id,
        campaignId: current.campaign.id,
        encounterId: current.encounterId,
        expectedEncounterRevision: committed.encounter.updatedAt,
        scenarioId: current.scenario.id,
        session: restoredSession,
        undos: [{ commandId: current.commandId, undo: exactUndo as never }],
      });
      expect(
        await current.itemRepository.getCanonicalEquipmentItemById(current.item.id),
      ).toMatchObject({ holderCharacterId: current.character.id, id: current.item.id });
      expect(
        (await current.itemRepository.getCharacterLoadouts(current.character.id))[0]
          ?.activePrimaryWeaponItemId,
      ).toBe(current.item.id);
      const eventCountAfterUndo = await prisma!.scenarioEventLog.count({
        where: { scenarioId: current.scenario.id },
      });
      await expect(
        service.commitDisarmUndo({
          actorUserId: current.gm.id,
          campaignId: current.campaign.id,
          encounterId: current.encounterId,
          expectedEncounterRevision: restored.updatedAt,
          scenarioId: current.scenario.id,
          session: restoredSession,
          undos: [{ commandId: current.commandId, undo: exactUndo as never }],
        }),
      ).rejects.toBeInstanceOf(Error);
      expect(
        await prisma!.scenarioEventLog.count({ where: { scenarioId: current.scenario.id } }),
      ).toBe(eventCountAfterUndo);
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
        presentInEncounter: true,
      });
      expect(pickedUp.item).toMatchObject({
        holderCharacterId: current.character.id,
        id: current.item.id,
      });
      await current.scenarioService.refreshCharacterParticipantEquipmentSnapshot({
        participantId: current.scenarioParticipants[0]!.id,
        scenarioId: current.scenario.id,
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
      ).toBe(beforeEvents + 2);

      const exactRetry = await service.commitResolution(secondInput);
      expect(exactRetry.item).toMatchObject({
        alreadyApplied: true,
        item: { holderCharacterId: null, id: current.item.id },
      });
      expect(exactRetry.item.item.revision).toBe(second.item.item.revision);
      expect(exactRetry.encounter.updatedAt).toBe(second.encounter.updatedAt);
      expect(
        await prisma!.scenarioEventLog.count({ where: { scenarioId: current.scenario.id } }),
      ).toBe(beforeEvents + 2);
      const stored = await prisma!.characterEquipmentItem.findUniqueOrThrow({
        where: { id: current.item.id },
      });
      expect(JSON.stringify(stored.statusTagsJson)).not.toContain("combat-item:applied");
    });
  });
}
