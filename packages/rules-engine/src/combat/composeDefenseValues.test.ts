import { describe, expect, it } from "vitest";

import { defaultCombatAllocationState } from "./combatAllocationState";
import { composeCombatDefenseValues } from "./composeDefenseValues";

describe("composeCombatDefenseValues", () => {
  it("combines dexterity, shield, and situation into DB", () => {
    const result = composeCombatDefenseValues({
      allocationState: {
        ...defaultCombatAllocationState,
        situationalModifiers: {
          ...defaultCombatAllocationState.situationalModifiers,
          defense: 2
        }
      },
      availableOb: 35,
      canUseShield: true,
      dexterity: 11,
      shieldBonus: 2,
      shieldDefensiveValue: 2,
      usesSelectedParrySource: false,
      weaponDefensiveValue: 1,
      weaponParryModifier: 0
    });

    expect(result.db).toBe(15);
    expect(result.dm).toBe(3);
    expect(result.parry).toBe("37 (allocation pending)");
  });

  it("uses explicit allocated parry when parry posture is selected", () => {
    const result = composeCombatDefenseValues({
      allocationState: {
        defensePosture: "parry",
        parry: {
          allocatedOb: 15,
          source: "primary"
        },
        situationalModifiers: {
          attack: 0,
          defense: 1,
          movement: 0,
          perception: 0
        }
      },
      availableOb: 40,
      canUseShield: true,
      dexterity: 10,
      shieldBonus: 2,
      shieldDefensiveValue: 1,
      usesSelectedParrySource: true,
      weaponDefensiveValue: 1,
      weaponParryModifier: 0
    });

    expect(result.db).toBe(13);
    expect(result.parry).toBe(16);
  });
});
