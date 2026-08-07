import type { ShieldTemplate, WeaponTemplate } from "@glantri/domain";

import type { CombatStateCharacterInputs } from "./characterInputs";
import {
  calculateWorkbookBaseDb,
  calculateWorkbookDefensePair,
  lookupWorkbookToHitModifier,
  type WorkbookDefensePairResult,
  type WorkbookRawModifier,
} from "./workbookCombatMath";

export type CombatDefenseSourceKind = "combined" | "single" | "unarmed";

export interface CombatDefenseEquipmentSelection {
  equipmentModifier: number;
  itemTemplateIds: string[];
  label: string;
  sourceKind: CombatDefenseSourceKind;
}

export interface CompleteCombatDefenseCalculation {
  baseDb: number;
  completeness: "complete";
  dynamicRawModifiers: WorkbookRawModifier[];
  effectiveDb: number;
  effectiveDm: number;
  equipment: CombatDefenseEquipmentSelection;
  flatDbAdjustment: number;
  percentage: WorkbookDefensePairResult;
  toHitModifier: number;
}

export interface IncompleteCombatDefenseCalculation {
  completeness: "partial";
  missingFacts: Array<"character_inputs" | "encumbrance_level" | "workbook_adjustment">;
}

export type CombatDefenseCalculation =
  | CompleteCombatDefenseCalculation
  | IncompleteCombatDefenseCalculation;

function defensiveValue(template: WeaponTemplate | ShieldTemplate | null): number {
  return template?.defensiveValue ?? 0;
}

/**
 * Selects the same one-item/combined defensive equipment case used by the combat panels.
 * The primary weapon is the main defensive item; the strongest ready shield/secondary item
 * supplies the off-hand contribution. With no ready item, combat uses the unarmed case.
 */
export function selectCombatDefenseEquipment(input: {
  primaryWeaponTemplate: WeaponTemplate | null;
  readyShieldTemplate: ShieldTemplate | null;
  secondaryWeaponTemplate: WeaponTemplate | null;
}): CombatDefenseEquipmentSelection {
  const primary = input.primaryWeaponTemplate ?? input.secondaryWeaponTemplate;
  const offHandCandidates = [
    input.readyShieldTemplate,
    input.primaryWeaponTemplate && input.secondaryWeaponTemplate
      ? input.secondaryWeaponTemplate
      : null,
  ].filter((candidate): candidate is WeaponTemplate | ShieldTemplate => candidate !== null);
  const offHand = offHandCandidates.reduce<WeaponTemplate | ShieldTemplate | null>(
    (best, candidate) =>
      !best || defensiveValue(candidate) > defensiveValue(best) ? candidate : best,
    null,
  );

  if (primary && offHand) {
    return {
      equipmentModifier: defensiveValue(primary) + defensiveValue(offHand),
      itemTemplateIds: [primary.id, offHand.id],
      label: `${primary.name} + ${offHand.name}`,
      sourceKind: "combined",
    };
  }

  const single = primary ?? input.readyShieldTemplate;
  if (single) {
    return {
      equipmentModifier: defensiveValue(single),
      itemTemplateIds: [single.id],
      label: single.name,
      sourceKind: "single",
    };
  }

  return {
    equipmentModifier: 0,
    itemTemplateIds: [],
    label: "Unarmed",
    sourceKind: "unarmed",
  };
}

/**
 * Composes the exact workbook DB/DM calculation from canonical base, equipment/load, and
 * exact-cutoff percentage contributions. Direct DB points remain a bounded post-adjustment
 * compatibility layer and never alter DM or Parry.
 */
export function resolveCombatDefenseCalculation(input: {
  characterInputs?: CombatStateCharacterInputs;
  dynamicRawModifiers?: readonly WorkbookRawModifier[];
  encumbranceLevel?: number;
  flatDbAdjustment?: number;
  primaryWeaponTemplate: WeaponTemplate | null;
  readyShieldTemplate: ShieldTemplate | null;
  secondaryWeaponTemplate: WeaponTemplate | null;
}): CombatDefenseCalculation {
  const missingFacts: IncompleteCombatDefenseCalculation["missingFacts"] = [];
  const dexterityGm = input.characterInputs?.dexterityGm;
  const dodgeSkillXp = input.characterInputs?.dodgeCombatSkillXp;
  if (dexterityGm == null || dodgeSkillXp == null) missingFacts.push("character_inputs");
  if (input.encumbranceLevel == null) missingFacts.push("encumbrance_level");
  if (missingFacts.length > 0 || dexterityGm == null || dodgeSkillXp == null) {
    return { completeness: "partial", missingFacts };
  }

  const toHitModifier = lookupWorkbookToHitModifier(input.encumbranceLevel!);
  if (toHitModifier == null) {
    return { completeness: "partial", missingFacts: ["encumbrance_level"] };
  }
  const baseDb = calculateWorkbookBaseDb({ dexterityGm, dodgeSkillXp });
  const equipment = selectCombatDefenseEquipment(input);
  const dynamicRawModifiers = [...(input.dynamicRawModifiers ?? [])];
  const percentage = calculateWorkbookDefensePair({
    baseDb,
    equipmentModifier: equipment.equipmentModifier,
    rawModifiers: dynamicRawModifiers,
    toHitModifier,
  });
  if (!percentage) {
    return { completeness: "partial", missingFacts: ["workbook_adjustment"] };
  }
  const flatDbAdjustment = input.flatDbAdjustment ?? 0;

  return {
    baseDb,
    completeness: "complete",
    dynamicRawModifiers,
    effectiveDb: percentage.db + flatDbAdjustment,
    effectiveDm: percentage.dm,
    equipment,
    flatDbAdjustment,
    percentage,
    toHitModifier,
  };
}
