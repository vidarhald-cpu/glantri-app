"use client";

import { useMemo } from "react";
import { equipmentTemplates } from "@glantri/content/equipment";
import type { ShieldTemplate } from "@glantri/domain";

import { AdminCatalogTable, AdminPageIntro, AdminPanel } from "../admin-ui";
import { formatWeaponModeDmb } from "@/features/equipment/meleeWeaponDisplay";

function formatOptionalDisplayValue(value: number | string | null | undefined): string {
  if (value === null || value === undefined) {
    return "—";
  }

  const text = typeof value === "number" ? String(value) : value.trim();
  return text.length > 0 ? text : "—";
}

function formatRangeLabel(value: number | string | null | undefined): string {
  if (value === null || value === undefined) {
    return "—";
  }

  const parsed = typeof value === "number" ? value : Number(value.trim());
  if (Number.isFinite(parsed)) {
    return String(Math.trunc(parsed));
  }

  const text = typeof value === "number" ? String(value) : value.trim();
  return text.length > 0 ? text : "—";
}

export default function ShieldsAdminPage() {
  const shields = useMemo(
    () =>
      [...equipmentTemplates]
        .filter(
          (template): template is ShieldTemplate =>
            template.category === "shield" && template.tags.includes("themistogenes-import")
        )
        .sort((left, right) => left.name.localeCompare(right.name)),
    []
  );

  const rows = useMemo(
    () =>
      shields.map((template) => {
        const primaryMode = template.attackModes?.[0] ?? null;
        const secondaryMode = template.attackModes?.[1] ?? null;

        return [
          template.name,
          formatOptionalDisplayValue(template.weaponSkill),
          formatOptionalDisplayValue(template.primeAttackType ?? template.primaryAttackType),
          formatOptionalDisplayValue(primaryMode?.label ?? template.primaryAttackType),
          formatOptionalDisplayValue(primaryMode?.ob ?? template.ob1),
          primaryMode ? formatWeaponModeDmb(primaryMode) : formatOptionalDisplayValue(template.dmb1),
          formatOptionalDisplayValue(primaryMode?.crit ?? template.crit1),
          formatOptionalDisplayValue(primaryMode?.armorModifier ?? template.armorMod1),
          formatOptionalDisplayValue(secondaryMode?.label ?? template.secondaryAttackType),
          formatOptionalDisplayValue(secondaryMode?.ob ?? template.ob2),
          secondaryMode ? formatWeaponModeDmb(secondaryMode) : formatOptionalDisplayValue(template.dmb2),
          formatOptionalDisplayValue(secondaryMode?.crit ?? template.crit2),
          formatOptionalDisplayValue(secondaryMode?.armorModifier ?? template.armorMod2),
          formatOptionalDisplayValue(template.initiative),
          formatRangeLabel(template.range),
          formatOptionalDisplayValue(template.shieldBonus),
          formatOptionalDisplayValue(template.defensiveValue),
          formatOptionalDisplayValue(template.parry),
          formatOptionalDisplayValue(template.baseEncumbrance),
          formatOptionalDisplayValue(template.movementModifier)
        ];
      }),
    [shields]
  );

  return (
    <section style={{ display: "grid", gap: "1.25rem" }}>
      <AdminPageIntro
        eyebrow="Admin / Shields"
        title="Shields"
        summary="Read-only catalog view of system shield templates."
      />

      <AdminPanel
        title="System Shield Catalog"
        subtitle="Workbook-backed shield templates merge offensive values from Weapon1 with defensive values from Shields, preserving import warnings where the sources diverge."
      >
        <AdminCatalogTable
          emptyLabel="No shield templates found."
          columns={[
            "Name",
            "Weapon skill",
            "Prime attack",
            "Attack 1",
            "OB",
            "DMB",
            "Crit 1",
            "Armor mod 1",
            "Attack 2",
            "OB2",
            "DMB2",
            "Crit 2",
            "Armor mod 2",
            "Initiative",
            "Range",
            "Shield bonus",
            "Defensive value",
            "Parry",
            "Encumbrance",
            "Movement modifier"
          ]}
          rows={rows}
        />
      </AdminPanel>
    </section>
  );
}
