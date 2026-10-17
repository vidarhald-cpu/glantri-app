import { isThrownWeaponAttackMode } from "@glantri/domain";
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
  calculateWorkbookPercentageAdjustmentTrace,
  calculateWorkbookMeleeDmb,
  calculateWorkbookMeleeInitiative,
  calculateWorkbookMeleeOb,
  calculateWorkbookProjectileOb,
  calculateWorkbookWeaponParry,
  lookupWorkbookToHitModifier,
} from "./workbookCombatMath";
import type { WorkbookRawModifier } from "./workbookCombatMath";
import type { CombatAllocationState } from "./combatAllocationState";
import type { CombatStateCharacterInputs } from "./characterInputs";

export type DerivedCombatValue = string | number;

/**
 * Returned in place of a derived value when the attack mode carries no `competencyRef`. It is a
 * deliberate, non-numeric refusal: callers must not read it as a missing skill, a zero, or a
 * reason to fall back to a skill name (Forgejo #512 P1.3).
 */
export const COMBAT_COMPETENCY_REFUSED = "Refused: no competency reference";

export function isCombatCompetencyRefusal(value: unknown): boolean {
  return value === COMBAT_COMPETENCY_REFUSED;
}

export type AttackModeCompetencyResolution =
  | { competencyId: string; skillXp: number | null; status: "resolved" }
  | { reason: "no_competency_reference"; status: "refused" };

/**
 * Resolves the competency an attack mode attacks with from the mode's authored `competencyRef`
 * (a catalogue id), through the id-keyed skill XP map. A mode without a reference is REFUSED: there
 * is deliberately no fallback to the template's `weaponSkill` name or to any fixed skill.
 * `skillXp` is `null` only when the character does not hold the referenced competency.
 */
export function resolveAttackModeCompetency(input: {
  attackMode: Pick<WeaponAttackMode, "competencyRef"> | null | undefined;
  characterInputs: CombatStateCharacterInputs | undefined;
}): AttackModeCompetencyResolution {
  const competencyId = input.attackMode?.competencyRef;
  if (!competencyId) {
    return { reason: "no_competency_reference", status: "refused" };
  }

  return {
    competencyId,
    skillXp: input.characterInputs?.combatSkillXpByCompetencyId[competencyId] ?? null,
    status: "resolved",
  };
}

function getAttackRawModifiers(allocationInputs: CombatAllocationState): WorkbookRawModifier[] {
  const attackModifier = allocationInputs.situationalModifiers.attack;

  return attackModifier === 0 ? [] : [{ label: "OB/Skill", value: attackModifier }];
}

function applyRawModifiersToDerivedValue(
  baseValue: number,
  rawModifiers: WorkbookRawModifier[],
): number {
  if (rawModifiers.length === 0) {
    return baseValue;
  }

  return (
    calculateWorkbookPercentageAdjustmentTrace({
      baseValue,
      rawModifiers,
    })?.finalValue ?? baseValue
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

/** A template-level call names no mode, so its competency comes from the template's first mode. */
function getDefaultAttackMode(template: WeaponTemplate): WeaponAttackMode | null {
  const modes = template.attackModes ?? [];

  return modes.find((mode) => mode.id === "mode-1") ?? modes[0] ?? null;
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
  attackMode?: Pick<WeaponAttackMode, "attackType" | "competencyRef" | "initiative"> | null;
  characterInputs?: CombatStateCharacterInputs;
  template: WeaponTemplate | null;
}): DerivedCombatValue {
  if (!input.template) {
    return "—";
  }

  // Thrown use is the mode's authored attack type, never the slot the weapon is displayed in.
  const treatAsThrownUse = isThrownWeaponAttackMode(input.attackMode ?? undefined);
  const competencyMode = input.attackMode ?? getDefaultAttackMode(input.template);
  let skillXp: number | null = null;
  // A weapon with no mode at all has no competency to resolve and no attack to make; a mode that
  // exists but names no competency is refused.
  if (competencyMode) {
    const competency = resolveAttackModeCompetency({
      attackMode: competencyMode,
      characterInputs: input.characterInputs,
    });
    if (competency.status === "refused") {
      return COMBAT_COMPETENCY_REFUSED;
    }
    skillXp = competency.skillXp;
  }
  const dexterityGm = input.characterInputs?.dexterityGm ?? null;
  const weaponInitiative = input.attackMode?.initiative ?? input.template.initiative;

  if (
    !treatAsThrownUse &&
    canUseWorkbookMeleeCalculation(input.template) &&
    skillXp != null &&
    dexterityGm != null &&
    weaponInitiative != null
  ) {
    const workbookInitiative = calculateWorkbookMeleeInitiative({
      dexterityGm,
      gameModifier: 0,
      skillXp,
      weaponInitiative,
    });

    if (workbookInitiative) {
      return workbookInitiative.finalInitiative;
    }
  }

  if (input.template.handlingClass === "missile" || treatAsThrownUse) {
    return (weaponInitiative ?? 0) + (input.characterInputs?.dexterityGm ?? 0);
  }

  return weaponInitiative ?? "—";
}

export function getDerivedObValue(input: {
  allocationInputs: CombatAllocationState;
  armorTemplate: ArmorTemplate | null;
  characterInputs?: CombatStateCharacterInputs;
  mode: WeaponAttackMode | null;
  template: WeaponTemplate | null;
}): DerivedCombatValue {
  if (!input.mode) {
    return "—";
  }

  // Thrown use is the mode's authored attack type, never the slot the weapon is displayed in.
  const treatAsThrownUse = isThrownWeaponAttackMode(input.mode);
  const competency = resolveAttackModeCompetency({
    attackMode: input.mode,
    characterInputs: input.characterInputs,
  });
  if (competency.status === "refused") {
    return COMBAT_COMPETENCY_REFUSED;
  }
  const attackRawModifiers = getAttackRawModifiers(input.allocationInputs);
  const skillXp = competency.skillXp;
  const strengthGm = input.characterInputs?.strengthGm ?? null;
  const dexterityGm = input.characterInputs?.dexterityGm ?? null;
  if (
    !treatAsThrownUse &&
    canUseWorkbookMeleeCalculation(input.template) &&
    skillXp != null &&
    strengthGm != null &&
    dexterityGm != null &&
    input.mode.ob != null
  ) {
    const workbookOb = calculateWorkbookMeleeOb({
      armorActivityModifier: input.armorTemplate?.armorActivityModifier ?? 0,
      dexterityGm,
      rawModifiers: attackRawModifiers,
      skillXp,
      strengthGm,
      weaponOb: input.mode.ob,
    });

    if (workbookOb) {
      return workbookOb.finalOb;
    }
  }

  if ((input.template?.handlingClass === "missile" || treatAsThrownUse) && skillXp != null) {
    const projectileOb = calculateWorkbookProjectileOb({
      armorActivityModifier: input.armorTemplate?.armorActivityModifier ?? 0,
      dexterityGm: dexterityGm ?? 0,
      rawModifiers: attackRawModifiers,
      skillXp: skillXp,
      weaponOb: input.mode.ob ?? 0,
    });

    if (projectileOb) {
      return projectileOb.finalOb;
    }
  }

  if (treatAsThrownUse) {
    return "—";
  }

  if (skillXp == null) {
    return input.mode.ob == null
      ? "—"
      : applyRawModifiersToDerivedValue(input.mode.ob, attackRawModifiers);
  }

  const baseOb = calculateBaseOB({
    skill: skillXp,
    weaponBonus: input.mode.ob ?? 0,
    situationalModifier: 0,
  });

  return applyRawModifiersToDerivedValue(baseOb, attackRawModifiers);
}

export function getDerivedDmbValue(input: {
  armorTemplate: ArmorTemplate | null;
  characterInputs?: CombatStateCharacterInputs;
  mode: WeaponAttackMode | null;
  template: WeaponTemplate | null;
}): DerivedCombatValue {
  if (!input.mode) {
    return "—";
  }

  // Thrown use is the mode's authored attack type, never the slot the weapon is displayed in.
  const treatAsThrownUse = isThrownWeaponAttackMode(input.mode);
  const competency = resolveAttackModeCompetency({
    attackMode: input.mode,
    characterInputs: input.characterInputs,
  });
  if (competency.status === "refused") {
    return COMBAT_COMPETENCY_REFUSED;
  }
  const skillXp = competency.skillXp;
  const strengthGm = input.characterInputs?.strengthGm ?? null;
  const dexterityGm = input.characterInputs?.dexterityGm ?? null;
  if (
    !treatAsThrownUse &&
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

  if (treatAsThrownUse) {
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
  rawModifiers?: WorkbookRawModifier[];
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
    rawModifiers: input.rawModifiers,
    toHitModifier,
  });

  return {
    db: pair?.db ?? "—",
    dm: pair?.dm ?? "—",
  };
}

/**
 * The Parry modifier an Equipment template contributes when it is wielded as a Parry source, or
 * `null` when the template authors none.
 *
 * This is the single eligibility fact behind `canTemplateParry`. Every Parry row below reads the
 * same `parry` field, so reading it in one place keeps the eligibility test and the calculation
 * that consumes it from drifting apart.
 */
export function resolveTemplateParryModifier(
  template: { parry?: number | null } | null | undefined,
): number | null {
  return template?.parry ?? null;
}

/**
 * Whether a wielded Equipment template may participate as a Parry source at all.
 *
 * A template with no authored Parry modifier cannot be scored by any Parry row, so committing it
 * as an included Parry source would record a source the canonical calculation must then refuse.
 * This is deliberately a property of the template alone: it answers "is this a Parry instrument",
 * not "can this character parry right now", so a defender who is merely untrained in Parry still
 * keeps an eligible source and is refused later on the honest, character-level ground.
 *
 * Thrown and missile modes author `parry: null` on purpose and are correctly ineligible here.
 */
export function canTemplateParry(template: { parry?: number | null } | null | undefined): boolean {
  return resolveTemplateParryModifier(template) !== null;
}

export function getWorkbookWeaponRowParry(input: {
  armorTemplate: ArmorTemplate | null;
  characterInputs?: CombatStateCharacterInputs;
  rawModifiers?: WorkbookRawModifier[];
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
    rawModifiers: input.rawModifiers,
    weaponParryModifier,
  });

  return workbookParry?.finalParry ?? "—";
}

export function getWorkbookShieldRowParry(input: {
  armorTemplate: ArmorTemplate | null;
  characterInputs?: CombatStateCharacterInputs;
  rawModifiers?: WorkbookRawModifier[];
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
    rawModifiers: input.rawModifiers,
    weaponParryModifier: shieldParryModifier,
  });

  return workbookParry?.finalParry ?? "—";
}

export function getWorkbookCombinedRowParry(input: {
  armorTemplate: ArmorTemplate | null;
  characterInputs?: CombatStateCharacterInputs;
  offHandShieldTemplate: ShieldTemplate | null;
  primaryWeaponTemplate: WeaponTemplate | null;
  rawModifiers?: WorkbookRawModifier[];
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
    rawModifiers: input.rawModifiers,
  });

  return workbookParry?.finalParry ?? "—";
}
