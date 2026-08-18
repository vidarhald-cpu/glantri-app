import { type CombatModifierResolution, type ScenarioParticipant } from "@glantri/domain";
import {
  resolveCombatDefenseCalculation,
  resolveCombatMovementBurden,
  type CompleteCombatDefenseCalculation,
} from "@glantri/rules-engine";

import { resolveCanonicalParticipantCalculationContext } from "./combatParticipantCalculationResolution";

export interface CanonicalScenarioParticipantDefenseCalculation
  extends CompleteCombatDefenseCalculation {
  authority: "canonical_scenario_state";
  equipmentLoadoutRevision?: string;
  participantId: string;
  sourceSnapshotId: string;
}

export interface IncompleteScenarioParticipantDefenseCalculation {
  authority: "canonical_scenario_state";
  completeness: "partial";
  missingFacts: string[];
  participantId: string;
  sourceSnapshotId: string;
}

export type ScenarioParticipantDefenseCalculation =
  | CanonicalScenarioParticipantDefenseCalculation
  | IncompleteScenarioParticipantDefenseCalculation;

/**
 * Resolves private defender DB/DM inputs from one bounded scenario participant snapshot. This is
 * a live server calculation adapter, not a presentation snapshot and not a persisted baseline.
 */
export function resolveCanonicalScenarioParticipantDefense(input: {
  defenderResolution: CombatModifierResolution;
  flatDbResolution?: CombatModifierResolution;
  participant: ScenarioParticipant;
}): ScenarioParticipantDefenseCalculation {
  const context = resolveCanonicalParticipantCalculationContext(input.participant);
  if (context.completeness !== "complete") return context;
  const sourceSnapshotId = context.sourceSnapshotId;
  const missingFacts = new Set<string>();
  if (!context.locationsComplete) missingFacts.add("storage_locations");
  const locationsById = Object.fromEntries(
    context.locations.map((location) => [location.id, location] as const),
  );
  const movement = resolveCombatMovementBurden({
    characterId: context.characterId,
    characteristics: {
      constitution: context.characterInputs.constitution,
      size: context.characterInputs.size,
      strength: context.characterInputs.strength,
    },
    equipmentLoadoutRevision: input.participant.updatedAt,
    equipmentState: context.locationsComplete
      ? {
          activeLoadout: context.loadout,
          items: [...context.itemsById.values()],
          locationsById,
          templatesById: Object.fromEntries(context.templatesById),
        }
      : undefined,
    participantId: input.participant.id,
    sourceSnapshotId,
  });
  if (movement.completeness !== "complete") {
    for (const fact of movement.missingFacts) missingFacts.add(`movement:${fact}`);
  }
  if (missingFacts.size > 0 || movement.completeness !== "complete") {
    return {
      authority: "canonical_scenario_state",
      completeness: "partial",
      missingFacts: [...missingFacts].sort(),
      participantId: input.participant.id,
      sourceSnapshotId,
    };
  }

  const calculation = resolveCombatDefenseCalculation({
    characterInputs: context.characterInputs,
    dynamicRawModifiers: input.defenderResolution.rows.map((row) => ({
      label: row.label,
      value: row.value,
    })),
    encumbranceLevel: movement.encumbranceLevel,
    flatDbAdjustment: input.flatDbResolution?.total ?? 0,
    primaryWeaponTemplate: context.primaryWeaponTemplate,
    readyShieldTemplate: context.readyShieldTemplate,
    secondaryWeaponTemplate: context.secondaryWeaponTemplate,
  });
  if (calculation.completeness !== "complete") {
    return {
      authority: "canonical_scenario_state",
      completeness: "partial",
      missingFacts: calculation.missingFacts,
      participantId: input.participant.id,
      sourceSnapshotId,
    };
  }

  return {
    ...calculation,
    authority: "canonical_scenario_state",
    equipmentLoadoutRevision: input.participant.updatedAt,
    participantId: input.participant.id,
    sourceSnapshotId,
  };
}
