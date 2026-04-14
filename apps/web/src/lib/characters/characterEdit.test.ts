import { describe, expect, it } from "vitest";

import type { CharacterBuild, SkillDefinition, SkillGroupDefinition } from "@glantri/domain";
import { glantriCharacteristicLabels, glantriCharacteristicOrder } from "@glantri/domain";

import {
  addCharacterSkill,
  buildCharacterEditStatRows,
  getCharacterEditSheetSummary,
  removeCharacterSkill,
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
});
