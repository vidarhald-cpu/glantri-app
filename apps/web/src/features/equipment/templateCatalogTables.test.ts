import { describe, expect, it } from "vitest";
import type { EquipmentTemplate } from "@glantri/domain";

import {
  buildTemplateCatalogTable,
  CANONICAL_TEMPLATE_CATALOG_COLUMNS,
  getAdminTemplateCatalogRows,
} from "./templateCatalogTables";

function createTemplate(
  overrides: Partial<EquipmentTemplate> &
    Pick<EquipmentTemplate, "id" | "name" | "category" | "baseEncumbrance" | "defaultMaterial">,
): EquipmentTemplate {
  return {
    qualityMultipliers: { extraordinary: 1, standard: 1 },
    rulesNotes: null,
    sourceMetadata: null,
    tags: [],
    ...overrides,
  } as unknown as EquipmentTemplate;
}

describe("templateCatalogTables", () => {
  it("builds the shared gear and valuables admin table structure", () => {
    const rows = getAdminTemplateCatalogRows({
      material: "gold",
      quality: "standard",
      templates: [
        createTemplate({
          baseEncumbrance: 0.1,
          baseValue: 50,
          category: "valuables",
          defaultMaterial: "gold",
          id: "valuable-template-gems",
          name: "Gems",
          rulesNotes: "Portable trade stones.",
        }) as Extract<EquipmentTemplate, { category: "gear" | "valuables" }>,
        createTemplate({
          baseEncumbrance: 2,
          baseValue: null,
          category: "gear",
          defaultMaterial: "cloth",
          id: "gear-template-bedroll",
          name: "Bedroll",
          rulesNotes: "Simple travel bedding.",
        }) as Extract<EquipmentTemplate, { category: "gear" | "valuables" }>,
      ],
    });

    const table = buildTemplateCatalogTable(rows);

    expect(table.columns).toEqual([...CANONICAL_TEMPLATE_CATALOG_COLUMNS]);
    expect(table.rows).toEqual([
      ["Bedroll", "2", "—", "Simple travel bedding."],
      ["Gems", "0.1", "50", "Portable trade stones."],
    ]);
  });
});
