import { describe, expect, it } from "vitest";

import type { CharacterBuild } from "../character/build";
import type { Scenario, ScenarioParticipant } from "./scenario";
import { buildScenarioPlayerProjection } from "./scenario";

const scenario: Scenario = {
  campaignId: "campaign-1",
  createdAt: "2026-04-21T00:00:00.000Z",
  description: "A live scenario shell.",
  id: "scenario-1",
  kind: "mixed",
  liveState: {
    combatStatus: "not_started",
    phase: 1,
    roundNumber: 1
  },
  name: "Night at the Keep",
  status: "prepared",
  updatedAt: "2026-04-21T00:00:00.000Z"
};

function createParticipant(input: {
  characterId?: string;
  controlledByUserId?: string;
  displayName: string;
  equipmentState?: unknown;
  factionId?: string;
  id: string;
  isActive?: boolean;
  role: ScenarioParticipant["role"];
  snapshotBuild?: CharacterBuild;
  sourceType?: ScenarioParticipant["sourceType"];
}): ScenarioParticipant {
  return {
    characterId: input.characterId,
    controlledByUserId: input.controlledByUserId,
    createdAt: "2026-04-21T00:00:00.000Z",
    factionId: input.factionId,
    id: input.id,
    isActive: input.isActive ?? true,
    joinSource: "gm_added",
    role: input.role,
    scenarioId: scenario.id,
    snapshot: {
      build: input.snapshotBuild,
      displayName: input.displayName,
      equipmentState: input.equipmentState
    },
    sourceType: input.sourceType ?? "character",
    state: {
      combat: {
        engaged: false
      },
      conditions: [],
      equipment: {},
      health: {
        bleeding: 0,
        currentHp: 8,
        dead: false,
        maxHp: 10,
        unconscious: false,
        wounds: 0
      },
      modifiers: [],
      resources: {},
      snapshotVersion: 1
    },
    updatedAt: "2026-04-21T00:00:00.000Z"
  };
}

describe("buildScenarioPlayerProjection", () => {
  it("resolves the active controlled player character and builds a visible participant list", () => {
    const build: CharacterBuild = {
      equipment: { items: [] },
      id: "character-1",
      name: "Ser Caldus",
      profile: {
        description: "Knight",
        distractionLevel: 2,
        id: "profile-1",
        label: "Profile",
        rolledStats: {
          cha: 10,
          com: 10,
          con: 10,
          dex: 10,
          health: 10,
          int: 10,
          lck: 10,
          pow: 10,
          siz: 10,
          str: 10,
          will: 10
        },
        societyLevel: 0
      },
      progression: {
        chargenMode: "standard",
        educationPoints: 0,
        level: 1,
        primaryPoolSpent: 0,
        primaryPoolTotal: 60,
        secondaryPoolSpent: 0,
        secondaryPoolTotal: 0,
        skillGroups: [],
        skills: [],
        specializations: []
      }
    };
    const projection = buildScenarioPlayerProjection({
      participants: [
        createParticipant({
          characterId: "character-1",
          controlledByUserId: "player-1",
          displayName: "Ser Caldus",
          equipmentState: {
            activeLoadoutByCharacterId: {},
            itemsById: {},
            locationsById: {},
            templates: { templatesById: {} }
          },
          factionId: "party",
          id: "participant-1",
          role: "player_character",
          snapshotBuild: build
        }),
        createParticipant({
          displayName: "Goblin Scout",
          factionId: "raiders",
          id: "participant-2",
          role: "monster",
          sourceType: "entity"
        }),
        createParticipant({
          displayName: "Hidden Reserve",
          id: "participant-3",
          isActive: false,
          role: "ally"
        })
      ],
      scenario,
      userId: "player-1"
    });

    expect(projection.hasControlledParticipant).toBe(true);
    expect(projection.controlledParticipantId).toBe("participant-1");
    expect(projection.controlledParticipant?.displayName).toBe("Ser Caldus");
    expect(projection.controlledParticipant?.characterId).toBe("character-1");
    expect(projection.controlledParticipant?.build?.name).toBe("Ser Caldus");
    expect(projection.controlledParticipant?.equipmentState).toMatchObject({
      activeLoadoutByCharacterId: {},
    });
    expect(projection.visibleParticipants).toHaveLength(2);
    expect(projection.visibleParticipants.map((participant) => participant.displayName)).toEqual([
      "Ser Caldus",
      "Goblin Scout"
    ]);
    expect(
      projection.visibleParticipants.find((participant) => participant.id === "participant-1")
        ?.isControlledByPlayer
    ).toBe(true);
  });

  it("returns a safe no-assignment projection when the user controls no active scenario participant", () => {
    const projection = buildScenarioPlayerProjection({
      participants: [
        createParticipant({
          controlledByUserId: "someone-else",
          displayName: "Ser Caldus",
          id: "participant-1",
          role: "player_character"
        })
      ],
      scenario,
      userId: "player-1"
    });

    expect(projection.hasControlledParticipant).toBe(false);
    expect(projection.controlledParticipant).toBeUndefined();
    expect(projection.visibleParticipants).toEqual([]);
    expect(projection.actionStub.canDeclareActions).toBe(false);
  });
});
