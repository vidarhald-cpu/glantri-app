"use client";

import type { ReactNode } from "react";

import {
  HIT_LOCATIONS,
  type CombatRoundInitiativeResult,
  type CombatRoundStep,
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
  PLAYER_ENCOUNTER_MOVEMENT_OPTIONS,
  getPlayerEncounterParryCoverageDirection,
  getPlayerEncounterParryDirectionLabel,
  getPlayerEncounterCombatModifierTotals,
  type PlayerEncounterActionId,
  type PlayerEncounterMovementId,
} from "@/lib/campaigns/playerEncounter";
import type { EncounterLiveCombatModifierSummary } from "@/lib/campaigns/liveCombatModifiers";

export interface PlayerCombatModifierBucketView {
  bucketKey: ScenarioCombatModifierBucket;
  entries: ScenarioCombatModifierEntry[];
  fatigueTotal?: number;
  label: string;
  locked?: boolean;
  total: number;
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
  movementId: PlayerEncounterMovementId | "";
  onActionChange: (actionId: PlayerEncounterActionId | "") => void;
  onAdditionalActionNotesChange: (notes: string) => void;
  onMovementChange: (movementId: PlayerEncounterMovementId | "") => void;
  onSecondaryActionChange: (actionId: PlayerEncounterActionId | "") => void;
  roundNumber?: number;
  secondaryActionId: PlayerEncounterActionId | "";
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

interface PlayerCombatActionButtonPanelProps {
  buttonLabel?: string;
  disabled?: boolean;
  onDeclareAction?: () => void;
  saving?: boolean;
  statusText: string;
}

interface PlayerCombatActionResultPanelProps {
  result?: {
    interpretedResult: string;
    rankLabel?: string;
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
  gridTemplateColumns: "4.5rem 4.5rem minmax(0, 1fr) 1.75rem",
  minWidth: 0,
} as const;

const compactModifierMiniTableEntryRowStyle = {
  alignItems: "center",
  display: "grid",
  gap: "0.35rem",
  gridTemplateColumns: "4.5rem 4.5rem minmax(0, 1fr) 1.75rem",
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

function getDisplayTotal(row: PlayerCombatModifierBucketView | undefined): number {
  return row ? row.total + (row.fatigueTotal ?? 0) : 0;
}

function formatModifierDuration(entry: ScenarioCombatModifierEntry): string {
  return entry.durationRounds ? `${entry.durationRounds} rnd` : entry.scope;
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
      return "Declare phase 1 action";
    case "review_phase_2_actions":
      return "Review phase 1 effects";
    case "review_phase_2_modifiers":
      return "Declare phase 2 modifiers";
    case "initiative_phase_2":
      return "Roll phase 2 initiative";
    case "phase_2_actions":
      return "Declare phase 2 action";
    case "review_phase_2_damage":
      return "Review phase 2 effects";
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
      return "Phase 1 actions";
    case "review_phase_2_actions":
      return "Phase 1 effects";
    case "review_phase_2_modifiers":
      return "Review phase 2";
    case "initiative_phase_2":
      return "Phase 2 initiative";
    case "phase_2_actions":
      return "Phase 2 actions";
    case "review_phase_2_damage":
      return "Phase 2 effects";
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
  liveModifiers?: EncounterLiveCombatModifierSummary;
}): PlayerCombatModifierBucketView[] {
  const combatContext = input.combatContext ?? createEmptyPlayerEncounterCombatContext();
  const totals = getPlayerEncounterCombatModifierTotals(combatContext);

  return [
    {
      bucketKey: "general",
      entries: [],
      label: "General/Fatigue",
      locked: true,
      total: input.liveModifiers?.generalFatigueRaw ?? 0,
    },
    {
      bucketKey: "situation_initiative",
      entries: combatContext.modifierBuckets.situationInitiative,
      label: "Initiative",
      total: input.liveModifiers?.initiativeRaw ?? totals.situationInitiativeTotal,
    },
    {
      bucketKey: "situation_ob_skill",
      entries: combatContext.modifierBuckets.situationObSkill,
      label: "Skill/OB",
      total: input.liveModifiers?.obSkillRaw ?? totals.situationObSkillTotal,
    },
    {
      bucketKey: "situation_db",
      entries: combatContext.modifierBuckets.situationDb,
      label: "DB",
      total: input.liveModifiers?.dbRaw ?? totals.situationDbTotal,
    },
  ];
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
              <div style={compactModifierMiniTableHeaderStyle}>
                {["Mod", "Dur", "Details"].map((heading) => (
                  <span key={heading} style={{ fontSize: "0.78rem", fontWeight: 700 }}>
                    {heading}
                  </span>
                ))}
                <span aria-hidden="true" />
              </div>
              {row.entries.map((entry) => (
                <div key={entry.id} style={compactModifierMiniTableEntryRowStyle}>
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
            row.entries.map((entry) => (
              <div key={entry.id} style={{ color: "#5e5a50", fontSize: "0.9rem" }}>
                {entry.value >= 0 ? "+" : ""}
                {entry.value} · {formatModifierDuration(entry)}
                {entry.notes ? ` · ${entry.notes}` : ""}
              </div>
            ))
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
  movementId,
  onActionChange,
  onAdditionalActionNotesChange,
  onMovementChange,
  onSecondaryActionChange,
  roundNumber,
  secondaryActionId,
}: PlayerCombatActionSelectorPanelProps) {
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
          onChange={(event) =>
            onMovementChange(event.target.value as PlayerEncounterMovementId | "")
          }
          value={movementId}
        >
          {PLAYER_ENCOUNTER_MOVEMENT_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </label>

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
  saving = false,
  statusText,
}: PlayerCombatActionButtonPanelProps) {
  return (
    <section style={playerCombatPanelCardStyle}>
      <strong>Action button</strong>
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
      <div style={{ color: "#5e5a50", fontSize: "0.92rem" }}>{statusText}</div>
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
        {result ? (
          <>
            {result.rankLabel ? <div>{result.rankLabel}</div> : null}
            <div>{result.interpretedResult}</div>
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
