import { useState, type FormEvent } from "react";

import type { CharacterPhysicalStateView } from "@/lib/characters/physicalState";
import type { CombatEffectGroup, CombatEffectType } from "@glantri/domain";

export interface CombatEffectDraftRow {
  damage: number;
  description?: string;
  duration?: string;
  effectGroup: CombatEffectGroup;
  generalDamage: number;
  location?: string;
  modifierValue?: number;
  type: CombatEffectType;
}

export interface CombatEffectEventDraft {
  description?: string;
  effects: CombatEffectDraftRow[];
  roundNumber?: number;
  sourceLabel: string;
}

interface PhysicalStateSectionProps {
  canEditCombatEffects?: boolean;
  model: CharacterPhysicalStateView;
  onAddCombatEffectEvent?: (draft: CombatEffectEventDraft) => Promise<void> | void;
  onDeleteCombatEffect?: (effectId: string) => Promise<void> | void;
}

const panelStyle = {
  border: "1px solid #d9ddd8",
  borderRadius: 12,
  display: "grid",
  gap: "0.75rem",
  padding: "1rem",
} as const;

const tableStyle = {
  borderCollapse: "collapse",
  fontSize: "0.95rem",
  width: "100%",
} as const;

const cellStyle = {
  borderBottom: "1px solid #e6e8e3",
  padding: "0.45rem",
  textAlign: "left",
} as const;

const combatEffectTypes: Array<{ label: string; value: CombatEffectType }> = [
  { label: "Physical damage", value: "physical_damage" },
  { label: "General damage", value: "general_damage" },
  { label: "Bleed", value: "bleed" },
  { label: "Fatigue", value: "fatigue" },
  { label: "Stun", value: "stun" },
  { label: "Fear", value: "fear" },
  { label: "Morale", value: "morale" },
  { label: "General modifier", value: "general_modifier" },
  { label: "OB/Skill modifier", value: "ob_skill_modifier" },
  { label: "DB modifier", value: "db_modifier" },
  { label: "Other modifier", value: "other_modifier" },
  { label: "Special", value: "special" },
  { label: "Healing", value: "healing" },
];

const combatEffectGroups: Array<{ label: string; value: CombatEffectGroup }> = [
  { label: "General", value: "general" },
  { label: "OB/Skill", value: "obSkill" },
  { label: "DB", value: "db" },
  { label: "Other", value: "other" },
  { label: "Bleed", value: "bleed" },
  { label: "Special", value: "special" },
];

const hitLocationOptions = [
  { label: "General", value: "" },
  { label: "Head", value: "head" },
  { label: "Left arm", value: "leftArm" },
  { label: "Right arm", value: "rightArm" },
  { label: "Chest/back", value: "chestBack" },
  { label: "Abdomen/lower back", value: "abdomenLowerBack" },
  { label: "Upper left leg", value: "upperLeftLeg" },
  { label: "Lower left leg", value: "lowerLeftLeg" },
  { label: "Upper right leg", value: "upperRightLeg" },
  { label: "Lower right leg", value: "lowerRightLeg" },
];

function formatEffectType(type: string): string {
  return combatEffectTypes.find((option) => option.value === type)?.label ?? type;
}

function parseOptionalInteger(value: string): number | undefined {
  const trimmed = value.trim();

  if (!trimmed) {
    return undefined;
  }

  const parsed = Number.parseInt(trimmed, 10);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function parseInteger(value: string): number {
  return parseOptionalInteger(value) ?? 0;
}

interface CombatEffectFormRow {
  damage: string;
  duration: string;
  effectGroup: CombatEffectGroup;
  generalDamage: string;
  location: string;
  modifierValue: string;
  specialEffects: string;
  type: CombatEffectType;
}

function createBlankEffectFormRow(): CombatEffectFormRow {
  return {
    damage: "0",
    duration: "",
    effectGroup: "other",
    generalDamage: "0",
    location: "",
    modifierValue: "",
    specialEffects: "",
    type: "physical_damage",
  };
}

function HitpointsPanel({ model }: PhysicalStateSectionProps) {
  return (
    <section style={panelStyle}>
      <h3 style={{ margin: 0 }}>Hitpoints and damage</h3>
      <div style={{ overflowX: "auto" }}>
        <table style={tableStyle}>
          <thead>
            <tr>
              <th style={cellStyle}>Location</th>
              <th style={cellStyle}>Original</th>
              <th style={cellStyle}>Damage</th>
              <th style={cellStyle}>Current</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td style={cellStyle}>General hitpoints</td>
              <td style={cellStyle}>{model.hitpoints.general.original}</td>
              <td style={cellStyle}>{model.hitpoints.general.damage}</td>
              <td style={cellStyle}>{model.hitpoints.general.current}</td>
            </tr>
            {model.hitpoints.locations.map((location) => (
              <tr key={location.id}>
                <td style={cellStyle}>{location.label}</td>
                <td style={cellStyle}>{location.original}</td>
                <td style={cellStyle}>{location.damage}</td>
                <td style={cellStyle}>{location.current}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function DamageByTypePanel({ model }: PhysicalStateSectionProps) {
  return (
    <section style={panelStyle}>
      <h3 style={{ margin: 0 }}>Combat effects by sum</h3>
      <div style={{ overflowX: "auto" }}>
        <table style={tableStyle}>
          <thead>
            <tr>
              <th style={cellStyle}>Type</th>
              <th style={cellStyle}>Current effect</th>
            </tr>
          </thead>
          <tbody>
            {model.damageByType.map((row) => (
              <tr key={row.id}>
                <td style={cellStyle}>{row.label}</td>
                <td style={cellStyle}>{row.currentEffect}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function HitLogPanel({
  canEditCombatEffects,
  model,
  onDeleteCombatEffect,
}: PhysicalStateSectionProps) {
  return (
    <section style={panelStyle}>
      <h3 style={{ margin: 0 }}>Combat effects</h3>
      <div style={{ overflowX: "auto" }}>
        <table style={tableStyle}>
          <thead>
            <tr>
              <th style={cellStyle}>Round #</th>
              <th style={cellStyle}>Source</th>
              <th style={cellStyle}>Type</th>
              <th style={cellStyle}>Location</th>
              <th style={cellStyle}>Damage</th>
              <th style={cellStyle}>General damage</th>
              <th style={cellStyle}>Duration</th>
              <th style={cellStyle}>Special effects</th>
              <th style={cellStyle}>Save</th>
              <th style={cellStyle}>Delete</th>
            </tr>
          </thead>
          <tbody>
            {model.hitLog.length > 0 ? (
              model.hitLog.map((entry) => (
                <tr key={entry.id}>
                  <td style={cellStyle}>{entry.roundNumber}</td>
                  <td style={cellStyle}>{entry.source}</td>
                  <td style={cellStyle}>{formatEffectType(entry.type)}</td>
                  <td style={cellStyle}>{entry.location}</td>
                  <td style={cellStyle}>{entry.damage}</td>
                  <td style={cellStyle}>{entry.generalDamage}</td>
                  <td style={cellStyle}>{entry.duration}</td>
                  <td style={cellStyle}>{entry.specialEffects}</td>
                  <td style={cellStyle}>
                    <button disabled type="button">
                      Save
                    </button>
                  </td>
                  <td style={cellStyle}>
                    <button
                      disabled={!canEditCombatEffects || !onDeleteCombatEffect}
                      onClick={() => {
                        void onDeleteCombatEffect?.(entry.id);
                      }}
                      type="button"
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={10} style={cellStyle}>
                  No combat effects recorded.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function AddCombatEffectEventForm({
  onAddCombatEffectEvent,
}: Pick<PhysicalStateSectionProps, "onAddCombatEffectEvent">) {
  const [description, setDescription] = useState("");
  const [effectRows, setEffectRows] = useState<CombatEffectFormRow[]>([
    createBlankEffectFormRow(),
  ]);
  const [roundNumber, setRoundNumber] = useState("");
  const [sourceLabel, setSourceLabel] = useState("");
  const [saving, setSaving] = useState(false);
  const canSave = Boolean(sourceLabel.trim()) && Boolean(onAddCombatEffectEvent);

  function updateEffectRow(index: number, patch: Partial<CombatEffectFormRow>) {
    setEffectRows((current) =>
      current.map((row, rowIndex) => (rowIndex === index ? { ...row, ...patch } : row)),
    );
  }

  function resetForm() {
    setDescription("");
    setEffectRows([createBlankEffectFormRow()]);
    setRoundNumber("");
    setSourceLabel("");
  }

  async function submitForm(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!canSave || !onAddCombatEffectEvent) {
      return;
    }

    setSaving(true);

    try {
      await onAddCombatEffectEvent({
        description: description.trim(),
        effects: effectRows.map((row) => ({
          damage: parseInteger(row.damage),
          description: row.specialEffects.trim() || undefined,
          duration: row.duration.trim() || undefined,
          effectGroup: row.effectGroup,
          generalDamage: parseInteger(row.generalDamage),
          location: row.location || undefined,
          modifierValue: parseOptionalInteger(row.modifierValue),
          type: row.type,
        })),
        roundNumber: parseOptionalInteger(roundNumber),
        sourceLabel: sourceLabel.trim(),
      });
      resetForm();
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={submitForm} style={panelStyle}>
      <h3 style={{ margin: 0 }}>Add combat effect event</h3>
      <div
        style={{
          display: "grid",
          gap: "0.75rem",
          gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 12rem), 1fr))",
        }}
      >
        <label style={{ display: "grid", gap: "0.25rem" }}>
          <span>Round #</span>
          <input
            min={1}
            onChange={(event) => setRoundNumber(event.target.value)}
            type="number"
            value={roundNumber}
          />
        </label>
        <label style={{ display: "grid", gap: "0.25rem" }}>
          <span>Source label</span>
          <input
            onChange={(event) => setSourceLabel(event.target.value)}
            required
            value={sourceLabel}
          />
        </label>
        <label style={{ display: "grid", gap: "0.25rem" }}>
          <span>Description</span>
          <input onChange={(event) => setDescription(event.target.value)} value={description} />
        </label>
      </div>
      {effectRows.map((row, index) => (
        <section key={index} style={{ display: "grid", gap: "0.5rem" }}>
          <strong>Effect row {index + 1}</strong>
          <div
            style={{
              display: "grid",
              gap: "0.75rem",
              gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 10rem), 1fr))",
            }}
          >
            <label style={{ display: "grid", gap: "0.25rem" }}>
              <span>Type</span>
              <select
                onChange={(event) =>
                  updateEffectRow(index, { type: event.target.value as CombatEffectType })
                }
                value={row.type}
              >
                {combatEffectTypes.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            <label style={{ display: "grid", gap: "0.25rem" }}>
              <span>Effect group</span>
              <select
                onChange={(event) =>
                  updateEffectRow(index, {
                    effectGroup: event.target.value as CombatEffectGroup,
                  })
                }
                value={row.effectGroup}
              >
                {combatEffectGroups.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            <label style={{ display: "grid", gap: "0.25rem" }}>
              <span>Location</span>
              <select
                onChange={(event) => updateEffectRow(index, { location: event.target.value })}
                value={row.location}
              >
                {hitLocationOptions.map((option) => (
                  <option key={option.value || "general"} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            <label style={{ display: "grid", gap: "0.25rem" }}>
              <span>Damage</span>
              <input
                onChange={(event) => updateEffectRow(index, { damage: event.target.value })}
                type="number"
                value={row.damage}
              />
            </label>
            <label style={{ display: "grid", gap: "0.25rem" }}>
              <span>General damage</span>
              <input
                onChange={(event) =>
                  updateEffectRow(index, { generalDamage: event.target.value })
                }
                type="number"
                value={row.generalDamage}
              />
            </label>
            <label style={{ display: "grid", gap: "0.25rem" }}>
              <span>Modifier value</span>
              <input
                onChange={(event) =>
                  updateEffectRow(index, { modifierValue: event.target.value })
                }
                type="number"
                value={row.modifierValue}
              />
            </label>
            <label style={{ display: "grid", gap: "0.25rem" }}>
              <span>Duration</span>
              <input
                onChange={(event) => updateEffectRow(index, { duration: event.target.value })}
                value={row.duration}
              />
            </label>
            <label style={{ display: "grid", gap: "0.25rem" }}>
              <span>Special effects</span>
              <input
                onChange={(event) =>
                  updateEffectRow(index, { specialEffects: event.target.value })
                }
                value={row.specialEffects}
              />
            </label>
          </div>
          {effectRows.length > 1 ? (
            <button
              onClick={() =>
                setEffectRows((current) => current.filter((_, rowIndex) => rowIndex !== index))
              }
              type="button"
            >
              Remove effect row
            </button>
          ) : null}
        </section>
      ))}
      <div style={{ display: "flex", gap: "0.5rem" }}>
        <button
          disabled={saving}
          onClick={() => setEffectRows((current) => [...current, createBlankEffectFormRow()])}
          type="button"
        >
          Add effect row
        </button>
        <button disabled={!canSave || saving} type="submit">
          Save event
        </button>
        <button
          disabled={saving}
          onClick={resetForm}
          type="button"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}

export function PhysicalStateSection({
  canEditCombatEffects,
  model,
  onAddCombatEffectEvent,
  onDeleteCombatEffect,
}: PhysicalStateSectionProps) {
  return (
    <section style={{ display: "grid", gap: "0.75rem" }}>
      <h2 style={{ margin: 0 }}>Physical state</h2>
      {canEditCombatEffects ? (
        <AddCombatEffectEventForm onAddCombatEffectEvent={onAddCombatEffectEvent} />
      ) : null}
      <div
        style={{
          alignItems: "start",
          display: "grid",
          gap: "0.75rem",
          gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 20rem), 1fr))",
        }}
      >
        <HitpointsPanel model={model} />
        <DamageByTypePanel model={model} />
      </div>
      <HitLogPanel
        canEditCombatEffects={canEditCombatEffects}
        model={model}
        onDeleteCombatEffect={onDeleteCombatEffect}
      />
    </section>
  );
}
