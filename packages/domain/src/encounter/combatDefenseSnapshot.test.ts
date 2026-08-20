import { describe, expect, it } from "vitest";

import {
  buildCombatRoundAttackRollResult,
  combatRoundStateSchema,
  getCombatRoundAttackResultById,
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
  eventSequence?: number;
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
    eventSequence: input.eventSequence,
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

  it("selects the third appended attack by canonical sequence when timestamps tie after reload", () => {
    const snapshots = [
      snapshot({
        attackId: "attack-z",
        attackOpportunityId: "opportunity-1",
        eventSequence: 7,
      }),
      snapshot({
        attackId: "attack-y",
        attackOpportunityId: "opportunity-2",
        eventSequence: 8,
      }),
      snapshot({
        attackId: "attack-a",
        attackOpportunityId: "opportunity-3",
        eventSequence: 9,
      }),
    ];
    const reloaded = snapshots.map((candidate) => combatDefenseSnapshotSchema.parse(candidate));

    expect(
      getLatestCombatDefenseSnapshot({
        defenderParticipantId: "defender",
        phase: "phase1",
        roundNumber: 1,
        snapshots: reloaded,
      })?.attackId,
    ).toBe("attack-a");
    expect(reloaded.map((candidate) => candidate.attackId)).toEqual([
      "attack-z",
      "attack-y",
      "attack-a",
    ]);
  });

  it.each([
    { label: "an existing hit", ob: 100, rollTotal: 20, defenderDb: 20, remainingDb: 0 },
    {
      label: "an existing high-DB miss",
      ob: 50,
      rollTotal: 20,
      defenderDb: 100,
      remainingDb: 3,
    },
  ])(
    "rebuilds $label from preserved melee roll inputs when ordinary Dodge is unavailable",
    ({ defenderDb, ob, remainingDb, rollTotal }) => {
      const initial = activeState();
      const attack = buildCombatRoundAttackRollResult({
        actionId: "attack_parry",
        attackOpportunityId: "opportunity-unaware",
        attackType: "melee",
        attackerParticipantId: "attacker",
        defenderDb,
        defenderParticipantId: "defender",
        ob,
        phase: "phase1",
        rollD20: rollTotal,
        rollTotal,
        rolledAt: "2026-08-18T09:59:00.000Z",
        weaponName: "Sword",
      });
      const awaitingDefense = recordCombatRoundAttackResult({
        command: {
          createdAt: attack.rolledAt,
          createdByUserId: "gm",
          facts: { defenderFlatDbAdjustment: remainingDb },
        },
        participantId: "attacker",
        result: attack,
        state: combatRoundStateSchema.parse({
          ...initial,
          currentCursor: { participantId: "attacker", roundNumber: 1, step: "A1" },
          currentStep: "phase_1_actions",
          phaseResolutionCursor: {
            participantId: "attacker",
            phase: "phase1",
            substep: "attack",
          },
        }),
        submittedBy: "gm",
      });
      const attackId = getCombatRoundAttackResultId({ result: attack, roundNumber: 1 });
      const committed = recordCombatRoundDefenseReview({
        command: { createdAt: reviewedAt, createdByUserId: "gm" },
        snapshot: snapshot({
          attackId,
          attackOpportunityId: "opportunity-unaware",
          aware: false,
        }),
        state: awaitingDefense,
      });
      const reviewed = getCombatRoundAttackResultById({
        attackResultId: attackId,
        state: committed,
      });

      expect(reviewed).toMatchObject({
        defenderDb: remainingDb,
        hit: true,
        ob,
        rollD20: rollTotal,
        rollTotal,
      });
      expect(committed.commands.at(-1)?.facts).toMatchObject({
        previousAttackResult: { defenderDb, hit: attack.hit },
        reviewedAttackResult: { defenderDb: remainingDb, hit: true },
      });

      const undone = undoLatestCombatRoundCommand({ state: committed });
      expect(
        undone && getCombatRoundAttackResultById({ attackResultId: attackId, state: undone }),
      ).toEqual(attack);
    },
  );

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
    expect(committed.defenseSnapshots[0]?.eventSequence).toBe(committed.events.at(-1)?.sequence);
    expect(getCombatRoundAttackResultById({ attackResultId: attackId, state: committed })).toEqual(
      attack,
    );
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
