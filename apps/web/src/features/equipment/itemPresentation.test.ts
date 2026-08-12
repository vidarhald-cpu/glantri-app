import { describe, expect, it } from "vitest";
import { CanonicalEquipmentItemSchema } from "@glantri/domain/equipment";
import { equipmentTemplatesById } from "@glantri/content/equipment";

import { buildItemPresentationSections } from "./itemPresentation";

describe("campaign item presentation", () => {
  it("keeps standard differences, active mechanics, description, and unsupported rules distinct", () => {
    const template = equipmentTemplatesById["weapon-template-fencing-sword"];
    expect(template).toBeDefined();
    const item = CanonicalEquipmentItemSchema.parse({
      campaignContextId: "campaign-1",
      category: "weapon",
      characterId: "character-1",
      conditionState: "intact",
      holderCharacterId: "character-1",
      id: "item-1",
      isStackable: false,
      itemFacts: {
        activeMechanics: [
          { id: "ob", kind: "final_attack_ob_delta", value: 1, visibility: "revealed" },
        ],
        descriptiveTraits: [
          { category: "engraving", id: "mark", text: "House Silverston", visibility: "revealed" },
        ],
        templateOverrides: [
          {
            id: "initiative",
            kind: "weapon_initiative_override",
            value: 1,
            visibility: "revealed",
          },
        ],
        unsupportedCapabilities: [
          {
            id: "spell",
            name: "Guiding light",
            rulesText: "Glows on command",
            usageText: "Once per day",
            visibility: "revealed",
          },
        ],
        version: 1,
      },
      material: "steel",
      quality: "standard",
      quantity: 1,
      specificityType: "specific",
      storageAssignment: { carryMode: "on_person", locationId: "character-1:loc-person" },
      templateId: template!.id,
    });

    expect(buildItemPresentationSections(item, template!).map((section) => section.title)).toEqual([
      "Differences from standard",
      "Active mechanics",
      "Descriptive traits",
      "Recorded capabilities — not calculated or tracked by the app",
    ]);
    expect(buildItemPresentationSections(item, template!)[0]?.entries[0]?.label).toContain(
      "standard",
    );
  });
});
