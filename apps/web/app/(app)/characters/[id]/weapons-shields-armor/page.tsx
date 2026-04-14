"use client";

import { use, useEffect, useMemo, useState } from "react";
import type {
  ArmorTemplate,
  EquipmentItem,
  EquipmentTemplate,
  ShieldTemplate,
} from "@glantri/domain";
import { getEffectiveEncumbrance } from "@glantri/domain/equipment";

import {
  getCharacterArmorItems,
  getCharacterShieldItems,
  getCharacterWeaponItems,
  getEquipmentTemplateById
} from "../../../../../src/features/equipment/equipmentSelectors";
import {
  buildCharacterArmorSummary,
  getWorkbookCharacterSize,
} from "../../../../../src/features/equipment/armorSummary";
import { formatEncumbranceDisplay } from "../../../../../src/features/equipment/displayFormatting";
import {
  formatOptionalDisplayValue,
  formatWeaponModeDmb,
} from "../../../../../src/features/equipment/meleeWeaponDisplay";
import {
  buildMeleeWeaponCatalogTable,
  buildMissileWeaponCatalogTable,
  getCharacterWeaponCatalogRows,
  truncateWeaponCatalogNote,
} from "../../../../../src/features/equipment/weaponCatalogTables";
import type { EquipmentFeatureState } from "../../../../../src/features/equipment/types";
import { loadCharacterEquipmentState } from "../../../../../src/lib/api/localServiceClient";
import { loadLocalCharacterContext } from "../../../../../src/lib/characters/loadLocalCharacterContext";
import { UNNAMED_CHARACTER_PLACEHOLDER } from "../../../../../src/lib/offline/repositories/localCharacterRepository";

interface WeaponsShieldsArmorPageProps {
  params: Promise<{
    id: string;
  }>;
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
  const [characterSize, setCharacterSize] = useState<number | null>(null);
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

  const weaponCatalogRows = useMemo(
    () =>
      state
        ? getCharacterWeaponCatalogRows({
            characterId: id,
            items: getCharacterWeaponItems(state, id),
            state,
          })
        : [],
    [id, state],
  );
  const meleeWeaponTable = useMemo(() => buildMeleeWeaponCatalogTable(weaponCatalogRows), [weaponCatalogRows]);
  const missileWeaponTable = useMemo(() => buildMissileWeaponCatalogTable(weaponCatalogRows), [weaponCatalogRows]);
  const meleeWeaponRowsWithNotes = useMemo(
    () =>
      meleeWeaponTable.rows.map((row) => {
        const source = weaponCatalogRows.find(
          (candidate) => candidate.label === row[0] && candidate.template.handlingClass !== "missile",
        );
        return [...row, truncateWeaponCatalogNote(source?.notes ?? "—")];
      }),
    [meleeWeaponTable.rows, weaponCatalogRows],
  );
  const missileWeaponRowsWithNotes = useMemo(
    () =>
      missileWeaponTable.rows.map((row) => {
        const source = weaponCatalogRows.find(
          (candidate) => candidate.label === row[0] && candidate.template.handlingClass === "missile",
        );
        return [...row, truncateWeaponCatalogNote(source?.notes ?? "—")];
      }),
    [missileWeaponTable.rows, weaponCatalogRows],
  );

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
        emptyLabel="No melee or thrown-capable weapon items recorded."
        columns={[...meleeWeaponTable.columns.map((column) => String(column)), "Notes"]}
        rows={meleeWeaponRowsWithNotes}
      />

      <TableShell
        title="Missile weapons"
        emptyLabel="No missile weapon items recorded."
        columns={[...missileWeaponTable.columns.map((column) => String(column)), "Notes"]}
        rows={missileWeaponRowsWithNotes}
      />

      <TableShell
        title="Shields"
        emptyLabel="No shield items recorded."
        columns={[
          "Name",
          "Template",
          "Primary attack",
          "OB",
          "DMB",
          "Crit",
          "Armor mod",
          "Initiative",
          "Parry",
          "Shield bonus",
          "Defensive value",
          "Movement mod",
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
          formatOptionalDisplayValue(template.attackModes?.[0]?.label ?? template.primaryAttackType),
          formatOptionalDisplayValue(template.attackModes?.[0]?.ob ?? template.ob1),
          template.attackModes?.[0] ? formatWeaponModeDmb(template.attackModes[0]) : formatOptionalDisplayValue(template.dmb1),
          formatOptionalDisplayValue(template.attackModes?.[0]?.crit ?? template.crit1),
          formatOptionalDisplayValue(template.attackModes?.[0]?.armorModifier ?? template.armorMod1),
          formatOptionalDisplayValue(template.initiative),
          formatOptionalDisplayValue(template.parry),
          formatOptionalDisplayValue(template.shieldBonus),
          formatOptionalDisplayValue(template.defensiveValue),
          formatOptionalDisplayValue(template.movementModifier),
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
          "Head",
          "Front Arm",
          "Chest",
          "Back Arm",
          "Abdomen",
          "Front Thigh",
          "Front Foot",
          "Back Thigh",
          "Back Foot",
          "General armor",
          "AA mod",
          "Per. mod",
          "Enc. factor",
          "Actual encumbrance",
          "Value",
          "Material",
          "Quality",
          "Condition",
          "Quantity",
          "Notes"
        ]}
        rows={armorRows.map(({ item, template }) => {
          const armorSummary = buildCharacterArmorSummary({
            characterSize,
            item,
            template,
          });

          return [
            getItemName(item, template),
            template.name,
            armorSummary?.locations.find((location) => location.key === "head")?.valueWithType ?? "—",
            armorSummary?.locations.find((location) => location.key === "frontArm")?.valueWithType ?? "—",
            armorSummary?.locations.find((location) => location.key === "chest")?.valueWithType ?? "—",
            armorSummary?.locations.find((location) => location.key === "backArm")?.valueWithType ?? "—",
            armorSummary?.locations.find((location) => location.key === "abdomen")?.valueWithType ?? "—",
            armorSummary?.locations.find((location) => location.key === "frontThigh")?.valueWithType ?? "—",
            armorSummary?.locations.find((location) => location.key === "frontFoot")?.valueWithType ?? "—",
            armorSummary?.locations.find((location) => location.key === "backThigh")?.valueWithType ?? "—",
            armorSummary?.locations.find((location) => location.key === "backFoot")?.valueWithType ?? "—",
            armorSummary?.generalArmorWithType ?? "—",
            formatOptionalDisplayValue(armorSummary?.aaModifier),
            formatOptionalDisplayValue(armorSummary?.perceptionModifier),
            formatEncumbranceDisplay(armorSummary?.encumbranceFactor),
            formatEncumbranceDisplay(armorSummary?.actualEncumbrance),
            formatOptionalDisplayValue(item.valueOverride ?? template.baseValue),
            item.material,
            item.quality,
            item.conditionState,
            String(item.quantity),
            item.notes ?? template.rulesNotes ?? "—"
          ];
        })}
      />
    </section>
  );
}
