"use client";

import { useMemo, useState } from "react";
import { equipmentTemplates } from "@glantri/content/equipment";
import type { GearTemplate, MaterialType, QualityType } from "@glantri/domain";

import { AdminPageIntro, AdminPanel } from "../admin-ui";
import {
  buildTemplateCatalogTable,
  getAdminTemplateCatalogRows,
} from "../../../../src/features/equipment/templateCatalogTables";

const materialOptions: MaterialType[] = ["steel", "bronze", "wood", "leather", "cloth"];
const qualityOptions: QualityType[] = ["standard", "extraordinary"];

function formatLabel(value: string): string {
  return value
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function TableShell(input: {
  columns: string[];
  emptyLabel: string;
  rows: string[][];
}) {
  return input.rows.length > 0 ? (
    <div style={{ maxHeight: "70vh", overflow: "auto" }}>
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
                  zIndex: 1,
                }}
              >
                {column}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {input.rows.map((row, index) => (
            <tr key={`gear-row-${index}`} style={{ borderBottom: "1px solid rgba(85, 73, 48, 0.08)" }}>
              {row.map((value, cellIndex) => (
                <td key={`gear-row-${index}-${cellIndex}`} style={{ padding: "0.65rem 0.75rem 0.65rem 0", verticalAlign: "top" }}>
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

export default function GearAdminPage() {
  const [material, setMaterial] = useState<MaterialType>("steel");
  const [quality, setQuality] = useState<QualityType>("standard");

  const templates = useMemo(
    () =>
      equipmentTemplates.filter(
        (template): template is GearTemplate => template.category === "gear",
      ),
    [],
  );

  const table = useMemo(
    () =>
      buildTemplateCatalogTable(
        getAdminTemplateCatalogRows({
          material,
          quality,
          templates,
        }),
      ),
    [material, quality, templates],
  );

  return (
    <section style={{ display: "grid", gap: "1.25rem" }}>
      <AdminPageIntro
        eyebrow="Admin / Gear"
        title="Gear"
        summary="Read-only catalog view of system gear templates."
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
                  padding: "0.65rem 0.8rem",
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
                  padding: "0.65rem 0.8rem",
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
        title="System Gear Catalog"
        subtitle="Gear templates use the shared simple catalog table structure with encumbrance, value, and notes."
      >
        <TableShell
          columns={table.columns.map((column) => String(column))}
          emptyLabel="No gear templates found."
          rows={table.rows}
        />
      </AdminPanel>
    </section>
  );
}
