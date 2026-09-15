import { describe, expect, it } from "vitest";
import { CanonicalEquipmentItemSchema } from "@glantri/domain/equipment";
import { equipmentTemplatesById } from "@glantri/content/equipment";

import { buildItemPresentationSections } from "./itemPresentation";

describe("campaign item presentation", () => {
  it("marks recorded initiative and final attack OB facts as reference-only", () => {
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
      "Recorded values — not applied by the app",
      "Descriptive traits",
      "Recorded capabilities — not calculated or tracked by the app",
    ]);
    const sections = buildItemPresentationSections(item, template!);
    expect(sections[0]?.entries[0]).toMatchObject({
      detail: "Recorded for reference only. The app does not apply it to initiative.",
      label: "Recorded initiative 1 (standard 1)",
    });
    expect(sections[1]?.entries[0]).toMatchObject({
      detail: "Recorded for reference only. The app does not apply it to attack OB.",
      label: "Recorded final attack OB +1",
    });
  });

  it("presents Disarm-only overrides by kind without inventing initiative text", () => {
    const template = equipmentTemplatesById["weapon-template-rapier"]!;
    const item = CanonicalEquipmentItemSchema.parse({
      campaignContextId: "campaign-1",
      category: "weapon",
      characterId: null,
      conditionState: "intact",
      holderCharacterId: null,
      id: "item-disarm",
      isStackable: false,
      itemFacts: {
        activeMechanics: [],
        descriptiveTraits: [],
        templateOverrides: [
          {
            id: "capability",
            kind: "weapon_disarm_capability_override",
            value: "none",
            visibility: "gm_only",
          },
          {
            id: "control",
            kind: "weapon_disarm_control_override",
            value: 4,
            visibility: "revealed",
          },
        ],
        unsupportedCapabilities: [],
        version: 1,
      },
      material: "steel",
      quality: "standard",
      quantity: 1,
      specificityType: "specific",
      storageAssignment: null,
      templateId: template.id,
    });

    const labels = buildItemPresentationSections(item, template)[0]?.entries.map(
      (entry) => entry.label,
    );
    expect(labels).toEqual(["Disarm capability None", "Disarm control rating 4"]);
    expect(labels?.join(" ")).not.toContain("Initiative");
  });
});
