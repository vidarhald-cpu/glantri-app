import { describe, expect, it } from "vitest";

import { professionSkillMapSchema } from "./professions";

describe("profession compatibility", () => {
  it("normalizes retired skill group ids in profession grants", () => {
    expect(
      professionSkillMapSchema.parse({
        grantType: "group",
        professionId: "legacy-profession",
        skillGroupId: "officer_training"
      }).skillGroupId
    ).toBe("veteran_leadership");
  });
});
