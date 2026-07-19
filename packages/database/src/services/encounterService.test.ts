import { describe, expect, it } from "vitest";

import { scenarioParticipantStateSchema } from "@glantri/domain";

import { EncounterService } from "./encounterService";
import { createScenarioRepositoryStub } from "./scenarioService.testHelpers";

describe("EncounterService participant effect modifier refresh", () => {
  it("persists and logs participant state with imported rows refreshed atomically", async () => {
    const { eventLogs, repository } = createScenarioRepositoryStub();
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
});
