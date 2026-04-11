"use client";

import Link from "next/link";
import { use, useEffect, useMemo, useState } from "react";
import type { EncounterDefensePosture } from "@glantri/domain";
import { getAccessTier, isWithYouLocation, type CarryMode } from "@glantri/domain/equipment";
import { buildCharacterSheetSummary } from "@glantri/rules-engine";
import {
  defaultCombatAllocationState,
  type CombatAllocationState,
  type CombatParrySource,
} from "../../../../../../../packages/rules-engine/src/combat/combatAllocationState";

import { CombatStatePanel } from "../../../../../src/features/equipment/components/CombatStatePanel";
import { buildCombatStatePanelModel } from "../../../../../src/features/equipment/combatStatePanel";
import {
  buildCombatStateCharacterInputs,
} from "../../../../../src/features/equipment/combatStateDerivation";
import {
  getCharacterArmorItems,
  getCharacterShieldItems,
  getCharacterWeaponItems,
  getEquipmentTemplateById,
  getLoadoutEquipment,
} from "../../../../../src/features/equipment/equipmentSelectors";
import type { EquipmentFeatureState } from "../../../../../src/features/equipment/types";
import {
  loadCharacterEquipmentState,
  setCharacterActiveMissileWeaponOnServer,
  setCharacterActivePrimaryWeaponOnServer,
  setCharacterActiveSecondaryWeaponOnServer,
  setCharacterReadyShieldOnServer,
  setCharacterWornArmorOnServer,
} from "../../../../../src/lib/api/localServiceClient";
import { loadLocalCharacterContext } from "../../../../../src/lib/characters/loadLocalCharacterContext";

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

function NumberControl(input: {
  label: string;
  onChange: (value: number) => void;
  value: number;
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
      <input
        onChange={(event) => input.onChange(Number(event.target.value) || 0)}
        type="number"
        value={input.value}
      />
    </label>
  );
}

const defensePostureOptions: Array<{ label: string; value: EncounterDefensePosture }> = [
  { label: "None", value: "none" },
  { label: "Guard", value: "guard" },
  { label: "Parry", value: "parry" },
  { label: "Shield defense", value: "shield" },
  { label: "Full defense", value: "full-defense" },
];

function getParrySourceOptions(loadout: ReturnType<typeof getLoadoutEquipment>): Array<{
  label: string;
  value: CombatParrySource;
}> {
  const options: Array<{ label: string; value: CombatParrySource }> = [
    { label: "None", value: "none" },
    { label: "Unarmed", value: "unarmed" },
  ];

  if ("primary" in loadout && loadout.primary) {
    options.push({ label: "Primary weapon", value: "primary" });
  }

  if ("secondary" in loadout && loadout.secondary) {
    options.push({ label: "Secondary weapon", value: "secondary" });
  }

  if ("shield" in loadout && loadout.shield) {
    options.push({ label: "Shield", value: "shield" });
  }

  return options;
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
    .filter((item) => item.conditionState !== "broken" && item.conditionState !== "lost")
    .map((item) => ({
      id: item.id,
      label: `${getItemName({
        displayName: item.displayName,
        templateId: item.templateId,
        templateName: getEquipmentTemplateById(input.state, item.templateId)?.name,
      })}${getAccessTier(item.storageAssignment.carryMode) === "slow" ? " (Backpack / slow)" : ""}`,
    }))
    .sort((left, right) => left.label.localeCompare(right.label));
}

export default function CharacterLoadoutPage({ params }: CharacterLoadoutPageProps) {
  const { id } = use(params);
  const [state, setState] = useState<EquipmentFeatureState | null>(null);
  const [characterContext, setCharacterContext] = useState<
    Awaited<ReturnType<typeof loadLocalCharacterContext>> | null
  >(null);
  const [loading, setLoading] = useState(true);
  const [pageError, setPageError] = useState<string>();
  const [combatAllocationInputs, setCombatAllocationInputs] = useState<CombatAllocationState>(
    defaultCombatAllocationState
  );
  const [errors, setErrors] = useState<
    Record<"armor" | "primary" | "secondary" | "missile" | "shield", string | undefined>
  >({
    armor: undefined,
    missile: undefined,
    primary: undefined,
    secondary: undefined,
    shield: undefined,
  });

  const characterCombatInputs = useMemo(() => {
    if (!characterContext?.content || !characterContext.record) {
      return undefined;
    }

    return buildCombatStateCharacterInputs(
      buildCharacterSheetSummary({
        build: characterContext.record.build,
        content: characterContext.content,
      }),
    );
  }, [characterContext]);

  const loadout = useMemo(() => (state ? getLoadoutEquipment(state, id) : {}), [state, id]);
  const weaponOptions = useMemo(
    () =>
      state
        ? buildSelectableItemOptions({
            items: getCharacterWeaponItems(state, id).filter((item) => {
              const location = state.locationsById[item.storageAssignment.locationId];
              return location ? isWithYouLocation(location) : false;
            }),
            state,
          })
        : [],
    [state, id]
  );
  const armorOptions = useMemo(
    () =>
      state
        ? buildSelectableItemOptions({
            items: getCharacterArmorItems(state, id).filter((item) => {
              const location = state.locationsById[item.storageAssignment.locationId];
              return location ? isWithYouLocation(location) : false;
            }),
            state,
          })
        : [],
    [state, id]
  );
  const shieldOptions = useMemo(
    () =>
      state
        ? buildSelectableItemOptions({
            items: getCharacterShieldItems(state, id).filter((item) => {
              const location = state.locationsById[item.storageAssignment.locationId];
              return location ? isWithYouLocation(location) : false;
            }),
            state,
          })
        : [],
    [state, id]
  );
  const combatStatePanelModel = useMemo(
    () =>
      state
        ? buildCombatStatePanelModel(state, id, characterCombatInputs, combatAllocationInputs)
        : null,
    [characterCombatInputs, combatAllocationInputs, state, id]
  );
  const parrySourceOptions = useMemo(() => getParrySourceOptions(loadout), [loadout]);

  useEffect(() => {
    let cancelled = false;

    Promise.all([loadCharacterEquipmentState(id), loadLocalCharacterContext(id)])
      .then(([nextState, nextCharacterContext]) => {
        if (cancelled) {
          return;
        }

        setState(nextState);
        setCharacterContext(nextCharacterContext);
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
              ? await setCharacterActivePrimaryWeaponOnServer({
                  characterId: id,
                  itemId: input.itemId,
                })
              : input.kind === "secondary"
                ? await setCharacterActiveSecondaryWeaponOnServer({
                    characterId: id,
                    itemId: input.itemId,
                  })
                : await setCharacterActiveMissileWeaponOnServer({
                    characterId: id,
                    itemId: input.itemId,
                  });

      setState(nextState);
      setErrors((current) => ({
        ...current,
        [input.kind]: undefined,
      }));
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to update loadout.";
      console.warn(message);
      setErrors((current) => ({
        ...current,
        [input.kind]: message,
      }));
    }
  }

  return (
    <section style={{ display: "grid", gap: "1rem", maxWidth: 900 }}>
      <div style={{ display: "grid", gap: "0.35rem" }}>
        <h1 style={{ margin: 0 }}>Equip items</h1>
        <div style={{ color: "#5e5a50" }}>
          Active carry snapshot for character <code>{id}</code>.
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "0.75rem" }}>
          <Link href="/characters">Characters</Link>
          <Link href={`/characters/${id}`}>Character sheet</Link>
          <Link href={`/characters/${id}/equipment`}>Inventory</Link>
          <Link href={`/characters/${id}/advance`}>Advance Character</Link>
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

      {!loading && !pageError ? (
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
        </div>
      ) : null}

      {!loading && !pageError ? (
        <div
          style={{
            display: "grid",
            gap: "0.75rem",
            gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))"
          }}
        >
          <WeaponControl
            label="Defense posture"
            onChange={(value) =>
              setCombatAllocationInputs((current) => ({
                ...current,
                defensePosture: (value ?? "none") as EncounterDefensePosture,
              }))
            }
            options={defensePostureOptions.map((option) => ({
              id: option.value,
              label: option.label,
            }))}
            value={combatAllocationInputs.defensePosture}
          />
          <WeaponControl
            label="Parry source"
            onChange={(value) =>
              setCombatAllocationInputs((current) => ({
                ...current,
                parry: {
                  ...current.parry,
                  source: (value ?? "none") as CombatParrySource,
                },
              }))
            }
            options={parrySourceOptions.map((option) => ({
              id: option.value,
              label: option.label,
            }))}
            value={combatAllocationInputs.parry.source}
          />
          <NumberControl
            label="Parry allocation"
            onChange={(value) =>
              setCombatAllocationInputs((current) => ({
                ...current,
                parry: {
                  ...current.parry,
                  allocatedOb: value,
                },
              }))
            }
            value={combatAllocationInputs.parry.allocatedOb ?? 0}
          />
          <NumberControl
            label="Attack modifier"
            onChange={(value) =>
              setCombatAllocationInputs((current) => ({
                ...current,
                situationalModifiers: {
                  ...current.situationalModifiers,
                  attack: value,
                },
              }))
            }
            value={combatAllocationInputs.situationalModifiers.attack}
          />
          <NumberControl
            label="Defense modifier"
            onChange={(value) =>
              setCombatAllocationInputs((current) => ({
                ...current,
                situationalModifiers: {
                  ...current.situationalModifiers,
                  defense: value,
                },
              }))
            }
            value={combatAllocationInputs.situationalModifiers.defense}
          />
          <NumberControl
            label="Movement modifier"
            onChange={(value) =>
              setCombatAllocationInputs((current) => ({
                ...current,
                situationalModifiers: {
                  ...current.situationalModifiers,
                  movement: value,
                },
              }))
            }
            value={combatAllocationInputs.situationalModifiers.movement}
          />
          <NumberControl
            label="Perception modifier"
            onChange={(value) =>
              setCombatAllocationInputs((current) => ({
                ...current,
                situationalModifiers: {
                  ...current.situationalModifiers,
                  perception: value,
                },
              }))
            }
            value={combatAllocationInputs.situationalModifiers.perception}
          />
        </div>
      ) : null}

      {!loading && !pageError ? (
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
              displayName: "armor" in loadout ? loadout.armor?.displayName : undefined,
              templateId: "armor" in loadout ? loadout.armor?.templateId : undefined,
              templateName:
                state && "armor" in loadout && loadout.armor
                  ? getEquipmentTemplateById(state, loadout.armor.templateId)?.name
                  : undefined,
            })}
          />
          <SummaryCard
            label="Ready shield"
            value={getItemName({
              displayName: "shield" in loadout ? loadout.shield?.displayName : undefined,
              templateId: "shield" in loadout ? loadout.shield?.templateId : undefined,
              templateName:
                state && "shield" in loadout && loadout.shield
                  ? getEquipmentTemplateById(state, loadout.shield.templateId)?.name
                  : undefined,
            })}
          />
          <SummaryCard
            label="Active primary weapon"
            value={getItemName({
              displayName: "primary" in loadout ? loadout.primary?.displayName : undefined,
              templateId: "primary" in loadout ? loadout.primary?.templateId : undefined,
              templateName:
                state && "primary" in loadout && loadout.primary
                  ? getEquipmentTemplateById(state, loadout.primary.templateId)?.name
                  : undefined,
            })}
          />
          <SummaryCard
            label="Active secondary weapon"
            value={getItemName({
              displayName: "secondary" in loadout ? loadout.secondary?.displayName : undefined,
              templateId: "secondary" in loadout ? loadout.secondary?.templateId : undefined,
              templateName:
                state && "secondary" in loadout && loadout.secondary
                  ? getEquipmentTemplateById(state, loadout.secondary.templateId)?.name
                  : undefined,
            })}
          />
          <SummaryCard
            label="Active missile weapon"
            value={getItemName({
              displayName: "missile" in loadout ? loadout.missile?.displayName : undefined,
              templateId: "missile" in loadout ? loadout.missile?.templateId : undefined,
              templateName:
                state && "missile" in loadout && loadout.missile
                  ? getEquipmentTemplateById(state, loadout.missile.templateId)?.name
                  : undefined,
            })}
          />
          <SummaryCard
            label="Personal encumbrance total"
            value={combatStatePanelModel?.capabilityRows.find((row) => row.label === "Personal encumbrance")?.value ?? 0}
          />
          <SummaryCard
            label="Mount encumbrance total"
            value={combatStatePanelModel?.capabilityRows.find((row) => row.label === "Mount encumbrance")?.value ?? 0}
          />
          <SummaryCard
            label="Gear item count"
            value={combatStatePanelModel?.capabilityRows.find((row) => row.label === "Gear item count")?.value ?? 0}
          />
          <SummaryCard
            label="Encounter-accessible gear"
            value={combatStatePanelModel?.capabilityRows.find((row) => row.label === "Encounter-accessible gear")?.value ?? 0}
          />
          <SummaryCard
            label="Valuables item count"
            value={combatStatePanelModel?.capabilityRows.find((row) => row.label === "Valuables item count")?.value ?? 0}
          />
          <SummaryCard
            label="Encounter-accessible valuables"
            value={combatStatePanelModel?.capabilityRows.find((row) => row.label === "Encounter-accessible valuables")?.value ?? 0}
          />
          <SummaryCard
            label="Carried coin quantity"
            value={combatStatePanelModel?.capabilityRows.find((row) => row.label === "Carried coin quantity")?.value ?? 0}
          />
          <SummaryCard
            label="Backpack item count"
            value={combatStatePanelModel?.capabilityRows.find((row) => row.label === "Backpack items")?.value ?? 0}
          />
          <SummaryCard
            label="Stored item count"
            value={combatStatePanelModel?.capabilityRows.find((row) => row.label === "Stored elsewhere")?.value ?? 0}
          />
          <SummaryCard
            label="With-you item count"
            value={combatStatePanelModel?.capabilityRows.find((row) => row.label === "With-you items")?.value ?? 0}
          />
        </div>
      ) : null}

      {!loading && !pageError ? (
        <div style={{ color: "#5e5a50", fontSize: "0.9rem" }}>
          Loadout options are drawn from items currently with you. Choosing a different item swaps
          it into active use and stows the previous one back into the source location when
          possible. Combat posture and situational controls on this page are temporary live inputs
          for derivation only and are not yet persisted.
        </div>
      ) : null}

      {!loading && !pageError && combatStatePanelModel ? (
        <CombatStatePanel model={combatStatePanelModel} />
      ) : null}
    </section>
  );
}
