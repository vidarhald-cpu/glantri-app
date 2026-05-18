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
  locationIds: string[];
  modifierValue?: number;
  roundNumber?: number;
  sourceEventId?: string;
  sourceLabel?: string;
  status: CombatEffectStatus;
  type: CombatEffectType;
}

interface PhysicalStateSectionProps {
  canEditCombatEffects?: boolean;
  currentRoundNumber?: number;
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

const compactInputStyle = {
  minWidth: 0,
  width: "100%",
} as const;

const numericInputStyle = {
  ...compactInputStyle,
  maxWidth: "3.75rem",
} as const;

const visibleCombatEffectTypes: Array<{ label: string; value: CombatEffectType }> = [
  { label: "Physical", value: "physical_damage" },
  { label: "Bleed", value: "bleed" },
  { label: "Internal bleed", value: "internal_bleed" },
  { label: "Fatigue", value: "fatigue" },
  { label: "Stun", value: "stun" },
  { label: "Fear", value: "fear" },
  { label: "Morale", value: "morale" },
  { label: "Special", value: "special" },
];

const combatEffectGroups: Array<{ label: string; value: CombatEffectGroup }> = [
  { label: "None", value: "none" },
  { label: "General", value: "general" },
  { label: "OB/Skill", value: "obSkill" },
  { label: "DB", value: "db" },
  { label: "Bleed", value: "bleed" },
  { label: "Special", value: "special" },
];

const combatEffectStatuses: Array<{ label: string; value: CombatEffectStatus }> = [
  { label: "Active", value: "active" },
  { label: "Resolved", value: "resolved" },
  { label: "Expired", value: "expired" },
  { label: "Superseded", value: "superseded" },
];

const locationOptions = [
  { fullLabel: "Head", label: "H", value: "head" },
  { fullLabel: "Left arm", label: "LA", value: "leftArm" },
  { fullLabel: "Right arm", label: "RA", value: "rightArm" },
  { fullLabel: "Chest/back", label: "CB", value: "chestBack" },
  { fullLabel: "Abdomen/lower back", label: "AB", value: "abdomenLowerBack" },
  { fullLabel: "Upper left leg", label: "ULL", value: "upperLeftLeg" },
  { fullLabel: "Lower left leg", label: "LLL", value: "lowerLeftLeg" },
  { fullLabel: "Upper right leg", label: "URL", value: "upperRightLeg" },
  { fullLabel: "Lower right leg", label: "LRL", value: "lowerRightLeg" },
  { fullLabel: "General", label: "Gen", value: "general" },
];

const locationGridStyle = {
  border: "1px solid #d9ddd8",
  borderRadius: 8,
  display: "grid",
  gridTemplateColumns: "repeat(10, minmax(2.25rem, 1fr))",
  overflow: "hidden",
} as const;

const locationHeaderCellStyle = {
  background: "#f0efe7",
  borderBottom: "1px solid #d9ddd8",
  borderRight: "1px solid #d9ddd8",
  fontSize: "0.78rem",
  fontWeight: 700,
  padding: "0.2rem",
  textAlign: "center",
} as const;

const locationCheckboxCellStyle = {
  borderRight: "1px solid #d9ddd8",
  display: "grid",
  justifyItems: "center",
  padding: "0.2rem",
} as const;

const physicalStatePanelStyle = {
  background: "#fbfaf5",
  border: "1px solid #d9ddd8",
  borderRadius: 12,
  display: "grid",
  gap: "0.75rem",
  padding: "1rem",
} as const;

function createLocalId(prefix: string): string {
  return `${prefix}-${globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`}`;
}

function formatEffectType(type: CombatEffectType): string {
  return (
    visibleCombatEffectTypes.find((option) => option.value === type)?.label ??
    type.replaceAll("_", " ")
  );
}

function formatLocation(location: string): string {
  return locationOptions.find((option) => option.value === location)?.label ?? (location || "—");
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

function getDefaultRoundNumber(roundNumber?: number): number | undefined {
  return roundNumber && roundNumber > 0 ? roundNumber : undefined;
}

function createBlankDraft(
  seed: Partial<CombatEffectEditorDraft> = {},
  currentRoundNumber?: number,
): CombatEffectEditorDraft {
  return {
    damage: 0,
    effectGroup: "none",
    locationIds: [],
    roundNumber: getDefaultRoundNumber(currentRoundNumber),
    status: "active",
    type: "physical_damage",
    ...seed,
  };
}

function draftFromEntry(entry: HitLogEntryView): CombatEffectEditorDraft {
  const locationIds = [
    entry.location || undefined,
    entry.generalDamage !== 0 ? "general" : undefined,
  ].filter((value): value is string => Boolean(value));

  return createBlankDraft({
    damage: entry.location ? entry.damage : entry.generalDamage,
    description: entry.specialEffects || undefined,
    duration: entry.duration || undefined,
    effectGroup: entry.effectGroup,
    effectId: entry.id,
    eventDescription: entry.eventDescription || undefined,
    locationIds,
    modifierValue: entry.modifierValue,
    roundNumber: typeof entry.roundNumber === "number" ? entry.roundNumber : undefined,
    sourceEventId: entry.sourceEventId,
    sourceLabel: entry.source,
    status: entry.status,
    type: entry.type,
  });
}

function buildGeneratedSourceLabel(draft: CombatEffectEditorDraft): string {
  const typeLabel = formatEffectType(draft.type);
  const round = draft.roundNumber ? `R${draft.roundNumber}` : "Manual";
  const detail = draft.eventDescription?.trim();

  return detail ? `${round} · ${typeLabel} · ${detail}` : `${round} · ${typeLabel}`;
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
  currentRoundNumber,
  model,
  onDeleteCombatEffect,
  onSaveCombatEffect,
}: PhysicalStateSectionProps) {
  const [draft, setDraft] = useState<CombatEffectEditorDraft>(
    createBlankDraft({}, currentRoundNumber),
  );
  const [saving, setSaving] = useState(false);
  const selectedEffectId = draft.effectId;
  const canSave = Boolean(onSaveCombatEffect);

  function selectEntry(entry: HitLogEntryView) {
    if (!canEditCombatEffects) {
      return;
    }

    setDraft(draftFromEntry(entry));
  }

  function startLinkedEffect() {
    setDraft(
      createBlankDraft(
        {
          eventDescription: draft.eventDescription,
          roundNumber: draft.roundNumber,
          sourceEventId: draft.sourceEventId,
          sourceLabel: draft.sourceLabel,
        },
        currentRoundNumber,
      ),
    );
  }

  function startNewEvent() {
    setDraft(createBlankDraft({}, currentRoundNumber));
  }

  function toggleLocation(value: string) {
    setDraft((current) => {
      if (value === "") {
        return {
          ...current,
          locationIds: [],
        };
      }

      if (current.effectId) {
        return {
          ...current,
          locationIds: current.locationIds.includes(value) ? [] : [value],
        };
      }

      return {
        ...current,
        locationIds: current.locationIds.includes(value)
          ? current.locationIds.filter((locationId) => locationId !== value)
          : [...current.locationIds, value],
      };
    });
  }

  async function submitForm(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!canSave || !onSaveCombatEffect) {
      return;
    }

    const draftToSave = {
      ...draft,
      sourceEventId: draft.sourceEventId ?? createLocalId("combat-event"),
      sourceLabel: draft.sourceLabel ?? buildGeneratedSourceLabel(draft),
    };

    setSaving(true);

    try {
      await onSaveCombatEffect(draftToSave);
      setDraft(
        createBlankDraft(
          {
            eventDescription: draftToSave.eventDescription,
            roundNumber: draftToSave.roundNumber,
            sourceEventId: draftToSave.sourceEventId,
            sourceLabel: draftToSave.sourceLabel,
          },
          currentRoundNumber,
        ),
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
      <div style={{ maxHeight: "18rem", overflow: "auto" }}>
        <table style={tableStyle}>
          <thead>
            <tr>
              <th style={compactCellStyle}>Round</th>
              <th style={compactCellStyle}>Event</th>
              <th style={compactCellStyle}>Type</th>
              <th style={compactCellStyle}>Loc</th>
              <th style={compactCellStyle}>Value</th>
              <th style={compactCellStyle}>Dur/Sta</th>
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
                  <td style={compactCellStyle}>{entry.eventNumber}</td>
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
        <form
          onSubmit={submitForm}
          style={{
            background: "#fbfaf6",
            borderTop: "1px solid #e6e8e3",
            bottom: 0,
            display: "grid",
            gap: "0.45rem",
            paddingTop: "0.65rem",
            position: "sticky",
          }}
        >
          <strong>{selectedEffectId ? "Edit selected effect" : "New effect"}</strong>
          <div
            style={{
              alignItems: "end",
              display: "grid",
              gap: "0.45rem",
              gridTemplateColumns: "4rem minmax(14rem, 1fr) auto",
            }}
          >
            <label style={{ display: "grid", gap: "0.2rem" }}>
              <span>Round</span>
              <input
                max={999}
                min={1}
                onChange={(event) =>
                  setDraft((current) => ({
                    ...current,
                    roundNumber: parseOptionalInteger(event.target.value),
                  }))
                }
                style={numericInputStyle}
                type="number"
                value={draft.roundNumber ?? ""}
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
                style={compactInputStyle}
                value={draft.eventDescription ?? ""}
              />
            </label>
            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                gap: "0.35rem",
                justifyContent: "flex-end",
              }}
            >
              <button disabled={!canSave || saving} type="submit">
                Save
              </button>
              <button disabled={saving} onClick={startLinkedEffect} type="button">
                Same event
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
          </div>
          <div
            style={{
              alignItems: "end",
              display: "grid",
              gap: "0.45rem",
              gridTemplateColumns:
                "7rem 6.5rem minmax(22rem, 1.6fr) 3.75rem 3.75rem 5rem 5rem minmax(10rem, 1fr)",
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
                style={compactInputStyle}
                value={draft.type}
              >
                {visibleCombatEffectTypes.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            <label style={{ display: "grid", gap: "0.2rem" }}>
              <span>Group</span>
              <select
                onChange={(event) =>
                  setDraft((current) => ({
                    ...current,
                    effectGroup: event.target.value as CombatEffectGroup,
                  }))
                }
                style={compactInputStyle}
                value={draft.effectGroup}
              >
                {combatEffectGroups.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            <fieldset style={{ border: 0, display: "grid", gap: "0.2rem", margin: 0, padding: 0 }}>
              <legend style={{ fontSize: "0.9rem", fontWeight: 700, padding: 0 }}>Loc</legend>
              <div style={locationGridStyle}>
                {locationOptions.map((option, index) => (
                  <div
                    key={`heading-${option.value}`}
                    style={{
                      ...locationHeaderCellStyle,
                      borderRight:
                        index === locationOptions.length - 1 ? undefined : "1px solid #d9ddd8",
                    }}
                    title={option.fullLabel}
                  >
                    {option.label}
                  </div>
                ))}
                {locationOptions.map((option, index) => (
                  <label
                    key={option.value}
                    style={{
                      ...locationCheckboxCellStyle,
                      borderRight:
                        index === locationOptions.length - 1 ? undefined : "1px solid #d9ddd8",
                    }}
                    title={option.fullLabel}
                  >
                    <input
                      aria-label={option.fullLabel}
                      checked={draft.locationIds.includes(option.value)}
                      onChange={() => toggleLocation(option.value)}
                      type="checkbox"
                    />
                  </label>
                ))}
              </div>
            </fieldset>
            <label style={{ display: "grid", gap: "0.2rem" }}>
              <span>Dam</span>
              <input
                onChange={(event) =>
                  setDraft((current) => ({
                    ...current,
                    damage: parseInteger(event.target.value),
                  }))
                }
                style={numericInputStyle}
                type="number"
                value={draft.damage}
              />
            </label>
            <label style={{ display: "grid", gap: "0.2rem" }}>
              <span>Mod</span>
              <input
                onChange={(event) =>
                  setDraft((current) => ({
                    ...current,
                    modifierValue: parseOptionalInteger(event.target.value),
                  }))
                }
                style={numericInputStyle}
                type="number"
                value={draft.modifierValue ?? ""}
              />
            </label>
            <label style={{ display: "grid", gap: "0.2rem" }}>
              <span>Dur</span>
              <input
                onChange={(event) =>
                  setDraft((current) => ({ ...current, duration: event.target.value }))
                }
                style={compactInputStyle}
                value={draft.duration ?? ""}
              />
            </label>
            <label style={{ display: "grid", gap: "0.2rem" }}>
              <span>Sta</span>
              <select
                onChange={(event) =>
                  setDraft((current) => ({
                    ...current,
                    status: event.target.value as CombatEffectStatus,
                  }))
                }
                style={compactInputStyle}
                value={draft.status}
              >
                {combatEffectStatuses.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            <label style={{ display: "grid", gap: "0.2rem" }}>
              <span>Details</span>
              <input
                onChange={(event) =>
                  setDraft((current) => ({
                    ...current,
                    description: event.target.value,
                  }))
                }
                style={compactInputStyle}
                value={draft.description ?? ""}
              />
            </label>
          </div>
        </form>
      ) : null}
    </section>
  );
}

export function PhysicalStateSection({
  canEditCombatEffects,
  currentRoundNumber,
  model,
  onDeleteCombatEffect,
  onSaveCombatEffect,
}: PhysicalStateSectionProps) {
  return (
    <section style={physicalStatePanelStyle}>
      <h2 style={{ margin: 0 }}>Physical state panel</h2>
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
        currentRoundNumber={currentRoundNumber}
        model={model}
        onDeleteCombatEffect={onDeleteCombatEffect}
        onSaveCombatEffect={onSaveCombatEffect}
      />
    </section>
  );
}
