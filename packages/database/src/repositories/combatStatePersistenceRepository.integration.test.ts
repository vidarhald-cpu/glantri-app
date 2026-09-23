import { beforeEach, describe, expect, it } from "vitest";

import {
  combatRoundStateSchema,
  encounterSessionSchema,
  resolveCombatTaskAtOpportunity,
  reviewCombatTaskAtOpportunity,
  setCombatRoundCombatExperienceDifficulty,
  undoLatestCombatRoundCommand,
} from "@glantri/domain";

import { getTestPrismaClient, resetTestDatabase } from "../testing/testDatabase";
import {
  CombatPersistenceError,
  COMBAT_STORAGE_MODE_SPLIT_V1,
  createPrismaCombatStatePersistenceRepository,
} from "./combatStatePersistenceRepository";
import { createPrismaCombatStateReadRepository } from "./combatStateReadRepository";

const prisma = getTestPrismaClient();

function buildLegacySession(updatedAt: string) {
  return encounterSessionSchema.parse({
    actionLog: [],
    combatRoundState: combatRoundStateSchema.parse({
      commands: [],
      encounterId: "split-integration",
      participants: [{ label: "Aria", participantId: "aria" }],
      roundNumber: 2,
      rounds: [{ encounterId: "split-integration", roundNumber: 1 }],
    }),
    createdAt: "2026-07-26T09:00:00.000Z",
    currentRound: 2,
    id: "split-integration",
    kind: "combat",
    participants: [
      {
        id: "aria",
        label: "Aria",
        participantType: "scenario",
        scenarioParticipantId: "scenario-aria",
      },
    ],
    scenarioId: "scenario-1",
    status: "active",
    title: "Split integration",
    updatedAt,
  });
}

if (!process.env.DATABASE_URL_TEST) {
  describe.skip("Combat split persistence integration (DATABASE_URL_TEST not set)", () => {});
} else {
  describe("Combat split persistence integration", () => {
    beforeEach(async () => {
      await resetTestDatabase(prisma!);
    });

    it("materializes legacy storage, preserves archives across active writes, and cascades deletion", async () => {
      const initial = buildLegacySession("2026-07-26T10:00:00.000Z");
      const created = await prisma!.encounter.create({
        data: {
          id: initial.id,
          name: initial.title,
          scenarioId: initial.scenarioId,
          sessionJson: initial as never,
          status: initial.status,
        },
      });
      const persistence = createPrismaCombatStatePersistenceRepository(prisma!);
      const reads = createPrismaCombatStateReadRepository(prisma!);

      const materialized = await persistence.updateCombatEncounter({
        encounterId: initial.id,
        expectedRevision: created.updatedAt.toISOString(),
        scenarioId: initial.scenarioId,
        session: initial,
      });
      const splitRecord = await prisma!.encounter.findUniqueOrThrow({
        include: {
          activeCombatState: true,
          archivedCombatRounds: true,
        },
        where: { id: initial.id },
      });

      expect(splitRecord.combatStorageMode).toBe(COMBAT_STORAGE_MODE_SPLIT_V1);
      expect(splitRecord.combatArchiveCount).toBe(1);
      expect(splitRecord.activeCombatState).not.toBeNull();
      expect(splitRecord.archivedCombatRounds).toHaveLength(1);
      expect(splitRecord.sessionJson).not.toHaveProperty("combatRoundState");
      await expect(reads.getFullEncounterById(initial.id)).resolves.toMatchObject({
        encounter: expect.objectContaining({
          combatRoundState: materialized.combatRoundState,
          id: initial.id,
        }),
      });

      const archiveCreatedAt = splitRecord.archivedCombatRounds[0]!.createdAt;
      const activeMutation = await persistence.updateCombatEncounter({
        encounterId: initial.id,
        expectedRevision: materialized.updatedAt,
        scenarioId: initial.scenarioId,
        session: {
          ...materialized,
          description: "Active-only mutation",
          combatRoundState: {
            ...materialized.combatRoundState!,
            breakOffProposals: [
              {
                attackerParticipantId: "borin",
                escapeeParticipantId: "aria",
                id: "break-off:round:2:escapee:aria:attacker:borin",
                pairKey: "aria::borin",
                roundNumber: 2,
                status: "awaiting_gm_review",
              },
            ],
            engagements: [
              {
                participantAId: "aria",
                participantBId: "borin",
                pairKey: "aria::borin",
                status: "engaged",
              },
            ],
            selectedParticipantId: "aria",
          },
        },
      });
      const afterMutation = await prisma!.encounter.findUniqueOrThrow({
        include: { archivedCombatRounds: true },
        where: { id: initial.id },
      });

      expect(afterMutation.archivedCombatRounds).toHaveLength(1);
      expect(afterMutation.archivedCombatRounds[0]!.createdAt).toEqual(archiveCreatedAt);
      expect(activeMutation.combatRoundState?.selectedParticipantId).toBe("aria");
      expect(activeMutation.combatRoundState?.breakOffProposals[0]).toMatchObject({
        id: "break-off:round:2:escapee:aria:attacker:borin",
        status: "awaiting_gm_review",
      });
      await expect(reads.getFullEncounterById(initial.id)).resolves.toMatchObject({
        encounter: expect.objectContaining({
          combatRoundState: expect.objectContaining({
            breakOffProposals: [
              expect.objectContaining({
                id: "break-off:round:2:escapee:aria:attacker:borin",
              }),
            ],
            engagements: [expect.objectContaining({ pairKey: "aria::borin" })],
          }),
        }),
      });

      await prisma!.encounter.delete({ where: { id: initial.id } });
      await expect(
        prisma!.encounterActiveCombatState.count({ where: { encounterId: initial.id } }),
      ).resolves.toBe(0);
      await expect(
        prisma!.encounterArchivedCombatRound.count({ where: { encounterId: initial.id } }),
      ).resolves.toBe(0);
    });

    it("round-trips the canonical Perform Task lifecycle through split combat storage", async () => {
      const taskId = "round:2:participant:aria:declaration:perform_task";
      const at = "2026-07-26T10:30:00.000Z";
      const lifecycleState = combatRoundStateSchema.parse({
        commands: [
          {
            afterCursor: { participantId: "aria", roundNumber: 2, step: "i1" },
            beforeCursor: { participantId: "aria", roundNumber: 2, step: "i1" },
            createdAt: "2026-07-26T10:00:00.000Z",
            facts: {},
            id: "command-i1",
            participantId: "aria",
            roundNumber: 2,
            step: "i1",
            type: "roll_initiative_phase1",
          },
        ],
        currentCursor: { participantId: "aria", roundNumber: 2, step: "A1" },
        currentStep: "phase_1_actions",
        encounterId: "split-integration",
        genericActions: [
          {
            createdAt: at,
            declarationKind: "perform_task",
            duration: { kind: "gm_decided" },
            id: taskId,
            intent: "Force the portcullis winch.",
            lastUpdatedAt: at,
            ownerParticipantId: "aria",
            progress: { completedRounds: 0 },
            status: "declared",
          },
        ],
        participants: [
          {
            declaration: { actionId: "perform_task", roundNumber: 2, submittedBy: "player" },
            label: "Aria",
            participantId: "aria",
          },
        ],
        phaseResolutionCursor: { participantId: "aria", phase: "phase1", substep: "perform_task" },
        phaseResolutionStatuses: { aria: { phase1: { substep: "perform_task", updatedAt: at } } },
        roundNumber: 2,
        rounds: [{ encounterId: "split-integration", roundNumber: 1 }],
        selectedParticipantId: "aria",
        selectedStep: "phase_1_actions",
      });
      const reviewedState = reviewCombatTaskAtOpportunity({
        actionId: taskId,
        command: { createdAt: at, createdByUserId: "user-gm" },
        duration: { kind: "round" },
        participantId: "aria",
        phase: "phase1",
        state: lifecycleState,
        updatedAt: at,
      }).state;
      const resolvedState = resolveCombatTaskAtOpportunity({
        actionId: taskId,
        command: { createdAt: at, createdByUserId: "user-gm" },
        participantId: "aria",
        phase: "phase1",
        resultText: "The winch groans and the portcullis lifts.",
        state: reviewedState,
        updatedAt: at,
        visibleToParticipantIds: [],
      }).state;

      const session = encounterSessionSchema.parse({
        ...buildLegacySession("2026-07-26T10:00:00.000Z"),
        combatRoundState: resolvedState,
        currentRound: 2,
      });
      const created = await prisma!.encounter.create({
        data: {
          id: session.id,
          name: session.title,
          scenarioId: session.scenarioId,
          sessionJson: session as never,
          status: session.status,
        },
      });
      const persistence = createPrismaCombatStatePersistenceRepository(prisma!);
      const reads = createPrismaCombatStateReadRepository(prisma!);
      const stored = await persistence.updateCombatEncounter({
        encounterId: session.id,
        expectedRevision: created.updatedAt.toISOString(),
        scenarioId: session.scenarioId,
        session,
      });

      const record = await prisma!.encounter.findUniqueOrThrow({
        include: { activeCombatState: true, archivedCombatRounds: true },
        where: { id: session.id },
      });
      expect(record.combatStorageMode).toBe(COMBAT_STORAGE_MODE_SPLIT_V1);
      const persistedState = record.activeCombatState!.stateJson as unknown as {
        commands: { facts: Record<string, unknown>; type: string }[];
        events: { type: string }[];
      };
      expect(persistedState.commands.map((command) => command.type)).toEqual([
        "roll_initiative_phase1",
        "review_combat_task",
        "resolve_combat_task",
      ]);
      expect(persistedState.events.map((event) => event.type)).toEqual(["task_resolved"]);
      const resolveCommand = persistedState.commands.at(-1)!;
      expect(resolveCommand.facts.taskUndo).toMatchObject({ actionId: taskId, version: 1 });
      expect(resolveCommand.facts).not.toHaveProperty("previousState");

      // The persisted state is the authority the undo path reads back.
      const reloaded = await reads.getFullEncounterById(session.id);
      const reloadedState = combatRoundStateSchema.parse(reloaded!.encounter.combatRoundState);
      const undone = undoLatestCombatRoundCommand({ state: reloadedState });
      expect(undone).toEqual(combatRoundStateSchema.parse(reviewedState));

      const afterUndo = await persistence.updateCombatEncounter({
        encounterId: session.id,
        expectedRevision: stored.updatedAt,
        scenarioId: session.scenarioId,
        session: { ...stored, combatRoundState: undone! },
      });
      expect(afterUndo.combatRoundState?.events).toHaveLength(0);
      expect(afterUndo.combatRoundState?.genericActions[0]).toMatchObject({
        progress: { completedRounds: 0 },
        status: "active",
      });

      await prisma!.encounter.delete({ where: { id: session.id } });
    });

    it("keeps concurrent first legacy writes atomic and accepts only one revision", async () => {
      const initial = buildLegacySession("2026-07-26T10:00:00.000Z");
      const created = await prisma!.encounter.create({
        data: {
          id: initial.id,
          name: initial.title,
          scenarioId: initial.scenarioId,
          sessionJson: initial as never,
          status: initial.status,
        },
      });
      const persistence = createPrismaCombatStatePersistenceRepository(prisma!, {
        retryDelay: async () => undefined,
      });
      const expectedRevision = created.updatedAt.toISOString();

      const results = await Promise.allSettled(
        [26, 36].map((difficulty) =>
          persistence.updateCombatEncounter({
            encounterId: initial.id,
            expectedRevision,
            scenarioId: initial.scenarioId,
            session: {
              ...initial,
              combatRoundState: setCombatRoundCombatExperienceDifficulty({
                difficulty,
                state: initial.combatRoundState!,
              }),
            },
          }),
        ),
      );

      expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
      const rejected = results.find(
        (result): result is PromiseRejectedResult => result.status === "rejected",
      );
      expect(rejected?.reason).toBeInstanceOf(CombatPersistenceError);
      expect(rejected?.reason).toMatchObject({ code: "stale_revision" });

      const splitRecord = await prisma!.encounter.findUniqueOrThrow({
        include: {
          activeCombatState: true,
          archivedCombatRounds: true,
        },
        where: { id: initial.id },
      });
      expect(splitRecord.combatStorageMode).toBe(COMBAT_STORAGE_MODE_SPLIT_V1);
      expect(splitRecord.activeCombatState).not.toBeNull();
      expect(splitRecord.archivedCombatRounds).toHaveLength(1);
      expect(
        [26, 36].includes(
          (
            splitRecord.activeCombatState?.stateJson as {
              combatExperienceDifficulty?: number;
            }
          ).combatExperienceDifficulty ?? 0,
        ),
      ).toBe(true);
      expect(
        await prisma!.encounterActiveCombatState.count({
          where: { encounterId: initial.id },
        }),
      ).toBe(1);
    });
  });
}
