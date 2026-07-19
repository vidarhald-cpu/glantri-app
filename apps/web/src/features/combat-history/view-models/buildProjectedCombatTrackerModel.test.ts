import type {
  CombatHistoryProjection,
  CombatProgressionPresentationProjection,
  ProjectedCombatHistoryEvent,
  ProjectedCombatHistorySnapshot,
} from "@glantri/domain";
import { describe, expect, it } from "vitest";

import {
  buildProjectedCombatTrackerModel,
  getProjectedCombatHistoryCellEvents,
} from "./buildProjectedCombatTrackerModel";

function event(overrides: Partial<ProjectedCombatHistoryEvent> = {}): ProjectedCombatHistoryEvent {
  return {
    completeness: "complete",
    facts: { publicOutcome: {} },
    id: "event-1",
    identities: [],
    missingFacts: [],
    occurredAt: null,
    ownerParticipantId: "aria",
    roundNumber: 1,
    sequence: 1,
    status: "recorded",
    step: "phase_1_actions",
    type: "attack",
    ...overrides,
  };
}

function snapshot(
  overrides: Partial<ProjectedCombatHistorySnapshot> = {},
): ProjectedCombatHistorySnapshot {
  return {
    completeness: "complete",
    id: "snapshot-1",
    panels: { actionResult: {}, actionSelector: {}, modifiers: {}, phase1: {}, phase2: {} },
    participant: { displayName: "Aria", participantId: "aria" },
    roundNumber: 1,
    step: "phase_1_actions",
    ...overrides,
  };
}

function history(events: ProjectedCombatHistoryEvent[]): CombatHistoryProjection {
  return {
    activeRound: { events, roundNumber: 1, snapshots: [snapshot()] },
    archivedRounds: [],
    rows: [{ displayName: "Aria", participantId: "aria" }],
  };
}

function liveProgression(
  input: {
    kind?: "attack" | "parry" | "resolve_adjust_distance" | "resolve_feint";
    ownerId?: string;
    state?: "executable" | "waiting";
    step?: "A1" | "P1";
  } = {},
): CombatProgressionPresentationProjection {
  const kind = input.kind ?? "attack";
  const ownerId = input.ownerId ?? "aria";
  const step = input.step ?? "A1";
  return {
    awaitingGmTransition: false,
    boundary: { id: "boundary-1", kind: "phase1_resolution", roundNumber: 1 },
    processes: [
      {
        id: "process-1",
        kind:
          kind === "resolve_feint"
            ? "feint"
            : kind === "resolve_adjust_distance"
              ? "adjust_distance"
              : "attack",
        stages: [
          {
            executionStrategy: "single_task",
            id: "stage-1",
            kind: step === "P1" ? "defense" : "attack",
            processId: "process-1",
            state: "active",
            tasks: [
              {
                actorAccess: { combatant: true, gm: true },
                contributesToProgression: true,
                id: "task-1",
                identity: { executionGroupId: "group-1", phase: "phase1" },
                kind,
                owner: { kind: "combatant", label: "Aria", participantId: ownerId },
                processId: "process-1",
                stageId: "stage-1",
                state: input.state ?? "executable",
                trackerFacet: {
                  owner: { kind: "combatant", label: "Aria", participantId: ownerId },
                  step,
                },
              },
            ],
          },
        ],
      },
    ],
    roundNumber: 1,
    taskVisibility: "available",
  };
}

describe("buildProjectedCombatTrackerModel", () => {
  it("builds the shared tracker model using projected rows and cell events", () => {
    const projection = history([event({ facts: { publicOutcome: { grazing: true } } })]);
    projection.progression = liveProgression();
    const model = buildProjectedCombatTrackerModel({
      history: projection,
      selected: { participantId: "aria", roundNumber: 1, step: "phase_1_actions" },
    });

    expect(model.rows).toEqual([{ label: "Aria", participantId: "aria", selected: true }]);
    expect(model.cells["1:aria:phase_1_actions"]).toMatchObject({
      current: true,
      inspectable: true,
      marker: "H",
      selected: true,
    });
  });

  it("does not create rows, keys, or hover text for identities absent from projection", () => {
    const serialized = JSON.stringify(buildProjectedCombatTrackerModel({ history: history([]) }));

    expect(serialized).not.toContain("hidden-participant");
    expect(serialized).not.toContain("Hidden foe");
  });

  it("uses projected not-applicable and not-required reasons for compact dash cells", () => {
    const projection = history([]);
    projection.activeRound.snapshots = [
      snapshot({
        step: "review_phase_2_actions",
        stepOutcome: {
          category: "not_required",
          message: "No parry required. The incoming attack missed.",
          reason: "incoming_attack_missed",
        },
      }),
    ];
    const model = buildProjectedCombatTrackerModel({ history: projection });

    expect(model.cells["1:aria:review_phase_2_actions"]).toMatchObject({
      marker: "–",
      markerKind: "skipped",
    });
    expect(model.cells["1:aria:review_phase_2_actions"].hoverText).toContain(
      "No parry required. The incoming attack missed.",
    );
  });

  it("selects only events owned by the inspected projected cell", () => {
    const selected = event({ id: "selected", sequence: 2 });
    const later = event({ id: "later", ownerParticipantId: "other", sequence: 3 });

    expect(
      getProjectedCombatHistoryCellEvents({
        history: history([later, selected]),
        selection: { participantId: "aria", roundNumber: 1, step: "phase_1_actions" },
      }).map((entry) => entry.id),
    ).toEqual(["selected"]);
  });

  it("uses projected outcomes for useful hover details without private calculations", () => {
    const projection = history([
      event({
        facts: {
          involvedOutcome: { hit: true, tableResult: "Hit", weaponName: "Long sword" },
          privateCalculation: { rollD20: 19 },
          publicOutcome: {},
        },
        identities: [
          { displayName: "Aria", participantId: "aria", role: "attacker", visibility: "visible" },
          { displayName: "Borin", participantId: "borin", role: "defender", visibility: "visible" },
        ],
      }),
    ]);
    const model = buildProjectedCombatTrackerModel({ history: projection });
    const hover = model.cells["1:aria:phase_1_actions"].hoverText;

    expect(hover).toContain("Aria attacked Borin with Long sword: Hit.");
    expect(hover).not.toContain("19");
    expect(hover).not.toContain("history available");
  });

  it.each([
    ["initiative", { total: 8 }, "initiative total 8."],
    ["parry", { success: false, status: "resolved" }, "parry failed."],
    ["damage_committed", { status: "committed" }, "damage committed."],
  ] as const)("formats projected %s status in tracker hover", (type, outcome, expected) => {
    const projection = history([
      event({
        facts: { involvedOutcome: outcome, publicOutcome: {} },
        step: type === "initiative" ? "initiative_phase_1" : "phase_1_damage",
        type,
      }),
    ]);
    const model = buildProjectedCombatTrackerModel({ history: projection });
    const step = type === "initiative" ? "initiative_phase_1" : "phase_1_damage";

    expect(model.cells[`1:aria:${step}`].hoverText).toContain(expected);
  });

  it.each([
    ["feint_committed", "committed", "✓", "feint result committed."],
    ["feint_impossible", "not_applicable", "–", "feint ruled impossible; no roll required."],
    ["feint_roll", "recorded", "?", "feint opposed roll in progress."],
    ["feint_result", "proposed", "?", "feint result awaiting GM review."],
  ] as const)("projects %s into the Phase 1 action marker", (type, status, marker, hover) => {
    const projection = history([event({ status, type })]);
    if (type === "feint_roll" || type === "feint_result") {
      projection.progression = liveProgression({ kind: "resolve_feint" });
    }
    const model = buildProjectedCombatTrackerModel({
      history: projection,
    });
    const cell = model.cells["1:aria:phase_1_actions"];

    expect(cell.marker).toBe(marker);
    expect(cell.hoverText).toContain(hover);
  });

  it("does not mark a future maneuver until its projected stage opens", () => {
    const projection = history([event({ status: "recorded", type: "feint_roll" })]);
    const beforeOpen = buildProjectedCombatTrackerModel({ history: projection });
    projection.progression = liveProgression({ kind: "resolve_feint" });
    const opened = buildProjectedCombatTrackerModel({ history: projection });

    expect(beforeOpen.cells["1:aria:phase_1_actions"].marker).toBe("·");
    expect(opened.cells["1:aria:phase_1_actions"]).toMatchObject({
      current: true,
      executable: true,
      marker: "?",
      taskIds: ["task-1"],
    });
  });

  it("does not mark future Adjust Distance work before its projected stage opens", () => {
    const projection = history([event({ status: "recorded", type: "adjust_distance_roll" })]);
    expect(
      buildProjectedCombatTrackerModel({ history: projection }).cells["1:aria:phase_1_actions"]
        .marker,
    ).toBe("·");

    projection.progression = liveProgression({ kind: "resolve_adjust_distance" });
    expect(
      buildProjectedCombatTrackerModel({ history: projection }).cells["1:aria:phase_1_actions"]
        .marker,
    ).toBe("?");
  });

  it("applies only the committed execution order delivered by progression", () => {
    const projection = history([]);
    projection.rows.push({ displayName: "Borin", participantId: "borin" });
    const beforeCommit = buildProjectedCombatTrackerModel({ history: projection });
    projection.progression = {
      ...liveProgression(),
      executionOrder: { participantIds: ["borin", "aria"], phase: "phase1" },
    };
    const afterCommit = buildProjectedCombatTrackerModel({ history: projection });

    expect(beforeCommit.rows.map((row) => row.participantId)).toEqual(["aria", "borin"]);
    expect(afterCommit.rows.map((row) => row.participantId)).toEqual(["borin", "aria"]);
  });

  it("maps defense ownership and execution groups from projected tasks", () => {
    const projection = history([]);
    projection.rows.push({ displayName: "Borin", participantId: "borin" });
    projection.progression = liveProgression({ kind: "parry", ownerId: "borin", step: "P1" });
    const cell = buildProjectedCombatTrackerModel({ history: projection }).cells[
      "1:borin:review_phase_2_actions"
    ];

    expect(cell).toMatchObject({
      current: true,
      executable: true,
      executionGroupIds: ["group-1"],
      gmProxyAvailable: true,
      marker: "?",
      ownerParticipantIds: ["borin"],
      processIds: ["process-1"],
      stageIds: ["stage-1"],
      taskKinds: ["parry"],
    });
  });

  it("keeps canonical current work independent from local inspector selection", () => {
    const projection = history([]);
    projection.progression = liveProgression();
    const model = buildProjectedCombatTrackerModel({
      history: projection,
      selected: { participantId: "aria", roundNumber: 1, step: "phase_1_damage" },
    });

    expect(model.currentTaskCellKey).toBe("1:aria:phase_1_actions");
    expect(model.cells["1:aria:phase_1_actions"].current).toBe(true);
    expect(model.cells["1:aria:phase_1_damage"].selected).toBe(true);
  });

  it("represents actively waiting projected work without making it executable", () => {
    const projection = history([]);
    projection.progression = liveProgression({ state: "waiting" });
    const cell = buildProjectedCombatTrackerModel({ history: projection }).cells[
      "1:aria:phase_1_actions"
    ];

    expect(cell).toMatchObject({
      current: true,
      executable: false,
      marker: "?",
      status: "waiting",
      waiting: true,
    });
  });

  it("fails closed when relevant progression presentation is conflicted", () => {
    const projection = history([]);
    projection.progression = { ...liveProgression(), taskVisibility: "conflicted" };
    const model = buildProjectedCombatTrackerModel({ history: projection });

    expect(model.currentTaskCellKey).toBeUndefined();
    expect(model.cells["1:aria:phase_1_actions"]).toMatchObject({
      current: false,
      executable: false,
    });
    expect(model.cells["1:aria:phase_1_actions"].marker).not.toBe("?");
  });
});
