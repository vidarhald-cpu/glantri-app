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
import {
  buildCharacterArmorSummary,
  getWorkbookCharacterSize,
} from "../../../../../src/features/equipment/armorSummary";
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

function isBowOrTwoHandedTemplate(templateId: string | null, state: EquipmentFeatureState): boolean {
  if (!templateId) {
    return false;
  }

  const template = getEquipmentTemplateById(state, templateId);
  return (
    template?.category === "weapon" &&
    (template.handlingClass === "two_handed" ||
      template.weaponClass === "bow" ||
      template.tags.includes("bow"))
  );
}

function isDedicatedThrownTemplate(templateId: string | null, state: EquipmentFeatureState): boolean {
  if (!templateId) {
    return false;
  }

  const template = getEquipmentTemplateById(state, templateId);
  return (
    template?.category === "weapon" &&
    (template.handlingClass === "thrown" ||
      template.weaponSkill.toLowerCase().includes("throw") ||
      template.tags.includes("thrown"))
  );
}

function getParrySourceOptions(loadout: ReturnType<typeof getLoadoutEquipment>): Array<{
  label: string;
  value: CombatParrySource;
}> {
  const options: Array<{ label: string; value: CombatParrySource }> = [
    { label: "None", value: "none" },
    { label: "Unarmed", value: "unarmed" },
  ];

  if ("primary" in loadout && loadout.primary) {
    options.push({ label: "Primary", value: "primary" });
  }

  if ("secondary" in loadout && loadout.secondary) {
    options.push({ label: "Secondary", value: "secondary" });
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

function buildThrowingWeaponOptions(input: {
  loadout: ReturnType<typeof getLoadoutEquipment>;
  state: EquipmentFeatureState;
  weaponOptions: Array<{ id: string; label: string }>;
}): Array<{ id: string; label: string }> {
  const options = new Map<string, string>();

  const addOption = (itemId: string | null | undefined, prefix?: string) => {
    if (!itemId) {
      return;
    }

    const item = input.state.itemsById[itemId];
    if (!item || item.category !== "weapon") {
      return;
    }

    const matchingOption = input.weaponOptions.find((option) => option.id === itemId);
    const baseLabel =
      matchingOption?.label ??
      getItemName({
        displayName: item.displayName,
        templateId: item.templateId,
        templateName: getEquipmentTemplateById(input.state, item.templateId)?.name,
      });

    options.set(itemId, prefix ? `${prefix}: ${baseLabel}` : baseLabel);
  };

  if ("primary" in input.loadout && input.loadout.primary) {
    addOption(input.loadout.primary.id, "Current primary");
  }

  if ("secondary" in input.loadout && input.loadout.secondary) {
    addOption(input.loadout.secondary.id, "Current secondary");
  }

  if ("missile" in input.loadout && input.loadout.missile) {
    addOption(input.loadout.missile.id, "Current missile");
  }

  for (const option of input.weaponOptions) {
    const item = input.state.itemsById[option.id];
    if (!item || !isDedicatedThrownTemplate(item.templateId, input.state)) {
      continue;
    }

    options.set(option.id, option.label);
  }

  return Array.from(options, ([id, label]) => ({ id, label })).sort((left, right) =>
    left.label.localeCompare(right.label),
  );
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
  const [throwingWeaponItemId, setThrowingWeaponItemId] = useState<string>("");
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
  const throwingWeaponOptions = useMemo(
    () =>
      state
        ? buildThrowingWeaponOptions({
            loadout,
            state,
            weaponOptions,
          })
        : [],
    [loadout, state, weaponOptions]
  );
  const wornArmorSummary = useMemo(() => {
    if (!state || !characterContext?.record || !("armor" in loadout) || !loadout.armor) {
      return null;
    }

    const armorTemplate = getEquipmentTemplateById(state, loadout.armor.templateId);
    if (armorTemplate?.category !== "armor") {
      return null;
    }

    return buildCharacterArmorSummary({
      characterSize: getWorkbookCharacterSize(characterContext.record.build),
      item: loadout.armor,
      template: armorTemplate,
    });
  }, [characterContext, loadout, state]);

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

  useEffect(() => {
    if (!throwingWeaponItemId || !state) {
      return;
    }

    const armedIds = new Set([
      "primary" in loadout ? loadout.primary?.id ?? null : null,
      "secondary" in loadout ? loadout.secondary?.id ?? null : null,
      "missile" in loadout ? loadout.missile?.id ?? null : null,
    ].filter((value): value is string => Boolean(value)));

    const selectedItem = state.itemsById[throwingWeaponItemId];
    const isDedicatedThrown =
      selectedItem?.category === "weapon" &&
      isDedicatedThrownTemplate(selectedItem.templateId, state);

    if (isDedicatedThrown && !armedIds.has(throwingWeaponItemId)) {
      setThrowingWeaponItemId("");
    }
  }, [loadout, state, throwingWeaponItemId]);

  async function applySelection(input: {
    itemId: string | null;
    kind: "armor" | "primary" | "secondary" | "missile" | "shield";
  }) {
    if (!state) {
      return;
    }

    try {
      const currentLoadout = state.activeLoadoutByCharacterId[id];
      const nextSelection = {
        armor: currentLoadout?.wornArmorItemId ?? null,
        shield: currentLoadout?.readyShieldItemId ?? null,
        primary: currentLoadout?.activePrimaryWeaponItemId ?? null,
        secondary: currentLoadout?.activeSecondaryWeaponItemId ?? null,
        missile: currentLoadout?.activeMissileWeaponItemId ?? null,
      };

      nextSelection[input.kind] = input.itemId;

      if (input.kind === "shield" && input.itemId) {
        nextSelection.secondary = null;
      }

      if (input.kind === "secondary" && input.itemId) {
        nextSelection.shield = null;
      }

      const selectedWeaponTemplateId =
        input.kind === "primary" || input.kind === "secondary" || input.kind === "missile"
          ? state.itemsById[input.itemId ?? ""]?.templateId ?? null
          : null;

      if (
        (input.kind === "primary" || input.kind === "secondary") &&
        selectedWeaponTemplateId &&
        isBowOrTwoHandedTemplate(selectedWeaponTemplateId, state)
      ) {
        if (input.kind === "primary") {
          nextSelection.secondary = null;
        }
        if (input.kind === "secondary") {
          nextSelection.primary = null;
        }
        nextSelection.shield = null;
      }

      if (
        input.itemId &&
        (input.kind === "shield" || input.kind === "secondary")
      ) {
        const currentPrimaryTemplateId = state.itemsById[nextSelection.primary ?? ""]?.templateId ?? null;
        if (currentPrimaryTemplateId && isBowOrTwoHandedTemplate(currentPrimaryTemplateId, state)) {
          nextSelection.primary = null;
        }
      }

      const operations: Array<() => Promise<EquipmentFeatureState>> = [];

      const queueOperation = (
        kind: "armor" | "primary" | "secondary" | "missile" | "shield",
        itemId: string | null,
      ) => {
        const currentValue = currentLoadout
          ? kind === "armor"
            ? currentLoadout.wornArmorItemId ?? null
            : kind === "shield"
              ? currentLoadout.readyShieldItemId ?? null
              : kind === "primary"
                ? currentLoadout.activePrimaryWeaponItemId ?? null
                : kind === "secondary"
                  ? currentLoadout.activeSecondaryWeaponItemId ?? null
                  : currentLoadout.activeMissileWeaponItemId ?? null
          : null;

        if (currentValue === itemId) {
          return;
        }

        operations.push(() =>
          kind === "armor"
            ? setCharacterWornArmorOnServer({ characterId: id, itemId })
            : kind === "shield"
              ? setCharacterReadyShieldOnServer({ characterId: id, itemId })
              : kind === "primary"
                ? setCharacterActivePrimaryWeaponOnServer({ characterId: id, itemId })
                : kind === "secondary"
                  ? setCharacterActiveSecondaryWeaponOnServer({ characterId: id, itemId })
                  : setCharacterActiveMissileWeaponOnServer({ characterId: id, itemId }),
        );
      };

      queueOperation("secondary", nextSelection.secondary);
      queueOperation("shield", nextSelection.shield);
      queueOperation("primary", nextSelection.primary);
      queueOperation("armor", nextSelection.armor);
      queueOperation("missile", nextSelection.missile);

      let nextState = state;

      for (const operation of operations) {
        nextState = await operation();
      }

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
            <WeaponControl
              label="Throwing weapon"
              onChange={(itemId) => setThrowingWeaponItemId(itemId ?? "")}
              options={throwingWeaponOptions}
              value={throwingWeaponItemId}
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
          possible. Shield and second-hand choices toggle each other out, and bow or two-handed
          primary/secondary choices clear conflicting off-hand use. Combat posture and parry
          inputs on this page are temporary live inputs for derivation only and are not yet
          persisted. Combat action and Throwing weapon are currently UI placeholders and do not
          drive combat behavior yet.
        </div>
      ) : null}

      {!loading && !pageError ? (
        <ControlSection title="Armor summary">
          {"armor" in loadout && loadout.armor && wornArmorSummary ? (
            <div style={{ display: "grid", gap: "0.85rem" }}>
              <div style={{ color: "#5e5a50", fontSize: "0.9rem" }}>
                Worn armor uses the workbook-backed armor model. Actual armor encumbrance follows
                the workbook rule: Armor sheet Enc. Factor x character Size.
              </div>
              <div
                style={{
                  display: "grid",
                  gap: "0.75rem",
                  gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))"
                }}
              >
                <div><strong>Armor</strong><div>{getItemName({
                  displayName: loadout.armor.displayName,
                  templateId: loadout.armor.templateId,
                  templateName: getEquipmentTemplateById(state!, loadout.armor.templateId)?.name,
                })}</div></div>
                <div><strong>General armor</strong><div>{wornArmorSummary.generalArmorWithType}</div></div>
                <div><strong>AA modifier</strong><div>{wornArmorSummary.aaModifier ?? "—"}</div></div>
                <div><strong>Perception modifier</strong><div>{wornArmorSummary.perceptionModifier ?? "—"}</div></div>
                <div><strong>Encumbrance factor</strong><div>{wornArmorSummary.encumbranceFactor ?? "—"}</div></div>
                <div><strong>Actual encumbrance</strong><div>{wornArmorSummary.actualEncumbrance ?? "—"}</div></div>
              </div>
              <div style={{ overflowX: "auto" }}>
                <table style={{ borderCollapse: "collapse", minWidth: "100%", width: "100%" }}>
                  <thead>
                    <tr style={{ borderBottom: "1px solid #d9ddd8", textAlign: "left" }}>
                      {[
                        "Head",
                        "Front Arm",
                        "Chest",
                        "Back Arm",
                        "Abdomen",
                        "Front Thigh",
                        "Front Foot",
                        "Back Thigh",
                        "Back Foot",
                      ].map((label) => (
                        <th key={label} style={{ padding: "0.5rem 0.75rem 0.5rem 0" }}>{label}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      {wornArmorSummary.locations.map((location) => (
                        <td
                          key={location.key}
                          style={{ padding: "0.6rem 0.75rem 0.6rem 0", verticalAlign: "top" }}
                        >
                          {location.valueWithType}
                        </td>
                      ))}
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <div>No armor is currently worn.</div>
          )}
        </ControlSection>
      ) : null}

      {!loading && !pageError && combatStatePanelModel ? (
        <CombatStatePanel model={combatStatePanelModel} />
      ) : null}
    </section>
  );
}
