import {
  getMaterialFactor,
  getQualityFactor,
  isPersonalCarryMode,
  type ArmorTemplate,
  type EquipmentItem,
  type EquipmentTemplate,
  type ShieldTemplate,
} from "@glantri/domain";
import {
  calculateWorkbookBaseMove,
  calculateWorkbookCarryCapacity,
  calculateWorkbookEncumbranceLevel,
  calculateWorkbookMovement,
  calculateWorkbookMovementModifier,
} from "@glantri/rules-engine";

import { calculateWorkbookArmorEncumbrance } from "./armorSummary";
import {
  getCharacterEquipmentItems,
  getEquipmentTemplateById,
  getLoadoutEquipment,
} from "./equipmentSelectors";
import type { CombatStateCharacterInputs } from "./combatStateDerivation";
import type { EquipmentFeatureState } from "./types";

export interface WorkbookMovementSummary {
  baseMove: number | null;
  carryCapacity: number | null;
  encumbranceLevel: number | null;
  encumbrancePercent: number | null;
  movement: number | null;
  movementModifier: number | null;
  personalEncumbrance: number | null;
  shieldMovementModifier: number | null;
}

function asArmorTemplate(template: EquipmentTemplate | undefined): ArmorTemplate | null {
  return template?.category === "armor" ? template : null;
}

function asShieldTemplate(template: EquipmentTemplate | undefined): ShieldTemplate | null {
  return template?.category === "shield" ? template : null;
}

function getWorkbookPersonalItemEncumbrance(input: {
  adjustedSize: number | null;
  item: EquipmentItem;
  template: EquipmentTemplate;
}): number | null {
  if (input.item.encumbranceOverride != null) {
    return input.item.encumbranceOverride;
  }

  const armorTemplate = asArmorTemplate(input.template);
  if (armorTemplate) {
    return calculateWorkbookArmorEncumbrance({
      characterSize: input.adjustedSize,
      item: input.item,
      template: armorTemplate,
    });
  }

  return (
    input.template.baseEncumbrance *
    input.item.quantity *
    getMaterialFactor(input.item.material) *
    getQualityFactor(input.item.quality)
  );
}

export function buildWorkbookMovementSummary(input: {
  characterId: string;
  characterInputs?: CombatStateCharacterInputs;
  state: EquipmentFeatureState;
}): WorkbookMovementSummary {
  const strength = input.characterInputs?.strength ?? null;
  const constitution = input.characterInputs?.constitution ?? null;
  const size = input.characterInputs?.size ?? null;
  const strengthGm = input.characterInputs?.strengthGm ?? null;
  const dexterityGm = input.characterInputs?.dexterityGm ?? null;
  const sizeGm = input.characterInputs?.sizeGm ?? null;

  const personalEncumbrance = getCharacterEquipmentItems(input.state, input.characterId)
    .filter((item) => isPersonalCarryMode(item.storageAssignment.carryMode))
    .reduce((total, item) => {
      const template = getEquipmentTemplateById(input.state, item.templateId);
      if (!template) {
        return total;
      }

      const value = getWorkbookPersonalItemEncumbrance({
        adjustedSize: size,
        item,
        template,
      });

      return total + (value ?? 0);
    }, 0);

  if (
    strength == null ||
    constitution == null ||
    size == null ||
    strengthGm == null ||
    dexterityGm == null ||
    sizeGm == null
  ) {
    return {
      baseMove: null,
      carryCapacity: null,
      encumbranceLevel: null,
      encumbrancePercent: null,
      movement: null,
      movementModifier: null,
      personalEncumbrance,
      shieldMovementModifier: null,
    };
  }

  const carryCapacity = calculateWorkbookCarryCapacity({
    constitution,
    size,
    strength,
  });
  const encumbrance = calculateWorkbookEncumbranceLevel({
    carryCapacity,
    totalEncumbrance: personalEncumbrance,
  });

  if (!encumbrance) {
    return {
      baseMove: null,
      carryCapacity,
      encumbranceLevel: null,
      encumbrancePercent: null,
      movement: null,
      movementModifier: null,
      personalEncumbrance,
      shieldMovementModifier: null,
    };
  }

  const loadout = getLoadoutEquipment(input.state, input.characterId);
  const readyShieldTemplate = loadout.shield
    ? asShieldTemplate(getEquipmentTemplateById(input.state, loadout.shield.templateId))
    : null;
  const shieldMovementModifier = readyShieldTemplate?.movementModifier ?? 0;
  const movementModifier = calculateWorkbookMovementModifier({
    encumbranceLevel: encumbrance.encumbranceLevel,
    shieldMovementModifier,
  });
  const baseMove = calculateWorkbookBaseMove({
    dexterityGm,
    sizeGm,
    strengthGm,
  });

  return {
    baseMove,
    carryCapacity,
    encumbranceLevel: encumbrance.encumbranceLevel,
    encumbrancePercent: encumbrance.encumbrancePercent,
    movement: calculateWorkbookMovement({
      baseMove,
      movementModifier,
    }),
    movementModifier,
    personalEncumbrance,
    shieldMovementModifier,
  };
}
