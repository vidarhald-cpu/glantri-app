"use client";

import type { ReactNode } from "react";

import type {
  CombatRoundInitiativeResult,
  CombatRoundStep,
  ScenarioCombatModifierBucket,
  ScenarioCombatModifierEntry,
  ScenarioParticipantCombatContext,
  ScenarioParticipantParryDirection,
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

interface PlayerCombatModifierPanelProps {
  controlsDisabled?: boolean;
  onAddEntry?: (bucketKey: ScenarioCombatModifierBucket) => void;
  onRemoveEntry?: (bucketKey: ScenarioCombatModifierBucket, entryId: string) => void;
  onUpdateEntry?: (
    bucketKey: ScenarioCombatModifierBucket,
    entryId: string,
    patch: Partial<Pick<ScenarioCombatModifierEntry, "notes" | "scope" | "value">>,
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

interface PlayerCombatParryContextPanelProps {
  combatContext: ScenarioParticipantCombatContext;
  controlsDisabled?: boolean;
  mainHandItemLabel?: string;
  offHandItemLabel?: string;
  onCombatContextChange: (combatContext: ScenarioParticipantCombatContext) => void;
  visibleOpponentOptions?: readonly { displayName: string; id: string }[];
}

interface PlayerCombatActionButtonPanelProps {
  buttonLabel?: string;
  disabled?: boolean;
  onDeclareAction?: () => void;
  saving?: boolean;
  statusText: string;
}

interface PlayerCombatActionResultPanelProps {
  additionalActionNotes: string;
  movementLabel: string;
  result?: {
    interpretedResult: string;
    phaseLabel?: string;
    value: number;
  } | null;
}

export const playerCombatPanelCardStyle = {
  background: "#fffdf8",
  border: "1px solid #d9ddd8",
  borderRadius: 10,
  display: "grid",
  gap: "0.6rem",
  padding: "0.75rem",
} as const;

export const playerCombatPanelsGridStyle = {
  display: "grid",
  gap: "0.75rem",
  gridTemplateColumns: "repeat(auto-fit, minmax(14rem, 1fr))",
} as const;

export const playerCombatPanelRowStyle = {
  display: "grid",
  gap: "0.75rem",
  gridTemplateColumns: "repeat(auto-fit, minmax(15rem, 1fr))",
} as const;

function getDisplayTotal(row: PlayerCombatModifierBucketView | undefined): number {
  return row ? row.total + (row.fatigueTotal ?? 0) : 0;
}

export function getGmCombatStepActionLabel(step: CombatRoundStep): string {
  switch (step) {
    case "select_actions":
      return "Declare action";
    case "review_action_modifiers":
      return "Declare modifiers";
    case "initiative_phase_1":
      return "Set/Roll phase 1 initiative";
    case "phase_1_actions":
      return "Record phase 1 action";
    case "review_phase_2_actions":
      return "Review phase 1 effects";
    case "review_phase_2_modifiers":
      return "Review phase 2";
    case "initiative_phase_2":
      return "Set/Roll phase 2 initiative";
    case "phase_2_actions":
      return "Record phase 2 action";
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
  const generalTotal = getDisplayTotal(rows.find((row) => row.bucketKey === "general") ?? rows[0]);
  const skillObTotal = getDisplayTotal(
    rows.find((row) => row.bucketKey === "situation_ob_skill") ?? rows[1],
  );
  const dbTotal = getDisplayTotal(rows.find((row) => row.bucketKey === "situation_db") ?? rows[2]);

  return (
    <section style={playerCombatPanelCardStyle}>
      <strong>Combat modifiers</strong>
      {rows.map((row) => (
        <div key={row.bucketKey} style={{ display: "grid", gap: "0.35rem" }}>
          <div style={{ alignItems: "center", display: "flex", gap: "0.5rem" }}>
            <span style={{ fontSize: "0.9rem", fontWeight: 600 }}>{row.label}</span>
            <span style={{ color: "#5e5a50", fontSize: "0.9rem" }}>
              {getDisplayTotal(row) >= 0 ? "+" : ""}
              {getDisplayTotal(row)}
            </span>
          </div>

          {editable && !row.locked
            ? row.entries.map((entry) => (
                <div
                  key={entry.id}
                  style={{
                    display: "grid",
                    gap: "0.35rem",
                    gridTemplateColumns: "70px 88px minmax(0, 1fr) auto",
                  }}
                >
                  <input
                    disabled={controlsDisabled}
                    onChange={(event) =>
                      onUpdateEntry(row.bucketKey, entry.id, {
                        value: event.target.value.length > 0 ? Number(event.target.value) : 0,
                      })
                    }
                    type="number"
                    value={entry.value}
                  />
                  <select
                    disabled={controlsDisabled}
                    onChange={(event) =>
                      onUpdateEntry(row.bucketKey, entry.id, {
                        scope: event.target.value as "until" | "save",
                      })
                    }
                    value={entry.scope}
                  >
                    <option value="until">Until</option>
                    <option value="save">Save</option>
                  </select>
                  <input
                    disabled={controlsDisabled}
                    onChange={(event) =>
                      onUpdateEntry(row.bucketKey, entry.id, {
                        notes: event.target.value,
                      })
                    }
                    placeholder="Notes"
                    type="text"
                    value={entry.notes ?? ""}
                  />
                  <button
                    disabled={controlsDisabled}
                    onClick={() => onRemoveEntry(row.bucketKey, entry.id)}
                    type="button"
                  >
                    Remove
                  </button>
                </div>
              ))
            : row.entries.map((entry) => (
                <div key={entry.id} style={{ color: "#5e5a50", fontSize: "0.9rem" }}>
                  {entry.value >= 0 ? "+" : ""}
                  {entry.value} · {entry.scope}
                  {entry.notes ? ` · ${entry.notes}` : ""}
                </div>
              ))}

          {editable && !row.locked ? (
            <button
              disabled={controlsDisabled}
              onClick={() => onAddEntry(row.bucketKey)}
              style={{ justifySelf: "start" }}
              type="button"
            >
              Add {row.label}
            </button>
          ) : null}
        </div>
      ))}

      <div style={{ color: "#5e5a50", fontSize: "0.92rem" }}>
        General/Fatigue {generalTotal} · Attack {generalTotal + skillObTotal} · Defense{" "}
        {generalTotal + dbTotal}
      </div>
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
      <label style={{ display: "grid", gap: "0.25rem" }}>
        <span>Action</span>
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

      <label style={{ display: "grid", gap: "0.25rem" }}>
        <span>Secondary action</span>
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

      <label style={{ display: "grid", gap: "0.25rem" }}>
        <span>Movement</span>
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

      <label style={{ display: "grid", gap: "0.25rem" }}>
        <span>Additional</span>
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
          minHeight: 70,
          padding: "0.75rem 0.9rem",
          textAlign: "left",
          width: "100%",
        }}
        type="button"
      >
        <strong>{saving ? "Saving..." : buttonLabel}</strong>
      </button>
      <div style={{ color: "#5e5a50", fontSize: "0.92rem" }}>{statusText}</div>
    </section>
  );
}

export function PlayerCombatActionResultPanel({
  additionalActionNotes,
  movementLabel,
  result,
}: PlayerCombatActionResultPanelProps) {
  return (
    <section style={playerCombatPanelCardStyle}>
      <strong>Action result</strong>
      <div
        style={{
          alignItems: "center",
          background: "#f6f5ef",
          border: "1px solid #d9ddd8",
          borderRadius: 8,
          display: "flex",
          fontSize: "1.3rem",
          fontWeight: 700,
          justifyContent: "center",
          minHeight: 58,
        }}
      >
        {result?.value ?? "—"}
      </div>
      <div>{result?.phaseLabel ?? "No combat action result yet."}</div>
      <div style={{ color: "#5e5a50" }}>{result?.interpretedResult ?? "No result recorded."}</div>
      <div style={{ color: "#5e5a50", fontSize: "0.95rem" }}>
        Movement: {movementLabel}
        {additionalActionNotes.trim().length > 0 ? ` · ${additionalActionNotes.trim()}` : ""}
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

  return `Roll: ${rollText} = ${initiative.total}`;
}

export function PlayerCombatAttackStatsTable({ stats }: PlayerCombatAttackStatsTableProps) {
  return (
    <div style={{ display: "grid", gap: "0.35rem" }}>
      <strong style={{ fontSize: "0.95rem" }}>{stats.weaponName}</strong>
      <table
        style={{
          borderCollapse: "collapse",
          fontSize: "0.9rem",
          width: "100%",
        }}
      >
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
    <label style={{ display: "grid", gap: "0.25rem" }}>
      <span>{itemLabel}</span>
      <select
        disabled={controlsDisabled}
        onChange={(event) =>
          onChange(
            event.target.value
              ? (event.target.value as ScenarioParticipantParryDirection)
              : undefined,
          )
        }
        value={direction ?? ""}
      >
        <option value="">Choose direction</option>
        {PLAYER_ENCOUNTER_PARRY_DIRECTION_OPTIONS.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      <span style={{ color: "#5e5a50", fontSize: "0.86rem" }}>
        {direction && coverageDirection
          ? `${itemLabel}: ${getPlayerEncounterParryDirectionLabel(
              direction,
            )} to ${getPlayerEncounterParryDirectionLabel(coverageDirection)}`
          : `${itemLabel}: no coverage direction selected`}
      </span>
    </label>
  );
}

export function PlayerCombatParryContextPanel({
  combatContext,
  controlsDisabled = false,
  mainHandItemLabel = "Unarmed",
  offHandItemLabel = "Unarmed",
  onCombatContextChange,
  visibleOpponentOptions = [],
}: PlayerCombatParryContextPanelProps) {
  return (
    <div
      style={{
        borderTop: "1px solid #e3e1dc",
        display: "grid",
        gap: "0.55rem",
        paddingTop: "0.55rem",
      }}
    >
      <strong style={{ fontSize: "0.95rem" }}>Parry context</strong>
      <label style={{ display: "grid", gap: "0.25rem" }}>
        <span>Opponent</span>
        <select
          disabled={controlsDisabled}
          onChange={(event) =>
            onCombatContextChange({
              ...combatContext,
              selectedOpponentId: event.target.value || undefined,
            })
          }
          value={combatContext.selectedOpponentId ?? ""}
        >
          <option value="">Choose opponent</option>
          {visibleOpponentOptions.map((participant) => (
            <option key={participant.id} value={participant.id}>
              {participant.displayName}
            </option>
          ))}
        </select>
      </label>
      <div
        style={{
          display: "grid",
          gap: "0.5rem",
          gridTemplateColumns: "repeat(auto-fit, minmax(10rem, 1fr))",
        }}
      >
        <ParryDirectionSelector
          controlsDisabled={controlsDisabled}
          direction={combatContext.mainHandParryDirection}
          itemLabel={mainHandItemLabel || "Unarmed"}
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
          itemLabel={offHandItemLabel || "Unarmed"}
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
        minHeight: 210,
        padding: "0.85rem",
      }}
    >
      <strong>{phaseCard.phaseLabel}</strong>
      {phaseCard.title ? (
        <div style={{ color: "#5e5a50", fontSize: "0.95rem" }}>{phaseCard.title}</div>
      ) : null}
      <div style={{ color: "#5e5a50" }}>{phaseCard.description}</div>
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
