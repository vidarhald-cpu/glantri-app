import { describe, expect, it } from "vitest";

import {
  combatGenericActionSchema,
  projectCombatGenericActionsForPlayer,
} from "../encounter/combatGenericAction";
import { initializeCombatRoundState } from "../encounter/combatRoundManager";
import { encounterSessionSchema } from "../encounter/session";
import { scenarioParticipantSchema, scenarioSchema } from "./scenario";
import {
  buildPlayerSafeScenario,
  buildScenarioSessionView,
  projectScenarioObjectiveHistory,
} from "./scenarioSession";

const now = "2026-08-22T10:00:00.000Z";

function participant(
  id: string,
  userId: string,
  name: string,
  visibility?: "hidden" | "visible_to_all" | "gm_only",
) {
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
    visibilityOverrides: visibility ? { visibility } : undefined,
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

function itemHistoryFixture() {
  const scenario = scenarioSchema.parse({
    campaignId: "campaign-1",
    createdAt: now,
    id: "scenario-1",
    name: "Item history",
    status: "live",
    updatedAt: now,
  });
  const participants = [
    participant("participant-a", "user-a", "Player A"),
    participant("participant-b", "user-b", "Player B"),
  ];
  const action = combatGenericActionSchema.parse({
    createdAt: now,
    duration: { kind: "gm_decided" },
    id: "item-action",
    intent: "Drop the dagger.",
    itemInteraction: {
      itemId: "item-1",
      itemLabel: "Dagger",
      itemRevision: now,
      operation: "drop",
      stateAtDeclaration: "held",
      visibleToParticipantIds: ["encounter-participant-a", "encounter-participant-b"],
    },
    lastUpdatedAt: now,
    ownerParticipantId: "encounter-participant-b",
    preset: "item_interaction",
    progress: { completedRounds: 0 },
    resolution: {
      resolvedAt: now,
      text: "Player B dropped the dagger.",
      visibleToParticipantIds: ["encounter-participant-a", "encounter-participant-b"],
    },
    status: "completed",
  });
  const eventLogs = [
    {
      createdAt: now,
      eventType: "encounter_combat_outcome",
      id: "item-outcome",
      payload: {
        actionId: action.id,
        actorParticipantId: "participant-b",
        audienceParticipantIds: ["participant-a", "participant-b"],
        encounterId: "encounter-1",
        eventKind: "item_resolution",
      },
      scenarioId: scenario.id,
      sequence: 1,
      summary: action.resolution!.text,
    },
  ];
  const currentEncounter = encounterSessionSchema.parse({
    ...encounter("encounter-1", "participant-a", "Courtyard"),
    kind: "combat",
    participants: participants.map((entry) => ({
      id: `encounter-${entry.id}`,
      label: entry.snapshot.displayName,
      participantType: "scenario",
      scenarioParticipantId: entry.id,
    })),
    roleplayState: {
      visibility: {
        "encounter-participant-a": { "encounter-participant-b": true },
      },
    },
  });
  currentEncounter.combatRoundState = {
    ...initializeCombatRoundState({ encounter: currentEncounter }),
    genericActions: [action],
  };
  return { scenario, participants, action, eventLogs, currentEncounter };
}

describe("Scenario session privacy projection", () => {
  it("withholds an Item outcome when its owner becomes hidden in the Encounter visibility grid", () => {
    const { scenario, participants, action, eventLogs, currentEncounter } = itemHistoryFixture();
    for (const ownerVisible of [true, false, true]) {
      currentEncounter.roleplayState!.visibility["encounter-participant-a"]![
        "encounter-participant-b"
      ] = ownerVisible;
      const combatResult = projectCombatGenericActionsForPlayer({
        actions: [action],
        controlledParticipantIds: new Set(["encounter-participant-a"]),
        visibleParticipantIds: new Set([
          "encounter-participant-a",
          ...(ownerVisible ? ["encounter-participant-b"] : []),
        ]),
      });
      expect(combatResult).toHaveLength(ownerVisible ? 1 : 0);
      const session = buildScenarioSessionView({
        availableObjects: [],
        encounters: [currentEncounter],
        eventLogs,
        participants,
        scenario,
        userId: "user-a",
        viewerMode: "player",
      });
      expect(session.history).toHaveLength(combatResult.length);
    }
  });

  it("requires a currently permitted completed Item result and exact context mapping", () => {
    const original = itemHistoryFixture();
    const view = (
      current: ReturnType<typeof itemHistoryFixture>,
      viewerMode: "player" | "gm" = "player",
    ) =>
      buildScenarioSessionView({
        availableObjects: [],
        encounters: [current.currentEncounter],
        eventLogs: current.eventLogs,
        participants: current.participants,
        scenario: current.scenario,
        userId: "user-a",
        viewerMode,
      });
    expect(view(original).history).toHaveLength(1);
    const mutations: Array<(current: ReturnType<typeof itemHistoryFixture>) => void> = [
      (current) => {
        current.eventLogs[0]!.payload.audienceParticipantIds = [];
      },
      (current) => {
        current.eventLogs[0]!.payload.audienceParticipantIds = ["participant-b"];
      },
      (current) => {
        current.eventLogs[0]!.payload.actionId = "missing";
      },
      (current) => {
        current.eventLogs[0]!.payload.encounterId = "missing";
      },
      (current) => {
        current.eventLogs[0]!.payload.actorParticipantId = "missing";
      },
      (current) => {
        current.currentEncounter.participants[1]!.scenarioParticipantId = undefined;
      },
      (current) => {
        current.action.itemInteraction!.visibleToParticipantIds = [];
      },
      (current) => {
        current.action.resolution!.visibleToParticipantIds = [];
      },
      (current) => {
        current.action.status = "active";
      },
      (current) => {
        current.action.resolution = undefined;
      },
      (current) => {
        current.participants[1]!.visibilityOverrides = { visibility: "hidden" };
      },
      (current) => {
        current.participants[0]!.controlledByUserId = "someone-else";
      },
      (current) => {
        current.currentEncounter.combatRoundState = undefined;
      },
    ];
    for (const mutate of mutations) {
      const current = itemHistoryFixture();
      mutate(current);
      expect(view(current).history).toEqual([]);
      expect(view(current, "gm").history).toHaveLength(1);
    }
    expect(
      projectScenarioObjectiveHistory({
        controlledParticipantIds: new Set(["participant-a"]),
        eventLogs: original.eventLogs,
        viewerMode: "player",
      }),
    ).toEqual([]);
  });

  it("keeps owned and closed Item history, archived control rules, and other chronology unchanged", () => {
    const current = itemHistoryFixture();
    current.currentEncounter.roleplayState!.visibility = { "encounter-participant-a": {} };
    const view = (userId: string) =>
      buildScenarioSessionView({
        availableObjects: [],
        encounters: [current.currentEncounter],
        eventLogs: current.eventLogs,
        participants: current.participants,
        scenario: current.scenario,
        userId,
        viewerMode: "player",
      });
    expect(view("user-b").history).toHaveLength(1);
    current.currentEncounter.status = "completed";
    expect(view("user-b").history).toHaveLength(1);
    current.currentEncounter.status = "archived";
    expect(view("user-b").history).toHaveLength(1);
    for (const visible of [true, false, true]) {
      current.currentEncounter.roleplayState!.visibility = {
        "encounter-participant-a": { "encounter-participant-b": visible },
      };
      expect(view("user-a").history).toHaveLength(visible ? 1 : 0);
      expect(view("unrelated").history).toEqual([]);
      expect(current.currentEncounter.status).toBe("archived");
    }
    const otherEvents = ["encounter_closed", "encounter_paused", "encounter_resumed"].map(
      (eventType, index) => ({
        createdAt: now,
        eventType,
        id: eventType,
        scenarioId: current.scenario.id,
        sequence: 5 - index,
        summary: eventType,
      }),
    );
    const ordered = projectScenarioObjectiveHistory({
      controlledParticipantIds: new Set(["participant-b"]),
      eventLogs: [
        ...otherEvents,
        current.eventLogs[0]!,
        { ...current.eventLogs[0]!, eventType: "encounter_updated", id: "internal" },
      ],
      viewerMode: "gm",
    });
    expect(ordered.map((entry) => entry.id)).toEqual([
      "item-outcome",
      "encounter_resumed",
      "encounter_paused",
      "encounter_closed",
    ]);
    expect(JSON.stringify(ordered)).not.toMatch(
      /payload|audienceParticipantIds|actionId|visibility|item-1/,
    );
  });

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
        eventKind: "encounter_skill_outcome",
        id: "event-a",
        scenarioId: "scenario-1",
        sequence: 1,
        summary: "Player A found a clue.",
        type: "encounter_skill_outcome",
      },
    ]);
    expect(JSON.stringify(history)).not.toContain("privateCalculation");
  });

  it("omits hidden and GM-only participants and every typed event that identifies them", () => {
    const scenario = scenarioSchema.parse({
      campaignId: "campaign-1",
      createdAt: now,
      id: "scenario-1",
      name: "Lost Seal",
      status: "live",
      updatedAt: now,
    });
    const participants = [
      participant("participant-a", "user-a", "Player A", "visible_to_all"),
      participant("participant-hidden", "user-hidden", "Hidden Steward", "hidden"),
      participant("participant-gm", "user-gm-only", "Veiled Witness", "gm_only"),
    ];
    const eventLogs = [
      {
        createdAt: now,
        eventType: "participant_added",
        id: "hidden-added",
        participantId: "participant-hidden",
        scenarioId: "scenario-1",
        summary: "Added Hidden Steward to the scenario.",
      },
      {
        createdAt: now,
        eventType: "encounter_skill_outcome",
        id: "gm-only-skill",
        payload: { audienceParticipantIds: ["participant-a"] },
        scenarioId: "scenario-1",
        summary: "Veiled Witness used Investigation: success.",
      },
      {
        createdAt: now,
        eventType: "item_transferred",
        id: "hidden-payload",
        payload: {
          audienceParticipantIds: ["participant-a"],
          sourceParticipantId: "participant-hidden",
        },
        scenarioId: "scenario-1",
        summary: "An item changed hands.",
      },
      {
        createdAt: now,
        eventType: "encounter_closed",
        id: "public-close",
        payload: { audienceParticipantIds: ["participant-a"] },
        scenarioId: "scenario-1",
        summary: "The library investigation closed.",
      },
    ];

    const playerView = buildScenarioSessionView({
      availableObjects: [],
      encounters: [],
      eventLogs,
      participants,
      scenario,
      userId: "user-a",
      viewerMode: "player",
    });
    const gmView = buildScenarioSessionView({
      availableObjects: [],
      encounters: [],
      eventLogs,
      participants,
      scenario,
      userId: "the-gm",
      viewerMode: "gm",
    });

    expect(playerView.participants.map((entry) => entry.id)).toEqual(["participant-a"]);
    expect(playerView.history.map((entry) => entry.id)).toEqual(["public-close"]);
    expect(JSON.stringify(playerView)).not.toMatch(
      /participant-hidden|participant-gm|Hidden Steward|Veiled Witness/,
    );
    expect(gmView.participants.map((entry) => entry.id)).toEqual([
      "participant-a",
      "participant-hidden",
      "participant-gm",
    ]);
    expect(gmView.history.map((entry) => entry.id)).toEqual([
      "gm-only-skill",
      "hidden-added",
      "hidden-payload",
      "public-close",
    ]);
  });

  it("lets a controller see their own hidden participant without exposing it to other players", () => {
    const scenario = scenarioSchema.parse({
      campaignId: "campaign-1",
      createdAt: now,
      id: "scenario-1",
      name: "Lost Seal",
      status: "live",
      updatedAt: now,
    });
    const hidden = participant("participant-hidden", "user-hidden", "Hidden Steward", "gm_only");

    const view = buildScenarioSessionView({
      availableObjects: [],
      encounters: [],
      eventLogs: [],
      participants: [hidden],
      scenario,
      userId: "user-hidden",
      viewerMode: "player",
    });

    expect(view.participants).toEqual([
      expect.objectContaining({ id: "participant-hidden", isControlledByViewer: true }),
    ]);
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
    expect(safe.liveState).not.toHaveProperty("session");
    expect(serialized).not.toContain("appliedRequestIds");
    expect(serialized).not.toContain("availableObjects");
    expect(serialized).not.toContain("gmPrivateNotes");
    expect(serialized).not.toContain("version");
    expect(serialized).not.toContain("secret-request");
    expect(serialized).not.toContain("source-character");
    expect(serialized).not.toContain("gm-object");
    expect(serialized).not.toContain("Hidden culprit");
  });
});
