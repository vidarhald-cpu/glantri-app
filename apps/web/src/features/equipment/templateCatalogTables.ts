import { getEffectiveEncumbrance, type EquipmentItem, type EquipmentTemplate } from "@glantri/domain";

import { formatEncumbranceDisplay } from "./displayFormatting";

export interface TemplateCatalogOptionRow {
  baseValue: string;
  encumbrance: string;
  label: string;
  notes: string;
}

export interface TemplateCatalogTableModel {
  columns: string[];
  rows: string[][];
}

export const CANONICAL_TEMPLATE_CATALOG_COLUMNS = [
  "Name",
  "Encumbrance",
  "Value",
  "Notes",
] as const;

export function getAdminTemplateCatalogRows(input: {
  material: EquipmentItem["material"];
  quality: EquipmentItem["quality"];
  templates: Array<Extract<EquipmentTemplate, { category: "gear" | "valuables" }>>;
}): TemplateCatalogOptionRow[] {
  return input.templates
    .map((template) => {
      const syntheticItem: EquipmentItem = {
        id: `admin-${template.id}`,
        characterId: "admin-preview",
        templateId: template.id,
        category: template.category,
        displayName: null,
        specificityType: template.specificityTypeDefault,
        quantity: 1,
        isStackable: template.category === "valuables",
        material: input.material,
        quality: input.quality,
        storageAssignment: {
          locationId: "admin-preview",
          carryMode: "equipped",
        },
        conditionState: "intact",
        durabilityCurrent: null,
        durabilityMax: null,
        encumbranceOverride: null,
        valueOverride: null,
        specialProperties: null,
        notes: null,
        isEquipped: null,
        isFavorite: null,
        acquiredFrom: null,
        statusTags: null,
      };

      return {
        baseValue: template.baseValue == null ? "—" : String(template.baseValue),
        encumbrance: formatEncumbranceDisplay(getEffectiveEncumbrance(syntheticItem, template)),
        label: template.name,
        notes: template.rulesNotes ?? "—",
      };
    })
    .sort((left, right) => left.label.localeCompare(right.label));
}

export function buildTemplateCatalogTable(
  rows: TemplateCatalogOptionRow[],
): TemplateCatalogTableModel {
  return {
    columns: [...CANONICAL_TEMPLATE_CATALOG_COLUMNS],
    rows: rows.map((row) => [row.label, row.encumbrance, row.baseValue, row.notes]),
  };
}
