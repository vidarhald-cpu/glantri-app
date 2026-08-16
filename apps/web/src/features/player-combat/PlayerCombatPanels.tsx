"use client";

import React, { useState, type ReactNode } from "react";

import {
  HIT_LOCATIONS,
  isCombatDeclarationActionAvailable,
  type CombatEffectsState,
  type CombatDistance,
  type CombatRoundInitiativeResult,
  type CombatRoundStep,
  type MovementIntent,
  type ScenarioCombatModifierBucket,
  type ScenarioCombatModifierEntry,
  type CombatObservationRelationship,
  type ScenarioParticipantCombatContext,
  type ScenarioParticipantParryDirection,
  type ScenarioParticipantTargetLocation,
  getHitLocationFullLabel,
  buildLiveCombatModifierContributionProjection,
  type CombatModifierContributionBucket,
  isCombatModifierContributionActive,
  isPersistentCombatModifierEntry,
  normalizeScenarioCombatModifierEntry,
} from "@glantri/domain";

import {
  CombatCalculationPanel,
  formatSignedCombatModifier,
  type CombatCalculationPresentation,
  type CurrentActionCommandDescriptor,
  type CurrentActionPresentation,
} from "@/features/combat-history";
import {
  createEmptyPlayerEncounterCombatContext,
  PLAYER_ENCOUNTER_ACTION_OPTIONS,
  PLAYER_ENCOUNTER_PARRY_DIRECTION_OPTIONS,
  getPlayerEncounterActionLabel,
  getPlayerEncounterDeclarationCompatibilityMessage,
  getPlayerEncounterParryCoverageDirection,
  getPlayerEncounterParryDirectionLabel,
  getPlayerEncounterPrimaryActionOptions,
  getPlayerEncounterSecondaryActionOptions,
  type PlayerEncounterActionId,
  type PlayerEncounterMovementId,
  type PlayerEncounterOpponentOption,
  type PlayerEncounterOption,
} from "@/lib/campaigns/playerEncounter";
import {
  filterCombatModifierEntriesForPhase,
  getCombatModifierRowsVisibleAtStep,
  type EncounterCombatPhaseKey,
  type EncounterLiveCombatModifierSummary,
} from "@/lib/campaigns/liveCombatModifiers";
import {
  buildCombatSituationAwarenessModel,
  type CombatSituationContext,
  type CombatSituationDisplayRow,
  type CombatSituationLifecycleEffect,
} from "./combatSituationAwareness";

export interface PlayerCombatModifierBucketView {
  bucketKey: ScenarioCombatModifierBucket;
  characterStateEntries?: PlayerCombatModifierDisplayEntry[];
  derivedEntries?: PlayerCombatModifierDisplayEntry[];
  entries: ScenarioCombatModifierEntry[];
  fatigueTotal?: number;
  label: string;
  locked?: boolean;
  total: number;
}

export interface PlayerCombatModifierDisplayEntry {
  application?: ScenarioCombatModifierEntry["application"];
  canonicalLifecycle?: CombatSituationLifecycleEffect;
  details?: string;
  id: string;
  scopeLabel: string;
  sourceLabel: string;
  value: number;
}

export interface GroupedFeintModifierDisplay {
  entryIds: readonly string[];
  resultGroupId: string;
  value: number;
}

export function buildGroupedFeintModifierDisplays(
  _rows: readonly PlayerCombatModifierBucketView[],
): GroupedFeintModifierDisplay[] {
  // Equal Feint consequences remain separate canonical Skill/OB and DB/Parry effects. Collapsing
  // them loses category provenance and can hide a non-zero row when its category total is zero.
  return [];
}

export interface PlayerCombatPhaseCardView {
  description: string;
  phaseLabel: string;
  stats: readonly string[];
  title: string;
}

export interface PlayerCombatAttackStatsView {
  attackMode: string;
  dmb: string;
  initiative: string;
  maxCrits: string;
  ob: string;
  provisional?: boolean;
  weaponArmorClass?: string;
  weaponCriticalCode?: string;
  weaponDamageClass?: string;
  weaponName: string;
}

export interface PlayerCombatDefenseStatsView {
  db: string;
  dm: string;
  parry: string;
  provisional?: boolean;
  sourceName: string;
}

interface PlayerCombatModifierPanelProps {
  activeSpecialEffectCount?: number;
  context?: CombatSituationContext;
  controlsDisabled?: boolean;
  onAddEntry?: (
    bucketKey: ScenarioCombatModifierBucket,
    entry: ScenarioCombatModifierEntry,
  ) => void;
  onRemoveEntry?: (bucketKey: ScenarioCombatModifierBucket, entryId: string) => void;
  onUpdateEntry?: (
    bucketKey: ScenarioCombatModifierBucket,
    entryId: string,
    patch: Partial<
      Pick<ScenarioCombatModifierEntry, "durationRounds" | "notes" | "scope" | "value">
    >,
  ) => void;
  readOnly?: boolean;
  pendingActivationLabel?: string;
  pendingEntries?: readonly ScenarioCombatModifierEntry[];
  pendingRows?: readonly CombatSituationDisplayRow[];
  provisional?: boolean;
  lifecycleEffects?: readonly CombatSituationLifecycleEffect[];
  rows: readonly PlayerCombatModifierBucketView[];
  sourceLabel?: string;
  showEmptyCategories?: boolean;
  /** Bounded archived-snapshot compatibility; live observation rows use derivedEntries. */
  observationRelationships?: readonly CombatObservationRelationship[];
  observationTargetLabels?: Readonly<Record<string, string>>;
}

interface PlayerCombatObservationProgressProps {
  relationships: readonly CombatObservationRelationship[];
  targetLabels: Readonly<Record<string, string>>;
}

interface PlayerCombatPhasePanelProps {
  children?: ReactNode;
  phaseCard: PlayerCombatPhaseCardView;
  sourceLabel?: string;
}

interface PlayerCombatActionSelectorPanelProps {
  actionId: PlayerEncounterActionId | "";
  actionOptions?: readonly PlayerEncounterOption<PlayerEncounterActionId>[];
  additionalActionNotes: string;
  controlsDisabled?: boolean;
  declarationRecorded?: boolean;
  distancePreferenceOptions?: readonly PlayerCombatDistancePreferenceOption[];
  movementId: PlayerEncounterMovementId | "";
  movementIntent?: MovementIntent;
  onActionChange: (actionId: PlayerEncounterActionId | "") => void;
  onAdditionalActionNotesChange: (notes: string) => void;
  onMovementChange: (movementId: PlayerEncounterMovementId | "") => void;
  onMovementIntentChange?: (movementIntent: MovementIntent) => void;
  onSecondaryActionChange: (actionId: PlayerEncounterActionId | "") => void;
  roundNumber?: number;
  secondaryActionId: PlayerEncounterActionId | "";
  sourceLabel?: string;
}

export interface PlayerCombatHistoricalActionSelectorPanelProps {
  actionLabel?: string;
  additionalActionNotes?: string;
  declarationRecorded?: boolean;
  distancePreferences?: readonly {
    desiredDistance?: CombatDistance;
    displayName: string;
  }[];
  movementLabel?: string;
  roundNumber?: number;
  secondaryActionLabel?: string;
}

interface PlayerCombatOpponentSelectorProps {
  controlsDisabled?: boolean;
  emptyLabel?: string;
  label?: string;
  onSelectedOpponentChange: (participantId: string) => void;
  opponentOptions: readonly PlayerEncounterOpponentOption[];
  readOnly?: boolean;
  selectedOpponentId?: string;
}

export interface PlayerCombatDistancePreferenceOption {
  defaultDistance?: CombatDistance;
  displayName: string;
  id: string;
}

interface PlayerCombatAttackStatsTableProps {
  stats: PlayerCombatAttackStatsView;
}

interface PlayerCombatDefenseStatsTableProps {
  stats: PlayerCombatDefenseStatsView;
}

interface PlayerCombatParryContextPanelProps {
  combatContext: ScenarioParticipantCombatContext;
  controlsDisabled?: boolean;
  mainHandItemLabel?: string;
  offHandItemLabel?: string;
  onCombatContextChange: (combatContext: ScenarioParticipantCombatContext) => void;
  readOnly?: boolean;
}

interface PlayerCombatAttackLocationSelectorProps {
  combatContext: ScenarioParticipantCombatContext;
  controlsDisabled?: boolean;
  onCombatContextChange: (combatContext: ScenarioParticipantCombatContext) => void;
  readOnly?: boolean;
}

interface PlayerCombatAttackModeSelectorProps {
  controlsDisabled?: boolean;
  emptyState?: string;
  onChange: (attackModeId: string) => void;
  options: readonly { id: string; label: string }[];
  selectedAttackModeId?: string;
  readOnly?: boolean;
}

interface PlayerCombatAttackTargetSelectorProps {
  combatContext: ScenarioParticipantCombatContext;
  controlsDisabled?: boolean;
  distanceLabel?: string;
  onCombatContextChange: (combatContext: ScenarioParticipantCombatContext) => void;
  readOnly?: boolean;
  targetOptions: readonly PlayerEncounterOpponentOption[];
}

interface PlayerCombatActionButtonPanelProps {
  disabled?: boolean;
  onDeclareAction?: (descriptor?: CurrentActionCommandDescriptor) => void;
  preActionControls?: ReactNode;
  /**
   * Reserved for non-primary utility commands. Alternative outcomes for the same pending
   * task should use preActionControls plus one primary action.
   */
  onSecondaryAction?: () => void;
  secondaryButtonDisabled?: boolean;
  secondaryButtonLabel?: string;
  saving?: boolean;
  statusText?: string;
  presentation?: CurrentActionPresentation | null;
  validationMessage?: string;
  validationMessageTone?: "error" | "neutral";
}

interface PlayerCombatActionResultSection {
  calculations: readonly CombatCalculationPresentation[];
  resultLine?: string;
  title: string;
}

interface PlayerCombatActionResultPanelProps {
  result?: {
    detailLines?: readonly string[];
    interpretedResult: string;
    rankLabel?: string;
    resultLabel?: string;
    sections?: readonly PlayerCombatActionResultSection[];
  } | null;
  title?: string;
}

export const playerCombatPanelCardStyle = {
  background: "#fffdf8",
  border: "1px solid #d9ddd8",
  borderRadius: 10,
  display: "grid",
  gap: "0.45rem",
  padding: "0.65rem",
} as const;

export const playerCombatPanelsGridStyle = {
  display: "grid",
  gap: "0.75rem",
  gridTemplateColumns: "repeat(auto-fit, minmax(14rem, 1fr))",
} as const;

export const playerCombatPanelRowStyle = {
  display: "grid",
  gap: "0.75rem",
  gridTemplateColumns: "minmax(12rem, 0.7fr) minmax(14rem, 1fr) minmax(14rem, 1fr)",
} as const;

export const playerCombatTopPanelRowStyle = {
  display: "grid",
  gap: "0.75rem",
  gridTemplateColumns: playerCombatPanelRowStyle.gridTemplateColumns,
} as const;

const panelTitleWithSourceStyle = {
  alignItems: "center",
  display: "flex",
  flexWrap: "wrap",
  gap: "0.4rem",
} as const;

const panelSourceMarkerStyle = {
  border: "1px solid #ddd3bf",
  borderRadius: 999,
  color: "#5e5a50",
  fontSize: "0.72rem",
  fontWeight: 700,
  lineHeight: 1.25,
  padding: "0.04rem 0.4rem",
} as const;

function PanelTitleWithSource({ label, sourceLabel }: { label: string; sourceLabel?: string }) {
  return (
    <div style={panelTitleWithSourceStyle}>
      <strong>{label}</strong>
      {sourceLabel ? <span style={panelSourceMarkerStyle}>{sourceLabel}</span> : null}
    </div>
  );
}

const compactFieldLabelStyle = {
  display: "grid",
  gap: "0.18rem",
  maxWidth: "13rem",
} as const;

const compactWideFieldLabelStyle = {
  display: "grid",
  gap: "0.18rem",
  maxWidth: "100%",
} as const;

const compactDistancePreferenceGridStyle = {
  display: "grid",
  gap: "0.3rem",
} as const;

const compactDistancePreferenceRowStyle = {
  alignItems: "center",
  display: "grid",
  gap: "0.5rem",
  gridTemplateColumns: "minmax(0, 1fr) 7.5rem",
} as const;

const compactModifierGroupHeaderStyle = {
  alignItems: "center",
  display: "flex",
  gap: "0.5rem",
  justifyContent: "space-between",
} as const;

const compactModifierMiniTableStyle = {
  display: "grid",
  gap: "0.35rem",
  minWidth: 0,
} as const;

const compactModifierTopRowColumns = "minmax(7rem, 1fr) 3.75rem 4.25rem";

const compactModifierMiniTableHeaderStyle = {
  alignItems: "center",
  display: "grid",
  gap: "0.35rem",
  gridTemplateColumns: compactModifierTopRowColumns,
  minWidth: 0,
} as const;

const compactModifierMiniTableEntryRowStyle = {
  borderTop: "1px solid #e6e0d2",
  display: "grid",
  gap: "0.3rem",
  minWidth: 0,
  paddingTop: "0.35rem",
} as const;

const compactModifierDisplayRowStyle = {
  borderTop: "1px solid #eee9dc",
  color: "#5e5a50",
  display: "grid",
  fontSize: "0.88rem",
  gap: "0.25rem",
  minWidth: 0,
  paddingTop: "0.3rem",
} as const;

const compactModifierDisplayHeaderStyle = {
  ...compactModifierDisplayRowStyle,
  gridTemplateColumns: compactModifierTopRowColumns,
} as const;

const compactModifierDisplayTopRowStyle = {
  alignItems: "start",
  display: "grid",
  gap: "0.35rem",
  gridTemplateColumns: compactModifierTopRowColumns,
  minWidth: 0,
} as const;

const compactModifierNumberInputStyle = {
  boxSizing: "border-box",
  minWidth: 0,
  width: "100%",
} as const;

const compactModifierDetailsInputStyle = {
  boxSizing: "border-box",
  minWidth: 0,
  width: "100%",
} as const;

const compactModifierRemoveButtonStyle = {
  justifySelf: "end",
  lineHeight: 1,
  minWidth: "1.35rem",
  padding: "0.08rem 0.25rem",
} as const;

const compactModifierEntryTopRowStyle = {
  alignItems: "center",
  display: "grid",
  gap: "0.35rem",
  gridTemplateColumns: compactModifierTopRowColumns,
  minWidth: 0,
} as const;

const compactModifierDetailsRowStyle = {
  alignItems: "center",
  display: "grid",
  gap: "0.25rem",
  gridTemplateColumns: "4.25rem minmax(0, 1fr)",
  minWidth: 0,
} as const;

const compactModifierEditableDetailsRowStyle = {
  alignItems: "center",
  display: "grid",
  gap: "0.25rem",
  gridTemplateColumns: "4.25rem minmax(0, 1fr) auto",
  minWidth: 0,
} as const;

const compactStatsRowStyle = {
  alignItems: "center",
  display: "grid",
  gap: "0.45rem",
  gridTemplateColumns: "minmax(6rem, 0.8fr) 1fr",
} as const;

const compactStatsTableStyle = {
  borderCollapse: "collapse",
  fontSize: "0.88rem",
  width: "100%",
} as const;

const compactPhaseContextSelectorColumns = "6.5rem 7rem auto";
const compactPhaseContextSelectStyle = { width: "7rem" } as const;
const compactPhaseTargetRowStyle = {
  alignItems: "center",
  display: "grid",
  gap: "0.35rem",
  gridTemplateColumns: "6.5rem minmax(7rem, 1fr) max-content",
  minWidth: 0,
  width: "100%",
} as const;
const compactPhaseTargetSelectStyle = {
  ...compactPhaseContextSelectStyle,
  maxWidth: "13rem",
} as const;
const compactPhaseTargetMetaStyle = {
  color: "#4f5f57",
  display: "grid",
  fontSize: "0.82rem",
  justifyItems: "end",
  justifySelf: "end",
  minWidth: "5.5rem",
  whiteSpace: "nowrap",
} as const;

function getDisplayTotal(row: PlayerCombatModifierBucketView | undefined): number {
  return row ? row.total + (row.fatigueTotal ?? 0) : 0;
}

function formatModifierPhaseLabel(phase?: "phase1" | "phase2"): string | undefined {
  return phase === "phase1" ? "P1" : phase === "phase2" ? "P2" : undefined;
}

function inferModifierPhase(entry: ScenarioCombatModifierEntry): "phase1" | "phase2" | undefined {
  if (entry.sourcePhase === "phase1" || entry.sourcePhase === "phase2") {
    return entry.sourcePhase;
  }

  const sourceText = `${entry.id} ${entry.sourceRule ?? ""}`;

  if (sourceText.includes("phase1")) {
    return "phase1";
  }

  return sourceText.includes("phase2") ? "phase2" : undefined;
}

export function formatCombatModifierScopeLabel(entry: ScenarioCombatModifierEntry): string {
  const phaseLabel = formatModifierPhaseLabel(inferModifierPhase(entry));

  if (phaseLabel) {
    return phaseLabel;
  }

  if (entry.generated && entry.durationRounds === 1) {
    return "1 attack";
  }

  if (entry.durationRounds) {
    return entry.durationRounds === 1 ? "RD" : `duration ${entry.durationRounds}`;
  }

  return entry.scope === "save" ? "until save" : "until SU";
}

function isGeneratedDistanceModifier(entry: ScenarioCombatModifierEntry): boolean {
  return (
    entry.id.startsWith("generated:distance:") ||
    entry.sourceRule === "distance-ob-skill" ||
    entry.sourceRule === "distance-ob-skill-phase1" ||
    entry.sourceRule === "distance-ob-skill-phase2" ||
    entry.notes?.trim().toLowerCase().startsWith("distance:") === true
  );
}

function formatCompactDistanceModifierDetails(entry: ScenarioCombatModifierEntry): string {
  const notes = entry.notes ?? "";
  const actualMatch = notes.match(/\b(?:actual|declared)\s+(\d+)/i);
  const nearestMatch = notes.match(/\bnearest\s+(\d+)/i);
  const actualDistance = actualMatch ? Number(actualMatch[1]) : undefined;
  const nearestDistance = nearestMatch ? Number(nearestMatch[1]) : undefined;

  if (actualDistance !== undefined && nearestDistance !== undefined) {
    if (actualDistance > nearestDistance) {
      return "long distance";
    }

    if (actualDistance < nearestDistance) {
      return "short distance";
    }
  }

  return "distance";
}

export function formatCombatModifierDetailsLabel(
  entry: ScenarioCombatModifierEntry,
): string | undefined {
  if (
    entry.id === "generated:parry-attack:phase2:initiative" ||
    entry.sourceRule === "parry-attack-phase2-initiative"
  ) {
    return "reactive attack";
  }

  if (isGeneratedDistanceModifier(entry)) {
    return formatCompactDistanceModifierDetails(entry);
  }

  if (
    entry.sourceActionId === "attack_parry" ||
    entry.sourceRule?.startsWith("attack-parry-db-parry") === true
  ) {
    return "single attack";
  }

  if (
    entry.sourceActionId === "parry_attack" ||
    entry.sourceRule?.startsWith("parry-attack-db-parry") === true
  ) {
    return "reactive attack";
  }

  if (entry.sourceActionId === "parry") {
    const dodge = entry.notes?.match(/\bDodge\s+(-?\d+)\b/i)?.[1];
    return dodge ? `Parry ${dodge}` : "Parry";
  }

  return entry.notes?.trim() || undefined;
}

export function formatCombatModifierDisplayLine(input: {
  bucketLabel: string;
  entry: ScenarioCombatModifierEntry;
}): string {
  const details = formatCombatModifierDetailsLabel(input.entry);

  return [
    `${input.bucketLabel} ${formatSignedCombatModifier(input.entry.value)}${
      input.entry.application === "percentage" ? "%" : ""
    }`,
    formatCombatModifierScopeLabel(input.entry),
    details,
  ]
    .filter((part): part is string => Boolean(part))
    .join(" · ");
}

export function isMeaningfulCombatModifierEntry(entry: ScenarioCombatModifierEntry): boolean {
  return entry.value !== 0 || Boolean(entry.notes?.trim()) || Boolean(entry.sourceRule?.trim());
}

export function sanitizeCombatModifierEntries(
  entries: readonly ScenarioCombatModifierEntry[],
): ScenarioCombatModifierEntry[] {
  return entries.filter(isMeaningfulCombatModifierEntry);
}

export function sanitizePlayerCombatModifierContext(
  combatContext: ScenarioParticipantCombatContext,
): ScenarioParticipantCombatContext {
  return {
    ...combatContext,
    modifierBuckets: {
      ...combatContext.modifierBuckets,
      general: sanitizeCombatModifierEntries(combatContext.modifierBuckets.general),
      situationDb: sanitizeCombatModifierEntries(combatContext.modifierBuckets.situationDb),
      situationInitiative: sanitizeCombatModifierEntries(
        combatContext.modifierBuckets.situationInitiative,
      ),
      situationObSkill: sanitizeCombatModifierEntries(
        combatContext.modifierBuckets.situationObSkill,
      ),
    },
  };
}

function createModifierEntryDraft(): ScenarioCombatModifierEntry {
  return {
    application: "percentage",
    id: `modifier-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    notes: "",
    scope: "until",
    value: 0,
  };
}

export function getGmCombatStepActionLabel(step: CombatRoundStep): string {
  switch (step) {
    case "select_actions":
      return "Declare action";
    case "review_action_modifiers":
      return "Declare modifiers";
    case "initiative_phase_1":
      return "Roll phase 1 initiative";
    case "phase_1_actions":
      return "Roll phase 1 attack";
    case "review_phase_2_actions":
      return "Resolve phase 1 parry";
    case "phase_1_damage":
      return "Review phase 1 damage/effects";
    case "review_phase_2_modifiers":
      return "Declare phase 2 modifiers";
    case "initiative_phase_2":
      return "Roll phase 2 initiative";
    case "phase_2_actions":
      return "Roll phase 2 attack";
    case "review_phase_2_damage":
      return "Resolve phase 2 parry";
    case "phase_2_damage":
      return "Review phase 2 damage/effects";
    case "round_summary":
      return "Review round summary";
  }
}

export function getPlayerCombatStepLabel(step: CombatRoundStep): string {
  switch (step) {
    case "select_actions":
      return "Declare action";
    case "review_action_modifiers":
      return "Review modifiers";
    case "initiative_phase_1":
      return "Phase 1 initiative";
    case "phase_1_actions":
      return "A1 Attack";
    case "review_phase_2_actions":
      return "P1 Parry";
    case "phase_1_damage":
      return "D1 Damage/effects";
    case "review_phase_2_modifiers":
      return "Review phase 2";
    case "initiative_phase_2":
      return "Phase 2 initiative";
    case "phase_2_actions":
      return "A2 Attack";
    case "review_phase_2_damage":
      return "P2 Parry";
    case "phase_2_damage":
      return "D2 Damage/effects";
    case "round_summary":
      return "Round summary";
  }
}

export function getPlayerCombatActionButtonLabel(input: {
  currentStep?: CombatRoundStep;
  disabled: boolean;
  isGameMaster: boolean;
}): string {
  if (input.isGameMaster) {
    return getGmCombatStepActionLabel(input.currentStep ?? "select_actions");
  }

  if (input.disabled) {
    return "Waiting for GM";
  }

  return input.currentStep === "select_actions" || !input.currentStep
    ? "Declare action"
    : input.currentStep === "initiative_phase_1"
      ? "Roll phase 1 initiative"
      : input.currentStep === "initiative_phase_2"
        ? "Roll phase 2 initiative"
        : "Waiting for GM";
}

export function buildPlayerCombatModifierRows(input: {
  combatContext?: ScenarioParticipantCombatContext;
  combatEffects?: CombatEffectsState;
  currentInitiativeGroupId?: string;
  currentRound?: number;
  encounterId?: string;
  includeAllPhases?: boolean;
  liveModifiers?: EncounterLiveCombatModifierSummary;
  ownerParticipantId?: string;
  phaseKey?: EncounterCombatPhaseKey;
  visibleAtStep?: CombatRoundStep;
}): PlayerCombatModifierBucketView[] {
  const projection = buildLiveCombatModifierContributionProjection({
    combatContext: input.combatContext ?? createEmptyPlayerEncounterCombatContext(),
    combatEffects: input.combatEffects,
    currentInitiativeGroupId: input.currentInitiativeGroupId,
    currentRound: input.currentRound,
    encounterId: input.encounterId,
    ownerParticipantId: input.ownerParticipantId,
  });
  const entriesForContributions = (bucket: CombatModifierContributionBucket) =>
    projection.contributions
      .filter((contribution) => contribution.bucket === bucket)
      .map((contribution) => projection.sourceEntries.get(contribution.id))
      .filter((entry): entry is ScenarioCombatModifierEntry => Boolean(entry));
  const entriesForDisplay = (entries: ScenarioCombatModifierEntry[]) =>
    input.includeAllPhases
      ? entries
      : input.visibleAtStep
        ? getCombatModifierRowsVisibleAtStep(entries, input.visibleAtStep)
        : filterCombatModifierEntriesForPhase(entries, input.phaseKey);
  const activeFlatDbEntries = (input.combatContext?.modifierBuckets.situationDb ?? []).filter(
    (entry) => {
      if (entry.application !== "flat_db") return false;
      const contribution = normalizeScenarioCombatModifierEntry({
        bucket: "situation_db",
        currentRound: input.currentRound,
        entry,
        ownerParticipantId: input.ownerParticipantId ?? "unknown-participant",
      });
      return Boolean(
        contribution &&
        isCombatModifierContributionActive(contribution, {
          ...(input.encounterId ? { encounterId: input.encounterId } : {}),
          ...(input.currentRound !== undefined ? { roundNumber: input.currentRound } : {}),
          ownerParticipantId: input.ownerParticipantId ?? "unknown-participant",
        }),
      );
    },
  );
  const visibleFlatDbEntries = entriesForDisplay(activeFlatDbEntries);
  const displayModifierBuckets = {
    general: sanitizeCombatModifierEntries(
      entriesForDisplay(entriesForContributions("general_fatigue")),
    ),
    situationDb: sanitizeCombatModifierEntries([
      ...entriesForDisplay(entriesForContributions("db_parry")),
      ...visibleFlatDbEntries,
    ]),
    situationInitiative: sanitizeCombatModifierEntries(
      entriesForDisplay(entriesForContributions("initiative")),
    ),
    situationObSkill: sanitizeCombatModifierEntries(
      entriesForDisplay(entriesForContributions("skill_ob")),
    ),
  };
  const applicableContributions = projection.contributions.filter(
    (contribution) =>
      !contribution.applicability.phase ||
      (input.phaseKey !== undefined && contribution.applicability.phase === input.phaseKey),
  );
  const opponentSpecificContributions = input.liveModifiers?.opponentSpecificContributions ?? [];
  const derivedEntriesByBucket = new Map<
    CombatModifierContributionBucket,
    PlayerCombatModifierDisplayEntry[]
  >();
  for (const contribution of opponentSpecificContributions) {
    const entries = derivedEntriesByBucket.get(contribution.bucket) ?? [];
    entries.push({
      application: "percentage",
      canonicalLifecycle: contribution.canonicalLifecycle,
      id: contribution.id,
      scopeLabel: "Opponent",
      sourceLabel: `${contribution.label}${
        input.liveModifiers?.opponentLabel ? ` · ${input.liveModifiers.opponentLabel}` : ""
      }`,
      value: contribution.value,
    });
    derivedEntriesByBucket.set(contribution.bucket, entries);
  }
  const legacyGeneralEntries = (input.liveModifiers?.legacyGeneralEffectEntries ?? []).map(
    (entry): PlayerCombatModifierDisplayEntry => ({
      application: "percentage",
      id: `legacy-effect:${entry.id}`,
      scopeLabel: "Active",
      sourceLabel: entry.label,
      value: entry.value,
    }),
  );
  const totals = {
    dbParry:
      applicableContributions
        .filter((contribution) => contribution.bucket === "db_parry")
        .reduce((total, contribution) => total + contribution.value, 0) +
      visibleFlatDbEntries.reduce((total, entry) => total + entry.value, 0) +
      opponentSpecificContributions
        .filter((contribution) => contribution.bucket === "db_parry")
        .reduce((total, contribution) => total + contribution.value, 0),
    generalFatigue:
      applicableContributions
        .filter((contribution) => contribution.bucket === "general_fatigue")
        .reduce((total, contribution) => total + contribution.value, 0) +
      legacyGeneralEntries.reduce((total, entry) => total + entry.value, 0),
    initiative: applicableContributions
      .filter((contribution) => contribution.bucket === "initiative")
      .reduce((total, contribution) => total + contribution.value, 0),
    skillOb:
      applicableContributions
        .filter((contribution) => contribution.bucket === "skill_ob")
        .reduce((total, contribution) => total + contribution.value, 0) +
      opponentSpecificContributions
        .filter((contribution) => contribution.bucket === "skill_ob")
        .reduce((total, contribution) => total + contribution.value, 0),
  };

  return [
    {
      bucketKey: "general",
      derivedEntries: legacyGeneralEntries,
      entries: displayModifierBuckets.general,
      label: "General/Fatigue",
      locked: true,
      total: totals.generalFatigue,
    },
    {
      bucketKey: "situation_initiative",
      entries: displayModifierBuckets.situationInitiative,
      label: "Initiative",
      total: totals.initiative,
    },
    {
      bucketKey: "situation_ob_skill",
      entries: displayModifierBuckets.situationObSkill,
      derivedEntries: derivedEntriesByBucket.get("skill_ob"),
      label: "Skill/OB",
      total: totals.skillOb,
    },
    {
      bucketKey: "situation_db",
      entries: displayModifierBuckets.situationDb,
      derivedEntries: derivedEntriesByBucket.get("db_parry"),
      label: "DB/Parry",
      total: totals.dbParry,
    },
  ];
}

function CombatSituationRow({ row }: { row: CombatSituationDisplayRow }) {
  return (
    <div
      style={{
        alignItems: "start",
        display: "grid",
        fontSize: "0.84rem",
        gap: "0.15rem 0.5rem",
        gridTemplateColumns: "minmax(0, 1fr) auto",
      }}
    >
      <span style={{ fontWeight: 600 }}>{row.label}</span>
      {row.valueLabel ? <span style={{ fontWeight: 700 }}>{row.valueLabel}</span> : null}
      {row.scopeLabel || row.durationLabel ? (
        <span
          style={{
            color: "#5e5a50",
            fontSize: "0.78rem",
            gridColumn: "1 / -1",
          }}
        >
          {[row.scopeLabel, row.durationLabel].filter(Boolean).join(" · ")}
        </span>
      ) : null}
    </div>
  );
}

function CombatSituationSummary(input: {
  context?: CombatSituationContext;
  embedded?: boolean;
  hideCalculationGroups?: boolean;
  lifecycleEffects?: readonly CombatSituationLifecycleEffect[];
  pendingActivationLabel?: string;
  pendingEntries: readonly ScenarioCombatModifierEntry[];
  pendingRows?: readonly CombatSituationDisplayRow[];
  provisional: boolean;
  rows: readonly PlayerCombatModifierBucketView[];
  sourceLabel?: string;
}) {
  const model = buildCombatSituationAwarenessModel({
    context: input.context,
    lifecycleEffects: input.lifecycleEffects,
    pendingEntries: input.pendingEntries,
    pendingRows: input.pendingRows,
    provisional: input.provisional,
    rows: input.rows,
  });
  const semanticGroups = [
    { id: "conditions", label: "Persistent conditions", rows: model.conditions },
    { id: "restrictions", label: "Restrictions", rows: model.restrictions },
    { id: "pending", label: "Pending / expiring", rows: model.pending },
  ].filter((group) => group.rows.length > 0);

  const content = (
    <>
      {!input.embedded ? (
        <PanelTitleWithSource label="Combat situation" sourceLabel={input.sourceLabel} />
      ) : null}
      {model.provisional ? (
        <span style={{ color: "#5e5a50", fontSize: "0.78rem", fontWeight: 700 }}>Provisional</span>
      ) : null}
      {!input.hideCalculationGroups && model.calculationGroups.length > 0 ? (
        <div style={{ display: "grid", gap: "0.65rem" }}>
          <strong style={{ fontSize: "0.9rem" }}>Current</strong>
          {model.calculationGroups.map((group) => (
            <div key={group.id} style={{ display: "grid", gap: "0.3rem" }}>
              <div style={compactModifierGroupHeaderStyle}>
                <span style={{ fontSize: "0.86rem", fontWeight: 700 }}>{group.label}</span>
                <span style={{ color: "#5e5a50", fontSize: "0.86rem" }}>
                  Total {group.totalLabel}
                </span>
              </div>
              <div style={{ display: "grid", gap: "0.35rem" }}>
                {group.rows.map((row) => (
                  <CombatSituationRow key={row.id} row={row} />
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : null}
      {semanticGroups.map((group) => (
        <div
          key={group.id}
          style={{
            borderTop: "1px solid #d7d1c2",
            display: "grid",
            gap: "0.4rem",
            paddingTop: "0.55rem",
          }}
        >
          <strong style={{ fontSize: "0.9rem" }}>{group.label}</strong>
          {group.rows.map((row) => (
            <CombatSituationRow key={row.id} row={row} />
          ))}
          {group.id === "pending" && input.pendingActivationLabel ? (
            <span style={{ color: "#5e5a50", fontSize: "0.78rem" }}>
              {input.pendingActivationLabel}
            </span>
          ) : null}
        </div>
      ))}
      {model.empty ? (
        <span style={{ color: "#5e5a50", fontSize: "0.85rem" }}>No active modifiers.</span>
      ) : null}
    </>
  );

  return input.embedded ? (
    <div style={{ display: "grid", gap: "0.65rem" }}>{content}</div>
  ) : (
    <section style={playerCombatPanelCardStyle}>{content}</section>
  );
}

function buildImportedModifierDisplayEntry(
  entry: ScenarioCombatModifierEntry,
): PlayerCombatModifierDisplayEntry {
  return {
    application: entry.application,
    details: entry.notes,
    id: entry.id,
    scopeLabel:
      entry.sourceDuration?.trim() ??
      (entry.expiresAtRound ? `until RD ${entry.expiresAtRound}` : "until SU"),
    sourceLabel: "Character/state",
    value: entry.value,
  };
}

function buildSituationalModifierDisplayEntry(
  entry: ScenarioCombatModifierEntry,
): PlayerCombatModifierDisplayEntry {
  return {
    application: entry.application,
    details: formatCombatModifierDetailsLabel(entry),
    id: entry.id,
    scopeLabel: formatCombatModifierScopeLabel(entry),
    sourceLabel: entry.sourceActionId === "parry" ? "Parry" : "Situational",
    value: entry.value,
  };
}

function ModifierDisplayEntryRow({
  bucketLabel,
  entry,
}: {
  bucketLabel: string;
  entry: PlayerCombatModifierDisplayEntry;
}) {
  const formattedValue = `${formatSignedCombatModifier(entry.value)}${
    entry.application === "percentage" ? "%" : ""
  }`;

  return (
    <div
      key={`${entry.sourceLabel}:${entry.id}`}
      style={compactModifierDisplayRowStyle}
      title={`${bucketLabel} ${formattedValue} · ${entry.scopeLabel}${
        entry.details ? ` · ${entry.details}` : ""
      }`}
    >
      <div style={compactModifierDisplayTopRowStyle}>
        <span>{entry.sourceLabel}</span>
        <span>{formattedValue}</span>
        <span>{entry.scopeLabel}</span>
      </div>
      <div style={compactModifierDetailsRowStyle}>
        <span style={{ color: "#1f1b14", fontWeight: 700 }}>Details</span>
        <span
          style={{
            minWidth: 0,
            overflowWrap: "break-word",
          }}
        >
          {entry.details ?? "—"}
        </span>
      </div>
    </div>
  );
}

function ModifierEditableEntryRow({
  bucketLabel,
  controlsDisabled,
  entry,
  onRemove,
  onUpdate,
}: {
  bucketLabel: string;
  controlsDisabled: boolean;
  entry: ScenarioCombatModifierEntry;
  onRemove: () => void;
  onUpdate: (
    patch: Partial<Pick<ScenarioCombatModifierEntry, "durationRounds" | "notes" | "value">>,
  ) => void;
}) {
  const scopeLabel = formatCombatModifierScopeLabel(entry);
  const detailsValue = entry.generated
    ? (formatCombatModifierDetailsLabel(entry) ?? entry.notes ?? "")
    : (entry.notes ?? "");

  return (
    <div style={compactModifierMiniTableEntryRowStyle}>
      <div style={compactModifierEntryTopRowStyle}>
        <span style={{ color: "#5e5a50", fontSize: "0.84rem" }}>
          {entry.sourceActionId === "parry" ? "Parry" : "Situational"} · {scopeLabel}
        </span>
        <input
          aria-label={`${bucketLabel} modifier value`}
          disabled={controlsDisabled}
          onChange={(event) =>
            onUpdate({
              value: event.target.value.length > 0 ? Number(event.target.value) : 0,
            })
          }
          style={compactModifierNumberInputStyle}
          type="number"
          value={entry.value}
        />
        <input
          aria-label={`${bucketLabel} modifier duration`}
          disabled={controlsDisabled}
          min={1}
          onChange={(event) =>
            onUpdate({
              durationRounds:
                event.target.value.length > 0 ? Number(event.target.value) : undefined,
            })
          }
          style={compactModifierNumberInputStyle}
          type="number"
          value={entry.durationRounds ?? ""}
        />
      </div>
      <div style={compactModifierEditableDetailsRowStyle}>
        <span style={{ color: "#1f1b14", fontSize: "0.78rem", fontWeight: 700 }}>Details</span>
        <input
          aria-label={`${bucketLabel} modifier details`}
          disabled={controlsDisabled}
          onChange={(event) =>
            onUpdate({
              notes: event.target.value,
            })
          }
          placeholder="Details"
          style={compactModifierDetailsInputStyle}
          type="text"
          value={detailsValue}
        />
        <button
          aria-label="Remove modifier"
          disabled={controlsDisabled}
          onClick={onRemove}
          style={compactModifierRemoveButtonStyle}
          title="Remove modifier"
          type="button"
        >
          -
        </button>
      </div>
    </div>
  );
}

export function PlayerCombatModifierPanel({
  activeSpecialEffectCount = 0,
  context,
  controlsDisabled = false,
  onAddEntry,
  onRemoveEntry,
  onUpdateEntry,
  pendingActivationLabel,
  pendingEntries = [],
  pendingRows = [],
  provisional = false,
  lifecycleEffects,
  readOnly = false,
  rows,
  showEmptyCategories = false,
  sourceLabel,
  observationRelationships = [],
  observationTargetLabels = {},
}: PlayerCombatModifierPanelProps) {
  const editable = !readOnly && onAddEntry && onRemoveEntry && onUpdateEntry;
  const groupedFeintDisplays = buildGroupedFeintModifierDisplays(rows);
  const groupedFeintEntryIds = new Set(groupedFeintDisplays.flatMap((group) => group.entryIds));
  const [draftEntries, setDraftEntries] = useState<
    Partial<Record<ScenarioCombatModifierBucket, ScenarioCombatModifierEntry>>
  >({});

  if (!editable) {
    return (
      <CombatSituationSummary
        context={context}
        lifecycleEffects={lifecycleEffects}
        pendingActivationLabel={pendingActivationLabel}
        pendingEntries={pendingEntries}
        pendingRows={pendingRows}
        provisional={provisional}
        rows={rows}
        sourceLabel={sourceLabel}
      />
    );
  }

  const setDraftEntry = (
    bucketKey: ScenarioCombatModifierBucket,
    entry?: ScenarioCombatModifierEntry,
  ) => {
    setDraftEntries((current) => {
      const next = { ...current };

      if (entry) {
        next[bucketKey] = entry;
      } else {
        delete next[bucketKey];
      }

      return next;
    });
  };

  return (
    <section style={playerCombatPanelCardStyle}>
      <PanelTitleWithSource label="Combat situation" sourceLabel={sourceLabel} />
      <CombatSituationSummary
        context={context}
        embedded
        hideCalculationGroups
        lifecycleEffects={lifecycleEffects}
        pendingActivationLabel={pendingActivationLabel}
        pendingEntries={pendingEntries}
        provisional={provisional}
        rows={rows}
        sourceLabel={sourceLabel}
      />
      <strong style={{ fontSize: "0.9rem" }}>Current / GM changes / resulting</strong>
      {rows
        .filter(
          (row) =>
            showEmptyCategories ||
            row.total !== 0 ||
            row.entries.length > 0 ||
            (row.characterStateEntries?.length ?? 0) > 0 ||
            (row.derivedEntries?.length ?? 0) > 0,
        )
        .map((row) => {
          const draftEntry = draftEntries[row.bucketKey];
          const displayEntries = [
            ...row.entries,
            ...(row.characterStateEntries ?? []),
            ...(row.derivedEntries ?? []),
          ];
          const totalIsPercentage =
            displayEntries.length > 0 &&
            displayEntries.every((entry) => entry.application === "percentage");
          const importedEntries = row.entries.filter(isPersistentCombatModifierEntry);
          const situationalEntries = row.entries.filter(
            (entry) =>
              !isPersistentCombatModifierEntry(entry) && !groupedFeintEntryIds.has(entry.id),
          );
          const groupedFeintDisplayEntries =
            row.bucketKey === "situation_ob_skill"
              ? groupedFeintDisplays.map(
                  (group): PlayerCombatModifierDisplayEntry => ({
                    details: "feint result",
                    id: `grouped-feint:${group.resultGroupId}`,
                    scopeLabel: "P2",
                    sourceLabel: "Feint · OB/DB",
                    value: group.value,
                  }),
                )
              : [];
          const persistentDisplayEntries = [
            ...(row.characterStateEntries ?? []),
            ...importedEntries.map(buildImportedModifierDisplayEntry),
            ...groupedFeintDisplayEntries,
            ...(row.derivedEntries ?? []),
          ];
          const hasVisibleRows =
            persistentDisplayEntries.length > 0 ||
            situationalEntries.length > 0 ||
            Boolean(draftEntry);

          return (
            <div key={row.bucketKey} style={{ display: "grid", gap: "0.35rem" }}>
              <div style={compactModifierGroupHeaderStyle}>
                <div style={{ alignItems: "center", display: "flex", gap: "0.5rem" }}>
                  <span style={{ fontSize: "0.9rem", fontWeight: 600 }}>{row.label}</span>
                  <span style={{ color: "#5e5a50", fontSize: "0.9rem" }}>
                    {getDisplayTotal(row) >= 0 ? "+" : ""}
                    {getDisplayTotal(row)}
                    {totalIsPercentage ? "%" : ""}
                  </span>
                </div>
                {!row.locked ? (
                  <button
                    disabled={controlsDisabled || Boolean(draftEntry)}
                    onClick={() => setDraftEntry(row.bucketKey, createModifierEntryDraft())}
                    style={{ justifySelf: "end" }}
                    type="button"
                  >
                    Add
                  </button>
                ) : null}
              </div>

              {hasVisibleRows ? (
                <div style={compactModifierMiniTableStyle}>
                  {persistentDisplayEntries.length > 0 ? (
                    <div style={compactModifierDisplayHeaderStyle}>
                      {["Source/scope", "Mod", "Dur"].map((heading) => (
                        <span
                          key={heading}
                          style={{
                            color: "#1f1b14",
                            fontSize: "0.78rem",
                            fontWeight: 700,
                          }}
                        >
                          {heading}
                        </span>
                      ))}
                    </div>
                  ) : null}
                  {persistentDisplayEntries.map((entry) => (
                    <ModifierDisplayEntryRow
                      bucketLabel={row.label}
                      entry={entry}
                      key={`${entry.sourceLabel}:${entry.id}`}
                    />
                  ))}
                  {!row.locked ? (
                    <>
                      {situationalEntries.length > 0 || draftEntry ? (
                        <div style={compactModifierMiniTableHeaderStyle}>
                          {["Source/scope", "Mod", "Dur"].map((heading) => (
                            <span key={heading} style={{ fontSize: "0.78rem", fontWeight: 700 }}>
                              {heading}
                            </span>
                          ))}
                        </div>
                      ) : null}
                      {situationalEntries.map((entry) => (
                        <ModifierEditableEntryRow
                          bucketLabel={row.label}
                          controlsDisabled={controlsDisabled}
                          entry={entry}
                          key={entry.id}
                          onRemove={() => onRemoveEntry(row.bucketKey, entry.id)}
                          onUpdate={(patch) => {
                            const nextEntry = { ...entry, ...patch };

                            if (isMeaningfulCombatModifierEntry(nextEntry)) {
                              onUpdateEntry(row.bucketKey, entry.id, patch);
                            } else {
                              onRemoveEntry(row.bucketKey, entry.id);
                            }
                          }}
                        />
                      ))}
                      {draftEntry ? (
                        <ModifierEditableEntryRow
                          bucketLabel={row.label}
                          controlsDisabled={controlsDisabled}
                          entry={draftEntry}
                          key={draftEntry.id}
                          onRemove={() => setDraftEntry(row.bucketKey)}
                          onUpdate={(patch) => {
                            const nextEntry = { ...draftEntry, ...patch };

                            if (isMeaningfulCombatModifierEntry(nextEntry)) {
                              onAddEntry(row.bucketKey, nextEntry);
                              setDraftEntry(row.bucketKey);
                            } else {
                              setDraftEntry(row.bucketKey, nextEntry);
                            }
                          }}
                        />
                      ) : null}
                    </>
                  ) : (
                    situationalEntries.map((entry) => (
                      <ModifierDisplayEntryRow
                        bucketLabel={row.label}
                        entry={buildSituationalModifierDisplayEntry(entry)}
                        key={`Situational:${entry.id}`}
                      />
                    ))
                  )}
                </div>
              ) : null}
            </div>
          );
        })}
      {pendingEntries.length > 0 ? (
        <div
          style={{
            borderTop: "1px solid #d7d1c2",
            display: "grid",
            gap: "0.35rem",
            paddingTop: "0.55rem",
          }}
        >
          <strong style={{ fontSize: "0.9rem" }}>Proposed</strong>
          {pendingEntries.map((entry) => (
            <div key={entry.id} style={{ fontSize: "0.82rem" }}>
              {entry.notes?.trim() || "Combat effect"} {entry.value >= 0 ? "+" : ""}
              {entry.value}
              <div style={{ color: "#5e5a50" }}>
                {pendingActivationLabel ?? "Effective from the next initiative group"}
              </div>
            </div>
          ))}
        </div>
      ) : null}
      {activeSpecialEffectCount > 0 ? (
        <div
          style={{
            borderTop: "1px solid #d7d1c2",
            display: "grid",
            gap: "0.3rem",
            paddingTop: "0.55rem",
          }}
        >
          <strong style={{ fontSize: "0.9rem" }}>Active special effects</strong>
          <span style={{ color: "#5e5a50", fontSize: "0.82rem" }}>{activeSpecialEffectCount}</span>
        </div>
      ) : null}
      {observationRelationships.some((relationship) => relationship.bestBonus > 0) ? (
        <div
          style={{
            borderTop: "1px solid #d7d1c2",
            display: "grid",
            gap: "0.3rem",
            paddingTop: "0.55rem",
          }}
        >
          {observationRelationships
            .filter((relationship) => relationship.bestBonus > 0)
            .map((relationship) => (
              <div
                key={`observation-modifier:${relationship.id}`}
                style={{
                  alignItems: "center",
                  display: "grid",
                  fontSize: "0.84rem",
                  gap: "0.5rem",
                  gridTemplateColumns: "1fr auto",
                }}
              >
                <span>
                  Observe Opponent ·{" "}
                  {observationTargetLabels[relationship.targetParticipantId] ??
                    relationship.targetParticipantId}
                </span>
                <strong>+{relationship.bestBonus}%</strong>
              </div>
            ))}
        </div>
      ) : null}
    </section>
  );
}

export function PlayerCombatObservationProgress({
  relationships,
  targetLabels,
}: PlayerCombatObservationProgressProps) {
  if (relationships.length === 0) return null;

  return (
    <div style={{ display: "grid", gap: "0.35rem" }}>
      <strong style={{ fontSize: "0.88rem" }}>Observation progress</strong>
      <div style={{ display: "grid", gap: "0.55rem" }}>
        {relationships.map((relationship) => {
          const required =
            relationship.completedAttempts === 0
              ? 3
              : relationship.completedAttempts === 1
                ? 6
                : 10;
          return (
            <div key={relationship.id} style={{ fontSize: "0.84rem" }}>
              <span>
                {targetLabels[relationship.targetParticipantId] ?? relationship.targetParticipantId}
                : {relationship.roundsTowardNextAttempt} / {required}
                {relationship.bestBonus > 0 ? ` · best +${relationship.bestBonus}%` : ""}
                {relationship.completedAttempts > 0
                  ? ` · attempts ${relationship.completedAttempts}`
                  : ""}
                {relationship.lastAttempt
                  ? ` · last margin ${relationship.lastAttempt.difference >= 0 ? "+" : ""}${relationship.lastAttempt.difference} / candidate +${relationship.lastAttempt.candidateBonus}%`
                  : ""}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function PlayerCombatActionSelectorPanel({
  actionId,
  actionOptions = PLAYER_ENCOUNTER_ACTION_OPTIONS,
  additionalActionNotes,
  controlsDisabled = false,
  declarationRecorded = false,
  distancePreferenceOptions = [],
  movementId,
  movementIntent,
  onActionChange,
  onAdditionalActionNotesChange,
  onMovementChange,
  onMovementIntentChange,
  onSecondaryActionChange,
  roundNumber,
  secondaryActionId,
  sourceLabel,
}: PlayerCombatActionSelectorPanelProps) {
  const compatiblePrimaryActionIds = new Set(
    getPlayerEncounterPrimaryActionOptions(secondaryActionId).map((option) => option.value),
  );
  const primaryActionOptions = actionOptions.filter((option) =>
    compatiblePrimaryActionIds.has(option.value),
  );
  const secondaryActionOptions = getPlayerEncounterSecondaryActionOptions(actionId);
  const compatibilityMessage = getPlayerEncounterDeclarationCompatibilityMessage({
    actionId,
    secondaryActionId,
  });
  const selectedActionIsListed = primaryActionOptions.some((option) => option.value === actionId);
  const selectedSecondaryActionIsListed = secondaryActionOptions.some(
    (option) => option.value === secondaryActionId,
  );
  const effectiveMovementIntent =
    movementIntent ??
    ({
      distancePreferences: [],
      mode: movementId && movementId !== "hold" ? "set_distance_preferences" : "hold_position",
    } satisfies MovementIntent);
  const updateMovementMode = (mode: MovementIntent["mode"]) => {
    onMovementChange(mode === "hold_position" ? "hold" : "step");
    onMovementIntentChange?.({
      distancePreferences:
        mode === "set_distance_preferences"
          ? distancePreferenceOptions
              .filter((option) => option.defaultDistance !== undefined)
              .map((option) => ({
                desiredDistance: option.defaultDistance as CombatDistance,
                source: "player_declared" as const,
                targetParticipantId: option.id,
              }))
          : [],
      mode,
    });
  };
  const updateDistancePreference = (targetParticipantId: string, desiredDistance: string) => {
    const nextPreferences = effectiveMovementIntent.distancePreferences.filter(
      (preference) => preference.targetParticipantId !== targetParticipantId,
    );

    if (desiredDistance !== "") {
      nextPreferences.push({
        desiredDistance: Number(desiredDistance) as CombatDistance,
        source: "player_declared",
        targetParticipantId,
      });
    }

    onMovementIntentChange?.({
      distancePreferences: nextPreferences,
      mode: "set_distance_preferences",
    });
  };

  return (
    <section style={playerCombatPanelCardStyle}>
      <PanelTitleWithSource
        label={`Action selector${roundNumber ? ` · Round ${roundNumber}` : ""}`}
        sourceLabel={sourceLabel}
      />
      {declarationRecorded ? (
        <div style={{ color: "#3f5f46", fontSize: "0.88rem", fontWeight: 650 }}>
          Action declared.
        </div>
      ) : null}
      {compatibilityMessage ? (
        <div
          aria-live="polite"
          role="status"
          style={{ color: "#7a321f", fontSize: "0.86rem", fontWeight: 600 }}
        >
          {compatibilityMessage}
        </div>
      ) : null}
      <label style={compactFieldLabelStyle}>
        <span style={{ fontSize: "0.88rem", fontWeight: 600 }}>Action</span>
        <select
          disabled={controlsDisabled}
          onChange={(event) => onActionChange(event.target.value as PlayerEncounterActionId | "")}
          style={{ maxWidth: "100%", width: "100%" }}
          value={actionId}
        >
          <option value="">Choose action</option>
          {actionId && !selectedActionIsListed ? (
            <option disabled value={actionId}>
              {getPlayerEncounterActionLabel(actionId)}
              {isCombatDeclarationActionAvailable({ actionId, kind: "primary" })
                ? ""
                : " · Unavailable"}
              {isCombatDeclarationActionAvailable({ actionId, kind: "primary" }) &&
              secondaryActionId
                ? ` · Not compatible with ${getPlayerEncounterActionLabel(secondaryActionId)}`
                : ""}
            </option>
          ) : null}
          {primaryActionOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </label>
      <label style={compactFieldLabelStyle}>
        <span style={{ fontSize: "0.88rem", fontWeight: 600 }}>Secondary action</span>
        <select
          disabled={controlsDisabled}
          onChange={(event) =>
            onSecondaryActionChange(event.target.value as PlayerEncounterActionId | "")
          }
          style={{ maxWidth: "100%", width: "100%" }}
          value={secondaryActionId}
        >
          <option value="">{actionId === "parry" ? "None" : "Open"}</option>
          {secondaryActionId && !selectedSecondaryActionIsListed ? (
            <option disabled value={secondaryActionId}>
              {getPlayerEncounterActionLabel(secondaryActionId)}
              {isCombatDeclarationActionAvailable({
                actionId: secondaryActionId,
                kind: "secondary",
              })
                ? ""
                : " · Unavailable"}
              {isCombatDeclarationActionAvailable({
                actionId: secondaryActionId,
                kind: "secondary",
              }) && actionId
                ? ` · Not compatible with ${getPlayerEncounterActionLabel(actionId)}`
                : ""}
            </option>
          ) : null}
          {secondaryActionOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.value === "observe_opponent" ? "Observe opponent" : option.label}
            </option>
          ))}
        </select>
      </label>

      <label style={compactFieldLabelStyle}>
        <span style={{ fontSize: "0.88rem", fontWeight: 600 }}>Movement</span>
        <select
          disabled={controlsDisabled}
          onChange={(event) => updateMovementMode(event.target.value as MovementIntent["mode"])}
          value={effectiveMovementIntent.mode}
        >
          <option value="hold_position">Maintain distance to opponent</option>
          <option value="set_distance_preferences">Set preferred distance</option>
        </select>
      </label>

      {effectiveMovementIntent.mode === "set_distance_preferences" ? (
        <section style={compactDistancePreferenceGridStyle}>
          {distancePreferenceOptions.length === 0 ? (
            <div style={{ color: "#5e5a50", fontSize: "0.84rem" }}>
              No visible opponents available.
            </div>
          ) : (
            distancePreferenceOptions.map((option) => {
              const preference = effectiveMovementIntent.distancePreferences.find(
                (entry) => entry.targetParticipantId === option.id,
              );

              return (
                <label key={option.id} style={compactDistancePreferenceRowStyle}>
                  <span
                    style={{
                      fontSize: "0.84rem",
                      minWidth: 0,
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                    title={option.displayName}
                  >
                    {option.displayName}
                  </span>
                  <select
                    disabled={controlsDisabled}
                    onChange={(event) => updateDistancePreference(option.id, event.target.value)}
                    value={
                      preference?.desiredDistance !== undefined
                        ? String(preference.desiredDistance)
                        : ""
                    }
                  >
                    <option value="">No preference</option>
                    <optgroup label="Melee zones">
                      {[0, 1, 2, 3, 4].map((distance) => (
                        <option key={distance} value={distance}>
                          Distance {distance}
                        </option>
                      ))}
                    </optgroup>
                    <optgroup label="Extended">
                      {[5, 6, 7, 8].map((distance) => (
                        <option key={distance} value={distance}>
                          Distance {distance}
                        </option>
                      ))}
                    </optgroup>
                  </select>
                </label>
              );
            })
          )}
        </section>
      ) : null}

      <label style={compactWideFieldLabelStyle}>
        <span style={{ fontSize: "0.88rem", fontWeight: 600 }}>Description</span>
        <input
          disabled={controlsDisabled}
          onChange={(event) => onAdditionalActionNotesChange(event.target.value)}
          placeholder="Free text for intent, target, or table notes"
          type="text"
          value={additionalActionNotes}
        />
      </label>
    </section>
  );
}

export function PlayerCombatHistoricalActionSelectorPanel({
  actionLabel,
  additionalActionNotes,
  declarationRecorded = false,
  distancePreferences = [],
  movementLabel,
  roundNumber,
  secondaryActionLabel,
}: PlayerCombatHistoricalActionSelectorPanelProps) {
  return (
    <section style={playerCombatPanelCardStyle}>
      <PanelTitleWithSource
        label={`Action selector${roundNumber ? ` · Round ${roundNumber}` : ""}`}
        sourceLabel="History"
      />
      {declarationRecorded ? (
        <div style={{ color: "#3f5f46", fontSize: "0.88rem", fontWeight: 650 }}>
          Action declared.
        </div>
      ) : null}
      <HistoricalField label="Action" value={actionLabel} />
      <HistoricalField label="Secondary action" value={secondaryActionLabel ?? "None"} />
      <HistoricalField label="Movement" value={movementLabel} />
      {distancePreferences.map((preference) => (
        <HistoricalField
          key={preference.displayName}
          label={preference.displayName}
          value={
            preference.desiredDistance === undefined
              ? "No preference"
              : `Distance ${preference.desiredDistance}`
          }
        />
      ))}
      <HistoricalField label="Description" value={additionalActionNotes || "None"} />
    </section>
  );
}

function HistoricalField(input: { label: string; value?: string }) {
  return (
    <div style={{ display: "grid", gap: "0.15rem" }}>
      <strong style={{ fontSize: "0.88rem" }}>{input.label}</strong>
      <span style={{ color: "#5e5a50", fontSize: "0.9rem" }}>
        {input.value || "No recorded information"}
      </span>
    </div>
  );
}

export function PlayerCombatHistoricalContextPanel(input: {
  context?: string;
  roundNumber?: number;
  stepLabel?: string;
}) {
  return (
    <section aria-label="Historical context" style={playerCombatPanelCardStyle}>
      <strong>Historical context</strong>
      {input.roundNumber ? <div>Round {input.roundNumber}</div> : null}
      {input.stepLabel ? <div>{input.stepLabel}</div> : null}
      {input.context ? (
        <div style={{ color: "#5e5a50", fontSize: "0.88rem" }}>{input.context}</div>
      ) : null}
    </section>
  );
}

export function PlayerCombatActionButtonPanel({
  disabled = false,
  onDeclareAction,
  preActionControls,
  onSecondaryAction,
  secondaryButtonDisabled = false,
  secondaryButtonLabel,
  saving = false,
  statusText,
  presentation,
  validationMessage,
  validationMessageTone = "error",
}: PlayerCombatActionButtonPanelProps) {
  const primaryAction = presentation?.primaryAction;
  const actionDisabled =
    disabled ||
    saving ||
    Boolean(primaryAction && (!primaryAction.enabled || !primaryAction.viewerMayInvoke));
  const primaryActionAvailable = Boolean(
    presentation?.taskId && primaryAction?.descriptor && primaryAction.viewerMayInvoke,
  );
  return (
    <section style={playerCombatPanelCardStyle}>
      <strong>Current action</strong>
      {presentation ? (
        <div style={{ display: "grid", gap: "0.35rem" }}>
          <strong>{presentation.heading}</strong>
          <div>{presentation.summary}</div>
          {presentation.weapon ||
          presentation.distance ||
          presentation.damageRollExpression ||
          presentation.difficulty !== undefined ? (
            <div
              style={{
                color: "#4f5f57",
                display: "flex",
                flexWrap: "wrap",
                gap: "0.25rem 0.8rem",
              }}
            >
              {presentation.weapon ? <span>Weapon: {presentation.weapon.label}</span> : null}
              {presentation.distance?.current !== undefined ? (
                <span>
                  Distance: {presentation.distance.current}
                  {presentation.distance.requested !== undefined
                    ? ` → ${presentation.distance.requested}`
                    : ""}
                </span>
              ) : null}
              {presentation.difficulty !== undefined ? (
                <span>Difficulty: {presentation.difficulty}</span>
              ) : null}
              {presentation.damageRollExpression ? (
                <span>Die: {presentation.damageRollExpression}</span>
              ) : null}
            </div>
          ) : null}
          <div style={{ fontWeight: 650 }}>{presentation.requiredNow}</div>
        </div>
      ) : null}
      {preActionControls ? (
        <div style={{ display: "grid", gap: "0.35rem" }}>{preActionControls}</div>
      ) : null}
      {primaryActionAvailable ? (
        <button
          disabled={actionDisabled}
          onClick={(event) => {
            event.preventDefault();
            onDeclareAction?.(primaryAction?.descriptor);
          }}
          style={{
            background: actionDisabled ? "#e4e0d6" : "#ded4b1",
            border: "1px solid #bdb39a",
            borderRadius: 10,
            color: actionDisabled ? "#8a8477" : "#2f2415",
            cursor: actionDisabled ? "not-allowed" : "pointer",
            justifySelf: "center",
            minHeight: 70,
            padding: "0.75rem 0.9rem",
            textAlign: "center",
            width: "80%",
          }}
          type="button"
        >
          <strong>{saving ? "Saving..." : primaryAction?.label}</strong>
        </button>
      ) : null}
      {secondaryButtonLabel ? (
        <button
          disabled={secondaryButtonDisabled || saving}
          onClick={(event) => {
            event.preventDefault();
            onSecondaryAction?.();
          }}
          style={{ justifySelf: "center", width: "80%" }}
          type="button"
        >
          {secondaryButtonLabel}
        </button>
      ) : null}
      {statusText && !presentation ? (
        <div style={{ color: "#5e5a50", fontSize: "0.92rem" }}>{statusText}</div>
      ) : null}
      {validationMessage ? (
        <div
          style={{
            color: validationMessageTone === "neutral" ? "#5e5a50" : "#8b3a1a",
            fontSize: "0.9rem",
            fontWeight: 600,
          }}
        >
          {validationMessage}
        </div>
      ) : null}
    </section>
  );
}

export function PlayerCombatActionResultPanel({
  result,
  title = "Action result",
}: PlayerCombatActionResultPanelProps) {
  return (
    <section
      aria-label={title}
      style={{
        ...playerCombatPanelCardStyle,
        alignContent: "start",
      }}
    >
      <strong>{title}</strong>
      <div
        style={{
          alignItems: "center",
          background: "#f6f5ef",
          border: "1px solid #d9ddd8",
          borderRadius: 8,
          boxSizing: "border-box",
          display: "grid",
          fontSize: "0.98rem",
          fontWeight: 700,
          gap: "0.35rem",
          justifyContent: "center",
          justifyItems: "center",
          minHeight: 58,
          padding: "0.45rem 0.6rem",
          textAlign: "center",
          width: "100%",
        }}
      >
        {result?.sections?.length ? (
          <div
            style={{
              display: "grid",
              fontWeight: 400,
              gap: "0.55rem",
              justifyItems: "stretch",
              textAlign: "left",
              width: "100%",
            }}
          >
            {result.sections.map((section) => (
              <section key={section.title} style={{ display: "grid", gap: "0.16rem" }}>
                <div>{section.title}</div>
                {section.calculations.map((calculation) => (
                  <CombatCalculationPanel
                    key={calculation.calculationId}
                    presentation={calculation}
                  />
                ))}
                {section.resultLine ? <strong>{section.resultLine}</strong> : null}
              </section>
            ))}
          </div>
        ) : result ? (
          <>
            {result.rankLabel ? <div>{result.rankLabel}</div> : null}
            <div>{result.interpretedResult}</div>
            {result.detailLines?.map((line) => (
              <div key={line} style={{ color: "#5e5a50", fontSize: "0.88rem", fontWeight: 600 }}>
                {line}
              </div>
            ))}
            {result.resultLabel ? <div>{result.resultLabel}</div> : null}
          </>
        ) : (
          "—"
        )}
      </div>
    </section>
  );
}

export function formatCombatInitiativeRoll(initiative?: CombatRoundInitiativeResult): string {
  if (!initiative) {
    return "No initiative rolled.";
  }

  const rollText =
    initiative.rolls.length > 0 ? initiative.rolls.join(" + ") : String(initiative.total);
  const baseInitiative = initiative.baseInitiative ?? 0;
  const modifierAdjustment = initiative.modifierAdjustment ?? 0;
  const rollTotal = initiative.rollTotal ?? initiative.total - baseInitiative - modifierAdjustment;

  return `Roll: ${rollText} = ${rollTotal}`;
}

export function formatCombatInitiativeFormula(initiative?: CombatRoundInitiativeResult): string {
  if (!initiative) {
    return "Main: no initiative result.";
  }

  const baseInitiative = initiative.baseInitiative ?? 0;
  const rollTotal = initiative.rollTotal ?? initiative.total - baseInitiative;
  const modifierAdjustment =
    initiative.modifierAdjustment ?? initiative.total - baseInitiative - rollTotal;

  return `Main: I ${baseInitiative} + Initiative ${modifierAdjustment} + roll ${rollTotal} = ${initiative.total}`;
}

export function PlayerCombatAttackStatsTable({ stats }: PlayerCombatAttackStatsTableProps) {
  return (
    <div style={compactStatsRowStyle}>
      <div style={{ alignItems: "center", display: "flex", gap: "0.45rem" }}>
        <strong style={{ fontSize: "0.95rem" }}>{stats.weaponName}</strong>
        {stats.provisional ? (
          <span style={{ color: "#5e5a50", fontSize: "0.75rem", fontWeight: 700 }}>
            Provisional
          </span>
        ) : null}
      </div>
      <table style={compactStatsTableStyle}>
        <thead>
          <tr>
            {["I", "OB", "DMB", "AM", "MC"].map((heading) => (
              <th
                key={heading}
                style={{
                  borderBottom: "1px solid #d9ddd8",
                  padding: "0.2rem",
                  textAlign: "left",
                }}
              >
                {heading}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          <tr>
            {[stats.initiative, stats.ob, stats.dmb, stats.attackMode, stats.maxCrits].map(
              (value, index) => (
                <td
                  key={`${value}-${index}`}
                  style={{
                    borderBottom: "1px solid #ece8dc",
                    padding: "0.2rem",
                  }}
                >
                  {value}
                </td>
              ),
            )}
          </tr>
        </tbody>
      </table>
    </div>
  );
}

export function PlayerCombatDefenseStatsTable({ stats }: PlayerCombatDefenseStatsTableProps) {
  return (
    <div style={compactStatsRowStyle}>
      <div style={{ alignItems: "center", display: "flex", gap: "0.45rem" }}>
        <strong style={{ fontSize: "0.9rem" }}>{stats.sourceName}</strong>
        {stats.provisional ? (
          <span style={{ color: "#5e5a50", fontSize: "0.75rem", fontWeight: 700 }}>
            Provisional
          </span>
        ) : null}
      </div>
      <table style={compactStatsTableStyle}>
        <thead>
          <tr>
            {["DB", "DM", "P"].map((heading) => (
              <th
                key={heading}
                style={{
                  borderBottom: "1px solid #d9ddd8",
                  padding: "0.15rem 0.2rem",
                  textAlign: "left",
                }}
              >
                {heading}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          <tr>
            {[stats.db, stats.dm, stats.parry].map((value, index) => (
              <td
                key={`${value}-${index}`}
                style={{
                  borderBottom: "1px solid #ece8dc",
                  padding: "0.15rem 0.2rem",
                }}
              >
                {value}
              </td>
            ))}
          </tr>
        </tbody>
      </table>
    </div>
  );
}

export function PlayerCombatOpponentSelector({
  controlsDisabled = false,
  emptyLabel = "Choose opponent",
  label = "Opponent to counter",
  onSelectedOpponentChange,
  opponentOptions,
  readOnly = false,
  selectedOpponentId,
}: PlayerCombatOpponentSelectorProps) {
  const selectedOpponentUnavailable = Boolean(
    selectedOpponentId && !opponentOptions.some((option) => option.id === selectedOpponentId),
  );
  const selectedOpponent = opponentOptions.find((option) => option.id === selectedOpponentId);

  if (readOnly) {
    const opponentLabel = selectedOpponentId
      ? (selectedOpponent?.displayName ?? "Opponent unavailable")
      : "No opponent";
    return (
      <div className="combatPhaseTargetRow" style={compactPhaseTargetRowStyle}>
        <span style={{ fontSize: "0.86rem", fontWeight: 600 }}>{label}</span>
        <span style={compactPhaseTargetSelectStyle}>{opponentLabel}</span>
      </div>
    );
  }

  return (
    <label className="combatPhaseTargetRow" style={compactPhaseTargetRowStyle}>
      <span style={{ fontSize: "0.86rem", fontWeight: 600 }}>{label}</span>
      <select
        aria-label={label}
        disabled={controlsDisabled}
        onChange={(event) => onSelectedOpponentChange(event.target.value)}
        style={compactPhaseTargetSelectStyle}
        value={selectedOpponentId ?? ""}
      >
        <option value="">{emptyLabel}</option>
        {selectedOpponentUnavailable ? (
          <option value={selectedOpponentId}>Opponent unavailable</option>
        ) : null}
        {opponentOptions.map((option) => (
          <option key={option.id} value={option.id}>
            {option.displayName}
          </option>
        ))}
      </select>
    </label>
  );
}

export function PlayerCombatAttackTargetSelector({
  combatContext,
  controlsDisabled = false,
  distanceLabel,
  onCombatContextChange,
  readOnly = false,
  targetOptions,
}: PlayerCombatAttackTargetSelectorProps) {
  const selectedTargetUnavailable = Boolean(
    combatContext.targetParticipantId &&
    !targetOptions.some((option) => option.id === combatContext.targetParticipantId),
  );
  const selectedTarget = targetOptions.find(
    (option) => option.id === combatContext.targetParticipantId,
  );

  if (readOnly) {
    const targetLabel = combatContext.targetParticipantId
      ? (selectedTarget?.displayName ?? "Target unavailable")
      : "No target";
    return (
      <div className="combatPhaseTargetRow" style={compactPhaseTargetRowStyle}>
        <span style={{ fontSize: "0.86rem", fontWeight: 600 }}>Target</span>
        <span style={compactPhaseTargetSelectStyle}>{targetLabel}</span>
        {distanceLabel ? (
          <span className="combatPhaseTargetMeta" style={compactPhaseTargetMetaStyle}>
            {distanceLabel}
          </span>
        ) : null}
      </div>
    );
  }

  return (
    <label className="combatPhaseTargetRow" style={compactPhaseTargetRowStyle}>
      <span style={{ fontSize: "0.86rem", fontWeight: 600 }}>Target</span>
      <select
        disabled={controlsDisabled}
        onChange={(event) =>
          onCombatContextChange({
            ...combatContext,
            targetParticipantId: event.target.value || undefined,
          })
        }
        style={compactPhaseTargetSelectStyle}
        value={combatContext.targetParticipantId ?? ""}
      >
        <option value="">No target</option>
        {selectedTargetUnavailable ? (
          <option value={combatContext.targetParticipantId}>Target unavailable</option>
        ) : null}
        {targetOptions.map((option) => (
          <option key={option.id} value={option.id}>
            {option.displayName}
          </option>
        ))}
      </select>
      {distanceLabel ? (
        <span className="combatPhaseTargetMeta" style={compactPhaseTargetMetaStyle}>
          {distanceLabel}
        </span>
      ) : null}
    </label>
  );
}

export function PlayerCombatAttackLocationSelector({
  combatContext,
  controlsDisabled = false,
  onCombatContextChange,
  readOnly = false,
}: PlayerCombatAttackLocationSelectorProps) {
  if (readOnly) {
    return (
      <HistoricalField
        label="Attack location"
        value={
          combatContext.targetLocation && combatContext.targetLocation !== "none"
            ? getHitLocationFullLabel(combatContext.targetLocation)
            : "No target"
        }
      />
    );
  }

  return (
    <div
      style={{
        display: "grid",
        gap: "0.25rem",
      }}
    >
      <label
        style={{
          alignItems: "center",
          display: "grid",
          gap: "0.35rem",
          gridTemplateColumns: compactPhaseContextSelectorColumns,
        }}
      >
        <span style={{ fontSize: "0.86rem", fontWeight: 600 }}>Attack location</span>
        <select
          disabled={controlsDisabled}
          onChange={(event) => {
            const targetLocation = event.target.value as ScenarioParticipantTargetLocation;

            onCombatContextChange({
              ...combatContext,
              targetLocation: targetLocation === "none" ? undefined : targetLocation,
            });
          }}
          style={compactPhaseContextSelectStyle}
          value={combatContext.targetLocation ?? "none"}
        >
          <option value="none">No target</option>
          {HIT_LOCATIONS.map((location) => (
            <option key={location} value={location}>
              {getHitLocationFullLabel(location)}
            </option>
          ))}
        </select>
      </label>
    </div>
  );
}

export function PlayerCombatAttackModeSelector({
  controlsDisabled = false,
  emptyState,
  onChange,
  options,
  selectedAttackModeId,
  readOnly = false,
}: PlayerCombatAttackModeSelectorProps) {
  if (options.length === 0) {
    return emptyState ? (
      <div
        role="status"
        style={{
          color: "#8a3b1f",
          display: "grid",
          fontSize: "0.82rem",
          gap: "0.2rem",
        }}
      >
        <strong>Attack mode</strong>
        <span>{emptyState}</span>
      </div>
    ) : null;
  }

  if (readOnly) {
    return (
      <HistoricalField
        label="Attack mode"
        value={options.find((option) => option.id === selectedAttackModeId)?.label}
      />
    );
  }

  return (
    <label
      style={{
        alignItems: "center",
        display: "grid",
        gap: "0.35rem",
        gridTemplateColumns: compactPhaseContextSelectorColumns,
      }}
    >
      <span style={{ fontSize: "0.86rem", fontWeight: 600 }}>Attack mode</span>
      <select
        disabled={controlsDisabled}
        onChange={(event) => onChange(event.target.value)}
        style={compactPhaseContextSelectStyle}
        value={selectedAttackModeId ?? ""}
      >
        {!selectedAttackModeId ? <option value="">Select mode</option> : null}
        {options.map((option) => (
          <option key={option.id} value={option.id}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function ParryDirectionSelector({
  controlsDisabled,
  direction,
  itemLabel,
  onChange,
}: {
  controlsDisabled?: boolean;
  direction?: ScenarioParticipantParryDirection;
  itemLabel: string;
  onChange: (direction: ScenarioParticipantParryDirection | undefined) => void;
}) {
  const coverageDirection = direction
    ? getPlayerEncounterParryCoverageDirection(direction)
    : undefined;

  return (
    <label
      style={{
        alignItems: "center",
        display: "grid",
        gap: "0.2rem",
        gridTemplateColumns: compactPhaseContextSelectorColumns,
      }}
    >
      <span style={{ fontSize: "0.86rem", fontWeight: 600 }}>{itemLabel}</span>
      <select
        disabled={controlsDisabled}
        onChange={(event) =>
          onChange(
            event.target.value
              ? (event.target.value as ScenarioParticipantParryDirection)
              : undefined,
          )
        }
        style={compactPhaseContextSelectStyle}
        value={direction ?? ""}
      >
        <option value="">Choose direction</option>
        {PLAYER_ENCOUNTER_PARRY_DIRECTION_OPTIONS.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      <span
        style={{ color: "#5e5a50", fontSize: "0.82rem", whiteSpace: "nowrap" }}
        title={
          direction && coverageDirection
            ? `${itemLabel}: ${getPlayerEncounterParryDirectionLabel(
                direction,
              )} to ${getPlayerEncounterParryDirectionLabel(coverageDirection)}`
            : `${itemLabel}: no coverage direction selected`
        }
      >
        {direction && coverageDirection
          ? `to ${getPlayerEncounterParryDirectionLabel(coverageDirection)}`
          : ""}
      </span>
    </label>
  );
}

export function PlayerCombatParryContextPanel({
  combatContext,
  controlsDisabled = false,
  onCombatContextChange,
  readOnly = false,
}: PlayerCombatParryContextPanelProps) {
  return (
    <div
      style={{
        borderTop: "1px solid #e3e1dc",
        display: "grid",
        gap: "0.35rem",
        paddingTop: "0.45rem",
      }}
    >
      <strong style={{ fontSize: "0.9rem" }}>Parry context</strong>
      <div
        style={{
          display: "grid",
          gap: "0.3rem",
        }}
      >
        {readOnly ? (
          <>
            <HistoricalField
              label="Main hand"
              value={
                combatContext.mainHandParryDirection
                  ? getPlayerEncounterParryDirectionLabel(combatContext.mainHandParryDirection)
                  : "No recorded information"
              }
            />
            <HistoricalField
              label="Off hand"
              value={
                combatContext.offHandParryDirection
                  ? getPlayerEncounterParryDirectionLabel(combatContext.offHandParryDirection)
                  : "No recorded information"
              }
            />
          </>
        ) : (
          <>
            <ParryDirectionSelector
              controlsDisabled={controlsDisabled}
              direction={combatContext.mainHandParryDirection}
              itemLabel="Main hand"
              onChange={(mainHandParryDirection) =>
                onCombatContextChange({
                  ...combatContext,
                  mainHandParryDirection,
                })
              }
            />
            <ParryDirectionSelector
              controlsDisabled={controlsDisabled}
              direction={combatContext.offHandParryDirection}
              itemLabel="Off hand"
              onChange={(offHandParryDirection) =>
                onCombatContextChange({
                  ...combatContext,
                  offHandParryDirection,
                })
              }
            />
          </>
        )}
      </div>
    </div>
  );
}

export function PlayerCombatPhasePanel({
  children,
  phaseCard,
  sourceLabel,
}: PlayerCombatPhasePanelProps) {
  return (
    <section
      style={{
        ...playerCombatPanelCardStyle,
        minHeight: 178,
      }}
    >
      <PanelTitleWithSource label={phaseCard.phaseLabel} sourceLabel={sourceLabel} />
      {phaseCard.title ? (
        <div style={{ color: "#5e5a50", fontSize: "0.95rem" }}>{phaseCard.title}</div>
      ) : null}
      {phaseCard.description ? (
        <div style={{ color: "#5e5a50" }}>{phaseCard.description}</div>
      ) : null}
      {children}
      {phaseCard.stats.length > 0 ? (
        <div style={{ display: "grid", gap: "0.25rem", fontSize: "0.95rem" }}>
          {phaseCard.stats.map((stat) => (
            <div key={stat}>{stat}</div>
          ))}
        </div>
      ) : null}
    </section>
  );
}
