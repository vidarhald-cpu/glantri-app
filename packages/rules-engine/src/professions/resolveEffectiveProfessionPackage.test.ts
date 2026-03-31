import { describe, expect, it } from "vitest";

import { validateCanonicalContent } from "@glantri/content";

import { resolveEffectiveProfessionPackage } from "./resolveEffectiveProfessionPackage";

const professionResolverContent = validateCanonicalContent({
  skillGroups: [
    {
      id: "martial",
      name: "Martial",
      sortOrder: 1
    },
    {
      id: "social",
      name: "Social",
      sortOrder: 2
    },
    {
      id: "scholarly",
      name: "Scholarly",
      sortOrder: 3
    }
  ],
  skills: [
    {
      id: "melee",
      groupId: "martial",
      groupIds: ["martial"],
      name: "Melee",
      linkedStats: ["str"],
      dependencies: [],
      dependencySkillIds: [],
      sortOrder: 1
    },
    {
      id: "discipline",
      groupId: "martial",
      groupIds: ["martial"],
      name: "Discipline",
      linkedStats: ["wil"],
      dependencies: [],
      dependencySkillIds: [],
      sortOrder: 2
    },
    {
      id: "etiquette",
      groupId: "social",
      groupIds: ["social"],
      name: "Etiquette",
      linkedStats: ["cha"],
      dependencies: [],
      dependencySkillIds: [],
      sortOrder: 3
    },
    {
      id: "appraisal",
      groupId: "social",
      groupIds: ["social"],
      name: "Appraisal",
      linkedStats: ["int"],
      dependencies: [],
      dependencySkillIds: [],
      category: "secondary",
      sortOrder: 4
    },
    {
      id: "lore",
      groupId: "scholarly",
      groupIds: ["scholarly"],
      name: "Lore",
      linkedStats: ["int"],
      dependencies: [],
      dependencySkillIds: [],
      sortOrder: 5
    },
    {
      id: "literacy",
      groupId: "scholarly",
      groupIds: ["scholarly"],
      name: "Literacy",
      linkedStats: ["int"],
      dependencies: [],
      dependencySkillIds: [],
      category: "secondary",
      sortOrder: 6
    }
  ],
  specializations: [],
  professionFamilies: [
    {
      id: "guard",
      name: "Guard"
    },
    {
      id: "trade",
      name: "Trade"
    }
  ],
  professions: [
    {
      id: "sentinel",
      familyId: "guard",
      name: "Sentinel",
      subtypeName: "Sentinel"
    },
    {
      id: "broker",
      familyId: "trade",
      name: "Broker",
      subtypeName: "Broker"
    }
  ],
  professionSkills: [
    {
      professionId: "guard",
      scope: "family",
      grantType: "group",
      skillGroupId: "martial",
      isCore: true
    },
    {
      professionId: "guard",
      scope: "family",
      grantType: "ordinary-skill",
      skillId: "melee",
      isCore: true
    },
    {
      professionId: "guard",
      scope: "family",
      grantType: "ordinary-skill",
      skillId: "literacy",
      isCore: true
    },
    {
      professionId: "guard",
      scope: "family",
      grantType: "group",
      skillGroupId: "scholarly",
      isCore: false
    },
    {
      professionId: "sentinel",
      scope: "profession",
      grantType: "group",
      skillGroupId: "martial",
      isCore: true
    },
    {
      professionId: "sentinel",
      scope: "profession",
      grantType: "ordinary-skill",
      skillId: "literacy",
      isCore: true
    },
    {
      professionId: "sentinel",
      scope: "profession",
      grantType: "ordinary-skill",
      skillId: "discipline",
      isCore: true
    },
    {
      professionId: "sentinel",
      scope: "profession",
      grantType: "group",
      skillGroupId: "social",
      isCore: false
    },
    {
      professionId: "sentinel",
      scope: "profession",
      grantType: "secondary-skill",
      skillId: "appraisal",
      isCore: false
    },
    {
      professionId: "sentinel",
      scope: "profession",
      grantType: "ordinary-skill",
      skillId: "etiquette",
      isCore: false
    }
  ],
  societyLevels: [
    {
      societyId: "scandia",
      societyLevel: 1,
      societyName: "Scandia",
      socialClass: "Bonder"
    },
    {
      societyId: "scandia",
      societyLevel: 2,
      societyName: "Scandia",
      socialClass: "Crafts"
    },
    {
      societyId: "scandia",
      societyLevel: 3,
      societyName: "Scandia",
      socialClass: "Freeholders"
    },
    {
      societyId: "scandia",
      societyLevel: 4,
      societyName: "Scandia",
      socialClass: "Nobility"
    }
  ]
});

describe("resolveEffectiveProfessionPackage", () => {
  it("resolves a family-only package", () => {
    const result = resolveEffectiveProfessionPackage({
      content: professionResolverContent,
      familyId: "guard"
    });

    expect(result.family.id).toBe("guard");
    expect(result.subtype).toBeUndefined();
    expect(result.core.inheritedFamilyGroupIds).toEqual(["martial"]);
    expect(result.core.inheritedFamilySkillIds).toEqual(["melee", "literacy"]);
    expect(result.core.finalEffectiveReachableSkillIds).toEqual([
      "melee",
      "discipline",
      "literacy"
    ]);
  });

  it("includes subtype additions", () => {
    const result = resolveEffectiveProfessionPackage({
      content: professionResolverContent,
      subtypeId: "sentinel"
    });

    expect(result.subtype?.id).toBe("sentinel");
    expect(result.core.subtypeAddedSkillIds).toEqual(["discipline", "literacy"]);
    expect(result.favored.subtypeAddedGroupIds).toEqual(["social"]);
  });

  it("deduplicates duplicate groups between family and subtype", () => {
    const result = resolveEffectiveProfessionPackage({
      content: professionResolverContent,
      subtypeId: "sentinel"
    });

    expect(result.core.finalEffectiveGroupIds).toEqual(["martial"]);
  });

  it("deduplicates duplicate skills between family and subtype", () => {
    const result = resolveEffectiveProfessionPackage({
      content: professionResolverContent,
      subtypeId: "sentinel"
    });

    expect(result.core.finalEffectiveSkillIds).toEqual(["melee", "discipline", "literacy"]);
  });

  it("separates direct skills already covered by groups from direct-only extras", () => {
    const result = resolveEffectiveProfessionPackage({
      content: professionResolverContent,
      subtypeId: "sentinel"
    });

    expect(result.core.directSkillsCoveredByGroups).toEqual(["melee", "discipline"]);
    expect(result.core.directOnlySkillIds).toEqual(["literacy"]);
  });

  it("resolves favored package data separately from core", () => {
    const result = resolveEffectiveProfessionPackage({
      content: professionResolverContent,
      subtypeId: "sentinel"
    });

    expect(result.favored.finalEffectiveGroupIds).toEqual(["social", "scholarly"]);
    expect(result.favored.finalEffectiveSkillIds).toEqual(["etiquette", "appraisal"]);
    expect(result.core.finalEffectiveGroupIds).toEqual(["martial"]);
  });

  it("returns correct effective reachable counts in a mixed case", () => {
    const result = resolveEffectiveProfessionPackage({
      content: professionResolverContent,
      subtypeId: "sentinel"
    });

    expect(result.summary.totalEffectiveCoreReachableSkills).toBe(3);
    expect(result.summary.totalEffectiveFavoredReachableSkills).toBe(4);
    expect(result.favored.finalEffectiveReachableSkillIds).toEqual([
      "etiquette",
      "appraisal",
      "lore",
      "literacy"
    ]);
  });
});
