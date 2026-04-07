"use client";

import Link from "next/link";
import { use, useMemo, useState } from "react";
import { validateEquipmentItem } from "@glantri/domain/equipment";

import {
  getCharacterLocations,
  getInventoryRows,
  getItemsGroupedByLocation
} from "../../../../../src/features/equipment/equipmentSelectors";
import { moveItem } from "../../../../../src/features/equipment/equipmentActions";
import { equipmentInitialState } from "../../../../../src/features/equipment/equipmentStore";
import type { EquipmentFeatureState } from "../../../../../src/features/equipment/types";

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

function getMoveTarget(input: { locationId: string; type: string }) {
  switch (input.type) {
    case "equipped_system":
      return { carryMode: "equipped" as const, label: "Equipped", locationId: input.locationId };
    case "person_system":
      return { carryMode: "on_person" as const, label: "On person", locationId: input.locationId };
    case "backpack_system":
      return { carryMode: "backpack" as const, label: "Backpack", locationId: input.locationId };
    case "mount_system":
      return { carryMode: "mount" as const, label: "Mount", locationId: input.locationId };
    default:
      return { carryMode: "stored" as const, label: null, locationId: input.locationId };
  }
}

function getLocationSortOrder(type: string): number {
  switch (type) {
    case "equipped_system":
      return 0;
    case "person_system":
      return 1;
    case "backpack_system":
      return 2;
    case "mount_system":
      return 3;
    default:
      return 4;
  }
}

export default function CharacterEquipmentPage({ params }: CharacterEquipmentPageProps) {
  const { id } = use(params);
  const [state, setState] = useState<EquipmentFeatureState>(equipmentInitialState);
  const [rowErrors, setRowErrors] = useState<Record<string, string>>({});
  const rows = getInventoryRows(state, id);
  const locations = getCharacterLocations(state, id);
  const groupedItems = useMemo(
    () =>
      getItemsGroupedByLocation(state, id).sort((left, right) => {
        const orderDifference =
          getLocationSortOrder(left.location.type) - getLocationSortOrder(right.location.type);

        if (orderDifference !== 0) {
          return orderDifference;
        }

        return left.location.name.localeCompare(right.location.name);
      }),
    [state, id]
  );
  const rowsByItemId = useMemo(
    () => new Map(rows.map((row) => [row.itemId, row])),
    [rows]
  );
  const moveOptions = useMemo(
    () =>
      locations
        .map((location) => {
          const target = getMoveTarget({ locationId: location.id, type: location.type });
          return {
            carryMode: target.carryMode,
            label: target.label ?? location.name,
            locationId: location.id,
            value: `${location.id}::${target.carryMode}`
          };
        })
        .sort((left, right) => left.label.localeCompare(right.label)),
    [locations]
  );

  function handleMove(itemId: string, value: string) {
    const item = state.itemsById[itemId];
    if (!item) {
      return;
    }

    const [locationId, carryMode] = value.split("::");

    try {
      const nextState = moveItem(state, itemId, locationId, carryMode as typeof item.carryMode);
      const nextItem = nextState.itemsById[itemId];
      const validationErrors = validateEquipmentItem(nextItem);

      if (validationErrors.length > 0) {
        console.warn(`Unable to move item ${itemId}: ${validationErrors.join("; ")}`);
        setRowErrors((current) => ({
          ...current,
          [itemId]: validationErrors[0]
        }));
        return;
      }

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

      {rows.length > 0 ? (
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
                                onChange={(event) => handleMove(row.itemId, event.target.value)}
                                value={`${state.itemsById[row.itemId]?.locationId ?? ""}::${state.itemsById[row.itemId]?.carryMode ?? ""}`}
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
      ) : (
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
      )}
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
