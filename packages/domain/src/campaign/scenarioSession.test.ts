import { describe, expect, it } from "vitest";

import { encounterSessionSchema } from "../encounter/session";
import { scenarioParticipantSchema, scenarioSchema } from "./scenario";
import {
  buildPlayerSafeScenario,
  buildScenarioSessionView,
  projectScenarioObjectiveHistory,
} from "./scenarioSession";

const now = "2026-08-22T10:00:00.000Z";

function participant(id: string, userId: string, name: string) {
  return scenarioParticipantSchema.parse({
    characterId: `character-${id}`,
    controlledByUserId: userId,
    createdAt: now,
    id,
    isActive: true,
    joinSource: "gm_added",
    role: "player_character",
    scenarioId: "scenario-1",
    snapshot: { displayName: name },
    sourceType: "character",
    state: {
      combat: {},
      equipment: {},
      health: {},
      resources: {},
    },
    updatedAt: now,
  });
}

function encounter(id: string, participantId: string, title: string) {
  return encounterSessionSchema.parse({
    createdAt: now,
    id,
    kind: "roleplay",
    participantMembershipMode: "explicit",
    participants: [
      {
        id: `encounter-${participantId}`,
        label: participantId,
        participantType: "scenario",
        scenarioParticipantId: participantId,
      },
    ],
    scenarioId: "scenario-1",
    status: "active",
    title,
    updatedAt: now,
  });
}

describe("Scenario session privacy projection", () => {
  it("shows disjoint active Encounters only to involved players and hides their occupants", () => {
    const scenario = scenarioSchema.parse({
      campaignId: "campaign-1",
      createdAt: now,
      description: "Find the Lost Seal.",
      id: "scenario-1",
      liveState: {
        session: { gmPrivateNotes: "The steward took it." },
      },
      name: "Lost Seal",
      status: "live",
      updatedAt: now,
    });
    const participants = [
      participant("participant-a", "user-a", "Player A"),
      participant("participant-b", "user-b", "Player B"),
    ];
    const encounters = [
      encounter("encounter-a", "participant-a", "Library"),
      encounter("encounter-b", "participant-b", "Courtyard"),
    ];

    const view = buildScenarioSessionView({
      availableObjects: [],
      encounters,
      eventLogs: [],
      participants,
      scenario,
      userId: "user-a",
      viewerMode: "player",
    });

    expect(view.encounters.map((entry) => entry.id)).toEqual(["encounter-a"]);
    expect(view.participants.map((entry) => entry.id)).toEqual(["participant-a"]);
    expect(view.participants[0]?.presence).toEqual({
      encounterId: "encounter-a",
      encounterName: "Library",
      kind: "encounter",
    });
    expect(JSON.stringify(view)).not.toContain("gmPrivateNotes");
    expect(JSON.stringify(view)).not.toContain("Courtyard");
    expect(JSON.stringify(view)).not.toContain("steward");
  });

  it("filters typed history by participant audience without returning raw payload", () => {
    const history = projectScenarioObjectiveHistory({
      controlledParticipantIds: new Set(["participant-a"]),
      eventLogs: [
        {
          createdAt: now,
          eventType: "encounter_skill_outcome",
          id: "event-a",
          payload: {
            audienceParticipantIds: ["participant-a"],
            privateCalculation: 99,
          },
          scenarioId: "scenario-1",
          summary: "Player A found a clue.",
        },
        {
          createdAt: now,
          eventType: "encounter_closed",
          id: "event-b",
          payload: { audienceParticipantIds: ["participant-b"] },
          scenarioId: "scenario-1",
          summary: "Player B learned a secret.",
        },
        {
          createdAt: now,
          eventType: "encounter_updated",
          id: "generic-event",
          payload: { hidden: true },
          scenarioId: "scenario-1",
          summary: "Internal update.",
        },
      ],
      viewerMode: "player",
    });

    expect(history).toEqual([
      {
        createdAt: now,
        id: "event-a",
        summary: "Player A found a clue.",
        type: "encounter_skill_outcome",
      },
    ]);
    expect(JSON.stringify(history)).not.toContain("privateCalculation");
  });

  it("removes GM notes, retry identities, hidden references, and holder snapshots", () => {
    const scenario = scenarioSchema.parse({
      campaignId: "campaign-1",
      createdAt: now,
      id: "scenario-1",
      liveState: {
        session: {
          appliedRequestIds: ["secret-request"],
          availableObjects: [
            {
              addedAt: now,
              expectedHolderCharacterId: "source-character",
              id: "visible-item",
              sourceId: "item-1",
              sourceKind: "campaign_item",
              visibility: "players",
            },
            {
              addedAt: now,
              id: "gm-object",
              sourceId: "asset-1",
              sourceKind: "campaign_asset",
              visibility: "gm_only",
            },
          ],
          gmPrivateNotes: "Hidden culprit",
        },
      },
      name: "Lost Seal",
      updatedAt: now,
    });

    const safe = buildPlayerSafeScenario(scenario);
    const serialized = JSON.stringify(safe);
    expect(safe.liveState?.session.availableObjects).toHaveLength(1);
    expect(serialized).not.toContain("secret-request");
    expect(serialized).not.toContain("source-character");
    expect(serialized).not.toContain("gm-object");
    expect(serialized).not.toContain("Hidden culprit");
  });
});
