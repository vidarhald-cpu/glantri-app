export interface GlantriTermEntry {
  definition: string;
  id: string;
  implementationNote?: string;
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
    name: "Mechanical Type",
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
      "A training bundle that collects related skills and contributes shared advancement. Skill Groups are used for profession design, skill access, and training structure.",
    whereUsed: [
      "Professions and profession grants",
      "Admin Skill Groups review",
      "Chargen group allocation",
      "NPC template authoring",
      "Template authoring group selection"
    ]
  },
  {
    id: "skill-category",
    name: "Skill Category",
    definition:
      "A player-facing classification used for browsing, filtering, and displaying skills, such as Combat, Military, Maritime, or Knowledge. Skill Category is conceptually independent from Skill Group membership.",
    implementationNote:
      "Current behavior: Skill Category is now stored explicitly on canonical skill content as categoryId. Some helpers still keep a temporary fallback to primary-group inference for older data during the transition.",
    whereUsed: [
      "Chargen skill filter",
      "Character sheet grouping",
      "Template authoring filtering",
      "Player-facing skill browsing"
    ]
  },
  {
    id: "primary-group-membership",
    name: "Primary Skill Group Membership",
    definition:
      "The skill's main membership in the skill-group training structure. It defines the skill's structural identity in the training model.",
    implementationNote:
      "Current behavior: Primary Skill Group Membership remains the main structural placement for training and access. Some fallback helpers may still consult it when explicit categoryId is absent in older data, but it no longer conceptually defines Skill Category.",
    whereUsed: [
      "Canonical skill definitions",
      "Admin Skills review and inspector",
      "Group membership structure",
      "Template generation and suggestions"
    ]
  },
  {
    id: "secondary-group-membership",
    name: "Secondary Skill Group Membership",
    definition:
      "Additional memberships in other Skill Groups beyond the primary group. They represent alternative training contexts and access paths.",
    implementationNote:
      "Cross-listed group is still a useful synonym for current UI and content discussions, but Secondary Skill Group Membership is the preferred conceptual term.",
    whereUsed: [
      "Admin Skills review and inspector",
      "Group membership structure",
      "Template generation and suggestions",
      "Profession and society reach inspection"
    ]
  },
  {
    id: "primary-vs-optional-group",
    name: "Primary vs Optional Group",
    definition:
      "A relevance distinction inside profession and skill-group relationships. Core or primary groups define the main training package, while optional groups and memberships are common but not essential additions.",
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
