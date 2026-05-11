import { describe, expect, it } from "vitest";

import type { CharacterBuild, SkillDefinition, SkillGroupDefinition } from "@glantri/domain";
import {
  addCharacterProgressionCheck,
  buildCharacterSheetSummary,
  buyCharacterProgressionAttempt,
  grantCharacterProgressionPoints,
  resolveCharacterProgressionAttempts
} from "@glantri/rules-engine";

import {
  buildCharacterSheetProfileStatRows,
  buildCharacterSheetSkillRows,
  buildCharacterSheetSpecializationRows,
  characterSheetSkillsTableColumns,
  characterSheetSpecializationsTableColumns,
  characterSheetStatsTableColumns
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
  },
  {
    allowsSpecializations: false,
    category: "ordinary",
    dependencies: [],
    dependencySkillIds: [],
    groupId: "philosophy_group",
    groupIds: ["philosophy_group"],
    id: "philosophy",
    isTheoretical: true,
    linkedStats: ["int", "pow"],
    name: "Philosophy",
    requiresLiteracy: "required",
    societyLevel: 1,
    sortOrder: 7
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
  },
  {
    description: "Philosophy",
    id: "philosophy_group",
    name: "Philosophy",
    sortOrder: 3
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
    flexiblePointFactor: 1,
    level: 1,
    primaryPoolSpent: 0,
    primaryPoolTotal: 60,
    secondaryPoolSpent: 0,
    secondaryPoolTotal: 0,
    skillGroups: [],
    skills: [],
    specializations: []
  },
  progressionState: {
    availablePoints: 0,
    checks: [],
    history: [],
    pendingAttempts: []
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
  it("defines player-facing Character Sheet table labels", () => {
    expect(characterSheetStatsTableColumns).toEqual([
      "Stat",
      "Stats die roll",
      "Original",
      "Current",
      "GM"
    ]);
    expect(characterSheetSkillsTableColumns).toEqual([
      "Skill",
      "Stats",
      "Avg stats",
      "Group XP",
      "Skill XP",
      "Derived XP",
      "Total XP",
      "Total skill level"
    ]);
    expect(characterSheetSpecializationsTableColumns).toEqual([
      "Specialization",
      "Parent skill",
      "Specialization XP",
      "Derived XP",
      "Total"
    ]);
  });

  it("separates stats die roll from resolved original and current stat values", () => {
    const build: CharacterBuild = {
      ...baseBuild,
      profile: {
        ...baseBuild.profile,
        resolvedStats: {
          ...baseBuild.profile.rolledStats,
          str: 12
        }
      },
      statModifiers: {
        str: 3
      }
    };
    const rows = buildCharacterSheetProfileStatRows(build);
    const strengthRow = rows.find((row) => row.stat === "str");

    expect(strengthRow).toMatchObject({
      currentValue: 12,
      gmValue: 0,
      originalValue: 12,
      statsDieRollValue: 11
    });
  });

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
      grantedSourceLabel: "Granted from Medicine",
      grantedXp: 10,
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
      grantedSourceLabel: "Granted from Bow",
      grantedXp: 5,
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
        grantedSourceLabel: "Specialized from Bow",
        grantedXp: 5,
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
        grantedSourceLabel: "Specialized from 1-h edged",
        grantedXp: 3,
        specializationName: "Fencing",
        total: 5,
        xp: 2
      })
    );
  });

  it("does not show unresolved provisional skills on the Character Sheet", () => {
    const build: CharacterBuild = {
      ...baseBuild,
      progressionState: {
        availablePoints: 2,
        checks: [
          {
            checkedAt: "2026-01-01T00:00:00.000Z",
            id: "check-philosophy",
            provisional: true,
            status: "approved",
            targetId: "philosophy",
            targetLabel: "Philosophy",
            targetType: "skill"
          }
        ],
        history: [],
        pendingAttempts: []
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

    expect(rows.find((row) => row.skillId === "philosophy")).toBeUndefined();
  });

  it("shows successfully resolved provisional skills and current skill-point gains", () => {
    const checked = addCharacterProgressionCheck({
      build: grantCharacterProgressionPoints({ amount: 2, build: baseBuild }),
      content,
      provisional: true,
      targetId: "philosophy",
      targetType: "skill"
    });
    const purchased = buyCharacterProgressionAttempt({
      build: checked,
      content,
      targetId: "philosophy",
      targetType: "skill"
    });
    const resolved = resolveCharacterProgressionAttempts({
      build: purchased.build,
      content,
      rng: () => 0
    });
    const sheetSummary = buildCharacterSheetSummary({
      build: resolved.build,
      content
    });
    const rows = buildCharacterSheetSkillRows({
      build: resolved.build,
      content,
      sheetSummary
    }).flatMap((group) => group.rows);

    expect(rows.find((row) => row.skillId === "philosophy")).toMatchObject({
      skillName: "Philosophy",
      skillXp: 1,
      totalXp: 1
    });
    expect(sheetSummary.skillPoints).toEqual({
      current: 2,
      original: 0,
      successfulProgressionGains: 2
    });
  });
});
