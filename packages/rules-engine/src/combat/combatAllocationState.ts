import type { EncounterDefensePosture } from "@glantri/domain";

export type CombatParrySource = "none" | "primary" | "secondary" | "unarmed" | "shield";

export interface CombatAllocationState {
  defensePosture: EncounterDefensePosture;
  parry: {
    allocatedOb: number | null;
    source: CombatParrySource;
  };
  situationalModifiers: {
    attack: number;
    defense: number;
    movement: number;
    perception: number;
  };
}

export const defaultCombatAllocationState: CombatAllocationState = {
  defensePosture: "none",
  parry: {
    allocatedOb: null,
    source: "none"
  },
  situationalModifiers: {
    attack: 0,
    defense: 0,
    movement: 0,
    perception: 0
  }
};

export function normalizeCombatAllocationState(
  allocationState?: CombatAllocationState
): CombatAllocationState {
  if (!allocationState) {
    return defaultCombatAllocationState;
  }

  return {
    defensePosture: allocationState.defensePosture,
    parry: {
      allocatedOb: allocationState.parry.allocatedOb,
      source: allocationState.parry.source
    },
    situationalModifiers: {
      attack: allocationState.situationalModifiers.attack,
      defense: allocationState.situationalModifiers.defense,
      movement: allocationState.situationalModifiers.movement,
      perception: allocationState.situationalModifiers.perception
    }
  };
}

export function getCombatDefensePostureLabel(defensePosture: EncounterDefensePosture): string {
  switch (defensePosture) {
    case "guard":
      return "Guard";
    case "parry":
      return "Parry";
    case "shield":
      return "Shield defense";
    case "full-defense":
      return "Full defense";
    case "none":
    default:
      return "None";
  }
}
