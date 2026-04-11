"use client";

import { use, useEffect, useMemo, useState } from "react";
import type {
  ArmorTemplate,
  EquipmentItem,
  EquipmentTemplate,
  ShieldTemplate,
  WeaponTemplate
} from "@glantri/domain";
import { getEffectiveEncumbrance } from "@glantri/domain/equipment";

import {
  getCharacterArmorItems,
  getCharacterShieldItems,
  getCharacterWeaponItems,
  getEquipmentTemplateById
} from "../../../../../src/features/equipment/equipmentSelectors";
import {
  formatNonMeleeModes,
  formatOptionalDisplayValue,
  getCanonicalMeleeModeDisplay,
  getPrimaryAttackTypeForDisplay,
  getPrimarySecondCritForDisplay
} from "../../../../../src/features/equipment/meleeWeaponDisplay";
import type { EquipmentFeatureState } from "../../../../../src/features/equipment/types";
import { loadCharacterEquipmentState } from "../../../../../src/lib/api/localServiceClient";
import { loadLocalCharacterContext } from "../../../../../src/lib/characters/loadLocalCharacterContext";
import { UNNAMED_CHARACTER_PLACEHOLDER } from "../../../../../src/lib/offline/repositories/localCharacterRepository";

interface WeaponsShieldsArmorPageProps {
  params: Promise<{
    id: string;
  }>;
}

interface WeaponRow {
  item: EquipmentItem;
  template: WeaponTemplate;
}

interface ShieldRow {
  item: EquipmentItem;
  template: ShieldTemplate;
}

interface ArmorRow {
  item: EquipmentItem;
  template: ArmorTemplate;
}

function getCharacterName(name: string | undefined): string {
  return name?.trim() || UNNAMED_CHARACTER_PLACEHOLDER;
}

function asWeaponTemplate(template: EquipmentTemplate | undefined): WeaponTemplate | null {
  return template?.category === "weapon" ? template : null;
}

function asShieldTemplate(template: EquipmentTemplate | undefined): ShieldTemplate | null {
  return template?.category === "shield" ? template : null;
}

function asArmorTemplate(template: EquipmentTemplate | undefined): ArmorTemplate | null {
  return template?.category === "armor" ? template : null;
}

function getItemName(item: EquipmentItem, template: EquipmentTemplate): string {
  return item.displayName ?? template.name;
}

function TableShell(input: {
  columns: string[];
  emptyLabel: string;
  rows: string[][];
  title: string;
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
      <h2 style={{ margin: 0 }}>{input.title}</h2>
      {input.rows.length > 0 ? (
        <div style={{ overflowX: "auto" }}>
          <table style={{ borderCollapse: "collapse", minWidth: "100%", width: "100%" }}>
            <thead>
              <tr style={{ borderBottom: "1px solid #d9ddd8", textAlign: "left" }}>
                {input.columns.map((column) => (
                  <th key={column} style={{ padding: "0.5rem 0.75rem 0.5rem 0" }}>
                    {column}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {input.rows.map((row, index) => (
                <tr key={`${input.title}-${index}`} style={{ borderBottom: "1px solid #eee8dc" }}>
                  {row.map((value, cellIndex) => (
                    <td key={`${input.title}-${index}-${cellIndex}`} style={{ padding: "0.6rem 0.75rem 0.6rem 0", verticalAlign: "top" }}>
                      {value}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div>{input.emptyLabel}</div>
      )}
    </section>
  );
}

export default function WeaponsShieldsArmorPage({ params }: WeaponsShieldsArmorPageProps) {
  const { id } = use(params);
  const [characterName, setCharacterName] = useState(UNNAMED_CHARACTER_PLACEHOLDER);
  const [loading, setLoading] = useState(true);
  const [pageError, setPageError] = useState<string>();
  const [state, setState] = useState<EquipmentFeatureState | null>(null);

  useEffect(() => {
    let cancelled = false;

    Promise.all([loadCharacterEquipmentState(id), loadLocalCharacterContext(id)])
      .then(([nextState, characterContext]) => {
        if (cancelled) {
          return;
        }

        setState(nextState);
        setCharacterName(getCharacterName(characterContext.record?.build.name));
        setPageError(undefined);
      })
      .catch((error) => {
        if (cancelled) {
          return;
        }

        const message = error instanceof Error ? error.message : "Unable to load equipment.";
        setPageError(
          message === "Character not found."
            ? "Character not found. This page only works for characters that have been saved to the server."
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

  const weaponRows = useMemo(() => {
    if (!state) {
      return [];
    }

    return getCharacterWeaponItems(state, id)
      .map((item) => {
        const template = asWeaponTemplate(getEquipmentTemplateById(state, item.templateId));
        return template ? ({ item, template } satisfies WeaponRow) : null;
      })
      .filter((row): row is WeaponRow => row !== null)
      .sort((left, right) => getItemName(left.item, left.template).localeCompare(getItemName(right.item, right.template)));
  }, [id, state]);

  const shieldRows = useMemo(() => {
    if (!state) {
      return [];
    }

    return getCharacterShieldItems(state, id)
      .map((item) => {
        const template = asShieldTemplate(getEquipmentTemplateById(state, item.templateId));
        return template ? ({ item, template } satisfies ShieldRow) : null;
      })
      .filter((row): row is ShieldRow => row !== null)
      .sort((left, right) => getItemName(left.item, left.template).localeCompare(getItemName(right.item, right.template)));
  }, [id, state]);

  const armorRows = useMemo(() => {
    if (!state) {
      return [];
    }

    return getCharacterArmorItems(state, id)
      .map((item) => {
        const template = asArmorTemplate(getEquipmentTemplateById(state, item.templateId));
        return template ? ({ item, template } satisfies ArmorRow) : null;
      })
      .filter((row): row is ArmorRow => row !== null)
      .sort((left, right) => getItemName(left.item, left.template).localeCompare(getItemName(right.item, right.template)));
  }, [id, state]);

  if (loading) {
    return <section>Loading equipment overview...</section>;
  }

  if (pageError || !state) {
    return (
      <section style={{ display: "grid", gap: "1rem", maxWidth: 720 }}>
        <h1 style={{ margin: 0 }}>Weapons/Shields/Armor - {characterName}</h1>
        <div>{pageError ?? "Unable to load equipment overview."}</div>
      </section>
    );
  }

  return (
    <section style={{ display: "grid", gap: "1rem", maxWidth: 1280 }}>
      <div>
        <h1 style={{ margin: 0 }}>Weapons/Shields/Armor - {characterName}</h1>
      </div>

      <TableShell
        title="Weapons"
        emptyLabel="No weapon items recorded."
        columns={[
          "Name",
          "Template",
          "Primary attack",
          "Secondary crit",
          "Weapon skill",
          "Class",
          "Handling",
          "Slash OB",
          "Slash DMB",
          "Slash Crit",
          "Slash Armor mod",
          "Strike OB",
          "Strike DMB",
          "Strike Crit",
          "Strike Armor mod",
          "Thrust OB",
          "Thrust DMB",
          "Thrust Crit",
          "Thrust Armor mod",
          "Other modes",
          "Parry",
          "Initiative",
          "Defensive value",
          "Range",
          "Encumbrance",
          "Value",
          "Material",
          "Quality",
          "Condition",
          "Quantity",
          "Notes"
        ]}
        rows={weaponRows.map(({ item, template }) => {
          const meleeModes = getCanonicalMeleeModeDisplay(template.attackModes);

          return [
            getItemName(item, template),
            template.name,
            getPrimaryAttackTypeForDisplay(template),
            getPrimarySecondCritForDisplay(template),
            template.weaponSkill,
            template.weaponClass,
            template.handlingClass,
            meleeModes.slash.ob,
            meleeModes.slash.dmb,
            meleeModes.slash.crit,
            meleeModes.slash.armorModifier,
            meleeModes.strike.ob,
            meleeModes.strike.dmb,
            meleeModes.strike.crit,
            meleeModes.strike.armorModifier,
            meleeModes.thrust.ob,
            meleeModes.thrust.dmb,
            meleeModes.thrust.crit,
            meleeModes.thrust.armorModifier,
            formatNonMeleeModes(template.attackModes),
            formatOptionalDisplayValue(template.parry),
            formatOptionalDisplayValue(template.initiative),
            formatOptionalDisplayValue(template.defensiveValue),
            formatOptionalDisplayValue(template.range),
            String(getEffectiveEncumbrance(item, template)),
            formatOptionalDisplayValue(item.valueOverride ?? template.baseValue),
            item.material,
            item.quality,
            item.conditionState,
            String(item.quantity),
            item.notes ?? template.rulesNotes ?? "—"
          ];
        })}
      />

      <TableShell
        title="Shields"
        emptyLabel="No shield items recorded."
        columns={[
          "Name",
          "Template",
          "Shield bonus",
          "Defensive value",
          "Encumbrance",
          "Value",
          "Material",
          "Quality",
          "Condition",
          "Quantity",
          "Notes"
        ]}
        rows={shieldRows.map(({ item, template }) => [
          getItemName(item, template),
          template.name,
          formatOptionalDisplayValue(template.shieldBonus),
          formatOptionalDisplayValue(template.defensiveValue),
          String(getEffectiveEncumbrance(item, template)),
          formatOptionalDisplayValue(item.valueOverride ?? template.baseValue),
          item.material,
          item.quality,
          item.conditionState,
          String(item.quantity),
          item.notes ?? template.rulesNotes ?? "—"
        ])}
      />

      <TableShell
        title="Armor"
        emptyLabel="No armor items recorded."
        columns={[
          "Name",
          "Template",
          "Subtype",
          "Armor rating",
          "Mobility penalty",
          "Encumbrance",
          "Value",
          "Material",
          "Quality",
          "Condition",
          "Quantity",
          "Notes"
        ]}
        rows={armorRows.map(({ item, template }) => [
          getItemName(item, template),
          template.name,
          formatOptionalDisplayValue(template.subtype),
          formatOptionalDisplayValue(template.armorRating),
          formatOptionalDisplayValue(template.mobilityPenalty),
          String(getEffectiveEncumbrance(item, template)),
          formatOptionalDisplayValue(item.valueOverride ?? template.baseValue),
          item.material,
          item.quality,
          item.conditionState,
          String(item.quantity),
          item.notes ?? template.rulesNotes ?? "—"
        ])}
      />
    </section>
  );
}
