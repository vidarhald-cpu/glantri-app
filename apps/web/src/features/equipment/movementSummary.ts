import {
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

import {
  getEquipmentTemplateById,
  getLoadoutEquipment,
  getPersonalEncumbranceSummary,
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

function asShieldTemplate(template: EquipmentTemplate | undefined): ShieldTemplate | null {
  return template?.category === "shield" ? template : null;
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

  const personalEncumbrance = getPersonalEncumbranceSummary(
    input.state,
    input.characterId,
    size,
  ).totalEncumbrance;

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
