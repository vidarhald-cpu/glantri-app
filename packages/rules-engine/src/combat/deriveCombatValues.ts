import type {
  ArmorTemplate,
  ShieldTemplate,
  WeaponAttackMode,
  WeaponDamageModifierFormula,
  WeaponTemplate,
} from "@glantri/domain";

import { calculateBaseOB } from "../calculators/ob/calculateBaseOB";
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
} from "./workbookCombatMath";
import type { CombatAllocationState } from "./combatAllocationState";
import type { CombatStateCharacterInputs } from "./characterInputs";

export type DerivedCombatValue = string | number;

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

export function getWeaponSkillXp(
  template: WeaponTemplate | null,
  characterInputs: CombatStateCharacterInputs | undefined,
): number | null {
  if (!template?.weaponSkill || !characterInputs) {
    return null;
  }

  return characterInputs.combatSkillXpByName[template.weaponSkill] ?? null;
}

export function getSkillXpByName(
  skillName: string | null | undefined,
  characterInputs: CombatStateCharacterInputs | undefined,
): number | null {
  if (!skillName || !characterInputs) {
    return null;
  }

  return characterInputs.combatSkillXpByName[skillName] ?? null;
}

export function canUseWorkbookMeleeCalculation(template: WeaponTemplate | null): boolean {
  if (!template) {
    return false;
  }

  return template.handlingClass !== "missile" && template.handlingClass !== "thrown";
}

export function getGripSummary(input: {
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

export function getDmbValue(
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

export function getDerivedInitiativeValue(input: {
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

export function getDerivedObValue(input: {
  allocationInputs: CombatAllocationState;
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

  if (input.treatAsThrownUse) {
    return "—";
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

export function getDerivedDmbValue(input: {
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

  if (input.treatAsThrownUse) {
    if (input.mode.dmb != null && strengthGm != null) {
      return strengthGm + input.mode.dmb;
    }

    return getDmbValue(input.mode, input.characterInputs);
  }

  return getDmbValue(input.mode, input.characterInputs);
}

export function getWorkbookOneItemDefensePair(input: {
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

export function getWorkbookWeaponRowParry(input: {
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

export function getWorkbookShieldRowParry(input: {
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

export function getWorkbookCombinedRowParry(input: {
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
