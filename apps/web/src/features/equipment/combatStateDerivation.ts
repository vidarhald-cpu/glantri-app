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
  composeCombatDefenseValues,
  usesCombatParrySource,
} from "../../../../../packages/rules-engine/src/combat/composeDefenseValues";
import {
  calculateWorkbookMeleeDmb,
  calculateWorkbookMeleeOb,
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
import type { EquipmentFeatureState } from "./types";

export type DerivedCombatValue = string | number;

export interface CombatStateCharacterInputs {
  dexterityGm: number | null;
  dexterity: number | null;
  parrySkill: number | null;
  brawlingSkill: number | null;
  skillXpByName: Record<string, number>;
  skillTotalsByName: Record<string, number>;
  strengthGm: number | null;
  strength: number | null;
}

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
  readinessSummary: string;
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

export interface ActorCombatStateInputs {
  characterStats?: CombatStateCharacterInputs;
  equipmentState: EquipmentFeatureState;
}

export type CombatStateAllocationInputs = CombatAllocationState;
export type CombatStateParrySource = CombatParrySource;
export const defaultCombatStateAllocationInputs = defaultCombatAllocationState;

const BRAWLING_SKILL_NAME = "Brawling";
const PARRY_SKILL_NAME = "Parry";

export function buildCombatStateCharacterInputs(
  sheet: CharacterSheetSummary,
): CombatStateCharacterInputs {
  const skillXpByName = Object.fromEntries(
    sheet.draftView.skills.map((skill) => [skill.name, skill.effectiveSkillNumber]),
  );
  const skillTotalsByName = Object.fromEntries(
    sheet.draftView.skills.map((skill) => [skill.name, skill.totalSkill]),
  );
  const strength = sheet.adjustedStats.str ?? null;
  const dexterity = sheet.adjustedStats.dex ?? null;

  return {
    dexterity,
    dexterityGm: getWorkbookStatGm(dexterity),
    parrySkill: skillTotalsByName[PARRY_SKILL_NAME] ?? null,
    brawlingSkill: skillTotalsByName[BRAWLING_SKILL_NAME] ?? null,
    skillXpByName,
    skillTotalsByName,
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

function formatInterimNumber(value: number, reason: string): string {
  return `${value} (${reason})`;
}

function formatSignedModifier(value: number): string {
  return value > 0 ? `+${value}` : `${value}`;
}

function getWeaponSkillTotal(
  template: WeaponTemplate | null,
  characterInputs: CombatStateCharacterInputs | undefined,
): number | null {
  if (!template?.weaponSkill || !characterInputs) {
    return null;
  }

  return characterInputs.skillTotalsByName[template.weaponSkill] ?? null;
}

function getWeaponSkillXp(
  template: WeaponTemplate | null,
  characterInputs: CombatStateCharacterInputs | undefined,
): number | null {
  if (!template?.weaponSkill || !characterInputs) {
    return null;
  }

  return characterInputs.skillXpByName[template.weaponSkill] ?? null;
}

function canUseWorkbookMeleeCalculation(template: WeaponTemplate | null): boolean {
  if (!template) {
    return false;
  }

  return template.handlingClass !== "missile" && template.handlingClass !== "thrown";
}

function getDerivedObValue(input: {
  allocationInputs: CombatStateAllocationInputs;
  armorTemplate: ArmorTemplate | null;
  characterInputs?: CombatStateCharacterInputs;
  mode: WeaponAttackMode | null;
  template: WeaponTemplate | null;
}): DerivedCombatValue {
  if (!input.mode) {
    return "—";
  }

  const skillXp = getWeaponSkillXp(input.template, input.characterInputs);
  const strengthGm = input.characterInputs?.strengthGm ?? null;
  const dexterityGm = input.characterInputs?.dexterityGm ?? null;
  if (
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

  const skillTotal = getWeaponSkillTotal(input.template, input.characterInputs);
  if (skillTotal == null) {
    return input.mode.ob ?? "—";
  }

  return calculateBaseOB({
    skill: skillTotal,
    weaponBonus: input.mode.ob ?? 0,
    situationalModifier: input.allocationInputs.situationalModifiers.attack,
  });
}

function getAvailableObForParry(input: {
  allocationInputs: CombatStateAllocationInputs;
  armorTemplate: ArmorTemplate | null;
  characterInputs?: CombatStateCharacterInputs;
  mode: WeaponAttackMode | null;
  template: WeaponTemplate | null;
}): number | null {
  const value = getDerivedObValue(input);
  return typeof value === "number" ? value : null;
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

function getDerivedDmbValue(input: {
  armorTemplate: ArmorTemplate | null;
  characterInputs?: CombatStateCharacterInputs;
  mode: WeaponAttackMode | null;
  template: WeaponTemplate | null;
}): DerivedCombatValue {
  if (!input.mode) {
    return "—";
  }

  const skillXp = getWeaponSkillXp(input.template, input.characterInputs);
  const strengthGm = input.characterInputs?.strengthGm ?? null;
  const dexterityGm = input.characterInputs?.dexterityGm ?? null;
  if (
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

  return getDmbValue(input.mode);
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
  allocationInputs: CombatStateAllocationInputs;
  armorTemplate: ArmorTemplate | null;
  characterInputs?: CombatStateCharacterInputs;
  slotLabel: string;
  item: EquipmentItem | undefined;
  parrySource: CombatStateParrySource;
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
  const shieldBonus = shieldUsable ? input.shieldTemplate?.shieldBonus ?? 0 : 0;
  const shieldDefensiveValue = shieldUsable ? input.shieldTemplate?.defensiveValue ?? 0 : 0;
  const availableOb = getAvailableObForParry({
    allocationInputs: input.allocationInputs,
    armorTemplate: input.armorTemplate,
    characterInputs: input.characterInputs,
    mode: mode1,
    template: input.template,
  });
  const defenseValues = composeCombatDefenseValues({
    allocationState: input.allocationInputs,
    availableOb,
    canUseShield: shieldUsable,
    dexterity: input.characterInputs?.dexterity ?? null,
    shieldBonus,
    shieldDefensiveValue,
    usesSelectedParrySource: usesCombatParrySource(
      input.allocationInputs.parry.source,
      input.parrySource,
    ),
    weaponDefensiveValue: input.template?.defensiveValue ?? 0,
    weaponParryModifier: input.template?.parry ?? null,
  });
  const notes = input.template ? formatWeaponNotes(input.template) : "Not equipped";

  return {
    slotLabel: input.slotLabel,
    currentItemLabel: input.template ? getItemLabel(input.state, input.item) : "None",
    initiative: input.template?.initiative ?? "—",
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
    db: defenseValues.db,
    dm: defenseValues.dm,
    parry: defenseValues.parry,
    notes,
  };
}

function buildUnarmedRow(input: {
  allocationInputs: CombatStateAllocationInputs;
  characterInputs?: CombatStateCharacterInputs;
  shieldTemplate: ShieldTemplate | null;
}): DerivedCombatWeaponRow {
  const brawlingOb = input.characterInputs?.brawlingSkill ?? null;
  const defenseValues = composeCombatDefenseValues({
    allocationState: input.allocationInputs,
    availableOb: brawlingOb,
    canUseShield: input.shieldTemplate != null,
    dexterity: input.characterInputs?.dexterity ?? null,
    shieldBonus: input.shieldTemplate?.shieldBonus ?? 0,
    shieldDefensiveValue: input.shieldTemplate?.defensiveValue ?? 0,
    usesSelectedParrySource:
      usesCombatParrySource(input.allocationInputs.parry.source, "unarmed") ||
      usesCombatParrySource(input.allocationInputs.parry.source, "shield"),
    weaponDefensiveValue: 0,
    weaponParryModifier: null,
  });

  return {
    slotLabel: "Unarmed / brawling",
    currentItemLabel: "Unarmed baseline",
    initiative: "Interim",
    ob1: brawlingOb ?? "Interim",
    dmb1: "Interim",
    attack1: "Strike / grapple baseline",
    crit1: "—",
    ob2: "—",
    dmb2: "—",
    attack2: "—",
    crit2: "—",
    db: defenseValues.db,
    dm: defenseValues.dm,
    parry:
      defenseValues.parry === "—" && input.characterInputs?.parrySkill != null
        ? formatInterimNumber(input.characterInputs.parrySkill, "weapon allocation pending")
        : defenseValues.parry === "—"
          ? "Interim"
          : defenseValues.parry,
    notes:
      input.shieldTemplate
        ? `Shield DB ${input.shieldTemplate.shieldBonus} and shield defensive ${input.shieldTemplate.defensiveValue ?? "—"} are exact; brawling OB uses the live Brawling skill when available, while strike damage remains interim.`
        : "Unarmed fallback stays visible; brawling OB uses the live Brawling skill when available, while strike/grapple damage remains interim.",
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

function getMovementModifierSummary(input: {
  allocationInputs: CombatStateAllocationInputs;
  armorTemplate: ArmorTemplate | null;
}): string {
  const armorPenalty = input.armorTemplate?.mobilityPenalty ?? 0;
  const totalModifier = armorPenalty + input.allocationInputs.situationalModifiers.movement;

  return `${formatSignedModifier(totalModifier)} total (${formatSignedModifier(armorPenalty)} armor, ${formatSignedModifier(input.allocationInputs.situationalModifiers.movement)} situational); encumbrance-based movement penalties beyond armor remain interim.`;
}

function getPerceptionSummary(input: {
  allocationInputs: CombatStateAllocationInputs;
  backpackCount: number;
  withYouCount: number;
}): string {
  const perceptionModifier = input.allocationInputs.situationalModifiers.perception;

  return `Current perception modifier ${formatSignedModifier(perceptionModifier)} from explicit live combat state; encumbrance-specific perception formula remains interim. Current carried state is ${input.withYouCount} with-you items, including ${input.backpackCount} in backpack.`;
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
  const weaponRows = [
    buildWeaponRow({
      allocationInputs: resolvedAllocationInputs,
      armorTemplate,
      characterInputs,
      parrySource: "primary",
      slotLabel: "Primary weapon",
      item: primaryItem,
      secondaryTemplate: secondaryWeaponTemplate,
      shieldTemplate,
      state,
      template: primaryWeaponTemplate,
    }),
    buildWeaponRow({
      allocationInputs: resolvedAllocationInputs,
      armorTemplate,
      characterInputs,
      parrySource: "secondary",
      slotLabel: "Secondary weapon",
      item: secondaryItem,
      shieldTemplate,
      state,
      template: secondaryWeaponTemplate,
    }),
    buildWeaponRow({
      allocationInputs: resolvedAllocationInputs,
      armorTemplate,
      characterInputs,
      parrySource: "none",
      slotLabel: "Missile weapon",
      item: missileItem,
      shieldTemplate: null,
      state,
      template: missileWeaponTemplate,
    }),
    buildUnarmedRow({
      allocationInputs: resolvedAllocationInputs,
      characterInputs,
      shieldTemplate,
    }),
  ];

  return {
    gripSummary,
    readinessSummary: getReadinessSummary({
      allocationInputs: resolvedAllocationInputs,
      backpackCount,
      gripSummary,
    }),
    movementSummary: getMovementSummary({
      armorTemplate,
      backpackCount,
      mountEncumbrance,
      personalEncumbrance,
    }),
    movementModifierSummary: getMovementModifierSummary({
      allocationInputs: resolvedAllocationInputs,
      armorTemplate,
    }),
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
