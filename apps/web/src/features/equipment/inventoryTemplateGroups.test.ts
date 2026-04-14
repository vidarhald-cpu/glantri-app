import { describe, expect, it } from "vitest";
import type { EquipmentTemplate } from "@glantri/domain";

import { buildInventoryTemplateGroups } from "./inventoryTemplateGroups";
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
});
