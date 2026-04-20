import { describe, expect, it } from "vitest";

import { validateCanonicalContent } from "@glantri/content";
import type { CharacterProgression } from "@glantri/domain";

import {
  buildChargenDraftView,
  createChargenProgression,
  finalizeChargenDraft,
  reviewChargenDraft,
  spendPrimaryPoint,
  spendSecondaryPoint
} from "./primaryAllocation";

const chargenTestContent = validateCanonicalContent({
  skillGroups: [
    {
      id: "scholarly",
      name: "Scholarly",
      sortOrder: 1
    }
  ],
  skills: [
    {
      id: "literacy",
      groupId: "scholarly",
      groupIds: ["scholarly"],
      name: "Literacy",
      linkedStats: ["int"],
      dependencies: [],
      dependencySkillIds: [],
      category: "ordinary",
      requiresLiteracy: "no",
      sortOrder: 1,
      allowsSpecializations: false
    },
    {
      id: "archives",
      groupId: "scholarly",
      groupIds: ["scholarly"],
      name: "Archives",
      linkedStats: ["int"],
      dependencies: [],
      dependencySkillIds: [],
      category: "ordinary",
      requiresLiteracy: "required",
      sortOrder: 2,
      allowsSpecializations: false
    },
    {
      id: "lore",
      groupId: "scholarly",
      groupIds: ["scholarly"],
      name: "Lore",
      linkedStats: ["int"],
      dependencies: [],
      dependencySkillIds: [],
      category: "ordinary",
      requiresLiteracy: "no",
      sortOrder: 3,
      allowsSpecializations: false
    }
  ],
  specializations: [
    {
      id: "codes",
      skillId: "lore",
      name: "Codes",
      minimumGroupLevel: 1,
      minimumParentLevel: 1,
      sortOrder: 1
    }
  ],
  professionFamilies: [
    {
      id: "scholar",
      name: "Scholar"
    }
  ],
  professions: [
    {
      id: "scribe",
      familyId: "scholar",
      name: "Scribe",
      subtypeName: "Scribe"
    }
  ],
  professionSkills: [
    {
      professionId: "scholar",
      scope: "family",
      grantType: "group",
      skillGroupId: "scholarly",
      isCore: true
    }
  ],
  societyLevels: [
    {
      societyId: "glantri",
      societyLevel: 1,
      societyName: "Glantri",
      socialClass: "Common",
      professionIds: ["scribe"],
      skillGroupIds: ["scholarly"]
    },
    {
      societyId: "glantri",
      societyLevel: 2,
      societyName: "Glantri",
      socialClass: "Guild",
      professionIds: ["scribe"],
      skillGroupIds: ["scholarly"]
    },
    {
      societyId: "glantri",
      societyLevel: 3,
      societyName: "Glantri",
      socialClass: "Patrician",
      professionIds: ["scribe"],
      skillGroupIds: ["scholarly"]
    },
    {
      societyId: "glantri",
      societyLevel: 4,
      societyName: "Glantri",
      socialClass: "Noble",
      professionIds: ["scribe"],
      skillGroupIds: ["scholarly"]
    }
  ]
});

const motherTongueTestContent = {
  ...chargenTestContent,
  civilizations: [
    {
      historicalAnalogue: "Test analogue",
      id: "glantri_civ",
      linkedSocietyId: "glantri",
      linkedSocietyLevel: 1,
      motherTongueLanguageName: "Common",
      name: "Glantri",
      optionalLanguageNames: [],
      period: "Test period",
      shortDescription: "Test civilization",
      spokenLanguageName: "Common",
      writtenLanguageName: "Common"
    }
  ],
  languages: [
    {
      id: "glantri_language",
      name: "Common",
      sourceSocietyId: "glantri"
    }
  ],
  societies: [
    {
      baselineLanguageIds: ["glantri_language"],
      id: "glantri",
      name: "Glantri",
      shortDescription: "Test society",
      societyLevel: 1
    }
  ],
  skills: [
    ...chargenTestContent.skills,
    {
      allowsSpecializations: true,
      category: "ordinary" as const,
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
      sortOrder: 4
    }
  ]
};

function createProgressionWithLore(): CharacterProgression {
  const progression = createChargenProgression();

  return {
    ...progression,
    skillGroups: [
      {
        gms: 0,
        grantedRanks: 0,
        groupId: "scholarly",
        primaryRanks: 1,
        secondaryRanks: 0,
        ranks: 1
      }
    ],
    skills: [
      {
        category: "ordinary",
        grantedRanks: 0,
        groupId: "scholarly",
        level: 1,
        primaryRanks: 1,
        ranks: 1,
        secondaryRanks: 0,
        skillId: "lore"
      }
    ]
  };
}

describe("chargen purchase gate integration", () => {
  it("includes group-granted skills in the draft view even without a direct skill row", () => {
    const combatContent = validateCanonicalContent({
      skillGroups: [
        {
          id: "basic_melee_training",
          name: "Basic Melee Training",
          sortOrder: 1
        }
      ],
      skills: [
        {
          id: "dodge",
          groupId: "basic_melee_training",
          groupIds: ["basic_melee_training"],
          name: "Dodge",
          linkedStats: ["dex"],
          dependencies: [],
          dependencySkillIds: [],
          category: "ordinary",
          requiresLiteracy: "no",
          sortOrder: 1,
          allowsSpecializations: false
        },
        {
          id: "parry",
          groupId: "basic_melee_training",
          groupIds: ["basic_melee_training"],
          name: "Parry",
          linkedStats: ["dex"],
          dependencies: [],
          dependencySkillIds: [],
          category: "ordinary",
          requiresLiteracy: "no",
          sortOrder: 2,
          allowsSpecializations: false
        },
        {
          id: "one_h_edged",
          groupId: "basic_melee_training",
          groupIds: ["basic_melee_training"],
          name: "1-h edged",
          linkedStats: ["dex"],
          dependencies: [],
          dependencySkillIds: [],
          category: "ordinary",
          requiresLiteracy: "no",
          sortOrder: 3,
          allowsSpecializations: false
        }
      ],
      specializations: [],
      professionFamilies: [
        {
          id: "soldier",
          name: "Soldier"
        }
      ],
      professions: [
        {
          id: "fighter",
          familyId: "soldier",
          name: "Fighter",
          subtypeName: "Fighter"
        }
      ],
      professionSkills: [
        {
          professionId: "soldier",
          scope: "family",
          grantType: "group",
          skillGroupId: "basic_melee_training",
          isCore: true
        }
      ],
      societyLevels: [
        {
          societyId: "glantri",
          societyLevel: 1,
          societyName: "Glantri",
          socialClass: "Common",
          professionIds: ["fighter"],
          skillGroupIds: ["basic_melee_training"]
        },
        {
          societyId: "glantri",
          societyLevel: 2,
          societyName: "Glantri",
          socialClass: "Guild",
          professionIds: ["fighter"],
          skillGroupIds: ["basic_melee_training"]
        },
        {
          societyId: "glantri",
          societyLevel: 3,
          societyName: "Glantri",
          socialClass: "Patrician",
          professionIds: ["fighter"],
          skillGroupIds: ["basic_melee_training"]
        },
        {
          societyId: "glantri",
          societyLevel: 4,
          societyName: "Glantri",
          socialClass: "Noble",
          professionIds: ["fighter"],
          skillGroupIds: ["basic_melee_training"]
        }
      ]
    });

    const draftView = buildChargenDraftView({
      content: combatContent,
      professionId: "fighter",
      progression: {
        ...createChargenProgression(),
        skillGroups: [
          {
            gms: 0,
            grantedRanks: 0,
            groupId: "basic_melee_training",
            primaryRanks: 1,
            secondaryRanks: 0,
            ranks: 1
          }
        ],
        skills: [
          {
            category: "ordinary",
            grantedRanks: 0,
            groupId: "basic_melee_training",
            level: 1,
            primaryRanks: 1,
            ranks: 1,
            secondaryRanks: 0,
            skillId: "one_h_edged"
          }
        ]
      },
      societyId: "glantri",
      societyLevel: 1
    });

    const dodge = draftView.skills.find((skill) => skill.skillId === "dodge");
    const parry = draftView.skills.find((skill) => skill.skillId === "parry");
    const edged = draftView.skills.find((skill) => skill.skillId === "one_h_edged");
    const meleeGroup = draftView.groups.find((group) => group.groupId === "basic_melee_training");

    expect(meleeGroup?.groupLevel).toBeGreaterThan(0);
    expect(dodge).toMatchObject({
      effectiveSkillNumber: meleeGroup?.groupLevel,
      name: "Dodge",
      specificSkillLevel: 0,
    });
    expect(parry).toMatchObject({
      effectiveSkillNumber: meleeGroup?.groupLevel,
      name: "Parry",
      specificSkillLevel: 0,
    });
    expect(edged).toMatchObject({
      effectiveSkillNumber: (meleeGroup?.groupLevel ?? 0) + 1,
      name: "1-h edged",
      specificSkillLevel: 1,
    });
  });

  it("includes chosen group-slot skills in the draft view like normal skills", () => {
    const combatContent = validateCanonicalContent({
      skillGroups: [
        {
          id: "basic_melee_training",
          name: "Basic Melee Training",
          selectionSlots: [
            {
              candidateSkillIds: ["one_h_edged"],
              chooseCount: 1,
              id: "melee_choice",
              label: "Choose one melee weapon skill",
              required: true
            }
          ],
          skillMemberships: [
            {
              relevance: "core",
              skillId: "dodge"
            },
            {
              relevance: "core",
              skillId: "parry"
            }
          ],
          sortOrder: 1
        },
        {
          id: "combat_group",
          name: "Combat group",
          sortOrder: 2
        }
      ],
      skills: [
        {
          id: "dodge",
          groupId: "basic_melee_training",
          groupIds: ["basic_melee_training"],
          name: "Dodge",
          linkedStats: ["dex"],
          dependencies: [],
          dependencySkillIds: [],
          category: "ordinary",
          requiresLiteracy: "no",
          sortOrder: 1,
          allowsSpecializations: false,
          categoryId: "combat"
        },
        {
          id: "parry",
          groupId: "basic_melee_training",
          groupIds: ["basic_melee_training"],
          name: "Parry",
          linkedStats: ["dex"],
          dependencies: [],
          dependencySkillIds: [],
          category: "ordinary",
          requiresLiteracy: "no",
          sortOrder: 2,
          allowsSpecializations: false,
          categoryId: "combat"
        },
        {
          id: "one_h_edged",
          groupId: "combat_group",
          groupIds: ["combat_group", "basic_melee_training"],
          name: "1-h edged",
          linkedStats: ["dex"],
          dependencies: [],
          dependencySkillIds: [],
          category: "ordinary",
          requiresLiteracy: "no",
          sortOrder: 3,
          allowsSpecializations: false,
          categoryId: "combat"
        }
      ],
      specializations: [],
      professionFamilies: [
        {
          id: "soldier",
          name: "Soldier"
        }
      ],
      professions: [
        {
          id: "fighter",
          familyId: "soldier",
          name: "Fighter",
          subtypeName: "Fighter"
        }
      ],
      professionSkills: [
        {
          professionId: "soldier",
          scope: "family",
          grantType: "group",
          skillGroupId: "basic_melee_training",
          isCore: true
        }
      ],
      societyLevels: [
        {
          societyId: "glantri",
          societyLevel: 1,
          societyName: "Glantri",
          socialClass: "Common",
          professionIds: ["fighter"],
          skillGroupIds: ["basic_melee_training"]
        },
        {
          societyId: "glantri",
          societyLevel: 2,
          societyName: "Glantri",
          socialClass: "Guild",
          professionIds: ["fighter"],
          skillGroupIds: ["basic_melee_training"]
        },
        {
          societyId: "glantri",
          societyLevel: 3,
          societyName: "Glantri",
          socialClass: "Patrician",
          professionIds: ["fighter"],
          skillGroupIds: ["basic_melee_training"]
        },
        {
          societyId: "glantri",
          societyLevel: 4,
          societyName: "Glantri",
          socialClass: "Noble",
          professionIds: ["fighter"],
          skillGroupIds: ["basic_melee_training"]
        }
      ]
    });

    const draftView = buildChargenDraftView({
      content: combatContent,
      professionId: "fighter",
      progression: {
        ...createChargenProgression(),
        chargenSelections: {
          selectedGroupSlots: [
            {
              groupId: "basic_melee_training",
              selectedSkillIds: ["one_h_edged"],
              slotId: "melee_choice"
            }
          ],
          selectedLanguageIds: [],
          selectedSkillIds: []
        },
        skillGroups: [
          {
            gms: 0,
            grantedRanks: 0,
            groupId: "basic_melee_training",
            primaryRanks: 1,
            secondaryRanks: 0,
            ranks: 1
          }
        ],
        skills: []
      },
      societyId: "glantri",
      societyLevel: 1
    });

    expect(draftView.skills.find((skill) => skill.skillId === "one_h_edged")).toMatchObject({
      name: "1-h edged",
      specificSkillLevel: 0
    });
  });

  it("requires required group-slot choices before finalizing", () => {
    const review = reviewChargenDraft({
      content: validateCanonicalContent({
        skillGroups: [
          {
            id: "basic_melee_training",
            name: "Basic Melee Training",
            selectionSlots: [
              {
                candidateSkillIds: ["one_h_edged"],
                chooseCount: 1,
                id: "melee_choice",
                label: "Choose one melee weapon skill",
                required: true
              }
            ],
            skillMemberships: [
              {
                relevance: "core",
                skillId: "dodge"
              },
              {
                relevance: "core",
                skillId: "parry"
              }
            ],
            sortOrder: 1
          },
          {
            id: "combat_group",
            name: "Combat group",
            sortOrder: 2
          }
        ],
        skills: [
          {
            id: "dodge",
            groupId: "basic_melee_training",
            groupIds: ["basic_melee_training"],
            name: "Dodge",
            linkedStats: ["dex"],
            dependencies: [],
            dependencySkillIds: [],
            category: "ordinary",
            requiresLiteracy: "no",
            sortOrder: 1,
            allowsSpecializations: false,
            categoryId: "combat"
          },
          {
            id: "parry",
            groupId: "basic_melee_training",
            groupIds: ["basic_melee_training"],
            name: "Parry",
            linkedStats: ["dex"],
            dependencies: [],
            dependencySkillIds: [],
            category: "ordinary",
            requiresLiteracy: "no",
            sortOrder: 2,
            allowsSpecializations: false,
            categoryId: "combat"
          },
          {
            id: "one_h_edged",
            groupId: "combat_group",
            groupIds: ["combat_group", "basic_melee_training"],
            name: "1-h edged",
            linkedStats: ["dex"],
            dependencies: [],
            dependencySkillIds: [],
            category: "ordinary",
            requiresLiteracy: "no",
            sortOrder: 3,
            allowsSpecializations: false,
            categoryId: "combat"
          }
        ],
        specializations: [],
        professionFamilies: [
          {
            id: "soldier",
            name: "Soldier"
          }
        ],
        professions: [
          {
            id: "fighter",
            familyId: "soldier",
            name: "Fighter",
            subtypeName: "Fighter"
          }
        ],
        professionSkills: [
          {
            professionId: "soldier",
            scope: "family",
            grantType: "group",
            skillGroupId: "basic_melee_training",
            isCore: true
          }
        ],
        societyLevels: [
          {
            societyId: "glantri",
            societyLevel: 1,
            societyName: "Glantri",
            socialClass: "Common",
            professionIds: ["fighter"],
            skillGroupIds: ["basic_melee_training"]
          },
          {
            societyId: "glantri",
            societyLevel: 2,
            societyName: "Glantri",
            socialClass: "Guild",
            professionIds: ["fighter"],
            skillGroupIds: ["basic_melee_training"]
          },
          {
            societyId: "glantri",
            societyLevel: 3,
            societyName: "Glantri",
            socialClass: "Patrician",
            professionIds: ["fighter"],
            skillGroupIds: ["basic_melee_training"]
          },
          {
            societyId: "glantri",
            societyLevel: 4,
            societyName: "Glantri",
            socialClass: "Noble",
            professionIds: ["fighter"],
            skillGroupIds: ["basic_melee_training"]
          }
        ]
      }),
      professionId: "fighter",
      profile: {
        distractionLevel: 0,
        id: "profile-baseline",
        label: "Baseline",
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
        societyLevel: 0
      },
      progression: {
        ...createChargenProgression(),
        skillGroups: [
          {
            gms: 0,
            grantedRanks: 0,
            groupId: "basic_melee_training",
            primaryRanks: 1,
            secondaryRanks: 0,
            ranks: 1
          }
        ]
      },
      socialClass: "Common",
      societyId: "glantri",
      societyLevel: 1
    });

    expect(review.canFinalize).toBe(false);
    expect(review.errors).toContain("Basic Melee Training: Choose one melee weapon skill.");
  });

  it("uses the evaluator result for literacy-gated skill purchases", () => {
    const result = spendPrimaryPoint({
      content: chargenTestContent,
      professionId: "scribe",
      progression: createChargenProgression(),
      societyId: "glantri",
      societyLevel: 1,
      targetId: "archives",
      targetType: "skill"
    });

    expect(result.error).toBe("Archives requires Literacy.");
    expect(result.warnings).toEqual([]);
  });

  it("uses the evaluator result for specialization availability gating", () => {
    const result = spendSecondaryPoint({
      content: chargenTestContent,
      progression: createProgressionWithLore(),
      societyId: "glantri",
      societyLevel: 1,
      targetId: "codes",
      targetType: "specialization"
    });

    expect(result.error).toBe("Lore does not allow specializations like Codes.");
    expect(result.warnings).toEqual([]);
  });

  it("adds civilization mother tongue as a granted Language row in the draft view", () => {
    const draftView = buildChargenDraftView({
      civilizationId: "glantri_civ",
      content: motherTongueTestContent,
      profile: {
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
        societyLevel: 0
      },
      progression: createChargenProgression(),
      societyId: "glantri",
      societyLevel: 1
    });
    const languageView = draftView.skills.find((skill) => skill.skillId === "language");

    expect(languageView?.languageName).toBe("Common");
    expect(languageView?.specificSkillLevel).toBe(12);
  });

  it("finalizes mother tongue without spending ordinary or flexible points", () => {
    const result = finalizeChargenDraft({
      civilizationId: "glantri_civ",
      content: motherTongueTestContent,
      professionId: "scribe",
      profile: {
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
        societyLevel: 0
      },
      progression: createChargenProgression(),
      socialClass: "Common",
      societyId: "glantri",
      societyLevel: 1
    });
    const motherTongueSkill = result.build?.progression.skills.find((skill) => skill.skillId === "language");

    expect(result.errors).toEqual([]);
    expect(motherTongueSkill?.languageName).toBe("Common");
    expect(motherTongueSkill?.grantedRanks).toBe(12);
    expect(motherTongueSkill?.sourceTag).toBe("mother-tongue");
    expect(result.build?.progression.primaryPoolSpent).toBe(0);
    expect(result.build?.progression.secondaryPoolSpent).toBe(0);
  });
});
