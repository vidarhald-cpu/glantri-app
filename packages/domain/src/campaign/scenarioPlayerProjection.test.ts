import { describe, expect, it } from "vitest";

import type { CharacterBuild } from "../character/build";
import { attachCanonicalLifecycleToModifierBucketRow } from "../encounter/combatModifierLifecycleCompatibility";
import type { Scenario, ScenarioParticipant } from "./scenario";
import { buildScenarioPlayerProjection, calculateCharacterGeneralHitpoints } from "./scenario";

const scenario: Scenario = {
  campaignId: "campaign-1",
  createdAt: "2026-04-21T00:00:00.000Z",
  description: "A live scenario shell.",
  id: "scenario-1",
  kind: "mixed",
  liveState: {
    combatStatus: "not_started",
    phase: 1,
    roundNumber: 1,
    session: {
      appliedRequestIds: [],
      availableObjects: [],
      gmPrivateNotes: "",
      version: 1,
    },
  },
  name: "Night at the Keep",
  status: "prepared",
  updatedAt: "2026-04-21T00:00:00.000Z",
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
  state?: ScenarioParticipant["state"];
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
      equipmentState: input.equipmentState,
    },
    sourceType: input.sourceType ?? "character",
    state: input.state ?? {
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
      equipment: {},
      health: {
        bleeding: 0,
        currentHp: 8,
        dead: false,
        maxHp: 10,
        unconscious: false,
        wounds: 0,
      },
      modifiers: [],
      resources: {},
      snapshotVersion: 1,
    },
    updatedAt: "2026-04-21T00:00:00.000Z",
  };
}

describe("buildScenarioPlayerProjection", () => {
  it("uses calculated CON/SIZ general hitpoints instead of the raw Health roll", () => {
    const build = {
      profile: {
        rolledStats: {
          con: 18,
          health: 7,
          siz: 16,
        },
      },
    } as unknown as CharacterBuild;

    expect(calculateCharacterGeneralHitpoints(build)).toBe(17);
  });

  it("uses the Character snapshot's Current CON/SIZ values for general hitpoints", () => {
    const build = {
      currentStatModifiers: { con: 2, siz: 2 },
      profile: {
        rolledStats: {
          con: 10,
          siz: 10,
        },
      },
    } as unknown as CharacterBuild;

    expect(calculateCharacterGeneralHitpoints(build)).toBe(12);
  });

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
          will: 10,
        },
        societyLevel: 0,
      },
      progression: {
        chargenMode: "standard",
        educationPoints: 0,
        flexiblePointFactor: 1,
        level: 1,
        primaryPoolSpent: 0,
        primaryPoolTotal: 60,
        secondaryPoolSpent: 0,
        secondaryPoolTotal: 0,
        skillGroups: [],
        skills: [],
        specializations: [],
      },
      progressionState: {
        availablePoints: 0,
        checks: [],
        history: [],
        pendingAttempts: [],
      },
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
            templates: { templatesById: {} },
          },
          factionId: "party",
          id: "participant-1",
          role: "player_character",
          snapshotBuild: build,
        }),
        createParticipant({
          displayName: "Goblin Scout",
          factionId: "raiders",
          id: "participant-2",
          role: "monster",
          sourceType: "entity",
        }),
        createParticipant({
          displayName: "Hidden Reserve",
          id: "participant-3",
          isActive: false,
          role: "ally",
        }),
      ],
      scenario,
      userId: "player-1",
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
      "Goblin Scout",
    ]);
    expect(
      projection.visibleParticipants.find((participant) => participant.id === "participant-1")
        ?.isControlledByPlayer,
    ).toBe(true);
  });

  it("preserves controlled participant combat modifier buckets in the player-safe projection", () => {
    const canonicalDbRow = attachCanonicalLifecycleToModifierBucketRow({
      bucket: "situation_db",
      context: {
        createdAt: "2026-04-21T00:00:00.000Z",
        createdRevision: "revision-1",
        createdSequence: 1,
        explicitDuration: {
          kind: "manual",
          removableBy: "gm",
          startRound: 1,
          startSequence: 1,
        },
        explicitUnit: "percentage",
      },
      entry: { id: "db-1", scope: "until", value: 2 },
      ownerParticipantId: "participant-1",
    });
    const projection = buildScenarioPlayerProjection({
      participants: [
        createParticipant({
          controlledByUserId: "player-1",
          displayName: "Ser Caldus",
          id: "participant-1",
          role: "player_character",
          state: {
            combat: {
              combatContext: {
                modifierBuckets: {
                  general: [],
                  situationDb: [canonicalDbRow],
                  situationInitiative: [
                    {
                      durationRounds: 2,
                      id: "initiative-1",
                      notes: "Ready",
                      scope: "until",
                      value: 3,
                    },
                  ],
                  situationObSkill: [{ id: "ob-1", scope: "until", value: -1 }],
                },
              },
              engaged: false,
            },
            conditions: [],
            equipment: {},
            health: {
              bleeding: 0,
              currentHp: 8,
              dead: false,
              maxHp: 10,
              unconscious: false,
              wounds: 0,
            },
            modifiers: [],
            resources: {},
            snapshotVersion: 1,
          } as ScenarioParticipant["state"],
        }),
      ],
      scenario,
      userId: "player-1",
    });

    expect(projection.controlledParticipant?.combatContext?.modifierBuckets).toMatchObject({
      situationDb: [{ id: "db-1", value: 2 }],
      situationInitiative: [{ id: "initiative-1", durationRounds: 2, value: 3 }],
      situationObSkill: [{ id: "ob-1", value: -1 }],
    });
    expect(
      projection.controlledParticipant?.combatContext?.modifierBuckets.situationDb[0],
    ).not.toHaveProperty("canonicalLifecycle");
  });

  it("returns a safe no-assignment projection when the user controls no active scenario participant", () => {
    const projection = buildScenarioPlayerProjection({
      participants: [
        createParticipant({
          controlledByUserId: "someone-else",
          displayName: "Ser Caldus",
          id: "participant-1",
          role: "player_character",
        }),
      ],
      scenario,
      userId: "player-1",
    });

    expect(projection.hasControlledParticipant).toBe(false);
    expect(projection.controlledParticipant).toBeUndefined();
    expect(projection.visibleParticipants).toEqual([]);
    expect(projection.actionStub.canDeclareActions).toBe(false);
  });
});
