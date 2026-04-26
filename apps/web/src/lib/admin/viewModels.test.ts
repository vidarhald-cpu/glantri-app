import { describe, expect, it } from "vitest";

import type { CanonicalContent } from "@glantri/content";

import {
  buildProfessionAdminRows,
  buildSkillRelationshipSummary,
  buildSkillAdminRows,
  buildSkillGroupAdminRows,
  buildSocietyAdminRows
} from "./viewModels";

const content = {
  civilizations: [],
  languages: [],
  professionFamilies: [
    { id: "craft", name: "Craft" },
    { id: "martial", name: "Martial" }
  ],
  professionSkills: [
    {
      grantType: "group",
      isCore: true,
      professionId: "alpha_prof",
      scope: "profession",
      skillGroupId: "low_group"
    },
    {
      grantType: "group",
      isCore: false,
      professionId: "bravo_prof",
      scope: "profession",
      skillGroupId: "high_group"
    }
  ],
  professions: [
    {
      description: "Zed profession",
      familyId: "martial",
      id: "bravo_prof",
      name: "Zulu Profession",
      subtypeName: "Zulu Profession"
    },
    {
      description: "Alpha profession",
      familyId: "craft",
      id: "alpha_prof",
      name: "Alpha Profession",
      subtypeName: "Alpha Profession"
    }
  ],
  skillGroups: [
    {
      description: "Lighter package",
      id: "low_group",
      name: "A Light Group",
      skillMemberships: [{ relevance: "core", skillId: "zeta_skill" }],
      sortOrder: 99
    },
    {
      description: "Heavy package",
      id: "high_group",
      name: "Z Heavy Group",
      skillMemberships: [
        { relevance: "core", skillId: "alpha_skill" },
        { relevance: "core", skillId: "beta_skill" },
        { relevance: "core", skillId: "gamma_skill" },
        { relevance: "core", skillId: "delta_skill" },
        { relevance: "core", skillId: "epsilon_skill" },
        { relevance: "core", skillId: "eta_skill" }
      ],
      sortOrder: 1
    }
  ],
  skills: [
    {
      allowsSpecializations: false,
      category: "ordinary",
      categoryId: "combat",
      dependencies: [],
      dependencySkillIds: [],
      description: "Zeta description",
      groupId: "low_group",
      groupIds: ["low_group"],
      id: "zeta_skill",
      linkedStats: ["dex"],
      name: "Zeta Skill",
      requiresLiteracy: "no",
      shortDescription: "Zeta short",
      societyLevel: 1,
      sortOrder: 99
    },
    {
      allowsSpecializations: false,
      category: "ordinary",
      categoryId: "craft",
      dependencies: [],
      dependencySkillIds: [],
      derivedGrants: [{ factor: 1, skillId: "beta_skill" }],
      description: "Alpha description",
      groupId: "high_group",
      groupIds: ["high_group"],
      id: "alpha_skill",
      linkedStats: ["dex"],
      meleeCrossTraining: {
        attackStyle: "slash",
        handClass: "one-handed"
      },
      name: "Alpha Skill",
      requiresLiteracy: "no",
      shortDescription: "Alpha short",
      societyLevel: 1,
      sortOrder: 2
    },
    {
      allowsSpecializations: false,
      category: "ordinary",
      categoryId: "craft",
      dependencies: [],
      dependencySkillIds: [],
      groupId: "high_group",
      groupIds: ["high_group"],
      id: "beta_skill",
      linkedStats: ["dex"],
      name: "Beta Skill",
      requiresLiteracy: "no",
      societyLevel: 1,
      sortOrder: 3
    },
    {
      allowsSpecializations: false,
      category: "ordinary",
      categoryId: "craft",
      dependencies: [],
      dependencySkillIds: [],
      groupId: "high_group",
      groupIds: ["high_group"],
      id: "gamma_skill",
      linkedStats: ["dex"],
      name: "Gamma Skill",
      requiresLiteracy: "no",
      societyLevel: 1,
      sortOrder: 4
    },
    {
      allowsSpecializations: false,
      category: "ordinary",
      categoryId: "craft",
      dependencies: [],
      dependencySkillIds: [],
      groupId: "high_group",
      groupIds: ["high_group"],
      id: "delta_skill",
      linkedStats: ["dex"],
      name: "Delta Skill",
      requiresLiteracy: "no",
      societyLevel: 1,
      sortOrder: 5
    },
    {
      allowsSpecializations: false,
      category: "ordinary",
      categoryId: "craft",
      dependencies: [],
      dependencySkillIds: [],
      groupId: "high_group",
      groupIds: ["high_group"],
      id: "epsilon_skill",
      linkedStats: ["dex"],
      name: "Epsilon Skill",
      requiresLiteracy: "no",
      societyLevel: 1,
      sortOrder: 6
    },
    {
      allowsSpecializations: false,
      category: "ordinary",
      categoryId: "craft",
      dependencies: [],
      dependencySkillIds: [],
      groupId: "high_group",
      groupIds: ["high_group"],
      id: "eta_skill",
      linkedStats: ["dex"],
      name: "Eta Skill",
      requiresLiteracy: "no",
      societyLevel: 1,
      sortOrder: 7
    }
  ],
  societies: [
    {
      id: "z_society",
      name: "Zulu Society",
      shortDescription: "Zulu description",
      societyLevel: 2
    },
    {
      id: "a_society",
      name: "Alpha Society",
      shortDescription: "Alpha description",
      societyLevel: 1
    }
  ],
  societyBandSkillAccess: [],
  societyLevels: [
    {
      professionIds: ["bravo_prof"],
      skillGroupIds: ["high_group"],
      skillIds: [],
      socialClass: "Elite",
      societyId: "z_society",
      societyLevel: 2,
      societyName: "Zulu Society"
    },
    {
      professionIds: ["alpha_prof"],
      skillGroupIds: ["low_group"],
      skillIds: [],
      socialClass: "Common",
      societyId: "a_society",
      societyLevel: 1,
      societyName: "Alpha Society"
    }
  ],
  specializations: []
} as unknown as CanonicalContent;

describe("admin view models", () => {
  it("sorts skills alphabetically for the catalog rows", () => {
    expect(buildSkillAdminRows(content).map((row) => row.name)).toEqual([
      "Alpha Skill",
      "Beta Skill",
      "Delta Skill",
      "Epsilon Skill",
      "Eta Skill",
      "Gamma Skill",
      "Zeta Skill"
    ]);
  });

  it("surfaces outgoing, incoming, and melee relationship metadata in skill admin rows", () => {
    const rows = buildSkillAdminRows(content);
    const alphaRow = rows.find((row) => row.id === "alpha_skill");
    const betaRow = rows.find((row) => row.id === "beta_skill");

    expect(alphaRow).toMatchObject({
      hasSkillRelationships: true,
      meleeCrossTraining: {
        attackStyle: "slash",
        handClass: "one-handed"
      }
    });
    expect(alphaRow?.outgoingDerivedGrants).toEqual([
      {
        factorPercent: 100,
        targetSkillId: "beta_skill",
        targetSkillName: "Beta Skill"
      }
    ]);
    expect(betaRow?.incomingDerivedGrants).toEqual([
      {
        factorPercent: 100,
        sourceSkillId: "alpha_skill",
        sourceSkillName: "Alpha Skill"
      }
    ]);
  });

  it("builds a normalized relationship summary from the current enriched content", () => {
    expect(
      buildSkillRelationshipSummary({
        content,
        skillId: "alpha_skill"
      })
    ).toMatchObject({
      hasSkillRelationships: true,
      outgoingDerivedGrants: [
        {
          factorPercent: 100,
          targetSkillId: "beta_skill",
          targetSkillName: "Beta Skill"
        }
      ],
      relationshipIndicators: ["derived-out", "melee-map"]
    });
  });

  it("adds low and high weighted-point warnings to skill-group review rows", () => {
    const rows = buildSkillGroupAdminRows(content);
    const lowGroup = rows.find((row) => row.id === "low_group");
    const highGroup = rows.find((row) => row.id === "high_group");

    expect(lowGroup?.warningDetails.some((warning) => warning.includes("low-size review threshold (5)"))).toBe(true);
    expect(highGroup?.warningDetails.some((warning) => warning.includes("high-size review threshold (12)"))).toBe(true);
  });

  it("sorts professions alphabetically for the catalog rows", () => {
    expect(buildProfessionAdminRows(content).map((row) => row.name)).toEqual([
      "Alpha Profession",
      "Zulu Profession"
    ]);
  });

  it("sorts society review rows alphabetically by society name", () => {
    expect(buildSocietyAdminRows(content).map((row) => row.society)).toEqual([
      "Alpha Society",
      "Zulu Society"
    ]);
  });
});
