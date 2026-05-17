"use client";

import { useMemo, useState } from "react";
import { equipmentTemplates } from "@glantri/content/equipment";
import type { GearTemplate, MaterialType, QualityType } from "@glantri/domain";

import {
  AdminCatalogTable,
  AdminFilterBar,
  AdminFilterSelect,
  AdminPageIntro,
  AdminPanel,
  formatAdminEnumLabel,
} from "../admin-ui";
import {
  buildTemplateCatalogTable,
  getAdminTemplateCatalogRows,
} from "@/features/equipment/templateCatalogTables";

const materialOptions: MaterialType[] = ["steel", "bronze", "wood", "leather", "cloth"];
const qualityOptions: QualityType[] = ["standard", "extraordinary"];

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
          <AdminFilterBar>
            <AdminFilterSelect
              label="Material"
              options={materialOptions}
              value={material}
              onChange={setMaterial}
              formatOption={formatAdminEnumLabel}
            />
            <AdminFilterSelect
              label="Quality"
              options={qualityOptions}
              value={quality}
              onChange={setQuality}
              formatOption={formatAdminEnumLabel}
            />
          </AdminFilterBar>
        }
      />

      <AdminPanel
        title="System Gear Catalog"
        subtitle="Gear templates use the shared simple catalog table structure with encumbrance, value, and notes."
      >
        <AdminCatalogTable
          columns={table.columns.map((column) => String(column))}
          emptyLabel="No gear templates found."
          rows={table.rows}
          stickyHeader
        />
      </AdminPanel>
    </section>
  );
}
