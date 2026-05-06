import { describe, expect, it } from "vitest";
import type { EquipmentTemplate } from "@glantri/domain";

import {
  buildInventoryTemplateGroups,
  filterInventoryTemplateOptions,
} from "./inventoryTemplateGroups";
import { getPlayerFacingEquipmentTemplateName } from "./playerFacingTemplateOptions";

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

describe("buildInventoryTemplateGroups", () => {
  it("places missile weapons in their own dropdown group and keeps throwing dagger visible", () => {
    const templateGroups = buildInventoryTemplateGroups([
      createTemplate({
        category: "weapon",
        handlingClass: "one_handed",
        id: "weapon-template-longsword",
        name: "Long sword",
      }),
      createTemplate({
        category: "weapon",
        handlingClass: "missile",
        id: "weapon-template-composite-bow",
        name: "Composite bow",
      }),
      createTemplate({
        category: "weapon",
        handlingClass: "thrown",
        id: "weapon-template-t-th-dagger",
        name: "T. Th. dagger",
      }),
      createTemplate({
        category: "shield",
        id: "shield-template-medium-metal-shield",
        name: "Medium metal shield",
      }),
    ]);

    expect(templateGroups.map((group) => group.label)).toEqual([
      "Weapons",
      "Missile weapons",
      "Shields",
    ]);

    expect(
      templateGroups.find((group) => group.label === "Weapons")?.templates.map((template) =>
        getPlayerFacingEquipmentTemplateName(template),
      ),
    ).toEqual(["Long sword", "Throwing dagger"]);

    expect(
      templateGroups.find((group) => group.label === "Missile weapons")?.templates.map((template) =>
        getPlayerFacingEquipmentTemplateName(template),
      ),
    ).toEqual(["Composite bow"]);
  });

  it("filters template options by the requested structural category", () => {
    const templates = [
      createTemplate({
        attackModes: [{ id: "mode-3", label: "Throw" }] as never,
        category: "weapon",
        handlingClass: "one_handed",
        id: "weapon-template-dagger",
        name: "Dagger",
      }),
      createTemplate({
        category: "weapon",
        handlingClass: "missile",
        id: "weapon-template-composite-bow",
        name: "Composite bow",
        weaponClass: "bow",
      }),
      createTemplate({
        category: "armor",
        id: "armor-template-cloth",
        name: "Cloth",
      }),
      createTemplate({
        category: "gear",
        id: "gear-template-rope",
        name: "Rope",
      }),
      createTemplate({
        category: "valuables",
        id: "valuable-template-gold-coins",
        name: "Gold coins",
      }),
    ];

    expect(filterInventoryTemplateOptions(templates, "weapons").map((template) => template.name)).toEqual([]);
    expect(filterInventoryTemplateOptions(templates, "missile").map((template) => template.name)).toEqual(["Composite bow"]);
    expect(filterInventoryTemplateOptions(templates, "throwing").map((template) => template.name)).toEqual(["Dagger"]);
    expect(filterInventoryTemplateOptions(templates, "armor").map((template) => template.name)).toEqual(["Cloth"]);
    expect(filterInventoryTemplateOptions(templates, "gear").map((template) => template.name)).toEqual(["Rope"]);
    expect(filterInventoryTemplateOptions(templates, "valuables").map((template) => template.name)).toEqual(["Gold coins"]);
  });
});
