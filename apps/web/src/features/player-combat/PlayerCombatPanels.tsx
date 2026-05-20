"use client";

import type { ReactNode } from "react";

import type {
  ScenarioCombatModifierBucket,
  ScenarioCombatModifierEntry,
  ScenarioParticipantCombatContext,
} from "@glantri/domain";

import {
  createEmptyPlayerEncounterCombatContext,
  getPlayerEncounterCombatModifierTotals,
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

function getDisplayTotal(row: PlayerCombatModifierBucketView | undefined): number {
  return row ? row.total + (row.fatigueTotal ?? 0) : 0;
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
      <div style={{ fontSize: "1.05rem", fontWeight: 600 }}>{phaseCard.title}</div>
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
