import { beforeEach, describe, expect, it } from "vitest";

import {
  buildRoleplayCalculationPreview,
  combatEffectsStateSchema,
  combatStepEventSchema,
  encounterSessionSchema,
  initializeCombatRoundState,
  normalizeRoleplayState,
  scenarioParticipantStateSchema,
} from "@glantri/domain";
import { assignRoleplayStatCheck, recordRoleplayStatCheckResult } from "@glantri/rules-engine";

import { getTestPrismaClient, resetTestDatabase } from "../testing/testDatabase";
import { createPrismaCharacterEquipmentRepository } from "../repositories/characterEquipmentRepository";
import { createPrismaCharacterRepository } from "../repositories/characterRepository";
import { createPrismaEncounterRepository } from "../repositories/encounterRepository";
import { createPrismaScenarioRepository } from "../repositories/scenarioRepository";
import { createTestCharacter, createTestUser } from "../testing/factories";
import { CampaignService } from "./campaignService";
import { CharacterEquipmentReadModelService } from "./characterEquipmentReadModelService";
import { CharacterService } from "./characterService";
import { EncounterWriteError, EncounterService } from "./encounterService";
import { ScenarioService } from "./scenarioService";

const prisma = getTestPrismaClient();

function buildPendingStatCheck() {
  const session = encounterSessionSchema.parse({
    actionLog: [],
    createdAt: "2026-08-13T10:00:00.000Z",
    currentRound: 1,
    id: "roleplay-concurrency",
    kind: "roleplay",
    participants: [
      {
        id: "ari",
        label: "Ari",
        participantType: "scenario",
        scenarioParticipantId: "scenario-ari",
      },
    ],
    scenarioId: "scenario-roleplay-concurrency",
    status: "draft",
    title: "Council chamber",
    updatedAt: "2026-08-13T10:00:00.000Z",
  });

  return assignRoleplayStatCheck({
    difficulty: "medium",
    participantId: "ari",
    participantName: "Ari",
    session,
    statId: "dex",
    statLabel: "Dex",
    statValue: 14,
  });
}

function resolvePendingStatCheck(
  session: ReturnType<typeof buildPendingStatCheck>,
  rollD20: 4 | 19,
) {
  const pending = normalizeRoleplayState(session).pendingStatChecks[0]!;
  const roll = { dieResult: rollD20, openEndedD10s: [], rollD20 };
  const preview = buildRoleplayCalculationPreview({
    difficulty: pending.difficulty,
    kind: "stat",
    roll,
    skillLabel: pending.statLabel,
    skillValue: pending.statValue,
  });

  return recordRoleplayStatCheckResult({
    achievedSuccessLevel: preview.achievedSuccessLevel,
    autoSuccess: preview.autoSuccess,
    calculationText: preview.calculationText,
    difficulty: pending.difficulty,
    finalTotal: preview.finalTotal,
    fumble: preview.fumble,
    numericSubtotal: preview.numericSubtotal,
    participantId: pending.participantId,
    participantName: "Ari",
    pendingRollId: pending.id,
    roll,
    session,
    statId: pending.statId,
    statLabel: pending.statLabel,
    statValue: pending.statValue,
    success: preview.success,
  });
}

if (!process.env.DATABASE_URL_TEST) {
  describe.skip("Encounter roleplay persistence integration (DATABASE_URL_TEST not set)", () => {});
} else {
  describe("Encounter roleplay persistence integration", () => {
    beforeEach(async () => {
      await resetTestDatabase(prisma!);
    });

    it("accepts exactly one concurrent Stat result and returns the durable winner", async () => {
      const scenarioRepository = createPrismaScenarioRepository(prisma!);
      const campaignService = new CampaignService(
        scenarioRepository,
        new CharacterService(createPrismaCharacterRepository(prisma!)),
      );
      const scenarioService = new ScenarioService(
        scenarioRepository,
        new CharacterService(createPrismaCharacterRepository(prisma!)),
        new CharacterEquipmentReadModelService(createPrismaCharacterEquipmentRepository(prisma!)),
        prisma!,
      );
      const gm = await createTestUser(prisma!, { roles: ["game_master"] });
      const campaign = await campaignService.createCampaign({
        gmUserId: gm.id,
        name: "Concurrent Stat",
      });
      const scenario = await scenarioService.createScenario({
        campaignId: campaign.id,
        name: "Concurrent Stat",
        status: "live",
      });
      const service = new EncounterService(
        createPrismaEncounterRepository(prisma!),
        scenarioRepository,
      );
      const created = await service.createEncounter({
        scenarioId: scenario.id,
        session: {
          ...buildPendingStatCheck(),
          scenarioId: scenario.id,
          id: `stat-${scenario.id}`,
        },
      });
      const candidates = [4, 19] as const;

      const results = await Promise.allSettled(
        candidates.map((rollD20) =>
          service.updateEncounter({
            encounterId: created.id,
            expectedRevision: created.updatedAt,
            scenarioId: created.scenarioId,
            session: resolvePendingStatCheck(created, rollD20),
          }),
        ),
      );

      const fulfilled = results.filter(
        (result): result is PromiseFulfilledResult<typeof created> => result.status === "fulfilled",
      );
      const rejected = results.filter(
        (result): result is PromiseRejectedResult => result.status === "rejected",
      );
      expect(fulfilled).toHaveLength(1);
      expect(rejected).toHaveLength(1);
      expect(rejected[0]!.reason).toBeInstanceOf(EncounterWriteError);
      expect(rejected[0]!.reason).toMatchObject({
        code: expect.stringMatching(/^(stale_revision|transaction_conflict)$/),
      });

      const durable = await service.getEncounterById(created.id);
      const acceptedResult = normalizeRoleplayState(fulfilled[0]!.value).actionLog.find(
        (entry) => entry.type === "stat_check_result",
      );
      const durableResult = normalizeRoleplayState(durable!).actionLog.find(
        (entry) => entry.type === "stat_check_result",
      );
      expect(candidates).toContain(acceptedResult?.rollD20);
      expect(durableResult?.rollD20).toBe(acceptedResult?.rollD20);
      expect(durableResult?.pendingRollId).toBe(acceptedResult?.pendingRollId);
    });

    it("allows disjoint active Encounters and atomically accepts only one overlapping start", async () => {
      const gm = await createTestUser(prisma!, { roles: ["game_master"] });
      const ownerA = await createTestUser(prisma!);
      const ownerB = await createTestUser(prisma!);
      const characterA = await createTestCharacter(prisma!, ownerA.id, { name: "Player A" });
      const characterB = await createTestCharacter(prisma!, ownerB.id, { name: "Player B" });
      const scenarioRepository = createPrismaScenarioRepository(prisma!);
      const characterService = new CharacterService(createPrismaCharacterRepository(prisma!));
      const equipmentService = new CharacterEquipmentReadModelService(
        createPrismaCharacterEquipmentRepository(prisma!),
      );
      const campaignService = new CampaignService(scenarioRepository, characterService);
      const scenarioService = new ScenarioService(
        scenarioRepository,
        characterService,
        equipmentService,
        prisma!,
      );
      const campaign = await campaignService.createCampaign({
        gmUserId: gm.id,
        name: "Lost Seal",
        status: "active",
      });
      for (const character of [characterA, characterB]) {
        await campaignService.addCampaignRosterEntry({
          campaignId: campaign.id,
          category: "pc",
          sourceId: character.id,
          sourceType: "character",
        });
      }
      const scenario = await scenarioService.createScenario({
        campaignId: campaign.id,
        name: "Lost Seal",
        status: "live",
      });
      const participantA = await scenarioService.addCharacterParticipant({
        characterId: characterA.id,
        controlledByUserId: ownerA.id,
        joinSource: "gm_added",
        scenarioId: scenario.id,
      });
      const participantB = await scenarioService.addCharacterParticipant({
        characterId: characterB.id,
        controlledByUserId: ownerB.id,
        joinSource: "gm_added",
        scenarioId: scenario.id,
      });
      const service = new EncounterService(
        createPrismaEncounterRepository(prisma!),
        scenarioRepository,
      );
      const makeEncounter = async (id: string, participantId: string) =>
        service.createEncounter({
          campaignId: campaign.id,
          scenarioId: scenario.id,
          session: encounterSessionSchema.parse({
            createdAt: "2026-08-22T10:00:00.000Z",
            id,
            participantMembershipMode: "explicit",
            participants: [
              {
                id: `${id}-participant`,
                label: id,
                participantType: "scenario",
                scenarioParticipantId: participantId,
              },
            ],
            scenarioId: scenario.id,
            status: "draft",
            title: id,
            updatedAt: "2026-08-22T10:00:00.000Z",
          }),
        });
      const [library, courtyard] = await Promise.all([
        makeEncounter("library", participantA.id),
        makeEncounter("courtyard", participantB.id),
      ]);
      const disjointStarts = await Promise.all([
        service.updateEncounter({
          encounterId: library.id,
          expectedRevision: library.updatedAt,
          scenarioId: scenario.id,
          session: { ...library, status: "active" },
        }),
        service.updateEncounter({
          encounterId: courtyard.id,
          expectedRevision: courtyard.updatedAt,
          scenarioId: scenario.id,
          session: { ...courtyard, status: "active" },
        }),
      ]);
      expect(disjointStarts.map((encounter) => encounter.status)).toEqual(["active", "active"]);

      const pausedLibrary = await service.updateEncounter({
        encounterId: library.id,
        expectedRevision: disjointStarts[0].updatedAt,
        scenarioId: scenario.id,
        session: { ...disjointStarts[0], status: "paused" },
      });
      const [vault, chapel] = await Promise.all([
        makeEncounter("vault", participantA.id),
        makeEncounter("chapel", participantA.id),
      ]);
      const overlappingStarts = await Promise.allSettled(
        [vault, chapel].map((encounter) =>
          service.updateEncounter({
            encounterId: encounter.id,
            expectedRevision: encounter.updatedAt,
            scenarioId: scenario.id,
            session: { ...encounter, status: "active" },
          }),
        ),
      );
      expect(pausedLibrary.status).toBe("paused");
      expect(overlappingStarts.filter((result) => result.status === "fulfilled")).toHaveLength(1);
      const rejected = overlappingStarts.find(
        (result): result is PromiseRejectedResult => result.status === "rejected",
      );
      expect(rejected?.reason).toBeInstanceOf(EncounterWriteError);
      expect(rejected?.reason).toMatchObject({
        code: expect.stringMatching(/^(participant_already_active|transaction_conflict)$/),
      });

      const currentScenario = await scenarioService.getScenarioById(scenario.id);
      const pausedScenario = await scenarioService.updateScenario({
        expectedRevision: currentScenario!.updatedAt,
        scenarioId: scenario.id,
        status: "paused",
      });
      const pausedEncounters = await service.listEncountersByScenario(scenario.id);
      expect(pausedEncounters.filter((encounter) => encounter.status === "active")).toEqual([]);
      expect(pausedEncounters.filter((encounter) => encounter.status === "paused").length).toBe(3);
      await expect(
        scenarioService.updateScenario({
          expectedRevision: pausedScenario.updatedAt,
          scenarioId: scenario.id,
          status: "completed",
        }),
      ).rejects.toThrow("Close every active or paused Encounter");

      const resumedScenario = await scenarioService.updateScenario({
        expectedRevision: pausedScenario.updatedAt,
        scenarioId: scenario.id,
        status: "live",
      });
      expect(resumedScenario.status).toBe("live");
      const sameLibrary = pausedEncounters.find((encounter) => encounter.id === library.id)!;
      const resumedLibrary = await service.updateEncounter({
        encounterId: sameLibrary.id,
        expectedRevision: sameLibrary.updatedAt,
        scenarioId: scenario.id,
        session: { ...sameLibrary, status: "active" },
      });
      expect(resumedLibrary).toMatchObject({ id: library.id, status: "active" });
      await expect(
        service.updateEncounter({
          encounterId: resumedLibrary.id,
          expectedRevision: resumedLibrary.updatedAt,
          scenarioId: scenario.id,
          session: { ...resumedLibrary, status: "completed" },
        }),
      ).rejects.toMatchObject({ code: "invalid_transition" });
      const pausedAgain = await service.updateEncounter({
        encounterId: resumedLibrary.id,
        expectedRevision: resumedLibrary.updatedAt,
        scenarioId: scenario.id,
        session: { ...resumedLibrary, status: "paused" },
      });
      const closedLibrary = await service.updateEncounter({
        encounterId: pausedAgain.id,
        expectedRevision: pausedAgain.updatedAt,
        objectiveEvent: {
          eventType: "encounter_closed",
          summary: "Closed encounter library: The clue was secured.",
        },
        scenarioId: scenario.id,
        session: {
          ...pausedAgain,
          gmPrivateClosingNote: "The rival escaped unseen.",
          playerOutcome: "The clue was secured.",
          status: "completed",
        },
      });
      expect(closedLibrary).toMatchObject({
        gmPrivateClosingNote: "The rival escaped unseen.",
        playerOutcome: "The clue was secured.",
        status: "completed",
      });
      const lifecycleEvents = await scenarioRepository.listScenarioEventLogs(scenario.id);
      expect(lifecycleEvents.map((event) => event.sequence)).toEqual(
        [...lifecycleEvents].map((event) => event.sequence).sort((left, right) => left! - right!),
      );
      const closureEvent = lifecycleEvents.find((event) => event.eventType === "encounter_closed");
      expect(JSON.stringify(closureEvent)).toContain("The clue was secured.");
      expect(JSON.stringify(closureEvent)).not.toContain("The rival escaped unseen.");
    });

    it("blocks Encounter creation, updates, and participant state transitions in terminal Scenarios", async () => {
      const gm = await createTestUser(prisma!, { roles: ["game_master"] });
      const owner = await createTestUser(prisma!);
      const character = await createTestCharacter(prisma!, owner.id, { name: "Ari" });
      const scenarioRepository = createPrismaScenarioRepository(prisma!);
      const characterService = new CharacterService(createPrismaCharacterRepository(prisma!));
      const equipmentService = new CharacterEquipmentReadModelService(
        createPrismaCharacterEquipmentRepository(prisma!),
      );
      const campaignService = new CampaignService(scenarioRepository, characterService);
      const scenarioService = new ScenarioService(
        scenarioRepository,
        characterService,
        equipmentService,
        prisma!,
      );
      const campaign = await campaignService.createCampaign({
        gmUserId: gm.id,
        name: "Terminal Encounter",
        status: "active",
      });
      await campaignService.addCampaignRosterEntry({
        campaignId: campaign.id,
        category: "pc",
        sourceId: character.id,
        sourceType: "character",
      });
      const encounterRepository = createPrismaEncounterRepository(prisma!);
      const encounterService = new EncounterService(encounterRepository, scenarioRepository);

      for (const terminalStatus of ["paused", "completed", "archived"] as const) {
        const scenario = await scenarioService.createScenario({
          campaignId: campaign.id,
          name: `Terminal ${terminalStatus}`,
          status: "live",
        });
        const participant = await scenarioService.addCharacterParticipant({
          characterId: character.id,
          controlledByUserId: owner.id,
          joinSource: "gm_added",
          scenarioId: scenario.id,
        });
        const baseEncounter = encounterSessionSchema.parse({
          createdAt: "2026-08-30T10:00:00.000Z",
          currentRound: 1,
          id: `terminal-${terminalStatus}-encounter`,
          kind: "combat",
          participantMembershipMode: "explicit",
          participants: [
            {
              id: `terminal-${terminalStatus}-participant`,
              label: "Ari",
              participantType: "scenario",
              scenarioParticipantId: participant.id,
            },
          ],
          scenarioId: scenario.id,
          status: "draft",
          title: `Terminal ${terminalStatus}`,
          updatedAt: "2026-08-30T10:00:00.000Z",
        });
        const encounter = await encounterService.createEncounter({
          campaignId: campaign.id,
          scenarioId: scenario.id,
          session: baseEncounter,
        });

        const pausedScenario = await scenarioService.updateScenario({
          expectedRevision: scenario.updatedAt,
          scenarioId: scenario.id,
          status: "paused",
        });
        await scenarioService.updateScenario({
          expectedRevision: pausedScenario.updatedAt,
          scenarioId: scenario.id,
          status: "completed",
        });
        const archivedScenario = await scenarioService.updateScenario({
          expectedRevision: (await scenarioService.getScenarioById(scenario.id))!.updatedAt,
          scenarioId: scenario.id,
          status: "archived",
        });
        scenario.updatedAt = archivedScenario.updatedAt;
        await expect(encounterService.getEncounterById(encounter.id)).resolves.toMatchObject({
          status: "archived",
        });

        await expect(
          encounterService.createEncounter({
            campaignId: campaign.id,
            scenarioId: scenario.id,
            session: {
              ...baseEncounter,
              id: `blocked-${terminalStatus}`,
              title: `blocked-${terminalStatus}`,
            },
          }),
        ).rejects.toThrow("Closed or archived Scenarios");

        await expect(
          encounterService.updateCombatEncounter({
            encounterId: encounter.id,
            expectedRevision: encounter.updatedAt,
            scenarioId: scenario.id,
            session: {
              ...baseEncounter,
              id: encounter.id,
              title: encounter.title,
              status: "active",
            },
          }),
        ).rejects.toThrow("Combat activity requires an active Encounter.");

        await expect(
          encounterService.updateScenarioParticipantState({
            participantId: participant.id,
            scenarioId: scenario.id,
            state: {
              ...participant.state,
              health: {
                ...participant.state.health,
                currentHp: participant.state.health.currentHp - 1,
              },
            },
          }),
        ).rejects.toThrow("Scenario is not currently live.");
      }
    });

    it("derives a participant-state change from the stored row under its lock, so no concurrent write is lost (#1126)", async () => {
      const gm = await createTestUser(prisma!, { roles: ["game_master"] });
      const owner = await createTestUser(prisma!);
      const character = await createTestCharacter(prisma!, owner.id, { name: "Contested hero" });
      const scenarioRepository = createPrismaScenarioRepository(prisma!);
      const characterService = new CharacterService(createPrismaCharacterRepository(prisma!));
      const campaignService = new CampaignService(scenarioRepository, characterService);
      const scenarioService = new ScenarioService(
        scenarioRepository,
        characterService,
        new CharacterEquipmentReadModelService(createPrismaCharacterEquipmentRepository(prisma!)),
        prisma!,
      );
      const campaign = await campaignService.createCampaign({
        gmUserId: gm.id,
        name: "Lost update",
        status: "active",
      });
      await campaignService.addCampaignRosterEntry({
        campaignId: campaign.id,
        category: "pc",
        sourceId: character.id,
        sourceType: "character",
      });
      const scenario = await scenarioService.createScenario({
        campaignId: campaign.id,
        name: "Lost update",
        status: "live",
      });
      const loaded = await scenarioService.addCharacterParticipant({
        characterId: character.id,
        controlledByUserId: owner.id,
        joinSource: "gm_added",
        scenarioId: scenario.id,
      });
      const service = new EncounterService(
        createPrismaEncounterRepository(prisma!),
        scenarioRepository,
      );
      const effect = (id: string) => ({
        createdAt: "2026-11-10T20:00:00.000Z",
        damage: 1,
        effectGroup: "none" as const,
        generalDamage: 0,
        id,
        location: "chest",
        sourceEventId: `${id}-event`,
        status: "active" as const,
        targetParticipantId: loaded.id,
        type: "physical_damage" as const,
        updatedAt: "2026-11-10T20:00:00.000Z",
      });
      const addEffect =
        (id: string) =>
        (current: { state: typeof loaded.state }): typeof loaded.state => {
          const combatEffects = combatEffectsStateSchema.parse(current.state.combatEffects);
          return {
            ...current.state,
            combatEffects: { ...combatEffects, effects: [...combatEffects.effects, effect(id)] },
          };
        };

      // A combat write lands after the GM's screen loaded `loaded`; the GM's change is then
      // derived from what is stored, not from `loaded`.
      const afterCombat = await service.updateScenarioParticipantState({
        participantId: loaded.id,
        scenarioId: scenario.id,
        state: addEffect("combat-hit")(loaded),
      });
      const afterGm = await service.updateScenarioParticipantState({
        participantId: loaded.id,
        scenarioId: scenario.id,
        update: addEffect("gm-effect"),
      });
      expect(afterGm.state.combatEffects?.effects.map((entry) => entry.id)).toEqual([
        "combat-hit",
        "gm-effect",
      ]);
      // Combat's revision-checked writes key on this moving.
      expect(afterGm.updatedAt > afterCombat.updatedAt).toBe(true);

      // Concurrent changes each see the previous one's write: none is lost.
      const ids = Array.from({ length: 8 }, (_unused, index) => `parallel-${index}`);
      await Promise.all(
        ids.map((id) =>
          service.updateScenarioParticipantState({
            participantId: loaded.id,
            scenarioId: scenario.id,
            update: addEffect(id),
          }),
        ),
      );
      const stored = await scenarioRepository.getScenarioParticipantById(loaded.id, scenario.id);
      expect(stored?.state.combatEffects?.effects.map((entry) => entry.id).sort()).toEqual(
        ["combat-hit", "gm-effect", ...ids].sort(),
      );

      // A refusal raised while deriving the change writes nothing.
      await expect(
        service.updateScenarioParticipantState({
          participantId: loaded.id,
          scenarioId: scenario.id,
          update: () => {
            throw new Error("refused");
          },
        }),
      ).rejects.toThrow("refused");
      expect(await scenarioRepository.getScenarioParticipantById(loaded.id, scenario.id)).toEqual(
        stored,
      );

      // The row must belong to the Scenario named.
      await expect(
        scenarioRepository.updateScenarioParticipantStateFromCurrent({
          participantId: loaded.id,
          scenarioId: "another-scenario",
          update: addEffect("misdirected"),
        }),
      ).rejects.toThrow("Scenario participant not found.");
    });

    it("atomically persists and reloads C1 source state, roll-once rate, and exact remainder", async () => {
      const gm = await createTestUser(prisma!, { roles: ["game_master"] });
      const owner = await createTestUser(prisma!);
      const character = await createTestCharacter(prisma!, owner.id, { name: "Bleeding hero" });
      const scenarioRepository = createPrismaScenarioRepository(prisma!);
      const characterService = new CharacterService(createPrismaCharacterRepository(prisma!));
      const equipmentService = new CharacterEquipmentReadModelService(
        createPrismaCharacterEquipmentRepository(prisma!),
      );
      const campaignService = new CampaignService(scenarioRepository, characterService);
      const scenarioService = new ScenarioService(
        scenarioRepository,
        characterService,
        equipmentService,
        prisma!,
      );
      const campaign = await campaignService.createCampaign({
        gmUserId: gm.id,
        name: "C1 persistence",
        status: "draft",
      });
      await campaignService.addCampaignRosterEntry({
        campaignId: campaign.id,
        category: "pc",
        sourceId: character.id,
        sourceType: "character",
      });
      const scenario = await scenarioService.createScenario({
        campaignId: campaign.id,
        name: "C1 persistence",
        status: "live",
      });
      const participant = await scenarioService.addCharacterParticipant({
        characterId: character.id,
        controlledByUserId: owner.id,
        joinSource: "gm_added",
        scenarioId: scenario.id,
      });
      const service = new EncounterService(
        createPrismaEncounterRepository(prisma!),
        scenarioRepository,
      );
      const sessionBase = encounterSessionSchema.parse({
        createdAt: "2026-08-29T10:00:00.000Z",
        currentRound: 2,
        id: "c1-persistence",
        kind: "roleplay",
        participantMembershipMode: "explicit",
        participants: [
          {
            id: "c1-hero",
            label: "Bleeding hero",
            participantType: "scenario",
            scenarioParticipantId: participant.id,
          },
        ],
        scenarioId: scenario.id,
        status: "draft",
        title: "C1 persistence",
        updatedAt: "2026-08-29T10:00:00.000Z",
      });
      const createdEncounter = await service.createEncounter({
        campaignId: campaign.id,
        scenarioId: scenario.id,
        session: encounterSessionSchema.parse({
          ...sessionBase,
          combatRoundState: initializeCombatRoundState({ encounter: sessionBase }),
        }),
      });
      const encounter = await service.updateEncounter({
        campaignId: campaign.id,
        encounterId: createdEncounter.id,
        expectedRevision: createdEncounter.updatedAt,
        scenarioId: scenario.id,
        session: { ...createdEncounter, status: "active" },
      });
      const combatEffects = combatEffectsStateSchema.parse({
        criticalBleedAccumulator: {
          lastProcessedRound: 2,
          remainder: { denominator: 3, numerator: 2 },
        },
        effects: [
          {
            createdAt: "2026-08-29T10:01:00.000Z",
            criticalRuntime: {
              bleed: {
                allowedControlStates: ["active", "partial", "staunched_zero", "resolved"],
                controlState: "active",
                currentRate: { denominator: 12, numerator: 3 },
                firstTickRound: 2,
                kind: "external",
                rate: { denominator: 12, numerator: 3 },
                rollFormula: "d4",
                sourceEffectKey: "falling_crushing|whole_body|10|04",
                sourceRate: "1D4 HP / round",
                storedRoll: 3,
              },
              criticalKey: "falling_crushing|whole_body|10",
              fixtureVersion: "c1-2026-08-28",
              kind: "bleed",
            },
            damage: 0,
            effectGroup: "bleed",
            generalDamage: 0,
            id: "c1-roll-once-source",
            sourceEventId: "c1-event",
            status: "active",
            targetParticipantId: participant.id,
            type: "bleed",
            updatedAt: "2026-08-29T10:01:00.000Z",
          },
        ],
        events: [
          {
            createdAt: "2026-08-29T10:01:00.000Z",
            description: "C1 Critical",
            id: "c1-event",
            sourceLabel: "Critical",
            sourceType: "critical",
            targetParticipantId: participant.id,
          },
        ],
      });
      const state = scenarioParticipantStateSchema.parse({
        ...participant.state,
        combatEffects,
      });
      // combat-panel-contract.md 12.7/12.13: `declaration` is round and phase bookkeeping and is
      // suppressed at the data boundary; `attack` is a published, narratively meaningful outcome.
      // Both are committed in the same write so the assertion proves selection, not absence of
      // traffic.
      const suppressedCombatEvent = combatStepEventSchema.parse({
        actorParticipantId: participant.id,
        completeness: "complete",
        encounterId: encounter.id,
        facts: { publicOutcome: { declaration: "ready" } },
        id: "c1-combat-event",
        occurredAt: "2026-08-29T10:02:00.000Z",
        roundNumber: 2,
        schemaVersion: 1,
        sequence: 0,
        source: { kind: "canonical" },
        status: "recorded",
        step: "select_actions",
        type: "declaration",
        visibility: {
          involvedParticipantIds: [participant.id],
          outcomeScope: "involved",
        },
      });
      const publishedCombatEvent = combatStepEventSchema.parse({
        actorParticipantId: participant.id,
        completeness: "complete",
        encounterId: encounter.id,
        facts: { publicOutcome: { hit: true } },
        id: "c1-combat-event-attack",
        occurredAt: "2026-08-29T10:02:01.000Z",
        roundNumber: 2,
        schemaVersion: 1,
        sequence: 1,
        source: { kind: "canonical" },
        status: "recorded",
        step: "phase_1_actions",
        type: "attack",
        visibility: {
          involvedParticipantIds: [participant.id],
          outcomeScope: "involved",
        },
      });
      const combatEvent = publishedCombatEvent;
      const encounterWithCombatEvent = encounterSessionSchema.parse({
        ...encounter,
        combatRoundState: {
          ...encounter.combatRoundState!,
          events: [
            ...encounter.combatRoundState!.events,
            suppressedCombatEvent,
            publishedCombatEvent,
          ],
        },
      });
      const saved = await service.commitCombatParticipantStateMutation({
        campaignId: campaign.id,
        encounterId: encounter.id,
        expectedEncounterRevision: encounter.updatedAt,
        participant,
        scenarioId: scenario.id,
        session: encounterWithCombatEvent,
        state,
      });
      const reloaded = await scenarioRepository.getScenarioParticipantById(
        participant.id,
        scenario.id,
      );

      expect(reloaded?.state.combatEffects).toEqual(combatEffects);
      expect(saved.participant.state.combatEffects).toEqual(combatEffects);
      const objectiveEvents = await scenarioRepository.listScenarioEventLogs(scenario.id);
      expect(
        objectiveEvents.filter((event) => event.eventType === "encounter_combat_outcome"),
      ).toEqual([
        expect.objectContaining({
          eventType: "encounter_combat_outcome",
          scenarioId: scenario.id,
          sequence: expect.any(Number),
        }),
      ]);
      const combatOutcomePayload = objectiveEvents.find(
        (event) => event.eventType === "encounter_combat_outcome",
      )?.payload as Record<string, unknown> | undefined;
      expect(combatOutcomePayload).toMatchObject({
        actorParticipantId: participant.id,
        audienceParticipantIds: [participant.id],
        combatEventId: combatEvent.id,
        encounterId: encounter.id,
        eventKind: "attack",
      });
      // The suppressed bookkeeping event was never written as an Activity row at all.
      expect(
        objectiveEvents.some(
          (event) =>
            event.eventType === "encounter_combat_outcome" &&
            (event.payload as Record<string, unknown> | null)?.eventKind === "declaration",
        ),
      ).toBe(false);
      // Structured facts are persisted so the sentence can be produced per viewer; GM-only and
      // roller-private material is not carried into the player-safe read path.
      expect(combatOutcomePayload?.activityFacts).toMatchObject({
        eventType: "attack",
        outcomeScope: "involved",
        publicOutcome: { hit: true },
      });
      await expect(
        service.commitCombatParticipantStateMutation({
          campaignId: campaign.id,
          encounterId: encounter.id,
          expectedEncounterRevision: encounter.updatedAt,
          participant,
          scenarioId: scenario.id,
          session: encounterWithCombatEvent,
          state,
        }),
      ).rejects.toMatchObject({ code: "stale_revision" });
    });
  });
}
