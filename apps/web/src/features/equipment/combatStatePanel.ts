import type { ArmorTemplate } from "@glantri/domain";
import type { CombatAllocationState } from "../../../../../packages/rules-engine/src/combat/combatAllocationState";

import { getLoadoutEquipment, getEquipmentTemplateById } from "./equipmentSelectors";
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
  currentUseRows: CombatStateDetailRow[];
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

  const currentUseRows: CombatStateDetailRow[] = [
    { label: "Grip / current use", value: snapshot.gripSummary },
    { label: "Worn armor", value: snapshot.wornArmorLabel },
    { label: "Ready shield", value: snapshot.readyShieldLabel },
    { label: "Active primary weapon", value: snapshot.activePrimaryLabel },
    { label: "Active secondary weapon", value: snapshot.activeSecondaryLabel },
    { label: "Active missile weapon", value: snapshot.activeMissileLabel },
    { label: "Unarmed baseline", value: snapshot.unarmedSummary },
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
    title: "Weapons and Defense",
    description:
      "Weapon mode values derive from the imported attack-mode catalog, current loadout selection, and available live character inputs. Formula DMB stays explicit, and values that still depend on deeper allocation or situational rules remain clearly interim.",
    columns: [
      "Mode",
      "Current item",
      "I",
      "OB",
      "DMB",
      "Attack 1",
      "Crit 1",
      "Armor mod 1",
      "OB2",
      "DMB2",
      "Attack 2",
      "Crit 2",
      "Armor mod 2",
      "DB",
      "DM",
      "Parry",
      "Notes",
    ],
    rows: snapshot.weaponRows.map((row) => [
      row.slotLabel,
      row.currentItemLabel,
      getWeaponModeValue(row.initiative),
      getWeaponModeValue(row.ob1),
      getWeaponModeValue(row.dmb1),
      getWeaponModeValue(row.attack1),
      getWeaponModeValue(row.crit1),
      getWeaponModeValue(row.armorMod1),
      getWeaponModeValue(row.ob2),
      getWeaponModeValue(row.dmb2),
      getWeaponModeValue(row.attack2),
      getWeaponModeValue(row.crit2),
      getWeaponModeValue(row.armorMod2),
      getWeaponModeValue(row.db),
      getWeaponModeValue(row.dm),
      getWeaponModeValue(row.parry),
      row.notes,
    ]),
  };

  const weaponDefenseRows: CombatStateDetailRow[] = [
    { label: "Current grip", value: snapshot.gripSummary },
    { label: "Primary notes", value: snapshot.primaryNotes },
    { label: "Secondary notes", value: snapshot.secondaryNotes },
    { label: "Missile notes", value: snapshot.missileNotes },
    {
      label: "Defense status",
      value: snapshot.defenseSummary,
    },
  ];

  const capabilityRows: CombatStateDetailRow[] = [
    { label: "Readiness", value: snapshot.readinessSummary },
    { label: "Personal encumbrance", value: snapshot.personalEncumbrance },
    { label: "Mount encumbrance", value: snapshot.mountEncumbrance },
    { label: "Movement", value: snapshot.movementSummary },
    {
      label: "Movement modifier",
      value: snapshot.movementModifierSummary,
    },
    {
      label: "Perception",
      value: snapshot.perceptionSummary,
    },
    { label: "Gear item count", value: snapshot.gearCount },
    { label: "Valuables item count", value: snapshot.valuablesCount },
    { label: "Backpack items", value: snapshot.backpackCount },
    { label: "With-you items", value: snapshot.withYouCount },
    { label: "Stored elsewhere", value: snapshot.storedCount },
    { label: "Encounter-accessible gear", value: snapshot.encounterAccessibleGearCount },
    { label: "Encounter-accessible valuables", value: snapshot.encounterAccessibleValuablesCount },
    { label: "Carried coin quantity", value: snapshot.carriedCoinQuantity },
    {
      label: "Load notes",
      value: snapshot.loadNotes,
    },
  ];

  return {
    title: "Combat State Panel",
    description:
      "Structured read-only combat snapshot of the current persisted fighting state, using imported weapon modes, current loadout selections, and live character inputs where the combat rules document marks them as safely derivable.",
    currentUseRows,
    armorProtectionRows,
    armorProtectionTable,
    weaponModeTable,
    weaponDefenseRows,
    capabilityRows,
  };
}
