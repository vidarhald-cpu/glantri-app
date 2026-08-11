import { describe, expect, it } from "vitest";
import { CanonicalEquipmentItemSchema, type WeaponTemplate } from "@glantri/domain";

import { projectEquipmentItem } from "./projectEquipmentItem";

const fencingSwordTemplate: WeaponTemplate = {
  baseEncumbrance: 1,
  category: "weapon",
  defaultMaterial: "steel",
  handlingClass: "one_handed",
  id: "weapon-template-fencing-sword",
  initiative: 2,
  name: "Fencing sword",
  specificityTypeDefault: "generic",
  tags: [],
  weaponClass: "fencing sword",
  weaponSkill: "Fencing",
};

function silverstonSword() {
  return CanonicalEquipmentItemSchema.parse({
    campaignContextId: "campaign-glantri",
    category: "weapon",
    characterId: "character-themistogenes",
    conditionState: "intact",
    holderCharacterId: "character-themistogenes",
    id: "item-silverston-sword",
    isEquipped: true,
    isStackable: false,
    itemFacts: {
      activeMechanics: [
        {
          id: "silverston-ob",
          kind: "final_attack_ob_delta",
          value: 1,
          visibility: "revealed",
        },
      ],
      descriptiveTraits: [
        {
          category: "engraving",
          id: "silverston-engraving",
          text: "Arms of House Silverston",
          visibility: "revealed",
        },
      ],
      templateOverrides: [
        {
          id: "silverston-initiative",
          kind: "weapon_initiative_override",
          value: 1,
          visibility: "revealed",
        },
      ],
      unsupportedCapabilities: [
        {
          id: "silverston-capability",
          name: "Call the house oath",
          rulesText: "Cast X once per day",
          visibility: "gm_only",
        },
      ],
      version: 1,
    },
    material: "steel",
    quality: "extraordinary",
    quantity: 1,
    specificityType: "specific",
    storageAssignment: {
      carryMode: "equipped",
      locationId: "character-themistogenes:loc-equipped",
    },
    templateId: fencingSwordTemplate.id,
  });
}

describe("projectEquipmentItem", () => {
  it("projects initiative 2 to 1 and keeps +1 final attack OB separate", () => {
    const templateBefore = structuredClone(fencingSwordTemplate);
    const first = projectEquipmentItem(silverstonSword(), fencingSwordTemplate);
    const second = projectEquipmentItem(silverstonSword(), fencingSwordTemplate);

    expect(first).toEqual(second);
    expect(first.templateCharacteristics).toEqual([
      expect.objectContaining({
        characteristic: "weapon_initiative",
        effectiveValue: 1,
        provenance: {
          factId: "silverston-initiative",
          itemId: "item-silverston-sword",
          origin: "item_override",
        },
        templateValue: 2,
      }),
    ]);
    expect(first.activeContributions).toEqual([
      expect.objectContaining({
        calculationStage: "final_attack_ob",
        kind: "final_attack_ob_delta",
        provenance: {
          factId: "silverston-ob",
          itemId: "item-silverston-sword",
        },
        value: 1,
      }),
    ]);
    expect(first.descriptiveTraits[0]).toMatchObject({
      supportState: "descriptive_only",
    });
    expect(first.unsupportedCapabilities[0]).toMatchObject({
      supportState: "not_calculated_by_app",
    });
    expect(fencingSwordTemplate).toEqual(templateBefore);
  });
});
