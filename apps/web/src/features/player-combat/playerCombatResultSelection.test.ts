import { describe, expect, it } from "vitest";
import type { CombatRoundAttackRollResult } from "@glantri/domain";

import {
  getLatestRelevantPlayerCombatAttackResult,
  selectPlayerCombatActionResultPanel,
} from "./playerCombatResultSelection";

function makeAttackResult(
  overrides: Partial<CombatRoundAttackRollResult> = {},
): CombatRoundAttackRollResult {
  return {
    actionId: "attack_parry",
    attackerParticipantId: "attacker",
    defenderDb: 13,
    defenderParryModifier: 0,
    defenderParticipantId: "defender",
    grazing: false,
    hit: true,
    kind: "attackRoll",
    lookupTotal: 17,
    marginOverMissThreshold: 7,
    ob: 10,
    openEndedD10s: [],
    phase: "phase1",
    rollD20: 15,
    rollTotal: 15,
    rolledAt: "2026-07-08T10:00:00.000Z",
    tableResult: "Hit",
    weaponName: "Broad sword",
    ...overrides,
  };
}

describe("selectPlayerCombatActionResultPanel", () => {
  it("prioritizes the selected attacker's current damage-chain roll over a phase fallback", () => {
    const result = selectPlayerCombatActionResultPanel({
      attackerPrivileged: "attacker-owned hit location",
      currentPhaseResolution: "incoming defender phase result",
      involvedDamage: "latest involved damage fallback",
    });

    expect(result).toBe("attacker-owned hit location");
  });

  it("shows an owned distance-adjustment roll before older action facts", () => {
    const result = selectPlayerCombatActionResultPanel({
      adjustDistance: "owned Dodge roll",
      relevantInitiative: "older initiative result",
    });

    expect(result).toBe("owned Dodge roll");
  });

  it("uses latest involved damage before plain attack facts", () => {
    const result = selectPlayerCombatActionResultPanel({
      currentAttack: "current attack roll",
      involvedDamage: "latest involved damage fallback",
      latestAttack: "latest relevant attack roll",
    });

    expect(result).toBe("latest involved damage fallback");
  });

  it("uses current phase resolution facts before latest involved damage fallback", () => {
    const result = selectPlayerCombatActionResultPanel({
      currentPhaseResolution: "current parry or defense resolution",
      involvedDamage: "latest involved damage fallback",
    });

    expect(result).toBe("current parry or defense resolution");
  });

  it("falls back to the local action roll only after stored command facts", () => {
    const result = selectPlayerCombatActionResultPanel({
      actionRoll: "local optimistic roll",
      combatExperience: "stored combat experience command",
    });

    expect(result).toBe("stored combat experience command");
  });

  it("uses the current attack before the latest relevant attack fallback", () => {
    const result = selectPlayerCombatActionResultPanel({
      currentAttack: "current attack roll",
      latestAttack: "latest relevant attack roll",
    });

    expect(result).toBe("current attack roll");
  });

  it("uses the latest relevant attack before older initiative and combat experience facts", () => {
    const result = selectPlayerCombatActionResultPanel({
      combatExperience: "older combat experience result",
      latestAttack: "latest relevant attack roll",
      relevantInitiative: "older initiative result",
    });

    expect(result).toBe("latest relevant attack roll");
  });
});

describe("getLatestRelevantPlayerCombatAttackResult", () => {
  it("selects the selected attacker's stored attack result without current-step scope", () => {
    const attack = makeAttackResult();

    const result = getLatestRelevantPlayerCombatAttackResult({
      participantId: "attacker",
      state: {
        participants: [{ attackResults: { phase1: attack } }],
      },
    });

    expect(result).toBe(attack);
  });

  it("selects the selected defender's incoming stored attack result", () => {
    const attack = makeAttackResult();

    const result = getLatestRelevantPlayerCombatAttackResult({
      participantId: "defender",
      state: {
        participants: [{ attackResults: { phase1: attack } }],
      },
    });

    expect(result).toBe(attack);
  });

  it("uses the newest relevant attack when multiple involved results exist", () => {
    const olderAttack = makeAttackResult({
      phase: "phase1",
      rolledAt: "2026-07-08T10:00:00.000Z",
      tableResult: "Miss",
    });
    const newerAttack = makeAttackResult({
      phase: "phase2",
      rolledAt: "2026-07-08T10:05:00.000Z",
      tableResult: "Hit",
    });

    const result = getLatestRelevantPlayerCombatAttackResult({
      participantId: "attacker",
      state: {
        participants: [{ attackResults: { phase1: olderAttack, phase2: newerAttack } }],
      },
    });

    expect(result).toBe(newerAttack);
  });

  it("does not expose unrelated attack results to uninvolved participants", () => {
    const attack = makeAttackResult();

    const result = getLatestRelevantPlayerCombatAttackResult({
      participantId: "bystander",
      state: {
        participants: [{ attackResults: { phase1: attack } }],
      },
    });

    expect(result).toBeUndefined();
  });
});
