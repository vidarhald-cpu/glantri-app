import type { ShieldTemplate } from "@glantri/domain/equipment";

export const shieldTemplates: ShieldTemplate[] = [
  {
    id: "shield-template-buckler",
    category: "shield",
    name: "Buckler",
    subtype: "buckler",
    tags: ["shield", "light", "defense"],
    specificityTypeDefault: "generic",
    defaultMaterial: "wood",
    baseEncumbrance: 4,
    baseValue: null,
    shieldBonus: 1,
    defensiveValue: 1,
    rulesNotes: "Small shield for quick parrying.",
    roleplayNotes: null
  },
  {
    id: "shield-template-round-shield",
    category: "shield",
    name: "Round Shield",
    subtype: "round",
    tags: ["shield", "medium", "defense"],
    specificityTypeDefault: "generic",
    defaultMaterial: "wood",
    baseEncumbrance: 7,
    baseValue: null,
    shieldBonus: 2,
    defensiveValue: 2,
    rulesNotes: "Common field shield with solid coverage.",
    roleplayNotes: null
  }
];

export const shieldTemplatesById = Object.fromEntries(
  shieldTemplates.map((template) => [template.id, template])
);
