import { describe, expect, it } from "vitest";

import type { CharacterBuild, SkillDefinition, SkillGroupDefinition } from "@glantri/domain";
import { glantriCharacteristicLabels, glantriCharacteristicOrder } from "@glantri/domain";

import {
  addCharacterSkillGroup,
  buildAvailableCharacterEditSkillGroups,
  buildCharacterEditSkillGroupRows,
  buildCharacterEditSkillRows,
  addCharacterSkill,
  buildCharacterEditStatRows,
  getCharacterEditSheetSummary,
  removeCharacterSkill,
  setCharacterDistractionLevel,
  setCharacterCurrentStatValue,
  setCharacterSkillGroupLevel,
  setCharacterSkillXp
} from "./characterEdit";

const skills: SkillDefinition[] = [
  {
    allowsSpecializations: false,
    category: "ordinary",
    dependencies: [],
    dependencySkillIds: [],
    groupId: "awareness",
    groupIds: ["awareness"],
    id: "perception",
    isTheoretical: false,
    linkedStats: ["int", "pow", "lck"],
    name: "Perception",
    requiresLiteracy: "no",
    societyLevel: 1,
    sortOrder: 1
  },
  {
    allowsSpecializations: false,
    category: "secondary",
    dependencies: [],
    dependencySkillIds: [],
    groupId: "martial",
    groupIds: ["martial"],
    id: "combat_experience",
    isTheoretical: false,
    linkedStats: ["int", "pow"],
    name: "Combat Experience",
    requiresLiteracy: "no",
    societyLevel: 1,
    sortOrder: 2
  }
];

const skillGroups: SkillGroupDefinition[] = [
  {
    description: "Awareness",
    id: "awareness",
    name: "Awareness",
    sortOrder: 1
  },
  {
    description: "Martial",
    id: "martial",
    name: "Martial",
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
  specializations: []
};

describe("characterEdit helpers", () => {
  it("persists current stat edits as stat modifiers and updates derived rows", () => {
    const updatedBuild = setCharacterCurrentStatValue(baseBuild, "str", 14);
    const summary = getCharacterEditSheetSummary(updatedBuild, content);
    const rows = buildCharacterEditStatRows(
      updatedBuild,
      summary,
      glantriCharacteristicLabels,
      glantriCharacteristicOrder
    );
    const strengthRow = rows.find((row) => row.stat === "str");

    expect(updatedBuild.profile.rolledStats.str).toBe(11);
    expect(updatedBuild.statModifiers?.str).toBe(3);
    expect(summary.adjustedStats.str).toBe(14);
    expect(strengthRow).toMatchObject({
      currentValue: 14,
      originalValue: 11
    });
  });

  it("includes distraction in profile stat rows and persists distraction edits", () => {
    const updatedBuild = setCharacterDistractionLevel(baseBuild, 5);
    const summary = getCharacterEditSheetSummary(updatedBuild, content);
    const rows = buildCharacterEditStatRows(
      updatedBuild,
      summary,
      glantriCharacteristicLabels,
      glantriCharacteristicOrder
    );
    const distractionRow = rows.find((row) => row.stat === "distraction");

    expect(updatedBuild.profile.distractionLevel).toBe(5);
    expect(summary.distractionLevel).toBe(5);
    expect(distractionRow).toMatchObject({
      currentValue: 5,
      gmValue: 5,
      isDirectEdit: true,
      label: "Distraction",
      originalValue: 5
    });
  });

  it("adds, updates, and removes skill/group progression while derived totals update", () => {
    const withGroup = setCharacterSkillGroupLevel(baseBuild, "awareness", 4);
    const withSkill = addCharacterSkill(withGroup, skills[0]);
    const withXp = setCharacterSkillXp(withSkill, skills[0], 3);
    const summary = getCharacterEditSheetSummary(withXp, content);
    const perception = summary.draftView.skills.find((skill) => skill.skillId === "perception");
    const removed = removeCharacterSkill(withXp, "perception");

    expect(perception).toMatchObject({
      groupLevel: 4,
      linkedStatAverage: 12,
      specificSkillLevel: 3,
      totalSkill: 19
    });
    expect(removed.progression.skills).toEqual([]);
  });

  it("shows only groups with positive current XP and lets hidden groups be added back", () => {
    const withAwareness = setCharacterSkillGroupLevel(baseBuild, "awareness", 4);
    const summary = getCharacterEditSheetSummary(withAwareness, content);

    expect(
      buildCharacterEditSkillGroupRows({
        content,
        sheetSummary: summary
      })
    ).toEqual([{ groupId: "awareness", level: 4, name: "Awareness" }]);

    expect(
      buildAvailableCharacterEditSkillGroups({
        content,
        sheetSummary: summary
      })
    ).toEqual([{ groupId: "martial", level: 0, name: "Martial" }]);

    const withAddedHiddenGroup = addCharacterSkillGroup(withAwareness, "martial");
    const updatedSummary = getCharacterEditSheetSummary(withAddedHiddenGroup, content);

    expect(
      buildCharacterEditSkillGroupRows({
        content,
        sheetSummary: updatedSummary
      })
    ).toEqual([
      { groupId: "awareness", level: 4, name: "Awareness" },
      { groupId: "martial", level: 1, name: "Martial" }
    ]);
  });

  it("builds skill rows with Group XP, direct XP, Total XP, and Total from the draft view", () => {
    const withGroup = setCharacterSkillGroupLevel(baseBuild, "awareness", 4);
    const withSkill = addCharacterSkill(withGroup, skills[0]);
    const withXp = setCharacterSkillXp(withSkill, skills[0], 3);
    const summary = getCharacterEditSheetSummary(withXp, content);

    expect(
      buildCharacterEditSkillRows({
        build: withXp,
        content,
        sheetSummary: summary
      })
    ).toEqual([
      {
        canRemoveDirectXp: true,
        groupXp: 4,
        skillId: "perception",
        skillKey: "perception",
        skillName: "Perception",
        stats: 12,
        total: 19,
        totalXp: 7,
        xp: 3
      }
    ]);
  });

  it("materializes group-derived skills into the edit skill table even without direct skill rows", () => {
    const withGroup = addCharacterSkillGroup(baseBuild, "awareness");
    const summary = getCharacterEditSheetSummary(withGroup, content);

    expect(
      buildCharacterEditSkillRows({
        build: withGroup,
        content,
        sheetSummary: summary
      })
    ).toEqual([
      {
        canRemoveDirectXp: false,
        groupXp: 1,
        skillId: "perception",
        skillKey: "perception",
        skillName: "Perception",
        stats: 12,
        total: 13,
        totalXp: 1,
        xp: 0
      }
    ]);
  });
});
