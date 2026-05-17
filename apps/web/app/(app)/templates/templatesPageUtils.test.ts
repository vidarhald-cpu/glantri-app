import { describe, expect, it } from "vitest";

import type { CanonicalContent } from "@glantri/content";
import type { EquipmentTemplate } from "@glantri/domain/equipment";

import {
  clampLevel,
  clampStat,
  formatPlayerFacingCategoryLabel,
  getProfessionDirectSkillGroupIds,
  getProfessionDirectSkillIds,
  getGroupRelevanceLabel,
  getSelectedGroupTypeLabel,
  getSkillRelevance,
  getSkillRelevanceLabel,
  sortTemplatesByName
} from "./templatesPageUtils";

const content = {
  professionFamilies: [{ id: "military", name: "Military" }],
  professionSkills: [
    {
      grantType: "group",
      isCore: true,
      professionId: "military",
      scope: "family",
      skillGroupId: "field_soldiering"
    },
    {
      grantType: "ordinary-skill",
      isCore: true,
      professionId: "guard",
      scope: "profession",
      skillId: "leadership"
    },
    {
      grantType: "group",
      isCore: false,
      professionId: "guard",
      scope: "profession",
      skillGroupId: "urban_watch"
    }
  ],
  professions: [
    { familyId: "military", id: "guard", name: "Guard", subtypeName: "Guard" }
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
      linkedStats: ["dex"],
      name: "Shield Use",
      requiresLiteracy: "no",
      sortOrder: 1
    },
    {
      allowsSpecializations: false,
      category: "ordinary",
      categoryId: "social",
      dependencies: [],
      dependencySkillIds: [],
      groupId: "urban_watch",
      groupIds: ["urban_watch"],
      id: "leadership",
      linkedStats: ["cha"],
      name: "Leadership",
      requiresLiteracy: "no",
      sortOrder: 2
    },
    {
      allowsSpecializations: false,
      category: "secondary",
      categoryId: "fieldcraft",
      dependencies: [],
      dependencySkillIds: [],
      groupId: "scouts",
      groupIds: ["scouts"],
      id: "tracking",
      linkedStats: ["per"],
      name: "Tracking",
      requiresLiteracy: "no",
      sortOrder: 3
    }
  ]
} as unknown as CanonicalContent;

describe("clampLevel", () => {
  it("passes values within 0–99 unchanged", () => {
    expect(clampLevel(0)).toBe(0);
    expect(clampLevel(50)).toBe(50);
    expect(clampLevel(99)).toBe(99);
  });

  it("clamps values below 0 to 0", () => {
    expect(clampLevel(-1)).toBe(0);
    expect(clampLevel(-100)).toBe(0);
  });

  it("clamps values above 99 to 99", () => {
    expect(clampLevel(100)).toBe(99);
    expect(clampLevel(999)).toBe(99);
  });

  it("truncates decimals rather than rounding", () => {
    expect(clampLevel(5.9)).toBe(5);
    expect(clampLevel(98.99)).toBe(98);
  });
});

describe("clampStat", () => {
  it("passes values within 1–25 unchanged", () => {
    expect(clampStat(1)).toBe(1);
    expect(clampStat(13)).toBe(13);
    expect(clampStat(25)).toBe(25);
  });

  it("clamps values below 1 to 1", () => {
    expect(clampStat(0)).toBe(1);
    expect(clampStat(-5)).toBe(1);
  });

  it("clamps values above 25 to 25", () => {
    expect(clampStat(26)).toBe(25);
    expect(clampStat(100)).toBe(25);
  });

  it("truncates decimals rather than rounding", () => {
    expect(clampStat(10.9)).toBe(10);
    expect(clampStat(24.99)).toBe(24);
  });
});

describe("getProfessionDirectSkillGroupIds", () => {
  it("returns skill group IDs directly assigned to the profession", () => {
    expect(getProfessionDirectSkillGroupIds(content, "guard")).toContain("urban_watch");
  });

  it("returns skill group IDs inherited via profession family scope", () => {
    expect(getProfessionDirectSkillGroupIds(content, "guard")).toContain("field_soldiering");
  });

  it("returns empty array for unknown profession", () => {
    expect(getProfessionDirectSkillGroupIds(content, "unknown")).toEqual([]);
  });
});

describe("getProfessionDirectSkillIds", () => {
  it("returns skill IDs directly assigned to the profession", () => {
    expect(getProfessionDirectSkillIds(content, "guard")).toEqual(["leadership"]);
  });

  it("returns empty array for unknown profession", () => {
    expect(getProfessionDirectSkillIds(content, "unknown")).toEqual([]);
  });
});

describe("getGroupRelevanceLabel", () => {
  it("labels a group in directProfessionGroupIds as 'Core to profession'", () => {
    expect(
      getGroupRelevanceLabel({
        directProfessionGroupIds: ["field_soldiering"],
        groupId: "field_soldiering",
        suggestedSkillGroupIds: ["field_soldiering", "urban_watch"]
      })
    ).toBe("Core to profession");
  });

  it("labels a group only in suggestedSkillGroupIds as 'Optional to frame'", () => {
    expect(
      getGroupRelevanceLabel({
        directProfessionGroupIds: ["field_soldiering"],
        groupId: "urban_watch",
        suggestedSkillGroupIds: ["field_soldiering", "urban_watch"]
      })
    ).toBe("Optional to frame");
  });

  it("labels a group in neither list as 'Manual expansion'", () => {
    expect(
      getGroupRelevanceLabel({
        directProfessionGroupIds: ["field_soldiering"],
        groupId: "scouts",
        suggestedSkillGroupIds: ["field_soldiering", "urban_watch"]
      })
    ).toBe("Manual expansion");
  });
});

describe("getSelectedGroupTypeLabel", () => {
  it("returns 'Core' for a group in directProfessionGroupIds", () => {
    expect(
      getSelectedGroupTypeLabel({
        directProfessionGroupIds: ["field_soldiering"],
        groupId: "field_soldiering",
        suggestedSkillGroupIds: ["field_soldiering", "urban_watch"]
      })
    ).toBe("Core");
  });

  it("returns 'Optional' for a group only in suggestedSkillGroupIds", () => {
    expect(
      getSelectedGroupTypeLabel({
        directProfessionGroupIds: ["field_soldiering"],
        groupId: "urban_watch",
        suggestedSkillGroupIds: ["field_soldiering", "urban_watch"]
      })
    ).toBe("Optional");
  });

  it("returns 'Other' for a group in neither list", () => {
    expect(
      getSelectedGroupTypeLabel({
        directProfessionGroupIds: ["field_soldiering"],
        groupId: "scouts",
        suggestedSkillGroupIds: ["field_soldiering", "urban_watch"]
      })
    ).toBe("Other");
  });
});

describe("getSkillRelevance", () => {
  const skill = content.skills[0]; // shield_use, groupIds: ["field_soldiering"]

  it("returns 'core' when skill is in directProfessionSkillIds", () => {
    expect(
      getSkillRelevance({
        directProfessionSkillIds: ["shield_use"],
        selectedGroupIds: [],
        skill,
        suggestedSkillIds: []
      })
    ).toBe("core");
  });

  it("returns 'optional' when skill is in suggestedSkillIds", () => {
    expect(
      getSkillRelevance({
        directProfessionSkillIds: [],
        selectedGroupIds: [],
        skill,
        suggestedSkillIds: ["shield_use"]
      })
    ).toBe("optional");
  });

  it("returns 'optional' when skill belongs to a selected group", () => {
    expect(
      getSkillRelevance({
        directProfessionSkillIds: [],
        selectedGroupIds: ["field_soldiering"],
        skill,
        suggestedSkillIds: []
      })
    ).toBe("optional");
  });

  it("returns 'other' when skill is in none of the relevant lists", () => {
    expect(
      getSkillRelevance({
        directProfessionSkillIds: [],
        selectedGroupIds: [],
        skill,
        suggestedSkillIds: []
      })
    ).toBe("other");
  });

  it("core takes precedence over suggested", () => {
    expect(
      getSkillRelevance({
        directProfessionSkillIds: ["shield_use"],
        selectedGroupIds: ["field_soldiering"],
        skill,
        suggestedSkillIds: ["shield_use"]
      })
    ).toBe("core");
  });
});

describe("getSkillRelevanceLabel", () => {
  it("maps relevance values to display labels", () => {
    expect(getSkillRelevanceLabel("core")).toBe("Core");
    expect(getSkillRelevanceLabel("optional")).toBe("Optional");
    expect(getSkillRelevanceLabel("other")).toBe("Other");
  });
});

describe("formatPlayerFacingCategoryLabel", () => {
  it("returns the defined label for known bucket IDs", () => {
    expect(formatPlayerFacingCategoryLabel("combat")).toBe("Combat");
    expect(formatPlayerFacingCategoryLabel("high-society")).toBe("High Society");
    expect(formatPlayerFacingCategoryLabel("fieldcraft")).toBe("Fieldcraft");
  });
});

describe("sortTemplatesByName", () => {
  it("sorts equipment templates alphabetically by player-facing name", () => {
    const templates = [
      { category: "weapon", id: "t-sword", name: "Sword" },
      { category: "gear", id: "t-rope", name: "Rope" },
      { category: "weapon", id: "t-axe", name: "Axe" }
    ] as EquipmentTemplate[];

    const sorted = sortTemplatesByName(templates);
    expect(sorted.map((t) => t.name)).toEqual(["Axe", "Rope", "Sword"]);
  });

  it("does not mutate the original array", () => {
    const templates = [
      { category: "weapon", id: "t-sword", name: "Sword" },
      { category: "gear", id: "t-rope", name: "Rope" }
    ] as EquipmentTemplate[];

    sortTemplatesByName(templates);
    expect(templates[0].name).toBe("Sword");
  });
});
