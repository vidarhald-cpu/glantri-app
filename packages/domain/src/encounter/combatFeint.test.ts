import { describe, expect, it } from "vitest";

import { scenarioParticipantCombatContextSchema } from "../campaign/scenario";
import {
  applyCommittedCombatFeintModifiers,
  buildCombatFeintProposalId,
  combatFeintProposalSchema,
  expireCombatFeintGeneratedModifiersBeforeRound,
} from "./combatFeint";
import {
  combatRoundStateSchema,
  commitCombatRoundFeintResult,
  getCombatRoundParticipantPhaseStepStatus,
  getCombatRoundPhaseAttackCandidates,
  initializeCombatRoundPhaseResolutionCursor,
  recordCombatRoundFeintRoll,
  reviewCombatRoundFeintFeasibility,
  setCombatRoundParticipantInitiative,
  undoLatestCombatRoundCommand,
} from "./combatRoundManager";
import {
  getMergedCombatDbParryModifierTotal,
  getMergedCombatSkillObModifierTotal,
} from "./combatModifierProjection";

const createdAt = "2026-07-15T12:00:00.000Z";

function proposal(status: "awaiting_feasibility" | "committed" = "awaiting_feasibility") {
  return combatFeintProposalSchema.parse({
    attackerParticipantId: "attacker",
    attackerSkillId: "dodge",
    attackerSkillLabel: "Dodge",
    defenderParticipantId: "defender",
    defenderSkillId: "sword",
    defenderSkillLabel: "Sword",
    feasibility: status === "committed" ? "possible" : "pending",
    id: buildCombatFeintProposalId({ attackerParticipantId: "attacker", roundNumber: 1 }),
    method: "movement",
    pairId: "pair-1",
    phase1OpportunityId: "feint-1",
    phase2AttackOpportunityId: "attack-2",
    review:
      status === "committed"
        ? {
            proposedAttackerDbParryModifier: -1,
            proposedDefenderObDbModifier: -2,
          }
        : undefined,
    roundNumber: 1,
    status,
  });
}

function state() {
  const declaration = {
    actionId: "feint_attack",
    attackOpportunities: [
      {
        id: "attack-2",
        origin: "feint_attack",
        phase: "phase2",
        slot: "attack_2",
        status: "committed",
        targetParticipantId: "defender",
      },
    ],
    combatContext: {},
    phaseContexts: {
      phase1: { targetParticipantId: "defender" },
      phase2: { targetParticipantId: "defender" },
    },
    roundNumber: 1,
    submittedBy: "gm",
  } as const;
  return combatRoundStateSchema.parse({
    encounterId: "encounter-1",
    currentCursor: { participantId: "attacker", roundNumber: 1, step: "A1" },
    currentStep: "phase_1_actions",
    feintProposals: [proposal()],
    participants: [
      { attackResults: {}, declaration, label: "Attacker", participantId: "attacker" },
      {
        attackResults: {},
        declaration: {
          actionId: "single_attack",
          combatContext: {},
          roundNumber: 1,
          submittedBy: "gm",
        },
        label: "Defender",
        participantId: "defender",
      },
    ],
    roundNumber: 1,
    selectedParticipantId: "attacker",
    selectedStep: "phase_1_actions",
  });
}

describe("combat feint modifiers", () => {
  it("creates separate phase-scoped rows and replaces only the proposal rows", () => {
    const committed = proposal("committed");
    const existing = scenarioParticipantCombatContextSchema.parse({
      modifierBuckets: {
        situationDb: [{ id: "manual-db", value: 3 }],
        situationObSkill: [{ id: "manual-ob", value: 2 }],
      },
    });
    const first = applyCommittedCombatFeintModifiers({
      attackerCombatContext: existing,
      defenderCombatContext: existing,
      proposal: committed,
    });
    const second = applyCommittedCombatFeintModifiers({
      attackerCombatContext: first.attackerCombatContext,
      defenderCombatContext: first.defenderCombatContext,
      proposal: committed,
    });

    expect(second.attackerCombatContext.modifierBuckets.situationDb).toHaveLength(2);
    expect(second.defenderCombatContext.modifierBuckets.situationDb).toHaveLength(2);
    expect(second.defenderCombatContext.modifierBuckets.situationObSkill).toHaveLength(2);
    expect(second.modifierIds).toHaveLength(3);
    expect(second.defenderCombatContext.modifierBuckets.situationObSkill.at(-1)).toMatchObject({
      expiresAtRound: 1,
      sourcePhase: "phase2",
      value: -2,
    });
    expect(
      getMergedCombatDbParryModifierTotal({
        combatContext: second.attackerCombatContext,
        phase: "phase1",
      }),
    ).toBe(2);
    expect(
      getMergedCombatDbParryModifierTotal({
        combatContext: second.attackerCombatContext,
        phase: "phase2",
      }),
    ).toBe(3);
    expect(
      getMergedCombatSkillObModifierTotal({
        combatContext: second.defenderCombatContext,
        phase: "phase1",
      }),
    ).toBe(2);
    expect(
      getMergedCombatSkillObModifierTotal({
        combatContext: second.defenderCombatContext,
        phase: "phase2",
      }),
    ).toBe(0);
  });

  it("retains zero table consequences without creating zero-valued live modifiers", () => {
    const committed = combatFeintProposalSchema.parse({
      ...proposal("committed"),
      review: {
        proposedAttackerDbParryModifier: 0,
        proposedDefenderObDbModifier: -2,
      },
    });
    const applied = applyCommittedCombatFeintModifiers({ proposal: committed });

    expect(applied.attackerCombatContext.modifierBuckets.situationDb).toEqual([]);
    expect(applied.defenderCombatContext.modifierBuckets.situationObSkill).toEqual([
      expect.objectContaining({ value: -2 }),
    ]);
    expect(applied.defenderCombatContext.modifierBuckets.situationDb).toEqual([
      expect.objectContaining({ value: -2 }),
    ]);
    expect(applied.modifierIds).toHaveLength(2);
    expect(committed.review).toEqual({
      proposedAttackerDbParryModifier: 0,
      proposedDefenderObDbModifier: -2,
    });
  });

  it("expires prior-round Feint rows without removing unrelated rows", () => {
    const committed = applyCommittedCombatFeintModifiers({
      attackerCombatContext: {
        modifierBuckets: {
          general: [
            {
              id: "imported",
              imported: true,
              scope: "until",
              sourceType: "character_effect",
              value: 2,
            },
          ],
          situationDb: [{ id: "manual-db", scope: "until", value: 3 }],
          situationInitiative: [],
          situationObSkill: [],
        },
      },
      defenderCombatContext: undefined,
      proposal: proposal("committed"),
    });

    const nextRound = expireCombatFeintGeneratedModifiersBeforeRound(
      committed.attackerCombatContext,
      2,
    );

    expect(nextRound.modifierBuckets.situationDb).toEqual([
      { id: "manual-db", scope: "until", value: 3 },
    ]);
    expect(nextRound.modifierBuckets.general).toHaveLength(1);
  });
});

describe("combat feint lifecycle", () => {
  it("opens Feint rolls only when the initiative-ordered A1 cursor reaches the actor", () => {
    const base = state();
    const actionTurnState = combatRoundStateSchema.parse({
      ...base,
      feintProposals: [
        {
          ...base.feintProposals[0],
          status: "awaiting_action_turn",
        },
      ],
      participants: base.participants.map((participant) =>
        participant.participantId === "defender"
          ? {
              ...participant,
              declaration: {
                actionId: "observe_opponent",
                combatContext: {},
                roundNumber: 1,
                submittedBy: "gm",
              },
            }
          : participant,
      ),
    });
    const withInitiative = setCombatRoundParticipantInitiative({
      initiative: { baseInitiative: 0, modifierAdjustment: 0, rolls: [4], rollTotal: 4, total: 4 },
      participantId: "defender",
      phase: "phase1",
      state: setCombatRoundParticipantInitiative({
        initiative: {
          baseInitiative: 0,
          modifierAdjustment: 0,
          rolls: [5],
          rollTotal: 5,
          total: 5,
        },
        participantId: "attacker",
        phase: "phase1",
        state: actionTurnState,
      }),
    });
    const opened = initializeCombatRoundPhaseResolutionCursor({
      phase: "phase1",
      state: withInitiative,
      updatedAt: createdAt,
    });

    expect(opened.phaseResolutionCursor).toEqual({
      participantId: "attacker",
      phase: "phase1",
      substep: "feint",
    });
    expect(opened.feintProposals[0]?.status).toBe("awaiting_rolls");
    expect(
      getCombatRoundParticipantPhaseStepStatus({
        participantId: "defender",
        state: opened,
        step: "phase_1_actions",
      }),
    ).toBe("pending");
  });

  it("opens legacy awaiting-feasibility records at their normal A1 turn", () => {
    const opened = initializeCombatRoundPhaseResolutionCursor({
      phase: "phase1",
      state: state(),
      updatedAt: createdAt,
    });

    expect(opened.phaseResolutionCursor).toEqual({
      participantId: "attacker",
      phase: "phase1",
      substep: "feint",
    });
    expect(opened.feintProposals[0]?.status).toBe("awaiting_rolls");
  });

  it("records feasibility, both rolls, commit, and retains the normal phase-2 attack", () => {
    const feasible = reviewCombatRoundFeintFeasibility({
      command: { createdAt },
      feasibility: "possible",
      proposalId: proposal().id,
      state: state(),
    });
    const attacker = recordCombatRoundFeintRoll({
      command: { createdAt: "2026-07-15T12:01:00.000Z" },
      proposalId: proposal().id,
      result: {
        adjustment: 0,
        characteristic: "dex",
        characteristicValue: 4,
        finalTotal: 17,
        id: "attacker-roll",
        openEndedD10s: [],
        participantId: "attacker",
        rollD20: 10,
        rollTotal: 10,
        rolledAt: "2026-07-15T12:01:00.000Z",
        skillId: "dodge",
        skillLabel: "Dodge",
        skillXp: 3,
        skillContestCalculation: {
          baseSkill: 7,
          calculationId: "attacker-roll",
          completeness: "partial",
          contestType: "movement_feint",
          derivedIntegerAdjustment: 0,
          finalResult: 17,
          governingStat: { id: "dex", label: "Dexterity", value: 4 },
          missingContributionPoints: ["withdrawal_backout"],
          openEndedDie: { openEndedD10s: [], rollD20: 10, rollTotal: 10 },
          opponentParticipantId: "defender",
          participantId: "attacker",
          percentageContributions: [],
          preDieTotal: 7,
          role: "movement_feint_initiator",
          skill: { id: "dodge", label: "Dodge", totalXp: 3 },
          totalPercentageAdjustment: 0,
          visibility: "roller_and_gm",
        },
      },
      state: feasible,
    });
    const resolved = recordCombatRoundFeintRoll({
      command: { createdAt: "2026-07-15T12:02:00.000Z" },
      proposalId: proposal().id,
      result: {
        adjustment: 0,
        characteristic: "int",
        characteristicValue: 3,
        finalTotal: 10,
        id: "defender-roll",
        openEndedD10s: [],
        participantId: "defender",
        rollD20: 5,
        rollTotal: 5,
        rolledAt: "2026-07-15T12:02:00.000Z",
        skillId: "sword",
        skillLabel: "Sword",
        skillXp: 2,
      },
      state: attacker,
      tableResult: {
        attackerPhase1DbParryModifier: 0,
        band: "attacker_edge",
        defenderObDbModifier: -2,
      },
    });
    const committed = commitCombatRoundFeintResult({
      attackerCombatContext: applyCommittedCombatFeintModifiers({
        proposal: combatFeintProposalSchema.parse({
          ...resolved.feintProposals[0],
          committedAt: createdAt,
          status: "committed",
        }),
      }).attackerCombatContext,
      command: { createdAt: "2026-07-15T12:03:00.000Z" },
      defenderCombatContext: applyCommittedCombatFeintModifiers({
        proposal: combatFeintProposalSchema.parse({
          ...resolved.feintProposals[0],
          committedAt: createdAt,
          status: "committed",
        }),
      }).defenderCombatContext,
      gmAttackerDbParryModifier: -1,
      gmDefenderDbParryModifier: -3,
      gmDefenderSkillObModifier: -4,
      notes: "The defender follows the false opening.",
      proposalId: proposal().id,
      state: resolved,
    });

    expect(committed.feintProposals[0]?.status).toBe("committed");
    expect(getCombatRoundPhaseAttackCandidates({ phase: "phase2", state: committed })).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: "attack-2", participantId: "attacker" }),
      ]),
    );
    const reloaded = combatRoundStateSchema.parse(JSON.parse(JSON.stringify(committed)));
    expect(reloaded.feintProposals[0]).toMatchObject({
      attackerRollRecorded: true,
      defenderRollRecorded: true,
      difference: 7,
      phase2AttackOpportunityId: "attack-2",
      status: "committed",
    });
    expect(reloaded.feintProposals[0]?.attackerRoll?.skillContestCalculation).toMatchObject({
      baseSkill: 7,
      finalResult: 17,
      role: "movement_feint_initiator",
    });
    expect(getCombatRoundPhaseAttackCandidates({ phase: "phase2", state: reloaded })).toEqual(
      expect.arrayContaining([expect.objectContaining({ id: "attack-2" })]),
    );
    const committedEvent = reloaded.events.find((event) => event.type === "feint_committed");
    const attackerRollEvent = reloaded.events.find(
      (event) => event.type === "feint_roll" && event.ownerParticipantId === "attacker",
    );
    expect(attackerRollEvent?.facts.rollerPrivate).toMatchObject({
      skillContestCalculation: {
        baseSkill: 7,
        finalResult: 17,
        role: "movement_feint_initiator",
      },
    });
    expect(committedEvent?.facts.resultPresentation).toMatchObject({
      actionInstanceId: proposal().id,
      adjustment: {
        adjustedBy: "gm",
        entries: expect.arrayContaining([
          expect.objectContaining({
            committedValue: -4,
            consequenceKey: "defenderPhase2SkillObModifier",
            standardValue: -2,
          }),
          expect.objectContaining({
            committedValue: -3,
            consequenceKey: "defenderPhase2DbParryModifier",
            standardValue: -2,
          }),
          expect.objectContaining({
            committedValue: -1,
            consequenceKey: "attackerPhase1DbParryModifier",
            standardValue: 0,
          }),
        ]),
      },
      committedConsequences: expect.arrayContaining([
        expect.objectContaining({
          key: "attackerPhase1DbParryModifier",
          value: -1,
        }),
        expect.objectContaining({
          key: "defenderPhase2SkillObModifier",
          value: -4,
        }),
        expect.objectContaining({
          key: "defenderPhase2DbParryModifier",
          value: -3,
        }),
      ]),
      conciseOutcome: {
        details: ["Margin 7", "Band attacker edge"],
        label: "Feint committed",
      },
      publicCombatNote: "The defender follows the false opening.",
      standardConsequences: expect.arrayContaining([
        expect.objectContaining({
          key: "attackerPhase1DbParryModifier",
          value: 0,
        }),
        expect.objectContaining({
          key: "defenderPhase2SkillObModifier",
          value: -2,
        }),
        expect.objectContaining({
          key: "defenderPhase2DbParryModifier",
          value: -2,
        }),
      ]),
    });
    expect(committedEvent?.facts.gmReview).not.toHaveProperty("notes");
    const undone = undoLatestCombatRoundCommand({ state: committed });
    expect(undone?.feintProposals[0]?.status).toBe("awaiting_review");
    expect(undone?.feintProposals[0]?.attackerRoll?.id).toBe("attacker-roll");
    expect(undone?.feintProposals[0]?.defenderRoll?.id).toBe("defender-roll");

    const withoutDefenderRoll = undone
      ? undoLatestCombatRoundCommand({ state: undone })
      : undefined;
    expect(withoutDefenderRoll?.feintProposals[0]).toMatchObject({
      attackerRoll: expect.objectContaining({ id: "attacker-roll" }),
      status: "awaiting_rolls",
    });
    expect(withoutDefenderRoll?.feintProposals[0]?.defenderRoll).toBeUndefined();

    const withoutAttackerRoll = withoutDefenderRoll
      ? undoLatestCombatRoundCommand({ state: withoutDefenderRoll })
      : undefined;
    expect(withoutAttackerRoll?.feintProposals[0]?.attackerRoll).toBeUndefined();
    expect(withoutAttackerRoll?.feintProposals[0]?.status).toBe("awaiting_rolls");

    const withoutFeasibility = withoutAttackerRoll
      ? undoLatestCombatRoundCommand({ state: withoutAttackerRoll })
      : undefined;
    expect(withoutFeasibility?.feintProposals[0]).toMatchObject({
      feasibility: "pending",
      status: "awaiting_feasibility",
    });
  });

  it("records an impossible feint without removing the phase-2 attack", () => {
    const impossible = reviewCombatRoundFeintFeasibility({
      command: { createdAt },
      feasibility: "impossible",
      proposalId: proposal().id,
      state: state(),
    });
    expect(impossible.feintProposals[0]?.status).toBe("impossible");
    expect(
      getCombatRoundPhaseAttackCandidates({ phase: "phase2", state: impossible }),
    ).toHaveLength(1);
  });
});
