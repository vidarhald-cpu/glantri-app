import { describe, expect, it } from "vitest";

import type { CharacterBuild, SkillDefinition, SkillGroupDefinition } from "@glantri/domain";
import { buildCharacterSheetSummary } from "@glantri/rules-engine";

import { buildCharacterSheetSkillRows } from "./characterSheet";

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
  }
];

const skillGroups: SkillGroupDefinition[] = [
  {
    description: "Medicine",
    id: "medicine_group",
    name: "Medicine",
    sortOrder: 1
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
  specializations: []
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
      derivedSourceLabel: "Derived from Medicine",
      derivedXp: 10,
      totalXp: 10
    });
  });
});
