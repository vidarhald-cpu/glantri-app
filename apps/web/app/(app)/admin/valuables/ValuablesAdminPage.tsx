"use client";

import { useMemo, useState } from "react";
import { equipmentTemplates } from "@glantri/content/equipment";
import type { MaterialType, QualityType, ValuableTemplate } from "@glantri/domain";

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

const materialOptions: MaterialType[] = ["steel", "bronze", "silver", "gold", "other"];
const qualityOptions: QualityType[] = ["standard", "extraordinary"];

export default function ValuablesAdminPage() {
  const [material, setMaterial] = useState<MaterialType>("gold");
  const [quality, setQuality] = useState<QualityType>("standard");

  const templates = useMemo(
    () =>
      equipmentTemplates.filter(
        (template): template is ValuableTemplate => template.category === "valuables",
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
        eyebrow="Admin / Valuables"
        title="Valuables"
        summary="Read-only catalog view of system valuables templates."
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
        title="System Valuables Catalog"
        subtitle="Valuables templates use the same shared simple catalog structure as gear, keeping encumbrance, value, and notes aligned."
      >
        <AdminCatalogTable
          columns={table.columns.map((column) => String(column))}
          emptyLabel="No valuables templates found."
          rows={table.rows}
          stickyHeader
        />
      </AdminPanel>
    </section>
  );
}
