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
  type CombatRoundPhaseResolutionResult,
  type CombatRoundEndHealthRollProposal,
  type CombatRoundStep,
  type CombatDistance,
  characterBuildSchema,
  canBackOutCombatRoundPhaseAttack,
  formatOpenEndedD20RollBreakdown,
  getCombatRoundArmorCriticalModifierForDamageResult,
  getCombatRoundAttackResultById,
  getCombatRoundCombatExperienceDifficulty,
  getCombatRoundEffectiveCriticalRoll,
  getCombatRoundEffectiveDamageResult,
  getCombatRoundPhaseInitiativeChoice,
  getCombatRoundPhaseAttackBackOutOpportunity,
  getCombatRoundPhaseCombatExperienceRequirement,
  getCombatRoundRequiredCombatExperienceTrigger,
  getDistanceEdgeBetweenParticipantAliases,
  getCombatDistanceParticipantAliases,
  getMergedCombatDbParryModifierTotal,
  getCombatRoundResolutionPhaseForStep,
  getCombatRoundStepForCursorStep,
  getHitLocationFullLabel,
  getPlayerCombatCurrentRollAction,
  getParticipantCombatExperienceSkillTotalLookup,
  getWeaponPreferredDistances,
  hasScenarioParticipantCombatDeclarationForEncounterRound,
  initializeCombatRoundState,
  lookupCombatCriticalModifier,
  resolveEncounterParticipantByRollParticipantId,
  validateCombatDeclarationTargets,
  type EncounterSession,
  type ScenarioParticipantCombatContext,
  type ScenarioParticipant,
  type ScenarioPlayerProjection,
  type ScenarioPlayerVisibleParticipant,
  type MovementIntent,
  type WeaponTemplate,
} from "@glantri/domain";

import {
  buildCurrentActionPresentation,
  buildCombatStepResultPresentation,
  buildProjectedCombatTrackerModel,
  CombatLog,
  CombatStepResultList,
  CombatTracker,
  getProjectedCombatHistoryCellEvents,
  getCombatProgressionPresentationTasks,
  isCombatViewRevisionAtLeast,
  isCombatViewRevisionUnchanged,
  PlayerCombatHistoryInspector,
  resolveProjectedCombatHistoryPanelSnapshot,
  createDefaultCombatLogSelection,
  reconcileCombatLogSelection,
  resolveCombatTaskCommandContext,
  selectCombatLogEvent,
  type CombatHistoryInspectionSelection,
  type CombatLogEventSelection,
  type CombatLogPresentationSelection,
  type CurrentActionCommandDescriptor,
} from "@/features/combat-history";

import {
  buildEquipmentLoadoutModuleModel,
  EquipmentLoadoutModule,
} from "@/features/equipment/loadoutModule";
import {
  buildPlayerCombatModifierRows,
  PlayerCombatAttackLocationSelector,
  PlayerCombatAttackModeSelector,
  PlayerCombatAttackStatsTable,
  PlayerCombatAttackTargetSelector,
  PlayerCombatActionButtonPanel,
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
  buildCombatParticipantCandidates,
  type CombatParticipantRosterEntry,
} from "@/features/player-combat/combatParticipantCandidates";
import {
  applyDefaultPlayerCombatPhaseContext,
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
import type { EquipmentFeatureState } from "@/features/equipment/types";
import { useSessionUser } from "@/lib/auth/SessionUserContext";
import { buildCharacterSheetSummary, type CombatAllocationState } from "@glantri/rules-engine";
import {
  createEmptyPlayerEncounterCombatContext,
  evaluatePlayerEncounterParryLegality,
  getPlayerEncounterAccessibleParticipants,
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
  resolveCurrentCombatPhaseDamageOnServer,
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
import { buildPlayerCombatAttackModifierRequest } from "@/lib/campaigns/playerCombatAttackRequest";
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

type _PlayerCombatActionResultSectionView = {
  calculationLines: readonly string[];
  resultLine?: string;
  title: string;
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

function _formatCombatAttackResultLine(input: {
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

function _getLatestPlayerVisibleDamageResolution(input: {
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

function _formatCombatPhaseResolutionResultLines(input: {
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

  const attackLine = `${_formatCombatAttackResultLine({
    participantId: input.participantId,
    result: input.attackResult,
  })} · Result: ${input.attackResult.tableResult}`;
  const sections: _PlayerCombatActionResultSectionView[] = [
    {
      calculationLines: [
        _formatCombatAttackResultLine({
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

function _formatPlayerCombatInitiativeRank(input: {
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
  const [combatActionError, setCombatActionError] = useState<string>();
  const [loading, setLoading] = useState(true);
  const [projection, setProjection] = useState<ScenarioPlayerProjection>();
  const [encounterSession, setEncounterSession] = useState<EncounterSession>();
  const [combatHistory, setCombatHistory] = useState<CombatHistoryProjection>();
  const [combatLogSelection, setCombatLogSelection] = useState<CombatLogPresentationSelection>();
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
        setCombatActionError(undefined);
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
    setCombatHistory(undefined);
    setCombatLogSelection(undefined);
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
      resolveEncounterParticipantByRollParticipantId({
        participantId: selectedParticipant?.id ?? selectedParticipant?.characterId,
        participants: encounterSession?.participants ?? [],
      }),
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
  const playerCombatLog = combatHistory?.combatLog;
  useEffect(() => {
    if (!playerCombatLog) {
      setCombatLogSelection(undefined);
      return;
    }
    setCombatLogSelection((current) =>
      current
        ? reconcileCombatLogSelection({ current, projection: playerCombatLog })
        : createDefaultCombatLogSelection(playerCombatLog),
    );
  }, [playerCombatLog]);
  const handleCombatLogSelection = useCallback(
    (selection: CombatLogEventSelection) => {
      if (!playerCombatLog) return;
      setCombatLogSelection(
        selectCombatLogEvent({ eventId: selection.combatLogEventId, projection: playerCombatLog }),
      );
    },
    [playerCombatLog],
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
  const currentActionPresentation = useMemo(
    () =>
      buildCurrentActionPresentation({
        encounterId: encounterId ?? "",
        encounterRevision: combatHistory?.sourceUpdatedAt,
        progression: combatHistory?.progression,
        viewer: {
          controlledParticipantIds: new Set(
            selectedRoundParticipant ? [selectedRoundParticipant.participantId] : [],
          ),
          kind: "player",
          mayProxy: isGameMaster,
        },
      }),
    [
      combatHistory?.progression,
      combatHistory?.sourceUpdatedAt,
      encounterId,
      isGameMaster,
      selectedRoundParticipant,
    ],
  );
  const currentStepResultPresentation = useMemo(
    () =>
      playerCombatLog &&
      combatHistory?.sourceUpdatedAt &&
      combatHistory.progression &&
      selectedRoundParticipant
        ? buildCombatStepResultPresentation({
            boundary: combatHistory.progression.boundary.kind,
            combatLog: playerCombatLog,
            encounterId: encounterId ?? playerCombatLog.encounterId,
            encounterRevision: combatHistory.sourceUpdatedAt,
            events: combatHistory.activeRound.events,
            participantId: selectedRoundParticipant.participantId,
            roundNumber: combatHistory.activeRound.roundNumber,
            viewer: { kind: "player" },
          })
        : undefined,
    [
      combatHistory?.activeRound.events,
      combatHistory?.activeRound.roundNumber,
      combatHistory?.progression,
      combatHistory?.sourceUpdatedAt,
      encounterId,
      playerCombatLog,
      selectedRoundParticipant,
    ],
  );
  const selectedDeclarationProgressionTask = selectedProgressionTasks.find(
    (task) => task.kind === "submit_declaration",
  );
  const selectedDistanceControlProgressionTask = selectedProgressionTasks.find(
    (task) => task.kind === "distance_roll" && task.state === "executable",
  );
  const selectedHealthProgressionTask = selectedProgressionTasks.find(
    (task) => task.kind === "health_review" && task.state === "executable",
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
  const selectedDistanceControlProposal = useMemo(() => {
    const participantId = selectedRoundParticipant?.participantId;
    const proposals = combatRoundState?.roundEndReview?.proposedDistances ?? [];

    if (
      !participantId ||
      combatRoundState?.currentStep !== "round_summary" ||
      !selectedDistanceControlProgressionTask
    ) {
      return undefined;
    }

    const proposal = proposals.find(
      (candidate) =>
        candidate.accepted &&
        candidate.requiresContest &&
        ((candidate.participantAId === participantId &&
          candidate.participantA.status === "pending") ||
          (candidate.participantBId === participantId &&
            candidate.participantB.status === "pending")),
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
    selectedDistanceControlProgressionTask,
  ]);
  const selectedRoundEndReview =
    combatRoundState?.currentStep === "round_summary" && selectedRoundParticipant
      ? combatRoundState.roundEndReview?.participantReviews[selectedRoundParticipant.participantId]
      : undefined;
  const selectedPendingHealthRoll =
    combatRoundState?.currentStep === "round_summary" &&
    selectedRoundParticipant &&
    selectedHealthProgressionTask
      ? selectedRoundEndReview?.proposedHealthRolls.find(
          (proposal) => proposal.accepted && proposal.status === "pending",
        )
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
  const currentStepIsModifierReview =
    currentCombatStep === "review_action_modifiers" ||
    currentCombatStep === "review_phase_2_modifiers";
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
  const projectedAdjustDistanceTask = selectedProgressionTasks.find((task) =>
    [
      "adjust_distance_response",
      "adjust_distance_adjustment",
      "adjust_distance_attacker_roll",
      "adjust_distance_defender_roll",
      "adjust_distance_commit",
    ].includes(task.kind),
  );
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

  async function saveCombatContext(candidate?: CurrentActionCommandDescriptor) {
    const descriptor = resolveCombatTaskCommandContext({
      descriptor: candidate,
      expectedCommandTypes: ["declare_action"],
      presentation: currentActionPresentation,
      requiredFields: ["executionGroupId", "expectedRevision", "participantId", "taskId"],
    });
    if (!descriptor) {
      setError("Combat state changed. Review the current action before continuing.");
      return;
    }
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
            fallbackParticipantIds: targetOptions.map((option) => option.id),
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
        executionGroupId: descriptor.executionGroupId!,
        expectedRevision: descriptor.expectedRevision,
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
        scenarioParticipantId: descriptor.participantId!,
        secondaryActionId: selectedSecondaryActionId || undefined,
        taskId: descriptor.taskId,
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

  async function rollFeint(descriptor: CurrentActionCommandDescriptor) {
    if (
      readOnlyInspection ||
      !selectedParticipant ||
      !encounterId ||
      !descriptor.proposalId ||
      !descriptor.participantId
    ) {
      return;
    }
    setSavingCombatContext(true);
    try {
      const { encounter } = await rollCombatFeintOnServer({
        encounterId,
        executionGroupId: descriptor.executionGroupId!,
        expectedRevision: descriptor.expectedRevision,
        proposalId: descriptor.proposalId,
        scenarioParticipantId: descriptor.participantId,
        taskId: descriptor.taskId,
      });
      acceptEncounterSession(encounter);
      setError(undefined);
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Unable to roll the feint.");
    } finally {
      setSavingCombatContext(false);
    }
  }

  async function advanceAdjustDistance(descriptor: CurrentActionCommandDescriptor) {
    if (
      readOnlyInspection ||
      !selectedParticipant ||
      !encounterId ||
      !descriptor.proposalId ||
      !descriptor.participantId
    )
      return;
    setSavingCombatContext(true);
    try {
      const encounter =
        descriptor.commandType === "respond_adjust_distance"
          ? await respondCombatAdjustDistanceOnServer({
              encounterId,
              executionGroupId: descriptor.executionGroupId!,
              expectedRevision: descriptor.expectedRevision,
              proposalId: descriptor.proposalId,
              response: adjustDistanceResponse,
              scenarioParticipantId: descriptor.participantId,
              taskId: descriptor.taskId,
            })
          : descriptor.commandType === "roll_adjust_distance"
            ? await rollCombatAdjustDistanceOnServer({
                encounterId,
                executionGroupId: descriptor.executionGroupId!,
                expectedRevision: descriptor.expectedRevision,
                proposalId: descriptor.proposalId,
                scenarioParticipantId: descriptor.participantId,
                taskId: descriptor.taskId,
              })
            : undefined;
      if (!encounter) {
        setError("Combat state changed. Review the current action before continuing.");
        return;
      }
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

  async function rollInitiative(descriptor: CurrentActionCommandDescriptor) {
    if (readOnlyInspection) {
      return;
    }

    if (!selectedParticipant || !encounterId || !descriptor.participantId) {
      return;
    }

    setSavingCombatContext(true);

    try {
      const { encounter } = await rollCombatInitiativeOnServer({
        encounterId,
        executionGroupId: descriptor.executionGroupId!,
        expectedRevision: descriptor.expectedRevision,
        initiativeBase: initiativeCalculation.baseInitiative,
        initiativeModifierAdjustment: initiativeCalculation.modifierAdjustment,
        scenarioParticipantId: descriptor.participantId,
        taskId: descriptor.taskId,
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

  async function rollCombatExperience(descriptor: CurrentActionCommandDescriptor) {
    if (readOnlyInspection) {
      return;
    }

    if (!selectedParticipant || !encounterId || !descriptor.participantId) {
      return;
    }

    setSavingCombatContext(true);

    try {
      const { encounter, participant } = await rollCombatExperienceOnServer({
        encounterId,
        executionGroupId: descriptor.executionGroupId!,
        expectedRevision: descriptor.expectedRevision,
        opportunityId: descriptor.opportunityId,
        phase: descriptor.phase,
        scenarioParticipantId: descriptor.participantId,
        taskId: descriptor.taskId,
      });

      setSelectableParticipants((current) =>
        current.map((entry) => (entry.id === participant.id ? participant : entry)),
      );
      acceptEncounterSession(encounter);
      setError(undefined);
      setCombatActionError(undefined);
    } catch (caughtError) {
      setCombatActionError(
        caughtError instanceof Error ? caughtError.message : "Unable to roll Combat Experience.",
      );
    } finally {
      setSavingCombatContext(false);
    }
  }

  async function rollDistanceControl(descriptor: CurrentActionCommandDescriptor) {
    if (
      readOnlyInspection ||
      !selectedParticipant ||
      !encounterId ||
      !descriptor.proposalId ||
      !descriptor.participantId
    ) {
      return;
    }

    setSavingCombatContext(true);

    try {
      const { encounter, participant } = await rollRoundEndDistanceControlOnServer({
        distanceProposalId: descriptor.proposalId,
        encounterId,
        executionGroupId: descriptor.executionGroupId!,
        expectedRevision: descriptor.expectedRevision,
        opponentParticipantId: descriptor.opponentParticipantId!,
        pairId: descriptor.pairId!,
        scenarioParticipantId: descriptor.participantId,
        taskId: descriptor.taskId,
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

  async function rollHealthCheck(descriptor: CurrentActionCommandDescriptor) {
    if (
      readOnlyInspection ||
      !selectedParticipant ||
      !encounterId ||
      !descriptor.healthRollId ||
      !descriptor.participantId
    ) {
      return;
    }

    setSavingCombatContext(true);

    try {
      const { encounter, participant } = await rollRoundEndHealthCheckOnServer({
        encounterId,
        executionGroupId: descriptor.executionGroupId!,
        expectedRevision: descriptor.expectedRevision,
        healthRollId: descriptor.healthRollId,
        scenarioParticipantId: descriptor.participantId,
        taskId: descriptor.taskId,
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

  async function backOutPhaseAttack(descriptor: CurrentActionCommandDescriptor) {
    if (readOnlyInspection) {
      return;
    }

    if (!selectedParticipant || !encounterId || !descriptor.participantId || !descriptor.phase) {
      return;
    }

    setSavingCombatContext(true);

    try {
      const { encounter, participant } = await backOutPhaseAttackOnServer({
        encounterId,
        executionGroupId: descriptor.executionGroupId!,
        expectedRevision: descriptor.expectedRevision,
        phase: descriptor.phase,
        scenarioParticipantId: descriptor.participantId,
        taskId: descriptor.taskId,
      });

      setSelectableParticipants((current) =>
        current.map((entry) => (entry.id === participant.id ? participant : entry)),
      );
      acceptEncounterSession(encounter);
      setError(undefined);
    } catch (caughtError) {
      setError(
        caughtError instanceof Error ? caughtError.message : "Unable to back out of attack.",
      );
    } finally {
      setSavingCombatContext(false);
    }
  }

  async function continuePhaseAttack(descriptor: CurrentActionCommandDescriptor) {
    if (readOnlyInspection) {
      return;
    }

    if (!selectedParticipant || !encounterId || !descriptor.participantId || !descriptor.phase) {
      return;
    }

    setSavingCombatContext(true);

    try {
      const { encounter, participant } = await continuePhaseAttackOnServer({
        encounterId,
        executionGroupId: descriptor.executionGroupId!,
        expectedRevision: descriptor.expectedRevision,
        phase: descriptor.phase,
        scenarioParticipantId: descriptor.participantId,
        taskId: descriptor.taskId,
      });

      setSelectableParticipants((current) =>
        current.map((entry) => (entry.id === participant.id ? participant : entry)),
      );
      acceptEncounterSession(encounter);
      setError(undefined);
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Unable to continue attack.");
    } finally {
      setSavingCombatContext(false);
    }
  }

  async function decideDoubleAttackPhase2(descriptor: CurrentActionCommandDescriptor) {
    if (readOnlyInspection || !selectedParticipant || !encounterId || !descriptor.participantId)
      return;
    setSavingCombatContext(true);
    try {
      const { encounter, participant } = await decideDoubleAttackPhase2OnServer({
        decision: doubleAttackPhase2Decision,
        encounterId,
        executionGroupId: descriptor.executionGroupId!,
        expectedRevision: descriptor.expectedRevision,
        opportunityId: descriptor.opportunityId!,
        scenarioParticipantId: descriptor.participantId,
        taskId: descriptor.taskId,
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

  async function rollPhaseAttack(descriptor: CurrentActionCommandDescriptor) {
    const attackPhase = descriptor.phase;
    if (
      readOnlyInspection ||
      !selectedParticipant ||
      !encounterId ||
      !attackPhase ||
      !descriptor.participantId ||
      !descriptor.opponentParticipantId ||
      !descriptor.opportunityId ||
      !descriptor.actionId ||
      !descriptor.attackIndex ||
      !descriptor.attackModeId ||
      !descriptor.declarationId ||
      !descriptor.weaponSourceId ||
      !descriptor.weaponSourceSlot ||
      !descriptor.weaponTemplateId ||
      projectedRollTask?.id !== descriptor.taskId ||
      projectedRollTask.identity.opportunityId !== descriptor.opportunityId
    ) {
      return;
    }

    const phaseAttackStats = phaseCombatLoadoutSummaries[attackPhase].attackStats;
    const targetIdentity = resolveCanonicalCombatTargetIdentity({
      encounterParticipants: encounterSession?.participants ?? [],
      fallbackParticipantIds: targetOptions.map((option) => option.id),
      targetParticipantId: descriptor.opponentParticipantId,
    });

    if (!phaseAttackStats) {
      setError(`No ${attackPhase === "phase1" ? "phase 1" : "phase 2"} attack source available.`);
      return;
    }

    if (!targetIdentity) {
      setError(
        selectedRoundDeclaration?.actionId === "feint_attack" && attackPhase === "phase2"
          ? "The Feint target is no longer in this encounter."
          : "Select an attack target before rolling.",
      );
      return;
    }

    const modifierRequest = buildPlayerCombatAttackModifierRequest({
      attackerParticipantId: descriptor.participantId,
      defenderParticipantId: targetIdentity.encounterParticipantId,
      encounterId,
      encounterRevision: descriptor.expectedRevision,
      phase: attackPhase,
      task: projectedRollTask,
      validation: combatHistory?.currentAttackModifierValidation,
    });

    if (!modifierRequest) {
      setError("Combat modifiers changed. Refresh combat before rolling.");
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
        actionId: descriptor.actionId,
        attackIndex: descriptor.attackIndex,
        attackModeId: descriptor.attackModeId,
        attackerModifierFingerprint: modifierRequest.attackerModifierFingerprint,
        defenderDbParryRaw: modifierRequest.defenderDbParryRaw,
        defenderModifierFingerprint: modifierRequest.defenderModifierFingerprint,
        defenderParticipantId: targetIdentity.encounterParticipantId,
        declarationId: descriptor.declarationId,
        encounterId,
        executionGroupId: descriptor.executionGroupId!,
        expectedRevision: modifierRequest.expectedRevision,
        modifierValidationTaskId: modifierRequest.modifierValidationTaskId,
        ob,
        obSkillRaw: modifierRequest.obSkillRaw,
        opportunityId: descriptor.opportunityId,
        phase: attackPhase,
        scenarioParticipantId: descriptor.participantId,
        taskId: descriptor.taskId,
        weaponInstanceId: descriptor.weaponInstanceId,
        weaponSourceId: descriptor.weaponSourceId,
        weaponSourceSlot: descriptor.weaponSourceSlot,
        weaponTemplateId: descriptor.weaponTemplateId,
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

  async function rollCurrentParry(descriptor: CurrentActionCommandDescriptor) {
    const attackResult =
      combatRoundState && descriptor.attackResultId
        ? getCombatRoundAttackResultById({
            attackResultId: descriptor.attackResultId,
            state: combatRoundState,
          })
        : undefined;
    if (
      readOnlyInspection ||
      !selectedParticipant ||
      !encounterId ||
      descriptor.commandType !== "roll_parry" ||
      !descriptor.attackResultId ||
      !descriptor.executionGroupId ||
      !descriptor.participantId ||
      !descriptor.phase ||
      !attackResult ||
      selectedRoundParticipant?.participantId !== descriptor.participantId ||
      attackResult.defenderParticipantId !== descriptor.participantId ||
      attackResult.attackerParticipantId !== descriptor.opponentParticipantId ||
      attackResult.phase !== descriptor.phase
    ) {
      return;
    }

    if (currentParryBase === undefined) {
      setError("No parry source is available.");
      return;
    }

    setSavingCombatContext(true);

    try {
      const encounter = await rollCombatParryOnServer({
        attackResultId: descriptor.attackResultId,
        attackerParticipantId: descriptor.opponentParticipantId,
        dbParryRaw: getMergedCombatDbParryModifierTotal({
          combatContext: selectedParticipant.state.combat.combatContext,
          phase: descriptor.phase,
        }),
        defenderParticipantId: descriptor.participantId,
        encounterId,
        executionGroupId: descriptor.executionGroupId,
        expectedRevision: descriptor.expectedRevision,
        opportunityId: descriptor.opportunityId,
        parryBase: currentParryBase,
        parrySourceLabel: currentParryDefenseStats?.sourceName,
        phase: descriptor.phase,
        scenarioParticipantId: descriptor.participantId,
        taskId: descriptor.taskId,
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

  async function rollAttackerPrivilegedCombatDie(
    kind: "critical" | "hitLocation",
    candidate?: CurrentActionCommandDescriptor,
  ) {
    const descriptor = resolveCombatTaskCommandContext({
      descriptor: candidate,
      expectedCommandTypes: [kind === "hitLocation" ? "roll_hit_location" : "roll_critical"],
      presentation: currentActionPresentation,
      requiredFields: [
        "attackResultId",
        "attackerParticipantId",
        "defenderParticipantId",
        "executionGroupId",
        "expectedRevision",
        "hitLocationResultId",
        "participantId",
        "phase",
        "taskId",
        ...(kind === "critical" ? (["criticalResultId"] as const) : []),
      ],
    });
    if (readOnlyInspection || !selectedParticipant || !encounterId || !descriptor) {
      setError("Combat state changed. Review the current action before continuing.");
      return;
    }
    if (selectedRoundParticipant?.participantId !== descriptor.participantId) {
      setError("This combat task belongs to another participant.");
      return;
    }

    setSavingCombatContext(true);

    try {
      const encounter =
        kind === "hitLocation"
          ? await rollCombatHitLocationOnServer({
              attackResultId: descriptor.attackResultId!,
              attackerParticipantId: descriptor.attackerParticipantId!,
              defenderParticipantId: descriptor.defenderParticipantId!,
              encounterId,
              executionGroupId: descriptor.executionGroupId!,
              expectedRevision: descriptor.expectedRevision,
              hitLocationResultId: descriptor.hitLocationResultId!,
              opportunityId: descriptor.opportunityId,
              phase: descriptor.phase!,
              scenarioParticipantId: descriptor.participantId!,
              taskId: descriptor.taskId,
            })
          : await rollCombatCriticalOnServer({
              attackResultId: descriptor.attackResultId!,
              attackerParticipantId: descriptor.attackerParticipantId!,
              criticalResultId: descriptor.criticalResultId!,
              defenderParticipantId: descriptor.defenderParticipantId!,
              encounterId,
              executionGroupId: descriptor.executionGroupId!,
              expectedRevision: descriptor.expectedRevision,
              hitLocationResultId: descriptor.hitLocationResultId!,
              opportunityId: descriptor.opportunityId,
              phase: descriptor.phase!,
              scenarioParticipantId: descriptor.participantId!,
              taskId: descriptor.taskId,
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

  async function rollGrazeDamage(candidate?: CurrentActionCommandDescriptor) {
    const descriptor = resolveCombatTaskCommandContext({
      descriptor: candidate,
      expectedCommandTypes: ["resolve_damage"],
      presentation: currentActionPresentation,
      requiredFields: [
        "attackResultId",
        "attackerParticipantId",
        "criticalResultId",
        "damageRollExpression",
        "damageReviewId",
        "defenderParticipantId",
        "executionGroupId",
        "expectedRevision",
        "hitLocationResultId",
        "participantId",
        "phase",
        "taskId",
      ],
    });
    if (
      readOnlyInspection ||
      !selectedParticipant ||
      !encounterId ||
      !descriptor ||
      selectedRoundParticipant?.participantId !== descriptor.participantId
    ) {
      setError("Combat state changed. Review the current action before continuing.");
      return;
    }

    setSavingCombatContext(true);
    try {
      const { encounter } = await resolveCurrentCombatPhaseDamageOnServer({
        attackResultId: descriptor.attackResultId!,
        attackerParticipantId: descriptor.attackerParticipantId!,
        commandType: "resolve_damage",
        criticalResultId: descriptor.criticalResultId!,
        damageRollExpression: descriptor.damageRollExpression,
        damageReviewId: descriptor.damageReviewId!,
        defenderParticipantId: descriptor.defenderParticipantId!,
        encounterId,
        executionGroupId: descriptor.executionGroupId!,
        expectedRevision: descriptor.expectedRevision,
        hitLocationResultId: descriptor.hitLocationResultId!,
        opportunityId: descriptor.opportunityId,
        phase: descriptor.phase!,
        scenarioParticipantId: descriptor.participantId,
        taskId: descriptor.taskId,
      });
      acceptEncounterSession(encounter);
      setError(undefined);
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Unable to roll graze damage.");
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
    const candidateRoster: { participants: readonly CombatParticipantRosterEntry[] } = {
      participants: encounterSession?.participants.length
        ? encounterSession.participants
        : playerPerspectiveVisibleParticipants.map((participant) => ({
            id: participant.id,
            label: participant.displayName,
            scenarioParticipantId: participant.id,
          })),
    };
    const visibleParticipantIds = new Set(
      (isGameMaster
        ? candidateRoster.participants.flatMap((participant) =>
            getCombatDistanceParticipantAliases(participant),
          )
        : playerPerspectiveVisibleParticipants.flatMap((participant) => [participant.id])) ?? [],
    );
    const allowedParticipantIds =
      encounterScenarioParticipantIds.length > 0
        ? encounterScenarioParticipantIds
        : candidateRoster.participants.flatMap((participant) =>
            getCombatDistanceParticipantAliases(participant),
          );
    const purpose =
      selectedActionId === "feint_attack" || selectedActionId === "adjust_range_attack"
        ? "maneuver_target"
        : "attack_target";
    return buildCombatParticipantCandidates({
      actingParticipantId: selectedParticipant?.id,
      allowedParticipantIds,
      encounter: candidateRoster,
      purpose,
      visibleParticipantIds,
    })
      .filter((candidate) => candidate.selectable)
      .map(({ displayName, participantId }) => ({ displayName, id: participantId }));
  }, [
    encounterScenarioParticipantIds,
    encounterSession,
    isGameMaster,
    playerPerspectiveVisibleParticipants,
    selectedParticipant?.id,
    selectedActionId,
  ]);
  const normalizedFeintPhaseContexts = useMemo(() => {
    if (selectedActionId !== "feint_attack") return phaseCombatContextDrafts;
    const resolution = resolveCombatFeintDeclarationRequestTarget({
      encounterParticipants: encounterSession?.participants ?? [],
      fallbackParticipantIds: targetOptions.map((option) => option.id),
      phaseContexts: phaseCombatContextDrafts,
    });
    return resolution.ok ? resolution.phaseContexts : phaseCombatContextDrafts;
  }, [encounterSession?.participants, phaseCombatContextDrafts, selectedActionId, targetOptions]);
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
  const currentPhaseChoicePhase =
    currentInitiativePhase ??
    (currentActionPresentation?.taskKind === "combat_experience"
      ? currentActionPresentation.phase
      : undefined);
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
  const currentAttackPhaseContext = currentAttackPhase
    ? (selectedRoundDeclaration?.phaseContexts?.[currentAttackPhase] ??
      phaseCombatContextDrafts[currentAttackPhase])
    : undefined;
  const currentAttackTargetParticipantId = currentAttackPhaseContext?.targetParticipantId;
  const currentResolutionPhase = getCombatRoundResolutionPhaseForStep(currentCombatStep);
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
  const currentInitiativeRollCounts =
    currentInitiativePhase && combatRoundState
      ? {
          pending: combatRoundState.participants.filter(
            (participant) => participant.initiatives[currentInitiativePhase] === undefined,
          ).length,
          total: combatRoundState.participants.length,
        }
      : undefined;
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
    selectedProgressionTasks.some(
      (task) =>
        task.kind === "double_attack_decision" &&
        task.state === "executable" &&
        task.owner?.kind === "combatant" &&
        task.owner.participantId === selectedRoundParticipant?.participantId,
    ) &&
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
  const combatExperienceValidationMessage: string | undefined = undefined;
  const currentActionDomainValidationDisabled =
    controlsDisabled ||
    savingCombatContext ||
    !displayedParticipant ||
    Boolean(declarationTargetValidationMessage || currentAttackSourceValidationMessage) ||
    (currentActionPresentation?.taskKind === "submit_declaration" &&
      (!hasMeaningfulDeclaration || !targetValidation.valid));
  function invokePlayerCurrentAction(candidate?: CurrentActionCommandDescriptor) {
    const descriptor = resolveCombatTaskCommandContext({
      descriptor: candidate,
      expectedCommandTypes: candidate ? [candidate.commandType] : [],
      presentation: currentActionPresentation,
      requiredFields: ["executionGroupId", "expectedRevision", "taskId"],
    });
    if (!descriptor) {
      setError("Combat state changed. Review the current action before continuing.");
      return;
    }

    switch (descriptor.commandType) {
      case "roll_round_end_health_check":
        void rollHealthCheck(descriptor);
        return;
      case "respond_adjust_distance":
      case "roll_adjust_distance":
        void advanceAdjustDistance(descriptor);
        return;
      case "roll_feint":
        void rollFeint(descriptor);
        return;
      case "roll_round_end_distance_control":
        void rollDistanceControl(descriptor);
        return;
      case "decide_double_attack_phase2":
        void decideDoubleAttackPhase2(descriptor);
        return;
      case "submit_phase_initiative_choice":
        void (selectedPhaseAttackChoiceIsBackOut
          ? backOutPhaseAttack(descriptor)
          : selectedPhaseCombatExperienceRequirement
            ? rollCombatExperience(descriptor)
            : continuePhaseAttack(descriptor));
        return;
      case "roll_combat_experience":
        void rollCombatExperience(descriptor);
        return;
      case "roll_hit_location":
        void rollAttackerPrivilegedCombatDie("hitLocation", descriptor);
        return;
      case "roll_critical":
        void rollAttackerPrivilegedCombatDie("critical", descriptor);
        return;
      case "resolve_damage":
        void rollGrazeDamage(descriptor);
        return;
      case "roll_parry":
        void rollCurrentParry(descriptor);
        return;
      case "roll_attack":
        void rollPhaseAttack(descriptor);
        return;
      case "roll_initiative_phase1":
      case "roll_initiative_phase2":
        void rollInitiative(descriptor);
        return;
      case "declare_action":
        void saveCombatContext(descriptor);
        return;
      default:
        setError("This current action is waiting for the GM.");
    }
  }
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

      {combatActionError ? <div style={panelStyle}>{combatActionError}</div> : null}

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

      {playerCombatLog ? (
        <CombatLog
          events={playerCombatLog.events}
          onSelect={handleCombatLogSelection}
          selectedCombatLogEventId={combatLogSelection?.selectedCombatLogEventId}
          selectedPresentationTargetId={combatLogSelection?.selectedPresentationTargetId}
        />
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
              declarationRecorded={selectedParticipantStoredDeclarationThisRound}
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
                disabled={currentActionDomainValidationDisabled}
                onDeclareAction={invokePlayerCurrentAction}
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
                presentation={currentActionPresentation}
                validationMessage={
                  combatExperienceValidationMessage ??
                  declarationTargetValidationMessage ??
                  currentAttackSourceValidationMessage
                }
              />
            </div>
            {currentStepResultPresentation ? (
              <CombatStepResultList presentation={currentStepResultPresentation} />
            ) : null}
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
