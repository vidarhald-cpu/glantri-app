import { describe, expect, it } from "vitest";

import type { SkillDefinition, SkillSpecialization } from "@glantri/domain";

import {
  deriveBestSkillRelationships,
  deriveBestSkillRelationshipXp
} from "./deriveSkillRelationships";

function createSkill(
  skill: Pick<SkillDefinition, "groupId" | "groupIds" | "id" | "linkedStats" | "name"> &
    Partial<
      Pick<
        SkillDefinition,
        | "category"
        | "derivedGrants"
        | "meleeCrossTraining"
        | "specializationBridge"
        | "specializationOfSkillId"
      >
    >
): SkillDefinition {
  return {
    allowsSpecializations: false,
    category: skill.category ?? "ordinary",
    categoryId: "combat",
    dependencies: [],
    dependencySkillIds: [],
    derivedGrants: skill.derivedGrants ?? [],
    groupId: skill.groupId,
    groupIds: skill.groupIds,
    id: skill.id,
    isTheoretical: false,
    linkedStats: skill.linkedStats,
    meleeCrossTraining: skill.meleeCrossTraining,
    name: skill.name,
    requiresLiteracy: "no",
    societyLevel: 1,
    sortOrder: 1,
    specializationBridge: skill.specializationBridge,
    specializationOfSkillId: skill.specializationOfSkillId
  };
}

function createSpecialization(
  specialization: Pick<SkillSpecialization, "id" | "name" | "skillId"> &
    Partial<Pick<SkillSpecialization, "minimumGroupLevel" | "minimumParentLevel" | "specializationBridge">>
): SkillSpecialization {
  return {
    id: specialization.id,
    minimumGroupLevel: specialization.minimumGroupLevel ?? 6,
    minimumParentLevel: specialization.minimumParentLevel ?? 6,
    name: specialization.name,
    skillId: specialization.skillId,
    sortOrder: 1,
    specializationBridge: specialization.specializationBridge
  };
}

describe("deriveBestSkillRelationshipXp", () => {
  it("supports explicit one-way derived grants without reverse grants", () => {
    const skills = [
      createSkill({
        derivedGrants: [{ factor: 1, skillId: "first_aid" }],
        groupId: "medicine_group",
        groupIds: ["medicine_group"],
        id: "medicine",
        linkedStats: ["int"],
        name: "Medicine"
      }),
      createSkill({
        groupId: "medicine_group",
        groupIds: ["medicine_group"],
        id: "first_aid",
        linkedStats: ["int"],
        name: "First aid"
      })
    ];

    const medicineDerived = deriveBestSkillRelationshipXp({
      ownedXpBySkillId: new Map([["medicine", 10]]),
      skills
    });
    const firstAidDerived = deriveBestSkillRelationshipXp({
      ownedXpBySkillId: new Map([["first_aid", 10]]),
      skills
    });

    expect(medicineDerived.get("first_aid")).toMatchObject({
      sourceSkillId: "medicine",
      sourceType: "explicit",
      xp: 10
    });
    expect(firstAidDerived.has("medicine")).toBe(false);
  });

  it("applies ordinary symmetric bow and crossbow cross-training at 50% with round-down", () => {
    const skills = [
      createSkill({
        derivedGrants: [{ factor: 0.5, skillId: "crossbow" }],
        groupId: "combat_group",
        groupIds: ["combat_group"],
        id: "bow",
        linkedStats: ["dex"],
        name: "Bow"
      }),
      createSkill({
        derivedGrants: [{ factor: 0.5, skillId: "bow" }],
        groupId: "combat_group",
        groupIds: ["combat_group"],
        id: "crossbow",
        linkedStats: ["dex"],
        name: "Crossbow"
      })
    ];

    expect(
      deriveBestSkillRelationshipXp({
        ownedXpBySkillId: new Map([["bow", 10]]),
        skills
      }).get("crossbow")?.xp
    ).toBe(5);
    expect(
      deriveBestSkillRelationshipXp({
        ownedXpBySkillId: new Map([["crossbow", 9]]),
        skills
      }).get("bow")?.xp
    ).toBe(4);
  });

  it("applies melee cross-training at 75% for one dimension and 50% for two dimensions", () => {
    const skills = [
      createSkill({
        groupId: "combat_group",
        groupIds: ["combat_group"],
        id: "one_handed_edged",
        linkedStats: ["dex"],
        meleeCrossTraining: {
          attackStyle: "slash",
          handClass: "one-handed"
        },
        name: "1-h edged"
      }),
      createSkill({
        groupId: "combat_group",
        groupIds: ["combat_group"],
        id: "one_handed_concussion_axe",
        linkedStats: ["dex"],
        meleeCrossTraining: {
          attackStyle: "strike",
          handClass: "one-handed"
        },
        name: "1-h conc./axe"
      }),
      createSkill({
        groupId: "combat_group",
        groupIds: ["combat_group"],
        id: "two_handed_edged",
        linkedStats: ["dex"],
        meleeCrossTraining: {
          attackStyle: "slash",
          handClass: "two-handed"
        },
        name: "2-h edged"
      }),
      createSkill({
        groupId: "combat_group",
        groupIds: ["combat_group"],
        id: "polearms",
        linkedStats: ["dex"],
        meleeCrossTraining: {
          attackStyle: "thrust",
          handClass: "two-handed"
        },
        name: "Polearms"
      })
    ];

    const result = deriveBestSkillRelationshipXp({
      ownedXpBySkillId: new Map([["one_handed_edged", 10]]),
      skills
    });

    expect(result.get("one_handed_concussion_axe")?.xp).toBe(7);
    expect(result.get("two_handed_edged")?.xp).toBe(7);
    expect(result.get("polearms")?.xp).toBe(5);
  });

  it("applies the bow to longbow specialization bridge from parent excess above five", () => {
    const skills = [
      createSkill({
        groupId: "combat_group",
        groupIds: ["combat_group"],
        id: "bow",
        linkedStats: ["dex"],
        name: "Bow"
      }),
      createSkill({
        groupId: "combat_group",
        groupIds: ["combat_group"],
        id: "longbow",
        linkedStats: ["dex"],
        name: "Longbow",
        specializationOfSkillId: "bow"
      })
    ];
    const specializations = [
      createSpecialization({
        id: "longbow",
        name: "Longbow",
        skillId: "bow",
        specializationBridge: {
          parentExcessOffset: 5,
          parentSkillId: "bow",
          reverseFactor: 1,
          threshold: 6
        }
      })
    ];

    expect(
      deriveBestSkillRelationships({
        skillBaseXpBySkillId: new Map([["bow", 6]]),
        skills,
        specializations
      }).bestDerivedBySpecializationId.get("longbow")?.xp
    ).toBe(1);
    expect(
      deriveBestSkillRelationships({
        skillBaseXpBySkillId: new Map([["bow", 10]]),
        skills,
        specializations
      }).bestDerivedBySpecializationId.get("longbow")?.xp
    ).toBe(5);
  });

  it("applies reverse specialization-bridge grants from child skills back to the parent", () => {
    const skills = [
      createSkill({
        groupId: "combat_group",
        groupIds: ["combat_group"],
        id: "bow",
        linkedStats: ["dex"],
        name: "Bow"
      }),
      createSkill({
        groupId: "combat_group",
        groupIds: ["combat_group"],
        id: "longbow",
        linkedStats: ["dex"],
        name: "Longbow",
        specializationOfSkillId: "bow"
      })
    ];
    const specializations = [
      createSpecialization({
        id: "longbow",
        name: "Longbow",
        skillId: "bow",
        specializationBridge: {
          parentExcessOffset: 5,
          parentSkillId: "bow",
          reverseFactor: 1,
          threshold: 6
        }
      })
    ];

    expect(
      deriveBestSkillRelationships({
        skillBaseXpBySkillId: new Map(),
        skills,
        specializationBaseXpBySpecializationId: new Map([["longbow", 7]]),
        specializations
      }).bestDerivedBySkillId.get("bow")
    ).toMatchObject({
      sourceSkillId: "longbow",
      sourceType: "specialization-bridge-child",
      xp: 7
    });
  });

  it("applies specialization bridges for specialization children and reverse grants to parent skills", () => {
    const skills = [
      createSkill({
        groupId: "combat_group",
        groupIds: ["combat_group"],
        id: "one_handed_edged",
        linkedStats: ["dex"],
        name: "1-h edged"
      })
    ];
    const specializations = [
      createSpecialization({
        id: "fencing",
        name: "Fencing",
        skillId: "one_handed_edged",
        specializationBridge: {
          parentExcessOffset: 5,
          parentSkillId: "one_handed_edged",
          reverseFactor: 1,
          threshold: 6
        }
      })
    ];

    const parentResult = deriveBestSkillRelationships({
      skillBaseXpBySkillId: new Map([["one_handed_edged", 10]]),
      skills,
      specializations
    });
    const childResult = deriveBestSkillRelationships({
      skillBaseXpBySkillId: new Map(),
      skills,
      specializationBaseXpBySpecializationId: new Map([["fencing", 6]]),
      specializations
    });

    expect(parentResult.bestDerivedBySpecializationId.get("fencing")?.xp).toBe(5);
    expect(childResult.bestDerivedBySkillId.get("one_handed_edged")).toMatchObject({
      sourceSkillId: "fencing",
      sourceType: "specialization-bridge-child",
      xp: 6
    });
  });

  it("does not recursively chain derived grants through bridge-created child skill XP", () => {
    const skills = [
      createSkill({
        groupId: "combat_group",
        groupIds: ["combat_group"],
        id: "bow",
        linkedStats: ["dex"],
        name: "Bow"
      }),
      createSkill({
        groupId: "combat_group",
        groupIds: ["combat_group"],
        id: "longbow",
        linkedStats: ["dex"],
        name: "Longbow",
        specializationOfSkillId: "bow"
      }),
      createSkill({
        derivedGrants: [{ factor: 1, skillId: "crossbow" }],
        groupId: "combat_group",
        groupIds: ["combat_group"],
        id: "crossbow",
        linkedStats: ["dex"],
        name: "Crossbow"
      })
    ];
    const specializations = [
      createSpecialization({
        id: "longbow",
        name: "Longbow",
        skillId: "bow",
        specializationBridge: {
          parentExcessOffset: 5,
          parentSkillId: "bow",
          reverseFactor: 1,
          threshold: 6
        }
      })
    ];

    const result = deriveBestSkillRelationships({
      skillBaseXpBySkillId: new Map([["bow", 10]]),
      skills,
      specializations
    });

    expect(result.bestDerivedBySpecializationId.get("longbow")?.xp).toBe(5);
    expect(result.bestDerivedBySkillId.has("crossbow")).toBe(false);
  });

  it("keeps only the single best derived grant for each target", () => {
    const skills = [
      createSkill({
        derivedGrants: [{ factor: 0.5, skillId: "bow" }],
        groupId: "combat_group",
        groupIds: ["combat_group"],
        id: "crossbow",
        linkedStats: ["dex"],
        name: "Crossbow"
      }),
      createSkill({
        groupId: "combat_group",
        groupIds: ["combat_group"],
        id: "bow",
        linkedStats: ["dex"],
        name: "Bow"
      }),
      createSkill({
        groupId: "combat_group",
        groupIds: ["combat_group"],
        id: "longbow",
        linkedStats: ["dex"],
        name: "Longbow",
        specializationOfSkillId: "bow"
      })
    ];
    const specializations = [
      createSpecialization({
        id: "longbow",
        name: "Longbow",
        skillId: "bow",
        specializationBridge: {
          parentExcessOffset: 5,
          parentSkillId: "bow",
          reverseFactor: 1,
          threshold: 6
        }
      })
    ];

    const result = deriveBestSkillRelationships({
      skillBaseXpBySkillId: new Map([["crossbow", 10]]),
      skills,
      specializationBaseXpBySpecializationId: new Map([["longbow", 7]]),
      specializations
    });

    expect(result.bestDerivedBySkillId.get("bow")).toMatchObject({
      sourceSkillId: "longbow",
      xp: 7
    });
  });
});
