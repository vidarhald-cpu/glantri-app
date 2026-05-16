"use client";

import { useMemo, useState } from "react";
import { equipmentTemplates } from "@glantri/content/equipment";
import type { MaterialType, QualityType, WeaponTemplate } from "@glantri/domain";

import {
  AdminCatalogTable,
  AdminFilterBar,
  AdminFilterSelect,
  AdminPageIntro,
  AdminPanel,
  formatAdminEnumLabel,
} from "../admin-ui";
import {
  buildMeleeWeaponCatalogTable,
  getAdminWeaponCatalogRows,
  isCatalogMeleeWeaponTemplate,
} from "@/features/equipment/weaponCatalogTables";

const materialOptions: MaterialType[] = ["steel", "bronze"];
const qualityOptions: QualityType[] = ["standard", "extraordinary"];

export default function MeleeWeaponsAdminPage() {
  const [material, setMaterial] = useState<MaterialType>("steel");
  const [quality, setQuality] = useState<QualityType>("standard");

  const meleeWeapons = useMemo(
    () =>
      [...equipmentTemplates]
        .filter((template): template is WeaponTemplate => template.category === "weapon")
        .filter(isCatalogMeleeWeaponTemplate),
    [],
  );

  const table = useMemo(
    () =>
      buildMeleeWeaponCatalogTable(
        getAdminWeaponCatalogRows({
          material,
          quality,
          templates: meleeWeapons,
        }),
      ),
    [material, meleeWeapons, quality],
  );

  return (
    <section style={{ display: "grid", gap: "1.25rem" }}>
      <AdminPageIntro
        eyebrow="Admin / Melee weapons"
        title="Melee weapons"
        summary="Read-only catalog view of system melee and thrown-capable weapon templates."
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
        title="System Melee Weapon Catalog"
        subtitle="Melee and thrown-capable weapons use the same shared table structure as the current character-facing overview."
      >
        <AdminCatalogTable
          emptyLabel="No melee weapon templates found."
          columns={table.columns.map((column) => String(column))}
          rows={table.rows}
          stickyHeader
        />
      </AdminPanel>
    </section>
  );
}
