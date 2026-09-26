"use client";

import type {
  CombatGenericAction,
  CombatGenericActionDuration,
  GlantriCharacteristicKey,
  ScenarioParticipant,
} from "@glantri/domain";

/**
 * GM Combat Task lifecycle surfaces for the Combat Inspector, split exactly as the settled M5 and
 * M6 rulings require (Combat Panel Contract §12.17).
 *
 * - {@link CombatTaskReviewFields} carries the GM review **fields** — duration, roll basis,
 *   Skill/Stat, Difficulty and reference — and lives in the Action Selector. It renders **no** Save
 *   or commit control: the review command is issued from Current action.
 * - {@link CombatTaskResolveControls} carries the resolve command's **inputs** — the GM-authored
 *   player-safe result text and the audience — plus the opportunity-boundary Interrupt and Cancel
 *   commands, and lives in Current action.
 *
 * Both are presentational. Every command, descriptor and revision stays with the panel.
 */

export interface CombatTaskReviewDraft {
  readonly difficulty: string;
  readonly durationKind: CombatGenericActionDuration["kind"];
  readonly durationPhase: "phase1" | "phase2";
  readonly environmentDescription: string;
  readonly itemId: string;
  readonly referenceKind: "none" | "participant" | "item" | "environment";
  readonly referenceParticipantId: string;
  readonly rollKind: "none" | "skill" | "stat";
  readonly rounds: string;
  readonly skillId: string;
  readonly statId: GlantriCharacteristicKey;
}

export interface CombatTaskResultDraft {
  readonly audience: readonly string[];
  readonly text: string;
}

export interface CombatTaskParticipantOption {
  readonly label: string;
  readonly participantId: string;
}

export interface CombatTaskItemOption {
  readonly id: string;
  readonly label: string;
}

export const COMBAT_TASK_STAT_OPTIONS: ReadonlyArray<{
  id: GlantriCharacteristicKey;
  label: string;
}> = [
  { id: "cha", label: "Charisma" },
  { id: "com", label: "Comeliness" },
  { id: "con", label: "Constitution" },
  { id: "dex", label: "Dexterity" },
  { id: "health", label: "Health" },
  { id: "int", label: "Intelligence" },
  { id: "lck", label: "Luck" },
  { id: "pow", label: "Power" },
  { id: "siz", label: "Size" },
  { id: "str", label: "Strength" },
  { id: "will", label: "Willpower" },
];

const panelCardStyle = {
  background: "#f6f5ef",
  border: "1px solid #d9ddd8",
  borderRadius: 12,
  boxSizing: "border-box",
  display: "grid",
  gap: "0.5rem",
  minWidth: 0,
  padding: "0.75rem",
  width: "100%",
} as const;

const fieldStyle = { display: "grid", gap: "0.15rem", minWidth: 0 } as const;

const labelTextStyle = { fontSize: "0.88rem", fontWeight: 600 } as const;

/**
 * The reviewable Item references for a task, read from the owner's canonical equipment snapshot —
 * the same source the retiring `GenericCombatActionPanel` read.
 */
export function buildCombatTaskItemOptions(
  participant?: ScenarioParticipant,
): readonly CombatTaskItemOption[] {
  const equipmentState = participant?.snapshot.equipmentState;
  if (!equipmentState || typeof equipmentState !== "object") return [];
  const state = equipmentState as {
    itemsById?: Record<string, { id?: string; name?: string; templateId?: string }>;
    templates?: { templatesById?: Record<string, { name?: string }> };
    templatesById?: Record<string, { name?: string }>;
  };
  const templates = state.templates?.templatesById ?? state.templatesById ?? {};
  return Object.entries(state.itemsById ?? {}).map(([id, item]) => ({
    id,
    label:
      item.name?.trim() ||
      (item.templateId ? templates[item.templateId]?.name : undefined) ||
      "Item",
  }));
}

/** Seeds the review fields from the task's own current rule inputs. */
export function buildCombatTaskReviewDraftFromTask(
  action: CombatGenericAction,
): CombatTaskReviewDraft {
  return {
    difficulty: String(action.rollRequest?.difficulty ?? 26),
    durationKind: action.duration.kind,
    durationPhase: action.duration.kind === "phase" ? action.duration.phase : "phase1",
    environmentDescription:
      action.reference?.kind === "environment" ? action.reference.description : "",
    itemId: action.reference?.kind === "item" ? action.reference.itemId : "",
    referenceKind: action.reference?.kind ?? "none",
    referenceParticipantId:
      action.reference?.kind === "participant" ? action.reference.participantId : "",
    rollKind: action.rollRequest?.basis.kind ?? "none",
    rounds: String(action.duration.kind === "rounds" ? action.duration.rounds : 2),
    skillId: action.rollRequest?.basis.kind === "skill" ? action.rollRequest.basis.skillId : "",
    statId: action.rollRequest?.basis.kind === "stat" ? action.rollRequest.basis.statId : "con",
  };
}

/** Builds the duration the review command carries from the GM's chosen fields. */
export function buildCombatTaskReviewDuration(
  draft: CombatTaskReviewDraft,
): CombatGenericActionDuration {
  if (draft.durationKind === "phase") return { kind: "phase", phase: draft.durationPhase };
  if (draft.durationKind === "rounds") {
    const rounds = Number.parseInt(draft.rounds, 10);
    return { kind: "rounds", rounds: Number.isFinite(rounds) ? Math.max(2, rounds) : 2 };
  }
  return { kind: draft.durationKind };
}

/**
 * The one validation message the review fields own. The Action Selector never commits, so an
 * incomplete fieldset blocks Current action's review command rather than a control of its own.
 */
export function getCombatTaskReviewValidationMessage(
  draft: CombatTaskReviewDraft,
): string | undefined {
  if (draft.durationKind === "rounds") {
    const rounds = Number.parseInt(draft.rounds, 10);
    if (!Number.isFinite(rounds) || rounds < 2) return "Enter at least 2 reviewed rounds.";
  }
  if (draft.rollKind === "skill" && !draft.skillId) return "Choose the reviewed Skill.";
  if (draft.rollKind !== "none") {
    const difficulty = Number.parseInt(draft.difficulty, 10);
    if (!Number.isFinite(difficulty) || difficulty < 1 || difficulty > 200) {
      return "Enter a reviewed Difficulty between 1 and 200.";
    }
  }
  if (draft.referenceKind === "participant" && !draft.referenceParticipantId) {
    return "Choose the reviewed participant.";
  }
  if (draft.referenceKind === "item" && !draft.itemId) return "Choose the reviewed Item.";
  if (draft.referenceKind === "environment" && !draft.environmentDescription.trim()) {
    return "Describe the reviewed environment.";
  }
  return undefined;
}

/** The resolve command's own input validation, owned by Current action. */
export function getCombatTaskResolveValidationMessage(
  draft: CombatTaskResultDraft,
): string | undefined {
  if (!draft.text.trim()) return "Enter the player-safe result before resolving this Combat Task.";
  if (draft.audience.length === 0) return "Choose who receives this result.";
  return undefined;
}

export interface CombatTaskReviewFieldsProps {
  readonly disabled?: boolean;
  readonly draft: CombatTaskReviewDraft;
  readonly intent: string;
  readonly itemOptions: readonly CombatTaskItemOption[];
  readonly onChange: (change: Partial<CombatTaskReviewDraft>) => void;
  readonly participantOptions: readonly CombatTaskParticipantOption[];
  readonly skills: readonly { id: string; name: string }[];
  readonly validationMessage?: string;
}

export function CombatTaskReviewFields({
  disabled = false,
  draft,
  intent,
  itemOptions,
  onChange,
  participantOptions,
  skills,
  validationMessage,
}: CombatTaskReviewFieldsProps) {
  return (
    <section style={panelCardStyle}>
      <strong>Action selector · Combat Task review</strong>
      <div style={{ color: "#5e5a50", fontSize: "0.85rem" }}>{intent}</div>
      <fieldset aria-label="Combat Task review fields" style={{ display: "grid", gap: "0.5rem" }}>
        <legend style={labelTextStyle}>GM review adjustments</legend>
        <label style={fieldStyle}>
          <span style={labelTextStyle}>Reviewed duration</span>
          <select
            disabled={disabled}
            onChange={(event) =>
              onChange({ durationKind: event.target.value as CombatGenericActionDuration["kind"] })
            }
            value={draft.durationKind}
          >
            <option value="phase">One phase</option>
            <option value="round">One round</option>
            <option value="rounds">Several rounds</option>
            <option value="gm_decided">GM decides</option>
          </select>
        </label>
        {draft.durationKind === "phase" ? (
          <label style={fieldStyle}>
            <span style={labelTextStyle}>Reviewed phase</span>
            <select
              disabled={disabled}
              onChange={(event) =>
                onChange({ durationPhase: event.target.value as "phase1" | "phase2" })
              }
              value={draft.durationPhase}
            >
              <option value="phase1">Phase 1</option>
              <option value="phase2">Phase 2</option>
            </select>
          </label>
        ) : null}
        {draft.durationKind === "rounds" ? (
          <label style={fieldStyle}>
            <span style={labelTextStyle}>Reviewed rounds</span>
            <input
              disabled={disabled}
              inputMode="numeric"
              min={2}
              onChange={(event) => onChange({ rounds: event.target.value })}
              type="number"
              value={draft.rounds}
            />
          </label>
        ) : null}
        <label style={fieldStyle}>
          <span style={labelTextStyle}>Reviewed roll</span>
          <select
            disabled={disabled}
            onChange={(event) =>
              onChange({ rollKind: event.target.value as CombatTaskReviewDraft["rollKind"] })
            }
            value={draft.rollKind}
          >
            <option value="none">No roll</option>
            <option value="skill">Skill</option>
            <option value="stat">Current Stat</option>
          </select>
        </label>
        {draft.rollKind === "skill" ? (
          <label style={fieldStyle}>
            <span style={labelTextStyle}>Reviewed Skill</span>
            <select
              disabled={disabled}
              onChange={(event) => onChange({ skillId: event.target.value })}
              value={draft.skillId}
            >
              <option value="">Choose Skill</option>
              {skills.map((skill) => (
                <option key={skill.id} value={skill.id}>
                  {skill.name}
                </option>
              ))}
            </select>
          </label>
        ) : null}
        {draft.rollKind === "stat" ? (
          <label style={fieldStyle}>
            <span style={labelTextStyle}>Reviewed Current Stat</span>
            <select
              disabled={disabled}
              onChange={(event) =>
                onChange({ statId: event.target.value as GlantriCharacteristicKey })
              }
              value={draft.statId}
            >
              {COMBAT_TASK_STAT_OPTIONS.map((stat) => (
                <option key={stat.id} value={stat.id}>
                  {stat.label}
                </option>
              ))}
            </select>
          </label>
        ) : null}
        {draft.rollKind !== "none" ? (
          <label style={fieldStyle}>
            <span style={labelTextStyle}>Reviewed Difficulty</span>
            <input
              disabled={disabled}
              inputMode="numeric"
              max={200}
              min={1}
              onChange={(event) => onChange({ difficulty: event.target.value })}
              type="number"
              value={draft.difficulty}
            />
          </label>
        ) : null}
        <label style={fieldStyle}>
          <span style={labelTextStyle}>Reviewed reference</span>
          <select
            disabled={disabled}
            onChange={(event) =>
              onChange({
                referenceKind: event.target.value as CombatTaskReviewDraft["referenceKind"],
              })
            }
            value={draft.referenceKind}
          >
            <option value="none">None</option>
            <option value="participant">Participant</option>
            <option value="item">Item</option>
            <option value="environment">Environment</option>
          </select>
        </label>
        {draft.referenceKind === "participant" ? (
          <label style={fieldStyle}>
            <span style={labelTextStyle}>Reviewed participant</span>
            <select
              disabled={disabled}
              onChange={(event) => onChange({ referenceParticipantId: event.target.value })}
              value={draft.referenceParticipantId}
            >
              <option value="">Choose participant</option>
              {participantOptions.map((entry) => (
                <option key={entry.participantId} value={entry.participantId}>
                  {entry.label}
                </option>
              ))}
            </select>
          </label>
        ) : null}
        {draft.referenceKind === "item" ? (
          <label style={fieldStyle}>
            <span style={labelTextStyle}>Reviewed Item</span>
            <select
              disabled={disabled}
              onChange={(event) => onChange({ itemId: event.target.value })}
              value={draft.itemId}
            >
              <option value="">Choose Item</option>
              {itemOptions.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.label}
                </option>
              ))}
            </select>
          </label>
        ) : null}
        {draft.referenceKind === "environment" ? (
          <label style={fieldStyle}>
            <span style={labelTextStyle}>Reviewed environment</span>
            <input
              disabled={disabled}
              maxLength={500}
              onChange={(event) => onChange({ environmentDescription: event.target.value })}
              value={draft.environmentDescription}
            />
          </label>
        ) : null}
      </fieldset>
      <div style={{ color: "#5e5a50", fontSize: "0.8rem" }}>
        Review is committed from Current action.
      </div>
      {validationMessage ? (
        <div role="status" style={{ color: "#8a3b1f", fontSize: "0.82rem" }}>
          {validationMessage}
        </div>
      ) : null}
    </section>
  );
}

export interface CombatTaskResolveControlsProps {
  readonly cancelDisabled?: boolean;
  readonly disabled?: boolean;
  readonly draft: CombatTaskResultDraft;
  readonly interruptAvailable: boolean;
  readonly onCancel: () => void;
  readonly onChange: (change: Partial<CombatTaskResultDraft>) => void;
  readonly onInterrupt: () => void;
  readonly participantOptions: readonly CombatTaskParticipantOption[];
  readonly resolveInputsVisible: boolean;
}

export function CombatTaskResolveControls({
  cancelDisabled = false,
  disabled = false,
  draft,
  interruptAvailable,
  onCancel,
  onChange,
  onInterrupt,
  participantOptions,
  resolveInputsVisible,
}: CombatTaskResolveControlsProps) {
  return (
    <div style={{ display: "grid", gap: "0.4rem", minWidth: 0 }}>
      {resolveInputsVisible ? (
        <>
          <label style={fieldStyle}>
            <span style={labelTextStyle}>Player-safe result</span>
            <textarea
              disabled={disabled}
              maxLength={4000}
              onChange={(event) => onChange({ text: event.target.value })}
              rows={3}
              value={draft.text}
            />
          </label>
          <fieldset aria-label="Who receives this result?" style={{ minWidth: 0 }}>
            <legend style={labelTextStyle}>Who receives this result?</legend>
            {participantOptions.map((entry) => (
              <label key={entry.participantId} style={{ marginRight: "0.75rem" }}>
                <input
                  checked={draft.audience.includes(entry.participantId)}
                  disabled={disabled}
                  onChange={(event) =>
                    onChange({
                      audience: event.target.checked
                        ? [...new Set([...draft.audience, entry.participantId])]
                        : draft.audience.filter((id) => id !== entry.participantId),
                    })
                  }
                  type="checkbox"
                />{" "}
                {entry.label}
              </label>
            ))}
          </fieldset>
        </>
      ) : null}
      <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem" }}>
        {interruptAvailable ? (
          <button disabled={disabled} onClick={onInterrupt} type="button">
            Interrupt Combat Task
          </button>
        ) : null}
        <button disabled={disabled || cancelDisabled} onClick={onCancel} type="button">
          Cancel Combat Task
        </button>
      </div>
    </div>
  );
}
