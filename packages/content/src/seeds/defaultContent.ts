import { validateCanonicalContent } from "../validators";

import type { CanonicalContent } from "../types";

export const defaultCanonicalContent = validateCanonicalContent({
  skillGroups: [
    {
      id: "martial",
      name: "Martial",
      description: "Combat and fieldcraft fundamentals.",
      sortOrder: 1
    },
    {
      id: "social",
      name: "Social",
      description: "Status, etiquette, and negotiation.",
      sortOrder: 2
    },
    {
      id: "scholarly",
      name: "Scholarly",
      description: "Formal study, record-keeping, and lore.",
      sortOrder: 3
    }
  ],
  skills: [
    {
      id: "melee",
      groupId: "martial",
      name: "Melee",
      description: "Armed close combat.",
      linkedStats: ["str", "dex"],
      isTheoretical: false,
      category: "ordinary",
      requiresLiteracy: "no",
      sortOrder: 1,
      allowsSpecializations: true
    },
    {
      id: "etiquette",
      groupId: "social",
      name: "Etiquette",
      description: "Customs, manners, and social navigation.",
      linkedStats: ["cha", "int"],
      isTheoretical: true,
      category: "ordinary",
      requiresLiteracy: "recommended",
      sortOrder: 2,
      allowsSpecializations: false
    },
    {
      id: "lore",
      groupId: "scholarly",
      name: "Lore",
      description: "Study and recall of written knowledge.",
      linkedStats: ["int", "int"],
      isTheoretical: true,
      category: "ordinary",
      requiresLiteracy: "required",
      sortOrder: 3,
      allowsSpecializations: true
    },
    {
      id: "literacy",
      groupId: "scholarly",
      name: "Literacy",
      description: "Reading and writing.",
      linkedStats: ["int", "int"],
      isTheoretical: true,
      category: "secondary",
      requiresLiteracy: "no",
      sortOrder: 4,
      allowsSpecializations: false
    },
    {
      id: "appraisal",
      groupId: "social",
      name: "Appraisal",
      description: "Estimating quality and value.",
      linkedStats: ["int", "int"],
      isTheoretical: true,
      category: "secondary",
      requiresLiteracy: "recommended",
      sortOrder: 5,
      allowsSpecializations: false
    }
  ],
  specializations: [
    {
      id: "blades",
      skillId: "melee",
      name: "Blades",
      description: "Focused training with swords and long knives.",
      minimumGroupLevel: 11,
      sortOrder: 1
    },
    {
      id: "polearms",
      skillId: "melee",
      name: "Polearms",
      description: "Specialized reach and formation fighting.",
      minimumGroupLevel: 11,
      sortOrder: 2
    },
    {
      id: "history",
      skillId: "lore",
      name: "History",
      description: "Academic focus on records, chronologies, and precedent.",
      minimumGroupLevel: 11,
      sortOrder: 3
    }
  ],
  professions: [
    {
      id: "soldier",
      name: "Soldier",
      description: "A practical martial path available across most social strata."
    },
    {
      id: "merchant",
      name: "Merchant",
      description: "Trade, travel, and negotiation."
    },
    {
      id: "scribe",
      name: "Scribe",
      description: "Literacy, records, and formal study."
    }
  ],
  professionSkills: [
    {
      professionId: "soldier",
      grantType: "group",
      skillGroupId: "martial",
      ranks: 1,
      isCore: true
    },
    {
      professionId: "soldier",
      grantType: "group",
      skillGroupId: "social",
      ranks: 0,
      isCore: false
    },
    {
      professionId: "soldier",
      grantType: "ordinary-skill",
      skillId: "melee",
      ranks: 2,
      isCore: true
    },
    {
      professionId: "merchant",
      grantType: "group",
      skillGroupId: "social",
      ranks: 1,
      isCore: true
    },
    {
      professionId: "merchant",
      grantType: "group",
      skillGroupId: "martial",
      ranks: 0,
      isCore: false
    },
    {
      professionId: "merchant",
      grantType: "group",
      skillGroupId: "scholarly",
      // REVIEW_FLAG: Merchant currently has a scholarly-group foothold to make the demo specialization/secondary-pool path reachable. Revisit this after broader content and profession balancing so the final content model is not shaped by demo-path constraints.
      ranks: 1,
      isCore: false
    },
    {
      professionId: "merchant",
      grantType: "ordinary-skill",
      skillId: "etiquette",
      ranks: 2,
      isCore: true
    },
    {
      professionId: "merchant",
      grantType: "secondary-skill",
      skillId: "appraisal",
      ranks: 2,
      isCore: true
    },
    {
      professionId: "scribe",
      grantType: "group",
      skillGroupId: "scholarly",
      ranks: 1,
      isCore: true
    },
    {
      professionId: "scribe",
      grantType: "group",
      skillGroupId: "social",
      ranks: 0,
      isCore: false
    },
    {
      professionId: "scribe",
      grantType: "ordinary-skill",
      skillId: "lore",
      ranks: 2,
      isCore: true
    },
    {
      professionId: "scribe",
      grantType: "secondary-skill",
      skillId: "literacy",
      ranks: 2,
      isCore: true
    }
  ],
  societyLevels: [
    {
      societyId: "scandia",
      societyLevel: 1,
      societyName: "Scandia",
      baseEducation: 1,
      classRollTableId: "scandia_social_class_v1",
      socialClass: "Bønder",
      professionIds: ["soldier"],
      skillGroupIds: ["martial"],
      notes: "Only available society at present."
    },
    {
      societyId: "scandia",
      societyLevel: 2,
      societyName: "Scandia",
      baseEducation: 1,
      classRollTableId: "scandia_social_class_v1",
      socialClass: "Håndverkere",
      professionIds: ["soldier", "merchant"],
      skillGroupIds: ["martial", "social"],
      notes: "Craft and trade paths open up."
    },
    {
      societyId: "scandia",
      societyLevel: 3,
      societyName: "Scandia",
      baseEducation: 1,
      classRollTableId: "scandia_social_class_v1",
      socialClass: "Storbønder",
      professionIds: ["soldier", "merchant", "scribe"],
      skillGroupIds: ["martial", "social", "scholarly"],
      notes: "Higher-status education and scholarly access broaden."
    },
    {
      societyId: "scandia",
      societyLevel: 4,
      societyName: "Scandia",
      baseEducation: 1,
      classRollTableId: "scandia_social_class_v1",
      socialClass: "Adelen",
      professionIds: ["soldier", "merchant", "scribe"],
      skillGroupIds: ["martial", "social", "scholarly"],
      notes: "Highest-status Scandian band."
    }
  ]
} satisfies CanonicalContent);
