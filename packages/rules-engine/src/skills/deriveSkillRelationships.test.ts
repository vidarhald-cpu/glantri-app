import { describe, expect, it } from "vitest";

import type { LegacySkillDefinition } from "@glantri/domain";

import {
  deriveBestSkillRelationships,
  deriveBestSkillRelationshipXp,
} from "./deriveSkillRelationships";

function createSkill(
  skill: Pick<LegacySkillDefinition, "groupId" | "groupIds" | "id" | "linkedStats" | "name"> &
    Partial<
      Pick<
        LegacySkillDefinition,
        "category" | "derivedGrants" | "meleeCrossTraining" | "specializationOfSkillId"
      >
    >,
): LegacySkillDefinition {
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
    specializationOfSkillId: skill.specializationOfSkillId,
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
        name: "Medicine",
      }),
      createSkill({
        groupId: "medicine_group",
        groupIds: ["medicine_group"],
        id: "first_aid",
        linkedStats: ["int"],
        name: "First aid",
      }),
    ];

    const medicineDerived = deriveBestSkillRelationshipXp({
      ownedXpBySkillId: new Map([["medicine", 10]]),
      skills,
    });
    const firstAidDerived = deriveBestSkillRelationshipXp({
      ownedXpBySkillId: new Map([["first_aid", 10]]),
      skills,
    });

    expect(medicineDerived.get("first_aid")).toMatchObject({
      sourceSkillId: "medicine",
      sourceType: "explicit",
      xp: 10,
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
        name: "Bow",
      }),
      createSkill({
        derivedGrants: [{ factor: 0.5, skillId: "bow" }],
        groupId: "combat_group",
        groupIds: ["combat_group"],
        id: "crossbow",
        linkedStats: ["dex"],
        name: "Crossbow",
      }),
    ];

    expect(
      deriveBestSkillRelationshipXp({
        ownedXpBySkillId: new Map([["bow", 10]]),
        skills,
      }).get("crossbow")?.xp,
    ).toBe(5);
    expect(
      deriveBestSkillRelationshipXp({
        ownedXpBySkillId: new Map([["crossbow", 9]]),
        skills,
      }).get("bow")?.xp,
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
          handClass: "one-handed",
        },
        name: "1-h edged",
      }),
      createSkill({
        groupId: "combat_group",
        groupIds: ["combat_group"],
        id: "one_handed_concussion_axe",
        linkedStats: ["dex"],
        meleeCrossTraining: {
          attackStyle: "strike",
          handClass: "one-handed",
        },
        name: "1-h conc./axe",
      }),
      createSkill({
        groupId: "combat_group",
        groupIds: ["combat_group"],
        id: "two_handed_edged",
        linkedStats: ["dex"],
        meleeCrossTraining: {
          attackStyle: "slash",
          handClass: "two-handed",
        },
        name: "2-h edged",
      }),
      createSkill({
        groupId: "combat_group",
        groupIds: ["combat_group"],
        id: "polearms",
        linkedStats: ["dex"],
        meleeCrossTraining: {
          attackStyle: "thrust",
          handClass: "two-handed",
        },
        name: "Polearms",
      }),
    ];

    const result = deriveBestSkillRelationshipXp({
      ownedXpBySkillId: new Map([["one_handed_edged", 10]]),
      skills,
    });

    expect(result.get("one_handed_concussion_axe")?.xp).toBe(7);
    expect(result.get("two_handed_edged")?.xp).toBe(7);
    expect(result.get("polearms")?.xp).toBe(5);
  });

  it("derives nothing between Bow and Longbow, which are two ordinary base combat Skills", () => {
    /* Rule decision 0010 ruling 2 makes Longbow a base combat Skill and ruling 5 deletes the
       `specializationBridge` mechanism. Longbow's authored tie to Bow is the qualitative `helpful`
       dependency, which grants no XP in either direction, so investing in Bow derives nothing for
       Longbow and nothing chains onward. No coefficient exists to assert. */
    const skills = [
      createSkill({
        groupId: "combat_group",
        groupIds: ["combat_group"],
        id: "bow",
        linkedStats: ["dex"],
        name: "Bow",
      }),
      createSkill({
        groupId: "combat_group",
        groupIds: ["combat_group"],
        id: "longbow",
        linkedStats: ["dex"],
        name: "Longbow",
      }),
      createSkill({
        derivedGrants: [{ factor: 1, skillId: "crossbow" }],
        groupId: "combat_group",
        groupIds: ["combat_group"],
        id: "crossbow",
        linkedStats: ["dex"],
        name: "Crossbow",
      }),
    ];

    const result = deriveBestSkillRelationships({
      skillBaseXpBySkillId: new Map([["bow", 10]]),
      skills,
      specializations: [],
    });

    expect(result.bestDerivedBySkillId.has("longbow")).toBe(false);
    expect(result.bestDerivedBySpecializationId.has("longbow")).toBe(false);
    expect(result.bestDerivedBySkillId.has("crossbow")).toBe(false);
  });

  it("keeps only the single best derived grant for each target", () => {
    /* Bow receives an explicit 50% grant from Crossbow and a 50% melee cross-training-style grant
       from nothing else; the explicit mechanism outranks cross-training, so it is the one kept. */
    const skills = [
      createSkill({
        derivedGrants: [{ factor: 0.5, skillId: "bow" }],
        groupId: "combat_group",
        groupIds: ["combat_group"],
        id: "crossbow",
        linkedStats: ["dex"],
        name: "Crossbow",
      }),
      createSkill({
        derivedGrants: [{ factor: 0.25, skillId: "bow" }],
        groupId: "combat_group",
        groupIds: ["combat_group"],
        id: "sling",
        linkedStats: ["dex"],
        name: "Sling",
      }),
      createSkill({
        groupId: "combat_group",
        groupIds: ["combat_group"],
        id: "bow",
        linkedStats: ["dex"],
        name: "Bow",
      }),
    ];

    const result = deriveBestSkillRelationships({
      skillBaseXpBySkillId: new Map([
        ["crossbow", 10],
        ["sling", 10],
      ]),
      skills,
      specializations: [],
    });

    expect(result.bestDerivedBySkillId.get("bow")).toMatchObject({
      sourceSkillId: "crossbow",
      xp: 5,
    });
  });
});
