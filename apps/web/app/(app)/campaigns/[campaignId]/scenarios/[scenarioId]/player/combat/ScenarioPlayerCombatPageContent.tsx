"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  type CombatHistoryProjection,
  type CombatRoundCombatExperienceResult,
  type CombatRoundAttackRollResult,
  type CombatRoundDeclaration,
  type CombatRoundInitiativeRank,
  type CombatRoundParryResolution,
  type CombatRoundPhase,
  type CombatRoundPhaseInitiativeChoice,
  type CombatRoundPhaseResolutionResult,
  type CombatRoundEndHealthRollProposal,
  type CombatRoundStep,
  type CombatDistance,
  characterBuildSchema,
  canBackOutCombatRoundPhaseAttack,
  formatOpenEndedD20RollBreakdown,
  getCombatRoundAttackResultById,
  getCombatRoundArmorCriticalModifierForDamageResult,
  getCombatRoundDamageSubstate,
  getCombatRoundDisplayIncomingAttackResultForParticipantPhase,
  getCombatRoundCombatExperienceDifficulty,
  getCombatRoundEffectiveCriticalRoll,
  getCombatRoundEffectiveDamageResult,
  getCombatRoundPhaseInitiativeChoice,
  getCombatRoundIncomingAttackResultsForParticipantPhase,
  getCombatRoundOutgoingAttackResultForParticipantPhase,
  getCombatRoundPhaseAttackBackOutOpportunity,
  getCombatRoundPhaseCombatExperienceRequirement,
  getCombatRoundEndHealthCheckPendingRolls,
  getCombatRoundPhaseResolutionResultForAttack,
  getCombatRoundRequiredCombatExperienceTrigger,
  getReactiveAttackPhase2InitiativeModifier,
  getDistanceEdgeBetweenParticipantAliases,
  getCombatDistanceParticipantAliases,
  getCombatRoundInitiativeRanks,
  getCombatRoundInitiativeTotal,
  getMergedCombatDbParryModifierTotal,
  getCombatRoundResolutionPhaseForStep,
  getCombatRoundStepForCursorStep,
  getHitLocationFullLabel,
  getPlayerCombatCurrentRollAction,
  getParticipantCombatExperienceSkillTotalLookup,
  getWeaponPreferredDistances,
  hasScenarioParticipantCombatDeclarationForEncounterRound,
  initializeCombatRoundState,
  isCombatRoundCombatExperienceWindowOpen,
  lookupCombatCriticalModifier,
  validateCombatDeclarationTargets,
  type EncounterSession,
  type ScenarioParticipantCombatContext,
  type ScenarioParticipant,
  type ScenarioPlayerProjection,
  type ScenarioPlayerVisibleParticipant,
  type MovementIntent,
  type WeaponTemplate,
  buildCombatRoundPhaseResolutionResult,
} from "@glantri/domain";

import {
  buildConciseDodgeCalculationRows,
  buildProjectedCombatTrackerModel,
  CombatTracker,
  getProjectedCombatHistoryCellEvents,
  getCombatProgressionPresentationTasks,
  isCombatViewRevisionAtLeast,
  isCombatViewRevisionUnchanged,
  PlayerCombatHistoryInspector,
  resolveProjectedCombatHistoryPanelSnapshot,
  type CombatHistoryInspectionSelection,
} from "@/features/combat-history";

import {
  buildEquipmentLoadoutModuleModel,
  EquipmentLoadoutModule,
} from "@/features/equipment/loadoutModule";
import {
  buildPlayerCombatModifierRows,
  getPlayerCombatActionButtonLabel,
  getPlayerCombatStepLabel,
  formatCombatInitiativeFormula,
  PlayerCombatAttackLocationSelector,
  PlayerCombatAttackModeSelector,
  PlayerCombatAttackStatsTable,
  PlayerCombatAttackTargetSelector,
  PlayerCombatActionButtonPanel,
  PlayerCombatActionResultPanel,
  PlayerCombatActionSelectorPanel,
  type PlayerCombatDistancePreferenceOption,
  PlayerCombatDefenseStatsTable,
  PlayerCombatModifierPanel,
  PlayerCombatParryContextPanel,
  PlayerCombatPhasePanel,
  playerCombatPanelRowStyle,
  playerCombatTopPanelRowStyle,
  sanitizePlayerCombatModifierContext,
} from "@/features/player-combat/PlayerCombatPanels";
import {
  applyDefaultPlayerCombatPhaseContext,
  buildCanonicalCombatTargetOptions,
  buildCombatAttackSourceRef,
  buildPlayerCombatDefenseStats,
  buildPlayerCombatLoadoutSummary,
  buildPlayerCombatPhasePanelModel,
  formatScenarioCombatEquipmentDiagnostic,
  getScenarioCombatEquipmentStatus,
  isEquipmentFeatureState,
  resolveCombatFeintDeclarationRequestTarget,
  resolveCombatFeintWeaponSkill,
  resolveCanonicalCombatTargetIdentity,
  resolveCombatEquipmentCharacterId,
  resolveScenarioCombatEquipmentState,
  type PlayerCombatPhaseKey,
} from "@/features/player-combat/playerCombatPhaseModel";
import { getPlayerCombatModifierDisplayPhase } from "@/features/player-combat/playerCombatModifierPhase";
import {
  getLatestRelevantPlayerCombatAttackResult,
  selectPlayerCombatActionResultPanel,
} from "@/features/player-combat/playerCombatResultSelection";
import type { EquipmentFeatureState } from "@/features/equipment/types";
import { useSessionUser } from "@/lib/auth/SessionUserContext";
import { buildCharacterSheetSummary, type CombatAllocationState } from "@glantri/rules-engine";
import {
  createEmptyPlayerEncounterCombatContext,
  evaluatePlayerEncounterParryLegality,
  getPlayerEncounterAccessibleParticipants,
  getPlayerEncounterOpponentParticipants,
  isPlayerEncounterActionId,
  mergeCombatContextWithCurrentModifierBuckets,
  type PlayerEncounterActionId,
  type PlayerEncounterMovementId,
} from "@/lib/campaigns/playerEncounter";
import { loadCanonicalContent } from "@/lib/content/loadCanonicalContent";
import {
  backOutPhaseAttackOnServer,
  continuePhaseAttackOnServer,
  decideDoubleAttackPhase2OnServer,
  loadCombatHistory,
  loadCharacterEquipmentState,
  loadEncounterById,
  loadScenarioMyParticipant,
  loadScenarioParticipants,
  loadScenarioPlayerProjection,
  loadServerCharacterById,
  rollCombatAttackOnServer,
  rollCombatCriticalOnServer,
  rollCombatExperienceOnServer,
  rollCombatHitLocationOnServer,
  rollCombatInitiativeOnServer,
  rollCombatParryOnServer,
  rollCombatFeintOnServer,
  respondCombatAdjustDistanceOnServer,
  rollCombatAdjustDistanceOnServer,
  rollRoundEndDistanceControlOnServer,
  rollRoundEndHealthCheckOnServer,
  submitCombatDeclarationOnServer,
  type ServerCharacterRecord,
} from "@/lib/api/localServiceClient";
import {
  buildRememberedScopedSelectionKey,
  REMEMBERED_SELECTION_KEYS,
  useRememberedSelection,
} from "@/lib/browser/rememberedSelection";
import RememberedCampaignWorkspaceEffect from "@/lib/campaigns/RememberedCampaignWorkspaceEffect";
import { buildCampaignWorkspaceHref, type CampaignWorkspaceTabId } from "@/lib/campaigns/workspace";
import {
  buildEncounterInitiativeModifierCalculation,
  buildEncounterLiveCombatModifierSummary,
} from "@/lib/campaigns/liveCombatModifiers";
import { projectCombatActionGeneratedModifiers } from "@/features/combat-round-manager/combatDistanceModifierProjection";

interface ScenarioPlayerCombatPageContentProps {
  campaignId: string;
  encounterId?: string;
  embedded?: boolean;
  encounterTitle?: string;
  participantId?: string;
  readOnlyInspection?: boolean;
  scenarioId: string;
  showParticipantSelector?: boolean;
  showWorkspaceHeader?: boolean;
  workspaceTab?: Extract<CampaignWorkspaceTabId, "combat" | "player-combat" | "player-encounter">;
}

type PhaseAttackChoiceSelection = "continue" | "back_out";
type DoubleAttackPhase2Decision = "continue" | "cancel";

type PlayerCombatActionResultSectionView = {
  calculationLines: readonly string[];
  resultLine?: string;
  title: string;
};

type PlayerCombatActionResultPanelView = {
  detailLines?: readonly string[];
  interpretedResult: string;
  rankLabel?: string;
  resultLabel?: string;
  sections?: readonly PlayerCombatActionResultSectionView[];
};

const panelStyle = {
  background: "#f6f5ef",
  border: "1px solid #d9ddd8",
  borderRadius: 12,
  display: "grid",
  gap: "0.75rem",
  padding: "1rem",
} as const;

function getCombatAttackPhaseForStep(step: CombatRoundStep): CombatRoundPhase | undefined {
  if (step === "phase_1_actions") {
    return "phase1";
  }

  if (step === "phase_2_actions") {
    return "phase2";
  }

  return undefined;
}

function formatCombatAttackResultLine(input: {
  participantId?: string;
  result: CombatRoundAttackRollResult;
}): string {
  const rollText = formatOpenEndedD20RollBreakdown({
    dieResult: input.result.rollTotal,
    openEndedD10s: input.result.openEndedD10s,
    rollD20: input.result.rollD20,
  });
  const attackText = `${input.result.weaponName} OB ${input.result.ob} + roll ${rollText}`;
  const lookupText = String(input.result.lookupTotal);

  return input.participantId === input.result.defenderParticipantId
    ? `Defense: DB ${input.result.defenderDb} vs ${attackText} = ${lookupText}`
    : `Main: ${input.result.weaponName} OB ${input.result.ob} - DB ${input.result.defenderDb} + roll ${rollText} = ${lookupText}`;
}

function formatCombatExperienceStatus(result?: CombatRoundCombatExperienceResult): string {
  if (!result) {
    return "Not rolled";
  }

  const isPhaseResult = result.trigger !== "combat_start";

  if (result.noRollRequired) {
    return isPhaseResult ? "Attack continues, no roll required" : "Active, no roll required";
  }

  if (
    isPhaseResult &&
    result.effectiveTableTotal !== undefined &&
    result.effectiveTableTotal <= 5
  ) {
    return "No attack made";
  }

  if (isPhaseResult && result.modifierValue < 0) {
    return `Attack continues, OB ${result.modifierValue}`;
  }

  if (!result.needsEffectRow || result.modifierValue === 0) {
    return isPhaseResult ? "Attack continues, no modifier" : "Active, no modifier";
  }

  return `${result.label} ${result.modifierValue}, duration ${result.durationRounds}`;
}

function formatCombatExperienceResultLine(result: CombatRoundCombatExperienceResult): string {
  const isPhaseResult = result.trigger !== "combat_start";

  if (result.noRollRequired) {
    return "Result: Active, no modifier";
  }

  if (
    isPhaseResult &&
    result.effectiveTableTotal !== undefined &&
    result.effectiveTableTotal <= 5
  ) {
    return "Result: attack cancelled";
  }

  if (isPhaseResult && result.modifierValue < 0) {
    return `Result: OB ${result.modifierValue}`;
  }

  if (!result.needsEffectRow || result.modifierValue === 0) {
    return "Result: Active, no modifier";
  }

  return `Result: ${result.label}, General ${result.modifierValue} for ${result.durationRounds} round${
    result.durationRounds === 1 ? "" : "s"
  }`;
}

function buildPhaseInitiativeChoiceResultPanel(choice?: CombatRoundPhaseInitiativeChoice): {
  interpretedResult: string;
  rankLabel?: string;
  resultLabel?: string;
} | null {
  if (!choice) {
    return null;
  }

  if (choice.choice === "roll_ce_result" && choice.combatExperience) {
    return {
      interpretedResult: choice.combatExperience.noRollRequired
        ? `Combat Experience ${choice.combatExperience.skillTotal} vs difficulty ${choice.combatExperience.difficulty}`
        : `Combat Experience ${choice.combatExperience.skillTotal} + roll ${choice.combatExperience.rollTotal} = ${choice.combatExperience.finalTotal} vs ${choice.combatExperience.difficulty}`,
      rankLabel: "Combat Experience",
      resultLabel: formatCombatExperienceResultLine(choice.combatExperience),
    };
  }

  if (choice.choice === "back_out") {
    return {
      interpretedResult: "Back out of attack",
      rankLabel: "Phase Combat Experience",
      resultLabel: "Result: attack cancelled/backed out",
    };
  }

  if (choice.choice === "continue_without_ce") {
    return {
      interpretedResult: "Continue attack",
      rankLabel: "Phase Combat Experience",
      resultLabel: "Result: no CE roll required",
    };
  }

  return null;
}

function formatRoundEndHealthCheckReason(input: {
  damageLabel?: string;
  proposal: CombatRoundEndHealthRollProposal;
}): string {
  if (input.damageLabel) {
    return input.damageLabel;
  }

  return input.proposal.bleedType === "internal" ? "Internal bleed" : "Bleed";
}

function formatRoundEndHealthCheckResultLine(
  proposal: CombatRoundEndHealthRollProposal,
): string | undefined {
  const result = proposal.result;

  if (!result) {
    return undefined;
  }

  const bleedLabel = proposal.bleedType === "internal" ? "internal bleed" : "bleed";

  if (result.success && proposal.previousBleedRate !== undefined) {
    return proposal.nextBleedRate !== undefined
      ? `Result: success, ${bleedLabel} reduced from ${proposal.previousBleedRate} to ${proposal.nextBleedRate}`
      : "Result: success";
  }

  if (result.success) {
    return "Result: success";
  }

  return proposal.previousBleedRate !== undefined
    ? `Result: failure, ${bleedLabel} remains ${proposal.previousBleedRate}`
    : "Result: failure";
}

function formatDistanceControlOpponentStatus(input: {
  opponentLabel: string;
  opponentStatus: string;
  proposalStatus: string;
}): string {
  if (input.proposalStatus === "committed") {
    return `${input.opponentLabel}: committed`;
  }

  if (input.proposalStatus === "rolled" || input.proposalStatus === "review_ready") {
    return `${input.opponentLabel}: waiting for GM`;
  }

  if (input.opponentStatus === "rolled") {
    return `${input.opponentLabel}: rolled`;
  }

  if (input.opponentStatus === "not_required") {
    return `${input.opponentLabel}: submitted`;
  }

  return `${input.opponentLabel}: pending`;
}

function formatDistanceControlProgressLine(input: {
  ownStatus: string;
  opponentStatus: string;
  proposalStatus: string;
}): string | undefined {
  if (input.proposalStatus === "committed") {
    return undefined;
  }

  if (input.ownStatus === "pending") {
    return "Roll your Dodge for distance control.";
  }

  if (input.opponentStatus === "pending") {
    return "Waiting for opponent distance-control roll.";
  }

  return "Waiting for GM to commit distance control.";
}

function formatResolutionStatusLabel(value: string): string {
  return value
    .split("_")
    .map((part, index) => {
      if (index !== 0) {
        return part;
      }

      return part.length > 0 ? `${part[0]?.toUpperCase()}${part.slice(1)}` : part;
    })
    .join(" ");
}

function formatCombatParryCalculationLine(
  resolution: CombatRoundParryResolution,
): string | undefined {
  if (
    resolution.status !== "resolved" ||
    resolution.combinedParryScore === undefined ||
    resolution.modifierAdjustment === undefined ||
    resolution.rollD20 === undefined ||
    resolution.rollTotal === undefined ||
    resolution.total === undefined
  ) {
    return undefined;
  }

  const rollText = formatOpenEndedD20RollBreakdown({
    dieResult: resolution.rollTotal,
    openEndedD10s: resolution.openEndedD10s,
    rollD20: resolution.rollD20,
  });

  return `Parry: P ${resolution.combinedParryScore} + [mods] ${resolution.modifierAdjustment >= 0 ? "+" : ""}${resolution.modifierAdjustment} + roll ${rollText} = ${resolution.total}`;
}

function formatPlayerCombatLocationCalculationLine(
  resolution: CombatRoundPhaseResolutionResult,
): string | undefined {
  const locationRoll = resolution.hitLocationRoll;

  if (locationRoll.status !== "rolled") {
    return undefined;
  }

  const rollsLabel = locationRoll.hitLocationRolls.join(", ");
  const targetLabel =
    locationRoll.targetLocation && locationRoll.targetLocation !== "none"
      ? getHitLocationFullLabel(locationRoll.targetLocation)
      : "None";
  const selectedLabel = locationRoll.selectedHitLocation
    ? getHitLocationFullLabel(locationRoll.selectedHitLocation)
    : "Unknown";

  return locationRoll.selectionReason === "targeted_closest"
    ? `Target ${targetLabel}; rolls ${rollsLabel} -> ${selectedLabel}`
    : `Roll ${rollsLabel}`;
}

function formatPlayerCombatLocationResultLine(
  resolution: CombatRoundPhaseResolutionResult,
): string | undefined {
  const locationRoll = resolution.hitLocationRoll;

  if (locationRoll.status !== "rolled" || !locationRoll.selectedHitLocation) {
    return undefined;
  }

  return `Result: ${getHitLocationFullLabel(locationRoll.selectedHitLocation)}`;
}

function formatPlayerCombatDamageLocationSuffix(
  resolution: CombatRoundPhaseResolutionResult,
): string {
  const damage = resolution.damageResult;
  const location = damage
    ? getCombatRoundEffectiveDamageResult(damage).effectiveSelectedHitLocation
    : resolution.hitLocationRoll.selectedHitLocation;

  return location ? ` at ${getHitLocationFullLabel(location).toLowerCase()}` : "";
}

function formatPlayerCombatDamageCalculationLine(
  resolution: CombatRoundPhaseResolutionResult,
): string | undefined {
  const damage = resolution.damageResult;

  if (!damage) {
    return undefined;
  }

  const effectiveDamage = getCombatRoundEffectiveDamageResult(damage);

  if (damage.grazing && effectiveDamage.effectiveDamageRoll.required) {
    const rawGrazingDamage =
      effectiveDamage.effectiveDamageRoll.rawGrazingDamage ??
      effectiveDamage.effectiveDamageRoll.total;
    const rollLabel =
      effectiveDamage.effectiveDamageRoll.diceExpression && rawGrazingDamage !== undefined
        ? `${effectiveDamage.effectiveDamageRoll.diceExpression} = ${rawGrazingDamage}`
        : "grazing damage roll recorded";

    return `Grazing damage: ${rollLabel}`;
  }

  if (effectiveDamage.effectiveDamageLookupTotal !== undefined) {
    return `Damage lookup ${effectiveDamage.effectiveDamageLookupTotal}`;
  }

  return "Damage proposal recorded";
}

function formatSignedPlayerCombatNumber(value: number): string {
  return value >= 0 ? `+${value}` : `${value}`;
}

function getPlayerCombatCriticalTypeModifier(grade: string | undefined): number | undefined {
  if (!grade) {
    return undefined;
  }

  try {
    return lookupCombatCriticalModifier(grade).criticalTypeModifier;
  } catch {
    return undefined;
  }
}

function formatPlayerCombatCriticalContextLine(input: {
  attackResult?: CombatRoundAttackRollResult;
  compact?: boolean;
  resolution: CombatRoundPhaseResolutionResult;
}): string | undefined {
  const damage = input.resolution.damageResult;
  const criticalRoll = input.resolution.criticalRoll;
  const effectiveDamage = damage ? getCombatRoundEffectiveDamageResult(damage) : undefined;
  const effectiveCritical = getCombatRoundEffectiveCriticalRoll({
    criticalRoll,
    review: damage?.review,
  });
  const criticalGrade =
    effectiveDamage?.effectiveCriticalGrade ?? criticalRoll.criticalGrade ?? undefined;
  const selectedLocation =
    effectiveCritical.criticalLocation ??
    effectiveDamage?.effectiveSelectedHitLocation ??
    criticalRoll.selectedHitLocation;

  if (!criticalGrade && !selectedLocation && !input.attackResult?.weaponCriticalCode) {
    return undefined;
  }

  const contextParts = [
    criticalGrade ? `Critical ${criticalGrade.toUpperCase()}` : "Critical",
    selectedLocation ? `to ${getHitLocationFullLabel(selectedLocation).toLowerCase()}` : undefined,
    input.attackResult?.weaponCriticalCode
      ? `MC ${input.attackResult.weaponCriticalCode}`
      : undefined,
    input.attackResult?.weaponDamageClass,
  ].filter((part): part is string => Boolean(part));

  if (input.compact) {
    return contextParts.join(" ");
  }

  const criticalTypeModifier =
    effectiveCritical.criticalTypeModifier ??
    criticalRoll.criticalTypeModifier ??
    getPlayerCombatCriticalTypeModifier(criticalGrade);
  const armorCriticalModifier =
    effectiveCritical.armorCriticalModifier ??
    criticalRoll.armorCriticalModifier ??
    (damage
      ? getCombatRoundArmorCriticalModifierForDamageResult(damage).armorCriticalModifier
      : undefined);
  const modifierParts = [
    criticalTypeModifier !== undefined
      ? `type mod ${formatSignedPlayerCombatNumber(criticalTypeModifier)}`
      : undefined,
    armorCriticalModifier !== undefined
      ? `armor crit ${formatSignedPlayerCombatNumber(armorCriticalModifier)}`
      : undefined,
  ].filter((part): part is string => Boolean(part));

  return [...contextParts, ...modifierParts].join(" · ");
}

function formatPlayerCombatRecordedDamageLine(
  resolution: CombatRoundPhaseResolutionResult,
): string | undefined {
  const damage = resolution.damageResult;

  if (!damage || resolution.damageProposal.status !== "committed") {
    return undefined;
  }

  const effectiveDamage = getCombatRoundEffectiveDamageResult(damage);

  return `Recorded damage: ${effectiveDamage.effectiveTotalDamage}${formatPlayerCombatDamageLocationSuffix(
    resolution,
  )}`;
}

function formatPlayerCombatRecordedEffectsLine(
  resolution: CombatRoundPhaseResolutionResult,
): string | undefined {
  if (resolution.damageProposal.status !== "committed") {
    return undefined;
  }

  const review = resolution.damageResult?.review;
  const acceptedEffectLabels = (review?.additionalEffects ?? [])
    .filter((effect) => effect.accepted !== false)
    .map((effect) => effect.label);
  const acceptedOperationalLabels = (review?.operationalConsequences ?? [])
    .filter((consequence) => consequence.accepted !== false)
    .map((consequence) => consequence.label);
  const labels = [...acceptedEffectLabels, ...acceptedOperationalLabels];

  return labels.length > 0 ? `Recorded effects: ${labels.join(", ")}` : undefined;
}

function formatPlayerCombatCriticalCalculationLine(input: {
  attackResult?: CombatRoundAttackRollResult;
  resolution: CombatRoundPhaseResolutionResult;
}): string | undefined {
  const criticalRoll = input.resolution.criticalRoll;
  const effectiveCritical = getCombatRoundEffectiveCriticalRoll({
    criticalRoll,
    review: input.resolution.damageResult?.review,
  });
  const contextLine = formatPlayerCombatCriticalContextLine(input);

  if (criticalRoll.status === "not_required") {
    return input.resolution.damageResult ? "No critical roll required" : undefined;
  }

  if (criticalRoll.status !== "rolled" || !criticalRoll.criticalDice) {
    return contextLine ? `Critical roll required: ${contextLine}` : "Critical roll required";
  }

  const rollLine = `2d8 ${criticalRoll.criticalDice.join(" + ")} + type mod ${
    effectiveCritical.criticalTypeModifier ?? criticalRoll.criticalTypeModifier ?? 0
  } - armor crit mod ${
    effectiveCritical.armorCriticalModifier ?? criticalRoll.armorCriticalModifier ?? 0
  } = ${effectiveCritical.finalCriticalRoll ?? criticalRoll.finalCriticalRoll}`;

  return contextLine ? `${contextLine}; ${rollLine}` : rollLine;
}

function formatPlayerCombatCriticalResultLine(
  resolution: CombatRoundPhaseResolutionResult,
): string | undefined {
  const criticalRoll = resolution.criticalRoll;
  const proposal = resolution.damageResult?.review?.criticalEffectProposal;
  const effectiveCritical = getCombatRoundEffectiveCriticalRoll({
    criticalRoll,
    review: resolution.damageResult?.review,
  });

  if (criticalRoll.status === "not_required") {
    return resolution.damageResult ? "Result: no critical" : undefined;
  }

  if (criticalRoll.status !== "rolled") {
    return "Result: pending";
  }

  if (proposal?.criticalIndexStatus === "no_effect") {
    return "Result: no critical effect";
  }

  if (proposal?.title) {
    return `Result: ${proposal.title}`;
  }

  const location = effectiveCritical.criticalLocation
    ? ` at ${getHitLocationFullLabel(effectiveCritical.criticalLocation).toLowerCase()}`
    : "";

  return `Result: critical roll ${effectiveCritical.finalCriticalRoll ?? criticalRoll.finalCriticalRoll}${location}`;
}

function isPlayerInvolvedInPhaseResolution(input: {
  participantId?: string;
  resolution: CombatRoundPhaseResolutionResult;
}): boolean {
  return Boolean(
    input.participantId &&
    (input.resolution.attackerParticipantId === input.participantId ||
      input.resolution.defenderParticipantId === input.participantId),
  );
}

function isPlayerVisibleDamageResolution(input: {
  participantId?: string;
  resolution: CombatRoundPhaseResolutionResult;
}): boolean {
  if (!isPlayerInvolvedInPhaseResolution(input)) {
    return false;
  }

  return (
    input.resolution.hitLocationRoll.status === "rolled" ||
    input.resolution.criticalRoll.status === "rolled" ||
    input.resolution.damageProposal.status === "committed"
  );
}

function getLatestPlayerVisibleDamageResolution(input: {
  participantId?: string;
  resolutions: readonly CombatRoundPhaseResolutionResult[];
}): CombatRoundPhaseResolutionResult | undefined {
  return [...input.resolutions]
    .filter((resolution) =>
      isPlayerVisibleDamageResolution({
        participantId: input.participantId,
        resolution,
      }),
    )
    .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))[0];
}

function formatCombatPhaseResolutionResultLines(input: {
  attackResult: CombatRoundAttackRollResult;
  participantId?: string;
  resolution: CombatRoundPhaseResolutionResult;
}): {
  attackLine: string;
  proposalLine: string;
  sections: readonly {
    calculationLines: readonly string[];
    resultLine?: string;
    title: string;
  }[];
  statusLine: string;
} {
  const parry = input.resolution.parryResolution;
  const damage = input.resolution.damageRoll;
  const damageResult = input.resolution.damageResult;
  const proposal = input.resolution.damageProposal;
  const resolvedParryLine = formatCombatParryCalculationLine(parry);
  const locationCalculationLine = formatPlayerCombatLocationCalculationLine(input.resolution);
  const locationResultLine = formatPlayerCombatLocationResultLine(input.resolution);
  const damageCalculationLine = formatPlayerCombatDamageCalculationLine(input.resolution);
  const recordedDamageLine = formatPlayerCombatRecordedDamageLine(input.resolution);
  const recordedEffectsLine = formatPlayerCombatRecordedEffectsLine(input.resolution);
  const criticalCalculationLine = formatPlayerCombatCriticalCalculationLine({
    attackResult: input.attackResult,
    resolution: input.resolution,
  });
  const criticalResultLine = formatPlayerCombatCriticalResultLine(input.resolution);
  const parryLine =
    resolvedParryLine ??
    `Parry: ${formatResolutionStatusLabel(parry.status)}${
      parry.resultLabel ? ` (${parry.resultLabel})` : ""
    }`;
  const parryResultLine =
    parry.status === "resolved" && parry.resultLabel ? `Result: ${parry.resultLabel}` : undefined;
  const committedDamageResultLine = recordedDamageLine
    ? `Result: ${recordedDamageLine.replace(/^Recorded damage: /, "")}`
    : undefined;
  const proposalLine =
    input.resolution.damageProposal.status === "committed"
      ? (committedDamageResultLine ?? "Result: damage recorded")
      : criticalResultLine && input.resolution.criticalRoll.status === "rolled"
        ? criticalResultLine
        : (parryResultLine ?? `Proposal: ${formatResolutionStatusLabel(proposal.status)}`);
  const statusLine = recordedDamageLine
    ? recordedDamageLine
    : criticalResultLine && input.resolution.criticalRoll.status === "rolled"
      ? criticalResultLine.replace(/^Result: /, "Critical: ")
      : locationResultLine
        ? locationResultLine.replace(/^Result: /, "Hit location: ")
        : parryResultLine
          ? parryLine
          : `${parryLine} · Damage roll: ${formatResolutionStatusLabel(damage.status)}`;

  const attackLine = `${formatCombatAttackResultLine({
    participantId: input.participantId,
    result: input.attackResult,
  })} · Result: ${input.attackResult.tableResult}`;
  const sections: PlayerCombatActionResultSectionView[] = [
    {
      calculationLines: [
        formatCombatAttackResultLine({
          participantId: input.participantId,
          result: input.attackResult,
        }),
      ],
      resultLine: `Result: ${input.attackResult.tableResult}`,
      title: "To hit",
    },
    {
      calculationLines: [resolvedParryLine ?? `Parry ${formatResolutionStatusLabel(parry.status)}`],
      resultLine: parryResultLine ?? `Result: ${formatResolutionStatusLabel(parry.status)}`,
      title: "Parry",
    },
    ...(locationCalculationLine
      ? [
          {
            calculationLines: [locationCalculationLine],
            resultLine: locationResultLine,
            title: "Hit location",
          },
        ]
      : []),
    ...(criticalCalculationLine || criticalResultLine
      ? [
          {
            calculationLines: [criticalCalculationLine].filter((line): line is string =>
              Boolean(line),
            ),
            resultLine: criticalResultLine,
            title: "Critical",
          },
        ]
      : []),
    ...(damageResult || recordedDamageLine
      ? [
          {
            calculationLines: [
              damageCalculationLine,
              recordedEffectsLine,
              input.resolution.damageProposal.status === "committed"
                ? undefined
                : "Waiting for GM damage review.",
            ].filter((line): line is string => Boolean(line)),
            resultLine:
              input.resolution.damageProposal.status === "committed"
                ? (committedDamageResultLine ?? "Result: damage recorded")
                : "Result: waiting for GM review",
            title:
              input.resolution.damageProposal.status === "committed" ? "Recorded damage" : "Damage",
          },
        ]
      : []),
  ];

  return {
    attackLine,
    proposalLine,
    sections,
    statusLine,
  };
}

interface PlayerCombatDeclarationDraft {
  actionId: PlayerEncounterActionId | "";
  additionalActionNotes: string;
  combatContext: ScenarioParticipantCombatContext;
  movementId: PlayerEncounterMovementId | "";
  movementIntent: MovementIntent;
  phaseContexts: PlayerCombatPhaseContextDrafts;
  secondaryActionId: PlayerEncounterActionId | "";
}

interface PlayerCombatPhaseContextDrafts {
  phase1: ScenarioParticipantCombatContext;
  phase2: ScenarioParticipantCombatContext;
}

function buildPlayerCombatPhaseContexts(input: {
  declaration?: CombatRoundDeclaration;
  encounterId?: string;
  participant?: ScenarioParticipant | null;
  roundNumber?: number;
}): PlayerCombatPhaseContextDrafts {
  const scopedCombat = hasScenarioParticipantCombatDeclarationForEncounterRound({
    encounterId: input.encounterId,
    participant: input.participant ?? undefined,
    roundNumber: input.roundNumber,
  })
    ? input.participant?.state.combat
    : undefined;
  const fallbackContext = mergeCombatContextWithCurrentModifierBuckets({
    baseContext:
      input.declaration?.combatContext ??
      scopedCombat?.combatContext ??
      createEmptyPlayerEncounterCombatContext(),
    currentContext: scopedCombat?.combatContext,
  });

  return {
    phase1: applyDefaultPlayerCombatPhaseContext(
      input.declaration?.phaseContexts?.phase1 ?? fallbackContext,
    ),
    phase2: applyDefaultPlayerCombatPhaseContext(
      input.declaration?.phaseContexts?.phase2 ?? fallbackContext,
    ),
  };
}

function hasCombatRoundDeclarationAction(
  declaration?: CombatRoundDeclaration,
): declaration is CombatRoundDeclaration {
  return Boolean(
    declaration?.actionId ||
    declaration?.secondaryActionId ||
    declaration?.movementId ||
    declaration?.movementIntent ||
    declaration?.additionalActionNotes ||
    declaration?.combatContext ||
    declaration?.phaseContexts,
  );
}

function createDefaultMovementIntent(): MovementIntent {
  return {
    distancePreferences: [],
    mode: "hold_position",
  };
}

function normalizeCombatWeaponName(value: unknown): string | undefined {
  return typeof value === "string" && value.trim().length > 0
    ? value.trim().toLocaleLowerCase()
    : undefined;
}

function getActiveWeaponTemplatesForScenarioParticipant(
  participant: ScenarioParticipant | undefined | null,
  resolvedEquipmentState?: EquipmentFeatureState | null,
): WeaponTemplate[] {
  const equipmentStateCandidate = resolvedEquipmentState ?? participant?.snapshot.equipmentState;

  if (!isEquipmentFeatureState(equipmentStateCandidate)) {
    return [];
  }

  const characterId =
    participant?.characterId ?? Object.keys(equipmentStateCandidate.activeLoadoutByCharacterId)[0];
  const loadout = characterId
    ? equipmentStateCandidate.activeLoadoutByCharacterId[characterId]
    : undefined;
  const activeWeaponItemIds = [
    loadout?.activePrimaryWeaponItemId,
    loadout?.activeSecondaryWeaponItemId,
    loadout?.activeMissileWeaponItemId,
  ].filter((itemId): itemId is string => Boolean(itemId));

  return activeWeaponItemIds
    .map((itemId) => {
      const item = equipmentStateCandidate.itemsById[itemId];
      const template = item
        ? equipmentStateCandidate.templates.templatesById[item.templateId]
        : undefined;

      return template?.category === "weapon" ? template : undefined;
    })
    .filter((template): template is WeaponTemplate => Boolean(template));
}

function getLongestPreferredDistanceForWeaponName(input: {
  participant?: ScenarioParticipant | null;
  resolvedEquipmentState?: EquipmentFeatureState | null;
  weaponName?: string;
}): CombatDistance | undefined {
  const weaponName = normalizeCombatWeaponName(input.weaponName);
  const activeWeapons = getActiveWeaponTemplatesForScenarioParticipant(
    input.participant,
    input.resolvedEquipmentState,
  );
  const weapon =
    activeWeapons.find((candidate) => normalizeCombatWeaponName(candidate.name) === weaponName) ??
    activeWeapons[0];
  const distances = getWeaponPreferredDistances(weapon);

  return distances.at(-1);
}

function buildPlayerCombatDeclarationDraft(input: {
  declaration?: CombatRoundDeclaration;
  encounterId?: string;
  participant?: ScenarioParticipant | null;
  roundNumber?: number;
}): PlayerCombatDeclarationDraft {
  const { declaration, participant } = input;
  const scopedCombat = hasScenarioParticipantCombatDeclarationForEncounterRound({
    encounterId: input.encounterId,
    participant: participant ?? undefined,
    roundNumber: input.roundNumber,
  })
    ? participant?.state.combat
    : undefined;

  return {
    actionId: isPlayerEncounterActionId(declaration?.actionId)
      ? declaration.actionId
      : isPlayerEncounterActionId(scopedCombat?.lastDeclaredActionId)
        ? scopedCombat.lastDeclaredActionId
        : "",
    additionalActionNotes:
      declaration?.additionalActionNotes ?? scopedCombat?.lastDeclarationNotes ?? "",
    combatContext: mergeCombatContextWithCurrentModifierBuckets({
      baseContext:
        declaration?.combatContext ??
        scopedCombat?.combatContext ??
        createEmptyPlayerEncounterCombatContext(),
      currentContext: scopedCombat?.combatContext,
    }),
    movementId: (declaration?.movementId ??
      scopedCombat?.lastDeclaredMovementId ??
      "hold") as PlayerEncounterMovementId,
    movementIntent:
      declaration?.movementIntent ??
      scopedCombat?.lastMovementIntent ??
      createDefaultMovementIntent(),
    phaseContexts: buildPlayerCombatPhaseContexts(input),
    secondaryActionId: isPlayerEncounterActionId(declaration?.secondaryActionId)
      ? declaration.secondaryActionId
      : isPlayerEncounterActionId(scopedCombat?.lastDeclaredSecondaryActionId)
        ? scopedCombat.lastDeclaredSecondaryActionId
        : "",
  };
}

function getEncounterScenarioParticipantIds(
  encounterParticipants?: EncounterSession["participants"],
): string[] {
  return (encounterParticipants ?? [])
    .map((participant) => participant.scenarioParticipantId ?? participant.id)
    .filter((participantId): participantId is string => Boolean(participantId));
}

function buildPlayerCombatDeclarationDraftKey(input: {
  currentStep?: string;
  declaration?: CombatRoundDeclaration;
  encounterId?: string;
  participantId?: string;
  roundNumber?: number;
  stepStatus?: string;
}): string {
  return [
    input.encounterId ?? "no-encounter",
    input.participantId ?? "no-participant",
    input.roundNumber ?? "no-round",
    input.currentStep ?? "no-step",
    input.stepStatus ?? "no-status",
    input.declaration?.submittedAt ?? "no-submission-time",
  ].join(":");
}

function formatPlayerCombatInitiativeRank(input: {
  participantId?: string;
  ranks: Record<string, CombatRoundInitiativeRank>;
  value: number | undefined;
}): string | undefined {
  if (!input.participantId || input.value === undefined) {
    return undefined;
  }

  const rank = input.ranks[input.participantId];

  if (!rank) {
    return undefined;
  }

  const tieLabel = rank.tiedCount > 1 ? ` (tied with ${rank.tiedCount})` : "";

  return `Rank: ${rank.rank} of ${rank.rankTotal}${tieLabel}`;
}

function parsePlayerCombatInteger(value: string | undefined, label: string): number | undefined {
  if (!value || value === "—" || value === "incomplete") {
    return undefined;
  }

  const parsed = Number(value);

  if (!Number.isInteger(parsed)) {
    throw new Error(`${label} must be an integer.`);
  }

  return parsed;
}

function parsePlayerCombatDisplayInteger(value: string | undefined): number | undefined {
  if (!value || value === "—" || value === "incomplete") {
    return undefined;
  }

  const parsed = Number(value);
  return Number.isInteger(parsed) ? parsed : undefined;
}

export default function ScenarioPlayerCombatPageContent({
  campaignId,
  encounterId,
  embedded = false,
  encounterTitle,
  participantId,
  readOnlyInspection = false,
  scenarioId,
  showParticipantSelector = true,
  showWorkspaceHeader = true,
  workspaceTab = "player-encounter",
}: ScenarioPlayerCombatPageContentProps) {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const searchParamString = searchParams.toString();
  const { currentUser, loading: sessionLoading } = useSessionUser();
  const [content, setContent] = useState<Awaited<ReturnType<typeof loadCanonicalContent>>>();
  const [error, setError] = useState<string>();
  const [loading, setLoading] = useState(true);
  const [projection, setProjection] = useState<ScenarioPlayerProjection>();
  const [encounterSession, setEncounterSession] = useState<EncounterSession>();
  const [combatHistory, setCombatHistory] = useState<CombatHistoryProjection>();
  const acceptedEncounterUpdatedAtRef = useRef<string | undefined>(undefined);
  const [historyInspection, setHistoryInspection] = useState<CombatHistoryInspectionSelection>();
  const [resolvedCharacterStateByParticipantId, setResolvedCharacterStateByParticipantId] =
    useState<
      Record<
        string,
        {
          equipmentState: EquipmentFeatureState;
          serverRecord: ServerCharacterRecord;
        }
      >
    >({});
  const [selectableParticipants, setSelectableParticipants] = useState<ScenarioParticipant[]>([]);
  const [selectedParticipantId, setSelectedParticipantId] = useState<string>("");
  const [selectedActionId, setSelectedActionId] = useState<PlayerEncounterActionId | "">("");
  const [feintMethod, setFeintMethod] = useState<"movement" | "weapon">("movement");
  const [adjustDistanceResponse, setAdjustDistanceResponse] = useState<"allow" | "oppose">(
    "oppose",
  );
  const [selectedSecondaryActionId, setSelectedSecondaryActionId] = useState<
    PlayerEncounterActionId | ""
  >("");
  const [selectedMovementId, setSelectedMovementId] = useState<PlayerEncounterMovementId | "">(
    "hold",
  );
  const [selectedMovementIntent, setSelectedMovementIntent] = useState<MovementIntent>(
    createDefaultMovementIntent(),
  );
  const [additionalActionNotes, setAdditionalActionNotes] = useState("");
  const [combatContextDraft, setCombatContextDraft] = useState<ScenarioParticipantCombatContext>(
    createEmptyPlayerEncounterCombatContext(),
  );
  const [phaseCombatContextDrafts, setPhaseCombatContextDrafts] =
    useState<PlayerCombatPhaseContextDrafts>({
      phase1: createEmptyPlayerEncounterCombatContext(),
      phase2: createEmptyPlayerEncounterCombatContext(),
    });
  const [combatDeclarationDraftDirty, setCombatDeclarationDraftDirty] = useState(false);
  const [combatDeclarationDraftKey, setCombatDeclarationDraftKey] = useState("");
  const [savingCombatContext, setSavingCombatContext] = useState(false);
  const [phaseAttackChoiceSelection, setPhaseAttackChoiceSelection] =
    useState<PhaseAttackChoiceSelection>("continue");
  const [doubleAttackPhase2Decision, setDoubleAttackPhase2Decision] =
    useState<DoubleAttackPhase2Decision>("continue");
  const [actionRollResult, setActionRollResult] = useState<{
    interpretedResult: string;
    phaseLabel?: string;
    value: number;
  } | null>(null);
  const isGameMaster = Boolean(
    currentUser?.roles.includes("game_master") || currentUser?.roles.includes("admin"),
  );
  const controlsDisabled = readOnlyInspection;
  const acceptEncounterSession = useCallback((nextEncounter: EncounterSession | undefined) => {
    if (!nextEncounter) {
      return false;
    }
    const acceptedUpdatedAt = acceptedEncounterUpdatedAtRef.current;
    if (
      !isCombatViewRevisionAtLeast({
        acceptedUpdatedAt,
        candidateUpdatedAt: nextEncounter.updatedAt,
      })
    ) {
      return false;
    }
    acceptedEncounterUpdatedAtRef.current = nextEncounter.updatedAt;
    setEncounterSession((current) =>
      isCombatViewRevisionUnchanged({
        acceptedUpdatedAt: current?.updatedAt,
        candidateUpdatedAt: nextEncounter.updatedAt,
      })
        ? current
        : nextEncounter,
    );
    return true;
  }, []);
  const rememberedParticipantSelection = useRememberedSelection(
    buildRememberedScopedSelectionKey({
      baseKey: REMEMBERED_SELECTION_KEYS.playerEncounterParticipantId,
      scopeParts: [campaignId, scenarioId],
    }),
  );

  useEffect(() => {
    if (sessionLoading) {
      return;
    }

    if (!currentUser) {
      setProjection(undefined);
      setContent(undefined);
      setLoading(false);
      return;
    }

    let cancelled = false;

    let refreshInFlight = false;
    async function refreshCombatView(input: { showLoading?: boolean } = {}) {
      if (refreshInFlight) return;
      refreshInFlight = true;
      if (input.showLoading ?? false) {
        setLoading(true);
      }

      try {
        const [nextProjection, nextContent, nextParticipants, nextEncounter, nextHistory] =
          await Promise.all([
            loadScenarioPlayerProjection(scenarioId),
            loadCanonicalContent(),
            isGameMaster
              ? loadScenarioParticipants(scenarioId)
              : loadScenarioMyParticipant(scenarioId).then((p) => (p ? [p] : [])),
            encounterId ? loadEncounterById(encounterId) : Promise.resolve(undefined),
            encounterId
              ? isGameMaster
                ? selectedParticipantId
                  ? loadCombatHistory(encounterId, {
                      perspectiveParticipantId: selectedParticipantId,
                    })
                  : Promise.resolve(undefined)
                : loadCombatHistory(encounterId)
              : Promise.resolve(undefined),
          ]);

        if (cancelled) {
          return;
        }

        const acceptedEncounter = nextEncounter ? acceptEncounterSession(nextEncounter) : true;
        if (!acceptedEncounter) return;
        setProjection(nextProjection);
        setContent(nextContent);
        setSelectableParticipants(nextParticipants);
        if (
          nextHistory &&
          (!nextEncounter ||
            !nextHistory.sourceUpdatedAt ||
            isCombatViewRevisionUnchanged({
              acceptedUpdatedAt: nextEncounter.updatedAt,
              candidateUpdatedAt: nextHistory.sourceUpdatedAt,
            }))
        ) {
          setCombatHistory((current) =>
            current && current.sourceUpdatedAt === nextHistory.sourceUpdatedAt
              ? current
              : nextHistory,
          );
        }
        setError(undefined);
      } catch (caughtError) {
        if (cancelled) {
          return;
        }

        setError(
          caughtError instanceof Error
            ? caughtError.message
            : "Unable to load the player combat screen.",
        );
      } finally {
        refreshInFlight = false;
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void refreshCombatView({ showLoading: true });

    const intervalId = window.setInterval(() => {
      if (cancelled) {
        return;
      }

      void refreshCombatView();
    }, 5000);

    function refreshOnFocus() {
      if (cancelled || document.visibilityState === "hidden") {
        return;
      }

      void refreshCombatView();
    }

    window.addEventListener("focus", refreshOnFocus);
    document.addEventListener("visibilitychange", refreshOnFocus);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
      window.removeEventListener("focus", refreshOnFocus);
      document.removeEventListener("visibilitychange", refreshOnFocus);
    };
  }, [
    acceptEncounterSession,
    currentUser,
    encounterId,
    isGameMaster,
    scenarioId,
    selectedParticipantId,
    sessionLoading,
  ]);

  useEffect(() => {
    if (!encounterId || !encounterSession || !currentUser) return;
    let cancelled = false;
    void loadCombatHistory(
      encounterId,
      isGameMaster && selectedParticipantId
        ? { perspectiveParticipantId: selectedParticipantId }
        : {},
    )
      .then((history) => {
        if (
          cancelled ||
          (history.sourceUpdatedAt &&
            !isCombatViewRevisionUnchanged({
              acceptedUpdatedAt: encounterSession.updatedAt,
              candidateUpdatedAt: history.sourceUpdatedAt,
            }))
        ) {
          return;
        }
        setCombatHistory((current) =>
          current && current.sourceUpdatedAt === history.sourceUpdatedAt ? current : history,
        );
      })
      .catch(() => {
        if (!cancelled) {
          setError("Combat view could not refresh. Showing the latest confirmed state.");
        }
      });
    return () => {
      cancelled = true;
    };
  }, [currentUser, encounterId, encounterSession?.updatedAt, isGameMaster, selectedParticipantId]);

  const accessibleParticipants = useMemo(() => {
    if (!projection) {
      return [];
    }

    return getPlayerEncounterAccessibleParticipants({
      currentUserId: currentUser?.id,
      isGameMaster,
      participants: selectableParticipants,
      projectionVisibleParticipants: projection.visibleParticipants,
    });
  }, [currentUser?.id, isGameMaster, projection, selectableParticipants]);

  useEffect(() => {
    if (accessibleParticipants.length === 0 || !rememberedParticipantSelection.hydrated) {
      setSelectedParticipantId("");
      return;
    }

    const projectionControlledId = projection?.controlledParticipantId;
    const explicitParticipantId = participantId;
    const rememberedParticipantId = rememberedParticipantSelection.value;
    const explicitAccessibleParticipant = accessibleParticipants.find(
      (participant) => participant.id === explicitParticipantId,
    );
    const preferredId =
      explicitAccessibleParticipant?.id ??
      accessibleParticipants.find((participant) => participant.id === rememberedParticipantId)
        ?.id ??
      accessibleParticipants.find((participant) => participant.id === projectionControlledId)?.id ??
      accessibleParticipants[0]?.id;

    setSelectedParticipantId((current) =>
      explicitAccessibleParticipant
        ? explicitAccessibleParticipant.id
        : accessibleParticipants.some((participant) => participant.id === current)
          ? current
          : (preferredId ?? ""),
    );
  }, [
    accessibleParticipants,
    participantId,
    projection,
    rememberedParticipantSelection.hydrated,
    rememberedParticipantSelection.value,
  ]);

  useEffect(() => {
    if (!rememberedParticipantSelection.hydrated) {
      return;
    }

    rememberedParticipantSelection.setValue(selectedParticipantId || undefined);
  }, [rememberedParticipantSelection, selectedParticipantId]);

  useEffect(() => {
    if (!showParticipantSelector) {
      return;
    }

    const currentParticipantId = searchParams.get("participantId");
    const nextParams = new URLSearchParams(searchParamString);

    if (selectedParticipantId) {
      nextParams.set("participantId", selectedParticipantId);
    } else {
      nextParams.delete("participantId");
    }

    const currentHref = searchParamString ? `${pathname}?${searchParamString}` : pathname;
    const nextQuery = nextParams.toString();
    const nextHref = nextQuery ? `${pathname}?${nextQuery}` : pathname;

    if (currentParticipantId !== selectedParticipantId && currentHref !== nextHref) {
      router.replace(nextHref);
    }
  }, [
    pathname,
    router,
    searchParams,
    searchParamString,
    selectedParticipantId,
    showParticipantSelector,
  ]);

  useEffect(() => {
    setActionRollResult(null);
    setCombatHistory(undefined);
    setHistoryInspection(undefined);
  }, [selectedParticipantId]);

  const selectedParticipant = useMemo(
    () =>
      accessibleParticipants.find((participant) => participant.id === selectedParticipantId) ??
      null,
    [accessibleParticipants, selectedParticipantId],
  );
  const encounterScenarioParticipantIds = useMemo(
    () => getEncounterScenarioParticipantIds(encounterSession?.participants),
    [encounterSession?.participants],
  );
  const combatRoundState = useMemo(
    () => (encounterSession ? initializeCombatRoundState({ encounter: encounterSession }) : null),
    [encounterSession],
  );
  const declarationRoundNumber =
    combatRoundState?.roundNumber ?? encounterSession?.currentRound ?? undefined;
  const selectedEncounterParticipant = useMemo(
    () =>
      encounterSession?.participants.find(
        (participant) =>
          participant.scenarioParticipantId === selectedParticipant?.id ||
          participant.id === selectedParticipant?.id ||
          (participant.characterId && participant.characterId === selectedParticipant?.characterId),
      ),
    [encounterSession?.participants, selectedParticipant],
  );
  const selectedRoundParticipant = useMemo(
    () =>
      selectedEncounterParticipant && combatRoundState
        ? combatRoundState.participants.find(
            (participant) => participant.participantId === selectedEncounterParticipant.id,
          )
        : undefined,
    [combatRoundState, selectedEncounterParticipant],
  );
  const playerCombatTrackerModel = useMemo(
    () =>
      combatHistory
        ? buildProjectedCombatTrackerModel({
            history: combatHistory,
            selected: historyInspection,
          })
        : undefined,
    [combatHistory, historyInspection],
  );
  const inspectedHistoryRound = useMemo(
    () =>
      historyInspection && combatHistory
        ? [...combatHistory.archivedRounds, combatHistory.activeRound].find(
            (round) => round.roundNumber === historyInspection.roundNumber,
          )
        : undefined,
    [combatHistory, historyInspection],
  );
  const inspectedHistorySnapshot = useMemo(
    () =>
      historyInspection && inspectedHistoryRound
        ? resolveProjectedCombatHistoryPanelSnapshot({
            participantId: historyInspection.participantId,
            roundNumber: historyInspection.roundNumber,
            selectedStep: historyInspection.step,
            snapshots: inspectedHistoryRound.snapshots,
          })
        : undefined,
    [historyInspection, inspectedHistoryRound],
  );
  const inspectedHistoryEvents = useMemo(
    () =>
      historyInspection && combatHistory
        ? getProjectedCombatHistoryCellEvents({
            history: combatHistory,
            selection: historyInspection,
          })
        : [],
    [combatHistory, historyInspection],
  );
  const roundParticipantLabelsById = useMemo(
    () =>
      Object.fromEntries(
        (combatRoundState?.participants ?? []).map((participant) => [
          participant.participantId,
          participant.label,
        ]),
      ),
    [combatRoundState?.participants],
  );
  const selectedCombatExperienceTrigger =
    combatRoundState && selectedRoundParticipant
      ? getCombatRoundRequiredCombatExperienceTrigger({
          participantId: selectedRoundParticipant.participantId,
          state: combatRoundState,
          visibility: encounterSession?.roleplayState?.visibility,
        })
      : undefined;
  const selectedCombatExperienceRequired = Boolean(selectedCombatExperienceTrigger);
  const selectedCombatExperienceResult = selectedRoundParticipant?.combatExperience;
  const selectedCombatExperienceWindowOpen = combatRoundState
    ? selectedCombatExperienceTrigger === "combat_start"
      ? isCombatRoundCombatExperienceWindowOpen(combatRoundState)
      : selectedCombatExperienceRequired
    : false;
  const selectedCombatExperienceDifficulty = combatRoundState
    ? getCombatRoundCombatExperienceDifficulty(combatRoundState)
    : 26;
  const selectedDeclarationStepStatus =
    selectedRoundParticipant?.stepStatuses.select_actions ?? "pending";
  const selectedRoundDeclaration = hasCombatRoundDeclarationAction(
    selectedRoundParticipant?.declaration,
  )
    ? selectedRoundParticipant.declaration
    : undefined;
  const selectedCombatDeclarationDraftKey = buildPlayerCombatDeclarationDraftKey({
    currentStep: combatRoundState?.currentStep,
    declaration: selectedRoundDeclaration,
    encounterId,
    participantId: selectedParticipant?.id,
    roundNumber: declarationRoundNumber,
    stepStatus: selectedDeclarationStepStatus,
  });
  const selectedParticipantStoredDeclarationThisRound = Boolean(
    selectedRoundDeclaration ??
    (declarationRoundNumber &&
      selectedParticipant?.state.combat.lastDeclaredActionId &&
      selectedParticipant.state.combat.lastDeclaredEncounterId === encounterId &&
      selectedParticipant.state.combat.lastDeclaredRoundNumber === declarationRoundNumber),
  );
  const selectedStoredDeclarationTargetValidation = selectedRoundDeclaration
    ? validateCombatDeclarationTargets({
        actionId: selectedRoundDeclaration.actionId,
        phaseContexts: selectedRoundDeclaration.phaseContexts,
        secondaryActionId: selectedRoundDeclaration.secondaryActionId,
      })
    : declarationRoundNumber &&
        selectedParticipant?.state.combat.lastDeclaredActionId &&
        selectedParticipant.state.combat.lastDeclaredEncounterId === encounterId &&
        selectedParticipant.state.combat.lastDeclaredRoundNumber === declarationRoundNumber
      ? validateCombatDeclarationTargets({
          actionId: selectedParticipant.state.combat.lastDeclaredActionId,
          secondaryActionId: selectedParticipant.state.combat.lastDeclaredSecondaryActionId,
        })
      : undefined;
  const selectedStoredDeclarationComplete = Boolean(
    selectedParticipantStoredDeclarationThisRound &&
    selectedStoredDeclarationTargetValidation?.valid,
  );
  const selectedProgressionTasks = getCombatProgressionPresentationTasks(
    combatHistory?.progression,
  ).filter(
    (task) =>
      task.owner?.kind === "combatant" &&
      task.owner.participantId === selectedRoundParticipant?.participantId &&
      task.contributesToProgression,
  );
  const selectedDeclarationProgressionTask = selectedProgressionTasks.find(
    (task) => task.kind === "submit_declaration",
  );
  const declarationStepOpen = combatHistory?.progression
    ? Boolean(selectedDeclarationProgressionTask) ||
      (isGameMaster &&
        combatHistory.progression.taskVisibility === "available" &&
        combatHistory.progression.boundary.kind === "declaration")
    : !combatRoundState || combatRoundState.currentStep === "select_actions";

  useEffect(() => {
    if (!selectedParticipant) {
      setSelectedActionId("");
      setSelectedSecondaryActionId("");
      setSelectedMovementId("hold");
      setSelectedMovementIntent(createDefaultMovementIntent());
      setAdditionalActionNotes("");
      setCombatContextDraft(createEmptyPlayerEncounterCombatContext());
      setPhaseCombatContextDrafts({
        phase1: createEmptyPlayerEncounterCombatContext(),
        phase2: createEmptyPlayerEncounterCombatContext(),
      });
      setCombatDeclarationDraftDirty(false);
      setCombatDeclarationDraftKey(selectedCombatDeclarationDraftKey);
      return;
    }

    if (
      combatDeclarationDraftDirty &&
      combatDeclarationDraftKey === selectedCombatDeclarationDraftKey &&
      declarationStepOpen
    ) {
      return;
    }

    const nextDraft = buildPlayerCombatDeclarationDraft({
      declaration: selectedRoundDeclaration,
      encounterId,
      participant: selectedParticipant,
      roundNumber: declarationRoundNumber,
    });

    setSelectedActionId(nextDraft.actionId);
    setSelectedSecondaryActionId(nextDraft.secondaryActionId);
    setSelectedMovementId(nextDraft.movementId);
    setSelectedMovementIntent(nextDraft.movementIntent);
    setAdditionalActionNotes(nextDraft.additionalActionNotes);
    setFeintMethod(selectedRoundDeclaration?.feint?.method ?? "movement");
    setCombatContextDraft(nextDraft.combatContext);
    setPhaseCombatContextDrafts(nextDraft.phaseContexts);
    setCombatDeclarationDraftDirty(false);
    setCombatDeclarationDraftKey(selectedCombatDeclarationDraftKey);
  }, [
    combatDeclarationDraftDirty,
    combatDeclarationDraftKey,
    declarationStepOpen,
    selectedCombatDeclarationDraftKey,
    selectedParticipant,
    selectedRoundDeclaration,
  ]);

  useEffect(() => {
    const participantId = selectedParticipant?.id;
    const selectedCharacterId = selectedParticipant?.characterId;

    if (!selectedParticipant || !participantId || !selectedCharacterId) {
      return;
    }

    const stableParticipantId: string = participantId;
    const characterId: string = selectedCharacterId;

    if (resolvedCharacterStateByParticipantId[stableParticipantId]) {
      return;
    }

    let cancelled = false;

    async function hydrateSelectedCharacterParticipant() {
      try {
        const [serverRecord, equipmentState] = await Promise.all([
          loadServerCharacterById(characterId),
          loadCharacterEquipmentState(characterId),
        ]);

        if (cancelled) {
          return;
        }

        setResolvedCharacterStateByParticipantId((current) => ({
          ...current,
          [stableParticipantId]: {
            equipmentState,
            serverRecord,
          },
        }));
      } catch (caughtError) {
        if (cancelled) {
          return;
        }

        setError(
          caughtError instanceof Error
            ? caughtError.message
            : "Unable to load the selected participant character snapshot.",
        );
      }
    }

    void hydrateSelectedCharacterParticipant();

    return () => {
      cancelled = true;
    };
  }, [resolvedCharacterStateByParticipantId, selectedParticipant]);

  const displayedParticipant = useMemo(() => {
    if (!selectedParticipant) {
      return projection?.controlledParticipant;
    }

    const resolvedCharacterState = resolvedCharacterStateByParticipantId[selectedParticipant.id];

    return {
      build: resolvedCharacterState?.serverRecord.build ?? selectedParticipant.snapshot.build,
      characterId: selectedParticipant.characterId,
      conditionCount: selectedParticipant.state.conditions.length,
      currentHp: selectedParticipant.state.health.currentHp,
      displayName: selectedParticipant.snapshot.displayName,
      equipmentState:
        resolvedCharacterState?.equipmentState ?? selectedParticipant.snapshot.equipmentState,
      factionId: selectedParticipant.factionId,
      id: selectedParticipant.id,
      maxHp: selectedParticipant.state.health.maxHp,
      role: selectedParticipant.role,
      sourceType: selectedParticipant.sourceType,
    };
  }, [projection, resolvedCharacterStateByParticipantId, selectedParticipant]);

  const controlledBuild = useMemo(() => {
    const result = characterBuildSchema.safeParse(displayedParticipant?.build);
    return result.success ? result.data : null;
  }, [displayedParticipant]);
  const selectedSheetSummary = useMemo(
    () =>
      content && controlledBuild
        ? buildCharacterSheetSummary({
            build: controlledBuild,
            content,
          })
        : undefined,
    [content, controlledBuild],
  );
  const selectedCombatExperienceSkillLookup = useMemo(
    () =>
      selectedParticipant
        ? getParticipantCombatExperienceSkillTotalLookup({
            ...selectedParticipant,
            sheetSummary: selectedSheetSummary,
          })
        : { skillTotal: 0 },
    [selectedParticipant, selectedSheetSummary],
  );
  const selectedCombatExperienceSkillTotal = selectedCombatExperienceSkillLookup.skillTotal;
  const selectedCombatExperienceNoRollAvailable =
    selectedCombatExperienceRequired &&
    selectedCombatExperienceWindowOpen &&
    selectedCombatExperienceSkillTotal >= selectedCombatExperienceDifficulty;
  const selectedDistanceControlProposal = useMemo(() => {
    const participantId = selectedRoundParticipant?.participantId;
    const proposals = combatRoundState?.roundEndReview?.proposedDistances ?? [];

    if (!participantId || combatRoundState?.currentStep !== "round_summary") {
      return undefined;
    }

    const proposal = proposals.find(
      (candidate) =>
        candidate.accepted &&
        candidate.requiresContest &&
        (candidate.participantAId === participantId || candidate.participantBId === participantId),
    );

    if (!proposal) {
      return undefined;
    }

    const isParticipantA = proposal.participantAId === participantId;
    const ownParticipantId = isParticipantA ? proposal.participantAId : proposal.participantBId;
    const opponentParticipantId = isParticipantA
      ? proposal.participantBId
      : proposal.participantAId;
    const ownSide = isParticipantA ? proposal.participantA : proposal.participantB;
    const opponentSide = isParticipantA ? proposal.participantB : proposal.participantA;

    return {
      opponentLabel: roundParticipantLabelsById[opponentParticipantId] ?? opponentParticipantId,
      opponentParticipantId,
      opponentSide,
      ownLabel: roundParticipantLabelsById[ownParticipantId] ?? ownParticipantId,
      ownParticipantId,
      ownSide,
      proposal,
    };
  }, [
    combatRoundState?.roundEndReview?.proposedDistances,
    combatRoundState?.currentStep,
    roundParticipantLabelsById,
    selectedRoundParticipant?.participantId,
  ]);
  const selectedDistanceControlRollPending =
    selectedDistanceControlProposal?.ownSide.status === "pending";
  const selectedDistanceControlActionAvailable = Boolean(
    selectedDistanceControlRollPending &&
    selectedDistanceControlProposal &&
    selectedParticipant &&
    encounterId &&
    !readOnlyInspection,
  );
  const selectedRoundEndReview =
    combatRoundState?.currentStep === "round_summary" && selectedRoundParticipant
      ? combatRoundState.roundEndReview?.participantReviews[selectedRoundParticipant.participantId]
      : undefined;
  const selectedPendingHealthRoll =
    combatRoundState?.currentStep === "round_summary" && selectedRoundParticipant
      ? getCombatRoundEndHealthCheckPendingRolls({
          participantId: selectedRoundParticipant.participantId,
          state: combatRoundState,
        })[0]
      : undefined;
  const selectedVisibleHealthRoll =
    selectedPendingHealthRoll ??
    selectedRoundEndReview?.proposedHealthRolls.find(
      (proposal) => proposal.accepted && proposal.status === "rolled" && proposal.result,
    );
  const selectedHealthRollDamageProposal =
    selectedVisibleHealthRoll?.damageProposalId && selectedRoundEndReview
      ? selectedRoundEndReview.proposedDamage.find(
          (proposal) => proposal.id === selectedVisibleHealthRoll.damageProposalId,
        )
      : undefined;
  const selectedHealthCheckActionAvailable = Boolean(
    selectedPendingHealthRoll && selectedParticipant && encounterId && !readOnlyInspection,
  );

  const controlledEquipmentState = useMemo(() => {
    return resolveScenarioCombatEquipmentState({
      resolvedEquipmentState: displayedParticipant?.equipmentState,
      scenarioEquipmentState: selectedParticipant?.snapshot.equipmentState,
    });
  }, [displayedParticipant?.equipmentState, selectedParticipant?.snapshot.equipmentState]);
  const controlledEquipmentCharacterId = useMemo(
    () =>
      resolveCombatEquipmentCharacterId({
        characterId: selectedParticipant?.characterId,
        state: controlledEquipmentState,
      }) ?? "",
    [controlledEquipmentState, selectedParticipant?.characterId],
  );
  const controlledEquipmentStatus = useMemo(
    () =>
      getScenarioCombatEquipmentStatus({
        characterId: selectedParticipant?.characterId,
        resolvedEquipmentState: displayedParticipant?.equipmentState,
        scenarioEquipmentState: selectedParticipant?.snapshot.equipmentState,
      }),
    [displayedParticipant?.equipmentState, selectedParticipant],
  );
  const controlledEquipmentDiagnostic = formatScenarioCombatEquipmentDiagnostic({
    isGameMaster,
    participantName: selectedParticipant?.snapshot.displayName,
    status: controlledEquipmentStatus,
  });

  const currentCombatStep = selectedProgressionTasks[0]
    ? getCombatRoundStepForCursorStep(selectedProgressionTasks[0].trackerFacet.step)
    : (combatRoundState?.currentStep ?? "select_actions");
  const projectedRollTask = selectedProgressionTasks.find((task) =>
    ["attack", "critical", "hit_location", "parry"].includes(task.kind),
  );
  const domainCurrentRollAction =
    combatRoundState && selectedRoundParticipant
      ? getPlayerCombatCurrentRollAction({
          participantId: selectedRoundParticipant.participantId,
          state: combatRoundState,
        })
      : undefined;
  const currentRollAction =
    domainCurrentRollAction && projectedRollTask?.kind === domainCurrentRollAction.kind
      ? domainCurrentRollAction
      : undefined;
  const projectedFeintTask = selectedProgressionTasks.find((task) => task.kind === "resolve_feint");
  const projectedAdjustDistanceTask = selectedProgressionTasks.find(
    (task) => task.kind === "resolve_adjust_distance",
  );
  const selectedFeintProposal = projectedFeintTask
    ? combatRoundState?.feintProposals.find((proposal) => {
        if (
          !selectedRoundParticipant ||
          proposal.status !== "awaiting_rolls" ||
          combatRoundState.phaseResolutionCursor?.phase !== "phase1" ||
          combatRoundState.phaseResolutionCursor.substep !== "feint" ||
          combatRoundState.phaseResolutionCursor.participantId !== proposal.attackerParticipantId
        ) {
          return false;
        }
        const expectedParticipantId = proposal.attackerRollRecorded
          ? proposal.defenderParticipantId
          : proposal.attackerParticipantId;
        return expectedParticipantId === selectedRoundParticipant.participantId;
      })
    : undefined;
  const selectedAdjustDistanceProposal = projectedAdjustDistanceTask
    ? combatRoundState?.adjustDistanceProposals.find((proposal) => {
        if (
          !selectedRoundParticipant ||
          combatRoundState.phaseResolutionCursor?.phase !== "phase1" ||
          combatRoundState.phaseResolutionCursor.substep !== "adjust_distance" ||
          combatRoundState.phaseResolutionCursor.participantId !== proposal.attackerParticipantId
        )
          return false;
        const expectedParticipantId =
          proposal.status === "awaiting_defender_response"
            ? proposal.defenderParticipantId
            : proposal.status === "awaiting_rolls"
              ? proposal.attackerRollRecorded
                ? proposal.defenderParticipantId
                : proposal.attackerParticipantId
              : undefined;
        return expectedParticipantId === selectedRoundParticipant.participantId;
      })
    : undefined;
  // The task selector above intentionally follows the canonical next roller.
  // The result panel uses the persisted proposal separately so a roller keeps
  // seeing their own Dodge result while the opponent's task is pending.
  const selectedAdjustDistanceDisplayProposal = combatRoundState?.adjustDistanceProposals.find(
    (proposal) =>
      selectedRoundParticipant &&
      proposal.roundNumber === combatRoundState.roundNumber &&
      (proposal.attackerParticipantId === selectedRoundParticipant.participantId ||
        proposal.defenderParticipantId === selectedRoundParticipant.participantId) &&
      (proposal.attackerParticipantId === selectedRoundParticipant.participantId
        ? proposal.attackerRollRecorded && Boolean(proposal.attackerRoll)
        : proposal.defenderRollRecorded && Boolean(proposal.defenderRoll)),
  );
  const selectedAdjustDistanceOwnRoll = selectedAdjustDistanceDisplayProposal
    ? selectedAdjustDistanceDisplayProposal.attackerParticipantId ===
      selectedRoundParticipant?.participantId
      ? selectedAdjustDistanceDisplayProposal.attackerRoll
      : selectedAdjustDistanceDisplayProposal.defenderRoll
    : undefined;
  const selectedAdjustDistanceOpponentRoll = selectedAdjustDistanceDisplayProposal
    ? selectedAdjustDistanceDisplayProposal.attackerParticipantId ===
      selectedRoundParticipant?.participantId
      ? selectedAdjustDistanceDisplayProposal.defenderRoll
      : selectedAdjustDistanceDisplayProposal.attackerRoll
    : undefined;
  const selectedAdjustDistanceRollOutcome = selectedAdjustDistanceOwnRoll
    ? selectedAdjustDistanceOpponentRoll
      ? selectedAdjustDistanceDisplayProposal?.status === "committed"
        ? `Distance adjustment ${selectedAdjustDistanceDisplayProposal.review?.acceptedOutcome ?? "resolved"}.`
        : "Distance proposal awaiting GM review."
      : "Awaiting opponent roll."
    : undefined;
  const selectedAdjustDistanceResultPanel = selectedAdjustDistanceOwnRoll
    ? {
        interpretedResult:
          selectedRoundParticipant?.participantId ===
          selectedAdjustDistanceDisplayProposal?.attackerParticipantId
            ? "Dodge roll to adjust distance"
            : "Dodge roll to resist the distance adjustment",
        rankLabel: "Dodge roll",
        sections: [
          {
            calculationLines: buildConciseDodgeCalculationRows({
              calculation: {
                dodgeSkillTotal: selectedAdjustDistanceOwnRoll.dodgeSkillTotal,
                finalTotal: selectedAdjustDistanceOwnRoll.finalTotal,
                generalFatigueModifier: selectedAdjustDistanceOwnRoll.generalFatigueModifier,
                openEndedD10s: selectedAdjustDistanceOwnRoll.openEndedD10s,
                rollD20: selectedAdjustDistanceOwnRoll.rollD20,
                rollTotal: selectedAdjustDistanceOwnRoll.rollTotal,
                situationalAdjustment: selectedAdjustDistanceOwnRoll.situationalAdjustment,
              },
              eventId: `${selectedAdjustDistanceDisplayProposal?.id ?? "adjust-distance"}:own-roll`,
              outcome: selectedAdjustDistanceRollOutcome,
            }).map((row) => row.text),
            resultLine: selectedAdjustDistanceRollOutcome,
            title: "Dodge",
          },
        ],
      }
    : null;
  const currentModifierPhase = getPlayerCombatModifierDisplayPhase({
    actionId: selectedActionId,
    step: currentCombatStep,
  });
  const projectedCombatContextDraft = useMemo(
    () =>
      projectCombatActionGeneratedModifiers({
        actionId: selectedActionId || undefined,
        combatContext: combatContextDraft,
        encounterParticipant: selectedRoundParticipant
          ? encounterSession?.participants.find((participant) =>
              getCombatDistanceParticipantAliases(selectedRoundParticipant).some((alias) =>
                getCombatDistanceParticipantAliases(participant).includes(alias),
              ),
            )
          : undefined,
        phaseContexts: phaseCombatContextDrafts,
        movementIntent: selectedMovementIntent,
        resolvedEquipmentState: controlledEquipmentState ?? undefined,
        roundState: combatRoundState ?? undefined,
        scenarioParticipant: selectedParticipant ?? undefined,
        secondaryActionId: selectedSecondaryActionId || undefined,
      }),
    [
      combatContextDraft,
      combatRoundState,
      controlledEquipmentState,
      encounterSession?.participants,
      phaseCombatContextDrafts,
      selectedMovementIntent,
      selectedActionId,
      selectedParticipant,
      selectedRoundParticipant,
      selectedSecondaryActionId,
    ],
  );
  const liveCombatModifiers = useMemo(
    () =>
      buildEncounterLiveCombatModifierSummary({
        combatContext: sanitizePlayerCombatModifierContext(projectedCombatContextDraft),
        combatEffects: selectedParticipant?.state.combatEffects,
        phaseKey: currentModifierPhase,
      }),
    [currentModifierPhase, projectedCombatContextDraft, selectedParticipant?.state.combatEffects],
  );
  const modifierRows = useMemo(
    () =>
      buildPlayerCombatModifierRows({
        combatContext: projectedCombatContextDraft,
        combatEffects: selectedParticipant?.state.combatEffects,
        currentRound: combatRoundState?.roundNumber,
        encounterId: scenarioId,
        liveModifiers: liveCombatModifiers,
        ownerParticipantId: selectedParticipant?.id,
        phaseKey: currentModifierPhase,
        visibleAtStep: currentCombatStep,
      }),
    [
      currentCombatStep,
      currentModifierPhase,
      liveCombatModifiers,
      projectedCombatContextDraft,
      selectedActionId,
      selectedParticipant?.state.combatEffects,
    ],
  );

  const loadoutFieldValueMap = useMemo(
    () =>
      new Map<string, string>(
        buildEquipmentLoadoutModuleModel({
          characterContext:
            content && controlledBuild
              ? {
                  content,
                  record: {
                    build: controlledBuild,
                  },
                }
              : null,
          characterId: controlledEquipmentCharacterId,
          state: controlledEquipmentState,
          throwingWeaponItemId: null,
        }).fields.map((field) => [field.id, field.value]),
      ),
    [content, controlledBuild, controlledEquipmentState, displayedParticipant],
  );

  const parryLegality = useMemo(
    () =>
      evaluatePlayerEncounterParryLegality({
        actionId: selectedActionId,
        attackSource: selectedActionId === "attack_parry" ? "mainHand" : undefined,
        hasOffHandWeapon: Boolean(loadoutFieldValueMap.get("secondary")),
        hasShield: Boolean(loadoutFieldValueMap.get("shield")),
        hasSelectedOpponent: true,
        incomingAttackSide: phaseCombatContextDrafts.phase1.incomingAttackSide,
        parrySource: phaseCombatContextDrafts.phase1.parrySource,
      }),
    [
      loadoutFieldValueMap,
      phaseCombatContextDrafts.phase1.incomingAttackSide,
      phaseCombatContextDrafts.phase1.parrySource,
      selectedActionId,
    ],
  );

  const combatAllocationInputs = useMemo<CombatAllocationState>(
    () => ({
      defensePosture:
        selectedActionId === "attack_parry" && parryLegality.status === "legal" ? "parry" : "none",
      parry: {
        allocatedOb: null,
        source:
          parryLegality.resolvedParrySource === "shield"
            ? "shield"
            : parryLegality.resolvedParrySource === "offHand"
              ? "secondary"
              : parryLegality.resolvedParrySource === "mainHand"
                ? "primary"
                : "none",
      },
      situationalModifiers: {
        attack: 0,
        defense: 0,
        movement: 0,
        perception: 0,
      },
    }),
    [parryLegality, selectedActionId],
  );

  const loadoutModel = useMemo(
    () =>
      buildEquipmentLoadoutModuleModel({
        characterContext:
          content && controlledBuild
            ? {
                content,
                record: {
                  build: controlledBuild,
                },
              }
            : null,
        characterId: controlledEquipmentCharacterId,
        combatAllocationInputs,
        liveCombatModifiers,
        state: controlledEquipmentState,
        throwingWeaponItemId: null,
      }),
    [
      combatAllocationInputs,
      content,
      controlledBuild,
      controlledEquipmentState,
      displayedParticipant,
      liveCombatModifiers,
    ],
  );

  function markCombatDeclarationDraftDirty() {
    setCombatDeclarationDraftDirty(true);
    setCombatDeclarationDraftKey(selectedCombatDeclarationDraftKey);
  }

  async function saveCombatContext() {
    if (readOnlyInspection) {
      return;
    }

    if (!selectedParticipant) {
      return;
    }

    const feintTargetResolution =
      selectedActionId === "feint_attack"
        ? resolveCombatFeintDeclarationRequestTarget({
            encounterParticipants: encounterSession?.participants ?? [],
            phaseContexts: phaseCombatContextDrafts,
          })
        : undefined;
    if (feintTargetResolution && !feintTargetResolution.ok) {
      setError(feintTargetResolution.message);
      return;
    }
    let requestPhaseContexts = feintTargetResolution?.ok
      ? feintTargetResolution.phaseContexts
      : phaseCombatContextDrafts;
    if (selectedActionId === "adjust_range_attack") {
      const targetParticipantId =
        requestPhaseContexts.phase1?.targetParticipantId ??
        requestPhaseContexts.phase2?.targetParticipantId;
      if (!targetParticipantId) {
        setError("Select an opponent for Adjust Distance-Attack.");
        return;
      }
      requestPhaseContexts = {
        phase1: {
          ...phaseCombatContextDrafts.phase1,
          ...requestPhaseContexts.phase1,
          targetParticipantId,
        },
        phase2: {
          ...phaseCombatContextDrafts.phase2,
          ...requestPhaseContexts.phase2,
          targetParticipantId,
        },
      };
    }
    const targetValidation = validateCombatDeclarationTargets({
      actionId: selectedActionId || undefined,
      phaseContexts: requestPhaseContexts,
      secondaryActionId: selectedSecondaryActionId || undefined,
    });

    if (!targetValidation.valid) {
      setError(targetValidation.message ?? "Select a target for each attack phase.");
      return;
    }

    setSavingCombatContext(true);

    try {
      if (!encounterId) {
        throw new Error("Select an encounter before declaring a combat action.");
      }

      const { encounter, participant } = await submitCombatDeclarationOnServer({
        actionId: selectedActionId || undefined,
        adjustDistance:
          selectedActionId === "adjust_range_attack" &&
          requestPhaseContexts.phase1?.targetParticipantId
            ? {
                requestedDistance:
                  selectedMovementIntent.distancePreferences.find(
                    (preference) =>
                      preference.targetParticipantId ===
                      requestPhaseContexts.phase1?.targetParticipantId,
                  )?.desiredDistance ??
                  distancePreferenceOptions.find(
                    (option) => option.id === requestPhaseContexts.phase1?.targetParticipantId,
                  )?.defaultDistance ??
                  2,
                targetParticipantId: requestPhaseContexts.phase1.targetParticipantId,
              }
            : undefined,
        additionalActionNotes,
        combatContext: projectedCombatContextDraft,
        encounterId,
        feint:
          selectedActionId === "feint_attack" && feintTargetResolution?.ok
            ? {
                attackerSkillId:
                  feintMethod === "movement" ? resolvedFeintAttackerSkill?.id : undefined,
                method: feintMethod,
                targetParticipantId: feintTargetResolution.targetParticipantId,
              }
            : undefined,
        movementId: selectedMovementId || undefined,
        movementIntent: selectedMovementIntent,
        phaseContexts: requestPhaseContexts,
        phaseAttackSources: {
          phase1:
            selectedActionId === "double_attack" ||
            (selectedActionId === "feint_attack" && feintMethod === "weapon")
              ? buildCombatAttackSourceRef({
                  phaseKey: "phase1",
                  reference: phaseCombatLoadoutSummaries.phase1.reference,
                  unarmedTemplateId: "virtual-weapon-template-punch",
                })
              : undefined,
          phase2:
            selectedActionId === "double_attack" ||
            selectedActionId === "feint_attack" ||
            selectedActionId === "adjust_range_attack"
              ? buildCombatAttackSourceRef({
                  phaseKey: "phase2",
                  reference: phaseCombatLoadoutSummaries.phase2.reference,
                  unarmedTemplateId: "virtual-weapon-template-kick",
                })
              : undefined,
        },
        phaseWeaponNames: {
          phase1: phaseCombatLoadoutSummaries.phase1.attackStats?.weaponName,
          phase2: phaseCombatLoadoutSummaries.phase2.attackStats?.weaponName,
        },
        scenarioParticipantId: selectedParticipant.id,
        secondaryActionId: selectedSecondaryActionId || undefined,
      });

      setSelectableParticipants((current) =>
        current.map((entry) => (entry.id === participant.id ? participant : entry)),
      );
      acceptEncounterSession(encounter);
      setCombatDeclarationDraftDirty(false);
      setError(undefined);
    } catch (caughtError) {
      setError(
        caughtError instanceof Error ? caughtError.message : "Unable to save combat context.",
      );
    } finally {
      setSavingCombatContext(false);
    }
  }

  async function rollFeint() {
    if (readOnlyInspection || !selectedParticipant || !encounterId || !selectedFeintProposal) {
      return;
    }
    setSavingCombatContext(true);
    try {
      const { encounter } = await rollCombatFeintOnServer({
        encounterId,
        proposalId: selectedFeintProposal.id,
        scenarioParticipantId: selectedParticipant.id,
      });
      acceptEncounterSession(encounter);
      setError(undefined);
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Unable to roll the feint.");
    } finally {
      setSavingCombatContext(false);
    }
  }

  async function advanceAdjustDistance() {
    if (
      readOnlyInspection ||
      !selectedParticipant ||
      !encounterId ||
      !selectedAdjustDistanceProposal
    )
      return;
    setSavingCombatContext(true);
    try {
      const encounter =
        selectedAdjustDistanceProposal.status === "awaiting_defender_response"
          ? await respondCombatAdjustDistanceOnServer({
              encounterId,
              proposalId: selectedAdjustDistanceProposal.id,
              response: adjustDistanceResponse,
              scenarioParticipantId: selectedParticipant.id,
            })
          : await rollCombatAdjustDistanceOnServer({
              encounterId,
              proposalId: selectedAdjustDistanceProposal.id,
              scenarioParticipantId: selectedParticipant.id,
            });
      acceptEncounterSession(encounter);
      setError(undefined);
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "Unable to advance the distance adjustment.",
      );
    } finally {
      setSavingCombatContext(false);
    }
  }

  async function rollInitiative() {
    if (readOnlyInspection) {
      return;
    }

    if (!selectedParticipant || !encounterId) {
      return;
    }

    setSavingCombatContext(true);

    try {
      const { encounter } = await rollCombatInitiativeOnServer({
        encounterId,
        initiativeBase: initiativeCalculation.baseInitiative,
        initiativeModifierAdjustment: initiativeCalculation.modifierAdjustment,
        scenarioParticipantId: selectedParticipant.id,
      });

      acceptEncounterSession(encounter);
      setError(undefined);
    } catch (caughtError) {
      setError(
        caughtError instanceof Error ? caughtError.message : "Unable to roll combat initiative.",
      );
    } finally {
      setSavingCombatContext(false);
    }
  }

  async function rollCombatExperience() {
    if (readOnlyInspection) {
      return;
    }

    if (!selectedParticipant || !encounterId) {
      return;
    }

    setSavingCombatContext(true);

    try {
      const { encounter, participant } = await rollCombatExperienceOnServer({
        encounterId,
        scenarioParticipantId: selectedParticipant.id,
      });

      setSelectableParticipants((current) =>
        current.map((entry) => (entry.id === participant.id ? participant : entry)),
      );
      acceptEncounterSession(encounter);
      setError(undefined);
    } catch (caughtError) {
      setError(
        caughtError instanceof Error ? caughtError.message : "Unable to roll Combat Experience.",
      );
    } finally {
      setSavingCombatContext(false);
    }
  }

  async function rollDistanceControl() {
    if (readOnlyInspection || !selectedParticipant || !encounterId) {
      return;
    }

    const distanceProposalId = selectedDistanceControlProposal?.proposal.id;

    if (!distanceProposalId) {
      return;
    }

    setSavingCombatContext(true);

    try {
      const { encounter, participant } = await rollRoundEndDistanceControlOnServer({
        distanceProposalId,
        encounterId,
        scenarioParticipantId: selectedParticipant.id,
      });

      setSelectableParticipants((current) =>
        current.map((entry) => (entry.id === participant.id ? participant : entry)),
      );
      acceptEncounterSession(encounter);
      setError(undefined);
    } catch (caughtError) {
      setError(
        caughtError instanceof Error ? caughtError.message : "Unable to roll distance control.",
      );
    } finally {
      setSavingCombatContext(false);
    }
  }

  async function rollHealthCheck() {
    if (readOnlyInspection || !selectedParticipant || !encounterId) {
      return;
    }

    const healthRollId = selectedPendingHealthRoll?.id;

    if (!healthRollId) {
      return;
    }

    setSavingCombatContext(true);

    try {
      const { encounter, participant } = await rollRoundEndHealthCheckOnServer({
        encounterId,
        healthRollId,
        scenarioParticipantId: selectedParticipant.id,
      });

      setSelectableParticipants((current) =>
        current.map((entry) => (entry.id === participant.id ? participant : entry)),
      );
      acceptEncounterSession(encounter);
      setError(undefined);
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "Unable to roll round-end health check.",
      );
    } finally {
      setSavingCombatContext(false);
    }
  }

  async function backOutPhaseAttack() {
    if (readOnlyInspection) {
      return;
    }

    if (!selectedParticipant || !encounterId || !selectedPhaseAttackBackOutOpportunity) {
      return;
    }

    setSavingCombatContext(true);

    try {
      const { encounter, participant } = await backOutPhaseAttackOnServer({
        encounterId,
        phase: selectedPhaseAttackBackOutOpportunity.phase,
        scenarioParticipantId: selectedParticipant.id,
      });

      setSelectableParticipants((current) =>
        current.map((entry) => (entry.id === participant.id ? participant : entry)),
      );
      acceptEncounterSession(encounter);
      setActionRollResult({
        interpretedResult:
          "Back out submitted; GM commit will cancel the attack and soften the phase DB/Parry penalty.",
        phaseLabel:
          selectedPhaseAttackBackOutOpportunity.phase === "phase1" ? "Phase 1" : "Phase 2",
        value: 0,
      });
      setError(undefined);
    } catch (caughtError) {
      setError(
        caughtError instanceof Error ? caughtError.message : "Unable to back out of attack.",
      );
    } finally {
      setSavingCombatContext(false);
    }
  }

  async function continuePhaseAttack() {
    if (readOnlyInspection) {
      return;
    }

    if (!selectedParticipant || !encounterId || !selectedPhaseAttackBackOutOpportunity) {
      return;
    }

    setSavingCombatContext(true);

    try {
      const { encounter, participant } = await continuePhaseAttackOnServer({
        encounterId,
        phase: selectedPhaseAttackBackOutOpportunity.phase,
        scenarioParticipantId: selectedParticipant.id,
      });

      setSelectableParticipants((current) =>
        current.map((entry) => (entry.id === participant.id ? participant : entry)),
      );
      acceptEncounterSession(encounter);
      setActionRollResult({
        interpretedResult: "Continue attack submitted; waiting for GM to commit initiative.",
        phaseLabel:
          selectedPhaseAttackBackOutOpportunity.phase === "phase1" ? "Phase 1" : "Phase 2",
        value: 0,
      });
      setError(undefined);
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Unable to continue attack.");
    } finally {
      setSavingCombatContext(false);
    }
  }

  async function decideDoubleAttackPhase2() {
    if (readOnlyInspection || !selectedParticipant || !encounterId) return;
    setSavingCombatContext(true);
    try {
      const { encounter, participant } = await decideDoubleAttackPhase2OnServer({
        decision: doubleAttackPhase2Decision,
        encounterId,
        scenarioParticipantId: selectedParticipant.id,
      });
      setSelectableParticipants((current) =>
        current.map((entry) => (entry.id === participant.id ? participant : entry)),
      );
      acceptEncounterSession(encounter);
      setError(undefined);
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "Unable to record Double Attack decision.",
      );
    } finally {
      setSavingCombatContext(false);
    }
  }

  async function rollPhaseAttack() {
    if (readOnlyInspection || !selectedParticipant || !encounterId || !currentAttackPhase) {
      return;
    }

    const phaseContext = currentAttackPhaseContext ?? phaseCombatContextDrafts[currentAttackPhase];
    const phaseAttackStats = phaseCombatLoadoutSummaries[currentAttackPhase].attackStats;
    const targetIdentity = resolveCanonicalCombatTargetIdentity({
      encounterParticipants: encounterSession?.participants ?? [],
      targetParticipantId: phaseContext.targetParticipantId,
    });

    if (!phaseAttackStats) {
      setError(
        `No ${currentAttackPhase === "phase1" ? "phase 1" : "phase 2"} attack source available.`,
      );
      return;
    }

    if (!targetIdentity) {
      setError(
        selectedRoundDeclaration?.actionId === "feint_attack" && currentAttackPhase === "phase2"
          ? "The Feint target is no longer in this encounter."
          : "Select an attack target before rolling.",
      );
      return;
    }

    let ob: number;

    try {
      const parsedOb = parsePlayerCombatInteger(phaseAttackStats.ob, "Attack OB");

      if (parsedOb === undefined) {
        setError("Attack OB is not available.");
        return;
      }

      ob = parsedOb;
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Attack OB is not available.");
      return;
    }

    setSavingCombatContext(true);

    try {
      const { encounter, participant } = await rollCombatAttackOnServer({
        actionId: selectedActionId || `${currentAttackPhase}_attack`,
        defenderParticipantId: targetIdentity.encounterParticipantId,
        encounterId,
        ob,
        obSkillRaw: liveCombatModifiers.obSkillRaw,
        phase: currentAttackPhase,
        scenarioParticipantId: selectedParticipant.id,
        weaponCriticalCode: phaseAttackStats.weaponCriticalCode,
        weaponDamageClass: phaseAttackStats.weaponDamageClass,
        weaponName: phaseAttackStats.weaponName,
      });

      if (participant) {
        setSelectableParticipants((current) =>
          current.map((entry) => (entry.id === participant.id ? participant : entry)),
        );
      }

      acceptEncounterSession(encounter);
      setError(undefined);
    } catch (caughtError) {
      setError(
        caughtError instanceof Error ? caughtError.message : "Unable to roll combat attack.",
      );
    } finally {
      setSavingCombatContext(false);
    }
  }

  async function rollCurrentParry() {
    if (
      readOnlyInspection ||
      !selectedParticipant ||
      !encounterId ||
      currentRollAction?.kind !== "parry"
    ) {
      return;
    }

    if (!selectedCurrentResolutionAttackResult) {
      setError("No attack result is available for parry.");
      return;
    }

    if (currentParryBase === undefined) {
      setError("No parry source is available.");
      return;
    }

    setSavingCombatContext(true);

    try {
      const encounter = await rollCombatParryOnServer({
        attackResultId: currentRollAction.attackResultId,
        dbParryRaw: getMergedCombatDbParryModifierTotal({
          combatContext: selectedParticipant.state.combat.combatContext,
          phase: currentResolutionPhase,
        }),
        encounterId,
        parryBase: currentParryBase,
        parrySourceLabel: currentParryDefenseStats?.sourceName,
        scenarioParticipantId: selectedParticipant.id,
        usedMainHand: true,
        usedOffHand: true,
      });

      acceptEncounterSession(encounter);
      setError(undefined);
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Unable to roll combat parry.");
    } finally {
      setSavingCombatContext(false);
    }
  }

  async function rollAttackerPrivilegedCombatDie(kind: "critical" | "hitLocation") {
    if (readOnlyInspection || !selectedParticipant || !encounterId) {
      return;
    }

    const attackResultId = selectedAttackerPrivilegedResolution?.attackResultId;

    if (!attackResultId) {
      return;
    }

    setSavingCombatContext(true);

    try {
      const encounter =
        kind === "hitLocation"
          ? await rollCombatHitLocationOnServer({
              attackResultId,
              encounterId,
              scenarioParticipantId: selectedParticipant.id,
            })
          : await rollCombatCriticalOnServer({
              attackResultId,
              encounterId,
              scenarioParticipantId: selectedParticipant.id,
            });

      acceptEncounterSession(encounter);
      setError(undefined);
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : kind === "hitLocation"
            ? "Unable to roll hit location."
            : "Unable to roll critical.",
      );
    } finally {
      setSavingCombatContext(false);
    }
  }

  const combatLoadoutSummary = useMemo(
    () =>
      buildPlayerCombatLoadoutSummary({
        actionId: selectedActionId,
        allowUnarmedFallback:
          controlledEquipmentStatus.kind === "ready" ||
          controlledEquipmentStatus.kind === "unarmed",
        loadoutModel,
        secondaryActionId: selectedSecondaryActionId,
      }),
    [loadoutModel, selectedActionId, selectedSecondaryActionId],
  );

  const playerPerspectiveVisibleParticipants = useMemo<ScenarioPlayerVisibleParticipant[]>(() => {
    if (!isGameMaster) {
      return projection?.visibleParticipants ?? [];
    }

    return selectableParticipants
      .filter((participant) => participant.isActive)
      .map((participant) => ({
        displayName: participant.snapshot.displayName,
        factionId: participant.factionId,
        id: participant.id,
        isActive: participant.isActive,
        isControlledByPlayer: participant.id === selectedParticipant?.id,
        role: participant.role,
        sourceType: participant.sourceType,
      }));
  }, [
    isGameMaster,
    projection?.visibleParticipants,
    selectableParticipants,
    selectedParticipant?.id,
  ]);
  const targetOptions = useMemo(() => {
    const options = getPlayerEncounterOpponentParticipants({
      allowedParticipantIds: encounterScenarioParticipantIds,
      currentUserId: currentUser?.id,
      isGameMaster: false,
      participants: selectableParticipants,
      projectionVisibleParticipants: playerPerspectiveVisibleParticipants,
      selectedParticipantId: selectedParticipant?.id,
    });
    return buildCanonicalCombatTargetOptions({
      encounterParticipants: encounterSession?.participants ?? [],
      options,
    });
  }, [
    currentUser?.id,
    encounterScenarioParticipantIds,
    playerPerspectiveVisibleParticipants,
    selectableParticipants,
    encounterSession?.participants,
    selectedParticipant?.id,
  ]);
  const normalizedFeintPhaseContexts = useMemo(() => {
    if (selectedActionId !== "feint_attack") return phaseCombatContextDrafts;
    const resolution = resolveCombatFeintDeclarationRequestTarget({
      encounterParticipants: encounterSession?.participants ?? [],
      phaseContexts: phaseCombatContextDrafts,
    });
    return resolution.ok ? resolution.phaseContexts : phaseCombatContextDrafts;
  }, [encounterSession?.participants, phaseCombatContextDrafts, selectedActionId]);
  const phaseCombatLoadoutSummaries = useMemo(() => {
    const buildPhaseSummary = (phaseKey: PlayerCombatPhaseKey) => {
      const phaseLiveCombatModifiers = buildEncounterLiveCombatModifierSummary({
        combatContext: projectedCombatContextDraft,
        combatEffects: selectedParticipant?.state.combatEffects,
        phaseKey,
      });
      const phaseLoadoutModel = buildEquipmentLoadoutModuleModel({
        characterContext:
          content && controlledBuild
            ? {
                content,
                record: {
                  build: controlledBuild,
                },
              }
            : null,
        characterId: controlledEquipmentCharacterId,
        combatAllocationInputs,
        liveCombatModifiers: phaseLiveCombatModifiers,
        state: controlledEquipmentState,
        throwingWeaponItemId: null,
      });
      const basePhaseLoadoutModel = buildEquipmentLoadoutModuleModel({
        characterContext:
          content && controlledBuild
            ? {
                content,
                record: {
                  build: controlledBuild,
                },
              }
            : null,
        characterId: controlledEquipmentCharacterId,
        combatAllocationInputs,
        state: controlledEquipmentState,
        throwingWeaponItemId: null,
      });
      const liveSummary = buildPlayerCombatLoadoutSummary({
        actionId: selectedActionId,
        allowUnarmedFallback:
          controlledEquipmentStatus.kind === "ready" ||
          controlledEquipmentStatus.kind === "unarmed",
        loadoutModel: phaseLoadoutModel,
        phaseKey,
        selectedAttackModeId: phaseCombatContextDrafts[phaseKey].attackModeId,
        secondaryActionId: selectedSecondaryActionId,
      });
      const baseSummary = buildPlayerCombatLoadoutSummary({
        actionId: selectedActionId,
        allowUnarmedFallback:
          controlledEquipmentStatus.kind === "ready" ||
          controlledEquipmentStatus.kind === "unarmed",
        loadoutModel: basePhaseLoadoutModel,
        phaseKey,
        selectedAttackModeId: phaseCombatContextDrafts[phaseKey].attackModeId,
        secondaryActionId: selectedSecondaryActionId,
      });

      return {
        ...liveSummary,
        baseDefenseStats: buildPlayerCombatDefenseStats({
          mainHandParryItemLabel: baseSummary.mainHandParryItemLabel,
          offHandParryItemLabel: baseSummary.offHandParryItemLabel,
          phaseContext: phaseCombatContextDrafts[phaseKey],
          reference: baseSummary.reference,
        }),
      };
    };

    return {
      phase1: buildPhaseSummary("phase1"),
      phase2: buildPhaseSummary("phase2"),
    };
  }, [
    combatAllocationInputs,
    content,
    controlledBuild,
    controlledEquipmentState,
    displayedParticipant?.characterId,
    phaseCombatContextDrafts,
    projectedCombatContextDraft,
    selectedActionId,
    selectedParticipant?.state.combatEffects,
    selectedSecondaryActionId,
  ]);
  const resolvedFeintAttackerSkill =
    feintMethod === "movement"
      ? { id: "dodge", label: "Dodge" }
      : resolveCombatFeintWeaponSkill({
          equipmentState: controlledEquipmentState,
          skills: content?.skills ?? [],
          specializations: content?.specializations ?? [],
          sourceTemplateId: phaseCombatLoadoutSummaries.phase1.reference?.sourceTemplateId,
        });
  const distancePreferenceOptions = useMemo<PlayerCombatDistancePreferenceOption[]>(() => {
    const primaryTargetId =
      phaseCombatContextDrafts.phase1.targetParticipantId ??
      phaseCombatContextDrafts.phase2.targetParticipantId ??
      combatContextDraft.targetParticipantId;
    const primaryTargetPhase =
      selectedActionId === "adjust_range_attack"
        ? "phase2"
        : phaseCombatContextDrafts.phase1.targetParticipantId
          ? "phase1"
          : phaseCombatContextDrafts.phase2.targetParticipantId
            ? "phase2"
            : undefined;
    const defaultDistance =
      primaryTargetId && primaryTargetPhase
        ? getLongestPreferredDistanceForWeaponName({
            participant: selectedParticipant,
            resolvedEquipmentState: controlledEquipmentState,
            weaponName: phaseCombatLoadoutSummaries[primaryTargetPhase].attackStats?.weaponName,
          })
        : undefined;

    return targetOptions.map((option) => ({
      defaultDistance: option.id === primaryTargetId ? defaultDistance : undefined,
      displayName: option.displayName,
      id: option.id,
    }));
  }, [
    combatContextDraft.targetParticipantId,
    controlledEquipmentState,
    phaseCombatContextDrafts.phase1.targetParticipantId,
    phaseCombatContextDrafts.phase2.targetParticipantId,
    phaseCombatLoadoutSummaries,
    selectedActionId,
    selectedParticipant,
    targetOptions,
  ]);
  const initiativeCalculation = useMemo(
    () =>
      buildEncounterInitiativeModifierCalculation({
        baseInitiative: combatLoadoutSummary.passiveInitiative,
        combatContext: sanitizePlayerCombatModifierContext(projectedCombatContextDraft),
        phaseKey: currentModifierPhase,
      }),
    [combatLoadoutSummary.passiveInitiative, currentModifierPhase, projectedCombatContextDraft],
  );

  const phaseCards = useMemo(() => {
    return [
      {
        description: selectedActionId ? "" : "No action selected yet.",
        phaseLabel: "Phase 1",
        stats: [],
        title: "",
      },
      {
        description: "",
        phaseLabel: "Phase 2",
        stats: [],
        title: "",
      },
    ] as const;
  }, [selectedActionId]);

  const hasMeaningfulDeclaration =
    Boolean(selectedActionId) ||
    Boolean(selectedSecondaryActionId) ||
    additionalActionNotes.trim().length > 0;
  const currentCombatStepLabel = getPlayerCombatStepLabel(currentCombatStep);
  const currentInitiativePhase =
    currentCombatStep === "initiative_phase_1"
      ? "phase1"
      : currentCombatStep === "initiative_phase_2"
        ? "phase2"
        : undefined;
  const selectedCurrentInitiative = currentInitiativePhase
    ? selectedRoundParticipant?.initiatives[currentInitiativePhase]
    : undefined;
  const currentAttackPhase = getCombatAttackPhaseForStep(currentCombatStep);
  const currentPhaseChoicePhase = currentInitiativePhase;
  const selectedPhaseCombatExperienceRequirement =
    combatRoundState && selectedRoundParticipant && currentPhaseChoicePhase
      ? getCombatRoundPhaseCombatExperienceRequirement({
          participantId: selectedRoundParticipant.participantId,
          phase: currentPhaseChoicePhase,
          state: combatRoundState,
          visibility: encounterSession?.roleplayState?.visibility,
        })
      : undefined;
  const selectedPhaseAttackBackOutOpportunity =
    combatRoundState && selectedRoundParticipant && currentPhaseChoicePhase
      ? getCombatRoundPhaseAttackBackOutOpportunity({
          participantId: selectedRoundParticipant.participantId,
          phase: currentPhaseChoicePhase,
          state: combatRoundState,
          visibility: encounterSession?.roleplayState?.visibility,
        })
      : undefined;
  const selectedPhaseInitiativeChoice =
    combatRoundState && selectedRoundParticipant && currentPhaseChoicePhase
      ? getCombatRoundPhaseInitiativeChoice({
          participantId: selectedRoundParticipant.participantId,
          phase: currentPhaseChoicePhase,
          state: combatRoundState,
        })
      : undefined;
  const selectedVisibleCombatExperienceResult =
    selectedPhaseInitiativeChoice?.combatExperience ?? selectedCombatExperienceResult;
  const currentAttackPhaseContext = currentAttackPhase
    ? (selectedRoundDeclaration?.phaseContexts?.[currentAttackPhase] ??
      phaseCombatContextDrafts[currentAttackPhase])
    : undefined;
  const currentAttackTargetParticipantId = currentAttackPhaseContext?.targetParticipantId;
  const selectedReactivePhase1IncomingAttacks =
    combatRoundState &&
    selectedRoundParticipant &&
    selectedRoundDeclaration?.actionId === "parry_attack"
      ? getCombatRoundIncomingAttackResultsForParticipantPhase({
          participantId: selectedRoundParticipant.participantId,
          phase: "phase1",
          state: combatRoundState,
        })
      : [];
  const selectedReactiveAttackPhase2Modifier =
    combatRoundState &&
    selectedRoundParticipant &&
    selectedRoundDeclaration?.actionId === "parry_attack"
      ? getReactiveAttackPhase2InitiativeModifier({
          participantId: selectedRoundParticipant.participantId,
          state: combatRoundState,
        })
      : undefined;
  const selectedReactiveAttackPhase2DeclaredTarget =
    selectedRoundDeclaration?.phaseContexts?.phase2?.targetParticipantId;
  const selectedReactiveAttackPhase2TargetParticipant =
    selectedReactiveAttackPhase2DeclaredTarget && combatRoundState
      ? combatRoundState.participants.find((participant) =>
          getCombatDistanceParticipantAliases(participant).includes(
            selectedReactiveAttackPhase2DeclaredTarget,
          ),
        )
      : undefined;
  const selectedReactiveAttackNeedsTargetAdjudication = Boolean(
    selectedReactiveAttackPhase2TargetParticipant &&
    selectedReactivePhase1IncomingAttacks.some(
      (attack) =>
        attack.attackerParticipantId !==
        selectedReactiveAttackPhase2TargetParticipant.participantId,
    ),
  );
  const selectedReactiveAttackPhase2StatusText =
    selectedRoundDeclaration?.actionId === "parry_attack" && currentCombatStep === "phase_2_actions"
      ? selectedReactivePhase1IncomingAttacks.length === 0
        ? "Reactive attack: no phase 1 attack received, so no phase 2 attack opens."
        : `Reactive attack: phase 2 opens because a phase 1 attack was received${
            selectedReactiveAttackPhase2Modifier
              ? ` (${selectedReactiveAttackPhase2Modifier.reason}, Initiative ${selectedReactiveAttackPhase2Modifier.value >= 0 ? "+" : ""}${selectedReactiveAttackPhase2Modifier.value})`
              : ""
          }.${selectedReactiveAttackNeedsTargetAdjudication ? " Target switch is GM-adjudicated." : ""}`
      : undefined;
  const selectedCurrentAttackResult =
    combatRoundState && selectedRoundParticipant && currentAttackPhase
      ? getCombatRoundOutgoingAttackResultForParticipantPhase({
          participantId: selectedRoundParticipant.participantId,
          phase: currentAttackPhase,
          state: combatRoundState,
        })
      : undefined;
  const selectedCurrentAttackResultPanel = selectedCurrentAttackResult
    ? {
        interpretedResult: selectedCurrentAttackResult.tableResult,
        sections: [
          {
            calculationLines: [
              formatCombatAttackResultLine({
                participantId: selectedRoundParticipant?.participantId,
                result: selectedCurrentAttackResult,
              }),
            ],
            resultLine: `Result: ${selectedCurrentAttackResult.tableResult}`,
            title: "To hit",
          },
        ],
      }
    : null;
  const selectedLatestRelevantAttackResult =
    combatRoundState && selectedRoundParticipant
      ? getLatestRelevantPlayerCombatAttackResult({
          participantId: selectedRoundParticipant.participantId,
          state: combatRoundState,
        })
      : undefined;
  const selectedLatestRelevantAttackResultPanel = selectedLatestRelevantAttackResult
    ? {
        interpretedResult: selectedLatestRelevantAttackResult.tableResult,
        sections: [
          {
            calculationLines: [
              formatCombatAttackResultLine({
                participantId: selectedRoundParticipant?.participantId,
                result: selectedLatestRelevantAttackResult,
              }),
            ],
            resultLine: `Result: ${selectedLatestRelevantAttackResult.tableResult}`,
            title: "To hit",
          },
        ],
      }
    : null;
  const currentResolutionPhase = getCombatRoundResolutionPhaseForStep(currentCombatStep);
  const selectedCurrentIncomingResolutionAttackResult =
    combatRoundState && selectedRoundParticipant && currentResolutionPhase
      ? getCombatRoundDisplayIncomingAttackResultForParticipantPhase({
          participantId: selectedRoundParticipant.participantId,
          phase: currentResolutionPhase,
          state: combatRoundState,
        })
      : undefined;
  const selectedCurrentOutgoingResolutionAttackResult =
    combatRoundState && selectedRoundParticipant && currentResolutionPhase
      ? getCombatRoundOutgoingAttackResultForParticipantPhase({
          participantId: selectedRoundParticipant.participantId,
          phase: currentResolutionPhase,
          state: combatRoundState,
        })
      : undefined;
  const selectedCurrentResolutionAttackResult =
    selectedCurrentIncomingResolutionAttackResult ?? selectedCurrentOutgoingResolutionAttackResult;
  const selectedCurrentPhaseResolutionResult =
    combatRoundState && selectedCurrentResolutionAttackResult
      ? (getCombatRoundPhaseResolutionResultForAttack({
          attackResult: selectedCurrentResolutionAttackResult,
          state: combatRoundState,
        }) ??
        buildCombatRoundPhaseResolutionResult({
          attackResult: selectedCurrentResolutionAttackResult,
          roundNumber: combatRoundState.roundNumber,
          updatedAt: selectedCurrentResolutionAttackResult.rolledAt,
        }))
      : undefined;
  const selectedCurrentPhaseResolutionLines =
    selectedCurrentResolutionAttackResult && selectedCurrentPhaseResolutionResult
      ? formatCombatPhaseResolutionResultLines({
          attackResult: selectedCurrentResolutionAttackResult,
          participantId: selectedRoundParticipant?.participantId,
          resolution: selectedCurrentPhaseResolutionResult,
        })
      : undefined;
  const selectedCurrentPhaseResolutionResultPanel = selectedCurrentPhaseResolutionLines
    ? {
        interpretedResult: selectedCurrentPhaseResolutionLines.statusLine,
        rankLabel: selectedCurrentPhaseResolutionLines.attackLine,
        resultLabel: selectedCurrentPhaseResolutionLines.proposalLine,
        sections: selectedCurrentPhaseResolutionLines.sections,
      }
    : null;
  const currentParryDefenseStats = currentResolutionPhase
    ? buildPlayerCombatDefenseStats({
        mainHandParryItemLabel:
          phaseCombatLoadoutSummaries[currentResolutionPhase].mainHandParryItemLabel,
        offHandParryItemLabel:
          phaseCombatLoadoutSummaries[currentResolutionPhase].offHandParryItemLabel,
        phaseContext: phaseCombatContextDrafts[currentResolutionPhase],
        reference: phaseCombatLoadoutSummaries[currentResolutionPhase].reference,
      })
    : null;
  const currentParryBase = currentResolutionPhase
    ? parsePlayerCombatDisplayInteger(
        phaseCombatLoadoutSummaries[currentResolutionPhase].baseDefenseStats?.parry,
      )
    : undefined;
  const selectedAttackerPrivilegedResolution =
    combatRoundState &&
    (currentRollAction?.kind === "hit_location" || currentRollAction?.kind === "critical")
      ? combatRoundState.phaseResolutionResults.find(
          (resolution) => resolution.attackResultId === currentRollAction.attackResultId,
        )
      : undefined;
  const selectedAttackerPrivilegedDamageSubstate = selectedAttackerPrivilegedResolution
    ? getCombatRoundDamageSubstate(selectedAttackerPrivilegedResolution)
    : undefined;
  const selectedAttackerPrivilegedAttackResult =
    combatRoundState && selectedAttackerPrivilegedResolution
      ? getCombatRoundAttackResultById({
          attackResultId: selectedAttackerPrivilegedResolution.attackResultId,
          state: combatRoundState,
        })
      : undefined;
  const selectedAttackerPrivilegedResolutionLines =
    selectedAttackerPrivilegedAttackResult && selectedAttackerPrivilegedResolution
      ? formatCombatPhaseResolutionResultLines({
          attackResult: selectedAttackerPrivilegedAttackResult,
          participantId: selectedRoundParticipant?.participantId,
          resolution: selectedAttackerPrivilegedResolution,
        })
      : undefined;
  const selectedAttackerPrivilegedResultPanel = selectedAttackerPrivilegedResolutionLines
    ? {
        interpretedResult: selectedAttackerPrivilegedResolutionLines.statusLine,
        rankLabel: selectedAttackerPrivilegedResolutionLines.attackLine,
        resultLabel: selectedAttackerPrivilegedResolutionLines.proposalLine,
        sections: selectedAttackerPrivilegedResolutionLines.sections,
      }
    : null;
  const selectedInvolvedDamageResolution =
    combatRoundState && selectedRoundParticipant
      ? getLatestPlayerVisibleDamageResolution({
          participantId: selectedRoundParticipant.participantId,
          resolutions: combatRoundState.phaseResolutionResults,
        })
      : undefined;
  const selectedInvolvedDamageAttackResult =
    combatRoundState && selectedInvolvedDamageResolution
      ? getCombatRoundAttackResultById({
          attackResultId: selectedInvolvedDamageResolution.attackResultId,
          state: combatRoundState,
        })
      : undefined;
  const selectedInvolvedDamageResolutionLines =
    selectedInvolvedDamageAttackResult && selectedInvolvedDamageResolution
      ? formatCombatPhaseResolutionResultLines({
          attackResult: selectedInvolvedDamageAttackResult,
          participantId: selectedRoundParticipant?.participantId,
          resolution: selectedInvolvedDamageResolution,
        })
      : undefined;
  const selectedInvolvedDamageResultPanel = selectedInvolvedDamageResolutionLines
    ? {
        interpretedResult: selectedInvolvedDamageResolutionLines.statusLine,
        rankLabel: selectedInvolvedDamageResolutionLines.attackLine,
        resultLabel: selectedInvolvedDamageResolutionLines.proposalLine,
        sections: selectedInvolvedDamageResolutionLines.sections,
      }
    : null;
  const selectedAttackerCriticalContext =
    selectedAttackerPrivilegedAttackResult && selectedAttackerPrivilegedResolution
      ? formatPlayerCombatCriticalContextLine({
          attackResult: selectedAttackerPrivilegedAttackResult,
          compact: true,
          resolution: selectedAttackerPrivilegedResolution,
        })
      : undefined;
  const selectedAttackerCriticalStatusContext =
    selectedAttackerPrivilegedAttackResult && selectedAttackerPrivilegedResolution
      ? formatPlayerCombatCriticalContextLine({
          attackResult: selectedAttackerPrivilegedAttackResult,
          resolution: selectedAttackerPrivilegedResolution,
        })
      : undefined;
  const attackerPrivilegedAction = selectedAttackerPrivilegedAttackResult
    ? currentRollAction?.kind === "hit_location" &&
      selectedAttackerPrivilegedDamageSubstate === "location_pending"
      ? {
          disabled: false,
          kind: "hitLocation" as const,
          label: "Roll hit location as attacker",
          statusContext: undefined,
        }
      : currentRollAction?.kind === "critical" &&
          selectedAttackerPrivilegedDamageSubstate === "critical_pending"
        ? {
            disabled: false,
            kind: "critical" as const,
            label: selectedAttackerCriticalContext
              ? `Roll critical as attacker: ${selectedAttackerCriticalContext}`
              : "Roll critical as attacker",
            statusContext: selectedAttackerCriticalStatusContext,
          }
        : selectedAttackerPrivilegedDamageSubstate === "location_rolled"
          ? {
              disabled: true,
              kind: undefined,
              label: "Attacker hit location rolled",
              statusContext: undefined,
            }
          : selectedAttackerPrivilegedDamageSubstate === "critical_rolled"
            ? {
                disabled: true,
                kind: undefined,
                label: "Attacker critical rolled",
                statusContext: undefined,
              }
            : undefined
    : undefined;
  const phase1InitiativeRanks = useMemo(
    () =>
      combatRoundState
        ? getCombatRoundInitiativeRanks({ phase: "phase1", state: combatRoundState })
        : {},
    [combatRoundState],
  );
  const phase2InitiativeRanks = useMemo(
    () =>
      combatRoundState
        ? getCombatRoundInitiativeRanks({ phase: "phase2", state: combatRoundState })
        : {},
    [combatRoundState],
  );
  const latestRolledInitiativePhase = selectedRoundParticipant?.initiatives.phase2
    ? "phase2"
    : selectedRoundParticipant?.initiatives.phase1
      ? "phase1"
      : undefined;
  const currentResultPhase =
    currentModifierPhase ?? currentInitiativePhase ?? latestRolledInitiativePhase;
  const selectedRelevantInitiative = currentResultPhase
    ? selectedRoundParticipant?.initiatives[currentResultPhase]
    : undefined;
  const selectedRelevantInitiativeComplete = Boolean(
    currentResultPhase && combatHistory?.progression?.executionOrder?.phase === currentResultPhase,
  );
  const selectedRelevantInitiativeRankLabel =
    currentResultPhase && selectedRelevantInitiativeComplete
      ? formatPlayerCombatInitiativeRank({
          participantId: selectedRoundParticipant?.participantId,
          ranks: currentResultPhase === "phase2" ? phase2InitiativeRanks : phase1InitiativeRanks,
          value: getCombatRoundInitiativeTotal(selectedRelevantInitiative),
        })
      : undefined;
  const selectedRelevantInitiativeResultPanel = selectedRelevantInitiative
    ? {
        interpretedResult: formatCombatInitiativeFormula(selectedRelevantInitiative),
        sections: [
          {
            calculationLines: [formatCombatInitiativeFormula(selectedRelevantInitiative)],
            resultLine: selectedRelevantInitiativeComplete
              ? `Result: ${selectedRelevantInitiativeRankLabel ?? `Initiative ${selectedRelevantInitiative.total}`}`
              : "Result: Initiative rolled — waiting for others",
            title: "Initiative",
          },
        ],
      }
    : null;
  const selectedPhaseInitiativeChoiceResultPanel = buildPhaseInitiativeChoiceResultPanel(
    selectedPhaseInitiativeChoice,
  );
  const selectedFallbackCombatExperienceResult = selectedPhaseInitiativeChoiceResultPanel
    ? undefined
    : selectedVisibleCombatExperienceResult;
  const selectedCombatExperienceResultPanel = selectedFallbackCombatExperienceResult
    ? {
        interpretedResult: selectedFallbackCombatExperienceResult.noRollRequired
          ? `Combat Experience ${selectedFallbackCombatExperienceResult.skillTotal} vs difficulty ${selectedFallbackCombatExperienceResult.difficulty}`
          : `Combat Experience ${selectedFallbackCombatExperienceResult.skillTotal} + roll ${selectedFallbackCombatExperienceResult.rollTotal} = ${selectedFallbackCombatExperienceResult.finalTotal} vs ${selectedFallbackCombatExperienceResult.difficulty}`,
        rankLabel: "Combat Experience",
        resultLabel: formatCombatExperienceResultLine(selectedFallbackCombatExperienceResult),
      }
    : null;
  const selectedHealthCheckResultPanel =
    selectedVisibleHealthRoll?.result && selectedHealthRollDamageProposal
      ? {
          interpretedResult: `${selectedVisibleHealthRoll.label}`,
          rankLabel: "Round-end health check",
          sections: [
            {
              calculationLines: [
                `Health ${selectedVisibleHealthRoll.healthStat} + roll ${formatOpenEndedD20RollBreakdown(
                  {
                    dieResult: selectedVisibleHealthRoll.result.rollTotal,
                    openEndedD10s: selectedVisibleHealthRoll.result.openEndedD10s,
                    rollD20: selectedVisibleHealthRoll.result.rollD20,
                  },
                )} = ${selectedVisibleHealthRoll.result.finalTotal}`,
                `Reason: ${formatRoundEndHealthCheckReason({
                  damageLabel: selectedHealthRollDamageProposal.label,
                  proposal: selectedVisibleHealthRoll,
                })}`,
              ],
              resultLine: formatRoundEndHealthCheckResultLine(selectedVisibleHealthRoll),
              title: "Health check",
            },
          ],
        }
      : selectedVisibleHealthRoll?.result
        ? {
            interpretedResult: `${selectedVisibleHealthRoll.label}`,
            rankLabel: "Round-end health check",
            sections: [
              {
                calculationLines: [
                  `Health ${selectedVisibleHealthRoll.healthStat} + roll ${formatOpenEndedD20RollBreakdown(
                    {
                      dieResult: selectedVisibleHealthRoll.result.rollTotal,
                      openEndedD10s: selectedVisibleHealthRoll.result.openEndedD10s,
                      rollD20: selectedVisibleHealthRoll.result.rollD20,
                    },
                  )} = ${selectedVisibleHealthRoll.result.finalTotal}`,
                ],
                resultLine: formatRoundEndHealthCheckResultLine(selectedVisibleHealthRoll),
                title: "Health check",
              },
            ],
          }
        : null;
  const selectedDistanceControlCommittedDistance =
    selectedDistanceControlProposal?.proposal.status === "committed"
      ? (selectedDistanceControlProposal.proposal.appliedDistance ??
        selectedDistanceControlProposal.proposal.proposedDistance)
      : undefined;
  const selectedDistanceControlProgressText = selectedDistanceControlProposal
    ? formatDistanceControlProgressLine({
        opponentStatus: selectedDistanceControlProposal.opponentSide.status,
        ownStatus: selectedDistanceControlProposal.ownSide.status,
        proposalStatus: selectedDistanceControlProposal.proposal.status,
      })
    : undefined;
  const selectedDistanceControlResultPanel = selectedDistanceControlProposal?.ownSide.result
    ? {
        interpretedResult: `Dodge ${selectedDistanceControlProposal.ownSide.dodgeSkillTotal} + Gen/Fatigue ${selectedDistanceControlProposal.ownSide.generalFatigueModifier} + roll ${selectedDistanceControlProposal.ownSide.result.rollTotal} = ${selectedDistanceControlProposal.ownSide.result.finalTotal}`,
        rankLabel: "Distance control",
        sections: [
          {
            calculationLines: [
              ...buildConciseDodgeCalculationRows({
                calculation: {
                  dodgeSkillTotal: selectedDistanceControlProposal.ownSide.dodgeSkillTotal,
                  finalTotal: selectedDistanceControlProposal.ownSide.result.finalTotal,
                  generalFatigueModifier:
                    selectedDistanceControlProposal.ownSide.generalFatigueModifier,
                  openEndedD10s: selectedDistanceControlProposal.ownSide.result.openEndedD10s,
                  rollD20: selectedDistanceControlProposal.ownSide.result.rollD20,
                  rollTotal: selectedDistanceControlProposal.ownSide.result.rollTotal,
                },
                eventId: `${selectedDistanceControlProposal.proposal.id}:own-roll`,
                outcome:
                  selectedDistanceControlCommittedDistance !== undefined
                    ? `Distance ${selectedDistanceControlCommittedDistance} next round`
                    : "Distance-control roll recorded",
              }).map((row) => row.text),
              `Preference: ${
                selectedDistanceControlProposal.ownSide.desiredDistance ?? "no preference"
              }`,
            ],
            resultLine:
              selectedDistanceControlCommittedDistance !== undefined
                ? `Result: distance ${selectedDistanceControlCommittedDistance} next round`
                : "Result: distance-control roll recorded",
            title: "Distance control",
          },
        ],
      }
    : selectedDistanceControlCommittedDistance !== undefined
      ? {
          interpretedResult: `Distance control committed: distance ${selectedDistanceControlCommittedDistance} next round`,
          rankLabel: "Distance control",
          resultLabel: `Distance control committed: distance ${selectedDistanceControlCommittedDistance} next round`,
        }
      : null;
  const initiativeStepStatus =
    currentCombatStep === "initiative_phase_1"
      ? (selectedRoundParticipant?.stepStatuses.initiative_phase_1 ?? "pending")
      : currentCombatStep === "initiative_phase_2"
        ? (selectedRoundParticipant?.stepStatuses.initiative_phase_2 ?? "pending")
        : undefined;
  const selectedParticipantRolledCurrentInitiative = Boolean(
    currentInitiativePhase && selectedCurrentInitiative !== undefined,
  );
  const currentInitiativeRollCounts =
    currentInitiativePhase && combatRoundState
      ? {
          pending: combatRoundState.participants.filter(
            (participant) => participant.initiatives[currentInitiativePhase] === undefined,
          ).length,
          total: combatRoundState.participants.length,
        }
      : undefined;
  const canUseInitiativeButton =
    Boolean(currentInitiativePhase) &&
    Boolean(displayedParticipant) &&
    Boolean(selectedRoundParticipant) &&
    initiativeStepStatus === "pending" &&
    !selectedParticipantRolledCurrentInitiative &&
    selectedProgressionTasks.some((task) => task.kind === "roll_initiative");
  const canUseCurrentAttackButton =
    Boolean(currentAttackPhase) &&
    Boolean(displayedParticipant) &&
    Boolean(selectedRoundParticipant) &&
    Boolean(combatRoundState) &&
    Boolean(currentAttackTargetParticipantId) &&
    Boolean(phaseCombatLoadoutSummaries[currentAttackPhase ?? "phase1"].attackStats) &&
    currentRollAction?.kind === "attack" &&
    currentRollAction.phase === currentAttackPhase;
  const currentAttackSourceMissing =
    Boolean(currentAttackPhase) &&
    Boolean(displayedParticipant) &&
    Boolean(selectedRoundParticipant) &&
    Boolean(combatRoundState) &&
    Boolean(currentAttackTargetParticipantId) &&
    currentRollAction?.kind === "attack" &&
    currentRollAction.phase === currentAttackPhase &&
    !phaseCombatLoadoutSummaries[currentAttackPhase ?? "phase1"].attackStats;
  const currentAttackSourceValidationMessage =
    currentAttackSourceMissing && currentAttackPhase
      ? `No ${currentAttackPhase === "phase1" ? "phase 1" : "phase 2"} attack source available.`
      : undefined;
  const currentAttackAction = canUseCurrentAttackButton
    ? {
        disabled: false,
        kind: "attack" as const,
        label: currentAttackPhase === "phase2" ? "Roll phase 2 attack" : "Roll phase 1 attack",
      }
    : undefined;
  const canUseCurrentParryButton =
    Boolean(displayedParticipant) &&
    Boolean(selectedRoundParticipant) &&
    Boolean(combatRoundState) &&
    currentRollAction?.kind === "parry" &&
    selectedCurrentResolutionAttackResult?.hit === true &&
    selectedCurrentPhaseResolutionResult?.parryResolution.status === "pending" &&
    currentParryBase !== undefined;
  const currentParryAction = canUseCurrentParryButton
    ? {
        disabled: false,
        kind: "parry" as const,
        label: "Roll parry",
      }
    : undefined;
  const targetValidation = useMemo(
    () =>
      validateCombatDeclarationTargets({
        actionId: selectedActionId || undefined,
        phaseContexts: phaseCombatContextDrafts,
        secondaryActionId: selectedSecondaryActionId || undefined,
      }),
    [phaseCombatContextDrafts, selectedActionId, selectedSecondaryActionId],
  );
  const declarationIncomplete =
    declarationStepOpen && hasMeaningfulDeclaration && !targetValidation.valid;
  const declarationStepHardLocked =
    selectedDeclarationStepStatus === "locked" ||
    selectedDeclarationStepStatus === "complete" ||
    selectedDeclarationStepStatus === "skipped";
  const declarationSubmittedAndComplete =
    (selectedDeclarationStepStatus === "submitted" ||
      selectedDeclarationStepStatus === "gmEdited" ||
      selectedParticipantStoredDeclarationThisRound) &&
    selectedStoredDeclarationComplete;
  const playerDeclarationLocked =
    !declarationStepOpen || declarationStepHardLocked || declarationSubmittedAndComplete;
  const declarationControlsDisabled =
    controlsDisabled || playerDeclarationLocked || selectedCombatExperienceRequired;
  const selectedCombatExperienceActionAvailable =
    selectedCombatExperienceRequired &&
    selectedCombatExperienceWindowOpen &&
    Boolean(selectedParticipant) &&
    Boolean(encounterId);
  const selectedPhaseCombatExperienceBackOutAvailable = Boolean(
    selectedPhaseAttackBackOutOpportunity &&
    combatRoundState &&
    selectedRoundParticipant &&
    currentPhaseChoicePhase &&
    canBackOutCombatRoundPhaseAttack({
      participantId: selectedRoundParticipant.participantId,
      phase: currentPhaseChoicePhase,
      state: combatRoundState,
      visibility: encounterSession?.roleplayState?.visibility,
    }) &&
    selectedParticipant &&
    encounterId &&
    !readOnlyInspection,
  );
  const selectedPhaseContinueAvailable = Boolean(
    selectedPhaseAttackBackOutOpportunity &&
    !selectedPhaseAttackBackOutOpportunity.ceRequired &&
    !selectedPhaseInitiativeChoice &&
    selectedParticipant &&
    encounterId &&
    !readOnlyInspection,
  );
  const selectedPhaseAttackChoiceSelectorAvailable = Boolean(
    selectedPhaseCombatExperienceBackOutAvailable &&
    !selectedPhaseInitiativeChoice &&
    (selectedPhaseCombatExperienceRequirement || selectedPhaseContinueAvailable),
  );
  const selectedPhaseAttackChoiceKey = selectedPhaseAttackBackOutOpportunity
    ? [
        selectedRoundParticipant?.participantId ?? "unknown",
        selectedPhaseAttackBackOutOpportunity.phase,
        selectedPhaseAttackBackOutOpportunity.ceRequired ? "ce" : "continue",
        selectedPhaseInitiativeChoice?.choice ?? "pending",
      ].join(":")
    : "none";

  useEffect(() => {
    setPhaseAttackChoiceSelection("continue");
  }, [selectedPhaseAttackChoiceKey]);

  const selectedPhaseAttackChoiceIsBackOut =
    selectedPhaseAttackChoiceSelectorAvailable && phaseAttackChoiceSelection === "back_out";
  const selectedDoubleAttackDecisionAvailable = Boolean(
    !readOnlyInspection &&
    selectedRoundParticipant?.declaration?.actionId === "double_attack" &&
    currentCombatStep === "review_phase_2_modifiers" &&
    selectedRoundParticipant.attackResults.phase1 &&
    !selectedRoundParticipant.attackResults.phase2 &&
    !combatRoundState?.commands.some(
      (command) =>
        command.roundNumber === combatRoundState.roundNumber &&
        command.participantId === selectedRoundParticipant.participantId &&
        command.type === "decide_double_attack_phase2",
    ),
  );
  const declarationTargetValidationMessage =
    selectedActionId === "feint_attack" && feintMethod === "weapon" && !resolvedFeintAttackerSkill
      ? "The selected weapon has no valid combat skill for a weapon feint."
      : !currentInitiativePhase && declarationIncomplete
        ? targetValidation.message
        : undefined;
  const declareActionDisabled =
    controlsDisabled ||
    savingCombatContext ||
    !displayedParticipant ||
    (currentInitiativePhase
      ? !canUseInitiativeButton
      : playerDeclarationLocked ||
        !hasMeaningfulDeclaration ||
        !targetValidation.valid ||
        (selectedActionId === "feint_attack" &&
          feintMethod === "weapon" &&
          !resolvedFeintAttackerSkill));
  const declarationButtonLabel =
    currentCombatStep === "select_actions" && (!playerDeclarationLocked || declarationIncomplete)
      ? "Declare action"
      : getPlayerCombatActionButtonLabel({
          currentStep: currentCombatStep,
          disabled: declareActionDisabled,
          isGameMaster: false,
        });
  const awaitingGmBoundaryTransition = Boolean(
    combatHistory?.progression?.awaitingGmTransition,
  );
  const playerActionButtonLabel = awaitingGmBoundaryTransition
    ? "Waiting for GM"
    : selectedHealthCheckActionAvailable
      ? "Roll health check"
    : selectedAdjustDistanceProposal
      ? selectedAdjustDistanceProposal.status === "awaiting_defender_response"
        ? "Confirm defender response"
        : selectedAdjustDistanceProposal.attackerRollRecorded
          ? "Roll defender Dodge"
          : "Roll attacker Dodge"
      : selectedFeintProposal
        ? selectedFeintProposal.attackerRollRecorded
          ? "Roll feint resistance"
          : "Roll feint"
        : selectedDistanceControlActionAvailable
          ? "Roll distance control"
          : selectedDoubleAttackDecisionAvailable
            ? doubleAttackPhase2Decision === "cancel"
              ? "Cancel Attack 2"
              : "Continue Attack 2"
            : selectedPhaseAttackChoiceIsBackOut
              ? "Back out of attack"
              : selectedCombatExperienceRequired
                ? !selectedCombatExperienceWindowOpen
                  ? "Waiting for GM"
                  : selectedCombatExperienceNoRollAvailable
                    ? "Confirm Combat Experience"
                    : "Roll Combat Experience"
                : selectedPhaseInitiativeChoice
                  ? "Phase choice submitted"
                  : selectedPhaseContinueAvailable
                    ? "Continue attack"
                    : (attackerPrivilegedAction?.label ??
                      currentParryAction?.label ??
                      currentAttackAction?.label ??
                      declarationButtonLabel);
  const playerActionButtonDisabled = awaitingGmBoundaryTransition
    ? true
    : selectedHealthCheckActionAvailable
      ? controlsDisabled || savingCombatContext
    : selectedAdjustDistanceProposal
      ? controlsDisabled || savingCombatContext
      : selectedFeintProposal
        ? controlsDisabled || savingCombatContext
        : selectedDistanceControlActionAvailable
          ? controlsDisabled || savingCombatContext
          : selectedDoubleAttackDecisionAvailable
            ? controlsDisabled || savingCombatContext
            : selectedPhaseAttackChoiceIsBackOut
              ? controlsDisabled ||
                savingCombatContext ||
                !selectedPhaseCombatExperienceBackOutAvailable
              : attackerPrivilegedAction
                ? selectedCombatExperienceRequired ||
                  controlsDisabled ||
                  savingCombatContext ||
                  attackerPrivilegedAction.disabled
                : currentParryAction
                  ? selectedCombatExperienceRequired ||
                    controlsDisabled ||
                    savingCombatContext ||
                    currentParryAction.disabled
                  : currentAttackAction
                    ? selectedCombatExperienceRequired ||
                      controlsDisabled ||
                      savingCombatContext ||
                      currentAttackAction.disabled
                    : selectedCombatExperienceRequired
                      ? controlsDisabled ||
                        savingCombatContext ||
                        !selectedCombatExperienceActionAvailable
                      : selectedPhaseInitiativeChoice
                        ? true
                        : selectedPhaseContinueAvailable
                          ? controlsDisabled || savingCombatContext
                          : declareActionDisabled;
  const selectedParticipantHasDeclared =
    selectedStoredDeclarationComplete &&
    (selectedParticipantStoredDeclarationThisRound ||
      selectedDeclarationStepStatus === "submitted" ||
      selectedDeclarationStepStatus === "gmEdited");
  const selectedCurrentStepStatus = selectedRoundParticipant?.stepStatuses[currentCombatStep];
  const currentStepIsModifierReview =
    currentCombatStep === "review_action_modifiers" ||
    currentCombatStep === "review_phase_2_modifiers";
  const selectedModifierReviewComplete =
    currentStepIsModifierReview &&
    (selectedCurrentStepStatus === "complete" || selectedCurrentStepStatus === "gmEdited");
  const combatExperienceStatusText = !selectedCombatExperienceWindowOpen
    ? "Waiting for GM to start CE."
    : selectedCombatExperienceNoRollAvailable
      ? `Current step: ${currentCombatStepLabel}. Confirm Combat Experience.`
      : `Current step: ${currentCombatStepLabel}. Roll Combat Experience.`;
  const declarationStatusText = awaitingGmBoundaryTransition
    ? `Current step: ${currentCombatStepLabel}. Complete; awaiting GM progression.`
    : selectedHealthCheckActionAvailable
      ? `Current step: ${currentCombatStepLabel}. Roll health check.`
    : selectedVisibleHealthRoll?.result
      ? `Current step: ${currentCombatStepLabel}. Health check rolled. Waiting for GM review.`
      : selectedDistanceControlActionAvailable
        ? `Current step: ${currentCombatStepLabel}. Roll distance control.`
        : selectedDistanceControlCommittedDistance !== undefined
          ? `Current step: ${currentCombatStepLabel}. Distance control committed.`
          : selectedDistanceControlProposal?.ownSide.status === "rolled"
            ? selectedDistanceControlProposal.proposal.status === "pending_rolls"
              ? `Current step: ${currentCombatStepLabel}. Waiting for other distance-control roll(s).`
              : `Current step: ${currentCombatStepLabel}. Waiting for GM to commit distance control.`
            : selectedPhaseAttackChoiceIsBackOut
              ? `Current step: ${currentCombatStepLabel}. Pending.`
              : selectedCombatExperienceRequired
                ? combatExperienceStatusText
                : currentInitiativePhase
                  ? selectedParticipantRolledCurrentInitiative
                    ? `Current step: ${currentCombatStepLabel}. Initiative rolled.`
                    : initiativeStepStatus === "pending"
                      ? `Current step: ${currentCombatStepLabel}.`
                      : `Current step: ${currentCombatStepLabel}. Waiting for GM.`
                  : currentParryAction
                    ? `Current step: ${currentCombatStepLabel}. Ready to roll.`
                    : selectedReactiveAttackPhase2StatusText
                      ? `Current step: ${currentCombatStepLabel}. ${selectedReactiveAttackPhase2StatusText}`
                      : attackerPrivilegedAction
                        ? attackerPrivilegedAction.disabled
                          ? `Current step: ${currentCombatStepLabel}. Attacker roll recorded; defender damage/effects review waits for GM.`
                          : `Current step: ${currentCombatStepLabel}. ${
                              attackerPrivilegedAction.statusContext
                                ? `Critical context: ${attackerPrivilegedAction.statusContext}.`
                                : "The attacker rolls; the defender receives the damage/effects review."
                            }`
                        : currentAttackAction
                          ? `Current step: ${currentCombatStepLabel}. Ready to roll.`
                          : currentAttackSourceValidationMessage
                            ? `Current step: ${currentCombatStepLabel}. ${currentAttackSourceValidationMessage}`
                            : declarationIncomplete
                              ? `Current step: ${currentCombatStepLabel}. Incomplete declaration.`
                              : selectedModifierReviewComplete
                                ? `Current step: ${currentCombatStepLabel}. Reviewed.`
                                : currentStepIsModifierReview
                                  ? `Current step: ${currentCombatStepLabel}.`
                                  : selectedParticipantHasDeclared
                                    ? `Current step: ${currentCombatStepLabel}. Declared.`
                                    : declarationStepOpen &&
                                        selectedDeclarationStepStatus === "pending"
                                      ? `Current step: ${currentCombatStepLabel}.`
                                      : `Current step: ${currentCombatStepLabel}. Declaration closed.`;
  const combatExperienceValidationMessage: string | undefined = undefined;
  const selectedPhaseAttackChoiceControls = selectedDoubleAttackDecisionAvailable ? (
    <label style={{ display: "grid", gap: "0.25rem", justifySelf: "stretch" }}>
      <span style={{ fontSize: "0.88rem", fontWeight: 600 }}>Attack 2</span>
      <select
        disabled={controlsDisabled || savingCombatContext}
        onChange={(event) =>
          setDoubleAttackPhase2Decision(event.target.value as DoubleAttackPhase2Decision)
        }
        value={doubleAttackPhase2Decision}
      >
        <option value="continue">Continue Attack 2 (-1 OB, -4 DB)</option>
        <option value="cancel">Cancel Attack 2 (phase-2 DB becomes -2)</option>
      </select>
    </label>
  ) : selectedPhaseAttackChoiceSelectorAvailable ? (
    <label style={{ display: "grid", gap: "0.25rem", justifySelf: "stretch" }}>
      <span style={{ fontSize: "0.88rem", fontWeight: 600 }}>Phase choice</span>
      <select
        disabled={controlsDisabled || savingCombatContext}
        onChange={(event) =>
          setPhaseAttackChoiceSelection(event.target.value as PhaseAttackChoiceSelection)
        }
        value={phaseAttackChoiceSelection}
      >
        <option value="continue">
          {selectedPhaseCombatExperienceRequirement ? "Continue and roll CE" : "Continue attack"}
        </option>
        <option value="back_out">
          {selectedPhaseCombatExperienceRequirement
            ? "Back out of attack (-2 DB/Parry penalty)"
            : "Back out of attack (no CE roll)"}
        </option>
      </select>
    </label>
  ) : null;
  const selectedPhaseCombatExperienceThreats =
    selectedPhaseCombatExperienceRequirement?.threats ??
    selectedPhaseAttackBackOutOpportunity?.threats ??
    [];
  const selectedPhaseCombatExperienceRollRequired =
    selectedPhaseAttackBackOutOpportunity?.ceRequired ??
    Boolean(selectedPhaseCombatExperienceRequirement);
  const showPhaseCombatExperienceContextPanel = Boolean(
    selectedPhaseCombatExperienceRequirement ||
    selectedPhaseAttackBackOutOpportunity ||
    selectedPhaseInitiativeChoice,
  );
  const showInitiativeContextPanel =
    !showPhaseCombatExperienceContextPanel && Boolean(currentInitiativePhase);
  const showModifierReviewContextPanel =
    !showInitiativeContextPanel &&
    !showPhaseCombatExperienceContextPanel &&
    currentStepIsModifierReview;
  const showCombatStartExperienceContextPanel =
    !showInitiativeContextPanel &&
    !showPhaseCombatExperienceContextPanel &&
    !showModifierReviewContextPanel &&
    selectedCombatExperienceRequired &&
    selectedCombatExperienceTrigger === "combat_start";

  if (sessionLoading || loading) {
    return <section>Loading player combat screen...</section>;
  }

  if (!currentUser) {
    return (
      <section style={{ display: "grid", gap: "1rem", maxWidth: 1200 }}>
        <h1 style={{ marginBottom: "0.5rem" }}>Player combat screen</h1>
        <div style={panelStyle}>Sign in to open the player combat screen.</div>
      </section>
    );
  }

  if (error) {
    return (
      <section style={{ display: "grid", gap: "1rem", maxWidth: 1200 }}>
        <h1 style={{ marginBottom: "0.5rem" }}>Player combat screen</h1>
        <div style={panelStyle}>{error}</div>
      </section>
    );
  }

  if (!projection) {
    return (
      <section style={{ display: "grid", gap: "1rem", maxWidth: 1200 }}>
        <h1 style={{ marginBottom: "0.5rem" }}>Player combat screen</h1>
        <div style={panelStyle}>Scenario combat projection unavailable.</div>
      </section>
    );
  }

  const hasMountedLoadout =
    Boolean(controlledBuild) &&
    Boolean(controlledEquipmentState) &&
    Boolean(displayedParticipant?.characterId);

  return (
    <section style={{ display: "grid", gap: "1rem", maxWidth: 1200 }}>
      <RememberedCampaignWorkspaceEffect
        campaignId={campaignId}
        encounterId={encounterId}
        scenarioId={scenarioId}
        tab={workspaceTab}
      />
      <div style={{ display: "grid", gap: "0.5rem" }}>
        {!embedded ? (
          <div style={{ display: "flex", flexWrap: "wrap", gap: "0.75rem" }}>
            <Link
              href={buildCampaignWorkspaceHref({
                campaignId,
                scenarioId,
                tab: "scenario",
              })}
            >
              Back to scenario workspace
            </Link>
          </div>
        ) : null}
        {showWorkspaceHeader ? (
          <h1 style={{ margin: 0 }}>
            Combat
            {displayedParticipant?.displayName ? ` — ${displayedParticipant.displayName}` : ""}
          </h1>
        ) : null}
        {encounterTitle ? <div>Encounter: {encounterTitle}</div> : null}
        {showParticipantSelector ? (
          <label style={{ display: "grid", gap: "0.25rem", maxWidth: 360 }}>
            <span>Character</span>
            <select
              onChange={(event) => setSelectedParticipantId(event.target.value)}
              value={selectedParticipantId}
            >
              {accessibleParticipants.length === 0 ? (
                <option value="">No accessible participant</option>
              ) : null}
              {accessibleParticipants.map((participant) => (
                <option key={participant.id} value={participant.id}>
                  {participant.snapshot.displayName} ({participant.role})
                </option>
              ))}
            </select>
          </label>
        ) : null}
      </div>

      {playerCombatTrackerModel ? (
        <section style={panelStyle}>
          <div
            style={{
              alignItems: "center",
              display: "flex",
              gap: "0.75rem",
              justifyContent: "space-between",
            }}
          >
            <strong>Combat history</strong>
            <button
              disabled={!historyInspection}
              onClick={() => setHistoryInspection(undefined)}
              type="button"
            >
              Current task
            </button>
          </div>
          <CombatTracker
            model={playerCombatTrackerModel}
            onInspect={(cell) =>
              setHistoryInspection({
                participantId: cell.participantId,
                roundNumber: cell.roundNumber,
                step: cell.step,
              })
            }
          />
        </section>
      ) : null}

      {historyInspection ? (
        <PlayerCombatHistoryInspector
          events={inspectedHistoryEvents}
          snapshot={inspectedHistorySnapshot}
        />
      ) : displayedParticipant ? (
        <section style={panelStyle}>
          <div style={playerCombatTopPanelRowStyle}>
            <PlayerCombatActionSelectorPanel
              actionId={selectedActionId}
              additionalActionNotes={additionalActionNotes}
              controlsDisabled={declarationControlsDisabled}
              distancePreferenceOptions={distancePreferenceOptions}
              movementId={selectedMovementId}
              movementIntent={selectedMovementIntent}
              onActionChange={(actionId) => {
                markCombatDeclarationDraftDirty();
                setSelectedActionId(actionId);
                if (actionId === "feint_attack") {
                  setFeintMethod("movement");
                }
              }}
              onAdditionalActionNotesChange={(notes) => {
                markCombatDeclarationDraftDirty();
                setAdditionalActionNotes(notes);
              }}
              onMovementChange={(movementId) => {
                markCombatDeclarationDraftDirty();
                setSelectedMovementId(movementId);
              }}
              onMovementIntentChange={(movementIntent) => {
                markCombatDeclarationDraftDirty();
                setSelectedMovementIntent(movementIntent);
              }}
              onSecondaryActionChange={(actionId) => {
                markCombatDeclarationDraftDirty();
                setSelectedSecondaryActionId(actionId);
              }}
              roundNumber={combatRoundState?.roundNumber}
              secondaryActionId={selectedSecondaryActionId}
            />
            {phaseCards.map((phaseCard, index) => {
              const phaseKey: PlayerCombatPhaseKey = index === 0 ? "phase1" : "phase2";
              const phaseCombatContext =
                normalizedFeintPhaseContexts[phaseKey] ?? phaseCombatContextDrafts[phaseKey];
              const phaseLoadoutSummary = phaseCombatLoadoutSummaries[phaseKey];
              const targetRoundParticipant = phaseCombatContext.targetParticipantId
                ? combatRoundState?.participants.find(
                    (participant) =>
                      participant.scenarioParticipantId ===
                        phaseCombatContext.targetParticipantId ||
                      participant.participantId === phaseCombatContext.targetParticipantId ||
                      participant.characterId === phaseCombatContext.targetParticipantId,
                  )
                : undefined;
              const distanceEdge =
                combatRoundState && selectedRoundParticipant && targetRoundParticipant
                  ? getDistanceEdgeBetweenParticipantAliases({
                      participantA: selectedRoundParticipant,
                      participantB: targetRoundParticipant,
                      state: combatRoundState.distanceState,
                    })
                  : undefined;
              const phaseModel = buildPlayerCombatPhasePanelModel({
                actionId: selectedActionId,
                attackStats: phaseLoadoutSummary.attackStats,
                defenseStats: buildPlayerCombatDefenseStats({
                  mainHandParryItemLabel: phaseLoadoutSummary.mainHandParryItemLabel,
                  offHandParryItemLabel: phaseLoadoutSummary.offHandParryItemLabel,
                  phaseContext: phaseCombatContext,
                  reference: phaseLoadoutSummary.reference,
                }),
                phaseCard,
                phaseContext: phaseCombatContext,
                phaseKey,
                secondaryActionId: selectedSecondaryActionId,
              });

              return (
                <PlayerCombatPhasePanel key={phaseModel.phaseCard.phaseLabel} phaseCard={phaseCard}>
                  {selectedActionId === "adjust_range_attack" && phaseKey === "phase1" ? (
                    <div style={{ display: "grid", gap: "0.65rem" }}>
                      <PlayerCombatAttackTargetSelector
                        combatContext={phaseModel.phaseContext}
                        controlsDisabled={declarationControlsDisabled}
                        distanceLabel={
                          targetRoundParticipant
                            ? `Distance: ${distanceEdge?.distance ?? "—"}`
                            : undefined
                        }
                        onCombatContextChange={(combatContext) => {
                          markCombatDeclarationDraftDirty();
                          setPhaseCombatContextDrafts((current) => ({
                            phase1: combatContext,
                            phase2: {
                              ...current.phase2,
                              targetParticipantId: combatContext.targetParticipantId,
                            },
                          }));
                        }}
                        targetOptions={targetOptions}
                      />
                      <label style={{ display: "grid", gap: "0.25rem" }}>
                        <strong>Requested distance</strong>
                        <select
                          disabled={declarationControlsDisabled}
                          onChange={(event) => {
                            const targetParticipantId = phaseModel.phaseContext.targetParticipantId;
                            if (!targetParticipantId) return;
                            markCombatDeclarationDraftDirty();
                            setSelectedMovementIntent((current) => ({
                              ...current,
                              distancePreferences: [
                                ...current.distancePreferences.filter(
                                  (entry) => entry.targetParticipantId !== targetParticipantId,
                                ),
                                {
                                  desiredDistance: Number(event.target.value) as
                                    | 0
                                    | 1
                                    | 2
                                    | 3
                                    | 4
                                    | 5
                                    | 6
                                    | 7
                                    | 8,
                                  source: "player_declared",
                                  targetParticipantId,
                                },
                              ],
                            }));
                          }}
                          value={
                            selectedMovementIntent.distancePreferences.find(
                              (entry) =>
                                entry.targetParticipantId ===
                                phaseModel.phaseContext.targetParticipantId,
                            )?.desiredDistance ??
                            distancePreferenceOptions.find(
                              (option) => option.id === phaseModel.phaseContext.targetParticipantId,
                            )?.defaultDistance ??
                            2
                          }
                        >
                          {[0, 1, 2, 3, 4, 5, 6, 7, 8].map((distance) => (
                            <option key={distance} value={distance}>
                              {distance}
                            </option>
                          ))}
                        </select>
                      </label>
                      <div>Skill: Dodge</div>
                      <div>The defender may oppose or allow the maneuver.</div>
                    </div>
                  ) : selectedActionId === "feint_attack" && phaseKey === "phase1" ? (
                    <div style={{ display: "grid", gap: "0.65rem" }}>
                      <PlayerCombatAttackTargetSelector
                        combatContext={phaseModel.phaseContext}
                        controlsDisabled={declarationControlsDisabled}
                        distanceLabel={
                          targetRoundParticipant
                            ? `Distance: ${distanceEdge?.distance ?? "—"}`
                            : undefined
                        }
                        onCombatContextChange={(combatContext) => {
                          markCombatDeclarationDraftDirty();
                          setPhaseCombatContextDrafts((current) => ({
                            phase1: combatContext,
                            phase2: {
                              ...current.phase2,
                              targetParticipantId: combatContext.targetParticipantId,
                            },
                          }));
                        }}
                        targetOptions={targetOptions}
                      />
                      <label style={{ display: "grid", gap: "0.25rem" }}>
                        <strong>Feint method</strong>
                        <select
                          disabled={declarationControlsDisabled}
                          onChange={(event) => {
                            markCombatDeclarationDraftDirty();
                            const method = event.target.value === "weapon" ? "weapon" : "movement";
                            setFeintMethod(method);
                          }}
                          value={feintMethod}
                        >
                          <option value="movement">Movement</option>
                          <option value="weapon">Weapon</option>
                        </select>
                      </label>
                      <div>
                        <strong>Skill:</strong> {resolvedFeintAttackerSkill?.label ?? "Unavailable"}
                      </div>
                      <div>Characteristic: Dexterity</div>
                      <div>
                        Defender resists with their highest close-combat skill · Intelligence.
                      </div>
                      {feintMethod === "weapon" && phaseModel.attackStats ? (
                        <>
                          <PlayerCombatAttackStatsTable stats={phaseModel.attackStats} />
                          <PlayerCombatAttackModeSelector
                            controlsDisabled={declarationControlsDisabled}
                            onChange={(attackModeId) => {
                              markCombatDeclarationDraftDirty();
                              setPhaseCombatContextDrafts((current) => ({
                                ...current,
                                phase1: { ...current.phase1, attackModeId },
                              }));
                            }}
                            options={phaseLoadoutSummary.attackModeOptions}
                            selectedAttackModeId={phaseLoadoutSummary.selectedAttackModeId}
                          />
                        </>
                      ) : null}
                    </div>
                  ) : phaseModel.showAttackStats && phaseModel.attackStats ? (
                    <PlayerCombatAttackStatsTable stats={phaseModel.attackStats} />
                  ) : null}
                  {phaseModel.showAttackLocationSelector &&
                  !(selectedActionId === "feint_attack" && phaseKey === "phase1") ? (
                    <>
                      <PlayerCombatAttackTargetSelector
                        combatContext={phaseModel.phaseContext}
                        controlsDisabled={declarationControlsDisabled}
                        distanceLabel={
                          targetRoundParticipant
                            ? `Distance: ${distanceEdge?.distance ?? "—"}`
                            : undefined
                        }
                        onCombatContextChange={(combatContext) => {
                          markCombatDeclarationDraftDirty();
                          setPhaseCombatContextDrafts((current) =>
                            (selectedActionId === "feint_attack" ||
                              selectedActionId === "adjust_range_attack") &&
                            phaseKey === "phase2"
                              ? {
                                  phase1: {
                                    ...current.phase1,
                                    targetParticipantId: combatContext.targetParticipantId,
                                  },
                                  phase2: combatContext,
                                }
                              : { ...current, [phaseKey]: combatContext },
                          );
                        }}
                        readOnly={
                          (selectedActionId === "feint_attack" ||
                            selectedActionId === "adjust_range_attack") &&
                          phaseKey === "phase2"
                        }
                        targetOptions={targetOptions}
                      />
                      <PlayerCombatAttackLocationSelector
                        combatContext={phaseModel.phaseContext}
                        controlsDisabled={declarationControlsDisabled}
                        onCombatContextChange={(combatContext) => {
                          markCombatDeclarationDraftDirty();
                          setPhaseCombatContextDrafts((current) => ({
                            ...current,
                            [phaseKey]: combatContext,
                          }));
                        }}
                      />
                      <PlayerCombatAttackModeSelector
                        controlsDisabled={declarationControlsDisabled}
                        onChange={(attackModeId) => {
                          markCombatDeclarationDraftDirty();
                          setPhaseCombatContextDrafts((current) => ({
                            ...current,
                            [phaseKey]: {
                              ...current[phaseKey],
                              attackModeId,
                            },
                          }));
                        }}
                        options={phaseLoadoutSummary.attackModeOptions}
                        selectedAttackModeId={phaseLoadoutSummary.selectedAttackModeId}
                      />
                    </>
                  ) : null}
                  {phaseModel.showDefenseContext ? (
                    <>
                      {phaseModel.defenseStats ? (
                        <PlayerCombatDefenseStatsTable stats={phaseModel.defenseStats} />
                      ) : (
                        <div style={{ color: "#5e5a50", fontSize: "0.85rem" }}>
                          Defense information unavailable.
                        </div>
                      )}
                      <PlayerCombatParryContextPanel
                        combatContext={phaseModel.phaseContext}
                        controlsDisabled={declarationControlsDisabled}
                        mainHandItemLabel={phaseLoadoutSummary.mainHandParryItemLabel}
                        offHandItemLabel={phaseLoadoutSummary.offHandParryItemLabel}
                        onCombatContextChange={(combatContext) => {
                          markCombatDeclarationDraftDirty();
                          setPhaseCombatContextDrafts((current) => ({
                            ...current,
                            [phaseKey]: combatContext,
                          }));
                        }}
                      />
                    </>
                  ) : null}
                </PlayerCombatPhasePanel>
              );
            })}
          </div>

          <div style={playerCombatPanelRowStyle}>
            <PlayerCombatModifierPanel
              controlsDisabled={declarationControlsDisabled}
              readOnly
              rows={modifierRows}
            />
            <div style={{ display: "grid", gap: "0.75rem" }}>
              {showInitiativeContextPanel ? (
                <section style={panelStyle}>
                  <strong>Initiative</strong>
                  <div style={{ color: "#4f5f57", display: "grid", gap: "0.2rem" }}>
                    <div>Base initiative {initiativeCalculation.baseInitiative}</div>
                    <div>
                      Initiative modifiers {initiativeCalculation.rawModifierTotal >= 0 ? "+" : ""}
                      {initiativeCalculation.rawModifierTotal}
                    </div>
                    <div>
                      Effective before roll {initiativeCalculation.modifiedInitiative}
                      {initiativeCalculation.modifierAdjustment !== 0
                        ? ` (${initiativeCalculation.modifierAdjustment >= 0 ? "+" : ""}${initiativeCalculation.modifierAdjustment})`
                        : ""}
                    </div>
                    {currentInitiativeRollCounts ? (
                      <div>
                        Pending rolls: {currentInitiativeRollCounts.pending} of{" "}
                        {currentInitiativeRollCounts.total}
                      </div>
                    ) : null}
                    {selectedCurrentInitiative ? (
                      <div style={{ color: "#3f5f46" }}>
                        Rolled initiative {selectedCurrentInitiative.total}.
                      </div>
                    ) : null}
                  </div>
                </section>
              ) : null}
              {showPhaseCombatExperienceContextPanel ? (
                <section style={panelStyle}>
                  <strong>Phase Combat Experience</strong>
                  <div style={{ color: "#4f5f57", display: "grid", gap: "0.2rem" }}>
                    {selectedPhaseInitiativeChoice ? (
                      <div>Phase choice submitted. Waiting for GM commit.</div>
                    ) : (
                      <>
                        <div>
                          {selectedPhaseCombatExperienceRollRequired
                            ? "CE roll required — attacked while attacking."
                            : "No CE roll required — back-out available."}
                        </div>
                        <div>Effective CE {selectedCombatExperienceSkillTotal}</div>
                        {selectedPhaseCombatExperienceThreats.length > 0 ? (
                          <div>
                            Incoming attacker(s):{" "}
                            {selectedPhaseCombatExperienceThreats
                              .map((threat) => {
                                const attacker = combatRoundState?.participants.find(
                                  (participant) =>
                                    participant.participantId === threat.attackerParticipantId,
                                );

                                return attacker?.label ?? threat.attackerParticipantId;
                              })
                              .join(", ")}
                          </div>
                        ) : null}
                      </>
                    )}
                  </div>
                </section>
              ) : null}
              {showModifierReviewContextPanel ? (
                <section style={panelStyle}>
                  <strong>Modifier review</strong>
                  <div style={{ color: "#4f5f57" }}>
                    Review generated and manual modifiers before advancing.
                  </div>
                </section>
              ) : null}
              {showCombatStartExperienceContextPanel ? (
                <section style={panelStyle}>
                  <strong>Combat Experience</strong>
                  <div>{formatCombatExperienceStatus(selectedCombatExperienceResult)}</div>
                  <div>Skill total {selectedCombatExperienceSkillTotal}</div>
                  <div>Difficulty {selectedCombatExperienceDifficulty}</div>
                  {selectedCombatExperienceSkillLookup.warning ? (
                    <div style={{ color: "#7c2d12" }}>
                      {selectedCombatExperienceSkillLookup.warning}
                    </div>
                  ) : null}
                </section>
              ) : null}
              {selectedVisibleHealthRoll ? (
                <section style={panelStyle}>
                  <strong>Round-end health check</strong>
                  <div style={{ color: "#4f5f57", display: "grid", gap: "0.25rem" }}>
                    <div>
                      {selectedVisibleHealthRoll.status === "pending"
                        ? "Health check required"
                        : "Health check rolled"}
                    </div>
                    <div>
                      Reason:{" "}
                      {formatRoundEndHealthCheckReason({
                        damageLabel: selectedHealthRollDamageProposal?.label,
                        proposal: selectedVisibleHealthRoll,
                      })}
                    </div>
                    <div>
                      Health +{selectedVisibleHealthRoll.healthStat} vs difficulty{" "}
                      {selectedVisibleHealthRoll.difficulty}
                    </div>
                    {selectedVisibleHealthRoll.result ? (
                      <div style={{ color: "#3f5f46" }}>
                        Roll{" "}
                        {formatOpenEndedD20RollBreakdown({
                          dieResult: selectedVisibleHealthRoll.result.rollTotal,
                          openEndedD10s: selectedVisibleHealthRoll.result.openEndedD10s,
                          rollD20: selectedVisibleHealthRoll.result.rollD20,
                        })}{" "}
                        = {selectedVisibleHealthRoll.result.rollTotal}; final{" "}
                        {selectedVisibleHealthRoll.result.finalTotal}
                      </div>
                    ) : (
                      <div>Roll your Health check for round-end bleed review.</div>
                    )}
                    {formatRoundEndHealthCheckResultLine(selectedVisibleHealthRoll) ? (
                      <div>{formatRoundEndHealthCheckResultLine(selectedVisibleHealthRoll)}</div>
                    ) : null}
                    {selectedVisibleHealthRoll.warnings.map((warning, warningIndex) => (
                      <div
                        key={`player-health-roll-warning:${selectedVisibleHealthRoll.id}:${warningIndex}:${warning}`}
                        style={{ color: "#7c2d12" }}
                      >
                        {warning}
                      </div>
                    ))}
                  </div>
                </section>
              ) : null}
              {selectedDistanceControlProposal ? (
                <section style={panelStyle}>
                  <strong>Distance control</strong>
                  <div style={{ color: "#4f5f57", display: "grid", gap: "0.25rem" }}>
                    <div>
                      {selectedDistanceControlProposal.ownLabel} ↔{" "}
                      {selectedDistanceControlProposal.opponentLabel}
                    </div>
                    <div>
                      Current {selectedDistanceControlProposal.proposal.currentDistance} · your
                      preference:{" "}
                      {selectedDistanceControlProposal.ownSide.desiredDistance ?? "no preference"}
                    </div>
                    <div>
                      Dodge {selectedDistanceControlProposal.ownSide.dodgeSkillTotal} · Gen/Fatigue{" "}
                      {selectedDistanceControlProposal.ownSide.generalFatigueModifier}
                    </div>
                    <div>
                      {formatDistanceControlOpponentStatus({
                        opponentLabel: selectedDistanceControlProposal.opponentLabel,
                        opponentStatus: selectedDistanceControlProposal.opponentSide.status,
                        proposalStatus: selectedDistanceControlProposal.proposal.status,
                      })}
                    </div>
                    {selectedDistanceControlProgressText ? (
                      <div>{selectedDistanceControlProgressText}</div>
                    ) : null}
                    {selectedDistanceControlCommittedDistance !== undefined ? (
                      <div style={{ color: "#3f5f46" }}>
                        Distance control committed: distance{" "}
                        {selectedDistanceControlCommittedDistance} next round.
                      </div>
                    ) : null}
                  </div>
                </section>
              ) : null}
              <PlayerCombatActionButtonPanel
                buttonLabel={playerActionButtonLabel}
                disabled={playerActionButtonDisabled}
                onDeclareAction={() =>
                  void (selectedHealthCheckActionAvailable
                    ? rollHealthCheck()
                    : selectedAdjustDistanceProposal
                      ? advanceAdjustDistance()
                      : selectedFeintProposal
                        ? rollFeint()
                        : selectedDistanceControlActionAvailable
                          ? rollDistanceControl()
                          : selectedDoubleAttackDecisionAvailable
                            ? decideDoubleAttackPhase2()
                            : selectedPhaseAttackChoiceIsBackOut
                              ? backOutPhaseAttack()
                              : selectedCombatExperienceRequired
                                ? selectedCombatExperienceWindowOpen
                                  ? rollCombatExperience()
                                  : undefined
                                : selectedPhaseContinueAvailable
                                  ? continuePhaseAttack()
                                  : attackerPrivilegedAction?.kind
                                    ? rollAttackerPrivilegedCombatDie(attackerPrivilegedAction.kind)
                                    : currentParryAction
                                      ? rollCurrentParry()
                                      : currentAttackAction
                                        ? rollPhaseAttack()
                                        : currentInitiativePhase
                                          ? rollInitiative()
                                          : saveCombatContext())
                }
                preActionControls={
                  selectedAdjustDistanceProposal?.status === "awaiting_defender_response" ? (
                    <label style={{ display: "grid", gap: "0.25rem" }}>
                      <strong>Defender response</strong>
                      <select
                        disabled={savingCombatContext}
                        onChange={(event) =>
                          setAdjustDistanceResponse(event.target.value as "allow" | "oppose")
                        }
                        value={adjustDistanceResponse}
                      >
                        <option value="oppose">Oppose</option>
                        <option value="allow">Allow adjustment</option>
                      </select>
                    </label>
                  ) : (
                    selectedPhaseAttackChoiceControls
                  )
                }
                saving={savingCombatContext}
                statusText={declarationStatusText}
                validationMessage={
                  combatExperienceValidationMessage ??
                  declarationTargetValidationMessage ??
                  currentAttackSourceValidationMessage
                }
              />
            </div>
            <PlayerCombatActionResultPanel
              result={selectPlayerCombatActionResultPanel<PlayerCombatActionResultPanelView>({
                actionRoll: actionRollResult,
                adjustDistance: selectedAdjustDistanceResultPanel,
                attackerPrivileged: selectedAttackerPrivilegedResultPanel,
                combatExperience: selectedCombatExperienceResultPanel,
                currentAttack: selectedCurrentAttackResultPanel,
                currentPhaseResolution: selectedCurrentPhaseResolutionResultPanel,
                distanceControl: selectedDistanceControlResultPanel,
                healthCheck: selectedHealthCheckResultPanel,
                involvedDamage: selectedInvolvedDamageResultPanel,
                latestAttack: selectedLatestRelevantAttackResultPanel,
                phaseInitiativeChoice: selectedPhaseInitiativeChoiceResultPanel,
                relevantInitiative: selectedRelevantInitiativeResultPanel,
              })}
            />
          </div>
        </section>
      ) : (
        <div style={panelStyle}>
          This account does not currently have an accessible participant to act for in this
          scenario.
        </div>
      )}

      {!historyInspection ? (
        <section style={{ display: "grid", gap: "1rem" }}>
          {controlledEquipmentDiagnostic ? (
            <div role="alert" style={panelStyle}>
              {controlledEquipmentDiagnostic}
            </div>
          ) : null}
          {displayedParticipant ? (
            hasMountedLoadout ? (
              <EquipmentLoadoutModule mode="readonly" model={loadoutModel} />
            ) : (
              <div style={panelStyle}>
                Character loadout snapshot is not available for this participant yet.
              </div>
            )
          ) : (
            <div style={panelStyle}>No accessible participant is available.</div>
          )}
        </section>
      ) : null}
    </section>
  );
}
