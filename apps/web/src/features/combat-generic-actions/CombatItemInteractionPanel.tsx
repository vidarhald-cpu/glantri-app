"use client";

import { useEffect, useMemo, useState } from "react";

import {
  isCombatGuardedItemActionLive,
  type CombatGenericAction,
  type CombatGenericActionStatus,
  type CombatItemInteractionOperation,
  type EncounterSession,
} from "@glantri/domain";

import {
  loadCombatItemInteractionOptions,
  updateCombatItemInteractionOnServer,
  type CombatItemInteractionOption,
  type CombatItemInteractionOptions,
} from "@/lib/api/localServiceClient";

const operationLabels: Record<CombatItemInteractionOperation, string> = {
  draw: "Draw / ready",
  drop: "Drop",
  pass: "Pass / give",
  pickup: "Pick up",
  stow: "Stow / unequip",
  use: "Use / interact",
};

/**
 * The canonical status vocabulary an Item action moves through. `completed`, `interrupted` and
 * `cancelled` are terminal; the other three are live. This panel only ever renders what the
 * persisted action says, so a reload restores it.
 */
const declarationStatusLabels: Record<CombatGenericActionStatus, string> = {
  active: "In progress",
  cancelled: "Cancelled",
  completed: "Completed",
  declared: "Waiting for GM review",
  interrupted: "Interrupted",
  reviewed: "Reviewed — waiting to act",
};

const stateLabels: Record<CombatItemInteractionOption["state"], string> = {
  equipped: "Equipped",
  held: "Held · On person",
  present_unheld: "Present · Unheld",
  stowed: "Stowed",
};

function makeActionId(): string {
  return globalThis.crypto?.randomUUID?.() ?? `combat-item-action-${Date.now()}-${Math.random()}`;
}

export interface CombatItemInteractionPanelProps {
  encounter: EncounterSession;
  isGm: boolean;
  onEncounterUpdated: (encounter: EncounterSession) => void;
  participantId?: string;
  /**
   * Forgejo #509 F2 — an independent, additional reason for the panel to be inert: the GM is
   * inspecting a player's Combat surface and must not act as that player. This panel is injected
   * outside the surface's `controlsDisabled`, so it carries the guard itself. It gates both the
   * controls and the server update, and never replaces the canonical one-live-Item-action state.
   */
  readOnly?: boolean;
}

export function CombatItemInteractionPanel({
  encounter,
  isGm,
  onEncounterUpdated,
  participantId,
  readOnly = false,
}: CombatItemInteractionPanelProps) {
  const [options, setOptions] = useState<CombatItemInteractionOptions>();
  /**
   * Forgejo issue #599 — load failure is represented separately from loading.
   *
   * `options` alone cannot tell the two apart: it is only ever assigned on the success path, so
   * the absence of it used to mean both "still loading" and "the request failed", and a failed
   * load presented itself as work still in progress indefinitely. This holds the failure instead,
   * so the panel always reaches a resolved state.
   *
   * Forgejo issue #771 R2-4 — it no longer carries the **server's** message. The server's
   * `ScenarioEquipmentStaleError` text explained persistence and reconciliation to the table,
   * which the Product Owner ruled off the ordinary Combat surface. The failed state is still
   * shown, and still presents as failed rather than as loading; it is now one short line.
   * The underlying cause — that an ordinary Combat raises that error at all — is #773 and is
   * not addressed here.
   */
  const [loadError, setLoadError] = useState<string>();
  const [recipientByItemId, setRecipientByItemId] = useState<Record<string, string>>({});
  const [detailByItemId, setDetailByItemId] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<string>();
  /**
   * The pending Item action, derived from canonical persisted Combat state.
   *
   * Forgejo issue #409: the acknowledgement this replaces was local `useState` and was never
   * rehydrated, so a reload lost the pending state entirely. Reading the persisted
   * `CombatGenericAction` instead makes it survive a reload for free, and makes the panel's
   * disabled buttons a **consequence** of the canonical one-live-Item-action state rather than a
   * guard of their own — the guard is the server's creation-time refusal.
   *
   * It reads the **guarded Item-action family**, the same predicate the server refuses on, so the
   * two can never disagree about what occupies the slot. A Small Action that merely names an Item
   * (the M7 secondary `small_action`, which carries `preset: "item_interaction"` alongside
   * `declarationKind: "small_action"`) is not a member, so it neither labels itself a pending Item
   * action here nor disables the operation buttons.
   */
  const liveDeclaration: CombatGenericAction | undefined = useMemo(() => {
    if (!participantId) return undefined;
    return (encounter.combatRoundState?.genericActions ?? []).find(
      (action) =>
        action.ownerParticipantId === participantId && isCombatGuardedItemActionLive(action),
    );
  }, [encounter.combatRoundState, participantId]);
  const actor = options?.actors.find((candidate) => candidate.participantId === participantId);
  const itemRows = useMemo(
    () => [
      ...(actor?.items ?? []).map((item) => ({ item, source: "held" as const })),
      ...(options?.presentItems ?? []).map((item) => ({ item, source: "present" as const })),
    ],
    [actor?.items, options?.presentItems],
  );

  useEffect(() => {
    let active = true;
    setFeedback(undefined);
    setLoadError(undefined);
    void loadCombatItemInteractionOptions(encounter.id)
      .then((next) => {
        if (active) setOptions(next);
      })
      .catch(() => {
        if (active) setLoadError("Items unavailable.");
      });
    return () => {
      active = false;
    };
  }, [encounter.id, encounter.updatedAt]);

  async function declare(
    item: CombatItemInteractionOption,
    operation: CombatItemInteractionOperation,
  ) {
    // Read-only inspection: the write path itself refuses, not only the buttons.
    if (readOnly || !participantId) return;
    const recipientParticipantId = operation === "pass" ? recipientByItemId[item.id] : undefined;
    if (operation === "pass" && !recipientParticipantId) {
      setFeedback("Choose who receives this Item.");
      return;
    }
    setBusy(true);
    setFeedback(undefined);
    try {
      const next = await updateCombatItemInteractionOnServer({
        actionId: makeActionId(),
        encounterId: encounter.id,
        expectedItemRevision: item.revision,
        expectedRevision: encounter.updatedAt,
        intentDetail: operation === "use" ? detailByItemId[item.id] : undefined,
        itemId: item.id,
        itemOperation: operation,
        operation: "declare",
        participantId,
        recipientParticipantId,
      });
      onEncounterUpdated(next);
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : "Unable to declare the Item action.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section
      aria-labelledby="combat-item-heading"
      style={{
        border: "1px solid #cdd8d0",
        borderRadius: 10,
        display: "grid",
        gap: "0.65rem",
        minWidth: 0,
        padding: "0.75rem",
      }}
    >
      <h3 id="combat-item-heading" style={{ margin: 0 }}>
        Items in this Combat
      </h3>
      {readOnly ? (
        <div role="status">Inspection is read-only: Item actions cannot be declared from here.</div>
      ) : null}
      {actor?.unsupportedReason ? <div role="status">{actor.unsupportedReason}</div> : null}
      {liveDeclaration?.itemInteraction ? (
        <div role="status">
          {`Pending Item action: ${operationLabels[liveDeclaration.itemInteraction.operation]} ${
            liveDeclaration.itemInteraction.itemLabel
          } — ${declarationStatusLabels[liveDeclaration.status]}.`}
          <div>
            The Combat Log carries this declaration. Only one Item action can be live at a time; the
            GM resolves, interrupts or cancels this one before another can be declared.
          </div>
        </div>
      ) : null}
      {itemRows.length > 0 ? (
        <div
          style={{
            display: "grid",
            gap: "0.65rem",
            gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 16rem), 1fr))",
            minWidth: 0,
          }}
        >
          {itemRows.map(({ item }) => (
            <article
              key={item.id}
              style={{
                border: "1px solid #d9ddd8",
                borderRadius: 8,
                display: "grid",
                gap: "0.45rem",
                minWidth: 0,
                overflowWrap: "anywhere",
                padding: "0.65rem",
              }}
            >
              <strong>{item.label}</strong>
              <span>{stateLabels[item.state]}</span>
              {item.operations.includes("pass") ? (
                <label style={{ display: "grid", gap: "0.2rem" }}>
                  <span>Pass {item.label} to</span>
                  <select
                    aria-label={`Pass ${item.label} to`}
                    onChange={(event) =>
                      setRecipientByItemId((current) => ({
                        ...current,
                        [item.id]: event.target.value,
                      }))
                    }
                    value={recipientByItemId[item.id] ?? ""}
                  >
                    <option value="">Choose participant</option>
                    {(options?.recipients ?? [])
                      .filter((recipient) => recipient.participantId !== participantId)
                      .map((recipient) => (
                        <option key={recipient.participantId} value={recipient.participantId}>
                          {recipient.label}
                        </option>
                      ))}
                  </select>
                </label>
              ) : null}
              {item.operations.includes("use") ? (
                <label style={{ display: "grid", gap: "0.2rem" }}>
                  <span>How will you use {item.label}?</span>
                  <input
                    aria-label={`How will you use ${item.label}?`}
                    maxLength={500}
                    onChange={(event) =>
                      setDetailByItemId((current) => ({
                        ...current,
                        [item.id]: event.target.value,
                      }))
                    }
                    value={detailByItemId[item.id] ?? ""}
                  />
                </label>
              ) : null}
              <div style={{ display: "flex", flexWrap: "wrap", gap: "0.4rem" }}>
                {item.operations.map((operation) => (
                  <button
                    aria-label={`${item.label}: ${operationLabels[operation]}`}
                    disabled={
                      busy ||
                      readOnly ||
                      Boolean(liveDeclaration) ||
                      (operation === "pass" && !recipientByItemId[item.id]) ||
                      (operation === "use" && !detailByItemId[item.id]?.trim())
                    }
                    key={operation}
                    onClick={() => void declare(item, operation)}
                    type="button"
                  >
                    {operationLabels[operation]}
                  </button>
                ))}
              </div>
            </article>
          ))}
        </div>
      ) : options ? (
        <div>{isGm ? "No supported Items for this participant." : "No available Items."}</div>
      ) : loadError ? null : (
        <div>Loading Items…</div>
      )}
      {loadError ? <div role="status">{loadError}</div> : null}
      {feedback ? <div role="status">{feedback}</div> : null}
    </section>
  );
}
