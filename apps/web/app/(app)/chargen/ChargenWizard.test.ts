import { describe, expect, it } from "vitest";

import { validateCanonicalContent } from "@glantri/content";

import {
  buildChargenDraftView,
  buildChargenSkillAccessSummary,
  createChargenProgression
} from "@glantri/rules-engine";

import { getSkillAllocationMetrics, getSkillDisplayGroupId } from "./ChargenWizard";

const combatContent = validateCanonicalContent({
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
});

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
