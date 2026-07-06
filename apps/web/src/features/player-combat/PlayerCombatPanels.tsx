"use client";

import type { ReactNode } from "react";

import {
  HIT_LOCATIONS,
  type CombatEffect,
  type CombatEffectsState,
  type CombatDistance,
  type CombatRoundInitiativeResult,
  type CombatRoundStep,
  type MovementIntent,
  type ScenarioCombatModifierBucket,
  type ScenarioCombatModifierEntry,
  type ScenarioParticipantCombatContext,
  type ScenarioParticipantParryDirection,
  type ScenarioParticipantTargetLocation,
  getHitLocationFullLabel,
} from "@glantri/domain";

import {
  createEmptyPlayerEncounterCombatContext,
  PLAYER_ENCOUNTER_ACTION_OPTIONS,
  PLAYER_ENCOUNTER_PARRY_DIRECTION_OPTIONS,
  getPlayerEncounterParryCoverageDirection,
  getPlayerEncounterParryDirectionLabel,
  getPlayerEncounterCombatModifierTotals,
  type PlayerEncounterActionId,
  type PlayerEncounterMovementId,
  type PlayerEncounterOpponentOption,
} from "@/lib/campaigns/playerEncounter";
import {
  filterCombatModifierEntriesForPhase,
  type EncounterCombatPhaseKey,
  type EncounterLiveCombatModifierSummary,
} from "@/lib/campaigns/liveCombatModifiers";

export interface PlayerCombatModifierBucketView {
  bucketKey: ScenarioCombatModifierBucket;
  characterStateEntries?: PlayerCombatModifierDisplayEntry[];
  entries: ScenarioCombatModifierEntry[];
  fatigueTotal?: number;
  label: string;
  locked?: boolean;
  total: number;
}

export interface PlayerCombatModifierDisplayEntry {
  details?: string;
  id: string;
  scopeLabel: string;
  sourceLabel: "Character/state" | "Situational";
  value: number;
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
  weaponArmorClass?: string;
  weaponCriticalCode?: string;
  weaponDamageClass?: string;
  weaponName: string;
}

export interface PlayerCombatDefenseStatsView {
  db: string;
  dm: string;
  parry: string;
  sourceName: string;
}

interface PlayerCombatModifierPanelProps {
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
  rows: readonly PlayerCombatModifierBucketView[];
}

interface PlayerCombatPhasePanelProps {
  children?: ReactNode;
  phaseCard: PlayerCombatPhaseCardView;
}

interface PlayerCombatActionSelectorPanelProps {
  actionId: PlayerEncounterActionId | "";
  additionalActionNotes: string;
  controlsDisabled?: boolean;
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
}

interface PlayerCombatAttackLocationSelectorProps {
  combatContext: ScenarioParticipantCombatContext;
  controlsDisabled?: boolean;
  onCombatContextChange: (combatContext: ScenarioParticipantCombatContext) => void;
}

interface PlayerCombatAttackTargetSelectorProps {
  combatContext: ScenarioParticipantCombatContext;
  controlsDisabled?: boolean;
  distanceLabel?: string;
  onCombatContextChange: (combatContext: ScenarioParticipantCombatContext) => void;
  targetOptions: readonly PlayerEncounterOpponentOption[];
}

interface PlayerCombatActionButtonPanelProps {
  buttonLabel?: string;
  disabled?: boolean;
  onDeclareAction?: () => void;
  preActionControls?: ReactNode;
  /**
   * Reserved for non-primary utility commands such as GM skip controls. Alternative
   * outcomes for the same pending task should use preActionControls plus one primary action.
   */
  onSecondaryAction?: () => void;
  secondaryButtonDisabled?: boolean;
  secondaryButtonLabel?: string;
  saving?: boolean;
  statusText: string;
  validationMessage?: string;
}

interface PlayerCombatActionResultSection {
  calculationLines: readonly string[];
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
  gap: "0.2rem",
  minWidth: 0,
} as const;

const compactModifierMiniTableHeaderStyle = {
  alignItems: "center",
  display: "grid",
  gap: "0.35rem",
  gridTemplateColumns: "6.25rem 4.5rem 4.5rem minmax(0, 1fr) 1.75rem",
  minWidth: 0,
} as const;

const compactModifierMiniTableEntryRowStyle = {
  alignItems: "center",
  display: "grid",
  gap: "0.35rem",
  gridTemplateColumns: "6.25rem 4.5rem 4.5rem minmax(0, 1fr) 1.75rem",
  minWidth: 0,
} as const;

const compactModifierDisplayRowStyle = {
  alignItems: "center",
  color: "#5e5a50",
  display: "grid",
  fontSize: "0.88rem",
  gap: "0.35rem",
  gridTemplateColumns: "6.25rem 4.5rem 4.5rem minmax(0, 1fr)",
  minWidth: 0,
} as const;

const compactModifierNumberInputStyle = {
  boxSizing: "border-box",
  minWidth: 0,
  width: "5.5ch",
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

function formatSignedModifierValue(value: number): string {
  return value >= 0 ? `+${value}` : String(value);
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

export function formatCombatModifierDisplayLine(input: {
  bucketLabel: string;
  entry: ScenarioCombatModifierEntry;
}): string {
  const details = input.entry.notes?.trim();

  return [
    `${input.bucketLabel} ${formatSignedModifierValue(input.entry.value)}`,
    formatCombatModifierScopeLabel(input.entry),
    details,
  ]
    .filter((part): part is string => Boolean(part))
    .join(" · ");
}

function createModifierEntryDraft(): ScenarioCombatModifierEntry {
  return {
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
  liveModifiers?: EncounterLiveCombatModifierSummary;
  phaseKey?: EncounterCombatPhaseKey;
}): PlayerCombatModifierBucketView[] {
  const combatContext = input.combatContext ?? createEmptyPlayerEncounterCombatContext();
  const filteredModifierBuckets = {
    general: filterCombatModifierEntriesForPhase(
      combatContext.modifierBuckets.general,
      input.phaseKey,
    ),
    situationDb: filterCombatModifierEntriesForPhase(
      combatContext.modifierBuckets.situationDb,
      input.phaseKey,
    ),
    situationInitiative: filterCombatModifierEntriesForPhase(
      combatContext.modifierBuckets.situationInitiative,
      input.phaseKey,
    ),
    situationObSkill: filterCombatModifierEntriesForPhase(
      combatContext.modifierBuckets.situationObSkill,
      input.phaseKey,
    ),
  };
  const totals = getPlayerEncounterCombatModifierTotals({
    ...combatContext,
    modifierBuckets: filteredModifierBuckets,
  });
  const characterStateEntries = buildCharacterStateModifierEntries(input.combatEffects);

  return [
    {
      bucketKey: "general",
      characterStateEntries: characterStateEntries.general,
      entries: [],
      label: "General/Fatigue",
      locked: true,
      total: input.liveModifiers?.generalFatigueRaw ?? 0,
    },
    {
      bucketKey: "situation_initiative",
      entries: filteredModifierBuckets.situationInitiative,
      label: "Initiative",
      total: input.liveModifiers?.initiativeRaw ?? totals.situationInitiativeTotal,
    },
    {
      bucketKey: "situation_ob_skill",
      characterStateEntries: characterStateEntries.situationObSkill,
      entries: filteredModifierBuckets.situationObSkill,
      label: "Skill/OB",
      total: input.liveModifiers?.obSkillRaw ?? totals.situationObSkillTotal,
    },
    {
      bucketKey: "situation_db",
      characterStateEntries: characterStateEntries.situationDb,
      entries: filteredModifierBuckets.situationDb,
      label: "DB/Parry",
      total: input.liveModifiers?.dbRaw ?? totals.situationDbTotal,
    },
  ];
}

function isActiveModifierCombatEffect(effect: CombatEffect): boolean {
  return (
    effect.status === "active" &&
    effect.type !== "physical_damage" &&
    effect.type !== "general_damage" &&
    effect.type !== "bleed" &&
    effect.type !== "internal_bleed"
  );
}

function getCombatEffectModifierValue(effect: CombatEffect): number {
  if (effect.modifierValue != null) {
    return effect.modifierValue;
  }

  if (effect.damage !== 0) {
    return effect.damage;
  }

  return effect.generalDamage;
}

function formatCombatEffectFallbackLabel(effect: CombatEffect): string {
  return effect.type.replaceAll("_", " ");
}

function buildCharacterStateModifierEntries(
  combatEffects?: CombatEffectsState,
): {
  general: PlayerCombatModifierDisplayEntry[];
  situationDb: PlayerCombatModifierDisplayEntry[];
  situationObSkill: PlayerCombatModifierDisplayEntry[];
} {
  const eventsById = new Map(
    (combatEffects?.events ?? []).map((event) => [event.id, event] as const),
  );
  const result = {
    general: [] as PlayerCombatModifierDisplayEntry[],
    situationDb: [] as PlayerCombatModifierDisplayEntry[],
    situationObSkill: [] as PlayerCombatModifierDisplayEntry[],
  };

  for (const effect of combatEffects?.effects ?? []) {
    if (!isActiveModifierCombatEffect(effect)) {
      continue;
    }

    const value = getCombatEffectModifierValue(effect);

    if (value === 0) {
      continue;
    }

    const event = eventsById.get(effect.sourceEventId);
    const details =
      event?.sourceLabel && event.sourceLabel !== "Manual combat effect"
        ? event.sourceLabel
        : (effect.description?.trim() ??
          event?.description?.trim() ??
          formatCombatEffectFallbackLabel(effect));
    const entry = {
      details,
      id: effect.id,
      scopeLabel:
        effect.duration?.trim() ??
        (effect.expiresAtRound ? `until RD ${effect.expiresAtRound}` : "until SU"),
      sourceLabel: "Character/state" as const,
      value,
    };

    if (effect.type === "fatigue" || effect.effectGroup === "fatigue") {
      result.general.push(entry);
    } else if (effect.effectGroup === "general") {
      result.general.push(entry);
    } else if (effect.effectGroup === "obSkill") {
      result.situationObSkill.push(entry);
    } else if (effect.effectGroup === "db") {
      result.situationDb.push(entry);
    }
  }

  return result;
}

function buildSituationalModifierDisplayEntry(
  entry: ScenarioCombatModifierEntry,
): PlayerCombatModifierDisplayEntry {
  return {
    details: entry.notes?.trim() || undefined,
    id: entry.id,
    scopeLabel: formatCombatModifierScopeLabel(entry),
    sourceLabel: "Situational",
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
  return (
    <div
      key={`${entry.sourceLabel}:${entry.id}`}
      style={compactModifierDisplayRowStyle}
      title={`${bucketLabel} ${formatSignedModifierValue(entry.value)} · ${entry.scopeLabel}${
        entry.details ? ` · ${entry.details}` : ""
      }`}
    >
      <span>{entry.sourceLabel}</span>
      <span>{formatSignedModifierValue(entry.value)}</span>
      <span>{entry.scopeLabel}</span>
      <span
        style={{
          minWidth: 0,
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
        }}
      >
        {entry.details ?? "—"}
      </span>
    </div>
  );
}

export function PlayerCombatModifierPanel({
  controlsDisabled = false,
  onAddEntry,
  onRemoveEntry,
  onUpdateEntry,
  readOnly = false,
  rows,
}: PlayerCombatModifierPanelProps) {
  const editable = !readOnly && onAddEntry && onRemoveEntry && onUpdateEntry;

  return (
    <section style={playerCombatPanelCardStyle}>
      <strong>Combat modifiers</strong>
      {rows.map((row) => (
        <div key={row.bucketKey} style={{ display: "grid", gap: "0.35rem" }}>
          <div style={compactModifierGroupHeaderStyle}>
            <div style={{ alignItems: "center", display: "flex", gap: "0.5rem" }}>
              <span style={{ fontSize: "0.9rem", fontWeight: 600 }}>{row.label}</span>
              <span style={{ color: "#5e5a50", fontSize: "0.9rem" }}>
                {getDisplayTotal(row) >= 0 ? "+" : ""}
                {getDisplayTotal(row)}
              </span>
            </div>
            {editable && !row.locked ? (
              <button
                disabled={controlsDisabled}
                onClick={() => onAddEntry(row.bucketKey, createModifierEntryDraft())}
                style={{ justifySelf: "end" }}
                type="button"
              >
                Add
              </button>
            ) : null}
          </div>

          {editable && !row.locked && row.entries.length > 0 ? (
            <div style={compactModifierMiniTableStyle}>
              {row.characterStateEntries?.map((entry) => (
                <ModifierDisplayEntryRow
                  bucketLabel={row.label}
                  entry={entry}
                  key={`${entry.sourceLabel}:${entry.id}`}
                />
              ))}
              <div style={compactModifierMiniTableHeaderStyle}>
                {["Source", "Mod", "Dur", "Details"].map((heading) => (
                  <span key={heading} style={{ fontSize: "0.78rem", fontWeight: 700 }}>
                    {heading}
                  </span>
                ))}
                <span aria-hidden="true" />
              </div>
              {row.entries.map((entry) => (
                <div key={entry.id} style={compactModifierMiniTableEntryRowStyle}>
                  <span style={{ color: "#5e5a50", fontSize: "0.84rem" }}>Situational</span>
                  <input
                    aria-label={`${row.label} modifier value`}
                    disabled={controlsDisabled}
                    onChange={(event) =>
                      onUpdateEntry(row.bucketKey, entry.id, {
                        value: event.target.value.length > 0 ? Number(event.target.value) : 0,
                      })
                    }
                    style={compactModifierNumberInputStyle}
                    type="number"
                    value={entry.value}
                  />
                  <input
                    aria-label={`${row.label} modifier duration`}
                    disabled={controlsDisabled}
                    min={1}
                    onChange={(event) =>
                      onUpdateEntry(row.bucketKey, entry.id, {
                        durationRounds:
                          event.target.value.length > 0 ? Number(event.target.value) : undefined,
                      })
                    }
                    style={compactModifierNumberInputStyle}
                    type="number"
                    value={entry.durationRounds ?? ""}
                  />
                  <input
                    aria-label={`${row.label} modifier details`}
                    disabled={controlsDisabled}
                    onChange={(event) =>
                      onUpdateEntry(row.bucketKey, entry.id, {
                        notes: event.target.value,
                      })
                    }
                    placeholder="Details"
                    style={compactModifierDetailsInputStyle}
                    type="text"
                    value={entry.notes ?? ""}
                  />
                  <button
                    aria-label="Remove modifier"
                    disabled={controlsDisabled}
                    onClick={() => onRemoveEntry(row.bucketKey, entry.id)}
                    style={compactModifierRemoveButtonStyle}
                    title="Remove modifier"
                    type="button"
                  >
                    -
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <>
              {row.characterStateEntries?.map((entry) => (
                <ModifierDisplayEntryRow
                  bucketLabel={row.label}
                  entry={entry}
                  key={`${entry.sourceLabel}:${entry.id}`}
                />
              ))}
              {row.entries.map((entry) => (
                <ModifierDisplayEntryRow
                  bucketLabel={row.label}
                  entry={buildSituationalModifierDisplayEntry(entry)}
                  key={`Situational:${entry.id}`}
                />
              ))}
            </>
          )}
        </div>
      ))}
    </section>
  );
}

export function PlayerCombatActionSelectorPanel({
  actionId,
  additionalActionNotes,
  controlsDisabled = false,
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
}: PlayerCombatActionSelectorPanelProps) {
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
      <strong>Action selector{roundNumber ? ` · Round ${roundNumber}` : ""}</strong>
      <label style={compactFieldLabelStyle}>
        <span style={{ fontSize: "0.88rem", fontWeight: 600 }}>Action</span>
        <select
          disabled={controlsDisabled}
          onChange={(event) => onActionChange(event.target.value as PlayerEncounterActionId | "")}
          value={actionId}
        >
          <option value="">Choose action</option>
          {PLAYER_ENCOUNTER_ACTION_OPTIONS.map((option) => (
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
          value={secondaryActionId}
        >
          <option value="">Open</option>
          {PLAYER_ENCOUNTER_ACTION_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
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
          <option value="hold_position">Hold position</option>
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
                    onChange={(event) =>
                      updateDistancePreference(option.id, event.target.value)
                    }
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

export function PlayerCombatActionButtonPanel({
  buttonLabel = "Declare action",
  disabled = false,
  onDeclareAction,
  preActionControls,
  onSecondaryAction,
  secondaryButtonDisabled = false,
  secondaryButtonLabel,
  saving = false,
  statusText,
  validationMessage,
}: PlayerCombatActionButtonPanelProps) {
  return (
    <section style={playerCombatPanelCardStyle}>
      <strong>Action button</strong>
      {preActionControls ? (
        <div style={{ display: "grid", gap: "0.35rem" }}>{preActionControls}</div>
      ) : null}
      <button
        disabled={disabled || saving}
        onClick={onDeclareAction}
        style={{
          background: disabled ? "#e4e0d6" : "#ded4b1",
          border: "1px solid #bdb39a",
          borderRadius: 10,
          color: disabled ? "#8a8477" : "#2f2415",
          cursor: disabled ? "not-allowed" : "pointer",
          justifySelf: "center",
          minHeight: 70,
          padding: "0.75rem 0.9rem",
          textAlign: "center",
          width: "80%",
        }}
        type="button"
      >
        <strong>{saving ? "Saving..." : buttonLabel}</strong>
      </button>
      {secondaryButtonLabel ? (
        <button
          disabled={secondaryButtonDisabled || saving}
          onClick={onSecondaryAction}
          style={{ justifySelf: "center", width: "80%" }}
          type="button"
        >
          {secondaryButtonLabel}
        </button>
      ) : null}
      <div style={{ color: "#5e5a50", fontSize: "0.92rem" }}>{statusText}</div>
      {validationMessage ? (
        <div style={{ color: "#8b3a1a", fontSize: "0.9rem", fontWeight: 600 }}>
          {validationMessage}
        </div>
      ) : null}
    </section>
  );
}

export function PlayerCombatActionResultPanel({ result }: PlayerCombatActionResultPanelProps) {
  return (
    <section
      style={{
        ...playerCombatPanelCardStyle,
        alignContent: "start",
      }}
    >
      <strong>Action result</strong>
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
                {section.calculationLines.map((line) => (
                  <div key={line} style={{ color: "#5e5a50", fontSize: "0.88rem" }}>
                    {line}
                  </div>
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

  return `Main: I ${baseInitiative} + [Gen/Fatigue + Initiative] ${modifierAdjustment} + roll ${rollTotal} = ${initiative.total}`;
}

export function PlayerCombatAttackStatsTable({ stats }: PlayerCombatAttackStatsTableProps) {
  return (
    <div style={compactStatsRowStyle}>
      <strong style={{ fontSize: "0.95rem" }}>{stats.weaponName}</strong>
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
      <strong style={{ fontSize: "0.9rem" }}>{stats.sourceName}</strong>
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

export function PlayerCombatAttackTargetSelector({
  combatContext,
  controlsDisabled = false,
  distanceLabel,
  onCombatContextChange,
  targetOptions,
}: PlayerCombatAttackTargetSelectorProps) {
  const selectedTargetUnavailable = Boolean(
    combatContext.targetParticipantId &&
    !targetOptions.some((option) => option.id === combatContext.targetParticipantId),
  );

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
          <option value={combatContext.targetParticipantId}>
            Saved target ({combatContext.targetParticipantId})
          </option>
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
}: PlayerCombatAttackLocationSelectorProps) {
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
      </div>
    </div>
  );
}

export function PlayerCombatPhasePanel({ children, phaseCard }: PlayerCombatPhasePanelProps) {
  return (
    <section
      style={{
        ...playerCombatPanelCardStyle,
        minHeight: 178,
      }}
    >
      <strong>{phaseCard.phaseLabel}</strong>
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
