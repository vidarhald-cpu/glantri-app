import { describe, expect, it } from "vitest";

import type { CombatResultEnvelope } from "@glantri/domain";

import {
  buildCombatResultGroups,
  type CombatResultLedgerFragmentInput,
} from "./combatResultLedgerPresentation";

function envelope(input: {
  actionInstanceId?: string;
  actionType?: CombatResultEnvelope["actionType"];
  note?: string;
  resultId: string;
  sequence: number;
}): CombatResultEnvelope {
  return {
    actionInstanceId: input.actionInstanceId,
    actionType: input.actionType ?? "feint_roll",
    affectedParticipants: [],
    calculationReferences: [],
    committedConsequences: [],
    conciseOutcome: { details: [], label: "Result" },
    participants: [],
    privateDiagnostics: [],
    provenance: {
      completeness: "complete",
      occurredAt: null,
      sourceIds: [],
      sourceKind: "canonical",
    },
    publicCombatNote: input.note,
    resultId: input.resultId,
    round: 2,
    schemaVersion: 1,
    sequence: input.sequence,
    standardConsequences: [],
    step: "phase_1_actions",
    subordinateEventReferences: [],
    targets: [],
    visibility: {
      calculationAccess: "full",
      outcomeScope: "involved",
      privateDiagnosticsIncluded: false,
    },
  };
}

function fragment(input: {
  actionInstanceId?: string;
  calculationId?: string;
  id: string;
  note?: string;
  sequence: number;
  type?: CombatResultEnvelope["actionType"];
}): CombatResultLedgerFragmentInput {
  const resultEnvelope = envelope({
    actionInstanceId: input.actionInstanceId,
    actionType: input.type,
    note: input.note,
    resultId: input.id,
    sequence: input.sequence,
  });
  return {
    result: {
      calculations: input.calculationId
        ? [
            {
              calculationId: input.calculationId,
              calculationType: "feint",
              completeness: "complete",
              derivedValues: [],
              finalResult: { label: "Result", value: 20 },
              label: "Feint",
              missingFacts: [],
              modifiers: [],
              preDieTotal: { label: "Skill total", value: 12 },
              visibility: "gm_full",
            },
          ]
        : [],
      heading: "Feint",
      id: input.id,
      outcomeRows: [],
      resultEnvelopes: [resultEnvelope],
      sequence: input.sequence,
      sourceEventIds: [input.id],
      state: "final",
      summary: input.id,
    },
  };
}

describe("atomic combat result ledger", () => {
  it("groups one action into one stable top-level result in canonical subordinate order", () => {
    const groups = buildCombatResultGroups([
      fragment({ actionInstanceId: "feint-1", id: "commit", note: "Public note", sequence: 4 }),
      fragment({ actionInstanceId: "feint-1", id: "attacker-roll", sequence: 1 }),
      fragment({ actionInstanceId: "feint-1", id: "defender-roll", sequence: 2 }),
      fragment({ actionInstanceId: "feint-1", id: "opposed-result", sequence: 3 }),
    ]);

    expect(groups).toHaveLength(1);
    expect(groups[0]).toMatchObject({
      actionInstanceId: "feint-1",
      firstSequence: 1,
      groupId: "combat-result-group:action:feint-1",
      lastSequence: 4,
      publicCombatNotes: ["Public note"],
      rootResultId: "attacker-roll",
    });
    expect(groups[0]?.subordinateResults.map((result) => result.id)).toEqual([
      "attacker-roll",
      "defender-roll",
      "opposed-result",
      "commit",
    ]);
  });

  it("does not merge adjacent legacy events without a shared canonical identity", () => {
    const groups = buildCombatResultGroups([
      fragment({ id: "first", sequence: 1 }),
      fragment({ id: "second", sequence: 2 }),
    ]);

    expect(groups.map((group) => group.groupId)).toEqual([
      "combat-result-group:first",
      "combat-result-group:second",
    ]);
  });

  it("preserves true event interleaving as separate visible segments", () => {
    const groups = buildCombatResultGroups([
      fragment({ actionInstanceId: "action-a", id: "a-1", sequence: 1 }),
      fragment({ actionInstanceId: "action-b", id: "b-1", sequence: 2 }),
      fragment({ actionInstanceId: "action-a", id: "a-2", sequence: 3 }),
    ]);

    expect(groups.map((group) => group.groupId)).toEqual([
      "combat-result-group:action:action-a",
      "combat-result-group:action:action-b",
      "combat-result-group:action:action-a:segment:3",
    ]);
    expect(groups[0]?.completeness).toBe("interleaved");
    expect(groups[2]?.completeness).toBe("interleaved");
  });

  it("renders a calculation only once when later fragments reference the same snapshot", () => {
    const groups = buildCombatResultGroups([
      fragment({
        actionInstanceId: "feint-1",
        calculationId: "roll-1",
        id: "roll",
        sequence: 1,
      }),
      fragment({
        actionInstanceId: "feint-1",
        calculationId: "roll-1",
        id: "commit",
        sequence: 2,
      }),
    ]);

    expect(groups[0]?.subordinateResults.flatMap((result) => result.calculations)).toHaveLength(1);
  });

  it("keeps attack/parry and the later damage review as two causally related processes", () => {
    const groups = buildCombatResultGroups([
      fragment({
        actionInstanceId: "attack-1",
        id: "attack",
        sequence: 1,
        type: "attack",
      }),
      fragment({
        actionInstanceId: "attack-1",
        id: "parry",
        sequence: 2,
        type: "parry",
      }),
      fragment({
        actionInstanceId: "attack-1:damage",
        id: "hit-location",
        sequence: 3,
        type: "hit_location",
      }),
      fragment({
        actionInstanceId: "attack-1:damage",
        id: "critical",
        sequence: 4,
        type: "critical",
      }),
      fragment({
        actionInstanceId: "attack-1:damage",
        id: "damage",
        sequence: 5,
        type: "damage_committed",
      }),
    ]);

    expect(groups).toHaveLength(2);
    expect(groups[0]?.subordinateResults.map((result) => result.id)).toEqual(["attack", "parry"]);
    expect(groups[1]?.subordinateResults.map((result) => result.id)).toEqual([
      "hit-location",
      "critical",
      "damage",
    ]);
  });

  it("keeps a group identity stable when undo removes and later restores its last event", () => {
    const roll = fragment({
      actionInstanceId: "feint-1",
      id: "roll",
      sequence: 1,
    });
    const result = fragment({
      actionInstanceId: "feint-1",
      id: "result",
      sequence: 2,
    });
    const committed = buildCombatResultGroups([roll, result]);
    const undone = buildCombatResultGroups([roll]);
    const restored = buildCombatResultGroups([roll, result]);

    expect(undone[0]?.groupId).toBe(committed[0]?.groupId);
    expect(restored).toEqual(committed);
    expect(undone[0]?.subordinateResults.map((entry) => entry.id)).toEqual(["roll"]);
  });
});
