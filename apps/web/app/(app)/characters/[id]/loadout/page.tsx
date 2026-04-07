"use client";

import Link from "next/link";
import { use, useMemo, useState } from "react";
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
import {
  setActiveMissileWeapon,
  setActivePrimaryWeapon,
  setActiveSecondaryWeapon,
  setReadyShield,
  setWornArmor
} from "../../../../../src/features/equipment/equipmentActions";
import { equipmentInitialState } from "../../../../../src/features/equipment/equipmentStore";
import type { EquipmentFeatureState } from "../../../../../src/features/equipment/types";

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
  const [state, setState] = useState<EquipmentFeatureState>(equipmentInitialState);
  const [errors, setErrors] = useState<Record<"armor" | "primary" | "secondary" | "missile" | "shield", string | undefined>>({
    armor: undefined,
    missile: undefined,
    primary: undefined,
    secondary: undefined,
    shield: undefined
  });
  const loadout = getLoadoutEquipment(state, id);
  const personalEncumbrance = getPersonalEncumbranceTotal(state, id);
  const mountEncumbrance = getMountEncumbranceTotal(state, id);
  const backpackCount = getBackpackItems(state, id).length;
  const gearCount = getCharacterGearItems(state, id).length;
  const encounterAccessibleGearCount = getEncounterAccessibleGearItems(state, id).length;
  const valuablesCount = getCharacterValuableItems(state, id).length;
  const encounterAccessibleValuablesCount = getEncounterAccessibleValuableItems(state, id).length;
  const carriedCoinQuantity = getEncounterAccessibleCoinQuantity(state, id);
  const storedCount = getStoredItems(state, id).length;
  const weaponOptions = useMemo(
    () => buildSelectableItemOptions({ items: getCharacterWeaponItems(state, id), state }),
    [state, id]
  );
  const armorOptions = useMemo(
    () => buildSelectableItemOptions({ items: getCharacterArmorItems(state, id), state }),
    [state, id]
  );
  const shieldOptions = useMemo(
    () => buildSelectableItemOptions({ items: getCharacterShieldItems(state, id), state }),
    [state, id]
  );

  function applySelection(input: {
    itemId: string | null;
    kind: "armor" | "primary" | "secondary" | "missile" | "shield";
  }) {
    try {
      const nextState =
        input.kind === "armor"
          ? setWornArmor(state, id, input.itemId)
          : input.kind === "shield"
          ? setReadyShield(state, id, input.itemId)
          : input.kind === "primary"
          ? setActivePrimaryWeapon(state, id, input.itemId)
          : input.kind === "secondary"
            ? setActiveSecondaryWeapon(state, id, input.itemId)
            : setActiveMissileWeapon(state, id, input.itemId);

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

      <div
        style={{
          display: "grid",
          gap: "0.75rem",
          gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))"
        }}
      >
        <WeaponControl
          error={errors.armor}
          label="Worn armor"
          onChange={(itemId) => applySelection({ itemId, kind: "armor" })}
          options={armorOptions}
          value={loadout.armor?.id ?? ""}
        />
        <WeaponControl
          error={errors.shield}
          label="Ready shield"
          onChange={(itemId) => applySelection({ itemId, kind: "shield" })}
          options={shieldOptions}
          value={loadout.shield?.id ?? ""}
        />
        <WeaponControl
          error={errors.primary}
          label="Active primary weapon"
          onChange={(itemId) => applySelection({ itemId, kind: "primary" })}
          options={weaponOptions}
          value={loadout.primary?.id ?? ""}
        />
        <WeaponControl
          error={errors.secondary}
          label="Active secondary weapon"
          onChange={(itemId) => applySelection({ itemId, kind: "secondary" })}
          options={weaponOptions}
          value={loadout.secondary?.id ?? ""}
        />
        <WeaponControl
          error={errors.missile}
          label="Active missile weapon"
          onChange={(itemId) => applySelection({ itemId, kind: "missile" })}
          options={weaponOptions}
          value={loadout.missile?.id ?? ""}
        />
      </div>

      <div
        style={{
          display: "grid",
          gap: "0.75rem",
          gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))"
        }}
      >
        <SummaryCard
          label="Worn armor"
          value={getItemName({
            displayName: loadout.armor?.displayName,
            templateId: loadout.armor?.templateId,
            templateName: loadout.armor
              ? getEquipmentTemplateById(state, loadout.armor.templateId)?.name
              : undefined
          })}
        />
        <SummaryCard
          label="Ready shield"
          value={getItemName({
            displayName: loadout.shield?.displayName,
            templateId: loadout.shield?.templateId,
            templateName: loadout.shield
              ? getEquipmentTemplateById(state, loadout.shield.templateId)?.name
              : undefined
          })}
        />
        <SummaryCard
          label="Active primary weapon"
          value={getItemName({
            displayName: loadout.primary?.displayName,
            templateId: loadout.primary?.templateId,
            templateName: loadout.primary
              ? getEquipmentTemplateById(state, loadout.primary.templateId)?.name
              : undefined
          })}
        />
        <SummaryCard
          label="Active secondary weapon"
          value={getItemName({
            displayName: loadout.secondary?.displayName,
            templateId: loadout.secondary?.templateId,
            templateName: loadout.secondary
              ? getEquipmentTemplateById(state, loadout.secondary.templateId)?.name
              : undefined
          })}
        />
        <SummaryCard
          label="Active missile weapon"
          value={getItemName({
            displayName: loadout.missile?.displayName,
            templateId: loadout.missile?.templateId,
            templateName: loadout.missile
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
      </div>

      <div style={{ color: "#5e5a50", fontSize: "0.9rem" }}>
        Selectable armor, shields, and weapons exclude stored, broken, and lost items. Backpack
        items remain selectable for this slice and are marked as slower access when listed.
      </div>
    </section>
  );
}
