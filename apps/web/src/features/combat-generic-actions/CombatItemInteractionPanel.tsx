"use client";

import { useEffect, useMemo, useState } from "react";

import {
  isCombatItemInteractionActionLive,
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
}

export function CombatItemInteractionPanel({
  encounter,
  isGm,
  onEncounterUpdated,
  participantId,
}: CombatItemInteractionPanelProps) {
  const [options, setOptions] = useState<CombatItemInteractionOptions>();
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
   */
  const liveDeclaration: CombatGenericAction | undefined = useMemo(() => {
    if (!participantId) return undefined;
    return (encounter.combatRoundState?.genericActions ?? []).find(
      (action) =>
        action.ownerParticipantId === participantId && isCombatItemInteractionActionLive(action),
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
    void loadCombatItemInteractionOptions(encounter.id)
      .then((next) => {
        if (active) setOptions(next);
      })
      .catch((error) => {
        if (active) {
          setFeedback(
            error instanceof Error ? error.message : "Unable to load Items for this Combat.",
          );
        }
      });
    return () => {
      active = false;
    };
  }, [encounter.id, encounter.updatedAt]);

  async function declare(
    item: CombatItemInteractionOption,
    operation: CombatItemInteractionOperation,
  ) {
    if (!participantId) return;
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
      <div>
        Choose an Item in context. The GM reviews the timing, and an accepted change is saved to
        this Combat and the Character’s current equipment.
      </div>
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
      ) : (
        <div>Loading Items…</div>
      )}
      {feedback ? <div role="status">{feedback}</div> : null}
    </section>
  );
}
