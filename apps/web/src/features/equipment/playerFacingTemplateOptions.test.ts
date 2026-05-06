import { describe, expect, it } from "vitest";
import type { EquipmentTemplate } from "@glantri/domain";

import {
  getPlayerFacingEquipmentLocationTemplateOptions,
  getPlayerFacingEquipmentTemplateName,
  shouldShowInEquipmentLocationDropdown,
} from "./playerFacingTemplateOptions";

function createTemplate(
  overrides: Partial<EquipmentTemplate> & Pick<EquipmentTemplate, "id" | "name" | "category">,
): EquipmentTemplate {
  return {
    baseEncumbrance: 0,
    defaultMaterial: "steel",
    qualityMultipliers: { extraordinary: 1, standard: 1 },
    sourceMetadata: null,
    tags: [],
    ...overrides,
  } as unknown as EquipmentTemplate;
}

describe("player-facing equipment location template options", () => {
  it("hides T.-prefixed thrown weapon artifacts from the dropdown", () => {
    expect(
      shouldShowInEquipmentLocationDropdown(
        createTemplate({
          category: "weapon",
          id: "weapon-template-t-javelin",
          name: "T. Javelin",
          sourceMetadata: {
            rawRow: { A: "T. Javelin" },
            row: 9,
            sheet: "Weapon2",
            sourceColumns: ["A"],
            sourceRange: "A9:K9",
            workbook: "Themistogenes 1.07.xlsx",
          } as never,
        }),
      ),
    ).toBe(false);

    expect(
      shouldShowInEquipmentLocationDropdown(
        createTemplate({
          category: "weapon",
          id: "weapon-template-t-spear",
          name: "T. Spear",
          sourceMetadata: {
            rawRow: { A: "T. Spear" },
            row: 10,
            sheet: "Weapon2",
            sourceColumns: ["A"],
            sourceRange: "A10:K10",
            workbook: "Themistogenes 1.07.xlsx",
          } as never,
        }),
      ),
    ).toBe(false);

    expect(
      shouldShowInEquipmentLocationDropdown(
        createTemplate({
          category: "weapon",
          id: "weapon-template-t-th-dagger",
          name: "T. Th. dagger",
          sourceMetadata: {
            rawRow: { A: "T. Th. dagger" },
            row: 4,
            sheet: "Weapon2",
            sourceColumns: ["A"],
            sourceRange: "A4:K4",
            workbook: "Themistogenes 1.07.xlsx",
          } as never,
        }),
      ),
    ).toBe(true);
  });

  it("keeps normal weapons, shields, and armor available", () => {
    const templates = {
      "armor-template-cloth": createTemplate({
        category: "armor",
        id: "armor-template-cloth",
        name: "Cloth",
      }),
      "shield-template-medium-metal-shield": createTemplate({
        category: "shield",
        id: "shield-template-medium-metal-shield",
        name: "Medium metal shield",
      }),
      "weapon-template-javelin": createTemplate({
        category: "weapon",
        id: "weapon-template-1-h-javelin",
        name: "1-h Javelin",
      }),
      "weapon-template-t-javelin": createTemplate({
        category: "weapon",
        id: "weapon-template-t-javelin",
        name: "T. Javelin",
        sourceMetadata: {
          rawRow: { A: "T. Javelin" },
          row: 9,
          sheet: "Weapon2",
          sourceColumns: ["A"],
          sourceRange: "A9:K9",
          workbook: "Themistogenes 1.07.xlsx",
        } as never,
      }),
      "weapon-template-t-th-dagger": createTemplate({
        category: "weapon",
        id: "weapon-template-t-th-dagger",
        name: "T. Th. dagger",
        sourceMetadata: {
          rawRow: { A: "T. Th. dagger" },
          row: 4,
          sheet: "Weapon2",
          sourceColumns: ["A"],
          sourceRange: "A4:K4",
          workbook: "Themistogenes 1.07.xlsx",
        } as never,
      }),
    };

    expect(
      getPlayerFacingEquipmentLocationTemplateOptions(templates).map(
        (template) => getPlayerFacingEquipmentTemplateName(template),
      ),
    ).toEqual(["1-h Javelin", "Cloth", "Medium metal shield", "Throwing dagger"]);
  });
});
