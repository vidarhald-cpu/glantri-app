import { describe, expect, it } from "vitest";

import type {
  CombatResultGroupPresentation,
  CombatStepResultPresentation,
} from "@/features/combat-history";

import {
  createCombatPostResultHoldCandidate,
  isCombatPostResultHoldSourceSelection,
  resolveCombatPostResultHold,
  selectCombatPostResultHoldPresentation,
} from "./combatPostResultHold";

function group(input: {
  groupId: string;
  lastSequence: number;
  resultIds: readonly string[];
  sourceEventIds: readonly string[];
}): CombatResultGroupPresentation {
  return {
    calculationReferences: [],
    committedConsequences: [],
    completeness: "complete",
    firstSequence: input.lastSequence,
    groupId: input.groupId,
    heading: "Attack",
    lastSequence: input.lastSequence,
    provenance: {
      groupingIdentitySource: "action_instance",
      resultIds: input.resultIds,
      sourceEventIds: input.sourceEventIds,
    },
    publicCombatNotes: [],
    rootResultId: input.resultIds[0]!,
    standardConsequences: [],
    subordinateResults: input.resultIds.map((resultId, index) => ({
      calculations: [],
      heading: "Attack",
      id: resultId,
      outcomeRows: [],
      resultEnvelopes: [
        {
          actionType: "attack",
          affectedParticipants: [],
          calculationReferences: [],
          committedConsequences: [],
          conciseOutcome: { details: [], label: "Attack" },
          participants: [],
          privateDiagnostics: [],
          provenance: {
            completeness: "complete",
            occurredAt: null,
            sourceIds: [],
            sourceKind: "canonical",
          },
          resultId,
          round: 1,
          schemaVersion: 1,
          sequence: input.lastSequence + index,
          standardConsequences: [],
          step: "phase_1_actions",
          subordinateEventReferences: [],
          targets: [],
          visibility: {
            calculationAccess: "full",
            outcomeScope: "public",
            privateDiagnosticsIncluded: false,
          },
        },
      ],
      sequence: input.lastSequence + index,
      sourceEventIds: [input.sourceEventIds[index] ?? input.sourceEventIds[0]!],
      state: "final",
      summary: "Attack",
    })),
    targets: [],
    visibility: [
      {
        calculationAccess: "full",
        outcomeScope: "public",
        privateDiagnosticsIncluded: false,
      },
    ],
  };
}

function presentation(
  groups: readonly CombatResultGroupPresentation[],
): CombatStepResultPresentation {
  return {
    boundary: "phase1_resolution",
    emptyState: "No results.",
    encounterId: "encounter-1",
    encounterRevision: "revision-1",
    entries: groups.flatMap((candidate) =>
      candidate.provenance.sourceEventIds.map((eventId) => ({
        calculations: [],
        category: "attack" as const,
        heading: candidate.heading,
        id: `entry:${eventId}`,
        sourceEventIds: [eventId],
        state: "final" as const,
        summary: candidate.heading,
      })),
    ),
    groups,
    participantId: "attacker",
    phase: "phase1",
    roundNumber: 1,
  };
}

describe("combat post-result inspection hold", () => {
  it.each([
    "roll_initiative_phase1",
    "roll_combat_experience",
    "roll_attack",
    "roll_parry",
    "roll_hit_location",
    "roll_critical",
    "resolve_damage",
    "commit_phase_damage",
    "roll_feint",
    "commit_feint_result",
    "roll_adjust_distance",
    "commit_adjust_distance",
    "roll_offensive_parry_brawling",
    "roll_continued_contact_maintenance",
    "roll_observation",
    "roll_round_end_health_check",
    "roll_round_end_distance_control",
  ] as const)("recognizes the audited result-producing command %s", (commandType) => {
    expect(
      createCombatPostResultHoldCandidate({
        commandType,
        presentation: presentation([]),
        source: { participantId: "attacker", roundNumber: 1, step: "phase_1_actions" },
        sourceTaskId: `task:${commandType}`,
      }),
    ).toBeDefined();
  });

  it("identifies a newly accepted atomic result group in the exact source cell", () => {
    const before = presentation([]);
    const candidate = createCombatPostResultHoldCandidate({
      commandType: "roll_attack",
      presentation: before,
      source: { participantId: "attacker", roundNumber: 1, step: "phase_1_actions" },
      sourceTaskId: "task:attack",
    });
    const accepted = presentation([
      group({
        groupId: "group:attack",
        lastSequence: 4,
        resultIds: ["result:attack"],
        sourceEventIds: ["event:attack"],
      }),
    ]);

    const hold = resolveCombatPostResultHold({
      acceptedPresentation: accepted,
      acceptedRevision: "revision-2",
      candidate: candidate!,
      nextSelection: { participantId: "defender", step: "review_phase_2_actions" },
    });

    expect(hold).toMatchObject({
      acceptedRevision: "revision-2",
      groupId: "group:attack",
      resultIds: ["result:attack"],
      rootResultId: "result:attack",
      sourceEventIds: ["event:attack"],
    });
  });

  it("detects a new subordinate result appended to an existing atomic group", () => {
    const original = group({
      groupId: "group:damage-chain",
      lastSequence: 4,
      resultIds: ["result:attack"],
      sourceEventIds: ["event:attack"],
    });
    const candidate = createCombatPostResultHoldCandidate({
      commandType: "commit_phase_damage",
      presentation: presentation([original]),
      source: { participantId: "attacker", roundNumber: 1, step: "phase_1_damage" },
      sourceTaskId: "task:damage",
    });
    const accepted = presentation([
      {
        ...original,
        lastSequence: 8,
        provenance: {
          ...original.provenance,
          resultIds: ["result:attack", "result:damage"],
          sourceEventIds: ["event:attack", "event:damage"],
        },
      },
    ]);

    expect(
      resolveCombatPostResultHold({
        acceptedPresentation: accepted,
        acceptedRevision: "revision-2",
        candidate: candidate!,
        nextSelection: { participantId: "next", step: "phase_1_actions" },
      }),
    ).toMatchObject({ groupId: "group:damage-chain" });
  });

  it("does not hold same-cell internal damage substates or commands without exact results", () => {
    const candidate = createCombatPostResultHoldCandidate({
      commandType: "roll_hit_location",
      presentation: presentation([]),
      source: { participantId: "attacker", roundNumber: 1, step: "phase_1_damage" },
      sourceTaskId: "task:hit-location",
    });
    const accepted = presentation([
      group({
        groupId: "group:damage",
        lastSequence: 2,
        resultIds: ["result:location"],
        sourceEventIds: ["event:location"],
      }),
    ]);

    expect(
      resolveCombatPostResultHold({
        acceptedPresentation: accepted,
        acceptedRevision: "revision-2",
        candidate: candidate!,
        nextSelection: { participantId: "attacker", step: "phase_1_damage" },
      }),
    ).toBeUndefined();
    expect(
      createCombatPostResultHoldCandidate({
        commandType: "advance_combat_boundary",
        presentation: accepted,
        source: { participantId: "attacker", roundNumber: 1, step: "phase_1_damage" },
        sourceTaskId: "task:boundary",
      }),
    ).toBeUndefined();
  });

  it("holds Health checks in the same SU cell and filters the exact result group", () => {
    const candidate = createCombatPostResultHoldCandidate({
      commandType: "roll_round_end_health_check",
      presentation: presentation([]),
      source: { participantId: "attacker", roundNumber: 1, step: "round_summary" },
      sourceTaskId: "task:health",
    });
    const other = group({
      groupId: "group:older",
      lastSequence: 1,
      resultIds: ["result:older"],
      sourceEventIds: ["event:older"],
    });
    const health = group({
      groupId: "group:health",
      lastSequence: 3,
      resultIds: ["result:health"],
      sourceEventIds: ["event:health"],
    });
    const accepted = presentation([other, health]);
    const hold = resolveCombatPostResultHold({
      acceptedPresentation: accepted,
      acceptedRevision: "revision-2",
      candidate: candidate!,
      nextSelection: { participantId: "attacker", step: "round_summary" },
    });
    const heldPresentation = selectCombatPostResultHoldPresentation({
      hold: hold!,
      presentation: accepted,
    });

    expect(heldPresentation?.groups?.map((candidate) => candidate.groupId)).toEqual([
      "group:health",
    ]);
    expect(heldPresentation?.entries.map((entry) => entry.sourceEventIds)).toEqual([
      ["event:health"],
    ]);
  });

  it("keeps the accepted subordinate results exact when the atomic group later grows", () => {
    const accepted = group({
      groupId: "group:attack-chain",
      lastSequence: 3,
      resultIds: ["result:attack"],
      sourceEventIds: ["event:attack"],
    });
    const hold = {
      acceptedRevision: "revision-2",
      commandType: "roll_attack" as const,
      createdFromTaskId: "task:attack",
      groupId: accepted.groupId,
      holdId: "hold:attack",
      resultIds: accepted.provenance.resultIds,
      rootResultId: accepted.rootResultId,
      source: { participantId: "attacker", roundNumber: 1, step: "phase_1_actions" as const },
      sourceEventIds: accepted.provenance.sourceEventIds,
      status: "active" as const,
    };
    const later = group({
      groupId: accepted.groupId,
      lastSequence: 3,
      resultIds: ["result:attack", "result:parry"],
      sourceEventIds: ["event:attack", "event:parry"],
    });

    const heldPresentation = selectCombatPostResultHoldPresentation({
      hold,
      presentation: presentation([later]),
    });

    expect(heldPresentation?.groups?.[0]?.provenance.resultIds).toEqual(["result:attack"]);
    expect(heldPresentation?.groups?.[0]?.subordinateResults.map((result) => result.id)).toEqual([
      "result:attack",
    ]);
    expect(heldPresentation?.entries.map((entry) => entry.sourceEventIds)).toEqual([
      ["event:attack"],
    ]);
  });

  it("matches only the exact held source selection", () => {
    const hold = {
      acceptedRevision: "revision-2",
      commandType: "roll_attack" as const,
      createdFromTaskId: "task:attack",
      groupId: "group:attack",
      holdId: "hold:attack",
      resultIds: ["result:attack"],
      rootResultId: "result:attack",
      source: { participantId: "attacker", roundNumber: 1, step: "phase_1_actions" as const },
      sourceEventIds: ["event:attack"],
      status: "active" as const,
    };

    expect(
      isCombatPostResultHoldSourceSelection({
        hold,
        participantId: "attacker",
        roundNumber: 1,
        step: "phase_1_actions",
      }),
    ).toBe(true);
    expect(
      isCombatPostResultHoldSourceSelection({
        hold,
        participantId: "defender",
        roundNumber: 1,
        step: "review_phase_2_actions",
      }),
    ).toBe(false);
    expect(
      selectCombatPostResultHoldPresentation({
        hold,
        presentation: presentation([]),
      }),
    ).toBeUndefined();
  });
});
