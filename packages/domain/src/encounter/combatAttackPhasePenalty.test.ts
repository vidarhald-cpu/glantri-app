import { describe, expect, it } from "vitest";

import {
  buildCombatAttackPhasePenaltyResultConsequences,
  replaceCombatAttackPhaseDefensivePenalty,
  resolveCombatAttackPhaseDefensivePenalties,
  resolveCombatAttackPhaseDefensivePenalty,
} from "./combatAttackPhasePenalty";

const opportunity = {
  actionId: "feint_attack",
  attackIndex: 2,
  id: "round:4:participant:attacker:phase2:attack_2",
  phase: "phase2" as const,
  slot: "attack_2" as const,
  status: "committed" as const,
  targetParticipantId: "defender",
};

describe("canonical attack-phase defensive penalty", () => {
  it("resolves an ordinary legal committed attack to one phase-scoped -4% fact", () => {
    const result = resolveCombatAttackPhaseDefensivePenalty({
      commitment: "committed",
      opportunity,
      participantId: "attacker",
      roundNumber: 4,
    });

    expect(result).toMatchObject({
      activationCutoff: "phase_start",
      application: "percentage",
      attackOpportunityId: opportunity.id,
      commitment: "committed",
      duration: "phase",
      executionState: "pending",
      participantId: "attacker",
      penalty: -4,
      phase: "phase2",
      reason: "ordinary_committed_attack",
      sourceActionId: "feint_attack",
      sourceException: "none",
    });
  });

  it("keeps declaration preview provisional and uncommitted invalidation at zero", () => {
    expect(
      resolveCombatAttackPhaseDefensivePenalty({
        commitment: "provisional",
        opportunity,
        participantId: "attacker",
        roundNumber: 4,
      }),
    ).toMatchObject({ commitment: "provisional", penalty: -4 });
    expect(
      resolveCombatAttackPhaseDefensivePenalty({
        commitment: "uncommitted",
        executionState: "invalidated",
        opportunity,
        participantId: "attacker",
        reason: "invalid_before_commitment",
        roundNumber: 4,
      }),
    ).toMatchObject({ penalty: 0, reason: "invalid_before_commitment" });
  });

  it.each([
    ["double_attack_second_cancelled", "cancelled"],
    ["simultaneous_attack_backout", "backed_out"],
  ] as const)("resolves explicit %s as -2%%", (sourceException, executionState) => {
    expect(
      resolveCombatAttackPhaseDefensivePenalty({
        commitment: "committed",
        executionState,
        opportunity,
        participantId: "attacker",
        reason: sourceException,
        roundNumber: 4,
        sourceException,
      }),
    ).toMatchObject({
      application: "percentage",
      penalty: -2,
      reason: sourceException,
      sourceException,
    });
  });

  it("does not reinterpret a generic post-commit skip as source-defined backout", () => {
    expect(
      resolveCombatAttackPhaseDefensivePenalty({
        commitment: "committed",
        executionState: "skipped",
        opportunity,
        participantId: "attacker",
        reason: "skipped_after_commitment",
        roundNumber: 4,
      }),
    ).toMatchObject({ penalty: -4, sourceException: "none" });
  });

  it("requires a canonical opportunity and preserves committed invalidation", () => {
    expect(
      resolveCombatAttackPhaseDefensivePenalties({
        commitment: "committed",
        opportunities: [],
        participantId: "attacker",
        roundNumber: 4,
      }),
    ).toEqual([]);
    expect(
      resolveCombatAttackPhaseDefensivePenalty({
        commitment: "committed",
        executionState: "invalidated",
        opportunity,
        participantId: "attacker",
        reason: "invalid_after_commitment",
        roundNumber: 4,
      }),
    ).toMatchObject({ penalty: -4, reason: "invalid_after_commitment" });
  });

  it("is order-independent for opportunities fixed at the same initiative group", () => {
    const resolveTied = (participantId: string, targetParticipantId: string) =>
      resolveCombatAttackPhaseDefensivePenalty({
        commitment: "committed",
        initiativeGroupId: "round:4:phase2:initiative:7:rank:1",
        opportunity: {
          ...opportunity,
          id: `round:4:participant:${participantId}:phase2:attack_2`,
          targetParticipantId,
        },
        participantId,
        roundNumber: 4,
      });
    const forward = [resolveTied("attacker", "defender"), resolveTied("defender", "attacker")];
    const reverse = [resolveTied("defender", "attacker"), resolveTied("attacker", "defender")];

    const summarize = (facts: typeof forward) =>
      facts
        .map(({ participantId, penalty }) => ({ participantId, penalty }))
        .sort((left, right) => left.participantId.localeCompare(right.participantId));

    expect(summarize(forward)).toEqual(summarize(reverse));
    expect(forward).toEqual([
      expect.objectContaining({
        initiativeGroupId: "round:4:phase2:initiative:7:rank:1",
        penalty: -4,
      }),
      expect.objectContaining({
        initiativeGroupId: "round:4:phase2:initiative:7:rank:1",
        penalty: -4,
      }),
    ]);
  });

  it("preserves ordinary and source-exception values as result consequences", () => {
    const cancelled = resolveCombatAttackPhaseDefensivePenalty({
      commitment: "committed",
      executionState: "cancelled",
      opportunity: { ...opportunity, status: "cancelled" },
      participantId: "attacker",
      reason: "double_attack_second_cancelled",
      roundNumber: 4,
      sourceException: "double_attack_second_cancelled",
    });

    expect(buildCombatAttackPhasePenaltyResultConsequences(cancelled)).toEqual({
      committedConsequences: [
        expect.objectContaining({ key: "attackPhaseDefensivePenalty", value: -2 }),
      ],
      standardConsequences: [
        expect.objectContaining({ key: "attackPhaseDefensivePenalty", value: -4 }),
      ],
    });
  });

  it("replaces one opportunity fact without disturbing an independent phase", () => {
    const phase2 = resolveCombatAttackPhaseDefensivePenalty({
      commitment: "committed",
      opportunity,
      participantId: "attacker",
      roundNumber: 4,
    });
    const phase1 = resolveCombatAttackPhaseDefensivePenalty({
      commitment: "committed",
      opportunity: {
        ...opportunity,
        attackIndex: 1,
        id: "round:4:participant:attacker:phase1:attack_1",
        phase: "phase1",
        slot: "attack_1",
      },
      participantId: "attacker",
      roundNumber: 4,
    });
    const cancelled = resolveCombatAttackPhaseDefensivePenalty({
      commitment: "committed",
      executionState: "cancelled",
      opportunity: { ...opportunity, status: "cancelled" },
      participantId: "attacker",
      reason: "double_attack_second_cancelled",
      roundNumber: 4,
      sourceException: "double_attack_second_cancelled",
    });

    expect(
      replaceCombatAttackPhaseDefensivePenalty({ existing: [phase1, phase2], next: cancelled }),
    ).toEqual([
      expect.objectContaining({ attackOpportunityId: phase1.attackOpportunityId, penalty: -4 }),
      expect.objectContaining({ attackOpportunityId: phase2.attackOpportunityId, penalty: -2 }),
    ]);
  });
});
