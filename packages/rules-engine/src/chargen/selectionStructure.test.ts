import { describe, expect, it } from "vitest";

import type { CharacterProgression } from "@glantri/domain";

import {
  buildChargenLanguageSelectionSummary,
  buildChargenSelectableSkillSummary
} from "./selectionStructure";

const content = {
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
    { id: "field_soldiering", name: "Field soldiering", sortOrder: 1 },
    { id: "urban_watch", name: "Urban watch", sortOrder: 2 }
  ],
  skills: [
    {
      allowsSpecializations: false,
      category: "ordinary",
      categoryId: "combat",
      dependencies: [],
      dependencySkillIds: [],
      groupId: "field_soldiering",
      groupIds: ["field_soldiering"],
      id: "shield_use",
      isTheoretical: false,
      linkedStats: ["dex"],
      name: "Shield Use",
      requiresLiteracy: "no",
      societyLevel: 1,
      sortOrder: 1
    },
    {
      allowsSpecializations: false,
      category: "ordinary",
      categoryId: "leadership",
      dependencies: [],
      dependencySkillIds: [],
      groupId: "urban_watch",
      groupIds: ["urban_watch"],
      id: "leadership",
      isTheoretical: false,
      linkedStats: ["cha"],
      name: "Leadership",
      requiresLiteracy: "no",
      societyLevel: 1,
      sortOrder: 2
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
    selectedSkillIds: ["leadership"]
  },
  educationPoints: 0,
  level: 1,
  primaryPoolSpent: 0,
  primaryPoolTotal: 60,
  secondaryPoolSpent: 0,
  secondaryPoolTotal: 0,
  skillGroups: [],
  skills: [],
  specializations: []
};

describe("selectionStructure", () => {
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
    expect(summary.selectableSkillIds).toEqual(["leadership"]);
    expect(summary.selectedSkillIds).toEqual(["leadership"]);
  });
});
