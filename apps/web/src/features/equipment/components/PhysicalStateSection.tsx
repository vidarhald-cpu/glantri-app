import { useState, type FormEvent } from "react";

import type {
  CombatEffectGroup,
  CombatEffectStatus,
  CombatEffectType,
} from "@glantri/domain";

import type {
  CharacterPhysicalStateView,
  HitLogEntryView,
} from "@/lib/characters/physicalState";

export interface CombatEffectEditorDraft {
  damage: number;
  description?: string;
  duration?: string;
  effectGroup: CombatEffectGroup;
  effectId?: string;
  eventDescription?: string;
  generalDamage: number;
  location?: string;
  modifierValue?: number;
  roundNumber?: number;
  sourceEventId?: string;
  sourceLabel: string;
  status: CombatEffectStatus;
  type: CombatEffectType;
}

interface PhysicalStateSectionProps {
  canEditCombatEffects?: boolean;
  model: CharacterPhysicalStateView;
  onDeleteCombatEffect?: (effectId: string) => Promise<void> | void;
  onSaveCombatEffect?: (draft: CombatEffectEditorDraft) => Promise<void> | void;
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

const compactCellStyle = {
  ...cellStyle,
  padding: "0.35rem 0.45rem",
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
  { label: "None", value: "none" },
  { label: "General", value: "general" },
  { label: "OB/Skill", value: "obSkill" },
  { label: "DB", value: "db" },
  { label: "Other", value: "other" },
  { label: "Bleed", value: "bleed" },
  { label: "Special", value: "special" },
];

const combatEffectStatuses: Array<{ label: string; value: CombatEffectStatus }> = [
  { label: "Active", value: "active" },
  { label: "Resolved", value: "resolved" },
  { label: "Expired", value: "expired" },
  { label: "Superseded", value: "superseded" },
];

const hitLocationOptions = [
  { label: "None", value: "" },
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

function createLocalId(prefix: string): string {
  return `${prefix}-${globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`}`;
}

function formatEffectType(type: CombatEffectType): string {
  return combatEffectTypes.find((option) => option.value === type)?.label ?? type;
}

function formatLocation(location: string): string {
  return hitLocationOptions.find((option) => option.value === location)?.label ?? location;
}

function formatMainValue(entry: HitLogEntryView): string {
  const parts = [
    entry.damage !== 0 ? `damage ${entry.damage}` : undefined,
    entry.generalDamage !== 0 ? `general ${entry.generalDamage}` : undefined,
    entry.modifierValue != null ? `mod ${entry.modifierValue}` : undefined,
  ].filter((value): value is string => Boolean(value));

  return parts.length > 0 ? parts.join(" · ") : "—";
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

function createBlankDraft(seed: Partial<CombatEffectEditorDraft> = {}): CombatEffectEditorDraft {
  return {
    damage: 0,
    effectGroup: "none",
    generalDamage: 0,
    sourceLabel: "",
    status: "active",
    type: "physical_damage",
    ...seed,
  };
}

function draftFromEntry(entry: HitLogEntryView): CombatEffectEditorDraft {
  return createBlankDraft({
    damage: entry.damage,
    description: entry.specialEffects || undefined,
    duration: entry.duration || undefined,
    effectGroup: entry.effectGroup,
    effectId: entry.id,
    eventDescription: entry.eventDescription || undefined,
    generalDamage: entry.generalDamage,
    location: entry.location || undefined,
    modifierValue: entry.modifierValue,
    roundNumber: typeof entry.roundNumber === "number" ? entry.roundNumber : undefined,
    sourceEventId: entry.sourceEventId,
    sourceLabel: entry.source,
    status: entry.status,
    type: entry.type,
  });
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

function CombatEffectsPanel({
  canEditCombatEffects,
  model,
  onDeleteCombatEffect,
  onSaveCombatEffect,
}: PhysicalStateSectionProps) {
  const [draft, setDraft] = useState<CombatEffectEditorDraft>(createBlankDraft());
  const [saving, setSaving] = useState(false);
  const selectedEffectId = draft.effectId;
  const canSave = Boolean(draft.sourceLabel.trim()) && Boolean(onSaveCombatEffect);

  function selectEntry(entry: HitLogEntryView) {
    if (!canEditCombatEffects) {
      return;
    }

    setDraft(draftFromEntry(entry));
  }

  function startLinkedEffect() {
    setDraft(
      createBlankDraft({
        eventDescription: draft.eventDescription,
        roundNumber: draft.roundNumber,
        sourceEventId: draft.sourceEventId,
        sourceLabel: draft.sourceLabel,
      }),
    );
  }

  function startNewEvent() {
    setDraft(createBlankDraft());
  }

  async function submitForm(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!canSave || !onSaveCombatEffect) {
      return;
    }

    const draftToSave = {
      ...draft,
      sourceEventId: draft.sourceEventId ?? createLocalId("combat-event"),
    };

    setSaving(true);

    try {
      await onSaveCombatEffect(draftToSave);
      setDraft(
        createBlankDraft({
          eventDescription: draftToSave.eventDescription,
          roundNumber: draftToSave.roundNumber,
          sourceEventId: draftToSave.sourceEventId,
          sourceLabel: draftToSave.sourceLabel,
        }),
      );
    } finally {
      setSaving(false);
    }
  }

  async function deleteSelectedEffect() {
    if (!selectedEffectId || !onDeleteCombatEffect) {
      return;
    }

    setSaving(true);

    try {
      await onDeleteCombatEffect(selectedEffectId);
      startLinkedEffect();
    } finally {
      setSaving(false);
    }
  }

  return (
    <section style={panelStyle}>
      <h3 style={{ margin: 0 }}>Combat effects</h3>
      <div style={{ overflowX: "auto" }}>
        <table style={tableStyle}>
          <thead>
            <tr>
              <th style={compactCellStyle}>Round #</th>
              <th style={compactCellStyle}>Source</th>
              <th style={compactCellStyle}>Type</th>
              <th style={compactCellStyle}>Location</th>
              <th style={compactCellStyle}>Value</th>
              <th style={compactCellStyle}>Duration/status</th>
              <th style={compactCellStyle}>Details</th>
            </tr>
          </thead>
          <tbody>
            {model.hitLog.length > 0 ? (
              model.hitLog.map((entry) => (
                <tr
                  key={entry.id}
                  onClick={() => selectEntry(entry)}
                  style={{
                    cursor: canEditCombatEffects ? "pointer" : "default",
                    outline: selectedEffectId === entry.id ? "2px solid #68715f" : undefined,
                  }}
                >
                  <td style={compactCellStyle}>{entry.roundNumber}</td>
                  <td style={compactCellStyle}>{entry.source}</td>
                  <td style={compactCellStyle}>{formatEffectType(entry.type)}</td>
                  <td style={compactCellStyle}>{formatLocation(entry.location)}</td>
                  <td style={compactCellStyle}>{formatMainValue(entry)}</td>
                  <td style={compactCellStyle}>
                    {[entry.duration, entry.status].filter(Boolean).join(" · ")}
                  </td>
                  <td style={compactCellStyle}>{entry.specialEffects}</td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={7} style={compactCellStyle}>
                  No combat effects recorded.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {canEditCombatEffects ? (
        <form onSubmit={submitForm} style={{ display: "grid", gap: "0.65rem" }}>
          <strong>{selectedEffectId ? "Edit selected effect" : "New combat effect"}</strong>
          <div
            style={{
              display: "grid",
              gap: "0.5rem",
              gridTemplateColumns: "minmax(5rem, 0.5fr) minmax(9rem, 1fr) minmax(12rem, 1.2fr)",
            }}
          >
            <label style={{ display: "grid", gap: "0.2rem" }}>
              <span>Round #</span>
              <input
                min={1}
                onChange={(event) =>
                  setDraft((current) => ({
                    ...current,
                    roundNumber: parseOptionalInteger(event.target.value),
                  }))
                }
                type="number"
                value={draft.roundNumber ?? ""}
              />
            </label>
            <label style={{ display: "grid", gap: "0.2rem" }}>
              <span>Source/Event label</span>
              <input
                onChange={(event) =>
                  setDraft((current) => ({ ...current, sourceLabel: event.target.value }))
                }
                required
                value={draft.sourceLabel}
              />
            </label>
            <label style={{ display: "grid", gap: "0.2rem" }}>
              <span>Description</span>
              <input
                onChange={(event) =>
                  setDraft((current) => ({
                    ...current,
                    eventDescription: event.target.value,
                  }))
                }
                value={draft.eventDescription ?? ""}
              />
            </label>
          </div>
          <div
            style={{
              display: "grid",
              gap: "0.5rem",
              gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 7.5rem), 1fr))",
            }}
          >
            <label style={{ display: "grid", gap: "0.2rem" }}>
              <span>Type</span>
              <select
                onChange={(event) =>
                  setDraft((current) => ({
                    ...current,
                    type: event.target.value as CombatEffectType,
                  }))
                }
                value={draft.type}
              >
                {combatEffectTypes.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            <label style={{ display: "grid", gap: "0.2rem" }}>
              <span>Effect group</span>
              <select
                onChange={(event) =>
                  setDraft((current) => ({
                    ...current,
                    effectGroup: event.target.value as CombatEffectGroup,
                  }))
                }
                value={draft.effectGroup}
              >
                {combatEffectGroups.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            <label style={{ display: "grid", gap: "0.2rem" }}>
              <span>Location</span>
              <select
                onChange={(event) =>
                  setDraft((current) => ({
                    ...current,
                    location: event.target.value || undefined,
                  }))
                }
                value={draft.location ?? ""}
              >
                {hitLocationOptions.map((option) => (
                  <option key={option.value || "none"} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            <label style={{ display: "grid", gap: "0.2rem" }}>
              <span>Damage</span>
              <input
                onChange={(event) =>
                  setDraft((current) => ({
                    ...current,
                    damage: parseInteger(event.target.value),
                  }))
                }
                type="number"
                value={draft.damage}
              />
            </label>
            <label style={{ display: "grid", gap: "0.2rem" }}>
              <span>General damage</span>
              <input
                onChange={(event) =>
                  setDraft((current) => ({
                    ...current,
                    generalDamage: parseInteger(event.target.value),
                  }))
                }
                type="number"
                value={draft.generalDamage}
              />
            </label>
            <label style={{ display: "grid", gap: "0.2rem" }}>
              <span>Modifier</span>
              <input
                onChange={(event) =>
                  setDraft((current) => ({
                    ...current,
                    modifierValue: parseOptionalInteger(event.target.value),
                  }))
                }
                type="number"
                value={draft.modifierValue ?? ""}
              />
            </label>
            <label style={{ display: "grid", gap: "0.2rem" }}>
              <span>Duration</span>
              <input
                onChange={(event) =>
                  setDraft((current) => ({ ...current, duration: event.target.value }))
                }
                value={draft.duration ?? ""}
              />
            </label>
            <label style={{ display: "grid", gap: "0.2rem" }}>
              <span>Status</span>
              <select
                onChange={(event) =>
                  setDraft((current) => ({
                    ...current,
                    status: event.target.value as CombatEffectStatus,
                  }))
                }
                value={draft.status}
              >
                {combatEffectStatuses.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <label style={{ display: "grid", gap: "0.2rem" }}>
            <span>Special effects</span>
            <input
              onChange={(event) =>
                setDraft((current) => ({ ...current, description: event.target.value }))
              }
              value={draft.description ?? ""}
            />
          </label>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem" }}>
            <button disabled={!canSave || saving} type="submit">
              Save
            </button>
            <button disabled={saving} onClick={startLinkedEffect} type="button">
              Same event as selected
            </button>
            <button disabled={saving} onClick={startNewEvent} type="button">
              Cancel
            </button>
            <button
              disabled={!selectedEffectId || !onDeleteCombatEffect || saving}
              onClick={deleteSelectedEffect}
              type="button"
            >
              Delete
            </button>
          </div>
        </form>
      ) : null}
    </section>
  );
}

export function PhysicalStateSection({
  canEditCombatEffects,
  model,
  onDeleteCombatEffect,
  onSaveCombatEffect,
}: PhysicalStateSectionProps) {
  return (
    <section style={{ display: "grid", gap: "0.75rem" }}>
      <h2 style={{ margin: 0 }}>Physical state</h2>
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
      <CombatEffectsPanel
        canEditCombatEffects={canEditCombatEffects}
        model={model}
        onDeleteCombatEffect={onDeleteCombatEffect}
        onSaveCombatEffect={onSaveCombatEffect}
      />
    </section>
  );
}
