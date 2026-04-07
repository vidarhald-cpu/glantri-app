"use client";

import Link from "next/link";
import { use, useEffect, useMemo, useState } from "react";
import {
  getAccessTier,
  isStoredCarryMode,
  type CarryMode
} from "@glantri/domain/equipment";

import {
  getCharacterGearItems,
  getCharacterValuableItems,
  getCharacterArmorItems,
  getBackpackItems,
  getCharacterShieldItems,
  getCharacterWeaponItems,
  getEncounterAccessibleCoinQuantity,
  getEncounterAccessibleGearItems,
  getEncounterAccessibleValuableItems,
  getEquipmentTemplateById,
  getLoadoutEquipment,
  getMountEncumbranceTotal,
  getPersonalEncumbranceTotal,
  getStoredItems
} from "../../../../../src/features/equipment/equipmentSelectors";
import type { EquipmentFeatureState } from "../../../../../src/features/equipment/types";
import {
  loadCharacterEquipmentState,
  setCharacterActiveMissileWeaponOnServer,
  setCharacterActivePrimaryWeaponOnServer,
  setCharacterActiveSecondaryWeaponOnServer,
  setCharacterReadyShieldOnServer,
  setCharacterWornArmorOnServer
} from "../../../../../src/lib/api/localServiceClient";

interface CharacterLoadoutPageProps {
  params: Promise<{
    id: string;
  }>;
}

function getItemName(input: {
  displayName?: string | null;
  templateId?: string;
  templateName?: string;
}): string {
  if (!input.templateId) {
    return "None";
  }

  return input.displayName ?? input.templateName ?? "Unknown item";
}

function SummaryCard(input: { label: string; value: string | number }) {
  return (
    <div
      style={{
        background: "#f6f5ef",
        border: "1px solid #d9ddd8",
        borderRadius: 12,
        display: "grid",
        gap: "0.35rem",
        padding: "1rem"
      }}
    >
      <div style={{ color: "#5e5a50", fontSize: "0.9rem" }}>{input.label}</div>
      <strong>{input.value}</strong>
    </div>
  );
}

function WeaponControl(input: {
  error?: string;
  label: string;
  onChange: (itemId: string | null) => void;
  options: Array<{ id: string; label: string }>;
  value: string;
}) {
  return (
    <label
      style={{
        background: "#f6f5ef",
        border: "1px solid #d9ddd8",
        borderRadius: 12,
        display: "grid",
        gap: "0.35rem",
        padding: "1rem"
      }}
    >
      <span>{input.label}</span>
      <select
        onChange={(event) =>
          input.onChange(event.target.value.length > 0 ? event.target.value : null)
        }
        value={input.value}
      >
        <option value="">None</option>
        {input.options.map((option) => (
          <option key={option.id} value={option.id}>
            {option.label}
          </option>
        ))}
      </select>
      {input.error ? (
        <span style={{ color: "#8b3a1a", fontSize: "0.8rem" }}>{input.error}</span>
      ) : null}
    </label>
  );
}

function buildSelectableItemOptions(input: {
  items: Array<{
    conditionState: string;
    displayName?: string | null;
    id: string;
    storageAssignment: {
      carryMode: CarryMode;
    };
    templateId: string;
  }>;
  state: EquipmentFeatureState;
}) {
  return input.items
    .filter(
      (item) =>
        !isStoredCarryMode(item.storageAssignment.carryMode) &&
        item.conditionState !== "broken" &&
        item.conditionState !== "lost"
    )
    .map((item) => ({
      id: item.id,
      label: `${getItemName({
        displayName: item.displayName,
        templateId: item.templateId,
        templateName: getEquipmentTemplateById(input.state, item.templateId)?.name
      })}${getAccessTier(item.storageAssignment.carryMode) === "slow" ? " (Backpack / slow)" : ""}`
    }))
    .sort((left, right) => left.label.localeCompare(right.label));
}

export default function CharacterLoadoutPage({ params }: CharacterLoadoutPageProps) {
  const { id } = use(params);
  const [state, setState] = useState<EquipmentFeatureState | null>(null);
  const [loading, setLoading] = useState(true);
  const [pageError, setPageError] = useState<string>();
  const [errors, setErrors] = useState<Record<"armor" | "primary" | "secondary" | "missile" | "shield", string | undefined>>({
    armor: undefined,
    missile: undefined,
    primary: undefined,
    secondary: undefined,
    shield: undefined
  });
  const loadout = useMemo(() => (state ? getLoadoutEquipment(state, id) : {}), [state, id]);
  const personalEncumbrance = useMemo(
    () => (state ? getPersonalEncumbranceTotal(state, id) : 0),
    [state, id]
  );
  const mountEncumbrance = useMemo(
    () => (state ? getMountEncumbranceTotal(state, id) : 0),
    [state, id]
  );
  const backpackCount = useMemo(() => (state ? getBackpackItems(state, id).length : 0), [state, id]);
  const gearCount = useMemo(() => (state ? getCharacterGearItems(state, id).length : 0), [state, id]);
  const encounterAccessibleGearCount = useMemo(
    () => (state ? getEncounterAccessibleGearItems(state, id).length : 0),
    [state, id]
  );
  const valuablesCount = useMemo(
    () => (state ? getCharacterValuableItems(state, id).length : 0),
    [state, id]
  );
  const encounterAccessibleValuablesCount = useMemo(
    () => (state ? getEncounterAccessibleValuableItems(state, id).length : 0),
    [state, id]
  );
  const carriedCoinQuantity = useMemo(
    () => (state ? getEncounterAccessibleCoinQuantity(state, id) : 0),
    [state, id]
  );
  const storedCount = useMemo(() => (state ? getStoredItems(state, id).length : 0), [state, id]);
  const weaponOptions = useMemo(
    () => (state ? buildSelectableItemOptions({ items: getCharacterWeaponItems(state, id), state }) : []),
    [state, id]
  );
  const armorOptions = useMemo(
    () => (state ? buildSelectableItemOptions({ items: getCharacterArmorItems(state, id), state }) : []),
    [state, id]
  );
  const shieldOptions = useMemo(
    () => (state ? buildSelectableItemOptions({ items: getCharacterShieldItems(state, id), state }) : []),
    [state, id]
  );

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

        setPageError(error instanceof Error ? error.message : "Unable to load loadout.");
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

  async function applySelection(input: {
    itemId: string | null;
    kind: "armor" | "primary" | "secondary" | "missile" | "shield";
  }) {
    if (!state) {
      return;
    }

    try {
      const nextState =
        input.kind === "armor"
          ? await setCharacterWornArmorOnServer({ characterId: id, itemId: input.itemId })
          : input.kind === "shield"
          ? await setCharacterReadyShieldOnServer({ characterId: id, itemId: input.itemId })
          : input.kind === "primary"
          ? await setCharacterActivePrimaryWeaponOnServer({ characterId: id, itemId: input.itemId })
          : input.kind === "secondary"
            ? await setCharacterActiveSecondaryWeaponOnServer({ characterId: id, itemId: input.itemId })
            : await setCharacterActiveMissileWeaponOnServer({ characterId: id, itemId: input.itemId });

      setState(nextState);
      setErrors((current) => ({
        ...current,
        [input.kind]: undefined
      }));
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to update loadout.";
      console.warn(message);
      setErrors((current) => ({
        ...current,
        [input.kind]: message
      }));
    }
  }

  return (
    <section style={{ display: "grid", gap: "1rem", maxWidth: 900 }}>
      <div style={{ display: "grid", gap: "0.35rem" }}>
        <h1 style={{ margin: 0 }}>Loadout</h1>
        <div style={{ color: "#5e5a50" }}>
          Active carry snapshot for character <code>{id}</code>.
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "0.75rem" }}>
          <Link href={`/characters/${id}`}>Back to character</Link>
          <Link href={`/characters/${id}/equipment`}>Open equipment</Link>
        </div>
      </div>

      {loading ? (
        <div
          style={{
            background: "#f6f5ef",
            border: "1px solid #d9ddd8",
            borderRadius: 12,
            padding: "1rem"
          }}
        >
          Loading loadout...
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

      {!loading && !pageError ? <div
        style={{
          display: "grid",
          gap: "0.75rem",
          gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))"
        }}
      >
        <WeaponControl
          error={errors.armor}
          label="Worn armor"
          onChange={(itemId) => void applySelection({ itemId, kind: "armor" })}
          options={armorOptions}
          value={"armor" in loadout ? loadout.armor?.id ?? "" : ""}
        />
        <WeaponControl
          error={errors.shield}
          label="Ready shield"
          onChange={(itemId) => void applySelection({ itemId, kind: "shield" })}
          options={shieldOptions}
          value={"shield" in loadout ? loadout.shield?.id ?? "" : ""}
        />
        <WeaponControl
          error={errors.primary}
          label="Active primary weapon"
          onChange={(itemId) => void applySelection({ itemId, kind: "primary" })}
          options={weaponOptions}
          value={"primary" in loadout ? loadout.primary?.id ?? "" : ""}
        />
        <WeaponControl
          error={errors.secondary}
          label="Active secondary weapon"
          onChange={(itemId) => void applySelection({ itemId, kind: "secondary" })}
          options={weaponOptions}
          value={"secondary" in loadout ? loadout.secondary?.id ?? "" : ""}
        />
        <WeaponControl
          error={errors.missile}
          label="Active missile weapon"
          onChange={(itemId) => void applySelection({ itemId, kind: "missile" })}
          options={weaponOptions}
          value={"missile" in loadout ? loadout.missile?.id ?? "" : ""}
        />
      </div> : null}

      {!loading && !pageError ? <div
        style={{
          display: "grid",
          gap: "0.75rem",
          gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))"
        }}
      >
        <SummaryCard
          label="Worn armor"
          value={getItemName({
            displayName: "armor" in loadout ? loadout.armor?.displayName : undefined,
            templateId: "armor" in loadout ? loadout.armor?.templateId : undefined,
            templateName: state && "armor" in loadout && loadout.armor
              ? getEquipmentTemplateById(state, loadout.armor.templateId)?.name
              : undefined
          })}
        />
        <SummaryCard
          label="Ready shield"
          value={getItemName({
            displayName: "shield" in loadout ? loadout.shield?.displayName : undefined,
            templateId: "shield" in loadout ? loadout.shield?.templateId : undefined,
            templateName: state && "shield" in loadout && loadout.shield
              ? getEquipmentTemplateById(state, loadout.shield.templateId)?.name
              : undefined
          })}
        />
        <SummaryCard
          label="Active primary weapon"
          value={getItemName({
            displayName: "primary" in loadout ? loadout.primary?.displayName : undefined,
            templateId: "primary" in loadout ? loadout.primary?.templateId : undefined,
            templateName: state && "primary" in loadout && loadout.primary
              ? getEquipmentTemplateById(state, loadout.primary.templateId)?.name
              : undefined
          })}
        />
        <SummaryCard
          label="Active secondary weapon"
          value={getItemName({
            displayName: "secondary" in loadout ? loadout.secondary?.displayName : undefined,
            templateId: "secondary" in loadout ? loadout.secondary?.templateId : undefined,
            templateName: state && "secondary" in loadout && loadout.secondary
              ? getEquipmentTemplateById(state, loadout.secondary.templateId)?.name
              : undefined
          })}
        />
        <SummaryCard
          label="Active missile weapon"
          value={getItemName({
            displayName: "missile" in loadout ? loadout.missile?.displayName : undefined,
            templateId: "missile" in loadout ? loadout.missile?.templateId : undefined,
            templateName: state && "missile" in loadout && loadout.missile
              ? getEquipmentTemplateById(state, loadout.missile.templateId)?.name
              : undefined
          })}
        />
        <SummaryCard label="Personal encumbrance total" value={personalEncumbrance} />
        <SummaryCard label="Mount encumbrance total" value={mountEncumbrance} />
        <SummaryCard label="Gear item count" value={gearCount} />
        <SummaryCard label="Encounter-accessible gear" value={encounterAccessibleGearCount} />
        <SummaryCard label="Valuables item count" value={valuablesCount} />
        <SummaryCard label="Encounter-accessible valuables" value={encounterAccessibleValuablesCount} />
        <SummaryCard label="Carried coin quantity" value={carriedCoinQuantity} />
        <SummaryCard label="Backpack item count" value={backpackCount} />
        <SummaryCard label="Stored item count" value={storedCount} />
      </div> : null}

      {!loading && !pageError ? <div style={{ color: "#5e5a50", fontSize: "0.9rem" }}>
        Selectable armor, shields, and weapons exclude stored, broken, and lost items. Backpack
        items remain selectable for this slice and are marked as slower access when listed.
      </div> : null}
    </section>
  );
}
