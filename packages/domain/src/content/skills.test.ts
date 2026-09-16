import { describe, expect, it } from "vitest";

import { chargenTargetSkillDefinitionSchema, skillDefinitionSchema } from "./skills";

const groupFreeTarget = {
  competencyType: "base-skill",
  id: "test:skill",
  name: "Target fixture",
  description: "A synthetic target used to exercise representation boundaries.",
  shortDescription: "Group-free target fixture.",
  linkedStats: ["int"],
};

describe("group-free target Chargen representation", () => {
  it("accepts explicitly typed targets without weakening legacy required-group validation", () => {
    expect(chargenTargetSkillDefinitionSchema.parse(groupFreeTarget)).toEqual(groupFreeTarget);
    expect(skillDefinitionSchema.safeParse(groupFreeTarget).success).toBe(false);
    expect(
      skillDefinitionSchema.safeParse({
        ...groupFreeTarget,
        groupId: "test-group",
        groupIds: ["test-group"],
      }).success,
    ).toBe(true);
  });

  it("requires resolved linked stats and rejects invented group, category or availability fields", () => {
    for (const value of [undefined, []]) {
      expect(
        chargenTargetSkillDefinitionSchema.safeParse({ ...groupFreeTarget, linkedStats: value })
          .success,
      ).toBe(false);
    }
    for (const extra of [
      { groupId: "invented" },
      { groupIds: ["invented"] },
      { category: "ordinary" },
      { societyId: "invented" },
      { availability: "universal" },
    ]) {
      expect(
        chargenTargetSkillDefinitionSchema.safeParse({ ...groupFreeTarget, ...extra }).success,
      ).toBe(false);
    }
  });

  it("keeps base, spoken and written types distinct through serialization", () => {
    for (const competencyType of ["base-skill", "spoken-language", "written-tradition"]) {
      const value = { ...groupFreeTarget, competencyType };
      expect(
        chargenTargetSkillDefinitionSchema.parse(JSON.parse(JSON.stringify(value))).competencyType,
      ).toBe(competencyType);
    }
  });
});
