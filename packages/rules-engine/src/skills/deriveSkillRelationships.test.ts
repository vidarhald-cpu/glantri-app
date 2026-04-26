import { describe, expect, it } from "vitest";

import type { SkillDefinition } from "@glantri/domain";

import { deriveBestSkillRelationshipXp } from "./deriveSkillRelationships";

function createSkill(
  skill: Pick<SkillDefinition, "groupId" | "groupIds" | "id" | "linkedStats" | "name"> &
    Partial<Pick<SkillDefinition, "category" | "derivedGrants" | "meleeCrossTraining">>
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
    sortOrder: 1
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

  it("keeps only the single best derived grant for each target", () => {
    const skills = [
      createSkill({
        derivedGrants: [{ factor: 0.5, skillId: "first_aid" }],
        groupId: "medicine_group",
        groupIds: ["medicine_group"],
        id: "herbalism",
        linkedStats: ["int"],
        name: "Herbalism"
      }),
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

    const result = deriveBestSkillRelationshipXp({
      ownedXpBySkillId: new Map([
        ["herbalism", 20],
        ["medicine", 10]
      ]),
      skills
    });

    expect(result.get("first_aid")).toMatchObject({
      sourceSkillId: "medicine",
      xp: 10
    });
  });
});
