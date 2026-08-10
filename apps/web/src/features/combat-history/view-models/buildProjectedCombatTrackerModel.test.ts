import type {
  CombatHistoryProjection,
  CombatProgressionBoundaryKind,
  CombatProgressionPresentationProjection,
  CombatProgressionPresentationTask,
  CombatProgressionTaskKind,
  CombatRoundCursorStep,
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
    activeRound: { events, observationRelationships: [], roundNumber: 1, snapshots: [snapshot()] },
    archivedRounds: [],
    rows: [{ displayName: "Aria", participantId: "aria" }],
  };
}

function liveProgression(
  input: {
    boundary?: CombatProgressionBoundaryKind;
    contributesToProgression?: boolean;
    gmOwned?: boolean;
    kind?: CombatProgressionTaskKind;
    opponentId?: string;
    opponentLabel?: string;
    ownerId?: string;
    ownerLabel?: string;
    state?: "executable" | "waiting";
    step?: CombatRoundCursorStep;
    targetBoundary?: CombatProgressionBoundaryKind;
    trackerOwnerId?: string | null;
  } = {},
): CombatProgressionPresentationProjection {
  const kind = input.kind ?? "attack";
  const ownerId = input.ownerId ?? "aria";
  const ownerLabel = input.ownerLabel ?? (ownerId === "aria" ? "Aria" : "Borin");
  const trackerOwnerId = input.trackerOwnerId === undefined ? ownerId : input.trackerOwnerId;
  const trackerOwnerLabel = trackerOwnerId === "aria" ? "Aria" : "Borin";
  const step = input.step ?? "A1";
  const task: CombatProgressionPresentationTask = {
    actorAccess: { combatant: !input.gmOwned, gm: true },
    automation: {
      authority: { kind: "unknown" },
      eligibility: "unsupported",
      schemaVersion: 1,
      taskId: "task-1",
      warnings: [],
      workClass: "not_applicable",
    },
    contributesToProgression: input.contributesToProgression ?? true,
    executionGroupId: "group-1",
    expectedCommand: kind === "gm_advance_boundary" ? "advance_combat_boundary" : "roll_attack",
    id: "task-1",
    identity: { executionGroupId: "group-1", phase: "phase1" },
    kind,
    opponent: input.opponentId
      ? {
          kind: "combatant",
          label: input.opponentLabel ?? input.opponentId,
          participantId: input.opponentId,
        }
      : undefined,
    owner: input.gmOwned
      ? { id: "gm", kind: "gm", label: "Game Master" }
      : { kind: "combatant", label: ownerLabel, participantId: ownerId },
    processId: "process-1",
    stageId: "stage-1",
    state: input.state ?? "executable",
    trackerFacet: {
      owner: trackerOwnerId
        ? {
            kind: "combatant",
            label: trackerOwnerLabel,
            participantId: trackerOwnerId,
          }
        : undefined,
      step,
    },
    transition: input.targetBoundary
      ? {
          currentBoundary: input.boundary ?? "phase1_resolution",
          requiredCompletedProcessIds: ["process-1"],
          targetBoundary: input.targetBoundary,
        }
      : undefined,
  };
  return {
    awaitingGmTransition: false,
    boundary: {
      id: "boundary-1",
      kind: input.boundary ?? "phase1_resolution",
      roundNumber: 1,
    },
    processes: [
      {
        id: "process-1",
        kind:
          kind === "submit_declaration"
            ? "declaration"
            : kind === "combat_experience"
              ? "combat_experience"
              : kind === "roll_initiative" || kind === "commit_initiative"
                ? "initiative"
                : kind.startsWith("feint_")
                  ? "feint"
                  : kind.startsWith("adjust_distance_")
                    ? "adjust_distance"
                    : "attack",
        stages: [
          {
            executionGroups: [
              {
                activationBoundary: {
                  id: "boundary-1",
                  kind: "phase1_resolution",
                  roundNumber: 1,
                },
                blocked: false,
                completionState: "incomplete",
                executionStrategy: "single_task",
                futureActivationBoundary: undefined,
                id: "group-1",
                position: 0,
                stageId: "stage-1",
                tasks: [task],
              },
            ],
            executionStrategy: "single_task",
            id: "stage-1",
            kind:
              step === "P1" || step === "P2"
                ? "defense"
                : step === "DE"
                  ? "input"
                  : step === "i1" || step === "i2"
                    ? "roll"
                    : "attack",
            processId: "process-1",
            state: "active",
            // Keep the compatibility adapter empty so these tests prove group-backed traversal.
            tasks: [],
          },
        ],
      },
    ],
    roundNumber: 1,
    taskVisibility: "available",
  };
}

function parallelAdjustDistanceProgression(
  pending: readonly ("aria" | "borin")[],
): CombatProgressionPresentationProjection {
  const base = liveProgression({ kind: "adjust_distance_attacker_roll" });
  const tasks = pending.map((participantId, index) => {
    const source = liveProgression({
      kind:
        participantId === "aria"
          ? "adjust_distance_attacker_roll"
          : "adjust_distance_defender_roll",
      ownerId: participantId,
      ownerLabel: participantId === "aria" ? "Aria" : "Borin",
      trackerOwnerId: participantId,
    }).processes[0]!.stages[0]!.executionGroups[0]!.tasks[0]!;
    return { ...source, id: `task-${index + 1}` };
  });
  const stage = base.processes[0]!.stages[0]!;
  return {
    ...base,
    processes: [
      {
        ...base.processes[0]!,
        stages: [
          {
            ...stage,
            executionGroups: [
              {
                ...stage.executionGroups[0]!,
                executionStrategy: "parallel_all",
                tasks,
              },
            ],
            executionStrategy: "parallel_all",
          },
        ],
      },
    ],
  };
}

function parallelPhase2CombatExperienceProgression(
  pending: readonly ("aria" | "borin")[],
): CombatProgressionPresentationProjection {
  const projection = parallelAdjustDistanceProgression(pending);
  return {
    ...projection,
    boundary: { ...projection.boundary, kind: "phase2_resolution" },
    processes: projection.processes.map((process) => ({
      ...process,
      kind: "combat_experience",
      stages: process.stages.map((stage) => ({
        ...stage,
        kind: "input",
        executionGroups: stage.executionGroups.map((group) => ({
          ...group,
          activationBoundary: { ...group.activationBoundary, kind: "phase2_resolution" },
          tasks: group.tasks.map((task) => ({
            ...task,
            expectedCommand: "submit_phase_initiative_choice",
            identity: { ...task.identity, phase: "phase2" },
            kind: "combat_experience",
            trackerFacet: { ...task.trackerFacet, step: "A2" },
          })),
        })),
      })),
    })),
  };
}

function withCanonicalPosition(
  progression: CombatProgressionPresentationProjection,
  input: {
    task?: CombatProgressionPresentationTask;
    taskVisibility?: "redacted" | "unavailable" | "visible";
    trackerOwner?: CombatProgressionPresentationTask["trackerFacet"]["owner"];
    trackerStep?: CombatRoundCursorStep;
    waitingFor?: "combatant" | "gm" | "unknown";
  } = {},
): CombatProgressionPresentationProjection {
  const task = input.task ?? progression.processes[0]?.stages[0]?.executionGroups[0]?.tasks[0];
  const taskVisibility = input.taskVisibility ?? "visible";
  return {
    ...progression,
    canonicalOperationalPosition: {
      executionGroupId: taskVisibility === "visible" ? task?.executionGroupId : undefined,
      executionStrategy: "single_task",
      processId: taskVisibility === "visible" ? task?.processId : undefined,
      roundNumber: progression.roundNumber,
      stageId: taskVisibility === "visible" ? task?.stageId : undefined,
      task: taskVisibility === "visible" ? task : undefined,
      taskVisibility,
      trackerFacet: {
        owner:
          input.trackerOwner ??
          (taskVisibility === "visible" ? task?.trackerFacet.owner : undefined),
        step: input.trackerStep ?? task?.trackerFacet.step ?? "DE",
      },
      waitingFor: input.waitingFor ?? "gm",
    },
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

  it("rejects a future active-round selection and keeps the cursor on canonical M2", () => {
    const projection = history([]);
    projection.activeRound.snapshots.push(snapshot({ id: "summary", step: "round_summary" }));
    projection.progression = withCanonicalPosition(
      liveProgression({ boundary: "phase2_modifier_review", kind: "modifier_review", step: "M2" }),
    );
    const model = buildProjectedCombatTrackerModel({
      history: projection,
      operationalParticipantId: "aria",
      selected: { participantId: "aria", roundNumber: 1, step: "round_summary" },
    });

    expect(model.currentTaskCellKey).toBe("1:aria:review_phase_2_modifiers");
    expect(model.cells["1:aria:review_phase_2_modifiers"]).toMatchObject({
      current: true,
      selected: true,
    });
    expect(model.cells["1:aria:round_summary"]).toMatchObject({
      completed: false,
      current: false,
      inspectable: false,
      marker: "·",
      selected: false,
    });
  });

  it("stage-gates future no-work cells despite synthetic SU boundary evidence", () => {
    const projection = history([
      event({
        completeness: "legacy_derived",
        id: "legacy-boundary",
        step: "round_summary",
        type: "round_boundary",
      }),
    ]);
    projection.activeRound.snapshots.push(
      snapshot({ id: "future-summary", step: "round_summary" }),
    );
    projection.progression = withCanonicalPosition(
      liveProgression({ boundary: "phase2_modifier_review", kind: "modifier_review", step: "M2" }),
    );

    const model = buildProjectedCombatTrackerModel({
      history: projection,
      operationalParticipantId: "aria",
    });

    expect(model.operationalCursorCellKey).toBe("1:aria:review_phase_2_modifiers");
    expect(model.selectedCellKey).toBe(model.operationalCursorCellKey);
    expect(model.cells["1:aria:review_phase_2_modifiers"]).toMatchObject({
      current: true,
      inspectable: true,
      selected: true,
    });
    for (const step of [
      "initiative_phase_2",
      "phase_2_actions",
      "review_phase_2_actions",
      "phase_2_damage",
      "round_summary",
    ] as const) {
      expect(model.cells[`1:aria:${step}`]).toMatchObject({
        completed: false,
        current: false,
        inspectable: false,
        marker: "·",
        selected: false,
      });
    }
    expect(
      getProjectedCombatHistoryCellEvents({
        history: projection,
        selection: { participantId: "aria", roundNumber: 1, step: "round_summary" },
      }).map((entry) => entry.id),
    ).toEqual(["legacy-boundary"]);
  });

  it("keeps a waiting player at a privacy-safe Round 2 M2 cursor instead of SU", () => {
    const projection = history([
      event({
        completeness: "legacy_derived",
        id: "gladiator-legacy-boundary",
        ownerParticipantId: "gladiator",
        roundNumber: 2,
        step: "round_summary",
        type: "round_boundary",
      }),
    ]);
    projection.rows = [
      { displayName: "The Gladiator", participantId: "gladiator" },
      { displayName: "Scyrian cavalry guy", participantId: "scyrian" },
    ];
    projection.activeRound = {
      ...projection.activeRound,
      roundNumber: 2,
      snapshots: [
        snapshot({
          id: "gladiator-future-summary",
          participant: { displayName: "The Gladiator", participantId: "gladiator" },
          roundNumber: 2,
          step: "round_summary",
        }),
      ],
    };
    const roundOneProgression = withCanonicalPosition(
      liveProgression({ boundary: "phase2_modifier_review", kind: "attack", step: "A2" }),
      { taskVisibility: "redacted", trackerStep: "M2", waitingFor: "gm" },
    );
    projection.progression = {
      ...roundOneProgression,
      boundary: { ...roundOneProgression.boundary, roundNumber: 2 },
      canonicalOperationalPosition: roundOneProgression.canonicalOperationalPosition
        ? { ...roundOneProgression.canonicalOperationalPosition, roundNumber: 2 }
        : undefined,
      roundNumber: 2,
    };

    const model = buildProjectedCombatTrackerModel({
      history: projection,
      operationalParticipantId: "gladiator",
    });

    expect(model.rounds).toEqual([{ currentStep: "review_phase_2_modifiers", roundNumber: 2 }]);
    expect(model.currentTaskCellKey).toBeUndefined();
    expect(model.operationalCursorCellKey).toBe("2:gladiator:review_phase_2_modifiers");
    expect(model.cells["2:gladiator:review_phase_2_modifiers"]).toMatchObject({
      current: false,
      inspectable: true,
      selected: true,
    });
    expect(model.cells["2:gladiator:round_summary"]).toMatchObject({
      completed: false,
      inspectable: false,
      marker: "·",
      selected: false,
    });
    expect(JSON.stringify(model)).not.toContain("Hidden NPC");
  });

  it("keeps an archived green cursor separate from the active amber M2 marker", () => {
    const projection = history([]);
    projection.archivedRounds = [
      {
        events: [
          event({
            completeness: "legacy_derived",
            id: "archived-boundary",
            step: "round_summary",
            type: "round_boundary",
          }),
        ],
        observationRelationships: [],
        roundNumber: 1,
        snapshots: [snapshot({ id: "archived-summary", step: "round_summary" })],
      },
    ];
    projection.activeRound = {
      events: [],
      observationRelationships: [],
      roundNumber: 2,
      snapshots: [],
    };
    const roundOneProgression = withCanonicalPosition(
      liveProgression({ boundary: "phase2_modifier_review", kind: "modifier_review", step: "M2" }),
    );
    projection.progression = {
      ...roundOneProgression,
      boundary: { ...roundOneProgression.boundary, roundNumber: 2 },
      canonicalOperationalPosition: roundOneProgression.canonicalOperationalPosition
        ? { ...roundOneProgression.canonicalOperationalPosition, roundNumber: 2 }
        : undefined,
      roundNumber: 2,
    };

    const model = buildProjectedCombatTrackerModel({
      history: projection,
      operationalParticipantId: "aria",
      selected: { participantId: "aria", roundNumber: 1, step: "round_summary" },
    });

    expect(model.cells["2:aria:review_phase_2_modifiers"]).toMatchObject({
      current: true,
      selected: false,
    });
    expect(model.cells["1:aria:round_summary"]).toMatchObject({
      current: false,
      historical: true,
      selected: true,
    });
    expect(model.operationalCursorCellKey).toBe("2:aria:review_phase_2_modifiers");
    expect(model.selectedCellKey).toBe("1:aria:round_summary");
  });

  it("retains a redacted canonical M2 header without falling forward to a visible later task", () => {
    const projection = history([]);
    projection.progression = withCanonicalPosition(
      liveProgression({ boundary: "phase2_modifier_review", kind: "attack", step: "A2" }),
      { taskVisibility: "redacted", trackerStep: "M2", waitingFor: "gm" },
    );
    const model = buildProjectedCombatTrackerModel({ history: projection });

    expect(model.rounds).toEqual([{ currentStep: "review_phase_2_modifiers", roundNumber: 1 }]);
    expect(model.currentTaskCellKey).toBeUndefined();
    expect(Object.values(model.cells).filter((cell) => cell.current)).toHaveLength(0);
    expect(model.cells["1:aria:phase_2_actions"]?.current).toBe(false);
  });

  it("keeps GM, GM Player, and Player perspectives on the same canonical step", () => {
    const gmHistory = history([]);
    gmHistory.rows.push({ displayName: "Borin", participantId: "borin" });
    const gmProgression = liveProgression({
      boundary: "phase2_modifier_review",
      gmOwned: true,
      kind: "modifier_review",
      ownerId: "borin",
      ownerLabel: "Borin",
      step: "M2",
      trackerOwnerId: "borin",
    });
    gmHistory.progression = withCanonicalPosition(gmProgression);

    const playerHistory = history([]);
    playerHistory.progression = withCanonicalPosition(
      liveProgression({ boundary: "phase2_modifier_review", kind: "attack", step: "A2" }),
      { taskVisibility: "redacted", trackerStep: "M2", waitingFor: "gm" },
    );
    const gm = buildProjectedCombatTrackerModel({ history: gmHistory });
    const player = buildProjectedCombatTrackerModel({ history: playerHistory });
    const gmPlayer = buildProjectedCombatTrackerModel({ history: playerHistory });

    expect(gm.rounds[0]?.currentStep).toBe("review_phase_2_modifiers");
    expect(player.rounds[0]?.currentStep).toBe(gm.rounds[0]?.currentStep);
    expect(gmPlayer.rounds[0]?.currentStep).toBe(gm.rounds[0]?.currentStep);
    expect(gm.currentTaskCellKey).toBe("1:borin:review_phase_2_modifiers");
    expect(player.currentTaskCellKey).toBeUndefined();
  });

  it("renders exactly one canonical current cell when multiple visible tasks share a stage", () => {
    const projection = history([]);
    projection.rows.push({ displayName: "Borin", participantId: "borin" });
    const parallel = parallelAdjustDistanceProgression(["aria", "borin"]);
    const canonicalTask = parallel.processes[0]!.stages[0]!.executionGroups[0]!.tasks[0]!;
    projection.progression = withCanonicalPosition(parallel, { task: canonicalTask });
    const model = buildProjectedCombatTrackerModel({ history: projection });

    expect(Object.values(model.cells).filter((cell) => cell.current)).toHaveLength(1);
    expect(model.currentTaskCellKey).toBe("1:aria:phase_1_actions");
  });

  it("does not create rows, keys, or hover text for identities absent from projection", () => {
    const serialized = JSON.stringify(buildProjectedCombatTrackerModel({ history: history([]) }));

    expect(serialized).not.toContain("hidden-participant");
    expect(serialized).not.toContain("Hidden foe");
  });

  it("uses ordinary declaration dots, exceptional CE attention, and completed declaration checks", () => {
    const ordinary = history([]);
    ordinary.progression = liveProgression({
      boundary: "declaration",
      kind: "submit_declaration",
      step: "DE",
    });
    const ce = history([]);
    ce.progression = liveProgression({
      boundary: "declaration",
      kind: "combat_experience",
      step: "DE",
    });
    const submitted = history([
      event({ ownerParticipantId: "aria", step: "select_actions", type: "declaration" }),
    ]);
    submitted.progression = liveProgression({
      boundary: "declaration",
      gmOwned: true,
      kind: "gm_advance_boundary",
      step: "DE",
      targetBoundary: "phase1_modifier_review",
    });

    expect(
      buildProjectedCombatTrackerModel({ history: ordinary }).cells["1:aria:select_actions"],
    ).toMatchObject({
      attention: "ordinary",
      current: true,
      executable: true,
      marker: "·",
      status: "open",
    });
    expect(
      buildProjectedCombatTrackerModel({ history: ordinary }).cells["1:aria:select_actions"]
        .hoverText,
    ).toContain("Declaration open for Aria.");
    expect(
      buildProjectedCombatTrackerModel({ history: ce }).cells["1:aria:select_actions"],
    ).toMatchObject({
      attention: "exceptional",
      marker: "?",
    });
    expect(
      buildProjectedCombatTrackerModel({ history: submitted }).cells["1:aria:select_actions"],
    ).toMatchObject({
      marker: "✓",
      status: "completed",
    });
  });

  it("does not let an optional GM declaration edit replace an accepted player declaration", () => {
    const projection = history([
      event({ ownerParticipantId: "aria", step: "select_actions", type: "declaration" }),
    ]);
    projection.progression = liveProgression({
      boundary: "declaration",
      contributesToProgression: false,
      gmOwned: true,
      kind: "submit_declaration",
      step: "DE",
      trackerOwnerId: "aria",
    });

    const cell = buildProjectedCombatTrackerModel({ history: projection }).cells[
      "1:aria:select_actions"
    ];
    expect(cell).toMatchObject({ current: false, marker: "✓" });
    expect(cell?.hoverText).toContain("action declared");
    expect(cell?.hoverText).not.toContain("Awaiting GM");
  });

  it("returns from completed CE to an ordinary pending declaration dot", () => {
    const projection = history([
      event({ ownerParticipantId: "aria", step: "select_actions", type: "combat_experience" }),
    ]);
    projection.progression = liveProgression({
      boundary: "declaration",
      kind: "submit_declaration",
      step: "DE",
    });

    expect(
      buildProjectedCombatTrackerModel({ history: projection }).cells["1:aria:select_actions"],
    ).toMatchObject({ attention: "ordinary", marker: "·" });
  });

  it("does not treat CE or a generic declaration snapshot as accepted DE completion", () => {
    const projection = history([
      event({ ownerParticipantId: "aria", step: "select_actions", type: "combat_experience" }),
    ]);
    projection.activeRound.snapshots = [snapshot({ step: "select_actions" })];
    projection.progression = liveProgression({
      boundary: "declaration",
      kind: "submit_declaration",
      step: "DE",
    });

    expect(
      buildProjectedCombatTrackerModel({ history: projection }).cells["1:aria:select_actions"],
    ).toMatchObject({ completed: false, current: true, marker: "·" });
  });

  it("uses the same accepted declaration evidence after player, GM, or NPC acceptance", () => {
    for (const id of ["player-declaration", "gm-declaration", "npc-declaration"]) {
      const projection = history([
        event({ id, ownerParticipantId: "aria", step: "select_actions", type: "declaration" }),
      ]);
      projection.progression = liveProgression({
        boundary: "declaration",
        gmOwned: true,
        kind: "gm_advance_boundary",
        step: "DE",
        targetBoundary: "phase1_modifier_review",
      });

      expect(
        buildProjectedCombatTrackerModel({ history: projection }).cells["1:aria:select_actions"],
      ).toMatchObject({ completed: true, marker: "✓" });
    }
  });

  it("marks recorded initiative complete and shows its number only after GM commit", () => {
    const projection = history([
      event({
        facts: { involvedOutcome: { total: 8 }, publicOutcome: {} },
        step: "initiative_phase_1",
        type: "initiative",
      }),
    ]);
    projection.progression = liveProgression({
      boundary: "phase1_initiative",
      kind: "roll_initiative",
      step: "i1",
    });

    const beforeCommit = buildProjectedCombatTrackerModel({ history: projection });
    projection.progression = liveProgression({
      boundary: "phase1_resolution",
      kind: "attack",
      step: "A1",
    });
    const afterCommit = buildProjectedCombatTrackerModel({ history: projection });

    expect(beforeCommit.cells["1:aria:initiative_phase_1"]).toMatchObject({
      attention: "ordinary",
      initiativeValue: false,
      marker: "✓",
    });
    expect(beforeCommit.cells["1:aria:initiative_phase_1"].hoverText).not.toContain("8");
    expect(afterCommit.cells["1:aria:initiative_phase_1"]).toMatchObject({
      initiativeValue: true,
      marker: "8",
    });
  });

  it("keeps bulk-skipped initiative distinct from a rolled or overridden history result", () => {
    const projection = history([
      event({
        facts: {
          involvedOutcome: { resolutionType: "bulk_skipped", total: 0 },
          publicOutcome: {},
        },
        status: "skipped",
        step: "initiative_phase_1",
        type: "initiative",
      }),
    ]);
    projection.progression = liveProgression({
      boundary: "phase1_resolution",
      kind: "attack",
      step: "A1",
    });

    const cell = buildProjectedCombatTrackerModel({ history: projection }).cells[
      "1:aria:initiative_phase_1"
    ];

    expect(cell).toMatchObject({
      initiativeValue: false,
      marker: "–",
      markerKind: "skipped",
    });
    expect(cell.hoverText).toContain("initiative bulk skipped by GM; effective initiative 0");
  });

  it("keeps an ordinary current attack open without exceptional attention", () => {
    const projection = history([]);
    projection.progression = liveProgression({
      kind: "attack",
      opponentId: "borin",
      opponentLabel: "Borin",
    });

    const cell = buildProjectedCombatTrackerModel({ history: projection }).cells[
      "1:aria:phase_1_actions"
    ];
    expect(cell).toMatchObject({ attention: "ordinary", marker: "·", status: "open" });
    expect(cell.hoverText).toContain("Aria may make phase 1 attack against Borin.");
  });

  it("keeps GM boundary readiness ordinary and uses the transition task for hover", () => {
    const projection = history([]);
    projection.progression = liveProgression({
      boundary: "phase1_modifier_review",
      gmOwned: true,
      kind: "gm_advance_boundary",
      step: "M1",
      targetBoundary: "phase1_initiative",
      trackerOwnerId: "aria",
    });

    const cell = buildProjectedCombatTrackerModel({ history: projection }).cells[
      "1:aria:review_action_modifiers"
    ];
    expect(cell).toMatchObject({ attention: "ordinary", marker: "·" });
    expect(cell.hoverText).toContain("Awaiting GM: Open Phase 1 initiative.");
  });

  it("keeps ownerless phase work on the shared step without marking a participant cell", () => {
    const projection = history([]);
    projection.progression = liveProgression({
      boundary: "phase1_initiative",
      gmOwned: true,
      kind: "commit_initiative",
      step: "i1",
      trackerOwnerId: null,
    });

    const model = buildProjectedCombatTrackerModel({ history: projection });

    expect(model.rounds).toEqual([{ currentStep: "initiative_phase_1", roundNumber: 1 }]);
    expect(model.currentTaskCellKey).toBeUndefined();
    expect(model.cells["1:aria:initiative_phase_1"]).toMatchObject({ current: false });
  });

  it.each([
    ["combat_experience", "DE"],
    ["double_attack_decision", "M2"],
    ["hit_location", "D1"],
    ["critical", "D1"],
    ["damage_review", "D1"],
    ["health_review", "SU"],
    ["distance_roll", "SU"],
  ] satisfies [CombatProgressionTaskKind, CombatRoundCursorStep][])(
    "marks current exceptional %s work as requiring attention",
    (kind, step) => {
      const projection = history([]);
      projection.progression = liveProgression({
        boundary: step === "SU" ? "round_end" : undefined,
        kind,
        step,
      });
      const expectedStep =
        step === "DE"
          ? "select_actions"
          : step === "M2"
            ? "review_phase_2_modifiers"
            : step === "SU"
              ? "round_summary"
              : "phase_1_damage";

      expect(
        buildProjectedCombatTrackerModel({ history: projection }).cells[`1:aria:${expectedStep}`],
      ).toMatchObject({ attention: "exceptional", marker: "?" });
    },
  );

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
    ["initiative", { total: 8 }, "initiative roll recorded."],
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
    ["feint_roll", "recorded", "?", "Awaiting GM: Review Feint for Aria."],
    ["feint_result", "proposed", "?", "Awaiting GM: Review Feint for Aria."],
  ] as const)("projects %s into the Phase 1 action marker", (type, status, marker, hover) => {
    const projection = history([event({ status, type })]);
    if (type === "feint_roll" || type === "feint_result") {
      projection.progression = liveProgression({ gmOwned: true, kind: "feint_commit" });
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
    projection.progression = liveProgression({ kind: "feint_attacker_roll" });
    const opened = buildProjectedCombatTrackerModel({ history: projection });

    expect(beforeOpen.cells["1:aria:phase_1_actions"].marker).toBe("·");
    expect(opened.cells["1:aria:phase_1_actions"]).toMatchObject({
      current: true,
      executable: true,
      marker: "?",
      taskIds: ["task-1"],
    });
  });

  it("shows a recorded Adjust Distance input complete and marks only an open task exceptional", () => {
    const projection = history([event({ status: "recorded", type: "adjust_distance_roll" })]);
    expect(
      buildProjectedCombatTrackerModel({ history: projection }).cells["1:aria:phase_1_actions"]
        .marker,
    ).toBe("✓");

    projection.progression = liveProgression({ kind: "adjust_distance_attacker_roll" });
    expect(
      buildProjectedCombatTrackerModel({ history: projection }).cells["1:aria:phase_1_actions"]
        .marker,
    ).toBe("?");
  });

  it("keeps both opposed Adjust Distance participants attentive until each records their input", () => {
    const projection = history([]);
    projection.rows.push({ displayName: "Borin", participantId: "borin" });
    projection.progression = parallelAdjustDistanceProgression(["aria", "borin"]);

    const bothPending = buildProjectedCombatTrackerModel({ history: projection });
    expect(bothPending.cells["1:aria:phase_1_actions"]).toMatchObject({
      executionGroupIds: ["group-1"],
      marker: "?",
    });
    expect(bothPending.cells["1:borin:phase_1_actions"]).toMatchObject({
      executionGroupIds: ["group-1"],
      marker: "?",
    });

    projection.activeRound!.events.push(
      event({
        id: "aria-distance-roll",
        ownerParticipantId: "aria",
        status: "recorded",
        type: "adjust_distance_roll",
      }),
    );
    projection.progression = parallelAdjustDistanceProgression(["borin"]);
    const oneRecorded = buildProjectedCombatTrackerModel({ history: projection });
    expect(oneRecorded.cells["1:aria:phase_1_actions"].marker).toBe("✓");
    expect(oneRecorded.cells["1:borin:phase_1_actions"].marker).toBe("?");
  });

  it("keeps parallel Phase 2 CE attention on each canonical task owner", () => {
    const projection = history([]);
    projection.rows.push({ displayName: "Borin", participantId: "borin" });
    projection.progression = parallelPhase2CombatExperienceProgression(["aria", "borin"]);

    const bothPending = buildProjectedCombatTrackerModel({ history: projection });
    expect(bothPending.cells["1:aria:phase_2_actions"]).toMatchObject({ marker: "?" });
    expect(bothPending.cells["1:borin:phase_2_actions"]).toMatchObject({ marker: "?" });
    expect(bothPending.cells["1:aria:initiative_phase_2"]?.marker ?? "·").toBe("·");

    projection.progression = parallelPhase2CombatExperienceProgression(["borin"]);
    const oneResolved = buildProjectedCombatTrackerModel({ history: projection });
    expect(oneResolved.cells["1:aria:phase_2_actions"]?.marker ?? "·").toBe("·");
    expect(oneResolved.cells["1:borin:phase_2_actions"].marker).toBe("?");
  });

  it.each([
    ["feint_attacker_roll", "feint"],
    ["feint_commit", "feint"],
    ["adjust_distance_response", "adjust_distance"],
    ["adjust_distance_adjustment", "adjust_distance"],
  ] as const)("marks only the current adapter-backed %s task", (kind, processKind) => {
    const projection = history([]);
    projection.progression = liveProgression({ kind });
    const model = buildProjectedCombatTrackerModel({ history: projection });

    expect(projection.progression.processes[0]?.kind).toBe(processKind);
    expect(model.cells["1:aria:phase_1_actions"]).toMatchObject({
      current: true,
      executable: true,
      marker: "?",
      taskKinds: [kind],
    });
    expect(model.cells["1:aria:phase_2_actions"].marker).toBe("·");
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

  it("uses visible canonical order to choose the leading cell for simultaneous work", () => {
    const projection = history([]);
    projection.rows.push({ displayName: "Borin", participantId: "borin" });
    projection.progression = {
      ...parallelAdjustDistanceProgression(["aria", "borin"]),
      executionOrder: { participantIds: ["borin", "aria"], phase: "phase1" },
    };

    const model = buildProjectedCombatTrackerModel({ history: projection });

    expect(model.rows.map((row) => row.participantId)).toEqual(["borin", "aria"]);
    expect(model.currentTaskCellKey).toBe("1:borin:phase_1_actions");
    expect(model.cells["1:aria:phase_1_actions"].current).toBe(true);
    expect(model.cells["1:borin:phase_1_actions"].current).toBe(true);
  });

  it("maps defense ownership and execution groups from projected tasks", () => {
    const projection = history([]);
    projection.rows.push({ displayName: "Borin", participantId: "borin" });
    projection.progression = liveProgression({
      kind: "parry",
      opponentId: "aria",
      opponentLabel: "Aria",
      ownerId: "borin",
      ownerLabel: "Borin",
      step: "P1",
    });
    const model = buildProjectedCombatTrackerModel({ history: projection });
    const cell = model.cells["1:borin:review_phase_2_actions"];

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
    expect(cell.hoverText).toContain("Borin must respond to Aria’s attack.");
    expect(model.cells["1:aria:review_phase_2_actions"].marker).toBe("·");
  });

  it("keeps visible GM/player marker semantics equal when opponent identity is sanitized", () => {
    const gm = history([]);
    gm.progression = liveProgression({
      kind: "parry",
      opponentId: "borin",
      opponentLabel: "Borin",
      step: "P1",
    });
    const player = history([]);
    player.progression = liveProgression({ kind: "parry", step: "P1" });

    const gmCell = buildProjectedCombatTrackerModel({ history: gm }).cells[
      "1:aria:review_phase_2_actions"
    ];
    const playerCell = buildProjectedCombatTrackerModel({ history: player }).cells[
      "1:aria:review_phase_2_actions"
    ];
    const gmPlayerCell = buildProjectedCombatTrackerModel({ history: player }).cells[
      "1:aria:review_phase_2_actions"
    ];

    expect(playerCell).toMatchObject({
      attention: gmCell.attention,
      marker: gmCell.marker,
      status: gmCell.status,
      taskIds: gmCell.taskIds,
    });
    expect(gmPlayerCell).toMatchObject({ marker: playerCell.marker, status: playerCell.status });
    expect(gmCell.hoverText).toContain("Borin’s attack");
    expect(playerCell.hoverText).toContain("another combatant’s attack");
    expect(playerCell.hoverText).not.toContain("Borin");
  });

  it("preserves immutable historical attack markers without live attention classification", () => {
    const projection = history([]);
    projection.activeRound = {
      events: [],
      observationRelationships: [],
      roundNumber: 2,
      snapshots: [],
    };
    projection.archivedRounds = [
      {
        events: [event({ facts: { publicOutcome: { hit: true } } })],
        observationRelationships: [],
        roundNumber: 1,
        snapshots: [],
      },
    ];
    projection.progression = { ...liveProgression(), roundNumber: 2 };

    const cell = buildProjectedCombatTrackerModel({ history: projection }).cells[
      "1:aria:phase_1_actions"
    ];
    expect(cell).toMatchObject({ historical: true, marker: "H", status: "historical" });
  });

  it("does not allow local inspection to move ahead of canonical current work", () => {
    const projection = history([]);
    projection.progression = liveProgression();
    const model = buildProjectedCombatTrackerModel({
      history: projection,
      operationalParticipantId: "aria",
      selected: { participantId: "aria", roundNumber: 1, step: "phase_1_damage" },
    });

    expect(model.currentTaskCellKey).toBe("1:aria:phase_1_actions");
    expect(model.cells["1:aria:phase_1_actions"]).toMatchObject({ current: true, selected: true });
    expect(model.cells["1:aria:phase_1_damage"]).toMatchObject({
      inspectable: false,
      selected: false,
    });
  });

  it("represents ordinary waiting work without exceptional attention", () => {
    const projection = history([]);
    projection.progression = liveProgression({ state: "waiting" });
    const cell = buildProjectedCombatTrackerModel({ history: projection }).cells[
      "1:aria:phase_1_actions"
    ];

    expect(cell).toMatchObject({
      current: true,
      executable: false,
      marker: "·",
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
