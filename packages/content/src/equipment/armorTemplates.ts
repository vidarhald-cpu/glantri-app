import type { EquipmentTemplate } from "@glantri/domain/equipment";

export const armorTemplates: EquipmentTemplate[] = [
  {
    id: "armor-template-leather-jerkin",
    category: "armor",
    name: "Leather Jerkin",
    subtype: "light-armor",
    tags: ["armor", "light", "leather"],
    specificityTypeDefault: "generic",
    defaultMaterial: "leather",
    baseEncumbrance: 12,
    baseValue: null,
    rulesNotes: "Light torso protection for travel and skirmish work.",
    roleplayNotes: null
  },
  {
    id: "armor-template-mail-hauberk",
    category: "armor",
    name: "Mail Hauberk",
    subtype: "mail",
    tags: ["armor", "medium", "mail"],
    specificityTypeDefault: "generic",
    defaultMaterial: "steel",
    baseEncumbrance: 24,
    baseValue: null,
    rulesNotes: "Heavier armor offering broader battlefield protection.",
    roleplayNotes: null
  }
];

export const armorTemplatesById = Object.fromEntries(
  armorTemplates.map((template) => [template.id, template])
);
