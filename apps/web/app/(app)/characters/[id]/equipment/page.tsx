"use client";

import Link from "next/link";
import { use, useEffect, useMemo, useState } from "react";
import { type StorageLocationType } from "@glantri/domain/equipment";

import {
  getCharacterLocations,
  getInventoryMoveOptions,
  getInventoryRows,
  getItemsGroupedByLocation
} from "../../../../../src/features/equipment/equipmentSelectors";
import type { EquipmentFeatureState } from "../../../../../src/features/equipment/types";
import {
  createCharacterStorageLocationOnServer,
  loadCharacterEquipmentState,
  moveCharacterEquipmentItemOnServer
} from "../../../../../src/lib/api/localServiceClient";

interface CharacterEquipmentPageProps {
  params: Promise<{
    id: string;
  }>;
}

function formatLabel(value: string): string {
  return value
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export default function CharacterEquipmentPage({ params }: CharacterEquipmentPageProps) {
  const { id } = use(params);
  const [state, setState] = useState<EquipmentFeatureState | null>(null);
  const [loading, setLoading] = useState(true);
  const [pageError, setPageError] = useState<string>();
  const [locationName, setLocationName] = useState("");
  const [locationType, setLocationType] = useState<StorageLocationType>("home");
  const [locationError, setLocationError] = useState<string>();
  const [rowErrors, setRowErrors] = useState<Record<string, string>>({});
  const rows = useMemo(() => (state ? getInventoryRows(state, id) : []), [state, id]);
  const locations = useMemo(() => (state ? getCharacterLocations(state, id) : []), [state, id]);
  const groupedItems = useMemo(() => (state ? getItemsGroupedByLocation(state, id) : []), [state, id]);
  const rowsByItemId = useMemo(
    () => new Map(rows.map((row) => [row.itemId, row])),
    [rows]
  );
  const moveOptions = useMemo(() => (state ? getInventoryMoveOptions(state, id) : []), [state, id]);

  useEffect(() => {
    let cancelled = false;

    loadCharacterEquipmentState(id)
      .then((nextState) => {
        if (cancelled) {
          return;
        }

        setState(nextState);
        setPageError(undefined);
      })
      .catch((error) => {
        if (cancelled) {
          return;
        }

        setPageError(error instanceof Error ? error.message : "Unable to load equipment.");
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [id]);

  async function handleMove(itemId: string, value: string) {
    if (!state) {
      return;
    }

    const item = state.itemsById[itemId];
    if (!item) {
      return;
    }

    const [locationId, carryMode] = value.split("::");

    try {
      const nextState = await moveCharacterEquipmentItemOnServer({
        carryMode: carryMode as typeof item.storageAssignment.carryMode,
        characterId: id,
        itemId,
        locationId
      });
      setState(nextState);
      setRowErrors((current) => {
        const next = { ...current };
        delete next[itemId];
        return next;
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to move item.";
      console.warn(message);
      setRowErrors((current) => ({
        ...current,
        [itemId]: message
      }));
    }
  }

  async function handleCreateLocation() {
    const trimmedName = locationName.trim();

    if (trimmedName.length === 0) {
      setLocationError("Location name is required.");
      return;
    }

    if (
      locations.some((location) => location.name.toLowerCase() === trimmedName.toLowerCase())
    ) {
      setLocationError("A location with that name already exists.");
      return;
    }

    try {
      const nextState = await createCharacterStorageLocationOnServer({
        characterId: id,
        name: trimmedName,
        type: locationType
      });
      setState(nextState);
      setLocationName("");
      setLocationError(undefined);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unable to create location.";
      console.warn(message);
      setLocationError(message);
    }
  }

  return (
    <section style={{ display: "grid", gap: "1rem", maxWidth: 1080 }}>
      <div style={{ display: "grid", gap: "0.35rem" }}>
        <h1 style={{ margin: 0 }}>Equipment</h1>
        <div style={{ color: "#5e5a50" }}>
          Inventory snapshot for character <code>{id}</code>.
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "0.75rem" }}>
          <Link href={`/characters/${id}`}>Back to character</Link>
          <Link href={`/characters/${id}/loadout`}>Open loadout</Link>
        </div>
      </div>

      <section
        style={{
          background: "#f6f5ef",
          border: "1px solid #d9ddd8",
          borderRadius: 12,
          display: "grid",
          gap: "0.75rem",
          padding: "1rem"
        }}
      >
        <div style={{ display: "grid", gap: "0.2rem" }}>
          <strong>Add storage location</strong>
          <div style={{ color: "#5e5a50", fontSize: "0.9rem" }}>
            New locations become available in the move controls immediately.
          </div>
        </div>
        <div
          style={{
            alignItems: "end",
            display: "grid",
            gap: "0.75rem",
            gridTemplateColumns: "minmax(220px, 1fr) minmax(180px, 220px) auto"
          }}
        >
          <label style={{ display: "grid", gap: "0.35rem" }}>
            <span>Location name</span>
            <input
              onChange={(event) => setLocationName(event.target.value)}
              placeholder="For example: Town house"
              type="text"
              value={locationName}
            />
          </label>
          <label style={{ display: "grid", gap: "0.35rem" }}>
            <span>Location type</span>
            <select
              onChange={(event) => setLocationType(event.target.value as StorageLocationType)}
              value={locationType}
            >
              <option value="home">Home</option>
              <option value="camp">Camp</option>
              <option value="boat">Boat</option>
              <option value="wagon">Wagon</option>
              <option value="cache">Cache</option>
              <option value="building">Building</option>
              <option value="other">Other</option>
            </select>
          </label>
          <button onClick={handleCreateLocation} type="button">
            Add location
          </button>
        </div>
        {locationError ? (
          <div style={{ color: "#8b3a1a", fontSize: "0.85rem" }}>{locationError}</div>
        ) : null}
      </section>

      {loading ? (
        <div
          style={{
            background: "#f6f5ef",
            border: "1px solid #d9ddd8",
            borderRadius: 12,
            padding: "1rem"
          }}
        >
          Loading equipment...
        </div>
      ) : null}

      {pageError ? (
        <div
          style={{
            background: "#fdf0ea",
            border: "1px solid #e4b9a7",
            borderRadius: 12,
            color: "#8b3a1a",
            padding: "1rem"
          }}
        >
          {pageError}
        </div>
      ) : null}

      {!loading && !pageError && rows.length > 0 ? (
        <div style={{ display: "grid", gap: "1rem" }}>
          {groupedItems.map((group) => {
            const groupRows = group.items
              .map((item) => rowsByItemId.get(item.id))
              .filter((row): row is NonNullable<typeof row> => row !== undefined);
            const groupEncumbrance = groupRows.reduce(
              (total, row) => total + row.effectiveEncumbrance,
              0
            );

            return (
              <section
                key={group.location.id}
                style={{
                  background: "#fbfaf5",
                  border: "1px solid #d9ddd8",
                  borderRadius: 12,
                  display: "grid",
                  gap: "0.75rem",
                  padding: "1rem"
                }}
              >
                <div style={{ display: "grid", gap: "0.2rem" }}>
                  <strong>{group.location.name}</strong>
                  <div style={{ color: "#5e5a50", fontSize: "0.9rem" }}>
                    {groupRows.length} item{groupRows.length === 1 ? "" : "s"} • Total encumbrance{" "}
                    {groupEncumbrance}
                  </div>
                </div>

                <div
                  style={{
                    border: "1px solid #d9ddd8",
                    borderRadius: 10,
                    overflowX: "auto"
                  }}
                >
                  <table style={{ borderCollapse: "collapse", minWidth: 980, width: "100%" }}>
                    <thead style={{ background: "#f6f5ef" }}>
                      <tr>
                        <th style={tableHeaderStyle}>Item</th>
                        <th style={tableHeaderStyle}>Carry mode</th>
                        <th style={tableHeaderStyle}>Material</th>
                        <th style={tableHeaderStyle}>Quality</th>
                        <th style={tableHeaderStyle}>Condition</th>
                        <th style={tableHeaderStyle}>Effective encumbrance</th>
                        <th style={tableHeaderStyle}>Access tier</th>
                        <th style={tableHeaderStyle}>Move</th>
                      </tr>
                    </thead>
                    <tbody>
                      {groupRows.map((row) => (
                        <tr key={row.itemId}>
                          <td style={tableCellStyle}>{row.displayName}</td>
                          <td style={tableCellStyle}>{formatLabel(row.carryMode)}</td>
                          <td style={tableCellStyle}>{formatLabel(row.material)}</td>
                          <td style={tableCellStyle}>{formatLabel(row.quality)}</td>
                          <td style={tableCellStyle}>{formatLabel(row.conditionState)}</td>
                          <td style={tableCellStyle}>{row.effectiveEncumbrance}</td>
                          <td style={tableCellStyle}>{formatLabel(row.accessTier)}</td>
                          <td style={tableCellStyle}>
                            <div style={{ display: "grid", gap: "0.35rem" }}>
                              <select
                                aria-label={`Move ${row.displayName}`}
                                onChange={(event) => void handleMove(row.itemId, event.target.value)}
                                value={`${state?.itemsById[row.itemId]?.storageAssignment.locationId ?? ""}::${state?.itemsById[row.itemId]?.storageAssignment.carryMode ?? ""}`}
                              >
                                {moveOptions.map((option) => (
                                  <option key={option.value} value={option.value}>
                                    {option.label}
                                  </option>
                                ))}
                              </select>
                              {rowErrors[row.itemId] ? (
                                <div style={{ color: "#8b3a1a", fontSize: "0.8rem" }}>
                                  {rowErrors[row.itemId]}
                                </div>
                              ) : null}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            );
          })}
        </div>
      ) : !loading && !pageError ? (
        <div
          style={{
            background: "#f6f5ef",
            border: "1px solid #d9ddd8",
            borderRadius: 12,
            padding: "1rem"
          }}
        >
          No equipment is currently available for this character.
        </div>
      ) : null}
    </section>
  );
}

const tableHeaderStyle = {
  borderBottom: "1px solid #d9ddd8",
  fontSize: "0.85rem",
  padding: "0.75rem 1rem",
  textAlign: "left" as const
};

const tableCellStyle = {
  borderTop: "1px solid #ece8da",
  padding: "0.75rem 1rem",
  verticalAlign: "top" as const
};
