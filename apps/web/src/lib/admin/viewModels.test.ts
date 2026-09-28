import { describe, expect, it } from "vitest";

import { defaultCanonicalContent, type CanonicalContent } from "@glantri/content";

import {
  buildProfessionFamilyFilterOptions,
  buildProfessionAdminRows,
  buildSkillRelationshipSummary,
  buildSkillAdminRows,
  buildSkillGroupAdminRows,
  filterProfessionAdminRowsBySocietyStage,
  getProfessionFamilyName,
  buildSocietyAdminRows,
} from "./viewModels";

const content = {
  civilizations: [],
  languages: [],
  professionFamilies: [
    { id: "craft", name: "Craft" },
    { id: "martial", name: "Martial" },
  ],
  professionSkills: [
    {
      grantType: "group",
      isCore: true,
      professionId: "alpha_prof",
      scope: "profession",
      skillGroupId: "low_group",
    },
    {
      grantType: "group",
      isCore: false,
      professionId: "bravo_prof",
      scope: "profession",
      skillGroupId: "high_group",
    },
  ],
  professions: [
    {
      description: "Zed profession",
      familyId: "martial",
      id: "bravo_prof",
      name: "Zulu Profession",
      subtypeName: "Zulu Profession",
    },
    {
      description: "Alpha profession",
      familyId: "craft",
      id: "alpha_prof",
      name: "Alpha Profession",
      subtypeName: "Alpha Profession",
    },
  ],
  skillGroups: [
    {
      description: "Lighter package",
      id: "low_group",
      name: "A Light Group",
      skillMemberships: [{ relevance: "core", skillId: "zeta_skill" }],
      sortOrder: 99,
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
        { relevance: "core", skillId: "eta_skill" },
      ],
      sortOrder: 1,
    },
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
      sortOrder: 99,
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
        handClass: "one-handed",
      },
      name: "Alpha Skill",
      requiresLiteracy: "no",
      shortDescription: "Alpha short",
      societyLevel: 1,
      sortOrder: 2,
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
      meleeCrossTraining: {
        attackStyle: "strike",
        handClass: "one-handed",
      },
      name: "Beta Skill",
      requiresLiteracy: "no",
      societyLevel: 1,
      sortOrder: 3,
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
      sortOrder: 4,
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
      sortOrder: 5,
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
      sortOrder: 6,
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
      sortOrder: 7,
    },
    {
      allowsSpecializations: false,
      category: "ordinary",
      categoryId: "combat",
      dependencies: [],
      dependencySkillIds: [],
      groupId: "high_group",
      groupIds: ["high_group"],
      id: "one_handed_edged",
      linkedStats: ["dex"],
      name: "1-h edged",
      requiresLiteracy: "no",
      societyLevel: 1,
      sortOrder: 8,
    },
    {
      allowsSpecializations: false,
      category: "ordinary",
      categoryId: "combat",
      dependencies: [],
      dependencySkillIds: [],
      derivedGrants: [{ factor: 0.5, skillId: "crossbow" }],
      groupId: "high_group",
      groupIds: ["high_group"],
      id: "bow",
      linkedStats: ["dex"],
      name: "Bow",
      requiresLiteracy: "no",
      societyLevel: 1,
      sortOrder: 9,
    },
    {
      allowsSpecializations: false,
      category: "ordinary",
      categoryId: "combat",
      dependencies: [],
      dependencySkillIds: [],
      derivedGrants: [{ factor: 0.5, skillId: "bow" }],
      groupId: "high_group",
      groupIds: ["high_group"],
      id: "crossbow",
      linkedStats: ["dex"],
      name: "Crossbow",
      requiresLiteracy: "no",
      societyLevel: 1,
      sortOrder: 10,
    },
    {
      allowsSpecializations: false,
      category: "secondary",
      categoryId: "combat",
      dependencies: [],
      dependencySkillIds: [],
      groupId: "high_group",
      groupIds: ["high_group"],
      id: "longbow",
      linkedStats: ["dex"],
      name: "Longbow",
      requiresLiteracy: "no",
      societyLevel: 2,
      sortOrder: 11,
      specializationOfSkillId: "bow",
    },
  ],
  societies: [
    {
      id: "z_society",
      name: "Zulu Society",
      shortDescription: "Zulu description",
      societyLevel: 2,
    },
    {
      id: "a_society",
      name: "Alpha Society",
      shortDescription: "Alpha description",
      societyLevel: 1,
    },
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
      societyName: "Zulu Society",
    },
    {
      professionIds: ["alpha_prof"],
      skillGroupIds: ["low_group"],
      skillIds: [],
      socialClass: "Common",
      societyId: "a_society",
      societyLevel: 1,
      societyName: "Alpha Society",
    },
  ],
  specializations: [
    {
      id: "longbow",
      minimumGroupLevel: 6,
      minimumParentLevel: 6,
      name: "Longbow",
      skillId: "bow",
      sortOrder: 11,
    },
    {
      id: "fencing",
      minimumGroupLevel: 6,
      minimumParentLevel: 6,
      name: "Fencing",
      skillId: "one_handed_edged",
      sortOrder: 1,
    },
  ],
} as unknown as CanonicalContent;

describe("admin view models", () => {
  it("sorts skills alphabetically for the catalog rows", () => {
    expect(buildSkillAdminRows(content).map((row) => row.name)).toEqual([
      "1-h edged",
      "Alpha Skill",
      "Beta Skill",
      "Bow",
      "Crossbow",
      "Delta Skill",
      "Epsilon Skill",
      "Eta Skill",
      "Fencing",
      "Gamma Skill",
      "Longbow",
      "Zeta Skill",
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
        handClass: "one-handed",
      },
    });
    expect(alphaRow?.outgoingMeleeCrossTraining).toEqual([
      {
        factorPercent: 75,
        targetSkillId: "beta_skill",
        targetSkillName: "Beta Skill",
      },
    ]);
    expect(alphaRow?.outgoingDerivedGrants).toEqual([
      {
        factorPercent: 100,
        targetSkillId: "beta_skill",
        targetSkillName: "Beta Skill",
      },
    ]);
    expect(betaRow?.incomingDerivedGrants).toEqual([
      {
        factorPercent: 100,
        sourceSkillId: "alpha_skill",
        sourceSkillName: "Alpha Skill",
      },
    ]);
  });

  it("builds a normalized relationship summary from the current enriched content", () => {
    expect(
      buildSkillRelationshipSummary({
        content,
        skillId: "alpha_skill",
      }),
    ).toMatchObject({
      hasSkillRelationships: true,
      incomingMeleeCrossTraining: [
        {
          factorPercent: 75,
          sourceSkillId: "beta_skill",
          sourceSkillName: "Beta Skill",
        },
      ],
      outgoingMeleeCrossTraining: [
        {
          factorPercent: 75,
          targetSkillId: "beta_skill",
          targetSkillName: "Beta Skill",
        },
      ],
      outgoingDerivedGrants: [
        {
          factorPercent: 100,
          targetSkillId: "beta_skill",
          targetSkillName: "Beta Skill",
        },
      ],
      relationshipSummaryBadges: ["Grants 1", "Cross-trains 1", "Cross-trained from 1"],
    });
  });

  it("surfaces derived-grant relationships for parent and child skills and no bridge rows", () => {
    const rows = buildSkillAdminRows(content);
    const bowRow = rows.find((row) => row.id === "bow");
    const crossbowRow = rows.find((row) => row.id === "crossbow");
    const longbowRow = rows.find((row) => row.id === "longbow");
    const edgedRow = rows.find((row) => row.id === "one_handed_edged");

    expect(bowRow?.outgoingDerivedGrants).toEqual([
      {
        factorPercent: 50,
        targetSkillId: "crossbow",
        targetSkillName: "Crossbow",
      },
    ]);
    /* Rule decision 0010 ruling 5 deletes the bridge, so the admin rows carry no bridge collections
       and publish no numeric factor for a Specialization's parent relationship. */
    expect(bowRow).not.toHaveProperty("outgoingSpecializationBridges");
    expect(longbowRow).not.toHaveProperty("incomingSpecializationBridges");
    expect(crossbowRow?.incomingDerivedGrants).toEqual([
      {
        factorPercent: 50,
        sourceSkillId: "bow",
        sourceSkillName: "Bow",
      },
    ]);
    expect(crossbowRow?.outgoingDerivedGrants).toEqual([
      {
        factorPercent: 50,
        targetSkillId: "bow",
        targetSkillName: "Bow",
      },
    ]);
    expect(edgedRow?.relationshipSummaryBadges).not.toContain("Specializes 1");
    expect(edgedRow).not.toHaveProperty("outgoingSpecializationBridges");
  });

  it("includes specialization-only entries in the skill admin catalog", () => {
    const rows = buildSkillAdminRows(content);
    const fencingRow = rows.find((row) => row.id === "fencing");

    expect(fencingRow).toMatchObject({
      id: "fencing",
      name: "Fencing",
      primaryGroup: "Z Heavy Group",
      skillCategory: "combat",
      skillType: "specialization",
      specializationOf: "1-h edged",
    });
    expect(fencingRow).not.toHaveProperty("incomingSpecializationBridges");
    expect(fencingRow?.relationshipSummaryBadges).toEqual(["Parent 1-h edged"]);
  });

  it("shows default Glantri Fencing and Longbow as base combat Skills in admin rows", () => {
    /* Rule decision 0010 rulings 1 and 2: both are base combat Skills, so the admin catalogue lists
       them as Skills with no parent and no bridge row. THEY MUST STILL APPEAR — deleting the bridge
       without reclassifying would have removed them from this catalogue entirely. */
    const rows = buildSkillAdminRows(defaultCanonicalContent);
    const fencingRow = rows.find((row) => row.id === "fencing");
    const longbowRow = rows.find((row) => row.id === "longbow");

    for (const row of [fencingRow, longbowRow]) {
      expect(row).toBeDefined();
      expect(row).toMatchObject({ skillCategory: "combat", skillType: "secondary" });
      expect(row?.specializationOf).toBe("");
      expect(row).not.toHaveProperty("incomingSpecializationBridges");
    }
    expect(fencingRow?.name).toBe("Fencing");
    expect(longbowRow?.name).toBe("Longbow");
  });

  it("surfaces default Glantri Etiquette by Culture under the parent High Society category", () => {
    const rows = buildSkillAdminRows(defaultCanonicalContent);
    const etiquetteRow = rows.find((row) => row.id === "etiquette");
    const specializationRow = rows.find((row) => row.id === "etiquette_by_culture");

    expect(etiquetteRow).toMatchObject({
      name: "Etiquette",
      skillCategory: "high-society",
    });
    expect(specializationRow).toMatchObject({
      name: "Etiquette by Culture",
      skillCategory: "high-society",
      skillType: "specialization",
      specializationOf: "Etiquette",
    });
  });

  it("adds low and high weighted-point warnings to skill-group review rows", () => {
    const rows = buildSkillGroupAdminRows(content);
    const lowGroup = rows.find((row) => row.id === "low_group");
    const highGroup = rows.find((row) => row.id === "high_group");

    expect(
      lowGroup?.warningDetails.some((warning) => warning.includes("low-size review threshold (5)")),
    ).toBe(true);
    expect(
      highGroup?.warningDetails.some((warning) =>
        warning.includes("high-size review threshold (12)"),
      ),
    ).toBe(true);
  });

  it("surfaces family-aware profession links for skill-group filtering", () => {
    const rows = buildSkillGroupAdminRows(content);
    const lowGroup = rows.find((row) => row.id === "low_group");
    const highGroup = rows.find((row) => row.id === "high_group");

    expect(lowGroup?.visibleProfessionFamilyIds).toEqual(["craft"]);
    expect(lowGroup?.associatedProfessionLinks).toEqual([
      {
        familyId: "craft",
        familyName: "Craft",
        professionId: "alpha_prof",
        professionName: "Alpha Profession",
      },
    ]);
    expect(highGroup?.visibleProfessionFamilyIds).toEqual(["martial"]);
  });

  it("builds the shared profession-family filter options in display-name order", () => {
    expect(buildProfessionFamilyFilterOptions(content, ["martial", "craft", ""])).toEqual([
      "all",
      "craft",
      "martial",
    ]);
    expect(getProfessionFamilyName(content, "martial")).toBe("Martial");
  });

  it("sorts professions alphabetically for the catalog rows", () => {
    expect(buildProfessionAdminRows(content).map((row) => row.name)).toEqual([
      "Alpha Profession",
      "Zulu Profession",
    ]);
  });

  it("computes profession society-stage availability from canonical society data", () => {
    const rows = buildProfessionAdminRows(content);
    const alpha = rows.find((row) => row.id === "alpha_prof");
    const bravo = rows.find((row) => row.id === "bravo_prof");

    expect(alpha?.societyStageLevels).toEqual([1]);
    expect(alpha?.societyStageSummary).toBe("S1");
    expect(alpha?.allowedSocietySlots).toEqual([
      {
        accessBand: 1,
        canonicalSocietyLevel: 1,
        socialClass: "Common",
        societyName: "Alpha Society",
      },
    ]);
    expect(bravo?.societyStageLevels).toEqual([2]);
    expect(bravo?.societyStageSummary).toBe("S2");
    expect(bravo?.allowedSocietySlots).toEqual([
      {
        accessBand: 2,
        canonicalSocietyLevel: 2,
        socialClass: "Elite",
        societyName: "Zulu Society",
      },
    ]);
  });

  it("filters profession rows by actual society stage rather than social class band", () => {
    const rows = buildProfessionAdminRows(defaultCanonicalContent);
    const stageOneIds = filterProfessionAdminRowsBySocietyStage(rows, 1).map((row) => row.id);
    const stageSixIds = filterProfessionAdminRowsBySocietyStage(rows, 6).map((row) => row.id);
    const allIds = filterProfessionAdminRowsBySocietyStage(rows, "all").map((row) => row.id);
    const tribalWarrior = rows.find((row) => row.id === "tribal_warrior");
    const imperialOfficer = rows.find((row) => row.id === "imperial_officer");
    const farmer = rows.find((row) => row.id === "farmer");

    expect(allIds.length).toBe(rows.length);
    expect(tribalWarrior?.societyStageLevels).toEqual([1, 2]);
    expect(tribalWarrior?.allowedSocietySlots.map((slot) => slot.accessBand)).toEqual(
      expect.arrayContaining([1, 2]),
    );
    expect(stageOneIds).toContain("tribal_warrior");
    expect(stageSixIds).not.toContain("tribal_warrior");

    expect(imperialOfficer?.societyStageLevels).toEqual([6]);
    expect(imperialOfficer?.allowedSocietySlots.map((slot) => slot.accessBand)).toEqual([4]);
    expect(stageOneIds).not.toContain("imperial_officer");
    expect(stageSixIds).toContain("imperial_officer");

    expect(farmer?.societyStageLevels).toEqual([1, 2, 3, 4, 5, 6]);
    expect(stageOneIds).toContain("farmer");
    expect(stageSixIds).toContain("farmer");
  });

  it("sorts society review rows alphabetically by society name", () => {
    expect(buildSocietyAdminRows(content).map((row) => row.society)).toEqual([
      "Alpha Society",
      "Zulu Society",
    ]);
  });
});
