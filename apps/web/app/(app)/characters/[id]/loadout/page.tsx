"use client";

import Link from "next/link";
import { use, useEffect, useMemo, useState } from "react";
import {
  getAccessTier,
  isWithYouLocation,
  type ArmorTemplate,
  type CarryMode,
  type EquipmentItem,
  type ShieldTemplate,
  type WeaponTemplate
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
  getStoredItems,
  getWithYouItems
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

function formatLabel(value: string): string {
  return value
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
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

function SectionCard(input: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <section
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
        <h2 style={{ margin: 0 }}>{input.title}</h2>
        {input.description ? (
          <div style={{ color: "#5e5a50", fontSize: "0.9rem" }}>{input.description}</div>
        ) : null}
      </div>
      {input.children}
    </section>
  );
}

function StatGrid(input: { children: React.ReactNode }) {
  return (
    <div
      style={{
        display: "grid",
        gap: "0.75rem",
        gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))"
      }}
    >
      {input.children}
    </div>
  );
}

function DetailRow(input: { label: string; value: React.ReactNode }) {
  return (
    <div
      style={{
        alignItems: "start",
        display: "grid",
        gap: "0.35rem",
        gridTemplateColumns: "minmax(140px, 180px) 1fr"
      }}
    >
      <div style={{ color: "#5e5a50", fontSize: "0.9rem" }}>{input.label}</div>
      <div>{input.value}</div>
    </div>
  );
}

function BattleStatCard(input: {
  title: string;
  subtitle?: string;
  rows: Array<{ label: string; value: React.ReactNode }>;
}) {
  return (
    <div
      style={{
        background: "#f6f5ef",
        border: "1px solid #d9ddd8",
        borderRadius: 12,
        display: "grid",
        gap: "0.5rem",
        padding: "1rem"
      }}
    >
      <div style={{ display: "grid", gap: "0.15rem" }}>
        <strong>{input.title}</strong>
        {input.subtitle ? (
          <div style={{ color: "#5e5a50", fontSize: "0.85rem" }}>{input.subtitle}</div>
        ) : null}
      </div>
      <div style={{ display: "grid", gap: "0.35rem" }}>
        {input.rows.map((row) => (
          <DetailRow key={row.label} label={row.label} value={row.value} />
        ))}
      </div>
    </div>
  );
}

function TableCard(input: {
  title: string;
  description?: string;
  columns: string[];
  rows: Array<Array<React.ReactNode>>;
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
      <div style={{ display: "grid", gap: "0.15rem" }}>
        <strong>{input.title}</strong>
        {input.description ? (
          <div style={{ color: "#5e5a50", fontSize: "0.85rem" }}>{input.description}</div>
        ) : null}
      </div>
      <div style={{ overflowX: "auto" }}>
        <table style={{ borderCollapse: "collapse", minWidth: "100%", width: "100%" }}>
          <thead>
            <tr>
              {input.columns.map((column) => (
                <th
                  key={column}
                  style={{
                    borderBottom: "1px solid #d9ddd8",
                    color: "#5e5a50",
                    fontSize: "0.85rem",
                    fontWeight: 600,
                    padding: "0.6rem",
                    textAlign: "left",
                    whiteSpace: "nowrap"
                  }}
                >
                  {column}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {input.rows.map((row, rowIndex) => (
              <tr key={rowIndex}>
                {row.map((cell, cellIndex) => (
                  <td
                    key={`${rowIndex}-${cellIndex}`}
                    style={{
                      borderBottom: rowIndex === input.rows.length - 1 ? "none" : "1px solid #e6e6df",
                      fontSize: "0.95rem",
                      padding: "0.6rem",
                      verticalAlign: "top"
                    }}
                  >
                    {cell}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function asWeaponTemplate(template: unknown): WeaponTemplate | null {
  return template && typeof template === "object" && "category" in template && template.category === "weapon"
    ? (template as WeaponTemplate)
    : null;
}

function asShieldTemplate(template: unknown): ShieldTemplate | null {
  return template && typeof template === "object" && "category" in template && template.category === "shield"
    ? (template as ShieldTemplate)
    : null;
}

function asArmorTemplate(template: unknown): ArmorTemplate | null {
  return template && typeof template === "object" && "category" in template && template.category === "armor"
    ? (template as ArmorTemplate)
    : null;
}

function getGripSummary(input: {
  primaryTemplate: WeaponTemplate | null;
  secondaryTemplate: WeaponTemplate | null;
  missileTemplate: WeaponTemplate | null;
  shieldTemplate: ShieldTemplate | null;
}) {
  const primaryHandling = input.primaryTemplate?.handlingClass;

  if (input.primaryTemplate && input.secondaryTemplate && !input.shieldTemplate) {
    return "Dual-wield / paired weapons ready";
  }

  if (primaryHandling === "two_handed" || primaryHandling === "polearm") {
    return "Two-handed primary";
  }

  if (input.primaryTemplate && input.shieldTemplate) {
    return "One-handed + shield";
  }

  if (input.primaryTemplate && input.secondaryTemplate) {
    return "One-handed primary with secondary carried";
  }

  if (input.primaryTemplate) {
    return "One-handed";
  }

  if (input.missileTemplate) {
    return "Missile ready";
  }

  if (input.shieldTemplate) {
    return "Shield-ready, otherwise unarmed";
  }

  return "Unarmed";
}

function getMobilitySummary(input: {
  armorTemplate: ArmorTemplate | null;
  personalEncumbrance: number;
  backpackCount: number;
  mountEncumbrance: number;
}) {
  if (input.armorTemplate?.mobilityPenalty && input.armorTemplate.mobilityPenalty > 0) {
    return `Armor mobility penalty ${input.armorTemplate.mobilityPenalty}; current personal encumbrance ${input.personalEncumbrance}.`;
  }

  if (input.personalEncumbrance > 20) {
    return `Higher carried load at ${input.personalEncumbrance} encumbrance; movement rules are not yet fully derived here.`;
  }

  if (input.backpackCount > 0 || input.mountEncumbrance > 0) {
    return `Travel load distributed across backpack/mount; exact movement modifiers are not yet fully derived here.`;
  }

  return `Light carried state; exact movement modifiers are not yet fully derived here.`;
}

function getTemplateName(state: EquipmentFeatureState | null, item: EquipmentItem | undefined): string {
  if (!state || !item) {
    return "None";
  }

  return getEquipmentTemplateById(state, item.templateId)?.name ?? "Unknown item";
}

function getItemLabel(state: EquipmentFeatureState | null, item: EquipmentItem | undefined): string {
  if (!item) {
    return "None";
  }

  const typeName = getTemplateName(state, item);
  return item.displayName ? `${item.displayName} (${typeName})` : typeName;
}

function getProtectionCoverageLabel(armorTemplate: ArmorTemplate | null): string {
  if (!armorTemplate) {
    return "Unarmored";
  }

  return armorTemplate.subtype ? formatLabel(armorTemplate.subtype) : armorTemplate.name;
}

function getWeaponModeValue(value: string | number | null | undefined): React.ReactNode {
  return value ?? "—";
}

function getWeaponNotes(template: WeaponTemplate | null): string {
  if (!template) {
    return "Not equipped";
  }

  const notes: string[] = [];

  notes.push(`Handling ${formatLabel(template.handlingClass)}`);

  if (template.range) {
    notes.push(`Range ${template.range}`);
  }

  if (template.parry != null) {
    notes.push(`Parry ${template.parry}`);
  }

  if (template.defensiveValue != null) {
    notes.push(`Template defensive ${template.defensiveValue}`);
  }

  return notes.join(" | ");
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
  const withYouCount = useMemo(() => (state ? getWithYouItems(state, id).length : 0), [state, id]);
  const weaponOptions = useMemo(
    () =>
      state
        ? buildSelectableItemOptions({
            items: getCharacterWeaponItems(state, id).filter((item) => {
              const location = state.locationsById[item.storageAssignment.locationId];
              return location ? isWithYouLocation(location) : false;
            }),
            state
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
            state
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
            state
          })
        : [],
    [state, id]
  );
  const primaryWeaponTemplate = useMemo(
    () =>
      state && "primary" in loadout && loadout.primary
        ? asWeaponTemplate(getEquipmentTemplateById(state, loadout.primary.templateId))
        : null,
    [state, loadout]
  );
  const secondaryWeaponTemplate = useMemo(
    () =>
      state && "secondary" in loadout && loadout.secondary
        ? asWeaponTemplate(getEquipmentTemplateById(state, loadout.secondary.templateId))
        : null,
    [state, loadout]
  );
  const missileWeaponTemplate = useMemo(
    () =>
      state && "missile" in loadout && loadout.missile
        ? asWeaponTemplate(getEquipmentTemplateById(state, loadout.missile.templateId))
        : null,
    [state, loadout]
  );
  const shieldTemplate = useMemo(
    () =>
      state && "shield" in loadout && loadout.shield
        ? asShieldTemplate(getEquipmentTemplateById(state, loadout.shield.templateId))
        : null,
    [state, loadout]
  );
  const armorTemplate = useMemo(
    () =>
      state && "armor" in loadout && loadout.armor
        ? asArmorTemplate(getEquipmentTemplateById(state, loadout.armor.templateId))
        : null,
    [state, loadout]
  );
  const gripSummary = useMemo(
    () =>
      getGripSummary({
        missileTemplate: missileWeaponTemplate,
        primaryTemplate: primaryWeaponTemplate,
        secondaryTemplate: secondaryWeaponTemplate,
        shieldTemplate
      }),
    [missileWeaponTemplate, primaryWeaponTemplate, secondaryWeaponTemplate, shieldTemplate]
  );
  const movementSummary = useMemo(
    () =>
      getMobilitySummary({
        armorTemplate,
        backpackCount,
        mountEncumbrance,
        personalEncumbrance
      }),
    [armorTemplate, backpackCount, mountEncumbrance, personalEncumbrance]
  );
  const currentUseRows = useMemo(
    () => [
      {
        label: "Grip / current use",
        value: gripSummary
      },
      {
        label: "Worn armor",
        value: getItemLabel(state, "armor" in loadout ? loadout.armor : undefined)
      },
      {
        label: "Ready shield",
        value: getItemLabel(state, "shield" in loadout ? loadout.shield : undefined)
      },
      {
        label: "Active primary weapon",
        value: getItemLabel(state, "primary" in loadout ? loadout.primary : undefined)
      },
      {
        label: "Active secondary weapon",
        value: getItemLabel(state, "secondary" in loadout ? loadout.secondary : undefined)
      },
      {
        label: "Active missile weapon",
        value: getItemLabel(state, "missile" in loadout ? loadout.missile : undefined)
      },
      {
        label: "Unarmed baseline",
        value: "Available as fallback; exact shared unarmed combat values are not yet fully derived."
      }
    ],
    [gripSummary, loadout, state]
  );
  const armorProtectionRows = useMemo(() => {
    const rows = [
      "Head",
      "Front Arm",
      "Back Arm",
      "Abdomen",
      "Front Thigh",
      "Front Foot",
      "Back Thigh",
      "Back Foot",
      "General"
    ];

    return rows.map((location) => {
      const isGeneral = location === "General";

      return [
        location,
        armorTemplate ? getItemLabel(state, "armor" in loadout ? loadout.armor : undefined) : "Unarmored",
        isGeneral
          ? armorTemplate?.armorRating ?? "Unarmored"
          : armorTemplate
            ? `Uses general AR ${armorTemplate.armorRating ?? "n/a"} (interim)`
            : "Unarmored",
        isGeneral
          ? armorTemplate?.mobilityPenalty ?? "—"
          : "Location crit mod not yet derived",
        isGeneral
          ? getProtectionCoverageLabel(armorTemplate)
          : armorTemplate
            ? `${getProtectionCoverageLabel(armorTemplate)} (general coverage only)`
            : "No armor",
      ];
    });
  }, [armorTemplate, loadout, state]);
  const weaponModeRows = useMemo(
    () => [
      [
        "Primary weapon",
        primaryWeaponTemplate ? getItemLabel(state, "primary" in loadout ? loadout.primary : undefined) : "None",
        getWeaponModeValue(primaryWeaponTemplate?.initiative),
        getWeaponModeValue(primaryWeaponTemplate?.ob1),
        getWeaponModeValue(primaryWeaponTemplate?.dmb1),
        getWeaponModeValue(primaryWeaponTemplate?.primaryAttackType),
        getWeaponModeValue(primaryWeaponTemplate?.crit1),
        getWeaponModeValue(primaryWeaponTemplate?.ob2),
        getWeaponModeValue(primaryWeaponTemplate?.dmb2),
        getWeaponModeValue(primaryWeaponTemplate?.secondaryAttackType),
        getWeaponModeValue(primaryWeaponTemplate?.crit2 ?? primaryWeaponTemplate?.secondCrit),
        "Not yet fully derived",
        "Not yet fully derived",
        getWeaponModeValue(primaryWeaponTemplate?.parry ?? primaryWeaponTemplate?.defensiveValue),
        getWeaponNotes(primaryWeaponTemplate)
      ],
      [
        "Secondary weapon",
        secondaryWeaponTemplate ? getItemLabel(state, "secondary" in loadout ? loadout.secondary : undefined) : "None",
        getWeaponModeValue(secondaryWeaponTemplate?.initiative),
        getWeaponModeValue(secondaryWeaponTemplate?.ob1),
        getWeaponModeValue(secondaryWeaponTemplate?.dmb1),
        getWeaponModeValue(secondaryWeaponTemplate?.primaryAttackType),
        getWeaponModeValue(secondaryWeaponTemplate?.crit1),
        getWeaponModeValue(secondaryWeaponTemplate?.ob2),
        getWeaponModeValue(secondaryWeaponTemplate?.dmb2),
        getWeaponModeValue(secondaryWeaponTemplate?.secondaryAttackType),
        getWeaponModeValue(secondaryWeaponTemplate?.crit2 ?? secondaryWeaponTemplate?.secondCrit),
        "Not yet fully derived",
        "Not yet fully derived",
        getWeaponModeValue(secondaryWeaponTemplate?.parry ?? secondaryWeaponTemplate?.defensiveValue),
        getWeaponNotes(secondaryWeaponTemplate)
      ],
      [
        "Missile weapon",
        missileWeaponTemplate ? getItemLabel(state, "missile" in loadout ? loadout.missile : undefined) : "None",
        getWeaponModeValue(missileWeaponTemplate?.initiative),
        getWeaponModeValue(missileWeaponTemplate?.ob1),
        getWeaponModeValue(missileWeaponTemplate?.dmb1),
        getWeaponModeValue(missileWeaponTemplate?.primaryAttackType),
        getWeaponModeValue(missileWeaponTemplate?.crit1),
        getWeaponModeValue(missileWeaponTemplate?.ob2),
        getWeaponModeValue(missileWeaponTemplate?.dmb2),
        getWeaponModeValue(missileWeaponTemplate?.secondaryAttackType),
        getWeaponModeValue(missileWeaponTemplate?.crit2 ?? missileWeaponTemplate?.secondCrit),
        "Not yet fully derived",
        "Not yet fully derived",
        getWeaponModeValue(missileWeaponTemplate?.parry ?? missileWeaponTemplate?.defensiveValue),
        getWeaponNotes(missileWeaponTemplate)
      ],
      [
        "Unarmed / brawling",
        "Unarmed baseline",
        "Not yet fully derived",
        "Not yet fully derived",
        "Not yet fully derived",
        "Baseline strike/grapple not yet wired",
        "—",
        "—",
        "—",
        "—",
        "—",
        "Not yet fully derived",
        "Not yet fully derived",
        "Not yet fully derived",
        "Shown explicitly so future combat derivation has a visible home."
      ]
    ],
    [
      loadout,
      missileWeaponTemplate,
      primaryWeaponTemplate,
      secondaryWeaponTemplate,
      state
    ]
  );
  const capabilityRows = useMemo(
    () => [
      { label: "Personal encumbrance", value: personalEncumbrance },
      { label: "Mount encumbrance", value: mountEncumbrance },
      { label: "Movement", value: movementSummary },
      {
        label: "Movement modifier",
        value:
          armorTemplate?.mobilityPenalty != null
            ? `Exact current armor mobility penalty: ${armorTemplate.mobilityPenalty}`
            : "No exact shared movement modifier is derived yet."
      },
      {
        label: "Perception",
        value:
          "No exact perception penalty is currently derived from encumbrance/loadout; current carried state is the combat input."
      },
      { label: "Backpack items", value: backpackCount },
      { label: "With-you items", value: withYouCount },
      { label: "Stored elsewhere", value: storedCount },
      { label: "Encounter-accessible gear", value: encounterAccessibleGearCount },
      { label: "Encounter-accessible valuables", value: encounterAccessibleValuablesCount },
      { label: "Carried coin quantity", value: carriedCoinQuantity },
      {
        label: "Key action skills",
        value:
          "Acrobatics, Stealth, Swim, Ride, Climb, Dodge, Parry, and Brawling are not yet wired into this persisted combat read-model."
      }
    ],
    [
      armorTemplate,
      backpackCount,
      carriedCoinQuantity,
      encounterAccessibleGearCount,
      encounterAccessibleValuablesCount,
      mountEncumbrance,
      movementSummary,
      personalEncumbrance,
      storedCount,
      withYouCount
    ]
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
        <SummaryCard label="With-you item count" value={withYouCount} />
      </div> : null}

      {!loading && !pageError ? <div style={{ color: "#5e5a50", fontSize: "0.9rem" }}>
        Loadout options are drawn from items currently with you. Choosing a different item swaps it
        into active use and stows the previous one back into the source location when possible.
      </div> : null}

      {!loading && !pageError ? (
        <SectionCard
          title="Combat State Panel"
          description="Structured read-only combat snapshot of the current persisted fighting state, intended to grow into a reusable combat-facing panel."
        >
          <StatGrid>
            <BattleStatCard
              title="Current Use"
              subtitle="What is worn, readied, and immediately used right now."
              rows={currentUseRows}
            />
            <BattleStatCard
              title="Armor and Protection"
              subtitle="Exact template values are shown directly; location-specific armor coverage remains an interim structure."
              rows={[
                { label: "Worn armor", value: getItemLabel(state, "armor" in loadout ? loadout.armor : undefined) },
                { label: "Armor rating", value: armorTemplate?.armorRating ?? "Unarmored" },
                { label: "Armor mobility penalty", value: armorTemplate?.mobilityPenalty ?? "—" },
                { label: "Ready shield", value: getItemLabel(state, "shield" in loadout ? loadout.shield : undefined) },
                { label: "Shield bonus", value: shieldTemplate?.shieldBonus ?? "No ready shield" },
                { label: "Shield defensive value", value: shieldTemplate?.defensiveValue ?? "No ready shield" }
              ]}
            />
          </StatGrid>

          <TableCard
            title="Armor and Protection by Location"
            description="The table structure is ready for sheet-style body locations. Only the general armor item values are exact right now; the location rows are clearly interim until location-based armor derivation exists."
            columns={["Location", "Armor", "Armor value", "Crit mod", "Type"]}
            rows={armorProtectionRows}
          />

          <TableCard
            title="Weapons and Defense"
            description="Weapon-mode values come directly from current templates where they exist. DB, DM, and unarmed numbers stay explicitly interim until shared combat derivation is implemented."
            columns={[
              "Mode",
              "Current item",
              "I",
              "OB",
              "DMB",
              "Attack 1",
              "Crit 1",
              "OB2",
              "DMB2",
              "Attack 2",
              "Crit 2",
              "DB",
              "DM",
              "Parry",
              "Notes"
            ]}
            rows={weaponModeRows}
          />

          <StatGrid>
            <BattleStatCard
              title="Weapons and Defense"
              subtitle="Quick-read interpretation of the current mode table."
              rows={[
                { label: "Current grip", value: gripSummary },
                {
                  label: "Primary notes",
                  value: primaryWeaponTemplate ? getWeaponNotes(primaryWeaponTemplate) : "No active primary weapon"
                },
                {
                  label: "Secondary notes",
                  value: secondaryWeaponTemplate ? getWeaponNotes(secondaryWeaponTemplate) : "No active secondary weapon"
                },
                {
                  label: "Missile notes",
                  value: missileWeaponTemplate ? getWeaponNotes(missileWeaponTemplate) : "No active missile weapon"
                },
                {
                  label: "Defense status",
                  value:
                    shieldTemplate || primaryWeaponTemplate?.parry != null || primaryWeaponTemplate?.defensiveValue != null
                      ? "Shield and template defensive values are exact where shown; combined DB/DM remains interim."
                      : "No exact current DB/DM defense stack is derived yet."
                }
              ]}
            />
            <BattleStatCard
              title="Encumbrance and Capability"
              subtitle="Current carried-state inputs that later combat movement and readiness logic can reuse."
              rows={capabilityRows}
            />
          </StatGrid>
        </SectionCard>
      ) : null}
    </section>
  );
}
