"use client";

import Link from "next/link";
import { use, useEffect, useMemo, useState } from "react";
import {
  type CarryMode,
  type MaterialType,
  type QualityType,
  type StorageLocationType
} from "@glantri/domain/equipment";

import {
  getCharacterLocations,
  getInventoryMoveOptions,
  getInventoryRows,
  getItemsGroupedByLocation
} from "../../../../../src/features/equipment/equipmentSelectors";
import type { EquipmentFeatureState } from "../../../../../src/features/equipment/types";
import {
  addCharacterEquipmentItemOnServer,
  bootstrapSampleCharacterEquipmentOnServer,
  createCharacterStorageLocationOnServer,
  loadCharacterEquipmentState,
  moveCharacterEquipmentItemOnServer,
  removeCharacterEquipmentItemOnServer,
  updateCharacterEquipmentQuantityOnServer
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

const materialOptions: MaterialType[] = [
  "steel",
  "bronze",
  "wood",
  "leather",
  "cloth",
  "bone",
  "stone",
  "silver",
  "gold",
  "other"
];

const qualityOptions: QualityType[] = ["standard", "extraordinary"];

export default function CharacterEquipmentPage({ params }: CharacterEquipmentPageProps) {
  const { id } = use(params);
  const [state, setState] = useState<EquipmentFeatureState | null>(null);
  const [loading, setLoading] = useState(true);
  const [pageError, setPageError] = useState<string>();
  const [locationName, setLocationName] = useState("");
  const [locationType, setLocationType] = useState<StorageLocationType>("home");
  const [locationError, setLocationError] = useState<string>();
  const [rowErrors, setRowErrors] = useState<Record<string, string>>({});
  const [bootstrapError, setBootstrapError] = useState<string>();
  const [bootstrapping, setBootstrapping] = useState(false);
  const [addItemError, setAddItemError] = useState<string>();
  const [addingItem, setAddingItem] = useState(false);
  const [addTemplateId, setAddTemplateId] = useState("");
  const [addLocationValue, setAddLocationValue] = useState("");
  const [addQuantity, setAddQuantity] = useState("1");
  const [addMaterial, setAddMaterial] = useState<MaterialType>("steel");
  const [addQuality, setAddQuality] = useState<QualityType>("standard");
  const [addDisplayName, setAddDisplayName] = useState("");
  const [quantityDrafts, setQuantityDrafts] = useState<Record<string, string>>({});
  const rows = useMemo(() => (state ? getInventoryRows(state, id) : []), [state, id]);
  const locations = useMemo(() => (state ? getCharacterLocations(state, id) : []), [state, id]);
  const groupedItems = useMemo(() => (state ? getItemsGroupedByLocation(state, id) : []), [state, id]);
  const rowsByItemId = useMemo(
    () => new Map(rows.map((row) => [row.itemId, row])),
    [rows]
  );
  const moveOptions = useMemo(() => (state ? getInventoryMoveOptions(state, id) : []), [state, id]);
  const templateOptions = useMemo(
    () =>
      state
        ? Object.values(state.templates.templatesById).sort((left, right) =>
            left.name.localeCompare(right.name)
          )
        : [],
    [state]
  );
  const selectedTemplate =
    addTemplateId && state ? state.templates.templatesById[addTemplateId] ?? null : null;
  const selectedTemplateIsStackable = selectedTemplate?.category === "valuables";

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

        const message = error instanceof Error ? error.message : "Unable to load equipment.";
        setPageError(
          message === "Character not found."
            ? "Character not found. This equipment page only works for characters that have been saved to the server."
            : message
        );
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

  useEffect(() => {
    if (templateOptions.length === 0) {
      return;
    }

    if (!addTemplateId || !state?.templates.templatesById[addTemplateId]) {
      const firstTemplate = templateOptions[0];
      setAddTemplateId(firstTemplate.id);
      setAddMaterial(firstTemplate.defaultMaterial);
      setAddQuality("standard");
    }
  }, [addTemplateId, state, templateOptions]);

  useEffect(() => {
    if (moveOptions.length === 0) {
      return;
    }

    if (!addLocationValue || !moveOptions.some((option) => option.value === addLocationValue)) {
      setAddLocationValue(moveOptions[0].value);
    }
  }, [addLocationValue, moveOptions]);

  useEffect(() => {
    if (!selectedTemplate) {
      return;
    }

    setAddMaterial(selectedTemplate.defaultMaterial);
    setAddQuantity((current) => (selectedTemplate.category === "valuables" ? current : "1"));
  }, [selectedTemplate?.id]);

  useEffect(() => {
    if (!state) {
      return;
    }

    setQuantityDrafts(
      Object.fromEntries(
        Object.values(state.itemsById)
          .filter((item) => item.isStackable)
          .map((item) => [item.id, String(item.quantity)])
      )
    );
  }, [state]);

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

  async function handleBootstrapSampleEquipment() {
    setBootstrapping(true);
    setBootstrapError(undefined);

    try {
      const nextState = await bootstrapSampleCharacterEquipmentOnServer({
        characterId: id
      });
      setState(nextState);
      setRowErrors({});
      setLocationError(undefined);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unable to bootstrap sample equipment.";
      console.warn(message);
      setBootstrapError(message);
    } finally {
      setBootstrapping(false);
    }
  }

  async function handleAddItem() {
    if (!state) {
      return;
    }

    if (!addTemplateId) {
      setAddItemError("Choose an item template.");
      return;
    }

    if (!addLocationValue) {
      setAddItemError("Choose an initial location.");
      return;
    }

    const quantity = Number(addQuantity);
    if (!Number.isFinite(quantity) || quantity <= 0) {
      setAddItemError("Quantity must be greater than zero.");
      return;
    }

    if (!selectedTemplateIsStackable && quantity !== 1) {
      setAddItemError("Only stackable items can have quantity greater than one.");
      return;
    }

    const [initialLocationId, initialCarryMode] = addLocationValue.split("::");

    setAddingItem(true);
    setAddItemError(undefined);

    try {
      const nextState = await addCharacterEquipmentItemOnServer({
        characterId: id,
        displayName: addDisplayName.trim() || null,
        initialCarryMode: initialCarryMode as CarryMode,
        initialLocationId,
        material: addMaterial,
        quality: addQuality,
        quantity,
        templateId: addTemplateId
      });
      setState(nextState);
      setAddDisplayName("");
      setAddQuantity(selectedTemplateIsStackable ? "1" : "1");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to add item.";
      console.warn(message);
      setAddItemError(message);
    } finally {
      setAddingItem(false);
    }
  }

  async function handleRemoveItem(itemId: string) {
    try {
      const nextState = await removeCharacterEquipmentItemOnServer({
        characterId: id,
        itemId
      });
      setState(nextState);
      setRowErrors((current) => {
        const next = { ...current };
        delete next[itemId];
        return next;
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to remove item.";
      console.warn(message);
      setRowErrors((current) => ({
        ...current,
        [itemId]: message
      }));
    }
  }

  async function handleUpdateQuantity(itemId: string) {
    const quantity = Number(quantityDrafts[itemId]);

    if (!Number.isFinite(quantity) || quantity <= 0) {
      setRowErrors((current) => ({
        ...current,
        [itemId]: "Quantity must be greater than zero."
      }));
      return;
    }

    try {
      const nextState = await updateCharacterEquipmentQuantityOnServer({
        characterId: id,
        itemId,
        quantity
      });
      setState(nextState);
      setRowErrors((current) => {
        const next = { ...current };
        delete next[itemId];
        return next;
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to update quantity.";
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

      {!loading && !pageError && state ? (
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
            <strong>Add item</strong>
            <div style={{ color: "#5e5a50", fontSize: "0.9rem" }}>
              Create a persisted inventory item from an existing equipment template.
            </div>
          </div>
          <div
            style={{
              alignItems: "end",
              display: "grid",
              gap: "0.75rem",
              gridTemplateColumns: "minmax(180px, 1.2fr) minmax(180px, 1fr) 120px 140px 140px minmax(180px, 1fr) auto"
            }}
          >
            <label style={{ display: "grid", gap: "0.35rem" }}>
              <span>Template</span>
              <select
                onChange={(event) => setAddTemplateId(event.target.value)}
                value={addTemplateId}
              >
                {templateOptions.map((template) => (
                  <option key={template.id} value={template.id}>
                    {template.name}
                  </option>
                ))}
              </select>
            </label>
            <label style={{ display: "grid", gap: "0.35rem" }}>
              <span>Initial location</span>
              <select
                onChange={(event) => setAddLocationValue(event.target.value)}
                value={addLocationValue}
              >
                {moveOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            <label style={{ display: "grid", gap: "0.35rem" }}>
              <span>Quantity</span>
              <input
                min={1}
                onChange={(event) => setAddQuantity(event.target.value)}
                step={1}
                type="number"
                value={addQuantity}
              />
            </label>
            <label style={{ display: "grid", gap: "0.35rem" }}>
              <span>Material</span>
              <select
                onChange={(event) => setAddMaterial(event.target.value as MaterialType)}
                value={addMaterial}
              >
                {materialOptions.map((material) => (
                  <option key={material} value={material}>
                    {formatLabel(material)}
                  </option>
                ))}
              </select>
            </label>
            <label style={{ display: "grid", gap: "0.35rem" }}>
              <span>Quality</span>
              <select
                onChange={(event) => setAddQuality(event.target.value as QualityType)}
                value={addQuality}
              >
                {qualityOptions.map((quality) => (
                  <option key={quality} value={quality}>
                    {formatLabel(quality)}
                  </option>
                ))}
              </select>
            </label>
            <label style={{ display: "grid", gap: "0.35rem" }}>
              <span>Display name</span>
              <input
                onChange={(event) => setAddDisplayName(event.target.value)}
                placeholder="Optional"
                type="text"
                value={addDisplayName}
              />
            </label>
            <button disabled={addingItem} onClick={() => void handleAddItem()} type="button">
              {addingItem ? "Adding..." : "Add item"}
            </button>
          </div>
          <div style={{ color: "#5e5a50", fontSize: "0.85rem" }}>
            {selectedTemplateIsStackable
              ? "This template supports stack quantities."
              : "Non-stackable templates must stay at quantity 1."}
          </div>
          {addItemError ? (
            <div style={{ color: "#8b3a1a", fontSize: "0.85rem" }}>{addItemError}</div>
          ) : null}
        </section>
      ) : null}

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
                        <th style={tableHeaderStyle}>Quantity</th>
                        <th style={tableHeaderStyle}>Effective encumbrance</th>
                        <th style={tableHeaderStyle}>Access tier</th>
                        <th style={tableHeaderStyle}>Actions</th>
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
                          <td style={tableCellStyle}>
                            {state?.itemsById[row.itemId]?.isStackable ? (
                              <div style={{ display: "grid", gap: "0.35rem", maxWidth: 120 }}>
                                <input
                                  min={1}
                                  onChange={(event) =>
                                    setQuantityDrafts((current) => ({
                                      ...current,
                                      [row.itemId]: event.target.value
                                    }))
                                  }
                                  step={1}
                                  type="number"
                                  value={quantityDrafts[row.itemId] ?? String(state?.itemsById[row.itemId]?.quantity ?? 1)}
                                />
                                <button
                                  onClick={() => void handleUpdateQuantity(row.itemId)}
                                  type="button"
                                >
                                  Save qty
                                </button>
                              </div>
                            ) : (
                              state?.itemsById[row.itemId]?.quantity ?? 1
                            )}
                          </td>
                          <td style={tableCellStyle}>{row.effectiveEncumbrance}</td>
                          <td style={tableCellStyle}>{formatLabel(row.accessTier)}</td>
                          <td style={tableCellStyle}>
                            <div style={{ display: "grid", gap: "0.5rem", maxWidth: 180 }}>
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
                              <button onClick={() => void handleRemoveItem(row.itemId)} type="button">
                                Remove item
                              </button>
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
            display: "grid",
            gap: "0.75rem",
            padding: "1rem"
          }}
        >
          <div style={{ display: "grid", gap: "0.25rem" }}>
            <strong>No equipment is currently available for this character.</strong>
            <div style={{ color: "#5e5a50" }}>
              For development and testing, you can explicitly import the sample equipment set.
            </div>
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "0.75rem" }}>
            <button
              disabled={bootstrapping}
              onClick={() => void handleBootstrapSampleEquipment()}
              type="button"
            >
              {bootstrapping ? "Importing sample equipment..." : "Import sample equipment"}
            </button>
          </div>
          {bootstrapError ? (
            <div style={{ color: "#8b3a1a", fontSize: "0.9rem" }}>{bootstrapError}</div>
          ) : null}
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
