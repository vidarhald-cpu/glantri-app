"use client";

import { useEffect, useState } from "react";

import type { EncounterSession } from "@glantri/domain";

import {
  loadEncounterItems,
  updateEncounterOnServer,
  type EncounterItemsProjection,
} from "@/lib/api/localServiceClient";

export interface EncounterItemsPanelProps {
  encounter: EncounterSession;
  isGm: boolean;
  onEncounterUpdated?: (encounter: EncounterSession) => void;
  persistEncounter?: (encounter: EncounterSession, message: string) => Promise<EncounterSession>;
}

export function EncounterItemsPanel({
  encounter,
  isGm,
  onEncounterUpdated,
  persistEncounter,
}: EncounterItemsPanelProps) {
  const [projection, setProjection] = useState<EncounterItemsProjection>({
    availableItems: [],
    items: [],
  });
  const [selectedItemId, setSelectedItemId] = useState("");
  const [visibility, setVisibility] = useState<"players" | "gm_only">("players");
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<string>();

  async function refresh() {
    const next = await loadEncounterItems(encounter.id);
    setProjection(next);
    setSelectedItemId((current) =>
      next.availableItems.some((item) => item.itemId === current)
        ? current
        : (next.availableItems[0]?.itemId ?? ""),
    );
  }

  useEffect(() => {
    void refresh().catch(() => setFeedback("Unable to load Encounter Items."));
  }, [encounter.id, encounter.updatedAt]);

  async function save(
    itemReferences: NonNullable<EncounterSession["itemReferences"]>,
    message: string,
  ) {
    setBusy(true);
    setFeedback(undefined);
    try {
      const session = { ...encounter, itemReferences, itemReferencesVersion: 1 as const };
      const nextEncounter = persistEncounter
        ? await persistEncounter(session, message)
        : await updateEncounterOnServer({
            encounterId: encounter.id,
            expectedRevision: encounter.updatedAt,
            session,
          });
      onEncounterUpdated?.(nextEncounter);
      await refresh();
      setFeedback(message);
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : "Unable to update Encounter Items.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section
      aria-labelledby={`encounter-items-${encounter.id}`}
      style={{
        background: "#f6f5ef",
        border: "1px solid #d9ddd8",
        borderRadius: 12,
        display: "grid",
        gap: "0.65rem",
        padding: "1rem",
      }}
    >
      <h2 id={`encounter-items-${encounter.id}`} style={{ margin: 0 }}>
        Encounter Items
      </h2>
      {projection.items.length === 0 ? (
        <div>No Items are present in this Encounter.</div>
      ) : (
        <ul style={{ margin: 0, paddingLeft: "1.25rem" }}>
          {projection.items.map((item) => (
            <li key={item.itemId}>
              {item.label}
              {isGm ? ` — ${item.visibility === "players" ? "visible to players" : "GM only"}` : ""}
              {isGm ? (
                <>
                  <button
                    disabled={busy}
                    onClick={() =>
                      void save(
                        projection.items.map((reference) => ({
                          itemId: reference.itemId,
                          visibility:
                            reference.itemId === item.itemId
                              ? reference.visibility === "players"
                                ? "gm_only"
                                : "players"
                              : reference.visibility,
                        })),
                        `${item.label} visibility updated.`,
                      )
                    }
                    style={{ marginLeft: "0.5rem" }}
                    type="button"
                  >
                    {item.visibility === "players" ? "Make GM only" : "Show to players"}
                  </button>
                  <button
                    disabled={busy}
                    onClick={() =>
                      void save(
                        projection.items
                          .filter((reference) => reference.itemId !== item.itemId)
                          .map(({ itemId, visibility: currentVisibility }) => ({
                            itemId,
                            visibility: currentVisibility,
                          })),
                        `${item.label} is no longer associated with this Encounter.`,
                      )
                    }
                    style={{ marginLeft: "0.5rem" }}
                    type="button"
                  >
                    Remove
                  </button>
                </>
              ) : null}
            </li>
          ))}
        </ul>
      )}

      {isGm && projection.availableItems.length > 0 ? (
        <div style={{ alignItems: "end", display: "flex", flexWrap: "wrap", gap: "0.5rem" }}>
          <label style={{ display: "grid", gap: "0.2rem" }}>
            <span>Scenario Item</span>
            <select
              value={selectedItemId}
              onChange={(event) => setSelectedItemId(event.target.value)}
            >
              {projection.availableItems.map((item) => (
                <option key={item.itemId} value={item.itemId}>
                  {item.label}
                </option>
              ))}
            </select>
          </label>
          <label style={{ display: "grid", gap: "0.2rem" }}>
            <span>Visibility</span>
            <select
              value={visibility}
              onChange={(event) =>
                setVisibility(event.target.value === "gm_only" ? "gm_only" : "players")
              }
            >
              <option value="players">Players</option>
              <option value="gm_only">GM only</option>
            </select>
          </label>
          <button
            disabled={busy || !selectedItemId}
            onClick={() =>
              void save(
                [
                  ...projection.items
                    .filter((reference) => reference.itemId !== selectedItemId)
                    .map(({ itemId, visibility: currentVisibility }) => ({
                      itemId,
                      visibility: currentVisibility,
                    })),
                  { itemId: selectedItemId, visibility },
                ],
                "Item associated with this Encounter.",
              )
            }
            type="button"
          >
            Add to Encounter
          </button>
        </div>
      ) : null}
      {feedback ? <div role="status">{feedback}</div> : null}
    </section>
  );
}
