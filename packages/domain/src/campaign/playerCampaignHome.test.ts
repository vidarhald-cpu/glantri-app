import { describe, expect, it } from "vitest";

import type { Campaign, Scenario, ScenarioParticipant } from "./scenario";
import type { EncounterSession } from "../encounter/session";
import {
  buildPlayerAccessibleCampaign,
  buildPlayerAccessibleScenario,
  buildPlayerCampaignHomeRecord,
} from "./playerCampaignHome";

const campaign: Campaign = {
  createdAt: "2026-08-13T09:00:00.000Z",
  description: "Defend the eastern marches.",
  gmUserId: "gm-1",
  id: "campaign-1",
  name: "Border Trouble",
  settings: {
    allowPlayerSelfJoin: false,
    defaultVisibility: "hidden",
  },
  slug: "border-trouble",
  status: "active",
  updatedAt: "2026-08-13T10:00:00.000Z",
};

function scenario(input: { id: string; name: string; status?: Scenario["status"] }): Scenario {
  return {
    campaignId: campaign.id,
    createdAt: "2026-08-13T09:00:00.000Z",
    description: `${input.name} briefing`,
    id: input.id,
    kind: "mixed",
    liveState: {
      combatStatus: "in_progress",
      phase: 2,
      roundNumber: 4,
      session: {
        appliedRequestIds: [],
        availableObjects: [],
        gmPrivateNotes: "",
        version: 1,
      },
    },
    mapAssetId: "private-map",
    name: input.name,
    status: input.status ?? "live",
    updatedAt: "2026-08-13T10:00:00.000Z",
  };
}

function participant(input: {
  characterId: string;
  controlledByUserId?: string;
  id: string;
  name: string;
  scenarioId: string;
}): ScenarioParticipant {
  return {
    characterId: input.characterId,
    controlledByUserId: input.controlledByUserId,
    createdAt: "2026-08-13T09:00:00.000Z",
    id: input.id,
    isActive: true,
    joinSource: "gm_added",
    role: "player_character",
    scenarioId: input.scenarioId,
    snapshot: { displayName: input.name },
    sourceType: "character",
    state: {
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
    updatedAt: "2026-08-13T10:00:00.000Z",
  };
}

function encounter(input: {
  id: string;
  kind: EncounterSession["kind"];
  participant: ScenarioParticipant;
  scenarioId: string;
  status: EncounterSession["status"];
  title: string;
}): EncounterSession {
  return {
    actionLog: [],
    createdAt: "2026-08-13T09:00:00.000Z",
    currentRound: 1,
    currentTurnIndex: 0,
    declarationsLocked: false,
    id: input.id,
    kind: input.kind,
    participantMembershipMode: "explicit",
    participants: [
      {
        characterId: input.participant.characterId,
        declaration: {
          actionType: "none",
          defenseFocus: "none",
          defensePosture: "none",
          targetLocation: "any",
        },
        facing: "north",
        id: `encounter-${input.participant.id}`,
        initiative: 0,
        label: input.participant.snapshot.displayName,
        order: 0,
        orientation: "neutral",
        participantType: "character",
        position: { x: 0, y: 0, zone: "center" },
        scenarioParticipantId: input.participant.id,
      },
    ],
    scenarioId: input.scenarioId,
    status: input.status,
    title: input.title,
    turnOrderMode: "manual",
    updatedAt: "2026-08-13T10:00:00.000Z",
  };
}

describe("player Campaign Home projection", () => {
  it("projects only player-safe campaign and Scenario fields", () => {
    expect(buildPlayerAccessibleCampaign(campaign)).toEqual({
      description: campaign.description,
      id: campaign.id,
      name: campaign.name,
    });
    expect(
      buildPlayerAccessibleScenario(scenario({ id: "scenario-1", name: "The Bridge" })),
    ).toEqual({
      campaignId: campaign.id,
      description: "The Bridge briefing",
      id: "scenario-1",
      name: "The Bridge",
    });
  });

  it("chooses the active assigned combat Encounter and names every controlled Character", () => {
    const bridge = scenario({ id: "scenario-1", name: "The Bridge" });
    const ari = participant({
      characterId: "character-1",
      controlledByUserId: "player-1",
      id: "participant-1",
      name: "Ari",
      scenarioId: bridge.id,
    });
    const bela = participant({
      characterId: "character-2",
      controlledByUserId: "player-1",
      id: "participant-2",
      name: "Bela",
      scenarioId: bridge.id,
    });
    const controlledElsewhere = participant({
      characterId: "character-3",
      controlledByUserId: "player-2",
      id: "participant-3",
      name: "Cora",
      scenarioId: bridge.id,
    });
    const projection = buildPlayerCampaignHomeRecord({
      campaign,
      rosterCharacters: [
        { id: "character-2", name: "Bela" },
        { id: "character-1", name: "Ari" },
        { id: "character-3", name: "Cora" },
      ],
      scenarios: [
        {
          encounters: [
            encounter({
              id: "encounter-setup",
              kind: "roleplay",
              participant: ari,
              scenarioId: bridge.id,
              status: "draft",
              title: "Secret preparation",
            }),
            encounter({
              id: "encounter-complete",
              kind: "roleplay",
              participant: ari,
              scenarioId: bridge.id,
              status: "completed",
              title: "Old audience",
            }),
            encounter({
              id: "encounter-1",
              kind: "combat",
              participant: ari,
              scenarioId: bridge.id,
              status: "active",
              title: "Hold the gate",
            }),
          ],
          participants: [ari, bela, controlledElsewhere],
          scenario: bridge,
        },
        {
          encounters: [],
          participants: [],
          scenario: scenario({ id: "scenario-draft", name: "Secret", status: "draft" }),
        },
      ],
      userId: "player-1",
    });

    expect(projection.characters.map((character) => character.name)).toEqual(["Ari", "Bela"]);
    expect(projection.scenarios).toEqual([
      expect.objectContaining({
        characters: [
          { id: "character-1", name: "Ari" },
          { id: "character-2", name: "Bela" },
        ],
        encounter: {
          id: "encounter-1",
          status: "active",
          title: "Hold the gate",
        },
      }),
    ]);
    expect(projection.scenarios[0]?.characters).not.toContainEqual({
      id: "character-3",
      name: "Cora",
    });
    expect(projection.resume).toEqual({
      encounterId: "encounter-1",
      scenarioId: "scenario-1",
      tab: "player-combat",
    });
    expect(JSON.stringify(projection)).not.toContain("private-map");
    expect(JSON.stringify(projection)).not.toContain("gm-1");
    expect(JSON.stringify(projection)).not.toContain("Old audience");
    expect(JSON.stringify(projection)).not.toContain("Secret preparation");
    expect(JSON.stringify(projection)).not.toContain("Secret");
  });

  it("keeps a roster Campaign useful when there is no live Scenario", () => {
    const projection = buildPlayerCampaignHomeRecord({
      campaign,
      rosterCharacters: [{ id: "character-1", name: "Ari" }],
      scenarios: [],
      userId: "player-1",
    });

    expect(projection.scenarios).toEqual([]);
    expect(projection.resume).toEqual({ tab: "campaign" });
  });

  it("keeps Campaign access but hides a live Scenario delegated to another controller", () => {
    const privateScenario = scenario({ id: "scenario-private", name: "Private Council" });
    const delegated = participant({
      characterId: "character-1",
      controlledByUserId: "player-2",
      id: "participant-delegated",
      name: "Ari",
      scenarioId: privateScenario.id,
    });
    const projection = buildPlayerCampaignHomeRecord({
      campaign,
      rosterCharacters: [{ id: "character-1", name: "Ari" }],
      scenarios: [
        {
          encounters: [],
          participants: [delegated],
          scenario: {
            ...privateScenario,
            description: "Private to the delegated controller.",
          },
        },
      ],
      userId: "player-1",
    });

    expect(projection).toEqual({
      campaign: {
        description: "Defend the eastern marches.",
        id: "campaign-1",
        name: "Border Trouble",
      },
      characters: [],
      resume: { tab: "campaign" },
      scenarios: [],
    });
    expect(JSON.stringify(projection)).not.toContain("Private Council");
    expect(JSON.stringify(projection)).not.toContain("Private to the delegated controller");
    expect(JSON.stringify(projection)).not.toContain("scenario-private");
  });
});
