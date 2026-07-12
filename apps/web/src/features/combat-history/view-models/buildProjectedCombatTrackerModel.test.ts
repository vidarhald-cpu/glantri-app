import type {
  CombatHistoryProjection,
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

function snapshot(): ProjectedCombatHistorySnapshot {
  return {
    completeness: "complete",
    id: "snapshot-1",
    panels: { actionResult: {}, actionSelector: {}, modifiers: {}, phase1: {}, phase2: {} },
    participant: { displayName: "Aria", participantId: "aria" },
    roundNumber: 1,
    step: "phase_1_actions",
  };
}

function history(events: ProjectedCombatHistoryEvent[]): CombatHistoryProjection {
  return {
    activeRound: { events, roundNumber: 1, snapshots: [snapshot()] },
    archivedRounds: [],
    rows: [{ displayName: "Aria", participantId: "aria" }],
  };
}

describe("buildProjectedCombatTrackerModel", () => {
  it("builds the shared tracker model using projected rows and cell events", () => {
    const projection = history([event({ facts: { publicOutcome: { grazing: true } } })]);
    const model = buildProjectedCombatTrackerModel({
      currentTask: { participantId: "aria", roundNumber: 1, step: "phase_1_actions" },
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
});
