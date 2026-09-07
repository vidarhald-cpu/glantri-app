import { describe, expect, it, vi } from "vitest";

import { encounterSessionSchema, scenarioParticipantStateSchema } from "@glantri/domain";

import { CombatPersistenceError } from "../repositories/combatStatePersistenceRepository";
import {
  EncounterCombatWriteError,
  EncounterService,
  EncounterWriteError,
} from "./encounterService";
import { createScenarioRepositoryStub } from "./scenarioService.testHelpers";

describe("EncounterService participant effect modifier refresh", () => {
  it("persists and logs participant state with imported rows refreshed atomically", async () => {
    const { eventLogs, repository, scenario } = createScenarioRepositoryStub();
    scenario.status = "live";
    const initialState = scenarioParticipantStateSchema.parse({
      combat: {},
      equipment: {},
      health: {},
      resources: {},
    });
    const participant = await repository.createScenarioParticipant({
      isActive: true,
      joinSource: "gm_added",
      role: "player_character",
      scenarioId: "scenario-1",
      snapshot: { displayName: "Ari" },
      sourceType: "character",
      state: initialState,
    });
    const service = new EncounterService({} as never, repository);
    const nextState = scenarioParticipantStateSchema.parse({
      ...initialState,
      combat: {
        ...initialState.combat,
        combatContext: {
          ...initialState.combat.combatContext,
          modifierBuckets: {
            ...initialState.combat.combatContext.modifierBuckets,
            general: [
              {
                id: "manual-general",
                notes: "Manual row",
                value: 1,
              },
            ],
          },
        },
      },
      combatEffects: {
        effects: [
          {
            combatModifierBucket: "general",
            createdAt: "2026-07-13T08:00:00.000Z",
            damage: 0,
            effectGroup: "general",
            generalDamage: 0,
            id: "effect-1",
            modifierValue: -2,
            sourceEventId: "effect-event-1",
            status: "active",
            targetParticipantId: participant.id,
            type: "general_modifier",
            updatedAt: "2026-07-13T08:00:00.000Z",
          },
        ],
        events: [
          {
            createdAt: "2026-07-13T08:00:00.000Z",
            description: "Persistent penalty",
            id: "effect-event-1",
            sourceLabel: "Persistent penalty",
            sourceType: "manual",
            targetParticipantId: participant.id,
          },
        ],
      },
    });

    const updated = await service.updateScenarioParticipantState({
      participantId: participant.id,
      scenarioId: "scenario-1",
      state: nextState,
    });

    expect(updated.state.combat.combatContext.modifierBuckets.general).toEqual([
      expect.objectContaining({ id: "manual-general", value: 1 }),
      expect.objectContaining({
        id: "import:character_effect:effect-1:general",
        sourceEffectId: "effect-1",
        sourceType: "character_effect",
        value: -2,
      }),
    ]);
    expect(eventLogs.at(-1)?.payload).toEqual(updated.state);
  });

  it("passes participant and encounter SU state through one combat transaction", async () => {
    const { repository, scenario } = createScenarioRepositoryStub();
    scenario.status = "live";
    const state = scenarioParticipantStateSchema.parse({
      combat: {},
      equipment: {},
      health: {},
      resources: {},
    });
    const participant = await repository.createScenarioParticipant({
      isActive: true,
      joinSource: "gm_added",
      role: "player_character",
      scenarioId: "scenario-1",
      snapshot: { displayName: "Ari" },
      sourceType: "character",
      state,
    });
    const session = encounterSessionSchema.parse({
      actionLog: [],
      createdAt: "2026-08-01T10:00:00.000Z",
      currentRound: 2,
      id: "encounter-1",
      kind: "combat",
      participants: [],
      scenarioId: "scenario-1",
      status: "active",
      title: "SU review",
      updatedAt: "2026-08-01T10:00:00.000Z",
    });
    const encounterRepository = {
      updateCombatEncounter: vi.fn().mockResolvedValue(session),
    };
    const service = new EncounterService(encounterRepository as never, repository);

    const saved = await service.commitCombatParticipantStateMutation({
      encounterId: session.id,
      expectedEncounterRevision: session.updatedAt,
      participant,
      scenarioId: "scenario-1",
      session,
      state,
    });

    expect(encounterRepository.updateCombatEncounter).toHaveBeenCalledWith(
      expect.objectContaining({
        expectedRevision: session.updatedAt,
        participantStateUpdates: [
          expect.objectContaining({
            expectedRevision: participant.updatedAt,
            participantId: participant.id,
            scenarioId: "scenario-1",
          }),
        ],
        session,
      }),
    );
    expect(saved).toMatchObject({ encounter: session, participant: { id: participant.id } });
  });
});

describe("EncounterService combat persistence errors", () => {
  it.each(["stale_revision", "transaction_conflict"] as const)(
    "exposes %s through the service boundary without repository details",
    async (code) => {
      const repository = {
        updateCombatEncounter: vi
          .fn()
          .mockRejectedValue(
            new CombatPersistenceError(
              code,
              code === "transaction_conflict"
                ? "Combat state changed while saving. Refresh and try again."
                : "Encounter revision changed before combat state could be saved.",
            ),
          ),
      };
      const service = new EncounterService(repository as never, {} as never);
      const session = encounterSessionSchema.parse({
        actionLog: [],
        createdAt: "2026-07-26T09:00:00.000Z",
        currentRound: 1,
        id: "encounter-1",
        kind: "combat",
        participants: [],
        status: "active",
        title: "Courtyard",
        updatedAt: "2026-07-26T10:00:00.000Z",
      });

      const error = await service
        .updateCombatEncounter({
          encounterId: session.id,
          expectedRevision: session.updatedAt,
          session,
        })
        .catch((caughtError: unknown) => caughtError);

      expect(error).toBeInstanceOf(EncounterCombatWriteError);
      expect(error).toMatchObject({ code });
    },
  );
});

describe("EncounterService roleplay persistence errors", () => {
  it.each(["stale_revision", "transaction_conflict"] as const)(
    "maps %s to the safe general Encounter write boundary",
    async (code) => {
      const repository = {
        updateEncounter: vi
          .fn()
          .mockRejectedValue(
            new CombatPersistenceError(code, "Internal repository detail must stay private."),
          ),
      };
      const service = new EncounterService(repository as never, {} as never);
      const session = encounterSessionSchema.parse({
        actionLog: [],
        createdAt: "2026-08-13T09:00:00.000Z",
        currentRound: 1,
        id: "encounter-1",
        kind: "roleplay",
        participants: [],
        status: "active",
        title: "Courtyard",
        updatedAt: "2026-08-13T10:00:00.000Z",
      });

      const error = await service
        .updateEncounter({
          encounterId: session.id,
          expectedRevision: session.updatedAt,
          session,
        })
        .catch((caughtError: unknown) => caughtError);

      expect(error).toBeInstanceOf(EncounterWriteError);
      expect(error).toMatchObject({ code });
    },
  );
});
