import { describe, expect, it } from "vitest";

import { defaultCanonicalContent } from "@glantri/content";
import {
  allocateChargenPoint,
  buildChargenDraftView,
  buildChargenSkillAccessSummary,
  createChargenProgression,
  removeChargenPoint
} from "@glantri/rules-engine";
import { getPlayerFacingSkillBucket } from "../../../src/lib/chargen/chargenBrowse";

import {
  buildConcreteLanguageBrowseRows,
  getGroupScopedSkillAllocationMetrics,
  getSkillAllocationMetrics,
  getSkillDisplayGroupId
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
      category: "ordinary",
      dependencies: [],
      dependencySkillIds: [],
      groupId: "advanced_melee_training",
      groupIds: ["advanced_melee_training"],
      id: "dodge",
      linkedStats: ["dex"],
      name: "Dodge",
      requiresLiteracy: "no",
      sortOrder: 1
    },
    {
      allowsSpecializations: false,
      category: "ordinary",
      dependencies: [],
      dependencySkillIds: [],
      groupId: "advanced_melee_training",
      groupIds: ["advanced_melee_training"],
      id: "parry",
      linkedStats: ["dex"],
      name: "Parry",
      requiresLiteracy: "no",
      sortOrder: 2
    },
    {
      allowsSpecializations: false,
      category: "ordinary",
      dependencies: [],
      dependencySkillIds: [],
      groupId: "advanced_melee_training",
      groupIds: ["advanced_melee_training"],
      id: "brawling",
      linkedStats: ["str"],
      name: "Brawling",
      requiresLiteracy: "no",
      sortOrder: 3
    },
    {
      allowsSpecializations: false,
      category: "ordinary",
      dependencies: [],
      dependencySkillIds: [],
      groupId: "advanced_melee_training",
      groupIds: ["advanced_melee_training"],
      id: "sword",
      linkedStats: ["dex"],
      name: "Sword",
      requiresLiteracy: "no",
      sortOrder: 4
    },
    {
      allowsSpecializations: false,
      category: "ordinary",
      dependencies: [],
      dependencySkillIds: [],
      groupId: "advanced_melee_training",
      groupIds: ["advanced_melee_training"],
      id: "axe",
      linkedStats: ["dex"],
      name: "Axe",
      requiresLiteracy: "no",
      sortOrder: 5
    },
    {
      allowsSpecializations: false,
      category: "ordinary",
      dependencies: [],
      dependencySkillIds: [],
      groupId: "advanced_melee_training",
      groupIds: ["advanced_melee_training"],
      id: "spear",
      linkedStats: ["dex"],
      name: "Spear",
      requiresLiteracy: "no",
      sortOrder: 6
    },
    {
      allowsSpecializations: false,
      category: "ordinary",
      dependencies: [],
      dependencySkillIds: [],
      groupId: "advanced_melee_training",
      groupIds: ["advanced_melee_training"],
      id: "mace",
      linkedStats: ["dex"],
      name: "Mace",
      requiresLiteracy: "no",
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
      category: "ordinary",
      categoryId: "language",
      dependencies: [],
      dependencySkillIds: [],
      groupId: "scholarly",
      groupIds: ["scholarly"],
      id: "literacy",
      linkedStats: ["int"],
      name: "Literacy",
      requiresLiteracy: "no",
      sortOrder: 1
    },
    {
      allowsSpecializations: false,
      category: "ordinary",
      categoryId: "language",
      dependencies: [],
      dependencySkillIds: [],
      groupId: "scholarly",
      groupIds: ["scholarly"],
      id: "language",
      isTheoretical: false,
      linkedStats: ["int"],
      name: "Language",
      requiresLiteracy: "no",
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
      categoryId: "court-social" as const,
      dependencies: [],
      dependencySkillIds: [],
      groupId: "courtly",
      groupIds: ["courtly"],
      id: "etiquette",
      linkedStats: ["com"],
      name: "Etiquette",
      requiresLiteracy: "no" as const,
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
      categoryId: "court-social" as const,
      dependencies: [],
      dependencySkillIds: [],
      groupId: "courtly",
      groupIds: ["courtly"],
      id: "etiquette",
      linkedStats: ["com"],
      name: "Etiquette",
      requiresLiteracy: "no" as const,
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
      categoryId: "leadership" as const,
      dependencies: [],
      dependencySkillIds: [],
      groupId: "basic_awareness",
      groupIds: ["basic_awareness", "officer_training"],
      id: "perception",
      linkedStats: ["int"],
      name: "Perception",
      requiresLiteracy: "no" as const,
      sortOrder: 1
    },
    {
      allowsSpecializations: false,
      category: "ordinary" as const,
      categoryId: "leadership" as const,
      dependencies: [],
      dependencySkillIds: [],
      groupId: "officer_training",
      groupIds: ["officer_training"],
      id: "tactics",
      linkedStats: ["int"],
      name: "Tactics",
      requiresLiteracy: "no" as const,
      sortOrder: 2
    },
    {
      allowsSpecializations: false,
      category: "ordinary" as const,
      categoryId: "leadership" as const,
      dependencies: [],
      dependencySkillIds: [],
      groupId: "officer_training",
      groupIds: ["officer_training"],
      id: "captaincy",
      linkedStats: ["pow"],
      name: "Captaincy",
      requiresLiteracy: "no" as const,
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
  specializations: []
};

function createProgressionWithOtherSkillCandidate() {
  return {
    ...createChargenProgression()
  };
}

function getOtherSkillIds(input: {
  content: Parameters<typeof buildChargenSkillAccessSummary>[0]["content"];
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
});
