import type {
  CombatRoundParryResolution,
  CombatRoundStep,
  CombatRoundPhase,
  ScenarioParticipantCombatContext,
} from "@glantri/domain";

import type {
  PlayerCombatAttackStatsView,
  PlayerCombatDefenseStatsView,
  PlayerCombatPhaseCardView,
} from "@/features/player-combat/PlayerCombatPanels";
import {
  buildPlayerCombatPhasePanelModel,
  type PlayerCombatPhaseKey,
} from "@/features/player-combat/playerCombatPhaseModel";
import type {
  EncounterDbParryModifierCalculation,
  EncounterLiveCombatModifierSummary,
} from "@/lib/campaigns/liveCombatModifiers";
import type { PlayerEncounterActionId } from "@/lib/campaigns/playerEncounter";

export const COMBAT_ROUND_MODIFIER_LAYERS = [
  "baseCombatState",
  "roundPhaseModifiers",
  "situationalResolutionModifiers",
] as const;

export type CombatRoundModifierLayer = (typeof COMBAT_ROUND_MODIFIER_LAYERS)[number];

export interface CombatRoundPhasePanelModifierContext {
  phaseModifiers: {
    dbRaw: number;
    generalFatigueRaw: number;
    initiativeRaw: number;
    obSkillRaw: number;
  };
  situationalModifiers: Array<{
    label: string;
    source: "attackResult" | "other";
    value: number;
  }>;
}

export interface CombatRoundSelectedResolutionContext {
  attackResultId?: string;
  parryBase?: number;
  parryModifierCalculation?: EncounterDbParryModifierCalculation | null;
  parryResolution?: CombatRoundParryResolution;
  parrySourceLabel?: string;
}

export interface CombatRoundPhasePanelProjection {
  attackRows: PlayerCombatAttackStatsView | null;
  contextAttackResultId?: string;
  defenseRows: PlayerCombatDefenseStatsView | null;
  modifierContext: CombatRoundPhasePanelModifierContext;
  participantId?: string;
  phase: CombatRoundPhase;
  phaseModel: ReturnType<typeof buildPlayerCombatPhasePanelModel>;
  selectedStep: CombatRoundStep;
}

function getPhaseModifierContext(
  liveModifiers?: EncounterLiveCombatModifierSummary,
): CombatRoundPhasePanelModifierContext["phaseModifiers"] {
  return {
    dbRaw: liveModifiers?.dbRaw ?? 0,
    generalFatigueRaw: liveModifiers?.generalFatigueRaw ?? 0,
    initiativeRaw: liveModifiers?.initiativeRaw ?? 0,
    obSkillRaw: liveModifiers?.obSkillRaw ?? 0,
  };
}

function getSituationalModifiers(
  context?: CombatRoundSelectedResolutionContext,
): CombatRoundPhasePanelModifierContext["situationalModifiers"] {
  const modifiers =
    context?.parryResolution?.modifierBreakdown ??
    context?.parryModifierCalculation?.rawModifiers ??
    [];

  return modifiers
    .filter((modifier) => modifier.value !== 0 && modifier.label === "attack result")
    .map((modifier) => ({
      label: modifier.label,
      source: "attackResult" as const,
      value: modifier.value,
    }));
}

function getStoredParryBeforeRoll(
  resolution?: CombatRoundParryResolution,
): number | undefined {
  if (resolution?.status !== "resolved" || resolution.combinedParryScore === undefined) {
    return undefined;
  }

  return (
    resolution.modifiedParryBeforeRoll ??
    (resolution.modifierAdjustment === undefined
      ? undefined
      : resolution.combinedParryScore + resolution.modifierAdjustment)
  );
}

function buildContextDefenseRows(input: {
  phaseDefenseStats: PlayerCombatDefenseStatsView | null;
  selectedResolutionContext?: CombatRoundSelectedResolutionContext;
  snapshotDefenseStats?: PlayerCombatDefenseStatsView;
}): PlayerCombatDefenseStatsView | null {
  if (input.snapshotDefenseStats && !input.selectedResolutionContext) {
    return input.snapshotDefenseStats;
  }

  if (!input.phaseDefenseStats) {
    return null;
  }

  const context = input.selectedResolutionContext;
  const storedParryBeforeRoll = getStoredParryBeforeRoll(context?.parryResolution);

  if (storedParryBeforeRoll !== undefined) {
    return {
      ...input.phaseDefenseStats,
      parry: String(storedParryBeforeRoll),
      sourceName: context?.parryResolution?.parrySourceLabel ?? input.phaseDefenseStats.sourceName,
    };
  }

  if (context?.parryModifierCalculation && context.parryBase !== undefined) {
    return {
      ...input.phaseDefenseStats,
      parry: String(context.parryModifierCalculation.finalValue),
      sourceName: context.parrySourceLabel ?? input.phaseDefenseStats.sourceName,
    };
  }

  return input.phaseDefenseStats;
}

export function buildCombatRoundPhasePanelProjection(input: {
  actionId: PlayerEncounterActionId | "";
  attackStats: PlayerCombatAttackStatsView | null;
  liveModifiers?: EncounterLiveCombatModifierSummary;
  participantId?: string;
  phaseCard: PlayerCombatPhaseCardView;
  phaseContext: ScenarioParticipantCombatContext;
  phaseKey: PlayerCombatPhaseKey;
  phaseDefenseStats: PlayerCombatDefenseStatsView | null;
  secondaryActionId: PlayerEncounterActionId | "";
  selectedResolutionContext?: CombatRoundSelectedResolutionContext;
  selectedStep: CombatRoundStep;
  snapshotAttackStats?: PlayerCombatAttackStatsView;
  snapshotDefenseStats?: PlayerCombatDefenseStatsView;
}): CombatRoundPhasePanelProjection {
  const attackRows = input.snapshotAttackStats ?? input.attackStats;
  const defenseRows = buildContextDefenseRows({
    phaseDefenseStats: input.phaseDefenseStats,
    selectedResolutionContext: input.selectedResolutionContext,
    snapshotDefenseStats: input.snapshotDefenseStats,
  });
  const phaseModel = buildPlayerCombatPhasePanelModel({
    actionId: input.actionId,
    attackStats: attackRows,
    defenseStats: defenseRows,
    phaseCard: input.phaseCard,
    phaseContext: input.phaseContext,
    phaseKey: input.phaseKey,
    secondaryActionId: input.secondaryActionId,
  });

  return {
    attackRows,
    contextAttackResultId: input.selectedResolutionContext?.attackResultId,
    defenseRows,
    modifierContext: {
      phaseModifiers: getPhaseModifierContext(input.liveModifiers),
      situationalModifiers: getSituationalModifiers(input.selectedResolutionContext),
    },
    participantId: input.participantId,
    phase: input.phaseKey,
    phaseModel,
    selectedStep: input.selectedStep,
  };
}
