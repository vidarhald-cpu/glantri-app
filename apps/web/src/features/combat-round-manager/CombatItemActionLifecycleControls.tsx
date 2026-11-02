"use client";

import {
  isCombatItemInteractionActionLive,
  type CombatGenericAction,
  type CombatGenericActionDuration,
} from "@glantri/domain";

/**
 * The GM half of the canonical Item action lifecycle, for the Combat Inspector — Forgejo issue
 * #356, completing M7's client side (Combat Panel Contract §12.14).
 *
 * The Combat declaration surface that used to sit beside this one in the Action Selector was
 * removed for Alpha by Forgejo issue #834, so no Combat Inspector or player control declares an
 * Item action any more; the canonical Item interaction route remains the authority and is
 * unchanged. This file carries the GM's `review` / `activate` / `resolve` commands and their
 * inputs for an Item action that already exists, the
 * §12.4 row "Lifecycle commands … Current action", split exactly as the settled M5 and M6 rulings
 * require (§12.17): the review **fields** are inputs only, and the resolve command's player-safe
 * result text and audience are resolve-command inputs.
 *
 * This component is presentational. Every command, `actionId` and encounter revision stays with
 * `CombatRoundManagerPanel`, which reads them from the projected canonical round state rather than
 * from any draft. No new domain type, route or client function is introduced: the existing
 * `updateCombatItemInteractionOnServer` already accepts each of these operations.
 */

/** The canonical Item action operations the GM issues. Since #834 no surface offers `declare`. */
export type CombatItemActionGmOperation =
  | "review"
  | "activate"
  | "resolve"
  | "interrupt"
  | "cancel";

export interface CombatItemActionReviewDraft {
  readonly durationKind: CombatGenericActionDuration["kind"];
  readonly durationPhase: "phase1" | "phase2";
  readonly rounds: string;
}

export interface CombatItemActionResultDraft {
  readonly audience: readonly string[];
  readonly text: string;
}

export interface CombatItemActionParticipantOption {
  readonly label: string;
  readonly participantId: string;
}

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

const statusLabels: Record<CombatGenericAction["status"], string> = {
  active: "Active",
  cancelled: "Cancelled",
  completed: "Completed",
  declared: "Waiting for GM review",
  interrupted: "Interrupted",
  reviewed: "Reviewed",
};

/**
 * An Item action the GM can still act on. Finished actions belong to the Combat Log.
 *
 * The liveness rule itself is canonical and lives in the domain, so this surface and the
 * server-side one-live-Item-action refusal cannot drift apart.
 */
export function isOpenCombatItemAction(action: CombatGenericAction): boolean {
  return isCombatItemInteractionActionLive(action);
}

/** Seeds the review duration field from the Item action's own current duration. */
export function buildCombatItemActionReviewDraftFromAction(
  action: CombatGenericAction,
): CombatItemActionReviewDraft {
  return {
    durationKind: action.duration.kind,
    durationPhase: action.duration.kind === "phase" ? action.duration.phase : "phase1",
    rounds: String(action.duration.kind === "rounds" ? action.duration.rounds : 2),
  };
}

/** Builds the duration the review command carries from the GM's chosen fields. */
export function buildCombatItemActionReviewDuration(
  draft: CombatItemActionReviewDraft,
): CombatGenericActionDuration {
  if (draft.durationKind === "phase") return { kind: "phase", phase: draft.durationPhase };
  if (draft.durationKind === "rounds") {
    const rounds = Number.parseInt(draft.rounds, 10);
    return { kind: "rounds", rounds: Number.isFinite(rounds) ? Math.max(2, rounds) : 2 };
  }
  return { kind: draft.durationKind };
}

/**
 * The review fields' own validation. An incomplete fieldset disables the review command rather
 * than sending a duration the domain would reject.
 */
export function getCombatItemActionReviewValidationMessage(
  draft: CombatItemActionReviewDraft,
): string | undefined {
  if (draft.durationKind === "rounds") {
    const rounds = Number.parseInt(draft.rounds, 10);
    if (!Number.isFinite(rounds) || rounds < 2) return "Enter at least 2 reviewed rounds.";
  }
  return undefined;
}

/**
 * The resolve command's input validation. The route refuses an empty result or audience with a
 * 400; this keeps that request from being sent at all.
 */
export function getCombatItemActionResolveValidationMessage(
  draft: CombatItemActionResultDraft,
): string | undefined {
  if (!draft.text.trim()) return "Enter the player-safe result before resolving this Item action.";
  if (draft.audience.length === 0) return "Choose who receives this result.";
  return undefined;
}

/**
 * The canonical GM command available for an Item action at its current status. `declared` must be
 * reviewed first, exactly as the old panel's handler required, so no later command is reachable
 * without it.
 */
export function getCombatItemActionPrimaryOperation(
  action: CombatGenericAction,
): "review" | "activate" | "resolve" | undefined {
  if (action.status === "declared") return "review";
  if (action.status === "reviewed") return "activate";
  if (action.status === "active") return "resolve";
  return undefined;
}

const primaryOperationLabels: Record<"review" | "activate" | "resolve", string> = {
  activate: "Start Item action",
  resolve: "Resolve Item action",
  review: "Review Item action",
};

export interface CombatItemActionLifecycleControlsProps {
  readonly actions: readonly CombatGenericAction[];
  readonly disabled?: boolean;
  readonly onCancel: () => void;
  readonly onInterrupt: () => void;
  readonly onPrimary: () => void;
  readonly onResultChange: (change: Partial<CombatItemActionResultDraft>) => void;
  readonly onReviewChange: (change: Partial<CombatItemActionReviewDraft>) => void;
  readonly onSelectAction: (actionId: string) => void;
  readonly participantOptions: readonly CombatItemActionParticipantOption[];
  readonly resultDraft: CombatItemActionResultDraft;
  readonly reviewDraft: CombatItemActionReviewDraft;
  readonly selectedAction: CombatGenericAction;
  readonly validationMessage?: string;
}

export function CombatItemActionLifecycleControls({
  actions,
  disabled = false,
  onCancel,
  onInterrupt,
  onPrimary,
  onResultChange,
  onReviewChange,
  onSelectAction,
  participantOptions,
  resultDraft,
  reviewDraft,
  selectedAction,
  validationMessage,
}: CombatItemActionLifecycleControlsProps) {
  const primaryOperation = getCombatItemActionPrimaryOperation(selectedAction);
  return (
    <section aria-label="Canonical Item action" style={panelCardStyle}>
      <strong>Current action · Item action</strong>
      {actions.length > 1 ? (
        <label style={fieldStyle}>
          <span style={labelTextStyle}>Item action</span>
          <select
            disabled={disabled}
            onChange={(event) => onSelectAction(event.target.value)}
            value={selectedAction.id}
          >
            {actions.map((action) => (
              <option key={action.id} value={action.id}>
                {statusLabels[action.status]} — {action.intent}
              </option>
            ))}
          </select>
        </label>
      ) : null}
      <div style={{ color: "#5e5a50", fontSize: "0.85rem" }}>
        {selectedAction.itemInteraction?.itemLabel ?? "Item"} — {selectedAction.intent}
      </div>
      <div style={{ color: "#5e5a50", fontSize: "0.82rem" }}>
        {statusLabels[selectedAction.status]}
      </div>
      {primaryOperation === "review" ? (
        <fieldset aria-label="Item action review fields" style={{ display: "grid", gap: "0.5rem" }}>
          <legend style={labelTextStyle}>GM review adjustments</legend>
          <label style={fieldStyle}>
            <span style={labelTextStyle}>Reviewed duration</span>
            <select
              disabled={disabled}
              onChange={(event) =>
                onReviewChange({
                  durationKind: event.target.value as CombatGenericActionDuration["kind"],
                })
              }
              value={reviewDraft.durationKind}
            >
              <option value="phase">One phase</option>
              <option value="round">One round</option>
              <option value="rounds">Several rounds</option>
              <option value="gm_decided">GM decides</option>
            </select>
          </label>
          {reviewDraft.durationKind === "phase" ? (
            <label style={fieldStyle}>
              <span style={labelTextStyle}>Reviewed phase</span>
              <select
                disabled={disabled}
                onChange={(event) =>
                  onReviewChange({ durationPhase: event.target.value as "phase1" | "phase2" })
                }
                value={reviewDraft.durationPhase}
              >
                <option value="phase1">Phase 1</option>
                <option value="phase2">Phase 2</option>
              </select>
            </label>
          ) : null}
          {reviewDraft.durationKind === "rounds" ? (
            <label style={fieldStyle}>
              <span style={labelTextStyle}>Reviewed rounds</span>
              <input
                disabled={disabled}
                inputMode="numeric"
                min={2}
                onChange={(event) => onReviewChange({ rounds: event.target.value })}
                type="number"
                value={reviewDraft.rounds}
              />
            </label>
          ) : null}
        </fieldset>
      ) : null}
      {primaryOperation === "resolve" ? (
        <>
          <label style={fieldStyle}>
            <span style={labelTextStyle}>Player-safe result</span>
            <textarea
              disabled={disabled}
              maxLength={4000}
              onChange={(event) => onResultChange({ text: event.target.value })}
              rows={3}
              value={resultDraft.text}
            />
          </label>
          <fieldset aria-label="Who receives this Item result?" style={{ minWidth: 0 }}>
            <legend style={labelTextStyle}>Who receives this result?</legend>
            {participantOptions.map((entry) => (
              <label key={entry.participantId} style={{ marginRight: "0.75rem" }}>
                <input
                  checked={resultDraft.audience.includes(entry.participantId)}
                  disabled={disabled}
                  onChange={(event) =>
                    onResultChange({
                      audience: event.target.checked
                        ? [...new Set([...resultDraft.audience, entry.participantId])]
                        : resultDraft.audience.filter((id) => id !== entry.participantId),
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
        {primaryOperation ? (
          <button
            disabled={disabled || Boolean(validationMessage)}
            onClick={onPrimary}
            type="button"
          >
            {primaryOperationLabels[primaryOperation]}
          </button>
        ) : null}
        <button disabled={disabled} onClick={onInterrupt} type="button">
          Interrupt Item action
        </button>
        <button disabled={disabled} onClick={onCancel} type="button">
          Cancel Item action
        </button>
      </div>
      {validationMessage ? (
        <div role="status" style={{ color: "#8a3b1f", fontSize: "0.82rem" }}>
          {validationMessage}
        </div>
      ) : null}
    </section>
  );
}
