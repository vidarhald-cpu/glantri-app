"use client";

import Link from "next/link";
import { use, useMemo, useState } from "react";

import {
  getBackpackItems,
  getCharacterWeaponItems,
  getLoadoutWeapons,
  getMountEncumbranceTotal,
  getPersonalEncumbranceTotal,
  getStoredItems
} from "../../../../../src/features/equipment/equipmentSelectors";
import {
  setActiveMissileWeapon,
  setActivePrimaryWeapon,
  setActiveSecondaryWeapon
} from "../../../../../src/features/equipment/equipmentActions";
import { equipmentInitialState } from "../../../../../src/features/equipment/equipmentStore";
import type { EquipmentFeatureState } from "../../../../../src/features/equipment/types";

interface CharacterLoadoutPageProps {
  params: Promise<{
    id: string;
  }>;
}

function getItemName(input: { displayName?: string | null; templateId?: string }): string {
  if (!input.templateId) {
    return "None";
  }

  const template = equipmentInitialState.templates.weaponsById[input.templateId];
  return input.displayName ?? template?.name ?? "Unknown item";
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

export default function CharacterLoadoutPage({ params }: CharacterLoadoutPageProps) {
  const { id } = use(params);
  const [state, setState] = useState<EquipmentFeatureState>(equipmentInitialState);
  const [errors, setErrors] = useState<Record<"primary" | "secondary" | "missile", string | undefined>>({
    missile: undefined,
    primary: undefined,
    secondary: undefined
  });
  const weapons = getLoadoutWeapons(state, id);
  const personalEncumbrance = getPersonalEncumbranceTotal(state, id);
  const mountEncumbrance = getMountEncumbranceTotal(state, id);
  const backpackCount = getBackpackItems(state, id).length;
  const storedCount = getStoredItems(state, id).length;
  const weaponOptions = useMemo(
    () =>
      getCharacterWeaponItems(state, id)
        .filter(
          (item) =>
            item.carryMode !== "stored" &&
            item.conditionState !== "broken" &&
            item.conditionState !== "lost"
        )
        .map((item) => ({
          id: item.id,
          label: `${getItemName(item)}${item.carryMode === "backpack" ? " (Backpack / slow)" : ""}`
        }))
        .sort((left, right) => left.label.localeCompare(right.label)),
    [state, id]
  );

  function applySelection(input: {
    itemId: string | null;
    kind: "primary" | "secondary" | "missile";
  }) {
    try {
      const nextState =
        input.kind === "primary"
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
          error={errors.primary}
          label="Active primary weapon"
          onChange={(itemId) => applySelection({ itemId, kind: "primary" })}
          options={weaponOptions}
          value={weapons.primary?.id ?? ""}
        />
        <WeaponControl
          error={errors.secondary}
          label="Active secondary weapon"
          onChange={(itemId) => applySelection({ itemId, kind: "secondary" })}
          options={weaponOptions}
          value={weapons.secondary?.id ?? ""}
        />
        <WeaponControl
          error={errors.missile}
          label="Active missile weapon"
          onChange={(itemId) => applySelection({ itemId, kind: "missile" })}
          options={weaponOptions}
          value={weapons.missile?.id ?? ""}
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
          label="Active primary weapon"
          value={getItemName(weapons.primary ?? {})}
        />
        <SummaryCard
          label="Active secondary weapon"
          value={getItemName(weapons.secondary ?? {})}
        />
        <SummaryCard
          label="Active missile weapon"
          value={getItemName(weapons.missile ?? {})}
        />
        <SummaryCard label="Personal encumbrance total" value={personalEncumbrance} />
        <SummaryCard label="Mount encumbrance total" value={mountEncumbrance} />
        <SummaryCard label="Backpack item count" value={backpackCount} />
        <SummaryCard label="Stored item count" value={storedCount} />
      </div>

      <div style={{ color: "#5e5a50", fontSize: "0.9rem" }}>
        Selectable weapons exclude stored, broken, and lost items. Backpack weapons remain
        selectable for this slice and are marked as slower access when listed.
      </div>
    </section>
  );
}
