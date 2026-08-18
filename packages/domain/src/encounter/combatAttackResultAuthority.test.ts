import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import {
  buildCombatRoundAttackRollResult,
  combatRoundStateSchema,
  getCombatRoundAttackResultById,
  getCombatRoundAttackResultId,
  recordCombatRoundAttackResult,
  type CombatRoundAttackRollResult,
} from "./combatRoundManager";

function attack(
  input: {
    attackOpportunityId?: string;
    phase?: "phase1" | "phase2";
    rolledAt?: string;
  } = {},
): CombatRoundAttackRollResult {
  const phase = input.phase ?? "phase1";
  return buildCombatRoundAttackRollResult({
    actionId: phase === "phase1" ? "single_attack" : "double_attack",
    attackOpportunityId: input.attackOpportunityId,
    attackerParticipantId: "attacker",
    defenderDb: 8,
    defenderParticipantId: "defender",
    ob: 12,
    phase,
    rollD20: 14,
    rollTotal: 14,
    rolledAt: input.rolledAt ?? "2026-08-11T18:00:00.000Z",
    weaponName: "Fencing sword",
  });
}

function participant(
  input: {
    attackResults?: Record<string, CombatRoundAttackRollResult>;
    attackResultsByOpportunity?: Record<string, CombatRoundAttackRollResult>;
  } = {},
) {
  return {
    attackResults: input.attackResults ?? {},
    attackResultsByOpportunity: input.attackResultsByOpportunity,
    initiatives: {},
    label: "Attacker",
    participantId: "attacker",
  };
}

describe("canonical combat attack-result authority", () => {
  it("hydrates a phase-only active result into the deterministic canonical identity", () => {
    const legacy = attack();
    const state = combatRoundStateSchema.parse({
      participants: [participant({ attackResults: { phase1: legacy } })],
      roundNumber: 3,
    });
    const expectedId = getCombatRoundAttackResultId({ result: legacy, roundNumber: 3 });
    const stored = state.participants[0];

    expect(stored?.attackResultsByOpportunity).toEqual({ [expectedId]: legacy });
    expect(stored?.attackResults.phase1).toEqual(legacy);
    expect(getCombatRoundAttackResultById({ attackResultId: expectedId, state })).toEqual(legacy);
  });

  it("deduplicates identical legacy/canonical values and rekeys the map by opportunity", () => {
    const result = attack({ attackOpportunityId: "round:3:attacker:phase1:attack_1" });
    const state = combatRoundStateSchema.parse({
      participants: [
        participant({
          attackResults: { phase1: result },
          attackResultsByOpportunity: { "stale-map-key": result },
        }),
      ],
      roundNumber: 3,
    });

    expect(state.participants[0]?.attackResultsByOpportunity).toEqual({
      "round:3:attacker:phase1:attack_1": result,
    });
    expect(state.participants[0]?.attackResults.phase1).toEqual(result);
  });

  it("fails closed when legacy and canonical values conflict for one identity", () => {
    const result = attack({ attackOpportunityId: "round:3:attacker:phase1:attack_1" });

    expect(() =>
      combatRoundStateSchema.parse({
        participants: [
          participant({
            attackResults: { phase1: { ...result, ob: result.ob + 1 } },
            attackResultsByOpportunity: { [result.attackOpportunityId!]: result },
          }),
        ],
        roundNumber: 3,
      }),
    ).toThrow(/authority invariant failed.*conflicting/i);
  });

  it("rejects a lossy phase compatibility projection", () => {
    const first = attack({ attackOpportunityId: "attack-1" });
    const second = attack({
      attackOpportunityId: "attack-2",
      rolledAt: "2026-08-11T18:01:00.000Z",
    });

    expect(() =>
      combatRoundStateSchema.parse({
        participants: [
          participant({ attackResultsByOpportunity: { "attack-1": first, "attack-2": second } }),
        ],
        roundNumber: 3,
      }),
    ).toThrow(/cannot be represented by the compatibility view/i);
  });

  it("normalizes phase-only results inside immutable archived rounds", () => {
    const legacy = attack();
    const state = combatRoundStateSchema.parse({
      participants: [],
      roundNumber: 2,
      rounds: [
        {
          participants: [participant({ attackResults: { phase1: legacy } })],
          roundNumber: 1,
        },
      ],
    });
    const expectedId = getCombatRoundAttackResultId({ result: legacy, roundNumber: 1 });

    expect(state.rounds[0]?.participants[0]?.attackResultsByOpportunity).toEqual({
      [expectedId]: legacy,
    });
    expect(state.rounds[0]?.participants[0]?.attackResults.phase1).toEqual(legacy);
  });

  it("records through the canonical map even for legacy results without an opportunity id", () => {
    const result = attack();
    const state = combatRoundStateSchema.parse({
      participants: [
        participant(),
        {
          attackResults: {},
          initiatives: {},
          label: "Defender",
          participantId: "defender",
        },
      ],
      roundNumber: 3,
    });
    const recorded = recordCombatRoundAttackResult({
      participantId: "attacker",
      result,
      state,
      submittedBy: "gm",
    });
    const expectedId = getCombatRoundAttackResultId({ result, roundNumber: 3 });

    expect(recorded.participants[0]?.attackResultsByOpportunity).toEqual({
      [expectedId]: result,
    });
    expect(recorded.participants[0]?.attackResults.phase1).toEqual(result);
  });

  it("keeps record and clear paths free of direct phase-slot mutation", () => {
    const source = readFileSync(new URL("./combatRoundManager.ts", import.meta.url), "utf8");
    const recordStart = source.indexOf("export function recordCombatRoundAttackResult(");
    const recordEnd = source.indexOf(
      "export function recordCombatRoundParticipantStepReview(",
      recordStart,
    );
    const clearStart = source.indexOf("function clearCombatRoundStepLegacy(");
    const clearEnd = source.indexOf("export function undoLatestCombatRoundCommand(", clearStart);
    const recordSource = source.slice(recordStart, recordEnd);
    const clearSource = source.slice(clearStart, clearEnd);

    expect(recordStart).toBeGreaterThanOrEqual(0);
    expect(recordEnd).toBeGreaterThan(recordStart);
    expect(clearStart).toBeGreaterThanOrEqual(0);
    expect(clearEnd).toBeGreaterThan(clearStart);
    expect(recordSource).not.toContain("[recordedResult.phase]");
    expect(clearSource).not.toContain("nextAttackResults.phase");
    expect(clearSource).not.toContain("participant.attackResults[");
  });
});
