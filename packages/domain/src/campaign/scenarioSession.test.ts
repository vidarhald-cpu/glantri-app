import { describe, expect, it } from "vitest";

import {
  activateCombatGenericAction,
  combatGenericActionSchema,
  declareCombatGenericAction,
  finishCombatGenericAction,
  projectCombatGenericActionsForPlayer,
  reviewCombatGenericAction,
} from "../encounter/combatGenericAction";
import { initializeCombatRoundState } from "../encounter/combatRoundManager";
import { encounterSessionSchema } from "../encounter/session";
import { scenarioParticipantSchema, scenarioSchema } from "./scenario";
import {
  buildPlayerSafeScenario,
  buildScenarioSessionView,
  isGmOperationalScenarioHistoryEventType,
  projectScenarioObjectiveHistory,
  scenarioObjectiveHistoryEventTypeSchema,
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
  // M7 — Forgejo issue #323. A `small_action` declaration that names an Item materializes a
  // canonical Combat action carrying `preset: "item_interaction"`. This drives that action through
  // the real lifecycle helpers, with exactly the field set the declaration path supplies, rather
  // than hand-building a completed action: `canViewCurrentItemOutcome` gates player visibility of
  // the `item_resolution` outcome on that preset, so an action materialized without it would make
  // the outcome invisible to every player.
  it("keeps a declaration-materialized Item outcome player-visible through canViewCurrentItemOutcome", () => {
    const declarationTaskId =
      "round:1:participant:encounter-participant-b:declaration:small_action";
    let actions = declareCombatGenericAction({
      action: {
        createdAt: now,
        createdByUserId: "user-b",
        declarationKind: "small_action",
        duration: { kind: "gm_decided" },
        id: declarationTaskId,
        intent: "Drop the dagger.",
        itemInteraction: {
          itemId: "item-1",
          itemLabel: "Dagger",
          itemRevision: now,
          operation: "drop",
          stateAtDeclaration: "held",
          visibleToParticipantIds: ["encounter-participant-a", "encounter-participant-b"],
        },
        ownerParticipantId: "encounter-participant-b",
        preset: "item_interaction",
        reference: {
          itemId: "item-1",
          kind: "item",
          label: "Dagger",
          ownerParticipantId: "encounter-participant-b",
        },
      },
      actions: [],
    });
    actions = reviewCombatGenericAction({
      actionId: declarationTaskId,
      actions,
      duration: { kind: "gm_decided" },
      reference: actions[0]!.reference,
      reviewedAt: now,
    });
    actions = activateCombatGenericAction({
      actionId: declarationTaskId,
      activatedAt: now,
      actions,
      roundNumber: 1,
      step: "phase_1_actions",
    });
    actions = finishCombatGenericAction({
      actionId: declarationTaskId,
      actions,
      at: now,
      resolution: {
        resolvedAt: now,
        text: "Player B dropped the dagger.",
        visibleToParticipantIds: ["encounter-participant-a", "encounter-participant-b"],
      },
      roundNumber: 1,
      status: "completed",
      step: "phase_1_actions",
    });
    const materialized = actions[0]!;
    expect(materialized.preset).toBe("item_interaction");
    expect(materialized.declarationKind).toBe("small_action");

    const fixture = itemHistoryFixture();
    fixture.currentEncounter.combatRoundState!.genericActions = [materialized];
    fixture.eventLogs[0]!.payload.actionId = materialized.id;

    const view = (encounters: (typeof fixture.currentEncounter)[]) =>
      buildScenarioSessionView({
        availableObjects: [],
        encounters,
        eventLogs: fixture.eventLogs,
        participants: fixture.participants,
        scenario: fixture.scenario,
        userId: "user-a",
        viewerMode: "player",
      });
    expect(view([fixture.currentEncounter]).history).toHaveLength(1);

    // The same action without the preset — the pre-M7 `small_action` shape — is invisible.
    const withoutPreset = {
      ...fixture.currentEncounter,
      combatRoundState: {
        ...fixture.currentEncounter.combatRoundState!,
        genericActions: [{ ...materialized, itemInteraction: undefined, preset: undefined }],
      },
    };
    expect(view([withoutPreset]).history).toHaveLength(0);
  });

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

/**
 * Forgejo #788 — the GM operational boundary over Activity/history.
 *
 * The load-bearing proof for this issue is an HTTP-level integration test
 * (`apps/api/src/routes/scenarios/scenarioActivityAudience.integration.test.ts`)
 * that asserts on raw player-identity response bodies. That file is skipped
 * unless `GLANTRI_DB_MODE=task`, which CI does not set, so these unit-level
 * assertions exist to keep the boundary under the CI `test` gate.
 */
describe("GM operational events are not player history (#788)", () => {
  const membershipAndMaintenanceLogs = [
    {
      createdAt: now,
      eventType: "participant_added",
      id: "added",
      participantId: "participant-npc",
      payload: { role: "npc", sourceType: "entity" },
      scenarioId: "scenario-1",
      summary: "Added Watchman Dorn to the scenario.",
    },
    {
      createdAt: now,
      eventType: "participant_activated",
      id: "activated",
      participantId: "participant-npc",
      scenarioId: "scenario-1",
      summary: "Activated Watchman Dorn in the Scenario.",
    },
    {
      createdAt: now,
      eventType: "participant_deactivated",
      id: "deactivated",
      participantId: "participant-npc",
      scenarioId: "scenario-1",
      summary: "Deactivated Watchman Dorn in the Scenario.",
    },
    {
      createdAt: now,
      eventType: "encounter_participants_updated",
      id: "encounter-membership",
      payload: { encounterId: "encounter-a" },
      scenarioId: "scenario-1",
      summary: "Updated encounter Gatehouse participants.",
    },
    {
      createdAt: now,
      eventType: "equipment_reconciled",
      id: "reconciled",
      participantId: "participant-a",
      payload: { fingerprint: "abc" },
      scenarioId: "scenario-1",
      summary: "Ari\u2019s equipment was reconciled for Scenario play.",
    },
    // The positive navigation case: an objective Encounter fact that is
    // legitimately player history and must survive the boundary.
    {
      createdAt: now,
      eventType: "encounter_started",
      id: "started",
      payload: { encounterId: "encounter-a" },
      scenarioId: "scenario-1",
      summary: "Started encounter Gatehouse.",
    },
  ];

  it("withholds membership and maintenance events from a player and keeps the GM audit complete", () => {
    const playerHistory = projectScenarioObjectiveHistory({
      controlledParticipantIds: new Set(["participant-a"]),
      eventLogs: membershipAndMaintenanceLogs,
      viewerMode: "player",
    });
    const gmHistory = projectScenarioObjectiveHistory({
      controlledParticipantIds: new Set(),
      eventLogs: membershipAndMaintenanceLogs,
      viewerMode: "gm",
    });

    // Requirements 1 and 3, with no reliance on participant visibility
    // settings: none of these rows names an excluded participant, and the
    // suppression still applies.
    expect(playerHistory.map((event) => event.type)).toEqual(["encounter_started"]);
    expect(JSON.stringify(playerHistory)).not.toContain("Watchman Dorn");
    expect(JSON.stringify(playerHistory)).not.toContain("equipment was reconciled");
    expect(JSON.stringify(playerHistory)).not.toContain("Gatehouse participants");

    // Requirement 4: audience and presentation only. Every row still reaches
    // the GM, with its stored summary and its original ordering.
    // These fixture rows carry no `sequence` and share a `createdAt`, so the
    // projection's documented tiebreak sorts them by id; the assertion is on
    // the id set and on each row's stored summary, not on a fabricated order.
    expect([...gmHistory.map((event) => event.id)].sort()).toEqual(
      [...membershipAndMaintenanceLogs.map((event) => event.id)].sort(),
    );
    expect(Object.fromEntries(gmHistory.map((event) => [event.id, event.summary]))).toEqual(
      Object.fromEntries(membershipAndMaintenanceLogs.map((event) => [event.id, event.summary])),
    );

    // Requirement 5: no replacement prose is authored for the suppressed rows.
    expect(JSON.stringify(playerHistory)).not.toContain("enters");
    expect(JSON.stringify(playerHistory)).not.toContain("joins");
    expect(JSON.stringify(playerHistory)).not.toContain("leaves");
  });

  it("suppresses a membership row for a player who controls the participant it names", () => {
    // Over-restriction is a defect, but requirement 1 is unqualified: a
    // membership change is GM operational state even when it is the viewer's
    // own Character being added. Asserted so the boundary is not quietly
    // narrowed to "other people's participants" later.
    const history = projectScenarioObjectiveHistory({
      controlledParticipantIds: new Set(["participant-a"]),
      eventLogs: [
        {
          createdAt: now,
          eventType: "participant_added",
          id: "own-added",
          participantId: "participant-a",
          payload: { audienceParticipantIds: ["participant-a"] },
          scenarioId: "scenario-1",
          summary: "Added Ari to the scenario.",
        },
      ],
      viewerMode: "player",
    });

    expect(history).toEqual([]);
  });

  it("classifies exactly the membership and maintenance event types as GM operational", () => {
    // A new objective-history event type must be classified deliberately. This
    // pins the membership set so adding a type cannot silently widen or narrow
    // the player boundary.
    const operational = scenarioObjectiveHistoryEventTypeSchema.options.filter((type) =>
      isGmOperationalScenarioHistoryEventType(type),
    );

    expect([...operational].sort()).toEqual([
      "encounter_participants_updated",
      "equipment_reconciled",
      "participant_activated",
      "participant_added",
      "participant_deactivated",
    ]);
  });
});
