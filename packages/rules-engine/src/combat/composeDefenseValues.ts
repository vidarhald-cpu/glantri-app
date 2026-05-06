import { calculateDB } from "../calculators/db/calculateDB";
import { calculateParryValue } from "../calculators/parry/calculateParryValue";
import type {
  CombatAllocationState,
  CombatParrySource
} from "./combatAllocationState";

export type CombatComposedValue = number | string;

export interface CombatDefenseCompositionInput {
  allocationState: CombatAllocationState;
  availableOb: number | null;
  canUseShield: boolean;
  dexterity: number | null;
  shieldBonus: number;
  shieldDefensiveValue: number;
  usesSelectedParrySource: boolean;
  weaponDefensiveValue: number;
  weaponParryModifier: number | null;
}

export interface CombatDefenseCompositionResult {
  db: CombatComposedValue;
  dm: CombatComposedValue;
  parry: CombatComposedValue;
  statuses: {
    db: "exact" | "interim";
    dm: "exact" | "interim";
    parry: "exact" | "interim";
  };
}

function clampMinimum(value: number): number {
  return value < 0 ? 0 : value;
}

function composeDbValue(input: CombatDefenseCompositionInput): CombatComposedValue {
  const effectiveShieldBonus = input.canUseShield ? input.shieldBonus : 0;

  if (input.dexterity == null) {
    return effectiveShieldBonus > 0 ? effectiveShieldBonus : "—";
  }

  return calculateDB({
    dex: input.dexterity,
    shieldBonus: effectiveShieldBonus,
    situationalModifier: input.allocationState.situationalModifiers.defense
  });
}

function composeDmValue(input: CombatDefenseCompositionInput): CombatComposedValue {
  const totalDefensiveValue =
    input.weaponDefensiveValue + (input.canUseShield ? input.shieldDefensiveValue : 0);

  return totalDefensiveValue > 0 ? totalDefensiveValue : "—";
}

function getPendingParryValue(input: CombatDefenseCompositionInput): CombatComposedValue {
  if (input.weaponParryModifier == null) {
    return "—";
  }

  if (input.availableOb == null) {
    return input.weaponParryModifier;
  }

  return `${calculateParryValue({
    allocatedOb: input.availableOb,
    parryModifier:
      input.weaponParryModifier + input.allocationState.situationalModifiers.defense
  })} (allocation pending)`;
}

function getAllocatedParryValue(input: CombatDefenseCompositionInput): CombatComposedValue {
  if (input.allocationState.defensePosture !== "parry" || !input.usesSelectedParrySource) {
    return getPendingParryValue(input);
  }

  if (input.allocationState.parry.source === "shield") {
    const dbValue = composeDbValue(input);
    return typeof dbValue === "number" ? dbValue : "Interim (shield posture unavailable)";
  }

  if (input.availableOb == null || input.weaponParryModifier == null) {
    return "Interim";
  }

  const allocatedOb = Math.min(
    clampMinimum(input.allocationState.parry.allocatedOb ?? 0),
    input.availableOb
  );

  return calculateParryValue({
    allocatedOb,
    parryModifier:
      input.weaponParryModifier + input.allocationState.situationalModifiers.defense
  });
}

export function composeCombatDefenseValues(
  input: CombatDefenseCompositionInput
): CombatDefenseCompositionResult {
  const db = composeDbValue(input);
  const dm = composeDmValue(input);
  const parry = getAllocatedParryValue(input);

  return {
    db,
    dm,
    parry,
    statuses: {
      db: typeof db === "number" ? "exact" : "interim",
      dm: typeof dm === "number" ? "exact" : "interim",
      parry:
        typeof parry === "number"
          ? "exact"
          : parry === "—" || parry.toString().includes("allocation pending")
            ? "interim"
            : "interim"
    }
  };
}

export function usesCombatParrySource(
  selectedParrySource: CombatParrySource,
  source: CombatParrySource
): boolean {
  return selectedParrySource === source;
}
