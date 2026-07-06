"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import {
  type CombatRoundAttackDistanceModifierDetail,
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
  getCombatRoundAttackDistanceModifierDetail,
  getCombatRoundAttackResultById,
  getCombatRoundDamageSubstate,
  getCombatRoundDisplayIncomingAttackResultForParticipantPhase,
  getCombatRoundCombatExperienceDifficulty,
  getCombatRoundPhaseInitiativeChoice,
  getCombatRoundOutgoingAttackResultForParticipantPhase,
  getCombatRoundPhaseAttackBackOutOpportunity,
  getCombatRoundPhaseCombatExperienceRequirement,
  getCombatRoundEndHealthCheckPendingRolls,
  getCombatRoundPhaseResolutionResultForAttack,
  getCombatRoundRequiredCombatExperienceTrigger,
  getDistanceEdgeBetweenParticipantAliases,
  getCombatDistanceParticipantAliases,
  getCombatRoundInitiativeRanks,
  getCombatRoundInitiativeTotal,
  getCombatRoundModifierPhaseForStep,
  getCombatRoundResolutionPhaseForStep,
  getPlayerCombatCurrentRollAction,
  getParticipantCombatExperienceSkillTotalLookup,
  getWeaponPreferredDistances,
  hasScenarioParticipantCombatDeclarationForEncounterRound,
  initializeCombatRoundState,
  isCombatRoundCombatExperienceWindowOpen,
  isCombatRoundPhaseInitiativeComplete,
  validateCombatDeclarationTargets,
  type EncounterSession,
  type ScenarioCombatModifierBucket,
  type ScenarioCombatModifierEntry,
  type ScenarioParticipantCombatContext,
  type ScenarioParticipant,
  type ScenarioPlayerProjection,
  type MovementIntent,
  type WeaponTemplate,
  buildCombatRoundPhaseResolutionResult,
} from "@glantri/domain";

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
} from "@/features/player-combat/PlayerCombatPanels";
import {
  applyDefaultPlayerCombatPhaseContext,
  buildPlayerCombatDefenseStats,
  buildPlayerCombatLoadoutSummary,
  buildPlayerCombatPhasePanelModel,
  isEquipmentFeatureState,
  type PlayerCombatPhaseKey,
} from "@/features/player-combat/playerCombatPhaseModel";
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

function formatSignedCombatNumber(value: number): string {
  return `${value >= 0 ? "+" : ""}${value}`;
}

function formatPreferredDistanceLabel(distances: readonly number[]): string {
  const normalized = [...new Set(distances)].sort((left, right) => left - right);

  if (normalized.length === 0) {
    return "unknown";
  }

  const contiguous = normalized.every((distance, index) =>
    index === 0 ? true : distance === normalized[index - 1] + 1,
  );

  return contiguous && normalized.length > 1
    ? `${normalized[0]}-${normalized[normalized.length - 1]}`
    : normalized.join(", ");
}

function formatCombatDistanceModifierDetailLine(
  detail: CombatRoundAttackDistanceModifierDetail | undefined,
): string | undefined {
  if (!detail) {
    return undefined;
  }

  if (detail.notes && detail.actualDistance === undefined) {
    const normalizedNotes = detail.notes.replace(/^distance:\s*/i, "");
    const skillMarker = " · Skill/OB ";

    if (normalizedNotes.includes(skillMarker)) {
      const [context, value] = normalizedNotes.split(skillMarker);
      return `${context.replace(/\s· nearest \d+$/, "")} -> Skill/OB ${value}`;
    }

    return normalizedNotes;
  }

  const weaponName = detail.weaponName ?? "Weapon";
  const preferredLabel = formatPreferredDistanceLabel(detail.preferredDistances);

  if (detail.warning) {
    return `${weaponName} preferred ${preferredLabel} -> ${detail.warning}`;
  }

  if (detail.actualDistance === undefined) {
    return undefined;
  }

  const baseLine = `${weaponName} preferred ${preferredLabel} · actual ${detail.actualDistance}`;

  return detail.value < 0
    ? `${baseLine} -> Skill/OB ${formatSignedCombatNumber(detail.value)}`
    : `${baseLine} -> no modifier`;
}

function buildPlayerCombatDistanceModifierSection(
  detail: CombatRoundAttackDistanceModifierDetail | undefined,
):
  | {
      calculationLines: readonly string[];
      resultLine?: string;
      title: string;
    }
  | undefined {
  const distanceLine = formatCombatDistanceModifierDetailLine(detail);

  if (!distanceLine) {
    return undefined;
  }

  return {
    calculationLines: [distanceLine],
    resultLine:
      detail?.value && detail.value < 0
        ? `Result: Skill/OB ${formatSignedCombatNumber(detail.value)}`
        : detail?.warning
          ? `Result: ${detail.warning}`
          : "Result: no distance modifier",
    title: "Distance",
  };
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
    return isPhaseResult
      ? "Result: Attack continues - no roll required"
      : "Result: Active - no roll required";
  }

  if (
    isPhaseResult &&
    result.effectiveTableTotal !== undefined &&
    result.effectiveTableTotal <= 5
  ) {
    return "Result: No attack made";
  }

  if (isPhaseResult && result.modifierValue < 0) {
    return `Result: Attack continues, phase attack OB ${result.modifierValue}`;
  }

  if (!result.needsEffectRow || result.modifierValue === 0) {
    return isPhaseResult ? "Result: Attack continues, no modifier" : "Result: Active, no modifier";
  }

  return `Result: ${result.label}, General ${result.modifierValue} for ${result.durationRounds} round${
    result.durationRounds === 1 ? "" : "s"
  }`;
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

function formatCombatPhaseResolutionResultLines(input: {
  attackResult: CombatRoundAttackRollResult;
  distanceModifierDetail?: CombatRoundAttackDistanceModifierDetail;
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
  const proposal = input.resolution.damageProposal;
  const resolvedParryLine = formatCombatParryCalculationLine(parry);
  const parryLine =
    resolvedParryLine ??
    `Parry: ${formatResolutionStatusLabel(parry.status)}${
      parry.resultLabel ? ` (${parry.resultLabel})` : ""
    }`;
  const parryResultLine =
    parry.status === "resolved" && parry.resultLabel ? `Result: ${parry.resultLabel}` : undefined;

  const attackLine = `${formatCombatAttackResultLine({
    participantId: input.participantId,
    result: input.attackResult,
  })} · Result: ${input.attackResult.tableResult}`;
  const sections = [
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
    buildPlayerCombatDistanceModifierSection(input.distanceModifierDetail),
  ].filter(
    (
      section,
    ): section is {
      calculationLines: readonly string[];
      resultLine?: string;
      title: string;
    } => Boolean(section),
  );

  return {
    attackLine,
    proposalLine: parryResultLine ?? `Proposal: ${formatResolutionStatusLabel(proposal.status)}`,
    sections,
    statusLine: parryResultLine
      ? parryLine
      : `${parryLine} · Damage roll: ${formatResolutionStatusLabel(damage.status)}`,
  };
}

function createModifierEntryDraft(): ScenarioCombatModifierEntry {
  return {
    id: `modifier-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    notes: "",
    scope: "until",
    value: 0,
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

function getModifierBucketContextKey(
  bucket: ScenarioCombatModifierBucket,
): keyof ScenarioParticipantCombatContext["modifierBuckets"] {
  switch (bucket) {
    case "general":
      return "general";
    case "situation_db":
      return "situationDb";
    case "situation_initiative":
      return "situationInitiative";
    case "situation_ob_skill":
      return "situationObSkill";
  }
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

function buildPlayerCombatParryModifierBreakdown(input: {
  attackResult?: CombatRoundAttackRollResult;
  liveModifiers: ReturnType<typeof buildEncounterLiveCombatModifierSummary>;
}): Array<{ label: string; value: number }> {
  const attackResultModifier = input.attackResult?.defenderParryModifier ?? 0;

  return [
    {
      label: "General/Fatigue",
      value: input.liveModifiers.generalFatigueRaw,
    },
    {
      label: "DB/Parry",
      value: input.liveModifiers.dbRaw,
    },
    ...(attackResultModifier === 0
      ? []
      : [
          {
            label: "attack result",
            value: attackResultModifier,
          },
        ]),
  ];
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
  const [actionRollResult, setActionRollResult] = useState<{
    interpretedResult: string;
    phaseLabel?: string;
    value: number;
  } | null>(null);
  const isGameMaster = Boolean(
    currentUser?.roles.includes("game_master") || currentUser?.roles.includes("admin"),
  );
  const controlsDisabled = readOnlyInspection;
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

    async function refreshCombatView(input: { showLoading?: boolean } = {}) {
      if (input.showLoading ?? false) {
        setLoading(true);
      }

      try {
        const [nextProjection, nextContent, nextParticipants, nextEncounter] = await Promise.all([
          loadScenarioPlayerProjection(scenarioId),
          loadCanonicalContent(),
          isGameMaster
            ? loadScenarioParticipants(scenarioId)
            : loadScenarioMyParticipant(scenarioId).then((p) => (p ? [p] : [])),
          encounterId ? loadEncounterById(encounterId) : Promise.resolve(undefined),
        ]);

        if (cancelled) {
          return;
        }

        setProjection(nextProjection);
        setContent(nextContent);
        setSelectableParticipants(nextParticipants);
        setEncounterSession(nextEncounter);
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
  }, [currentUser, encounterId, isGameMaster, scenarioId, sessionLoading]);

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
  const declarationStepOpen =
    !combatRoundState || combatRoundState.currentStep === "select_actions";

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
      (isGameMaster || declarationStepOpen)
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
    setCombatContextDraft(nextDraft.combatContext);
    setPhaseCombatContextDrafts(nextDraft.phaseContexts);
    setCombatDeclarationDraftDirty(false);
    setCombatDeclarationDraftKey(selectedCombatDeclarationDraftKey);
  }, [
    combatDeclarationDraftDirty,
    combatDeclarationDraftKey,
    declarationStepOpen,
    isGameMaster,
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
    const candidate = displayedParticipant?.equipmentState;
    return isEquipmentFeatureState(candidate) ? candidate : null;
  }, [displayedParticipant]);

  const currentCombatStep = combatRoundState?.currentStep ?? "select_actions";
  const currentRollAction =
    combatRoundState && selectedRoundParticipant
      ? getPlayerCombatCurrentRollAction({
          participantId: selectedRoundParticipant.participantId,
          state: combatRoundState,
        })
      : undefined;
  const currentModifierPhase = getCombatRoundModifierPhaseForStep(currentCombatStep);
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
      selectedActionId,
      selectedParticipant,
      selectedRoundParticipant,
      selectedSecondaryActionId,
    ],
  );
  const liveCombatModifiers = useMemo(
    () =>
      buildEncounterLiveCombatModifierSummary({
        combatContext: projectedCombatContextDraft,
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
        liveModifiers: liveCombatModifiers,
        phaseKey: currentModifierPhase,
      }),
    [
      currentModifierPhase,
      liveCombatModifiers,
      projectedCombatContextDraft,
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
          characterId: displayedParticipant?.characterId ?? "",
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
        characterId: displayedParticipant?.characterId ?? "",
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

  function updateModifierBucket(
    bucket: ScenarioCombatModifierBucket,
    updater: (entries: ScenarioCombatModifierEntry[]) => ScenarioCombatModifierEntry[],
  ) {
    const bucketKey = getModifierBucketContextKey(bucket);

    markCombatDeclarationDraftDirty();
    setCombatContextDraft((current) => ({
      ...current,
      modifierBuckets: {
        ...current.modifierBuckets,
        [bucketKey]: updater(current.modifierBuckets[bucketKey]),
      },
    }));
  }

  async function saveCombatContext() {
    if (readOnlyInspection) {
      return;
    }

    if (!selectedParticipant) {
      return;
    }

    const targetValidation = validateCombatDeclarationTargets({
      actionId: selectedActionId || undefined,
      phaseContexts: phaseCombatContextDrafts,
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
        additionalActionNotes,
        combatContext: projectedCombatContextDraft,
        encounterId,
        movementId: selectedMovementId || undefined,
        movementIntent: selectedMovementIntent,
        phaseContexts: phaseCombatContextDrafts,
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
      setEncounterSession(encounter);
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

      setEncounterSession(encounter);
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
      setEncounterSession(encounter);
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
      setEncounterSession(encounter);
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
      setEncounterSession(encounter);
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
      setEncounterSession(encounter);
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
      setEncounterSession(encounter);
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

  async function rollPhaseAttack() {
    if (readOnlyInspection || !selectedParticipant || !encounterId || !currentAttackPhase) {
      return;
    }

    const phaseContext = currentAttackPhaseContext ?? phaseCombatContextDrafts[currentAttackPhase];
    const phaseAttackStats = phaseCombatLoadoutSummaries[currentAttackPhase].attackStats;
    const defenderScenarioParticipantId = phaseContext.targetParticipantId;

    if (!phaseAttackStats) {
      setError(
        `No ${currentAttackPhase === "phase1" ? "phase 1" : "phase 2"} attack source available.`,
      );
      return;
    }

    if (!defenderScenarioParticipantId) {
      setError("Select an attack target before rolling.");
      return;
    }

    let ob: number | undefined;

    try {
      ob = parsePlayerCombatInteger(phaseAttackStats.ob, "Attack OB");
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Attack OB is not available.");
      return;
    }

    setSavingCombatContext(true);

    try {
      const { encounter, participant } = await rollCombatAttackOnServer({
        actionId: selectedActionId || `${currentAttackPhase}_attack`,
        defenderScenarioParticipantId,
        encounterId,
        ob,
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

      setEncounterSession(encounter);
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
        encounterId,
        modifierBreakdown: currentParryModifierBreakdown,
        parryBase: currentParryBase,
        parrySourceLabel: currentParryDefenseStats?.sourceName,
        scenarioParticipantId: selectedParticipant.id,
        usedMainHand: true,
        usedOffHand: true,
      });

      setEncounterSession(encounter);
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

      setEncounterSession(encounter);
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
        loadoutModel,
        secondaryActionId: selectedSecondaryActionId,
      }),
    [loadoutModel, selectedActionId, selectedSecondaryActionId],
  );
  const targetOptions = useMemo(
    () =>
      getPlayerEncounterOpponentParticipants({
        allowedParticipantIds: encounterScenarioParticipantIds,
        currentUserId: currentUser?.id,
        isGameMaster,
        participants: selectableParticipants,
        projectionVisibleParticipants: projection?.visibleParticipants,
        selectedParticipantId: selectedParticipant?.id,
      }),
    [
      currentUser?.id,
      encounterScenarioParticipantIds,
      isGameMaster,
      projection?.visibleParticipants,
      selectableParticipants,
      selectedParticipant?.id,
    ],
  );
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
        characterId: displayedParticipant?.characterId ?? "",
        combatAllocationInputs,
        liveCombatModifiers: phaseLiveCombatModifiers,
        state: controlledEquipmentState,
        throwingWeaponItemId: null,
      });

      return buildPlayerCombatLoadoutSummary({
        actionId: selectedActionId,
        loadoutModel: phaseLoadoutModel,
        phaseKey,
        secondaryActionId: selectedSecondaryActionId,
      });
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
    projectedCombatContextDraft,
    selectedActionId,
    selectedParticipant?.state.combatEffects,
    selectedSecondaryActionId,
  ]);
  const distancePreferenceOptions = useMemo<PlayerCombatDistancePreferenceOption[]>(() => {
    const primaryTargetId =
      phaseCombatContextDrafts.phase1.targetParticipantId ??
      phaseCombatContextDrafts.phase2.targetParticipantId ??
      combatContextDraft.targetParticipantId;
    const primaryTargetPhase = phaseCombatContextDrafts.phase1.targetParticipantId
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
    selectedParticipant,
    targetOptions,
  ]);
  const initiativeCalculation = useMemo(
    () =>
      buildEncounterInitiativeModifierCalculation({
        baseInitiative: combatLoadoutSummary.passiveInitiative,
        liveModifiers: liveCombatModifiers,
      }),
    [combatLoadoutSummary.passiveInitiative, liveCombatModifiers],
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
  const selectedCurrentAttackResult =
    combatRoundState && selectedRoundParticipant && currentAttackPhase
      ? getCombatRoundOutgoingAttackResultForParticipantPhase({
          participantId: selectedRoundParticipant.participantId,
          phase: currentAttackPhase,
          state: combatRoundState,
        })
      : undefined;
  const selectedCurrentAttackDistanceModifierDetail =
    combatRoundState && selectedCurrentAttackResult
      ? getCombatRoundAttackDistanceModifierDetail({
          result: selectedCurrentAttackResult,
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
          buildPlayerCombatDistanceModifierSection(selectedCurrentAttackDistanceModifierDetail),
        ].filter(
          (
            section,
          ): section is {
            calculationLines: readonly string[];
            resultLine?: string;
            title: string;
          } => Boolean(section),
        ),
      }
    : null;
  const currentResolutionPhase = getCombatRoundResolutionPhaseForStep(currentCombatStep);
  const selectedCurrentResolutionAttackResult =
    combatRoundState && selectedRoundParticipant && currentResolutionPhase
      ? getCombatRoundDisplayIncomingAttackResultForParticipantPhase({
          participantId: selectedRoundParticipant.participantId,
          phase: currentResolutionPhase,
          state: combatRoundState,
        })
      : undefined;
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
          distanceModifierDetail:
            combatRoundState && selectedCurrentResolutionAttackResult
              ? getCombatRoundAttackDistanceModifierDetail({
                  result: selectedCurrentResolutionAttackResult,
                  state: combatRoundState,
                })
              : undefined,
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
  const currentParryBase = parsePlayerCombatDisplayInteger(currentParryDefenseStats?.parry);
  const currentParryModifierBreakdown = buildPlayerCombatParryModifierBreakdown({
    attackResult: selectedCurrentResolutionAttackResult,
    liveModifiers: liveCombatModifiers,
  });
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
      }
    : null;
  const attackerPrivilegedAction = selectedAttackerPrivilegedAttackResult
    ? currentRollAction?.kind === "hit_location" &&
      selectedAttackerPrivilegedDamageSubstate === "location_pending"
      ? {
          disabled: false,
          kind: "hitLocation" as const,
          label: "Roll hit location",
        }
      : currentRollAction?.kind === "critical" &&
          selectedAttackerPrivilegedDamageSubstate === "critical_pending"
        ? {
            disabled: false,
            kind: "critical" as const,
            label: "Roll critical",
          }
        : selectedAttackerPrivilegedDamageSubstate === "location_rolled"
          ? {
              disabled: true,
              kind: undefined,
              label: "Hit location rolled",
            }
          : selectedAttackerPrivilegedDamageSubstate === "critical_rolled"
            ? {
                disabled: true,
                kind: undefined,
                label: "Critical rolled",
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
  const phase1InitiativeComplete = Boolean(
    combatRoundState &&
    isCombatRoundPhaseInitiativeComplete({ phase: "phase1", state: combatRoundState }),
  );
  const phase2InitiativeComplete = Boolean(
    combatRoundState &&
    isCombatRoundPhaseInitiativeComplete({ phase: "phase2", state: combatRoundState }),
  );
  const currentResultPhase = currentModifierPhase ?? currentInitiativePhase;
  const selectedRelevantInitiative = currentResultPhase
    ? selectedRoundParticipant?.initiatives[currentResultPhase]
    : undefined;
  const selectedRelevantInitiativeComplete =
    currentResultPhase === "phase2" ? phase2InitiativeComplete : phase1InitiativeComplete;
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
  const selectedCombatExperienceResultPanel = selectedVisibleCombatExperienceResult
    ? {
        interpretedResult: selectedVisibleCombatExperienceResult.noRollRequired
          ? `Combat Experience ${selectedVisibleCombatExperienceResult.skillTotal} vs difficulty ${selectedVisibleCombatExperienceResult.difficulty}`
          : `Combat Experience ${selectedVisibleCombatExperienceResult.skillTotal} + roll ${selectedVisibleCombatExperienceResult.rollTotal} = ${selectedVisibleCombatExperienceResult.finalTotal} vs ${selectedVisibleCombatExperienceResult.difficulty}`,
        rankLabel: "Combat Experience",
        resultLabel: formatCombatExperienceResultLine(selectedVisibleCombatExperienceResult),
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
              `Dodge ${selectedDistanceControlProposal.ownSide.dodgeSkillTotal} + Gen/Fatigue ${selectedDistanceControlProposal.ownSide.generalFatigueModifier} + roll ${formatOpenEndedD20RollBreakdown(
                {
                  dieResult: selectedDistanceControlProposal.ownSide.result.rollTotal,
                  openEndedD10s: selectedDistanceControlProposal.ownSide.result.openEndedD10s,
                  rollD20: selectedDistanceControlProposal.ownSide.result.rollD20,
                },
              )} = ${selectedDistanceControlProposal.ownSide.result.finalTotal}`,
              `Your preference: ${
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
    (isGameMaster ||
      (initiativeStepStatus === "pending" && !selectedParticipantRolledCurrentInitiative));
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
    !isGameMaster &&
    (!declarationStepOpen || declarationStepHardLocked || declarationSubmittedAndComplete);
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
  const declarationTargetValidationMessage =
    !currentInitiativePhase && declarationIncomplete ? targetValidation.message : undefined;
  const declareActionDisabled =
    controlsDisabled ||
    savingCombatContext ||
    !displayedParticipant ||
    (currentInitiativePhase
      ? !canUseInitiativeButton
      : (isGameMaster ? false : playerDeclarationLocked || !hasMeaningfulDeclaration) ||
        !targetValidation.valid);
  const declarationButtonLabel =
    !isGameMaster &&
    currentCombatStep === "select_actions" &&
    (!playerDeclarationLocked || declarationIncomplete)
      ? "Declare action"
      : getPlayerCombatActionButtonLabel({
          currentStep: currentCombatStep,
          disabled: declareActionDisabled,
          isGameMaster,
        });
  const playerActionButtonLabel = selectedHealthCheckActionAvailable
    ? "Roll health check"
    : selectedDistanceControlActionAvailable
      ? "Roll distance control"
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
  const playerActionButtonDisabled = selectedHealthCheckActionAvailable
    ? controlsDisabled || savingCombatContext
    : selectedDistanceControlActionAvailable
      ? controlsDisabled || savingCombatContext
      : selectedPhaseAttackChoiceIsBackOut
        ? controlsDisabled || savingCombatContext || !selectedPhaseCombatExperienceBackOutAvailable
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
  const gmStatusSuffix = selectedParticipantRolledCurrentInitiative
    ? " Initiative rolled."
    : currentStepIsModifierReview
      ? selectedModifierReviewComplete
        ? " Reviewed."
        : ""
      : selectedParticipantHasDeclared
        ? " Declared."
        : "";
  const combatExperienceStatusText = !selectedCombatExperienceWindowOpen
    ? "Waiting for GM to start CE."
    : selectedCombatExperienceNoRollAvailable
      ? `Current step: ${currentCombatStepLabel}. Confirm Combat Experience.`
      : `Current step: ${currentCombatStepLabel}. Roll Combat Experience.`;
  const declarationStatusText = selectedHealthCheckActionAvailable
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
                : isGameMaster
                  ? `Current step: ${currentCombatStepLabel}.${gmStatusSuffix}`
                  : currentInitiativePhase
                    ? selectedParticipantRolledCurrentInitiative
                      ? `Current step: ${currentCombatStepLabel}. Initiative rolled.`
                      : initiativeStepStatus === "pending"
                        ? `Current step: ${currentCombatStepLabel}.`
                        : `Current step: ${currentCombatStepLabel}. Waiting for GM.`
                    : currentParryAction
                      ? `Current step: ${currentCombatStepLabel}. Ready to roll.`
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
  const selectedPhaseAttackChoiceControls = selectedPhaseAttackChoiceSelectorAvailable ? (
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
          {selectedPhaseCombatExperienceRequirement
            ? "Continue and roll Combat Experience"
            : "Continue attack"}
        </option>
        <option value="back_out">Back out of attack</option>
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
  const showPhaseCombatExperienceContextPanel =
    Boolean(
      selectedPhaseCombatExperienceRequirement ||
        selectedPhaseAttackBackOutOpportunity ||
        selectedPhaseInitiativeChoice,
    );
  const showInitiativeContextPanel =
    !showPhaseCombatExperienceContextPanel && Boolean(currentInitiativePhase);
  const showCombatStartExperienceContextPanel =
    !showInitiativeContextPanel &&
    !showPhaseCombatExperienceContextPanel &&
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

      {displayedParticipant ? (
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
              const phaseCombatContext = phaseCombatContextDrafts[phaseKey];
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
                  {phaseModel.showAttackStats && phaseModel.attackStats ? (
                    <PlayerCombatAttackStatsTable stats={phaseModel.attackStats} />
                  ) : null}
                  {phaseModel.showAttackLocationSelector ? (
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
                          setPhaseCombatContextDrafts((current) => ({
                            ...current,
                            [phaseKey]: combatContext,
                          }));
                        }}
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
                    </>
                  ) : null}
                  {phaseModel.showDefenseContext && phaseModel.defenseStats ? (
                    <>
                      <PlayerCombatDefenseStatsTable stats={phaseModel.defenseStats} />
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
              onAddEntry={
                isGameMaster
                  ? (bucketKey, entry) =>
                      updateModifierBucket(bucketKey, (current) => [
                        ...current,
                        entry ?? createModifierEntryDraft(),
                      ])
                  : undefined
              }
              onRemoveEntry={
                isGameMaster
                  ? (bucketKey, entryId) =>
                      updateModifierBucket(bucketKey, (current) =>
                        current.filter((currentEntry) => currentEntry.id !== entryId),
                      )
                  : undefined
              }
              onUpdateEntry={
                isGameMaster
                  ? (bucketKey, entryId, patch) =>
                      updateModifierBucket(bucketKey, (current) =>
                        current.map((currentEntry) =>
                          currentEntry.id === entryId
                            ? {
                                ...currentEntry,
                                ...patch,
                              }
                            : currentEntry,
                        ),
                      )
                  : undefined
              }
              readOnly={!isGameMaster}
              rows={modifierRows}
            />
            <div style={{ display: "grid", gap: "0.75rem" }}>
              {showInitiativeContextPanel ? (
                <section style={panelStyle}>
                  <strong>Initiative</strong>
                  <div style={{ color: "#4f5f57", display: "grid", gap: "0.2rem" }}>
                    <div>Base initiative {initiativeCalculation.baseInitiative}</div>
                    <div>
                      Gen/Fatigue + Initiative modifiers{" "}
                      {initiativeCalculation.rawModifierTotal >= 0 ? "+" : ""}
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
                    <div>Effective CE {selectedCombatExperienceSkillTotal}</div>
                    <div>Reason: attacked while attacking</div>
                    <div>
                      CE roll required: {selectedPhaseCombatExperienceRollRequired ? "Yes" : "No"}
                    </div>
                    {selectedPhaseCombatExperienceThreats.length > 0 ? (
                      <>
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
                        {selectedPhaseCombatExperienceThreats.map((threat) => (
                          <div
                            key={`player-phase-ce-threat:${threat.attackerParticipantId}:${threat.initiativeDifference}`}
                          >
                            Initiative: {threat.participantInitiative} vs{" "}
                            {threat.attackerInitiative}. Difference: {threat.initiativeDifference}
                          </div>
                        ))}
                      </>
                    ) : null}
                    {selectedPhaseAttackBackOutOpportunity &&
                    !selectedPhaseCombatExperienceRequirement ? (
                      <div>Back-out choice available without a CE roll.</div>
                    ) : null}
                    {selectedPhaseAttackChoiceSelectorAvailable ? (
                      <div>
                        Selected choice:{" "}
                        {phaseAttackChoiceSelection === "back_out" ? "Back out" : "Continue"}
                      </div>
                    ) : null}
                    {selectedPhaseInitiativeChoice ? (
                      <div style={{ color: "#3f5f46" }}>
                        Submitted:{" "}
                        {selectedPhaseInitiativeChoice.choice === "roll_ce_result"
                          ? "Combat Experience rolled"
                          : selectedPhaseInitiativeChoice.choice === "back_out"
                            ? "Back out"
                            : "Continue"}
                        .
                      </div>
                    ) : (
                      <div>
                        Status:{" "}
                        {selectedPhaseCombatExperienceRequirement
                          ? "waiting for selected participant CE/choice"
                          : "waiting for selected participant choice"}
                      </div>
                    )}
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
                    : selectedDistanceControlActionAvailable
                      ? rollDistanceControl()
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
                preActionControls={selectedPhaseAttackChoiceControls}
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
              result={
                selectedHealthCheckResultPanel ??
                selectedDistanceControlResultPanel ??
                selectedCurrentPhaseResolutionResultPanel ??
                selectedAttackerPrivilegedResultPanel ??
                selectedCurrentAttackResultPanel ??
                selectedRelevantInitiativeResultPanel ??
                selectedCombatExperienceResultPanel ??
                actionRollResult
              }
            />
          </div>
        </section>
      ) : (
        <div style={panelStyle}>
          This account does not currently have an accessible participant to act for in this
          scenario.
        </div>
      )}

      <section style={{ display: "grid", gap: "1rem" }}>
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
    </section>
  );
}
