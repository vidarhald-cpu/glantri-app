import { describe, expect, it } from "vitest";

import type { EncounterParticipant, ScenarioParticipant } from "@glantri/domain";

import {
  buildGmEncounterParticipantRows,
  deriveGmEncounterControlState,
} from "./gmEncounter";

function createEncounterParticipant(
  input: Partial<EncounterParticipant> & Pick<EncounterParticipant, "id" | "label">,
): EncounterParticipant {
  return {
    declaration: {
      actionType: "none",
      defenseFocus: "none",
      defensePosture: "none",
      targetLocation: "any",
      ...input.declaration,
    },
    facing: "north",
    id: input.id,
    initiative: 0,
    label: input.label,
    order: 0,
    orientation: "neutral",
    participantType: input.participantType ?? "character",
    position: { x: 0, y: 0, zone: "center" },
    characterId: input.characterId,
    adHocName: input.adHocName,
  };
}

function createScenarioParticipant(
  input: Partial<ScenarioParticipant> & Pick<ScenarioParticipant, "id" | "scenarioId">,
): ScenarioParticipant {
  return {
    createdAt: "2026-04-25T00:00:00.000Z",
    id: input.id,
    isActive: input.isActive ?? true,
    joinSource: input.joinSource ?? "gm_added",
    role: input.role ?? "npc",
    scenarioId: input.scenarioId,
    snapshot: input.snapshot ?? { displayName: "Participant" },
    sourceType: input.sourceType ?? "entity",
    state: input.state ?? {
      combat: {
        combatContext: {
          modifierBuckets: {
            general: [],
            situationDb: [],
            situationObSkill: [],
          },
        },
        engaged: false,
      },
      conditions: [],
      equipment: {},
      health: {
        bleeding: 0,
        currentHp: 10,
        dead: false,
        maxHp: 10,
        unconscious: false,
        wounds: 0,
      },
      modifiers: [],
      resources: {},
      snapshotVersion: 1,
    },
    updatedAt: "2026-04-25T00:00:00.000Z",
    characterId: input.characterId,
    controlledByUserId: input.controlledByUserId,
    displayOrder: input.displayOrder,
    entityId: input.entityId,
    factionId: input.factionId,
    initiativeSlot: input.initiativeSlot,
    position: input.position,
    roleTag: input.roleTag,
    tacticalGroupId: input.tacticalGroupId,
    visibilityOverrides: input.visibilityOverrides,
  };
}

describe("gmEncounter", () => {
  it("derives selected actions and targets from persisted scenario participant combat state", () => {
    const rows = buildGmEncounterParticipantRows({
      encounterParticipants: [
        createEncounterParticipant({
          characterId: "char-1",
          id: "enc-1",
          label: "Ariadne",
        }),
        createEncounterParticipant({
          id: "enc-2",
          label: "Goblin skirmisher",
          participantType: "ad-hoc",
        }),
      ],
      scenarioParticipants: [
        createScenarioParticipant({
          characterId: "char-1",
          id: "scn-1",
          scenarioId: "scenario-1",
          snapshot: { displayName: "Ariadne" },
          sourceType: "character",
          state: {
            combat: {
              combatContext: {
                modifierBuckets: {
                  general: [{ id: "general-1", scope: "until", value: 2 }],
                  situationDb: [],
                  situationObSkill: [{ id: "ob-1", scope: "until", value: 1 }],
                },
                selectedOpponentId: "scn-2",
              },
              engaged: false,
              initiativeRoll: 14,
              lastDeclaredActionId: "attack_parry",
            },
            conditions: [],
            equipment: {},
            health: {
              bleeding: 0,
              currentHp: 12,
              dead: false,
              maxHp: 12,
              unconscious: false,
              wounds: 0,
            },
            modifiers: [],
            resources: {},
            snapshotVersion: 1,
          },
        }),
        createScenarioParticipant({
          id: "scn-2",
          scenarioId: "scenario-1",
          snapshot: { displayName: "Goblin skirmisher" },
        }),
      ],
    });

    expect(rows[0]).toEqual(
      expect.objectContaining({
        hasDeclaredAction: true,
        phaseOneAction: "Attack - Parry",
        phaseOneAdjustments: "ATK +3 · DEF +2",
        phaseOneInitiative: "14",
        selectedAction: "Attack - Parry",
        target: "Goblin skirmisher",
      }),
    );
    expect(rows[1].selectedAction).toBe("Waiting for action");
  });

  it("enables initiative first, then advances to the current phase once initiative exists", () => {
    expect(
      deriveGmEncounterControlState({
        rows: [
          {
            displayName: "A",
            encounterParticipantId: "enc-1",
            hasDeclaredAction: false,
            hasInitiative: false,
            phaseOneAction: "—",
            phaseOneAdjustments: "—",
            phaseOneInitiative: "—",
            phaseOneResults: "—",
            phaseTwoAction: "—",
            phaseTwoAdjustments: "—",
            phaseTwoInitiative: "—",
            phaseTwoResults: "—",
            selectedAction: "Waiting for action",
            target: "—",
          },
        ],
      }),
    ).toEqual({
      disabled: true,
      label: "Waiting for action selections",
    });

    expect(
      deriveGmEncounterControlState({
        rows: [
          {
            displayName: "A",
            encounterParticipantId: "enc-1",
            hasDeclaredAction: true,
            hasInitiative: false,
            phaseOneAction: "Attack - Parry",
            phaseOneAdjustments: "—",
            phaseOneInitiative: "—",
            phaseOneResults: "—",
            phaseTwoAction: "Open",
            phaseTwoAdjustments: "—",
            phaseTwoInitiative: "—",
            phaseTwoResults: "—",
            selectedAction: "Attack - Parry",
            target: "—",
          },
        ],
      }),
    ).toEqual({
      disabled: false,
      label: "Resolve initiative",
    });

    expect(
      deriveGmEncounterControlState({
        rows: [
          {
            displayName: "A",
            encounterParticipantId: "enc-1",
            hasDeclaredAction: true,
            hasInitiative: true,
            phaseOneAction: "Attack - Parry",
            phaseOneAdjustments: "—",
            phaseOneInitiative: "10",
            phaseOneResults: "—",
            phaseTwoAction: "Open",
            phaseTwoAdjustments: "—",
            phaseTwoInitiative: "—",
            phaseTwoResults: "—",
            selectedAction: "Attack - Parry",
            target: "—",
          },
        ],
        scenarioLiveState: {
          combatStatus: "in_progress",
          phase: 2,
          roundNumber: 3,
        },
      }),
    ).toEqual({
      disabled: false,
      label: "Resolve Phase 2",
    });
  });
});
