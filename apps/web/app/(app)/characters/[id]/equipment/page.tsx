"use client";

import { Fragment, use, useEffect, useMemo, useState } from "react";
import {
  type CarryMode,
  type ItemConditionState,
  type LocationAvailabilityClass,
  type MaterialType,
  type QualityType,
  type StorageLocationType
} from "@glantri/domain/equipment";

import {
  getCharacterLocations,
  getInventoryMoveOptions,
  getInventoryRows,
  getItemsGroupedForInventoryPage
} from "../../../../../src/features/equipment/equipmentSelectors";
import type { EquipmentFeatureState } from "../../../../../src/features/equipment/types";
import {
  addCharacterEquipmentItemOnServer,
  bootstrapSampleCharacterEquipmentOnServer,
  createCharacterStorageLocationOnServer,
  loadCharacterEquipmentState,
  moveCharacterEquipmentItemOnServer,
  removeCharacterStorageLocationOnServer,
  removeCharacterEquipmentItemOnServer,
  updateServerCharacter,
  updateCharacterEquipmentMetadataOnServer,
  updateCharacterEquipmentQuantityOnServer
} from "../../../../../src/lib/api/localServiceClient";
import { loadLocalCharacterContext } from "../../../../../src/lib/characters/loadLocalCharacterContext";
import type { LocalCharacterRecord } from "../../../../../src/lib/offline/glantriDexie";
import { LocalCharacterRepository } from "../../../../../src/lib/offline/repositories/localCharacterRepository";
import { UNNAMED_CHARACTER_PLACEHOLDER } from "../../../../../src/lib/offline/repositories/localCharacterRepository";
import { getWorkbookCharacterSize } from "../../../../../src/features/equipment/armorSummary";
import { formatEncumbranceDisplay } from "../../../../../src/features/equipment/displayFormatting";
import {
  buildInventoryTemplateGroups,
  filterInventoryTemplateOptions,
  type InventoryTemplateFilter,
} from "../../../../../src/features/equipment/inventoryTemplateGroups";
import {
  getPlayerFacingEquipmentLocationTemplateOptions,
  getPlayerFacingEquipmentTemplateName,
} from "../../../../../src/features/equipment/playerFacingTemplateOptions";

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
const conditionOptions: ItemConditionState[] = [
  "intact",
  "worn",
  "damaged",
  "broken",
  "lost"
];
const availabilityOptions: Array<{
  label: string;
  value: LocationAvailabilityClass;
}> = [
  { label: "With you", value: "with_you" },
  { label: "Elsewhere", value: "elsewhere" }
];

const templateFilterOptions: Array<{ label: string; value: InventoryTemplateFilter }> = [
  { label: "All", value: "all" },
  { label: "Weapons", value: "weapons" },
  { label: "Missile", value: "missile" },
  { label: "Throwing", value: "throwing" },
  { label: "Armor", value: "armor" },
  { label: "Gear", value: "gear" },
  { label: "Valuables", value: "valuables" },
];

const localCharacterRepository = new LocalCharacterRepository();

export default function CharacterEquipmentPage({ params }: CharacterEquipmentPageProps) {
  const { id } = use(params);
  const [characterRecord, setCharacterRecord] = useState<LocalCharacterRecord | null>(null);
  const [state, setState] = useState<EquipmentFeatureState | null>(null);
  const [characterSize, setCharacterSize] = useState<number | null>(null);
  const [characterName, setCharacterName] = useState(UNNAMED_CHARACTER_PLACEHOLDER);
  const [inventoryNotes, setInventoryNotes] = useState("");
  const [inventoryNotesError, setInventoryNotesError] = useState<string>();
  const [inventoryNotesFeedback, setInventoryNotesFeedback] = useState<string>();
  const [savingInventoryNotes, setSavingInventoryNotes] = useState(false);
  const [loading, setLoading] = useState(true);
  const [pageError, setPageError] = useState<string>();
  const [locationName, setLocationName] = useState("");
  const [locationType, setLocationType] = useState<StorageLocationType>("home");
  const [locationAvailabilityClass, setLocationAvailabilityClass] =
    useState<LocationAvailabilityClass>("elsewhere");
  const [locationError, setLocationError] = useState<string>();
  const [rowErrors, setRowErrors] = useState<Record<string, string>>({});
  const [bootstrapError, setBootstrapError] = useState<string>();
  const [bootstrapping, setBootstrapping] = useState(false);
  const [addItemError, setAddItemError] = useState<string>();
  const [addingItem, setAddingItem] = useState(false);
  const [addTemplateFilter, setAddTemplateFilter] = useState<InventoryTemplateFilter>("all");
  const [addTemplateId, setAddTemplateId] = useState("");
  const [addLocationValue, setAddLocationValue] = useState("");
  const [addQuantity, setAddQuantity] = useState("1");
  const [addMaterial, setAddMaterial] = useState<MaterialType>("steel");
  const [addQuality, setAddQuality] = useState<QualityType>("standard");
  const [addDisplayName, setAddDisplayName] = useState("");
  const [addNotes, setAddNotes] = useState("");
  const [quantityDrafts, setQuantityDrafts] = useState<Record<string, string>>({});
  const [expandedItemIds, setExpandedItemIds] = useState<Record<string, boolean>>({});
  const [metadataDrafts, setMetadataDrafts] = useState<
    Record<
      string,
      {
        conditionState: ItemConditionState;
        displayName: string;
        isFavorite: boolean;
        notes: string;
      }
    >
  >({});
  const rows = useMemo(
    () => (state ? getInventoryRows(state, id, characterSize) : []),
    [state, id, characterSize]
  );
  const locations = useMemo(() => (state ? getCharacterLocations(state, id) : []), [state, id]);
  const groupedSections = useMemo(
    () => (state ? getItemsGroupedForInventoryPage(state, id) : []),
    [state, id]
  );
  const hasVisibleLocationGroups = groupedSections.some((section) => section.groups.length > 0);
  const rowsByItemId = useMemo(
    () => new Map(rows.map((row) => [row.itemId, row])),
    [rows]
  );
  const moveOptions = useMemo(() => (state ? getInventoryMoveOptions(state, id) : []), [state, id]);
  const templateOptions = useMemo(
    () =>
      state
        ? getPlayerFacingEquipmentLocationTemplateOptions(
            state.templates.templatesById,
          )
        : [],
    [state]
  );
  const filteredTemplateOptions = useMemo(
    () => filterInventoryTemplateOptions(templateOptions, addTemplateFilter),
    [addTemplateFilter, templateOptions],
  );
  const templateGroups = useMemo(() => {
    return buildInventoryTemplateGroups(filteredTemplateOptions);
  }, [filteredTemplateOptions]);
  const selectedTemplate =
    addTemplateId && state ? state.templates.templatesById[addTemplateId] ?? null : null;
  const selectedTemplateIsStackable = selectedTemplate?.category === "valuables";

  useEffect(() => {
    let cancelled = false;

    Promise.all([loadCharacterEquipmentState(id), loadLocalCharacterContext(id)])
      .then(([nextState, characterContext]) => {
        if (cancelled) {
          return;
        }

        setState(nextState);
        setCharacterRecord(characterContext.record ?? null);
        setCharacterName(
          characterContext.record?.build.name.trim() || UNNAMED_CHARACTER_PLACEHOLDER
        );
        setInventoryNotes(characterContext.record?.build.inventoryNotes ?? "");
        setCharacterSize(getWorkbookCharacterSize(characterContext.record?.build));
        setPageError(undefined);
      })
      .catch((error) => {
        if (cancelled) {
          return;
        }

        const message = error instanceof Error ? error.message : "Unable to load equipment.";
        setPageError(
          message === "Character not found."
            ? "Character not found or not accessible from this account."
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
    if (filteredTemplateOptions.length === 0) {
      return;
    }

    if (!addTemplateId || !state?.templates.templatesById[addTemplateId]) {
      const firstTemplate = filteredTemplateOptions[0];
      setAddTemplateId(firstTemplate.id);
      setAddMaterial(firstTemplate.defaultMaterial);
      setAddQuality("standard");
      return;
    }

    if (!filteredTemplateOptions.some((template) => template.id === addTemplateId)) {
      const firstTemplate = filteredTemplateOptions[0];
      setAddTemplateId(firstTemplate.id);
      setAddMaterial(firstTemplate.defaultMaterial);
      setAddQuality("standard");
    }
  }, [addTemplateId, filteredTemplateOptions, state]);

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

    setMetadataDrafts(
      Object.fromEntries(
        Object.values(state.itemsById).map((item) => [
          item.id,
          {
            conditionState: item.conditionState,
            displayName: item.displayName ?? "",
            isFavorite: item.isFavorite ?? false,
            notes: item.notes ?? ""
          }
        ])
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
        availabilityClass: locationAvailabilityClass,
        characterId: id,
        name: trimmedName,
        type: locationType
      });
      setState(nextState);
      setLocationName("");
      setLocationAvailabilityClass("elsewhere");
      setLocationError(undefined);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unable to create location.";
      console.warn(message);
      setLocationError(message);
    }
  }

  async function handleRemoveLocation(locationId: string) {
    try {
      const nextState = await removeCharacterStorageLocationOnServer({
        characterId: id,
        locationId
      });
      setState(nextState);
      setLocationError(undefined);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unable to remove location.";
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
        notes: addNotes.trim() || null,
        quality: addQuality,
        quantity,
        templateId: addTemplateId
      });
      setState(nextState);
      setAddDisplayName("");
      setAddNotes("");
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

  async function handleUpdateMetadata(itemId: string) {
    const draft = metadataDrafts[itemId];

    if (!draft) {
      return;
    }

    try {
      const nextState = await updateCharacterEquipmentMetadataOnServer({
        characterId: id,
        conditionState: draft.conditionState,
        displayName: draft.displayName,
        isFavorite: draft.isFavorite,
        itemId,
        notes: draft.notes
      });
      setState(nextState);
      setRowErrors((current) => {
        const next = { ...current };
        delete next[itemId];
        return next;
      });
      setExpandedItemIds((current) => ({
        ...current,
        [itemId]: false
      }));
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to update item details.";
      console.warn(message);
      setRowErrors((current) => ({
        ...current,
        [itemId]: message
      }));
    }
  }

  async function handleSaveInventoryNotes() {
    if (!characterRecord) {
      return;
    }

    setSavingInventoryNotes(true);
    setInventoryNotesError(undefined);
    setInventoryNotesFeedback(undefined);

    try {
      const savedServerRecord = await updateServerCharacter({
        build: {
          ...characterRecord.build,
          inventoryNotes
        },
        characterId: id
      });
      const savedLocalRecord = await localCharacterRepository.save({
        build: savedServerRecord.build,
        creatorDisplayName: characterRecord.creatorDisplayName,
        creatorEmail: characterRecord.creatorEmail,
        creatorId: savedServerRecord.ownerId ?? characterRecord.creatorId,
        createdAt: characterRecord.createdAt,
        finalizedAt: characterRecord.finalizedAt,
        syncStatus: "synced",
        updatedAt: savedServerRecord.updatedAt
      });

      setCharacterRecord(savedLocalRecord);
      setCharacterName(savedLocalRecord.build.name.trim() || UNNAMED_CHARACTER_PLACEHOLDER);
      setInventoryNotes(savedLocalRecord.build.inventoryNotes ?? "");
      setInventoryNotesFeedback("Inventory notes saved.");
    } catch (error) {
      setInventoryNotesError(
        error instanceof Error ? error.message : "Unable to save inventory notes."
      );
    } finally {
      setSavingInventoryNotes(false);
    }
  }

  function toggleExpandedItem(itemId: string) {
    setExpandedItemIds((current) => ({
      ...current,
      [itemId]: !current[itemId]
    }));
  }

  return (
    <section style={{ display: "grid", gap: "1rem", maxWidth: 1080 }}>
      <div style={{ display: "grid", gap: "0.35rem" }}>
        <h1 style={{ margin: 0 }}>Inventory by location - {characterName}</h1>
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
              Create a persisted inventory item from an existing equipment template, including workbook-backed shields.
            </div>
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem" }}>
            {templateFilterOptions.map((option) => (
              <button
                key={option.value}
                onClick={() => setAddTemplateFilter(option.value)}
                style={{
                  background: addTemplateFilter === option.value ? "#efe1c3" : "#fffdf8",
                  border: "1px solid #d9c5a0",
                  borderRadius: 999,
                  color: "#4b3c23",
                  font: "inherit",
                  fontWeight: addTemplateFilter === option.value ? 700 : 500,
                  padding: "0.45rem 0.8rem",
                }}
                type="button"
              >
                {option.label}
              </button>
            ))}
          </div>
          <div
            style={{
              display: "grid",
              gap: "0.75rem",
              gridTemplateColumns: "minmax(180px, 1.2fr) minmax(180px, 1fr) 120px 140px 140px minmax(180px, 1fr)"
            }}
          >
            <label style={{ display: "grid", gap: "0.35rem" }}>
              <span>Template</span>
              <select
                onChange={(event) => setAddTemplateId(event.target.value)}
                value={filteredTemplateOptions.length > 0 ? addTemplateId : ""}
              >
                {templateGroups.length === 0 ? (
                  <option value="">No templates match this filter</option>
                ) : null}
                {templateGroups.map((group) => (
                  <optgroup key={group.category} label={group.label}>
                    {group.templates.map((template) => (
                      <option key={template.id} value={template.id}>
                        {getPlayerFacingEquipmentTemplateName(template)}
                      </option>
                    ))}
                  </optgroup>
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
          </div>
          <div
            style={{
              alignItems: "end",
              display: "grid",
              gap: "0.75rem",
              gridTemplateColumns: "minmax(280px, 1fr) auto",
            }}
          >
            <label style={{ display: "grid", gap: "0.35rem" }}>
              <span>Notes</span>
              <textarea
                onChange={(event) => setAddNotes(event.target.value)}
                placeholder="Optional"
                rows={2}
                value={addNotes}
              />
            </label>
            <button
              disabled={addingItem || filteredTemplateOptions.length === 0}
              onClick={() => void handleAddItem()}
              style={{
                background: "#7e5d2a",
                border: "1px solid transparent",
                borderRadius: 999,
                color: "#fffaf0",
                font: "inherit",
                fontWeight: 700,
                padding: "0.8rem 1.2rem",
              }}
              type="button"
            >
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
            gridTemplateColumns:
              "minmax(220px, 1fr) minmax(180px, 220px) minmax(180px, 220px) auto"
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
            <span>Location group</span>
            <select
              onChange={(event) =>
                setLocationAvailabilityClass(event.target.value as LocationAvailabilityClass)
              }
              value={locationAvailabilityClass}
            >
              {availabilityOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
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

      {!loading && !pageError && hasVisibleLocationGroups ? (
        <div style={{ display: "grid", gap: "1rem" }}>
          <section
            style={{
              background: "#f6f5ef",
              border: "1px solid #d9ddd8",
              borderRadius: 12,
              display: "grid",
              gap: "0.35rem",
              padding: "1rem"
            }}
          >
            <div style={{ color: "#5e5a50", fontSize: "0.95rem" }}>
              Total encumbrance{" "}
              {formatEncumbranceDisplay(
                rows.reduce((total, row) => total + row.actualEncumbrance, 0),
              )}
            </div>
            <div style={{ color: "#5e5a50", fontSize: "0.95rem" }}>
              Carried encumbrance{" "}
              {formatEncumbranceDisplay(
                rows.reduce((total, row) => total + (row.effectiveEncumbrance ?? 0), 0),
              )}
            </div>
          </section>
          {groupedSections.map((section) => {
            const sectionRows = section.groups.flatMap((group) =>
              group.items
                .map((item) => rowsByItemId.get(item.id))
                .filter((row): row is NonNullable<typeof row> => row !== undefined),
            );
            const sectionActualEncumbrance = sectionRows.reduce(
              (total, row) => total + row.actualEncumbrance,
              0,
            );
            const sectionEffectiveEncumbrance = sectionRows.reduce(
              (total, row) => total + (row.effectiveEncumbrance ?? 0),
              0,
            );

            return (
            <section
              key={section.key}
              style={{
                background: "#fbfaf5",
                border: "1px solid #d9ddd8",
                borderRadius: 12,
                display: "grid",
                gap: "1rem",
                padding: "1rem"
              }}
            >
              <div style={{ display: "grid", gap: "0.2rem" }}>
                <h2 style={{ margin: 0 }}>{section.label}</h2>
                <div style={{ color: "#5e5a50", fontSize: "0.9rem" }}>
                  {section.description}
                </div>
                <div style={{ color: "#5e5a50", fontSize: "0.9rem" }}>
                  Total encumbrance {formatEncumbranceDisplay(sectionActualEncumbrance)}
                </div>
                {section.key === "carried" ? (
                  <div style={{ color: "#5e5a50", fontSize: "0.9rem" }}>
                    Carried encumbrance {formatEncumbranceDisplay(sectionEffectiveEncumbrance)}
                  </div>
                ) : null}
              </div>

              {section.groups.map((group) => {
                const groupRows = group.items
                  .map((item) => rowsByItemId.get(item.id))
                  .filter((row): row is NonNullable<typeof row> => row !== undefined);
                const groupActualEncumbrance = groupRows.reduce(
                  (total, row) => total + row.actualEncumbrance,
                  0
                );
                const groupEffectiveEncumbrance = groupRows.reduce(
                  (total, row) => total + (row.effectiveEncumbrance ?? 0),
                  0
                );
                const canDeleteLocation =
                  !group.location.type.endsWith("_system") && groupRows.length === 0;

                return (
                  <section
                    key={group.location.id}
                    style={{
                      background: "#fffdf8",
                      border: "1px solid #d9ddd8",
                      borderRadius: 12,
                      display: "grid",
                      gap: "0.75rem",
                      padding: "1rem"
                    }}
                  >
                    <div
                      style={{
                        alignItems: "start",
                        display: "flex",
                        flexWrap: "wrap",
                        gap: "0.75rem",
                        justifyContent: "space-between"
                      }}
                    >
                      <div style={{ display: "grid", gap: "0.2rem" }}>
                        <strong>{group.location.name}</strong>
                        <div style={{ color: "#5e5a50", fontSize: "0.9rem" }}>
                          {groupRows.length} item{groupRows.length === 1 ? "" : "s"} • Total encumbrance{" "}
                          {formatEncumbranceDisplay(groupActualEncumbrance)}
                        </div>
                        {group.location.type === "equipped_system" ||
                        group.location.type === "person_system" ||
                        group.location.type === "backpack_system" ? (
                          <div style={{ color: "#5e5a50", fontSize: "0.9rem" }}>
                            Carried encumbrance {formatEncumbranceDisplay(groupEffectiveEncumbrance)}
                          </div>
                        ) : null}
                      </div>
                      {canDeleteLocation ? (
                        <button
                          onClick={() => void handleRemoveLocation(group.location.id)}
                          type="button"
                        >
                          Delete location
                        </button>
                      ) : null}
                    </div>

                    {groupRows.length > 0 ? (
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
                              <th style={tableHeaderStyle}>Type</th>
                              <th style={tableHeaderStyle}>Display name</th>
                              <th style={tableHeaderStyle}>Carry mode</th>
                              <th style={tableHeaderStyle}>Material</th>
                              <th style={tableHeaderStyle}>Quality</th>
                              <th style={tableHeaderStyle}>Condition</th>
                              <th style={tableHeaderStyle}>Quantity</th>
                              <th style={tableHeaderStyle}>Encumbrance</th>
                              <th style={tableHeaderStyle}>Carried encumbrance</th>
                              <th style={tableHeaderStyle}>Access tier</th>
                              <th style={tableHeaderStyle}>Actions</th>
                            </tr>
                          </thead>
                          <tbody>
                            {groupRows.map((row) => (
                              <Fragment key={row.itemId}>
                                <tr>
                                  <td style={tableCellStyle}>
                                    <div style={{ display: "grid", gap: "0.2rem" }}>
                                      <strong>{row.templateName}</strong>
                                      <span style={{ color: "#5e5a50", fontSize: "0.8rem" }}>
                                        {formatLabel(row.category)}
                                      </span>
                                    </div>
                                  </td>
                                  <td style={tableCellStyle}>
                                    <div style={{ display: "grid", gap: "0.35rem", minWidth: 180 }}>
                                      <input
                                        onChange={(event) =>
                                          setMetadataDrafts((current) => ({
                                            ...current,
                                            [row.itemId]: {
                                              ...current[row.itemId],
                                              displayName: event.target.value
                                            }
                                          }))
                                        }
                                        placeholder="Optional given name"
                                        type="text"
                                        value={metadataDrafts[row.itemId]?.displayName ?? ""}
                                      />
                                      <div style={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: "0.5rem" }}>
                                        <button
                                          onClick={() => void handleUpdateMetadata(row.itemId)}
                                          type="button"
                                        >
                                          Save name
                                        </button>
                                        {state?.itemsById[row.itemId]?.isFavorite ? (
                                          <span style={{ color: "#5e5a50", fontSize: "0.8rem" }}>
                                            Favorite
                                          </span>
                                        ) : null}
                                      </div>
                                    </div>
                                  </td>
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
                                  <td style={tableCellStyle}>{formatEncumbranceDisplay(row.actualEncumbrance)}</td>
                                  <td style={tableCellStyle}>{formatEncumbranceDisplay(row.effectiveEncumbrance)}</td>
                                  <td style={tableCellStyle}>{formatLabel(row.accessTier)}</td>
                                  <td style={tableCellStyle}>
                                    <div style={{ display: "grid", gap: "0.5rem", maxWidth: 220 }}>
                                      <select
                                        aria-label={`Move ${row.displayName ?? row.templateName}`}
                                        onChange={(event) => void handleMove(row.itemId, event.target.value)}
                                        value={`${state?.itemsById[row.itemId]?.storageAssignment.locationId ?? ""}::${state?.itemsById[row.itemId]?.storageAssignment.carryMode ?? ""}`}
                                      >
                                        {moveOptions.map((option) => (
                                          <option key={option.value} value={option.value}>
                                            {option.label}
                                          </option>
                                        ))}
                                      </select>
                                      <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem" }}>
                                        <button
                                          onClick={() => toggleExpandedItem(row.itemId)}
                                          type="button"
                                        >
                                          {expandedItemIds[row.itemId] ? "Close" : "Edit"}
                                        </button>
                                        <button onClick={() => void handleRemoveItem(row.itemId)} type="button">
                                          Remove item
                                        </button>
                                      </div>
                                      {rowErrors[row.itemId] ? (
                                        <div style={{ color: "#8b3a1a", fontSize: "0.8rem" }}>
                                          {rowErrors[row.itemId]}
                                        </div>
                                      ) : null}
                                    </div>
                                  </td>
                                </tr>
                                {expandedItemIds[row.itemId] ? (
                                  <tr>
                                    <td
                                      colSpan={11}
                                      style={{
                                        ...tableCellStyle,
                                        background: "#f8f4ea"
                                      }}
                                    >
                                      <div
                                        style={{
                                          display: "grid",
                                          gap: "0.75rem",
                                          gridTemplateColumns:
                                            "minmax(160px, 180px) minmax(220px, 1fr) auto"
                                        }}
                                      >
                                        <label style={{ display: "grid", gap: "0.25rem" }}>
                                          <span style={{ fontSize: "0.8rem" }}>Condition</span>
                                          <select
                                            onChange={(event) =>
                                              setMetadataDrafts((current) => ({
                                                ...current,
                                                [row.itemId]: {
                                                  ...current[row.itemId],
                                                  conditionState: event.target.value as ItemConditionState
                                                }
                                              }))
                                            }
                                            value={metadataDrafts[row.itemId]?.conditionState ?? row.conditionState}
                                          >
                                            {conditionOptions.map((condition) => (
                                              <option key={condition} value={condition}>
                                                {formatLabel(condition)}
                                              </option>
                                            ))}
                                          </select>
                                        </label>
                                        <label style={{ display: "grid", gap: "0.25rem" }}>
                                          <span style={{ fontSize: "0.8rem" }}>Notes</span>
                                          <textarea
                                            onChange={(event) =>
                                              setMetadataDrafts((current) => ({
                                                ...current,
                                                [row.itemId]: {
                                                  ...current[row.itemId],
                                                  notes: event.target.value
                                                }
                                              }))
                                            }
                                            rows={3}
                                            value={metadataDrafts[row.itemId]?.notes ?? ""}
                                          />
                                        </label>
                                        <div style={{ display: "grid", alignContent: "start", gap: "0.75rem" }}>
                                          <label
                                            style={{
                                              alignItems: "center",
                                              display: "flex",
                                              gap: "0.5rem",
                                              fontSize: "0.85rem"
                                            }}
                                          >
                                            <input
                                              checked={metadataDrafts[row.itemId]?.isFavorite ?? false}
                                              onChange={(event) =>
                                                setMetadataDrafts((current) => ({
                                                  ...current,
                                                  [row.itemId]: {
                                                    ...current[row.itemId],
                                                    isFavorite: event.target.checked
                                                  }
                                                }))
                                              }
                                              type="checkbox"
                                            />
                                            Favorite
                                          </label>
                                          <button
                                            onClick={() => void handleUpdateMetadata(row.itemId)}
                                            type="button"
                                          >
                                            Save details
                                          </button>
                                        </div>
                                      </div>
                                    </td>
                                  </tr>
                                ) : null}
                              </Fragment>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ) : (
                      <div style={{ color: "#5e5a50", fontSize: "0.9rem" }}>
                        No items in this location.
                      </div>
                    )}
                  </section>
                );
              })}
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

      {!loading && !pageError ? (
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
          <h2 style={{ margin: 0 }}>Inventory notes</h2>
          <textarea
            onChange={(event) => {
              setInventoryNotes(event.target.value);
              setInventoryNotesFeedback(undefined);
            }}
            placeholder="Inventory handling notes, logistics reminders, or storage plans..."
            style={{
              fontFamily: "inherit",
              fontSize: "1rem",
              minHeight: 320,
              overflow: "auto",
              padding: "0.75rem",
              resize: "vertical"
            }}
            value={inventoryNotes}
          />
          <div style={{ display: "flex", flexWrap: "wrap", gap: "0.75rem", alignItems: "center" }}>
            <button disabled={savingInventoryNotes || !characterRecord} onClick={() => void handleSaveInventoryNotes()} type="button">
              {savingInventoryNotes ? "Saving..." : "Save inventory notes"}
            </button>
            {inventoryNotesFeedback ? (
              <span style={{ color: "#5e5a50", fontSize: "0.9rem" }}>{inventoryNotesFeedback}</span>
            ) : null}
            {inventoryNotesError ? (
              <span style={{ color: "#8b3a1a", fontSize: "0.9rem" }}>{inventoryNotesError}</span>
            ) : null}
          </div>
        </section>
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
