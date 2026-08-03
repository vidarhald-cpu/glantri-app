import { describe, expect, it } from "vitest";

import type {
  CombatResultGroupPresentation,
  CombatStepResultPresentation,
} from "@/features/combat-history";

import {
  createCombatRecentResultCandidate,
  resolveCombatRecentResultFocus,
  selectCombatRecentResultPresentation,
} from "./combatRecentResultFocus";

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
      summary: resultId,
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

describe("combat recent-result focus", () => {
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
  ] as const)("recognizes the meaningful result command %s", (commandType) => {
    expect(
      createCombatRecentResultCandidate({
        commandType,
        presentation: presentation([]),
        source: { participantId: "attacker", roundNumber: 1, step: "phase_1_actions" },
        sourceTaskId: `task:${commandType}`,
      }),
    ).toBeDefined();
  });

  it("focuses the newly accepted atomic result without requiring source selection to advance", () => {
    const candidate = createCombatRecentResultCandidate({
      commandType: "roll_attack",
      presentation: presentation([]),
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

    expect(
      resolveCombatRecentResultFocus({
        acceptedPresentation: accepted,
        acceptedRevision: "revision-2",
        candidate: candidate!,
      }),
    ).toMatchObject({
      acceptedRevision: "revision-2",
      focusId: "combat-recent-result:revision-2:group:attack",
      groupId: "group:attack",
      resultIds: ["result:attack"],
      sourceEventIds: ["event:attack"],
      status: "focused",
    });
  });

  it("allows same-cell Health feedback and ignores deterministic commands with no result", () => {
    const candidate = createCombatRecentResultCandidate({
      commandType: "roll_round_end_health_check",
      presentation: presentation([]),
      source: { participantId: "attacker", roundNumber: 1, step: "round_summary" },
      sourceTaskId: "task:health",
    });
    const accepted = presentation([
      group({
        groupId: "group:health",
        lastSequence: 3,
        resultIds: ["result:health"],
        sourceEventIds: ["event:health"],
      }),
    ]);

    expect(
      resolveCombatRecentResultFocus({
        acceptedPresentation: accepted,
        acceptedRevision: "revision-2",
        candidate: candidate!,
      }),
    ).toMatchObject({ groupId: "group:health" });
    expect(
      createCombatRecentResultCandidate({
        commandType: "advance_combat_boundary",
        presentation: accepted,
        source: { participantId: "attacker", roundNumber: 1, step: "round_summary" },
        sourceTaskId: "task:boundary",
      }),
    ).toBeUndefined();
  });

  it("selects only the immutable result and event identities when a group later grows", () => {
    const accepted = presentation([
      group({
        groupId: "group:attack-chain",
        lastSequence: 3,
        resultIds: ["result:attack"],
        sourceEventIds: ["event:attack"],
      }),
    ]);
    const candidate = createCombatRecentResultCandidate({
      commandType: "roll_attack",
      presentation: presentation([]),
      source: { participantId: "attacker", roundNumber: 1, step: "phase_1_actions" },
      sourceTaskId: "task:attack",
    });
    const focus = resolveCombatRecentResultFocus({
      acceptedPresentation: accepted,
      acceptedRevision: "revision-2",
      candidate: candidate!,
    });
    const later = presentation([
      group({
        groupId: "group:attack-chain",
        lastSequence: 5,
        resultIds: ["result:attack", "result:parry"],
        sourceEventIds: ["event:attack", "event:parry"],
      }),
    ]);

    const selected = selectCombatRecentResultPresentation({ focus: focus!, presentation: later });
    expect(selected?.groups?.[0]?.provenance.resultIds).toEqual(["result:attack"]);
    expect(selected?.groups?.[0]?.subordinateResults.map((result) => result.id)).toEqual([
      "result:attack",
    ]);
    expect(selected?.entries.map((entry) => entry.sourceEventIds)).toEqual([["event:attack"]]);
  });

  it("clears safely when the exact group is absent and never falls back to another result", () => {
    const focus = {
      acceptedRevision: "revision-2",
      commandType: "roll_attack" as const,
      createdFromTaskId: "task:attack",
      focusId: "focus:attack",
      groupId: "group:missing",
      groupingIdentitySource: "command" as const,
      resultIds: ["result:missing"],
      rootResultId: "result:missing",
      source: { participantId: "attacker", roundNumber: 1, step: "phase_1_actions" as const },
      sourceEventIds: ["event:missing"],
      status: "focused" as const,
    };
    const unrelated = presentation([
      group({
        groupId: "group:latest",
        lastSequence: 99,
        resultIds: ["result:latest"],
        sourceEventIds: ["event:latest"],
      }),
    ]);

    expect(
      selectCombatRecentResultPresentation({ focus, presentation: unrelated }),
    ).toBeUndefined();
  });
});
