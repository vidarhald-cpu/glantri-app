"use client";

import { useMemo, useState } from "react";
import { equipmentTemplates } from "@glantri/content/equipment";
import type { MaterialType, QualityType, WeaponTemplate } from "@glantri/domain";

import {
  AdminPageIntro,
  AdminPanel
} from "../admin-ui";
import {
  formatNonMeleeModes,
  formatOptionalDisplayValue,
  getCanonicalMeleeModeDisplay,
  getPrimaryAttackTypeForDisplay,
  getPrimarySecondCritForDisplay,
  getTemplateEncumbranceForDisplay,
  isMeleeWeaponTemplate
} from "../../../../src/features/equipment/meleeWeaponDisplay";

const materialOptions: MaterialType[] = [
  "steel",
  "bronze"
];

const qualityOptions: QualityType[] = ["standard", "extraordinary"];

function formatLabel(value: string): string {
  return value
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function formatEncumbrance(value: number): string {
  return value.toFixed(1);
}

function TableShell(input: {
  columns: string[];
  emptyLabel: string;
  rows: string[][];
}) {
  return input.rows.length > 0 ? (
    <div
      style={{
        maxHeight: "70vh",
        overflow: "auto"
      }}
    >
      <table style={{ borderCollapse: "collapse", minWidth: "100%", width: "100%" }}>
        <thead>
          <tr style={{ borderBottom: "1px solid rgba(85, 73, 48, 0.14)", textAlign: "left" }}>
            {input.columns.map((column) => (
              <th
                key={column}
                style={{
                  background: "rgba(250, 245, 234, 0.98)",
                  padding: "0.55rem 0.75rem 0.55rem 0",
                  position: "sticky",
                  top: 0,
                  verticalAlign: "bottom",
                  zIndex: 1
                }}
              >
                {column}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {input.rows.map((row, index) => (
            <tr key={`melee-weapons-row-${index}`} style={{ borderBottom: "1px solid rgba(85, 73, 48, 0.08)" }}>
              {row.map((value, cellIndex) => (
                <td
                  key={`melee-weapons-row-${index}-${cellIndex}`}
                  style={{ padding: "0.65rem 0.75rem 0.65rem 0", verticalAlign: "top" }}
                >
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
  );
}

export default function MeleeWeaponsAdminPage() {
  const [material, setMaterial] = useState<MaterialType>("steel");
  const [quality, setQuality] = useState<QualityType>("standard");

  const meleeWeapons = useMemo(
    () =>
      [...equipmentTemplates]
        .filter((template): template is WeaponTemplate => template.category === "weapon")
        .filter(isMeleeWeaponTemplate)
        .sort(
          (left, right) =>
            left.weaponSkill.localeCompare(right.weaponSkill) ||
            left.name.localeCompare(right.name)
        ),
    []
  );

  const rows = useMemo(
    () =>
      meleeWeapons.map((template) => {
        const meleeModes = getCanonicalMeleeModeDisplay(template.attackModes);

        return [
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
          formatEncumbrance(
            getTemplateEncumbranceForDisplay({
              material,
              quality,
              template
            })
          ),
          formatOptionalDisplayValue(template.baseValue),
          formatLabel(material),
          formatLabel(quality),
          template.rulesNotes ?? "—"
        ];
      }),
    [material, meleeWeapons, quality]
  );

  return (
    <section style={{ display: "grid", gap: "1.25rem" }}>
      <AdminPageIntro
        eyebrow="Admin / Melee weapons"
        title="Melee weapons"
        summary="Read-only catalog view of system melee weapon templates."
        actions={
          <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
            <label style={{ display: "grid", gap: "0.25rem", minWidth: 160 }}>
              <span style={{ color: "#5f543a", fontSize: "0.9rem", fontWeight: 600 }}>Material</span>
              <select
                onChange={(event) => setMaterial(event.target.value as MaterialType)}
                style={{
                  background: "rgba(255, 252, 245, 0.95)",
                  border: "1px solid rgba(85, 73, 48, 0.18)",
                  borderRadius: 14,
                  color: "#2e2619",
                  font: "inherit",
                  padding: "0.65rem 0.8rem"
                }}
                value={material}
              >
                {materialOptions.map((option) => (
                  <option key={option} value={option}>
                    {formatLabel(option)}
                  </option>
                ))}
              </select>
            </label>

            <label style={{ display: "grid", gap: "0.25rem", minWidth: 160 }}>
              <span style={{ color: "#5f543a", fontSize: "0.9rem", fontWeight: 600 }}>Quality</span>
              <select
                onChange={(event) => setQuality(event.target.value as QualityType)}
                style={{
                  background: "rgba(255, 252, 245, 0.95)",
                  border: "1px solid rgba(85, 73, 48, 0.18)",
                  borderRadius: 14,
                  color: "#2e2619",
                  font: "inherit",
                  padding: "0.65rem 0.8rem"
                }}
                value={quality}
              >
                {qualityOptions.map((option) => (
                  <option key={option} value={option}>
                    {formatLabel(option)}
                  </option>
                ))}
              </select>
            </label>
          </div>
        }
      />

      <AdminPanel
        title="System Melee Weapon Catalog"
        subtitle="Melee weapons are selected conservatively: weapon templates that are not marked as missile or thrown and that expose at least one canonical Slash, Strike, or Thrust mode."
      >
        <TableShell
          emptyLabel="No melee weapon templates found."
          columns={[
            "Name",
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
            "Notes"
          ]}
          rows={rows}
        />
      </AdminPanel>
    </section>
  );
}
