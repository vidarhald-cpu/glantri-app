"use client";

import { use, useEffect, useMemo, useState, type ReactNode } from "react";
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

function getCharacterName(name: string | undefined): string {
  return name?.trim() || "Unnamed character";
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

function ControlSection(input: {
  children: ReactNode;
  title: string;
}) {
  return (
    <section
      style={{
        background: "#fbfaf5",
        border: "1px solid #d9ddd8",
        borderRadius: 12,
        display: "grid",
        gap: "0.9rem",
        padding: "1rem"
      }}
    >
      <h2 style={{ margin: 0 }}>{input.title}</h2>
      {input.children}
    </section>
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

function ParryAllocationControl(input: {
  allocationValue: number;
  label: string;
  onAllocationChange: (value: number) => void;
  onSourceChange: (value: string | null) => void;
  options: Array<{ id: string; label: string }>;
  sourceValue: string;
}) {
  return (
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
      <div>{input.label}</div>
      <label style={{ display: "grid", gap: "0.35rem" }}>
        <span style={{ color: "#5e5a50", fontSize: "0.9rem" }}>Source</span>
        <select
          onChange={(event) =>
            input.onSourceChange(event.target.value.length > 0 ? event.target.value : null)
          }
          value={input.sourceValue}
        >
          {input.options.map((option) => (
            <option key={option.id} value={option.id}>
              {option.label}
            </option>
          ))}
        </select>
      </label>
      <label style={{ display: "grid", gap: "0.35rem" }}>
        <span style={{ color: "#5e5a50", fontSize: "0.9rem" }}>Allocated OB</span>
        <input
          onChange={(event) => input.onAllocationChange(Number(event.target.value) || 0)}
          type="number"
          value={input.allocationValue}
        />
      </label>
    </div>
  );
}

const defensePostureOptions: Array<{ label: string; value: EncounterDefensePosture }> = [
  { label: "None", value: "none" },
  { label: "Guard", value: "guard" },
  { label: "Parry", value: "parry" },
  { label: "Shield defense", value: "shield" },
  { label: "Full defense", value: "full-defense" },
];

const combatActionOptions = [
  { label: "None", value: "none" },
  { label: "Attack", value: "attack" },
  { label: "Move", value: "move" },
  { label: "Hold", value: "hold" },
] as const;

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
  const [combatAction, setCombatAction] = useState<(typeof combatActionOptions)[number]["value"]>("none");
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

  const characterName = getCharacterName(characterContext?.record?.build.name);

  return (
    <section style={{ display: "grid", gap: "1rem", maxWidth: 900 }}>
      <div style={{ display: "grid", gap: "0.35rem" }}>
        <h1 style={{ margin: 0 }}>Equip items - {characterName}</h1>
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
        <ControlSection title="Equipment choices">
          <div
            style={{
              display: "grid",
              gap: "0.75rem",
              gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))"
            }}
          >
            <WeaponControl
              error={errors.primary}
              label="Primary weapon"
              onChange={(itemId) => void applySelection({ itemId, kind: "primary" })}
              options={weaponOptions}
              value={"primary" in loadout ? loadout.primary?.id ?? "" : ""}
            />
            <WeaponControl
              error={errors.shield}
              label="Shield"
              onChange={(itemId) => void applySelection({ itemId, kind: "shield" })}
              options={shieldOptions}
              value={"shield" in loadout ? loadout.shield?.id ?? "" : ""}
            />
            <WeaponControl
              error={errors.armor}
              label="Armor"
              onChange={(itemId) => void applySelection({ itemId, kind: "armor" })}
              options={armorOptions}
              value={"armor" in loadout ? loadout.armor?.id ?? "" : ""}
            />
            <WeaponControl
              error={errors.secondary}
              label="Second hand weapon"
              onChange={(itemId) => void applySelection({ itemId, kind: "secondary" })}
              options={weaponOptions}
              value={"secondary" in loadout ? loadout.secondary?.id ?? "" : ""}
            />
            <WeaponControl
              error={errors.missile}
              label="Missile weapon"
              onChange={(itemId) => void applySelection({ itemId, kind: "missile" })}
              options={weaponOptions}
              value={"missile" in loadout ? loadout.missile?.id ?? "" : ""}
            />
          </div>
        </ControlSection>
      ) : null}

      {!loading && !pageError ? (
        <ControlSection title="Combat actions">
          <div
            style={{
              display: "grid",
              gap: "0.75rem",
              gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))"
            }}
          >
            <WeaponControl
              label="Defence posture"
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
            <ParryAllocationControl
              allocationValue={combatAllocationInputs.parry.allocatedOb ?? 0}
              label="Parry allocation"
              onAllocationChange={(value) =>
                setCombatAllocationInputs((current) => ({
                  ...current,
                  parry: {
                    ...current.parry,
                    allocatedOb: value,
                  },
                }))
              }
              onSourceChange={(value) =>
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
              sourceValue={combatAllocationInputs.parry.source}
            />
            <WeaponControl
              label="Combat action"
              onChange={(value) => setCombatAction((value ?? "none") as (typeof combatActionOptions)[number]["value"])}
              options={combatActionOptions.map((option) => ({
                id: option.value,
                label: option.label,
              }))}
              value={combatAction}
            />
          </div>
        </ControlSection>
      ) : null}

      {!loading && !pageError ? (
        <div style={{ color: "#5e5a50", fontSize: "0.9rem" }}>
          Loadout options are drawn from items currently with you. Choosing a different item swaps
          it into active use and stows the previous one back into the source location when
          possible. Combat posture and parry inputs on this page are temporary live inputs for
          derivation only and are not yet persisted. Combat action is currently a UI placeholder
          and does not drive combat behavior yet.
        </div>
      ) : null}

      {!loading && !pageError && combatStatePanelModel ? (
        <CombatStatePanel model={combatStatePanelModel} />
      ) : null}
    </section>
  );
}
