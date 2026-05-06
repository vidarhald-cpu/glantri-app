import { describe, expect, it } from "vitest";

import { defaultCanonicalContent, validateCanonicalContent } from "@glantri/content";
import {
  allocateChargenPoint,
  applyProfessionGrants,
  buildChargenDraftView,
  buildChargenSelectableSkillSummary,
  buildChargenSkillAccessSummary,
  createChargenProgression,
  evaluateSkillSelection,
  removeChargenPoint
} from "@glantri/rules-engine";
import { getPlayerFacingSkillBucket } from "../../../src/lib/chargen/chargenBrowse";

import {
  buildConcreteLanguageBrowseRows,
  getGroupScopedSkillAllocationMetrics,
  getSkillAllocationMetrics,
  getSkillDisplayGroupId,
  getGroupSlotCandidateSkillIds,
  getSpecializationRowMessages,
  getSpecializationPurchaseState
} from "./ChargenWizard";

const combatContent = {
  civilizations: [],
  languages: [],
  professionFamilies: [{ id: "warrior", name: "Warrior" }],
  professionSkills: [
    {
      grantType: "group",
      isCore: true,
      professionId: "warrior",
      scope: "family",
      skillGroupId: "advanced_melee_training"
    }
  ],
  professions: [{ familyId: "warrior", id: "captain", name: "Captain", subtypeName: "Captain" }],
  skillGroups: [
    {
      id: "advanced_melee_training",
      name: "Advanced Melee Training",
      selectionSlots: [
        {
          candidateSkillIds: ["sword", "axe", "spear", "mace"],
          chooseCount: 3,
          id: "advanced_melee_weapons",
          label: "Choose three melee weapon skills",
          required: true
        }
      ],
      skillMemberships: [
        { relevance: "core", skillId: "dodge" },
        { relevance: "core", skillId: "parry" },
        { relevance: "core", skillId: "brawling" }
      ],
      sortOrder: 1
    }
  ],
  skills: [
    {
      allowsSpecializations: false,
      category: "ordinary" as const,
      dependencies: [],
      dependencySkillIds: [],
      groupId: "advanced_melee_training",
      groupIds: ["advanced_melee_training"],
      id: "dodge",
      isTheoretical: false,
      linkedStats: ["dex"],
      name: "Dodge",
      requiresLiteracy: "no" as const,
      societyLevel: 1,
      sortOrder: 1
    },
    {
      allowsSpecializations: false,
      category: "ordinary" as const,
      dependencies: [],
      dependencySkillIds: [],
      groupId: "advanced_melee_training",
      groupIds: ["advanced_melee_training"],
      id: "parry",
      isTheoretical: false,
      linkedStats: ["dex"],
      name: "Parry",
      requiresLiteracy: "no" as const,
      societyLevel: 1,
      sortOrder: 2
    },
    {
      allowsSpecializations: false,
      category: "ordinary" as const,
      dependencies: [],
      dependencySkillIds: [],
      groupId: "advanced_melee_training",
      groupIds: ["advanced_melee_training"],
      id: "brawling",
      isTheoretical: false,
      linkedStats: ["str"],
      name: "Brawling",
      requiresLiteracy: "no" as const,
      societyLevel: 1,
      sortOrder: 3
    },
    {
      allowsSpecializations: false,
      category: "ordinary" as const,
      dependencies: [],
      dependencySkillIds: [],
      groupId: "advanced_melee_training",
      groupIds: ["advanced_melee_training"],
      id: "sword",
      isTheoretical: false,
      linkedStats: ["dex"],
      name: "Sword",
      requiresLiteracy: "no" as const,
      societyLevel: 1,
      sortOrder: 4
    },
    {
      allowsSpecializations: false,
      category: "ordinary" as const,
      dependencies: [],
      dependencySkillIds: [],
      groupId: "advanced_melee_training",
      groupIds: ["advanced_melee_training"],
      id: "axe",
      isTheoretical: false,
      linkedStats: ["dex"],
      name: "Axe",
      requiresLiteracy: "no" as const,
      societyLevel: 1,
      sortOrder: 5
    },
    {
      allowsSpecializations: false,
      category: "ordinary" as const,
      dependencies: [],
      dependencySkillIds: [],
      groupId: "advanced_melee_training",
      groupIds: ["advanced_melee_training"],
      id: "spear",
      isTheoretical: false,
      linkedStats: ["dex"],
      name: "Spear",
      requiresLiteracy: "no" as const,
      societyLevel: 1,
      sortOrder: 6
    },
    {
      allowsSpecializations: false,
      category: "ordinary" as const,
      dependencies: [],
      dependencySkillIds: [],
      groupId: "advanced_melee_training",
      groupIds: ["advanced_melee_training"],
      id: "mace",
      isTheoretical: false,
      linkedStats: ["dex"],
      name: "Mace",
      requiresLiteracy: "no" as const,
      societyLevel: 1,
      sortOrder: 7
    }
  ],
  societies: [],
  societyLevels: [
    {
      professionIds: ["captain"],
      skillGroupIds: ["advanced_melee_training"],
      skillIds: [],
      socialClass: "Common",
      societyId: "glantri",
      societyLevel: 1,
      societyName: "Glantri"
    },
    {
      professionIds: ["captain"],
      skillGroupIds: ["advanced_melee_training"],
      skillIds: [],
      socialClass: "Guild",
      societyId: "glantri",
      societyLevel: 2,
      societyName: "Glantri"
    },
    {
      professionIds: ["captain"],
      skillGroupIds: ["advanced_melee_training"],
      skillIds: [],
      socialClass: "Patrician",
      societyId: "glantri",
      societyLevel: 3,
      societyName: "Glantri"
    },
    {
      professionIds: ["captain"],
      skillGroupIds: ["advanced_melee_training"],
      skillIds: [],
      socialClass: "Noble",
      societyId: "glantri",
      societyLevel: 4,
      societyName: "Glantri"
    }
  ],
  societyBandSkillAccess: [],
  specializations: []
};

const overlappingProfessionContent = {
  civilizations: [],
  languages: [],
  professionFamilies: [{ id: "scout_family", name: "Scout" }],
  professionSkills: [
    {
      grantType: "group",
      isCore: true,
      professionId: "scout_family",
      scope: "family",
      skillGroupId: "fieldcraft"
    },
    {
      grantType: "skill",
      isCore: true,
      professionId: "scout_family",
      scope: "family",
      skillId: "stealth"
    }
  ],
  professions: [
    { familyId: "scout_family", id: "pathfinder", name: "Pathfinder", subtypeName: "Pathfinder" }
  ],
  skillGroups: [{ id: "fieldcraft", name: "Fieldcraft", skillMemberships: [], sortOrder: 1 }],
  skills: [
    {
      allowsSpecializations: false,
      category: "ordinary" as const,
      dependencies: [],
      dependencySkillIds: [],
      groupId: "fieldcraft",
      groupIds: ["fieldcraft"],
      id: "stealth",
      isTheoretical: false,
      linkedStats: ["dex"],
      name: "Stealth",
      requiresLiteracy: "no" as const,
      societyLevel: 1,
      sortOrder: 1
    },
    {
      allowsSpecializations: false,
      category: "ordinary" as const,
      dependencies: [],
      dependencySkillIds: [],
      groupId: "fieldcraft",
      groupIds: ["fieldcraft"],
      id: "tracking",
      isTheoretical: false,
      linkedStats: ["int"],
      name: "Tracking",
      requiresLiteracy: "no" as const,
      societyLevel: 1,
      sortOrder: 2
    }
  ],
  societies: [],
  societyLevels: [
    {
      professionIds: ["pathfinder"],
      skillGroupIds: ["fieldcraft"],
      skillIds: [],
      socialClass: "Common",
      societyId: "glantri",
      societyLevel: 1,
      societyName: "Glantri"
    },
    {
      professionIds: ["pathfinder"],
      skillGroupIds: ["fieldcraft"],
      skillIds: [],
      socialClass: "Guild",
      societyId: "glantri",
      societyLevel: 2,
      societyName: "Glantri"
    },
    {
      professionIds: ["pathfinder"],
      skillGroupIds: ["fieldcraft"],
      skillIds: [],
      socialClass: "Patrician",
      societyId: "glantri",
      societyLevel: 3,
      societyName: "Glantri"
    },
    {
      professionIds: ["pathfinder"],
      skillGroupIds: ["fieldcraft"],
      skillIds: [],
      socialClass: "Noble",
      societyId: "glantri",
      societyLevel: 4,
      societyName: "Glantri"
    }
  ],
  societyBandSkillAccess: [],
  specializations: []
};

const canonicalLanguages = [
  { id: "common_language", name: "Common", sourceSocietyId: "glantri" },
  { id: "old_common_language", name: "Old Common", sourceSocietyId: "glantri" },
  { id: "phoenician_language", name: "Phoenician", sourceSocietyId: "glantri" }
];

const languageContent = {
  civilizations: [
    {
      historicalAnalogue: "Test analogue",
      id: "glantri_civ",
      linkedSocietyId: "glantri",
      linkedSocietyLevel: 1,
      motherTongueLanguageName: "Phoenician",
      name: "Glantri",
      optionalLanguageNames: ["Common", "Old Common"],
      period: "Test period",
      shortDescription: "Test civilization",
      spokenLanguageName: "Phoenician",
      writtenLanguageName: "Phoenician"
    }
  ],
  languages: canonicalLanguages,
  professionFamilies: [{ id: "scholar", name: "Scholar" }],
  professionSkills: [],
  professions: [{ familyId: "scholar", id: "scribe", name: "Scribe", subtypeName: "Scribe" }],
  skillGroups: [{ id: "scholarly", name: "Scholarly", sortOrder: 1 }],
  skills: [
    {
      allowsSpecializations: false,
      category: "ordinary" as const,
      categoryId: "language",
      dependencies: [],
      dependencySkillIds: [],
      groupId: "scholarly",
      groupIds: ["scholarly"],
      id: "literacy",
      isTheoretical: false,
      linkedStats: ["int"],
      name: "Literacy",
      requiresLiteracy: "no" as const,
      societyLevel: 1,
      sortOrder: 1
    },
    {
      allowsSpecializations: false,
      category: "ordinary" as const,
      categoryId: "language",
      dependencies: [],
      dependencySkillIds: [],
      groupId: "scholarly",
      groupIds: ["scholarly"],
      id: "language",
      isTheoretical: false,
      linkedStats: ["int"],
      name: "Language",
      requiresLiteracy: "no" as const,
      societyLevel: 1,
      sortOrder: 2
    }
  ],
  societies: [
    {
      baselineLanguageIds: ["phoenician_language"],
      id: "glantri",
      name: "Glantri",
      shortDescription: "Test society",
      societyLevel: 1
    }
  ],
  societyLevels: [
    {
      professionIds: ["scribe"],
      skillGroupIds: ["scholarly"],
      skillIds: [],
      socialClass: "Common",
      societyId: "glantri",
      societyLevel: 1,
      societyName: "Glantri"
    },
    {
      professionIds: ["scribe"],
      skillGroupIds: ["scholarly"],
      skillIds: [],
      socialClass: "Guild",
      societyId: "glantri",
      societyLevel: 2,
      societyName: "Glantri"
    },
    {
      professionIds: ["scribe"],
      skillGroupIds: ["scholarly"],
      skillIds: [],
      socialClass: "Patrician",
      societyId: "glantri",
      societyLevel: 3,
      societyName: "Glantri"
    },
    {
      professionIds: ["scribe"],
      skillGroupIds: ["scholarly"],
      skillIds: [],
      socialClass: "Noble",
      societyId: "glantri",
      societyLevel: 4,
      societyName: "Glantri"
    }
  ],
  societyBandSkillAccess: [],
  specializations: []
};

const languageProfile = {
  distractionLevel: 0,
  id: "profile-linguist",
  label: "Linguist",
  rolledStats: {
    cha: 10,
    com: 10,
    con: 10,
    dex: 10,
    health: 10,
    int: 10,
    lck: 10,
    pow: 10,
    siz: 10,
    str: 10,
    will: 10
  },
  socialClassEducationValue: 12,
  societyLevel: 0 as const
};

const commonMotherTongueLanguageContent = {
  ...languageContent,
  civilizations: [
    {
      historicalAnalogue: "Test analogue",
      id: "glantri_common_civ",
      linkedSocietyId: "glantri",
      linkedSocietyLevel: 1,
      motherTongueLanguageName: "Common",
      name: "Common Tongue Glantri",
      optionalLanguageNames: ["Old Common"],
      period: "Test period",
      shortDescription: "Test civilization",
      spokenLanguageName: "Common",
      writtenLanguageName: "Common"
    }
  ],
  languages: canonicalLanguages,
  societies: [
    {
      baselineLanguageIds: ["common_language"],
      id: "glantri",
      name: "Glantri",
      shortDescription: "Test society",
      societyLevel: 1
    }
  ]
};

const education11LanguageProfile = {
  ...languageProfile,
  socialClassEducationValue: 11
};

const hiddenOtherSkillContent = {
  civilizations: [],
  languages: [],
  professionFamilies: [{ id: "courtier_family", name: "Courtier" }],
  professionSkills: [],
  professions: [
    { familyId: "courtier_family", id: "attendant", name: "Attendant", subtypeName: "Attendant" }
  ],
  skillGroups: [{ id: "courtly", name: "Courtly", sortOrder: 1 }],
  skills: [
    {
      allowsSpecializations: false,
      category: "ordinary" as const,
      categoryId: "social" as const,
      dependencies: [],
      dependencySkillIds: [],
      groupId: "courtly",
      groupIds: ["courtly"],
      id: "etiquette",
      isTheoretical: false,
      linkedStats: ["com"],
      name: "Etiquette",
      requiresLiteracy: "no" as const,
      societyLevel: 1,
      sortOrder: 1
    }
  ],
  societies: [],
  societyLevels: [
    {
      professionIds: ["attendant"],
      skillGroupIds: [],
      skillIds: [],
      socialClass: "Common",
      societyId: "glantri",
      societyLevel: 1,
      societyName: "Glantri"
    },
    {
      professionIds: ["attendant"],
      skillGroupIds: ["courtly"],
      skillIds: [],
      socialClass: "Guild",
      societyId: "glantri",
      societyLevel: 2,
      societyName: "Glantri"
    },
    {
      professionIds: ["attendant"],
      skillGroupIds: ["courtly"],
      skillIds: [],
      socialClass: "Patrician",
      societyId: "glantri",
      societyLevel: 3,
      societyName: "Glantri"
    },
    {
      professionIds: ["attendant"],
      skillGroupIds: ["courtly"],
      skillIds: [],
      socialClass: "Noble",
      societyId: "glantri",
      societyLevel: 4,
      societyName: "Glantri"
    }
  ],
  societyBandSkillAccess: [],
  specializations: []
};

const directGrantedSkillContent = {
  civilizations: [],
  languages: [],
  professionFamilies: [{ id: "envoy_family", name: "Envoy" }],
  professionSkills: [
    {
      grantType: "skill" as const,
      isCore: true,
      professionId: "envoy_family",
      scope: "family" as const,
      skillId: "etiquette"
    }
  ],
  professions: [{ familyId: "envoy_family", id: "envoy", name: "Envoy", subtypeName: "Envoy" }],
  skillGroups: [{ id: "courtly", name: "Courtly", sortOrder: 1 }],
  skills: [
    {
      allowsSpecializations: false,
      category: "ordinary" as const,
      categoryId: "social" as const,
      dependencies: [],
      dependencySkillIds: [],
      groupId: "courtly",
      groupIds: ["courtly"],
      id: "etiquette",
      isTheoretical: false,
      linkedStats: ["com"],
      name: "Etiquette",
      requiresLiteracy: "no" as const,
      societyLevel: 1,
      sortOrder: 1
    }
  ],
  societies: [],
  societyLevels: [
    {
      professionIds: ["envoy"],
      skillGroupIds: [],
      skillIds: [],
      socialClass: "Common",
      societyId: "glantri",
      societyLevel: 1,
      societyName: "Glantri"
    },
    {
      professionIds: ["envoy"],
      skillGroupIds: [],
      skillIds: [],
      socialClass: "Guild",
      societyId: "glantri",
      societyLevel: 2,
      societyName: "Glantri"
    },
    {
      professionIds: ["envoy"],
      skillGroupIds: [],
      skillIds: [],
      socialClass: "Patrician",
      societyId: "glantri",
      societyLevel: 3,
      societyName: "Glantri"
    },
    {
      professionIds: ["envoy"],
      skillGroupIds: [],
      skillIds: [],
      socialClass: "Noble",
      societyId: "glantri",
      societyLevel: 4,
      societyName: "Glantri"
    }
  ],
  societyBandSkillAccess: [],
  specializations: []
};

const overlappingOfficerTrainingContent = {
  civilizations: [],
  languages: [],
  professionFamilies: [{ id: "officer_family", name: "Officer" }],
  professionSkills: [
    {
      grantType: "group" as const,
      isCore: true,
      professionId: "officer_family",
      scope: "family" as const,
      skillGroupId: "officer_training"
    }
  ],
  professions: [
    { familyId: "officer_family", id: "officer", name: "Officer", subtypeName: "Officer" }
  ],
  skillGroups: [
    { id: "basic_awareness", name: "Basic Awareness", sortOrder: 1 },
    { id: "officer_training", name: "Officer Training", sortOrder: 2 }
  ],
  skills: [
    {
      allowsSpecializations: false,
      category: "ordinary" as const,
      categoryId: "military" as const,
      dependencies: [],
      dependencySkillIds: [],
      groupId: "basic_awareness",
      groupIds: ["basic_awareness", "officer_training"],
      id: "perception",
      isTheoretical: false,
      linkedStats: ["int"],
      name: "Perception",
      requiresLiteracy: "no" as const,
      societyLevel: 1,
      sortOrder: 1
    },
    {
      allowsSpecializations: false,
      category: "ordinary" as const,
      categoryId: "military" as const,
      dependencies: [],
      dependencySkillIds: [],
      groupId: "officer_training",
      groupIds: ["officer_training"],
      id: "tactics",
      isTheoretical: false,
      linkedStats: ["int"],
      name: "Tactics",
      requiresLiteracy: "no" as const,
      societyLevel: 1,
      sortOrder: 2
    },
    {
      allowsSpecializations: false,
      category: "ordinary" as const,
      categoryId: "military" as const,
      dependencies: [],
      dependencySkillIds: [],
      groupId: "officer_training",
      groupIds: ["officer_training"],
      id: "captaincy",
      isTheoretical: false,
      linkedStats: ["pow"],
      name: "Captaincy",
      requiresLiteracy: "no" as const,
      societyLevel: 1,
      sortOrder: 3
    }
  ],
  societies: [],
  societyLevels: [
    {
      professionIds: ["officer"],
      skillGroupIds: ["officer_training"],
      skillIds: [],
      socialClass: "Common",
      societyId: "glantri",
      societyLevel: 1,
      societyName: "Glantri"
    },
    {
      professionIds: ["officer"],
      skillGroupIds: ["officer_training"],
      skillIds: [],
      socialClass: "Guild",
      societyId: "glantri",
      societyLevel: 2,
      societyName: "Glantri"
    },
    {
      professionIds: ["officer"],
      skillGroupIds: ["officer_training"],
      skillIds: [],
      socialClass: "Patrician",
      societyId: "glantri",
      societyLevel: 3,
      societyName: "Glantri"
    },
    {
      professionIds: ["officer"],
      skillGroupIds: ["officer_training"],
      skillIds: [],
      socialClass: "Noble",
      societyId: "glantri",
      societyLevel: 4,
      societyName: "Glantri"
    }
  ],
  societyBandSkillAccess: [],
  specializations: []
};

function createProgressionWithOtherSkillCandidate() {
  return {
    ...createChargenProgression()
  };
}

function getOtherSkillIds(input: {
  content: Parameters<typeof getSkillDisplayGroupId>[0]["content"];
  draftView: ReturnType<typeof buildChargenDraftView>;
  professionId: string;
  societyId: string;
  societyLevel: number;
}): string[] {
  const skillAccess = buildChargenSkillAccessSummary({
    content: input.content,
    professionId: input.professionId,
    societyId: input.societyId,
    societyLevel: input.societyLevel
  });

  return input.content.skills
    .filter(
      (skill) =>
        skill.id !== "language" &&
        getSkillDisplayGroupId({
          content: input.content,
          draftView: input.draftView,
          skill,
          skillAccess
        }) === undefined &&
        !skillAccess.normalSkillIds.includes(skill.id)
    )
    .map((skill) => skill.id);
}

describe("ChargenWizard combat allocation runtime helpers", () => {
  it("does not double-count cross-trained melee skills that already have group XP", () => {
    const meleeDerivedContent = validateCanonicalContent({
      civilizations: [],
      languages: [],
      professionFamilies: [{ id: "warrior", name: "Warrior" }],
      professionSkills: [
        {
          grantType: "group",
          isCore: true,
          professionId: "warrior",
          scope: "family",
          skillGroupId: "combat_group"
        }
      ],
      professions: [{ familyId: "warrior", id: "soldier", name: "Soldier", subtypeName: "Soldier" }],
      skillGroups: [{ id: "combat_group", name: "Combat", sortOrder: 1 }],
      skills: [
        {
          allowsSpecializations: false,
          category: "ordinary",
          dependencies: [],
          dependencySkillIds: [],
          groupId: "combat_group",
          groupIds: ["combat_group"],
          id: "one_handed_edged",
          linkedStats: ["dex"],
          meleeCrossTraining: {
            attackStyle: "slash",
            handClass: "one-handed"
          },
          name: "1-h edged",
          requiresLiteracy: "no",
          sortOrder: 1
        },
        {
          allowsSpecializations: false,
          category: "ordinary",
          dependencies: [],
          dependencySkillIds: [],
          groupId: "combat_group",
          groupIds: ["combat_group"],
          id: "two_handed_edged",
          linkedStats: ["dex"],
          meleeCrossTraining: {
            attackStyle: "slash",
            handClass: "two-handed"
          },
          name: "2-h edged",
          requiresLiteracy: "no",
          sortOrder: 2
        }
      ],
      societies: [],
      societyLevels: [
        {
          professionIds: ["soldier"],
          skillGroupIds: ["combat_group"],
          skillIds: [],
          socialClass: "Common",
          societyId: "glantri",
          societyLevel: 1,
          societyName: "Glantri"
        },
        {
          professionIds: ["soldier"],
          skillGroupIds: ["combat_group"],
          skillIds: [],
          socialClass: "Guild",
          societyId: "glantri",
          societyLevel: 2,
          societyName: "Glantri"
        },
        {
          professionIds: ["soldier"],
          skillGroupIds: ["combat_group"],
          skillIds: [],
          socialClass: "Patrician",
          societyId: "glantri",
          societyLevel: 3,
          societyName: "Glantri"
        },
        {
          professionIds: ["soldier"],
          skillGroupIds: ["combat_group"],
          skillIds: [],
          socialClass: "Noble",
          societyId: "glantri",
          societyLevel: 4,
          societyName: "Glantri"
        }
      ],
      specializations: []
    });
    const progression = createChargenProgression();
    progression.skillGroups = [
      {
        gms: 0,
        grantedRanks: 0,
        groupId: "combat_group",
        primaryRanks: 10,
        ranks: 10,
        secondaryRanks: 0
      }
    ];

    const draftView = buildChargenDraftView({
      content: meleeDerivedContent,
      professionId: "soldier",
      progression,
      societyId: "glantri",
      societyLevel: 1
    });

    expect(draftView.skills.find((skill) => skill.skillId === "two_handed_edged")).toMatchObject({
      effectiveSkillNumber: 10,
      relationshipGrantedSkillLevel: 0,
      relationshipSourceSkillName: undefined
    });
  });

  it("keeps Fencing purchasable when flexible points remain and a bridge grant preview is present", () => {
    const bridgeContent = validateCanonicalContent({
      skillGroups: [
        {
          id: "combat_group",
          name: "Combat",
          sortOrder: 1
        }
      ],
      skills: [
        {
          allowsSpecializations: true,
          category: "ordinary",
          dependencies: [],
          dependencySkillIds: [],
          groupId: "combat_group",
          groupIds: ["combat_group"],
          id: "one_handed_edged",
          linkedStats: ["dex"],
          name: "1-h edged",
          requiresLiteracy: "no",
          sortOrder: 1
        }
      ],
      specializations: [
        {
          id: "fencing",
          minimumGroupLevel: 6,
          minimumParentLevel: 6,
          name: "Fencing",
          skillId: "one_handed_edged",
          sortOrder: 1,
          specializationBridge: {
            parentExcessOffset: 5,
            parentSkillId: "one_handed_edged",
            reverseFactor: 1,
            threshold: 6
          }
        }
      ],
      professionFamilies: [{ id: "warrior", name: "Warrior" }],
      professionSkills: [],
      professions: [{ familyId: "warrior", id: "soldier", name: "Soldier", subtypeName: "Soldier" }],
      societies: [],
      societyBandSkillAccess: [],
      societyLevels: [
        {
          professionIds: ["soldier"],
          skillGroupIds: ["combat_group"],
          skillIds: [],
          socialClass: "Common",
          societyId: "glantri",
          societyLevel: 1,
          societyName: "Glantri"
        },
        {
          professionIds: [],
          skillGroupIds: [],
          skillIds: [],
          socialClass: "Common",
          societyId: "glantri",
          societyLevel: 2,
          societyName: "Glantri"
        },
        {
          professionIds: [],
          skillGroupIds: [],
          skillIds: [],
          socialClass: "Common",
          societyId: "glantri",
          societyLevel: 3,
          societyName: "Glantri"
        },
        {
          professionIds: [],
          skillGroupIds: [],
          skillIds: [],
          socialClass: "Common",
          societyId: "glantri",
          societyLevel: 4,
          societyName: "Glantri"
        }
      ]
    });
    const profile = {
      distractionLevel: 0,
      id: "profile-fencer",
      label: "Fencer",
      rolledStats: {
        cha: 10,
        com: 10,
        con: 10,
        dex: 10,
        health: 10,
        int: 20,
        lck: 13,
        pow: 10,
        siz: 10,
        str: 10,
        will: 10
      },
      societyLevel: 0
    };
    const progression = createChargenProgression();
    progression.skillGroups = [
      {
        gms: 0,
        grantedRanks: 0,
        groupId: "combat_group",
        primaryRanks: 6,
        ranks: 6,
        secondaryRanks: 0
      }
    ];
    const draftView = buildChargenDraftView({
      content: bridgeContent,
      professionId: "soldier",
      profile,
      progression,
      societyId: "glantri",
      societyLevel: 1
    });
    const purchaseState = getSpecializationPurchaseState({
      skillAllocationContext: {
        content: bridgeContent,
        professionId: "soldier",
        profile,
        progression,
        societyId: "glantri",
        societyLevel: 1
      },
      specializationId: "fencing"
    });

    expect(draftView.secondaryPoolAvailable).toBe(33);
    expect(draftView.specializations.find((item) => item.specializationId === "fencing")).toMatchObject({
      relationshipGrantedPreviewLevel: 1
    });
    expect(purchaseState).toMatchObject({
      canAllocate: true,
      nextCost: 4
    });
  });

  it("surfaces the real specialization blocker text instead of the legacy society-level wording", () => {
    const content = validateCanonicalContent({
      skillGroups: [
        {
          id: "surgery_group",
          name: "Surgery Group",
          sortOrder: 1
        }
      ],
      skills: [
        {
          allowsSpecializations: true,
          category: "ordinary",
          dependencies: [],
          dependencySkillIds: [],
          groupId: "surgery_group",
          groupIds: ["surgery_group"],
          id: "medicine",
          linkedStats: ["int"],
          name: "Medicine",
          requiresLiteracy: "no",
          sortOrder: 1
        },
        {
          allowsSpecializations: false,
          category: "ordinary",
          dependencies: [],
          dependencySkillIds: [],
          groupId: "surgery_group",
          groupIds: ["surgery_group"],
          id: "first_aid",
          linkedStats: ["int"],
          name: "First Aid",
          requiresLiteracy: "no",
          sortOrder: 2
        }
      ],
      specializations: [
        {
          id: "surgery",
          minimumGroupLevel: 6,
          minimumParentLevel: 6,
          name: "Surgery",
          skillId: "medicine",
          sortOrder: 1
        }
      ],
      professionFamilies: [{ id: "scholar", name: "Scholar" }],
      professionSkills: [],
      professions: [{ familyId: "scholar", id: "physician", name: "Physician", subtypeName: "Physician" }],
      societies: [],
      societyBandSkillAccess: [],
      societyLevels: [
        {
          professionIds: ["physician"],
          skillGroupIds: [],
          skillIds: [],
          socialClass: "Common",
          societyId: "glantri",
          societyLevel: 1,
          societyName: "Glantri"
        },
        {
          professionIds: [],
          skillGroupIds: [],
          skillIds: [],
          socialClass: "Common",
          societyId: "glantri",
          societyLevel: 2,
          societyName: "Glantri"
        },
        {
          professionIds: [],
          skillGroupIds: [],
          skillIds: [],
          socialClass: "Common",
          societyId: "glantri",
          societyLevel: 3,
          societyName: "Glantri"
        },
        {
          professionIds: [],
          skillGroupIds: [],
          skillIds: [],
          socialClass: "Common",
          societyId: "glantri",
          societyLevel: 4,
          societyName: "Glantri"
        }
      ]
    });
    const progression = createChargenProgression();
    progression.skills = [
      {
        category: "ordinary",
        grantedRanks: 0,
        groupId: "surgery_group",
        level: 6,
        primaryRanks: 0,
        ranks: 6,
        relationshipGrantedRanks: 0,
        secondaryRanks: 6,
        skillId: "medicine"
      }
    ];

    const purchaseState = getSpecializationPurchaseState({
      skillAllocationContext: {
        content,
        professionId: "physician",
        profile: undefined,
        progression,
        societyId: "glantri",
        societyLevel: 1
      },
      specializationId: "surgery"
    });

    expect(purchaseState).toMatchObject({
      canAllocate: false,
      previewMessage: "This specialization is outside the current society/profession access for its parent skill."
    });
  });

  it("shows one coherent bridge gate message for blocked specialization rows without duplicating the live blocker", () => {
    const bridgeContent = validateCanonicalContent({
      skillGroups: [{ id: "combat_group", name: "Combat", sortOrder: 1 }],
      skills: [
        {
          allowsSpecializations: true,
          category: "ordinary",
          dependencies: [],
          dependencySkillIds: [],
          groupId: "combat_group",
          groupIds: ["combat_group"],
          id: "one_handed_edged",
          linkedStats: ["dex"],
          name: "1-h edged",
          requiresLiteracy: "no",
          sortOrder: 1
        }
      ],
      specializations: [
        {
          id: "fencing",
          minimumGroupLevel: 6,
          minimumParentLevel: 6,
          name: "Fencing",
          skillId: "one_handed_edged",
          sortOrder: 1,
          specializationBridge: {
            parentExcessOffset: 5,
            parentSkillId: "one_handed_edged",
            reverseFactor: 1,
            threshold: 6
          }
        }
      ],
      professionFamilies: [{ id: "warrior", name: "Warrior" }],
      professionSkills: [],
      professions: [{ familyId: "warrior", id: "soldier", name: "Soldier", subtypeName: "Soldier" }],
      societies: [],
      societyBandSkillAccess: [],
      societyLevels: [
        {
          professionIds: ["soldier"],
          skillGroupIds: ["combat_group"],
          skillIds: [],
          socialClass: "Common",
          societyId: "glantri",
          societyLevel: 1,
          societyName: "Glantri"
        },
        { professionIds: [], skillGroupIds: [], skillIds: [], socialClass: "Common", societyId: "glantri", societyLevel: 2, societyName: "Glantri" },
        { professionIds: [], skillGroupIds: [], skillIds: [], socialClass: "Common", societyId: "glantri", societyLevel: 3, societyName: "Glantri" },
        { professionIds: [], skillGroupIds: [], skillIds: [], socialClass: "Common", societyId: "glantri", societyLevel: 4, societyName: "Glantri" }
      ]
    });
    const progression = createChargenProgression();
    progression.skillGroups = [
      {
        gms: 0,
        grantedRanks: 0,
        groupId: "combat_group",
        primaryRanks: 5,
        ranks: 5,
        secondaryRanks: 0
      }
    ];

    const evaluation = evaluateSkillSelection({
      content: bridgeContent,
      progression,
      target: {
        specialization: bridgeContent.specializations[0]!,
        targetType: "specialization"
      }
    });
    const purchaseState = getSpecializationPurchaseState({
      skillAllocationContext: {
        content: bridgeContent,
        professionId: "soldier",
        profile: languageProfile,
        progression,
        societyId: "glantri",
        societyLevel: 1
      },
      specializationId: "fencing"
    });

    const rowMessages = getSpecializationRowMessages({
      evaluation,
      persistedRowFeedback: "Fencing requires 1-h edged level 6 or higher (current 5).",
      purchaseState
    });

    expect(rowMessages.feedback).toBeUndefined();
    expect(rowMessages.statusItems).toHaveLength(1);
    expect(rowMessages.statusItems[0]?.message).toBe(
      "Fencing requires 1-h edged level 6 or higher (current 5)."
    );
  });

  it("collapses duplicate specialization requirement text even when it arrives through multiple rule channels", () => {
    const rowMessages = getSpecializationRowMessages({
      evaluation: {
        advisories: [],
        blockingReasons: [
          {
            code: "missing-specialization-parent-skill",
            message: "Augury requires Omen Reading."
          }
        ],
        isAllowed: false,
        warnings: [
          {
            code: "missing-required-dependency",
            message: "Augury requires Omen Reading."
          }
        ]
      },
      persistedRowFeedback: "Augury requires Omen Reading.",
      purchaseState: {
        canAllocate: false,
        previewMessage: undefined
      }
    });

    expect(rowMessages.feedback).toBeUndefined();
    expect(rowMessages.statusItems.map((item) => item.message)).toEqual([
      "Augury requires Omen Reading."
    ]);
  });

  it("suppresses overlapping dependency text when a bridge skill already explains the parent requirement", () => {
    const longbowContent = validateCanonicalContent({
      skillGroups: [{ id: "missile_group", name: "Missile", sortOrder: 1 }],
      skills: [
        {
          allowsSpecializations: false,
          category: "ordinary",
          dependencies: [],
          dependencySkillIds: [],
          groupId: "missile_group",
          groupIds: ["missile_group"],
          id: "bow",
          linkedStats: ["dex"],
          name: "Bow",
          requiresLiteracy: "no",
          sortOrder: 1
        },
        {
          allowsSpecializations: false,
          category: "ordinary",
          dependencies: [],
          dependencySkillIds: [],
          groupId: "missile_group",
          groupIds: ["missile_group"],
          id: "crossbow",
          linkedStats: ["dex"],
          name: "Crossbow",
          requiresLiteracy: "no",
          sortOrder: 2
        },
        {
          allowsSpecializations: false,
          category: "ordinary",
          dependencies: [{ skillId: "bow", strength: "helpful" }],
          dependencySkillIds: ["bow"],
          groupId: "missile_group",
          groupIds: ["missile_group"],
          id: "longbow",
          linkedStats: ["dex"],
          name: "Longbow",
          requiresLiteracy: "no",
          sortOrder: 3,
          specializationOfSkillId: "bow"
        }
      ],
      specializations: [
        {
          id: "longbow",
          minimumGroupLevel: 6,
          minimumParentLevel: 6,
          name: "Longbow",
          skillId: "bow",
          sortOrder: 1,
          specializationBridge: {
            parentExcessOffset: 5,
            parentSkillId: "bow",
            reverseFactor: 1,
            threshold: 6
          }
        }
      ],
      professionFamilies: [{ id: "warrior", name: "Warrior" }],
      professionSkills: [],
      professions: [{ familyId: "warrior", id: "archer", name: "Archer", subtypeName: "Archer" }],
      societies: [],
      societyBandSkillAccess: [],
      societyLevels: [
        {
          professionIds: ["archer"],
          skillGroupIds: ["missile_group"],
          skillIds: [],
          socialClass: "Common",
          societyId: "glantri",
          societyLevel: 1,
          societyName: "Glantri"
        },
        { professionIds: [], skillGroupIds: [], skillIds: [], socialClass: "Common", societyId: "glantri", societyLevel: 2, societyName: "Glantri" },
        { professionIds: [], skillGroupIds: [], skillIds: [], socialClass: "Common", societyId: "glantri", societyLevel: 3, societyName: "Glantri" },
        { professionIds: [], skillGroupIds: [], skillIds: [], socialClass: "Common", societyId: "glantri", societyLevel: 4, societyName: "Glantri" }
      ]
    });

    const rowMessages = getSpecializationRowMessages({
      evaluation: evaluateSkillSelection({
        content: longbowContent,
        progression: createChargenProgression(),
        target: {
          specialization: longbowContent.specializations.find(
            (specialization) => specialization.id === "longbow"
          )!,
          targetType: "specialization"
        }
      }),
      persistedRowFeedback: undefined,
      purchaseState: {
        canAllocate: false,
        previewMessage: undefined
      }
    });

    expect(rowMessages.feedback).toBeUndefined();
    expect(rowMessages.statusItems.map((item) => item.message)).toEqual([
      "Longbow requires Bow."
    ]);
  });

  it("only assigns combat group rows to fixed skills plus selected slot weapons", () => {
    const draftView = buildChargenDraftView({
      content: combatContent,
      professionId: "captain",
      progression: {
        ...createChargenProgression(),
        chargenSelections: {
          selectedLanguageIds: [],
          selectedGroupSlots: [
            {
              groupId: "advanced_melee_training",
              selectedSkillIds: ["sword", "axe", "spear"],
              slotId: "advanced_melee_weapons"
            }
          ],
          selectedSkillIds: []
        },
        skillGroups: [
          {
            gms: 0,
            grantedRanks: 0,
            groupId: "advanced_melee_training",
            primaryRanks: 2,
            ranks: 2,
            secondaryRanks: 0
          }
        ]
      },
      societyId: "glantri",
      societyLevel: 1
    });
    const skillAccess = buildChargenSkillAccessSummary({
      content: combatContent,
      professionId: "captain",
      societyId: "glantri",
      societyLevel: 1
    });

    const displayGroupIds = Object.fromEntries(
      combatContent.skills.map((skill) => [
        skill.id,
        getSkillDisplayGroupId({
          content: combatContent,
          draftView,
          skill,
          skillAccess
        })
      ])
    );

    expect(displayGroupIds).toEqual({
      axe: "advanced_melee_training",
      brawling: "advanced_melee_training",
      dodge: "advanced_melee_training",
      mace: undefined,
      parry: "advanced_melee_training",
      spear: "advanced_melee_training",
      sword: "advanced_melee_training"
    });
  });

  it("keeps fixed combat group skills visible before a weapon slot is selected", () => {
    const draftView = buildChargenDraftView({
      content: combatContent,
      professionId: "captain",
      progression: createChargenProgression(),
      societyId: "glantri",
      societyLevel: 1
    });
    const skillAccess = buildChargenSkillAccessSummary({
      content: combatContent,
      professionId: "captain",
      societyId: "glantri",
      societyLevel: 1
    });

    const displayGroupIds = Object.fromEntries(
      combatContent.skills.map((skill) => [
        skill.id,
        getSkillDisplayGroupId({
          content: combatContent,
          draftView,
          skill,
          skillAccess
        })
      ])
    );

    expect(displayGroupIds).toEqual({
      axe: undefined,
      brawling: "advanced_melee_training",
      dodge: "advanced_melee_training",
      mace: undefined,
      parry: "advanced_melee_training",
      spear: undefined,
      sword: undefined
    });
  });

  it("uses materialized draft rows for group xp instead of recomputing all candidate groups", () => {
    const draftView = buildChargenDraftView({
      content: combatContent,
      professionId: "captain",
      progression: {
        ...createChargenProgression(),
        chargenSelections: {
          selectedLanguageIds: [],
          selectedGroupSlots: [
            {
              groupId: "advanced_melee_training",
              selectedSkillIds: ["sword", "axe", "spear"],
              slotId: "advanced_melee_weapons"
            }
          ],
          selectedSkillIds: []
        },
        skillGroups: [
          {
            gms: 0,
            grantedRanks: 0,
            groupId: "advanced_melee_training",
            primaryRanks: 2,
            ranks: 2,
            secondaryRanks: 0
          }
        ]
      },
      societyId: "glantri",
      societyLevel: 1
    });
    const sword = combatContent.skills.find((skill) => skill.id === "sword");
    const mace = combatContent.skills.find((skill) => skill.id === "mace");

    expect(sword).toBeDefined();
    expect(mace).toBeDefined();

    const swordMetrics = getSkillAllocationMetrics({
      content: combatContent,
      draftView,
      profile: undefined,
      skill: sword!
    });
    const maceMetrics = getSkillAllocationMetrics({
      content: combatContent,
      draftView,
      profile: undefined,
      skill: mace!
    });

    expect(swordMetrics.groupXp).toBeGreaterThan(0);
    expect(swordMetrics.totalXp).toBe(swordMetrics.groupXp);
    expect(maceMetrics.groupXp).toBe(0);
    expect(maceMetrics.totalXp).toBe(0);
  });
});

describe("ChargenWizard profession-group display priority", () => {
  it("prefers a visible profession group over duplicated direct special-access display", () => {
    const draftView = buildChargenDraftView({
      content: overlappingProfessionContent,
      professionId: "pathfinder",
      progression: createChargenProgression(),
      societyId: "glantri",
      societyLevel: 1
    });
    const skillAccess = buildChargenSkillAccessSummary({
      content: overlappingProfessionContent,
      professionId: "pathfinder",
      societyId: "glantri",
      societyLevel: 1
    });
    const stealth = overlappingProfessionContent.skills.find((skill) => skill.id === "stealth");

    expect(stealth).toBeDefined();

    const stealthDisplayGroupId = getSkillDisplayGroupId({
      content: overlappingProfessionContent,
      draftView,
      skill: stealth!,
      skillAccess
    });

    const additionalAllowedSkills = overlappingProfessionContent.skills.filter(
      (skill) =>
        skillAccess.normalSkillIds.includes(skill.id) &&
        getSkillDisplayGroupId({
          content: overlappingProfessionContent,
          draftView,
          skill,
          skillAccess
        }) === undefined
    );
    const fieldcraftGroupSkillIds = overlappingProfessionContent.skills
      .filter(
        (skill) =>
          getSkillDisplayGroupId({
            content: overlappingProfessionContent,
            draftView,
            skill,
            skillAccess
          }) === "fieldcraft"
      )
      .map((skill) => skill.id);

    expect(stealthDisplayGroupId).toBe("fieldcraft");
    expect(fieldcraftGroupSkillIds).toContain("stealth");
    expect(additionalAllowedSkills.map((skill) => skill.id)).not.toContain("stealth");
  });

  it("keeps unselected weapon slot candidates out of direct skill display rows", () => {
    const lightInfantryRow = defaultCanonicalContent.societyLevels.find((societyLevel) =>
      societyLevel.professionIds.includes("light_infantry") &&
      societyLevel.skillGroupIds.includes("basic_missile_training") &&
      societyLevel.skillGroupIds.includes("basic_melee_training")
    );

    expect(lightInfantryRow).toBeDefined();

    const buildDirectSkillIds = (progression = createChargenProgression()) => {
      const draftView = buildChargenDraftView({
        content: defaultCanonicalContent,
        professionId: "light_infantry",
        progression,
        societyId: lightInfantryRow!.societyId,
        societyLevel: lightInfantryRow!.societyLevel
      });
      const skillAccess = buildChargenSkillAccessSummary({
        content: defaultCanonicalContent,
        professionId: "light_infantry",
        societyId: lightInfantryRow!.societyId,
        societyLevel: lightInfantryRow!.societyLevel
      });
      const selectableSkillSummary = buildChargenSelectableSkillSummary({
        content: defaultCanonicalContent,
        professionId: "light_infantry",
        progression,
        societyId: lightInfantryRow!.societyId,
        societyLevel: lightInfantryRow!.societyLevel
      });
      const groupSlotCandidateSkillIds = getGroupSlotCandidateSkillIds(
        selectableSkillSummary
      );

      return defaultCanonicalContent.skills
        .filter(
          (skill) =>
            skillAccess.normalSkillIds.includes(skill.id) &&
            !groupSlotCandidateSkillIds.has(skill.id) &&
            getSkillDisplayGroupId({
              content: defaultCanonicalContent,
              draftView,
              skill,
              skillAccess
            }) === undefined
        )
        .map((skill) => skill.id);
    };

    const unselectedDirectSkillIds = buildDirectSkillIds(
      applyProfessionGrants({
        content: defaultCanonicalContent,
        professionId: "light_infantry"
      })
    );
    const unselectedSummary = buildChargenSelectableSkillSummary({
      content: defaultCanonicalContent,
      professionId: "light_infantry",
      progression: applyProfessionGrants({
        content: defaultCanonicalContent,
        professionId: "light_infantry"
      }),
      societyId: lightInfantryRow!.societyId,
      societyLevel: lightInfantryRow!.societyLevel
    });
    const missileSlot = unselectedSummary.selectionSlots.find(
      (slot) => slot.groupId === "basic_missile_training"
    );

    expect(missileSlot?.candidateSkillIds).toEqual(["throwing", "sling", "bow", "crossbow"]);
    expect(missileSlot?.candidateSkillIds).not.toContain("longbow");
    expect(unselectedDirectSkillIds).not.toContain("one_handed_edged");
    expect(unselectedDirectSkillIds).not.toContain("polearms");
    expect(unselectedDirectSkillIds).not.toContain("throwing");
    expect(unselectedDirectSkillIds).not.toContain("bow");
    expect(unselectedDirectSkillIds).not.toContain("longbow");
    expect(unselectedDirectSkillIds).not.toContain("crossbow");

    const selectedProgression = applyProfessionGrants({
      content: defaultCanonicalContent,
      professionId: "light_infantry"
    });
    const selectedSlotProgression = {
      ...selectedProgression,
      chargenSelections: {
        selectedLanguageIds: [],
        selectedSkillIds: [],
        selectedGroupSlots: [
          {
            groupId: "basic_missile_training",
            selectedSkillIds: ["bow"],
            slotId: "missile_weapon_choice"
          },
          {
            groupId: "basic_melee_training",
            selectedSkillIds: ["polearms"],
            slotId: "melee_weapon_choice"
          }
        ]
      }
    };
    const selectedDraftView = buildChargenDraftView({
      content: defaultCanonicalContent,
      professionId: "light_infantry",
      progression: selectedSlotProgression,
      societyId: lightInfantryRow!.societyId,
      societyLevel: lightInfantryRow!.societyLevel
    });
    const selectedSkillAccess = buildChargenSkillAccessSummary({
      content: defaultCanonicalContent,
      professionId: "light_infantry",
      societyId: lightInfantryRow!.societyId,
      societyLevel: lightInfantryRow!.societyLevel
    });
    const bow = defaultCanonicalContent.skills.find((skill) => skill.id === "bow");
    const polearms = defaultCanonicalContent.skills.find((skill) => skill.id === "polearms");
    const selectedSummary = buildChargenSelectableSkillSummary({
      content: defaultCanonicalContent,
      professionId: "light_infantry",
      progression: selectedSlotProgression,
      societyId: lightInfantryRow!.societyId,
      societyLevel: lightInfantryRow!.societyLevel
    });
    const selectedGroupSkillIdsFor = (groupId: string) => {
      const selectedGroupSlotSkillIds = new Set(
        selectedSummary.selectionSlots
          .filter((slot) => slot.groupId === groupId)
          .flatMap((slot) => slot.selectedSkillIds)
      );

      return defaultCanonicalContent.skills
        .filter(
          (skill) =>
            getSkillDisplayGroupId({
              content: defaultCanonicalContent,
              draftView: selectedDraftView,
              skill,
              skillAccess: selectedSkillAccess
            }) === groupId || selectedGroupSlotSkillIds.has(skill.id)
        )
        .map((skill) => skill.id);
    };

    expect(bow).toBeDefined();
    expect(polearms).toBeDefined();
    expect(selectedGroupSkillIdsFor("basic_missile_training")).toContain("bow");
    expect(selectedGroupSkillIdsFor("basic_melee_training")).toContain("polearms");
    expect(buildDirectSkillIds(selectedSlotProgression)).not.toContain("bow");
    expect(buildDirectSkillIds(selectedSlotProgression)).not.toContain("polearms");
  });

  it("renders slot-only craft specialty groups in profession sections", () => {
    const findProfessionRow = (professionId: string, groupId: string) => {
      const row = defaultCanonicalContent.societyLevels.find(
        (societyLevel) =>
          societyLevel.professionIds.includes(professionId) &&
          societyLevel.skillGroupIds.includes(groupId)
      );

      expect(row).toBeDefined();

      return row!;
    };
    const visibleProfessionGroupIdsFor = (professionId: string, groupId: string) => {
      const row = findProfessionRow(professionId, groupId);
      const skillAccess = buildChargenSkillAccessSummary({
        content: defaultCanonicalContent,
        professionId,
        societyId: row.societyId,
        societyLevel: row.societyLevel
      });

      return defaultCanonicalContent.skillGroups
        .filter((group) => skillAccess.normalSkillGroupIds.includes(group.id))
        .filter(
          (group) =>
            getPlayerFacingSkillBucket({
              id: group.id,
              groupId: group.id,
              groupIds: [group.id]
            }) !== "special-access"
        )
        .map((group) => group.id);
    };

    expect(getPlayerFacingSkillBucket({
      id: "craft_specialty",
      groupId: "craft_specialty",
      groupIds: ["craft_specialty"]
    })).toBe("craft");
    expect(getPlayerFacingSkillBucket({
      id: "craft_specialty_advanced",
      groupId: "craft_specialty_advanced",
      groupIds: ["craft_specialty_advanced"]
    })).toBe("craft");
    expect(getPlayerFacingSkillBucket({
      id: "construction_specialty",
      groupId: "construction_specialty",
      groupIds: ["construction_specialty"]
    })).toBe("craft");

    expect(visibleProfessionGroupIdsFor("crafter", "craft_specialty")).toContain(
      "craft_specialty"
    );
    expect(visibleProfessionGroupIdsFor("master_craftsmen", "craft_specialty_advanced")).toContain(
      "craft_specialty_advanced"
    );
    expect(visibleProfessionGroupIdsFor("builder_master_mason", "construction_specialty")).toContain(
      "construction_specialty"
    );
  });

  it("keeps craft slot candidates in their group choices instead of direct skill rows", () => {
    const masterCraftsmenRow = defaultCanonicalContent.societyLevels.find(
      (societyLevel) =>
        societyLevel.professionIds.includes("master_craftsmen") &&
        societyLevel.skillGroupIds.includes("craft_specialty_advanced")
    );

    expect(masterCraftsmenRow).toBeDefined();

    const buildDirectSkillIds = (progression = createChargenProgression()) => {
      const draftView = buildChargenDraftView({
        content: defaultCanonicalContent,
        professionId: "master_craftsmen",
        progression,
        societyId: masterCraftsmenRow!.societyId,
        societyLevel: masterCraftsmenRow!.societyLevel
      });
      const skillAccess = buildChargenSkillAccessSummary({
        content: defaultCanonicalContent,
        professionId: "master_craftsmen",
        societyId: masterCraftsmenRow!.societyId,
        societyLevel: masterCraftsmenRow!.societyLevel
      });
      const selectableSkillSummary = buildChargenSelectableSkillSummary({
        content: defaultCanonicalContent,
        professionId: "master_craftsmen",
        progression,
        societyId: masterCraftsmenRow!.societyId,
        societyLevel: masterCraftsmenRow!.societyLevel
      });
      const groupSlotCandidateSkillIds = getGroupSlotCandidateSkillIds(selectableSkillSummary);

      return defaultCanonicalContent.skills
        .filter(
          (skill) =>
            skillAccess.normalSkillIds.includes(skill.id) &&
            !groupSlotCandidateSkillIds.has(skill.id) &&
            getSkillDisplayGroupId({
              content: defaultCanonicalContent,
              draftView,
              skill,
              skillAccess
            }) === undefined
        )
        .map((skill) => skill.id);
    };
    const professionProgression = applyProfessionGrants({
      content: defaultCanonicalContent,
      professionId: "master_craftsmen"
    });
    const selectableSkillSummary = buildChargenSelectableSkillSummary({
      content: defaultCanonicalContent,
      professionId: "master_craftsmen",
      progression: professionProgression,
      societyId: masterCraftsmenRow!.societyId,
      societyLevel: masterCraftsmenRow!.societyLevel
    });
    const advancedCraftSlot = selectableSkillSummary.selectionSlots.find(
      (slot) => slot.groupId === "craft_specialty_advanced"
    );

    expect(advancedCraftSlot).toMatchObject({
      chooseCount: 1,
      groupName: "Advanced Craft Specialty",
      required: true
    });
    expect(advancedCraftSlot?.candidateSkillIds).toEqual(
      expect.arrayContaining(["carpentry", "smithing", "stoneworking", "weaving"])
    );
    expect(buildDirectSkillIds(professionProgression)).not.toEqual(
      expect.arrayContaining(["carpentry", "smithing", "stoneworking", "weaving"])
    );

    const selectedSlotProgression = {
      ...professionProgression,
      chargenSelections: {
        selectedLanguageIds: [],
        selectedSkillIds: [],
        selectedGroupSlots: [
          {
            groupId: "craft_specialty_advanced",
            selectedSkillIds: ["smithing"],
            slotId: "advanced_craft_specialty_choices"
          }
        ]
      }
    };
    const selectedDraftView = buildChargenDraftView({
      content: defaultCanonicalContent,
      professionId: "master_craftsmen",
      progression: selectedSlotProgression,
      societyId: masterCraftsmenRow!.societyId,
      societyLevel: masterCraftsmenRow!.societyLevel
    });
    const selectedSkillAccess = buildChargenSkillAccessSummary({
      content: defaultCanonicalContent,
      professionId: "master_craftsmen",
      societyId: masterCraftsmenRow!.societyId,
      societyLevel: masterCraftsmenRow!.societyLevel
    });
    const selectedSummary = buildChargenSelectableSkillSummary({
      content: defaultCanonicalContent,
      professionId: "master_craftsmen",
      progression: selectedSlotProgression,
      societyId: masterCraftsmenRow!.societyId,
      societyLevel: masterCraftsmenRow!.societyLevel
    });
    const selectedGroupSlotSkillIds = new Set(
      selectedSummary.selectionSlots
        .filter((slot) => slot.groupId === "craft_specialty_advanced")
        .flatMap((slot) => slot.selectedSkillIds)
    );
    const selectedAdvancedCraftSkillIds = defaultCanonicalContent.skills
      .filter(
        (skill) =>
          getSkillDisplayGroupId({
            content: defaultCanonicalContent,
            draftView: selectedDraftView,
            skill,
            skillAccess: selectedSkillAccess
          }) === "craft_specialty_advanced" ||
          selectedGroupSlotSkillIds.has(skill.id)
      )
      .map((skill) => skill.id);

    expect(selectedAdvancedCraftSkillIds).toEqual(
      expect.arrayContaining(["smithing"])
    );
    expect(selectedAdvancedCraftSkillIds).not.toContain("carpentry");
    expect(buildDirectSkillIds(selectedSlotProgression)).not.toEqual(
      expect.arrayContaining(["carpentry", "smithing"])
    );
  });
});

describe("ChargenWizard concrete language rows", () => {
  it("builds all canonical languages as concrete buyable Language rows", () => {
    const draftView = buildChargenDraftView({
      civilizationId: "glantri_civ",
      content: languageContent,
      professionId: "scribe",
      profile: languageProfile,
      progression: createChargenProgression(),
      societyId: "glantri",
      societyLevel: 1
    });

    const rows = buildConcreteLanguageBrowseRows({
      content: { ...languageContent, languages: canonicalLanguages },
      draftView,
      profile: undefined,
      progression: createChargenProgression()
    });
    expect(rows.map((row) => row.displayName)).toEqual([
      "Language (Common)",
      "Language (Old Common)",
      "Language (Phoenician)"
    ]);
    expect(rows.map((row) => row.displayName)).not.toContain("Language");
    expect(rows.map((row) => row.targetLanguageName)).toEqual([
      "Common",
      "Old Common",
      "Phoenician"
    ]);
    expect(rows.every((row) => row.skill.category === "ordinary")).toBe(true);
    expect(rows.every((row) => row.skill.categoryId === "language")).toBe(true);
    expect(rows.every((row) => getPlayerFacingSkillBucket(row.skill) === "language")).toBe(true);
  });

  it("uses canonical language names instead of society placeholder labels", () => {
    const canonicalLanguageContent = {
      ...languageContent,
      languages: defaultCanonicalContent.languages.filter((language) =>
        ["Common", "Old Common", "Phoenician"].includes(language.name)
      )
    };
    const draftView = buildChargenDraftView({
      civilizationId: "lankhmar",
      content: canonicalLanguageContent,
      professionId: "scribe",
      profile: languageProfile,
      progression: createChargenProgression(),
      societyId: "imperial_classical_high_civ",
      societyLevel: 1
    });

    const rows = buildConcreteLanguageBrowseRows({
      content: canonicalLanguageContent,
      draftView,
      profile: undefined,
      progression: createChargenProgression()
    });

    expect(rows.map((row) => row.displayName)).toEqual([
      "Language (Common)",
      "Language (Old Common)",
      "Language (Phoenician)"
    ]);
    expect(
      rows.some((row) =>
        row.displayName.includes("Imperial classical / Hellenistic-Roman high civilization")
      )
    ).toBe(false);
  });

  it("targets purchases and metrics at the concrete language row", () => {
    const purchased = allocateChargenPoint({
      content: { ...languageContent, languages: canonicalLanguages },
      professionId: "scribe",
      profile: languageProfile,
      progression: createChargenProgression(),
      societyId: "glantri",
      societyLevel: 1,
      targetId: "language",
      targetLanguageName: "Old Common",
      targetType: "skill"
    });

    expect(purchased.error).toBeUndefined();

    const draftView = buildChargenDraftView({
      civilizationId: "glantri_civ",
      content: { ...languageContent, languages: canonicalLanguages },
      professionId: "scribe",
      profile: languageProfile,
      progression: purchased.progression,
      societyId: "glantri",
      societyLevel: 1
    });
    const languageSkill = languageContent.skills.find((skill) => skill.id === "language");

    expect(languageSkill).toBeDefined();

    const oldCommonMetrics = getSkillAllocationMetrics({
      content: { ...languageContent, languages: canonicalLanguages },
      draftView,
      profile: undefined,
      skill: languageSkill!,
      targetLanguageName: "Old Common"
    });
    const phoenicianMetrics = getSkillAllocationMetrics({
      content: { ...languageContent, languages: canonicalLanguages },
      draftView,
      profile: undefined,
      skill: languageSkill!,
      targetLanguageName: "Phoenician"
    });
    expect(oldCommonMetrics.flexibleXp).toBe(1);
    expect(oldCommonMetrics.totalXp).toBe(1);
    expect(phoenicianMetrics.totalXp).toBeGreaterThan(1);
  });

  it("keeps invested other-skill rows visible so the same row can be purchased again", () => {
    const startingProgression = createProgressionWithOtherSkillCandidate();
    const firstPurchase = allocateChargenPoint({
      content: hiddenOtherSkillContent,
      professionId: "attendant",
      profile: languageProfile,
      progression: startingProgression,
      societyId: "glantri",
      societyLevel: 1,
      targetId: "etiquette",
      targetType: "skill"
    });

    expect(firstPurchase.error).toBeUndefined();

    const firstDraftView = buildChargenDraftView({
      content: hiddenOtherSkillContent,
      professionId: "attendant",
      profile: languageProfile,
      progression: firstPurchase.progression,
      societyId: "glantri",
      societyLevel: 1
    });
    const etiquetteSkill = hiddenOtherSkillContent.skills.find((skill) => skill.id === "etiquette");

    expect(etiquetteSkill).toBeDefined();
    expect(
      getOtherSkillIds({
        content: hiddenOtherSkillContent,
        draftView: firstDraftView,
        professionId: "attendant",
        societyId: "glantri",
        societyLevel: 1
      })
    ).toContain("etiquette");
    expect(
      getSkillAllocationMetrics({
        content: hiddenOtherSkillContent,
        draftView: firstDraftView,
        profile: undefined,
        skill: etiquetteSkill!
      }).totalXp
    ).toBe(1);

    const secondPurchase = allocateChargenPoint({
      content: hiddenOtherSkillContent,
      professionId: "attendant",
      profile: languageProfile,
      progression: firstPurchase.progression,
      societyId: "glantri",
      societyLevel: 1,
      targetId: "etiquette",
      targetType: "skill"
    });

    expect(secondPurchase.error).toBeUndefined();

    const secondDraftView = buildChargenDraftView({
      content: hiddenOtherSkillContent,
      professionId: "attendant",
      profile: languageProfile,
      progression: secondPurchase.progression,
      societyId: "glantri",
      societyLevel: 1
    });

    expect(
      getOtherSkillIds({
        content: hiddenOtherSkillContent,
        draftView: secondDraftView,
        professionId: "attendant",
        societyId: "glantri",
        societyLevel: 1
      })
    ).toContain("etiquette");
    expect(
      getSkillAllocationMetrics({
        content: hiddenOtherSkillContent,
        draftView: secondDraftView,
        profile: undefined,
        skill: etiquetteSkill!
      }).totalXp
    ).toBe(2);
  });

  it("keeps direct granted skills visible in their granted section after purchase", () => {
    const startingProgression = createChargenProgression();
    const firstPurchase = allocateChargenPoint({
      content: directGrantedSkillContent,
      professionId: "envoy",
      profile: languageProfile,
      progression: startingProgression,
      societyId: "glantri",
      societyLevel: 1,
      targetId: "etiquette",
      targetType: "skill"
    });

    expect(firstPurchase.error).toBeUndefined();

    const firstDraftView = buildChargenDraftView({
      content: directGrantedSkillContent,
      professionId: "envoy",
      profile: languageProfile,
      progression: firstPurchase.progression,
      societyId: "glantri",
      societyLevel: 1
    });
    const etiquetteSkill = directGrantedSkillContent.skills.find((skill) => skill.id === "etiquette");
    const skillAccess = buildChargenSkillAccessSummary({
      content: directGrantedSkillContent,
      professionId: "envoy",
      societyId: "glantri",
      societyLevel: 1
    });

    expect(etiquetteSkill).toBeDefined();
    expect(skillAccess.normalSkillIds).toContain("etiquette");
    expect(
      getSkillDisplayGroupId({
        content: directGrantedSkillContent,
        draftView: firstDraftView,
        skill: etiquetteSkill!,
        skillAccess
      })
    ).toBeUndefined();
    expect(
      getSkillAllocationMetrics({
        content: directGrantedSkillContent,
        draftView: firstDraftView,
        profile: languageProfile,
        skill: etiquetteSkill!
      }).totalXp
    ).toBe(1);

    const secondPurchase = allocateChargenPoint({
      content: directGrantedSkillContent,
      professionId: "envoy",
      profile: languageProfile,
      progression: firstPurchase.progression,
      societyId: "glantri",
      societyLevel: 1,
      targetId: "etiquette",
      targetType: "skill"
    });

    expect(secondPurchase.error).toBeUndefined();

    const secondDraftView = buildChargenDraftView({
      content: directGrantedSkillContent,
      professionId: "envoy",
      profile: languageProfile,
      progression: secondPurchase.progression,
      societyId: "glantri",
      societyLevel: 1
    });

    expect(
      getSkillDisplayGroupId({
        content: directGrantedSkillContent,
        draftView: secondDraftView,
        skill: etiquetteSkill!,
        skillAccess
      })
    ).toBeUndefined();
    expect(
      getSkillAllocationMetrics({
        content: directGrantedSkillContent,
        draftView: secondDraftView,
        profile: languageProfile,
        skill: etiquetteSkill!
      }).totalXp
    ).toBe(2);
  });

  it("keeps package group totals and per-skill group XP in sync for overlapping Officer Training skills", () => {
    const startingProgression = {
      ...createChargenProgression(),
      skillGroups: [
        {
          gms: 0,
          grantedRanks: 0,
          groupId: "basic_awareness",
          primaryRanks: 2,
          ranks: 2,
          secondaryRanks: 0
        }
      ]
    };
    const perception = overlappingOfficerTrainingContent.skills.find((skill) => skill.id === "perception");
    const tactics = overlappingOfficerTrainingContent.skills.find((skill) => skill.id === "tactics");
    const captaincy = overlappingOfficerTrainingContent.skills.find((skill) => skill.id === "captaincy");

    expect(perception).toBeDefined();
    expect(tactics).toBeDefined();
    expect(captaincy).toBeDefined();

    const initialDraftView = buildChargenDraftView({
      content: overlappingOfficerTrainingContent,
      professionId: "officer",
      profile: languageProfile,
      progression: startingProgression,
      societyId: "glantri",
      societyLevel: 1
    });

    expect(
      getSkillAllocationMetrics({
        content: overlappingOfficerTrainingContent,
        draftView: initialDraftView,
        profile: languageProfile,
        skill: perception!
      }).groupXp
    ).toBeGreaterThan(0);
    expect(
      getGroupScopedSkillAllocationMetrics({
        content: overlappingOfficerTrainingContent,
        draftView: initialDraftView,
        groupId: "officer_training",
        profile: languageProfile,
        progression: startingProgression,
        skill: perception!
      }).groupXp
    ).toBe(0);

    const afterBuy = allocateChargenPoint({
      content: overlappingOfficerTrainingContent,
      professionId: "officer",
      progression: startingProgression,
      societyId: "glantri",
      societyLevel: 1,
      targetId: "officer_training",
      targetType: "group"
    });

    expect(afterBuy.error).toBeUndefined();

    const purchasedDraftView = buildChargenDraftView({
      content: overlappingOfficerTrainingContent,
      professionId: "officer",
      profile: languageProfile,
      progression: afterBuy.progression,
      societyId: "glantri",
      societyLevel: 1
    });
    const officerGroupAfterBuy = purchasedDraftView.groups.find(
      (group) => group.groupId === "officer_training"
    );

    expect(officerGroupAfterBuy?.totalRanks).toBe(1);

    for (const skill of [perception!, tactics!, captaincy!]) {
      expect(
        getGroupScopedSkillAllocationMetrics({
          content: overlappingOfficerTrainingContent,
          draftView: purchasedDraftView,
          groupId: "officer_training",
          profile: languageProfile,
          progression: afterBuy.progression,
          skill
        }).groupXp
      ).toBe(officerGroupAfterBuy?.groupLevel ?? 0);
    }

    const afterRemove = removeChargenPoint({
      content: overlappingOfficerTrainingContent,
      professionId: "officer",
      progression: afterBuy.progression,
      societyId: "glantri",
      societyLevel: 1,
      targetId: "officer_training",
      targetType: "group"
    });

    expect(afterRemove.error).toBeUndefined();

    const removedDraftView = buildChargenDraftView({
      content: overlappingOfficerTrainingContent,
      professionId: "officer",
      profile: languageProfile,
      progression: afterRemove.progression,
      societyId: "glantri",
      societyLevel: 1
    });

    for (const skill of [perception!, tactics!, captaincy!]) {
      expect(
        getGroupScopedSkillAllocationMetrics({
          content: overlappingOfficerTrainingContent,
          draftView: removedDraftView,
          groupId: "officer_training",
          profile: languageProfile,
          progression: afterRemove.progression,
          skill
        }).groupXp
      ).toBe(0);
    }
    expect(
      getSkillAllocationMetrics({
        content: overlappingOfficerTrainingContent,
        draftView: removedDraftView,
        profile: languageProfile,
        skill: perception!
      }).groupXp
    ).toBeGreaterThan(0);
  });

  it("only applies granted language XP to the exact granted language row", () => {
    const draftView = buildChargenDraftView({
      civilizationId: "glantri_common_civ",
      content: commonMotherTongueLanguageContent,
      professionId: "scribe",
      profile: education11LanguageProfile,
      progression: {
        ...createChargenProgression(),
        skills: [
          {
            category: "ordinary",
            categoryId: "language",
            grantedRanks: 2,
            groupId: "scholarly",
            languageName: "Old Common",
            level: 0,
            primaryRanks: 0,
            ranks: 2,
            secondaryRanks: 0,
            skillId: "language"
          }
        ]
      },
      societyId: "glantri",
      societyLevel: 1
    });
    const languageSkill = commonMotherTongueLanguageContent.skills.find(
      (skill) => skill.id === "language"
    );

    expect(languageSkill).toBeDefined();

    const commonMetrics = getSkillAllocationMetrics({
      content: commonMotherTongueLanguageContent,
      draftView,
      profile: undefined,
      skill: languageSkill!,
      targetLanguageName: "Common"
    });
    const oldCommonMetrics = getSkillAllocationMetrics({
      content: commonMotherTongueLanguageContent,
      draftView,
      profile: undefined,
      skill: languageSkill!,
      targetLanguageName: "Old Common"
    });
    const phoenicianMetrics = getSkillAllocationMetrics({
      content: commonMotherTongueLanguageContent,
      draftView,
      profile: undefined,
      skill: languageSkill!,
      targetLanguageName: "Phoenician"
    });

    expect(commonMetrics.totalXp).toBe(11);
    expect(oldCommonMetrics.totalXp).toBe(2);
    expect(phoenicianMetrics.totalXp).toBe(0);

    const firstPhoenicianPurchase = allocateChargenPoint({
      content: commonMotherTongueLanguageContent,
      professionId: "scribe",
      profile: education11LanguageProfile,
      progression: createChargenProgression(),
      societyId: "glantri",
      societyLevel: 1,
      targetId: "language",
      targetLanguageName: "Phoenician",
      targetType: "skill"
    });

    expect(firstPhoenicianPurchase.error).toBeUndefined();

    const purchasedDraftView = buildChargenDraftView({
      civilizationId: "glantri_common_civ",
      content: commonMotherTongueLanguageContent,
      professionId: "scribe",
      profile: education11LanguageProfile,
      progression: firstPhoenicianPurchase.progression,
      societyId: "glantri",
      societyLevel: 1
    });

    expect(
      getSkillAllocationMetrics({
        content: commonMotherTongueLanguageContent,
        draftView: purchasedDraftView,
        profile: undefined,
        skill: languageSkill!,
        targetLanguageName: "Phoenician"
      }).totalXp
    ).toBe(1);
  });

  it("uses the restored ordinary-skill pricing for normal-access and outside-access chargen purchases", () => {
    const pricingContent = validateCanonicalContent({
      skillGroups: [
        { id: "fieldcraft", name: "Fieldcraft", sortOrder: 1 },
        { id: "courtly", name: "Courtly", sortOrder: 2 }
      ],
      skills: [
        {
          allowsSpecializations: false,
          category: "ordinary",
          dependencies: [],
          dependencySkillIds: [],
          groupId: "fieldcraft",
          groupIds: ["fieldcraft"],
          id: "stealth",
          linkedStats: ["dex"],
          name: "Stealth",
          requiresLiteracy: "no",
          sortOrder: 1
        },
        {
          allowsSpecializations: false,
          category: "ordinary",
          dependencies: [],
          dependencySkillIds: [],
          groupId: "fieldcraft",
          groupIds: ["fieldcraft"],
          id: "tracking",
          linkedStats: ["int"],
          name: "Tracking",
          requiresLiteracy: "no",
          sortOrder: 2
        },
        {
          allowsSpecializations: false,
          category: "ordinary",
          dependencies: [],
          dependencySkillIds: [],
          groupId: "courtly",
          groupIds: ["courtly"],
          id: "etiquette",
          linkedStats: ["cha"],
          name: "Etiquette",
          requiresLiteracy: "no",
          sortOrder: 3
        },
        {
          allowsSpecializations: false,
          category: "secondary",
          dependencies: [],
          dependencySkillIds: [],
          groupId: "courtly",
          groupIds: ["courtly"],
          id: "streetwise",
          linkedStats: ["int"],
          name: "Streetwise",
          requiresLiteracy: "no",
          sortOrder: 4
        }
      ],
      specializations: [],
      professionFamilies: [{ id: "scout", name: "Scout" }],
      professionSkills: [
        {
          grantType: "group",
          isCore: true,
          professionId: "scout",
          scope: "family",
          skillGroupId: "fieldcraft"
        }
      ],
      professions: [{ familyId: "scout", id: "pathfinder", name: "Pathfinder", subtypeName: "Pathfinder" }],
      societies: [],
      societyBandSkillAccess: [],
      societyLevels: [
        {
          professionIds: ["pathfinder"],
          skillGroupIds: ["fieldcraft"],
          skillIds: [],
          socialClass: "Common",
          societyId: "glantri",
          societyLevel: 1,
          societyName: "Glantri"
        },
        { professionIds: [], skillGroupIds: [], skillIds: [], socialClass: "Common", societyId: "glantri", societyLevel: 2, societyName: "Glantri" },
        { professionIds: [], skillGroupIds: [], skillIds: [], socialClass: "Common", societyId: "glantri", societyLevel: 3, societyName: "Glantri" },
        { professionIds: [], skillGroupIds: [], skillIds: [], socialClass: "Common", societyId: "glantri", societyLevel: 4, societyName: "Glantri" }
      ]
    });

    const normalAccessPurchase = allocateChargenPoint({
      content: pricingContent,
      professionId: "pathfinder",
      profile: languageProfile,
      progression: createChargenProgression(),
      societyId: "glantri",
      societyLevel: 1,
      targetId: "stealth",
      targetType: "skill"
    });
    const outsideOrdinaryPurchase = allocateChargenPoint({
      content: pricingContent,
      professionId: "pathfinder",
      profile: languageProfile,
      progression: createChargenProgression(),
      societyId: "glantri",
      societyLevel: 1,
      targetId: "etiquette",
      targetType: "skill"
    });
    const outsideSecondaryPurchase = allocateChargenPoint({
      content: pricingContent,
      professionId: "pathfinder",
      profile: languageProfile,
      progression: createChargenProgression(),
      societyId: "glantri",
      societyLevel: 1,
      targetId: "streetwise",
      targetType: "skill"
    });

    expect(normalAccessPurchase.spentCost).toBe(2);
    expect(normalAccessPurchase.progression.primaryPoolSpent).toBe(2);
    expect(normalAccessPurchase.progression.secondaryPoolSpent).toBe(0);

    expect(outsideOrdinaryPurchase.spentCost).toBe(2);
    expect(outsideOrdinaryPurchase.progression.primaryPoolSpent).toBe(0);
    expect(outsideOrdinaryPurchase.progression.secondaryPoolSpent).toBe(2);

    expect(outsideSecondaryPurchase.spentCost).toBe(1);
    expect(outsideSecondaryPurchase.progression.primaryPoolSpent).toBe(0);
    expect(outsideSecondaryPurchase.progression.secondaryPoolSpent).toBe(1);
  });
});
