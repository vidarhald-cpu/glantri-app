import { describe, expect, it } from "vitest";

import type { CharacterProgression } from "@glantri/domain";

import {
  buildChargenMotherTongueSummary,
  buildChargenLanguageSelectionSummary,
  buildChargenSelectableSkillSummary
} from "./selectionStructure";

const content = {
  civilizations: [
    {
      historicalAnalogue: "Test analogue",
      id: "glantri_civ",
      linkedSocietyId: "glantri",
      linkedSocietyLevel: 4,
      motherTongueLanguageName: "Common",
      name: "Glantri",
      optionalLanguageNames: ["Old Common"],
      period: "Test period",
      shortDescription: "Test civilization",
      spokenLanguageName: "Common",
      writtenLanguageName: "Common"
    }
  ],
  languages: [{ id: "glantri_language", name: "Glantri" }],
  professionFamilies: [{ id: "military", name: "Military" }],
  professionSkills: [
    {
      grantType: "group" as const,
      isCore: true,
      professionId: "military",
      ranks: 0,
      scope: "family" as const,
      skillGroupId: "field_soldiering"
    },
    {
      grantType: "group" as const,
      isCore: false,
      professionId: "guard",
      ranks: 0,
      scope: "profession" as const,
      skillGroupId: "urban_watch"
    }
  ],
  professions: [{ familyId: "military", id: "guard", name: "Guard", subtypeName: "Guard" }],
  skillGroups: [
    {
      id: "field_soldiering",
      name: "Field soldiering",
      selectionSlots: [
        {
          candidateSkillIds: ["spear"],
          chooseCount: 1,
          id: "melee_choice",
          label: "Choose one melee skill",
          required: true
        }
      ],
      sortOrder: 1
    },
    { id: "urban_watch", name: "Urban watch", sortOrder: 2 }
  ],
  skills: [
    {
      allowsSpecializations: false,
      category: "ordinary" as const,
      categoryId: "knowledge" as const,
      dependencies: [],
      dependencySkillIds: [],
      groupId: "language_group",
      groupIds: ["language_group"],
      id: "language",
      isTheoretical: false,
      linkedStats: ["rea"],
      name: "Language",
      requiresLiteracy: "no" as const,
      societyLevel: 1,
      sortOrder: 0
    },
    {
      allowsSpecializations: false,
      category: "ordinary" as const,
      categoryId: "combat" as const,
      dependencies: [],
      dependencySkillIds: [],
      groupId: "field_soldiering",
      groupIds: ["field_soldiering"],
      id: "shield_use",
      isTheoretical: false,
      linkedStats: ["dex"],
      name: "Shield Use",
      requiresLiteracy: "no" as const,
      societyLevel: 1,
      sortOrder: 1
    },
    {
      allowsSpecializations: false,
      category: "ordinary" as const,
      categoryId: "combat" as const,
      dependencies: [],
      dependencySkillIds: [],
      groupId: "field_soldiering",
      groupIds: ["field_soldiering"],
      id: "spear",
      isTheoretical: false,
      linkedStats: ["dex"],
      name: "Spear",
      requiresLiteracy: "no" as const,
      societyLevel: 1,
      sortOrder: 2
    },
    {
      allowsSpecializations: false,
      category: "ordinary" as const,
      categoryId: "leadership" as const,
      dependencies: [],
      dependencySkillIds: [],
      groupId: "urban_watch",
      groupIds: ["urban_watch"],
      id: "leadership",
      isTheoretical: false,
      linkedStats: ["cha"],
      name: "Leadership",
      requiresLiteracy: "no" as const,
      societyLevel: 1,
      sortOrder: 3
    },
    {
      allowsSpecializations: false,
      category: "ordinary" as const,
      categoryId: "knowledge" as const,
      dependencies: [],
      dependencySkillIds: [],
      groupId: "urban_watch",
      groupIds: ["urban_watch"],
      id: "literacy",
      isTheoretical: false,
      linkedStats: ["rea"],
      name: "Literacy",
      requiresLiteracy: "no" as const,
      societyLevel: 1,
      sortOrder: 4
    }
  ],
  societyBandSkillAccess: [
    {
      linkedSocietyLevel: 4,
      skillId: "literacy",
      socialBand: 1 as const,
      societyId: "glantri",
      societyName: "Glantri"
    }
  ],
  societies: [
    {
      baselineLanguageIds: ["glantri_language"],
      id: "glantri",
      name: "Glantri",
      shortDescription: "Magocracy",
      societyLevel: 4
    }
  ],
  societyLevels: [
    {
      professionIds: ["guard"],
      skillGroupIds: ["field_soldiering", "urban_watch"],
      skillIds: [],
      socialClass: "Common",
      societyId: "glantri",
      societyLevel: 1,
      societyName: "Glantri"
    }
  ],
  specializations: []
};

const progression: CharacterProgression = {
  chargenMode: "standard",
  chargenSelections: {
    selectedLanguageIds: [],
    selectedGroupSlots: [
      {
        groupId: "field_soldiering",
        selectedSkillIds: ["spear"],
        slotId: "melee_choice"
      }
    ],
    selectedSkillIds: ["leadership"]
  },
  educationPoints: 0,
  level: 1,
  primaryPoolSpent: 0,
  primaryPoolTotal: 60,
  secondaryPoolSpent: 0,
  secondaryPoolTotal: 0,
  skillGroups: [
    {
      gms: 0,
      grantedRanks: 0,
      groupId: "field_soldiering",
      primaryRanks: 1,
      secondaryRanks: 0,
      ranks: 1
    }
  ],
  skills: [],
  specializations: []
};

describe("selectionStructure", () => {
  it("builds mother tongue language data from civilization and keeps optional language choices separate", () => {
    const summary = buildChargenMotherTongueSummary({
      content,
      civilizationId: "glantri_civ",
      educationLevel: 9
    });

    expect(summary.displayLabel).toBe("Language (Common)");
    expect(summary.languageName).toBe("Common");
    expect(summary.optionalLanguageNames).toEqual(["Old Common"]);
    expect(summary.startingLevel).toBe(11);
  });

  it("derives baseline languages from society", () => {
    const summary = buildChargenLanguageSelectionSummary({
      content,
      progression,
      societyId: "glantri"
    });

    expect(summary.requiredLanguageIds).toEqual(["glantri_language"]);
    expect(summary.selectableLanguageIds).toEqual([]);
    expect(summary.selectedLanguageIds).toEqual(["glantri_language"]);
  });

  it("separates core and selectable skills and preserves chosen selections", () => {
    const summary = buildChargenSelectableSkillSummary({
      content,
      professionId: "guard",
      progression,
      societyId: "glantri",
      societyLevel: 1
    });

    expect(summary.coreSkillIds).toEqual(["shield_use"]);
    expect(summary.selectionSlots).toHaveLength(1);
    expect(summary.selectionSlots[0]).toMatchObject({
      candidateSkillIds: ["spear"],
      groupId: "field_soldiering",
      isSatisfied: true,
      selectedSkillIds: ["spear"],
      slotId: "melee_choice"
    });
    expect(summary.selectableSkillIds).toEqual(["leadership", "literacy"]);
    expect(summary.selectedSkillIds).toEqual(["spear", "leadership"]);
  });

  it("only exposes foundational skills when society-band access grants them", () => {
    const accessibleSummary = buildChargenSelectableSkillSummary({
      content,
      professionId: "guard",
      progression,
      societyId: "glantri",
      societyLevel: 1
    });
    const blockedSummary = buildChargenSelectableSkillSummary({
      content,
      professionId: "guard",
      progression,
      societyId: "glantri",
      societyLevel: 2
    });

    expect(accessibleSummary.selectableSkillIds).toContain("literacy");
    expect(blockedSummary.selectableSkillIds).not.toContain("literacy");
  });
});
