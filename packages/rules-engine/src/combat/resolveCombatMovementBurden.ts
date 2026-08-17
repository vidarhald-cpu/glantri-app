import {
  combatMovementBurdenSnapshotSchema,
  type ArmorTemplate,
  type CharacterLoadout,
  type CombatMovementBurdenMissingFact,
  type CombatMovementBurdenSnapshot,
  type CombatMovementModifierApplicability,
  type CombatMovementModifierManeuver,
  type EquipmentItem,
  type EquipmentTemplate,
  type StorageLocation,
  getEffectiveEncumbrance,
  isPersonalCarryMode,
} from "@glantri/domain";

import {
  calculateWorkbookCarryCapacity,
  calculateWorkbookEncumbranceLevel,
  calculateWorkbookMovementModifier,
} from "./workbookCombatMath";

const CARRIED_LOCATION_TYPES = new Set<StorageLocation["type"]>([
  "equipped_system",
  "person_system",
  "backpack_system",
]);

const MOVEMENT_MODIFIER_POLICY: Record<
  CombatMovementModifierManeuver,
  CombatMovementModifierApplicability
> = {
  adjust_distance_attack: "required",
  round_end_adjust_distance: "required",
  movement_feint: "not_applicable",
  weapon_feint: "not_applicable",
  offensive_parry_brawling: "not_applicable",
  continued_contact: "not_applicable",
  break_off: "required",
  observe_opponent: "not_applicable",
  weapon_resolution: "not_applicable",
};

export interface ResolveCombatMovementBurdenInput {
  characterId?: string;
  characteristics?: {
    constitution: number | null;
    size: number | null;
    strength: number | null;
  };
  equipmentLoadoutRevision?: string;
  equipmentState?: {
    activeLoadout?: CharacterLoadout;
    items: readonly EquipmentItem[];
    locationsById: Readonly<Record<string, StorageLocation>>;
    templatesById: Readonly<Record<string, EquipmentTemplate>>;
  };
  participantId: string;
  sourceSnapshotId: string;
}

export function getCombatMovementModifierApplicability(
  maneuver: CombatMovementModifierManeuver,
): CombatMovementModifierApplicability {
  return MOVEMENT_MODIFIER_POLICY[maneuver];
}

function calculateArmorEffectiveEncumbrance(input: {
  characterSize: number;
  item: EquipmentItem;
  template: ArmorTemplate;
}): number {
  const encumbranceFactor = input.template.encumbranceFactor ?? input.template.baseEncumbrance;
  return encumbranceFactor * input.item.quantity * input.characterSize;
}

function partialSnapshot(
  input: ResolveCombatMovementBurdenInput & {
    carriedItems?: CombatMovementBurdenSnapshot["carriedItems"];
    missingFacts: Iterable<CombatMovementBurdenMissingFact>;
    totalEffectiveCarriedEncumbrance?: number;
  },
): CombatMovementBurdenSnapshot {
  return combatMovementBurdenSnapshotSchema.parse({
    schemaVersion: 1,
    participantId: input.participantId,
    sourceSnapshotId: input.sourceSnapshotId,
    equipmentLoadoutRevision: input.equipmentLoadoutRevision,
    carriedItems: input.carriedItems ?? [],
    totalEffectiveCarriedEncumbrance: input.totalEffectiveCarriedEncumbrance,
    completeness: "partial",
    missingFacts: [...new Set(input.missingFacts)],
    provenance: {
      carriedLoadSource: "scenario_equipment_snapshot",
      formula: "themistogenes_movement_modifier_v1",
      sourceRange: "Calculations!L39:S42",
      workbook: "Themistogenes 1.07.xlsx",
    },
  });
}

/**
 * Resolves the workbook Movement Modifier from a bounded, server-owned scenario
 * equipment snapshot. The output is immutable roll provenance; it is not a live
 * inventory model and does not accept client-calculated burden values.
 */
export function resolveCombatMovementBurden(
  input: ResolveCombatMovementBurdenInput,
): CombatMovementBurdenSnapshot {
  const missingFacts = new Set<CombatMovementBurdenMissingFact>();
  const { characteristics, equipmentState } = input;
  if (
    !characteristics ||
    characteristics.constitution == null ||
    characteristics.size == null ||
    characteristics.strength == null
  ) {
    missingFacts.add("characteristics");
  }
  if (!equipmentState) {
    missingFacts.add("equipment_state");
  }
  if (missingFacts.size > 0 || !characteristics || !equipmentState) {
    return partialSnapshot({ ...input, missingFacts });
  }

  const characterSize = characteristics.size!;
  const carriedItems: CombatMovementBurdenSnapshot["carriedItems"] = [];
  let totalEffectiveCarriedEncumbrance = 0;
  for (const item of equipmentState.items) {
    if (input.characterId && item.characterId !== input.characterId) continue;
    if (!isPersonalCarryMode(item.storageAssignment.carryMode)) continue;

    const location = equipmentState.locationsById[item.storageAssignment.locationId];
    if (!location) {
      missingFacts.add("storage_location");
      continue;
    }
    if (!CARRIED_LOCATION_TYPES.has(location.type)) continue;

    const template = equipmentState.templatesById[item.templateId];
    if (!template) {
      missingFacts.add("equipment_template");
      continue;
    }
    const effectiveEncumbrance =
      template.category === "armor"
        ? calculateArmorEffectiveEncumbrance({ characterSize, item, template })
        : getEffectiveEncumbrance(item, template);
    totalEffectiveCarriedEncumbrance += effectiveEncumbrance;
    carriedItems.push({
      effectiveEncumbrance,
      itemId: item.id,
      templateId: item.templateId,
    });
  }

  let shield:
    | {
        itemId: string;
        label: string;
        movementContribution: number;
        templateId: string;
      }
    | undefined;
  let shieldMovementContribution = 0;
  const readyShieldItemId = equipmentState.activeLoadout?.readyShieldItemId ?? undefined;
  if (readyShieldItemId) {
    const readyShield = equipmentState.items.find((item) => item.id === readyShieldItemId);
    if (!readyShield) {
      missingFacts.add("equipment_item");
      missingFacts.add("shield");
    } else {
      const readyShieldTemplate = equipmentState.templatesById[readyShield.templateId];
      if (
        !readyShieldTemplate ||
        readyShieldTemplate.category !== "shield" ||
        !Number.isInteger(readyShieldTemplate.movementModifier ?? 0)
      ) {
        missingFacts.add("shield");
      } else {
        shieldMovementContribution = readyShieldTemplate.movementModifier ?? 0;
        shield = {
          itemId: readyShield.id,
          label: readyShield.displayName?.trim() || readyShieldTemplate.name,
          movementContribution: shieldMovementContribution,
          templateId: readyShieldTemplate.id,
        };
      }
    }
  }

  if (missingFacts.size > 0) {
    return partialSnapshot({
      ...input,
      carriedItems,
      missingFacts,
      totalEffectiveCarriedEncumbrance,
    });
  }

  const carryingCapacityInputs = {
    constitution: characteristics.constitution!,
    size: characteristics.size!,
    strength: characteristics.strength!,
  };
  const carryingCapacity = calculateWorkbookCarryCapacity(carryingCapacityInputs);
  const encumbrance = calculateWorkbookEncumbranceLevel({
    carryCapacity: carryingCapacity,
    totalEncumbrance: totalEffectiveCarriedEncumbrance,
  });
  if (!encumbrance) {
    return partialSnapshot({
      ...input,
      carriedItems,
      missingFacts: ["carrying_capacity"],
      totalEffectiveCarriedEncumbrance,
    });
  }
  const finalMovementModifier = calculateWorkbookMovementModifier({
    encumbranceLevel: encumbrance.encumbranceLevel,
    shieldMovementModifier: shieldMovementContribution,
  });

  return combatMovementBurdenSnapshotSchema.parse({
    schemaVersion: 1,
    participantId: input.participantId,
    sourceSnapshotId: input.sourceSnapshotId,
    equipmentLoadoutRevision: input.equipmentLoadoutRevision,
    carriedItems,
    totalEffectiveCarriedEncumbrance,
    carryingCapacityInputs,
    carryingCapacity,
    carriedPercentage: encumbrance.encumbrancePercent,
    encumbranceLevel: encumbrance.encumbranceLevel,
    shield,
    shieldMovementContribution,
    finalMovementModifier,
    completeness: "complete",
    missingFacts: [],
    provenance: {
      carriedLoadSource: "scenario_equipment_snapshot",
      formula: "themistogenes_movement_modifier_v1",
      sourceRange: "Calculations!L39:S42",
      workbook: "Themistogenes 1.07.xlsx",
    },
  });
}
