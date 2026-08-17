import { describe, expect, it } from "vitest";

import { buildCombatBreakOffProposalId, combatBreakOffProposalSchema } from "./combatBreakOff";
import { makeDistancePairKey } from "./combatDistance";
import { buildCombatProgressionProjection } from "./combatProgressionProjection";
import {
  commitCombatRoundBreakOff,
  combatRoundStateSchema,
  getCombatBreakOffPairConsequence,
  getCombatRoundPhaseResolutionOrder,
  isCombatPairEngaged,
  recordCombatRoundAttackResult,
  recordCombatRoundBreakOffRoll,
  reviewCombatRoundBreakOff,
  undoLatestCombatRoundCommand,
  type CombatRoundState,
} from "./combatRoundManager";

const at = "2026-08-17T12:00:00.000Z";

function proposal(escapee: string, attacker: string) {
  return combatBreakOffProposalSchema.parse({
    attackerParticipantId: attacker,
    escapeeParticipantId: escapee,
    id: buildCombatBreakOffProposalId({
      attackerParticipantId: attacker,
      escapeeParticipantId: escapee,
      roundNumber: 1,
    }),
    pairKey: makeDistancePairKey(escapee, attacker),
    roundNumber: 1,
    status: "awaiting_gm_review",
  });
}

function state(proposals = [proposal("escapee", "attacker")]): CombatRoundState {
  return combatRoundStateSchema.parse({
    breakOffProposals: proposals,
    currentCursor: { participantId: "escapee", roundNumber: 1, step: "A1" },
    currentStep: "phase_1_actions",
    encounterId: "encounter-1",
    participants: [
      {
        declaration: { actionId: "attack_parry", roundNumber: 1, submittedBy: "gm" },
        initiatives: { phase1: { rolls: [6], total: 18 } },
        label: "Attacker",
        participantId: "attacker",
      },
      {
        declaration: { actionId: "break_off_engagement", roundNumber: 1, submittedBy: "player" },
        initiatives: { phase1: { rolls: [2], total: 2 } },
        label: "Escapee",
        participantId: "escapee",
      },
      {
        declaration: { actionId: "attack_parry", roundNumber: 1, submittedBy: "gm" },
        initiatives: { phase1: { rolls: [5], total: 15 } },
        label: "Second",
        participantId: "second",
      },
    ],
    phaseResolutionCursor: { participantId: "escapee", phase: "phase1", substep: "break_off" },
    phaseResolutionStatuses: { escapee: { phase1: { substep: "break_off" } } },
    roundNumber: 1,
  });
}

function roll(
  participantId: string,
  finalTotal: number,
  role: "break_off_escapee" | "break_off_attacker",
) {
  return {
    calculation: {
      baseSkill: 10,
      calculationId: `calc:${participantId}`,
      contestType: "break_off" as const,
      derivedIntegerAdjustment: 0,
      finalResult: finalTotal,
      governingStat: { id: "dex", label: "Dexterity", value: 10 },
      movementBurden: {
        carriedItems: [],
        completeness: "complete" as const,
        missingFacts: [],
        participantId,
        provenance: {
          carriedLoadSource: "scenario_equipment_snapshot" as const,
          formula: "themistogenes_movement_modifier_v1" as const,
          sourceRange: "Calculations!L39:S42" as const,
          workbook: "Themistogenes 1.07.xlsx" as const,
        },
        schemaVersion: 1 as const,
        sourceSnapshotId: `snapshot:${participantId}`,
        visibility: "owner_and_gm" as const,
      },
      openEndedDie: { openEndedD10s: [], rollD20: 10, rollTotal: finalTotal - 10 },
      participantId,
      percentageContributions: [],
      preDieTotal: 10,
      role,
      skill: { id: "dodge", label: "Dodge", totalXp: 0 },
      totalPercentageAdjustment: 0,
      visibility: "involved" as const,
      completeness: "complete" as const,
      missingContributionPoints: [],
    },
    finalTotal,
    id: `roll:${participantId}`,
    participantId,
    rolledAt: at,
  };
}

function resolvePair(
  initial: CombatRoundState,
  proposalId: string,
  escapeeTotal: number,
  attackerTotal: number,
) {
  let current = reviewCombatRoundBreakOff({
    attackerAdjustment: 0,
    command: { createdAt: at },
    escapeeAdjustment: 0,
    proposalId,
    state: initial,
  });
  current = recordCombatRoundBreakOffRoll({
    command: { createdAt: at },
    proposalId,
    result: roll("escapee", escapeeTotal, "break_off_escapee"),
    state: current,
  });
  const attacker = current.breakOffProposals.find(
    (entry) => entry.id === proposalId,
  )!.attackerParticipantId;
  current = recordCombatRoundBreakOffRoll({
    command: { createdAt: at },
    proposalId,
    result: roll(attacker, attackerTotal, "break_off_attacker"),
    state: current,
  });
  return commitCombatRoundBreakOff({ command: { createdAt: at }, proposalId, state: current });
}

describe("Break Off lifecycle", () => {
  it("projects the exact review task for the active pair", () => {
    const projection = buildCombatProgressionProjection(state());
    const tasks = projection.boundary.processes.flatMap((process) =>
      process.stages.flatMap((stage) => stage.tasks),
    );
    expect(
      tasks.map((task) => ({
        command: task.expectedCommand,
        identity: task.identity,
        kind: task.kind,
      })),
    ).toContainEqual(
      expect.objectContaining({ command: "review_break_off", kind: "break_off_review" }),
    );
  });
  it("resolves Break Off before faster ordinary attacks and disengages only on GM commit", () => {
    const initial = state();
    expect(getCombatRoundPhaseResolutionOrder({ phase: "phase1", state: initial })).toEqual([
      "escapee",
      "attacker",
      "second",
    ]);
    const proposalId = initial.breakOffProposals[0]!.id;
    let reviewed = reviewCombatRoundBreakOff({
      attackerAdjustment: -2,
      command: { createdAt: at },
      escapeeAdjustment: 1,
      notes: "The doorway blocks pursuit.",
      proposalId,
      state: initial,
    });
    reviewed = recordCombatRoundBreakOffRoll({
      command: { createdAt: at },
      proposalId,
      result: roll("escapee", 25, "break_off_escapee"),
      state: reviewed,
    });
    reviewed = recordCombatRoundBreakOffRoll({
      command: { createdAt: at },
      proposalId,
      result: roll("attacker", 20, "break_off_attacker"),
      state: reviewed,
    });
    expect(
      isCombatPairEngaged({
        participantAId: "escapee",
        participantBId: "attacker",
        state: reviewed,
      }),
    ).toBe(true);
    const committed = commitCombatRoundBreakOff({
      command: { createdAt: at },
      proposalId,
      state: reviewed,
    });
    expect(
      isCombatPairEngaged({
        participantAId: "escapee",
        participantBId: "attacker",
        state: committed,
      }),
    ).toBe(false);
    expect(
      getCombatBreakOffPairConsequence({
        attackerParticipantId: "attacker",
        defenderParticipantId: "escapee",
        state: committed,
      }),
    ).toEqual({ attackerObModifier: 0, defenderDbParryModifier: 0, disengaged: true });
  });

  it("handles two opponents independently and preserves failed-pair DB/Parry consequence", () => {
    const first = proposal("escapee", "attacker");
    const second = proposal("escapee", "second");
    let current = resolvePair(state([first, second]), first.id, 25, 20);
    current = resolvePair(current, second.id, 4, 25);
    expect(
      isCombatPairEngaged({
        participantAId: "escapee",
        participantBId: "attacker",
        state: current,
      }),
    ).toBe(false);
    expect(
      isCombatPairEngaged({ participantAId: "escapee", participantBId: "second", state: current }),
    ).toBe(true);
    expect(
      getCombatBreakOffPairConsequence({
        attackerParticipantId: "second",
        defenderParticipantId: "escapee",
        state: current,
      }),
    ).toMatchObject({ defenderDbParryModifier: -4, disengaged: false });
  });

  it("rejects a forged ordinary melee attack against a disengaged pair without mutation", () => {
    const initial = state();
    const committed = resolvePair(initial, initial.breakOffProposals[0]!.id, 25, 20);
    const before = JSON.stringify(committed);
    expect(() =>
      recordCombatRoundAttackResult({
        participantId: "attacker",
        result: {
          actionId: "attack_parry",
          attackerParticipantId: "attacker",
          defenderDb: 10,
          defenderParryModifier: 0,
          defenderParticipantId: "escapee",
          grazing: false,
          hit: false,
          kind: "attackRoll",
          lookupTotal: 5,
          marginOverMissThreshold: -5,
          ob: 10,
          openEndedD10s: [],
          phase: "phase1",
          rollD20: 5,
          rollTotal: 5,
          rolledAt: at,
          tableResult: "Miss",
          weaponName: "Sword",
          weaponSourceSlot: "primary",
        },
        state: committed,
        submittedBy: "gm",
      }),
    ).toThrow("disengaged");
    expect(JSON.stringify(committed)).toBe(before);
  });

  it("undoes the exact commit, engagement, cursor, and committed history event", () => {
    const initial = state();
    const proposalId = initial.breakOffProposals[0]!.id;
    const committed = resolvePair(initial, proposalId, 25, 20);
    const commitCommand = committed.commands.at(-1)!;
    expect(commitCommand.type).toBe("commit_break_off");
    expect(committed.engagements).toHaveLength(1);
    expect(committed.events.some((event) => event.commandId === commitCommand.id)).toBe(true);

    const undone = undoLatestCombatRoundCommand({ state: committed });
    expect(undone?.breakOffProposals[0]?.status).toBe("awaiting_commit");
    expect(undone?.engagements).toEqual(initial.engagements);
    expect(undone?.currentCursor).toEqual(commitCommand.beforeCursor);
    expect(undone?.events.some((event) => event.commandId === commitCommand.id)).toBe(false);
  });
});
