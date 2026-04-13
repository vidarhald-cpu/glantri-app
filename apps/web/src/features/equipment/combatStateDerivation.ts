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
  calculateBaseOB,
  type CharacterSheetSummary,
  getWorkbookStatGm,
} from "@glantri/rules-engine";
import {
  defaultCombatAllocationState,
  getCombatDefensePostureLabel,
  normalizeCombatAllocationState,
  type CombatAllocationState,
  type CombatParrySource,
} from "../../../../../packages/rules-engine/src/combat/combatAllocationState";
import type { CombatSessionState } from "../../../../../packages/rules-engine/src/combat/combatSessionState";
import {
  calculateWorkbookBaseDb,
  calculateWorkbookCombinedParry,
  calculateWorkbookDefensePair,
  calculateWorkbookMeleeDmb,
  calculateWorkbookMeleeInitiative,
  calculateWorkbookMeleeOb,
  calculateWorkbookProjectileOb,
  calculateWorkbookWeaponParry,
  lookupWorkbookToHitModifier,
} from "../../../../../packages/rules-engine/src/combat/workbookCombatMath";

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
import { buildWorkbookMovementSummary } from "./movementSummary";
import type { EquipmentFeatureState } from "./types";

export type DerivedCombatValue = string | number;

export interface CombatStateCharacterInputs {
  constitution: number | null;
  dexterityGm: number | null;
  dexterity: number | null;
  // Canonical workbook-equivalent combat skill XP used by combat calculations.
  // This is effectiveSkillNumber: best group contribution + direct skill ranks.
  combatSkillXpByName: Record<string, number>;
  dodgeCombatSkillXp: number | null;
  parryCombatSkillXp: number | null;
  brawlingCombatSkillXp: number | null;
  size: number | null;
  sizeGm: number | null;
  strengthGm: number | null;
  strength: number | null;
}

export interface DerivedCombatWeaponRow {
  slotLabel: string;
  modeLabel: string;
  currentItemLabel: string;
  initiative: DerivedCombatValue;
  ob1: DerivedCombatValue;
  dmb1: DerivedCombatValue;
  attack1: DerivedCombatValue;
  crit1: DerivedCombatValue;
  sec: DerivedCombatValue;
  armorMod1: DerivedCombatValue;
  db: DerivedCombatValue;
  dm: DerivedCombatValue;
  parry: DerivedCombatValue;
  ob2: DerivedCombatValue;
  dmb2: DerivedCombatValue;
  attack2: DerivedCombatValue;
  crit2: DerivedCombatValue;
  armorMod2: DerivedCombatValue;
  attack3: DerivedCombatValue;
  ob3: DerivedCombatValue;
  dmb3: DerivedCombatValue;
  crit3: DerivedCombatValue;
  armorMod3: DerivedCombatValue;
  notes: string;
}

export interface DerivedCombatStateSnapshot {
  encumbranceCapacity: DerivedCombatValue;
  encumbranceLevel: DerivedCombatValue;
  gripSummary: string;
  readinessSummary: string;
  movementSummary: DerivedCombatValue;
  movementModifierSummary: DerivedCombatValue;
  shieldMovementModifierSummary: DerivedCombatValue;
  unarmedDbSummary: DerivedCombatValue;
  unarmedDmSummary: DerivedCombatValue;
  combinedParryLabel: string;
  combinedParrySummary: DerivedCombatValue;
  oneItemDefenseLabel: string;
  oneItemDbSummary: DerivedCombatValue;
  oneItemDmSummary: DerivedCombatValue;
  twoItemDefenseLabel: string;
  twoItemDbSummary: DerivedCombatValue;
  twoItemDmSummary: DerivedCombatValue;
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

export interface ActorCombatStateInputs {
  characterStats?: CombatStateCharacterInputs;
  equipmentState: EquipmentFeatureState;
}

export type CombatStateAllocationInputs = CombatAllocationState;
export type CombatStateParrySource = CombatParrySource;
export const defaultCombatStateAllocationInputs = defaultCombatAllocationState;

const BRAWLING_SKILL_NAME = "Brawling";
const PARRY_SKILL_NAME = "Parry";

const PUNCH_TEMPLATE: WeaponTemplate = {
  id: "virtual-weapon-template-punch",
  category: "weapon",
  name: "Punch",
  subtype: "brawling",
  tags: ["brawling", "melee", "virtual-workbook"],
  specificityTypeDefault: "generic",
  defaultMaterial: "other",
  baseEncumbrance: 0,
  baseValue: null,
  rulesNotes: "Workbook-backed virtual combat row from Themistogenes Weapon1.",
  roleplayNotes: null,
  weaponClass: "brawling",
  weaponSkill: BRAWLING_SKILL_NAME,
  handlingClass: "one_handed",
  attackModes: [
    {
      id: "mode-1",
      label: "Strike",
      damageClass: "blunt",
      ob: 1,
      obRaw: "1.0",
      dmb: 0,
      dmbRaw: "0.0",
      crit: "AC",
      armorModifier: "A",
      provenance: "imported",
      notes: null,
    },
  ],
  primeAttackType: "Strike",
  primaryAttackType: "Strike",
  secondaryAttackType: null,
  ob1: 1,
  dmb1: 0,
  ob2: null,
  dmb2: null,
  parry: 0,
  initiative: 0,
  range: "1.0",
  armorMod1: "A",
  armorMod2: null,
  crit1: "AC",
  crit2: null,
  secondCrit: null,
  defensiveValue: 0,
  ammoEncumbrance: null,
  ammoEncumbranceRaw: null,
  sourceMetadata: {
    workbook: "Themistogenes 1.07.xlsx",
    sheet: "Weapon1",
    row: 40,
    sourceRange: "Weapon1!A40:Q40",
    sourceColumns: {
      name: "A",
      skill: "B",
      primaryAttackLabel: "C",
      ob1: "D",
      dmb1: "E",
      ob2: "F",
      dmb2: "G",
      parry: "H",
      initiative: "I",
      range: "J",
      armorMod1: "K",
      armorMod2: "L",
      crit1: "M",
      crit2: "N",
      encumbrance: "O",
      defensiveValue: "P",
      secondCrit: "Q",
    },
    rawRow: {
      A: "Punch",
      B: "Brawling",
      C: "Strike",
      D: "1.0",
      E: "0.0",
      F: "",
      G: "",
      H: "0.0",
      I: "0.0",
      J: "1.0",
      K: "A",
      L: "",
      M: "AC",
      N: "",
      O: "0.0",
      P: "0.0",
    },
  },
  importWarnings: null,
  durabilityProfile: null,
};

const KICK_TEMPLATE: WeaponTemplate = {
  ...PUNCH_TEMPLATE,
  id: "virtual-weapon-template-kick",
  name: "Kick",
  attackModes: [
    {
      id: "mode-1",
      label: "Strike",
      damageClass: "blunt",
      ob: 0,
      obRaw: "0.0",
      dmb: 2,
      dmbRaw: "2.0",
      crit: "AC",
      armorModifier: "A",
      provenance: "imported",
      notes: null,
    },
  ],
  ob1: 0,
  dmb1: 2,
  sourceMetadata: {
    workbook: "Themistogenes 1.07.xlsx",
    sheet: "Weapon1",
    row: 41,
    sourceRange: "Weapon1!A41:Q41",
    sourceColumns: PUNCH_TEMPLATE.sourceMetadata!.sourceColumns,
    rawRow: {
      A: "Kick",
      B: "Brawling",
      C: "Strike",
      D: "0.0",
      E: "2.0",
      F: "",
      G: "",
      H: "0.0",
      I: "0.0",
      J: "1.0",
      K: "A",
      L: "",
      M: "AC",
      N: "",
      O: "0.0",
      P: "0.0",
    },
  },
};

export function buildCombatStateCharacterInputs(
  sheet: CharacterSheetSummary,
): CombatStateCharacterInputs {
  const combatSkillXpByName = Object.fromEntries(
    sheet.draftView.skills.map((skill) => [
      skill.name,
      skill.effectiveSkillNumber,
    ]),
  );
  const strength = sheet.adjustedStats.str ?? null;
  const constitution = sheet.adjustedStats.con ?? null;
  const dexterity = sheet.adjustedStats.dex ?? null;
  const size = sheet.adjustedStats.siz ?? null;

  return {
    brawlingCombatSkillXp: combatSkillXpByName[BRAWLING_SKILL_NAME] ?? null,
    combatSkillXpByName,
    constitution,
    dexterity,
    dexterityGm: getWorkbookStatGm(dexterity),
    dodgeCombatSkillXp: combatSkillXpByName.Dodge ?? null,
    parryCombatSkillXp: combatSkillXpByName[PARRY_SKILL_NAME] ?? null,
    size,
    sizeGm: getWorkbookStatGm(size),
    strength,
    strengthGm: getWorkbookStatGm(strength),
  };
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
  return item.displayName ?? typeName;
}

function getAttackMode(
  template: Pick<WeaponTemplate, "attackModes"> | Pick<ShieldTemplate, "attackModes"> | null,
  modeId: string,
): WeaponAttackMode | null {
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

function resolveDmbTextModifier(
  value: string | null | undefined,
  characterInputs: CombatStateCharacterInputs | undefined,
): string | null {
  if (!value) {
    return null;
  }

  if (value === "GMstr") {
    const strengthGm = characterInputs?.strengthGm;
    return strengthGm == null ? "Str" : `${strengthGm}`;
  }

  return value;
}

function formatDmbFormula(
  formula: WeaponDamageModifierFormula | null | undefined,
  characterInputs: CombatStateCharacterInputs | undefined,
): string {
  if (!formula) {
    return "—";
  }

  switch (formula.kind) {
    case "numeric":
      return `${formula.numericValue ?? formula.raw}`;
    case "dice": {
      const dice = `${formula.diceCount ?? 0}d${formula.diceSides ?? 0}`;
      const flat = formatFormulaModifier(formula.flatModifier);
      const resolvedText = resolveDmbTextModifier(formula.textModifier, characterInputs);
      if (resolvedText) {
        const numericResolved = Number(resolvedText);
        if (Number.isFinite(numericResolved)) {
          return `${dice}${flat}${formatFormulaModifier(numericResolved)}`;
        }

        return `${dice}${flat} + ${resolvedText}`;
      }

      return `${dice}${flat}`;
    }
    case "special":
      return `${formula.specialValue ?? formula.raw}`;
    case "unresolved":
      return `${formula.raw}`;
  }
}

function formatSignedModifier(value: number): string {
  return value > 0 ? `+${value}` : `${value}`;
}

function getWeaponSkillXp(
  template: WeaponTemplate | null,
  characterInputs: CombatStateCharacterInputs | undefined,
): number | null {
  if (!template?.weaponSkill || !characterInputs) {
    return null;
  }

  return characterInputs.combatSkillXpByName[template.weaponSkill] ?? null;
}

function getSkillXpByName(
  skillName: string | null | undefined,
  characterInputs: CombatStateCharacterInputs | undefined,
): number | null {
  if (!skillName || !characterInputs) {
    return null;
  }

  return characterInputs.combatSkillXpByName[skillName] ?? null;
}

function canUseWorkbookMeleeCalculation(template: WeaponTemplate | null): boolean {
  if (!template) {
    return false;
  }

  return template.handlingClass !== "missile" && template.handlingClass !== "thrown";
}

function getDerivedInitiativeValue(input: {
  characterInputs?: CombatStateCharacterInputs;
  template: WeaponTemplate | null;
  treatAsThrownUse?: boolean;
}): DerivedCombatValue {
  if (!input.template) {
    return "—";
  }

  const skillXp = getWeaponSkillXp(input.template, input.characterInputs);
  const dexterityGm = input.characterInputs?.dexterityGm ?? null;

  if (
    canUseWorkbookMeleeCalculation(input.template) &&
    skillXp != null &&
    dexterityGm != null &&
    input.template.initiative != null
  ) {
    const workbookInitiative = calculateWorkbookMeleeInitiative({
      dexterityGm,
      gameModifier: 0,
      skillXp,
      weaponInitiative: input.template.initiative,
    });

    if (workbookInitiative) {
      return workbookInitiative.finalInitiative;
    }
  }

  if (input.template.handlingClass === "missile" || input.treatAsThrownUse) {
    return (input.template.initiative ?? 0) + (input.characterInputs?.dexterityGm ?? 0);
  }

  return input.template.initiative ?? "—";
}

function getDerivedObValue(input: {
  allocationInputs: CombatStateAllocationInputs;
  armorTemplate: ArmorTemplate | null;
  characterInputs?: CombatStateCharacterInputs;
  mode: WeaponAttackMode | null;
  template: WeaponTemplate | null;
  treatAsThrownUse?: boolean;
}): DerivedCombatValue {
  if (!input.mode) {
    return "—";
  }

  const skillXp = getWeaponSkillXp(input.template, input.characterInputs);
  const missileOrThrownSkillXp = input.treatAsThrownUse
    ? getSkillXpByName("Throwing", input.characterInputs)
    : skillXp;
  const strengthGm = input.characterInputs?.strengthGm ?? null;
  const dexterityGm = input.characterInputs?.dexterityGm ?? null;
  if (
    !input.treatAsThrownUse &&
    canUseWorkbookMeleeCalculation(input.template) &&
    skillXp != null &&
    strengthGm != null &&
    dexterityGm != null &&
    input.mode.ob != null
  ) {
    const workbookOb = calculateWorkbookMeleeOb({
      armorActivityModifier: input.armorTemplate?.armorActivityModifier ?? 0,
      dexterityGm,
      skillXp,
      strengthGm,
      weaponOb: input.mode.ob,
    });

    if (workbookOb) {
      return workbookOb.finalOb + input.allocationInputs.situationalModifiers.attack;
    }
  }

  if (
    (input.template?.handlingClass === "missile" || input.treatAsThrownUse) &&
    missileOrThrownSkillXp != null
  ) {
    const projectileOb = calculateWorkbookProjectileOb({
      armorActivityModifier: input.armorTemplate?.armorActivityModifier ?? 0,
      dexterityGm: dexterityGm ?? 0,
      skillXp: missileOrThrownSkillXp,
      weaponOb: input.mode.ob ?? 0,
    });

    if (projectileOb) {
      return projectileOb.finalOb + input.allocationInputs.situationalModifiers.attack;
    }
  }

  if (skillXp == null) {
    return input.mode.ob ?? "—";
  }

  return calculateBaseOB({
    skill: skillXp,
    weaponBonus: input.mode.ob ?? 0,
    situationalModifier: input.allocationInputs.situationalModifiers.attack,
  });
}

function getDmbValue(
  mode: WeaponAttackMode | null,
  characterInputs?: CombatStateCharacterInputs,
): DerivedCombatValue {
  if (!mode) {
    return "—";
  }

  if (mode.dmb != null) {
    return mode.dmb;
  }

  if (mode.dmbFormula) {
    return formatDmbFormula(mode.dmbFormula, characterInputs);
  }

  if (mode.dmbRaw) {
    return `${mode.dmbRaw} (raw)`;
  }

  return "—";
}

function getDerivedDmbValue(input: {
  armorTemplate: ArmorTemplate | null;
  characterInputs?: CombatStateCharacterInputs;
  mode: WeaponAttackMode | null;
  template: WeaponTemplate | null;
  treatAsThrownUse?: boolean;
}): DerivedCombatValue {
  if (!input.mode) {
    return "—";
  }

  const skillXp = getWeaponSkillXp(input.template, input.characterInputs);
  const strengthGm = input.characterInputs?.strengthGm ?? null;
  const dexterityGm = input.characterInputs?.dexterityGm ?? null;
  if (
    !input.treatAsThrownUse &&
    canUseWorkbookMeleeCalculation(input.template) &&
    skillXp != null &&
    strengthGm != null &&
    dexterityGm != null &&
    input.mode.ob != null &&
    input.mode.dmb != null
  ) {
    const workbookDmb = calculateWorkbookMeleeDmb({
      armorActivityModifier: input.armorTemplate?.armorActivityModifier ?? 0,
      dexterityGm,
      skillXp,
      strengthGm,
      weaponDmb: input.mode.dmb,
      weaponOb: input.mode.ob,
    });

    if (workbookDmb) {
      return workbookDmb.finalDmb;
    }
  }

  return getDmbValue(input.mode, input.characterInputs);
}

function getAttackLabel(mode: WeaponAttackMode | null): DerivedCombatValue {
  if (!mode) {
    return "—";
  }

  return mode.label ?? formatLabel(mode.id);
}

function getArmorModifierValue(mode: WeaponAttackMode | null): DerivedCombatValue {
  return mode?.armorModifier ?? "—";
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

function getCombatRowModeLabel(slotLabel: string): string {
  switch (slotLabel) {
    case "Primary weapon":
      return "Primary";
    case "Secondary weapon":
      return "Secondary";
    case "Missile weapon":
      return "Missile";
    case "Punch":
    case "Kick":
    case "Brawling":
      return "Unarmed";
    default:
      return slotLabel;
  }
}

function getWorkbookOneItemDefensePair(input: {
  characterInputs?: CombatStateCharacterInputs;
  encumbranceLevel: number | null;
  equipmentModifier: number;
}): { db: DerivedCombatValue; dm: DerivedCombatValue } {
  const dexterityGm = input.characterInputs?.dexterityGm ?? null;
  const dodgeSkillXp = input.characterInputs?.dodgeCombatSkillXp ?? null;
  const toHitModifier =
    input.encumbranceLevel == null ? null : lookupWorkbookToHitModifier(input.encumbranceLevel);

  if (dexterityGm == null || dodgeSkillXp == null || toHitModifier == null) {
    return { db: "—", dm: "—" };
  }

  const baseDb = calculateWorkbookBaseDb({
    dexterityGm,
    dodgeSkillXp,
  });
  const pair = calculateWorkbookDefensePair({
    baseDb,
    equipmentModifier: input.equipmentModifier,
    toHitModifier,
  });

  return {
    db: pair?.db ?? "—",
    dm: pair?.dm ?? "—",
  };
}

function buildThrowingWeaponRow(input: {
  allocationInputs: CombatStateAllocationInputs;
  armorTemplate: ArmorTemplate | null;
  characterInputs?: CombatStateCharacterInputs;
  item: EquipmentItem;
  state: EquipmentFeatureState;
  template: WeaponTemplate;
}): DerivedCombatWeaponRow | null {
  const mode = getAttackMode(input.template, "mode-3")
    ?? (input.template.handlingClass === "thrown" ? getAttackMode(input.template, "mode-1") : null);

  if (!mode) {
    return null;
  }

  const oneItemDefensePair = getWorkbookOneItemDefensePair({
    characterInputs: input.characterInputs,
    encumbranceLevel: null,
    equipmentModifier: input.template.defensiveValue ?? 0,
  });

  return {
    slotLabel: "Throwing weapon",
    modeLabel: "Thrown",
    currentItemLabel: getItemLabel(input.state, input.item),
    initiative: getDerivedInitiativeValue({
      characterInputs: input.characterInputs,
      template: input.template,
      treatAsThrownUse: true,
    }),
    ob1: getDerivedObValue({
      allocationInputs: input.allocationInputs,
      armorTemplate: input.armorTemplate,
      characterInputs: input.characterInputs,
      mode,
      template: input.template,
      treatAsThrownUse: true,
    }),
    dmb1: getDerivedDmbValue({
      armorTemplate: input.armorTemplate,
      characterInputs: input.characterInputs,
      mode,
      template: input.template,
      treatAsThrownUse: true,
    }),
    attack1: getAttackLabel(mode),
    crit1: mode.crit ?? "—",
    sec: mode.secondCrit ?? input.template.secondCrit ?? "—",
    armorMod1: getArmorModifierValue(mode),
    db: oneItemDefensePair.db,
    dm: oneItemDefensePair.dm,
    parry: "—",
    attack2: "—",
    ob2: "—",
    dmb2: "—",
    crit2: "—",
    armorMod2: "—",
    attack3: "—",
    ob3: "—",
    dmb3: "—",
    crit3: "—",
    armorMod3: "—",
    notes: formatWeaponNotes(input.template),
  };
}

function getWorkbookWeaponRowParry(input: {
  armorTemplate: ArmorTemplate | null;
  characterInputs?: CombatStateCharacterInputs;
  template: WeaponTemplate | null;
}): DerivedCombatValue {
  const dexterityGm = input.characterInputs?.dexterityGm ?? null;
  const parrySkillXp = input.characterInputs?.parryCombatSkillXp ?? null;
  const weaponParryModifier = input.template?.parry ?? null;

  if (dexterityGm == null || parrySkillXp == null || weaponParryModifier == null) {
    return "—";
  }

  const workbookParry = calculateWorkbookWeaponParry({
    armorActivityModifier: input.armorTemplate?.armorActivityModifier ?? 0,
    dexterityGm,
    parrySkillXp,
    weaponParryModifier,
  });

  return workbookParry?.finalParry ?? "—";
}

function getWorkbookShieldRowParry(input: {
  armorTemplate: ArmorTemplate | null;
  characterInputs?: CombatStateCharacterInputs;
  shieldTemplate: ShieldTemplate;
}): DerivedCombatValue {
  const dexterityGm = input.characterInputs?.dexterityGm ?? null;
  const parrySkillXp = input.characterInputs?.parryCombatSkillXp ?? null;
  const shieldParryModifier = input.shieldTemplate.parry ?? null;

  if (dexterityGm == null || parrySkillXp == null || shieldParryModifier == null) {
    return "—";
  }

  const workbookParry = calculateWorkbookWeaponParry({
    armorActivityModifier: input.armorTemplate?.armorActivityModifier ?? 0,
    dexterityGm,
    parrySkillXp,
    weaponParryModifier: shieldParryModifier,
  });

  return workbookParry?.finalParry ?? "—";
}

function getWorkbookCombinedRowParry(input: {
  armorTemplate: ArmorTemplate | null;
  characterInputs?: CombatStateCharacterInputs;
  offHandShieldTemplate: ShieldTemplate | null;
  primaryWeaponTemplate: WeaponTemplate | null;
  secondaryWeaponTemplate: WeaponTemplate | null;
}): DerivedCombatValue {
  const dexterityGm = input.characterInputs?.dexterityGm ?? null;
  const parrySkillXp = input.characterInputs?.parryCombatSkillXp ?? null;
  const primaryParryModifier = input.primaryWeaponTemplate?.parry ?? null;
  const offHandParryModifier =
    input.offHandShieldTemplate?.parry ?? input.secondaryWeaponTemplate?.parry ?? null;

  if (
    dexterityGm == null ||
    parrySkillXp == null ||
    primaryParryModifier == null ||
    offHandParryModifier == null
  ) {
    return "—";
  }

  const workbookParry = calculateWorkbookCombinedParry({
    armorActivityModifier: input.armorTemplate?.armorActivityModifier ?? 0,
    dexterityGm,
    offHandParryModifier,
    parrySkillXp,
    primaryParryModifier,
  });

  return workbookParry?.finalParry ?? "—";
}

function buildWeaponRow(input: {
  allocationInputs: CombatStateAllocationInputs;
  armorTemplate: ArmorTemplate | null;
  characterInputs?: CombatStateCharacterInputs;
  encumbranceLevel: number | null;
  slotLabel: string;
  item: EquipmentItem | undefined;
  secondaryTemplate?: WeaponTemplate | null;
  shieldTemplate: ShieldTemplate | null;
  state: EquipmentFeatureState;
  template: WeaponTemplate | null;
}): DerivedCombatWeaponRow {
  const mode1 = getAttackMode(input.template, "mode-1");
  const mode2 = getAttackMode(input.template, "mode-2");
  const oneItemDefensePair = getWorkbookOneItemDefensePair({
    characterInputs: input.characterInputs,
    encumbranceLevel: input.encumbranceLevel,
    equipmentModifier: input.template?.defensiveValue ?? 0,
  });
  const notes = input.template ? formatWeaponNotes(input.template) : "Not equipped";
  const mode3 = getAttackMode(input.template, "mode-3");

  return {
    slotLabel: input.slotLabel,
    modeLabel: getCombatRowModeLabel(input.slotLabel),
    currentItemLabel:
      input.template && !input.item
        ? input.template.name
        : input.template
          ? getItemLabel(input.state, input.item)
          : "None",
    initiative: getDerivedInitiativeValue({
      characterInputs: input.characterInputs,
      template: input.template,
    }),
    ob1: getDerivedObValue({
      allocationInputs: input.allocationInputs,
      armorTemplate: input.armorTemplate,
      characterInputs: input.characterInputs,
      mode: mode1,
      template: input.template,
    }),
    dmb1: getDerivedDmbValue({
      armorTemplate: input.armorTemplate,
      characterInputs: input.characterInputs,
      mode: mode1,
      template: input.template,
    }),
    attack1: getAttackLabel(mode1),
    crit1: mode1?.crit ?? "—",
    sec: mode1?.secondCrit ?? input.template?.secondCrit ?? "—",
    armorMod1: getArmorModifierValue(mode1),
    db: oneItemDefensePair.db,
    dm: oneItemDefensePair.dm,
    parry: getWorkbookWeaponRowParry({
      armorTemplate: input.armorTemplate,
      characterInputs: input.characterInputs,
      template: input.template,
    }),
    ob2: getDerivedObValue({
      allocationInputs: input.allocationInputs,
      armorTemplate: input.armorTemplate,
      characterInputs: input.characterInputs,
      mode: mode2,
      template: input.template,
    }),
    dmb2: getDerivedDmbValue({
      armorTemplate: input.armorTemplate,
      characterInputs: input.characterInputs,
      mode: mode2,
      template: input.template,
    }),
    attack2: getAttackLabel(mode2),
    crit2: mode2?.crit ?? "—",
    armorMod2: getArmorModifierValue(mode2),
    attack3: getAttackLabel(mode3),
    ob3: "—",
    dmb3: "—",
    crit3: "—",
    armorMod3: "—",
    notes,
  };
}

function buildBrawlingRow(input: {
  allocationInputs: CombatStateAllocationInputs;
  armorTemplate: ArmorTemplate | null;
  characterInputs?: CombatStateCharacterInputs;
  state: EquipmentFeatureState;
  template: WeaponTemplate;
}): DerivedCombatWeaponRow {
  const row = buildWeaponRow({
    allocationInputs: input.allocationInputs,
    armorTemplate: input.armorTemplate,
    characterInputs: input.characterInputs,
    encumbranceLevel: null,
    slotLabel: input.template.name,
    item: undefined,
    shieldTemplate: null,
    state: input.state,
    template: input.template,
  });

  return {
    ...row,
    db: "—",
    dm: "—",
    parry: "—",
  };
}

function buildBrawlingSummaryRow(input: {
  allocationInputs: CombatStateAllocationInputs;
  armorTemplate: ArmorTemplate | null;
  characterInputs?: CombatStateCharacterInputs;
  encumbranceLevel: number | null;
  template: WeaponTemplate;
}): DerivedCombatWeaponRow {
  const mode1 = getAttackMode(input.template, "mode-1");
  const unarmedDefensePair = getWorkbookOneItemDefensePair({
    characterInputs: input.characterInputs,
    encumbranceLevel: input.encumbranceLevel,
    equipmentModifier: 0,
  });

  return {
    slotLabel: "Brawling",
    modeLabel: "Unarmed",
    currentItemLabel: "Brawling",
    initiative: "—",
    attack1: "—",
    ob1: getDerivedObValue({
      allocationInputs: input.allocationInputs,
      armorTemplate: input.armorTemplate,
      characterInputs: input.characterInputs,
      mode: mode1,
      template: input.template,
    }),
    dmb1: "—",
    crit1: "—",
    sec: "—",
    armorMod1: "—",
    db: unarmedDefensePair.db,
    dm: unarmedDefensePair.dm,
    parry: getWorkbookWeaponRowParry({
      armorTemplate: input.armorTemplate,
      characterInputs: input.characterInputs,
      template: input.template,
    }),
    attack2: "—",
    ob2: "—",
    dmb2: "—",
    crit2: "—",
    armorMod2: "—",
    attack3: "—",
    ob3: "—",
    dmb3: "—",
    crit3: "—",
    armorMod3: "—",
    notes: "Workbook-backed unarmed skill summary row.",
  };
}

function buildShieldRow(input: {
  armorTemplate: ArmorTemplate | null;
  characterInputs?: CombatStateCharacterInputs;
  encumbranceLevel: number | null;
  item: EquipmentItem | undefined;
  shieldTemplate: ShieldTemplate;
  state: EquipmentFeatureState;
}): DerivedCombatWeaponRow {
  const mode1 = getAttackMode(input.shieldTemplate, "mode-1");
  const oneItemDefensePair = getWorkbookOneItemDefensePair({
    characterInputs: input.characterInputs,
    encumbranceLevel: input.encumbranceLevel,
    equipmentModifier: input.shieldTemplate.defensiveValue ?? 0,
  });

  return {
    slotLabel: "Shield",
    modeLabel: "Shield",
    currentItemLabel: getItemLabel(input.state, input.item),
    initiative: input.shieldTemplate.initiative ?? "—",
    attack1: getAttackLabel(mode1),
    ob1: mode1?.ob ?? "—",
    dmb1: getDmbValue(mode1),
    crit1: mode1?.crit ?? "—",
    sec: mode1?.secondCrit ?? input.shieldTemplate.secondCrit ?? "—",
    armorMod1: getArmorModifierValue(mode1),
    db: oneItemDefensePair.db,
    dm: oneItemDefensePair.dm,
    parry: getWorkbookShieldRowParry({
      armorTemplate: input.armorTemplate,
      characterInputs: input.characterInputs,
      shieldTemplate: input.shieldTemplate,
    }),
    attack2: "—",
    ob2: "—",
    dmb2: "—",
    crit2: "—",
    armorMod2: "—",
    attack3: "—",
    ob3: "—",
    dmb3: "—",
    crit3: "—",
    armorMod3: "—",
    notes:
      "Shield rows merge offensive workbook weapon-table values with defensive shield-table values where current rules support them.",
  };
}

function buildCombinedDefenseRow(input: {
  armorTemplate: ArmorTemplate | null;
  characterInputs?: CombatStateCharacterInputs;
  offHandLabel: string;
  offHandShieldTemplate: ShieldTemplate | null;
  primaryLabel: string;
  primaryWeaponTemplate: WeaponTemplate;
  secondaryWeaponTemplate: WeaponTemplate | null;
  twoItemPair: { db: DerivedCombatValue; dm: DerivedCombatValue };
}): DerivedCombatWeaponRow {
  return {
    slotLabel: "Combined",
    modeLabel: "Combined",
    currentItemLabel: `${input.primaryLabel} + ${input.offHandLabel}`,
    initiative: "—",
    attack1: "—",
    ob1: "—",
    dmb1: "—",
    crit1: "—",
    sec: "—",
    armorMod1: "—",
    db: input.twoItemPair.db,
    dm: input.twoItemPair.dm,
    parry: getWorkbookCombinedRowParry({
      armorTemplate: input.armorTemplate,
      characterInputs: input.characterInputs,
      offHandShieldTemplate: input.offHandShieldTemplate,
      primaryWeaponTemplate: input.primaryWeaponTemplate,
      secondaryWeaponTemplate: input.secondaryWeaponTemplate,
    }),
    attack2: "—",
    ob2: "—",
    dmb2: "—",
    crit2: "—",
    armorMod2: "—",
    attack3: "—",
    ob3: "—",
    dmb3: "—",
    crit3: "—",
    armorMod3: "—",
    notes: "Workbook-backed combined defense row using primary plus off-hand defensive item.",
  };
}

function getPerceptionSummary(input: {
  allocationInputs: CombatStateAllocationInputs;
  backpackCount: number;
  withYouCount: number;
}): string {
  const perceptionModifier = input.allocationInputs.situationalModifiers.perception;

  return `Current perception modifier ${formatSignedModifier(perceptionModifier)} from explicit live combat state; encumbrance-specific perception formula remains interim. Current carried state is ${input.withYouCount} with-you items, including ${input.backpackCount} in backpack.`;
}

function getWorkbookDefenseCases(input: {
  allocationInputs: CombatStateAllocationInputs;
  characterInputs?: CombatStateCharacterInputs;
  encumbranceLevel: number | null;
  primaryWeaponTemplate: WeaponTemplate | null;
  secondaryWeaponTemplate: WeaponTemplate | null;
  shieldTemplate: ShieldTemplate | null;
}): {
  oneItemLabel: string;
  oneItemPair: { db: DerivedCombatValue; dm: DerivedCombatValue };
  twoItemLabel: string;
  twoItemPair: { db: DerivedCombatValue; dm: DerivedCombatValue };
  unarmedPair: { db: DerivedCombatValue; dm: DerivedCombatValue };
} {
  const dexterityGm = input.characterInputs?.dexterityGm ?? null;
  const dodgeSkillXp = input.characterInputs?.dodgeCombatSkillXp ?? null;
  const toHitModifier =
    input.encumbranceLevel == null ? null : lookupWorkbookToHitModifier(input.encumbranceLevel);

  if (dexterityGm == null || dodgeSkillXp == null || toHitModifier == null) {
    return {
      oneItemLabel: "Selected defensive item",
      oneItemPair: { db: "—", dm: "—" },
      twoItemLabel: "Selected combined defence",
      twoItemPair: { db: "—", dm: "—" },
      unarmedPair: { db: "—", dm: "—" },
    };
  }

  const baseDb = calculateWorkbookBaseDb({
    dexterityGm,
    dodgeSkillXp,
  });

  const unarmedPair = calculateWorkbookDefensePair({
    baseDb,
    equipmentModifier: 0,
    toHitModifier,
  });

  const singleWeaponTemplate = input.primaryWeaponTemplate ?? input.secondaryWeaponTemplate ?? null;
  const singleShieldTemplate = input.shieldTemplate;
  const singleItemTemplate = singleWeaponTemplate ?? singleShieldTemplate ?? null;
  const singleItemModifier = singleItemTemplate?.defensiveValue ?? 0;
  const singleItemLabel = singleItemTemplate
    ? `One-item defence (${singleItemTemplate.name})`
    : "One-item defence";
  const singleItemPair = calculateWorkbookDefensePair({
    baseDb,
    equipmentModifier: singleItemModifier,
    toHitModifier,
  });

  const combinedWeaponTemplate = input.primaryWeaponTemplate ?? input.secondaryWeaponTemplate ?? null;
  const offHandCandidates = [
    input.shieldTemplate
      ? {
          label: input.shieldTemplate.name,
          value: input.shieldTemplate.defensiveValue ?? 0,
        }
      : null,
    input.primaryWeaponTemplate && input.secondaryWeaponTemplate
      ? {
          label: input.secondaryWeaponTemplate.name,
          value: input.secondaryWeaponTemplate.defensiveValue ?? 0,
        }
      : null,
  ].filter((candidate): candidate is { label: string; value: number } => candidate !== null);

  const offHandCandidate = offHandCandidates.reduce<{ label: string; value: number } | null>(
    (best, current) => {
      if (!best || current.value > best.value) {
        return current;
      }
      return best;
    },
    null,
  );

  const combinedLabel =
    combinedWeaponTemplate && offHandCandidate
      ? `Two-item defence (${combinedWeaponTemplate.name} + ${offHandCandidate.label})`
      : "Two-item defence";
  const combinedPair =
    combinedWeaponTemplate && offHandCandidate
      ? calculateWorkbookDefensePair({
          baseDb,
          equipmentModifier:
            (combinedWeaponTemplate.defensiveValue ?? 0) + offHandCandidate.value,
          toHitModifier,
        })
      : null;

  return {
    oneItemLabel: singleItemLabel,
    oneItemPair: {
      db: singleItemPair?.db ?? "—",
      dm: singleItemPair?.dm ?? "—",
    },
    twoItemLabel: combinedLabel,
    twoItemPair: {
      db: combinedPair?.db ?? "—",
      dm: combinedPair?.dm ?? "—",
    },
    unarmedPair: {
      db: unarmedPair?.db ?? "—",
      dm: unarmedPair?.dm ?? "—",
    },
  };
}

function getReadinessSummary(input: {
  allocationInputs: CombatStateAllocationInputs;
  backpackCount: number;
  gripSummary: string;
}): string {
  const notes = [`Posture ${getCombatDefensePostureLabel(input.allocationInputs.defensePosture)}`, input.gripSummary];

  if (input.backpackCount > 0) {
    notes.push(`${input.backpackCount} backpack item${input.backpackCount === 1 ? "" : "s"} slow to access`);
  }

  return notes.join(" | ");
}

function getDefenseSummary(input: {
  allocationInputs: CombatStateAllocationInputs;
  primaryDbValue: DerivedCombatValue;
  primaryDmValue: DerivedCombatValue;
  primaryParryValue: DerivedCombatValue;
  shieldUsable: boolean;
  shieldTemplate: ShieldTemplate | null;
}): string {
  const notes: string[] = [];
  notes.push(`Posture ${getCombatDefensePostureLabel(input.allocationInputs.defensePosture)}`);

  if (input.shieldTemplate && input.shieldUsable) {
    notes.push(`DB ${input.primaryDbValue}`);
  }

  if (input.primaryDmValue !== "—") {
    notes.push(`DM ${input.primaryDmValue}`);
  }

  if (input.primaryParryValue !== "—") {
    notes.push(`Parry ${input.primaryParryValue}`);
  }

  return `${notes.join(" | ")}; full situational stacking still remains interim.`;
}

function getCombinedParrySummary(): { label: string; value: DerivedCombatValue } {
  return {
    label: "Combined parry",
    value: "—",
  };
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
  characterInputs?: CombatStateCharacterInputs,
  allocationInputs?: CombatStateAllocationInputs,
  selectedThrowingWeaponItemId?: string | null,
): DerivedCombatStateSnapshot {
  const resolvedAllocationInputs = normalizeCombatAllocationState(allocationInputs);
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
  const workbookMovement = buildWorkbookMovementSummary({
    characterId,
    characterInputs,
    state,
  });

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
  const shieldUsableWithPrimary = canUseReadyShieldWithWeapon(
    primaryWeaponTemplate,
    shieldTemplate,
    secondaryWeaponTemplate,
  );
  const weaponRows: DerivedCombatWeaponRow[] = [];

  if (primaryItem && primaryWeaponTemplate) {
    weaponRows.push(
      buildWeaponRow({
        allocationInputs: resolvedAllocationInputs,
        armorTemplate,
        characterInputs,
        encumbranceLevel: workbookMovement.encumbranceLevel,
        slotLabel: "Primary weapon",
        item: primaryItem,
        secondaryTemplate: secondaryWeaponTemplate,
        shieldTemplate,
        state,
        template: primaryWeaponTemplate,
      }),
    );
  }

  if (shieldItem && shieldTemplate) {
    weaponRows.push(
      buildShieldRow({
        armorTemplate,
        characterInputs,
        encumbranceLevel: workbookMovement.encumbranceLevel,
        item: shieldItem,
        shieldTemplate,
        state,
      }),
    );
  }

  if (secondaryItem && secondaryWeaponTemplate) {
    weaponRows.push(
      buildWeaponRow({
        allocationInputs: resolvedAllocationInputs,
        armorTemplate,
        characterInputs,
        encumbranceLevel: workbookMovement.encumbranceLevel,
        slotLabel: "Secondary weapon",
        item: secondaryItem,
        shieldTemplate,
        state,
        template: secondaryWeaponTemplate,
      }),
    );
  }

  if (missileItem && missileWeaponTemplate) {
    weaponRows.push(
      buildWeaponRow({
        allocationInputs: resolvedAllocationInputs,
        armorTemplate,
        characterInputs,
        encumbranceLevel: workbookMovement.encumbranceLevel,
        slotLabel: "Missile weapon",
        item: missileItem,
        shieldTemplate: null,
        state,
        template: missileWeaponTemplate,
      }),
    );
  }

  const throwingWeaponItem = selectedThrowingWeaponItemId
    ? state.itemsById[selectedThrowingWeaponItemId]
    : undefined;
  const throwingWeaponTemplate =
    throwingWeaponItem?.category === "weapon"
      ? asWeaponTemplate(getEquipmentTemplateById(state, throwingWeaponItem.templateId))
      : null;

  if (throwingWeaponItem && throwingWeaponTemplate) {
    const throwingRow = buildThrowingWeaponRow({
      allocationInputs: resolvedAllocationInputs,
      armorTemplate,
      characterInputs,
      item: throwingWeaponItem,
      state,
      template: throwingWeaponTemplate,
    });

    if (throwingRow) {
      weaponRows.push(throwingRow);
    }
  }

  const workbookDefenseCases = getWorkbookDefenseCases({
    allocationInputs: resolvedAllocationInputs,
    characterInputs,
    encumbranceLevel: workbookMovement.encumbranceLevel,
    primaryWeaponTemplate,
    secondaryWeaponTemplate,
    shieldTemplate,
  });

  if (primaryWeaponTemplate && (shieldTemplate || secondaryWeaponTemplate)) {
    const offHandLabel = shieldTemplate?.name ?? secondaryWeaponTemplate?.name ?? null;

    if (offHandLabel) {
      weaponRows.push(
        buildCombinedDefenseRow({
          armorTemplate,
          characterInputs,
          offHandLabel,
          offHandShieldTemplate: shieldTemplate,
          primaryLabel: primaryWeaponTemplate.name,
          primaryWeaponTemplate,
          secondaryWeaponTemplate,
          twoItemPair: workbookDefenseCases.twoItemPair,
        }),
      );
    }
  }

  weaponRows.push(
    buildBrawlingSummaryRow({
      allocationInputs: resolvedAllocationInputs,
      armorTemplate,
      characterInputs,
      encumbranceLevel: workbookMovement.encumbranceLevel,
      template: PUNCH_TEMPLATE,
    }),
  );

  weaponRows.push(
    buildBrawlingRow({
      allocationInputs: resolvedAllocationInputs,
      armorTemplate,
      characterInputs,
      state,
      template: PUNCH_TEMPLATE,
    }),
  );

  weaponRows.push(
    buildBrawlingRow({
      allocationInputs: resolvedAllocationInputs,
      armorTemplate,
      characterInputs,
      state,
      template: KICK_TEMPLATE,
    }),
  );

  const combinedParrySummary = getCombinedParrySummary();

  return {
    encumbranceCapacity: workbookMovement.carryCapacity ?? "—",
    encumbranceLevel: workbookMovement.encumbranceLevel ?? "—",
    gripSummary,
    readinessSummary: getReadinessSummary({
      allocationInputs: resolvedAllocationInputs,
      backpackCount,
      gripSummary,
    }),
    movementSummary: workbookMovement.movement ?? "—",
    movementModifierSummary: workbookMovement.movementModifier ?? "—",
    shieldMovementModifierSummary: workbookMovement.shieldMovementModifier ?? "—",
    unarmedDbSummary: workbookDefenseCases.unarmedPair.db,
    unarmedDmSummary: workbookDefenseCases.unarmedPair.dm,
    combinedParryLabel: combinedParrySummary.label,
    combinedParrySummary: combinedParrySummary.value,
    oneItemDefenseLabel: workbookDefenseCases.oneItemLabel,
    oneItemDbSummary: workbookDefenseCases.oneItemPair.db,
    oneItemDmSummary: workbookDefenseCases.oneItemPair.dm,
    twoItemDefenseLabel: workbookDefenseCases.twoItemLabel,
    twoItemDbSummary: workbookDefenseCases.twoItemPair.db,
    twoItemDmSummary: workbookDefenseCases.twoItemPair.dm,
    perceptionSummary: getPerceptionSummary({
      allocationInputs: resolvedAllocationInputs,
      backpackCount,
      withYouCount,
    }),
    defenseSummary: getDefenseSummary({
      allocationInputs: resolvedAllocationInputs,
      primaryDbValue: weaponRows[0]?.db ?? "—",
      primaryDmValue: weaponRows[0]?.dm ?? "—",
      primaryParryValue: weaponRows[0]?.parry ?? "—",
      shieldUsable: shieldUsableWithPrimary,
      shieldTemplate,
    }),
    loadNotes: getLoadNotes({
      backpackCount,
      missileTemplate: missileWeaponTemplate,
      primaryTemplate: primaryWeaponTemplate,
      secondaryTemplate: secondaryWeaponTemplate,
    }),
    personalEncumbrance: workbookMovement.personalEncumbrance ?? personalEncumbrance,
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
        ? "Punch and Kick remain available; shield defensive values are exact where current rules support them."
        : "Punch and Kick remain available as workbook-backed brawling rows.",
    armorRating: armorTemplate?.armorRating ?? "Unarmored",
    armorMobilityPenalty: armorTemplate?.mobilityPenalty ?? "—",
    shieldBonus: shieldTemplate?.shieldBonus ?? "No ready shield",
    shieldDefensiveValue: shieldTemplate?.defensiveValue ?? "No ready shield",
    armorCoverageType: getProtectionCoverageLabel(armorTemplate),
    weaponRows,
    primaryNotes: formatWeaponNotes(primaryWeaponTemplate),
    secondaryNotes: formatWeaponNotes(secondaryWeaponTemplate),
    missileNotes: formatWeaponNotes(missileWeaponTemplate),
  };
}

export function getActorCombatState(
  session: CombatSessionState,
  actorId: string,
  inputs: ActorCombatStateInputs,
): DerivedCombatStateSnapshot | null {
  const actor = session.actors.find((candidate) => candidate.actorId === actorId);

  if (!actor?.characterId) {
    return null;
  }

  return deriveCombatStateSnapshot(
    inputs.equipmentState,
    actor.characterId,
    inputs.characterStats,
    actor.allocation,
  );
}
