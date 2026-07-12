import { describe, expect, it } from "vitest";

import type { ProjectedCombatHistoryEvent } from "@glantri/domain";

import { buildCombatEventResultModel } from "./buildCombatEventResultModel";

function event(
  type: ProjectedCombatHistoryEvent["type"],
  sequence: number,
  overrides: Partial<ProjectedCombatHistoryEvent> = {},
): ProjectedCombatHistoryEvent {
  return {
    completeness: "complete",
    facts: { publicOutcome: {} },
    id: `${sequence}:${type}`,
    identities: [],
    missingFacts: [],
    occurredAt: null,
    roundNumber: 1,
    sequence,
    status: "recorded",
    step: "phase_1_actions",
    type,
    ...overrides,
  };
}

describe("buildCombatEventResultModel", () => {
  it("orders attack, parry, location, critical, and damage without collapsing the chain", () => {
    const model = buildCombatEventResultModel([
      event("damage_committed", 5),
      event("parry", 2, {
        facts: {
          involvedOutcome: { success: false },
          privateCalculation: { rollD20: 8, total: 17 },
          publicOutcome: {},
        },
        identities: [
          { displayName: "Scyrian cavalry guy", participantId: "attacker", role: "attacker", visibility: "visible" },
          { displayName: "The Gladiator", participantId: "defender", role: "defender", visibility: "visible" },
        ],
      }),
      event("attack", 1, {
        facts: {
          involvedOutcome: { tableResult: "Grazing hit" },
          privateCalculation: { rollD20: 18, total: 24 },
          publicOutcome: {},
        },
        identities: [
          { displayName: "Scyrian cavalry guy", participantId: "attacker", role: "attacker", visibility: "visible" },
          { displayName: "The Gladiator", participantId: "defender", role: "defender", visibility: "visible" },
        ],
      }),
      event("critical", 4),
      event("hit_location", 3),
    ]);

    expect(model.items.map((item) => item.type)).toEqual([
      "attack",
      "parry",
      "hit_location",
      "critical",
      "damage_committed",
    ]);
    expect(model.items[0]?.summary).toBe("Scyrian cavalry guy attacked The Gladiator.");
    expect(model.items[1]?.summary).toBe(
      "The Gladiator attempted to parry Scyrian cavalry guy.",
    );
    expect(model.items[0]?.calculationRows.map((row) => row.text)).toContain("Roll D20: 18");
    expect(model.items[1]?.calculationRows.map((row) => row.text)).toContain("Roll D20: 8");
  });

  it("orders distance rolls before result and applied distance", () => {
    const model = buildCombatEventResultModel([
      event("distance_control_applied", 4),
      event("distance_control_roll", 1),
      event("distance_control_result", 3),
      event("distance_control_roll", 2),
    ]);

    expect(model.items.map((item) => item.type)).toEqual([
      "distance_control_roll",
      "distance_control_roll",
      "distance_control_result",
      "distance_control_applied",
    ]);
  });

  it("labels incomplete and legacy-derived events", () => {
    const model = buildCombatEventResultModel([
      event("attack", 1, { completeness: "incomplete" }),
      event("parry", 2, { completeness: "legacy_derived" }),
    ]);

    expect(model.items.map((item) => item.completenessLabel)).toEqual([
      "Incomplete history",
      "Legacy-derived history",
    ]);
  });

  it("assigns contextual keys without collapsing identical rendered facts", () => {
    const model = buildCombatEventResultModel([
      event("attack", 1, {
        facts: {
          involvedOutcome: { hit: false },
          privateCalculation: { hit: false },
          publicOutcome: { hit: false },
        },
      }),
      event("parry", 2, { facts: { publicOutcome: { hit: false } } }),
    ]);
    const rows = model.items.flatMap((item) => [...item.outcomeRows, ...item.calculationRows]);

    expect(rows.map((row) => row.text)).toEqual(["Hit: No", "Hit: No", "Hit: No", "Hit: No"]);
    expect(new Set(rows.map((row) => row.key)).size).toBe(rows.length);
    expect(model.items.map((item) => item.type)).toEqual(["attack", "parry"]);
  });
});
