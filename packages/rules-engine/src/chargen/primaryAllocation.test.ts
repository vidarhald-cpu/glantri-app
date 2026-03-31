import { describe, expect, it } from "vitest";

import { validateCanonicalContent } from "@glantri/content";
import type { CharacterProgression } from "@glantri/domain";

import {
  createChargenProgression,
  spendPrimaryPoint,
  spendSecondaryPoint
} from "./primaryAllocation";

const chargenTestContent = validateCanonicalContent({
  skillGroups: [
    {
      id: "scholarly",
      name: "Scholarly",
      sortOrder: 1
    }
  ],
  skills: [
    {
      id: "literacy",
      groupId: "scholarly",
      groupIds: ["scholarly"],
      name: "Literacy",
      linkedStats: ["int"],
      dependencies: [],
      dependencySkillIds: [],
      category: "ordinary",
      requiresLiteracy: "no",
      sortOrder: 1,
      allowsSpecializations: false
    },
    {
      id: "archives",
      groupId: "scholarly",
      groupIds: ["scholarly"],
      name: "Archives",
      linkedStats: ["int"],
      dependencies: [],
      dependencySkillIds: [],
      category: "ordinary",
      requiresLiteracy: "required",
      sortOrder: 2,
      allowsSpecializations: false
    },
    {
      id: "lore",
      groupId: "scholarly",
      groupIds: ["scholarly"],
      name: "Lore",
      linkedStats: ["int"],
      dependencies: [],
      dependencySkillIds: [],
      category: "ordinary",
      requiresLiteracy: "no",
      sortOrder: 3,
      allowsSpecializations: false
    }
  ],
  specializations: [
    {
      id: "codes",
      skillId: "lore",
      name: "Codes",
      minimumGroupLevel: 1,
      minimumParentLevel: 1,
      sortOrder: 1
    }
  ],
  professionFamilies: [
    {
      id: "scholar",
      name: "Scholar"
    }
  ],
  professions: [
    {
      id: "scribe",
      familyId: "scholar",
      name: "Scribe",
      subtypeName: "Scribe"
    }
  ],
  professionSkills: [
    {
      professionId: "scholar",
      scope: "family",
      grantType: "group",
      skillGroupId: "scholarly",
      isCore: true
    }
  ],
  societyLevels: [
    {
      societyId: "glantri",
      societyLevel: 1,
      societyName: "Glantri",
      socialClass: "Common",
      professionIds: ["scribe"],
      skillGroupIds: ["scholarly"]
    },
    {
      societyId: "glantri",
      societyLevel: 2,
      societyName: "Glantri",
      socialClass: "Guild",
      professionIds: ["scribe"],
      skillGroupIds: ["scholarly"]
    },
    {
      societyId: "glantri",
      societyLevel: 3,
      societyName: "Glantri",
      socialClass: "Patrician",
      professionIds: ["scribe"],
      skillGroupIds: ["scholarly"]
    },
    {
      societyId: "glantri",
      societyLevel: 4,
      societyName: "Glantri",
      socialClass: "Noble",
      professionIds: ["scribe"],
      skillGroupIds: ["scholarly"]
    }
  ]
});

function createProgressionWithLore(): CharacterProgression {
  const progression = createChargenProgression();

  return {
    ...progression,
    skillGroups: [
      {
        gms: 0,
        grantedRanks: 0,
        groupId: "scholarly",
        primaryRanks: 1,
        secondaryRanks: 0,
        ranks: 1
      }
    ],
    skills: [
      {
        category: "ordinary",
        grantedRanks: 0,
        groupId: "scholarly",
        level: 1,
        primaryRanks: 1,
        ranks: 1,
        secondaryRanks: 0,
        skillId: "lore"
      }
    ]
  };
}

describe("chargen purchase gate integration", () => {
  it("uses the evaluator result for literacy-gated skill purchases", () => {
    const result = spendPrimaryPoint({
      content: chargenTestContent,
      professionId: "scribe",
      progression: createChargenProgression(),
      societyId: "glantri",
      societyLevel: 1,
      targetId: "archives",
      targetType: "skill"
    });

    expect(result.error).toBe("Archives requires Literacy.");
    expect(result.warnings).toEqual([]);
  });

  it("uses the evaluator result for specialization availability gating", () => {
    const result = spendSecondaryPoint({
      content: chargenTestContent,
      progression: createProgressionWithLore(),
      societyId: "glantri",
      societyLevel: 1,
      targetId: "codes",
      targetType: "specialization"
    });

    expect(result.error).toBe("Lore does not allow specializations like Codes.");
    expect(result.warnings).toEqual([]);
  });
});
