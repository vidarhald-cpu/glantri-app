import { describe, expect, it } from "vitest";

import {
  buildCombatRoundAttackRollResult,
  combatRoundStateSchema,
  getCombatRoundAttackResultId,
  initializeCombatRoundState,
  recordCombatRoundAttackResult,
  recordCombatRoundDefenseReview,
  undoLatestCombatRoundCommand,
} from "./combatRoundManager";
import {
  buildCombatDefenseSnapshotId,
  combatDefenseSnapshotSchema,
  getLatestCombatDefenseSnapshot,
  type CombatDefenseSnapshot,
} from "./combatDefenseSnapshot";
import { encounterSessionSchema } from "./session";

const reviewedAt = "2026-08-18T10:00:00.000Z";

function snapshot(input: {
  attackId: string;
  attackOpportunityId: string;
  aware?: boolean;
  reviewedAt?: string;
}): CombatDefenseSnapshot {
  const aware = input.aware ?? true;
  return combatDefenseSnapshotSchema.parse({
    attackDirection: "front",
    attackerParticipantId: "attacker",
    attackId: input.attackId,
    attackOpportunityId: input.attackOpportunityId,
    aware,
    awarenessDefault: true,
    awarenessOverridden: !aware,
    defenderParticipantId: "defender",
    id: buildCombatDefenseSnapshotId(input.attackId),
    ordinaryDodgeAvailable: aware,
    phase: "phase1",
    reviewedAt: input.reviewedAt ?? reviewedAt,
    reviewedByUserId: "gm",
    roundNumber: 1,
    schemaVersion: 1,
    sources: [
      {
        decision: "default_included",
        included: true,
        itemId: "shield-item",
        itemRevision: "2026-08-18T09:00:00.000Z",
        kind: "shield",
        label: "Round shield",
        slot: "offHand",
        templateId: "shield-template",
      },
    ],
    status: "committed",
  });
}

function activeState() {
  return initializeCombatRoundState({
    encounter: encounterSessionSchema.parse({
      actionLog: [],
      createdAt: "2026-08-18T09:00:00.000Z",
      currentRound: 1,
      currentTurnIndex: 0,
      declarationsLocked: false,
      id: "encounter",
      kind: "combat",
      participants: [
        { id: "attacker", label: "Attacker", order: 0, participantType: "scenario" },
        { id: "defender", label: "Defender", order: 1, participantType: "scenario" },
      ],
      status: "active",
      title: "Defense review",
      turnOrderMode: "manual",
      updatedAt: "2026-08-18T09:00:00.000Z",
    }),
  });
}

describe("combat defense snapshots", () => {
  it("rejects awareness snapshots whose ordinary Dodge availability disagrees", () => {
    expect(() =>
      combatDefenseSnapshotSchema.parse({
        ...snapshot({ attackId: "attack-1", attackOpportunityId: "opportunity-1" }),
        aware: false,
        ordinaryDodgeAvailable: true,
      }),
    ).toThrow(/ordinary Dodge availability/i);
  });

  it("projects the latest committed snapshot without overwriting attack history", () => {
    const first = snapshot({
      attackId: "attack-1",
      attackOpportunityId: "opportunity-1",
      reviewedAt: "2026-08-18T10:00:00.000Z",
    });
    const second = snapshot({
      attackId: "attack-2",
      attackOpportunityId: "opportunity-2",
      reviewedAt: "2026-08-18T10:01:00.000Z",
    });

    expect(
      getLatestCombatDefenseSnapshot({
        defenderParticipantId: "defender",
        phase: "phase1",
        roundNumber: 1,
        snapshots: [first, second],
      }),
    ).toEqual(second);
    expect([first, second]).toHaveLength(2);
  });

  it("links one exact attack snapshot and restores the defense task on undo", () => {
    const initial = activeState();
    const attack = buildCombatRoundAttackRollResult({
      actionId: "attack_parry",
      attackOpportunityId: "opportunity-1",
      attackerParticipantId: "attacker",
      defenderDb: 5,
      defenderParticipantId: "defender",
      ob: 5,
      phase: "phase1",
      rollD20: 4,
      rollTotal: 4,
      rolledAt: "2026-08-18T09:59:00.000Z",
      weaponName: "Sword",
    });
    const readyToAttack = combatRoundStateSchema.parse({
      ...initial,
      currentCursor: { participantId: "attacker", roundNumber: 1, step: "A1" },
      currentStep: "phase_1_actions",
      phaseResolutionCursor: {
        participantId: "attacker",
        phase: "phase1",
        substep: "attack",
      },
    });
    const awaitingDefense = recordCombatRoundAttackResult({
      command: { createdAt: attack.rolledAt, createdByUserId: "gm" },
      participantId: "attacker",
      result: attack,
      state: readyToAttack,
      submittedBy: "gm",
    });
    const attackId = getCombatRoundAttackResultId({ result: attack, roundNumber: 1 });
    const committed = recordCombatRoundDefenseReview({
      command: { createdAt: reviewedAt, createdByUserId: "gm" },
      snapshot: snapshot({ attackId, attackOpportunityId: "opportunity-1" }),
      state: awaitingDefense,
    });

    expect(committed.defenseSnapshots).toHaveLength(1);
    expect(committed.phaseResolutionResults).toEqual(
      expect.arrayContaining([expect.objectContaining({ attackResultId: attackId })]),
    );

    const undone = undoLatestCombatRoundCommand({ state: committed });
    expect(undone?.defenseSnapshots).toEqual([]);
    expect(undone?.phaseResolutionCursor).toEqual({
      participantId: "defender",
      phase: "phase1",
      substep: "defense",
    });
  });
});
