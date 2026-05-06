import type { ValuableTemplate } from "@glantri/domain/equipment";

export const valuableTemplates: ValuableTemplate[] = [
  {
    id: "valuable-template-gold-coins",
    category: "valuables",
    name: "Gold Coins",
    subtype: "coins",
    tags: ["valuables", "money", "coins", "gold"],
    specificityTypeDefault: "generic",
    defaultMaterial: "gold",
    baseEncumbrance: 0.02,
    baseValue: null,
    rulesNotes: "Standard high-value coinage carried in small purses or chests.",
    roleplayNotes: null,
  },
  {
    id: "valuable-template-silver-coins",
    category: "valuables",
    name: "Silver Coins",
    subtype: "coins",
    tags: ["valuables", "money", "coins", "silver"],
    specificityTypeDefault: "generic",
    defaultMaterial: "silver",
    baseEncumbrance: 0.02,
    baseValue: null,
    rulesNotes: "Common trade coinage for ordinary purchases and wages.",
    roleplayNotes: null,
  },
  {
    id: "valuable-template-gems",
    category: "valuables",
    name: "Gems",
    subtype: "gems",
    tags: ["valuables", "trade", "gems"],
    specificityTypeDefault: "generic",
    defaultMaterial: "stone",
    baseEncumbrance: 0.1,
    baseValue: null,
    rulesNotes: "Portable high-value stones packed for trade or safekeeping.",
    roleplayNotes: null,
  },
];

export const valuableTemplatesById = Object.fromEntries(
  valuableTemplates.map((template) => [template.id, template]),
);
