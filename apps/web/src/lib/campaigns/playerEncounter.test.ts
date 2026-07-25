import type { ScenarioParticipant } from "@glantri/domain";

import { describe, expect, it } from "vitest";

import {
  PLAYER_ENCOUNTER_ACTION_OPTIONS,
  PLAYER_ENCOUNTER_SECONDARY_ACTION_OPTIONS,
  buildPlayerEncounterPhaseSummary,
  createEmptyPlayerEncounterCombatContext,
  evaluatePlayerEncounterParryLegality,
  getPlayerEncounterAccessibleParticipants,
  getPlayerEncounterCombatModifierTotals,
  getPlayerEncounterMovementLabel,
  getPlayerEncounterOpponentParticipants,
  getPlayerEncounterParryCoverageDirection,
  getPlayerEncounterParryDirectionLabel,
  isPlayerEncounterAttackAction,
  isPlayerEncounterDefenseAction,
  mergeCombatContextWithCurrentModifierBuckets,
} from "./playerEncounter";

function createScenarioParticipant(
  overrides: Partial<ScenarioParticipant> = {},
): ScenarioParticipant {
  return {
    createdAt: "2026-04-25T10:00:00.000Z",
    id: overrides.id ?? "participant-1",
    isActive: overrides.isActive ?? true,
    joinSource: overrides.joinSource ?? "gm_added",
    role: overrides.role ?? "npc",
    scenarioId: overrides.scenarioId ?? "scenario-1",
    snapshot: overrides.snapshot ?? {
      displayName: overrides.id ?? "Participant 1",
    },
    sourceType: overrides.sourceType ?? "entity",
    state:
      overrides.state ??
      ({
        combat: {
          combatContext: {
            modifierBuckets: {
              general: [],
              situationDb: [],
              situationInitiative: [],
              situationObSkill: [],
            },
          },
          engaged: false,
        },
        conditions: [],
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
      } as unknown as ScenarioParticipant["state"]),
    updatedAt: "2026-04-25T10:00:00.000Z",
    ...overrides,
  };
}

describe("playerEncounter", () => {
  it("separates primary Parry from secondary Observe Opponent options", () => {
    expect(PLAYER_ENCOUNTER_ACTION_OPTIONS).toContainEqual({
      label: "Parry",
      value: "parry",
    });
    expect(PLAYER_ENCOUNTER_ACTION_OPTIONS.map((option) => option.value)).not.toContain(
      "observe_opponent",
    );
    expect(PLAYER_ENCOUNTER_SECONDARY_ACTION_OPTIONS).toContainEqual({
      label: "Observe Opponent",
      value: "observe_opponent",
    });
  });

  it("maps primary and secondary actions into round phases", () => {
    expect(
      buildPlayerEncounterPhaseSummary({
        actionId: "attack_parry",
        secondaryActionId: "parry_attack",
      }),
    ).toEqual({
      phaseOne: "Single attack",
      phaseTwo: "Reactive attack",
    });

    expect(
      buildPlayerEncounterPhaseSummary({
        actionId: "parry_attack",
        secondaryActionId: "attack_parry",
      }),
    ).toEqual({
      phaseOne: "Reactive attack",
      phaseTwo: "Single attack",
    });
  });

  it("leaves an empty second phase open when no secondary action is selected", () => {
    expect(
      buildPlayerEncounterPhaseSummary({
        actionId: "disarm",
        secondaryActionId: "",
      }),
    ).toEqual({
      phaseOne: "Disarm",
      phaseTwo: "Open",
    });
  });

  it("classifies attack and defense combat actions for compact phase panels", () => {
    expect(isPlayerEncounterAttackAction("attack_parry")).toBe(true);
    expect(isPlayerEncounterAttackAction("parry_attack")).toBe(true);
    expect(isPlayerEncounterAttackAction("observe_opponent")).toBe(false);
    expect(isPlayerEncounterDefenseAction("attack_parry")).toBe(true);
    expect(isPlayerEncounterDefenseAction("parry_attack")).toBe(true);
    expect(isPlayerEncounterDefenseAction("double_attack")).toBe(false);
  });

  it("returns a stable movement label fallback", () => {
    expect(getPlayerEncounterMovementLabel("advance")).toBe("Advance");
    expect(getPlayerEncounterMovementLabel("")).toBe("Maintain distance to opponent");
  });

  it("derives combat modifier totals from the combat modifier buckets", () => {
    expect(
      getPlayerEncounterCombatModifierTotals({
        modifierBuckets: {
          general: [
            { id: "g-1", scope: "until", value: 2 },
            { id: "g-2", scope: "save", value: -1 },
          ],
          situationDb: [{ id: "db-1", scope: "until", value: 4 }],
          situationInitiative: [{ id: "initiative-1", scope: "until", value: 5 }],
          situationObSkill: [{ id: "ob-1", scope: "until", value: 3 }],
        },
      }),
    ).toEqual({
      attackTotal: 4,
      defenseTotal: 5,
      generalTotal: 1,
      situationDbTotal: 4,
      situationInitiativeTotal: 5,
      situationObSkillTotal: 3,
    });
  });

  it("counts generated Reactive attack DB/Parry rows in the defense total", () => {
    expect(
      getPlayerEncounterCombatModifierTotals({
        modifierBuckets: {
          general: [],
          situationDb: [
            {
              durationRounds: 1,
              generated: true,
              id: "generated:parry-attack:phase2:db-parry",
              notes: "reactive attack",
              scope: "until",
              sourceActionId: "parry_attack",
              sourcePhase: "phase2",
              sourceRule: "parry-attack-db-parry-phase2",
              value: -4,
            },
          ],
          situationInitiative: [],
          situationObSkill: [],
        },
      }).defenseTotal,
    ).toBe(-4);
  });

  it("keeps current GM modifier buckets when a saved declaration has older combat context", () => {
    const mergedContext = mergeCombatContextWithCurrentModifierBuckets({
      baseContext: {
        selectedOpponentId: "guard-1",
        modifierBuckets: {
          general: [],
          situationDb: [],
          situationInitiative: [],
          situationObSkill: [],
        },
      },
      currentContext: {
        selectedOpponentId: "guard-2",
        modifierBuckets: {
          general: [],
          situationDb: [{ id: "db-1", scope: "until", value: 2 }],
          situationInitiative: [{ id: "initiative-1", scope: "until", value: 3 }],
          situationObSkill: [{ id: "ob-1", scope: "until", value: -1 }],
        },
      },
    });

    expect(mergedContext.selectedOpponentId).toBe("guard-1");
    expect(mergedContext.modifierBuckets).toEqual({
      general: [],
      situationDb: [{ id: "db-1", scope: "until", value: 2 }],
      situationInitiative: [{ id: "initiative-1", scope: "until", value: 3 }],
      situationObSkill: [{ id: "ob-1", scope: "until", value: -1 }],
    });
  });

  it("treats off-hand or shield parry as legal for attack-parry when they cover the incoming side", () => {
    expect(
      evaluatePlayerEncounterParryLegality({
        actionId: "attack_parry",
        attackSource: "mainHand",
        hasOffHandWeapon: false,
        hasShield: true,
        hasSelectedOpponent: true,
        incomingAttackSide: "left",
        parrySource: "shield",
      }),
    ).toMatchObject({
      resolvedParrySource: "shield",
      status: "legal",
    });

    expect(
      evaluatePlayerEncounterParryLegality({
        actionId: "attack_parry",
        attackSource: "mainHand",
        hasOffHandWeapon: true,
        hasShield: false,
        hasSelectedOpponent: true,
        incomingAttackSide: "left",
        parrySource: "auto",
      }),
    ).toMatchObject({
      resolvedParrySource: "offHand",
      status: "legal",
    });
  });

  it("marks the attacking source as not legal for parry in the same phase", () => {
    expect(
      evaluatePlayerEncounterParryLegality({
        actionId: "attack_parry",
        attackSource: "mainHand",
        hasOffHandWeapon: false,
        hasShield: false,
        hasSelectedOpponent: true,
        incomingAttackSide: "front",
        parrySource: "mainHand",
      }),
    ).toMatchObject({
      resolvedParrySource: "mainHand",
      status: "not_legal",
    });

    expect(
      evaluatePlayerEncounterParryLegality({
        actionId: "attack_parry",
        attackSource: "offHand",
        hasOffHandWeapon: true,
        hasShield: true,
        hasSelectedOpponent: true,
        incomingAttackSide: "rear",
        parrySource: "offHand",
      }),
    ).toMatchObject({
      resolvedParrySource: "offHand",
      status: "not_legal",
    });
  });

  it("treats missing opponent selection as incomplete parry context", () => {
    expect(
      evaluatePlayerEncounterParryLegality({
        actionId: "attack_parry",
        attackSource: "mainHand",
        hasOffHandWeapon: true,
        hasShield: true,
        incomingAttackSide: "front",
        parrySource: "shield",
      }),
    ).toMatchObject({
      status: "incomplete",
    });
  });

  it("does not require incoming attack side for current player-side completeness", () => {
    expect(
      evaluatePlayerEncounterParryLegality({
        actionId: "attack_parry",
        attackSource: "mainHand",
        hasOffHandWeapon: true,
        hasShield: true,
        hasSelectedOpponent: true,
        parrySource: "shield",
      }),
    ).toMatchObject({
      resolvedParrySource: "shield",
      status: "legal",
    });
  });

  it("maps parry direction coverage two steps to the right with edge clamping", () => {
    expect(getPlayerEncounterParryCoverageDirection("left")).toBe("forward");
    expect(getPlayerEncounterParryCoverageDirection("left_forward")).toBe("right_forward");
    expect(getPlayerEncounterParryCoverageDirection("right")).toBe("right_backward");
    expect(getPlayerEncounterParryDirectionLabel("left_backward")).toBe("Left/backward");
  });

  it("provides an empty persisted combat context shape", () => {
    expect(createEmptyPlayerEncounterCombatContext()).toEqual({
      modifierBuckets: {
        general: [],
        situationDb: [],
        situationInitiative: [],
        situationObSkill: [],
      },
    });
  });

  it("includes active NPC/entity participants in accessible GM selections", () => {
    const participants = [
      createScenarioParticipant({
        id: "pc-1",
        role: "player_character",
        sourceType: "character",
      }),
      createScenarioParticipant({
        id: "npc-1",
        role: "npc",
        sourceType: "entity",
      }),
      createScenarioParticipant({
        id: "monster-1",
        isActive: false,
        role: "monster",
        sourceType: "entity",
      }),
    ];

    expect(
      getPlayerEncounterAccessibleParticipants({
        currentUserId: "gm-1",
        isGameMaster: true,
        participants,
      }).map((participant) => participant.id),
    ).toEqual(["pc-1", "npc-1"]);
  });

  it("includes active NPC/entity opponents and excludes self", () => {
    const participants = [
      createScenarioParticipant({
        controlledByUserId: "player-1",
        id: "pc-1",
        role: "player_character",
        sourceType: "character",
      }),
      createScenarioParticipant({
        id: "npc-1",
        role: "npc",
        sourceType: "entity",
      }),
      createScenarioParticipant({
        id: "animal-1",
        role: "animal",
        sourceType: "entity",
      }),
      createScenarioParticipant({
        id: "inactive-npc",
        isActive: false,
        role: "npc",
        sourceType: "entity",
      }),
    ];

    expect(
      getPlayerEncounterOpponentParticipants({
        currentUserId: "gm-1",
        isGameMaster: true,
        participants,
        selectedParticipantId: "pc-1",
      }).map((participant) => participant.id),
    ).toEqual(["npc-1", "animal-1"]);
  });

  it("keeps player opponent visibility on the projected active participant list", () => {
    const participants = [
      createScenarioParticipant({
        controlledByUserId: "player-1",
        id: "pc-1",
        role: "player_character",
        sourceType: "character",
      }),
    ];

    expect(
      getPlayerEncounterOpponentParticipants({
        currentUserId: "player-1",
        isGameMaster: false,
        participants,
        projectionVisibleParticipants: [
          {
            displayName: "NPC 1",
            id: "npc-1",
            isActive: true,
            isControlledByPlayer: false,
            role: "npc",
            sourceType: "entity",
          },
        ],
        selectedParticipantId: "pc-1",
      }).map((participant) => participant.id),
    ).toEqual(["npc-1"]);
  });

  it("limits GM target options to active encounter participants when provided", () => {
    const participants = [
      createScenarioParticipant({
        controlledByUserId: "player-1",
        id: "pc-1",
        role: "player_character",
        sourceType: "character",
      }),
      createScenarioParticipant({
        id: "npc-1",
        role: "npc",
        sourceType: "entity",
      }),
      createScenarioParticipant({
        id: "stale-scyrian",
        role: "npc",
        sourceType: "entity",
      }),
    ];

    expect(
      getPlayerEncounterOpponentParticipants({
        allowedParticipantIds: ["pc-1", "npc-1"],
        currentUserId: "gm-1",
        isGameMaster: true,
        participants,
        selectedParticipantId: "pc-1",
      }).map((participant) => participant.id),
    ).toEqual(["npc-1"]);
  });

  it("limits player target options to visible active encounter participants when provided", () => {
    expect(
      getPlayerEncounterOpponentParticipants({
        allowedParticipantIds: ["pc-1", "npc-1"],
        currentUserId: "player-1",
        isGameMaster: false,
        participants: [],
        projectionVisibleParticipants: [
          {
            displayName: "NPC 1",
            id: "npc-1",
            isActive: true,
            isControlledByPlayer: false,
            role: "npc",
            sourceType: "entity",
          },
          {
            displayName: "Stale Scyrian",
            id: "stale-scyrian",
            isActive: true,
            isControlledByPlayer: false,
            role: "npc",
            sourceType: "entity",
          },
        ],
        selectedParticipantId: "pc-1",
      }).map((participant) => participant.id),
    ).toEqual(["npc-1"]);
  });
});
