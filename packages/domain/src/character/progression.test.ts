import { describe, expect, it } from "vitest";

import { characterBuildSchema } from "./build";

const baseBuild = {
  equipment: { items: [] },
  id: "legacy-character",
  name: "Legacy Character",
  profile: {
    description: "Legacy test character",
    distractionLevel: 3,
    id: "legacy-profile",
    label: "Legacy",
    rolledStats: {
      cha: 10,
      com: 10,
      con: 10,
      dex: 10,
      health: 10,
      int: 10,
      lck: 10,
      pow: 10,
      siz: 10,
      str: 10,
      will: 10
    },
    societyLevel: 1
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
  }
};

describe("character progression compatibility", () => {
  it("normalizes legacy Court Social skill categories in persisted character builds", () => {
    const parsed = characterBuildSchema.parse({
      ...baseBuild,
      progression: {
        ...baseBuild.progression,
        skills: [
          {
            categoryId: "Court Social",
            groupId: "political_acumen",
            primaryRanks: 1,
            skillId: "intrigue"
          }
        ]
      }
    });

    expect(parsed.progression.skills[0]?.categoryId).toBe("social");
  });

  it("normalizes legacy Leadership skill categories from persisted character builds", () => {
    const parsed = characterBuildSchema.parse({
      ...baseBuild,
      progression: {
        ...baseBuild.progression,
        skills: [
          {
            categoryId: "Leadership",
            groupId: "officer_training",
            groupIds: ["officer_training"],
            primaryRanks: 1,
            skillId: "tactics"
          },
          {
            categoryId: "leadership",
            groupId: "political_acumen",
            groupIds: ["political_acumen"],
            primaryRanks: 1,
            skillId: "insight"
          }
        ]
      }
    });

    expect(parsed.progression.skills.map((skill) => skill.categoryId)).toEqual([
      "military",
      "social"
    ]);
  });

  it("normalizes retired skill group ids in persisted character builds", () => {
    const parsed = characterBuildSchema.parse({
      ...baseBuild,
      progression: {
        ...baseBuild.progression,
        chargenSelections: {
          selectedGroupSlots: [
            {
              groupId: "trap_and_intrusion_work",
              selectedSkillIds: ["trap_handling"],
              slotId: "legacy-slot"
            }
          ],
          selectedLanguageIds: [],
          selectedSkillIds: []
        },
        skillGroups: [
          {
            groupId: "field_soldiering",
            primaryRanks: 1
          }
        ],
        skills: [
          {
            groupId: "officer_training",
            groupIds: ["officer_training"],
            primaryRanks: 1,
            skillId: "tactics"
          }
        ]
      }
    });

    expect(parsed.progression.skillGroups[0]?.groupId).toBe("veteran_soldiering");
    expect(parsed.progression.skills[0]?.groupId).toBe("veteran_leadership");
    expect(parsed.progression.skills[0]?.groupIds).toEqual(["veteran_leadership"]);
    expect(parsed.progression.chargenSelections?.selectedGroupSlots[0]?.groupId).toBe(
      "covert_entry"
    );
  });

  it("normalizes retired duplicate performer profession ids in persisted character builds", () => {
    const parsed = characterBuildSchema.parse({
      ...baseBuild,
      professionId: "entertainers_singer_musician"
    });

    expect(parsed.professionId).toBe("musician");
  });

  it("keeps legacy characters loadable and preserves optional chargen rule-set snapshots", () => {
    const legacy = characterBuildSchema.parse(baseBuild);
    const withRuleSet = characterBuildSchema.parse({
      ...baseBuild,
      chargenRuleSet: {
        exchangeCount: 3,
        flexiblePointFactor: 2,
        id: "chargen-rule-experiment",
        name: "Experimental chargen",
        ordinarySkillPoints: 80,
        statRollCount: 12
      }
    });

    expect(legacy.chargenRuleSet).toBeUndefined();
    expect(withRuleSet.chargenRuleSet?.name).toBe("Experimental chargen");
    expect(withRuleSet.chargenRuleSet?.flexiblePointFactor).toBe(2);
  });
});
