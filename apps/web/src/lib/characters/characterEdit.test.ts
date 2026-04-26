import { describe, expect, it } from "vitest";

import type {
  CharacterBuild,
  SkillDefinition,
  SkillGroupDefinition,
  SkillSpecialization
} from "@glantri/domain";
import { glantriCharacteristicLabels, glantriCharacteristicOrder } from "@glantri/domain";

import {
  addCharacterSkillGroup,
  buildAvailableCharacterEditSkillGroups,
  buildCharacterEditSkillGroupRows,
  buildCharacterEditSkillRows,
  buildCharacterEditSpecializationRows,
  addCharacterSkill,
  buildCharacterEditStatRows,
  getCharacterEditSheetSummary,
  removeCharacterSkill,
  setCharacterAge,
  setCharacterGender,
  setCharacterName,
  setCharacterDistractionLevel,
  setCharacterCurrentStatValue,
  setCharacterNotes,
  setCharacterSpecializationXp,
  setCharacterSkillGroupLevel,
  setCharacterSkillXp,
  setCharacterTitle
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
  },
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
    sortOrder: 3
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
    sortOrder: 4
  },
  {
    allowsSpecializations: false,
    category: "ordinary",
    dependencies: [],
    dependencySkillIds: [],
    derivedGrants: [{ factor: 0.5, skillId: "crossbow" }],
    groupId: "martial",
    groupIds: ["martial"],
    id: "bow",
    isTheoretical: false,
    linkedStats: ["dex"],
    name: "Bow",
    requiresLiteracy: "no",
    societyLevel: 1,
    sortOrder: 5
  },
  {
    allowsSpecializations: false,
    category: "ordinary",
    dependencies: [],
    dependencySkillIds: [],
    derivedGrants: [{ factor: 0.5, skillId: "bow" }],
    groupId: "martial",
    groupIds: ["martial"],
    id: "crossbow",
    isTheoretical: false,
    linkedStats: ["dex"],
    name: "Crossbow",
    requiresLiteracy: "no",
    societyLevel: 1,
    sortOrder: 6
  },
  {
    allowsSpecializations: false,
    category: "secondary",
    dependencies: [],
    dependencySkillIds: [],
    groupId: "martial",
    groupIds: ["martial"],
    id: "longbow",
    isTheoretical: false,
    linkedStats: ["dex"],
    name: "Longbow",
    requiresLiteracy: "no",
    societyLevel: 1,
    sortOrder: 7,
    specializationBridge: {
      parentExcessOffset: 5,
      parentSkillId: "bow",
      reverseFactor: 1,
      threshold: 6
    }
  },
  {
    allowsSpecializations: false,
    category: "ordinary",
    dependencies: [],
    dependencySkillIds: [],
    groupId: "martial",
    groupIds: ["martial"],
    id: "one_handed_edged",
    isTheoretical: false,
    linkedStats: ["dex"],
    name: "1-h edged",
    requiresLiteracy: "no",
    societyLevel: 1,
    sortOrder: 8
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
  },
  {
    description: "Medicine",
    id: "medicine_group",
    name: "Medicine",
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

const fencingSpecialization: SkillSpecialization = {
  id: "fencing",
  minimumGroupLevel: 6,
  minimumParentLevel: 6,
  name: "Fencing",
  skillId: "one_handed_edged",
  sortOrder: 1,
  specializationBridge: {
    parentExcessOffset: 5,
    parentSkillId: "one_handed_edged",
    reverseFactor: 1,
    threshold: 6
  }
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

  it("persists title, age, gender, and notes on the shared character profile", () => {
    const withName = setCharacterName(baseBuild, "Sir Rowan");
    const withTitle = setCharacterTitle(withName, "Sir");
    const withAge = setCharacterAge(withTitle, "34");
    const withGender = setCharacterGender(withAge, "other");
    const withNotes = setCharacterNotes(withGender, "Keeps a ledger of favors.");

    expect(withNotes.name).toBe("Sir Rowan");
    expect(withNotes.profile.title).toBe("Sir");
    expect(withNotes.profile.age).toBe("34");
    expect(withNotes.profile.gender).toBe("other");
    expect(withNotes.profile.notes).toBe("Keeps a ledger of favors.");

    const clearedGender = setCharacterGender(withNotes, "");
    expect(clearedGender.profile.gender).toBeUndefined();
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
    ).toEqual([
      { groupId: "martial", level: 0, name: "Martial" },
      { groupId: "medicine_group", level: 0, name: "Medicine" }
    ]);

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
        derivedXp: 0,
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
        derivedXp: 0,
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

  it("keeps derived-only skills visible in the edit rows and preserves direct XP when the source changes", () => {
    const withMedicine = addCharacterSkill(baseBuild, skills[2]);
    const medicineTen = setCharacterSkillXp(withMedicine, skills[2], 10);
    const derivedSummary = getCharacterEditSheetSummary(medicineTen, content);

    expect(
      buildCharacterEditSkillRows({
        build: medicineTen,
        content,
        sheetSummary: derivedSummary
      }).find((row) => row.skillId === "first_aid")
    ).toMatchObject({
      canRemoveDirectXp: false,
      derivedXp: 10,
      derivedSourceLabel: "Derived from Medicine",
      totalXp: 10,
      xp: 0
    });

    const withFirstAid = addCharacterSkill(medicineTen, skills[3]);
    const firstAidThirteen = setCharacterSkillXp(withFirstAid, skills[3], 13);
    const stackedSummary = getCharacterEditSheetSummary(firstAidThirteen, content);

    expect(
      buildCharacterEditSkillRows({
        build: firstAidThirteen,
        content,
        sheetSummary: stackedSummary
      }).find((row) => row.skillId === "first_aid")
    ).toMatchObject({
      canRemoveDirectXp: true,
      derivedXp: 10,
      derivedSourceLabel: "Derived from Medicine",
      totalXp: 23,
      xp: 13
    });

    const medicineFour = setCharacterSkillXp(firstAidThirteen, skills[2], 4);
    const updatedSummary = getCharacterEditSheetSummary(medicineFour, content);

    expect(
      buildCharacterEditSkillRows({
        build: medicineFour,
        content,
        sheetSummary: updatedSummary
      }).find((row) => row.skillId === "first_aid")
    ).toMatchObject({
      derivedXp: 4,
      derivedSourceLabel: "Derived from Medicine",
      totalXp: 17,
      xp: 13
    });

    const medicineZero = setCharacterSkillXp(baseBuild, skills[2], 0);
    const clearedSummary = getCharacterEditSheetSummary(medicineZero, content);

    expect(
      buildCharacterEditSkillRows({
        build: medicineZero,
        content,
        sheetSummary: clearedSummary
      }).find((row) => row.skillId === "first_aid")
    ).toBeUndefined();
  });

  it("shows ordinary cross-training and specialization-bridge labels in edit rows", () => {
    const bowBuild = setCharacterSkillXp(addCharacterSkill(baseBuild, skills[4]), skills[4], 10);
    const bowSummary = getCharacterEditSheetSummary(bowBuild, content);
    const bowRows = buildCharacterEditSkillRows({
      build: bowBuild,
      content,
      sheetSummary: bowSummary
    });

    expect(bowRows.find((row) => row.skillId === "crossbow")).toMatchObject({
      derivedSourceLabel: "Derived from Bow",
      derivedXp: 5,
      totalXp: 5
    });
    expect(bowRows.find((row) => row.skillId === "longbow")).toMatchObject({
      derivedSourceLabel: "Specialized from Bow",
      derivedXp: 5,
      totalXp: 5
    });

    const crossbowBuild = setCharacterSkillXp(addCharacterSkill(baseBuild, skills[5]), skills[5], 10);
    const crossbowSummary = getCharacterEditSheetSummary(crossbowBuild, content);

    expect(
      buildCharacterEditSkillRows({
        build: crossbowBuild,
        content,
        sheetSummary: crossbowSummary
      }).find((row) => row.skillId === "bow")
    ).toMatchObject({
      derivedSourceLabel: "Derived from Crossbow",
      derivedXp: 5,
      totalXp: 5
    });
  });

  it("shows specialization-bridge specializations in edit rows", () => {
    const build = {
      ...baseBuild,
      progression: {
        ...baseBuild.progression,
        skills: [
          {
            category: "ordinary" as const,
            grantedRanks: 0,
            groupId: "martial",
            level: 10,
            primaryRanks: 10,
            ranks: 10,
            secondaryRanks: 0,
            skillId: "bow"
          }
        ]
      }
    };
    const summary = getCharacterEditSheetSummary(build, {
      ...content,
      specializations: [
        {
          id: "longbow_style",
          minimumGroupLevel: 6,
          minimumParentLevel: 6,
          name: "Longbow Style",
          skillId: "bow",
          sortOrder: 1,
          specializationBridge: {
            parentExcessOffset: 5,
            parentSkillId: "bow",
            reverseFactor: 1,
            threshold: 6
          }
        }
      ]
    });
    const rows = buildCharacterEditSpecializationRows({
      build,
      content: {
        ...content,
        specializations: [
          {
            id: "longbow_style",
            minimumGroupLevel: 6,
            minimumParentLevel: 6,
            name: "Longbow Style",
            skillId: "bow",
            sortOrder: 1,
            specializationBridge: {
              parentExcessOffset: 5,
              parentSkillId: "bow",
              reverseFactor: 1,
              threshold: 6
            }
          }
        ]
      },
      sheetSummary: summary
    });

    expect(rows).toContainEqual(
      expect.objectContaining({
        derivedSourceLabel: "Specialized from Bow",
        derivedXp: 5,
        specializationName: "Longbow Style",
        total: 5,
        xp: 0
      })
    );
  });

  it("allows visible specialization-bridge rows to be directly adjusted and keeps direct XP when the source later drops", () => {
    const bridgeContent = {
      ...content,
      specializations: [fencingSpecialization]
    };
    const sourcedBuild = setCharacterSkillXp(
      addCharacterSkill(baseBuild, skills[7]),
      skills[7],
      8
    );
    const sourcedSummary = getCharacterEditSheetSummary(sourcedBuild, bridgeContent);
    const sourcedRows = buildCharacterEditSpecializationRows({
      build: sourcedBuild,
      content: bridgeContent,
      sheetSummary: sourcedSummary
    });

    expect(sourcedRows).toContainEqual(
      expect.objectContaining({
        canIncreaseDirectXp: true,
        derivedSourceLabel: "Specialized from 1-h edged",
        derivedXp: 3,
        parentSkillName: "1-h edged",
        requiredParentLevel: 6,
        specializationName: "Fencing",
        total: 3,
        xp: 0
      })
    );

    const addedDirect = setCharacterSpecializationXp({
      build: sourcedBuild,
      content: bridgeContent,
      specialization: fencingSpecialization,
      xp: 2
    });

    expect(addedDirect.error).toBeUndefined();

    const addedSummary = getCharacterEditSheetSummary(addedDirect.build, bridgeContent);
    const addedRow = buildCharacterEditSpecializationRows({
      build: addedDirect.build,
      content: bridgeContent,
      sheetSummary: addedSummary
    }).find((row) => row.specializationId === "fencing");

    expect(addedRow).toMatchObject({
      derivedXp: 3,
      total: 5,
      xp: 2
    });

    const loweredSource = setCharacterSkillXp(addedDirect.build, skills[7], 5);
    const loweredSummary = getCharacterEditSheetSummary(loweredSource, bridgeContent);
    const loweredRow = buildCharacterEditSpecializationRows({
      build: loweredSource,
      content: bridgeContent,
      sheetSummary: loweredSummary
    }).find((row) => row.specializationId === "fencing");

    expect(loweredRow).toMatchObject({
      blockingMessage: "Fencing requires 1-h edged level 6 or higher (current 5).",
      canDecreaseDirectXp: true,
      canIncreaseDirectXp: false,
      derivedXp: 0,
      total: 2,
      xp: 2
    });
  });
});
