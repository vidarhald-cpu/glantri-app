import { describe, expect, it } from "vitest";

import { buildLoadoutCombatStatsTable } from "./loadoutCombatStats";

describe("buildLoadoutCombatStatsTable", () => {
  it("shows numeric perception stat base and populated combat experience values", () => {
    const table = buildLoadoutCombatStatsTable({
      adjustedStats: {
        int: 12,
        pow: 15,
        lck: 9,
      },
      draftSkills: [
        {
          category: "ordinary",
          effectiveSkillNumber: 7,
          groupId: "mental_group",
          groupIds: ["mental_group"],
          groupLevel: 7,
          linkedStatAverage: 12,
          name: "Perception",
          primaryRanks: 0,
          requiresLiteracy: "no",
          secondaryRanks: 0,
          skillId: "perception",
          specificSkillLevel: 0,
          totalSkill: 19,
        },
        {
          category: "secondary",
          effectiveSkillNumber: 6,
          groupId: "military_group",
          groupIds: ["military_group"],
          groupLevel: 6,
          linkedStatAverage: 14,
          name: "Combat Experience",
          primaryRanks: 0,
          requiresLiteracy: "no",
          secondaryRanks: 0,
          skillId: "combat_experience",
          specificSkillLevel: 0,
          totalSkill: 20,
        },
      ],
      skills: [
        {
          allowsSpecializations: false,
          category: "ordinary",
          dependencies: [],
          dependencySkillIds: [],
          groupId: "mental_group",
          groupIds: ["mental_group"],
          id: "perception",
          isTheoretical: false,
          linkedStats: ["int", "pow", "lck"],
          name: "Perception",
          requiresLiteracy: "no",
          societyLevel: 1,
          sortOrder: 1,
        },
        {
          allowsSpecializations: false,
          category: "secondary",
          dependencies: [],
          dependencySkillIds: [],
          groupId: "military_group",
          groupIds: ["military_group"],
          id: "combat_experience",
          isTheoretical: false,
          linkedStats: ["int", "pow"],
          name: "Combat Experience",
          requiresLiteracy: "no",
          societyLevel: 1,
          sortOrder: 2,
        },
      ],
      workbookPerceptionValue: 23,
    });

    expect(table.columns).toEqual(["Skill", "Stats", "XP", "Total"]);
    expect(table.rows).toEqual([
      ["Perception", 12, 7, 23],
      ["Combat Experience", 14, 6, 20],
    ]);
  });
});

