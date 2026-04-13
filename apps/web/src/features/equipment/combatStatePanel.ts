import type { ArmorTemplate } from "@glantri/domain";
import type { CombatAllocationState } from "../../../../../packages/rules-engine/src/combat/combatAllocationState";

import { getLoadoutEquipment, getEquipmentTemplateById } from "./equipmentSelectors";
import {
  type CombatStateCharacterInputs,
  deriveCombatStateSnapshot,
  type DerivedCombatValue,
} from "./combatStateDerivation";
import { formatEncumbranceDisplay } from "./displayFormatting";
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
  armorProtectionRows: CombatStateDetailRow[];
  armorProtectionTable: CombatStateTableModel;
  weaponModeTable: CombatStateTableModel;
  weaponDefenseRows: CombatStateDetailRow[];
  capabilityRows: CombatStateDetailRow[];
}

function asArmorTemplate(template: ReturnType<typeof getEquipmentTemplateById>): ArmorTemplate | null {
  return template?.category === "armor" ? template : null;
}

function formatLabel(value: string): string {
  return value
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function getProtectionCoverageLabel(armorTemplate: ArmorTemplate | null): string {
  if (!armorTemplate) {
    return "Unarmored";
  }

  return armorTemplate.subtype ? formatLabel(armorTemplate.subtype) : armorTemplate.name;
}

function getWeaponModeValue(value: DerivedCombatValue | null | undefined): CombatStateValue {
  return value ?? "—";
}

function getEncumbranceDisplayValue(value: CombatStateValue): CombatStateValue {
  return typeof value === "number" ? formatEncumbranceDisplay(value) : value;
}

export function buildCombatStatePanelModel(
  state: EquipmentFeatureState,
  characterId: string,
  characterInputs?: CombatStateCharacterInputs,
  allocationInputs?: CombatAllocationState,
): CombatStatePanelModel {
  const snapshot = deriveCombatStateSnapshot(state, characterId, characterInputs, allocationInputs);
  const loadout = getLoadoutEquipment(state, characterId);
  const armorItem = "armor" in loadout ? loadout.armor : undefined;
  const armorTemplate = armorItem
    ? asArmorTemplate(getEquipmentTemplateById(state, armorItem.templateId))
    : null;

  const statsRows: CombatStateDetailRow[] = [
    {
      label: "Strength",
      value: formatStatPair(characterInputs?.strength ?? null, characterInputs?.strengthGm ?? null),
    },
    {
      label: "Constitution",
      value: formatStatPair(characterInputs?.constitution ?? null, null),
    },
    {
      label: "Dexterity",
      value: formatStatPair(characterInputs?.dexterity ?? null, characterInputs?.dexterityGm ?? null),
    },
    {
      label: "Size",
      value: formatStatPair(characterInputs?.size ?? null, characterInputs?.sizeGm ?? null),
    },
  ];

  const armorProtectionRows: CombatStateDetailRow[] = [
    { label: "Worn armor", value: snapshot.wornArmorLabel },
    { label: "Armor rating", value: snapshot.armorRating },
    { label: "Armor mobility penalty", value: snapshot.armorMobilityPenalty },
    { label: "Ready shield", value: snapshot.readyShieldLabel },
    { label: "Shield bonus", value: snapshot.shieldBonus },
    {
      label: "Shield defensive value",
      value: snapshot.shieldDefensiveValue,
    },
  ];

  const armorProtectionTable: CombatStateTableModel = {
    title: "Armor and Protection by Location",
    description:
      "General armor and shield values are exact where shown. Body-location coverage stays clearly interim until armor-by-location rules are encoded.",
    columns: ["Location", "Armor", "Armor value", "Crit mod", "Type"],
    rows: [
      "Head",
      "Front Arm",
      "Back Arm",
      "Abdomen",
      "Front Thigh",
      "Front Foot",
      "Back Thigh",
      "Back Foot",
      "General",
    ].map((location) => {
      const isGeneral = location === "General";

      return [
        location,
        armorTemplate ? snapshot.wornArmorLabel : "Unarmored",
        isGeneral
          ? snapshot.armorRating
          : armorTemplate
            ? `Uses general AR ${snapshot.armorRating} (interim)`
            : "Unarmored",
        isGeneral
          ? snapshot.armorMobilityPenalty
          : "Location crit mod not yet derived",
        isGeneral
          ? snapshot.armorCoverageType
          : armorTemplate
            ? `${getProtectionCoverageLabel(armorTemplate)} (general coverage only)`
            : "No armor",
      ];
    }),
  };

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
      getWeaponModeValue(row.initiative),
      getWeaponModeValue(row.attack1),
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

  const weaponDefenseRows: CombatStateDetailRow[] = [];

  const capabilityRows: CombatStateDetailRow[] = [
    { label: "Unarmed DB / DM", value: formatDbDmPair(snapshot.unarmedDbSummary, snapshot.unarmedDmSummary) },
    { label: snapshot.combinedParryLabel, value: snapshot.combinedParrySummary },
    {
      label: snapshot.twoItemDefenseLabel,
      value: formatDbDmPair(snapshot.twoItemDbSummary, snapshot.twoItemDmSummary),
    },
    { label: "Encumbrance capacity", value: getEncumbranceDisplayValue(snapshot.encumbranceCapacity) },
    { label: "Gear item count", value: snapshot.gearCount },
    { label: "Personal encumbrance", value: getEncumbranceDisplayValue(snapshot.personalEncumbrance) },
    { label: "Encumbrance level", value: snapshot.encumbranceLevel },
    { label: "Shield movement modifier", value: snapshot.shieldMovementModifierSummary },
    {
      label: "Movement modifier",
      value: snapshot.movementModifierSummary,
    },
    { label: "Movement", value: snapshot.movementSummary },
  ];

  return {
    title: "Combat State Panel",
    description:
      "Structured read-only combat snapshot of the current persisted fighting state, using imported weapon modes, current loadout selections, and live character inputs where the combat rules document marks them as safely derivable.",
    statsRows,
    armorProtectionRows,
    armorProtectionTable,
    weaponModeTable,
    weaponDefenseRows,
    capabilityRows,
  };
}

function formatDbDmPair(db: CombatStateValue, dm: CombatStateValue): string {
  return `DB ${db} / DM ${dm}`;
}

function formatStatPair(value: number | null, gm: number | null): string {
  if (value == null) {
    return "—";
  }

  if (gm == null) {
    return `${value} / GM —`;
  }

  return `${value} / GM ${gm >= 0 ? `+${gm}` : gm}`;
}
