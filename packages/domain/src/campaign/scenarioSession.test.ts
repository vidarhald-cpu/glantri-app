import { describe, expect, it } from "vitest";

import {
  activateCombatGenericAction,
  combatGenericActionSchema,
  declareCombatGenericAction,
  finishCombatGenericAction,
  projectCombatGenericActionsForPlayer,
  reviewCombatGenericAction,
} from "../encounter/combatGenericAction";
import {
  completedCombatRoundSchema,
  initializeCombatRoundState,
} from "../encounter/combatRoundManager";
import { encounterSessionSchema } from "../encounter/session";
import { scenarioParticipantSchema, scenarioSchema } from "./scenario";
import {
  buildPlayerSafeScenario,
  buildScenarioSessionView,
  isGmOperationalScenarioHistoryEventType,
  projectScenarioObjectiveHistory,
  type ScenarioObjectiveHistoryEventType,
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
    // Named, so a failure says which condition stopped denying rather than only that one did.
    // Every entry here is a property of the **record** or of the **viewer**, never of the
    // Encounter roster as it stands now: #930 removed the roster from this decision, and a case
    // that denied only because a combatant had left belongs in the restored-actor cases below.
    const mutations: Array<[string, (current: ReturnType<typeof itemHistoryFixture>) => void]> = [
      [
        "the row records no audience",
        (current) => {
          current.eventLogs[0]!.payload.audienceParticipantIds = [];
        },
      ],
      [
        "the viewer is not in the recorded audience",
        (current) => {
          current.eventLogs[0]!.payload.audienceParticipantIds = ["participant-b"];
        },
      ],
      [
        "the row names no action that exists",
        (current) => {
          current.eventLogs[0]!.payload.actionId = "missing";
        },
      ],
      [
        "the row names no Encounter that exists",
        (current) => {
          current.eventLogs[0]!.payload.encounterId = "missing";
        },
      ],
      [
        "the row names an actor the Scenario does not have",
        (current) => {
          current.eventLogs[0]!.payload.actorParticipantId = "missing";
        },
      ],
      [
        "the action recorded no Item audience",
        (current) => {
          current.action.itemInteraction!.visibleToParticipantIds = [];
        },
      ],
      [
        "the action recorded no result audience",
        (current) => {
          current.action.resolution!.visibleToParticipantIds = [];
        },
      ],
      [
        "the action never completed",
        (current) => {
          current.action.status = "active";
        },
      ],
      [
        "the action carries no result",
        (current) => {
          current.action.resolution = undefined;
        },
      ],
      [
        "the actor is suppressed by the fail-closed participant belt",
        (current) => {
          current.participants[1]!.visibilityOverrides = { visibility: "hidden" };
        },
      ],
      [
        "the viewer controls nobody in the audience",
        (current) => {
          current.participants[0]!.controlledByUserId = "someone-else";
        },
      ],
      [
        "the Encounter carries no combat round state",
        (current) => {
          current.currentEncounter.combatRoundState = undefined;
        },
      ],
    ];
    for (const [name, mutate] of mutations) {
      const current = itemHistoryFixture();
      mutate(current);
      expect(view(current).history, name).toEqual([]);
      expect(view(current, "gm").history, name).toHaveLength(1);
    }
    expect(
      projectScenarioObjectiveHistory({
        controlledParticipantIds: new Set(["participant-a"]),
        eventLogs: original.eventLogs,
        viewerMode: "player",
      }),
    ).toEqual([]);
  });

  /**
   * Forgejo #930. Whether a resolved Item outcome can be read must not be decided by who is on the
   * Encounter roster now. Each case holds the viewer — user A, in the row's recorded audience,
   * controlling participant A, with an unchanged visibility row — completely fixed, and changes
   * only something about the actor's presence. The driven before/after pair for the same breach is
   * in `apps/api/src/routes/scenarios/scenarioPastItemOutcomeViewability.integration.test.ts`.
   */
  describe("a resolved Item outcome is read against the record, not the present roster (#930)", () => {
    const view = (current: ReturnType<typeof itemHistoryFixture>, userId = "user-a") =>
      buildScenarioSessionView({
        availableObjects: [],
        encounters: [current.currentEncounter],
        eventLogs: current.eventLogs,
        participants: current.participants,
        scenario: current.scenario,
        userId,
        viewerMode: "player",
      });

    /** The actor leaves the Encounter roster; nothing about the viewer changes. */
    function removeActorFromRoster(current: ReturnType<typeof itemHistoryFixture>): void {
      current.currentEncounter.participants = current.currentEncounter.participants.filter(
        (participant) => participant.id !== "encounter-participant-b",
      );
    }

    /** The round the action was resolved in is archived and a new one is in force. */
    function archiveTheActionsRound(current: ReturnType<typeof itemHistoryFixture>): void {
      const state = current.currentEncounter.combatRoundState!;
      current.currentEncounter.combatRoundState = {
        ...state,
        genericActions: [],
        roundNumber: 2,
        rounds: [
          completedCombatRoundSchema.parse({
            genericActions: [current.action],
            participants: state.participants,
            roundNumber: 1,
          }),
        ],
      };
    }

    it("stays readable to an unchanged viewer when the actor leaves the roster", () => {
      const current = itemHistoryFixture();
      const before = view(current).history.map((entry) => entry.id);
      removeActorFromRoster(current);
      const after = view(current).history.map((entry) => entry.id);

      expect({ after, before }).toEqual({ after: ["item-outcome"], before: ["item-outcome"] });
    });

    it("stays readable when the action's own round has been archived and the actor has left", () => {
      const current = itemHistoryFixture();
      archiveTheActionsRound(current);
      const before = view(current).history.map((entry) => entry.id);
      removeActorFromRoster(current);
      // The archived round's `participants` entry is stripped of a departed combatant on every
      // read (#925), so the actor's identity is taken from the stored action and the stored row
      // rather than from that entry.
      current.currentEncounter.combatRoundState!.rounds[0]!.participants = [];
      const after = view(current).history.map((entry) => entry.id);

      expect({ after, before }).toEqual({ after: ["item-outcome"], before: ["item-outcome"] });
    });

    it("stays readable when the actor's roster row loses its Scenario mapping", () => {
      const current = itemHistoryFixture();
      // Previously this denied, for the same reason the removal did: the decision was taken by
      // re-resolving the actor through the roster. The row records who acted, so a roster row
      // that no longer carries the mapping cannot make a past outcome unreadable.
      current.currentEncounter.participants[1]!.scenarioParticipantId = undefined;

      expect(view(current).history.map((entry) => entry.id)).toEqual(["item-outcome"]);
    });

    it("never decides how an Encounter with no named roster chooses its participants", () => {
      const current = itemHistoryFixture();
      // A roster naming nobody is resolved from the Scenario instead. Restoring the recorded actor
      // into it would turn it into a one-combatant explicit roster and withhold the outcome from
      // the viewer, which is the failure this guard exists to prevent — so the case is exercised
      // with an action whose owner the Scenario fallback can resolve.
      current.action.ownerParticipantId = "participant-b";
      current.action.itemInteraction!.visibleToParticipantIds = ["participant-a", "participant-b"];
      current.action.resolution!.visibleToParticipantIds = ["participant-a", "participant-b"];
      current.currentEncounter.combatRoundState!.genericActions = [current.action];
      current.currentEncounter.participantMembershipMode = "defaultAllActive";
      current.currentEncounter.participants = [];
      current.currentEncounter.roleplayState = {
        ...current.currentEncounter.roleplayState!,
        visibility: {},
      };

      expect(view(current).history.map((entry) => entry.id)).toEqual(["item-outcome"]);
    });

    it("keeps withholding the outcome from a viewer the GM has hidden the actor from", () => {
      const current = itemHistoryFixture();
      current.currentEncounter.roleplayState!.visibility["encounter-participant-a"]![
        "encounter-participant-b"
      ] = false;
      const before = view(current).history;
      removeActorFromRoster(current);
      const after = view(current).history;

      // The live per-viewer store is the entitlement decision and keeps denying after the
      // removal. Repairing the identity half must not collapse it, and the Scenario-level
      // suppression this row would otherwise fall under does not apply to a participant who
      // belongs to no Encounter.
      expect({ after, before }).toEqual({ after: [], before: [] });
    });

    it("discloses nothing to a viewer outside the recorded audience when the actor leaves", () => {
      const current = itemHistoryFixture();
      current.participants.push(participant("participant-c", "user-c", "Player C"));
      current.currentEncounter.participants.push({
        declaration: {
          actionType: "none",
          defenseFocus: "none",
          defensePosture: "none",
          targetLocation: "any",
        },
        facing: "north",
        id: "encounter-participant-c",
        initiative: 0,
        label: "Player C",
        order: 2,
        orientation: "neutral",
        participantType: "scenario",
        position: { x: 0, y: 0, zone: "center" },
        scenarioParticipantId: "participant-c",
      });
      current.currentEncounter.roleplayState!.visibility["encounter-participant-c"] = {
        "encounter-participant-a": true,
        "encounter-participant-b": true,
      };

      const before = view(current, "user-c").history;
      removeActorFromRoster(current);
      const after = view(current, "user-c").history;

      expect({ after, before }).toEqual({ after: [], before: [] });
    });

    /**
     * Forgejo #930 repair cycle 1. Taking the actor's identity from the record is only half of the
     * separation. The question `projectCombatGenericActionsForPlayer` then asks is whether
     * `action.ownerParticipantId` is in the viewer's controlled and visible id sets, and those sets
     * are the *aliases* of live roster rows. `encounterParticipantSchema` imposes no uniqueness or
     * actor-consistency condition and the roster route writes `participants` wholesale, so a row
     * that is not the actor's can hold that id and answer for the actor out of its own live state.
     *
     * Each case removes the actor, leaves the viewer's own participation, control and visibility
     * row untouched, and gives the recorded id to somebody else. The GM's hide of the actor is
     * never lifted in any of them. The driven route-level pair is in
     * `apps/api/src/routes/scenarios/scenarioPastItemOutcomeViewability.integration.test.ts`.
     */
    describe("a row that is not the actor's never answers for the actor's recorded id", () => {
      /** A roster row in the shape the fixture's own rows take. */
      function rosterRow(input: { id: string; label: string; scenarioParticipantId: string }) {
        return {
          declaration: {
            actionType: "none" as const,
            defenseFocus: "none" as const,
            defensePosture: "none" as const,
            targetLocation: "any" as const,
          },
          facing: "north" as const,
          id: input.id,
          initiative: 0,
          label: input.label,
          order: 2,
          orientation: "neutral" as const,
          participantType: "scenario" as const,
          position: { x: 0, y: 0, zone: "center" as const },
          scenarioParticipantId: input.scenarioParticipantId,
        };
      }

      /** The GM hides the actor from the viewer, and that is never undone. */
      function hideTheActorFromTheViewer(current: ReturnType<typeof itemHistoryFixture>): void {
        current.currentEncounter.roleplayState!.visibility["encounter-participant-a"]![
          "encounter-participant-b"
        ] = false;
      }

      it("refuses when a different participant's row takes over the actor's recorded id", () => {
        const current = itemHistoryFixture();
        current.participants.push(participant("participant-c", "user-c", "Player C"));
        hideTheActorFromTheViewer(current);
        const before = view(current).history.map((entry) => entry.id);

        // The actor leaves and Player C's row takes the id over. The GM then shows Player C to
        // the viewer, which is the ordinary thing to do for a new combatant — and that entry is
        // now keyed on the id the record uses for the actor.
        removeActorFromRoster(current);
        current.currentEncounter.participants.push(
          rosterRow({
            id: "encounter-participant-b",
            label: "Player C",
            scenarioParticipantId: "participant-c",
          }),
        );
        current.currentEncounter.roleplayState!.visibility["encounter-participant-a"]![
          "encounter-participant-b"
        ] = true;
        const after = view(current).history.map((entry) => entry.id);

        expect({ after, before }).toEqual({ after: [], before: [] });
        // The GM audit record is whole throughout.
        expect(view(current, "user-a").history).toEqual([]);
      });

      it("refuses when another row's Scenario mapping is re-pointed at the actor's recorded id", () => {
        const current = itemHistoryFixture();
        hideTheActorFromTheViewer(current);
        const before = view(current).history.map((entry) => entry.id);

        // The second reaching condition: the occupant keeps its own row id and the row's
        // `scenarioParticipantId` is re-pointed at the actor's recorded Encounter-participant id,
        // so it answers for the actor while describing nobody the Scenario has.
        removeActorFromRoster(current);
        current.currentEncounter.participants.push(
          rosterRow({
            id: "encounter-participant-shadow",
            label: "Shadow",
            scenarioParticipantId: "encounter-participant-b",
          }),
        );
        current.currentEncounter.roleplayState!.visibility["encounter-participant-a"]![
          "encounter-participant-shadow"
        ] = true;
        const after = view(current).history.map((entry) => entry.id);

        expect({ after, before }).toEqual({ after: [], before: [] });
      });

      it("refuses while the actor is still present and hidden and a re-pointed row answers", () => {
        const current = itemHistoryFixture();
        hideTheActorFromTheViewer(current);
        const before = view(current).history.map((entry) => entry.id);

        // The sharpest form: nothing about the actor changes at all. They stay on the roster and
        // stay hidden, and a second occupant's re-pointed row answers for their recorded identity.
        // Restoring the actor's row is no defence here, because the actor already has one.
        current.currentEncounter.participants.push(
          rosterRow({
            id: "encounter-participant-shadow",
            label: "Shadow",
            scenarioParticipantId: "encounter-participant-b",
          }),
        );
        current.currentEncounter.roleplayState!.visibility["encounter-participant-a"]![
          "encounter-participant-shadow"
        ] = true;
        const after = view(current).history.map((entry) => entry.id);

        expect({ after, before }).toEqual({ after: [], before: [] });
      });

      it("refuses when the viewer's own row takes over the actor's recorded id", () => {
        const current = itemHistoryFixture();
        current.participants.push(participant("participant-c", "user-c", "Player C"));
        const before = view(current).history.map((entry) => entry.id);

        // The same ambiguity through the *control* set rather than the visibility set: the
        // viewer's own row holds the recorded id, so ownership of the action would be asserted
        // and the visibility question never reached. The GM denies the viewer sight of everybody
        // else, so this is the only route left open.
        removeActorFromRoster(current);
        current.currentEncounter.participants = [
          rosterRow({
            id: "encounter-participant-b",
            label: "Player A",
            scenarioParticipantId: "participant-a",
          }),
          rosterRow({
            id: "encounter-participant-c",
            label: "Player C",
            scenarioParticipantId: "participant-c",
          }),
        ];
        current.currentEncounter.roleplayState!.visibility = {
          "encounter-participant-b": { "encounter-participant-c": false },
        };
        const after = view(current).history.map((entry) => entry.id);

        expect({ after, before }).toEqual({ after: [], before: ["item-outcome"] });
      });
    });
  });

  it("keeps owned and closed Item history, archived control rules, and other chronology unchanged", () => {
    const current = itemHistoryFixture();
    // #798: Scenario-level participant suppression now reads the same per-viewer
    // matrix combat honours, so once the matrix is non-empty a viewer needs
    // their own row to see a co-participant. User B is given one here; user A's
    // row is varied in the loop below, which is what this case exercises.
    current.currentEncounter.roleplayState!.visibility = {
      "encounter-participant-a": {},
      "encounter-participant-b": { "encounter-participant-a": true },
    };
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

  it("omits GM-hidden participants and every typed event that identifies them", () => {
    const scenario = scenarioSchema.parse({
      campaignId: "campaign-1",
      createdAt: now,
      id: "scenario-1",
      name: "Lost Seal",
      status: "live",
      updatedAt: now,
    });
    // #798: the GM's reachable hide control writes the per-viewer
    // `roleplayState.visibility` matrix. `visibilityOverrides` has no
    // production write path, so a fixture that sets it characterises nothing.
    const participants = [
      participant("participant-a", "user-a", "Player A"),
      participant("participant-hidden", "user-hidden", "Hidden Steward"),
      participant("participant-gm", "user-gm-only", "Veiled Witness"),
    ];
    const hidingEncounter = encounterSessionSchema.parse({
      createdAt: now,
      id: "encounter-hiding",
      kind: "roleplay",
      participantMembershipMode: "explicit",
      participants: [
        {
          id: "encounter-participant-a",
          label: "participant-a",
          participantType: "scenario",
          scenarioParticipantId: "participant-a",
        },
        {
          id: "encounter-participant-hidden",
          label: "participant-hidden",
          participantType: "scenario",
          scenarioParticipantId: "participant-hidden",
        },
        {
          id: "encounter-participant-gm",
          label: "participant-gm",
          participantType: "scenario",
          scenarioParticipantId: "participant-gm",
        },
      ],
      roleplayState: {
        visibility: {
          "encounter-participant-a": {
            "encounter-participant-gm": false,
            "encounter-participant-hidden": false,
          },
        },
      },
      scenarioId: "scenario-1",
      status: "active",
      title: "Library",
      updatedAt: now,
    });
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
      encounters: [hidingEncounter],
      eventLogs,
      participants,
      scenario,
      userId: "user-a",
      viewerMode: "player",
    });
    const gmView = buildScenarioSessionView({
      availableObjects: [],
      encounters: [hidingEncounter],
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

  it("partitions today's enum into the membership/maintenance set and the player-visible set", () => {
    // What this establishes (#799): the exact partition of the event types
    // that exist today. Classification is total and fail closed, so a type
    // added to the enum without a classification is GM operational and lands
    // in `operational`, which fails this assertion; reclassifying one of
    // today's types moves it between the two lists and fails one of them.
    // It does not establish anything about a type absent from the enum — that
    // is the fail-closed assertion below.
    const operational = scenarioObjectiveHistoryEventTypeSchema.options.filter((type) =>
      isGmOperationalScenarioHistoryEventType(type),
    );
    const playerVisible = scenarioObjectiveHistoryEventTypeSchema.options.filter(
      (type) => !isGmOperationalScenarioHistoryEventType(type),
    );

    expect([...operational].sort()).toEqual([
      "encounter_participants_updated",
      "equipment_reconciled",
      "participant_activated",
      "participant_added",
      "participant_deactivated",
    ]);
    // The complement, pinned explicitly so a new type cannot arrive on the
    // player side unnoticed either.
    expect([...playerVisible].sort()).toEqual([
      "encounter_archived",
      "encounter_closed",
      "encounter_combat_outcome",
      "encounter_created",
      "encounter_paused",
      "encounter_resumed",
      "encounter_skill_outcome",
      "encounter_started",
      "item_transferred",
    ]);
    // The two lists account for every member of the enum: nothing is
    // unclassified in either direction.
    expect(operational.length + playerVisible.length).toBe(
      scenarioObjectiveHistoryEventTypeSchema.options.length,
    );
  });
});

/**
 * Forgejo #799 — the player Activity **type** axis must fail closed.
 *
 * The axis used to be a deny-list, and QA measured the consequence on
 * #788/PR #791: adding `participant_removed` to the enum returned
 * `[["participant_removed","Removed Watchman Dorn from the scenario."]]` to a
 * player while all 12 tests in this file still passed. These assertions make
 * that experiment a permanent guard. The hypothetical type is injected here,
 * never added to the production enum.
 */
describe("Player Activity type classification fails closed (#799)", () => {
  // The exact type QA injected. It is not a member of
  // `scenarioObjectiveHistoryEventTypeSchema`, so the cast stands in for the
  // state of the world one commit after somebody adds it to the enum and
  // forgets to classify it.
  const unclassifiedType = "participant_removed" as ScenarioObjectiveHistoryEventType;

  it("classifies an unclassified event type as GM operational rather than player history", () => {
    // Fails on the pre-#799 code: the deny-list returned `false` here, which
    // is what let the type reach a player.
    expect(isGmOperationalScenarioHistoryEventType(unclassifiedType)).toBe(true);
  });

  it("keeps the player and GM projections of today's whole enum unchanged", () => {
    // Behaviour preservation for the current enum, asserted on the projected
    // rows rather than on a render: the 5 membership/maintenance types are
    // suppressed for a player and the other 9 survive, while the GM audit
    // still carries all 14 with their stored summaries.
    const oneRowPerType = scenarioObjectiveHistoryEventTypeSchema.options.map((type, index) => ({
      createdAt: now,
      eventType: type,
      id: `row-${type}`,
      payload:
        type === "encounter_combat_outcome"
          ? { encounterId: "encounter-a", eventKind: "attack" }
          : { encounterId: "encounter-a" },
      scenarioId: "scenario-1",
      sequence: index + 1,
      summary: `Stored summary for ${type}.`,
    }));

    const playerHistory = projectScenarioObjectiveHistory({
      controlledParticipantIds: new Set(["participant-a"]),
      eventLogs: oneRowPerType,
      viewerMode: "player",
    });
    const gmHistory = projectScenarioObjectiveHistory({
      controlledParticipantIds: new Set(),
      eventLogs: oneRowPerType,
      viewerMode: "gm",
    });

    expect(playerHistory.map((event) => event.type)).toEqual([
      "encounter_created",
      "encounter_started",
      "encounter_resumed",
      "encounter_paused",
      "encounter_closed",
      "encounter_archived",
      "item_transferred",
      "encounter_skill_outcome",
      "encounter_combat_outcome",
    ]);
    expect(gmHistory.map((event) => event.type)).toEqual([
      ...scenarioObjectiveHistoryEventTypeSchema.options,
    ]);
    expect(Object.fromEntries(gmHistory.map((event) => [event.type, event.summary]))).toEqual(
      Object.fromEntries(oneRowPerType.map((event) => [event.eventType, event.summary])),
    );
  });

  it("suppresses an unclassified type for a player and never for the GM audit", () => {
    // The projection consults the classifier above for the player branch only.
    // A row whose type the enum does not know is dropped for both viewers by
    // `safeParse`, so this asserts the player side of the chain the classifier
    // governs, not a second definition of it.
    const unclassifiedRow = [
      {
        createdAt: now,
        eventType: unclassifiedType,
        id: "unclassified",
        participantId: "participant-npc",
        payload: { audienceParticipantIds: ["participant-a"] },
        scenarioId: "scenario-1",
        sequence: 1,
        summary: "Removed Watchman Dorn from the scenario.",
      },
    ];

    expect(
      projectScenarioObjectiveHistory({
        controlledParticipantIds: new Set(["participant-a"]),
        eventLogs: unclassifiedRow,
        viewerMode: "player",
      }),
    ).toEqual([]);
  });
});
