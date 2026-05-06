import { describe, expect, it } from "vitest";

import { validateCanonicalContent } from "@glantri/content";
import type { CharacterProgression, SkillDefinition, SkillSpecialization } from "@glantri/domain";

import { createChargenProgression } from "../chargen/primaryAllocation";

import { evaluateSkillSelection } from "./evaluateSkillSelection";

const testContent = validateCanonicalContent({
  skillGroups: [
    {
      id: "scholarly",
      name: "Scholarly",
      sortOrder: 1
    },
    {
      id: "social",
      name: "Social",
      sortOrder: 2
    },
    {
      id: "combat",
      name: "Combat",
      sortOrder: 3
    }
  ],
  skills: [
    {
      id: "literacy",
      groupId: "scholarly",
      groupIds: ["scholarly"],
      name: "Literacy",
      linkedStats: ["int", "int"],
      dependencies: [],
      dependencySkillIds: [],
      category: "secondary",
      requiresLiteracy: "no",
      sortOrder: 1,
      allowsSpecializations: false
    },
    {
      id: "history",
      groupId: "scholarly",
      groupIds: ["scholarly"],
      name: "History",
      linkedStats: ["int", "int"],
      dependencies: [
        {
          skillId: "literacy",
          strength: "required"
        }
      ],
      dependencySkillIds: ["literacy"],
      category: "ordinary",
      requiresLiteracy: "no",
      sortOrder: 2,
      allowsSpecializations: false
    },
    {
      id: "etiquette",
      groupId: "social",
      groupIds: ["social"],
      name: "Etiquette",
      linkedStats: ["cha", "int"],
      dependencies: [],
      dependencySkillIds: [],
      category: "ordinary",
      requiresLiteracy: "no",
      sortOrder: 3,
      allowsSpecializations: false
    },
    {
      id: "appraisal",
      groupId: "social",
      groupIds: ["social"],
      name: "Appraisal",
      linkedStats: ["int", "int"],
      dependencies: [
        {
          skillId: "etiquette",
          strength: "recommended"
        }
      ],
      dependencySkillIds: [],
      category: "secondary",
      requiresLiteracy: "no",
      sortOrder: 4,
      allowsSpecializations: false
    },
    {
      id: "insight",
      groupId: "social",
      groupIds: ["social"],
      name: "Insight",
      linkedStats: ["int", "cha"],
      dependencies: [
        {
          skillId: "appraisal",
          strength: "helpful"
        }
      ],
      dependencySkillIds: [],
      category: "secondary",
      requiresLiteracy: "no",
      sortOrder: 5,
      allowsSpecializations: false
    },
    {
      id: "archives",
      groupId: "scholarly",
      groupIds: ["scholarly"],
      name: "Archives",
      linkedStats: ["int", "int"],
      dependencies: [],
      dependencySkillIds: [],
      category: "ordinary",
      requiresLiteracy: "required",
      sortOrder: 6,
      allowsSpecializations: false
    },
    {
      id: "diplomacy",
      groupId: "social",
      groupIds: ["social"],
      name: "Diplomacy",
      linkedStats: ["cha", "int"],
      dependencies: [],
      dependencySkillIds: [],
      category: "ordinary",
      requiresLiteracy: "recommended",
      sortOrder: 7,
      allowsSpecializations: false
    },
    {
      id: "statecraft",
      groupId: "social",
      groupIds: ["social"],
      name: "Statecraft",
      linkedStats: ["int", "cha"],
      dependencies: [
        {
          skillId: "literacy",
          strength: "required"
        },
        {
          skillId: "etiquette",
          strength: "recommended"
        },
        {
          skillId: "appraisal",
          strength: "helpful"
        }
      ],
      dependencySkillIds: ["literacy"],
      category: "ordinary",
      requiresLiteracy: "no",
      sortOrder: 8,
      allowsSpecializations: false
    },
    {
      id: "weapon_training",
      groupId: "combat",
      groupIds: ["combat"],
      name: "Weapon Training",
      linkedStats: ["str", "dex"],
      dependencies: [],
      dependencySkillIds: [],
      category: "ordinary",
      requiresLiteracy: "no",
      sortOrder: 9,
      allowsSpecializations: true
    },
    {
      id: "bow",
      groupId: "combat",
      groupIds: ["combat"],
      name: "Bow",
      linkedStats: ["dex", "dex"],
      dependencies: [],
      dependencySkillIds: [],
      category: "ordinary",
      requiresLiteracy: "no",
      sortOrder: 10,
      allowsSpecializations: false
    },
    {
      id: "crossbow",
      groupId: "combat",
      groupIds: ["combat"],
      name: "Crossbow",
      linkedStats: ["dex", "dex"],
      dependencies: [],
      dependencySkillIds: [],
      category: "ordinary",
      requiresLiteracy: "no",
      sortOrder: 11,
      allowsSpecializations: false
    },
    {
      id: "longbow",
      groupId: "combat",
      groupIds: ["combat"],
      name: "Longbow",
      linkedStats: ["dex", "dex"],
      dependencies: [],
      dependencySkillIds: [],
      category: "secondary",
      requiresLiteracy: "no",
      sortOrder: 12,
      allowsSpecializations: false,
      specializationOfSkillId: "bow"
    },
    {
      id: "one_handed_edged",
      groupId: "combat",
      groupIds: ["combat"],
      name: "1-h edged",
      linkedStats: ["dex", "dex"],
      dependencies: [],
      dependencySkillIds: [],
      category: "ordinary",
      requiresLiteracy: "no",
      sortOrder: 13,
      allowsSpecializations: true
    }
  ],
  specializations: [
    {
      id: "dueling",
      skillId: "weapon_training",
      name: "Dueling",
      minimumGroupLevel: 3,
      minimumParentLevel: 3,
      sortOrder: 1
    },
    {
      id: "court_intrigue",
      skillId: "insight",
      name: "Court Intrigue",
      minimumGroupLevel: 1,
      minimumParentLevel: 1,
      sortOrder: 2
    },
    {
      id: "longbow",
      skillId: "bow",
      name: "Longbow",
      minimumGroupLevel: 6,
      minimumParentLevel: 6,
      sortOrder: 3,
      specializationBridge: {
        parentExcessOffset: 5,
        parentSkillId: "bow",
        reverseFactor: 1,
        threshold: 6
      }
    },
    {
      id: "fencing",
      skillId: "one_handed_edged",
      name: "Fencing",
      minimumGroupLevel: 6,
      minimumParentLevel: 6,
      sortOrder: 4,
      specializationBridge: {
        parentExcessOffset: 5,
        parentSkillId: "one_handed_edged",
        reverseFactor: 1,
        threshold: 6
      }
    }
  ],
  professionFamilies: [],
  professions: [],
  professionSkills: [],
  societyLevels: [
    {
      societyId: "test",
      societyLevel: 1,
      societyName: "Test Society",
      socialClass: "Band 1"
    },
    {
      societyId: "test",
      societyLevel: 2,
      societyName: "Test Society",
      socialClass: "Band 2"
    },
    {
      societyId: "test",
      societyLevel: 3,
      societyName: "Test Society",
      socialClass: "Band 3"
    },
    {
      societyId: "test",
      societyLevel: 4,
      societyName: "Test Society",
      socialClass: "Band 4"
    }
  ]
});

function getSkill(skillId: string): SkillDefinition {
  const skill = testContent.skills.find((candidate) => candidate.id === skillId);

  if (!skill) {
    throw new Error(`Missing test skill ${skillId}.`);
  }

  return skill;
}

function getSpecialization(specializationId: string): SkillSpecialization {
  const specialization = testContent.specializations.find(
    (candidate) => candidate.id === specializationId
  );

  if (!specialization) {
    throw new Error(`Missing test specialization ${specializationId}.`);
  }

  return specialization;
}

function buildProgression(
  skillRanks: Record<string, number>,
  groupRanks: Record<string, number> = {}
): CharacterProgression {
  return {
    ...createChargenProgression(),
    skillGroups: Object.entries(groupRanks).map(([groupId, ranks]) => ({
      gms: 0,
      grantedRanks: 0,
      groupId,
      primaryRanks: ranks,
      ranks,
      secondaryRanks: 0
    })),
    skills: Object.entries(skillRanks).map(([skillId, ranks]) => {
      const skill = getSkill(skillId);

      return {
        category: skill.category,
        grantedRanks: 0,
        groupId: skill.groupId,
        level: ranks,
        primaryRanks: ranks,
        ranks,
        secondaryRanks: 0,
        skillId
      };
    })
  };
}

describe("evaluateSkillSelection", () => {
  it("blocks when a required dependency is missing", () => {
    const evaluation = evaluateSkillSelection({
      content: testContent,
      progression: buildProgression({}),
      target: {
        skill: getSkill("history"),
        targetType: "skill"
      }
    });

    expect(evaluation.isAllowed).toBe(false);
    expect(evaluation.blockingReasons.map((reason) => reason.code)).toEqual([
      "missing-required-dependency"
    ]);
    expect(evaluation.blockingReasons[0]?.message).toContain("Literacy");
  });

  it("allows when a required dependency is satisfied", () => {
    const evaluation = evaluateSkillSelection({
      content: testContent,
      progression: buildProgression({ literacy: 1 }),
      target: {
        skill: getSkill("history"),
        targetType: "skill"
      }
    });

    expect(evaluation.isAllowed).toBe(true);
    expect(evaluation.blockingReasons).toHaveLength(0);
    expect(evaluation.warnings).toHaveLength(0);
    expect(evaluation.advisories).toHaveLength(0);
  });

  it("allows when a required dependency is satisfied through effective group XP", () => {
    const evaluation = evaluateSkillSelection({
      content: testContent,
      progression: buildProgression({}, { scholarly: 1 }),
      target: {
        skill: getSkill("history"),
        targetType: "skill"
      }
    });

    expect(evaluation.isAllowed).toBe(true);
    expect(evaluation.blockingReasons).toHaveLength(0);
  });

  it("warns but allows when a recommended dependency is missing", () => {
    const evaluation = evaluateSkillSelection({
      content: testContent,
      progression: buildProgression({}),
      target: {
        skill: getSkill("appraisal"),
        targetType: "skill"
      }
    });

    expect(evaluation.isAllowed).toBe(true);
    expect(evaluation.blockingReasons).toHaveLength(0);
    expect(evaluation.warnings.map((warning) => warning.code)).toEqual([
      "missing-recommended-dependency"
    ]);
    expect(evaluation.advisories).toHaveLength(0);
  });

  it("clears recommended dependency warnings when support is present through group XP", () => {
    const evaluation = evaluateSkillSelection({
      content: testContent,
      progression: buildProgression({}, { social: 1 }),
      target: {
        skill: getSkill("appraisal"),
        targetType: "skill"
      }
    });

    expect(evaluation.isAllowed).toBe(true);
    expect(evaluation.warnings).toHaveLength(0);
  });

  it("advises but allows when a helpful dependency is missing", () => {
    const evaluation = evaluateSkillSelection({
      content: testContent,
      progression: buildProgression({}),
      target: {
        skill: getSkill("insight"),
        targetType: "skill"
      }
    });

    expect(evaluation.isAllowed).toBe(true);
    expect(evaluation.blockingReasons).toHaveLength(0);
    expect(evaluation.warnings).toHaveLength(0);
    expect(evaluation.advisories.map((advisory) => advisory.code)).toEqual([
      "missing-helpful-dependency"
    ]);
  });

  it("blocks when literacy is required by metadata", () => {
    const evaluation = evaluateSkillSelection({
      content: testContent,
      progression: buildProgression({}),
      target: {
        skill: getSkill("archives"),
        targetType: "skill"
      }
    });

    expect(evaluation.isAllowed).toBe(false);
    expect(evaluation.blockingReasons.map((reason) => reason.code)).toEqual([
      "missing-required-literacy"
    ]);
    expect(evaluation.blockingReasons[0]?.message).toBe("Archives requires Literacy.");
  });

  it("warns when literacy is recommended by metadata", () => {
    const evaluation = evaluateSkillSelection({
      content: testContent,
      progression: buildProgression({}),
      target: {
        skill: getSkill("diplomacy"),
        targetType: "skill"
      }
    });

    expect(evaluation.isAllowed).toBe(true);
    expect(evaluation.blockingReasons).toHaveLength(0);
    expect(evaluation.warnings.map((warning) => warning.code)).toEqual([
      "missing-recommended-literacy"
    ]);
    expect(evaluation.warnings[0]?.message).toBe("Diplomacy recommends Literacy.");
  });

  it("blocks a specialization-bridge specialization when the parent source level is missing or too low", () => {
    const missingParent = evaluateSkillSelection({
      content: testContent,
      progression: buildProgression({}),
      target: {
        specialization: getSpecialization("longbow"),
        targetType: "specialization"
      }
    });
    const tooLow = evaluateSkillSelection({
      content: testContent,
      progression: buildProgression({ bow: 5 }),
      target: {
        specialization: getSpecialization("longbow"),
        targetType: "specialization"
      }
    });

    expect(missingParent.isAllowed).toBe(false);
    expect(missingParent.blockingReasons.map((reason) => reason.code)).toEqual([
      "missing-specialization-parent-skill"
    ]);
    expect(tooLow.isAllowed).toBe(false);
    expect(tooLow.blockingReasons.map((reason) => reason.code)).toEqual([
      "specialization-parent-skill-too-low"
    ]);
    expect(tooLow.blockingReasons[0]?.requiredLevel).toBe(6);
    expect(tooLow.blockingReasons[0]?.currentLevel).toBe(5);
  });

  it("allows a specialization-bridge specialization when the parent source level meets the threshold through non-derived base XP only", () => {
    const directParent = evaluateSkillSelection({
      content: testContent,
      progression: buildProgression({ bow: 6 }),
      target: {
        specialization: getSpecialization("longbow"),
        targetType: "specialization"
      }
    });
    const groupParent = evaluateSkillSelection({
      content: testContent,
      progression: buildProgression({}, { combat: 6 }),
      target: {
        specialization: getSpecialization("longbow"),
        targetType: "specialization"
      }
    });
    const derivedLookingParent = evaluateSkillSelection({
      content: testContent,
      progression: buildProgression({ crossbow: 20 }),
      target: {
        specialization: getSpecialization("longbow"),
        targetType: "specialization"
      }
    });

    expect(directParent.isAllowed).toBe(true);
    expect(groupParent.isAllowed).toBe(true);
    expect(derivedLookingParent.isAllowed).toBe(false);
    expect(derivedLookingParent.blockingReasons[0]?.code).toBe("missing-specialization-parent-skill");
  });

  it("blocks a specialization when the parent skill is missing", () => {
    const evaluation = evaluateSkillSelection({
      content: testContent,
      progression: buildProgression({}),
      target: {
        specialization: getSpecialization("dueling"),
        targetType: "specialization"
      }
    });

    expect(evaluation.isAllowed).toBe(false);
    expect(evaluation.blockingReasons.map((reason) => reason.code)).toEqual([
      "missing-specialization-parent-skill"
    ]);
  });

  it("allows a specialization-bridge specialization when the parent base meets the threshold and rejects derived-only parent XP", () => {
    const allowed = evaluateSkillSelection({
      content: testContent,
      progression: buildProgression({ one_handed_edged: 8 }),
      target: {
        specialization: getSpecialization("fencing"),
        targetType: "specialization"
      }
    });
    const derivedOnly = evaluateSkillSelection({
      content: testContent,
      progression: buildProgression({ longbow: 20 }),
      target: {
        specialization: getSpecialization("fencing"),
        targetType: "specialization"
      }
    });

    expect(allowed.isAllowed).toBe(true);
    expect(derivedOnly.isAllowed).toBe(false);
    expect(derivedOnly.blockingReasons[0]?.code).toBe(
      "missing-specialization-parent-skill"
    );
  });

  it("blocks a specialization when the parent skill level is too low", () => {
    const evaluation = evaluateSkillSelection({
      content: testContent,
      progression: buildProgression({ weapon_training: 2 }),
      target: {
        specialization: getSpecialization("dueling"),
        targetType: "specialization"
      }
    });

    expect(evaluation.isAllowed).toBe(false);
    expect(evaluation.blockingReasons.map((reason) => reason.code)).toEqual([
      "specialization-parent-skill-too-low"
    ]);
    expect(evaluation.blockingReasons[0]?.requiredLevel).toBe(3);
    expect(evaluation.blockingReasons[0]?.currentLevel).toBe(2);
  });

  it("blocks a specialization when the parent skill disallows specializations", () => {
    const evaluation = evaluateSkillSelection({
      content: testContent,
      progression: buildProgression({ insight: 2 }),
      target: {
        specialization: getSpecialization("court_intrigue"),
        targetType: "specialization"
      }
    });

    expect(evaluation.isAllowed).toBe(false);
    expect(evaluation.blockingReasons.map((reason) => reason.code)).toEqual([
      "specialization-parent-disallows-specializations"
    ]);
  });

  it("allows a specialization when the parent skill level meets the threshold", () => {
    const evaluation = evaluateSkillSelection({
      content: testContent,
      progression: buildProgression({ weapon_training: 3 }),
      target: {
        specialization: getSpecialization("dueling"),
        targetType: "specialization"
      }
    });

    expect(evaluation.isAllowed).toBe(true);
    expect(evaluation.blockingReasons).toHaveLength(0);
  });

  it("allows a specialization when the parent skill threshold is met through effective group XP", () => {
    const evaluation = evaluateSkillSelection({
      content: testContent,
      progression: buildProgression({}, { combat: 3 }),
      target: {
        specialization: getSpecialization("dueling"),
        targetType: "specialization"
      }
    });

    expect(evaluation.isAllowed).toBe(true);
    expect(evaluation.blockingReasons).toHaveLength(0);
  });

  it("does not treat unselected slot weapons as present through group XP", () => {
    const contentWithCombatSlots = validateCanonicalContent({
      ...testContent,
      skillGroups: [
        ...testContent.skillGroups,
        {
          id: "advanced_melee_training",
          name: "Advanced Melee Training",
          selectionSlots: [
            {
              candidateSkillIds: ["longsword", "battleaxe", "spear"],
              chooseCount: 1,
              id: "melee_weapon_choice",
              label: "Choose one melee weapon",
              required: true
            }
          ],
          sortOrder: 4
        }
      ],
      skills: [
        ...testContent.skills,
        {
          allowsSpecializations: false,
          category: "ordinary",
          dependencies: [],
          dependencySkillIds: [],
          groupId: "advanced_melee_training",
          groupIds: ["advanced_melee_training"],
          id: "longsword",
          linkedStats: ["str", "dex"],
          name: "Longsword",
          requiresLiteracy: "no",
          sortOrder: 10
        },
        {
          allowsSpecializations: false,
          category: "ordinary",
          dependencies: [
            {
              skillId: "battleaxe",
              strength: "required"
            }
          ],
          dependencySkillIds: ["battleaxe"],
          groupId: "social",
          groupIds: ["social"],
          id: "axe_mastery",
          linkedStats: ["str", "dex"],
          name: "Axe Mastery",
          requiresLiteracy: "no",
          sortOrder: 11
        },
        {
          allowsSpecializations: false,
          category: "ordinary",
          dependencies: [],
          dependencySkillIds: [],
          groupId: "advanced_melee_training",
          groupIds: ["advanced_melee_training"],
          id: "battleaxe",
          linkedStats: ["str", "dex"],
          name: "Battleaxe",
          requiresLiteracy: "no",
          sortOrder: 12
        },
        {
          allowsSpecializations: false,
          category: "ordinary",
          dependencies: [],
          dependencySkillIds: [],
          groupId: "advanced_melee_training",
          groupIds: ["advanced_melee_training"],
          id: "spear",
          linkedStats: ["str", "dex"],
          name: "Spear",
          requiresLiteracy: "no",
          sortOrder: 13
        }
      ],
      specializations: testContent.specializations
    });

    const evaluation = evaluateSkillSelection({
      content: contentWithCombatSlots,
      progression: {
        ...createChargenProgression(),
        chargenSelections: {
          selectedGroupSlots: [
            {
              groupId: "advanced_melee_training",
              selectedSkillIds: ["longsword"],
              slotId: "melee_weapon_choice"
            }
          ],
          selectedLanguageIds: [],
          selectedSkillIds: []
        },
        skillGroups: [
          {
            gms: 0,
            grantedRanks: 0,
            groupId: "advanced_melee_training",
            primaryRanks: 3,
            ranks: 3,
            secondaryRanks: 0
          }
        ],
        skills: []
      },
      target: {
        skill: contentWithCombatSlots.skills.find((skill) => skill.id === "axe_mastery")!,
        targetType: "skill"
      }
    });

    expect(evaluation.isAllowed).toBe(false);
    expect(evaluation.blockingReasons.map((reason) => reason.code)).toEqual([
      "missing-required-dependency"
    ]);
  });

  it("returns the correct mixed dependency state", () => {
    const evaluation = evaluateSkillSelection({
      content: testContent,
      progression: buildProgression({}),
      target: {
        skill: getSkill("statecraft"),
        targetType: "skill"
      }
    });

    expect(evaluation.isAllowed).toBe(false);
    expect(evaluation.blockingReasons.map((reason) => reason.code)).toEqual([
      "missing-required-dependency"
    ]);
    expect(evaluation.warnings.map((warning) => warning.code)).toEqual([
      "missing-recommended-dependency"
    ]);
    expect(evaluation.advisories.map((advisory) => advisory.code)).toEqual([
      "missing-helpful-dependency"
    ]);
  });
});
