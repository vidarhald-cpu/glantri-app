export interface GlantriTermEntry {
  definition: string;
  id: string;
  name: string;
  whereUsed: string[];
}

export const glantriTerms: GlantriTermEntry[] = [
  {
    id: "skill",
    name: "Skill",
    definition:
      "A learnable capability node in the Glantri rules graph. Skills carry linked stats, society level, dependency rules, and a mechanical type such as ordinary or secondary.",
    whereUsed: [
      "Chargen skill browsing and allocation",
      "Admin Skills review and editing",
      "Template authoring skill selection",
      "Character sheet summaries"
    ]
  },
  {
    id: "skill-type",
    name: "Skill Type",
    definition:
      "The mechanical kind of skill entry. Use Type for values such as ordinary, secondary, and specialization when they are rendered in the UI.",
    whereUsed: [
      "Admin Skills editor",
      "Skill matrix filters and grouping",
      "Template authoring skill-type filter",
      "Skill review tables"
    ]
  },
  {
    id: "skill-group",
    name: "Skill Group",
    definition:
      "A training bundle that collects related skills and contributes shared advancement. Professions grant groups, and skills belong to one primary group with optional cross-list memberships.",
    whereUsed: [
      "Admin Skill Groups review",
      "Profession grant inspection",
      "Chargen group allocation",
      "Template authoring group selection"
    ]
  },
  {
    id: "skill-category",
    name: "Skill Category",
    definition:
      "A player-facing domain grouping such as Combat, Military, Maritime, or Knowledge. Skill category is derived from the skill's primary skill group and is separate from mechanical Type.",
    whereUsed: [
      "Chargen other-skills filter",
      "Player-facing skill browsing",
      "Future documentation and search terminology"
    ]
  },
  {
    id: "primary-vs-optional-group",
    name: "Primary vs Optional Group",
    definition:
      "A relevance distinction inside profession and skill-group relationships. Primary or core groups define the main training package, while optional groups and memberships are common but not essential additions.",
    whereUsed: [
      "Profession review surfaces",
      "Skill group memberships",
      "Template authoring suggestions",
      "NPC archetype guidance"
    ]
  },
  {
    id: "profession",
    name: "Profession",
    definition:
      "A family-plus-subtype role definition that grants skill groups, direct skills, and society access expectations. Profession fit usually guides access and suggestions rather than hard-blocking them.",
    whereUsed: [
      "Chargen profession selection",
      "Admin Professions review",
      "Society access inspection",
      "Template authoring setup"
    ]
  },
  {
    id: "society-level",
    name: "Society Level",
    definition:
      "A 1-6 civilization scale used for society definitions and skill availability. Society Level is not the same thing as the social access bands used in society-class rows.",
    whereUsed: [
      "Societies admin review",
      "Skill availability metadata",
      "Template authoring society cards",
      "Overview aggregate terminology"
    ]
  },
  {
    id: "social-band",
    name: "Social Band",
    definition:
      "The L1-L4 social access band used in society access rows and profession availability. Social Band is distinct from Society Level and should only describe class/access slots.",
    whereUsed: [
      "Society access rows",
      "Profession access overview matrix",
      "Societies admin review and audit"
    ]
  }
];

export function getGlantriTermById(id: string): GlantriTermEntry | undefined {
  return glantriTerms.find((term) => term.id === id);
}
