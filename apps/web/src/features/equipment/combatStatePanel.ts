import {
  type ArmorTemplate,
  type EquipmentItem,
  type EquipmentTemplate,
  type ShieldTemplate,
  type WeaponTemplate,
} from "@glantri/domain/equipment";

import {
  getBackpackItems,
  getCharacterGearItems,
  getCharacterValuableItems,
  getEncounterAccessibleCoinQuantity,
  getEncounterAccessibleGearItems,
  getEncounterAccessibleValuableItems,
  getEquipmentTemplateById,
  getLoadoutEquipment,
  getMountEncumbranceTotal,
  getPersonalEncumbranceTotal,
  getStoredItems,
  getWithYouItems,
} from "./equipmentSelectors";
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

function getTemplateName(state: EquipmentFeatureState, item: EquipmentItem | undefined): string {
  if (!item) {
    return "None";
  }

  return getEquipmentTemplateById(state, item.templateId)?.name ?? "Unknown item";
}

function getItemLabel(state: EquipmentFeatureState, item: EquipmentItem | undefined): string {
  if (!item) {
    return "None";
  }

  const typeName = getTemplateName(state, item);
  return item.displayName ? `${item.displayName} (${typeName})` : typeName;
}

function getGripSummary(input: {
  primaryTemplate: WeaponTemplate | null;
  secondaryTemplate: WeaponTemplate | null;
  missileTemplate: WeaponTemplate | null;
  shieldTemplate: ShieldTemplate | null;
}): string {
  const primaryHandling = input.primaryTemplate?.handlingClass;

  if (input.primaryTemplate && input.secondaryTemplate && !input.shieldTemplate) {
    return "Dual-wield / paired weapons ready";
  }

  if (primaryHandling === "two_handed" || primaryHandling === "polearm") {
    return "Two-handed primary";
  }

  if (input.primaryTemplate && input.shieldTemplate) {
    return "One-handed + shield";
  }

  if (input.primaryTemplate && input.secondaryTemplate) {
    return "One-handed primary with secondary carried";
  }

  if (input.primaryTemplate) {
    return "One-handed";
  }

  if (input.missileTemplate) {
    return "Missile ready";
  }

  if (input.shieldTemplate) {
    return "Shield-ready, otherwise unarmed";
  }

  return "Unarmed";
}

function getMobilitySummary(input: {
  armorTemplate: ArmorTemplate | null;
  personalEncumbrance: number;
  backpackCount: number;
  mountEncumbrance: number;
}): string {
  if (input.armorTemplate?.mobilityPenalty && input.armorTemplate.mobilityPenalty > 0) {
    return `Armor mobility penalty ${input.armorTemplate.mobilityPenalty}; current personal encumbrance ${input.personalEncumbrance}.`;
  }

  if (input.personalEncumbrance > 20) {
    return `Higher carried load at ${input.personalEncumbrance} encumbrance; movement rules are not yet fully derived here.`;
  }

  if (input.backpackCount > 0 || input.mountEncumbrance > 0) {
    return "Travel load distributed across backpack/mount; exact movement modifiers are not yet fully derived here.";
  }

  return "Light carried state; exact movement modifiers are not yet fully derived here.";
}

function getProtectionCoverageLabel(armorTemplate: ArmorTemplate | null): string {
  if (!armorTemplate) {
    return "Unarmored";
  }

  return armorTemplate.subtype ? formatLabel(armorTemplate.subtype) : armorTemplate.name;
}

function getWeaponModeValue(value: string | number | null | undefined): CombatStateValue {
  return value ?? "—";
}

function getWeaponNotes(template: WeaponTemplate | null): string {
  if (!template) {
    return "Not equipped";
  }

  const notes: string[] = [];
  notes.push(`Handling ${formatLabel(template.handlingClass)}`);

  if (template.range) {
    notes.push(`Range ${template.range}`);
  }

  if (template.parry != null) {
    notes.push(`Parry ${template.parry}`);
  }

  if (template.defensiveValue != null) {
    notes.push(`Template defensive ${template.defensiveValue}`);
  }

  return notes.join(" | ");
}

export function buildCombatStatePanelModel(
  state: EquipmentFeatureState,
  characterId: string,
): CombatStatePanelModel {
  const loadout = getLoadoutEquipment(state, characterId);
  const personalEncumbrance = getPersonalEncumbranceTotal(state, characterId);
  const mountEncumbrance = getMountEncumbranceTotal(state, characterId);
  const backpackCount = getBackpackItems(state, characterId).length;
  const gearCount = getCharacterGearItems(state, characterId).length;
  const encounterAccessibleGearCount = getEncounterAccessibleGearItems(state, characterId).length;
  const valuablesCount = getCharacterValuableItems(state, characterId).length;
  const encounterAccessibleValuablesCount =
    getEncounterAccessibleValuableItems(state, characterId).length;
  const carriedCoinQuantity = getEncounterAccessibleCoinQuantity(state, characterId);
  const storedCount = getStoredItems(state, characterId).length;
  const withYouCount = getWithYouItems(state, characterId).length;

  const armorItem = "armor" in loadout ? loadout.armor : undefined;
  const shieldItem = "shield" in loadout ? loadout.shield : undefined;
  const primaryItem = "primary" in loadout ? loadout.primary : undefined;
  const secondaryItem = "secondary" in loadout ? loadout.secondary : undefined;
  const missileItem = "missile" in loadout ? loadout.missile : undefined;

  const armorTemplate = armorItem
    ? asArmorTemplate(getEquipmentTemplateById(state, armorItem.templateId))
    : null;
  const shieldTemplate = shieldItem
    ? asShieldTemplate(getEquipmentTemplateById(state, shieldItem.templateId))
    : null;
  const primaryWeaponTemplate = primaryItem
    ? asWeaponTemplate(getEquipmentTemplateById(state, primaryItem.templateId))
    : null;
  const secondaryWeaponTemplate = secondaryItem
    ? asWeaponTemplate(getEquipmentTemplateById(state, secondaryItem.templateId))
    : null;
  const missileWeaponTemplate = missileItem
    ? asWeaponTemplate(getEquipmentTemplateById(state, missileItem.templateId))
    : null;

  const gripSummary = getGripSummary({
    missileTemplate: missileWeaponTemplate,
    primaryTemplate: primaryWeaponTemplate,
    secondaryTemplate: secondaryWeaponTemplate,
    shieldTemplate,
  });
  const movementSummary = getMobilitySummary({
    armorTemplate,
    backpackCount,
    mountEncumbrance,
    personalEncumbrance,
  });

  const currentUseRows: CombatStateDetailRow[] = [
    { label: "Grip / current use", value: gripSummary },
    { label: "Worn armor", value: getItemLabel(state, armorItem) },
    { label: "Ready shield", value: getItemLabel(state, shieldItem) },
    { label: "Active primary weapon", value: getItemLabel(state, primaryItem) },
    { label: "Active secondary weapon", value: getItemLabel(state, secondaryItem) },
    { label: "Active missile weapon", value: getItemLabel(state, missileItem) },
    {
      label: "Unarmed baseline",
      value: "Available as fallback; exact shared unarmed combat values are not yet fully derived.",
    },
  ];

  const armorProtectionRows: CombatStateDetailRow[] = [
    { label: "Worn armor", value: getItemLabel(state, armorItem) },
    { label: "Armor rating", value: armorTemplate?.armorRating ?? "Unarmored" },
    { label: "Armor mobility penalty", value: armorTemplate?.mobilityPenalty ?? "—" },
    { label: "Ready shield", value: getItemLabel(state, shieldItem) },
    { label: "Shield bonus", value: shieldTemplate?.shieldBonus ?? "No ready shield" },
    {
      label: "Shield defensive value",
      value: shieldTemplate?.defensiveValue ?? "No ready shield",
    },
  ];

  const armorProtectionTable: CombatStateTableModel = {
    title: "Armor and Protection by Location",
    description:
      "The table structure is ready for sheet-style body locations. Only the general armor item values are exact right now; the location rows are clearly interim until location-based armor derivation exists.",
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
        armorTemplate ? getItemLabel(state, armorItem) : "Unarmored",
        isGeneral
          ? armorTemplate?.armorRating ?? "Unarmored"
          : armorTemplate
            ? `Uses general AR ${armorTemplate.armorRating ?? "n/a"} (interim)`
            : "Unarmored",
        isGeneral
          ? armorTemplate?.mobilityPenalty ?? "—"
          : "Location crit mod not yet derived",
        isGeneral
          ? getProtectionCoverageLabel(armorTemplate)
          : armorTemplate
            ? `${getProtectionCoverageLabel(armorTemplate)} (general coverage only)`
            : "No armor",
      ];
    }),
  };

  const weaponModeTable: CombatStateTableModel = {
    title: "Weapons and Defense",
    description:
      "Weapon-mode values come directly from current templates where they exist. DB, DM, and unarmed numbers stay explicitly interim until shared combat derivation is implemented.",
    columns: [
      "Mode",
      "Current item",
      "I",
      "OB",
      "DMB",
      "Attack 1",
      "Crit 1",
      "OB2",
      "DMB2",
      "Attack 2",
      "Crit 2",
      "DB",
      "DM",
      "Parry",
      "Notes",
    ],
    rows: [
      [
        "Primary weapon",
        primaryWeaponTemplate ? getItemLabel(state, primaryItem) : "None",
        getWeaponModeValue(primaryWeaponTemplate?.initiative),
        getWeaponModeValue(primaryWeaponTemplate?.ob1),
        getWeaponModeValue(primaryWeaponTemplate?.dmb1),
        getWeaponModeValue(primaryWeaponTemplate?.primaryAttackType),
        getWeaponModeValue(primaryWeaponTemplate?.crit1),
        getWeaponModeValue(primaryWeaponTemplate?.ob2),
        getWeaponModeValue(primaryWeaponTemplate?.dmb2),
        getWeaponModeValue(primaryWeaponTemplate?.secondaryAttackType),
        getWeaponModeValue(primaryWeaponTemplate?.crit2 ?? primaryWeaponTemplate?.secondCrit),
        "Not yet fully derived",
        "Not yet fully derived",
        getWeaponModeValue(primaryWeaponTemplate?.parry ?? primaryWeaponTemplate?.defensiveValue),
        getWeaponNotes(primaryWeaponTemplate),
      ],
      [
        "Secondary weapon",
        secondaryWeaponTemplate ? getItemLabel(state, secondaryItem) : "None",
        getWeaponModeValue(secondaryWeaponTemplate?.initiative),
        getWeaponModeValue(secondaryWeaponTemplate?.ob1),
        getWeaponModeValue(secondaryWeaponTemplate?.dmb1),
        getWeaponModeValue(secondaryWeaponTemplate?.primaryAttackType),
        getWeaponModeValue(secondaryWeaponTemplate?.crit1),
        getWeaponModeValue(secondaryWeaponTemplate?.ob2),
        getWeaponModeValue(secondaryWeaponTemplate?.dmb2),
        getWeaponModeValue(secondaryWeaponTemplate?.secondaryAttackType),
        getWeaponModeValue(secondaryWeaponTemplate?.crit2 ?? secondaryWeaponTemplate?.secondCrit),
        "Not yet fully derived",
        "Not yet fully derived",
        getWeaponModeValue(
          secondaryWeaponTemplate?.parry ?? secondaryWeaponTemplate?.defensiveValue,
        ),
        getWeaponNotes(secondaryWeaponTemplate),
      ],
      [
        "Missile weapon",
        missileWeaponTemplate ? getItemLabel(state, missileItem) : "None",
        getWeaponModeValue(missileWeaponTemplate?.initiative),
        getWeaponModeValue(missileWeaponTemplate?.ob1),
        getWeaponModeValue(missileWeaponTemplate?.dmb1),
        getWeaponModeValue(missileWeaponTemplate?.primaryAttackType),
        getWeaponModeValue(missileWeaponTemplate?.crit1),
        getWeaponModeValue(missileWeaponTemplate?.ob2),
        getWeaponModeValue(missileWeaponTemplate?.dmb2),
        getWeaponModeValue(missileWeaponTemplate?.secondaryAttackType),
        getWeaponModeValue(missileWeaponTemplate?.crit2 ?? missileWeaponTemplate?.secondCrit),
        "Not yet fully derived",
        "Not yet fully derived",
        getWeaponModeValue(missileWeaponTemplate?.parry ?? missileWeaponTemplate?.defensiveValue),
        getWeaponNotes(missileWeaponTemplate),
      ],
      [
        "Unarmed / brawling",
        "Unarmed baseline",
        "Not yet fully derived",
        "Not yet fully derived",
        "Not yet fully derived",
        "Baseline strike/grapple not yet wired",
        "—",
        "—",
        "—",
        "—",
        "—",
        "Not yet fully derived",
        "Not yet fully derived",
        "Not yet fully derived",
        "Shown explicitly so future combat derivation has a visible home.",
      ],
    ],
  };

  const weaponDefenseRows: CombatStateDetailRow[] = [
    { label: "Current grip", value: gripSummary },
    {
      label: "Primary notes",
      value: primaryWeaponTemplate ? getWeaponNotes(primaryWeaponTemplate) : "No active primary weapon",
    },
    {
      label: "Secondary notes",
      value:
        secondaryWeaponTemplate ? getWeaponNotes(secondaryWeaponTemplate) : "No active secondary weapon",
    },
    {
      label: "Missile notes",
      value: missileWeaponTemplate ? getWeaponNotes(missileWeaponTemplate) : "No active missile weapon",
    },
    {
      label: "Defense status",
      value:
        shieldTemplate ||
        primaryWeaponTemplate?.parry != null ||
        primaryWeaponTemplate?.defensiveValue != null
          ? "Shield and template defensive values are exact where shown; combined DB/DM remains interim."
          : "No exact current DB/DM defense stack is derived yet.",
    },
  ];

  const capabilityRows: CombatStateDetailRow[] = [
    { label: "Personal encumbrance", value: personalEncumbrance },
    { label: "Mount encumbrance", value: mountEncumbrance },
    { label: "Movement", value: movementSummary },
    {
      label: "Movement modifier",
      value:
        armorTemplate?.mobilityPenalty != null
          ? `Exact current armor mobility penalty: ${armorTemplate.mobilityPenalty}`
          : "No exact shared movement modifier is derived yet.",
    },
    {
      label: "Perception",
      value:
        "No exact perception penalty is currently derived from encumbrance/loadout; current carried state is the combat input.",
    },
    { label: "Gear item count", value: gearCount },
    { label: "Valuables item count", value: valuablesCount },
    { label: "Backpack items", value: backpackCount },
    { label: "With-you items", value: withYouCount },
    { label: "Stored elsewhere", value: storedCount },
    { label: "Encounter-accessible gear", value: encounterAccessibleGearCount },
    { label: "Encounter-accessible valuables", value: encounterAccessibleValuablesCount },
    { label: "Carried coin quantity", value: carriedCoinQuantity },
    {
      label: "Key action skills",
      value:
        "Acrobatics, Stealth, Swim, Ride, Climb, Dodge, Parry, and Brawling are not yet wired into this persisted combat read-model.",
    },
  ];

  return {
    title: "Combat State Panel",
    description:
      "Structured read-only combat snapshot of the current persisted fighting state, intended to grow into a reusable combat-facing panel.",
    currentUseRows,
    armorProtectionRows,
    armorProtectionTable,
    weaponModeTable,
    weaponDefenseRows,
    capabilityRows,
  };
}
