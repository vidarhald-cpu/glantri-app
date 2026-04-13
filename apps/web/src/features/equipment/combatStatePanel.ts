import type { CombatAllocationState } from "../../../../../packages/rules-engine/src/combat/combatAllocationState";

import {
  type CombatStateCharacterInputs,
  deriveCombatStateSnapshot,
  type DerivedCombatValue,
} from "./combatStateDerivation";
import type { EquipmentFeatureState } from "./types";

export type CombatStateValue = string | number;

export interface CombatStateDetailRow {
  label: string;
  value: CombatStateValue;
}

export interface CombatStateTableModel {
  title: string;
  description?: string;
  columns: string[];
  rows: CombatStateValue[][];
}

export interface CombatStatePanelModel {
  title: string;
  description: string;
  statsRows: CombatStateDetailRow[];
  statsTable?: CombatStateTableModel;
  weaponModeTable: CombatStateTableModel;
  capabilityRows: CombatStateDetailRow[];
}

function getWeaponModeValue(value: DerivedCombatValue | null | undefined): CombatStateValue {
  return value ?? "—";
}

function getIntegerStyleDisplayValue(value: CombatStateValue): CombatStateValue {
  return typeof value === "number" ? String(Math.round(value)) : value;
}

export function buildCombatStatePanelModel(
  state: EquipmentFeatureState,
  characterId: string,
  characterInputs?: CombatStateCharacterInputs,
  allocationInputs?: CombatAllocationState,
  selectedThrowingWeaponItemId?: string | null,
): CombatStatePanelModel {
  const snapshot = deriveCombatStateSnapshot(
    state,
    characterId,
    characterInputs,
    allocationInputs,
    selectedThrowingWeaponItemId,
  );
  const statsRows: CombatStateDetailRow[] = [];

  const weaponModeTable: CombatStateTableModel = {
    title: "Weapons",
    columns: [
      "Mode",
      "Weapon",
      "I",
      "Attack 1",
      "OB",
      "DMB",
      "Crit 1",
      "Sec",
      "AM",
      "DB",
      "DM",
      "Parry",
      "Attack 2",
      "OB2",
      "DMB2",
      "Crit 2",
      "AM 2",
      "Attack 3",
      "OB3",
      "DMB3",
      "Crit 3",
      "AM 3",
    ],
    rows: snapshot.weaponRows.map((row) => [
      row.modeLabel,
      row.currentItemLabel,
      getWeaponModeValue(
        row.slotLabel === "Brawling"
          ? snapshot.weaponRows.find((candidate) => candidate.slotLabel === "Punch")?.initiative ?? row.initiative
          : row.initiative,
      ),
      getWeaponModeValue(row.slotLabel === "Brawling" ? "Grapple" : row.attack1),
      getWeaponModeValue(row.ob1),
      getWeaponModeValue(row.dmb1),
      getWeaponModeValue(row.crit1),
      getWeaponModeValue(row.sec),
      getWeaponModeValue(row.armorMod1),
      getWeaponModeValue(row.db),
      getWeaponModeValue(row.dm),
      getWeaponModeValue(row.parry),
      getWeaponModeValue(row.attack2),
      getWeaponModeValue(row.ob2),
      getWeaponModeValue(row.dmb2),
      getWeaponModeValue(row.crit2),
      getWeaponModeValue(row.armorMod2),
      getWeaponModeValue(row.attack3),
      getWeaponModeValue(row.ob3),
      getWeaponModeValue(row.dmb3),
      getWeaponModeValue(row.crit3),
      getWeaponModeValue(row.armorMod3),
    ]),
  };

  const capabilityRows: CombatStateDetailRow[] = [
    {
      label: "Encumbrance capacity",
      value: getIntegerStyleDisplayValue(snapshot.encumbranceCapacity),
    },
    {
      label: "Enc/count/lvl",
      value: `${getIntegerStyleDisplayValue(snapshot.personalEncumbrance)} / ${snapshot.gearCount} / ${snapshot.encumbranceLevel}`,
    },
    { label: "Mov/mod", value: `${snapshot.movementSummary} / ${snapshot.movementModifierSummary}` },
  ];

  return {
    title: "Combat State Panel",
    description: "",
    statsRows,
    weaponModeTable,
    capabilityRows,
  };
}
