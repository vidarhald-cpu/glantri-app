import { describe, expect, it } from "vitest";

import type { CharacterBuild, SkillDefinition, SkillGroupDefinition } from "@glantri/domain";
import { buildCharacterSheetSummary } from "@glantri/rules-engine";

import {
  buildCharacterSheetSkillRows,
  buildCharacterSheetSpecializationRows
} from "./characterSheet";

const skills: SkillDefinition[] = [
  {
    allowsSpecializations: false,
    category: "ordinary",
    dependencies: [],
    dependencySkillIds: [],
    derivedGrants: [{ factor: 1, skillId: "first_aid" }],
    groupId: "medicine_group",
    groupIds: ["medicine_group"],
    id: "medicine",
    isTheoretical: false,
    linkedStats: ["int"],
    name: "Medicine",
    requiresLiteracy: "no",
    societyLevel: 1,
    sortOrder: 1
  },
  {
    allowsSpecializations: false,
    category: "ordinary",
    dependencies: [],
    dependencySkillIds: [],
    groupId: "medicine_group",
    groupIds: ["medicine_group"],
    id: "first_aid",
    isTheoretical: false,
    linkedStats: ["int"],
    name: "First aid",
    requiresLiteracy: "no",
    societyLevel: 1,
    sortOrder: 2
  },
  {
    allowsSpecializations: false,
    category: "ordinary",
    dependencies: [],
    dependencySkillIds: [],
    derivedGrants: [{ factor: 0.5, skillId: "crossbow" }],
    groupId: "combat_group",
    groupIds: ["combat_group"],
    id: "bow",
    isTheoretical: false,
    linkedStats: ["dex"],
    name: "Bow",
    requiresLiteracy: "no",
    societyLevel: 1,
    sortOrder: 3
  },
  {
    allowsSpecializations: false,
    category: "ordinary",
    dependencies: [],
    dependencySkillIds: [],
    derivedGrants: [{ factor: 0.5, skillId: "bow" }],
    groupId: "combat_group",
    groupIds: ["combat_group"],
    id: "crossbow",
    isTheoretical: false,
    linkedStats: ["dex"],
    name: "Crossbow",
    requiresLiteracy: "no",
    societyLevel: 1,
    sortOrder: 4
  },
  {
    allowsSpecializations: false,
    category: "secondary",
    dependencies: [],
    dependencySkillIds: [],
    groupId: "combat_group",
    groupIds: ["combat_group"],
    id: "longbow",
    isTheoretical: false,
    linkedStats: ["dex"],
    name: "Longbow",
    requiresLiteracy: "no",
    specializationOfSkillId: "bow",
    societyLevel: 1,
    sortOrder: 5
  },
  {
    allowsSpecializations: false,
    category: "ordinary",
    dependencies: [],
    dependencySkillIds: [],
    groupId: "combat_group",
    groupIds: ["combat_group"],
    id: "one_handed_edged",
    isTheoretical: false,
    linkedStats: ["dex"],
    name: "1-h edged",
    requiresLiteracy: "no",
    societyLevel: 1,
    sortOrder: 6
  }
];

const longbowSpecialization = {
  id: "longbow",
  minimumGroupLevel: 6,
  minimumParentLevel: 6,
  name: "Longbow",
  skillId: "bow",
  sortOrder: 5,
  specializationBridge: {
    parentExcessOffset: 5,
    parentSkillId: "bow",
    reverseFactor: 1,
    threshold: 6
  }
};

const fencingSpecialization = {
  id: "fencing",
  minimumGroupLevel: 6,
  minimumParentLevel: 6,
  name: "Fencing",
  skillId: "one_handed_edged",
  sortOrder: 6,
  specializationBridge: {
    parentExcessOffset: 5,
    parentSkillId: "one_handed_edged",
    reverseFactor: 1,
    threshold: 6
  }
};

const skillGroups: SkillGroupDefinition[] = [
  {
    description: "Medicine",
    id: "medicine_group",
    name: "Medicine",
    sortOrder: 1
  },
  {
    description: "Combat",
    id: "combat_group",
    name: "Combat",
    sortOrder: 2
  }
];

const baseBuild: CharacterBuild = {
  equipment: { items: [] },
  id: "character-1",
  name: "Test Character",
  profile: {
    description: "Test",
    distractionLevel: 3,
    id: "profile-1",
    label: "Profile",
    rolledStats: {
      cha: 10,
      com: 10,
      con: 10,
      dex: 10,
      health: 10,
      int: 12,
      lck: 9,
      pow: 15,
      siz: 10,
      str: 11,
      will: 10
    },
    societyLevel: 0
  },
  progression: {
    chargenMode: "standard",
    educationPoints: 0,
    level: 1,
    primaryPoolSpent: 0,
    primaryPoolTotal: 60,
    secondaryPoolSpent: 0,
    secondaryPoolTotal: 0,
    skillGroups: [],
    skills: [],
    specializations: []
  },
  statModifiers: {}
};

const content = {
  professionFamilies: [],
  professionSkills: [],
  professions: [],
  skillGroups,
  skills,
  societyLevels: [],
  specializations: [longbowSpecialization, fencingSpecialization]
};

describe("buildCharacterSheetSkillRows", () => {
  it("shows derived-only skills on the sheet with a compact source label", () => {
    const build: CharacterBuild = {
      ...baseBuild,
      progression: {
        ...baseBuild.progression,
        skills: [
          {
            category: "ordinary",
            grantedRanks: 0,
            groupId: "medicine_group",
            level: 10,
            primaryRanks: 10,
            ranks: 10,
            secondaryRanks: 0,
            skillId: "medicine"
          }
        ]
      }
    };
    const sheetSummary = buildCharacterSheetSummary({
      build,
      content
    });
    const groupedRows = buildCharacterSheetSkillRows({
      build,
      content,
      sheetSummary
    });
    const firstAidRow = groupedRows.flatMap((group) => group.rows).find((row) => row.skillId === "first_aid");

    expect(firstAidRow).toMatchObject({
      derivedSourceLabel: "Granted from Medicine",
      derivedXp: 10,
      totalXp: 10
    });
  });

  it("shows cross-trained and specialization-bridge skills on the sheet", () => {
    const build: CharacterBuild = {
      ...baseBuild,
      progression: {
        ...baseBuild.progression,
        skills: [
          {
            category: "ordinary",
            grantedRanks: 0,
            groupId: "combat_group",
            level: 10,
            primaryRanks: 10,
            ranks: 10,
            secondaryRanks: 0,
            skillId: "bow"
          }
        ]
      }
    };
    const sheetSummary = buildCharacterSheetSummary({
      build,
      content
    });
    const rows = buildCharacterSheetSkillRows({
      build,
      content,
      sheetSummary
    }).flatMap((group) => group.rows);

    expect(rows.find((row) => row.skillId === "crossbow")).toMatchObject({
      derivedSourceLabel: "Granted from Bow",
      derivedXp: 5,
      totalXp: 5
    });
  });

  it("shows specialization-bridge specializations on the sheet", () => {
    const build: CharacterBuild = {
      ...baseBuild,
      progression: {
        ...baseBuild.progression,
        skills: [
          {
            category: "ordinary",
            grantedRanks: 0,
            groupId: "combat_group",
            level: 10,
            primaryRanks: 10,
            ranks: 10,
            secondaryRanks: 0,
            skillId: "bow"
          }
        ]
      }
    };
    const sheetSummary = buildCharacterSheetSummary({
      build,
      content
    });
    const rows = buildCharacterSheetSpecializationRows({
      content,
      sheetSummary
    });

    expect(rows).toContainEqual(
      expect.objectContaining({
        derivedSourceLabel: "Specialized from Bow",
        derivedXp: 5,
        specializationName: "Longbow",
        total: 5,
        xp: 0
      })
    );
  });

  it("keeps directly purchased specializations visible on the sheet alongside relationship grants", () => {
    const build: CharacterBuild = {
      ...baseBuild,
      progression: {
        ...baseBuild.progression,
        skills: [
          {
            category: "ordinary",
            grantedRanks: 0,
            groupId: "combat_group",
            level: 8,
            primaryRanks: 8,
            ranks: 8,
            secondaryRanks: 0,
            skillId: "one_handed_edged"
          }
        ],
        specializations: [
          {
            level: 5,
            ranks: 5,
            relationshipGrantedRanks: 3,
            secondaryRanks: 2,
            skillId: "one_handed_edged",
            specializationId: "fencing"
          }
        ]
      }
    };
    const sheetSummary = buildCharacterSheetSummary({
      build,
      content
    });
    const rows = buildCharacterSheetSpecializationRows({
      content,
      sheetSummary
    });

    expect(rows).toContainEqual(
      expect.objectContaining({
        derivedSourceLabel: "Specialized from 1-h edged",
        derivedXp: 3,
        specializationName: "Fencing",
        total: 5,
        xp: 2
      })
    );
  });
});
