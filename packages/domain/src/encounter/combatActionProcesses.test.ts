import { describe, expect, it } from "vitest";

import {
  buildCombatActionProcessPlans,
  combatActionProcessAdapters,
} from "./combatActionProcesses";
import {
  buildCombatRoundAttackRollResult,
  buildCombatRoundPhaseResolutionResult,
  combatRoundStateSchema,
  decideCombatRoundDoubleAttackPhase2,
  type CombatRoundState,
} from "./combatRoundManager";
import { buildCombatProgressionProjection } from "./combatProgressionProjection";

const NOW = "2026-07-19T10:00:00.000Z";

function stateFor(
  actionId: "attack_parry" | "double_attack" | "parry_attack",
  overrides: Partial<CombatRoundState> = {},
): CombatRoundState {
  return combatRoundStateSchema.parse({
    currentCursor: { participantId: "hero", roundNumber: 2, step: "A1" },
    currentStep: "phase_1_actions",
    participants: [
      {
        characterId: "character-hero",
        declaration: {
          actionId,
          phaseContexts: {
            phase1: { targetParticipantId: "guard" },
            phase2: { targetParticipantId: "guard" },
          },
          roundNumber: 2,
          submittedBy: "player",
        },
        label: "Hero",
        participantId: "hero",
        scenarioParticipantId: "scenario-hero",
      },
      {
        characterId: "character-guard",
        label: "Guard",
        participantId: "guard",
        scenarioParticipantId: "scenario-guard",
      },
    ],
    roundNumber: 2,
    ...overrides,
  });
}

function attack(input: {
  actionId: "attack_parry" | "double_attack" | "parry_attack";
  attackerParticipantId?: string;
  defenderParticipantId?: string;
  hit: boolean;
  phase: "phase1" | "phase2";
}) {
  const result = buildCombatRoundAttackRollResult({
    actionId: input.actionId,
    attackerParticipantId: input.attackerParticipantId ?? "hero",
    defenderDb: input.hit ? 0 : 30,
    defenderParticipantId: input.defenderParticipantId ?? "guard",
    ob: input.hit ? 80 : 0,
    phase: input.phase,
    rollD20: input.hit ? 20 : 1,
    rollTotal: input.hit ? 20 : 1,
    rolledAt: NOW,
    weaponName: "Sword",
  });
  return {
    ...result,
    attackOpportunityId: `round:2:participant:${input.attackerParticipantId ?? "hero"}:${input.phase}:${input.phase === "phase1" ? "attack_1" : "attack_2"}`,
  };
}

describe("combat action process adapters", () => {
  it("builds a pure, immutable, deterministic Single Attack plan with stable shared stages", () => {
    const state = stateFor("attack_parry");
    const before = structuredClone(state);
    const first = buildCombatActionProcessPlans(state);
    const second = buildCombatActionProcessPlans(state);
    const plan = first[0];
    const standardAttack = plan?.standardAttacks[0];

    expect(first).toEqual(second);
    expect(state).toEqual(before);
    expect(Object.isFrozen(first)).toBe(true);
    expect(Object.isFrozen(standardAttack?.stages)).toBe(true);
    expect(plan).toMatchObject({
      actionKind: "single_attack",
      completion: { complete: false },
      id: "round:2:action:hero:single_attack",
    });
    expect(standardAttack?.id).toBe(
      "round:2:action:hero:single_attack:attack:round:2:participant:hero:phase1:attack_1",
    );
    expect(standardAttack?.stages.map(({ kind, state }) => ({ kind, state }))).toEqual([
      { kind: "attack", state: "ready" },
      { kind: "defense", state: "pending" },
      { kind: "hit_location", state: "pending" },
      { kind: "damage", state: "pending" },
      { kind: "critical", state: "pending" },
      { kind: "commit", state: "pending" },
    ]);
    expect(combatActionProcessAdapters.map((adapter) => adapter.actionKind)).toEqual([
      "single_attack",
      "reactive_attack",
      "double_attack",
    ]);
  });

  it("completes a missed Single Attack without opening defense or damage", () => {
    const result = attack({ actionId: "attack_parry", hit: false, phase: "phase1" });
    const base = stateFor("attack_parry");
    const state = combatRoundStateSchema.parse({
      ...base,
      participants: base.participants.map((participant) =>
        participant.participantId === "hero"
          ? { ...participant, attackResults: { phase1: result } }
          : participant,
      ),
      phaseResolutionResults: [
        buildCombatRoundPhaseResolutionResult({
          attackResult: result,
          roundNumber: 2,
          updatedAt: NOW,
        }),
      ],
    });
    const standardAttack = buildCombatActionProcessPlans(state)[0]?.standardAttacks[0];

    expect(standardAttack?.completion).toEqual({ complete: true, reason: "miss" });
    expect(standardAttack?.stages.slice(1).every((stage) => stage.state === "skipped")).toBe(true);
  });

  it("keeps Reactive Attack locked until the declared opponent attacks in phase 1", () => {
    const locked = stateFor("parry_attack", {
      currentCursor: { participantId: "hero", roundNumber: 2, step: "A2" },
      currentStep: "phase_2_actions",
    });
    const lockedPlan = buildCombatActionProcessPlans(locked)[0]?.standardAttacks[0];
    expect(lockedPlan).toMatchObject({
      actionKind: "reactive_attack",
      phase: "phase2",
      prerequisites: expect.arrayContaining([{ kind: "reactive_trigger", satisfied: false }]),
    });
    expect(lockedPlan?.stages.every((stage) => stage.state === "pending")).toBe(true);

    const trigger = attack({
      actionId: "attack_parry",
      attackerParticipantId: "guard",
      defenderParticipantId: "hero",
      hit: false,
      phase: "phase1",
    });
    const opened = combatRoundStateSchema.parse({
      ...locked,
      participants: locked.participants.map((participant) =>
        participant.participantId === "guard"
          ? { ...participant, attackResults: { phase1: trigger } }
          : participant,
      ),
    });
    const openedPlan = buildCombatActionProcessPlans(opened)[0]?.standardAttacks[0];
    expect(openedPlan?.prerequisites).toContainEqual({
      kind: "reactive_trigger",
      satisfied: true,
    });
    expect(openedPlan?.stages[0]).toMatchObject({ kind: "attack", state: "ready" });
    expect(openedPlan?.id).toBe(lockedPlan?.id);
  });

  it("projects one Double Attack phase-1 process and then a stable Continue/Cancel gate", () => {
    const phase1Result = attack({ actionId: "double_attack", hit: false, phase: "phase1" });
    const base = stateFor("double_attack", {
      currentCursor: { participantId: "hero", roundNumber: 2, step: "M2" },
      currentStep: "review_phase_2_modifiers",
    });
    const waiting = combatRoundStateSchema.parse({
      ...base,
      participants: base.participants.map((participant) =>
        participant.participantId === "hero"
          ? { ...participant, attackResults: { phase1: phase1Result } }
          : participant,
      ),
    });
    const waitingPlan = buildCombatActionProcessPlans(waiting)[0];
    expect(waitingPlan?.standardAttacks.map((entry) => entry.phase)).toEqual(["phase1"]);
    expect(waitingPlan?.decisionGate).toMatchObject({
      id: "round:2:action:hero:double_attack:decision:phase2",
      required: true,
      state: "ready",
    });
    const projection = buildCombatProgressionProjection(waiting);
    expect(
      projection.boundary.processes
        .flatMap((process) => process.stages)
        .flatMap((stage) => stage.tasks),
    ).toContainEqual(
      expect.objectContaining({
        expectedCommand: "decide_double_attack_phase2",
        kind: "double_attack_decision",
        owner: expect.objectContaining({ participantId: "hero" }),
      }),
    );
    expect(
      projection.boundary.processes
        .flatMap((process) => process.stages)
        .flatMap((stage) => stage.tasks)
        .some((task) => task.kind === "gm_advance_boundary"),
    ).toBe(false);
  });

  it("exposes exactly one phase-2 Double Attack after Continue and none after Cancel", () => {
    const phase1Result = attack({ actionId: "double_attack", hit: false, phase: "phase1" });
    const base = stateFor("double_attack", {
      currentCursor: { participantId: "hero", roundNumber: 2, step: "M2" },
      currentStep: "review_phase_2_modifiers",
    });
    const waiting = combatRoundStateSchema.parse({
      ...base,
      participants: base.participants.map((participant) =>
        participant.participantId === "hero"
          ? { ...participant, attackResults: { phase1: phase1Result } }
          : participant,
      ),
    });
    const continued = decideCombatRoundDoubleAttackPhase2({
      command: { createdAt: NOW, createdByUserId: "user-hero" },
      decision: "continue",
      participantId: "hero",
      state: waiting,
    });
    const cancelled = decideCombatRoundDoubleAttackPhase2({
      command: { createdAt: NOW, createdByUserId: "user-hero" },
      decision: "cancel",
      participantId: "hero",
      state: waiting,
    });
    const continuedPlan = buildCombatActionProcessPlans(continued)[0];
    const cancelledPlan = buildCombatActionProcessPlans(cancelled)[0];

    expect(continuedPlan?.standardAttacks.map((entry) => entry.phase)).toEqual([
      "phase1",
      "phase2",
    ]);
    expect(continuedPlan?.standardAttacks.filter((entry) => entry.phase === "phase2")).toHaveLength(
      1,
    );
    expect(continuedPlan?.decisionGate).toMatchObject({ decision: "continue", state: "complete" });
    expect(cancelledPlan?.standardAttacks.map((entry) => entry.phase)).toEqual(["phase1"]);
    expect(cancelledPlan?.completion.complete).toBe(true);
    expect(cancelledPlan?.decisionGate).toMatchObject({ decision: "cancel", state: "complete" });

    const reloaded = combatRoundStateSchema.parse(JSON.parse(JSON.stringify(continued)));
    expect(buildCombatActionProcessPlans(reloaded)).toEqual(
      buildCombatActionProcessPlans(continued),
    );
    expect(buildCombatActionProcessPlans(waiting)[0]?.decisionGate?.state).toBe("ready");
  });

  it("does not claim Feint or Adjust Distance action progression", () => {
    for (const actionId of ["feint_attack", "adjust_range_attack"] as const) {
      const state = combatRoundStateSchema.parse({
        ...stateFor("attack_parry"),
        participants: stateFor("attack_parry").participants.map((participant) =>
          participant.participantId === "hero"
            ? {
                ...participant,
                declaration: { actionId, roundNumber: 2, submittedBy: "player" },
              }
            : participant,
        ),
      });
      expect(buildCombatActionProcessPlans(state)).toEqual([]);
    }
  });
});
