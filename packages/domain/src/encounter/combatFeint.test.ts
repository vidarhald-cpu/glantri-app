import { describe, expect, it } from "vitest";

import { scenarioParticipantCombatContextSchema } from "../campaign/scenario";
import {
  applyCommittedCombatFeintModifiers,
  buildCombatFeintProposalId,
  combatFeintProposalSchema,
} from "./combatFeint";
import {
  combatRoundStateSchema,
  commitCombatRoundFeintResult,
  getCombatRoundPhaseAttackCandidates,
  recordCombatRoundFeintRoll,
  reviewCombatRoundFeintFeasibility,
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
});

describe("combat feint lifecycle", () => {
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
    expect(getCombatRoundPhaseAttackCandidates({ phase: "phase2", state: reloaded })).toEqual(
      expect.arrayContaining([expect.objectContaining({ id: "attack-2" })]),
    );
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
