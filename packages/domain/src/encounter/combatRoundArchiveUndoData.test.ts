import { describe, expect, it } from "vitest";

import {
  ARCHIVED_COMBAT_ROUND_UNDO_ONLY_COMMAND_FACT_KEYS,
  advanceCombatProgressionBoundary,
  buildCombatHistorySourceViewFromState,
  buildCombatProgressionProjection,
  clearCurrentCombatRoundStepAndRewind,
  combatRoundStateSchema,
  completedCombatRoundSchema,
  getCombatRoundTimelineRoundStates,
  projectCombatHistory,
  undoLatestCombatRoundCommand,
  type CombatRoundCommand,
  type CombatRoundState,
} from "../index";

/**
 * #1135, Product Owner ruling of 2026-11-10: "unnecessary to store undo data from previous rounds
 * … discard it after the round end is committed", and "Undo will not go back to a previous round,
 * that is today's behavior".
 */

const at = "2026-11-10T10:00:00.000Z";
const later = "2026-11-10T10:05:00.000Z";

const stepSnapshot = {
  committedAt: at,
  id: "snapshot-a-declaration",
  participantId: "a",
  participantLabel: "Aria",
  roundNumber: 1,
  step: "select_actions",
};

function command(input: {
  facts: Record<string, unknown>;
  id: string;
  participantId?: string;
  step?: string;
  type: CombatRoundCommand["type"];
}) {
  const step = input.step ?? "SU";
  return {
    afterCursor: { participantId: input.participantId ?? "a", roundNumber: 1, step },
    beforeCursor: { participantId: input.participantId ?? "a", roundNumber: 1, step },
    createdAt: at,
    createdByUserId: "gm",
    facts: input.facts,
    id: input.id,
    participantId: input.participantId ?? "a",
    roundNumber: 1,
    type: input.type,
  };
}

/** Facts every archived command must keep: the round's record, read by history and read models. */
const RECORD_FACTS = {
  boundary: { currentBoundary: "declaration", targetBoundary: "M1" },
  bleed: { nextState: "controlled", previousEffect: { id: "bleed-1" }, previousState: "open" },
  modifierReview: {
    modifierReview: { reviewedAt: "2026-11-10T10:01:00.000Z" },
    status: "gmEdited",
  },
  task: {
    status: "submitted",
    taskUndo: { previousStatus: "pending" },
  },
};

/** A round at its end, its commands carrying the undo data an active round accumulates. */
function roundAtEnd(): CombatRoundState {
  return combatRoundStateSchema.parse({
    commands: [
      command({
        facts: {
          ...RECORD_FACTS.boundary,
          previousGmBacktrackHold: { participantId: "a", roundNumber: 1, step: "select_actions" },
          previousStepSnapshots: [
            stepSnapshot,
            {
              ...stepSnapshot,
              id: "snapshot-b-declaration",
              participantId: "b",
              participantLabel: "Borin",
            },
          ],
          requiredCompletedProcessIds: [],
        },
        id: "command-advance",
        step: "DE",
        type: "advance_combat_boundary",
      }),
      command({
        facts: {
          initiativeCommitUndo: { navigation: { currentStep: "initiative_phase_1" } },
          // Legacy shape: a whole round-state copy kept for the command's undo.
          previousState: { commands: [], participants: [], roundNumber: 1 },
        },
        id: "command-initiative",
        step: "i1",
        type: "roll_initiative_phase1",
      }),
      command({
        facts: {
          ...RECORD_FACTS.modifierReview,
          modifierReviewUndo: { combatContext: {}, combatEffects: { effects: [], events: [] } },
          previousDeclaration: { actionId: "attack_parry", roundNumber: 1, submittedBy: "gm" },
        },
        id: "command-modifiers",
        step: "M1",
        type: "review_modifiers_phase1",
      }),
      command({
        facts: RECORD_FACTS.bleed,
        id: "command-bleed",
        type: "transition_critical_bleed",
      }),
      command({
        facts: {
          ...RECORD_FACTS.task,
          previousAttackResult: { hit: true },
          previousPhaseResolutionStatus: "pending",
          previousStepStatus: "pending",
        },
        id: "command-review",
        participantId: "b",
        type: "commit_defense_review",
      }),
    ],
    currentCursor: { roundNumber: 1, step: "SU" },
    currentStep: "round_summary",
    encounterId: "encounter-1135",
    participants: [
      { label: "Aria", participantId: "a" },
      { label: "Borin", participantId: "b" },
    ],
    roundEndReview: {
      participantReviews: {
        a: { participantId: "a", status: "complete" },
        b: { participantId: "b", status: "complete" },
      },
      roundNumber: 1,
    },
    roundNumber: 1,
    selectedParticipantId: "a",
    selectedStep: "round_summary",
    stepSnapshots: [stepSnapshot],
  });
}

function commitRoundEnd(state: CombatRoundState): CombatRoundState {
  const task = buildCombatProgressionProjection(state)
    .boundary.processes.flatMap((process) => process.stages)
    .flatMap((stage) => stage.tasks)
    .find((candidate) => candidate.kind === "gm_advance_boundary");
  if (!task || task.expectedCommand !== "complete_round") {
    throw new Error("Expected the round-end boundary task in the fixture.");
  }
  return advanceCombatProgressionBoundary({
    command: { createdAt: later, createdByUserId: "gm" },
    expectedBoundary: "round_boundary",
    expectedCommandType: "complete_round",
    expectedExecutionGroupId: task.executionGroupId,
    expectedTaskId: task.id,
    state,
    targetBoundary: "declaration",
  });
}

const UNDO_ONLY = new Set<string>(ARCHIVED_COMBAT_ROUND_UNDO_ONLY_COMMAND_FACT_KEYS);

function undoOnlyKeys(facts: Record<string, unknown>): string[] {
  return Object.entries(facts)
    .filter(
      ([key, value]) =>
        UNDO_ONLY.has(key) || (key === "previousState" && typeof value === "object"),
    )
    .map(([key]) => key);
}

/**
 * The archived round as a row written before #1135 holds it: the same round, its commands still
 * carrying their undo facts.
 */
function withUndoFactsRestored(input: {
  advanced: CombatRoundState;
  original: CombatRoundState;
}): CombatRoundState {
  const originalFacts = new Map(input.original.commands.map((entry) => [entry.id, entry.facts]));
  return combatRoundStateSchema.parse({
    ...input.advanced,
    rounds: input.advanced.rounds.map((round) => ({
      ...round,
      commands: round.commands.map((entry) => ({
        ...entry,
        facts:
          entry.type === "complete_round"
            ? {
                ...entry.facts,
                observationUndoFacts: [],
                previousGmBacktrackHold: { roundNumber: 1, step: "round_summary" },
              }
            : { ...originalFacts.get(entry.id), ...entry.facts },
      })),
    })),
  });
}

describe("#1135 an archived round keeps no undo data", () => {
  it("drops undo-only command facts when the round end is committed, and keeps the record", () => {
    const original = roundAtEnd();
    // The active round carries undo data: that is what in-round undo reads.
    expect(original.commands.flatMap((entry) => undoOnlyKeys(entry.facts))).toEqual([
      "previousGmBacktrackHold",
      "previousStepSnapshots",
      "initiativeCommitUndo",
      "previousState",
      "modifierReviewUndo",
      "previousDeclaration",
      "previousAttackResult",
      "previousPhaseResolutionStatus",
      "previousStepStatus",
    ]);

    const advanced = commitRoundEnd(original);
    const archived = advanced.rounds[0]!;

    expect(advanced.roundNumber).toBe(2);
    expect(advanced.commands).toEqual([]);
    expect(archived.roundNumber).toBe(1);
    expect(archived.commands.flatMap((entry) => undoOnlyKeys(entry.facts))).toEqual([]);

    // Every command is still there, in order, with its identity and its record facts.
    expect(archived.commands.map((entry) => [entry.id, entry.type])).toEqual([
      ["command-advance", "advance_combat_boundary"],
      ["command-initiative", "roll_initiative_phase1"],
      ["command-modifiers", "review_modifiers_phase1"],
      ["command-bleed", "transition_critical_bleed"],
      ["command-review", "commit_defense_review"],
      // The round end is one global command per combatant.
      [expect.any(String), "complete_round"],
      [expect.any(String), "complete_round"],
    ]);
    const byId = new Map(archived.commands.map((entry) => [entry.id, entry]));
    expect(byId.get("command-advance")?.facts).toEqual({
      ...RECORD_FACTS.boundary,
      requiredCompletedProcessIds: [],
    });
    expect(byId.get("command-initiative")?.facts).toEqual({});
    expect(byId.get("command-modifiers")?.facts).toEqual(RECORD_FACTS.modifierReview);
    // The bleed's prior control state is a record string, not a round copy: it stays.
    expect(byId.get("command-bleed")?.facts).toEqual(RECORD_FACTS.bleed);
    expect(byId.get("command-review")?.facts).toEqual(RECORD_FACTS.task);
    for (const entry of archived.commands) {
      const before = original.commands.find((candidate) => candidate.id === entry.id);
      if (!before) continue;
      expect({ ...entry, facts: undefined }).toEqual({ ...before, facts: undefined });
    }

    // The rest of the archived round is untouched: snapshots, events, participants, review.
    expect(archived.stepSnapshots).toEqual(original.stepSnapshots);
    expect(archived.participants.map((participant) => participant.participantId)).toEqual([
      "a",
      "b",
    ]);
    expect(archived.roundEndReview).toEqual(original.roundEndReview);
  });

  it("projects history identically for a stripped archive and one still carrying undo data", () => {
    const original = roundAtEnd();
    const stripped = commitRoundEnd(original);
    const legacy = withUndoFactsRestored({ advanced: stripped, original });
    expect(JSON.stringify(legacy.rounds)).toContain("previousStepSnapshots");
    expect(JSON.stringify(stripped.rounds)).not.toContain("previousStepSnapshots");

    const participants = [
      { displayName: "Aria", participantId: "a" },
      { displayName: "Borin", participantId: "b" },
    ];
    const viewers = [
      { kind: "gm" as const },
      {
        controlledParticipantIds: new Set(["a"]),
        kind: "player" as const,
        visibleParticipantIds: new Set(["a", "b"]),
      },
    ];
    for (const viewer of viewers) {
      const project = (state: CombatRoundState) =>
        projectCombatHistory({
          participants,
          source: buildCombatHistorySourceViewFromState({ revision: later, state }),
          viewer,
        });
      expect(project(stripped)).toEqual(project(legacy));
    }

    // The timeline the GM tracker steps through reads the same round, less only the undo facts.
    const timeline = (state: CombatRoundState) =>
      getCombatRoundTimelineRoundStates(state).map((round) => ({
        ...round,
        commands: round.commands.map((entry) => ({
          ...entry,
          facts: Object.fromEntries(
            Object.entries(entry.facts).filter(
              ([key, value]) => !undoOnlyKeys({ [key]: value }).length,
            ),
          ),
        })),
      }));
    expect(timeline(stripped)).toEqual(timeline(legacy));
  });

  it("still reads an archived round written before #1135, with its undo data", () => {
    const original = roundAtEnd();
    const legacy = withUndoFactsRestored({ advanced: commitRoundEnd(original), original });
    const legacyRound = completedCombatRoundSchema.parse(
      JSON.parse(JSON.stringify(legacy.rounds[0])),
    );

    expect(
      legacyRound.commands.find((entry) => entry.id === "command-advance")?.facts
        .previousStepSnapshots,
    ).toHaveLength(2);
    expect(combatRoundStateSchema.parse(legacy).rounds).toHaveLength(1);
  });

  it("never reaches the previous round from the new round's first step", () => {
    const advanced = commitRoundEnd(roundAtEnd());
    expect(advanced.currentStep).toBe("pre_declaration");

    // Nothing in the new round can be undone: its command list starts empty.
    const undone = undoLatestCombatRoundCommand({ state: advanced });
    expect(undone?.roundNumber ?? advanced.roundNumber).toBe(2);
    expect((undone ?? advanced).rounds).toEqual(advanced.rounds);

    const cleared = clearCurrentCombatRoundStepAndRewind(advanced);
    expect(cleared.roundNumber).toBe(2);
    expect(cleared.currentStep).toBe("pre_declaration");
    expect(cleared.rounds).toEqual(advanced.rounds);
  });
});
