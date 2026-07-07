import { describe, expect, it } from "vitest";

import { selectPlayerCombatActionResultPanel } from "./playerCombatResultSelection";

describe("selectPlayerCombatActionResultPanel", () => {
  it("prioritizes the selected attacker's current damage-chain roll over a phase fallback", () => {
    const result = selectPlayerCombatActionResultPanel({
      attackerPrivileged: "attacker-owned hit location",
      currentPhaseResolution: "incoming defender phase result",
      involvedDamage: "latest involved damage fallback",
    });

    expect(result).toBe("attacker-owned hit location");
  });

  it("uses current attack facts before latest involved damage fallback", () => {
    const result = selectPlayerCombatActionResultPanel({
      currentAttack: "current attack roll",
      involvedDamage: "latest involved damage fallback",
    });

    expect(result).toBe("current attack roll");
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
});
