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
  buildMissileWeaponCatalogTable,
  getAdminWeaponCatalogRows,
  isCatalogMissileWeaponTemplate,
} from "@/features/equipment/weaponCatalogTables";

const materialOptions: MaterialType[] = ["steel", "bronze"];
const qualityOptions: QualityType[] = ["standard", "extraordinary"];

export default function MissileWeaponsAdminPage() {
  const [material, setMaterial] = useState<MaterialType>("steel");
  const [quality, setQuality] = useState<QualityType>("standard");

  const missileWeapons = useMemo(
    () =>
      [...equipmentTemplates]
        .filter((template): template is WeaponTemplate => template.category === "weapon")
        .filter(isCatalogMissileWeaponTemplate),
    [],
  );

  const table = useMemo(
    () =>
      buildMissileWeaponCatalogTable(
        getAdminWeaponCatalogRows({
          material,
          quality,
          templates: missileWeapons,
        }),
      ),
    [material, missileWeapons, quality],
  );

  return (
    <section style={{ display: "grid", gap: "1.25rem" }}>
      <AdminPageIntro
        eyebrow="Admin / Missile weapons"
        title="Missile weapons"
        summary="Read-only catalog view of system missile weapon templates."
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
        title="System Missile Weapon Catalog"
        subtitle="Missile weapons use their own shared table structure so bow and pistol rows no longer borrow melee-only attack columns."
      >
        <AdminCatalogTable
          emptyLabel="No missile weapon templates found."
          columns={table.columns.map((column) => String(column))}
          rows={table.rows}
          stickyHeader
        />
      </AdminPanel>
    </section>
  );
}
