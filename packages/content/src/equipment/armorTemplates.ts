import type { ArmorTemplate } from "@glantri/domain/equipment";

export const armorTemplates: ArmorTemplate[] = [
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
    armorRating: 1,
    mobilityPenalty: 0,
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
    armorRating: 3,
    mobilityPenalty: 1,
    rulesNotes: "Heavier armor offering broader battlefield protection.",
    roleplayNotes: null
  }
];

export const armorTemplatesById = Object.fromEntries(
  armorTemplates.map((template) => [template.id, template])
);
