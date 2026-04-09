import {
  getMaterialFactor,
  getQualityFactor,
  type ArmorTemplate,
  type EquipmentItem,
  type EquipmentTemplate,
  type ShieldTemplate,
  type WeaponAttackMode,
  type WeaponDamageModifierFormula,
  type WeaponTemplate,
} from "@glantri/domain";

import {
  getBackpackItems,
  getCharacterGearItems,
  getCharacterValuableItems,
  getEncounterAccessibleCoinQuantity,
  getEncounterAccessibleGearItems,
  getEncounterAccessibleValuableItems,
  getEquipmentTemplateById,
  getLoadoutEquipment,
  getPersonalEncumbranceTotal,
  getStoredItems,
  getWithYouItems,
} from "./equipmentSelectors";
import type { EquipmentFeatureState } from "./types";

export type DerivedCombatValue = string | number;

export interface DerivedCombatWeaponRow {
  slotLabel: string;
  currentItemLabel: string;
  initiative: DerivedCombatValue;
  ob1: DerivedCombatValue;
  dmb1: DerivedCombatValue;
  attack1: DerivedCombatValue;
  crit1: DerivedCombatValue;
  ob2: DerivedCombatValue;
  dmb2: DerivedCombatValue;
  attack2: DerivedCombatValue;
  crit2: DerivedCombatValue;
  db: DerivedCombatValue;
  dm: DerivedCombatValue;
  parry: DerivedCombatValue;
  notes: string;
}

export interface DerivedCombatStateSnapshot {
  gripSummary: string;
  movementSummary: string;
  movementModifierSummary: string;
  perceptionSummary: string;
  defenseSummary: string;
  loadNotes: string;
  personalEncumbrance: number;
  mountEncumbrance: number;
  gearCount: number;
  encounterAccessibleGearCount: number;
  valuablesCount: number;
  encounterAccessibleValuablesCount: number;
  carriedCoinQuantity: number;
  backpackCount: number;
  storedCount: number;
  withYouCount: number;
  wornArmorLabel: string;
  readyShieldLabel: string;
  activePrimaryLabel: string;
  activeSecondaryLabel: string;
  activeMissileLabel: string;
  unarmedSummary: string;
  armorRating: DerivedCombatValue;
  armorMobilityPenalty: DerivedCombatValue;
  shieldBonus: DerivedCombatValue;
  shieldDefensiveValue: DerivedCombatValue;
  armorCoverageType: string;
  weaponRows: DerivedCombatWeaponRow[];
  primaryNotes: string;
  secondaryNotes: string;
  missileNotes: string;
}

function formatLabel(value: string): string {
  return value
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function formatDamageClass(value: WeaponAttackMode["damageClass"]): string {
  return value ? formatLabel(value) : "Unspecified";
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

function getAttackMode(template: WeaponTemplate | null, modeId: string): WeaponAttackMode | null {
  return template?.attackModes?.find((mode) => mode.id === modeId) ?? null;
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

function canUseReadyShieldWithWeapon(
  template: WeaponTemplate | null,
  shieldTemplate: ShieldTemplate | null,
  secondaryTemplate: WeaponTemplate | null,
): boolean {
  if (!shieldTemplate) {
    return false;
  }

  if (!template) {
    return true;
  }

  if (secondaryTemplate) {
    return false;
  }

  return (
    template.handlingClass === "one_handed" ||
    template.handlingClass === "light" ||
    template.handlingClass === "paired"
  );
}

function formatFormulaModifier(value: number | null | undefined): string {
  if (value == null || value === 0) {
    return "";
  }

  return value > 0 ? `+${value}` : `${value}`;
}

function formatDmbFormula(formula: WeaponDamageModifierFormula | null | undefined): string {
  if (!formula) {
    return "—";
  }

  switch (formula.kind) {
    case "numeric":
      return `${formula.numericValue ?? formula.raw}`;
    case "dice": {
      const dice = `${formula.diceCount ?? 0}d${formula.diceSides ?? 0}`;
      const flat = formatFormulaModifier(formula.flatModifier);
      const text = formula.textModifier ? ` + ${formula.textModifier}` : "";
      return `${dice}${flat}${text} (formula)`;
    }
    case "special":
      return `${formula.specialValue ?? formula.raw} (special)`;
    case "unresolved":
      return `${formula.raw} (unresolved)`;
  }
}

function getDmbValue(mode: WeaponAttackMode | null): DerivedCombatValue {
  if (!mode) {
    return "—";
  }

  if (mode.dmb != null) {
    return mode.dmb;
  }

  if (mode.dmbFormula) {
    return formatDmbFormula(mode.dmbFormula);
  }

  if (mode.dmbRaw) {
    return `${mode.dmbRaw} (raw)`;
  }

  return "—";
}

function getAttackLabel(mode: WeaponAttackMode | null): DerivedCombatValue {
  if (!mode) {
    return "—";
  }

  const baseLabel = mode.label ?? formatLabel(mode.id);
  return `${baseLabel} (${formatDamageClass(mode.damageClass)})`;
}

function formatModeCatalogNote(mode: WeaponAttackMode | null): string | null {
  if (!mode) {
    return null;
  }

  const parts = [
    `${mode.label ?? formatLabel(mode.id)} ${formatDamageClass(mode.damageClass)}`,
  ];

  if (mode.armorModifier) {
    parts.push(`AM ${mode.armorModifier}`);
  }

  if (mode.dmbFormula?.kind === "unresolved") {
    parts.push(`DMB ${mode.dmbFormula.raw} unresolved`);
  }

  return parts.join(" | ");
}

function formatEncumbranceNote(template: WeaponTemplate | null): string | null {
  if (!template?.baseEncumbranceFormula) {
    return null;
  }

  const formula = template.baseEncumbranceFormula;

  if (formula.kind === "ammo_linked") {
    return `Source encumbrance ${formula.raw} is ammo-linked; current totals still use base ${template.baseEncumbrance}.`;
  }

  if (formula.kind === "special") {
    return `Source encumbrance ${formula.raw} is special-case text.`;
  }

  if (formula.kind === "unresolved") {
    return `Source encumbrance ${formula.raw} remains unresolved.`;
  }

  return null;
}

function formatWeaponNotes(template: WeaponTemplate | null): string {
  if (!template) {
    return "Not equipped";
  }

  const notes: string[] = [];
  notes.push(`Handling ${formatLabel(template.handlingClass)}`);

  if (template.range) {
    notes.push(`Range ${template.range}`);
  }

  const mode1 = formatModeCatalogNote(getAttackMode(template, "mode-1"));
  const mode2 = formatModeCatalogNote(getAttackMode(template, "mode-2"));
  if (mode1) {
    notes.push(mode1);
  }
  if (mode2) {
    notes.push(mode2);
  }

  if (template.parry != null) {
    notes.push(`Parry ${template.parry}`);
  }

  if (template.defensiveValue != null) {
    notes.push(`DM ${template.defensiveValue}`);
  }

  const encumbranceNote = formatEncumbranceNote(template);
  if (encumbranceNote) {
    notes.push(encumbranceNote);
  }

  return notes.join(" | ");
}

function getIntrinsicItemEncumbrance(item: EquipmentItem, template: EquipmentTemplate): number {
  return (
    template.baseEncumbrance *
    item.quantity *
    getMaterialFactor(item.material) *
    getQualityFactor(item.quality)
  );
}

function getMountEncumbranceTotal(
  state: EquipmentFeatureState,
  characterId: string,
): number {
  return Object.values(state.itemsById)
    .filter(
      (item) =>
        item.characterId === characterId && item.storageAssignment.carryMode === "mount",
    )
    .reduce((total, item) => {
      const template = getEquipmentTemplateById(state, item.templateId);
      if (!template) {
        return total;
      }

      return total + getIntrinsicItemEncumbrance(item, template);
    }, 0);
}

function getProtectionCoverageLabel(armorTemplate: ArmorTemplate | null): string {
  if (!armorTemplate) {
    return "Unarmored";
  }

  return armorTemplate.subtype ? formatLabel(armorTemplate.subtype) : armorTemplate.name;
}

function buildWeaponRow(input: {
  slotLabel: string;
  item: EquipmentItem | undefined;
  secondaryTemplate?: WeaponTemplate | null;
  shieldTemplate: ShieldTemplate | null;
  state: EquipmentFeatureState;
  template: WeaponTemplate | null;
}): DerivedCombatWeaponRow {
  const mode1 = getAttackMode(input.template, "mode-1");
  const mode2 = getAttackMode(input.template, "mode-2");
  const shieldUsable = canUseReadyShieldWithWeapon(
    input.template,
    input.shieldTemplate,
    input.secondaryTemplate ?? null,
  );
  const dbValue = shieldUsable ? input.shieldTemplate?.shieldBonus ?? "—" : "—";
  const dmValue = input.template?.defensiveValue ?? "—";
  const notes = input.template ? formatWeaponNotes(input.template) : "Not equipped";

  return {
    slotLabel: input.slotLabel,
    currentItemLabel: input.template ? getItemLabel(input.state, input.item) : "None",
    initiative: input.template?.initiative ?? "—",
    ob1: mode1?.ob ?? "—",
    dmb1: getDmbValue(mode1),
    attack1: getAttackLabel(mode1),
    crit1: mode1?.crit ?? "—",
    ob2: mode2?.ob ?? "—",
    dmb2: getDmbValue(mode2),
    attack2: getAttackLabel(mode2),
    crit2: mode2?.crit ?? "—",
    db: dbValue,
    dm: dmValue,
    parry: input.template?.parry ?? "—",
    notes,
  };
}

function buildUnarmedRow(input: {
  shieldTemplate: ShieldTemplate | null;
}): DerivedCombatWeaponRow {
  return {
    slotLabel: "Unarmed / brawling",
    currentItemLabel: "Unarmed baseline",
    initiative: "Interim",
    ob1: "Interim",
    dmb1: "Interim",
    attack1: "Strike / grapple baseline",
    crit1: "—",
    ob2: "—",
    dmb2: "—",
    attack2: "—",
    crit2: "—",
    db: input.shieldTemplate?.shieldBonus ?? "—",
    dm: input.shieldTemplate?.defensiveValue ?? "—",
    parry: "Interim",
    notes:
      input.shieldTemplate
        ? `Shield DB ${input.shieldTemplate.shieldBonus} and shield defensive ${input.shieldTemplate.defensiveValue ?? "—"} are exact; unarmed strike values remain interim.`
        : "Unarmed fallback stays visible, but strike/grapple numbers remain interim until brawling rules are encoded.",
  };
}

function getMovementSummary(input: {
  armorTemplate: ArmorTemplate | null;
  backpackCount: number;
  mountEncumbrance: number;
  personalEncumbrance: number;
}): string {
  const notes: string[] = [];

  if (input.armorTemplate?.mobilityPenalty != null) {
    notes.push(`Armor MP ${input.armorTemplate.mobilityPenalty}`);
  }

  notes.push(`Personal encumbrance ${input.personalEncumbrance}`);

  if (input.backpackCount > 0) {
    notes.push(`${input.backpackCount} backpack item${input.backpackCount === 1 ? "" : "s"}`);
  }

  if (input.mountEncumbrance > 0) {
    notes.push(`Mount load ${input.mountEncumbrance}`);
  }

  return notes.join(" | ");
}

function getMovementModifierSummary(armorTemplate: ArmorTemplate | null): string {
  if (armorTemplate?.mobilityPenalty != null) {
    return `${armorTemplate.mobilityPenalty} from armor; encumbrance-based movement penalties are still interim.`;
  }

  return "0 from armor; encumbrance-based movement penalties are still interim.";
}

function getPerceptionSummary(input: {
  backpackCount: number;
  withYouCount: number;
}): string {
  return `No exact shared perception penalty is encoded yet; current carried state is ${input.withYouCount} with-you items, including ${input.backpackCount} in backpack.`;
}

function getDefenseSummary(input: {
  primaryTemplate: WeaponTemplate | null;
  shieldTemplate: ShieldTemplate | null;
}): string {
  const notes: string[] = [];

  if (input.shieldTemplate) {
    notes.push(`Shield DB ${input.shieldTemplate.shieldBonus}`);
  }

  if (input.primaryTemplate?.defensiveValue != null) {
    notes.push(`Primary DM ${input.primaryTemplate.defensiveValue}`);
  }

  if (input.primaryTemplate?.parry != null) {
    notes.push(`Primary parry ${input.primaryTemplate.parry}`);
  }

  if (notes.length === 0) {
    return "No exact current defensive stack is available yet.";
  }

  return `${notes.join(" | ")}; full DB/DM stacking remains interim.`;
}

function getLoadNotes(input: {
  backpackCount: number;
  missileTemplate: WeaponTemplate | null;
  primaryTemplate: WeaponTemplate | null;
  secondaryTemplate: WeaponTemplate | null;
}): string {
  const notes: string[] = [];

  for (const template of [input.primaryTemplate, input.secondaryTemplate, input.missileTemplate]) {
    const encumbranceNote = formatEncumbranceNote(template);
    if (encumbranceNote) {
      notes.push(encumbranceNote);
    }
  }

  if (input.backpackCount > 0) {
    notes.push("Backpack load still affects readiness summaries even when exact combat penalties remain incomplete.");
  }

  return notes.length > 0 ? notes.join(" ") : "Current carried-state totals are exact; special load formulas are not active in this loadout.";
}

export function deriveCombatStateSnapshot(
  state: EquipmentFeatureState,
  characterId: string,
): DerivedCombatStateSnapshot {
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

  return {
    gripSummary,
    movementSummary: getMovementSummary({
      armorTemplate,
      backpackCount,
      mountEncumbrance,
      personalEncumbrance,
    }),
    movementModifierSummary: getMovementModifierSummary(armorTemplate),
    perceptionSummary: getPerceptionSummary({
      backpackCount,
      withYouCount,
    }),
    defenseSummary: getDefenseSummary({
      primaryTemplate: primaryWeaponTemplate,
      shieldTemplate,
    }),
    loadNotes: getLoadNotes({
      backpackCount,
      missileTemplate: missileWeaponTemplate,
      primaryTemplate: primaryWeaponTemplate,
      secondaryTemplate: secondaryWeaponTemplate,
    }),
    personalEncumbrance,
    mountEncumbrance,
    gearCount,
    encounterAccessibleGearCount,
    valuablesCount,
    encounterAccessibleValuablesCount,
    carriedCoinQuantity,
    backpackCount,
    storedCount,
    withYouCount,
    wornArmorLabel: getItemLabel(state, armorItem),
    readyShieldLabel: getItemLabel(state, shieldItem),
    activePrimaryLabel: getItemLabel(state, primaryItem),
    activeSecondaryLabel: getItemLabel(state, secondaryItem),
    activeMissileLabel: getItemLabel(state, missileItem),
    unarmedSummary:
      shieldTemplate
        ? "Unarmed fallback remains available; shield defensive values are exact, strike/grapple values remain interim."
        : "Unarmed fallback remains available; strike/grapple values remain interim.",
    armorRating: armorTemplate?.armorRating ?? "Unarmored",
    armorMobilityPenalty: armorTemplate?.mobilityPenalty ?? "—",
    shieldBonus: shieldTemplate?.shieldBonus ?? "No ready shield",
    shieldDefensiveValue: shieldTemplate?.defensiveValue ?? "No ready shield",
    armorCoverageType: getProtectionCoverageLabel(armorTemplate),
    weaponRows: [
      buildWeaponRow({
        slotLabel: "Primary weapon",
        item: primaryItem,
        secondaryTemplate: secondaryWeaponTemplate,
        shieldTemplate,
        state,
        template: primaryWeaponTemplate,
      }),
      buildWeaponRow({
        slotLabel: "Secondary weapon",
        item: secondaryItem,
        shieldTemplate,
        state,
        template: secondaryWeaponTemplate,
      }),
      buildWeaponRow({
        slotLabel: "Missile weapon",
        item: missileItem,
        shieldTemplate: null,
        state,
        template: missileWeaponTemplate,
      }),
      buildUnarmedRow({
        shieldTemplate,
      }),
    ],
    primaryNotes: formatWeaponNotes(primaryWeaponTemplate),
    secondaryNotes: formatWeaponNotes(secondaryWeaponTemplate),
    missileNotes: formatWeaponNotes(missileWeaponTemplate),
  };
}
