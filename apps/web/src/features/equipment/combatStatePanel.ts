import type { ArmorTemplate, EquipmentItem, EquipmentTemplate, ShieldTemplate, WeaponTemplate } from "@glantri/domain";
import type { CombatAllocationState } from "@glantri/rules-engine";

import {
  type CombatStateCharacterInputs,
  deriveCombatStateSnapshot,
  type DerivedCombatValue,
} from "./combatStateDerivation";
import { buildCharacterArmorSummary } from "./armorSummary";
import { getEquipmentTemplateById, getLoadoutEquipment } from "./equipmentSelectors";
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
  armorRows?: CombatStateDetailRow[];
  armorTable?: CombatStateTableModel;
  weaponModeTable: CombatStateTableModel;
  capabilityRows: CombatStateDetailRow[];
}

function getWeaponModeValue(value: DerivedCombatValue | null | undefined): CombatStateValue {
  return value ?? "—";
}

function getIntegerStyleDisplayValue(value: CombatStateValue): CombatStateValue {
  return typeof value === "number" ? String(Math.round(value)) : value;
}

function formatLabel(value: string): string {
  return value
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function asWeaponTemplate(template: EquipmentTemplate | undefined): WeaponTemplate | null {
  return template?.category === "weapon" ? template : null;
}

function asShieldTemplate(template: EquipmentTemplate | undefined): ShieldTemplate | null {
  return template?.category === "shield" ? template : null;
}

function asArmorTemplate(template: EquipmentTemplate | undefined): ArmorTemplate | null {
  return template?.category === "armor" ? template : null;
}

function getCombinedClassLabel(input: {
  state: EquipmentFeatureState;
  characterId: string;
}): string | null {
  const loadout = getLoadoutEquipment(input.state, input.characterId);
  const primaryTemplate = asWeaponTemplate(
    "primary" in loadout && loadout.primary
      ? getEquipmentTemplateById(input.state, loadout.primary.templateId)
      : undefined,
  );
  const shieldTemplate = asShieldTemplate(
    "shield" in loadout && loadout.shield
      ? getEquipmentTemplateById(input.state, loadout.shield.templateId)
      : undefined,
  );
  const secondaryTemplate = asWeaponTemplate(
    "secondary" in loadout && loadout.secondary
      ? getEquipmentTemplateById(input.state, loadout.secondary.templateId)
      : undefined,
  );

  if (!primaryTemplate || (!shieldTemplate && !secondaryTemplate)) {
    return null;
  }

  const primaryLabel = formatLabel(primaryTemplate.weaponClass);
  const offHandLabel = shieldTemplate ? "shield" : formatLabel(secondaryTemplate!.weaponClass);

  return `${primaryLabel} / ${offHandLabel}`;
}

function getWeaponRowSortOrder(row: { slotLabel: string }): number {
  switch (row.slotLabel) {
    case "Primary weapon":
      return 1;
    case "Secondary weapon":
      return 2;
    case "Shield":
      return 3;
    case "Combined":
      return 4;
    case "Brawling":
      return 5;
    case "Punch":
      return 6;
    case "Kick":
      return 7;
    case "Missile weapon":
      return 8;
    case "Throwing weapon":
      return 9;
    default:
      return 99;
  }
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
  const combinedClassLabel = getCombinedClassLabel({ characterId, state });
  const loadout = getLoadoutEquipment(state, characterId);
  const armorItem: EquipmentItem | null =
    "armor" in loadout && loadout.armor ? loadout.armor : null;
  const armorTemplate = armorItem
    ? asArmorTemplate(getEquipmentTemplateById(state, armorItem.templateId))
    : null;
  const armorSummary = buildCharacterArmorSummary({
    characterSize: characterInputs?.size ?? null,
    item: armorItem,
    template: armorTemplate,
  });
  const sortedWeaponRows = [...snapshot.weaponRows].sort((left, right) => {
    return (
      getWeaponRowSortOrder(left) - getWeaponRowSortOrder(right) ||
      left.currentItemLabel.localeCompare(right.currentItemLabel)
    );
  });

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
    rows: sortedWeaponRows.map((row) => [
      row.modeLabel,
      row.slotLabel === "Combined" && combinedClassLabel ? combinedClassLabel : row.currentItemLabel,
      getWeaponModeValue(
        row.slotLabel === "Brawling"
          ? sortedWeaponRows.find((candidate) => candidate.slotLabel === "Punch")?.initiative ?? row.initiative
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
      value: `${getIntegerStyleDisplayValue(snapshot.personalEncumbrance)} / ${snapshot.personalItemCount} / ${snapshot.encumbranceLevel}`,
    },
    { label: "Mov/mod", value: `${snapshot.movementSummary} / ${snapshot.movementModifierSummary}` },
  ];
  const armorRows: CombatStateDetailRow[] = armorItem && armorSummary
    ? [
        { label: "Armor", value: armorTemplate?.name ?? "Unknown item" },
        { label: "General armor", value: armorSummary.generalArmorWithType },
        { label: "AA modifier", value: armorSummary.aaModifier ?? "—" },
        { label: "Perception modifier", value: armorSummary.perceptionModifier ?? "—" },
      ]
    : [{ label: "Armor", value: "No armor is currently worn." }];
  const armorTable: CombatStateTableModel | undefined = armorSummary
    ? {
        title: "Armor coverage",
        columns: [
          "Head",
          "Front Arm",
          "Chest",
          "Back Arm",
          "Abdomen",
          "Front Thigh",
          "Front Foot",
          "Back Thigh",
          "Back Foot",
        ],
        rows: [armorSummary.locations.map((location) => location.valueWithType)],
      }
    : undefined;

  return {
    title: "Combat State Panel",
    description: "",
    statsRows,
    armorRows,
    armorTable,
    weaponModeTable,
    capabilityRows,
  };
}
